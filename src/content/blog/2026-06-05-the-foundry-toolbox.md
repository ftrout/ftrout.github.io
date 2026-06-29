---
title: "The Foundry Toolbox: Notes From a Week of Testing It in Dev"
pubDate: 2026-06-05
description: "New to building AI agents? Foundry's Toolbox lets you bundle a set of tools once, version it, and hand any agent a single address instead of wiring tools in code. I've been testing it in dev — here's what it actually is, when it earns its place, when it's overkill, and the best practices I wish I'd known on day one."
author: "Frank Trout"
---

*A note for newcomers: an **agent** is an AI app that can not only chat but take actions by calling **tools** — small capabilities like "search the web" or "run code." **Azure AI Foundry** is Microsoft's platform for building those agents, and its **Toolbox** is a feature that lets you group a set of tools together once and reuse the bundle. I'll define the rest of the jargon as it comes up.*

I've spent the last week with the Foundry **Toolbox** wired into a dev (development, i.e. not-yet-live) project, and it's one of those features that looks like a small convenience and turns out to be an architectural decision. So before it quietly becomes load-bearing in something I ship, I want to write down what it is, where it pulls its weight, where it's overkill, and the handful of things I learned the slightly-hard way.

One caveat up front: the Toolbox APIs (the programming interfaces you use to work with it) are **preview/experimental** right now — meaning Microsoft is still actively changing them and hasn't promised they'll stay the same. The Python helper code even prints a warning the first time you touch it, and the docs are explicit that things may shift. That shapes a lot of my "don't overuse it yet" instinct below.

## What it actually is

A **toolbox** is a named, *versioned* bundle of tools you configure once in Foundry — things like web search, Azure AI Search (Microsoft's search service for your own data), a code interpreter (a tool that runs code), file search, image generation, MCP servers, and OpenAPI tools. ("Versioned" means each saved snapshot of the bundle gets a version number, so you can change it without disturbing what's already running. **MCP** — Model Context Protocol — is an emerging open standard for how an AI app talks to its tools; an MCP *server* is just a program that offers tools over that standard. OpenAPI is a common format for describing a web API so software can call it.) You expose that whole bundle as a **single address** that any agent can connect to, and that speaks MCP.

That last part is the whole idea. Instead of attaching web search, the code interpreter, and three MCP servers one by one to every agent you build, you define the collection once and point any agent at the toolbox. And because the address speaks MCP, the thing connecting to it doesn't have to be a Foundry agent — the same toolbox can be used by Agent Framework (Microsoft's library for building agents), LangGraph, the GitHub Copilot SDK, Copilot Studio, or your own custom code.

The mental split that made it click for me: **you *build* toolboxes in Foundry, but anything can connect to one to use it.** Building (creating versions, adding tools) happens in the Foundry web portal or in Microsoft's `azure-ai-projects` code library. The Agent Framework only covers the *using* side, not the building side.

## The three things it buys you

Reading the marketing, it sounds like "a folder of tools." Using it, the value is really three specific properties:

**1. One source of truth.** Configure the tool set once; every agent that points at the toolbox gets the same tools. No copy-pasting tool wiring across agent definitions and watching them drift.

**2. Versioning with promote-to-default.** You can create multiple versions, test a new one at its own private address, then "promote" it to be the default when it's ready. Agents connected to the default address pick up the promoted version **automatically — no code change, no redeploy** (no need to re-publish the agent). You can also attach a guardrail — an **RAI policy**, short for Responsible AI, a set of rules that block unsafe or disallowed content — to each version.

**3. Centralized auth.** "Auth" is short for *authentication and authorization* — proving who you are and what you're allowed to do. The toolbox handles the credentials (the secret keys and tokens that grant access), refreshes them when they expire, and enforces access rules at runtime, using Microsoft's identity systems (Entra ID and OAuth). That way each agent doesn't have to manage credentials for every tool itself. For the MCP tools *inside* the toolbox, the login to the upstream tool happens on the server, behind a stored connection — so your client app never has to hold those secret access tokens.

Property #2 is the one that's genuinely different from "just attach the tools." It separates *what tools an agent has* from *when and how the agent itself gets shipped*. That's powerful and, as I'll get to, slightly dangerous.

## Consuming one from Agent Framework

There are two ways to use one, depending on which kind of agent you're building:

- **The hosted kind** (`FoundryAgent` — runs and is managed on Microsoft's servers) — the toolbox is attached on the server. There's no wiring in your own code at all.
- **The direct kind** (`FoundryChatClient` — your own app drives the model directly and runs the back-and-forth loop) — your code fetches the toolbox and hands it to the agent as its set of tools.

The direct (`FoundryChatClient`) path is what I've been testing, and it's about as simple as it gets:

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

You hand the whole `toolbox` object straight to the agent as its `tools` — you don't have to unpack the individual tools out of it yourself. The framework recognizes a toolbox and unpacks it for you, and you can freely mix it with your own local tools (plain functions in your code, here a `get_internal_metrics` function):

```python
agent = Agent(client=client, tools=[get_internal_metrics, toolbox])
```

There's also a second path: connect to the toolbox **as a plain MCP server** (using the generic MCP tool, `MCPStreamableHTTPTool`, pointed at its address). That works with *any* chat client, not just Foundry's — but then handling the login is on you (your code has to attach a valid access token on every request). I'd only reach for that when I'm not on a Foundry client.

## When I'd reach for it

After a week, my "yes" list is narrow and specific:

- **Several agents share the same tool set.** This is the headline case. One toolbox, N agents, one place to change things.
- **I want to change tools without redeploying agents.** Because it's a managed resource with versioning, I can roll a new tool config and promote it, and every consumer picks it up. For a fleet, that's a real operational win.
- **Different kinds of apps need the same tools.** A Foundry agent and a LangGraph service both needing the same five tools? Because they connect to one shared address, they use a single definition instead of each defining the tools separately.
- **I need centralized auth and governance** (one place to handle logins and enforce rules). Per-version safety policies and central credential handling are painful to bolt on after the fact; getting them for free is worth a lot in a regulated setting.

## Don't overuse it

Here's the part I most want my future self to read. The Toolbox is an extra layer in the middle, and an extra layer always has a cost.

**Don't use a toolbox for a single agent with one or two tools.** If one agent needs web search and a code interpreter, just attach them directly in code. A toolbox adds a network round-trip (fetching it makes a call out to the service), a dependency on a preview API that may still change, and a layer of "wait, where is this configured?" — for zero benefit when there's nothing to share. This is the same restraint I apply everywhere: reach for the cheapest thing that closes the gap, and a lone agent's tools don't need a managed registry.

**Don't build one giant everything-toolbox.** Stuffing every tool your org owns into one bundle means a long list of tool descriptions gets sent to the model on every call — that wastes **tokens** (the chunks of text the model is billed by) and, worse, lets the model trigger tools you never meant to expose for that task. Foundry's own advice is *intent-based* toolboxes: scope a toolbox to a single job ("research," "incident-response"), not to your whole catalog.

**Don't lean on automatic default-version promotion in production without pinning.** ("Production," or *prod*, is the live system real users touch; *pinning* means locking an agent to a specific version instead of letting it follow the default.) The thing that's delightful in dev — promote a version and every agent silently picks it up — is exactly what'll wake you at 2 a.m. in prod when a "small" tool change shifts behavior across all your agents at once. In prod, pin. In dev, let it float.

**Don't forget the framework doesn't remember the toolbox for you.** Every fetch goes back out over the network. The framework deliberately doesn't keep a saved copy, because the default version can change on the server — so saving and reusing it (caching) is *your* job.

## Lessons learned in dev

The best practices that actually came out of using it, with the code:

**Pin the version in production; let dev float.** If you leave the version out, the service has to do *two* requests to look up the current default; naming a specific version skips that extra round trip and, more importantly, makes prod behavior predictable — you know exactly which version is running. I switch on the environment (dev vs. prod):

```python
import os

version = None if os.environ.get("APP_ENV") == "development" else "v3"
toolbox = await client.get_toolbox("research_toolbox", version=version)
```

**Filter down to just the tools each agent needs.** A shared toolbox is convenient, but a given agent rarely needs all of it. A helper (`select_toolbox_tools`) trims the bundle down after you fetch it — fewer tool descriptions reaching the model means fewer tokens spent and fewer ways for it to pick the wrong tool:

```python
from agent_framework.foundry import select_toolbox_tools

# Only expose what this agent should actually touch
tools = select_toolbox_tools(toolbox, include_names=["web_search", "code_interpreter"])
# or by type:
tools = select_toolbox_tools(toolbox, include_types=["web_search", "mcp"])

agent = Agent(client=client, name="ResearchAgent", tools=tools)
```

This was the single biggest quality improvement in my testing. A focused tool list makes the model noticeably better at picking the right tool — the same lesson as keeping any toolset small, just applied to a bundle.

**Save the fetched toolbox yourself if you'd otherwise fetch it on every request.** Since the framework doesn't keep a copy, fetching it in a frequently-run path means a network call on every single turn. I fetch it once per running process and refresh it on my own schedule instead of fetching it fresh on each run.

**Know which login path you're on.** The built-in path (handing the toolbox straight to the agent) leans on the toolbox's server-side credential handling — Foundry deals with the logins. The plain-MCP path (the generic MCP tool) puts attaching the access token on you, in your own code. Pick deliberately — I default to the built-in path on a Foundry client and only take the MCP path when the thing connecting isn't a Foundry client.

## The takeaway

The Foundry Toolbox is a genuinely good answer to "we have a bunch of agents and a shared, ever-changing set of tools, and we're tired of wiring them up everywhere." The versioning and the central login handling are the real draws, not the bundling itself. But it's an operational convenience layer that comes with a preview-API caveat, a network cost, and a footgun (a version silently promoting itself across everything) — so it earns its place when there's something to *share and govern*, and it's pure overhead when there isn't.

My rule coming out of the week: **bundle by intent, pin in prod, filter per agent, and don't reach for it until you have a second app using the same tools.** I'll revisit once the APIs are officially finished and stable (GA — generally available) and report back on whether they held up.
