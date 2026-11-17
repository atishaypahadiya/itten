# Using ITTEN in a project

ITTEN is a detail discipline and an inspector. It has no palette, no typeface and no template, and nothing in it applies a value on its own. Taste comes from each project's brief and the work it takes inspiration from. ITTEN's job starts after that: it turns the inspiration into measurements, holds the build to them, and checks the rendered page up close for the small errors that make work look approximate.

## The loop

| Step | What happens | Read | The project ends up with |
|---|---|---|---|
| 1. Teardown | Read each inspiration image or site as measurements: type ratios, spacing rhythm, edges, grid, density, corners, colour roles, texture, what is broken on purpose. | `protocol/01-teardown.md` | `docs/teardown.md` |
| 2. System | Turn the teardown into the project's own closed system: one spacing scale, one type scale, a grid, a radius rule, colour roles, motion. | `protocol/02-system.md`, `schema/system.schema.json` | `itten.system.json` |
| 3. Build | Build with values from the system only. Follow the up-close rules. | `protocol/03-craft.md` | The work |
| 4. Inspect | Run the inspector on the rendered page across widths, text sizes and colour schemes. | `protocol/04-inspect.md` | `itten-report/report.html` |
| 5. Fix | Fix errors first, then warnings. Re-run until the report is clean, or log what stays. | `protocol/04-inspect.md` | `itten.overrides.json`, `docs/itten-overrides.md` |

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

WebKit and Firefox give a second opinion on layout. If either is missing, the report says so and the run continues.

## Run the inspector

```sh
node itten/inspector/inspect.js http://localhost:5173/ --system itten.system.json --out itten-report
```

- `<url>`: any page the browser can open, local or deployed.
- `--system`: the project's system file. Without it, the inspector reports how many distinct font sizes, spacing values and radii the page uses, instead of checking them against a scale.
- `--out`: where to write `report.json`, `report.html` and the crops. Add it to `.gitignore`.

By default the inspector measures the page at 320, 768, 1440 and 1920 px wide and at the width on each side of every breakpoint between them, each a fresh load, at 200% text, in light and dark, and in WebKit and Firefox as well as Chromium; then it resizes the window across each breakpoint and measures again, since some pages break only after a resize. Add `--full` to sweep every 40 px from 320 to 1920 px, in every engine, before a release or when a finding depends on the width. The widths and passes run as separate jobs, several at once (`--workers`, by default the CPU cores less two); the findings are the same as on one worker. Before the jobs start it prints its plan and how long it expects to take. The report lists each issue by severity with a zoomed crop. `protocol/04-inspect.md` explains every check, what it does not judge, and the order to fix things in.

## On every pull request

ITTEN is also a GitHub Action. It serves or opens the project's pages, runs the inspector on each in Chromium and WebKit, uploads `report.html` and the crops as a workflow artifact, writes the counts to the job summary, and keeps one comment on the pull request: counts by severity, the top findings, and what is new or fixed since the project's baseline. It edits that comment on every push, so there is never a second one.

Add `.github/workflows/itten.yml` to the project:

```yaml
name: ITTEN

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: itten-${{ github.ref }}
  cancel-in-progress: true

jobs:
  inspect:
    runs-on: ubuntu-24.04
    timeout-minutes: 30  # 90 with mode: full
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      # Build the site here if it needs building, for example:
      # - run: npm ci && npm run build
      - uses: atishaypahadiya/itten@v0.3.4  # or pin the release's commit SHA
        with:
          static-dir: dist
          pages: |
            /
            /about/
```

The action gets the pages in one of three ways:

- `static-dir`: a directory of built files, served on a local port. A path without an extension finds `name.html` or `name/index.html`, as static hosts do.
- `serve-command` with `url`: a command that serves the project in the background, such as `npm run preview`, and the address it serves. The action waits up to `serve-timeout` seconds (default 120) for the address to answer, and stops the command at the end.
- `url` alone: a deployed page, such as a preview deployment.

The other inputs:

| Input | Default | Meaning |
|---|---|---|
| `pages` | `/` | Paths relative to the served root or `url`, one per line or comma-separated. Inspect each distinct template. |
| `system` | `itten.system.json` if present | The system file. `none` runs in distinct-value mode. An invalid file fails the run. |
| `mode` | `quick` | `quick`: 320, 768, 1440 and 1920 px, and the width on each side of every breakpoint between them. `full`: every 40 px from 320 to 1920 px. |
| `fail-on` | `errors` | `errors`, `warnings` or `never`. With a baseline, only findings that are new or more severe count. |
| `baseline` | `itten-baseline.json` | The committed list of known findings. |
| `write-baseline` | `false` | `true` writes a fresh `itten-baseline.json` for these pages into the artifact. |
| `overrides` | `itten.overrides.json` | Validated when it exists (see Overrides). |
| `comment` | `true` | `false` keeps to the job summary. |
| `name` | `itten-report` | Names the artifact and the comment. Give each use of the action in one workflow its own name. |
| `working-directory` | `.` | Where the paths above are relative to. |
| `workers` | the runner's CPU cores less two | Jobs at once. A standard 4-core Linux runner gets 2. |
| `shard` | none | `i/n` for one job of a matrix: measure every n-th job of each page and upload `shard.json` (see Sharding). |
| `merge` | none | For the job after a sharded matrix: the directory the shard artifacts were downloaded into. |

Outputs: `errors`, `warnings`, `info`, `new`, `fixed`, `failing`, `report-dir` and `artifact-url`.

Give every job that runs the action a `timeout-minutes`: 30 for `quick` and 90 for `full` cover a few pages with room to spare. The inspector holds each step to a limit, records a step that runs past it as a `timed-out` error and goes on, and stops itself with exit code 124 after 10 minutes without progress. The job's limit is the last guard, for what happens outside the inspector: a build, a server that never answers, a runner that stalls. GitHub's own default is 360 minutes.

### Sharding

A full sweep of several pages can take longer than one runner should. The matrix below splits each page's jobs across three runners and merges them in a fourth, which crops, measures motion alone, writes the one report and keeps the one comment. Each shard and the merge job serve the site the same way, and every job must pass the same `mode`, `system` and `pages`. A quick sweep rarely needs this.

```yaml
jobs:
  measure:
    runs-on: ubuntu-24.04
    timeout-minutes: 60
    strategy:
      matrix:
        shard: ['1/3', '2/3', '3/3']
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: atishaypahadiya/itten@v0.3.5
        with:
          static-dir: dist
          mode: full
          shard: ${{ matrix.shard }}
          name: itten-shard-${{ strategy.job-index }}
  report:
    needs: measure
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with:
          pattern: itten-shard-*
          path: itten-shards
      - uses: atishaypahadiya/itten@v0.3.5
        with:
          static-dir: dist
          mode: full
          merge: itten-shards
```

A shard job writes a short job summary and no comment, and does not fail on findings; the merge job reports and fails as an unsharded run would. The merge stops if a shard is missing or was run with other options.

The baseline holds the findings the project has accepted for now, each logged as an override, so a pull request is judged by what it adds. To make one, run the workflow once with `write-baseline: true` (from `workflow_dispatch`, say), download the artifact, and commit its `itten-baseline.json` at the project's root. Write it in CI rather than on a laptop: fonts and line breaks differ between platforms, and those differences would show as new and fixed findings. Rewrite it when an accepted finding is fixed, or the fixed count stays above zero. On the command line, `inspect.js <url> --baseline itten-baseline.json` compares in the same way and `--write-baseline` writes one.

Permissions. The comment needs `pull-requests: write`, given to the job as above; nothing else needs more than `contents: read`. A pull request from a fork runs with a read-only token, so it gets the job summary and no comment, and the run does not fail for that. Every third-party action the ITTEN action uses is pinned by commit SHA; pin ITTEN the same way if your policy asks for it.

The action installs Chromium and WebKit with Playwright and caches them between runs. Firefox is not installed in CI. It is tested on `ubuntu-24.04` runners.

## Overrides

Every departure from the project's system or from an ITTEN rule is written down with a reason. A departure with a reason is a decision; one without a reason is a defect nobody has noticed yet (`reference/DECISIONS.md`, DEC-08).

The record is `itten.overrides.json` at the project's root, validated by `itten/schema/overrides.schema.json`:

```json
{
  "$schema": "itten/schema/overrides.schema.json",
  "overrides": [
    {
      "rule": "LAY-10",
      "check": "near-miss-edge",
      "selector": ".hero h1",
      "value": "left edge at 24 px",
      "instead": "22 px",
      "reason": "Optical alignment of the open \"T\", which looks indented at 24 px.",
      "floors": true,
      "date": "2026-11-14",
      "itten": "0.3.0"
    }
  ]
}
```

`rule`, `reason`, `date`, `itten` and one of `selector` or `scope` are required. `rule` is an ID from `protocol/` or `reference/`; `check` is the inspector check that reports it, if any; `scope` says where the override applies when a selector cannot, such as "chart labels drawn by the charting library"; `floors` says whether the accessibility floors still hold there.

`docs/itten-overrides.md` is the page people read. It is generated from the JSON, so edit the JSON and render it again:

```sh
node itten/scripts/overrides.js render   # writes docs/itten-overrides.md
node itten/scripts/overrides.js check    # validates, and fails if the page is out of date
```

The action runs the same check whenever `itten.overrides.json` exists. `fixtures/overrides/` holds an example of both files.

To silence an inspector check on an element whose override is logged, add `data-itten-ignore="<check>"` to it, for example `data-itten-ignore="near-miss-edge"`. It skips that check on that element only; add `data-itten-ignore-subtree` as well to skip it on everything inside the element. The report counts ignored elements, so an ignore without a matching override entry is easy to find.

Overrides are also how ITTEN learns. Once a month, `scripts/telemetry.js` reads `itten.overrides.json` from each public repository of ITTEN's owner that includes ITTEN as a submodule, and nothing else from those repositories. A rule overridden in three or more projects gets an issue in ITTEN with the reasons side by side, since a rule that many projects set aside is a rule to rewrite. The latest run is in `research/telemetry.md`.

## What else is in ITTEN

- `reference/`: 131 cited rules with IDs (LAY-05, COL-01 …). The protocol cites them.
- `library/`: earlier research on fashion colourways, typefaces, icons and texture, with the font and icon files. Use any of it only when a project's brief asks for it.
- `fixtures/`: a test page with planted defects and a clean twin. They show what the inspector catches.
