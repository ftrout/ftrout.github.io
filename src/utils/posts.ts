import { getCollection, type CollectionEntry } from 'astro:content';
import { slugify } from './slug';

export type Post = CollectionEntry<'blog'>;

/** Published posts, newest first. Drafts are visible in `astro dev` only. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export interface TagInfo {
  name: string;
  slug: string;
  count: number;
}

/** Tags keyed by slug, sorted by count (desc) then name. */
export function getAllTags(posts: Post[]): TagInfo[] {
  const map = new Map<string, TagInfo>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const slug = slugify(tag);
      const existing = map.get(slug);
      if (existing) existing.count += 1;
      else map.set(slug, { name: tag, slug, count: 1 });
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

export function postsWithTag(posts: Post[], slug: string): Post[] {
  return posts.filter((p) => p.data.tags.some((t) => slugify(t) === slug));
}

export interface SeriesInfo {
  name: string;
  slug: string;
  /** Parts in reading order (by seriesOrder). */
  parts: Post[];
}

/** Series keyed by slug, sorted by name. */
export function getAllSeries(posts: Post[]): SeriesInfo[] {
  const map = new Map<string, SeriesInfo>();
  for (const post of posts) {
    if (!post.data.series) continue;
    const slug = slugify(post.data.series);
    const existing = map.get(slug);
    if (existing) existing.parts.push(post);
    else map.set(slug, { name: post.data.series, slug, parts: [post] });
  }
  for (const s of map.values()) s.parts.sort(bySeriesOrder);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface SeriesNeighbors extends SeriesInfo {
  /** 1-based position of the current post. */
  index: number;
  total: number;
  prev: Post | null;
  next: Post | null;
}

/** Position of `post` within its series, or null if it is standalone. */
export function getSeriesNeighbors(post: Post, all: Post[]): SeriesNeighbors | null {
  if (!post.data.series) return null;
  const parts = all
    .filter((p) => p.data.series === post.data.series)
    .sort(bySeriesOrder);
  const i = parts.findIndex((p) => p.id === post.id);
  return {
    name: post.data.series,
    slug: slugify(post.data.series),
    parts,
    index: i + 1,
    total: parts.length,
    prev: parts[i - 1] ?? null,
    next: parts[i + 1] ?? null,
  };
}

function bySeriesOrder(a: Post, b: Post): number {
  return (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0);
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}
