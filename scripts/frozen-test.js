// Frozen captures (0.5). fixtures/webgl.html draws a WebGL scene on every
// animation frame, its colour a function of how many frames have been drawn,
// with a line that spills out of its box over the scene. The page is
// inspected with Chromium drawing WebGL in software (SwiftShader), as on a
// machine without a GPU:
// - the run is complete, no step runs out of its limit, and every crop names
//   the frame it was held at (the document timeline's time and the number of
//   animation frames run);
// - inspected twice with the crops held at the same frame (atFrame), the
//   second time after waiting 2 s longer, the crop of the spilling line,
//   which shows the scene, is the same pixels;
// - the control: with freezing off (freeze: false), the same two runs give
//   different pixels in that crop, so the comparison above can fail.
// Usage: node scripts/frozen-test.js
// Exports run() for scripts/check.js; it returns the failures.

import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { start } from './serve.js';
import { inspect, loadSystem } from '../inspector/inspect.js';
import { findingsOf } from '../inspector/finding.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SOFTWARE = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
const AT = 24;

export async function run({ quiet = true } = {}) {
  const fails = [];
  const { system } = loadSystem(join(ROOT, 'fixtures', 'itten.system.json'));
  const port = 5175 + Math.floor(Math.random() * 500);
  const server = await start(port);
  const outOf = (name) => join(ROOT, 'dist', 'fixtures', `webgl-${name}`);
  try {
    const go = (name, extra) => inspect(`http://127.0.0.1:${port}/fixtures/webgl.html`, {
      system, systemPath: 'fixtures/itten.system.json', quiet, out: outOf(name),
      widths: [1024], keyWidths: [1024], engines: [], engineWidths: [], workers: 1, timings: false, aroundBreakpoints: false,
      passes: ['light', 'contrast'], launchArgs: SOFTWARE, ...extra,
    });
    const spillCrop = (r, name) => {
      const it = findingsOf(r).find((i) => i.fingerprint.startsWith('overflow|spill|') && i.elements.some((e) => e.label === 'p.narrow'));
      const c = it?.crops?.find((x) => !x.composited);
      return c ? { c, png: readFileSync(join(outOf(name), c.path)) } : null;
    };
    const runs = {};
    // The second run of each pair waits 2 s longer before it measures, so it reaches the capture many frames later.
    for (const [name, extra] of [['held-1', { atFrame: AT }], ['held-2', { atFrame: AT, settle: 2000 }], ['free-1', { freeze: false }], ['free-2', { freeze: false, settle: 2000 }]]) {
      const r = await go(name, extra);
      runs[name] = r;
      if (r.status !== 'complete') fails.push(`${name}: the run is ${r.status} (${r.reason ?? 'no reason'})`);
      const late = findingsOf(r).filter((i) => i.check === 'timed-out');
      if (late.length) fails.push(`${name}: ${late.length} step(s) ran out of their limit: ${late.map((i) => i.message.split('.')[0]).join('; ')}`);
      const crops = findingsOf(r).flatMap((i) => i.crops ?? []);
      if (!crops.length) fails.push(`${name}: no crops`);
      if (extra.freeze !== false) for (const c of crops) {
        if (!c.frame || typeof c.frame.time !== 'number' || !(c.frame.frames > 0)) fails.push(`${name}: crop ${c.path} names no frame (${JSON.stringify(c.frame)})`);
      }
      if (extra.atFrame) for (const c of crops.filter((x) => !x.composited)) if (c.frame?.frames !== AT) fails.push(`${name}: crop ${c.path} was held at frame ${c.frame?.frames}, not ${AT}`);
      if (!spillCrop(r, name)) fails.push(`${name}: no crop of the line that spills over the scene`);
    }
    const same = (a, b) => { const x = spillCrop(runs[a], a), y = spillCrop(runs[b], b); return x && y ? x.png.equals(y.png) : null; };
    if (same('held-1', 'held-2') === false) fails.push(`two crops held at frame ${AT} differ`);
    if (same('free-1', 'free-2') === true) fails.push('control: with freezing off, two runs gave the same crop, so the test cannot tell a held frame from a lucky one');
  } finally {
    server.close();
  }
  return fails;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fails = await run({ quiet: false });
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `${fails.length} failure(s).` : `Frozen captures: every crop names its frame, two held at frame ${AT} are identical, and two free ones differ.`);
  process.exit(fails.length ? 1 : 0);
}
