/**
 * remark-sidenotes
 *
 * Converts standard GFM footnote syntax into the sidenote apparatus that
 * `src/styles/post.css` expects.
 *
 *   Input markdown:
 *     A claim that needs a citation[^1].
 *
 *     [^1]: Source goes here.
 *
 *   Output (conceptually, after rehype):
 *     <p>A claim that needs a citation<sup class="ref">[1]</sup>.</p>
 *     <aside class="sn"><span class="num">[1]</span> Source goes here.</aside>
 *
 * The aside is emitted as a *sibling* of the referencing paragraph (a direct
 * child of `<article class="body">`) so that the body's CSS subgrid with
 * `grid-auto-flow: row dense` flows the aside into cols 10–12 of the
 * paragraph's row.
 *
 * Numbering is per-document, in reference order. The default GFM footnotes
 * section at the bottom of the article is suppressed (definitions are
 * removed from the tree; mdast→hast then has nothing to emit).
 */

import { visit, SKIP } from 'unist-util-visit';

export default function remarkSidenotes() {
  return (tree) => {
    if (!tree || !Array.isArray(tree.children)) return;

    // 1. Collect footnote definitions (they live at root). Strip them so
    //    rehype doesn't render the default footnotes section.
    const defs = new Map(); // identifier -> definition node
    tree.children = tree.children.filter((child) => {
      if (child && child.type === 'footnoteDefinition') {
        defs.set(child.identifier, child);
        return false;
      }
      return true;
    });

    // 2. Walk the (definition-free) tree, numbering references in document
    //    order and recording which root-level block each reference belongs to.
    //    Per-block list of {id, num} so we can emit asides after that block.
    const blockAsides = new Map(); // index in tree.children -> array of {id, num}
    let counter = 0;
    const idToNum = new Map(); // identifier -> assigned number (re-use if cited twice)

    tree.children.forEach((block, blockIndex) => {
      visit(block, 'footnoteReference', (node, index, parent) => {
        if (!parent || index == null) return;
        const id = node.identifier;
        let num = idToNum.get(id);
        if (num == null) {
          counter += 1;
          num = counter;
          idToNum.set(id, num);
        }

        // Replace the reference with a raw HTML <sup> marker.
        const sup = {
          type: 'html',
          value: `<sup class="ref">[${num}]</sup>`,
        };
        parent.children.splice(index, 1, sup);

        // Record this aside against the top-level block. Only emit the
        // aside the *first* time we see a given id (matches print
        // convention: the note appears next to its first citation).
        if (defs.has(id)) {
          const list = blockAsides.get(blockIndex) ?? [];
          // De-dupe in case the same id is cited multiple times in the
          // same block; only the first citation triggers an aside.
          if (!list.some((entry) => entry.id === id)) {
            list.push({ id, num });
            blockAsides.set(blockIndex, list);
          }
        }

        return [SKIP, index + 1];
      });
    });

    if (blockAsides.size === 0) return;

    // 3. Re-build root children, inserting aside nodes after each block that
    //    cited a footnote. Iterate by index (descending) so insertions don't
    //    shift earlier indices — simpler than rebuilding a new array.
    const newChildren = [];
    tree.children.forEach((block, i) => {
      newChildren.push(block);
      const asides = blockAsides.get(i);
      if (!asides) return;
      for (const { id, num } of asides) {
        const def = defs.get(id);
        if (!def) continue;
        newChildren.push(buildAside(num, def));
      }
    });
    tree.children = newChildren;
  };
}

/**
 * Build an mdast node that renders as
 *   <aside class="sn"><span class="num">[N]</span> ...definition body...</aside>
 *
 * We construct a `paragraph` node (so its inline children are processed
 * normally by remark/rehype) but override its hast output via `data.hName`
 * / `data.hProperties` to emit an <aside> element instead of <p>.
 *
 * The definition's body in mdast is typically a list of block nodes (often a
 * single paragraph). We unwrap any leading paragraph's inline children so
 * the aside renders as a single line of prose; any additional blocks are
 * appended as-is (rare).
 */
function buildAside(num, def) {
  const inlineChildren = collectInline(def);

  const numSpan = {
    type: 'text',
    value: '', // placeholder; the real marker is injected via html node below
  };
  // Span marker: use a raw HTML node so the className lands without
  // re-implementing hName on a phrasing parent. The trailing space is
  // significant — keeps the marker visually separated from the body.
  const marker = {
    type: 'html',
    value: `<span class="num">[${num}]</span> `,
  };

  return {
    type: 'paragraph',
    data: {
      hName: 'aside',
      hProperties: { className: ['sn'] },
    },
    children: [marker, ...inlineChildren],
  };
}

/**
 * Pull inline children out of a footnoteDefinition. If the definition is a
 * single paragraph (the common case), return its children. Otherwise,
 * return the block children directly — rehype will handle them, and the
 * aside will contain block-level content (acceptable, just rarer styling).
 */
function collectInline(def) {
  if (!def || !Array.isArray(def.children) || def.children.length === 0) {
    return [];
  }
  if (def.children.length === 1 && def.children[0].type === 'paragraph') {
    return def.children[0].children ?? [];
  }
  // Multi-block definition: flatten paragraphs, keep other blocks intact.
  const out = [];
  for (const child of def.children) {
    if (child.type === 'paragraph') {
      out.push(...(child.children ?? []));
    } else {
      out.push(child);
    }
  }
  return out;
}
