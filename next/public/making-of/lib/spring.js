// Tiny critically-ish-damped spring for animating numeric values.
// Use one Spring per value. Call `set` to retarget; `tick(dt)` to advance.
// Honors prefers-reduced-motion by snapping instantly when motion is reduced.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Spring {
  constructor(value = 0, { stiffness = 170, damping = 22, precision = 0.01 } = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
    this.precision = precision;
  }

  set(target) {
    this.target = target;
    if (reduced) {
      this.value = target;
      this.velocity = 0;
    }
  }

  /** Advance by dt seconds. Returns true if still settling. */
  tick(dt) {
    const dx = this.target - this.value;
    if (reduced || (Math.abs(dx) < this.precision && Math.abs(this.velocity) < this.precision)) {
      this.value = this.target;
      this.velocity = 0;
      return false;
    }
    // semi-implicit Euler
    const a = this.stiffness * dx - this.damping * this.velocity;
    this.velocity += a * dt;
    this.value += this.velocity * dt;
    return true;
  }
}

/**
 * Run `tick(dt)` every frame while it returns true. `tick` receives the
 * elapsed seconds since the previous frame.
 */
export function loop(tick) {
  let last = performance.now();
  let stopped = false;
  function frame(now) {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const more = tick(dt);
    if (more) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => { stopped = true; };
}
