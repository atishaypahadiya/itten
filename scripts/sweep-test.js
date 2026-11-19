// The full sweep measures everything quick mode does (0.5). On
// fixtures/breakpoint.html a band sticks out past the right edge only between
// 890 and 900 px, two breakpoints that quick mode measures either side of and
// the full sweep's 40 px steps (880, 920) step over; a two-column grid from
// 700 px is a decoy, a breakpoint with nothing wrong on either side.
// - On the planted page and its clean twin, the full sweep's widths include
//   every width quick mode measures.
// - Both modes report the overflow on the planted page, and nothing else.
// - The clean twin has no findings in either mode.
// - The control: the full sweep without the widths around breakpoints
//   (aroundBreakpoints: false) misses the overflow, so the fixture needs them.
// Usage: node scripts/sweep-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';
import { findingsOf } from '../inspector/finding.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// sweep.widths as written ("320–1920, 889, 890"): runs are 40 px steps.
export const widthsOf = (text) => String(text).split(', ').flatMap((p) => {
  const [a, b] = p.split('–').map(Number);
  return b === undefined ? [a] : Array.from({ length: (b - a) / 40 + 1 }, (_, i) => a + i * 40);
});

export async function run({ quiet = true } = {}) {
  const fails = [];
  const { system } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  const port = 5175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  try {
    const go = (page, name, extra) => inspect(`http://127.0.0.1:${port}/fixtures/${page}`, {
      system, systemPath: 'fixtures/itten.system.json', quiet, out: join(ROOT, 'dist', 'fixtures', `sweep-${name}`),
      passes: ['scan', 'light'], timings: false, ...extra,
    });
    const spills = (r) => findingsOf(r).filter((i) => i.check === 'overflow' && i.elements.some((e) => e.label === 'div.band'));
    for (const page of ['breakpoint.html', 'breakpoint-clean.html']) {
      const clean = page.includes('clean');
      const q = await go(page, `quick-${clean ? 'clean' : 'planted'}`, {});
      const f = await go(page, `full-${clean ? 'clean' : 'planted'}`, { full: true });
      for (const [name, r] of [['quick', q], ['full', f]]) if (r.status !== 'complete') fails.push(`${page}, ${name}: the run is ${r.status} (${r.reason ?? ''})`);
      const qw = widthsOf(q.sweep.widths), fw = new Set(widthsOf(f.sweep.widths));
      const missing = qw.filter((w) => !fw.has(w));
      if (missing.length) fails.push(`${page}: the full sweep does not measure ${missing.join(', ')} px, which quick mode does`);
      if (!qw.includes(890) || !qw.includes(900)) fails.push(`${page}: quick mode did not measure 890 and 900 px (${q.sweep.widths})`);
      for (const [name, r] of [['quick', q], ['full', f]]) {
        const all = findingsOf(r);
        if (clean) { if (all.length) fails.push(`${page}, ${name}: the clean twin has findings: ${all.map((i) => i.fingerprint).join('; ')}`); continue; }
        const band = (i) => i.check === 'overflow' && i.elements.some((e) => e.label === 'div.band');
        if (!all.some(band)) fails.push(`${page}, ${name}: the band sticking out between 890 and 900 px is not reported`);
        const other = all.filter((i) => !band(i));
        if (other.length) fails.push(`${page}, ${name}: reported besides the band: ${other.map((i) => i.fingerprint).join('; ')}`);
      }
    }
    const control = await go('breakpoint.html', 'full-control', { full: true, aroundBreakpoints: false });
    if (spills(control).length) fails.push('control: the full sweep without the widths around breakpoints still reports the band, so the fixture does not need them');
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'The full sweep measures every width quick mode does, and catches the band between two breakpoints that its 40 px steps miss.');
  process.exit(fails.length ? 1 : 0);
}
