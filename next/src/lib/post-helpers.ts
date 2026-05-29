/**
 * Helpers for deriving post chrome (URL, breadcrumb, reading time) from
 * post entries without duplicating logic across pages.
 */

import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'posts'>;

/**
 * Single source of truth for "which posts are visible right now."
 * Drafts (`draft: true` frontmatter) are shown in dev, filtered out of
 * prod builds. Every page or feed that lists posts should use this
 * helper, not `getCollection('posts')` directly.
 */
export async function getVisiblePosts(): Promise<Post[]> {
  return await getCollection('posts', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
}

/** Parse YYYY-MM-DD-slug.md filename to get just the slug-tail. */
export function parseFilename(id: string) {
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  if (!m) throw new Error(`Post filename does not match expected pattern: ${id}`);
  const [, year, month, day, slug] = m;
  return { year, month, day, slug };
}

/**
 * Jekyll's permalink format `/:categories/:year/:month/:day/:slug.html` derives
 * the date from frontmatter (NOT filename) and formats in the build machine's
 * local timezone (historically Pacific). Frontmatter dates without explicit TZ
 * are interpreted as UTC.
 *
 * We replicate this exactly so existing URLs survive the migration.
 */
const URL_TZ = 'America/Los_Angeles';
const urlDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: URL_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function urlDateParts(d: Date): { year: string; month: string; day: string } {
  const parts = urlDateFmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Build the Jekyll-style permalink for a post. */
export function postPath(post: Post): string {
  const { slug } = parseFilename(post.id);
  const { year, month, day } = urlDateParts(post.data.date);
  const cats = post.data.categories.join('/');
  return `/${cats}/${year}/${month}/${day}/${slug}.html`;
}

/** Pretty labels for tag slugs. Drives the breadcrumb, archive sidebar,
 *  and category-listing-page titles. Add as new ones appear. */
const tagLabels: Record<string, string> = {
  ui: 'UI engineering',
  functional: 'Functional programming',
  types: 'Types',
  perf: 'Performance',
  clojurescript: 'ClojureScript',
  craft: 'Working & learning',
  humor: 'Humor',
};

export function tagLabel(slug: string): string {
  return tagLabels[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Backward-compat alias: pre-existing imports still resolve. */
export const categoryLabel = tagLabel;

/** Approximate reading time from word count (220 wpm). */
export function readingTime(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Sort posts by date descending (most recent first). */
export function sortByDate(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** Find the chronologically adjacent posts (prev = older, next = newer). */
export function adjacentPosts(all: Post[], current: Post): { prev?: Post; next?: Post } {
  const sorted = sortByDate(all);
  const i = sorted.findIndex((p) => p.id === current.id);
  if (i === -1) return {};
  return {
    prev: sorted[i + 1],
    next: sorted[i - 1],
  };
}
