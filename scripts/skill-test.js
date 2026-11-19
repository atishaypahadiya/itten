// The Agent Skill (skills/itten): the folder matches the repository, its
// frontmatter follows the specification, and a copy of it, as an install
// leaves it, runs on its own: setup.sh installs nothing until the user has
// agreed (--yes), rejects an argument it does not know with 64, and the
// inspector in the copy prints its version and validates a system file.
// Exports run() for scripts/check.js; returns what failed, as sentences.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, frontmatter, SKILL } from './skill.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function run() {
  const fails = [...check()];
  // The validator rejects what the specification forbids.
  const fm = (head) => frontmatter(`---\n${head}\n---\nbody\n`, 'itten').errors;
  const bad = [
    ['an uppercase name', 'name: Itten\ndescription: x'],
    ['a name with two hyphens in a row', 'name: it--ten\ndescription: x'],
    ['a name that ends with a hyphen', 'name: itten-\ndescription: x'],
    ['a name that is not the folder', 'name: other\ndescription: x'],
    ['no description', 'name: itten'],
    ['a description over 1024 characters', `name: itten\ndescription: ${'x'.repeat(1025)}`],
    ['a field the specification does not define', 'name: itten\ndescription: x\nversion: 1'],
    ['compatibility over 500 characters', `name: itten\ndescription: x\ncompatibility: ${'x'.repeat(501)}`],
  ];
  for (const [what, head] of bad) if (!fm(head).length) fails.push(`the frontmatter check accepts ${what}`);
  if (fm('name: itten\ndescription: x\nmetadata:\n  version: "1.0"').length) fails.push('the frontmatter check rejects a valid minimal SKILL.md');

  const tmp = mkdtempSync(join(tmpdir(), 'itten-skill-'));
  try {
    const copy = join(tmp, 'itten');
    cpSync(SKILL, copy, { recursive: true, filter: (p) => !/\/(node_modules|dist)(\/|$)/.test(p) });
    const sh = (...a) => spawnSync('bash', [join(copy, 'scripts', 'setup.sh'), ...a], { encoding: 'utf8', timeout: 30000, env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(tmp, 'browsers') } });
    const list = sh();
    if (list.status !== 0) fails.push(`setup.sh without --yes exited ${list.status}, not 0`);
    if (!/Playwright \d+\.\d+\.\d+/.test(list.stdout) || !/Nothing installed/.test(list.stdout)) fails.push(`setup.sh without --yes did not list what it would install: ${list.stdout.trim().split('\n')[0]}`);
    if (existsSync(join(copy, 'node_modules')) || existsSync(join(tmp, 'browsers'))) fails.push('setup.sh without --yes installed something');
    const unknown = sh('--yse');
    if (unknown.status !== 64) fails.push(`setup.sh --yse exited ${unknown.status}, not 64`);
    if (existsSync(join(copy, 'node_modules'))) fails.push('setup.sh --yse installed something');
    const node = (...a) => spawnSync(process.execPath, [join(copy, 'inspector', 'inspect.js'), ...a], { encoding: 'utf8', timeout: 30000, cwd: tmp });
    const v = node('--version');
    const version = JSON.parse(readFileSync(join(copy, 'package.json'), 'utf8')).version;
    if (v.status !== 0 || !v.stdout.startsWith(`itten ${version} `)) fails.push(`the copy's inspect.js --version printed "${v.stdout.trim()}" (exit ${v.status})`);
    const val = node('--validate', join(ROOT, 'fixtures', 'itten.system.json'));
    if (val.status !== 0) fails.push(`the copy's inspect.js --validate exited ${val.status}: ${(val.stderr || val.stdout).trim().split('\n')[0]}`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  return fails;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fails = await run();
  for (const f of fails) console.error(`skill: ${f}`);
  console.log(fails.length ? `${fails.length} failed.` : 'The skill matches the repository and runs from a copy.');
  process.exit(fails.length ? 1 : 0);
}
