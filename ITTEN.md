# Using ITTEN in a project

ITTEN is a detail discipline and an inspector. It has no palette, no typeface and no template, and nothing in it applies a value on its own. Taste comes from each project's brief and the work it takes inspiration from. ITTEN's job starts after that: it turns the inspiration into measurements, holds the build to them, and checks the rendered page up close for the small errors that make work look approximate.

## The loop

| Step | What happens | Read | The project ends up with |
|---|---|---|---|
| 1. Teardown | Read each inspiration image or site as measurements: type ratios, spacing rhythm, edges, grid, density, corners, colour roles, texture, what is broken on purpose. | `protocol/01-teardown.md` | `docs/teardown.md` |
| 2. System | Turn the teardown into the project's own closed system: one spacing scale, one type scale, a grid, a radius rule, colour roles, motion. | `protocol/02-system.md`, `schema/system.schema.json` | `itten.system.json` |
| 3. Build | Build with values from the system only. Follow the up-close rules. | `protocol/03-craft.md` | The work |
| 4. Inspect | Run the inspector on the rendered page across widths, text sizes and colour schemes. | `protocol/04-inspect.md` | `itten-report/report.html` |
| 5. Fix | Fix errors first, then warnings. Re-run until the report is clean, or log what stays. | `protocol/04-inspect.md` | `docs/itten-overrides.md` |

Then go round again whenever the brief, the inspiration or the build changes.

## Precedence

When two instructions disagree, the higher one wins:

1. **The project brief.** What the work is for, who it serves, the feeling it aims for, and the inspiration it names (`reference/DECISIONS.md`, DEC-01 to DEC-07).
2. **The project's own system.** `itten.system.json`, derived from the teardown. No value outside it unless it is logged as an override.
3. **Accessibility floors.** WCAG 2.2 AA and the MUST rules in `reference/`: 4.5:1 text contrast (3:1 for large text and interface parts), 24 px minimum targets, text that survives 200% and user text spacing, Reduce Motion, no meaning carried by colour alone.

The brief decides taste, and the system decides values. Neither can take a floor away from anything people must read or operate. A brief that asks for text below a floor gets the closest passing option and a note. A display moment that deliberately fails a floor, such as a poster headline that repeats information found elsewhere, is logged as an override with its reason.

## Install

Add ITTEN to the project as a git submodule at `itten/`, pinned to a commit or tag:

```sh
git submodule add <itten-repo-url> itten
git -C itten checkout <tag-or-commit>
git add itten .gitmodules
git commit -m "Add ITTEN"
```

To update, check out a newer commit inside `itten/`, read `itten/reference/CHANGELOG.md` and the diff of `itten/protocol/`, then commit the new pointer. A rule change can turn a clean report into a failing one, so update on purpose, not as a side effect.

The inspector needs Playwright in the project (Node 20 or later):

```sh
npm install --save-dev playwright
npx playwright install chromium webkit firefox
```

WebKit and Firefox are used for a short second opinion on layout. If either is missing, the report says so and the run continues.

## Run the inspector

```sh
node itten/inspector/inspect.js http://localhost:5173/ --system itten.system.json --out itten-report
```

- `<url>`: any page the browser can open, local or deployed.
- `--system`: the project's system file. Without it, the inspector reports how many distinct font sizes, spacing values and radii the page uses, instead of checking them against a scale.
- `--out`: where to write `report.json`, `report.html` and the crops. Add it to `.gitignore`.

By default the inspector measures the page at 320, 768, 1440 and 1920 px wide, at 200% text, in light and dark, and in WebKit and Firefox as well as Chromium. Add `--full` to sweep every 40 px from 320 to 1920 px before a release or when a finding depends on the width. The report lists each issue by severity with a zoomed crop. `protocol/04-inspect.md` explains every check, what it does not judge, and the order to fix things in.

## Overrides

Every departure from the project's system or from a protocol rule is written down in `docs/itten-overrides.md`, with a reason. A departure with a reason is a decision; one without a reason is a defect nobody has noticed yet (`reference/DECISIONS.md`, DEC-08).

```markdown
# ITTEN overrides

ITTEN version: <commit or tag>

| Date | Where | Rule or check | System value | Used instead | Reason | Floors still met |
|---|---|---|---|---|---|---|
| 2026-11-14 | Hero headline | near-miss edge | left edge at 24 px | 22 px | Optical alignment of the open "T" (LAY-10) | Yes |
```

To silence an inspector check on an element whose override is logged, add `data-itten-ignore="<check>"` to it, for example `data-itten-ignore="near-miss-edge"`. The report counts ignored elements, so an ignore without a matching override entry is easy to find.

If the same override turns up in two projects, it is probably a rule that needs changing. Propose it to ITTEN rather than logging it a third time.

## What else is in ITTEN

- `reference/`: 131 cited rules with IDs (LAY-05, COL-01 …). The protocol cites them.
- `library/`: earlier research on fashion colourways, typefaces, icons and texture, with the font and icon files. Use any of it only when a project's brief asks for it.
- `fixtures/`: a test page with planted defects and a clean twin. They show what the inspector catches.
