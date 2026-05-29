---
layout: post
title: "Building a multiplayer podcast editor with Automerge"
description: "."
date: 2026-06-03 09:00:00
categories: ui ducking
tags: ui
draft: true
---



## Building multiplayer software with Automerge

**A magnetic timeline is structurally identical to a text document.**

Clips are an ordered list. A clip's playback position is the sum of all preceding clips' durations — exactly the way a character's position in a string is the sum of preceding character widths. There is no `startTime` field; position is derived. Delete a clip and the rest close up, the way deleting a character does. Insert a clip and the rest shift right.

Once you see this, a lot of things stop being audio problems and start being text problems with different rendering:

- **Multiplayer collaboration** is whatever a multiplayer text editor does. The same CRDT that runs Google Docs runs the timeline.
- **History and revert** look like git for paragraphs of audio.
- **The transcript view and the waveform view** are the same document at different zoom levels.
- **Track changes** for audio becomes possible — and obvious — for the first time.

I didn't invent the magnetic timeline (Final Cut Pro X did, in 2011, and Hindenburg uses it for podcasts). I didn't invent the underlying data structures either; I'll credit them properly below. The contribution is noticing that these two worlds line up, pointing them at spoken-word audio, and seeing what falls out.

### Multiplayer

Because clips are an ordered list inside an Automerge document, two browser tabs editing the same project converge with no special handling. One person tweaks the EQ on clip 12 while the other deletes clip 4 and trims clip 17. Both edits apply. Positions recompute. Nobody steps on anybody.

(20–30 second video: two cursors on the same project, one trimming, one adjusting gain, both visible.)

The interesting cases are the failure modes. The classical sequence-CRDT problem — two users concurrently moving the same clip causes a duplication — applies here exactly as Kleppmann described it. Automerge doesn't ship a native list-move operation yet, so I wrote a small reconciliation layer on top: after each merge, scan for duplicate clip IDs and orphaned property edits, then collapse them. It's the algorithm from "Moving Elements in List CRDTs" implemented at the application layer. When Automerge ships move, this code can be deleted.

### Transcript as timeline

The transcript pane and the waveform pane are not two views of two data structures. They are two renderings of one ordered list. Clicking a word in the transcript seeks the playhead. Scrolling the transcript scrolls the waveform. Searching for "actually" highlights matches in both, including in the minimap.

(Screenshot: transcript pane with playhead, waveform synced, search highlights in both.)

A transcript-style editor like Descript already does click-to-seek, but it's a transcript that drives an audio pipeline underneath. Here the relationship is symmetric: there is one document, and the two surfaces are equally first-class. You can edit on either side and the other follows.

### History and revert

Because the document is a CRDT with a full change history, "what changed in the last hour" is a query, not a feature you have to engineer separately. The history panel groups recent changes into sessions, labels them by who did what (trims, gain changes, EQ tweaks, automation moves), and lets you revert any session — or any named checkpoint — without losing later work. The revert itself is just another change in the history; you can undo a revert.

(Screenshot: history panel with grouped sessions, two collaborators' edits color-coded, revert button.)

This is the part that most resembles version control for prose. It's also the part that wasn't possible before the underlying data model was right.

## Prior art (where the ideas come from)

Almost everything load-bearing in the data model was figured out by other people. The honest accounting:

- **Magnetic timelines** — Final Cut Pro X (2011); Hindenburg and others for podcasts. The interaction model is theirs.
- **List CRDTs and the move-operation problem** — Martin Kleppmann, "[Moving Elements in List CRDTs](https://martin.kleppmann.com/papers/list-move-papoc20.pdf)" (PaPoC 2020), and Da & Kleppmann, "[Extending JSON CRDTs with Move Operations](https://arxiv.org/pdf/2311.14007)" (2024). My reorder reconciliation is their algorithm at the application layer.
- **Fugue and non-interleaving** — Weidner & Kleppmann, "[The Art of the Fugue](https://arxiv.org/abs/2305.00583)" (2023). Not currently used (Automerge doesn't ship Fugue) but relevant to anyone considering the same architecture.
- **Automerge** — the CRDT runtime, with Peritext-style marks, columnar storage, and the React hooks I built against.
- **Patchwork** — Ink & Switch's [history-and-diffs-on-Automerge work](https://www.inkandswitch.com/patchwork/notebook/08/) is directly upstream of the history panel design.
- **Peritext** — Ink & Switch's [rich-text CRDT with marks](https://www.inkandswitch.com/peritext/), which is the right model for any annotation layer (comments, regions, color-coding) on top of the timeline.

What's new, as far as I can tell after looking: nobody had pointed these primitives at spoken-word audio editing and asked what the workflow looks like when you do.

## What it felt like to build

I built this mostly with Claude as a pair, on a Daylight Computer, on a porch, ssh'd into a Hetzner box. A few notes from six months of that.

**A sixth sense for tokens.** Programmers who work this way develop a felt sense for how many agents are running, how close they are to the daily limit, how warm the cache is. It pulls you toward typing more prompts to avoid wasting capacity you've already paid for. McLuhan's "the medium is the message" lands hard here: the tool changes the rhythm of the work before it changes the work itself.

**"LLMs turn every IC into an EM."** Partly true — you do more decisions, more delegation, more reviewing things you didn't write. But the bigger shift is attention. You spend the day context-switching across half-finished threads, providing input on decisions whose details you only half-understand. That's not seniority. It's a new kind of fatigue.

**Set guardrails first.** Performance budget, accessibility audit, dependency review, and lint rules went in before the first feature. A senior human engineer might keep these in their head; Claude won't. The guardrails are not enough on their own — a11y in particular can't be proven by static analysis — but the things they do catch, they catch every time.

**Watch for surprising failure modes.** I expected to audit dependencies periodically. I did not expect Claude to deliberately pin packages to versions with known CVEs (following stale training data, probably). I added a step for manually reviewing any pinned second-order dependencies. Glad to have learned this in private.

**The vendor question is real.** Started on Claude 4. Got better with 4.5 and 4.6 — not just code quality, but its judgment about whether a prompt was over-, under-, or properly constrained. Also went from comfortably under the $20/mo plan to bumping the $100/mo plan in eight months. If I were running a business, I would not bet on the price/capability curve staying where it is. The hedge most people suggest — local open-source models for authoring, frontier models for planning and review — is worth exploring.

**Sketching beats prototyping.** A surprising amount of the work was hand-drawn or text-described before any code. Sketching is what you do when you're trying to learn something; prototyping is what you do when you already know. Mixing them up wastes a lot of model tokens.

## What's next

The data model opens doors I haven't walked through yet:

- **Branches.** A working copy that diverges from main and can be merged back. Useful when one of us wants to try a structural re-cut without disturbing the other's in-progress fine edits.
- **Better diffs.** Visual diffs that highlight structural changes (clip moved, clip retimed) over noise (gain nudged 0.3 dB). Possibly auto-flagging "exceptional" changes — the audio engineer adjusting EQ is routine; the audio engineer moving a clip is worth a second look.
- **Comments anchored to regions**, using Peritext-style marks so they survive edits to surrounding content.
- **A real file-sync layer** so collaborators don't need to manually share source recordings.
