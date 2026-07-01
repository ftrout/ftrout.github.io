---
title: "Your Agent's Tools Are a UI — and the User Is a Model"
pubDate: 2026-07-02
description: "When you give an agent a tool, you're not wrapping an API — you're designing a user interface whose user happens to be a language model. The name, the description, the parameters, and what it returns are read on every single decision, and a sloppy one degrades all of them. A field guide to the most undervalued surface in agent design."
author: "Frank Trout"
---

Most teams treat an agent's tools as backend plumbing: wrap the API, expose the function, move on. It's the part of the system that feels like engineering-as-usual, so it gets engineering-as-usual care — a quick name, a one-line description, whatever parameters the underlying API happened to have. Then the agent misuses the tool, and everyone blames the model.

The model is rarely the problem. Here's the reframe that fixes more agent bugs than any prompt tweak: **a tool is not plumbing, it's an interface — and its user is the model.** Every name you choose, every description you write, every parameter you expose, and every result you hand back is UX. It's just UX for a reader that thinks in tokens (the chunks of text a language model reads and writes) instead of pixels. You are designing a user interface. You've just never met the user.

This post is about taking that seriously — because the tool surface is the single most undervalued lever in agent design, and it's undervalued precisely because it looks like something you already know how to do.

## Why a bad tool spec is worse than a one-time bug

Start with a fact from [how an agent's loop actually works](/blog/the-loop-at-the-heart-of-every-agent): the definitions of the tools available to the agent sit in the context — the working memory — that the model re-reads *on every single turn*. An **agent**, remember, is a language model running in a loop, deciding each step as it goes. And on each of those steps, it re-reads what its tools are and what they do, to decide whether and how to use them.

This changes the economics of a sloppy tool description entirely. In normal software, a bad function name is a readability nuisance — a human reads it once, grumbles, and moves on. In an agent, a vague tool description isn't read once. It's read on turn one, turn two, turn nine — every decision the agent makes about that tool, for the entire task, is made while reading your fuzzy sentence. A bad description doesn't cause *a* mistake. It quietly degrades *every* decision involving that tool. That's why investing in the tool interface pays off so disproportionately: you're not improving one call, you're improving every iteration of the loop.

## What the model actually sees (all of it is interface)

When you expose a tool, the model doesn't see your code. It sees a small bundle of text, and that bundle is the *entire* interface. Four parts, all of them load-bearing:

**The name.** The first and cheapest signal. `get_order_status` tells the model what the tool is for; `handler2` tells it nothing and invites misuse. Names also need to be *distinct* — if two tools have names that sound like they overlap, the model has to guess which you meant, and it will sometimes guess wrong on turns where it matters.

**The description.** This is the contract, and it's where most of the value lives. A good description says what the tool does, *when to use it*, *when not to*, and any preconditions — "Look up an order by ID. Use this when the customer references a specific order. Requires a valid order ID; does not search by customer name." That last clause prevents an entire category of misuse. A vague description ("gets order info") leaves the model to infer all of that, and inference is where hallucination lives.

**The parameters.** The inputs the model has to fill in — and every one is a chance to constrain or to confuse. Good parameter names (`order_id`, not `x`), tight types, and — the highest-leverage move here — *shrinking the space of what's fillable*. A parameter that accepts one of five fixed values (an **enum**, a fixed menu of allowed options) is one the model literally cannot hallucinate a sixth value for. A free-text parameter where an enum belonged is an open invitation to invent. Mark what's required, make optionals genuinely optional, and give an example when the format is non-obvious.

**The return value.** The part everyone forgets is interface at all — and it's half of it. Whatever the tool hands back becomes the model's next observation, the [ground truth](/blog/the-loop-at-the-heart-of-every-agent) it reasons from on the following turn. A result that's clean, structured, and interpretable lets the loop self-correct. A result that's a wall of raw JSON, or worse, a misleading "success" wrapping an empty payload, gets confidently built upon. You are not just accepting input from the model; you are *speaking back to it*, and what you say shapes everything it does next.

## Errors are interface too — maybe the most important part

Here's the piece that separates tools that work in production from tools that look fine in a demo: **an error message is a message to the model, and you should write it like one.**

When a tool fails, the naive move is to let the raw exception bubble up — a stack trace, a `KeyError`, an HTTP 422 with no context. The model reads that, understands nothing actionable, and either gives up or flails. But an agent loop has a superpower ordinary code doesn't: if you tell it *what went wrong and what to do instead*, it can recover on the very next turn. "Error: no order found with ID 'ABC'. Order IDs are numeric — ask the customer to re-check the number" is not an error in the traditional sense. It's a course correction, handed to a reader who will act on it immediately.

This is the difference between a tool that returns honest, interpretable failures — and lets the loop repair itself — and one that returns a cryptic error the model can only trust or ignore. Since [an early bad observation becomes trusted context that every later step compounds](/blog/why-agents-make-things-up), the quality of your error messages is directly the quality of your agent's resilience. Design them on purpose.

## Fewer, sharper tools beat more tools

There's a reflex to give the agent *everything* — thirty tools, maximum coverage, surely more capability. It backfires, for the same reason a UI with thirty buttons is worse than one with five: choosing well requires attention, and every extra option taxes it. A model staring at thirty overlapping tools spends its reasoning deciding *which* to use — and picks wrong more often — instead of spending it on the actual task.

[Ten well-described tools beat thirty vague ones](/blog/simplest-agent-that-could-possibly-work). Prune aggressively. Collapse near-duplicates into one tool with a parameter. Remove the tools the agent never correctly reaches for. And prefer, always, the [dumbest tool that does the job](/blog/when-not-to-build-an-agent) — a deterministic lookup the model can't misuse beats a flexible one it can. Toolset design is curation, not accumulation.

## You can measure this — so measure it

None of this has to be taste and vibes. The whole point of [an eval harness](/blog/you-cant-improve-what-you-cant-measure) is to turn "this description feels clearer" into a number. Tool use is one of the most measurable things in an agent: for a set of representative tasks, did the model pick the *right* tool, with the *right* arguments? Score that. Rewrite a confusing description, rerun the eval, and watch whether tool-selection accuracy actually moved. If you're tuning tool specs by rereading traces and squinting, you're guessing. The interface is testable; test it.

## The failure modes, named

Most "the agent is dumb" complaints trace back to a specific interface flaw:

| Symptom | The interface flaw underneath |
| --- | --- |
| Agent calls the wrong tool | Two names/descriptions overlap; the boundary between them isn't crisp |
| Agent invents an argument value | A free-text parameter where a fixed set of options belonged |
| Agent misuses a tool the same way every run | A vague description, re-read and misread on every turn |
| Agent gives up after a tool fails | A cryptic error it couldn't act on, instead of a recoverable one |
| Agent dithers between tools, burning calls | Too many overlapping tools; the choice itself is the bottleneck |
| Agent confidently builds on a bad result | A return value that hid its own emptiness behind a "success" |

Notice that *none* of these are fixed by a smarter model. They're fixed by rewriting the interface the model was handed.

## The reframe

Stop thinking of a tool as a function you're exposing and start thinking of it as documentation you're writing for a reader who will act on it instantly, can't ask you a clarifying question, and re-reads it every time it moves. That reader is fast, capable, and utterly literal — it will do exactly what your interface implies, including the parts you didn't mean to imply. Every ambiguity you leave, it will eventually walk into.

So give the tool a name that says what it does, a description that says when to use it and when not to, parameters that make the wrong value hard to express, results that speak plainly, and errors that teach it how to recover. Then keep the set small enough that choosing is easy. Do that, and a surprising amount of "we need a better model" quietly turns into "oh, the model was doing exactly what we told it to." The agent-facing interface was the product all along. You were just building it for a user you never pictured.
