// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import smartypants from 'remark-smartypants';
import remarkSidenotes from './src/plugins/remark-sidenotes.mjs';
import remarkFigureNumbers from './src/plugins/remark-figure-numbers.mjs';

/**
 * remark plugin: normalize stray unicode whitespace inside heading text.
 *
 * Some legacy Jekyll posts contain non-breaking spaces (U+00A0) inside
 * heading lines (likely from copy-paste). github-slugger (used by Astro's
 * built-in rehype heading-id plugin) treats NBSP as punctuation and strips
 * it, producing broken slugs like "the-finisheddiagram" instead of
 * "the-finished-diagram". Visually, NBSP and a regular space render
 * identically in a heading, so we replace them with ASCII spaces in
 * heading text only.
 */
function remarkNormalizeHeadingWhitespace() {
  // U+00A0 NBSP, U+2007 figure space, U+202F narrow NBSP, U+2060 word joiner,
  // U+FEFF zero-width no-break space.
  const STRAY_WS = /[   ⁠﻿]/g;

  return (tree) => {
    visit(tree, 'heading', (node) => {
      walk(node);
    });
  };

  function walk(node) {
    if (!node) return;
    if (node.type === 'text' && typeof node.value === 'string') {
      node.value = node.value.replace(STRAY_WS, ' ');
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }

  function visit(node, type, fn) {
    if (!node) return;
    if (node.type === type) fn(node);
    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child, type, fn);
    }
  }
}

export default defineConfig({
  site: 'https://adamsolove.com',
  integrations: [mdx()],
  markdown: {
    // Normalize heading whitespace BEFORE smartypants/heading-id processing.
    remarkPlugins: [
      remarkNormalizeHeadingWhitespace,
      smartypants,
      remarkSidenotes,
      remarkFigureNumbers,
    ],
    shikiConfig: {
      theme: 'vitesse-light',
      wrap: false,
    },
  },
  build: {
    // Match Jekyll's behavior: emit /post-url.html, not /post-url/index.html
    format: 'file',
  },
  trailingSlash: 'never',
});
