# System

The teardown says what the inspiration measures. The system says what this project will use. It is one file, `itten.system.json`, at the root of the project, validated by `itten/schema/system.schema.json`. Every length, size, radius, colour and duration in the build comes from it. A value that is not in it is either a mistake or an override logged in `docs/itten-overrides.md` with a reason.

The system is small on purpose. A closed set of values is what makes a page look made rather than assembled. Near-duplicates (13 px next to 14 px, a 6 px radius beside an 8 px one) read as errors even to people who could not say why (LAY-05, SHP-02).

## From teardown to system

Work through `docs/teardown.md` category by category. For each value you carry into the system, keep a pointer back to the teardown finding it came from.

### Spacing

1. List every gap the teardown measured, with how often it repeats.
2. Find the base unit: the largest value that divides most of the repeated gaps within the measurement's uncertainty. If the inspiration has no clear unit, use 4 px (LAY-05).
3. Write the scale as the repeated gaps, rounded to the unit, in ascending order. Six to twelve steps is typical. Add a step only when the teardown shows a gap the existing steps cannot express.
4. Check the ratio between the gap separating groups and the gap inside them. Record it as `groupRatioMin`; it must be at least 2 unless the teardown shows the inspiration deliberately does otherwise (LAY-06). Optionally record `tolerance` in px, on `spacing` and on `type`: how far off a step a value may be for `itten fix` to move it there, when only one step is that near (1 px when absent; docs/CONTRACT.md, Fixes).
5. Where the inspiration's side margins or section gaps grow with the window, declare each such range in `spacing.fluid`, as a fluid type step is declared: a name, `min` at and below `minWidth`, `max` at and above `maxWidth`. Write it as `clamp(min, a + b·vw, max)` with the limits in rem (the same arithmetic as step 6 under Type). The inspector accepts a margin, padding or gap where a declared range puts it at that width, within 0.5 px, and reports any other value that follows the viewport.
6. Write every step in rem in the build (24 px is `1.5rem`), so spacing follows the browser's text size (CRF-30).

### Type

1. Name every typeface the build will request in `type.families`, exactly as it will be written in CSS. The inspector fails any text that renders in a different family, so a fallback cannot pass silently.
2. Take the type sizes from the teardown's measured ratios, not its absolute sizes. Fix the body size first (from the brief and the platform minimum, TYP-01), then apply the measured ratios to it.
3. Round every fixed size and line height to a whole pixel. Fractional sizes and sizes compounded from nested `em` values are reported by the inspector.
4. Keep body leading between 1.2 and 1.45 (TYP-05) unless the brief overrides it.
5. Give each step a name, a size, a line height, and the weight and family it uses. Use only these steps (TYP-06). The inspector matches text to a step on its size, its weight and the role of its family (text or display, from `families`), so two steps may share a size when their weight or family tells them apart, as a 16/24 body at 400 and a 16/20 label at 600 do.
6. A step may be fluid instead of fixed, when the inspiration's headings grow with the window. Give it `fluid` in place of `size`: the size at and below `minWidth`, the size at and above `maxWidth`, and those two widths. The browser then scales it in a straight line between them, which is what `clamp(min, a + b·vw, max)` produces. To write the clamp, take slope = (max − min) ÷ (maxWidth − minWidth), then `b` = slope × 100 vw and `a` = min − slope × minWidth, in rem. The inspector accepts the size the declared line gives at each width, within 0.25 px, fractions included, and reports any other fluid size. Give a fluid step a `lineHeight` in px, or a `leading` ratio of the size. A fixed line height keeps everything below the heading on whole pixels (CRF-08). Clamp limits in rem still follow the browser's text size; the inspector checks the declared range at the default text size only.

### Grid

For each breakpoint record the minimum width, columns, gutter, side margin and maximum content width. Gutters and margins come from the spacing scale. The first breakpoint starts at 0 and must work at 320 px.

### Radius

List the radii the teardown measured, merge any within 1 px of each other, and keep three or four (SHP-02). Set `nesting` to `concentric` unless the inspiration deliberately breaks it, in which case log the reason. With `concentric`, a nested radius is derived (inner = max(0, outer − inset)) rather than chosen, so derived values do not need to be in the scale (SHP-01).

### Colour

1. Name colours by role (COL-06): ground, surface, text, secondary text, accent, edge, focus, error, and whatever else the brief needs. Each role gets a light value, and a dark value if the project has a dark appearance.
2. Record each role's source in the teardown and, if the teardown measured proportions, its share of the coloured area.
3. List the pairs the build relies on in `pairs`, with the minimum ratio for each: 4.5 for text, 3 for large text and non-text parts, and the brief's choice for display-only pairs. The inspector measures the rendered result. Writing the pairs here makes the intent explicit before anything is built.
4. Add `lightMore` and `darkMore` values for any role that does not reach 7:1 for text, for the Increase Contrast setting (COL-07).

### Motion

Record named durations and easings, and what movement becomes under Reduce Motion (MOT-06 to MOT-08). Take them from the inspiration if it moves. If it does not, take them from the brief's feeling, not from a default.

### Targets and hairlines

`targets.minimum` is at least 24 (WCAG 2.5.8). `targets.comfortable` is usually 44 (INT-01). `hairline.width` is usually 1 px, and `hairline.dpr` lists the device pixel ratios the project must render crisply at, usually `[1, 2]`.

## Example

A system for a hypothetical project. The values are illustrative and come from a hypothetical teardown; they are not ITTEN defaults.

```json
{
  "$schema": "itten/schema/system.schema.json",
  "name": "Example",
  "version": "1",
  "source": { "teardown": "docs/teardown.md", "brief": "docs/brief.md", "overrides": "docs/itten-overrides.md" },
  "spacing": { "scale": [4, 8, 12, 16, 24, 32, 48, 64, 96], "groupRatioMin": 2 },
  "type": {
    "families": [{ "name": "Example Sans", "role": "text", "fallback": ["Arial", "sans-serif"] }],
    "scale": [
      { "name": "caption", "size": 13, "lineHeight": 18, "weight": 400 },
      { "name": "body", "size": 17, "lineHeight": 24, "weight": 400 },
      { "name": "title", "size": 28, "lineHeight": 32, "weight": 600 },
      { "name": "display", "fluid": { "min": 40, "max": 56, "minWidth": 360, "maxWidth": 1280 }, "leading": 1.1, "weight": 600 }
    ]
  },
  "grid": { "breakpoints": [
    { "minWidth": 0, "columns": 4, "gutter": 16, "margin": 16 },
    { "minWidth": 768, "columns": 12, "gutter": 24, "margin": 32, "maxWidth": 1200 }
  ] },
  "radius": { "scale": [4, 12], "capsule": true, "nesting": "concentric" },
  "colour": {
    "roles": {
      "ground": { "light": "#FFFFFF", "dark": "#121212", "source": "R2, page background" },
      "text": { "light": "#1A1A1A", "dark": "#EDEDED" },
      "accent": { "light": "#B3261E", "dark": "#F2B8B5", "source": "R1, masthead red", "share": 0.08 }
    },
    "pairs": [
      { "fg": "text", "bg": "ground", "min": 4.5, "use": "body" },
      { "fg": "accent", "bg": "ground", "min": 4.5, "use": "text" }
    ]
  },
  "motion": { "durations": { "press": 100, "panel": 300 }, "easings": { "out": [0.2, 0, 0, 1] }, "reducedMotion": "fade" },
  "targets": { "minimum": 24, "comfortable": 44 },
  "hairline": { "width": 1, "dpr": [1, 2] }
}
```

## Validate it

```sh
node itten/inspector/inspect.js --validate itten.system.json
```

This checks the file against the schema, including one ITTEN-specific rule: spacing and radius scales must ascend without repeats. The inspector also validates the file whenever it is passed with `--system`, and stops if it is invalid.

## Changing the system

Change the system when the brief or the inspiration changes, not to make a report pass. Raise `version`, note the change in the teardown or the brief, and re-run the inspector. If a value keeps turning up as an override, it probably belongs in the system: add it, and remove the override entries it replaces.
