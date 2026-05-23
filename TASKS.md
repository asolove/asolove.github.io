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

- [x] `CNAME` at `next/public/CNAME` so `dist/CNAME` ends up with `www.adamsolove.com`
- [x] `/404.html` — the Jekyll version is a one-line redirect to `/`; reproduced verbatim in `next/public/404.html`. A real designed 404 page can come later in Phase 3.
- [x] `/clojure.xml` — category-filtered RSS feed for posts in the `clojure` category. RSS 2.0 (not Atom) despite the filename. Migrate as `next/src/pages/clojure.xml.ts`
- [x] `/blog.html` — chronological list of all posts. Migrate as `next/src/pages/blog.astro`. (Note: the Jekyll source uses `<h3>` inside `<a>` and `<p>` wrapping `<h3>` — not valid HTML, redesign while migrating)
- [x] Sketchpad subsite (`/sketchpad/*`) — frozen as static HTML in `next/public/sketchpad/` (plus `next/public/css/sketchpad.css` for styling). Not linked from anywhere; reachable only by direct URL. Decision was to freeze rather than migrate or re-host.
- [x] Verify favicon resolves (`/img/favicon.png` — works via the `next/public/img` symlink to repo `img/`; `dist/img/favicon.png` builds correctly and `Base.astro` already includes the `<link rel="icon">`)
- [x] Confirm no other top-level files are needed (`_site/css/` is not needed — new site has its own CSS). Survey confirmed: only un-covered top-level entries in `_site/` are the `learning/` and `people/` directories, which contain post permalinks only (no category index pages); both are emitted by the post route.

## Phase 2 — Content fixes

From `next/TODO-content.md`:

- [x] Add `description:` frontmatter to 10 posts missing it (list lives in `next/TODO-content.md`)
- [x] Decide on auto-generated fallback (truncated first sentence with ellipsis) vs. requiring a hand-written description for all posts — decision: **require hand-written descriptions** for all posts going forward; no auto-fallback. Backfilled the 10 missing ones with hand-written one-liners.
- [ ] Verify all migrated post bodies render correctly — code blocks, images, sidenotes, figure numbers, smartquotes
- [ ] Verify legacy URLs still resolve — old Jekyll category-permalink format (`/js/ui/2017/04/19/preact-in-pictures.html` etc.)

## Phase 3 — Known design and content problems

When we get to this phase, Claude should run the review scaffold and prompt the user to type in problems as they are found. Claude should add each item to the list here, spin off a subagent to start working on it, and then continue prompting for more problems as we go.

- [x] Home page: numbered entries (`No. 01`, etc.) felt arbitrary. Removed the number column; entry bodies now sit flush with the section headings ("Thinking", "Work", "Projects").
- [ ] Topbar nav: `/notes` and `/work` are broken placeholder links. Decide whether to remove from nav or build stub pages. (Awaiting decision.)
- [x] Inline `<img>` followed by markdown on the next line is being treated as an HTML block by CommonMark, suppressing markdown parsing. Fixed `half-a-seat-to-the-left` and `iframeable-finance` lead paragraphs by joining the `<img>` onto the same line as the surrounding text so it stays inline within the paragraph.
- [x] `.right`, `.full`, and a new `.narrow` image class added to `post.css`. `.right`/`.narrow` float inside paragraphs; `.full` is block-level capped at body width. When these images sit as standalone grid items (blank lines around them), float is ignored and they fall back to a grid-column placement.
- [x] Kramdown `| ...` blockquotes converted to `> ...` in `learning-about-learning` (1), `important-problems-ui-engineering` (3), `speak-at-jsconf` (1), `preact-internals-1` (1), `concurrent-ml-branding-problem` (1). The `javascript-runtimes` post's `|` lines are real markdown tables and left alone.
- [x] Drop-cap on the first paragraph fires even when that paragraph is a parenthetical aside (the `*(This is a blog version…)*` lead in `the-new-fast`). Added a `dropcap: false` frontmatter opt-out and applied it to that post. Selector renamed `.body.longform → .body.has-dropcap`.
- [ ] Audit all post descriptions: replace any auto-truncated (ellipsis-ending) descriptions with hand-written one-liners. Identified three: `learning-about-learning`, `pure-ui-control`, `preact-internals-2`.
- [x] Pure UI Control: figure 1 (small calculator screenshot) was wrapped in `<figure>` with `<img class="full">`, getting promoted to full-bleed. Changed to `<figure class="margin">` so it hangs in the sidenote column at native width.
- [ ] Figure captions ("Fig. ...") are currently decorative text. Make them anchor links to the figure itself with a small visible affordance (link character) so readers can copy a deep link.

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
