#!/usr/bin/env node
// itten fix: mechanical fixes, written to the project's source of truth and
// each checked again before it is kept (ROADMAP 0.4; docs/CONTRACT.md,
// "Fixes").
//
// 1. The page is inspected (quick mode; --fast for the fast tier).
// 2. Each finding of a class with one right answer is planned as an auto
//    fix: edits to the file the value comes from (inspector/locate.js says
//    which, and refuses build output). Every other finding is a guided fix:
//    where it is, and a note.
// 3. One auto fix at a time: the page is inspected with only the passes and
//    widths its finding was seen in, the edits are written, and it is
//    inspected the same way again. A fix that leaves its finding (the same
//    check on the elements it edited), or brings a finding that was not
//    there before, is reverted; the report says what the re-check found.
//
// Auto classes:
//   px-to-rem       spacing-unit, text-resize: a px value to rem
//   em-to-step      type-scale: a size set in em or % to the nearest step
//   to-step         spacing-scale, type-scale: a value off the scale to the
//                   step, when exactly one step is within the tolerance
//                   (spacing.tolerance and type.tolerance in the system
//                   file, 1 px by default)
//   nbsp-separator  line-start: a no-break space before a separator
//   text-wrap       text-wrap-balance, text-wrap-pretty
//   reduced-motion  reduced-motion, when the system makes movement instant
//                   or nothing animated
// Guided only: a value off the scale with no step, or more than one, within
// the tolerance; and durations and easings off the system.
//
// Usage:
//   node itten/inspector/fix.js <url> --root <dir> [--system itten.system.json] [--out itten-fix]
//        [--fast] [--no-engines] [--dry-run] [--apply fixes.json]
//   --root     the folder the server serves at the URL's root: files are edited here
//   --dry-run  plan and report, write nothing
//   --apply    check these fixes again instead of planning (a file of
//              { fixes: [{ finding: { check, fingerprint }, note, edits }] })
// Exit codes: 0 no fix reverted; 1 a fix was reverted; 2 the inspection was
// refused; 64 bad usage or a system file that is not valid; 70 the run
// failed inside the tool; 75 temporarily blocked (the server gave no answer).

import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect, loadSystem, VERSION, FAST_WIDTHS } from './inspect.js';
import { findingsOf } from './finding.js';
import { apply, revert, readIn, EditError } from './edits.js';
import { attach, declarationOf, valuePlace, rulesOf, placeOf, notSource, fileOf } from './locate.js';

export const AUTO = ['px-to-rem', 'em-to-step', 'to-step', 'nbsp-separator', 'text-wrap', 'reduced-motion'];
// How far from a step a value may be and still have one right answer, in
// px, where the system does not say (spacing.tolerance, type.tolerance).
export const TOLERANCE = 1;
// The steps within the tolerance of a value. An off-scale value is moved
// mechanically only when there is exactly one.
export const stepsWithin = (steps, v, tol = TOLERANCE) => [...new Set(steps)].sort((a, b) => a - b).filter((s) => Math.abs(s - v) <= tol + 1e-6);
const nearestSteps = (steps, v) => { const s = [...new Set(steps)].sort((a, b) => a - b); return [[...s].reverse().find((x) => x < v), s.find((x) => x > v)].filter((x) => x !== undefined); };
const SEPARATORS = '·•|/';
const num = (x) => String(Number(x.toFixed(4)));

// The widths a finding was seen at, from its itten.seen text ("320, 768",
// "320–1440" in 40 px steps, "1440→320" after a resize).
export function seenWidths(seen) {
  const out = new Set();
  for (const text of Object.values(seen ?? {})) {
    for (const part of String(text).split(/,\s*/)) {
      const r = part.match(/^(\d+)–(\d+)$/);
      if (r) for (let w = +r[1]; w <= +r[2]; w += 40) out.add(w);
      else for (const w of part.split('→')) if (/^\d+$/.test(w.trim())) out.add(+w.trim());
    }
  }
  return [...out].sort((a, b) => a - b);
}

// The passes to run to see a finding again: the ones its modes come from.
export function scopeOf(f) {
  const modes = Object.keys(f.seen ?? {});
  const passes = new Set(['light']);
  const engines = new Set();
  for (const m of modes) {
    if (m === '200% text') passes.add('200');
    else if (m === 'dark') passes.add('contrast');
    else if (m === 'resize') { passes.add('scan'); passes.add('resize'); }
    else if (m === '2x') passes.add('2x');
    else if (m === 'motion' || m === 'reduced motion') passes.add('motion');
    else { const e = m.match(/^(webkit|firefox)|^(WebKit|Firefox) resize$/); if (e) { passes.add('engines'); engines.add((e[1] || e[2]).toLowerCase()); if (e[2]) passes.add('scan'); } }
  }
  // At least three widths: below that a value's fluidity is unknown, and a
  // finding that needs a fixed value is not reported, so a re-check there
  // would see every such finding as cleared.
  let widths = seenWidths(f.seen);
  if (widths.length < 3) widths = [...new Set([...widths, ...FAST_WIDTHS])].sort((a, b) => a - b);
  return { passes: [...passes], widths, keyWidths: passes.has('contrast') ? widths : [widths.at(-1)], engines: [...engines] };
}

const elementsOf = (f) => (f.elements ?? []).map((e) => e.sel).filter(Boolean);

// A plan for one finding: { class, kind: 'auto' | 'guided', edits, note,
// locations, targets (the elements the edits change) }.
export async function planFix(f, ctx) {
  const { src, root, url, system, rootPx } = ctx;
  const guided = (cls, note, locations = []) => ({ class: cls, kind: 'guided', edits: [], note, locations });
  const sels = elementsOf(f);
  const at = async (from, sel, prop) => {
    const d = await declarationOf(from, sel, prop);
    if (d.why) return { why: d.why };
    const v = await valuePlace(from, root, url, d);
    return v.why ? { why: v.why, file: v.file } : { ...v, d };
  };
  // Where an element's value of a property is written. With ok, the place
  // whose value passes it: a finding seen at several widths can hold
  // elements that take the value at different ones (a rule in a media
  // query), so the page is read at each width the finding was seen at
  // (ctx.next opens the next) until one passes. Failing all, the first.
  const srcs = [src];
  const located = async (sel, prop, ok = null) => {
    let first;
    for (let i = 0; ; i++) {
      if (i >= srcs.length) { const more = ok ? await ctx.next?.() : null; if (!more) break; srcs.push(more); }
      const r = await at(srcs[i], sel, prop);
      first ??= r;
      if (!ok || (!r.why && ok(r))) return r;
    }
    return first;
  };
  const pxOf = (text) => { const m = text.match(/^(-?\d*\.?\d+)(px|rem)$/i); return m ? Math.abs(Number(m[1])) * (m[2].toLowerCase() === 'rem' ? rootPx : 1) : null; };
  const where = async (prop) => {
    const out = [];
    for (const sel of sels.slice(0, 8)) { const v = await located(sel, prop); out.push(v.why ? { selector: sel, note: v.why } : { selector: sel, file: v.file, line: v.line, column: v.column }); }
    return out;
  };

  if (f.check === 'spacing-unit' || f.check === 'text-resize') {
    const props = f.check === 'text-resize' ? ['font-size'] : f.scale?.properties ?? [];
    const want = f.check === 'spacing-unit' ? f.scale?.value ?? null : null;
    const edits = new Map(), why = [];
    const isPx = (t) => { const m = t.match(/^(-?\d*\.?\d+)px$/i); return m && (want === null || Math.abs(Number(m[1]) - want) <= 0.01) ? m : null; };
    // The finding names the properties of all its elements together: on one
    // element a side can hold another value, and is left, as long as a side
    // of that element is converted.
    for (const sel of sels) {
      const not = [];
      let done = 0;
      for (const prop of props) {
        const v = await located(sel, prop, (x) => !!isPx(x.text));
        if (v.why) { not.push(`${sel} ${prop}: ${v.why}`); continue; }
        const m = isPx(v.text);
        if (!m) { not.push(`${sel} ${prop}: the value is ${v.text}, not a px value a fix can convert`); continue; }
        done++;
        const key = `${v.file}:${v.offset}`;
        if (!edits.has(key)) edits.set(key, { edit: { file: v.file, line: v.line, column: v.column, length: v.length, replace: `${num(Number(m[1]) / rootPx)}rem` }, sel });
      }
      if (!done) why.push(...not);
    }
    if (why.length) return guided('px-to-rem', `Not every value can be converted: ${why.join('; ')}.`, await where(props[0] || 'font-size'));
    if (!edits.size) return guided('px-to-rem', 'No px value was found to convert.');
    return { class: 'px-to-rem', kind: 'auto', edits: [...edits.values()].map((x) => x.edit), targets: sels, note: `px to rem at ${rootPx} px to the rem, so the value follows the reader's text size.` };
  }

  if (f.check === 'type-scale' && f.scale?.kind === 'fixed' && system?.type?.scale) {
    const v = f.scale.value;
    const steps = [...new Set(system.type.scale.filter((s) => s.size).map((s) => s.size))].sort((a, b) => a - b);
    const dist = steps.map((s) => Math.abs(s - v));
    const best = Math.min(...dist);
    const nearest = steps.filter((s, i) => dist[i] === best);
    const edits = new Map(), why = [];
    let unit = null;
    // Set in px or rem: one step off the scale. Moved only when exactly one
    // step is within the tolerance; the unit it is written in is kept.
    const tol = system.type.tolerance ?? TOLERANCE;
    const within = stepsWithin(steps, v, tol);
    const stepEdits = new Map();
    let allFixed = sels.length > 0;
    for (const sel of sels) {
      const p = await located(sel, 'font-size', (x) => { const px = pxOf(x.text); return px !== null && Math.abs(px - v) <= 0.01; });
      const m = p.why ? null : p.text.match(/^(-?\d*\.?\d+)(px|rem)$/i);
      if (!m || Math.abs(Number(m[1]) * (m[2].toLowerCase() === 'rem' ? rootPx : 1) - v) > 0.01) { allFixed = false; break; }
      stepEdits.set(`${p.file}:${p.offset}`, { file: p.file, line: p.line, column: p.column, length: p.length, replace: m[2].toLowerCase() === 'rem' ? `${num(within[0] / rootPx)}rem` : `${num(within[0])}px` });
    }
    if (allFixed && within.length === 1) return { class: 'to-step', kind: 'auto', edits: [...stepEdits.values()], targets: sels, note: `${v} px is off the type scale and ${within[0]} px is the only step within ${tol} px: moved to it.` };
    for (const sel of sels) {
      const p = await located(sel, 'font-size');
      if (p.why) { why.push(`${sel}: ${p.why}`); continue; }
      const m = p.text.match(/^(-?\d*\.?\d+)(em|%)$/i);
      if (!m) { unit = unit ?? p.text; why.push(`${sel}: set as ${p.text}`); continue; }
      edits.set(`${p.file}:${p.offset}`, { file: p.file, line: p.line, column: p.column, length: p.length, replace: `${num(nearest[0] / rootPx)}rem` });
    }
    const locations = await where('font-size');
    if (why.length && !edits.size && unit) return guided('off-scale', `${v} px is off the type scale and is set in fixed units (${unit}). ${within.length === 1 ? `${within[0]} px is the only step within ${tol} px, but not every element's size could be found where it is written` : within.length ? `${within.join(' and ')} px are both within ${tol} px` : `No step is within ${tol} px (nearest ${nearestSteps(steps, v).join(' or ')} px)`}: which step it should be is a choice.`, locations);
    if (why.length) return guided('em-to-step', `Not every size can be moved to a step: ${why.join('; ')}.`, locations);
    if (nearest.length !== 1) return guided('em-to-step', `${v} px is as near ${nearest.join(' px as ')} px: which step is a choice.`, locations);
    return { class: 'em-to-step', kind: 'auto', edits: [...edits.values()], targets: sels, note: `A size compounded from em or %, ${v} px, to the nearest step, ${nearest[0]} px, in rem.` };
  }

  if (f.check === 'spacing-scale' && f.scale?.kind === 'fixed') {
    const props = f.scale.properties?.length ? f.scale.properties : ['padding-top'];
    const v = f.scale.value, steps = system?.spacing?.scale ?? [];
    const tol = system?.spacing?.tolerance ?? TOLERANCE;
    const within = stepsWithin(steps, v, tol);
    const choice = within.length > 1 ? `${within.join(' and ')} px are both within ${tol} px` : `no step is within ${tol} px (nearest ${nearestSteps(steps, v).join(' or ')} px)`;
    if (within.length !== 1) return guided('off-scale', `${f.message} Which step it should be is a choice: ${choice}.`, await where(props[0]));
    // Exactly one step within the tolerance: each place the value is written
    // in px or rem is moved to it, in the unit it is written in.
    const edits = new Map(), why = [];
    for (const sel of sels) for (const prop of props) {
      const p = await located(sel, prop, (x) => { const px = pxOf(x.text); return px !== null && Math.abs(px - v) <= 0.01; });
      if (p.why) { if (!/takes .* from no rule|comes from/.test(p.why)) why.push(`${sel} ${prop}: ${p.why}`); continue; }
      const m = p.text.match(/^(-?\d*\.?\d+)(px|rem)$/i);
      if (!m) { why.push(`${sel} ${prop}: set as ${p.text}`); continue; }
      const px = Math.abs(Number(m[1])) * (m[2].toLowerCase() === 'rem' ? rootPx : 1);
      if (Math.abs(px - v) > 0.01) continue;   // this side holds another value
      edits.set(`${p.file}:${p.offset}`, { file: p.file, line: p.line, column: p.column, length: p.length, replace: `${Number(m[1]) < 0 ? '-' : ''}${m[2].toLowerCase() === 'rem' ? `${num(within[0] / rootPx)}rem` : `${num(within[0])}px`}` });
    }
    if (why.length || !edits.size) return guided('off-scale', `${f.message} ${within[0]} px is the only step within ${tol} px, but not every place it is written can be moved: ${why.join('; ') || 'no px or rem value was found'}.`, await where(props[0]));
    return { class: 'to-step', kind: 'auto', edits: [...edits.values()], targets: sels, note: `${v} px is off the spacing scale and ${within[0]} px is the only step within ${tol} px: moved to it.` };
  }

  if (f.check === 'motion-timing') return guided('motion-timing', `${f.message} Which system duration or easing it should use is a choice.`, sels.map((s) => ({ selector: s })));

  if (f.check === 'line-start') {
    if (/Closing punctuation/.test(f.message)) return guided('nbsp-separator', 'A line begins with closing punctuation: remove the space before it, or make it a no-break space. Which is a choice of wording.', sels.map((s) => ({ selector: s })));
    return planSeparator(f, ctx, guided);
  }

  if (f.check === 'text-wrap-balance' || f.check === 'text-wrap-pretty') {
    const value = f.check === 'text-wrap-balance' ? 'balance' : 'pretty';
    const edits = [];
    for (const sel of sels) {
      const d = await declarationOf(src, sel, 'text-wrap');
      if (!d.why) {
        const v = await valuePlace(src, root, url, d);
        if (v.why) return guided('text-wrap', `${sel}: ${v.why}.`, [{ selector: sel }]);
        edits.push({ file: v.file, line: v.line, column: v.column, length: v.length, replace: value });
        continue;
      }
      const m = await rulesOf(src, sel);
      const rule = m?.rules.at(-1);
      if (!rule) return guided('text-wrap', `${sel} matches no rule of the project's own to add text-wrap: ${value} to.`, [{ selector: sel }]);
      const ins = await insertDeclaration(src, root, url, rule, `text-wrap: ${value}`);
      if (ins.why) return guided('text-wrap', `${sel}: ${ins.why}.`, [{ selector: sel }]);
      edits.push(ins.edit);
    }
    return { class: 'text-wrap', kind: 'auto', edits, targets: sels, note: `text-wrap: ${value}, where the check measured an improvement.` };
  }

  if (f.check === 'reduced-motion') {
    const rm = system?.motion?.reducedMotion ?? 'instant';
    const parts = f.fingerprint.split('|');
    const name = parts.at(-1), pseudo = parts.at(-2), sel = parts.slice(1, -2).join('|');
    if (rm === 'fade') return guided('reduced-motion', `${f.message} The system makes movement a fade under Reduce Motion, which is a design for each animation, not a mechanical change.`, [{ selector: sel }]);
    if (pseudo && pseudo !== 'null') return guided('reduced-motion', `${f.message} It runs on ${pseudo}, which this fix does not reach.`, [{ selector: sel }]);
    const m = await rulesOf(src, sel);
    if (!m) return guided('reduced-motion', `no element matches ${sel}`, [{ selector: sel }]);
    // The rule that starts it: an animation naming it, or a transition.
    let found = null;
    for (const rule of [...m.rules].reverse()) {
      for (const p of rule.style.cssProperties) {
        if (!p.range) continue;
        if ((p.name === 'animation' || p.name === 'animation-name') && new RegExp(`(^|[\\s,])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s,]|$)`).test(p.value)) found = found ?? { rule, prop: 'animation' };
        if (p.name === 'transition' || p.name === 'transition-property') found = found ?? { rule, prop: 'transition' };
      }
    }
    if (!found) return guided('reduced-motion', `${f.message} No rule of the project's own starts it.`, [{ selector: sel }]);
    const place = await placeOf(src, root, url, found.rule.header, found.rule.style.range);
    if (place.why) return guided('reduced-motion', `${sel}: ${place.why}.`, [{ selector: sel }]);
    const selector = found.rule.selectorList.text;
    const text = place.text;
    const lines = text.split('\n');
    const endLine = text.endsWith('\n') ? lines.length : lines.length;
    const endCol = (text.endsWith('\n') ? 0 : lines.at(-1).length) + 1;
    const lead = text.endsWith('\n') ? '\n' : '\n\n';
    return { class: 'reduced-motion', kind: 'auto', targets: [sel], note: `The ${found.prop} stops under prefers-reduced-motion: reduce, as the system's reducedMotion ("${rm}") says.`,
      edits: [{ file: place.file, line: endLine, column: endCol, length: 0, replace: `${lead}@media (prefers-reduced-motion: reduce) {\n  ${selector} { ${found.prop}: none; }\n}\n` }] };
  }

  return guided('other', f.message, sels.map((s) => ({ selector: s })));
}

// Inserts a declaration at the end of a rule, as the rule writes its own:
// on one line with a space, or on a line of its own with the same indent.
async function insertDeclaration(src, root, url, rule, decl) {
  const place = await placeOf(src, root, url, rule.header, rule.style.range);
  if (place.why) return { why: place.why };
  const body = place.text.slice(place.offset, place.end);
  const trimmed = body.replace(/\s+$/, '');
  const needSemi = trimmed && !trimmed.endsWith(';');
  const at = place.offset + trimmed.length;
  let text;
  if (body.includes('\n')) {
    const lastLine = trimmed.split('\n').at(-1);
    const indent = (lastLine.match(/^\s*/) || [''])[0] || '  ';
    text = `${needSemi ? ';' : ''}\n${indent}${decl};`;
  } else text = `${needSemi ? ';' : ''}${trimmed ? ' ' : ''}${decl};`;
  const { positionOf } = await import('./edits.js');
  return { edit: { file: place.file, ...positionOf(place.text, at), length: 0, replace: text } };
}

// A no-break space before each separator of the element, in the HTML file.
// The separators that follow ordinary white space, read in document order
// in the page's text and in the file's text (tags, comments, scripts and
// styles left out), must be the same in number, so the n-th in one is the
// n-th in the other; otherwise the place is not certain, and the fix is guided.
async function planSeparator(f, ctx, guided) {
  const { page, root, url } = ctx;
  const sel = elementsOf(f)[0];
  const file = fileOf(root, url, url);
  const served = await (await fetch(url)).text();
  const why = file ? notSource(root, file, served) : 'the page is on another server';
  if (why) return guided('nbsp-separator', `${f.message} ${why}.`, [{ selector: sel }]);
  const dom = await page.evaluate(([s, seps]) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('script, style, template, noscript') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let text = '', mine = [];
    for (let n = walk.nextNode(); n; n = walk.nextNode()) { const start = text.length; text += n.data; if (el.contains(n)) mine.push([start, text.length]); }
    const re = new RegExp(`[ \\t\\n\\r\\f]+[${seps.replace(/[\\]^-]/g, '\\$&')}](?=[ \\t\\n\\r\\f])`, 'g');
    const all = [...text.matchAll(re)].map((m) => m.index + m[0].length - 1);
    return all.map((at) => mine.some(([a, b]) => at >= a && at < b));
  }, [sel, SEPARATORS]);
  if (!dom) return guided('nbsp-separator', `no element matches ${sel}`, [{ selector: sel }]);
  // The file's text in document order, from <body> on, with each text run's offset.
  const html = readIn(root, file);
  const body = html.search(/<body[\s>]/i);
  const runs = [];
  let i = body < 0 ? 0 : html.indexOf('>', body) + 1;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) { i = html.indexOf('-->', i); i = i < 0 ? html.length : i + 3; continue; }
    const raw = html.slice(i).match(/^<(script|style|template|noscript)\b/i);
    if (raw) { const end = html.toLowerCase().indexOf(`</${raw[1].toLowerCase()}`, i); i = end < 0 ? html.length : html.indexOf('>', end) + 1; continue; }
    if (html[i] === '<') { const end = html.indexOf('>', i); i = end < 0 ? html.length : end + 1; continue; }
    const next = html.indexOf('<', i);
    const end = next < 0 ? html.length : next;
    runs.push([i, end]);
    i = end;
  }
  let joined = '', map = [];
  for (const [a, b] of runs) { for (let k = a; k < b; k++) map.push(k); joined += html.slice(a, b); }
  const re = new RegExp(`[ \\t\\n\\r\\f]+[${SEPARATORS.replace(/[\\]^-]/g, '\\$&')}](?=[ \\t\\n\\r\\f])`, 'g');
  const hits = [...joined.matchAll(re)];
  if (hits.length !== dom.length) return guided('nbsp-separator', `${f.message} The page has ${dom.length} separators after a space and ${file} has ${hits.length}, so which is which is not certain.`, [{ selector: sel, file }]);
  const { positionOf } = await import('./edits.js');
  const edits = [];
  hits.forEach((m, k) => {
    if (!dom[k]) return;
    const from = map[m.index], to = map[m.index + m[0].length - 2] + 1;
    if (to - from !== m[0].length - 1) return; // the space runs across a tag
    edits.push({ file, ...positionOf(html, from), length: to - from, replace: '&nbsp;' });
  });
  if (!edits.length) return guided('nbsp-separator', f.message, [{ selector: sel, file }]);
  return { class: 'nbsp-separator', kind: 'auto', edits, targets: [sel], note: 'A no-break space before each separator, so a line can end on it and never begin with it.' };
}

// Does a re-check still show the finding, on the elements the fix edited?
const stillThere = (after, f, targets) => after.some((a) => a.check === f.check && (a.fingerprint === f.fingerprint || (targets?.length && elementsOf(a).some((s) => targets.includes(s)))));

export async function fix(url, o = {}) {
  const root = resolve(o.root);
  const out = resolve(o.out ?? 'itten-fix');
  mkdirSync(out, { recursive: true });
  const say = o.quiet ? () => {} : (m) => process.stderr.write(m + '\n');
  const base = { system: o.system ?? null, systemPath: o.systemPath ?? null, quiet: true, ...(o.engines ? { engines: o.engines } : {}), timings: false };
  const started = new Date();
  say(`itten fix: inspecting ${url}`);
  const before = await inspect(url, { ...base, out: join(out, 'before'), ...(o.fast ? { fast: true } : {}) });
  const result = { tool: 'itten-fix', version: VERSION, url, root, started: started.toISOString(), status: 'complete', fixes: [], summary: { kept: 0, reverted: 0, guided: 0, planned: 0 } };
  const write = () => writeFileSync(join(out, 'fixes.json'), JSON.stringify(result, null, 2) + '\n');
  if (before.status === 'refused') { result.status = 'refused'; result.reason = before.reason; if (before.blocked) result.blocked = true; write(); return result; }
  const findings = findingsOf(before);
  const rootPx = 16;

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chromium' }).catch(() => chromium.launch());
  let version = 0;
  const scoped = new Map();
  let runs = 0;
  const recheck = async (scope) => {
    const k = JSON.stringify(scope) + '#' + version;
    if (!scoped.has(k)) scoped.set(k, await inspect(url, { ...base, ...scope, engines: scope.engines, aroundBreakpoints: false, out: join(out, 'recheck', String(++runs)) }));
    return scoped.get(k);
  };
  // A fresh page and CDP session on the files as they are now.
  const openAt = async (w) => {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { page, src: await attach(page) };
  };
  const check = async (entry, f, edits, targets) => {
    const scope = scopeOf(f);
    const pre = findingsOf(await recheck(scope));
    let undo;
    try { undo = apply(root, edits); } catch (e) { if (e instanceof EditError) { entry.status = 'not-applied'; entry.reason = e.message; return; } throw e; }
    version++;
    const after = await recheck(scope);
    const now = findingsOf(after);
    const preKeys = new Set(pre.map((x) => x.fingerprint));
    const left = stillThere(now, f, targets);
    const brought = now.filter((x) => !preKeys.has(x.fingerprint) && !(x.check === f.check && (x.fingerprint === f.fingerprint || elementsOf(x).some((s) => targets?.includes(s)))));
    entry.recheck = { passes: scope.passes, widths: scope.widths, status: after.status, cleared: !left, new: brought.map((x) => ({ check: x.check, severity: x.severity, fingerprint: x.fingerprint, message: x.message })) };
    if (after.status !== 'complete' || left || brought.length) {
      revert(undo); version++;
      entry.status = 'reverted';
      entry.reason = after.status !== 'complete' ? `the re-check was ${after.status} (${after.reason}), so the fix could not be judged` : left ? `the re-check still finds ${f.check} on the elements it changed` : `the re-check finds what was not there before: ${brought.map((x) => `${x.check} (${x.message.split('. ')[0]})`).join('; ')}`;
      result.summary.reverted++;
      say(`  reverted: ${entry.class} for ${f.id}: ${entry.reason}`);
    } else { entry.status = 'kept'; result.summary.kept++; say(`  kept: ${entry.class} for ${f.id}`); }
  };

  try {
    if (o.apply) {
      // Fixes written elsewhere, each checked as the fixer's own are.
      const given = JSON.parse(readFileSync(o.apply, 'utf8')).fixes ?? [];
      for (const g of given) {
        const f = findings.find((x) => x.fingerprint === g.finding?.fingerprint) ?? findings.find((x) => x.check === g.finding?.check);
        const entry = { finding: f ? { id: f.id, check: f.check, fingerprint: f.fingerprint, severity: f.severity, message: f.message } : g.finding, class: 'given', kind: 'auto', note: g.note ?? null, edits: g.edits ?? [] };
        result.fixes.push(entry);
        if (!f) { entry.status = 'not-applied'; entry.reason = 'the inspection did not find this finding'; continue; }
        if (o.dryRun) { entry.status = 'planned'; result.summary.planned++; continue; }
        await check(entry, f, entry.edits, elementsOf(f));
      }
    } else {
      for (const f of findings) {
        if (f.check === 'timed-out') continue;
        const ws = seenWidths({ x: f.seen?.light ?? Object.values(f.seen ?? {})[0] });
        const { page, src } = await openAt(ws[0] ?? 1440);
        // The other widths the finding was seen at, opened only when a value is not found at the first.
        const others = ws.slice(1).reverse(), rest = others.filter((_, i) => i % Math.ceil(others.length / 5) === 0), opened = [page];   // at most five, the widest first, spread over the rest
        const next = async () => { if (!rest.length) return null; const x = await openAt(rest.shift()); opened.push(x.page); return x.src; };
        let plan;
        try {
          const px = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)).catch(() => rootPx);
          plan = await planFix(f, { page, src, root, url, system: o.system, rootPx: px || rootPx, next });
        } finally { for (const pg of opened) await pg.close().catch(() => {}); }
        const entry = { finding: { id: f.id, check: f.check, fingerprint: f.fingerprint, severity: f.severity, message: f.message }, class: plan.class, kind: plan.kind, note: plan.note, edits: plan.edits, ...(plan.locations?.length ? { locations: plan.locations } : {}) };
        result.fixes.push(entry);
        if (plan.kind === 'guided') { entry.status = 'guided'; result.summary.guided++; continue; }
        if (o.dryRun) { entry.status = 'planned'; result.summary.planned++; continue; }
        await check(entry, f, plan.edits, plan.targets);
      }
    }
  } finally { await browser.close(); write(); }
  return result;
}

function parseArgs(argv) {
  const known = { root: 1, system: 1, out: 1, apply: 1, fast: 0, 'no-engines': 0, 'dry-run': 0 };
  const o = { _: [], bad: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if (!(k in known)) { o.bad.push(a); continue; }
    if (known[k]) { const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) o.bad.push(`${a} needs a value`); else { o[k] = v; i++; } } else o[k] = true;
  }
  return o;
}

const startedAsCommand = () => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } };
if (startedAsCommand()) {
  const args = parseArgs(process.argv.slice(2));
  const usage = 'Usage: node itten/inspector/fix.js <url> --root <dir> [--system itten.system.json] [--out itten-fix] [--fast] [--no-engines] [--dry-run] [--apply fixes.json]';
  const bad = [...args.bad, ...(args._.length !== 1 ? [args._.length ? 'one URL only' : 'a URL'] : []), ...(!args.root ? ['--root'] : [])];
  if (args.root && (!existsSync(args.root) || !statSync(args.root).isDirectory())) bad.push(`--root ${args.root} is not a folder`);
  if (bad.length) { console.error(`fix: ${bad.join('; ')}\n${usage}`); process.exit(64); }
  let system = null;
  if (args.system) { const r = loadSystem(args.system); if (r.errors.length) { console.error(`${args.system} is not valid:\n  ${r.errors.join('\n  ')}`); process.exit(64); } system = r.system; }
  const r = await fix(args._[0], { root: args.root, system, systemPath: args.system ?? null, out: args.out, apply: args.apply, fast: !!args.fast, engines: args['no-engines'] ? [] : undefined, dryRun: !!args['dry-run'] })
    .catch((e) => { console.error(e.stack || String(e)); process.exit(70); });
  const s = r.summary;
  console.log(`${s.kept} kept, ${s.reverted} reverted, ${s.guided} guided${s.planned ? `, ${s.planned} planned` : ''}. Fixes: ${join(args.out ?? 'itten-fix', 'fixes.json')}`);
  process.exit(r.status === 'refused' ? (r.blocked ? 75 : 2) : s.reverted ? 1 : 0);
}
