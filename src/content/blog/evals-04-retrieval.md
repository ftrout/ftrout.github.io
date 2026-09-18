---
title: "Retrieval Evals: Measure the Search Before You Judge the Answer"
description: "When an agent answers from playbooks and past incidents, most bad answers are bad retrieval in disguise. Recall, MRR, and precision tell you which half of the pipeline to fix."
pubDate: 2026-08-25
tags: [llm-evals, rag, security]
series: "Evals in Practice"
seriesOrder: 4
draft: true
---

The first time I gave the triage agent access to our playbooks, I
evaluated it the only way I knew: ask questions, read answers. When an
answer was wrong I changed the prompt. Sometimes that helped. Mostly it
did not, because the model was answering from the wrong playbook, and no
prompt fixes that.

Retrieval evals separate the two questions that end-to-end grading
smushes together: did we find the right material, and did the model use it
well? This post is about the first question. It is cheaper to measure,
faster to iterate on, and in my experience responsible for most of the
gap between a demo and a system analysts trust.

## The use case

The knowledge side of the triage agent: a few hundred incident response
playbooks, detection engineering notes, and past incident reports. When
the agent recommends a next step, it is supposed to cite the playbook
that step came from. The failure that prompted the eval: a
credential-stuffing alert was answered with the brute-force playbook,
confidently, because the credential-stuffing section lived under a
heading the chunker had split in half. The two playbooks recommend
different first steps, and the wrong one delays the account lockout.

## What you need to label

A retrieval case is a question plus the set of documents that contain the
answer. Not the answer itself. That distinction is what makes the eval
cheap: an analyst can point at the right playbook section in a few
seconds, while writing a reference answer takes minutes.

```jsonl
{"id": "cred-001", "query": "first response steps for credential stuffing against the customer portal", "relevant": ["ir-playbooks#credential-stuffing"], "tags": ["credential-access"]}
{"id": "cred-002", "query": "who can approve a forced password reset for a whole business unit", "relevant": ["ir-playbooks#mass-reset-approval", "policies#identity-changes"], "tags": ["credential-access"]}
{"id": "none-004", "query": "what is the playbook for a physical badge clone", "relevant": [], "tags": ["no-answer"]}
```

Document identifiers are at the section level because that is the
granularity the chunker works at. The third case has no relevant
documents, because we have no such playbook, and it matters as much here
as it did in the code-graded post. A retriever that returns confident
junk for an unanswerable question is feeding the model exactly what it
needs to invent a procedure.

## Three numbers

I report three metrics and resist adding more.

**Recall at k** answers "was the right material in what the model saw?"
If it was not, nothing downstream can save you. This is the number I
watch on every change.

**Mean reciprocal rank** answers "how high did the first relevant chunk
land?" Models weight earlier context more heavily, and a relevant chunk in
position eight does less than the same chunk in position one.

**Context precision** answers "how much of what we sent was junk?" Low
precision means wasted tokens and, worse, distractors that pull the
recommendation toward the wrong playbook.

```python
# evals/retrieval_metrics.py
from dataclasses import dataclass


@dataclass
class RetrievalResult:
    case_id: str
    retrieved: list[str]   # section ids, in rank order
    relevant: set[str]


def recall_at_k(r: RetrievalResult, k: int) -> float | None:
    if not r.relevant:
        return None  # unanswerable cases are scored separately
    hits = r.relevant & set(r.retrieved[:k])
    return len(hits) / len(r.relevant)


def reciprocal_rank(r: RetrievalResult) -> float | None:
    if not r.relevant:
        return None
    for rank, doc in enumerate(r.retrieved, start=1):
        if doc in r.relevant:
            return 1.0 / rank
    return 0.0


def precision_at_k(r: RetrievalResult, k: int) -> float | None:
    if not r.relevant:
        return None
    top = r.retrieved[:k]
    return sum(doc in r.relevant for doc in top) / max(len(top), 1)


def no_answer_score(r: RetrievalResult, threshold_hits: int = 0) -> float | None:
    """For unanswerable queries: 1.0 if the retriever returned nothing
    above the relevance threshold, else 0.0."""
    if r.relevant:
        return None
    return 1.0 if len(r.retrieved) <= threshold_hits else 0.0
```

The `None` returns are deliberate. Averaging unanswerable cases into
recall produces a number that means nothing. They get their own line in
the report.

## Running it

The runner calls the real retriever, the same function the agent calls
in production, with the same configuration. The number of times I have
seen an eval run against a "test index" that differed from the live one
is the number of times that eval was wrong.

```python
# evals/run_retrieval.py
import json
import statistics
from pathlib import Path

from soc_agent.retrieval import retrieve  # production entry point
from evals.retrieval_metrics import (
    RetrievalResult, recall_at_k, reciprocal_rank, precision_at_k, no_answer_score,
)

K = 8
cases = [json.loads(l) for l in Path("evals/retrieval.jsonl").read_text().splitlines() if l.strip()]

results = []
for case in cases:
    hits = retrieve(case["query"], k=K)  # returns ranked chunks with .section_id and .score
    results.append(RetrievalResult(
        case_id=case["id"],
        retrieved=[h.section_id for h in hits if h.score >= 0.35],
        relevant=set(case["relevant"]),
    ))


def mean(values):
    values = [v for v in values if v is not None]
    return statistics.fmean(values) if values else float("nan")


print(f"recall@{K}:      {mean(recall_at_k(r, K) for r in results):.3f}")
print(f"MRR:             {mean(reciprocal_rank(r) for r in results):.3f}")
print(f"precision@{K}:   {mean(precision_at_k(r, K) for r in results):.3f}")
print(f"no-answer:       {mean(no_answer_score(r) for r in results):.3f}")

misses = [r.case_id for r in results if r.relevant and recall_at_k(r, K) == 0]
print(f"\ncomplete misses ({len(misses)}): {', '.join(misses)}")
```

The last two lines are the ones I read first. A list of case ids where
nothing relevant was retrieved is a to-do list. A recall number is a
mood.

## What the numbers told me

On the playbook corpus, the first runs looked like this:

| Change | Recall@8 | MRR | Precision@8 |
|---|---|---|---|
| Baseline, fixed 500-token chunks | 0.61 | 0.48 | 0.19 |
| Heading-aware chunks | 0.83 | 0.71 | 0.27 |
| Plus reranker | 0.84 | 0.86 | 0.41 |

Two lessons hid in that table. Chunking moved recall, which nothing else
did; if the credential-stuffing section is cut in half, no amount of
reranking finds it. And the reranker barely touched recall but nearly
doubled MRR and precision, which is exactly what a reranker should do.
Without separating the metrics I would have concluded the reranker was a
wash.

## Keeping the labels honest

Retrieval labels rot faster than answer labels, and playbooks rot fastest
of all. Detection names change, sections get merged after a post-incident
review, and a case whose relevant section no longer exists scores zero
forever. Two habits keep this in check:

- The runner fails loudly if a labeled section id does not exist in the
  index. A missing label is a broken case, not a hard one.
- Every complete miss gets an analyst's look within the week. About a
  third of the time the label is wrong, not the retriever.

## Where this stops

A perfect retrieval score means the model had the right playbook. It says
nothing about whether the model followed it. That is the end-to-end
question, and it needs a judge. But when the end-to-end score drops and
the retrieval score did not, you know exactly which half of the system to
open up, and that is most of the value.
