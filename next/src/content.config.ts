import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: './src/content/posts',
  }),
  schema: z.object({
    layout: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    // Jekyll posts use bare "YYYY-MM-DD HH:MM:SS" dates with no timezone.
    // JS would parse those as local time, but Jekyll/Ruby parses them as UTC.
    // Normalize to ISO+Z so the resulting Date represents the right instant,
    // then URL formatting converts to Pacific (see post-helpers).
    date: z.union([z.string(), z.date()]).transform((v) => {
      if (v instanceof Date) return v;
      const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(v);
      const normalized = v.replace(' ', 'T') + (hasTz ? '' : 'Z');
      return new Date(normalized);
    }),
    // Jekyll posts store categories as a space-separated string. These
    // drive URL slugs (`/cat1/cat2/year/month/day/slug.html`) and are
    // frozen for backward compatibility — do NOT use for navigation.
    categories: z
      .union([z.string(), z.array(z.string())])
      .transform((v) => (Array.isArray(v) ? v : v.split(/\s+/).filter(Boolean))),
    // Navigation taxonomy — decoupled from URL slugs. Use this for the
    // breadcrumb, blog/archive groupings, and the `/tags/<tag>` route.
    // Multiple tags per post are allowed; space-separated like categories.
    tags: z
      .union([z.string(), z.array(z.string())])
      .transform((v) => (Array.isArray(v) ? v : v.split(/\s+/).filter(Boolean)))
      .optional(),
    // Optional new fields for the redesign.
    companion: z
      .array(z.object({ label: z.string(), url: z.string() }))
      .optional(),
    related_to: z.string().optional(),
    // Opt out of the auto-dropcap on long-form posts when the first paragraph
    // is a parenthetical aside, a blockquote, or otherwise a bad target.
    dropcap: z.boolean().optional(),
  }),
});

export const collections = { posts };
