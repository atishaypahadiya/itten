// Writes index.html (the test print), clean.html (its clean twin) and
// defects.json from the table below, so the three never drift apart.
// Usage: node fixtures/make.js
// Each row: id, check, title, what is planted, what the twin does instead,
// the specimen markup, and the planted CSS (index.html only).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const S = [
  ['d01', 'spacing-scale', 'Spacing off the scale', 'Planted: 13 px padding above and below the text. The scale has 12 and 16.', 'The padding is 12 px above and below, from the scale.', `<div class="tint d01">A padded box</div>`, `.d01 { padding: 13px 16px; }`],
  ['d02', 'type-scale', 'Compounded type size', 'Planted: 0.875em inside a 0.875rem parent, which renders at 12.25 px.', 'The note is set in rem, so it renders at 14 px, a step of the scale.', `<div class="d02"><p class="note">Small print in a smaller box.</p></div>`, `.d02 .note { font-size: 0.875em; line-height: 20px; }`],
  ['d03', 'near-miss-edge', 'Near-miss edge', 'Planted: the next line starts 2 px to the right of the text above it.', 'The next line shares the left edge of the text above it.', `<p class="d03">This line should share the left edge.</p>`, `.d03 { position: relative; left: 2px; }`],
  ['d04', 'sibling-gaps', 'Unequal sibling gaps', 'Planted: the third item has an extra 8 px top margin, so the gaps run 8, 16, 8.', 'All four items are 8 px apart.', `<ul class="list"><li>First item</li><li>Second item</li><li>Third item</li><li>Fourth item</li></ul>`, `.list li:nth-child(3) { margin-top: 8px; }`],
  ['d05', 'radius', 'Radius off the set', 'Planted: a 6 px radius. The set is 4 and 12.', 'A 4 px radius, from the set.', `<div class="tint d05">A rounded box</div>`, `.d05 { border-radius: 6px; }`],
  ['d06', 'radius-concentric', 'Non-concentric corners', 'Planted: the inner box keeps the outer 12 px radius inside a 4 px inset; concentric is 8 px.', 'The inner radius is 12 minus 4, so 8 px.', `<div class="outer"><div class="inner">A nested box</div></div>`, `.inner { border-radius: 12px; }`],
  ['d07', 'font-fallback', 'Font fallback', 'Planted: the first family points at a file that does not exist, so the text falls back to a platform font.', 'The text is set in the loaded web font.', `<p class="d07">This text should be in a web font.</p>`, `@font-face { font-family: "Fixture Missing"; src: url("missing-font.woff2") format("woff2"); }\n.d07 { font-family: "Fixture Missing", sans-serif; }`],
  ['d08', 'contrast', 'Contrast against rendered pixels', 'Planted: white text over a light raster image. Its computed background is transparent, so only the rendered pixels show the problem.', 'Dark text over the same light raster image.', `<div class="photo"><canvas width="720" height="96" aria-hidden="true"></canvas><p>Text over an image</p></div>`, `.photo p { color: #FFFFFF; }`],
  ['d09', 'target-size', 'Target size', 'Planted: two 18 px icon buttons 4 px apart.', 'Two 44 px icon buttons 8 px apart.', `<div class="tools"><button type="button" aria-label="Add"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button><button type="button" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button></div>`, `.tools { gap: 4px; }\n.tools button { width: 18px; height: 18px; }\n.tools svg { width: 10px; height: 10px; }`],
  ['d10', 'overflow', 'Page overflow at a narrow width', 'Planted: a box with a 336 px minimum width. At 320 px the page scrolls sideways; from 360 px it fits.', 'The box is never wider than its column.', `<div class="tint banner">A wide box</div>`, `.banner { min-width: 336px; }`],
  ['d11', 'overflow', 'Text spilling out of its box', 'Planted: a long word that cannot break, in a 96 px box.', 'The long word is allowed to break.', `<div class="tag">Uncompromisingly</div>`, `.tag { overflow-wrap: normal; }`],
  ['d12', 'clipping', 'Clipping at 200% text', 'Planted: a fixed 40 px height with overflow hidden. The text fits at the default text size and is cut off when the browser text size is doubled.', 'A 40 px minimum height, so the box grows with the text.', `<div class="fixed">Fits at 100%</div>`, `.fixed { height: 40px; overflow: hidden; }`],
  ['d13', 'overlap', 'Overlapping text', 'Planted: a caption positioned 8 px down, over the line above it.', 'The caption sits below the line, 8 px apart.', `<div class="stack"><p>A line of text</p><p class="caption">A caption</p></div>`, `.caption { position: absolute; top: 8px; left: 0; }`],
  ['d15', 'font-fallback', 'Form control font', 'Planted: an empty text field left with the browser\'s own control font.', 'The field inherits the page font.', `<input type="text" aria-label="An empty field">`, `#d15 input { font: revert; }`],
  ['d14', 'hairline-subpixel', 'Hairline off the pixel grid', 'Planted: a 1 px rule moved down half a pixel.', 'The rule sits on a whole pixel.', `<div class="rule"></div>`, `.rule { transform: translateY(0.5px); }`],
  ['d16', 'type-scale', 'Undeclared fluid size', 'Planted: a lead paragraph set with clamp() from 16 to 18 px, a range the system does not declare. The h1 on both pages is fluid too, but declared, so it must not be reported.', 'The lead is set at 16 px.', `<p class="lead">A lead paragraph that grows with the window.</p>`, `#d16 .lead { font-size: clamp(1rem, 0.875rem + 0.625vw, 1.125rem); line-height: 24px; }`],
  ['d17', 'text-resize', 'Text locked in px', 'Planted: a caption set at 14px, which stays 14 px when the reader doubles the browser text size.', 'The caption is set at 0.875rem, so it follows the setting.', `<p class="fine-print">Set in pixels, deaf to the reader.</p>`, `#d17 .fine-print { font-size: 14px; }`],
  ['d18', 'type-scale', 'Two steps at one size', 'Planted: a label at the body size with a 22 px line height. The system has two 16 px steps, body at 24 px and label at 20 px, so it fits neither.', 'The label is set 16/20 at weight 600, the label step. It shares its size with the body step, so it must be matched by its line height as well.', `<p class="label">A label at the body size, set tighter</p>`, `#d18 .label { line-height: 1.375rem; }`],
];
const canvasScript = `<script>
  for (const c of document.querySelectorAll('.photo canvas')) {
    const g = c.getContext('2d'), img = g.createImageData(c.width, c.height);
    let s = 7;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) % 2147483648;
      const v = 226 + (s % 24);
      img.data[i] = v; img.data[i + 1] = v - 2; img.data[i + 2] = v - 6; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
</script>`;
const page = (clean) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${clean ? 'Inspector test print, clean twin' : 'Inspector test print'}</title>
<link rel="stylesheet" href="fixture.css">${clean ? '' : `
<style id="planted">
/* One planted defect per section. fixtures/defects.json lists them. */
${S.map((s) => `/* ${s[0]} ${s[1]} */\n${s[6]}`).join('\n')}
</style>`}
</head>
<body>
<main>
  <header>
    <h1>Inspector test print${clean ? ', clean twin' : ''}</h1>
    <p>${clean
      ? 'The same page as the test print with every planted defect fixed. The inspector should report nothing here.'
      : 'Each section plants one defect for one inspector check. The clean twin, clean.html, is the same page with every defect fixed.'}</p>
    <figure>
      <svg viewBox="0 0 720 80" width="100%" height="80" role="img" aria-label="Five bars of different heights"><rect x="0" y="0" width="720" height="80" fill="none"/><g fill="currentColor"><rect x="0" y="50" width="137.3" height="30" rx="3"/><rect x="145.7" y="30" width="137.3" height="50" rx="5"/><rect x="291.4" y="10" width="137.3" height="70" rx="2"/></g><text x="440" y="40" font-size="13.7" fill="currentColor">svg text at 13.7</text></svg>
      <div class="diagram" aria-hidden="true"><span></span><span></span><span></span></div>
      <figcaption class="small">A figure. Its svg uses a 13.7 px text size and odd radii, and its div diagram uses fractional padding. The inspector measures the outer boxes and skips what is inside.</figcaption>
    </figure>
  </header>
${S.map((s) => `  <section id="${s[0]}">
    <h2>${s[2]}</h2>
    <p class="small">${clean ? s[4] : s[3]}</p>
    ${s[5]}
  </section>`).join('\n')}
</main>
${canvasScript}
</body>
</html>
`;
const dir = dirname(fileURLToPath(import.meta.url)) + '/';
writeFileSync(dir + 'index.html', page(false));
writeFileSync(dir + 'clean.html', page(true));
writeFileSync(dir + 'defects.json', JSON.stringify({
  page: 'fixtures/index.html', twin: 'fixtures/clean.html', system: 'fixtures/itten.system.json',
  note: 'Each defect is planted inside the section with its id. An inspector finding is a true positive when its check matches and it names an element inside that section.',
  defects: S.map((s) => ({ id: s[0], check: s[1], title: s[2], planted: s[3].replace(/^Planted: /, ''), css: s[6], fixedInTwin: s[4] })),
}, null, 2) + '\n');
