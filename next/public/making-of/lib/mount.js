// Scans the document for [data-interactive="name"] elements and dynamically
// imports the matching module from /interactives/{name}.js. Each interactive
// module's default export is a function (element) => void that mounts itself.
//
// Lazy: each interactive only loads when scrolled into view (saves bandwidth
// on a long-scroll post).

const seen = new WeakSet();

async function mount(el) {
  if (seen.has(el)) return;
  seen.add(el);
  const name = el.dataset.interactive;
  if (!name) return;
  try {
    const mod = await import(`../interactives/${name}.js`);
    if (typeof mod.default === 'function') {
      mod.default(el);
    } else {
      console.warn(`interactive "${name}" has no default export`);
    }
  } catch (err) {
    console.error(`failed to load interactive "${name}":`, err);
    el.innerHTML = `<p style="color: var(--fg-soft)">Could not load interactive: ${name}</p>`;
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        mount(entry.target);
        observer.unobserve(entry.target);
      }
    }
  },
  { rootMargin: '200px 0px' }
);

for (const el of document.querySelectorAll('[data-interactive]')) {
  observer.observe(el);
}

// Fire a Fathom event whenever a play button on any interactive is
// clicked, tagged with the interactive's id-name. Paranoid:
//   - One outer try/catch so anything thrown during path lookup is
//     swallowed (analytics must never affect UX or the animation).
//   - The actual fathom call runs in a macrotask (setTimeout 0) so it
//     can't possibly run inside the click handler's stack.
//   - Capability checks: `window.fathom` and `trackEvent` must exist
//     and be the right shape before we call.
//   - Inner try/catch around the fathom call itself.
//   - No e.preventDefault / e.stopPropagation — we only observe.
// Capture phase so we still fire if anything downstream stops the
// event (none of the current handlers do, but this is harmless and
// future-proof).
document.addEventListener('click', (e) => {
  try {
    const target = e && e.target;
    const playBtn = target && target.closest && target.closest('.ix-play');
    if (!playBtn) return;
    const container = playBtn.closest('[data-interactive]');
    if (!container) return;
    const name = container.dataset && container.dataset.interactive;
    if (!name) return;
    setTimeout(() => {
      try {
        if (window.fathom && typeof window.fathom.trackEvent === 'function') {
          window.fathom.trackEvent('play', {
            article: location.pathname,
            interactive: name,
          });
        }
      } catch (_) {
        // analytics failures must not affect anything
      }
    }, 0);
  } catch (_) {
    // analytics failures must not affect anything
  }
}, { capture: true });
