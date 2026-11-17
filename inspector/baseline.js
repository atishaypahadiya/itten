// A committed list of a project's known findings, so a pull request can be
// told what it adds and what it fixes. One file, itten-baseline.json, holds
// an entry per page, keyed by the page's path and query (or the page as the
// action was given it), so the same file serves a local server, a preview
// deploy and production.
//
// A finding is identified by its fingerprint: the check and the key the
// inspector groups it by (an element's selector, a value, a fluid curve), not
// by its id or its message, which change from run to run.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { view, findingsOf } from './finding.js';

const SEVERITY = ['error', 'warning', 'info'];

export const pageKey = (url) => { const u = new URL(url); return u.pathname + u.search; };

export function readBaseline(path) {
  if (!path || !existsSync(path)) return null;
  const b = JSON.parse(readFileSync(path, 'utf8'));
  if (!b || typeof b !== 'object' || typeof b.pages !== 'object') throw new Error(`${path} is not an ITTEN baseline (no "pages")`);
  return b;
}

const entryFor = (report) => ({
  date: report.date,
  version: report.version,
  system: report.system,
  widths: report.sweep.widths,
  findings: findingsOf(report).map((i) => ({ fingerprint: i.fingerprint, check: i.check, severity: i.severity, message: i.message, elements: i.elements.map((e) => e.sel) })),
});

// Adds or replaces this page's entry; other pages' entries are kept.
export function writeBaseline(path, report, key = pageKey(report.subject ?? report.url)) {
  const b = readBaseline(path) ?? { tool: 'itten-inspector', note: 'Known findings per page. Written by inspect.js --write-baseline; compared by --baseline and the ITTEN action.', pages: {} };
  b.version = report.version;
  b.pages[key] = entryFor(report);
  b.pages = Object.fromEntries(Object.entries(b.pages).sort(([a], [c]) => a.localeCompare(c)));
  writeFileSync(path, JSON.stringify(b, null, 2) + '\n');
  return b;
}

// New: in this run, not in the baseline. Fixed: in the baseline, not in this
// run. Worse and better: in both, at a different severity.
export function compare(report, baseline, file, page = pageKey(report.subject ?? report.url)) {
  const entry = baseline?.pages?.[page];
  if (!entry) return { file, page, found: false, new: [], fixed: [], worse: [], better: [] };
  const before = new Map(entry.findings.map((f) => [f.fingerprint, f]));
  const now = new Set(report.issues.map((i) => i.fingerprint));
  const issues = findingsOf(report);
  const out = { file, page, found: true, date: entry.date, widths: entry.widths, sameWidths: entry.widths === report.sweep.widths, new: [], fixed: [], worse: [], better: [] };
  for (const i of issues) {
    const was = before.get(i.fingerprint);
    if (!was) out.new.push(i.id);
    else if (SEVERITY.indexOf(i.severity) < SEVERITY.indexOf(was.severity)) out.worse.push({ id: i.id, was: was.severity });
    else if (SEVERITY.indexOf(i.severity) > SEVERITY.indexOf(was.severity)) out.better.push({ id: i.id, was: was.severity });
  }
  out.fixed = entry.findings.filter((f) => !now.has(f.fingerprint));
  return out;
}

// The findings that fail a run at a level (error, warning or never; plural
// forms accepted). With a baseline entry for the page, only findings that are
// new or got worse count: the baseline holds the findings already accepted.
export function failing(report, level) {
  const lv = String(level || 'never').replace(/s$/, '');
  if (lv === 'never') return [];
  const b = report.baseline;
  const counted = b?.found ? new Set([...b.new, ...b.worse.map((w) => w.id)]) : null;
  const sev = lv === 'warning' ? ['error', 'warning'] : ['error'];
  return findingsOf(report).filter((i) => sev.includes(i.severity) && (!counted || counted.has(i.id)));
}
