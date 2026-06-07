---
title: "Why Agents Make Things Up — and How to Contain It"
pubDate: 2026-06-05
description: "What hallucinations actually are, the related failure modes that distort output, why you can't fully eliminate them, and a layered control stack for making wrong answers rare, visible, and cheap."
author: "Frank Trout"
---

The most dangerous thing a language model does isn't being wrong. It's being wrong *fluently* — producing a confident, well-formatted, plausible answer that happens to be fiction, with none of the hedging a human would show when they're guessing. A model will invent a citation, a case number, an API parameter, or a refund policy in exactly the same tone it uses for things it's certain about. That mismatch between confidence and correctness is the whole problem.

Let's be honest about the headline question up front: **you cannot eliminate hallucinations completely** from a general-purpose generative model. Anyone selling you a setting that does is selling you something. But that's not the end of the story — because you *can* drive hallucinations down dramatically, make the ones that remain detectable, and arrange your system so that a wrong answer rarely turns into a wrong *action*. The goal isn't a model that's never wrong. It's a system where being wrong is rare, visible, and cheap.

This post is about how to build that system.

## What a hallucination actually is

A hallucination is when a model generates content that is fluent and plausible but **not grounded** — not supported by its training, the input you gave it, or the tools it has access to. It's not lying (there's no intent) and it's not a bug in the usual sense (nothing crashed). It's the model doing exactly what it was built to do — produce a likely-sounding continuation — in a situation where "likely-sounding" and "true" diverge.

It helps to name the related failure modes too, because "hallucination" gets used as a catch-all and the fixes differ:

- **Fabrication** — inventing specific facts, quotes, citations, or identifiers that don't exist. The classic case.
- **Confabulation** — smoothly filling a gap in the input with a plausible guess rather than flagging the gap.
- **Faithfulness errors** — even *with* the right source in context, the model summarizes or answers in a way that contradicts or overreaches the source. (This is why retrieval alone doesn't save you.)
- **Sycophancy** — telling you what you seem to want to hear, agreeing with a false premise in your question, or caving when you push back on a correct answer.
- **Overconfidence / miscalibration** — the tone of certainty is identical whether the model knows or is guessing. This is what makes the others dangerous.
- **Instruction drift** — over a long context or a long agent run, the model loses the thread of its actual constraints and starts answering a subtly different question.

Different symptoms, overlapping causes. Which brings us to why this happens at all.

## Why it happens (it's structural, not a glitch)

Understanding the root cause is what stops you from reaching for fixes that can't work.

A language model is a next-token predictor. It was trained to produce the most plausible continuation of text, not to track a separate ledger of "things I actually know." It has no built-in `IDONTKNOW` token, no internal boundary between recall and invention. When it lacks the information, the most plausible continuation is often a confident, well-formed answer — because that's what the training data looks like. Humans rarely write "I'm not sure" in the middle of an authoritative-sounding article.

Two things compound this. First, the model's knowledge is **lossy and compressed** — it absorbed an enormous amount of text into a fixed set of weights, so fine-grained facts (exact numbers, names, dates, edge cases) are exactly where the compression artifacts show up. Second, there's a growing argument that the way models are *trained and evaluated* rewards confident guessing over honest abstention: if a benchmark scores a guess that's sometimes right higher than an "I don't know" that's never penalized-but-never-rewarded, you are literally training the model to bluff.

The takeaway: hallucination isn't a defect bolted onto an otherwise-truthful system. It's a property of how generative models work. That's *why* "just tell it not to hallucinate" doesn't work — you can't prompt away the architecture. What you can do is change the situation so the most plausible continuation is also the correct one, and catch it when it isn't.

## The control stack

Think of hallucination control as defense in depth — layers from the input side, through generation, to the system around the model. No single layer is sufficient; stacked, they get you a long way.

### 1. Ground it — give the model the facts

The single highest-leverage move is to stop relying on the model's compressed memory and instead put the relevant facts *in front of it* at answer time, via retrieval (RAG) over your documents, databases, or knowledge sources. A model answering "what's our refund window?" from a retrieved policy paragraph is in a completely different reliability regime than one answering from training-data vibes.

But grounding is necessary, not sufficient — this is the trap people fall into. Retrieval fixes "the model doesn't know the fact." It does *not* automatically fix "the model contradicts the fact it was given" (faithfulness) or "retrieval pulled the wrong paragraph." So grounding has to be paired with the next few layers.

### 2. Constrain the task

The narrower the question, the less room to invent. Wherever you can, turn open generation into something bounded: classification into a fixed set of labels instead of free text; **structured output** against a strict schema so the model fills defined fields rather than freelancing; an explicit allowed answer space. A model choosing among five options can't fabricate a sixth. Much of what looks like a hallucination problem is really an unconstrained-task problem.

### 3. Give it permission to not know

Models bluff partly because nothing in the prompt told them abstaining was acceptable. Explicitly authorize it: instruct the model to answer *only* from the provided context, and to say "that isn't in the provided sources" when it isn't. Counterintuitively, telling a model it's allowed to fail makes it fail honestly instead of failing silently. Pair this with a demand for **citations to specific source spans** — "support each claim with the passage it came from." A claim that can't be cited is a claim to distrust, and requiring citations makes ungrounded answers structurally harder to produce.

### 4. Verify, don't just generate

Add a checking step. This is the evaluator-optimizer pattern aimed at truth: after the model answers, a second pass (a different prompt, or a dedicated evaluator) checks whether each claim is actually supported by the retrieved evidence, and sends it back if not. For high-stakes single answers, **self-consistency** helps — sample the answer a few times and see if they agree; divergence is a hallucination smoke alarm. Verification is more expensive, so reserve it for the answers where being wrong is costly.

### 5. Prefer checking over recalling

This is where agents have an advantage worth exploiting. Instead of asking the model to *recall* a fact, give it a tool to *look it up* and let the real result — the ground truth from the environment — drive the next step. An agent that queries the live inventory system can't hallucinate the stock count the way a model answering from memory can. The reliability of a well-fed agent loop comes precisely from replacing recall with observation. (Which is also why you must never let the model *fabricate* a tool result — in a multi-step loop, an invented observation becomes trusted context and every subsequent step compounds the error.)

### 6. Tune decoding where determinism matters

For factual or structured tasks, lower the temperature. High randomness is great for brainstorming and corrosive for accuracy. It won't stop hallucination on its own, but it stops the model from wandering into low-probability inventions when you need its most confident, grounded path.

### 7. Evaluate systematically

You cannot control what you don't measure. Build an evaluation harness with **groundedness / faithfulness** metrics (does the answer follow from the source?) alongside task metrics like whether it understood the request, picked the right tools, and stayed on task. Run it offline to catch regressions before they ship, and monitor in production. Red-team with the inputs most likely to induce bluffing: questions just outside the knowledge base, false premises, adversarial phrasing. The number this produces is what turns "it feels more accurate now" into evidence.

### 8. Contain the blast radius

Finally, accept that some hallucinations will get through, and design so they don't cause harm. Keep a **human in the loop** for consequential or irreversible actions — never let an ungrounded claim directly trigger a payment, a deletion, or a legal commitment. Apply least privilege so a confused agent simply *can't* reach the systems where a mistake would be expensive. Use content filters and guardrail screening for the categories you can detect. This layer is what makes the residual error rate survivable.

## A note for agent builders specifically

Everything above is sharper inside an agent's reasoning loop, because the loop *trusts its own history*. A hallucination on turn two doesn't just produce one bad answer — it becomes part of the context the model reads on turns three through ten, and the model builds confidently on top of the fiction. Two implications follow: keep observations truthful and interpretable so the loop can self-correct, and never let the model invent what a tool returned. In a loop, an early ungrounded claim is the error that compounds the most.

## Things that feel like fixes but aren't

A short list of false comfort, because these waste the most time:

| Tempting move | Why it falls short |
| --- | --- |
| "Don't hallucinate" in the system prompt | You can't instruct away the architecture; it has marginal effect at best |
| Assuming a bigger/newer model solves it | Bigger models hallucinate *less* and often *more convincingly* — harder to catch, not gone |
| Trusting RAG blindly | Retrieval fixes missing knowledge, not faithfulness or bad retrieval |
| Reading the confident tone as confidence | Tone is uncorrelated with correctness; that's the entire problem |
| One-time spot-checking | Without a standing eval, you have anecdotes, not a measured error rate |

## The checklist

When accuracy matters, work down this list:

1. **Ground** the answer in retrieved sources rather than memory.
2. **Constrain** the task — structured output, fixed options, narrow scope.
3. **Permit abstention** and require **citations** to source spans.
4. **Verify** high-stakes answers with a checking pass or self-consistency.
5. **Check, don't recall** — give the agent tools to fetch ground truth.
6. **Lower temperature** for factual and structured work.
7. **Evaluate** groundedness and faithfulness, offline and in production.
8. **Contain** the damage — human review and least privilege on consequential actions.

## The honest conclusion

Can you eliminate hallucinations entirely? For a narrow, fully grounded, constrained task — classification over a fixed set, extraction from a provided document with abstention allowed — you can get *close enough that it stops being the thing you worry about*. For open-ended generation from a general model, no. The capacity to produce fluent, confident, ungrounded text is inseparable from the capacity to produce fluent, confident, *correct* text. They're the same capability pointed at different situations.

So the mature goal isn't perfection. It's engineering a system where the model is given the facts, told it may abstain, asked to cite, checked when it counts, measured continuously, and fenced off from anything it could break. Do that, and hallucinations stop being an existential threat to your product and become what they should be: a known, bounded, monitored error rate — like any other.

The teams that handle this well aren't the ones who found a model that never lies. They're the ones who stopped expecting one, and built accordingly.
