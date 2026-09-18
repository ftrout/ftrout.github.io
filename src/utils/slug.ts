/** Lowercase, kebab-case, URL-safe version of a tag or series name. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Tags pinned to a specific colour bucket so the ones used most stay
 * visually distinct. Anything not listed falls back to the hash below.
 * Buckets map to the .tag-c* classes in global.css.
 */
const PINNED_TAG_HUES: Record<string, number> = {
  skills: 0,
  rag: 1,
  'llm-evals': 2,
  retrieval: 3,
  testing: 4,
  security: 5,
  agents: 6,
  mlops: 7,
};

/**
 * Stable colour bucket for a tag, so a given tag keeps the same hue
 * everywhere it appears. Buckets map to the .tag-c* classes in global.css.
 */
export function tagHue(slug: string, buckets = 8): number {
  const pinned = PINNED_TAG_HUES[slug];
  if (pinned !== undefined) return pinned % buckets;

  let h = 0;
  for (let i = 0; i < slug.length; i += 1) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h % buckets;
}
