---
title: "The Strengths and Weaknesses of Skills — and When to Use Them"
pubDate: 2026-07-10
description: "A skill is a delivery mechanism for reusable procedural know-how, loaded on demand — not new capability, and not a guarantee. Used for the right gap it's a genuine win for context efficiency and maintainability. Reached for the wrong one, it's premature abstraction or a false sense of enforcement. The honest strengths, the real weaknesses, and how to tell which gap you've got."
author: "Frank Trout"
---

I keep writing the same kind of post: [when to build an agent and when not to](/blog/when-not-to-build-an-agent), [when low-code is the right call and when it's a trap](/blog/when-low-code-is-the-right-call). The shape is always "here's a tool everyone treats as universally good or universally suspect, and here's the honest line between where it fits and where it doesn't." Skills deserve the same treatment, because they get it from both directions: some teams package everything into a skill on reflex, and others never reach for one when they clearly should.

I did a careful [read-through of what skills actually are once before](/blog/microsoft-agent-framework-skills), so I'll keep the definition short here and spend the words on the decision. **A skill is a packaged, reusable unit of procedural know-how — instructions, reference material, sometimes scripts — that an agent loads *only when the task calls for it*.** That last part, loading on demand rather than carrying everything all the time, is called **progressive disclosure**, and it's the whole point. The base prompt (the standing instructions the model always sees) stays lean; the detailed procedure for "how we review a contract" shows up only when there's a contract to review.

Here's the thesis, and everything below is commentary: **a skill is a *delivery mechanism* for know-how, not a new capability and not a guarantee.** It doesn't teach the model to do something it fundamentally couldn't; it packages a procedure you already have so it's reusable and loaded at the right moment. Get that straight and both the strengths and the weaknesses fall right out of it.

## What skills are genuinely great at

The affirmative case is real, and it's mostly about *context* and *maintenance* — two things I care about disproportionately because they're where systems quietly rot.

**Progressive disclosure is the headline.** A prompt that contains every procedure the agent might ever need is enormous, expensive on every single call, and — counterintuitively — [*less* reliable, because a model swamped with instructions it doesn't need right now follows the ones it does need worse](/blog/the-first-guardrail-is-knowing-the-models-weaknesses). A skill lets you keep the base lean and pull in the detailed procedure only when it's relevant. That's [context engineering as a first-class concern](/blog/context-engineering-is-the-job): the window is a budget, and a skill is a way to spend it only when the spend pays off.

**One source of truth for a procedure.** Without skills, "how we reconcile an invoice" gets copy-pasted into five prompts that immediately begin drifting apart, and improving the procedure means hunting through all five. A skill is *one* versioned, improvable definition. Fix it in one place, every caller gets the fix. That's the same maintainability win that functions gave us over copy-pasted code, applied to procedural instructions.

**Portability and packaging.** Because a skill is a self-contained artifact in an open format, it travels — across agents, across projects, across teams. The hard-won, battle-tested "how we actually do this" stops being tribal knowledge trapped in one person's prompt and becomes a thing you can hand someone.

When your gap is "the agent knows *what* to do but performs a detailed, repeatable procedure inconsistently or verbosely," a skill is often exactly right — and reaching for something heavier is over-engineering.

## Where skills are weak (and where people get burned)

Now the other side, because a delivery mechanism has limits baked into what it is.

**A skill is still instructions — followed probabilistically.** This is the big one. Packaging a procedure more elegantly does not make the model *obey* it; a skill is a better-delivered prompt, not an enforcement mechanism. The model follows a skill's steps most of the time, in proportion to how clearly they're written and how much else is competing — [the same probabilistic adherence every instruction gets](/blog/the-first-guardrail-is-knowing-the-models-weaknesses). If a step *must* happen, it belongs in code, not in a skill you hope gets followed.

**Loading the right skill is itself a decision the model makes.** Progressive disclosure has a cost: something has to decide *which* skill to pull in and *when* — usually the model, reading each skill's description. That's another probabilistic routing choice that can misfire: the perfect skill exists and never gets loaded, or the wrong one does. Which means a skill's description isn't documentation, it's [an interface the model reads to make a decision](/blog/the-tool-is-the-interface), and a vague one quietly breaks the whole mechanism.

**Premature abstraction.** Packaging a one-off as a reusable skill is overhead you pay forever for reuse that may never come. If a procedure is used once, or rarely, or is trivial, a skill is ceremony — just put it in the prompt or the task. Earn the abstraction with a real, recurring need; don't build the library on spec.

**Sprawl.** A pile of overlapping, half-owned, stale skills is its own failure mode — the model spends its attention choosing among near-duplicates instead of doing the work, and nobody's sure which is canonical. Skills need curation and ownership, or they rot the same way an over-large toolset or a field of ungoverned low-code bots does.

**Third-party skills are a supply-chain decision.** A skill can carry instructions and even scripts from outside your trust boundary. Handed to an agent that holds real access, that's [a grant of authority, and authority is a security decision](/blog/giving-an-agent-authority-is-a-security-decision) — with the added twist that the "code" here includes natural-language instructions that could be adversarial. Vet an external skill like a dependency: trust, review, least privilege.

**A skill doesn't add reach or facts.** This is the one people most often get wrong. If the gap is "the agent can't *act* on the world" or "it doesn't *know* a live fact," a skill won't help — that's a tool or retrieval. A skill is know-how, and know-how only fixes a know-how gap.

## When to reach for one — and when not to

Put it on the ladder I keep coming back to. Diagnose the gap first, then pick the layer:

| The gap is… | The right layer |
| --- | --- |
| Wrong standing behavior (tone, always-on rules) | **Prompt** — always loaded |
| A detailed, repeatable *procedure* used only sometimes | **Skill** — loaded on demand |
| A missing *fact* about your domain or this moment | **Knowledge / retrieval** |
| Can't *reach or act on* the world | **Tool** |
| Something that *must* be guaranteed | **Code** |

**Reach for a skill when** the gap is a repeatable procedure, it's detailed enough that inlining it in the base prompt would tax every turn, and it's reused (or reusable) and stable enough to be worth versioning. That's the sweet spot: recurring, procedural, sometimes-relevant know-how.

**Don't reach for a skill when** the procedure is a one-off (put it in the prompt), the thing must be guaranteed (code), the gap is missing facts (retrieval) or missing reach (a tool), or you're really trying to fix a behavior a one-line prompt edit would fix. And pump the brakes entirely on an untrusted third-party skill with scripts until it's been through a security review.

## How to use them well

If it clears the bar, a few habits keep skills an asset instead of a liability:

- **Write the description like a tool description**, because functionally it is one — it's what the model reads to decide whether to load the skill. Vague trigger, unloaded skill.
- **Keep each skill narrow and single-purpose.** A small set of sharp, non-overlapping skills beats a sprawling library the model has to disambiguate.
- **Version and own them.** One source of truth, improved in one place, with someone accountable for it.
- **Put guarantees in code, procedure in the skill.** Never ask a skill to enforce what only code can hold; let it carry the *how*, and let code carry the *must*.
- **Govern third-party skills like dependencies** — trust boundary, review, least privilege.

## The reframe

A skill is one of the cleaner ideas in agent design, and most of the ways it goes wrong come from expecting it to be something it isn't. It is not a capability the model was missing; it is not a rule the model will now obey; it is not free just because it's easy to make. It's a way to *deliver reusable procedural know-how to the model at the moment it's relevant, and maintain that know-how in one place.* For that job it's excellent, and reaching for a bloated prompt or a bespoke tool instead is a mistake.

So run the same test I run on everything else: what's the actual shape of the gap? If it's a recurring, detailed procedure that only sometimes applies, a skill is the right call and you should use it with a clear conscience. If it's a fact, a reach, a one-off, or a guarantee, a skill is the wrong shape — and dressing the problem up in a tidy package won't change what it needs. Skills are a genuinely good tool. They're just a tool, with a shape — like everything else on the stack.
