// Audio processing summary: a one-time server-side pipeline that turns a
// raw upload into a fan of derived artifacts, and the per-client fetch
// pattern that pulls only what's needed into the browser's IndexedDB
// cache so a collaborator can start editing in seconds.
//
// Three columns, left to right:
//   SOURCE     — the raw recording, big and immutable
//   ARTIFACTS  — what the audio service generates on first upload
//                (backup, transcript, waveform preview, slice index,
//                 compressed slices)
//   BROWSER    — what a joining collaborator pulls, cheap-things-first,
//                cached in IndexedDB, rendered into the editing UI
//
// Press Play to watch the full lifecycle: upload-time fan-out, then
// client-side fetch (waveform & transcript first → compressed slice for
// instant lossy playback → "ready to edit" → full-quality slice streams
// in the background).

import { setupCanvas } from '../lib/timeline-render.js';

// === DIMENSIONS ======================================================

const W = 720;
const H = 420;

const TOP_LABEL_Y = 18;

// Source column
const SRC_X = 30;
const SRC_Y = 110;
const SRC_W = 130;
const SRC_H = 170;

// Artifacts column
const ART_X = 200;
const ART_W = 210;
const ART_TOP = 38;
const ART_H = 62;
const ART_GAP = 8;
const ART_COUNT = 5;
const ART_ICON_SIZE = 26;
const ART_ICON_PAD = 10;

// Browser column
const BR_X = 460;
const BR_Y = 38;
const BR_W = 230;
const BR_H = 360;
const BR_CHROME_H = 24;

// Inside browser (offsets from BR_X, BR_Y)
const BR_PAD = 12;
const CACHE_STRIP_Y    = BR_Y + BR_CHROME_H + 12;   // y of cache strip top
const CACHE_STRIP_H    = 28;
const WAVE_PANEL_Y     = CACHE_STRIP_Y + CACHE_STRIP_H + 12;
const WAVE_PANEL_H     = 58;
const TEXT_PANEL_Y     = WAVE_PANEL_Y + WAVE_PANEL_H + 8;
const TEXT_PANEL_H     = 52;
const PLAYER_Y         = TEXT_PANEL_Y + TEXT_PANEL_H + 8;
const PLAYER_H         = 40;
const READY_Y          = BR_Y + BR_H - 44;
const READY_H          = 32;

// === ARTIFACTS =======================================================

const ARTIFACTS = [
  { id: 'backup',     title: 'raw backup',         sub: '1.2 GB · WAV',       icon: 'file'      },
  { id: 'transcript', title: 'transcript',         sub: 'words + timecodes',  icon: 'text'      },
  { id: 'waveform',   title: 'waveform preview',   sub: '~150 KB',            icon: 'wave'      },
  { id: 'sliceIndex', title: 'slice index',        sub: '40 × 90 s',          icon: 'grid'      },
  { id: 'compressed', title: 'compressed slices',  sub: '40 × ~4 MB · opus',  icon: 'gridSmall' },
];

function artifactY(i) {
  return ART_TOP + i * (ART_H + ART_GAP);
}

// === COLORS ==========================================================

const COLORS = {
  bg:           '#1b1d22',
  cardBg:       'rgba(255, 255, 255, 0.035)',
  cardBorder:   'rgba(255, 255, 255, 0.10)',
  cardBorderHi: 'rgba(255, 255, 255, 0.22)',
  label:        '#bcc1c8',
  labelDim:     '#7a7e85',
  subtitle:     '#7a7e85',
  sectionLabel: '#7a7e85',

  arrow:        'rgba(255, 255, 255, 0.22)',
  arrowHi:      'rgba(255, 255, 255, 0.50)',

  source:       '#3d8260',
  sourceFill:   'rgba(61, 130, 96, 0.16)',
  sourceWave:   'rgba(94, 200, 138, 0.85)',

  iconNeutral:  '#9aa1a8',
  iconText:     '#f5d77a',
  iconWave:     'rgba(94, 200, 138, 0.85)',
  iconSlice:    '#7da3c9',
  iconComp:     '#c97da3',

  cacheDot:     'rgba(255, 255, 255, 0.10)',
  cacheDotOn:   'rgba(94, 200, 138, 0.75)',

  panelDim:     'rgba(255, 255, 255, 0.04)',
  panelOn:      'rgba(255, 255, 255, 0.06)',

  readyOff:     'rgba(255, 255, 255, 0.06)',
  readyOn:      'rgba(61, 130, 96, 0.85)',
  readyTextOff: 'rgba(255, 255, 255, 0.25)',
  readyTextOn:  '#e6f3ec',
};

// === ANIMATION SCHEDULE (ms) =========================================
//
// One-time upload-side work runs first, then a brief beat, then the
// per-client fetch. Idle state shows everything at its "final" position;
// pressing Play resets and re-plays from t=0.

const STAGES = {
  source:     { start:    0, end:  500 },

  // Each artifact pops out of the source ~400 ms apart.
  a_backup:     { start:  600, end: 1000 },
  a_transcript: { start: 1000, end: 1400 },
  a_waveform:   { start: 1400, end: 1800 },
  a_sliceIndex: { start: 1800, end: 2200 },
  a_compressed: { start: 2200, end: 2600 },

  // Brief pause to let "all artifacts" register, then the browser
  // scene comes alive.
  browser:    { start: 2900, end: 3300 },

  // Cheap things pulled first (waveform thumbnail, transcript).
  pullWave:   { start: 3300, end: 3800 },
  pullText:   { start: 3450, end: 3950 },

  // Compressed slice arrives → instant lossy playback possible.
  pullComp:   { start: 4000, end: 4500 },

  // Ready to edit lights up.
  ready:      { start: 4500, end: 4900 },

  // Full-quality slice streams in the background, replacing lossy.
  pullHQ:     { start: 5100, end: 6100 },
};
const TOTAL_MS = 6300;

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
  let elapsed   = TOTAL_MS;   // idle = "fully done" (show final state)

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

  // Local helper: progress 0..1 of a stage at the current elapsed time.
  // Returns 1 at idle so the figure shows its final state until played.
  function P(name) {
    const s = STAGES[name];
    if (state === 'idle') return 1;
    if (elapsed <= s.start) return 0;
    if (elapsed >= s.end) return 1;
    return (elapsed - s.start) / (s.end - s.start);
  }

  function render() {
    const ctx = setupCanvas(canvas, W, H);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    drawColumnHeaders(ctx);
    drawSource(ctx, P('source'));
    drawProcessArrow(ctx);
    drawArtifacts(ctx);
    drawBrowser(ctx);
    drawFlyingItems(ctx);
  }

  // ---- columns and arrows -----------------------------------------

  function drawColumnHeaders(ctx) {
    ctx.save();
    ctx.fillStyle = COLORS.sectionLabel;
    ctx.font = '600 10px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.fillText('SOURCE',     SRC_X + SRC_W / 2, TOP_LABEL_Y);
    ctx.fillText('PROCESSED ARTIFACTS', ART_X + ART_W / 2, TOP_LABEL_Y);
    ctx.fillText('BROWSER',    BR_X + BR_W / 2,  TOP_LABEL_Y);

    // Sub-labels explain the two phases.
    ctx.font = '400 9px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = COLORS.labelDim;
    ctx.fillText('raw upload', SRC_X + SRC_W / 2, TOP_LABEL_Y + 12);
    ctx.fillText('once, on first upload', ART_X + ART_W / 2, TOP_LABEL_Y + 12);
    ctx.fillText('per client, on open', BR_X + BR_W / 2, TOP_LABEL_Y + 12);
    ctx.restore();
  }

  // The big "process" arrow from source → artifacts column. Static.
  function drawProcessArrow(ctx) {
    const ax = SRC_X + SRC_W + 6;
    const bx = ART_X - 6;
    const y  = SRC_Y + SRC_H / 2;
    ctx.save();
    ctx.strokeStyle = COLORS.arrow;
    ctx.fillStyle   = COLORS.arrow;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax, y);
    ctx.lineTo(bx - 6, y);
    ctx.stroke();
    arrowHead(ctx, bx, y);

    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('process', (ax + bx) / 2, y - 6);
    ctx.restore();
  }

  function arrowHead(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 6, y - 3.5);
    ctx.lineTo(x - 6, y + 3.5);
    ctx.closePath();
    ctx.fill();
  }

  // ---- source card -------------------------------------------------

  function drawSource(ctx, p) {
    const t = easeOut(p);
    const scale = lerp(0.92, 1, t);
    const cx = SRC_X + SRC_W / 2;
    const cy = SRC_Y + SRC_H / 2;
    ctx.save();
    ctx.globalAlpha = t;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    ctx.fillStyle = COLORS.sourceFill;
    ctx.strokeStyle = COLORS.source;
    ctx.lineWidth = 1;
    roundRect(ctx, SRC_X, SRC_Y, SRC_W, SRC_H, 6);
    ctx.fill();
    ctx.stroke();

    // Big waveform shape inside.
    drawSourceWaveform(ctx, SRC_X + 12, SRC_Y + 28, SRC_W - 24, 64);

    // Label below the waveform.
    ctx.fillStyle = COLORS.label;
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('raw audio', SRC_X + SRC_W / 2, SRC_Y + 110);

    ctx.fillStyle = COLORS.subtitle;
    ctx.font = '400 10px -apple-system, system-ui, sans-serif';
    ctx.fillText('1 h · ~1.2 GB · WAV', SRC_X + SRC_W / 2, SRC_Y + 126);
    ctx.fillText('immutable', SRC_X + SRC_W / 2, SRC_Y + 142);

    ctx.restore();
  }

  function drawSourceWaveform(ctx, x, y, w, h) {
    const cy = y + h / 2;
    const half = (h - 4) / 2;
    ctx.save();
    ctx.strokeStyle = COLORS.sourceWave;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const stepPx = 1.8;
    for (let dx = 0; dx < w; dx += stepPx) {
      const t = dx / 8;
      // Pseudo-random amplitude (mix of sines) bounded to [0, half].
      const env = 0.6 + 0.4 * Math.sin(t * 0.7 + 1.2);
      const hf  =
        Math.sin(t * 3.3 + 0.4) * 0.5 +
        Math.sin(t * 5.1 + 1.7) * 0.3 +
        Math.sin(t * 8.7 + 2.9) * 0.2;
      const amp = Math.min(half, Math.abs(env * hf) * half);
      ctx.moveTo(x + dx, cy - amp);
      ctx.lineTo(x + dx, cy + amp);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- artifacts column --------------------------------------------

  function drawArtifacts(ctx) {
    for (let i = 0; i < ARTIFACTS.length; i++) {
      const a = ARTIFACTS[i];
      const p = P('a_' + a.id);
      drawArtifactCard(ctx, i, a, p);
    }
  }

  function drawArtifactCard(ctx, i, a, p) {
    const y = artifactY(i);
    const t = easeOut(p);
    // The card slides in from the left (suggesting "spun out of source")
    // and fades up.
    const xOff = lerp(-24, 0, t);
    const opacity = t;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(xOff, 0);

    // Card body
    ctx.fillStyle = COLORS.cardBg;
    ctx.strokeStyle = COLORS.cardBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, ART_X, y, ART_W, ART_H, 5);
    ctx.fill();
    ctx.stroke();

    // Icon
    const iconX = ART_X + ART_ICON_PAD;
    const iconY = y + (ART_H - ART_ICON_SIZE) / 2;
    drawArtifactIcon(ctx, a.icon, iconX, iconY, ART_ICON_SIZE);

    // Title + subtitle
    const textX = iconX + ART_ICON_SIZE + 10;
    ctx.fillStyle = COLORS.label;
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(a.title, textX, y + 24);
    ctx.fillStyle = COLORS.subtitle;
    ctx.font = '400 10px -apple-system, system-ui, sans-serif';
    ctx.fillText(a.sub, textX, y + 40);

    ctx.restore();
  }

  // ---- browser column ----------------------------------------------

  function drawBrowser(ctx) {
    const p = P('browser');
    if (p <= 0) return;
    const t = easeOut(p);

    ctx.save();
    ctx.globalAlpha = t;

    // Window chrome
    ctx.fillStyle = COLORS.cardBg;
    ctx.strokeStyle = COLORS.cardBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, BR_X, BR_Y, BR_W, BR_H, 6);
    ctx.fill();
    ctx.stroke();

    // Chrome bar
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    topRoundedRect(ctx, BR_X, BR_Y, BR_W, BR_CHROME_H, 6);
    ctx.fill();
    // Traffic-light dots
    const dotY = BR_Y + BR_CHROME_H / 2;
    const dotColors = ['#e7625f', '#ffc53d', '#3dd96b'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(BR_X + 10 + i * 12, dotY, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Domain
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('ducking.app/project/…', BR_X + 56, dotY + 0.5);

    drawCacheStrip(ctx);
    drawWavePanel(ctx);
    drawTextPanel(ctx);
    drawPlayerPanel(ctx);
    drawReadyBadge(ctx);

    ctx.restore();
  }

  // Strip of 5 cache slots representing the IndexedDB store. Each lights
  // up as the corresponding artifact is pulled.
  function drawCacheStrip(ctx) {
    const y = CACHE_STRIP_Y;
    const innerX = BR_X + BR_PAD;
    const innerW = BR_W - BR_PAD * 2;

    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '500 9px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText('IndexedDB cache', innerX, y - 2);

    // 5 small slots: one per artifact (only some get pulled).
    const slotW = 16;
    const slotH = 14;
    const slotGap = 6;
    const startX = innerX;
    const slotY  = y + 8;

    const pulledMap = {
      backup:     0,   // never pulled by the client
      transcript: P('pullText'),
      waveform:   P('pullWave'),
      sliceIndex: 0,   // index is on the server side in this view
      compressed: P('pullComp'),
    };

    for (let i = 0; i < ARTIFACTS.length; i++) {
      const a = ARTIFACTS[i];
      const x = startX + i * (slotW + slotGap);
      const pulled = pulledMap[a.id];

      ctx.fillStyle = COLORS.cacheDot;
      ctx.strokeStyle = COLORS.cardBorder;
      ctx.lineWidth = 1;
      roundRect(ctx, x, slotY, slotW, slotH, 2);
      ctx.fill();
      ctx.stroke();

      if (pulled > 0) {
        ctx.save();
        ctx.globalAlpha = pulled;
        ctx.fillStyle = COLORS.cacheDotOn;
        roundRect(ctx, x + 2, slotY + 2, slotW - 4, slotH - 4, 1.5);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawWavePanel(ctx) {
    const y = WAVE_PANEL_Y;
    const x = BR_X + BR_PAD;
    const w = BR_W - BR_PAD * 2;
    const p = P('pullWave');
    drawUIPanel(ctx, x, y, w, WAVE_PANEL_H, 'waveform', p, () => {
      // Small waveform rendered inside.
      drawSourceWaveform(ctx, x + 8, y + 18, w - 16, WAVE_PANEL_H - 26);
    });
  }

  function drawTextPanel(ctx) {
    const y = TEXT_PANEL_Y;
    const x = BR_X + BR_PAD;
    const w = BR_W - BR_PAD * 2;
    const p = P('pullText');
    drawUIPanel(ctx, x, y, w, TEXT_PANEL_H, 'transcript', p, () => {
      // Three lines of "text" — varying widths.
      const lineY = y + 22;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const lines = [w - 20, w - 38, w - 60];
      for (let i = 0; i < lines.length; i++) {
        ctx.fillRect(x + 8, lineY + i * 8, lines[i] * 0.85, 3);
      }
    });
  }

  // Player panel: a play button + a progress bar. A small "HQ" badge
  // lights up once the high-quality slice arrives in the background.
  function drawPlayerPanel(ctx) {
    const y = PLAYER_Y;
    const x = BR_X + BR_PAD;
    const w = BR_W - BR_PAD * 2;
    const pComp = P('pullComp');
    const pHQ   = P('pullHQ');
    drawUIPanel(ctx, x, y, w, PLAYER_H, 'audio · ' + (pHQ > 0.5 ? 'HQ' : 'lossy'), pComp, () => {
      // Play button (triangle)
      const playCx = x + 14;
      const playCy = y + 22;
      ctx.fillStyle = pComp > 0.5 ? '#e6f3ec' : 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(playCx - 3.5, playCy - 5);
      ctx.lineTo(playCx + 5,   playCy);
      ctx.lineTo(playCx - 3.5, playCy + 5);
      ctx.closePath();
      ctx.fill();

      // Progress bar background
      const barX = x + 28;
      const barY = playCy - 2;
      const barW = w - 36;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, barX, barY, barW, 4, 2);
      ctx.fill();
      // Progress fill (just a tiny indicator)
      ctx.fillStyle = pHQ > 0.5 ? COLORS.sourceWave : 'rgba(245, 215, 122, 0.85)';
      roundRect(ctx, barX, barY, barW * 0.32, 4, 2);
      ctx.fill();
    });
  }

  // A small reusable panel: dim outline + header + content. `p` fades
  // the WHOLE panel between dim (waiting) and on (data arrived).
  function drawUIPanel(ctx, x, y, w, h, label, p, drawContent) {
    const t = clamp01(p);
    ctx.save();
    // Border highlights when the panel "lights up".
    ctx.fillStyle = t > 0 ? COLORS.panelOn : COLORS.panelDim;
    ctx.strokeStyle = t > 0
      ? `rgba(255,255,255,${0.10 + t * 0.18})`
      : COLORS.cardBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    // Header label
    ctx.fillStyle = COLORS.labelDim;
    ctx.font = '600 9px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 6, y + 11);

    // Content (only visible once data is partially arrived).
    if (t > 0) {
      ctx.save();
      ctx.globalAlpha = easeOut(t);
      drawContent();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawReadyBadge(ctx) {
    const x = BR_X + BR_PAD;
    const y = READY_Y;
    const w = BR_W - BR_PAD * 2;
    const p = P('ready');
    const t = easeOut(clamp01(p));
    ctx.save();
    ctx.fillStyle = t > 0
      ? `rgba(61, 130, 96, ${0.30 + 0.55 * t})`
      : COLORS.readyOff;
    ctx.strokeStyle = t > 0
      ? `rgba(94, 200, 138, ${0.30 + 0.55 * t})`
      : COLORS.cardBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, READY_H, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = t > 0.4 ? COLORS.readyTextOn : COLORS.readyTextOff;
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('ready to edit', x + w / 2, y + READY_H / 2 + 0.5);
    ctx.restore();
  }

  // ---- flying items: small icons traveling from artifact to browser

  function drawFlyingItems(ctx) {
    // Each flying item: an icon that lerps from the artifact's right
    // edge to a destination inside the browser, fading out as it lands.
    flyItem(ctx, 'pullWave',  indexOf('waveform'),   { x: BR_X + BR_PAD + 8,  y: WAVE_PANEL_Y + WAVE_PANEL_H / 2 }, 'wave');
    flyItem(ctx, 'pullText',  indexOf('transcript'), { x: BR_X + BR_PAD + 8,  y: TEXT_PANEL_Y + TEXT_PANEL_H / 2 }, 'text');
    flyItem(ctx, 'pullComp',  indexOf('compressed'), { x: BR_X + BR_PAD + 8,  y: PLAYER_Y + PLAYER_H / 2 },         'gridSmall');
    // HQ stream: a second "compressed-ish" icon, traveling slowly.
    flyItem(ctx, 'pullHQ',    indexOf('compressed'), { x: BR_X + BR_PAD + 8,  y: PLAYER_Y + PLAYER_H / 2 },         'wave', true);
  }

  function indexOf(id) { return ARTIFACTS.findIndex((a) => a.id === id); }

  function flyItem(ctx, stageName, artIndex, dest, iconKind, slow) {
    const p = P(stageName);
    if (state === 'idle' || p <= 0 || p >= 1) return;
    // Custom ease: the icon spends most of its time in the air, lands
    // quickly. Optional `slow` makes the trail feel more drawn-out.
    const t = slow ? p : easeInOut(p);
    const src = {
      x: ART_X + ART_W + 4,
      y: artifactY(artIndex) + ART_H / 2,
    };
    const x = lerp(src.x, dest.x, t);
    const y = lerp(src.y, dest.y, t);
    // Fade in early, fade out near the end so it "absorbs" into target.
    const opacity = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
    ctx.save();
    ctx.globalAlpha = opacity;
    drawArtifactIcon(ctx, iconKind, x - 7, y - 7, 14);
    ctx.restore();
  }

  // ---- initial render ---------------------------------------------
  render();
}

// === ARTIFACT ICONS ===================================================
// Module-scope so they can be drawn from anywhere (artifact cards,
// flying items, etc.). Each draws into an `s × s` box anchored at (x, y).

function drawArtifactIcon(ctx, kind, x, y, s) {
  switch (kind) {
    case 'file':      return drawIconFile(ctx, x, y, s);
    case 'text':      return drawIconText(ctx, x, y, s);
    case 'wave':      return drawIconWave(ctx, x, y, s);
    case 'grid':      return drawIconGrid(ctx, x, y, s, 3, 2);
    case 'gridSmall': return drawIconGrid(ctx, x, y, s, 4, 3);
  }
}

function drawIconFile(ctx, x, y, s) {
  ctx.save();
  ctx.strokeStyle = COLORS.iconNeutral;
  ctx.fillStyle = 'rgba(154, 161, 168, 0.16)';
  ctx.lineWidth = 1.2;
  // Page with folded corner.
  const fold = s * 0.3;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 1);
  ctx.lineTo(x + s - fold, y + 1);
  ctx.lineTo(x + s - 1, y + fold);
  ctx.lineTo(x + s - 1, y + s - 1);
  ctx.lineTo(x + 3, y + s - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Fold line
  ctx.beginPath();
  ctx.moveTo(x + s - fold, y + 1);
  ctx.lineTo(x + s - fold, y + fold);
  ctx.lineTo(x + s - 1, y + fold);
  ctx.stroke();
  ctx.restore();
}

function drawIconText(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = COLORS.iconText;
  const widths = [s - 4, s - 9, s - 6];
  const lineH = 2;
  const gap   = (s - lineH * 3) / 4;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 2, y + gap + i * (lineH + gap), widths[i], lineH);
  }
  ctx.restore();
}

function drawIconWave(ctx, x, y, s) {
  ctx.save();
  ctx.strokeStyle = COLORS.iconWave;
  ctx.lineWidth = 1;
  const cy = y + s / 2;
  const half = (s - 4) / 2;
  ctx.beginPath();
  const step = 1.5;
  for (let dx = 1; dx < s - 1; dx += step) {
    const t = dx / 2;
    const amp = Math.abs(Math.sin(t * 1.7) * Math.sin(t * 3.3 + 0.4)) * half;
    ctx.moveTo(x + dx, cy - amp);
    ctx.lineTo(x + dx, cy + amp);
  }
  ctx.stroke();
  ctx.restore();
}

function drawIconGrid(ctx, x, y, s, cols, rows) {
  ctx.save();
  const color = rows === 2 ? COLORS.iconSlice : COLORS.iconComp;
  ctx.fillStyle = color + '';
  const pad = 2;
  const cellGap = 1;
  const innerW = s - pad * 2;
  const innerH = s - pad * 2;
  const cw = (innerW - (cols - 1) * cellGap) / cols;
  const ch = (innerH - (rows - 1) * cellGap) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x + pad + c * (cw + cellGap);
      const cy = y + pad + r * (ch + cellGap);
      ctx.fillRect(cx, cy, cw, ch);
    }
  }
  ctx.restore();
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
