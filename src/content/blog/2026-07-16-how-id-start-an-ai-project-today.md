---
title: "How I'd Start an AI Project Today"
pubDate: 2026-07-16
description: "Most AI projects don't fail because someone picked the wrong model. They fail because the right things happened in the wrong order — the model and the demo first, the data and the measurement and the guardrails only after those had already broken. Here's the sequence I'd actually run, and why the order is the whole advice."
author: "Frank Trout"
---

Suppose you're starting an AI project on Monday. Not a prototype to impress someone — a real thing that real people will depend on. You've got a problem, a budget, and a room full of opinions about which model to use.

Here's what I'd tell you, and it's going to sound anticlimactic: the model is close to the last thing you should think about, and the order you do everything else in matters more than any individual choice you'll make.

I've written a lot of posts that each pick at one piece of this — data, evals, context, authority, restraint. This is the one where they're a sequence instead of a pile. Because after watching enough of these projects go sideways, I've stopped believing the failures are mostly about judgment. **AI projects rarely fail because someone picked the wrong model. They fail because the team did the right things in the wrong order — started with the model and the demo, and got to the data, the measurement, and the guardrails only after those things had already broken.** Every step below is something teams eventually do. The ones that succeed do them *first*, on purpose, when they're cheap. The ones that struggle do them in production, under duress, in the order the incidents dictate.

So: the order is the advice. Here it is.

## 1. Ask whether it's even an AI problem

Before anyone gets excited, before a single vendor call, ask the least popular question in the building: *does this actually need AI?*

The test I use is about **shape**. If you can specify the steps and write down the rules — if the logic is *if this, then that*, even with forty branches — that's code, or a workflow (a fixed, predetermined sequence of steps), and you should build it that way. Code is cheaper, faster, deterministic, testable, and it doesn't invent things. You reach for a **model** (a large language model — the thing that reads text and predicts what comes next, probabilistically) when the problem genuinely resists specification: unstructured language in, judgment required, too many variations to enumerate, and the path depends on what you find along the way. [That's the honest case for an agent](/blog/the-case-for-agents), and it's real — but it's narrower than the enthusiasm suggests, and [most of what gets called an agent shouldn't be one](/blog/when-not-to-build-an-agent).

Do this first because it's the only step that can save you the other seven. It's also the step with the most social pressure against it, because "we don't need AI for this" is a sentence nobody wants to say in a quarter where AI is the strategy. Say it anyway. The most successful AI project I can point at is the one that turned out to be a well-placed function call.

## 2. Look at the data before you look at the model

Assume it survived step one. Now go look at your data — not the model catalog, not the framework comparison. The data.

Because the ceiling is set by what you'll feed it. [Output quality is capped by input quality, and no model upgrade raises that cap](/blog/bad-data-bad-ai). A brilliant model reading stale, contradictory records produces confident, fluent, well-organized wrong answers — which is worse than obviously wrong answers, because people believe them. The single highest-leverage hour of a new AI project is spent with whoever actually owns the source system, asking:

- **Where do the facts live?** Not where they're supposed to live. Where they are.
- **How fresh are they?** What's the real lag between the world changing and the record changing?
- **What's authoritative when sources disagree?** Because they will disagree, and something has to break the tie — and if you don't decide, the model will decide for you, silently, based on whatever it happened to read.
- **What's missing?** The fields nobody fills in are the ones your users will ask about.

This is unglamorous and it is the work. [What the system decides is downstream of what it was told](/blog/it-will-decide-for-you-but-based-on-what), and if you learn on day 90 that the source of truth was never trustworthy, everything built on top of it was a rehearsal.

## 3. Start at the cheapest tier that could possibly work

Now you can talk about building — starting from the bottom. There's a ladder, and you descend it only when the rung above genuinely can't hold the problem:

1. **Plain code.** Deterministic, testable, free at runtime. Astonishing how often this is the answer.
2. **A single model call.** One prompt, one response, no loop. Classify this. Summarize that. Extract these fields.
3. **A fixed workflow.** You define the steps; the model does the fuzzy part *inside* one or two of them. You keep the control flow; the model handles the language.
4. **An agent.** The model decides its own steps and picks its own tools in a loop. Maximum flexibility, maximum surface area for things to go wrong.

Each rung down buys capability and charges you in reliability, cost, latency, and debuggability. [Start with the simplest thing that could possibly work and let the problem tell you it isn't enough](/blog/simplest-agent-that-could-possibly-work) — because a demo can't tell you that, and neither can a roadmap slide.

Worth saying: "cheapest tier" is also a question about *how* you build, not just what. [Low-code is genuinely the right call when the cost of error is low, the logic is simple, and the person closest to the problem can own it](/blog/when-low-code-is-the-right-call) — and standing up a repo, a CI pipeline, and a deployment story to send a chat message is its own kind of over-engineering. Match the build surface to the shape too.

## 4. Build the eval harness before you tune anything

Here's the step everyone skips, and the one that makes every later step honest.

An **eval** is a test suite for a probabilistic system: a set of representative inputs with known-good outputs, plus a way to score how close you got. An **eval harness** is the machinery that runs them on demand and hands you a number. And [you cannot improve what you can't measure](/blog/you-cant-improve-what-you-cant-measure) — which sounds like a poster and is actually a load-bearing constraint, because the alternative is what most teams are doing right now: changing a prompt, running three examples by hand, and saying "yeah, that feels better."

*It feels better* is not a result. It's a vibe with a deployment attached. And it fails in a specific, expensive way: you can't tell improvement from regression, so you fix the case in front of you and silently break two you weren't looking at. Traditional software gives you a hard signal for free — the test passes or it doesn't. A model gives you nothing unless you build the signal yourself.

Build it early, while it's cheap and boring, for three reasons. It forces you to define what "good" even means, which is a requirements conversation disguised as an engineering task and usually the moment you discover nobody agreed. It gives every later step a verdict instead of an argument. And it's the only thing that turns "let's add another layer" into a decision rather than a preference.

Do this before you tune, before you tweak the prompt, before you compare models. Otherwise every subsequent step is you moving in the dark with confidence.

## 5. Design the context and the tools deliberately

Now the part people think is "prompt engineering" and mostly isn't.

**Context** is everything the model sees on a given turn — the instructions, the conversation so far, the retrieved documents, the tool results. It is not a place you dump things. It's a budget you spend, and [assembling the right context at the right moment is most of the actual job](/blog/context-engineering-is-the-job). More is not better: a window stuffed with marginally relevant material makes the model follow the instructions that *do* matter *worse*, not better. What goes in, what gets summarized, what gets dropped, what gets fetched fresh — those are design decisions, and if you're not making them, they're being made by whatever your framework does by default.

Same for tools. A **tool** is a function you expose to the model — search this, look up that, send this. Here's what people miss: [the tool description isn't documentation, it's the interface the model reads to make a decision](/blog/the-tool-is-the-interface). A vague name and a fuzzy description mean the right tool never gets called, or the wrong one does, and you'll blame the model. Fifteen overlapping tools mean the model spends its attention disambiguating instead of working. Design that surface like you'd design an API for a competent colleague who can't ask you a follow-up question.

## 6. Decide authority and guardrails now, not after the incident

Every tool you hand the model is a grant of power, and [giving an agent authority is a security decision whether or not anyone treats it as one](/blog/giving-an-agent-authority-is-a-security-decision). This step goes here — before you ship, not after the postmortem — because "we'll tighten permissions later" has a perfect record of meaning "we'll tighten permissions after something happens."

Three commitments, made now:

- **Least privilege.** Least privilege means the thing can reach exactly what it needs for its job and nothing else — not the service account somebody had lying around that can read the whole tenant. The blast radius of a mistake or a hijack is precisely the permissions you granted. Grant less.
- **A human gate on anything irreversible.** Money moving, data deleting, messages leaving the building, commitments made to customers. A model's confidence is not correlated with its correctness — [and knowing the model's specific weaknesses is itself the first guardrail](/blog/the-first-guardrail-is-knowing-the-models-weaknesses). Confidence is a writing style, not evidence.
- **Must-hold rules go in code, not the prompt.** This is the one I'd tattoo on the project. Instructions in a prompt are followed *probabilistically* — most of the time, in proportion to how clearly they're written and what else is competing for attention. That's fine for tone and formatting. It is not fine for "never expose another customer's data." If a rule must hold every time, it lives in code that runs whether the model cooperates or not. **A guardrail you can talk the model out of was never a guardrail.**

## 7. Ship something small into reality, fast

With those six in place, get something real in front of real users at real stakes — deliberately small, deliberately soon.

Not because shipping fast is a virtue on its own, but because [the demo removes exactly what makes production hard](/blog/the-demo-to-production-gap) and you cannot reason your way to what it removed. The demo ran once, on curated data, on an input the presenter chose, with nothing at stake. Production is an average day, on your mess, on the inputs nobody picked, at volume, when it counts. A 97% success rate is flawless in a one-shot demo and three hundred failures a day at ten thousand requests.

Real inputs, real volume, real consequences are the only honest test — and they're also the only thing that tells you which of your assumptions from steps two through six were wrong. They will have been wrong. Better to learn it in week three with twenty users than in month nine with the whole company. Narrow scope, real stakes, instrumented from the first request. That's the shape.

## 8. Earn every layer of complexity with evidence

Then, and only then, add. And add against a *measured ceiling*, not a hunch.

The pattern that works: ship the simple thing, watch it fail in a specific way, measure the gap on your eval harness, and add exactly the layer that closes it. The pattern that doesn't: build the multi-agent architecture on day one because the problem *feels* complicated. Complexity you didn't earn is complexity you can't debug — and [counting agents shipped is not the same as winning](/blog/most-agents-dont-win), no matter how the scoreboard is drawn. It's the same move as [buying the sophisticated operational layer to skip the operational maturity it requires](/blog/you-havent-earned-aiops-yet): reaching for the exciting rung to avoid the boring one underneath it.

Notice this step is only available to you *because* of step four. Without evals, "we need an agent here" is an opinion, and the loudest person in the room wins. With them, it's a number, and the number decides.

## The checklist

Pin this to the wall:

1. **Is it even an AI problem?** Can you specify the steps? Then it's code.
2. **Look at the data first.** Where do the facts live, how fresh, who wins a tie?
3. **Start at the cheapest tier.** Code → one call → workflow → agent. Descend only when forced.
4. **Build the evals before you tune.** No number, no verdict, no progress.
5. **Design context and tools deliberately.** A budget, not a dump. An interface, not docs.
6. **Decide authority and guardrails now.** Least privilege, human gate on irreversible, must-holds in code.
7. **Ship small into reality fast.** The demo can't tell you what production will.
8. **Earn complexity with evidence.** A measured ceiling, not a hunch.

## The reframe

Read that list back and notice what's missing. There's no step called "pick the model." It's the part everyone starts with and, honestly, the part that matters least — because the models are all good now, they're all getting better without you, and the gap between the best one and the second-best one is dwarfed by the gap between a project with an eval harness and one without.

The order is the advice because the order is where the leverage is. Every step above is something you *will* do eventually. Data quality, measurement, guardrails, scope — nobody escapes them. You either do them in week one, cheaply, on purpose, or you do them in month nine, expensively, while someone from Legal is on the call. Same work. Different price. The teams that struggle didn't skip the foundation; they just paid for it later, at a markup, with the roadmap already promised.

So do the boring things, and do them in order. Ask the unpopular question. Go look at the data. Start too simple. Build the thing that tells you the truth. Decide who's allowed to do what before anyone does it. Get small and real fast. Earn what you add.

Do all that, and here's the punchline you'll probably arrive at, the way I keep arriving at it: the AI you already have is almost always enough. It was never the constraint. Everything around it was — and now that's the part you built first.
