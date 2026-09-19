import type { APIRoute, GetStaticPaths } from 'astro';
import { getPosts, getSeriesNeighbors, type Post } from '../../utils/posts';
import { pngResponse, renderOg } from '../../utils/og';

export const getStaticPaths = (async () => {
  const posts = await getPosts();
  return posts.map((post) => {
    const s = getSeriesNeighbors(post, posts);
    return {
      params: { id: post.id },
      props: { post, kicker: s ? `${s.name} · Part ${s.index} of ${s.total}` : post.data.tags.join(' · ') || undefined },
    };
  });
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { post, kicker } = props as { post: Post; kicker?: string };
  return pngResponse(await renderOg({ title: post.data.title, kicker }));
};
