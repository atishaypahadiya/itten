// Where a rendered value comes from in the project's source, for itten fix.
//
// The browser parses the stylesheets it is served; the DevTools protocol
// gives each declaration's range in that text (CSS.getMatchedStylesForNode).
// A range becomes a place in a file only when the file is the source of
// truth: the file at the URL's path under the project root holds exactly the
// text the server sent, git does not ignore it, and it carries no source map.
// Otherwise the text was built from something else, and the fix is guided:
// its location and a note, never an edit.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { offsetOf, positionOf } from './edits.js';

// Longhands and the shorthands that set them, with the value each takes
// from a shorthand of n parts (CSS box sides: 1, 2, 3 or 4 values).
const SIDES = ['top', 'right', 'bottom', 'left'];
const SIDE_INDEX = { 1: [0, 0, 0, 0], 2: [0, 1, 0, 1], 3: [0, 1, 2, 1], 4: [0, 1, 2, 3] };
export function shorthandPart(shorthand, longhand, n) {
  for (const box of ['padding', 'margin', 'inset']) {
    if (shorthand !== box) continue;
    const side = SIDES.findIndex((s) => longhand === (box === 'inset' ? s : `${box}-${s}`));
    return side < 0 || !SIDE_INDEX[n] ? null : SIDE_INDEX[n][side];
  }
  if (shorthand === 'gap') { const i = ['row-gap', 'column-gap'].indexOf(longhand); return i < 0 || n > 2 ? null : n === 1 ? 0 : i; }
  return null;
}
export const sets = (decl, prop) => decl === prop || shorthandPart(decl, prop, 1) !== null;

// The parts of a declaration's value, split on whitespace outside brackets,
// with their offsets in the value.
export function valueParts(value) {
  const parts = [];
  let depth = 0, start = -1;
  for (let i = 0; i <= value.length; i++) {
    const c = value[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    const space = c === undefined || (depth === 0 && /\s/.test(c));
    if (!space && start < 0) start = i;
    if (space && start >= 0) { parts.push({ text: value.slice(start, i), at: start }); start = -1; }
  }
  return parts;
}

const BUILD_DIRS = new Set(['dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '_site', '.output']);

// Why a file is not the source of truth, or null when it is.
export function notSource(root, file, served) {
  const p = join(root, file);
  if (!existsSync(p) || !statSync(p).isFile()) return `no file at ${file} under the project root`;
  const text = readFileSync(p, 'utf8');
  if (text !== served) return `${file} on disk is not the text the server sends, so a build step makes what is served`;
  if (/[#@]\s*sourceMappingURL=/.test(text)) return `${file} has a source map, so it is built from another file`;
  if (file.split('/').some((d) => BUILD_DIRS.has(d))) return `${file} is in a build output folder`;
  try {
    execFileSync('git', ['-C', root, 'check-ignore', '-q', '--', file], { stdio: 'ignore' });
    return `git ignores ${file}, so it is build output`;
  } catch { /* exit 1: not ignored; 128: not a repository */ }
  return null;
}

// The file under root that a URL of the page's own origin names.
export function fileOf(root, url, pageUrl) {
  const u = new URL(url), p = new URL(pageUrl);
  if (u.origin !== p.origin) return null;
  let path = decodeURIComponent(u.pathname);
  if (path.endsWith('/')) path += 'index.html';
  return relative(root, join(root, path)).split('\\').join('/');
}

// A CDP session on a page with the DOM and CSS domains on, and every
// stylesheet the page has.
export async function attach(page) {
  const cdp = await page.context().newCDPSession(page);
  const sheets = new Map();
  cdp.on('CSS.styleSheetAdded', ({ header }) => sheets.set(header.styleSheetId, header));
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const texts = new Map();
  const text = async (id) => { if (!texts.has(id)) texts.set(id, (await cdp.send('CSS.getStyleSheetText', { styleSheetId: id })).text); return texts.get(id); };
  return { cdp, sheets, text };
}

async function nodeOf(src, selector) {
  const { root } = await src.cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await src.cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector }).catch(() => ({ nodeId: 0 }));
  return nodeId || null;
}

// The author rules that match an element, highest precedence last, each
// with its stylesheet header.
export async function rulesOf(src, selector) {
  const nodeId = await nodeOf(src, selector);
  if (!nodeId) return null;
  const m = await src.cdp.send('CSS.getMatchedStylesForNode', { nodeId });
  return {
    inline: m.inlineStyle?.cssProperties?.some((p) => p.range) ? m.inlineStyle : null,
    rules: (m.matchedCSSRules || []).filter((r) => r.rule.origin === 'regular' && r.rule.styleSheetId).map((r) => ({ ...r.rule, header: src.sheets.get(r.rule.styleSheetId) })),
  };
}

// The declaration that gives an element its value of a property: the last
// one in cascade order that sets it, !important first. Returns
// { rule, prop (the declaration), part (index into the value, or null for
// all of it) }, or { why } when it comes from somewhere a fix cannot reach.
export async function declarationOf(src, selector, property) {
  const m = await rulesOf(src, selector);
  if (!m) return { why: `no element matches ${selector} on the page as loaded` };
  const cands = [];
  m.rules.forEach((rule, order) => {
    for (const p of rule.style.cssProperties) {
      if (!p.range || p.disabled || p.parsedOk === false || !sets(p.name, property)) continue;
      cands.push({ rule, prop: p, order, important: !!p.important || /!\s*important\s*$/i.test(p.value) });
    }
  });
  if (m.inline?.cssProperties?.some((p) => p.range && sets(p.name, property))) return { why: `${selector} sets ${property} in its style attribute` };
  if (!cands.length) return { why: `${selector} takes ${property} from no rule of its own (it is inherited or the browser's default)` };
  cands.sort((a, b) => (a.important - b.important) || (a.order - b.order));
  const c = cands.at(-1);
  // Within one rule, the last declaration of the property wins.
  const same = cands.filter((x) => x.rule === c.rule && x.important === c.important);
  const win = same.at(-1);
  const n = valueParts(win.prop.value.replace(/\s*!\s*important\s*$/i, '')).length;
  const part = win.prop.name === property ? null : shorthandPart(win.prop.name, property, n);
  if (win.prop.name !== property && part === null) return { why: `${property} comes from ${win.prop.name}: ${win.prop.value}, which a fix does not take apart` };
  return { rule: win.rule, prop: win.prop, part };
}

// A range in a stylesheet (0-based lines and columns, as the DevTools
// protocol gives them) as a place in the project's file, or { why }.
export async function placeOf(src, root, pageUrl, header, range) {
  const sheetText = await src.text(header.styleSheetId);
  const sheetOffset = offsetOf(sheetText, range.startLine + 1, range.startColumn + 1);
  const sheetEnd = offsetOf(sheetText, range.endLine + 1, range.endColumn + 1);
  if (header.isInline) {
    const file = fileOf(root, header.sourceURL || pageUrl, pageUrl);
    if (!file) return { why: 'the page is from another origin' };
    const p = join(root, file);
    if (!existsSync(p)) return { why: `no file at ${file} under the project root` };
    const html = readFileSync(p, 'utf8');
    const at = offsetOf(html, header.startLine + 1, header.startColumn + 1);
    if (html.slice(at, at + sheetText.length) !== sheetText) return { why: `the <style> in ${file} on disk is not the text the browser was sent` };
    const why = notSource(root, file, html);
    if (why) return { why };
    return { file, text: html, offset: at + sheetOffset, end: at + sheetEnd, ...positionOf(html, at + sheetOffset) };
  }
  const file = fileOf(root, header.sourceURL, pageUrl);
  if (!file) return { why: `${header.sourceURL} is not on the page's own server` };
  const why = notSource(root, file, sheetText);
  if (why) return { why, file };
  return { file, text: sheetText, offset: sheetOffset, end: sheetEnd, ...positionOf(sheetText, sheetOffset) };
}

// The place of one part of a declaration's value (or the whole value):
// { file, line, column, length, text (the part), place } or { why }.
export async function valuePlace(src, root, pageUrl, d) {
  const place = await placeOf(src, root, pageUrl, d.rule.header, d.prop.range);
  if (place.why) return place;
  const declText = place.text.slice(place.offset, place.end);
  const colon = declText.indexOf(':');
  if (colon < 0) return { why: 'the declaration has no colon where the browser said it would' };
  let vStart = colon + 1;
  while (/\s/.test(declText[vStart] ?? '')) vStart++;
  let vEnd = declText.length;
  if (declText.endsWith(';')) vEnd--;
  let value = declText.slice(vStart, vEnd).replace(/\s+$/, '');
  value = value.replace(/\s*!\s*important$/i, '');
  const parts = valueParts(value);
  const part = d.part === null ? { text: value, at: 0 } : parts[d.part];
  if (!part) return { why: 'the value has fewer parts than the browser read' };
  const off = place.offset + vStart + part.at;
  return { file: place.file, ...positionOf(place.text, off), length: part.text.length, text: part.text, offset: off, place, declText, vStart, valueEnd: place.offset + vStart + value.length };
}
