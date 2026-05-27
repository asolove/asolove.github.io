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
