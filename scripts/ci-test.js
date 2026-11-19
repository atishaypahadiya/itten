// When the self-test workflow runs (docs/CONTRACT.md, "Continuous
// integration"). The shared rule is "at least every non-Markdown change":
// every push to main, every pull request, and any pushed v* tag. Here it
// runs on every push and every pull request with no path filter, because
// main's required checks (checks, fixtures) must report on every commit: a
// filtered-out workflow reports nothing, and a Markdown-only pull request
// could never merge.
// Usage: node scripts/ci-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The `on:` block of a workflow: its lines up to the next top-level key.
export function triggers(text) {
  const lines = text.split('\n');
  const from = lines.findIndex((l) => /^on:\s*$/.test(l));
  if (from < 0) return null;
  const to = lines.findIndex((l, i) => i > from && /^\S/.test(l));
  return lines.slice(from + 1, to < 0 ? undefined : to).filter((l) => l.trim() && !l.trim().startsWith('#'));
}

export function problems(text) {
  const t = triggers(text);
  if (!t) return ['no "on:" block'];
  const out = [];
  const body = (key) => { const i = t.findIndex((l) => new RegExp(`^  ${key}:`).test(l)); if (i < 0) return null; const rest = t.slice(i + 1); const end = rest.findIndex((l) => /^  \S/.test(l)); return rest.slice(0, end < 0 ? undefined : end); };
  for (const key of ['push', 'pull_request']) {
    const b = body(key);
    if (b === null) { out.push(`does not run on ${key}`); continue; }
    for (const f of ['paths', 'paths-ignore', 'branches', 'branches-ignore', 'tags', 'tags-ignore']) if (b.some((l) => new RegExp(`^\\s+${f}:`).test(l))) out.push(`${key} is filtered by ${f}, so a required check may never report on a commit`);
  }
  return out;
}

export function run() {
  const fails = problems(readFileSync(join(ROOT, '.github', 'workflows', 'self-test.yml'), 'utf8')).map((p) => `self-test.yml ${p}`);
  // The controls: a filter of each kind, and a missing trigger, must be caught.
  const ok = 'on:\n  push:\n  pull_request:\n\njobs:\n';
  if (problems(ok).length) fails.push('ci-test: an unfiltered workflow is reported');
  if (!problems("on:\n  push:\n    paths-ignore: ['**/*.md']\n  pull_request:\n\njobs:\n").some((p) => /paths-ignore/.test(p))) fails.push('ci-test: paths-ignore on push is not caught');
  if (!problems('on:\n  push:\n    branches: [main]\n  pull_request:\n\njobs:\n').some((p) => /branches/.test(p))) fails.push('ci-test: a branch filter (which drops v* tags) is not caught');
  if (!problems('on:\n  push:\n\njobs:\n').some((p) => /pull_request/.test(p))) fails.push('ci-test: a workflow without pull_request is not caught');
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fails = run();
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'The self-test runs on every push and every pull request, with no filter.');
  process.exit(fails.length ? 1 : 0);
}
