---
title: "What Chunking Strategy Actually Changed in Our RAG Pipeline"
description: "We tried five chunking strategies on the same corpus. Only one of them moved the metric users cared about, and it wasn't the clever one."
pubDate: 2026-07-14
tags: [rag, retrieval, llm-evals]
series: "Production RAG"
seriesOrder: 1
---

Every RAG tutorial spends one paragraph on chunking and then moves on to the
exciting part. In our case the chunker was the single biggest lever in the
whole pipeline, and we didn't find that out until we had shipped something
users were already complaining about.

This is the first post in a short series on what it took to get a
retrieval-augmented system from demo to something a support team relies on
every day. The corpus is a few thousand internal runbooks, policy documents,
and product guides. Most are Markdown or HTML exported from a wiki. Some are
PDFs with tables that were never meant to be parsed by anyone.

## The setup

The first version did what most first versions do: split every document into
fixed windows of roughly 500 tokens with a 50-token overlap, embed each
window, and retrieve the top eight by cosine similarity. It worked well
enough on the ten questions we tried in the demo. It fell apart on the
question the head of support asked in the first week: "What's the escalation
path for a billing dispute over $10k?"

The answer lives in one document, in a section titled *Escalations*, in a
table. Our chunker had cut the table in half. The top hit contained the
column headers and the first two rows, neither of which mentioned billing.
The model confidently answered from a different runbook about refund limits.

## What we tried

We built a small eval set, which is the subject of [part two](/blog/rag-evals-before-features/),
and ran the same 120 questions through five chunking strategies:

| Strategy | Recall@8 | Answer correctness |
|---|---|---|
| Fixed 500 tokens, 50 overlap | 0.61 | 0.58 |
| Fixed 300 tokens, 100 overlap | 0.66 | 0.60 |
| Sentence windows (3 sentences, stride 1) | 0.64 | 0.57 |
| Heading-aware sections, max 800 tokens | **0.83** | **0.79** |
| Heading-aware plus parent context prepended | 0.84 | 0.81 |

The numbers are from our corpus and our questions. Yours will differ. The
shape of the result has held up on two other corpora since, though: smaller
fixed windows barely help, sentence windows help retrieval a little and hurt
generation a little, and respecting the document's own structure helps a lot.

## The strategy that worked

The heading-aware chunker is not sophisticated. It walks the document's
heading tree and emits one chunk per leaf section. If a section is longer
than the budget, it splits on paragraph boundaries. If a section is very
short, it merges with its siblings under the same parent. Tables are never
split; if a table alone exceeds the budget, it becomes its own chunk and the
budget loses.

The part that mattered most was prepending the heading path to every chunk
before embedding it:

```python
def chunk_text(section: Section) -> str:
    breadcrumb = " > ".join(h.title for h in section.ancestors())
    return f"{breadcrumb}\n\n{section.body}"
```

With that, the chunk containing the escalation table embeds as
`Billing Runbook > Disputes > Escalations` followed by the table. The
query about billing disputes now lands on it. The breadcrumb also gets
rendered into the prompt, so the model can see where the passage came from
and stops confusing the refund runbook with the disputes runbook.

## What didn't matter

Overlap was almost irrelevant once chunks followed section boundaries.
Embedding model choice moved recall by a couple of points, well within the
noise of our eval set. Reranking helped, but only after chunking was fixed;
reranking half a table is still half a table.

## What I'd do differently

Build the eval set on day one, before choosing a chunker. We spent two weeks
tuning a retrieval stack around a chunking strategy that was quietly wrong,
and the fix took an afternoon once we could measure it. That is the whole
argument of the next post.
