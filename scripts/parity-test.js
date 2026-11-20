// Parity: the inspector must find the same things however many workers run
// its jobs. Inspects the same pages twice, once on one worker and once on
// several, and compares every finding field by field: fingerprint, id,
// check, severity, message, count, elements (selector, label, order and
// box), where it was seen, where it was first seen, its resizes and its
// crops (how many, at which pass, which region). Any difference fails.
//
// Usage:
//   node scripts/parity-test.js [--workers 6] [--full]
//       the fixtures (test print, clean twin and the distinct-value pair)
//   node scripts/parity-test.js --url <url> [--url <url>] [--system file] [--workers 6] [--full] [--out dir]
//       any pages, read only: nothing is written outside --out
//   node scripts/parity-test.js --saved <dir>
//       compares the reports an earlier run saved in <dir> (serial/ against workers-N/), without inspecting again
// Exports compare() and run() for scripts/check.js.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect, loadSystem, phaseOverlaps, measuredFields } from '../inspector/inspect.js';
import { view, findingsOf } from '../inspector/finding.js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { duration } from '../inspector/timings.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// What must match, per finding.
const shape = (i) => ({
  fingerprint: i.fingerprint, check: i.check, severity: i.severity, message: i.message, count: i.count, measured: i.measured ?? null,
  movingBackground: i.movingBackground ?? false,
  frames: i.frames ?? null,
  unreliable: i.timing?.reliable === false,
  elements: i.elements.map((e) => ({ sel: e.sel, label: e.label, order: e.order ?? null, rect: e.rect ?? null })),
  seen: i.seen, first: i.first, resize: i.resize ?? null, resources: i.resources ?? null,
  crops: i.crops.map((c) => ({ at: c.at, region: c.region, zoom: c.zoom, engine: c.engine ?? null })),
});

// Findings are matched by fingerprint; the report's ids (i001, ...) follow
// the order findings were first seen in and are not compared. Nor is an
// element's `text`, its opening words, kept for the reader only: shape()
// leaves it out.
//
// Three kinds of value differ between any two runs, serial or not:
// - the port of a local server (each run starts its own);
// - a finding's measured fields (its `measured` marker, from
//   inspector/inspect.js: frame counts, durations, settle windows, benchmark
//   figures, the boxes the motion checks take while the page moves; "message"
//   means the numbers in its message), and the glyph counts in renderedFonts;
// - every field of a finding over a moving background (`movingBackground`,
//   from the contrast pass), including whether it is there at all: its value
//   depends on the frame. 0.4 judges these across fixed frames.
// - every field of a timing finding reported as unreliable in either run
//   (`timing.reliable` false: a loaded machine, a software renderer, fewer
//   than three measurements or too wide a spread), including whether it is
//   there at all;
// These are returned in notes, with both values. Everything else must match
// exactly, including every finding that is not over a moving background on
// the same page.
const PORT = /(127\.0\.0\.1|localhost):\d+/g;
const steady = (f, v, measured) => {
  if (f === 'elements' && measured.includes('elements.rect')) v = v.map(({ rect, ...e }) => e);
  let s = JSON.stringify(v).replace(PORT, '$1:<port>');
  // "97 ms each" and "83 to 97 ms" are the same sentence with other numbers.
  if (f === 'message' && measured.includes('message')) s = s.replace(/\d+(\.\d+)? to \d+(\.\d+)? ms|\d+(\.\d+)? ms each/g, '<n> ms').replace(/\d+(\.\d+)?/g, '<n>');
  if (f !== 'message' && measured.includes(f)) s = '<measured>';
  return s;
};
// A finding over a moving background that was judged across the fixed frames
// (it has `frames`) is the same every run, and must match like any other.
const loose = (i) => (i.movingBackground && !i.frames) || i.unreliable || i.timing?.reliable === false;
const why = (i) => (i.movingBackground && !i.frames ? MOVING : UNRELIABLE);
const UNRELIABLE = ' (timing unreliable)';
const MOVING = ' (over a moving background)', MEASURED = ' (measured)', PORTS = ' (a server port)';
const glyphless = (v) => JSON.stringify(v ?? null).replace(/: \d+ glyphs/g, ': <n> glyphs');
// The summary counted without the findings over a moving background.
// `skip` holds the fingerprints loose in either run: a timing finding can be
// unreliable (info) in one run and counted (a warning) in the other.
const steadySummary = (r, skip = new Set()) => {
  const by = {};
  for (const i of findingsOf(r)) if (!loose(i) && !skip.has(i.fingerprint)) { const c = (by[i.check] ??= {}); c[i.severity] = (c[i.severity] ?? 0) + 1; }
  return JSON.stringify(Object.keys(by).sort().map((k) => [k, by[k]]));
};

// The differences between two reports of the same page, as sentences.
export function compare(a, b, name = 'page', notes = []) {
  const diffs = [];
  // Either shape: finding/1, or a report saved before it (view() reads both).
  const A = new Map(findingsOf(a).map((i) => [i.fingerprint, shape(i)]));
  const B = new Map(findingsOf(b).map((i) => [i.fingerprint, shape(i)]));
  for (const [k, x] of A) {
    const y = B.get(k);
    if (!y) { (loose(x) ? notes : diffs).push(`${name}: ${k} (${x.severity}) only in the first run${loose(x) ? why(x) : ''}`); continue; }
    const moving = loose(x) || loose(y);
    for (const f of Object.keys(x)) {
      const s = JSON.stringify(x[f]), t = JSON.stringify(y[f]);
      if (s === t) continue;
      const line = `${name}: ${k}: ${f} differs: ${s.slice(0, 240)} against ${t.slice(0, 240)}`;
      const m = x.measured ?? measuredFields(x) ?? [];
      if (moving) notes.push(line + (x.movingBackground || y.movingBackground ? MOVING : UNRELIABLE));
      else if (steady(f, x[f], m) === steady(f, y[f], m)) notes.push(line + (steady(f, x[f], []) === steady(f, y[f], []) ? PORTS : MEASURED));
      else diffs.push(line);
    }
  }
  for (const [k, y] of B) if (!A.has(k)) (loose(y) ? notes : diffs).push(`${name}: ${k} (${y.severity}) only in the second run${loose(y) ? why(y) : ''}`);
  for (const f of ['summary', 'distinct', 'textScaling', 'renderedFonts', 'pageErrors']) {
    const s = JSON.stringify(a[f]), t = JSON.stringify(b[f]);
    if (s === t) continue;
    const line = `${name}: report.${f} differs: ${s.slice(0, 240)} against ${t.slice(0, 240)}`;
    const skip = new Set([...findingsOf(a), ...findingsOf(b)].filter(loose).map((i) => i.fingerprint));
    if (f === 'summary' && steadySummary(a, skip) === steadySummary(b, skip)) notes.push(line + ' (findings over a moving background, or with unreliable timing)');
    else if (f === 'renderedFonts' && glyphless(a[f]) === glyphless(b[f])) notes.push(line + MEASURED);
    else diffs.push(line);
  }
  const sw = (r) => JSON.stringify({ widths: r.sweep.widths, engines: r.sweep.engines, resize: r.sweep.resize, breakpoints: r.sweep.breakpoints });
  if (sw(a) !== sw(b)) diffs.push(`${name}: the sweeps differ: ${sw(a)} against ${sw(b)}`);
  return diffs;
}

// Runs fn(workers, label) for 1 and for n workers, compares the reports
// page by page, and times both.
export async function run({ n = 6, pages }) {
  const t1 = Date.now();
  const serial = await pages(1, 'serial');
  const s1 = (Date.now() - t1) / 1000;
  const t2 = Date.now();
  const parallel = await pages(n, `workers-${n}`);
  const s2 = (Date.now() - t2) / 1000;
  const diffs = [], notes = [];
  for (const name of Object.keys(serial)) diffs.push(...compare(serial[name], parallel[name], name, notes));
  for (const [label, reps] of [['one worker', serial], [`${n} workers`, parallel]]) for (const [name, rep] of Object.entries(reps)) for (const x of phaseOverlaps(rep.schedule.phases)) diffs.push(`${name}, ${label}: ${x}`);
  const findings = Object.values(serial).reduce((x, r) => x + findingsOf(r).length, 0);
  return { diffs, notes, findings, pages: Object.keys(serial).length, seconds: { serial: s1, parallel: s2 }, workers: n, serial, parallel };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  readArgs(argv, { name: 'parity-test.js', usage: 'node scripts/parity-test.js [--url <url>]... [--workers 6] [--full] [--saved <dir>]', flags: { url: 'list', workers: 'value', full: 'flag', saved: 'value' } });
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const urls = argv.flatMap((a, i) => (argv[i - 1] === '--url' ? [a] : []));
  const n = Number(opt('--workers') ?? 6), full = argv.includes('--full');
  if (opt('--saved')) {
    const dir = resolve(opt('--saved'));
    const other = readdirSync(dir).find((d) => /^workers-\d+$/.test(d));
    if (!existsSync(join(dir, 'serial')) || !other) { console.error(`${dir} holds no serial/ and workers-N/ reports`); process.exit(2); }
    const diffs = [], notes = [];
    const names = readdirSync(join(dir, 'serial')).filter((p) => existsSync(join(dir, 'serial', p, 'report.json'))).sort();
    for (const name of names) {
      const a = JSON.parse(readFileSync(join(dir, 'serial', name, 'report.json'), 'utf8'));
      const b = JSON.parse(readFileSync(join(dir, other, name, 'report.json'), 'utf8'));
      diffs.push(...compare(a, b, name, notes));
    }
    for (const d of notes) console.log(`NOTE  ${d}`);
    for (const d of diffs) console.log(`DIFF  ${d}`);
    console.log(`\nSaved reports in ${dir}: ${names.length} pages, serial against ${other}. ${diffs.length ? `${diffs.length} difference(s): FAIL.` : 'Identical apart from measured values and findings over a moving background: passes.'}`);
    process.exit(diffs.length ? 1 : 0);
  }
  const out = resolve(opt('--out') ?? join(ROOT, 'dist', 'parity'));
  let pages;
  if (urls.length) {
    const sys = opt('--system');
    const system = sys ? loadSystem(sys) : null;
    if (system?.errors.length) { console.error(`${sys} is not valid: ${system.errors.join('; ')}`); process.exit(2); }
    pages = async (w, label) => {
      const reps = {};
      for (const [k, u] of urls.entries()) {
        const name = `${k + 1}-${new URL(u).pathname.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'index'}`;
        reps[name] = await inspect(u, { system: system?.system ?? null, systemPath: sys ?? null, full, workers: w, quiet: true, out: join(out, label, name) });
        console.log(`  ${label}: ${u}, ${findingsOf(reps[name]).length} findings, ${duration(reps[name].schedule.seconds.total)}`);
      }
      return reps;
    };
  } else {
    const { run: fixtures } = await import('./fixture-test.js');
    pages = async (w, label) => {
      const t = Date.now();
      const r = await fixtures({ full, workers: w, out: join(out, label) });
      console.log(`  ${label}: recall ${r.caught}/${r.defects}, precision ${r.truePositives}/${r.truePositives + r.falsePositives.length}, clean twins ${r.findingsOnTwin}, ${duration((Date.now() - t) / 1000)}`);
      return r.reports;
    };
  }
  console.log(`Parity, ${full ? 'full' : 'quick'} sweep: one worker, then ${n}.`);
  const r = await run({ n, pages });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'parity.json'), JSON.stringify({ workers: n, full, seconds: r.seconds, findings: r.findings, diffs: r.diffs, notes: r.notes }, null, 2));
  for (const d of r.notes) console.log(`NOTE  ${d}`);
  for (const d of r.diffs) console.log(`DIFF  ${d}`);
  console.log(`\n${r.pages} pages, ${r.findings} findings. One worker ${duration(r.seconds.serial)}, ${n} workers ${duration(r.seconds.parallel)} (${(r.seconds.serial / r.seconds.parallel).toFixed(1)}x). ${r.diffs.length ? `${r.diffs.length} difference(s): FAIL.` : 'Identical: passes.'}`);
  process.exit(r.diffs.length ? 1 : 0);
}
