// The page server's health (0.5). fixtures/health.html is served by a server
// that fails chosen requests, one job at a time (one worker, the light pass,
// 320, 768 and 1440 px, so the requests come in a known order: the watch
// load, then each job).
// - A healthy server: complete; the overflow is seen at all three widths. The
//   page's own 404, there on every load, sends no job round again.
// - The stylesheet reset on the 768 px job's load only: the job is run
//   again, the run is complete, and the report names the job and the request.
// - Reset on both of that job's loads, and answered 503 on both: the job is
//   dropped; the report is partial, names the job and the request, and holds
//   no finding seen at 768 px.
// - The stylesheet failing for every job: partial, never refused, with every
//   job dropped and no finding from any.
// - The page itself made to stall once: the job is run again and the run is
//   complete. Stalled every time: partial, every job dropped, never refused.
// - The control: with the health check off (health: false), the reset
//   stylesheet leaves the run complete with nothing said, as before 0.5.
// Usage: node scripts/health-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname, extname } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspect, loadSystem } from '../inspector/inspect.js';
import { findingsOf } from '../inspector/finding.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

// fault(file, n): what to do with the n-th request for a file: 'reset',
// 503, 'stall', or nothing.
function serve(port, fault) {
  const count = new Map(), open = new Set();
  const server = createServer((req, res) => {
    const file = new URL(req.url, 'http://x').pathname.split('/').pop();
    const n = (count.get(file) ?? 0) + 1;
    count.set(file, n);
    const f = fault(file, n);
    if (f === 'reset') return req.socket.destroy();
    if (f === 'stall') return;   // never answered; the socket is closed with the server
    if (typeof f === 'number') { res.writeHead(f, { Connection: 'close' }); return res.end(); }
    try {
      const body = readFileSync(join(ROOT, 'fixtures', file));
      // Connection: close, so the browser does not send a reset request again by itself (it does on a reused connection).
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', Connection: 'close' });
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  server.on('connection', (s) => { open.add(s); s.on('close', () => open.delete(s)); });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ close: () => { for (const s of open) s.destroy(); server.close(); } })));
}

export async function run({ quiet = true } = {}) {
  const fails = [];
  const { system } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  let port = 5700 + Math.floor(Math.random() * 200);
  const go = async (name, fault, extra = {}) => {
    const server = await serve(++port, fault);
    try {
      return await inspect(`http://127.0.0.1:${port}/health.html`, {
        system, systemPath: 'fixtures/itten.system.json', quiet, out: join(ROOT, 'dist', 'fixtures', `health-${name}`),
        widths: [320, 768, 1440], keyWidths: [1440], passes: ['light'], workers: 1, timings: false, aroundBreakpoints: false, lock: false, ...extra,
      });
    } catch (e) { fails.push(`${name}: the run threw: ${String(e.stack || e).split('\n').slice(4, 12).join(' | ')}`); return null; } finally { server.close(); }
  };
  const css = (...ns) => (file, n) => (file === 'health.css' && ns.includes(n) ? 'reset' : null);
  const spill = (r) => findingsOf(r).find((i) => i.check === 'overflow');
  const seenAt = (r) => spill(r)?.seen?.light ?? null;
  const jobs = (list) => list.map((j) => j.job).join('; ');
  const named = (list, what) => list.every((j) => j.failed.length && j.failed.every((q) => what.test(`${q.url} ${q.why}`)));

  // The stylesheet's requests, in order: 1 the watch load, 2 the 320 px job, 3 the 768 px job, ...
  const ok = await go('ok', () => null);
  if (ok) {
    if (ok.status !== 'complete') fails.push(`healthy: the run is ${ok.status} (${ok.reason})`);
    if (seenAt(ok) !== '320, 768, 1440') fails.push(`healthy: the overflow is seen at ${seenAt(ok)}`);
    if (ok.health.retried.length || ok.health.dropped.length) fails.push(`healthy: jobs run again or dropped: ${JSON.stringify(ok.health)} (the page's own 404 is not the server's failure)`);
    if (!findingsOf(ok).some((i) => i.fingerprint === 'page-load|requests')) fails.push('healthy: the page\'s own failed request is not reported');
  }

  const once = await go('once', css(3));
  if (once) {
    if (once.status !== 'complete') fails.push(`failing once: the run is ${once.status} (${once.reason})`);
    if (jobs(once.health.retried) !== '768 px, light' || once.health.dropped.length) fails.push(`failing once: run again ${jobs(once.health.retried) || 'none'}, dropped ${jobs(once.health.dropped) || 'none'}`);
    else if (!named(once.health.retried, /health\.css/)) fails.push(`failing once: the failed request is not named: ${JSON.stringify(once.health.retried)}`);
    if (seenAt(once) !== '320, 768, 1440') fails.push(`failing once: the overflow is seen at ${seenAt(once)}`);
    if (!once.notJudged.some((n) => /run again.*768 px, light.*health\.css/.test(n))) fails.push('failing once: the report does not note the job that was run again');
  }

  for (const [name, fault, what] of [['reset twice', css(3, 4), /health\.css/], ['503 twice', (file, n) => (file === 'health.css' && (n === 3 || n === 4) ? 503 : null), /health\.css HTTP 503/]]) {
    const r = await go(name.replace(/ /g, '-'), fault);
    if (!r) continue;
    if (r.status !== 'partial') fails.push(`${name}: the run is ${r.status}`);
    if (jobs(r.health.dropped) !== '768 px, light' || r.health.retried.length) fails.push(`${name}: dropped ${jobs(r.health.dropped) || 'none'}, run again ${jobs(r.health.retried) || 'none'}`);
    else if (!named(r.health.dropped, what)) fails.push(`${name}: the failed request is not named: ${JSON.stringify(r.health.dropped)}`);
    if (!/768 px, light/.test(r.reason ?? '') || !/health\.css/.test(r.reason ?? '')) fails.push(`${name}: the reason does not name the job and the request: ${r.reason}`);
    if (seenAt(r) !== '320, 1440') fails.push(`${name}: the overflow is seen at ${seenAt(r)}; nothing from the dropped job may be kept`);
    if (findingsOf(r).some((i) => i.check === 'timed-out')) fails.push(`${name}: a dropped job is reported as a timeout`);
  }

  const all = await go('all', (file, n) => (file === 'health.css' && n > 1 ? 'reset' : null));
  if (all) {
    if (all.status !== 'partial') fails.push(`every job failing: the run is ${all.status}`);
    if (all.health.dropped.length !== 3) fails.push(`every job failing: ${all.health.dropped.length} jobs dropped, not 3`);
    const kept = findingsOf(all).filter((i) => i.check !== 'page-load');
    if (kept.length) fails.push(`every job failing: findings from dropped jobs: ${kept.map((i) => i.fingerprint).join('; ')}`);
  }

  // The page itself: its requests are 1 the watch load, 2 the 320 px job, 3 the 768 px job, ...
  const stall = (...ns) => (file, n) => (file === 'health.html' && (ns.length ? ns.includes(n) : n > 1) ? 'stall' : null);
  const slow = await go('stall-once', stall(3), { timeouts: { load: 4, check: 4 } });
  if (slow) {
    if (slow.status !== 'complete') fails.push(`a load stalled once: the run is ${slow.status} (${slow.reason})`);
    if (jobs(slow.health.retried) !== '768 px, light') fails.push(`a load stalled once: run again ${jobs(slow.health.retried) || 'none'}`);
    else if (!named(slow.health.retried, /did not finish within 4 s/)) fails.push(`a load stalled once: the cause is not named: ${JSON.stringify(slow.health.retried)}`);
    if (seenAt(slow) !== '320, 768, 1440') fails.push(`a load stalled once: the overflow is seen at ${seenAt(slow)}`);
  }
  const dead = await go('stall-all', stall(), { timeouts: { load: 4, check: 4 } });
  if (dead) {
    if (dead.status !== 'partial') fails.push(`every load stalled: the run is ${dead.status}, not partial`);
    if (dead.health.dropped.length !== 3) fails.push(`every load stalled: ${dead.health.dropped.length} jobs dropped, not 3`);
    // A crop's own load may run out of its limit too; that step is reported, and is not a job's finding.
    if (findingsOf(dead).some((i) => i.check === 'overflow')) fails.push('every load stalled: findings from dropped jobs');
    if (!/dropped/.test(dead.reason ?? '')) fails.push(`every load stalled: the reason does not say the jobs were dropped: ${dead.reason}`);
  }

  const off = await go('control', css(3, 4), { health: false });
  if (off && (off.status !== 'complete' || off.health.dropped.length)) fails.push('control: with the health check off the run is not complete, so the fixture does not show what the check adds');
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'health-test.js', usage: 'node scripts/health-test.js' });
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'A job the server fails is run again once, then dropped: the run is partial, names the job and its requests, and is never refused.');
  process.exit(fails.length ? 1 : 0);
}
