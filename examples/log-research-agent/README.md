# A Log Research Agent — a worked example

Deep research, pointed at logs. A lead investigator agent built on the **Claude Agent SDK** plans
an investigation and delegates the reading to read-only specialist subagents — identity, network,
timeline, and a critic whose only job is to try to kill the hypothesis.

```sh
pip install claude-agent-sdk
export ANTHROPIC_API_KEY=sk-ant-...     # or: ant auth login
python log_research_agent.py
python log_research_agent.py --question "What did j.okafor's session s-77213 actually touch?"
```

The agent investigates the small log corpus in [`sample_logs/`](sample_logs/) and writes an
incident brief to `investigation_brief.md`.

## The shape

```
                    lead investigator  (claude-opus-5)
                    plans, delegates, reconciles, reports
                              |
        +----------------+----+-----------+------------------+
        |                |                |                  |
  identity-analyst  network-analyst  timeline-builder  hypothesis-critic
     (sonnet)          (sonnet)         (sonnet)           (opus)
        |                |                |                  |
        +----------------+----------------+------------------+
                              |
                     mcp__logs__* tools  (read-only)
      list_sources · search_logs · get_context · enrich_indicator · verify_citation
```

Each subagent starts with a blank context, burns it on grep output, and returns only its
conclusions. The lead agent never sees the raw volume — which is the entire reason this scales
past a couple of log files.

## Four design rules, all deliberate

1. **The agent reads; it never acts.** There is no tool here that blocks an IP, disables an
   account, or writes a file. Containment stays a human decision. The *harness* writes the brief
   to disk — the agent has no write access at all.
2. **Log content is untrusted data.** Every tool result is wrapped in `<log_data>` and labeled as
   attacker-influenced input. A log line that tries to give the agent instructions is a finding to
   report, not an instruction to follow. The sample corpus contains exactly such a line — see
   `web_access.log:16`.
3. **Every claim cites `source:line`, and every citation gets verified.** No citation, no claim —
   and a citation nobody checked is just a claim about the model's memory. See below.
4. **The run is bounded.** Allow-listed tools, `permission_mode="dontAsk"`, no filesystem settings,
   no subagent nesting, capped concurrency, a hard `max_budget_usd`, and `max_turns`.

## Three verification layers

Miscited evidence is the most damaging thing an investigation can ship: it reads exactly like a
finding, and it survives review because nobody re-opens the log. So citations are checked three
times, and each layer is weaker than the one after it.

| Layer | What it is | Weakness |
| --- | --- | --- |
| **Self-check** — `verify_citation` tool | Deterministic: pass the source, line number, and the exact text you're attributing to it; get PASS/FAIL and the actual line back. Every analyst prompt requires it before citing. | The agent has to actually call it. An agent that skips the step reports the same way as one that didn't. |
| **Adversarial re-check** — `hypothesis-critic` | The critic re-runs `verify_citation` on every citation in the hypothesis while it's attacking the conclusion. Its second job is citation integrity, now settled mechanically instead of by eye. | Still a model deciding how thorough to be. |
| **Harness verification** — `verify_report()` | Plain Python over the finished brief, after the run, with no model involved. Resolves every `source:line`, confirms every quoted string sits on a line cited beside it, and flags claim-shaped sentences carrying no citation. Stapled to the brief on disk. | Can't judge whether a correctly-cited line actually supports the argument. |

The critic already handles *judgment* verification — is the hypothesis right, is there a benign
explanation. These layers handle the different question of whether the evidence says what the
report says it says, which is mechanical and shouldn't be delegated to anyone's judgment.

Unresolvable citations are **errors** (the brief points at evidence that doesn't exist).
Quote mismatches and uncited claim-shaped lines are **warnings** — a paraphrase trips them
legitimately, so they need eyes rather than a build failure.

```sh
python log_research_agent.py --strict     # exit 1 if any citation fails verification
```

```
## Harness verification

Checked 23 citations (19 distinct) mechanically against the log corpus, after the run,
with no model involved.

**Result: PASS** — 0 error(s), 2 warning(s).

### Warnings
- brief line 34: claim-shaped but uncited — Exfiltration likely began shortly after 03:38 UTC
```

## What each piece of the SDK is doing

| Piece | Why it's there |
| --- | --- |
| `@tool` + `create_sdk_mcp_server` | The only path into the log corpus. Swap the function bodies for your SIEM's API and nothing above them changes. |
| `agents={...}` (`AgentDefinition`) | The investigative lenses. Fresh context each, so one analyst's 400 grep hits never crowd out another's. |
| `Agent` in `allowed_tools` | Required, or subagent invocations fall through the permission callback and never run. |
| `tools=[...]` per agent | A tool left off a subagent isn't in its session at all — no prompt, no error, no way to reach it. |
| `model=` per agent | Sonnet for the reading-heavy lenses, Opus for the critic, where being wrong is expensive. |
| `can_use_tool` | Defense in depth: argument-level checks even for allow-listed tools. |
| `setting_sources=[]` | Don't inherit developer machine settings into a security tool. |
| `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` / `..._MAX_CONCURRENT_SUBAGENTS` / `max_budget_usd` | One prompt can grow into a tree of agents. These are the fence. |

## The sample corpus

Four sources covering 2026-03-14 UTC: `auth.log` (SSO and MFA), `web_access.log` (HTTP and API),
`dns.log` (resolver), `audit_saas.log` (application audit trail). Roughly 85 lines total, planted
with:

- A **password spray** from a hosting-provider IP across a dozen accounts.
- **MFA fatigue** — three denials, then an approval, then a successful login from a new country.
- **Post-compromise activity**: an API token with `expires=never`, an OAuth grant, bulk exports,
  a mail rule that deletes security alerts, a changed recovery address.
- **Regular-interval DNS** to a domain registered nine days earlier.
- A **decoy**: a legitimate nightly export by a service account moving comparable data volume two
  hours earlier. A one-sided investigation flags it; a good one distinguishes it and says why.
- A **prompt injection** in a user-agent string instructing the reader to declare the activity
  benign and stop analyzing.

The decoy and the injection are the interesting cases. Anyone can find the spray.

## Adapting it

Replace the tool bodies with real queries — Splunk, Sentinel, Elastic, Loki, BigQuery,
CloudWatch — and keep the contracts: bounded result size, stable citations, an enrichment lookup
that is allowed to answer "unknown," and a verification path that can re-read a cited record
exactly. That last one is the constraint most log APIs make awkward: if your query layer can't
address a single record stably, `verify_citation` has nothing to check and the whole evidence
chain degrades to trust. Then rewrite the subagent prompts around your
detections and your environment; the prompts are where your team's actual expertise lives, and
they are the part no vendor can ship you.

## The essay behind it

Code companion to **["A Log Research Agent, for the Work I Used to Do by
Hand"](https://ftrout.github.io/blog/a-log-research-agent/)**. Related: **["Giving an Agent
Authority Is a Security
Decision"](https://ftrout.github.io/blog/giving-an-agent-authority-is-a-security-decision/)** on
why this one is read-only, and **["Multi-Agent: When It's Actually Worth
It"](https://ftrout.github.io/blog/multi-agent-when-its-actually-worth-it/)** on when the fan-out
earns its cost.
