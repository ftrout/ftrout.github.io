// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { warmDark, warmLight } from './shiki-themes.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://ftrout.github.io',
  integrations: [sitemap()],
  // Tags and series were consolidated into one Topics page.
  redirects: {
    '/tags': '/topics/',
    '/series': '/topics/',
  },
  // HTML-aware whitespace handling (Astro 7 defaults to JSX rules, which
  // collapses the space between adjacent inline elements).
  compressHTML: true,
  markdown: {
    shikiConfig: {
      themes: { light: warmLight, dark: warmDark },
      wrap: false,
    },
  },
});
