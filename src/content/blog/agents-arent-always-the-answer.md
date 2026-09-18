---
title: "Agents Aren't Always the Answer"
description: "Our phishing triage agent kept skipping the authentication check. The fix was not a better prompt. It was deleting the agent and writing a pipeline that calls the model twice."
pubDate: 2026-09-05
tags: [agents, mlops, security]
draft: false
---

Our phishing triage agent kept skipping the SPF check.

Not every time. Maybe one report in seven. The agent had a tool that pulled
the authentication results out of the headers, and most of the time it called
it. When the body of the email was lurid enough, a fake invoice with a
countdown timer, it would sometimes go straight from reading the lure to
writing a verdict, and the verdict would be right, and nobody would notice
that it had reached it without checking whether the sender was who they said
they were.

I spent two weeks trying to fix that with prompting. Stronger instructions.
An explicit ordered checklist in the system prompt. A line saying the
authentication check is mandatory and must be performed first. It got better.
It never got to always.

Then it occurred to me that I was negotiating with a model about control
flow, and control flow is the thing computers are actually good at.

## What we were doing wrong

An agent, in the sense that matters here, is a system where the model decides
what to do next. You give it a set of tools and a goal, it picks a tool, reads
the result, and picks again, looping until it decides it is done. The
alternative is a workflow, where your code decides what happens next and the
model is called at specific points to do specific things.

Anthropic's own write-up on
[building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
draws the line the same way: workflows orchestrate models and tools through
predefined code paths, while agents let models direct their own process. Their
advice is to find the simplest thing that works and only add complexity when
it earns its place. I had read that. I had built the agent anyway, because
building an agent was more interesting than writing a pipeline.

Here is the thing I missed. Phishing triage is not an open-ended problem. The
steps are known before the email arrives. Parse the headers. Check SPF, DKIM
and DMARC. Extract the URLs and the attachment hashes. Look them up. Read the
body for social-engineering signals. Reach a verdict. Write it up. That list
does not change based on what the email says. I had handed a fixed procedure
to a component whose defining feature is that it improvises.

## What replaced it

The new version is a function. Code calls each step in order, every time, and
the model is called exactly twice: once to judge the lure text, which is a
genuine language problem, and once to write the analyst-facing summary, which
is also a genuine language problem. Everything else is a library call.

```python
# phishing/triage.py
from pydantic import BaseModel
import anthropic

client = anthropic.Anthropic()
MODEL = "claude-opus-5"


class LureAssessment(BaseModel):
    pretext: str          # invoice, password reset, executive request, ...
    urgency_cues: list[str]
    impersonated_party: str | None
    suspicion: int        # 1 low, 4 high


def triage(report: ReportedEmail) -> Verdict:
    # Deterministic, every time, in this order.
    auth = check_authentication(report.raw_headers)      # SPF / DKIM / DMARC
    urls = extract_urls(report.body)
    hashes = hash_attachments(report.attachments)
    reputation = lookup_indicators(urls + hashes)        # TI lookup, cached

    # The one part that is actually a language problem.
    lure: LureAssessment = client.messages.parse(
        model=MODEL,
        max_tokens=2048,
        system=LURE_RUBRIC,
        messages=[{"role": "user", "content": report.body_text[:20_000]}],
        output_format=LureAssessment,
    ).parsed_output

    verdict = score(auth, reputation, lure)              # a weights table
    verdict.summary = write_summary(verdict, auth, reputation, lure)
    return verdict
```

The authentication check cannot be skipped now, because skipping it is not a
behaviour the system has. The scoring is a weights table a human can read and
argue with, in a code review, with a diff. When an analyst disagrees with a
verdict we can point at the line that produced it.

We caught the original skipping problem with a
[trajectory eval](/blog/evals-05-trajectory/), which grades the path an agent
took rather than the answer it reached. That eval is now four assertions
shorter, because three of the things it used to check are no longer possible.

## What we gave up

This is the part that gets left out of posts like this one.

**The agent handled surprises better.** A report came in that was not a
phishing email at all, it was a user forwarding a genuine password reset and
asking whether it was real. The agent noticed, changed course, and answered
the actual question. The pipeline runs its seven steps and produces a verdict
for a message that did not need one. We added a cheap classifier at the front
to catch that case, which is one more branch in code that the agent got for
free.

**Adding a step is now a code change.** When we wanted to start checking
whether the sender domain was registered in the last thirty days, that was a
pull request, a review and a deploy. With the agent it would have been a new
tool and a sentence in the prompt.

**The pipeline is more code to own.** Roughly 400 lines that did not exist
before, and they have bugs, and I have to maintain them. The agent's control
flow was free in the sense that I never wrote it.

I would make the same trade again, for this task. A fixed procedure with a
high cost of error should be executed the same way every time.

## Where an agent still earns it

We kept one. Investigation, not triage.

When an analyst has a confirmed compromised host and wants to know what
happened, the steps genuinely cannot be written down in advance. What you
query second depends on what came back first. A suspicious parent process
sends you to the process tree; an odd outbound connection sends you to proxy
logs; neither is knowable when the investigation starts. Anthropic's guidance
describes this as open-ended problems where you cannot predict the number of
steps required, and that matches what investigation actually feels like.

That agent costs more per run and takes longer, because it makes many model
calls instead of two, and each one carries the conversation so far. It is
worth it because the alternative is an analyst doing the same thing by hand
for forty minutes. It runs in a sandbox with read-only tools, and anything
with a blast radius needs a human. Compounding errors are real, and the way
we live with them is by making sure a wrong step is recoverable.

## Where a single call is enough

The tier people skip past entirely. A lot of what we do is one request to the
API with a good prompt and no tools at all.

- Summarising a long incident ticket for a handover note.
- Turning an analyst's question into a SIEM query, which is translation.
- Classifying an alert into one of seven categories.
- Rewriting a technical finding for an executive audience.

None of those need a loop, because none of them need a second step. If the
task is one transformation of some text into some other text, a single call
with a well-written prompt is the whole system, and adding a framework around
it buys you nothing but latency and a dependency.

Here is how I choose now.

| Shape of the task | What to build |
|---|---|
| One transformation of text | A single API call |
| Known steps, fixed order | A workflow: your code, model called at specific points |
| Steps depend on what you find | An agent |

The test I apply is one question: can I write down the steps before I see the
input? If yes, the steps belong in code. The model should be called where
judgment is needed and nowhere else.

## The part I still get wrong

I am biased toward agents because they are more fun to build, and I suspect
most people writing about this are too. An agent demo is impressive in a way
that a function with seven steps in it is not. Nobody has ever asked me to
present a pipeline at a team meeting.

The counterweight I use is to write the seven steps down first. If I can, the
agent was never the answer. If I get to step three and the fourth depends on
what step three returned, that is the signal, and it is usually obvious within
five minutes of honest thinking.

Two weeks of prompt engineering would have been avoided by five minutes of
that.
