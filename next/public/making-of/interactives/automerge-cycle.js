// Automerge as a React-like data layer: the UI subscribes to the
// document and dispatches actions; everything else (local persistence,
// history, broadcast, receive, merge) happens transparently behind the
// doc. The figure traces the lifecycle of one *local* action and then
// one *remote* action, lighting up each side effect as it fires.
//
// Three columns:
//   APP UI       — a tiny editor showing a row of clips (the rendered
//                  view of the doc's data)
//   AUTOMERGE    — the document itself, the hub everything flows through
//   SIDE EFFECTS — three cards stacked: local storage, history, peers
//                  (with a peers card that both sends and receives)
//
// Press Play to watch one full round-trip:
//   1. User clicks a "trim" handle on a clip in the UI.
//   2. Action dispatches to the doc.
//   3. Doc applies the change, simultaneously: saves locally, appends
//      to history, broadcasts to peers.
//   4. UI re-renders with the trimmed clip.
//   5. A peer's change arrives (delete a different clip).
//   6. Doc merges it, fires its own side effects, UI re-renders.

import { setupCanvas } from '../lib/timeline-render.js';

// === DIMENSIONS ======================================================

const W = 720;
const H = 420;
const TOP_LABEL_Y = 18;

// UI card (left column)
const UI_X = 30, UI_Y = 70, UI_W = 200, UI_H = 280;

// Doc card (middle column)
const DOC_X = 260, DOC_Y = 60, DOC_W = 210, DOC_H = 300;

// Right column cards
const RIGHT_X = 510, RIGHT_W = 180;
const STORAGE_Y = 60,  STORAGE_H = 78;
const HISTORY_Y = 148, HISTORY_H = 90;
const PEERS_Y   = 248, PEERS_H   = 120;

// === UI MODEL ========================================================

// 4 clips in a row in the UI / doc. The interactive shows a local
// "trim" of clip 3 (index 2) shrinking it, then a remote "delete" of
// clip 2 (index 1) removing it.

const UI_PAD = 10;
const CLIPS_ROW_Y = UI_Y + 90;
const CLIPS_ROW_H = 56;
const CLIPS_ROW_X = UI_X + UI_PAD;
const CLIPS_ROW_W = UI_W - UI_PAD * 2;
const CLIP_GAP    = 4;

// Same clip row, drawn smaller, inside the doc card.
const DOC_CLIPS_ROW_Y = DOC_Y + 130;
const DOC_CLIPS_ROW_H = 50;
const DOC_CLIPS_ROW_X = DOC_X + 16;
const DOC_CLIPS_ROW_W = DOC_W - 32;

const CLIP_LABELS = ['c1', 'c2', 'c3', 'c4'];

// === COLORS ==========================================================

const COLORS = {
  bg:           '#1b1d22',
  cardBg:       'rgba(255, 255, 255, 0.035)',
  cardBorder:   'rgba(255, 255, 255, 0.10)',
  cardBorderHi: 'rgba(255, 255, 255, 0.30)',
  label:        '#bcc1c8',
  labelDim:     '#7a7e85',
  subtitle:     '#7a7e85',
  sectionLabel: '#7a7e85',

  arrow:        'rgba(255, 255, 255, 0.18)',
  arrowText:    'rgba(255, 255, 255, 0.45)',

  // Local user changes use green; remote (peer) changes use gold so
  // the viewer can distinguish "your" actions from "theirs".
  local:        '#5ec88a',
  localGlow:    'rgba(94, 200, 138, 0.85)',
  localSoft:    'rgba(94, 200, 138, 0.18)',

  remote:       '#f5d77a',
  remoteGlow:   'rgba(245, 215, 122, 0.90)',
  remoteSoft:   'rgba(245, 215, 122, 0.18)',

  // Doc accent
  docStroke:    'rgba(255, 255, 255, 0.22)',
  docFill:      'rgba(255, 255, 255, 0.03)',
  docTitle:     '#e2e6ec',

  // Clip rendering inside the UI / doc data row.
  clipFill:     'rgba(94, 200, 138, 0.18)',
  clipFillTop:  'rgba(94, 200, 138, 0.40)',
  clipStroke:   'rgba(94, 200, 138, 0.70)',
  clipText:     '#e6f3ec',

  // Icons
  iconNeutral:  '#9aa1a8',
};

// === ANIMATION SCHEDULE (ms) =========================================

const STAGES = {
  // --- local action lifecycle ---
  uiClick:      { start:  700, end: 1000 },   // trim-handle pulses
  dispatch:     { start: 1000, end: 1450 },   // arrow UI → Doc
  docApplyL:    { start: 1450, end: 1800 },   // doc data flashes
  fxSaveL:      { start: 1800, end: 2250 },   // doc → storage arrow + storage card glow
  fxHistoryL:   { start: 1800, end: 2250 },   // doc → history (new tick)
  fxBroadcastL: { start: 1800, end: 2250 },   // doc → peers
  subscribeL:   { start: 2200, end: 2700 },   // doc → ui arrow
  uiTrim:       { start: 2400, end: 2900 },   // clip 3 shrinks

  // --- pause, then remote change arrives ---
  recvRemote:   { start: 3500, end: 3950 },   // arrow peers → Doc
  docApplyR:    { start: 3950, end: 4300 },   // doc data flashes (different color)
  fxSaveR:      { start: 4300, end: 4750 },
  fxHistoryR:   { start: 4300, end: 4750 },
  subscribeR:   { start: 4700, end: 5200 },
  uiDelete:     { start: 4900, end: 5400 },   // clip 2 collapses
};
const TOTAL_MS = 5700;

// === EASING / HELPERS ================================================

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

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
  let elapsed   = TOTAL_MS; // idle = final state

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
    elapsed = TOTAL_MS;
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

  // Stage progress 0..1.
  // - Idle: 0 (pristine "before any action" state).
  // - Done: 1 (final state after the round-trip).
  // - Playing: linear progress between start and end ms.
  function P(name) {
    const s = STAGES[name];
    if (state === 'idle') return 0;
    if (state === 'done') return 1;
    if (elapsed <= s.start) return 0;
    if (elapsed >= s.end) return 1;
    return (elapsed - s.start) / (s.end - s.start);
  }

  // Convenience: 1.0 while we're in `(start - lead, end + tail)`, 0 else.
  // Used for "the arrow is bright RIGHT NOW" highlights.
  function active(name, lead = 0, tail = 250) {
    if (state === 'idle' || state === 'done') return 0;
    const s = STAGES[name];
    if (elapsed < s.start - lead) return 0;
    if (elapsed > s.end + tail) return 0;
    // Bell curve: fade in over `lead`, full during, fade out over `tail`.
    if (elapsed < s.start) return (elapsed - (s.start - lead)) / lead;
    if (elapsed > s.end)   return 1 - (elapsed - s.end) / tail;
    return 1;
  }

  function render() {
    const ctx = setupCanvas(canvas, W, H);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    drawColumnHeaders(ctx);

    // Static arrows first, then card contents on top of any arrow heads
    // that bleed into card edges.
    drawArrows(ctx);

    drawUICard(ctx);
    drawDocCard(ctx);
    drawSideCards(ctx);

    drawFlyingPills(ctx);
  }

  // ---- column headers ---------------------------------------------

  function drawColumnHeaders(ctx) {
    ctx.save();
    ctx.fillStyle = COLORS.sectionLabel;
    ctx.font = '600 10px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.fillText('APP UI',     UI_X + UI_W / 2,  TOP_LABEL_Y);
    ctx.fillText('AUTOMERGE',  DOC_X + DOC_W / 2, TOP_LABEL_Y);
    ctx.fillText('SIDE EFFECTS', RIGHT_X + RIGHT_W / 2, TOP_LABEL_Y);

    ctx.font = '400 9px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = COLORS.labelDim;
    ctx.fillText('renders + dispatches', UI_X + UI_W / 2,   TOP_LABEL_Y + 12);
    ctx.fillText('the project document', DOC_X + DOC_W / 2, TOP_LABEL_Y + 12);
    ctx.fillText('all transparent',      RIGHT_X + RIGHT_W / 2, TOP_LABEL_Y + 12);
    ctx.restore();
  }

  // ---- arrows ------------------------------------------------------

  // Five arrows total:
  //   UI → Doc  (dispatch)        top of the UI↔Doc gap
  //   Doc → UI  (subscribe)       bottom of the UI↔Doc gap
  //   Doc → Storage               horizontal to storage card
  //   Doc ↔ History               horizontal to history card
  //   Doc ↔ Peers                 horizontal to peers card (both ways)

  function drawArrows(ctx) {
    // UI <-> Doc
    const uiR = UI_X + UI_W;
    const docL = DOC_X;
    const yDispatch  = CLIPS_ROW_Y + CLIPS_ROW_H / 2 - 8;
    const ySubscribe = CLIPS_ROW_Y + CLIPS_ROW_H / 2 + 8;
    drawArrow(ctx, uiR + 4, yDispatch, docL - 4, yDispatch,
              'dispatch', active('dispatch'),  COLORS.local);

    // Subscribe arrow can carry either local or remote re-render.
    {
      const sL = active('subscribeL');
      const sR = active('subscribeR');
      const color = sR > sL ? COLORS.remote : COLORS.local;
      drawArrow(ctx, docL - 4, ySubscribe, uiR + 4, ySubscribe,
                'subscribe', Math.max(sL, sR), color);
    }

    // Doc -> side effects
    const docR = DOC_X + DOC_W;
    const yStore = STORAGE_Y + STORAGE_H / 2;
    const yHist  = HISTORY_Y + HISTORY_H / 2;
    const yPeers = PEERS_Y + PEERS_H / 2;

    {
      const aL = active('fxSaveL');
      const aR = active('fxSaveR');
      const color = aR > aL ? COLORS.remote : COLORS.local;
      drawArrow(ctx, docR + 4, yStore, RIGHT_X - 4, yStore,
                'save', Math.max(aL, aR), color);
    }
    {
      const aL = active('fxHistoryL');
      const aR = active('fxHistoryR');
      const color = aR > aL ? COLORS.remote : COLORS.local;
      drawArrow(ctx, docR + 4, yHist, RIGHT_X - 4, yHist,
                'append', Math.max(aL, aR), color);
    }

    // Peers: bidirectional, two parallel arrows (broadcast above,
    // receive below).
    drawArrow(ctx, docR + 4, yPeers - 8, RIGHT_X - 4, yPeers - 8,
              'broadcast', active('fxBroadcastL'), COLORS.local);
    drawArrow(ctx, RIGHT_X - 4, yPeers + 8, docR + 4, yPeers + 8,
              'receive',   active('recvRemote'),   COLORS.remote);
  }

  function drawArrow(ctx, x1, y1, x2, y2, label, brightness, brightColor) {
    const dim = COLORS.arrow;
    const color = brightness > 0
      ? mixRgba(dim, brightColor, easeOut(brightness))
      : dim;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = brightness > 0 ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    arrowHead(ctx, x2, y2, x1 < x2 ? 1 : -1);

    if (label) {
      ctx.fillStyle = brightness > 0
        ? mixRgba(COLORS.arrowText, brightColor, easeOut(brightness))
        : COLORS.arrowText;
      ctx.font = '500 9px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, (x1 + x2) / 2, y1 - 6);
    }
    ctx.restore();
  }

  function arrowHead(ctx, x, y, dir) {
    const dx = 6 * dir;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx, y - 3.5);
    ctx.lineTo(x - dx, y + 3.5);
    ctx.closePath();
    ctx.fill();
  }

  // ---- UI card -----------------------------------------------------

  function drawUICard(ctx) {
    ctx.save();
    ctx.fillStyle = COLORS.cardBg;
    ctx.strokeStyle = COLORS.cardBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, UI_X, UI_Y, UI_W, UI_H, 6);
    ctx.fill();
    ctx.stroke();

    // Header bar to suggest "an app window"
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    topRoundedRect(ctx, UI_X, UI_Y, UI_W, 24, 6);
    ctx.fill();

    // Traffic-light dots
    const dotY = UI_Y + 12;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(UI_X + 10 + i * 12, dotY, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('episode 4 · editor', UI_X + 56, dotY + 0.5);

    // Section label "timeline"
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '600 9px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('timeline', UI_X + UI_PAD, CLIPS_ROW_Y - 8);

    // The clip row.
    drawClipsRow(ctx, CLIPS_ROW_X, CLIPS_ROW_Y, CLIPS_ROW_W, CLIPS_ROW_H);

    // "trim" handle/cursor that pulses on uiClick. Hidden once the
    // local trim has completed (clip 3 is already at its new size).
    drawTrimHandle(ctx);

    // Helper text below: explains what the user is doing.
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '400 10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('user trims clip 3 →', UI_X + UI_PAD, UI_Y + UI_H - 20);

    ctx.restore();
  }

  // Visual layout of the clip array, accounting for the trim and delete
  // animations in the UI. Returns the array of clip rects.
  function clipLayout(rowX, rowY, rowW, rowH) {
    // Each clip has a current "size factor" (1 = full base width, 0 =
    // collapsed) and an "alpha" (1 = visible, 0 = gone).
    const trim   = clamp01(P('uiTrim'));
    const remove = clamp01(P('uiDelete'));

    // size[i] is the fraction of the BASE width each clip currently
    // occupies. Clip 2 (index 1) collapses to 0; clip 3 (index 2) shrinks
    // to ~0.55. Other clips stay full-size.
    const sizes = [
      1,
      1 - remove,             // clip 2: collapses
      1 - 0.45 * trim,        // clip 3: trimmed to ~0.55
      1,
    ];
    const alphas = [1, 1 - remove, 1, 1];

    // Total of base widths (without scaling) and gaps between visible
    // clips. We size so that at the *final* layout (sizes [1, 0, 0.55, 1])
    // the row still fits — i.e. compute base width relative to the
    // initial state with all four at 1, plus 3 gaps. The collapsed
    // widths free up space; we let other clips expand into that space?
    // For simplicity, NO expansion: missing space just becomes margin
    // on the right. This reads as "deleted clip removed; row gets
    // shorter" which is fine for the figure.
    const baseW = (rowW - CLIP_GAP * 3) / 4;
    const rects = [];
    let x = rowX;
    for (let i = 0; i < 4; i++) {
      const w = baseW * sizes[i];
      rects.push({ x, y: rowY, w, h: rowH, alpha: alphas[i], label: CLIP_LABELS[i] });
      x += w + CLIP_GAP;
    }
    return rects;
  }

  function drawClipsRow(ctx, rowX, rowY, rowW, rowH) {
    const rects = clipLayout(rowX, rowY, rowW, rowH);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.alpha <= 0.01 || r.w < 1) continue;
      ctx.save();
      ctx.globalAlpha = r.alpha;
      drawMiniClip(ctx, r.x, r.y, r.w, r.h, r.label);
      ctx.restore();
    }
  }

  function drawMiniClip(ctx, x, y, w, h, label) {
    ctx.save();
    ctx.fillStyle = COLORS.clipFill;
    ctx.strokeStyle = COLORS.clipStroke;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.stroke();

    // Title bar
    ctx.fillStyle = COLORS.clipFillTop;
    topRoundedRect(ctx, x, y, w, 10, 3);
    ctx.fill();

    if (w > 22) {
      ctx.fillStyle = COLORS.clipText;
      ctx.font = '500 8px -apple-system, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 4, y + 5.5);
    }
    ctx.restore();
  }

  // A tiny "trim" arrow that points at clip 3's right edge and pulses
  // during the uiClick stage. Drawn outside the clip so it reads as a
  // cursor about to interact.
  function drawTrimHandle(ctx) {
    const rects = clipLayout(CLIPS_ROW_X, CLIPS_ROW_Y, CLIPS_ROW_W, CLIPS_ROW_H);
    const c3 = rects[2];
    if (!c3 || c3.w < 1) return;

    // Visible at idle (a hint of what's about to happen), bright while
    // the click stage pulses, gone once the trim has actually applied.
    const pulse = active('uiClick', 200, 200);
    let baseAlpha;
    if (state === 'idle') baseAlpha = 0.35;
    else if (state === 'done') baseAlpha = 0;
    else if (elapsed > STAGES.uiTrim.start) baseAlpha = 0;
    else baseAlpha = 0.25;
    const alpha = Math.min(1, baseAlpha + 0.65 * pulse);
    if (alpha <= 0.01) return;

    const handleX = c3.x + c3.w;
    const handleY = c3.y + c3.h + 6;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.local;
    ctx.fillStyle   = COLORS.local;
    ctx.lineWidth = 1.4;
    // A small upward arrow + "trim" label
    ctx.beginPath();
    ctx.moveTo(handleX, handleY);
    ctx.lineTo(handleX - 5, handleY + 6);
    ctx.lineTo(handleX + 5, handleY + 6);
    ctx.closePath();
    ctx.fill();

    ctx.font = '500 8px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('trim', handleX, handleY + 18);

    ctx.restore();
  }

  // ---- Doc card ----------------------------------------------------

  function drawDocCard(ctx) {
    ctx.save();

    // Card background with a slightly brighter border to indicate it's
    // the hub. Border flashes when a change is being applied.
    const flashL = active('docApplyL', 100, 300);
    const flashR = active('docApplyR', 100, 300);
    const flashColor = flashR > flashL ? COLORS.remoteGlow : COLORS.localGlow;
    const flash = Math.max(flashL, flashR);

    ctx.fillStyle = COLORS.docFill;
    ctx.strokeStyle = flash > 0
      ? mixRgba(COLORS.docStroke, flashColor, easeOut(flash))
      : COLORS.docStroke;
    ctx.lineWidth = flash > 0 ? 1.6 : 1.2;
    roundRect(ctx, DOC_X, DOC_Y, DOC_W, DOC_H, 6);
    ctx.fill();
    ctx.stroke();

    // Header
    ctx.fillStyle = COLORS.docTitle;
    ctx.font = '600 12px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('project document', DOC_X + DOC_W / 2, DOC_Y + 28);

    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '400 10px -apple-system, system-ui, sans-serif';
    ctx.fillText('Automerge CRDT', DOC_X + DOC_W / 2, DOC_Y + 46);

    // The clips data, mirrored from the UI so the viewer sees that
    // doc-and-UI track the same array. This is the data being mutated.
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '500 10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('clips', DOC_CLIPS_ROW_X, DOC_CLIPS_ROW_Y - 8);
    drawClipsRow(ctx, DOC_CLIPS_ROW_X, DOC_CLIPS_ROW_Y, DOC_CLIPS_ROW_W, DOC_CLIPS_ROW_H);

    // Helper text below the clips: caption about what's happening here.
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '400 10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('changes applied here', DOC_X + DOC_W / 2, DOC_CLIPS_ROW_Y + DOC_CLIPS_ROW_H + 28);
    ctx.fillText('fan out to all side effects', DOC_X + DOC_W / 2, DOC_CLIPS_ROW_Y + DOC_CLIPS_ROW_H + 44);

    drawChangeCounter(ctx);

    ctx.restore();
  }

  function drawChangeCounter(ctx) {
    const x = DOC_X + DOC_W - 16;
    const y = DOC_Y + DOC_H - 16;

    // Counter advances as each docApply stage completes.
    // Idle: pre-action (26). Done: post-both-actions (28). Playing:
    // ticks up each time a change lands.
    let count = 26;
    if (state === 'done') {
      count = 28;
    } else if (state === 'playing') {
      if (elapsed >= STAGES.docApplyL.end) count++;
      if (elapsed >= STAGES.docApplyR.end) count++;
    }

    ctx.save();
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${count} changes`, x, y);
    ctx.restore();
  }

  // ---- side cards (storage, history, peers) -----------------------

  function drawSideCards(ctx) {
    ctx.save();
    drawSideCard(ctx, RIGHT_X, STORAGE_Y, RIGHT_W, STORAGE_H,
                 'local storage', 'saves automatically',
                 Math.max(active('fxSaveL'), active('fxSaveR')),
                 (cx, cy) => drawDiskIcon(ctx, cx, cy));

    drawSideCard(ctx, RIGHT_X, HISTORY_Y, RIGHT_W, HISTORY_H,
                 'history', 'every change, timestamped',
                 Math.max(active('fxHistoryL'), active('fxHistoryR')),
                 (cx, cy) => drawHistoryIcon(ctx, cx, cy));

    drawSideCard(ctx, RIGHT_X, PEERS_Y, RIGHT_W, PEERS_H,
                 'peers', 'broadcast + receive · merge',
                 Math.max(active('fxBroadcastL'), active('recvRemote')),
                 (cx, cy) => drawPeersIcon(ctx, cx, cy));

    ctx.restore();
  }

  function drawSideCard(ctx, x, y, w, h, title, sub, glow, drawIcon) {
    ctx.save();
    ctx.fillStyle = COLORS.cardBg;
    ctx.strokeStyle = glow > 0
      ? mixRgba(COLORS.cardBorder, COLORS.localGlow, easeOut(glow))
      : COLORS.cardBorder;
    ctx.lineWidth = glow > 0 ? 1.4 : 1;
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.stroke();

    // Icon on the left
    drawIcon(x + 22, y + 22);

    // Title + subtitle on the right
    ctx.fillStyle = COLORS.label;
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 52, y + 22);

    ctx.fillStyle = COLORS.subtitle;
    ctx.font = '400 10px -apple-system, system-ui, sans-serif';
    ctx.fillText(sub, x + 52, y + 38);

    ctx.restore();
  }

  // ---- flying pills ------------------------------------------------
  // Small colored circle that traces an arrow during its active stage,
  // representing "the action in flight." The label rides on the arrow.

  function drawFlyingPills(ctx) {
    if (state === 'idle' || state === 'done') return;
    // UI → Doc (local dispatch)
    flyPill(ctx, 'dispatch',
            UI_X + UI_W, UI_Y + 100,
            DOC_X,        UI_Y + 100,
            COLORS.local);
    // Doc → UI (subscribe / re-render)
    flyPill(ctx, 'subscribeL',
            DOC_X, UI_Y + UI_H - 100,
            UI_X + UI_W, UI_Y + UI_H - 100,
            COLORS.local);
    flyPill(ctx, 'subscribeR',
            DOC_X, UI_Y + UI_H - 100,
            UI_X + UI_W, UI_Y + UI_H - 100,
            COLORS.remote);
    // Doc → Storage
    flyPill(ctx, 'fxSaveL',
            DOC_X + DOC_W, STORAGE_Y + STORAGE_H / 2,
            RIGHT_X,       STORAGE_Y + STORAGE_H / 2,
            COLORS.local);
    flyPill(ctx, 'fxSaveR',
            DOC_X + DOC_W, STORAGE_Y + STORAGE_H / 2,
            RIGHT_X,       STORAGE_Y + STORAGE_H / 2,
            COLORS.remote);
    // Doc → History
    flyPill(ctx, 'fxHistoryL',
            DOC_X + DOC_W, HISTORY_Y + HISTORY_H / 2,
            RIGHT_X,       HISTORY_Y + HISTORY_H / 2,
            COLORS.local);
    flyPill(ctx, 'fxHistoryR',
            DOC_X + DOC_W, HISTORY_Y + HISTORY_H / 2,
            RIGHT_X,       HISTORY_Y + HISTORY_H / 2,
            COLORS.remote);
    // Doc → Peers (broadcast)
    flyPill(ctx, 'fxBroadcastL',
            DOC_X + DOC_W, PEERS_Y + PEERS_H / 2 - 8,
            RIGHT_X,       PEERS_Y + PEERS_H / 2 - 8,
            COLORS.local);
    // Peers → Doc (receive)
    flyPill(ctx, 'recvRemote',
            RIGHT_X,       PEERS_Y + PEERS_H / 2 + 8,
            DOC_X + DOC_W, PEERS_Y + PEERS_H / 2 + 8,
            COLORS.remote);
  }

  function flyPill(ctx, stageName, x1, y1, x2, y2, color) {
    const p = P(stageName);
    if (p <= 0 || p >= 1) return;
    const t = easeInOut(p);
    const x = lerp(x1, x2, t);
    const y = lerp(y1, y2, t);
    const opacity = t < 0.9 ? 1 : 1 - (t - 0.9) / 0.1;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- side-card icons --------------------------------------------

  function drawDiskIcon(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = COLORS.iconNeutral;
    ctx.fillStyle = 'rgba(154, 161, 168, 0.15)';
    ctx.lineWidth = 1.2;
    // Stacked cylinders for "disk".
    const r = 11;
    const h = 3;
    const offsets = [0, 7];
    for (let i = offsets.length - 1; i >= 0; i--) {
      const oy = cy + offsets[i];
      ctx.beginPath();
      ctx.moveTo(cx - r, oy);
      ctx.lineTo(cx - r, oy + h);
      ctx.bezierCurveTo(cx - r, oy + h + 3, cx + r, oy + h + 3, cx + r, oy + h);
      ctx.lineTo(cx + r, oy);
      ctx.bezierCurveTo(cx + r, oy - 3, cx - r, oy - 3, cx - r, oy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // top ellipse
      ctx.beginPath();
      ctx.moveTo(cx - r, oy);
      ctx.bezierCurveTo(cx - r, oy + 3, cx + r, oy + 3, cx + r, oy);
      ctx.bezierCurveTo(cx + r, oy - 3, cx - r, oy - 3, cx - r, oy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHistoryIcon(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = COLORS.iconNeutral;
    ctx.fillStyle = COLORS.iconNeutral;
    ctx.lineWidth = 1.2;
    // A short horizontal timeline with ticks at varying heights.
    const len = 26;
    ctx.beginPath();
    ctx.moveTo(cx - len / 2, cy + 4);
    ctx.lineTo(cx + len / 2, cy + 4);
    ctx.stroke();
    const ticks = [
      { x: -10, h: 6 },
      { x:  -3, h: 9 },
      { x:   4, h: 5 },
      { x:  11, h: 8 },
    ];
    // The latest tick lights up green/gold depending on which change
    // just landed.
    const lastL = active('fxHistoryL', 100, 250);
    const lastR = active('fxHistoryR', 100, 250);
    const newTickColor = lastR > lastL ? COLORS.remoteGlow : COLORS.localGlow;
    const newTickGlow = Math.max(lastL, lastR);

    for (let i = 0; i < ticks.length; i++) {
      const t = ticks[i];
      const isLast = i === ticks.length - 1;
      ctx.fillStyle = isLast && newTickGlow > 0
        ? mixRgba(COLORS.iconNeutral + '', newTickColor, easeOut(newTickGlow))
        : COLORS.iconNeutral;
      ctx.fillRect(cx + t.x, cy + 4 - t.h, 1.5, t.h);
    }
    ctx.restore();
  }

  function drawPeersIcon(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = COLORS.iconNeutral;
    ctx.fillStyle = 'rgba(154, 161, 168, 0.15)';
    ctx.lineWidth = 1.2;
    // Two small browser-y rectangles overlapping.
    const w = 14;
    const h = 11;
    const offsets = [{ x: -8, y: -2 }, { x: 4, y: 3 }];
    for (const o of offsets) {
      const x = cx + o.x;
      const y = cy + o.y;
      roundRect(ctx, x, y, w, h, 2);
      ctx.fill();
      ctx.stroke();
      // Mini "chrome" line
      ctx.beginPath();
      ctx.moveTo(x, y + 3);
      ctx.lineTo(x + w, y + 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- initial render ---------------------------------------------
  render();
}

// === COLOR UTILITY ====================================================

// Mix two CSS rgba() strings together. Cheap parse — supports only the
// forms emitted by COLORS / hex above.
function mixRgba(a, b, t) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  const r = Math.round(lerpN(ca.r, cb.r, t));
  const g = Math.round(lerpN(ca.g, cb.g, t));
  const bl = Math.round(lerpN(ca.b, cb.b, t));
  const al = lerpN(ca.a, cb.a, t);
  return `rgba(${r}, ${g}, ${bl}, ${al.toFixed(3)})`;
}
function lerpN(a, b, t) { return a + (b - a) * t; }

function parseColor(s) {
  s = s.trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return { r: 255, g: 255, b: 255, a: 1 };
  const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
  return {
    r: parts[0] || 0,
    g: parts[1] || 0,
    b: parts[2] || 0,
    a: parts[3] !== undefined ? parts[3] : 1,
  };
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
