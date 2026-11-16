# Changelog

What changed in each version of ITTEN. Rule IDs refer to `protocol/03-craft.md`; check names to `protocol/04-inspect.md`.

## 0.3.3 · 16 November 2026

Baselines measured, a check for lines that begin with a separator or closing punctuation, the settle window tested on a slow machine, and two fixes to how the report reads.

- `near-miss-edge` measures a text block's baseline instead of estimating it. A zero-size inline-block set in the block's font sits on the baseline, which gives where the baseline falls in the line's box in the engine being measured; the probes are built in one element, added once and removed. Before, the ratio came from canvas font metrics, which WebKit rounds to whole pixels while its text boxes use the font's own: on neptune-fork's companion page, every reading in Table 1 and its condition, on one baseline, were reported 0.5 px apart at 1040 px in WebKit (filed there as issue 6). d48 plants a note moved 1 px off the baseline it shares with a figure in another type size, and on both pages sets a figure at the title step (24 px) and a note at the small step (14 px) on one baseline, which 0.3.2 put 0.6 px apart in WebKit and the clean twin must not report.
- `--slow-to <index>`, for testing, slows Chromium's CPU to a benchmark index before the settle window is set (calibrated as the frame-timing pass slows it to the reference device) and runs every Chromium page of the sweep at that rate. `scripts/settle-test.js` uses it: with the CPU slowed to 800, the settle window and the watch double, d20, drawn 2.5 s after load, is still reported late, and its clean twin is not; run here, the index landed at 775, the window at 1032 ms and the watch at 10.3 s. On a machine at an index of 1600 or more, as every laptop and runner so far, the scaling never ran. `scripts/check.js` runs the test, and `load.timing` gives the scale and, when slowed, the rate.
- A note that groups information findings in one table or list lists its cells or items in document order: the inspector records where each element stands in the document. Before, rows and cells were sorted by their numbers alone, so a header row came after the first body row and a footer could come first; the pull request comment kept the order the sweep found them in. Reports without the positions fall back to header rows, body rows, footer rows, each by number.
- A `broken-word` finding lists the words broken at every width and engine that broke them, one clause per set of widths with the same words ("At 320 and 360 px: …; at 1440 px: …"), and gives the cell widths across all of them. Before, its message came from the first width that saw it.
- A new check, `line-start` (CRF-31): a line that begins with a separator (`·`, `•`, `|`, `/`) or with closing punctuation (`,` `.` `;` `:` `!` `?` `)` `]` `}` `”` `’`). A separator belongs to the item before it, as a comma does to its word. A mark followed by a letter or a digit opens a word and is not counted (`|O − C|`, `/usr`, `’90s`, `.5`), read across elements, as `broken-word` reads words since 0.3.2. It runs in Chromium and, unlike the other line checks, in WebKit and Firefox too, since each breaks lines by its own font metrics. On neptune-fork it finds, in WebKit at 1024 px only, Plate I's byline breaking before "· code v1.4.0" and its caption breaking before a "·" in the list of observatories, which nothing reported before; with each "·" tied to the item before it, none. d49 plants a byline whose second line begins "·" and a note whose second line begins ";", at every width and in every engine, with an absolute value whose bar begins a line on both pages.
- Fixture test, at the default four widths with WebKit: recall 49/49, precision 57/57, nothing on the clean twins. d48 adds one finding, and d49 two, one each for the byline and the note.

## 0.3.2 · 15 November 2026

Tables are text, wherever they are set.

- A `<figure>` is no longer treated as a graphic. Only drawn content keeps its insides unmeasured: svg, canvas, img, video, picture, iframe, object, embed, math, audio, and `role="img"`. A figure's tables, text and caption go through every layout and typographic check. Before, a table set in a figure was skipped by all of them, and `broken-word` read it as a special case.
- A diagram drawn with HTML elements needs `role="img"` and a label to stay unmeasured, as it does to be read as one image. The fixtures' div diagram now has them.
- d45 and d46 plant a spacing defect and a hole in the rag in tables inside figures.
- Every width of every pass is a fresh load at that width. Before, each pass set loaded the page once and resized it from width to width, so a layout broken by the resize was reported as if it were the layout at that width: on neptune-fork's companion page, WebKit's Table 1 overlapped at 1440 px only because the page had first been loaded at 320 px.
- A resize pass, in Chromium, WebKit and Firefox: the page is loaded at one width, resized to another and measured again. Pairs cross every media and container query breakpoint the sweep finds, both ways, and go from the narrowest width to the widest key width and back. A finding the fresh load at the target width does not have is reported, with a message that starts "After resize from X to Y px". d47 plants a box sized by script at load, seen only after a resize, and the fixtures have one media and one container query that the resize pass must find on both pages.
- With `--full`, WebKit and Firefox run the whole sweep, not four widths.
- `broken-word` no longer joins two words that sit in elements of their own with only a space between them. It read a block's text from the nodes with letters in them, so the space, in a node of its own, was lost: on neptune-fork's main page a figure caption's reference mark and the next word ("La" and "Lalande's", "N" and "Neptune") were reported as one word broken. The case is now in d44 on both pages.
- Fixture test: recall 47/47, precision 54/54, nothing on the clean twins.
- Late content is judged by the page's own clock, so it no longer depends on how fast the machine runs. Before anything is measured, the machine is timed with the benchmark the motion pass uses, and the settle window is set from it: 500 ms with nothing added at a benchmark index of 1600 or faster, up to 1.5 s on a slower or busier machine. A watch load, with no scrolling or measuring, runs until 5 s after the load event (same scale) and the page is still, at most 15 s; elements added after the page first went still are late, and the finding gives when. Every later load waits for them, so the measurements include them, and a measurement taken while the page added an element is taken again, up to three times. A page that never goes still within 15 s is a new `page-load` warning. Before, d20 was caught only if measuring began before its 2.5 s timer, and one local run on a busy machine missed it. `load.timing` and `load.remeasured` are in the report.
- Information findings of one check in one table or list are one note in `report.html` and one line in the pull request comment, naming the cells or items (`row 5, cell 3`); the shared sentence is written once and each cell shows only its own values. On neptune-fork's companion page, 39 one-word last lines in table cells become two notes. Errors and warnings are never grouped, and `report.json` is unchanged, so baselines are too.
- `ROADMAP.md` evaluates running the action in Playwright's container image, which would remove the 40 to 77 s apt install from each job; not built.

## 0.3.1 · 15 November 2026

Frame timing that holds on any machine, two false positives from neptune-fork fixed, a new check for words broken without a hyphen, and fixes to telemetry and the action's browser cache.

### Frame timing

- The motion pass no longer slows every machine's CPU four times. It measures the main thread with a benchmark index in [Lighthouse's units](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md), slows the CPU by the ratio to a reference device, measures again, and corrects the rate once if it lands more than 10% off. The reference is a benchmark index of 400, what Lighthouse's default 4× makes of a 1600 high-end desktop, inside its mid-tier mobile class; `--reference-index` sets another. A machine at or below the reference is not slowed. d41 was missed on two of three Linux runs of 0.3.0, because a fixed 4× left the fast runner well above a phone.
- `frame-timing` judges the long animation frames Chromium reports ([Long Animation Frames API](https://w3c.github.io/long-animation-frames/)): frames over 50 ms, three times the 16.7 ms budget of a 60 Hz display. Three or more while doing one thing are a finding, which gives their durations, the frames missed, and the script that took most of the time. Before, slow `requestAnimationFrame` intervals were counted.
- The index, the rate and the index under the slowdown are in `report.json` (`motion.cpu`), in `report.html` and in the action's job summary. Fingerprints of `frame-timing` findings end in `full` or `reference` instead of `1` or `4`.
- d41's scroll handler does a fixed amount of work, about 140 ms on the reference device, instead of sizing itself to the machine.

### Typography

- New check, `broken-word` (CRF-22): a word broken at a line end without a hyphen, the emergency break of `overflow-wrap`, `word-break` or `line-break: anywhere`, read across inline children and told apart from hyphenation. It runs in Chromium, WebKit and Firefox, since engines size table columns differently, and reads tables inside a figure. On neptune-fork's companion page it reports Table 2 in WebKit from 900 to 1110 px ("Bouvard|'s", "referenc|e"), and not in Chromium. Planted as d44, a narrow table column with `overflow-wrap: break-word`.
- `near-miss-edge` measures a text block's edges over all its text, inline children included. A list of references whose names are set in spans read as 0.94 to 2.56 px apart (neptune-fork, issue 4).
- `widow` does not count a last line that is an arXiv id or other prefixed id, or a file or repository path, as it already did for URLs and DOIs (neptune-fork, issue 5). The pattern is shared with `broken-word`.
- Both reproductions are specimens on the two fixture pages, in d23. d11's clean twin fits its box to the long word instead of breaking it.
- CRF-22 says no word is broken without a hyphen, and that hyphenation follows the measure: a container query where the column is a box, the equivalent viewport condition where it is a grid track, with neptune-fork's main column as the example.

### Telemetry and the action

- Telemetry leaves forks out: a fork carries its parent's overrides. They are listed in the report and their files are not read. `fixtures/telemetry/theta` is a fork that would flag LAY-10 if it were counted.
- The action restores and saves Playwright's browsers explicitly and saves them as soon as they are installed. `actions/cache` saved only when the whole job succeeded, so the failing runs on main never left a cache. A job that calls the action more than once installs the browsers once.

## 0.3.0 · 15 November 2026

The inspector on every pull request, and overrides that ITTEN can count, as planned for 0.3 in `ROADMAP.md`. Not yet released: the parts that need GitHub are listed under 0.3 there.

### GitHub Action

- `action.yml` at the root, a composite action used as `atishaypahadiya/itten@v0.3.0`. It serves a static directory, runs a serve command and waits for its URL, or opens a deployed URL; inspects each page in `pages` in Chromium and WebKit; uploads `report.html` and the crops as an artifact; and writes the counts to the job summary.
- On a pull request it keeps one comment, found by a hidden marker and edited on later runs: counts by page and severity, what is new and fixed since the baseline, and the top ten findings. Pull requests from forks, and any run whose token cannot comment, get the job summary only, without failing.
- `fail-on`: `errors`, `warnings` or `never`. With a baseline, only findings that are new or more severe count.
- Inputs `mode` (`quick` or `full`), `system` (`none` for distinct-value mode), `baseline`, `write-baseline`, `overrides`, `comment`, `name`, `working-directory`; outputs for the counts, the report directory and the artifact URL.
- Third-party actions pinned by commit SHA; Playwright's browsers cached between runs.
- `.github/workflows/self-test.yml` runs the action on the fixtures on every push and pull request and fails unless `fixture-test.js --from` scores its reports at full recall and precision.

### Baseline

- `inspect.js --baseline <file>` compares a run with a committed baseline: new findings, fixed ones, and ones whose severity changed, in `report.json` and in a new section of `report.html`. `--write-baseline [file]` writes the page's findings into it, keeping other pages; `--page` sets the page's key.
- Each finding now carries a `fingerprint`, its check and grouping key, which stays the same between runs while its id and wording change. `report.json` records the ITTEN version.
- `--engines webkit,firefox` chooses the second-opinion engines.

### Overrides and telemetry

- `itten.overrides.json`, validated by `schema/overrides.schema.json`: rule ID, selector or scope, reason, date and ITTEN version, with the check, the values and whether floors hold as options. The validator also requires a rule that exists and a real date.
- `scripts/overrides.js render` writes `docs/itten-overrides.md` from it; `check` fails when the page is out of date. The action runs the check when the file exists.
- `scripts/telemetry.js` reads, with the gh CLI, the overrides of the owner's public repositories that include ITTEN as a submodule, and nothing else from them; flags rules overridden in three or more projects with the reasons side by side; and writes `research/telemetry.md`. A monthly workflow opens or updates one issue. First run: ten public repositories, one with ITTEN (neptune-fork, no overrides file yet), nothing flagged.

### Other

- `scripts/serve.js` serves any directory, as the action's static server.
- The schema validator supports `pattern`.
- `npm run check` also runs the action tests, the overrides and telemetry checks, and fails on any action not pinned by SHA.

## 0.2.0 · 15 November 2026

Typographic finish and motion, the two check families planned for 0.2 in `ROADMAP.md`, and the rest of 0.1.1.

### Typography

Eight checks, measured on the lines Chromium draws, word by word:

- `widow`: a last line of one word that `text-wrap: pretty` does not move (CRF-21);
- `orphan`: a paragraph split across columns with one line left on either side (CRF-21);
- `rag`: in ragged text, a line far short of the measure where `hyphens: auto` would fill it (CRF-22);
- `hyphenation`: narrow justified text without hyphenation, where word spaces stretch (CRF-22);
- `text-wrap-balance` and `text-wrap-pretty`: headings and paragraphs that would break better with either, found by setting the property for a moment and reading the lines again (CRF-23);
- `hanging-punctuation`: opening quotes and brackets that do not hang, where the system declares `type.hangingPunctuation` (CRF-24);
- `optical-margin`: display type whose round or pointed first letter starts inside the edge of the text below, measured from the glyph's pixels rather than its box (CRF-25).

Widows and rag are not judged where full lines average under 20 characters, and a last line that is a URL or DOI is not a widow. An optical offset of 1 px is info; 2 px or more is a warning.

### Motion

A motion pass in Chromium at the last key width, with motion allowed and again with `prefers-reduced-motion: reduce`. It records every animation the document holds (CSS animations, transitions, Web Animations) and frame times from `requestAnimationFrame`, while it hovers elements that declare a transition, tabs through up to 40 focus stops, clicks up to 15 buttons and toggles, and scrolls the page and its scroll containers. With motion allowed it does all of this twice: at full speed and with the CPU slowed 4×. Five checks:

- `flash`: more than three flashes a second over a large enough area (CRF-29, WCAG 2.3.1);
- `reduced-motion`: movement that still runs under Reduce Motion (CRF-18, now verified by the inspector);
- `motion-timing`: durations and easings off the system; a reversed transition is judged by its declared duration (CRF-26);
- `motion-layout`: animated width, height, top, left, margin, padding and the like (CRF-27);
- `frame-timing`: three or more frames over 50 ms, per element, interaction and CPU speed (CRF-28).

The report gains a Motion section with the durations and easings in use and frame-time histograms at both speeds.

### Spacing and type steps

- `type-scale` matches text to a step on its size, its weight and the role of its family together. Regular text no longer passes on a bold step's line height, and text whose weight or family role matches no step at its size is reported. An inline run inside a paragraph, at the paragraph's size, takes the paragraph's step.
- `spacing-unit`, new: margins, paddings and gaps that keep their size when the browser's text size is doubled are set in px (CRF-30). The fixture CSS now writes spacing in rem.
- `spacing.fluid`, new in the schema: fluid spacing ranges, judged as fluid type steps are. Fluid ranges are declared in the system; there is no command-line flag to wave them through.
- Late content: ids that differ only by a counter count as the same element, so a chart redrawn on resize is not late.

### Fixtures and baselines

43 planted defects, one or more for each of the 29 checks; the fixture test reports recall 43/43 and precision 49/49 at the default widths and the full sweep, with no findings on the clean twins. Five cases on both pages must not be reported; four of them were false positives found on real sites. `research/baselines/` records 0.2 runs on neptune-fork and HundredLives, with a verdict for each finding.

## 0.1.1

From neptune-fork's first pass with ITTEN, each issue turned into a planted fixture:

- `type-scale`: where several steps give the same size, text is judged against all of them, and a finding names each.
- `page-load`, new: failed requests are errors; a network that does not go quiet, and content drawn after measuring began, are warnings. New options `--wait-for` and `--settle`.
- Distinct-value mode: each fluid range of type or spacing is listed once, as info, and counted as one value in the sweep totals.
- CRF-01: spacing is set in rem, the unit of type, so rhythm holds at 200% text. (Its check, `spacing-unit`, came in 0.2.0.)

## 0.1.0

The teardown protocol, the craft rules, the system schema, the inspector with 14 checks, the fixtures, the reference corpus and the asset library.

---

This file is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), attribution Atishay Pahadiya.
