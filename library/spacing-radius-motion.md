# Spacing, radius and motion

Use only when a project's brief asks for it.

These three come from the rules in `reference/` with almost no new invention. The only owner's choice is the radius set, which `reference/` already records as taste. A project's own system (`protocol/02-system.md`) replaces every value here.

## Spacing

ITTEN adopts the closed 4-point scale from LAY-05 unchanged: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. On the web, 1 pt is treated as 1 CSS px, which is how Apple's point values are normally carried to the web.

| Token | Value | Typical use |
|---|---|---|
| `space.1` | 4 px | Icon-to-label gap, optical nudges |
| `space.2` | 8 px | Gap inside a group; nested container padding |
| `space.3` | 12 px | Padding around bezeled controls (INT-03) |
| `space.4` | 16 px | Side margin at phone width; card padding |
| `space.5` | 20 px | |
| `space.6` | 24 px | Gap between groups; padding around borderless controls (INT-03) |
| `space.8` | 32 px | |
| `space.10` | 40 px | |
| `space.12` | 48 px | Gap between sections |
| `space.16` | 64 px | |
| `space.20` | 80 px | |
| `space.24` | 96 px | Poster margins |

Token names are the multiple of 4, so `space.6` is 24 px. This keeps the name tied to the value and leaves gaps where the scale skips (there is no `space.7`).

Two rules govern how the scale is used:

- LAY-06: the gap between groups is at least 2× the largest gap inside them. The usual pairs are 8 inside / 24 between, and 12 inside / 32 between. The ratio is stored as `space.groupRatioMin`.
- LAY-04: grouping is shown with space first, lines last.

Spacing stays in px rather than rem. Type is in rem so that it follows the browser's text-size setting (TYP-03). Spacing follows page zoom, which is what WCAG 1.4.4 and 1.4.10 test.

## Radius

The closed set is taken from `reference/tokens/tokens.json` (SHP-02): small 8, medium 16, large 24, full (capsule). These values are the owner's taste. The rule that matters is SHP-01: an inner radius equals the outer radius minus the padding between them, never less than zero.

The set is spaced in steps of 8, which is a spacing token (`space.2`). So every radius is concentric with the next one down at 8 px padding:

| Outer | Padding | Inner | Inner token |
|---|---|---|---|
| 24 (large) | 8 | 16 | medium |
| 16 (medium) | 8 | 8 | small |
| 8 (small) | 8 | 0 | none (square) |
| 24 (large) | 16 | 8 | small |
| 24 (large) | 24 | 0 | none |

The inspector checks nested radii on the rendered page (`protocol/03-craft.md`). Where padding differs by axis, SHP-01 says to use the larger padding.

Shape follows function (SHP-03): capsules for discrete controls, rounded rectangles for containers, square corners for content that runs to the edge. ITTEN uses circular corners only. CSS `corner-shape: squircle` exists in some browsers, but superellipse corners are on the owner's list of patterns to avoid, and SHP-01's arithmetic is defined for circular arcs.

## Motion

### Durations

MOT-07 says duration follows distance and size. ITTEN has four steps:

| Token | Value | Use | Basis |
|---|---|---|---|
| `motion.duration.press` | 100 ms | Pressed and hover states | FBK-01, 0.1 s limit |
| `motion.duration.small` | 200 ms | Small elements, short distances | MOT-07, taste |
| `motion.duration.medium` | 300 ms | Panels, menus | MOT-07, taste |
| `motion.duration.large` | 500 ms | Full-screen transitions | MOT-06, Apple's 0.4–0.6 s examples |

200 and 300 ms are interpolations between the two sourced ends; they are taste, not research.

### Springs

MOT-06 and source S11 define a spring by perceived duration and bounce. The presets from `reference/tokens/tokens.json` are kept:

| Preset | Duration | Bounce | Damping ratio | Overshoot | Settles (±0.1%) |
|---|---|---|---|---|---|
| `smooth` | 0.5 s | 0 | 1.0 | 0% | 740 ms |
| `subtle` | 0.5 s | 0.15 | 0.85 | 0.6% | 700 ms |
| `bouncy` | 0.5 s | 0.3 | 0.7 | 4.6% | 820 ms |

The conversion follows Apple's model: mass 1, stiffness (2π / duration)², damping 4π(1 − bounce) / duration, so the damping ratio is 1 − bounce. CSS has no spring timing function, so a build step can sample the spring's position at 41 points and writes it as a CSS `linear()` easing, together with the time it takes to settle within 0.1% of its target. That settle time is the CSS duration; the perceived duration is shorter because the last part of the motion is too small to see. The overshoot figures above match S11's description: 0.15 barely reads as bounce, 0.3 clearly does.

A CSS `linear()` spring is a recording, not a simulation. It cannot carry velocity into a retargeted animation the way a real spring does (MOT-04). For gestures, use a script-driven spring with the same parameters; the CSS presets are for state changes.

### Reduce Motion

Under `prefers-reduced-motion: reduce` (MOT-08) a project should:

- swaps `subtle` and `bouncy` for `smooth`, which removes the bounce;
- give components a flag to replace movement with a fade;
- leaves fades and colour changes alone, since MOT-08 asks to reduce motion, not remove all feedback (MOT-02).

## Sources

- `reference/ui/01-layout-and-spacing.md`: LAY-04, LAY-05, LAY-06.
- `reference/ui/04-shape-depth-materials.md`: SHP-01, SHP-02, SHP-03.
- `reference/ui/05-motion.md`: MOT-04, MOT-06, MOT-07, MOT-08.
- `reference/ux/02-feedback-and-states.md`: FBK-01.
- Apple, *Animate with springs*, WWDC23 session 10158. https://developer.apple.com/videos/play/wwdc2023/10158/
- P. Hebert, *The Math Behind Nesting Rounded Corners*, Cloud Four. https://cloudfour.com/thinks/the-math-behind-nesting-rounded-corners/
- W3C, *CSS Easing Functions Level 2*, `linear()` easing. https://www.w3.org/TR/css-easing-2/#the-linear-easing-function
- W3C, *Understanding SC 1.4.4 Resize Text* and *1.4.10 Reflow*. https://www.w3.org/WAI/WCAG22/Understanding/resize-text , https://www.w3.org/WAI/WCAG22/Understanding/reflow
