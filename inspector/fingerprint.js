// Fingerprints, version fp/2 (docs/CONTRACT.md, "Fingerprints").
//
// A fingerprint is the same for the same finding in every run. It names the
// check and where the finding is, and never a value measured at run time;
// declared values may appear (a motion's duration and easing, a font's
// family, a radius).
//
// Under fp/1 a scale finding held what the sweep measured: its kind (fixed
// or fluid) and its value, or its value at each width. Another set of widths
// then gave the same finding another fingerprint. Under fp/2 a scale finding
// (spacing-scale, type-scale's sizes and line heights, spacing-unit) is
//
//   <check>|<properties>|<elements>
//
// - properties: the CSS properties it is about, sorted and joined by commas:
//   padding, margin, gap, font-size or line-height. A side (padding-top) or
//   an axis (row-gap) is named by its property.
// - elements: the selectors of all its elements, sorted and joined by ", ",
//   taken before the report cuts the list to 8. More than 8 are named by
//   their number and a digest of the sorted list, "23 elements:5f0c9a1e77b2".
//
// Two findings of one report that would share a fingerprint are told apart
// by the sides and axes themselves (padding-top, not padding); only if they
// still collide is a number added, |2, |3, in the order they are reported.

import { createHash } from 'node:crypto';

export const FP = 'fp/2';
export const CUT = 8;

export const propOf = (p) => (/^(padding|margin)-/.test(p) ? p.split('-')[0] : /^(row|column)-gap$/.test(p) ? 'gap' : p);
const uniq = (a) => [...new Set(a)].sort();

export function elementsPart(sels) {
  const s = uniq(sels);
  return s.length <= CUT ? s.join(', ') : `${s.length} elements:${createHash('sha256').update(s.join('\n')).digest('hex').slice(0, 12)}`;
}

// The keys (the fingerprint without its check) of a list of scale findings
// of one report, each { check, props: [as measured], sels: [all of them] }.
export function scaleKeys(list) {
  const short = list.map((x) => `${uniq(x.props.map(propOf)).join(',')}|${elementsPart(x.sels)}`);
  const long = list.map((x) => `${uniq(x.props).join(',')}|${elementsPart(x.sels)}`);
  const id = (k, i) => `${list[i].check}|${k}`;
  const times = (keys) => { const n = new Map(); keys.forEach((k, i) => n.set(id(k, i), (n.get(id(k, i)) || 0) + 1)); return n; };
  const n1 = times(short);
  const keys = short.map((k, i) => (n1.get(id(k, i)) > 1 ? long[i] : k));
  const n2 = times(keys), seen = new Map();
  return keys.map((k, i) => {
    if (n2.get(id(k, i)) === 1) return k;
    const at = (seen.get(id(k, i)) || 0) + 1;
    seen.set(id(k, i), at);
    return at === 1 ? k : `${k}|${at}`;
  });
}

// fp/1 scale findings, as a baseline keeps them: their check, message and
// first 8 elements. The properties are read from the message.
const OLD = [
  [/^spacing-scale\|fixed\|/, /as ([a-z, -]+)\.$/],
  [/^spacing-scale\|fluid\|/, /^([a-z, -]+) on \d+ elements? scales? /],
  [/^type-scale\|(fixed|fluid)\|/, 'font-size'],
  [/^type-scale\|lh\|/, 'line-height'],
  [/^spacing-unit\|px\|/, / px of ([a-z, -]+) stays /],
];

// A baseline's findings re-keyed from fp/1 to fp/2. Each keeps its old
// fingerprint as `was`. One whose list of elements was cut at 8 cannot be
// re-keyed exactly; it is marked `cut` and matched by those 8.
export function rekey(findings) {
  const scale = [];
  const out = findings.map((f) => {
    const rule = OLD.find(([re]) => re.test(f.fingerprint ?? ''));
    if (!rule) return f;
    const props = typeof rule[1] === 'string' ? [rule[1]] : ((f.message ?? '').match(rule[1]) || [])[1]?.split(/,\s*/).filter(Boolean);
    const sels = f.elements ?? [];
    if (!props?.length || !sels.length) return f;
    const g = { ...f, was: f.fingerprint, ...(sels.length >= CUT ? { cut: true } : {}) };
    scale.push({ g, check: f.check, props, sels });
    return g;
  });
  scaleKeys(scale).forEach((k, i) => { scale[i].g.fingerprint = `${scale[i].check}|${k}`; });
  return out;
}

// The properties part of an fp/2 scale fingerprint.
export const propsPart = (fingerprint) => String(fingerprint).split('|')[1];
