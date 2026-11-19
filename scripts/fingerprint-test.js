// Fingerprints, fp/2 (docs/CONTRACT.md, "Fingerprints"; inspector/fingerprint.js).
// A fingerprint never holds a value measured at run time. Without a browser:
// - a scale finding's key is its properties and its elements; more than 8
//   elements are a number and a digest; two findings that would share a key
//   are told apart by their sides, and by a number only when those match too;
// - each kind of fp/1 scale finding is re-keyed from its message and elements;
// - a baseline written before fp/2 matches a run whose sweep turned a fixed
//   size into a fluid one, on the same element, with nothing new or fixed;
//   the control, the same compare without re-keying, calls both new and
//   fixed; another element is new and fixed either way; a baseline that says
//   fp/2 is not re-keyed; and the stopgap is gone: the same check on the same
//   elements is no match by itself;
// - a re-keyed finding cut at 8 elements matches the run's finding with those
//   first 8, and not one of other properties.
// against(): a real report against fixtures/itten-baseline.json, for the
// check, which runs the fixtures: nothing new, nothing fixed, and no
// fingerprint that holds a kind or a measured value.
// Usage: node scripts/fingerprint-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaleKeys, rekey, elementsPart, FP } from '../inspector/fingerprint.js';
import { compare, readBaseline } from '../inspector/baseline.js';
import { toFinding, findingsOf, view } from '../inspector/finding.js';
import { readArgs } from '../inspector/usage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// What an fp/1 scale fingerprint looked like.
export const MEASURED = /^(spacing-scale|type-scale)\|(fixed|fluid)\||^type-scale\|lh\||^spacing-unit\|px\|/;

// A real report of a fixture page against the fixtures' 0.3.3 baseline.
export function against(report, page, name) {
  const fails = [];
  const base = readBaseline(join(ROOT, 'fixtures', 'itten-baseline.json'));
  const all = findingsOf(report).map(view);
  if (report.sweep?.fingerprints !== FP) fails.push(`${name}: the report does not say its fingerprints are ${FP}`);
  for (const f of all) {
    if (MEASURED.test(f.fingerprint)) fails.push(`${name}: ${f.fingerprint} holds a kind or a value the sweep measured`);
    if (f.scale && !f.fingerprint.startsWith(`${f.check}|${[...new Set(f.scale.properties.map((p) => p.replace(/^(padding|margin)-.*/, '$1').replace(/^(row|column)-gap$/, 'gap')))].sort().join(',')}|`) && !f.fingerprint.startsWith(`${f.check}|${[...f.scale.properties].sort().join(',')}|`)) fails.push(`${name}: ${f.fingerprint} does not begin with its check and properties (${f.scale.properties.join(', ')})`);
  }
  const c = compare(report, base, 'fixtures/itten-baseline.json', page);
  if (!c.found) fails.push(`${name}: the baseline has no entry for ${page}`);
  if (c.new.length || c.fixed.length) fails.push(`${name}: against the 0.3.3 baseline, ${c.new.length} new (${c.new.map((id) => all.find((f) => f.id === id)?.fingerprint).join('; ')}) and ${c.fixed.length} fixed (${c.fixed.map((f) => f.was ?? f.fingerprint).join('; ')})`);
  return fails;
}

export function run() {
  const fails = [];
  const eq = (got, want, what) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${what}: ${JSON.stringify(got)}, not ${JSON.stringify(want)}`); };

  // Keys.
  const k = (...list) => scaleKeys(list.map(([check, props, sels]) => ({ check, props, sels })));
  eq(k(['spacing-scale', ['padding-top', 'padding-bottom'], ['#b', '#a']]), ['padding|#a, #b'], 'sides of one property, elements sorted');
  eq(k(['spacing-scale', ['row-gap', 'margin-left', 'column-gap'], ['#a']]), ['gap,margin|#a'], 'two properties');
  eq(k(['type-scale', ['font-size'], ['p']], ['type-scale', ['line-height'], ['p']]), ['font-size|p', 'line-height|p'], 'a size and a line height on one element');
  eq(k(['spacing-scale', ['padding-top'], ['#a']], ['spacing-scale', ['padding-left'], ['#a']]), ['padding-top|#a', 'padding-left|#a'], 'a collision is told apart by the sides');
  eq(k(['spacing-scale', ['padding-top'], ['#a']], ['spacing-unit', ['padding-top'], ['#a']]), ['padding|#a', 'padding|#a'], 'two checks do not collide');
  eq(k(['type-scale', ['font-size'], ['p']], ['type-scale', ['font-size'], ['p']], ['type-scale', ['font-size'], ['h1']]), ['font-size|p', 'font-size|p|2', 'font-size|h1'], 'a number only when the sides match too');
  const many = Array.from({ length: 12 }, (_, i) => `li:nth-of-type(${i + 1})`);
  const part = elementsPart(many);
  if (!/^12 elements:[0-9a-f]{12}$/.test(part)) fails.push(`more than 8 elements are named "${part}"`);
  if (part !== elementsPart([...many].reverse())) fails.push('the digest of the elements depends on their order');
  if (part === elementsPart([...many.slice(1), 'li.other'])) fails.push('the digest of the elements does not change with the elements');
  eq(elementsPart(many.slice(0, 8)).split(', ').length, 8, 'eight elements are spelled out');

  // Re-keying fp/1.
  const old = (fingerprint, message, ...elements) => ({ fingerprint, check: fingerprint.split('|')[0], severity: 'warning', message, elements });
  const rk = (...f) => rekey(f).map((x) => x.fingerprint);
  eq(rk(old('spacing-scale|fixed|13', '13 px is not on the spacing scale (nearest 12 or 16 px); used 2 times as padding-top, padding-bottom.', '#d01 > div')), ['spacing-scale|padding|#d01 > div'], 'fp/1 fixed spacing');
  eq(rk(old('spacing-scale|fluid|16,31,56,56', 'padding-right, padding-left on 1 element scale with the viewport, from 16 px at 320 px wide to 56 px at 1440 px wide.', '#d22 > div')), ['spacing-scale|padding|#d22 > div'], 'fp/1 fluid spacing');
  eq(rk(old('type-scale|fixed|18', 'Font size 18 px is not on the type scale; on 1 text element.', '#d16 > p')), ['type-scale|font-size|#d16 > p'], 'fp/1 fixed type');
  eq(rk(old('type-scale|fluid|30,30.43,42,42', 'The font size of 1 text element scales with the viewport.', '#d21 > p')), ['type-scale|font-size|#d21 > p'], 'fp/1 fluid type');
  eq(rk(old('type-scale|lh|16/22', 'Line height 22 px at 16 px; the "body" step sets 24 px; on 1 text element.', '#d18 > p')), ['type-scale|line-height|#d18 > p'], 'fp/1 line height');
  eq(rk(old('spacing-unit|px|12', "12 px of padding-top, padding-bottom stays 12 px when the browser's text size is doubled, on 1 element.", '#d39 > div'), old('spacing-unit|px|16', "16 px of padding-right, padding-left stays 16 px when the browser's text size is doubled, on 1 element.", '#d39 > div')), ['spacing-unit|padding-bottom,padding-top|#d39 > div', 'spacing-unit|padding-left,padding-right|#d39 > div'], 'fp/1 spacing units on one element');
  eq(rk(old('radius|6', 'Radius 6 px is not in the radius set.', '#d05 > div'), old('contrast|#a', 'm', '#a'), old('type-scale|step|16|500|text', 'm', 'p')), ['radius|6', 'contrast|#a', 'type-scale|step|16|500|text'], 'findings that hold no measured value keep their fingerprints');
  eq(rk(old('spacing-scale|fixed|13', 'a message from elsewhere', '#a')), ['spacing-scale|fixed|13'], 'a finding whose properties cannot be read is left as it is');

  // The compare.
  const now = (id, check, fingerprint, sels, severity = 'warning') => toFinding({ id, check, fingerprint, severity, message: 'm', elements: sels.map((sel) => ({ sel, label: sel })), seen: { light: '320' }, crops: [] });
  const page = (...findings) => ({ schema: 'report/1', subject: 'http://x/p', url: 'http://x/p', status: 'complete', sweep: { widths: '320, 431, 432, 768', fingerprints: FP }, findings });
  const was = (o, ...findings) => ({ pages: { '/p': { widths: '320, 768, 1440, 1920', ...o, findings } } });
  const b1 = was({}, old('type-scale|fixed|18', 'Font size 18 px is not on the type scale; on 1 text element.', '#d16 > p'), old('spacing-scale|fluid|16,31,56,56', 'padding-right, padding-left on 1 element scale with the viewport.', '#d22 > div'));
  const moved = page(now('i001', 'type-scale', 'type-scale|font-size|#d16 > p', ['#d16 > p']), now('i002', 'spacing-scale', 'spacing-scale|padding|#d22 > div', ['#d22 > div']));
  const c1 = compare(moved, b1, 'b', '/p');
  if (c1.new.length || c1.fixed.length || c1.rekeyed !== 2) fails.push(`a baseline from before fp/2 against a run of other widths: ${c1.new.length} new, ${c1.fixed.length} fixed, ${c1.rekeyed} re-keyed`);
  const c2 = compare(moved, b1, 'b', '/p', { rekey: false });
  if (c2.new.length !== 2 || c2.fixed.length !== 2) fails.push(`control: without re-keying, ${c2.new.length} new and ${c2.fixed.length} fixed, not 2 and 2`);
  const c3 = compare(page(now('i001', 'type-scale', 'type-scale|font-size|#d99 > p', ['#d99 > p']), now('i002', 'spacing-scale', 'spacing-scale|padding|#d22 > div', ['#d22 > div'])), b1, 'b', '/p');
  if (c3.new.join() !== 'i001' || c3.fixed.map((f) => f.was).join() !== 'type-scale|fixed|18') fails.push(`the same check on another element: new ${c3.new.join()}, fixed ${c3.fixed.map((f) => f.was).join()}`);
  const c4 = compare(moved, was({ fingerprints: FP }, { fingerprint: 'type-scale|font-size|#d16 > p', check: 'type-scale', severity: 'warning', message: 'm', elements: ['#d16 > p'] }, old('spacing-scale|fluid|16,31,56,56', 'padding-right, padding-left on 1 element scale with the viewport.', '#d22 > div')), 'b', '/p');
  if (c4.new.join() !== 'i002' || c4.fixed.length !== 1 || c4.rekeyed !== undefined) fails.push(`a baseline that says ${FP} is re-keyed: new ${c4.new.join()}, fixed ${c4.fixed.length}`);
  const c5 = compare(page(now('i001', 'radius', 'radius|8', ['#a'])), was({}, old('radius|6', 'm', '#a')), 'b', '/p');
  if (c5.new.join() !== 'i001' || c5.fixed.length !== 1) fails.push('the stopgap is still there: the same check on the same elements matched without the same fingerprint');
  // Cut at 8.
  const cutOld = old('spacing-scale|fixed|5', '5 px is not on the spacing scale (nearest 4 or 8 px); used 12 times as padding-left.', ...many.slice(0, 8));
  const big = (props) => now('i001', 'spacing-scale', `spacing-scale|${props}|${elementsPart(many)}`, many.slice(0, 8));
  const c6 = compare(page(big('padding')), was({}, cutOld), 'b', '/p');
  if (c6.new.length || c6.fixed.length) fails.push(`a re-keyed finding cut at 8 elements does not match the run's finding with those 8: ${c6.new.length} new, ${c6.fixed.length} fixed`);
  const c7 = compare(page(big('margin')), was({}, cutOld), 'b', '/p');
  if (c7.new.length !== 1 || c7.fixed.length !== 1) fails.push('a finding cut at 8 elements matches one of other properties');
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  readArgs(process.argv.slice(2), { name: 'fingerprint-test.js', usage: 'node scripts/fingerprint-test.js' });
  const fails = run();
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'Fingerprints hold no measured value; a baseline from before fp/2 is re-keyed as it is read.');
  process.exit(fails.length ? 1 : 0);
}
