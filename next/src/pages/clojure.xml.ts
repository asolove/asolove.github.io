/**
 * Category-filtered RSS feed at /clojure.xml — Clojure posts only. Same
 * conventions as ./atom.xml.ts: legacy http://-triple-slash <guid> for
 * subscriber identity, canonical https in <link>. Capped at 10 items to
 * match the Jekyll original.
 */

import rss from '@astrojs/rss';
import { postPath, sortByDate, getVisiblePosts } from '../lib/post-helpers';

const GUID_PREFIX = 'http://adamsolove.com//';
const ITEM_LIMIT = 10;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(context: { site?: URL }) {
  const all = await getVisiblePosts();
  const clojure = all.filter((p) => p.data.categories.includes('clojure'));
  const sorted = sortByDate(clojure).slice(0, ITEM_LIMIT);
  const site = context.site?.toString().replace(/\/$/, '') ?? 'https://adamsolove.com';

  return rss({
    title: 'Adam Solove - Clojure',
    description: "Posts categorized as 'Clojure'",
    site,
    items: sorted.map((post) => {
      const path = postPath(post);
      const guid = `${GUID_PREFIX}${path}`;
      const link = `${site}${path}`;
      return {
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data.description ?? '',
        customData: [
          `<link>${xmlEscape(link)}</link>`,
          `<guid isPermaLink="true">${xmlEscape(guid)}</guid>`,
        ].join(''),
      };
    }),
  });
}
