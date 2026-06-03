// What happens without skip regions: every "remove a bit of filler"
// edit splits a clip in two and shifts the right piece left to close the
// gap. After a handful of edits you end up with a swarm of disconnected
// fragments that have no semantic relationship to the underlying takes.
//
// Start state: three source clips (host / guest / host) already split
// into 9 fragments by previous editing passes. Pressing Play runs one
// more cut — splits the middle host fragment, removes 0.3s, slides
// everything after to the left — taking the fragment count to 10.

import { setupCanvas } from '../lib/timeline-render.js';

// === MODEL ============================================================

// Each fragment tracks: which source clip it came from (so waveform
// seeds match across siblings); the source-time start within that
// source clip (so waveforms look continuous between fragments); the
// fragment's length; and its project-time start. The guest section
// includes two cuts very close together — the middle fragment (g_c) is
// only 0.5s wide, too narrow for the "guest" label to render at all.
const INITIAL_CLIPS = [
  // host 1 — originally 8s, split into 5 fragments (1.7s removed)
  { id: 'h1a',  sourceClip: 'host1', label: 'host',  source: 0,   sourceLength: 1.5, project: 0    },
  { id: 'h1b',  sourceClip: 'host1', label: 'host',  source: 2.0, sourceLength: 2.0, project: 1.5  },
  { id: 'h1c1', sourceClip: 'host1', label: 'host',  source: 4.5, sourceLength: 0.9, project: 3.5  },
  { id: 'h1c2', sourceClip: 'host1', label: 'host',  source: 5.6, sourceLength: 0.9, project: 4.4  },
  { id: 'h1d',  sourceClip: 'host1', label: 'host',  source: 7.0, sourceLength: 1.0, project: 5.3  },
  // guest — originally 6s, split into 5 fragments (1.4s removed).
  // Two close cuts in the middle leave g_c as a 0.5s sliver.
  { id: 'g_a',  sourceClip: 'guest', label: 'guest', source: 0,   sourceLength: 2.0, project: 6.3  },
  { id: 'g_b',  sourceClip: 'guest', label: 'guest', source: 2.5, sourceLength: 0.5, project: 8.3  },
  { id: 'g_c',  sourceClip: 'guest', label: 'guest', source: 3.2, sourceLength: 0.5, project: 8.8  },
  { id: 'g_d',  sourceClip: 'guest', label: 'guest', source: 3.9, sourceLength: 0.6, project: 9.3  },
  { id: 'g_e',  sourceClip: 'guest', label: 'guest', source: 5.0, sourceLength: 1.0, project: 9.9  },
  // host 2 — originally 5s, split into 2 (0.5s removed)
  { id: 'h3a',  sourceClip: 'host2', label: 'host',  source: 0,   sourceLength: 2.0, project: 10.9 },
  { id: 'h3b',  sourceClip: 'host2', label: 'host',  source: 2.5, sourceLength: 2.5, project: 12.9 },
];

const PROJECT_TOTAL_INITIAL = 15.4;

// One more cut, applied by Play: split h1b at source-time 3.0,
// remove 0.3s, slide everything after to the left.
const CUT_TARGET_ID    = 'h1b';
const CUT_SOURCE_START = 3.0;
const CUT_DURATION     = 0.3;

// === VISUAL CONFIG =====================================================

const PADDING_X      = 14;
const PX_PER_SECOND  = 32;
const RULER_Y        = 12;
const RULER_LABEL_Y  = 22;
const TRACK_Y        = 32;
const TRACK_H        = 36;
const HEIGHT         = TRACK_Y + TRACK_H + 6;
const TITLE_BAR_H    = 11;

const COLORS = {
  bg:          '#1b1d22',
  trackLane:   'rgba(255, 255, 255, 0.025)',
  trackBorder: 'rgba(255, 255, 255, 0.05)',
  ruler:       '#3d4046',
  rulerText:   '#7a7e85',
  speech: { fill: '#3d8260', fillTop: '#2a5b43', stroke: '#15301f', text: '#e6f3ec' },
  cutFill:   'rgba(228, 96, 80, 0.45)',
  cutStroke: 'rgba(248, 130, 110, 0.9)',
};

// === ANIMATION SCHEDULE ================================================

const ANIM = {
  previewFadeIn:  [0,    320],
  previewHold:    [320,  800],
  previewFadeOut: [800,  1050],
  splitSlide:     [800,  1800],
};
const ANIM_DURATION = 2200; // brief rest at the end

// === ENTRY POINT =======================================================

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

  const host       = root.querySelector('[data-role="canvas-host"]');
  const playBtn    = root.querySelector('[data-action="play"]');
  const resetBtn   = root.querySelector('[data-action="reset"]');
  const playLabel  = root.querySelector('[data-role="play-label"]');

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display: block; border-radius: 5px;';
  host.appendChild(canvas);

  let cssWidth   = host.clientWidth || 600;
  let animState  = 'idle'; // 'idle' | 'playing' | 'done'
  let animFrame  = null;
  let animStart  = 0;
  let animElapsed = 0;

  function setState(s) {
    animState = s;
    playBtn.dataset.state = s;
    playBtn.disabled = s === 'playing';
    playLabel.textContent = s === 'playing' ? 'Playing' : s === 'done' ? 'Replay' : 'Play';
    playBtn.setAttribute('aria-label', playLabel.textContent);
  }

  function cancelAnim() {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  function reset() {
    cancelAnim();
    animElapsed = 0;
    setState('idle');
    render();
  }

  function play() {
    cancelAnim();
    animElapsed = 0;
    setState('playing');
    animStart = performance.now();

    function step(now) {
      animElapsed = now - animStart;
      if (animElapsed >= ANIM_DURATION) {
        animElapsed = ANIM_DURATION;
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

  const ro = new ResizeObserver(() => {
    cssWidth = host.clientWidth || 600;
    render();
  });
  ro.observe(host);

  // === LAYOUT ==========================================================

  // Returns the list of fragments to draw given the current animation
  // elapsed time. Before the split (elapsed < splitSlide.t0) it's the
  // initial 9 fragments verbatim. During splitSlide, the target
  // fragment is split in two and everything after slides left by up to
  // CUT_DURATION.
  function currentLayout() {
    if (animState === 'idle' || animElapsed < ANIM.splitSlide[0]) {
      return INITIAL_CLIPS.map((c) => ({ ...c }));
    }

    const slide = computeSlideProgress(animElapsed);
    const target = INITIAL_CLIPS.find((c) => c.id === CUT_TARGET_ID);
    const offsetWithinTarget = CUT_SOURCE_START - target.source;
    const tailSourceLength = target.sourceLength - offsetWithinTarget - CUT_DURATION;
    const tailSourceStart = CUT_SOURCE_START + CUT_DURATION;
    const tailInitialProject = target.project + offsetWithinTarget + CUT_DURATION;
    const tailFinalProject   = target.project + offsetWithinTarget; // closed up

    const result = [];
    for (const c of INITIAL_CLIPS) {
      if (c.id === CUT_TARGET_ID) {
        // Head of the split — left in place.
        result.push({
          ...c,
          id: c.id + ':head',
          sourceLength: offsetWithinTarget,
        });
        // Tail of the split — slides leftward to close the gap.
        result.push({
          ...c,
          id: c.id + ':tail',
          source: tailSourceStart,
          sourceLength: tailSourceLength,
          project: lerp(tailInitialProject, tailFinalProject, slide),
        });
      } else if (c.project > target.project) {
        result.push({
          ...c,
          project: c.project - CUT_DURATION * slide,
        });
      } else {
        result.push({ ...c });
      }
    }
    return result;
  }

  function computeSlideProgress(elapsed) {
    const [t0, t1] = ANIM.splitSlide;
    if (elapsed <= t0) return 0;
    if (elapsed >= t1) return 1;
    return easeInOut((elapsed - t0) / (t1 - t0));
  }

  function computePreviewOpacity(elapsed) {
    const [fi0, fi1] = ANIM.previewFadeIn;
    const [, fh1] = ANIM.previewHold;
    const [fo0, fo1] = ANIM.previewFadeOut;
    if (elapsed < fi0) return 0;
    if (elapsed < fi1) return easeOut((elapsed - fi0) / (fi1 - fi0));
    if (elapsed < fh1) return 1;
    if (elapsed < fo1) return 1 - easeOut((elapsed - fo0) / (fo1 - fo0));
    return 0;
  }

  // === RENDER ==========================================================

  function render() {
    const w = cssWidth;
    const ctx = setupCanvas(canvas, w, HEIGHT);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, HEIGHT);

    drawRuler(ctx, PADDING_X, RULER_Y, w - PADDING_X * 2);

    ctx.fillStyle = COLORS.trackLane;
    ctx.fillRect(PADDING_X, TRACK_Y, w - PADDING_X * 2, TRACK_H);
    ctx.strokeStyle = COLORS.trackBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(PADDING_X + 0.5, TRACK_Y + 0.5, w - PADDING_X * 2 - 1, TRACK_H - 1);

    // Draw every fragment. Both host and guest share the same green
    // palette — the label distinguishes them, not the colour.
    for (const c of currentLayout()) {
      drawClip(ctx, c.project, c.sourceLength, c.source, TRACK_Y, TRACK_H, c.label, COLORS.speech, seedFromClip(c.sourceClip));
    }

    // Cut preview overlay — anchored to the original (pre-slide) location.
    if (animState === 'playing' || animState === 'done') {
      const opacity = computePreviewOpacity(animElapsed);
      if (opacity > 0.01) {
        const target = INITIAL_CLIPS.find((c) => c.id === CUT_TARGET_ID);
        const previewProj = target.project + (CUT_SOURCE_START - target.source);
        const x = PADDING_X + previewProj * PX_PER_SECOND;
        const wpx = CUT_DURATION * PX_PER_SECOND;
        ctx.save();
        ctx.globalAlpha = opacity;
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
  }

  cssWidth = host.clientWidth || 600;
  render();
}

// === DRAWING HELPERS ===================================================

function drawRuler(ctx, x0, y, totalWidth) {
  ctx.save();
  ctx.strokeStyle = COLORS.ruler;
  ctx.fillStyle = COLORS.rulerText;
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.beginPath();
  ctx.moveTo(x0, y + 8);
  ctx.lineTo(x0 + totalWidth, y + 8);
  ctx.stroke();
  for (let s = 0; s * PX_PER_SECOND <= totalWidth; s += 1) {
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

// drawClip — fragment rendering. The waveform is generated from SOURCE
// time, not project time, so two fragments of the same source clip look
// like adjacent slices of one continuous take.
function drawClip(ctx, projectStartSec, lengthSec, sourceStartSec, y, h, label, c, seed) {
  const x = PADDING_X + projectStartSec * PX_PER_SECOND;
  const w = lengthSec * PX_PER_SECOND;
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
    ctx.fillText(label, x + 5, y + TITLE_BAR_H / 2 + 0.5);
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
    for (let t = 0; t < lengthSec; t += stepT) {
      const srcT = sourceStartSec + t;
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

function seedFromClip(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function easeOut(t)    { return 1 - (1 - t) * (1 - t); }
function easeInOut(t)  { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
