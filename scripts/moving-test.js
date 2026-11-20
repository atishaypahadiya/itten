// Contrast over a moving background, judged across fixed frames (0.5).
// fixtures/moving.html has white text over four grounds that change with
// time, each from another clock: performance.now(), the time a frame is
// given, Date.now(), and a CSS animation. The first and the last are under
// 4.5:1 in most frames and above it in the rest (planted); the second never
// is, and the third is for a tenth of a second, in one frame of the fixed
// set (decoys). fixtures/moving-clean.html is the twin: the same movement,
// always readable.
//
// - Two runs that reach the capture at different times, and a run on one
//   worker and on several, report the same contrast findings: severity,
//   message and every frame's value.
// - The two planted texts are errors, at every key width, in light and dark;
//   the decoys and the twin have no contrast finding.
// - Each finding lists a value per frame, and its crop names the frame.
// - The control: with the fixed frames off, the two runs that differ in
//   timing do not report the same thing, so the page is one the change is
//   needed for.
// - verdictAcross on made-up frames: one bad frame of twelve passes, two
//   fail; of eight, one fails.
//
// Usage: node scripts/moving-test.js
// Exports run() for scripts/check.js.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, verdictAcross, tenthOf, FRAMES } from '../inspector/inspect.js';
import { view, findingsOf } from '../inspector/finding.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLANTED = ['body > main > div:nth-of-type(1) > p', 'body > main > p'];

export async function run({ quiet = true } = {}) {
  const fails = [];
  // The judgement alone.
  const frames = (bad, n = 12) => Array.from({ length: n }, (_, k) => ({ med: k < bad ? 3 : 7, p10: k < bad ? 3 : 7 }));
  if (verdictAcross(frames(1), 4.5, false)) fails.push('one frame of twelve under the floor is reported: the 10th percentile is not what is judged');
  if (verdictAcross(frames(2), 4.5, false)?.severity !== 'error') fails.push('two frames of twelve under the floor are not an error');
  if (verdictAcross(frames(1, 8), 4.5, false)?.severity !== 'error') fails.push('one frame of eight under the floor is not an error (the 10th percentile of fewer than 11 is the lowest)');
  if (verdictAcross(frames(0).map((x, k) => ({ med: 7, p10: k < 2 ? 4 : 7 })), 4.5, false)?.severity !== 'warning') fails.push('a tenth of the ground under the floor in two frames of twelve is not a warning');
  if (tenthOf([5, 1, 9, 3, 7, 2, 8, 4, 6, 10, 11, 12]) !== 2) fails.push('tenthOf: the 10th percentile of twelve values is not the second lowest');

  const port = 5175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  try {
    const go = (name, page, extra = {}) => inspect(`http://127.0.0.1:${port}/fixtures/${page}`, { quiet, out: join(ROOT, 'dist', 'fixtures', `moving-${name}`), engines: [], engineWidths: [], timings: false, ...extra });
    const contrast = (r) => findingsOf(r).map(view).filter((f) => f.check === 'contrast');
    const told = (r) => JSON.stringify(contrast(r).map((f) => ({ fingerprint: f.fingerprint, severity: f.severity, message: f.message, seen: f.seen, frames: f.frames })));

    const a = await go('1', 'moving.html', { workers: 1 }), b = await go('2', 'moving.html', { workers: 4, settle: 700 });
    for (const [name, r] of [['one worker', a], ['four workers, 700 ms later', b]]) {
      if (r.status !== 'complete') fails.push(`${name}: the run is ${r.status} (${r.reason})`);
      const cs = contrast(r);
      for (const sel of PLANTED) {
        const f = cs.find((x) => x.elements.some((e) => e.sel === sel));
        if (!f) { fails.push(`${name}: no contrast finding on ${sel}`); continue; }
        if (f.severity !== 'error') fails.push(`${name}: ${sel} is ${f.severity}, not an error`);
        if (f.frames?.count !== FRAMES.count || f.frames.median?.length !== FRAMES.count || f.frames.tenth?.length !== FRAMES.count) fails.push(`${name}: ${sel} does not list a value for each of ${FRAMES.count} frames`);
        else {
          if (f.frames.judged !== Number(tenthOf(f.frames.median).toFixed(2))) fails.push(`${name}: ${sel} is judged on ${f.frames.judged}, not on the 10th percentile of its frames (${tenthOf(f.frames.median)})`);
          if (!(Math.min(...f.frames.median) < 4.5 && Math.max(...f.frames.median) >= 4.5)) fails.push(`${name}: ${sel} is not under the floor in some frames and over it in others, so it tests nothing`);
        }
        if (!f.movingBackground) fails.push(`${name}: ${sel} is not marked movingBackground`);
        if (!f.crops.length || f.crops.some((c) => !c.composited || !(c.frame?.frames > 0))) fails.push(`${name}: a crop of ${sel} does not name the frame it shows`);
        const widths = Object.values(f.seen).join('; ');
        if (!f.seen.light || !f.seen.dark || f.seen.light !== f.seen.dark) fails.push(`${name}: ${sel} is not seen at the same widths in light and dark (${widths})`);
      }
      for (const f of cs) if (!f.elements.some((e) => PLANTED.includes(e.sel))) fails.push(`${name}: a decoy is reported: ${f.elements.map((e) => e.sel).join(', ')} (${f.message.split('. ')[0]})`);
      for (const d of r.drawing ?? []) if (d.frames?.count !== FRAMES.count) fails.push(`${name}: ${d.at} draws and was not judged across the fixed frames${d.frames?.failed ? ` (${d.frames.failed})` : ''}`);
    }
    if (told(a) !== told(b)) fails.push('two runs of the page do not report the same contrast findings, frame by frame');

    const twin = await go('clean', 'moving-clean.html');
    for (const f of findingsOf(twin).map(view)) fails.push(`the clean twin reports ${f.check} on ${f.elements.map((e) => e.sel).join(', ') || 'the page'} (${f.message.split('. ')[0]})`);
    if (!(twin.drawing ?? []).some((d) => d.tiles > 0)) fails.push('the clean twin draws nothing, so it is no twin');

    // The control: without the fixed frames, when the capture happens decides what is found.
    const one = { widths: [1440], keyWidths: [1440], aroundBreakpoints: false, fixedFrames: false };
    const c1 = await go('off-1', 'moving.html', one), c2 = await go('off-2', 'moving.html', { ...one, settle: 700 });
    if (contrast(c1).some((f) => f.frames) || contrast(c2).some((f) => f.frames)) fails.push('control: with the fixed frames off a finding still lists frames');
    if (told(c1) === told(c2)) fails.push('control: with the fixed frames off, two runs 700 ms apart report the same contrast findings, so the fixture does not need the change');
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'moving-test.js', usage: 'node scripts/moving-test.js', flags: {} });
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'Contrast over a moving background is the same every run: judged on the 10th percentile of the fixed frames, each frame listed; without them two runs differ.');
  process.exit(fails.length ? 1 : 0);
}
