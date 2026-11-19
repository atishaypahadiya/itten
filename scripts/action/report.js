// The ITTEN action's report step: writes the job summary and, on a pull
// request, keeps one comment up to date. The comment carries a hidden marker
// with the action's name; an existing comment with that marker is edited, so
// re-runs and new pushes never add a second one.
//
// A pull request from a fork runs with a read-only token, so it gets the job
// summary only. So does any run where the comment cannot be written; the step
// never fails the job.
//
// Environment: ITTEN_OUT (report directory with summary.json), ITTEN_COMMENT
// ("false" to skip), ITTEN_ARTIFACT_URL, GITHUB_TOKEN and the variables
// GitHub sets: GITHUB_EVENT_NAME, GITHUB_EVENT_PATH, GITHUB_REPOSITORY,
// GITHUB_API_URL, GITHUB_SERVER_URL, GITHUB_RUN_ID, GITHUB_STEP_SUMMARY.

import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render, marker } from './markdown.js';
import { readArgs } from '../../inspector/usage.js';

const env = (k, d = '') => (process.env[k] ?? '').trim() || d;

export function pullRequest() {
  if (!['pull_request', 'pull_request_target'].includes(env('GITHUB_EVENT_NAME'))) return null;
  const event = JSON.parse(readFileSync(env('GITHUB_EVENT_PATH'), 'utf8'));
  const pr = event.pull_request;
  if (!pr) return null;
  const fork = pr.head?.repo?.full_name !== env('GITHUB_REPOSITORY');
  return { number: pr.number, fork };
}

async function api(method, path, body) {
  const res = await fetch(env('GITHUB_API_URL', 'https://api.github.com') + path, {
    method,
    headers: { Authorization: `Bearer ${env('GITHUB_TOKEN')}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'itten-action', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw Object.assign(new Error(`${method} ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`), { status: res.status });
  return res.status === 204 ? null : res.json();
}

// Finds this action's comment by its marker and edits it, or adds it.
export async function upsertComment(repo, number, name, body) {
  let found = null;
  for (let page = 1; page <= 30 && !found; page++) {
    const batch = await api('GET', `/repos/${repo}/issues/${number}/comments?per_page=100&page=${page}`);
    found = batch.find((c) => c.body?.includes(marker(name)));
    if (batch.length < 100) break;
  }
  if (found) { await api('PATCH', `/repos/${repo}/issues/comments/${found.id}`, { body }); return { action: 'updated', id: found.id }; }
  const c = await api('POST', `/repos/${repo}/issues/${number}/comments`, { body });
  return { action: 'created', id: c.id };
}

export async function main() {
  const out = resolve(env('ITTEN_OUT', 'itten-report'));
  const file = join(out, 'summary.json');
  const s = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { name: env('ITTEN_NAME', 'itten-report'), pages: [], problems: ['the inspection step did not write summary.json'] };
  // A shard measures and uploads; the merge job writes the report and the comment.
  if (s.shard) {
    const text = `### ITTEN inspection, shard ${s.shard.i}/${s.shard.n}\n\n${s.problems?.length ? s.problems.map((p) => `- ${p}`).join('\n') : `Measured ${s.pages.map((p) => `${p.jobs} jobs of \`${p.page}\``).join(', ')}. The merge job combines the shards into the report and the pull request comment.`}\n`;
    if (env('GITHUB_STEP_SUMMARY')) appendFileSync(env('GITHUB_STEP_SUMMARY'), text);
    else console.log(text);
    return { action: 'skipped', why: 'a shard' };
  }
  const runUrl = env('GITHUB_RUN_ID') ? `${env('GITHUB_SERVER_URL', 'https://github.com')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}` : '';
  const artifactUrl = env('ITTEN_ARTIFACT_URL');
  let note = '';
  let result = { action: 'skipped', why: 'not a pull request' };
  const pr = pullRequest();
  if (pr && env('ITTEN_COMMENT', 'true') !== 'false') {
    if (pr.fork) result = { action: 'skipped', why: 'the pull request comes from a fork, whose token cannot write comments' };
    else if (!env('GITHUB_TOKEN')) result = { action: 'skipped', why: 'no token was given' };
    else {
      try {
        result = await upsertComment(env('GITHUB_REPOSITORY'), pr.number, s.name, render(s, { artifactUrl, runUrl, forComment: true }));
      } catch (e) {
        result = { action: 'skipped', why: e.status === 403 || e.status === 404 ? 'the token cannot write comments here (it needs pull-requests: write)' : `the comment could not be written (${e.message})` };
        console.log(`::warning title=ITTEN::No pull request comment: ${result.why}.`);
      }
    }
    if (result.action === 'skipped') note = `No comment on the pull request: ${result.why}.`;
  }
  const summaryText = render(s, { artifactUrl, runUrl, note, limit: 1000000 });
  if (env('GITHUB_STEP_SUMMARY')) appendFileSync(env('GITHUB_STEP_SUMMARY'), summaryText + '\n');
  else console.log(summaryText);
  console.log(`Pull request comment: ${result.action}${result.why ? ` (${result.why})` : ''}.`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  readArgs(process.argv.slice(2), { name: 'action/report.js', usage: 'node scripts/action/report.js (inputs from the environment)' });
  await main();
}
