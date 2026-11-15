# Baseline: neptune-fork

- Page: https://atishaypahadiya.github.io/neptune-fork/
- Run: 15 November 2026, Chromium 159 and WebKit 27.2 on macOS, no system file (distinct-value mode). Firefox did not start on this machine (see "Engines").
- Command: `node inspector/inspect.js https://atishaypahadiya.github.io/neptune-fork/ --out dist/baselines/neptune-fork` (the default four widths: 320, 768, 1440 and 1920 px). The counts across the sweep below come from an earlier `--full` run on the same day.
- Full report and crops: `dist/baselines/neptune-fork/report.html` (not committed).
- Result: 0 errors, 17 warnings, 2 info. 315 visible elements, 234 with text. 2 graphics and 21 figure parts were skipped (the plates are svg figures).

## Earlier measurements, checked

| Earlier | Measured | Verdict |
|---|---|---|
| About 12 font sizes | 6 in the HTML text at any one width (320 and 1440 px alike): 14 and 15 px fixed, plus four fluid ranges. Across the full sweep the fluid ranges produce 48 distinct values. The svg plates add 12.5, 13, 14 and 19 px, which the inspector lists but does not judge. | Corrected. The count depends on the width and on whether svg text is included; the real issue is that most sizes are fluid. |
| About 25 spacing values | 22 to 24 at any one width; 18 fixed values plus 7 fluid groups; 68 across the full sweep. | Confirmed per width. |
| An Arial fallback renders somewhere | Confirmed, in the form controls rather than the text. The plate's Play button (`#plate-iii > div > div > button`) and its range slider (`#plate-iii > div > div > label > input`) compute to Arial at 13.3333 px, Chromium's default control font, because the stylesheet does not set `font: inherit` on controls. Neither holds visible text, so a check of rendered glyphs alone missed it; the inspector now compares each control's computed family with the page's. Every text run, including the 200 svg labels, renders in Source Serif 4 or GFS Didot. | Confirmed (finding `font-fallback`, crops `i018-1.png`, `i018-2.png`). |

## Top findings

Crops are in `dist/baselines/neptune-fork/crops/`.

1. **Form controls in Arial** (`font-fallback`, warning). As above. Crops: `i018-1.png`, `i018-2.png`.
2. **Text ignores the browser's text size** (`text-resize`, warning). With the default font size doubled, all 234 text elements keep their size, so the type is set in px or vw only. Browser zoom still works, but the reader's text-size preference does not (TYP-03). Crops: `i019-1.png` to `i019-3.png`.
3. **Fluid type lands between sizes at almost every width** (`type-scale`). Body text (82 elements) scales from 16.5 to 18 px, section headings (8) from 30 to 42 px, pull quotes (3) from 17.49 to 19.08 px, and the plate year from 64 to 104 px. Declaring these as fluid steps in a system file would make them legitimate. Crops: `i013-1.png`, `i016-1.png`, `i014-1.png`, `i015-1.png`, `i017-1.png`.
4. **Spacing set in em follows the fluid type into fractions** (`spacing-scale`). Paragraph margins 16.5 to 18 px, list margins 11.55 to 12.6 px, section-number gaps 6.6 to 7.2 px, blockquote indents 26.4 to 28.8 px, and the plate side panels' padding 16 to 56 px. Crops: `i003-1.png`, `i010-1.png`, `i004-1.png`, `i006-1.png`, `i012-1.png`.
5. **Button borders at fractional positions** (`hairline-subpixel`, info). The Copy buttons' 1 px borders sit at positions such as 239.94 px. Chromium and WebKit both snap them to whole pixels (every sample crisp), so they render correctly. The Play button's border is too faint against its background to measure.

## Engines

WebKit found the same layout findings as Chromium at all four widths. Firefox was not run: Playwright's Firefox 159 build exits at launch on this machine with "Could not find profile folder", including with an explicit profile directory.

## What it does not show

- No contrast, overflow, clipping, overlap, target-size, near-miss or radius findings. The near-miss result was checked by hand: with every filter removed, the page has no pair of left edges 0.5 to 3 px apart within 96 px.
- The svg plates are not judged: 148 labels at 12.5 px and others at 13, 14 and 19 px.

## 0.2: typography, motion, weight and rem

- Run: 15 November 2026, inspector at commit `56ba1e2`, Chromium 159 and WebKit 27.2 on macOS. The pinned site (neptune-fork commit `7162121`, folder `site/`) was served locally and inspected against neptune-fork's own `itten.system.json`, so this run is in system mode, unlike the one above.
- Commands: `node inspector/inspect.js http://127.0.0.1:8791/ --system ../neptune-fork/itten.system.json --out dist/runs/2026-11-15/neptune-fork-main`, and the same for `/adams-challis/` into `dist/runs/2026-11-15/neptune-fork-adams-challis` (default four widths). Reports and crops are in those folders (not committed); the runs used to calibrate the checks are beside them, in the folders ending `.calibration`.
- Result: main page 0 errors, 16 warnings, 28 info; Adams–Challis page 0 errors, 12 warnings, 23 info.

Every finding from the 0.2 checks was looked at in its crop or rendered again at its width, and is confirmed below unless it says otherwise.

| Check | Main | Adams–Challis | Verdict |
|---|---|---|---|
| `rag` | 12 warnings | 10 warnings | Confirmed. All at 320 px, where the measure is about 34 characters and the site sets no `hyphens`. Lines stop 26 to 70% short; with `hyphens: auto` the deepest hole would be 8 to 21%. Rendered with and without: `neptune-fork-adams-challis/extra/rag-before.png` and `rag-after.png`. One cause, one fix: `hyphens: auto` on body text, at least at phone widths. |
| `widow` | 1 warning | none | Confirmed. "pre-registered." alone under eight lines in the Plate II caption, from 768 px up. Crop: `neptune-fork-main/crops/i040-1.png`. |
| `type-scale` (weight) | 2 warnings | 2 warnings | Confirmed. The h3 headings are "the body step, bold", as the stylesheet says: 18 px (17 px at 320 px) at weight 600, on 7 and 8 headings. The system's steps at those sizes are body and body-phone at weight 400, so no step matches. Matched on size alone, as before, they passed as body. Add bold h3 steps to the system, or log them as an override. Crop: `neptune-fork-main/crops/i043-1.png`. |
| `optical-margin` | 1 info | 5 info | Confirmed but marginal. The 42 px GFS Didot headings start 1 px inside the edge of the text below; at 400% the S and A do sit a hair in. |
| `text-wrap-balance` | 5 info | 5 info | Confirmed by sample: two-line h3s at 320 px whose second line is a quarter of the first. |
| `text-wrap-pretty` | 20 info | 13 info | Checked by sample, not one by one. |
| `spacing-unit` | none | none | Spacing is written in rem, as the system's note says. |
| Motion | none | none | No animation runs after load. Tabbing reaches 40 and 23 focus stops; their focus styles start 120 and 80 transitions, all 160 ms with `ease`, from the system. Three buttons were clicked on the main page. Nothing moves under Reduce Motion. Frames held 16.7 ms while tabbing, clicking and scrolling, at full speed and with the CPU slowed 4×, apart from one 133 ms frame while tabbing at full speed. |

The one `spacing-scale` warning on the main page is the fluid side padding (`--gutter`, 16 to 56 px), logged in neptune-fork's overrides. With 0.2 it can be declared in the system instead, as a `spacing.fluid` range.

Running 0.2 on this site first found three false positives, each fixed in the inspector and kept as a case on the fixture pages:

- the plates draw their svg again on every resize, with path ids from a counter (`arc-3`, then `arc-15`), which read as late content;
- references ending on a DOI read as widows;
- a 1 px optical offset was a warning; it is now info, and 2 px or more is a warning.
