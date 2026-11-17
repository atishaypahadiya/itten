# Changelog

What changed in each version of ITTEN. Rule IDs refer to `protocol/03-craft.md`; check names to `protocol/04-inspect.md`.

## 0.3.5 · 16 November 2026

The inspector runs its widths in parallel, finds the same things on one worker as on many, and measures around every breakpoint in quick mode.

- A run is a set of jobs: each width of the layout sweep, of the text-doubled pass, of the device-pixel pass and of each other engine, and each resize, every one a fresh load in a browser context of its own. Up to `--workers` run at once: by default the CPU cores less two, and no more than one per GB of memory beyond 2 GB (12 on a 14-core, 24 GB laptop; 2 on GitHub's 4-core runners). A job keeps what it found and records nothing; once every job is done, the findings are recorded in the order a serial run takes the passes in, so ids, first sightings, elements and messages are the same on any number of workers. Before, one browser context served a whole pass, so a page's storage carried from one width to the next.
- The benchmark and the watch load run first and alone, since every job's settle window and wait come from them; motion and frame timing run last and alone, after every job and crop, with every other browser context closed. `schedule.phases` in the report gives each phase's start and end, and the check script fails a run where a timed phase overlapped another. In 0.3.4 motion ran between the device-pixel pass and the engines; its findings now come after the engines', so their ids are higher.
- A finding is cropped after the jobs, on a page loaded again as the pass it was first seen in loaded it, one load per pass. The crops are the same as before; a run with several findings first seen at one width loads that width once more.
- `--shard i/n` measures every n-th job and writes `shard.json`; `--merge` combines the shards into one report: the findings in order, the crops, motion and one baseline comparison. It stops if a shard is missing, came from another version, or planned other jobs. The action has `shard`, `merge` and `workers` inputs, and `ITTEN.md` shows a three-way matrix with a merge job.
- A plan line before the jobs: how many, on how many workers, and how long the jobs, the crops and motion should take, estimated from the times of earlier runs, kept per page and per kind of job in `dist/timings.json` (ignored by git; `ITTEN_TIMINGS` names another file). The run ends with the time each phase took.
- Quick mode adds the width on each side of every breakpoint between 320 and 1920 px: the last width of the old layout and the first of the new, in Chromium and in the other engines. The breakpoints come from a scan before the sweep: one page, resized across the range in 16 px steps, its breakpoint state read at each step without measuring, and each change narrowed to the pixel. The resize pass takes its pairs from the same scan. Before, the state was read on each width's own load, so a width that timed out had none and no resize started there; now the resize from that width runs, and times out as its load does (`fixtures/hang.html`: the resize from 768 px, in Chromium and WebKit). `--no-breakpoint-widths` keeps the four widths alone; `--widths` is always measured as given.
- `scripts/parity-test.js` inspects pages on one worker and again on several and fails on any difference in any finding, apart from its measured fields. `scripts/check.js` runs the fixture test both ways and scores the parallel run. `--saved <dir>` compares the reports an earlier parity run saved, without inspecting again.
- A finding names its measured fields in `measured`: values a timing-sensitive check produces, which differ between any two runs of one page. `frame-timing` marks its count (frames over budget) and its message (their durations and the CPU slow-down); `page-load` marks the message of `never-still` and `late` (seconds watched, when elements appeared, the settle window); `flash` marks the message of a script's flashing (colour changes counted in one second). The motion checks (`motion-timing`, `motion-layout`, `reduced-motion`, `flash`, `frame-timing`) mark their elements' boxes, which they take while the page moves. The glyph counts in `renderedFonts` are measured too. Parity reports a difference in a measured value as a note with both values; presence, severity, elements, crops and every other field must match exactly. Reports saved before have no marker and are read with the same table (`measuredFields` in `inspector/inspect.js`).
- The contrast pass records where the page keeps drawing: the 16 px tiles whose pixels change between its two frames, 400 ms apart, reported as rectangles in `drawing`. A contrast finding whose text lies over a moving tile is marked `movingBackground`: its value depends on the frame. Parity reports every difference in such a finding, including whether it is there at all, as a note; every other finding on the page still has to match. 0.4 judges these across fixed frames. `fixtures/canvas.html` and `scripts/canvas-test.js` test it: text over a canvas that redraws every frame, text over a still box, and a line that spills out of its box.
- Failed requests are listed by URL in the `page-load` finding and in `load.failedRequests`. They were listed in the order they failed, which changes with the network and the number of workers.
- Parity matches findings by fingerprint. The report's ids follow the order findings were first seen in, which changes with the workers, and are not compared.
- An element's label is its tag and first class (`h1.line`), no longer its text. Text can change while the page runs (a week counter, a story line), and labels are compared between runs; the selector beside the label says which element it is. Messages that name an element use the same label. The element's opening text, about 60 characters, is kept in `text`, for the reader only: report.html and the pull-request comment show it, and parity never compares it. report.html also says when a finding is over a moving background.
- The crop of a contrast finding over a moving background shows the frame its message was measured in. A page loaded again for cropping shows another frame, so its colours did not match the message. The contrast pass now lays a screenshot of the text alone over the frame the message's sample came from and keeps it as the crop, marked `composited` in report.json; report.html captions it "composited: text over the measured frame". On `fixtures/canvas.html` a canvas pixel in the crop is the colour the message names, in each run (`scripts/canvas-test.js`).
- A web font is named by its `@font-face` family in `renderedFonts`. The platform names a variable font after whichever instance it met first ("Inter Tight Light" for a 300–500 face), which changed with the order a run loaded pages in.
- `data-itten-ignore` applies to the element it is on, for the checks it names. Before, it also reached every element inside, so an ignore on a page column skipped the column's whole content. `data-itten-ignore-subtree` next to it reaches the elements inside, as before. An ignore that relied on the old reach needs it added. `fixtures/ignore.html` and `scripts/ignore-test.js` test both.

## 0.3.4 · 16 November 2026

The inspector never hangs.

- Every step has a hard limit: 180 s to load the page, 120 s for each check and for recording and cropping its findings, 420 s for one width as a whole, 480 s for the motion passes, 30 s to close or open a browser context. On a slower machine each is multiplied by the settle scale. A step past its limit is abandoned: the inspector closes the browser context it ran in, opens a fresh one, records a `timed-out` error naming the step, the width and the pass ("Loading the page did not finish within 180 s (768 px, light)"), and goes on to the next width. This covers the watch load, every width of every pass in every engine, each resize pair, findings that load a page to crop, and the motion passes. Before, a `page.evaluate` on a renderer that no longer answered waited for ever.
- A watchdog for the whole run: when nothing has moved (no step begun, no line logged) for 10 minutes, the run prints the last step and exits with code 124 (`--watchdog <minutes>`, `0` for never). It never fires before the longest single step limit has run out.
- The example workflow in `ITTEN.md` sets `timeout-minutes: 30` (90 for the full sweep), and says why a job still needs its own limit. ITTEN's own jobs had limits already.
- `fixtures/hang.html` blocks its main thread for good when loaded at 768 px. `scripts/timeout-test.js` inspects it at 320, 768 and 1024 px, with 768 px a key width and in WebKit, and expects a `timed-out` error at 768 px in the light, 200% text, 2×, motion and WebKit passes, 320 and 1024 px measured, and the run finished; and a stalled process stopped by the watchdog with code 124 and its last step named. `scripts/check.js` runs it.
- What prompted this: on 16 November a full fixture sweep stopped after 600 px on the clean twin, with Node and Chromium idle, and sat for two and a half hours. Run again on its own on the same code, the clean twin's full sweep finished, so the hang did not reproduce. Playwright's browser cache was found deleted later that night, by nothing in ITTEN; whether that was the cause is not known.
- Fixture test, at the default four widths with WebKit: recall 49/49, precision 57/57, nothing on the clean twins; the hang page is not part of it.

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
