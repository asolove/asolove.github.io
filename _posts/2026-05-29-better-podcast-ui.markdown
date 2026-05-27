---
layout: post
title: "A better UI for podcast editing, plus multiplayer on Automerge"
description: "I propose a better UI model for editing podcasts, talk about building multiplayer experiences with Automerge, and bask in the fun of using Claude to build narrowcast software that only two people need to love."
date: 2026-05-29 09:00:00
categories: js ui
---

For the past few years, my partner has run a niche podcast and I've helped a bit with the audio quality. Our workflow was painful: one shared iCloud file, emails of notes coded to timestamps, carefully checking that our changes didn't conflict.

> Editing audio was like traveling back in time twenty years: no track changes, no comments, and no multiplayer editing.

The friction wasn't just in the file-oriented workflow. The normal interaction model of <abbr title="Digital Audio Workstation">DAW</abbr>s is not particularly well-suited for the task of editing spoken word audio.

So I decided to build the podcast editor we wanted: Ducking. It has a UI purpose-built for laying out spoken word audio, plus multiplayer editing, collaboration tools, and history management.

<figure>
  <img src="/making-of/assets/screenshot.png" alt="Screenshot of Ducking — waveform timeline, transcript pane, history panel, two cursors on different clips" />
</figure>

## A better UI for editing spoken word audio

When editing together audio, there are two recurring tasks:

- Audio layout: keeping the bits you want together even as things before and after them change.
- Navigation: finding the bit of audio you care about. This happens at a lot of levels of precision, from "roughly where does part 2 start?" down to "exactly which millisecond is the beginning of that background noise?"

### Audio layout

Once you can find and edit bits of audio, a second problem emerges: how do you make changes to one part of the audio without messing up everything before and after it?

#### From absolute to magnetic layout

In a traditional DAW, every clip has an absolute start time. If you move or edit the length of one, everything after drifts out of alignment:

<figure>
  <div data-interactive="absolute-layout"></div>
  <figcaption>Absolute layout — trimming any clip leaves a silent gap or overlaps the next clip.</figcaption>
</figure>

The solution to this is a magnetic layout, where clips are ordered, not positioned. Each clip's place in time is computed from the lengths of the items before it. So when you trim, delete, or insert, everything after just re-flows automatically.

When you genuinely want silence, you add an explicit gap clip; the gap is just another item in the list with a duration.

<figure>
  <div data-interactive="magnetic-layout"></div>
  <figcaption>Magnetic layout — clips and gaps reflow when you trim.</figcaption>
</figure>

This is the model used by many video editing tools as well as audio tools that focus on spoken word, like [Hindenburg](https://hindenburg.com/). So this itself isn't new. **But it provides the first step and suggests that further playing with the idea of an automated layout model might be useful.**

#### Skip regions

The vast majority of edits are to just remove a tiny bit of filler material. In most audio editors, that means splitting one clip into two and adjusting their alignment, which means you end up with hundreds of tiny disconnected clips that happen to be the audio you want because of their clip start and stop times.

By making a skipped portion of a clip an explicit entity in our model, we enable one whole chunk of the recording to stay in a single clip and be easier to deal with as a unit.

<figure>
  <div data-interactive="skip-regions"></div>
  <figcaption>Skip regions — fold a portion of a clip without splitting it in two.</figcaption>
</figure>

The skip region acts like code folding in a text editor. It leaves a visible indication and can be unfolded to interact with the skipped audio or change the region's start and end.

#### Multi-track alignment

So far we've just been editing a single linear chunk of audio. The problem gets harder when we want to introduce other tracks.

Perhaps the trickiest case is transition music. We usually want it to play gently underneath the end of one section, then swell to be the main focus, and then duck back beneath the beginning of the next section.

Most audio editors allow laying out the second track either in absolute time or by connecting the start of a clip in one track to a specific place in another. This allows the second track to float along with the rest of the magnetic layout.

<figure>
  <div data-interactive="single-connector"></div>
  <figcaption>Single connector — music clip tied to the end of a specific speech clip.</figcaption>
</figure>

But this model still doesn't really match what an editor wants to do:

- In most cases, the music is going to fade in slowly, so what matters isn't strictly where the clip starts, but where it has faded in enough to be noticeable to the listener, which is probably tied to a specific word in the outgoing section.
- Similarly, editing the length of the gap between spoken sections isn't really what an editor cares about. They've chosen music carefully and they know how they want it to swell and where it should duck back down. So it would be better to let them tie the swelling to a part of the outgoing audio and the ducking to the right part of the incoming audio.

The solution is constraint-based layout:

- Which music is playing when it fades in and out
- Where the music fades respective to the spoken track
- Which section of the music is playing (based on the start of the clip)

<figure>
  <div data-interactive="pins-and-constraints"></div>
  <figcaption>Pins and constraints — two-tie constraint layout with fade points and automation.</figcaption>
</figure>

Combining all of these elements — magnetic timeline, skip regions, and constraints between tracks — reduces the busywork aspect of audio editing and lets me focus directly on the emotional experience I'm trying to achieve.

### Navigating audio

Before we can even do an edit action, we first have to be able to understand and choose where we're editing. We navigate in a few ways:

- Actually listening to the audio, possibly scrubbing or jumping around the timeline to where we guess something is.
- Looking at the waveforms in the editor can sometimes help, both at very zoomed-out levels, where seeing the patterns of clips and tracks tells us the high-level structure of the project, and at a very zoomed-in level, where the waveform tells us exactly where a piece of speech or sound begins.
- Reviewing the transcript is helpful at intermediate levels, where we remember a piece of speech we wanted to go back over and need to find it again.

Ducking's UI makes it easy to navigate in any of these manners by establishing correspondences between the methods.

- The scrollbar shows a simplified and zoomed-out overview view of the entire project, so the scroll tab's size and position shows us exactly where in the project we are and how far zoomed in we are. In this project, the purple music clips clearly establish the section breaks, allowing us to quickly see we're looking at the transition from the intro into the first main section.
- The timeline view shows a traditional waveform with editing tools for each track and clip, but rotated ninety degrees so that it scrolls vertically. This allows us to do detailed DAW edit operations to the waveform, while benefiting from the natural alignment of the timeline to ...
- The transcript view is neither an afterthought (like in most DAWs where it just hangs out and has no correspondence to the rest of the editing), nor is it the primary editing surface (like in Descript). It scrolls and zooms together with the timeline so that you can always clearly see the text of the audio being edited. Clicking on words moves the playhead there

This lets us establish a clear correspondence between the overview, the waveforms, the transcript, and our current listening:

- The playhead appears as a golden line in all three views to orient what we're currently listening to.
- The current contents of the timeline view are indicated in the overview by its scroll tab and in the transcript view by the matching gray outline section.
- Scroll and zoom actions obviously take effect in all three places at once.

This same correspondence also ratchets up the power of other tools:

- Search results for text matches can be highlighted in the transcript and in the overview, so we can see and move to matches both near and far.
- Track Changes and history-based features can show where things changed in the overview as well as in more detail in the waveform view.


TODO: talk about correspondence of listening, transcript, seeing waveform.
- Steal Descript transcript model, but make the raw audio available by rotating the DAW tools 90deg
- Steal overview (from code editors and use it liberally to orient in time/scale)



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

---

## About me

I'm Adam Solove. I'm wrapping up a year of sabbatical projects and looking for what's next — consulting engagements or a role where I can do this kind of work: software with real product taste, hard data-model problems, collaboration and history as first-class citizens, and the patience to build something that's still useful in five years.

If you're building anything in that neighborhood, I'd like to hear about it. [adam@solove.com] / [link to whatever].

<link rel="stylesheet" href="/making-of/styles.css">
<script type="module" src="/making-of/lib/mount.js"></script>
