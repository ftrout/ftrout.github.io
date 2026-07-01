---
title: "When Not to Build an Agent: The Most Reliable Agent Is Often No Agent"
pubDate: 2026-07-01
description: "Agent is the exciting word, so everything gets built as one. But an agent is the most powerful, least predictable, most expensive tool on the shelf — and most tasks that get built as agents should have been plain code, a single model call, or a fixed workflow. A field guide to reaching for the loop last."
author: "Frank Trout"
---

"Agent" is the word everyone wants to say. It's on the roadmap, in the standup, on the slide. So the default has quietly inverted: instead of asking *whether* a task needs an agent, teams start by assuming it does and work backward. The result is a lot of slow, expensive, hard-to-debug systems doing jobs that a hundred lines of ordinary code would have done faster, cheaper, and correctly every single time.

I wrote the optimistic version of this argument in [The Simplest Agent That Could Possibly Work](/blog/simplest-agent-that-could-possibly-work) — earn each layer of complexity, reach for the cheapest thing that closes the gap. This is the same argument pointed one level up, at the decision most people skip entirely: **should this be an agent at all?** And the uncomfortable answer, more often than the hype admits, is no. The most reliable agent is frequently the one you didn't build.

## What an agent actually is (and why that one property costs so much)

Strip away the branding and an **agent** is a language model — the AI behind tools like ChatGPT and Claude — running in a loop where *it* decides what to do next. It reads the situation, picks an action (usually calling a **tool** — a bit of code that lets it look something up or act on the world), sees the result, and decides again, looping until it judges the task done. I took this apart in detail in [The Loop at the Heart of Every Agent](/blog/the-loop-at-the-heart-of-every-agent).

The defining property — the thing that makes an agent an agent — is that **the model controls its own control flow.** *Control flow* is just the order in which steps happen. In normal software, you write that order; in an agent, the model decides it at runtime. That single property is the source of all the power *and* all the pain. It's what lets an agent handle open-ended tasks you couldn't script in advance — and it's also what makes it [non-deterministic](/blog/the-llm-is-not-a-function-call) (it can make different choices on identical input), expensive (every trip around the loop is a full model call), and hard to operate (you can't predict the path, so you can't fully predict the behavior).

You don't want that property for free. You want it *only when the task actually requires it* — because when it doesn't, you've paid the entire cost and bought nothing.

## The one question that settles it

Here's the test that decides more cases than any other:

> **Can you write the steps in advance? If yes, you don't need an agent.**

An agent earns its keep exactly when the sequence of actions is *unknowable at design time* — when what to do next genuinely depends on results you can't see until you're running. If you can sit down and write out the steps — even branching ones, even ones with conditions — then you don't have an open-ended problem. You have a *known procedure*, and a known procedure should be code, not a model improvising its way through a maze it doesn't need.

Most tasks fail this test in the agent's favor only because nobody asked the question. So let's ask it, against the three things an agent is usually built instead of.

## Alternative 1: plain, boring, deterministic code

If the input is already structured — IDs, numbers, categories — and the logic is a fixed rule, there is nothing for a model to add except latency, cost, and the chance of making something up. Looking up an order status, applying a discount, validating a form, routing by a known field: these have exactly one correct output for any input. A model here is strictly worse than an `if` statement, because it's a slower, pricier `if` statement that occasionally hallucinates.

This sounds obvious, and teams violate it constantly — usually because the *output* is text for a human, and "text" pattern-matches to "LLM." But a template is text too, and a template is free and deterministic. Don't reach for a model just because the result is a sentence. Reach for it only when the *mapping itself* can't be written as rules.

## Alternative 2: a single model call

Sometimes rules genuinely can't capture the task — you need to understand messy free-text, or generate natural phrasing. That's a real job for a language model. But needing *a model* is not the same as needing *an agent*. If the shape of the work is fixed — you know you'll make exactly one call — then make one call and stop.

Classifying a support message into one of five categories. Extracting fields from an email. Summarizing a document. Drafting a reply from a set of facts. These are fuzzy in or fuzzy out, but the number of steps is known and equal to one. Wrapping that in an agent — giving it tools and a loop it doesn't need — is just a more expensive, less predictable way to make the same single call. There's no control flow to hand over, because there's only one step. Handing it over anyway is pure overhead.

## Alternative 3: a fixed workflow

This is the one that trips up the most sophisticated teams, because it *feels* like agent territory. You have multiple steps, multiple model calls, real logic between them — surely that's an agent?

Only if the model needs to *choose* the steps. If you already know the sequence — extract, then validate, then summarize, then file — that's a **workflow**: a fixed, ordered chain of steps that you wrote, some of which happen to be model calls. The steps are pinned down in your code, not decided by the model at runtime. Workflows give you everything teams actually want from these systems and rarely get from agents: predictability, a path you can audit, the ability to put a human approval or a business rule at a specific gate, and a failure you can locate because you know exactly which step ran.

The rule of thumb: **if you ever catch yourself able to draw the flowchart, you wanted a workflow, not an agent.** An agent is what you use precisely when you *can't* draw the flowchart ahead of time.

## What you're actually paying for when you choose an agent

Reaching for the loop isn't neutral. The moment you hand control flow to the model, you take on a specific tax — and it's worth naming so you only pay it on purpose:

- **Non-determinism.** The same input can take a different path and produce a different result. Your testing discipline built on "same input, same output" stops applying, and you're now in the world of [evals and measured quality](/blog/you-cant-improve-what-you-cant-measure) instead of exact assertions.
- **Cost that scales with steps.** Every loop iteration is a full model call that re-reads everything before it. A ten-step agent isn't ten times a one-call task — it's more, because the context grows each turn. A chatty agent is a quadratic bill.
- **Compounding errors.** A reasonable-looking mistake early in the loop becomes trusted context for every step after it. Chain enough steps and reliability decays fast — [five steps each 95% reliable land you around 77% overall](/blog/the-loop-at-the-heart-of-every-agent).
- **Runaway loops.** An agent with no progress and no guard will happily call the same tool ten times or ping-pong forever. You have to bound it, and bounds are a thing that can be wrong.
- **Irreversible actions.** The scariest tax. An agent that can issue a refund, delete a record, or send an email can do those things *by mistake*, confidently, in a way you didn't foresee — because you didn't write the path that got it there.

None of this means agents are bad. It means agents are *costly*, and cost is only worth paying for capability you actually use.

## The signs you're forcing one

You can usually feel it before you can prove it. A few tells that you've reached for an agent where a simpler tier belonged:

| Symptom | What it usually means |
| --- | --- |
| Your agent reliably takes the same path every time | The steps were knowable — this is a workflow wearing a loop |
| It has exactly one tool, or always calls tools in the same order | There's no real decision to make; you needed a call or a chain |
| You've written elaborate prompt rules to *stop* it from wandering | You're fighting the control flow you gave away — take it back |
| Most of your bugs are "it did something weird on step 3" | You bought non-determinism you didn't need |
| You can draw the flowchart on a whiteboard in two minutes | You wanted a workflow |

Every one of these is the system telling you it wanted less autonomy than you gave it.

## When it genuinely *is* an agent

The mirror has to be honest: there are real agent-shaped problems, and for those, nothing simpler will do. Reach for the agent when *all* of these hold:

- **The steps are unknown at design time** — you truly can't script the sequence, because it depends on what's discovered along the way.
- **Each move depends on the results of the last** — the path forks on live information, not on conditions you could have enumerated.
- **It needs real tools and side effects** — it has to reach into the world, act, observe, and adapt.
- **The task is open-ended** — "research this," "resolve this messy situation," "figure out why this broke" — genuinely varied inputs with no fixed recipe.

Customer says "my order's two weeks late and I want my money back — sort it out": maybe that's a lookup, maybe a lookup then a refund, maybe an escalation, and you can't know which until you're in it. *That's* an agent. The autonomy isn't overhead there — it's the whole point.

For a concrete, side-by-side version of all of this, I put a [runnable three-tier example on GitHub](https://github.com/ftrout/ftrout.github.io/blob/main/examples/three-tier-support/support_tiers.py): the same support task built as plain code, a single model call, and a full agent — with a router that sends each request to the cheapest tier that can actually handle it. Seeing the three next to each other makes the boundaries obvious in a way prose can't.

## The decision, in order

When a task lands on your desk, walk *down* the tiers and stop at the first one that can do the job:

1. **Is the input structured and the rule fixed?** → Plain code. No model.
2. **Does it need language understanding or generation, but in one known step?** → A single model call.
3. **Are there multiple steps, but you know them in advance?** → A workflow — a fixed chain.
4. **Are the steps genuinely unknowable until runtime, depending on live results?** → *Now* build an agent.

The whole discipline is refusing to skip straight to step 4 because it's the exciting one. Nearly everything that gets built as an agent lives at step 1, 2, or 3 — and runs better once it's moved there.

## The reframe

Building an agent should feel like reaching for the most powerful tool in the shop: something you do deliberately, last, and only when the simpler tools have genuinely run out — not the thing you grab by reflex because it's the one with your name on it this quarter. Autonomy is a cost you pay for a capability, and if you're not using the capability, you're just paying the cost.

So the next time "let's make it an agent" comes up, ask the boring question first: *can we write the steps down?* If you can, write them down — in code, in a chain, in anything you can predict and audit and trust. Save the loop for the problems that actually need a mind of their own. The best engineers I know aren't the ones building the most agents — [that was never the scoreboard](/blog/most-agents-dont-win) — they're the ones who can tell you, for any task, exactly why it did or didn't need one. Usually, it didn't.
