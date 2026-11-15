# Fixtures

A test print for the inspector, in the way a 3D printer's calibration model exercises one known feature at a time.

- `index.html` plants one documented defect per section, each for one inspector check.
- `clean.html` is the same page with every defect fixed. The inspector should report nothing on it.
- `itten.system.json` is the system both pages are built to.
- `defects.json` lists the planted defects; `make.js` writes the two pages and `defects.json` from one table, so they cannot drift apart. Edit `make.js`, then run `node fixtures/make.js`.

Both pages also contain a figure with an svg and a div-drawn diagram that break the system on purpose (a 13.7 px svg text size, 3 px radii, 3.5 px padding). The inspector must skip the insides of graphics, so these must not be reported. The h1 on both pages is set with clamp() from 32 to 40 px, a fluid step the system declares, so it must not be reported either.

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

d10 only shows at 320 px wide, d12 and d17 only when the browser text size is doubled, and d14 only at a device pixel ratio of 1. They test that the sweep, the 200% text pass and the pixel-ratio pass each run.

## Run the test

```sh
node scripts/fixture-test.js          # four widths, about 40 seconds
node scripts/fixture-test.js --full   # 41 widths, about a minute
```

A finding is a true positive when its check matches a planted defect and it names an element inside that defect's section. Any other finding on the test print, and every finding on the clean twin, is a false positive. The test passes when every defect is caught and there are no false positives. It writes `dist/fixtures/result.json` and the two reports under `dist/fixtures/`.

Precision is true positives over all findings. Recall is defects caught over defects planted. On 15 November 2026, both the default four widths and the full sweep gave recall 17 of 17 and precision 21 of 21, with WebKit included. The 21 findings for 17 defects are expected: d03 is 2 px away from three neighbouring edges, d09's two buttons each fail, and d07 both fails to load and names a family outside the system.
