---
title: "How the LLM Reshapes Your Architecture"
pubDate: 2026-06-29
description: "New to building with AI? An LLM isn't a normal piece of code you plug in. It's unpredictable, forgetful, costly, slow, and sometimes confidently wrong — and each of those traits forces a design decision somewhere else in your app. A beginner-friendly tour of why a model doesn't just sit inside your architecture; it reshapes it."
author: "Frank Trout"
---

*A note for newcomers: an **LLM** — large language model — is the AI behind tools like ChatGPT and Claude. You send it some text (a "prompt") and it sends text back. "Architecture" just means how the pieces of your application fit together. This post is about how adding an LLM to an app quietly changes the shape of everything else, and I'll explain each term as it comes up.*

Every piece of software you've ever built with behaves itself. A **function** — a small block of code you call to get a result — returns the same answer every time you give it the same input. A **database** remembers what you told it. Calling a bit of code costs effectively nothing and finishes faster than you can blink. You don't *design around* these properties — you assume them, so completely that you've forgotten they're assumptions. They're the solid ground the rest of your app stands on without anyone noticing the ground is there.

Then you add an LLM, and the ground turns to water.

Here's the thing people miss when they say "we'll just call the model here": **the LLM isn't an ordinary piece of code you plug in. It's a component with a strange and specific set of properties, and every one of those properties pushes outward and forces a decision somewhere else in the system.** It gives different answers to the same question where normal code is predictable. It forgets where your systems remember. It costs real money per use where ordinary code is free, takes seconds where code is instant, and — uniquely — it can be confidently, fluently *wrong* in a way no normal program ever is. You can't wall that off. The model sits in the middle of your app and bends everything around it.

This post is a tour of those properties, and the design pressure each one creates. Because the gap between an LLM *demo* and an LLM *product* is almost entirely the work of absorbing these pressures on purpose, instead of getting blindsided by them once real users show up.

## The assumption stack you didn't know you had

Before the model, every normal piece of software came with five free guarantees, and your app is quietly built on all of them:

- **Predictability** — same input, same output, every time. This is what makes testing and debugging possible at all.
- **Memory** — what you store stays stored. The thing you wrote down stays written down.
- **Knowledge on tap** — your code knows whatever you put into it, and it's up to date the moment you ship.
- **Near-zero cost and instant speed** — calling a bit of code is effectively free and effectively instant.
- **Honest failure** — when something breaks, it crashes or returns an error. It *tells you* it failed.

The LLM breaks *all five.* Not as a bug to be patched — as a basic property of what it is. And once you see that, a huge amount of "AI architecture" stops looking like a grab-bag of buzzwords and starts looking like what it actually is: scaffolding built to make up, one by one, for the guarantees you no longer get.

Let's go through them.

## It's unpredictable: you can't test by "is the answer exactly X?"

Ask the model the very same question twice and you can get two different answers. There's a setting called *temperature* — think of it as a randomness dial — and turning it down makes the answers more consistent, but it never makes them *guaranteed* identical. You get a tendency, not a promise. For something sitting in the middle of your app, that's a deep change, not a quirk.

Start with testing. Normally you test code by checking "does the output exactly equal what I expected?" That check is now meaningless against a model — the "right" answer is a whole *range* of acceptable replies, not one exact string. So the app grows a new part: an **evaluation harness** (usually just called *evals*) — a set of checks that score the model's output on qualities (did it stay on topic? did it base its answer on the right source? did it use the right tool correctly?) instead of demanding one exact response. If you've built an AI feature you actually trust, you didn't get there with traditional tests. You got there with evals, and the need for them comes straight from the model's unpredictability.

It ripples further. *Caching* — saving a previous answer so you can reuse it instead of asking again — gets unreliable when the answer can change. Reproducing a bug means saving the exact prompt *and* accepting you might not trigger the bug on the first retry. And anything later in your app that expected a rigid format — "this value is always one of these three options" — now needs **structured output**: asking the model to reply in a strict, machine-readable shape (like a filled-in form), plus a check that it actually did. That's how you force the unpredictable thing back into the tidy shape the rest of your code depends on. Unpredictability doesn't stay inside the model. It leaks into your testing, your caching, and every place the model's output hands off to normal code.

## It has no memory — and it can only read so much at once

The model remembers nothing between requests. Each time you call it, it starts from a blank slate. The illusion of memory — the chatbot that "knows" what you said three messages ago — is created entirely by *you* pasting the earlier conversation back into the prompt on every single call. I wrote a whole post on how [an agent fakes a running memory by re-reading the whole conversation each turn](/blog/the-loop-at-the-heart-of-every-agent); this is the same fact seen from the design level. **The model has no memory, so remembering becomes your job — and that job becomes a whole part of the system.**

There's a second limit stacked on top: the **context window** — the maximum amount of text the model can read in one go. (You'll sometimes see it measured in *tokens*; a token is just a chunk of text, roughly a word or part of one.) Everything you want the model to consider on a given call has to fit inside that window.

Put those two limits together and you get a subsystem most newcomers underestimate. The conversation so far has to be saved somewhere and fed back in. And anything the model needs to "know" that won't fit in the window — your documents, your data, the user's past activity — has to be stored, searched, and slipped into the prompt at the right moment. That pattern of "look up the relevant facts and paste them in before answering" is called **RAG** (retrieval-augmented generation), and that's all it really is: a memory aid bolted onto a component that can't remember on its own. (It's also where [the quality of the data you feed in starts to cap how good your system can be](/blog/bad-data-bad-ai).)

And because the window is limited, you now have a budgeting problem that barely exists in normal software. Everything competes for the same scarce space: your instructions to the model, the descriptions of any tools it can use, the looked-up facts, the conversation history, and the actual task. When it all won't fit, *you* have to decide — deliberately, in code — what to summarize, what to drop, and what to keep. Managing what goes in that window isn't a nice-to-have you add later. It's a core part of the design, because the limit is built into the model itself.

## Its knowledge is frozen and fuzzy — so the app has to reach outward

The model learned everything it knows during *training*, which happened at some fixed point in the past. Its knowledge is a snapshot frozen on that date — it doesn't know today's prices, your company's internal policies, or what happened last week. And even the things it did learn, it remembers fuzzily: the precise details — exact numbers, names, dates — are exactly where it's most likely to be a little off or simply make something up.

Normal code, you'd just *update* when the facts change. You can't reach into the model's head and update it, so the app instead grows ways to fetch the truth from outside the model whenever it needs something current, private, or exact. **Retrieval** (the RAG idea from the last section) pulls facts out of your own documents and databases. **Tools** let the model call out to live systems — checking the current stock count, looking up a real order's status, running an actual calculation instead of guessing the result. This is the big shift behind "AI agents": moving from "ask the model and hope it knows" to "give the model a way to *look it up*." It exists precisely because the model's built-in knowledge is out of date and approximate by nature.

This is also where the model's quirks start *stacking up* with the rest of your app. The moment you rely on retrieval, the limit on how good your system can be stops being the model and [becomes the quality of the data you feed it](/blog/bad-data-bad-ai). A frozen-knowledge model forces you to build retrieval; retrieval makes *you* responsible for keeping that data fresh, trustworthy, and correct. One quirk of the model ends up reshaping how you handle your data, too.

## It can be confidently wrong — so you have to check its work

This is the property with no equivalent in normal software, and the one that changes the most. Every other piece of software fails *honestly*. A database that can't find something returns nothing. Code given bad input crashes with an error. They announce that they failed. The model does the opposite: when it doesn't actually know, its most natural output is often a smooth, well-written, completely confident answer that happens to be fiction. (The industry word for this is a *hallucination*.) [It sounds exactly as sure when it's guessing as when it's right](/blog/why-agents-make-things-up) — and that gap between how confident it sounds and whether it's actually correct is the whole problem. You can't fix it just by telling the model "don't make things up," because it's baked into how the model works: it's built to produce text that *sounds* likely, not text it has verified is true.

For you as the builder, this kills a deep assumption: *that you can trust an output because nothing errored.* You can't. A confident model reply tells you nothing about whether it's correct. So the app has to add, from the outside, the trust the model can't provide from the inside:

- **A checking step** — after the model answers, a second pass (often another model call) that asks "is this actually supported by the evidence?" and rejects it if not. You stop trusting the first answer and start verifying it.
- **Grounding and citations** — making the model base its answer on real fetched sources and point to them, so an unsupported claim is harder to make and easier to spot.
- **A human in the loop** — for anything irreversible or expensive (sending money, deleting data, emailing a customer), a real person approves the action before it happens, instead of the model's confident output triggering it directly.
- **Least privilege** — only giving the model access to the systems it truly needs, so even a confident mistake can't reach the places where it would do serious damage.

None of these exist because the model is *bad*. They exist because it fails *quietly and convincingly*, and an app that takes its output at face value is an app that ships confident fiction straight to users. Putting guardrails around it isn't paranoia — it's the necessary response to a component that can't tell you when it's wrong.

## Every call costs money — and the cost adds up fast

Running ordinary code is free. You can run a piece of it ten thousand times in a loop and never think about the cost. The model, by contrast, charges you for every call, based on how much text goes in and comes out (those *tokens* again). That one fact quietly rewrites what designs you can afford.

Suddenly things that used to be free have a price tag. A single retry costs money. An AI agent that takes fifteen steps to do what five would isn't just slower — it's *much* more expensive, because [each step re-reads everything that came before it](/blog/the-loop-at-the-heart-of-every-agent), and you pay for all that text again on every step. Dumping your entire knowledge base into the prompt "just to be safe" comes with a bill attached to every single request. So the app grows cost-control habits that don't exist in normal software: **caching** stable parts of the prompt so you don't pay for the same text over and over; using a **cheaper, smaller model** for the easy 80% of requests and only paying for the powerful one when a task genuinely needs it; and a general discipline of [reaching for the simplest option that solves the problem](/blog/simplest-agent-that-could-possibly-work) rather than the fanciest one. When every call is metered, being frugal stops being optional and becomes part of the design.

## It's slow — so the user experience has to change around it

The model is slow. Not slightly slow — it takes *seconds*, and it produces its answer a few words at a time rather than all at once. Drop a several-second wait into a screen that users expect to respond instantly, and the whole thing feels broken even when it's working exactly as intended.

So the model's slowness reaches all the way out to what the user sees. **Streaming** — showing the answer word by word as it's generated, the way ChatGPT does — becomes the default, because watching text appear is the only thing that makes a multi-second wait feel alive instead of frozen. Longer tasks get handled in the background — kick it off, show a progress indicator, notify the user when it's done — because you can't trap someone on a spinner for thirty seconds while an agent works. And when you have several independent model calls to make, you run them *at the same time* rather than one after another, since waits that pile up in sequence are the difference between an app people use and one they give up on. The slowness of one component spreads outward until it's shaping your whole interface.

## The pattern under all the patterns

Step back, and all those intimidating AI terms stop looking like a pile of unrelated techniques. RAG, evals, structured output, checking steps, human approval, caching, smaller models, streaming — these aren't a menu of fashionable things to bolt on. **Each one is the system's answer to a specific guarantee the model took away.** Frozen knowledge → retrieval. No memory → managing what's in the context window. Unpredictability → evals and structured output. Confident wrongness → checking and guardrails. Per-call cost → caching and cheaper models. Slowness → streaming and background work.

That's why "just add an LLM" is such a misleading way to think about it. You're not slotting one more part into an app. You're introducing a component whose nature clashes with the assumptions everything else was built on — and most of the work is reconciling that clash. The model is a small thing in your code and an enormous thing in your design.

## The reframe

Stop picturing the LLM as a smart function you call to get an answer. Picture it as what it actually is: an unpredictable, forgetful, costly, slow advisor that's brilliant and occasionally makes things up with total confidence — and *won't tell you which is which*. Hold that picture, and a lot of the design decisions make themselves, because each one is just an honest response to one of those traits. You fetch facts for it because its knowledge is frozen. You hand it the conversation each time because it has no memory. You check its work because it can be confidently wrong. You watch the spending because every call costs. You stream its replies because it's slow. You test it with evals because it won't give the same answer twice.

The people whose AI products quietly work in the real world aren't the ones who found a model good enough to plug in and trust blindly. There is no such model. They're the ones who understood exactly how the model breaks the old rules — and deliberately built the scaffolding that holds the strange component in place. The model is the part everyone stares at. The work around it — absorbing its weirdness so the rest of the app can stay sane — is the part that actually ships. If you're just starting out, that's the most useful thing to internalize early: you're not really building *with* a model so much as building the structure that makes a model safe to rely on.
