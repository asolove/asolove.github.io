// Shared rendering primitives for the timeline interactives. Pure functions:
// pass in a 2D context and a description of clips, get a rendered timeline.
//
// Coordinates are in CSS pixels. Caller is responsible for handling DPR
// scaling (use `setupCanvas` once per resize).

export function setupCanvas(canvas, cssWidth, cssHeight) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

const DEFAULTS = {
  rowY: 30,
  rowH: 50,
  trackY: 28,
  trackH: 54,
  pxPerSecond: 18,
  clipFill: '#f4d9cc',
  clipStroke: '#b3441b',
  clipFillDeleted: '#eeeae0',
  clipStrokeDeleted: '#bbb5a8',
  rulerColor: '#c9c3b6',
  textColor: '#1a1a1a',
  textColorSoft: '#666',
};

export function clearTimeline(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
}

export function drawRuler(ctx, x0, y, w, secondsVisible, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  ctx.save();
  ctx.strokeStyle = o.rulerColor;
  ctx.fillStyle = o.textColorSoft;
  ctx.lineWidth = 1;
  ctx.font = '11px -apple-system, system-ui, sans-serif';
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0 + w, y);
  ctx.stroke();
  for (let s = 0; s <= secondsVisible; s += 1) {
    const x = x0 + s * o.pxPerSecond;
    const tall = s % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + (tall ? 6 : 3));
    ctx.stroke();
    if (tall) ctx.fillText(`${s}s`, x + 3, y + 14);
  }
  ctx.restore();
}

/**
 * Draw a single clip block. `position` is in seconds (left edge), `duration`
 * in seconds. Returns the bounding rect in CSS pixels for hit-testing.
 */
export function drawClip(ctx, x0, position, duration, label, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const x = x0 + position * o.pxPerSecond;
  const y = o.trackY;
  const w = duration * o.pxPerSecond;
  const h = o.trackH;
  const fill = opts.deleted ? o.clipFillDeleted : (opts.fill || o.clipFill);
  const stroke = opts.deleted ? o.clipStrokeDeleted : (opts.stroke || o.clipStroke);

  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();

  if (label) {
    ctx.fillStyle = opts.deleted ? o.textColorSoft : o.textColor;
    ctx.font = '12px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const text = w > 30 ? label : '';
    if (text) ctx.fillText(text, x + 8, y + h / 2);
  }
  ctx.restore();
  return { x, y, w, h };
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

export const TIMELINE_DEFAULTS = DEFAULTS;
