# Craft

These are the up-close rules for building. "Up close" means the page as it is actually rendered, looked at the way a careful reader would: at 100% and in crops zoomed to 400%, at device pixel ratios 1 and 2, across widths from 320 px, at 200% text, in light and dark. At that distance the faults that make work look approximate become visible: a gap of 13 px beside one of 12, an edge 2 px off its neighbour, an icon heavier than its label, a corner that pinches, a fallback font nobody noticed.

Every value these rules refer to comes from the project's `itten.system.json` (`protocol/02-system.md`). The rules say how the values are used, never what they are. A value outside the system is a defect unless it is logged in `docs/itten-overrides.md` with a reason. An element whose override is logged can carry `data-itten-ignore="<check-id>"` so the inspector skips it for that check.

Strength follows `reference/README.md`. MUST: a violation is a defect. SHOULD: deviate only with a logged override (DEC-08). No rule here can lower an accessibility floor (`ITTEN.md`, precedence).

Each rule names how it is verified: by an inspector check (`protocol/04-inspect.md`), or by a manual method where the inspector cannot judge. The inspector does not look inside `svg`, `canvas` or figure graphics, does not exercise hover, focus, active, disabled, empty, loading or error states, and does not judge icon centring, icon stroke, text-box trim or motion.

## Spacing and edges

### CRF-01 · Spacing comes only from the scale
Strength: MUST · Verified by: `spacing-scale` (inspector); manual: compare gaps at 100% and 200% text

Every margin, padding and gap is 0 or a value in `spacing.scale`. Combine scale values only where the result is also in the scale.

Set spacing in the same unit as type, `rem`, so that when a reader doubles the browser's text size the gaps grow with the text and the rhythm between them holds. The scale is written in px at the default 16 px root; 24 px is set as `1.5rem`. Spacing in `px` stays put while the text doubles, so at 200% text a paragraph gap shrinks to half a line and groups run together.

*Why:* a closed scale removes near-duplicates such as 13 px beside 12 px, which read as mistakes rather than decisions, and a scale in the type's unit keeps its proportions to the text at every text size. Cites: LAY-05, TYP-03; WCAG 2.2 SC 1.4.4.

### CRF-02 · Groups sit further apart than their contents
Strength: MUST · Verified by: manual: for each grouped region (card, form section, list under a heading), read the largest gap inside a group and the gap between groups from the devtools box-model overlay, and check the ratio against `spacing.groupRatioMin`

The gap between two groups is at least `spacing.groupRatioMin` times the largest gap inside either group.

*Why:* when outer and inner gaps are close, the eye cannot tell where one group ends. Cites: LAY-06, LAY-04.

### CRF-03 · Siblings of one kind have one gap
Strength: MUST · Verified by: `sibling-gaps` (inspector)

Items of the same kind in one container (list items, cards, buttons in a row, paragraphs) are separated by a single gap value. Set it once on the container with `gap`, not as margins on the children, so first, last and wrapped items do not end up with different gaps.

*Why:* unequal gaps between equal things suggest a grouping that does not exist. Cites: LAY-04, LAY-06.

### CRF-04 · Edges are shared exactly, not nearly
Strength: MUST · Verified by: `near-miss-edge` (inspector)

Left, right, top and baseline edges that are meant to line up are equal. Edges that are not meant to line up are at least one spacing step apart. An optical adjustment that moves an edge by 0.5–3 px (LAY-10) is allowed only when it is logged in `docs/itten-overrides.md` and the element carries `data-itten-ignore="near-miss-edge"`.

*Why:* an edge 1–2 px off its neighbour reads as an error, and every extra edge is one more line the eye has to resolve. Cites: LAY-09, LAY-10.

### CRF-05 · Text aligns by its letters, not its line box
Strength: SHOULD · Verified by: manual: at 400% zoom, measure from the top of a flat capital (H, E) and from the baseline to the edges of the neighbouring box, with the box-model overlay on; the two gaps match the intended spacing. Do this in Chrome, Safari and Firefox, because Firefox trims differently

Where text must align with or be centred against a non-text box (a label in a button, a heading beside an image, text in a padded card), trim its box to cap height and baseline with `text-box: trim-both cap alphabetic`. Where the property is unsupported, apply the equivalent negative margins computed from the font's metrics.

*Why:* a line box includes half-leading and the font's ascent and descent, so untrimmed text sits visibly low in buttons and below the top edge of images beside it. Trimming makes spacing measure what the eye sees. Cites: LAY-10; CSS Inline Layout Module Level 3 (`text-box`, `text-box-trim`, `text-box-edge`).

Support, as of 15 November 2026: Chrome and Edge 133, Safari 18.2, and Firefox 154, which made the `text-box` properties Baseline newly available in August 2026 (web.dev, below). The specification is still a draft.

Firefox trims differently from Chrome and Safari, so trimmed text must be checked in all three engines. Mozilla's shipping bug lists the differences: Firefox trims inline boxes (as WebKit does and Blink does not), trims multi-column containers (as Blink does and WebKit does not), does not trim boxes cut short by `line-clamp` (Blink does), and supports the `ideographic` and `ideographic-ink` edges, which the others do not. At release it also trimmed the font's internal leading for the `text` edge where Chrome and Safari trim only the external leading, a difference fixed separately in Mozilla bug 2055372. Check which Firefox version a project's readers run before relying on `text` trims there.

```css
.trim { text-box: trim-both cap alphabetic; }

@supports not (text-box: trim-both cap alphabetic) {
  .trim::before,
  .trim::after { content: ""; display: table; }
  .trim::before { margin-block-end: calc(-1em * var(--trim-top)); }
  .trim::after  { margin-block-start: calc(-1em * var(--trim-bottom)); }
}
```

With line height L, ascent A, descent D and cap height C, all in em as the browser uses them: `--trim-top = (A − C) + (L − A − D) / 2` and `--trim-bottom = D + (L − A − D) / 2`. Take the metrics from the font file (Capsize publishes them for many fonts and generates this CSS). The fallback is only exact for the font it was computed for, so it is wrong whenever a fallback font renders (CRF-13). Trimming reduces the box height: keep `min-block-size` at `targets.minimum` or more on trimmed controls (CRF-17).

## Sizes

### CRF-06 · Type comes only from the type scale
Strength: MUST · Verified by: `type-scale` (inspector); manual: compare computed `line-height`, `font-weight` and `letter-spacing` with the step in devtools

Every font size is a step in `type.scale`, used with that step's line height, weight, family and tracking. A new size is a change to the system, not a local decision.

*Why:* hierarchy needs a closed set of steps, and one-off sizes blur the distinction between levels. Cites: TYP-06, TYP-07.

### CRF-07 · No fractional or compounded sizes
Strength: MUST · Verified by: `type-scale` and `spacing-scale` (inspector)

Font sizes, line heights, margins, paddings and gaps resolve to whole CSS px. Set font sizes in `rem` or `px`, never in `em` or `%` on nested elements, where 0.8333em of 16 px gives 13.333 px and nesting compounds it further. Fluid sizes built with `clamp()` and viewport units land on fractions at most widths; change sizes at breakpoints instead, or log the fluid step as an override.

*Why:* fractional sizes put text and edges on sub-pixel positions, which blurs them and creates near-misses, and they are never in the scale. Cites: TYP-06, LAY-05.

## Lines and icons

### CRF-08 · Hairlines land on whole device pixels
Strength: MUST · Verified by: `hairline-subpixel` (inspector, which also screenshots each line in Chromium, WebKit and Firefox to see whether it was snapped or blurred)

Hairlines and 1 px rules are `hairline.width` CSS px wide and fall on whole device pixels at every ratio in `hairline.dpr`. Draw them as borders, whose widths browsers snap to device pixels, and keep them off boxes placed by fractions (`translate(-50%)`, percentage widths, centring in an odd-width container) or scaled by transforms.

*Why:* a line that straddles two device pixels renders as two lighter pixels, so it looks thick and grey, or uneven along its length. CSS Values and Units Level 4 snaps border widths to whole device pixels (a width under one device pixel becomes one, a larger one rounds down), but not the position of the box. Cites: LAY-04; COL-02 where the line is a control boundary.

### CRF-09 · Icons are sized and stroked to their text
Strength: SHOULD · Verified by: manual: compute the expected stroke from the formula below, compare it with the computed `stroke-width`, and compare stroke and letter stem side by side in a 400% crop

An icon next to text takes its size from that text's type step and its stroke from the text's stem: `stroke_px = stem_em × text_px`, and on a 24-unit icon grid `stroke-width = stroke_px × 24 / icon_px` (`library/icons.md`). Size icons in `em` so they grow with the text at 200%, and centre them on the text's cap height (CRF-05 makes `align-items: center` do this).

*Why:* an icon heavier or lighter than its label breaks the line's rhythm, and a fixed-size icon is left behind when text grows. Cites: SHP-10, TYP-03.

### CRF-10 · Icons are centred on their visual mass
Strength: SHOULD · Verified by: manual: crop the rendered icon and its container at 400–800%, mark the container centre and the icon's ink centre, and compare by eye at 100%

Asymmetric glyphs (play triangles, arrows, chevrons, speech bubbles) are centred on their visual mass, not their bounding box. Start from the ink centroid (for a play triangle of width w, the centroid lies w/6 from the box centre towards the flat side, so full correction moves the triangle w/6 towards its point; full correction often looks overdone), judge at the rendered size, and record the final offset in the component.

*Why:* perception judges the mass of a shape, so a geometrically centred triangle looks off-centre. Cites: LAY-10.

## Corners

### CRF-11 · Radii come only from the set
Strength: MUST · Verified by: `radius` (inspector)

Every corner radius is 0, a value in `radius.scale`, a capsule where `radius.capsule` is true, or a radius derived under CRF-12.

*Why:* radii that are almost but not quite equal (2, 3, 4, 6 px) read as inconsistency. Cites: SHP-02, SHP-03.

### CRF-12 · Nested corners are concentric
Strength: MUST · Verified by: `radius-concentric` (inspector)

A rounded box inside another rounded box has radius `max(0, outer − inset)`, using the larger inset where horizontal and vertical insets differ. Compute it in CSS (`max(0px, var(--outer) - var(--inset))`) rather than choosing it. If `radius.nesting` is `independent`, the reason is logged.

*Why:* concentric corners keep the band between the shapes an even width; equal radii pinch it at the corners. Cites: SHP-01.

## Fonts and colour

### CRF-13 · Fonts load, or the failure shows as a defect
Strength: MUST · Verified by: `font-fallback` (inspector); manual: devtools "Rendered fonts" in the Computed panel, on a cold cache with network throttling

Every text renders in a family listed in `type.families`. Preload the font files the first viewport needs, choose `font-display` deliberately, and give each web font a metric-matched fallback. A fallback that renders in the finished page, including for single characters the font lacks, is a defect.

*Why:* a silent fallback changes widths, line breaks, trims and icon matching, and nobody notices until the page is seen up close. Cites: TYP-08, TYP-11; CSS Fonts Module Level 4 (`font-display`, `ascent-override`, `descent-override`, `line-gap-override`) and Level 5 (`size-adjust`).

How:

- **`font-display`.** `swap` for faces the design depends on, paired with a matched fallback so the swap does not move the layout. `optional` only for a face the design survives without, and log it, because a cold first visit may render the fallback. Avoid `block` for running text: it hides text during the block period.
- **Preload.** One or two WOFF2 files used in the first viewport: `<link rel="preload" href="…" as="font" type="font/woff2" crossorigin>`. The `crossorigin` attribute is required even for same-origin fonts.
- **Matched fallback.** A second `@font-face` over a local font, with values measured from both font files (Capsize and similar tools publish them):

  ```css
  @font-face {
    font-family: "Example Sans Fallback";
    src: local("Arial");
    size-adjust: <width ratio>%;
    ascent-override: <web ascent ÷ size-adjust>%;
    descent-override: <web descent ÷ size-adjust>%;
    line-gap-override: 0%;
  }
  ```

  As of 15 November 2026, `size-adjust` works in all major browsers (Baseline widely available since September 2023), but no released Safari supports `ascent-override`, `descent-override` or `line-gap-override`. In Safari the fallback matches width, not vertical metrics.
- **Coverage.** Check the brief's languages against the font's character set. A missing glyph falls back one character at a time.
- **Form controls.** Browsers give `button`, `input`, `select` and `textarea` their own font (in Chromium, Arial at 13.33 px) rather than inheriting the page's. Set `button, input, select, textarea { font: inherit; }`. The control looks right while it is empty and shows the wrong font as soon as it holds a value or a placeholder, so the inspector compares the computed family, not only rendered glyphs.

### CRF-14 · Text contrast is measured against what is rendered behind it
Strength: MUST · Verified by: `contrast` (inspector); manual: worst-case frame for moving backgrounds, and non-text parts against COL-02

Text meets 4.5 : 1, or 3 : 1 for large text, against the pixels actually rendered behind it, not the CSS background colour. Over images, video, canvas or WebGL, use a scrim or move the text until the worst-case region passes. For a moving background, the worst frame decides. Check APCA as a second measure for body text and dark mode.

*Why:* text passes on a solid colour and fails over the bright part of a photograph, and a video loop that passes on its first frame can fail on its tenth. Cites: COL-01, COL-02, COL-03, SHP-06, COL-10; WCAG 2.2 SC 1.4.3 and 1.4.11.

How:

- The inspector samples one screenshot with the text hidden. That covers static images, gradients, texture and the frame on screen at capture time.
- For video, animation and WebGL, capture frames across a full loop (for example every 250 ms), measure each, and keep the lowest ratio. Fix against that frame.
- A scrim can guarantee the floor regardless of content: white text over a black scrim of at least 54% opacity passes 4.5 : 1 even over pure white, since browsers composite in gamma-encoded sRGB. Use less only where the measured worst frame passes.
- Focus rings, control borders and meaningful icons need 3 : 1 against what is next to them (COL-02). The inspector's contrast check measures text, so check these by picking colours from a screenshot.

## States

### CRF-15 · Every state is designed and rendered
Strength: MUST · Verified by: manual: a state sheet (a page or route that renders every component in default, hover, focus-visible, active and disabled side by side, and every view in empty, loading and error), reviewed at 400% and also run through the inspector

Every interactive component has designed hover, `:focus-visible`, active and disabled states. Every view that holds content has designed empty, loading and error states. Focus is visible, at least 3 : 1, and never hidden under sticky headers. A pressed state appears within 0.1 s. Errors sit next to their cause and say how to fix it. Empty states name what belongs there and offer the action that fills it. Disabled is shown by more than colour.

*Why:* the full, default state is the one people see least, and the others are where they get stuck. Running the inspector on the state sheet applies the contrast, target and overflow checks to states it cannot reach on its own. Cites: FBK-04, INT-10, FBK-07, FBK-08, INT-08, FBK-01, FBK-03, COL-04; WCAG 2.2 SC 2.4.7 and 2.4.11.

## Resilience

### CRF-16 · Nothing overflows, clips or overlaps from 320 px up
Strength: MUST · Verified by: `overflow`, `clipping`, `overlap`, `text-resize` (inspector); manual: repeat the run with the WCAG 1.4.12 text-spacing overrides injected as a user stylesheet

At every width from 320 px, at 200% text, and with line height 1.5, paragraph spacing 2 em, letter spacing 0.12 em and word spacing 0.16 em, the page does not scroll sideways, no content spills out of its container, no text is cut off and no text overlaps other text. Truncation by ellipsis or line clamp is used only where the full text is reachable another way, and never in place of reflow at large text sizes.

Text sizes follow the browser's text size: set them in `rem`, or with `clamp()` whose limits are in `rem`. Text set in `px`, or in `vw` alone, stays the same size when a reader raises the default text size in their browser settings. Browser zoom still enlarges it, but the setting does not.

*Why:* people zoom, enlarge text and override spacing, and a layout that holds only at its design width fails them. Cites: LAY-03, TYP-03, TYP-05, FBK-04; WCAG 2.2 SC 1.4.4, 1.4.10 and 1.4.12.

### CRF-17 · Targets are at least the minimum size
Strength: MUST · Verified by: `target-size` (inspector)

Every pointer target is at least `targets.minimum` CSS px (never below 24) in both dimensions, or meets one of WCAG 2.5.8's exceptions: inline text links, enough spacing around it, an equivalent control, an unmodified browser control, or essential sizing. Aim for `targets.comfortable`, usually 44. Enlarge the hit area rather than the artwork where the design needs a small visible control.

*Why:* small or crowded targets cause missed and wrong taps, most of all for people with limited dexterity. Cites: INT-01, INT-02, INT-03; WCAG 2.2 SC 2.5.8.

## Motion

### CRF-18 · Reduce Motion is honoured
Strength: MUST · Verified by: manual: emulate `prefers-reduced-motion: reduce` (devtools Rendering panel, or a Playwright context with `reducedMotion: "reduce"`), record the page before and after, and confirm every movement follows `motion.reducedMotion`

Under `prefers-reduced-motion: reduce`, movement along x, y and z becomes what `motion.reducedMotion` says (a fade, an instant change, or nothing animated). Parallax, autoplaying loops, smooth scrolling and bounce stop. Nothing is communicated only by motion.

*Why:* large and repeated movement causes dizziness and nausea for some people, and some cannot perceive motion at all. Cites: MOT-08, MOT-02, MOT-01; Media Queries Level 5 (`prefers-reduced-motion`); WCAG 2.2 SC 2.3.3.

## Text details

### CRF-19 · Numbers that change or align use tabular figures
Strength: SHOULD · Verified by: manual: render the column or counter with 1111 and 0000 in adjacent rows (or let it tick) and check that right edges align and nothing shifts; confirm the font has the `tnum` feature

Tables, columns of figures, timers, counters and prices that update use `font-variant-numeric: tabular-nums`, aligned on the right or on the decimal point. Running text keeps proportional figures.

*Why:* proportional digits make columns ragged and make changing values jitter as their width changes. Cites: TYP-12.

### CRF-20 · The characters are the right ones
Strength: SHOULD · Verified by: manual: search the rendered text and source strings for straight quotes, `...`, hyphens between numbers, `x` in dimensions and double spaces

Use curly quotes and apostrophes, the ellipsis character, an en dash for ranges, an em dash for breaks, the minus sign in numbers and the multiplication sign in dimensions. All-caps text gets extra tracking and, where the font has it, the `case` feature.

*Why:* these are cheap signals of care, and screen readers handle the correct characters better. Cites: TYP-11, TYP-10.

## Review checklist

| Rule | What it asks | Verified by | Pass |
|---|---|---|---|
| CRF-01 | Spacing only from the scale, in rem | `spacing-scale`; manual: gaps at 200% text | |
| CRF-02 | Groups further apart than contents | manual: box-model overlay, ratio vs `groupRatioMin` | |
| CRF-03 | One gap between siblings of one kind | `sibling-gaps` | |
| CRF-04 | Shared edges, optical exceptions logged | `near-miss-edge` | |
| CRF-05 | Text trimmed to cap height and baseline | manual: 400% crop, cap-top and baseline gaps | |
| CRF-06 | Type only from the type scale | `type-scale`; manual: line height, weight, tracking | |
| CRF-07 | No fractional or compounded sizes | `type-scale`, `spacing-scale` | |
| CRF-08 | Hairlines on whole device pixels | `hairline-subpixel` | |
| CRF-09 | Icon size and stroke matched to text | manual: formula vs computed `stroke-width`, 400% crop | |
| CRF-10 | Icons centred on visual mass | manual: 400–800% crop, ink centre vs container centre | |
| CRF-11 | Radii only from the set | `radius` | |
| CRF-12 | Concentric nested corners | `radius-concentric` | |
| CRF-13 | Fonts load; no silent fallback | `font-fallback`; manual: rendered fonts on a cold cache | |
| CRF-14 | Contrast against rendered pixels | `contrast`; manual: worst frame, non-text 3 : 1 | |
| CRF-15 | Every state designed | manual: state sheet, also inspected | |
| CRF-16 | No overflow, clipping or overlap | `overflow`, `clipping`, `overlap`; manual: 1.4.12 overrides | |
| CRF-17 | Target size | `target-size` | |
| CRF-18 | Reduce Motion honoured | manual: emulated reduced motion, before and after | |
| CRF-19 | Tabular figures where numbers align or change | manual: 1111 / 0000 test, `tnum` present | |
| CRF-20 | Correct typographic characters | manual: text search | |

## Sources

Accessed 15 November 2026.

- W3C, CSS Inline Layout Module Level 3 (`text-box`, `text-box-trim`, `text-box-edge`), Editor's Draft: https://drafts.csswg.org/css-inline-3/
- web.dev, "New to the web platform in August", Rachel Andrew, 28 August 2026 (Safari 18.2, Chrome 133 and Firefox 154 make the `text-box` properties Baseline newly available): https://web.dev/blog/web-platform-08-2026
- Mozilla bug 2050141, "[text-box-trim] Set layout.css.text-box.enabled for all users" (shipping in Firefox 154, and the differences from Blink and WebKit): https://bugzilla.mozilla.org/show_bug.cgi?id=2050141
- Capsize, font metrics and leading-trim CSS: https://seek-oss.github.io/capsize and https://github.com/seek-oss/capsize
- W3C, CSS Fonts Module Level 4 (`font-display`, font metric overrides): https://www.w3.org/TR/css-fonts-4/
- MDN, `font-display`: https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display
- MDN, `size-adjust` (CSS Fonts Module Level 5; Baseline widely available since September 2023): https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust
- caniuse, `ascent-override` (not in released Safari): https://caniuse.com/mdn-css_at-rules_font-face_ascent-override
- Chrome for Developers, "Improved font fallbacks": https://developer.chrome.com/blog/font-fallbacks
- web.dev, "Best practices for fonts": https://web.dev/articles/font-best-practices
- MDN, `rel="preload"` (`crossorigin` required for fonts): https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preload
- W3C, CSS Values and Units Level 4, snapping a length as a line width (used for border widths): https://drafts.csswg.org/css-values-4/#snap-as-a-line-width
- P. Brosset, "CSS and device pixels": https://patrickbrosset.com/articles/2024-06-21-invasion-of-the-border-snappers/
- W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C, Understanding SC 1.4.10 Reflow: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- W3C, Understanding SC 1.4.12 Text Spacing: https://www.w3.org/WAI/WCAG22/Understanding/text-spacing
- W3C, Understanding SC 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C, Understanding SC 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C, technique G207 (non-text contrast against the least-contrasting background colour): https://www.w3.org/WAI/WCAG22/Techniques/general/G207
- WebAIM, contrast over images and gradients: https://webaim.org/articles/contrast/
- W3C, Media Queries Level 5 (`prefers-reduced-motion`): https://www.w3.org/TR/mediaqueries-5/
- Playwright, `reducedMotion` emulation: https://playwright.dev/docs/api/class-browser#browser-new-context
- ITTEN rules cited: `reference/ui/` (LAY, TYP, COL, SHP, MOT) and `reference/ux/` (INT, FBK); stroke formula in `library/icons.md`.
