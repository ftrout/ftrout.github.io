---
title: "The Prompt Still Matters: Building an Eval Pipeline with Claude Haiku"
pubDate: 2026-08-12
description: "Models got smart enough that prompt engineering feels obsolete — right up until you measure it. Why an efficient prompt still pays, the four honest ways to evaluate one, and how to stand up a cheap, repeatable eval pipeline with Claude Haiku as the judge. With code, and a notebook you can run."
author: "Frank Trout"
---

Every few months someone declares prompt engineering dead. The models are smarter now. You don't need the incantations, the "take a deep breath," the ALL-CAPS threats. And they're half right — a lot of what got called prompt engineering in 2023 was superstition, and current models genuinely don't need it.

But the conclusion people draw from that is wrong. The prompt didn't stop mattering. **It stopped being decorative and became load-bearing** — it's the one part of your AI system you fully control, it runs on every single request, and current models follow it *more* literally than the models most of that text was written for. Which means the leftover cruft in your prompt isn't neutral. It's actively steering the model.

The only way to know which of those sentences is helping and which is hurting is to measure. I've [made the general case for evals](/blog/you-cant-improve-what-you-cant-measure) before. This is the specific, buildable version: an eval pipeline for a *prompt*, cheap enough that you'll actually run it, with Claude Haiku as the workhorse. There's a runnable notebook in [examples/prompt-eval-pipeline](https://github.com/ftrout/ftrout.github.io/tree/main/examples/prompt-eval-pipeline) with every step wired together.

## Why an efficient prompt still pays

Four reasons, none of them nostalgia.

**Cruft actively degrades behavior.** This is the one people miss. Anthropic's own prompting guidance is now largely about *removal*: pressure language ("CRITICAL: you MUST…"), step-by-step choreography, "think step by step," prohibition lists, hard word caps. Those were mitigations for models that under-triggered, planned badly, or ignored soft instructions. Current models don't have those failures, so the mitigations over-apply. A blanket "if in doubt, use the tool" produces a model that uses the tool for everything. An anxious prompt produces a hedging model. When five instructions are each marked CRITICAL, none of them is. You're not just wasting tokens — you're mis-steering a model that is trying very hard to do exactly what you said.

**It's the cheapest lever you have, and the only one you own outright.** You can't retrain the model. You may not be able to touch the retrieval layer this sprint. You can change the prompt this afternoon and it takes effect everywhere at once. That's enormous leverage, and an enormous blast radius — which is precisely why it needs a test suite.

**Scale turns style into money.** A prompt is a fixed cost paid on every request. Two hundred words of dead instruction, a million times a day, is a real line item — and worse than the arithmetic suggests, because bloated instructions also inflate reasoning and output length. Efficiency here isn't aesthetic minimalism; it's the same instinct as [not building the agent you didn't need](/blog/when-not-to-build-an-agent).

**Half of "prompt engineering" is really [context engineering](/blog/context-engineering-is-the-job).** The instructions are a small part of what reaches the model. What you put *around* them — the policy snippet, the retrieved documents, the examples, the tool descriptions — is most of the surface, and it's the part that quietly rots as the product changes. An eval is how you find out.

The deletion rule I keep coming back to: **keep what only you know, delete what the model already knows.** Your audience, your product, your quality bar, your policy, and the *reasons* behind your constraints — that's context, and context is never cruft. "Be accurate and thorough" is the model describing itself back to you.

Here's the shape of the difference, using the support-triage example from the notebook:

```text
# v1 — written for a 2023 model
You are a helpful customer support AI assistant. CRITICAL: You MUST
classify every ticket. Think step by step before answering. IMPORTANT:
Output ONLY valid JSON, no other text, no markdown fences. NEVER make
things up. Be professional and empathetic. Be thorough, do not be lazy.

# v2 — written for the model you're actually running
You triage inbound support tickets for Northwind, a B2B SaaS company.
Classify the ticket, then draft a reply the customer will read directly.

Our refund window is 30 days and our support SLA is one business day.
Never promise anything outside <policy> — customers hold us to replies,
and a promise we can't keep costs more than a slow answer. If the ticket
is ambiguous, say what you'd need to know rather than guessing.
```

The second one is *longer*. Efficiency isn't brevity — it's every token earning its place. Note that "Output ONLY valid JSON" vanished, because that job belongs to structured outputs (`output_config.format`), not to a sentence you hope the model obeys. Anything the API can guarantee shouldn't be a prompt instruction at all.

Now: is v2 actually better? That isn't a question you get to answer by reading it.

## The four honest ways to evaluate a prompt

There is no single "prompt score." You evaluate along the dimensions you actually care about, and you use the cheapest grader that can judge each one.

**Code graders.** Exact match, string match, schema validation, regex, "did it stay under N tokens," "did it call the right tool." Deterministic, free, instant — and blind to any valid variation you didn't anticipate. Use these wherever the answer is genuinely categorical. In the triage example the ticket category *is* categorical, so it gets an exact-match grader and never touches an LLM.

**Model graders (LLM-as-judge).** A second model reads the output and scores it against a rubric. This is how you grade the things that matter most and resist string matching: tone, groundedness, whether the reply invented a policy. Flexible and nuanced, but non-deterministic and — this is the part teams skip — **it has to be calibrated against human judgment before you're allowed to trust it.**

**Human graders.** The gold standard, and far too slow to be your loop. Their real job is producing the small labeled set you calibrate the model grader against, plus periodic spot-checks.

**Operational metrics.** Latency, tokens, cost per request, parse-failure rate. Unglamorous, entirely automatic, and often the dimension that actually decides which prompt ships. A prompt that scores two points higher on tone and costs 3× per call is a business decision, not a win.

Most real evals are multidimensional — you run all four and read them together. A few design rules that keep you from grading garbage:

- **Volume over polish.** Fifty automatically-graded cases beat twelve hand-graded ones. Start with 20–50 tasks drawn from real failures and user-reported bugs, not from your imagination.
- **Test both directions.** If you only test that the model escalates when it should, you'll optimize your way into a model that escalates everything. One-sided evals produce one-sided behavior.
- **Unambiguous tasks only.** If two people on your team would grade a case differently, the case is broken, not the model.
- **Grade outcomes, not procedure.** Don't assert a specific sequence of steps. Assert what had to be true at the end.

## The pipeline, step by step

The whole thing is about 200 lines. Here's the spine; the notebook has it running end to end.

### 1. Write down the success criteria first

Before any code. Specific, measurable, and with a threshold you commit to *before* you see the numbers — otherwise you'll rationalize whatever you get.

```python
SUCCESS_CRITERIA = {
    "category_accuracy":  0.95,  # exact match, code-graded
    "urgency_accuracy":   0.85,  # exact match, code-graded
    "tone_score":         4.0,   # 1-5 Likert, LLM-judged
    "groundedness_rate":  0.98,  # no invented policy, LLM-judged
    "parse_success_rate": 1.00,  # operational
}
```

"Good performance" is not a criterion. "Category accuracy ≥ 95% on a held-out set of 50 tickets, with zero invented refund promises" is.

### 2. Build a golden set from real failures

Twenty to fifty cases, each with its inputs and its expected outcome. Pull them from production complaints, from the bug tracker, from the manual checks you're already running by hand. Deliberately include the ugly ones: ambiguous tickets, empty input, off-topic rants, a customer demanding something your policy forbids — and cases where the right answer is to *not* act.

Once you have a baseline, have Claude generate variations to grow the set. Generated cases inherit the model's blind spots, so the real failures stay the backbone.

### 3. Run the candidates and capture everything

Run each prompt version over every case, in parallel, recording output, latency, and token usage. The measurement scaffolding matters as much as the score:

```python
def run_case(prompt: str, case: dict) -> dict:
    t0 = time.perf_counter()
    response = client.messages.parse(
        model="claude-haiku-4-5",
        max_tokens=1024,
        system=prompt,
        messages=[{"role": "user", "content": case["ticket"]}],
        output_format=TriageOutput,   # structured outputs — no parse gymnastics
    )
    return {
        "case_id": case["id"],
        "output": response.parsed_output,
        "latency_ms": (time.perf_counter() - t0) * 1000,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
    }
```

### 4. Code-grade what you can

Cheap, deterministic, and it should cover more of your suite than you'd expect:

```python
def grade_code(case: dict, out: TriageOutput) -> dict:
    return {
        "category_correct": out.category == case["expected_category"],
        "urgency_correct":  out.urgency == case["expected_urgency"],
        "reply_length_ok":  len(out.reply.split()) <= 120,
    }
```

### 5. Model-grade the rest — with Haiku

Now the judge. Haiku is the right tool here for a boring reason: judging is a high-volume, narrow, well-specified task, which is exactly what a small fast model is good at, and cost is what determines whether you run the suite on every commit or once a quarter.

Four rules make an LLM judge trustworthy:

**Grade one dimension per call.** A judge asked to score tone, groundedness, and helpfulness at once will smear them together and produce a composite it can't defend. Separate calls, separate rubrics.

**Give it an escape hatch.** Let it return `"unknown"`. A judge with no way to express uncertainty will invent confidence, and you'll never see the cases your rubric doesn't cover.

**Let it reason, then take the score.** Ask for a short justification *before* the verdict, then discard the prose. It measurably improves judgment on anything requiring real assessment — and when you're debugging a weird score, that reasoning is the first thing you'll want to read.

**Constrain the output shape with the API, not with pleading.** Structured outputs, every time.

```python
class Verdict(BaseModel):
    reasoning: str          # comes first: reason, then score
    score: Literal["1", "2", "3", "4", "5", "unknown"]

def judge(rubric: str, ticket: str, reply: str) -> Verdict:
    return client.messages.parse(
        model="claude-haiku-4-5",
        max_tokens=512,
        system=(
            "You grade one dimension of a customer support reply. "
            "Judge only the dimension in <rubric>. Return 'unknown' if the "
            "rubric doesn't cleanly apply — do not guess."
        ),
        messages=[{"role": "user", "content":
            f"<rubric>{rubric}</rubric>\n<ticket>{ticket}</ticket>\n<reply>{reply}</reply>"}],
        output_format=Verdict,
    ).parsed_output
```

One caveat worth stating plainly: judging a model with itself invites self-preference bias. In the notebook Haiku grades Haiku because it makes the example cheap to run — but in production, either judge with a more capable model than the one under test, or keep a human-labeled calibration set and check the judge against it. Which is the next step, and the one nobody does.

### 6. Calibrate the judge before you believe it

Hand-label 20 cases yourself. Run the judge on the same 20. Measure agreement. If your judge agrees with you 60% of the time, your eval is measuring the judge, not the prompt — fix the rubric and re-check.

```python
agreement = sum(
    abs(judge_scores[i] - human_scores[i]) <= 1 for i in range(len(human_scores))
) / len(human_scores)
assert agreement >= 0.85, f"Judge not calibrated ({agreement:.0%}) — fix the rubric first"
```

This is the step that separates an eval from theater. An uncalibrated judge produces numbers with all the authority of a measurement and none of the meaning.

### 7. Score the run, then compare

Aggregate per dimension, per prompt version, alongside cost and latency. What you want at the end is one table:

| Metric | v1 (crufty) | v2 (clean) | Threshold |
| --- | --- | --- | --- |
| Category accuracy | 0.92 | 0.96 | ≥ 0.95 |
| Tone (1–5) | 3.6 | 4.3 | ≥ 4.0 |
| Groundedness | 0.94 | 1.00 | ≥ 0.98 |
| Parse success | 0.88 | 1.00 | = 1.00 |
| Cost / 1k requests | $2.41 | $1.86 | — |

(Those are illustrative numbers, not a benchmark — run it on your own tickets.) The table is the point. Not "v2 feels better," but v2 is measurably better *and* cheaper, and you can say so in a design review with a number attached.

### 8. Check consistency, not just correctness

One pass tells you the model *can* do it. A customer-facing system needs it to do it *every* time. Run each case k times and report **pass^k** — the fraction that passed all k attempts — not just pass@k, the fraction that passed at least once. The gap between them is your reliability problem, and it's usually wider than anyone expects. This is the same [demo-to-production gap](/blog/the-demo-to-production-gap) showing up as a number.

### 9. Turn it into a gate

An eval you run manually is a document. An eval that runs in CI is a control. Wire it into the pipeline, fail the build when a metric drops below threshold, and store each run's results so you can point at the commit that moved the number.

```python
def gate(results: dict, criteria: dict = SUCCESS_CRITERIA) -> None:
    failures = [
        f"{metric}: {results[metric]:.3f} < {threshold}"
        for metric, threshold in criteria.items()
        if results[metric] < threshold
    ]
    if failures:
        raise SystemExit("Eval gate failed:\n  " + "\n  ".join(failures))
```

When the suite gets big, run it through the Batch API — same requests, asynchronous, half price. Overnight is fine for a suite that isn't gating a commit.

## The traps

**Grading the procedure instead of the outcome.** Asserting an exact tool sequence bakes today's implementation into your test suite and fails every valid improvement.

**An uncalibrated judge.** Covered above, and worth repeating because it's the most common failure I see. Numbers without calibration are worse than no numbers, because people believe them.

**Overfitting to the eval.** Iterate hard enough against 30 cases and you'll write a prompt that's excellent at those 30. Hold out a test set you never tune against, and keep adding real failures as they arrive.

**Skipping the negative cases.** Test what should *not* happen with the same rigor as what should.

**Treating the eval as finished.** Your golden set is a living artifact. Every production surprise is a new case. That's the flywheel: something goes wrong, it becomes a test, it never silently goes wrong again.

---

The reason to build this isn't that prompts are hard. It's that prompts are *easy* — easy to change, easy to change carelessly, easy to convince yourself you improved. An eval pipeline is what converts that ease from a liability into a rate of improvement. At Haiku prices, the excuse for not having one is gone.

The notebook is in [examples/prompt-eval-pipeline](https://github.com/ftrout/ftrout.github.io/tree/main/examples/prompt-eval-pipeline) — dataset, runner, code graders, Haiku judge, calibration, scoring, consistency check, and the CI gate. Swap in your prompt and your tickets and you have a working harness before lunch.
