// When a timing-based finding counts (docs/CONTRACT.md, "Timing findings").
// The rule is shared with KERCKHOFFS and ERLANG. ITTEN's timed verdicts are
// absolute: one measurement against a fixed limit. Such a verdict keeps the
// environment gate, because steady load biases every measurement the same
// way and does not show as spread: the 1-minute load average must be below
// half the CPU count before and after, and the browser must not draw in
// software. On a machine that passes, the finding is measured 3 times: over
// its limit every time, it is a finding; over it in some and not in others,
// it is info, "timing unreliable". (Over it in none, there is no finding to
// judge.) The spread of the measurements is recorded and gates nothing.
// A verdict that can be judged on a count is not timed at all: a script's
// flashes are counted on a controlled clock (inspect.js, scriptFlashes).

export const REASON = 'timing unreliable';
export const RUNS = 3;

// SwiftShader, llvmpipe and softpipe draw WebGL on the CPUs.
export const isSoftware = (renderer) => /swiftshader|llvmpipe|softpipe|software/i.test(renderer ?? '');

// The findings that rest on a measured time, and the phase that times them:
// long frames, and a script's flashes that only an interaction starts (the
// motion pass); what the page adds
// after it went still, a page that never goes still, and a network that
// does not go quiet (the watch load).
export function timedIn(f) {
  const fp = f.fingerprint ?? `${f.check}|${f.key}`;
  if (f.check === 'frame-timing') return 'motion';
  // Only a flash the controlled clock did not count: one a hover, a focus or a click starts (inspect.js).
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

// The verdict for one finding. values: what each measurement that was over
// the limit measured; tries: how many measurements were made.
export function judge(values, env, tries = RUNS) {
  const causes = environmentCauses(env);
  const vals = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const spread = spreadOf(vals);
  // A run that cannot count is not repeated, so its count is not a cause of its own.
  if (causes.length) { /* the environment says enough */ }
  else if (tries < RUNS) causes.push(`measured ${tries === 1 ? 'once' : `${tries} times`}, fewer than ${RUNS}`);
  else if (vals.length < tries) causes.push(`over its limit in ${vals.length} of ${tries} measurements`);
  return { reliable: !causes.length, ...(causes.length ? { reason: REASON, causes } : {}), values: vals, tries, spread: spread === null || !Number.isFinite(spread) ? null : Math.round(spread * 1000) / 1000, environment: env };
}
