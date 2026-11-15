// Runs inside the page through page.evaluate. It must stay self-contained:
// no imports and no references to anything outside this function.
//
// It measures layout boxes only. The insides of drawn content (svg,
// canvas, img, video, picture, iframe, object, embed, math and audio
// elements, and elements with role="img", such as a diagram drawn with
// divs) are treated as opaque graphics: their outer box is measured, their
// contents are not. A <figure> is not a graphic: its table, its text and
// its caption are measured like the rest of the page.

export function collect(opts) {
  const want = new Set(opts.checks || []);
  const system = opts.system || null;
  const dpr = opts.dpr || 1;
  const NEAR_MIN = 0.5, NEAR_MAX = 3, NEAR_REACH = 96;
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const sx = window.scrollX, sy = window.scrollY;
  const issues = [];
  const counts = { graphics: 0, ignored: 0, elements: 0, text: 0, relativeSpacing: 0 };
  const data = { spacing: {}, fontSizes: {}, radii: {}, capsules: 0, text: [], fontReps: [], fontFaces: [], textSizes: {}, spacingObs: [], typeObs: [], labels: {} };
  const r2 = (v) => Math.round(v * 100) / 100;
  const r1 = (v) => Math.round(v * 10) / 10;
  const P = (q) => [r2(q.left + sx), r2(q.top + sy), r2(q.width), r2(q.height)];
  const fmt = (v) => String(r2(v));

  // Colour parsing through a 1 x 1 canvas, so any CSS colour syntax works.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const colCache = new Map();
  const col = (c) => {
    if (colCache.has(c)) return colCache.get(c);
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    const v = [d[0], d[1], d[2], r2(d[3] / 255)];
    colCache.set(c, v); return v;
  };

  // Selectors: a path of tag:nth-of-type steps up to the nearest id.
  const selCache = new Map();
  const sel = (el) => {
    if (selCache.has(el)) return selCache.get(el);
    let s;
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && document.querySelectorAll('#' + el.id).length === 1) s = '#' + el.id;
    else if (el === doc) s = 'html';
    else if (el === document.body) s = 'body';
    else {
      const p = el.parentElement, tag = el.localName;
      let part = tag;
      if (p) {
        const same = [...p.children].filter((c) => c.localName === tag);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
      }
      s = (p ? sel(p) + ' > ' : '') + part;
    }
    selCache.set(el, s);
    return s;
  };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join(' ').replace(/\s+/g, ' ').trim();
  const label = (el) => {
    let t = ownText(el) || (el.getAttribute('aria-label') || el.getAttribute('alt') || el.innerText || '').replace(/\s+/g, ' ').trim();
    if (t.length > 40) t = t.slice(0, 39) + '…';
    const cls = el.classList && el.classList[0] ? '.' + el.classList[0] : '';
    return el.localName + cls + (t ? ` "${t}"` : '');
  };
  const E = (e) => ({ sel: sel(e.el), label: label(e.el), rect: P(e.r) });

  // data-itten-ignore="check-id ..." on the element or an ancestor.
  const ignoredPairs = new Set();
  const live = (e, check) => {
    const h = e.el.closest('[data-itten-ignore]');
    if (!h) return true;
    const v = h.getAttribute('data-itten-ignore').split(/\s+/);
    if (!v.includes(check) && !v.includes('all')) return true;
    const k = check + '|' + sel(e.el);
    if (!ignoredPairs.has(k)) { ignoredPairs.add(k); counts.ignored++; }
    return false;
  };

  const report = (check, severity, key, message, ents, extra = {}) => {
    issues.push({
      check, severity, key, message,
      count: extra.count ?? ents.length,
      elements: ents.slice(0, 8).map(E),
      marks: extra.marks || [],
      crop: extra.crop || 'union',
      ...(extra.lines ? { lines: extra.lines } : {}),
    });
  };

  // ---------------------------------------------------------------- walk
  const GRAPHIC = new Set(['svg', 'canvas', 'img', 'video', 'picture', 'iframe', 'object', 'embed', 'math', 'audio']);
  const FORM = new Set(['input', 'button', 'select', 'textarea', 'progress', 'meter']);
  const NOTEXT = new Set(['textarea', 'select', 'option', 'optgroup', 'script', 'style', 'noscript', 'template', 'title']);
  const entries = [];
  const byEl = new Map();
  const graphicFontSizes = {};
  const visit = (el, parent) => {
    const s = getComputedStyle(el);
    if (s.display === 'none') return;
    const tag = el.localName;
    const graphic = GRAPHIC.has(tag) || el.getAttribute('role') === 'img';
    const r = el.getBoundingClientRect();
    // Opacity and visibility are tested directly as well: not every engine
    // honours checkVisibility's options (WebKit counts opacity: 0 as visible).
    const op = parseFloat(s.opacity) * (parent ? parent.op : 1);
    const vis = r.width > 1 && r.height > 1 && op > 0.02 && s.visibility === 'visible' && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const e = { el, s, r, tag, graphic, vis, parent, op };
    entries.push(e); byEl.set(el, e);
    if (graphic) {
      counts.graphics++;
      for (const t of el.querySelectorAll ? el.querySelectorAll('text, tspan') : []) {
        if ([...t.childNodes].some((n) => n.nodeType === 3 && n.data.trim())) { const fs = Math.round(parseFloat(getComputedStyle(t).fontSize) * 100) / 100; graphicFontSizes[fs] = (graphicFontSizes[fs] || 0) + 1; }
      }
      return;
    }
    for (const c of el.children) visit(c, e);
  };
  visit(document.body, null);
  const visEntries = entries.filter((e) => e.vis);
  counts.elements = visEntries.length;

  const range = document.createRange();
  for (const e of visEntries) {
    e.textNodes = e.graphic || NOTEXT.has(e.tag) ? [] : [...e.el.childNodes].filter((n) => n.nodeType === 3 && n.data.trim());
  }
  const lines = (e) => {
    if (e.lines) return e.lines;
    const out = [];
    for (const n of e.textNodes) {
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) if (q.width >= 1 && q.height >= 1) out.push(q);
    }
    return (e.lines = out);
  };
  // A text block's lines over all its text, inline descendants included
  // (span, a, em), for its edges: when a line begins with an inline child,
  // the block's own text nodes start somewhere inside it. Text in a
  // descendant that is laid out as a block of its own is left to that block.
  const edgeLines = (e) => {
    if (e.edgeLines) return e.edgeLines;
    const out = [];
    const walker = document.createTreeWalker(e.el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.data.trim()) continue;
      let inline = true;
      for (let p = n.parentElement; p && p !== e.el; p = p.parentElement) {
        const d = getComputedStyle(p).display;
        if (!(d.startsWith('inline') || d === 'contents') || p.namespaceURI !== 'http://www.w3.org/1999/xhtml') { inline = false; break; }
      }
      if (!inline) continue;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) if (q.width >= 1 && q.height >= 1) out.push(q);
    }
    return (e.edgeLines = out.length ? out : lines(e));
  };
  const textEntries = visEntries.filter((e) => e.textNodes.length && lines(e).length);
  counts.text = textEntries.length;

  const shape = (e) => {
    if (e.shape !== undefined) return e.shape;
    const s = e.s;
    let v = e.graphic || FORM.has(e.tag) || col(s.backgroundColor)[3] > 0.02 || s.backgroundImage !== 'none' || s.boxShadow !== 'none';
    if (!v) {
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const st = s[`border${side}Style`];
        if (parseFloat(s[`border${side}Width`]) > 0 && st !== 'none' && st !== 'hidden' && col(s[`border${side}Color`])[3] > 0.02) { v = true; break; }
      }
    }
    return (e.shape = v);
  };
  const painted = (e) => e.vis && shape(e) && e.el !== document.body;
  const paintedAncestor = (e) => { let a = e.parent; while (a && !painted(a)) a = a.parent; return a; };

  const opCache = new Map();
  const opacity = (el) => {
    if (!el || el === doc) return 1;
    if (opCache.has(el)) return opCache.get(el);
    const v = parseFloat(getComputedStyle(el).opacity) * opacity(el.parentElement);
    opCache.set(el, v); return v;
  };

  const nearest = (scale, v) => {
    const lo = [...scale].reverse().find((x) => x < v), hi = scale.find((x) => x > v);
    return [lo, hi].filter((x) => x !== undefined);
  };
  const isInline = (e) => /^inline/.test(e.s.display);

  // Corner radius in px, after percentage resolution and clamping.
  const CORNERS = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'];
  const corner = (e, k) => {
    const [hx, hy = hx] = e.s[`border${k}Radius`].split(' ');
    const px = (t, dim) => (t.endsWith('%') ? (parseFloat(t) / 100) * dim : parseFloat(t));
    const raw = Math.min(px(hx, e.r.width), px(hy, e.r.height));
    const cap = Math.min(e.r.width, e.r.height) / 2;
    return { r: Math.min(raw, cap), capsule: raw > 0 && raw >= cap - 0.5 };
  };
  // Distances from an ancestor's corner to a descendant's corner.
  const insets = (a, e, k) => {
    const A = a.r, B = e.r;
    return {
      TopLeft: [B.left - A.left, B.top - A.top],
      TopRight: [A.right - B.right, B.top - A.top],
      BottomRight: [A.right - B.right, A.bottom - B.bottom],
      BottomLeft: [B.left - A.left, A.bottom - B.bottom],
    }[k];
  };
  const clips = (e) => e.s.overflowX !== 'visible' || e.s.overflowY !== 'visible' || e.s.clipPath !== 'none';

  // ------------------------------------------------- spacing and type
  // These two checks only observe here. Values are judged across the whole
  // width sweep in inspect.js, so that one fluid rule (clamp, vw) is one
  // finding rather than one finding per width.
  // spacingObs: observe spacing without judging it, for the 200% text pass,
  // where spacing-unit compares each value with the same one at 100%.
  if (want.has('spacing-scale') || opts.spacingObs) {
    const PROPS = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'row-gap', 'column-gap'];
    data.spacingObs = [];
    for (const e of visEntries) {
      if (!live(e, want.has('spacing-scale') ? 'spacing-scale' : 'spacing-unit')) continue;
      const flexGrid = /flex|grid/.test(e.s.display);
      const inline = e.s.display === 'inline';
      // CSS Typed OM tells px from % and auto; engines without it skip this.
      if (!e.el.computedStyleMap) break;
      const map = e.el.computedStyleMap();
      for (const p of PROPS) {
        if (p.endsWith('gap') && !flexGrid) continue;
        if (e.graphic && !p.startsWith('margin')) continue;
        if (inline && (p === 'margin-top' || p === 'margin-bottom')) continue;
        const v = map.get(p);
        if (!(v instanceof CSSUnitValue)) continue;
        if (v.unit !== 'px') { if (v.value !== 0) counts.relativeSpacing++; continue; }
        const x = r2(Math.abs(v.value));
        if (x < 0.01) continue;
        data.spacing[x] = (data.spacing[x] || 0) + 1;
        if (data.spacingObs.length < 30000) { const k = sel(e.el); data.spacingObs.push([k, p, x]); if (!(k in data.labels)) data.labels[k] = label(e.el); }
      }
    }
  }
  if (want.has('type-scale') || opts.recordSizes) {
    data.typeObs = [];
    for (const e of textEntries) {
      const fs = r2(parseFloat(e.s.fontSize));
      if (opts.recordSizes && Object.keys(data.textSizes).length < 3000 && live(e, 'text-resize')) { const k = sel(e.el); data.textSizes[k] = fs; if (!(k in data.labels)) data.labels[k] = label(e.el); }
      if (!want.has('type-scale') || !live(e, 'type-scale')) continue;
      data.fontSizes[fs] = (data.fontSizes[fs] || 0) + 1;
      const lh = e.s.lineHeight === 'normal' ? 'normal' : r2(parseFloat(e.s.lineHeight));
      // A run: an inline element at the size of the block of text it sits
      // in, such as a strong or a link inside a paragraph. It belongs to the
      // block's step, so its weight is not judged on its own.
      let b = e.parent;
      while (b && isInline(b)) b = b.parent;
      const run = isInline(e) && !!b && b.textNodes?.length > 0 && Math.abs(parseFloat(b.s.fontSize) - fs) < 0.05;
      const family = e.s.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      if (data.typeObs.length < 10000) { const k = sel(e.el); data.typeObs.push([k, fs, lh, parseFloat(e.s.fontWeight), family, run]); if (!(k in data.labels)) data.labels[k] = label(e.el); }
    }
  }

  // ----------------------------------------------------------- near-miss
  if (want.has('near-miss-edge')) {
    const items = [];
    for (const e of visEntries) {
      if (!painted(e) || e.r.width < 4 || e.r.height < 4 || !live(e, 'near-miss-edge')) continue;
      items.push({ e, l: e.r.left, r: e.r.right, t: e.r.top, box: e.r, cx: (e.r.left + e.r.right) / 2, cy: (e.r.top + e.r.bottom) / 2 });
    }
    const mcache = new Map();
    const ascent = (s) => {
      const f = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      if (mcache.has(f)) return mcache.get(f);
      cx.font = f;
      const m = cx.measureText('Hxg');
      const v = m.fontBoundingBoxAscent / (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent);
      mcache.set(f, v); return v;
    };
    for (const e of textEntries) {
      if (isInline(e) || !live(e, 'near-miss-edge')) continue;
      const L = edgeLines(e);
      const ta = e.s.textAlign, rtl = e.s.direction === 'rtl';
      const left = ta === 'left' || ta === 'justify' || (ta === 'start' && !rtl) || (ta === 'end' && rtl);
      const right = ta === 'right' || (ta === 'end' && !rtl) || (ta === 'start' && rtl);
      const box = { left: Math.min(...L.map((q) => q.left)), right: Math.max(...L.map((q) => q.right)), top: Math.min(...L.map((q) => q.top)), bottom: Math.max(...L.map((q) => q.bottom)) };
      items.push({
        e, text: true, box,
        l: left ? box.left : null, r: right ? box.right : null,
        base: L[0].top + L[0].height * ascent(e.s),
        cx: (box.left + box.right) / 2, cy: (box.top + box.bottom) / 2,
      });
    }
    const NAMES = { l: 'Left edges', r: 'Right edges', t: 'Top edges', base: 'Baselines' };
    const seen = new Set();
    const compare = (prop, vertical) => {
      const L = items.filter((i) => i[prop] != null).sort((a, b) => a[prop] - b[prop]);
      for (let i = 0; i < L.length; i++) {
        for (let j = i + 1; j < L.length && L[j][prop] - L[i][prop] <= NEAR_MAX; j++) {
          const a = L[i], b = L[j], d = b[prop] - a[prop];
          if (d < NEAR_MIN || a.e === b.e || a.e.el.contains(b.e.el) || b.e.el.contains(a.e.el)) continue;
          if (vertical) {
            const gap = Math.max(a.box.top, b.box.top) - Math.min(a.box.bottom, b.box.bottom);
            if (gap > NEAR_REACH || Math.abs(a.cx - b.cx) < 0.5) continue;
          } else {
            const gap = Math.max(a.box.left, b.box.left) - Math.min(a.box.right, b.box.right);
            if (gap > NEAR_REACH || Math.abs(a.cy - b.cy) < 0.5) continue;
          }
          const pair = [sel(a.e.el), sel(b.e.el)].sort().join(' | ') + '|' + prop;
          if (seen.has(pair)) continue;
          seen.add(pair);
          const marks = [a, b].map((x) => vertical
            ? { x1: x[prop] + sx, y1: Math.min(a.box.top, b.box.top) + sy, x2: x[prop] + sx, y2: Math.max(a.box.bottom, b.box.bottom) + sy }
            : { x1: Math.min(a.box.left, b.box.left) + sx, y1: x[prop] + sy, x2: Math.max(a.box.right, b.box.right) + sx, y2: x[prop] + sy });
          report('near-miss-edge', 'warning', pair,
            `${NAMES[prop]} ${fmt(d)} px apart: ${label(a.e.el)} at ${fmt(a[prop] + (vertical ? sx : sy))}, ${label(b.e.el)} at ${fmt(b[prop] + (vertical ? sx : sy))}. Share the edge, or log the optical offset.`,
            [a.e, b.e], { marks });
        }
      }
    };
    compare('l', true); compare('r', true); compare('t', false); compare('base', false);
  }

  // --------------------------------------------------------- sibling gaps
  if (want.has('sibling-gaps')) {
    const gapsFor = (parent, run) => {
      if (!live(parent, 'sibling-gaps') || run.some((k) => !live(k, 'sibling-gaps'))) return;
      const v = [], h = [];
      for (let i = 1; i < run.length; i++) {
        const a = run[i - 1].r, b = run[i].r;
        const hO = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const vO = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const across = [Math.max(a.left, b.left) + sx, Math.min(a.right, b.right) + sx];
        const down = [Math.max(a.top, b.top) + sy, Math.min(a.bottom, b.bottom) + sy];
        if (b.top >= a.bottom - 0.5 && hO > 0) v.push({ g: b.top - a.bottom, m: { x1: across[0], y1: a.bottom + sy, x2: across[1], y2: b.top + sy }, pair: [run[i - 1], run[i]] });
        else if (b.left >= a.right - 0.5 && vO > 0) h.push({ g: b.left - a.right, m: { x1: a.right + sx, y1: down[0], x2: b.left + sx, y2: down[1] }, pair: [run[i - 1], run[i]] });
        else if (a.left >= b.right - 0.5 && vO > 0) h.push({ g: a.left - b.right, m: { x1: b.right + sx, y1: down[0], x2: a.left + sx, y2: down[1] }, pair: [run[i - 1], run[i]] });
      }
      for (const [axis, gs] of [['vertical', v], ['horizontal', h]]) {
        if (gs.length < 2) continue;
        const g = gs.map((x) => x.g);
        if (Math.max(...g) - Math.min(...g) <= 0.5) continue;
        // The usual gap is the most common one; the others are marked.
        const tally = new Map();
        for (const x of g) { const k = Math.round(x * 2) / 2; tally.set(k, (tally.get(k) || 0) + 1); }
        const usual = [...tally].sort((p, q) => q[1] - p[1])[0][0];
        const odd = gs.filter((x) => Math.abs(x.g - usual) > 0.5);
        report('sibling-gaps', 'warning', sel(parent.el) + '|' + axis + '|' + sel(run[0].el),
          `${axis === 'vertical' ? 'Vertical' : 'Horizontal'} gaps between ${run.length} ${run[0].tag} siblings in ${label(parent.el)} are ${g.map(fmt).join(', ')} px.`,
          [parent, ...run], { marks: odd.map((x) => x.m), crop: 'marks' });
      }
    };
    for (const e of visEntries) {
      if (e.graphic) continue;
      const kids = [...e.el.children].map((c) => byEl.get(c)).filter((k) => k && k.vis
        && !/^(absolute|fixed)$/.test(k.s.position) && !/^(inline|contents)$/.test(k.s.display) && k.s.float === 'none');
      let run = [];
      const flush = () => { if (run.length >= 3) gapsFor(e, run); run = []; };
      for (const k of kids) {
        const kind = k.tag + '|' + (k.el.getAttribute('role') || '') + '|' + (k.el.classList[0] || '');
        if (run.length && run[0].kind !== kind) flush();
        k.kind = kind; run.push(k);
      }
      flush();
    }
  }

  // --------------------------------------------------------------- radius
  const concentricFit = (e, k, r) => {
    const a = paintedAncestor(e);
    if (!a) return null;
    const ca = corner(a, k);
    if (!(ca.r > 0)) return null;
    const [dx, dy] = insets(a, e, k);
    if (dx < -0.5 || dy < -0.5 || Math.max(dx, dy) >= ca.r) return null;
    const d = (dx + dy) / 2;
    return { a, outer: ca.r, d, expected: Math.max(0, ca.r - d), clip: clips(a), ok: Math.abs(r - Math.max(0, ca.r - d)) <= 1 };
  };
  if (want.has('radius')) {
    const scale = system?.radius?.scale || null;
    const capsOK = system?.radius?.capsule !== false;
    const derive = system?.radius?.nesting === 'concentric';
    const vals = new Map();
    for (const e of visEntries) {
      if (!painted(e) || !live(e, 'radius')) continue;
      for (const k of CORNERS) {
        const c = corner(e, k);
        if (!(c.r > 0.25)) continue;
        let v;
        if (c.capsule) { data.capsules++; if (!scale || capsOK) continue; v = 'capsule'; }
        else v = r1(c.r);
        if (scale && v !== 'capsule') {
          if (scale.some((s) => Math.abs(s - v) < 0.05)) continue;
          if (derive && concentricFit(e, k, v)?.ok) continue;
        }
        let rec = vals.get(v);
        if (!rec) vals.set(v, (rec = { n: 0, ents: [] }));
        if (!rec.ents.includes(e)) { rec.n++; if (rec.ents.length < 8) rec.ents.push(e); }
      }
    }
    if (scale) {
      for (const [v, rec] of vals) {
        report('radius', 'warning', String(v), v === 'capsule'
          ? `Capsule (fully rounded) corners on ${rec.n} element${rec.n === 1 ? '' : 's'}; the system does not allow capsules.`
          : `Radius ${v} px is not in the radius set (${scale.join(', ')} px) and is not a concentric derivation; on ${rec.n} element${rec.n === 1 ? '' : 's'}.`,
        rec.ents, { count: rec.n, crop: 'each' });
      }
    } else {
      const vs = [...vals.keys()].sort((a, b) => a - b);
      for (const v of vs) data.radii[v] = vals.get(v).n;
      const close = vs.some((v, i) => i && v - vs[i - 1] <= 2);
      if (vs.length > 4 || close) {
        report('radius', 'warning', 'mixed', `${vs.length} different corner radii: ${vs.join(', ')} px. Values 1 to 2 px apart read as mistakes; keep a small closed set (SHP-02).`,
          vs.map((v) => vals.get(v).ents[0]), { count: vs.reduce((n, v) => n + vals.get(v).n, 0), crop: 'each' });
      }
    }
  }
  const RASTER = new Set(['img', 'video', 'canvas', 'picture', 'iframe']);
  if (want.has('radius-concentric')) {
    for (const e of visEntries) {
      if (!painted(e) || (e.graphic && !RASTER.has(e.tag)) || !live(e, 'radius-concentric')) continue;
      for (const k of CORNERS) {
        const c = corner(e, k);
        if (c.capsule) continue;
        const f = concentricFit(e, k, c.r);
        if (!f || f.ok || (f.d < 0.5 && f.clip)) continue;
        report('radius-concentric', 'warning', sel(e.el),
          `Corner radius ${r1(c.r)} px sits ${fmt(f.d)} px inside a ${r1(f.outer)} px corner of ${label(f.a.el)}; concentric would be ${r1(f.expected)} px (SHP-01).`,
          [e, f.a], { crop: 'union' });
        break;
      }
    }
  }

  // ---------------------------------------------------------- font probes
  if (opts.fonts) {
    // Form controls get the browser's own font (for example 13.33 px system
    // font or Arial) unless the stylesheet sets font: inherit. Compare their
    // computed family with the page's, whether or not they hold text yet.
    const declared = getComputedStyle(document.body).fontFamily;
    const controls = new Map();
    for (const e of visEntries) {
      if (!/^(button|input|select|textarea)$/.test(e.tag) || e.s.fontFamily === declared || !live(e, 'font-fallback')) continue;
      const k = `${e.s.fontFamily}|${e.s.fontSize}`;
      if (!controls.has(k)) controls.set(k, []);
      controls.get(k).push(e);
    }
    for (const [k, ents] of controls) {
      const [family, size] = k.split('|');
      const kinds = [...new Set(ents.map((e) => e.tag + (e.tag === 'input' ? `[type=${e.el.type}]` : '')))].join(', ');
      report('font-fallback', 'warning', 'control|' + k,
        `${ents.length} form control${ents.length === 1 ? '' : 's'} (${kinds}) computed in ${family} at ${size}, not the page's ${declared}. Browsers give controls their own font unless the stylesheet sets font: inherit; it shows as soon as there is text, a value or a placeholder.`,
        ents, { crop: 'each' });
    }
    const groups = new Map();
    let id = 0;
    for (const e of textEntries) {
      if (!live(e, 'font-fallback')) continue;
      const key = `${e.s.fontFamily}|${e.s.fontWeight}|${e.s.fontStyle}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { n: 0, reps: [] }));
      g.n++;
      if (id < 1500) {
        e.el.setAttribute('data-itten-font', String(id));
        const rep = { id: id++, family: e.s.fontFamily, weight: e.s.fontWeight, style: e.s.fontStyle, el: E(e), group: key };
        g.reps.push(rep); data.fontReps.push(rep);
      }
    }
    for (const rep of data.fontReps) rep.groupSize = groups.get(rep.group).n;
    data.fontFaces = [...document.fonts].map((f) => ({ family: f.family.replace(/^["']|["']$/g, ''), status: f.status, weight: f.weight, style: f.style }));
  }

  // ------------------------------------------------------- contrast data
  if (opts.contrast) {
    for (const e of textEntries) {
      if (data.text.length >= 2500) break;
      if (!live(e, 'contrast')) continue;
      if (e.el.closest(':disabled, [aria-disabled="true"]')) continue;
      const clipText = /text/.test(e.s.webkitBackgroundClip || '') || /text/.test(e.s.backgroundClip || '');
      data.text.push({
        el: E(e), lines: lines(e).slice(0, 8).map(P),
        color: col(e.s.webkitTextFillColor || e.s.color), opacity: r2(opacity(e.el)),
        size: parseFloat(e.s.fontSize), weight: parseFloat(e.s.fontWeight), clipText,
      });
    }
  }

  // ---------------------------------------------------------- target size
  if (want.has('target-size')) {
    const minT = system?.targets?.minimum ?? 24, comf = system?.targets?.comfortable ?? 44;
    const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], [role=option], [tabindex]:not([tabindex="-1"])';
    const T = [];
    for (const el of document.querySelectorAll(SEL)) {
      const e = byEl.get(el);
      if (!e || !e.vis || el.matches(':disabled')) continue;
      T.push({ e, r: e.r, cx: (e.r.left + e.r.right) / 2, cy: (e.r.top + e.r.bottom) / 2 });
    }
    const blockText = (e) => { let b = e.el.parentElement; while (b && /^inline/.test(getComputedStyle(b).display)) b = b.parentElement; return b ? (b.innerText || '').trim().length : 0; };
    const inSentence = (t) => isInline(t.e) && blockText(t.e) - (t.e.el.innerText || '').trim().length > 12;
    const hitsRect = (x, y, rad, q) => { const nx = Math.max(q.left, Math.min(x, q.right)), ny = Math.max(q.top, Math.min(y, q.bottom)); return (nx - x) ** 2 + (ny - y) ** 2 < rad * rad; };
    for (const t of T) t.small = t.r.width < minT - 0.01 || t.r.height < minT - 0.01;
    const comfy = [];
    for (const t of T) {
      if (!live(t.e, 'target-size')) continue;
      if (inSentence(t)) continue;
      if (!t.small) { if (t.r.width < comf - 0.01 || t.r.height < comf - 0.01) comfy.push(t.e); continue; }
      const other = T.find((o) => o !== t && !o.e.el.contains(t.e.el) && !t.e.el.contains(o.e.el)
        && (hitsRect(t.cx, t.cy, minT / 2, o.r) || (o.small && Math.hypot(o.cx - t.cx, o.cy - t.cy) < minT)));
      if (!other) { comfy.push(t.e); continue; }
      report('target-size', 'error', sel(t.e.el),
        `Target ${fmt(t.r.width)} × ${fmt(t.r.height)} px is below the ${minT} px minimum, and ${label(other.e.el)} is too close for the spacing exception (WCAG 2.5.8, INT-02).`,
        [t.e, other.e]);
    }
    if (comfy.length) {
      report('target-size', 'info', 'comfortable', `${comfy.length} target${comfy.length === 1 ? ' is' : 's are'} smaller than the comfortable ${comf} px (INT-01).`, comfy, { count: comfy.length, crop: 'each' });
    }
  }

  // ------------------------------------------------------------- overflow
  const pageScrollsX = doc.scrollWidth > vw + 0.5;
  const tight = (q, fs) => { const c = (q.top + q.bottom) / 2; return { left: q.left, right: q.right, top: c - 0.35 * fs, bottom: c + 0.35 * fs }; };
  if (want.has('overflow')) {
    if (pageScrollsX) {
      const clippedByAncestor = (e) => { let a = e.parent; while (a && a.el !== document.body) { if (a.s.overflowX !== 'visible') return true; a = a.parent; } return false; };
      const sticking = visEntries.filter((e) => e.el !== document.body && e.r.right > vw + 0.5 && (!e.parent || e.parent.r.right <= vw + 0.5) && !clippedByAncestor(e));
      const list = sticking.filter((e) => live(e, 'overflow'));
      const wideText = textEntries.filter((t) => !clippedByAncestor(t) && lines(t).some((q) => q.right > vw + 0.5));
      const textList = wideText.filter((t) => !wideText.some((o) => o !== t && o.el.contains(t.el)) && live(t, 'overflow'));
      if (list.length || textList.length) {
        for (const e of list.slice(0, 5)) {
          report('overflow', 'error', 'page|' + sel(e.el), `Sticks out ${fmt(e.r.right - vw)} px past the right edge; the page scrolls sideways (WCAG 1.4.10, LAY-03).`, [e]);
        }
        for (const t of textList.slice(0, 5)) {
          const by = Math.max(...lines(t).map((q) => q.right)) - vw;
          report('overflow', 'error', 'page-text|' + sel(t.el), `Text runs ${fmt(by)} px past the right edge, usually a word too long for the line; the page scrolls sideways (WCAG 1.4.10, LAY-03).`, [t]);
        }
      } else if (!sticking.length && !wideText.length) {
        report('overflow', 'error', 'page', `The page is ${fmt(doc.scrollWidth - vw)} px wider than the viewport and scrolls sideways (WCAG 1.4.10, LAY-03).`, [byEl.get(document.body)]);
      }
    }
    for (const t of textEntries) {
      const a = painted(t) ? t : paintedAncestor(t);
      if (!a || clips(a) || !live(t, 'overflow')) continue;
      const fs = parseFloat(t.s.fontSize), A = a.r;
      const spill = lines(t).map((q) => tight(q, fs)).find((q) => q.right > A.right + 1 || q.left < A.left - 1 || q.bottom > A.bottom + 1 || q.top < A.top - 1);
      if (!spill) continue;
      const by = Math.max(spill.right - A.right, A.left - spill.left, spill.bottom - A.bottom, A.top - spill.top);
      report('overflow', 'error', 'spill|' + sel(t.el), `Text spills ${fmt(by)} px out of ${a === t ? 'its own box' : label(a.el)}.`, a === t ? [t] : [t, a]);
    }
  }

  // ------------------------------------------------------------- clipping
  if (want.has('clipping')) {
    for (const t of textEntries) {
      if (!live(t, 'clipping')) continue;
      const fs = parseFloat(t.s.fontSize);
      const L = lines(t).map((q) => tight(q, fs));
      let done = false;
      for (let a = t; a && !done; a = a.parent) {
        if (!a.vis) continue;
        const cxp = /hidden|clip/.test(a.s.overflowX), cyp = /hidden|clip/.test(a.s.overflowY);
        if (!cxp && !cyp) continue;
        const bl = parseFloat(a.s.borderLeftWidth), bt = parseFloat(a.s.borderTopWidth);
        const box = { left: a.r.left + bl, top: a.r.top + bt, right: a.r.left + bl + a.el.clientWidth, bottom: a.r.top + bt + a.el.clientHeight };
        for (const q of L) {
          const inside = q.right > box.left && q.left < box.right && q.bottom > box.top && q.top < box.bottom;
          if (!inside) continue;
          const cutX = cxp && (q.right > box.right + 1 || q.left < box.left - 1);
          const cutY = cyp && (q.bottom > box.bottom + 1 || q.top < box.top - 1);
          if (!cutX && !cutY) continue;
          const ellipsis = cutX && a.s.textOverflow === 'ellipsis';
          const clamp = cutY && a.s.webkitLineClamp && a.s.webkitLineClamp !== 'none';
          if (ellipsis || clamp) {
            report('clipping', 'warning', 'trunc|' + sel(t.el), `Text is truncated ${ellipsis ? 'with an ellipsis' : `to ${a.s.webkitLineClamp} lines`} by ${a === t ? 'its own box' : label(a.el)}; make sure the full text is reachable.`, a === t ? [t] : [t, a]);
          } else {
            report('clipping', 'error', 'clip|' + sel(t.el), `Text is cut off by ${a === t ? 'its own box' : label(a.el)} (overflow: ${cutX ? a.s.overflowX : a.s.overflowY}).`, a === t ? [t] : [t, a]);
          }
          done = true; break;
        }
      }
      if (done || pageScrollsX) continue;
      let inScroller = false;
      for (let a = t.parent; a && a.el !== document.body; a = a.parent) if (a.s.overflowX !== 'visible') { inScroller = true; break; }
      if (inScroller) continue;
      const cut = L.find((q) => (q.left < -1 && q.right > 0) || (q.right > vw + 1 && q.left < vw));
      if (cut) report('clipping', 'error', 'viewport|' + sel(t.el), 'Text is cut off by the edge of the viewport.', [t]);
    }
  }

  // -------------------------------------------------------------- overlap
  if (want.has('overlap')) {
    const B = 64, grid = new Map(), seen = new Set();
    for (const t of textEntries) {
      if (!live(t, 'overlap')) continue;
      const fs = parseFloat(t.s.fontSize);
      for (const q of lines(t)) {
        const b = tight(q, fs); b.left += 1; b.right -= 1; b.t = t;
        if (b.right <= b.left) continue;
        for (let gx = Math.floor(b.left / B); gx <= Math.floor(b.right / B); gx++) {
          for (let gy = Math.floor(b.top / B); gy <= Math.floor(b.bottom / B); gy++) {
            const k = gx + ',' + gy;
            const cell = grid.get(k) || [];
            for (const o of cell) {
              if (o.t === t || o.t.el.contains(t.el) || t.el.contains(o.t.el)) continue;
              const w = Math.min(o.right, b.right) - Math.max(o.left, b.left), h = Math.min(o.bottom, b.bottom) - Math.max(o.top, b.top);
              if (w <= 1 || h <= 1) continue;
              const pair = [sel(o.t.el), sel(t.el)].sort().join(' | ');
              if (seen.has(pair)) continue;
              seen.add(pair);
              report('overlap', 'error', pair, `Text overlaps other text: ${label(o.t.el)} and ${label(t.el)}.`, [o.t, t]);
            }
            cell.push(b); grid.set(k, cell);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------- hairline
  if (want.has('hairline-subpixel')) {
    const frac = (v) => { const f = Math.abs(v * dpr - Math.round(v * dpr)); return f > 0.02 ? f : 0; };
    const groups = new Map();
    for (const e of visEntries) {
      if (!painted(e) || e.graphic || !live(e, 'hairline-subpixel')) continue;
      const found = [], sides = [], lines = [];
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const st = e.s[`border${side}Style`], w = parseFloat(e.s[`border${side}Width`]);
        if (!(w > 0 && w <= 1.5) || st === 'none' || st === 'hidden' || col(e.s[`border${side}Color`])[3] <= 0.02) continue;
        const vert = side === 'Top' || side === 'Bottom';
        const pos = (side === 'Top' ? e.r.top : side === 'Left' ? e.r.left : side === 'Bottom' ? e.r.bottom - w : e.r.right - w) + (vert ? sy : sx);
        if (frac(pos) || frac(w)) {
          found.push(`${side.toLowerCase()} border at ${fmt(pos)} px, ${fmt(w)} px wide`); sides.push(side.toLowerCase());
          lines.push(vert ? { axis: 'h', x: e.r.left + sx, y: pos, len: e.r.width, t: w, color: col(e.s[`border${side}Color`]) }
            : { axis: 'v', x: pos, y: e.r.top + sy, len: e.r.height, t: w, color: col(e.s[`border${side}Color`]) });
        }
      }
      const noBorder = !found.length && ['Top', 'Right', 'Bottom', 'Left'].every((x) => !(parseFloat(e.s[`border${x}Width`]) > 0));
      if (noBorder && col(e.s.backgroundColor)[3] > 0.02) {
        if (e.r.height <= 1.5 && (frac(e.r.top + sy) || frac(e.r.height))) { found.push(`${fmt(e.r.height)} px rule at y ${fmt(e.r.top + sy)} px`); sides.push('rule'); lines.push({ axis: 'h', x: e.r.left + sx, y: e.r.top + sy, len: e.r.width, t: e.r.height, color: col(e.s.backgroundColor) }); }
        else if (e.r.width <= 1.5 && (frac(e.r.left + sx) || frac(e.r.width))) { found.push(`${fmt(e.r.width)} px rule at x ${fmt(e.r.left + sx)} px`); sides.push('rule'); lines.push({ axis: 'v', x: e.r.left + sx, y: e.r.top + sy, len: e.r.height, t: e.r.width, color: col(e.s.backgroundColor) }); }
      }
      if (!found.length) continue;
      // One finding per kind of element, so a table's cells are one finding.
      const k = e.tag + (e.el.classList[0] ? '.' + e.el.classList[0] : '');
      let g = groups.get(k);
      if (!g) groups.set(k, (g = { ents: [], first: found.join('; '), lines: [] }));
      g.ents.push(e);
      if (g.lines.length < 3) g.lines.push(lines[0]);
    }
    for (const [k, g] of groups) {
      const n = g.ents.length;
      report('hairline-subpixel', 'warning', k, `${n === 1 ? 'A hairline' : `${n} hairlines on ${k} elements`} off the device-pixel grid at ${dpr}×${n === 1 ? '' : ', for example'}: ${g.first}.`, g.ents, { count: n, crop: n === 1 ? 'union' : 'each', lines: g.lines });
    }
  }

  data.graphicFontSizes = graphicFontSizes;
  // ----------------------------------------------------------- broken word
  // A word broken at a line end without a hyphen: the emergency break that
  // overflow-wrap (break-word, anywhere), word-break (break-all,
  // break-word) or line-break: anywhere makes when a word does not fit its
  // line (CSS Text 3, overflow-wrap). Words are read across inline
  // children, since a site may set part of a word in a span. A break
  // between two letters or digits, or on either side of an apostrophe, is
  // an emergency break unless hyphenation made it: where hyphens: auto is set,
  // the wrapping properties are turned off for a moment and the word read
  // again; a hyphenated word still breaks, an emergency break does not.
  // Identifiers (URLs, DOIs, ids, paths) are left out: they cannot be
  // hyphenated, and breaking them is what overflow-wrap is for. Run last,
  // since it changes styles for a moment.
  if (want.has('broken-word')) {
    const identifier = new RegExp(opts.identifier || '^$', 'i');
    const canBreak = (st) => /break-word|anywhere/.test(st.overflowWrap || st.wordWrap || '') || /break-all|break-word/.test(st.wordBreak || '') || st.lineBreak === 'anywhere';
    const blocks = new Map();
    const add = (b, nodes) => { if (!blocks.has(b)) blocks.set(b, []); blocks.get(b).push(...nodes); };
    for (const e of textEntries) {
      let b = e;
      while (b && isInline(b)) b = b.parent;
      if (b && canBreak(b.s)) add(b, e.textNodes);
    }
    const charTop = (n, i) => { range.setStart(n, i); range.setEnd(n, i + 1); const q = range.getClientRects()[0]; return q ? q.top : null; };
    const WORDCHAR = /[\p{L}\p{M}\p{N}'’]/u;
    // The emergency breaks in a block: [word with | at each break, token index].
    const breaks = (nodes) => {
      const map = [];
      let text = '';
      for (const n of nodes) { for (let i = 0; i < n.data.length; i++) map.push([n, i]); text += n.data; }
      const out = [];
      for (const m of text.matchAll(/\S+/g)) {
        const tok = m[0];
        if (tok.length < 2 || identifier.test(tok)) continue;
        const at = (k) => charTop(...map[m.index + k]);
        const first = at(0), last = at(tok.length - 1);
        if (first === null || last === null || Math.abs(first - last) < 2) continue;
        const cuts = [];
        let prev = first;
        for (let k = 1; k < tok.length; k++) {
          const t = at(k);
          if (t === null) continue;
          if (Math.abs(t - prev) >= 2 && WORDCHAR.test(tok[k - 1]) && WORDCHAR.test(tok[k])) cuts.push(k);
          prev = t;
        }
        if (cuts.length) out.push({ index: m.index, word: cuts.reduceRight((w, k) => w.slice(0, k) + '|' + w.slice(k), tok.replace(/[.,;:!?)\]]+$/, '')) });
      }
      return out;
    };
    const groups = new Map();
    let tested = 0;
    for (const [b, nodes] of blocks) {
      if (tested >= 2000 || !live(b, 'broken-word')) continue;
      tested++;
      nodes.sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      let found = breaks(nodes);
      if (!found.length) continue;
      // Under hyphens: auto, keep only the breaks that go away when the
      // wrapping properties are off.
      if ((b.s.hyphens || b.s.webkitHyphens) === 'auto') {
        const st = b.el.style, keep = ['overflow-wrap', 'word-break', 'line-break'].map((p) => [p, st.getPropertyValue(p), st.getPropertyPriority(p)]);
        st.setProperty('overflow-wrap', 'normal', 'important'); st.setProperty('word-break', 'normal', 'important'); st.setProperty('line-break', 'auto', 'important');
        const still = new Set(breaks(nodes).map((x) => x.index));
        for (const [p, v, pr] of keep) { if (v) st.setProperty(p, v, pr); else st.removeProperty(p); }
        found = found.filter((x) => !still.has(x.index));
        if (!found.length) continue;
      }
      const cell = b.el.closest('td, th');
      const table = cell?.closest('table');
      const k = table ? 'table|' + sel(table) : sel(b.el);
      let g = groups.get(k);
      if (!g) groups.set(k, (g = { ents: [], words: [], cell: !!cell, widths: [], why: new Set() }));
      g.ents.push(b);
      g.words.push(...found.map((x) => x.word));
      if (cell) { const cs = getComputedStyle(cell); g.widths.push(cell.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)); }
      for (const [p, v] of [['overflow-wrap', b.s.overflowWrap || b.s.wordWrap], ['word-break', b.s.wordBreak], ['line-break', b.s.lineBreak]]) if (/break-word|anywhere|break-all/.test(v || '')) g.why.add(`${p}: ${v}`);
    }
    for (const [k, g] of groups) {
      const words = [...new Set(g.words)];
      const shown = words.slice(0, 3).map((w) => `"${w}"`).join(', ') + (words.length > 3 ? `, and ${words.length - 3} more` : '');
      const where = g.cell ? `in ${g.ents.length === 1 ? 'a table cell' : `${g.ents.length} table cells`} ${fmt(Math.min(...g.widths))}${g.widths.length > 1 && Math.max(...g.widths) - Math.min(...g.widths) > 0.5 ? ` to ${fmt(Math.max(...g.widths))}` : ''} px wide` : `in ${label(g.ents[0].el)}`;
      report('broken-word', 'warning', k,
        `${words.length === 1 ? 'A word is' : `${words.length} words are`} broken without a hyphen ${where}: ${shown}. The column is narrower than ${words.length === 1 ? 'the word' : 'its longest words'}, and ${[...g.why].join(', ') || 'the wrapping rules'} breaks ${words.length === 1 ? 'it' : 'them'} wherever the line runs out. ${g.cell ? 'Give the column room for its longest word (a minimum width, or let the table scroll in its own box), set the table\'s text smaller, or' : 'Widen the measure, or'} allow hyphens: auto with a lang, so a word breaks between syllables, with a hyphen.`,
        g.ents, { count: words.length, crop: 'each' });
    }
  }

  return { vw, scrollWidth: doc.scrollWidth, docHeight: doc.scrollHeight, issues, counts, data };
}
