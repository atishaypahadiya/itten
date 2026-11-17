// The inspector never hangs. fixtures/hang.html blocks its main thread for
// good when it is loaded at 768 px. Inspected at 320, 768 and 1024 px, with
// 768 px as a key width (contrast, 2×, motion) and in WebKit, every pass
// that loads it at 768 px must time out, record a timed-out error naming
// the width and the step, close its browser context and go on: 1024 px must
// still be measured after 768 px, and the run must finish. That includes
// the resize from 768 px to 320 px, in Chromium and in WebKit: it loads the
// page at 768 px first. A resize from 320 px to 768 px loads at 320 px and
// must be measured.
// The jobs run on three workers, so a hung job must not hold the others.
// And the watchdog: a process that makes no progress for its limit (here
// about a second) must stop with exit code 124 and name its last step.
// Usage: node scripts/timeout-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Short limits, in seconds, so the test takes minutes, not the defaults' hours.
const LIMITS = { load: 10, check: 10, width: 30, motion: 30, close: 10 };

export async function run({ quiet = true } = {}) {
  const fails = [];
  // The watchdog, in a child process that stalls after one step.
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const m = await import(${JSON.stringify(new URL('../inspector/inspect.js', import.meta.url).href)}); m.startWatchdog(0.02); m.mark('a step that never ends'); setInterval(() => {}, 1000);`], { encoding: 'utf8', timeout: 60000 });
  if (child.status !== 124) fails.push(`the watchdog did not stop a stalled process with exit code 124 (status ${child.status}, signal ${child.signal})`);
  if (!/no progress for [\d.]+ (s|min)\. Last step: a step that never ends/.test(child.stderr)) fails.push(`the watchdog did not name the last step: ${child.stderr.trim().slice(0, 200)}`);
  const { system } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  const port = 4175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  const t0 = Date.now();
  try {
    const r = await inspect(`http://127.0.0.1:${port}/fixtures/hang.html`, {
      system, systemPath: 'fixtures/itten.system.json', quiet, out: join(ROOT, 'dist', 'fixtures', 'hang'),
      widths: [320, 768, 1024], keyWidths: [320, 768], engines: ['webkit'], engineWidths: [320, 768, 1024], timeouts: LIMITS, workers: 3, timings: false,
    });
    const timed = r.issues.filter((i) => i.check === 'timed-out');
    // The report gives the widths a finding was seen at as text: "320, 768".
    const ws = (v) => String(v ?? '').split(',').map((x) => Number(x.trim())).filter(Boolean);
    const at = (mode) => timed.find((i) => ws(i.seen[mode]).includes(768));
    for (const mode of ['light', '200% text', '2x', 'motion', 'webkit']) {
      const it = at(mode);
      if (!it) { fails.push(`no timed-out finding at 768 px in the ${mode} pass`); continue; }
      if (it.severity !== 'error') fails.push(`the ${mode} timed-out finding is a ${it.severity}, not an error`);
      if (!/^[A-Z].* did not finish within \d+ s \(768 px/.test(it.message)) fails.push(`the ${mode} timed-out finding does not give the width and the step: ${it.message.slice(0, 160)}`);
    }
    for (const mode of ['resize', 'WebKit resize']) {
      const it = timed.find((i) => String(i.seen[mode] ?? '').split(', ').includes('768→320'));
      if (!it) fails.push(`no timed-out finding for the ${mode} from 768 px to 320 px, which loads the page at 768 px`);
    }
    const loadsAt768 = (s) => /^768→|^768$/.test(s.trim());
    const elsewhere = timed.filter((i) => Object.values(i.seen).flatMap((v) => String(v).split(',')).some((s) => !loadsAt768(s)));
    if (elsewhere.length) fails.push(`timed out at other widths: ${elsewhere.map((i) => i.fingerprint).join('; ')}`);
    const measured = r.distinct.perWidth.map((p) => p.w);
    if (!measured.includes(320) || !measured.includes(1024)) fails.push(`the widths either side of 768 px were not both measured in Chromium: ${measured.join(', ') || 'none'}`);
    if (r.engines.notRun?.webkit) fails.push(`WebKit did not run: ${r.engines.notRun.webkit}`);
    if (!quiet) console.log(`Finished in ${Math.round((Date.now() - t0) / 1000)} s with ${timed.length} timed-out findings: ${timed.map((i) => i.message.split('. ')[0]).join('; ')}`);
  } catch (e) {
    fails.push(`the run failed: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `\n${fails.length} failure(s).` : '\nNever hangs: passes.');
  process.exit(fails.length ? 1 : 0);
}
