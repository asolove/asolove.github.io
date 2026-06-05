---
layout: post
title: "Building a multiplayer podcast editor with Automerge"
description: "What it's like to build a collaborative UI on top of a sync and versioning engine."
date: 2026-06-05 09:00:00
categories: ui ducking
tags: ui
draft: true
---

Ducking is an online, multiplayer podcast editor that I built just for my partner's podcast. [The previous blog post](/ui/ducking/2026/06/03/better-podcast-ui.html) discussed the UI design and audio layout model that makes it a much more pleasant way to put together an episode.  But those improvements were just about making a single person more effective.

**What we really wanted was a more collaborative workflow.** It's ridiculous that audio editing is stuck in a twenty-year-old world of single-player desktop apps and emailing files back and forth. We wanted to work together on audio easily as in Google Docs or Figma.

So what really makes Ducking unique is that it supports multiplayer audio editing. We can be working together, one person editing out small chunks, the other reorganizing or changing global EQ settings, and all the changes just sync together without fuss. Plus, we can comment on each other's work, understand and maybe roll back changes together, and never worry about losing our work.

The software is split into two pieces:
- managing the raw audio, which is immutable but also stored, transcoded, and cached in complicated ways to improve performance
- the data describing each project, which is mutable, multi-player, and handled via Automerge.

## Audio data

The first challenge with audio on the web is performance. We want a new collaborator to open up the project in their browser and be able to play or edit as soon as possible. But they might need a lot of data.

A one-hour podcast episode that exports as a 100mb compressed audio file might start life as four hours of high-quality studio recordings and twenty minutes of music, totaling several gigabytes of data. Most of that just never actually makes it to the final cut. Waiting for all that data is unacceptable for web performance.

By fetching just what we need as we need it, the UI can render immediately and audio can be playing within a few seconds. To make that happen, the software needs to do a lot of prep work whenever audio is added to the project:

- Backup the raw original so we can always revert back to that
- Transcribe any speech in the audio with timecodes so we can show it in the transcript view
- Slice it into short windows so if we only use 1m of a 40m recording, most clients only have to download that slice.
- Transcode it into a compressed format so we can play a useful-but-lossy version right away, even as the higher-quality audio is downloading in the background.

Then the UI client has a data layer that can read these bits out of the browser cache or prioritize which to fetch. The browser is now really great at this. Work on the same project several days in a row and several hundred mb of data will be cached and instantly readable locally. Don't visit for a week and it's all just wiped away and the data layer can transparently re-fetch it as needed.

The entire upload-time transcoding and client data layer are good examples of "schleps": fiddly work that is easy to specify but hard to set up, which I might otherwise have skipped until it was annoying, but which I enjoyed handing off to an LLM. I'll talk more about using LLMs to enjoy tackling schleps in the next post.

## Automerge document data

[Automerge](https://automerge.org/) is the open-source multiplayer data engine that makes it all possible. It makes sure that changes get saved locally, broadcast to collaborators when the network is available, and merged together the same on everyone's device. It also acts as a version control system, able to describe past changes and roll them back to get to a previous state. 

TODO: Automerge animation?

Aside: This post is an experience report, not a tutorial, so I highly recommend looking at the [homepage animation](https://automerge.org/), the [docs overview](https://automerge.org/docs/hello/), and [the tutorial] to learn more about Automerge. From here on out, I'll assume you have a basic idea of what Automerge is for.


### A missing operation: list re-order

Automerge provides array operations for safely adding and removing items by index and correctly handles resolving conflicts for concurrent edits. But it doesn't natively support reorderable lists. You can try to model the problem as removing the item at one index and adding it back at another. But the CRDT resolution doesn't guarantee that if two people make overlapping edits, you'll always end up with exactly one copy of each item. Instead, the item might be duplicated, appearing in two different indices in the array.

There is a known solution! Martin Kleppman published [a paper on adding atomic list reorder operations](https://martin.kleppmann.com/papers/list-move-papoc20.pdf) and another, together with Liangrun Da, on ["Extending JSON CRDTs with Move Operations"](https://arxiv.org/abs/2311.14007) and there is even a [draft PR](https://github.com/automerge/automerge/pull/706) to add it to Automerge, but without any activity in the past two years.

So we'll have to build it at the application layer for now, while keeping it nicely contained so we can swap it out for an Automerge built-in version when it becomes available.

Here's what we need to do: our code will handle reorder commands as an insert and a delete. We'll let Automerge distribute and commute those operations to others. And then when we read them back, we'll review the document and handle the weird cases that can occur, to maintain the invariant above.





Automerge
- Overview: work on document like it's local, but changes get sent and received from other editors. Automerge ensures everyone ends up with same state (diagram? refer to site?)
- Data modeling is key: Automerge gets to "same" state, but not necessarily a good one.
  - Model the data orthogonally so almost all changes are separate and just work together
  - Example: volume automation tied to recording time, not clip time
  - Lots of derived state from the core data model (diagram?)
- Undo/Redo handling: local v remote, batching, interaction with history, alternatives (takes, branches)
  - Diagram to show local/remote interleaving
  - Diagram of batching
- List move (from paper)
  - Diagram of algorithm, maybe code
- Text marks are great!
  - Diagram of using text marks for transcript alignment with text edits


## FAQ

**Why is it a server and browser UI, not a local-first app?**

I _love_ local-first apps like Obsidian that work entirely without a server. And I also love when they offer _both_ a seamless premium experience _and_ a credible exit path to prevent lock-in and enshittification.

I started building this app with an option for a Tauri app with local file-system storage and optional-only server syncing. I built the UI in terms of a data interface that could be supplied by either a server or the local app, so that it could run either in the browswer against a server or as an app. That seemed like solid insurance that no VC would tempt me to use lock-in to make the app more profitable.

And then I decided this wasn't a SaaS, it was a thing I wanted to use with my partner and maybe a handful of other friends. So the incentive to mistreat it went away, the costs to run it forever went down, and I just settled in to 

Plus, once the ~3s browser startup time for joining a project got working, it was so cool that I didn't want anyone to have to waste their time downloading and installing a native app.

**Does Automerge scale and is it secure? Should I use it in my startup?**

I (joyfully!) don't know. That's not a _no_, it's just that I literally can't tell you.

Fifteen years ago multiplayer real-time editing without conflicts was magic. Ten years ago, I was [writing about it as a major unsolved problem in UI engineering](http://localhost:4321/js/ui/2017/04/21/important-problems-ui-engineering.html). Even five years ago, there were known solutions, but they required a funded team and expertise in several different disciplines to be worthwhile to build.

So for now, I'm just reveling that this thing works at small scales. I can download a dependency, plug it in, and have real-time collaboration with me and a handful of friends. There is something amazing about what used to be indsutry-grade magic now being freely and easily available to purpose-built tiny apps.



# Old stuff from Claude to maybe use

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
