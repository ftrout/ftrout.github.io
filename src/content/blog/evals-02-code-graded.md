---
title: "Code-Graded Evals: The Cheapest Signal You Will Ever Get"
description: "When the right answer is a severity, a category, a set of indicators, or a structure, grade it with code. A pytest harness that runs in seconds and never argues with itself."
pubDate: 2026-08-11
tags: [llm-evals, testing, security]
series: "Evals in Practice"
seriesOrder: 2
draft: false
---

Most of what a security agent produces is harder to grade than a unit
test. But not all of it. A surprising share of the outputs I care about
are values I can check with an equals sign: a severity, an alert
category, the list of indicators it extracted, a JSON record with a
required shape, a decision to escalate or not.

Code-graded evals cover exactly that share. They are deterministic, they
run in milliseconds, and they cost nothing per case. They should be the
first eval you build and the one you run most often. This post is the
harness I use, and the mistakes I made building it.

## The use case

The alert triage agent. Before it does anything else, it produces a
structured triage record: a category from a fixed list, a severity, the
indicators of compromise it pulled from the alert, and whether the alert
needs a human now. Everything downstream depends on that record being
right, and an analyst's queue is sorted by it.

That record is a perfect code-graded target. The category is one of
seven strings. The severity is an integer from one to four. The escalation
flag is a boolean. The indicators are a set of typed strings. There is no
room for "close enough."

## Cases as data, not as code

The first version of my harness had the cases inline in the test file. It
was fine for ten cases and unbearable at forty. Cases belong in a data
file, one per line, so that an analyst can add one without touching
Python.

```jsonl
{"id": "phish-001", "input": {"source": "email-gateway", "subject": "Invoice overdue - action required", "sender": "billing@acme-invoices.co", "attachments": ["invoice_0392.html"]}, "expected": {"category": "phishing", "severity": 3, "escalate": false, "iocs": [{"type": "domain", "value": "acme-invoices.co"}]}, "tags": ["phishing"]}
{"id": "cred-014", "input": {"source": "idp", "event": "impossible_travel", "user": "j.alvarez", "locations": ["Denver, US", "Lagos, NG"], "minutes_apart": 11}, "expected": {"category": "credential-access", "severity": 1, "escalate": true, "iocs": []}, "tags": ["credential-access", "escalation"]}
{"id": "benign-003", "input": {"source": "edr", "event": "new_scheduled_task", "host": "build-07", "task": "nightly-backup", "signer": "IT Automation"}, "expected": {"category": "benign", "severity": 4, "escalate": false, "iocs": []}, "tags": ["benign"]}
```

Three things about this format matter. Every case has a stable `id`, so
results can be diffed across runs. Every case has `tags`, so I can run or
report on a slice. And the third case exists on purpose: a routine event
that should be filed as benign. Evals that only contain true positives
reward a system that escalates everything, and an agent that escalates
everything is a pager storm.

## The harness

I use pytest because the team already knows it and because
parametrization does the bookkeeping for free. The system under test is
called through its real entry point, not a re-implementation.

```python
# tests/eval_triage.py
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from soc_agent.triage import TriageRecord, triage  # the real code path

CASES = [json.loads(line) for line in Path("evals/triage.jsonl").read_text().splitlines() if line.strip()]


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_triage(case, results):
    try:
        record: TriageRecord = triage(case["input"])
    except ValidationError as exc:
        results.record(case["id"], passed=False, reason=f"schema: {exc.errors()[0]['msg']}")
        pytest.fail(f"output failed schema validation: {exc}")

    expected = case["expected"]
    mismatches = {}
    for field in ("category", "severity", "escalate"):
        if getattr(record, field) != expected[field]:
            mismatches[field] = (getattr(record, field), expected[field])

    got_iocs = {(i.type, i.value) for i in record.iocs}
    want_iocs = {(i["type"], i["value"]) for i in expected["iocs"]}
    if got_iocs != want_iocs:
        mismatches["iocs"] = {"missed": sorted(want_iocs - got_iocs), "extra": sorted(got_iocs - want_iocs)}

    results.record(case["id"], passed=not mismatches, reason=str(mismatches) if mismatches else "")
    assert not mismatches, mismatches
```

Two details carry most of the value.

The schema check comes first and is reported separately. An output that
is not even a valid `TriageRecord` is a different failure from a valid
record with the wrong severity. Lumping them together hides the day the
model starts returning prose instead of JSON.

Every case records a result, pass or fail, with a reason. That is what
the `results` fixture does. It writes one JSON line per case to a file
named after the git commit, so two runs can be diffed.

```python
# tests/conftest.py
import json
import subprocess
from pathlib import Path

import pytest


class Results:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text("")

    def record(self, case_id: str, passed: bool, reason: str = "") -> None:
        with self.path.open("a") as f:
            f.write(json.dumps({"id": case_id, "passed": passed, "reason": reason}) + "\n")


@pytest.fixture(scope="session")
def results():
    sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    return Results(Path(f"eval-results/triage-{sha}.jsonl"))
```

## The diff is the product

The pass rate is the number people ask for. The diff is the number people
act on. A change that moves the pass rate from 91% to 92% could have
fixed three cases and broken two, and the two it broke are what the
reviewer needs to see.

```python
# scripts/eval_diff.py
import json
import sys
from pathlib import Path


def load(path: str) -> dict[str, dict]:
    return {r["id"]: r for r in map(json.loads, Path(path).read_text().splitlines()) if r}


before, after = load(sys.argv[1]), load(sys.argv[2])
for case_id in sorted(before.keys() & after.keys()):
    b, a = before[case_id]["passed"], after[case_id]["passed"]
    if b != a:
        marker = "FIXED " if a else "BROKE "
        print(f"{marker} {case_id}: {after[case_id]['reason'] or before[case_id]['reason']}")
```

The output on a real pull request looks like this:

```text
FIXED  phish-014: {}
FIXED  phish-022: {}
BROKE  cred-007: {'escalate': (True, False)}
```

That one `BROKE` line is the regression that took me two days to find
back when I was testing by pasting alerts into a chat window: a
credential-access alert that stopped being escalated. Now it takes the
time it takes pytest to run.

## Beyond equality

Exact match is the starting point, not the limit. The same harness
handles anything a function can decide:

- **Set overlap** for list outputs, such as the indicators the agent
  extracts or the ATT&CK techniques it tags. Report precision and recall
  rather than a bare pass or fail, because missing one indicator out of
  six is a different problem from inventing three.
- **Numeric tolerance** for computed values, such as a risk score. A
  score that is off by a point is not the same failure as one that is
  off by a factor of ten.
- **Property checks** when there is no single right answer but there are
  invariants. A generated SIEM query must parse, must be read-only, must
  be bounded to a time range, and must reference only indices the agent
  is allowed to search.
- **Negative assertions.** The triage summary must not contain a full
  credential or session token that appeared in the raw alert. The agent
  must not have recommended isolation for a case tagged `benign`.

Property checks in particular are underused. You can rarely write down
the exact right SIEM query for an open-ended question, but you can
always write down four things that would make a query unacceptable.

## Where this stops

Code-graded evals cannot tell you whether an incident summary is
accurate, whether the recommended next step is the right one, or whether
the explanation would make sense to a junior analyst at 3 a.m. The moment
you catch yourself writing a regex to detect "a good summary," stop. That
is the job of the next post, where a model does the grading and you spend
most of your effort making sure it grades the way an analyst would.
