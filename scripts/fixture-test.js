// Runs the inspector on the fixtures: the test print with planted defects
// (fixtures/index.html) and its clean twin (fixtures/clean.html).
// Passes when every planted defect is caught and the twin reports nothing.
// The pair fixtures/distinct.html and distinct-clean.html is inspected the
// same way without a system file (distinct-value mode).
// Usage: node scripts/fixture-test.js [--full]   (--full: the 41-width sweep instead of four widths)
//        node scripts/fixture-test.js --from <report dir> [--from <report dir>]
//          scores reports the ITTEN action wrote (its summary.json and one
//          folder per page) instead of running the inspector; the self-test
//          workflow uses this to check the action against the fixtures.
// Exports run() for scripts/check.js.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';
import { view, findingsOf } from '../inspector/finding.js';
import { readArgs } from '../inspector/usage.js';
import { exitCode } from '../inspector/usage.js';
import { failing } from '../inspector/baseline.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'fixtures');

const inSection = (issue, id) => issue.elements.some((e) => e.sel === '#' + id || e.sel.startsWith('#' + id + ' '));
// A finding names a defect when it names an element in the defect's section,
// or the file the defect requests (failed requests have no element).
const names = (issue, d) => inSection(issue, d.id) || (!!d.resource && (issue.resources || []).some((u) => new URL(u).pathname.endsWith('/' + d.resource)));

export async function run({ full = false, quiet = true, workers, out = OUT } = {}) {
  const spec = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'defects.json'), 'utf8'));
  const { system, errors } = loadSystem(join(ROOT, spec.system));
  if (errors.length) throw new Error('fixtures/itten.system.json is not valid: ' + errors.join('; '));
  const port = 4175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  const opts = { system, systemPath: spec.system, quiet, full, ...(workers ? { workers } : {}) };
  try {
    const url = (p) => `http://127.0.0.1:${port}/${p}`;
    const page = await inspect(url(spec.page), { ...opts, out: join(out, 'test-print') });
    const twin = await inspect(url(spec.twin), { ...opts, out: join(out, 'clean-twin') });
    // Type and spacing are measured in Chromium only, so the other engines are skipped here.
    const dOpts = { ...opts, system: null, systemPath: null, engines: [] };
    const dPage = await inspect(url(spec.distinct.page), { ...dOpts, out: join(out, 'distinct-test-print') });
    const dTwin = await inspect(url(spec.distinct.twin), { ...dOpts, out: join(out, 'distinct-clean-twin') });
    return { ...score(spec, { page, twin, dPage, dTwin }), reports: { 'test-print': page, 'clean-twin': twin, 'distinct-test-print': dPage, 'distinct-clean-twin': dTwin } };
  } finally {
    server.close();
  }
}

// Reads the reports the action wrote for the four fixture pages.
export function fromAction(dirs) {
  const spec = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'defects.json'), 'utf8'));
  const byPage = new Map();
  for (const d of dirs) {
    const s = JSON.parse(readFileSync(join(resolve(d), 'summary.json'), 'utf8'));
    if (s.problems?.length) throw new Error(`the action run in ${d} did not finish: ${s.problems.join('; ')}`);
    for (const p of s.pages) byPage.set(p.page.replace(/^\//, ''), JSON.parse(readFileSync(join(resolve(d), p.dir, 'report.json'), 'utf8')));
  }
  const get = (p) => { const r = byPage.get(p); if (!r) throw new Error(`no report for ${p} in ${dirs.join(', ')}`); return r; };
  return score(spec, { page: get(spec.page), twin: get(spec.twin), dPage: get(spec.distinct.page), dTwin: get(spec.distinct.twin) });
}

// The moving-background guard. A contrast finding over pixels that changed
// between two frames is exempt from parity, and any change counts, so a page
// that holds still must show none. The distinct pair has nothing that moves:
// no moving tiles at all. The test print and its twin run animations on
// purpose (d32 pulses, d35 flashes): every moving tile must be over one of
// them, none unexplained. Returns what broke that, as sentences.
export function stillGuard({ page, twin, dPage, dTwin }) {
  const out = [];
  for (const [name, r] of [['test print', page], ['clean twin', twin]]) for (const d of r.drawing ?? []) {
    if (d.unexplained === undefined) out.push(`${name}, ${d.at}: moving tiles without a count of the unexplained ones (a report from before the guard)`);
    else if (d.unexplained) out.push(`${name}, ${d.at}: ${d.unexplained} of ${d.tiles} moving tiles are over nothing that should move`);
  }
  for (const [name, r] of [['distinct test print', dPage], ['distinct twin', dTwin]]) for (const d of r.drawing ?? []) out.push(`${name}, ${d.at}: ${d.tiles ?? d.regions.length} moving tiles on a page where nothing moves`);
  return out;
}

// The expected row type, on made-up reports: the controls for score().
// A row on both pages as info is set aside; on one page only, or as a
// warning, it is a problem; and a twin with a warning would not exit 0.
export function expectedTests() {
  const fails = [];
  const spec = { defects: [{ id: 'd01', check: 'overflow' }], expected: [{ id: 'x01', check: 'spacing-scale' }], distinct: { defects: [], expected: [] } };
  const f = (id, check, sec, severity) => ({ id, check, severity, fingerprint: `${check}|#${sec}`, message: 'm', elements: [{ sel: `#${sec} > p`, label: 'p' }], seen: { light: '320' }, crops: [] });
  const rep = (...issues) => ({ status: 'complete', issues, sweep: { resize: null }, distinct: { sweep: null } });
  const none = rep();
  const run = (page, twin) => score(spec, { page, twin, dPage: none, dTwin: none }, { write: false });
  const good = run(rep(f('i1', 'overflow', 'd01', 'error'), f('i2', 'spacing-scale', 'x01', 'info')), rep(f('i1', 'spacing-scale', 'x01', 'info')));
  if (good.problems.length || good.falsePositives.length || good.truePositives !== 1 || good.findingsOnTwin !== 0 || good.recall !== 1 || good.precision !== 1) fails.push(`an expected row on both pages as info is not set aside: ${JSON.stringify({ problems: good.problems, fp: good.falsePositives.length, tp: good.truePositives, twin: good.findingsOnTwin })}`);
  if (!run(rep(f('i1', 'overflow', 'd01', 'error'), f('i2', 'spacing-scale', 'x01', 'info')), none).problems.some((p) => /page only/.test(p))) fails.push('an expected row missing from the twin is not a problem');
  if (!run(rep(f('i1', 'overflow', 'd01', 'error')), rep(f('i1', 'spacing-scale', 'x01', 'info'))).problems.some((p) => /twin only/.test(p))) fails.push('an expected row missing from the page is not a problem');
  const warn = run(rep(f('i1', 'overflow', 'd01', 'error'), f('i2', 'spacing-scale', 'x01', 'warning')), rep(f('i1', 'spacing-scale', 'x01', 'warning')));
  if (!warn.problems.some((p) => /is info/.test(p)) || !warn.problems.some((p) => /would exit 1/.test(p))) fails.push(`an expected row reported as a warning passes: ${JSON.stringify(warn.problems)}`);
  if (run(rep(f('i1', 'overflow', 'd01', 'error')), rep(f('i1', 'radius', 'd09', 'info'))).falsePositives.length !== 1) fails.push('an info finding on the twin that no row expects is not a false positive');
  if (!score(spec, { page: rep(f('i1', 'overflow', 'd01', 'error')), twin: { ...none, status: 'partial' }, dPage: none, dTwin: none }, { write: false }).problems.some((p) => /would exit 3/.test(p))) fails.push('a partial clean twin is taken to exit 0');
  return fails;
}

export function score(spec, { page, twin, dPage, dTwin }, { write = true } = {}) {
  // Every clean twin must exit 0: complete, with nothing that fails a run.
  const problems = [];
  for (const [name, r] of [['the clean twin', twin], ['the distinct clean twin', dTwin]]) {
    const code = exitCode(r.status ?? 'complete', failing(r, 'warning').length);
    if (code !== 0) problems.push(`${name} would exit ${code}, not 0 (${r.status ?? 'complete'}, ${failing(r, 'warning').length} failing)`);
  }
  // finding/1 (or a report from before it), read flat.
  [page, twin, dPage, dTwin] = [page, twin, dPage, dTwin].map((r) => ({ ...r, findings: undefined, issues: findingsOf(r) }));
  // Expected rows: a finding both pages have, as info. Each must be there
  // on the page and on its twin; its findings are then set aside, counted as
  // neither a catch nor a false positive.
  const expected = [];
  for (const [list, a, b, mode] of [[spec.expected ?? [], page, twin, null], [spec.distinct.expected ?? [], dPage, dTwin, 'distinct']]) for (const x of list) {
    const is = (i) => i.check === x.check && names(i, x);
    const onPage = a.issues.filter(is), onTwin = b.issues.filter(is);
    const row = { ...x, ...(mode ? { mode } : {}), onPage: onPage.map((i) => i.id), onTwin: onTwin.map((i) => i.id), severities: [...new Set([...onPage, ...onTwin].map((i) => i.severity))] };
    expected.push(row);
    if (!onPage.length || !onTwin.length) problems.push(`expected row ${x.id} (${x.check}) is reported on ${onPage.length ? 'the page only' : onTwin.length ? 'the twin only' : 'neither page'}; it must be on both`);
    if (row.severities.some((s) => s !== 'info')) problems.push(`expected row ${x.id} (${x.check}) is reported as ${row.severities.join(' and ')}; an expected row is info`);
    a.issues = a.issues.filter((i) => !is(i)); b.issues = b.issues.filter((i) => !is(i));
  }
  const hit = (i, d) => i.check === d.check && names(i, d) && (!d.severity || i.severity === d.severity)
    && (!d.resizeOnly || Object.keys(i.seen).every((m) => /resize/.test(m)));
  const rows = [
    ...spec.defects.map((d) => ({ d, on: page })),
    ...spec.distinct.defects.map((d) => ({ d, on: dPage, mode: 'distinct' })),
  ].map(({ d, on, mode }) => {
    const hits = on.issues.filter((i) => hit(i, d));
    return { ...d, ...(mode ? { mode } : {}), caught: hits.length > 0, issues: hits.map((i) => i.id) };
  });
  const tp = (issues, defects) => issues.filter((i) => defects.some((d) => hit(i, d)));
  const truePos = [...tp(page.issues, spec.defects), ...tp(dPage.issues, spec.distinct.defects)];
  const falsePos = [
    ...page.issues.filter((i) => !spec.defects.some((d) => hit(i, d))), ...twin.issues,
    ...dPage.issues.filter((i) => !spec.distinct.defects.some((d) => hit(i, d))), ...dTwin.issues,
  ];
  // A fluid range counts as one value, as the fixed size that replaces it does.
  const totals = (r) => r.distinct.sweep;
  const sweepEqual = JSON.stringify(totals(dPage)) === JSON.stringify(totals(dTwin));
  const caught = rows.filter((r) => r.caught).length;
  const result = {
    defects: rows.length, caught, missed: rows.filter((r) => !r.caught).map((r) => r.id),
    findingsOnTestPrint: page.issues.length + dPage.issues.length, truePositives: truePos.length,
    falsePositivesOnTestPrint: page.issues.length + dPage.issues.length - truePos.length, findingsOnTwin: twin.issues.length + dTwin.issues.length,
    distinctSweep: { testPrint: totals(dPage), twin: totals(dTwin), equal: sweepEqual },
    // The resize pass must find the fixtures' breakpoints on both pages.
    breakpoints: { expected: spec.breakpoints, testPrint: page.sweep.resize?.breakpoints, twin: twin.sweep.resize?.breakpoints,
      equal: spec.breakpoints === undefined || (page.sweep.resize?.breakpoints === spec.breakpoints && twin.sweep.resize?.breakpoints === spec.breakpoints) },
    still: stillGuard({ page, twin, dPage, dTwin }),
    precision: truePos.length / (truePos.length + falsePos.length || 1),
    recall: caught / rows.length,
    rows, expected, problems,
    falsePositives: falsePos.map((i) => ({ id: i.id, check: i.check, severity: i.severity, message: i.message, elements: i.elements.map((e) => e.sel) })),
  };
  if (write) { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, 'result.json'), JSON.stringify(result, null, 2)); }
  return result;
}

// The engines a set of reports was inspected in, and the ones asked for
// that did not run, each with the reason the report gives. `text` is the
// line a summary ends on, so a run with an engine missing never reads as a
// run with all of them.
export function enginesOf(reports) {
  const ran = new Map(), notRun = new Map();
  for (const r of Object.values(reports ?? {})) {
    for (const [k, v] of Object.entries(r?.engines?.browsers ?? {})) ran.set(k, v);
    for (const [k, v] of Object.entries(r?.engines?.notRun ?? {})) notRun.set(k, v);
  }
  for (const k of notRun.keys()) ran.delete(k);
  const text = `engines run: ${[...ran.keys()].join(', ') || 'none'}${notRun.size ? `; not run: ${[...notRun].map(([k, v]) => `${k}, ${v}`).join('; ')}` : ''}`;
  return { ran: Object.fromEntries(ran), notRun: Object.fromEntries(notRun), text };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  readArgs(process.argv.slice(2), { name: 'fixture-test.js', usage: 'node scripts/fixture-test.js [--full] [--need webkit,firefox] [--from <report dir>]...', flags: { full: 'flag', from: 'list', need: 'value' } });
  const need = process.argv.flatMap((a, i) => (process.argv[i - 1] === '--need' ? a.split(',').map((x) => x.trim()).filter(Boolean) : []));
  const from = process.argv.flatMap((a, i) => (process.argv[i - 1] === '--from' ? [a] : []));
  const r = from.length ? fromAction(from) : await run({ full: process.argv.includes('--full'), quiet: false });
  for (const row of r.rows) console.log(`${row.caught ? 'caught' : 'MISSED'}  ${row.id}  ${row.check.padEnd(18)} ${row.title}  ${row.issues.join(' ')}`);
  for (const f of r.falsePositives) console.log(`false positive  ${f.check}  ${f.message}  [${f.elements.join(', ')}]`);
  const ds = r.distinctSweep;
  if (!ds.equal) console.log(`sweep totals differ without a system: test print ${JSON.stringify(ds.testPrint)}, twin ${JSON.stringify(ds.twin)}`);
  const bp = r.breakpoints;
  for (const s of r.still) console.log(`moving tiles on a still page: ${s}`);
  if (!bp.equal) console.log(`breakpoints found by the resize pass: test print ${bp.testPrint}, twin ${bp.twin}; the fixtures have ${bp.expected}`);
  console.log(`\nRecall ${r.caught}/${r.defects} = ${r.recall.toFixed(2)}. Precision ${r.truePositives}/${r.truePositives + r.falsePositives.length} = ${r.precision.toFixed(2)}. Clean twins: ${r.findingsOnTwin} findings.`);
  // Which engines ran. With --need, one that did not run fails the test (the self-test asks for Firefox this way).
  const eng = enginesOf(r.reports);
  for (const n of need) if (!(n in eng.ran)) r.problems.push(`${n} was needed and did not run${eng.notRun[n] ? `: ${eng.notRun[n]}` : ' (it was not asked for)'}`);
  for (const [k, rep] of Object.entries(r.reports ?? {})) for (const d of rep?.engines?.differences ?? []) console.log(`engine difference  ${k}  ${typeof d === 'string' ? d : JSON.stringify(d)}`);
  for (const p of r.problems) console.log(`FAIL  ${p}`);
  console.log(`Engines: ${eng.text.replace(/^engines run: /, 'run: ')}${Object.keys(eng.ran).length ? ` (${Object.entries(eng.ran).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}.`);
  if (r.expected.length) console.log(`Expected on both pages, as info, and set aside: ${r.expected.map((x) => `${x.id} ${x.check}`).join(', ')}.`);
  process.exit(r.recall === 1 && r.falsePositives.length === 0 && ds.equal && bp.equal && !r.still.length && !r.problems.length ? 0 : 1);
}
