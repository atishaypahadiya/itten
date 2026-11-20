// Mutation testing of the inspector and the fixer (ROADMAP 0.5).
//
// A clean page is made of slots, one small piece of markup with one CSS rule
// each. A mutant is one slot with one defect put in at random: which value,
// which side, and at which widths it shows (everywhere, below 500 px, or
// from 1200 px). The page is inspected; a mutant is caught when a finding of
// its operator's check names an element inside its slot. Recall is reported
// per check. Everything random comes from the seed, so a run can be made
// again.
//
// - A finding outside every mutated slot is a false positive. A finding of
//   another check inside a mutated slot is a side finding, listed apart.
// - Controls: the same page with no mutation must report nothing, and a
//   mutant that changes nothing (the "identity" operator) must be reported
//   as missed; without either, a recall of 1.00 would say nothing.
// - A missed mutant is written as a page of its own, with what was planted,
//   to <out>/missed/ (and to fixtures/mutation/missed/ with --keep).
// - With --fix: a page of mutants of the fixable classes is given to itten
//   fix and inspected again; a mutant is fixed when no finding names its
//   slot any more.
// - fixtures/mutation/floors.json, when it exists, holds the lowest recall
//   allowed per check; a run below it fails.
//
// Usage: node scripts/mutation-test.js [--pages 1] [--slots 1] [--seed 1] [--fix] [--keep] [--out dist/mutation]
//   --pages × --slots is the number of mutants per check.
// Exports run() and sample() for scripts/check.js.

import { join, dirname } from 'node:path';
import { mkdtempSync, mkdirSync, cpSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';
import { findingsOf, view } from '../inspector/finding.js';
import { fix, stepsWithin } from '../inspector/fix.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT = join(ROOT, 'library', 'assets', 'fonts', 'atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-wght-normal.woff2');
const FLOORS = join(ROOT, 'fixtures', 'mutation', 'floors.json');

// A small seeded generator (mulberry32), so a seed names a run.
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, pick: (list) => list[Math.floor(next() * list.length)] };
}

const SPACING = [4, 8, 12, 16, 24, 32, 40, 48, 64, 96], SIZES = [14, 16, 24, 64];
// A size has one right answer when one step is within 1 px and that step
// keeps the slot's 24 px line height (16 px). Moved to 14 px, the text would
// hold a line height off its step, and itten fix reverts, as it should.
const fixableSize = (v) => { const w = stepsWithin(SIZES, v, 1); return w.length === 1 && w[0] === 16 ? 'to-step' : null; };
const rem = (px) => `${Number((px / 16).toFixed(4))}rem`;
const WIDTHS = [null, '(max-width: 500px)', '(min-width: 1200px)'];
const at = (media, css) => (media ? `@media ${media} { ${css} }` : css);

// Each operator: the check that must catch it, a slot's clean markup and
// rule, and mutate(), which returns the defect: css to add after the clean
// rule (or `clean`, css in its place, or markup in place of the slot's), what it is in words, and whether
// itten fix has one right answer for it.
export const OPERATORS = [
  { id: 'spacing-off-scale', check: 'spacing-scale',
    markup: () => '<div class="box">A padded box</div>',
    clean: (S) => `${S} .box { padding: 1rem; background: var(--tint); }`,
    mutate: (r, S) => {
      let v; do { v = r.pick([8, 12, 16, 24, 32]) + r.pick([-3, -2, -1, 1, 2, 3]); } while (SPACING.includes(v));
      const side = r.pick(['padding', 'padding-top', 'padding-left', 'margin-top']), media = r.pick(WIDTHS);
      return { css: at(media, `${S} .box { ${side}: ${rem(v)}; }`), media, what: `${side}: ${v} px, off the spacing scale`, fixable: stepsWithin(SPACING, v, 1).length === 1 ? 'to-step' : null };
    } },
  { id: 'spacing-in-px', check: 'spacing-unit',
    markup: () => '<div class="box">A padded box</div>',
    clean: (S) => `${S} .box { padding: 1rem; background: var(--tint); }`,
    mutate: (r, S) => { const v = r.pick([8, 12, 24, 32]), side = r.pick(['padding', 'padding-top', 'padding-left']); return { css: `${S} .box { ${side}: ${v}px; }`, media: null, what: `${side}: ${v}px, a step of the scale set in px`, fixable: 'px-to-rem' }; } },
  { id: 'size-off-scale', check: 'type-scale',
    markup: () => '<p class="t">A line of text set at a step of the scale.</p>',
    clean: (S) => `${S} .t { font-size: 1rem; line-height: 1.5rem; }`,
    mutate: (r, S) => {
      const v = r.pick([13, 15, 15.3, 16.5, 17, 18, 19, 20.5, 22]), media = r.pick(WIDTHS);
      return { css: at(media, `${S} .t { font-size: ${rem(v)}; }`), media, what: `font-size: ${v} px, off the type scale`, fixable: fixableSize(v) };
    } },
  { id: 'size-in-px', check: 'text-resize',
    markup: () => '<p class="t">A line of text set at a step of the scale.</p>',
    clean: (S) => `${S} .t { font-size: 1rem; line-height: 1.5rem; }`,
    mutate: (r, S) => ({ css: `${S} .t { font-size: 16px; }`, media: null, what: 'font-size: 16px, a step of the scale set in px', fixable: 'px-to-rem' }) },
  { id: 'radius-off-set', check: 'radius',
    markup: () => '<div class="box">A rounded box</div>',
    clean: (S) => `${S} .box { padding: 1rem; background: var(--tint); border-radius: 0.25rem; }`,
    mutate: (r, S) => { const v = r.pick([2, 3, 6, 7, 8, 10]), media = r.pick(WIDTHS); return { css: at(media, `${S} .box { border-radius: ${v}px; }`), media, what: `border-radius: ${v} px, not in the set (4, 12)`, fixable: null }; } },
  { id: 'low-contrast', check: 'contrast',
    markup: () => '<p class="t">Text that has to be readable against its ground.</p>',
    clean: (S) => `${S} .t { font-size: 1rem; line-height: 1.5rem; }`,
    mutate: (r, S) => { const g = r.pick(['999999', 'A0A0A0', 'AAAAAA', 'B4B4B4', 'C0C0C0']), media = r.pick(WIDTHS); return { css: at(media, `${S} .t { color: #${g}; }`), media, what: `color: #${g} on the light ground, under 4.5:1`, fixable: null }; } },
  { id: 'clipped-box', check: 'clipping',
    markup: () => '<div class="fixed"><p>A first line of text<br>and a second line under it.</p></div>',
    clean: (S) => `${S} .fixed { min-height: 2.5rem; background: var(--tint); }`,
    mutate: (r, S) => { const h = r.pick([20, 24, 32, 40]), media = r.pick(WIDTHS); return { css: at(media, `${S} .fixed { height: ${h}px; overflow: hidden; }`), media, what: `height: ${h}px with overflow: hidden, over two lines of text (48 px)`, fixable: null }; } },
  { id: 'wide-box', check: 'overflow',
    markup: () => '<div class="banner">A banner</div>',
    clean: (S) => `${S} .banner { max-width: 100%; padding: 1rem; background: var(--tint); }`,
    mutate: (r, S) => { const w = r.pick([900, 1200, 2400]), media = r.pick([null, '(max-width: 500px)']); return { css: at(media, `${S} .banner { min-width: ${w}px; }`), media, what: `min-width: ${w}px, wider than the page at 320 px`, fixable: null }; } },
  { id: 'animated-layout', check: 'motion-layout',
    markup: () => '<div class="grow"></div>',
    clean: (S) => `${S} .grow { width: 10rem; max-width: 100%; height: 1.5rem; background: var(--tint); }`,
    mutate: (r, S) => { const p = r.pick(['width', 'height', 'margin-left']); return { css: `${S} .grow { animation: m-${p} 1000ms linear infinite alternate; }\n@media (prefers-reduced-motion: reduce) { ${S} .grow { animation: none; } }`, media: null, what: `an animation of ${p}`, fixable: null }; } },
  { id: 'motion-unguarded', check: 'reduced-motion',
    markup: () => '<div class="pulse"></div>',
    clean: (S) => `${S} .pulse { width: 6rem; height: 1.5rem; background: var(--tint); animation: m-pulse 1000ms linear infinite alternate; }\n@media (prefers-reduced-motion: reduce) { ${S} .pulse { animation: none; } }`,
    // The mutant is the slot's rule without its guard: a rule taken away, not one added.
    mutate: (r, S) => ({ clean: `${S} .pulse { width: 6rem; height: 1.5rem; background: var(--tint); animation: m-pulse 1000ms linear infinite alternate; }`, media: null, what: 'an animation with no rule for prefers-reduced-motion: reduce', fixable: 'reduced-motion' }) },
  { id: 'small-target', check: 'target-size',
    markup: () => '<button type="button" class="tap" aria-label="Open">+</button>',
    clean: (S) => `${S} .tap { width: 2.75rem; height: 2.75rem; }`,
    mutate: (r, S) => { const v = r.pick([16, 18, 20, 22]), media = r.pick(WIDTHS); return { css: at(media, `${S} .tap { width: ${v}px; height: ${v}px; }`), media, what: `a ${v} px button, under the 24 px minimum`, fixable: null }; } },
  { id: 'separator-line-start', check: 'line-start',
    markup: () => '<p class="small byline"><span class="whole">Ada Lovelace</span>&nbsp;· 1843</p>',
    clean: () => '',
    mutate: (r) => { const n = r.pick(['Ada Lovelace', 'Bouvard', 'Le Verrier']), y = r.pick(['1843', '1821', 'notes A to G']); return { markup: `<p class="small byline"><span class="whole">${n}</span> · ${y}</p>`, media: null, what: 'an ordinary space before "·", in a box as wide as its first item', fixable: 'nbsp-separator' }; } },
];
// The control: a mutant that changes nothing. It must be reported missed.
export const IDENTITY = { id: 'identity', check: 'spacing-scale',
  markup: () => '<div class="box">A padded box</div>',
  clean: (S) => `${S} .box { padding: 1rem; background: var(--tint); }`,
  mutate: (r, S) => ({ css: `${S} .box { padding: 1rem; }`, media: null, what: 'nothing: the same value again', fixable: null }) };

const BASE = `/* Shared by every slot; every value from fixtures/itten.system.json. */
button { font: inherit; color: inherit; border: 0; padding: 0; background: var(--tint); border-radius: 0.25rem; }
.small { font-size: 0.875rem; line-height: 1.25rem; }
.byline { width: min-content; }
.byline .whole { white-space: nowrap; }
@keyframes m-pulse { to { opacity: 0.6; } }
@keyframes m-width { to { width: 12rem; } }
@keyframes m-height { to { height: 2rem; } }
@keyframes m-margin-left { to { margin-left: 2rem; } }
`;

// One page: `slots` slots per operator. only(op, k) says which are mutated
// (all by default). Returns the files and the mutants.
export function makePage(seed, { slots = 1, operators = OPERATORS, mutated = () => true, title = 'Mutants' } = {}) {
  const r = rng(seed);
  const mutants = [], html = [], css = [BASE];
  for (const op of operators) for (let k = 1; k <= slots; k++) {
    const slot = `m-${op.id}-${k}`, S = `#${slot}`;
    const m = op.mutate(r, S);   // drawn whether or not it is used, so a seed gives the same mutants on every page made from it
    const on = mutated(op, k);
    html.push(`  <section id="${slot}">\n    ${on && m.markup ? m.markup : op.markup()}\n  </section>`);
    const own = on && m.clean !== undefined ? `/* mutant ${slot}: ${m.what} */\n${m.clean}` : op.clean(S);
    if (own) css.push(own);
    if (on) { if (m.css) css.push(`/* mutant ${slot}: ${m.what} */\n${m.css}`); mutants.push({ id: `${seed}-${slot}`, slot, operator: op.id, check: op.check, what: m.what, media: m.media ?? null, fixable: m.fixable ?? null, ...(m.css ? { css: m.css } : m.clean !== undefined ? { css: m.clean } : { markup: m.markup }) }); }
  }
  const page = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<link rel="stylesheet" href="../base.css">\n<link rel="stylesheet" href="m.css">\n</head>\n<body>\n<main>\n  <h1>${title}</h1>\n${html.join('\n')}\n</main>\n</body>\n</html>\n`;
  return { files: { 'index.html': page, 'm.css': css.join('\n') + '\n' }, mutants };
}

// Which mutants a report caught, and what else it found.
export function score(mutants, report) {
  const all = findingsOf(report).map(view);
  const inSlot = (f, slot) => (f.elements ?? []).some((e) => e.sel === `#${slot}` || e.sel.startsWith(`#${slot} `));
  const rows = mutants.map((m) => ({ ...m, caught: all.some((f) => f.check === m.check && inSlot(f, m.slot)) }));
  const side = [], falsePositives = [];
  for (const f of all) {
    const own = mutants.filter((m) => inSlot(f, m.slot));
    if (!own.length) falsePositives.push({ check: f.check, severity: f.severity, message: f.message, elements: (f.elements ?? []).map((e) => e.sel) });
    else if (!own.some((m) => m.check === f.check)) side.push({ check: f.check, severity: f.severity, in: own.map((m) => m.slot), message: f.message });
  }
  return { rows, side, falsePositives };
}

export async function run({ pages = 1, slots = 1, seed = 1, fixer = false, keep = false, out = join(ROOT, 'dist', 'mutation'), quiet = true, say = () => {} } = {}) {
  const fails = [];
  const { system, errors } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  if (errors.length) return { fails: [`fixtures/itten.system.json is not valid: ${errors.join('; ')}`] };
  const work = mkdtempSync(join(tmpdir(), 'itten-mutation-'));
  const site = join(work, 'site');
  mkdirSync(join(site, 'fonts'), { recursive: true });
  cpSync(join(ROOT, 'fixtures', 'fix', 'base.css'), join(site, 'base.css'));
  cpSync(FONT, join(site, 'fonts', 'atkinson-hyperlegible-next-latin-wght-normal.woff2'));
  const put = (name, files) => { mkdirSync(join(site, name), { recursive: true }); for (const [f, text] of Object.entries(files)) writeFileSync(join(site, name, f), text); };
  const port = 5775 + Math.floor(Math.random() * 200);
  const server = await start(port, site);
  const go = (name) => inspect(`http://127.0.0.1:${port}/${name}/index.html`, { system, systemPath: 'fixtures/itten.system.json', out: join(out, 'reports', name), engines: [], quiet, timings: false });
  const result = { tool: 'itten-mutation', seed, pages, slots, started: new Date().toISOString(), perCheck: {}, mutants: 0, caught: 0, missed: [], side: [], falsePositives: [], controls: {} };
  try {
    // Controls first: nothing planted, nothing found; an identity mutant, missed.
    put('clean', makePage(seed, { slots, mutated: () => false, title: 'No mutants' }).files);
    const clean = await go('clean');
    result.controls.clean = { status: clean.status, findings: findingsOf(clean).length };
    if (clean.status !== 'complete') fails.push(`control: the clean page's run is ${clean.status} (${clean.reason})`);
    for (const f of findingsOf(clean).map(view)) fails.push(`control: the clean page reports ${f.check} on ${(f.elements ?? []).map((e) => e.sel).join(', ') || 'the page'} (${f.message.split('. ')[0]})`);
    const idPage = makePage(seed, { slots: 1, operators: [IDENTITY], title: 'An identity mutant' });
    put('identity', idPage.files);
    const idScore = score(idPage.mutants, await go('identity'));
    result.controls.identity = { caught: idScore.rows.filter((x) => x.caught).length };
    if (idScore.rows.some((x) => x.caught)) fails.push('control: a mutant that changes nothing is counted as caught');

    for (let p = 0; p < pages; p++) {
      const name = `page-${seed + p}`;
      const made = makePage(seed + p, { slots });
      put(name, made.files);
      const report = await go(name);
      if (report.status !== 'complete') fails.push(`${name}: the run is ${report.status} (${report.reason})`);
      const s = score(made.mutants, report);
      for (const row of s.rows) {
        const c = (result.perCheck[row.check] ??= { mutants: 0, caught: 0, missed: [] });
        c.mutants++; result.mutants++;
        if (row.caught) { c.caught++; result.caught++; continue; }
        c.missed.push(row.id);
        result.missed.push({ id: row.id, operator: row.operator, check: row.check, what: row.what, media: row.media, ...(row.css ? { css: row.css } : { markup: row.markup }) });
        // The missed mutant alone on a page, as a fixture to be.
        const op = OPERATORS.find((o) => o.id === row.operator), k = Number(row.slot.split('-').at(-1));
        const alone = makePage(seed + p, { slots, mutated: (o, kk) => o === op && kk === k, title: `Missed: ${row.what}` });
        for (const dir of [join(out, 'missed', row.id), ...(keep ? [join(ROOT, 'fixtures', 'mutation', 'missed', row.id)] : [])]) {
          mkdirSync(dir, { recursive: true });
          for (const [f, text] of Object.entries(alone.files)) writeFileSync(join(dir, f), text);
          writeFileSync(join(dir, 'mutant.json'), JSON.stringify({ ...row, caught: undefined, note: 'Served beside fixtures/fix/base.css; inspected with fixtures/itten.system.json.' }, null, 2) + '\n');
        }
      }
      result.side.push(...s.side.map((x) => ({ page: name, ...x })));
      result.falsePositives.push(...s.falsePositives.map((x) => ({ page: name, ...x })));
      say(`${name}: ${s.rows.filter((x) => x.caught).length}/${s.rows.length} caught${s.falsePositives.length ? `, ${s.falsePositives.length} false positive(s)` : ''}`);
    }
    for (const c of Object.values(result.perCheck)) c.recall = c.mutants ? c.caught / c.mutants : null;
    for (const f of result.falsePositives) fails.push(`${f.page}: a finding outside every mutated slot: ${f.check} on ${f.elements.join(', ') || 'the page'} (${f.message.split('. ')[0]})`);
    if (existsSync(FLOORS)) {
      const floors = JSON.parse(readFileSync(FLOORS, 'utf8')).floors ?? {};
      for (const [check, c] of Object.entries(result.perCheck)) if (floors[check] !== undefined && c.recall < floors[check]) fails.push(`${check}: recall ${c.recall.toFixed(2)} on ${c.mutants} mutants is under its floor, ${floors[check]}`);
    }

    if (fixer) {
      // The fixable classes: every such mutant on one page, fixed, inspected again.
      execFileSync('git', ['-C', site, 'init', '-q']);
      result.fixer = { perClass: {}, mutants: 0, clean: 0, left: [] };
      for (let p = 0; p < pages; p++) {
        const name = `fix-${seed + p}`;
        const probe = makePage(seed + p, { slots });
        const fixable = new Set(probe.mutants.filter((m) => m.fixable).map((m) => m.slot));
        const made = makePage(seed + p, { slots, mutated: (op, k) => fixable.has(`m-${op.id}-${k}`), title: 'Fixable mutants' });
        put(name, made.files);
        const url = `http://127.0.0.1:${port}/${name}/index.html`;
        const fixed = await fix(url, { root: site, system, systemPath: 'fixtures/itten.system.json', out: join(out, 'fix', name), engines: [], quiet: true });
        const after = await go(`${name}`);
        const s = score(made.mutants, after);
        const all = findingsOf(after).map(view);
        for (const m of made.mutants) {
          const c = (result.fixer.perClass[m.fixable] ??= { mutants: 0, clean: 0, left: [] });
          const left = all.filter((f) => (f.elements ?? []).some((e) => e.sel === `#${m.slot}` || e.sel.startsWith(`#${m.slot} `)));
          c.mutants++; result.fixer.mutants++;
          if (!left.length) { c.clean++; result.fixer.clean++; continue; }
          const plan = fixed.fixes.filter((x) => left.some((f) => f.check === x.finding.check)).map((x) => `${x.class} ${x.status}${x.reason ? `: ${x.reason}` : x.note ? `: ${x.note}` : ''}`);
          const entry = { id: m.id, class: m.fixable, what: m.what, left: left.map((f) => f.check), fixes: plan };
          c.left.push(m.id); result.fixer.left.push(entry);
        }
        say(`${name}: ${made.mutants.length - s.rows.filter((x) => x.caught).length}/${made.mutants.length} fixable mutants no longer caught after itten fix`);
      }
    }
  } finally {
    server.close();
    rmSync(work, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });
  result.fails = fails;
  writeFileSync(join(out, 'mutation.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

// What the check runs: one page, one slot per operator, a fixed seed.
export async function sample() {
  const r = await run({ pages: 1, slots: 1, seed: 1, out: join(ROOT, 'dist', 'mutation-sample') });
  return r;
}

export function table(r) {
  const lines = ['| Check | Mutants | Caught | Recall |', '|---|---|---|---|'];
  for (const [check, c] of Object.entries(r.perCheck).sort()) lines.push(`| ${check} | ${c.mutants} | ${c.caught} | ${c.recall.toFixed(2)} |`);
  lines.push(`| all | ${r.mutants} | ${r.caught} | ${(r.caught / (r.mutants || 1)).toFixed(2)} |`);
  if (r.fixer) { lines.push('', '| Fix class | Mutants | Clean after itten fix |', '|---|---|---|'); for (const [k, c] of Object.entries(r.fixer.perClass).sort()) lines.push(`| ${k} | ${c.mutants} | ${c.clean} |`); }
  return lines.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = readArgs(process.argv.slice(2), { name: 'mutation-test.js', usage: 'node scripts/mutation-test.js [--pages 1] [--slots 1] [--seed 1] [--fix] [--keep] [--out dist/mutation]', flags: { pages: 'value', slots: 'value', seed: 'value', fix: 'flag', keep: 'flag', out: 'value' } });
  const n = (v, d) => (v === undefined ? d : Number(v));
  const r = await run({ pages: n(a.pages, 1), slots: n(a.slots, 1), seed: n(a.seed, 1), fixer: !!a.fix, keep: !!a.keep, ...(a.out ? { out: a.out } : {}), say: (m) => console.log(m) });
  console.log(table(r));
  for (const m of r.missed) console.log(`missed  ${m.id}: ${m.what}${m.media ? `, ${m.media}` : ''}`);
  for (const m of r.fixer?.left ?? []) console.log(`not fixed  ${m.id} (${m.class}): ${m.what}; still ${m.left.join(', ')}; ${m.fixes.join(' | ') || 'no fix planned'}`);
  for (const f of r.fails) console.log(`FAIL  ${f}`);
  console.log(r.fails.length ? `${r.fails.length} failure(s).` : `Seed ${r.seed}: ${r.caught} of ${r.mutants} mutants caught; the controls hold.`);
  process.exit(r.fails.length ? 1 : 0);
}
