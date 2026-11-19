// Command lines, read strictly (docs/CONTRACT.md, "Exit codes"). A command
// given a flag it does not know, a flag without its value, or more
// arguments than it takes prints what is wrong and exits 64 (EX_USAGE in
// sysexits.h) before it does anything: no report, no browser.
//
// The exit codes every ITTEN command shares with KERCKHOFFS and ERLANG:
//   0   complete, and no failing finding
//   1   failing findings, whether the run is complete or partial
//   2   refused: nothing was judged
//   3   partial, and no failing finding
//   64  bad usage
// Errors and warnings fail a run; info never does.

export const EXIT = { ok: 0, failing: 1, refused: 2, partial: 3, usage: 64 };

// The code for a report/1 and the number of its failing findings.
export const exitCode = (status, failing) => (status === 'refused' ? EXIT.refused : failing > 0 ? EXIT.failing : status === 'partial' ? EXIT.partial : EXIT.ok);

export class UsageError extends Error {}

// flags: { name: 'flag' (no value) | 'value' (one, required) | 'optional'
// (a value or none) | 'list' (a value, may repeat) }. positional: [min, max].
export function parse(argv, { flags = {}, positional = [0, 0] } = {}) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--') || a === '--') { o._.push(a); continue; }
    const k = a.slice(2), kind = flags[k];
    if (!kind) throw new UsageError(`unknown flag ${a}`);
    const next = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
    if (kind === 'flag') o[k] = true;
    else if (kind === 'optional') { o[k] = next ?? true; if (next !== undefined) i++; }
    else {
      if (next === undefined) throw new UsageError(`${a} needs a value`);
      i++;
      if (kind === 'list') (o[k] ??= []).push(next); else o[k] = next;
    }
  }
  if (o._.length < positional[0]) throw new UsageError(positional[0] === 1 ? 'an argument is missing' : `${positional[0]} arguments are needed`);
  if (o._.length > positional[1]) throw new UsageError(`unexpected argument "${o._[positional[1]]}"`);
  return o;
}

// parse(), or the message, the usage line and exit 64.
export function readArgs(argv, spec = {}) {
  try { return parse(argv, spec); } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    bad(spec, e.message);
  }
}
export function bad(spec, message) {
  console.error(`${spec.name ?? 'itten'}: ${message}`);
  if (spec.usage) console.error(`Usage: ${spec.usage}`);
  process.exit(EXIT.usage);
}
