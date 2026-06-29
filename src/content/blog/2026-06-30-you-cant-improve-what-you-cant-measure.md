---
title: "You Can't Improve What You Can't Measure: The Case for Evals"
pubDate: 2026-06-30
description: "The most common sentence in AI development is 'that feels better' — and it's worth almost nothing. Evals are the discipline that turns a hunch into a measured number. They don't demo, nobody wants to build them, and they're the thing that separates an AI system you can actually improve from one you're just nudging in the dark."
author: "Frank Trout"
---

The most common sentence in AI development is "that feels better." Someone tweaks a prompt — the instructions you give the model — reruns a handful of examples, reads the output, nods, and ships it. It *felt* better. Maybe it was. Maybe the three cases they happened to look at got better while ten they didn't look at got worse. They have no idea, because "it feels better" isn't a measurement. It's a vibe wearing the costume of a result.

I've leaned on one idea in nearly everything I've written here — [earn each bit of complexity with evidence](/blog/simplest-agent-that-could-possibly-work), [prove the simpler thing failed before you add the harder one](/blog/most-agents-dont-win), measure before you trust. Every one of those depends on a capability I kept invoking and never gave its own post: the ability to **turn a hunch into a number.** That capability has a name, and it's the least glamorous, most load-bearing thing in the whole field.

**An eval is a repeatable test of your AI system's quality. An eval *harness* is the standing machinery that runs those tests and gives you a score you can compare over time.** Without one, every change you make is a guess, every "improvement" is anecdote, and you are flying a plane with the instruments taped over, going by how the wind feels on your face.

## Why your old testing instincts don't transfer

If you come from normal software, you already have a testing discipline — and it quietly stops working the moment a model is involved. I've written about [why the LLM breaks the assumptions the rest of your stack is built on](/blog/the-llm-is-not-a-function-call), and this is one of the sharpest breaks.

A traditional test asks: *does the output exactly equal what I expected?* Same input, same output, every time — so you assert equality and you're done. But a model is [non-deterministic](/blog/the-llm-is-not-a-function-call): ask it the same question twice and you can get two different answers, both fine. There is no single golden string to match against. The "right" answer is a whole *range* of acceptable responses, and exact-match testing against a moving target just tells you the target moved.

So evals replace "is it exactly this?" with "is it *good*?" — scored on qualities rather than identity. Did the answer stay on topic? Is it actually supported by the source it cited? Did the agent pick the right tool with the right arguments? Did it refuse the thing it should have refused? You're not checking a value. You're checking a *judgment*, repeatedly, at scale, so that "it feels better" becomes "groundedness went from 71% to 89% and nothing else regressed."

## Why almost nobody builds them

Here's the uncomfortable part, and it's the same pattern I called out with [AIOps](/blog/you-havent-earned-aiops-yet) and [data quality](/blog/bad-data-bad-ai): the thing that actually matters is the thing nobody wants to do, because it doesn't demo.

You can stand on a stage and show an agent booking a trip. You cannot stand on a stage and show a quarter spent assembling a labeled dataset of hard cases and wiring up a scoring pipeline. Evals are unglamorous infrastructure. They produce no shippable feature, no screenshot, no applause. So they get skipped, and the team substitutes the cheap thing — eyeballing a few outputs — and calls it testing.

The substitution feels fine right up until it doesn't. You change a prompt to fix one customer's complaint and silently break a category of cases nobody re-checked. You upgrade the model and *assume* it's better because newer is better, with zero evidence either way. You add a second agent because it "seemed to help," and now you're [paying for complexity you never proved you needed](/blog/simplest-agent-that-could-possibly-work). Every one of these is a decision made blind, and blindness is exactly what an eval harness cures.

## What to actually measure (it's not just the final answer)

The naive version of evals is "score the final output." That's necessary and nowhere near sufficient, because by the time the final answer is wrong, you've lost the thread of *where* it went wrong. For anything with steps — and [every agent is a loop of steps](/blog/the-loop-at-the-heart-of-every-agent) — you want to measure the pipeline, not just its last token.

A useful eval suite tends to cover several layers:

- **Did it understand the request?** Before anything else — did the system correctly interpret what was actually being asked? A lot of "bad answers" are really "answered a different question."
- **Did it retrieve the right context?** If you use retrieval (pulling relevant facts from your data to feed the model), the quality of *what got pulled* caps everything downstream — this is [bad data, bad AI](/blog/bad-data-bad-ai) measured directly. Score retrieval on its own: did the right document come back, or did the system confidently ground its answer in the wrong paragraph?
- **Did it pick the right tools?** For an agent, tool selection is most of the game. Measure whether it chose the right tool with the right arguments — not just whether the end result happened to work out.
- **Is the answer faithful?** **Groundedness** (also called **faithfulness**) asks: does the answer actually follow from the source it was given, or did the model overreach and add something the source never said? This is the metric that catches [confident, fluent fabrication](/blog/why-agents-make-things-up) — the failure mode that doesn't trip a normal error.
- **Did it stay safe and on-policy?** Did it refuse what it should refuse, abstain when it didn't know, and avoid the categories you've ruled out?

Notice that most of these aren't about eloquence. They're about whether the system did the *right thing* for the *right reason* — which is the only kind of "better" worth shipping.

## How you score something with no right answer

The obvious objection: if there's no golden string, who decides whether an answer is "good"? Three approaches, in rough order of cost and reliability:

**Code-based checks, where you can get them.** The cheapest and most trustworthy. If the output is supposed to be valid structured data (a strict, machine-readable shape, like a filled-in form), you can check that mechanically. If a number must fall in a range, if a required field must be present, if a citation must point to a real document — those are deterministic checks, and you should lean on them wherever the task allows, because they never disagree with themselves.

**A human-labeled set.** You assemble a collection of representative inputs — a "golden dataset" — and have knowledgeable people mark what good looks like. This is the gold standard for *truth* and the bottleneck for *scale*: humans are slow and expensive, so you can't run them on every change. The move is to label a high-quality set once, use it as your benchmark, and refresh it as the world changes.

**LLM-as-judge, used carefully.** You use a second model to grade the first one's output against a rubric — "does this answer follow from this source? score 1–5 and justify." This scales beautifully and is genuinely useful, but it comes with a warning I'll get to: the judge is itself a fallible model, and an unvalidated judge just launders one model's opinion through another and calls it a metric.

The mature setup uses all three: deterministic checks for what's checkable, an LLM-judge for the fuzzy qualities at scale, and a human-labeled set as the anchor that keeps the judge honest.

## Offline to catch regressions, online to catch reality

Two places evals run, and you need both.

**Offline** — against your fixed dataset, before you ship. This is your regression net: a **regression** is when a change quietly makes something that used to work stop working. You run the suite on every prompt tweak, every model swap, every new tool, and you compare the score to the last known-good. The number moved up? Ship it. Down? You just caught the break *before* a user did. This is the single highest-leverage habit in the whole practice, and it's the one teams skip first.

**Online** — against real traffic, in production. Your offline dataset, however good, is a snapshot; real users will always find inputs you didn't imagine. So you monitor quality on live traffic too — sampling real interactions, scoring them, watching for drift. The world changes, your data goes stale, user behavior shifts, and a system that was 89% last month is 80% now and nobody noticed because nobody was looking. Online evals are how you keep [the gap between the demo and production](/blog/what-running-foundry-hosted-agents-taught-me) from opening up silently after launch.

And deliberately try to break it. **Red-teaming** — feeding the system the inputs most likely to make it fail: questions just outside its knowledge, false premises stated confidently, adversarial phrasing designed to coax a bluff. The failures you find on purpose are failures a user doesn't find by accident.

## The honest part: your evals can be wrong too

I won't pretend the measurement is free of the disease it's diagnosing. An LLM-judge can be miscalibrated. A golden dataset can be unrepresentative, or stale, or quietly wrong in the same way your production data is wrong. A metric can be gameable — optimize hard enough for a number and you'll get a system that scores well and behaves worse, because you taught it to the test.

The discipline that keeps evals honest is the same one that keeps everything else honest: **measure the measurer.** Spot-check your LLM-judge against human labels and find out how often they actually agree before you trust its scores. Refresh your dataset as the world moves. Watch for the gap between "the eval is happy" and "users are happy," and when they diverge, believe the users and fix the eval. An eval harness isn't a truth oracle you build once and obey. It's an instrument you calibrate, and a well-calibrated imperfect instrument beats a confident gut every single time.

## Why this is the keystone

Step back and notice that almost every piece of advice I've given on this blog has a hidden dependency on this one capability.

"[Earn each layer of complexity](/blog/simplest-agent-that-could-possibly-work)" requires a number that tells you the simpler layer plateaued. "[Don't assume a bigger model fixes it](/blog/bad-data-bad-ai)" requires being able to show, with evidence, that it didn't. "[The most agents don't win](/blog/most-agents-dont-win)" only means something if you can demonstrate that ten agents underperform two good ones. "[Contain hallucinations](/blog/why-agents-make-things-up)" requires a groundedness metric to know whether you actually contained anything. Every one of those arguments cashes out as *measure it* — and evals are how you measure it. They're not one technique among many. They're the thing that converts the entire rest of the discipline from opinion into engineering.

## The reframe

Stop treating evals as testing you'll get to once the interesting work is done. The evals *are* the interesting work — they're the only reason any of the other work is improvable. A system without them isn't simpler or leaner; it's just unmeasured, and unmeasured means you're tuning by feel and calling the lucky outcomes skill.

So the next time someone says "that feels better," ask the only question that matters: *how do you know?* If the answer is a number from a harness you trust, you're engineering. If the answer is a shrug and a good feeling about three examples, you're decorating. The teams whose AI quietly works in production aren't the ones with the best instincts. They're the ones who stopped trusting their instincts and built the instrument that tells them the truth — and then believed it, even when it said the thing they didn't want to hear.
