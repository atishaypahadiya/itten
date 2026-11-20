// A script's flashes are counted, not timed (docs/CONTRACT.md, "Timing
// findings"; inspector/inspect.js, scriptFlashes). The count is made in a
// context of its own on a controlled clock: timers, Date and
// performance.now follow DevTools virtual time, and animation frames are
// held and run 60 to the second of page time. So the count is the same on
// any machine, and the timing rule does not apply to it.
// fixtures/flash.html has four boxes a script switches between black and
// white. Planted: one switched every 125 ms from a timer and one every
// 125 ms of the time its animation frames are given, four flashes a second
// each (WCAG 2.3.1 allows three). Decoys: one that flashes twice a second,
// and one that flashes four times but is smaller than the area that counts.
// The clean twin flashes once a second.
// - On a machine the timing rule would not trust (the load average is given
//   as loaded): both planted boxes are errors, each with its count (8
//   changes in one second, of 5 s and 300 frames), no timing verdict, the
//   decoys silent; and a second run reports the same, value for value.
// - The clean twin: no findings.
// - The control: with the controlled clock off (flashClock: false), the same
//   two findings come off the motion pass's own clock, and on that machine
//   they are info, "timing unreliable".
// - flashToggles() alone: the count in any one second, the area floor, and
//   a change too small to count.
// Usage: node scripts/flash-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, flashToggles, FLASH_CLOCK } from '../inspector/inspect.js';
import { findingsOf } from '../inspector/finding.js';
import { failing } from '../inspector/baseline.js';
import { REASON } from '../inspector/timing.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function unitTests() {
  const fails = [];
  const rec = (every, n, a = 0, b = 1) => Array.from({ length: n }, (_, i) => [i * every, i % 2 ? b : a]);
  const el = (rect, r) => ({ sel: '#x', label: 'div', rect, rec: r });
  const big = [0, 0, 200, 120], small = [0, 0, 64, 64];
  const n = (t, o) => flashToggles([t], o).length;
  if (n(el(big, rec(125, 40))) !== 1) fails.push('flashToggles: a change every 125 ms over 24000 px² is not a finding');
  if (n(el(big, rec(250, 40))) !== 0) fails.push('flashToggles: a change every 250 ms (two flashes a second) is a finding');
  if (n(el(big, rec(166.7, 40))) !== 0) fails.push('flashToggles: three flashes a second is a finding; the limit is more than three');
  if (n(el(small, rec(125, 40))) !== 0) fails.push('flashToggles: a box below the area that counts is a finding');
  if (n(el(big, rec(125, 40, 0.5, 0.55))) !== 0) fails.push('flashToggles: a change of 0.05 in relative luminance is a finding');
  const f = flashToggles([el(big, rec(125, 40))], { counted: { seconds: 5, frames: 300 } })[0];
  if (f?.counted?.changes !== 8 || f.timed !== undefined || f.key !== '#x|script') fails.push(`flashToggles: a counted finding is ${JSON.stringify({ counted: f?.counted, timed: f?.timed, key: f?.key })}`);
  if (flashToggles([el(big, rec(125, 40))], { timed: true })[0]?.timed !== 8) fails.push('flashToggles: a timed finding does not carry what was measured');
  return fails;
}

export async function run({ quiet = true } = {}) {
  const fails = unitTests();
  const port = 5990 + Math.floor(Math.random() * 300);
  const server = await start(port);
  try {
    // A loaded machine, by the numbers given: 6 of 8 CPUs before and after.
    const go = (page, name, extra = {}) => inspect(`http://127.0.0.1:${port}/fixtures/${page}`, {
      quiet, out: join(ROOT, 'dist', 'fixtures', `flash-${name}`), widths: [1024], keyWidths: [1024], passes: ['light', 'motion'],
      timings: false, aroundBreakpoints: false, lock: false, timingEnv: { cpus: 8, load: () => 6 }, ...extra,
    });
    const shape = (r) => findingsOf(r).map((i) => [i.fingerprint, i.severity, i.message, JSON.stringify(i.counted ?? null)].join(' | ')).sort();
    const a = await go('flash.html', 'a'), b = await go('flash.html', 'b');
    for (const [name, r] of [['first run', a], ['second run', b]]) {
      const all = findingsOf(r);
      if (r.status !== 'complete') fails.push(`${name}: the run is ${r.status}`);
      if (r.motion?.flashClock?.counted !== true || r.motion.flashClock.seconds !== FLASH_CLOCK.seconds) fails.push(`${name}: the report does not say the flashes were counted on the controlled clock: ${JSON.stringify(r.motion?.flashClock)}`);
      for (const id of ['#timer', '#frames']) {
        const f = all.find((i) => i.fingerprint === `flash|${id}|script`);
        if (!f) { fails.push(`${name}: ${id}, four flashes a second, is not reported`); continue; }
        if (f.severity !== 'error') fails.push(`${name}: ${id} is ${f.severity}, not an error, on a loaded machine: a count does not depend on the machine`);
        if (f.timing) fails.push(`${name}: ${id} carries a timing verdict`);
        if (f.counted?.changes !== 8 || f.counted.seconds !== 5 || f.counted.frames !== 300) fails.push(`${name}: ${id} was counted as ${JSON.stringify(f.counted)}, not 8 changes in 5 s and 300 frames`);
        if (!/8 times within one second, 4 flashes/.test(f.message)) fails.push(`${name}: ${id} says "${f.message.slice(0, 80)}"`);
      }
      const other = all.filter((i) => !/^flash\|#(timer|frames)\|script$/.test(i.fingerprint));
      if (other.length) fails.push(`${name}: reported besides the two planted (the decoys are #slow and #small): ${other.map((i) => i.fingerprint).join('; ')}`);
      if (failing(r, 'warning').length !== 2) fails.push(`${name}: ${failing(r, 'warning').length} findings fail the run, not 2`);
    }
    if (shape(a).join('\n') !== shape(b).join('\n')) fails.push(`two runs differ:\n  ${shape(a).join('\n  ')}\n  and\n  ${shape(b).join('\n  ')}`);

    const twin = await go('flash-clean.html', 'clean');
    if (twin.status !== 'complete') fails.push(`clean twin: the run is ${twin.status}, so it would not exit 0`);
    if (findingsOf(twin).length) fails.push(`clean twin: ${findingsOf(twin).map((i) => i.fingerprint).join('; ')}`);
    if (twin.motion?.flashClock?.counted !== true) fails.push('clean twin: the flashes were not counted on the controlled clock');

    // The control: read off the motion pass's own clock, the same findings fall under the timing rule.
    const wall = await go('flash.html', 'wall', { flashClock: false });
    const timed = findingsOf(wall).filter((i) => /^flash\|#(timer|frames)\|script$/.test(i.fingerprint));
    if (timed.length !== 2) fails.push(`control: ${timed.length} script flashes read off the wall clock, not 2 (${findingsOf(wall).map((i) => i.fingerprint).join('; ')})`);
    for (const f of timed) {
      if (f.severity !== 'info' || f.timing?.reason !== REASON || f.timing.was !== 'error' || f.counted) fails.push(`control: ${f.fingerprint} is ${f.severity} with ${JSON.stringify({ ...f.timing, environment: undefined })}; off the wall clock on a loaded machine it is info, timing unreliable`);
    }
    if (failing(wall, 'warning').length) fails.push('control: an unreliable flash finding fails the run');
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'flash-test.js', usage: 'node scripts/flash-test.js' });
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'A script\'s flashes are counted on a controlled clock: the same count on a loaded machine and in every run; off the wall clock they would be info there.');
  process.exit(fails.length ? 1 : 0);
}
