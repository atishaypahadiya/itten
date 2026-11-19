#!/usr/bin/env node
// Override telemetry: which ITTEN rules do projects set aside, and why?
//
// Lists an owner's public repositories with the gh CLI, keeps those whose
// .gitmodules includes ITTEN, reads their itten.overrides.json, and counts
// overrides by rule. A rule overridden in the threshold number of projects
// or more (default 3) is flagged with the reasons side by side, since a rule
// that many projects set aside is a rule to rewrite. Files that do not
// validate against schema/overrides.schema.json are listed and not counted.
// Forks are listed and not read: a fork carries its parent's overrides, so
// counting it would count one project's decisions twice.
//
// From each repository it reads .gitmodules and, where that names ITTEN,
// itten.overrides.json at the root of the default branch. Nothing else.
//
// Usage:
//   node scripts/telemetry.js [--owner atishaypahadiya] [--threshold 3]
//        [--out research/telemetry.md] [--json telemetry.json]
//   node scripts/telemetry.js --from <dir> ...   read repositories from <dir>/<name>/ instead (for tests);
//        <dir>/<name>/repo.json stands for what the GitHub listing says of the repository ({ "fork": "owner/parent" })

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateOverrides } from './overrides.js';
import { rules } from './lib/rules.js';
import { readArgs } from '../inspector/usage.js';

export const FILES = ['.gitmodules', 'itten.overrides.json'];

// The two ways to reach repositories: GitHub through gh, or a local folder.
// list() returns { repo, fork } for each, fork being the parent's name or null.
export function ghSource(owner) {
  const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  return {
    describe: `${owner}'s public repositories on GitHub`,
    list: () => JSON.parse(gh('repo', 'list', owner, '--visibility', 'public', '--limit', '1000', '--json', 'nameWithOwner,isFork,parent'))
      .map((r) => ({ repo: r.nameWithOwner, fork: r.isFork ? (r.parent ? `${r.parent.owner.login}/${r.parent.name}` : 'an unknown repository') : null }))
      .sort((a, b) => a.repo.localeCompare(b.repo)),
    read: (repo, path) => {
      if (!FILES.includes(path)) throw new Error(`telemetry reads only ${FILES.join(' and ')}`);
      try {
        return gh('api', `repos/${repo}/contents/${path}`, '-H', 'Accept: application/vnd.github.raw+json');
      } catch (e) {
        if (/HTTP 404|HTTP 409/.test(String(e.stderr))) return null;
        throw new Error(`${repo}/${path}: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
      }
    },
  };
}

export function dirSource(dir, owner) {
  return {
    describe: `the test repositories in ${dir}`,
    list: () => readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort().map((n) => {
      const meta = join(dir, n, 'repo.json');
      return { repo: `${owner}/${n}`, fork: existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')).fork ?? null : null };
    }),
    read: (repo, path) => {
      if (!FILES.includes(path)) throw new Error(`telemetry reads only ${FILES.join(' and ')}`);
      const p = join(dir, repo.split('/')[1], path);
      return existsSync(p) ? readFileSync(p, 'utf8') : null;
    },
  };
}

// A submodule counts as ITTEN when its URL's last segment is itten.
export const includesItten = (gitmodules) => /^\s*url\s*=\s*\S*?[/:]itten(?:\.git)?\/?\s*$/im.test(gitmodules || '');

export function collect(source, threshold = 3) {
  const repos = source.list();
  const projects = [], invalid = [], unreadable = [], forks = [];
  let withItten = 0;
  for (const { repo, fork } of repos) {
    if (fork) { forks.push({ repo, parent: fork }); continue; }
    let mods;
    try { mods = source.read(repo, '.gitmodules'); } catch (e) { unreadable.push({ repo, error: e.message }); continue; }
    if (!includesItten(mods)) continue;
    withItten++;
    let text;
    try { text = source.read(repo, 'itten.overrides.json'); } catch (e) { unreadable.push({ repo, error: e.message }); continue; }
    if (text === null) { projects.push({ repo, overrides: null }); continue; }
    let data;
    try { data = JSON.parse(text); } catch (e) { invalid.push({ repo, errors: [`does not parse: ${e.message}`] }); continue; }
    const errors = validateOverrides(data);
    if (errors.length) { invalid.push({ repo, errors }); continue; }
    projects.push({ repo, overrides: data.overrides });
  }
  const byRule = new Map();
  for (const p of projects) for (const o of p.overrides ?? []) {
    if (!byRule.has(o.rule)) byRule.set(o.rule, []);
    byRule.get(o.rule).push({ repo: p.repo, ...o });
  }
  const known = rules();
  const ruleRows = [...byRule.entries()].map(([rule, list]) => ({
    rule, title: known.get(rule)?.title ?? '', file: known.get(rule)?.file ?? '',
    projects: [...new Set(list.map((o) => o.repo))], overrides: list,
  })).sort((a, b) => b.projects.length - a.projects.length || a.rule.localeCompare(b.rule));
  return {
    date: new Date().toISOString().slice(0, 10), source: source.describe, threshold,
    repositories: repos.length, forks, withItten, withOverrides: projects.filter((p) => p.overrides).length,
    projects: projects.map((p) => ({ repo: p.repo, overrides: p.overrides ? p.overrides.length : null })),
    invalid, unreadable, rules: ruleRows, flagged: ruleRows.filter((r) => r.projects.length >= threshold),
  };
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function render(r) {
  const out = [
    '# Override telemetry',
    '',
    `Run on ${r.date} over ${r.source}: ${r.repositories} ${r.repositories === 1 ? 'repository' : 'repositories'}, ${r.forks.length} of them ${r.forks.length === 1 ? 'a fork' : 'forks'} and not read, ${r.withItten} with ITTEN as a submodule, ${r.withOverrides} with a valid \`itten.overrides.json\`. From each repository only \`.gitmodules\` and \`itten.overrides.json\` were read. Generated by \`node scripts/telemetry.js\`.`,
    '',
    `A rule overridden in ${r.threshold} or more projects is flagged: a rule that many projects set aside is a rule to rewrite, or to state more exactly.`,
    '',
    '## Flagged',
    '',
  ];
  if (!r.flagged.length) out.push(`No rule is overridden in ${r.threshold} or more projects.`, '');
  for (const f of r.flagged) {
    out.push(`### ${f.rule}${f.title ? ' · ' + f.title : ''}`, '', `Overridden in ${plural(f.projects.length, 'project')}${f.file ? `; defined in \`${f.file}\`` : ''}.`, '');
    // Optional columns appear only when some override fills them.
    const cols = [
      ['Project', (o) => o.repo], ['Where', (o) => (o.selector ? '`' + o.selector + '`' : o.scope)], ['Check', (o) => (o.check ? '`' + o.check + '`' : '')],
      ['System value', (o) => o.value], ['Used instead', (o) => o.instead], ['Reason', (o) => o.reason],
      ['Floors still met', (o) => (o.floors === undefined ? '' : o.floors ? 'Yes' : 'No')], ['Date', (o) => o.date], ['ITTEN', (o) => o.itten],
    ].filter(([, get]) => f.overrides.some((o) => get(o)));
    out.push(`| ${cols.map(([h]) => h).join(' | ')} |`, `|${cols.map(() => '---|').join('')}`);
    for (const o of f.overrides) out.push(`| ${cols.map(([, get]) => cell(get(o))).join(' | ')} |`);
    out.push('');
  }
  out.push('## Projects', '');
  if (r.projects.length) out.push('| Project | Overrides |', '|---|--:|', ...r.projects.map((p) => `| ${p.repo} | ${p.overrides ?? 'no file'} |`), '');
  else out.push('None with a readable overrides file.', '');
  out.push('## Every rule overridden', '');
  if (r.rules.length) out.push('| Rule | Projects | Overrides |', '|---|--:|--:|', ...r.rules.map((x) => `| ${x.rule}${x.title ? ' · ' + cell(x.title) : ''} | ${x.projects.length} | ${x.overrides.length} |`), '');
  else out.push('None.', '');
  if (r.invalid.length) {
    out.push('## Files that did not validate', '', 'Not counted above.', '');
    for (const x of r.invalid) out.push(`- ${x.repo}: ${cell(x.errors.slice(0, 3).join('; '))}${x.errors.length > 3 ? `; and ${x.errors.length - 3} more` : ''}`);
    out.push('');
  }
  if (r.forks.length) {
    out.push('## Forks', '', 'Not read: a fork carries its parent\'s overrides, so counting it would count one project twice.', '');
    for (const x of r.forks) out.push(`- ${x.repo}, a fork of ${x.parent}`);
    out.push('');
  }
  if (r.unreadable.length) {
    out.push('## Repositories that could not be read', '');
    for (const x of r.unreadable) out.push(`- ${x.repo}: ${cell(x.error)}`);
    out.push('');
  }
  return out.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  readArgs(args, { name: 'telemetry.js', usage: 'node scripts/telemetry.js [--owner <login>] [--threshold 3] [--from <dir>] [--out research/telemetry.md] [--json <file>]', flags: { owner: 'value', threshold: 'value', from: 'value', out: 'value', json: 'value' } });
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
  const owner = opt('--owner', 'atishaypahadiya');
  const threshold = Number(opt('--threshold', '3'));
  const from = opt('--from', null);
  const r = collect(from ? dirSource(from, owner) : ghSource(owner), threshold);
  const md = opt('--out', 'research/telemetry.md');
  mkdirSync(dirname(resolve(md)), { recursive: true });
  writeFileSync(md, render(r));
  const json = opt('--json', null);
  if (json) writeFileSync(json, JSON.stringify(r, null, 2));
  console.log(`${r.repositories} repositories, ${r.forks.length} forks skipped, ${r.withItten} with ITTEN, ${r.withOverrides} with valid overrides, ${r.invalid.length} invalid. Flagged: ${r.flagged.map((f) => f.rule).join(', ') || 'none'}. Wrote ${md}.`);
}
