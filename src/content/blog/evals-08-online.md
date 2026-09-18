---
title: "Online Evals: Grading Production While It Runs"
description: "Offline evals go stale the day you ship. Sample real triages, grade them, watch the trend, and feed every analyst-confirmed miss back into the case set."
pubDate: 2026-09-17
tags: [llm-evals, mlops, security]
series: "Evals in Practice"
seriesOrder: 8
draft: false
---

Everything in this series so far runs before a change ships. That is the
right time to catch most problems, and the wrong time to catch the rest.
Analysts hand the agent alerts nobody put in the case set. The playbooks
change. A detection rule gets renamed. The model provider updates
something on a Tuesday. The offline score stays at 91% while the thing
analysts see quietly gets worse.

Online evals are how you notice. They grade a sample of real
interactions, continuously, with the same rubrics the offline evals use,
and they turn what they find into new offline cases. It is the loop that
keeps the rest of the series honest.

## The use case

The triage agent in production, a few thousand alerts a day. Every run
is logged with its inputs, retrieved playbook sections, tool calls, and
final summary, the same trace structure the offline evals consume.
Analysts can mark a triage as wrong with one click, and about two
percent of them do. The question is not "is this triage good" but "is
the distribution of quality moving, and where."

## Sample, do not grade everything

Grading every triage with a judge is affordable at our volume and still a
bad idea. It doubles model spend for a number that would not change your
decisions, and it tempts you to page someone over a single bad grade.
Sample instead, and sample on purpose:

- A uniform random slice, a few percent, for the trend line.
- Every triage an analyst marked as wrong.
- Every run where a guardrail fired or a tool errored.
- Every run the agent escalated as severity one, because those get
  human eyes anyway and the grade is nearly free.
- Every run longer than some turn count, because long ones are where
  agents wander.

```python
# monitor/sampler.py
import random
from dataclasses import dataclass

from soc_agent.trace import Trace


@dataclass
class SampleDecision:
    graded: bool
    reason: str


def should_grade(trace: Trace, rate: float = 0.03) -> SampleDecision:
    if trace.analyst_feedback == "wrong":
        return SampleDecision(True, "analyst_flag")
    if any(not c.result_ok for c in trace.calls):
        return SampleDecision(True, "tool_error")
    if trace.guardrail_fired:
        return SampleDecision(True, "guardrail")
    if trace.record.severity == 1:
        return SampleDecision(True, "sev1")
    if trace.turns >= 8:
        return SampleDecision(True, "long_run")
    if random.random() < rate:
        return SampleDecision(True, "random")
    return SampleDecision(False, "")
```

The reason is stored with the grade. A drop in quality among random
samples means something different from a drop among tool-error samples,
and the dashboard needs to show them apart.

## Grade with the same judge

The judge from part three grades production summaries with the same
rubric, with one difference: there is no reference. The judge gets the
alert, the evidence the agent gathered, the actions it took, and the
summary, and grades faithfulness against the evidence alone. Calibration
was re-run for this variant, because a judge that agrees with analysts
when it has a reference does not automatically agree when it does not.

```python
# monitor/grade_worker.py
from datetime import datetime, timezone

from evals.judge import judge_without_reference, overall  # same rubric, no reference field
from monitor.sampler import should_grade
from monitor.store import iter_new_traces, write_grade


def run_once() -> None:
    for trace in iter_new_traces():
        decision = should_grade(trace)
        if not decision.graded:
            continue
        grade = judge_without_reference(
            trace.alert_text(), trace.evidence_text(), trace.actions_text(), trace.final_text,
        )
        write_grade({
            "trace_id": trace.id,
            "graded_at": datetime.now(timezone.utc).isoformat(),
            "sample_reason": decision.reason,
            "overall": overall(grade),
            "criteria": {k: v.passed for k, v in grade.model_dump().items()},
            "reasons": {k: v.reason for k, v in grade.model_dump().items()},
            "prompt_version": trace.prompt_version,
            "model": trace.model,
            "alert_source": trace.alert_source,
        })
```

This runs as a scheduled job every few minutes. It is deliberately
boring. The interesting part is what you do with the rows.

## Watch the trend, not the point

A single day's score is noise. What matters is the seven-day rolling
rate per sample reason, split by prompt version, model, and alert source.
The splits are what make the chart actionable: when the line drops, you
want to know in one glance whether it dropped for everyone, only for the
version you shipped on Thursday, or only for alerts from one detection
platform.

Alerting is on the random slice only, and only on a sustained move. We
page nobody. A drop of more than a few points held for two days opens a
ticket with the twenty worst-graded traces attached.

## Close the loop

This is the step that makes online evals worth the trouble. Every
production failure the judge finds, and every analyst flag a second
analyst confirms, becomes an offline case. The alert and evidence are
already logged. Someone writes the reference summary, tags it, and it
joins the set.

```python
# monitor/promote.py
import json
from pathlib import Path

from monitor.store import load_trace

OFFLINE_SET = Path("evals/summaries.jsonl")


def promote(trace_id: str, reference: str, tags: list[str]) -> None:
    trace = load_trace(trace_id)
    case = {
        "id": f"prod-{trace_id[:8]}",
        "alert": trace.alert_text(),
        "evidence": trace.evidence_text(),
        "actions": trace.actions_text(),
        "reference": reference,
        "tags": tags + ["from-production"],
        "source": {"trace_id": trace_id, "graded": trace.grade["overall"]},
    }
    with OFFLINE_SET.open("a") as f:
        f.write(json.dumps(case) + "\n")
```

The `from-production` tag lets me report the offline score on
production-sourced cases separately. They are harder than the original
hand-written set, and the score on them is the number I trust most.
Roughly a third of our case set came in through this door, and it is the
third that catches regressions.

## What it caught

- A detection platform upgrade that renamed a field in its alert
  payload. Offline evals passed because the fixtures still used the old
  name. Online faithfulness on random samples fell eight points in a day,
  because the agent was summarizing alerts with half the context missing
  and not saying so.
- A model update that made summaries longer and, in a small share of
  cases, started opening with a restatement of the alert before saying
  anything new. Clarity grades drifted down over a week. Nothing broke;
  something got worse, and analysts noticed before the chart did.
- A category of alert we had never written a case for, from a cloud
  posture tool a different team had just onboarded. Their first week of
  analyst flags became fourteen cases and one prompt change.

## Where the series ends

Eight posts ago I described a year of building security agents without
any of this. The honest summary of what changed is not that I learned a
technique. It is that I stopped guessing. Every one of these evals
answers a question I used to answer with a feeling, and in security the
feeling was wrong often enough, in the wrong direction, that I do not
miss it.

If you build one thing from this series, build the code-graded harness
from part two and run it on every change. If you build two, add the
judge and calibrate it against your analysts. The rest will earn their
place as the agent gains tools and blast radius, and you will know when,
because you will have a number that tells you.
