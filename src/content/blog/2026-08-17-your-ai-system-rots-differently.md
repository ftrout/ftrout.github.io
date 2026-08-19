---
title: "Your AI System Rots Differently"
pubDate: 2026-08-17
description: "Ordinary software decays loudly — the build breaks, the dependency throws, the scanner files a ticket. An AI system decays silently, while passing every test it has, because the component underneath it changes and the world it reasons about moves and neither event produces an error. Five rot mechanisms, and the maintenance calendar they demand."
author: "Frank Trout"
---

Normal software rots in ways you can't miss. A dependency goes end-of-life and the scanner files a ticket. An API you call changes its shape and the integration throws. A certificate expires at 2 a.m. and everyone finds out simultaneously. It's unpleasant, but it's *loud* — the decay generates an event, the event generates a ticket, and maintenance is a thing you do in response to a signal.

AI systems rot too. They just don't tell you. The model underneath changes behavior, your retrieval corpus drifts away from the world it describes, the prompt fills with instructions written for a model that no longer exists, and the whole time the system keeps producing fluent, confident, well-formatted output. Nothing throws. Nothing fails a build. The dashboards stay green because the system is up, and up was never the thing in question.

**In ordinary software, decay announces itself. In an AI system, every decay path is silent by construction — so maintenance can't be triggered, it has to be scheduled.** That's the whole argument, and the rest of this is the five ways it happens and what a calendar for it looks like.

## Rot 1: the model moves under you

You built and tuned against a specific model. That model is a moving target in two different ways, and both of them are invisible from inside your app.

The obvious one is deprecation: the version you pinned reaches end-of-life, you're forced to migrate, and the new model — even at the same API surface, even from the same vendor — behaves differently. Not worse. *Differently.* It's more or less verbose, more or less eager to use tools, more or less literal about your instructions. Everything you tuned was tuned against the old behavior, so a migration is a **behavior change wearing a version bump**, and treating it as a routine dependency upgrade is how teams ship a quiet regression across every feature at once.

The subtler one is that a prompt is a fit to a specific model's tendencies. Every "be more thorough" you added because the old model was terse, every emphatic rule you added because it under-triggered — those were corrections calibrated to a particular set of failures. Point them at a model that doesn't have those failures and the correction over-applies. Your careful tuning becomes noise, or worse, active mis-steering.

The habit that handles it: **pin the model version in production and let development float.** I landed on exactly this rule [testing the Foundry Toolbox](/blog/the-foundry-toolbox) — pin in prod, float in dev — and it generalizes cleanly. Then treat every model change as a release with a gate in front of it: run the eval suite on both versions, diff the results, and re-baseline before you cut over. Never inherit a model change as a background event.

## Rot 2: the prompt accumulates cruft

Prompts grow by ratchet. Every incident adds a line and nothing ever removes one, because removal feels risky and addition feels responsible. Two years in, the system prompt is a sedimentary record of every failure anyone ever had, most of them on models that have since been retired.

This isn't just wasted tokens, and that's the part people miss. [Current models follow instructions more literally than the models most of that text was written for](/blog/the-prompt-still-matters), so dead instructions don't sit inertly — they steer. And [past a point, more instructions make each individual instruction less reliably followed](/blog/the-first-guardrail-is-knowing-the-models-weaknesses), so the accumulated pile actively degrades adherence to the three rules you actually care about.

The maintenance move is a scheduled **prompt audit** with one question asked of every line: *which failure, on which model, did this prevent — and does that failure still reproduce?* Anything nobody can answer for is a removal candidate; anything traceable to a retired model is a presumptive delete. Then test the removal rather than assuming it. The discipline that makes this safe is the same one that makes any refactor safe: you need the suite before you start cutting.

Keep what only you know — your policy, your audience, your quality bar, the *reasons* behind your constraints. Delete what the model already knows. That line is the whole audit.

## Rot 3: the data drifts

Your retrieval corpus was accurate the day you indexed it. Since then the policy changed, the product was renamed, three documents were superseded and none were deleted, and the org chart moved. Retrieval faithfully surfaces the stale version, the model faithfully grounds its answer in it, and it attaches a citation — which makes the answer look *more* trustworthy, not less. [Bad data, bad AI](/blog/bad-data-bad-ai), arriving on a delay.

The same rot hits anything you chose to remember. [A remembered fact is a cached copy with no invalidation strategy](/blog/your-agent-doesnt-have-memory) — "customer tier: enterprise" was true in March and the downgrade happened in May, and nothing in your system has an opinion about that. The defense is provenance and freshness on every stored fact, plus an expiry, plus the standing preference for reading live state over remembering it.

The tell that you have this problem: answers that were right six months ago and are subtly wrong now, with no code change in between. If you can't currently distinguish "we never indexed that" from "we indexed the version that was true last year," you have this problem and haven't found it yet.

## Rot 4: the eval set rots — and it's the instrument

This is the one that should worry you most, because it's the thing you'd use to detect the other four.

An eval suite ages in three directions at once. Its **cases** stop representing what users actually send, because the product changed and the users learned. Its **golden answers** go stale, because the correct answer to "what's our refund window" is a fact about a world that moves. And most insidiously, you have been **tuning against it** for months, so you've been fitting to a test that no longer represents reality — the score goes up while quality goes sideways, which is the exact failure mode of teaching to the test.

[I've argued you have to measure the measurer](/blog/you-cant-improve-what-you-cant-measure), and this is that argument on a calendar. Refresh the golden set on a cadence. Keep a held-out slice you never tune against, and rotate what's in it. Add every production surprise as a case the week it happens — that's the flywheel that keeps the suite anchored to reality instead of to its own history.

And if you use an LLM judge, it rots twice over: the judge model changes underneath you *and* your rubric ages. [Re-calibrate it against human labels whenever anything moves](/blog/the-prompt-still-matters) — new judge model, new rubric, new task mix. An uncalibrated judge that used to be calibrated is worse than one you never trusted, because you've built a year of decisions on its numbers.

## Rot 5: the inputs change

The last one comes from outside and nothing in your stack can see it.

Users learn what your system is good at and change how they ask — which shifts the task distribution away from everything you designed and measured against. New user cohorts arrive with different assumptions. And in any adversarial setting, the other side is actively learning too: [the text people write into fields your model reads](/blog/giving-an-agent-authority-is-a-security-decision) evolves specifically because your system exists.

This is the rot with the least available signal, and it's the reason [offline evals aren't sufficient on their own](/blog/you-cant-improve-what-you-cant-measure). A fixed dataset, however good, is a snapshot of the inputs you could imagine at the moment you built it. You need online measurement — sampling real traffic, scoring it, watching for drift — because the only reliable early warning that the world moved is the world's own traffic.

## Why all of this is quiet

Step back and the common thread is the thing that makes AI systems strange in the first place. [Every other component in your stack fails honestly](/blog/the-llm-is-not-a-function-call) — it crashes, it errors, it returns nothing. The model doesn't. When it's operating on a stale document, a mis-aimed instruction, or a distribution it wasn't built for, its output looks exactly like its output when everything is fine: fluent, confident, plausible. [The failure mode has no error state](/blog/why-agents-make-things-up).

So the usual maintenance model — wait for the signal, respond to the ticket — has nothing to respond to. There is no ticket. There is a slow decline in a quality nobody is currently measuring, discovered eventually by a customer, and attributed to "the AI getting worse," which is a sentence that has never once been technically accurate.

## The rot calendar

Concretely, then. Maintenance you schedule rather than await:

| Cadence | What you do |
| --- | --- |
| **Continuous** | Online quality sampling on real traffic; cost and latency distributions; the tail, not the mean |
| **Every change** | Full eval suite before merge — prompt, retrieval, tool, or model. No exceptions for "it's just a wording tweak" |
| **Monthly** | Add the month's production surprises to the golden set; review the online-vs-offline gap |
| **Quarterly** | Prompt audit (the provenance question on every line); refresh and rotate the held-out set; re-calibrate the LLM judge against fresh human labels |
| **On any model change** | Re-baseline both versions on the suite, diff, re-tune the prompt for the new model's tendencies, then cut over |
| **Annually** | Re-ask the founding question: is this still the right shape? Would this be a workflow now? Does it still need a model at all? |

That last row earns its place more often than you'd think. Systems built as agents when the problem was genuinely open-ended sometimes become specifiable as the domain gets understood — and at that point [the honest move is to take the control flow back](/blog/when-not-to-build-an-agent). Rot isn't only decay. Sometimes it's your understanding improving past the architecture you committed to.

## The reframe

Software maintenance is reactive because software failures are loud. AI maintenance has to be proactive because AI failures are quiet — and the gap between those two operating models is where a working system slowly becomes an embarrassing one, without a single alert firing.

So put it on the calendar. Not because anything is broken, but precisely because nothing will *appear* broken until someone external notices. Re-run the suite. Audit the prompt. Refresh the golden set. Re-calibrate the judge. Diff the new model against the old one before you're forced onto it. It is unglamorous, recurring, unbillable-looking work, which is the same description that fits [evals](/blog/you-cant-improve-what-you-cant-measure), [data quality](/blog/bad-data-bad-ai), and [operational maturity](/blog/you-havent-earned-aiops-yet) — and by now the pattern is hard to miss. The parts of this field that decide whether a system is any good in year two are all the parts that don't demo.

The AI system quietly working a year from now won't be the one built on the best model. It'll be the one somebody kept measuring after everyone stopped watching.
