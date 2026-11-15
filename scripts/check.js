// Check ITTEN. Exits 1 on any failure.
// Usage: node scripts/check.js [--full]
//
// Fails when:
// - a tracked or about-to-be-committed file, or a commit message, names an
//   automated writing tool or assistant, or a private file is tracked
//   (terms from the local .itten-private-terms; skipped without it);
// - the system schema, the fixtures' system file or the example in
//   protocol/02-system.md does not validate, or the validator accepts a
//   broken file;
// - the inspector misses a planted defect in fixtures/index.html or reports
//   anything on fixtures/clean.html, and the same for the distinct-value
//   pair fixtures/distinct.html and distinct-clean.html (four widths;
//   --full sweeps 41);
// - a library asset has no licence beside it;
// - the overrides schema, its example (fixtures/overrides) or the page
//   rendered from it is wrong, or the validator accepts a broken overrides
//   file; the telemetry script, run on fixtures/telemetry, flags anything
//   but CRF-16;
// - an action or workflow uses a third-party action not pinned by a full
//   commit SHA, or the action's own tests fail (scripts/action-test.js).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './lib/schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const warnings = [];
const fail = (area, msg) => failures.push(`${area}: ${msg}`);

// ------------------------------------------------------- Public hygiene
// The terms live in .itten-private-terms, a local file kept out of the repo,
// so the public check does not carry the words it looks for. One regular
// expression per line; "private <path>" lines name files never to track.
// Without the file the hygiene check is skipped, with a notice.
const TERMS_FILE = join(ROOT, '.itten-private-terms');
let BANNED = null;
let PRIVATE = [];
let hygieneNote = '';
if (existsSync(TERMS_FILE)) {
  const lines = readFileSync(TERMS_FILE, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  PRIVATE = lines.filter((l) => l.startsWith('private ')).map((l) => l.slice(8).trim());
  const terms = lines.filter((l) => !l.startsWith('private '));
  if (terms.length) BANNED = new RegExp(terms.join('|'), 'i');
} else {
  hygieneNote = 'Hygiene check skipped: .itten-private-terms not found.';
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
let files = [];
try {
  files = [...new Set([...git('ls-files').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean);
} catch {
  fail('Hygiene', 'not a git repository; cannot list files');
}
for (const f of BANNED || PRIVATE.length ? files : []) {
  if (PRIVATE.some((p) => f === p || f.startsWith(p))) fail('Hygiene', `${f} is private and must not be committed`);
  const full = join(ROOT, f);
  if (!existsSync(full) || !statSync(full).isFile() || statSync(full).size > 2_000_000) continue;
  if (/\.(woff2?|png|jpe?g|gif|ico|pdf)$/i.test(f)) continue;
  const lines = readFileSync(full, 'utf8').split('\n');
  lines.forEach((text, i) => {
    // .gitignore may name the private files it keeps out of the repo.
    if (f === '.gitignore' && PRIVATE.includes(text.trim())) return;
    if (BANNED && BANNED.test(text)) fail('Hygiene', `${f}:${i + 1} names a tool or assistant: "${text.trim().slice(0, 80)}"`);
  });
}
if (BANNED) try {
  const log = git('log', '--format=%H%n%B%n--end--');
  for (const block of log.split('--end--')) {
    const [hash, ...body] = block.trim().split('\n');
    if (hash && BANNED.test(body.join('\n'))) fail('Hygiene', `commit ${hash.slice(0, 7)} message names a tool or assistant, or carries a trailer`);
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

// --------------------------------------------------------------- Fixtures
let fixtureLine = '';
try {
  const { run } = await import('./fixture-test.js');
  const r = await run({ full: process.argv.includes('--full') });
  fixtureLine = `Fixtures: recall ${r.caught}/${r.defects}, precision ${r.truePositives}/${r.truePositives + r.falsePositives.length}, clean twins ${r.findingsOnTwin} findings.`;
  for (const id of r.missed) fail('Fixtures', `planted defect ${id} was not caught`);
  for (const f of r.falsePositives) fail('Fixtures', `false positive: ${f.check} ${f.message} [${f.elements.join(', ')}]`);
  if (!r.breakpoints.equal) fail('Fixtures', `the resize pass found ${r.breakpoints.testPrint} breakpoints on the test print and ${r.breakpoints.twin} on the twin; the fixtures have ${r.breakpoints.expected}`);
  if (!r.distinctSweep.equal) fail('Fixtures', `without a system, the sweep totals of distinct.html and its twin differ: ${JSON.stringify(r.distinctSweep.testPrint)} against ${JSON.stringify(r.distinctSweep.twin)}`);
} catch (e) {
  fail('Fixtures', `the fixture test could not run: ${e.message.split('\n')[0]}`);
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

// ---------------------------------------------------------------- Report
console.log(hygieneNote || `Checked ${files.length} files.`);
if (fixtureLine) console.log(fixtureLine);
for (const w of warnings) console.log(`warn  ${w}`);
for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log(warnings.length ? `\nPassed with ${warnings.length} warning(s).` : '\nPassed.');
