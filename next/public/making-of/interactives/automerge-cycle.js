// Automerge as a React-like data layer.
//
// Three columns:
//   COMPONENT — a tiny "React component" sketch: a useDoc() hook, a
//               rendered value, and an "edit title" button.
//   AUTOMERGE — the document, holding one value (the project title).
//   SIDE EFFECTS — three icons: save, history, peers (network).
//
// The animation runs the SAME loop twice, with the same arrows in the
// same positions — only the source of the change and the color differ.
//
//   LOCAL CYCLE (green):
//     The button glows → dispatch flies to the doc → doc's value
//     updates → save/history/broadcast fan out → subscribe flies back
//     → component re-renders with the new title.
//
//   REMOTE CYCLE (gold):
//     The network icon glows with a "← from a collaborator" label →
//     incoming arrow flies INTO the doc → doc's value updates again →
//     save/history fan out (no re-broadcast) → subscribe → component
//     re-renders. You didn't dispatch anything; the data just changed.

import { setupCanvas } from '../lib/timeline-render.js';

// === DIMENSIONS ======================================================

const W = 720;
const H = 420;
const TOP_LABEL_Y = 18;

// Component card (left)
const COMP_X = 30;
const COMP_Y = 70;
const COMP_W = 220;
const COMP_H = 280;
const COMP_PAD = 14;

// Doc card (center)
const DOC_X = 275;
const DOC_Y = 70;
const DOC_W = 195;
const DOC_H = 280;

// Side effects (right)
const SIDE_X = 495;
const SIDE_W = 200;
const SIDE_H = 80;
const SIDE_GAP = 12;
const SAVE_Y = COMP_Y;
const HIST_Y = SAVE_Y + SIDE_H + SIDE_GAP;
const NET_Y  = HIST_Y + SIDE_H + SIDE_GAP;

// Content positions inside the component card
const CODE_LINE_Y    = COMP_Y + 34;
const VALUE_LABEL_Y  = COMP_Y + 64;
const VALUE_BOX_Y    = COMP_Y + 74;
const VALUE_BOX_H    = 78;
const BUTTON_Y       = COMP_Y + 180;
const BUTTON_H       = 38;
const HELPER_Y       = COMP_Y + COMP_H - 16;

// Content positions inside the doc card
const DOC_HEADER_Y     = DOC_Y + 30;
const DOC_SUBTITLE_Y   = DOC_Y + 48;
const DOC_FIELD_KEY_Y  = DOC_Y + 102;
const DOC_FIELD_VAL_Y  = DOC_Y + 132;
const DOC_COUNTER_Y    = DOC_Y + DOC_H - 16;

// === STATE: THE VALUE ================================================
//
// The animation mutates one piece of data — the title of the project.
// "Untitled" at idle, "Episode 4" after the local edit, "Episode 4:
// Coral Bleaching" after the remote collaborator's addition.

const TITLE_INITIAL = '"Untitled"';
const TITLE_LOCAL   = '"Episode 4"';
const TITLE_REMOTE  = '"Episode 4: Coral Bleaching"';

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

  local:        '#5ec88a',
  localGlow:    'rgba(94, 200, 138, 0.85)',
  localSoft:    'rgba(94, 200, 138, 0.20)',
  remote:       '#f5d77a',
  remoteGlow:   'rgba(245, 215, 122, 0.90)',
  remoteSoft:   'rgba(245, 215, 122, 0.20)',

  docStroke:    'rgba(255, 255, 255, 0.22)',
  docFill:      'rgba(255, 255, 255, 0.03)',
  docTitle:     '#e2e6ec',

  code:         '#9aa1a8',
  codeBg:       'rgba(255, 255, 255, 0.025)',

  valueBoxBg:     'rgba(94, 200, 138, 0.06)',
  valueBoxBorder: 'rgba(94, 200, 138, 0.22)',
  valueText:      '#e6f3ec',
  valueLabel:     '#7a7e85',

  buttonBg:     'rgba(94, 200, 138, 0.10)',
  buttonBorder: 'rgba(94, 200, 138, 0.45)',
  buttonText:   '#e6f3ec',

  iconNeutral:  '#9aa1a8',
};

// === ANIMATION SCHEDULE (ms) =========================================

const STAGES = {
  // --- local cycle ---
  uiClick:      { start:  700, end: 1000 },   // button glows
  dispatch:     { start: 1000, end: 1450 },   // pill flies component → doc
  docApplyL:    { start: 1450, end: 1800 },   // doc value updates
  fxSaveL:      { start: 1800, end: 2250 },   // green pill → save
  fxHistoryL:   { start: 1800, end: 2250 },   // → history
  fxBroadcastL: { start: 1800, end: 2250 },   // → network (broadcast)
  subscribeL:   { start: 2200, end: 2700 },   // pill flies doc → component
  uiUpdateL:    { start: 2400, end: 2850 },   // value text in component swaps

  // --- pause, then remote cycle ---
  netSignal:    { start: 3500, end: 3900 },   // network glows + collaborator label fades in
  recvRemote:   { start: 3750, end: 4200 },   // gold pill flies network → doc
  docApplyR:    { start: 4200, end: 4550 },   // doc value updates again
  fxSaveR:      { start: 4550, end: 5000 },   // gold pill → save
  fxHistoryR:   { start: 4550, end: 5000 },   // → history
  subscribeR:   { start: 4950, end: 5450 },   // pill flies doc → component
  uiUpdateR:    { start: 5150, end: 5600 },   // value text in component swaps
};
const TOTAL_MS = 5900;

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
  let elapsed   = 0;

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
    elapsed = 0;
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
  // - Idle: 0 (pristine, before any action).
  // - Done: 1 (final state after both cycles).
  // - Playing: linear progress between start and end.
  function P(name) {
    const s = STAGES[name];
    if (state === 'idle') return 0;
    if (state === 'done') return 1;
    if (elapsed <= s.start) return 0;
    if (elapsed >= s.end) return 1;
    return (elapsed - s.start) / (s.end - s.start);
  }

  // "Bell" indicator: rises while a stage is active, dies off after.
  // Used for arrow highlights and card glows that should fire briefly
  // and fade back down rather than staying lit.
  function active(name, lead = 0, tail = 250) {
    if (state === 'idle' || state === 'done') return 0;
    const s = STAGES[name];
    if (elapsed < s.start - lead) return 0;
    if (elapsed > s.end + tail) return 0;
    if (elapsed < s.start) return (elapsed - (s.start - lead)) / lead;
    if (elapsed > s.end)   return 1 - (elapsed - s.end) / tail;
    return 1;
  }

  // ---- current rendered values ---------------------------------------
  // The doc value swaps mid-docApply (when the change "lands"). The
  // component value swaps mid-uiUpdate (when the re-render fires) —
  // intentionally LATER, so the viewer sees the data-flow ordering.

  function currentDocTitle() {
    if (state === 'idle') return TITLE_INITIAL;
    if (state === 'done') return TITLE_REMOTE;
    if (elapsed >= STAGES.docApplyR.start + 80) return TITLE_REMOTE;
    if (elapsed >= STAGES.docApplyL.start + 80) return TITLE_LOCAL;
    return TITLE_INITIAL;
  }

  function currentComponentTitle() {
    if (state === 'idle') return TITLE_INITIAL;
    if (state === 'done') return TITLE_REMOTE;
    if (elapsed >= STAGES.uiUpdateR.start + 120) return TITLE_REMOTE;
    if (elapsed >= STAGES.uiUpdateL.start + 120) return TITLE_LOCAL;
    return TITLE_INITIAL;
  }

  function currentChangeCount() {
    if (state === 'idle') return 26;
    if (state === 'done') return 28;
    let n = 26;
    if (elapsed >= STAGES.docApplyL.end) n++;
    if (elapsed >= STAGES.docApplyR.end) n++;
    return n;
  }

  // ---- render --------------------------------------------------------

  function render() {
    const ctx = setupCanvas(canvas, W, H);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    drawColumnHeaders(ctx);
    drawArrows(ctx);
    drawComponentCard(ctx);
    drawDocCard(ctx);
    drawSideCards(ctx);
    drawFlyingPills(ctx);
  }

  // ---- column headers -----------------------------------------------

  function drawColumnHeaders(ctx) {
    ctx.save();
    ctx.fillStyle = COLORS.sectionLabel;
    ctx.font = '600 10px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.fillText('COMPONENT', COMP_X + COMP_W / 2, TOP_LABEL_Y);
    ctx.fillText('AUTOMERGE', DOC_X  + DOC_W  / 2, TOP_LABEL_Y);
    ctx.fillText('SIDE EFFECTS', SIDE_X + SIDE_W / 2, TOP_LABEL_Y);

    ctx.font = '400 9px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = COLORS.labelDim;
    ctx.fillText('your React component', COMP_X + COMP_W / 2, TOP_LABEL_Y + 12);
    ctx.fillText('the shared document',  DOC_X  + DOC_W  / 2, TOP_LABEL_Y + 12);
    ctx.fillText('all transparent',      SIDE_X + SIDE_W / 2, TOP_LABEL_Y + 12);
    ctx.restore();
  }

  // ---- arrows --------------------------------------------------------

  function drawArrows(ctx) {
    // Component <-> Doc. Dispatch on top, subscribe on bottom — they
    // bracket the value-box region of the component card.
    const compR = COMP_X + COMP_W;
    const docL  = DOC_X;
    const yDispatch  = VALUE_BOX_Y + 8;
    const ySubscribe = VALUE_BOX_Y + VALUE_BOX_H - 8;

    drawArrow(ctx, compR + 4, yDispatch, docL - 4, yDispatch,
              'dispatch', active('dispatch'), COLORS.local);

    // Subscribe arrow can carry either color depending on which cycle.
    {
      const sL = active('subscribeL');
      const sR = active('subscribeR');
      const color = sR > sL ? COLORS.remote : COLORS.local;
      drawArrow(ctx, docL - 4, ySubscribe, compR + 4, ySubscribe,
                'subscribe', Math.max(sL, sR), color);
    }

    const docR = DOC_X + DOC_W;
    const yStore = SAVE_Y + SIDE_H / 2;
    const yHist  = HIST_Y + SIDE_H / 2;
    const yNet   = NET_Y  + SIDE_H / 2;

    // Save and history arrows fire on either cycle.
    {
      const aL = active('fxSaveL');
      const aR = active('fxSaveR');
      const color = aR > aL ? COLORS.remote : COLORS.local;
      drawArrow(ctx, docR + 4, yStore, SIDE_X - 4, yStore,
                'save', Math.max(aL, aR), color);
    }
    {
      const aL = active('fxHistoryL');
      const aR = active('fxHistoryR');
      const color = aR > aL ? COLORS.remote : COLORS.local;
      drawArrow(ctx, docR + 4, yHist, SIDE_X - 4, yHist,
                'append', Math.max(aL, aR), color);
    }

    // Peers: two parallel arrows. Broadcast (top, green) on the local
    // cycle. Receive (bottom, gold) on the remote cycle.
    drawArrow(ctx, docR + 4, yNet - 7, SIDE_X - 4, yNet - 7,
              'broadcast', active('fxBroadcastL'), COLORS.local);
    drawArrow(ctx, SIDE_X - 4, yNet + 7, docR + 4, yNet + 7,
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

  // ---- component card ------------------------------------------------

  function drawComponentCard(ctx) {
    ctx.save();
    ctx.fillStyle = COLORS.cardBg;
    ctx.strokeStyle = COLORS.cardBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, COMP_X, COMP_Y, COMP_W, COMP_H, 6);
    ctx.fill();
    ctx.stroke();

    // The useDoc() hook line — monospace, dim, suggests "this is code".
    ctx.fillStyle = COLORS.codeBg;
    roundRect(ctx, COMP_X + COMP_PAD, CODE_LINE_Y - 12, COMP_W - COMP_PAD * 2, 18, 3);
    ctx.fill();

    ctx.fillStyle = COLORS.code;
    ctx.font = '400 10.5px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText('const { title } = useDoc(ep4)', COMP_X + COMP_PAD + 8, CODE_LINE_Y);

    // "rendered:" small label above the value box
    ctx.fillStyle = COLORS.valueLabel;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.fillText('rendered:', COMP_X + COMP_PAD, VALUE_LABEL_Y);

    // The value box — a fake H1 area showing the current title.
    drawValueBox(ctx);

    // The "edit title" button. Glows green during uiClick stage.
    drawEditButton(ctx);

    // Helper text at the bottom: explains the action in plain language,
    // updated to match the current phase of the animation.
    drawComponentHelper(ctx);

    ctx.restore();
  }

  function drawValueBox(ctx) {
    const x = COMP_X + COMP_PAD;
    const y = VALUE_BOX_Y;
    const w = COMP_W - COMP_PAD * 2;
    const h = VALUE_BOX_H;

    // Highlight border briefly during uiUpdate (when the re-render fires).
    const flashL = active('uiUpdateL', 100, 300);
    const flashR = active('uiUpdateR', 100, 300);
    const flashColor = flashR > flashL ? COLORS.remoteGlow : COLORS.localGlow;
    const flash = Math.max(flashL, flashR);

    ctx.fillStyle = COLORS.valueBoxBg;
    ctx.strokeStyle = flash > 0
      ? mixRgba(COLORS.valueBoxBorder, flashColor, easeOut(flash))
      : COLORS.valueBoxBorder;
    ctx.lineWidth = flash > 0 ? 1.4 : 1;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    // The title text itself, slightly larger, centered.
    ctx.fillStyle = COLORS.valueText;
    ctx.font = '500 14px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const title = currentComponentTitle();
    // Wrap to two lines if it's the long remote title.
    drawWrappedCentered(ctx, title, x + w / 2, y + h / 2, w - 16, 16);
  }

  function drawWrappedCentered(ctx, text, cx, cy, maxW, lineH) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const tryLine = cur ? cur + ' ' + word : word;
      if (ctx.measureText(tryLine).width > maxW && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = tryLine;
      }
    }
    if (cur) lines.push(cur);
    const totalH = lines.length * lineH;
    let y = cy - totalH / 2 + lineH / 2;
    for (const line of lines) {
      ctx.fillText(line, cx, y);
      y += lineH;
    }
  }

  function drawEditButton(ctx) {
    const x = COMP_X + COMP_PAD;
    const y = BUTTON_Y;
    const w = COMP_W - COMP_PAD * 2;
    const h = BUTTON_H;

    // Glow during the click stage.
    const pulse = active('uiClick', 200, 400);
    const t = easeOut(pulse);

    ctx.save();
    ctx.fillStyle = pulse > 0
      ? mixRgba(COLORS.buttonBg, COLORS.localSoft, t)
      : COLORS.buttonBg;
    ctx.strokeStyle = pulse > 0
      ? mixRgba(COLORS.buttonBorder, COLORS.localGlow, t)
      : COLORS.buttonBorder;
    ctx.lineWidth = pulse > 0 ? 1.6 : 1;
    if (pulse > 0) {
      ctx.shadowColor = COLORS.localGlow;
      ctx.shadowBlur = 8 * t;
    }
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.buttonText;
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('edit title', x + w / 2, y + h / 2 + 0.5);
    ctx.restore();
  }

  // Tiny plain-language caption at the bottom of the component card.
  // Adapts to the current phase so the reader can interpret each scene.
  function drawComponentHelper(ctx) {
    let text;
    if (state === 'idle') text = 'click "edit title" to start';
    else if (state === 'done') text = 'a remote edit landed in your component';
    else if (elapsed < STAGES.uiClick.start)        text = 'click "edit title" to start';
    else if (elapsed < STAGES.uiUpdateL.start)      text = 'your dispatch is in flight…';
    else if (elapsed < STAGES.netSignal.start)      text = 'your edit applied. round-trip done.';
    else if (elapsed < STAGES.docApplyR.start)      text = 'a peer just edited the same doc…';
    else if (elapsed < STAGES.uiUpdateR.end)        text = 'merging in their change…';
    else                                            text = 'a remote edit landed in your component';

    ctx.save();
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '400 10px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(text, COMP_X + COMP_PAD, HELPER_Y);
    ctx.restore();
  }

  // ---- doc card ------------------------------------------------------

  function drawDocCard(ctx) {
    ctx.save();

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
    ctx.fillText('automerge document', DOC_X + DOC_W / 2, DOC_HEADER_Y);

    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '400 10px -apple-system, system-ui, sans-serif';
    ctx.fillText('CRDT', DOC_X + DOC_W / 2, DOC_SUBTITLE_Y);

    // The single field: title.
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '500 10px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('title:', DOC_X + 18, DOC_FIELD_KEY_Y);

    // The value. Highlights briefly during docApply.
    const valueFlash = flash;
    ctx.fillStyle = valueFlash > 0
      ? mixRgba(COLORS.label, flashColor, easeOut(valueFlash))
      : COLORS.label;
    ctx.font = '500 12px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const value = currentDocTitle();
    drawWrappedLeft(ctx, value, DOC_X + 18, DOC_FIELD_VAL_Y, DOC_W - 36, 17);

    // Changes counter, bottom-right.
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${currentChangeCount()} changes`, DOC_X + DOC_W - 16, DOC_COUNTER_Y);

    ctx.restore();
  }

  function drawWrappedLeft(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const tryLine = cur ? cur + ' ' + word : word;
      if (ctx.measureText(tryLine).width > maxW && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = tryLine;
      }
    }
    if (cur) lines.push(cur);
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += lineH;
    }
  }

  // ---- side effect cards -------------------------------------------

  function drawSideCards(ctx) {
    drawSideCard(ctx, SIDE_X, SAVE_Y, SIDE_W, SIDE_H,
                 'local storage', 'saves automatically',
                 Math.max(active('fxSaveL'), active('fxSaveR')),
                 active('fxSaveR') > active('fxSaveL') ? COLORS.remoteGlow : COLORS.localGlow,
                 (cx, cy) => drawDiskIcon(ctx, cx, cy));

    drawSideCard(ctx, SIDE_X, HIST_Y, SIDE_W, SIDE_H,
                 'history', 'every change kept',
                 Math.max(active('fxHistoryL'), active('fxHistoryR')),
                 active('fxHistoryR') > active('fxHistoryL') ? COLORS.remoteGlow : COLORS.localGlow,
                 (cx, cy) => drawHistoryIcon(ctx, cx, cy));

    // The network card has the special "from a collaborator" label.
    const broadcastGlow = active('fxBroadcastL');
    const receiveGlow   = Math.max(active('netSignal'), active('recvRemote'));
    const netGlow = Math.max(broadcastGlow, receiveGlow);
    const netGlowColor = receiveGlow > broadcastGlow ? COLORS.remoteGlow : COLORS.localGlow;

    drawSideCard(ctx, SIDE_X, NET_Y, SIDE_W, SIDE_H,
                 'peers', 'broadcast + receive',
                 netGlow, netGlowColor,
                 (cx, cy) => drawPeersIcon(ctx, cx, cy));

    // The collaborator label. Fades in when the remote cycle starts and
    // stays through the doc-apply, so the source of the gold change is
    // unambiguous.
    drawCollaboratorLabel(ctx);
  }

  function drawSideCard(ctx, x, y, w, h, title, sub, glow, glowColor, drawIcon) {
    ctx.save();
    ctx.fillStyle = COLORS.cardBg;
    ctx.strokeStyle = glow > 0
      ? mixRgba(COLORS.cardBorder, glowColor, easeOut(glow))
      : COLORS.cardBorder;
    ctx.lineWidth = glow > 0 ? 1.4 : 1;
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.stroke();

    drawIcon(x + 22, y + h / 2);

    ctx.fillStyle = COLORS.label;
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 52, y + h / 2 - 4);

    ctx.fillStyle = COLORS.subtitle;
    ctx.font = '400 10px -apple-system, system-ui, sans-serif';
    ctx.fillText(sub, x + 52, y + h / 2 + 12);

    ctx.restore();
  }

  // "← from a collaborator" annotation that appears beside the network
  // card during the remote cycle. Sits on the LEFT edge of the network
  // card, pointing at it, so the reader's eye connects "incoming change"
  // → "this card is where it comes from".
  function drawCollaboratorLabel(ctx) {
    const onset = active('netSignal', 100, 200);
    const through = active('recvRemote', 200, 600);
    const linger = active('docApplyR', 0, 800);
    const t = Math.max(onset, through, linger);
    if (t <= 0.01) return;

    const text = '← from a collaborator';
    const x = SIDE_X - 6;
    const y = NET_Y - 6;

    ctx.save();
    ctx.globalAlpha = easeOut(clamp01(t));
    ctx.fillStyle = COLORS.remote;
    ctx.font = '600 10px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ---- flying pills -------------------------------------------------

  function drawFlyingPills(ctx) {
    if (state === 'idle' || state === 'done') return;

    const compR = COMP_X + COMP_W;
    const docL  = DOC_X;
    const docR  = DOC_X + DOC_W;
    const yDispatch  = VALUE_BOX_Y + 8;
    const ySubscribe = VALUE_BOX_Y + VALUE_BOX_H - 8;
    const yStore = SAVE_Y + SIDE_H / 2;
    const yHist  = HIST_Y + SIDE_H / 2;
    const yNet   = NET_Y  + SIDE_H / 2;

    // Component → Doc (local dispatch)
    flyPill(ctx, 'dispatch', compR, yDispatch, docL, yDispatch, COLORS.local);

    // Doc → Component (subscribe)
    flyPill(ctx, 'subscribeL', docL, ySubscribe, compR, ySubscribe, COLORS.local);
    flyPill(ctx, 'subscribeR', docL, ySubscribe, compR, ySubscribe, COLORS.remote);

    // Doc → side effects
    flyPill(ctx, 'fxSaveL',    docR, yStore, SIDE_X, yStore, COLORS.local);
    flyPill(ctx, 'fxSaveR',    docR, yStore, SIDE_X, yStore, COLORS.remote);
    flyPill(ctx, 'fxHistoryL', docR, yHist,  SIDE_X, yHist,  COLORS.local);
    flyPill(ctx, 'fxHistoryR', docR, yHist,  SIDE_X, yHist,  COLORS.remote);

    // Doc → Peers (broadcast — local cycle only)
    flyPill(ctx, 'fxBroadcastL', docR, yNet - 7, SIDE_X, yNet - 7, COLORS.local);

    // Peers → Doc (receive — remote cycle only)
    flyPill(ctx, 'recvRemote', SIDE_X, yNet + 7, docR, yNet + 7, COLORS.remote);
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

  // ---- side-card icons ---------------------------------------------

  function drawDiskIcon(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = COLORS.iconNeutral;
    ctx.fillStyle = 'rgba(154, 161, 168, 0.15)';
    ctx.lineWidth = 1.2;
    const r = 11;
    const h = 3;
    const offsets = [0, 7];
    for (let i = offsets.length - 1; i >= 0; i--) {
      const oy = cy + offsets[i] - 6;
      ctx.beginPath();
      ctx.moveTo(cx - r, oy);
      ctx.lineTo(cx - r, oy + h);
      ctx.bezierCurveTo(cx - r, oy + h + 3, cx + r, oy + h + 3, cx + r, oy + h);
      ctx.lineTo(cx + r, oy);
      ctx.bezierCurveTo(cx + r, oy - 3, cx - r, oy - 3, cx - r, oy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
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
    const lastL = active('fxHistoryL', 100, 250);
    const lastR = active('fxHistoryR', 100, 250);
    const newTickColor = lastR > lastL ? COLORS.remoteGlow : COLORS.localGlow;
    const newTickGlow = Math.max(lastL, lastR);
    for (let i = 0; i < ticks.length; i++) {
      const t = ticks[i];
      const isLast = i === ticks.length - 1;
      ctx.fillStyle = isLast && newTickGlow > 0
        ? mixRgba(COLORS.iconNeutral, newTickColor, easeOut(newTickGlow))
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
    const w = 14;
    const h = 11;
    const offsets = [{ x: -8, y: -2 }, { x: 4, y: 3 }];
    for (const o of offsets) {
      const x = cx + o.x;
      const y = cy + o.y - 5;
      roundRect(ctx, x, y, w, h, 2);
      ctx.fill();
      ctx.stroke();
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
