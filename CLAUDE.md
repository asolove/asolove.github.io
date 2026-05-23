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
