/**
 * Single source of truth for site identity. Edit here, not in components.
 */
export const SITE = {
  title: 'Frank Trout',
  /** Short role line, used on the About page and in link previews. */
  role: 'AI engineer on a security operations team',
  /** The home page headline. */
  tagline: 'Notes from building AI systems that have to work in production.',
  /** Phrase inside the tagline rendered in the accent colour. Must appear in tagline. */
  taglineEmphasis: 'work in production',
  /** The paragraph under the home page headline. */
  intro:
    'I build agentic systems for a security team: alert triage, incident response, phishing analysis, and the evaluation work that tells you whether any of it is getting better. This is where I write down what actually happened, including the parts that went wrong.',
  avatar: '/avatar.jpg', // path under public/. Set to '' to show initials instead.
  /** Used for search results and the RSS feed. */
  description:
    'Frank Trout on building AI agents for security operations: evals, deterministic workflows, and the engineering that keeps them honest in production.',
  /** One line in the footer. Deliberately different from the tagline. */
  footerNote: 'Written by a practitioner, for practitioners. Corrections welcome.',
  author: 'Frank Trout',
  url: 'https://ftrout.github.io',
  /** Fallback social preview image. Posts get their own, generated at build time. */
  ogImage: '/og/default.png',
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
  { href: '/blog/', label: 'Writing', match: ['/blog/'] },
  { href: '/topics/', label: 'Topics', match: ['/topics/', '/tags/', '/series/'] },
  { href: '/about/', label: 'About', match: ['/about/'] },
] as const;

/**
 * Descriptions for each series, keyed by the series name used in post
 * frontmatter. Shown on the series page and the Topics page.
 */
export const SERIES_INFO: Record<string, { description: string }> = {
  'Evals in Practice': {
    description:
      'Eight posts on measuring AI systems that make security decisions, from the cheapest code-graded checks to grading production traffic. Written in the order I would build them.',
  },
};
