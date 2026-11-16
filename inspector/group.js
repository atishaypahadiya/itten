// Repeated information findings, grouped for reading: one note per check
// and container (a table or a list) that names the cells or items, in place
// of one note per cell. Only info is grouped; an error or a warning stays a
// finding of its own, with its own crops. report.json keeps every finding,
// so baselines and fingerprints do not change.

const CONTAINER = /^(table|ul|ol|dl)(:nth-of-type\(\d+\))?$/;

// The selector of the nearest table or list in an element's selector, which
// the inspector writes as a path from the nearest id: "#t > table > tbody >
// tr:nth-of-type(2) > td" gives "#t > table".
export function container(sel) {
  const parts = String(sel ?? '').split(' > ');
  for (let i = parts.length - 2; i >= 0; i--) if (CONTAINER.test(parts[i])) return parts.slice(0, i + 1).join(' > ');
  return null;
}

// Where an element sits in its container, in words: "row 2, cell 3",
// "item 4", or the rest of the selector.
export function place(sel, within) {
  const rest = String(sel).slice(within.length).replace(/^ > /, '');
  const nth = (tag) => { const m = rest.match(new RegExp(`(?:^|> )${tag}(?::nth-of-type\\((\\d+)\\))?(?= >|$)`)); return m ? Number(m[1] ?? 1) : null; };
  const row = nth('tr'), cell = nth('td') ?? nth('th'), item = nth('li') ?? nth('dd') ?? nth('dt');
  const head = /^thead\b/.test(rest) ? 'header ' : /^tfoot\b/.test(rest) ? 'footer ' : '';
  if (row !== null && cell !== null) return `${head}row ${row}, cell ${cell}`;
  if (row !== null) return `${head}row ${row}`;
  if (item !== null) return `item ${item}`;
  return rest || within;
}

// Items in order, with each run of two or more info findings of one check in
// one container replaced, where the first of them stood, by
// { group: true, check, severity: 'info', title, container, items }. A
// group's items are in document order: the position the inspector recorded
// for each element (order), or, in a report without it, rows and cells by
// number (byPlace), which cannot tell a header row from the first body row.
export function groupInfo(items, selOf = (i) => i.elements?.[0]?.sel ?? i.element, orderOf = (i) => i.elements?.[0]?.order ?? i.order) {
  const keyOf = (i) => {
    if (i.severity !== 'info') return null;
    const c = container(selOf(i));
    return c ? `${i.check}|${c}` : null;
  };
  const counts = new Map();
  for (const i of items) { const k = keyOf(i); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); }
  const out = [], groups = new Map();
  for (const i of items) {
    const k = keyOf(i);
    if (!k || counts.get(k) < 2) { out.push(i); continue; }
    let g = groups.get(k);
    if (!g) {
      g = { group: true, check: i.check, severity: 'info', title: i.title, container: k.slice(i.check.length + 1), items: [] };
      groups.set(k, g);
      out.push(g);
    }
    g.items.push(i);
  }
  const at = (i) => { const n = orderOf(i); return typeof n === 'number' ? n : Infinity; };
  for (const g of groups.values()) {
    g.items.sort((a, b) => (at(a) - at(b)) || byPlace(place(selOf(a), g.container), place(selOf(b), g.container)));
  }
  return out;
}

// The words the messages of a group share, with "…" where they differ, and
// for each message the words that differ: the sentence is read once, and
// each cell shows only its own values. Messages of different lengths are
// shown whole.
export function template(messages) {
  const toks = messages.map((m) => String(m).split(' '));
  if (toks.some((t) => t.length !== toks[0].length)) return { shared: null, parts: messages.map(String) };
  const same = toks[0].map((w, i) => toks.every((t) => t[i] === w));
  const shared = toks[0].map((w, i) => (same[i] ? w : '…')).join(' ');
  return { shared, parts: toks.map((t) => t.filter((_, i) => !same[i]).join(' ')) };
}

// Order of a place within its container: header rows, then body rows, then
// footer rows (a table's order in HTML), and within each, rows and cells by
// number.
export function byPlace(a, b) {
  const part = (s) => (/^header /.test(s) ? 0 : /^footer /.test(s) ? 2 : 1);
  if (part(a) !== part(b)) return part(a) - part(b);
  const n = (s) => (s.match(/\d+/g) || []).map(Number);
  const x = n(a), y = n(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1);
  return a.localeCompare(b);
}
