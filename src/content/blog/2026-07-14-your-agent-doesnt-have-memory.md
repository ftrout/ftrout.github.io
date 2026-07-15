---
title: "Your Agent Doesn't Have Memory — You Do"
pubDate: 2026-07-14
description: "The model remembers nothing between calls. Every bit of memory your agent appears to have is something you stored and fed back in — which makes memory a system you build, not a feature you switch on. The four different things people mean by the word, the failure mode hiding in each, and how to decide what's actually worth remembering."
author: "Frank Trout"
---

Someone demos an agent for me and, two turns in, it says *"since you mentioned you're on the finance team, I'll pull the Q3 numbers."* And the room lights up, because it **remembered.** Then the questions start — how long does it remember? Does it remember across sessions? Can we turn memory on for the whole org?

That last one is where I always wince, because it smuggles in an assumption that's just false. There is no switch. **The model is stateless — it remembers nothing between calls, not your name, not the last turn, not that it just tried something and it failed.** Every appearance of memory in that demo is something a human being decided to store and feed back in. Which means the interesting question was never *does it have memory.* It's *what did you put back in front of it, and should you trust it?*

Here's the thesis, and everything else is commentary: **"memory" isn't a model feature you enable; it's a system you build — and mostly it's retrieval and context assembly wearing a friendlier name.** The moment you see that, the mystique burns off and you're left with an ordinary, tractable engineering problem: what to persist, what to look up, what to throw away.

I've written about the [mechanism underneath this before](/blog/the-loop-at-the-heart-of-every-agent) — the loop rebuilds the model's entire world from scratch every single turn, which is *why* nothing survives on its own. I won't re-litigate it here. This post is about the design problem that fact creates.

## The word is doing four jobs

Most memory conversations go badly because two people are using one word for four different things. Untangling them is the single most useful move available, because each one has a different failure mode and a different fix.

| What people call "memory" | What it actually is | Where it lives |
| --- | --- | --- |
| **Conversation history** | The transcript so far, replayed into the prompt each turn | Your app, replayed on every call |
| **Working context** | What's in the window *right now* | A budget, not a store |
| **Long-term memory** | Facts you chose to save and look up later | Retrieval, with a nicer name |
| **State** | The actual truth about the world | Your database — read it live |

**1. Conversation history.** This is the transcript of the exchange so far, and it's the thing that creates the *illusion* of continuity. The agent "remembers" what you said three turns ago because your application kept the transcript and pasted the whole thing back into the **prompt** (the text you send the model) before this turn's call. Nothing was retained. It was *re-sent.* Every turn, the model reads the conversation as if for the first time, because it is.

**2. Working context.** This is what's in the **context window** — the fixed budget of **tokens** (chunks of text, roughly a word-ish each) the model can read on a single call — for *this* turn. People call it memory. It isn't, in any useful sense. It's a budget you're spending, and [spending it well is most of the job](/blog/context-engineering-is-the-job). Calling a budget "memory" is how teams end up believing that a bigger window solves a design problem. It doesn't; it just raises the ceiling on how much you can waste.

**3. Long-term / persistent memory.** Facts you deliberately store — this user prefers terse answers, we decided last month to standardize on Postgres, this customer's account manager is Dana — and then look up when they seem relevant. This is the one that gets the most breathless treatment, and it's the most mundane. **It's retrieval.** You wrote something to a store; later you searched that store and pasted what came back into the prompt. That's the entire trick. Whatever the vendor calls it, if you can't say what got written, what query fetched it, and what got injected, you don't have memory — you have a black box that occasionally says your name.

**4. State.** The real condition of the world: the order status, the ticket's assignee, the account balance, whether the deploy succeeded. This is the one people get wrong most expensively, because it *feels* like memory and it absolutely is not. State lives in your systems of record, and it should be **read live, every time it matters.** The instant you "remember" an order status instead of looking it up, you've made a copy of something that changes without asking you.

If you take one thing from this post, take the refusal to let those four blur together. "Add memory to the agent" is not a task. "Persist the user's tone preference and inject it into the system prompt" is a task. "Read the ticket status from the API on every turn instead of trusting the transcript" is a task. One of those you can build and test; the other is a wish.

## Where each one breaks

Now the failure modes, because each of the four fails in its own particular way, and knowing which one you're staring at is half the debugging.

**History grows forever.** The transcript-replay trick has a nasty property: the thing you're re-sending gets bigger every single turn, and you pay for all of it on every call. Cost climbs turn over turn, latency with it — and this is not the worst part. The worst part is that the important instruction, the one from turn two, is now buried in the middle of forty turns of chatter, [which is exactly where the model's attention is weakest](/blog/the-first-guardrail-is-knowing-the-models-weaknesses). Long conversations don't just get expensive. They get *dumber*, in a specific and predictable way, and the user experiences it as the agent "forgetting" — when in fact you sent it everything and it read past the part that mattered.

**Summarization drops the load-bearing fact.** So you compress: every N turns, you have a model summarize the conversation and replace the transcript with the summary. Reasonable, and often necessary. But summarization is *lossy by definition*, and it's lossy according to the summarizer's judgment about what mattered — which is not your judgment and not the user's. The one constraint the whole task hinges on ("the migration cannot touch the audit tables") reads like an aside and gets cut. Nothing errors. Nothing logs. The agent simply proceeds, fluent and confident, from a world that no longer contains the constraint. Silent lossy compression is one of the meanest bugs in this whole space, because the failure surfaces ten turns later as bad judgment rather than as a missing input.

**Remembered facts rot; live state doesn't.** Here's the one that costs real money. You stored "customer tier: enterprise" in memory in March. It's July. They downgraded in May. The agent retrieves the remembered fact, reasons from it with total confidence, and approves something it shouldn't have — and every downstream step is coherent, which is precisely why nobody catches it. This is [garbage in, garbage out with a delay fuse](/blog/bad-data-bad-ai): the fact wasn't wrong when you wrote it, so it passed every check you had. A remembered fact is a *cached copy with no invalidation strategy.* If you wouldn't ship that cache in an ordinary service, don't ship it because an LLM is reading it.

**Memory as a dumping ground.** The tempting default is "store everything, sort it out at retrieval time." What you get is a store where the signal-to-noise ratio falls a little every day, and a retrieval step that faithfully returns three barely-relevant fragments because *something* had to score highest. Now you're paying tokens to actively confuse the model. Indiscriminate storage isn't thoroughness; it's deferred cost with interest.

**Confusing state with memory.** The compound error: treating #4 as #3. Never "remember" something you can look up authoritatively. If there's a system of record, read it — live, every time, at the moment of decision. Memory is for things with no authoritative source: preferences, past decisions, the texture of a working relationship. It is not a substitute for a database query, and every time it gets used as one, you've built a cache that lies.

## How I actually decide what to remember

Five habits. None are clever; all of them are the difference between a memory system and a pile of stored strings.

- **Decide what's worth remembering.** Memory is a *product decision*, not a feature toggle. Somebody has to answer: what would materially improve the next conversation if we knew it? Usually that's a short list — a handful of stable preferences, a few durable decisions — and the honest answer is that most of what a user says is worth nothing tomorrow. Start from "remember nothing" and earn each addition.
- **Prefer reading live state over remembering it.** The default is a tool call, not a memory write. If there's a system of record, the agent should ask it — [the model has no reach on its own](/blog/the-llm-is-not-a-function-call), so give it the reach instead of giving it a stale snapshot. Remembering is what you do when there's nothing to ask.
- **Give remembered facts provenance and freshness.** Every stored fact should carry where it came from, when it was written, and — where it makes sense — when it expires. "User prefers Python (stated 2026-03-04)" is a fact you can reason about and age out. "User prefers Python" is a rumor. This is the same discipline you'd apply to any data feeding any system; the model just makes it easier to forget you needed it.
- **Compress deliberately, and know what you dropped.** If you summarize, don't let a generic "summarize this" decide what survives. Tell it what must be preserved — constraints, decisions, identifiers — and keep those pinned outside the summary where they can't be smoothed away. Structured extraction into fields you control beats freeform prose you hope is complete.
- **Forget on purpose.** Pruning is a feature, not a cleanup chore you'll get to later. Expire things. Delete things. Cap the history and be explicit about the cap. A memory store nobody prunes becomes a liability with a retention-policy problem attached — and if any of it is personal data, "we kept everything forever because it was easier" is a sentence you'll have to say out loud to someone whose job is compliance.

## The reframe

There's no memory in the model. There's your retrieval and your context assembly, and together they produce something that *looks* like memory from the outside — the same way [most of the AI vocabulary](/blog/ai-jargon-in-plain-english) names an ordinary mechanism in a way that makes it sound like magic. "The agent remembered" is a description of a user experience. The engineering underneath is: we stored a thing, we searched for it, we pasted it into a prompt, and the model read it fresh, as it reads everything, for the first time.

That's not a letdown. It's leverage. A capability the model has is something you can only hope for. A system you built is something you can inspect, test, version, and fix. You can ask what's in the store. You can ask when it was written. You can ask whether the retrieval step actually surfaced the right thing, or whether it buried the answer in the middle of a transcript nobody needed. Every one of those is a question with an answer, and none of them exist if you believe memory is a switch someone flipped.

So retire the question. "Does it have memory?" has no useful answer — the model doesn't, you do, and the interesting part was always yours. Ask the version that pays: *what am I choosing to put back in front of it this turn, where did that come from, and can I still trust it?* Answer that honestly and you'll find you weren't building memory at all. You were building retrieval, and freshness, and a budget — the unglamorous things that were going to decide whether the thing worked anyway.
