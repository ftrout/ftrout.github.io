---
title: "How I Explain AI Risk to the CISO"
description: "Leadership does not need to know what a context window is. They need to know what the system can touch, how you know it works, and what happens when it is wrong."
pubDate: 2026-08-21
tags: [leadership, llm-evals]
draft: false
---

The first time I briefed leadership on the triage agent, I had a slide about
how large language models work. Tokens, attention, a diagram with arrows. I
was about forty seconds into it when the CISO asked, politely, what it could
delete.

That was the right question, and my slide did not answer it. I had prepared
for a technology briefing. I was in a risk briefing. Those are different
meetings, and I have run the second kind ever since.

## The three questions

Every AI conversation I have had with security leadership reduces to three
questions, whether or not anyone says them out loud.

1. **What can it touch?** Which systems, with which permissions, and what is
   the worst single action it could take.
2. **How do you know it works?** Not "it seems good." What you measured, on
   what, and how often you measure it again.
3. **What happens when it is wrong?** Because it will be. Who notices, how
   fast, and how you undo it.

If you can answer those three clearly, the meeting goes well regardless of how
much anyone in the room knows about models. If you cannot, no amount of
architecture diagram will save you.

## What can it touch

This is the question I now open with, and I answer it with a table rather
than prose. Every tool the system has goes in one row, sorted by blast
radius.

| Tier | What it means | Example | Control |
|---|---|---|---|
| Read | Looks things up, changes nothing | Query the SIEM, look up an asset owner | Logged |
| Draft | Writes something a human sends or files | Triage note, ticket summary | Human edits before use |
| Act, approved | Changes something after a named person approves | Isolate a host, disable an account | Approval gate in code |
| Act, autonomous | Changes something with no human step | None, currently | Not deployed |

That last row is the one leaders care about most, and it is worth being able
to say "none" and mean it. When it stops being none, that is a decision they
should make with you, not a deployment detail they hear about later.

The important word in the third row is "in code." A prompt that says "always
ask before isolating a host" is a request. A tool that refuses to run without
an approval record is a control. Security leaders understand that distinction
instantly, because it is the same one they make about every other system.

## How do you know it works

Here is where I used to say "it is about 90% accurate," and here is why I
stopped.

A single accuracy number invites the obvious follow-up, which is "90% of
what?" and then "what is in the other 10%?" If the answer is "some
low-severity alerts it marked as needing review," that is fine. If the answer
is "two confirmed intrusions it closed as benign," that is not fine, and the
average hid it.

What I report instead is shaped like the risk:

- **Misses on the cases that matter.** Of the confirmed-malicious cases in the
  evaluation set, how many did it get wrong, and what were they. A number and
  a list.
- **What the evaluation set is.** Where the cases came from, how many, how
  recent. "Real closed alerts from the last quarter, labelled by the analysts
  who worked them" is a very different claim from "examples we wrote."
- **How often we re-run it.** Every change to the prompt, the model or the
  tools. A result from three months ago about a system that has changed since
  is history, not evidence.

This is what [the evals series](/blog/evals-01-why-i-came-around/) is about in
practice. The CISO does not need to know the difference between a
code-graded check and [a model grading a model](/blog/evals-03-llm-as-judge/).
They need to know that the measurement exists, that it runs on every change,
and that it reports misses rather than averages.

## What happens when it is wrong

I answer this one with a story rather than a policy, because a story proves
the policy works.

Pick a real failure. There will be one. Walk through who noticed, how long it
took, what the impact was, and what changed afterwards. The version that lands
best is the one where the answer to "who noticed" is "the evaluation, before
it shipped," but an honest account of something that reached production and
was caught by review is almost as good.

What leaders are listening for is whether there is a loop. A system that is
sometimes wrong and gets measurably less wrong is a normal engineering
system. A system that is sometimes wrong and nobody can tell you how often is
a liability, however good the demo was.

## Things I have stopped saying

**"The AI decided."** It did not decide anything. A system we built produced
an output, and our process either acted on it or did not. Language that gives
the model agency also quietly moves the accountability off us, and a good
CISO will notice.

**"It is like a junior analyst."** It is not, and the comparison sets the
wrong expectations in both directions. A junior analyst gets better with
feedback on their own, knows when they are confused, and never confidently
invents a log field. The model does none of those things, and it can read
four hundred alerts before lunch.

**"It will free up analyst time."** Maybe. Say what the analysts will do
instead, or say you do not know yet. "Free up time" sounds like a headcount
conversation, and if that is not the plan, do not let it sound like one.

**Anything about the model being smart.** Capability claims age badly and
invite the wrong kind of trust. "It handles these four alert types well and
we do not use it for anything else" ages fine.

## The one-page version

When I need to leave something behind, it is one page with five headings:

1. **What it does.** One paragraph, in terms of the work, not the technology.
2. **What it can touch.** The tier table above.
3. **How we measure it.** The evaluation set, the last result, the misses.
4. **When it was last wrong.** What happened and what changed.
5. **What we are asking for.** A decision, a budget, a scope change, or
   nothing, in which case say that.

It fits on a page because it has to. If a section needs more room, that is
usually a sign I do not understand it well enough yet, which is useful to find
out before the meeting rather than during it.

## The part that surprised me

I expected leadership to be the sceptical audience. In practice the hardest
questions came from the analysts, who were being asked to trust the output,
and the easiest conversations were with the CISO, who mostly wanted to know
that someone had thought about the failure cases and could show their work.

Which, in retrospect, is what a security leader asks of every system. The
model is not special. The briefing should not be either.
