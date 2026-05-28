# Working with Claude on this repo

This site is being migrated from Jekyll (repo root) to Astro (in `next/`). Work happens in fits and starts and is often interrupted (computer restarts, sessions end mid-task). These rules exist so a fresh session can pick up cleanly.

## Start of every session

1. Run `git status`. **If the tree isn't clean, stop and resolve before starting new work.** The previous session was interrupted; either finish the half-done task or `git stash` / revert it. Do not pile new work on top of partial work.
2. Read `TASKS.md`. It is the source of truth for what's done, in progress, and pending. The checkboxes plus git log together describe the project state — anything that isn't checked off and committed didn't happen.
3. Check for `IN_PROGRESS.md` at the repo root. If it exists, a previous session was mid-task and wrote a note about where it stopped. Resume from there or delete the file if the work has since been completed or abandoned.

## During work

- **One commit per checked box in `TASKS.md`.** When you complete a task, the commit that finishes it must also be the commit that checks the box. No uncommitted work between tasks. If a "task" turns out to need 5 commits, that's a sign it should be split into 5 boxes — edit `TASKS.md` to reflect the real shape of the work, then commit per box.
- **Never start a second task while the first is uncommitted.** If you discover you need to do B before you can finish A, either (a) commit A's partial progress under a clearly-scoped sub-box, or (b) stash A, do B, then return.
- **If you start a task you can't finish this session, write `IN_PROGRESS.md`** at the repo root before stopping. Include: which `TASKS.md` box, what's done, what's left, any non-obvious state (uncommitted files, running processes, mental context). This file is gitignored — it's a handoff note to the next session, not a commit.
- **Plain commit messages, no Claude footer.** Match the existing style in `git log` — short, lowercase-ish, descriptive. No "Co-Authored-By: Claude" footer; this is a personal site and the user prefers a clean log.

## Subagents and parallelism

- Each parallel subagent gets its own worktree (`Agent` with `isolation: "worktree"`) so their commits don't tangle. Don't run two subagents editing overlapping files in the same working tree.
- One subagent = one logical unit of work that ends in one commit (or a small, contiguous series). Don't hand a subagent a 10-item checklist — it'll get partway done, return, and you'll be back in the same incoherent-state problem.
- When a subagent finishes, verify its commits exist and the working tree is clean before launching the next one.

## Memory

- Save a `project` memory entry when you learn something about the migration's goals, constraints, or in-flight decisions that isn't obvious from reading the code (e.g., "we picked the `manual.html` prototype over `broadsheet.html` because…").
- Don't save memory entries that duplicate `TASKS.md`. Memory is for *why* and *context*; `TASKS.md` is for *what's done*.
- Existing memories live at `~/.claude/projects/-Users-asolove-src-asolove-github-io/memory/`. The index is `MEMORY.md` there.

## Conventions specific to this repo

- The Jekyll site is the live site (`adamsolove.com`). Don't break it. Changes to `_posts/`, `_layouts/`, `_config.yml`, `css/` etc. ship to production on push to `master`.
- The Astro rebuild lives in `next/`. It is not yet wired to a deploy. Iterate freely.
- Migrated post content lives in `next/src/content/posts/`. The originals in `_posts/` are the source of truth until cutover — if you fix a typo, fix it in both, or note in `TASKS.md` that the two have diverged.
- The review harness (`review/index.html`, built by `review/build.mjs`) is how we verify page-by-page parity. To use it: build both sites (`bundle exec jekyll build` for old, `pnpm --dir next build` for new), run `node review/build.mjs`, then serve the repo root and visit `/review/`. Needs two HTTP servers on 8001 (for `_site/`) and 8002 (for `next/dist/`) — see the iframe `src=` attributes in `review/build.mjs`.

## Local commands

Run from the repo root:

- **Dev server (HMR, what you'll use 95% of the time)**: `pnpm --dir next dev` — serves on `http://localhost:4321`. Plugin changes (`.mjs` files referenced from `astro.config.mjs`) don't hot-reload; restart the server for those.
- **Production build**: `pnpm --dir next build` — outputs to `next/dist/`. Run before `preview-deploy` or to inspect the actual artifact.
- **Preview the prod build locally**: `pnpm --dir next preview` — serves `next/dist/` on `http://localhost:4322`.
- **What would deploying right now change?**: `pnpm --dir next preview-deploy` — builds, then for each emitted page fetches the same path from adamsolove.com and reports `Added / Changed / Unchanged` with a list. (Doesn't enumerate `Removed` since that would require crawling the live site; for that, build Jekyll locally with `jekyll build` and diff `_site/` vs `next/dist/` directly.)

## Deploying to GitHub Pages

Auto-deploys via `.github/workflows/deploy.yml` on every push to `main`. The workflow builds Astro and uploads `next/dist/` as the Pages artifact; GitHub Pages publishes it. Repo Settings → Pages must have **Source: GitHub Actions** set (one-time, in the browser).

`next/public/.nojekyll` exists so GitHub Pages doesn't try to run Jekyll over the artifact (no-op since we're using Actions, but cheap insurance).

The Jekyll site source (`_posts/`, `_layouts/`, `_config.yml`, `Gemfile`, `_site/`) still lives on `main` for now — symlinks from `next/src/content/posts/*.md` to `_posts/*.markdown` mean editing the source files in `_posts/` is still the path of least resistance. Eventually we'll archive Jekyll onto a `jekyll-archive` branch and replace the symlinks with the real files.
