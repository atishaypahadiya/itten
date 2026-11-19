// itten fix on its fixtures (fixtures/fix/README.md). For each class of fix:
// - before/ and twin/ differ (the control: without the fix, the comparison fails);
// - itten fix keeps every fix it writes, and the fixed files equal twin/ byte for byte;
// - the fixed page, inspected again, reports nothing;
// - a second itten fix keeps nothing and changes nothing.
// The planted fixes (planted/fixes.json, given with --apply) are both
// reverted, the page left as it was, and both reported with why; the run
// exits 1. Without --apply, the planted page's value off the scale is a
// guided fix (no tolerance is decided yet), and nothing is written.
// Decoys: the px-to-rem page in a build output folder, and in a folder git
// ignores, is never edited: every fix there is guided.
// Usage: node scripts/fix-test.js. Exports run() for scripts/check.js.

import { mkdtempSync, mkdirSync, cpSync, readFileSync, readdirSync, statSync, rmSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { notSource } from '../inspector/locate.js';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { start } from './serve.js';
import { loadSystem, inspect } from '../inspector/inspect.js';
import { fix, AUTO } from '../inspector/fix.js';
import { findingsOf } from '../inspector/finding.js';
import { apply, revert, offsetOf, positionOf, EditError } from '../inspector/edits.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(ROOT, 'fixtures', 'fix');
const OUT = join(ROOT, 'dist', 'fix');
const FONT = join(ROOT, 'library', 'assets', 'fonts', 'atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-wght-normal.woff2');

const tree = (dir) => {
  const out = {};
  const walk = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else out[relative(dir, p)] = readFileSync(p, 'utf8'); } };
  walk(dir);
  return out;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const differ = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);

// The edit shapes, alone: written all or none, refused before anything is written.
export function editTests() {
  const fails = [];
  const dir = mkdtempSync(join(tmpdir(), 'itten-edits-'));
  try {
    writeFileSync(join(dir, 'a.css'), 'a { b: 1px; }\nc { d: 2px; }\n');
    const refused = (what, edits) => { try { apply(dir, edits); fails.push(`edits: ${what} was not refused`); } catch (e) { if (!(e instanceof EditError)) fails.push(`edits: ${what} threw ${e.message}`); } };
    refused('two overlapping edits', [{ file: 'a.css', line: 1, column: 8, length: 3, replace: 'x' }, { file: 'a.css', line: 1, column: 9, length: 1, replace: 'y' }]);
    refused('a column past the end of a line', [{ file: 'a.css', line: 1, column: 40, length: 0, replace: 'x' }]);
    refused('a line past the end of the file', [{ file: 'a.css', line: 9, column: 1, length: 0, replace: 'x' }]);
    refused('a file outside the root', [{ file: '../a.css', line: 1, column: 1, length: 0, replace: 'x' }]);
    refused('an absolute path', [{ file: join(dir, 'a.css'), line: 1, column: 1, length: 0, replace: 'x' }]);
    // Through a symbolic link: a folder in the root that points outside it.
    const outside = mkdtempSync(join(tmpdir(), 'itten-outside-'));
    try {
      writeFileSync(join(outside, 'o.css'), 'o { p: 1px; }\n');
      symlinkSync(outside, join(dir, 'link'));
      refused('a file reached through a symbolic link out of the root', [{ file: 'link/o.css', line: 1, column: 8, length: 3, replace: 'x' }]);
      refused('creating a file through a symbolic link out of the root', [{ create: 'link/new/n.css', content: 'x' }]);
      refused('removing a file through a symbolic link out of the root', [{ remove: 'link/o.css' }]);
      if (readFileSync(join(outside, 'o.css'), 'utf8') !== 'o { p: 1px; }\n' || existsSync(join(outside, 'new'))) fails.push('edits: a file outside the root was changed through a symbolic link');
      rmSync(join(dir, 'link'));
      // A link that points at nothing, outside the root: creating through it would make its target.
      symlinkSync(join(outside, 'not-there.css'), join(dir, 'dangling.css'));
      symlinkSync(join(outside, 'no-dir'), join(dir, 'dangling-dir'));
      refused('creating a file at a symbolic link that points at nothing', [{ create: 'dangling.css', content: 'x' }]);
      refused('creating a file under a symbolic link that points at nothing', [{ create: 'dangling-dir/n.css', content: 'x' }]);
      if (existsSync(join(outside, 'not-there.css')) || existsSync(join(outside, 'no-dir'))) fails.push('edits: a file outside the root was made through a symbolic link that pointed at nothing');
      rmSync(join(dir, 'dangling.css')); rmSync(join(dir, 'dangling-dir'));
      // A link that stays inside the root is followed.
      symlinkSync(join(dir, 'a.css'), join(dir, 'inside.css'));
      try { apply(dir, [{ file: 'inside.css', line: 1, column: 1, length: 0, replace: '' }]); } catch (e) { fails.push(`edits: a symbolic link that stays inside the root is refused: ${e.message}`); }
      rmSync(join(dir, 'inside.css'));
    } finally { rmSync(outside, { recursive: true, force: true }); }
    // A byte-order mark is not counted, and a line ends at \n only.
    writeFileSync(join(dir, 'bom.css'), '\uFEFFa { b: 1px; }\r\nc { d: 2px; }\r\n');
    apply(dir, [{ file: 'bom.css', line: 1, column: 8, length: 3, replace: '1rem' }, { file: 'bom.css', line: 2, column: 8, length: 3, replace: '2rem' }]);
    if (readFileSync(join(dir, 'bom.css'), 'utf8') !== '\uFEFFa { b: 1rem; }\r\nc { d: 2rem; }\r\n') fails.push(`edits: positions in a file with a byte-order mark and \\r\\n line ends are off: ${JSON.stringify(readFileSync(join(dir, 'bom.css'), 'utf8'))}`);
    const crlf = 'ab\r\ncd';
    if (offsetOf(crlf, 1, 3) !== 2 || offsetOf(crlf, 2, 1) !== 4 || positionOf('\uFEFFab', 1).column !== 1 || offsetOf('\uFEFFab', 1, 1) !== 1) fails.push('edits: \\r is not the last character of its line, or a byte-order mark is counted');
    if (notSource(dir, 'bom.css', readFileSync(join(dir, 'bom.css'), 'utf8').slice(1)) !== null) fails.push('locate: a file with a byte-order mark is not taken as the text the browser decodes from it');
    refused('creating a file that exists', [{ create: 'a.css', content: '' }]);
    refused('removing a file that does not exist', [{ remove: 'b.css' }]);
    if (readFileSync(join(dir, 'a.css'), 'utf8') !== 'a { b: 1px; }\nc { d: 2px; }\n') fails.push('edits: a refused set wrote something');
    const undo = apply(dir, [{ file: 'a.css', line: 2, column: 8, length: 3, replace: '0.125rem' }, { file: 'a.css', line: 1, column: 8, length: 3, replace: '0.0625rem' }, { create: 'n/b.css', content: 'x' }]);
    if (readFileSync(join(dir, 'a.css'), 'utf8') !== 'a { b: 0.0625rem; }\nc { d: 0.125rem; }\n' || !existsSync(join(dir, 'n/b.css'))) fails.push('edits: a valid set was not written as given');
    revert(undo);
    if (readFileSync(join(dir, 'a.css'), 'utf8') !== 'a { b: 1px; }\nc { d: 2px; }\n' || existsSync(join(dir, 'n/b.css'))) fails.push('edits: revert did not put the files back');
    const t = 'ab\n€é\nx';
    for (const off of [0, 3, 4, 7]) { const p = positionOf(t, off); if (offsetOf(t, p.line, p.column) !== off) fails.push(`edits: offset ${off} does not survive a round trip through line and column`); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return fails;
}

export async function run({ quiet = true } = {}) {
  const fails = editTests();
  const { system, errors } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  if (errors.length) return [`fixtures/itten.system.json is not valid: ${errors.join('; ')}`];
  const classes = readdirSync(FIX).filter((n) => existsSync(join(FIX, n, 'before')));
  for (const c of AUTO) if (!classes.includes(c)) fails.push(`no fixture for the fix class ${c}`);
  const work = mkdtempSync(join(tmpdir(), 'itten-fix-'));
  const site = join(work, 'site');
  mkdirSync(join(site, 'fonts'), { recursive: true });
  cpSync(join(FIX, 'base.css'), join(site, 'base.css'));
  cpSync(FONT, join(site, 'fonts', 'atkinson-hyperlegible-next-latin-wght-normal.woff2'));
  for (const c of classes) cpSync(join(FIX, c, 'before'), join(site, c), { recursive: true });
  cpSync(join(FIX, 'planted'), join(site, 'planted'), { recursive: true });
  // Decoys: the same page as built output, and in a folder git ignores.
  cpSync(join(FIX, 'px-to-rem', 'before'), join(site, 'build', 'px-to-rem'), { recursive: true });
  cpSync(join(FIX, 'px-to-rem', 'before'), join(site, 'generated'), { recursive: true });
  writeFileSync(join(site, '.gitignore'), 'generated/\n');
  execFileSync('git', ['-C', site, 'init', '-q']);
  for (const [from, to] of [['build/px-to-rem', 'build'], ['generated', 'generated']]) {
    for (const f of ['index.html']) writeFileSync(join(site, from, f), readFileSync(join(site, from, f), 'utf8').replace('href="../base.css"', `href="${'../'.repeat(from.split('/').length)}base.css"`));
  }
  const port = 4975 + Math.floor(Math.random() * 300);
  const server = await start(port, site);
  const url = (p) => `http://127.0.0.1:${port}/${p}`;
  const opts = (name, extra = {}) => ({ root: site, system, systemPath: 'fixtures/itten.system.json', out: join(OUT, name), engines: [], quiet, ...extra });
  try {
    for (const c of classes) {
      const before = tree(join(FIX, c, 'before')), twin = tree(join(FIX, c, 'twin'));
      if (same(before, twin)) fails.push(`${c}: before/ and twin/ are the same, so the fixture tests nothing`);
      const r = await fix(url(`${c}/index.html`), opts(c));
      const auto = r.fixes.filter((x) => x.kind === 'auto');
      if (!auto.length) fails.push(`${c}: no auto fix was planned (${r.fixes.map((x) => `${x.finding.check}: ${x.kind}, ${x.note}`).join('; ') || 'no findings'})`);
      for (const x of r.fixes) {
        if (x.status !== 'kept') fails.push(`${c}: the ${x.class} fix for ${x.finding.check} was ${x.status}${x.reason ? `: ${x.reason}` : ''}${x.note ? ` (${x.note})` : ''}`);
        else if (x.class !== c) fails.push(`${c}: a fix of class ${x.class} was kept`);
      }
      const now = tree(join(site, c));
      if (!same(now, twin)) fails.push(`${c}: the fixed files differ from twin/ in ${differ(now, twin).join(', ')}`);
      const again = await inspect(url(`${c}/index.html`), { system, systemPath: 'fixtures/itten.system.json', quiet: true, engines: [], timings: false, out: join(OUT, `${c}-reinspected`) });
      for (const f of findingsOf(again)) fails.push(`${c}: the fixed page still reports ${f.check} (${f.message.split('. ')[0]})`);
      const second = await fix(url(`${c}/index.html`), opts(`${c}-second`));
      if (second.fixes.some((x) => x.status === 'kept' || x.status === 'reverted')) fails.push(`${c}: a second itten fix changed something: ${second.fixes.map((x) => `${x.class} ${x.status}`).join(', ')}`);
      if (!same(tree(join(site, c)), twin)) fails.push(`${c}: a second itten fix changed the files`);
    }

    // Planted to fail: both reverted, the page as it was, both reported.
    const planted = tree(join(site, 'planted'));
    const p = await fix(url('planted/index.html'), opts('planted', { apply: join(FIX, 'planted', 'fixes.json') }));
    const given = p.fixes.filter((x) => x.class === 'given');
    if (given.length !== 2) fails.push(`planted: ${given.length} given fixes were checked, not 2`);
    if (!given.every((x) => x.status === 'reverted')) fails.push(`planted: not every planted fix was reverted (${given.map((x) => x.status).join(', ')})`);
    if (!given[0]?.recheck || given[0].recheck.cleared) fails.push('planted: the fix that leaves its finding was not reported as leaving it');
    if (!given[1]?.recheck?.new?.some((n) => n.check === 'overflow')) fails.push('planted: the fix that brings an overflow was not reported as bringing one');
    if (!same(tree(join(site, 'planted')), planted)) fails.push('planted: the page was not left as it was');
    const cli = spawnSync(process.execPath, [join(ROOT, 'inspector', 'fix.js'), url('planted/index.html'), '--root', site, '--system', join(ROOT, 'fixtures', 'itten.system.json'), '--no-engines', '--apply', join(FIX, 'planted', 'fixes.json'), '--out', join(OUT, 'planted-cli')], { encoding: 'utf8', timeout: 600000 });
    if (cli.status !== 1) fails.push(`planted: itten fix --apply exited ${cli.status}, not 1, with both fixes reverted`);
    const own = await fix(url('planted/index.html'), opts('planted-own'));
    const off = own.fixes.find((x) => x.finding.check === 'spacing-scale');
    if (!off || off.kind !== 'guided' || off.class !== 'off-scale' || !off.locations?.some((l) => l.file === 'planted/style.css' && l.line === 2)) fails.push(`planted: the value off the scale is not a guided fix located at planted/style.css line 2 (${JSON.stringify(off?.locations)})`);
    if (!same(tree(join(site, 'planted')), planted)) fails.push('planted: a guided fix wrote to the page');

    // Never build output.
    for (const [path, dir] of [['build/px-to-rem/index.html', 'build/px-to-rem'], ['generated/index.html', 'generated']]) {
      const was = tree(join(site, dir));
      const d = await fix(url(path), opts(`decoy-${dir.replace('/', '-')}`));
      if (d.fixes.some((x) => x.kind === 'auto')) fails.push(`decoy ${dir}: an auto fix was planned for files that are not the source of truth`);
      if (!d.fixes.length) fails.push(`decoy ${dir}: no findings, so the decoy tests nothing`);
      if (!same(tree(join(site, dir)), was)) fails.push(`decoy ${dir}: the files were changed`);
    }
    // Bad usage: 64, and nothing run.
    const bad = spawnSync(process.execPath, [join(ROOT, 'inspector', 'fix.js'), url('planted/index.html'), '--root', site, '--fix-everything'], { encoding: 'utf8', timeout: 30000 });
    if (bad.status !== 64) fails.push(`itten fix with an unknown flag exited ${bad.status}, not 64`);
  } finally {
    server.close();
    rmSync(work, { recursive: true, force: true });
  }
  return fails;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  readArgs(process.argv.slice(2), { name: 'fix-test.js', usage: 'node scripts/fix-test.js' });
  const fails = await run({ quiet: false });
  for (const f of fails) console.error(`fix: ${f}`);
  console.log(fails.length ? `${fails.length} failed.` : 'Every fix class matches its twin and re-inspects clean; planted failures are reverted; build output is never edited.');
  process.exit(fails.length ? 1 : 0);
}
