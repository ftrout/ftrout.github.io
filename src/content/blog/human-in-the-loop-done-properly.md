---
title: "Human in the Loop, Done Properly"
description: "An approval step that gets approved in seconds, every time, is not a control. Where to put the gate, what the approver needs to see, and how to tell whether review is real."
pubDate: 2026-09-14
tags: [agents, architecture]
draft: false
---

The investigation agent could recommend isolating a host, and a human had to
approve it. That was the control, and it was on the architecture diagram, and
everyone felt good about it.

Then I looked at the approval data. Nearly every recommendation was approved.
The median time between the request appearing and the approval was a few
seconds, which is not long enough to read the request, let alone check it.

The human was in the loop. They were not in the decision. And the
uncomfortable part is that this was a reasonable response to the system we
had built, not a failing of the analysts.

## Why approval turns into a rubber stamp

Three things were wrong, and none of them was the people.

**The request did not contain enough to decide.** It said "Recommend
isolating WS-FIN-0142: suspected compromise." To actually evaluate that, the
approver had to open the case, find the agent's transcript, and reconstruct
its reasoning. Under alert volume, nobody does that.

**The agent was usually right.** Which sounds like good news. But when a
system is right nearly every time, approving without checking is the rational
strategy, and humans are good at learning rational strategies. A review step
that almost never changes the outcome trains people to stop reviewing.

**Everything needed approval.** Early on, the agent needed sign-off for
things like running a broad SIEM query. The volume of low-stakes approvals
taught people that approval requests were noise, and the high-stakes ones
arrived looking exactly the same.

## Tier actions by what they can break

The first fix was to be precise about what needs a human at all. I tier every
action by two questions: how bad is it if this is wrong, and how easily can it
be undone?

| | Easy to undo | Hard to undo |
|---|---|---|
| **Low impact** | No approval. Log it. | Approval, lightweight. |
| **High impact** | Approval, with evidence. | Approval, with evidence and a second person, or not available to the agent at all. |

Read-only tools sit outside the table entirely. Isolating a single
workstation is high impact but easy to undo, so it gets an approval with
evidence. Disabling an executive's account or blocking a domain the whole
company uses is both, and those are not tools the agent has.

Removing approvals from the low-stakes actions was the part that made the
remaining ones meaningful. Fewer requests, each of which actually matters.

## Enforce it in code, not in the prompt

A system prompt that says "always get approval before isolating a host" is
a strong suggestion. The model will follow it almost always, which is not
the same as always, and almost always is not how security controls work.

The gate lives in the tool. The side-effecting tool refuses to run without an
approval record, and the approval record can only be created by a human
action outside the model's reach:

```python
class ApprovalRequired(Exception):
    pass


def isolate_host(host: str, reason: str, *, run: RunRecord) -> str:
    approval = approvals.get(run_id=run.run_id, action="isolate_host", target=host)
    if approval is None:
        request = approvals.request(
            run_id=run.run_id,
            action="isolate_host",
            target=host,
            reason=reason,
            evidence=summarise_evidence(run),
        )
        raise ApprovalRequired(request.id)
    if approval.decision != "approved":
        return f"Isolation of {host} was declined by {approval.by}: {approval.note}"
    edr.isolate(host)
    return f"{host} isolated. Approved by {approval.by} at {approval.at}."
```

When the tool raises `ApprovalRequired`, the agent loop pauses the run and
stores its state. The approver sees the request in the case management
system. Their decision, approved or declined with a note, is written by that
system, and the run resumes with the decision as the tool result.

Nothing the model can say produces an approval record. There is no argument
to pass, no phrasing to try. That is the property that makes it a control.

## Show the approver what they need to decide

The redesigned approval request has five parts, and the order is deliberate:

1. **The action and the exact target.** "Isolate WS-FIN-0142 (finance,
   owned by accounts payable, last seen 4 minutes ago)." Not "the affected host."
2. **The evidence, as facts with sources.** Three to five lines, each one a
   specific observation and the tool call it came from. The approver should be
   able to check any one of them in a click.
3. **What the agent did not check.** Things that would normally be looked at
   and were not, because a tool failed or the run hit a limit. This is the line
   that most often changes a decision, and it only exists if you put it there.
4. **The impact.** What stops working if this is done. For a workstation, one
   person cannot work. For a server, list what runs on it.
5. **How to undo it.** One line. If there is no undo, that is a reason to
   escalate rather than approve.

Section 3 needs a note. The agent does not know what it did not check unless
something tells it. We generate that list in code, by comparing the tools
called in the run against the expected checks for that alert type, the same
comparison the [trajectory evals](/blog/evals-05-trajectory/) make offline.

## Measure whether review is real

This is the part that turned a design into something we could defend. The
[run logs](/blog/logging-for-agents/) already had every approval, so we
started tracking:

- **Time to decision.** Not as a target to reduce. As a health check. If the
  median is a few seconds, nobody is reading.
- **Decline rate.** If it is zero, either the agent is perfect or the review
  is not happening. It is never the first one.
- **Declines by reason.** The notes on declined requests are the best
  feedback we get. Most of them point at a missing check or a tool that
  returned misleading data.
- **Post-hoc review of a sample.** Each week a senior analyst reviews a
  handful of approved actions in depth, as if they were the approver. When
  they would have declined something that was approved, that is a finding
  about the process, not about the person.

After the redesign, time to decision went up substantially, the decline rate
went from almost nothing to a small but real number, and the declines were
mostly for good reasons. That is what a working review looks like: slower,
and occasionally saying no.

## When the human should not be in the loop

The counterintuitive conclusion is that fewer approvals made the system
safer. A human in the loop is an expensive control that degrades with
volume, so it should be spent only where it buys something.

For actions where a wrong call is cheap and reversible, logging and
after-the-fact review is often better than a gate nobody reads. For actions
where a wrong call is expensive and hard to reverse, a gate is not enough on
its own, and the better answer is often that the agent cannot take that
action at all, which is the point [the agents post](/blog/agents-arent-always-the-answer/)
makes about blast radius.

The gate in the middle is for the actions that are worth a person's
attention. The job is making sure they actually get it.
