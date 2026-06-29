---
title: "Skills in the Microsoft Agent Framework: A Read-Through Before I Reach for One"
pubDate: 2026-06-09
description: "New to AI agents? A 'skill' is a reusable bundle of expertise you can hand an AI assistant. This is me reading the Microsoft Agent Framework docs carefully — figuring out what skills actually are, how they load only when needed, and the specific cases where I'd reach for one or deliberately not — explaining the jargon as I go."
author: "Frank Trout"
---

*A note for newcomers: the **Microsoft Agent Framework** is a toolkit for building **AI agents** — programs that wrap a large language model (the AI behind tools like ChatGPT) so it can take actions, not just chat. A **skill**, in this framework, is a reusable package of know-how you can hand an agent: instructions, reference docs, and optional code, all in one bundle. This post walks through what skills are and when to use them, and I'll explain each term as it comes up.*

I haven't built a skill in the Microsoft Agent Framework yet. What follows is me reading the documentation closely and reasoning about it the way I'd want someone to reason before adding a new abstraction — a new layer of machinery — to a system I have to operate. I've written before about [reaching for the cheapest layer that closes the gap](/blog/simplest-agent-that-could-possibly-work) — skills are a rung on that ladder, and the docs are unusually clear about when *not* to climb to it. That's a good sign.

So, what is a skill, what does it actually do while the agent is running, and when would I use one over the alternatives I already have?

## What a skill actually is

A **skill** is a portable package that bundles three things into one unit an agent can discover and load only when it needs them: **instructions** (how to approach a domain), **reference material** (policy docs, FAQs, templates), and optional **scripts** (small programs the agent can run). It follows an [open specification](https://agentskills.io/) — a shared, published standard — which means the same skill is meant to be reusable across agents, teams, and even other compatible products.

The motivating problem is one any security team will recognize. Take a "triage a suspected phishing email" capability — the work of deciding whether a reported email is a real attack. It's never just one function — it's a script that extracts indicators of compromise (the technical fingerprints of an attack, like suspicious URLs or file hashes), the SOC's (security operations center's) triage playbook, the rules for what counts as a confirmed phish, and a template for the incident write-up. So you copy-paste that bundle from agent to agent, and the copies drift out of sync — which in a security context means one of your agents is quietly triaging against last quarter's playbook. A skill is the answer to that drift: bundle it once, point any agent at it.

On disk, a skill is just a folder with a required `SKILL.md` file (a Markdown document — plain text with light formatting) and some conventional subfolders:

```
phishing-triage/
├── SKILL.md          # required — YAML frontmatter + markdown instructions
├── scripts/
│   └── extract_iocs.py        # pull URLs, domains, and hashes from a sample
├── references/
│   └── TRIAGE_PLAYBOOK.md     # the SOC runbook, loaded on demand
└── assets/
    └── incident-report.md     # report template
```

The `SKILL.md` frontmatter — the small block of settings at the top of the file — is where the magic of discovery lives. Two fields are required — `name` and `description` — and the description is doing real work:

```yaml
---
name: phishing-triage
description: Triage a suspected phishing email — extract indicators of compromise,
  score them against the SOC playbook, and draft an incident report. Use when
  asked to analyze a suspicious email, URL, attachment, or reported phish.
metadata:
  author: soc-team
  version: "1.3"
---
```

Notice that the description isn't marketing copy — it's the trigger. It tells the agent *when* this skill is relevant, which matters enormously once you understand how skills get loaded.

## How it works: progressive disclosure

This is the part that made skills click for me, and it's the reason they're more than "a folder of prompts" (a prompt being the text you feed the model).

The naive way to give an agent domain knowledge is to stuff everything into the **system prompt** — the standing instructions the model reads at the start of every request. Ten domains of expertise and you're carrying ~50,000 **tokens** of context on every single turn. (A token is a chunk of text, roughly a word or part of one — it's the unit you're billed by and the unit the model's reading limit is measured in. "Context" here means everything you hand the model to read on a given call.) Most of that is irrelevant to whatever the user just asked. That's expensive, and — as I've argued before — a model swamped with instructions it doesn't need right now follows the ones it does need *less* well.

Skills sidestep this with **progressive disclosure** — revealing detail in stages, only as far as the task requires:

1. **Advertise** (~100 tokens each) — only the skill *name and description* go into the system prompt at the start of a run. The agent knows the skill exists, nothing more.
2. **Load** (under ~5,000 tokens) — when a task matches a skill's domain, the agent calls a `load_skill` **tool** (a function the model can invoke to do something or fetch something) to pull in the full `SKILL.md` instructions.
3. **Read resources** — it calls `read_skill_resource` to fetch supplementary files only if it needs them.
4. **Run scripts** — it calls `run_skill_script` to execute the bundled code, again only when needed.

The payoff the docs quote: an agent with **10 skills pays roughly 1,000 tokens of overhead, not 50,000.** It only deepens its knowledge when the current task demands it.

The detail I appreciate is that this is built directly on the existing tool machinery — `load_skill`, `read_skill_resource`, and `run_skill_script` are just tool calls, the same mechanism the agent already uses for everything else. There's no separate system to learn. (And the framework is tidy about it: `read_skill_resource` is only offered to the agent if some skill actually has resources, `run_skill_script` only if some skill has scripts.)

## Wiring one up

Skills are delivered through a **context provider** — a component whose job is to feed extra material into the agent's context. The one for skills is called `SkillsProvider`, and you attach it to the agent. The simplest case is pointing it at a folder and letting it discover every subfolder with a `SKILL.md`. In the code below, that's all the first block does — find the skills and hand them to the agent:

```python
from pathlib import Path
from agent_framework import Agent, SkillsProvider
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential

# Discover every skill under the 'soc-skills' directory
skills_provider = SkillsProvider.from_paths(
    skill_paths=Path(__file__).parent / "soc-skills",
)

agent = Agent(
    client=FoundryChatClient(credential=AzureCliCredential()),
    instructions="You are a Tier-1 SOC analyst assistant.",
    context_providers=[skills_provider],   # <- skills plug in here
)
```

File-based skills are the default, but you don't have to ship a folder. You can define a skill **inline in code** — written directly in your program rather than stored as separate files — when its content is dynamic or you want it to live next to the app. The block below bakes an incident severity rubric (the scale for rating how bad an incident is) straight into the agent, so every classification cites the same standard:

```python
from textwrap import dedent
from agent_framework import InlineSkill, InlineSkillResource, SkillFrontmatter, SkillsProvider

severity_skill = InlineSkill(
    frontmatter=SkillFrontmatter(
        name="severity-rubric",
        description=(
            "Assign incident severity (SEV1–SEV4) using the SOC's triage rubric. "
            "Use when classifying or prioritizing a security alert."
        ),
    ),
    instructions=dedent("""\
        Read the rubric resource, map the alert to the lowest matching severity,
        and justify the call by quoting the matched criterion.
    """),
    resources=[
        InlineSkillResource(
            name="rubric",
            content=dedent("""\
                # Incident Severity Rubric
                - SEV1: confirmed breach, data exfiltration, or ransomware on production
                - SEV2: active intrusion contained to one host; credential compromise
                - SEV3: blocked exploit, malware quarantined, or a single phishing click
                - SEV4: policy violation or informational — no confirmed impact
            """),
        ),
    ],
)

skills_provider = SkillsProvider(severity_skill)
```

And there's a third flavor — **class-based skills** — where you write the skill as a code class (a standard way of packaging up related code) and mark its methods with special tags so the whole thing ships as a PyPI package (a shareable Python library). A consumer adds it with one `pip install` and a single line. That's the "distribute expertise across the org" story made concrete.

## The scripts part deserves a pause

Code-defined scripts — functions you register directly in your program — run **in-process**, meaning inside your own application: clean and contained. File-based scripts are different: you have to hand the framework a piece of code (a "script runner") that knows how to launch them, and the sample one in the docs just starts a separate operating-system process to run the script. The docs are blunt that it's **for demonstration only**, and that real production use needs sandboxing (running the code in a walled-off environment so it can't touch the rest of the system), resource limits, an allow-list of what's permitted to run, and audit logging (a record of what ran).

This is the line I'd underline for anyone evaluating skills: **a skill's instructions get injected into the agent's context, and its scripts execute code.** That makes a skill exactly as trustworthy as any third-party dependency — outside code you've pulled into your app — no more. The security guidance reads accordingly: review every `SKILL.md`, script, and resource before deploying; only pull skills from sources you trust (they warn about *typosquatted skill names* — malicious skills published under names that are near-misspellings of trusted ones, hoping you grab the wrong one — which tells you where this is heading); sandbox anything that executes; and log which skills loaded and which scripts ran.

There's a built-in seatbelt for the scariest part — you can gate all script execution behind human approval, so a person has to say yes before any code runs. Picture a `host-containment` skill whose script can cut a machine off from the network: exactly the kind of action you never want an autonomous agent (one acting on its own, without a human in the loop) firing on its own judgment. The `require_script_approval=True` setting below switches that safeguard on:

```python
skills_provider = SkillsProvider.from_paths(
    skill_paths=Path(__file__).parent / "soc-skills",
    require_script_approval=True,
)
```

With that on, the agent pauses and returns an approval request instead of running the script — so a human signs off before a host gets quarantined or an IP gets blocked. For any containment action, I can't imagine shipping without it.

## When I'd actually reach for a skill

Pulling the threads together, the docs converge on a clear shortlist. I'd use a skill when:

- I have a **cluster of related knowledge** — instructions *plus* reference docs *plus* maybe a script — that logically belongs together. The bundling is the point.
- **Multiple agents need the same expertise** and I want one source of truth instead of many drifting copies.
- I want to **distribute** a capability across teams or products as a self-contained package.
- I care about **context efficiency** — keeping down how much text I feed the model each turn. If I have enough domain knowledge that paying for all of it on every turn would be wasteful, progressive disclosure earns its keep.

The "verbs vs. expertise" framing in the docs is the cleanest test I found: **tools are verbs** (query the SIEM — the security monitoring system — block an IP, quarantine a host), **skills are expertise** (how we triage a phish, how we classify incident severity). An agent uses tools to *act* and skills to *know how to act*.

## When I'd deliberately not

This is where the docs earned my trust, because they argue against their own feature in the right places.

**Don't wrap a single tool in a skill.** A skill is an abstraction layer on top of tools. For one standalone function — `lookup_ip_reputation` — wrapping it in a skill is pure overhead with nothing bundled. If there's no cluster, there's no skill.

**Don't make a skill broad.** An `everything-about-security` skill that tries to span phishing, malware analysis, vulnerability management, and compliance will have instructions too long and unfocused — and it blows the context budget (the limited space you have to feed the model) the moment it loads. Keep each skill to one domain. (Too narrow is a failure mode too: split things so fine that you lose the bundling benefit and just have scattered fragments.)

**Don't bury progressive disclosure.** If your `SKILL.md` is 2,000 lines, the agent pays a heavy cost the instant it loads the skill — you've defeated the whole mechanism. Keep `SKILL.md` lean (the spec suggests under 500 lines) and push detail into separate resource files that get read only when needed.

**Don't skip the security review.** Covered above, but it belongs on the "avoid" list: an unreviewed skill is unreviewed third-party code with a direct line into your agent's context.

## Skill vs. workflow — the distinction I'll keep handy

The comparison I expect to actually use day-to-day isn't skill vs. tool, it's skill vs. [workflow](/blog/building-effective-agents-on-foundry) — a workflow being a fixed sequence of steps you lay out in advance. Both extend what an agent can do, but in opposite philosophies:

| | Skill | Workflow |
| --- | --- | --- |
| **Control** | The AI decides *how* to execute | You define *what* runs and in what order |
| **Best when** | You want adaptive, creative handling | You need predictable, repeatable steps |
| **Resilience** | One agent turn; failure means retry the whole thing | Checkpointing (saving progress at each step) lets you resume from the last good step |
| **Side effects** | Best for safe-to-repeat, low-risk work | Better when steps quarantine hosts, block IPs, page on-call |

The docs' rule of thumb is the keeper: **if you want the AI to figure out *how*, use a skill; if you need to guarantee *what* steps run and in what order, use a workflow.**

## My takeaway, before writing a line of it

Skills look like a genuinely well-designed answer to a real problem — the slow rot of copy-pasted domain knowledge — and the progressive-disclosure model means the abstraction pays for itself in context savings rather than costing you. But it's still an abstraction, and the docs are refreshingly honest that you should earn it: a cluster of related knowledge that more than one agent needs, not a fancy wrapper around a lone function.

The two things I'll carry into my first real skill: keep it narrow and bundled, and treat it like a dependency I'd never pull into my app without reading first. When I do build one, I'll come back and write up where the docs matched reality and where they didn't.
