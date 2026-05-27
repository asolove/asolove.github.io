// Pins as constraints — interactive diagram.
//
// Two speech clips with a music clip between them. The music is anchored by
// two pin pairs:
//   left  pin pair: A's interior  ↔  music's left edge / interior
//   right pin pair: B's interior  ↔  music's right edge / interior
// Each pair represents a "tie": two source-time positions that must land at
// the same project-time. There are four independent source-times the user
// can drag — one per pin marker. The layout (music's start, B's start)
// reflows on every drag to keep both pin pairs aligned.
//
// Math:
//   A.start = 0 (spine)
//   A.leftTie.proj  = A.start + pins.aLeftTie
//   M.start         = A.leftTie.proj - pins.mLeftTie
//   M.rightTie.proj = M.start + pins.mRightTie
//   B.start         = M.rightTie.proj - pins.bRightTie
//
// Visual note: dragging a "spine-side" pin (aLeftTie, mRightTie) makes the
// pin follow the cursor, since its project-time is settable. Dragging a
// "music-side" pin (mLeftTie, bRightTie) keeps the pin at a fixed
// project-time (it's anchored to the paired pin) — what moves is the clip
// underneath, scrubbing through its source content under the pin.

import { setupCanvas } from '../lib/timeline-render.js';

// --- model -----------------------------------------------------------------

const A_DUR = 18;
const M_DUR = 14;
const B_DUR = 16;
// Default pins land 1 second inside each end of the music clip so the
// music has visible "tails" on either side of the alignment points —
// reflects how a real podcast bed has fade-in/fade-out tails that play
// beyond the speech-overlap region.
const INITIAL_PINS = Object.freeze({
  aLeftTie:  16,   // sourceTime within A (2s before A ends)
  mLeftTie:  1,    // 1s into the music (left tail is 1s long)
  mRightTie: 13,   // 1s before music's end (right tail is 1s long)
  bRightTie: 2,    // sourceTime within B (2s into B)
});

// Pin definitions: which clip the pin lives on, which side of the gap it
// sits on, and which color (left tie = amber; right tie = orange).
//
// `invertDrag` flips the drag direction for pins whose project-time is
// anchored by the *paired* pin (mLeftTie is anchored to aLeftTie's proj
// time, bRightTie to mRightTie's). Without the flip, dragging right makes
// the affected clip slide left (logical but unintuitive: "the clip moves
// away from my cursor"). With the flip, dragging right makes the clip
// slide right with the cursor — the pin marker still stays put because
// its project-time is constrained, but the body now follows the gesture.
const PIN_DEFS = [
  { id: 'aLeftTie',  clip: 'a', color: 'pinLeft',  edge: 'top' },
  { id: 'mLeftTie',  clip: 'm', color: 'pinLeft',  edge: 'bot', invertDrag: true },
  { id: 'mRightTie', clip: 'm', color: 'pinRight', edge: 'bot' },
  { id: 'bRightTie', clip: 'b', color: 'pinRight', edge: 'top', invertDrag: true },
];

// --- visual config ---------------------------------------------------------

const PADDING_X = 14;
const PX_PER_SECOND = 17;
const RULER_Y = 12;
const RULER_LABEL_Y = 22;
const TRACK1_Y = 32;
const TRACK_H = 36;
const TRACK_GAP = 30;
const TRACK2_Y = TRACK1_Y + TRACK_H + TRACK_GAP;
const HEIGHT = TRACK2_Y + TRACK_H + 6;
const TITLE_BAR_H = 11;

const PIN_ARROW_H = 8;     // height from apex (clip edge) to base
const PIN_ARROW_HW = 4;    // half-width of the arrow base
const PIN_HIT_X = 10;
const PIN_HIT_Y = 11;

const AUTO_POINT_R = 3;
const AUTO_HIT = 7;
const AUTO_BODY_PAD = 2;   // px inset inside clip body for value=0..1

// Music's default automation: silent at start, fades in to a low level
// during the 2-second crossfade with A, rises to full level once the music
// is alone in the gap, ducks back down during the crossfade with B, fades
// out to silence. Speech tracks are flat at unity gain.
const INITIAL_AUTOMATION = Object.freeze({
  a: [
    { offset: 0,     value: 1.0 },
    { offset: A_DUR, value: 1.0 },
  ],
  m: [
    { offset: 0,         value: 0 },
    { offset: 2,         value: 0.3 },
    { offset: 3,         value: 1.0 },
    { offset: M_DUR - 3, value: 1.0 },
    { offset: M_DUR - 2, value: 0.3 },
    { offset: M_DUR,     value: 0 },
  ],
  b: [
    { offset: 0,     value: 1.0 },
    { offset: B_DUR, value: 1.0 },
  ],
});

const COLORS = {
  bg: '#f2eee2',
  trackLane: 'rgba(0, 0, 0, 0.025)',
  trackBorder: 'rgba(0, 0, 0, 0.05)',
  ruler: '#bdb6a4',
  rulerText: '#7a7270',
  speech: { fill: '#3d8260', fillTop: '#2a5b43', stroke: '#15301f', text: '#e6f3ec' },
  music:  { fill: '#3d747f', fillTop: '#2a5158', stroke: '#152e33', text: '#e4f0f3' },
  pinLeft:  '#e8c763',
  pinRight: '#e8a163',
  auto:     '#f5d77a',
};

// --- entry point -----------------------------------------------------------

export default function mount(root) {
  root.innerHTML = `
    <div data-role="canvas-host"></div>
    <div class="ix-controls">
      <button data-action="reset">Reset</button>
    </div>
  `;

  const host = root.querySelector('[data-role="canvas-host"]');
  const resetBtn = root.querySelector('[data-action="reset"]');

  let pins = { ...INITIAL_PINS };
  let automation = cloneAutomation(INITIAL_AUTOMATION);
  let cssWidth = host.clientWidth || 600;
  /** @type {{ kind: 'pin', pinId: string } | { kind: 'auto', clipId: string, idx: number } | null} */
  let hoveredItem = null;
  /** @type {object | null} */
  let activeDrag = null;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display: block; border-radius: 5px; touch-action: none;';
  host.appendChild(canvas);

  function clipDuration(clipId) {
    return clipId === 'a' ? A_DUR : clipId === 'b' ? B_DUR : M_DUR;
  }

  function computeLayout() {
    const a = { start: 0, duration: A_DUR };
    const aLeftTieProj = a.start + pins.aLeftTie;
    const mStart = aLeftTieProj - pins.mLeftTie;
    const m = { start: mStart, duration: M_DUR };
    const mRightTieProj = m.start + pins.mRightTie;
    const bStart = mRightTieProj - pins.bRightTie;
    const b = { start: bStart, duration: B_DUR };
    return {
      a, m, b,
      pinPos: {
        aLeftTie:  aLeftTieProj,
        mLeftTie:  m.start + pins.mLeftTie,    // == aLeftTieProj
        mRightTie: m.start + pins.mRightTie,
        bRightTie: b.start + pins.bRightTie,   // == mRightTieProj
      },
    };
  }

  function pinScreenY(edge) {
    // Approximate vertical center of the arrow handle (for hit-testing).
    return edge === 'top'
      ? TRACK1_Y + TRACK_H + PIN_ARROW_H / 2
      : TRACK2_Y - PIN_ARROW_H / 2;
  }

  function pinScreenPos(pinId) {
    const def = PIN_DEFS.find((p) => p.id === pinId);
    const { pinPos } = computeLayout();
    return {
      x: PADDING_X + pinPos[pinId] * PX_PER_SECOND,
      y: pinScreenY(def.edge),
    };
  }

  // Map automation value (0..1) to a y coordinate inside a clip's body.
  function valueToY(value, clipY) {
    const top = clipY + TITLE_BAR_H + AUTO_BODY_PAD;
    const bot = clipY + TRACK_H - AUTO_BODY_PAD;
    const v = Math.max(0, Math.min(1, value));
    return bot - v * (bot - top);
  }

  function clipYFor(clipId) {
    return clipId === 'm' ? TRACK2_Y : TRACK1_Y;
  }

  // Returns a tagged item descriptor for whatever is under (x, y), or null.
  // Pins (between tracks) take priority over automation points (inside clips).
  function hitTest(x, y) {
    for (const def of PIN_DEFS) {
      const p = pinScreenPos(def.id);
      if (Math.abs(x - p.x) <= PIN_HIT_X && Math.abs(y - p.y) <= PIN_HIT_Y) {
        return { kind: 'pin', pinId: def.id };
      }
    }
    const L = computeLayout();
    for (const clipId of ['a', 'm', 'b']) {
      const points = automation[clipId];
      const clipScreenX = PADDING_X + L[clipId].start * PX_PER_SECOND;
      const cy = clipYFor(clipId);
      for (let idx = 0; idx < points.length; idx++) {
        const px = clipScreenX + points[idx].offset * PX_PER_SECOND;
        const py = valueToY(points[idx].value, cy);
        if (Math.abs(x - px) <= AUTO_HIT && Math.abs(y - py) <= AUTO_HIT) {
          return { kind: 'auto', clipId, idx };
        }
      }
    }
    return null;
  }

  function itemKey(item) {
    if (!item) return '';
    return item.kind === 'pin'
      ? `pin:${item.pinId}`
      : `auto:${item.clipId}:${item.idx}`;
  }

  function clampPinSrc(pinId, value) {
    const def = PIN_DEFS.find((p) => p.id === pinId);
    let v = Math.max(0, Math.min(clipDuration(def.clip), value));
    // Music's left tie must precede its right tie.
    if (pinId === 'mLeftTie'  && v > pins.mRightTie - 0.1) v = pins.mRightTie - 0.1;
    if (pinId === 'mRightTie' && v < pins.mLeftTie  + 0.1) v = pins.mLeftTie  + 0.1;
    return v;
  }

  function getCursorPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function startDrag(item, startX, startY) {
    if (item.kind === 'pin') {
      activeDrag = {
        kind: 'pin',
        pinId: item.pinId,
        startX, startY,
        initialSrc: pins[item.pinId],
      };
    } else {
      const pt = automation[item.clipId][item.idx];
      activeDrag = {
        kind: 'auto',
        clipId: item.clipId,
        idx: item.idx,
        startX, startY,
        initialOffset: pt.offset,
        initialValue: pt.value,
      };
    }
    canvas.style.cursor = 'grabbing';
    render();
  }

  function updateDrag(cursorX, cursorY) {
    if (!activeDrag) return;
    if (activeDrag.kind === 'pin') {
      const dx = cursorX - activeDrag.startX;
      const def = PIN_DEFS.find((p) => p.id === activeDrag.pinId);
      const sign = def?.invertDrag ? -1 : 1;
      pins[activeDrag.pinId] = clampPinSrc(
        activeDrag.pinId,
        activeDrag.initialSrc + (sign * dx) / PX_PER_SECOND,
      );
    } else {
      const points = automation[activeDrag.clipId];
      const clipDur = clipDuration(activeDrag.clipId);
      const dx = cursorX - activeDrag.startX;
      const dy = cursorY - activeDrag.startY;
      // Horizontal: clamp to neighbor offsets so the curve stays monotonic.
      let newOffset = activeDrag.initialOffset + dx / PX_PER_SECOND;
      const minO = activeDrag.idx > 0 ? points[activeDrag.idx - 1].offset + 0.05 : 0;
      const maxO = activeDrag.idx < points.length - 1
        ? points[activeDrag.idx + 1].offset - 0.05
        : clipDur;
      newOffset = Math.max(minO, Math.min(maxO, newOffset));
      // Vertical: pixel delta → value delta. Up is higher value.
      const bodyHeight = TRACK_H - TITLE_BAR_H - AUTO_BODY_PAD * 2;
      let newValue = activeDrag.initialValue - dy / bodyHeight;
      newValue = Math.max(0, Math.min(1, newValue));
      points[activeDrag.idx].offset = newOffset;
      points[activeDrag.idx].value = newValue;
    }
    render();
  }

  function endDrag() {
    if (!activeDrag) return;
    activeDrag = null;
    canvas.style.cursor = hoveredItem ? 'grab' : '';
    render();
  }

  // --- input ---------------------------------------------------------------

  canvas.addEventListener('mousemove', (e) => {
    if (activeDrag) return;
    const { x, y } = getCursorPos(e);
    const newHover = hitTest(x, y);
    if (itemKey(newHover) !== itemKey(hoveredItem)) {
      hoveredItem = newHover;
      canvas.style.cursor = newHover ? 'grab' : '';
      render();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (activeDrag) return;
    if (hoveredItem) {
      hoveredItem = null;
      canvas.style.cursor = '';
      render();
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getCursorPos(e);
    const hit = hitTest(x, y);
    if (!hit) return;
    e.preventDefault();
    startDrag(hit, x, y);
  });

  window.addEventListener('mousemove', (e) => {
    if (!activeDrag) return;
    const p = getCursorPos(e);
    updateDrag(p.x, p.y);
  });

  window.addEventListener('mouseup', endDrag);

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const { x, y } = getTouchPos(e);
    const hit = hitTest(x, y);
    if (!hit) return;
    e.preventDefault();
    startDrag(hit, x, y);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!activeDrag || e.touches.length !== 1) return;
    e.preventDefault();
    const p = getTouchPos(e);
    updateDrag(p.x, p.y);
  }, { passive: false });

  canvas.addEventListener('touchend', endDrag);
  canvas.addEventListener('touchcancel', endDrag);

  resetBtn.addEventListener('click', () => {
    pins = { ...INITIAL_PINS };
    automation = cloneAutomation(INITIAL_AUTOMATION);
    render();
  });

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

    const L = computeLayout();
    drawAudioClip(ctx, L.m.start, L.m.duration, TRACK2_Y, TRACK_H, 'music',     COLORS.music,  seedFromId('m'));
    drawAudioClip(ctx, L.a.start, L.a.duration, TRACK1_Y, TRACK_H, 'segment 1', COLORS.speech, seedFromId('a'));
    drawAudioClip(ctx, L.b.start, L.b.duration, TRACK1_Y, TRACK_H, 'segment 2', COLORS.speech, seedFromId('b'));

    // Automation curves overlaid on each clip's body.
    drawAutomation(ctx, 'a', L.a.start, automation.a, TRACK1_Y);
    drawAutomation(ctx, 'b', L.b.start, automation.b, TRACK1_Y);
    drawAutomation(ctx, 'm', L.m.start, automation.m, TRACK2_Y);

    drawPinPair(ctx, L.pinPos.aLeftTie,  L.pinPos.mLeftTie,  COLORS.pinLeft);
    drawPinPair(ctx, L.pinPos.bRightTie, L.pinPos.mRightTie, COLORS.pinRight);

    for (const def of PIN_DEFS) {
      const projTime = L.pinPos[def.id];
      const x = PADDING_X + projTime * PX_PER_SECOND;
      const isHover = hoveredItem?.kind === 'pin' && hoveredItem.pinId === def.id;
      const isActive = activeDrag?.kind === 'pin' && activeDrag.pinId === def.id;
      drawPinHandle(ctx, x, def.edge, COLORS[def.color], isHover || isActive);
    }
  }

  function drawAutomation(ctx, clipId, clipStart, points, clipY) {
    if (points.length === 0) return;
    const clipScreenX = PADDING_X + clipStart * PX_PER_SECOND;
    const clipRightX = clipScreenX + clipDuration(clipId) * PX_PER_SECOND;
    const top = clipY + TITLE_BAR_H + AUTO_BODY_PAD;
    const bot = clipY + TRACK_H - AUTO_BODY_PAD;

    ctx.save();
    // Clip the curve to the clip's body so it doesn't leak past clip edges.
    ctx.beginPath();
    ctx.rect(clipScreenX, top - 3, clipRightX - clipScreenX, bot - top + 6);
    ctx.clip();

    // Line through the points.
    ctx.strokeStyle = COLORS.auto;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    points.forEach((pt, idx) => {
      const x = clipScreenX + pt.offset * PX_PER_SECOND;
      const y = valueToY(pt.value, clipY);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Breakpoint dots.
    points.forEach((pt, idx) => {
      const x = clipScreenX + pt.offset * PX_PER_SECOND;
      const y = valueToY(pt.value, clipY);
      const isHover  = hoveredItem?.kind === 'auto' && hoveredItem.clipId === clipId && hoveredItem.idx === idx;
      const isActive = activeDrag?.kind  === 'auto' && activeDrag.clipId  === clipId && activeDrag.idx  === idx;
      const highlighted = isHover || isActive;
      const r = AUTO_POINT_R + (highlighted ? 1 : 0);
      ctx.fillStyle = COLORS.auto;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (highlighted) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function drawPinPair(ctx, topProj, botProj, color) {
    const topX = PADDING_X + topProj * PX_PER_SECOND;
    const botX = PADDING_X + botProj * PX_PER_SECOND;
    // Connector runs between the two arrow bases (i.e., the "tails" of the arrows).
    const yA = TRACK1_Y + TRACK_H + PIN_ARROW_H;
    const yB = TRACK2_Y - PIN_ARROW_H;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(topX, yA);
    ctx.lineTo(botX, yB);
    ctx.stroke();
    ctx.restore();
  }

  // Draws a filled triangular arrow whose apex sits at the clip edge and
  // base extends into the gap. edge='top' means the pin is attached to the
  // top track and points up at it; edge='bot' means attached to the bottom
  // track, pointing down at it.
  function drawPinHandle(ctx, x, edge, color, highlighted) {
    const grow = highlighted ? 1.1 : 0;
    const halfW = PIN_ARROW_HW + grow;
    const tipY  = edge === 'top' ? TRACK1_Y + TRACK_H : TRACK2_Y;
    const baseY = edge === 'top'
      ? TRACK1_Y + TRACK_H + PIN_ARROW_H + grow
      : TRACK2_Y - PIN_ARROW_H - grow;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, tipY);
    ctx.lineTo(x - halfW, baseY);
    ctx.lineTo(x + halfW, baseY);
    ctx.closePath();
    ctx.fill();
    if (highlighted) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.3;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- initial mount -------------------------------------------------------

  cssWidth = host.clientWidth || 600;
  render();
}

// --- drawing helpers (same primitives as other interactives) ---------------

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

function drawAudioClip(ctx, startSec, durationSec, y, h, label, c, seed) {
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
      const noise =
        Math.abs(Math.sin(t * 4.3 + seed * 0.41)) * 0.55 +
        Math.abs(Math.sin(t * 1.7 + seed * 0.93)) * 0.35 +
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

function cloneAutomation(src) {
  return {
    a: src.a.map((p) => ({ ...p })),
    b: src.b.map((p) => ({ ...p })),
    m: src.m.map((p) => ({ ...p })),
  };
}
