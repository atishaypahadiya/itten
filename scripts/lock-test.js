// The timing lock (docs/CONTRACT.md, "The timing lock"; inspector/lock.js).
// - A run of the inspector, sampled every 20 ms from outside: a lock file
//   is there only during the timed phases (benchmark and watch load, phase
//   "benchmark"; the motion pass, phase "motion"), in both of them, never
//   while the jobs run, and it is gone when the run ends. The control: the
//   same run with the lock off shows no lock at any sample.
// - A process holding the lock removes it on SIGINT and on SIGTERM, and still
//   dies of the signal. Two processes each hold and remove only their own.
// - At start, a lock of a dead pid, a lock past its expiry and an unreadable
//   file of a dead pid are deleted; a live lock and an unreadable file of a
//   live pid are kept.
// - ITTEN_LOCK_DIR moves the directory; it is made with mode 0700; the file
//   holds the format, pid, phase, taken, expires and project, and nothing else.
// Usage: node scripts/lock-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { take, sweep, locks, lockDir, lockFile, stateOf, FORMAT } from '../inspector/lock.js';
import { readArgs } from '../inspector/usage.js';

const ME = fileURLToPath(import.meta.url);
const ROOT = join(dirname(ME), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Child modes. hold: take the lock and wait to be killed. inspect: one run.
if (process.argv[2] === '--hold') {
  take('motion', 30);
  console.log('held');
  setInterval(() => {}, 1000);
} else if (process.argv[2] === '--inspect') {
  const { inspect, loadSystem } = await import('../inspector/inspect.js');
  const { system } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  const r = await inspect(process.argv[3], { system, systemPath: 'fixtures/itten.system.json', quiet: true, out: process.argv[4], widths: [1024], keyWidths: [1024], passes: ['light', 'motion'], timings: false, aroundBreakpoints: false, lock: process.argv[5] !== 'off' });
  console.log(JSON.stringify({ started: r.started, phases: r.schedule.phases, status: r.status }));
  process.exit(0);
}

const lockIn = (dir) => { try { return readdirSync(dir).filter((n) => /^timing-\d+\.json$/.test(n)); } catch { return []; } };
const holder = (dir) => new Promise((ok, no) => {
  const c = spawn(process.execPath, [ME, '--hold'], { env: { ...process.env, ITTEN_LOCK_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
  c.stdout.once('data', () => ok(c));
  c.once('error', no);
});
const ended = (c) => new Promise((ok) => c.once('exit', (code, signal) => ok({ code, signal })));

export async function run() {
  const fails = [];
  const tmp = mkdtempSync(join(tmpdir(), 'itten-lock-'));
  const port = 5175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  try {
    // Where the lock lives.
    if (lockDir({ ITTEN_LOCK_DIR: '/a/b' }) !== '/a/b') fails.push('ITTEN_LOCK_DIR does not move the lock directory');
    if (lockDir({ XDG_STATE_HOME: '/x' }) !== '/x/itten/locks') fails.push('without ITTEN_LOCK_DIR the directory is not $XDG_STATE_HOME/itten/locks');
    if (!lockDir({}).endsWith('/.local/state/itten/locks')) fails.push('without either variable the directory is not ~/.local/state/itten/locks');

    // One run, sampled from outside.
    for (const mode of ['on', 'off']) {
      const dir = join(tmp, `run-${mode}`);
      const samples = [];
      const child = spawn(process.execPath, [ME, '--inspect', `http://127.0.0.1:${port}/fixtures/breakpoint-clean.html`, join(ROOT, 'dist', 'fixtures', `lock-${mode}`), mode], { env: { ...process.env, ITTEN_LOCK_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      const timer = setInterval(() => {
        const names = lockIn(dir);
        let phase = null;
        if (names.length) { try { phase = JSON.parse(readFileSync(join(dir, names[0]), 'utf8')).phase; } catch { phase = '?'; } }
        samples.push({ t: Date.now(), n: names.length, phase });
      }, 20);
      const end = await ended(child);
      clearInterval(timer);
      if (end.code !== 0) { fails.push(`lock ${mode}: the run exited ${end.code ?? end.signal}`); continue; }
      const r = JSON.parse(out.trim().split('\n').at(-1));
      const t0 = Date.parse(r.started);
      const at = (name) => r.phases.find((p) => p.name === name);
      const span = (a, b) => [t0 + at(a).start, t0 + at(b).end];
      const bench = span('benchmark', 'watch load'), motion = span('motion', 'motion'), jobs = span('jobs', 'jobs');
      const within = (s, [a, b], slack = 500) => s.t >= a - slack && s.t <= b + slack;
      const withLock = samples.filter((s) => s.n);
      if (mode === 'off') { if (withLock.length) fails.push(`control: with the lock off, ${withLock.length} samples saw a lock file`); continue; }
      if (lockIn(dir).length) fails.push('a lock file is left after the run ended');
      if (existsSync(dir) && (statSync(dir).mode & 0o777) !== 0o700) fails.push(`the lock directory has mode ${(statSync(dir).mode & 0o777).toString(8)}, not 700`);
      if (!withLock.some((s) => s.phase === 'benchmark' && within(s, bench))) fails.push('no lock was seen during the benchmark and the watch load');
      if (!withLock.some((s) => s.phase === 'motion' && within(s, motion))) fails.push('no lock was seen during the motion pass');
      const stray = withLock.filter((s) => !(s.phase === 'benchmark' && within(s, bench)) && !(s.phase === 'motion' && within(s, motion)));
      if (stray.length) fails.push(`${stray.length} samples saw a lock outside its phase (first: ${stray[0].phase} at ${stray[0].t - t0} ms; benchmark ${bench.map((x) => x - t0)}, motion ${motion.map((x) => x - t0)})`);
      const during = samples.filter((s) => s.t > jobs[0] + 500 && s.t < jobs[1] - 500);
      if (during.some((s) => s.n)) fails.push('a lock was held while the jobs ran');
      if (withLock.some((s) => s.n > 1)) fails.push('one process held more than one lock file');
      // Every sample in the timed phases, well inside them, has the lock.
      for (const [name, sp] of [['benchmark', bench], ['motion', motion]]) {
        const inside = samples.filter((s) => s.t > sp[0] + 500 && s.t < sp[1] - 500);
        if (inside.some((s) => !s.n)) fails.push(`the ${name} phase ran for a time with no lock`);
      }
    }

    // Signals, and two processes at once.
    const dir = join(tmp, 'signals');
    for (const sig of ['SIGINT', 'SIGTERM']) {
      const a = await holder(dir), b = await holder(dir);
      const names = lockIn(dir).sort();
      if (names.join() !== [a.pid, b.pid].map((p) => `timing-${p}.json`).sort().join()) fails.push(`${sig}: two processes hold ${names.join(', ') || 'no locks'}, not one each`);
      const l = JSON.parse(readFileSync(lockFile(a.pid, { ITTEN_LOCK_DIR: dir }), 'utf8'));
      if (Object.keys(l).sort().join() !== 'expires,format,phase,pid,project,taken') fails.push(`the lock holds ${Object.keys(l).join(', ')}`);
      if (l.format !== FORMAT || l.pid !== a.pid || l.phase !== 'motion' || Math.abs(Date.parse(l.expires) - Date.parse(l.taken) - 90000) > 50) fails.push(`the lock's contents are wrong: ${JSON.stringify(l)}`);
      if (stateOf(lockFile(a.pid, { ITTEN_LOCK_DIR: dir })).state !== 'active') fails.push('a reader does not take a live lock as active');
      a.kill(sig);
      const end = await ended(a);
      if (end.signal !== sig) fails.push(`${sig}: the process ended with ${end.signal ?? `code ${end.code}`}, not the signal`);
      if (lockIn(dir).join() !== `timing-${b.pid}.json`) fails.push(`${sig}: after one process was stopped, the directory holds ${lockIn(dir).join(', ') || 'nothing'}, not the other's lock alone`);
      b.kill(sig);
      await ended(b);
      if (lockIn(dir).length) fails.push(`${sig}: a lock is left after both processes were stopped`);
    }

    // Stale locks at start.
    const sdir = join(tmp, 'stale');
    mkdirSync(sdir, { recursive: true });
    const env = { ITTEN_LOCK_DIR: sdir };
    const dead = spawnSync(process.execPath, ['-e', '']).pid;
    const live = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    const live2 = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    const live3 = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    try {
      const now = Date.now(), iso = (ms) => new Date(ms).toISOString();
      const lock = (pid, expires) => writeFileSync(lockFile(pid, env), JSON.stringify({ format: FORMAT, pid, phase: 'motion', taken: iso(now - 1000), expires: iso(expires), project: '/p' }));
      lock(dead, now + 60000);            // dead pid: stale
      lock(live.pid, now - 1);            // past its expiry: stale
      lock(live2.pid, now + 60000);       // live: kept
      writeFileSync(lockFile(live3.pid, env), '{ half');  // unreadable, live pid: kept, and active to a reader
      writeFileSync(join(sdir, 'timing-999999999.json'), 'x'); // unreadable, dead pid: deleted
      writeFileSync(join(sdir, 'timing-1.json.tmp'), 'x'); // not a lock: left alone, and no reader counts it
      if (stateOf(lockFile(live3.pid, env)).state !== 'active') fails.push('a reader does not take an unreadable lock as active');
      if (stateOf(lockFile(dead, env)).state !== 'stale' || stateOf(lockFile(live.pid, env)).state !== 'stale') fails.push('a reader does not take a dead or expired lock as stale');
      if (locks(env).length !== 5) fails.push(`a reader counts ${locks(env).length} locks, not 5 (the .tmp file is not one)`);
      const release = take('benchmark', 1, { env });
      const left = lockIn(sdir).sort().join();
      const want = [live2.pid, live3.pid, process.pid].map((p) => `timing-${p}.json`).sort().join();
      if (left !== want) fails.push(`after a run started, the directory holds ${left}; it should hold ${want}`);
      release();
      if (existsSync(lockFile(process.pid, env))) fails.push('release() left the lock');
      if (sweep(env).length) fails.push('a second sweep deleted a lock it should keep');
    } finally { for (const c of [live, live2, live3]) c.kill('SIGKILL'); }
  } finally {
    server.close();
    rmSync(tmp, { recursive: true, force: true });
  }
  return fails;
}

if (process.argv[1] === ME && !['--hold', '--inspect'].includes(process.argv[2])) {
  readArgs(process.argv.slice(2), { name: 'lock-test.js', usage: 'node scripts/lock-test.js' });
  const fails = await run();
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'The timing lock is held only while timing, removed on exit and on signals, and stale locks are cleared.');
  process.exit(fails.length ? 1 : 0);
}
