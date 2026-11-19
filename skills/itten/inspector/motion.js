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
// It also observes Long Animation Frames (the 'long-animation-frame'
// performance entry): every frame the browser took more than 50 ms to
// produce, with the scripts that ran in it. Each is filed under the phase
// that was current when the frame started.
//
// motionReport reads what was recorded: each animation's target, timing,
// easing and animated properties, the frame times and long animation
// frames per phase, and the toggles.
//
// benchmarkIndex measures how fast the page's main thread runs, so the CPU
// can be slowed to a declared reference device rather than by a fixed
// factor.

export function motionInit() {
  const M = (window.__ittenMotion = { phase: 'load', frames: {}, anims: [], seen: new WeakSet(), toggles: new Map(), last: null, marks: [[0, 'load']], loafs: [], loafSupported: false });
  M.setPhase = (p) => { M.phase = p; M.last = null; M.marks.push([performance.now(), p]); };
  M.addLoafs = (entries) => {
    for (const e of entries) {
      if (M.loafs.length >= 5000) return;
      M.loafs.push({ start: e.startTime, duration: e.duration, blocking: e.blockingDuration,
        scripts: (e.scripts || []).map((x) => ({ invoker: x.invoker, type: x.invokerType, source: x.sourceURL, fn: x.sourceFunctionName, at: x.sourceCharPosition, duration: x.duration })) });
    }
  };
  try {
    M.loafObserver = new PerformanceObserver((list) => M.addLoafs(list.getEntries()));
    M.loafObserver.observe({ type: 'long-animation-frame', buffered: true });
    M.loafSupported = PerformanceObserver.supportedEntryTypes.includes('long-animation-frame');
  } catch { /* not supported: frame times only */ }
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
  // Tag and first class, never the text (see collect.js).
  const label = (el) => el.localName + (el.classList[0] ? '.' + el.classList[0] : '');
  // As in collect.js: the opening text of an element, about 60 characters, for a reader of
  // the report only: it is never compared between runs (the text can change
  // while the page runs) and never part of a fingerprint or a label.
  const opening = (el) => {
    let t = (el.getAttribute?.('aria-label') || el.getAttribute?.('alt') || '').trim();
    if (!t) {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/^(script|style|noscript|template)$/i.test(n.parentNode?.localName ?? '') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      for (let n; (n = w.nextNode()) && t.length < 80;) t += ' ' + n.data;
    }
    t = t.replace(/\s+/g, ' ').trim();
    return t.length > 60 ? t.slice(0, 59) + '…' : t;
  };
  // On the element itself; on what is inside it only with data-itten-ignore-subtree.
  const ignored = (el, check) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (!e.hasAttribute('data-itten-ignore') || (e !== el && !e.hasAttribute('data-itten-ignore-subtree'))) continue;
      if (e.getAttribute('data-itten-ignore').split(/\s+/).some((v) => v === check || v === 'all')) return true;
    }
    return false;
  };
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
    // A transition reversed before it finished runs for less than its
    // declared duration (CSS Transitions, the reversing shortening factor);
    // the declared one is the author's choice, so it is the one judged.
    let duration = typeof timing.duration === 'number' ? timing.duration : 0;
    if (kind === 'CSSTransition') {
      const props = s.transitionProperty.split(',').map((x) => x.trim());
      const durs = s.transitionDuration.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 1 : 1000));
      let i = props.indexOf(a.transitionProperty);
      if (i < 0) i = props.indexOf('all');
      if (i >= 0 && durs.length) duration = Math.max(duration, durs[i % durs.length]);
    }
    // Luminance at each keyframe, for flashing: background colour and
    // opacity where the keyframe sets them, the element's own otherwise.
    const lums = kfs.map((k) => M.lum(k.backgroundColor || s.backgroundColor, k.opacity !== undefined ? parseFloat(k.opacity) : parseFloat(s.opacity)));
    anims.push({
      sel: sel(el), label: label(el), ...(opening(el) ? { text: opening(el) } : {}), pseudo: e.pseudoElement || null, rect: [r2(q.left + sx), r2(q.top + sy), r2(q.width), r2(q.height)],
      kind, name: a.animationName || a.transitionProperty || a.id || '', phase,
      duration, delay: timing.delay, iterations: timing.iterations, direction: timing.direction,
      easing, props, lums,
      ignore: ['motion-timing', 'reduced-motion', 'motion-layout', 'flash'].filter((c) => ignored(el, c)),
    });
  }
  const toggles = [];
  for (const [el, rec] of M.toggles) {
    if (rec.length < 7 || !el.isConnected || ignored(el, 'flash')) continue;
    const q = el.getBoundingClientRect();
    toggles.push({ sel: sel(el), label: label(el), ...(opening(el) ? { text: opening(el) } : {}), rect: [r2(q.left + sx), r2(q.top + sy), r2(q.width), r2(q.height)], rec });
  }
  // Long animation frames by the phase current when each frame began.
  if (M.loafObserver) M.addLoafs(M.loafObserver.takeRecords());
  const loafs = {};
  for (const f of M.loafs) {
    let ph = 'load';
    for (const [t, p] of M.marks) { if (t <= f.start) ph = p; else break; }
    (loafs[ph] ??= []).push(f);
  }
  return { anims, frames: M.frames, loafs, loafSupported: M.loafSupported, toggles };
}

// A benchmark index in the units of Lighthouse's computeBenchmarkIndex
// (core/lib/page-functions.js), so its published device classes apply:
// the mean of two half-second loops, one that builds strings and so
// exercises the garbage collector, one that copies integer arrays and does
// not, each as iterations per second divided by 10. Lighthouse places a
// Moto G4-class mid-tier phone between 125 and 800, a high-end desktop
// between 1500 and 2000 (docs/throttling.md, Chrome 86).
export function benchmarkIndex() {
  const withGC = () => {
    const t0 = Date.now();
    let n = 0;
    while (Date.now() - t0 < 500) {
      let s = '';
      for (let j = 0; j < 10000; j++) s += 'a';
      if (s.length === 1) break;
      n++;
    }
    return n / ((Date.now() - t0) / 1000) / 10;
  };
  const withoutGC = () => {
    const a = new Array(100000).fill(0).map((_, i) => i), b = new Array(100000).fill(0);
    const t0 = Date.now();
    let n = 0;
    for (;;) {
      // Date.now() every 10th iteration, so the clock does not dominate.
      if (n % 10 === 9 && Date.now() - t0 >= 500) break;
      const src = n % 2 ? b : a, dst = n % 2 ? a : b;
      for (let j = 0; j < src.length; j++) dst[j] = src[j];
      n++;
    }
    return n / ((Date.now() - t0) / 1000) / 10;
  };
  return Math.round((withGC() + withoutGC()) / 2);
}
