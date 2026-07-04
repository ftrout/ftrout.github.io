---
title: "The Case for Agents (From Someone Who Keeps Saying 'Don't')"
pubDate: 2026-07-08
description: "I've written 'when not to build an agent,' 'the most agents don't win,' and 'I didn't build an agent.' A reasonable reader could conclude I think agents are bad. I don't. An agent is a specialized power tool with a real sweet spot — and when your problem lands in it, refusing to build one is its own mistake. Setting the record straight."
author: "Frank Trout"
---

If you've read much of what I write here, you could be forgiven for thinking I have it out for agents. I've argued [most tasks don't need one](/blog/when-not-to-build-an-agent), that [the org with the most agents doesn't win](/blog/most-agents-dont-win), and that the best move on a real project was often to [not build an agent at all](/blog/i-didnt-build-an-agent). Read those back to back and the takeaway sounds like: *agents are bad, avoid them.*

That's not what I believe, and I want to set the record straight. **An agent isn't a bad tool. It's a specialized one — a genuine power tool with a real sweet spot — and when your problem lands in that sweet spot, an agent isn't merely acceptable, it's the best answer, and refusing to build one is as much an engineering mistake as reaching for one you didn't need.** The restraint I keep preaching was never anti-agent. It was pro-*right-tool*. Those are very different positions, and I've let the first one overshadow the second.

So this is the other half of the argument. Not "don't build agents." *Build the agent — when the problem actually wants one.*

## The error cuts both ways

Every piece I've written on restraint is about one failure mode: **over-building.** Reaching for an agent — a language model (the AI behind tools like ChatGPT and Claude) running in a loop where it decides its own next move — when a single call, a fixed workflow, or plain code would have been simpler, cheaper, and more reliable. That failure is real and it's common, and I stand by every word of it.

But it has a mirror image I've spent almost no time on: **under-building.** Forcing a genuinely open-ended problem into a rigid pipeline because "agents are risky." And that error is just as real. Take a problem whose steps truly can't be known in advance — where what to do next honestly depends on what you discover along the way — and jam it into a fixed sequence, and you get a brittle system that works on the inputs you imagined and shatters on the ones you didn't. You end up in an endless treadmill of bolting on another branch, another special case, another `if`, forever chasing a long tail of situations a model would have simply *handled*. Sometimes the hand-coded flowchart isn't the safe choice. It's the fragile one.

Good engineering isn't "always pick the simplest tool." It's "pick the tool that fits the shape of the problem." For most problems that's something simpler than an agent. For some problems, the fit *is* an agent — and picking anything less is under-engineering.

## What agents are genuinely great at

Here's the affirmative case, stated plainly: the autonomy that makes an agent risky in the wrong place is exactly what makes it powerful in the right one. The whole reason an agent exists is to handle tasks where **you cannot write the steps in advance** — and that's not a rare edge case, it's a real and important category of work.

An agent is the right tool when:

- **The path genuinely can't be known ahead of time.** The next action depends on what the last one turned up, and the branches are too many, too varied, or too unpredictable to enumerate in code. This is the core signal. If you truly can't draw the flowchart — not "won't," *can't* — you're looking at an agent-shaped problem.
- **The task is open-ended exploration.** Researching a question where each finding reshapes the next query. Debugging, where the next probe depends on what the last one revealed. Triaging an incident whose cause you don't know yet. Navigating an unfamiliar codebase to make a change. These aren't fixed procedures with some variance; they're genuinely different every time, and a model adapting step by step will run circles around any pre-written sequence.
- **The alternative is worse.** When hand-coding every path would produce a system so sprawling, brittle, and incomplete that it's *less* reliable than letting a well-fenced model decide. Sometimes the flexible tool is the robust one, because reality has more cases than your `switch` statement ever will.

In those situations the loop — [decide, act, observe, repeat](/blog/the-loop-at-the-heart-of-every-agent) — isn't overhead you're tolerating. It's the entire value. A coding agent that explores a repo, runs a test, reads the failure, and adjusts is doing something no fixed pipeline could, because the pipeline would have to know the answer in advance to script the route to it. The agent's ability to *not* know, and to figure it out, is the product.

## The tell (the same test, pointed the other way)

I've offered one test more than any other: *can you write the steps in advance? If yes, you don't need an agent.* People hear the "no agent" half. But read the whole thing — it's a two-way test, and the *other* branch matters just as much:

> If you genuinely **cannot** specify the steps ahead of time — because they depend on results you can't see until you're running — then you have an agent-shaped problem, and you should build the agent.

That's not a grudging concession. It's a real answer to a real class of problems. The discipline was never "avoid agents." It was "be honest about which kind of problem you have." Force an agent onto a problem you could have scripted and you've added cost and unpredictability for nothing. But refuse an agent on a problem you genuinely *couldn't* script, and you've signed up to hand-code an open-ended space — which you will do badly, forever. Both directions are a failure to match the tool to the shape.

## "Boring and reliable" is the goal, not "never autonomous"

My case study on choosing a deterministic pipeline over an agent [wasn't a verdict that agents lose](/blog/i-didnt-build-an-agent). It was a verdict about *that* problem: a finite set of specifiable, high-cost-of-error deliverables — the textbook case for a workflow. Change the problem and the answer changes with it. If that same team had needed something genuinely exploratory — "go investigate this ambiguous vendor situation and figure out what questions even need asking" — an agent would have been the *right* call, and a rigid pipeline the wrong one. The principle produced a "no" there because of the problem's shape, not because of a bias against autonomy. Point it at a different shape and it says "yes" just as confidently.

## When you do build one, build it boldly — and well

So if your problem is genuinely agent-shaped: build the agent, and don't be timid about it. But "boldly" doesn't mean "carelessly" — the reason my other posts read cautious is that an agent's power comes bundled with real obligations, and the way you earn the upside is by handling them:

- **Understand the loop.** [The whole game is what the model sees each turn, how honest its feedback is, and when it's allowed to stop.](/blog/the-loop-at-the-heart-of-every-agent) An agent you understand is an asset; one you don't is a liability.
- **Design the tools like the interface they are.** [The agent's tools are a UI you're building for a model](/blog/the-tool-is-the-interface) — the better that interface, the better every decision it makes.
- **Scope the authority deliberately.** [Autonomy plus access is a security decision](/blog/giving-an-agent-authority-is-a-security-decision); least privilege and a human gate on the irreversible are what make bold autonomy safe.

Do those, and the agent's flexibility becomes a genuine superpower instead of a source of 2 a.m. mysteries. The caution in my other writing was never "don't." It was "this tool has a bill attached — and when the problem is worth it, pay the bill and build the thing properly."

## The reframe

Read straight through, my whole argument was only ever one sentence: **match the tool to the shape of the problem.** Most problems are simpler than they look, so most of the time that sentence points *away* from an agent — which is why I've spent so many words there. But the sentence has another side, and it's just as true: some problems are genuinely open-ended, unpredictable, and exploratory, and for those an agent isn't a risk you're indulging — it's the correct, powerful, and sometimes only good answer.

Agents aren't bad. Autonomy isn't a vice. A model deciding its own path is a remarkable capability, and when your problem actually needs it, you should reach for it without apology — and then build it with the care a powerful tool deserves. The mistake was never *using* the power tool. It was using it on a problem that wanted a screwdriver — or refusing it on the one job that genuinely needed the saw.

So: don't build an agent when you don't need one. And when you *do* need one — build it, build it well, and don't let a guy who keeps saying "don't" talk you out of the thing your problem was actually asking for.
