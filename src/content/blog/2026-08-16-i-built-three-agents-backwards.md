---
title: 'I Built Three Agents Backwards'
description: 'Multi-agent where a workflow would do, a yes before I had seen the data, and a system I made worse without noticing.'
pubDate: '2026-08-16'
tags: ['agents', 'evaluation', 'security']
---

Three projects, three different problems, and the same mistake wearing different clothes
each time. In all three I started from the answer and worked backwards toward the problem.

This was late 2025, when I was first starting to build AI systems. The three were far
enough apart that I didn't see the pattern until the third one, which is part of why I'm
writing it down now rather than then.

## Reaching for the most complicated thing

The first was a system to run threat intelligence against firewall exception requests.
Somebody asks for a hole in the firewall; the system goes and finds out what's known about
the destination before a human signs off on it.

I built it as a multi-agent system. A swarm, agents conferring with each other, the whole
arrangement. I can tell you exactly why, because the reason wasn't technical: that was what
an impressive AI system looked like to me, and this felt like a problem that deserved one.

What it turned into was a mostly deterministic workflow with a model doing one narrow job
inside it — pull the details out of the request, return an approval or a disapproval. The
orchestration I'd been most pleased with turned out not to be holding anything up. Most of
the work had a right answer that ordinary code could compute and check. The part that
genuinely needed a model was small, and once I'd found its edges it was easy to specify.

That cost time and money. The money was the more uncomfortable half, because I could watch
it accruing while I told myself the architecture was nearly there.

What I'd got wrong is that **complexity in a system is supposed to come from complexity in
the problem**. Mine came from somewhere else entirely — from what I'd decided the solution
should look like before I'd finished looking at the problem.

## Saying yes before I'd looked

The second was a third-party risk assessment agent, and my mistake happened before any code
did. Somebody asked whether AI could help with it, and I said yes.

Not "yes, let me understand how you do this today." Just yes.

Then I built toward an imagined version of the process. I filled in its shape from what a
third-party risk assessment sounds like it ought to involve, because I had never watched
anyone actually perform one. The design I produced was coherent. It was coherent about
something that didn't exist.

When I finally got in front of the real process, two things were true that I hadn't
allowed for. Some of what I needed wasn't reachable programmatically. And some of it wasn't
recorded anywhere at all — not stored awkwardly, not hard to query, simply never written
down by anyone. An agent cannot retrieve a fact that nobody ever wrote.

So I backtracked and re-engineered around what actually existed, which is the work I'd have
done first if I'd asked a single round of questions before opening an editor.

The signal I've learned to distrust since is my own fluency. When I can describe someone
else's process smoothly and I have never watched them do it, that smoothness is invented.
It feels like understanding, and it is the opposite.

## Shipping something worse without knowing

The third was an alert triage agent for the secops team. I made changes. The changes felt
like improvements. I shipped it.

It was worse. I didn't know.

I want to be precise about the failure, because "should have written evals" undersells it.
The problem wasn't that I was missing a test suite. It was that I had no instrument at all,
so "better" was a feeling I was having about my own work. I judged each change by reading a
few outputs and deciding I liked them more than the ones before. That method cannot detect
a regression. It can only detect whether I'm pleased.

Triage makes this particularly dangerous, because the direction of an error matters far
more than its size, and the two directions do not look different from outside. A system
that has quietly got more willing to dismiss produces a quieter queue, faster throughput,
and fewer things arriving on an analyst's desk. So does a system that genuinely improved.
Those are the same surface readings. Without a labelled set and a metric that punishes the
expensive direction specifically, I had no way to tell which one I had — and for a while I
didn't know that was a thing I needed to be able to do.

I still can't tell you what that one cost. I didn't have the instrument then either, and
you can't go back and measure a period you weren't measuring.

## The same mistake three times

Written out they look like three separate errors: too much architecture, too little
discovery, no measurement. They're one error at three different stages. Every time, I
decided what to build before I understood what I was building for.

What makes that hard to catch is that none of it felt like guessing while it was happening.
The multi-agent design felt like ambition. The quick yes felt like responsiveness. Shipping
on a good feeling felt like momentum. Guessing feels like all three of those from the
inside, which is why I needed to make the mistake in three different shapes before I
recognised it.

## What I do differently

I find out what the process actually is, from someone who does it, before I design
anything. Watching beats asking — people describe the tidy version of their workflow, not
the real one with the shortcuts in it.

I get the data question answered early, because sometimes the answer is "that isn't
recorded anywhere," and that changes the entire shape of what's possible. Better to learn
it in week one than after the architecture is built on the assumption.

I build the least impressive version that could work, and get a number out of it, before I
make anything clever. The dumb version is usually better than I expect, and it tells me how
big the actual gap is.

Then I let the measurements decide when something needs more architecture, rather than
choosing the architecture first and going looking for evidence afterwards.

None of that is clever, and I don't think any of it would have persuaded me in advance. It
took building three things in the wrong order. What I have now is that sequence written
down as an actual procedure, mostly so the next version of me has to work harder to skip a
step — because the steps were never the part I got wrong. The order was.
