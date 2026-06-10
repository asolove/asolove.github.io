// Clip anatomy: three stacked views of the same audio, showing what a
// "clip" actually is — a window into a source, with parameters, placed
// at a project-time.
//
//   PROJECT TIMELINE — the clip in context, surrounded by neighbours.
//                      During Play the output waveform is built up
//                      here, sample by sample.
//   CLIP             — the clip layer: the source window plus a volume
//                      automation curve. This is the layer the editor
//                      manipulates.
//   AUDIO SOURCE     — the underlying recording. A yellow window
//                      highlights the portion the clip is reading.
//
// All three lanes share a single x-axis: any canvas-x represents the
// same moment of audio across all three. That's the whole point of the
// figure — the layered abstraction lines up.
//
// Press Play to sweep a playhead from the clip's start to its end.
// As the playhead crosses each x, the output waveform in the project
// lane is drawn in with amplitude = source[t] × automation[t].

import { setupCanvas } from '../lib/timeline-render.js';

// === MODEL ============================================================

const SOURCE_DURATION = 8;
const WINDOW_START    = 2;            // source time of the clip's audio
const WINDOW_END      = 6;
const CLIP_DURATION   = WINDOW_END - WINDOW_START;  // 4

// Project layout: the clip placed at project-time 2, with neighbours.
// The "before" and "after" entries extend off-canvas on each side so
// the edge-fade gradients cover their cut ends, reading as "project
// continues beyond the frame."
const PROJECT_LAYOUT = [
  { id: 'before', start: -4,  duration: 4, label: '' },
  { id: 'prev',   start: 0,   duration: 2, label: 'prev clip' },
  { id: 'this',   start: 2,   duration: CLIP_DURATION, label: 'this clip' },
  { id: 'next',   start: 6,   duration: 5, label: 'next clip' },
  { id: 'after',  start: 11,  duration: 4, label: '' },
];

// Volume automation, expressed in clip-time (0 → CLIP_DURATION):
// fade-in, hold at unity, a sudden duck about two-thirds of the way
// through (as if cutting out a burst of background noise), snap back to
// unity, then fade-out.
const AUTOMATION = [
  { t: 0,     v: 0    },
  { t: 0.5,   v: 0.7  },
  { t: 1,     v: 1    },
  { t: 2.45,  v: 1    },
  { t: 2.55,  v: 0.12 },   // sharp drop
  { t: 2.85,  v: 0.12 },   // held low
  { t: 2.95,  v: 1    },   // snap back
  { t: 3.5,   v: 1    },
  { t: 3.75,  v: 0.7  },
  { t: 4,     v: 0    },
];

// === VISUAL CONSTANTS ================================================

const W              = 720;
const H              = 320;
const LEFT_PAD       = 30;
const PX_PER_SECOND  = 60;

const LANE_H         = 70;
const TITLE_BAR_H    = 11;
const LANE_PAD_Y     = 14;  // bleed above/below the lane band — so the
                            // "window" callout above the source lane and
                            // the playhead overshoots aren't clipped.

const ANIM_DURATION_MS = 4200;
const FADE_DIST = 90;                  // pixels of bg-fade at each edge

const LABEL_H          = 14;  // height reserved for each HTML lane label
const LABEL_LANE_GAP   = 4;   // gap between the label and the lane band

// Flip to `true` to bring back the live slider panel under the canvas
// (rotate_x, perspective, skew_x, lane_gap). Off for normal viewing.
const DEBUG_TUNING = false;

// === 3D PROJECTION ===================================================
// Each lane is rendered to its OWN canvas, then CSS-transformed with a
// real 3D rotation (rotateX = tilt backwards like laying on a table) +
// optional skewX. The stage gets `perspective` so the rotateX produces
// true foreshortening. The overlay canvas (time axis + edge fades) stays
// untransformed so the time axis reads as screen-vertical. The HTML
// lane labels share each lane's transform so they sit on the same
// tilted surface as the lane they describe.
let ROTATE_X    = 43;     // degrees of backward tilt
let PERSPECTIVE = 410;    // viewer distance in px
let SKEW_X      = 16.5;   // horizontal skew angle in degrees
let LANE_GAP    = 104;    // vertical distance between adjacent lane tops

// Lane Y positions are derived from LANE_GAP so the debug panel can
// adjust spacing live. recomputeLayout() rebuilds them.
let PROJECT_LANE_Y, CLIP_LANE_Y, SOURCE_LANE_Y;
function recomputeLayout() {
  // First lane sits 30px below the top of the dark stage — enough room
  // for the HTML lane label above it without leaving a large empty
  // gap. Canvas H is sized to the source lane's tilted extent below.
  PROJECT_LANE_Y = 30;
  CLIP_LANE_Y    = PROJECT_LANE_Y + LANE_GAP;
  SOURCE_LANE_Y  = PROJECT_LANE_Y + 2 * LANE_GAP;
}
recomputeLayout();

const COLORS = {
  bg:           '#1b1d22',
  laneBg:       'rgba(255, 255, 255, 0.025)',
  laneBorder:   'rgba(255, 255, 255, 0.05)',
  laneLabel:    '#bcc1c8',
  laneSubtitle: '#7a7e85',
  this:  { fill: '#3d8260', fillTop: '#2a5b43', stroke: '#15301f', text: '#e6f3ec' },
  other: { fill: 'rgba(70, 90, 80, 0.28)', stroke: 'rgba(140, 152, 146, 0.35)', text: 'rgba(230, 243, 236, 0.45)' },
  // The "this" clip on the project lane is drawn as a glassy outline —
  // just the space it occupies on the timeline — so the output waveform
  // built up during play reads as "the audio that lives in this slot."
  thisGlassFill:   'rgba(94, 200, 138, 0.07)',
  thisGlassStroke: 'rgba(94, 200, 138, 0.55)',
  output:       'rgba(94, 200, 138, 0.85)',
  window:       'rgba(232, 199, 99, 0.10)',
  windowEdge:   'rgba(232, 199, 99, 0.85)',
  windowGuide:  'rgba(232, 199, 99, 0.30)',
  waveform:     'rgba(230, 243, 236, 0.30)',
  waveformHot:  'rgba(230, 243, 236, 0.85)',
  auto:         '#f5d77a',
  autoDot:      '#f5d77a',
  playhead:     '#ffd700',
};

// === ENTRY POINT =====================================================

export default function mount(root) {
  root.innerHTML = `
    <div data-role="stage" style="
      position: relative;
      width: ${W}px;
      height: ${H}px;
      background: ${COLORS.bg};
      border-radius: 5px;
      overflow: hidden;
      perspective-origin: 50% 50%;
    ">
      <div data-role="label-project" class="ix-lane-label"
        ><span class="ix-l-t">PROJECT TIMELINE</span><span class="ix-l-s"> · the clip’s project position</span></div>
      <canvas data-role="lane-project" class="ix-lane"></canvas>

      <div data-role="label-clip" class="ix-lane-label"
        ><span class="ix-l-t">CLIP</span><span class="ix-l-s"> · window into source + automation</span></div>
      <canvas data-role="lane-clip"    class="ix-lane"></canvas>

      <div data-role="label-source" class="ix-lane-label"
        ><span class="ix-l-t">AUDIO SOURCE</span><span class="ix-l-s"> · underlying recording</span></div>
      <canvas data-role="lane-source"  class="ix-lane"></canvas>

      <canvas data-role="overlay" style="
        position: absolute; left: 0; top: 0;
        pointer-events: none;
      "></canvas>
    </div>
    <style>
      [data-interactive="clip-anatomy"] .ix-lane {
        position: absolute;
        left: 0;
        top: 0;
        backface-visibility: hidden;
      }
      [data-interactive="clip-anatomy"] .ix-lane-label {
        position: absolute;
        left: ${LEFT_PAD}px;
        height: ${LABEL_H}px;
        line-height: ${LABEL_H}px;
        font: 600 10px -apple-system, system-ui, sans-serif;
        color: ${COLORS.laneLabel};
        white-space: nowrap;
        pointer-events: none;
        backface-visibility: hidden;
        transform-style: preserve-3d;
      }
      [data-interactive="clip-anatomy"] .ix-lane-label .ix-l-s {
        color: ${COLORS.laneSubtitle};
        font-weight: 400;
      }
    </style>
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
    ${DEBUG_TUNING ? `
    <div data-role="tuning" style="
      margin-top: 10px;
      padding: 10px 12px;
      background: rgba(255,255,255,0.04);
      border: 1px dashed rgba(255,255,255,0.18);
      border-radius: 5px;
      font: 12px -apple-system, system-ui, sans-serif;
      color: #bcc1c8;
      display: grid;
      grid-template-columns: 110px 1fr 56px;
      gap: 6px 10px;
      align-items: center;
    ">
      <div style="grid-column: 1 / -1; color: #7a7e85; font-size: 11px; letter-spacing: 0.04em;">
        TUNING (temporary)
      </div>

      <label for="t-rotate">rotate_x</label>
      <input id="t-rotate" type="range" min="0" max="80" step="0.5" value="${ROTATE_X}">
      <span data-role="v-rotate">${ROTATE_X}°</span>

      <label for="t-persp">perspective</label>
      <input id="t-persp" type="range" min="200" max="2400" step="10" value="${PERSPECTIVE}">
      <span data-role="v-persp">${PERSPECTIVE}</span>

      <label for="t-skewx">skew_x</label>
      <input id="t-skewx" type="range" min="-30" max="30" step="0.5" value="${SKEW_X}">
      <span data-role="v-skewx">${SKEW_X}°</span>

      <label for="t-gap">lane_gap</label>
      <input id="t-gap" type="range" min="70" max="220" step="1" value="${LANE_GAP}">
      <span data-role="v-gap">${LANE_GAP}</span>
    </div>` : ''}
  `;

  const stage          = root.querySelector('[data-role="stage"]');
  const laneProjectEl  = root.querySelector('[data-role="lane-project"]');
  const laneClipEl     = root.querySelector('[data-role="lane-clip"]');
  const laneSourceEl   = root.querySelector('[data-role="lane-source"]');
  const labelProjectEl = root.querySelector('[data-role="label-project"]');
  const labelClipEl    = root.querySelector('[data-role="label-clip"]');
  const labelSourceEl  = root.querySelector('[data-role="label-source"]');
  const overlayEl      = root.querySelector('[data-role="overlay"]');
  const playBtn        = root.querySelector('[data-action="play"]');
  const resetBtn       = root.querySelector('[data-action="reset"]');
  const playLabel      = root.querySelector('[data-role="play-label"]');

  let state     = 'idle';
  let animFrame = null;
  let progress  = 0; // 0..1 — how far the playhead has swept through the clip

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
    progress = 0;
    setState('idle');
    render();
  }

  function play() {
    cancelAnim();
    progress = 0;
    setState('playing');
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      if (elapsed >= ANIM_DURATION_MS) {
        progress = 1;
        animFrame = null;
        setState('done');
        render();
        return;
      }
      progress = elapsed / ANIM_DURATION_MS;
      render();
      animFrame = requestAnimationFrame(step);
    }

    animFrame = requestAnimationFrame(step);
  }

  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', reset);

  // --- tuning panel wiring (only when DEBUG_TUNING) -----------------
  if (DEBUG_TUNING) {
    const tRotate = root.querySelector('#t-rotate');
    const tPersp  = root.querySelector('#t-persp');
    const tSkewX  = root.querySelector('#t-skewx');
    const tGap    = root.querySelector('#t-gap');
    const vRotate = root.querySelector('[data-role="v-rotate"]');
    const vPersp  = root.querySelector('[data-role="v-persp"]');
    const vSkewX  = root.querySelector('[data-role="v-skewx"]');
    const vGap    = root.querySelector('[data-role="v-gap"]');

    tRotate.addEventListener('input', () => {
      ROTATE_X = parseFloat(tRotate.value);
      vRotate.textContent = `${ROTATE_X}°`;
      render();
    });
    tPersp.addEventListener('input', () => {
      PERSPECTIVE = parseInt(tPersp.value, 10);
      vPersp.textContent = String(PERSPECTIVE);
      render();
    });
    tSkewX.addEventListener('input', () => {
      SKEW_X = parseFloat(tSkewX.value);
      vSkewX.textContent = `${SKEW_X}°`;
      render();
    });
    tGap.addEventListener('input', () => {
      LANE_GAP = parseInt(tGap.value, 10);
      vGap.textContent = String(LANE_GAP);
      recomputeLayout();
      render();
    });
  }

  function applyTransforms() {
    stage.style.perspective = `${PERSPECTIVE}px`;
    const transform = `rotateX(${ROTATE_X}deg) skewX(${SKEW_X}deg)`;

    // Each lane canvas has LANE_PAD_Y bleed top and bottom (the source
    // lane's "window" callout and edge lines draw outside the band).
    // The canvas pivots around its own center (= lane band center), so
    // rotateX feels like the band laying back from its midline.
    const setLane = (el, laneY) => {
      el.style.top = `${laneY - LANE_PAD_Y}px`;
      el.style.transform = transform;
    };
    setLane(laneProjectEl, PROJECT_LANE_Y);
    setLane(laneClipEl,    CLIP_LANE_Y);
    setLane(laneSourceEl,  SOURCE_LANE_Y);

    // Each label sits just above its lane, sharing the same 3D plane.
    // The label's own element-local center is its midpoint, but we want
    // it to pivot around the LANE's center — which is below it by
    // (LABEL_LANE_GAP + LANE_H/2). That keeps the label welded to the
    // lane's tilted surface instead of flopping around its own center.
    const labelOriginY = LABEL_H + LABEL_LANE_GAP + LANE_H / 2;
    const setLabel = (el, laneY) => {
      el.style.top = `${laneY - LABEL_H - LABEL_LANE_GAP}px`;
      el.style.transformOrigin = `50% ${labelOriginY}px`;
      el.style.transform = transform;
    };
    setLabel(labelProjectEl, PROJECT_LANE_Y);
    setLabel(labelClipEl,    CLIP_LANE_Y);
    setLabel(labelSourceEl,  SOURCE_LANE_Y);
  }

  // Lane functions still reference absolute Y (PROJECT_LANE_Y etc), so
  // we size each canvas to LANE_H + bleed and translate the context up
  // by (laneY - LANE_PAD_Y) — the lane's content lands at y=PAD..PAD+LANE_H
  // in its own little canvas, with PAD pixels of bleed above and below.
  function renderLane(canvas, laneY, drawFn) {
    const canvasH = LANE_H + LANE_PAD_Y * 2;
    const ctx = setupCanvas(canvas, W, canvasH);
    ctx.translate(0, -(laneY - LANE_PAD_Y));
    drawFn(ctx);
  }

  function render() {
    applyTransforms();

    // Each lane's playhead is drawn inside that lane's canvas, so it
    // gets the lane's 3D rotation/skew — it lays flat on the lane's
    // tilted surface instead of standing up as a single screen-vertical.
    const showPlayhead = state === 'playing' || state === 'done';
    const playheadX = showPlayhead
      ? LEFT_PAD + (WINDOW_START + progress * CLIP_DURATION) * PX_PER_SECOND
      : null;

    renderLane(laneProjectEl, PROJECT_LANE_Y, (ctx) => {
      drawProjectLane(ctx, progress);
      if (playheadX !== null) drawLanePlayhead(ctx, PROJECT_LANE_Y, playheadX);
    });
    renderLane(laneClipEl, CLIP_LANE_Y, (ctx) => {
      drawClipLane(ctx);
      if (playheadX !== null) drawLanePlayhead(ctx, CLIP_LANE_Y, playheadX);
    });
    renderLane(laneSourceEl, SOURCE_LANE_Y, (ctx) => {
      drawSourceLane(ctx);
      if (playheadX !== null) drawLanePlayhead(ctx, SOURCE_LANE_Y, playheadX);
    });

    // Overlay: window guides + edge fades. (Labels are HTML elements
    // sharing each lane's transform — see applyTransforms.)
    const ctx = setupCanvas(overlayEl, W, H);
    drawWindowGuides(ctx);
    drawEdgeFades(ctx);
  }

  render();
}

// === HELPERS =========================================================

// Linear-gradient overlays at the canvas left/right that fade to the
// background colour. Drawn outside the skew transform so the gradient
// edges stay straight regardless of the lane tilt.
function drawEdgeFades(ctx) {
  ctx.save();
  const bgTransparent = 'rgba(27, 29, 34, 0)';
  const leftGrad = ctx.createLinearGradient(0, 0, FADE_DIST, 0);
  leftGrad.addColorStop(0, COLORS.bg);
  leftGrad.addColorStop(1, bgTransparent);
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, FADE_DIST, H);

  const rightGrad = ctx.createLinearGradient(W - FADE_DIST, 0, W, 0);
  rightGrad.addColorStop(0, bgTransparent);
  rightGrad.addColorStop(1, COLORS.bg);
  ctx.fillStyle = rightGrad;
  ctx.fillRect(W - FADE_DIST, 0, FADE_DIST, H);
  ctx.restore();
}

// Window guides drawn as straight vertical lines on the untransformed
// overlay. They pierce the 3D-tilted lanes; the time axis stays
// perfectly vertical in screen space.
function drawWindowGuides(ctx) {
  const x1 = LEFT_PAD + WINDOW_START * PX_PER_SECOND;
  const x2 = LEFT_PAD + WINDOW_END   * PX_PER_SECOND;
  ctx.save();
  ctx.strokeStyle = COLORS.windowGuide;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  for (const x of [x1, x2]) {
    ctx.moveTo(x, PROJECT_LANE_Y);
    ctx.lineTo(x, SOURCE_LANE_Y + LANE_H);
  }
  ctx.stroke();
  ctx.restore();
}

// --- project lane: the clip in context -------------------------------

function drawProjectLane(ctx, progress) {
  // Lane background spans the whole canvas — the fade overlay at each
  // edge clips the visible portion, suggesting "more project here."
  ctx.fillStyle = COLORS.laneBg;
  ctx.fillRect(0, PROJECT_LANE_Y, W, LANE_H);

  for (const item of PROJECT_LAYOUT) {
    const x = LEFT_PAD + item.start * PX_PER_SECOND;
    const w = item.duration * PX_PER_SECOND;
    if (item.id === 'this') {
      drawGlassyOutline(ctx, x, PROJECT_LANE_Y, w, LANE_H);
      drawOutputWaveform(ctx, x, w, progress);
    } else {
      drawClipBox(ctx, x, PROJECT_LANE_Y, w, LANE_H, item.label, COLORS.other);
    }
  }
}

// A faint glassy rectangle: thin outline + barely-there fill. Stands in
// for the slot on the project timeline that the clip occupies — the
// output waveform paints "into" this surface as the playhead sweeps.
function drawGlassyOutline(ctx, x, y, w, h) {
  if (w < 1) return;
  ctx.save();
  ctx.fillStyle = COLORS.thisGlassFill;
  ctx.strokeStyle = COLORS.thisGlassStroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// The output waveform is built up as the playhead sweeps. At each x
// already crossed, output amp = |source(t)| × automation(t).
function drawOutputWaveform(ctx, clipX, clipW, progress) {
  const bodyY = PROJECT_LANE_Y + TITLE_BAR_H;
  const bodyH = LANE_H - TITLE_BAR_H;
  const cy    = bodyY + bodyH / 2;
  const halfH = (bodyH - 8) / 2;

  // Playhead position in project-time → canvas-x
  const playheadX = LEFT_PAD + (2 + progress * CLIP_DURATION) * PX_PER_SECOND;

  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX + 1, bodyY + 1, clipW - 2, bodyH - 2);
  ctx.clip();

  ctx.strokeStyle = COLORS.output;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const stepPx = 2;
  const limit = Math.min(playheadX, clipX + clipW);
  for (let x = clipX; x < limit; x += stepPx) {
    const projectT = (x - LEFT_PAD) / PX_PER_SECOND;
    const clipT    = projectT - 2;              // this clip starts at project-time 2
    const sourceT  = WINDOW_START + clipT;      // source-time
    const amp = Math.abs(sourceAmp(sourceT)) * autoGain(clipT);
    const half = halfH * amp;
    ctx.moveTo(x, cy - half);
    ctx.lineTo(x, cy + half);
  }
  ctx.stroke();
  ctx.restore();
}

// --- clip lane: the clip extracted, with automation -----------------

function drawClipLane(ctx) {
  // The clip sits exactly under its window on the source — so the same
  // canvas-x range as the window highlight below.
  const clipX = LEFT_PAD + WINDOW_START * PX_PER_SECOND;
  const clipW = CLIP_DURATION * PX_PER_SECOND;

  drawClipBox(ctx, clipX, CLIP_LANE_Y, clipW, LANE_H, 'voice', COLORS.this);

  // Just the volume automation curve in the body. The clip's job at
  // this layer is "the parameters being applied to the source" — not a
  // preview of the audio itself (that's the source lane's job).
  const bodyY = CLIP_LANE_Y + TITLE_BAR_H;
  const bodyH = LANE_H - TITLE_BAR_H;
  drawAutomationCurve(ctx, clipX, clipW, bodyY, bodyH);
}

function drawAutomationCurve(ctx, clipX, clipW, bodyY, bodyH) {
  const pad = 4;
  const top = bodyY + pad;
  const bot = bodyY + bodyH - pad;
  const xForT = (t) => clipX + t * PX_PER_SECOND;
  const yForV = (v) => bot - v * (bot - top);

  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX + 1, bodyY + 1, clipW - 2, bodyH - 2);
  ctx.clip();

  ctx.strokeStyle = COLORS.auto;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  AUTOMATION.forEach((pt, i) => {
    const x = xForT(pt.t);
    const y = yForV(pt.v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = COLORS.autoDot;
  for (const pt of AUTOMATION) {
    ctx.beginPath();
    ctx.arc(xForT(pt.t), yForV(pt.v), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- source lane: raw recording -------------------------------------

function drawSourceLane(ctx) {
  // Lane and waveform span the whole canvas. The audio model is just
  // a stream of sin-noise — there's no "edge of the source." That's
  // exactly the impression we want: the recording continues in both
  // directions, the fade overlay at each end softens the cutoff.
  ctx.fillStyle = COLORS.laneBg;
  ctx.fillRect(0, SOURCE_LANE_Y, W, LANE_H);

  // Map canvas-x=0 to whatever source-time that is at the current
  // projection (LEFT_PAD + sourceT * PX_PER_SECOND = canvas-x).
  const sourceTimeAtX0 = -LEFT_PAD / PX_PER_SECOND;
  drawSourceWaveform(ctx, 0, W, SOURCE_LANE_Y, LANE_H, sourceTimeAtX0, COLORS.waveform);

  // Window highlight: translucent rectangle + bright edge lines
  const wX = LEFT_PAD + WINDOW_START * PX_PER_SECOND;
  const wW = (WINDOW_END - WINDOW_START) * PX_PER_SECOND;
  ctx.save();
  ctx.fillStyle = COLORS.window;
  ctx.fillRect(wX, SOURCE_LANE_Y, wW, LANE_H);
  ctx.strokeStyle = COLORS.windowEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(wX, SOURCE_LANE_Y - 3);
  ctx.lineTo(wX, SOURCE_LANE_Y + LANE_H + 3);
  ctx.moveTo(wX + wW, SOURCE_LANE_Y - 3);
  ctx.lineTo(wX + wW, SOURCE_LANE_Y + LANE_H + 3);
  ctx.stroke();
  // Small "window" label above the highlight
  ctx.fillStyle = COLORS.windowEdge;
  ctx.font = '500 9px -apple-system, system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillText('window', wX + wW / 2, SOURCE_LANE_Y - 6);
  ctx.restore();
}

function drawSourceWaveform(ctx, x, w, y, h, sourceStartSec, color) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, y + 1, w - 2, h - 2);
  ctx.clip();

  const cy = y + h / 2;
  const halfH = (h - 10) / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const stepPx = 1.6;
  for (let dx = 0; dx < w; dx += stepPx) {
    const sT = sourceStartSec + dx / PX_PER_SECOND;
    const amp = Math.abs(sourceAmp(sT)) * halfH;
    ctx.moveTo(x + dx, cy - amp);
    ctx.lineTo(x + dx, cy + amp);
  }
  ctx.stroke();
  ctx.restore();
}

// --- per-lane playhead: vertical in the lane's own canvas, so when
//     the lane's CSS 3D transform is applied it rotates onto the lane's
//     tilted surface (lays flat along the lane's depth axis).

function drawLanePlayhead(ctx, laneY, x) {
  ctx.save();
  ctx.strokeStyle = COLORS.playhead;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = 'rgba(255, 215, 0, 0.55)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(x, laneY);
  ctx.lineTo(x, laneY + LANE_H);
  ctx.stroke();
  ctx.restore();
}

// --- clip-box primitive (matches part-1 interactives) ---------------

function drawClipBox(ctx, x, y, w, h, label, c) {
  if (w < 1) return;
  ctx.save();
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();

  topRoundedRect(ctx, x, y, w, TITLE_BAR_H, 3);
  ctx.fillStyle = c.fillTop || c.stroke;
  ctx.fill();

  if (w > 28) {
    ctx.fillStyle = c.text;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 5, y + TITLE_BAR_H / 2 + 0.5);
  }
  ctx.restore();
}

// === AUDIO DATA ======================================================

// Hand-placed syllable envelope: each entry is a soft bump at source-time
// `t` with `peak` amplitude and `width` (seconds, ~stddev). Packed
// densely with overlapping peaks so the rendered waveform reads as
// continuous "speech with room tone" rather than isolated blips — which
// makes the duck around clip-time 2.5–2.85 (= source-time 4.5–4.85)
// visibly punch through *continuous* loud audio instead of just
// silencing a couple of spikes.
const SYLLABLES = [
  { t: -0.7,  peak: 0.62, width: 0.20 },
  { t: -0.2,  peak: 0.78, width: 0.22 },
  { t:  0.2,  peak: 0.88, width: 0.24 },
  { t:  0.6,  peak: 0.58, width: 0.18 },
  { t:  1.0,  peak: 0.92, width: 0.24 },
  { t:  1.4,  peak: 0.70, width: 0.20 },
  { t:  1.8,  peak: 0.85, width: 0.24 },
  { t:  2.2,  peak: 0.60, width: 0.18 },
  { t:  2.5,  peak: 0.88, width: 0.24 },
  { t:  2.9,  peak: 0.96, width: 0.28 },
  { t:  3.3,  peak: 0.75, width: 0.22 },
  { t:  3.7,  peak: 0.90, width: 0.26 },
  { t:  4.1,  peak: 0.85, width: 0.22 },   // start of duck-zone build
  { t:  4.4,  peak: 1.00, width: 0.24 },   // peak loud — gets ducked
  { t:  4.7,  peak: 1.00, width: 0.22 },   // peak loud — gets ducked
  { t:  4.95, peak: 0.96, width: 0.20 },   // tail end of duck-zone
  { t:  5.25, peak: 0.72, width: 0.20 },
  { t:  5.6,  peak: 0.90, width: 0.24 },
  { t:  5.95, peak: 0.78, width: 0.22 },
  { t:  6.3,  peak: 0.62, width: 0.18 },
  { t:  6.7,  peak: 0.94, width: 0.26 },
  { t:  7.1,  peak: 0.72, width: 0.20 },
  { t:  7.5,  peak: 0.88, width: 0.24 },
  { t:  7.9,  peak: 0.62, width: 0.18 },
  { t:  8.3,  peak: 0.80, width: 0.22 },
  { t:  8.7,  peak: 0.92, width: 0.26 },
  { t:  9.2,  peak: 0.72, width: 0.20 },
  { t:  9.7,  peak: 0.85, width: 0.24 },
  { t: 10.2,  peak: 0.75, width: 0.22 },
  { t: 10.7,  peak: 0.96, width: 0.26 },
  { t: 11.2,  peak: 0.62, width: 0.20 },
  { t: 11.7,  peak: 0.85, width: 0.24 },
];

// Baseline ambient amplitude. Real recordings have room tone / breath /
// background noise — never true silence. Pinning the envelope above 0
// makes the waveform continuously busy, so when the automation duck
// fires the contrast is dramatic instead of just "a couple of spikes
// disappeared."
const AMBIENT = 0.22;

// Sum the syllable bumps for an envelope, then modulate by a quasi-random
// high-frequency core (mix of incommensurate sines so it doesn't repeat).
function sourceAmp(t) {
  let env = AMBIENT;
  for (const s of SYLLABLES) {
    const dt = (t - s.t) / s.width;
    env += s.peak * Math.exp(-dt * dt * 2.0);
  }
  if (env > 1) env = 1;

  const hf =
    Math.sin(t * 31.7 + 0.4) * 0.40 +
    Math.sin(t * 53.1 + 1.7) * 0.30 +
    Math.sin(t * 19.3 + 2.9) * 0.20 +
    Math.sin(t * 12.7 + 4.1) * 0.10;

  return env * hf;
}

// Linear interpolation over AUTOMATION breakpoints. clipT is in [0, CLIP_DURATION].
function autoGain(clipT) {
  if (clipT <= AUTOMATION[0].t) return AUTOMATION[0].v;
  for (let i = 0; i < AUTOMATION.length - 1; i++) {
    const a = AUTOMATION[i];
    const b = AUTOMATION[i + 1];
    if (clipT >= a.t && clipT <= b.t) {
      const f = (clipT - a.t) / (b.t - a.t);
      return a.v + f * (b.v - a.v);
    }
  }
  return AUTOMATION[AUTOMATION.length - 1].v;
}

// === SHAPE HELPERS ===================================================

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
