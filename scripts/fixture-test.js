// Runs the inspector on the fixtures: the test print with planted defects
// (fixtures/index.html) and its clean twin (fixtures/clean.html).
// Passes when every planted defect is caught and the twin reports nothing.
// Usage: node scripts/fixture-test.js [--full]   (--full: the 41-width sweep instead of four widths)
// Exports run() for scripts/check.js.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'fixtures');

const inSection = (issue, id) => issue.elements.some((e) => e.sel === '#' + id || e.sel.startsWith('#' + id + ' '));

export async function run({ full = false, quiet = true } = {}) {
  const spec = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'defects.json'), 'utf8'));
  const { system, errors } = loadSystem(join(ROOT, spec.system));
  if (errors.length) throw new Error('fixtures/itten.system.json is not valid: ' + errors.join('; '));
  const port = 4175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  const opts = { system, systemPath: spec.system, quiet, full };
  try {
    const page = await inspect(`http://127.0.0.1:${port}/fixtures/index.html`, { ...opts, out: join(OUT, 'test-print') });
    const twin = await inspect(`http://127.0.0.1:${port}/fixtures/clean.html`, { ...opts, out: join(OUT, 'clean-twin') });

    const rows = spec.defects.map((d) => {
      const hits = page.issues.filter((i) => i.check === d.check && inSection(i, d.id));
      return { ...d, caught: hits.length > 0, issues: hits.map((i) => i.id) };
    });
    const matched = (i) => spec.defects.some((d) => d.check === i.check && inSection(i, d.id));
    const truePos = page.issues.filter(matched);
    const falsePos = [...page.issues.filter((i) => !matched(i)), ...twin.issues];
    const caught = rows.filter((r) => r.caught).length;
    const result = {
      defects: rows.length, caught, missed: rows.filter((r) => !r.caught).map((r) => r.id),
      findingsOnTestPrint: page.issues.length, truePositives: truePos.length,
      falsePositivesOnTestPrint: page.issues.length - truePos.length, findingsOnTwin: twin.issues.length,
      precision: truePos.length / (truePos.length + falsePos.length || 1),
      recall: caught / rows.length,
      rows,
      falsePositives: falsePos.map((i) => ({ id: i.id, check: i.check, severity: i.severity, message: i.message, elements: i.elements.map((e) => e.sel) })),
    };
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'result.json'), JSON.stringify(result, null, 2));
    return result;
  } finally {
    server.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await run({ full: process.argv.includes('--full'), quiet: false });
  for (const row of r.rows) console.log(`${row.caught ? 'caught' : 'MISSED'}  ${row.id}  ${row.check.padEnd(18)} ${row.title}  ${row.issues.join(' ')}`);
  for (const f of r.falsePositives) console.log(`false positive  ${f.check}  ${f.message}  [${f.elements.join(', ')}]`);
  console.log(`\nRecall ${r.caught}/${r.defects} = ${r.recall.toFixed(2)}. Precision ${r.truePositives}/${r.truePositives + r.falsePositives.length} = ${r.precision.toFixed(2)}. Clean twin: ${r.findingsOnTwin} findings.`);
  process.exit(r.recall === 1 && r.falsePositives.length === 0 ? 0 : 1);
}
