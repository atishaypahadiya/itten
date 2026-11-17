// finding/1: the finding format shared by every specialist in the set
// (schema/finding.schema.json), and ITTEN's extension to it
// (schema/finding-itten.schema.json). See protocol/04-inspect.md, "The
// finding format".
//
// During a run the inspector keeps each finding flat ({ id, fingerprint,
// check, severity, message, count, elements, seen, ... }). toFinding() writes
// it as finding/1 for report.json; view() reads either shape back as the flat
// one, so a report written before 0.3.5 reads the same as a new one.
// findingsOf() reads the findings of a report in either shape: report/1
// (schema/report.schema.json) keeps them in findings, older reports in issues.

export const SCHEMA = 'finding/1';
export const REPORT = 'report/1';
export const SPECIALIST = 'itten';

// The checks that hold an accessibility floor: failing one fails a WCAG
// success criterion outright, not only a rule of craft. spacing-unit cites
// WCAG 1.4.4 as context but is craft: spacing that keeps its size when text
// doubles does not by itself lose content.
export const FLOORS = {
  contrast: 'accessibility',      // WCAG 1.4.3
  overflow: 'accessibility',      // WCAG 1.4.10
  clipping: 'accessibility',      // WCAG 1.4.4
  'target-size': 'accessibility', // WCAG 2.5.8
  'text-resize': 'accessibility', // WCAG 1.4.4
  flash: 'accessibility',         // WCAG 2.3.1
};

// Measured fields: the flat names the inspector uses, and their paths in
// finding/1. A path is dotted from the finding's root; "[]" means each item
// of a list; "message" means the numbers in the message.
const PATHS = { count: 'itten.count', 'elements.rect': 'where.elements[].rect', message: 'message' };
const FLAT = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [v, k]));

const CORE_ELEMENT = ['sel', 'label', 'text', 'rect'];
// Every ITTEN finding is measured on a rendered page.
const DETECTION = ['render'];
// The reference/ IDs in a rule string such as "CRF-16 · LAY-03 · WCAG 1.4.10".
const ruleIds = (rule) => String(rule ?? '').split(/\s*·\s*/).filter((r) => /^[A-Z][A-Z0-9]*-[0-9]+$/.test(r));

// The page a finding is on, for a finding on the page as a whole (a failed
// request, a step that timed out): its path and query, never host or port,
// which change between runs.
export function pagePath(url) {
  try { const u = new URL(url); return u.pathname + u.search; } catch { return String(url || '/'); }
}

export function toFinding(i, page = '/') {
  const { id, fingerprint, check, severity, message, measured, elements = [], floor, detection, rules, specialist, schema, ...rest } = i;
  const extras = elements.map((e) => {
    const x = Object.fromEntries(Object.entries(e).filter(([k, v]) => !CORE_ELEMENT.includes(k) && v !== undefined));
    return Object.keys(x).length ? x : null;
  });
  return {
    schema: SCHEMA,
    specialist: SPECIALIST,
    check, severity, fingerprint, message,
    measured: (measured ?? []).map((m) => PATHS[m] ?? m),
    floor: FLOORS[check] ?? null,
    detection: DETECTION,
    ...(ruleIds(rest.rule).length ? { rules: ruleIds(rest.rule) } : {}),
    where: elements.length
      ? { elements: elements.map((e) => Object.fromEntries(CORE_ELEMENT.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]))) }
      : { resources: [{ kind: 'page', name: page }] },
    itten: { id, ...rest, ...(extras.some(Boolean) ? { elements: extras } : {}) },
  };
}

export function view(f) {
  if (f?.schema !== SCHEMA) return f;
  const { elements: extras = [], id, ...x } = f[f.specialist] ?? {};
  const out = {
    id, fingerprint: f.fingerprint, check: f.check, severity: f.severity, message: f.message,
    elements: (f.where?.elements ?? []).map((e, k) => ({ ...e, ...(extras[k] ?? {}) })),
    ...x,
  };
  if (f.measured?.length) out.measured = f.measured.map((m) => FLAT[m] ?? m);
  return out;
}

export const findingsOf = (r) => (r.findings ?? r.issues ?? []).map(view);
