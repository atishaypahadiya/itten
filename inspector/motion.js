// Motion. Two functions that run inside the page; each must stay
// self-contained: no imports and no references to anything outside it.
//
// motionInit is installed before any page script runs. On every animation
// frame it records the time since the last frame, under the current phase
// (set from inspect.js: idle, hover over an element, scroll of a
// container), and every animation the document holds: CSS animations, CSS
// transitions and Web Animations. A mutation observer counts class and
// style changes per element, with the luminance after each, to find
// flashing driven by script.
//
// motionReport reads what was recorded: each animation's target, timing,
// easing and animated properties, the frame times per phase, and the
// toggles.

export function motionInit() {
  const M = (window.__ittenMotion = { phase: 'load', frames: {}, anims: [], seen: new WeakSet(), toggles: new Map(), last: null });
  M.setPhase = (p) => { M.phase = p; M.last = null; };
  const poll = () => {
    if (!document.getAnimations) return;
    for (const a of document.getAnimations()) {
      if (M.seen.has(a) || M.anims.length >= 2000) continue;
      M.seen.add(a);
      M.anims.push({ a, phase: M.phase, at: performance.now() });
    }
  };
  const loop = (t) => {
    if (M.last !== null) (M.frames[M.phase] ??= []).push(t - M.last);
    M.last = t;
    poll();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // Luminance of what an element paints, over white, after a change.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  M.lum = (color, opacity = 1) => {
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#fff'; cx.fillRect(0, 0, 1, 1); cx.fillStyle = color; cx.globalAlpha = opacity; cx.fillRect(0, 0, 1, 1); cx.globalAlpha = 1;
    const d = cx.getImageData(0, 0, 1, 1).data;
    return 0.2126 * lin(d[0]) + 0.7152 * lin(d[1]) + 0.0722 * lin(d[2]);
  };
  new MutationObserver((list) => {
    const t = performance.now();
    for (const m of list) {
      const el = m.target;
      if (el.nodeType !== 1 || !el.isConnected) continue;
      let rec = M.toggles.get(el);
      if (!rec) { if (M.toggles.size >= 500) continue; M.toggles.set(el, (rec = [])); }
      if (rec.length >= 400) continue;
      const s = getComputedStyle(el);
      rec.push([t, M.lum(s.backgroundColor, parseFloat(s.opacity))]);
    }
  }).observe(document, { attributes: true, attributeFilter: ['class', 'style'], subtree: true });
}

export function motionReport() {
  const M = window.__ittenMotion;
  if (!M) return null;
  const r2 = (v) => Math.round(v * 100) / 100;
  const sx = window.scrollX, sy = window.scrollY;
  const sel = (el) => {
    if (!el || el.nodeType !== 1) return null;
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && document.querySelectorAll('#' + el.id).length === 1) return '#' + el.id;
    if (el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    const p = el.parentElement, same = p ? [...p.children].filter((c) => c.localName === el.localName) : [];
    return (p ? sel(p) + ' > ' : '') + el.localName + (same.length > 1 ? `:nth-of-type(${same.indexOf(el) + 1})` : '');
  };
  const label = (el) => {
    let t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (t.length > 40) t = t.slice(0, 39) + '…';
    return el.localName + (el.classList[0] ? '.' + el.classList[0] : '') + (t ? ` "${t}"` : '');
  };
  const ignored = (el, check) => { const h = el.closest('[data-itten-ignore]'); return !!h && h.getAttribute('data-itten-ignore').split(/\s+/).some((v) => v === check || v === 'all'); };
  const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  const anims = [];
  for (const { a, phase } of M.anims) {
    const e = a.effect;
    const el = e && e.target;
    if (!el || !el.isConnected) continue;
    const timing = e.getTiming(), kfs = e.getKeyframes();
    const kind = a.constructor.name;
    const props = kind === 'CSSTransition' ? [a.transitionProperty] : [...new Set(kfs.flatMap((k) => Object.keys(k)).filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)).map(kebab))];
    const easing = kind === 'CSSAnimation' ? (kfs[0]?.easing || timing.easing) : (timing.easing !== 'linear' ? timing.easing : (kfs[0]?.easing || 'linear'));
    const q = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    // Luminance at each keyframe, for flashing: background colour and
    // opacity where the keyframe sets them, the element's own otherwise.
    const lums = kfs.map((k) => M.lum(k.backgroundColor || s.backgroundColor, k.opacity !== undefined ? parseFloat(k.opacity) : parseFloat(s.opacity)));
    anims.push({
      sel: sel(el), label: label(el), pseudo: e.pseudoElement || null, rect: [r2(q.left + sx), r2(q.top + sy), r2(q.width), r2(q.height)],
      kind, name: a.animationName || a.transitionProperty || a.id || '', phase,
      duration: typeof timing.duration === 'number' ? timing.duration : 0, delay: timing.delay, iterations: timing.iterations, direction: timing.direction,
      easing, props, lums,
      ignore: ['motion-timing', 'reduced-motion', 'motion-layout', 'flash'].filter((c) => ignored(el, c)),
    });
  }
  const toggles = [];
  for (const [el, rec] of M.toggles) {
    if (rec.length < 7 || !el.isConnected || ignored(el, 'flash')) continue;
    const q = el.getBoundingClientRect();
    toggles.push({ sel: sel(el), label: label(el), rect: [r2(q.left + sx), r2(q.top + sy), r2(q.width), r2(q.height)], rec });
  }
  return { anims, frames: M.frames, toggles };
}
