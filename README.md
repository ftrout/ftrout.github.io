# ftrout.github.io

Personal blog by Frank Trout about building AI solutions: retrieval-augmented
generation, agents, LLM evaluation, and the operational work that makes them
hold up in production.

Built with [Astro](https://astro.build) and deployed to GitHub Pages through
GitHub Actions.

## Local development

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run preview    # serve dist/ locally
npm run check      # type-check .astro and .ts files
```

## Writing a post

Add a Markdown file to `src/content/blog/`. The filename becomes the URL slug
(`my-post.md` -> `/blog/my-post/`). Frontmatter:

```yaml
---
title: "Post title"
description: "One or two sentences shown in lists, feeds, and link previews."
pubDate: 2026-09-17
updatedDate: 2026-09-20      # optional
tags: [rag, llm-evals]        # lowercase, kebab-case
series: "Production RAG"      # optional; requires seriesOrder
seriesOrder: 1
draft: false                  # drafts show in dev, never in the build
heroImage: /images/hero.png   # optional, path under public/
---
```

Site identity (name, tagline, social links, navigation) lives in `src/consts.ts`.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site
and publishes it to GitHub Pages. The repository's Pages source must be set to
**GitHub Actions** (Settings -> Pages -> Build and deployment).
