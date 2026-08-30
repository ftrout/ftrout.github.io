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
	/*
	  Anthropic's own sites use Styrene (sans), Tiempos Text (body serif),
	  Copernicus (display serif) and JetBrains Mono. The first three are
	  commercial licences; these are the closest freely available stand-ins,
	  arranged the same way — serif for reading, sans for chrome.
	*/
	fonts: [
		// Reading face: body copy and headlines. Stands in for Tiempos Text.
		{
			provider: fontProviders.google(),
			name: 'Literata',
			cssVariable: '--font-literata',
			weights: [400, 500, 600, 700],
			styles: ['normal', 'italic'],
			subsets: ['latin'],
			display: 'swap',
			fallbacks: ['ui-serif', 'Georgia', 'serif'],
		},
		// Chrome: navigation, footer, labels. Stands in for Styrene.
		{
			provider: fontProviders.google(),
			name: 'DM Sans',
			cssVariable: '--font-dm-sans',
			weights: [400, 500, 700],
			styles: ['normal'],
			subsets: ['latin'],
			display: 'swap',
			fallbacks: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
		},
		// Dates, eyebrows, code. The one face they use that is actually free.
		{
			provider: fontProviders.google(),
			name: 'JetBrains Mono',
			cssVariable: '--font-jetbrains-mono',
			weights: [400, 500],
			styles: ['normal'],
			subsets: ['latin'],
			display: 'swap',
			fallbacks: ['ui-monospace', 'Consolas', 'monospace'],
		},
	],
});
