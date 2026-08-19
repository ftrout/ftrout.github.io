# A Prompt Eval Pipeline with Claude Haiku — a worked example

A complete, runnable eval pipeline for a **prompt** — not a model, not an agent — built to answer
one question with a number instead of a vibe: *is the cleaned-up prompt actually better than the
one it replaced?*

The task under test is customer-support ticket triage (classify a ticket, draft a reply). Two
prompt versions compete:

| | What it is |
| --- | --- |
| **v1** | Written for a 2023-era model: `CRITICAL: You MUST…`, "think step by step," prohibition lists, JSON coaxed out with prose instructions. |
| **v2** | Written for the model actually being run: real business context and policy, the reason behind each constraint, no incantations — output shape guaranteed by structured outputs instead of asked for politely. |

v2 is *longer*. Efficiency isn't brevity; it's every token earning its place.

## What's in the notebook

| Step | What it does | Grader |
| --- | --- | --- |
| 1 | Success criteria with thresholds committed in advance | — |
| 2 | A 14-case golden set (routine, ambiguous, empty, off-topic, hostile, injection, out-of-policy) + generating more with Claude | — |
| 3 | The two candidate prompts, with token counts | — |
| 4 | Parallel runner capturing output, latency, and token usage | — |
| 5 | Code graders: exact match, schema validity, reply length | code |
| 6 | LLM-as-judge on Haiku: tone (1–5) and groundedness (pass/fail) | model |
| 7 | Calibrating the judge against hand labels | human |
| 8 | The comparison table — quality, latency, and cost per 1k requests | operational |
| 9 | Consistency: `pass@k` vs `pass^k` | — |
| 10 | The CI regression gate and a persisted run log | — |
| 11 | Halving the cost with the Batch API | — |

## The four ways to grade, and when each one is right

- **Code graders** — exact match, schema validation, length checks. Deterministic, free, instant;
  blind to valid variation you didn't anticipate. Use them wherever the answer is categorical.
- **Model graders (LLM-as-judge)** — tone, groundedness, anything that resists string matching.
  Flexible; non-deterministic; **worthless until calibrated against human judgment.**
- **Human graders** — too slow to be your loop. Their job is producing the calibration set.
- **Operational metrics** — latency, tokens, cost, parse-failure rate. Free to collect, and often
  the dimension that actually decides which prompt ships.

## Four rules that make an LLM judge trustworthy

1. **One dimension per call.** A judge scoring tone, groundedness, and helpfulness at once
   produces a composite it can't defend.
2. **Give it an escape hatch.** `"unknown"` is a valid verdict. A judge that can't express
   uncertainty invents confidence.
3. **Reason first, then score.** The justification field comes *before* the verdict in the schema
   so it's generated first. Keep it for debugging; drop it from the metrics.
4. **Constrain the output shape with the API,** not with "return only a number."

## Running it

```sh
pip install anthropic pydantic jupyter
export ANTHROPIC_API_KEY=sk-ant-...   # or: ant auth login
jupyter lab prompt_eval_pipeline.ipynb
```

Everything runs on `claude-haiku-4-5`. A full pass over the built-in dataset — both prompt
versions, all judge calls — costs well under a cent.

**One caveat the notebook makes cheap on purpose:** Haiku grades Haiku here. That invites
self-preference bias. In production, judge with a model at least as capable as the one under
test, or keep a human-labeled calibration set and check the judge against it — Step 7 shows how.

## The traps this example is built to avoid

- Grading the *procedure* (an exact tool sequence) instead of the *outcome*.
- An uncalibrated judge — numbers with the authority of a measurement and none of the meaning.
- Overfitting to a small set you tune against; hold out a test set you never touch.
- One-sided evals: test what should *not* happen as rigorously as what should.
- Treating the suite as finished. Every production surprise becomes a new case.

## The essay behind it

This is the code companion to **["The Prompt Still Matters: Building an Eval Pipeline with Claude
Haiku"](https://ftrout.github.io/blog/the-prompt-still-matters/)**. For the general case — why
"that feels better" is worth nothing and what an eval harness actually buys you — see **["You
Can't Improve What You Can't
Measure"](https://ftrout.github.io/blog/you-cant-improve-what-you-cant-measure/)**.
