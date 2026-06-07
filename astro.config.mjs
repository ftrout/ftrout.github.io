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
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
