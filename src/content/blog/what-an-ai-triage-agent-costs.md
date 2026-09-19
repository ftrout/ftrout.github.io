---
title: "What an AI Triage Agent Actually Costs"
description: "Agents resend the whole conversation on every turn, so cost grows faster than turns. How to measure it per alert, a worked example, and the levers that actually move the number."
pubDate: 2026-09-12
tags: [mlops, architecture]
draft: false
---

The first cost estimate I gave for the triage agent was wrong by roughly a
factor of ten, and not in the direction anyone hopes for.

I had estimated from the size of one request: a system prompt, the alert, a
response. Multiply by alerts per day, multiply by the price per token, done.
What I had not accounted for is that an agent does not make one request. It
makes one per turn, and every one of them carries the entire conversation so
far.

## Why agents cost more than they look

The model API is stateless. It does not remember the previous turn, so each
request resends everything: the system prompt, the tool definitions, the
alert, every previous tool call and every previous tool result. Turn eight
pays again for all of turns one through seven.

That means input tokens grow roughly with the square of the number of turns,
not linearly. It is the single most important fact about agent cost.

## Measure it, do not estimate it

The API response tells you exactly what each call used, in `usage`:
`input_tokens`, `output_tokens`, and if you use prompt caching,
`cache_read_input_tokens` and `cache_creation_input_tokens`. Sum those per
run and you have the real number. If you already
[log every run](/blog/logging-for-agents/), you already have this data.

```python
# Fill these in from the current pricing page for the model you use.
PRICE_PER_MTOK = {
    "input": 0.0,
    "output": 0.0,
    "cache_write": 0.0,
    "cache_read": 0.0,
}


def run_cost(usage: dict[str, int]) -> float:
    return (
        usage.get("input_tokens", 0) * PRICE_PER_MTOK["input"]
        + usage.get("output_tokens", 0) * PRICE_PER_MTOK["output"]
        + usage.get("cache_creation_input_tokens", 0) * PRICE_PER_MTOK["cache_write"]
        + usage.get("cache_read_input_tokens", 0) * PRICE_PER_MTOK["cache_read"]
    ) / 1_000_000
```

The prices are left as zeros on purpose. They change, they differ by model,
and a blog post is the wrong place to copy them from.

Report cost **per alert type**, not as one average. A phishing report that
resolves in two turns and a lateral-movement alert that takes twelve are
different products with different economics, and the average describes
neither.

## A worked example

To show the shape, here is an illustrative agent run with round numbers. Swap
in your own from the logs.

Assume:

- System prompt plus tool definitions: 6,000 tokens.
- The alert: 2,000 tokens.
- Each turn, the model writes about 300 tokens and the tool result adds about
  1,500, so the conversation grows by about 1,800 tokens a turn.
- Eight turns to a verdict.

Turn one sends 8,000 input tokens. Turn two sends 9,800. Turn eight sends
20,600. Across the run that adds up to about **114,000 input tokens** and
**2,400 output tokens**.

Now the same alert type handled as a workflow, the way
[the phishing pipeline](/blog/agents-arent-always-the-answer/) works: code
does the lookups, and the model is called twice with a compact summary. Call
it 5,000 input tokens and 500 output per call, so **10,000 input** and
**1,000 output**.

That is about eleven times the input tokens for the agent, on the same alert.

To put a price on it, assume $3 per million input tokens and $15 per million
output. These are illustrative figures, not a quote:

| | Input | Output | Per alert | At 2,000 alerts a day |
|---|---|---|---|---|
| Agent, 8 turns | $0.34 | $0.04 | about $0.38 | about $760 |
| Workflow, 2 calls | $0.03 | $0.015 | about $0.045 | about $90 |

Neither number is alarming for a single alert. The difference at volume is
the whole story, and it is why the decision between an agent and a workflow
is partly a cost decision.

## The levers, in order of impact

**1. Do not use an agent where a workflow will do.** Covered above and in
[its own post](/blog/agents-arent-always-the-answer/). By far the largest
lever, and it also tends to improve reliability.

**2. Make tool results smaller.** In the example, tool results are most of
the growth. A tool that returns a fifteen-line summary instead of five hundred
raw rows shrinks every later turn, because every later turn resends it. This
was the change that saved us the most in practice, and it is also just
[better tool design](/blog/designing-tools-for-security-agents/).

**3. Cache the stable prefix.** The system prompt and tool definitions are
identical on every turn of every run. With prompt caching, you mark that
prefix with `cache_control`, and later requests read it from cache at a
fraction of the normal input price. The first request pays a small premium to
write the cache. In the example, caching the 6,000-token prefix across eight
turns cuts roughly a third off the input cost, more when runs are long.

```python
response = client.messages.create(
    model=MODEL,
    max_tokens=1024,
    system=[{
        "type": "text",
        "text": SYSTEM_PROMPT,
        "cache_control": {"type": "ephemeral"},
    }],
    tools=TOOLS,
    messages=messages,
)
```

**4. Cap the turns.** A turn limit is a safety control first, but it is also
a cost ceiling. Look at the distribution of turns per run. If most runs
finish in five and a few run to the limit of twenty, those few are usually
loops, and they can be most of the bill.

**5. Match the model to the step.** Classifying an alert into one of seven
categories does not need the same model as writing an investigation summary.
In a workflow, each call can use a different model. Measure accuracy on each
step with your evaluation set before switching, not after.

**6. Batch what is not urgent.** Anthropic's Message Batches API processes
requests asynchronously at a discount. Triage is not a batch workload, since
someone is waiting. Nightly summaries, retro-hunts over old alerts and
re-running the evaluation set are.

## Compare it to the right thing

The number leadership eventually asks for is not cost per alert. It is cost
compared to something.

The comparison I use is analyst time on the same work: minutes per alert of
that type, before and after, from the ticketing system rather than from
anyone's impression. If an alert type took twelve analyst minutes to triage
and now takes three to review, the model cost only has to be less than nine
minutes of analyst time to pay for itself, and it usually is by a wide
margin.

Two honest caveats belong next to that comparison. Review time is not zero,
and should not be: a review that takes no time is not a review. And the cost of building and
maintaining the system, including the evaluation runs, is real engineering
time that does not show up in the token bill.

## What I do now

Every new agent or workflow gets a cost line in its design document before it
is built: expected turns, expected tokens per turn, alerts per day, and a
number. Then the first week of production data replaces the estimate with a
measurement.

The estimate is still usually wrong. But it is wrong by a little, now, and in
both directions, which is what an estimate is supposed to be.
