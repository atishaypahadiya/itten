// The inspector's version and the commit it runs from, for --version.
//
// The commit is read with git from ITTEN's own checkout: a clone or a submodule. A copy of ITTEN that is not its
// own checkout (files vendored into another repository, or the tarball GitHub downloads for an action) has no
// commit of its own, and the line says so rather than naming the enclosing repository's commit. The Agent Skill,
// installed with gh skill install, is such a copy, but gh records where it came from in SKILL.md's metadata
// (github-repo, and github-ref: the tag or commit installed), and the line gives that.
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function commitOf(root = ROOT) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    if (realpathSync(git('rev-parse', '--show-toplevel')) !== realpathSync(root)) return null;
    return { sha: git('rev-parse', 'HEAD'), modified: git('status', '--porcelain', '--untracked-files=no') !== '' };
  } catch { return null; }
}

// What gh skill install wrote into the skill's frontmatter: { repo, ref }, or null.
export function installedFrom(root = ROOT) {
  const f = join(root, 'SKILL.md');
  if (!existsSync(f)) return null;
  const head = (readFileSync(f, 'utf8').match(/^---\n([\s\S]*?)\n---\n/) || [])[1] ?? '';
  const get = (k) => (head.match(new RegExp(`^\\s+${k}:\\s*["']?([^"'\\n]+)`, 'm')) || [])[1]?.trim();
  const ref = get('github-ref'), repo = get('github-repo');
  return ref && repo ? { repo, ref } : null;
}

export function versionLine(root = ROOT) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const c = commitOf(root);
  const skill = c ? null : installedFrom(root);
  if (skill) return `itten ${version} ${skill.ref} (skill installed from ${skill.repo})`;
  if (!c) return `itten ${version} (commit unknown: not a git checkout of ITTEN)`;
  return `itten ${version} ${c.sha}${c.modified ? ' (with uncommitted changes)' : ''}`;
}
