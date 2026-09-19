import type { APIRoute } from 'astro';
import { SITE } from '../../consts';
import { pngResponse, renderOg } from '../../utils/og';

export const GET: APIRoute = async () =>
  pngResponse(await renderOg({ title: SITE.tagline, kicker: 'Writing on AI in security operations' }));
