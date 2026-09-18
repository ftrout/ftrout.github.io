import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  // The filename (minus extension) becomes the entry id and the URL slug.
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/blog' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().max(200),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      series: z.string().optional(),
      seriesOrder: z.number().int().positive().optional(),
      draft: z.boolean().default(false),
      heroImage: z.string().optional(),
    })
    .refine((d) => !d.series || d.seriesOrder !== undefined, {
      error: 'seriesOrder is required when series is set',
      path: ['seriesOrder'],
    }),
});

export const collections = { blog };
