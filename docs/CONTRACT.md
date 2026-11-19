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
| `--full` | off | Every 40 px from 320 to 1920 px, and every width quick mode measures. Without it (quick mode): 320, 768, 1440 and 1920 px, and the widths either side of each breakpoint. |
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
- **Pages that draw every frame (WebGL) on a machine without a GPU.** The browser draws them in software, so a screenshot waited on frames the CPU draws: on HundredLives on a 4-CPU GitHub runner, the screenshot steps ran out of their limits with 4 workers (compare-versions run 44198069706) and with 1 (runs 44206577844 and 44206770414; 17 and 18 November 2026). Since 0.5 every capture holds the page first (its animation frames, and CSS and Web Animations), and each crop names the frame it was held at (`crops[].frame`). The motion pass still runs the page live, so its timing on such a machine measures the renderer.

## Fixes

The inspector changes no files, and `finding/1` has no field for a fix. Fixes come from a separate command:

```sh
node <itten>/inspector/fix.js <url> --root <dir> [--system itten.system.json] [--out itten-fix] [--fast] [--no-engines] [--dry-run] [--apply fixes.json]
```

`--root` is the folder the server serves at the URL's root; a URL's path names a file under it. The command inspects the page (quick mode, or the fast tier with `--fast`), plans a fix for each finding, and writes `fixes.json` in `--out`, with the inspection's reports beside it (`before/`, and `recheck/<n>/` for each re-check).

- **Auto fixes** are written to the project's files, one at a time, and only to a file that is the source of truth: the file under `--root` holds exactly the text the server sends, git does not ignore it, it has no source map, and it is not in a build output folder (`dist`, `build`, `out`, `.next`, `.nuxt`, `.svelte-kit`, `_site`, `.output`). Declarations are found through the DevTools protocol, which gives each one's range in the served text. The classes: px spacing and font sizes to rem (`spacing-unit`, `text-resize`); a size compounded from `em` or `%` to the nearest step of the type scale (`type-scale`); a no-break space before a separator that begins a line (`line-start`, in the page's HTML file); `text-wrap: balance` or `pretty` where the check measured an improvement; and a `prefers-reduced-motion: reduce` block that stops an animation or transition, when the system's `reducedMotion` is `instant` or `none-animated`.
- **Every auto fix is checked again.** The page is inspected with only the passes and at only the widths its finding was seen in, before and after the edit. The fix is kept when the finding is gone from the elements it changed and no finding is there that was not before; otherwise the edit is reverted, and `fixes.json` says what the re-check found (`recheck.cleared`, `recheck.new`). A re-check that is not `complete` reverts the fix too.
- **Guided fixes** write nothing: the finding's locations (file, line and column where the value comes from a stylesheet, otherwise the element's selector) and a note. A value off a scale and a duration or easing off the system are guided until the owner decides how they are fixed; so is any fix whose source is not the source of truth.
- **`--apply <file>`** checks fixes written elsewhere the same way, `{ "fixes": [{ "finding": { "check", "fingerprint" }, "note", "edits": [...] }] }`, and reverts any that fail.

An edit is one of:

| Shape | Effect |
|---|---|
| `{ "file", "line", "column", "length", "replace" }` | Replaces `length` characters at `line`:`column` with `replace`; a length of 0 inserts. |
| `{ "create": file, "content" }` | Makes a file that must not exist. |
| `{ "remove": file }` | Deletes a file. |

`file` is relative to `--root` and never outside it. `line` and `column` are 1-based; `column` and `length` count UTF-16 code units, as JavaScript strings do. A set of edits is written all or none: overlapping edits, a position past the end of a line or file, or a create over an existing file are refused before anything is written.

Exit codes of `fix.js`: 0, no fix reverted; 1, a fix was reverted; 2, the inspection was refused; 64, bad usage (an unknown flag, no URL, no `--root`), with nothing run.

Some inspector messages also name the measured alternative in prose, for example "With hyphens: auto the deepest hole would be 12%".
