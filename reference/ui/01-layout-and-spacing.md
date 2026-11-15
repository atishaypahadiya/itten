# UI · Layout and spacing

## Structure

### LAY-01 · Respect safe areas and system margins
Strength: MUST · Evidence: platform

Keep content and controls inside the system-defined safe area, and use the platform's layout guides for side margins and for limiting the width of readable text. Extend backgrounds to the screen edges and let scrolling content run to the bottom.

*Why:* the safe area excludes regions covered by bars, the camera housing, the Home indicator and rounded corners. System guides adapt automatically to devices, orientations and text sizes [S3].

### LAY-02 · Put the most important content upper and leading
Strength: SHOULD · Evidence: platform

Place primary items in the upper half of the screen and toward the leading edge (the left in left-to-right languages). Keep interactive controls away from the bottom edge and the far corners of touch screens. On macOS, keep critical controls away from the bottom of windows, since people often push windows partly off screen.

*Why:* reading order and reach both favour this region, and system gestures occupy the screen edges [S3].

### LAY-03 · Adapt the layout, not the content
Strength: MUST · Evidence: platform

When window size, orientation or text size changes, rearrange the layout (reflow, stack, reduce columns) while keeping the same content available. Preview every screen on the smallest and largest supported sizes, in each orientation, at the largest text size, and in a long-text localisation.

*Why:* removing content on smaller sizes breaks people's expectations across devices. For reference, the smallest iPhone layout is 320 × 568 pt and the largest iPad 1024 × 1366 pt [S3].

### LAY-04 · Show grouping with space before lines
Strength: SHOULD · Evidence: platform

Show which items belong together in this order of preference: negative space, then alignment and indentation, then background shapes, colour or materials, and only then separator lines.

*Why:* proximity and common region are the strongest grouping cues. Separator lines add visual noise for a relationship that spacing alone can show [S3][S12].

## Spacing

### LAY-05 · Use one spacing scale built on 4 points
Strength: SHOULD · Evidence: craft

Draw every margin, gap and padding value from one scale: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96** points. Do not use values outside the scale.

*Why:* a closed scale removes near-duplicate gaps (13 next to 14) that read as mistakes, and it makes spacing decisions mechanical. Material Design aligns components to an 8 dp grid and fine detail to 4 dp [S20]. Apple publishes no base unit, but its stated values (12 and 24 pt control padding, 28 and 44 pt control sizes) sit on a 4-point step [S6]. Tokens: `space.*`.

### LAY-06 · Space between groups exceeds space within groups
Strength: MUST · Evidence: research

The gap between two groups must be visibly larger than the largest gap inside either group. A ratio of at least 2× is a reliable starting point.

*Why:* this is the law of proximity in practice. When outer and inner gaps are equal, the eye cannot tell where one group ends [S12][S19].

### LAY-07 · Keep side margins identical across screens of the same class
Strength: SHOULD · Evidence: platform

Use the same leading and trailing margins on every screen in a size class. Full-width buttons inset to the standard margins, with rounded corners, sitting on the bottom of the safe area clear of the Home indicator.

*Why:* consistent margins create the invisible vertical edges the eye uses to scan, and margins that shift from screen to screen read as instability [S3].

### LAY-08 · Hint at offscreen content with partial reveal
Strength: MAY · Evidence: platform

When a row or carousel scrolls horizontally, let the next item show partially at the edge.

*Why:* a clipped item signals that more content exists without needing an extra control [S3].

## Alignment

### LAY-09 · Align to a small number of edges
Strength: SHOULD · Evidence: craft

Each screen should have a small, deliberate set of alignment edges: typically the two margins, one content keyline and the centre. Before adding a new edge, check whether an existing one would serve.

*Why:* every distinct edge is a line the eye must resolve. Fewer edges read as order [S12].

### LAY-10 · Align optically, not only geometrically
Strength: SHOULD · Evidence: craft

Adjust by eye where geometric alignment looks wrong:
- round and pointed shapes (O, A, play triangles) extend slightly past the line to look aligned;
- icons in circles centre on their visual mass, not their bounding box;
- large type is nudged so its letters, not its sidebearings, touch the margin.

*Why:* perception judges the mass of a shape, not its bounding box. Geometric centring of asymmetric shapes looks off-centre.

### LAY-11 · Use symmetry with a reason
Strength: MAY · Evidence: craft

Centred, symmetric layouts suit single focal points and ceremonial content. Asymmetric layouts suit scanning and comparison. Choose one per screen deliberately.

*Why:* symmetry signals stability and formality. Applied by default to working screens, it slows scanning [S12].

## Platform specifics

| Platform | Guidance [S3] |
|---|---|
| iOS, iPadOS | Support both orientations unless the app is landscape-only, which must work rotated either way. Account for variable status bar height. Use the keyboard layout guide (iOS 15+). |
| macOS | Keep critical controls away from the bottom of the window. |
| tvOS | Keep primary content within 60 px of top and bottom and 80 px of the sides (overscan safe zone). Leave room for focused items to grow without overlapping neighbours. |
| watchOS | Run content edge to edge, since the bezel already provides padding. At most three glyph-only buttons or two text buttons in a row. |
