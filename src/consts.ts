/**
 * Single source of truth for site identity. Edit here, not in components.
 */
export const SITE = {
  title: 'Frank Trout',
  role: 'AI engineer', // TODO: refine (shown above your name on the home page)
  tagline: 'Notes from building AI systems that have to work in production.', // TODO: refine
  /** Phrase inside the tagline rendered in the accent colour. Must appear in tagline. */
  taglineEmphasis: 'work in production',
  intro:
    'I design and ship retrieval systems, tool-calling agents, and the evaluation and operations work that keeps them honest. This site is where I write down what actually happened.', // TODO: refine
  avatar: '/avatar.jpg', // path under public/. Set to '' to show the monogram instead.
  description:
    'Frank Trout writes about building AI solutions: retrieval-augmented generation, agents, LLM evaluation, and the operational work that keeps them running.',
  author: 'Frank Trout',
  url: 'https://ftrout.github.io',
  ogImage: '/og-default.png',
  locale: 'en_US',
  postsOnHome: 5,
} as const;

/** Leave a value empty ('') to hide that link. */
export const SOCIALS: Record<'github' | 'linkedin' | 'x' | 'email', string> = {
  github: 'https://github.com/ftrout',
  linkedin: '', // TODO: e.g. https://www.linkedin.com/in/your-handle
  x: '', // TODO: e.g. https://x.com/your-handle
  email: '', // TODO: e.g. mailto:you@example.com
};

export const NAV = [
  { href: '/blog/', label: 'Blog' },
  { href: '/tags/', label: 'Tags' },
  { href: '/series/', label: 'Series' },
  { href: '/about/', label: 'About' },
] as const;
