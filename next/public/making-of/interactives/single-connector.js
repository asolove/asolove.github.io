// Single connector: a music clip whose start is tied to a point on the
// main (magnetic) speech track. Trimming a speech clip or resizing the
// gap causes everything to reflow, and the music follows because its
// position is derived from the anchor point, not stored as absolute time.
//
// The connector is drawn as a line from the music clip's top edge up to
// track 1, with an arrowhead pointing into the speech track. The anchor
// can be dragged to any point on any speech clip.
//
// Interactions:
//   - Press Play to watch segment 1 trimmed; the music slides to follow.
//   - Drag any speech clip's left or right edge to trim.
//   - Drag the gap's right edge to resize it.
//   - Drag the connector arrow to reposition it on any speech clip.
//   - Drag the music clip body to slide it (moves the anchor).
//   - Press Reset to restore the initial layout.

import { setupCanvas } from '../lib/timeline-render.js';

// --- model -----------------------------------------------------------------

const SPEECH_ITEMS = [
  { kind: 'clip', id: 's1', label: 'segment 1', duration: 6 },
  { kind: 'clip', id: 's2', label: 'segment 2', duration: 5 },
  { kind: 'gap',  id: 'g1', duration: 3 },
  { kind: 'clip', id: 's3', label: 'segment 3', duration: 5 },
];

const MUSIC = { id: 'm1', label: 'music', duration: 8 };
const INITIAL_ANCHOR = Object.freeze({ clipId: 's2', offset: 3 });

const INITIAL_CLIP_STATE = Object.freeze({
  s1: { duration: 6, sourceOffset: 0 },
  s2: { duration: 5, sourceOffset: 0 },
  s3: { duration: 5, sourceOffset: 0 },
});
const INITIAL_GAP_DURATIONS = Object.freeze({ g1: 3 });

const CLIP_IDS = SPEECH_ITEMS.filter((i) => i.kind === 'clip').map((i) => i.id);
const GAP_IDS  = SPEECH_ITEMS.filter((i) => i.kind === 'gap').map((i) => i.id);

const EDGE_HIT_PX = 6;
const GAP_HANDLE_HIT_X = 6;
const CONNECTOR_HIT_PX = 10;
const MIN_CLIP_DUR = 0.3;
const GAP_MIN_DUR = 0.3;

// --- visual config ---------------------------------------------------------

const PADDING_X = 14;
const PX_PER_SECOND = 19;
const RULER_Y = 12;
const RULER_LABEL_Y = 22;
const TRACK1_Y = 32;
const TRACK_H = 36;
const TRACK_GAP = 24;
const TRACK2_Y = TRACK1_Y + TRACK_H + TRACK_GAP;
const HEIGHT = TRACK2_Y + TRACK_H + 6;
const TITLE_BAR_H = 11;

const ARROW_H = 7;
const ARROW_HW = 3.5;

const CURSOR_Y_REST  = TRACK1_Y + TRACK_H * 0.55;
const CURSOR_Y_ABOVE = TRACK1_Y - 14;
const TRIM_FROM = 6;
const TRIM_TO   = 4;

const SCHEDULE = [
  { t:    0, cx: 9.5,      cy: CURSOR_Y_ABOVE, p: false, o: 0, d: TRIM_FROM, ease: 'linear' },
  { t:  120, cx: 9.5,      cy: CURSOR_Y_ABOVE, p: false, o: 1, d: TRIM_FROM, ease: 'easeOut' },
  { t:  720, cx: TRIM_FROM, cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_FROM, ease: 'easeInOut' },
  { t:  870, cx: TRIM_FROM, cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_FROM, ease: 'linear' },
  { t:  970, cx: TRIM_FROM, cy: CURSOR_Y_REST, p: true,  o: 1, d: TRIM_FROM, ease: 'linear' },
  { t: 1770, cx: TRIM_TO,   cy: CURSOR_Y_REST, p: true,  o: 1, d: TRIM_TO,   ease: 'easeInOut' },
  { t: 1900, cx: TRIM_TO,   cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO,   ease: 'linear' },
  { t: 2400, cx: TRIM_TO,   cy: CURSOR_Y_REST, p: false, o: 1, d: TRIM_TO,   ease: 'linear' },
  { t: 2900, cx: TRIM_TO,   cy: CURSOR_Y_ABOVE, p: false, o: 0, d: TRIM_TO,  ease: 'easeIn' },
];

const COLORS = {
  bg: '#1b1d22',
  trackLane: 'rgba(255, 255, 255, 0.025)',
  trackBorder: 'rgba(255, 255, 255, 0.05)',
  ruler: '#3d4046',
  rulerText: '#7a7e85',
  speech: { fill: '#3d8260', fillTop: '#2a5b43', stroke: '#15301f', text: '#e6f3ec' },
  music:  { fill: '#3d747f', fillTop: '#2a5158', stroke: '#152e33', text: '#e4f0f3' },
  edgeHandle: 'rgba(255, 255, 255, 0.85)',
  connector: '#e8c763',
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
  let clipState = cloneClipState(INITIAL_CLIP_STATE);
  let gapDurations = { ...INITIAL_GAP_DURATIONS };
  let anchor = { ...INITIAL_ANCHOR };
  let cursor = { visible: false, x: 0, y: 0, pressed: false, opacity: 0 };
  let animFrame = null;
  /** @type {'idle'|'playing'|'done'} */
  let state = 'idle';
  let hover = null;
  let drag = null;

  function setState(s) {
    state = s;
    playBtn.dataset.state = s;
    playBtn.disabled = s === 'playing';
    playLabel.textContent = s === 'playing' ? 'Playing' : s === 'done' ? 'Replay' : 'Play';
    playBtn.setAttribute('aria-label', playLabel.textContent);
  }

  function reset() {
    cancelAnim();
    clipState = cloneClipState(INITIAL_CLIP_STATE);
    gapDurations = { ...INITIAL_GAP_DURATIONS };
    anchor = { ...INITIAL_ANCHOR };
    cursor.visible = false;
    cursor.opacity = 0;
    hover = null;
    drag = null;
    setState('idle');
    render();
  }

  function cancelAnim() {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  // --- layout --------------------------------------------------------------

  function computeLayout() {
    let cur = 0;
    const itemPos = {};
    for (const item of SPEECH_ITEMS) {
      const dur = item.kind === 'clip' ? clipState[item.id].duration : gapDurations[item.id];
      itemPos[item.id] = { start: cur, duration: dur, kind: item.kind };
      cur += dur;
    }
    const anchorItemDur = itemPos[anchor.clipId].duration;
    const clampedOffset = Math.min(anchor.offset, anchorItemDur);
    const anchorTime = itemPos[anchor.clipId].start + clampedOffset;
    const musicPos = { start: anchorTime, duration: MUSIC.duration };
    return { itemPos, musicPos, anchorTime, totalDur: cur };
  }

  function projectTimeToAnchor(t, itemPos) {
    for (const item of SPEECH_ITEMS) {
      const p = itemPos[item.id];
      if (t >= p.start && t <= p.start + p.duration) {
        return { clipId: item.id, offset: t - p.start };
      }
    }
    const first = SPEECH_ITEMS[0];
    const last = SPEECH_ITEMS[SPEECH_ITEMS.length - 1];
    const pLast = itemPos[last.id];
    if (t <= itemPos[first.id].start) return { clipId: first.id, offset: 0 };
    return { clipId: last.id, offset: pLast.duration };
  }

  // --- hit testing ---------------------------------------------------------

  function getCursorPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTest(x, y) {
    const L = computeLayout();
    const anchorX = PADDING_X + L.anchorTime * PX_PER_SECOND;

    // Connector: arrow + line between tracks
    if (Math.abs(x - anchorX) <= CONNECTOR_HIT_PX &&
        y >= TRACK1_Y + TRACK_H - 4 && y <= TRACK2_Y + 4) {
      return { kind: 'connector' };
    }

    // Speech track items
    if (y >= TRACK1_Y && y <= TRACK1_Y + TRACK_H) {
      for (const item of SPEECH_ITEMS) {
        const p = L.itemPos[item.id];
        const lx = PADDING_X + p.start * PX_PER_SECOND;
        const rx = lx + p.duration * PX_PER_SECOND;
        if (item.kind === 'clip') {
          if (Math.abs(x - lx) <= EDGE_HIT_PX) return { kind: 'clip-edge', id: item.id, side: 'left' };
          if (Math.abs(x - rx) <= EDGE_HIT_PX) return { kind: 'clip-edge', id: item.id, side: 'right' };
        } else if (item.kind === 'gap') {
          if (Math.abs(x - rx) <= GAP_HANDLE_HIT_X) return { kind: 'gap-edge', id: item.id };
        }
      }
    }

    // Music clip body
    if (y >= TRACK2_Y && y <= TRACK2_Y + TRACK_H) {
      const mx = PADDING_X + L.musicPos.start * PX_PER_SECOND;
      const mw = L.musicPos.duration * PX_PER_SECOND;
      if (x >= mx && x <= mx + mw) return { kind: 'music-body' };
    }

    return null;
  }

  function hitKey(h) {
    if (!h) return '';
    if (h.kind === 'clip-edge') return `edge:${h.id}:${h.side}`;
    if (h.kind === 'gap-edge') return `gap:${h.id}`;
    return h.kind;
  }

  // --- interactions --------------------------------------------------------

  canvas.addEventListener('mousemove', (e) => {
    if (drag) return;
    const { x, y } = getCursorPos(e);
    const newHit = hitTest(x, y);
    if (hitKey(newHit) !== hitKey(hover)) {
      hover = newHit;
      if (newHit?.kind === 'clip-edge' || newHit?.kind === 'gap-edge') canvas.style.cursor = 'ew-resize';
      else if (newHit) canvas.style.cursor = 'grab';
      else canvas.style.cursor = '';
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
    cancelAnim();
    cursor.visible = false;
    if (state === 'playing') setState('idle');

    if (hit.kind === 'clip-edge') {
      const cs = clipState[hit.id];
      drag = {
        kind: 'clip-edge', id: hit.id, side: hit.side, startX: x,
        initialDuration: cs.duration, initialSourceOffset: cs.sourceOffset,
      };
      canvas.style.cursor = 'ew-resize';
    } else if (hit.kind === 'gap-edge') {
      drag = { kind: 'gap-edge', id: hit.id, startX: x, initialDur: gapDurations[hit.id] };
      canvas.style.cursor = 'ew-resize';
    } else if (hit.kind === 'connector' || hit.kind === 'music-body') {
      const L = computeLayout();
      drag = { kind: 'connector', startX: x, initialAnchorTime: L.anchorTime };
      canvas.style.cursor = 'grabbing';
    }
    render();
  });

  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const x = e.clientX - canvas.getBoundingClientRect().left;
    const dx = x - drag.startX;
    const dT = dx / PX_PER_SECOND;

    if (drag.kind === 'clip-edge') {
      const cs = clipState[drag.id];
      if (drag.side === 'right') {
        cs.duration = Math.max(MIN_CLIP_DUR, drag.initialDuration + dT);
      } else {
        const newDur = Math.max(MIN_CLIP_DUR, drag.initialDuration - dT);
        cs.sourceOffset = drag.initialSourceOffset + (drag.initialDuration - newDur);
        cs.duration = newDur;
      }
    } else if (drag.kind === 'gap-edge') {
      gapDurations[drag.id] = Math.max(GAP_MIN_DUR, drag.initialDur + dT);
    } else if (drag.kind === 'connector') {
      const L = computeLayout();
      const newTime = Math.max(0, Math.min(L.totalDur, drag.initialAnchorTime + dT));
      anchor = projectTimeToAnchor(newTime, L.itemPos);
    }
    render();
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    drag = null;
    canvas.style.cursor = hover
      ? (hover.kind === 'clip-edge' || hover.kind === 'gap-edge' ? 'ew-resize' : 'grab')
      : '';
    render();
  });

  // --- animation -----------------------------------------------------------

  function play() {
    cancelAnim();
    clipState = cloneClipState(INITIAL_CLIP_STATE);
    gapDurations = { ...INITIAL_GAP_DURATIONS };
    anchor = { ...INITIAL_ANCHOR };
    setState('playing');

    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      let i = 0;
      while (i < SCHEDULE.length - 1 && SCHEDULE[i + 1].t <= elapsed) i++;

      if (i >= SCHEDULE.length - 1) {
        const last = SCHEDULE[SCHEDULE.length - 1];
        cursor.x = last.cx; cursor.y = last.cy;
        cursor.pressed = false; cursor.opacity = last.o;
        cursor.visible = false;
        clipState.s1.duration = last.d;
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
      clipState.s1.duration = lerp(a.d, b.d, eased);

      render();
      animFrame = requestAnimationFrame(step);
    }

    animFrame = requestAnimationFrame(step);
  }

  playBtn.addEventListener('click', play);
  resetBtn.addEventListener('click', reset);

  const ro = new ResizeObserver(() => { cssWidth = host.clientWidth || 600; render(); });
  ro.observe(host);

  // --- render --------------------------------------------------------------

  function render() {
    const w = cssWidth;
    const ctx = setupCanvas(canvas, w, HEIGHT);
    const L = computeLayout();

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, HEIGHT);

    drawDarkRuler(ctx, PADDING_X, RULER_Y, w - PADDING_X * 2);

    // Track lanes
    ctx.fillStyle = COLORS.trackLane;
    ctx.fillRect(PADDING_X, TRACK1_Y, w - PADDING_X * 2, TRACK_H);
    ctx.fillRect(PADDING_X, TRACK2_Y, w - PADDING_X * 2, TRACK_H);
    ctx.strokeStyle = COLORS.trackBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(PADDING_X + 0.5, TRACK1_Y + 0.5, w - PADDING_X * 2 - 1, TRACK_H - 1);
    ctx.strokeRect(PADDING_X + 0.5, TRACK2_Y + 0.5, w - PADDING_X * 2 - 1, TRACK_H - 1);

    // Speech items (clips + gaps)
    for (const item of SPEECH_ITEMS) {
      const p = L.itemPos[item.id];
      if (item.kind === 'clip') {
        drawAudioClip(ctx, p.start, p.duration, TRACK1_Y, TRACK_H, item.label, COLORS.speech, seedFromId(item.id), clipState[item.id].sourceOffset);
      } else {
        const handleHot = (hover?.kind === 'gap-edge' && hover.id === item.id)
                       || (drag?.kind === 'gap-edge' && drag.id === item.id);
        drawGap(ctx, p.start, p.duration, TRACK1_Y, TRACK_H, handleHot);
      }
    }

    // Music clip
    drawAudioClip(ctx, L.musicPos.start, L.musicPos.duration, TRACK2_Y, TRACK_H, MUSIC.label, COLORS.music, seedFromId(MUSIC.id));

    // Connector: line from music top to track 1 bottom, arrow at top
    const anchorX = PADDING_X + L.anchorTime * PX_PER_SECOND;
    const arrowTipY = TRACK1_Y + TRACK_H;
    const arrowBaseY = arrowTipY + ARROW_H;
    const musicTopY = TRACK2_Y;
    const connectorHot = hover?.kind === 'connector' || drag?.kind === 'connector'
                      || hover?.kind === 'music-body' || drag?.kind === 'music-body';

    // Dashed line from arrow base to music clip top
    ctx.save();
    ctx.strokeStyle = COLORS.connector;
    ctx.lineWidth = connectorHot ? 1.5 : 1;
    ctx.setLineDash([3, 3]);
    ctx.globalAlpha = connectorHot ? 0.9 : 0.65;
    ctx.beginPath();
    ctx.moveTo(anchorX, arrowBaseY);
    ctx.lineTo(anchorX, musicTopY);
    ctx.stroke();
    ctx.restore();

    // Arrow pointing up into track 1
    ctx.save();
    ctx.fillStyle = COLORS.connector;
    if (connectorHot) {
      ctx.shadowColor = 'rgba(232, 199, 99, 0.4)';
      ctx.shadowBlur = 4;
    }
    ctx.beginPath();
    ctx.moveTo(anchorX, arrowTipY);
    ctx.lineTo(anchorX - ARROW_HW, arrowBaseY);
    ctx.lineTo(anchorX + ARROW_HW, arrowBaseY);
    ctx.closePath();
    ctx.fill();
    if (connectorHot) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.3;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.restore();

    // Clip edge handle highlight
    const target = drag?.kind === 'clip-edge' ? drag
                 : hover?.kind === 'clip-edge' ? hover
                 : null;
    if (target) {
      const p = L.itemPos[target.id];
      const lx = PADDING_X + p.start * PX_PER_SECOND;
      const edgeX = target.side === 'left' ? lx : lx + p.duration * PX_PER_SECOND;
      drawEdgeHandle(ctx, edgeX, TRACK1_Y, TRACK_H);
    }

    // Music body hover outline
    if ((hover?.kind === 'music-body' || drag?.kind === 'music-body') && drag?.kind !== 'clip-edge') {
      const mx = PADDING_X + L.musicPos.start * PX_PER_SECOND;
      const mw = L.musicPos.duration * PX_PER_SECOND;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, mx, TRACK2_Y, mw, TRACK_H, 3);
      ctx.stroke();
      ctx.restore();
    }

    // Animated cursor
    if (cursor.visible && cursor.opacity > 0) {
      drawCursor(ctx, PADDING_X + cursor.x * PX_PER_SECOND, cursor.y, cursor.pressed, cursor.opacity);
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

function drawGap(ctx, startSec, durationSec, y, h, handleHot) {
  const x = PADDING_X + startSec * PX_PER_SECOND;
  const w = durationSec * PX_PER_SECOND;
  if (w < 1) return;

  ctx.save();
  roundRect(ctx, x, y, w, h, 3);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let sx = x - h; sx < x + w + h; sx += 6) {
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + h, y + h);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 2.5);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = handleHot ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = handleHot ? 2 : 1.4;
  ctx.beginPath();
  ctx.moveTo(x + w - 0.5, y + 4);
  ctx.lineTo(x + w - 0.5, y + h - 4);
  ctx.stroke();
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

function drawCursor(ctx, x, y, pressed, opacity) {
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

function cloneClipState(src) {
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
