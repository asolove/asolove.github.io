// Why naive list-reorder produces duplicates under concurrent moves.
//
// Both Alice and Bob start from the same list [A, B, C, D].
// Concurrently:
//   Alice moves B → after C. To the user this looks like a smooth
//   reorder, but underneath Automerge does delete(B) + insert(B′).
//   Bob   moves B → after D. Same story: visual is a slide,
//   underneath it's delete(B) + insert(B″).
// When the two peers sync:
//   • Both deletes target the same B → they collapse into one tombstone.
//     Original B is gone exactly once.
//   • Both inserts create FRESH list elements at DIFFERENT positions.
//     Both inserts survive; neither cancels the other.
// Result: the merged list contains BOTH new B's. The "move" has
// duplicated the item.
//
// The Kleppmann move-operation paper shows this is the fundamental
// obstacle to building a safe move out of delete+insert without a
// dedicated move primitive.

import { setupCanvas } from '../lib/timeline-render.js';

// === DIMENSIONS ======================================================

const W = 720;
const H = 270;

// Two side-by-side user panels at the top
const ALICE_X = 30,  ALICE_Y = 20, ALICE_W = 320, ALICE_H = 108;
const BOB_X   = 370, BOB_Y   = 20, BOB_W   = 320, BOB_H   = 108;

// Merged result panel at the bottom
const MERGE_X = 30, MERGE_Y = 160, MERGE_W = 660, MERGE_H = 90;

// List item visuals
const ITEM_W = 38;
const ITEM_H = 40;
const ITEM_GAP = 6;

// Item layout positions (centered horizontally in the parent box)
function slotXIn(boxX, boxW, totalSlots) {
  const listW = totalSlots * ITEM_W + (totalSlots - 1) * ITEM_GAP;
  return boxX + (boxW - listW) / 2;
}
const ALICE_LIST_X = slotXIn(ALICE_X, ALICE_W, 4);
const BOB_LIST_X   = slotXIn(BOB_X,   BOB_W,   4);
const MERGE_LIST_X = slotXIn(MERGE_X, MERGE_W, 5);

const ALICE_ITEMS_Y = ALICE_Y + 38;
const BOB_ITEMS_Y   = BOB_Y   + 38;
const MERGE_ITEMS_Y = MERGE_Y + 32;

// Headers and captions
const HEADER_DY = 18;
const INTENT_DY = 96;

// === COLORS ==========================================================

const COLORS = {
  bg:           '#1b1d22',
  cardBg:       'rgba(255, 255, 255, 0.035)',
  cardBorder:   'rgba(255, 255, 255, 0.10)',
  cardBorderHi: 'rgba(255, 255, 255, 0.25)',
  label:        '#bcc1c8',
  labelDim:     '#7a7e85',
  subtitle:     '#7a7e85',
  sectionLabel: '#7a7e85',
  arrow:        'rgba(255, 255, 255, 0.18)',
  arrowText:    'rgba(255, 255, 255, 0.45)',

  // Per-user accent colors. Alice = green (left), Bob = gold (right).
  alice:        '#5ec88a',
  aliceGlow:    'rgba(94, 200, 138, 0.90)',
  aliceFill:    'rgba(94, 200, 138, 0.18)',
  aliceStroke:  'rgba(94, 200, 138, 0.65)',
  aliceText:    '#e6f3ec',

  bob:          '#f5d77a',
  bobGlow:      'rgba(245, 215, 122, 0.90)',
  bobFill:      'rgba(245, 215, 122, 0.18)',
  bobStroke:    'rgba(245, 215, 122, 0.65)',
  bobText:      '#f8f0d6',

  // Neutral list items (A, C, D) — same on both sides.
  neutralFill:   'rgba(255, 255, 255, 0.06)',
  neutralStroke: 'rgba(255, 255, 255, 0.30)',
  neutralText:   '#e2e6ec',
};

// === ANIMATION SCHEDULE (ms) =========================================
//
// The two users act in parallel: their intent/delete/insert stages share
// the same time ranges. After both finish, a brief sync exchange, then
// the merged list assembles item-by-item, then the two duplicate B's
// pulse to drive the punchline home.

// Each move's sub-phases are FIXED wall-clock durations except for the
// drag itself, which is paced at a constant speed (ms per slot). That
// keeps the visual tempo even — Alice's 1-slot drag finishes fast,
// Bob's 2-slot drag takes proportionally longer — instead of stretching
// the shorter move to fill a fixed stage duration.
const MV_FLYIN_MS         = 320;
const MV_GRAB_MS          = 180;
const MV_DRAG_PER_SLOT_MS = 320;   // constant speed
const MV_RELEASE_MS       = 230;
const MV_FADE_MS          = 200;

const ALICE_DISTANCE = 1;   // slot 1 → slot 2
const BOB_DISTANCE   = 2;   // slot 1 → slot 3

function moveTotal(distance) {
  return MV_FLYIN_MS + MV_GRAB_MS + distance * MV_DRAG_PER_SLOT_MS
       + MV_RELEASE_MS + MV_FADE_MS;
}
const MV_ALICE_TOTAL = moveTotal(ALICE_DISTANCE); // 1250
const MV_BOB_TOTAL   = moveTotal(BOB_DISTANCE);   // 1570

const STAGES = {
  // Alice goes first, Bob second — sequential, so the reader can watch
  // each "drag" in detail before the next one starts. (The semantics
  // are still concurrent: Bob acts on HIS own pre-Alice copy of the
  // list; he never sees Alice's change. It's only the wall-clock
  // animation that's sequential.)
  //
  // The `intent` stages now fire AFTER each move completes — that's
  // when the "↓ Automerge: delete + insert" caption appears, revealing
  // what the system actually did underneath the "reorder" the user just
  // performed. The captions stay up through the sync to the merged
  // result, so the reader can connect each operation to its visible
  // contribution in the bottom panel.

  move1:      { start: 1000, end: 1000 + MV_ALICE_TOTAL },
  intent1:    { start: 1000 + MV_ALICE_TOTAL + 200, end: 1000 + MV_ALICE_TOTAL + 600 },

  move2:      { start: 3300, end: 3300 + MV_BOB_TOTAL },
  intent2:    { start: 3300 + MV_BOB_TOTAL + 200, end: 3300 + MV_BOB_TOTAL + 600 },

  sync:       { start: 5800, end: 6600 },
  mergeFill:  { start: 6600, end: 7900 },
  highlight:  { start: 8100, end: 8900 },
};
const TOTAL_MS = 9100;

const LIFT_PX = 12;   // how high the moved item rises during the slide

// === EASING / UTILS ==================================================

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

  // Stage progress 0..1. Idle = 0, Done = 1, Playing = linear.
  function P(name) {
    const s = STAGES[name];
    if (state === 'idle') return 0;
    if (state === 'done') return 1;
    if (elapsed <= s.start) return 0;
    if (elapsed >= s.end) return 1;
    return (elapsed - s.start) / (s.end - s.start);
  }

  // Bell: rises during a stage, fades after.
  function active(name, lead = 0, tail = 250) {
    if (state === 'idle' || state === 'done') return 0;
    const s = STAGES[name];
    if (elapsed < s.start - lead) return 0;
    if (elapsed > s.end + tail) return 0;
    if (elapsed < s.start) return (elapsed - (s.start - lead)) / lead;
    if (elapsed > s.end)   return 1 - (elapsed - s.end) / tail;
    return 1;
  }

  // ---- render --------------------------------------------------------

  function render() {
    const ctx = setupCanvas(canvas, W, H);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    drawUserPanel(ctx, 'alice', ALICE_X, ALICE_Y, ALICE_W, ALICE_H);
    drawUserPanel(ctx, 'bob',   BOB_X,   BOB_Y,   BOB_W,   BOB_H);
    drawCursors(ctx);
    drawSyncArrows(ctx);
    drawMergePanel(ctx);
  }

  // ---- cursors ------------------------------------------------------
  //
  // One cursor per user, visible only during their move stage. Each
  // sub-phase has a fixed wall-clock duration; the drag itself runs
  // at a constant per-slot speed (so Alice's 1-slot drag finishes
  // proportionally sooner than Bob's 2-slot drag).
  //   flyin   — cursor enters from outside the panel
  //   grab    — hovers over B with a small "press" pulse
  //   drag    — drags B at the per-slot speed to its target slot
  //   release — un-pressed, paused at the destination
  //   fade    — cursor lifts off and disappears

  function drawCursors(ctx) {
    const a = cursorState('alice');
    const b = cursorState('bob');
    if (a) drawCursor(ctx, a.x, a.y, a.opacity, a.pressed);
    if (b) drawCursor(ctx, b.x, b.y, b.opacity, b.pressed);
  }

  function cursorState(who) {
    if (state === 'idle' || state === 'done') return null;
    const stageName = who === 'alice' ? 'move1' : 'move2';
    const distance  = who === 'alice' ? ALICE_DISTANCE : BOB_DISTANCE;
    const ph = movePhase(stageName, distance);
    if (ph.phase === 'pre' || ph.phase === 'post') return null;

    const listX  = who === 'alice' ? ALICE_LIST_X : BOB_LIST_X;
    const itemsY = who === 'alice' ? ALICE_ITEMS_Y : BOB_ITEMS_Y;
    const startSlot = 1;
    const endSlot   = who === 'alice' ? 2 : 3;

    // Cursor anchor: just inside the top-left of the dragged item.
    const grabX = (slot) => listX + slot * (ITEM_W + ITEM_GAP) + ITEM_W * 0.55;
    const grabY =  itemsY + ITEM_H * 0.35;

    let x, y, opacity = 1, pressed = false;

    if (ph.phase === 'flyin') {
      const t = easeOut(ph.t);
      const sx = grabX(startSlot) + 70;
      const sy = grabY + 60;
      x = lerp(sx, grabX(startSlot), t);
      y = lerp(sy, grabY, t);
    } else if (ph.phase === 'grab') {
      x = grabX(startSlot);
      y = grabY;
      pressed = ph.t > 0.4;
    } else if (ph.phase === 'drag') {
      const t = easeInOut(ph.t);
      const slot = lerp(startSlot, endSlot, t);
      const lift = Math.sin(ph.t * Math.PI) * LIFT_PX;
      x = grabX(slot);
      y = grabY - lift;
      pressed = true;
    } else if (ph.phase === 'release') {
      x = grabX(endSlot);
      y = grabY;
    } else {
      // fade
      x = grabX(endSlot) + ph.t * 18;
      y = grabY - ph.t * 12;
      opacity = 1 - easeOut(ph.t);
    }

    return { x, y, opacity, pressed };
  }

  // Mac-style cursor with a soft shadow. `pressed` shrinks it slightly
  // and adds a small click-ring at the tip.
  function drawCursor(ctx, x, y, opacity, pressed) {
    if (opacity <= 0.01) return;
    const scale = pressed ? 0.88 : 1;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Click ring at the tip when pressed.
    if (pressed) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    cursorPath(ctx, 1.2, 1.6);
    ctx.fill();

    // Cursor body
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#101115';
    ctx.lineWidth = 1.1;
    cursorPath(ctx, 0, 0);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function cursorPath(ctx, ox, oy) {
    ctx.beginPath();
    ctx.moveTo(ox + 0,  oy + 0);
    ctx.lineTo(ox + 0,  oy + 16);
    ctx.lineTo(ox + 4,  oy + 12.5);
    ctx.lineTo(ox + 6.5, oy + 17);
    ctx.lineTo(ox + 8.5, oy + 16);
    ctx.lineTo(ox + 6,  oy + 11.5);
    ctx.lineTo(ox + 11, oy + 11);
    ctx.closePath();
  }

  // ---- user panel ---------------------------------------------------

  function drawUserPanel(ctx, who, x, y, w, h) {
    const isAlice = who === 'alice';

    ctx.save();
    ctx.fillStyle = COLORS.cardBg;
    ctx.strokeStyle = COLORS.cardBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // Header: name in the user's color.
    ctx.fillStyle = isAlice ? COLORS.alice : COLORS.bob;
    ctx.font = '600 13px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(isAlice ? 'Alice' : 'Bob', x + w / 2, y + HEADER_DY);

    // The list items themselves.
    const items = isAlice ? aliceItems() : bobItems();
    const listX = isAlice ? ALICE_LIST_X : BOB_LIST_X;
    const itemsY = isAlice ? ALICE_ITEMS_Y : BOB_ITEMS_Y;
    drawItems(ctx, items, listX, itemsY);

    // Intent label below the list: shows the operations as text. Fades
    // in during the intent stage and stays through the actions.
    drawIntentCaption(ctx, who, x, y, w);

    ctx.restore();
  }

  // Caption below the list: what Automerge ACTUALLY did underneath the
  // visible reorder. Hidden until the user's move completes; fades in
  // during the intent stage; then stays visible through the sync to
  // the merged result. (The intent stages are scheduled to fire just
  // *after* each move, NOT before, so the caption is the punchline,
  // not a pre-announcement.)
  function drawIntentCaption(ctx, who, x, y, w) {
    const isAlice = who === 'alice';
    const stage = isAlice ? 'intent1' : 'intent2';

    const p = P(stage);
    if (p <= 0) return;
    const alpha = easeOut(p) * 0.9;
    if (alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = isAlice ? COLORS.alice : COLORS.bob;
    ctx.font = '500 10px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const text = isAlice
      ? '↓ Automerge: delete(B) + insert(B′) after C'
      : '↓ Automerge: delete(B) + insert(B″) after D';
    ctx.fillText(text, x + w / 2, y + INTENT_DY);
    ctx.restore();
  }

  // ---- item models --------------------------------------------------
  //
  // Each "item" is { label, kind, slot, opacity, lift?, glow? }.
  // - slot is a fractional position along the list (lerps smoothly as
  //   neighbors shift)
  // - lift is a y-offset in pixels (positive = up) so the moved item
  //   rises above its row mid-slide, the way a dragged item reads in
  //   any drag-and-drop UI
  // - kind drives the color (neutral / alice / bob)
  //
  // Each user does ONE smooth slide. Under the hood, that "reorder" is
  // actually delete(B) + insert(B′) — but that's only revealed in the
  // caption text and in the merged result below; the UI itself just
  // shows a clean slide.

  // Decompose the elapsed time inside a move stage into a sub-phase and
  // a 0..1 progress within that sub-phase. The drag length scales with
  // distance, so Alice's 1-slot drag finishes proportionally sooner
  // than Bob's 2-slot drag — both at the same per-slot speed.
  function movePhase(stageName, distance) {
    if (state === 'idle')   return { phase: 'pre',  t: 0 };
    if (state === 'done')   return { phase: 'post', t: 1 };
    const stage = STAGES[stageName];
    const e = elapsed - stage.start;
    if (e <= 0) return { phase: 'pre',  t: 0 };
    const dragMs = distance * MV_DRAG_PER_SLOT_MS;
    const total  = MV_FLYIN_MS + MV_GRAB_MS + dragMs + MV_RELEASE_MS + MV_FADE_MS;
    if (e >= total) return { phase: 'post', t: 1 };

    let r = e;
    if (r < MV_FLYIN_MS)   return { phase: 'flyin',   t: r / MV_FLYIN_MS };
    r -= MV_FLYIN_MS;
    if (r < MV_GRAB_MS)    return { phase: 'grab',    t: r / MV_GRAB_MS };
    r -= MV_GRAB_MS;
    if (r < dragMs)        return { phase: 'drag',    t: r / dragMs };
    r -= dragMs;
    if (r < MV_RELEASE_MS) return { phase: 'release', t: r / MV_RELEASE_MS };
    r -= MV_RELEASE_MS;
    return { phase: 'fade', t: clamp01(r / MV_FADE_MS) };
  }

  // dragProgress: 0 before grab, eased 0..1 across the drag, then 1.
  // Used to compute the slot positions of B (and the items it pushes).
  function dragProgress(stageName, distance) {
    const ph = movePhase(stageName, distance);
    if (ph.phase === 'pre' || ph.phase === 'flyin' || ph.phase === 'grab') return 0;
    if (ph.phase === 'drag') return easeInOut(ph.t);
    return 1;
  }

  // Lift curve: peaks mid-drag, zero before and after.
  function liftAmount(stageName, distance) {
    const ph = movePhase(stageName, distance);
    if (ph.phase === 'drag') return Math.sin(ph.t * Math.PI) * LIFT_PX;
    return 0;
  }

  // After release the original B has been deleted and a fresh element
  // inserted at the target position. We mark that moment by snapping
  // the label to B′ / B″ and switching colors to the user's accent.
  function isReleased(stageName, distance) {
    const ph = movePhase(stageName, distance);
    return ph.phase === 'release' || ph.phase === 'fade' || ph.phase === 'post';
  }

  function aliceItems() {
    // Alice: B slides from slot 1 → slot 2, C slides from slot 2 → 1.
    const t = dragProgress('move1', ALICE_DISTANCE);
    const lift = liftAmount('move1', ALICE_DISTANCE);
    const released = isReleased('move1', ALICE_DISTANCE);
    return [
      { label: 'A', kind: 'neutral', slot: 0,     opacity: 1 },
      {
        label: released ? 'B′' : 'B',
        kind:  released ? 'alice' : 'neutral',
        slot: 1 + t, opacity: 1, lift,
      },
      { label: 'C', kind: 'neutral', slot: 2 - t, opacity: 1 },
      { label: 'D', kind: 'neutral', slot: 3,     opacity: 1 },
    ];
  }

  function bobItems() {
    // Bob: B slides from slot 1 → slot 3; C slides 2 → 1, D slides 3 → 2.
    const t = dragProgress('move2', BOB_DISTANCE);
    const lift = liftAmount('move2', BOB_DISTANCE);
    const released = isReleased('move2', BOB_DISTANCE);
    return [
      { label: 'A', kind: 'neutral', slot: 0,         opacity: 1 },
      {
        label: released ? 'B″' : 'B',
        kind:  released ? 'bob' : 'neutral',
        slot: 1 + 2 * t, opacity: 1, lift,
      },
      { label: 'C', kind: 'neutral', slot: 2 - t,     opacity: 1 },
      { label: 'D', kind: 'neutral', slot: 3 - t,     opacity: 1 },
    ];
  }

  function mergedItems() {
    // Final merged list: [A, C, B′(alice), D, B″(bob)]
    // - Both deletes of original B collapse into one tombstone.
    // - Alice's insert "B′ after C" lands between C and D.
    // - Bob's insert "B″ after D" lands at the end.
    // Items appear left-to-right during mergeFill; the two duplicate
    // B's get a pulsing glow during the highlight stage.
    const m = P('mergeFill');
    const glow = active('highlight', 100, 200);

    const items = [
      { label: 'A',  kind: 'neutral', slot: 0 },
      { label: 'C',  kind: 'neutral', slot: 1 },
      { label: 'B′', kind: 'alice',   slot: 2, glow },
      { label: 'D',  kind: 'neutral', slot: 3 },
      { label: 'B″', kind: 'bob',     slot: 4, glow },
    ];

    // Stagger reveal: item i opens its window at i*0.13 of the stage.
    const window = 0.35;
    return items.map((item, i) => {
      const t0 = i * 0.13;
      const t1 = t0 + window;
      let opacity;
      if (m <= t0) opacity = 0;
      else if (m >= t1) opacity = 1;
      else opacity = easeOut((m - t0) / window);
      return { ...item, opacity };
    });
  }

  // ---- items rendering ---------------------------------------------

  function drawItems(ctx, items, listX, itemsY) {
    // Sort so lifted items render last → they appear on top of any
    // neighbors they're sliding over.
    const sorted = [...items].sort(
      (a, b) => (a.lift || 0) - (b.lift || 0),
    );
    for (const item of sorted) {
      if (item.opacity <= 0.01) continue;
      const x = listX + item.slot * (ITEM_W + ITEM_GAP);
      const y = itemsY - (item.lift || 0);
      drawListItem(ctx, item, x, y);
    }
  }

  function drawListItem(ctx, item, x, y) {
    let fill, stroke, text;
    if (item.kind === 'alice') {
      fill = COLORS.aliceFill;
      stroke = COLORS.aliceStroke;
      text = COLORS.aliceText;
    } else if (item.kind === 'bob') {
      fill = COLORS.bobFill;
      stroke = COLORS.bobStroke;
      text = COLORS.bobText;
    } else {
      fill = COLORS.neutralFill;
      stroke = COLORS.neutralStroke;
      text = COLORS.neutralText;
    }

    ctx.save();
    ctx.globalAlpha = item.opacity;

    // Glow halo for highlighted items.
    if (item.glow && item.glow > 0) {
      const glowColor = item.kind === 'alice' ? COLORS.aliceGlow : COLORS.bobGlow;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12 * easeOut(item.glow);
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    roundRect(ctx, x, y, ITEM_W, ITEM_H, 5);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = text;
    ctx.font = '600 16px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, x + ITEM_W / 2, y + ITEM_H / 2 + 1);

    ctx.restore();
  }

  // ---- sync arrows --------------------------------------------------
  //
  // Two diagonal arrows from each user panel's bottom-center down to
  // the merged panel's top edge. During the sync stage, small pills
  // travel along them, colored per-user.

  function drawSyncArrows(ctx) {
    const ax1 = ALICE_X + ALICE_W / 2;
    const ay1 = ALICE_Y + ALICE_H + 2;
    const ax2 = MERGE_X + MERGE_W * 0.30;
    const ay2 = MERGE_Y - 2;

    const bx1 = BOB_X + BOB_W / 2;
    const by1 = BOB_Y + BOB_H + 2;
    const bx2 = MERGE_X + MERGE_W * 0.70;
    const by2 = MERGE_Y - 2;

    const t = active('sync', 200, 400);

    drawSyncArrow(ctx, ax1, ay1, ax2, ay2, COLORS.alice, t);
    drawSyncArrow(ctx, bx1, by1, bx2, by2, COLORS.bob,   t);

    // Flying pills on each arrow during the sync stage.
    flyPill(ctx, 'sync', ax1, ay1, ax2, ay2, COLORS.alice);
    flyPill(ctx, 'sync', bx1, by1, bx2, by2, COLORS.bob);
  }

  function drawSyncArrow(ctx, x1, y1, x2, y2, brightColor, brightness) {
    const dim = COLORS.arrow;
    const color = brightness > 0
      ? mixRgba(dim, brightColor, easeOut(brightness))
      : dim;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = brightness > 0 ? 1.4 : 1;
    ctx.setLineDash(brightness > 0 ? [] : [3, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead at the destination, oriented along the line direction.
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / len;
    const ny = dy / len;
    const headSize = 6;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - nx * headSize - ny * 3.5, y2 - ny * headSize + nx * 3.5);
    ctx.lineTo(x2 - nx * headSize + ny * 3.5, y2 - ny * headSize - nx * 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function flyPill(ctx, stageName, x1, y1, x2, y2, color) {
    const p = P(stageName);
    if (state === 'idle' || state === 'done' || p <= 0 || p >= 1) return;
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

  // ---- merged panel -------------------------------------------------

  function drawMergePanel(ctx) {
    ctx.save();
    // Border glows during the highlight stage to pull attention to the
    // bug being revealed.
    const glow = active('highlight', 100, 400);
    ctx.fillStyle = COLORS.cardBg;
    ctx.strokeStyle = glow > 0
      ? mixRgba(COLORS.cardBorder, 'rgba(245, 215, 122, 0.85)', easeOut(glow))
      : COLORS.cardBorder;
    ctx.lineWidth = glow > 0 ? 1.4 : 1;
    roundRect(ctx, MERGE_X, MERGE_Y, MERGE_W, MERGE_H, 6);
    ctx.fill();
    ctx.stroke();

    // Header
    ctx.fillStyle = COLORS.label;
    ctx.font = '600 13px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('after merge', MERGE_X + MERGE_W / 2, MERGE_Y + HEADER_DY);

    // Items
    const items = mergedItems();
    drawItems(ctx, items, MERGE_LIST_X, MERGE_ITEMS_Y);

    ctx.restore();
  }

  // ---- initial render ---------------------------------------------
  render();
}

// === COLOR UTILITIES ==================================================

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
