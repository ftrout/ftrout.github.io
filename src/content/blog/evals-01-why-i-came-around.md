---
title: "I Ignored Evals for a Year. Now I Can't Ship Without Them"
description: "How I went from treating evals as an academic chore to refusing to merge a security agent change without them, and a map of what the word actually covers."
pubDate: 2026-09-24
tags: [llm-evals, agents, security]
series: "Evals in Practice"
seriesOrder: 1
draft: true
---

For about a year I built agents for a security team without evals. Not
because I had decided against them. I had simply never felt the need. The
agent worked when I tried it, the analysts liked the demo, and the few
times something went wrong I could fix it in an afternoon and move on.

This post is about why that stopped working, and about the thing I wish
someone had told me at the start: "evals" is not one technique. It is a
family of techniques, each answering a different question, and most of my
early frustration came from expecting one of them to do the job of all of
them.

## How I got away with it

My first agent was an alert triage assistant for the SOC. It had four
tools: enrich an indicator against threat intelligence, run a scoped
query against the SIEM, look up the owner of an asset, and open an
incident. An analyst would hand it an alert and it would come back with
a summary, a severity, and a recommendation.

I tested it the way most people test their first agent: I pasted alerts
into a chat window and read what came back. When the triage was good I
shipped. When it was bad I changed the prompt, pasted the same alerts
again, and shipped when they looked good.

This works surprisingly well for a while. The system is small, you
remember the failure cases, and the model is forgiving. I convinced myself
that evals were something you did for benchmarks and papers, not for an
internal tool with a dozen analysts using it.

## The week it stopped working

Three things happened in the same week, and any one of them would have
been enough.

First, a prompt change I made to fix one complaint quietly broke a
different behavior. An analyst noticed that credential-stuffing alerts
had stopped being escalated. It took two days to connect that regression
to a one-line edit I had made to make summaries of low-severity phishing
reports less verbose.

Second, we upgraded the model. Everything I pasted into the chat window
looked better. Two weeks later I found that the agent had started
building SIEM queries with a slightly different time-range syntax, and
about a fifth of those queries were returning zero rows. The model was
reading "zero rows" as "no evidence of lateral movement" and saying so,
confidently, in the summary. In a security context that is not a bug. It
is a false negative with a signature on it.

Third, the team lead asked a question I could not answer: "Is the agent
better than it was last month?" I had opinions. I had no evidence.

None of these were exotic failures. They are the ordinary consequences of
changing a probabilistic system without a way to measure it. I had been
lucky, and my luck had run out at the normal time.

## What I do now

Today I will not merge a change to a security agent without running it
against an eval set. Not because a policy says so, but because I have
been burned enough times that the alternative feels reckless. The eval
set is small, it runs in a few minutes, and it costs a few dollars. It
has caught more regressions than every other testing practice we have
combined.

More than that, it changed how I work. Prompt tuning went from an argument
about taste to a diff of which alerts got triaged better and which got
worse. Model upgrades went from a leap of faith to a number. And when an
analyst flags a bad triage, the first thing I do is turn it into a case,
so the same mistake cannot come back unnoticed.

## "Evals" is a broad word

Here is the part that took me longest to understand. When people say
"evals" they can mean any of several quite different things, and mixing
them up is how you end up with a harness that produces confident numbers
that mean nothing.

Each type of eval answers a different question. The rest of this series
takes them one at a time, with a real use case from security work and
working code. Here is the map.

| Type | Question it answers | Grader | Cost |
|---|---|---|---|
| Code-graded | Did the output match a known-correct value or structure? | Deterministic code | Nearly free |
| LLM-as-judge | Is this open-ended output good, according to a rubric? | A model, calibrated against analysts | Cents per case |
| Retrieval | Did the search step find the right playbook or report before the model wrote anything? | Set overlap against labeled sources | Nearly free |
| Trajectory | Did the agent take a sensible path: right tools, right arguments, no wasted or dangerous steps? | Assertions over the transcript | Nearly free |
| Outcome | Did the agent actually finish the job, as judged by the state of the systems afterward? | Checks against a sandbox after the run | Runtime of the task |
| Adversarial | Does it hold up when the input was written by an attacker, and refuse when it should? | Mix of code and judge | Varies |
| Online | Is production behaving the way the offline evals said it would? | Sampled judging of real traffic plus analyst feedback | Ongoing |

**Code-graded evals** are the ones people skip because they seem too
simple. If the output is a severity, a category, a set of indicators, or
a JSON record, you can grade it with an equals sign. They run in
milliseconds, they never disagree with themselves, and they should be the
first thing you build.

**LLM-as-judge evals** cover everything the equals sign cannot. Incident
summaries, explanations of why an alert matters, recommended next steps.
You describe what a good answer looks like, a model grades against that
rubric, and you check the model's grades against a handful of analyst
grades before you trust them. The calibration step is the whole game.
Skip it and you have a random number generator with a confident tone.

**Retrieval evals** exist because in a system that answers from
playbooks and past incidents, most bad answers are bad retrieval wearing
a disguise. Measuring whether the right document was in the top results,
separately from whether the final answer was correct, tells you which
half of the pipeline to fix.

**Trajectory evals** are specific to agents, and in security they matter
more than anywhere else I have worked. An agent can reach a correct
triage by a terrible path: querying the SIEM five times when once would
do, enriching an indicator with the wrong type, or skipping the asset
lookup before recommending isolation. Grading the path, not just the
destination, catches problems before they become incidents of their own.

**Outcome evals** are the opposite instinct. For tasks with side effects,
the transcript is not the point. Did the host get isolated? Did the
incident get opened with the right tags? You run the agent against
sandboxed systems, then inspect the sandbox, and you do not care how it
got there.

**Adversarial evals** ask what happens when the input is hostile, and in
security the input is hostile by definition. A phishing email the agent
is asked to analyze contains instructions aimed at the agent. A log line
contains a user-agent string designed to be read as a command. A request
asks the agent to disable an executive's account. They need both-direction
coverage, because an agent that refuses everything passes every refusal
test and is useless to the analysts.

**Online evals** close the loop. Everything above runs on a fixed set
before you ship. Production traffic is where the fixed set goes stale.
Sampling real triages, grading them, and feeding the failures back into
the offline set is how the set stays honest.

## What to build first

If you are where I was a year ago, here is the order I would follow now.

1. Write down twenty real alerts and the triage you would accept for
   each. This takes an afternoon and is the hardest step, because it
   forces you to decide what "correct" means.
2. Grade the ones you can grade with code. Run them on every change.
3. Add a judge for the rest, and check it against your own grading of
   those twenty before you believe it.
4. Add the specialized evals as the system earns them: retrieval when
   you add playbook search, trajectory when you add tools, outcome when
   the agent starts changing things, adversarial the moment it reads
   anything an attacker could have written.

The next post starts at step two, because the cheapest eval is also the
one most people never write.
