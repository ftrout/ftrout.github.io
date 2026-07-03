---
title: "Context Engineering Is the Job: The Prompt Was Always the Small Part"
pubDate: 2026-07-06
description: "'Prompt engineering' got the hype and undersells the work. The prompt you write once is the smallest part of what a model actually sees. The real craft is assembling the right information, in the right form, within a finite window — every single turn. That assembly is where reliability lives, and almost nobody names it."
author: "Frank Trout"
---

"Prompt engineering" got the headlines, the job titles, and the courses — and it names the least of the work. It points at a *thing you write once*: a system prompt, a clever set of instructions, a template you tune until the outputs look good. That artifact matters. But it's a tiny slice of what the model actually reads on any given turn in a real system, and it's the slice you had the most control over and the least trouble with. The hard part — the part that decides whether the thing works in production — is everything *around* the prompt, assembled fresh every time the model runs.

That assembly has a name that's finally catching on, and it's the one worth internalizing: **context engineering is the discipline of deciding, every single turn, exactly what information the model sees and how it's arranged — within a budget that's always too small.** The prompt is the opening line. The context is the product, and it's rebuilt on every inference (every individual call to the model). Get the assembly right and an ordinary model looks sharp; get it wrong and the best model in the world makes baffling decisions, because it was reasoning over the wrong material.

## What "context" actually is

Every time the model runs, it sees one bundle of text — its entire world for that turn. That bundle is the **context**, and it's more crowded than people realize. It holds your system instructions, the definitions of any tools (capabilities the model can call) it has, whatever knowledge got retrieved from your data, the conversation so far, the results of earlier tool calls, and the actual task at hand. All of it competes for one finite space: the **context window**, the maximum amount of text — measured in **tokens**, roughly word-fragments — the model can take in at once.

Two facts about that window turn context assembly from a nicety into *the* engineering problem. First, [the model is stateless and rebuilds its memory from scratch each turn](/blog/the-loop-at-the-heart-of-every-agent) — it remembers nothing on its own, so whatever continuity exists is something *you* reconstruct by deciding what to put back in front of it. Second, the window is finite, so [you are always spending a limited budget](/blog/the-llm-is-not-a-function-call) and everything you include crowds out something else. Put those together and a job appears that has no equivalent in normal software: on every turn, in code, someone has to decide what's in, what's out, and how it's laid out. That someone is you, and that decision is context engineering.

## The two ways it goes wrong, and why they're the same budget

Context failures come in two flavors, and holding both in your head at once is the whole art, because they pull in opposite directions.

**Too little, and the model is blind.** It's missing the one fact that governed the answer — the current account state, the policy that changed, the earlier turn where the user said the thing that mattered. It doesn't know what it doesn't know, so it produces a confident, fluent answer built on a gap. Under-context looks like the model being dumb; it's actually the model being starved.

**Too much, and the model is buried.** This is the failure people don't expect, because "give it more" feels safe. It isn't. A model swamped with thousands of tokens of marginally-relevant material [attends least carefully to the middle of it](/blog/the-first-guardrail-is-knowing-the-models-weaknesses), loses the thread of the actual instruction, and gets distracted by whatever's loudest rather than whatever's relevant. Over-context also costs money and latency on every turn. More is not safer — past the point of relevance, more is *noise*, and noise degrades decisions.

The reason you can't just "include everything to be safe" is that the window is a **zero-sum budget**. Every token of history you keep is a token of retrieved knowledge you can't. The instruction that matters most competes for attention with the tool dump from six turns ago. Context engineering is the ongoing act of winning that competition on purpose — and the two failure modes are the same coin, because the tokens you waste on the irrelevant are exactly the tokens the relevant needed.

## The craft: the levers you actually pull

Here's the part that makes it *engineering* rather than taste. Assembling good context is a set of concrete, repeatable techniques, and a system that works in production is usually one that does most of these well.

**Selection — retrieve only what's relevant this turn.** The instinct to dump your whole knowledge base into the prompt is the original sin. The job is to pull *only* the pieces that bear on the current step — and relevance is the entire game, because [a decision is only as good as the context behind it](/blog/it-will-decide-for-you-but-based-on-what) and [the quality of what you retrieve caps the quality of what you get](/blog/bad-data-bad-ai). Precise retrieval beats abundant retrieval every time.

**Compression — summarize instead of carrying everything verbatim.** A long conversation or a giant tool result doesn't belong in the window in full. You distill it: a rolling summary of the conversation so far, a condensed version of a ten-page document down to the clause that matters, an observation reduced to its outcome. Done well, compression keeps the load-bearing facts and sheds the bulk — buying back budget without going blind.

**Ordering — put load-bearing content where attention is.** Position is a design variable, not an accident. Because attention is strongest at the start and end of the window, the critical instruction and the most relevant facts go at the edges, not buried in a low-attention middle where they may not register. The same content in a different order is a different context.

**Formatting — structure so the model can parse it.** A wall of concatenated text is harder to reason over than the same information with clear labels, delimiters, and sections. Telling the model *what each part is* — "here is the policy," "here is the conversation," "here is the task" — helps it weight them correctly. Structure is cheap and it pays.

**Pruning — decide what to forget.** As a task runs, old observations go stale and expired context becomes dead weight that only crowds and distracts. Actively evicting what no longer matters is as important as adding what does. A context that only grows is a context that eventually collapses under its own noise.

**Isolation — keep concerns from crowding each other.** Don't let a massive raw tool output shove your instructions out of the model's attention. This is part of why [a tool should return a clean, distilled result rather than a data dump](/blog/the-tool-is-the-interface), and why [handing a messy sub-task to a separate agent that returns only a summary](/blog/simplest-agent-that-could-possibly-work) is as much a context-management move as an architecture one — it keeps the raw mess out of the main window.

Notice these trade against each other, which is what makes it a craft and not a checklist. Compress too aggressively and you drop the fact you needed. Prune too eagerly and you forget something that mattered later. There's no static right answer — only a set of levers you tune against the task.

## The mindset shift: context is a verb

Here's the reframe that reorganizes everything. "Prompt engineering" treats the prompt as a *noun* — an artifact you author, perfect, and freeze. Context engineering treats the model's input as a *verb* — something your system *does*, dynamically, on every single turn, and mostly in code you wrote rather than text you typed.

That shift changes what you actually maintain. The valuable artifact stops being the perfect prompt string and becomes the *assembly logic*: the retrieval that decides what's relevant, the summarizer that compresses history, the rules that order and prune. You stop asking "what should the prompt say?" and start asking "what should be in front of the model at this exact moment, and what machinery puts it there?" The prompt is the part you wrote on day one. The context is what your system constructs on turn forty-seven of a live session you never saw coming — and that construction is the thing you're really building.

## You can measure whether the assembly worked

None of this has to be vibes, and it shouldn't be. Whether the right context got assembled is [directly testable](/blog/you-cant-improve-what-you-cant-measure): did retrieval surface the document that actually mattered, or the wrong one? Did the summary preserve the load-bearing fact or drop it? Did the critical instruction survive the pruning? These are measurable properties of your assembly pipeline, and scoring them is how you improve context engineering instead of guessing at it. When an agent misbehaves, the eval that inspects *what was in the context on the failing turn* usually finds the bug faster than any amount of staring at the model's output — because the bug is almost never that the model is dumb. It's that the model was handed the wrong material.

## The reframe

Stop thinking of the prompt as the thing you're engineering. The prompt is the opening move; the context is the whole game, and it's played fresh every turn. Most of the "the model isn't smart enough" complaints I've ever chased down were context failures wearing a model's face — the system either starved the model of the one fact that mattered or buried it under a hundred that didn't, and then blamed the model for the confusion it was handed.

So put your effort where the leverage is. Build the retrieval that finds the relevant thing, the compression that keeps histories lean, the ordering that respects where attention lives, the pruning that forgets on purpose. Treat what the model sees each turn as the artifact you're actually crafting — because it is. The people whose systems quietly work aren't the ones who wrote the cleverest prompt and stopped. They're the ones who realized the prompt was the small part, and went and engineered everything around it.
