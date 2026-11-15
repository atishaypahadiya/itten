# Baseline: HundredLives

- Page: https://atishaypahadiya.github.io/HundredLives/
- Run: 15 November 2026, Chromium 159 (GPU rendering) and WebKit 27.2 on macOS, no system file (distinct-value mode). Firefox did not start on this machine (see "Engines").
- Command: `node inspector/inspect.js https://atishaypahadiya.github.io/HundredLives/ --out dist/baselines/hundredlives` (the default four widths: 320, 768, 1440 and 1920 px). The counts across the sweep below come from an earlier `--full` run on the same day.
- Full report and crops: `dist/baselines/hundredlives/report.html` (not committed).
- Result: 14 errors, 8 warnings, 7 info. 399 visible elements, 249 with text. 2 graphics (the WebGL valley canvas and an svg) and 7 figure parts were skipped.

## Earlier measurements, checked

| Earlier | Measured | Verdict |
|---|---|---|
| 18 font sizes | 15 at most at any one width (12 at 320 px). 14 fixed sizes (11.5, 12, 12.6, 13.44, 13.5, 14, 15, 16, 17, 19, 20, 21, 23, 28 px) plus two fluid ranges (headings 28 to 38 px, the hero line 28 to 70 px). 41 distinct values across the full sweep. svg chart text adds 12.5 px, not judged. | Corrected to 15 per width. Four of the fixed sizes are fractional. |
| Mixed radii of 2, 3, 4 and 6 px | 3, 4 and 6 px on layout boxes (one, 44 and two elements). The 2 px radius exists in the source, but on a legend swatch inside `figure.chart`, which the inspector treats as a graphic, and as `rx="2"` inside an svg. | Confirmed, with 2 px located inside the chart. |
| Nav links lost against the snow | The four nav items measure 2.78 to 3.01:1 against the pixels behind them, white on a sky blue of about #589AD4. They fail 4.5:1 at every width and in both schemes. | Confirmed. The background under the links is mostly sky, with snow specks. |

## Top findings

Crops are in `dist/baselines/hundredlives/crops/`. The snow moves, so contrast ratios vary by a few hundredths between runs.

1. **Text over the WebGL valley fails contrast in twelve places** (`contrast`, error). The nav (`HundredLives`, Self, Runs, Source) at 2.78 to 3.01:1. The hero headline at 2.98:1 at 768 px, below its 3:1 large-text floor. "Scroll to enter the valley" at 3.21:1. The "week 1 of 52" counter over the green hillside at 2.40 to 2.95:1, where "1" fails even the 3:1 floor. The "Findings" and "How it works" anchors at 2.49 and 1.79:1 from 768 px up. Crops: `i018-1.png`, `i021-2.png`, `i022-1.png`, `i024-1.png`, `i028-1.png`.
2. **A table cell runs off the page at 320 px** (`overflow`, error). "partly: cap and total held, per-run range missed" runs 20 px past the viewport and 36 px out of its row, so the page scrolls sideways. Crops: `i003-1.png`, `i004-1.png`.
3. **Eleven glyphs fall back to the system font** (`font-fallback`, warning). Inter Tight, as served, lacks "↗", "≥" and others in 9 elements, so they render in the platform font (SF on macOS; something else on Windows). Crops: `i016-1.png`, `i016-2.png`.
4. **Text ignores the browser's text size** (`text-resize`, warning). All 249 text elements keep their size when the default font size is doubled (TYP-03). Crops: `i029-1.png` to `i029-3.png`.
5. **Compounded font sizes** (`type-scale`). 13.44 px on 16 inline code elements, 13.5 px on the code blocks, 12.6 px on one path, and 11.5 px on the week counter. Fractional sizes like these usually come from em or percentage multipliers. Crops: `i012-1.png`, `i013-1.png`, `i011-1.png`.
6. **Three close radii** (`radius`, warning): 3, 4 and 6 px. Crops: `i001-1.png` to `i001-3.png`.
7. **Hairlines at fractional positions** (`hairline-subpixel`, info). Table rows and cells, the experiment links, the reading list and the footer have 1 px borders at positions such as 11696.73 px. Chromium and WebKit both snap every sampled line to whole pixels, so they render crisp.
8. **Ten targets are under 44 px** (info): the nav links and the "Full results" links. All pass the 24 px floor or its spacing exception.

## Engines

WebKit found the same layout findings as Chromium at all four widths. A first WebKit run reported ten overlaps and five near-miss edges in the hero at 320 px. These were the story lines that fade in on scroll, measured while their opacity transitions were still running after the inspector's scroll-through. The inspector now waits for finite animations and transitions to finish before measuring in any engine, and the differences went away. Firefox was not run: Playwright's Firefox 159 build exits at launch on this machine with "Could not find profile folder".

## What was missed earlier

Earlier notes did not cover the counter, scroll hint, headline and anchor contrast failures, the 320 px overflow, the glyph fallback, the compounded code sizes or the px-locked text.

## How it was run

The page animates a WebGL scene. Chromium's default headless build renders WebGL in software, which slowed the page to about one frame every 8 seconds; the first run had not finished after ten minutes and was stopped. The inspector now launches the full Chromium build, which uses the GPU and ran the page at about 60 frames a second, and falls back to the default build if the full one is not installed.
