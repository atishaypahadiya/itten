// When a timing-based finding counts (docs/CONTRACT.md, "Timing findings").
// The rule is shared with KERCKHOFFS and ERLANG: a finding that rests on a
// measured time counts only if it was measured at least 3 times with a
// relative spread of at most 10%, the 1-minute load average was below half
// the CPU count before and after, and the browser was not drawing in
// software. Otherwise it is reported as info with the reason "timing
// unreliable" and the environment recorded, and it never fails a run.

export const REASON = 'timing unreliable';
export const RUNS = 3, SPREAD = 0.1;

// SwiftShader, llvmpipe and softpipe draw WebGL on the CPUs.
export const isSoftware = (renderer) => /swiftshader|llvmpipe|softpipe|software/i.test(renderer ?? '');

// The findings that rest on a measured time, and the phase that times them:
// long frames and a script's flashes (the motion pass); what the page adds
// after it went still, a page that never goes still, and a network that
// does not go quiet (the watch load).
export function timedIn(f) {
  const fp = f.fingerprint ?? `${f.check}|${f.key}`;
  if (f.check === 'frame-timing') return 'motion';
  if (f.check === 'flash' && /\|script$/.test(fp)) return 'motion';
  if (f.check === 'page-load' && /\|(never-still|late|busy)$/.test(fp)) return 'benchmark';
  return null;
}

// (max - min) / median.
export function spreadOf(values) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return mid === 0 ? (s.at(-1) === s[0] ? 0 : Infinity) : (s.at(-1) - s[0]) / mid;
}

// Why the environment alone makes timing unreliable, as sentences; empty
// when it does not. env: { cpus, load: { before, after }, renderer }.
export function environmentCauses(env) {
  const out = [];
  if (isSoftware(env.renderer)) out.push(`the browser draws in software (${env.renderer})`);
  const half = env.cpus / 2, r = (x) => Math.round(x * 100) / 100;
  const over = ['before', 'after'].filter((k) => typeof env.load?.[k] === 'number' && env.load[k] >= half);
  if (over.length) out.push(`the 1-minute load average was ${over.map((k) => `${r(env.load[k])} ${k}`).join(' and ')}, not below half of ${env.cpus} CPUs`);
  return out;
}

// The verdict for one finding's measurements.
export function judge(values, env) {
  const causes = environmentCauses(env);
  const vals = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const spread = spreadOf(vals);
  // A run that cannot count is not repeated, so its count is not a cause of its own.
  if (causes.length) { /* the environment says enough */ } else if (vals.length < RUNS) causes.push(`measured ${vals.length === 1 ? 'once' : `${vals.length} times`}, fewer than ${RUNS}`);
  else if (spread > SPREAD) causes.push(`its ${vals.length} measurements spread ${Math.round(spread * 100)}%, more than ${SPREAD * 100}%`);
  return { reliable: !causes.length, ...(causes.length ? { reason: REASON, causes } : {}), values: vals, spread: spread === null || !Number.isFinite(spread) ? null : Math.round(spread * 1000) / 1000, environment: env };
}
