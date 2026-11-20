// A step of the frame clock has a time limit of its own (TIMEOUTS.frame;
// docs/CONTRACT.md, "Contrast over a moving background"). On the frame clock
// performance.now() and Date.now() do not move within a frame, so a frame
// callback that waits on them never returns. Without the limit that held
// the width's contrast pass for the whole check limit, with the frame
// clock's page left open.
// fixtures/frame-wait.html draws a ground every frame after waiting 4 ms on
// performance.now(), under white text that passes in every frame, beside a
// box 2400 px wide. Its twin does not wait.
// - The page: the step is abandoned at its limit (2 s here). The run is
//   partial; one info finding names the step, the width and the limit; the
//   drawing entry says the frames could not be judged; and the rest still
//   ran: the overflow is an error at all three widths, the key width among
//   them, and the job after it was measured. Nothing else is reported, and
//   only the overflow fails the run.
// - The run takes far less than the check limit it used to wait for.
// - The script flash count on the same page: abandoned at the same limit,
//   one info finding names the step and the motion pass's clock that read
//   the flashes instead, and the run is complete.
// - The twin: complete, judged across the fixed frames, the overflow only.
// - The test's port: a taken one is drawn again (startFree in serve.js).
// - The control: the same page with the fixed frames off is complete and
//   has no such finding, so the wait is the frame clock's, not the page's.
// Usage: node scripts/frame-limit-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start, startFree } from './serve.js';
import { createServer } from 'node:http';
import { inspect, FRAMES, TIMEOUTS } from '../inspector/inspect.js';
import { findingsOf } from '../inspector/finding.js';
import { failing } from '../inspector/baseline.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 2;

export async function run({ quiet = true } = {}) {
  const fails = [];
  if (!(TIMEOUTS.frame > 0 && TIMEOUTS.frame < TIMEOUTS.check)) fails.push(`the frame step's limit is ${TIMEOUTS.frame} s, not below the check limit of ${TIMEOUTS.check} s`);
  // A port another process holds is not a failure of the test: another is drawn. The control: with every port of
  // the range taken, the helper gives up with the collision, and start() alone rejects on a taken port.
  const taken = createServer();
  await new Promise((ok) => taken.listen(0, '127.0.0.1', ok));
  const held = taken.address().port;
  if (!(await start(held).then((s) => { s.close(); return false; }, (e) => e.code === 'EADDRINUSE'))) fails.push('start() on a port in use does not reject with the collision');
  if (!(await startFree(held, 1).then(({ server: s }) => { s.close(); return false; }, (e) => e.code === 'EADDRINUSE'))) fails.push('startFree() with only a taken port to draw from does not give up with the collision');
  taken.close();
  const { server, port } = await startFree(6300, 300);
  try {
    const go = (page, name, extra = {}) => inspect(`http://127.0.0.1:${port}/fixtures/${page}`, {
      quiet, out: join(ROOT, 'dist', 'fixtures', `frame-limit-${name}`), widths: [320, 768, 1024], keyWidths: [768], passes: ['light', 'contrast'],
      workers: 1, timings: false, aroundBreakpoints: false, lock: false, timeouts: { frame: LIMIT }, ...extra,
    });
    const spillAt = (r) => [findingsOf(r).find((i) => i.check === 'overflow')?.seen?.light ?? []].flat().join(', ').replace(/\s+/g, '');
    const t0 = Date.now();
    const r = await go('frame-wait.html', 'wait');
    const took = (Date.now() - t0) / 1000;
    const all = findingsOf(r), out = all.filter((i) => i.check === 'timed-out');
    if (r.status !== 'partial') fails.push(`the page: the run is ${r.status}, not partial`);
    if (!/1 step was abandoned at its time limit.*contrast across fixed frames \(768 px, light\)/.test(r.reason ?? '')) fails.push(`the page: the reason does not name the abandoned step: ${r.reason}`);
    if (out.length !== 1) fails.push(`the page: ${out.length} timed-out findings, not 1 (${out.map((i) => i.fingerprint).join('; ')})`);
    const f = out[0];
    if (f) {
      if (f.severity !== 'info') fails.push(`the page: the abandoned step is ${f.severity}, not info`);
      if (f.fingerprint !== 'timed-out|light|768|contrast across fixed frames') fails.push(`the page: the finding is ${f.fingerprint}`);
      if (f.abandoned?.step !== 'contrast across fixed frames' || f.abandoned.limit !== LIMIT) fails.push(`the page: abandoned is ${JSON.stringify(f.abandoned)}`);
      if (!/was abandoned \(768 px, light\): a frame callback of the page did not return within 2 s/.test(f.message)) fails.push(`the page: the message is "${f.message.slice(0, 140)}"`);
    }
    const d = (r.drawing ?? []).filter((x) => x.frames);
    if (!d.length || !d.every((x) => /a frame callback of the page did not finish within 2 s/.test(x.frames.failed ?? ''))) fails.push(`the page: the drawing entries do not say the frames could not be judged: ${JSON.stringify((r.drawing ?? []).map((x) => x.frames))}`);
    if (spillAt(r) !== '320,768,1024') fails.push(`the page: the overflow was seen at ${spillAt(r)}, not at 320, 768 and 1024: the rest of the run did not go on`);
    const other = all.filter((i) => i.check !== 'timed-out' && i.check !== 'overflow');
    if (other.length) fails.push(`the page: reported besides the two: ${other.map((i) => `${i.fingerprint} (${i.severity})`).join('; ')}`);
    if (failing(r, 'warning').length !== 1 || failing(r, 'warning')[0].check !== 'overflow') fails.push(`the page: what fails the run is ${failing(r, 'warning').map((i) => i.fingerprint).join('; ')}, not the overflow alone`);
    if (took > TIMEOUTS.check / 2) fails.push(`the page: the run took ${Math.round(took)} s; the step was not abandoned at its own limit`);

    const twin = await go('frame-wait-clean.html', 'clean');
    if (twin.status !== 'complete') fails.push(`the twin: the run is ${twin.status} (${twin.reason ?? ''})`);
    if (findingsOf(twin).some((i) => i.check !== 'overflow')) fails.push(`the twin: ${findingsOf(twin).filter((i) => i.check !== 'overflow').map((i) => i.fingerprint).join('; ')}`);
    if (!(twin.drawing ?? []).length || !(twin.drawing ?? []).every((x) => x.frames?.count === FRAMES.count)) fails.push(`the twin: its ground was not judged across the fixed frames: ${JSON.stringify((twin.drawing ?? []).map((x) => x.frames))}`);

    // The script flash count on the same page: its controlled clock is paused while a callback runs, so the wait
    // never ends there either. The count is abandoned at the limit, an info finding names the step and the clock
    // that read the flashes instead, and the run stays complete: nothing was left unmeasured.
    const fl = await go('frame-wait.html', 'flash', { passes: ['light', 'motion'], timingEnv: { cpus: 8, load: () => 0 } });
    const ff = findingsOf(fl).find((i) => i.fingerprint === 'flash|controlled-clock');
    if (fl.status !== 'complete') fails.push(`the flash count: the run is ${fl.status} (${fl.reason ?? ''}), not complete`);
    if (fl.motion?.flashClock?.counted !== false) fails.push(`the flash count: motion.flashClock is ${JSON.stringify(fl.motion?.flashClock)}`);
    if (!ff) fails.push(`the flash count: no finding says the count was abandoned (${findingsOf(fl).map((i) => i.fingerprint).join('; ')})`);
    else {
      if (ff.severity !== 'info' || ff.check !== 'flash') fails.push(`the flash count: the finding is ${ff.check}, ${ff.severity}`);
      if (ff.abandoned?.step !== 'the script flash count' || ff.abandoned.limit !== LIMIT) fails.push(`the flash count: abandoned is ${JSON.stringify(ff.abandoned)}`);
      if (!/The script flash count was abandoned \(768 px, motion\).*did not return within 2 s on the controlled clock.*read on the motion pass's own clock/.test(ff.message)) fails.push(`the flash count: the message is "${ff.message.slice(0, 200)}"`);
      if (ff.timing) fails.push('the flash count: the finding carries a timing verdict');
    }
    if (findingsOf(fl).some((i) => i.check === 'timed-out')) fails.push('the flash count: a timed-out finding is reported, which would make the run partial');
    if (findingsOf(twin).some((i) => i.fingerprint === 'flash|controlled-clock')) fails.push('the twin: the flash count is reported as abandoned');

    const off = await go('frame-wait.html', 'off', { fixedFrames: false });
    if (off.status !== 'complete' || findingsOf(off).some((i) => i.check === 'timed-out')) fails.push(`the control: with the fixed frames off the run is ${off.status} with ${findingsOf(off).filter((i) => i.check === 'timed-out').length} timed-out findings; the page itself does not hang`);
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'frame-limit-test.js', usage: 'node scripts/frame-limit-test.js' });
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'A frame callback that never returns on the frame clock is abandoned at its own limit: an info finding, a partial run, and the rest of the width measured.');
  process.exit(fails.length ? 1 : 0);
}
