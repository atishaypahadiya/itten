// How long each kind of job took, kept between runs to estimate the next
// one. The file is dist/timings.json in ITTEN's folder (git ignores dist/),
// or ITTEN_TIMINGS. Per page and per kind of job, the last 20 times in
// seconds; an estimate is their median, then the median for that kind on
// any page, then a fixed guess.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const TIMINGS_FILE = process.env.ITTEN_TIMINGS || join(HERE, '..', 'dist', 'timings.json');
const KEEP = 20;

// Seconds, before any run has been recorded.
const GUESS = { bench: 4, watch: 8, scan: 10, light: 3, 'light-key': 8, '200': 2.5, resize: 3, '2x': 3, engine: 3, 'engine-resize': 3, crop: 4, motion: 90 };
const family = (kind) => kind.replace(/:.*$/, '');

// A page is its host and path; a local server's port changes from run to run.
export function timingKey(url) {
  try {
    const u = new URL(url);
    return /^(127\.0\.0\.1|localhost|\[::1\])$/.test(u.hostname) ? u.pathname : u.host + u.pathname;
  } catch { return url; }
}

export function readTimings(path = TIMINGS_FILE) {
  try {
    const t = JSON.parse(readFileSync(path, 'utf8'));
    if (t && t.version === 1 && t.times) return t;
  } catch { /* none yet */ }
  return { version: 1, times: {} };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };

// The estimate for one job, and where it came from: 'page', 'any page' or 'guess'.
export function estimate(t, page, kind) {
  const own = t.times[`${page}|${kind}`];
  if (own?.length) return { s: median(own), from: 'page' };
  const any = t.times[`*|${kind}`];
  if (any?.length) return { s: median(any), from: 'any page' };
  return { s: GUESS[kind] ?? GUESS[family(kind)] ?? 3, from: 'guess' };
}

export function record(t, page, kind, s) {
  for (const k of [`${page}|${kind}`, `*|${kind}`]) {
    const a = (t.times[k] ??= []);
    a.push(Math.round(s * 100) / 100);
    if (a.length > KEEP) a.splice(0, a.length - KEEP);
  }
}

export function writeTimings(t, path = TIMINGS_FILE) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(t, null, 1));
  } catch { /* an estimate is not worth failing a run */ }
}

// How long jobs of these lengths take on n workers that each take the next
// job as they come free, in the order given: the time the last one ends.
export function makespan(seconds, n) {
  const free = Array(Math.max(1, n)).fill(0);
  for (const s of seconds) { let i = 0; for (let j = 1; j < free.length; j++) if (free[j] < free[i]) i = j; free[i] += s; }
  return Math.max(0, ...free);
}

export function duration(s) {
  s = Math.round(s);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return m < 60 ? `${m} min${r ? ` ${String(r).padStart(2, '0')} s` : ''}` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
