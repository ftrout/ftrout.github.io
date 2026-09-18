// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ftrout.github.io',
  integrations: [sitemap()],
  // HTML-aware whitespace handling (Astro 7 defaults to JSX rules, which
  // collapses the space between adjacent inline elements).
  compressHTML: true,
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: false,
    },
  },
});
