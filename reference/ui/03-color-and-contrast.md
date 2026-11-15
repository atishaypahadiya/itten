# UI · Colour and contrast

## Contrast

### COL-01 · Meet WCAG AA contrast for text
Strength: MUST · Evidence: standard

| Text | Minimum ratio |
|---|---|
| Up to 17 pt regular (normal text) | 4.5 : 1 |
| 18 pt and larger, or bold at any size | 3 : 1 |

WCAG defines large text as at least 18 pt, or 14 pt bold; Apple's inspector table treats all bold text as large. Check both light and dark appearances. Where a default palette cannot meet these ratios, it must at least provide a higher-contrast scheme when the system's Increase Contrast setting is on.

*Why:* this is the WCAG 2.2 AA requirement that Apple's Accessibility Inspector applies [S6][S13]. Tokens: `contrast.wcag.*`.

### COL-02 · Give non-text UI 3 : 1 against its surroundings
Strength: MUST · Evidence: standard

Control boundaries, focus indicators, icons that carry meaning and chart elements need at least 3 : 1 against adjacent colours.

*Why:* WCAG 2.2 SC 1.4.11 (Non-text Contrast) [S13].

### COL-03 · Also check perceptual contrast (APCA) for body text and dark mode
Strength: SHOULD · Evidence: research

As a second check, aim for APCA lightness contrast of:

| Use | Target |
|---|---|
| Body text | Lc 75 minimum (Lc 90 preferred) |
| Other readable text | Lc 60 |
| Large headings | Lc 45 |
| Non-text and incidental text | Lc 30 |

*Why:* WCAG 2's ratio misjudges very light text and dark-mode pairs, which can pass while being hard to read. Apple names APCA as an alternative contrast measure [S6]. APCA is not yet a normative standard, so COL-01 stays the binding rule [S16].

## Meaning

### COL-04 · Never use colour as the only signal
Strength: MUST · Evidence: standard

Pair colour with a second cue: a label, a shape, an icon, position or pattern. Red–green and blue–orange pairs are the most commonly confused.

*Why:* colour-vision deficiencies are common, and colour alone also fails in sunlight, on poor displays and in greyscale print [S5][S6].

### COL-05 · One colour, one meaning
Strength: MUST · Evidence: platform

Assign each colour a single role, such as interactive, destructive, success or brand, and never reuse it for another role. If the accent colour marks interactivity, do not use it on static text.

*Why:* inconsistent colour makes people guess which things they can act on [S5].

### COL-06 · Specify colours by role, not by value
Strength: SHOULD · Evidence: platform

Refer to colours by semantic name (label, secondaryLabel, separator, background levels) and let the system or token layer resolve the values. Do not hard-code system colour values; Apple changes them between releases. Do not repurpose a semantic colour (for example, using the separator colour for text).

*Why:* role-based colours adapt automatically to appearance, contrast settings and vibrancy [S5].

### COL-07 · Define every custom colour four times
Strength: MUST · Evidence: platform

Each custom colour needs light, dark, light with increased contrast, and dark with increased contrast variants. Provide this even if the app ships in a single appearance.

*Why:* Liquid Glass adapts to the content beneath it, and accessibility settings change backgrounds. A single value fails in some combination [S5].

### COL-08 · Check colour meaning across cultures
Strength: SHOULD · Evidence: platform

Check what each meaningful colour signals in the target markets. Rising values are shown in green in some markets and in red in others.

*Why:* the same colour can carry opposite meanings in different cultures [S5].

## Use

### COL-09 · Use accent colour sparingly
Strength: SHOULD · Evidence: platform

Reserve the accent colour for the single most important action and for status. On Liquid Glass, tint the background of the one primary control rather than its symbol, and do not tint several controls. Over colourful content, prefer monochrome bars.

*Why:* emphasis is relative. Tinting many elements cancels the emphasis of each, and coloured labels over coloured content lose legibility [S5].

### COL-10 · Keep the resting state legible
Strength: MUST · Evidence: platform

Content may pass under translucent controls while scrolling. The resting state, such as the top of a scroll view, must keep controls fully legible.

*Why:* people judge a screen by its resting state, and that is where controls are most often read [S5].

### COL-11 · Use wide colour deliberately
Strength: MAY · Evidence: platform

Display P3 allows more saturated colour than sRGB. When using P3, export 16-bit-per-channel PNGs, embed colour profiles, and supply sRGB variants where two P3 colours would become indistinguishable or a gradient would clip.

*Why:* P3 assets usually display correctly on sRGB screens, but not always [S5].

### COL-12 · Test in real light
Strength: SHOULD · Evidence: platform

Check the palette outdoors, in dim rooms, with True Tone on, and on several displays.

*Why:* bright surroundings mute colours and dark surroundings intensify them. On visionOS, wall colours and lighting alter perceived colour [S5].
