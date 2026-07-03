---
title: "I Didn't Build an Agent: A GRC Copilot Case Study"
pubDate: 2026-07-07
description: "A security team needed an assistant that produces audit-ready governance, risk, and compliance work. The obvious 2026 move is 'build an AI agent' — and there already was one, an autonomous multi-agent setup that didn't work. The most important decision in rebuilding it was to stop building an agent. A case study in making the AI the smallest, most-boxed part of the system."
author: "Frank Trout"
---

A security team I worked with needed an assistant that could produce **audit-ready GRC work** — governance, risk, and compliance deliverables: risk ratings, control mappings, third-party vendor risk reviews, cloud-posture reports, client security-questionnaire responses. These are the documents that feed audits and authorizations. They have a known structure, known inputs, and a high cost of being wrong.

The obvious 2026 answer is "build an AI agent." In fact, one already existed: an autonomous, multi-agent setup — a supervisor model that chatted with sub-agents and decided its own steps. It did not work. It dropped sections, over-called, hung, truncated its own output, and ignored its own instructions. I decided to rebuild it, and the single most important decision I made was to **stop building an agent.**

I've spent a whole series of posts arguing the principles behind that decision in the abstract. This is the one where I actually did it. Everything below is a real design choice and the reason for it — and the reason is almost always the same: **every property that has to be true (completeness, correct numbers, honest citations, no hangs) is made a structural property of the code, not a behavior hoped for from the model.** The AI is the smallest, most tightly-boxed part of the system.

## The scenario, in the abstract

Picture a regulated enterprise's security team producing the same dozen deliverable *types* over and over, each one audit-facing. The work is repetitive enough to beg for automation and consequential enough that a confident wrong answer is worse than no answer — a mis-scored risk or a fabricated citation doesn't just embarrass you, it corrupts an audit trail. The optimization order the team actually needs, stated plainly, is **reliability first, output quality second, speed a distant third.** Hold that order in your head; every decision falls out of it.

## Decision 1: it's a workflow, not an agent

This is the decision the whole rebuild pivots on. The prior system treated a *workflow problem* as an *agent problem*, and that mismatch was the root cause of every failure I listed. GRC deliverables are finite, specifiable in advance, and high cost-of-error — which is the textbook case for a deterministic, code-orchestrated pipeline with the model as a constrained component, [not an autonomous agent that decides its own control flow](/blog/when-not-to-build-an-agent). You could write the steps of a risk rating on a whiteboard in two minutes; that's the tell that it was never an agent problem.

So the only place the system "decides" anything with the model is a thin classifier — one constrained call that reads the user's turn and *picks* which pipeline to run. It classifies; it never orchestrates. Everything after it is a fixed pipeline that runs to completion. That one choice bought back all the reliability the autonomous version had given away: no supervisor means no unbounded planning, no runaway tool loops, no "the agent got stuck." The flow is a finite graph that always terminates in a rendered document. [Restraint, not cleverness, was the design](/blog/simplest-agent-that-could-possibly-work).

## Decision 2: the model fills typed holes; code owns anything that must be right

Inside a pipeline, the model is only ever asked to do the irreducibly-linguistic parts — describe a threat, summarize a control, draft a rationale — and it does them by filling a small, strict schema (a defined shape, like a form with typed fields), never by writing free prose the rest of the system has to parse. Every number, every score, every risk band, every approve/disapprove decision, every tally is **computed in code** from calibration rules, with a rule trail for the audit.

The reason is the lesson from [the first guardrail I ever reach for: knowing what the model is weak at](/blog/the-first-guardrail-is-knowing-the-models-weaknesses). A model follows instructions probabilistically, so a rule that *must* hold cannot live in a prompt — it has to live in code the model can't wander away from. "The decision is Disapprove when residual risk stays Critical" is a code check, not a sentence I hoped the model would honor. And because the deliverable is assembled from typed objects, completeness is structural: the artifact *cannot* omit a required section, because the type says it's there. The model literally cannot forget the thing it's most tempted to forget.

## Decision 3: every model call is typed, deadlined, and fail-open

Each individual model call runs under a deadline with a typed fallback. If it times out, returns something invalid, or the model refuses, that one stage degrades to a clearly-marked "could not assess" placeholder — and the pipeline keeps going. It never hangs, never truncates the document, never raises an error to the user.

This is the reliability mandate made mechanical. A security team opening an audit deliverable cannot be handed a raw stack trace or a spinner that never resolves — that's the difference between [a demo that works once and a system that works on an average day](/blog/the-demo-to-production-gap). A degraded section is always *visible* (an explicit note in the output), never silently dropped, because a quietly missing section is worse than an obviously incomplete one. The prior system's crashes, hangs, and truncations weren't bugs to fix one by one; they were a whole failure class I designed out structurally.

## Decision 4: a deterministic renderer owns format and citations

There is **no model step between the finished data and the user.** A deterministic renderer takes the typed artifact and produces the final document — every table, every heading, and crucially every citation. The model never formats a citation; it cites evidence by number, and code resolves that number to a real, keyed reference at render time.

The reason is direct: [a model that writes its own citations will eventually invent or leak one](/blog/why-agents-make-things-up). In this domain, a citation that points at the wrong source, or that leaks an internal system name into an audit document, is a genuine incident. By moving citation-formatting entirely into code, that entire failure class becomes *impossible* rather than merely discouraged. The output ships verbatim from the renderer; nothing re-summarizes it, so nothing can drift.

## Decision 5: retrieval and tools are code-driven, with an audit trail

The assistant grounds its answers in the organization's own policy and standards corpus — but retrieval is a **code step that returns typed evidence**, not a model-driven "decide to search, read the results, search again" loop. Every retrieval is logged to a ledger: what was queried, what came back, and which claim in the final document cited which piece of evidence. That ledger is simultaneously the audit artifact and the thing I debug with — because [a decision is only as good as the context assembled behind it](/blog/it-will-decide-for-you-but-based-on-what), and when an answer is thin, the ledger tells me instantly whether the right source was even retrieved. Bad retrieval, not a "dumb model," is nearly always the root cause, exactly as [the quality of what you feed the system caps everything downstream](/blog/bad-data-bad-ai).

The external tools — vulnerability feeds, control catalogs, screening checks, a cloud-posture source — follow the same rule: **code calls the tool, gets a typed result, and hands that result to the model only to summarize.** The model never decides what a tool returns or whether to call it. Every tool is fail-open with a short timeout, so a source outage lowers confidence on one factor with a visible caveat instead of sinking the whole deliverable. There is exactly *one* sanctioned exception — an open-ended vendor-research step that genuinely can't be scripted in advance — and even it is bounded by a hard deadline and feeds a typed schema. [The bounded model-driven loop is reserved for the one place the steps are truly unknowable](/blog/when-not-to-build-an-agent); everywhere else, if I could specify the steps, I encoded them.

## Decision 6: authority and safety are code floors, not prompt promises

Some checks are not allowed to be probabilistic. A statutory prohibited-source screen runs in code on every relevant review *even if the live screening feed is unreachable* — the always-on floor still fires; the live feed only adds to it. When a source is down, the system marks the result degraded rather than ever silently asserting "clean," and the posture report degrades to an honest "Unknown" grade instead of a falsely reassuring "clean" one. The highest-stakes deliverable is explicitly framed as *decision support, not a decision* — it requires human sign-off.

This is [treating the grant of authority as the security decision it is](/blog/giving-an-agent-authority-is-a-security-decision). The assistant runs under a tightly-scoped identity with only the access it needs, and the actions that would be expensive to get wrong are gated behind a person. A confident wrong answer from an under-informed model is contained by design, because the model was never wired to the place where that mistake would be irreversible.

## Decision 7: evals are the regression gate

Because the deliverables have a deterministic *shape* — a decision, scores, tallies, a set of citations — I can test that shape mechanically. A golden-set of representative inputs runs the full pipeline against fixed fakes, projects each result down to its structural skeleton (the decision, the numbers, the citation indices, the evidence ids), and diffs it against a committed snapshot. A dropped mapping, a changed score, or a lost citation fails the build; a change in the model's *wording* does not.

That harness is what lets me change a prompt or a rule and *know* I didn't quietly break something three deliverables over — [it's the difference between "this feels better" and a measured result](/blog/you-cant-improve-what-you-cant-measure). It replaced the thing the previous solution was doing, which was reading sample outputs and hoping. And it's the reason adding a new deliverable is safe: the whole system is a reusable spine, so a new deliverable is a *declaration* — its schemas, its sources, its renderer — that inherits the reliability, the audit ledger, and the eval gate for free. New capability, no new agent.

## The reframe

If you scan those seven decisions, not one of them is about making the model smarter. They're about drawing a tight box around the model and building everything that *matters* — the numbers, the completeness, the citations, the safety floors, the audit trail — in deterministic code around it. The model is genuinely useful; it does the linguistic work no rule could. But it is a component, not the conductor, and every guarantee the security team actually depends on is a property of the system, not a hope pinned on the model's good behavior that day.

The instinct in the room was "build an AI agent," and the honest output of that instinct had already been built and had already failed. The thing that worked was smaller, more boring, and far more powerful for it: a deterministic system that uses AI in a handful of tightly-bounded places, and can prove — line by line, citation by citation — exactly why it produced what it produced. I didn't build an agent. I built the workflow the problem was asking for all along, and let the model do only the part that genuinely needed a model. In a domain where being wrong is expensive, that's not a compromise. It's the whole point.
