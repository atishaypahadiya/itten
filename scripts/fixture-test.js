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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'fixtures');

const inSection = (issue, id) => issue.elements.some((e) => e.sel === '#' + id || e.sel.startsWith('#' + id + ' '));
// A finding names a defect when it names an element in the defect's section,
// or the file the defect requests (failed requests have no element).
const names = (issue, d) => inSection(issue, d.id) || (!!d.resource && (issue.resources || []).some((u) => new URL(u).pathname.endsWith('/' + d.resource)));

export async function run({ full = false, quiet = true } = {}) {
  const spec = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'defects.json'), 'utf8'));
  const { system, errors } = loadSystem(join(ROOT, spec.system));
  if (errors.length) throw new Error('fixtures/itten.system.json is not valid: ' + errors.join('; '));
  const port = 4175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  const opts = { system, systemPath: spec.system, quiet, full };
  try {
    const url = (p) => `http://127.0.0.1:${port}/${p}`;
    const page = await inspect(url(spec.page), { ...opts, out: join(OUT, 'test-print') });
    const twin = await inspect(url(spec.twin), { ...opts, out: join(OUT, 'clean-twin') });
    // Type and spacing are measured in Chromium only, so the other engines are skipped here.
    const dOpts = { ...opts, system: null, systemPath: null, engines: [] };
    const dPage = await inspect(url(spec.distinct.page), { ...dOpts, out: join(OUT, 'distinct-test-print') });
    const dTwin = await inspect(url(spec.distinct.twin), { ...dOpts, out: join(OUT, 'distinct-clean-twin') });
    return score(spec, { page, twin, dPage, dTwin });
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

export function score(spec, { page, twin, dPage, dTwin }) {
  const hit = (i, d) => i.check === d.check && names(i, d) && (!d.severity || i.severity === d.severity);
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
    precision: truePos.length / (truePos.length + falsePos.length || 1),
    recall: caught / rows.length,
    rows,
    falsePositives: falsePos.map((i) => ({ id: i.id, check: i.check, severity: i.severity, message: i.message, elements: i.elements.map((e) => e.sel) })),
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const from = process.argv.flatMap((a, i) => (process.argv[i - 1] === '--from' ? [a] : []));
  const r = from.length ? fromAction(from) : await run({ full: process.argv.includes('--full'), quiet: false });
  for (const row of r.rows) console.log(`${row.caught ? 'caught' : 'MISSED'}  ${row.id}  ${row.check.padEnd(18)} ${row.title}  ${row.issues.join(' ')}`);
  for (const f of r.falsePositives) console.log(`false positive  ${f.check}  ${f.message}  [${f.elements.join(', ')}]`);
  const ds = r.distinctSweep;
  if (!ds.equal) console.log(`sweep totals differ without a system: test print ${JSON.stringify(ds.testPrint)}, twin ${JSON.stringify(ds.twin)}`);
  console.log(`\nRecall ${r.caught}/${r.defects} = ${r.recall.toFixed(2)}. Precision ${r.truePositives}/${r.truePositives + r.falsePositives.length} = ${r.precision.toFixed(2)}. Clean twins: ${r.findingsOnTwin} findings.`);
  process.exit(r.recall === 1 && r.falsePositives.length === 0 && ds.equal ? 0 : 1);
}
