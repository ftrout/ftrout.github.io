---
title: "Building Effective Agents on Microsoft Foundry"
pubDate: 2026-06-07
description: "A section-by-section translation of Anthropic's 'Building Effective Agents' into Microsoft Foundry — mapping each pattern to the workflows, model router, Toolbox, Agent Framework, and hosted-agent primitives that implement it."
author: "Frank Trout"
---

Anthropic's [*Building Effective Agents*](https://www.anthropic.com/engineering/building-effective-agents) has become a kind of common vocabulary for people shipping LLM systems. Its core argument is refreshingly unfashionable: the most successful implementations aren't the ones reaching for the most complex framework — they're the ones built from simple, composable patterns, with complexity added only when it demonstrably earns its place.

That advice is platform-agnostic. But every platform gives those patterns a different concrete shape. This post walks through Anthropic's framework section by section and translates each idea into how you'd actually build it in **Microsoft Foundry** — which primitives map to which patterns, and where Foundry hands you something for free that you'd otherwise hand-roll.

A quick note before we start: Foundry is moving fast, and a few capabilities referenced here (hosted agents, some workflow features) are in preview. Treat specifics as point-in-time and confirm against the live docs before you build on them.

---

## Workflows vs. agents: Foundry makes the distinction physical

Anthropic draws one architectural line that everything else hangs off of:

- **Workflows** orchestrate LLMs and tools through *predefined code paths*.
- **Agents** let the LLM *dynamically direct its own process* and tool usage.

What's nice about Foundry is that this isn't just a conceptual distinction — it's two different products you choose between.

**Foundry Workflows** are the "predefined code paths" branch made literal. They're declarative, visual (or YAML) sequences that orchestrate agents and business logic with branching, variables, and human-in-the-loop steps — no orchestration code required. If your task decomposes cleanly into known steps, this is your tool.

**Foundry agents** are the "model directs itself" branch. A single agent — a Foundry model plus tools and instructions — decides what to do at runtime. When you need the agent to run your own code in a loop on any framework you like, that's a **hosted agent** (bring Microsoft Agent Framework, LangGraph, Semantic Kernel, or custom code in a container). For dynamic multi-agent delegation, **Microsoft Agent Framework** orchestration is the current path.

So the very first decision in Anthropic's post — am I building a workflow or an agent? — maps directly onto "do I reach for a Foundry Workflow or a Foundry agent?"

---

## When (and when not) to use agents

Anthropic's guidance: find the simplest thing that works, and remember agents trade latency and cost for capability. Often a single well-built LLM call with retrieval and good examples is enough.

The Foundry translation of "start simple and escalate" looks like a ladder:

1. **A single model call or a single prompt-based agent.** A Foundry model with a sharp system prompt and maybe one or two tools. Most problems stop here.
2. **A Workflow**, when you need predictability and repeatability across known steps — and especially when you need auditability or human approvals baked into the path.
3. **An autonomous (hosted) agent or multi-agent system**, when flexibility and model-driven decisions at scale are worth the extra cost and the compounding-error risk.

Foundry's own responsible-AI guidance reinforces the escalation discipline from the other direction: watch response accuracy, latency, and error frequency, and only decompose a single agent into a multi-agent system once prompt refinements stop moving those numbers. That's the same "add complexity only when it demonstrably improves outcomes" rule, expressed as a monitoring trigger.

---

## On frameworks: understand what's under the hood

Anthropic warns that frameworks make it easy to start but can hide the prompts and responses, and that incorrect assumptions about what's underneath are a common source of error. Their advice: start close to the API; if you use a framework, understand its internals.

Foundry gives you a spectrum here, and the same caution applies at each rung:

- **Prompt-based agents** are the low-code rung — define behavior through instructions and tool config in the portal.
- **Hosted agents** are the bring-your-own-framework rung — you package your code as a container and the platform handles scaling, sessions, identity, and observability while you keep control of the agent logic.

Microsoft's own framing mirrors Anthropic's "start simple, graduate deliberately": prototype collaboration patterns in **Microsoft Agent Framework**, then move the parts that prove production value into Foundry Agent Service for supported, non-breaking operation. Either way, the lesson holds — the managed layers are a convenience, not an excuse to stop understanding your prompts and tool calls.

---

## The building block: the augmented LLM

Anthropic's foundational unit is the *augmented LLM* — a model enhanced with retrieval, tools, and memory, able to generate its own queries, pick tools, and decide what to remember. They suggest two things: tailor these augmentations to your use case, and give the model a clean, well-documented interface (they point to MCP as one way).

In Foundry, the augmented LLM is just… what a Foundry agent *is*. The three augmentations map onto concrete services:

| Augmentation | Foundry equivalent |
| --- | --- |
| **Retrieval / knowledge** | File Search (RAG over Azure AI Search, Blob, local files), Grounding with Bing Search, SharePoint, Fabric, bring-your-own licensed data |
| **Tools / actions** | The Toolbox: Code Interpreter, Web Search, OpenAPI 3.0 tools, Azure Functions, Logic Apps, and custom **MCP** connections |
| **Memory** | Conversations/threads for durable history, plus per-session `$HOME` and `/files` state on hosted agents |

And Anthropic's MCP recommendation lands cleanly: Foundry agents reach managed tools through a **Toolbox MCP endpoint** and can connect external MCP servers directly, so the "clean, well-documented interface for the model" they advocate is the native pattern, not a bolt-on.

---

## Workflow: prompt chaining → Foundry Sequential workflows

Anthropic's prompt chaining decomposes a task into fixed steps, each LLM call consuming the last one's output, with optional programmatic "gates" between steps to keep things on track.

This is the **Sequential workflow** template in Foundry, almost one-to-one. Each agent node passes its result to the next in a defined order. The "gate" is a **Logic node** (if/else, go-to) or a **Power Fx** expression / data-transformation node sitting between agent nodes — a programmatic check that decides whether to proceed. To make the hand-off between steps reliable, configure agent nodes to emit **structured JSON** (a strict JSON schema) and save it into a workflow variable the next node reads. That's Anthropic's "trade latency for accuracy by making each step easier," implemented declaratively.

*Good fit:* generate marketing copy then translate it; draft an outline, gate-check it against criteria, then write the full document.

---

## Workflow: routing → model router *and* an orchestrating agent

Routing classifies an input and sends it down a specialized path. Anthropic gives two flavors of value: separation of concerns (specialized prompts per category) and cost optimization (cheap model for easy queries, capable model for hard ones — their example routes easy questions to Haiku and hard ones to Sonnet).

Foundry splits these into two complementary mechanisms, and it's worth using both:

**Model router** is the cost-optimization flavor, and it's almost spookily close to Anthropic's example. It's a single deployment that picks the best model *per request, per turn* based on prompt complexity — simple greetings to fast cheap models, multi-step tool chains to mid-tier, hard reasoning to frontier. You write zero routing logic. It's tool-aware (it factors in tool definitions), and its model pool even includes Claude Haiku, Sonnet, and Opus alongside other models — so Anthropic's "route easy to Haiku, hard to Sonnet" is literally a routing mode you can switch on (Cost, Balanced, or Quality).

**An orchestrating agent or a Group chat workflow** is the separation-of-concerns flavor. A main agent does intent classification and delegates to specialized downstream agents (the classic "contract assistant routes to a clause-summarizer vs. a compliance-validator" shape), or a Group chat workflow dynamically passes control between agents based on context. Use this when different categories genuinely need different prompts, tools, and knowledge — not just a different-sized model.

*Good fit:* model router for "same task, varying difficulty"; an orchestrating agent / Group chat for "genuinely different task types, each with its own specialist."

---

## Workflow: parallelization (sectioning & voting)

Anthropic splits parallel work into **sectioning** (independent subtasks run at once) and **voting** (the same task run several times for confidence). Their canonical sectioning example is a guardrail: one model instance handles the response while another screens the input — better than asking one call to do both.

In Foundry, parallel execution comes from **concurrent orchestration** in Agent Framework workflows (you can run workflow-oriented multi-agent solutions serially *or* in parallel). The two flavors map like this:

- **Sectioning** — split a request across specialized agents running concurrently and aggregate. The guardrail pattern specifically pairs nicely with Foundry's **content filters** plus a dedicated screening agent that runs alongside your responder, exactly as Anthropic describes.
- **Voting** — run the same check across multiple agents/prompts and combine the verdicts (e.g., several reviewers flagging code, or multiple evaluators with different vote thresholds to balance false positives and negatives).

---

## Workflow: orchestrator-workers → Agent Framework hierarchical orchestration

The orchestrator-workers pattern has a central LLM *dynamically* breaking a task into subtasks, delegating to workers, and synthesizing results. Anthropic stresses the difference from parallelization: the subtasks aren't predefined — the orchestrator decides them based on the input.

This is dynamic delegation, so it lives on the **agent** side of Foundry, not the static-workflow side. The cleanest current implementation is **Microsoft Agent Framework's hierarchical orchestrator–subagent** pattern: a primary agent interprets the goal, decides at runtime which specialized agents to invoke and how, and composes their outputs — no hardcoded routing table. A **Group chat workflow** is the lighter-weight, designer-based cousin when you want dynamic handoff with less code.

One important Foundry-specific nuance: hosted agents aren't supported inside the visual workflow designer. If you want a *hosted* agent to orchestrate or call other agents, do that orchestration in Agent Framework workflows from within your hosted agent's code.

*Good fit:* a coding change touching an unpredictable set of files; multi-source research where you don't know up front how many sources you'll need.

---

## Workflow: evaluator-optimizer → the Evaluation SDK in a loop

Anthropic's evaluator-optimizer pairs a generator LLM with an evaluator LLM that critiques in a loop — ideal when you have clear criteria and iterative refinement adds measurable value.

Foundry gives you both halves. The **loop** is a workflow with a generator agent node and an evaluator agent node, with logic that routes back for another pass until a quality bar is met. And for the evaluation itself, you don't have to invent metrics from scratch — the **Azure AI Evaluation SDK** ships purpose-built agent evaluators:

- **Intent resolution** — did the agent correctly understand and scope the request?
- **Tool call accuracy** — did it choose the right tools with the right parameters?
- **Task adherence** — did the final response stay faithful to the assigned task?

You can run these in the refinement loop as the evaluator's criteria, and also offline in CI to catch regressions. That turns Anthropic's "articulate the feedback the LLM can act on" into a concrete, measurable signal.

*Good fit:* literary translation with nuance an evaluator can catch; multi-round research where the evaluator decides whether another search is warranted.

---

## Agents: the autonomous loop → hosted agents

Finally, the autonomous agent: an LLM using tools in a loop, taking "ground truth" from the environment (tool results, code execution) at each step, pausing for human input at checkpoints, and stopping on completion or a max-iteration guard. Anthropic flags the costs — higher spend, compounding errors — and prescribes sandboxed testing plus guardrails.

This is the **hosted agent** in Foundry, and the platform happens to supply most of the surrounding machinery Anthropic warns you'll otherwise build yourself:

- **The loop and ground truth.** Your code calls Foundry models and Toolbox tools; Code Interpreter and tool results give the agent real feedback to act on.
- **Sandboxing, by default.** Every session runs in its own VM-isolated sandbox with a persistent filesystem — Anthropic's "test in sandboxed environments" is the *runtime* model, not just a test harness.
- **Human-in-the-loop checkpoints.** Foundry's responsible-AI guidance is emphatic about real-time controls to authorize, review, and override — especially for irreversible or high-stakes actions — and about defining explicit *action boundaries* and *domain boundaries*. That's Anthropic's "pause for human feedback at checkpoints," operationalized.
- **Stopping conditions and guardrails.** You set iteration limits and guards in your loop; content filters and least-privilege identity contain the blast radius.

---

## The three principles, in Foundry terms

Anthropic closes with three principles for implementing agents. Each has a direct Foundry expression:

**1. Simplicity.** Start with a single prompt-based agent or model router; reach for Workflows, then multi-agent, only when monitoring shows a single agent has hit its ceiling. Don't deploy an orchestrator-workers system where a Sequential workflow — or one well-prompted agent — would do.

**2. Transparency — show the agent's planning.** Lean on Foundry's built-in observability: agents emit **OpenTelemetry traces** to Application Insights by default, and run steps let you reconstruct prompts, model calls, and tool invocations. You get the "explicitly show the planning steps" principle without instrumenting it yourself.

**3. A well-crafted agent-computer interface (ACI).** This is Anthropic's Appendix 2 — treat tool definitions with the same care as prompts. In Foundry that means: write precise OpenAPI/MCP tool specs with clear descriptions and examples, prefer **structured outputs** with strict JSON schema so the model doesn't fight formatting overhead, keep the toolset small and unambiguous, and route managed tools through the Toolbox for consistent auth. Then test how the model actually uses each tool — locally against your hosted agent's `:8088` endpoint or in the playground — and iterate, exactly as Anthropic describes spending more time on tools than on the top-level prompt.

---

## Where the patterns show up: the same two killer apps

Anthropic's appendix highlights two domains where agents shine — **customer support** (conversation plus tool-driven actions, with clear resolution criteria) and **coding agents** (verifiable through tests, iterating on feedback in a well-defined space).

Both translate directly. A Foundry **customer support agent** combines a conversational Responses-protocol agent with knowledge tools (File Search, SharePoint) and action tools (Logic Apps to issue refunds or update tickets), with success measured by resolution — and the evaluation SDK to prove it. A Foundry **coding agent** runs as a hosted agent with Code Interpreter for execution feedback and a human review gate before changes land. Same patterns, same human-oversight caveat Anthropic stresses: automated checks verify functionality, but a human confirms it fits the broader system.

---

## A translation cheat sheet

| Anthropic pattern | Build it in Foundry with |
| --- | --- |
| Augmented LLM | A Foundry agent: model + Toolbox tools + knowledge sources + conversations/sessions; MCP for the interface |
| Prompt chaining | Sequential workflow; Logic/Power Fx nodes as gates; strict-JSON hand-offs |
| Routing | Model router (per-turn, cost-aware) and/or an orchestrating agent or Group chat workflow |
| Parallelization (sectioning/voting) | Concurrent orchestration in Agent Framework; content filters + screening agent for guardrails |
| Orchestrator-workers | Agent Framework hierarchical orchestrator–subagent; Group chat workflow |
| Evaluator-optimizer | A generate/evaluate loop in a workflow + Azure AI Evaluation SDK (intent, tool accuracy, task adherence) |
| Autonomous agent | Hosted agent: your loop, VM-isolated sandbox, human checkpoints, iteration guards |
| Simplicity / Transparency / ACI | Escalation ladder + monitoring; OpenTelemetry → App Insights; OpenAPI/MCP specs + structured outputs + Toolbox |

The throughline is the same one Anthropic ends on: success isn't the most sophisticated system, it's the *right* one. Foundry's value here isn't that it lets you build something more elaborate — it's that it removes enough plumbing (scaling, sandboxes, identity, tracing, evaluation, routing) that you can afford to start simple and only climb the ladder when the evidence says to.

---

*This post adapts the patterns and principles from Anthropic's "Building Effective Agents" (Dec 2024) and maps them onto Microsoft Foundry using current Microsoft Learn documentation for Foundry Agent Service, Workflows, model router, the Toolbox, Microsoft Agent Framework, and the Azure AI Evaluation SDK. Hosted agents and some workflow features are in preview; verify current availability, limits, and behavior before relying on them in production.*
