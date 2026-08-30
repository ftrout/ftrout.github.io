# Frank Trout's AI Blog

Source for **[ftrout.github.io](https://ftrout.github.io)** — notes on building AI tooling for a
security team: what breaks, what it costs, and what I would do differently.

After 25 years in IT, most of it in cybersecurity, I write up what I run into building this stuff.
These are notes on my own experience, not claims about how it ought to be done.

## What's here

Posts tend to cover the work that starts *after* the demo:

- **Agent loops and harnesses** — who writes the loop, and the failures that never raise
- **Tool use** — schemas that drift, results that come back wrong, calls that stop happening
- **Evaluation** — measuring a prompt or an agent with a number instead of a vibe
- **Context** — caching, clearing, compaction, and what "memory" actually turns out to be
- **Cost and bounds** — what a feature costs to run, and which caps are actually enforced

## Worked examples

Posts that involve code ship with a runnable example alongside them — a single file, no cloud
account required, no infrastructure to stand up.

## How the site is built

[Astro](https://astro.build) with Markdown/MDX content collections, statically generated and
deployed to GitHub Pages by [a GitHub Actions workflow](.github/workflows/deploy.yml) on every
push to `main`.

- **Type** — Inter for UI and body, Newsreader for headlines, self-hosted via `astro:assets`
- **Design** — token-driven: a fluid type scale, spacing rhythm, and layout widths each defined
  once in [`src/styles/global.css`](src/styles/global.css)
- **Code blocks** — Shiki highlighting with a click-to-copy button
- **Reading experience** — a left-aligned reading column, auto-generated table of contents on
  longer posts, reading-time estimates, and view transitions between the listing and the post
- **Feeds and SEO** — RSS, sitemap, canonical URLs, Open Graph, and JSON-LD `BlogPosting`

## Running it locally

Requires Node 22.12 or newer.

```sh
npm install
npm run dev      # http://localhost:4321
```

| Command           | Action                                    |
| :---------------- | :---------------------------------------- |
| `npm install`     | Install dependencies                      |
| `npm run dev`     | Start the dev server at `localhost:4321`  |
| `npm run build`   | Build the production site to `./dist/`    |
| `npm run preview` | Preview the production build locally      |

## Structure

```text
├── public/              # static assets served as-is
├── src/
│   ├── assets/          # images processed at build time
│   ├── components/      # header, footer, post card, meta
│   ├── content/blog/    # the posts
│   ├── layouts/         # the post layout
│   ├── pages/           # routes, including the RSS feed
│   └── styles/          # design tokens and base styles
└── astro.config.mjs
```

## Adding a post

Posts live in `src/content/blog/` as `YYYY-MM-DD-slug.md`. The date prefix
keeps the directory sorted; it's stripped from the public URL, so the file above is served at
`/blog/slug/`.

```yaml
---
title: 'The post title'
description: 'One sentence, used in listings and social cards.'
pubDate: '2026-08-29'
tags: ['agents', 'evaluation'] # optional
heroImage: '../../assets/example.jpg' # optional
updatedDate: '2026-09-02' # optional
---
```

`author` defaults to my name. The schema is enforced at build time in
[`src/content.config.ts`](src/content.config.ts), so a typo in frontmatter fails the build rather
than the page.

## Credit

Built from the [Astro blog starter](https://github.com/withastro/astro/tree/main/examples/blog),
whose theme is based on the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).
