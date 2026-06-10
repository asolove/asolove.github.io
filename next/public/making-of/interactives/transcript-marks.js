// Transcript marks: small edits inside a word leave its mark intact;
// whole-sentence rewrites collapse the middle marks but leave the
// boundary marks alone, so the comment-thread span re-anchors to the
// surviving boundary words instead of disappearing entirely.
//
// Two beats in the animation:
//   1. Word edit: highlight the word "explore", swap text to "examine",
//      green timing underline stays attached.
//   2. Sentence edit: highlight the entire second sentence, swap text
//      to a completely different sentence. Middle words lose their
//      timing marks; first and last words keep theirs; the yellow
//      comment-thread span shrinks to those two surviving boundaries.

import { setupCanvas } from '../lib/timeline-render.js';

// === DIMENSIONS ======================================================

const W = 720;
const H = 170;
const TOP_LABEL_Y = 18;

// Two-item legend, vertically stacked on the right side.
const LEGEND_X   = 540;
const LEGEND_Y_1 = 50;
const LEGEND_Y_2 = 74;

const TEXT_X = 50;
const LINE_1_Y = 90;
const LINE_2_Y = 138;

const TEXT_FONT = '400 18px Georgia, "Iowan Old Style", serif';

// === COLORS ==========================================================

const COLORS = {
  bg:           '#1b1d22',
  cardBg:       'rgba(255, 255, 255, 0.035)',
  cardBorder:   'rgba(255, 255, 255, 0.10)',
  label:        '#bcc1c8',
  labelDim:     '#7a7e85',
  sectionLabel: '#7a7e85',

  text:         '#e6e9ef',
  textDim:      '#666a72',

  timing:       '#5ec88a',
  timingDim:    'rgba(94, 200, 138, 0.55)',

  commentBg:    'rgba(245, 215, 122, 0.13)',
  commentEdge:  'rgba(245, 215, 122, 0.45)',
  commentLabel: '#f5d77a',

  selection:    'rgba(127, 168, 255, 0.22)',
  selectionEdge:'rgba(127, 168, 255, 0.65)',

  flash:        'rgba(255, 255, 255, 0.18)',
};

// === WORD DATA =======================================================
//
// Auto-transcribed audio with two believable speech-to-text errors that
// the editor is about to fix.
//
//   Sentence 1 (one-word slip): the speaker said "gray whales"; the
//   transcript captured "great whales" — a near-homophone mis-hearing.
//   The fix is an in-word edit: "great" → "gray". The timing mark and
//   the comment-thread anchor on that word both survive intact.
//
//   Sentence 2 (multi-word botch): "Wales like in vast underwear spaces."
//   Three homophone-ish errors stacked (whales/Wales, live/like,
//   underwater/underwear). Easier to select the whole sentence and
//   retype than to fix word by word.
//
// Each word is { text, marked, comment }. `marked` toggles the green
// timing underline; `comment` is the comment-thread ID (or null).
// Both sentences are six words long, with sentence 2 starting at idx 6.

const WORDS_INITIAL = [
  { text: 'Today',      marked: true, comment: null },
  { text: 'we’ll',      marked: true, comment: null },
  { text: 'dive',       marked: true, comment: null },
  { text: 'into',       marked: true, comment: null },
  { text: 'great',      marked: true, comment: 'a' },   // mis-heard "gray"
  { text: 'whales.',    marked: true, comment: 'a' },
  { text: 'Wales',      marked: true, comment: null },  // mis-heard "Whales"
  { text: 'like',       marked: true, comment: null },  // mis-heard "live"
  { text: 'in',         marked: true, comment: null },
  { text: 'vast',       marked: true, comment: 'b' },
  { text: 'underwear',  marked: true, comment: 'b' },   // mis-heard "underwater"
  { text: 'spaces.',    marked: true, comment: 'b' },
];

// After the word edit: "great" → "gray". The mark and the comment-thread
// anchor on that word both survive — they belong to the word position,
// not the character sequence.
const WORDS_AFTER_WORD = WORDS_INITIAL.map((w, i) =>
  i === 4 ? { ...w, text: 'gray' } : w,
);

// After the sentence edit: words 6–10 ("Wales like in vast underwear")
// are selected and replaced. "spaces." (word 11) is already correct
// and is left untouched — keeps its own per-word timing mark.
//
// The FIRST word's mark survives the deletion; its end-anchor follows
// the insertion point, so one continuous mark now covers the typed
// replacement (rendered as a single uninterrupted underline under
// "Whales live in vast underwater"). "spaces." retains its own
// separate underline. The comment-thread span re-anchors to span from
// the start of the new content to the end of "spaces.".
const SURVIVING_SENT2_MARK_ID = 'sent2-surviving';
const WORDS_AFTER_SENT = [
  ...WORDS_AFTER_WORD.slice(0, 6),
  { text: 'Whales',     marked: true, comment: 'b', markId: SURVIVING_SENT2_MARK_ID },
  { text: 'live',       marked: true, comment: 'b', markId: SURVIVING_SENT2_MARK_ID },
  { text: 'in',         marked: true, comment: 'b', markId: SURVIVING_SENT2_MARK_ID },
  { text: 'vast',       marked: true, comment: 'b', markId: SURVIVING_SENT2_MARK_ID },
  { text: 'underwater', marked: true, comment: 'b', markId: SURVIVING_SENT2_MARK_ID },
  WORDS_AFTER_WORD[11], // "spaces." unchanged — kept its original mark
];

// Index of the first word on line 2. (Sentence 1 fills line 1.)
const SENTENCE_2_START = 6;

// Selection windows for each edit
const WORD_EDIT_INDEX = 4;             // "great" → "gray"
// Sentence edit selects "Wales like in vast underwear" (words 6–10).
// Word 11 ("spaces.") is already correct and stays untouched.
const SENT_EDIT_INDICES = [6, 7, 8, 9, 10];

// === ANIMATION SCHEDULE ==============================================

// Wall-clock typing speed (ms per character). Same for both edits so
// the typing tempo feels consistent.
const TYPE_MS_PER_CHAR = 75;

// New text typed during each edit. Stage durations below are derived
// from these lengths so the typing rhythm is exact.
const NEW_WORD_TEXT = 'gray';                          // 4 chars
const NEW_SENT_TEXT = 'Whales live in vast underwater'; // 30 chars
// (No trailing period — "spaces." stays in place to the right of the
// typed text.)

const WORD_TYPE_MS = NEW_WORD_TEXT.length * TYPE_MS_PER_CHAR;  // 300
const SENT_TYPE_MS = NEW_SENT_TEXT.length * TYPE_MS_PER_CHAR;  // 2850

const STAGES = (() => {
  // Composed so each duration is explicit and the next stage chains
  // off the previous one.
  let t = 0;
  const intro        = { start: t, end: t + 800  }; t = intro.end;

  // --- WORD EDIT ---
  // Cursor flies in → drags from left edge to right edge of word →
  // brief hold (selection visible) → delete + type characters one by
  // one → settle.
  t += 200;
  const wordCursorIn = { start: t, end: t + 320 }; t = wordCursorIn.end;
  const wordSelect   = { start: t, end: t + 380 }; t = wordSelect.end;
  const wordHold     = { start: t, end: t + 220 }; t = wordHold.end;
  const wordType     = { start: t, end: t + WORD_TYPE_MS }; t = wordType.end;
  const wordPause    = { start: t, end: t + 850 }; t = wordPause.end;

  // --- SENTENCE EDIT ---
  t += 250;
  const sentCursorIn = { start: t, end: t + 320 }; t = sentCursorIn.end;
  const sentSelect   = { start: t, end: t + 600 }; t = sentSelect.end;
  const sentHold     = { start: t, end: t + 250 }; t = sentHold.end;
  const sentType     = { start: t, end: t + SENT_TYPE_MS }; t = sentType.end;
  const sentPause    = { start: t, end: t + 900 }; t = sentPause.end;

  return {
    intro,
    wordCursorIn, wordSelect, wordHold, wordType, wordPause,
    sentCursorIn, sentSelect, sentHold, sentType, sentPause,
  };
})();
const TOTAL_MS = STAGES.sentPause.end;

// === EASING / HELPERS ================================================

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

// === CAPTION COPY (unused — captions live in the figcaption now) ====

const _UNUSED_CAPTIONS = {
  _: {
    title: '',
    body: '',
  },
};

// === ENTRY POINT =====================================================

export default function mount(root) {
  root.innerHTML = `
    <div data-role="canvas-host"></div>
    <div class="ix-controls">
      <button class="ix-play" data-action="play" data-state="idle" aria-label="Play">
        <span class="ix-play-icon" aria-hidden="true">
          <svg class="icon icon-play" viewBox="0 0 16 16">
            <polygon points="4,2 13,8 4,14" fill="currentColor"/>
          </svg>
          <svg class="icon icon-spin" viewBox="0 0 16 16">
            <g class="spin">
              <circle cx="8" cy="8" r="5.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-dasharray="25 33.3"/>
            </g>
          </svg>
          <svg class="icon icon-replay" viewBox="0 0 16 16">
            <path d="M 13.5 8 A 5.5 5.5 0 1 1 12 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <polyline points="11,2 12,4 10,3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="ix-play-label" data-role="play-label">Play</span>
      </button>
      <button data-action="reset">Reset</button>
    </div>
  `;

  const host      = root.querySelector('[data-role="canvas-host"]');
  const playBtn   = root.querySelector('[data-action="play"]');
  const resetBtn  = root.querySelector('[data-action="reset"]');
  const playLabel = root.querySelector('[data-role="play-label"]');

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display: block; border-radius: 5px;';
  host.appendChild(canvas);

  let state     = 'idle';
  let animFrame = null;
  let elapsed   = 0;

  function setState(s) {
    state = s;
    playBtn.dataset.state = s;
    playBtn.disabled = s === 'playing';
    playLabel.textContent = s === 'playing' ? 'Playing' : s === 'done' ? 'Replay' : 'Play';
    playBtn.setAttribute('aria-label', playLabel.textContent);
  }

  function cancelAnim() {
    if (animFrame !== null) { cancelAnimationFrame(animFrame); animFrame = null; }
  }

  function reset() {
    cancelAnim();
    elapsed = 0;
    setState('idle');
    render();
  }

  function play() {
    cancelAnim();
    elapsed = 0;
    setState('playing');
    const startTime = performance.now();
    function step(now) {
      elapsed = now - startTime;
      if (elapsed >= TOTAL_MS) {
        elapsed = TOTAL_MS;
        animFrame = null;
        setState('done');
        render();
        return;
      }
      render();
      animFrame = requestAnimationFrame(step);
    }
    animFrame = requestAnimationFrame(step);
  }

  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', reset);

  // Stage progress 0..1. Idle = 0, Done = 1, Playing = linear.
  function P(name) {
    const s = STAGES[name];
    if (state === 'idle') return 0;
    if (state === 'done') return 1;
    if (elapsed <= s.start) return 0;
    if (elapsed >= s.end) return 1;
    return (elapsed - s.start) / (s.end - s.start);
  }

  // Bell indicator: rises during a stage, fades after.
  function active(name, lead = 0, tail = 250) {
    if (state === 'idle' || state === 'done') return 0;
    const s = STAGES[name];
    if (elapsed < s.start - lead) return 0;
    if (elapsed > s.end + tail) return 0;
    if (elapsed < s.start) return (elapsed - (s.start - lead)) / lead;
    if (elapsed > s.end)   return 1 - (elapsed - s.end) / tail;
    return 1;
  }

  // Decide what to render at the current moment.
  //
  // Phase identifies the high-level scene (which controls whether the
  // mouse cursor or the text caret is visible). For typing phases the
  // current paragraph contains a "typing" sentinel word with the
  // partial text — that's the freshly typed substring of the new
  // word/sentence.
  function currentScene() {
    if (state === 'idle')                       return { phase: 'idle',          words: WORDS_INITIAL };
    if (state === 'done')                       return { phase: 'sentPause',     words: WORDS_AFTER_SENT };
    if (elapsed < STAGES.wordCursorIn.start)    return { phase: 'intro',         words: WORDS_INITIAL };
    if (elapsed < STAGES.wordCursorIn.end)      return { phase: 'wordCursorIn',  words: WORDS_INITIAL };
    if (elapsed < STAGES.wordSelect.end)        return { phase: 'wordSelect',    words: WORDS_INITIAL };
    if (elapsed < STAGES.wordHold.end)          return { phase: 'wordHold',      words: WORDS_INITIAL };
    if (elapsed < STAGES.wordType.end) {
      // Word edit typing: replace word 4 with the partial typed string.
      const typed = typedSubstring(STAGES.wordType, NEW_WORD_TEXT);
      return {
        phase: 'wordType',
        words: WORDS_INITIAL.map((w, i) =>
          i === WORD_EDIT_INDEX ? { ...w, text: typed, partial: true } : w,
        ),
      };
    }
    if (elapsed < STAGES.wordPause.end)         return { phase: 'wordPause',     words: WORDS_AFTER_WORD };
    if (elapsed < STAGES.sentCursorIn.end)      return { phase: 'sentCursorIn',  words: WORDS_AFTER_WORD };
    if (elapsed < STAGES.sentSelect.end)        return { phase: 'sentSelect',    words: WORDS_AFTER_WORD };
    if (elapsed < STAGES.sentHold.end)          return { phase: 'sentHold',      words: WORDS_AFTER_WORD };
    if (elapsed < STAGES.sentType.end) {
      // Sentence edit typing: drop sentence 2 entirely, replace with a
      // Parse the partial typed string into per-word entries with a
      // shared `markId`, so the surviving first-word mark draws as one
      // continuous underline that grows with typing. "spaces." (word
      // 11) is NOT part of the selection — it stays in place at the
      // end of line 2 throughout, keeping its own per-word mark.
      const typed = typedSubstring(STAGES.sentType, NEW_SENT_TEXT);
      return {
        phase: 'sentType',
        words: [
          ...WORDS_AFTER_WORD.slice(0, SENTENCE_2_START),
          ...buildTypingSentenceWords(typed),
          WORDS_AFTER_WORD[WORDS_AFTER_WORD.length - 1], // "spaces."
        ],
      };
    }
    if (elapsed < STAGES.sentPause.end)         return { phase: 'sentPause',     words: WORDS_AFTER_SENT };
    return { phase: 'sentPause', words: WORDS_AFTER_SENT };
  }

  // How many characters of `full` have been "typed" by now during the
  // given stage. Rounds up early so the first character lands the
  // moment the stage starts (no awkward 0-char frame).
  function typedSubstring(stage, full) {
    const p = clamp01((elapsed - stage.start) / (stage.end - stage.start));
    const n = Math.min(full.length, Math.ceil(p * full.length));
    return full.slice(0, n);
  }

  // Parse the partial typed string into word entries. Per Peritext
  // semantics: the FIRST word's surviving timing mark (start-anchor at
  // the deletion point, end-anchor tracking the insertion cursor) ends
  // up applied to the entire typed text as one continuous run. Every
  // typed word therefore shares the same `markId`, and the underline
  // renderer merges them into a single uninterrupted underline. The
  // comment-thread span re-anchors the same way and grows with typing.
  function buildTypingSentenceWords(typed) {
    if (!typed) return [];
    const trailingSpace = typed.endsWith(' ');
    const trimmed = typed.replace(/ +$/, '');
    if (!trimmed) return [];
    const visibleParts = trimmed.split(' ');
    return visibleParts.map((text, i) => ({
      text,
      marked: true,
      comment: 'b',
      markId: SURVIVING_SENT2_MARK_ID,
      partial: !trailingSpace && i === visibleParts.length - 1,
    }));
  }

  // (caption per-phase logic removed — the figcaption now carries the
  // narrative; the in-canvas summary box was duplicative.)

  // Layout: compute word positions for the current paragraph state.
  // Forces a line break at the start of sentence 2.
  function layoutWords(ctx, words) {
    ctx.font = TEXT_FONT;
    const spaceW = ctx.measureText(' ').width;
    const lineYs = [LINE_1_Y, LINE_2_Y];
    let line = 0;
    let x = TEXT_X;
    const layouts = [];
    for (let i = 0; i < words.length; i++) {
      if (i === SENTENCE_2_START) { line = 1; x = TEXT_X; }
      const word = words[i];
      const w = ctx.measureText(word.text).width;
      layouts.push({ ...word, idx: i, x, y: lineYs[line], w, line });
      x += w + spaceW;
    }
    return layouts;
  }

  // ---- render --------------------------------------------------------

  function render() {
    const ctx = setupCanvas(canvas, W, H);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    drawHeader(ctx);
    drawLegend(ctx);

    const scene = currentScene();
    const layouts = layoutWords(ctx, scene.words);

    drawCommentSpans(ctx, layouts);
    drawSelection(ctx, layouts, scene);
    drawText(ctx, layouts);
    drawTimingMarks(ctx, layouts);
    drawCaret(ctx, layouts, scene);
    drawEditFlash(ctx, layouts, scene);
    drawMouseCursor(ctx, layouts, scene);
  }

  // ---- header & legend ---------------------------------------------

  function drawHeader(ctx) {
    ctx.save();
    ctx.fillStyle = COLORS.sectionLabel;
    ctx.font = '600 10px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText('Editable transcript with marks', TEXT_X, TOP_LABEL_Y);
    ctx.restore();
  }

  function drawLegend(ctx) {
    ctx.save();
    ctx.font = '500 11px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // Item 1: green underline + label
    let y = LEGEND_Y_1;
    ctx.fillStyle = COLORS.timing;
    ctx.fillRect(LEGEND_X, y + 4, 22, 2);
    ctx.fillStyle = COLORS.labelDim;
    ctx.fillText('Timing', LEGEND_X + 28, y);

    // Item 2: yellow span swatch + label
    y = LEGEND_Y_2;
    ctx.fillStyle = COLORS.commentBg;
    ctx.strokeStyle = COLORS.commentEdge;
    ctx.lineWidth = 1;
    roundRect(ctx, LEGEND_X, y - 11, 22, 15, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.labelDim;
    ctx.fillText('Comment', LEGEND_X + 28, y);

    ctx.restore();
  }

  // ---- comment spans (yellow backgrounds) ---------------------------
  //
  // Drawn FIRST (behind text). For each unique comment ID, build one
  // rect per line spanning from the leftmost to the rightmost word
  // with that comment on that line.

  function drawCommentSpans(ctx, layouts) {
    const ids = [...new Set(layouts.map((w) => w.comment).filter(Boolean))];
    ctx.save();
    for (const id of ids) {
      const spanWords = layouts.filter((w) => w.comment === id);
      const byLine = {};
      for (const w of spanWords) {
        if (!byLine[w.line]) byLine[w.line] = [];
        byLine[w.line].push(w);
      }
      for (const line of Object.keys(byLine)) {
        const ws = byLine[line];
        const minX = Math.min(...ws.map((w) => w.x));
        const maxR = Math.max(...ws.map((w) => w.x + w.w));
        const y = ws[0].y;
        ctx.fillStyle = COLORS.commentBg;
        ctx.strokeStyle = COLORS.commentEdge;
        ctx.lineWidth = 1;
        roundRect(ctx, minX - 6, y - 21, maxR - minX + 12, 28, 4);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- selection overlay ---------------------------------------------
  //
  // The selection rectangle is now driven by the mouse cursor's drag
  // progress: it grows from 0 width at the start of the drag to full
  // width by the end. Visible during select/hold; gone the instant
  // typing starts.

  function selectionBounds(scene, layouts) {
    if (scene.phase === 'wordSelect') {
      const w = layouts[WORD_EDIT_INDEX];
      if (!w) return null;
      const t = easeInOut(P('wordSelect'));
      return { left: w.x, right: w.x + w.w * t, y: w.y };
    }
    if (scene.phase === 'wordHold') {
      const w = layouts[WORD_EDIT_INDEX];
      if (!w) return null;
      return { left: w.x, right: w.x + w.w, y: w.y };
    }
    if (scene.phase === 'sentSelect') {
      const first = layouts[SENT_EDIT_INDICES[0]];
      const last  = layouts[SENT_EDIT_INDICES[SENT_EDIT_INDICES.length - 1]];
      if (!first || !last) return null;
      const t = easeInOut(P('sentSelect'));
      const fullRight = last.x + last.w;
      return { left: first.x, right: first.x + (fullRight - first.x) * t, y: first.y };
    }
    if (scene.phase === 'sentHold') {
      const first = layouts[SENT_EDIT_INDICES[0]];
      const last  = layouts[SENT_EDIT_INDICES[SENT_EDIT_INDICES.length - 1]];
      if (!first || !last) return null;
      return { left: first.x, right: last.x + last.w, y: first.y };
    }
    return null;
  }

  function drawSelection(ctx, layouts, scene) {
    const sel = selectionBounds(scene, layouts);
    if (!sel) return;
    const w = sel.right - sel.left;
    if (w < 1) return;

    // Tight rect: matches the text's left/right edges exactly. No
    // horizontal padding — the selection covers the characters, not
    // the trailing space.
    ctx.save();
    ctx.fillStyle = COLORS.selection;
    ctx.strokeStyle = COLORS.selectionEdge;
    ctx.lineWidth = 1;
    roundRect(ctx, sel.left, sel.y - 19, w, 24, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ---- the words themselves -----------------------------------------

  function drawText(ctx, layouts) {
    ctx.save();
    ctx.font = TEXT_FONT;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    for (const word of layouts) {
      ctx.fillText(word.text, word.x, word.y);
    }
    ctx.restore();
  }

  // ---- timing marks (green underlines per word OR per group) -------
  //
  // Words with no `markId` are drawn as independent per-word underlines
  // (the per-word transcription marks). Consecutive same-line words
  // that SHARE a `markId` are merged into one continuous underline
  // (representing a single multi-word mark — used for the surviving
  // mark after the sentence rewrite, which spans the whole new
  // sentence as one uninterrupted run).

  function drawTimingMarks(ctx, layouts) {
    ctx.save();
    ctx.fillStyle = COLORS.timing;
    let i = 0;
    while (i < layouts.length) {
      const w = layouts[i];
      if (!w.marked) { i++; continue; }

      // Greedy extend the run while the next word is on the same line
      // AND both share a defined `markId`.
      let j = i;
      while (
        j + 1 < layouts.length &&
        layouts[j + 1].marked &&
        layouts[j + 1].line === w.line &&
        w.markId != null &&
        layouts[j + 1].markId === w.markId
      ) {
        j++;
      }

      const startX = w.x;
      const endX   = layouts[j].x + layouts[j].w;
      ctx.fillRect(startX, w.y + 6, endX - startX, 2);
      i = j + 1;
    }
    ctx.restore();
  }

  // ---- edit flash ---------------------------------------------------
  //
  // Brief flash at the moment the user "deletes" the selection by
  // starting to type. Sized to the OLD selection (the text that was
  // there before — "great" or the whole botched sentence) so it reads
  // as the selection being whited-out / replaced. Fades out quickly.

  function drawEditFlash(ctx, layouts, scene) {
    ctx.save();
    ctx.font = TEXT_FONT;

    if (scene.phase === 'wordType') {
      const t = P('wordType');
      if (t > 0.20) { ctx.restore(); return; }
      const fade = 1 - t / 0.20;
      const w = layouts[WORD_EDIT_INDEX];
      if (!w) { ctx.restore(); return; }
      const oldW = ctx.measureText(WORDS_INITIAL[WORD_EDIT_INDEX].text).width;
      ctx.globalAlpha = fade * 0.55;
      ctx.fillStyle = COLORS.flash;
      roundRect(ctx, w.x, w.y - 19, oldW, 24, 2);
      ctx.fill();
    } else if (scene.phase === 'sentType') {
      const t = P('sentType');
      if (t > 0.08) { ctx.restore(); return; }
      const fade = 1 - t / 0.08;
      // The first typed word lives at layouts[SENTENCE_2_START]; if
      // typing hasn't laid down any characters yet, fall back to the
      // start of line 2 so the flash still anchors correctly.
      const chunk = layouts[SENTENCE_2_START];
      const flashX = chunk ? chunk.x : TEXT_X;
      const flashY = chunk ? chunk.y : LINE_2_Y;
      // Flash covers only the SELECTED range (words 6–10), not
      // "spaces." which was never touched.
      const oldText = SENT_EDIT_INDICES
        .map((i) => WORDS_INITIAL[i].text).join(' ');
      const oldW = ctx.measureText(oldText).width;
      ctx.globalAlpha = fade * 0.55;
      ctx.fillStyle = COLORS.flash;
      roundRect(ctx, flashX, flashY - 19, oldW, 24, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- text caret ---------------------------------------------------
  //
  // Thin blinking vertical line at the insertion point during typing.
  // Sits just past the last typed character so it leads the next
  // letter into view.

  function drawCaret(ctx, layouts, scene) {
    let caretX, caretY;
    if (scene.phase === 'wordType') {
      const t = layouts[WORD_EDIT_INDEX];
      if (!t) return;
      caretX = t.x + t.w + 1;
      caretY = t.y;
    } else if (scene.phase === 'sentType') {
      // Caret follows the rightmost TYPED word — i.e. the last word
      // carrying the surviving-mark id. (We must skip "spaces.", which
      // also sits on line 2 but isn't part of the typed replacement.)
      const typedWords = layouts.filter(
        (w) => w.markId === SURVIVING_SENT2_MARK_ID,
      );
      if (typedWords.length === 0) {
        caretX = TEXT_X;
        caretY = LINE_2_Y;
      } else {
        const t = typedWords[typedWords.length - 1];
        caretX = t.x + t.w + 1;
        caretY = t.y;
      }
    } else {
      return;
    }

    // Blink: visible 60% of an 800ms period.
    const phaseT = (elapsed % 800) / 800;
    if (phaseT >= 0.6) return;

    ctx.save();
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(caretX, caretY - 16, 1.5, 19);
    ctx.restore();
  }

  // ---- mouse cursor -------------------------------------------------
  //
  // Mac-style arrow pointer. Visible during cursorIn / select / hold
  // phases; hidden during typing (the text caret takes over) and idle.

  function mouseCursorPos(scene, layouts) {
    const ph = scene.phase;

    if (ph === 'wordCursorIn' || ph === 'wordSelect' || ph === 'wordHold') {
      const w = layouts[WORD_EDIT_INDEX];
      if (!w) return null;
      const targetY = w.y - 4;
      if (ph === 'wordCursorIn') {
        const t = easeOut(P('wordCursorIn'));
        return {
          x: lerp(w.x + 60, w.x, t),
          y: lerp(targetY + 70, targetY, t),
          pressed: t > 0.85,
        };
      }
      if (ph === 'wordSelect') {
        const t = easeInOut(P('wordSelect'));
        return { x: lerp(w.x, w.x + w.w, t), y: targetY, pressed: true };
      }
      // wordHold
      return { x: w.x + w.w, y: targetY, pressed: false };
    }

    if (ph === 'sentCursorIn' || ph === 'sentSelect' || ph === 'sentHold') {
      const first = layouts[SENT_EDIT_INDICES[0]];
      const last  = layouts[SENT_EDIT_INDICES[SENT_EDIT_INDICES.length - 1]];
      if (!first || !last) return null;
      const startX = first.x;
      const endX   = last.x + last.w;
      const targetY = first.y - 4;
      if (ph === 'sentCursorIn') {
        const t = easeOut(P('sentCursorIn'));
        return {
          x: lerp(startX + 60, startX, t),
          y: lerp(targetY + 70, targetY, t),
          pressed: t > 0.85,
        };
      }
      if (ph === 'sentSelect') {
        const t = easeInOut(P('sentSelect'));
        return { x: lerp(startX, endX, t), y: targetY, pressed: true };
      }
      // sentHold
      return { x: endX, y: targetY, pressed: false };
    }

    return null;
  }

  function drawMouseCursor(ctx, layouts, scene) {
    const pos = mouseCursorPos(scene, layouts);
    if (!pos) return;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    const scale = pos.pressed ? 0.88 : 1;
    ctx.scale(scale, scale);

    if (pos.pressed) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    cursorPath(ctx, 1.2, 1.6);
    ctx.fill();

    // Cursor body
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#101115';
    ctx.lineWidth = 1.1;
    cursorPath(ctx, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function cursorPath(ctx, ox, oy) {
    ctx.beginPath();
    ctx.moveTo(ox + 0,   oy + 0);
    ctx.lineTo(ox + 0,   oy + 16);
    ctx.lineTo(ox + 4,   oy + 12.5);
    ctx.lineTo(ox + 6.5, oy + 17);
    ctx.lineTo(ox + 8.5, oy + 16);
    ctx.lineTo(ox + 6,   oy + 11.5);
    ctx.lineTo(ox + 11,  oy + 11);
    ctx.closePath();
  }

  // ---- initial render ---------------------------------------------
  render();
}

// === SHAPE HELPERS ====================================================

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
