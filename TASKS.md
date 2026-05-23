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

Pages the old site has that the new site doesn't yet, or has but wrong:

- [ ] Blog index / archive page (Jekyll has `/index.html` listing all posts? confirm — and any category index pages)
- [ ] Sketchpad subsite (`/sketchpad/*`) — currently skipped by the review harness; decide whether to migrate it, leave it on Jekyll, or freeze it as static HTML inside `next/public/`
- [ ] Clojure-only Atom feed (Jekyll has one — check `atom.xml` variants)
- [ ] 404 page
- [ ] Any redirects the Jekyll site relies on (check `_config.yml` and `_redirects` if any)
- [ ] Static assets: `/img/*`, `/css/main.css` references in post bodies, fonts, favicon — confirm they're served from `next/public/`
- [ ] `CNAME` file gets emitted to `next/dist/` for the eventual GitHub Pages cutover

> **Run the review harness** (`node review/build.mjs` after both builds) to populate this list with anything else that's "old only."

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
