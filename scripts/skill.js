// ITTEN as an Agent Skill: skills/itten/ (https://agentskills.io/specification).
//
// The folder holds two files written for it, SKILL.md and scripts/setup.sh,
// and copies of the repository's own protocol, inspector, schemas and
// lockfile, so an installed skill carries everything it runs. The copies are
// never edited by hand: they are assembled from the repository, and the
// check fails when the folder does not match.
//
// Usage: node scripts/skill.js            check skills/itten (exit 1 if it does not match)
//        node scripts/skill.js --write    assemble the copies into skills/itten
// Exports check() and assemble() for scripts/check.js and the tests.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL = join(ROOT, 'skills', 'itten');

// What the skill copies from the repository, as paths relative to its root.
// The inspector imports scripts/lib/schema.js and reads schema/ and
// package.json; the protocol is what the agent reads.
export const COPIED = ['LICENSE', 'package.json', 'package-lock.json', 'inspector', 'protocol', 'schema', 'scripts/lib/schema.js'];
// What is written for the skill itself, and only lives there.
export const OWN = ['SKILL.md', 'scripts/setup.sh'];
// Left by an install or a run, never committed (.gitignore): not part of the folder.
const LOCAL = new Set(['node_modules', 'dist', 'itten-report']);

function* files(dir, base = dir) {
  for (const name of readdirSync(dir).sort()) {
    if (name === '.DS_Store') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p, base);
    else yield relative(base, p);
  }
}
const expand = (root, paths) => paths.flatMap((p) => (statSync(join(root, p)).isDirectory() ? [...files(join(root, p))].map((f) => join(p, f)) : [p]));

// The Agent Skills frontmatter, read as the specification writes it: flat
// "key: value" lines, and metadata as an indented map of strings. Returns the
// fields and what breaks the specification's rules.
export function frontmatter(text, dirName) {
  const errors = [];
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { fields: {}, errors: ['SKILL.md does not start with YAML frontmatter between --- lines'] };
  const fields = {};
  let map = null;
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const kv = line.match(/^(\s*)([A-Za-z][\w-]*):(?:\s+(.*))?$/);
    if (!kv) { errors.push(`frontmatter line not understood: "${line}"`); continue; }
    const [, indent, key, raw = ''] = kv;
    const value = raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (indent) {
      if (!map) { errors.push(`"${key}" is indented but belongs to no map`); continue; }
      if (raw === '') errors.push(`metadata.${key} has no value; metadata maps strings to strings`);
      map[key] = value;
    } else if (raw === '') { fields[key] = map = {}; } else { fields[key] = value; map = null; }
  }
  const allowed = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
  for (const k of Object.keys(fields)) if (!allowed.includes(k)) errors.push(`"${k}" is not a field the specification defines (${allowed.join(', ')})`);
  const name = fields.name;
  if (typeof name !== 'string' || !name) errors.push('name is required');
  else {
    if (name.length > 64) errors.push('name is longer than 64 characters');
    if (!/^[a-z0-9-]+$/.test(name)) errors.push('name may hold only lowercase letters, digits and hyphens');
    if (/^-|-$/.test(name)) errors.push('name must not start or end with a hyphen');
    if (name.includes('--')) errors.push('name must not hold two hyphens in a row');
    if (dirName && name !== dirName) errors.push(`name "${name}" does not match the folder "${dirName}"`);
  }
  const d = fields.description;
  if (typeof d !== 'string' || !d.trim()) errors.push('description is required');
  else if (d.length > 1024) errors.push(`description is ${d.length} characters; at most 1024`);
  if (fields.compatibility !== undefined && (typeof fields.compatibility !== 'string' || !fields.compatibility || fields.compatibility.length > 500)) errors.push('compatibility must be 1 to 500 characters');
  if (fields.metadata !== undefined && typeof fields.metadata !== 'object') errors.push('metadata must be a map of strings');
  return { fields, errors, body: text.slice(m[0].length) };
}

// What is wrong with the folder, as sentences; empty when it matches.
export function check({ root = ROOT, skill = SKILL } = {}) {
  const out = [];
  if (!existsSync(skill)) return [`${relative(root, skill)} does not exist; run node scripts/skill.js --write`];
  for (const f of OWN) if (!existsSync(join(skill, f))) out.push(`${f} is missing`);
  const want = expand(root, COPIED);
  for (const f of want) {
    const p = join(skill, f);
    if (!existsSync(p)) out.push(`${f} is missing; run node scripts/skill.js --write`);
    else if (!readFileSync(p).equals(readFileSync(join(root, f)))) out.push(`${f} differs from the repository's; run node scripts/skill.js --write`);
  }
  const known = new Set([...want, ...OWN]);
  for (const f of files(skill)) if (!known.has(f) && !LOCAL.has(f.split('/')[0])) out.push(`${f} is in the skill but neither copied from the repository nor written for it`);
  const { fields, errors, body } = frontmatter(readFileSync(join(skill, 'SKILL.md'), 'utf8'), 'itten');
  out.push(...errors.map((e) => `SKILL.md: ${e}`));
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  if (fields.metadata?.version !== version) out.push(`SKILL.md: metadata.version is "${fields.metadata?.version}", and package.json says ${version}`);
  if (body && body.split('\n').length > 500) out.push('SKILL.md is longer than 500 lines');
  return out;
}

export function assemble({ root = ROOT, skill = SKILL } = {}) {
  for (const p of COPIED) rmSync(join(skill, p), { recursive: true, force: true });
  for (const f of expand(root, COPIED)) {
    mkdirSync(dirname(join(skill, f)), { recursive: true });
    writeFileSync(join(skill, f), readFileSync(join(root, f)));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const bad = args.filter((a) => a !== '--write');
  if (bad.length) { console.error(`skill.js: unknown argument ${bad.map((a) => `"${a}"`).join(', ')} (usage: node scripts/skill.js [--write])`); process.exit(64); }
  if (args.includes('--write')) assemble();
  const problems = check();
  for (const p of problems) console.error(`skills/itten: ${p}`);
  if (problems.length) process.exit(1);
  console.log(`skills/itten matches the repository${args.includes('--write') ? ' (assembled)' : ''}.`);
}
