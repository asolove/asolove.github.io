# Tasks: Jekyll → Astro migration

Single source of truth for migration progress. Read `CLAUDE.md` before working on this. Commit per checkbox.

## Phase 0 — Foundations (DONE)

- [x] Pick a design direction (chose `prototypes/manual.html` over `broadsheet.html` and `quarto.html`)
- [x] Scaffold Astro project under `next/`
- [x] Wire up content collection for posts (`next/src/content.config.ts`) with Jekyll-compatible frontmatter (date normalization, space-separated categories, optional `companion` / `description` fields)
- [x] Migrate all 23 post bodies into `next/src/content/posts/`
- [x] Port custom remark plugins: sidenotes (`remark-sidenotes.mjs`), figure numbers (`remark-figure-numbers.mjs`), heading-whitespace normalization (inline in `astro.config.mjs`)
- [x] Shiki code highlighting configured (github-light)
- [x] Base layout + post layout
- [x] Per-post route `[...slug].astro` rendering at Jekyll-compatible URLs (`format: 'file'`, `trailingSlash: 'never'`)
- [x] Atom feed at `/atom.xml` with byte-identical GUIDs to the Jekyll feed (preserves subscriber identity)
- [x] Home page (`pages/index.astro`) — first cut with hand-authored "Thinking / Work / Projects" sections
- [x] Build review harness (`review/build.mjs`) — diffs `_site/` against `next/dist/` and emits a per-URL side-by-side comparison page with localStorage-backed status tracking

## Phase 1 — Page coverage (the special cases)

Pages the old site has that the new site doesn't yet. Verified by running the review harness against existing `_site/` and `next/dist/` builds — only two URLs are "old only" (`/404.html`, `/blog.html`), plus the harness-skipped `/sketchpad/*` subtree, plus a few root-level files the harness doesn't index (CNAME, the Clojure RSS feed).

- [ ] `CNAME` at `next/public/CNAME` so `dist/CNAME` ends up with `www.adamsolove.com`
- [ ] `/404.html` — the Jekyll version is a one-line redirect to `/`; reproduce in `next/public/404.html` (or design a real 404 page, see Phase 3)
- [ ] `/clojure.xml` — category-filtered RSS feed for posts in the `clojure` category. RSS 2.0 (not Atom) despite the filename. Migrate as `next/src/pages/clojure.xml.ts`
- [ ] `/blog.html` — chronological list of all posts. Migrate as `next/src/pages/blog.astro`. (Note: the Jekyll source uses `<h3>` inside `<a>` and `<p>` wrapping `<h3>` — not valid HTML, redesign while migrating)
- [ ] Sketchpad subsite (`/sketchpad/*`) — currently skipped by the review harness. Has its own Jekyll layout (`sketchpad.css`, `_layouts/sketchpad.html`). Decide: migrate to Astro, leave on Jekyll forever, or freeze the current `_site/sketchpad/` as static HTML in `next/public/sketchpad/`
- [ ] Verify favicon resolves (`/img/favicon.png` — should work via the `next/public/img` symlink to repo `img/`, but confirm)
- [ ] Confirm no other top-level files are needed (`_site/css/` is not needed — new site has its own CSS)

## Phase 2 — Content fixes

From `next/TODO-content.md`:

- [ ] Add `description:` frontmatter to 10 posts missing it (list lives in `next/TODO-content.md`)
- [ ] Decide on auto-generated fallback (truncated first sentence with ellipsis) vs. requiring a hand-written description for all posts
- [ ] Verify all migrated post bodies render correctly — code blocks, images, sidenotes, figure numbers, smartquotes
- [ ] Verify legacy URLs still resolve — old Jekyll category-permalink format (`/js/ui/2017/04/19/preact-in-pictures.html` etc.)

## Phase 3 — Known design and content problems

When we get to this phase, Claude should run the review scaffold and prompt the user to type in problems as they are found. Claude should add each item to the list here, spin off a subagent to start working on it, and then continue prompting for more problems as we go.

## Phase 4 — Review pass

- [ ] Build both sites, open `review/index.html`, walk every URL marked `both`
- [ ] Mark each URL `ok` / `todo` / `issue` in the harness
- [ ] File a `TASKS.md` checkbox for each `todo` / `issue` that needs design or content work (don't rely on harness localStorage as a task list — it's only a review aid)
- [ ] Re-run after fixes until the unreviewed/todo/issue counts are zero

## Phase 5 — Cutover

- [ ] Decide hosting (GitHub Pages from `next/dist/`, Netlify, Cloudflare Pages, etc.)
- [ ] Wire up build + deploy (the current GH Pages flow builds Jekyll automatically; new flow needs to build Astro)
- [ ] Verify production URL parity one more time
- [ ] Switch DNS / Pages source
- [ ] Archive Jekyll source on a branch, remove from `master`, leave `_posts/` content in place until you're sure nothing references it
- [ ] Update `CLAUDE.md` to reflect that the Astro side is now live

## Off-ramp / not migrating

- [ ] Confirm `medium-export/` stays excluded (it's a one-time import dump, currently skipped by the review harness)
