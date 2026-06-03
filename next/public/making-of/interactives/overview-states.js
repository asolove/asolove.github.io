// Three side-by-side scroll/overview bars showing how the same scrollbar
// affordance can carry different layers of meaning:
//   - Normal:    speech (blue) + music (purple) clips, thumb, playhead.
//   - Search:    yellow ticks at every search-query match.
//   - History:   green/red/yellow bands for added/removed/changed regions
//                versus a prior version.
//
// Static figure (no interactivity). Shares colors and proportions with
// the scrollbar inside navigation-overview.js so the three reads as the
// same UI element wearing three different hats.

import { setupCanvas } from '../lib/timeline-render.js';

// === PROJECT DATA ==========================================================

// Pre-resolved positions from the canonical layout used in
// navigation-overview.js. Hand-copied — no shared module yet.
const SPEECH = [
  { start:   0, duration: 28 },
  { start:  34, duration: 42 },
  { start:  76, duration: 38 },
  { start: 119, duration: 44 },
  { start: 163, duration: 34 },
  { start: 213, duration: 30 },
  { start: 243, duration: 36 },
  { start: 279, duration: 38 },
  { start: 317, duration: 36 },
  { start: 365, duration: 38 },
  { start: 403, duration: 32 },
  { start: 435, duration: 38 },
  { start: 473, duration: 32 },
  { start: 507, duration: 12 },
];
const MUSIC = [
  { start:  24, duration: 14 },
  { start: 193, duration: 24 },
  { start: 349, duration: 20 },
  { start: 501, duration: 10 },
];
const PROJECT_DURATION = 519;

// Search matches in seconds. Distributed unevenly to look like real
// query results: a tight cluster near the start, a couple of isolated
// hits, a wide quiet stretch, then a small cluster again. Mirrors the
// pattern in editors like VS Code's minimap.
const SEARCH_MATCHES = [28, 34, 39, 180, 365, 372, 478];

// History diff regions — same project, four deliberately different
// shapes so each maps to a recognisable edit:
//   removed (tiny): a skip region that cut a fraction of a second of
//                   audio inside s4. Under a few seconds it renders as
//                   a 3px tick instead of a band.
//   added:          the size of a whole speech clip that was inserted (s7).
//   changed:        the size of the transition music that was
//                   reconfigured (m3).
//   removed (big):  a large chunk near the end — the final section
//                   (s13 + outro) was cut. Same colour as the skip tick
//                   so the reader can compare scales.
const HISTORY_DIFFS = [
  { start: 132,   end: 133.5, kind: 'removed' }, // 1.5s skip inside s4
  { start: 243,   end: 279,   kind: 'added'   }, // s7 — full clip added
  { start: 349,   end: 369,   kind: 'changed' }, // m3 — transition music reconfigured
  { start: 470,   end: 515,   kind: 'removed' }, // 45s removal — final section cut
];

// Shared viewport state — every column shows the thumb and playhead at
// the same project-time, so the reader's eye treats the three as
// snapshots of the same UI. Thumb sits at the top of the project.
const SCROLL_Y       = 0;
const VIEWPORT_SECS  = 70;
const PLAYHEAD_T     = 38;

// === VISUAL CONSTANTS ======================================================

const W = 720;
const H = 380;
const COLUMN_W = W / 3;
// Same width as the scrollbar in navigation-overview.js so the three
// columns read as the same UI element wearing different hats.
const OV_W = 22;
const OV_TOP = 60;
const OV_BOTTOM_PAD = 90;
const OV_H = H - OV_TOP - OV_BOTTOM_PAD;

const COLORS = {
  bg:               '#1b1d22',
  overviewBg:       '#0f1013',
  overviewBorder:   'rgba(255,255,255,0.05)',
  // Lowest layer — speech/music bars sit visually beneath annotations
  // and the thumb, so they're rendered translucent enough that overlays
  // can read without fighting them.
  overviewMain:     'rgba(106, 171, 232, 0.38)',
  overviewMusic:    'rgba(160, 112, 224, 0.48)',
  // Glass thumb — translucent body with a clear top edge highlight, a
  // shine gradient down ~half its height, and a thin outer border.
  thumbFill:        'rgba(255, 255, 255, 0.10)',
  thumbShine:       'rgba(255, 255, 255, 0.28)',
  thumbHighlight:   'rgba(255, 255, 255, 0.60)',
  thumbBorder:      'rgba(230, 232, 238, 0.75)',
  playhead:         '#ffd700',
  titleText:        '#cdd2d8',
  captionText:      '#9a9fa5',
  searchMatch:      'rgba(247, 127, 25, 0.98)',
  searchMatchGlow:  'rgba(247, 127, 25, 0.55)',
  diffAddedFill:    'rgba(94, 200, 130, 0.34)',
  diffRemovedFill:  'rgba(232, 100, 100, 0.34)',
  diffChangedFill:  'rgba(232, 200, 90, 0.34)',
  diffAddedEdge:    'rgba(94, 200, 130, 0.92)',
  diffRemovedEdge:  'rgba(232, 100, 100, 0.92)',
  diffChangedEdge:  'rgba(232, 200, 90, 0.92)',
};

// === ENTRY POINT ===========================================================

export default function mount(root) {
  root.innerHTML = `<div data-role="canvas-host"></div>`;
  const host = root.querySelector('[data-role="canvas-host"]');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block; border-radius:5px; max-width:100%;';
  host.appendChild(canvas);
  render(canvas);
}

function render(canvas) {
  const ctx = setupCanvas(canvas, W, H);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const columns = [
    {
      title: 'NORMAL',
      state: 'normal',
      caption: 'Speech (blue) and music (purple) clips, the current viewport, and the playhead — at a glance.',
    },
    {
      title: 'SEARCH RESULTS',
      state: 'search',
      caption: 'Yellow ticks mark every occurrence of the search query, so far-off matches are visible without scrolling.',
    },
    {
      title: 'HISTORY COMPARE',
      state: 'history',
      caption: 'Tinted regions show what changed versus a prior version: green added, red removed, yellow changed.',
    },
  ];

  for (let i = 0; i < columns.length; i++) {
    drawColumn(ctx, i * COLUMN_W, columns[i]);
  }
}

function drawColumn(ctx, xOff, col) {
  // Title above the overview.
  ctx.save();
  ctx.fillStyle = COLORS.titleText;
  ctx.font = '500 11px -apple-system, system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText(col.title, xOff + COLUMN_W / 2, 24);
  ctx.restore();

  // Overview, centred in the column.
  const ovX = xOff + (COLUMN_W - OV_W) / 2;
  drawOverview(ctx, ovX, OV_TOP, OV_W, OV_H, col.state);

  // Caption wrapped beneath.
  ctx.save();
  ctx.fillStyle = COLORS.captionText;
  ctx.font = '12px -apple-system, system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const cy = OV_TOP + OV_H + 22;
  drawWrappedText(ctx, col.caption, xOff + COLUMN_W / 2, cy, COLUMN_W - 36, 16);
  ctx.restore();
}

function drawOverview(ctx, x, y, w, h, state) {
  ctx.save();

  // Background panel.
  ctx.fillStyle = COLORS.overviewBg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.overviewBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const ovTopY = y + 2;
  const ovBotY = y + h - 2;
  const ovH = ovBotY - ovTopY;
  const yFor = (sec) => ovTopY + (sec / PROJECT_DURATION) * ovH;

  // === Layer 1 (bottom): clip rectangles =================================
  // Same geometry as navigation-overview.js's drawOverview.
  const innerX = x + 3;
  const innerW = w - 6;
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
  for (const c of MUSIC) {
    const y0 = yFor(c.start);
    const y1 = yFor(c.start + c.duration);
    ctx.fillRect(musColX, y0, colW, Math.max(1, y1 - y0));
  }

  // === Layer 2 (middle): annotations =====================================
  if (state === 'search') drawSearchOverlay(ctx, x, w, yFor);
  else if (state === 'history') drawHistoryOverlay(ctx, x, w, yFor);

  // === Layer 3 (top): glass scroll thumb =================================
  // Translucent body so clips + annotations show through, plus a top
  // shine gradient, a 1px white edge highlight, and a clear outer
  // border. The combination reads as a layer sitting in front of the
  // others rather than tinting them.
  const thumbX = x + 1;
  const thumbY = yFor(SCROLL_Y);
  const thumbW = w - 2;
  const thumbH = Math.max(6, yFor(SCROLL_Y + VIEWPORT_SECS) - thumbY);
  const rr = 3;

  // Body fill.
  roundRect(ctx, thumbX, thumbY, thumbW, thumbH, rr);
  ctx.fillStyle = COLORS.thumbFill;
  ctx.fill();

  // Top shine gradient over the upper ~half of the thumb.
  const shineH = Math.min(thumbH * 0.55, 20);
  if (shineH > 3) {
    const grad = ctx.createLinearGradient(0, thumbY, 0, thumbY + shineH);
    grad.addColorStop(0, COLORS.thumbShine);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    roundRect(ctx, thumbX, thumbY, thumbW, shineH, rr);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Top edge highlight — defines where the glass surface starts.
  ctx.strokeStyle = COLORS.thumbHighlight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(thumbX + rr, thumbY + 0.5);
  ctx.lineTo(thumbX + thumbW - rr, thumbY + 0.5);
  ctx.stroke();

  // Outer border.
  roundRect(ctx, thumbX + 0.5, thumbY + 0.5, thumbW - 1, thumbH - 1, rr);
  ctx.strokeStyle = COLORS.thumbBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Golden playhead line.
  const phY = yFor(PLAYHEAD_T);
  ctx.strokeStyle = COLORS.playhead;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(255, 215, 0, 0.55)';
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.moveTo(x + 1, phY);
  ctx.lineTo(x + w - 1, phY);
  ctx.stroke();

  ctx.restore();
}

function drawSearchOverlay(ctx, x, w, yFor) {
  ctx.save();
  ctx.fillStyle = COLORS.searchMatch;
  ctx.shadowColor = COLORS.searchMatchGlow;
  ctx.shadowBlur = 2;
  for (const t of SEARCH_MATCHES) {
    const cy = yFor(t);
    ctx.fillRect(x + 1, cy - 1, w - 2, 2);
  }
  ctx.restore();
}

function drawHistoryOverlay(ctx, x, w, yFor) {
  ctx.save();
  for (const d of HISTORY_DIFFS) {
    let fill, edge;
    if (d.kind === 'added')        { fill = COLORS.diffAddedFill;   edge = COLORS.diffAddedEdge;   }
    else if (d.kind === 'removed') { fill = COLORS.diffRemovedFill; edge = COLORS.diffRemovedEdge; }
    else                            { fill = COLORS.diffChangedFill; edge = COLORS.diffChangedEdge; }
    const y0 = yFor(d.start);
    const y1 = yFor(d.end);
    const px = y1 - y0;

    if (px < 5) {
      // Tiny diff — render as a single 3px tick so it stays legible at
      // small sizes (a band with edges would collapse into noise).
      const cy = (y0 + y1) / 2;
      ctx.fillStyle = edge;
      ctx.fillRect(x + 1, cy - 1.5, w - 2, 3);
    } else {
      ctx.fillStyle = fill;
      ctx.fillRect(x + 1, y0, w - 2, px);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 1, y0);
      ctx.lineTo(x + w - 1, y0);
      ctx.moveTo(x + 1, y1);
      ctx.lineTo(x + w - 1, y1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// === HELPERS ===============================================================

function drawWrappedText(ctx, text, cx, cy, maxW, lineH) {
  const words = text.split(/\s+/);
  let line = '';
  let y = cy;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, cx, y);
      y += lineH;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, y);
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
