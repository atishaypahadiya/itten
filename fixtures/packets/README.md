# Work packets fixture

`scripts/packets-test.js` copies `planted/` and `clean/` beside `fixtures/fix/base.css`, the text font and
`CODEOWNERS`, serves the copy on 127.0.0.1 and runs `inspector/packets.js` on each page.

| Planted | Findings | Packet |
|---|---|---|
| `planted/style.css` line 2: `.card { padding: 14px }` | `spacing-scale` (14 px is off the scale, with no step within 1 px) and `spacing-unit` (set in px) | One packet: both come from one rule. Not mechanical: which step 13 px should be is a choice. |
| `planted/style.css` line 3: `.caption { font-size: 14px }` | `text-resize` | A second packet in the same file, so the two conflict. Mechanical. |
| `planted/notes.css` line 2: `.aside { padding: 24px }` | `spacing-unit` | A third packet, alone in its file: conflict-free. Mechanical. Owners `@notes` and `@styles-lead`. |

`.plain` is a decoy: nothing is wrong with it, and no packet names it. `clean/` is the twin: no findings, no packets.
