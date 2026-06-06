---
layout: post
title: "Building a multiplayer podcast editor with Automerge"
description: "What it's like to build a collaborative UI on top of a sync and versioning engine."
date: 2026-06-05 09:00:00
categories: ui ducking
tags: ui
draft: true
---

Nine years ago, I asked: [What are the important problems in UI engineering?](/js/ui/2017/04/21/important-problems-ui-engineering.html#data-synchronization) and real-time multiplayer data synchronization was the most important but hardest one, requiring expertise, corporate spending, and some design tradeoffs to get right.

**Today, you can just build multiplayer user interfaces for hobby projects, on top of tools that are one `npm install` away.** [Automerge](https://automerge.org/) is my favorite: an awesome piece of software for building data models that are local-first, multiplayer, and versioned.

In this post I'll talk about building a fairly complex and novel UI on top of it: what just works, what extra bits of effort were required, and my advice for getting started.

<figure>
  <img src="/making-of/assets/screenshot.png" alt="Screenshot of Ducking — waveform timeline, transcript pane, history panel, two cursors on different clips" />
  <figcaption>Screenshot of Ducking in use, with the comments and effects panels open.</figcaption>
</figure>

## Context

I spent the last few months building Ducking, a browser-based, multiplayer audio editor specifically tailored just for my partner's podcast.

[The previous blog post](/ui/ducking/2026/06/03/better-podcast-ui.html) described the unique UI design and audio layout model that makes it a much more pleasant way to put together an episode. But those improvements were just about making a single person more effective. 

**What we really wanted was a more collaborative workflow.** It's ridiculous that audio editing is stuck in a twenty-year-old world of single-player desktop apps and emailing files back and forth. We wanted to work together as easily as in Google Docs or Figma: one of us editing some clips, while the other fixed the transcript or tweaked the EQ settings. Plus we wanted modern collaboration tools: comments, history, and tracked changes so we could try out different ideas and merge them together or roll them back.

## Audio data

Before we can start with multiplayer editing, we need to actually have access to the raw audio. Blobs don't belong in Automerge and need their own handling. Ducking treats the raw audio as the immutable source of truth while processing and cacheing it into useful derived forms. 

We want to get access to this data quickly, so that a new collaborator can start listening to and editing a project within a few seconds after loading the page: faster than starting a desktop app, and much faster than downloading a file via email. But an hour-long podcast episode might rely on roughly a gigabyte of audio: four hours of high-quality studio recordings plus effects and background music.

So Ducking has to do a lot of work on first upload to get the audio available for fast retrieval. The audio service needs to:
- Backup the raw original so we can always revert back to it
- Transcribe any speech in the audio with timecodes so we can show it in the transcript view
- Generate waveforms for the audio, so we can show it visually even before the full audio has loaded.
- Slice it into short windows so that if an episode only uses 1m of a 40m recording, most clients only have to download one or two small slices.
- Transcode the slices into a compressed format so we can play a useful-but-lossy version right away, even as the higher-quality audio is downloading in the background.

The UI data layer needs to intelligently follow the user's intention and manage loading both faster versions of immediately-neeeded data and the full-quality versions of only the audio actually used in the project. Fortunately, the browser's IndexDB API is really useful for this kind multi-tiered cacheing and content-addressable storage we need, plus it automatically manages eviction, so the data stays around if you use it and disappears (but can be re-loaded by the client) if you don't. The browser runtime is really amazing these days.

With all that storage, processing, and local cacheing out of the way, the rest of the UI can assume fast random access to everything and focus on providing a great UI and editing workflow.

## Automerge documents

Everything other than the raw audio is stored in Automerge documents, largely centered on an individual "project", like a podcast episode.

_**Aside:** This post is an experience report, not a tutorial, so I highly recommend looking at the [homepage animation](https://automerge.org/), the [docs overview](https://automerge.org/docs/hello/), and at least [the first page of the tutorial](https://automerge.org/docs/tutorial/) to learn more about Automerge. From here on out, I'll assume you have a basic idea of what Automerge is for._

The core pattern of working with Automerge will be familiar to any React developer. You use a hook to fetch some data, render that plain data, and dispatch asynchronous actions to request changes to it, which eventually trigger the UI to re-render. The Automerge-provided actions transparently save the data locally, maintain history, broadcast to collaborators when network is available, receive updates from the network, and resolve conflicts if multiple changes happen in nondeterministic order.

Each Automerge action provides certain invariants and the system as a whole guarantees multiple collaborators will always end up with the same data, though if actions happened concurrently it may not always be the "correct" version by a human user's standards.

This makes it very important to carefully consider the data model, so that:
- most semantic user actions to correspond to atomic operations provided by Automerge
- multiple user actions with related intentions have natural automatic resolutions in terms of the invariants of the corresponding Automerge operations
- stored canonical data is clearly separated from calculated derived data

For many purposes, Automerge just does what you need: it can track changes to deeply-nested JSON objects, modifying properties, adding and removing array elements, etc. 

But it doesn't do _everything_ and its invariants don't magically match your desired semantics without careful design.

Let's look at two examples:
- One where proper data modeling means Automerge can just solve things for us
- One example where Automerge doesn't provide the guarantees we need, so we have to build application-layer logic to handle it.

### Better data modeling for safety

In Ducking's data model, a "clip" is a window that plays back part of an underlying, immutable audio source. The clip can be edited in three respects: it can change how it fits into the rest of the project (be reordered, added, deleted from the timeline), it can change the window of the underlying audio that is presented (changing its start and end time), and it can have effects that are applied to the underlying audio when the clip plays.

<figure>
  <div data-interactive="clip-anatomy"></div>
  <figcaption>The three layers of a clip — project position, parameters, source recording — share a single time axis. Press Play to watch the output waveform fill in: source amplitude × automation gain, sample by sample.</figcaption>
</figure>

A fairly basic operation is to change the volume at various times in the clip, in order to match desired levels, or to do minor edits like taking out a background noise or adjust for the speaker moving relative to the microphone. 

In the initial data model, the volume changes were stored on the clip, as a list of times and volume levels relative to the clip's start time. This works perfectly fine until you want to change the portion of the underlying audio that the clip plays. If you add an extra half-second at the front of the clip, the volume changes also move half a second up. But almost all the time, those volume changes are really tied to the underlying audio, not the time in the clip's playback itself. So the naive solution is, when adjusting the start of the clip, to add or substract time to all the volume changes. This works again, but only for single-player mode.

If two concurrent edits to the start time happen, and each one is a bundle of changes to both the clip's start time property and all the properties in the volume settings, there is no causal connection for Automerge to make sure it merges them together correctly.

The solution also isn't that hard: all of the parts of the clip data that deal with transforming the underlying audio should be saved in terms of the time of the raw clip. That way they don't need to be changed when the clip's start and duration change. And changes to the clip's window and the actual EQ settings are independent and mergable.

This isn't a particularly tricky case, but it's one I ran into a few times where the naive data model didn't work well and just needed a bit of backing up and remodeling to get it right.

### A missing operation: list re-order

A more complex example is maintaining the magnetic timeline, which is an ordered list of clips to be played. Automerge provides array operations for safely deleting and inserting items by index. But it doesn't provide a safe way to re-order existing items in the list.

There is a known solution: Martin Kleppman published [a paper on adding atomic list reorder operations](https://martin.kleppmann.com/papers/list-move-papoc20.pdf) and another, together with Liangrun Da, on ["Extending JSON CRDTs with Move Operations"](https://arxiv.org/abs/2311.14007). There is even a [draft PR](https://github.com/automerge/automerge/pull/706) to add it to Automerge, but without any activity in a while.

So we're going to have to build a list reorder ourselves. The naive version is to just issue two commands: one to delete the object from its current index and a second to add it back at the destination index. But if we do it that way, the invariants provided by the two operations don't actually combine to the invariant we want: that under lots of concurrent reorders, the object should exist exactly once in the list. Instead, the multiple delete and add commands might combine to result it in existing at multiple places in the list. (They can't, however, result in the item existing nowhere in the array, because multiple deletes of the same item collapse into one tombstone so they can't stack.)

So at our application layer we'll need to build our own list reoder operation. It will use Automerge delete and insert operations for the write side, but attach a new semantic id to the object. Then at read-time, it will scan the list for duplicates of that id and need to select exactly one to survive. Arbitrarily, we'll pick the first one and remove the others: this isn't any more "right" than any other option, but it ensures multiple readers will achieve the same resolution.





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

<link rel="stylesheet" href="/making-of/styles.css">
<script type="module" src="/making-of/lib/mount.js"></script>
