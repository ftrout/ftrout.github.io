---
title: "The Latest AI Jargon in Plain English: Prompt, Context, Loop, and Harness Engineering"
pubDate: 2026-07-11
description: "The vocabulary is exploding, especially the '-engineering' words — prompt engineering, context engineering, loop engineering, harness engineering. They sound like gatekeeping. They're not. Decoded plainly, they tell one story: the leverage keeps moving outward from the model. Here's what each term actually means, plus a grouped glossary of the rest."
author: "Frank Trout"
---

The jargon is out of control, and the fastest-growing corner of it is the "-engineering" words. Prompt engineering, context engineering, loop engineering, harness engineering — each arrives sounding like a new discipline you missed the memo on. If you're new to building with AI, it reads like gatekeeping. It isn't. Decoded plainly, these terms aren't four unrelated specialties; they're four chapters of a single story, and once you see the story the words stop being intimidating.

Here's the story: **building with a language model is mostly building the stuff *around* the model, and each new "-engineering" term marks the moment the field realized the leverage had moved one layer further out.** We started obsessing over the words we typed. Then we realized the words were the small part. So let me walk the four terms in the order the field discovered them, because that order *is* the explanation — and then give you a plain-English glossary of everything else you're likely to hear.

## The "-engineering" family, in the order it happened

First, the one word under all of them. A **language model** (or **LLM**, large language model) is the AI behind tools like ChatGPT and Claude: you give it text, it gives you text back. Everything below is about how you get useful, reliable work out of that one component.

**Prompt engineering** — writing the instructions well. The **prompt** is the text you send the model. Prompt engineering is the craft of phrasing it to get good results: being specific, giving examples, telling it what role to play. This was the first thing everyone learned, and it's real — but it turned out to be the *smallest* lever, because the prompt you write once is a tiny slice of what the model actually reads on any given turn in a real system.

**Context engineering** — assembling everything the model sees, each time it runs. This is the realization that the prompt was the small part. The **context** is the *whole* bundle the model reads on a given call: your instructions, yes, but also the conversation so far, facts retrieved from your data, results from tools it used, and more — all of it competing for the **context window**, the limited amount of text the model can take in at once. Context engineering is the discipline of deciding, every turn, what goes in that window and what gets left out. The leverage moved from "the sentence I wrote" to "the whole payload I assemble." ([I wrote a full post on why this is the actual job.](/blog/context-engineering-is-the-job))

**Loop engineering** — designing the cycle an agent runs in. An **agent** is a model running in a **loop**: it decides on an action, does it, looks at the result, and decides again, repeating until the task is done. Loop engineering is the craft of designing that cycle well — what information gets fed in on each pass, how honest the feedback is, when the loop is allowed to stop, and how you keep it from spinning forever. The leverage moved again: from "what the model sees once" to "how the whole repeating process is fed and fenced." ([Here's the loop taken apart, one turn at a time.](/blog/the-loop-at-the-heart-of-every-agent))

**Harness engineering** — building the whole scaffolding around the model. This is the newest and broadest of the four, and the most important to understand, because it names what building an AI system *actually is*. The **harness** is all the code wrapped around the model: the loop that calls it, the tools it can use, the parsing of its output, the retries when something fails, the guards that stop it doing something dumb, the logging that lets you see what happened. **Harness engineering** is building that scaffolding well — and increasingly it *is* the job. The model is a small, strange component; the harness is everything you build to make that component behave. ([This is why an LLM reshapes your whole architecture rather than just slotting in.](/blog/the-llm-is-not-a-function-call))

Say those four in a row and you can hear the leverage marching outward: **prompt** (the words) → **context** (everything it reads) → **loop** (the repeating cycle) → **harness** (the entire system around it). Each term isn't a fancier version of the last. It's the field noticing that the real work was one layer further out than we thought.

A little honesty, since it's my house style: some of this vocabulary is genuinely new insight, and some is old ideas in new hats. "Harness engineering," stripped down, is largely *software engineering, applied to LLM apps* — the discipline of building reliable systems around an unreliable part. Don't let the fresh label convince you it's alien. If you can build software, you can build a harness; you just have to learn how the strange component in the middle behaves.

## A plain-English glossary of everything else

Here's the rest of the vocabulary you'll trip over, grouped so it's less of a wall. Short, plain, no gatekeeping.

### The model and how it works

- **Token** — the unit of text a model reads and writes, roughly a word or word-fragment. You're usually billed per token, and the context window is measured in them.
- **Inference** — one run of the model. "An inference call" just means "asking the model once."
- **Temperature** — a randomness dial. Higher = more varied and creative; lower = more focused and repeatable. It never makes output perfectly identical, though.
- **Non-determinism** — the property that the same input can produce different output. It's why you can't test an AI system by checking for one exact answer.
- **Frontier model** — one of the most capable current models (the expensive, powerful tier).
- **Open weights** — a model whose parameters you can download and run yourself, rather than only calling it over someone else's API.
- **Reasoning / thinking / effort** — features that let a model work through a problem step by step before answering. "Effort" is often a dial for how hard it thinks (and how much it costs).

### What it produces — and how it fails

- **Hallucination** — when the model states something false but sounds completely confident. Not a bug in the usual sense; it's [inherent to how these models work](/blog/why-agents-make-things-up).
- **Grounding** — basing the model's answer on real, provided sources (your documents, a live lookup) instead of its own memory, so claims can be traced.
- **Structured output** — making the model reply in a strict, machine-readable shape (like a filled-in form) instead of free prose, so your code can rely on it.
- **Jailbreak** — a crafted input that gets the model to bypass its safety training.
- **Prompt injection** — hostile instructions hidden in content the model reads (a web page, a document, a tool result) that hijack it. A real security problem once the model [holds any real access](/blog/giving-an-agent-authority-is-a-security-decision).

### The building blocks

- **System prompt** — the standing instructions sent on every call, setting the model's role and rules.
- **Tool / tool calling / function calling** — giving the model the ability to *do* things (look up a price, send an email, run code) by calling code you provide. [The tools are an interface you design for the model.](/blog/the-tool-is-the-interface)
- **RAG / retrieval** — "retrieval-augmented generation": look up relevant facts from your data and paste them into the context before the model answers. The fix for a model's frozen, fuzzy memory — and only as good as [the data you feed it](/blog/bad-data-bad-ai).
- **MCP (Model Context Protocol)** — a standard way to plug tools and data sources into an AI system, so you're not hand-wiring every integration.
- **Skill** — a packaged, reusable procedure you hand an agent, loaded only when it's relevant. [Great for the right gap, a trap for the wrong one.](/blog/the-strengths-and-weaknesses-of-skills)
- **Memory / state** — anything the system remembers across turns. The model itself remembers nothing between calls; "memory" is something *you* rebuild and feed back in.
- **Workflow vs. agent** — a **workflow** is a fixed sequence of steps *you* wrote; an **agent** decides its own steps at runtime. Knowing which your problem needs is half the battle ([when not to build an agent](/blog/when-not-to-build-an-agent), and [when you genuinely should](/blog/the-case-for-agents)).
- **Multi-agent / orchestration** — coordinating several agents or steps. Powerful, often premature.
- **Guardrails** — the controls that keep a system from doing harmful or off-policy things (filters, validators, human approval).

### Making it better, cheaper, or provable

- **Evals** — automated tests that score an AI system's quality on the things that matter, turning "it feels better" into a measured number. [The most under-built, load-bearing thing in the field.](/blog/you-cant-improve-what-you-cant-measure)
- **Fine-tuning** — further-training a model on your own examples to change its behavior or style. Teaches *form*, not *facts* — and it's reached for far more often than it's needed.
- **Prompt caching** — reusing the model's processing of a stable chunk of prompt so you don't pay to re-read it every call. A cost lever, with fine print.
- **Model routing / tiering** — using a cheap, fast model for easy work and only paying for a powerful one when the task demands it.

## The reframe

If the vocabulary feels like it's expanding faster than you can keep up, here's the reassuring truth underneath it: it keeps expanding for *one reason* — the field keeps rediscovering that the model is the small part, and the engineering around it is the real work. That's the whole meaning of the march from prompt to context to loop to harness. Every new "-engineering" word is just a name for building the scaffolding that makes a probabilistic, forgetful, occasionally-wrong component into something you can actually rely on.

So don't be intimidated by the words. Most of them are plain ideas wearing lab coats, and the ones that aren't point at something genuinely worth learning — usually one layer further out from the model than you were looking. When someone drops a term you don't know, ask the only question that ever matters: *what problem around the model does this name?* Nine times out of ten, the answer is refreshingly boring — and boring, in this field, is exactly what you want.
