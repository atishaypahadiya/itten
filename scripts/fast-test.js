// The fast tier (--fast), the run after each change: the test print and its
// clean twin at 320, 768 and 1440 px, in Chromium, layout and line checks
// only. Passes when:
// - every planted defect of a fast check is caught, except one that needs a
//   pass the fast tier does not run (defects.json, "needs");
// - nothing else is reported: the planted defects of the other checks
//   (contrast, fonts, 200% text, motion) are decoys, and the fast tier must
//   not report them, nor anything on the clean twin;
// - the clean twin's run has nothing that fails it;
// - each page takes under 30 s.
// scoreFast() is the judgement alone, and the test also feeds it a report
// with a decoy's finding added, which it must reject: the control.
// Usage: node scripts/fast-test.js. Exports run() for scripts/check.js.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem, FAST_CHECKS, FAST_WIDTHS } from '../inspector/inspect.js';
import { findingsOf } from '../inspector/finding.js';
import { failing } from '../inspector/baseline.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'fast');
export const LIMIT_S = 30;

const inSection = (i, id) => i.elements.some((e) => e.sel === '#' + id || e.sel.startsWith('#' + id + ' '));
const names = (i, d) => inSection(i, d.id) || (!!d.resource && (i.resources || []).some((u) => new URL(u).pathname.endsWith('/' + d.resource)));
const hit = (i, d) => i.check === d.check && names(i, d) && (!d.severity || i.severity === d.severity);

// What is wrong with a fast run of the test print and twin, as sentences.
export function scoreFast(spec, page, twin, seconds = {}) {
  const out = [];
  const expected = spec.defects.filter((d) => FAST_CHECKS.includes(d.check) && !d.needs);
  const pageIssues = findingsOf(page), twinIssues = findingsOf(twin);
  for (const [name, r] of [['test print', page], ['clean twin', twin]]) {
    if (r.sweep?.tier !== 'fast') out.push(`${name}: the report's tier is ${r.sweep?.tier}, not fast`);
    if (r.sweep?.widths !== FAST_WIDTHS.join(', ')) out.push(`${name}: measured at ${r.sweep?.widths} px, not ${FAST_WIDTHS.join(', ')}`);
    if (r.status !== 'complete') out.push(`${name}: the run is ${r.status} (${r.reason})`);
    if (r.motion) out.push(`${name}: motion was recorded`);
    if (r.engines?.widths?.length) out.push(`${name}: other engines ran at ${r.engines.widths.join(', ')} px`);
    if (seconds[name] !== undefined && seconds[name] >= LIMIT_S) out.push(`${name}: took ${seconds[name].toFixed(1)} s, not under ${LIMIT_S} s`);
  }
  for (const d of expected) if (!pageIssues.some((i) => hit(i, d))) out.push(`missed ${d.id} (${d.check}, ${d.title})`);
  for (const i of pageIssues) {
    if (!FAST_CHECKS.includes(i.check)) out.push(`test print: reported ${i.check}, which the fast tier does not run (${i.id})`);
    else if (!spec.defects.some((d) => hit(i, d))) out.push(`test print: a finding no defect explains: ${i.check} on ${i.elements.map((e) => e.sel).join(', ') || 'the page'} (${i.id})`);
  }
  for (const i of twinIssues) out.push(`clean twin: ${i.check} on ${i.elements.map((e) => e.sel).join(', ') || 'the page'} (${i.id})`);
  if (failing(twin, 'warning').length) out.push('clean twin: the run would fail at --fail-on warning');
  return out;
}

export async function run({ quiet = true } = {}) {
  const spec = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'defects.json'), 'utf8'));
  const { system, errors } = loadSystem(join(ROOT, spec.system));
  if (errors.length) return [`fixtures/itten.system.json is not valid: ${errors.join('; ')}`];
  const port = 4675 + Math.floor(Math.random() * 300);
  const server = await start(port);
  try {
    const url = (p) => `http://127.0.0.1:${port}/${p}`;
    const timed = async (p, out) => { const t = Date.now(); const r = await inspect(url(p), { system, systemPath: spec.system, quiet, fast: true, out: join(OUT, out) }); return [r, (Date.now() - t) / 1000]; };
    const [page, sPage] = await timed(spec.page, 'test-print');
    const [twin, sTwin] = await timed(spec.twin, 'clean-twin');
    const fails = scoreFast(spec, page, twin, { 'test print': sPage, 'clean twin': sTwin });
    // The control: a decoy's finding (a planted contrast defect) in the
    // report must be caught as one the fast tier should not have made.
    const decoy = { ...page, findings: [...page.findings, { ...page.findings[0], check: 'contrast', itten: { ...page.findings[0].itten, id: 'i999' } }] };
    if (!scoreFast(spec, decoy, twin).some((f) => /contrast, which the fast tier does not run/.test(f))) fails.push('the control: a contrast finding in a fast report was not rejected');
    if (!quiet) console.log(`fast tier: test print ${sPage.toFixed(1)} s, ${findingsOf(page).length} findings; clean twin ${sTwin.toFixed(1)} s, ${findingsOf(twin).length} findings`);
    return fails;
  } finally { server.close(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fails = await run({ quiet: false });
  for (const f of fails) console.error(`fast: ${f}`);
  console.log(fails.length ? `${fails.length} failed.` : 'The fast tier catches its planted defects, reports nothing else, and runs in under 30 s.');
  process.exit(fails.length ? 1 : 0);
}
