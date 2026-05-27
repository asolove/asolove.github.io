/**
 * remark-figure-numbers
 *
 * Adds a `.figure-head` chrome with a "Figure N." anchor link to raw HTML
 * `<figure>` blocks authored directly in markdown (the legacy Jekyll
 * convention for img/iframe-with-caption blocks). Each figure gets an
 * `id="fig-N"` so the label can be deep-linked from elsewhere.
 *
 *   In:
 *     <figure>
 *       <img src="…" alt="…">
 *       <figcaption>…</figcaption>
 *     </figure>
 *
 *   Out:
 *     <figure id="fig-1">
 *       <div class="figure-head">
 *         <a class="figure-link" href="#fig-1">
 *           <span class="label">Figure 1.</span>
 *           <span class="link-mark" aria-hidden="true">#</span>
 *         </a>
 *       </div>
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
// Recognise <img>, <iframe>, AND <div data-interactive="…"> as visuals
// worth numbering. The interactive div is treated like any other figure
// payload so authored `<figure><div data-interactive>…</figure>` blocks
// pick up the same Figure N anchor as image figures.
const HAS_VISUAL = /<(img|iframe)\b|<div\s[^>]*\bdata-interactive\b/i;

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
      node.value = value.replace(/<figure\b([^>]*)>/gi, (match, attrs) => {
        n += 1;
        const id = `fig-${n}`;
        // Inject id="…" into the existing attributes, preserving any
        // class= or other attributes the author wrote.
        const newAttrs = / id=["']/i.test(attrs) ? attrs : ` id="${id}"${attrs}`;
        return `<figure${newAttrs}>\n  <div class="figure-head"><a class="figure-link" href="#${id}"><span class="label">Figure ${n}.</span><span class="link-mark" aria-hidden="true">#</span></a></div>`;
      });
    });
  };
}
