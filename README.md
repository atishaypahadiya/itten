# ITTEN

ITTEN is a detail discipline and an inspector. A project brings its own brief and inspiration. ITTEN turns the inspiration into measurements, holds the build to a closed system derived from them, and checks the rendered page up close: spacing and type off the scale, edges that nearly meet, unequal gaps, non-concentric corners, fonts that silently fall back, text that is unreadable against what is actually behind it, targets that are too small, and content that overflows, clips or overlaps at some width.

ITTEN ships no palette, typeface, curve, background or template, and nothing in it applies a value on its own.

If you are using ITTEN in a project, read [ITTEN.md](ITTEN.md).

## Folders

| Path | What it holds |
|---|---|
| `ITTEN.md` | The entry file for projects: the loop, precedence, install, overrides. |
| `protocol/` | The four steps: `01-teardown.md` (read inspiration as measurements), `02-system.md` (turn them into `itten.system.json`), `03-craft.md` (20 up-close rules, each with how it is verified), `04-inspect.md` (run the inspector and fix in order). |
| `schema/system.schema.json` | The schema for a project's `itten.system.json`. |
| `inspector/` | `inspect.js` and its parts. Opens a page in Chromium and measures it across widths, doubled text size, light and dark, and two pixel ratios, then checks the layout again in WebKit and Firefox. Writes `report.json`, `report.html` and zoomed crops. |
| `fixtures/` | A test print with one planted defect per inspector check, and its clean twin. |
| `reference/` | The rules corpus: 131 rules with IDs, strengths and evidence levels. The protocol cites it. |
| `library/` | Earlier research on fashion colourways, typefaces, icons and texture, with the font and icon files. Use any of it only when a project's brief asks for it. |
| `research/baselines/` | Inspector summaries of real pages, kept for comparison. |
| `scripts/` | `check.js`, `fixture-test.js`, `serve.js`, and a small JSON Schema validator in `lib/`. |

## Run it

Node 20 or later.

```sh
npm install                      # Playwright, the only dependency
npx playwright install chromium webkit firefox  # once
npm run check                    # everything below; exits 1 on any failure
npm run check:full               # the same with the 41-width fixture sweep
npm run fixtures                 # the fixture test alone, with a per-defect table
npm run inspect -- <url> [--system itten.system.json] [--out dir] [--full]
npm run serve                    # fixtures at http://127.0.0.1:4173/fixtures/
```

`npm run check` fails when:

- a file or commit message names an automated writing tool or assistant, or a private file is tracked;
- the schema, the fixtures' system file or the example in `protocol/02-system.md` does not validate, or the validator accepts a deliberately broken file;
- the inspector misses a planted defect on the test print or reports anything on the clean twin;
- a font or icon folder in `library/` has no licence file.

The check takes about 40 seconds at four widths and a little over a minute with `--full`, most of it the fixture run. Reports and crops go to `dist/`, which is not committed.

## What the inspector catches

On the fixtures, the default run and the full sweep each catch all 43 planted defects, one or more for each of the 29 checks, with no false positives on any page (recall 43/43, precision 49/49). Two of the defects are judged without a system file, in distinct-value mode. `fixtures/README.md` lists the defects. `protocol/04-inspect.md` lists what the inspector does not judge: the insides of graphics, states other than the default, pseudo-element text, icon optics, motion that only scripts or untried interactions start, and fonts on platforms other than the one it runs on.

## What comes next

`ROADMAP.md` sets out 0.2 to 0.6 and the test each version has to pass; 0.2 has shipped. `CHANGELOG.md` lists what changed in each version.

## Licence

Code (`inspector/`, `scripts/`, `schema/`, `fixtures/`) is MIT, in `LICENSE`. The documents are CC BY 4.0, attribution Atishay Pahadiya: `ITTEN.md`, `ROADMAP.md`, `CHANGELOG.md`, this README, and `reference/`, `protocol/`, `library/` and `research/baselines/`, with a `LICENSE` in each of those folders. Fonts in `library/assets/fonts/` keep the SIL Open Font License 1.1 and icons in `library/assets/icons/lucide/` keep ISC, each with its licence file.
