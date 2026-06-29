# Three Tiers of "Intelligence" — a worked example

A single customer-support domain implemented at three escalating tiers, to make one
rule concrete: **start at the cheapest tier that can do the job, and only escalate
when the tier above genuinely can't.**

| Tier | What it is | Latency | Cost | Predictability |
| --- | --- | --- | --- | --- |
| 1 | Deterministic code / plain API | ~1 ms | $0 | 100% predictable |
| 2 | Single LLM call | ~1 s | ~$0.001 | mostly predictable |
| 3 | Agent (LLM + tools + loop) | ~10–60 s | ~$0.05+ | least predictable |

Each tier down is strictly more powerful, slower, more expensive, and less
predictable than the one above it.

- **Tier 1** — the input is structured and the logic is a fixed rule, so an LLM would
  only add latency, cost, and a chance to hallucinate. Use plain code.
- **Tier 2** — a single LLM call when rules can't capture the mapping but the *shape*
  of the work is fixed (you know it's exactly one call): classify fuzzy input, or
  draft fuzzy output.
- **Tier 3** — an agent only when the sequence of steps is unknown in advance and
  depends on intermediate results and real side effects. Note the `max_turns` guard
  and the irreversible `issue_refund` tool — agents are non-deterministic and can run
  away. If you could have written the steps as a fixed sequence, you wanted a
  *workflow*, not an agent.

`handle()` at the bottom is the router: it sends each request to the cheapest tier
that can handle it.

## Mental model

> An **LLM** is a "fuzzy function" — reach for it only when the mapping from input to
> output can't be written as rules. An **agent** is an LLM that *also* decides its own
> control flow — reach for it only when you can't write the sequence of steps in
> advance.

## Running it

```sh
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...   # your key
python support_tiers.py
```

The backend functions (`get_order`, `issue_refund`) are fakes so the example runs
without a real database or payment processor.

## The essay behind it

This is the code companion to **["The Simplest Agent That Could Possibly
Work"](https://ftrout.github.io/blog/simplest-agent-that-could-possibly-work/)** —
diagnose the gap, then reach for the cheapest layer that closes it. See also
**["How the LLM Reshapes Your
Architecture"](https://ftrout.github.io/blog/the-llm-is-not-a-function-call/)** for
why each tier down trades away predictability, cost, and speed.
