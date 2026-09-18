---
title: "Build the Eval Harness Before the Next Feature"
description: "A 120-question eval set took two days to build and has paid for itself every week since. Here is what went into it and how we keep it honest."
pubDate: 2026-08-05
tags: [rag, llm-evals, mlops]
series: "Production RAG"
seriesOrder: 2
---

In [part one](/blog/rag-chunking-lessons/) I said the chunker was the
biggest lever in our RAG pipeline. That is true, but we only know it because
we had an eval harness. Before the harness, every change was judged by
someone pasting three questions into a chat window and squinting at the
answers. This post is about what we built instead, and what it cost.

## What goes in the eval set

The set is 120 questions. Each has:

- The question, phrased the way a real user phrased it. About half came
  straight from support chat logs, typos included.
- The document IDs that contain the answer. Usually one, sometimes two or
  three. This is what retrieval recall is measured against.
- A reference answer, written by someone on the support team, not by us.
- A difficulty tag: `lookup`, `synthesis`, or `no-answer`. The last group is
  questions the corpus cannot answer, where the correct behavior is to say
  so.

The `no-answer` questions were the most valuable addition. Without them,
every tuning pass drifted toward a system that always answered something,
because the metrics rewarded it.

## What we measure

Two numbers, kept deliberately simple:

**Recall@k** for retrieval: did the top *k* chunks include at least one
chunk from each reference document? This is cheap, deterministic, and runs on
every commit.

**Answer correctness** for generation: an LLM judge compares the generated
answer with the reference and returns `correct`, `partial`, or `wrong`,
with a one-line justification. We calibrated the judge by having two people
grade 60 answers by hand and checking agreement. The judge agreed with the
humans 91% of the time, which was better than the humans agreed with each
other.

The judge prompt is boring on purpose:

```text
You are grading an answer against a reference. Grade CORRECT if the answer
conveys the same facts as the reference and nothing contradictory. Grade
PARTIAL if it is incomplete but not wrong. Grade WRONG if it contradicts the
reference, invents details, or answers a different question.
Reply with the grade on the first line and a one-sentence reason on the second.
```

## Running it

The harness is a Python script. It takes a config describing the pipeline
under test, runs all 120 questions, and writes a JSON file with every
retrieved chunk, every generated answer, and every grade. A second script
diffs two of those files and prints the questions whose grade changed.

That diff is the thing people actually look at. A pull request that says
"correctness went from 0.79 to 0.81" is fine. A pull request that says "these
four questions got better, this one got worse, here's why" gets reviewed
properly.

Runtime is about four minutes and costs a little under a dollar in model
calls. It runs on every pull request that touches retrieval, prompts, or
the chunker.

## Keeping it honest

Three rules, learned the hard way:

1. **Nobody tunes against the whole set.** Twenty questions are held out and
   only run weekly. When the held-out score lags the main score by more than
   a few points, someone has been overfitting prompts to the eval.
2. **Every production complaint becomes a question.** If a user reports a
   bad answer, the question and the right answer go into the set that day.
   The set has grown from 80 to 120 this way, and the newer questions are
   harder than the originals.
3. **The judge gets re-calibrated when the model changes.** We swapped the
   generation model once and forgot to re-check the judge. It had started
   grading verbose answers as `partial` regardless of content. Two weeks of
   results were noise.

## Was it worth it?

The initial set took two people two days. Since then it has caught a
regression in a reranker upgrade, settled the chunking question in an
afternoon, and turned "is the new prompt better?" from an argument into a
diff. I no longer start a RAG project without one, and I try to build it
before the second feature, not after the fifth complaint.
