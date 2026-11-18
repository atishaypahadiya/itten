// The inspector's version and the commit it runs from, for --version.
//
// The commit is read with git from ITTEN's own checkout: a clone or a submodule. A copy of ITTEN that is not its
// own checkout (files vendored into another repository, or the tarball GitHub downloads for an action) has no
// commit of its own, and the line says so rather than naming the enclosing repository's commit.
import { readFileSync, realpathSync } from 'node:fs';
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

export function versionLine(root = ROOT) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const c = commitOf(root);
  if (!c) return `itten ${version} (commit unknown: not a git checkout of ITTEN)`;
  return `itten ${version} ${c.sha}${c.modified ? ' (with uncommitted changes)' : ''}`;
}
