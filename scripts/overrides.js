#!/usr/bin/env node
// A project's overrides: itten.overrides.json is the record, validated by
// schema/overrides.schema.json; docs/itten-overrides.md is rendered from it
// for people to read. Run from the project's root.
//
// Usage:
//   node itten/scripts/overrides.js render     write docs/itten-overrides.md from itten.overrides.json
//   node itten/scripts/overrides.js validate   validate itten.overrides.json
//   node itten/scripts/overrides.js check      validate, and fail if docs/itten-overrides.md is out of date
// Options: --in <json> (default itten.overrides.json), --out <md> (default docs/itten-overrides.md)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './lib/schema.js';
import { rules } from './lib/rules.js';
import { readArgs, bad as badUsage } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'schema', 'overrides.schema.json'), 'utf8'));

// Schema errors, then what a schema cannot say: the rule exists in ITTEN, and
// the date is a real day that has happened.
export function validateOverrides(data) {
  const errors = validate(SCHEMA, data);
  if (errors.length) return errors;
  const known = rules();
  data.overrides.forEach((o, i) => {
    if (!known.has(o.rule)) errors.push(`overrides[${i}].rule: ${o.rule} is not a rule in protocol/ or reference/`);
    const d = new Date(o.date + 'T00:00:00Z');
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== o.date) errors.push(`overrides[${i}].date: ${o.date} is not a calendar date`);
    else if (d.getTime() > Date.now() + 86400000) errors.push(`overrides[${i}].date: ${o.date} is in the future`);
  });
  return errors;
}

export function readOverrides(path) {
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { return { data: null, errors: [`${path} does not parse: ${e.message}`] }; }
  return { data, errors: validateOverrides(data) };
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

export function render(data, source = 'itten.overrides.json') {
  const known = rules();
  const rows = data.overrides.map((o) => [
    o.date,
    o.selector ? '`' + o.selector.replace(/`/g, "'") + '`' : o.scope,
    `${o.rule}${known.has(o.rule) ? ' · ' + known.get(o.rule).title : ''}`,
    o.check ? '`' + o.check + '`' : '',
    o.value ?? '', o.instead ?? '', o.reason,
    o.floors === undefined ? '' : o.floors ? 'Yes' : 'No',
    o.itten,
  ].map(cell));
  return [
    '# ITTEN overrides',
    '',
    `Every departure from this project's system or from an ITTEN rule, with its reason. Rendered from \`${source}\` by \`node itten/scripts/overrides.js render\`; edit that file, not this one.`,
    '',
    ...(rows.length ? [
      '| Date | Where | Rule | Check | System value | Used instead | Reason | Floors still met | ITTEN |',
      '|---|---|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.join(' | ')} |`),
    ] : ['No overrides.']),
    '',
  ].join('\n');
}

// For the action and for scripts/check.js: is the record valid, and is the
// rendered page up to date?
export function checkFiles(json, md) {
  const { data, errors } = readOverrides(json);
  if (errors.length) return { ok: false, errors, count: data?.overrides?.length ?? 0 };
  const want = render(data, basename(json));
  if (!existsSync(md)) return { ok: false, errors: [`${md} is missing; run node itten/scripts/overrides.js render`], count: data.overrides.length };
  if (readFileSync(md, 'utf8') !== want) return { ok: false, errors: [`${md} is out of date with ${json}; run node itten/scripts/overrides.js render`], count: data.overrides.length };
  return { ok: true, errors: [], count: data.overrides.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const SPEC = { name: 'overrides.js', usage: 'node itten/scripts/overrides.js render|validate|check [--in itten.overrides.json] [--out docs/itten-overrides.md]', flags: { in: 'value', out: 'value' }, positional: [1, 1] };
  const cmd = readArgs(args, SPEC)._[0];
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
  const json = opt('--in', 'itten.overrides.json'), md = opt('--out', 'docs/itten-overrides.md');
  if (!['render', 'validate', 'check'].includes(cmd)) badUsage(SPEC, `"${cmd}" is not render, validate or check`);
  if (!existsSync(json)) { console.error(`${json} not found.`); process.exit(1); }
  if (cmd === 'check') {
    const r = checkFiles(json, md);
    for (const e of r.errors) console.error(e);
    if (r.ok) console.log(`${json}: ${r.count} override(s), valid; ${md} is up to date.`);
    process.exit(r.ok ? 0 : 1);
  }
  const { data, errors } = readOverrides(json);
  if (errors.length) { console.error(`${json} is not valid:\n  ` + errors.join('\n  ')); process.exit(1); }
  if (cmd === 'validate') { console.log(`${json}: ${data.overrides.length} override(s), valid.`); process.exit(0); }
  mkdirSync(dirname(resolve(md)), { recursive: true });
  writeFileSync(md, render(data, basename(json)));
  console.log(`Wrote ${md} from ${json} (${data.overrides.length} override(s)).`);
}
