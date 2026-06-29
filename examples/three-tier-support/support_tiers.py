"""
THREE TIERS OF "INTELLIGENCE" — same domain (customer support), escalating cost.

The whole point: each tier is strictly more powerful, slower, more expensive, and
LESS predictable than the one above it. Always start at the top. Only drop down a
tier when the tier above genuinely cannot do the job.

    Tier 1  Deterministic code / plain API   ~1ms     $0        100% predictable
    Tier 2  Single LLM call                  ~1s      ~$0.001   mostly predictable
    Tier 3  Agent (LLM + tools + loop)       ~10-60s  ~$0.05+   least predictable

Mental model: an LLM is a "fuzzy function" — use it only when the mapping from input
to output can't be written as rules. An agent is an LLM that ALSO decides its own
control flow — use it only when you can't write the sequence of steps in advance.
"""

import json
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env


# Pretend backend. In real life these hit a database / payment processor / etc.
def get_order(order_id: str) -> dict:
    fake_db = {"12345": {"status": "shipped", "eta": "2026-07-02", "total": 89.50}}
    return fake_db.get(order_id, {"status": "not_found"})

def issue_refund(order_id: str, amount: float) -> dict:
    return {"order_id": order_id, "refunded": amount, "ok": True}


# ============================================================================
# TIER 1 — PLAIN API CALL (no LLM at all)
# ============================================================================
# Input is STRUCTURED and the logic is a fixed rule. There is exactly one correct
# output for any input. An LLM here would only add latency, cost, and the chance of
# hallucinating an order status that doesn't exist.
#
# USE WHEN: you already have the structured inputs (IDs, enums, numbers) and the
#           transformation is expressible as code.
# DON'T REACH FOR AN LLM JUST BECAUSE the output is "text for a human" — a template
# is deterministic and free.

def order_status_lookup(order_id: str) -> str:
    order = get_order(order_id)
    if order["status"] == "not_found":
        return f"We couldn't find order {order_id}."
    return f"Order {order_id} is {order['status']}, arriving {order['eta']}."


# ============================================================================
# TIER 2 — SINGLE (RAW) LLM CALL
# ============================================================================
# One input -> one output, no decisions about WHAT TO DO NEXT. The task needs
# language understanding (free-text in) or generation (natural phrasing out), but
# the *shape* of the work is fixed: you know you'll make exactly one call.
#
# Two classic shapes:
#   (a) Understand fuzzy input  -> structured output  (classification/extraction)
#   (b) Structured input        -> fuzzy output        (drafting/summarizing)
#
# USE WHEN: rules can't capture the mapping, but the number of steps is known (= 1).
# DON'T USE AN AGENT HERE: there are no tools to pick and no loop. Adding an agent
# wrapper would just be a more expensive way to make the same one call.

def classify_message(text: str) -> str:
    """(a) fuzzy in -> structured out. No tools, no loop, no chain."""
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",   # cheap/fast model is plenty here
        max_tokens=10,
        system="Classify the support message. Reply with EXACTLY one of: "
               "ORDER_STATUS, REFUND_REQUEST, COMPLAINT, OTHER. No other text.",
        messages=[{"role": "user", "content": text}],
    )
    return resp.content[0].text.strip()

def draft_friendly_reply(facts: str) -> str:
    """(b) structured in -> fuzzy out. Still just one call."""
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        system="Rewrite these order facts as a warm, concise reply to a customer.",
        messages=[{"role": "user", "content": facts}],
    )
    return resp.content[0].text


# ============================================================================
# TIER 3 — AGENT (LLM in a loop with tools, choosing its own steps)
# ============================================================================
# Now the request is open-ended: "Customer 12345 says their order is late and they
# want their money back — sort it out." You CANNOT write the steps in advance:
# maybe it needs a lookup then a refund; maybe just a lookup; maybe an escalation.
# The model must decide which tool to call, read the result, then decide again,
# looping until done.
#
# USE WHEN: the sequence of actions is unknown at design time AND depends on
#           intermediate results AND requires real tools/side effects.
# THE TRAP: agents are non-deterministic and can loop, call the wrong tool, or take
# irreversible actions (like issue_refund!). Notice the cost: every loop iteration
# is a full LLM call. If you ever find you could have written the steps as a fixed
# sequence, you wanted a *workflow* (chained Tier-2 calls), not an agent.

TOOLS = [
    {
        "name": "get_order",
        "description": "Look up an order's status, ETA and total by order_id.",
        "input_schema": {
            "type": "object",
            "properties": {"order_id": {"type": "string"}},
            "required": ["order_id"],
        },
    },
    {
        "name": "issue_refund",
        "description": "Refund an amount to an order. IRREVERSIBLE side effect.",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string"},
                "amount": {"type": "number"},
            },
            "required": ["order_id", "amount"],
        },
    },
]

TOOL_IMPLS = {"get_order": get_order, "issue_refund": issue_refund}

def support_agent(user_request: str, max_turns: int = 6) -> str:
    messages = [{"role": "user", "content": user_request}]

    for _ in range(max_turns):  # ALWAYS bound the loop — agents can run away
        resp = client.messages.create(
            model="claude-opus-4-8",          # the hard decisions justify the strong model
            max_tokens=1024,
            system="You are a support agent. Use tools to resolve the request. "
                   "Only refund if the customer is clearly owed one.",
            tools=TOOLS,
            messages=messages,
        )

        # No tool requested -> the agent is done, return its text.
        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")

        # Otherwise run each requested tool and feed results back in.
        messages.append({"role": "assistant", "content": resp.content})
        tool_results = []
        for block in resp.content:
            if block.type == "tool_use":
                result = TOOL_IMPLS[block.name](**block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                })
        messages.append({"role": "user", "content": tool_results})

    return "Could not resolve within the step limit; escalating to a human."


# ============================================================================
# PUTTING IT TOGETHER: route to the CHEAPEST tier that can handle the request.
# ============================================================================
def handle(incoming_text: str, order_id: str | None = None) -> str:
    # If the request is already structured, skip the LLM entirely (Tier 1).
    if order_id:
        return order_status_lookup(order_id)

    # Otherwise spend ONE cheap call to understand intent (Tier 2)...
    intent = classify_message(incoming_text)

    # ...and only escalate to the agent for the genuinely open-ended case (Tier 3).
    if intent in ("REFUND_REQUEST", "COMPLAINT"):
        return support_agent(incoming_text)
    if intent == "ORDER_STATUS":
        return "Please share your order ID and I'll look it up."  # back to Tier 1
    return "Thanks for reaching out — a teammate will follow up."


if __name__ == "__main__":
    print(handle("", order_id="12345"))                       # Tier 1, no LLM
    print(handle("is my package coming or what"))             # Tier 2 classify
    print(handle("order 12345 is 2 weeks late, I want a refund"))  # Tier 3 agent
