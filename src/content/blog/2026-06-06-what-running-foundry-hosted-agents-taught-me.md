---
title: "What Running Foundry Hosted Agents Taught Me"
pubDate: 2026-06-06
description: "New to building with AI? Lessons from running Microsoft Foundry hosted agents in production — the operational, cost, and security realities that surface once real traffic shows up, explained from the ground up."
author: "Frank Trout"
---

*A note for newcomers: **Azure AI Foundry** is Microsoft's cloud platform for building and running AI applications. An **agent** is an AI program that doesn't just answer questions but takes actions — calling tools, looking things up, doing multi-step work. A **hosted agent** means Microsoft runs the servers and plumbing for you; you just bring your code. This post is a hands-on field report, and I'll define each term as it comes up.*

I've been building on Foundry's hosted agents for a while now — long enough to have a few scars, a couple of cost surprises I'd rather forget, and a working mental model I wish someone had handed me on day one. This is that handoff. Less "here's the feature list," more "here's what actually mattered once real traffic showed up."

For context: I came in from the open-source agent world, where I was hand-rolling containers (self-contained bundles of an app and everything it needs to run), web servers, secret plumbing, scaling rules, and rollback scripts. The pitch for hosted agents is that the platform eats most of that, and you bring your own code on whatever framework you like. Mostly that pitch holds up. But "managed" — the platform handling the infrastructure for you — doesn't mean "thoughtless," and the places where I had to actually think are the interesting parts.

One housekeeping note before I get into it: this is all still **preview** as I write this — Microsoft's word for "released early, still changing, not yet guaranteed stable." I've had region availability and quotas (the caps on how much you're allowed to run) shift under me more than once, so treat anything specific here as a snapshot and double-check the live docs before you bet a launch on it.

---

## The protocol choice I overthought (and you shouldn't)

My first real mistake was agonizing over Responses vs. Invocations — two different ways your agent can talk to the outside world — before I'd written a line of agent code.

In hindsight: just start with **Responses**. It gives you an OpenAI-compatible `/responses` endpoint (a fixed web address that accepts requests in the same format OpenAI's API uses, so existing tools just work) and the platform quietly handles conversation history, streaming (sending the answer back a piece at a time instead of all at once), background execution, and session lifecycle for you. A *session* is one ongoing conversation or job; its *lifecycle* is the start-to-finish management of it. For a chatbot, multi-turn Q&A with retrieval (looking up relevant facts and feeding them in), background jobs, or anything I later wanted to push into Teams, Responses was the right call every time.

I only reached for **Invocations** when something genuinely couldn't speak `/responses` — a webhook (an automatic call one system fires at another when an event happens) from an external system that sends its own payload shape, or a batch classification job where the input was structured data, not a chat turn. The tradeoff is real, though: with Invocations you own session *state* — the saved memory of what's happened in a conversation. There's no platform-managed history to lean on, so I was the one wiring up storage. I learned that the hard way by assuming history "just existed" on an Invocations endpoint. It does not.

The thing that would've saved me the agonizing: a single container can expose both protocols at once. So the decision wasn't permanent. I could (and did) start on Responses and bolt on an Invocations endpoint later by declaring it and importing the library. The WebSocket variant — a protocol for a constant two-way connection, used here for real-time voice — exists too, but it was preview and region-locked when I looked, so I left it alone.

---

## Secrets: the lesson I'm glad I learned early

Early on I did the lazy thing and dropped a token (a secret key that proves you're allowed to use a service) into an environment variable — a named value handed to a program when it starts. It worked. It also made me deeply uncomfortable the moment I imagined that image (the packaged-up container, secret and all) sitting in a registry (the online storage where container images live).

The rule I now follow without exception: **treat the agent like production application code** — code real users depend on, held to that standard of care. No secrets in the image, none in plain env vars. I moved everything to managed identity (a built-in cloud login the platform manages, so there's no password to leak) plus Foundry project connections (saved, reusable links to other services), and for the values I do pass through env vars I use the connection placeholder syntax so Foundry resolves the secret at sandbox start instead of leaving it lying around:

```yaml
env:
  OPENAI_API_KEY: ${{connections.my-openai.credentials.api_key}}
```

A nice side effect: the management API (the programmatic interface for inspecting and changing your agents) never echoes the resolved secret back, so a `GET` (a read-only request that fetches information) on the version just shows the literal placeholder, not the real key. The one gotcha that bit me: the connection has to exist *before* you deploy the version, or the placeholder silently resolves to empty.

Related, and underrated: I assume any input could be hostile now. I log model inputs and outputs, keep user-supplied text clearly delineated, and give the model the narrowest access I can get away with. Prompt injection — when text the model reads sneaks in instructions that hijack what it does — stops being abstract the first time you watch a trace (a recorded play-by-play of one run) of an agent almost doing something dumb because a tool returned text it treated as instructions.

---

## Identity clicked once I stopped conflating two things

There are two identities (the "who" a piece of software acts as when it logs in) in play and I kept mixing them up until it cost me a debugging afternoon. There's the **per-agent Entra identity** — Entra is Microsoft's identity service, and this is what my container actually authenticates *as* (proves who it is) at runtime, for calling models, tools, and downstream services. And there's the **project managed identity**, which the platform uses for infrastructure chores like pulling my image. They are not the same thing, and the RBAC — role-based access control, the system of granting permissions by assigning named roles — you assign to each is different.

Two practical takeaways. First, least privilege (giving each identity only the permissions it strictly needs, nothing more) belongs on the *agent* identity — it needs the `Foundry User` role on the project for runtime access, and for my own external resources (a storage account, say) I assign roles manually and grant only what the task needs. Second, to deploy at all you want the `Foundry Project Manager` role at project scope, because that's the role that can both create the agent and hand `Foundry User` to the platform-created identity. (The Foundry role names were renamed from the old "Azure AI …" ones, so don't be thrown if you see both floating around — the permissions are the same.)

---

## Container and deploy habits that paid off

A few small things that stopped causing me grief once they became reflex:

I build for `linux/amd64`, always — that's the chip architecture Foundry's servers run on. I'm on Apple Silicon (Mac's ARM chips, a different architecture), and the first image I pushed was quietly built for ARM and quietly refused to run. This is now muscle memory:

```bash
docker build --platform linux/amd64 -t myacr.azurecr.io/agent:v1.0.3 .
```

I stopped using `:latest` — the default tag that gets reused for whatever you pushed most recently. Unique, immutable tags (labels that, once set, are never reused for a different build) are the only way I can look at a running agent and actually know what's in it.

I let the platform do the boring parts. Containers serve on port `8088` locally, the gateway handles routing in production, and the protocol libraries expose a `/readiness` endpoint for me — the address the platform pings to check the agent is alive, so I no longer hand-write health checks. I also stopped redeclaring the `FOUNDRY_*` variables (the environment variables whose names start with `FOUNDRY_`); they're injected automatically, and so is the App Insights connection string (App Insights is Azure's monitoring service, covered below). I only declare my own stuff, like the model deployment name — the label identifying which deployed model my agent should call.

And I always test locally first. The container serves the same endpoints on `localhost:8088` (my own machine) that it will in production, so a quick `POST` — a request that sends data in, here a test message — to `/responses` catches most of my dumb mistakes before they cost a deploy cycle:

```bash
curl -X POST http://localhost:8088/responses \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "input": "ping"}'
```

The one constraint that genuinely annoyed me: the container registry holding my image has to stay reachable on its public endpoint, even inside an otherwise network-isolated setup (a deployment walled off from the open internet for security). Locking the registry — ACR, Azure Container Registry — to a private network wasn't supported, so I had to plan around it.

---

## Versions are immutable, and I came to love that

It felt rigid at first. Every version is a frozen snapshot — image, CPU/memory, env vars, protocol config — and you can't tweak a live one. Want to change an environment variable? That's a new version.

But that rigidity is exactly what made rollouts (the act of releasing a new version to users) calm. I split traffic between versions with weighted rollouts (sending, say, 10% of users to the new version and 90% to the old) and run canary or blue-green deploys — two standard ways to release gradually: a *canary* sends a small slice of traffic to the new version first to see if it breaks, and *blue-green* keeps the old version running alongside the new so you can flip back instantly — instead of switching everyone at once. The discipline it forces — *retest every version because you can't patch it* — turned out to be the good kind of friction. (One quirk: if you "create a version" with no actual changes, you don't get a new one. Took me a minute to figure out why my "new" deploy wasn't new.)

---

## The cost surprise, and how I stopped repeating it

This is the part I'd tattoo on a new teammate's hand. The cost model is **per session, not per replica** — you pay for each live conversation, not for a fixed number of server copies — and the CPU/memory you set describes *one session*, not the whole agent. Billing is the sum across every active session. So when I generously sized a 2 vCPU / 4 GiB agent (two virtual processor cores and four gigabytes of memory per session) and then concurrency (the number of sessions running at the same time) climbed, the bill didn't add up — it multiplied.

What fixed it was measuring instead of guessing. I run a representative workload (a test load that imitates real usage), then look at CPU, available memory, request rate, and duration in the linked Application Insights resource (Azure's tool for tracking how your app performs) under Performance. My rule now: if sustained peaks are above roughly 70% of allocation (the CPU and memory I assigned), the next version goes up a tier; if they're well below, it comes down. Then retest, because — again — versions are immutable.

A few things that softened the cost story: idle genuinely costs nothing. Compute deprovisions (the servers get torn down and stop billing) after about 15 minutes of inactivity, so an agent nobody's talking to isn't costing anything. I also got disciplined about cleaning up agents and versions I wasn't using. And I keep an eye on the concurrency quota — the cap on how many sessions can run at once. The default ceiling was 50 active sessions per subscription per region (per Azure billing account, in each datacenter location), which you can raise by asking Microsoft support, but you don't want to discover the limit during a traffic spike.

---

## Sessions and state, once I understood the lifecycle

Each session runs in its own VM-isolated sandbox — a private, walled-off virtual machine, so one session can't see or interfere with another — with a persistent `$HOME` (a storage folder that survives between calls) and a `/files` area. The lifecycle is the thing to internalize: a session goes idle after ~15 minutes without a request, at which point compute is torn down but the state is persisted (saved to disk) and automatically restored when the session comes back. After 30 days of inactivity it's gone for good.

That scale-to-zero-with-resume behavior — the servers shrink to nothing when idle but pick up right where they left off when traffic returns — is great, but it changed how I think about "in progress" work: anything I want to survive an idle gap has to live under `$HOME`. And I watch the disk budget: it's up to 20 GiB (gigabytes of storage) at 1 vCPU or larger, with about a fifth reserved for the system, and the rest shared between my image, `$HOME`, and anything else writable. It's more than enough until it isn't.

The protocol detail matters here too, and it's the same lesson from earlier: Responses manages history for me via a conversation ID (an identifier the platform uses to tie messages together into one thread); Invocations makes the session ID primary and leaves history to my code.

---

## Observability is the difference between operating and guessing

I cannot overstate how much the built-in tracing (the automatic recording of what each run did, step by step) changed my day-to-day. The platform injects an App Insights connection string, and agents using the protocol libraries emit OpenTelemetry traces by default — OpenTelemetry is an industry-standard format for this kind of monitoring data. Being able to reconstruct a run — the prompts (the text instructions sent to the model), the model steps, the tool calls — is how I actually debug behavior instead of theorizing about it.

On top of raw traces, I started evaluating systematically rather than vibes-checking. This is what people mean by **evals** — running the agent against test cases and scoring the results, instead of eyeballing a few and calling it good. The three evaluators (automated graders, each scoring one quality of the output) that earn their keep for me: **intent resolution** (did it understand and scope the request?), **tool call accuracy** (right tool, right parameters?), and **task adherence** (did the final answer stay on task?). And I watch accuracy, latency (how long it takes to respond), and error frequency over time — when tweaking a single agent's prompt stops moving those numbers, that's my cue that the task has outgrown one agent and wants to be decomposed (split into several smaller, specialized agents).

---

## Tools: fewer than you think, scoped tighter than you want

My instinct was to give the agent every tool I could. (A **tool** is a capability you hand the agent so it can do more than talk — search a database, call an API, run a calculation.) Bad instinct. Performance and reliability both got better when I cut the toolset down to ones that were stable, well-documented, and clearly relevant — and when I spelled out *when* to use each.

I also stopped handing the agent broad access. Capabilities go through narrowly scoped APIs (interfaces that expose only one specific, limited action) with strict input validation (checking incoming data is well-formed before acting on it), not direct database reach, and tokens get only the permissions the specific task needs. For Foundry-managed tools I lean on the Toolbox MCP endpoint — MCP, the Model Context Protocol, is a standard way to connect agents to tools — mostly because it consolidates the auth story (how the agent proves it's allowed to call each tool) — identity passthrough, agent identity, key-based — into one place instead of me reinventing it per tool.

---

## Keeping a human in the loop, on purpose

The further I got into agents that *act* rather than just answer, the more seriously I took oversight. These systems do things in the world, and the documented guidance lines up with everything experience taught me: build in real-time controls so a human can authorize, review, and override (a *human in the loop* — a real person who has to approve or can step in before the agent acts) — especially for anything irreversible or high-stakes — and put explicit approval steps in front of critical actions.

Two framings I now design around from the start. **Action boundaries**: which actions are allowed, which are forbidden, which need explicit sign-off. **Domain boundaries**: where the agent is actually meant to operate. And I'm deliberately conservative about high-stakes domains — finance, healthcare, legal, housing — where a wrong move is consequential and compliance isn't optional. When a task gets genuinely complex, I layer the instructions into steps and, past a point, split it across specialized agents rather than overloading one.

---

## If I were starting today

The short version of everything above, the checklist I'd tape to my monitor:

Start on Responses; add other protocols only when the contract forces it. Keep every secret out of the image and out of plain env vars. Put least-privilege permissions on the agent identity and deploy as Project Manager. Build `linux/amd64`, tag uniquely, test on `:8088` first. Roll out with weighted traffic across immutable versions. Match your state model to the protocol and respect the idle and disk limits. Size from measured peaks, not optimism, and remember cost scales with concurrency. Lean on the built-in traces and actually evaluate intent, tool accuracy, and task adherence. Keep the toolset small and scoped. And keep a human able to step in wherever a mistake would hurt.

None of it is exotic. It's mostly the discipline of treating an agent like the production system it is — which, after a while running these, is the one lesson underneath all the others.

---

*Working notes based on time spent with Foundry hosted agents while the feature is in preview. Specifics like regions, quotas, and pricing have moved during that time, so confirm against the current Microsoft Learn docs before relying on any number here.*