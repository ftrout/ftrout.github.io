---
title: "LLM-as-Judge Without Fooling Yourself"
description: "A model can grade incident summaries at scale, but only after you have checked its grades against your analysts'. The rubric, the calibration step, and the code."
pubDate: 2026-10-08
tags: [llm-evals, agents, security]
series: "Evals in Practice"
seriesOrder: 3
draft: true
---

Code can grade a severity. It cannot grade whether an incident summary
told the analyst what actually happened, whether the recommended next
step was the right one, or whether the explanation invented an indicator
that was never in the evidence. For those, the practical option is to
have a model do the grading.

This is where most eval efforts go wrong, and I include my own first
attempt. A judge is easy to build and easy to trust, and the two are not
related. What follows is the version I use now, with the calibration step
that makes the difference between a measurement and a mood.

## The use case

The triage agent's written output: a short incident summary and a
recommended next step, handed to an analyst alongside the structured
record. Each summary should be faithful to the evidence the agent
actually gathered, should answer the question the alert raises, should
not claim containment actions the agent did not take, and should be
readable by someone who has just been paged. A senior analyst can grade
one in about a minute. We have four hundred cases and change the prompt
weekly. Analysts do not scale to that. A judge does.

## Write the rubric before the prompt

The rubric is the contract. I write it as a short list of yes/no
criteria, each of which an analyst could apply without asking a
follow-up question. If I cannot write the criterion that plainly, the
judge cannot apply it either.

For the summaries:

1. **Faithful.** Every claim is supported by the alert, the enrichment
   results, or the query results the agent actually received. No invented
   indicators, hosts, users, or timelines.
2. **Complete.** The summary addresses the question the alert raises,
   not a nearby one. A credential-access alert summarized as a phishing
   report fails here.
3. **Bounded.** The summary does not claim that a host was isolated or an
   account disabled unless the agent did it, and it recommends escalation
   when the playbook says to escalate.
4. **Clear.** Plain and direct. An analyst at 3 a.m. can act on it
   without re-reading.

Each criterion gets a boolean, plus one line of justification. The
overall grade is derived by code from the booleans, not by the judge.
That keeps the judge from averaging a fatal faithfulness failure against
three nice clarity points.

## The judge

I use a structured output so the grade is a typed object rather than
text I have to parse. The judge model is separate from the model under
test, and it never sees the agent's own reasoning, only what the analyst
would see plus the evidence.

```python
# evals/judge.py
from pydantic import BaseModel
import anthropic

client = anthropic.Anthropic()
JUDGE_MODEL = "claude-opus-5"


class Criterion(BaseModel):
    passed: bool
    reason: str


class Grade(BaseModel):
    faithful: Criterion
    complete: Criterion
    bounded: Criterion
    clear: Criterion


RUBRIC = """You are grading an incident summary written by a triage agent for a security analyst.
Grade each criterion independently as passed or failed, with a one-sentence reason.

faithful: every claim is supported by the alert, enrichment results, or query results provided as evidence. Any invented indicator, host, user, timeline, or attribution fails this criterion.
complete: the summary addresses the question the alert raises, not a nearby one.
bounded: the summary does not claim containment actions (isolation, account disable, block) that are not present in the actions list, and it recommends escalation when the reference says to escalate.
clear: plain and direct; an analyst who has just been paged could act on it without re-reading.

Grade only what is written. Do not reward length. Do not penalize a summary for being shorter than the reference if it is still complete."""


def judge(alert: str, evidence: str, actions: str, reference: str, summary: str) -> Grade:
    response = client.messages.parse(
        model=JUDGE_MODEL,
        max_tokens=2048,
        system=RUBRIC,
        messages=[{
            "role": "user",
            "content": (
                f"<alert>\n{alert}\n</alert>\n"
                f"<evidence>\n{evidence}\n</evidence>\n"
                f"<actions_taken>\n{actions}\n</actions_taken>\n"
                f"<reference>\n{reference}\n</reference>\n"
                f"<summary>\n{summary}\n</summary>"
            ),
        }],
        output_format=Grade,
    )
    return response.parsed_output


def overall(grade: Grade) -> str:
    if not grade.faithful.passed or not grade.bounded.passed:
        return "wrong"
    if not grade.complete.passed:
        return "partial"
    return "correct"
```

Notice what the rubric does not say. It does not say "be strict" or
"be fair." Those words do nothing. It says what fails a criterion, with
examples of the failure, because that is what a human grader would need
too. And the evidence block is the agent's actual tool results, not the
full alert history, because faithfulness means faithful to what the
agent saw.

## Calibrate, or you have nothing

Here is the step I skipped the first time and regretted. Before trusting
a judge, grade a sample by hand and check whether the judge agrees.

I take sixty cases, have two analysts grade them independently with the
same rubric, then run the judge on the same sixty. Three numbers come
out: analyst-analyst agreement, analyst-judge agreement, and where the
disagreements cluster.

```python
# evals/calibrate.py
import json
from collections import Counter
from pathlib import Path

from evals.judge import judge, overall

rows = [json.loads(l) for l in Path("evals/calibration.jsonl").read_text().splitlines() if l.strip()]
# each row: alert, evidence, actions, reference, summary, analyst_a, analyst_b
# analyst grades are "correct" | "partial" | "wrong"

agree_aa = agree_aj = 0
confusion = Counter()
for r in rows:
    g = overall(judge(r["alert"], r["evidence"], r["actions"], r["reference"], r["summary"]))
    agree_aa += r["analyst_a"] == r["analyst_b"]
    agree_aj += g == r["analyst_a"]
    confusion[(r["analyst_a"], g)] += 1

n = len(rows)
print(f"analyst vs analyst: {agree_aa / n:.2f}")
print(f"analyst vs judge:   {agree_aj / n:.2f}")
print("\nanalyst -> judge disagreements:")
for (h, j), count in sorted(confusion.items(), key=lambda kv: -kv[1]):
    if h != j:
        print(f"  {h:8s} graded as {j:8s}  x{count}")
```

The first run of this on the summaries gave analyst-analyst agreement of
0.87 and analyst-judge agreement of 0.90. The judge agreed with an
analyst more often than the analysts agreed with each other, which is the
bar I use: a judge that is inside the human noise band is trustworthy for
ranking changes, even if any single grade might be off.

The disagreement table is where the work is. The most common pattern was
analysts grading `partial` where the judge said `correct`. Reading those
cases, the judge was right and the analysts were penalizing terse
summaries out of habit. The rubric line "do not reward length" came from
that. The second most common pattern went the other way: the judge
passed summaries that named a MITRE technique the evidence did not
support. That was a real judge failure, and the fix was adding
"attribution" to the list of things that fail faithfulness. Sometimes
calibration fixes the judge, and sometimes it fixes the rubric.

## Things that go wrong

**Position bias in pairwise judging.** If you ask a judge "which of A or
B is better," it prefers A more often than chance. Run every pair twice
with the order swapped, and count it as a tie if the answers differ.

**Self-preference.** A judge tends to rate outputs from its own model
family higher. Use a different model as judge when you can, and always
re-calibrate when the model under test changes.

**Grading the reasoning instead of the summary.** If the judge sees the
agent's chain of thought, it starts grading effort. Give it only what the
analyst would see, plus the evidence.

**The judge drifting.** When you upgrade the judge model, or edit the
rubric, re-run calibration. I lost two weeks of results once to a judge
that had started grading verbose summaries as `partial` regardless of
content, and I did not notice because nobody re-checked it after a model
swap.

## Cost

Four hundred cases, one judge call each, runs in about four minutes and
costs a few dollars. That is cheap for what it buys, and the calibration
set of sixty is a one-time cost of an afternoon for two analysts.
Compared to the alternative, which was one person reading forty
transcripts and forming an opinion, it is not close.

## Where this stops

A judge grades the summary. It has no idea whether the summary was
reached by a reasonable path, or whether the playbook search found the
right runbook in the first place. The next two posts go upstream of the
answer, to retrieval and to the agent's trajectory, where most of the
fixable problems turn out to live.
