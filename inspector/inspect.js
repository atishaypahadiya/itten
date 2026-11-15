#!/usr/bin/env node
// ITTEN inspector. Measures a rendered page up close, against the project's
// system file when one is given, and writes report.json, report.html and
// zoomed crops. See protocol/04-inspect.md.
//
// Usage:
//   node itten/inspector/inspect.js <url> [--system itten.system.json] [--out itten-report]
//        [--full] [--widths 320:1920:40] [--key-widths 320,768,1440] [--no-engines] [--fail-on error|warning]
//   node itten/inspector/inspect.js --validate itten.system.json

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, release } from 'node:os';
import { collect } from './collect.js';
import { decodePng, encodePng, upscale, outline } from './png.js';
import { renderHtml } from './report-html.js';
import { validate } from '../scripts/lib/schema.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(join(HERE, '..', 'schema', 'system.schema.json'), 'utf8'));

export const CHECKS = {
  'contrast': { title: 'Text contrast against rendered pixels', rule: 'CRF-14 · COL-01 · WCAG 1.4.3' },
  'font-fallback': { title: 'Font fallback', rule: 'CRF-13' },
  'overflow': { title: 'Overflow', rule: 'CRF-16 · LAY-03 · WCAG 1.4.10' },
  'clipping': { title: 'Clipping', rule: 'CRF-16 · TYP-03 · WCAG 1.4.4' },
  'overlap': { title: 'Overlapping text', rule: 'CRF-16' },
  'target-size': { title: 'Target size', rule: 'CRF-17 · INT-01 · INT-02 · WCAG 2.5.8' },
  'spacing-scale': { title: 'Spacing off the scale', rule: 'CRF-01 · CRF-07 · LAY-05' },
  'type-scale': { title: 'Type off the scale', rule: 'CRF-06 · CRF-07 · TYP-06' },
  'text-resize': { title: 'Text ignores the browser text size', rule: 'CRF-16 · TYP-03 · WCAG 1.4.4' },
  'near-miss-edge': { title: 'Near-miss edges', rule: 'CRF-04 · LAY-09 · LAY-10' },
  'sibling-gaps': { title: 'Unequal sibling gaps', rule: 'CRF-03 · LAY-05' },
  'radius': { title: 'Radii outside the set', rule: 'CRF-11 · SHP-02' },
  'radius-concentric': { title: 'Non-concentric corners', rule: 'CRF-12 · SHP-01' },
  'hairline-subpixel': { title: 'Hairlines off the pixel grid', rule: 'CRF-08' },
};
const SEVERITY = ['error', 'warning', 'info'];
const ENGINE_NAMES = { chromium: 'Chromium', webkit: 'WebKit', firefox: 'Firefox' };
// Checks run again in WebKit and Firefox. Spacing and type values are
// computed styles, the same in every engine, so they run in Chromium only.
const ENGINE_CHECKS = ['near-miss-edge', 'sibling-gaps', 'radius', 'radius-concentric', 'target-size', 'overflow', 'clipping', 'overlap', 'hairline-subpixel'];
const LAYOUT = ['spacing-scale', 'type-scale', 'near-miss-edge', 'sibling-gaps', 'radius', 'radius-concentric', 'target-size', 'overflow', 'clipping', 'overlap', 'hairline-subpixel'];
const TEXT200 = ['overflow', 'clipping', 'overlap'];
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

async function load(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  // Scroll through once so lazy content and reveal-on-scroll elements render.
  await page.evaluate(async () => {
    const step = innerHeight * 0.8;
    const t0 = performance.now();
    for (let y = 0; y < document.documentElement.scrollHeight && y < 40000 && performance.now() - t0 < 8000; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.waitForTimeout(500);
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
  const obs = { spacing: new Map(), type: new Map(), labels: new Map() };
  let cropCount = 0, idCount = 0;

  const merge = async (page, raw, pass) => {
    if (raw.check === 'hairline-subpixel') await judgeHairline(page, raw, pass);
    const k = raw.check + '|' + raw.key;
    let it = issues.get(k);
    const isNew = !it;
    if (!it) {
      it = { id: `i${String(++idCount).padStart(3, '0')}`, check: raw.check, severity: raw.severity, message: raw.message, count: raw.count, elements: [], seen: {}, crops: [], first: pass.label };
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
    const it = { id: `i${String(++idCount).padStart(3, '0')}`, check: f.check, severity: f.severity, message: f.message, count: f.count, elements: [], seen: { [mode]: f.widths }, crops: [], first: `${w} px, ${mode}` };
    issues.set(f.check + '|' + f.key, it);
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

  const runPass = async (page, pass, extra = {}) => {
    await page.setViewportSize({ width: pass.w, height: VIEW_H });
    await page.evaluate(() => scrollTo(0, 0));
    await settle(page);
    const res = await page.evaluate(collect, { checks: pass.checks, system, dpr: pass.dpr, ...extra });
    return res;
  };

  try {
    // Pass set 1: light, 100% text, every width; contrast and fonts at key widths, light and dark.
    const ctx = await browser.newContext({ viewport: { width: widths[0], height: VIEW_H }, deviceScaleFactor: 1, colorScheme: 'light' });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));
    log(`Loading ${url}`);
    await load(page, url);
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
      for (const [sel, fs, lh] of res.data.typeObs) { if (!obs.type.has(sel)) obs.type.set(sel, new Map()); obs.type.get(sel).set(w, [fs, lh]); }
      for (const [k, v] of Object.entries(res.data.labels)) if (!obs.labels.has(k)) obs.labels.set(k, v);
      for (const raw of res.issues) await merge(page, raw, pass);
      log(`  ${pass.label}: ${res.issues.length} findings, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
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
        log(`  ${pass.label}: contrast and fonts`);
      }
    }
    await page.emulateMedia({ colorScheme: 'light' });

    // Pass set 2: the browser's text size doubled (16 px default becomes 32 px).
    const page2 = await ctx.newPage();
    const cdp2 = await ctx.newCDPSession(page2);
    await cdp2.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await load(page2, url);
    for (const w of widths) {
      const pass = { w, mode: '200% text', label: `${w} px, 200% text`, dpr: 1, checks: TEXT200 };
      const res = await runPass(page2, pass, { recordSizes: w === keyWidths.at(-1) });
      if (w === keyWidths.at(-1)) sizes.doubled = res.data.textSizes;
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
    await ctx.close();

    // Pass set 3: device pixel ratio 2, hairlines only.
    const ctx2 = await browser.newContext({ viewport: { width: keyWidths[0], height: VIEW_H }, deviceScaleFactor: 2, colorScheme: 'light' });
    const page3 = await ctx2.newPage();
    await load(page3, url);
    for (const w of [keyWidths[0], keyWidths.at(-1)]) {
      const pass = { w, mode: '2x', label: `${w} px, 2×`, dpr: 2, checks: ['hairline-subpixel'] };
      const res = await runPass(page3, pass);
      for (const raw of res.issues) await merge(page3, raw, pass);
    }
    await ctx2.close();

    // Pass set 4: WebKit and Firefox, light, a few widths, layout checks only.
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
        await load(ep, url);
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
      tool: 'itten-inspector', url, date: new Date().toISOString(),
      environment: { platform: `${platform()} ${release()}`, browser: `Chromium ${browser.version()}` },
      mode: system ? 'system' : 'distinct', system: o.systemPath ?? null,
      sweep: { widths: rangeText(widths), keyWidths, height: VIEW_H, schemes: ['light', 'dark'], text: ['100%', '200% (browser default font size 32 px)'], dpr: [1, 2], engines: engines.widths },
      coverage,
      notJudged: [
        `Insides of graphics: svg, canvas, img, video, iframe, object, embed, math, role="img", and everything in a figure except its figcaption. Their outer boxes are measured. Skipped on this page: ${coverage.graphics} graphics and ${coverage.figureParts} figure parts.`,
        'States other than the default: hover, focus-visible, active, disabled, empty, loading and error are not rendered (CRF-15).',
        'Text drawn by ::before, ::after or ::marker, inside shadow DOM, or inside canvas and WebGL.',
        'Icon optical centring and stroke weight (CRF-09, CRF-10), text-box trim (CRF-05) and motion (CRF-18).',
        'Moving backgrounds are sampled in two frames 400 ms apart, not at their worst frame.',
        `Fonts are judged against the fonts installed on this machine (${platform()}); another platform can fall back differently.`,
        'Layout checks run in the light scheme only; the dark scheme is checked for contrast and fonts.',
      ],
      summary: {
        error: list.filter((i) => i.severity === 'error').length,
        warning: list.filter((i) => i.severity === 'warning').length,
        info: list.filter((i) => i.severity === 'info').length,
        byCheck,
      },
      distinct: { fontSizes: sortNum(distinct.fontSizes), spacing: sortNum(distinct.spacing), radii: sortNum(distinct.radii), fixed: distinct.fixed, fluid: distinct.fluid, svgTextSizes: sortNum(distinct.insideGraphics), perWidth: distinct.perWidth },
      renderedFonts: [...renderedFonts.values()],
      textScaling,
      engines,
      pageErrors: [...new Set(consoleErrors)].slice(0, 20),
      issues: list,
    };
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

function scaleFindings(obs, system, widths, distinct) {
  const out = [];
  const frac = (v) => Math.abs(v - Math.round(v)) > 0.01;
  const label = (sel) => obs.labels.get(sel) || sel;
  const near = (scale, v) => [[...scale].reverse().find((x) => x < v), scale.find((x) => x > v)].filter((x) => x !== undefined).join(' or ');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const sortW = (ws) => [...new Set(ws)].sort((a, b) => a - b);
  const curve = (byW) => widths.map((w) => (byW.has(w) ? JSON.stringify(byW.get(w)) : '')).join(',');

  // ok(v, w): the value is allowed at that width. onScale(v): it is a fixed step.
  const judge = (check, entries, ok, onScale, scaleText, noun) => {
    // entries: [{ sel, prop, byW: Map(w -> number) }]
    const fixed = new Map(), fluid = new Map();
    for (const e of entries) {
      const vals = [...new Set(e.byW.values())];
      if (vals.length >= 3) {
        const bad = [...e.byW].filter(([w, v]) => !ok(v, w));
        if (!bad.length) continue;
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
      out.push({ check, severity: 'warning', key: 'fluid|' + sig, count: g.sels.length, widths: sortW(g.bad),
        message: `${what} with the viewport, from ${lo} to ${hi} px across the sweep: ${vals.length} distinct values, ${nf} fractional${system ? `, ${noff} off the ${noun} scale` : ''}. ${noun === 'type' ? 'Declare the range as a fluid step in the system (min, max and the widths between which it scales), or snap it to fixed steps at breakpoints.' : 'Fluid values land between steps at most widths; snap them to the scale at breakpoints, or log the fluid range as an override.'}`,
        elements: g.sels.map((s) => ({ sel: s, label: label(s) })) });
    }
    return { fluidGroups: fluid.size };
  };

  // Spacing
  const sp = system?.spacing?.scale;
  const spEntries = [...obs.spacing].map(([k, byW]) => { const i = k.lastIndexOf('|'); return { sel: k.slice(0, i), prop: k.slice(i + 1), byW }; });
  const spOn = (v) => !sp || sp.some((s) => Math.abs(s - v) < 0.05);
  judge('spacing-scale', spEntries, (v) => !frac(v) && spOn(v), spOn, 'spacing scale', 'spacing');

  // Type sizes. A fixed step matches its size; a fluid step matches the size
  // it declares at that width, within FLUID_TOLERANCE px, fractions included.
  const steps = system?.type?.scale;
  const tyEntries = [...obs.type].map(([sel, byW]) => ({ sel, prop: null, byW: new Map([...byW].map(([w, [fs]]) => [w, fs])) }));
  const stepAt = (fs, w) => steps?.find((x) => (x.fluid ? Math.abs(fluidAt(x.fluid, w) - fs) <= FLUID_TOLERANCE : Math.abs(x.size - fs) < 0.05));
  const tyOn = (v) => !steps || steps.some((x) => x.size && Math.abs(x.size - v) < 0.05);
  judge('type-scale', tyEntries, (v, w) => (steps ? !!stepAt(v, w) && (!frac(v) || !!stepAt(v, w).fluid) : !frac(v)), tyOn, 'type scale', 'type');

  // Line heights of sizes that are steps.
  if (steps) {
    const lh = new Map();
    for (const [sel, byW] of obs.type) {
      for (const [w, [fs, l]] of byW) {
        const st = stepAt(fs, w);
        const want = st && (st.lineHeight ?? fs * st.leading);
        if (!st || (l !== 'normal' && Math.abs(l - want) <= 0.5)) continue;
        const k = `${fs}/${l}`;
        let g = lh.get(k);
        if (!g) lh.set(k, (g = { st, fs, l, want: Math.round(want * 100) / 100, sels: [], ws: [] }));
        if (!g.sels.includes(sel)) g.sels.push(sel);
        g.ws.push(w);
      }
    }
    for (const [k, g] of lh) {
      out.push({ check: 'type-scale', severity: 'warning', key: 'lh|' + k, count: g.sels.length, widths: sortW(g.ws), elements: g.sels.map((s) => ({ sel: s, label: label(s) })),
        message: `Line height ${g.l}${g.l === 'normal' ? '' : ' px'} at ${g.fs} px; the "${g.st.name}" step sets ${g.want} px${g.st.leading && !g.st.lineHeight ? ` (${g.st.leading} × size)` : ''}; on ${plural(g.sels.length, 'text element')}.` });
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
      const g = groups.get(k) || { lo: Math.min(...vals), hi: Math.max(...vals), elements: 0 };
      g.elements++; groups.set(k, g);
    }
    return [...groups.values()].sort((a, b) => a.lo - b.lo);
  };
  distinct.fixed = { fontSizes: fixedVals(tyEntries), spacing: fixedVals(spEntries) };
  distinct.fluid = { fontSizes: ranges(tyEntries), spacing: ranges(spEntries) };
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
    engines: args['no-engines'] ? [] : undefined,
  });
  const s = report.summary;
  console.log(`\n${s.error} errors, ${s.warning} warnings, ${s.info} info. Report: ${join(out, 'report.html')}`);
  const failOn = args['fail-on'];
  if ((failOn === 'error' && s.error) || (failOn === 'warning' && (s.error || s.warning))) process.exit(1);
}
