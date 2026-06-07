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

I spent the last few months building Ducking, a browser-based, multiplayer audio editor tailored for my partner's podcast.

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

The UI data layer needs to intelligently follow the user's intention and manage loading both faster versions of immediately-neeeded data and the full-quality versions of only the audio actually used in the project. Fortunately, the browser's IndexDB API is really useful for the multi-tiered cacheing and content-addressable storage we need, plus it automatically manages eviction, so the data stays around if you use it and disappears if you don't. It bears repeating that the browser runtime is really amazing these days.

With all that storage, processing, and local cacheing out of the way, the rest of the UI can assume fast random access to everything and focus on providing a great UI and editing workflow.

## Automerge documents

Everything other than the raw audio is stored in Automerge documents, largely centered on an individual "project", like a podcast episode.

_**Aside:** This post is an experience report, not a tutorial, so I highly recommend looking at the [homepage animation](https://automerge.org/), the [docs overview](https://automerge.org/docs/hello/), and at least [the first page of the tutorial](https://automerge.org/docs/tutorial/) to learn more about Automerge. From here on out, I'll assume you have a basic idea of what Automerge is for._

The core pattern of working with Automerge will be familiar to any React developer. You use a hook to fetch some data, render that plain data, and dispatch asynchronous actions to request changes to it, which eventually trigger the UI to re-render. The Automerge-provided actions transparently save the data locally, maintain history, broadcast to collaborators when network is available, receive updates from the network, and resolve conflicts if multiple changes happen in nondeterministic order.

<figure>
  <div data-interactive="automerge-cycle"></div>
  <figcaption>One action through the system. A local "trim" dispatches into the doc, which simultaneously persists, appends to history, and broadcasts. Then a peer's change arrives, merges, and the UI re-renders. Green = your changes, gold = theirs.</figcaption>
</figure>

Each Automerge action provides certain invariants and the system as a whole guarantees multiple collaborators will always end up with the same data, though if actions happened concurrently it may not always be the "correct" version by a human user's standards.

This makes it very important to carefully consider the data model, so that:
- most semantic user actions correspond to atomic operations provided by Automerge
- multiple user actions on related data have natural resolutions in terms of the invariants of the corresponding Automerge operations
- stored canonical data is clearly separated from calculated derived data

For simple purposes, Automerge just does what you need: it can track changes to deeply-nested JSON data where you want to modify object properties or add and remove array items.

But it Automerge doesn't handle _everything_ and its invariants don't always match your desired semantics without careful design. Let's look at two examples:
- A case where improving data modeling means Automerge can just solve our problem
- Another case where Automerge doesn't provide the guarantees we need, so we have to build application-layer logic to handle it.

### Data modeling for multiplayer

In Ducking's data model, a "clip" is a window that plays back part of an underlying, immutable audio source. It knows which chunk of audio to start with, can apply effects to the audio when it plays, and then holds an appropriate amount of space in the project timeline.

One basic effect is for the clip to scale the volume of the underlying audio over time, either to cross-fade it with other audio or to remove a brief unwanted noise in the recording.

<figure>
  <div data-interactive="clip-anatomy"></div>
  <figcaption>The three layers of a clip — project position, parameters, source recording — share a single time axis. Press Play to watch the output waveform fill in: source amplitude × automation gain, sample by sample.</figcaption>
</figure>

Initially, the clip stored a list of time-indexed volume levels, with the times being relative to the start of the clip. That strategy worked fine until the user changed the clip's window: if the clip's audio window is dragged to start half a second earlier in the recording, then all the volume changes also move half a second earlier. So I wrote some code to update the effect timestamps when the clip's start time changed. This worked fine in single-player mode, but broke in multiplayer.

If two concurrent edits to the start time happen, and each one is a bundle of changes to both the clip's start time property and all the timestamps in the volume automation, there is no causal connection for Automerge to make sure it merges them together reasonably. So it will do its thing and make sure all users get the _same_ end result, but it may be an unexpected jumble.

This is a typical example of where Automerge will run into problems: one semantic user action is trying to update lots of pieces of persisted data in an atomic way. 

The solution also isn't that hard: all of the parts of the clip data that deal with transforming the underlying audio should be saved in terms of the timeframe of the underlying audio clip. That way they don't need to be updated when the clip's start and duration change. As a result, changes to the clip's window and to its effects settings are independent and predictably mergeable.

This isn't a particularly tricky case, but it's a pattern I ran into a few times before adjusting to the idea that I would be doing a lot of data migrations. In a single-player UI, it often makes sense to leave a previous data model in place when adding new features and just do some extra calculations at write time to make it work. With multi-player UIs, it is far more common to migrate the data model to keep all the persisted data orthogonal. Often that means updating the shape of persisted data and adding new read-time derived data calculations to satisfy the existing contracts.

But the key is: you will need to migrate the shape of data models, no matter how careful you are at first. So if I were starting from scratch on an Automerge project, I'd bake in time to write a data migration early on, just to get used to the pattern and not be scared of the first big one.

### A missing operation: list re-order

Now we know that sometimes we'll have to massage our data model so that user actions naturally map to Automerge's operations. But what happens when Automerge just doesn't provide an operation we need?

Sometimes we have to write application-layer code to provide stronger invariants that Automerge gives us.

I ran into this case when implementing Ducking's magnetic timeline, which is an ordered list of clips to be played. While Automerge provides array operations for removing and inserting items by index, it doesn't provide an operation to atomically re-order existing items in the list.

There is a known solution: Martin Kleppman published [a paper on adding atomic list reorder operations](https://martin.kleppmann.com/papers/list-move-papoc20.pdf) and another, together with Liangrun Da, on ["Extending JSON CRDTs with Move Operations"](https://arxiv.org/abs/2311.14007). There is even a [draft PR](https://github.com/automerge/automerge/pull/706) to add it to Automerge, but it hasn't been merged yet.

The naive version of list reorder is to just delete the object from its current index and then add it back at the destination index. But the invariants provided by those two operations don't actually combine to the invariant I wanted: that under lots of concurrent reorders, the object should exist exactly once in the list. Instead, the multiple delete and add commands might combine to result in it existing at multiple places in the list. (They can't, however, result in the item existing nowhere in the array, because multiple deletes of the same item collapse into one tombstone.)

To provide that invariant at the application layer, I built my own list reorder operation. First, the clip gets a semantic id when it is inserted into the timeline. Then when a reorder happens, it triggers the delete and insert operations, as above. But at read time, the application scans for duplicates of the semantic id and arbitrarily picks that the first one will survive and others will be ignored. This ensures the object is only in the timeline once and that multiple readers always reach the same conclusion about the end state.

### History management and Undo/redo


- Need to undo local not non-local (diagram to show local/remove interleaving?)
- Batching edits and when to commit changes.

### Text and marks

One of Automerge's best features is rich text, the original use-case for multiplayer editing. I highly recommend reading the [Peritext paper](https://www.inkandswitch.com/peritext/), which has a bunch of animations to explain the challenges of both rich text and building multiplayer software in general.

My favorite part of Peritext is "marks", annotations that apply to ranges of text, even as the text itself is edited. Marks are most commonly used for text formatting like bold or italic. But you can also create your own types of marks specific to your application.

I used a custom mark type to track the timestamps of words in the transcript, while still allowing editors to edit the text if the automatic transcription got it wrong. Ducking saves the transcript into Automerge as a richtext object where each word has a mark with its timing information. If there is a small typo and an editor needs to fix just that word, the mark stays in place and all the timing information is retained. If the transcript is wrong and a whole sentence needs to get fixed, some of the intermediate marks get collapsed, but the marks at the beginning and end of the sentence are retained and so we have at least rough timing information.

I used another custom mark type to track regions in the transcript that were the subject of comments. Because a mark datum has to be a simple value (a number or string) and doesn't get multiplayer merged, the comment thread itself was stored elsewhere in the document and the mark just held a pointer id for it.

It's amazing to have a reliable platform on top of which to build application-layer features that can just assume that everything will work fine with arbitrary richtext and distributed editing.

Having Peritext and Automerge handle the richtext handling and distributed editing is amazing. Being able to build application-level behaviors on top of the mark primitive makes 

## FAQ

**Why is it a server and browser UI, not a local-first app?**

I _love_ local-first apps like Obsidian that work entirely without a server. And I also love when they offer _both_ a seamless premium experience _and_ a credible exit path to prevent lock-in and enshittification.

I started building this app with an option for a Tauri app with local file-system storage and optional-only server syncing. I built the UI in terms of a data interface that could be supplied by either a server or the local app, so that it could run either in the browswer against a server or as an app. That seemed like solid insurance that no VC would tempt me to use lock-in to make the app more profitable.

And then I decided this wasn't a SaaS, it was a thing I wanted to use with my partner and maybe a handful of other friends. So the incentive to mistreat it went away, the costs to run it forever went down, and I just settled in to 

Plus, once the ~3s browser startup time for joining a project got working, it was so cool that I didn't want anyone to have to waste their time downloading and installing a native app.

**Does Automerge scale and is it secure? Should I use it in my startup?**

I (joyfully!) don't know. That's not a _no_, it's just that I literally can't tell you.

When I started in the industry, multiplayer real-time editing without conflicts was magic. Tean years ago, there were known solutions for specific problems, but they required a funded team and expertise in several different disciplines to be worthwhile to build.

So for now, I'm just reveling that this stuff is available at small scales. I can download a dependency, build my UI in a mostly straightforward way, and have real-time collaboration with a handful of friends.

There is something amazing about what used to be industrial-grade magic now being freely and easily available to purpose-built tiny apps.

---


- **Patchwork** — Ink & Switch's [history-and-diffs-on-Automerge work](https://www.inkandswitch.com/patchwork/notebook/08/) is directly upstream of the history panel design.

## What's next

The data model opens doors I haven't walked through yet:

- **Branches.** A working copy that diverges from main and can be merged back. Useful when one of us wants to try a structural re-cut without disturbing the other's in-progress fine edits.
- **Better diffs.** Visual diffs that highlight structural changes (clip moved, clip retimed) over noise (gain nudged 0.3 dB). Possibly auto-flagging "exceptional" changes — the audio engineer adjusting EQ is routine; the audio engineer moving a clip is worth a second look.
- **Comments anchored to regions**, using Peritext-style marks so they survive edits to surrounding content.
- **A real file-sync layer** so collaborators don't need to manually share source recordings.

<link rel="stylesheet" href="/making-of/styles.css">
<script type="module" src="/making-of/lib/mount.js"></script>
