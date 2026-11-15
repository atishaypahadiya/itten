# Typefaces

Use only when a project's brief asks for it.

ITTEN uses two families (TYP-08). Bodoni Moda by Owen Earl (indestructible type) is the display face, for posters, hero moments and headings from 22 px up. It is a Didone, the high-contrast style that fashion magazines have used for mastheads and headlines since the 1930s, and it has a variable optical-size axis (6–96) that keeps its hairlines from breaking up at heading sizes. Atkinson Hyperlegible Next, from Braille Institute with Applied Design Works and Letters from Sweden, is the text face, for body, controls and data at 11–17 px. Its letterforms were drawn so that easily confused characters (I l 1, O 0, B 8) look different, and the original family was tested with low-vision readers during design. It has variable weight from 200 to 800, tabular figures, case-sensitive forms and the correct quotes, dashes and minus sign. Both are under the SIL Open Font License 1.1. Both files are subset from the upstream variable fonts so they keep every OpenType feature; the Fontsource builds strip `case`, `smcp`, `onum` and the stylistic sets.

## Display face

| Candidate | Foundry, licence | Variable axes | Notes |
|---|---|---|---|
| **Bodoni Moda** (chosen) | Owen Earl, indestructible type; OFL 1.1 | `wght` 400–900, `opsz` 6–96 | True Didone. Optical sizes keep hairlines sturdy at 20–30 px and fine at 96 px. Upright and italic. Has `smcp`, `c2sc`, `onum`, `lnum`, `tnum`, `case`, `ss01`–`ss03`. Full Latin Extended-A. |
| Libre Bodoni | Pablo Impallari, Rodrigo Fuenzalida; OFL 1.1 | `wght` 400–700 | A text Bodoni with moderate contrast. Too quiet for posters, and it has no optical sizes. Widest coverage of the four (Vietnamese included). |
| Gloock | Duarte Pinto; OFL 1.1 | none (one weight) | High contrast and well made, but a single weight gives no range for hierarchy and no small-size optical master. |
| DM Serif Display | Colophon Foundry, Frank Grießhammer; OFL 1.1 | none (one weight) | A transitional display serif, softer than a Didone. One weight, no tabular figures, no Latin ẞ. |

Playfair Display was not shortlisted: it is one of the most common open serif defaults, and Bodoni Moda does the same job with a clearer Didone lineage and real optical sizes.

The fashion link is documented. Alexey Brodovitch made Didot the signature face of *Harper's Bazaar* in the 1930s, *Vogue* settled on all-capitals Didone banner headlines after 1955, and Fabien Baron's 1992 *Harper's Bazaar* redesign brought back a digital Didot (Abbott Miller, "Through thick and thin", *Eye* 65, 2007). Bodoni and Didot are the two founders of the style.

Details from `BodoniModa[opsz,wght].ttf` (google/fonts, upstream commit 30ce6cd):

- Version 2.005, units per em 2000.
- Axes: `wght` 400–900 (default 400), `opsz` 6–96 (default 11). With `font-optical-sizing: auto` (the CSS default) the browser sets `opsz` to the font size in px, so it caps at 96 above 96 px.
- GSUB features in the shipped Latin file: `aalt c2sc case ccmp frac liga lnum locl onum ordn pnum smcp ss01 ss02 ss03 sups tnum`. GPOS: `kern mark`.
- Default figures are proportional lining. `onum` gives oldstyle figures and `tnum` tabular ones.
- Ascender 0.75 em and descender 0.25 em. They meet exactly at a line height of 1.0, so display leading stays at or above 1.04. Accented capitals reach 0.975 em and will touch descenders on the line above at that leading, so multi-line display headings with accented capitals need one more step of leading.
- x-height 0.46 em. The face is not used below 22 px.

## Text face

| Candidate | Foundry, licence | Axes | Figures and features | Latin coverage | x-height | Legibility evidence |
|---|---|---|---|---|---|---|
| **Atkinson Hyperlegible Next** (chosen) | Braille Institute, Applied Design Works, Letters from Sweden; OFL 1.1 | `wght` 200–800, upright and italic | Proportional lining by default; `tnum`, `pnum`, `case`, `frac`, `sups`, `ordn`, `kern`. No oldstyle figures, no stylistic sets. | Latin-1 and most of Latin Extended-A, plus Ș ș Ț ț ẞ. Not Vietnamese. | 0.496 em | Drawn for low-vision readers. The original family was tested character by character, then in words and sentences, with low-vision participants run by Braille Institute staff. |
| Public Sans | USWDS, derived from Libre Franklin; OFL 1.1 | `wght` 100–900 | `tnum`, `pnum`, `lnum`, `onum`, `ss01`; no `case` | Latin incl. Vietnamese | 0.517 em | Built for US government sites; no published legibility testing. |
| Source Sans 3 | Paul D. Hunt, Adobe; OFL 1.1 | `wght` 200–900 | Tabular by default, `pnum`, `onum`, `case`, `smcp`, ten stylistic sets | Widest: Latin incl. Vietnamese, Greek, Cyrillic | 0.486 em | Long record in interfaces; no specific legibility study. |
| Inter | Rasmus Andersson; OFL 1.1 | `wght` 100–900, `opsz` 14–32 | Full set upstream (`tnum`, `case`, `cv`, `ss`) | Wide | 0.546 em | Designed for screens. It is the most common interface default, which is why it was set aside. |

Atkinson Hyperlegible Next was chosen because the brief weights legibility evidence heavily, and it is the only candidate designed and tested for readers who struggle to tell characters apart. That helps with data, codes and prices, where an I/l/1 or O/0 mix-up is an error, not just a matter of style. It has every feature TYP-11 and TYP-12 need. The trade-offs are narrower Latin coverage (see below) and a smaller x-height than Inter, so 11 px text looks smaller than 11 px SF Pro. Keep 11 px for single-line captions only (TYP-01 says custom faces may need more than the minimum).

The evidence has limits. The testing was done on the original 2019 Atkinson Hyperlegible, and it is reported through Braille Institute and designer interviews, not in a peer-reviewed paper. Braille Institute presented a quantitative study with low-vision readers at CSUN 2024, but no figures were found in public sources. Next is a 2024–25 redraw that keeps the same distinguishing features.

Details from `AtkinsonHyperlegibleNext[wght].ttf` and `AtkinsonHyperlegibleNext-Italic[wght].ttf` (google/fonts, upstream commit 7925f50):

- Version 2.001, units per em 1000. Font designers listed in the file: Elliott Scott, Megan Eiswerth, Linus Boman, Theodore Petrosky, Letters from Sweden. Manufacturer: Applied Design Works, Letters from Sweden.
- Axis: `wght` 200–800, default 400, with 7 named instances. Regular (400), Medium (500) and Semibold (600) are all available, so the light weights are not needed (TYP-02).
- GSUB: `aalt case ccmp frac locl ordn pnum sups tnum`. GPOS: `kern mark mkmk`.
- Default figures are proportional (advances 407–648 units). `tnum` sets every digit to 632 units. Use `font-variant-numeric: tabular-nums` in tables, timers and changing prices (TYP-12).
- TYP-11 characters are all present: ‘ ’ “ ” – — − × … €.
- Gaps in Latin Extended-A: Ĉ ĉ Ĝ ĝ Ĥ ĥ Ĵ ĵ Ŝ ŝ Ŭ ŭ (Esperanto), Ŋ ŋ (Sámi), Ĩ ĩ Ũ ũ Ō ō Ŏ ŏ Ĕ ĕ Ĭ ĭ Ŗ ŗ Ŧ ŧ ĸ Ŀ ŀ ŉ ſ. Latin-1 lacks µ (U+00B5), so write units in micro with a fallback in the stack or as "u" in data. Vietnamese is not covered. Missing glyphs fall back to the next family in the `font-family` stack (`system-ui, sans-serif`).

## Stem measurements

Vertical stem thickness measured from the glyph outlines. The variable font was instanced at each weight with fontTools, outlines were flattened, and the width was taken along a horizontal line through the stem (x-height × 0.45 for `n`, × 0.5 for `l` and `i`, cap height × 0.25 for `H`).

| Atkinson Hyperlegible Next | n | l | i | H |
|---|---|---|---|---|
| Regular 400 | 84.0 u = **0.0840 em** | 84.0 u | 84.0 u | 94.0 u (0.0940 em) |
| Medium 500 | 106.3 u = **0.1063 em** | 106.3 u | 106.6 u | 115.0 u (0.1150 em) |
| Semibold 600 | 122.3 u = **0.1223 em** | 122.3 u | 122.8 u | 130.0 u (0.1300 em) |

Units per em is 1000. The step from 400 to 500 adds 27% and the step from 500 to 600 adds 15%, so the weight axis is not linear in stem width. For comparison, Inter's lowercase stem is 0.0879 em at 400 and 0.1074 em at 500, and Public Sans's is 0.0925 em and 0.1070 em. `research/icons.md` uses these values to set icon stroke widths (SHP-10).

## Type scale

The scale comes from the iOS Dynamic Type defaults (TYP-06), with 1 pt = 1 CSS px and rem values at a 16 px root, plus three display steps for poster and hero use. Use these steps and no others.

| Step | Face | Weight | Size px / rem | Leading px / rem | Ratio | Tracking (em) |
|---|---|---|---|---|---|---|
| Display L | Bodoni Moda | 400 | 96 / 6 | 100 / 6.25 | 1.04 | 0 |
| Display M | Bodoni Moda | 400 | 68 / 4.25 | 72 / 4.5 | 1.06 | 0 |
| Display S | Bodoni Moda | 400 | 48 / 3 | 52 / 3.25 | 1.08 | 0 |
| Large Title | Bodoni Moda | 400 | 34 / 2.125 | 41 / 2.5625 | 1.21 | 0 |
| Title 1 | Bodoni Moda | 400 | 28 / 1.75 | 34 / 2.125 | 1.21 | 0 |
| Title 2 | Bodoni Moda | 400 | 22 / 1.375 | 28 / 1.75 | 1.27 | 0 |
| Title 3 | Atkinson Hyperlegible Next | 400 | 20 / 1.25 | 25 / 1.5625 | 1.25 | −0.008 |
| Headline | Atkinson Hyperlegible Next | 600 | 17 / 1.0625 | 22 / 1.375 | 1.29 | −0.005 |
| Body | Atkinson Hyperlegible Next | 400 | 17 / 1.0625 | 22 / 1.375 | 1.29 | −0.005 |
| Callout | Atkinson Hyperlegible Next | 400 | 16 / 1 | 21 / 1.3125 | 1.31 | −0.004 |
| Subhead | Atkinson Hyperlegible Next | 400 | 15 / 0.9375 | 20 / 1.25 | 1.33 | −0.003 |
| Footnote | Atkinson Hyperlegible Next | 400 | 13 / 0.8125 | 18 / 1.125 | 1.38 | +0.004 |
| Caption 1 | Atkinson Hyperlegible Next | 400 | 12 / 0.75 | 16 / 1 | 1.33 | +0.008 |
| Caption 2 | Atkinson Hyperlegible Next | 400 | 11 / 0.6875 | **15 / 0.9375** | 1.36 | +0.010 |

**Face split.** Title 2 (22 px) and larger use the display face. At 22 px, Bodoni Moda's `opsz` is 22, which still has sturdy hairlines. Title 3 and smaller are functional text and use Atkinson. Weights follow iOS, where only Headline is Semibold. Use Medium (500) for control labels if they need more presence than Regular. Changing one attribute per level (TYP-07): Headline differs from Body only in weight, and Title 3 differs from Body only in size.

**Display steps.** iOS stops at 34 px, which is too small for a poster or hero. The three added steps continue from Large Title by a factor of √2 (34 × 1.414 = 48.1, 48 × 1.414 = 67.9, 68 × 1.414 = 96.2). √2 is the ISO 216 paper ratio (A4 to A3), so each step is the next poster size up, and every value sits on the 4 px grid (LAY-05). Leading tightens from 1.08 to 1.04 as size grows: at these sizes the space between lines looks larger than the same ratio at body sizes, and display lines are short (one to three lines). Leading never drops below 1.04 because Bodoni Moda's ascender and descender together measure exactly 1.0 em. These steps are for display mode only. They are never used for running text, so TYP-05 does not apply.

**Leading outside 1.2–1.45.** In the iOS set only Caption 2 (11/13, 1.18) falls below 1.2, and Large Title (1.206) and Title 1 (1.214) are just above it. Caption 2 is raised to 11/15 (1.36), following the trend of the small steps (Footnote 1.38, Caption 1 1.33) and keeping the line height on whole pixels. Large Title and Title 1 keep their iOS values because they are headings, not body text, and pass the 1.2 floor. Display S, M and L are deliberately below 1.2 and are display-only.

**Tracking.** TYP-09 asks custom fonts to loosen small sizes slightly and to tighten mid and display sizes. Atkinson's spacing is generous on purpose, as part of its legibility design, so the text values are about a quarter of Apple's SF Pro values: +0.010 em at 11 px down to −0.005 em at 17 px and −0.008 em at 20 px. At 17 px, −0.005 em is −0.085 px, a barely visible change. Display tracking is 0 at every step. TYP-09 asks for tighter display sizes, but Bodoni Moda's optical-size axis already redraws the letters for each size: with `font-optical-sizing: auto` the browser sets `opsz` to the font size, so 96 px text uses the display master, which is fitted tighter. Measured in Chromium, "Contrast of extension" set at 96 px is 929.5 px wide at `opsz` 96 and 945.6 px at `opsz` 11: 1.7% narrower, roughly −0.008 em per letter, without any tracking. Negative tracking on top of that is on the owner's list of patterns to avoid, so it is left out until a rendered comparison shows it is needed. Tightening the display steps (for example −0.01 em at 68 and 96 px) is an open decision. All these values are starting points, to be checked by eye at the rendered size on cream (#FFF9E7). All-caps text overrides them with +0.05 to +0.12 em (TYP-10) and also turns on `case` (`font-feature-settings: "case"`) so punctuation and dashes align with capitals. Kerning stays on everywhere (`font-kerning: normal`).

**User overrides.** Every value is in rem or em, so the scale follows browser text-size settings (TYP-03), and nothing depends on a fixed line height, so WCAG 1.4.12 overrides do not break the layout (TYP-05).

## Files

Subset from the upstream variable TTFs in google/fonts with `fontTools.subset` 4.61.0 (`--layout-features='*' --name-IDs='*' --flavor=woff2`). The unicode ranges are Google Fonts' `latin` and `latin-ext` ranges, the same ones Fontsource uses. Bodoni Moda italic is not included because the display face is not used in italic.

| File | Bytes |
|---|---|
| `library/assets/fonts/bodoni-moda/bodoni-moda-latin-opsz-wght-normal.woff2` | 57,696 |
| `library/assets/fonts/bodoni-moda/bodoni-moda-latin-ext-opsz-wght-normal.woff2` | 30,508 |
| `library/assets/fonts/bodoni-moda/OFL.txt` | 4,400 |
| `library/assets/fonts/atkinson-hyperlegible-next/atkinson-hyperlegible-next-latin-wght-normal.woff2` | 33,920 |
| `library/assets/fonts/atkinson-hyperlegible-next/atkinson-hyperlegible-next-latin-ext-wght-normal.woff2` | 18,944 |
| `library/assets/fonts/atkinson-hyperlegible-next/atkinson-hyperlegible-next-latin-wght-italic.woff2` | 37,540 |
| `library/assets/fonts/atkinson-hyperlegible-next/atkinson-hyperlegible-next-latin-ext-wght-italic.woff2` | 20,124 |
| `library/assets/fonts/atkinson-hyperlegible-next/OFL.txt` | 4,431 |

Neither OFL.txt names a Reserved Font Name, so the subset files can keep the family names. A page that uses only the normal Latin files of both families loads 91.6 KB of fonts.

Example `@font-face` (one shown; the others follow the same pattern):

```css
@font-face {
  font-family: "Atkinson Hyperlegible Next";
  src: url("atkinson-hyperlegible-next-latin-wght-normal.woff2") format("woff2");
  font-weight: 200 800;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
    U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
    U+2212, U+2215, U+FEFF, U+FFFD;
}
```

For Bodoni Moda, declare `font-weight: 400 900`. Its `opsz` axis is driven by `font-optical-sizing: auto` and needs no declaration. The latin-ext range is `U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF`. Kerning does not work across a subset boundary, for example between Ł and a following Latin-1 letter. This is the usual cost of splitting files.

## Sources

- Atkinson Hyperlegible Next source repository (OFL, version, changelog): https://github.com/googlefonts/atkinson-hyperlegible-next
- Atkinson Hyperlegible Next files in google/fonts: https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext
- Braille Institute, Atkinson Hyperlegible font page (weights, 150+ languages, design principles): https://www.brailleinstitute.org/freefont/
- Design Week, "Designing a typeface for the visually impaired" (2021; Elliott Scott on testing with low-vision participants): https://www.designweek.co.uk/issues/2-8-august-2021/designing-atkinson-hyperlegible/
- Print, Atkinson Hyperlegible launches on Google Fonts (early testing with people with a range of vision impairments): https://www.printmag.com/design-news/braille-institute-s-atkinson-hyperlegible-typeface-launches-on-google-fonts-for-visually-impaired/
- CSUN Assistive Technology Conference 2024, "Atkinson Hyperlegible: A Uniquely Accessible Font" (Braille Institute; quantitative study announced, figures not published on the page): https://www.csun.edu/cod/conference/sessions/2024/index.php/public/presentations/view/3108.html
- Bodoni source repository (indestructible type, OFL): https://github.com/indestructible-type/Bodoni
- Bodoni Moda files in google/fonts: https://github.com/google/fonts/tree/main/ofl/bodonimoda
- Bodoni Moda specimen: https://fonts.google.com/specimen/Bodoni+Moda
- Abbott Miller, "Through thick and thin: fashion and type", *Eye* 65, 2007: https://eyemagazine.com/feature/article/through-thick-and-think-fashion-and-type
- Libre Bodoni: https://fonts.google.com/specimen/Libre+Bodoni
- Gloock: https://fonts.google.com/specimen/Gloock
- DM Serif Display: https://fonts.google.com/specimen/DM+Serif+Display
- Public Sans: https://github.com/uswds/public-sans
- Source Sans 3: https://github.com/adobe-fonts/source-sans
- Inter: https://github.com/rsms/inter
- Fontsource (the comparison builds that strip features): https://fontsource.org
- fontTools subset documentation: https://fonttools.readthedocs.io/en/latest/subset/
- MDN, `font-optical-sizing`: https://developer.mozilla.org/en-US/docs/Web/CSS/font-optical-sizing
- ISO 216 (√2 paper series): https://en.wikipedia.org/wiki/ISO_216
- Apple Human Interface Guidelines, Typography (Dynamic Type sizes and tracking): https://developer.apple.com/design/human-interface-guidelines/typography
- ITTEN rules used: LAY-05 (`reference/ui/01-layout-and-spacing.md`); TYP-01, TYP-02, TYP-03, TYP-05, TYP-06, TYP-07, TYP-08, TYP-09, TYP-10, TYP-11, TYP-12 (`reference/ui/02-typography.md`); SHP-10 (`reference/ui/04-shape-depth-materials.md`).
