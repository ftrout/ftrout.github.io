// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

/**
 * Dependency-free remark plugin that estimates reading time (~200 wpm)
 * and exposes it on `remarkPluginFrontmatter.minutesRead`.
 */
function remarkReadingTime() {
	/**
	 * @param {any} tree
	 * @param {any} file
	 */
	return (tree, file) => {
		let words = 0;
		/** @param {any} node */
		const walk = (node) => {
			if (typeof node.value === 'string') {
				words += node.value.split(/\s+/).filter(Boolean).length;
			}
			if (Array.isArray(node.children)) node.children.forEach(walk);
		};
		walk(tree);
		const minutes = Math.max(1, Math.round(words / 200));
		file.data.astro.frontmatter.minutesRead = `${minutes} min read`;
	};
}

// https://astro.build/config
export default defineConfig({
	site: 'https://ftrout.github.io',
	base: '/',
	// Prefetch linked pages on hover for instant navigation.
	prefetch: true,
	markdown: {
		remarkPlugins: [remarkReadingTime],
		shikiConfig: {
			// Light code theme to match the warm editorial look.
			theme: 'github-light',
			wrap: false,
		},
	},
	integrations: [mdx(), sitemap()],
	fonts: [
		// UI, navigation, meta, and body copy.
		{
			provider: fontProviders.google(),
			name: 'Inter',
			cssVariable: '--font-inter',
			weights: [400, 500, 600, 700],
			styles: ['normal'],
			subsets: ['latin'],
			display: 'swap',
			fallbacks: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
		},
		// Display face for headlines — the editorial half of the pairing.
		{
			provider: fontProviders.google(),
			name: 'Newsreader',
			cssVariable: '--font-newsreader',
			weights: [400, 500, 600],
			styles: ['normal', 'italic'],
			subsets: ['latin'],
			display: 'swap',
			fallbacks: ['ui-serif', 'Georgia', 'serif'],
		},
	],
});
