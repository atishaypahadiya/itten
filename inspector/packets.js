#!/usr/bin/env node
// Work packets: the findings of a run grouped by root cause and by the files
// a fix touches (ROADMAP 0.5; docs/CONTRACT.md, "Work packets").
//
// A finding's causes are found through the browser's style sources, as itten
// fix finds them (inspector/locate.js):
// - a finding about a CSS value (a spacing, a size, a line height, a radius,
//   a colour, a text-wrap) is caused by the rule whose declaration gives the
//   element that value: a file and the line its selector begins on;
// - any other finding is caused by the element itself, in the page's file;
// - where itten fix has a mechanical fix, the place it edits is a cause too,
//   so findings fixed by one edit are one packet;
// - a cause in text a build step made, or from another origin, has no file:
//   the packet says why, and is never marked conflict-free.
// Findings that share a cause are one packet, and so are findings joined
// through a third that shares a cause with each; every finding is in exactly
// one packet. A packet names its causes, its files (its causes' and those
// its mechanical fixes edit), the findings it closes, whether every one of
// them has a mechanical fix (itten fix's plan), and its owners where the
// project has a CODEOWNERS file. Two packets that name the same file
// conflict; a packet with files and no conflict is conflict-free.
//
// Usage:
//   node itten/inspector/packets.js <url> --root <dir> [--system itten.system.json] [--report report.json]
//        [--out itten-packets] [--fast] [--no-engines] [--codeowners <file>]
//   --root    the folder the server serves at the URL's root
//   --report  group this report's findings; without it the page is inspected
// Writes <out>/packets.json (packets/1). Exit codes: 0 written; 2 the
// inspection was refused; 64 bad usage or a system file that is not valid;
// 70 the run failed inside the tool; 75 temporarily blocked.

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inspect, loadSystem, VERSION } from './inspect.js';
import { findingsOf, view } from './finding.js';
import { attach, declarationOf, placeOf, fileOf } from './locate.js';
import { planFix, seenWidths } from './fix.js';
import { readArgs, bad, EXIT } from './usage.js';

export const SCHEMA = 'packets/1';

// The properties a check is about, where it is about a CSS value.
const PROPS = {
  contrast: ['color'], 'text-resize': ['font-size'], radius: ['border-radius'], 'radius-concentric': ['border-radius'],
  'text-wrap-balance': ['text-wrap'], 'text-wrap-pretty': ['text-wrap'],
};
const propsOf = (f) => (f.scale?.properties?.length ? f.scale.properties : f.check === 'type-scale' ? ['font-size'] : PROPS[f.check] ?? []);
const selsOf = (f) => (f.elements ?? []).map((e) => (typeof e === 'string' ? e : e.sel));

// ---------------------------------------------------------------- CODEOWNERS
// GitHub's rules, in short: the last pattern that matches a path names its
// owners. A pattern with a leading / is anchored at the repository root; one
// without a slash matches at any depth; a directory matches all inside it.
export function parseCodeowners(text) {
  return text.split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean).map((l) => {
    const [pattern, ...owners] = l.split(/\s+/);
    let p = pattern.replace(/\/$/, '');
    const anchored = p.startsWith('/') || p.slice(0, -1).includes('/');
    p = p.replace(/^\//, '');
    const re = p.split('**').map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*');
    return { pattern, owners, re: new RegExp(`${anchored ? '^' : '(^|/)'}${re}(/|$)`) };
  });
}
export const ownersOf = (rules, path) => rules.filter((r) => r.re.test(path)).at(-1)?.owners ?? [];

// The project's CODEOWNERS and the folder its patterns are relative to.
export function findCodeowners(root, given) {
  if (given) return existsSync(given) ? { file: given, base: root, rules: parseCodeowners(readFileSync(given, 'utf8')) } : null;
  let base = root;
  try { base = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || root; } catch { /* not a repository */ }
  for (const p of ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']) {
    const file = join(base, p);
    if (existsSync(file) && statSync(file).isFile()) return { file, base, rules: parseCodeowners(readFileSync(file, 'utf8')) };
  }
  return null;
}

// ------------------------------------------------------------------- Causes
// One finding's causes on a loaded page: [{ key, kind, file, line, column,
// selector, why }]. kind is rule, markup, unlocated or run.
export async function causesOf(f, { src, root, url }) {
  const out = new Map();
  const add = (c) => { if (!out.has(c.key)) out.set(c.key, c); };
  const pageFile = fileOf(root, url, url);
  const markup = (sel) => {
    if (pageFile && existsSync(join(root, pageFile))) add({ key: `markup|${pageFile}|${sel ?? ''}`, kind: 'markup', file: pageFile, ...(sel ? { selector: sel } : {}) });
    else add({ key: `unlocated|page|${sel ?? ''}`, kind: 'unlocated', ...(sel ? { selector: sel } : {}), why: `no file at ${pageFile ?? url} under the project root` });
  };
  const sels = selsOf(f), props = propsOf(f);
  if (f.check === 'timed-out') { add({ key: `run|${f.fingerprint}`, kind: 'run', why: 'a step of the run timed out; nothing in the project is named' }); return [...out.values()]; }
  if (!sels.length) { markup(null); return [...out.values()]; }
  for (const sel of sels) {
    if (!props.length) { markup(sel); continue; }
    let any = false;
    for (const prop of props) {
      const d = await declarationOf(src, sel, prop);
      if (d.why) continue;
      any = true;
      const place = await placeOf(src, root, url, d.rule.header, d.rule.selectorList?.range ?? d.prop.range);
      const selector = d.rule.selectorList?.text ?? null;
      if (place.why) add({ key: `unlocated|${d.rule.header?.sourceURL ?? ''}|${selector}`, kind: 'unlocated', selector, ...(place.file ? { source: place.file } : {}), why: place.why });
      else add({ key: `rule|${place.file}|${place.line}|${place.column}`, kind: 'rule', file: place.file, line: place.line, column: place.column, selector });
    }
    // No rule of the project's sets it: the element is where to look.
    if (!any) markup(sel);
  }
  return [...out.values()];
}

// Where a mechanical fix edits is a cause too: findings whose fixes change
// the same place (one declaration added to one rule for many paragraphs)
// are one piece of work.
export function editCauses(plan) {
  if (plan?.kind !== 'auto') return [];
  return (plan.edits ?? []).map((e) => (e.file
    ? { key: `edit|${e.file}|${e.line}|${e.column}`, kind: 'edit', file: e.file, line: e.line, column: e.column }
    : { key: `edit|${e.create ?? e.remove}`, kind: 'edit', file: e.create ?? e.remove }));
}

// ------------------------------------------------------------------ Packets
// Findings with their causes and plans, grouped. items: [{ finding, causes,
// plan: { kind, class, edits } }].
export function group(items, codeowners = null, root = '.') {
  const parent = items.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const byKey = new Map();
  items.forEach((it, i) => { for (const c of it.causes) { if (byKey.has(c.key)) parent[find(i)] = find(byKey.get(c.key)); else byKey.set(c.key, i); } });
  const groups = new Map();
  items.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
  const rel = (file) => (codeowners ? relative(codeowners.base, join(root, file)).split('\\').join('/') : file);
  const packets = [...groups.values()].map((g, k) => {
    const causes = new Map();
    for (const it of g) for (const c of it.causes) if (!causes.has(c.key)) { const { key, ...x } = c; causes.set(key, x); }
    const files = new Set([...causes.values()].map((c) => c.file).filter(Boolean));
    for (const it of g) for (const e of it.plan?.edits ?? []) files.add(e.file ?? e.create ?? e.remove);
    const list = [...files].sort();
    const located = [...causes.values()].every((c) => c.file);
    return {
      id: `p${String(k + 1).padStart(2, '0')}`,
      causes: [...causes.values()],
      files: list,
      findings: g.map((it) => ({ id: it.finding.id, check: it.finding.check, severity: it.finding.severity, fingerprint: it.finding.fingerprint })),
      // Mechanical: itten fix has an auto fix for every finding in it.
      mechanical: g.every((it) => it.plan?.kind === 'auto'),
      classes: [...new Set(g.map((it) => it.plan?.class).filter(Boolean))].sort(),
      ...(codeowners ? { owners: [...new Set(list.flatMap((file) => ownersOf(codeowners.rules, rel(file))))].sort() } : {}),
      located,
    };
  });
  for (const p of packets) {
    p.conflicts = packets.filter((q) => q !== p && q.files.some((file) => p.files.includes(file))).map((q) => q.id);
    // Conflict-free: its files are known, and no other packet names one.
    p.conflictFree = p.located && p.files.length > 0 && !p.conflicts.length;
  }
  return packets;
}

// Every finding in exactly one packet; conflict-free packets on disjoint
// files. Returns what breaks that, as sentences.
export function verify(packets, findings) {
  const out = [];
  const n = new Map();
  for (const p of packets) for (const f of p.findings) n.set(f.id, (n.get(f.id) || 0) + 1);
  for (const f of findings) { const k = n.get(f.id) || 0; if (k !== 1) out.push(`finding ${f.id} (${f.check}) is in ${k} packets`); }
  for (const id of n.keys()) if (!findings.some((f) => f.id === id)) out.push(`a packet holds ${id}, which is not a finding of the run`);
  const free = packets.filter((p) => p.conflictFree);
  for (const p of free) {
    if (!p.files.length) out.push(`${p.id} is marked conflict-free and names no file`);
    for (const q of packets) if (q !== p && q.files.some((file) => p.files.includes(file))) out.push(`${p.id} is marked conflict-free and shares ${q.files.find((file) => p.files.includes(file))} with ${q.id}`);
  }
  return out;
}

export async function packets(url, o = {}) {
  const root = realpathSync(resolve(o.root));
  const out = resolve(o.out ?? 'itten-packets');
  mkdirSync(out, { recursive: true });
  const say = o.quiet ? () => {} : (m) => process.stderr.write(m + '\n');
  let report = typeof o.report === 'string' ? JSON.parse(readFileSync(o.report, 'utf8')) : o.report;
  if (!report) {
    say(`itten packets: inspecting ${url}`);
    report = await inspect(url, { system: o.system ?? null, systemPath: o.systemPath ?? null, quiet: true, timings: false, out: join(out, 'report'), ...(o.engines ? { engines: o.engines } : {}), ...(o.fast ? { fast: true } : {}) });
  }
  const result = { schema: SCHEMA, tool: 'itten-packets', version: VERSION, url, root, started: new Date().toISOString(), status: report.status, ...(report.reason ? { reason: report.reason } : {}), packets: [], summary: { findings: 0, packets: 0, mechanical: 0, conflictFree: 0 } };
  const write = () => writeFileSync(join(out, 'packets.json'), JSON.stringify(result, null, 2) + '\n');
  if (report.status === 'refused') { if (report.blocked) result.blocked = true; write(); return result; }
  const findings = findingsOf(report).map(view);
  const codeowners = findCodeowners(root, o.codeowners);
  if (codeowners) result.codeowners = relative(root, codeowners.file) || codeowners.file;

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chromium' }).catch(() => chromium.launch());
  const items = [];
  try {
    // One page per width findings were first seen at.
    const pages = new Map();
    const at = async (w) => {
      if (!pages.has(w)) {
        const page = await browser.newPage({ viewport: { width: w, height: 900 } });
        await page.goto(url, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const rootPx = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)).catch(() => 16);
        pages.set(w, { page, src: await attach(page), rootPx: rootPx || 16 });
      }
      return pages.get(w);
    };
    for (const f of findings) {
      const w = seenWidths({ x: f.seen?.light ?? Object.values(f.seen ?? {})[0] })[0] ?? 1440;
      const { page, src, rootPx } = await at(w);
      const ctx = { page, src, root, url, system: o.system ?? null, rootPx };
      const plan = f.check === 'timed-out' ? null : await planFix(f, ctx).catch((e) => ({ kind: 'guided', class: 'unplanned', edits: [], note: e.message.split('\n')[0] }));
      items.push({ finding: f, causes: [...await causesOf(f, ctx), ...editCauses(plan)], plan });
    }
  } finally { await browser.close(); }
  result.packets = group(items, codeowners, root);
  result.summary = { findings: findings.length, packets: result.packets.length, mechanical: result.packets.filter((p) => p.mechanical).length, conflictFree: result.packets.filter((p) => p.conflictFree).length };
  const wrong = verify(result.packets, findings);
  if (wrong.length) throw new Error(`the packets do not hold together: ${wrong.join('; ')}`);
  write();
  return result;
}

const CLI = {
  name: 'packets',
  usage: 'Usage: node itten/inspector/packets.js <url> --root <dir> [--system itten.system.json] [--report report.json] [--out itten-packets] [--fast] [--no-engines] [--codeowners <file>]',
  positional: [1, 1],
  flags: { root: 'value', system: 'value', report: 'value', out: 'value', fast: 'flag', 'no-engines': 'flag', codeowners: 'value' },
};

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const args = readArgs(process.argv.slice(2), CLI);
  if (!args.root) bad(CLI, '--root is needed: the folder the server serves at the URL\'s root');
  if (!existsSync(args.root) || !statSync(args.root).isDirectory()) bad(CLI, `--root ${args.root} is not a folder`);
  if (args.report && !existsSync(args.report)) bad(CLI, `--report ${args.report} does not exist`);
  let system = null;
  if (args.system) { const r = loadSystem(args.system); if (r.errors.length) { console.error(`${args.system} is not valid:\n  ${r.errors.join('\n  ')}`); process.exit(EXIT.input); } system = r.system; }
  const r = await packets(args._[0], { root: args.root, system, systemPath: args.system ?? null, report: args.report, out: args.out, fast: !!args.fast, ...(args['no-engines'] ? { engines: [] } : {}), codeowners: args.codeowners })
    .catch((e) => { console.error(e.stack || String(e)); process.exit(EXIT.internal); });
  const s = r.summary;
  if (r.status === 'refused') { console.error(`The inspection was refused: ${r.reason}`); process.exit(r.blocked ? EXIT.blocked : EXIT.refused); }
  console.log(`${s.findings} findings in ${s.packets} packets: ${s.mechanical} mechanical, ${s.conflictFree} conflict-free. Packets: ${join(args.out ?? 'itten-packets', 'packets.json')}`);
  process.exit(EXIT.ok);
}
