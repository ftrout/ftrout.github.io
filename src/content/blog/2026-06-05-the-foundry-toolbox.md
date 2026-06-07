---
title: "The Foundry Toolbox: Notes From a Week of Testing It in Dev"
pubDate: 2026-06-05
description: "Foundry's Toolbox lets you bundle a set of tools once, version it, and hand any agent a single endpoint instead of wiring tools in code. I've been testing it in dev — here's what it actually is, when it earns its place, when it's overkill, and the best practices I wish I'd known on day one."
author: "Frank Trout"
---

I've spent the last week with the Foundry **Toolbox** wired into a dev project, and it's one of those features that looks like a small convenience and turns out to be an architectural decision. So before it quietly becomes load-bearing in something I ship, I want to write down what it is, where it pulls its weight, where it's overkill, and the handful of things I learned the slightly-hard way.

One caveat up front: the Toolbox APIs are **preview/experimental** right now. The Python wrappers emit an `ExperimentalWarning` the first time you touch them, and the docs are explicit that the surface may change. That shapes a lot of my "don't overuse it yet" instinct below.

## What it actually is

A **toolbox** is a curated, named, *versioned* bundle of tool configurations — web search, Azure AI Search, code interpreter, file search, image generation, MCP servers, OpenAPI tools — that you configure once in Foundry and expose as a **single MCP-compatible endpoint**.

That last part is the whole idea. Instead of attaching `web_search`, `code_interpreter`, and three MCP servers individually to every agent definition, you define the collection once and point any agent at the toolbox. And because the endpoint speaks MCP, the consumer doesn't have to be a Foundry agent — the same toolbox can be consumed by Agent Framework, LangGraph, the GitHub Copilot SDK, Copilot Studio, or your own custom code.

The mental split that made it click for me: **you *build* toolboxes in Foundry, but the consumption surface is open.** Building (creating versions, adding tools) happens in the Foundry portal or the raw `azure-ai-projects` SDK (`>=2.1.0`). The Agent Framework only covers *consumption*.

## The three things it buys you

Reading the marketing, it sounds like "a folder of tools." Using it, the value is really three specific properties:

**1. One source of truth.** Configure the tool set once; every agent that points at the toolbox gets the same tools. No copy-pasting tool wiring across agent definitions and watching them drift.

**2. Versioning with promote-to-default.** You can create multiple versions, test a new one against its *version-specific* endpoint, then promote it to default when it's ready. Agents connected to the default endpoint pick up the promoted version **automatically — no code change, no redeploy.** There's also support for attaching a guardrail (RAI policy) per version.

**3. Centralized auth.** The toolbox handles credential injection, token refresh, and policy enforcement at runtime via Entra ID and OAuth. Consuming agents don't each manage credentials for every tool. For the MCP tools *inside* the toolbox, auth to the upstream server runs server-side through a `project_connection_id` — the client never holds those bearer tokens.

Property #2 is the one that's genuinely different from "just attach the tools." It decouples *what tools an agent has* from *the agent's deployment lifecycle*. That's powerful and, as I'll get to, slightly dangerous.

## Consuming one from Agent Framework

There are two consumption shapes depending on which agent type you're on:

- **`FoundryAgent`** (hosted, server-managed) — toolbox attachment happens server-side. There's no client-side wiring at all.
- **`FoundryChatClient`** (direct inference, your app owns the loop) — you fetch the toolbox and pass it as `tools=`.

The `FoundryChatClient` path is what I've been testing, and it's about as simple as it gets:

```python
from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity.aio import AzureCliCredential

async with AzureCliCredential() as credential:
    client = FoundryChatClient(credential=credential)
    toolbox = await client.get_toolbox("research_toolbox")  # default version

    async with Agent(client=client, name="ResearchAgent", tools=toolbox) as agent:
        result = await agent.run("Summarize recent findings on LLM agents.")
        print(result.text)
```

You pass the `toolbox` object straight into `tools=` — no need to write `toolbox.tools`. The framework recognizes the toolbox type and flattens it for you, and you can mix it freely with local function tools:

```python
agent = Agent(client=client, tools=[get_internal_metrics, toolbox])
```

There's also a second path: consume the toolbox **as an MCP server** by pointing `MCPStreamableHTTPTool` at its MCP endpoint. That works with *any* chat client, not just `FoundryChatClient` — but you take on client-side auth (an Entra bearer token via `header_provider`). I'd only reach for that when I'm not on a Foundry client.

## When I'd reach for it

After a week, my "yes" list is narrow and specific:

- **Several agents share the same tool set.** This is the headline case. One toolbox, N agents, one place to change things.
- **I want to change tools without redeploying agents.** Because it's a managed resource with versioning, I can roll a new tool config and promote it, and every consumer picks it up. For a fleet, that's a real operational win.
- **Heterogeneous runtimes need the same tools.** A Foundry agent and a LangGraph service both needing the same five tools? The MCP endpoint means they consume one definition.
- **I need centralized auth and governance.** Per-version RAI policy and central credential handling are hard to retrofit; getting them for free is worth a lot in a regulated context.

## Don't overuse it

Here's the part I most want my future self to read. The Toolbox is an indirection layer, and indirection has a cost.

**Don't use a toolbox for a single agent with one or two tools.** If one agent needs `web_search` and a code interpreter, just attach them in code. A toolbox adds a network round-trip (`get_toolbox()` hits the service), a preview API dependency, and a layer of "where is this configured?" for zero benefit when there's nothing to share. This is the same restraint I apply everywhere: reach for the cheapest layer that closes the gap, and a lone agent's tools don't need a managed registry.

**Don't build one giant everything-toolbox.** Stuffing every tool your org owns into one bundle bloats the tool definitions sent to the model, burns tokens, and — worse — lets the model invoke tools you never meant to expose for that task. Foundry's own framing is *intent-based* toolboxes: scope a toolbox to a job ("research," "incident-response"), not to your entire catalog.

**Don't lean on default-version auto-promotion in production without pinning.** The thing that's delightful in dev — promote a version and every agent silently picks it up — is exactly what'll page you at 2 a.m. in prod when a "small" tool change shifts behavior across your whole fleet at once. In prod, pin. In dev, let it float.

**Don't forget there's no client-side cache.** Every `get_toolbox()` call goes to the network. The framework deliberately doesn't cache, because default versions can change server-side — so caching is *your* job.

## Lessons learned in dev

The best practices that actually came out of using it, with the code:

**Pin the version in production; let dev float.** Omitting the version resolves the default in *two* requests; pinning avoids the extra round trip and, more importantly, makes prod behavior deterministic. I gate it on environment:

```python
import os

version = None if os.environ.get("APP_ENV") == "development" else "v3"
toolbox = await client.get_toolbox("research_toolbox", version=version)
```

**Filter to the subset each agent needs.** A shared toolbox is convenient, but a given agent rarely needs all of it. `select_toolbox_tools` narrows the set after fetching — fewer tool definitions to the model means fewer tokens and fewer ways for it to misfire:

```python
from agent_framework.foundry import select_toolbox_tools

# Only expose what this agent should actually touch
tools = select_toolbox_tools(toolbox, include_names=["web_search", "code_interpreter"])
# or by type:
tools = select_toolbox_tools(toolbox, include_types=["web_search", "mcp"])

agent = Agent(client=client, name="ResearchAgent", tools=tools)
```

This was the single biggest quality improvement in my testing. A focused tool list makes the model's tool selection noticeably more reliable — the same lesson as keeping any toolset small, just applied to a bundle.

**Cache the fetched toolbox yourself if you fetch it per request.** Since there's no framework cache, fetching inside a hot path means a network call every turn. I keep one fetched toolbox per process and refresh it on my own schedule rather than calling `get_toolbox()` on each run.

**Know which auth path you're on.** Native consumption (`tools=toolbox`) leans on the toolbox's server-side credential handling. The MCP path (`MCPStreamableHTTPTool`) puts client-side bearer-token auth on you. Pick deliberately — I default to native on `FoundryChatClient` and only take the MCP path when the consumer isn't a Foundry client.

## The takeaway

The Foundry Toolbox is a genuinely good answer to "we have a bunch of agents and a shared, evolving set of tools, and we're tired of wiring them everywhere." The versioning and central auth are the real draws, not the bundling. But it's an operational abstraction with a preview-API caveat, a network cost, and a footgun (silent default promotion) — so it earns its place when there's something to *share and govern*, and it's pure overhead when there isn't.

My rule coming out of the week: **bundle by intent, pin in prod, filter per agent, and don't reach for it until you have a second consumer.** I'll revisit once the APIs go GA and report back on whether the surface held.
