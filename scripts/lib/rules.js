// The rules ITTEN defines, by ID: every "### XXX-00 · Title" heading in
// protocol/ and reference/.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function* markdown(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* markdown(p);
    else if (name.endsWith('.md')) yield p;
  }
}

let cache = null;
export function rules() {
  if (cache) return cache;
  cache = new Map();
  for (const dir of ['protocol', 'reference']) {
    for (const file of markdown(join(ROOT, dir))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/^### ([A-Z]{3}-[0-9]{2}) · (.+)$/gm)) {
        if (!cache.has(m[1])) cache.set(m[1], { id: m[1], title: m[2].trim(), file: file.slice(ROOT.length + 1) });
      }
    }
  }
  return cache;
}
