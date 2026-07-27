---
title: "Agent Frameworks Aren't Interchangeable: Every One Is an Opinion"
pubDate: 2026-07-24
description: "\"Which agent framework should we use?\" is the wrong question, asked as though one of them wins. Each was built to solve a different original problem, and that origin is baked into its shape — graphs, crews, handoffs, pipelines, minimal loops. A field guide to matching the framework to the shape of your problem, and to why it's the least important decision you'll make."
author: "Frank Trout"
---

Someone asks it in every AI project, usually in week one, usually before anyone has agreed on what the thing is supposed to do: *which agent framework should we use?* And it's always asked the way you'd ask which database or which web framework — as though there's a leaderboard, a current champion, and a right answer you can look up.

There isn't, and the reason isn't that they're all equally good. It's that they aren't the same *kind* of thing. **Every agent framework is an opinion about orchestration — a set of assumptions about how work should be decomposed, who decides what happens next, and what a "step" even is — and that opinion comes directly from the problem the framework was originally built to solve.** They're not competing implementations of one idea. They're different shapes. So the useful question isn't "which is best," it's the same one I keep asking about [agents](/blog/when-not-to-build-an-agent), [low-code](/blog/when-low-code-is-the-right-call), and [skills](/blog/the-strengths-and-weaknesses-of-skills): *what's the shape of my problem, and which tool matches it?*

One caveat before I start naming names: this space moves faster than almost anything else in software. What follows is a snapshot from mid-2026, and I've deliberately written it around **origins and shapes** rather than feature checklists — because features change every quarter, and a framework's underlying shape almost never does. If you're reading this a year out, trust the shapes and re-check the details.

## Why they're different: everything grew from a different first problem

Frameworks don't emerge from a neutral survey of the design space. Someone had a specific problem, built something to solve it, and generalized outward — and the fingerprints of that first problem never wash off. This is the whole reason a framework can feel effortless on one project and like wading through mud on the next: you're either working with its native shape or against it.

A framework born from "how do I coordinate a conversation between several AI personas" ends up with conversation as its primitive. One born from "how do I express a reliable, resumable, branching process" ends up with the graph as its primitive. One born from "how do I make my company's existing enterprise stack AI-capable" ends up with plugins, middleware, and telemetry as first-class citizens. None of them is wrong. They're answers to different questions, and you inherit the question when you adopt the answer.

## The field, by native shape

Here's how I actually think about the major options — not as a ranking, but as a set of shapes.

**The graph.** *LangGraph* is the clearest example: you model your agent as an explicit graph of nodes and edges, with state that persists, execution that can be checkpointed and resumed, and defined points where a human can step in. Its native shape is **a process you want explicit control over** — complex branching, error handling, long-running work, approval gates. It's the most common answer for teams who tried a looser framework, got burned by unpredictability, and wanted the control back. The cost is ceremony: you're writing more structure up front, and for a straight-line task that's overhead you didn't need.

**The crew of roles.** *CrewAI* models work as a team of agents with roles, goals, and assigned tasks — a researcher, a writer, a reviewer. Its native shape is **work that genuinely decomposes along human-role lines**, and it gets you there with less boilerplate than anything else in the multi-agent category. That's a real strength for prototypes and for problems that actually are role-shaped. The trap is that the role metaphor is *seductive* — it's easy to model something as a crew because it reads nicely on a diagram, not because the work decomposes that way. If your "crew" always runs in the same order, [you had a workflow, not a team](/blog/multi-agent-when-its-actually-worth-it).

**The handoff.** The *OpenAI Agents SDK* (the production successor to the experimental Swarm) builds around agents that explicitly hand control to one another, carrying context across the transition, with tight integration into that provider's hosted tools — file search, web search, computer use. Its native shape is **triage and delegation**: a front-line agent that routes to a specialist. It's lightweight and pleasant, and the hosted-tool integration is genuinely a shortcut. The tradeoff is the obvious one: it's provider-first, which is a lock-in and — for regulated work — a data-boundary question, not just a procurement one.

**The enterprise pipeline.** *Microsoft Agent Framework* is the merged successor to Semantic Kernel and AutoGen, which reached 1.0 in April 2026, with both predecessors moved to maintenance mode. (If you're running either, that migration is now a real item on your roadmap — [I wrote about that ecosystem back when it was still two things](/blog/building-effective-agents-on-foundry).) Its shape is the inheritance showing: AutoGen's agent abstractions plus Semantic Kernel's enterprise machinery — state, type safety, middleware, telemetry — with graph-based workflows layered on for explicit orchestration. Its native shape is **the enterprise .NET or Python shop** that needs the boring things (observability, governance, identity, first-class support) more than it needs the newest idea. That's not a knock; those boring things are exactly what [production actually demands](/blog/the-demo-to-production-gap).

**The cloud-native.** *Google's ADK* and *AWS's Strands* are, in different ways, the same story: frameworks that are pleasant and well-integrated inside their own cloud, and progressively less so outside it. ADK leans on multimodal work and interoperability; Strands is smoothest against its native cloud's model and tooling stack. If your infrastructure, identity, and data already live in one of those clouds, that gravity is a legitimate reason to choose — a lot of the integration pain you'd otherwise hand-build is simply gone. If you're multi-cloud or cloud-agnostic, that same gravity is the thing you'll be fighting.

**The type system.** *Pydantic AI* comes at agents from the direction of validation and type safety, which is a genuinely different instinct: get the contracts right and let the orchestration stay thin. Its native shape is **Python teams who care more about structured, validated output than about elaborate multi-agent choreography** — and given how much reliability work is really [forcing a probabilistic thing back into a shape your code can trust](/blog/the-llm-is-not-a-function-call), that instinct earns its place.

**The data layer.** *LlamaIndex* grew up as retrieval infrastructure and extended into agents. Its native shape is **agents whose center of gravity is your data** — heavy retrieval, document pipelines, knowledge work. If your hard problem is [getting the right information in front of the model](/blog/agentic-vs-boring-retrieval), starting from the data side rather than the orchestration side is a defensible way in.

**The minimal loop.** There's a whole category of small libraries that deliberately do almost nothing — a tight agent loop, minimal abstraction, out of your way — and at the far end of it, writing the loop yourself. Native shape: **a single agent, a few tools, and no appetite for ceremony.** Underrated, especially for the large number of projects that are one loop and three tools wearing a trench coat.

**The vendor-native SDK.** Anthropic's *Claude Agent SDK* and its peers give you the harness the vendor themselves built for long-running, tool-using, autonomous work — heavily shaped by coding and computer-use scenarios. Native shape: **you're building on that model anyway and want the scaffolding its makers found necessary.** Same lock-in tradeoff as any provider-first choice, in exchange for the tightest possible fit.

## A rough map

| If your problem is… | The shape you want |
| --- | --- |
| A branching process needing control, resumability, approvals | **Graph** |
| Work that genuinely splits along role lines | **Crew** |
| Triage and routing to specialists | **Handoff** |
| Enterprise stack, governance, observability, support | **Enterprise pipeline** |
| Already all-in on one cloud | **Cloud-native** |
| Structured, validated outputs above all | **Type system** |
| Retrieval-heavy, data-centric work | **Data layer** |
| One agent, a few tools, no ceremony | **Minimal loop** |

## The axes that actually decide it

Once you know your shape, a few practical axes usually settle the rest — and none of them is "which had the best demo."

**Provider lock-in and the data boundary.** Provider-agnostic frameworks let you swap models as prices and capabilities move; provider-first ones trade that for tighter integration. For most teams this is an economics question. In regulated environments it's a *security* question — where the data goes and whose boundary it crosses — and it should be answered by the people who own that risk, not settled by whoever prototyped fastest.

**Control versus speed.** The frameworks that get you running in an afternoon are the ones that made orchestration decisions on your behalf. That's a fair trade when the decisions match your problem, and a slow-motion disaster when they don't and you spend the next quarter fighting the abstraction.

**Durability and human-in-the-loop.** If your work is long-running or touches anything irreversible, checkpointing, resumability, and native approval gates stop being nice-to-haves. [Anything consequential needs a human in the path](/blog/giving-an-agent-authority-is-a-security-decision), and a framework that treats that as an afterthought will make you build it yourself.

**Observability.** You cannot debug what you cannot see, and [you cannot improve what you cannot measure](/blog/you-cant-improve-what-you-cant-measure). Whether a framework exposes per-step traces — the actual context in, decision out, tool result back — matters more day-to-day than any orchestration feature on the box.

**Language and ecosystem.** Most of this is Python-first; .NET and JVM shops have real but narrower options. Match your team, not the blog posts.

**Escape hatches.** The most honest question to ask of any framework: *when it doesn't do what I need, how hard is it to drop below the abstraction?* [The same question I ask of low-code](/blog/when-low-code-is-the-right-call), and the answer predicts your worst week with the tool.

## The part nobody wants to hear: it's the least important decision

Here's where I break with the framing of most framework comparisons, including the ones that sent you looking for this post.

**The framework is scaffolding around the model, and it is not what determines whether your project works.** [The harness matters enormously](/blog/the-model-is-the-hazard-the-harness-is-the-exposure) — but the *framework* is only one part of the harness, and it's the most replaceable part. What actually decides outcomes is the stuff no framework picks for you: whether your data is trustworthy, whether you [assemble the right context each turn](/blog/context-engineering-is-the-job), whether your [tool interfaces are clear enough for a model to use well](/blog/the-tool-is-the-interface), whether you have [evals](/blog/you-cant-improve-what-you-cant-measure), whether authority is scoped. I have never once seen a project fail because it picked the second-best framework. I've seen plenty fail on every item in that list.

There's a corollary worth stating plainly: **you may not need a framework at all.** [An agent loop is genuinely about fifteen lines of code](/blog/the-loop-at-the-heart-of-every-agent) — call the model, run the tool it asked for, append the result, repeat, with a bound. If your problem is one agent and a handful of tools, hand-rolling that loop gives you total visibility and nothing to fight, and it's a legitimate engineering choice rather than a failure to adopt. On the project I've written most about, [the right answer wasn't a framework's agent abstraction at all](/blog/i-didnt-build-an-agent) — it was a deterministic pipeline with the model boxed into typed stages, because the problem was specifiable and the cost of error was high. And the standardization of the tool layer through [MCP](/blog/mcp-the-good-the-bad-and-the-ugly) is quietly making frameworks *less* load-bearing over time: when your tools plug in through a shared protocol, the orchestration library gets easier to leave.

So: pick deliberately, but hold it loosely. Prototype in the shape that matches your problem, and be willing to be wrong about the shape — that's cheaper in week two than in month six.

## The reframe

Stop shopping for the best agent framework. There isn't one, and the search itself is a symptom — it's the same instinct that reaches for the tool before the problem is understood, dressed up as diligence. What exists is a set of tools with distinct shapes, each excellent at the thing it was born to do and awkward at the things it wasn't. Graphs for control. Crews for role-shaped work. Handoffs for triage. Enterprise pipelines for enterprises. Minimal loops for the many problems that were never as complicated as the diagram.

Know your problem's shape first, choose the tool that fits it, verify you can see inside it and get out of it — and then go spend your real effort on the things that actually determine whether this works: the data, the context, the tools, the evals, the guardrails. The framework is a decision you'll make in an afternoon and could reverse in a week. Everything else on that list is the work.
