# Icons

Use only when a project's brief asks for it.

ITTEN uses Lucide (ISC licence, lucide-static 1.73.0). Each icon is a stroked path on a 24-unit grid with round caps and joins, so its stroke width can be set at the point of use. That lets icons match the stem of the text beside them, as SHP-10 asks. The same cannot be done with Phosphor's raw SVGs, which are filled outlines in four fixed weights. Tabler can be adjusted the same way and has three times as many icons. Lucide was preferred for its published geometric rules (2 px stroke, 1 px padding, 2 px corner radius, 2 px minimum gaps, an optical-volume check against `circle` and `square`), which keep a re-stroked set even, and because ITTEN does not need 5,000 icons. The stroke rule is `stroke_px = stem_em × text_px`, with the stem taken from Atkinson Hyperlegible Next at the weight of the adjacent text (`research/type.md`). On the 24-unit grid that becomes `stroke_units = stroke_px × 24 / icon_px`. Next to Regular text the result is about 1.4–1.6 units, lighter than Lucide's default of 2.

## Comparison

| | Phosphor | Lucide (chosen) | Tabler |
|---|---|---|---|
| Licence | MIT | ISC; icons derived from Feather are MIT (both texts in LICENSE) | MIT |
| Package checked | `@phosphor-icons/core` 2.1.1 | `lucide-static` 1.73.0 | `@tabler/icons` 3.52.0 |
| Icon count | 1,512 per weight × 6 styles | 2,359 SVG files, 2,054 distinct drawings (the rest are aliases) | 5,491 outline + 1,054 filled |
| Grid | 256-unit viewBox; README says designed at 16 × 16 | 24 × 24 | 24 × 24 |
| Default stroke | Regular 16/256 = 1.5 on a 24 grid | 2 | 2 |
| Stroke adjustable per use | No. Raw SVGs are filled outlines (`fill="currentColor"`), so the weight is fixed by the file. | Yes. Stroked paths (`stroke-width="2"`, `fill="none"`). | Yes. Stroked paths. The README says every path is drawn to render well at other stroke widths. |
| Weights or styles | Thin 0.75, Light 1.125, Regular 1.5, Bold 2.25 (on a 24 grid, measured from `minus.svg`), plus Fill and Duotone | One style; weight set by stroke width | Outline (any stroke) and Filled |
| Caps and joins | Round (built into the outlines) | Round caps on open paths, round joins (required by the design guide) | Round caps and joins in every file; not written down as a rule |
| Corners | Rounded | 2 px radius on shapes 8 px or larger, 1 px on smaller ones, 2.41 px where diagonals meet at a right angle | Rounded (`rx` 2 on rectangles in the files checked); no published rule |
| Optical consistency | Strong, but only within each fixed weight | Published rules: 1 px padding, 2 px minimum gap, icons blurred against `circle`/`square` to compare visual weight | Large and varied set; no published rules, so density differs more between icons |

Phosphor's Regular weight (1.5) lands close to the right value next to Regular text. But one fixed weight cannot follow text from 13 to 22 px or from Regular to Semibold, and the next weights (1.125 and 2.25) are too far apart. Tabler would also work, and it is the fallback if Lucide lacks a glyph. Mixing the two sets is not recommended because their corner and spacing rules differ.

All three sets use round caps. Atkinson Hyperlegible Next has flat stroke ends, so caps are the one place where icon and text do not match. At these stroke widths (1–3 px) the difference is under a pixel and does not read as a mismatch.

## Matching stroke to text (SHP-10)

Lowercase stem of Atkinson Hyperlegible Next, measured from the outlines: Regular 400 = **0.0840 em**, Medium 500 = **0.1063 em**, Semibold 600 = **0.1223 em**.

```
stroke_px    = stem_em × text_px
stroke_units = stroke_px × 24 / icon_px     (value for stroke-width on the 24-unit viewBox)
```

| Icon px | Text px | Regular 400: px → `stroke-width` | Medium 500: px → `stroke-width` | Semibold 600: px → `stroke-width` |
|---|---|---|---|---|
| 16 | 13 | 1.09 → **1.64** | 1.38 → **2.07** | 1.59 → **2.39** |
| 20 | 15 | 1.26 → **1.51** | 1.59 → **1.91** | 1.83 → **2.20** |
| 24 | 17 | 1.43 → **1.43** | 1.81 → **1.81** | 2.08 → **2.08** |
| 32 | 22 | 1.85 → **1.39** | 2.34 → **1.75** | 2.69 → **2.02** |

Lucide's default of 2 units is 0.0833 of the icon size. That matches the Regular stem (0.0840 em) only when the icon is as large as the text. In ITTEN icons are 1.2–1.45 times the text size, so the default comes out a full weight heavier than Regular text, about Medium. The smallest stroke in the table is 1.09 CSS px, so none of the values fall below the one-pixel point where lines turn grey on 1× screens.

Two ways to apply it:

1. **Per pairing.** Store the `stroke-width` values above as tokens keyed by icon size and text weight, and set them on the `<svg>` (the files set `stroke-width` on the root, and the paths inherit it).
2. **From the text directly.** Set `vector-effect: non-scaling-stroke` on the paths, so the stroke is measured in CSS px, not grid units, and set `stroke-width: 0.084em` (or `0.1063em`, `0.1223em`) on the icon. Because the icon inherits the text's `font-size`, the stroke follows the text when people resize it (TYP-03). Lucide's own `nonScalingStroke` option uses the same mechanism.

The formula sets equal stroke and stem. That is the starting point, not the final value. An icon's lines are sparser than letters, so check each pairing by eye at the rendered size on cream (#FFF9E7). Move to the next weight column rather than nudging a single value.

## Files

27 SVGs copied unchanged from `lucide-static` 1.73.0 (`package/icons/`) into `library/assets/icons/lucide/`, with `LICENSE` beside them. Filenames are Lucide's current names, and the brief's older names are aliases of them:

`arrow-left.svg`, `arrow-right.svg`, `check.svg`, `x.svg` (close), `plus.svg`, `minus.svg`, `search.svg`, `menu.svg`, `settings.svg`, `info.svg`, `triangle-alert.svg` (warning; alias `alert-triangle`), `circle-alert.svg` (error; alias `alert-circle`), `circle-check.svg` (success; alias `check-circle`), `heart.svg`, `bookmark.svg`, `share.svg`, `download.svg`, `upload.svg`, `trash.svg`, `pencil.svg` (edit), `eye.svg`, `eye-off.svg`, `sun.svg`, `moon.svg`, `external-link.svg`, `chevron-down.svg`, `user.svg`.

Each file starts with an `<!-- @license lucide-static v1.73.0 - ISC -->` comment and the class `lucide lucide-<name>`. Keep both when inlining. The comment is the per-file licence notice.

## Sources

- Lucide icon design guide (canvas, stroke, caps, joins, radii, spacing, optical volume): https://lucide.dev/contribute/icon-design-guide
- Lucide stroke width and `nonScalingStroke`: https://lucide.dev/guide/basics/stroke-width
- Lucide repository and licence: https://github.com/lucide-icons/lucide, https://lucide.dev/license
- `lucide-static` on npm: https://www.npmjs.com/package/lucide-static
- Tabler Icons repository (count, 24 grid, 2 px stroke, MIT, stroke adjustment): https://github.com/tabler/tabler-icons
- `@tabler/icons` on npm: https://www.npmjs.com/package/@tabler/icons
- Phosphor repository (weights, 16 px design grid, MIT): https://github.com/phosphor-icons/homepage
- `@phosphor-icons/core` on npm (raw SVG assets): https://www.npmjs.com/package/@phosphor-icons/core
- MDN, `vector-effect`: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/vector-effect
- Text stem measurements: `research/type.md`
- ITTEN rules used: SHP-10 (`reference/ui/04-shape-depth-materials.md`), TYP-03 (`reference/ui/02-typography.md`).
