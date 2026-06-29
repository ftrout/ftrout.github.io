---
title: "The Simplest Agent That Could Possibly Work"
pubDate: 2026-06-07
description: "A mental model for agent design: diagnose the gap, then reach for the cheapest layer that closes it. On single agents, prompts vs. knowledge, skills, agents-as-tools — and earning every bit of complexity you add."
author: "Frank Trout"
---

There's a moment in every agent project where someone says "what if we had a second agent for that?" It always sounds reasonable. It almost never is — at least not yet.

Complexity is seductive because each individual addition feels justified. A router (a step that decides which path a request should take) here, a sub-agent (a second AI doing part of the work) there, a tool to wrap the sub-agent, a workflow to orchestrate — coordinate — the whole thing. Every step is locally sensible and the sum is a system nobody can debug at 2 a.m. The discipline that separates agents that ship from agents that sprawl isn't cleverness. It's restraint.

This post is about that restraint — and a mental model for practicing it without just vibes.

## The one-sentence model

Here it is, and the rest of the post is commentary:

> **Diagnose the gap, then reach for the cheapest layer that closes it.**

When an agent underperforms, the instinct is to add structure. But "add structure" is not a diagnosis. The right move depends entirely on *what kind* of gap you're looking at, and the layers — prompt, knowledge, skill, tool, second agent — are not interchangeable. A prompt fixes a different problem than knowledge does; knowledge fixes a different problem than a tool does; a tool fixes a different problem than a second agent does. Pick the wrong layer and you've added cost without closing the gap — and now you have two problems.

So before you build anything, name the gap.

## Why simple wins (the part people skip)

Every layer you add is a tax you pay forever, on four axes:

**Latency and cost.** More calls, more tokens (the chunks of text the model is billed by), more models in the mix means more waiting and more money. A multi-agent system can be several times the cost and several times the wait — the *latency*, the delay before you get an answer — of a single well-prompted call, for a quality bump that's sometimes zero.

**Failure surface.** Each hop is a place errors compound. A 95%-reliable step is fine alone; chain five of them and you're at ~77%. Autonomy multiplies this — the longer the agent runs unsupervised, the more a small early mistake snowballs.

**Debuggability.** When a single agent gives a bad answer, you read one prompt and one trace (the recorded log of what the agent actually did). When an orchestrator-worker-evaluator pipeline — one agent directing others and a third grading the result — gives a bad answer, you're picking through a sprawling multi-part system to find which hand-off corrupted the state.

**Opacity.** Frameworks and extra layers tend to hide the actual prompts and responses underneath — you stop being able to see the exact text going to and from the model. Most "the model is dumb" bugs are really "the prompt the model received wasn't the prompt I thought I wrote" bugs — and that hidden machinery makes those harder to see.

The payoff for simplicity isn't aesthetic. A simple system is one you can actually evaluate, trace, and improve. Those are the activities that make an agent good. Complexity quietly steals the time you'd spend on them.

None of this means "never add complexity." It means complexity should be *earned* — added in response to a measured failure, not anticipated in case you might need it.

## The ladder: what kind of gap is it?

Here's the diagnostic. The layers are roughly ordered cheapest-to-most-expensive, and the trick is to start at the top and only descend when the rung above genuinely can't close the gap.

| The gap looks like… | The layer that closes it |
| --- | --- |
| It *behaves* wrong — wrong tone, skips steps, ignores a rule | **Prompt** (the instructions you give it) |
| It doesn't *know* a fact — about your domain, docs, or this user | **Knowledge** (retrieval — looking facts up and feeding them in) |
| It can't reliably *perform a repeatable procedure* | **Skill** (a packaged how-to) |
| It can't *reach the world* — live data, an action, computation | **Tool** (a way to act outside its own head) |
| One context is *juggling two jobs* and doing both worse | **Agent-as-tool** (a second AI with one narrow job) |
| You need *orchestration* — ordering, gates, parallelism, approvals | **Workflow / multi-agent** (a fixed, coordinated sequence) |

Most problems — more than people expect — are solved in the top two rows. Let's look at the distinctions that actually trip people up.

If you want the principle made concrete, I put a [runnable worked example on GitHub](https://github.com/ftrout/ftrout.github.io/blob/main/examples/three-tier-support/support_tiers.py): the same customer-support task built three ways — plain deterministic code, a single LLM call, and a full agent loop — with a router that sends each request to the cheapest tier that can handle it. It's this ladder collapsed to its three load-bearing rungs, in about 150 lines of Python.

## Prompt vs. knowledge: *how* vs. *what*

This is the most common confusion, and it's worth getting crisp.

A **prompt** governs *how the agent behaves*: its role, its rules, its reasoning style, the shape of its output. **Knowledge** supplies *what the agent knows*: facts, documents, the current state of your domain — fetched and pasted in at the moment it's needed (this fetching is what people mean by *retrieval*).

The failure mode in both directions is treating one as the other:

- **Pasting a knowledge base into the prompt.** A *knowledge base* is just your collection of reference material — policy documents, product catalogs, FAQs. People dump all of it into the system prompt (the standing instructions sent on every single call) because the agent "needs to know" them. Now every call drags that whole payload along, the truly important instructions get diluted in the noise, and updating a fact means re-shipping a prompt. Facts belong in retrieval, fetched on demand, where they can change without touching behavior.
- **Trying to retrieve your way to better behavior.** The opposite error: the agent is rude or skips a verification step, so someone adds more documents. But no amount of retrieved context fixes a behavior problem. That's a prompt edit.

The clean test: *if the right answer changes when your data changes, it's knowledge. If the right answer changes when your rules change, it's prompt.* Keep them in separate homes and both stay maintainable.

## Skills vs. prompts: progressive disclosure

If knowledge is "what it knows," a **skill** is "a procedure it knows how to run" — a packaged, reusable set of instructions (and sometimes scripts or resources) for a specific repeatable task: how we format a contract review, the steps for reconciling an invoice, our house style for a release note.

Why not just put all of that in the prompt? Because a prompt that contains every procedure the agent might ever need is enormous, expensive on every call, and — counterintuitively — *less* reliable. A model swamped with instructions it doesn't need right now follows the ones it does need less well.

The better mental model is **progressive disclosure** — showing the model only what it needs for the task in front of it, not everything at once: keep the base prompt lean and general, and load a skill only when the task at hand calls for it. The agent pulls in the contract-review procedure when it's reviewing a contract, and leaves it on the shelf otherwise. You get the benefit of a detailed, battle-tested procedure without paying for it on every unrelated turn — and you can version and improve that procedure in one place instead of hunting through a monolithic prompt.

So: prompt for the standing behavior that's always true; skill for the detailed procedure that's only sometimes relevant.

## Tools: when the gap is *reach*, not knowledge

A **tool** is for when the agent's limitation isn't what it knows or how it behaves, but that it *can't do the thing from inside its own head*: look up a live price, send the email, run the calculation, query the database.

The restraint principle applies hard here. Two guidelines that save the most pain:

**Prefer the dumbest tool that works.** If a plain function or API call (a request to another system) does the job *deterministically* — same input, same output, every time — use that. Don't reach for a reasoning sub-agent when a simple lookup suffices. Deterministic beats *probabilistic* (the model's roll-of-the-dice guessing) whenever you can get away with it.

**Treat the tool interface like a prompt.** The single highest-leverage thing in tool design is the description and parameters — the inputs — that the model sees. A tool with a vague name and a fuzzy spec gets misused; a tool with a clear contract, good parameter names, and an example gets used flawlessly. Spend as much care on the *agent*-facing interface as you would on a human-facing one — and then keep the toolset small. Ten well-described tools beat thirty overlapping ones; the model spends its attention choosing well instead of choosing at all.

## Agents as tools: the disciplined version of multi-agent

Eventually you hit a real gap that a tool can't close: a *sub-task that itself requires reasoning*. Summarizing a messy document. Critiquing a draft. Researching an open-ended question. A function can't do that — it needs a model.

This is the right place for a second agent, and the key reframe is the phrase itself: **agent as a *tool***. You're not building a committee of peers chatting until consensus emerges. You're giving your one main agent a capability that happens to be powered by another model, with a clean interface, a narrow job, and a defined output. From the caller's perspective it's just another tool.

That framing keeps multi-agent honest. It forces each sub-agent to have one crisp responsibility and a defined input and output you can test on its own, instead of a vague "helper" that makes the system harder to reason about. It also naturally limits how much damage a mistake can do: a sub-agent that summarizes can't suddenly decide to take an action, because all it returns is a summary.

The thing to resist is the leap straight to a many-agent free-for-all because it sounds powerful. A single agent with two or three well-scoped agent-tools is almost always easier to operate — and usually just as capable — as an elaborate swarm.

## Workflows: when you need the path *pinned down*

The top of the ladder is orchestration — coordinating multiple steps or agents — and it splits in a way worth naming. If you need a model to *decide the steps on the fly*, that's still the agent world (one agent calling agent-tools as it sees fit). If instead you need the steps **fixed, ordered, gated, or run in parallel** — with human approvals, audit trails (records of what happened, for later review), business-rule enforcement — that's a **workflow**: predefined paths, not model-directed ones.

Reach for a workflow when predictability and auditability matter more than flexibility: an approval chain, a compliance pipeline, a multi-stage ETL (a data-processing pipeline that extracts, transforms, and loads information). Reach for an agent when you genuinely can't predict the steps in advance. Using a workflow where one good prompt would do is over-engineering; using a free-roaming agent where you needed a guaranteed, auditable sequence is under-engineering. Most teams err toward the first.

## So when *do* you add complexity?

When you have evidence — not a hunch — that the simpler rung has failed.

Concretely, that means you've already done the unglamorous work: you have an evaluation setup — *evals*, a set of automated checks that score the agent's output on the things that matter (did the agent understand the request? did it pick the right tools with the right inputs? did the final answer stay faithful to the task?) — and you can see that no amount of prompt-and-knowledge refinement moves the number. *That's* the signal to descend a rung. Not "this would be cool." Not "what if it scales." A measured ceiling.

This is the same discipline at every level. Prompt not enough? Prove it, then add knowledge. Single agent plateaued? Prove it, then split off an agent-tool. That evaluation harness — the evals again — is what converts "I feel like we need more" into "the data says this specific gap needs this specific layer." Without it, you're just decorating.

## The checklist

When you're tempted to add a layer, run the questions in order and stop at the first "yes":

1. Is this a **behavior** problem? → Fix the prompt.
2. Is it a **missing-fact** problem? → Add knowledge (retrieval), don't bloat the prompt.
3. Is it a **repeatable-procedure** problem? → Package a skill, loaded on demand.
4. Does it need to **reach or act on the world**? → Add a tool — the simplest one that works, with a great interface.
5. Is a **reasoning sub-task** dragging down the main job? → Add one narrow agent-as-tool.
6. Do you need a **fixed, gated, auditable path**? → Build a workflow.

And underneath all of it, the one rule: *the best system isn't the most sophisticated one, it's the right one.* Start with one agent and a sharp prompt. Make it observable — so you can actually see what it's doing on each run. Measure it. Then — and only then — earn the next layer.

The agents that quietly work in production a year from now won't be the most elaborate ones. They'll be the ones whose builders kept asking "do I actually need this?" — and were honest about the answer.
