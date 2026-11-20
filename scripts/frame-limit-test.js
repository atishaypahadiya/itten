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
// - The twin: complete, judged across the fixed frames, the overflow only.
// - The control: the same page with the fixed frames off is complete and
//   has no such finding, so the wait is the frame clock's, not the page's.
// Usage: node scripts/frame-limit-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, FRAMES, TIMEOUTS } from '../inspector/inspect.js';
import { findingsOf } from '../inspector/finding.js';
import { failing } from '../inspector/baseline.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 2;

export async function run({ quiet = true } = {}) {
  const fails = [];
  if (!(TIMEOUTS.frame > 0 && TIMEOUTS.frame < TIMEOUTS.check)) fails.push(`the frame step's limit is ${TIMEOUTS.frame} s, not below the check limit of ${TIMEOUTS.check} s`);
  const port = 6300 + Math.floor(Math.random() * 300);
  const server = await start(port);
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
