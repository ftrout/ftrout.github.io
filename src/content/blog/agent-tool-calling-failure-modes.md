---
title: "Five Ways Tool-Calling Agents Fail Quietly"
description: "The loud failures are easy. These are the ones that produced a plausible answer, logged a green checkmark, and were wrong."
pubDate: 2026-09-02
tags: [agents, tool-use, observability]
---

An agent that crashes is a good day. You get a stack trace, a failing
request, and an obvious thing to fix. The agents that keep me up at night are
the ones that finish, return something reasonable-looking, and are wrong in
a way nobody notices for a week.

These are five failure modes from an internal operations agent I've worked
on. It has about a dozen tools: query a ticketing system, look up a customer,
read deployment status, open a change request, and so on. Each of these
failures got past our tests and into the hands of real users.

## 1. The tool returned an error and the model kept going

Our `lookup_customer` tool returned `{"error": "not found"}` for an ID that
had a typo. The model read that, decided the customer must be new, and
cheerfully proceeded to open a change request for an account that didn't
exist.

The fix was not in the prompt. We changed the tool contract so that errors
raise instead of returning a payload the model has to interpret, and the
agent loop surfaces the error to the user rather than feeding it back as a
tool result. Models are optimistic. Don't give them the option.

## 2. The right tool, the wrong argument, a plausible answer

Asked for "deploy status for the payments service," the model called
`get_deploy_status(service="payment")`. The tool did a prefix match, found
`payment-gateway-legacy`, and returned its status. The answer was confident,
formatted nicely, and about the wrong service.

Two changes: the tool now requires an exact service name and returns the list
of close matches on a miss, and the agent's final answer includes the exact
arguments it used. Users caught the next one in seconds because the answer
said which service it had checked.

## 3. Silent truncation

One tool returns ticket comments. On a long thread it returned the first
forty and dropped the rest without saying so. The model summarized "the
discussion" from the first forty, which happened to end right before the
resolution.

Every tool that can return a partial result now says so explicitly in the
payload:

```json
{
  "comments": ["..."],
  "returned": 40,
  "total": 112,
  "truncated": true,
  "next_cursor": "eyJvZmZzZXQiOjQwfQ=="
}
```

The model handles this well when it can see it. It does not handle what it
cannot see.

## 4. Doing the right thing twice

A transient timeout on `create_change_request` made the agent retry. The first
call had actually succeeded. Two change requests, one ticket, one confused
on-call engineer.

Any tool with side effects now takes an idempotency key derived from the
conversation and the step. The second call returns the first result. This
is an old lesson from distributed systems, and it applies without
modification to agents.

## 5. The answer that was true at the time

The agent checked deployment status, then spent ninety seconds querying
tickets and drafting a summary. By the time it reported "no deploy in
progress," a deploy had started. The report was accurate when the tool ran
and stale when the user read it.

We now stamp every tool result with the time it was fetched, and the final
answer states the oldest timestamp it relied on. It is a small thing, and it
has prevented at least two people from acting on a stale status.

## The pattern

None of these were model failures in the usual sense. The model did
something reasonable with the information it had. The information was
wrong, incomplete, ambiguous, or old, and nothing in the loop made that
visible. The common fix was to make the tools honest: raise on errors,
refuse ambiguous inputs, declare truncation, make side effects idempotent,
and timestamp everything.

If I could give one piece of advice to someone building their first
tool-calling agent, it would be this: spend your time on the tools and the
loop. The model is the part you can least control and, in my experience, the
part least often at fault.
