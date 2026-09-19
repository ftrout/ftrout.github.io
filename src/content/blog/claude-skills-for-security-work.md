---
title: "How to Use Claude Skills, and What I Put in Sixteen of Them"
description: "A skill is a folder with a markdown file that Claude loads only when it is relevant. Here is how they work, how I packaged a SOC’s workflows into them, and what I got wrong first."
pubDate: 2026-09-18
tags: [agents, skills]
draft: false
---

For months I kept pasting the same preamble into Claude. Pull the indicators
out of this advisory. Defang them. Drop the vendor's own domains and the
connectivity-check hosts every report includes. Give me a role and a
confidence for each one. Tell me what to block and what to retro-hunt.

It worked. It also came back slightly different every time, because I wrote
the preamble slightly differently every time, and the analyst next to me
wrote a different one entirely. We were both re-explaining our job to the
model on every request.

[Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
are the fix for that specific problem. I have now written sixteen of them for
security operations and put them on GitHub at
[secops-claude-skills](https://github.com/ftrout/secops-claude-skills). This
post is what I wish I had understood before I started.

## What a skill actually is

A skill is a folder with a `SKILL.md` file in it. The file has YAML
frontmatter and then markdown instructions. That is the whole format.

The part that matters is when the content loads. Claude's context window is
the working memory it has for a conversation, measured in tokens, roughly
word-pieces. Anything you put in it costs you, and a system prompt stuffed
with every procedure your team has is both expensive and less accurate,
because the relevant instruction is buried among forty irrelevant ones.

Skills load in stages, which Anthropic calls progressive disclosure. Per the
[platform documentation](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview):

| Stage | When it loads | Cost |
|---|---|---|
| `name` and `description` | Always, at startup | About 100 tokens per skill |
| The `SKILL.md` body | When the skill is triggered | Under 5k tokens |
| Bundled files and scripts | Only when read or run | Nothing until accessed |

That third row is the one that changes how you design. A skill can ship a
thirty-page field reference for Windows event IDs and cost nothing until the
one task that needs it. Better still, when Claude runs a bundled script, only
the script's output enters the context. The code itself never does.

In Claude Code, skills live in `~/.claude/skills/` for you personally or
`.claude/skills/` for a project, and Claude discovers them automatically. No
registration step, no API upload.

## The description is the whole ballgame

You do not call a skill by name. You describe your work, and Claude matches
it against the descriptions it loaded at startup. So the description is not
documentation. It is the trigger, and it is the only part of your skill that
is always in context.

My first drafts were the kind of thing you would write for a README:

```yaml
description: Extracts indicators of compromise from text.
```

That triggered almost never. Someone would paste a vendor advisory and ask
"what should we actually block from this," and the skill sat there, because
nothing in that sentence looks like "extract indicators of compromise from
text."

The version that works says what the skill does and, at length, when to
reach for it, in the words people actually use:

```yaml
---
name: ioc-extraction
description: Extract, normalize, defang/refang, classify, and de-duplicate
  indicators of compromise (IPs, domains, URLs, hashes, emails, file paths,
  registry keys, CVEs, wallet addresses) from any unstructured text such as
  threat intel reports, vendor advisories, phishing emails, pasted logs, PDFs,
  or chat messages... Use this whenever the user pastes or points at a report,
  advisory, email, or blob of text and wants the indicators out of it, asks to
  "pull the IOCs", "defang these", "make a blocklist", "turn this into a
  watchlist", "what should we block from this report", or needs indicators
  formatted for a SIEM, EDR, firewall, TIP, or STIX bundle.
---
```

It reads like keyword stuffing because it partly is. The quoted phrases are
things I have heard people say at a desk. The Agent Skills spec caps
`description` at 1024 characters and `name` at 64, so you have room for
roughly a paragraph, and you should use most of it. Anthropic's
[authoring guidance](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
makes the same point: the description has to carry both what and when.

A useful test: write down the last five ways someone asked you for this task
in Slack. If your description would not match any of them, it is too tidy.

## Put the deterministic parts in scripts

Models are good at judgment and mediocre at doing the same regex the same way
twice. Defanging is not a judgment call. Neither is deduplicating a list,
computing a severity score from a weights table, or formatting a timeline.

Every skill in the repo bundles small Python scripts for those parts. They use
the standard library only, read stdin or a file, write stdout, and never touch
the network:

```
skills/ioc-extraction/
├── SKILL.md            # workflow, output templates, pitfalls
├── scripts/            # extract_iocs.py, defang.py
├── references/         # loaded on demand; environment.md is yours to edit
└── examples/           # sample inputs, plus the manifest CI smoke-tests
```

The `SKILL.md` tells Claude to run the extractor rather than eyeball the text,
then to apply judgment to what comes back: drop the vendor's own domain, tag
each surviving indicator with a role and a confidence, note the shelf life,
because an attacker's VPS address rotates in days while a hash does not.

That division is the actual design principle. Script the mechanical step,
reserve the model for the part where being right depends on context. It also
makes the skill testable, which is not a thing you can say about a prompt.
`scripts/validate_skills.py` checks the structure of every skill and
`scripts/smoke_test.py` runs every bundled script against its examples, both in
CI on Linux and Windows across Python 3.10 and 3.13.

## Generic skills produce generic output

This is the part I underestimated. A skill that knows how triage works in
general will write you a triage note that is correct and useless, because it
does not know your severity scale, your escalation path, or which of the
fourteen things named `svc-backup` you actually own.

So each skill has a `references/environment.md` that is explicitly yours to
fill in: your SIEM and EDR, your severity tiers, host and account naming, who
gets woken up and at what threshold. It is about fifteen minutes per skill,
and it is the difference between output you read and output you paste into a
ticket. Score weights, allowlists, and field mappings live in small JSON files
next to the scripts for the same reason.

Only `SKILL.md` and `references/environment.md` are required. Everything else
exists where it earns its place.

## Installing them

Inside Claude Code, the repo is a plugin marketplace:

```
/plugin marketplace add ftrout/secops-claude-skills
/plugin install secops-skills@secops-claude-skills
```

Or copy the folders you want into `~/.claude/skills` or `.claude/skills`. You
need Claude Code and Python 3.10 or newer for the scripts. Nothing to pip
install.

## What I got wrong, and what is still awkward

**I wrote descriptions for humans first.** Covered above, and it cost me a
week of wondering why nothing triggered.

**I over-stuffed the first `SKILL.md` files.** One of them was 400 lines
because I kept adding edge cases. The body loads in full every time the skill
triggers, so that is a real cost on every invocation. Deep material belongs in
`references/`, which loads only when the task needs it.

**Skills do not sync across surfaces.** A skill in Claude Code is a file on
your disk. A skill on claude.ai is a zip you uploaded in settings. A skill on
the API is something you pushed to the Skills endpoint. Same format, three
places, no synchronization between them. The platform docs are explicit about
this and I still managed to be surprised by it.

**Installing a skill is closer to installing software than to writing a
prompt.** A skill is instructions plus executable code that runs with whatever
access Claude has. Anthropic's own guidance is to use skills only from sources
you trust and to audit every bundled file before you do. That applies to mine.
The repo is MIT and the scripts are standard-library Python precisely so that
reading them is a reasonable afternoon, and you should read them.

**Skills that read attacker-controlled content need a rule about it.** The
phishing skill reads emails written by someone who would very much like to
give the analyzer instructions. Every skill that touches that kind of input
says, in the file, to treat the content as data and never as instructions.
That is a mitigation, not a guarantee. Prompt injection, where hostile text in
the input tries to redirect the model, is not solved by asking nicely, which
is why none of the bundled scripts executes, renders, or fetches what it
parses, and why containment guidance is written for a human to run with an
approval step.

**The analytical content is reference material, not truth.** Event IDs get
renumbered, log field names drift, and every environment has its own baseline
of normal. CI covers the scripts. It cannot cover whether my description of
how Entra ID logs sign-ins still matches what Entra ID does this quarter.

## Where to start

Pick the task you explain most often. Write the description first, using the
phrasing people actually use when they ask you for it. Keep the body short and
push the depth into reference files. Script the parts that should never vary.
Then fill in the environment file, because the generic version is not worth
much.

If you want a starting point rather than a blank folder, the repo has sixteen
of them and a `templates/skill-template` to copy. Anthropic also publishes
[open-source skills](https://github.com/anthropics/skills), and the
[Claude Code documentation](https://code.claude.com/docs/en/skills) covers the
frontmatter fields I did not touch here, including tool permissions and
running a skill in an isolated subagent.

Where this does not fit: if the task is one you do twice a year, a skill is
overhead. Write a good prompt and move on. Skills pay off on the things you
explain over and over, which in a SOC is most of the job.
