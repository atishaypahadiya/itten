// --version prints the version and the commit, and runs nothing else; a copy of ITTEN that is not its own git
// checkout says the commit is unknown instead of naming another repository's commit.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionLine } from '../inspector/version.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function run() {
  const fails = [];
  const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const want = new RegExp(`^itten ${version.replace(/\./g, '\\.')} ${head}( \\(with uncommitted changes\\))?$`);
  for (const argv of [['--version'], ['--version', 'http://127.0.0.1:9/'], ['http://127.0.0.1:9/', '--version']]) {
    const r = spawnSync(process.execPath, [join(ROOT, 'inspector', 'inspect.js'), ...argv], { encoding: 'utf8', timeout: 30000 });
    const out = r.stdout.trim();
    if (r.status !== 0) fails.push(`inspect.js ${argv.join(' ')} exited ${r.status}, not 0`);
    if (!want.test(out)) fails.push(`inspect.js ${argv.join(' ')} printed "${out}", not "itten ${version} ${head}"`);
    if (r.stderr.trim()) fails.push(`inspect.js ${argv.join(' ')} wrote to stderr: ${r.stderr.trim().split('\n')[0]}`);
  }
  const tmp = mkdtempSync(join(tmpdir(), 'itten-version-'));
  const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const ident = ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false'];
  try {
    // A checkout of its own: its HEAD, and a change to a tracked file is said.
    const own = join(tmp, 'own'); mkdirSync(own);
    writeFileSync(join(own, 'package.json'), JSON.stringify({ version: '9.9.9' }));
    git(own, 'init', '-q'); git(own, 'add', '.'); git(own, ...ident, 'commit', '-qm', 'x');
    const ownHead = git(own, 'rev-parse', 'HEAD');
    if (versionLine(own) !== `itten 9.9.9 ${ownHead}`) fails.push(`own checkout: "${versionLine(own)}"`);
    writeFileSync(join(own, 'package.json'), JSON.stringify({ version: '9.9.10' }));
    if (versionLine(own) !== `itten 9.9.10 ${ownHead} (with uncommitted changes)`) fails.push(`modified checkout: "${versionLine(own)}"`);
    // A plain copy, and a copy inside another repository: no commit of its own.
    const copy = join(tmp, 'copy'); mkdirSync(copy);
    writeFileSync(join(copy, 'package.json'), JSON.stringify({ version: '9.9.9' }));
    const unknown = 'itten 9.9.9 (commit unknown: not a git checkout of ITTEN)';
    if (versionLine(copy) !== unknown) fails.push(`plain copy: "${versionLine(copy)}"`);
    // The skill's own SKILL.md, as in the repository: no source recorded, so no commit.
    writeFileSync(join(copy, 'SKILL.md'), '---\nname: itten\ndescription: x\nmetadata:\n  version: "9.9.9"\n---\n# ITTEN\n');
    if (versionLine(copy) !== unknown) fails.push(`skill not installed by gh: "${versionLine(copy)}"`);
    // Installed by gh skill install, which records the repository and the ref it installed.
    writeFileSync(join(copy, 'SKILL.md'), '---\nname: itten\ndescription: x\nmetadata:\n    github-path: skills/itten\n    github-ref: v9.9.9\n    github-repo: https://github.com/o/itten\n    version: 9.9.9\n---\n# ITTEN\n');
    if (versionLine(copy) !== 'itten 9.9.9 v9.9.9 (skill installed from https://github.com/o/itten)') fails.push(`skill installed by gh: "${versionLine(copy)}"`);
    const outer = join(tmp, 'outer'), vendored = join(outer, 'itten'); mkdirSync(vendored, { recursive: true });
    writeFileSync(join(vendored, 'package.json'), JSON.stringify({ version: '9.9.9' }));
    git(outer, 'init', '-q'); git(outer, 'add', '.'); git(outer, ...ident, 'commit', '-qm', 'x');
    if (versionLine(vendored) !== unknown) fails.push(`copy inside another repository: "${versionLine(vendored)}"`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  return fails;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  readArgs(process.argv.slice(2), { name: 'version-test.js', usage: 'node scripts/version-test.js' });
  const fails = await run();
  for (const f of fails) console.log(`FAIL ${f}`);
  console.log(fails.length ? `${fails.length} failed` : 'version: all passed');
  process.exit(fails.length ? 1 : 0);
}
