---
title: "Agentic Retrieval vs. the Boring Kind — and Why I Chose Boring"
pubDate: 2026-07-13
description: "I had the option to let the model plan its own searches, fan out sub-queries, and rerank its own evidence. I chose keyword-plus-vector search with my code writing the query instead — on purpose, for four specific reasons. The honest case for both, and the one line that decides it."
author: "Frank Trout"
---

Every system I've built that puts a model in front of a real corpus eventually hits the same fork in the road. You need **retrieval** — looking up the relevant facts from your data and putting them into the model's context before it answers, the thing people usually mean by **RAG** — and you have two ways to get it.

The first is what I'll call **the boring kind**: **hybrid retrieval**, meaning keyword search (**BM25**, the venerable term-matching algorithm that's still shockingly good at finding exact names and identifiers) run alongside vector search (semantic similarity — finding text that *means* the same thing even when the words differ), with the two result sets fused into one ranked list. The important part isn't the algorithms. It's that **your code** writes the query, runs it against the index, and gets typed results back.

The second is **agentic retrieval**: you hand the model the corpus and a search capability, and it plans its own sub-queries, decides when and how many times to search, and the platform fans those queries out and reranks the results for it. Modern platforms sell this as a single API call. It is genuinely impressive.

I chose boring. And I want to be precise about why, because "I chose the simpler thing" is not an argument — it's a personality trait. Here's the actual thesis: **retrieval is where your system's ceiling gets set, and I wanted to own it.** Everything downstream — the answer's accuracy, its citations, your ability to defend it to an auditor — is capped by what came back from that search. When something is the ceiling, I want my hands on it, not the model's.

## What "owning it" actually bought me

Four things, and they're the whole post.

### 1. Cost

Agentic retrieval is **token-billed**. That's not a knock, it's just what it is: you're paying an LLM to plan the query, and then paying again for per-sub-query reranking as the results come back. One user question can quietly become a planning call, four sub-queries, and four rerank passes. The boring kind is a plain per-query search against an index — priced like infrastructure, not like inference.

At demo scale the difference is a rounding error. At production scale, across every question every user asks all day, it's a line item that grows with your traffic *and* with how ambitious the model decides to be on any given question. That last part is what got my attention: with agentic retrieval, the model's own judgment is a cost driver. Your bill has a probabilistic component. The thing that costs nothing in a fifteen-minute proof of concept is metered per token forever after, and at a rate the model gets a vote on.

### 2. Determinism

Code decides what gets retrieved. Same question in, same query out, same documents back. The model isn't improvising the search — it's reasoning over evidence I selected, using a strategy I can read in a file.

This matters more than it sounds like it should. When retrieval is non-deterministic, *every* downstream inconsistency becomes unattributable. A user asks the same question twice and gets two different answers, and now you're debugging a two-layer probabilistic system: did the model reason differently, or did it just *look at different things*? Pinning retrieval down collapses that to one variable. The answer can still vary, but the evidence didn't, and that's the difference between a puzzle and a mystery.

It's also the shape of a decision I keep making. [A decision is only as good as the context it was made on](/blog/it-will-decide-for-you-but-based-on-what) — and if I can't say what context the system had, I can't say much about the decision at all.

### 3. Auditability

This is the one I'd fight for hardest. Because my code writes the query, I can log exactly what was asked, exactly what came back, and — critically — which claim in the final answer cited which specific piece of retrieved evidence. I call it a **grounding ledger**: a per-answer record tying assertions to sources.

That ledger is two things at once, and people usually only notice the first:

- **It's the audit artifact.** When someone asks *why did the system say that, and can you prove it,* you don't produce a vibe. You produce the query, the hits, and the claim-to-evidence mapping. In regulated or high-stakes work, that's not a nice-to-have — it's the difference between a system you can put in front of a reviewer and a system you can't.
- **It's the debugging surface.** Every bad answer is now diagnosable in one step. Was the evidence not there (retrieval problem), or was it right there and the model ignored it (reasoning problem)? Two completely different fixes. Without the ledger you're guessing; with it, the failure mode announces itself.

You can get traces out of agentic retrieval too — good platforms expose the sub-queries. But you're reading a transcript of decisions someone else's system made, after the fact, rather than reading your own code. Those are different relationships to the same information.

### 4. Owning the citations

Citations are where confident systems go to embarrass you. If you let the model produce citation markers as free text, it will sometimes invent one, or drift — attach a real source to the wrong claim, cite the document it *would have* found. It's not lying; it's doing what it does, generating plausible text.

So I don't let it. A deterministic renderer resolves citations from the retrieval results — the model's job is to reference evidence by handle, and code turns handles into links. If the handle doesn't exist, that's a hard error, not a plausible-looking footnote. The citation layer stops being a thing I hope for and becomes a thing I enforce, which is the general principle: [if it must happen, it belongs in code](/blog/when-not-to-build-an-agent), not in an instruction you hope gets followed.

## The honest case for agentic retrieval

Now the other side, because I'd be doing the same thing I criticize if I pretended my call was the universal one. Agentic retrieval isn't a worse version of what I built. It's a *different tool with a real sweet spot*, and it genuinely wins in cases my approach handles badly:

- **The question is open-ended and multi-source.** "What changed about our exposure in the last quarter, and why?" doesn't decompose into a query I can write in advance. It decomposes into six queries whose *shape depends on what the first two returned*. That's reasoning, and reasoning is what the model is for.
- **You can't predict the query shape.** My whole approach rests on knowing roughly what gets asked. When the input space is genuinely unbounded — a research assistant over a sprawling corpus, an analyst tool where the user's intent arrives fresh every time — hand-written query construction becomes a hedge maze of special cases. At some point the special cases *are* the improvisation, and you should just let the model improvise.
- **You need permission-aware fan-out across many sources.** Querying twelve heterogeneous systems, each with its own access rules, and merging the results correctly is a serious engineering effort. If a platform does that well and honors your permission model, buying it is not laziness; it's good judgment about where your team's hours should go.
- **The sub-query decomposition *is* the hard part.** This is the real tell. If breaking the question apart is where the intelligence lives — not the ranking, not the fusion, the *decomposition* — then a hand-written query is you doing badly, by hand, the exact thing the model is good at.

None of those described my problem. My questions had a knowable shape, one corpus, one permission model, and the hard part was never "what should I search for" — it was "can you prove the answer." So the trade agentic retrieval offers, flexibility bought with tokens and non-determinism, was a trade I had nothing to gain from. When I wrote about [the deterministic pipeline I built instead of an agent](/blog/i-didnt-build-an-agent), this was the same decision one layer down: the model does the part that needs judgment, and code does everything that doesn't.

## The decision rule

Strip it down and it's one line, and it's the same line I keep arriving at from every direction:

> **If you can write the query, write the query. If the *search itself* is the open-ended reasoning task, that's where agentic retrieval earns it.**

Which is just [if you can write the steps, write them](/blog/when-not-to-build-an-agent) pointed at retrieval instead of orchestration. Improvisation is expensive, non-deterministic, and hard to audit. Sometimes you need it — that's what it's *for*, and refusing it on principle when the problem genuinely requires it is its own failure. But you should be *buying* something with it, not just defaulting to the impressive option.

A quick way to run it:

| Ask | Boring wins when… | Agentic earns it when… |
| --- | --- | --- |
| **Query shape** | You can predict and write it | It depends on what the last search returned |
| **Cost model** | Volume is high, margins matter | The question is rare and worth the tokens |
| **Proof burden** | You must show your work | Nobody's auditing the answer |
| **Where the hard part is** | Ranking and grounding | Decomposing the question |

The failure isn't picking either one. It's picking without knowing which column you're in.

## Neither choice saves you from bad data

One more thing, and it outranks everything above.

I could tune fusion weights for a month, and it would matter less than the state of the index. If the corpus is stale, duplicated, half-permissioned, or wrong, then boring retrieval faithfully retrieves garbage and agentic retrieval intelligently plans four sub-queries that each retrieve garbage. [Bad data, bad AI](/blog/bad-data-bad-ai) — the retrieval strategy is a multiplier on your data quality, and a multiplier on zero is zero.

This is why I think of retrieval as the ceiling rather than a component. The model can't reason about what it didn't receive, and it can't tell you what it didn't receive, which means every retrieval failure surfaces as a *reasoning* failure — a confidently wrong answer instead of an empty one. Retrieval also *is* your context budget in practice: what comes back is what fills the window, so [context engineering](/blog/context-engineering-is-the-job) and retrieval design are the same job wearing two hats.

And you don't get to have opinions about any of it without numbers. Recall on a labeled question set, whether the right chunk landed in the top-k, how often a claim's cited evidence actually supports it — [you can't improve what you can't measure](/blog/you-cant-improve-what-you-cant-measure), and "the answers seem good" is not a measurement. The grounding ledger is what makes this cheap, incidentally: it's already a labeled record of what was asked and what was used. The audit artifact and the eval dataset turn out to be the same file.

## The reframe

The pitch for agentic retrieval is that you stop writing retrieval logic and let the model figure it out. That's true, and it's exactly the part to think hard about, because retrieval logic isn't overhead you're shedding — it's the layer that sets your ceiling on accuracy, cost, and provability. Handing it off is a real choice with real returns, and it's the right one when the search is genuinely the reasoning. It's just not free, and it's not automatically more advanced. It's a *different allocation of judgment*: theirs instead of yours.

I wanted mine. Not because the model couldn't have planned decent queries — it probably could have, most of the time — but because "most of the time" was the wrong bar for the thing everything else stands on. I could write the query. So I wrote the query, and spent the judgment I saved on the part that actually needed it: making sure every sentence in the answer could point at the evidence that produced it.

That's the whole test, and it's the same one I run on agents, on low-code, on skills, on all of it. Not *what's the most capable option* — what's the shape of this problem, and which tool has that shape? When the search is the hard thinking, let the model think. When you already know what to ask, asking it yourself isn't a limitation. It's the point.
