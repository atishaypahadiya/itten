# Teardown

A teardown reads each piece of inspiration as measurements. "Airy", "editorial" and "warm" are not findings. "The gap between groups is twice the gap inside them" is. The teardown is where the project's taste is turned into numbers that the system (`protocol/02-system.md`) can hold and the inspector can check.

The teardown records what the references do. It does not yet decide what the project will do. That happens in the "carry into the system" list at the end, and then in `itten.system.json`.

## Rules for every finding

- **Every finding cites its source.** For an image: the reference ID, and the region as a pixel box `x,y,w,h` in the image's own pixels. For a live site: the reference ID, the URL, a CSS selector and the viewport width. A finding without a source is opinion and is left out.
- **Every finding says whether it was measured or estimated.** Measured means read directly: a pixel count, a computed style, a picked colour from a calibrated image. Estimated means inferred: a size derived from an assumed typeface, an absolute value derived from an assumed scale, a colour from an uncalibrated photograph.
- **Ratios before absolutes.** A ratio between two things in the same reference does not depend on the scale of the image, so it can be measured even when the absolute size cannot. Most of what the system needs is ratios.
- **Measure several instances.** One gap is an accident. The same gap five times is a rule. Record how many instances a value was taken from.

## Tools

- **A screenshot or scan at known scale.** Prefer a flat scan or a screenshot to a photograph. Keep the original file; measure on it, not on a resized copy.
- **A ruler and overlay.** Any image editor with guides, a selection readout in pixels and a histogram. Put guides on edges, then read distances between guides.
- **Browser devtools, for live sites.** The computed-style panel gives exact font sizes, line heights, margins, paddings, gaps and radii. The box-model overlay shows spacing. Chrome's CSS Overview panel lists every colour, font family, size and line height used on the page.
- **A colour picker.** The devtools eyedropper on live sites. On images, a picker that reports sRGB values and can average an area (for example macOS Digital Color Meter set to sRGB, with an aperture of several pixels).
- **The inspector in distinct-value mode, for live sites.** Run it without `--system` and it reports how many distinct font sizes, spacing values and radii the page uses, instead of checking them against a scale:

  ```sh
  node itten/inspector/inspect.js https://reference.example/ --out teardown/R2
  ```

  Keep the output out of version control. Copy the counts and the values you use into `docs/teardown.md`.

## Calibrating the scale of an image

A live site measures itself in CSS px. An image does not. Before any absolute value is recorded from an image, find its scale and write it down with its uncertainty.

1. **Find a known dimension.** In order of preference:
   - a physical ruler or grey card placed in the shot or the scan;
   - the known size of the object: a page trim size, a standard paper size, a device's screen width in points;
   - a platform control of documented size, such as a 44 pt iOS row or button (INT-01), or a navigation bar of known height;
   - body text, from its x-height or cap height and an assumed body size. This is the weakest anchor, because it assumes both the size and the typeface's proportions.
2. **Measure it across as many pixels as possible.** Measure 100 mm of ruler, not 10. Measure 10 line pitches, not one. The reading error (usually ±1 to 2 px at each end) is then a small share of the total.
3. **Check for distortion.** Measure the same known length in a second place, ideally the opposite corner. A photograph of a page is rarely flat or square to the lens. If the two readings differ by more than about 1%, rescan or correct the perspective, or restrict absolute measurements to one region.
4. **Record the result.** For example: "R1: 23.62 px per mm, from a 100 mm ruler segment measured as 2,362 px; ±0.5%, from a second reading of 2,350 px in the opposite corner." Every absolute value from that image carries at least that uncertainty.

For screenshots, check the device pixel ratio first. A screenshot from a 2× display has two image pixels per CSS px. The file's resolution metadata (144 ppi on many 2× screenshots) is a hint, not proof; confirm against a known control.

For print references, the absolute scale matters less than it seems. A 9.5 pt body in a magazine does not become a 9.5 pt body on screen. The system fixes the screen body size from the brief and the platform minimums (TYP-01), then applies the ratios measured here.

## What to measure

### Type-size ratios

What: each distinct text size, its ratio to the body size, and the ratio between neighbouring steps.

How:

1. Identify the body text: the size used for the longest running text.
2. On a live site, read `font-size` and `line-height` from computed styles for each text role, at each viewport width you record. Note whether sizes are fluid (changing with width).
3. On an image, measure cap height (flat capitals such as H, E, T) or x-height (flat lowercase such as x, z), not the full height of the line. Within one typeface, the ratio of cap heights is the ratio of sizes, so this ratio is measured. Across two different typefaces it is only an estimate, because their cap heights are different shares of the em.
4. Measure line pitch (baseline to baseline) over at least five lines and divide. The ratio of line pitch to cap height, or to body size once estimated, gives the leading.
5. List the steps in order and compute: each step ÷ body, and each step ÷ the step below it.

Look for the pattern, not only the numbers: steps close together near the body and one far jump to display; an even ratio throughout; or two separate scales for text and display.

### Spacing rhythm

What: the base unit, the gaps that repeat, and the ratio between the gap separating groups and the gap inside them (LAY-06).

How:

1. Measure every vertical gap in a column, and every horizontal gap in a row, between visible edges (ink or box edges, consistently one or the other). On a live site, read margins, paddings and `gap` from computed styles, and count distinct values with the inspector.
2. Tally the values. Repeated values are the rhythm. Values that appear once are either deliberate exceptions or noise.
3. Find the largest unit that divides most repeated values within the measurement uncertainty. In print this is often the baseline (the body line pitch).
4. For each grouped region (a card, a form section, a list with headings), take the largest gap inside a group and the gap between groups, and record the ratio. LAY-06 asks for at least 2; record what the reference actually does.

### Shared edges and grid

What: how many distinct alignment edges there are (LAY-09), and the column grid: number of columns, column width, gutter, outer margins and maximum content width.

How:

1. Draw vertical guides on every left and right edge of text blocks, images and controls. Merge guides within 1 px (in the reference's own pixels) and count the rest. Do the same for top edges and baselines across rows.
2. Note which edges are shared by many elements and which serve only one. An edge used once is a candidate for a near-miss in the reference itself.
3. Infer columns from repeated edge spacing. Measure gutter and margins directly. On a live site, check whether the page uses a CSS grid (devtools shows grid overlays) and read its tracks; otherwise infer from edges as on an image.
4. For sites, record the grid at more than one width, at least the narrowest and widest you can observe. Note where the column count changes.

### Density

What: how much is on the page, and how much is not.

How:

- **Text per area:** characters per line (count 10 lines and average; compare with TYP-04's 45–90) and lines per column or per screen.
- **Whitespace share:** the share of the area with no ink. On an image, downsample, threshold just below the ground colour, and read the share of ground-coloured pixels from the histogram. Record the threshold, because the result depends on it.
- **Items per screen:** for a site, the number of distinct items (cards, rows, products, articles) visible in one viewport at each recorded width.

### Corner relationships

What: every radius in use, and whether nested rounded shapes are concentric (SHP-01).

How:

1. On a live site, read `border-radius` from computed styles, and count distinct radii with the inspector.
2. On an image, fit a circle to the corner: measure the distance along each edge from where the straight edge starts to curve to the corner's tangent point. Small radii (below about 6 px at 1×) cannot be measured reliably from an image; mark them estimated.
3. For each nested pair, record the outer radius, the inset between the two edges, and the inner radius. Concentric means inner = max(0, outer − inset). Record whether the reference follows this or not, and whether it looks deliberate.
4. Note capsules (radius at least half the shorter side) separately from fixed radii.

### Colour roles and proportions

What: which colour does which job, and how much area each takes.

How:

1. Pick each distinct colour from a flat region, averaging over an area rather than one pixel. On a photograph without a grey card or colour target in the shot, every colour is estimated: white balance and exposure change it.
2. Give each colour its role: ground, surface, text, secondary text, accent, edge, imagery, status. A colour with two roles is a finding in its own right (COL-05).
3. Measure area shares: the share of the composition each role occupies, from a posterised copy and its histogram, or by summing the areas of measured boxes. Record photographs and illustrations as their own share.
4. Measure contrast for each text and ground pair you find (WCAG ratio, and APCA where useful, COL-01, COL-03). A reference that passes on paper may fail on screen, and the reverse.
5. Optional: compare the area shares with Itten's contrast of extension, which balances colours by area in inverse proportion to their lightness (after Goethe's light values: yellow 9, orange 8, red 6, green 6, blue 4, violet 3). It explains why a small accent can hold its own against a large ground. Use it to describe the reference, not as a target.

### Texture

What: whether there is a texture (grain, paper, halftone, photographic noise, scan artefacts), its scale, and where it sits.

How:

1. Crop a flat region of ground at 1:1 and at 400%. Measure the size of the visible features (grain size, fibre length, halftone pitch) in mm or px using the calibrated scale.
2. Record where it appears: everywhere, only on grounds, only in imagery, or behind text.
3. Convert its scale to CSS px at the scale the system will use. A paper fibre of 0.2 mm may be below one CSS px on screen; reproduced at that size it disappears, and enlarged it becomes a different texture.
4. If text sits on the texture, measure the darkest and lightest pixels behind the text, not the average.

### What is deliberately broken

What: each place the reference departs from its own pattern or from a rule in `reference/`, whether it looks deliberate, and what it costs.

How: for each break, record what the pattern is, how it is broken, what the break achieves, and what it costs, measured where possible. Examples: a headline crossing the gutter into an image; one element off the grid; text over a photograph below the contrast floor; a missing state; a target under 24 px. Cite the rule the break departs from.

The cost decides what happens next. A break that only costs regularity may be carried, with an override logged when it is built. A break that costs a floor (contrast, target size, reflow) is not carried into anything people must read or operate (`ITTEN.md`, precedence).

### Motion, for live references

If a reference moves, record durations and easings from the devtools Animations panel or from computed `transition` and `animation` values, and note what it does under reduced motion. An image has no motion; the system then takes motion from the brief (`protocol/02-system.md`).

## Output template

Write the teardown to `docs/teardown.md` in the project.

```markdown
# Teardown: <project>

ITTEN version: <commit or tag>
Date: <yyyy-mm-dd>

## References

| ID | Reference | Kind | Scale | Uncertainty | Notes |
|---|---|---|---|---|---|
| R1 | <file path> | image | <px per mm, or px per CSS px> | <± %> | <how the scale was found> |
| R2 | <URL> | live site | CSS px | exact | <viewport widths recorded> |

## Findings

Value: a number with its unit, or a ratio. Source: reference ID and region
(image: `x,y,w,h` in image px; site: URL + selector + viewport width).

### Type
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|

### Spacing
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|

### Edges and grid
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|

### Density
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|

### Corners
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|

### Colour
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|

### Texture
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|

### Deliberately broken
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|

## Carry into the system
- <relationship or value> (from <finding source>) → <system field>

## Deliberately not carried
- <finding> (<source>): <reason>
```

## Worked example

Both references below are hypothetical. They show the method, not values for any project.

R1 is a magazine spread photographed flat at 1:1 with a steel ruler along the bottom edge. A 100 mm segment of ruler measures 2,362 px, so the scale is 23.62 px per mm. The same 100 mm measures 2,350 px in the opposite corner, so absolute values from R1 carry ±0.5%. There was no grey card in the shot, so R1's colours are estimates.

R2 is a live site, `https://example.com/journal/`, recorded at 375 and 1440 px wide.

```markdown
## References

| ID | Reference | Kind | Scale | Uncertainty | Notes |
|---|---|---|---|---|---|
| R1 | refs/r1-spread.jpg | image | 23.62 px per mm | ±0.5% | 100 mm ruler in shot; no grey card |
| R2 | https://example.com/journal/ | live site | CSS px | exact | 375 and 1440 px |

### Type
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|
| Body line pitch | 4.59 mm (13.0 pt), over 20 lines | measured | R1 @ 5790,2600,1460,2170 |
| Body cap height | 2.4 mm | measured | R1 @ 5790,2600,1460,2170 |
| Body size | ≈ 9.7 pt, assuming a cap height of 0.70 em | estimated | R1 @ 5790,2600,1460,2170 |
| Caption ÷ body (cap heights, same family) | 0.79 | measured | R1 @ 5979,6400,1270,180 |
| Standfirst ÷ body (same family) | 1.50 | measured | R1 @ 5790,1800,4386,260 |
| Headline ÷ body (display family) | ≈ 17 | estimated | R1 @ 3900,520,3600,1000 |
| Pattern | text steps 1.26 and 1.5 apart; one jump of ≈ 11× to display | measured, except the display step | R1 |
| Body | 18 px / 28 px | measured | R2 `article p` @1440 |
| Headline | 64 px / 68 px at 1440; 40 px / 44 px at 375 | measured | R2 `article h1` @1440, @375 |
| Distinct font sizes | 9 | measured | R2, inspector without system @1440 |

### Spacing
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|
| Base unit | body line pitch, 4.59 mm | measured | R1 |
| Space above subheads | 9.2 mm = 2 lines (6 instances) | measured | R1 @ 5790,4100,1460,90 and five others |
| Between-group ÷ within-group | 2.0 (subhead space ÷ line pitch) | measured | R1 |
| Distinct spacing values | 23, of which 6 cover 80% of instances | measured | R2, inspector without system @1440 |
| Card gap ÷ gap inside card | 32 ÷ 12 = 2.7 | measured | R2 `.card-list` @1440 |

### Edges and grid
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|
| Columns per page | 3 × 61.9 mm, gutter 4.6 mm (≈ 1 line) | measured | R1, right page |
| Margins | inner 15 mm, outer 20 mm | measured | R1, right page |
| Distinct left edges, right page | 4: three column starts and one caption indent | measured | R1, right page |

### Density
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|
| Characters per line | 52 (mean of 10 lines) | measured | R1 @ 5790,2600,1460,2170 |
| Unprinted share of the spread | 41% (threshold L* 90, 1/8 downsample) | measured | R1, whole image |
| Articles per viewport | 3 at 1440; 1 at 375 | measured | R2 `main` |

### Corners
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|
| Radii in print | none: photographs and rules square-cut | measured | R1 |
| Radii on site | 0, 4 px, capsule | measured | R2, inspector without system @1440 |
| Nesting | card 4 px with image inset 16 px also at 4 px: not concentric (SHP-01 gives 0) | measured | R2 `.card img` @1440 |

### Colour
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|
| Ground (paper) | ≈ #F2EEE4 | estimated (no grey card) | R1 @ 9000,6900,40,40 |
| Text ink | ≈ #231F1C | estimated | R1 @ 5790,2600,1460,2170 |
| Accent red: folio, drop cap, pull-quote rule only | ≈ #C8341F; 0.6% of the spread | estimated colour; measured share | R1 |
| Photograph | full bleed on the left page, 50% of the spread | measured | R1 @ 0,0,5432,7086 |
| Body text contrast | 14.2 : 1 | measured | R2 `article p` @1440 |

### Texture
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|
| Uncoated stock, visible fibre | features 0.1–0.3 mm; on grounds only | measured | R1 @ 9000,6620,400,400 at 400% |

### Deliberately broken
| Finding | Value | Measured / estimated | Source |
|---|---|---|---|
| Headline crosses the spine from the photograph's sky onto the text page | worst-case contrast 2.4 : 1 against the sky (fails the 3 : 1 large-text floor, COL-01) | estimated (colours from an uncalibrated photograph) | R1 @ 3900,520,3600,1000 |
| Caption indent off the column edges | 8 mm from column 1; one extra edge (LAY-09) | measured | R1 @ 5979,6400,1270,180 |

## Carry into the system
- Text steps close together, one far jump to display (R1 type pattern) → `type.scale`: ratios 0.79, 1, 1.5 applied to the screen body size; display step set by what fits at 320 px, not by the 17× print ratio.
- Leading of 1.34 × body size (R1 line pitch ÷ estimated body; R2 28 ÷ 18 = 1.56 noted as the looser alternative) → body `lineHeight`.
- Group ratio of at least 2 (R1 subhead space; R2 card gaps 2.7) → `spacing.groupRatioMin`: 2.
- Square corners on imagery; capsule for controls only (R1, R2) → `radius.scale`, `radius.capsule`, `radius.nesting`: concentric.
- Accent used in under 1% of the area, on navigation and markers only (R1) → `colour.roles.accent` with `share`, and one role only (COL-05).

## Deliberately not carried
- Headline over the photograph at 2.4 : 1 (R1): fails a floor for text people must read. A display headline over imagery gets a scrim or moves off the image.
- Non-concentric card images (R2): the pinched band is what SHP-01 exists to prevent.
- Paper fibre at 0.1–0.3 mm (R1): below one CSS px at screen scale. Revisit only if the brief asks for texture (`library/texture.md`).
- The 23 spacing values on R2: carried as the six that cover 80% of instances, not all 23.
```

## How the teardown feeds the system

`protocol/02-system.md` works through `docs/teardown.md` category by category and turns the "carry into the system" list into `itten.system.json`.

| Teardown | System field |
|---|---|
| Type-size ratios and leading | `type.scale`: ratios applied to a body size fixed from the brief and TYP-01 |
| Typefaces identified | `type.families`, with fallbacks for metric matching |
| Base unit and repeated gaps | `spacing.scale` |
| Between-group ÷ within-group ratio | `spacing.groupRatioMin` |
| Columns, gutters, margins, widths | `grid.breakpoints` |
| Radii, capsules, nesting | `radius.scale`, `radius.capsule`, `radius.nesting` |
| Colour roles, sources, area shares | `colour.roles` (`source` names the reference and region; `share` the measured proportion) |
| Text and ground pairs | `colour.pairs` |
| Motion, for live references | `motion` |
| Texture | not in the system file; the project's own CSS, if the brief asks for it |

Three things carry over unchanged. Values marked estimated stay marked: they are confirmed by rendering a test in the project before they are relied on. The "deliberately not carried" list keeps the system from quietly picking up a reference's defects. And every value in the system can be traced back, through its source, to a finding here. When the brief or the inspiration changes, the teardown is updated first and the system second.

## Sources

Accessed 15 November 2026.

- Chrome DevTools, CSS Overview panel: https://developer.chrome.com/docs/devtools/css-overview
- W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WebAIM, contrast over images and gradients (test the area where contrast is lowest): https://webaim.org/articles/contrast/
- Goethe's light values as used in Itten's contrast of extension (yellow 9, orange 8, red 6, violet 3, blue 4, green 6): https://people.csail.mit.edu/fredo/ArtAndScienceOfDepiction/ScottColorTalk/page31.html
- Johannes Itten's seven colour contrasts: https://en.wikipedia.org/wiki/Johannes_Itten
- ITTEN rules cited: LAY-06, LAY-09 (`reference/ui/01-layout-and-spacing.md`); TYP-01, TYP-04 (`reference/ui/02-typography.md`); COL-01, COL-03, COL-05 (`reference/ui/03-color-and-contrast.md`); SHP-01 (`reference/ui/04-shape-depth-materials.md`); INT-01 (`reference/ux/01-interaction-and-targets.md`).
