// The shared exit codes, and no run on a command line that cannot be read
// (docs/CONTRACT.md, "Exit codes").
//   0  complete, no failing finding     1  failing findings (also when partial)
//   2  refused                          3  partial, no failing finding
//   64 bad usage: nothing run, no report
// Errors and warnings fail a run; info never does.
// - Every command given a flag it does not know exits 64 within a few
//   seconds, and the inspector and the fixer leave no report behind.
// - The inspector, on real pages: a clean twin exits 0; a page with an error
//   1; a page with only warnings 1, and 0 with --fail-on error or never; a
//   page that never shows what --wait-for names is partial and exits 1 with
//   its error counted, 3 with --fail-on never; an address nothing answers at
//   and a system file that is not valid exit 2.
// - exitCode() and failing() alone: info only is 0 when complete and 3 when
//   partial.
// Usage: node scripts/exit-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { exitCode, parse, UsageError, readArgs } from '../inspector/usage.js';
import { failing } from '../inspector/baseline.js';
import { toFinding } from '../inspector/finding.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Every command: the scripts, the action's two, the inspector and the fixer.
export function commands() {
  const scripts = readdirSync(join(ROOT, 'scripts')).filter((f) => f.endsWith('.js')).map((f) => `scripts/${f}`);
  return ['inspector/inspect.js', 'inspector/fix.js', 'inspector/packets.js', 'scripts/action/run.js', 'scripts/action/report.js', 'fixtures/make.js', ...scripts];
}

export function unitTests() {
  const fails = [];
  const want = [['complete', 0, 0], ['complete', 2, 1], ['partial', 0, 3], ['partial', 1, 1], ['refused', 0, 2], ['refused', 5, 2]];
  for (const [status, n, code] of want) if (exitCode(status, n) !== code) fails.push(`exitCode: ${status} with ${n} failing gives ${exitCode(status, n)}, not ${code}`);
  const rep = (status, ...sev) => ({ schema: 'report/1', status, findings: sev.map((s, k) => toFinding({ id: `i00${k}`, fingerprint: `overflow|${k}`, check: 'overflow', severity: s, message: 'm', elements: [{ sel: 'p', label: 'p' }], seen: {}, crops: [] })) });
  const code = (r, level = 'warning') => exitCode(r.status, failing(r, level).length);
  if (code(rep('complete', 'info', 'info')) !== 0) fails.push('info only, complete: not 0');
  if (code(rep('partial', 'info')) !== 3) fails.push('info only, partial: not 3');
  if (code(rep('complete', 'warning')) !== 1 || code(rep('complete', 'error')) !== 1) fails.push('a warning or an error does not fail a run');
  if (code(rep('partial', 'warning', 'info')) !== 1) fails.push('a failing finding in a partial run: not 1');
  if (code(rep('complete', 'warning'), 'error') !== 0 || code(rep('complete', 'error'), 'never') !== 0) fails.push('--fail-on error or never is not respected');
  const bad = (argv, spec, what) => { try { parse(argv, spec); fails.push(`parse: ${what} is accepted`); } catch (e) { if (!(e instanceof UsageError)) fails.push(`parse: ${what} threw ${e.message}`); } };
  const spec = { flags: { out: 'value', full: 'flag', wb: 'optional', url: 'list' }, positional: [1, 1] };
  bad(['x', '--nope'], spec, 'an unknown flag');
  bad(['x', '--out'], spec, 'a flag without its value');
  bad(['x', '--out', '--full'], spec, 'a flag whose value is another flag');
  bad(['x', 'y'], spec, 'one argument too many');
  bad(['--full'], spec, 'a missing argument');
  const ok = parse(['x', '--out', 'o', '--full', '--wb', '--url', 'a', '--url', 'b'], spec);
  if (ok._[0] !== 'x' || ok.out !== 'o' || ok.full !== true || ok.wb !== true || ok.url.join() !== 'a,b') fails.push(`parse: a good command line reads as ${JSON.stringify(ok)}`);
  if (typeof readArgs !== 'function') fails.push('readArgs is missing');
  return fails;
}

export async function run() {
  const fails = unitTests();
  const tmp = mkdtempSync(join(tmpdir(), 'itten-exit-'));
  const port = 5175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  try {
    // An unknown flag: 64, quickly, with nothing made.
    for (const c of commands()) {
      const out = join(tmp, c.replace(/\W+/g, '-'));
      const lead = c === 'inspector/inspect.js' ? [`http://127.0.0.1:${port}/fixtures/breakpoint-clean.html`, '--out', out] : c === 'inspector/fix.js' || c === 'inspector/packets.js' ? [`http://127.0.0.1:${port}/fixtures/breakpoint-clean.html`, '--root', ROOT, '--out', out] : c === 'scripts/overrides.js' ? ['validate'] : [];
      const t = Date.now();
      const r = spawnSync(process.execPath, [join(ROOT, c), ...lead, '--no-such-flag'], { cwd: tmp, encoding: 'utf8', timeout: 20000, env: { ...process.env, GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '' } });
      if (r.status !== 64) fails.push(`${c} --no-such-flag exits ${r.status ?? r.signal}, not 64`);
      else if (!/no-such-flag/.test(r.stderr)) fails.push(`${c} --no-such-flag does not name the flag: ${r.stderr.slice(0, 120)}`);
      if (Date.now() - t > 8000) fails.push(`${c} --no-such-flag took ${Math.round((Date.now() - t) / 1000)} s: it ran something first`);
      if (existsSync(out)) fails.push(`${c} --no-such-flag left a report in --out`);
    }
    if (readdirSync(tmp).length) fails.push(`commands given an unknown flag wrote files: ${readdirSync(tmp).join(', ')}`);

    // Not spawnSync: this process serves the pages, and must go on answering.
    const node = (args, out) => new Promise((done) => {
      const c = spawn(process.execPath, [join(ROOT, args[0]), ...args.slice(1)], { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
      let text = '';
      c.stdout.on('data', (d) => { text += d; }); c.stderr.on('data', (d) => { text += d; });
      const kill = setTimeout(() => c.kill('SIGKILL'), 240000);
      c.on('exit', (code) => {
        clearTimeout(kill);
        let report = null;
        try { report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8')); } catch { /* none */ }
        done({ code, report, text });
      });
    });
    // The inspector's codes on real pages.
    const inspect = (name, page, ...args) => {
      const out = join(tmp, name);
      const url = /^http/.test(page) ? page : `http://127.0.0.1:${port}/fixtures/${page}`;
      return node(['inspector/inspect.js', url, '--system', join(ROOT, 'fixtures/itten.system.json'), '--out', out, '--fast', ...args], out);
    };
    const expect = (what, r, code, status) => {
      if (r.code !== code) fails.push(`${what}: exits ${r.code}, not ${code} (${r.text.trim().split('\n').slice(-2).join(' | ').slice(0, 200)})`);
      if (status && r.report?.status !== status) fails.push(`${what}: the report is ${r.report?.status}, not ${status}`);
    };
    const clean = await inspect('clean', 'breakpoint-clean.html');
    expect('a clean twin', clean, 0, 'complete');
    if (!/0 errors, 0 warnings, 0 info/.test(clean.text)) fails.push('a clean twin: the summary line does not count errors, warnings and info apart');
    expect('a page with an error', await inspect('error', 'timing.html'), 1, 'complete');
    const warn = await inspect('warning', 'fluid.html');
    expect('a page with warnings only', warn, 1, 'complete');
    if (warn.report?.summary && (warn.report.summary.error !== 0 || !(warn.report.summary.warning > 0))) fails.push(`the warnings-only page has ${JSON.stringify(warn.report.summary)}`);
    expect('warnings only, --fail-on error', await inspect('warning-error', 'fluid.html', '--fail-on', 'error'), 0, 'complete');
    expect('warnings only, --fail-on never', await inspect('warning-never', 'fluid.html', '--fail-on', 'never'), 0, 'complete');
    expect('partial with an error', await inspect('partial', 'breakpoint-clean.html', '--wait-for', '.never-there'), 1, 'partial');
    expect('partial, --fail-on never', await inspect('partial-never', 'breakpoint-clean.html', '--wait-for', '.never-there', '--fail-on', 'never'), 3, 'partial');
    expect('an address nothing answers at', await inspect('refused', 'http://127.0.0.1:9/'), 2, 'refused');
    writeFileSync(join(tmp, 'bad.system.json'), '{ "spacing": { "scale": "wide" } }');
    const badSystem = await node(['inspector/inspect.js', `http://127.0.0.1:${port}/fixtures/breakpoint-clean.html`, '--system', join(tmp, 'bad.system.json'), '--out', join(tmp, 'bad-system')], join(tmp, 'bad-system'));
    if (badSystem.code !== 2) fails.push(`a system file that is not valid: exits ${badSystem.code}, not 2`);
    const badValue = spawnSync(process.execPath, [join(ROOT, 'inspector/inspect.js'), `http://127.0.0.1:${port}/x`, '--fail-on', 'sometimes', '--out', join(tmp, 'bad-value')], { cwd: tmp, encoding: 'utf8', timeout: 20000 });
    if (badValue.status !== 64 || existsSync(join(tmp, 'bad-value'))) fails.push(`--fail-on with a value it does not know: exits ${badValue.status}, not 64, or leaves a report`);
  } finally {
    server.close();
    rmSync(tmp, { recursive: true, force: true });
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'exit-test.js', usage: 'node scripts/exit-test.js' });
  const fails = await run();
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'Every command refuses an unknown flag with 64 and runs nothing; the inspector exits 0, 1, 2 and 3 as the shared codes say.');
  process.exit(fails.length ? 1 : 0);
}
