// Skip regions: the same project as clip-fragmentation.js, but with the
// edits represented as skip markers inside three long source clips
// instead of a dozen detached fragments.
//
// Two things to interact with after Play:
//   - Each skip marker has a small disclosure chevron. Click it (or the
//     marker line itself) to unfold the skip — its hidden source audio
//     reappears in place as a translucent red zone, with drag handles
//     at either end so you can adjust the skip's boundaries.
//   - Pressing Play adds one more skip at host1 source 3.0–3.3, with
//     the same fade-in / cut-and-collapse animation as
//     clip-fragmentation so the two figures play back as a pair.

import { setupCanvas } from '../lib/timeline-render.js';
import { Spring, loop } from '../lib/spring.js';

// === MODEL ============================================================

const SOURCE_CLIPS = [
  { id: 'host1', label: 'host',  sourceLength: 8 },
  { id: 'guest', label: 'guest', sourceLength: 6 },
  { id: 'host2', label: 'host',  sourceLength: 5 },
];

const INITIAL_SKIPS = [
  // host1: 4 skips
  { id: 'sh1a', clipId: 'host1', start: 1.5, end: 2.0 },
  { id: 'sh1b', clipId: 'host1', start: 4.0, end: 4.5 },
  { id: 'sh1c', clipId: 'host1', start: 5.4, end: 5.6 },
  { id: 'sh1d', clipId: 'host1', start: 6.5, end: 7.0 },
  // guest: 4 skips, two of them clustered close (3.0–3.2 and 3.7–3.9)
  { id: 'sga',  clipId: 'guest', start: 2.0, end: 2.5 },
  { id: 'sgb',  clipId: 'guest', start: 3.0, end: 3.2 },
  { id: 'sgc',  clipId: 'guest', start: 3.7, end: 3.9 },
  { id: 'sgd',  clipId: 'guest', start: 4.5, end: 5.0 },
  // host2: 1 skip
  { id: 'sh2',  clipId: 'host2', start: 2.0, end: 2.5 },
];

// One more skip added by the Play animation.
const NEW_SKIP = { id: 'snew', clipId: 'host1', start: 3.0, end: 3.3 };

// === CONSTANTS ========================================================

const MIN_SKIP_DUR  = 0.3;
const EDGE_HIT_PX   = 8;
const MARKER_HIT_PX = 10;

const PADDING_X      = 14;
const PX_PER_SECOND  = 32;
const RULER_Y        = 12;
const RULER_LABEL_Y  = 22;
const TRACK_Y        = 32;
const TRACK_H        = 36;
const HEIGHT         = TRACK_Y + TRACK_H + 6;
const TITLE_BAR_H    = 11;

const COLORS = {
  bg:          '#1b1d22',
  trackLane:   'rgba(255, 255, 255, 0.025)',
  trackBorder: 'rgba(255, 255, 255, 0.05)',
  ruler:       '#3d4046',
  rulerText:   '#7a7e85',
  speech:     { fill: '#3d8260', fillTop: '#2a5b43', stroke: '#15301f', text: '#e6f3ec' },
  cutFill:    'rgba(228, 96, 80, 0.45)',
  cutStroke:  'rgba(248, 130, 110, 0.9)',
  skipMarker: 'rgba(248, 130, 110, 0.75)',
  // Dimmed band on the ruler over an unfolded skip zone — shows that
  // those seconds of canvas don't correspond to any project-playback time.
  skipZone:   'rgba(228, 96, 80, 0.12)',
};

// Animation timing.
//   - The new skip is drawn out by the cursor: skip.end grows from
//     skip.start to its full value during `dragOut`.
//   - The preview overlay (red dashed rectangle) is visible from the
//     moment the cursor presses through the end of the cut-apply.
//   - The cut applies during `splitSlide` — applied animates 0→1, the
//     skip collapses, clips after it slide left.
const ANIM = {
  previewFadeIn:  [500,  600],   // matches the cursor press onset
  previewHold:    [600,  1600],  // through drag, hold, and post-release pause
  previewFadeOut: [1600, 1900],  // fades out as the cursor exits and cut applies
  dragOut:        [600,  1200],  // cursor drags out the new skip's source span
  splitSlide:     [1600, 2200],  // skip collapses; clips after slide left
};
const ANIM_DURATION = 2400;

// The cursor stays on stage throughout. Two visible scenes:
//   1. The cursor draws out the new skip at host1 source 3.0–3.3, then
//      exits while the cut applies.
//   2. The cursor returns and works on a different skip (sh1b at host1
//      source 4.0–4.5): clicks its marker to unfold, drags its right
//      edge to extend, then clicks back inside the unfolded body to
//      fold it again, and finally exits.
//
// Coordinates are in canvas-space pixels and assume the layout the
// engine produces at those points in time. For the cut:
//   - host1 already has sh1a applied; source 3.0 maps to project 2.5,
//     so canvas x ≈ 14 + 2.5*32 = 94. Source 3.3 → project 2.8 →
//     canvas x ≈ 104. Drag span: ~10 px.
// After the cut lands and host1's effective length shrinks:
//   - sh1b's marker sits at canvas x ≈ 116 (project 3.2).
//   - Unfolded, its right edge is at x ≈ 132 (project 3.7); after the
//     edit drag extends end to 4.7, the right edge sits at x ≈ 138
//     (project 3.9). The fold click targets the middle of the
//     unfolded body, x ≈ 127.
const DEMO_TIMES = {
  // Phase 1: cursor draws out the new skip
  cursorFadeInStart:  0,
  cursorFadeInEnd:    200,
  approachDragStart:  500,
  dragPress:          600,
  dragRelease:        1300,
  postDragHoldEnd:    1600,
  postDragExitEnd:    1900,
  // Cursor invisible while cut applies (1900–2400)
  // Phase 2: cursor returns to edit sh1b
  cursorFadeInStart2: 2400,
  cursorFadeInEnd2:   2900,
  approachMarker:     3700,
  markerPress:        3850,
  markerRelease:      3900,
  unfoldSettleEnd:    4400,
  approachEdge:       4900,
  edgePress:          5050,
  dragEdgeEnd:        6000,
  edgeRelease:        6100,
  postEditHoldEnd:    6700,
  // Phase 3: cursor folds the unfolded skip back
  approachFold:       7200,
  foldPress:          7350,
  foldRelease:        7400,
  foldSettleEnd:      7900,
  // Phase 4: exit
  cursorFadeOutStart: 8300,
  cursorFadeOutEnd:   8600,
};
const DEMO_END_TIME = 8700;

const CURSOR_SCHEDULE = [
  // Phase 1: draw out the new skip
  { t: DEMO_TIMES.cursorFadeInStart,  cx: 350, cy: 18, p: false, o: 0, ease: 'linear'    },
  { t: DEMO_TIMES.cursorFadeInEnd,    cx: 350, cy: 18, p: false, o: 1, ease: 'easeOut'   },
  { t: DEMO_TIMES.approachDragStart,  cx:  94, cy: 50, p: false, o: 1, ease: 'easeInOut' },
  { t: DEMO_TIMES.dragPress,          cx:  94, cy: 50, p: true,  o: 1, ease: 'linear'    },
  // The drag itself runs from dragPress to dragRelease, ending at x≈104
  { t: 1200,                          cx: 104, cy: 50, p: true,  o: 1, ease: 'easeInOut' },
  { t: DEMO_TIMES.dragRelease,        cx: 104, cy: 50, p: false, o: 1, ease: 'linear'    },
  { t: DEMO_TIMES.postDragHoldEnd,    cx: 104, cy: 50, p: false, o: 1, ease: 'linear'    },
  { t: DEMO_TIMES.postDragExitEnd,    cx: 350, cy: 18, p: false, o: 0, ease: 'easeIn'    },
  // Phase 2: edit sh1b
  { t: DEMO_TIMES.cursorFadeInStart2, cx: 350, cy: 18, p: false, o: 0, ease: 'linear'    },
  { t: DEMO_TIMES.cursorFadeInEnd2,   cx: 350, cy: 18, p: false, o: 1, ease: 'easeOut'   },
  { t: DEMO_TIMES.approachMarker,     cx: 116, cy: 50, p: false, o: 1, ease: 'easeInOut' },
  { t: DEMO_TIMES.markerPress,        cx: 116, cy: 50, p: true,  o: 1, ease: 'linear'    },
  { t: DEMO_TIMES.markerRelease,      cx: 116, cy: 50, p: false, o: 1, ease: 'linear'    },
  { t: DEMO_TIMES.unfoldSettleEnd,    cx: 116, cy: 50, p: false, o: 1, ease: 'linear'    },
  { t: DEMO_TIMES.approachEdge,       cx: 132, cy: 50, p: false, o: 1, ease: 'easeInOut' },
  { t: DEMO_TIMES.edgePress,          cx: 132, cy: 50, p: true,  o: 1, ease: 'linear'    },
  { t: DEMO_TIMES.dragEdgeEnd,        cx: 138, cy: 50, p: true,  o: 1, ease: 'easeInOut' },
  { t: DEMO_TIMES.edgeRelease,        cx: 138, cy: 50, p: false, o: 1, ease: 'linear'    },
  { t: DEMO_TIMES.postEditHoldEnd,    cx: 138, cy: 50, p: false, o: 1, ease: 'linear'    },
  // Phase 3: collapse fold
  { t: DEMO_TIMES.approachFold,       cx: 127, cy: 50, p: false, o: 1, ease: 'easeInOut' },
  { t: DEMO_TIMES.foldPress,          cx: 127, cy: 50, p: true,  o: 1, ease: 'linear'    },
  { t: DEMO_TIMES.foldRelease,        cx: 127, cy: 50, p: false, o: 1, ease: 'linear'    },
  { t: DEMO_TIMES.foldSettleEnd,      cx: 127, cy: 50, p: false, o: 1, ease: 'linear'    },
  // Phase 4: exit
  { t: DEMO_TIMES.cursorFadeOutStart, cx: 350, cy: 18, p: false, o: 1, ease: 'easeIn'    },
  { t: DEMO_TIMES.cursorFadeOutEnd,   cx: 350, cy: 18, p: false, o: 0, ease: 'linear'    },
];

const DEMO_TARGET_SKIP_ID = 'sh1b';
const DEMO_DRAG_FROM_END  = 4.5;
const DEMO_DRAG_TO_END    = 4.7;

// === ENTRY POINT ======================================================

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

  const host       = root.querySelector('[data-role="canvas-host"]');
  const playBtn    = root.querySelector('[data-action="play"]');
  const resetBtn   = root.querySelector('[data-action="reset"]');
  const playLabel  = root.querySelector('[data-role="play-label"]');

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display: block; border-radius: 5px;';
  host.appendChild(canvas);

  let cssWidth   = host.clientWidth || 600;
  let currentSkips = INITIAL_SKIPS.map((s) => makeSkip(s, 1));
  let animState  = 'idle';
  let animStart  = 0;
  let stopLoop   = null;
  let hover      = null;
  let drag       = null;

  // Demo cursor — scripted after the main cut animation finishes.
  const demoCursor = { cx: 0, cy: 0, pressed: false, opacity: 0, visible: false };
  // Tracks which one-shot demo events have fired (so we set unfold etc.
  // exactly once per playback).
  let demoFired = { unfoldTarget: false, dragFinalized: false, foldTarget: false };

  function makeSkip(def, applied) {
    return {
      id: def.id,
      clipId: def.clipId,
      start: def.start,
      end: def.end,
      applied,
      unfold: new Spring(0, { stiffness: 200, damping: 24 }),
    };
  }

  function setState(s) {
    animState = s;
    playBtn.dataset.state = s;
    playBtn.disabled = s === 'playing';
    playLabel.textContent = s === 'playing' ? 'Playing' : s === 'done' ? 'Replay' : 'Play';
    playBtn.setAttribute('aria-label', playLabel.textContent);
  }

  function startLoop() {
    if (stopLoop) return;
    stopLoop = loop((dt) => {
      let active = false;

      if (animState === 'playing') {
        const elapsed = performance.now() - animStart;
        const newSkip = currentSkips.find((s) => s.id === NEW_SKIP.id);
        if (elapsed >= DEMO_END_TIME) {
          // Whole sequence done: snap final state, hide cursor.
          if (newSkip) { newSkip.applied = 1; newSkip.end = NEW_SKIP.end; }
          demoCursor.visible = false;
          setState('done');
        } else {
          // The cursor is on screen throughout — same schedule drives
          // both the cut animation (drag-out + collapse) and the
          // edit-then-fold demo. `runDemoTriggers` walks the time and
          // mutates state at the right moments.
          active = true;
          applyCursorSchedule(elapsed);
          runDemoTriggers(elapsed);
        }
      }

      for (const s of currentSkips) {
        if (s.unfold.tick(dt)) active = true;
      }

      render();
      if (!active) { stopLoop = null; return false; }
      return true;
    });
  }

  function applyCursorSchedule(elapsed) {
    let i = 0;
    while (i < CURSOR_SCHEDULE.length - 1 && CURSOR_SCHEDULE[i + 1].t <= elapsed) i++;
    if (i >= CURSOR_SCHEDULE.length - 1) {
      const last = CURSOR_SCHEDULE[CURSOR_SCHEDULE.length - 1];
      demoCursor.cx = last.cx;
      demoCursor.cy = last.cy;
      demoCursor.pressed = last.p;
      demoCursor.opacity = last.o;
    } else {
      const a = CURSOR_SCHEDULE[i];
      const b = CURSOR_SCHEDULE[i + 1];
      const span = b.t - a.t;
      const tNorm = span > 0 ? Math.min(1, Math.max(0, (elapsed - a.t) / span)) : 1;
      const eased = applyEase(tNorm, b.ease);
      demoCursor.cx = lerp(a.cx, b.cx, eased);
      demoCursor.cy = lerp(a.cy, b.cy, eased);
      demoCursor.opacity = lerp(a.o, b.o, eased);
      demoCursor.pressed = b.p;
    }
    demoCursor.visible = demoCursor.opacity > 0.01;
  }

  // Continuous + one-shot triggers — fire the simulated mouse
  // interactions at fixed elapsed times. The drag phases continuously
  // mutate skip bounds so the visible right edge tracks the cursor.
  function runDemoTriggers(elapsed) {
    const newSkip = currentSkips.find((s) => s.id === NEW_SKIP.id);
    if (newSkip) {
      // Phase 1a: drag-out — skip.end grows from skip.start to its
      // final value as the cursor drags rightward.
      const [d0, d1] = ANIM.dragOut;
      if (elapsed < d0) {
        newSkip.end = NEW_SKIP.start;
      } else if (elapsed < d1) {
        const tNorm = (elapsed - d0) / (d1 - d0);
        newSkip.end = lerp(NEW_SKIP.start, NEW_SKIP.end, applyEase(tNorm, 'easeOut'));
      } else {
        newSkip.end = NEW_SKIP.end;
      }
      // Phase 1b: cut applies — skip.applied animates 0→1, collapsing
      // the visible width and sliding everything after left.
      const [s0, s1] = ANIM.splitSlide;
      if (elapsed < s0) {
        newSkip.applied = 0;
      } else if (elapsed < s1) {
        newSkip.applied = computeSlideProgress(elapsed);
      } else {
        newSkip.applied = 1;
      }
    }

    const target = currentSkips.find((s) => s.id === DEMO_TARGET_SKIP_ID);
    if (!target) return;

    // Phase 2: cursor clicks sh1b's marker to unfold it.
    if (!demoFired.unfoldTarget && elapsed >= DEMO_TIMES.markerPress) {
      target.unfold.set(1);
      demoFired.unfoldTarget = true;
    }

    // Phase 2 (continued): cursor drags sh1b's right edge to extend the skip.
    if (elapsed >= DEMO_TIMES.edgePress && elapsed < DEMO_TIMES.dragEdgeEnd) {
      const span = DEMO_TIMES.dragEdgeEnd - DEMO_TIMES.edgePress;
      const tNorm = Math.min(1, Math.max(0, (elapsed - DEMO_TIMES.edgePress) / span));
      const eased = applyEase(tNorm, 'easeInOut');
      target.end = lerp(DEMO_DRAG_FROM_END, DEMO_DRAG_TO_END, eased);
    } else if (!demoFired.dragFinalized && elapsed >= DEMO_TIMES.dragEdgeEnd) {
      target.end = DEMO_DRAG_TO_END;
      demoFired.dragFinalized = true;
    }

    // Phase 3: cursor clicks inside the unfolded body to fold it back.
    if (!demoFired.foldTarget && elapsed >= DEMO_TIMES.foldPress) {
      target.unfold.set(0);
      demoFired.foldTarget = true;
    }
  }

  // User pointer input takes over from the demo: snap demo to its final
  // state and let the click proceed normally.
  function cancelDemoIfActive() {
    if (animState !== 'playing') return;
    const newSkip = currentSkips.find((s) => s.id === NEW_SKIP.id);
    if (newSkip) {
      newSkip.applied = 1;
      newSkip.end = NEW_SKIP.end;
    }
    const target = currentSkips.find((s) => s.id === DEMO_TARGET_SKIP_ID);
    if (target) {
      target.end = DEMO_DRAG_TO_END;
      target.unfold.set(0); // fold back so the layout is coherent
    }
    demoCursor.visible = false;
    demoFired = { unfoldTarget: true, dragFinalized: true, foldTarget: true };
    setState('done');
  }

  function reset() {
    if (stopLoop) { stopLoop(); stopLoop = null; }
    currentSkips = INITIAL_SKIPS.map((s) => makeSkip(s, 1));
    hover = null;
    drag = null;
    demoCursor.visible = false;
    demoCursor.opacity = 0;
    demoFired = { unfoldTarget: false, dragFinalized: false, foldTarget: false };
    setState('idle');
    render();
  }

  function play() {
    if (stopLoop) { stopLoop(); stopLoop = null; }
    // Restore initial skips + fold them all, then add a fresh new skip
    // with applied = 0 ready to be animated in.
    currentSkips = INITIAL_SKIPS.map((s) => makeSkip(s, 1));
    currentSkips.push(makeSkip(NEW_SKIP, 0));
    hover = null;
    drag = null;
    demoCursor.visible = false;
    demoCursor.opacity = 0;
    demoFired = { unfoldTarget: false, dragFinalized: false, foldTarget: false };
    setState('playing');
    animStart = performance.now();
    startLoop();
  }

  // === ANIMATION HELPERS ==============================================

  function computeSlideProgress(elapsed) {
    const [t0, t1] = ANIM.splitSlide;
    if (elapsed <= t0) return 0;
    if (elapsed >= t1) return 1;
    return easeInOut((elapsed - t0) / (t1 - t0));
  }

  function computePreviewOpacity(elapsed) {
    const [fi0, fi1] = ANIM.previewFadeIn;
    const [, fh1]    = ANIM.previewHold;
    const [fo0, fo1] = ANIM.previewFadeOut;
    if (elapsed < fi0) return 0;
    if (elapsed < fi1) return easeOut((elapsed - fi0) / (fi1 - fi0));
    if (elapsed < fh1) return 1;
    if (elapsed < fo1) return 1 - easeOut((elapsed - fo0) / (fo1 - fo0));
    return 0;
  }

  // === LAYOUT =========================================================

  // For each source clip, walk its skips in order and emit visible
  // project-space segments. A skip's visible width depends on its
  // applied amount (animation progress) AND its unfold value (user
  // expanded it back open):
  //   visibleWidth = duration * (1 - applied * (1 - unfold))
  function layout() {
    const skipsByClip = {};
    for (const s of currentSkips) {
      if (!skipsByClip[s.clipId]) skipsByClip[s.clipId] = [];
      skipsByClip[s.clipId].push(s);
    }
    for (const k in skipsByClip) skipsByClip[k].sort((a, b) => a.start - b.start);

    const result = [];
    let projectCursor = 0;
    for (const src of SOURCE_CLIPS) {
      const skips = skipsByClip[src.id] || [];
      const { segments, markers, projectEnd } = visibleSegments(src, skips, projectCursor);
      result.push({
        ...src,
        projectStart: projectCursor,
        projectEnd,
        segments,
        markers,
      });
      projectCursor = projectEnd;
    }
    return result;
  }

  // === HIT-TESTING ====================================================

  function hitTest(x, y) {
    if (y < TRACK_Y || y > TRACK_Y + TRACK_H) return null;
    const inBody = y > TRACK_Y + TITLE_BAR_H;
    const clips = layout();

    for (const clip of clips) {
      // Unfolded zones: edges + body
      for (const seg of clip.segments) {
        if (seg.kind !== 'skip') continue;
        const skip = currentSkips.find((s) => s.id === seg.skipId);
        if (!skip || skip.applied < 0.5) continue; // ignore in-progress
        if (skip.unfold.value < 0.5) continue;
        const left  = PADDING_X + seg.projectStart * PX_PER_SECOND;
        const right = PADDING_X + seg.projectEnd   * PX_PER_SECOND;
        if (inBody && Math.abs(x - left)  <= EDGE_HIT_PX) return { kind: 'skip-edge', skipId: skip.id, side: 'start' };
        if (inBody && Math.abs(x - right) <= EDGE_HIT_PX) return { kind: 'skip-edge', skipId: skip.id, side: 'end' };
        if (x >= left - 4 && x <= right + 4) return { kind: 'skip-zone', skipId: skip.id };
      }
      // Folded markers
      for (const m of clip.markers) {
        const skip = currentSkips.find((s) => s.id === m.skipId);
        if (!skip || skip.applied < 0.5) continue;
        if (skip.unfold.value >= 0.5) continue;
        const markerX = PADDING_X + m.projectX * PX_PER_SECOND;
        if (Math.abs(x - markerX) <= MARKER_HIT_PX) return { kind: 'marker', skipId: skip.id };
      }
    }
    return null;
  }

  function cursorPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('mousemove', (e) => {
    if (drag) return;
    const { x, y } = cursorPos(e);
    const hit = hitTest(x, y);
    hover = hit;
    if      (hit?.kind === 'skip-edge') canvas.style.cursor = 'ew-resize';
    else if (hit?.kind === 'marker' || hit?.kind === 'skip-zone') canvas.style.cursor = 'pointer';
    else canvas.style.cursor = '';
    render();
  });

  canvas.addEventListener('mouseleave', () => {
    if (drag) return;
    hover = null;
    canvas.style.cursor = '';
    render();
  });

  canvas.addEventListener('mousedown', (e) => {
    cancelDemoIfActive();
    const { x, y } = cursorPos(e);
    const hit = hitTest(x, y);

    if (!hit) {
      // Click outside any skip — fold any currently-unfolded ones.
      let changed = false;
      for (const s of currentSkips) {
        if (s.unfold.target > 0.3) { s.unfold.set(0); changed = true; }
      }
      if (changed) startLoop();
      return;
    }

    e.preventDefault();
    const skip = currentSkips.find((s) => s.id === hit.skipId);
    if (!skip) return;

    if (hit.kind === 'marker') {
      skip.unfold.set(1);
      startLoop();
    } else if (hit.kind === 'skip-zone') {
      skip.unfold.set(0);
      startLoop();
    } else if (hit.kind === 'skip-edge') {
      drag = {
        skipId: skip.id,
        side: hit.side,
        startX: x,
        initialStart: skip.start,
        initialEnd: skip.end,
      };
      canvas.style.cursor = 'ew-resize';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const { x } = cursorPos(e);
    const dx = x - drag.startX;
    const dt = dx / PX_PER_SECOND;
    const skip = currentSkips.find((s) => s.id === drag.skipId);
    if (!skip) return;
    const src = SOURCE_CLIPS.find((c) => c.id === skip.clipId);

    // Bounds: stay within the source clip and don't overlap adjacent
    // skips in the same clip.
    const siblings = currentSkips
      .filter((s) => s.clipId === skip.clipId && s.id !== skip.id)
      .sort((a, b) => a.start - b.start);
    const prevSibling = siblings.filter((s) => s.end <= drag.initialStart).pop();
    const nextSibling = siblings.find((s) => s.start >= drag.initialEnd);
    const lo = prevSibling ? prevSibling.end : 0;
    const hi = nextSibling ? nextSibling.start : src.sourceLength;

    if (drag.side === 'start') {
      skip.start = clamp(drag.initialStart + dt, lo, drag.initialEnd - MIN_SKIP_DUR);
    } else {
      skip.end = clamp(drag.initialEnd + dt, drag.initialStart + MIN_SKIP_DUR, hi);
    }
    render();
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    drag = null;
    canvas.style.cursor = hover?.kind === 'skip-edge' ? 'ew-resize' : '';
  });

  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', reset);

  const ro = new ResizeObserver(() => {
    cssWidth = host.clientWidth || 600;
    render();
  });
  ro.observe(host);

  // === RENDER =========================================================

  function render() {
    const w = cssWidth;
    const ctx = setupCanvas(canvas, w, HEIGHT);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, HEIGHT);

    const clips = layout();

    // Ruler labels project (playback) time, not canvas position — so
    // each unfolded skip becomes a "break" the ruler skips over. Inside
    // each break the ruler dims and no ticks are drawn; after each
    // break, subsequent labels shift right by the break's visible width.
    const breaks = computeRulerBreaks(clips, currentSkips);
    drawRulerWithBreaks(ctx, PADDING_X, RULER_Y, w - PADDING_X * 2, breaks);

    ctx.fillStyle = COLORS.trackLane;
    ctx.fillRect(PADDING_X, TRACK_Y, w - PADDING_X * 2, TRACK_H);
    ctx.strokeStyle = COLORS.trackBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(PADDING_X + 0.5, TRACK_Y + 0.5, w - PADDING_X * 2 - 1, TRACK_H - 1);

    for (const clip of clips) {
      drawSourceClip(ctx, clip);
    }

    // Skip overlays + markers + chevrons, all drawn on top of clips.
    const previewOpacity = (animState === 'playing' || animState === 'done')
      ? computePreviewOpacity(performance.now() - animStart)
      : 0;

    for (const clip of clips) {
      // Visible-width skip segments — unfolded zones or in-progress preview.
      for (const seg of clip.segments) {
        if (seg.kind !== 'skip') continue;
        const skip = currentSkips.find((s) => s.id === seg.skipId);
        if (!skip) continue;
        const x = PADDING_X + seg.projectStart * PX_PER_SECOND;
        const wpx = (seg.projectEnd - seg.projectStart) * PX_PER_SECOND;
        if (wpx < 0.5) continue;

        if (skip.applied < 0.999) {
          // In-progress skip from the Play animation — dashed red preview.
          if (previewOpacity > 0.01) {
            ctx.save();
            ctx.globalAlpha = previewOpacity;
            ctx.fillStyle = COLORS.cutFill;
            roundRect(ctx, x, TRACK_Y + 1, wpx, TRACK_H - 2, 2);
            ctx.fill();
            ctx.strokeStyle = COLORS.cutStroke;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.restore();
          }
        } else {
          // Unfolded by the user — solid translucent zone, no border.
          ctx.save();
          ctx.globalAlpha = skip.unfold.value;
          ctx.fillStyle = COLORS.cutFill;
          roundRect(ctx, x, TRACK_Y + 1, wpx, TRACK_H - 2, 2);
          ctx.fill();
          ctx.restore();

          // Drag handles fade in during the last 30% of unfold.
          if (skip.unfold.value > 0.7) {
            const alpha = (skip.unfold.value - 0.7) / 0.3;
            for (const side of ['start', 'end']) {
              const hx = side === 'start' ? x : x + wpx;
              const isHot =
                (drag?.skipId === skip.id && drag?.side === side) ||
                (hover?.kind === 'skip-edge' && hover.skipId === skip.id && hover.side === side);
              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.strokeStyle = isHot ? '#fff' : COLORS.cutStroke;
              ctx.lineWidth = isHot ? 2.5 : 2;
              ctx.beginPath();
              ctx.moveTo(hx, TRACK_Y + 3);
              ctx.lineTo(hx, TRACK_Y + TRACK_H - 3);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }

      // Markers for fully-applied + folded skips.
      for (const m of clip.markers) {
        const skip = currentSkips.find((s) => s.id === m.skipId);
        if (!skip) continue;
        if (skip.applied < 0.5) continue;
        const unfoldVal = skip.unfold.value;
        if (unfoldVal > 0.99) continue;
        const x = PADDING_X + m.projectX * PX_PER_SECOND;
        const isHot = hover?.kind === 'marker' && hover.skipId === skip.id;
        ctx.save();
        ctx.globalAlpha = skip.applied * (1 - unfoldVal) * (isHot ? 1 : 0.85);
        ctx.strokeStyle = COLORS.skipMarker;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2.5]);
        ctx.beginPath();
        ctx.moveTo(x, TRACK_Y + 2);
        ctx.lineTo(x, TRACK_Y + TRACK_H - 2);
        ctx.stroke();
        ctx.restore();
      }

      // Chevrons: drawn at every fully-applied skip's "left edge"
      // (folded position = marker; unfolded position = left edge of
      // unfolded zone). Rotates from down (▼) to right (▶) as the skip
      // unfolds.
      drawChevrons(ctx, clip);
    }

    if (demoCursor.visible && demoCursor.opacity > 0.01) {
      drawDemoCursor(ctx, demoCursor.cx, demoCursor.cy, demoCursor.pressed, demoCursor.opacity);
    }
  }

  function drawChevrons(ctx, clip) {
    // Walk segments + markers in project order to find the x position
    // for each skip's left edge.
    const positions = []; // { skipId, projectX }
    for (const seg of clip.segments) {
      if (seg.kind === 'skip') positions.push({ skipId: seg.skipId, projectX: seg.projectStart });
    }
    for (const m of clip.markers) positions.push({ skipId: m.skipId, projectX: m.projectX });

    for (const p of positions) {
      const skip = currentSkips.find((s) => s.id === p.skipId);
      if (!skip) continue;
      if (skip.applied < 0.01) continue;

      const x = PADDING_X + p.projectX * PX_PER_SECOND;
      const cy = TRACK_Y + TITLE_BAR_H / 2 + 0.5;
      const sz = 3.5;
      const isHot =
        (hover?.kind === 'marker' && hover.skipId === skip.id) ||
        (hover?.kind === 'skip-zone' && hover.skipId === skip.id);
      const t = clamp(skip.unfold.value, 0, 1);

      ctx.save();
      ctx.globalAlpha = skip.applied * (isHot ? 1 : 0.8);
      ctx.translate(x, cy);
      // Start pointing down (PI/2), rotate to pointing right (0) as unfold goes 0→1.
      ctx.rotate((1 - t) * Math.PI / 2);
      ctx.fillStyle = isHot ? '#fff' : COLORS.cutStroke;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.lineTo(sz, 0);
      ctx.lineTo(0, sz);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  cssWidth = host.clientWidth || 600;
  render();
}

// === LAYOUT HELPERS ===================================================

// Threshold below which a skip is treated as already-collapsed (segments
// smaller than 1px don't render cleanly).
const APPLIED_THRESHOLD_PX = 1;

function visibleSegments(clip, skips, projectStart) {
  const segments = [];
  const markers = [];
  let sourceAcc = 0;
  let projAcc = projectStart;

  for (const s of skips) {
    if (s.start > sourceAcc) {
      const segLen = s.start - sourceAcc;
      segments.push({
        kind: 'audio',
        sourceStart: sourceAcc,
        sourceEnd: s.start,
        projectStart: projAcc,
        projectEnd: projAcc + segLen,
      });
      projAcc += segLen;
    }
    // Visible width — accounts for both the applied (collapse) state
    // and the user-driven unfold (revealing source content again).
    const dur = s.end - s.start;
    const visibleWidth = dur * (1 - s.applied * (1 - s.unfold.value));
    if (visibleWidth * PX_PER_SECOND > APPLIED_THRESHOLD_PX) {
      segments.push({
        kind: 'skip',
        sourceStart: s.start,
        sourceEnd: s.end,
        projectStart: projAcc,
        projectEnd: projAcc + visibleWidth,
        skipId: s.id,
      });
      projAcc += visibleWidth;
    } else {
      markers.push({ projectX: projAcc, skipId: s.id });
    }
    sourceAcc = s.end;
  }
  if (sourceAcc < clip.sourceLength) {
    const segLen = clip.sourceLength - sourceAcc;
    segments.push({
      kind: 'audio',
      sourceStart: sourceAcc,
      sourceEnd: clip.sourceLength,
      projectStart: projAcc,
      projectEnd: projAcc + segLen,
    });
    projAcc += segLen;
  }
  return { segments, markers, projectEnd: projAcc };
}

// === DRAWING HELPERS ==================================================

// Walk the layout to find unfolded skip segments. Each contributes a
// "break" (playbackTime, visibleWidth): the project-time at which the
// break starts (where the marker would be if folded), and how many
// canvas-seconds of unfolded skip body the ruler must skip over.
function computeRulerBreaks(clips, currentSkips) {
  const breaks = [];
  let playback = 0;
  for (const clip of clips) {
    for (const seg of clip.segments) {
      if (seg.kind === 'audio') {
        playback += seg.sourceEnd - seg.sourceStart;
      } else if (seg.kind === 'skip') {
        const skip = currentSkips.find((s) => s.id === seg.skipId);
        // Breaks come from skips that are *fully applied AND unfolded*
        // — in-progress (animating) skips don't break the ruler, and
        // folded skips have zero visible width so they wouldn't anyway.
        if (skip && skip.applied > 0.999 && skip.unfold.value > 0.01) {
          breaks.push({
            playbackTime: playback,
            visibleWidth: seg.projectEnd - seg.projectStart,
          });
        }
      }
    }
  }
  return breaks;
}

function drawRulerWithBreaks(ctx, x0, y, totalWidth, breaks) {
  ctx.save();
  ctx.strokeStyle = COLORS.ruler;
  ctx.fillStyle = COLORS.rulerText;
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.beginPath();
  ctx.moveTo(x0, y + 8);
  ctx.lineTo(x0 + totalWidth, y + 8);
  ctx.stroke();

  // Helper: for a given playback-time s, how many canvas-seconds of
  // accumulated break width sit before it.
  const shiftForS = (s) => {
    let shift = 0;
    for (const b of breaks) if (b.playbackTime < s) shift += b.visibleWidth;
    return shift;
  };

  // Dimmed bands for each unfolded zone.
  for (const b of breaks) {
    const zoneStartPx = x0 + (b.playbackTime + shiftForS(b.playbackTime)) * PX_PER_SECOND;
    const zoneWidthPx = b.visibleWidth * PX_PER_SECOND;
    if (zoneWidthPx > 1) {
      ctx.fillStyle = COLORS.skipZone;
      ctx.fillRect(zoneStartPx, y, zoneWidthPx, 16);
      ctx.fillStyle = COLORS.rulerText;
    }
  }

  // Ticks at every integer playback second. Each tick's x adds the
  // total break-width already passed.
  for (let s = 0; ; s += 1) {
    const visualX = x0 + (s + shiftForS(s)) * PX_PER_SECOND;
    if (visualX > x0 + totalWidth) break;
    const tall = s % 5 === 0;
    ctx.strokeStyle = COLORS.ruler;
    ctx.beginPath();
    ctx.moveTo(visualX, y + 8);
    ctx.lineTo(visualX, y + 8 + (tall ? 5 : 2.5));
    ctx.stroke();
    if (tall) {
      ctx.fillStyle = COLORS.rulerText;
      ctx.fillText(`${s}s`, visualX + 3, RULER_LABEL_Y);
    }
  }
  ctx.restore();
}

function drawSourceClip(ctx, clip) {
  const x = PADDING_X + clip.projectStart * PX_PER_SECOND;
  const w = (clip.projectEnd - clip.projectStart) * PX_PER_SECOND;
  if (w < 1) return;

  ctx.save();
  ctx.fillStyle = COLORS.speech.fill;
  ctx.strokeStyle = COLORS.speech.stroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, TRACK_Y, w, TRACK_H, 3);
  ctx.fill();
  ctx.stroke();

  topRoundedRect(ctx, x, TRACK_Y, w, TITLE_BAR_H, 3);
  ctx.fillStyle = COLORS.speech.fillTop;
  ctx.fill();

  if (w > 28) {
    ctx.fillStyle = COLORS.speech.text;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(clip.label, x + 5, TRACK_Y + TITLE_BAR_H / 2 + 0.5);
  }

  // Waveform — drawn for every segment, audio and skip alike, mapping
  // project-x to source-time per segment. For an audio segment the
  // mapping is 1:1; for a partially-applied or unfolded skip the segment
  // is narrower than its source span, so the waveform compresses
  // proportionally and reads as "the source audio in this skip".
  const bodyY = TRACK_Y + TITLE_BAR_H;
  const bodyH = TRACK_H - TITLE_BAR_H;
  if (w > 6 && bodyH > 6) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, bodyY + 1, w - 2, bodyH - 2);
    ctx.clip();
    const seed = seedFromClip(clip.id);
    const cy = bodyY + bodyH / 2;
    ctx.strokeStyle = COLORS.speech.text;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 1;
    const stepPx = 2.5;
    const halfH = (bodyH - 6) / 2;
    for (const seg of clip.segments) {
      const projWidth = seg.projectEnd - seg.projectStart;
      const sourceWidth = seg.sourceEnd - seg.sourceStart;
      if (projWidth < 0.001 || sourceWidth < 0.001) continue;
      const stretch = sourceWidth / projWidth;
      ctx.beginPath();
      const stepT = stepPx / PX_PER_SECOND;
      for (let dt = 0; dt < projWidth; dt += stepT) {
        const srcT = seg.sourceStart + dt * stretch;
        const px = PADDING_X + (seg.projectStart + dt) * PX_PER_SECOND;
        const noise =
          Math.abs(Math.sin(srcT * 4.3 + seed * 0.41)) * 0.55 +
          Math.abs(Math.sin(srcT * 1.7 + seed * 0.93)) * 0.35 +
          0.1;
        const amp = halfH * noise;
        ctx.moveTo(px, cy - amp);
        ctx.lineTo(px, cy + amp);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

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

function seedFromClip(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t)    { return a + (b - a) * t; }
function easeOut(t)       { return 1 - (1 - t) * (1 - t); }
function easeIn(t)        { return t * t; }
function easeInOut(t)     { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function applyEase(t, kind) {
  switch (kind) {
    case 'easeIn':    return easeIn(t);
    case 'easeOut':   return easeOut(t);
    case 'easeInOut': return easeInOut(t);
    case 'linear':
    default:          return t;
  }
}

// macOS-style arrow cursor. Tip at (x, y); body extends down-right.
// When `pressed`, a soft white ring sits behind the tip.
function drawDemoCursor(ctx, x, y, pressed, opacity) {
  if (pressed) {
    ctx.save();
    ctx.globalAlpha = opacity * 0.65;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 14);
  ctx.lineTo(3.6, 11);
  ctx.lineTo(5.5, 14.5);
  ctx.lineTo(7.2, 13.5);
  ctx.lineTo(5, 10);
  ctx.lineTo(9.2, 10);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}
