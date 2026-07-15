---
title: "Multi-Agent: When It's Actually Worth It"
pubDate: 2026-07-15
description: "Most multi-agent systems are premature — but there's a real bar, and clearing it makes splitting genuinely right. The honest question was never 'how many agents?' It's whether a sub-task needs its own reasoning *and* its own context. The two things 'multi-agent' can mean, the five cases that justify the split, the compounding costs you're signing up for, and the tells you're forcing it."
author: "Frank Trout"
---

Every architecture diagram I've been handed in the last year has the same disease. Seven boxes. A Planner, a Researcher, a Writer, a Critic, a Supervisor, and two more whose jobs blur together if you read the labels twice. Arrows everywhere. And when I ask the obvious question — *why is the Critic a separate agent instead of a second prompt in the same loop?* — the answer is almost never architectural. It's aesthetic. More boxes looked more serious.

So let me say the unpopular half first, and then spend the rest of the post on the popular half, because this is a two-sided argument and I actually mean both sides. **Most multi-agent systems are premature — but there is a real bar, and when you clear it, splitting is genuinely the right call.** The failure isn't that people build multi-agent systems. It's that nobody asks the question that decides it. And the question isn't "how many agents should we have?" — count is [the wrong scoreboard entirely](/blog/most-agents-dont-win). The question is narrower and much harder to fake: **does this sub-task need its own reasoning *and* its own context?**

Both halves. Not one.

## Two very different things wear the same word

Before the decision, a definition — because "multi-agent" is doing double duty, and the two things it names have almost nothing in common.

An **agent** is a system where a model decides its own steps in a loop, calling **tools** (functions that let it reach or act on the world) until it's done. **Multi-agent**, then, means more than one of those in a system together, with some **orchestration** — the plumbing deciding who runs when and who hands what to whom. That's the whole word. It says nothing about the shape, and the shape is everything.

**Agent-as-tool** is the disciplined version. One main agent runs the loop. When it hits a sub-task with a clean boundary, it calls a narrow sub-agent that has *one crisp job*, a defined input, and a defined output — and then it gets an answer back. From the caller's side, that's it: it's just another tool. It doesn't know or care that there's a model in there. The interface is a function signature; the fact that reasoning happens behind it is an implementation detail. This is what "multi-agent" should almost always mean, and it's the natural next rung on [the ladder from the simplest thing that could possibly work](/blog/simplest-agent-that-could-possibly-work) — you add a rung when the current one is provably out of room, not because the ladder looks taller with more.

**The peer swarm** is the other thing. A committee of agents, all roughly equal, passing messages around a shared conversation until consensus emerges. The Planner tells the Researcher, who tells the Critic, who disagrees with the Writer, who loops back to the Planner. It sounds powerful. It demos beautifully. And in production it is usually undebuggable, because there's no seam to cut: the answer wasn't produced by any one component, it *emerged* from a conversation, and when it emerges wrong you have a transcript, not a stack trace. You can't unit-test a vibe between five agents.

If you only take one thing from this post: **the boundary you're looking for is a contract, not a conversation.** Everything below is downstream of that.

## When it's actually worth it

Here's the affirmative case, and I want it read as generously as [the case for agents](/blog/the-case-for-agents) — because splitting, done for the right reason, is one of the better moves available. Five reasons clear the bar. Note that they're all *shapes of the sub-task*, not properties of the org chart.

**1. It's a genuine reasoning sub-task a plain function can't do.** Summarize a messy document. Critique a draft against a rubric. Research an open question where the next lookup depends on what the last one returned. There's no `def summarize()` that does this — it needs a model. If your candidate sub-agent's job *could* be a function, it should be one; a function is faster, cheaper, deterministic, and testable, and dressing it as an agent buys you nothing but latency. But when the job genuinely requires judgment, a sub-agent is the right shape for it.

**2. Context isolation — and this is the real, underrated one.** The **context window** is the working memory the model sees on every call, and it is a hard budget. Now picture the main agent needing one fact out of forty search results, or one conclusion from a 200-page PDF. Doing that inline means the raw material — all of it, every dead end — lands permanently in the main agent's window, where it will sit for the rest of the run, costing money on every subsequent call and crowding out the thing the agent is actually supposed to be doing. Hand it to a sub-agent instead and the sub-agent eats the mountain, does the sifting in its *own* window, and returns three sentences. The mess never touches the caller.

That's a **context-management** move at least as much as an architectural one, and I'd argue it's the single most defensible reason to split. [Context engineering is the job](/blog/context-engineering-is-the-job) — the window is a budget you spend deliberately — and a sub-agent is one of the cleanest instruments you have for spending it well. The sub-agent is a *filter*. It converts a pile of raw material into a distilled answer and throws the pile away. If you can't articulate what the sub-agent is filtering *out*, you may not have found a real boundary yet.

**3. One context is juggling two jobs and doing both worse.** Ordinary separation of concerns, applied to attention. An agent holding "be a rigorous, skeptical critic" and "be a fluent, generous writer" in one window will be a mediocre version of both — the instructions actively fight, and the model splits the difference. Two contexts, each with one clear mandate, each does its own job better. This is the same instinct that makes you break a 900-line function apart, pointed at prompts.

**4. Genuinely parallel independent work.** Three unrelated investigations that don't need each other's results — check these ten repos for a pattern, research these five vendors, audit these eight configs. Fan them out, fold the answers back in. The word doing the work here is *independent*. If step two needs step one's output, that's not parallelism, that's a sequence, and running it "in parallel" just means it's a sequence with extra coordination bugs.

**5. Different tools or permissions per role.** This one gets undersold because it reads as plumbing, and it isn't — it's the strongest structural argument on the list. If the summarizer sub-agent is handed no write tools at all, it *cannot* take an action. Not "was instructed not to." Cannot. That's a real boundary enforced by the runtime rather than by a paragraph of prompt the model follows probabilistically. [Giving an agent authority is a security decision](/blog/giving-an-agent-authority-is-a-security-decision), and splitting roles lets you make that decision precisely — least privilege per job, instead of one omni-agent holding every credential in the building because one of its fourteen jobs needed it.

Clear one of those with a straight face and you should split without apology. That's not over-engineering. That's the architecture matching the shape.

## What you're paying for it

Now the invoice, because it's real and it's rarely costed before the diagram gets drawn.

**More calls: latency and money.** **Latency** is the wait between asking and answering. Every hop is another round trip to a model, and they stack. An agent that answers in eight seconds becomes a five-agent pipeline that answers in forty, and every extra call is billed. Users feel forty seconds. They do not feel your architecture diagram.

**Errors compound, and the math is worse than intuition suggests.** Chain five steps that are each 95% reliable and you land around 77% overall — not 95%. "Each piece works pretty well" is exactly how you get a system that fails a quarter of the time while every component passes its own tests. Every hop is a multiplication, and you don't get to opt out of the arithmetic.

**Debugging becomes distributed-systems archaeology.** A single agent gives you one trace to read. Five agents give you a bisection problem: which hand-off corrupted the state? Agent three received bad input from agent two, which was reacting to an ambiguous framing from agent one, and nobody's transcript is obviously wrong on its own. You've traded a bug for an investigation.

**Every hop is a place context gets lost in translation.** Sub-agents talk in natural language, which is lossy. The caller asks for one thing, the sub-agent hears something adjacent, and the answer that comes back is confidently about the wrong question. Nobody errors. Nothing crashes. The output is just subtly not what was asked for — and this failure is silent, which makes it the expensive kind.

None of this makes multi-agent wrong. It makes it *expensive*, and expensive things need to be worth it. Which brings us to the bar.

## The bar

Three conditions. Not one, not two. All three, together:

1. **You have evidence the single agent plateaued — from evals, not vibes.** **Evals** are a repeatable test set that turns "it feels better" into a number. Without them, "the single agent wasn't good enough" is a story you told yourself right before doing the more interesting thing, and half the time the real fix was a better prompt or a sharper tool description. [You can't improve what you can't measure](/blog/you-cant-improve-what-you-cant-measure) — and you also can't honestly claim you've hit a ceiling you never instrumented. Prove the plateau. Then split.
2. **The sub-task genuinely needs reasoning *and* its own context.** Both. Reasoning without a context problem is a prompt in the same loop. A context problem without reasoning is a function. It's the *conjunction* that earns the hop.
3. **You can define a clean contract you can test in isolation.** Defined input, defined output, testable on its own without the rest of the system running. If the sub-agent can't be tested alone, it isn't a component — it's a co-dependency wearing a component's name tag.

And the fastest version of the whole test, the one I'd put on a sticky note: **if you can't state the sub-agent's job in one sentence, you're not ready.** Not one paragraph. One sentence, with one verb. "Summarize this document against these criteria." "Find every place this pattern appears in the codebase." If it takes a paragraph and the word *and* shows up twice, you haven't found a boundary — you've found a region of your problem you haven't understood yet, and splitting it now just distributes the confusion across more processes.

## The tells you're forcing it

Four patterns. When I see one, I stop and ask what we're actually buying.

| The tell | What it actually means |
| --- | --- |
| The sub-agents always run in the same order | That's a **workflow** — you already know the steps, so write them down as code and get determinism for free |
| A sub-agent has no real decision to make | That's a **function** — you're paying a model call for something `if/else` does perfectly |
| You added agents because it sounded powerful | That's **architecture as theater** — the diagram got more impressive; the answers didn't |
| You can't tell which agent caused a bad answer | You **don't have components**, you have a fog — nothing to isolate, nothing to fix |

That first one deserves a beat, because it's the most common by a mile. If the Planner always runs, then the Researcher, then the Writer, then the Critic — every time, in that order — you have not built a multi-agent system. You've built a pipeline with a model in each stage and none of the guarantees a pipeline would have given you. [If you can write the steps down, it's a workflow](/blog/when-not-to-build-an-agent), and a workflow is *better*: cheaper, faster, deterministic, debuggable. The agency you paid for is the ability to decide what happens next, and if nothing ever decides anything, you bought a stack of dice and rolled the same number on purpose.

## The reframe

Multi-agent isn't an achievement. It's a cost you take on to buy something specific, and the entire discipline is being able to name the thing you're buying before you sign.

So stop asking how many agents the system should have. Count was never the scoreboard — a great single agent beats a mediocre committee every day, and it's easier to debug at 2am. Ask instead, for each candidate split: *does this sub-task need its own reasoning, and does it need its own context?* Both yeses, plus eval evidence the current thing plateaued, plus a contract you can state in one sentence and test alone — split it, and split it with a clear conscience, because that's not complexity, that's the shape of the problem showing through. Anything less, and you're paying compounding error rates and distributed debugging for a diagram that photographs well.

The best multi-agent systems I've seen don't look like swarms. They look like one agent that knows how to delegate — narrowly, to a small number of sharp sub-agents with one job each, a clean interface, and a distilled answer coming back. That's not a committee. That's just good engineering, applied to a new kind of component. The model is new. The rule isn't: **earn the complexity, or don't add it.**
