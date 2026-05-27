// Single timeline showing ABSOLUTE layout. Each clip is positioned by an
// explicit project-time `start`; nothing reflows when one clip changes.
//
// Two ways to interact:
//   - Press Play to watch a virtual cursor trim segment 1's right edge —
//     the same gesture a human user would use, animated as a sequence of
//     keyframes (move → click → drag → release → exit).
//   - Manually drag any clip: body to reposition, left/right edge to trim.
//   - Press Reset to restore the original layout.

import { setupCanvas } from '../lib/timeline-render.js';

// --- model -----------------------------------------------------------------

// Each clip has start/duration in project time. sourceOffset is how far
// into the original source content the clip starts (used to anchor the
// waveform when trimming the left edge).
// Speech clips s1–s3 abut tightly (no silence between them); a transition
// music clip sits between s3 and s4 with a 1-second crossfade overlap on
// each side. Trimming s1 then exposes the absolute-positioning failure
// mode loudly: clips that were touching are now separated by empty space.
const INITIAL_CLIPS = Object.freeze({
  s1: { kind: 'speech', label: 'segment 1',  start: 0,  duration: 6, sourceOffset: 0 },
  s2: { kind: 'speech', label: 'segment 2',  start: 6,  duration: 5, sourceOffset: 0 },
  s3: { kind: 'speech', label: 'segment 3',  start: 11, duration: 5, sourceOffset: 0 },
  s4: { kind: 'speech', label: 'segment 4',  start: 18, duration: 5, sourceOffset: 0 },
  m1: { kind: 'music',  label: 'music',      start: 15, duration: 4, sourceOffset: 0 },
});

const SPEECH_IDS = ['s1', 's2', 's3', 's4'];
const MUSIC_IDS  = ['m1'];
const MIN_DURATION = 0.3;
const EDGE_HIT_PX = 6;

// --- visual config ---------------------------------------------------------

const PADDING_X = 14;
const PX_PER_SECOND = 19;
const RULER_Y = 12;
const RULER_LABEL_Y = 22;
const TRACK1_Y = 32;
const TRACK_H = 36;
const TRACK_GAP = 5;
const TRACK2_Y = TRACK1_Y + TRACK_H + TRACK_GAP;
const HEIGHT = TRACK2_Y + TRACK_H + 6;
const TITLE_BAR_H = 11;

const COLORS = {
  bg: '#f2eee2',
  trackLane: 'rgba(0, 0, 0, 0.025)',
  trackBorder: 'rgba(0, 0, 0, 0.05)',
  ruler: '#bdb6a4',
  rulerText: '#7a7270',
  speech: { fill: '#3d8260', fillTop: '#2a5b43', stroke: '#15301f', text: '#e6f3ec' },
  music:  { fill: '#3d747f', fillTop: '#2a5158', stroke: '#152e33', text: '#e4f0f3' },
  edgeHandle: 'rgba(0, 0, 0, 0.85)',
};

// --- cursor animation schedule --------------------------------------------

// Animation has four scenes:
//   1. Trim s1's right edge (cursor enters, presses, drags, releases).
//   2. Cursor hovers quizzically over the new empty space.
//   3. Marquee-select s2/s3/s4/m1 (everything past the gap).
//   4. Drag the selection 2 seconds left to close the gap.
// Then the cursor exits.
//
// Times in ms; cx in project time, cy in canvas pixels.
// Special `event` markers fire once each when crossed (marqueeStart,
// marqueeEnd, groupDragStart, groupDragEnd, clearSelection).
const CURSOR_Y_REST   = TRACK1_Y + TRACK_H * 0.55;
const CURSOR_Y_ABOVE  = TRACK1_Y - 14;
const MQ_TOP_Y        = TRACK1_Y - 5;
const MQ_BOT_Y        = TRACK2_Y + TRACK_H + 5;
const TRIM_FROM = 6;
const TRIM_TO   = 4;
const FIXUP_SHIFT = TRIM_FROM - TRIM_TO; // group drag distance in seconds

const SCHEDULE = [
  // --- Scene 1: trim s1 ---------------------------------------------------
  { t:    0, cx: 9.5, cy: CURSOR_Y_ABOVE, p: false, o: 0,   d: TRIM_FROM, ease: 'linear' },
  { t:  120, cx: 9.5, cy: CURSOR_Y_ABOVE, p: false, o: 1,   d: TRIM_FROM, ease: 'easeOut' },
  { t:  720, cx: TRIM_FROM, cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_FROM, ease: 'easeInOut' },
  { t:  870, cx: TRIM_FROM, cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_FROM, ease: 'linear' },
  { t:  970, cx: TRIM_FROM, cy: CURSOR_Y_REST, p: true,  o: 1, d: TRIM_FROM, ease: 'linear' },
  { t: 1770, cx: TRIM_TO,   cy: CURSOR_Y_REST, p: true,  o: 1, d: TRIM_TO,   ease: 'easeInOut' },
  { t: 1900, cx: TRIM_TO,   cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO,   ease: 'linear' },
  { t: 2200, cx: TRIM_TO,   cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO,   ease: 'linear' },
  // --- Scene 2: quizzical hover over the gap ------------------------------
  { t: 2600, cx: 5,   cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO, ease: 'easeInOut' },
  { t: 2800, cx: 5,   cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO, ease: 'linear' },
  { t: 2950, cx: 4.5, cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO, ease: 'easeInOut' },
  { t: 3100, cx: 5.5, cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO, ease: 'easeInOut' },
  { t: 3250, cx: 5,   cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO, ease: 'easeInOut' },
  { t: 3450, cx: 5,   cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO, ease: 'linear' },
  // --- Scene 3: marquee select s2/s3/s4/m1 --------------------------------
  { t: 3750, cx: 5.7, cy: MQ_TOP_Y, p: false, o: 1, d: TRIM_TO, ease: 'easeInOut' },
  { t: 3900, cx: 5.7, cy: MQ_TOP_Y, p: true,  o: 1, d: TRIM_TO, ease: 'linear', event: 'marqueeStart' },
  { t: 4750, cx: 23.5, cy: MQ_BOT_Y, p: true, o: 1, d: TRIM_TO, ease: 'easeInOut' },
  { t: 4900, cx: 23.5, cy: MQ_BOT_Y, p: false, o: 1, d: TRIM_TO, ease: 'linear', event: 'marqueeEnd' },
  { t: 5150, cx: 23.5, cy: MQ_BOT_Y, p: false, o: 1, d: TRIM_TO, ease: 'linear' },
  // --- Scene 4: drag the selection 2 seconds left -------------------------
  { t: 5550, cx: 8.5, cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO, ease: 'easeInOut' },
  { t: 5700, cx: 8.5, cy: CURSOR_Y_REST, p: true,  o: 1, d: TRIM_TO, ease: 'linear', event: 'groupDragStart' },
  { t: 6500, cx: 8.5 - FIXUP_SHIFT, cy: CURSOR_Y_REST, p: true, o: 1, d: TRIM_TO, ease: 'easeInOut' },
  { t: 6650, cx: 8.5 - FIXUP_SHIFT, cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO, ease: 'linear', event: 'groupDragEnd' },
  { t: 7000, cx: 8.5 - FIXUP_SHIFT, cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO, ease: 'linear' },
  // --- Exit ---------------------------------------------------------------
  { t: 7400, cx: 8.5 - FIXUP_SHIFT, cy: CURSOR_Y_ABOVE, p: false, o: 0, d: TRIM_TO, ease: 'easeIn', event: 'clearSelection' },
];

// --- entry point -----------------------------------------------------------

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

  const host = root.querySelector('[data-role="canvas-host"]');
  const playBtn = root.querySelector('[data-action="play"]');
  const resetBtn = root.querySelector('[data-action="reset"]');
  const playLabel = root.querySelector('[data-role="play-label"]');

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display: block; border-radius: 5px;';
  host.appendChild(canvas);

  let cssWidth = host.clientWidth || 600;
  let clips = cloneClips(INITIAL_CLIPS);
  let cursor = { visible: false, x: 0, y: 0, pressed: false, opacity: 0 };
  let animFrame = null;
  /** @type {'idle'|'playing'|'done'} */
  let state = 'idle';
  /** @type {{ id: string, zone: 'body'|'left'|'right' } | null} */
  let hover = null;
  /** @type {object | null} */
  let drag = null;
  // --- animation extras: marquee selection + group drag ---
  /** @type {Set<string>} */
  let selection = new Set();
  /** @type {{ startPx: number, startPy: number, active: boolean } | null} */
  let marquee = null;
  /** @type {{ anchorCx: number, initialStarts: Record<string, number> } | null} */
  let groupDrag = null;
  /** @type {Set<string>} */
  let firedEvents = new Set();

  function setState(s) {
    state = s;
    playBtn.dataset.state = s;
    playBtn.disabled = s === 'playing';
    playLabel.textContent = s === 'playing' ? 'Playing' : s === 'done' ? 'Replay' : 'Play';
    playBtn.setAttribute('aria-label', playLabel.textContent);
  }

  function clearAnimExtras() {
    selection = new Set();
    marquee = null;
    groupDrag = null;
    firedEvents = new Set();
  }

  function reset() {
    cancelAnim();
    clips = cloneClips(INITIAL_CLIPS);
    cursor.visible = false;
    cursor.opacity = 0;
    clearAnimExtras();
    setState('idle');
    render();
  }

  function cancelAnim() {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  // --- animation -----------------------------------------------------------

  function handleAnimEvent(name) {
    if (name === 'marqueeStart') {
      marquee = {
        startPx: PADDING_X + cursor.x * PX_PER_SECOND,
        startPy: cursor.y,
        active: true,
      };
    } else if (name === 'marqueeEnd') {
      if (marquee) marquee.active = false;
      // Selection is hardcoded — visually the marquee covers exactly these.
      selection = new Set(['s2', 's3', 's4', 'm1']);
    } else if (name === 'groupDragStart') {
      const initialStarts = {};
      for (const id of selection) initialStarts[id] = clips[id].start;
      groupDrag = { anchorCx: cursor.x, initialStarts };
    } else if (name === 'groupDragEnd') {
      groupDrag = null;
    } else if (name === 'clearSelection') {
      selection = new Set();
      marquee = null;
    }
  }

  function play() {
    cancelAnim();
    // Always reset before animating so the demo starts from a known state.
    clips = cloneClips(INITIAL_CLIPS);
    clearAnimExtras();
    setState('playing');

    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;

      // Fire any events whose time has passed (each fires once).
      for (const kf of SCHEDULE) {
        if (!kf.event || kf.t > elapsed) continue;
        const key = `${kf.t}:${kf.event}`;
        if (firedEvents.has(key)) continue;
        firedEvents.add(key);
        handleAnimEvent(kf.event);
      }

      let i = 0;
      while (i < SCHEDULE.length - 1 && SCHEDULE[i + 1].t <= elapsed) i++;

      if (i >= SCHEDULE.length - 1) {
        const last = SCHEDULE[SCHEDULE.length - 1];
        cursor.x = last.cx;
        cursor.y = last.cy;
        cursor.pressed = false;
        cursor.opacity = last.o;
        cursor.visible = false;
        clips.s1.duration = last.d;
        animFrame = null;
        setState('done');
        render();
        return;
      }

      const a = SCHEDULE[i];
      const b = SCHEDULE[i + 1];
      const span = b.t - a.t;
      const tNorm = span > 0 ? Math.min(1, Math.max(0, (elapsed - a.t) / span)) : 1;
      const eased = applyEase(tNorm, b.ease);

      cursor.x = lerp(a.cx, b.cx, eased);
      cursor.y = lerp(a.cy, b.cy, eased);
      cursor.opacity = lerp(a.o, b.o, eased);
      cursor.visible = cursor.opacity > 0.01;
      cursor.pressed = b.p;
      clips.s1.duration = lerp(a.d, b.d, eased);

      // Group drag: shift each selected clip's start by the cursor delta.
      if (groupDrag) {
        const shift = cursor.x - groupDrag.anchorCx;
        for (const id of selection) {
          clips[id].start = groupDrag.initialStarts[id] + shift;
        }
      }

      render();
      animFrame = requestAnimationFrame(step);
    }

    animFrame = requestAnimationFrame(step);
  }

  // --- interactions --------------------------------------------------------

  function getCursorPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // Hit test in reverse-draw order so a clip drawn on top wins over its
  // underlap. Returns { id, zone } or null.
  function hitTest(x, y) {
    const orderedIds = [...SPEECH_IDS, ...MUSIC_IDS];
    for (const id of orderedIds) {
      const c = clips[id];
      const trackY = c.kind === 'music' ? TRACK2_Y : TRACK1_Y;
      if (y < trackY || y > trackY + TRACK_H) continue;
      const cx = PADDING_X + c.start * PX_PER_SECOND;
      const cw = c.duration * PX_PER_SECOND;
      if (x < cx - EDGE_HIT_PX || x > cx + cw + EDGE_HIT_PX) continue;
      if (Math.abs(x - cx) <= EDGE_HIT_PX) return { id, zone: 'left' };
      if (Math.abs(x - (cx + cw)) <= EDGE_HIT_PX) return { id, zone: 'right' };
      if (x >= cx && x <= cx + cw) return { id, zone: 'body' };
    }
    return null;
  }

  function cursorForZone(zone, dragging) {
    if (zone === 'body') return dragging ? 'grabbing' : 'grab';
    return 'ew-resize';
  }

  canvas.addEventListener('mousemove', (e) => {
    if (drag) return;
    const { x, y } = getCursorPos(e);
    const hit = hitTest(x, y);
    const newKey = hit ? `${hit.id}:${hit.zone}` : null;
    const oldKey = hover ? `${hover.id}:${hover.zone}` : null;
    if (newKey !== oldKey) {
      hover = hit;
      canvas.style.cursor = hit ? cursorForZone(hit.zone, false) : '';
      render();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (drag) return;
    if (hover) { hover = null; canvas.style.cursor = ''; render(); }
  });

  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getCursorPos(e);
    const hit = hitTest(x, y);
    if (!hit) return;
    e.preventDefault();
    // User interaction takes over from any in-flight animation.
    cancelAnim();
    cursor.visible = false;
    clearAnimExtras();
    if (state === 'playing') setState('idle');
    const c = clips[hit.id];
    drag = {
      id: hit.id,
      zone: hit.zone,
      startX: x,
      initialStart: c.start,
      initialDuration: c.duration,
      initialSourceOffset: c.sourceOffset,
    };
    canvas.style.cursor = cursorForZone(hit.zone, true);
    render();
  });

  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const x = e.clientX - canvas.getBoundingClientRect().left;
    const dx = x - drag.startX;
    const dT = dx / PX_PER_SECOND;
    const c = clips[drag.id];

    if (drag.zone === 'body') {
      c.start = drag.initialStart + dT;
    } else if (drag.zone === 'right') {
      c.duration = Math.max(MIN_DURATION, drag.initialDuration + dT);
    } else if (drag.zone === 'left') {
      // Left edge: clamp newStart so duration stays >= MIN_DURATION.
      const initialRightEdge = drag.initialStart + drag.initialDuration;
      const newStart = Math.min(drag.initialStart + dT, initialRightEdge - MIN_DURATION);
      const trimAmount = newStart - drag.initialStart;
      c.start = newStart;
      c.duration = drag.initialDuration - trimAmount;
      c.sourceOffset = drag.initialSourceOffset + trimAmount;
    }
    render();
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    drag = null;
    canvas.style.cursor = hover ? cursorForZone(hover.zone, false) : '';
    render();
  });

  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', reset);

  const ro = new ResizeObserver(() => {
    cssWidth = host.clientWidth || 600;
    render();
  });
  ro.observe(host);

  // --- render --------------------------------------------------------------

  function render() {
    const w = cssWidth;
    const ctx = setupCanvas(canvas, w, HEIGHT);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, HEIGHT);

    drawDarkRuler(ctx, PADDING_X, RULER_Y, w - PADDING_X * 2);

    ctx.fillStyle = COLORS.trackLane;
    ctx.fillRect(PADDING_X, TRACK1_Y, w - PADDING_X * 2, TRACK_H);
    ctx.fillRect(PADDING_X, TRACK2_Y, w - PADDING_X * 2, TRACK_H);
    ctx.strokeStyle = COLORS.trackBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(PADDING_X + 0.5, TRACK1_Y + 0.5, w - PADDING_X * 2 - 1, TRACK_H - 1);
    ctx.strokeRect(PADDING_X + 0.5, TRACK2_Y + 0.5, w - PADDING_X * 2 - 1, TRACK_H - 1);

    for (const id of MUSIC_IDS) {
      const c = clips[id];
      drawAudioClip(ctx, c.start, c.duration, TRACK2_Y, TRACK_H, c.label, COLORS.music, seedFromId(id), c.sourceOffset);
    }
    for (const id of SPEECH_IDS) {
      const c = clips[id];
      drawAudioClip(ctx, c.start, c.duration, TRACK1_Y, TRACK_H, c.label, COLORS.speech, seedFromId(id), c.sourceOffset);
    }

    // Edge handle indicator on the active hover/drag target.
    const target = drag ?? hover;
    if (target && (target.zone === 'left' || target.zone === 'right')) {
      const c = clips[target.id];
      const trackY = c.kind === 'music' ? TRACK2_Y : TRACK1_Y;
      const cx = PADDING_X + c.start * PX_PER_SECOND;
      const cw = c.duration * PX_PER_SECOND;
      const edgeX = target.zone === 'left' ? cx : cx + cw;
      drawEdgeHandle(ctx, edgeX, trackY, TRACK_H);
    }

    // Selection outlines (highlighted clips).
    if (selection.size > 0) {
      for (const id of selection) {
        const c = clips[id];
        const trackY = c.kind === 'music' ? TRACK2_Y : TRACK1_Y;
        const cx = PADDING_X + c.start * PX_PER_SECOND;
        const cw = c.duration * PX_PER_SECOND;
        drawSelectionOutline(ctx, cx, trackY, cw, TRACK_H);
      }
    }

    // Marquee rectangle (live during the marquee-drag phase).
    if (marquee?.active) {
      const endPx = PADDING_X + cursor.x * PX_PER_SECOND;
      drawMarquee(ctx, marquee.startPx, marquee.startPy, endPx, cursor.y);
    }

    // Cursor sprite (animation only).
    if (cursor.visible && cursor.opacity > 0) {
      const cxPx = PADDING_X + cursor.x * PX_PER_SECOND;
      drawCursor(ctx, cxPx, cursor.y, cursor.pressed, cursor.opacity);
    }
  }

  cssWidth = host.clientWidth || 600;
  render();
}

// --- drawing helpers -------------------------------------------------------

function drawDarkRuler(ctx, x0, y, w) {
  ctx.save();
  ctx.strokeStyle = COLORS.ruler;
  ctx.fillStyle = COLORS.rulerText;
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.beginPath();
  ctx.moveTo(x0, y + 8);
  ctx.lineTo(x0 + w, y + 8);
  ctx.stroke();
  for (let s = 0; s * PX_PER_SECOND <= w; s += 1) {
    const x = x0 + s * PX_PER_SECOND;
    const tall = s % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x, y + 8 + (tall ? 5 : 2.5));
    ctx.stroke();
    if (tall) ctx.fillText(`${s}s`, x + 3, RULER_LABEL_Y);
  }
  ctx.restore();
}

function drawAudioClip(ctx, startSec, durationSec, y, h, label, c, seed, sourceOffset = 0) {
  const x = PADDING_X + startSec * PX_PER_SECOND;
  const w = durationSec * PX_PER_SECOND;
  if (w < 1) return;

  ctx.save();
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();

  topRoundedRect(ctx, x, y, w, TITLE_BAR_H, 3);
  ctx.fillStyle = c.fillTop;
  ctx.fill();

  if (w > 28) {
    ctx.fillStyle = c.text;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const text = clipText(ctx, label, w - 10);
    ctx.fillText(text, x + 5, y + TITLE_BAR_H / 2 + 0.5);
  }

  // Waveform anchored to source time so trimming/moving doesn't make it
  // "regenerate" — same source range always shows the same shape.
  const bodyY = y + TITLE_BAR_H;
  const bodyH = h - TITLE_BAR_H;
  if (w > 6 && bodyH > 6) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, bodyY + 1, w - 2, bodyH - 2);
    ctx.clip();
    const cy = bodyY + bodyH / 2;
    ctx.strokeStyle = c.text;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const stepPx = 2.5;
    const stepT = stepPx / PX_PER_SECOND;
    const halfH = (bodyH - 6) / 2;
    for (let t = 0; t < durationSec; t += stepT) {
      const px = x + t * PX_PER_SECOND;
      const sourceT = sourceOffset + t;
      const noise =
        Math.abs(Math.sin(sourceT * 4.3 + seed * 0.41)) * 0.55 +
        Math.abs(Math.sin(sourceT * 1.7 + seed * 0.93)) * 0.35 +
        0.1;
      const amp = halfH * noise;
      ctx.moveTo(px, cy - amp);
      ctx.lineTo(px, cy + amp);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawEdgeHandle(ctx, x, y, h) {
  ctx.save();
  ctx.strokeStyle = COLORS.edgeHandle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 3);
  ctx.lineTo(x, y + h - 3);
  ctx.stroke();
  ctx.restore();
}

function drawSelectionOutline(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const r = 4;
  const rr = Math.min(r, (w + 2) / 2, (h + 2) / 2);
  const x0 = x - 1, y0 = y - 1, w0 = w + 2, h0 = h + 2;
  ctx.moveTo(x0 + rr, y0);
  ctx.lineTo(x0 + w0 - rr, y0);
  ctx.quadraticCurveTo(x0 + w0, y0, x0 + w0, y0 + rr);
  ctx.lineTo(x0 + w0, y0 + h0 - rr);
  ctx.quadraticCurveTo(x0 + w0, y0 + h0, x0 + w0 - rr, y0 + h0);
  ctx.lineTo(x0 + rr, y0 + h0);
  ctx.quadraticCurveTo(x0, y0 + h0, x0, y0 + h0 - rr);
  ctx.lineTo(x0, y0 + rr);
  ctx.quadraticCurveTo(x0, y0, x0 + rr, y0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawMarquee(ctx, x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  if (w < 1 && h < 1) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

// macOS-style arrow cursor. Tip is at (0, 0); the body extends down-right.
function drawCursor(ctx, x, y, pressed, opacity) {
  if (pressed) {
    // Pulse ring beneath the cursor as a "click" indicator.
    ctx.save();
    ctx.globalAlpha = opacity * 0.65;
    ctx.strokeStyle = '#000000';
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

function clipText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
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

function seedFromId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

function cloneClips(src) {
  const out = {};
  for (const k of Object.keys(src)) out[k] = { ...src[k] };
  return out;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function applyEase(t, kind) {
  switch (kind) {
    case 'easeIn':    return t * t;
    case 'easeOut':   return 1 - (1 - t) * (1 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'linear':
    default:          return t;
  }
}
