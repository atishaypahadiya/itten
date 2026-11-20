#!/usr/bin/env node
// What one ITTEN version finds that another does not, on the same build of the same pages: for each mode and
// page, the findings version B reports that version A does not (new), the ones A reported that B does not
// (gone), and the ones whose severity changed. Findings are matched as a baseline is: by fingerprint, then by
// the same check on the same elements, so a fingerprint that holds measured values still matches.
//
// Input: <dir>/<label>/<mode>/<page>/report.json, with meta.json beside it, as the compare-versions workflow
// writes them. meta.json gives the version, the worker count, the site build (a checksum of the files served)
// and, for a run on a loaded machine, "timing": "unreliable". Timing findings (motion and frame timing) from
// such a run are listed apart and not reported; layout findings stand.
//
// Usage: node scripts/compare-versions.mjs <dir> --a <label> --b <label> [--out new.md] [--crops <dir>]
//   --crops copies the crops of every finding listed into <dir>/<label>/<mode>/<page>/ and links them from
//   new.md. Exit 0 when written, 1 when the two versions measured different site builds, 64 on bad usage.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBaseline, compare, pageKey } from '../inspector/baseline.js';
import { findingsOf } from '../inspector/finding.js';

export const TIMING = new Set(['motion-timing', 'motion-layout', 'reduced-motion', 'flash', 'frame-timing']);

const dirs = (d) => (existsSync(d) ? readdirSync(d).filter((x) => statSync(join(d, x)).isDirectory()).sort() : []);
const json = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
const nums = (w) => String(w ?? '').split(/,\s*/).filter((x) => /^\d+$/.test(x)).map(Number);
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const first = (s) => cell(s).match(/^.*?\.(?=\s|$)/)?.[0] ?? cell(s);
const count = (r) => `${r.summary.error} errors, ${r.summary.warning} warnings, ${r.summary.info} info`;
const seenOf = (f) => Object.entries(f.seen ?? {}).map(([k, v]) => `${k} ${v}`).join('; ');
const unreliable = (m) => m?.timing === 'unreliable';

// The comparison as Markdown, and the crops it links: [from, to] pairs, `to` relative to the output directory.
export function compareVersions(dir, { a, b }) {
  const out = [`# ITTEN ${a} against ${b}`, ''];
  const copies = [];
  let sameBuild = true;
  const modes = [...new Set([...dirs(join(dir, a)), ...dirs(join(dir, b))])];
  const metas = modes.flatMap((m) => [a, b].flatMap((v) => dirs(join(dir, v, m)).map((p) => json(join(dir, v, m, p, 'meta.json'))))).filter(Boolean);
  const builds = [...new Set(metas.map((m) => m.build).filter(Boolean))];
  out.push(`New: reported by ${b}, not by ${a}. Gone: reported by ${a}, not by ${b}. Findings are matched by fingerprint, then by the same check on the same elements. Timing findings (${[...TIMING].join(', ')}) from a run marked unreliable are listed apart and not reported.`, '');
  if (builds.length) out.push(`Site build${builds.length > 1 ? 's' : ''}: ${builds.map((x) => `\`${x}\``).join(', ')}${builds.length > 1 ? ' (more than one: see each page)' : ', the same for every run'}.`, '');
  const link = (v, mode, page, f) => (f.crops ?? []).map((c) => {
    const rel = c.path ?? c;
    const to = join('crops', v, mode, page, rel.replace(/^crops\//, ''));
    copies.push([join(dir, v, mode, page, rel), to]);
    return `[${rel.replace(/^crops\//, '')}](${to})`;
  }).join(' ');

  for (const mode of modes) {
    for (const page of [...new Set([...dirs(join(dir, a, mode)), ...dirs(join(dir, b, mode))])]) {
      const pa = join(dir, a, mode, page), pb = join(dir, b, mode, page);
      const ra = json(join(pa, 'report.json')), rb = json(join(pb, 'report.json'));
      const ma = json(join(pa, 'meta.json')) ?? {}, mb = json(join(pb, 'meta.json')) ?? {};
      const title = rb?.subject ?? rb?.url ?? ra?.subject ?? ra?.url ?? page;
      out.push(`## ${mode}, \`${page}\``, '');
      if (!ra || !rb) { out.push(`Not compared: no report from ${!ra ? a : b}.`, ''); continue; }
      if (ma.build && mb.build && ma.build !== mb.build) {
        sameBuild = false;
        out.push(`Not compared: ${a} measured site build \`${ma.build}\` and ${b} \`${mb.build}\`.`, '');
        continue;
      }
      const c = compare(rb, readBaseline(join(pa, 'report.json')), a, pageKey(title));
      const byId = new Map(findingsOf(rb).map((f) => [f.id, f]));
      const aBy = new Map(findingsOf(ra).map((f) => [f.fingerprint, f]));
      const added = new Set(nums(rb.sweep?.widths).filter((w) => !nums(ra.sweep?.widths).includes(w)));
      const held = [];
      if (unreliable(mb)) c.new = c.new.filter((id) => (TIMING.has(byId.get(id)?.check) ? (held.push(`${b} ${id} ${byId.get(id).check}`), false) : true));
      if (unreliable(ma) || unreliable(mb)) c.fixed = c.fixed.filter((f) => (TIMING.has(f.check) ? (held.push(`gone ${f.check} ${cell(f.elements?.[0] ?? '')}`), false) : true));
      const who = (m, r) => `${r.version ?? m.version ?? '?'}${m.workers ? ` on ${m.workers} worker${m.workers === 1 ? '' : 's'}` : ''}${unreliable(m) ? ', timing unreliable' : ''}`;
      out.push(`${a} (${who(ma, ra)}): ${count(ra)} at ${ra.sweep?.widths} px. ${b} (${who(mb, rb)}): ${count(rb)} at ${rb.sweep?.widths} px${added.size ? `; widths ${b} added: ${[...added].join(', ')} px` : ''}.`, '',
        `New ${c.new.length}, gone ${c.fixed.length}, more severe ${c.worse.length}, less severe ${c.better.length}.`, '');
      if (held.length) out.push(`Unreliable, not reported: ${held.join('; ')}.`, '');
      if (c.new.length) {
        out.push('| New | Severity | Check | Element | Seen | Only at added widths | Message | Crops |', '|---|---|---|---|---|---|---|---|');
        for (const id of c.new) {
          const f = byId.get(id);
          const seen = Object.values(f.seen ?? {}).flatMap((v) => (/–/.test(String(v)) ? [NaN] : nums(v)));
          const only = added.size && seen.length && seen.every((w) => added.has(w)) ? 'yes' : 'no';
          out.push(`| ${id} | ${f.severity} | ${f.check} | \`${cell(f.elements?.[0]?.sel ?? '')}\` | ${cell(seenOf(f))} | ${only} | ${first(f.message)} | ${link(b, mode, page, f)} |`);
        }
        out.push('');
      }
      if (c.fixed.length) {
        out.push(`| Gone | Severity | Check | Element | Message | Crops (${a}) |`, '|---|---|---|---|---|---|');
        for (const f of c.fixed) out.push(`| ${aBy.get(f.was ?? f.fingerprint)?.id ?? ''} | ${f.severity} | ${f.check} | \`${cell(f.elements?.[0] ?? '')}\` | ${first(f.message)} | ${link(a, mode, page, aBy.get(f.was ?? f.fingerprint) ?? {})} |`);
        out.push('');
      }
      for (const [k, xs] of [['More severe', c.worse], ['Less severe', c.better]]) if (xs.length) out.push(`${k} in ${b}: ${xs.map((x) => `${x.id} ${byId.get(x.id).check} (${x.was} to ${byId.get(x.id).severity})`).join('; ')}.`, '');
    }
  }
  return { markdown: out.join('\n'), copies, sameBuild };
}

function main(argv) {
  const usage = 'Usage: node scripts/compare-versions.mjs <dir> --a <label> --b <label> [--out new.md] [--crops <dir>]';
  const o = { dir: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (['--a', '--b', '--out', '--crops'].includes(k) && argv[i + 1] && !argv[i + 1].startsWith('--')) o[k.slice(2)] = argv[++i];
    else if (!k.startsWith('-') && !o.dir) o.dir = k;
    else { process.stderr.write(`Unknown or incomplete argument: ${k}\n${usage}\n`); return 64; }
  }
  if (!o.dir || !o.a || !o.b) { process.stderr.write(`${usage}\n`); return 64; }
  const r = compareVersions(resolve(o.dir), o);
  const base = o.crops ? resolve(o.crops) : null;
  if (base) for (const [from, to] of r.copies) if (existsSync(from)) { mkdirSync(dirname(join(base, to)), { recursive: true }); copyFileSync(from, join(base, to)); }
  if (o.out) { mkdirSync(dirname(resolve(o.out)), { recursive: true }); writeFileSync(o.out, r.markdown + '\n'); } else process.stdout.write(r.markdown + '\n');
  return r.sameBuild ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
