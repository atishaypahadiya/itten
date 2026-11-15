# UI · Typography

## Size and legibility

### TYP-01 · Respect platform default and minimum sizes
Strength: MUST · Evidence: platform

| Platform | Default body | Minimum |
|---|---|---|
| iOS, iPadOS | 17 pt | 11 pt |
| macOS | 13 pt | 10 pt |
| tvOS | 29 pt | 23 pt |
| visionOS | 17 pt | 12 pt |
| watchOS | 16 pt | 12 pt |

These apply to custom fonts as well as system fonts. A thin custom face needs sizes above these values [S4][S6]. Tokens: `type.minimum.*`.

### TYP-02 · Avoid light weights for interface text
Strength: SHOULD · Evidence: platform

Use Regular, Medium, Semibold or Bold for text people must read. Reserve Ultralight, Thin and Light for large display sizes, if anywhere.

*Why:* thin strokes lose contrast against the background, especially at small sizes and on translucent materials [S4].

### TYP-03 · Support text resizing up to 200%
Strength: MUST · Evidence: platform

Use the platform's text styles (Dynamic Type on Apple platforms) or an equivalent custom control, so that text can grow to at least 200% (140% on watchOS). At large sizes:
- stack items that were side by side;
- reduce the number of columns;
- avoid truncating text in scrollable regions;
- scale icons that carry meaning along with the text.

*Why:* people with low vision rely on this, and many more people use larger sizes than designers expect [S4][S6].

## Hierarchy

### TYP-04 · Body line length 45–90 characters
Strength: SHOULD · Evidence: craft · Applies to: long-form text

Size the text column so a line averages 45 to 90 characters including spaces. Use the platform's readable-width guide where one exists.

*Why:* long lines make the return sweep to the next line error-prone, and short lines break phrases apart [S17][S3].

### TYP-05 · Leading 120–145% for body text, and never tight below three lines
Strength: SHOULD · Evidence: craft

Set body line spacing between 1.2 and 1.45 times the font size. For three or more lines, never use tight leading, even in height-constrained rows. Layouts must stay intact when people raise line spacing to 1.5×, paragraph spacing to 2×, letter spacing to 0.12 em and word spacing to 0.16 em.

*Why:* Apple's iOS body style is 17/22 pt, a ratio of 1.29 [S4]. Typographic practice gives 120–145% [S17]. WCAG 1.4.12 requires layouts to survive the user overrides listed above [S15].

### TYP-06 · Build hierarchy from a fixed set of steps
Strength: MUST · Evidence: platform

Define a closed set of text styles and use only those. For iOS, the default Dynamic Type set is the reference (size / leading in pt):

| Style | Size / leading | Weight |
|---|---|---|
| Large Title | 34 / 41 | Regular |
| Title 1 | 28 / 34 | Regular |
| Title 2 | 22 / 28 | Regular |
| Title 3 | 20 / 25 | Regular |
| Headline | 17 / 22 | Semibold |
| Body | 17 / 22 | Regular |
| Callout | 16 / 21 | Regular |
| Subhead | 15 / 20 | Regular |
| Footnote | 13 / 18 | Regular |
| Caption 1 | 12 / 16 | Regular |
| Caption 2 | 11 / 13 | Regular |

[S4] Tokens: `type.scale.ios`.

### TYP-07 · Change the fewest attributes needed to show a level
Strength: SHOULD · Evidence: craft

Separate hierarchy levels by changing one attribute at a time (size, weight, colour or position) before combining them. Bold and italic together are almost never needed.

*Why:* when every level differs in several ways at once, the differences stop meaning anything. Apple notes that weight, size and colour all carry hierarchy, and that the hierarchy must survive text-size changes [S4][S17].

### TYP-08 · Use at most two typefaces
Strength: SHOULD · Evidence: platform

One family for interface and body text, and optionally one contrasting family for display or editorial voice. Get further variety from weights and sizes within those families.

*Why:* many typefaces obscure hierarchy and make an interface feel inconsistent [S4].

## Spacing between letters

### TYP-09 · Keep kerning on; adjust tracking by size
Strength: MUST · Evidence: craft

Never turn off a font's kerning. Tracking (uniform letter spacing) depends on size:
- **System fonts** adjust tracking automatically at every size. Match this in mockups using the published values.
- **Custom fonts:** loosen small sizes slightly and tighten mid-range text and display sizes. Verify by eye at the actual rendered size.

| SF Pro size (pt) | Tracking (pt) |
|---|---|
| 11 | +0.06 |
| 12 | 0 |
| 13 | −0.08 |
| 15 | −0.23 |
| 17 | −0.43 |
| 20 | −0.45 |
| 22 | −0.26 |
| 24 | +0.07 |
| 28 | +0.38 |
| 34 | +0.40 |

(Excerpt of Apple's iOS table [S4].)

*Why:* letter shapes need more relative space at small sizes and less at large sizes. Kerning corrects specific letter pairs that uniform spacing cannot fix.

### TYP-10 · Add 5–12% letter spacing to all-caps text
Strength: SHOULD · Evidence: craft

All-caps labels and small caps need extra tracking. Keep all-caps text to less than one line.

*Why:* capitals lack the varied shapes of lowercase letters, so they need more space to separate. Long all-caps passages read slowly [S17].

## Details

### TYP-11 · Use the correct characters
Strength: SHOULD · Evidence: craft

Use curly quotes and apostrophes, real ellipses (…), the en dash for ranges (4–8), the em dash for breaks, the true minus sign (−) in numbers, and the multiplication sign (×) in dimensions. Use one space after a full stop.

*Why:* these are small, cheap signals of care, and screen readers handle the correct characters better [S17].

### TYP-12 · Use tabular figures in columns and changing numbers
Strength: SHOULD · Evidence: craft

Use tabular (fixed-width) numerals in tables, timers, prices that update, and any column of numbers. Use proportional numerals in running text.

*Why:* proportional digits make columns ragged, and make changing values jitter as their width changes.

### TYP-13 · Prefer flat text in spatial interfaces
Strength: SHOULD · Evidence: platform · Applies to: visionOS

Keep readable text flat (2D) and turned to face the viewer. For text not shown on a background, use a bolder weight rather than shadows.

*Why:* text with visual depth and text viewed at oblique angles both lose legibility [S4].
