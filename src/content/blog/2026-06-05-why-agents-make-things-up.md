---
title: "Why Agents Make Things Up — and How to Contain It"
pubDate: 2026-06-05
description: "What hallucinations actually are, the related failure modes that distort output, why you can't fully eliminate them, and a layered control stack for making wrong answers rare, visible, and cheap."
author: "Frank Trout"
---

The most dangerous thing a language model does isn't being wrong. It's being wrong *fluently* — producing a confident, well-formatted, plausible answer that happens to be fiction, with none of the hedging a human would show when they're guessing. A model will invent a citation, a case number, a setting in some software's interface, or a refund policy in exactly the same tone it uses for things it's certain about. That mismatch between how sure it sounds and whether it's actually correct is the whole problem.

Let's be honest about the headline question up front: **you cannot eliminate hallucinations completely** from a general-purpose generative model — a model that produces open-ended text rather than picking from a fixed set of answers. Anyone selling you a setting that does is selling you something. But that's not the end of the story — because you *can* drive hallucinations down dramatically, make the ones that remain detectable, and arrange your system so that a wrong answer rarely turns into a wrong *action*. The goal isn't a model that's never wrong. It's a system where being wrong is rare, visible, and cheap.

This post is about how to build that system.

## What a hallucination actually is

A hallucination is when a model generates content that is fluent and plausible but **not grounded** — not supported by its training (the text it learned from), the input you gave it, or the tools it has access to. ("Grounded" just means anchored to a real source the model can actually rely on.) It's not lying (there's no intent) and it's not a bug in the usual sense (nothing crashed). It's the model doing exactly what it was built to do — produce a likely-sounding continuation — in a situation where "likely-sounding" and "true" diverge.

It helps to name the related failure modes too, because "hallucination" gets used as a catch-all and the fixes differ:

- **Fabrication** — inventing specific facts, quotes, citations, or identifiers that don't exist. The classic case.
- **Confabulation** — smoothly filling a gap in the input with a plausible guess rather than flagging the gap.
- **Faithfulness errors** — *faithfulness* is how closely the answer sticks to the source it was given; a faithfulness error is when, even *with* the right source right in front of it, the model summarizes or answers in a way that contradicts or overreaches that source. (This is why just fetching the right document doesn't save you.)
- **Sycophancy** — flattering agreement: telling you what you seem to want to hear, going along with a false premise in your question, or caving when you push back on a correct answer.
- **Overconfidence / miscalibration** — the tone of certainty is identical whether the model knows or is guessing. (A *well-calibrated* answer would sound less sure when the model is less sure; these aren't.) This is what makes the others dangerous.
- **Instruction drift** — over a long conversation or a long agent run, the model loses the thread of its actual constraints and starts answering a subtly different question.

Different symptoms, overlapping causes. Which brings us to why this happens at all.

## Why it happens (it's structural, not a glitch)

Understanding the root cause is what stops you from reaching for fixes that can't work.

A language model is a next-token predictor — at its core, it just guesses the next chunk of text (a *token* is a chunk of text, roughly a word or part of one), over and over, to build up a reply. It was trained to produce the most plausible continuation of text, not to track a separate ledger of "things I actually know." There's no internal "I don't know" switch it can flip, no boundary inside it between remembering a real fact and inventing a plausible one. When it lacks the information, the most plausible continuation is often a confident, well-formed answer — because that's what the training data looks like. Humans rarely write "I'm not sure" in the middle of an authoritative-sounding article.

Two things compound this. First, the model's knowledge is **lossy and compressed** — it squeezed an enormous amount of text down into a fixed-size set of internal numbers (its "weights"), much like a heavily compressed photo, so fine-grained facts (exact numbers, names, dates, edge cases) are exactly where the blur shows up. Second, there's a growing argument that the way models are *trained and graded* rewards confident guessing over honestly declining to answer: if a test scores a guess that's sometimes right higher than an "I don't know" that's never penalized but never rewarded either, you are literally training the model to bluff.

The takeaway: hallucination isn't a defect bolted onto an otherwise-truthful system. It's a property of how generative models work. That's *why* "just tell it not to hallucinate" doesn't work — you can't instruct away the way the thing is built (a *prompt*, the text you send the model, can't override its fundamental nature). What you can do is change the situation so the most plausible continuation is also the correct one, and catch it when it isn't.

## The control stack

Think of hallucination control as defense in depth — a stack of independent layers, from what you feed in, through how the model generates, to the system around it. No single layer is enough on its own; stacked, they get you a long way.

### 1. Ground it — give the model the facts

The single highest-leverage move is to stop relying on the model's fuzzy memory and instead put the relevant facts *in front of it* at answer time. That pattern — look up the relevant material and paste it into the prompt before the model answers — is called *retrieval*, or **RAG** (retrieval-augmented generation), and it runs over your own documents, databases, or knowledge sources. A model answering "what's our refund window?" from a retrieved policy paragraph is far more reliable than one answering from a vague sense of its training data.

But grounding is necessary, not sufficient — this is the trap people fall into. Retrieval fixes "the model doesn't know the fact." It does *not* automatically fix "the model contradicts the fact it was given" (the faithfulness problem from earlier) or "retrieval pulled the wrong paragraph." So grounding has to be paired with the next few layers.

### 2. Constrain the task

The narrower the question, the less room to invent. Wherever you can, turn open-ended answering into something bounded: sorting an input into a fixed set of labels instead of free text; **structured output** — asking the model to reply in a strict, predefined shape (like filling in the blanks on a form) so it completes set fields rather than freelancing; an explicit list of allowed answers. A model choosing among five options can't fabricate a sixth. Much of what looks like a hallucination problem is really an unconstrained-task problem.

### 3. Give it permission to not know

Models bluff partly because nothing in the prompt told them abstaining was acceptable. Explicitly authorize it: instruct the model to answer *only* from the provided context, and to say "that isn't in the provided sources" when it isn't. Counterintuitively, telling a model it's allowed to fail makes it fail honestly instead of failing silently. Pair this with a demand for **citations to specific passages** — "back up each claim with the exact source text it came from." A claim that can't be cited is a claim to distrust, and requiring citations makes ungrounded answers much harder to produce in the first place.

### 4. Verify, don't just generate

Add a checking step. The idea is to generate first, then have something judge and correct the result: after the model answers, a second pass (a different prompt, or a separate model call acting as a checker) verifies whether each claim is actually supported by the retrieved evidence, and sends it back to be redone if not. For high-stakes single answers, **self-consistency** helps — ask the same question a few times and see if the answers agree; if they disagree, that's a hallucination smoke alarm. Verification is more expensive, so reserve it for the answers where being wrong is costly.

### 5. Prefer checking over recalling

This is where agents have an advantage worth exploiting. Instead of asking the model to *recall* a fact, give it a tool — a bit of code it can call — to *look it up*, and let the real result coming back from that system drive the next step. An agent that queries the live inventory system can't hallucinate the stock count the way a model answering from memory can. The reliability of a well-fed agent loop comes precisely from replacing "remember" with "go check." (Which is also why you must never let the model *make up* a tool's result — in a multi-step loop, an invented result gets treated as fact on the next step, and every step after that builds on the error.)

### 6. Tune decoding where determinism matters

For factual or structured tasks, lower the *temperature* — a setting that controls how much randomness the model adds when choosing its words. High randomness is great for brainstorming and corrosive for accuracy. Turning it down won't stop hallucination on its own, but it keeps the model from wandering off into unlikely inventions when you'd rather it stick to its most confident, grounded answer.

### 7. Evaluate systematically

You cannot control what you don't measure. Build an **evaluation harness** (usually just called *evals*) — a standing set of test cases that score the model's output — with **groundedness / faithfulness** measures (does the answer actually follow from the source?) alongside task measures like whether it understood the request, picked the right tools, and stayed on task. Run it before you ship to catch things that got worse, and keep watching once it's live. Deliberately stress-test it with the inputs most likely to make it bluff: questions just outside what it has sources for, false premises, deliberately tricky phrasing. The number this produces is what turns "it feels more accurate now" into evidence.

### 8. Contain the blast radius

Finally, accept that some hallucinations will get through, and design so they don't cause harm. Keep a **human in the loop** — a real person who approves the action before it happens — for consequential or irreversible steps; never let an ungrounded claim directly trigger a payment, a deletion, or a legal commitment. Apply **least privilege** — give the agent access only to the systems it genuinely needs — so a confused one simply *can't* reach the places where a mistake would be expensive. Use content filters and other **guardrails** (automated safety checks around the model) for the bad outputs you can detect. This layer is what makes the leftover error rate survivable.

## A note for agent builders specifically

Everything above is sharper inside an agent's loop, because the loop *trusts its own history*. (Remember: an agent works by taking a step, reading the result, and feeding everything so far back into the model to decide the next step.) A hallucination on step two doesn't just produce one bad answer — it becomes part of what the model reads on steps three through ten, and the model builds confidently on top of the fiction. Two implications follow: keep the results the agent reads truthful and easy to interpret so the loop can correct itself, and never let the model invent what a tool returned. In a loop, an early ungrounded claim is the error that snowballs the most.

## Things that feel like fixes but aren't

A short list of false comfort, because these waste the most time:

| Tempting move | Why it falls short |
| --- | --- |
| "Don't hallucinate" in the system prompt (the standing instructions you give the model) | You can't instruct away how the model is built; it has marginal effect at best |
| Assuming a bigger/newer model solves it | Bigger models hallucinate *less* and often *more convincingly* — harder to catch, not gone |
| Trusting retrieval (RAG) blindly | Fetching documents fixes missing knowledge, not faithfulness or a wrong fetch |
| Reading the confident tone as confidence | Tone is uncorrelated with correctness; that's the entire problem |
| One-time spot-checking | Without a standing eval, you have anecdotes, not a measured error rate |

## The checklist

When accuracy matters, work down this list:

1. **Ground** the answer in retrieved sources rather than memory.
2. **Constrain** the task — structured output, fixed options, narrow scope.
3. **Let the model say "I don't know,"** and require **citations** to the exact source passages.
4. **Verify** high-stakes answers with a checking pass or self-consistency (asking more than once and comparing).
5. **Check, don't recall** — give the agent tools to fetch the real answer.
6. **Lower temperature** for factual and structured work.
7. **Evaluate** groundedness and faithfulness, offline and in production.
8. **Contain** the damage — human review and least privilege on consequential actions.

## The honest conclusion

Can you eliminate hallucinations entirely? For a narrow, fully grounded, tightly bounded task — sorting inputs into a fixed set of labels, or pulling specific facts out of a provided document with permission to say "not found" — you can get *close enough that it stops being the thing you worry about*. For open-ended generation from a general model, no. The capacity to produce fluent, confident, ungrounded text is inseparable from the capacity to produce fluent, confident, *correct* text. They're the same capability pointed at different situations.

So the mature goal isn't perfection. It's engineering a system where the model is given the facts, told it may abstain, asked to cite, checked when it counts, measured continuously, and fenced off from anything it could break. Do that, and hallucinations stop being an existential threat to your product and become what they should be: a known, bounded, monitored error rate — like any other.

The teams that handle this well aren't the ones who found a model that never lies. They're the ones who stopped expecting one, and built accordingly.
