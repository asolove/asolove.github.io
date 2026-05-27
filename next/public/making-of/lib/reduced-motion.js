// Single source of truth for reduced-motion preference. Re-evaluates on
// change so an interactive can hot-swap its animation strategy if needed.

const mq = matchMedia('(prefers-reduced-motion: reduce)');

export const reducedMotion = {
  get matches() { return mq.matches; },
  subscribe(fn) {
    const handler = (e) => fn(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  },
};
