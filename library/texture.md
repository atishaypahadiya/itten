# Texture

Use only when a project's brief asks for it. The parameters below were compiled into a stylesheet that ITTEN no longer ships; a project copies them into its own system.

ITTEN has two textures, grain and paper. Both are drawn by the browser from SVG `feTurbulence` noise, so no image files are shipped. Each comes on a 0–3 intensity ladder. Texture goes on grounds and display surfaces only, never under body text. The inspector's contrast check samples the rendered pixels, so text placed over texture is measured against the texture itself.

## How it is made

`feTurbulence` generates Perlin noise inside an SVG filter. Its parameters are `type` (`fractalNoise` gives soft, cloudy noise; `turbulence` gives sharper ridges), `baseFrequency` (higher is finer; two values give different x and y scales), `numOctaves` (layers of detail), `seed`, and `stitchTiles="stitch"`, which makes the tile repeat without a seam (W3C Filter Effects, §9.21; MDN). Jimmy Chion's CSS-Tricks article "Grainy Gradients" (2021) popularised layering this noise over a gradient and pushing its contrast with CSS filters.

ITTEN takes a quieter route that keeps the ground colour intact:

1. `feTurbulence` makes noise, as `fractalNoise`.
2. `feColorMatrix` replaces every pixel's colour with one tint and maps the noise to alpha, with a slope and an offset. The result is a field of tinted specks on a transparent tile.
3. The tile is a data URI in a CSS custom property. A `::before` layer behind the element's content shows it, and the layer's opacity sets the level.

Because the texture sits in its own layer at a fixed opacity, the ground colour underneath is never altered, and the contrast cost of each level can be measured once. The tint is warm brown (`oklch(30% 0.035 70)`) on light grounds, so cream stays cream instead of greying, and cream on dark grounds.

| | Grain | Paper |
|---|---|---|
| Noise | `fractalNoise`, frequency 0.9, 3 octaves | Two layers: mottle (frequency 0.012, 4 octaves) under fibre (0.7 × 0.35, 2 octaves) |
| Alpha mapping | 3 × noise − 1.35 | Mottle 1.8 × noise − 0.7; fibre 3 × noise − 1.45 |
| Tile | 256 px | 512 px |
| Reads as | Fine, even grain, like uncoated stock | Slow cloudy variation with a stretched fibre, like cotton paper |

The fibre layer's stretched frequency (0.7 across, 0.35 down) gives a slight horizontal direction, like the grain of laid paper. An earlier version with a much stronger stretch (0.035 × 0.5) looked like brushed metal and was dropped.

## The ladder

| Level | Opacity | Use |
|---|---|---|
| 0 | 0 | Off. |
| 1 | 0.04 | Felt rather than seen. Large grounds behind display type. |
| 2 | 0.09 | Visible. Poster and hero surfaces. |
| 3 | 0.16 | Display surfaces only. Never behind any running text, including captions. |

Measured in Chromium on a test page that has since been removed, 256 × 256 px samples. Y is relative luminance (WCAG); p1 is the darkest 1% of pixels.

| Ground | Texture | Level 1 mean Y | Level 2 mean Y | Level 3 mean Y | Level 3 p1 Y |
|---|---|---|---|---|---|
| Cream, Y 0.948 | Grain | 0.930 | 0.909 | 0.882 | 0.689 |
| Cream, Y 0.948 | Paper | 0.920 | 0.887 | 0.844 | 0.705 |
| Night, Y 0.006 | Grain | 0.007 | 0.009 | 0.012 | p99 0.039 |
| Night, Y 0.006 | Paper | 0.008 | 0.011 | 0.016 | p99 0.035 |

Near-black text on the darkest 1% of a level-3 grain over a cream ground (#FFF9E7) measured about 12:1, against 16.6:1 on plain cream. Contrast is not why texture stays out from under text. The noise breaks up letter edges at small sizes, and that costs legibility in a way a contrast ratio does not measure. So the rule stays: texture under display type only, from Title 2 (22 px) up.

## What to check by eye

- Texture tiles repeat at 256 or 512 px. On very wide grounds at level 3, look for a visible repeat.
- `feTurbulence` output is not identical across browser engines. The structure is the same, but fine detail differs, so check Safari and Firefox before relying on level 3.
- On print or in screenshots scaled down, grain can alias into moiré. Level 1 is the safe choice for anything that will be photographed or scaled.

## Sources

- W3C, *Filter Effects Module Level 1*, §9.21 `feTurbulence` (Working Draft, 18 December 2018). https://www.w3.org/TR/filter-effects-1/#feTurbulenceElement
- MDN, `<feTurbulence>`. https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence
- MDN, `<feColorMatrix>`. https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feColorMatrix
- J. Chion, *Grainy Gradients*, CSS-Tricks, 13 September 2021. https://css-tricks.com/grainy-gradients/
- WCAG 2.2 relative luminance. https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
- ITTEN rules used: COL-01 (`reference/ui/03-color-and-contrast.md`), TYP-02 (`reference/ui/02-typography.md`).
