// Skip regions: remove parts of a clip without splitting it.
//
// The first clip has a designated "umm" region in source time. When the
// animation runs, the region is highlighted in red and then "applied" —
// the clip's effective duration shrinks by the skip's length, the clip's
// post-skip waveform slides left to meet the pre-skip waveform (so the
// surviving audio is contiguous), and the clips after it slide left
// magnetically.
//
// After applying, a thin marker at the skip junction can be clicked to
// "unfold" the skip region — revealing the hidden audio in place, with
// drag handles to adjust the skip boundaries. The ruler dims in the
// unfolded zone to show it doesn't occupy timeline time.

import { setupCanvas } from '../lib/timeline-render.js';
import { Spring, loop } from '../lib/spring.js';

// --- model -----------------------------------------------------------------

const CLIPS = [
  { id: 's1', label: 'host',  sourceLength: 8 },
  { id: 's2', label: 'guest', sourceLength: 6 },
  { id: 's3', label: 'host',  sourceLength: 5 },
];
const INITIAL_SKIP = { start: 4.5, end: 6.5 };
const GAP = 0;
const MIN_SKIP_DUR = 0.3;
const EDGE_HIT_PX = 8;
const MARKER_HIT_PX = 12;

// --- visual config ---------------------------------------------------------

const PADDING_X = 14;
const PX_PER_SECOND = 19;
const RULER_Y = 12;
const RULER_LABEL_Y = 22;
const TRACK_Y = 32;
const TRACK_H = 36;
const HEIGHT = TRACK_Y + TRACK_H + 6;
const TITLE_BAR_H = 11;

const COLORS = {
  bg: '#f2eee2',
  trackLane: 'rgba(0, 0, 0, 0.025)',
  trackBorder: 'rgba(0, 0, 0, 0.05)',
  ruler: '#bdb6a4',
  rulerText: '#7a7270',
  speech: { fill: '#3d8260', fillTop: '#2a5b43', stroke: '#15301f', text: '#e6f3ec' },
  cutFill:   'rgba(228, 96, 80, 0.45)',
  cutStroke: 'rgba(248, 130, 110, 0.9)',
  skipZone:  'rgba(228, 96, 80, 0.12)',
};

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
  let skip = { ...INITIAL_SKIP };

  const edit = {
    skipApplied: new Spring(0, { stiffness: 180, damping: 26 }),
    cutPreview:  new Spring(0, { stiffness: 220, damping: 28 }),
    unfold:      new Spring(0, { stiffness: 200, damping: 24 }),
  };

  let hover = null;
  let drag = null;
  let stop = null;

  function startLoop() {
    if (stop) return;
    stop = loop((dt) => {
      let settling = false;
      if (edit.skipApplied.tick(dt)) settling = true;
      if (edit.cutPreview.tick(dt)) settling = true;
      if (edit.unfold.tick(dt)) settling = true;
      render();
      if (!settling) { stop = null; return false; }
      return true;
    });
  }

  // --- state ---------------------------------------------------------------

  /** @type {'idle'|'playing'|'done'} */
  let state = 'idle';
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function setState(s) {
    state = s;
    playBtn.dataset.state = s;
    playBtn.disabled = s === 'playing';
    playLabel.textContent = s === 'playing' ? 'Playing' : s === 'done' ? 'Replay' : 'Play';
    playBtn.setAttribute('aria-label', playLabel.textContent);
  }

  function snap(spring, v) {
    spring.value = v;
    spring.target = v;
    spring.velocity = 0;
  }

  function reset() {
    clearTimers();
    if (stop) { stop(); stop = null; }
    snap(edit.skipApplied, 0);
    snap(edit.cutPreview, 0);
    snap(edit.unfold, 0);
    skip = { ...INITIAL_SKIP };
    hover = null;
    drag = null;
    setState('idle');
    render();
  }

  // --- layout --------------------------------------------------------------

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function getER() {
    return clamp(edit.skipApplied.value * (1 - edit.unfold.value), 0, 1);
  }

  function computeLayout() {
    const er = getER();
    const skipDur = skip.end - skip.start;
    const positions = [];
    let cursor = 0;
    for (const c of CLIPS) {
      const sd = c === CLIPS[0] ? skipDur : 0;
      const visualLength = c.sourceLength - sd * er;
      positions.push({ start: cursor, visualLength });
      cursor += visualLength + GAP;
    }
    return positions;
  }

  function skipZonePixels() {
    const er = getER();
    const skipDur = skip.end - skip.start;
    const zoneWidth = skipDur * (1 - er);
    const left = PADDING_X + skip.start * PX_PER_SECOND;
    return { left, width: zoneWidth * PX_PER_SECOND, right: left + zoneWidth * PX_PER_SECOND };
  }

  // --- interactions --------------------------------------------------------

  function getCursorPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTest(x, y) {
    if (y < TRACK_Y || y > TRACK_Y + TRACK_H) return null;
    if (edit.skipApplied.value < 0.5) return null;

    const unfoldVal = edit.unfold.value;

    if (unfoldVal > 0.5) {
      const zone = skipZonePixels();
      const inBody = y > TRACK_Y + TITLE_BAR_H;
      if (inBody && Math.abs(x - zone.left) <= EDGE_HIT_PX) return { kind: 'skip-edge', side: 'start' };
      if (inBody && Math.abs(x - zone.right) <= EDGE_HIT_PX) return { kind: 'skip-edge', side: 'end' };
      if (x >= zone.left - 4 && x <= zone.right + 4) return { kind: 'skip-zone' };
    }

    if (unfoldVal < 0.5) {
      const markerX = PADDING_X + skip.start * PX_PER_SECOND;
      if (Math.abs(x - markerX) <= MARKER_HIT_PX) return { kind: 'marker' };
    }

    return null;
  }

  canvas.addEventListener('mousemove', (e) => {
    if (drag) return;
    const { x, y } = getCursorPos(e);
    const hit = hitTest(x, y);
    hover = hit;
    if (hit?.kind === 'skip-edge') canvas.style.cursor = 'ew-resize';
    else if (hit?.kind === 'marker' || hit?.kind === 'skip-zone') canvas.style.cursor = 'pointer';
    else canvas.style.cursor = '';
  });

  canvas.addEventListener('mouseleave', () => {
    if (!drag) { hover = null; canvas.style.cursor = ''; }
  });

  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getCursorPos(e);
    const hit = hitTest(x, y);

    if (!hit) {
      if (edit.unfold.value > 0.3) {
        edit.unfold.set(0);
        startLoop();
      }
      return;
    }

    e.preventDefault();

    if (hit.kind === 'marker') {
      edit.unfold.set(1);
      startLoop();
    } else if (hit.kind === 'skip-zone') {
      edit.unfold.set(0);
      startLoop();
    } else if (hit.kind === 'skip-edge') {
      drag = {
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
    const x = e.clientX - canvas.getBoundingClientRect().left;
    const dx = x - drag.startX;
    const dt = dx / PX_PER_SECOND;

    if (drag.side === 'start') {
      skip.start = clamp(drag.initialStart + dt, 0, drag.initialEnd - MIN_SKIP_DUR);
    } else {
      skip.end = clamp(drag.initialEnd + dt, drag.initialStart + MIN_SKIP_DUR, CLIPS[0].sourceLength);
    }
    render();
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    drag = null;
    canvas.style.cursor = hover?.kind === 'skip-edge' ? 'ew-resize' : '';
  });

  // --- play ----------------------------------------------------------------

  function play() {
    if (state === 'playing') return;
    reset();
    setState('playing');

    edit.cutPreview.set(1);
    startLoop();

    timers.push(setTimeout(() => {
      edit.skipApplied.set(1);
      edit.cutPreview.set(0);
      startLoop();
      timers.push(setTimeout(() => setState('done'), 1700));
    }, 800));
  }

  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', reset);

  const ro = new ResizeObserver(() => { cssWidth = host.clientWidth || 600; render(); });
  ro.observe(host);

  // --- render --------------------------------------------------------------

  function render() {
    const w = cssWidth;
    const ctx = setupCanvas(canvas, w, HEIGHT);
    const er = getER();
    const skipDur = skip.end - skip.start;
    const positions = computeLayout();
    const unfoldVal = edit.unfold.value;
    const skipAppliedVal = edit.skipApplied.value;

    // The ruler "break" only appears while unfolding an applied skip
    const rulerBreak = skipDur * clamp(skipAppliedVal, 0, 1) * clamp(unfoldVal, 0, 1);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, HEIGHT);

    drawRulerWithBreak(ctx, PADDING_X, RULER_Y, w - PADDING_X * 2, skip.start, rulerBreak);

    ctx.fillStyle = COLORS.trackLane;
    ctx.fillRect(PADDING_X, TRACK_Y, w - PADDING_X * 2, TRACK_H);
    ctx.strokeStyle = COLORS.trackBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(PADDING_X + 0.5, TRACK_Y + 0.5, w - PADDING_X * 2 - 1, TRACK_H - 1);

    // Clips
    CLIPS.forEach((c, i) => {
      const p = positions[i];
      const clipSkip = i === 0 ? skip : null;
      drawClipWithSkip(ctx, p.start, p.visualLength, clipSkip, er, TRACK_Y, TRACK_H, c.label, COLORS.speech, seedFromId(c.id));
    });

    // Skip zone overlay (when unfolding/unfolded)
    if (unfoldVal > 0.01 && skipAppliedVal > 0.01) {
      const zone = skipZonePixels();
      if (zone.width > 0.5) {
        ctx.save();
        ctx.globalAlpha = unfoldVal;
        ctx.fillStyle = COLORS.cutFill;
        roundRect(ctx, zone.left, TRACK_Y + 1, zone.width, TRACK_H - 2, 2);
        ctx.fill();
        ctx.restore();

        // Drag handles (fade in during last 30% of unfold)
        if (unfoldVal > 0.7) {
          const alpha = (unfoldVal - 0.7) / 0.3;
          [zone.left, zone.right].forEach((hx) => {
            const side = hx === zone.left ? 'start' : 'end';
            const isHot = (drag?.side === side)
                       || (hover?.kind === 'skip-edge' && hover?.side === side);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = isHot ? '#fff' : COLORS.cutStroke;
            ctx.lineWidth = isHot ? 2.5 : 2;
            ctx.beginPath();
            ctx.moveTo(hx, TRACK_Y + 3);
            ctx.lineTo(hx, TRACK_Y + TRACK_H - 3);
            ctx.stroke();
            ctx.restore();
          });
        }
      }
    }

    // Cut preview overlay (play animation only — unfold is 0 here)
    const previewOpacity = Math.max(0, edit.cutPreview.value);
    if (previewOpacity > 0.01) {
      const overlayWidth = skipDur * (1 - skipAppliedVal);
      if (overlayWidth > 0.01) {
        const x = PADDING_X + skip.start * PX_PER_SECOND;
        const wpx = overlayWidth * PX_PER_SECOND;
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
    }

    // Skip marker (when folded and skip applied)
    if (skipAppliedVal > 0.01 && unfoldVal < 0.99) {
      const markerX = PADDING_X + skip.start * PX_PER_SECOND;
      const isHot = hover?.kind === 'marker';
      ctx.save();
      ctx.globalAlpha = skipAppliedVal * (1 - unfoldVal) * (isHot ? 1 : 0.7);
      ctx.strokeStyle = COLORS.cutStroke;
      ctx.lineWidth = isHot ? 2 : 1.5;
      ctx.setLineDash([2, 2.5]);
      ctx.beginPath();
      ctx.moveTo(markerX, TRACK_Y + 2);
      ctx.lineTo(markerX, TRACK_Y + TRACK_H - 2);
      ctx.stroke();
      ctx.restore();
    }

    // Fold chevron — ▼ when closed (tip on the marker line), ▶ when open
    // (left edge on the start line). Rotates -90° as unfold goes 0→1.
    if (skipAppliedVal > 0.01) {
      const chevronX = PADDING_X + skip.start * PX_PER_SECOND;
      const chevronY = TRACK_Y + TITLE_BAR_H / 2 + 0.5;
      const sz = 3.5;
      const isHot = hover?.kind === 'marker' || hover?.kind === 'skip-zone';
      const t = clamp(unfoldVal, 0, 1);
      ctx.save();
      ctx.globalAlpha = skipAppliedVal * (isHot ? 1 : 0.75);
      ctx.translate(chevronX, chevronY);
      // Start pointing down (PI/2), rotate to pointing right (0)
      ctx.rotate((1 - t) * Math.PI / 2);
      ctx.fillStyle = isHot ? '#fff' : COLORS.cutStroke;
      ctx.beginPath();
      // Right-pointing triangle with left edge at x=0
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

// --- drawing helpers -------------------------------------------------------

function drawRulerWithBreak(ctx, x0, y, totalWidth, breakTime, breakDur) {
  ctx.save();
  ctx.strokeStyle = COLORS.ruler;
  ctx.fillStyle = COLORS.rulerText;
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, "SF Mono", Menlo, monospace';

  ctx.beginPath();
  ctx.moveTo(x0, y + 8);
  ctx.lineTo(x0 + totalWidth, y + 8);
  ctx.stroke();

  // Dimmed zone on ruler where the skip is unfolded
  const zoneStartPx = x0 + breakTime * PX_PER_SECOND;
  const zoneWidthPx = breakDur * PX_PER_SECOND;
  if (zoneWidthPx > 1) {
    ctx.fillStyle = COLORS.skipZone;
    ctx.fillRect(zoneStartPx, y, zoneWidthPx, 16);
    ctx.fillStyle = COLORS.rulerText;
  }

  for (let s = 0; ; s += 1) {
    const visualX = s <= breakTime
      ? x0 + s * PX_PER_SECOND
      : x0 + (s + breakDur) * PX_PER_SECOND;
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

function drawClipWithSkip(ctx, startSec, visualLength, skip, effectiveRemoval, y, h, label, c, seed) {
  const x = PADDING_X + startSec * PX_PER_SECOND;
  const w = visualLength * PX_PER_SECOND;
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

    const skipStart = skip ? skip.start : Infinity;
    const skipDur = skip ? skip.end - skip.start : 0;
    const skipZoneWidth = skipDur * (1 - effectiveRemoval);

    for (let t = 0; t < visualLength; t += stepT) {
      let srcT;
      if (t <= skipStart) {
        srcT = t;
      } else if (skipZoneWidth > 0.001 && t <= skipStart + skipZoneWidth) {
        const frac = (t - skipStart) / skipZoneWidth;
        srcT = skipStart + frac * skipDur;
      } else {
        srcT = t + skipDur * effectiveRemoval;
      }
      const px = x + t * PX_PER_SECOND;
      const noise =
        Math.abs(Math.sin(srcT * 4.3 + seed * 0.41)) * 0.55 +
        Math.abs(Math.sin(srcT * 1.7 + seed * 0.93)) * 0.35 +
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
