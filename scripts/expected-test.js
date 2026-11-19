// The fixtures' "expected" row type, on real pages. fixtures/expected.html and
// its clean twin both have a fluid inset that is meant; without a system file
// it is listed as info on each. The page also has a planted overflow.
// fixtures/expected.json says so, and scripts/fixture-test.js's score() must
// give: the overflow caught, recall 1.00 and precision 1.00, the expected row
// on both pages as info and set aside, nothing else on the twin, and the twin
// exiting 0 (run through the command line, with the default --fail-on).
// The controls: the same reports scored without the expected row call the
// inset a false positive on both pages; and score()'s own controls on
// made-up reports (expectedTests) cover a row on one page only, a row
// reported as a warning, and a twin that would not exit 0.
// Usage: node scripts/expected-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { score, expectedTests } from './fixture-test.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function run() {
  const fails = expectedTests().map((f) => `expected rows: ${f}`);
  const spec = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'expected.json'), 'utf8'));
  const port = 5175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  try {
    // Through the command line, so the exit code is the real one.
    const go = (page, name) => new Promise((done) => {
      const out = join(ROOT, 'dist', 'fixtures', `expected-${name}`);
      const c = spawn(process.execPath, [join(ROOT, 'inspector', 'inspect.js'), `http://127.0.0.1:${port}/${page}`, '--out', out, '--no-engines'], { stdio: 'ignore' });
      c.on('exit', (code) => { let report = null; try { report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8')); } catch { /* none */ } done({ code, report }); });
    });
    const [page, twin] = await Promise.all([go(spec.page, 'page'), go(spec.twin, 'twin')]);
    if (!page.report || !twin.report) return [...fails, `no report (exit ${page.code} and ${twin.code})`];
    if (twin.code !== 0) fails.push(`the clean twin exits ${twin.code}, not 0`);
    if (page.code !== 1) fails.push(`the page with the planted error exits ${page.code}, not 1`);
    const none = { status: 'complete', findings: [], sweep: {}, distinct: { sweep: null } };
    const r = score(spec, { page: page.report, twin: twin.report, dPage: none, dTwin: none }, { write: false });
    for (const p of r.problems) fails.push(p);
    if (r.recall !== 1 || r.precision !== 1) fails.push(`recall ${r.recall}, precision ${r.precision}: missed ${r.missed.join() || 'none'}, false positives ${r.falsePositives.map((f) => `${f.check} [${f.elements.join(', ')}]`).join('; ') || 'none'}`);
    if (r.findingsOnTwin !== 0) fails.push(`${r.findingsOnTwin} findings on the twin besides the expected row`);
    const x = r.expected[0];
    if (!x || !x.onPage.length || !x.onTwin.length || x.severities.join() !== 'info') fails.push(`the expected row is not on both pages as info: ${JSON.stringify(x)}`);
    if (twin.report.summary.info < 1 || twin.report.summary.warning || twin.report.summary.error) fails.push(`the twin's summary is ${JSON.stringify(twin.report.summary)}; the expected row is its one info`);
    // The control: without the row, the inset is a false positive on both pages.
    const without = score({ ...spec, expected: [] }, { page: page.report, twin: twin.report, dPage: none, dTwin: none }, { write: false });
    if (without.falsePositives.length !== 2) fails.push(`control: scored without the expected row, ${without.falsePositives.length} false positives, not the inset on each page`);
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'expected-test.js', usage: 'node scripts/expected-test.js' });
  const fails = await run();
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'An expected row is on both pages as info and set aside; the planted defect is caught, and the clean twin exits 0.');
  process.exit(fails.length ? 1 : 0);
}
