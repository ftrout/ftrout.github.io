---
title: "Designing Tools a Security Agent Can Actually Use"
description: "The model only knows your tools through their names, descriptions and what they return. Narrow tools, bounded inputs, summaries instead of raw logs, and errors it can act on."
pubDate: 2026-09-03
tags: [agents, architecture]
draft: false
---

The first tool I gave the investigation agent was called `run_query`. It took
a string of SIEM query language and returned whatever came back. It was
maximally flexible, and it was the worst tool I have ever written.

The agent wrote queries with the wrong field names. It forgot time bounds and
pulled thirty days of authentication logs for a whole business unit. When a
query did work, it got back eleven thousand rows as text, which filled most of
its context window and pushed out the alert it was meant to be investigating.

Every one of those failures was a tool design problem. The model was doing
its best with an interface I would not have handed to a new analyst.

## The model only sees three things

When you give a model a tool, it knows exactly three things about it: the
name, the description, and the input schema. Then, after it calls the tool,
it sees what came back. It does not see your code, your backend, or the
wiki page explaining that the `src_ip` field is empty for VPN traffic.

Anthropic's [tool use documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
is blunt about which of those matters most: detailed descriptions are the
biggest single factor in how well tools get used. Their engineering post on
[writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
goes further into the same ground. My experience matches both. Almost every
improvement I made came from rewriting what the model could see.

## Narrow beats flexible

`run_query` became six tools, each shaped like a question an analyst asks:

- `get_user_signins(user, hours)`
- `get_process_tree(host, process_id)`
- `get_network_connections(host, hours, direction)`
- `lookup_asset(host)`
- `lookup_indicator(value)`
- `search_alerts(entity, days)`

Each one builds its own query internally, with the right field names and
sensible limits. The model chooses which question to ask. It no longer has to
know how to ask it in a query language it will get subtly wrong.

The cost is that the agent can only ask questions I anticipated. That is a
real limitation, and I accept it, for the same reason I accept that a new
analyst does not get write access to the SIEM configuration. When analysts
keep needing a question the tools cannot answer, that is the signal to add a
tool.

## Constrain the inputs

Every argument that can be an enum should be one. Every number should have a
range. The schema is enforced before your code runs, and it is also
documentation the model reads.

```python
{
    "name": "get_network_connections",
    "description": (
        "List network connections made by or to one host, summarised by "
        "remote address. Use this to check whether a host talked to an "
        "indicator, or to find unexpected outbound destinations. Returns the "
        "top destinations by connection count, not individual connections. "
        "For DNS lookups, use get_dns_queries instead."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "host": {
                "type": "string",
                "description": "Hostname as it appears in the asset inventory, e.g. WS-FIN-0142. Not an IP address."
            },
            "hours": {
                "type": "integer", "minimum": 1, "maximum": 72,
                "description": "Lookback window. Start with 24; widen only if nothing relevant is found."
            },
            "direction": {"type": "string", "enum": ["outbound", "inbound", "both"]}
        },
        "required": ["host", "hours", "direction"]
    }
}
```

A few details in there were each learned the hard way:

- **"Not an IP address."** Before that sentence, the agent regularly passed
  IPs to a tool keyed on hostnames and got nothing back.
- **"Start with 24; widen only if..."** Guidance on how to use the tool, not
  just what it does. It cut the thirty-day queries to nearly nothing.
- **"For DNS lookups, use get_dns_queries instead."** When two tools are
  close, say which is which in both descriptions. Otherwise the agent picks
  one at random and you find out in a transcript review.
- **`maximum: 72`.** The hard limit is in the schema, not the prose. The
  prose is advice. The schema is a rule.

## Return summaries, not raw data

This was the change that mattered most. A tool result goes straight into the
context window, and the context window is shared with everything else the
agent is trying to keep in mind.

The rule I use: **return what an analyst would write on a sticky note, and
say how much you left out.**

```python
def get_network_connections(host: str, hours: int, direction: str) -> str:
    rows = siem.connections(host=host, hours=hours, direction=direction)
    if not rows:
        return f"No {direction} connections for {host} in the last {hours}h."

    by_dest = Counter((r.remote_ip, r.remote_port) for r in rows)
    top = by_dest.most_common(15)
    lines = [f"{len(rows)} connections to {len(by_dest)} destinations "
             f"in the last {hours}h. Top {len(top)} by count:"]
    for (ip, port), n in top:
        rep = reputation_cache.get(ip, "unknown")
        lines.append(f"  {ip}:{port}  x{n}  reputation={rep}")
    if len(by_dest) > len(top):
        lines.append(f"  ...and {len(by_dest) - len(top)} more destinations "
                     f"with fewer connections.")
    return "\n".join(lines)
```

Two things matter in there. The aggregation means eleven thousand rows become
sixteen lines. And the last line tells the model the list is truncated, so it
does not conclude that the fifteen destinations are all there are. A result
that silently omits data invites confident wrong answers.

I also enrich inside the tool where it is cheap. Reputation for each
destination is looked up in the same call, because otherwise the agent makes
fifteen separate `lookup_indicator` calls, each one resending the whole
conversation.

## Errors are instructions

When a tool fails, the error message is the only thing the model has to work
with. "Error 400" is useless to it. A sentence that says what went wrong and
what to try instead is often enough for it to recover on the next turn.

The API has a field for this. A `tool_result` block can carry
`is_error: true`, which tells the model the call failed rather than returning
an odd result:

```python
{
    "type": "tool_result",
    "tool_use_id": block.id,
    "is_error": True,
    "content": (
        "Host 'WS-FIN-142' not found in the asset inventory. "
        "Hostnames are zero-padded to four digits: try 'WS-FIN-0142'. "
        "Use lookup_asset with a partial name to search."
    ),
}
```

I went through every exception path in every tool and wrote a message like
that. It is tedious, and it removed a whole class of runs where the agent
retried the same failing call four times before giving up.

## Keep side effects in their own tools

Read tools and write tools never share a function. There is no
`manage_host(action="isolate")` with a flag that decides whether it looks or
acts. Isolation is its own tool, with its own description saying it is
disruptive, and its own approval requirement enforced in the code.

That separation makes three things easier. You can give an agent only the
read tools for a task that should never act. You can grep your
[run logs](/blog/logging-for-agents/) for every call to a side-effecting tool.
And the [trajectory evals](/blog/evals-05-trajectory/) can assert "never
called isolate_host without first calling lookup_asset" as a rule about named
tools, rather than a rule about argument values buried in a generic one.

## How I test a tool now

Before a tool goes to the agent, I read its name and description cold, as if
I had never seen the backend, and ask whether I would know when to use it and
what to pass. Then I look at five real results and ask whether I could reach
a conclusion from them without scrolling.

If the answer to either is no, the model will struggle with it too. It just
will not tell you. It will use the tool badly, confidently, and you will find
out from a transcript.
