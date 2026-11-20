// The monthly telemetry workflow (.github/workflows/telemetry.yml), as far as
// it can be tested inside this repository: nothing here reaches GitHub.
// - When it runs: one schedule, once a month (a day of the month from 1 to
//   28, any month, any weekday), and by hand. Controls: a daily and a weekly
//   cron are caught.
// - What it may do: read the repository, and write issues; nothing else.
// - Its first step's command, with a local folder in place of GitHub
//   (--from), writes the report and the JSON the second step reads.
// - Its second step's shell, run as written with a stand-in `gh` first on
//   the PATH that records its arguments: a rule flagged and no open issue
//   opens one; an open issue is edited, flagged or not; nothing flagged and
//   no issue does neither. The job summary gets the report each time.
// Not tested, and not testable from here: that GitHub starts the schedule,
// and the issue as GitHub stores it (docs/CONTRACT.md, "Continuous
// integration").
// Usage: node scripts/telemetry-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { triggers } from './ci-test.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Why a cron expression does not run exactly once a month; null when it does.
export function notMonthly(cron) {
  const f = String(cron).trim().split(/\s+/);
  if (f.length !== 5) return `"${cron}" does not have five fields`;
  const [min, hour, dom, month, dow] = f;
  if (!/^\d+$/.test(min) || !/^\d+$/.test(hour)) return `"${cron}" does not name one minute of one hour`;
  if (!/^\d+$/.test(dom) || Number(dom) < 1 || Number(dom) > 28) return `"${cron}" does not name one day of the month from 1 to 28`;
  if (month !== '*' || dow !== '*') return `"${cron}" is limited to some months or weekdays`;
  return null;
}

// The `run: |` block of the step with this name, without its indent.
export function stepScript(text, name) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  if (at < 0) return null;
  const run = lines.findIndex((l, i) => i > at && /^\s+run: \|\s*$/.test(l));
  const next = lines.findIndex((l, i) => i > at && /^\s+- /.test(l));
  if (run < 0 || (next >= 0 && run > next)) return null;
  const indent = lines[run].match(/^\s*/)[0].length + 2;
  const body = [];
  for (let i = run + 1; i < lines.length && (lines[i].trim() === '' || lines[i].match(/^\s*/)[0].length >= indent); i++) body.push(lines[i].slice(indent));
  return body.join('\n');
}

export function run() {
  const fails = [];
  const text = readFileSync(join(ROOT, '.github', 'workflows', 'telemetry.yml'), 'utf8');

  // When it runs.
  const on = triggers(text) ?? [];
  const crons = on.map((l) => l.match(/cron:\s*'([^']+)'/)?.[1]).filter(Boolean);
  if (crons.length !== 1) fails.push(`telemetry.yml has ${crons.length} schedules, not 1`);
  for (const c of crons) { const why = notMonthly(c); if (why) fails.push(`telemetry.yml: ${why}`); }
  if (!on.some((l) => /^  workflow_dispatch:/.test(l))) fails.push('telemetry.yml cannot be started by hand (workflow_dispatch)');
  if (on.some((l) => /^  (push|pull_request|pull_request_target):/.test(l))) fails.push('telemetry.yml runs on a push or a pull request; it writes issues, and belongs on the schedule only');
  if (notMonthly('17 6 1 * *') || !notMonthly('17 6 * * *') || !notMonthly('17 6 * * 1') || !notMonthly('17 6 31 * *') || !notMonthly('*/5 6 1 * *')) fails.push('notMonthly: a monthly cron is refused, or a daily, weekly, day-31 or every-five-minutes one is accepted');

  // What it may do.
  const perms = [...text.matchAll(/^\s+(contents|issues|pull-requests|actions|packages|id-token|deployments|statuses|checks|security-events|pages|discussions):\s*(\S+)/gm)].map((m) => `${m[1]}: ${m[2]}`);
  const allowed = new Set(['contents: read', 'issues: write']);
  for (const p of perms) if (!allowed.has(p)) fails.push(`telemetry.yml asks for ${p}; it needs contents: read and issues: write only`);
  if (!perms.includes('issues: write')) fails.push('telemetry.yml cannot write the issue (issues: write)');
  if (!/persist-credentials: false/.test(text)) fails.push('telemetry.yml keeps the checkout token');

  const tmp = mkdtempSync(join(tmpdir(), 'itten-telemetry-'));
  try {
    // The first step's command, on the local test repositories.
    const count = stepScript(text, 'Count overrides by rule') ?? (text.match(/run: (node scripts\/telemetry\.js[^\n]+)/)?.[1] ?? null);
    const countOk = !(!count || !/^node scripts\/telemetry\.js --owner "\$OWNER" --threshold 3 --out "\$RUNNER_TEMP\/telemetry\.md" --json "\$RUNNER_TEMP\/telemetry\.json"\s*$/.test(count));
    if (!countOk) fails.push(`telemetry.yml's first step is not the command this test runs: ${count}`);
    // The stand-in gh, first on the PATH for both steps: it appends its arguments to $GH_LOG, and `issue list`
    // prints $STUB_NUMBER, as --jq would. The first step must not call gh at all (--from reads a folder).
    const bin = join(tmp, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'gh'), '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> "$GH_LOG"\nif [ "$1 $2" = "issue list" ]; then [ -n "${STUB_NUMBER:-}" ] && echo "$STUB_NUMBER"; fi\nexit 0\n');
    chmodSync(join(bin, 'gh'), 0o755);
    const stubbed = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GH_TOKEN: 'none', GITHUB_TOKEN: 'none', RUNNER_TEMP: tmp };
    // Run only the command this test knows: an edited step is reported above and not run.
    if (countOk) {
      const firstLog = join(tmp, 'first.log');
      writeFileSync(firstLog, '');
      const first = spawnSync('bash', ['-euo', 'pipefail', '-c', `${count.trim()} --from fixtures/telemetry`], { cwd: ROOT, encoding: 'utf8', env: { ...stubbed, OWNER: 'test', GH_LOG: firstLog } });
      if (first.status !== 0) fails.push(`the first step's command exits ${first.status}: ${(first.stderr || first.stdout).trim().split('\n').at(-1)}`);
      if (readFileSync(firstLog, 'utf8').trim()) fails.push(`the first step called gh though it was given a folder: ${readFileSync(firstLog, 'utf8').trim().split('\n')[0]}`);
      const made = existsSync(join(tmp, 'telemetry.json')) ? JSON.parse(readFileSync(join(tmp, 'telemetry.json'), 'utf8')) : null;
      if (!made || !Array.isArray(made.flagged) || !made.flagged.length) fails.push('the first step wrote no telemetry.json with a flagged rule from the test repositories');
      if (!existsSync(join(tmp, 'telemetry.md'))) fails.push('the first step wrote no telemetry.md');
    }

    // The second step, as written, with a stand-in gh.
    const script = stepScript(text, 'Open or update the issue');
    if (!script) fails.push('telemetry.yml has no step "Open or update the issue" with a script');
    const TITLE = 'Override telemetry: rules set aside in three or more projects';
    const second = (name, flagged, number) => {
      const log = join(tmp, `${name}.log`), summary = join(tmp, `${name}.summary`);
      writeFileSync(log, ''); writeFileSync(summary, '');
      writeFileSync(join(tmp, 'telemetry.json'), JSON.stringify({ flagged }));
      writeFileSync(join(tmp, 'telemetry.md'), '# The report\n');
      const r = spawnSync('bash', ['-euo', 'pipefail', '-c', script ?? 'exit 9'], { cwd: ROOT, encoding: 'utf8', env: { ...stubbed, GH_LOG: log, STUB_NUMBER: number, GITHUB_STEP_SUMMARY: summary, REPO: 'test/itten', TITLE } });
      const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
      if (r.status !== 0) fails.push(`${name}: the step exits ${r.status}: ${(r.stderr || '').trim().split('\n').at(-1)}`);
      if (!/# The report/.test(readFileSync(summary, 'utf8'))) fails.push(`${name}: the job summary does not hold the report`);
      if (calls.some((c) => !/--repo test\/itten/.test(c))) fails.push(`${name}: a gh call does not name the repository: ${calls.find((c) => !/--repo test\/itten/.test(c))}`);
      return { created: calls.filter((c) => /^issue create/.test(c)), edited: calls.filter((c) => /^issue edit/.test(c)), summary: readFileSync(summary, 'utf8') };
    };
    if (script) {
      const a = second('flagged, no issue', [{ rule: 'LAY-03' }], '');
      if (a.created.length !== 1 || a.edited.length || !a.created[0].includes(`--title ${TITLE}`) || !/--body-file/.test(a.created[0])) fails.push(`a flagged rule and no open issue: ${a.created.length} created, ${a.edited.length} edited (${a.created[0] ?? ''})`);
      const b = second('flagged, an issue', [{ rule: 'LAY-03' }], '7');
      if (b.created.length || b.edited.length !== 1 || !/^issue edit 7 /.test(b.edited[0])) fails.push(`a flagged rule and issue #7 open: ${b.created.length} created, ${b.edited.length} edited (${b.edited[0] ?? ''})`);
      const c = second('nothing flagged, an issue', [], '7');
      if (c.created.length || c.edited.length !== 1) fails.push(`nothing flagged and issue #7 open: ${c.created.length} created, ${c.edited.length} edited; the open issue is brought up to date`);
      const d = second('nothing flagged, no issue', [], '');
      if (d.created.length || d.edited.length || !/no issue opened/.test(d.summary)) fails.push(`nothing flagged and no issue: ${d.created.length} created, ${d.edited.length} edited; none is opened, and the summary says so`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'telemetry-test.js', usage: 'node scripts/telemetry-test.js' });
  const fails = run();
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'The telemetry workflow runs once a month and by hand, may only write issues, and opens or updates one issue as its script says.');
  process.exit(fails.length ? 1 : 0);
}
