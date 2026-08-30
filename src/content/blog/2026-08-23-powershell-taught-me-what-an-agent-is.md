---
title: 'PowerShell Taught Me What an Agent Is'
description: 'Every SDK I had used hid the thing I was trying to learn. So I built one in a language that has no SDK.'
pubDate: '2026-08-23'
tags: ['agents', 'tool-use']
---

For a while I could build things with agent frameworks without being able to tell you what
an agent was.

That sounds like a contradiction and it isn't. The SDKs are good. You import a library,
define some tools, hand it a prompt, and something works. I shipped things that way. But if
you had asked me to explain the harness, or what memory actually was, or what happens
between the model deciding to use a tool and my function running, I would have produced an
answer with the right words in it and no mechanism underneath.

The gap doesn't announce itself, because the code runs. What fills it is imagination. The
agent becomes a magical box, and once something is a magical box you can't reason about
what it costs, where it will fail, or whether you needed it.

## Why PowerShell

The thing that finally fixed this was a pet project, and the useful decision was the
language.

I've used PowerShell for years. There's no SDK for this in PowerShell — so there was
nothing to import that would do the interesting part for me. I'd have to make the HTTP
calls myself, assemble the request by hand, read what came back, and work out what to do
about it.

That's the whole trick, and I didn't plan it this way. Because I already knew the language,
none of my attention went to syntax or tooling. The only unfamiliar thing in the room was
the agent itself. Every previous attempt to learn this had me picking up a framework, a
package manager, an idiom, and the concept all at once — and the concept is the one that
loses when four things compete.

I gave it a deliberately trivial task. I wasn't trying to build something useful. I was
trying to see the mechanism, and a real problem would have given me somewhere to hide.

## Four things I only understood by building it

**The loop is a conditional loop.** That's it. You send a request. The response either
contains a request to use a tool or it doesn't. If it does, you run the thing, add the
result to the conversation, and send it again. If it doesn't, you're finished. I had
imagined something more elaborate — a scheduler, a planner, something *supervising*. There
is no supervisor. There is a `while` and a condition.

**The model drives, and my code reacts.** This was backwards from how I'd pictured it. I
thought my program was in charge and the model was a function I was calling. In practice
the model decides what happens next and my code's job is to answer. When the task needed
several tools, it asked for several tools — I didn't orchestrate that, and there was
nowhere in my script where I could have. The control flow lives on the other side of the
API call.

**Memory is not a thing.** This is the one that most needed dismantling, because the word
does so much work. In my agent, memory was the input and output appended to the request.
That's all it was. Nothing persists anywhere, nothing is stored, nothing is recalled. The
model has no idea what happened last turn except that I told it again, in the same request,
along with everything else. Every framework feature I'd seen described as memory is some
strategy for deciding what to put back into that array.

**The entire conversation gets resent every turn.** I knew this in the sense that I could
have said it out loud. I didn't know it in the sense that changes what you build. A
ten-turn agent is not ten times the cost of a one-turn agent, because turn ten carries
turns one through nine on its back. Watching that happen — in a script where I was the one
concatenating the array — is what made token cost feel like a design constraint rather than
a line on an invoice.

## What it changed

I still use the SDKs. This isn't an argument for writing everything by hand, and building
that agent taught me nothing about how to ship one properly. It was a few evenings on a
toy.

What it changed is that the box stopped being magic. Once you've watched the loop run, an
agent in its most basic form is some API calls, a conditional loop, and some functions.
Plenty gets built on top of that, and the hard parts of my job live up there — but this is
the floor, and I'd been working several storeys above it without ever having seen it.
That's not a diminishment. It's the first time I could reason about one. You can estimate what a design will cost
before building it. You can guess where it will break. And you can ask the question that
doesn't occur to you while the box is still magic: does this need to be an agent at all?

That question turned out to matter more than anything else I learned that year. It's most
of [what went wrong on the three projects before
it](/blog/i-built-three-agents-backwards/) — I was reaching for an architecture I couldn't
have described, on problems I hadn't finished looking at.

It cost me nothing but time and it was worth every hour. If you can only understand a thing
from the outside, you will keep making decisions about it from your imagination, and your
imagination is generous about what agents can do.
