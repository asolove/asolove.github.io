// Synchronized navigation across timeline / overview / transcript, with a
// local model the user can drive directly: wheel-scroll the timeline,
// ⌘/Ctrl + wheel (or pinch) to zoom, scroll the transcript independently,
// Play/Pause, drag the overview thumb, click anywhere on the time axis to
// seek, click any word in the transcript to seek.
//
// Layout model — matches the earlier sections of the post:
//   - Speech clips lay out magnetically: each clip's project-time start
//     is the cumulative duration of everything before it. Drag a clip's
//     bottom edge to trim its duration; everything after reflows.
//   - Between two consecutive speech clips, EITHER an explicit gap (with
//     its own duration) OR a music clip pinned to both sides via two
//     tie pairs. With music, the gap is no longer free — it's whatever
//     the pins force.
//
// Pin model (per pins-and-constraints.js):
//   left tie:  aLeftTie  (source-time within A) ↔ mLeftTie  (source within M)
//   right tie: mRightTie (source-time within M) ↔ bRightTie (source within B)
//   Both pin endpoints of a tie share the same project-time:
//       aLeftTieProj   = A.start    + aLeftTie
//       M.start        = aLeftTieProj - mLeftTie
//       mRightTieProj  = M.start    + mRightTie
//       B.start        = mRightTieProj - bRightTie
//   Dragging an endpoint mutates its source-time:
//   - "spine-side" (aLeftTie, mRightTie): pin's project-time moves with cursor.
//   - "music-side" (mLeftTie, bRightTie): pin's project-time stays fixed
//     (anchored to its paired pin) — what slides is the clip body underneath.

import { setupCanvas } from '../lib/timeline-render.js';

// === MODEL ==================================================================

// Speech clips — durations are mutable (trim).
const SPEECH_MODEL = [
  { id: 's1',  duration: 28, text: "Welcome back to the show. This week we're talking about a piece of software you've probably never thought you needed: a better podcast editor." },
  { id: 's2',  duration: 42, text: "The basic problem is that the dominant audio editing tools, the DAWs, were built for music production decades ago. They put every clip at a specific moment in time." },
  { id: 's3',  duration: 38, text: "When you cut out filler words or pauses, you have to manually pull the rest forward. Skip one clip and the whole project drifts out of alignment." },
  { id: 's4',  duration: 44, text: "Magnetic layout is the alternative. Each clip's start is the sum of the durations before it. Cut one, the rest reflow on their own." },
  { id: 's5',  duration: 34, text: "We're not the first to think of this. Final Cut Pro X did it; Hindenburg uses it for podcasts. But there's still room to push the idea further." },
  { id: 's6',  duration: 30, text: "Skip regions fold a portion of a clip. Instead of splitting clips to omit a few seconds, you mark a region inside one clip as skipped — like code folding." },
  { id: 's7',  duration: 36, text: "The result is a smaller number of larger clips, much easier to think about. The skip is reversible: the source audio is still there if you want it back." },
  { id: 's8',  duration: 38, text: "Music tracks get their own layout. Each music clip ties to a moment on the speech track, like a connector. Move the speech, the music follows automatically." },
  { id: 's9',  duration: 36, text: "The deeper problem is that editors don't think in terms of clip starts. They think about where a music swell becomes audible, or where it ducks under the next section." },
  { id: 's10', duration: 38, text: "Constraint-based ties solve that. The music's fade-in points to a specific word. The fade-out points to another word. The clip stretches itself to fit both." },
  { id: 's11', duration: 32, text: "Combining magnetic layout, skip regions, and constraint-based ties — the editor stops fighting the tool and gets to focus on the actual sound." },
  { id: 's12', duration: 38, text: "Building this turned out to be unexpectedly fun. The underlying data structures are the same shapes used in collaborative text editors." },
  { id: 's13', duration: 32, text: "Once you see that, multiplayer editing, history, revert, live cursors — they all fall out of the same model. Same lessons, different rendering." },
  { id: 's14', duration: 12, text: "Anyway, thanks for listening." },
];

// Silent gap before s1. (Now zero — the project starts on speech.)
const INITIAL_PRE_ROLL_GAP = 0;
let preRollGap = INITIAL_PRE_ROLL_GAP;

// Between each consecutive speech pair (INTER_MODEL[i] sits between
// SPEECH_MODEL[i] and SPEECH_MODEL[i+1]). Either an explicit gap with
// its own duration, or a music clip with two pin pairs. Most pairs touch
// directly (gap of 0); one explicit 5s gap sits between s3 and s4 to
// keep one visible "gap" item in the demo.
const INTER_MODEL = [
  // s1 → s2: short transition music
  { kind: 'music', id: 'm1', mDuration: 14, pins: { aLeftTie: 26, mLeftTie: 2, mRightTie: 12, bRightTie: 2 } },
  // s2 → s3
  { kind: 'gap', duration: 0 },
  // s3 → s4 — only visible explicit gap
  { kind: 'gap', duration: 5 },
  // s4 → s5
  { kind: 'gap', duration: 0 },
  // s5 → s6: longer bed under section break
  { kind: 'music', id: 'm2', mDuration: 24, pins: { aLeftTie: 32, mLeftTie: 2, mRightTie: 22, bRightTie: 2 } },
  // s6 → s7
  { kind: 'gap', duration: 0 },
  // s7 → s8
  { kind: 'gap', duration: 0 },
  // s8 → s9
  { kind: 'gap', duration: 0 },
  // s9 → s10: section break music
  { kind: 'music', id: 'm3', mDuration: 20, pins: { aLeftTie: 34, mLeftTie: 2, mRightTie: 18, bRightTie: 2 } },
  // s10 → s11
  { kind: 'gap', duration: 0 },
  // s11 → s12
  { kind: 'gap', duration: 0 },
  // s12 → s13
  { kind: 'gap', duration: 0 },
  // s13 → s14: outro music underlaying the farewell
  { kind: 'music', id: 'm4', mDuration: 10, pins: { aLeftTie: 30, mLeftTie: 2, mRightTie: 8, bRightTie: 2 } },
];

// Snapshots for Reset.
const INITIAL_SPEECH_DURATIONS = Object.freeze(SPEECH_MODEL.map((s) => s.duration));
const INITIAL_INTER_STATE = Object.freeze(
  INTER_MODEL.map((i) => Object.freeze(deepCloneInter(i))),
);

function deepCloneInter(i) {
  if (i.kind === 'gap') return { kind: 'gap', duration: i.duration };
  return { kind: 'music', id: i.id, mDuration: i.mDuration, pins: { ...i.pins } };
}

// Derived state — recomputed via refresh() whenever the model mutates.
let SPEECH;
let RESOLVED_MUSIC;
let RESOLVED_GAPS;
let PROJECT_DURATION;
let TRANSCRIPT;

function resolveLayout() {
  const speech = [];
  const music = [];
  const gaps = [];
  let cursor = preRollGap;

  // Implicit pre-roll gap, represented as interIdx = -1.
  if (preRollGap > 0) {
    gaps.push({ start: 0, duration: preRollGap, interIdx: -1 });
  }

  for (let i = 0; i < SPEECH_MODEL.length; i++) {
    const s = SPEECH_MODEL[i];
    const resolvedA = { ...s, start: cursor };
    speech.push(resolvedA);

    if (i === SPEECH_MODEL.length - 1) break;

    const inter = INTER_MODEL[i];
    if (inter.kind === 'gap') {
      const gStart = cursor + s.duration;
      gaps.push({ start: gStart, duration: inter.duration, interIdx: i });
      cursor = gStart + inter.duration;
    } else {
      const aLeftTieProj  = resolvedA.start + inter.pins.aLeftTie;
      const mStart        = aLeftTieProj - inter.pins.mLeftTie;
      const mRightTieProj = mStart + inter.pins.mRightTie;
      const bStart        = mRightTieProj - inter.pins.bRightTie;
      const bDur          = SPEECH_MODEL[i + 1].duration;
      music.push({
        id: inter.id,
        start: mStart,
        duration: inter.mDuration,
        pins: inter.pins,
        leftPinProj:  aLeftTieProj,
        rightPinProj: mRightTieProj,
        precedingSpeechId: resolvedA.id,
        followingSpeechId: SPEECH_MODEL[i + 1].id,
        interIdx: i,
      });
      cursor = bStart;
    }
  }

  const last = speech[speech.length - 1];
  const total = last.start + last.duration;
  return { speech, music, gaps, total };
}

function refresh() {
  const r = resolveLayout();
  SPEECH = r.speech;
  RESOLVED_MUSIC = r.music;
  RESOLVED_GAPS = r.gaps;
  PROJECT_DURATION = r.total;
  TRANSCRIPT = buildTranscript();
}

// === LAYOUT / VISUAL CONSTANTS =============================================

const W = 720;
const H = 460;

const COL_TIME_X     = 0;
const COL_TIME_W     = 38;
const COL_GAP_TIME   = 4;
const COL_MAIN_X     = COL_TIME_X + COL_TIME_W + COL_GAP_TIME;
const COL_MAIN_W     = 70;
const COL_GAP_TRACKS = 4;
const COL_MUSIC_X    = COL_MAIN_X + COL_MAIN_W + COL_GAP_TRACKS;
const COL_MUSIC_W    = 70;
const COL_GAP_OV     = 10;
const COL_OV_X       = COL_MUSIC_X + COL_MUSIC_W + COL_GAP_OV;
const COL_OV_W       = 22;
const COL_GAP_TRANS  = 16;
const COL_TRANS_X    = COL_OV_X + COL_OV_W + COL_GAP_TRANS;
const COL_TRANS_W    = 460;

const CLIP_INNER_X   = 4;
const TRACK_TITLE_H  = 18;

const LINE_PIXEL_HEIGHT = 16;
const PARA_GAP          = 6;
const TRANS_PAD_TOP     = 4;

const DEFAULT_PX_PER_SECOND = 8;
// MIN chosen so the whole project (~570s) fits in the viewport with room
// to spare; MAX gives a ~4-second viewport for tight per-word work.
const MIN_PX_PER_SECOND     = 0.6;
const MAX_PX_PER_SECOND     = 96;
const ZOOM_WHEEL_FACTOR     = 1.12;

const PLAY_RATE = 2;

const EDGE_HIT_PX   = 6;
const MIN_CLIP_DUR  = 2;
const MIN_GAP_DUR   = 0.5;
const MAX_ITEM_DUR  = 120;

// Pin handles (triangular arrows in the gap between main and music cols).
const PIN_ARROW_H   = 7;   // length apex → base
const PIN_ARROW_HW  = 4;   // half-width of base
const PIN_HIT_X     = 9;
const PIN_HIT_Y     = 7;

const COLORS = {
  bg:               '#1b1d22',
  timeAxisBg:       '#15171b',
  timeAxisText:     '#7a7e85',
  timeAxisTick:     'rgba(255,255,255,0.18)',
  trackBorder:      'rgba(255,255,255,0.05)',
  trackLaneMain:    'rgba(106, 171, 232, 0.05)',
  trackLaneMus:     'rgba(160, 112, 224, 0.05)',
  mainFill:         '#5a9edc',
  mainTop:          '#3a78b8',
  mainStroke:       '#1f4d8c',
  mainText:         '#eaf4ff',
  musicFill:        '#a070e0',
  musicStroke:      '#4f2a85',
  musicText:        '#f0e8fb',
  gapFill:          'rgba(255, 255, 255, 0.028)',
  gapBorder:        'rgba(255, 255, 255, 0.18)',
  gapText:          'rgba(255, 255, 255, 0.32)',
  pinLeft:          '#e8c763',
  pinRight:         '#e8a163',
  pinConnector:     'rgba(255, 255, 255, 0.30)',
  pinHover:         '#ffffff',
  trackTitle:       '#9a9fa5',
  transcriptText:   '#cdd2d8',
  transcriptLabel:  '#777b80',
  highlightFill:    'rgba(255, 255, 255, 0.045)',
  highlightStroke:  'rgba(220, 222, 226, 0.45)',
  overviewBg:       '#0f1013',
  overviewBorder:   'rgba(255,255,255,0.05)',
  overviewMain:     'rgba(106, 171, 232, 0.72)',
  overviewMusic:    'rgba(160, 112, 224, 0.85)',
  thumbFill:        'rgba(255, 255, 255, 0.07)',
  thumbShine:       'rgba(255, 255, 255, 0.22)',
  thumbBorder:      'rgba(220, 222, 226, 0.65)',
  thumbBorderHot:   'rgba(255, 255, 255, 0.9)',
  playhead:         '#ffd700',
};

// === TRANSCRIPT DOCUMENT LAYOUT ============================================

function buildTranscript() {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const speechFont = '13px -apple-system, system-ui, sans-serif';
  const musicFont  = '11px -apple-system, system-ui, sans-serif';
  const maxW = COL_TRANS_W - 8;

  const items = [
    ...SPEECH.map((s) => ({ kind: 'speech', start: s.start, dur: s.duration, text: s.text })),
    ...RESOLVED_MUSIC.map((m) => ({ kind: 'music', start: m.start, dur: m.duration })),
  ].sort((a, b) => a.start - b.start);

  const lines = [];
  let y = TRANS_PAD_TOP;

  for (const item of items) {
    if (item.kind === 'music') {
      lines.push({
        kind: 'music', text: '♪ music', font: musicFont, y,
        tStart: item.start, tEnd: item.start + item.dur, words: null,
      });
      y += LINE_PIXEL_HEIGHT;
      y += PARA_GAP;
      continue;
    }

    ctx.font = speechFont;
    const words = item.text.split(/\s+/).filter(Boolean);
    const normalized = words.join(' ');
    const totalChars = Math.max(1, normalized.length);
    const timeAt = (chars) => item.start + (chars / totalChars) * item.dur;

    let line = '';
    let lineStartChar = 0;
    let cursor = 0;

    const flush = () => {
      const lineWords = line.split(' ');
      const lineLen = Math.max(1, line.length);
      const tStart = timeAt(lineStartChar);
      const tEnd   = timeAt(cursor);
      const lineDur = Math.max(0.001, tEnd - tStart);
      let charOff = 0;
      const wordList = [];
      for (const w of lineWords) {
        wordList.push({
          tStart:  tStart + (charOff / lineLen) * lineDur,
          xOffset: ctx.measureText(line.slice(0, charOff)).width,
        });
        charOff += w.length + 1;
      }
      lines.push({ kind: 'speech', text: line, font: speechFont, y, tStart, tEnd, words: wordList });
      y += LINE_PIXEL_HEIGHT;
    };

    for (const w of words) {
      const proposed = line ? line + ' ' + w : w;
      if (line && ctx.measureText(proposed).width > maxW) {
        flush();
        cursor += 1;
        lineStartChar = cursor;
        cursor += w.length;
        line = w;
      } else {
        if (line) cursor += 1;
        cursor += w.length;
        line = proposed;
      }
    }
    if (line) flush();
    y += PARA_GAP;
  }

  return { lines, height: y + TRANS_PAD_TOP };
}

// Initial derivation.
refresh();

// === ENTRY POINT ===========================================================

export default function mount(root) {
  root.innerHTML = `
    <div data-role="canvas-host"></div>
    <div class="ix-controls">
      <button class="ix-play" data-action="play-pause" data-state="idle" aria-label="Play">
        <span class="ix-play-icon" aria-hidden="true">
          <svg class="icon icon-play" viewBox="0 0 16 16">
            <polygon points="4,2 13,8 4,14" fill="currentColor"/>
          </svg>
          <svg class="icon icon-spin" viewBox="0 0 16 16">
            <rect x="3.5" y="3" width="3" height="10" fill="currentColor"/>
            <rect x="9.5" y="3" width="3" height="10" fill="currentColor"/>
          </svg>
          <svg class="icon icon-replay" viewBox="0 0 16 16">
            <path d="M 13.5 8 A 5.5 5.5 0 1 1 12 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <polyline points="11,2 12,4 10,3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="ix-play-label" data-role="play-label">Play</span>
      </button>
      <button data-action="reset">Reset</button>
      <span class="ix-hint" data-role="hint">drag pin arrows · drag clip/gap edges · scroll · ⌘+scroll zoom · click time/word to seek</span>
    </div>
  `;

  const host      = root.querySelector('[data-role="canvas-host"]');
  const playBtn   = root.querySelector('[data-action="play-pause"]');
  const resetBtn  = root.querySelector('[data-action="reset"]');
  const playLabel = root.querySelector('[data-role="play-label"]');

  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'display:block; border-radius:5px; max-width:100%; touch-action:none; cursor:default;';
  host.appendChild(canvas);

  // --- state -----------------------------------------------------------
  let scrollY      = 0;
  let playhead     = 0;
  let zoom         = DEFAULT_PX_PER_SECOND;
  let playing      = false;
  /** @type {null
   *   | {kind:'thumb', startScroll:number, startCanvasY:number}
   *   | {kind:'trim-edge', target:object, startDur:number, startCanvasY:number}
   *   | {kind:'pin', musicId:string, pinId:string, initialSrc:number, startCanvasY:number}} */
  let drag         = null;
  let hoverOverview = false;
  let hoverTrimEdge = false;
  let hoverPin     = null;

  const viewportSecs   = () => (H - TRACK_TITLE_H) / zoom;

  // When the viewport is longer than the project (zoomed all the way
  // out), allow scrollY to go negative or extend past the standard max
  // by the slack |viewport - project|. This keeps cursor-anchored zoom
  // working even when the user's cursor sits over the empty area beyond
  // the project — otherwise zooming would clamp scrollY back to 0 and
  // the anchor point would slip out from under the cursor.
  function scrollBounds() {
    const v = viewportSecs();
    const slack = Math.max(0, v - PROJECT_DURATION);
    return {
      lo: -slack,
      hi: Math.max(0, PROJECT_DURATION - v) + slack,
    };
  }

  function clampScroll() {
    const { lo, hi } = scrollBounds();
    if (scrollY < lo) scrollY = lo;
    if (scrollY > hi) scrollY = hi;
  }
  function clampPlayhead() {
    if (playhead < 0) playhead = 0;
    if (playhead > PROJECT_DURATION) playhead = PROJECT_DURATION;
  }

  // Transcript auto-scrolls in lockstep with the timeline. Derived from
  // scrollY by finding the first line whose time range enters the
  // visible timeline window and parking it near the top of the
  // transcript pane. Falls back to a project-proportional position when
  // the visible window contains no transcript content (e.g., looking at
  // a gap or music-only stretch).
  function currentTransScrollY() {
    let firstVisible = null;
    for (const l of TRANSCRIPT.lines) {
      if (l.tEnd > scrollY) { firstVisible = l; break; }
    }
    const viewportH = H - TRACK_TITLE_H;
    const maxTrans = Math.max(0, TRANSCRIPT.height - viewportH);
    let target;
    if (firstVisible) {
      target = firstVisible.y - 12;
    } else if (PROJECT_DURATION > 0) {
      target = (scrollY / PROJECT_DURATION) * TRANSCRIPT.height;
    } else {
      target = 0;
    }
    return Math.max(0, Math.min(maxTrans, target));
  }

  function refreshAndClamp() {
    refresh();
    clampScroll();
    clampPlayhead();
  }

  // --- hit-testing ----------------------------------------------------
  function hitTestMainEdge(canvasX, canvasY) {
    if (canvasX < COL_MAIN_X || canvasX >= COL_MAIN_X + COL_MAIN_W) return null;
    if (canvasY < TRACK_TITLE_H) return null;
    for (const s of SPEECH) {
      const endY = TRACK_TITLE_H + (s.start + s.duration - scrollY) * zoom;
      if (endY < TRACK_TITLE_H - EDGE_HIT_PX || endY > H + EDGE_HIT_PX) continue;
      if (Math.abs(canvasY - endY) <= EDGE_HIT_PX) {
        return { kind: 'speech', id: s.id, duration: s.duration };
      }
    }
    for (const g of RESOLVED_GAPS) {
      const endY = TRACK_TITLE_H + (g.start + g.duration - scrollY) * zoom;
      if (endY < TRACK_TITLE_H - EDGE_HIT_PX || endY > H + EDGE_HIT_PX) continue;
      if (Math.abs(canvasY - endY) <= EDGE_HIT_PX) {
        return { kind: 'gap', interIdx: g.interIdx, duration: g.duration };
      }
    }
    return null;
  }

  function setItemDuration(target, dur) {
    if (target.kind === 'speech') {
      const item = SPEECH_MODEL.find((s) => s.id === target.id);
      if (item) item.duration = Math.max(MIN_CLIP_DUR, Math.min(MAX_ITEM_DUR, dur));
    } else if (target.kind === 'gap') {
      const clamped = Math.max(MIN_GAP_DUR, Math.min(MAX_ITEM_DUR, dur));
      if (target.interIdx === -1) preRollGap = clamped;
      else {
        const item = INTER_MODEL[target.interIdx];
        if (item && item.kind === 'gap') item.duration = clamped;
      }
    }
  }

  // Pin hit-test. The four endpoints per music live on two horizontal
  // lines (one per tie). Speech-side triangles point right (apex at
  // main column's right edge); music-side triangles point left.
  function hitTestPin(canvasX, canvasY) {
    if (canvasY < TRACK_TITLE_H) return null;
    const xMainRight = COL_MAIN_X + COL_MAIN_W - CLIP_INNER_X;
    const xMusicLeft = COL_MUSIC_X + CLIP_INNER_X;
    const speechXMin = xMainRight - 2;
    const speechXMax = xMainRight + PIN_ARROW_H + 2;
    const musicXMin  = xMusicLeft - PIN_ARROW_H - 2;
    const musicXMax  = xMusicLeft + 2;

    for (const m of RESOLVED_MUSIC) {
      const ties = [
        { proj: m.leftPinProj,  speechPinId: 'aLeftTie',  musicPinId: 'mLeftTie'  },
        { proj: m.rightPinProj, speechPinId: 'bRightTie', musicPinId: 'mRightTie' },
      ];
      for (const t of ties) {
        const y = TRACK_TITLE_H + (t.proj - scrollY) * zoom;
        if (y < TRACK_TITLE_H - PIN_HIT_Y || y > H + PIN_HIT_Y) continue;
        if (Math.abs(canvasY - y) > PIN_HIT_Y) continue;
        if (canvasX >= speechXMin && canvasX <= speechXMax) {
          return { musicId: m.id, pinId: t.speechPinId };
        }
        if (canvasX >= musicXMin && canvasX <= musicXMax) {
          return { musicId: m.id, pinId: t.musicPinId };
        }
      }
    }
    return null;
  }

  // --- UI state --------------------------------------------------------
  function syncButton() {
    const atEnd = playhead >= PROJECT_DURATION - 0.001;
    if (playing) {
      playBtn.dataset.state = 'playing';
      playLabel.textContent = 'Pause';
      playBtn.setAttribute('aria-label', 'Pause');
    } else if (atEnd) {
      playBtn.dataset.state = 'done';
      playLabel.textContent = 'Replay';
      playBtn.setAttribute('aria-label', 'Replay from start');
    } else {
      playBtn.dataset.state = 'idle';
      playLabel.textContent = 'Play';
      playBtn.setAttribute('aria-label', 'Play');
    }
  }

  // --- play loop -------------------------------------------------------
  let rafId = null;
  let lastFrameMs = null;

  function startLoop() {
    if (rafId !== null) return;
    lastFrameMs = null;
    const step = (now) => {
      rafId = null;
      if (lastFrameMs !== null) {
        const dt = (now - lastFrameMs) / 1000;
        if (playing) {
          playhead += dt * PLAY_RATE;
          if (playhead >= PROJECT_DURATION) {
            playhead = PROJECT_DURATION;
            playing = false;
            syncButton();
          }
        }
      }
      lastFrameMs = now;
      render();
      if (playing) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }
  function stopLoop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function setPlaying(next) {
    if (playing === next) return;
    playing = next;
    syncButton();
    if (playing) startLoop();
    else stopLoop();
  }

  // --- events ----------------------------------------------------------
  function eventToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = W / rect.width;
    const sy = H / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  }

  const inTimeAxis  = (x, y) => x >= COL_TIME_X && x < COL_TIME_X + COL_TIME_W && y >= TRACK_TITLE_H;
  const inTimeline  = (x, y) => x >= COL_TIME_X && x < COL_OV_X && y >= TRACK_TITLE_H;
  const inOverview  = (x, y) => x >= COL_OV_X && x <= COL_OV_X + COL_OV_W && y >= TRACK_TITLE_H && y <= H;
  const inTranscript = (x, y) => x >= COL_TRANS_X && x < COL_TRANS_X + COL_TRANS_W && y >= TRACK_TITLE_H;

  const overviewYToT = (y) => {
    const top = TRACK_TITLE_H + 2;
    const bot = H - 2;
    const f = Math.max(0, Math.min(1, (y - top) / (bot - top)));
    return f * PROJECT_DURATION;
  };

  function pinSign(pinId) {
    // Spine-side pins (aLeftTie, mRightTie): drag down → source increases.
    // Music-side pins (mLeftTie, bRightTie): drag down → source decreases
    //   (so the clip body slides with the cursor; pin proj-time stays put).
    return (pinId === 'aLeftTie' || pinId === 'mRightTie') ? 1 : -1;
  }

  function clampPinSrc(pinId, val, interEntry) {
    const idx = INTER_MODEL.indexOf(interEntry);
    const aDur = SPEECH_MODEL[idx].duration;
    const bDur = SPEECH_MODEL[idx + 1].duration;
    const mDur = interEntry.mDuration;
    let v = val;
    if (pinId === 'aLeftTie')  v = Math.max(0, Math.min(aDur, v));
    if (pinId === 'bRightTie') v = Math.max(0, Math.min(bDur, v));
    if (pinId === 'mLeftTie') {
      v = Math.max(0, Math.min(mDur, v));
      if (v > interEntry.pins.mRightTie - 0.5) v = interEntry.pins.mRightTie - 0.5;
    }
    if (pinId === 'mRightTie') {
      v = Math.max(0, Math.min(mDur, v));
      if (v < interEntry.pins.mLeftTie + 0.5) v = interEntry.pins.mLeftTie + 0.5;
    }
    return v;
  }

  // Wheel works everywhere on the canvas: timeline, overview, and
  // transcript all funnel into timeline scroll/zoom. Zoom anchors on the
  // cursor's project-time when the cursor is over a column that maps
  // directly to project-time (timeline + transcript); otherwise on
  // viewport center.
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { x, y } = eventToCanvas(e);
    if (y < TRACK_TITLE_H) return;

    const yInScroll = Math.max(0, y - TRACK_TITLE_H);
    const cursorOverTimeline = x < COL_OV_X;

    if (e.ctrlKey || e.metaKey) {
      const focusT = cursorOverTimeline
        ? scrollY + yInScroll / zoom
        : scrollY + viewportSecs() / 2;
      const factor = e.deltaY < 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR;
      const next = Math.max(MIN_PX_PER_SECOND, Math.min(MAX_PX_PER_SECOND, zoom * factor));
      if (next === zoom) return;
      zoom = next;
      scrollY = cursorOverTimeline
        ? focusT - yInScroll / zoom
        : focusT - viewportSecs() / 2;
      clampScroll();
    } else {
      scrollY += e.deltaY / zoom;
      clampScroll();
    }
    syncButton();
    if (!playing) render();
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = eventToCanvas(e);
    if (y < TRACK_TITLE_H) return;

    if (inOverview(x, y)) {
      canvas.setPointerCapture(e.pointerId);
      const targetT = overviewYToT(y);
      const wantScroll = targetT - viewportSecs() / 2;
      const thumbT0 = (scrollY / PROJECT_DURATION) * (H - TRACK_TITLE_H - 4) + TRACK_TITLE_H + 2;
      const thumbT1 = ((scrollY + viewportSecs()) / PROJECT_DURATION) * (H - TRACK_TITLE_H - 4) + TRACK_TITLE_H + 2;
      if (y >= thumbT0 && y <= thumbT1) {
        drag = { kind: 'thumb', startScroll: scrollY, startCanvasY: y };
      } else {
        scrollY = wantScroll;
        clampScroll();
        drag = { kind: 'thumb', startScroll: scrollY, startCanvasY: y };
      }
      syncButton();
      if (!playing) render();
      return;
    }

    if (inTimeAxis(x, y)) {
      playhead = scrollY + (y - TRACK_TITLE_H) / zoom;
      clampPlayhead();
      syncButton();
      if (!playing) render();
      return;
    }

    // Pin drag takes precedence over edge trim (pins sit just outside clip edges).
    const pinHit = hitTestPin(x, y);
    if (pinHit) {
      const inter = INTER_MODEL.find((i) => i.kind === 'music' && i.id === pinHit.musicId);
      if (inter) {
        canvas.setPointerCapture(e.pointerId);
        drag = {
          kind: 'pin',
          musicId: pinHit.musicId,
          pinId: pinHit.pinId,
          initialSrc: inter.pins[pinHit.pinId],
          startCanvasY: y,
        };
        canvas.style.cursor = 'ns-resize';
      }
      return;
    }

    const edgeItem = hitTestMainEdge(x, y);
    if (edgeItem) {
      canvas.setPointerCapture(e.pointerId);
      drag = { kind: 'trim-edge', target: edgeItem, startDur: edgeItem.duration, startCanvasY: y };
      canvas.style.cursor = 'ns-resize';
      return;
    }

    if (inTranscript(x, y)) {
      const docY = (y - TRACK_TITLE_H) + currentTransScrollY();
      const line = TRANSCRIPT.lines.find((l) => l.y <= docY && docY < l.y + LINE_PIXEL_HEIGHT);
      if (!line) return;
      if (line.kind === 'speech' && line.words) {
        const localX = x - (COL_TRANS_X + 4);
        let target = line.words[0];
        for (const w of line.words) {
          if (w.xOffset <= localX) target = w;
          else break;
        }
        playhead = target.tStart;
      } else {
        playhead = line.tStart;
      }
      clampPlayhead();
      syncButton();
      if (!playing) render();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const { x, y } = eventToCanvas(e);

    if (!drag) {
      const wasOverview = hoverOverview;
      const wasTrim     = hoverTrimEdge;
      const wasPin      = hoverPin;
      hoverOverview = inOverview(x, y);
      const pinHit = !hoverOverview ? hitTestPin(x, y) : null;
      hoverPin = pinHit;
      hoverTrimEdge = !hoverOverview && !pinHit && hitTestMainEdge(x, y) !== null;
      if (hoverOverview !== wasOverview || hoverTrimEdge !== wasTrim ||
          (hoverPin?.musicId ?? null) !== (wasPin?.musicId ?? null) ||
          (hoverPin?.pinId ?? null)   !== (wasPin?.pinId ?? null)) {
        canvas.style.cursor =
          hoverOverview ? 'grab' :
          hoverPin      ? 'ns-resize' :
          hoverTrimEdge ? 'ns-resize' :
          'default';
        if (!playing) render();
      }
    }

    if (drag && drag.kind === 'thumb') {
      const dy = y - drag.startCanvasY;
      const ovH = H - TRACK_TITLE_H - 4;
      scrollY = drag.startScroll + dy * (PROJECT_DURATION / ovH);
      clampScroll();
      canvas.style.cursor = 'grabbing';
      if (!playing) render();
    } else if (drag && drag.kind === 'trim-edge') {
      const dy = y - drag.startCanvasY;
      setItemDuration(drag.target, drag.startDur + dy / zoom);
      refreshAndClamp();
      canvas.style.cursor = 'ns-resize';
      if (!playing) render();
    } else if (drag && drag.kind === 'pin') {
      const inter = INTER_MODEL.find((i) => i.kind === 'music' && i.id === drag.musicId);
      if (!inter) return;
      const dT = (y - drag.startCanvasY) / zoom;
      const sign = pinSign(drag.pinId);
      const nextSrc = clampPinSrc(drag.pinId, drag.initialSrc + sign * dT, inter);
      inter.pins[drag.pinId] = nextSrc;
      refreshAndClamp();
      canvas.style.cursor = 'ns-resize';
      if (!playing) render();
    }
  });

  function endDrag(e) {
    if (!drag) return;
    drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    canvas.style.cursor =
      hoverOverview ? 'grab' :
      hoverPin      ? 'ns-resize' :
      hoverTrimEdge ? 'ns-resize' :
      'default';
    syncButton();
    if (!playing) render();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  playBtn.addEventListener('click', () => {
    if (playBtn.dataset.state === 'done') {
      playhead = 0;
      setPlaying(true);
      return;
    }
    setPlaying(!playing);
    if (!playing) render();
  });

  resetBtn.addEventListener('click', () => {
    setPlaying(false);
    preRollGap = INITIAL_PRE_ROLL_GAP;
    for (let i = 0; i < SPEECH_MODEL.length; i++) {
      SPEECH_MODEL[i].duration = INITIAL_SPEECH_DURATIONS[i];
    }
    for (let i = 0; i < INTER_MODEL.length; i++) {
      const init = INITIAL_INTER_STATE[i];
      if (init.kind === 'gap') {
        INTER_MODEL[i] = { kind: 'gap', duration: init.duration };
      } else {
        INTER_MODEL[i] = { kind: 'music', id: init.id, mDuration: init.mDuration, pins: { ...init.pins } };
      }
    }
    refresh();
    scrollY = 0;
    playhead = 0;
    zoom = DEFAULT_PX_PER_SECOND;
    syncButton();
    render();
  });

  // --- render ----------------------------------------------------------
  function render() {
    const ctx = setupCanvas(canvas, W, H);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    drawTrackTitles(ctx);

    const scrollAreaY = TRACK_TITLE_H;
    const scrollAreaH = H - scrollAreaY;
    const vSecs = viewportSecs();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, scrollAreaY, COL_OV_X + COL_OV_W + 2, scrollAreaH);
    ctx.clip();
    ctx.translate(0, scrollAreaY - scrollY * zoom);

    drawTrackLanes(ctx, zoom);
    drawTimeAxis(ctx, zoom, scrollY, vSecs);
    drawClips(ctx, zoom);
    drawPins(ctx, zoom, hoverPin, drag && drag.kind === 'pin' ? drag : null);

    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(COL_TRANS_X - 2, scrollAreaY, COL_TRANS_W + 4, scrollAreaH);
    ctx.clip();
    ctx.translate(0, scrollAreaY - currentTransScrollY());

    drawTranscriptDoc(ctx, playhead, scrollY, vSecs);

    ctx.restore();

    drawOverview(
      ctx, scrollAreaY, scrollAreaH, scrollY, vSecs, playhead,
      drag !== null || hoverOverview,
    );

    const playheadY = scrollAreaY + (playhead - scrollY) * zoom;
    if (playheadY >= scrollAreaY && playheadY <= H) {
      drawTimelinePlayhead(ctx, playheadY);
    }
  }

  syncButton();
  render();
}

// === DRAWING PRIMITIVES ====================================================

function drawTrackTitles(ctx) {
  ctx.save();
  ctx.fillStyle = COLORS.trackTitle;
  ctx.font = '500 10px -apple-system, system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = COLORS.trackBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TRACK_TITLE_H - 0.5);
  ctx.lineTo(W, TRACK_TITLE_H - 0.5);
  ctx.stroke();
  ctx.fillText('TIME',       COL_TIME_X + 4,             TRACK_TITLE_H - 6);
  ctx.fillText('MAIN AUDIO', COL_MAIN_X + CLIP_INNER_X,  TRACK_TITLE_H - 6);
  ctx.fillText('MUSIC',      COL_MUSIC_X + CLIP_INNER_X, TRACK_TITLE_H - 6);
  ctx.fillText('TRANSCRIPT', COL_TRANS_X + 4,            TRACK_TITLE_H - 6);
  ctx.restore();
}

function drawTrackLanes(ctx, zoom) {
  const totalH = PROJECT_DURATION * zoom;
  ctx.fillStyle = COLORS.timeAxisBg;
  ctx.fillRect(COL_TIME_X, 0, COL_TIME_W, totalH);
  ctx.fillStyle = COLORS.trackLaneMain;
  ctx.fillRect(COL_MAIN_X, 0, COL_MAIN_W, totalH);
  ctx.fillStyle = COLORS.trackLaneMus;
  ctx.fillRect(COL_MUSIC_X, 0, COL_MUSIC_W, totalH);

  ctx.strokeStyle = COLORS.trackBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(COL_MAIN_X - COL_GAP_TIME / 2, 0);
  ctx.lineTo(COL_MAIN_X - COL_GAP_TIME / 2, totalH);
  ctx.moveTo(COL_OV_X - COL_GAP_OV / 2, 0);
  ctx.lineTo(COL_OV_X - COL_GAP_OV / 2, totalH);
  ctx.stroke();
}

function pickTickInterval(visibleSecs) {
  const ideal = visibleSecs / 6;
  if (ideal < 1.5)  return 1;
  if (ideal < 3)    return 2;
  if (ideal < 7)    return 5;
  if (ideal < 12)   return 10;
  if (ideal < 22)   return 15;
  if (ideal < 45)   return 30;
  if (ideal < 90)   return 60;
  return 120;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawTimeAxis(ctx, zoom, scrollY, visibleSecs) {
  const interval = pickTickInterval(visibleSecs);
  const firstTick = Math.ceil(scrollY / interval) * interval;
  const lastTick  = Math.floor((scrollY + visibleSecs + interval) / interval) * interval;
  const start = Math.max(0, firstTick - interval);
  const end   = Math.min(PROJECT_DURATION, lastTick + interval);

  ctx.save();
  ctx.fillStyle = COLORS.timeAxisText;
  ctx.strokeStyle = COLORS.timeAxisTick;
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let t = start; t <= end; t += interval) {
    const y = t * zoom;
    ctx.beginPath();
    ctx.moveTo(COL_TIME_W - 5, y);
    ctx.lineTo(COL_TIME_W - 1, y);
    ctx.stroke();
    ctx.fillText(formatTime(t), COL_TIME_W - 7, y);
  }
  ctx.restore();
}

function drawClips(ctx, zoom) {
  for (const s of SPEECH) {
    drawMainClip(ctx, zoom, s.start, s.duration);
  }
  for (const g of RESOLVED_GAPS) {
    drawGap(ctx, zoom, g.start, g.duration);
  }
  for (const m of RESOLVED_MUSIC) {
    drawMusicClip(ctx, zoom, m.start, m.duration);
  }
}

function drawMainClip(ctx, zoom, startSec, durSec) {
  const x = COL_MAIN_X + CLIP_INNER_X;
  const w = COL_MAIN_W - 2 * CLIP_INNER_X;
  const y = startSec * zoom;
  const h = durSec * zoom;
  if (h < 1) return;

  ctx.save();
  ctx.fillStyle = COLORS.mainFill;
  ctx.strokeStyle = COLORS.mainStroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();

  const tbH = Math.min(10, h * 0.18);
  if (tbH > 4) {
    topRoundedRect(ctx, x, y, w, tbH, 3);
    ctx.fillStyle = COLORS.mainTop;
    ctx.fill();
    if (w > 22 && tbH > 7) {
      ctx.fillStyle = COLORS.mainText;
      ctx.font = '500 8px -apple-system, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('voice', x + 4, y + tbH / 2 + 0.5);
    }
  }
  drawWaveform(ctx, zoom, x + 2, y + tbH + 2, w - 4, h - tbH - 4, startSec, COLORS.mainText, 'speech');
  ctx.restore();
}

function drawMusicClip(ctx, zoom, startSec, durSec) {
  const x = COL_MUSIC_X + CLIP_INNER_X;
  const w = COL_MUSIC_W - 2 * CLIP_INNER_X;
  const y = startSec * zoom;
  const h = durSec * zoom;
  if (h < 1) return;

  ctx.save();
  ctx.fillStyle = COLORS.musicFill;
  ctx.strokeStyle = COLORS.musicStroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();
  drawWaveform(ctx, zoom, x + 2, y + 2, w - 4, h - 4, startSec, COLORS.musicText, 'music');
  if (h > 18) {
    ctx.fillStyle = COLORS.musicText;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('♪ music', x + w / 2, y + h / 3);
  }
  ctx.restore();
}

function drawGap(ctx, zoom, startSec, durSec) {
  const x = COL_MAIN_X + CLIP_INNER_X;
  const w = COL_MAIN_W - 2 * CLIP_INNER_X;
  const y = startSec * zoom;
  const h = durSec * zoom;
  if (h < 2) return;

  ctx.save();
  ctx.fillStyle = COLORS.gapFill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.gapBorder;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.setLineDash([]);
  if (h > 22) {
    ctx.fillStyle = COLORS.gapText;
    ctx.font = '9px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('gap', x + w / 2, y + h / 2);
  }
  ctx.restore();
}

// Pseudo-waveform. Two ingredients combine per sample:
//   - Envelope: slow modulation. Speech = syllable-like bursts with brief
//     near-silences; music = sustained level with slow swells.
//   - High-frequency: multi-octave sines stand in for sample-to-sample
//     variation, so each line has a different amplitude from its
//     neighbours rather than just tracing a smooth curve.
function drawWaveform(ctx, zoom, x, y, w, h, seedSec, color, kind) {
  if (w < 2 || h < 4) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const halfH = (h - 4) / 2;
  const cx = x + w / 2;
  ctx.strokeStyle = color;
  ctx.globalAlpha = kind === 'speech' ? 0.42 : 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath();

  const stepPx = 1.3;
  for (let py = y + 2; py <= y + h - 2; py += stepPx) {
    const t = seedSec + (py - y) / zoom;

    let env;
    if (kind === 'speech') {
      const s1 = Math.sin(t * 6.1 + 1.7) * 0.5 + 0.5;
      const s2 = Math.sin(t * 2.3 + 4.3) * 0.5 + 0.5;
      const s3 = Math.sin(t * 0.7 + 9.1) * 0.5 + 0.5;
      env = Math.pow(s1, 1.6) * Math.pow(s2, 0.8) * (0.4 + 0.6 * s3);
      if (env < 0.06) env = 0.04;
    } else {
      const slow  = Math.sin(t * 0.45 + 2.1) * 0.5 + 0.5;
      const swell = Math.sin(t * 0.18 + 0.7) * 0.5 + 0.5;
      env = 0.45 + 0.55 * (0.6 * slow + 0.4 * swell);
    }

    const hf =
      Math.sin(t *  53 + seedSec *  7.3) * 0.32 +
      Math.sin(t *  27 + seedSec *  3.1) * 0.28 +
      Math.sin(t *  13 + seedSec *  5.7) * 0.22 +
      Math.sin(t *  79 + seedSec * 11.3) * 0.10 +
      Math.sin(t * 191 + seedSec * 17.7) * 0.08;

    const amp = halfH * env * (0.15 + 0.85 * Math.abs(hf));
    ctx.moveTo(cx - amp, py);
    ctx.lineTo(cx + amp, py);
  }
  ctx.stroke();
  ctx.restore();
}

// Pin pair rendering: dashed connector at the tie's project-time across
// the gap between main and music columns, plus a triangular handle on
// each side. Speech-side triangles point right (apex at main column's
// right edge); music-side triangles point left (apex at music column's
// left edge).
function drawPins(ctx, zoom, hoverPin, activePinDrag) {
  const xMainRight = COL_MAIN_X + COL_MAIN_W - CLIP_INNER_X;
  const xMusicLeft = COL_MUSIC_X + CLIP_INNER_X;

  for (const m of RESOLVED_MUSIC) {
    const ties = [
      { proj: m.leftPinProj,  speechPinId: 'aLeftTie',  musicPinId: 'mLeftTie',  color: COLORS.pinLeft },
      { proj: m.rightPinProj, speechPinId: 'bRightTie', musicPinId: 'mRightTie', color: COLORS.pinRight },
    ];
    for (const t of ties) {
      const y = t.proj * zoom;

      // Dashed connector between the two pin tails.
      ctx.save();
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(xMainRight + PIN_ARROW_H, y);
      ctx.lineTo(xMusicLeft - PIN_ARROW_H, y);
      ctx.stroke();
      ctx.restore();

      const speechActive =
        (hoverPin && hoverPin.musicId === m.id && hoverPin.pinId === t.speechPinId) ||
        (activePinDrag && activePinDrag.musicId === m.id && activePinDrag.pinId === t.speechPinId);
      const musicActive =
        (hoverPin && hoverPin.musicId === m.id && hoverPin.pinId === t.musicPinId) ||
        (activePinDrag && activePinDrag.musicId === m.id && activePinDrag.pinId === t.musicPinId);

      drawPinHandle(ctx, xMainRight, y, 'right', t.color, speechActive);
      drawPinHandle(ctx, xMusicLeft, y, 'left',  t.color, musicActive);
    }
  }
}

function drawPinHandle(ctx, apexX, apexY, direction, color, highlighted) {
  const grow = highlighted ? 1.2 : 0;
  const halfH = PIN_ARROW_HW + grow;
  const baseX = direction === 'right' ? apexX + PIN_ARROW_H + grow : apexX - PIN_ARROW_H - grow;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(baseX, apexY - halfH);
  ctx.lineTo(baseX, apexY + halfH);
  ctx.closePath();
  ctx.fill();
  if (highlighted) {
    ctx.strokeStyle = COLORS.pinHover;
    ctx.lineWidth = 1.3;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

function drawTranscriptDoc(ctx, playhead, timelineScrollY, viewportSecsValue) {
  const tStart = timelineScrollY;
  const tEnd   = timelineScrollY + viewportSecsValue;

  let first = null;
  let last  = null;
  for (const l of TRANSCRIPT.lines) {
    if (l.tEnd > tStart && l.tStart < tEnd) {
      if (first === null) first = l;
      last = l;
    }
  }
  if (first && last) {
    const yTop = first.y - 2;
    const yBot = last.y + LINE_PIXEL_HEIGHT + 2;
    ctx.save();
    ctx.fillStyle = COLORS.highlightFill;
    roundRect(ctx, COL_TRANS_X + 1, yTop, COL_TRANS_W - 2, yBot - yTop, 4);
    ctx.fill();
    ctx.strokeStyle = COLORS.highlightStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.textBaseline = 'top';
  for (const line of TRANSCRIPT.lines) {
    ctx.font = line.font;
    ctx.fillStyle = line.kind === 'music' ? COLORS.transcriptLabel : COLORS.transcriptText;
    ctx.fillText(line.text, COL_TRANS_X + 4, line.y);
  }
  ctx.restore();

  const speechLine = TRANSCRIPT.lines.find(
    (l) => l.kind === 'speech' && l.tStart <= playhead && playhead < l.tEnd,
  );
  if (speechLine && speechLine.words && speechLine.words.length > 0) {
    let xOff = speechLine.words[0].xOffset;
    for (const w of speechLine.words) {
      if (w.tStart <= playhead) xOff = w.xOffset;
      else break;
    }
    ctx.save();
    ctx.strokeStyle = COLORS.playhead;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(255, 215, 0, 0.55)';
    ctx.shadowBlur = 3;
    const x = COL_TRANS_X + 4 + xOff;
    ctx.beginPath();
    ctx.moveTo(x, speechLine.y - 2);
    ctx.lineTo(x, speechLine.y + LINE_PIXEL_HEIGHT - 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawOverview(ctx, scrollAreaY, scrollAreaH, scrollY, viewportSecsValue, playheadT, hot) {
  ctx.save();
  ctx.fillStyle = COLORS.overviewBg;
  ctx.fillRect(COL_OV_X, scrollAreaY, COL_OV_W, scrollAreaH);
  ctx.strokeStyle = COLORS.overviewBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(COL_OV_X + 0.5, scrollAreaY + 0.5, COL_OV_W - 1, scrollAreaH - 1);

  const ovTopY = scrollAreaY + 2;
  const ovBotY = scrollAreaY + scrollAreaH - 2;
  const ovH = ovBotY - ovTopY;
  const yFor = (sec) => ovTopY + (sec / PROJECT_DURATION) * ovH;

  const innerX = COL_OV_X + 3;
  const innerW = COL_OV_W - 6;
  const colW = (innerW - 1) / 2;
  const mainColX = innerX;
  const musColX = innerX + colW + 1;

  ctx.fillStyle = COLORS.overviewMain;
  for (const c of SPEECH) {
    const y0 = yFor(c.start);
    const y1 = yFor(c.start + c.duration);
    ctx.fillRect(mainColX, y0, colW, Math.max(0.7, y1 - y0));
  }
  ctx.fillStyle = COLORS.overviewMusic;
  for (const c of RESOLVED_MUSIC) {
    const y0 = yFor(c.start);
    const y1 = yFor(c.start + c.duration);
    ctx.fillRect(musColX, y0, colW, Math.max(1, y1 - y0));
  }

  // Clamp the thumb to the project bounds — when scrollY is negative or
  // the viewport extends past project end (zoomed out beyond project),
  // the thumb should still only cover the project-visible portion.
  const thumbT0 = Math.max(0, scrollY);
  const thumbT1 = Math.min(PROJECT_DURATION, scrollY + viewportSecsValue);
  const thumbX = COL_OV_X + 1;
  const thumbY = yFor(thumbT0);
  const thumbW = COL_OV_W - 2;
  const thumbH = Math.max(6, yFor(thumbT1) - thumbY);
  const rr = 3;

  roundRect(ctx, thumbX, thumbY, thumbW, thumbH, rr);
  ctx.fillStyle = COLORS.thumbFill;
  ctx.fill();

  const shineH = Math.min(thumbH * 0.45, 14);
  if (shineH > 2) {
    const grad = ctx.createLinearGradient(0, thumbY, 0, thumbY + shineH);
    grad.addColorStop(0, COLORS.thumbShine);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    roundRect(ctx, thumbX, thumbY, thumbW, shineH, rr);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  roundRect(ctx, thumbX + 0.5, thumbY + 0.5, thumbW - 1, thumbH - 1, rr);
  ctx.strokeStyle = hot ? COLORS.thumbBorderHot : COLORS.thumbBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  const phY = yFor(playheadT);
  ctx.strokeStyle = COLORS.playhead;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(255, 215, 0, 0.55)';
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.moveTo(COL_OV_X + 1, phY);
  ctx.lineTo(COL_OV_X + COL_OV_W - 1, phY);
  ctx.stroke();
  ctx.restore();
}

function drawTimelinePlayhead(ctx, y) {
  ctx.save();
  ctx.strokeStyle = COLORS.playhead;
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(255, 215, 0, 0.55)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(COL_MUSIC_X + COL_MUSIC_W, y);
  ctx.stroke();
  ctx.restore();
}

// === MATH HELPERS ==========================================================

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

function topRoundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
