// Edits to a project's files, as itten fix writes them (docs/CONTRACT.md,
// "Fixes"). Three shapes:
//
//   { file, line, column, length, replace }   replace `length` characters at
//                                             line:column with `replace`
//   { create: file, content }                 a new file; it must not exist
//   { remove: file }                          delete a file
//
// `file` is relative to the project root. `line` and `column` are 1-based;
// `column` and `length` count UTF-16 code units, as JavaScript strings and
// the DevTools protocol do. A length of 0 inserts; an empty `replace`
// deletes. A line ends at \n and nowhere else: the \r of a \r\n pair is the
// last character of its line. A byte-order mark at the start of the file is
// not counted: line 1, column 1 is the character after it. A path that is
// absolute, leaves the root, or reaches outside it through a symbolic link
// is refused. (The edit-unit rule, shared with KERCKHOFFS and ERLANG.)
//
// apply() writes a set of edits all or none: edits that overlap, point past
// the end of a line or the file, or create a file that exists are refused
// before anything is written. It returns an undo record, and revert() puts
// every file back as it was.

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, realpathSync, lstatSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, sep, join } from 'node:path';

export class EditError extends Error {}

// 1 where the text begins with a byte-order mark, which no position counts.
const bom = (text) => (text.charCodeAt(0) === 0xFEFF ? 1 : 0);

// The offset in text of a 1-based line and column.
export function offsetOf(text, line, column) {
  if (!Number.isInteger(line) || !Number.isInteger(column) || line < 1 || column < 1) throw new EditError(`line ${line}, column ${column} is not a position (both are 1-based whole numbers)`);
  let at = bom(text);
  for (let l = 1; l < line; l++) {
    const nl = text.indexOf('\n', at);
    if (nl < 0) throw new EditError(`line ${line} is past the end of the file (${l} lines)`);
    at = nl + 1;
  }
  const end = text.indexOf('\n', at);
  const len = (end < 0 ? text.length : end) - at;
  if (column - 1 > len) throw new EditError(`column ${column} is past the end of line ${line} (${len} characters)`);
  return at + column - 1;
}

// The 1-based line and column of an offset in text.
export function positionOf(text, offset) {
  let line = 1, start = bom(text);
  for (let i = text.indexOf('\n'); i >= 0 && i < offset; i = text.indexOf('\n', i + 1)) { line++; start = i + 1; }
  return { line, column: offset - start + 1 };
}

// A file inside the root, never outside it.
export function inside(root, file) {
  if (typeof file !== 'string' || !file || isAbsolute(file)) throw new EditError(`"${file}" is not a path relative to the project root`);
  const full = resolve(root, file);
  const rel = relative(resolve(root), full);
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) throw new EditError(`"${file}" is outside the project root`);
  // Through symbolic links too. Each part of the path that exists is looked
  // at itself (lstat, which does not follow a link): a link must resolve to
  // somewhere inside the resolved root, and a link that points at nothing is
  // refused, since writing through it would make its target.
  const realRoot = realpathSync(resolve(root));
  const within = (p) => { const r = relative(realRoot, p); return !r.startsWith('..') && !isAbsolute(r); };
  let cur = realRoot;
  for (const part of rel.split(sep)) {
    const p = join(cur, part);
    let st;
    try { st = lstatSync(p); } catch { break; }   // the rest does not exist yet
    if (!st.isSymbolicLink()) { cur = p; continue; }
    let target;
    try { target = realpathSync(p); } catch { throw new EditError(`"${file}" goes through a symbolic link that points at nothing`); }
    if (!within(target)) throw new EditError(`"${file}" reaches outside the project root through a symbolic link`);
    cur = target;
  }
  return full;
}

export const kindOf = (e) => (e.create !== undefined ? 'create' : e.remove !== undefined ? 'remove' : 'replace');

export function apply(root, edits) {
  const before = new Map(); // file -> text, or null where it did not exist
  const after = new Map();
  const read = (f) => {
    if (!after.has(f)) { const p = inside(root, f); const t = existsSync(p) ? readFileSync(p, 'utf8') : null; before.set(f, t); after.set(f, t); }
    return after.get(f);
  };
  // Replacements per file, applied from the end so offsets hold.
  const byFile = new Map();
  for (const e of edits) {
    const k = kindOf(e);
    if (k === 'create') {
      if (read(e.create) !== null) throw new EditError(`${e.create} exists; create makes only new files`);
      if (typeof e.content !== 'string') throw new EditError(`create ${e.create} has no content`);
      after.set(e.create, e.content);
    } else if (k === 'remove') {
      if (read(e.remove) === null) throw new EditError(`${e.remove} does not exist`);
      after.set(e.remove, null);
    } else {
      const t = read(e.file);
      if (t === null) throw new EditError(`${e.file} does not exist`);
      if (!Number.isInteger(e.length) || e.length < 0 || typeof e.replace !== 'string') throw new EditError(`an edit of ${e.file} needs a length of 0 or more and a replace string`);
      const from = offsetOf(t, e.line, e.column);
      if (from + e.length > t.length) throw new EditError(`an edit of ${e.file} at ${e.line}:${e.column} runs past the end of the file`);
      if (!byFile.has(e.file)) byFile.set(e.file, []);
      byFile.get(e.file).push({ from, to: from + e.length, replace: e.replace });
    }
  }
  for (const [f, list] of byFile) {
    list.sort((a, b) => a.from - b.from || a.to - b.to);
    for (let i = 1; i < list.length; i++) if (list[i].from < list[i - 1].to || (list[i].from === list[i - 1].from && list[i].to === list[i - 1].from)) throw new EditError(`two edits of ${f} overlap at offset ${list[i].from}`);
    let t = after.get(f);
    for (const x of [...list].reverse()) t = t.slice(0, x.from) + x.replace + t.slice(x.to);
    after.set(f, t);
  }
  for (const [f, t] of after) {
    const p = inside(root, f);
    if (t === null) rmSync(p, { force: true });
    else if (t !== before.get(f)) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, t); }
  }
  return { root, files: [...before.entries()] };
}

export function revert(undo) {
  for (const [f, t] of undo.files) {
    const p = inside(undo.root, f);
    if (t === null) rmSync(p, { force: true });
    else writeFileSync(p, t);
  }
}

// The same file read the way apply() would read it, for planning.
export const readIn = (root, file) => readFileSync(inside(root, file), 'utf8');
