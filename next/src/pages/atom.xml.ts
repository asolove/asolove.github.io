/**
 * RSS feed served at /atom.xml.
 *
 * Replicates the Jekyll feed at the project root atom.xml exactly enough that
 * existing subscribers don't re-fetch every post. In particular, each item's
 * <guid> matches the Jekyll output byte-for-byte:
 *
 *   http://adamsolove.com///<category-path>/YYYY/MM/DD/<slug>.html
 *
 * The triple slash is a quirk of the original template (site.url ended with
 * `/` and the template added another `/` before post.url, which itself starts
 * with `/`). It's preserved here because the GUID is the subscriber's identity
 * key for each entry.
 *
 * The Jekyll template emitted `http://` (not https) and used a limit of 10
 * posts. We intentionally:
 *   - keep the `http://` prefix in <guid> so the GUID matches
 *   - emit `https://` in <link> (and the channel) to match the new canonical
 *     site and avoid mixed-content for users who click through
 *   - emit ALL posts, not just the most recent 10, per the migration spec
 */

import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { postPath, sortByDate } from '../lib/post-helpers';

// Matches the Jekyll guid prefix exactly: site.url ("http://adamsolove.com/")
// + "/" from the template + post.url (which starts with "/"). Three slashes.
const GUID_PREFIX = 'http://adamsolove.com//';

/** XML-escape the five predefined entities for safe embedding in customData. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(context: { site?: URL }) {
  const posts = await getCollection('posts');
  const sorted = sortByDate(posts);
  const site = context.site?.toString().replace(/\/$/, '') ?? 'https://adamsolove.com';

  return rss({
    title: 'Adam Solove',
    description: 'Personal site',
    site,
    items: sorted.map((post) => {
      const path = postPath(post); // e.g. "/people/2024/05/24/half-a-seat-to-the-left.html"
      const guid = `${GUID_PREFIX}${path}`;
      const link = `${site}${path}`;
      return {
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data.description ?? '',
        // We bypass the auto-generated guid (which would be derived from `link`
        // and canonicalized) by omitting `link` from the item options and
        // emitting both <link> and <guid> ourselves via customData. This lets
        // us preserve the historical GUID format exactly.
        customData: [
          `<link>${xmlEscape(link)}</link>`,
          `<guid isPermaLink="true">${xmlEscape(guid)}</guid>`,
        ].join(''),
      };
    }),
  });
}
