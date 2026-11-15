// Writes index.html (the test print), clean.html (its clean twin) and
// defects.json from the table below, so the three never drift apart.
// Usage: node fixtures/make.js
// Each row: id, check, title, what is planted, what the twin does instead,
// the specimen markup, the planted CSS (index.html only), and optional extra
// fields for defects.json. Where the defect is in a script rather than in
// CSS, the markup is a function of clean (true for the twin) and the CSS is
// empty. A defect with a resource is also matched by a finding that names
// that file.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// A no-break space before the last word of each paragraph, so its last line
// can never hold one word alone. The clean twins set all their copy this way,
// and the specimens in TIE, whose last line came out short (two words or
// fewer, or under a third of the measure) at some width from 320 to 1920 px
// in Chromium or WebKit. Line breaks differ a little between platforms, and
// a widow that appears on one and not another is luck, not a fixed defect.
// d23's specimens are left alone: they are the cases the widow check must
// not report.
const tie = (html) => html.replace(/ ([^\s<>]+)(?=<\/(?:p|figcaption|td)>|$)/g, '&nbsp;$1');
const TIE = new Set(['d16', 'd22', 'd25', 'd27', 'd29', 'd30', 'd46']);
const specimen = (s, clean) => { const m = typeof s[5] === 'function' ? s[5](clean) : s[5]; return clean && TIE.has(s[0]) ? tie(m) : m; };
const S = [
  ['d01', 'spacing-scale', 'Spacing off the scale', 'Planted: 13 px padding above and below the text. The scale has 12 and 16.', 'The padding is 12 px above and below, from the scale.', `<div class="tint d01">A padded box</div>`, `.d01 { padding: 0.8125rem 1rem; }`],
  ['d02', 'type-scale', 'Compounded type size', 'Planted: 0.875em inside a 0.875rem parent, which renders at 12.25 px.', 'The note is set in rem, so it renders at 14 px, a step of the scale.', `<div class="d02"><p class="note">Small print in a smaller box.</p></div>`, `.d02 .note { font-size: 0.875em; line-height: 20px; }`],
  ['d03', 'near-miss-edge', 'Near-miss edge', 'Planted: the next line starts 2 px to the right of the text above it.', 'The next line shares the left edge of the text above it.', `<p class="d03">This line should share the left edge.</p>`, `.d03 { position: relative; left: 2px; }`],
  ['d04', 'sibling-gaps', 'Unequal sibling gaps', 'Planted: the third item has an extra 8 px top margin, so the gaps run 8, 16, 8.', 'All four items are 8 px apart.', `<ul class="list"><li>First item</li><li>Second item</li><li>Third item</li><li>Fourth item</li></ul>`, `.list li:nth-child(3) { margin-top: 0.5rem; }`],
  ['d05', 'radius', 'Radius off the set', 'Planted: a 6 px radius. The set is 4 and 12.', 'A 4 px radius, from the set.', `<div class="tint d05">A rounded box</div>`, `.d05 { border-radius: 6px; }`],
  ['d06', 'radius-concentric', 'Non-concentric corners', 'Planted: the inner box keeps the outer 12 px radius inside a 4 px inset; concentric is 8 px.', 'The inner radius is 12 minus 4, so 8 px.', `<div class="outer"><div class="inner">A nested box</div></div>`, `.inner { border-radius: 12px; }`],
  ['d07', 'font-fallback', 'Font fallback', 'Planted: the first family points at a file that does not exist, so the text falls back to a platform font.', 'The text is set in the loaded web font.', `<p class="d07">This text should be in a web font.</p>`, `@font-face { font-family: "Fixture Missing"; src: url("missing-font.woff2") format("woff2"); }\n.d07 { font-family: "Fixture Missing", sans-serif; }`],
  ['d08', 'contrast', 'Contrast against rendered pixels', 'Planted: white text over a light raster image. Its computed background is transparent, so only the rendered pixels show the problem.', 'Dark text over the same light raster image.', `<div class="photo"><canvas width="720" height="96" aria-hidden="true"></canvas><p>Text over an image</p></div>`, `.photo p { color: #FFFFFF; }`],
  ['d09', 'target-size', 'Target size', 'Planted: two 18 px icon buttons 4 px apart.', 'Two 44 px icon buttons 8 px apart.', `<div class="tools"><button type="button" aria-label="Add"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button><button type="button" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button></div>`, `.tools { gap: 0.25rem; }\n.tools button { width: 18px; height: 18px; }\n.tools svg { width: 10px; height: 10px; }`],
  ['d10', 'overflow', 'Page overflow at a narrow width', 'Planted: a box with a 336 px minimum width. At 320 px the page scrolls sideways; from 360 px it fits.', 'The box is never wider than its column.', `<div class="tint banner">A wide box</div>`, `.banner { min-width: 336px; }`],
  ['d11', 'overflow', 'Text spilling out of its box', 'Planted: a long word that cannot break, in a 96 px box.', 'The box is as wide as the word, and never wider than its column; overflow-wrap: anywhere stays as the last resort, and is not needed.', `<div class="tag">Uncompromisingly</div>`, `.tag { width: 96px; overflow-wrap: normal; }`],
  ['d12', 'clipping', 'Clipping at 200% text', 'Planted: a fixed 40 px height with overflow hidden. The text fits at the default text size and is cut off when the browser text size is doubled.', 'A 40 px minimum height, so the box grows with the text.', `<div class="fixed">Fits at 100%</div>`, `.fixed { height: 40px; overflow: hidden; }`],
  ['d13', 'overlap', 'Overlapping text', 'Planted: a caption positioned 8 px down, over the line above it.', 'The caption sits below the line, 8 px apart.', `<div class="stack"><p>A line of text</p><p class="caption">A caption</p></div>`, `.caption { position: absolute; top: 8px; left: 0; }`],
  ['d15', 'font-fallback', 'Form control font', 'Planted: an empty text field left with the browser\'s own control font.', 'The field inherits the page font.', `<input type="text" aria-label="An empty field">`, `#d15 input { font: revert; }`],
  ['d14', 'hairline-subpixel', 'Hairline off the pixel grid', 'Planted: a 1 px rule moved down half a pixel.', 'The rule sits on a whole pixel.', `<div class="rule"></div>`, `.rule { transform: translateY(0.5px); }`],
  ['d16', 'type-scale', 'Undeclared fluid size', 'Planted: a lead paragraph set with clamp() from 16 to 18 px, a range the system does not declare. The h1 on both pages is fluid too, but declared, so it must not be reported.', 'The lead is set at 16 px.', `<p class="lead">A lead paragraph that grows with the window.</p>`, `#d16 .lead { font-size: clamp(1rem, 0.875rem + 0.625vw, 1.125rem); line-height: 24px; }`],
  ['d17', 'text-resize', 'Text locked in px', 'Planted: a caption set at 14px, which stays 14 px when the reader doubles the browser text size.', 'The caption is set at 0.875rem, so it follows the setting.', `<p class="fine-print">Set in pixels, deaf to the reader.</p>`, `#d17 .fine-print { font-size: 14px; }`],
  ['d18', 'type-scale', 'Two steps at one size', 'Planted: a label at the body size with a 22 px line height. The system has two 16 px steps, body at 24 px and label at 20 px, so it fits neither.', 'The label is set 16/20 at weight 600, the label step. It shares its size with the body step, so it must be matched by its line height as well.', `<p class="label">A label at the body size, set tighter</p>`, `#d18 .label { line-height: 1.375rem; }`],
  ['d19', 'page-load', 'Failed request', 'Planted: the figure draws from d19-missing.json, which does not exist. The page catches the 404 and shows a message in its place, so no script error is raised.', 'The figure draws from d19-data.json, which exists.', (clean) => `<div class="d19-figure"></div>
    <script>
      fetch('${clean ? 'd19-data.json' : 'd19-missing.json'}').then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((d) => { document.querySelector('.d19-figure').innerHTML = '<p>' + d.label + '</p>'; })
        .catch((e) => { document.querySelector('.d19-figure').innerHTML = '<p>This figure could not be drawn: ' + e.message + '</p>'; });
    </script>`, '', { resource: 'd19-missing.json' }],
  ['d20', 'page-load', 'Drawn after measuring', 'Planted: the figure draws 2.5 s after the load event, by which time the inspector has begun measuring.', 'The figure draws as the page is read, before the load event.', (clean) => `<div class="d20-figure"></div>
    <script>
      ${clean ? "document.querySelector('.d20-figure').innerHTML = '<p>Drawn as the page is read</p>';" : "addEventListener('load', () => setTimeout(() => { document.querySelector('.d20-figure').innerHTML = '<p>Drawn 2.5 s after load</p>'; }, 2500));"}
    </script>
    <svg class="d20-chart" width="96" height="24" aria-hidden="true"></svg>
    <script>
      // On both pages: a chart drawn again on every resize, with ids from a counter. Not late.
      let d20n = 0;
      const d20draw = () => { document.querySelector('#d20 .d20-chart').innerHTML = '<path id="d20-arc-' + (d20n++) + '" d="M0 20 Q48 0 96 20" fill="none" stroke="currentColor"/>'; };
      d20draw(); addEventListener('resize', d20draw);
    </script>`, ''],
  ['d23', 'widow', 'Widow', 'Planted: a narrower measure, 220 px, leaves the last word alone, and text-wrap: pretty cannot move it.', 'At 288 px the note sets on one line.', `<p class="note">Short notes end on one word sometimes.</p>
    <p class="note ref">Data set, version 1.0.1, Zenodo. doi:10.5281/zenodo.24158992</p>
    <p class="note ref">A chapter in an edited book on the discovery of the planet, with its preprint: arXiv:2108.06305</p>
    <p class="note ref">The figures are built from notes in the repository, each named for its step: docs/notes/P1B_challis_detection.json</p>
    <ul class="list refs"><li><span>Brookes</span>, C. J. 1970.</li><li><span>Bouvard</span>, A. 1821.</li></ul>
    <p class="narrow">Post to the neighbourhood feed</p>`, `#d23 .note:not(.ref) { max-width: 220px; }`],
  ['d24', 'orphan', 'Orphan across columns', 'Planted: orphans and widows of 1, so the second paragraph leaves one line at the foot of the first column.', 'Orphans and widows of 2, the default, so the second paragraph breaks two lines and three.', `<div class="cols"><p>The first paragraph runs to four lines in its column here.</p><p>The second runs on longer, and breaks across the two columns of the box below the first.</p></div>`, `#d24 .cols p { orphans: 1; widows: 1; }`],
  ['d25', 'rag', 'Hole in the rag', 'Planted: hyphenation is off, so a long word leaves a line far short of the measure.', 'hyphens: auto, as on every paragraph, fills the line.', `<p class="measure">Our correspondents were uncompromisingly incomprehensible about telecommunications infrastructure and its characteristically unpredictable upkeep and its maintenance.</p>`, `#d25 .measure { hyphens: manual; }`],
  ['d26', 'text-wrap-balance', 'Unbalanced heading', 'Planted: text-wrap is plain wrap, so the heading leaves a short second line.', 'text-wrap: balance, as on every heading, evens the two lines.', `<h3 class="measure">A heading that wraps onto a short second line</h3>`, `#d26 h3 { text-wrap: wrap; }`],
  ['d27', 'text-wrap-pretty', 'Plain wrapping', 'Planted: text-wrap is plain wrap, so the last line holds one word; text-wrap: pretty would bring a second word down.', 'text-wrap: pretty, as on every paragraph, closes on two words.', `<p class="measure">A paragraph of a few lines, set the plain way, can end on a last line far too short to sit beside the others.</p>`, `#d27 .measure { text-wrap: wrap; }`],
  ['d28', 'hyphenation', 'Justified without hyphenation', 'Planted: justified text in a narrow measure with hyphenation off, so the word spaces stretch.', 'The same text with hyphens: auto, as on every paragraph.', `<p class="measure justified">Justification spreads the words across the measure, and without hyphenation the narrow column opens wide rivers between them.</p>`, `#d28 .justified { hyphens: manual; }`],
  ['d29', 'hanging-punctuation', 'Punctuation that should hang', 'Planted: the opening quote sits inside the text edge, though the system hangs punctuation.', 'A negative text-indent pulls the quote into the margin.', `<p class="quote">“Quotation marks hang outside the text edge,” the system says, so the letters align.</p>`, `#d29 .quote { text-indent: 0; }`],
  ['d30', 'optical-margin', 'Optical edge of display type', 'Planted: the large O sits on the box edge, so its ink starts inside the edge of the text below.', 'The line is pulled left until the ink of the O meets the text edge, an optical adjustment.', `<p class="hero" data-itten-ignore="near-miss-edge">Orbit</p>
    <p>Hold the edge of this line against the round letter above.</p>`, `#d30 .hero { text-indent: 0; }`],
  ['d31', 'motion-timing', 'Duration off the system', 'Planted: the hover transition runs 350 ms. The system has 100, 250 and 1000 ms.', 'The transition runs 250 ms with the standard easing, both from the system.', `<div class="tint lift">Hover to lift</div>
    <div class="tint reveal">Dimmed, then restored</div>
    <script>
      // On both pages: a 250 ms transition reversed after 150 ms, which the browser shortens. Not off the system.
      requestAnimationFrame(() => requestAnimationFrame(() => { const r = document.querySelector('#d31 .reveal'); r.classList.add('dim'); setTimeout(() => r.classList.remove('dim'), 150); }));
    </script>`, `#d31 .lift { transition-duration: 350ms; }`],
  ['d32', 'reduced-motion', 'Motion under Reduce Motion', 'Planted: the pulse keeps looping when the reader asks for reduced motion.', 'The pulse stops under prefers-reduced-motion: reduce, as every animation on the page does.', `<div class="pulse" aria-hidden="true"></div>`, `@media (prefers-reduced-motion: reduce) { #d32 .pulse { animation: pulse 1000ms linear infinite alternate !important; } }`],
  ['d33', 'motion-layout', 'Animated width', 'Planted: the hover transition animates width, so the page is laid out again on every frame.', 'The same growth as a scale transform.', `<div class="tint grow">Hover to widen</div>`, `#d33 .grow { transition-property: width; }\n#d33 .grow:hover { transform: none; width: 176px; }`],
  ['d34', 'frame-timing', 'Dropped frames while scrolling', 'Planted: the box\'s scroll handler holds the main thread for 80 ms each time it fires.', 'The box has no scroll handler.', (clean) => `<div class="scroller" tabindex="0" aria-label="A scrolling box"><div class="scroller-content"></div></div>${clean ? '' : `
    <script>
      document.querySelector('#d34 .scroller').addEventListener('scroll', () => { const t = performance.now(); while (performance.now() - t < 80) { /* busy */ } });
    </script>`}`, ''],
  ['d35', 'flash', 'Flashing', 'Planted: the panel alternates dark and light every 100 ms, five flashes a second over its whole area.', 'The panel alternates once a second.', `<div class="strobe" aria-hidden="true"></div>`, `#d35 .strobe { animation-duration: 100ms; }`],
  ['d36', 'type-scale', 'Matched on weight', 'Planted: regular text set at 16/20, the line height of the bold label step. Matched on size alone it passes as a label; at weight 400 it is body text, whose step sets 24.', 'The text keeps the body step\'s 24 px line height. Its bold run takes the paragraph\'s step on both pages.', `<p class="tight">Regular text with a <strong>bold run</strong>.</p>`, `#d36 .tight { line-height: 1.25rem; }`],
  ['d37', 'type-scale', 'Weight off the steps', 'Planted: 16 px text at weight 500. The steps at 16 px are body at 400 and label at 600.', 'The text is set at weight 400, the body step.', `<p class="medium">A weight no step has.</p>`, `#d37 .medium { font-weight: 500; }`],
  ['d38', 'type-scale', 'Family of another role', 'Planted: the pull quote is set in the text family. The quote step, 24/32 at weight 400, is set in the display family.', 'The pull quote is set in the display family, as its step says.', `<p class="pull">A pull quote</p>`, `#d38 .pull { font-family: "Atkinson Hyperlegible Next", sans-serif; }`],
  ['d39', 'spacing-unit', 'Spacing in px', 'Planted: the box\'s padding is written as 12px 16px. At the default text size it matches the rem padding of every other box; at 200% text it stays put while the text doubles.', 'The padding is 0.75rem 1rem, as everywhere else on the page.', `<div class="tint">Padding in rem</div>`, `#d39 .tint { padding: 12px 16px; }`],
  ['d40', 'spacing-scale', 'Fluid spacing off its range', 'Planted: side padding from clamp(1rem, 5vw, 3rem). The system declares a fluid range from 16 px at 320 px wide to 48 px at 1120 px, which is clamp(1rem, 0.2rem + 4vw, 3rem); 5vw runs ahead of it between those widths.', 'The side padding follows the declared range.', `<div class="tint fluid-pad">Fluid side padding</div>`, `#d40 .fluid-pad { padding-inline: clamp(1rem, 5vw, 3rem); }`],
  ['d41', 'frame-timing', 'Long frames on the reference device', 'Planted: the box\'s scroll handler does a fixed amount of work, 200 rounds of the two loops the benchmark index times, about 140 ms on the reference device (benchmark index 400) and a fraction of that on a fast machine at full speed. The inspector slows the CPU to the reference device, so the frames run long there on any machine.', 'The box has no scroll handler.', (clean) => `<div class="scroller" tabindex="0" aria-label="A second scrolling box"><div class="scroller-content"></div></div>${clean ? '' : `
    <script>
      // Each round builds a 10,000-character string and copies a 100,000-item array, as the benchmark index does.
      { const a = Array.from({ length: 100000 }, (_, i) => i), b = new Array(100000).fill(0); let d41 = 0;
        document.querySelector('#d41 .scroller').addEventListener('scroll', () => {
          for (let k = 0; k < 200; k++) { let s = ''; for (let j = 0; j < 10000; j++) s += 'a'; d41 += s.length; for (let j = 0; j < 100000; j++) b[j] = a[j]; }
        }); }
    </script>`}`, ''],
  ['d42', 'motion-timing', 'Motion started by focus', 'Planted: the focus ring transition runs 400 ms. Only the keyboard starts it: a mouse click does not match :focus-visible, and hovering does nothing.', 'The focus ring transition runs 250 ms, from the system.', `<button type="button" class="ring">Focus ring</button>`, `#d42 .ring { transition-duration: 400ms; }`],
  ['d43', 'motion-layout', 'Motion started by a click', 'Planted: pressing the toggle animates margin-left, so the page is laid out again on every frame.', 'The toggle moves with a transform.', (clean) => `<button type="button" class="toggle" aria-pressed="false">Toggle</button>
    <script>
      { const b = document.querySelector('#d43 .toggle'); b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))); }
    </script>${clean ? '' : `
    <style>#d43 .toggle { transition-property: margin-left; } #d43 .toggle[aria-pressed="true"] { transform: none; margin-left: 0.5rem; }</style>`}`, ''],
  ['d44', 'broken-word', 'Words broken without a hyphen', 'Planted: the table is laid out fixed, its first column 72 px wide, with overflow-wrap: break-word, so names longer than the column break mid-word without a hyphen ("Bouvar|d\'s", "Verrier\'|s"). Seen on a real site in WebKit, where an automatic table layout let break-word narrow the column the same way.', 'The table is laid out automatically without break-word, so the first column is as wide as its longest word.', `<table class="data"><tbody><tr><td class="name">Bouvard\'s tables</td><td>1821</td></tr><tr><td class="name">Le Verrier\'s orbit</td><td>1846</td></tr></tbody></table>`, `#d44 .data { table-layout: fixed; width: 160px; }\n#d44 .data .name { width: 72px; overflow-wrap: break-word; }`],
  ['d45', 'spacing-scale', 'Spacing in a table in a figure', 'Planted: the table\'s cells are padded 5 px above and below. The scale has 4 and 8. A figure\'s table is text, measured like the rest of the page.', 'The cells are padded 4 px above and below, from the scale.', `<figure><table class="data"><tbody><tr><td>Bouvard</td><td>1821</td></tr><tr><td>Le Verrier</td><td>1846</td></tr></tbody></table><figcaption class="small">Table 1. Two tables of Uranus.</figcaption></figure>`, `#d45 .data td { padding: 0.3125rem 0.5rem; }`],
  ['d46', 'rag', 'Hole in the rag in a table cell', 'Planted: hyphenation is off in the note column of a table in a figure, so a long word leaves a line far short of the column. The column gives the note the same 240 px measure as d25.', 'hyphens: auto, as on the table\'s cells, fills the line.', `<figure><table class="data notes"><tbody><tr><td>1846</td></tr><tr><td>Our correspondents were uncompromisingly incomprehensible about the communications infrastructure and its notoriously unpredictable upkeep and maintenance.</td></tr></tbody></table><figcaption class="small">Table 2. A dated note.</figcaption></figure>`, `#d46 .notes td { hyphens: manual; }`],
];
// Distinct-value mode: the same idea, inspected without a system file.
// Nothing says which fluid values are deliberate, so each fluid range must
// be listed once, as info, for type and spacing alike, and counted as one
// value in the sweep totals. The twin sets each at one fixed size instead.
const D = [
  ['d21', 'type-scale', 'Fluid type without a system', 'Planted: a heading set with clamp() from 30 to 42 px between 750 and 1250 px wide. Without a system it must be listed once, as info.', 'The heading is set at 32 px.', `<p class="display">A fluid heading</p>`, `#d21 .display { font-size: clamp(1.875rem, 0.75rem + 2.4vw, 2.625rem); }`],
  ['d22', 'spacing-scale', 'Fluid spacing without a system', 'Planted: side padding from 16 to 56 px, 4vw rounded to whole pixels. Without a system it must be listed once, as info, as fluid type is.', 'The side padding is 24 px.', `<div class="tint gutter"><p>Side padding that grows with the window</p></div>`, `#d22 .gutter { padding: 0.75rem round(clamp(1rem, 4vw, 3.5rem), 1px); }`],
];
const distinctPage = (clean) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${clean ? 'Inspector test print without a system, clean twin' : 'Inspector test print without a system'}</title>
<link rel="stylesheet" href="fixture.css">
<style>
/* Shared by both pages. */
.display { font-size: 2rem; line-height: 3rem; font-weight: 600; }
.gutter { padding: 0.75rem 1.5rem; }
</style>${clean ? '' : `
<style id="planted">
${D.map((s) => `/* ${s[0]} ${s[1]} */\n${s[6]}`).join('\n')}
</style>`}
</head>
<body>
<main>
${D.map((s) => `  <section id="${s[0]}">
    <h2>${s[2]}</h2>
    <p class="small">${clean ? tie(s[4]) : s[3]}</p>
    ${specimen(s, clean)}
  </section>`).join('\n')}
</main>
</body>
</html>
`;
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
${S.filter((s) => s[6]).map((s) => `/* ${s[0]} ${s[1]} */\n${s[6]}`).join('\n')}
</style>`}
</head>
<body>
<main>
  <header>
    <h1>Inspector test print${clean ? ', clean twin' : ''}</h1>
    <p>${clean
      ? tie('The same page as the test print with every planted defect fixed. The inspector should report nothing here.')
      : 'Each section plants one defect for one inspector check. The clean twin, clean.html, is the same page with every defect fixed.'}</p>
    <figure>
      <svg viewBox="0 0 720 80" width="100%" height="80" role="img" aria-label="Five bars of different heights"><rect x="0" y="0" width="720" height="80" fill="none"/><g fill="currentColor"><rect x="0" y="50" width="137.3" height="30" rx="3"/><rect x="145.7" y="30" width="137.3" height="50" rx="5"/><rect x="291.4" y="10" width="137.3" height="70" rx="2"/></g><text x="440" y="40" font-size="13.7" fill="currentColor">svg text at 13.7</text></svg>
      <div class="diagram" role="img" aria-label="Three bars drawn with div elements"><span></span><span></span><span></span></div>
      <figcaption class="small">${(clean ? tie : String)('A figure. Its svg uses a 13.7 px text size and odd radii, and its div diagram uses fractional padding. The inspector measures the outer boxes and skips what is inside.')}</figcaption>
    </figure>
  </header>
${S.map((s) => `  <section id="${s[0]}">
    <h2>${s[2]}</h2>
    <p class="small">${clean ? tie(s[4]) : s[3]}</p>
    ${specimen(s, clean)}
  </section>`).join('\n')}
</main>
${canvasScript}
</body>
</html>
`;
const dir = dirname(fileURLToPath(import.meta.url)) + '/';
writeFileSync(dir + 'index.html', page(false));
writeFileSync(dir + 'distinct.html', distinctPage(false));
writeFileSync(dir + 'distinct-clean.html', distinctPage(true));
writeFileSync(dir + 'clean.html', page(true));
writeFileSync(dir + 'defects.json', JSON.stringify({
  page: 'fixtures/index.html', twin: 'fixtures/clean.html', system: 'fixtures/itten.system.json',
  note: 'Each defect is planted inside the section with its id. An inspector finding is a true positive when its check matches and it names an element inside that section, or the file given as the defect\'s resource.',
  defects: S.map((s) => ({ id: s[0], check: s[1], title: s[2], planted: s[3].replace(/^Planted: /, ''), ...(s[6] ? { css: s[6] } : { markup: s[5](false) }), fixedInTwin: s[4], ...(s[7] || {}) })),
  distinct: {
    page: 'fixtures/distinct.html', twin: 'fixtures/distinct-clean.html',
    note: 'Inspected without a system file. Each defect must be reported with the severity given. The page and its twin must give the same totals across the sweep, since each fluid range counts as one value, as the fixed size that replaces it does.',
    defects: D.map((s) => ({ id: s[0], check: s[1], title: s[2], planted: s[3].replace(/^Planted: /, ''), css: s[6], fixedInTwin: s[4], severity: 'info' })),
  },
}, null, 2) + '\n');
writeFileSync(dir + 'd19-data.json', JSON.stringify({ label: 'Drawn from d19-data.json' }) + '\n');
