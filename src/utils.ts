/**
 * Strip a leading `YYYY-MM-DD-` date prefix from a post id so the public URL
 * reads `/blog/my-post/` even when the source file is `2026-06-07-my-post.md`.
 */
export function getPostSlug(id: string): string {
	return id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

/**
 * Reading-time estimate (~200 wpm) from a post's raw markdown body. The remark
 * plugin computes the same figure for the post page itself; this variant works
 * from a `getCollection()` entry, so listings can show it without rendering.
 */
export function getReadingTime(body: string | undefined): string {
	const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
	return `${Math.max(1, Math.round(words / 200))} min read`;
}

/**
 * Shared view-transition name so a post title in a listing morphs into the
 * headline on the post page. Must match on both ends of the navigation.
 */
export function titleTransitionName(slug: string): string {
	return `post-title-${slug}`;
}
