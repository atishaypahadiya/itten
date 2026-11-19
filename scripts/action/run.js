// The ITTEN action's main step: get the page, inspect each page, compare with
// the project's baseline, and write summary.json for the report step.
// Settings come from the environment (action.yml maps its inputs to ITTEN_*).
// It exits 0 even when findings fail the run, so the report and the artifact
// are still written; the action's last step fails the job from the outputs.
//
// ITTEN_STATIC_DIR      a directory to serve, or
// ITTEN_SERVE_COMMAND   a command that serves the project, with ITTEN_URL, or
// ITTEN_URL             alone: a deployed page
// ITTEN_PAGES           paths relative to the URL, one per line or comma-separated (default "/")
// ITTEN_SYSTEM          system file; empty: itten.system.json if present; "none": distinct-value mode
// ITTEN_MODE            quick (320, 768, 1440 and 1920 px, and either side of each breakpoint
//                       between them) or full (every 40 px from 320 to 1920 px)
// ITTEN_FAIL_ON         errors, warnings or never
// ITTEN_BASELINE        baseline file (default itten-baseline.json)
// ITTEN_WRITE_BASELINE  "true": write a fresh baseline into the report directory
// ITTEN_ENGINES         second-opinion engines, comma-separated (default webkit)
// ITTEN_SERVE_TIMEOUT   seconds to wait for the serve command's URL (default 120)
// ITTEN_OVERRIDES       overrides file (default itten.overrides.json); when it exists it must
//                       validate, and docs/itten-overrides.md must match it
// ITTEN_WORKERS         jobs at once (default: the CPU cores less two, capped by memory)
// ITTEN_SHARD           "i/n": measure every n-th job of each page and write shard.json only
// ITTEN_MERGE           a directory of shard artifacts, one folder each, to merge into reports
// ITTEN_OUT             report directory

import { existsSync, mkdirSync, writeFileSync, copyFileSync, appendFileSync, openSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { start } from '../serve.js';
import { inspect, loadSystem, VERSION, CHECKS } from '../../inspector/inspect.js';
import { failing } from '../../inspector/baseline.js';
import { view, findingsOf } from '../../inspector/finding.js';
import { movingTiles } from '../../inspector/report-html.js';
import { checkFiles } from '../overrides.js';
import { readArgs } from '../../inspector/usage.js';

const env = (k, d = '') => (process.env[k] ?? '').trim() || d;
const problems = [];
const out = () => resolve(env('ITTEN_OUT', 'itten-report'));

// The widths a page was measured at, as its report gives them ("320, 431, 432, 768" or
// "320–1920"): quick mode adds widths around the page's own breakpoints, so pages differ.
export const measuredWidths = (report) => report?.sweep?.widths ?? null;
export const parsePages = (s) => s.split(/[\n,]/).map((p) => p.trim()).filter(Boolean);
// Pages are relative to the URL, so "/" under https://example.org/site/ is the
// site's root, not the host's. A full URL is used as it is.
export const pageUrl = (base, p) => /^https?:\/\//.test(p) ? p : new URL(p.replace(/^\/+/, ''), base.endsWith('/') ? base : base + '/').href;
export const pageName = (p) => (p.startsWith('/') || /^https?:/.test(p) ? p : '/' + p);
export const slug = (p) => p.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+|\/+$/g, '').replace(/[^A-Za-z0-9._-]+/g, '-') || 'index';

async function waitFor(url, seconds, child) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    if (child && child.exitCode !== null) throw new Error(`the serve command exited with code ${child.exitCode} before ${url} answered (see serve.log in the report)`);
    try { await fetch(url, { signal: AbortSignal.timeout(5000) }); return; } catch { /* not up yet */ }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error(`${url} did not answer within ${seconds} s`);
}

async function main(out) {
  const staticDir = env('ITTEN_STATIC_DIR'), command = env('ITTEN_SERVE_COMMAND'), given = env('ITTEN_URL');
  const mode = env('ITTEN_MODE', 'quick'), failOn = env('ITTEN_FAIL_ON', 'errors');
  const pages = parsePages(env('ITTEN_PAGES', '/'));
  const engines = env('ITTEN_ENGINES', 'webkit').split(',').map((e) => e.trim()).filter((e) => e && e !== 'none');
  if (!['quick', 'full'].includes(mode)) problems.push(`mode must be quick or full, not "${mode}"`);
  if (!['errors', 'warnings', 'never'].includes(failOn)) problems.push(`fail-on must be errors, warnings or never, not "${failOn}"`);
  if ([staticDir, command].filter(Boolean).length > 1) problems.push('give static-dir or serve-command, not both');
  if (command && !given) problems.push('serve-command needs url: the address it serves');
  if (!staticDir && !command && !given) problems.push('give static-dir, serve-command with url, or url');
  if (staticDir && !existsSync(staticDir)) problems.push(`static-dir ${staticDir} does not exist; build the site before this step`);
  const workers = env('ITTEN_WORKERS') ? Number(env('ITTEN_WORKERS')) : undefined;
  if (workers !== undefined && !(workers >= 1)) problems.push(`workers must be a number of 1 or more, not "${env('ITTEN_WORKERS')}"`);
  const shardText = env('ITTEN_SHARD'), mergeDir = env('ITTEN_MERGE');
  const sm = shardText.match(/^(\d+)\/(\d+)$/);
  const shard = sm && +sm[1] >= 1 && +sm[1] <= +sm[2] ? { i: +sm[1], n: +sm[2] } : null;
  if (shardText && !shard) problems.push(`shard must be i/n, as 2/3, not "${shardText}"`);
  if (shardText && mergeDir) problems.push('give shard or merge, not both');
  if (mergeDir && !existsSync(mergeDir)) problems.push(`merge directory ${mergeDir} does not exist; download the shard artifacts into it first`);

  let systemPath = env('ITTEN_SYSTEM');
  if (!systemPath) systemPath = existsSync('itten.system.json') ? 'itten.system.json' : 'none';
  let system = null;
  if (systemPath !== 'none') {
    if (!existsSync(systemPath)) problems.push(`system file ${systemPath} does not exist`);
    else {
      const r = loadSystem(systemPath);
      if (r.errors.length) problems.push(`${systemPath} is not valid: ${r.errors.join('; ')}`);
      system = r.system;
    }
  }
  const overridesFile = env('ITTEN_OVERRIDES', 'itten.overrides.json');
  let overrides = null, overrideErrors = [];
  if (existsSync(overridesFile)) {
    const r = checkFiles(overridesFile, 'docs/itten-overrides.md');
    overrides = { file: overridesFile, count: r.count, ok: r.ok };
    overrideErrors = r.errors.map((e) => `overrides: ${e}`);
  }
  const baselineFile = env('ITTEN_BASELINE', 'itten-baseline.json');
  const hasBaseline = existsSync(baselineFile);
  const writeBaseline = env('ITTEN_WRITE_BASELINE', 'false') === 'true';
  const newBaseline = join(out, 'itten-baseline.json');
  if (writeBaseline && hasBaseline) copyFileSync(baselineFile, newBaseline);

  const summary = {
    tool: 'itten-action', version: VERSION, name: env('ITTEN_NAME', 'itten-report'), mode, failOn,
    system: systemPath === 'none' ? null : systemPath, baseline: hasBaseline ? baselineFile : null, wroteBaseline: writeBaseline ? 'itten-baseline.json' : null,
    engines, overrides, pages: [], problems, ...(shard ? { shard } : {}), ...(mergeDir ? { merged: true } : {}),
  };
  if (problems.length) return summary;
  // A bad overrides file fails the run, but the pages are still inspected.
  problems.push(...overrideErrors);

  let server = null, child = null, base = given;
  try {
    if (staticDir) {
      server = await start(0, staticDir);
      base = `http://127.0.0.1:${server.address().port}/`;
    } else if (command) {
      const log = openSync(join(out, 'serve.log'), 'a');
      child = spawn('bash', ['-c', command], { detached: true, stdio: ['ignore', log, log] });
      await waitFor(given, Number(env('ITTEN_SERVE_TIMEOUT', '120')), child);
    } else {
      await waitFor(given, 30, null);
    }
    const used = new Set();
    for (const p of pages) {
      let dir = slug(p);
      while (used.has(dir)) dir += '-';
      used.add(dir);
      const url = pageUrl(base, p);
      process.stderr.write(`\nInspecting ${url}\n`);
      if (shard) {
        const s = await inspect(url, { system, systemPath: system ? systemPath : null, out: join(out, dir), full: mode === 'full', engines, workers, shard });
        summary.pages.push({ page: pageName(p), url, dir, shard, jobs: s.jobs });
        continue;
      }
      // The shard artifacts each hold this page's shard.json in the same folder.
      const mergeFrom = mergeDir ? readdirSync(mergeDir).map((d) => join(mergeDir, d, dir, 'shard.json')).filter((f) => existsSync(f) && statSync(f).isFile()) : undefined;
      if (mergeDir && !mergeFrom.length) throw new Error(`no shard of ${pageName(p)} in ${mergeDir}: expected ${join(mergeDir, '<artifact>', dir, 'shard.json')}`);
      const report = await inspect(url, {
        workers, mergeFrom,
        system, systemPath: system ? systemPath : null, out: join(out, dir), full: mode === 'full', engines,
        page: pageName(p), baseline: hasBaseline ? baselineFile : undefined, writeBaseline: writeBaseline ? newBaseline : undefined,
      });
      // report/1: the status first. A refused run judged nothing, so its empty
      // findings are not a pass; it is a problem, which fails the check.
      if (report.status === 'refused') { problems.push(`${pageName(p)}: the inspection was refused: ${report.reason}`); continue; }
      const fail = failing(report, failOn);
      const issues = findingsOf(report);
      const byId = new Map(issues.map((i) => [i.id, i]));
      const brief = (i) => ({ id: i.id, check: i.check, title: i.title, severity: i.severity, message: i.message, element: i.elements[0]?.sel ?? null, text: i.elements[0]?.text ?? null, order: i.elements[0]?.order ?? null, rule: i.rule });
      const b = report.baseline;
      summary.pages.push({
        page: pageName(p), url, dir, widths: measuredWidths(report), status: report.status ?? 'complete', ...(report.reason ? { reason: report.reason } : {}), summary: { error: report.summary.error, warning: report.summary.warning, info: report.summary.info },
        failing: fail.length,
        moving: (({ tiles, unexplained }) => ({ tiles, unexplained }))(movingTiles(report)),
        baseline: b ? { found: b.found, new: b.new.map((id) => brief(byId.get(id))), worse: b.worse.map((w) => ({ ...brief(byId.get(w.id)), was: w.was })),
          fixed: b.fixed.map((f) => ({ check: f.check, title: CHECKS[f.check]?.title, severity: f.severity, message: f.message, element: f.elements[0] ?? null })), sameWidths: b.sameWidths } : null,
        top: issues.filter((i) => i.severity !== 'info').slice(0, 10).map(brief),
        engines: report.engines ? { ran: Object.keys(report.engines.browsers), notRun: report.engines.notRun, differences: report.engines.differences.length } : null,
        cpu: report.motion?.cpu ?? null,
      });
      const cpu = report.motion?.cpu;
      if (cpu) process.stderr.write(`CPU: benchmark index ${cpu.index}, slowed ${cpu.rate}x to ${cpu.slowedIndex} against a reference of ${cpu.reference}.\n`);
    }
  } catch (e) {
    problems.push(String(e.message || e).split('\n')[0]);
  } finally {
    server?.close();
    if (child && child.exitCode === null) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } }
  }
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  // Its inputs come from the environment (INPUT_*); it takes no arguments.
  readArgs(process.argv.slice(2), { name: 'action/run.js', usage: 'node scripts/action/run.js (inputs from INPUT_* in the environment)' });
  const dir = out();
  mkdirSync(dir, { recursive: true });
  let summary;
  try { summary = await main(dir); } catch (e) { summary = { tool: 'itten-action', version: VERSION, pages: [], problems: [...problems, String(e.message || e)] }; }
  const sum = (k) => summary.pages.reduce((n, p) => n + (p.summary?.[k] ?? 0), 0);
  const count = (k) => summary.pages.reduce((n, p) => n + (p.baseline?.[k]?.length ?? 0), 0);
  summary.totals = { error: sum('error'), warning: sum('warning'), info: sum('info'), new: count('new'), fixed: count('fixed'), failing: summary.pages.reduce((n, p) => n + (p.failing ?? 0), 0) };
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
  const outputs = { 'report-dir': dir, errors: summary.totals.error, warnings: summary.totals.warning, info: summary.totals.info, new: summary.totals.new, fixed: summary.totals.fixed, failing: summary.totals.failing, problems: summary.problems.length };
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([k, v]) => `${k}=${v}\n`).join(''));
  for (const p of summary.problems) console.log(`::error title=ITTEN::${p}`);
  console.log(`\n${summary.pages.length} page(s): ${summary.totals.error} errors, ${summary.totals.warning} warnings, ${summary.totals.info} info; ${summary.totals.failing} failing at fail-on ${summary.failOn ?? 'errors'}.`);
  process.exit(0);
}
