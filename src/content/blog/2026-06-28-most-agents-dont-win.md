---
title: "The Most Agents Don't Win — The Best Foundation Does"
pubDate: 2026-06-28
description: "New to building with AI? You'll hear that 'the organization with the most agents wins.' It's the wrong scoreboard. Agents aren't an asset you accumulate — they're the output of everything underneath them. A plain-language argument for why the foundation is the whole game."
author: "Frank Trout"
---

*A note for newcomers: an **agent** is an AI system that can take actions on its own — it reads a situation, decides what to do, does it, looks at the result, and repeats. When I say **foundation**, I mean the unglamorous layer underneath the agents: your data, your context, your ability to see and operate what you've built. This post is about why that layer, not the agent count, is what actually decides who wins.*

I keep hearing it. On stage at conferences, in vendor decks, all over my feed, usually said with the confidence of something too obvious to question: **"The organization with the most agents wins."** Deploy more agents than your competitors, automate more of the work, and you pull ahead. It has the ring of a land grab — plant the most flags, own the most territory.

I could not disagree with it more. Not because agents don't matter — they do — but because *counting* them is measuring the wrong thing entirely. It's a scoreboard that rewards activity and ignores whether any of it works. So here's the version I'd put on the slide instead, and the rest of this post is the argument for it:

> **The organization with the best foundation wins — agents are just what it lets you build.**

## Counting agents is a vanity metric

"Most agents" belongs to a familiar family of numbers that feel like progress and aren't: lines of code shipped, microservices stood up, meetings held. They all measure *how much you did*, not *whether it was worth doing*. The number goes up and to the right and tells you almost nothing about whether you're winning.

The agent version is worse than most, though, because it quietly assumes every agent is an asset — a deposit in the bank. It isn't. An agent built on stale data, fed thin context, or turned loose without anyone watching it isn't a neutral zero on the balance sheet. It's a *liability*. I've written before that a language model fails differently from normal software: [it doesn't error out when it's wrong, it produces a confident, fluent, plausible answer that happens to be fiction](/blog/why-agents-make-things-up). An agent is that failure mode wired up to *take actions* and [chain them — each step's output becoming the next step's input](/blog/the-loop-at-the-heart-of-every-agent). So a bad agent doesn't just sit there being useless. It generates confident wrongness at machine speed and propagates it into whatever it touches next.

Now do the arithmetic the "most agents" crowd skips. If your foundation is shaky, every additional agent is another liability, not another asset. More agents means more failure surface, more confident garbage in more corners of the business, more systems nobody can debug at 2 a.m. **The organization with the most agents on a weak foundation doesn't have the most capability. It has the most exposure.** Counting agents measures how much risk you've deployed and calls it a lead.

## Agents are an output, not an input

Here's the reframe at the center of all this. The "most agents wins" framing treats the agent as the *input* — the thing you add to the org to produce results. Buy the intelligent layer, bolt it on, get the win.

But an agent doesn't generate capability out of nothing. It *expresses* the capability that already exists underneath it. An agent is only as good as the data it reasons over, the context it's handed each step, the tools it can reach, and your ability to see what it's doing and stop it when it's wrong. Every one of those is a property of the foundation, not the agent. The agent is downstream of all of it. It's the *output* of the foundation — the visible thing the invisible layer lets you build.

This is why the same agent design lands brilliantly in one company and embarrassingly in another. The model is the same. The framework is the same. What differs is everything underneath. As I put it when writing about [how the LLM reshapes your whole architecture](/blog/the-llm-is-not-a-function-call), the model is a small thing in your code and an enormous thing in your design — and that design *is* the foundation. Strong foundation, and an ordinary agent looks like magic. Weak foundation, and the most sophisticated agent in the world looks like an expensive, confident liability.

## What the foundation actually is

"Foundation" is easy to wave at and hard to pin down, so let me be specific. It's the boring layer everyone wants to skip on the way to the demo:

**Data you can trust.** Agents reason over your data, and [output quality is capped by input quality no matter how good the model is](/blog/bad-data-bad-ai). Stale, duplicated, contradictory, or unsourced data doesn't get fixed by a smarter agent — it gets *laundered* by one, dressed up in a confident answer with a citation pointing at the rot. Clean, current, traceable data is the single biggest lever you have, and no number of agents substitutes for it.

**Context you can assemble.** [A decision is only as good as the context behind it](/blog/it-will-decide-for-you-but-based-on-what). An agent's every move is a decision made from whatever information it was handed that turn. The plumbing that gets the *right* facts in front of it at the *right* moment — retrieval, memory, the systems that feed the model — is foundation work, and it sets the ceiling on how good the agent's decisions can possibly be.

**Operations you can see.** An agent you can't observe is an agent you can't trust, debug, or improve. Per-step traces, evaluation harnesses (the checks that score whether the agent actually did the right thing), the ability to halt a run that's gone wrong — this is what separates [operating an agent from merely deploying one](/blog/you-havent-earned-aiops-yet). Anyone can launch an agent. The win is being able to *run* it.

**Engineering maturity to stand on.** Instrumentation, clean deploys, infrastructure you can describe and roll back, least-privilege access so a confused agent can't reach the systems where a mistake is catastrophic. The same discipline that makes any production system reliable is what makes an *autonomous* system survivable.

Notice the pattern: none of these are about the agent. They're all about the layer beneath it. And every one of them is something you have to *build*, slowly and unglamorously — which is exactly why the "most agents" framing is so seductive.

## Why "most agents" is really a way to skip the work

There's a move here I keep seeing, and it's the same one I called out with AIOps: reaching for the exciting layer as a way to avoid the tedious one. The actual work of building the foundation is a slog — cleaning data, reconciling sources, wiring up observability, defining what good looks like, getting deploys boring. Nobody gets to demo a quarter spent making their data trustworthy.

So "deploy more agents" gets sold as the shortcut. Skip the foundation, buy the intelligent layer, leapfrog the tedium. But the tedium is load-bearing. The agents have nothing to be smart *about* until the foundation exists, and pile enough of them onto a weak one and you haven't leapfrogged anything — you've just automated the chaos faster and scaled your blast radius to match. You cannot purchase your way past the foundation any more than you can [purchase your way past data quality](/blog/bad-data-bad-ai). You can only build it. And once you have, the agents on top of it suddenly look brilliant — not because the agents got better, but because you finally gave them something real to stand on.

This is also why the restraint matters. The discipline isn't deploying the most agents; it's [deploying the simplest one that closes a real gap, and earning every bit of complexity past that](/blog/simplest-agent-that-could-possibly-work). Ten well-founded agents that work beat a hundred that sprawl — and the org chasing the count usually can't tell the difference until it's deep in a system nobody can operate.

## The scoreboard that actually matters

If "how many agents have we deployed?" is the wrong question, here's the set that's right — and notice every one of them points at the foundation, not the count:

- **Can our agents trust the data they reason over?** Is it current, deduplicated, and traceable to a source of truth — or are we laundering rot through a confident interface?
- **Can we get the right context in front of an agent at the right moment?** Or are its decisions only as good as a half-assembled, stale view of the world?
- **Can we see what every agent did, and why?** Per-step traces, real evals, the ability to stop a run cold when it goes wrong.
- **Is a confident mistake survivable?** Least privilege, human approval on the irreversible stuff, a bounded blast radius by design.
- **Did we earn each agent we deployed?** A measured gap it closes — not a flag planted to run up the count.

An organization that can answer those will quietly out-execute the one boasting about its agent headcount, because its agents actually work — and the other one is busy discovering, at scale, that a hundred agents on a cracked foundation is just a hundred ways to be confidently wrong.

## The reframe

Stop picturing agents as territory to grab. Picture them as what they are: the visible expression of the unglamorous layer underneath. The foundation is the part nobody live-tweets — the clean data, the assembled context, the observability, the engineering discipline, the restraint to build one good thing instead of ten mediocre ones. It's also the part that decides everything, because the agents are downstream of all of it. They inherit its quality, faithfully, and amplify it in whichever direction it points.

So when you hear "the organization with the most agents wins," push back. The winner won't be the one with the most agents. It'll be the one whose foundation is so solid that the agents it builds on top are reliable, observable, and trusted — and there's no number of agents, however large, that sells you a shortcut past the part you have to build yourself. The most agents don't win. The best foundation does. The agents are just what it lets you build.
