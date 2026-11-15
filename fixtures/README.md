# Fixtures

A test print for the inspector, in the way a 3D printer's calibration model exercises one known feature at a time.

- `index.html` plants one documented defect per section, each for one inspector check.
- `clean.html` is the same page with every defect fixed. The inspector should report nothing on it.
- `itten.system.json` is the system both pages are built to.
- `defects.json` lists the planted defects; `make.js` writes the two pages and `defects.json` from one table, so they cannot drift apart. Edit `make.js`, then run `node fixtures/make.js`.

Both pages also contain a figure with an svg and a div-drawn diagram that break the system on purpose (a 13.7 px svg text size, 3 px radii, 3.5 px padding). The inspector must skip the insides of graphics, so these must not be reported. The h1 on both pages is set with clamp() from 32 to 40 px, a fluid step the system declares, so it must not be reported either. Every paragraph, list item and caption on both pages is set with `text-wrap: pretty` and `hyphens: auto`, and every heading with `text-wrap: balance`, as a careful build would be; d23 to d28 each take one of these away, or narrow the measure. Every animation and transition uses the system's durations and easings and stops under `prefers-reduced-motion: reduce`; d31 to d35 each break one of these. Every margin, padding and gap is written in rem, so it follows the text size, and the side padding in d40 follows the fluid range the system declares; d39 and d40 each break one of these. Widths stay in px.

In the clean twins, the last two words of every paragraph of copy are joined by a no-break space, and so are those of the specimens whose last line came out short at some width in Chromium or WebKit (d16, d22, d25, d27, d29, d30). Lines break a little differently on each platform: d25's specimen ended on one word on Linux and not on macOS. A widow that depends on the platform is luck, so the twins do not leave it to chance. d23's specimens are not joined, since they test what the widow check must not report.

Eight more things on both pages must not be reported; all but the last were found on real sites:

- in d20, a small chart drawn again on every resize, its path id taken from a counter, so the id differs each time it is drawn (not late content);
- in d23, a reference ending on a DOI alone on its last line (a citation ends on its link; not a widow);
- in d23, a reference ending on an arXiv id alone on its last line, and a note ending on a repository path (identifiers that cannot be reworded or hyphenated; not widows);
- in d23, two references whose names are set in a span, as a site does to keep them from being hyphenated (their text starts on the same x, so their left edges are not 0.5 to 3 px apart);
- in d23, a paragraph in a 104 px column without hyphenation, ending on one word (every line there is a fragment; not judged as a widow);
- in d31, a 250 ms transition reversed after 150 ms, which the browser runs for less than 250 ms (the declared duration is judged, not the shortened one);
- in d36, a bold run inside a regular paragraph (it takes the paragraph's step, so its weight is not judged).

## Planted defects

| ID | Check | Planted | In the clean twin |
|---|---|---|---|
| d01 | `spacing-scale` | 13 px padding above and below the text. The scale has 12 and 16. | The padding is 12 px above and below, from the scale. |
| d02 | `type-scale` | 0.875em inside a 0.875rem parent, which renders at 12.25 px. | The note is set in rem, so it renders at 14 px, a step of the scale. |
| d03 | `near-miss-edge` | the next line starts 2 px to the right of the text above it. | The next line shares the left edge of the text above it. |
| d04 | `sibling-gaps` | the third item has an extra 8 px top margin, so the gaps run 8, 16, 8. | All four items are 8 px apart. |
| d05 | `radius` | a 6 px radius. The set is 4 and 12. | A 4 px radius, from the set. |
| d06 | `radius-concentric` | the inner box keeps the outer 12 px radius inside a 4 px inset; concentric is 8 px. | The inner radius is 12 minus 4, so 8 px. |
| d07 | `font-fallback` | the first family points at a file that does not exist, so the text falls back to a platform font. | The text is set in the loaded web font. |
| d08 | `contrast` | white text over a light raster image. Its computed background is transparent, so only the rendered pixels show the problem. | Dark text over the same light raster image. |
| d09 | `target-size` | two 18 px icon buttons 4 px apart. | Two 44 px icon buttons 8 px apart. |
| d10 | `overflow` | a box with a 336 px minimum width. At 320 px the page scrolls sideways; from 360 px it fits. | The box is never wider than its column. |
| d11 | `overflow` | a long word that cannot break, in a 96 px box. | The long word is allowed to break. |
| d12 | `clipping` | a fixed 40 px height with overflow hidden. The text fits at the default text size and is cut off when the browser text size is doubled. | A 40 px minimum height, so the box grows with the text. |
| d13 | `overlap` | a caption positioned 8 px down, over the line above it. | The caption sits below the line, 8 px apart. |
| d15 | `font-fallback` | an empty text field left with the browser's own control font. | The field inherits the page font. |
| d14 | `hairline-subpixel` | a 1 px rule moved down half a pixel. | The rule sits on a whole pixel. |
| d16 | `type-scale` | a lead paragraph set with clamp() from 16 to 18 px, a range the system does not declare. The h1 on both pages is fluid too, but declared, so it must not be reported. | The lead is set at 16 px. |
| d17 | `text-resize` | a caption set at 14px, which stays 14 px when the reader doubles the browser text size. | The caption is set at 0.875rem, so it follows the setting. |
| d18 | `type-scale` | a label at the body size with a 22 px line height. The system has two 16 px steps, body at 24 px and label at 20 px, so it fits neither. | The label is set 16/20 at weight 600, the label step. It shares its size with the body step, so it must be matched by its line height as well. |
| d19 | `page-load` | the figure draws from d19-missing.json, which does not exist. The page catches the 404 and shows a message in its place, so no script error is raised. | The figure draws from d19-data.json, which exists. |
| d20 | `page-load` | the figure draws 2.5 s after the load event, by which time the inspector has begun measuring. | The figure draws as the page is read, before the load event. |
| d23 | `widow` | a narrower measure, 220 px, leaves the last word alone, and text-wrap: pretty cannot move it. | At 288 px the note sets on one line. |
| d24 | `orphan` | orphans and widows of 1, so the second paragraph leaves one line at the foot of the first column. | Orphans and widows of 2, the default, so the second paragraph breaks two lines and three. |
| d25 | `rag` | hyphenation is off, so a long word leaves a line far short of the measure. | hyphens: auto, as on every paragraph, fills the line. |
| d26 | `text-wrap-balance` | text-wrap is plain wrap, so the heading leaves a short second line. | text-wrap: balance, as on every heading, evens the two lines. |
| d27 | `text-wrap-pretty` | text-wrap is plain wrap, so the last line holds one word; text-wrap: pretty would bring a second word down. | text-wrap: pretty, as on every paragraph, closes on two words. |
| d28 | `hyphenation` | justified text in a narrow measure with hyphenation off, so the word spaces stretch. | The same text with hyphens: auto, as on every paragraph. |
| d29 | `hanging-punctuation` | the opening quote sits inside the text edge, though the system hangs punctuation. | A negative text-indent pulls the quote into the margin. |
| d30 | `optical-margin` | the large O sits on the box edge, so its ink starts inside the edge of the text below. | The line is pulled left until the ink of the O meets the text edge, an optical adjustment. |
| d31 | `motion-timing` | the hover transition runs 350 ms. The system has 100, 250 and 1000 ms. | The transition runs 250 ms with the standard easing, both from the system. |
| d32 | `reduced-motion` | the pulse keeps looping when the reader asks for reduced motion. | The pulse stops under prefers-reduced-motion: reduce, as every animation on the page does. |
| d33 | `motion-layout` | the hover transition animates width, so the page is laid out again on every frame. | The same growth as a scale transform. |
| d34 | `frame-timing` | the box's scroll handler holds the main thread for 80 ms each time it fires. | The box has no scroll handler. |
| d35 | `flash` | the panel alternates dark and light every 100 ms, five flashes a second over its whole area. | The panel alternates once a second. |
| d36 | `type-scale` | regular text set at 16/20, the line height of the bold label step. Matched on size alone it passes as a label; at weight 400 it is body text, whose step sets 24. | The text keeps the body step's 24 px line height. Its bold run takes the paragraph's step on both pages. |
| d37 | `type-scale` | 16 px text at weight 500. The steps at 16 px are body at 400 and label at 600. | The text is set at weight 400, the body step. |
| d38 | `type-scale` | the pull quote is set in the text family. The quote step, 24/32 at weight 400, is set in the display family. | The pull quote is set in the display family, as its step says. |
| d39 | `spacing-unit` | the box's padding is written as 12px 16px. At the default text size it matches the rem padding of every other box; at 200% text it stays put while the text doubles. | The padding is 0.75rem 1rem, as everywhere else on the page. |
| d40 | `spacing-scale` | side padding from clamp(1rem, 5vw, 3rem). The system declares a fluid range from 16 px at 320 px wide to 48 px at 1120 px, which is clamp(1rem, 0.2rem + 4vw, 3rem); 5vw runs ahead of it between those widths. | The side padding follows the declared range. |
| d41 | `frame-timing` | the box's scroll handler does a fixed amount of work, 200 rounds of the two loops the benchmark index times, about 140 ms on the reference device (benchmark index 400) and a fraction of that on a fast machine at full speed. The inspector slows the CPU to the reference device, so the frames run long there on any machine. | The box has no scroll handler. |
| d42 | `motion-timing` | the focus ring transition runs 400 ms. Only the keyboard starts it: a mouse click does not match :focus-visible, and hovering does nothing. | The focus ring transition runs 250 ms, from the system. |
| d43 | `motion-layout` | pressing the toggle animates margin-left, so the page is laid out again on every frame. | The toggle moves with a transform. |

## Without a system

`distinct.html` and `distinct-clean.html` are inspected the same way but with no system file, in distinct-value mode. Nothing then says which fluid values are deliberate, so each fluid range must be listed once, as info, for type and spacing alike. The twin sets each at one fixed size instead, so the two pages must also give the same totals across the sweep: a fluid range counts as one value, as the fixed size that replaces it does.

| ID | Check | Planted | In the clean twin |
|---|---|---|---|
| d21 | `type-scale` (info) | a heading set with clamp() from 30 to 42 px between 750 and 1250 px wide. | The heading is set at 32 px. |
| d22 | `spacing-scale` (info) | side padding from 16 to 56 px, 4vw rounded to whole pixels. | The side padding is 24 px. |

d10 only shows at 320 px wide, d12 and d17 only when the browser text size is doubled, and d14 only at a device pixel ratio of 1. They test that the sweep, the 200% text pass and the pixel-ratio pass each run.

## Run the test

```sh
node scripts/fixture-test.js          # four widths, about a minute
node scripts/fixture-test.js --full   # 41 widths, a minute or two
```

A finding is a true positive when its check matches a planted defect and it names an element inside that defect's section, or, for d19, the file the section requests: a failed request has no element. The failed-request finding also lists d07's missing font file, so one finding covers both. Any other finding on the test print, and every finding on the clean twin, is a false positive. The test passes when every defect is caught and there are no false positives. It writes `dist/fixtures/result.json` and the four reports under `dist/fixtures/`.

Precision is true positives over all findings. Recall is defects caught over defects planted. On 15 November 2026, both the default four widths and the full sweep gave recall 43 of 43 and precision 49 of 49, with WebKit included for the pair inspected against the system, and no findings on either clean twin. The 49 findings for 43 defects are expected: d03 is 2 px away from three neighbouring edges, d09's two buttons each fail, d07 both fails to load and names a family outside the system, d39's padding is reported once for each value, 12 px and 16 px, and d34's scroll handler stalls frames at full speed and on the reference device, one finding each. d07's missing font file is also listed in d19's failed-request finding, which is one finding.
