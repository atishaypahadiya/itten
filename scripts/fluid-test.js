// Fluidity needs three widths (0.5). A value is fluid when it takes three or
// more values across the sweep, so at one or two widths a clamp() cannot be
// told from a fixed value. fixtures/fluid.html has a gutter of
// clamp(16px, 4vw, 56px) and a card with 13 px of padding; its clean twin has
// the system's fluid range and a step of the scale.
// - Quick mode, and three widths given: the gutter is judged fluid (a fluid
//   finding, never a fixed one) and the 13 px is reported as a fixed value
//   off the scale and as px; the report says fluidity was judged.
// - One width, and two: no finding that depends on a value being fixed
//   (spacing-scale or type-scale "fixed", spacing-unit), on either page; the
//   report says fluidity is unknown, and why.
// - The clean twin: no findings at any of them.
// Usage: node scripts/fluid-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';
import { findingsOf } from '../inspector/finding.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const needsFixed = (i) => /^(spacing-scale|type-scale)\|fixed\|/.test(i.fingerprint) || i.check === 'spacing-unit';

export async function run({ quiet = true } = {}) {
  const fails = [];
  const { system } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  const port = 5175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  try {
    const go = (page, name, extra) => inspect(`http://127.0.0.1:${port}/fixtures/${page}`, {
      system, systemPath: 'fixtures/itten.system.json', quiet, out: join(ROOT, 'dist', 'fixtures', `fluid-${name}`),
      passes: ['scan', 'light', '200'], timings: false, ...extra,
    });
    const RUNS = [['quick', {}, true], ['three widths', { widths: [320, 900, 1024] }, true], ['two widths', { widths: [900, 1024] }, false], ['one width', { widths: [900] }, false]];
    for (const [name, extra, judged] of RUNS) {
      const slug = name.replace(/ /g, '-');
      const r = await go('fluid.html', slug, extra), twin = await go('fluid-clean.html', `${slug}-clean`, extra);
      const all = findingsOf(r), on = (cls) => (i) => i.elements.some((e) => e.label === cls);
      if (r.status !== 'complete') fails.push(`${name}: the run is ${r.status}`);
      if (twin.status !== 'complete') fails.push(`${name}: the clean twin is ${twin.status}, so it would not exit 0`);
      if (findingsOf(twin).length) fails.push(`${name}: the clean twin has findings: ${findingsOf(twin).map((i) => i.fingerprint).join('; ')}`);
      for (const [what, rep] of [['page', r], ['twin', twin]]) if (rep.sweep.fluidity !== (judged ? 'judged' : 'unknown')) fails.push(`${name}, ${what}: sweep.fluidity is ${rep.sweep.fluidity}`);
      const noted = r.notJudged.some((n) => /^Fluidity/.test(n));
      const fixedGutter = all.filter((i) => needsFixed(i) && on('div.gutter')(i));
      if (fixedGutter.length) fails.push(`${name}: the fluid gutter is reported as a fixed value: ${fixedGutter.map((i) => i.fingerprint).join('; ')}`);
      if (judged) {
        if (noted) fails.push(`${name}: the report says fluidity was not judged`);
        if (!all.some((i) => /^spacing-scale\|fluid\|/.test(i.fingerprint) && on('div.gutter')(i))) fails.push(`${name}: the gutter is not judged fluid`);
        if (!all.some((i) => i.fingerprint === 'spacing-scale|fixed|13' && on('div.card')(i))) fails.push(`${name}: the 13 px padding is not reported off the scale`);
        if (!all.some((i) => i.check === 'spacing-unit' && on('div.card')(i))) fails.push(`${name}: the 13 px padding is not reported as px`);
        const other = all.filter((i) => !/^spacing-scale\|(fluid|fixed\|13)/.test(i.fingerprint) && i.check !== 'spacing-unit');
        if (other.length) fails.push(`${name}: reported besides the planted: ${other.map((i) => i.fingerprint).join('; ')}`);
      } else {
        if (!noted) fails.push(`${name}: the report does not note that fluidity was not judged`);
        const dep = all.filter(needsFixed);
        if (dep.length) fails.push(`${name}: reports findings that need a value to be fixed: ${dep.map((i) => i.fingerprint).join('; ')}`);
        if (all.length) fails.push(`${name}: reports ${all.map((i) => i.fingerprint).join('; ')}`);
      }
    }
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'fluid-test.js', usage: 'node scripts/fluid-test.js' });
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'Fluidity is judged from three widths; below that it is unknown, and nothing that needs a fixed value is reported.');
  process.exit(fails.length ? 1 : 0);
}
