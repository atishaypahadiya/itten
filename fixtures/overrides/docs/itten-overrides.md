# ITTEN overrides

Every departure from this project's system or from an ITTEN rule, with its reason. Rendered from `itten.overrides.json` by `node itten/scripts/overrides.js render`; edit that file, not this one.

| Date | Where | Rule | Check | System value | Used instead | Reason | Floors still met | ITTEN |
|---|---|---|---|---|---|---|---|---|
| 2026-11-14 | `.hero h1` | LAY-10 · Align optically, not only geometrically | `near-miss-edge` | left edge at 24 px | 22 px | Optical alignment of the open "T", which looks indented at 24 px. | Yes | 0.2.0 |
| 2026-11-15 | Chart labels drawn by the charting library | CRF-01 · Spacing comes only from the scale | `spacing-scale` | spacing from the 4 px scale | 3 px label offsets set by the library | The library places its labels itself; overriding them breaks its collision avoidance. | Yes | 0.3.0 |
