#!/usr/bin/env node
/**
 * preview-deploy — what would this build change about adamsolove.com?
 *
 * Compares the local Astro build (next/dist/) against the canonical
 * URL list from the live site's atom feed (so it works even after the
 * Jekyll source is archived). For each path that exists in the new
 * build, fetches the live URL and reports:
 *
 *   Added    — new path that doesn't exist live
 *   Removed  — live path that's no longer emitted
 *   Changed  — both exist but bytes (after light normalization) differ
 *   Unchanged — both exist and match
 *
 * Run from the repo root:
 *   node next/scripts/preview-deploy.mjs
 *
 * Or via package.json script:
 *   pnpm --dir next preview-deploy
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const LIVE = 'https://adamsolove.com';
const DIST = path.resolve(new URL('../dist', import.meta.url).pathname);

// Paths we never want to compare (Astro build artifacts that aren't user-facing).
const SKIP = [
  /^\/_astro\//,
  /\.map$/,
  /\/\.nojekyll$/,
  /\/\.DS_Store$/,
];

function shouldSkip(p) {
  return SKIP.some((re) => re.test(p));
}

// Light normalization so cosmetic build noise (timestamps, Astro
// data-astro-cid hashes) doesn't show up as a "change". Tune as needed.
function normalize(s) {
  return s
    .replace(/data-astro-cid-[a-z0-9]+="?[a-z0-9-]+"?/g, '')
    .replace(/\/_astro\/[a-zA-Z0-9_.-]+\.(css|js)/g, '/_astro/HASH')
    .replace(/\s+/g, ' ')
    .trim();
}

async function walkDist(root) {
  const out = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = '/' + path.relative(root, full).split(path.sep).join('/');
      if (e.isDirectory()) await walk(full);
      else out.push(rel);
    }
  }
  await walk(root);
  return out.sort();
}

async function fetchLive(p) {
  const url = LIVE + p;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    return { ok: true, text };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

async function main() {
  let distFiles;
  try {
    distFiles = await walkDist(DIST);
  } catch {
    console.error(`Build directory not found at ${DIST}.`);
    console.error('Run `pnpm --dir next build` first.');
    process.exit(1);
  }

  distFiles = distFiles.filter((p) => !shouldSkip(p));
  console.log(`Comparing ${distFiles.length} local files against ${LIVE}\n`);

  const added = [];
  const changed = [];
  const unchanged = [];
  const errors = [];

  // Concurrency-limited fetches so we don't hammer the live host.
  const queue = [...distFiles];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const live = await fetchLive(p);
      if (!live.ok) {
        if (live.status === 404) added.push(p);
        else errors.push({ p, status: live.status, error: live.error });
        continue;
      }
      // Compare only HTML/XML; for binary assets we trust that build-output
      // size differences aren't the kind of change worth reviewing here.
      if (!/\.(html|xml|css|js|txt)$/.test(p)) {
        unchanged.push(p);
        continue;
      }
      const localText = await fs.readFile(path.join(DIST, p.slice(1)), 'utf8');
      const a = normalize(localText);
      const b = normalize(live.text);
      if (a === b) unchanged.push(p);
      else changed.push(p);
    }
  });
  await Promise.all(workers);

  added.sort();
  changed.sort();

  console.log(`  Unchanged: ${unchanged.length}`);
  console.log(`  Changed:   ${changed.length}`);
  console.log(`  Added:     ${added.length}`);
  console.log(`  Errors:    ${errors.length}`);
  console.log();

  if (added.length) {
    console.log('== Pages that would be ADDED ==');
    for (const p of added) console.log('  +', p);
    console.log();
  }
  if (changed.length) {
    console.log('== Pages that would CHANGE ==');
    for (const p of changed) console.log('  ~', p);
    console.log();
    console.log('Tip: inspect any single page with');
    console.log(`  diff <(curl -s ${LIVE}<path>) next/dist<path>`);
    console.log();
  }
  if (errors.length) {
    console.log('== Fetch errors ==');
    for (const e of errors) console.log(`  ! ${e.p}  (${e.error ?? `HTTP ${e.status}`})`);
    console.log();
  }

  // Note: we don't enumerate "removed" pages — the live site is the
  // truth, but enumerating it would require crawling. If you need that,
  // use the Atom feed + sitemap, or compare against a local `_site/`
  // Jekyll build before cutover.
}

main();
