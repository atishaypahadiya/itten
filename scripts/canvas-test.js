// Parity on a page that keeps drawing. fixtures/canvas.html has white text
// over a canvas that redraws every frame, white text over a still grey box,
// and a line that spills out of its box. The contrast finding over the
// canvas must be marked movingBackground and the other two must not; the
// moving tiles must be reported over the canvas. The page is inspected on
// one worker and on two, and the reports compared: a difference in the
// finding over the canvas is a note, and the other findings must match
// exactly. Then, on the same reports: removing the finding over the canvas,
// or changing it, is a note; removing the overflow finding, or changing its
// severity, is a difference. A box a script recolours every frame, with no
// animation, must be counted as unexplained moving tiles; the canvas's tiles
// are explained.
// The crop of the finding over the canvas must show the frame it was
// measured in: the canvas is one colour per frame, so a canvas pixel in the
// crop must be the background the message names, with the text drawn over it.
// Usage: node scripts/canvas-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { decodePng, pixel } from '../inspector/png.js';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';
import { compare } from './parity-test.js';
import { view, findingsOf } from '../inspector/finding.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function run({ quiet = true } = {}) {
  const fails = [];
  const { system } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  const port = 5175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  try {
    const go = (workers) => inspect(`http://127.0.0.1:${port}/fixtures/canvas.html`, {
      system, systemPath: 'fixtures/itten.system.json', quiet, out: join(ROOT, 'dist', 'fixtures', `canvas-${workers}`),
      widths: [1024], keyWidths: [1024], engines: [], engineWidths: [], workers, timings: false, aroundBreakpoints: false,
    });
    // As written (finding/1) for the parity compare; read flat for the rest.
    const A = await go(1), B = await go(2);
    const flat = (r) => ({ ...r, findings: undefined, issues: findingsOf(r) });
    const a = flat(A), b = flat(B);
    const find = (r, check, cls) => r.issues.find((i) => i.check === check && i.elements.some((e) => e.label === cls));
    const moving = find(a, 'contrast', 'p.over'), still = find(a, 'contrast', 'p.over-still'), spill = a.issues.find((i) => i.fingerprint.startsWith('overflow|spill|') && i.elements.some((e) => e.label === 'p.narrow'));
    if (!moving) fails.push('no contrast finding on the text over the canvas');
    else if (!moving.movingBackground) fails.push('the contrast finding over the canvas is not marked movingBackground');
    if (!still) fails.push('no contrast finding on the text over the still box');
    else if (still.movingBackground) fails.push('the contrast finding over the still box is marked movingBackground');
    if (!spill) fails.push('no overflow finding (text spills out of its box) on the narrow line');
    else if (spill.movingBackground) fails.push('the overflow finding is marked movingBackground');
    // The crop: a point inside the canvas and clear of the text (44, 76) is
    // the colour the message names; the text (white) is drawn.
    for (const r of [a, b]) {
      const it = find(r, 'contrast', 'p.over');
      const c = it?.crops[0], named = it?.message.match(/over about #([0-9A-F]{6})/)?.[1];
      if (!c || !named) { fails.push('no crop, or no background named, for the finding over the canvas'); continue; }
      if (!c.composited) fails.push('the crop of the finding over the canvas is not marked composited');
      if (r.issues.some((i) => i !== it && i.crops.some((x) => x.composited))) fails.push('a crop of a finding not over a moving background is marked composited');
      const img = decodePng(readFileSync(join(ROOT, 'dist', 'fixtures', `canvas-${r === a ? 1 : 2}`, c.path)));
      const [x, y] = c.region, z = c.zoom;
      const at = (px, py) => pixel(img, Math.floor((px - x) * z + z / 2), Math.floor((py - y) * z + z / 2));
      const got = at(44, 76), want = [0, 2, 4].map((k) => parseInt(named.slice(k, k + 2), 16));
      if (got.some((v, k) => Math.abs(v - want[k]) > 2)) fails.push(`the crop shows the canvas as #${got.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}; the message measured it as #${named}`);
      const [ex, ey, ew, eh] = it.elements[0].rect;
      let white = 0;
      for (let py = Math.ceil(ey); py < ey + eh; py++) for (let px = Math.ceil(ex); px < ex + ew; px += 2) if (at(px, py).every((v) => v > 245)) white++;
      if (white < 20) fails.push(`the crop of the finding over the canvas shows no text (${white} white pixels in the text box)`);
    }
    // Tiles over the canvas are explained; the script-recoloured box's are not.
    // Its box: 96 × 32 at 32, below the narrow line.
    for (const d of a.drawing) {
      if (!(d.tiles > 0) || d.unexplained === undefined) { fails.push(`${d.at}: no count of moving tiles`); continue; }
      if (!(d.unexplained > 0)) fails.push(`${d.at}: the box a script recolours, with no animation, is not counted as unexplained`);
      if (d.unexplained > 12) fails.push(`${d.at}: ${d.unexplained} unexplained tiles; the recoloured box covers at most 12 (the canvas counts as unexplained?)`);
    }
    // The canvas sits at 32, 32, 576 × 192 at 1024 px.
    const regions = a.drawing.flatMap((d) => d.regions);
    if (!regions.length) fails.push('no moving regions reported');
    else if (regions.filter(([x, y, w, h]) => x + w <= 32 || x >= 608 || y + h <= 32 || y >= 224).some(([x, , w]) => x < 32 || x + w > 128)) fails.push(`a moving region lies off the canvas and off the recoloured box: ${JSON.stringify(regions)}`);
    // The two runs: anything over the canvas is a note; the rest must match.
    const notes = [];
    const d = compare(A, B, 'canvas', notes);
    if (d.length) fails.push(`one worker against two: ${d.length} difference(s): ${d.join('; ')}`);
    if (moving && spill && still) {
      const without = (r, it) => ({ ...r, issues: r.issues.filter((i) => i.fingerprint !== it.fingerprint) });
      const swap = (r, it, ch) => ({ ...r, issues: r.issues.map((i) => (i.fingerprint === it.fingerprint ? { ...i, ...ch } : i)) });
      const n1 = [];
      if (compare(a, without(a, moving), 'c', n1).some((x) => x.includes(moving.fingerprint)) || !n1.some((x) => x.includes(moving.fingerprint))) fails.push('a finding over a moving background missing from one run is not a note');
      const n2 = [];
      if (compare(a, swap(a, moving, { severity: 'warning', message: 'other' }), 'c', n2).some((x) => x.includes(moving.fingerprint)) || n2.filter((x) => x.includes(moving.fingerprint)).length !== 2) fails.push('a change in a finding over a moving background is not a note');
      if (!compare(a, without(a, spill), 'c').some((x) => x.includes(spill.fingerprint) && x.includes('only in the first run'))) fails.push('the overflow finding missing from one run does not fail parity');
      if (!compare(a, swap(a, spill, { severity: 'warning' }), 'c').some((x) => x.includes(spill.fingerprint) && x.includes('severity'))) fails.push("the overflow finding's severity changing does not fail parity");
      if (!compare(a, without(a, still), 'c').some((x) => x.includes(still.fingerprint))) fails.push('the contrast finding over the still box missing from one run does not fail parity');
    }
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : 'Moving background: passes.');
  process.exit(fails.length ? 1 : 0);
}
