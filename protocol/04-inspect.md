# Inspect

The inspector opens the rendered page in Chromium, measures it at many widths, text sizes and colour schemes, checks the layout again in WebKit and Firefox, and lists what is wrong up close. It reads the page the way a careful reviewer with a loupe would: computed values, layout boxes, rendered fonts and the actual pixels. It does not read the source, so it judges what people see, whatever produced it.

## Run it

Install once, in the project:

```sh
npm install --save-dev playwright
npx playwright install chromium webkit firefox
```

Then, with the page served locally or deployed:

```sh
node itten/inspector/inspect.js http://localhost:5173/ --system itten.system.json --out itten-report
```

| Option | Meaning |
|---|---|
| `<url>` | The page to inspect. Inspect each distinct template, not only the home page. |
| `--system <path>` | The project's `itten.system.json`. It is validated first; the run stops if it is invalid. Without it the inspector runs in distinct-value mode: it reports how many font sizes, spacing values and radii the page uses instead of checking them against a scale. |
| `--out <dir>` | Where the report goes. Default `itten-report`. Add it to `.gitignore`. |
| `--full` | Sweep every 40 px from 320 to 1920 px (41 widths) instead of the default four: 320, 768, 1440 and 1920 px. Use it before a release, and to find the widths where a finding starts and stops. |
| `--widths a:b:step` or `a,b,c` | Any other set of widths. |
| `--key-widths a,b,c` | Widths for the contrast and font passes. Default `320,768,1440`. |
| `--engines webkit,firefox` | The engines for the second pass on layout. Default both. |
| `--no-engines` | Skip the WebKit and Firefox pass. |
| `--wait-for <selector>` | After the network goes quiet, wait up to 30 s for an element matching the selector before measuring, on every load. Use it for pages that draw from data or on a timer: name what appears last. |
| `--settle <ms>` | Wait this much longer before measuring, on every load. |
| `--fail-on error` or `warning` | Exit with code 1 when findings of that severity or worse exist, for CI. With `--baseline`, only findings that are new or more severe than in the baseline count. |
| `--baseline <path>` | Compare with a baseline file, usually `itten-baseline.json`: the report lists findings that are new, fixed, or changed in severity. |
| `--write-baseline [path]` | Write this page's findings into a baseline file (default `itten-baseline.json`), keeping the other pages' entries. Put the URL first, before this flag. |
| `--page <key>` | The page's key in the baseline. Default the URL's path and query, so a local run and a deployed one share an entry. |
| `--validate <path>` | Only validate a system file against `schema/system.schema.json`. |

A default run on a typical page takes under a minute; `--full` takes one to three.

### The baseline

A project with findings it has accepted for now (each logged as an override) commits them as `itten-baseline.json`, so a change is judged by what it adds. Each finding is identified by its check and what it is grouped by: an element's selector, a value, or a fluid curve, not by its id or its wording, which change between runs. A finding is new when that pair is not in the baseline, and fixed when a pair in the baseline is not found. Renaming an element's id or classes therefore shows as one fix and one new finding. Write the baseline where the checks run (in CI, with the action's `write-baseline` input), since fonts and line breaks differ between platforms.

## What a run does

| Pass | Widths | Scheme | Text | Checks |
|---|---|---|---|---|
| Layout sweep | 320, 768, 1440, 1920 px (`--full`: 320 to 1920 px in 40 px steps) | light | default | every layout check below |
| Contrast and fonts | key widths | light, then dark | default | `contrast`, `font-fallback`; `optical-margin` in light |
| Text doubled | the same widths | light | browser default font size 32 px instead of 16 px | `overflow`, `clipping`, `overlap`, `spacing-unit`; `text-resize` at the last key width |
| Device pixels | first and last key width | light | default | `hairline-subpixel` at a device pixel ratio of 2 |
| Motion | the last key width | light, with motion allowed and again with `prefers-reduced-motion: reduce`; with motion allowed, the interactions run twice, at full CPU speed and slowed to a reference device | default | `flash`, `reduced-motion`, `motion-timing`, `motion-layout`, `frame-timing` |
| Other engines | 320, 768, 1440 and 1920 px | light | default | the layout checks except `spacing-scale` and `type-scale`, in WebKit and Firefox |

The page is loaded once per pass set: the inspector waits for the load event, for the network to go quiet (up to 10 s), for `--wait-for` and `--settle` if given, then scrolls to the bottom and back, so lazy content and reveal-on-scroll elements render, waits for fonts and 500 ms, and starts measuring. Every request that fails or answers 400 or more is recorded, and what the page has drawn at that moment is noted, so that content drawn later can be reported (see `page-load`). The viewport is 900 px tall. Doubling the browser's default font size is the setting people change in their browser preferences; text set in `px` ignores it, and the report says how much of the page did. Browser zoom is covered by the width sweep, since 200% zoom at 1280 px lays out like 640 px.

## The checks

Severity follows the precedence in `ITTEN.md`. An **error** breaks an accessibility floor or the rendering itself. A **warning** departs from the project's system or from an up-close rule in `03-craft.md`. **Info** is worth knowing but is not a defect on its own.

| Check | Severity | What it measures | Rule |
|---|---|---|---|
| `page-load` | error, or warning | Whether the page measured is the page people see. Error when a request failed or answered 400 or more (a page that catches the failure and shows a message raises no script error, so its error state would otherwise be measured as the page), or when the `--wait-for` selector never appeared. Warning when the network did not go quiet within 10 s of the load event, or when elements appeared after measuring began. For the last, the inspector returns to the first width once the passes are done and compares what is drawn with what was drawn when measuring began: elements that are new, with a selector and text that are also new, appeared late. Ids that differ only by a number (`arc-3`, `arc-15`) count as the same selector, so a chart drawn again on resize with ids from a counter is not late. Parts the page swaps at one width and back at another keep their selector and text and are not counted. The finding names the passes that ran before the content appeared. | CRF-15, FBK-04 |
| `contrast` | error, or warning | The text colour against the pixels rendered behind it. The page is screenshotted twice with all text made transparent, 400 ms apart; the background is sampled across each line of text, and the text colour (with its opacity) is composited over each sample. Error when the median sample is below 4.5:1 (3:1 for large text); warning when the worst tenth is. This sees images, video, gradients, canvas and WebGL behind text, which computed styles cannot. | CRF-14, COL-01 |
| `font-fallback` | error, or warning | The font that actually drew each text run, from the browser's rendering engine, against the family requested. Error when a web font failed to load or when text renders in a fallback; warning when some glyphs come from another font, when a family is not in the system, or when a form control's computed family differs from the page's (the browser's control font), even if the control holds no text yet. | CRF-13 |
| `overflow` | error | The page scrolling sideways (and the element or word that causes it), or text spilling out of the painted box that contains it. | CRF-16, LAY-03 |
| `clipping` | error, or warning | Text partly cut off by an `overflow: hidden` box or by the viewport. Truncation with an ellipsis or a line clamp is a warning. | CRF-16, TYP-03 |
| `overlap` | error | Text drawn over other text. | CRF-16 |
| `spacing-unit` | warning | Margins, paddings and gaps of 2 px or more that keep their value when the browser's default text size is doubled, compared with the same element and property at the same width: set in px, so they do not follow the text. Values that follow the viewport (three or more across the sweep) are left to `spacing-scale`. | CRF-30 |
| `text-resize` | warning | Text elements whose font size grows by less than 5% when the browser's default text size is doubled, compared at the last key width. They are set in px, or in vw alone. One finding lists them all, with the sizes affected. | CRF-16, TYP-03 |
| `target-size` | error, or info | Interactive targets below 24 px that do not meet the WCAG 2.5.8 spacing or inline exceptions; targets below the comfortable size (44 px) as info. | CRF-17, INT-02 |
| `spacing-scale` | warning | Every margin, padding and flex or grid gap, against the system's scale and its declared fluid ranges (`spacing.fluid`: the value the range gives at each width, within 0.5 px, fractions included). Fractional values are reported in both modes. Without a system, a value that follows the viewport is listed once per range, as info, with the widths it spans. | CRF-01, CRF-07 |
| `type-scale` | warning | Every font size against the type scale, and the line height of each step. Text is matched to a step on its size, its weight and the role of its family (text or display, from `families`); a step without a weight or family accepts any. Text at a step's size whose weight or family role matches none of the steps there is reported. A run (an inline element inside a paragraph, at the paragraph's size, such as `strong` or a link) takes the paragraph's step and is judged on size only. Where several steps give the same size at a width (two steps that share a size, or two fluid steps whose ranges cross), the text passes when any of them gives its line height, and a finding names them all. A fluid step accepts the size its declared range gives at each width, within 0.25 px; any other size that follows the viewport is reported as an undeclared fluid range. Without a system, nothing says which ranges are deliberate, so each one is listed once, as info, as fluid spacing is. Fractional fixed sizes are reported in both modes. | CRF-06, CRF-07 |
| `near-miss-edge` | warning | Left, right, top and baseline edges of visible boxes and text blocks that are 0.5 to 3 px apart and within 96 px of each other. Visible boxes are those that paint something: a background, border, shadow, image or control. Text blocks contribute their first-line baseline and their aligned edge, measured over all their text, inline children (`span`, `a`, `em`) included: a block is a text block when it has text of its own, but a line that begins with an inline child begins where that child does. Elements that share a centre are skipped, since different widths centred will never share edges. | CRF-04, LAY-09 |
| `sibling-gaps` | warning | The gaps between three or more siblings of the same kind in one container, along each axis. | CRF-03 |
| `radius` | warning | Corner radii outside the system's set (a concentric derivation is allowed when `nesting` is `concentric`). Without a system: more than four radii, or radii within 2 px of each other. | CRF-11, SHP-02 |
| `radius-concentric` | warning | A rounded box nested near the corner of a rounded parent whose radius is not the parent's radius minus the inset. | CRF-12, SHP-01 |
| `widow` | warning | A paragraph whose last line holds one word, which `text-wrap: pretty` does not move (it is set already, or was tried and left the word). A word broken across lines is not counted, nor a last line that is one identifier: a URL or DOI, as a citation ends, an id behind a prefix such as `arXiv:` or `isbn:`, or a file or repository path (a token with an underscore, two slashes, or a slash and a file extension). None of these can be reworded or hyphenated, and a no-break space before one makes a longer unbreakable run. Not judged where full lines average under 20 characters: in a measure that narrow every line is a fragment, and the fault is the measure. | CRF-21 |
| `orphan` | warning | A paragraph split across columns with one line on either side of the break. Printed pages are not judged. | CRF-21 |
| `rag` | warning | Ragged text with three or more lines in which a line other than the last, or one ended by a `<br>`, stops more than 25% of the measure short, and `hyphens: auto` would bring the deepest hole up by at least 10% of the measure. Text already hyphenated is not judged, nor text whose full lines average under 20 characters. | CRF-22 |
| `hyphenation` | warning | Justified text without effective hyphenation (`hyphens: auto` and a `lang`) whose word spaces stretch past 1.5 times their natural width on some line. | CRF-22 |
| `text-wrap-balance` | info | A heading of two or more lines, not balanced, whose shortest line is under 60% of its longest, where `text-wrap: balance` raises that ratio to 60% or more and by at least 30 points. | CRF-23 |
| `text-wrap-pretty` | info | A plainly wrapped paragraph whose last line holds one word or fills under a third of the measure, where `text-wrap: pretty` moves a second word down or fills the line by at least 10% more. A one-word last line that `pretty` does not fix is a `widow` instead, so each paragraph is reported once. | CRF-23 |
| `hanging-punctuation` | warning | Only where the system sets `type.hangingPunctuation`: a block starting with an opening quote or bracket that sits less than half outside the text edge. | CRF-24 |
| `optical-margin` | warning, or info | Display type (32 px and up), left-aligned, starting with a round or pointed letter, next to smaller text that shares its edge. The first glyph of each is screenshotted with the page's text drawn and again with all text transparent; the first column that differs is where the ink starts. Reported when the display letter's ink starts a whole pixel or more to the right of the other's: a warning at 2 px or more, info at 1 px, the smallest offset the screen can draw. Key widths, light. | CRF-25 |
| `flash` | error | An animation, or an element whose class or style a script keeps changing, that reverses its luminance by 10% or more (with the darker state under 0.8) more than three times a second over 21,824 px² or more. Luminance comes from each keyframe's background colour and opacity over white. | CRF-29, WCAG 2.3.1 |
| `reduced-motion` | warning | With `prefers-reduced-motion: reduce`, an animation or transition that still moves or resizes something, or loops without end. Colour and opacity changes are allowed unless `motion.reducedMotion` is `none-animated`. | CRF-18 |
| `motion-timing` | warning | Each animation's duration and easing against `motion.durations` and `motion.easings`. Easings are compared as numbers, so `ease` matches `cubic-bezier(0.25, 0.1, 0.25, 1)`. A transition reversed before it finished runs shorter than declared; the declared duration is judged. Only with a system. | CRF-26 |
| `motion-layout` | warning | An animation or transition of a layout property: width, height, top, left, margin, padding, border width, font size, line height and the like. | CRF-27 |
| `frame-timing` | warning | Long animation frames ([`PerformanceLongAnimationFrameTiming`](https://w3c.github.io/long-animation-frames/)) while hovering each element that declares a transition, tabbing through up to 40 focus stops, clicking up to 15 buttons and toggles, and scrolling the page and up to five scroll containers by wheel; once at full speed and again on a reference device. Chromium reports a frame as long when it takes over 50 ms, three times the 16.7 ms budget of a 60 Hz display. Reported per element, interaction and speed when three or more frames are long; the message gives their durations, the frames missed, and the script the browser names for most of the time. For the reference device, the inspector first measures the main thread with a benchmark index in [Lighthouse's units](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md) (a string-building loop and an array-copying loop, half a second each), then slows the CPU (Chrome DevTools Protocol `Emulation.setCPUThrottlingRate`) by the ratio of that index to the reference, 400 by default (`--reference-index`), and measures again; a rate that lands more than 10% off is corrected once. A machine at or below the reference is not slowed. So every machine is tested at about the same speed, instead of a fast one being slowed to a mid-range desktop and a slow one to a low-end phone. `report.json` has the index, the rate and the index under the slowdown under `motion.cpu`, and frame times and long frames at both speeds under `motion.frames`. | CRF-28 |
| `hairline-subpixel` | warning, or info | Borders and rules up to 1.5 px thick whose position or width does not land on whole device pixels at 1× and 2×. The middle of each line (up to three per finding) is screenshotted in each engine and profiled across its thickness. Warning when an engine draws it blurred across two pixels; info when every engine snaps it to whole pixels, which browsers do for most borders placed by layout. Lines moved by a fractional transform blur in Chromium and WebKit. | CRF-08 |

The typographic checks (`widow` to `optical-margin` above) judge the lines Chromium draws, at every width of the sweep. Where a check asks whether a property would help, it sets the property on the element for a moment, reads the lines again and puts the element back.

### What it does not judge

- **The insides of graphics.** svg, canvas, img, video, iframe, object, embed, math and `role="img"` elements are measured as boxes; what is drawn inside them is not. Everything in a `<figure>` except its `<figcaption>` is treated the same way, so a diagram built from divs is not held to the page's spacing scale. The report gives the count of each.
- **States other than the default.** Hover, focus-visible, active, disabled, empty, loading and error states are not measured; hover is used only to start transitions for the motion checks. Build a state sheet (CRF-15) and inspect that page.
- **Text the DOM does not expose as text:** `::before`, `::after` and `::marker` content, shadow DOM, and text drawn in canvas or WebGL.
- **Icon optical centring and stroke weight, and text-box trim** (CRF-05, CRF-09, CRF-10). These are manual checks.
- **Motion that only scripts, timers or untested interactions start.** The motion pass records what runs after load and what hovering, Tab and clicks start. It clicks buttons, `[role=button]`, switches, tabs, `[aria-expanded]` and `[aria-pressed]` toggles, `summary`, checkboxes and radios: each twice, then Escape. It does not click links or submit buttons, and it aborts any navigation of the page. Drags, long presses, typing and swipes are not tried. A CPU slowed to a benchmark index approximates a mid-range phone; it is not one (the index weighs two loops, and a phone's memory, GPU and thermal limits differ), so a clean run is not proof for a real device.
- **The worst frame of a moving background.** Two frames are sampled.
- **Other platforms' fonts.** Font results reflect the machine the inspector runs on. A stack that renders correctly on macOS can fall back on Windows or Linux; run it on the platforms that matter.
- **Layout in dark mode.** Layout checks run in light only, on the assumption that the scheme changes colour and not geometry. If yours changes geometry, say so in the overrides and inspect a dark-only build.

## Read the report

`report.html` opens with a table of findings by check and severity, then lists every finding, errors first. Each one has:

- the message, with the measured values;
- the rule it comes from, the finding's ID, and where it was seen: the scheme or mode, and the widths, written as ranges (`320–600, 1440 px`);
- the elements involved, as selectors and a short label;
- one to three crops, zoomed 2 to 4 times with nearest-neighbour scaling so single pixels stay sharp. Magenta outlines the elements involved; blue marks the edges being compared.

A finding is listed once however many widths it appears at. Its message comes from the first width where it was seen.

Below the findings, "Values in use" counts the distinct font sizes and spacing values at any one width, which is what a reader meets on one screen, and across the sweep, where each fluid range counts as one value. It then lists every fixed value, with the most elements using each at any one width, and every fluid range, then the fonts that actually rendered for each requested stack. "Coverage" lists what was measured, what was skipped by `data-itten-ignore`, and what was not judged.

"Engines" lists the findings that differ between Chromium, WebKit and Firefox at the widths all of them ran, and how each engine drew any hairline found. Spacing and type values are computed styles, the same in every engine, so they are compared in Chromium only. Engine differences come mostly from font rendering (text widths and line breaks), form controls, and how each engine rounds positions.

`report.json` has the same content for scripts. Crops are in `crops/`.

## Fix in this order

1. **Errors in `font-fallback`.** A fallback font changes every measurement after it: sizes, line breaks, edges, contrast. Fix it, then re-run before looking at anything else.
2. **Errors in `overflow`, `clipping` and `overlap`.** These lose content. Start with the narrowest width and the 200% text pass, where most of them appear first.
3. **Errors in `contrast` and `target-size`.** These are accessibility floors. A floor is never logged away as taste (see the precedence in `ITTEN.md`).
4. **Warnings in `text-resize`, `type-scale` and `spacing-scale`.** One stray value usually comes from one rule in the stylesheet. Fixing the source rule often clears several `near-miss-edge` and `sibling-gaps` findings at once, so re-run before working through those.
5. **Warnings in `near-miss-edge`, `sibling-gaps`, `radius`, `radius-concentric` and `hairline-subpixel`.** Work through the crops. Each one either becomes an exact match or a logged optical adjustment.
6. **Info.** Read it; act on it when the brief cares.

Within a severity, fix the findings seen at the most widths first: they are structural, not breakpoint accidents.

## When a finding is intended

Some findings are deliberate: an optical offset (LAY-10), a display headline that breaks the type scale on purpose, a carousel that clips its next slide as a hint (LAY-08). For each one:

1. Add an entry to `itten.overrides.json` with the rule ID, the check, the selector or scope, the value, what is used instead, the reason, whether the floors still hold, the date and the ITTEN version (`schema/overrides.schema.json`). Then run `node itten/scripts/overrides.js render` to rewrite `docs/itten-overrides.md`, the page people read. The ITTEN action fails a run whose overrides file does not validate or whose page is out of date.
2. Mark the element with `data-itten-ignore="<check>"` (several checks separated by spaces, or `all`). The attribute also applies to the element's descendants.

The report counts ignored element and check pairs, so an ignore without an override entry shows up in review. Never ignore an error that breaks an accessibility floor for text people need to read or targets people need to use.

## Known limits

The inspector is tested against `fixtures/`: a test print with one planted defect per check and a clean twin. `node scripts/fixture-test.js` reports its precision and recall. The fixtures prove the checks work on known defects. They do not prove the absence of false positives on every real page. When a finding is wrong, reduce it to a fixture and fix the check rather than ignoring it.
