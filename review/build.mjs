#!/usr/bin/env node
/**
 * Build review/index.html — a side-by-side comparison harness for the
 * current Jekyll _site vs the Astro next/dist build.
 *
 * Usage:
 *   node review/build.mjs
 *
 * Then serve the repo root and visit /review/.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const OLD = join(REPO, '_site');
const NEW = join(REPO, 'next/dist');

// ─────────────────────────────────────────────────────────────────────────────
// Walk a directory for .html files, returning paths relative to that root.
function walkHtml(root, base = root) {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full, base));
    else if (entry.name.endsWith('.html')) out.push('/' + relative(base, full));
  }
  return out;
}

const oldUrls = new Set(walkHtml(OLD));
const newUrls = new Set(walkHtml(NEW));

// Skip the Medium-export dump and the sketchpad subtree.
const skip = (u) => u.startsWith('/medium-export') || u.startsWith('/sketchpad/');

const allUrls = [...new Set([...oldUrls, ...newUrls])].filter((u) => !skip(u)).sort();

// Classify each URL: in both, in old only, in new only.
const rows = allUrls.map((url) => {
  const inOld = oldUrls.has(url);
  const inNew = newUrls.has(url);
  // Parse a post-shaped URL: /cats/.../YYYY/MM/DD/slug.html
  const m = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\.html$/);
  const date = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  // Try to read the post title from one of the builds.
  let title = '';
  for (const root of [NEW, OLD]) {
    const fp = join(root, url);
    try {
      const html = readFileSync(fp, 'utf8');
      const t = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';
      title = t.replace(/\s*[—–|]\s*Adam Solove.*$/i, '').trim();
      if (title) break;
    } catch {}
  }
  return { url, date, title, inOld, inNew };
});

// Sort: posts by date desc, then non-post URLs alphabetically at the top.
rows.sort((a, b) => {
  if (!!a.date !== !!b.date) return a.date ? 1 : -1; // non-dated first
  if (a.date) return b.date.localeCompare(a.date); // newer first
  return a.url.localeCompare(b.url);
});

const counts = {
  total: rows.length,
  both: rows.filter((r) => r.inOld && r.inNew).length,
  onlyOld: rows.filter((r) => r.inOld && !r.inNew).length,
  onlyNew: rows.filter((r) => !r.inOld && r.inNew).length,
};

// ─────────────────────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Review: old Jekyll vs new Astro</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #fafafa;
    --ink: #1c1c1c;
    --ink-soft: #6b6b6b;
    --rule: #d6d6d6;
    --ok: #2a7a3a;
    --warn: #b85c00;
    --bad: #b8231a;
    --accent: #b8231a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, system-ui, sans-serif;
    background: var(--bg);
    color: var(--ink);
    line-height: 1.45;
  }
  header.controls {
    position: sticky;
    top: 0;
    z-index: 10;
    background: white;
    border-bottom: 1px solid var(--rule);
    padding: 0.8rem 1.2rem;
    display: flex;
    gap: 1.5rem;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.88rem;
  }
  header h1 {
    font-size: 1rem;
    margin: 0 1.5rem 0 0;
    font-weight: 600;
  }
  .stat { color: var(--ink-soft); }
  .stat strong { color: var(--ink); }
  .filters { display: flex; gap: 0.4rem; }
  .filters button {
    border: 1px solid var(--rule);
    background: white;
    padding: 0.3rem 0.7rem;
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    border-radius: 3px;
  }
  .filters button.active {
    background: var(--ink);
    color: white;
    border-color: var(--ink);
  }

  ul.rows { list-style: none; margin: 0; padding: 0; }
  li.row {
    border-bottom: 1px solid var(--rule);
    background: white;
  }
  li.row.hidden { display: none; }

  details summary {
    list-style: none;
    cursor: pointer;
    padding: 0.7rem 1.2rem;
    display: grid;
    grid-template-columns: auto auto 1fr auto auto;
    align-items: baseline;
    gap: 1rem;
    user-select: none;
  }
  details summary::-webkit-details-marker { display: none; }
  details[open] summary {
    background: #f0f0f0;
    border-bottom: 1px solid var(--rule);
  }
  .chev::before { content: "▶"; color: var(--ink-soft); font-size: 0.7em; }
  details[open] .chev::before { content: "▼"; }

  .date { font-family: ui-monospace, monospace; color: var(--ink-soft); font-size: 0.82rem; min-width: 6em; }
  .meta-title { font-weight: 500; }
  .url { font-family: ui-monospace, monospace; color: var(--ink-soft); font-size: 0.78rem; }
  .badges { display: flex; gap: 0.4rem; }
  .badge {
    font-family: ui-monospace, monospace;
    font-size: 0.7rem;
    padding: 0.1rem 0.5rem;
    border-radius: 2px;
    border: 1px solid;
  }
  .badge.both { color: var(--ok); border-color: var(--ok); }
  .badge.old { color: var(--warn); border-color: var(--warn); }
  .badge.new { color: var(--accent); border-color: var(--accent); }

  .status-pick { display: flex; gap: 0; }
  .status-pick button {
    border: 1px solid var(--rule);
    background: white;
    padding: 0.18rem 0.5rem;
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .status-pick button:first-child { border-radius: 3px 0 0 3px; }
  .status-pick button:last-child { border-radius: 0 3px 3px 0; border-left: none; }
  .status-pick button:not(:first-child):not(:last-child) { border-left: none; }
  .status-pick button.picked-ok { background: var(--ok); color: white; border-color: var(--ok); }
  .status-pick button.picked-todo { background: var(--warn); color: white; border-color: var(--warn); }
  .status-pick button.picked-bad { background: var(--bad); color: white; border-color: var(--bad); }

  .compare {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--rule);
    padding: 1px;
  }
  .pane {
    background: white;
    display: flex;
    flex-direction: column;
  }
  .pane h3 {
    margin: 0;
    padding: 0.4rem 0.8rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
    border-bottom: 1px solid var(--rule);
    background: #f7f7f7;
    display: flex;
    justify-content: space-between;
  }
  .pane h3 a { color: var(--ink-soft); text-decoration: none; }
  .pane h3 a:hover { color: var(--ink); }
  .pane iframe {
    width: 100%;
    height: 1400px;
    border: none;
    background: white;
  }
  .missing {
    height: 1400px;
    background: #f7f7f7;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-soft);
    font-style: italic;
  }
</style>
</head>
<body>

<header class="controls">
  <h1>Review harness</h1>
  <div class="stat"><strong>${counts.total}</strong> URLs · <strong>${counts.both}</strong> in both · <strong class="old-count">${counts.onlyOld}</strong> old only · <strong class="new-count">${counts.onlyNew}</strong> new only</div>
  <div class="stat" id="review-stat"><strong id="ok-count">0</strong> ok / <strong id="todo-count">0</strong> todo / <strong id="bad-count">0</strong> issues</div>
  <div class="filters">
    <button data-filter="all" class="active">All</button>
    <button data-filter="unreviewed">Unreviewed</button>
    <button data-filter="todo">Todo</button>
    <button data-filter="bad">Issues</button>
    <button data-filter="ok">Reviewed</button>
  </div>
</header>

<ul class="rows">
${rows
  .map((r) => {
    const oldLink = r.inOld
      ? `<a href="http://localhost:8001${r.url}" target="_blank">↗</a>`
      : '';
    const newLink = r.inNew
      ? `<a href="http://localhost:8002${r.url}" target="_blank">↗</a>`
      : '';
    const oldPane = r.inOld
      ? `<iframe loading="lazy" src="http://localhost:8001${r.url}"></iframe>`
      : `<div class="missing">Not in old build</div>`;
    const newPane = r.inNew
      ? `<iframe loading="lazy" src="http://localhost:8002${r.url}"></iframe>`
      : `<div class="missing">Not in new build</div>`;
    const badge = r.inOld && r.inNew
      ? `<span class="badge both">both</span>`
      : r.inOld
        ? `<span class="badge old">old only</span>`
        : `<span class="badge new">new only</span>`;
    return `
<li class="row" data-url="${r.url}">
  <details>
    <summary>
      <span class="chev"></span>
      <span class="date">${r.date || '—'}</span>
      <span>
        <span class="meta-title">${escapeHtml(r.title || '(no title)')}</span>
        <span class="url">${r.url}</span>
      </span>
      <div class="badges">${badge}</div>
      <div class="status-pick" data-status>
        <button data-set="ok" title="Reviewed, looks good">ok</button>
        <button data-set="todo" title="Needs work">todo</button>
        <button data-set="bad" title="Broken">issue</button>
      </div>
    </summary>
    <div class="compare">
      <div class="pane">
        <h3>Old (Jekyll) ${oldLink}</h3>
        ${oldPane}
      </div>
      <div class="pane">
        <h3>New (Astro) ${newLink}</h3>
        ${newPane}
      </div>
    </div>
  </details>
</li>`;
  })
  .join('\n')}
</ul>

<script>
  // Per-URL review status, persisted in localStorage.
  const STORAGE_KEY = 'review-status-v1';
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); refreshStats(); applyFilter(); }

  function refreshStats() {
    let ok = 0, todo = 0, bad = 0;
    for (const v of Object.values(state)) {
      if (v === 'ok') ok++;
      else if (v === 'todo') todo++;
      else if (v === 'bad') bad++;
    }
    document.getElementById('ok-count').textContent = ok;
    document.getElementById('todo-count').textContent = todo;
    document.getElementById('bad-count').textContent = bad;
  }

  function paintRow(row) {
    const url = row.dataset.url;
    const status = state[url];
    const pick = row.querySelector('[data-status]');
    for (const btn of pick.querySelectorAll('button')) {
      btn.classList.remove('picked-ok', 'picked-todo', 'picked-bad');
      if (btn.dataset.set === status) btn.classList.add('picked-' + status);
    }
  }

  let currentFilter = 'all';
  function applyFilter() {
    for (const row of document.querySelectorAll('li.row')) {
      const status = state[row.dataset.url];
      let show = true;
      if (currentFilter === 'unreviewed') show = !status;
      else if (currentFilter === 'todo') show = status === 'todo';
      else if (currentFilter === 'bad') show = status === 'bad';
      else if (currentFilter === 'ok') show = status === 'ok';
      row.classList.toggle('hidden', !show);
    }
  }

  // Wire up status buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const row = btn.closest('li.row');
    const url = row.dataset.url;
    const set = btn.dataset.set;
    if (state[url] === set) delete state[url]; else state[url] = set;
    paintRow(row);
    save();
  });

  // Wire up filter buttons
  for (const btn of document.querySelectorAll('.filters button')) {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filters button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilter();
    });
  }

  // Initial paint
  for (const row of document.querySelectorAll('li.row')) paintRow(row);
  refreshStats();
</script>

</body>
</html>
`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

writeFileSync(join(__dirname, 'index.html'), html);
console.log(`Wrote review/index.html — ${counts.total} URLs (${counts.both} in both, ${counts.onlyOld} old-only, ${counts.onlyNew} new-only)`);
