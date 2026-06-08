---
title: "Bad Data, Bad AI: The Part No Model Can Save You From"
pubDate: 2026-06-10
description: "Everyone wants a better model. Almost no one wants to fix their data. But the model is the cheap part — the ceiling on what any AI system can do is set by the quality of what you feed it, and no amount of parameters buys its way past garbage in."
author: "Frank Trout"
---

There's a comforting story we tell ourselves about AI projects that disappoint: the model wasn't good enough. So we wait for the next release, swap in a bigger one, tune the prompt for the fortieth time — and the thing is still wrong in the same ways it was wrong before. The model was never the problem. The data was. And the uncomfortable truth, the one that doesn't fit on a slide, is that **a better model fed bad data just gives you wrong answers faster and more fluently.**

I've written before that [a decision is only as good as the context behind it](/blog/it-will-decide-for-you-but-based-on-what). This is the same law pointed at the foundation instead of the moment of decision. Output quality is capped by input quality, and that cap does not move when you upgrade the model. It moves when you fix the data.

## "Garbage in, garbage out" got an upgrade, and it's worse now

The old saying was about spreadsheets. You put a wrong number in a cell, a wrong number came out the other end, and — crucially — it *looked* wrong, or at least traceable. You could follow the formula back to the bad cell.

AI changes the texture of the failure. Feed a language model stale, incomplete, or contradictory data and it doesn't return an obvious error. It returns a confident, well-written, plausible answer that happens to be wrong. The fluency is the trap. A bad spreadsheet looks broken; a bad AI answer looks like exactly the answer you wanted. The garbage comes out *polished*, and polish reads as correctness to a human in a hurry.

So the modern version is harsher: **garbage in, confident garbage out.** And confident garbage is more dangerous than obvious garbage, because people act on it.

## The four ways data goes bad

"Bad data" isn't one thing. It fails in distinct ways, and they compound:

**Stale.** The data was true once. Last quarter's pricing, last month's inventory, the org chart before the reorg, the policy that changed in March. The model reasons flawlessly over a world that no longer exists and hands you a decision for that vanished world.

**Incomplete.** The model sees three of the four sources that matter. The missing one is exactly the source that governs your edge cases. The answer looks reasonable and is subtly, specifically broken — and because you can't see the gap, you can't tell which answers fell into it.

**Wrong.** Duplicate records, mislabeled fields, a units mismatch, a scraped value that was never accurate. The model has no way to know a number is false; it treats everything in its context as equally true and reasons confidently from a lie.

**Conflicting.** Two sources disagree and nothing arbitrates. The model picks one — often the most recent or the most frequently repeated, not the most correct — and never tells you there was a fork in the road.

A bigger model does not detect any of these. It can't. Stale data isn't a reasoning problem, and a model has no independent ground truth to check your records against. It does what it's built to do: produce the most plausible continuation of whatever you gave it. Give it something rotten and it will produce a beautifully plausible rot.

## Why the model can't save you

There's a persistent hope that a sufficiently smart model will "see through" bad data — notice the contradiction, flag the stale number, infer the missing piece. Sometimes, at the margins, it does. You cannot build on sometimes.

The model is, by design, a context-reasoning engine. Its job is to take what's in front of it and extend it coherently. It has no privileged channel to reality, no way to know that your "customer_status" field has meant three different things since 2023, no way to know the document it's citing was superseded last week. When the data and the truth diverge, the model follows the data — fluently, every time. Intelligence applied to wrong inputs produces wrong outputs with more conviction, not less.

This is why "we'll fix it with a better model" is usually a way to avoid the actual work. The actual work is unglamorous: deduplicating records, reconciling sources, fixing pipelines, deciding what's authoritative, throwing out what's stale. Nobody gets to demo a data-cleaning sprint. But that sprint is what moves the ceiling, and the model upgrade isn't.

## Where it actually hurts: RAG and agents

This stops being abstract the moment you build a retrieval system or an agent.

A RAG pipeline is a machine for putting your data in front of a model. If the knowledge base is full of outdated docs, duplicate pages, and three versions of the same policy, retrieval will faithfully surface the wrong one, and the model will faithfully ground its answer in it — with a citation, which makes it *look* more trustworthy, not less. You've built a system that launders bad data through a credible-looking process. The citation points at the rot.

Agents make it worse, because they chain. An agent reads a stale value, makes a decision on it, takes an action, and that action's output becomes the input to the next step. Bad data doesn't just produce one wrong answer — it propagates through the loop, and by step five you're several confident inferences deep into a conclusion that started from a number that was wrong on step one. The blast radius of a single bad record scales with how autonomous the system is.

## What "good enough" data actually requires

You don't need perfect data. Perfect is a fantasy and chasing it is its own way of never shipping. You need data that's *good enough for the decision at hand*, which means knowing — and being honest about — a few things:

- **Freshness you can name.** Not "it's pretty current." How current, measured how, and what happens when the world moves and the data doesn't?
- **A defined source of truth.** When two systems disagree, something has to win. Decide what's authoritative before the model has to, not after it guessed.
- **Provenance.** Where did each piece come from, and can you distinguish an authoritative internal record from a scraped forum post? If everything in the context is treated as equally true, the forum post wins half the time.
- **Coverage you've mapped.** Know what the system *isn't* seeing. The dangerous blind spots are the invisible ones.
- **Honest behavior when data is thin.** The system should abstain and escalate when it's under-informed, not bluff. A model that says "I don't have enough to answer this" is worth more than one that always answers.

None of these are model features. They're data discipline. And that's the whole point: reliability lives in the layer everyone wants to skip.

## The reframe

Stop asking "which model should we use?" first. Ask it third. Ask "what are we feeding it?" first, "can we see and trust that data?" second, and *then* worry about the model — because by the time the data is clean, current, and traceable, you'll often find the model you already have is more than good enough.

The model is the part vendors compete on and the part that gets the headlines. Your data is the part nobody else can fix for you, the part that's tedious, and the part that actually sets the ceiling. Bad data, bad AI — no matter how good the model. Fix the foundation, and the AI you've already got starts looking a lot smarter. It isn't. You just stopped feeding it garbage.
