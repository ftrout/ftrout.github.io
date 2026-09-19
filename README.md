# Frank Trout

**Notes from building AI systems that have to work in production.**

Read it at **[ftrout.github.io](https://ftrout.github.io)** ·
[RSS](https://ftrout.github.io/rss.xml)

I build agentic systems for a security operations team: alert triage,
incident response, phishing analysis, and the evaluation work that tells you
whether any of it is actually getting better. This blog is where I write down
what happened, including the parts that went wrong.

The writing is for security practitioners and engineers deciding whether to
build something similar. It assumes you know what a SIEM is and does not
assume you know what an eval is.

## Start here

**[Evals in Practice](https://ftrout.github.io/series/evals-in-practice/)** is
an eight-part series on measuring AI systems that make security decisions.

1. [I Ignored Evals for a Year. Now I Can't Ship Without Them](https://ftrout.github.io/blog/evals-01-why-i-came-around/)
2. [Code-Graded Evals: The Cheapest Signal You Will Ever Get](https://ftrout.github.io/blog/evals-02-code-graded/)
3. [LLM-as-Judge Without Fooling Yourself](https://ftrout.github.io/blog/evals-03-llm-as-judge/)
4. [Retrieval Evals: Measure the Search Before You Judge the Answer](https://ftrout.github.io/blog/evals-04-retrieval/)
5. [Trajectory Evals: Grade the Path, Not Just the Destination](https://ftrout.github.io/blog/evals-05-trajectory/)
6. [Outcome Evals: Did the Agent Actually Finish the Job?](https://ftrout.github.io/blog/evals-06-outcome/)
7. [Adversarial Evals: When the Input Was Written by the Attacker](https://ftrout.github.io/blog/evals-07-adversarial/)
8. [Online Evals: Grading Production While It Runs](https://ftrout.github.io/blog/evals-08-online/)

**Also worth reading**

- [Agents Aren't Always the Answer](https://ftrout.github.io/blog/agents-arent-always-the-answer/),
  on when a deterministic workflow or a single model call beats an agent.
- [Can You Build an Agent With PowerShell?](https://ftrout.github.io/blog/can-you-build-an-agent-with-powershell/),
  an agent in about eighty lines, and the two bugs that cost me an afternoon.
- [How to Use Claude Skills, and What I Put in Sixteen of Them](https://ftrout.github.io/blog/claude-skills-for-security-work/),
  which pairs with the open-source
  [secops-claude-skills](https://github.com/ftrout/secops-claude-skills).

Everything else is on the [blog index](https://ftrout.github.io/blog/), or
browse by [tag](https://ftrout.github.io/tags/).

## Feedback

Spotted a mistake, or disagree with something? Open an
[issue](https://github.com/ftrout/ftrout.github.io/issues). Corrections are
welcome, and I would rather fix a wrong claim than leave it up.

To report a security problem with the site itself, see
[SECURITY.md](SECURITY.md) rather than opening a public issue.

---

<details>
<summary>How this site is built</summary>

A static site built with [Astro](https://astro.build), deployed to GitHub
Pages by GitHub Actions on every push to `main`.

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run check      # type-check .astro and .ts files
```

Posts are Markdown files in `src/content/blog/`, and the filename becomes the
URL. Site identity, navigation and social links live in `src/consts.ts`.

```yaml
---
title: "Post title"
description: "One or two sentences for lists, feeds and link previews."
pubDate: 2026-09-18
tags: [agents, security]      # lowercase, kebab-case
series: "Evals in Practice"   # optional; requires seriesOrder
seriesOrder: 1
draft: false                  # drafts render in dev only
---
```

</details>
