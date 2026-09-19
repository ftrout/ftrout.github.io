---
title: "Log Everything the Agent Did, Because Someone Will Ask"
description: "An incident review asked why the agent closed an alert, and we could not answer. What to record on every run, what not to, and the few lines of code that make replay possible."
pubDate: 2026-08-28
tags: [mlops, agents]
draft: false
---

An alert the triage agent had closed as benign turned out, two weeks later,
to be the first sign of something that was not benign. The incident review
asked the obvious question: why did it close that one?

We could not answer. We had the final verdict and the summary it wrote. We
did not have the tool calls, what those tools returned, which version of the
prompt was running, or which model. The system that made the call left less
of a trail than an analyst's ticket notes would have.

That was the week logging stopped being an afterthought.

## The question you are designing for

Every decision about what to record comes back to one test: **six weeks from
now, can someone who was not there reconstruct why the agent did what it
did?**

That rules out logging only the final answer, which tells you what, not why.
It also rules out dumping everything into your general application logs, where
it sits next to health checks and gets rotated out in fourteen days.

## What goes in a run record

One record per run, written as the run happens rather than at the end, so a
crash still leaves a trail.

```python
# agent/runlog.py
import hashlib, json, time, uuid
from dataclasses import dataclass, field, asdict
from typing import Any


def fingerprint(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:12]


@dataclass
class ToolEvent:
    name: str
    args: dict[str, Any]
    ok: bool
    duration_ms: int
    result_preview: str          # first 500 chars, redacted
    result_ref: str | None       # pointer to the full result, if stored


@dataclass
class RunRecord:
    alert_id: str
    model: str
    prompt_version: str          # fingerprint of the system prompt
    tools_version: str           # fingerprint of the tool definitions
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    started: float = field(default_factory=time.time)
    events: list[ToolEvent] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)
    verdict: str | None = None
    stop_reason: str | None = None

    def write(self, path: str) -> None:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(self)) + "\n")
```

The fields that earn their place:

- **`prompt_version` and `tools_version`.** A hash of the system prompt and
  of the tool definitions. When behaviour changes, the first question is
  whether anything changed, and a hash answers it without storing the full
  prompt on every run.
- **`model`.** The exact model identifier, not "Claude." Models change, and
  a run is only reproducible against the one it used.
- **Every tool call, with arguments.** Arguments are where most mistakes
  live: the wrong hostname, a time range of thirty days instead of one.
- **Token usage.** Straight from the API response, which reports
  `input_tokens` and `output_tokens`, plus cache reads and writes if you use
  prompt caching. Summed per run, this is also your cost data.
- **`stop_reason`.** Whether the run ended because the model finished, hit
  the turn limit, or hit the token limit. A surprising number of odd verdicts
  turn out to be runs that were cut off.

## Hooking it into the loop

The recording belongs in the tool dispatcher, the one function every tool call
goes through, so no tool can be called without leaving a record.

```python
def call_tool(run: RunRecord, name: str, args: dict) -> str:
    start = time.monotonic()
    ok, result = True, ""
    try:
        result = TOOLS[name](**args)
    except Exception as exc:
        ok, result = False, f"ERROR: {exc}"
    run.events.append(ToolEvent(
        name=name,
        args=args,
        ok=ok,
        duration_ms=int((time.monotonic() - start) * 1000),
        result_preview=redact(result)[:500],
        result_ref=store_full_result(run.run_id, result),
    ))
    return result
```

And usage is accumulated from every model response:

```python
for key in ("input_tokens", "output_tokens",
            "cache_read_input_tokens", "cache_creation_input_tokens"):
    run.usage[key] = run.usage.get(key, 0) + (getattr(response.usage, key, 0) or 0)
```

## What not to log, or not there

This is the part I got wrong second, after getting the first part wrong by
not logging at all.

Tool results in a security context are full of things that should not end up
in a general-purpose log platform: usernames, email bodies, internal
hostnames, occasionally a credential someone pasted into a ticket. My first
version wrote full tool results into the same pipeline as the application
logs, which meant anyone with access to the logging platform could read
phishing emails sent to the finance team.

What we do now:

- **Previews in the run record, redacted.** The first 500 characters, with a
  redaction pass for obvious secrets and tokens. Enough to understand the run
  at a glance.
- **Full results in a restricted store**, keyed by run ID, with the same
  access controls as the case management system, because that is effectively
  what it is.
- **A retention period that matches the tickets.** If you keep incident
  records for a year, keep agent runs for a year. If you delete tickets after
  ninety days, the agent's view of those tickets should not outlive them.

## Replay

The payoff for recording tool results is replay. Given a run record, you can
feed the same alert and the same recorded tool results back through a new
prompt or model, without touching live systems, and see whether the verdict
changes.

That turned the incident review question into something we could test. We
replayed the run that closed the alert, confirmed the model had seen the
suspicious sign-in and discounted it, changed the prompt, and replayed it
again. The replayed run became a case in the evaluation set so the same miss
would fail the build next time, which is how [code-graded evals](/blog/evals-02-code-graded/)
get their best cases.

Replay is not a perfect reproduction, because the model's output varies
between runs even with the same inputs. It is close enough to tell you
whether a change moved the behaviour in the direction you wanted.

## The dashboards that turned out to matter

Once the data exists, a few aggregate views earn their keep:

- **Runs ending on the turn limit.** Should be close to zero. A rise means
  something is making the agent loop.
- **Tool error rate by tool.** A tool that errors often is usually a tool
  with a confusing interface, not a flaky backend.
- **Verdict mix over time.** If the share of alerts closed as benign moves
  sharply after a change, you want to know before an analyst does.
- **Tokens per run, by alert type.** Cost, and also a proxy for how hard the
  agent is working to reach a verdict.

None of this is sophisticated. It is the same thing you would want from any
system making decisions on your behalf. The mistake was assuming that because
the model was new, the operational basics were somebody else's problem.
