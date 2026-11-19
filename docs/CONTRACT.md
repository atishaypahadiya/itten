# Contract

What the ITTEN inspector needs, what it does while it runs, and what it leaves behind. This describes ITTEN 0.3.5 with `--version`, which was added after 0.3.5 and ships in the next release. Where the roadmap changes something, the change is noted.

## Invocation

```sh
node <itten>/inspector/inspect.js <url> [flags]
node <itten>/inspector/inspect.js --validate <system file>
node <itten>/inspector/inspect.js --version
```

`<itten>` is a checkout of this repository, a clone, a git submodule, or the Agent Skill's folder (`skills/itten/`, installed into a project with `gh skill install`; see `ITTEN.md`). The skill carries copies of the inspector, schemas and lockfile, assembled from the repository, and its own `scripts/setup.sh` in place of the two commands below: without `--yes` it lists what it would install and installs nothing; with `--yes` it runs `npm ci` on the skill's lockfile and Playwright's installer for Chromium and WebKit; an unknown argument exits 64. Once per checkout:

```sh
npm ci                                          # Playwright 1.65.1, pinned in package-lock.json
npx playwright install chromium webkit firefox
```

Node 20 or later. Playwright is the only dependency.

| Flag | Default | Effect |
|---|---|---|
| `--out <dir>` | `itten-report`, in the working directory | Where the report is written. |
| `--system <file>` | none | The project's system file (`schema/system.schema.json`). Without one, values are judged against each other (distinct-value mode), not against a scale. |
| `--fast` | off | The fast tier, for after each change: 320, 768 and 1440 px, Chromium only, light and 100% text, layout and line checks and the page-load findings. No breakpoint scan, resize pass, 200% text, 2× pass, WebKit, Firefox, contrast, fonts or motion; `sweep.tier` is `fast` and `notJudged` says what was not run. On the test print, under 30 s. Not with `--full`. |
| `--full` | off | Every 40 px from 320 to 1920 px. Without it (quick mode): 320, 768, 1440 and 1920 px, and the widths either side of each breakpoint. |
| `--widths <a,b,c>` or `<from:to:step>` | | The widths to measure, replacing the mode's. |
| `--engines <list>`, `--no-engines` | `webkit,firefox` | Second-opinion engines for the layout checks. Chromium always runs. |
| `--fail-on error\|warning\|never` | `never` | The severity at which the exit code becomes 1. |
| `--workers <n>` | CPU cores less two, at most one per GB of memory beyond 2 GB, at least 1 | Jobs run at once. |
| `--wait-for <selector>` | none | Waits up to 30 s for the selector on each load before measuring. |
| `--settle <ms>` | 0 | Extra wait after each load. |
| `--watchdog <minutes>` | 10 | Minutes without progress before the run stops; 0 for never. |
| `--baseline <file>`, `--write-baseline [file]`, `--page <key>` | | Compare with accepted findings, or record them (`itten-baseline.json` in the working directory by default). |
| `--shard <i/n>`, `--merge <dir,dir,...>` | | Split one page's jobs across machines, then combine them. |
| `--version` | | Prints `itten <version> <commit SHA>` and exits 0, running nothing else. Adds `(with uncommitted changes)` when a tracked file differs from the commit; prints `commit unknown` for a copy of ITTEN that is not its own git checkout, except the Agent Skill installed with `gh skill install`, which prints the ref it was installed at and the repository. |

Put the URL first. A flag takes the next argument as its value unless that argument starts with `--`. An unknown flag is ignored, not rejected; from 0.5 it exits 64 and runs nothing.

## Inputs

- **URL.** Required: an `http` or `https` URL of a page that is already being served. ITTEN does not build a site or start a server. Every width of every pass is a fresh load, waiting for the `load` event, with a 60 s timeout per load.
- **Files.** `--system` and `--baseline` are read if given; both are optional.
- **Logins.** None, and none can be given. ITTEN sends no cookies, headers, credentials or stored session, so a page behind a login can be inspected only at a URL that serves it without one.
- **Seed or data size.** None. ITTEN uses no randomness and takes no seed. It also does not seed or freeze the page's own randomness or clock: a page that changes from load to load is measured as it comes.
- **Environment.** `ITTEN_TIMINGS` sets the path of the timings file (below). ITTEN reads nothing else from the environment; Playwright reads its own variables, such as `PLAYWRIGHT_BROWSERS_PATH`.

## Outputs

In the `--out` directory:

- `report.json`: a `report/1` (`schema/report.schema.json`).
  - `status` is `complete` (every check ran), `partial` (a step timed out, or `--wait-for` never matched; `reason` names it) or `refused` (nothing was judged; `reason` gives the error, and `findings` is empty).
  - `findings` is an array of `finding/1` (`schema/finding.schema.json`). Each has `check`, `severity` (`error`, `warning` or `info`), `fingerprint`, `message`, `floor` (`accessibility` or `null`), `detection`, `rules` (IDs in `reference/`), `measured` (the fields that vary between runs) and `where.elements` (selector, label, text, and box in CSS px). ITTEN's own fields are under `itten` (`schema/finding-itten.schema.json`): id, count, widths and modes seen, title, rule, and crops.
  - Until a run writes its report, `report.json` says `refused`. So a run that crashes, is killed or is stopped by the watchdog never leaves an earlier run's report behind to be read as its own.
- `report.html`: the same report, for reading. It loads nothing remote.
- `crops/<finding id>-<n>.png`: zoomed crops of the findings, at most 400 per run.
- With `--shard`, `shard.json` replaces the report until the shards are merged.

Progress and a summary go to stdout, errors to stderr.

A second-opinion engine that fails to launch, or fails partway through, is recorded in `engines.notRun` and does not make the run `partial`. Check `engines.notRun` as well as `status`.

## Exit codes

| Code | When |
|---|---|
| 0 | The run finished, `complete` or `partial`, with nothing at or above `--fail-on`. With the default, `never`, every finished run exits 0. Also `--version`, a valid `--validate`, and a shard. |
| 1 | Findings at or above `--fail-on` (with a baseline, only new findings and findings that got worse); or the run failed, and `report.json` is `refused` with the error; or the system file is invalid. |
| 2 | Bad usage: no URL, or a malformed `--shard` or `--workers`. |
| 124 | Stopped by the watchdog; `report.json` is `refused`. |

A `partial` run can exit 0, so read `status` in `report.json`, not only the exit code. From 0.5 the codes are the ones shared by every specialist: 0 complete, 1 failing findings, 2 refused, 3 partial, 64 bad usage.

## Network

- ITTEN's own code makes no requests: no telemetry, no update check, no remote fonts or scripts in `report.html`.
- The browsers load the URL and everything the page requests, third parties included (scripts from a CDN, web fonts, analytics). They do this on every load: each width of each pass in Chromium, then again in each second-opinion engine. Anything the page sends on load is sent on every one of them.
- Setup only: `npm ci` reads the npm registry, and `npx playwright install` downloads the browsers from Playwright's servers.

## Writes outside the working directory

- **`<itten>/dist/timings.json`.** Job durations by page, used to estimate later runs. It is written at the end of every run that finishes, inside ITTEN's own checkout, so it lands outside the working directory whenever ITTEN is a submodule or elsewhere. `ITTEN_TIMINGS=<path>` moves it.
- **Browser profiles.** Playwright's temporary profiles go in the operating system's temporary directory and are removed when the browsers close. A run that is killed can leave them behind.
- **Paths given to flags.** `--out` and `--write-baseline` are used as given, absolute paths included.
- **Setup only.** Playwright's browser cache: `~/Library/Caches/ms-playwright` on macOS, `~/.cache/ms-playwright` on Linux.

Inside `--out`, `crops/` is deleted and created again at the start of every run, and `report.json` and `report.html` are overwritten.

## Determinism

- **Same page, same machine.** The same findings, with the same ids, order, fingerprints and messages, whatever `--workers` is, and from shards once merged. This is tested on the fixtures, on one worker and on six, field by field.
- **Fields that always differ.** The ones each finding lists in `measured` (frame counts, durations), and the report's `started`, `date`, `environment` and schedule timings.
- **Findings that can differ between two runs of the same page:**
  - the timing checks (`motion-timing`, `motion-layout`, `reduced-motion`, `flash`, `frame-timing`) on a loaded machine;
  - contrast over a background that moves, which depends on the frame sampled;
  - anything the page itself varies.
- **Different machines.** Fonts and text rendering differ by platform, so text measurements, and the findings that rest on them, can differ.
- **Different width sets.** A fluid value's fingerprint includes its value at each measured width (`fp/1`), so another set of widths gives the same finding another fingerprint. Fingerprints without measured values (`fp/2`) are planned for 0.5.
- **Pages that draw every frame (WebGL) on a machine without a GPU.** The browser draws them in software, so screenshots wait on frames the CPU draws. The screenshot steps (contrast against rendered pixels, crops) and the motion pass run out of their limits, and the run is `partial`, or `refused` if a page load times out. On HundredLives on a 4-CPU GitHub runner, that happened with 4 workers (compare-versions run 44198069706) and again with 1 (runs 44206577844 and 44206770414; 17 and 18 November 2026). Such a page cannot be inspected whole on a machine without a GPU until captures freeze the page (planned for 0.5).

## Suggested fixes

Findings carry no fix. `finding/1` has no field for one, and the inspector changes no files. Some messages name the measured alternative in prose, for example "With hyphens: auto the deepest hole would be 12%" or "Share the edge, or log the optical offset". Mechanical fixes, written to the project's source and checked again before they are kept, are planned for 0.4 (`itten fix`).
