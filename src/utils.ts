/**
 * Strip a leading `YYYY-MM-DD-` date prefix from a post id so the public URL
 * reads `/blog/my-post/` even when the source file is `2026-06-07-my-post.md`.
 */
export function getPostSlug(id: string): string {
	return id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}
