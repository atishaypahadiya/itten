// Check ITTEN. Exits 1 on any failure.
// Usage: node scripts/check.js [--full]
//
// Fails when:
// - a tracked or about-to-be-committed file, or a commit message, claims it
//   was made by an automated tool, or a private file is tracked (patterns
//   from the local .itten-private-terms; skipped, with a warning, without it);
// - the system schema, the fixtures' system file or the example in
//   protocol/02-system.md does not validate, or the validator accepts a
//   broken file;
// - the inspector misses a planted defect in fixtures/index.html or reports
//   anything on fixtures/clean.html, and the same for the distinct-value
//   pair fixtures/distinct.html and distinct-clean.html (four widths and
//   the widths around each breakpoint; --full sweeps 41);
// - those four pages, inspected on one worker and again on six, differ in
//   any finding (scripts/parity-test.js), or the benchmark, the watch load
//   or motion ran beside anything else;
// - a library asset has no licence beside it;
// - the overrides schema, its example (fixtures/overrides) or the page
//   rendered from it is wrong, or the validator accepts a broken overrides
//   file; the telemetry script, run on fixtures/telemetry, flags anything
//   but CRF-16;
// - with Chromium slowed to a benchmark index of 800, the settle window does
//   not scale, or the late figure (d20) is missed or its twin reported
//   (scripts/settle-test.js);
// - a page that blocks its main thread at one width holds the run, or is
//   not reported as timed out at that width in every pass, or the watchdog
//   does not stop a stalled process (scripts/timeout-test.js);
// - --version does not print the version and ITTEN's own commit, or names
//   another repository's commit for a copy of ITTEN (scripts/version-test.js);
// - the fast tier (--fast) misses a planted layout or line defect on the
//   test print, reports anything else or anything on the clean twin, or
//   takes 30 s or more on either (scripts/fast-test.js);
// - itten fix leaves a fixture different from its hand-written twin, or the
//   fixed page reports anything, or a second run changes something; keeps a
//   planted failing fix; or edits a page in build output (scripts/fix-test.js);
// - on a page that draws WebGL every frame, drawn in software, a step runs
//   out of its limit, a crop names no frame, or two crops held at the same
//   frame differ (scripts/frozen-test.js);
// - the full sweep leaves out a width quick mode measures, or misses the
//   finding between two breakpoints (scripts/sweep-test.js);
// - the timing lock is held outside the timed phases or missing in one, is
//   left after a run or a signal, or a live lock is deleted (scripts/lock-test.js);
// - a timing finding counts on a loaded machine or a software renderer, or
//   on fewer than three close measurements (scripts/timing-test.js);
// - a run of one or two widths reports a value as fixed, or a run of three
//   does not judge fluidity (scripts/fluid-test.js);
// - a job the server failed is kept, not run again, or refuses the run
//   (scripts/health-test.js);
// - skills/itten does not match the repository's protocol, inspector,
//   schemas and lockfile, its SKILL.md breaks the Agent Skills
//   specification, or a copy of it does not run on its own
//   (scripts/skill-test.js);
// - an action or workflow uses a third-party action not pinned by a full
//   commit SHA, or the action's own tests fail (scripts/action-test.js).

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, lstatSync, readlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, register } from './lib/schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const warnings = [];
const fail = (area, msg) => failures.push(`${area}: ${msg}`);
const STARTED = Date.now();
let findingLine = null;

// ------------------------------------------------------- Public hygiene
// Authorship only: a file or a commit message that claims this repository or
// its contents were made by an automated tool (trailers, "generated with"
// lines, a tool given as author). Writing about such tools as a subject is
// fine and is not checked. The patterns live in .itten-private-terms, a link
// to the list every specialist on this machine shares
// (~/.config/specialists/private-terms; scripts/setup.sh makes the link), kept
// out of the repository so the public check does not carry what it looks for.
// One extended regular expression per line, as grep -E reads it, matched
// without case; "private <path>" lines name paths never to track. Lines
// starting "subject " are subject-matter bans (a product's name), which a
// repository may allow in a committed .private-terms-allow (patterns only):
// text an allowed pattern matches is taken out before they are tested. The
// authorship patterns are never allowed. Without the file the check is
// skipped, with a warning.
const TERMS_FILE = join(ROOT, '.itten-private-terms');
let BANNED = [];
let SUBJECT = [];
let ALLOWED = [];
let PRIVATE = [];
let hygieneNote = '';
// POSIX bracket classes, which JavaScript does not know, as their ASCII sets.
const POSIX = { space: ' \\t\\n\\r\\f\\v', punct: '!-\\/:-@\\[-`{-~', alpha: 'A-Za-z', digit: '0-9', alnum: 'A-Za-z0-9', upper: 'A-Z', lower: 'a-z' };
const ere = (t) => new RegExp(t.replace(/\[:([a-z]+):\]/g, (m, k) => POSIX[k] ?? m), 'iu');
let linkState = null;
try { linkState = lstatSync(TERMS_FILE); } catch { /* missing */ }
if (existsSync(TERMS_FILE)) {
  const lines = readFileSync(TERMS_FILE, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  PRIVATE = lines.filter((l) => l.startsWith('private ')).map((l) => l.slice(8).trim());
  for (const t of lines.filter((l) => !l.startsWith('private '))) {
    try { (t.startsWith('subject ') ? SUBJECT : BANNED).push(ere(t.replace(/^subject /, ''))); } catch (e) { fail('Hygiene', `a pattern in .itten-private-terms is not a regular expression: ${e.message}`); }
  }
  const allowFile = join(ROOT, '.private-terms-allow');
  if (existsSync(allowFile)) for (const t of readFileSync(allowFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) {
    try { ALLOWED.push(new RegExp(ere(t).source, 'giu')); } catch (e) { fail('Hygiene', `a pattern in .private-terms-allow is not a regular expression: ${e.message}`); }
  }
  if (!BANNED.length) warnings.push('Hygiene: .itten-private-terms has no patterns, so nothing is checked for authorship claims.');
  if (!linkState.isSymbolicLink()) warnings.push('Hygiene: .itten-private-terms is a file of its own, not a link to the shared list; run scripts/setup.sh.');
} else {
  hygieneNote = 'Hygiene check skipped; see the warning at the end.';
  warnings.push(linkState?.isSymbolicLink()
    ? `Hygiene check skipped: .itten-private-terms links to ${readlinkSync(TERMS_FILE)}, which does not exist; run scripts/setup.sh.`
    : 'Hygiene check skipped: .itten-private-terms is missing; run scripts/setup.sh to link it to the shared list.');
}
const claims = (text) => BANNED.some((re) => re.test(text));
const names = (text) => SUBJECT.some((re) => re.test(ALLOWED.reduce((t, a) => t.replace(a, ''), text)));
if (!ere('^[[:space:][:punct:]]*made by').test(' - made by') || ere('^[[:space:]]*made by').test('x made by')) fail('Hygiene', 'POSIX classes in the patterns are not read as grep -E reads them');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
let files = [];
try {
  files = [...new Set([...git('ls-files').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean);
} catch {
  fail('Hygiene', 'not a git repository; cannot list files');
}
for (const f of BANNED.length || SUBJECT.length || PRIVATE.length ? files : []) {
  if (PRIVATE.some((p) => f === p || f.startsWith(p))) fail('Hygiene', `${f} is private and must not be committed`);
  const full = join(ROOT, f);
  if (!existsSync(full) || !statSync(full).isFile() || statSync(full).size > 2_000_000) continue;
  if (/\.(woff2?|png|jpe?g|gif|ico|pdf)$/i.test(f)) continue;
  const lines = readFileSync(full, 'utf8').split('\n');
  lines.forEach((text, i) => {
    // .gitignore may name the private files it keeps out of the repo.
    if (f === '.gitignore' && PRIVATE.includes(text.trim())) return;
    if (claims(text)) fail('Hygiene', `${f}:${i + 1} claims tool authorship: "${text.trim().slice(0, 80)}"`);
    else if (names(text)) fail('Hygiene', `${f}:${i + 1} names a subject the shared list bans: "${text.trim().slice(0, 80)}"`);
  });
}
if (BANNED.length || SUBJECT.length) try {
  const log = git('log', '--format=%H%n%B%n--end--');
  for (const block of log.split('--end--')) {
    const [hash, ...body] = block.trim().split('\n');
    const hit = body.find((l) => claims(l) || names(l));
    if (hash && hit !== undefined) fail('Hygiene', `commit ${hash.slice(0, 7)} message claims tool authorship or names a banned subject: "${hit.trim().slice(0, 80)}"`);
  }
} catch { /* no commits yet */ }

// ----------------------------------------------------------------- Schema
let schema = null;
try {
  schema = JSON.parse(readFileSync(join(ROOT, 'schema', 'system.schema.json'), 'utf8'));
} catch (e) {
  fail('Schema', `schema/system.schema.json does not parse: ${e.message}`);
}
if (schema) {
  const systems = [];
  try { systems.push(['fixtures/itten.system.json', JSON.parse(readFileSync(join(ROOT, 'fixtures', 'itten.system.json'), 'utf8'))]); }
  catch (e) { fail('Schema', `fixtures/itten.system.json does not parse: ${e.message}`); }
  const doc = readFileSync(join(ROOT, 'protocol', '02-system.md'), 'utf8').match(/```json\n([\s\S]*?)```/);
  if (!doc) fail('Schema', 'protocol/02-system.md has no example system');
  else {
    try { systems.push(['the example in protocol/02-system.md', JSON.parse(doc[1])]); }
    catch (e) { fail('Schema', `the example in protocol/02-system.md does not parse: ${e.message}`); }
  }
  for (const [name, sys] of systems) for (const err of validate(schema, sys)) fail('Schema', `${name}: ${err}`);
  // The validator itself: a broken copy must be rejected on each count.
  if (systems[0]) {
    const broken = structuredClone(systems[0][1]);
    broken.spacing.scale = [8, 4, 4];
    broken.radius.nesting = 'nested';
    delete broken.motion;
    broken.unknown = true;
    const errs = validate(schema, broken).join('\n');
    for (const [what, re] of [['an unordered scale', /ascend/], ['a bad enum', /must be one of/], ['a missing section', /missing required "motion"/], ['an unknown property', /unknown property "unknown"/]]) {
      if (!re.test(errs)) fail('Schema', `the validator accepted ${what}`);
    }
  }
}

// -------------------------------------------------- Overrides, telemetry
try {
  const { checkFiles, validateOverrides, SCHEMA } = await import('./overrides.js');
  const { CHECKS } = await import('../inspector/inspect.js');
  const ex = join(ROOT, 'fixtures', 'overrides');
  const r = checkFiles(join(ex, 'itten.overrides.json'), join(ex, 'docs', 'itten-overrides.md'));
  for (const e of r.errors) fail('Overrides', `fixtures/overrides: ${e}`);
  const listed = SCHEMA.$defs.override.properties.check.enum;
  if (JSON.stringify([...listed].sort()) !== JSON.stringify(Object.keys(CHECKS).sort())) fail('Overrides', 'the check names in schema/overrides.schema.json differ from the inspector\'s checks');
  const good = JSON.parse(readFileSync(join(ex, 'itten.overrides.json'), 'utf8')).overrides[0];
  const future = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  for (const [what, change, re] of [
    ['an override without a reason', (o) => { delete o.reason; }, /missing required "reason"/],
    ['an unknown rule', (o) => { o.rule = 'ZZZ-99'; }, /not a rule/],
    ['a malformed rule ID', (o) => { o.rule = 'lay-10'; }, /does not match/],
    ['a date that does not exist', (o) => { o.date = '2026-02-30'; }, /not a calendar date/],
    ['a date in the future', (o) => { o.date = future; }, /in the future/],
    ['both a selector and a scope', (o) => { o.scope = 'everywhere'; }, /exactly one/],
    ['neither a selector nor a scope', (o) => { delete o.selector; }, /exactly one/],
    ['an unknown check', (o) => { o.check = 'kerning'; }, /must be one of/],
    ['an unknown field', (o) => { o.severity = 'low'; }, /unknown property/],
  ]) {
    const o = structuredClone(good);
    change(o);
    if (!re.test(validateOverrides({ overrides: [o] }).join('\n'))) fail('Overrides', `the validator accepted ${what}`);
  }
  const { collect, dirSource, ghSource } = await import('./telemetry.js');
  const t = collect(dirSource(join(ROOT, 'fixtures', 'telemetry'), 'test'), 3);
  if (t.flagged.map((f) => f.rule).join() !== 'CRF-16') fail('Telemetry', `expected CRF-16 flagged and nothing else, got ${t.flagged.map((f) => f.rule).join(', ') || 'nothing'}`);
  if (t.invalid.map((x) => x.repo).join() !== 'test/delta') fail('Telemetry', 'expected test/delta, and only it, to be rejected as invalid');
  if (t.projects.some((p) => p.repo === 'test/epsilon')) fail('Telemetry', 'read the overrides of a repository without ITTEN');
  if (t.rules.find((x) => x.rule === 'LAY-10')?.projects.length !== 2) fail('Telemetry', 'LAY-10 should count two projects');
  if (t.forks.map((x) => x.repo).join() !== 'test/theta' || t.projects.some((p) => p.repo === 'test/theta') || t.rules.some((x) => x.projects.includes('test/theta'))) fail('Telemetry', 'counted the fork test/theta, or did not list it as a fork');
  try { ghSource('test').read('test/x', 'package.json'); fail('Telemetry', 'the GitHub source read a file other than .gitmodules and itten.overrides.json'); } catch { /* refused, as it should */ }
} catch (e) {
  fail('Overrides', `the overrides and telemetry checks could not run: ${e.message.split('\n')[0]}`);
}

// ---------------------------------------------------------- Parity compare
// Findings are matched by fingerprint, not id. Only a finding's measured
// fields (its `measured` marker), the glyph counts in renderedFonts, and
// findings over a moving background may differ between two runs, as notes;
// everything else must match.
try {
  const { compare } = await import('./parity-test.js');
  const f = (o) => ({ id: 'F1', fingerprint: 'frame-timing|html', check: 'frame-timing', severity: 'warning', count: 1, message: '12 of 120 frames over 16.7 ms at 1440 px (4x CPU slow-down)', elements: [{ sel: 'html', label: 'html' }], seen: { motion: '1440' }, first: 'motion 1440', crops: [], ...o });
  const rep = (...issues) => ({ issues, summary: null, sweep: {} });
  const notes = [];
  if (compare(rep(f()), rep(f({ message: '15 of 118 frames over 16.7 ms at 1440 px (3.5x CPU slow-down)' })), 't', notes).length || notes.length !== 1) fail('Parity', 'compare() does not take a frame-timing message that differs only in its measured numbers as a note');
  if (compare(rep(f()), rep(f({ severity: 'error' })), 't').length !== 1) fail('Parity', "compare() does not report a frame-timing finding's severity changing");
  if (compare(rep(f()), rep(), 't').length !== 1 || compare(rep(), rep(f()), 't').length !== 1) fail('Parity', 'compare() does not report a frame-timing finding present in one run only');
  const n2 = [];
  if (compare(rep(f()), rep(f({ count: 2 })), 't', n2).length || n2.length !== 1 || !/1 against 2/.test(n2[0])) fail('Parity', "compare() does not take a frame-timing finding's count, a measured field, as a note with both values");
  if (compare(rep(f()), rep(f({ elements: [{ sel: 'main', label: 'main' }] })), 't').length !== 1) fail('Parity', "compare() does not report a frame-timing finding's elements changing");
  if (compare(rep(f({ check: 'radius', fingerprint: 'radius|x' })), rep(f({ check: 'radius', fingerprint: 'radius|x', count: 2 })), 't').length !== 1) fail('Parity', "compare() does not report a count changing in a check with no measured fields");
  if (compare(rep(f({ measured: ['count', 'message'] })), rep(f({ measured: ['message'] })), 't').length !== 1) fail('Parity', 'compare() does not report a change in which fields are marked measured');
  const { measuredFields } = await import('../inspector/inspect.js');
  const mf = (check, fingerprint) => JSON.stringify(measuredFields({ check, fingerprint }));
  if (mf('frame-timing', 'frame-timing|html|scroll|full') !== '["count","message","elements.rect"]' || mf('page-load', 'page-load|late') !== '["message"]' || mf('page-load', 'page-load|never-still') !== '["message"]'
    || mf('flash', 'flash|#a|script') !== '["message","elements.rect"]' || mf('flash', 'flash|#a') !== '["elements.rect"]' || mf('motion-timing', 'motion-timing|h1') !== '["elements.rect"]'
    || mf('page-load', 'page-load|requests') !== 'null' || mf('contrast', 'contrast|x') !== 'null' || mf('radius', 'radius|x') !== 'null') fail('Parity', 'measuredFields() does not mark the measured fields of timing and motion findings, and only those');
  const r = (o) => f({ check: 'radius', fingerprint: 'radius|x', ...o });
  const box = (rect, label = 'h1.line') => ({ elements: [{ sel: 'h1', label, rect }] });
  const n3 = [];
  if (compare(rep(f({ id: 'i001' })), rep(f({ id: 'i007' })), 't', n3).length || n3.length) fail('Parity', 'compare() compares report ids; findings are matched by fingerprint');
  const { toFinding: tf } = await import('../inspector/finding.js');
  const n0 = [];
  if (compare(rep(f(), r()), rep(tf(f()), tf(r())), 't', n0).length || n0.length) fail('Parity', 'compare() finds a difference between a report saved before finding/1 and the same findings written as finding/1');
  if (compare(rep(f(), r()), { findings: [tf(f()), tf(r())], summary: null, sweep: {} }, 't').length) fail('Parity', 'compare() does not read the findings of a report/1');
  // The action compares a run with the baseline from the default branch (0.3.5's
  // first pull request run stopped here). Every form a baseline comes in is read,
  // and findings match by fingerprint across forms, so a project upgrading ITTEN
  // with nothing changed on its site sees nothing new and nothing fixed.
  try {
    const { compare: against, readBaseline: readB, writeBaseline: writeB } = await import('../inspector/baseline.js');
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const same = (c, what) => { if (!c.found || c.new.length || c.fixed.length || c.worse.length || c.better.length) fail('Baseline', `${what}: found ${c.found}, new ${c.new.join() || 0}, fixed ${c.fixed.map((x) => x.fingerprint).join() || 0}, worse ${c.worse.length}, better ${c.better.length}`); };
    const page = (findings, extra = {}) => ({ schema: 'report/1', specialist: 'itten', version: '0.3.5', status: 'complete', subject: 'http://x/p', url: 'http://x/p', sweep: { widths: '320' }, findings, ...extra });
    const now = page([tf(f({ id: 'i001' })), tf(r({ id: 'i002' }))]);
    const dir = mkdtempSync(join(tmpdir(), 'itten-baseline-'));
    try {
      // report/1 against a baseline written from report/1, and against the report/1 file itself.
      writeB(join(dir, 'b.json'), now, '/p');
      same(against(now, readB(join(dir, 'b.json')), 'b.json', '/p'), 'report/1 against a baseline written from report/1');
      writeFileSync(join(dir, 'r.json'), JSON.stringify(now));
      same(against(now, readB(join(dir, 'r.json')), 'r.json', '/p'), 'report/1 against a report/1 used as the baseline');
      // report/1 against a flat report from before 0.3.5 (findings in "issues") used as the baseline.
      writeFileSync(join(dir, 'old.json'), JSON.stringify({ version: '0.3.4', url: 'http://x/p', sweep: { widths: '320' }, issues: [f({ id: 'i001' }), r({ id: 'i002' })] }));
      same(against(now, readB(join(dir, 'old.json')), 'old.json', '/p'), 'report/1 against a 0.3.4 report used as the baseline');
      // A baseline entry that holds finding/1 findings, or flat ones.
      same(against(now, { pages: { '/p': { widths: '320', findings: now.findings } } }, 'e', '/p'), 'report/1 against an entry of finding/1 findings');
      same(against(now, { pages: { '/p': { widths: '320', issues: [f(), r()] } } }, 'e', '/p'), 'report/1 against an entry of flat findings');
    } finally { rmSync(dir, { recursive: true, force: true }); }
    // Real baselines from before 0.3.5: neptune-fork's, as committed with the 0.3.4
    // action (both pages clean), and the fixtures' (0.3.3, two findings).
    const nep = readB(join(ROOT, 'fixtures', 'baselines', 'neptune-fork-0.3.2.json'));
    for (const key of ['/', '/adams-challis/']) same(against(page([], { subject: `http://x${key}`, url: `http://x${key}` }), nep, 'nep', key), `a clean report/1 against neptune-fork's baseline (${key})`);
    const fix = readB(join(ROOT, 'fixtures', 'itten-baseline.json'));
    const held = fix.pages['/fixtures/distinct.html'].findings;
    const again = page(held.map((h, k) => tf({ id: `i00${k + 1}`, check: h.check, fingerprint: h.fingerprint, severity: h.severity, message: h.message, elements: h.elements.map((sel) => ({ sel, label: sel })), seen: { light: '320' } })));
    same(against(again, fix, 'fix', '/fixtures/distinct.html'), "report/1 against the fixtures' 0.3.3 baseline, same fingerprints");
    // A fluid finding's fingerprint holds its value at each width, so 0.3.5's extra
    // breakpoint widths change it; so do the widths that turn an off-scale size
    // into a fluid one. Same check, same elements: the same finding.
    const ts = (fp, sel, o = {}) => tf({ id: o.id ?? 'i001', check: 'type-scale', fingerprint: fp, severity: o.severity ?? 'warning', message: 'm', elements: [{ sel, label: 'p' }], seen: { light: '320' } });
    const was = { pages: { '/p': { widths: '320, 768, 1440, 1920', findings: [
      { fingerprint: 'type-scale|fixed|18', check: 'type-scale', severity: 'warning', message: 'm', elements: ['#d16 > p'] },
      { fingerprint: 'spacing-scale|fluid|16,31,56,56', check: 'spacing-scale', severity: 'info', message: 'm', elements: ['#d22 > div'] }] } } };
    const moved = page([ts('type-scale|fluid|16,16.69,16.7,18,18,18,18,18', '#d16 > p'), tf({ id: 'i002', check: 'spacing-scale', fingerprint: 'spacing-scale|fluid|16,31,40,40,56,56', severity: 'info', message: 'm', elements: [{ sel: '#d22 > div', label: 'div' }], seen: { light: '320' } })]);
    same(against(moved, was, 'w', '/p'), 'fluid fingerprints that changed with the sweep, on the same elements');
    const other = against(page([ts('type-scale|fluid|16,18', '#d99 > p'), tf({ id: 'i002', check: 'spacing-scale', fingerprint: 'spacing-scale|fluid|16,56', severity: 'info', message: 'm', elements: [{ sel: '#d22 > div', label: 'div' }], seen: { light: '320' } })]), was, 'w', '/p');
    if (other.new.join() !== 'i001' || other.fixed.map((x) => x.fingerprint).join() !== 'type-scale|fixed|18') fail('Baseline', `the same check on another element must count as new and fixed: new ${other.new.join()}, fixed ${other.fixed.map((x) => x.fingerprint).join()}`);
    const c = against(page([tf(f({ id: 'i001' })), tf(r({ id: 'i002' }))]), { pages: { '/p': { widths: '320', findings: [{ fingerprint: f().fingerprint, check: f().check, severity: f().severity }, { fingerprint: 'radius|gone', check: 'radius', severity: 'warning' }] } } }, 'b', '/p');
    if (c.new.join() !== 'i002' || c.fixed.map((x) => x.fingerprint).join() !== 'radius|gone') fail('Baseline', `the baseline compare misreads what is new and fixed: new ${c.new.join()}, fixed ${c.fixed.map((x) => x.fingerprint).join()}`);
  } catch (e) { fail('Baseline', `the baseline compare cannot read a baseline: ${e.message}`); }
  const n9 = [];
  if (compare(rep(r({ elements: [{ sel: 'p', label: 'p', text: 'Week 52 of 100' }] })), rep(r({ elements: [{ sel: 'p', label: 'p', text: 'Week 53 of 100' }] })), 't', n9).length || n9.length) fail('Parity', "compare() compares an element's opening text, which is for the reader only");
  const n4 = [];
  if (compare(rep(f({ check: 'motion-timing', fingerprint: 'motion-timing|h1', ...box([0, -291.93, 1440, 120.8]) })), rep(f({ check: 'motion-timing', fingerprint: 'motion-timing|h1', ...box([0, -291.51, 1440, 120.8]) })), 't', n4).length || n4.length !== 1) fail('Parity', "compare() does not take a motion finding's element box, taken while the page moves, as a note");
  if (compare(rep(r(box([0, 0, 10, 10]))), rep(r(box([0, 1, 10, 10]))), 't').length !== 1) fail('Parity', "compare() does not report an element's box changing in a layout finding");
  if (compare(rep(f({ check: 'motion-timing', fingerprint: 'motion-timing|h1', ...box([0, 0, 1, 1]) })), rep(f({ check: 'motion-timing', fingerprint: 'motion-timing|h1', ...box([0, 0, 1, 1], 'h1.title') })), 't').length !== 1) fail('Parity', "compare() does not report a motion finding's element label changing");
  const mv = (o) => f({ check: 'contrast', fingerprint: 'contrast|p', movingBackground: true, ...o });
  const n5 = [];
  if (compare(rep(mv(), r()), rep(r()), 't', n5).length || n5.length !== 1) fail('Parity', 'compare() does not take a finding over a moving background, present in one run only, as a note');
  const n6 = [];
  if (compare(rep(mv(), r()), rep(mv({ severity: 'error', message: 'other' }), r()), 't', n6).length || n6.length !== 2) fail('Parity', 'compare() does not take a change in a finding over a moving background as a note');
  if (compare(rep(mv(), r()), rep(mv()), 't').length !== 1) fail('Parity', 'compare() lets a finding that is not over a moving background go missing from a page that has one');
  const sum = (...issues) => ({ ...rep(...issues), summary: { error: issues.filter((i) => i.severity === 'error').length } });
  const n7 = [];
  if (compare(sum(mv({ severity: 'error' }), r()), sum(r()), 't', n7).length) fail('Parity', 'compare() fails on a summary that differs only by a finding over a moving background');
  if (compare(sum(mv(), r({ severity: 'error' })), sum(mv(), r({ severity: 'error' }), r({ fingerprint: 'radius|y', severity: 'error' })), 't').filter((d) => d.includes('report.summary')).length !== 1) fail('Parity', 'compare() lets a summary differ by a finding that is not over a moving background');
  const fonts = (name, n) => ({ ...rep(), renderedFonts: [{ requested: 'Inter Tight', rendered: [`${name} (web font): ${n} glyphs`] }] });
  const n8 = [];
  if (compare(fonts('Inter Tight', 459), fonts('Inter Tight', 460), 't', n8).length || n8.length !== 1) fail('Parity', 'compare() does not take renderedFonts glyph counts as measured');
  if (compare(fonts('Inter Tight', 459), fonts('Inter Tight Light', 459), 't').length !== 1) fail('Parity', 'compare() does not report a rendered font changing');
  if (compare(rep(f({ check: 'page-load', fingerprint: 'page-load|x' })), rep(f({ check: 'page-load', fingerprint: 'page-load|x', message: '12 of 120 frames over 16.7 ms at 1440 px (5x CPU slow-down)' })), 't').length !== 1) fail('Parity', 'compare() ignores numbers in the message of a check that is not measured');
} catch (e) {
  fail('Parity', `the compare checks could not run: ${e.message.split('\n')[0]}`);
}

// --------------------------------------------------------------- Fixtures
// Run on one worker and on six; scored on the six, and the two compared.
let fixtureLine = '', parityLine = '';
try {
  const { run } = await import('./fixture-test.js');
  const { compare } = await import('./parity-test.js');
  const full = process.argv.includes('--full');
  let t = Date.now();
  const one = await run({ full, workers: 1, out: join(ROOT, 'dist', 'fixtures', 'serial') });
  const s1 = (Date.now() - t) / 1000;
  t = Date.now();
  const r = await run({ full, workers: 6 });
  const s6 = (Date.now() - t) / 1000;
  const diffs = Object.keys(one.reports).flatMap((k) => compare(one.reports[k], r.reports[k], k));
  for (const d of diffs) fail('Parity', d);
  // The phases that time things ran alone (inspect.js, phaseOverlaps).
  const { phaseOverlaps } = await import('../inspector/inspect.js');
  for (const [k, rep] of [...Object.entries(one.reports), ...Object.entries(r.reports)]) for (const p of phaseOverlaps(rep.schedule.phases)) fail('Schedule', `${k}: ${p}`);
  parityLine = `Parity: one worker ${Math.round(s1)} s, six workers ${Math.round(s6)} s, ${diffs.length ? `${diffs.length} difference(s)` : 'identical findings'}.`;
  fixtureLine = `Fixtures: recall ${r.caught}/${r.defects}, precision ${r.truePositives}/${r.truePositives + r.falsePositives.length}, clean twins ${r.findingsOnTwin} findings.`;
  for (const id of r.missed) fail('Fixtures', `planted defect ${id} was not caught`);
  for (const s of [...one.still, ...r.still]) fail('Moving tiles', s);
  const tiles = (rep) => Math.max(0, ...(rep.drawing ?? []).map((d) => d.tiles));
  fixtureLine += ` Moving tiles: test print ${tiles(r.reports['test-print'])}, clean twin ${tiles(r.reports['clean-twin'])}, distinct pages ${tiles(r.reports['distinct-test-print'])} and ${tiles(r.reports['distinct-clean-twin'])}; unexplained ${[...one.still, ...r.still].length ? 'on some' : 'none'}.`;
  // The guard itself: a still page with moving tiles must fail it.
  const { stillGuard } = await import('./fixture-test.js');
  const d = (o) => ({ drawing: [{ at: '768 px, light', regions: [[0, 0, 16, 16]], ...o }] }), none = { drawing: [] };
  if (stillGuard({ page: d({ tiles: 3, unexplained: 0 }), twin: none, dPage: none, dTwin: none }).length) fail('Moving tiles', 'the guard fails the test print for tiles over its animations');
  if (stillGuard({ page: d({ tiles: 3, unexplained: 1 }), twin: none, dPage: none, dTwin: none }).length !== 1) fail('Moving tiles', 'the guard lets an unexplained moving tile on the test print pass');
  if (stillGuard({ page: none, twin: none, dPage: none, dTwin: d({ tiles: 1, unexplained: 0 }) }).length !== 1) fail('Moving tiles', 'the guard lets a moving tile on a distinct page pass, explained or not');
  for (const f of r.falsePositives) fail('Fixtures', `false positive: ${f.check} ${f.message} [${f.elements.join(', ')}]`);
  if (!r.breakpoints.equal) fail('Fixtures', `the resize pass found ${r.breakpoints.testPrint} breakpoints on the test print and ${r.breakpoints.twin} on the twin; the fixtures have ${r.breakpoints.expected}`);
  if (!r.distinctSweep.equal) fail('Fixtures', `without a system, the sweep totals of distinct.html and its twin differ: ${JSON.stringify(r.distinctSweep.testPrint)} against ${JSON.stringify(r.distinctSweep.twin)}`);
} catch (e) {
  fail('Fixtures', `the fixture test could not run: ${e.message.split('\n')[0]}`);
}

// ------------------------------------------------------------------ Settle
// The settle window's scaling, run with Chromium slowed to a low benchmark
// index (scripts/settle-test.js).
try {
  const { run: settleTest } = await import('./settle-test.js');
  for (const f of await settleTest()) fail('Settle', f);
} catch (e) {
  fail('Settle', `the settle test could not run: ${e.message.split('\n')[0]}`);
}

// ------------------------------------------------------------ Ignore scope
// data-itten-ignore by check name, on the element itself, and on what is
// inside it only with data-itten-ignore-subtree (scripts/ignore-test.js).
try {
  const { run: ignoreTest } = await import('./ignore-test.js');
  for (const f of await ignoreTest()) fail('Ignore', f);
} catch (e) {
  fail('Ignore', `the ignore test could not run: ${e.message.split('\n')[0]}`);
}

// -------------------------------------------------------- Moving background
// A contrast finding over a canvas that keeps drawing is marked, and parity
// takes its differences as notes; the page's other findings still gate
// (fixtures/canvas.html, scripts/canvas-test.js).
try {
  const { run: canvasTest } = await import('./canvas-test.js');
  for (const f of await canvasTest()) fail('Moving background', f);
} catch (e) {
  fail('Moving background', `the canvas test could not run: ${e.message.split('\n')[0]}`);
}

// ---------------------------------------------------------------- Timeouts
// A page that hangs at one width (fixtures/hang.html), and the watchdog
// (scripts/timeout-test.js).
try {
  const { run: timeoutTest } = await import('./timeout-test.js');
  for (const f of await timeoutTest()) fail('Timeouts', f);
} catch (e) {
  fail('Timeouts', `the timeout test could not run: ${e.message.split('\n')[0]}`);
}

// ---------------------------------------------------------------- Version
// --version prints the version and ITTEN's own commit, and runs nothing else
// (scripts/version-test.js).
try {
  const { run: versionTest } = await import('./version-test.js');
  for (const f of await versionTest()) fail('Version', f);
} catch (e) {
  fail('Version', `the version test could not run: ${e.message.split('\n')[0]}`);
}

// ------------------------------------------------------------------- Fast
// The after-each-change tier (scripts/fast-test.js).
try {
  const { run: fastTest } = await import('./fast-test.js');
  for (const f of await fastTest()) fail('Fast tier', f);
} catch (e) {
  fail('Fast tier', `the fast-tier test could not run: ${e.message.split('\n')[0]}`);
}

// -------------------------------------------------------------------- Fix
// itten fix on fixtures/fix (scripts/fix-test.js).
try {
  const { run: fixTest } = await import('./fix-test.js');
  for (const f of await fixTest()) fail('Fix', f);
} catch (e) {
  fail('Fix', `the fix test could not run: ${e.message.split('\n')[0]}`);
}

// ----------------------------------------------------------------- Timing
// The timing rule (scripts/timing-test.js).
try {
  const { run: timingTest } = await import('./timing-test.js');
  for (const f of await timingTest()) fail('Timing', f);
} catch (e) {
  fail('Timing', `the timing test could not run: ${e.message.split('\n')[0]}`);
}

// ------------------------------------------------------------------- Lock
// The timing lock (scripts/lock-test.js).
try {
  const { run: lockTest } = await import('./lock-test.js');
  for (const f of await lockTest()) fail('Lock', f);
} catch (e) {
  fail('Lock', `the lock test could not run: ${e.message.split('\n')[0]}`);
}

// ----------------------------------------------------------------- Health
// The page server's health (scripts/health-test.js).
try {
  const { run: healthTest } = await import('./health-test.js');
  for (const f of await healthTest()) fail('Health', f);
} catch (e) {
  fail('Health', `the health test could not run: ${e.message.split('\n')[0]}`);
}

// ------------------------------------------------------------------ Fluid
// Fluidity needs three widths (scripts/fluid-test.js).
try {
  const { run: fluidTest } = await import('./fluid-test.js');
  for (const f of await fluidTest()) fail('Fluid', f);
} catch (e) {
  fail('Fluid', `the fluid test could not run: ${e.message.split('\n')[0]}`);
}

// ------------------------------------------------------------------ Sweep
// The full sweep measures every width quick mode does (scripts/sweep-test.js).
try {
  const { run: sweepTest } = await import('./sweep-test.js');
  for (const f of await sweepTest()) fail('Sweep', f);
} catch (e) {
  fail('Sweep', `the sweep test could not run: ${e.message.split('\n')[0]}`);
}

// ----------------------------------------------------------------- Frozen
// Frozen captures on fixtures/webgl.html (scripts/frozen-test.js).
try {
  const { run: frozenTest } = await import('./frozen-test.js');
  for (const f of await frozenTest()) fail('Frozen', f);
} catch (e) {
  fail('Frozen', `the frozen-capture test could not run: ${e.message.split('\n')[0]}`);
}

// ------------------------------------------------------------------ Skill
// skills/itten is assembled from the repository and runs from a copy
// (scripts/skill-test.js).
try {
  const { run: skillTest } = await import('./skill-test.js');
  for (const f of await skillTest()) fail('Skill', f);
} catch (e) {
  fail('Skill', `the skill test could not run: ${e.message.split('\n')[0]}`);
}

// --------------------------------------------------------------- Licences
for (const dir of ['library/assets/fonts', 'library/assets/icons']) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) continue;
  for (const sub of readdirSync(full)) {
    if (!statSync(join(full, sub)).isDirectory()) continue;
    const names = readdirSync(join(full, sub));
    if (!names.some((n) => /^(OFL|LICEN[CS]E)/i.test(n))) fail('Licence', `${dir}/${sub} has no licence file`);
  }
}

// ----------------------------------------------------------------- Action
// Third-party actions run with the job's token, so each is pinned to a
// commit, not to a tag that can move.
const workflows = ['action.yml', ...(existsSync(join(ROOT, '.github', 'workflows')) ? readdirSync(join(ROOT, '.github', 'workflows')).map((f) => `.github/workflows/${f}`) : [])];
for (const f of workflows) {
  if (!existsSync(join(ROOT, f))) { fail('Action', `${f} is missing`); continue; }
  readFileSync(join(ROOT, f), 'utf8').split('\n').forEach((l, i) => {
    const m = l.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/);
    if (m && !m[1].startsWith('./') && !/@[0-9a-f]{40}$/.test(m[1])) fail('Action', `${f}:${i + 1} uses ${m[1]}, not pinned by a full commit SHA`);
  });
}
try {
  const { run: actionTest } = await import('./action-test.js');
  for (const f of await actionTest()) fail('Action', f);
} catch (e) {
  fail('Action', `the action tests could not run: ${e.message.split('\n')[0]}`);
}

// ---------------------------------------------------------- Finding format
// finding/1 (schema/finding.schema.json), the contract every specialist
// writes, and ITTEN's extension (schema/finding-itten.schema.json). The
// schemas must reject what they should; every finding in every fixture
// report written by this run must pass both; and the flat view the
// inspector reads (inspector/finding.js) must give back what was written.
try {
  const core = register(JSON.parse(readFileSync(join(ROOT, 'schema', 'finding.schema.json'), 'utf8')));
  const ext = JSON.parse(readFileSync(join(ROOT, 'schema', 'finding-itten.schema.json'), 'utf8'));
  const envelope = JSON.parse(readFileSync(join(ROOT, 'schema', 'report.schema.json'), 'utf8'));
  const { toFinding, view } = await import('../inspector/finding.js');
  const { refusedReport } = await import('../inspector/inspect.js');
  const flat = { id: 'i001', fingerprint: 'contrast|p', check: 'contrast', severity: 'error', message: 'Text measures 2.1:1.', count: 1,
    elements: [{ sel: 'p', label: 'p', text: 'Week 52', rect: [0, 0, 10, 10], order: 4 }], seen: { light: '320' }, first: '320 px, light', title: 'Text contrast', rule: 'WCAG 1.4.3', crops: [], measured: ['elements.rect'] };
  const good = toFinding(flat);
  const errs = (f) => [...validate(core, f), ...(f.specialist === 'itten' && f.itten ? validate(ext, f.itten).map((e) => `itten${e}`) : [])];
  if (errs(good).length) fail('Finding format', `a finding written by toFinding() does not validate: ${errs(good).join('; ')}`);
  if (good.floor !== 'accessibility' || toFinding({ ...flat, check: 'spacing-unit' }).floor !== null) fail('Finding format', 'the floor of contrast is not accessibility, or spacing-unit is not craft (null)');
  if (JSON.stringify(good.measured) !== '["where.elements[].rect"]' || JSON.stringify(toFinding({ ...flat, measured: ['count', 'message'] }).measured) !== '["itten.count","message"]') fail('Finding format', 'measured fields are not written as paths');
  const sorted = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
  if (sorted(view(good)) !== sorted(flat)) fail('Finding format', 'view() does not give back the finding toFinding() wrote');
  if (view(flat) !== flat) fail('Finding format', 'view() changes a finding from a report saved before finding/1');
  const reject = [
    ['an unknown field that is not an object', { ...good, note: 'x' }],
    ['an extension named in capitals', { ...good, Kerckhoffs: {} }],
    ['a floor other than security, accessibility or none', { ...good, floor: 'craft' }],
    ['a where with every list empty', { ...good, where: { elements: [], locations: [] } }],
    ['a where with a shape outside the four', { ...good, where: { url: [{ href: '/' }] } }],
    ['a location without a file', { ...good, where: { locations: [{ line: 3 }] } }],
    ['an endpoint without a method', { ...good, where: { endpoints: [{ route: '/orders' }] } }],
    ['a resource kind in capitals', { ...good, where: { resources: [{ kind: 'Table', name: 'orders' }] } }],
    ['no detection', Object.fromEntries(Object.entries(good).filter(([k]) => k !== 'detection'))],
    ['an empty detection', { ...good, detection: [] }],
    ['a detection outside the six', { ...good, detection: ['probe'] }],
    ['a detection given twice', { ...good, detection: ['render', 'render'] }],
    ['a rule that is not an ID', { ...good, rules: ['WCAG 1.4.3'] }],
    ['an element with a field outside the core', { ...good, where: { elements: [{ sel: 'p', label: 'p', order: 1 }] } }],
    ['a measured path that is not a path', { ...good, measured: ['where..rect'] }],
    ['a missing schema', Object.fromEntries(Object.entries(good).filter(([k]) => k !== 'schema'))],
    ['an unknown field in the itten extension', { ...good, itten: { ...good.itten, colour: 'red' } }],
  ];
  for (const [what, f] of reject) if (!errs(f).length) fail('Finding format', `the schemas accept ${what}`);
  const accept = [
    ["another specialist's extension, unvalidated", { ...good, specialist: 'kerckhoffs', kerckhoffs: { anything: [1, { deep: true }] }, itten: undefined }],
    ['a finding on code, by file and column', { ...good, specialist: 'kerckhoffs', floor: 'security', detection: ['static'], rules: ['SEC-01'], where: { locations: [{ file: 'build/assets/app.js', line: 1, column: 48213 }] }, itten: undefined }],
    ['a finding on a file as a whole', { ...good, specialist: 'kerckhoffs', detection: ['config'], where: { locations: [{ file: '.env' }] }, itten: undefined }],
    ['a finding on an endpoint and in code at once', { ...good, specialist: 'erlang', floor: null, detection: ['load', 'static', 'trace'], rules: ['DAT-01', 'DAT-07'], where: { endpoints: [{ service: 'api', method: 'GET', route: '/orders/:id' }], locations: [{ file: 'src/routes/orders.js', line: 42, symbol: 'listOrders' }] }, itten: undefined }],
    ['a finding on a queue', { ...good, specialist: 'erlang', floor: null, detection: ['trace'], where: { endpoints: [{ protocol: 'queue', method: 'CONSUME', route: 'orders.created' }] }, itten: undefined }],
    ['a finding on a resource', { ...good, specialist: 'kerckhoffs', detection: ['live'], where: { resources: [{ kind: 'table', name: 'public.orders' }] }, itten: undefined }],
  ];
  for (const [what, f] of accept) { const g = JSON.parse(JSON.stringify(f)); if (errs(g).length) fail('Finding format', `the schemas reject ${what}: ${errs(g).join('; ')}`); }
  // Every finding in every fixture report this run wrote.
  const reports = [];
  const walk = (d) => { for (const n of readdirSync(d, { withFileTypes: true })) { const p = join(d, n.name); if (n.isDirectory()) walk(p); else if (n.name === 'report.json' && statSync(p).mtimeMs >= STARTED) reports.push(p); } };
  if (existsSync(join(ROOT, 'dist', 'fixtures'))) walk(join(ROOT, 'dist', 'fixtures'));
  // The report envelope, report/1: a refused report must give a reason, and so
  // must a partial one; ITTEN's own refused report must pass.
  const rerr = (r) => validate(envelope, r);
  if (rerr(refusedReport('http://127.0.0.1/', 'the page could not be reached')).length) fail('Finding format', `ITTEN's refused report does not pass report/1: ${rerr(refusedReport('http://127.0.0.1/', 'x')).join('; ')}`);
  const bare = { schema: 'report/1', specialist: 'itten', version: '0', findings: [] };
  for (const [what, r] of [['a refused report without a reason', { ...bare, status: 'refused' }], ['a partial report without a reason', { ...bare, status: 'partial' }], ['a status outside the three', { ...bare, status: 'clean' }], ['a report whose finding is not a finding/1', { ...bare, status: 'complete', findings: [{ check: 'x' }] }]]) {
    if (!rerr(r).length) fail('Finding format', `report/1 accepts ${what}`);
  }
  if (rerr({ ...bare, status: 'complete', findings: [good] }).length) fail('Finding format', `report/1 rejects a complete report: ${rerr({ ...bare, status: 'complete', findings: [good] }).join('; ')}`);
  let n = 0;
  for (const p of reports) {
    const rep = JSON.parse(readFileSync(p, 'utf8'));
    for (const e of rerr(rep).slice(0, 3)) fail('Finding format', `${p.slice(ROOT.length + 1)}: ${e}`);
    // complete exactly when no step timed out (no fixture uses --wait-for)
    const stopped = (rep.findings ?? []).some((f) => f.check === 'timed-out');
    if (rep.status !== (stopped ? 'partial' : 'complete')) fail('Finding format', `${p.slice(ROOT.length + 1)}: status ${rep.status}, but ${stopped ? 'a step timed out' : 'nothing timed out'}`);
  }
  for (const p of reports) for (const f of JSON.parse(readFileSync(p, 'utf8')).findings ?? []) {
    n++;
    for (const e of errs(f).slice(0, 3)) fail('Finding format', `${p.slice(ROOT.length + 1)}: ${f.fingerprint}: ${e}`);
    if (f.schema !== 'finding/1' || f.specialist !== 'itten' || !f.itten) fail('Finding format', `${p.slice(ROOT.length + 1)}: ${f.fingerprint} is not a finding/1 written by itten`);
  }
  if (!n) fail('Finding format', 'no fixture report was written by this run to check');
  else findingLine = `Finding format: ${reports.length} fixture reports pass report/1, with the status their timeouts call for; their ${n} findings pass finding/1 and the itten extension.`;
} catch (e) {
  fail('Finding format', `the finding format could not be checked: ${e.message.split('\n')[0]}`);
}

// ---------------------------------------------------------------- Report
console.log(hygieneNote || `Checked ${files.length} files.`);
if (fixtureLine) console.log(fixtureLine);
if (parityLine) console.log(parityLine);
if (findingLine) console.log(findingLine);
for (const w of warnings) console.log(`warn  ${w}`);
for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log(warnings.length ? `\nPassed with ${warnings.length} warning(s).` : '\nPassed.');
