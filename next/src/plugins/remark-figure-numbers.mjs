/**
 * remark-figure-numbers
 *
 * Adds a `.figure-head` chrome with a "Figure N." label to raw HTML
 * `<figure>` blocks authored directly in markdown (the legacy Jekyll
 * convention for img/iframe-with-caption blocks).
 *
 *   In:
 *     <figure>
 *       <img src="…" alt="…">
 *       <figcaption>…</figcaption>
 *     </figure>
 *
 *   Out:
 *     <figure>
 *       <div class="figure-head"><span class="label">Figure 1.</span></div>
 *       <img src="…" alt="…">
 *       <figcaption>…</figcaption>
 *     </figure>
 *
 * Numbering is per-document, in document order, starting at 1. Figures
 * without an <img> or <iframe> are skipped (e.g. text-only `<figure>` used
 * for pull-quotes).
 *
 * Markdown-syntax images (![alt](src)) become bare <img> tags and are not
 * wrapped in <figure>; this plugin intentionally leaves them alone.
 */

import { visit } from 'unist-util-visit';

// Match a <figure ...> opening tag. We deliberately keep the regex loose
// (any attributes, any whitespace) and only act when we can both see the
// opening tag and detect <img or <iframe somewhere in the same html node.
const FIGURE_OPEN = /<figure\b[^>]*>/i;
const HEAD_ALREADY_PRESENT = /<div\s+class=["'][^"']*\bfigure-head\b/i;
const HAS_VISUAL = /<(img|iframe)\b/i;

export default function remarkFigureNumbers() {
  return (tree) => {
    let n = 0;

    visit(tree, 'html', (node) => {
      const value = node.value;
      if (!value || !FIGURE_OPEN.test(value)) return;
      if (!HAS_VISUAL.test(value)) return;
      if (HEAD_ALREADY_PRESENT.test(value)) return;

      // Inject one head per <figure> opener inside this html node. In
      // practice each raw <figure> block in markdown is a single html
      // node, but handle the multi-figure case defensively with a
      // global-flagged replace.
      node.value = value.replace(/<figure\b[^>]*>/gi, (match) => {
        n += 1;
        return `${match}\n  <div class="figure-head"><span class="label">Figure ${n}.</span></div>`;
      });
    });
  };
}
