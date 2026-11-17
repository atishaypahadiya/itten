// data-itten-ignore is scoped: by check name, and to the element itself. On
// an ancestor it reaches the elements inside only with
// data-itten-ignore-subtree. fixtures/ignore.html gives five boxes a radius
// outside the system, one value per case; the radius findings must name
// exactly 5 px (ignore on the parent, no -subtree) and 9 px (ignore of
// another check), and the report must count the skipped pairs.
// Usage: node scripts/ignore-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function run({ quiet = true } = {}) {
  const fails = [];
  const { system } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  const port = 4675 + Math.floor(Math.random() * 500);
  const server = await start(port);
  try {
    const r = await inspect(`http://127.0.0.1:${port}/fixtures/ignore.html`, {
      system, systemPath: 'fixtures/itten.system.json', quiet, out: join(ROOT, 'dist', 'fixtures', 'ignore'),
      widths: [1024], keyWidths: [1024], engines: [], engineWidths: [], workers: 1, timings: false, aroundBreakpoints: false,
    });
    const radii = r.issues.filter((i) => i.check === 'radius').map((i) => i.message.match(/^Radius ([\d.]+) px/)?.[1]).filter(Boolean).sort();
    const want = ['5', '9'];
    if (JSON.stringify(radii) !== JSON.stringify(want)) fails.push(`radius findings at ${radii.join(', ') || 'none'} px; expected ${want.join(', ')} px (5: the parent's ignore without -subtree must not reach the box; 9: an ignore of another check must not skip radius; 6, 7 and 10 must be skipped)`);
    // 6 and 7 px skip radius alone; 10 px skips every check that looks at it, so at least 3.
    if (!(r.coverage.ignored >= 3)) fails.push(`the report counts ${r.coverage.ignored} ignored element and check pairs; expected at least 3 (6, 7 and 10 px)`);
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'Ignore scope: passes.');
  process.exit(fails.length ? 1 : 0);
}
