---
title: "Giving the Triage Agent a Memory of Past Incidents"
description: "Analysts ask ‘have we seen this before?’ constantly. Retrieval over closed cases can answer it, if you index case cards instead of tickets and treat old verdicts as evidence, not answers."
pubDate: 2026-09-10
tags: [rag, agents]
draft: false
---

The most useful question an experienced analyst asks is one the triage agent
could not: have we seen this before?

A senior analyst looks at an alert for a service account authenticating from
an odd subnet and says "that's the backup job, it does this every time they
patch the jump hosts, we closed three of these last month." That sentence
carries more signal than any enrichment lookup. It is the team's memory, and
it lives in people's heads and in a ticketing system nobody enjoys searching.

So we gave the agent a way to ask. It worked, eventually, but the first
version made it worse at triage, and the reasons are worth writing down.

## The first version: search the tickets

The obvious approach was retrieval-augmented generation over closed tickets.
Embed every resolved ticket, and when an alert comes in, retrieve the most
similar ones and put them in front of the model.

The results were poor, for reasons that are obvious in hindsight:

- **Tickets are mostly noise.** Auto-generated alert text, email threads,
  "assigning to tier 2," "any update?". The part that mattered, what the
  analyst concluded and why, was often one line at the bottom, if it existed.
- **Similar text is not a similar case.** Every alert from the same detection
  rule looks nearly identical, so retrieval returned the same rule's alerts
  regardless of whether the entities, the context or the outcome matched.
- **The model trusted old verdicts too much.** Shown three past tickets
  closed as benign, it closed the fourth as benign, including once when the
  fourth was the one that was not.

That third problem is the dangerous one, and I will come back to it.

## Index case cards, not tickets

The fix for the first two problems was to stop indexing raw tickets and
index a structured summary written at the moment a case is closed. We call
them case cards.

```python
from pydantic import BaseModel


class CaseCard(BaseModel):
    case_id: str
    closed_on: str
    detection: str              # rule name, as it appears in the SIEM
    entities: list[str]         # normalised: users, hosts, IPs, domains
    disposition: str            # true_positive | benign | false_positive | inconclusive
    reason: str                 # one or two sentences: why that disposition
    evidence: list[str]         # the specific facts that decided it
    analyst: str
```

When a ticket closes, a single model call reads the ticket and fills in the
card, and the closing analyst glances at it and fixes anything wrong. That
review step is quick, because the card is short, and it is where most of the
quality comes from.

Cards are what get indexed. They are short, so they embed well. The
`reason` and `evidence` fields hold the part of the ticket that actually
carried knowledge. And the structured fields make it possible to filter
before searching semantically.

## Filter first, then search

Pure semantic similarity was the wrong primary signal. What makes a past case
relevant is mostly structural: same detection, overlapping entities, recent
enough that the environment has not changed.

So retrieval is two steps. Filter on the structured fields, then rank by
similarity within what is left:

```python
def find_similar_cases(detection: str, entities: list[str], days: int = 180) -> list[CaseCard]:
    candidates = cards.filter(
        closed_after=days_ago(days),
        any_of={"detection": [detection], "entities": entities},
    )
    ranked = candidates.rank_by_similarity(query=f"{detection} {' '.join(entities)}")
    return ranked[:3]
```

Entity overlap turned out to matter more than anything the embedding
contributed. "Same service account, same rule, three times in six weeks" is
the pattern that makes a senior analyst say "that's the backup job," and it
is an exact match on structured fields, not a semantic one.

Measuring whether this retrieval was any good used the same approach as
[the retrieval evals post](/blog/evals-04-retrieval/): a set of alerts where
analysts had marked which past cases they would have wanted to see, scored on
whether those came back in the top three.

## Memory is evidence, not an answer

Back to the dangerous problem. An agent that sees "closed as benign, three
times" and closes the fourth as benign has not learned anything. It has
copied a verdict, and in doing so it has turned past mistakes into future
ones. If a real intrusion was once closed as benign, memory makes the next
one more likely to be closed as benign too.

Three changes made it behave more like the analyst and less like a lookup
table.

**The tool returns reasons, not just verdicts.** The result the agent sees
leads with the evidence that decided each past case, so the comparison it
makes is "does this alert share that evidence?" rather than "what was the
answer last time?"

```
3 similar closed cases (most recent first):

CASE-8812, closed 2026-08-19, BENIGN
  Why: svc-backup02 authenticates from 10.40.8.0/24 during the monthly
  jump-host patch window. Confirmed with infrastructure.
  Deciding evidence: patch window active; source in jump-host subnet;
  no interactive logon.
...
Compare the deciding evidence against this alert. A past disposition
does not decide this one.
```

**The system prompt says so too.** Past cases are context for what to check,
not a verdict to repeat, and the triage note must say which piece of current
evidence matches or differs from the past case.

**Memory never lowers severity on its own.** This one is enforced in code. A
match to past benign cases can add a note to the triage output. It cannot, by
itself, move an alert from "needs review" to "close." If the current evidence
does not support closing, a history of closing similar things does not
change that.

## Keep your evaluation cases out of the index

A mistake that took me an embarrassingly long time to notice: the evaluation
set for triage was built from real closed alerts. Those same alerts had case
cards. Those case cards were in the index.

So during evaluation, the agent would retrieve the case card for the exact
alert it was being tested on, complete with the right answer. Scores went up
noticeably when memory was added, and a good part of that improvement was the
test leaking its answers.

The fix is simple once you see it. Evaluation runs exclude any card whose
case ID is in the evaluation set, and new evaluation cases are drawn only
from cases closed after the index snapshot. The honest improvement from
memory was smaller than the first number suggested. It was still real.

## Is this an agent problem at all?

Worth asking, given [the post on when agents are not the answer](/blog/agents-arent-always-the-answer/).
The lookup itself is deterministic: every triage should check for similar
past cases, every time. So in the triage workflow it is not a tool the model
chooses to call. The code calls it before the model sees the alert, and the
results arrive as part of the input.

In the investigation agent it is a [tool](/blog/designing-tools-for-security-agents/),
because there the question comes up midway and depends on what has been
found: a new hostname turns up, and whether anyone has seen that host
before is worth one call.

Same retrieval, two different placements, chosen by the same rule as
everything else. If you know you will always need it, it belongs in code.

## What it is actually good for

The largest benefit was not accuracy on verdicts. It was triage notes that
said things like "similar to CASE-8812, which was the monthly patch window,
but the patch window is not active today." That is exactly the sentence a
senior analyst would write, and it is the one a newer analyst most needs to
see.
