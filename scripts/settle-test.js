// The settle window on a slow machine. A machine at a benchmark index of
// 1600 or more gets the 500 ms window and the 5 s watch unscaled, so on a
// fast laptop or CI runner the scaling in settleTiming never runs. Here
// Chromium is slowed to an index of 800 (--slow-to), where the window and
// the watch double. On the test print the figure drawn 2.5 s after load
// (d20) must still be reported as late, and the clean twin, which draws it
// as the page is read, must have no page-load finding.
// Usage: node scripts/settle-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem, settleTiming } from '../inspector/inspect.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'fixtures');
const SLOW_TO = 800;

export async function run({ quiet = true } = {}) {
  const fails = [];
  // The scale by itself: 1600 / index, from 1 to 3.
  for (const [index, scale, window, horizon] of [[3200, 1, 500, 5000], [1600, 1, 500, 5000], [800, 2, 1000, 10000], [400, 3, 1500, 15000], [100, 3, 1500, 15000]]) {
    const t = settleTiming(index);
    if (t.scale !== scale || t.window !== window || t.horizon !== horizon) {
      fails.push(`settleTiming(${index}) gives scale ${t.scale}, window ${t.window} ms, watch ${t.horizon} ms; expected ${scale}, ${window} ms, ${horizon} ms`);
    }
  }
  const spec = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'defects.json'), 'utf8'));
  const { system, errors } = loadSystem(join(ROOT, spec.system));
  if (errors.length) return [...fails, 'fixtures/itten.system.json is not valid: ' + errors.join('; ')];
  const port = 4175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  const inD20 = (i) => i.elements.some((e) => e.sel === '#d20' || e.sel.startsWith('#d20 '));
  try {
    for (const [page, out, twin] of [[spec.page, 'slow-test-print', false], [spec.twin, 'slow-clean-twin', true]]) {
      const r = await inspect(`http://127.0.0.1:${port}/${page}`, {
        system, systemPath: spec.system, quiet, out: join(OUT, out),
        widths: [768], keyWidths: [768], engines: [], slowTo: SLOW_TO,
      });
      const t = r.load.timing;
      const at = `${page} slowed to ${SLOW_TO}`;
      if (!t.slowed) { fails.push(`${at}: the CPU was not slowed (index ${t.benchmarkIndex})`); continue; }
      // calibrate lands within 10% of the target; the scale is then 1.8 to 2.2.
      if (!(t.scale >= 1.5) || t.window <= 500 || t.horizon <= 5000) {
        fails.push(`${at}: index ${t.benchmarkIndex} (${t.slowed.rate}x from ${t.slowed.from}) gave scale ${t.scale}, window ${t.window} ms, watch ${t.horizon} ms; the scaling did not run`);
      }
      const load = r.issues.filter((i) => i.check === 'page-load');
      if (!twin && !load.some(inD20)) fails.push(`${at}: d20, drawn 2.5 s after load, was not reported as late`);
      if (twin && load.length) fails.push(`${at}: the clean twin has page-load findings: ${load.map((i) => i.message.slice(0, 120)).join(' | ')}`);
    }
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `\n${fails.length} failure(s).` : '\nSettle on a slow machine: passes.');
  process.exit(fails.length ? 1 : 0);
}
