// The timing lock (docs/CONTRACT.md, "The timing lock"). While ITTEN times
// anything (the benchmark and the watch load before the jobs; the motion
// pass after them) it holds a lock file, so a tool that generates load on
// the same machine can wait: load takes CPU from the browser being timed.
//
// One file per ITTEN process, timing-<pid>.json, in
// ${ITTEN_LOCK_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/itten/locks},
// a directory made with mode 0700. The file is written to a .tmp name and
// renamed, so a reader never sees half a file. It is removed when the phase
// ends, when the process exits, and on SIGINT and SIGTERM. ITTEN writes,
// renews and removes its own lock; other tools only read.

import { mkdirSync, writeFileSync, renameSync, rmSync, readdirSync, readFileSync, statSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const FORMAT = 'itten-timing-lock/1';
export const PHASES = ['benchmark', 'motion'];
const SLACK = 60000, MAX = 15 * 60000, RENEW = 30000;

export const lockDir = (env = process.env) => env.ITTEN_LOCK_DIR || join(env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'itten', 'locks');
export const lockFile = (pid = process.pid, env = process.env) => join(lockDir(env), `timing-${pid}.json`);

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

// How a reader takes one lock file: 'active' (a live process, not past its
// expiry, or a file that cannot be read), or 'stale' (a dead pid, or past
// its expiry). A reader refuses to generate load while any lock is active.
export function stateOf(path, now = Date.now()) {
  let l;
  try { l = JSON.parse(readFileSync(path, 'utf8')); } catch { return { state: 'active', why: 'unreadable' }; }
  if (!l || l.format !== FORMAT || !Number.isInteger(l.pid) || Number.isNaN(Date.parse(l.expires))) return { state: 'active', why: 'unreadable' };
  if (!alive(l.pid)) return { state: 'stale', why: 'dead pid', lock: l };
  if (now >= Date.parse(l.expires)) return { state: 'stale', why: 'expired', lock: l };
  return { state: 'active', lock: l };
}

// Every lock in the directory with its state.
export function locks(env = process.env, now = Date.now()) {
  let names = [];
  try { names = readdirSync(lockDir(env)); } catch { return []; }
  return names.filter((n) => /^timing-\d+\.json$/.test(n)).map((n) => ({ file: join(lockDir(env), n), ...stateOf(join(lockDir(env), n), now) }));
}

// Deletes stale locks, never a live one, never this process's own. A file
// that cannot be read is deleted only when the pid in its name is dead or it
// was last written more than 15 minutes ago.
export function sweep(env = process.env, now = Date.now()) {
  const gone = [];
  for (const l of locks(env, now)) {
    const pid = Number(l.file.match(/timing-(\d+)\.json$/)[1]);
    if (pid === process.pid) continue;
    let old = false;
    try { old = now - statSync(l.file).mtimeMs > MAX; } catch { continue; }
    if (l.state === 'stale' || (l.why === 'unreadable' && (!alive(pid) || old))) { rmSync(l.file, { force: true }); gone.push(l.file); }
  }
  return gone;
}

let held = null; // { file, taken, expires, timer, data }
const write = () => {
  const tmp = held.file + '.tmp';
  writeFileSync(tmp, JSON.stringify({ ...held.data, taken: new Date(held.taken).toISOString(), expires: new Date(held.expires).toISOString() }) + '\n', { mode: 0o600 });
  renameSync(tmp, held.file);
};
const drop = () => {
  if (!held) return;
  clearInterval(held.timer);
  rmSync(held.file, { force: true });
  rmSync(held.file + '.tmp', { force: true });
  held = null;
};
const onSignal = (sig) => { drop(); process.removeListener(sig, onSignal); process.kill(process.pid, sig); };
let hooked = false;

// Takes the lock for a phase expected to last `seconds` (from earlier runs).
// It expires that long plus 60 s after it was taken, never more than 15
// minutes after; while the phase runs over, it is renewed, at most every
// 30 s. Returns release(). A lock that cannot be written never fails a run.
export function take(phase, seconds, { project = process.cwd(), env = process.env } = {}) {
  if (!PHASES.includes(phase)) throw new Error(`"${phase}" is not a timed phase (${PHASES.join(', ')})`);
  try {
    drop();
    const dir = lockDir(env);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    try { chmodSync(dir, 0o700); } catch { /* not ours to change */ }
    sweep(env);
    const taken = Date.now();
    held = { file: lockFile(process.pid, env), taken, expires: taken + Math.min(MAX, Math.max(0, seconds) * 1000 + SLACK), data: { format: FORMAT, pid: process.pid, phase, project } };
    write();
    const mine = held;
    held.timer = setInterval(() => {
      if (held !== mine) return;
      const cap = mine.taken + MAX;
      if (mine.expires - Date.now() < SLACK && mine.expires < cap) { mine.expires = Math.min(cap, Date.now() + SLACK); try { write(); } catch { /* keep the old expiry */ } }
    }, RENEW);
    held.timer.unref();
    if (!hooked) { hooked = true; process.on('exit', drop); process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal); }
    return () => { if (held === mine) drop(); };
  } catch {
    held = null;
    return () => {};
  }
}
