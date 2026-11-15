#!/usr/bin/env node
// ITTEN inspector. Measures a rendered page up close, against the project's
// system file when one is given, and writes report.json, report.html and
// zoomed crops. See protocol/04-inspect.md.
//
// Usage:
//   node itten/inspector/inspect.js <url> [--system itten.system.json] [--out itten-report]
//        [--full] [--widths 320:1920:40] [--key-widths 320,768,1440] [--engines webkit,firefox | --no-engines] [--fail-on error|warning]
//        [--wait-for <selector>] [--settle <ms>]
//        [--baseline itten-baseline.json] [--write-baseline [itten-baseline.json]] [--page <baseline key>]
//   node itten/inspector/inspect.js --validate itten.system.json

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, release } from 'node:os';
import { collect } from './collect.js';
import { typography } from './typography.js';
import { motionInit, motionReport } from './motion.js';
import { decodePng, encodePng, upscale, outline } from './png.js';
import { renderHtml } from './report-html.js';
import { readBaseline, writeBaseline, compare, failing } from './baseline.js';
import { validate } from '../scripts/lib/schema.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(join(HERE, '..', 'schema', 'system.schema.json'), 'utf8'));
export const VERSION = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8')).version;

export const CHECKS = {
  'page-load': { title: 'Page load', rule: 'CRF-15 · FBK-04' },
  'contrast': { title: 'Text contrast against rendered pixels', rule: 'CRF-14 · COL-01 · WCAG 1.4.3' },
  'font-fallback': { title: 'Font fallback', rule: 'CRF-13' },
  'overflow': { title: 'Overflow', rule: 'CRF-16 · LAY-03 · WCAG 1.4.10' },
  'clipping': { title: 'Clipping', rule: 'CRF-16 · TYP-03 · WCAG 1.4.4' },
  'overlap': { title: 'Overlapping text', rule: 'CRF-16' },
  'target-size': { title: 'Target size', rule: 'CRF-17 · INT-01 · INT-02 · WCAG 2.5.8' },
  'spacing-scale': { title: 'Spacing off the scale', rule: 'CRF-01 · CRF-07 · LAY-05' },
  'type-scale': { title: 'Type off the scale', rule: 'CRF-06 · CRF-07 · TYP-06' },
  'text-resize': { title: 'Text ignores the browser text size', rule: 'CRF-16 · TYP-03 · WCAG 1.4.4' },
  'spacing-unit': { title: 'Spacing ignores the browser text size', rule: 'CRF-30 · CRF-01 · WCAG 1.4.4' },
  'near-miss-edge': { title: 'Near-miss edges', rule: 'CRF-04 · LAY-09 · LAY-10' },
  'sibling-gaps': { title: 'Unequal sibling gaps', rule: 'CRF-03 · LAY-05' },
  'radius': { title: 'Radii outside the set', rule: 'CRF-11 · SHP-02' },
  'radius-concentric': { title: 'Non-concentric corners', rule: 'CRF-12 · SHP-01' },
  'hairline-subpixel': { title: 'Hairlines off the pixel grid', rule: 'CRF-08' },
  'widow': { title: 'Widows', rule: 'CRF-21' },
  'orphan': { title: 'Orphans across columns', rule: 'CRF-21' },
  'rag': { title: 'Holes in the rag', rule: 'CRF-22 · TYP-04' },
  'hyphenation': { title: 'Justified text without hyphenation', rule: 'CRF-22' },
  'text-wrap-balance': { title: 'Headings that would balance', rule: 'CRF-23' },
  'text-wrap-pretty': { title: 'Short last lines', rule: 'CRF-23' },
  'hanging-punctuation': { title: 'Punctuation that should hang', rule: 'CRF-24' },
  'optical-margin': { title: 'Display type off its optical edge', rule: 'CRF-25 · CRF-04' },
  'flash': { title: 'Flashing', rule: 'CRF-29 · MOT-09 · WCAG 2.3.1' },
  'reduced-motion': { title: 'Motion under Reduce Motion', rule: 'CRF-18 · MOT-08' },
  'motion-timing': { title: 'Durations and easings off the system', rule: 'CRF-26 · MOT-07' },
  'motion-layout': { title: 'Animated layout properties', rule: 'CRF-27' },
  'frame-timing': { title: 'Dropped frames', rule: 'CRF-28 · MOT-11' },
};
const SEVERITY = ['error', 'warning', 'info'];
const ENGINE_NAMES = { chromium: 'Chromium', webkit: 'WebKit', firefox: 'Firefox' };
// Checks run again in WebKit and Firefox. Spacing and type values are
// computed styles, the same in every engine, so they run in Chromium only.
const ENGINE_CHECKS = ['near-miss-edge', 'sibling-gaps', 'radius', 'radius-concentric', 'target-size', 'overflow', 'clipping', 'overlap', 'hairline-subpixel'];
const LAYOUT = ['spacing-scale', 'type-scale', 'near-miss-edge', 'sibling-gaps', 'radius', 'radius-concentric', 'target-size', 'overflow', 'clipping', 'overlap', 'hairline-subpixel'];
const TEXT200 = ['overflow', 'clipping', 'overlap'];
// Typographic checks run in Chromium at every width of the sweep: line
// breaking differs between engines, and these judge Chromium's lines. The
// optical edge is measured from pixels at the key widths.
const TYPO = ['widow', 'orphan', 'rag', 'hyphenation', 'text-wrap-balance', 'text-wrap-pretty', 'hanging-punctuation'];
const VIEW_H = 900;
export const DEFAULT_WIDTHS = [320, 768, 1440, 1920];
export const FULL_WIDTHS = Array.from({ length: 41 }, (_, i) => 320 + i * 40);
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong', '-apple-system', 'blinkmacsystemfont']);
const PLATFORM_UI = /^(segoe ui|roboto|helvetica neue|helvetica|arial|ubuntu|oxygen|oxygen-sans|cantarell|fira sans|droid sans|noto sans|open sans|sf pro( text| display)?|san francisco|liberation sans)$/i;

export function loadSystem(path) {
  const system = JSON.parse(readFileSync(path, 'utf8'));
  const errors = validate(SCHEMA, system);
  // Relations the schema cannot express.
  (system?.type?.scale || []).forEach((st, i) => {
    const f = st.fluid;
    if (f && !(f.min < f.max)) errors.push(`.type.scale[${i}].fluid: min must be smaller than max`);
    if (f && !(f.minWidth < f.maxWidth)) errors.push(`.type.scale[${i}].fluid: minWidth must be smaller than maxWidth`);
  });
  return { system, errors };
}

// ------------------------------------------------------------- colour maths
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const blend = (fg, a, bg) => fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));

// ------------------------------------------------------------------ helpers
const rangeText = (ws) => {
  const s = [...new Set(ws)].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] - s[j] === 40) j++;
    out.push(j > i ? `${s[i]}–${s[j]}` : String(s[i]));
    i = j;
  }
  return out.join(', ');
};
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const families = (stack) => stack.match(/"[^"]*"|'[^']*'|[^,]+/g).map((f) => f.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const loose = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a === b || a.startsWith(b) || b.startsWith(a)); };

async function settle(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // Let finite transitions and animations (fades, reveals) finish, so every
  // engine is measured at rest. Infinite ones are left running; capped at 2 s.
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity).map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 2000)),
  ])).catch(() => {});
  await page.waitForTimeout(120);
}

// Returns whether the network went quiet within 10 s of the load event and,
// with o.waitFor, whether that selector appeared within 30 s.
async function load(page, url, o = {}) {
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  const networkIdle = await page.waitForLoadState('networkidle', { timeout: 10000 }).then(() => true, () => false);
  const waited = o.waitFor ? await page.waitForSelector(o.waitFor, { state: 'attached', timeout: 30000 }).then(() => true, () => false) : null;
  // Scroll through once so lazy content and reveal-on-scroll elements render.
  await page.evaluate(async () => {
    const step = innerHeight * 0.8;
    const t0 = performance.now();
    for (let y = 0; y < document.documentElement.scrollHeight && y < 40000 && performance.now() - t0 < 8000; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.waitForTimeout(500 + (o.settle || 0));
  // Measuring starts here: note what the page has drawn so far.
  await page.evaluate(() => window.__ittenLate?.start());
  return { networkIdle, waited };
}

// ------------------------------------------------------ late content
// Installed before any page script runs. start() notes every element drawn
// when measuring begins, at the first width. late(), called back at that
// width once the passes are done, returns the elements drawn now that were
// not then: new nodes whose selector and text are also new. A part the page
// swaps out at one width and back at another keeps its selector and text, so
// it is not counted. Each element's time is when it, or the nearest ancestor,
// was added (ms after start), from a mutation observer.
function lateInit() {
  const L = (window.__ittenLate = { mark: null, times: new WeakMap() });
  const sel = (el) => {
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && document.querySelectorAll('#' + el.id).length === 1) return '#' + el.id;
    if (el === document.body) return 'body';
    const p = el.parentElement, same = p ? [...p.children].filter((c) => c.localName === el.localName) : [];
    return (p ? sel(p) + ' > ' : '') + el.localName + (same.length > 1 ? `:nth-of-type(${same.indexOf(el) + 1})` : '');
  };
  const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join(' ').replace(/\s+/g, ' ').trim();
  // Ids that differ only by a counter (arc-3, arc-15) name the same thing
  // drawn again, as a chart does on every resize.
  const key = (el) => sel(el).replace(/#[A-Za-z][\w-]*/g, (id) => id.replace(/\d+/g, 'N')) + '|' + own(el).slice(0, 80);
  const drawn = () => [...document.body.querySelectorAll('*')].filter((el) => !/^(script|style|template|noscript)$/.test(el.localName) && el.getClientRects().length);
  const ignored = (el) => { const h = el.closest('[data-itten-ignore]'); return !!h && /(^|\s)(page-load|all)(\s|$)/.test(h.getAttribute('data-itten-ignore')); };
  L.start = () => {
    const els = drawn();
    L.mark = performance.now(); L.before = new WeakSet(els); L.keys = new Set(els.map(key));
  };
  L.late = () => {
    if (L.mark === null) return [];
    const els = drawn().filter((el) => !L.before.has(el) && !L.keys.has(key(el)) && !ignored(el));
    const set = new Set(els);
    return els.filter((el) => !set.has(el.parentElement)).slice(0, 50).map((el) => {
      let a = el, t;
      while (a && (t = L.times.get(a)) === undefined) a = a.parentElement;
      let text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 40) text = text.slice(0, 39) + '…';
      return { t: t === undefined ? null : Math.round(t), sel: sel(el), label: el.localName + (el.classList[0] ? '.' + el.classList[0] : '') + (text ? ` "${text}"` : '') };
    });
  };
  new MutationObserver((list) => {
    if (L.mark === null) return;
    const t = performance.now() - L.mark;
    for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && !L.times.has(n)) L.times.set(n, t);
  }).observe(document, { childList: true, subtree: true });
}

// ---------------------------------------------------------- hairline render
// How a thin line actually lands on the pixels. The line's middle stretch is
// screenshotted and profiled across its thickness (median per row or
// column). A crisp line has a row at full colour; a blurred one is spread
// over two rows at part strength. Returns 'crisp', 'blurred' or null.
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
async function lineRender(page, L) {
  const span = Math.min(L.len - 16, 240);
  if (!(span >= 8)) return null;
  const pad = 3;
  const along = Math.round((L.axis === 'h' ? L.x : L.y) + (L.len - span) / 2);
  const across = Math.floor(L.axis === 'h' ? L.y : L.x) - pad;
  const thick = Math.ceil(L.t) + 2 * pad + 1;
  const clip = L.axis === 'h' ? { x: along, y: across, width: Math.round(span), height: thick } : { x: across, y: along, width: thick, height: Math.round(span) };
  if (clip.x < 0 || clip.y < 0) return null;
  let img;
  try { img = decodePng(await page.screenshot({ clip, fullPage: true })); } catch { return null; }
  const n = L.axis === 'h' ? img.height : img.width, m = L.axis === 'h' ? img.width : img.height;
  const prof = [];
  for (let i = 0; i < n; i++) {
    const ch = [[], [], []];
    for (let j = 0; j < m; j++) {
      const [x, y] = L.axis === 'h' ? [j, i] : [i, j];
      const o = (y * img.width + x) * img.channels;
      for (let c = 0; c < 3; c++) ch[c].push(img.data[o + c]);
    }
    prof.push(ch.map((a) => a.sort((p, q) => p - q)[a.length >> 1]));
  }
  const out = prof[0], inn = prof[n - 1];
  const a = L.color[3] ?? 1;
  const line = L.color.slice(0, 3).map((v, c) => v * a + out[c] * (1 - a));
  const span0 = dist(line, out);
  if (span0 < 40) return null; // too faint against its surroundings to judge
  let best = 0, ink = 0;
  for (let i = 1; i < n - 1; i++) {
    const cOut = Math.min(1, dist(prof[i], out) / span0);
    const dIn = dist(line, inn);
    const c = dIn > 40 ? Math.min(cOut, Math.min(1, dist(prof[i], inn) / dIn)) : cOut;
    best = Math.max(best, c); ink += c;
  }
  if (best >= 0.8) return 'crisp';
  return ink >= 0.4 ? 'blurred' : null;
}

// --------------------------------------------------------------- the run
export async function inspect(url, o = {}) {
  // Four widths by default; the full sweep, 320 to 1920 px in 40 px steps, with full.
  const widths = o.widths ?? (o.full ? FULL_WIDTHS : DEFAULT_WIDTHS);
  const keyWidths = o.keyWidths ?? [320, 768, 1440];
  const system = o.system ?? null;
  const outDir = o.out ? resolve(o.out) : null;
  const log = o.quiet ? () => {} : (m) => process.stderr.write(m + '\n');
  if (outDir) { rmSync(join(outDir, 'crops'), { recursive: true, force: true }); mkdirSync(join(outDir, 'crops'), { recursive: true }); }

  const { chromium } = await import('playwright');
  // The full Chromium build renders WebGL on the GPU where one is available;
  // the default headless shell falls back to software rendering, which can
  // slow animated pages to a few frames a minute.
  const browser = await chromium.launch({ channel: 'chromium' }).catch(() => chromium.launch());
  const issues = new Map();
  const distinct = { fontSizes: {}, spacing: {}, radii: {}, insideGraphics: {}, perWidth: [] };
  const coverage = { graphics: 0, figureParts: 0, ignored: 0, elements: 0, text: 0, relativeSpacing: 0, contrastSamples: 0, contrastSkipped: 0, fontGroups: 0 };
  const renderedFonts = new Map();
  const sizes = {};
  const obs = { spacing: new Map(), spacing2: new Map(), type: new Map(), labels: new Map() };
  let cropCount = 0, idCount = 0;
  const failed = new Map();
  let watching = true;
  let motion = null;

  const merge = async (page, raw, pass) => {
    if (raw.check === 'hairline-subpixel') await judgeHairline(page, raw, pass);
    const k = raw.check + '|' + raw.key;
    let it = issues.get(k);
    const isNew = !it;
    if (!it) {
      it = { id: `i${String(++idCount).padStart(3, '0')}`, fingerprint: k, check: raw.check, severity: raw.severity, message: raw.message, count: raw.count, elements: [], seen: {}, crops: [], first: pass.label };
      issues.set(k, it);
    }
    const upgrade = !isNew && SEVERITY.indexOf(raw.severity) < SEVERITY.indexOf(it.severity);
    if (upgrade) { it.severity = raw.severity; it.message = raw.message; it.first = pass.label; }
    if (raw.render) {
      it.render ??= {};
      const r = (it.render[raw.render.engine] ??= { crisp: 0, blurred: 0 });
      r.crisp += raw.render.crisp; r.blurred += raw.render.blurred;
    }
    it.count = Math.max(it.count, raw.count);
    for (const el of raw.elements) if (it.elements.length < 8 && !it.elements.some((x) => x.sel === el.sel)) it.elements.push(el);
    (it.seen[pass.mode] ??= []).push(pass.w);
    const wantCrop = (isNew || upgrade || (pass.engine && pass.engine !== 'chromium' && !it.crops.some((c) => c.engine === pass.engine))) && raw.severity !== 'info';
    if (wantCrop && outDir && cropCount < (o.maxCrops ?? 400)) await crop(page, raw, it, pass);
  };

  // Thin lines off the device-pixel grid: measure how this engine drew them.
  // Engines snap most borders to whole device pixels, and then the finding is
  // information. It is a warning in any engine where a sampled line is drawn
  // blurred across two pixels, as Chromium and WebKit both do for a line
  // moved by a fractional transform.
  const judgeHairline = async (page, raw, pass) => {
    const engine = pass.engine || 'chromium';
    const res = [];
    for (const L of (raw.lines || []).slice(0, 3)) res.push(await lineRender(page, { ...L }));
    const crisp = res.filter((x) => x === 'crisp').length, blurred = res.filter((x) => x === 'blurred').length;
    raw.render = { engine, crisp, blurred };
    raw.severity = blurred ? 'warning' : 'info';
  };

  // A finding judged across the sweep: seen at a list of light-pass widths.
  const addFinding = async (page, f) => {
    const w = f.widths[0];
    const mode = f.mode || 'light';
    const it = { id: `i${String(++idCount).padStart(3, '0')}`, fingerprint: f.check + '|' + f.key, check: f.check, severity: f.severity, message: f.message, count: f.count, elements: [], seen: { [mode]: f.widths }, crops: [], first: `${w} px, ${mode}`, ...(f.resources ? { resources: f.resources } : {}) };
    issues.set(it.fingerprint, it);
    await page.setViewportSize({ width: w, height: VIEW_H });
    await settle(page);
    const rects = await page.evaluate((sels) => sels.map((s) => {
      let el = null; try { el = document.querySelector(s); } catch { /* bad selector */ }
      if (!el) return null;
      const q = el.getBoundingClientRect();
      return [q.left + scrollX, q.top + scrollY, q.width, q.height].map((v) => Math.round(v * 100) / 100);
    }), f.elements.slice(0, 8).map((e) => e.sel));
    it.elements = f.elements.slice(0, 8).map((e, i) => ({ ...e, rect: rects[i] || [0, 0, 0, 0] }));
    const raw = { elements: it.elements.filter((e) => e.rect[2] > 0), marks: [], crop: 'each' };
    if (outDir && raw.elements.length && cropCount < (o.maxCrops ?? 400)) await crop(page, raw, it, { label: it.first });
  };

  const crop = async (page, raw, it, pass) => {
    const groups = raw.crop === 'each'
      ? raw.elements.slice(0, 3).map((e) => ({ boxes: [e.rect], marks: [] }))
      : raw.crop === 'marks'
        ? raw.marks.slice(0, 3).map((m) => ({ boxes: [], marks: [m], region: [Math.min(m.x1, m.x2) - 40, m.y1 - 48, Math.min(Math.abs(m.x2 - m.x1), 640) + 80, Math.abs(m.y2 - m.y1) + 96] }))
        : [{ boxes: raw.elements.slice(0, 4).map((e) => e.rect), marks: raw.marks }];
    const dims = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    for (const g of groups) {
      const pad = 24;
      const region = (bs) => {
        const x1 = Math.min(...bs.map((b) => b[0])) - pad, y1 = Math.min(...bs.map((b) => b[1])) - pad;
        const x2 = Math.max(...bs.map((b) => b[0] + b[2])) + pad, y2 = Math.max(...bs.map((b) => b[1] + b[3])) + pad;
        return [x1, y1, x2 - x1, y2 - y1];
      };
      let [x, y, w, h] = g.region || region(g.boxes);
      if (!g.region && (w > 720 || h > 540)) [x, y, w, h] = region([g.boxes[0]]);
      w = Math.min(w, 720); h = Math.min(h, 540);
      x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
      w = Math.max(8, Math.min(Math.ceil(w), dims[0] - x)); h = Math.max(8, Math.min(Math.ceil(h), dims[1] - y));
      let img;
      try { img = decodePng(await page.screenshot({ clip: { x, y, width: w, height: h }, fullPage: true })); } catch { continue; }
      const z = img.width * 4 <= 1440 ? 4 : img.width * 3 <= 1440 ? 3 : 2;
      const big = upscale(img, z);
      for (const b of g.boxes) outline(big, (b[0] - x) * z - 1, (b[1] - y) * z - 1, b[2] * z + 1, b[3] * z + 1, [230, 0, 150]);
      for (const m of g.marks || []) for (const d of [0, 1]) outline(big, (m.x1 - x) * z + d, (m.y1 - y) * z + d, (m.x2 - m.x1) * z, (m.y2 - m.y1) * z, [0, 120, 255]);
      const name = `crops/${it.id}-${it.crops.length + 1}.png`;
      writeFileSync(join(outDir, name), encodePng(big.width, big.height, big.data));
      it.crops.push({ path: name, zoom: z, at: pass.label, region: [x, y, w, h], ...(pass.engine ? { engine: pass.engine } : {}) });
      cropCount++;
    }
  };

  // The page measured may not be the page people see: a request failed, the
  // network never went quiet, the --wait-for selector never appeared, or
  // elements appeared after measuring began.
  const pageLoadFindings = async (page, page2, loaded) => {
    const at = [widths[0]];
    const req = [...failed.values()];
    if (req.length) {
      const list = req.slice(0, 8).map((r) => `${r.method} ${r.url} (${r.type}, ${r.why})`).join('; ');
      await addFinding(page, { check: 'page-load', severity: 'error', key: 'requests', mode: 'load', widths: at, count: req.length, elements: [], resources: req.map((r) => r.url),
        message: `${plural(req.length, 'request')} failed while the page was measured: ${list}${req.length > 8 ? `; and ${req.length - 8} more` : ''}. What was measured may be the page's error state. Fix the requests, then inspect again.` });
    }
    if (!loaded.networkIdle) {
      await addFinding(page, { check: 'page-load', severity: 'warning', key: 'busy', mode: 'load', widths: at, count: 1, elements: [],
        message: 'The network did not go quiet within 10 s of the load event, so the page was measured while requests were still running. If it draws from them, pass --wait-for with a selector for what appears last, or --settle with a wait in ms.' });
    }
    if (loaded.waited === false) {
      await addFinding(page, { check: 'page-load', severity: 'error', key: 'wait-for', mode: 'load', widths: at, count: 1, elements: [],
        message: `--wait-for ${o.waitFor}: no element matched within 30 s of the load event, so the page was measured without it.` });
    }
    // Back at the first width and in light, where measuring began.
    const late = new Map(), missedSet = new Set();
    let unknown = false;
    for (const p of [page, page2]) {
      await p.setViewportSize({ width: widths[0], height: VIEW_H });
      await p.emulateMedia({ colorScheme: 'light' });
      await p.evaluate(() => scrollTo(0, 0));
      await settle(p);
      const els = await p.evaluate(() => window.__ittenLate?.late() ?? []);
      if (!els.length) continue;
      const known = els.filter((e) => e.t !== null).map((e) => e.t);
      if (known.length < els.length) unknown = true;
      const last = known.length ? Math.max(...known) : Infinity;
      for (const e of els) if (!late.has(e.sel)) late.set(e.sel, e);
      for (const [label, t] of p.passTimes) if (t < last) missedSet.add(label);
    }
    if (late.size && missedSet.size) {
      const els = [...late.values()].sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity));
      const ts = els.filter((e) => e.t !== null).map((e) => e.t);
      const s = (ms) => (ms / 1000).toFixed(1);
      const when = !ts.length || unknown ? 'after measuring began' : ts[0] === ts.at(-1) ? `${s(ts[0])} s after measuring began` : `${s(ts[0])} to ${s(ts.at(-1))} s after measuring began`;
      const missed = [...missedSet];
      await addFinding(page, { check: 'page-load', severity: 'warning', key: 'late', widths: at, count: els.length, elements: els.map(({ sel, label }) => ({ sel, label })),
        message: `${plural(els.length, 'element')} appeared ${when}, so ${unknown ? 'some passes may have' : `${missed.length} ${missed.length === 1 ? 'pass' : 'passes'}`} measured the page without ${els.length === 1 ? 'it' : 'them'}${unknown ? '' : ` (${missed.slice(0, 6).join('; ')}${missed.length > 6 ? '; …' : ''})`}. The page was still drawing: a timer, an animation-frame chain or a slow request. Pass --wait-for with a selector for what appears last, or --settle with a wait in ms. Content that changes on purpose, such as a carousel, can be marked data-itten-ignore="page-load".` });
    }
  };

  const runPass = async (page, pass, extra = {}) => {
    await page.setViewportSize({ width: pass.w, height: VIEW_H });
    await page.evaluate(() => scrollTo(0, 0));
    await settle(page);
    const res = await page.evaluate(collect, { checks: pass.checks, system, dpr: pass.dpr, ...extra });
    // When the pass measured, in ms after the start of measuring.
    if (page.passTimes) page.passTimes.push([pass.label, await page.evaluate(() => (window.__ittenLate?.mark == null ? 0 : performance.now() - window.__ittenLate.mark))]);
    return res;
  };

  try {
    // Pass set 1: light, 100% text, every width; contrast and fonts at key widths, light and dark.
    const ctx = await browser.newContext({ viewport: { width: widths[0], height: VIEW_H }, deviceScaleFactor: 1, colorScheme: 'light' });
    await ctx.addInitScript(lateInit);
    // Requests that fail or answer 400 or more, on every Chromium load. A
    // page that catches the failure and shows a message raises no page error,
    // so without this the report would measure the error state as the page.
    const fail = (url, method, type, why) => { if (watching && !failed.has(url)) failed.set(url, { url, method, type, why }); };
    ctx.on('response', (r) => { if (r.status() >= 400) fail(r.url(), r.request().method(), r.request().resourceType(), `HTTP ${r.status()}`); });
    ctx.on('requestfailed', (r) => { const why = r.failure()?.errorText || 'failed'; if (!/ERR_ABORTED/.test(why)) fail(r.url(), r.method(), r.resourceType(), why); });
    const page = await ctx.newPage();
    page.passTimes = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));
    log(`Loading ${url}`);
    const loaded = await load(page, url, o);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');

    for (const w of widths) {
      const pass = { w, mode: 'light', label: `${w} px, light`, dpr: 1, checks: LAYOUT };
      const t0 = Date.now();
      const res = await runPass(page, pass, { recordSizes: w === keyWidths.at(-1) });
      if (w === keyWidths.at(-1)) sizes.base = res.data.textSizes;
      for (const k of ['graphics', 'figureParts', 'elements', 'text', 'relativeSpacing']) coverage[k] = Math.max(coverage[k], res.counts[k]);
      coverage.ignored = Math.max(coverage.ignored, res.counts.ignored);
      for (const [k, v] of Object.entries(res.data.fontSizes)) distinct.fontSizes[k] = Math.max(distinct.fontSizes[k] ?? 0, v);
      for (const [k, v] of Object.entries(res.data.spacing)) distinct.spacing[k] = Math.max(distinct.spacing[k] ?? 0, v);
      for (const [k, v] of Object.entries(res.data.radii)) distinct.radii[k] = Math.max(distinct.radii[k] ?? 0, v);
      for (const [k, v] of Object.entries(res.data.graphicFontSizes)) distinct.insideGraphics[k] = Math.max(distinct.insideGraphics[k] ?? 0, v);
      distinct.perWidth.push({ w, fontSizes: Object.keys(res.data.fontSizes).length, spacing: Object.keys(res.data.spacing).length });
      for (const [sel, prop, v] of res.data.spacingObs) { const k = sel + '|' + prop; if (!obs.spacing.has(k)) obs.spacing.set(k, new Map()); obs.spacing.get(k).set(w, v); }
      for (const [sel, ...v] of res.data.typeObs) { if (!obs.type.has(sel)) obs.type.set(sel, new Map()); obs.type.get(sel).set(w, v); }
      for (const [k, v] of Object.entries(res.data.labels)) if (!obs.labels.has(k)) obs.labels.set(k, v);
      for (const raw of res.issues) await merge(page, raw, pass);
      const ty = await page.evaluate(typography, { checks: TYPO, system });
      for (const raw of ty.issues) await merge(page, raw, pass);
      log(`  ${pass.label}: ${res.issues.length + ty.issues.length} findings, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
    for (const f of scaleFindings(obs, system, widths, distinct)) await addFinding(page, f);

    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const w of keyWidths) {
        const pass = { w, mode: scheme, label: `${w} px, ${scheme}`, dpr: 1, checks: [] };
        const res = await runPass(page, pass, { contrast: true, fonts: true });
        for (const raw of res.issues) await merge(page, raw, pass);
        for (const raw of await fontIssues(cdp, page, res, system, renderedFonts)) await merge(page, raw, pass);
        coverage.fontGroups = Math.max(coverage.fontGroups, new Set(res.data.fontReps.map((r) => r.group)).size);
        for (const raw of await contrastIssues(page, res, coverage)) await merge(page, raw, pass);
        if (scheme === 'light') {
          const ty = await page.evaluate(typography, { checks: ['optical-margin'], system });
          for (const raw of await opticalIssues(page, ty.optical)) await merge(page, raw, pass);
        }
        log(`  ${pass.label}: contrast and fonts`);
      }
    }
    await page.emulateMedia({ colorScheme: 'light' });

    // Pass set 2: the browser's text size doubled (16 px default becomes 32 px).
    const page2 = await ctx.newPage();
    page2.passTimes = [];
    const cdp2 = await ctx.newCDPSession(page2);
    await cdp2.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await load(page2, url, o);
    for (const w of widths) {
      const pass = { w, mode: '200% text', label: `${w} px, 200% text`, dpr: 1, checks: TEXT200 };
      const res = await runPass(page2, pass, { recordSizes: w === keyWidths.at(-1), spacingObs: true });
      if (w === keyWidths.at(-1)) sizes.doubled = res.data.textSizes;
      for (const [sel, prop, v] of res.data.spacingObs) { const k = sel + '|' + prop; if (!obs.spacing2.has(k)) obs.spacing2.set(k, new Map()); obs.spacing2.get(k).set(w, v); }
      for (const raw of res.issues) await merge(page2, raw, pass);
      log(`  ${pass.label}: ${res.issues.length} findings`);
    }
    log(`  200% text: done`);

    // Text whose size does not follow the browser's text size: set in px or
    // vw only. Measured at the last key width, default against doubled.
    let textScaling = null;
    if (sizes.base && sizes.doubled) {
      const keys = Object.keys(sizes.base).filter((k) => k in sizes.doubled);
      const fixed = keys.filter((k) => sizes.doubled[k] <= sizes.base[k] * 1.05);
      textScaling = { measured: keys.length, unchanged: fixed.length, examples: fixed.slice(0, 5), width: keyWidths.at(-1) };
      if (fixed.length) {
        const bySize = new Map();
        for (const k of fixed) bySize.set(sizes.base[k], (bySize.get(sizes.base[k]) || 0) + 1);
        const sizesText = [...bySize].sort((a, b) => a[0] - b[0]).map(([v, n]) => `${v} px (${n})`).join(', ');
        await addFinding(page2, { check: 'text-resize', severity: 'warning', key: 'all', mode: '200% text', widths: [keyWidths.at(-1)], count: fixed.length,
          message: `${fixed.length} of ${keys.length} text elements keep their size when the browser's default text size is doubled, so they are set in px or vw alone and ignore the reader's setting. Sizes affected: ${sizesText}. Set font sizes in rem, or give clamp() rem limits.`,
          elements: fixed.map((k) => ({ sel: k, label: obs.labels.get(k) || k })) });
      }
    }
    for (const f of spacingUnitFindings(obs)) await addFinding(page2, f);
    await pageLoadFindings(page, page2, loaded);
    watching = false;
    await ctx.close();

    // Pass set 3: device pixel ratio 2, hairlines only.
    const ctx2 = await browser.newContext({ viewport: { width: keyWidths[0], height: VIEW_H }, deviceScaleFactor: 2, colorScheme: 'light' });
    const page3 = await ctx2.newPage();
    await load(page3, url, o);
    for (const w of [keyWidths[0], keyWidths.at(-1)]) {
      const pass = { w, mode: '2x', label: `${w} px, 2×`, dpr: 2, checks: ['hairline-subpixel'] };
      const res = await runPass(page3, pass);
      for (const raw of res.issues) await merge(page3, raw, pass);
    }
    await ctx2.close();

    // Pass set 4: motion, in Chromium at the last key width, with motion
    // allowed and again with prefers-reduced-motion: reduce.
    motion = await motionPasses(browser, url, o, system, keyWidths.at(-1), merge, log);

    // Pass set 5: WebKit and Firefox, light, a few widths, layout checks only.
    const engines = { widths: o.engineWidths ?? DEFAULT_WIDTHS, checks: ENGINE_CHECKS, browsers: { chromium: browser.version() }, notRun: {} };
    const pw = await import('playwright');
    for (const name of o.engines ?? ['webkit', 'firefox']) {
      let eb;
      try { eb = await pw[name].launch(); } catch (e) {
        const m = String(e.message || e);
        const err = (m.match(/\[err\] (?!\*\*\*)(.+)/) || [])[1];
        engines.notRun[name] = /Executable doesn't exist/.test(m) ? `not installed (npx playwright install ${name})` : `the browser failed to start${err ? ` ("${err.trim()}")` : ''}`;
        log(`  ${ENGINE_NAMES[name]}: not run, ${engines.notRun[name]}`);
        continue;
      }
      try {
        engines.browsers[name] = eb.version();
        const ectx = await eb.newContext({ viewport: { width: engines.widths[0], height: VIEW_H }, deviceScaleFactor: 1, colorScheme: 'light' });
        const ep = await ectx.newPage();
        await load(ep, url, o);
        for (const w of engines.widths) {
          const pass = { w, mode: name, engine: name, label: `${w} px, ${ENGINE_NAMES[name]}`, dpr: 1, checks: ENGINE_CHECKS };
          const res = await runPass(ep, pass);
          for (const raw of res.issues) await merge(ep, raw, pass);
          log(`  ${pass.label}: ${res.issues.length} findings`);
        }
        await ectx.close();
      } catch (e) {
        engines.notRun[name] = `failed: ${String(e.message || e).split('\n')[0]}`;
        log(`  ${ENGINE_NAMES[name]}: ${engines.notRun[name]}`);
      } finally { await eb.close(); }
    }

    // Where the engines disagree, at the widths all three ran.
    const ran = ['chromium', ...Object.keys(engines.browsers).filter((n) => n !== 'chromium')];
    engines.differences = [];
    for (const it of issues.values()) {
      if (!ENGINE_CHECKS.includes(it.check)) continue;
      const inE = { chromium: (it.seen.light || []).some((w) => engines.widths.includes(w)) };
      for (const n of ran.slice(1)) inE[n] = (it.seen[n] || []).length > 0;
      const r = it.render || {};
      const look = Object.fromEntries(ran.map((n) => [n, r[n] ? (r[n].blurred ? 'blurred' : r[n].crisp ? 'crisp' : 'unclear') : null]));
      const found = ran.map((n) => inE[n]);
      const looks = ran.map((n) => look[n]).filter(Boolean);
      if (new Set(found).size > 1 || new Set(looks).size > 1) engines.differences.push({ id: it.id, check: it.check, found: inE, render: it.check === 'hairline-subpixel' ? look : undefined });
    }

    // Report.
    for (const it of issues.values()) {
      if (!it.render) continue;
      const parts = Object.entries(it.render).map(([n, r]) => {
        const k = r.crisp + r.blurred;
        if (!k) return `${ENGINE_NAMES[n]} could not be measured (line too faint or too short)`;
        return `${ENGINE_NAMES[n]} ${r.blurred ? `blurs the line across two pixels (${r.blurred} of ${k} samples)` : `snaps it to whole pixels (${k} of ${k} samples crisp)`}`;
      });
      it.message += ` As rendered: ${parts.join('; ')}.`;
    }
    const list = [...issues.values()].map((it) => ({
      ...it,
      title: CHECKS[it.check].title, rule: CHECKS[it.check].rule,
      seen: Object.fromEntries(Object.entries(it.seen).map(([m, ws]) => [m, rangeText(ws)])),
    })).sort((a, b) => SEVERITY.indexOf(a.severity) - SEVERITY.indexOf(b.severity)
      || Object.keys(CHECKS).indexOf(a.check) - Object.keys(CHECKS).indexOf(b.check)
      || a.id.localeCompare(b.id));
    const byCheck = {};
    for (const c of Object.keys(CHECKS)) byCheck[c] = { error: 0, warning: 0, info: 0 };
    for (const it of list) byCheck[it.check][it.severity]++;
    // Arrays of [value, count]: objects with numeric keys do not keep their order.
    const sortNum = (o) => Object.entries(o).map(([k, v]) => [parseFloat(k), v]).sort((a, b) => a[0] - b[0]);
    const report = {
      tool: 'itten-inspector', version: VERSION, url, date: new Date().toISOString(),
      environment: { platform: `${platform()} ${release()}`, browser: `Chromium ${browser.version()}` },
      mode: system ? 'system' : 'distinct', system: o.systemPath ?? null,
      sweep: { widths: rangeText(widths), keyWidths, height: VIEW_H, schemes: ['light', 'dark'], text: ['100%', '200% (browser default font size 32 px)'], dpr: [1, 2], engines: engines.widths },
      coverage,
      notJudged: [
        `Insides of graphics: svg, canvas, img, video, iframe, object, embed, math, role="img", and everything in a figure except its figcaption. Their outer boxes are measured. Skipped on this page: ${coverage.graphics} graphics and ${coverage.figureParts} figure parts.`,
        'States other than the default: hover, focus-visible, active, disabled, empty, loading and error are not measured (CRF-15). Hover, focus and clicks are used only to start motion for the motion checks.',
        'Text drawn by ::before, ::after or ::marker, inside shadow DOM, or inside canvas and WebGL.',
        'Icon optical centring and stroke weight (CRF-09, CRF-10) and text-box trim (CRF-05).',
        'Moving backgrounds are sampled in two frames 400 ms apart, not at their worst frame.',
        `Fonts are judged against the fonts installed on this machine (${platform()}); another platform can fall back differently.`,
        'Layout checks run in the light scheme only; the dark scheme is checked for contrast and fonts.',
        'Motion is recorded in Chromium at the last key width: animations running after load, and what hovering each element that declares a transition, tabbing through up to 40 focus stops, and clicking up to 15 buttons and toggles (twice, then Escape) start; frames while doing so and while scrolling the page and each scroll container by wheel, at 1x and again with the CPU slowed 4x. Links and submit buttons are not clicked, navigations are aborted, and motion that only scripts or timers start later is seen only if it runs while recording.',
        'Typographic checks judge the lines Chromium draws; WebKit and Firefox break lines a little differently. Printed pages are not paginated, so orphans and widows across pages are not judged.',
      ],
      summary: {
        error: list.filter((i) => i.severity === 'error').length,
        warning: list.filter((i) => i.severity === 'warning').length,
        info: list.filter((i) => i.severity === 'info').length,
        byCheck,
      },
      distinct: { fontSizes: sortNum(distinct.fontSizes), spacing: sortNum(distinct.spacing), radii: sortNum(distinct.radii), fixed: distinct.fixed, fluid: distinct.fluid, sweep: distinct.sweep, svgTextSizes: sortNum(distinct.insideGraphics), perWidth: distinct.perWidth },
      renderedFonts: [...renderedFonts.values()],
      textScaling,
      engines,
      pageErrors: [...new Set(consoleErrors)].slice(0, 20),
      motion,
      load: { networkIdle: loaded.networkIdle, waitFor: o.waitFor ?? null, waited: loaded.waited, settle: o.settle ?? 0, failedRequests: [...failed.values()] },
      issues: list,
    };
    // Against a committed baseline: what this run adds and what it fixes.
    if (o.baseline) report.baseline = compare(report, readBaseline(o.baseline), o.baseline, o.page);
    if (o.writeBaseline) writeBaseline(o.writeBaseline, report, o.page);
    if (outDir) {
      writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
      writeFileSync(join(outDir, 'report.html'), renderHtml(report));
    }
    return report;
  } finally {
    await browser.close();
  }
}

// ------------------------------------------------- spacing and type scale
// Judged per element across the width sweep. A property that takes three or
// more values across the sweep is fluid (clamp, vw, %): its elements are
// grouped by the curve their values follow, so one rule is one finding.
// A fluid step's size at a viewport width: min up to minWidth, max from
// maxWidth, linear between, as clamp(min, a + b·vw, max) renders it.
const FLUID_TOLERANCE = 0.25;
export function fluidAt(f, w) {
  if (w <= f.minWidth) return f.min;
  if (w >= f.maxWidth) return f.max;
  return f.min + ((f.max - f.min) * (w - f.minWidth)) / (f.maxWidth - f.minWidth);
}

// Spacing that keeps its size when the browser's text size is doubled is set
// in px: the gaps stay put while the text grows. Each margin, padding and gap
// is compared with itself at 100% and 200% text, at the same width. Values
// that follow the viewport (three or more across the sweep) are left to
// spacing-scale: in a clamp() between its limits the vw part does not follow
// the text by design, and whether the limits are in rem cannot be seen there.
function spacingUnitFindings(obs) {
  const groups = new Map();
  for (const [k, byW] of obs.spacing) {
    const at2 = obs.spacing2.get(k);
    if (!at2 || new Set(byW.values()).size >= 3) continue;
    const i = k.lastIndexOf('|'), sel = k.slice(0, i), prop = k.slice(i + 1);
    for (const [w, v] of byW) {
      if (v < 2 || !at2.has(w) || Math.abs(at2.get(w) - v) >= 0.5) continue;
      let g = groups.get(v);
      if (!g) groups.set(v, (g = { sels: [], props: new Set(), ws: new Set(), n: 0 }));
      if (!g.sels.includes(sel)) { g.sels.push(sel); g.n++; }
      g.props.add(prop); g.ws.add(w);
    }
  }
  return [...groups].sort((a, b) => a[0] - b[0]).map(([v, g]) => ({
    check: 'spacing-unit', severity: 'warning', key: 'px|' + v, mode: '200% text', count: g.n, widths: [...g.ws].sort((a, b) => a - b),
    elements: g.sels.map((s) => ({ sel: s, label: obs.labels.get(s) || s })),
    message: `${v} px of ${[...g.props].join(', ')} stays ${v} px when the browser's text size is doubled, on ${plural(g.n, 'element')}: it is set in px, so the text grows and the gap does not. Set spacing in rem, the unit of the type (${Math.round((v / 16) * 10000) / 10000}rem at the default 16 px).`,
  }));
}

function scaleFindings(obs, system, widths, distinct) {
  const out = [];
  const frac = (v) => Math.abs(v - Math.round(v)) > 0.01;
  const label = (sel) => obs.labels.get(sel) || sel;
  const near = (scale, v) => [[...scale].reverse().find((x) => x < v), scale.find((x) => x > v)].filter((x) => x !== undefined).join(' or ');
  const sortW = (ws) => [...new Set(ws)].sort((a, b) => a - b);
  const curve = (byW) => widths.map((w) => (byW.has(w) ? JSON.stringify(byW.get(w)) : '')).join(',');

  // ok(v, w): the value is allowed at that width. onScale(v): it is a fixed step.
  const judge = (check, entries, ok, onScale, scaleText, noun) => {
    // entries: [{ sel, prop, byW: Map(w -> number) }]
    const fixed = new Map(), fluid = new Map();
    for (const e of entries) {
      const vals = [...new Set(e.byW.values())];
      if (vals.length >= 3) {
        // Against a system, a fluid value is reported where it leaves the
        // scale. Without one, nothing says which ranges are deliberate, so
        // every range is listed once, as info, type and spacing alike.
        const bad = [...e.byW].filter(([w, v]) => !ok(v, w));
        if (system && !bad.length) continue;
        const sig = curve(e.byW);
        let g = fluid.get(sig);
        if (!g) fluid.set(sig, (g = { sels: [], props: new Set(), byW: e.byW, bad: bad.map(([w]) => w) }));
        if (!g.sels.includes(e.sel)) g.sels.push(e.sel);
        if (e.prop) g.props.add(e.prop);
      } else {
        for (const v of vals) {
          if ([...e.byW].every(([w, x]) => x !== v || ok(v, w))) continue;
          let g = fixed.get(v);
          if (!g) fixed.set(v, (g = { sels: [], props: new Set(), ws: [], n: 0 }));
          g.n++;
          if (!g.sels.includes(e.sel)) g.sels.push(e.sel);
          if (e.prop) g.props.add(e.prop);
          for (const [w, x] of e.byW) if (x === v) g.ws.push(w);
        }
      }
    }
    for (const [v, g] of fixed) {
      const off = !onScale(v);
      const where = noun === 'spacing'
        ? `used ${plural(g.n, 'time')} as ${[...g.props].join(', ')}`
        : `on ${plural(g.sels.length, 'text element')}`;
      const what = noun === 'spacing' ? `${v} px` : `Font size ${v} px`;
      const scaleVals = noun === 'spacing' ? system?.spacing?.scale : system?.type?.scale.filter((x) => x.size).map((x) => x.size);
      const message = off
        ? `${what} is not on the ${scaleText} (nearest ${near(scaleVals, v)} px)${frac(v) ? ' and is fractional' : ''}; ${where}.`
        : `${what} is fractional, usually compounded from em or percentage maths; ${where}.`;
      out.push({ check, severity: 'warning', key: 'fixed|' + v, message, count: g.n, widths: sortW(g.ws), elements: g.sels.map((s) => ({ sel: s, label: label(s) })) });
    }
    for (const [sig, g] of fluid) {
      const vals = [...new Set(g.byW.values())];
      const nf = vals.filter(frac).length, noff = [...g.byW].filter(([w, v]) => !ok(v, w)).length;
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const what = noun === 'spacing'
        ? `${[...g.props].join(', ')} on ${plural(g.sels.length, 'element')} ${g.props.size === 1 ? 'scales' : 'scale'}`
        : `The font size of ${plural(g.sels.length, 'text element')} scales`;
      if (!system) {
        // The widths the range spans: the widest one still at its first
        // value, and the narrowest one already at its last.
        const pts = [...g.byW].sort((a, b) => a[0] - b[0]);
        const v0 = pts[0][1], v1 = pts.at(-1)[1];
        const from = pts.filter(([, v]) => v === v0).at(-1)[0], to = pts.find(([, v]) => v === v1)[0];
        out.push({ check, severity: 'info', key: 'fluid|' + sig, count: g.sels.length, widths: sortW(pts.map(([w]) => w)),
          message: `${what} with the viewport, from ${v0} px at ${from} px wide to ${v1} px at ${to} px wide (${vals.length} values across the sweep, counted as one range in the totals). A fluid range, listed for the record. ${noun === 'type' ? 'A system file can declare it as a fluid step.' : 'With a system file it is checked against the spacing scale; a deliberate range is logged as an override.'}`,
          elements: g.sels.map((s) => ({ sel: s, label: label(s) })) });
        continue;
      }
      out.push({ check, severity: 'warning', key: 'fluid|' + sig, count: g.sels.length, widths: sortW(g.bad),
        message: `${what} with the viewport, from ${lo} to ${hi} px across the sweep: ${vals.length} distinct values, ${nf} fractional${system ? `, ${noff} off the ${noun} scale` : ''}. ${noun === 'type' ? 'Declare the range as a fluid step in the system (min, max and the widths between which it scales), or snap it to fixed steps at breakpoints.' : 'Fluid values land between steps at most widths; snap them to the scale at breakpoints, or log the fluid range as an override.'}`,
        elements: g.sels.map((s) => ({ sel: s, label: label(s) })) });
    }
    return { fluidGroups: fluid.size };
  };

  // Spacing
  // A value passes when it is a step of the scale, or when it is where a
  // fluid range the system declares puts it at that width (within 0.5 px,
  // fractions included, since clamp() lands between whole pixels).
  const sp = system?.spacing?.scale;
  const spFluid = system?.spacing?.fluid || [];
  const spEntries = [...obs.spacing].map(([k, byW]) => { const i = k.lastIndexOf('|'); return { sel: k.slice(0, i), prop: k.slice(i + 1), byW }; });
  const spOn = (v) => !sp || sp.some((s) => Math.abs(s - v) < 0.05);
  const spFluidAt = (v, w) => spFluid.some((f) => Math.abs(fluidAt(f, w) - v) <= 0.5);
  judge('spacing-scale', spEntries, (v, w) => (!frac(v) && spOn(v)) || spFluidAt(v, w), spOn, 'spacing scale', 'spacing');

  // Type sizes. A fixed step matches its size; a fluid step matches the size
  // it declares at that width, within FLUID_TOLERANCE px, fractions included.
  const steps = system?.type?.scale;
  const tyEntries = [...obs.type].map(([sel, byW]) => ({ sel, prop: null, byW: new Map([...byW].map(([w, [fs]]) => [w, fs])) }));
  // Several steps can give the same size at a width: two fixed steps that
  // share a size, or two fluid steps whose ranges cross. Each is a candidate.
  const stepsAt = (fs, w) => (steps || []).filter((x) => (x.fluid ? Math.abs(fluidAt(x.fluid, w) - fs) <= FLUID_TOLERANCE : Math.abs(x.size - fs) < 0.05));
  const tyOn = (v) => !steps || steps.some((x) => x.size && Math.abs(x.size - v) < 0.05);
  judge('type-scale', tyEntries, (v, w) => { if (!steps) return !frac(v); const c = stepsAt(v, w); return c.length > 0 && (!frac(v) || c.some((x) => x.fluid)); }, tyOn, 'type scale', 'type');

  // A step is matched on its size, its weight and the role of its family
  // (text or display, from type.families), not on size alone: a bold 18/25
  // heading is not judged as an 18/28 body step, and a regular paragraph
  // does not pass on a bold step's line height. A step without a weight or
  // family accepts any. A run (a strong or a link inside a paragraph, at the
  // paragraph's size) takes the paragraph's step, so only its size counts.
  const fams = system?.type?.families || [];
  const norm = (n) => String(n || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
  const roleOf = (name) => { const n = norm(name); return n ? fams.find((f) => norm(f.name) === n || (f.fallback || []).some((x) => norm(x) === n && !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+)$/.test(n)))?.role ?? null : null; };
  const fits = (st, wt, fam) => (st.weight == null || Math.abs(st.weight - wt) < 1) && (!st.family || !roleOf(fam) || !roleOf(st.family) || roleOf(st.family) === roleOf(fam));
  const stepText = (st) => `"${st.name}" (weight ${st.weight ?? 'any'}${st.family ? `, ${st.family}` : ''})`;
  if (steps) {
    const wg = new Map();
    for (const [sel, byW] of obs.type) {
      for (const [w, [fs, , wt, fam, run]] of byW) {
        const c = stepsAt(fs, w);
        if (!c.length || run || c.some((st) => fits(st, wt, fam))) continue;
        const role = roleOf(fam);
        const k = `${fs}|${wt}|${role}`;
        let g = wg.get(k);
        if (!g) wg.set(k, (g = { c, fs, wt, fam, role, sels: [], ws: [] }));
        if (!g.sels.includes(sel)) g.sels.push(sel);
        g.ws.push(w);
      }
    }
    for (const [k, g] of wg) {
      const weightOff = !g.c.some((st) => st.weight == null || Math.abs(st.weight - g.wt) < 1);
      out.push({ check: 'type-scale', severity: 'warning', key: 'step|' + k, count: g.sels.length, widths: sortW(g.ws), elements: g.sels.map((s) => ({ sel: s, label: label(s) })),
        message: `${g.fs} px at weight ${g.wt}${g.role ? ` in ${g.fam} (${g.role})` : ''} matches no step: ${weightOff ? 'no step at this size has this weight' : 'the steps at this size with this weight are set in a family of another role'}. The steps at ${g.fs} px are ${g.c.map(stepText).join(', ')}; on ${plural(g.sels.length, 'text element')}. Use a step's weight${g.role ? ' and family' : ''}, or add the step to the system.` });
    }
  }

  // Line heights, against the steps that match the text on size, weight and
  // role (a run: on size only).
  if (steps) {
    const lh = new Map();
    const lhOf = (st, fs) => st.lineHeight ?? fs * st.leading;
    for (const [sel, byW] of obs.type) {
      for (const [w, [fs, l, wt, fam, run]] of byW) {
        const cands = stepsAt(fs, w).filter((st) => run || fits(st, wt, fam));
        if (!cands.length || (l !== 'normal' && cands.some((st) => Math.abs(l - lhOf(st, fs)) <= 0.5))) continue;
        const k = `${fs}/${l}`;
        let g = lh.get(k);
        if (!g) lh.set(k, (g = { cands, fs, l, sels: [], ws: [] }));
        if (!g.sels.includes(sel)) g.sels.push(sel);
        g.ws.push(w);
      }
    }
    for (const [k, g] of lh) {
      const sets = (st) => `${Math.round(lhOf(st, g.fs) * 100) / 100} px${st.leading && !st.lineHeight ? ` (${st.leading} × size)` : ''}`;
      const which = g.cands.length === 1
        ? `the "${g.cands[0].name}" step${g.cands[0].weight != null ? ` (weight ${g.cands[0].weight})` : ''} sets ${sets(g.cands[0])}`
        : `the ${g.cands.length} steps at this size and weight set ${g.cands.map((st) => `${sets(st)} ("${st.name}")`).join(', ')}`;
      out.push({ check: 'type-scale', severity: 'warning', key: 'lh|' + k, count: g.sels.length, widths: sortW(g.ws), elements: g.sels.map((s) => ({ sel: s, label: label(s) })),
        message: `Line height ${g.l}${g.l === 'normal' ? '' : ' px'} at ${g.fs} px; ${which}; on ${plural(g.sels.length, 'text element')}.` });
    }
  }

  // Distinct values from elements whose values do not follow the viewport.
  const fixedVals = (entries) => {
    const m = {};
    for (const e of entries) { const vals = [...new Set(e.byW.values())]; if (vals.length < 3) for (const v of vals) m[v] = (m[v] || 0) + 1; }
    return Object.entries(m).map(([k, v]) => [parseFloat(k), v]).sort((a, b) => a[0] - b[0]);
  };
  const ranges = (entries) => {
    const groups = new Map();
    for (const e of entries) {
      const vals = [...e.byW.values()];
      if (new Set(vals).size < 3) continue;
      const k = curve(e.byW);
      const g = groups.get(k) || { lo: Math.min(...vals), hi: Math.max(...vals), sels: new Set() };
      g.sels.add(e.sel); groups.set(k, g);
    }
    return [...groups.values()].map(({ lo, hi, sels }) => ({ lo, hi, elements: sels.size })).sort((a, b) => a.lo - b.lo);
  };
  distinct.fixed = { fontSizes: fixedVals(tyEntries), spacing: fixedVals(spEntries) };
  distinct.fluid = { fontSizes: ranges(tyEntries), spacing: ranges(spEntries) };
  // Totals across the sweep, each fluid range counted as one value.
  distinct.sweep = {
    fontSizes: distinct.fixed.fontSizes.length + distinct.fluid.fontSizes.length,
    spacing: distinct.fixed.spacing.length + distinct.fluid.spacing.length,
  };
  return out;
}

// ------------------------------------------------------------------- fonts
async function fontIssues(cdp, page, res, system, renderedFonts) {
  const reps = res.data.fontReps;
  if (!reps.length) return [];
  const groups = new Map();
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    for (const rep of reps) {
      let fonts = [];
      try {
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-itten-font="${rep.id}"]` });
        if (nodeId) fonts = (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
      } catch { /* node gone */ }
      let g = groups.get(rep.group);
      if (!g) groups.set(rep.group, (g = { rep, stray: [], fonts: new Map() }));
      for (const f of fonts) {
        const cur = g.fonts.get(f.familyName) || { name: f.familyName, ps: f.postScriptName, custom: f.isCustomFont, glyphs: 0 };
        cur.glyphs += f.glyphCount; g.fonts.set(f.familyName, cur);
      }
      const odd = fonts.filter((f) => !f.isCustomFont && !/emoji/i.test(f.familyName));
      if (odd.length && fonts.some((f) => f.isCustomFont)) g.stray.push({ rep, odd });
    }
  } finally {
    await page.evaluate(() => document.querySelectorAll('[data-itten-font]').forEach((e) => e.removeAttribute('data-itten-font')));
  }
  const out = [];
  const push = (severity, key, message, els, count) => out.push({ check: 'font-fallback', severity, key, message, count, elements: els, marks: [], crop: 'each' });
  for (const g of groups.values()) {
    const stack = families(g.rep.family);
    const named = [];
    for (const f of stack) { if (GENERIC.has(f.toLowerCase())) break; named.push(f); }
    const fonts = [...g.fonts.values()].sort((a, b) => b.glyphs - a.glyphs);
    const total = fonts.reduce((n, f) => n + f.glyphs, 0);
    if (!total) continue;
    const main = fonts[0];
    const key = `${g.rep.family}|${g.rep.weight}|${g.rep.style}`;
    const n = g.rep.groupSize;
    renderedFonts.set(key, { requested: g.rep.family, weight: g.rep.weight, style: g.rep.style, elements: n, rendered: fonts.map((f) => `${f.name}${f.custom ? ' (web font)' : ''}: ${f.glyphs} glyphs`) });
    if (!named.length) continue;
    const requested = named[0];
    const els = (list) => list.slice(0, 8);
    const groupEls = els(reps.filter((r) => r.group === g.rep.group).map((r) => r.el));
    const where = `${n} text element${n === 1 ? '' : 's'} at weight ${g.rep.weight}${g.rep.style !== 'normal' ? ' ' + g.rep.style : ''}`;
    const verb = n === 1 ? 'renders' : 'render';
    const faces = res.data.fontFaces.filter((f) => norm(f.family) === norm(requested));
    if (system && !system.type.families.some((f) => loose(f.name, requested))) {
      push('warning', 'system|' + requested, `"${requested}" is requested but is not one of the system's families; ${where}.`, groupEls, n);
    }
    if (faces.length) {
      const custom = fonts.filter((f) => f.custom).reduce((s, f) => s + f.glyphs, 0);
      if (faces.every((f) => f.status === 'error')) {
        push('error', 'failed|' + key, `Web font "${requested}" failed to load; ${where} ${verb} in ${main.name} instead.`, groupEls, n);
      } else if (!custom) {
        push('error', 'fallback|' + key, `"${requested}" is declared as a web font but ${where} ${verb} in ${main.name}, a platform fallback.`, groupEls, n);
      } else if (g.stray.length) {
        const names = [...new Set(g.stray.flatMap((x) => x.odd.map((f) => f.familyName)))];
        const glyphs = g.stray.reduce((s, x) => s + x.odd.reduce((t, f) => t + f.glyphCount, 0), 0);
        push('warning', 'glyphs|' + requested + '|' + names.join(','), `${glyphs} glyph${glyphs === 1 ? '' : 's'} in ${g.stray.length} element${g.stray.length === 1 ? '' : 's'} render in ${names.join(', ')} because "${requested}" ${g.rep.weight !== '400' ? `at weight ${g.rep.weight} ` : ''}lacks them. Use a character the font has, or add a font that covers it on purpose.`, els(g.stray.map((x) => x.rep.el)), g.stray.length);
      }
    } else {
      const hit = named.find((f) => loose(f, main.name) || loose(f, main.ps));
      if (!hit || (hit !== requested && !PLATFORM_UI.test(requested))) {
        push('error', 'local|' + key, `"${requested}" is neither loaded as a web font nor installed here; ${where} ${verb} in ${main.name}${hit ? `, the stack's later choice "${hit}"` : ', which the stack does not name'}.`, groupEls, n);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ motion
// Easings compared as numbers: keywords become their cubic-bezier.
const EASE_KEYWORDS = { ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1], linear: 'linear' };
const easingOf = (v) => {
  if (Array.isArray(v)) return v;
  const t = String(v).trim().toLowerCase().replace(/\s+/g, ' ');
  if (t in EASE_KEYWORDS) return EASE_KEYWORDS[t];
  const m = t.match(/^cubic-bezier\(([^)]*)\)$/);
  return m ? m[1].split(',').map(Number) : t.replace(/\s*([(),])\s*/g, '$1');
};
const sameEasing = (a, b) => {
  a = easingOf(a); b = easingOf(b);
  if (Array.isArray(a) && Array.isArray(b)) return a.every((x, i) => Math.abs(x - b[i]) < 0.001);
  return a === b;
};
// Properties that make the browser lay the page out again on every frame.
const LAYOUT_PROPS = /^(width|height|min-width|min-height|max-width|max-height|top|right|bottom|left|inset.*|margin.*|padding.*|border(-(top|right|bottom|left))?-width|font-size|line-height|letter-spacing|word-spacing|gap|row-gap|column-gap|flex-basis|grid-template.*)$/;
// Properties that move or resize something; colour and opacity do not.
const MOVEMENT_PROPS = /^(transform|translate|rotate|scale|offset.*|background-position|perspective.*|scroll.*)$/;
// WCAG 2.3.1: the general flash threshold applies to a combined area of
// 25% of a 10° visual field, about 21,824 px² at 1024 × 768.
const FLASH_AREA = 21824;

async function motionPasses(browser, url, o, system, w, merge, log) {
  const out = { width: w, animations: 0, durations: [], easings: [], frames: {}, interactions: {} };
  const runs = {};
  for (const mode of ['motion', 'reduced']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: VIEW_H }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(motionInit);
    // Clicks must not leave the page: what was recorded lives in it. Popups
    // are closed, and navigations of the page itself are aborted once it
    // has loaded; a same-document change (a hash, history.pushState) stays.
    let page = null;
    ctx.on('page', (p) => { if (page && p !== page) p.close().catch(() => {}); });
    page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    try {
      await load(page, url, o);
      await page.route('**/*', (r) => (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame() ? r.abort() : r.continue()));
      const phase = (p) => page.evaluate((x) => window.__ittenMotion?.setPhase(x), p);
      // Until no animation that ends is still running: 50 ms to 1.2 s.
      const settleMotion = async () => {
        await page.waitForTimeout(50);
        for (let t = 0; t < 23; t++) {
          const busy = await page.evaluate(() => (document.getAnimations?.() ?? []).some((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)).catch(() => false);
          if (!busy) return;
          await page.waitForTimeout(50);
        }
      };
      await phase('idle');
      await page.waitForTimeout(mode === 'motion' ? 2000 : 1000);

      // What to interact with, marked once: elements that declare a
      // transition (hovered), and buttons and toggles that do not navigate
      // (clicked). Focus is reached with Tab, as a keyboard user does.
      const counts = await page.evaluate(() => {
        const ms = (v) => Math.max(0, ...v.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 1 : 1000)));
        const shown = (el) => el.getClientRects().length && !el.closest('svg, canvas, [role="img"], [inert], [aria-hidden="true"]');
        let h = 0, c = 0;
        for (const el of document.body.querySelectorAll('*')) {
          if (h >= 20) break;
          const s = getComputedStyle(el);
          if (ms(s.transitionDuration) + ms(s.transitionDelay) > 0 && shown(el)) el.setAttribute('data-itten-hover', String(h++));
        }
        for (const el of document.body.querySelectorAll('button, [role="button"], [role="switch"], [role="tab"], [aria-expanded], [aria-pressed], summary, input[type="checkbox"], input[type="radio"]')) {
          if (c >= 15) break;
          if (!shown(el) || el.disabled || el.closest('a[href]')) continue;
          // A button in a form submits it unless it says otherwise.
          if (el.localName === 'button' && el.form && el.type !== 'button') continue;
          el.setAttribute('data-itten-click', String(c++));
        }
        return { hover: h, click: c };
      });
      const where = async (q) => page.evaluate((qs) => { const el = document.querySelector(qs); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, q);

      const interact = async (rate) => {
        const sfx = rate > 1 ? `@${rate}x` : '';
        for (let i = 0; i < counts.hover; i++) {
          const at = await where(`[data-itten-hover="${i}"]`);
          if (!at) continue;
          await page.waitForTimeout(50);
          await phase(`hover:${i}${sfx}`);
          await page.mouse.move(at[0], at[1]);
          await settleMotion();
          await phase(`unhover:${i}${sfx}`);
          await page.mouse.move(1, 1);
          await settleMotion();
        }
        // Tab through the page from the top, up to 40 stops, until focus
        // comes back round or leaves the page.
        // Clicks move the point Tab starts from, so start from a temporary
        // stop at the top of the page.
        await page.evaluate(() => { const s = document.createElement('span'); s.tabIndex = -1; s.setAttribute('data-itten-start', ''); document.body.prepend(s); s.focus({ preventScroll: true }); scrollTo(0, 0); });
        let first = null;
        for (let i = 0; i < 40; i++) {
          await phase(`focus:${i}${sfx}`);
          await page.keyboard.press('Tab');
          const id = await page.evaluate((n) => {
            const el = document.activeElement;
            if (!el || el === document.body) return null;
            if (!el.hasAttribute('data-itten-focus')) el.setAttribute('data-itten-focus', String(n));
            return el.getAttribute('data-itten-focus');
          }, i);
          if (id === null || id === first) break;
          first ??= id;
          await settleMotion();
        }
        await page.evaluate(() => { document.activeElement?.blur?.(); document.querySelector('[data-itten-start]')?.remove(); });
        // Click each button or toggle, then again to put it back, then Escape.
        for (let i = 0; i < counts.click; i++) {
          const q = `[data-itten-click="${i}"]`;
          if (!(await where(q))) continue;
          for (const step of ['click', 'unclick']) {
            await phase(`${step}:${i}${sfx}`);
            try { await page.click(q, { timeout: 1500 }); } catch { break; }
            await settleMotion();
          }
          await page.keyboard.press('Escape');
          await page.mouse.move(1, 1);
          await settleMotion();
        }
        // Scroll the page and each scroll container by wheel, as a reader does.
        if (mode !== 'motion') return;
        const boxes = await page.evaluate(() => {
          const out = [];
          for (const el of document.body.querySelectorAll('*')) {
            if (out.length >= 5) break;
            if (el.hasAttribute('data-itten-scroll')) { out.push(el.getAttribute('data-itten-scroll')); continue; }
            const s = getComputedStyle(el);
            if (!/(auto|scroll)/.test(s.overflowY) || el.scrollHeight <= el.clientHeight + 20 || !el.getClientRects().length) continue;
            el.setAttribute('data-itten-scroll', String(out.length));
            out.push(String(out.length));
          }
          return out;
        });
        for (const b of [null, ...boxes]) {
          let at = [w / 2, VIEW_H / 2];
          if (b !== null) { await page.evaluate((q) => { const el = document.querySelector(q); if (el) el.scrollTop = 0; }, `[data-itten-scroll="${b}"]`); const c = await where(`[data-itten-scroll="${b}"]`); if (!c) continue; at = c; }
          else await page.evaluate(() => scrollTo(0, 0));
          await page.mouse.move(at[0], at[1]);
          await page.waitForTimeout(100);
          await phase(`scroll:${b === null ? 'page' : b}${sfx}`);
          for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(60); }
          await page.waitForTimeout(300);
          await phase('after-scroll');
        }
        await page.evaluate(() => scrollTo(0, 0));
      };

      await interact(1);
      // Again with the CPU slowed four times, as on a mid-range phone, for
      // frame timing; motion it starts is recorded as well.
      if (mode === 'motion') {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await interact(4);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      }
      await phase('done');
      const rep = await page.evaluate(motionReport);
      // Selectors for the phases' targets, without the inspector's own attributes.
      const names = await page.evaluate(() => {
        const sel = (el) => {
          if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && document.querySelectorAll('#' + el.id).length === 1) return '#' + el.id;
          if (el === document.body) return 'body';
          const p = el.parentElement, same = p ? [...p.children].filter((c) => c.localName === el.localName) : [];
          return (p ? sel(p) + ' > ' : '') + el.localName + (same.length > 1 ? `:nth-of-type(${same.indexOf(el) + 1})` : '');
        };
        const out = {};
        for (const [attr, pre] of [['data-itten-hover', 'hover:'], ['data-itten-scroll', 'scroll:'], ['data-itten-focus', 'focus:'], ['data-itten-click', 'click:']]) {
          for (const el of document.querySelectorAll(`[${attr}]`)) {
            const r = el.getBoundingClientRect();
            let t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(); if (t.length > 40) t = t.slice(0, 39) + '…';
            out[pre + el.getAttribute(attr)] = { sel: sel(el), label: el.localName + (el.classList[0] ? '.' + el.classList[0] : '') + (t ? ` "${t}"` : ''), rect: [r.left + scrollX, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 100) / 100) };
            el.removeAttribute(attr);
          }
        }
        out['scroll:page'] = { sel: 'html', label: 'the page', rect: [0, 0, innerWidth, innerHeight] };
        return out;
      });
      runs[mode] = { rep, names };
      if (mode === 'motion') out.interactions = { hovered: counts.hover, clicked: counts.click, focused: Object.keys(names).filter((k) => k.startsWith('focus:')).length };
      const issues = judgeMotion(mode, rep, names, system);
      const pass = { w, mode: mode === 'motion' ? 'motion' : 'reduced motion', label: `${w} px, ${mode === 'motion' ? 'motion' : 'reduced motion'}`, dpr: 1 };
      for (const raw of issues) await merge(page, raw, pass);
      log(`  ${pass.label}: ${rep ? rep.anims.length : 0} animations, ${issues.length} findings`);
    } finally {
      await ctx.close();
    }
  }
  const rep = runs.motion?.rep;
  if (rep) {
    out.animations = rep.anims.length;
    out.durations = [...new Set(rep.anims.map((a) => a.duration).filter((d) => d > 0))].sort((a, b) => a - b);
    out.easings = [...new Set(rep.anims.filter((a) => a.duration > 0).map((a) => a.easing))].sort();
    // Frame times by what was happening, at 1x and at 4x: idle, hovering,
    // focusing by Tab, clicking, and scrolling each scroller by name.
    const acc = {};
    for (const [ph, ds] of Object.entries(rep.frames)) {
      const m = ph.match(/^(idle|hover|unhover|focus|click|unclick|scroll)(?::([^@]+))?(?:@(\d+)x)?$/);
      if (!m || !ds.length) continue;
      const kind = { unhover: 'hover', unclick: 'click' }[m[1]] ?? m[1];
      const k = kind === 'scroll' ? (runs.motion.names['scroll:' + m[2]]?.sel ?? ph) : kind;
      ((acc[k] ??= {})[`${m[3] || 1}x`] ??= []).push(...ds);
    }
    for (const [k, byRate] of Object.entries(acc)) out.frames[k] = Object.fromEntries(Object.entries(byRate).map(([r, ds]) => [r, frameStats(ds)]));
  }
  return out;
}

const frameStats = (ds) => {
  const s = [...ds].sort((a, b) => a - b);
  const q = (p) => Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] * 10) / 10;
  return { frames: s.length, p50: q(0.5), p95: q(0.95), max: Math.round(s.at(-1) * 10) / 10,
    histogram: { '≤17 ms': s.filter((d) => d <= 17.5).length, '≤33 ms': s.filter((d) => d > 17.5 && d <= 34).length, '≤50 ms': s.filter((d) => d > 34 && d <= 50).length, '>50 ms': s.filter((d) => d > 50).length } };
};

function judgeMotion(mode, rep, names, system) {
  if (!rep) return [];
  const out = [];
  const el = (a) => ({ sel: a.sel, label: a.label + (a.pseudo ? ` ${a.pseudo}` : ''), rect: a.rect });
  const what = (a) => a.kind === 'CSSTransition' ? `The transition of ${a.name}` : a.kind === 'CSSAnimation' ? `The animation "${a.name}"` : `A scripted animation${a.name ? ` "${a.name}"` : ''}`;
  const push = (check, severity, key, a, message) => { if (!a.ignore.includes(check)) out.push({ check, severity, key, count: 1, elements: [el(a)], marks: [], crop: 'each', message }); };
  const anims = rep.anims.filter((a) => a.duration > 0);
  if (mode === 'reduced') {
    // Under Reduce Motion, movement becomes what the system says, and loops
    // stop. Colour and opacity changes are not movement, except where the
    // system says nothing is animated.
    const rm = system?.motion?.reducedMotion ?? 'instant';
    for (const a of anims) {
      const moves = a.props.filter((p) => MOVEMENT_PROPS.test(p) || LAYOUT_PROPS.test(p));
      const loop = a.iterations === Infinity;
      if (!moves.length && !loop && rm !== 'none-animated') continue;
      push('reduced-motion', 'warning', `${a.sel}|${a.pseudo}|${a.name}`, a, `${what(a)} still runs with prefers-reduced-motion: reduce${loop ? ', and loops without end' : ''}${moves.length ? `, moving ${moves.join(', ')}` : ''} (${a.duration} ms). The system says movement becomes ${rm === 'fade' ? 'a fade' : rm === 'instant' ? 'an instant change' : 'nothing animated'} under Reduce Motion: stop it in a prefers-reduced-motion: reduce query.`);
    }
    return out;
  }
  const durs = system ? Object.values(system.motion.durations) : null;
  const eases = system ? Object.values(system.motion.easings) : null;
  for (const a of anims) {
    if (durs) {
      const offD = !durs.some((d) => Math.abs(d - a.duration) <= 1);
      const offE = !eases.some((e) => sameEasing(e, a.easing));
      if (offD || offE) {
        const names = (o, f) => Object.entries(o).map(([k, v]) => `${k} ${f(v)}`).join(', ');
        push('motion-timing', 'warning', `${a.sel}|${a.pseudo}|${a.name}|${a.duration}|${a.easing}`, a, `${what(a)} runs ${a.duration} ms with ${a.easing}${offD && offE ? '; neither is' : offD ? '; the duration is not' : '; the easing is not'} in the system (durations: ${names(system.motion.durations, (v) => v + ' ms')}; easings: ${names(system.motion.easings, (v) => (Array.isArray(v) ? `cubic-bezier(${v.join(', ')})` : v))}).`);
      }
    }
    const layout = a.props.filter((p) => LAYOUT_PROPS.test(p));
    if (layout.length) {
      push('motion-layout', 'warning', `${a.sel}|${a.pseudo}|${layout.join(',')}`, a, `${what(a)} animates ${layout.join(', ')}, so the browser lays the page out again on every frame (${a.duration} ms). Animate transform and opacity instead: scale or translate for size and position, clip-path for reveals.`);
    }
    // Flashing: luminance reversals of 10% or more, where the darker state
    // is below 0.8, counted per second over the element's area.
    const area = a.rect[2] * a.rect[3];
    if (area >= FLASH_AREA && a.lums.length >= 2) {
      const L = a.lums;
      let changes = 0;
      const flips = (x, y) => Math.abs(x - y) >= 0.1 && Math.min(x, y) < 0.8;
      for (let i = 1; i < L.length; i++) if (flips(L[i - 1], L[i])) changes++;
      if (!/alternate/.test(a.direction) && a.iterations > 1 && flips(L.at(-1), L[0])) changes++;
      const perSecond = (changes * 1000) / a.duration / 2;
      if (perSecond > 3) {
        push('flash', 'error', `${a.sel}|${a.pseudo}|${a.name}`, a, `${what(a)} flashes ${Math.round(perSecond * 10) / 10} times a second over ${Math.round(area)} px², between relative luminances ${Math.round(Math.min(...L) * 100) / 100} and ${Math.round(Math.max(...L) * 100) / 100}. More than three flashes a second over this much area can trigger seizures (WCAG 2.3.1). Slow it to one flash a second or less, or reduce the change in luminance.`);
      }
    }
  }
  // Flashing driven by script: class or style changes, with the luminance
  // after each, counted in any one second.
  for (const t of rep.toggles) {
    const area = t.rect[2] * t.rect[3];
    if (area < FLASH_AREA) continue;
    let best = 0;
    for (let i = 0; i < t.rec.length; i++) {
      let n = 0;
      for (let j = i + 1; j < t.rec.length && t.rec[j][0] - t.rec[i][0] <= 1000; j++) {
        const [x, y] = [t.rec[j - 1][1], t.rec[j][1]];
        if (Math.abs(x - y) >= 0.1 && Math.min(x, y) < 0.8) n++;
      }
      best = Math.max(best, n);
    }
    if (best / 2 > 3) out.push({ check: 'flash', severity: 'error', key: t.sel + '|script', count: 1, elements: [{ sel: t.sel, label: t.label, rect: t.rect }], marks: [], crop: 'each',
      message: `A script changes this element's colour ${best} times within one second, ${best / 2} flashes over ${Math.round(area)} px². More than three flashes a second over this much area can trigger seizures (WCAG 2.3.1).` });
  }
  // Dropped frames while hovering, focusing, clicking or scrolling, at 1x
  // and with the CPU slowed 4x: frames over 50 ms, three or more frames of
  // a 60 Hz display, are visible as a stall. A hover or a click and the
  // move away from it are counted together.
  const byTarget = new Map();
  for (const [ph, ds] of Object.entries(rep.frames)) {
    const m = ph.match(/^(hover|unhover|focus|click|unclick|scroll):([^@]+)(?:@(\d+)x)?$/);
    if (!m) continue;
    const kind = { unhover: 'hover', unclick: 'click' }[m[1]] ?? m[1];
    const who = names[`${kind}:${m[2]}`];
    if (!who) continue;
    const rate = Number(m[3] || 1);
    const k = `${who.sel}|${kind}|${rate}`;
    let g = byTarget.get(k);
    if (!g) byTarget.set(k, (g = { who, kind, rate, ds: [] }));
    g.ds.push(...ds);
  }
  for (const [k, g] of byTarget) {
    const st = frameStats(g.ds);
    const long = st.histogram['>50 ms'];
    if (long < 3) continue;
    const h = Object.entries(st.histogram).map(([x, v]) => `${x} ${v}`).join(', ');
    const doing = { scroll: `scrolling ${g.who.sel === 'html' ? 'the page' : 'this container'}`, hover: 'hovering this element', focus: 'this element took focus', click: 'clicking this element' }[g.kind];
    out.push({ check: 'frame-timing', severity: 'warning', key: k, count: long, elements: [g.who], marks: [], crop: 'each',
      message: `While ${doing}${g.rate > 1 ? `, with the CPU slowed ${g.rate} times as on a mid-range phone` : ''}, ${long} of ${st.frames} frames took over 50 ms (median ${st.p50} ms, 95th percentile ${st.p95} ms, longest ${st.max} ms; frame times ${h}). Find the work on the main thread in a performance recording: scroll and pointer handlers, layout or paint on every frame.` });
  }
  return out;
}

// ------------------------------------------------------------ optical edge
// Where the ink of a display line's first glyph starts, against the ink of
// the first glyph of the text it aligns with. Each glyph is screenshotted
// with the page's text drawn and again with all text transparent; the first
// column that differs is where the ink starts. Round and pointed letters
// carry side bearings that grow with size, so at display sizes their ink
// sits visibly inside an edge that the boxes share.
async function opticalIssues(page, cands) {
  if (!cands.length) return [];
  cands = cands.slice(0, 12);
  const clipOf = (g, fs) => {
    const x = Math.max(0, Math.floor(g[0] - fs * 0.3)), y = Math.max(0, Math.floor(g[1]));
    return { x, y, width: Math.ceil(g[0] + g[2] - x) + 1, height: Math.max(4, Math.ceil(g[3])) };
  };
  const shots = async () => {
    const out = [];
    for (const c of cands) {
      const pair = [];
      for (const [g, fs] of [[c.glyph, c.fs], [c.refGlyph, c.fs]]) {
        const clip = clipOf(g, fs);
        try { pair.push({ clip, img: decodePng(await page.screenshot({ clip, fullPage: true })) }); } catch { pair.push(null); }
      }
      out.push(pair);
    }
    return out;
  };
  const shown = await shots();
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'itten-hide-text';
    s.textContent = '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }';
    document.head.append(s);
  });
  let hidden;
  try { await settle(page); hidden = await shots(); } finally {
    await page.evaluate(() => document.getElementById('itten-hide-text')?.remove());
    await settle(page);
  }
  const inkLeft = (a, b) => {
    if (!a || !b || a.img.width !== b.img.width || a.img.height !== b.img.height) return null;
    const { width, height, channels } = a.img;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const o = (y * width + x) * channels;
        let d = 0;
        for (let k = 0; k < 3; k++) d += Math.abs(a.img.data[o + k] - b.img.data[o + k]);
        if (d > 96) return a.clip.x + x;
      }
    }
    return null;
  };
  const out = [];
  cands.forEach((c, i) => {
    const ink = inkLeft(shown[i][0], hidden[i][0]), ref = inkLeft(shown[i][1], hidden[i][1]);
    if (ink === null || ref === null) return;
    // A round or pointed letter whose ink only meets the edge already looks
    // indented; one whole pixel short of it, at display size, is reported.
    // A single pixel is the smallest offset the screen can draw and is at
    // the edge of what shows at 1x, so it is listed as info; two or more
    // is a warning.
    const d = ink - ref;
    if (d < 1) return;
    const y = c.glyph[1], h = c.glyph[3];
    out.push({ check: 'optical-margin', severity: d >= 2 ? 'warning' : 'info', key: c.el.sel, count: 1, elements: [c.el], crop: 'marks',
      marks: [{ x1: ref, y1: y, x2: ink, y2: y + h }],
      message: `The ink of the "${c.letter}" at ${c.fs} px starts ${d} px to the right of the ink of the "${c.refLetter}" in ${c.ref.label}, though their boxes share an edge. Round and pointed letters at display sizes need to reach past that edge to look aligned: pull the line left until the ink passes the edge slightly, about ${Math.round(((d + 0.015 * c.fs) / c.fs) * 100) / 100}em with text-indent, and log it as an optical adjustment (CRF-04).` });
  });
  return out;
}

// ---------------------------------------------------------------- contrast
async function contrastIssues(page, res, coverage) {
  const texts = res.data.text;
  if (!texts.length) return [];
  const H = Math.min(res.docHeight, 16000);
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'itten-hide-text';
    s.textContent = '*, *::before, *::after, *::marker, *::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; caret-color: transparent !important; }';
    document.head.append(s);
  });
  const frames = [];
  try {
    await settle(page);
    for (let i = 0; i < 2; i++) {
      if (i) await page.waitForTimeout(400);
      frames.push(decodePng(await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: res.vw, height: H } })));
    }
  } finally {
    await page.evaluate(() => document.getElementById('itten-hide-text')?.remove());
    await settle(page);
  }
  const out = [];
  for (const t of texts) {
    const a = t.color[3] * t.opacity;
    if (t.clipText || a < 0.1) { coverage.contrastSkipped++; continue; }
    const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
    const min = large ? 3 : 4.5;
    const samples = [];
    for (const [x, y, w, h] of t.lines) {
      const nx = Math.min(40, Math.max(2, Math.ceil(w / 4))), ny = Math.min(8, Math.max(2, Math.ceil(h / 4)));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const px = Math.round(x + 1 + ((w - 2) * (i + 0.5)) / nx), py = Math.round(y + 1 + ((h - 2) * (j + 0.5)) / ny);
        for (const f of frames) {
          if (px < 0 || py < 0 || px >= f.width || py >= f.height) continue;
          const o = (py * f.width + px) * f.channels;
          const bg = [f.data[o], f.data[o + 1], f.data[o + 2]];
          samples.push({ r: ratio(blend(t.color, a, bg), bg), bg });
        }
      }
    }
    if (!samples.length) continue;
    coverage.contrastSamples += samples.length;
    samples.sort((p, q) => p.r - q.r);
    const med = samples[Math.floor(samples.length / 2)], p10 = samples[Math.floor(samples.length * 0.1)];
    const fg = blend(t.color, a, med.bg);
    const f2 = (v) => v.r.toFixed(2);
    if (med.r < min) {
      out.push({ check: 'contrast', severity: 'error', key: t.el.sel, count: 1, elements: [t.el], marks: [], crop: 'union',
        message: `Text measures ${f2(med)}:1 against the pixels behind it (needs ${min}:1${large ? ', large text' : ''}). Text ${hex(fg)} over about ${hex(med.bg)}; worst sample ${f2(samples[0])}:1.` });
    } else if (p10.r < min) {
      out.push({ check: 'contrast', severity: 'warning', key: t.el.sel, count: 1, elements: [t.el], marks: [], crop: 'union',
        message: `Text drops to ${f2(p10)}:1 over a tenth of the background behind it (median ${f2(med)}:1, needs ${min}:1). Text ${hex(fg)}, darkest-contrast background ${hex(p10.bg)}.` });
    }
  }
  return out;
}

// --------------------------------------------------------------------- CLI
function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; o[k] = v; }
    else o._.push(a);
  }
  return o;
}
const parseWidths = (s) => {
  if (s.includes(':')) { const [a, b, st] = s.split(':').map(Number); const out = []; for (let w = a; w <= b; w += st) out.push(w); return out; }
  return s.split(',').map(Number);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.validate) {
    const { errors } = loadSystem(args.validate);
    if (errors.length) { console.error(`${args.validate} is not valid:\n  ` + errors.join('\n  ')); process.exit(1); }
    console.log(`${args.validate} is valid.`);
    process.exit(0);
  }
  const url = args._[0];
  if (!url) { console.error('Usage: node itten/inspector/inspect.js <url> [--system itten.system.json] [--out itten-report]'); process.exit(2); }
  let system = null;
  if (args.system) {
    const r = loadSystem(args.system);
    if (r.errors.length) { console.error(`${args.system} is not valid:\n  ` + r.errors.join('\n  ')); process.exit(1); }
    system = r.system;
  }
  const out = args.out || 'itten-report';
  const report = await inspect(url, {
    system, systemPath: args.system || null, out, full: !!args.full,
    widths: args.widths ? parseWidths(args.widths) : undefined,
    keyWidths: args['key-widths'] ? parseWidths(args['key-widths']) : undefined,
    engines: args['no-engines'] ? [] : typeof args.engines === 'string' ? args.engines.split(',').filter(Boolean) : undefined,
    waitFor: typeof args['wait-for'] === 'string' ? args['wait-for'] : undefined,
    settle: args.settle ? Number(args.settle) : undefined,
    baseline: typeof args.baseline === 'string' ? args.baseline : undefined,
    page: typeof args.page === 'string' ? args.page : undefined,
    writeBaseline: args['write-baseline'] ? (typeof args['write-baseline'] === 'string' ? args['write-baseline'] : 'itten-baseline.json') : undefined,
  });
  const s = report.summary;
  console.log(`\n${s.error} errors, ${s.warning} warnings, ${s.info} info. Report: ${join(out, 'report.html')}`);
  const b = report.baseline;
  if (b) console.log(b.found ? `Against ${b.file}: ${b.new.length} new, ${b.fixed.length} fixed.` : `${b.file} has no entry for ${b.page}.`);
  if (args['write-baseline']) console.log(`Baseline written for this page to ${typeof args['write-baseline'] === 'string' ? args['write-baseline'] : 'itten-baseline.json'}.`);
  // With --baseline, only new findings and findings that got worse fail the run.
  if (failing(report, args['fail-on']).length) process.exit(1);
}
