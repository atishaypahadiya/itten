// The timing rule (docs/CONTRACT.md, "Timing findings"; inspector/timing.js).
// A finding that rests on a measured time counts only when it was measured
// at least 3 times with a relative spread of at most 10%, with the 1-minute
// load average below half the CPU count before and after, and no software
// renderer. Otherwise it is info, "timing unreliable", with the environment
// recorded, and it never fails a run.
// fixtures/timing.html has a scroll handler that holds the main thread for
// 80 ms (frame-timing) and a band wider than the page (overflow, a layout
// finding); its clean twin has neither. The load average is given to the
// inspector (timingEnv), so the test does not depend on what else runs here.
// - Quiet machine, GPU: the finding is measured 3 times. It is a warning when
//   the spread is within 10%; when it is not, it is info and says so, and
//   the environment is not blamed.
// - Loaded machine: info, the load named, measured once (no repeats), the
//   overflow still an error, and nothing timing-based fails the run.
// - Software renderer (SwiftShader): info, the renderer named, the overflow
//   still an error.
// - The clean twin: no findings.
// - judge() alone, on each cause; and parity takes an unreliable finding's
//   differences as notes.
// Usage: node scripts/timing-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';
import { findingsOf } from '../inspector/finding.js';
import { failing } from '../inspector/baseline.js';
import { judge, spreadOf, isSoftware, timedIn, REASON } from '../inspector/timing.js';
import { compare } from './parity-test.js';
import { SOFTWARE } from './frozen-test.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function unitTests() {
  const fails = [];
  const quiet = { cpus: 8, load: { before: 1, after: 3.99 }, renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)' };
  const t = (what, v, reliable, cause) => {
    if (v.reliable !== reliable) fails.push(`judge: ${what} is ${v.reliable ? 'reliable' : 'unreliable'}`);
    if (!reliable && (v.reason !== REASON || !v.causes.some((c) => cause.test(c)))) fails.push(`judge: ${what} gives ${JSON.stringify(v.causes)}`);
    if (reliable && (v.reason || v.causes)) fails.push(`judge: ${what} is reliable and still has a reason`);
  };
  t('three within 10% on a quiet machine', judge([100, 104, 109], quiet), true);
  t('three spread 11%', judge([100, 104, 111.5], quiet), false, /spread 11%/);
  t('two measurements', judge([100, 100], quiet), false, /measured 2 times, fewer than 3/);
  t('one measurement', judge([100], quiet), false, /measured once/);
  t('load at half the CPUs before', judge([100, 100, 100], { ...quiet, load: { before: 4, after: 0 } }), false, /load average was 4 before/);
  t('load above half the CPUs after', judge([100, 100, 100], { ...quiet, load: { before: 0, after: 5.5 } }), false, /5\.5 after/);
  t('SwiftShader', judge([100, 100, 100], { ...quiet, renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)' }), false, /draws in software \(ANGLE \(Google/);
  t('llvmpipe', judge([100, 100, 100], { ...quiet, renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' }), false, /software/);
  if (isSoftware(quiet.renderer) || isSoftware(null)) fails.push('isSoftware: a GPU renderer, or none, is taken as software');
  if (spreadOf([90, 100, 110]) !== 0.2) fails.push(`spreadOf: 90, 100, 110 gives ${spreadOf([90, 100, 110])}, not 0.2`);
  if (timedIn({ check: 'frame-timing', key: 'x' }) !== 'motion' || timedIn({ check: 'page-load', key: 'late' }) !== 'benchmark' || timedIn({ check: 'page-load', key: 'requests' }) || timedIn({ check: 'overflow', key: 'x' }) || timedIn({ check: 'flash', key: 'p' })) fails.push('timedIn: the timing findings are not the ones the contract lists');
  return fails;
}

export async function run({ quiet = true } = {}) {
  const fails = unitTests();
  const { system } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  const port = 5175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  try {
    const go = (page, name, load, extra = {}) => inspect(`http://127.0.0.1:${port}/fixtures/${page}`, {
      system, systemPath: 'fixtures/itten.system.json', quiet, out: join(ROOT, 'dist', 'fixtures', `timing-${name}`),
      widths: [1024], keyWidths: [1024], passes: ['light', 'motion'], timings: false, aroundBreakpoints: false, timingEnv: { cpus: 8, load: () => load }, ...extra,
    });
    const read = (r, name) => {
      const all = findingsOf(r);
      const ft = all.filter((i) => i.check === 'frame-timing'), spill = all.filter((i) => i.check === 'overflow');
      if (r.status !== 'complete') fails.push(`${name}: the run is ${r.status}`);
      // One at full speed and one with the CPU slowed to the reference device.
      if (ft.length !== 2) fails.push(`${name}: ${ft.length} frame-timing findings, not 2`);
      if (spill.length !== 1 || spill[0].severity !== 'error') fails.push(`${name}: the overflow is not reported as one error (${spill.map((i) => i.severity).join()})`);
      if (spill[0]?.timing) fails.push(`${name}: the overflow, a layout finding, carries a timing verdict`);
      const other = all.filter((i) => i.check !== 'frame-timing' && i.check !== 'overflow');
      if (other.length) fails.push(`${name}: reported besides the two planted: ${other.map((i) => i.fingerprint).join('; ')}`);
      return ft;
    };
    const unreliable = (f, name, cause, r) => {
      if (!f) return;
      if (f.severity !== 'info' || f.timing?.reliable !== false || f.timing.reason !== REASON || f.timing.was !== 'warning') fails.push(`${name}: the finding is ${f.severity}, timing ${JSON.stringify({ ...f.timing, environment: undefined })}`);
      if (!f.timing?.causes?.some((c) => cause.test(c))) fails.push(`${name}: the causes do not name it: ${JSON.stringify(f.timing?.causes)}`);
      if (!/Timing unreliable \(/.test(f.message)) fails.push(`${name}: the message does not say the timing is unreliable`);
      const e = f.timing?.environment;
      if (!e || e.cpus !== 8 || typeof e.load?.before !== 'number' || typeof e.load?.after !== 'number' || !e.renderer) fails.push(`${name}: the environment is not recorded: ${JSON.stringify(e)}`);
      if (failing(r, 'warning').some((i) => i.check === 'frame-timing')) fails.push(`${name}: an unreliable timing finding fails the run at warning`);
      if (r.summary.info < 1) fails.push(`${name}: the summary does not count it as info`);
    };

    const calm = await go('timing.html', 'quiet', 0);
    for (const f1 of read(calm, 'quiet machine')) {
      if (f1.timing?.values?.length !== 3) fails.push(`quiet machine: measured ${f1.timing?.values?.length} times, not 3`);
      else if (f1.timing.reliable) { if (f1.severity !== 'warning' || f1.timing.spread > 0.1) fails.push(`quiet machine: reliable, yet ${f1.severity} with spread ${f1.timing.spread}`); }
      else if (f1.severity !== 'info' || !(f1.timing.spread > 0.1) || f1.timing.causes.length !== 1 || !/spread/.test(f1.timing.causes[0])) fails.push(`quiet machine: unreliable for ${JSON.stringify(f1.timing.causes)} with spread ${f1.timing.spread}`);
    }
    if (calm.environment.timing?.software !== false || calm.environment.timing.cpus !== 8) fails.push(`quiet machine: environment.timing is ${JSON.stringify(calm.environment.timing)}`);

    const busy = await go('timing.html', 'loaded', 6);
    for (const f2 of read(busy, 'loaded machine')) {
      unreliable(f2, 'loaded machine', /load average was 6 before and 6 after, not below half of 8 CPUs/, busy);
      if (f2.timing?.values?.length !== 1) fails.push(`loaded machine: measured ${f2.timing?.values?.length} times; a run that cannot count does not repeat`);
    }

    const soft = await go('timing.html', 'software', 0, { launchArgs: SOFTWARE });
    for (const f3 of read(soft, 'software renderer')) unreliable(f3, 'software renderer', /draws in software \(.*SwiftShader/, soft);
    if (soft.environment.timing?.software !== true) fails.push('software renderer: environment.timing.software is not true');

    const twin = await go('timing-clean.html', 'clean', 0);
    if (findingsOf(twin).length) fails.push(`clean twin: ${findingsOf(twin).map((i) => i.fingerprint).join('; ')}`);

    // Parity: an unreliable finding's differences are notes; a reliable one's severity is not.
    const notes = [];
    const d = compare(busy, soft, 'timing', notes).filter((x) => /frame-timing/.test(x));
    if (d.length) fails.push(`parity fails on a finding with unreliable timing: ${d[0].slice(0, 160)}`);
    if (!notes.some((n) => /frame-timing.*timing unreliable/.test(n))) fails.push('parity does not note the difference in a finding with unreliable timing');
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'timing-test.js', usage: 'node scripts/timing-test.js' });
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'Timing findings count only on three close measurements, a quiet machine and a GPU; otherwise they are info, with the reason and the environment.');
  process.exit(fails.length ? 1 : 0);
}
