// Work packets (inspector/packets.js; docs/CONTRACT.md, "Work packets").
// Without a browser: CODEOWNERS patterns; findings that share a cause are one
// packet, and so are findings joined through a third; packets that name the
// same file conflict; a packet with no known file is never conflict-free;
// and the controls for verify(): a finding in two packets, a finding in
// none, and two packets marked conflict-free on one file are each reported.
// On fixtures/packets (see its README): the planted page gives four findings
// in three packets; the two findings of one rule are one packet; the two
// packets in style.css conflict; the packet alone in notes.css is
// conflict-free, mechanical and has its owners; the decoy rule is in none;
// the clean twin has no packets.
// Usage: node scripts/packets-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { loadSystem } from '../inspector/inspect.js';
import { packets, group, verify, parseCodeowners, ownersOf, editCauses } from '../inspector/packets.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'packets');
const FONT = join(ROOT, 'library', 'assets', 'fonts', 'atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-wght-normal.woff2');

export function unitTests() {
  const fails = [];
  const eq = (got, want, what) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${what}: ${JSON.stringify(got)}, not ${JSON.stringify(want)}`); };
  const co = parseCodeowners('# c\n*.css @styles\n/site/notes.css @notes @lead\ndocs/ @docs\n/build/** @ci\n\n*.html @pages # trailing\n');
  eq(ownersOf(co, 'site/style.css'), ['@styles'], 'a pattern without a slash matches at any depth');
  eq(ownersOf(co, 'site/notes.css'), ['@notes', '@lead'], 'the last pattern that matches wins');
  eq(ownersOf(co, 'other/site/notes.css'), ['@styles'], 'a pattern with a leading slash is anchored at the root');
  eq(ownersOf(co, 'a/docs/x.md'), ['@docs'], 'a directory matches all inside it');
  eq(ownersOf(co, 'build/a/b.js'), ['@ci'], '** crosses folders');
  eq(ownersOf(co, 'src/app.js'), [], 'a file no pattern matches has no owner');
  eq(ownersOf(co, 'index.html'), ['@pages'], 'a comment after the owners is dropped');

  const f = (id, check = 'radius') => ({ id, check, severity: 'warning', fingerprint: `${check}|${id}` });
  const rule = (file, line) => ({ key: `rule|${file}|${line}|1`, kind: 'rule', file, line, column: 1, selector: '.x' });
  const auto = (file) => ({ kind: 'auto', class: 'px-to-rem', edits: [{ file, line: 1, column: 1, length: 1, replace: 'x' }] });
  const guided = { kind: 'guided', class: 'off-scale', edits: [] };
  const ps = group([
    { finding: f('i001'), causes: [rule('a.css', 2)], plan: guided },
    { finding: f('i002'), causes: [rule('a.css', 2)], plan: auto('a.css') },           // the same rule: with i001
    { finding: f('i003'), causes: [rule('a.css', 9)], plan: auto('a.css') },           // another rule, the same file: conflicts
    { finding: f('i004'), causes: [rule('b.css', 1), rule('c.css', 1)], plan: guided },
    { finding: f('i005'), causes: [rule('c.css', 1)], plan: guided },                  // joined to i004 through c.css line 1
    { finding: f('i006'), causes: [rule('d.css', 4)], plan: auto('e.css') },           // its fix edits another file
    { finding: f('i007'), causes: [{ key: 'unlocated|x', kind: 'unlocated', why: 'built' }], plan: guided },
    { finding: f('i008'), causes: [{ key: 'markup|index.html|#a', kind: 'markup', file: 'index.html', selector: '#a' }], plan: guided },
    { finding: f('i009'), causes: [{ key: 'markup|index.html|#b', kind: 'markup', file: 'index.html', selector: '#b' }], plan: guided },
  ]);
  const ids = (p) => p.findings.map((x) => x.id).join();
  eq(ps.map(ids), ['i001,i002', 'i003', 'i004,i005', 'i006', 'i007', 'i008', 'i009'], 'findings grouped by cause');
  // Two elements whose mechanical fixes edit one place are one packet.
  const ins = { kind: 'auto', class: 'text-wrap', edits: [{ file: 'a.css', line: 5, column: 20, length: 0, replace: ' text-wrap: pretty;' }] };
  const mk = (sel) => [{ key: `markup|index.html|${sel}`, kind: 'markup', file: 'index.html', selector: sel }];
  const tw = group([{ finding: f('i001'), causes: [...mk('#a'), ...editCauses(ins)], plan: ins }, { finding: f('i002'), causes: [...mk('#b'), ...editCauses(ins)], plan: ins }, { finding: f('i003'), causes: [...mk('#c'), ...editCauses(guided)], plan: guided }]);
  eq(tw.map(ids), ['i001,i002', 'i003'], 'findings fixed by one edit are one packet');
  eq(editCauses(guided), [], 'a guided fix names no place');
  eq(ps.map((p) => p.id), ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07'], 'packet ids');
  eq([ps[0].conflicts, ps[1].conflicts], [['p02'], ['p01']], 'two packets in one file conflict');
  eq([ps[0].mechanical, ps[1].mechanical], [false, true], 'a packet is mechanical only when every finding in it has an auto fix');
  eq(ps[2].files, ['b.css', 'c.css'], "a packet's files are its causes' files");
  eq([ps[2].conflictFree, ps[3].conflictFree, ps[3].files], [true, true, ['d.css', 'e.css']], "a packet's files include those its fixes edit");
  eq([ps[4].conflictFree, ps[4].files, ps[4].located], [false, [], false], 'a packet with no known file is not conflict-free');
  eq([ps[5].conflicts, ps[6].conflictFree], [['p07'], false], 'two elements of one page are two packets that conflict');
  const all = Array.from({ length: 9 }, (_, i) => f(`i00${i + 1}`));
  if (verify(ps, all).length) fails.push(`verify() faults a good set: ${verify(ps, all).join('; ')}`);
  // Controls: each broken set must be reported.
  const twice = [...ps.slice(0, 1), { ...ps[1], findings: [...ps[1].findings, ps[0].findings[0]] }, ...ps.slice(2)];
  if (!verify(twice, all).some((m) => /i001 .* in 2 packets/.test(m))) fails.push('control: a finding in two packets is not reported');
  if (!verify(ps.slice(1), all).some((m) => /i001 .* in 0 packets/.test(m))) fails.push('control: a finding in no packet is not reported');
  if (!verify([{ ...ps[0], conflictFree: true }, ...ps.slice(1)], all).some((m) => /p01 is marked conflict-free and shares a\.css with p02/.test(m))) fails.push('control: a packet marked conflict-free that shares a file is not reported');
  if (!verify([...ps.slice(0, 4), { ...ps[4], conflictFree: true }, ...ps.slice(5)], all).some((m) => /p05 is marked conflict-free and names no file/.test(m))) fails.push('control: a packet marked conflict-free with no file is not reported');
  return fails;
}

export async function run({ quiet = true } = {}) {
  const fails = unitTests();
  const { system, errors } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  if (errors.length) return [...fails, `fixtures/itten.system.json is not valid: ${errors.join('; ')}`];
  const work = mkdtempSync(join(tmpdir(), 'itten-packets-'));
  const site = join(work, 'site');
  mkdirSync(join(site, 'fonts'), { recursive: true });
  cpSync(join(ROOT, 'fixtures', 'fix', 'base.css'), join(site, 'base.css'));
  cpSync(FONT, join(site, 'fonts', 'atkinson-hyperlegible-next-latin-wght-normal.woff2'));
  for (const d of ['planted', 'clean']) cpSync(join(ROOT, 'fixtures', 'packets', d), join(site, d), { recursive: true });
  cpSync(join(ROOT, 'fixtures', 'packets', 'CODEOWNERS'), join(site, 'CODEOWNERS'));
  const port = 5475 + Math.floor(Math.random() * 300);
  const server = await start(port, site);
  try {
    const go = (name) => packets(`http://127.0.0.1:${port}/${name}/index.html`, { root: site, system, systemPath: 'fixtures/itten.system.json', out: join(OUT, name), engines: [], quiet });
    const r = await go('planted');
    const by = (file, line) => r.packets.find((p) => p.causes.some((c) => c.kind === 'rule' && c.file === file && c.line === line));
    const rules = (p) => p.causes.filter((c) => c.kind === 'rule');
    const checks = (p) => (p?.findings ?? []).map((x) => x.check).sort().join();
    if (r.status !== 'complete') fails.push(`planted: the run is ${r.status} (${r.reason})`);
    if (r.summary.findings !== 4 || r.packets.length !== 3) fails.push(`planted: ${r.summary.findings} findings in ${r.packets.length} packets, not 4 in 3: ${r.packets.map((p) => `${p.id} [${checks(p)}] ${p.files.join('+')}`).join('; ')}`);
    const card = by('planted/style.css', 2), caption = by('planted/style.css', 3), aside = by('planted/notes.css', 2);
    if (checks(card) !== 'spacing-scale,spacing-unit') fails.push(`planted: the packet of .card (style.css line 2) holds ${checks(card) || 'nothing'}, not its two findings`);
    else {
      if (card.mechanical) fails.push('planted: the packet with an off-scale value is marked mechanical');
      if (rules(card).length !== 1 || rules(card)[0].selector !== '.card') fails.push(`planted: the packet of .card names ${JSON.stringify(card.causes)}`);
    }
    if (checks(caption) !== 'text-resize') fails.push(`planted: the packet of .caption (style.css line 3) holds ${checks(caption) || 'nothing'}`);
    else if (!caption.mechanical) fails.push('planted: the px font size, which itten fix converts, is not marked mechanical');
    if (card && caption && (card.conflicts.join() !== caption.id || caption.conflicts.join() !== card.id || card.conflictFree || caption.conflictFree)) fails.push('planted: the two packets in style.css are not marked as conflicting with each other');
    if (checks(aside) !== 'spacing-unit') fails.push(`planted: the packet of .aside (notes.css line 2) holds ${checks(aside) || 'nothing'}`);
    else {
      if (!aside.conflictFree || aside.conflicts.length || aside.files.join() !== 'planted/notes.css') fails.push(`planted: the packet alone in notes.css is not conflict-free: files ${aside.files.join()}, conflicts ${aside.conflicts.join()}`);
      if (!aside.mechanical) fails.push('planted: the px padding alone in notes.css is not marked mechanical');
      if (aside.owners?.join() !== '@notes,@styles-lead') fails.push(`planted: the owners of notes.css are ${aside.owners?.join() ?? 'missing'}`);
    }
    if (card && card.owners?.join() !== '@styles') fails.push(`planted: the owners of style.css are ${card.owners?.join() ?? 'missing'}`);
    if (r.packets.some((p) => p.causes.some((c) => c.selector === '.plain'))) fails.push('planted: the decoy rule .plain is in a packet');
    const clean = await go('clean');
    if (clean.status !== 'complete' || clean.packets.length || clean.summary.findings) fails.push(`clean twin: ${clean.summary.findings} findings in ${clean.packets.length} packets (${clean.status})`);
  } finally {
    server.close();
    rmSync(work, { recursive: true, force: true });
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'packets-test.js', usage: 'node scripts/packets-test.js' });
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'Every finding is in one packet; packets in one file conflict, and a packet alone in its files is conflict-free.');
  process.exit(fails.length ? 1 : 0);
}
