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
| `--widths <a,b,c>` or `<from:to:step>` | | The widths to measure, replacing the mode's. With fewer than three, a value's fluidity is unknown (`sweep.fluidity`): a value is fluid when it takes three or more values across the sweep, so no fixed value off the spacing or type scale and no spacing in px is reported, and `notJudged` says so. |
| `--engines <list>`, `--no-engines` | `webkit,firefox` | Second-opinion engines for the layout checks. Chromium always runs. |
| `--fail-on error\|warning\|never` | `warning` | The lowest severity that fails the run (exit 1). Info never does. Before 0.5 the default was `never`. |
| `--workers <n>` | CPU cores less two, at most one per GB of memory beyond 2 GB, at least 1 | Jobs run at once. |
| `--wait-for <selector>` | none | Waits up to 30 s for the selector on each load before measuring. |
| `--settle <ms>` | 0 | Extra wait after each load. |
| `--watchdog <minutes>` | 10 | Minutes without progress before the run stops; 0 for never. |
| `--baseline <file>`, `--write-baseline [file]`, `--page <key>` | | Compare with accepted findings, or record them (`itten-baseline.json` in the working directory by default). |
| `--shard <i/n>`, `--merge <dir,dir,...>` | | Split one page's jobs across machines, then combine them. |
| `--version` | | Prints `itten <version> <commit SHA>` and exits 0, running nothing else. Adds `(with uncommitted changes)` when a tracked file differs from the commit; prints `commit unknown` for a copy of ITTEN that is not its own git checkout, except the Agent Skill installed with `gh skill install`, which prints the ref it was installed at and the repository. |

Put the URL first. A flag takes the next argument as its value unless that argument starts with `--`. An unknown flag exits 64 and runs nothing, as does a flag without its value.

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

Every ITTEN command uses these, shared with KERCKHOFFS and ERLANG (`inspector/usage.js`):

| Code | Meaning |
|---|---|
| 0 | `complete`, and no failing finding. Also `--version`, a valid `--validate`, and a shard. |
| 1 | Failing findings, whether the run is `complete` or `partial`. For `--validate`, a file that is not valid; for `fix.js`, a fix that was reverted; for a test or the check, a failure. |
| 2 | `refused`: nothing was judged. The page could not be reached, the run failed (`report.json` holds the error), or the system file is not valid. |
| 3 | `partial`, and no failing finding. |
| 64 | Bad usage: an unknown flag, a flag without its value, an argument too many or missing, or a value a flag does not take. Nothing is run: no browser, no report. (`EX_USAGE` in `sysexits.h`.) |
| 124 | The watchdog stopped a run that made no progress; `report.json` is `refused`. |

**Severity.** Errors and warnings fail a run; info never does. An info-only run exits 0 when complete and 3 when partial. `--fail-on error` lets warnings pass, and `--fail-on never` lets everything pass; with a baseline, only new findings and findings that got worse count. The summary counts errors, warnings and info apart (`summary.error`, `summary.warning`, `summary.info`, and the last line the command prints).

Read `status` in `report.json` as well as the exit code: 1 says a finding fails, not whether the run was whole.

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
  - the timing checks (`motion-timing`, `motion-layout`, `reduced-motion`, `flash`, `frame-timing`) on a loaded machine; the ones that rest on a measured time are then reported as info, timing unreliable (see Timing findings);
  - contrast over a background that moves, which depends on the frame sampled;
  - anything the page itself varies.
- **Different machines.** Fonts and text rendering differ by platform, so text measurements, and the findings that rest on them, can differ.
- **Different width sets.** A fluid value's fingerprint includes its value at each measured width (`fp/1`), so another set of widths gives the same finding another fingerprint. Fingerprints without measured values (`fp/2`) are planned for 0.5.
- **Pages that draw every frame (WebGL) on a machine without a GPU.** The browser draws them in software, so a screenshot waited on frames the CPU draws: on HundredLives on a 4-CPU GitHub runner, the screenshot steps ran out of their limits with 4 workers (compare-versions run 44198069706) and with 1 (runs 44206577844 and 44206770414; 17 and 18 November 2026). Since 0.5 every capture holds the page first (its animation frames, and CSS and Web Animations), and each crop names the frame it was held at (`crops[].frame`). The motion pass still runs the page live, so its timing on such a machine measures the renderer.

## Fixtures

A fixture is a page with planted defects, a clean twin with each one fixed, and a list of rows (`fixtures/defects.json`, `fixtures/expected.json`). The rule is shared with KERCKHOFFS and ERLANG:

- A **defect** row is a finding the page must have and its twin must not. Recall is defects caught over defects planted; precision is true positives over all findings.
- An **expected** row is a finding both pages have. It must be reported on the page and on its twin, as info; it counts as neither a catch nor a false positive. On one page only, or as a warning or an error, it fails the test.
- Every clean twin exits 0: complete, with no error and no warning.

`scripts/fixture-test.js` scores the rows and `scripts/expected-test.js` runs the rule on a pair of its own, with controls.

## Continuous integration

The rule shared with KERCKHOFFS and ERLANG: a specialist's own tests run at least on every non-Markdown change, that is on every push to `main` and every pull request that changes anything but Markdown, and on any pushed `v*` tag.

ITTEN runs its self-test on every push and every pull request, with no path filter. `main` requires the `checks` and `fixtures` jobs, and a required check must report on every commit: a workflow filtered out by `paths-ignore` reports nothing, so a Markdown-only pull request could never merge. `scripts/ci-test.js` fails if a filter is added.

## The server's health

A run that measures a page the server failed to send measures an error state. The first load of a run (the watch load) says what the server sends: the requests it answered, and the ones that failed there too, which are the page's own (a missing file fails on every load, and is reported as `page-load`).

A job's load has a server failure when a request the first load did not fail gets no response, is reset, is answered 5xx, or is answered 4xx though the first load was sent it; or when the page load itself fails or runs out of its limit. Such a job is run again once.

- **The second run is served:** it is the one reported. `health.retried` lists the job and the requests that failed the first time, and `notJudged` says so. The run can still be `complete`.
- **It fails again:** the job is dropped. Nothing it measured is kept, `health.dropped` lists the job and its failed requests, and the report is `partial` with a `reason` that names them. It is `partial`, never `refused`, also when every job is dropped.

`refused` stays for a run that judged nothing: the page could not be reached for the first load, or a guard declined to run.

## Timing findings

Some findings rest on a measured time: long animation frames (`frame-timing`), a script's flashes counted over a second (`flash`, fingerprints ending `|script`), and from the watch load `page-load|late`, `page-load|never-still` and `page-load|busy`. The rule for them is shared with KERCKHOFFS and ERLANG.

A timing finding counts only when all of these hold:

- it was measured at least 3 times, and the relative spread of the measurements, (max − min) / median, is at most 10%;
- the 1-minute load average was below half the CPU count before the timed phase and after it;
- the browser was not drawing in software (the WebGL renderer, read from `WEBGL_debug_renderer_info`, names SwiftShader, llvmpipe or softpipe).

Otherwise the finding is reported with severity `info`, and it never fails a run. In the `itten` extension it carries `timing`: `reliable: false`, `reason: "timing unreliable"`, `causes` (sentences: the renderer, the load, the count or the spread), `was` (the severity it would have had), `values` (each measurement, in ms or a count), `spread`, and `environment` (`cpus`, `load.before`, `load.after`, `renderer`). Its message ends with the causes. A timing finding that counts carries `timing` with `reliable: true`, its three values and their spread. The report's `environment.timing` gives the CPU count, the renderer, whether it is software, and the load before and after both timed phases; `notJudged` says how many findings were set aside.

The inspector measures once. Where that one measurement raises a timing finding and the machine allows a verdict (the load and the renderer pass), the phase that timed it runs twice more, measuring only: the watch load for the `page-load` findings, the motion pass for the others. A run on a loaded machine or a software renderer does not repeat anything. Layout, type and colour findings are not affected.

## The timing lock

While ITTEN times anything, it holds a lock file, so a tool that generates load on the same machine (ERLANG) can wait: load takes CPU from the browser being timed and skews the benchmark, the settle windows and frame timing. Format `itten-timing-lock/1`; the code is `inspector/lock.js`.

**Where.** One file per ITTEN process, `timing-<pid>.json`, in the first of:

1. `$ITTEN_LOCK_DIR`
2. `$XDG_STATE_HOME/itten/locks`
3. `$HOME/.local/state/itten/locks`

ITTEN makes the directory with mode 0700 and the file with mode 0600. The file is written to `timing-<pid>.json.tmp` and renamed, so a reader never sees half a file. Only names that match `timing-<digits>.json` are locks; a reader ignores everything else in the directory.

**Contents.** One JSON object with exactly these fields:

| Field | Value |
|---|---|
| `format` | `"itten-timing-lock/1"` |
| `pid` | The ITTEN process's id, a whole number; the same as in the file's name. |
| `phase` | `"benchmark"` (the CPU benchmark and the watch load, before the jobs) or `"motion"` (the motion and frame-timing pass, after them). |
| `taken` | When the lock was taken, ISO 8601 in UTC with milliseconds. |
| `expires` | When it lapses, in the same form: the phase's expected length from earlier runs plus 60 s, and never more than 15 minutes after `taken`. |
| `project` | The directory the run was started in, an absolute path. |

**When.** The lock exists only during the two timed phases. No lock is held while the parallel jobs, the breakpoint scan or the crops run. While a phase runs past its expected length the lock is renewed (`expires` moved to 60 s from now, the file rewritten by rename), at most every 30 s, up to the 15-minute limit. It is removed when the phase ends, when the process exits, and on `SIGINT` and `SIGTERM` (the process then dies of the signal as it would have). A process killed with `SIGKILL` leaves its file; that is what expiry and the pid are for.

**How a reader treats a lock.** A reader only reads; it never writes, renews or deletes a lock.

- **Active**: the file parses, its `format` is `itten-timing-lock/1`, the process `pid` is alive on this machine, and the time is before `expires`.
- **Active, too**: a file that cannot be read or parsed, has another `format`, or lacks a whole-number `pid` or a readable `expires`. A reader that cannot tell assumes timing is under way.
- **Stale**: the process `pid` is not alive, or the time is at or past `expires`. A stale lock is ignored and left in place.

**What the other tool does.** While any lock in the directory is active it generates no load on this machine: it waits and reads again (once a second is enough; a phase lasts seconds to a few minutes), or stops and says which lock held it. It reads the directory again immediately before it starts generating load. A directory that does not exist holds no locks.

**What ITTEN does with others' locks.** Each time it takes its lock, ITTEN deletes stale locks in the directory: a dead pid, or past expiry. It never deletes a live one or another live process's. A file it cannot read is deleted only when the pid in its name is dead or the file was last written more than 15 minutes ago. Two ITTEN runs on one machine each hold and remove only their own file. A lock that cannot be written (a read-only directory) never fails a run; the run goes on without one.

ITTEN does not wait for anything: the lock says when ITTEN is timing, and it is for the load generator to keep off. The inspector's `lock: false` option (tests only) runs without it.

## Fixes

The inspector changes no files, and `finding/1` has no field for a fix. Fixes come from a separate command:

```sh
node <itten>/inspector/fix.js <url> --root <dir> [--system itten.system.json] [--out itten-fix] [--fast] [--no-engines] [--dry-run] [--apply fixes.json]
```

`--root` is the folder the server serves at the URL's root; a URL's path names a file under it. The command inspects the page (quick mode, or the fast tier with `--fast`), plans a fix for each finding, and writes `fixes.json` in `--out`, with the inspection's reports beside it (`before/`, and `recheck/<n>/` for each re-check).

- **Auto fixes** are written to the project's files, one at a time, and only to a file that is the source of truth: the file under `--root` holds exactly the text the server sends, git does not ignore it, it has no source map, and it is not in a build output folder (`dist`, `build`, `out`, `.next`, `.nuxt`, `.svelte-kit`, `_site`, `.output`). Declarations are found through the DevTools protocol, which gives each one's range in the served text. The classes: px spacing and font sizes to rem (`spacing-unit`, `text-resize`); a size compounded from `em` or `%` to the nearest step of the type scale (`type-scale`); a no-break space before a separator that begins a line (`line-start`, in the page's HTML file); `text-wrap: balance` or `pretty` where the check measured an improvement; and a `prefers-reduced-motion: reduce` block that stops an animation or transition, when the system's `reducedMotion` is `instant` or `none-animated`.
- **Every auto fix is checked again.** The page is inspected with only the passes and at the widths its finding was seen in (three widths at least, so a value's fluidity can be judged), before and after the edit. The fix is kept when the finding is gone from the elements it changed and no finding is there that was not before; otherwise the edit is reverted, and `fixes.json` says what the re-check found (`recheck.cleared`, `recheck.new`). A re-check that is not `complete` reverts the fix too.
- **Guided fixes** write nothing: the finding's locations (file, line and column where the value comes from a stylesheet, otherwise the element's selector) and a note. A value off a scale and a duration or easing off the system are guided until the owner decides how they are fixed; so is any fix whose source is not the source of truth.
- **`--apply <file>`** checks fixes written elsewhere the same way, `{ "fixes": [{ "finding": { "check", "fingerprint" }, "note", "edits": [...] }] }`, and reverts any that fail.

An edit is one of:

| Shape | Effect |
|---|---|
| `{ "file", "line", "column", "length", "replace" }` | Replaces `length` characters at `line`:`column` with `replace`; a length of 0 inserts. |
| `{ "create": file, "content" }` | Makes a file that must not exist. |
| `{ "remove": file }` | Deletes a file. |

**The edit-unit rule, shared with KERCKHOFFS and ERLANG.**

- `file` is relative to the root (`--root`), with `/` between its parts. A path that is absolute, that leaves the root (`..`), or that reaches outside it through a symbolic link is refused.
- `line` and `column` are 1-based.
- `column` and `length` count UTF-16 code units, as JavaScript strings do.
- A line ends at `\n` and nowhere else. The `\r` of a `\r\n` pair is the last character of its line.
- A byte-order mark at the start of a file is not counted: line 1, column 1 is the character after it, and an edit never removes it.
- A set of edits is written all or none: overlapping edits, a position past the end of a line or file, or a create over an existing file are refused before anything is written.

Exit codes of `fix.js`: 0, no fix reverted; 1, a fix was reverted; 2, the inspection was refused or the system file is not valid; 64, bad usage (an unknown flag, no URL, no `--root`), with nothing run.

Some inspector messages also name the measured alternative in prose, for example "With hyphens: auto the deepest hole would be 12%".
