---
title: "What an AI Feature Actually Costs"
pubDate: 2026-08-15
description: "Everyone prices the model and nobody prices the system. But the per-token rate is the least interesting number in your bill — cost in an AI system is an architectural property, set by decisions you made months before the invoice arrived. Where the money actually goes, the six levers that move it, and why your bill has a probabilistic component."
author: "Frank Trout"
---

The cost conversation in most AI projects happens exactly once, in a spreadsheet, before anything is built. Someone looks up the per-million-token price of two models, multiplies by an estimate of daily volume, and produces a number that gets pasted into a slide. Then the thing ships and the bill arrives and it isn't that number, and nobody can say precisely why.

The reason is that the spreadsheet priced the *model* and the invoice priced the *system*. Those differ by an order of magnitude in either direction, and the gap is made of architecture. **What an AI feature costs is not a rate you look up — it's a property of decisions you made months earlier: how many times you call the model, how much you re-send on every call, how many retries and checks and subagents sit in the path, and whether anything bounds your worst case.** The per-token price is real, and it's the least interesting variable in the equation.

I've invoked cost as a decision axis in nearly everything I've written here — [a chatty agent is a quadratic bill](/blog/the-llm-is-not-a-function-call), [agentic retrieval is token-billed](/blog/agentic-vs-boring-retrieval), [multi-agent multiplies calls](/blog/multi-agent-when-its-actually-worth-it) — and never given it a post of its own. This is that post.

## Where the money actually goes

Five multipliers sit between the sticker price and the invoice. None of them are exotic, and all of them compound.

**The loop.** This is the big one and it surprises people every time. An agent doesn't make one call; it makes one call *per step*, and [each step re-reads everything before it](/blog/the-loop-at-the-heart-of-every-agent). Step one sends 2,000 tokens. Step eight sends 2,000 plus every tool result and every intermediate decision accumulated since. A ten-step task isn't ten times a one-step task — it's meaningfully more, because the payload grows as you go. Doubling the number of steps considerably more than doubles the cost, which is why "the agent took fifteen tool calls to do what five would" is a budget event and not just a latency complaint.

**Verification and retries.** Every quality layer you add — a checking pass, a second opinion, a judge scoring the output, a retry on invalid JSON — is another call against the same context. These are usually worth it, and I recommend most of them. But they're rarely in the estimate, and "we added a verification step" can quietly mean "we doubled the per-request cost of this path."

**Context nobody needed.** You pay for every token you send, on every turn, whether the model used it or not. Forty connected tools means forty tool definitions billed on each pass [before the model has thought about your problem at all](/blog/mcp-the-good-the-bad-and-the-ugly). A conversation replayed in full since turn one means you're paying for turn three's chatter on turn forty. This is the [context budget](/blog/context-engineering-is-the-job) showing up as a line item — it was always a cost question and not only a quality one.

**Fan-out.** Subagents each run their own loop, with their own context, and a parent that spawns four of them is running five agents. Delegation is often the right call — it's [how you keep the mess out of the main window](/blog/multi-agent-when-its-actually-worth-it) — but the accounting is multiplicative, and modern models delegate more readily than the models most cost models were built against.

**Humans.** The most expensive tokens in your system are the ones a person reads. An approval queue is a real operating cost, and [most of them are not buying the control people think they are](/blog/a-human-in-the-loop-is-not-a-control). If a gate costs three minutes of a specialist's time per item at volume, that's frequently the largest single number in the whole feature, and it's the one that never appears in the AI budget because it's booked as headcount.

## The unit that matters: cost per resolved task

Here's the measurement error underneath most AI cost analysis. Teams track cost per token or cost per call, and both are misleading, because neither one knows whether anything got *accomplished*.

The number to track is **cost per resolved task** — total spend, including retries, verification, subagents, and escalation, divided by tasks that actually reached a correct outcome. It reorders your conclusions immediately. A cheap model that needs three attempts and escalates one in five to a human is more expensive than an expensive model that gets it right the first time — dramatically more, once you price the escalation. Per-token, it looked like a bargain. Per resolved task, it never was.

This is also the number that makes quality and cost commensurable, which is the whole point. [When I compared two prompt versions](/blog/the-prompt-still-matters), the comparison table put accuracy and cost-per-thousand-requests side by side deliberately: a prompt that scores two points higher on tone and costs 3× per call is a business decision, and you can only make it if both numbers are in the same table.

```python
# Instrument once, at the boundary of a task — not per call.
def record(task_id: str, resolved: bool, usage_events: list, human_minutes: float = 0.0):
    tokens_in  = sum(u.input_tokens for u in usage_events)
    tokens_out = sum(u.output_tokens for u in usage_events)
    model_cost = (tokens_in * PRICE_IN + tokens_out * PRICE_OUT) / 1_000_000
    return {
        "task_id": task_id,
        "resolved": resolved,
        "calls": len(usage_events),          # the loop multiplier, visible
        "model_cost_usd": model_cost,
        "human_cost_usd": human_minutes * LOADED_RATE_PER_MINUTE,
        "total_usd": model_cost + human_minutes * LOADED_RATE_PER_MINUTE,
    }
```

Two things that fall out of logging it this way and are worth the trouble on their own: `calls` per task is the single best early warning that an agent is wandering, and putting `human_cost_usd` in the same record as the model cost is usually the moment someone realizes which half of the bill they've been optimizing.

## The six levers, in order of leverage

Roughly ordered by how much they move the number per unit of effort.

**1. Don't call the model.** The only free lever, and the one people skip because it isn't interesting. A structured input with a fixed rule is code, not inference; a known sequence is a workflow, not an agent. [Every rung you descend on the ladder charges you in cost](/blog/when-not-to-build-an-agent), so the cheapest AI feature remains the one where a well-placed function call did the job. Nothing else on this list saves you what not calling the model saves you.

**2. Cut the context before you cut the model.** Teams reach for a cheaper model first because it's a one-line change, and it usually costs them quality. Trimming what you send is nearly always the better first move: prune stale tool results, summarize old history, drop the tools this task can't use, stop stuffing the knowledge base in "just in case." You're paying for every one of those tokens on every turn, and [past the point of relevance more context is actively making the output worse](/blog/context-engineering-is-the-job). This is the rare lever that improves quality and cost at the same time.

**3. Cache the stable prefix.** Prompt caching bills you far less for content the provider has already processed, and for a system with a large fixed system prompt or tool set, it's the highest-yield change you can make in an afternoon. The rule that decides whether it works: **caching is a prefix match, so any byte that changes early invalidates everything after it.** Put the stable material first — frozen instructions, a deterministic tool list — and everything volatile last. A timestamp, a request ID, or a `datetime.now()` at the top of your system prompt silently destroys your hit rate while looking completely harmless, so verify with the cache-read numbers in the API's usage response rather than assuming.

**4. Tier the model.** Route the easy majority to a small fast model and reserve the expensive one for the work that needs it. [The three-tier example](https://github.com/ftrout/ftrout.github.io/tree/main/examples/three-tier-support) is this idea made literal — a router sending each request to the cheapest tier that can handle it — and the same instinct applies inside an agent: a cheap model for the reading-heavy subagents, a capable one for the judgment. Note the sequencing, though: tiering *after* you have [an eval harness](/blog/you-cant-improve-what-you-cant-measure) is an optimization, and tiering before you have one is a guess with a cost story attached.

**5. Batch what isn't interactive.** Anything that doesn't need an answer this second — nightly evals, backfills, bulk classification, large judging passes — can run through a batch API at roughly half price. Very little effort, no quality tradeoff, and it usually applies to more of your workload than you'd guess.

**6. Bound the worst case.** Max turns. Max budget per run. A cap on retries. These barely move your *average* cost, which is why they get skipped, and they're the difference between a bad week and a bad quarter. Which brings me to the part that makes AI cost genuinely different.

## Your bill has a probabilistic component

In ordinary software, cost is a function of traffic. You can capacity-plan because the relationship between requests and spend is fixed by code you wrote.

In an agentic system, the model decides how much work to do. It chooses how many steps to take, how many tools to call, how many subagents to spawn, how much to read. Which means **your spend is partly a function of a probabilistic component's judgment on any given input** — the same property that makes [agentic retrieval's cost depend on how ambitious the model feels about a question](/blog/agentic-vs-boring-retrieval). Two identical requests can cost different amounts. A weird input can cost fifty times the median.

The consequence for how you plan: **an average is not a budget.** You need the distribution and a hard stop. Track p95 and p99 cost per task, not the mean — the mean hides exactly the runaway that will hurt you. Alert on the tail rather than the total, because the total moves too slowly to catch a loop that's spinning right now. And set a per-run ceiling that terminates rather than warns, since a warning at 3 a.m. is a notification, not a control. The runaway loop is the AI-native version of the infinite loop in a billed system, and everyone who's been surprised by an AI invoice was surprised by the tail, never by the average.

## The checklist

1. **Measure cost per resolved task**, not per token — including retries, verification, subagents, and human minutes.
2. **Log `calls` per task.** It's your earliest signal that something is wandering.
3. **Descend the tier ladder deliberately.** The cheapest call is the one you didn't make.
4. **Trim context before swapping models.** It's the lever that helps quality too.
5. **Cache the stable prefix, and verify the hit rate.** Assume nothing; a timestamp can silently undo it.
6. **Batch everything that isn't interactive.** Half price for near-zero effort.
7. **Bound the worst case with a hard ceiling**, and alert on p99, not the mean.
8. **Put cost in the eval table** next to quality, so the tradeoff is a decision rather than a discovery.

## The reframe

Stop asking what the model costs. The model has a published price and it's the same one your competitors pay, which is a strong hint that it isn't where your advantage or your problem lives. Ask instead what your *system* spends: how many calls it makes to resolve one real task, how much it re-sends each time, how much of what it sends was never needed, how many humans it interrupts, and what happens on the day an input sends it around the loop forty times instead of four.

Every one of those is an architectural decision, and every one of them was made long before anyone opened the billing console. That's the good news, actually — it means cost is engineerable rather than merely negotiable. The teams that get surprised by an AI bill aren't the ones who picked the pricier model. They're the ones who never counted the calls.
