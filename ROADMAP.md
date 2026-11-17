# Roadmap

The order in which ITTEN grows, what each version covers, what it needs first, and the test it has to pass before it ships. Every version also has to keep the fixture test at full recall, full precision and no findings on the clean twins. Scope can move between versions; the order holds where a version depends on the one before.

Status, 16 November 2026: 0.2 shipped as 0.2.0, and 0.3 as 0.3.0 with fixes up to 0.3.4 (`CHANGELOG.md`). Still open from 0.3's acceptance test: the pull request half on a test repository (a planted defect named in the comment, a clean comment once it is removed), a pull request from a fork, and the first scheduled telemetry run. 0.3.5 is in review.

| Version | What it adds | Needs |
|---|---|---|
| 0.3.5 | Parallel inspector | 0.3.4 |
| 0.4 | `itten fix` and work packets | 0.3.5 |
| 0.4.x | Fleet protocol | 0.4 |
| 0.5 | Mutation testing of the inspector and the fixer | 0.4 |
| 0.6 | `itten lint`, patterns and decode; approved-look snapshots | 0.4 |
| 0.6.x | Survey and consensus | 0.6 |
| 0.7 | State coverage | 0.3.5 |
| 0.8 | Modes and realities | 0.7 |
| 0.9 | Craft measures, as information | 0.5 |
| 1.0 | A second opinion from pixels | 0.5 |
| 1.1 | Teardown from images | 1.0 |
| 1.2 | Inspiration against build | 1.1 |

Two tracks run beside these: a public scorecard, and a paper once 0.5 and 0.7 have shipped.

## 0.3.5 · Parallel inspector

**Scope.** A run is split into jobs: each width of each pass and each resize, a fresh load in a browser context of its own. Up to `--workers` run at once (by default the CPU cores less two, capped by memory). Findings are recorded afterwards in the order a serial run takes them, so ids, first sightings and messages do not depend on the number of workers. What measures time runs alone: the benchmark and the watch load before the jobs, motion and frame timing after them. `--shard i/n` and `--merge` split one page's jobs across CI machines and combine them into one report and one baseline comparison; the action has `shard` and `merge` inputs. A plan line at the start gives the jobs, the workers and the estimated time, from per-job times kept in `dist/`. Quick mode adds the width on each side of every breakpoint between its four widths, found by a scan that resizes one page across the range.

**Needs.** The step limits and the watchdog of 0.3.4: a job that hangs must close its own context and nothing else.

**Acceptance test.** The fixtures inspected on one worker and on six give identical findings, field by field, and so do neptune-fork's two pages. The timed phases overlap nothing (`schedule.phases`). A run split into three shards and merged gives the same findings as one run. The fixture test passes in quick mode with the added widths and in the full sweep.

**Prior art.** Playwright's test runner shards a suite with `--shard=x/y` and combines the shards' reports with `merge-reports` ([Playwright, "Sharding"](https://playwright.dev/docs/test-sharding)). ReDeCheck checks a responsive page across a range of widths and looks for where its layout breaks between them ([Walsh, Kapfhammer and McMinn, "Automated layout failure detection for responsive web pages without an explicit oracle", ISSTA 2017](https://doi.org/10.1145/3092703.3092712)); quick mode's widths around each breakpoint follow the same observation, that layouts fail where they change.

## 0.4 · `itten fix`, and work packets

**Scope.**

- `itten fix`: mechanical fixes, written to the project's source with a CSS parser ([PostCSS](https://postcss.org/)) and an HTML parser, for the classes of finding that have one right answer once the system is known: px spacing and font sizes to rem; fractional and compounded `em` sizes to the nearest step; a value one step off the scale to the step, when only one step is within the tolerance; a no-break space before a separator that begins a line; `text-wrap: balance` on headings and `pretty` on paragraphs where the check measured an improvement; durations and easings to the system's names; a missing `prefers-reduced-motion` guard. Anything that needs a choice (which of two steps, a new colour, a changed layout) is not fixed; it goes to a packet with the question.
- Work packets: the findings of a run grouped by root cause (one CSS rule or one component, not one element) and by the files a fix touches, located through the browser's style sources (the rule and stylesheet behind each computed value). Each packet names its files, the findings it closes, whether it can be fixed mechanically, and its owner where the project has a `CODEOWNERS` file. Two packets that touch the same file are marked as conflicting.
- Frozen captures. Element screenshots time out on a page with a running WebGL scene: the inspector waits for the page to settle, and a page that draws every frame never does (HundredLives' valley, 16 November 2026). The page is frozen for each capture instead: animations held through the DevTools protocol (`Animation.setPlaybackRate` to 0), `requestAnimationFrame` paused so canvas and WebGL loops stop drawing, or time held with `Emulation.setVirtualTimePolicy`. The report records which frame was captured (the document timeline's time, and how many animation frames had run), so a crop can be taken again at the same frame.
- Contrast over a moving background, judged as a distribution. Behind text on a page that keeps drawing (a WebGL scene, a video, an animated gradient) the pixels change from frame to frame, so one sample can pass in one run and fail in the next: on HundredLives, a counter measured 2.89 : 1 against a 3 : 1 floor in one run and above it in another, so the same finding was seen at one width or at two (0.3.5 parity runs, 17 November 2026). The page is frozen, as above, at a fixed set of frames, the same set every run; contrast is measured in each frame; the finding is judged on the 10th percentile across the frames, and the report gives each frame's value. With the same frames every run, a contrast finding's presence and severity are the same every run. Until then, parity reports the differences on such a page and does not fail on them.
- A timing lock, for ERLANG. While ITTEN times anything (the benchmark and the watch load before the jobs; motion and frame timing after them), it holds a lock file, so ERLANG never generates load on the same machine during those measurements: load takes CPU from the browser being timed and skews the benchmark, the settle windows and frame timing. One file per ITTEN process, `timing-<pid>.json`, in `${ITTEN_LOCK_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/itten/locks}`, created with mode 0700; written to a `.tmp` file and renamed, so a reader never sees half a file; removed in a `finally` and on `SIGINT` and `SIGTERM`. It records its format (`itten-timing-lock/1`), the pid, the phase (`benchmark` or `motion`), when it was taken, when it expires (the phase's expected length from earlier runs plus 60 s, never more than 15 minutes after it was taken, renewed at most every 30 s while a phase runs over) and the project. No lock is held while the parallel jobs run. ITTEN writes, renews and removes the lock; ERLANG only reads it, treats a lock it cannot read as active, and refuses to generate load while one is active. The format and both sides' behaviour are specified with ERLANG (its `research/itten-lock.md`, 17 November 2026).

**Needs.** 0.3.5, since every fix is checked by inspecting again, and a fast re-inspection is what makes that practical.

**Acceptance test.** Each class of fix has three fixture pages: before (the defect planted), the fix as `itten fix` writes it, and a clean re-inspection that reports nothing of that class and nothing new. The fixed page must match its hand-written clean twin, and a second `itten fix` must change nothing. On neptune-fork and HundredLives, every finding is in exactly one packet, and packets marked conflict-free touch disjoint files. On a fixture that draws a WebGL scene every frame, every element screenshot finishes within its timeout, two captures at the same recorded frame are identical, and the report names the frame. On the same fixture, text over the scene gets the same contrast findings, with the same severity and the same per-frame values, in two runs, on one worker and on several. The timing lock exists only during the two timed phases, one file per process; it is removed when a run ends normally and when it is stopped with `SIGINT` or `SIGTERM`; at start ITTEN deletes a stale lock (a dead pid or past its expiry) and never a live one; two ITTEN runs on one machine each hold and remove only their own; and `ITTEN_LOCK_DIR` moves it.

**Prior art.** XFix repairs layout differences between browsers by searching for CSS changes ([Mahajan, Alameer, McMinn and Halfond, "Automated repair of layout cross browser issues using search-based techniques", ISSTA 2017](https://doi.org/10.1145/3092703.3092726)). The same group repaired layouts distorted by translated text ([Mahajan et al., "Automated Repair of Internationalization Presentation Failures in Web Pages Using Style Similarity Clustering and Search-Based Techniques", ICST 2018](https://doi.org/10.1109/ICST.2018.00030)), and mobile-friendly problems such as unreadable text and overflow ([MFix: Mahajan, Abolhassani, McMinn and Halfond, "Automated repair of mobile friendly problems in web pages", ICSE 2018](https://doi.org/10.1145/3180155.3180262)). Those search for a repair that makes a page pass; `itten fix` applies only the fixes the system determines and leaves the rest as questions.

## 0.4.x · Fleet protocol

**Scope.** A protocol, `protocol/05-fleet.md`, for fixing a project's packets with several workers at once, each in its own git worktree. Roles: a lead who takes the run and the packets and assigns them; a system owner who alone may change `itten.system.json` and the shared CSS, and carries out the design decisions the project's owner makes; fixers, one per packet. Every fixer's branch is inspected again before it merges, and a branch that adds a finding is sent back. Questions that need the owner's taste (a new step, a changed look) go to a design-decision queue instead of being guessed. The number of fixers is the smaller of the conflict-free packets and the project's caps (machines, CI minutes, reviewers).

**Needs.** 0.4's packets and their conflict marks.

**Acceptance test.** On a copy of a project with at least eight packets, a fleet run closes every mechanical packet, merges without a conflict, finishes with an inspection that reports no new findings, and leaves each non-mechanical packet in the queue with its question. Two packets that touch one file are never in flight at once.

## 0.5 · Mutation testing of the inspector and the fixer

**Scope.** Defects are injected at random into clean pages (a spacing value moved off the scale, a fractional size, a separator left to start a line, an animated layout property, a low-contrast pair, a clipped box), many per check, at random places and widths. Each mutant is inspected; recall is reported per check, with the mutants each check missed kept as new fixtures. The fixer is tested the same way: every mutant of a fixable class must come back clean after `itten fix`.

**Needs.** 0.4, for the fixer half. The inspector half could start earlier, but its misses are most useful once there is a fixer they would mislead.

**Acceptance test.** Recall per check on at least 200 mutants per check, published with the run, and no check below a stated floor (to be set from the first run). Every missed mutant either becomes a fixture that the next release catches, or is documented as out of scope with the reason. On the fixable classes, `itten fix` returns every mutant to a clean re-inspection.

**Prior art.** [Stryker](https://stryker-mutator.io/) mutates program code and reports which mutants a test suite fails to catch; 0.5 mutates the pages instead and measures the inspector as the test suite.

## 0.6 · `itten lint`, patterns and decode

**Scope.** Three kinds of guidance, kept apart everywhere in ITTEN (protocol, reference, reports, the lint output):

- **Craft rules**: proportion and behaviour, such as spacing on the scale or an underline that scales with its text. Enforced; a deliberate departure is logged as an override.
- **Floors**: accessibility, such as contrast, target size, reflow and visible focus. Enforced, and never overridable (`ITTEN.md`, precedence).
- **Patterns**: one good implementation of a rule or a floor, decoded from a real site. An opt-in library, never a default look: a project uses a pattern only when its brief asks for it, with its own values.

`patterns/` holds one file per decoded pattern. Each gives the pattern; why it works; a framework-neutral CSS snippet, with the project's values left as custom properties; its provenance (the site, the element and the date it was decoded); the bugs found in the original; the craft rule or floor it satisfies; and the ITTEN check that enforces that rule. `patterns/scaling-underline-and-halo-focus.md` is the first.

`itten decode <url> <selector>` opens the page, reads the element's computed styles in its default, hover, focus-visible and forced-colours states, reports which values scale with the font size (`em`, `max()`, `clamp()`) and which are fixed, and drafts a pattern file. A person curates the draft before it joins `patterns/`; nothing decoded is added unread.

`itten lint`: [Stylelint](https://stylelint.io/) rules generated from `itten.system.json`, so a value off the spacing scale, a font size outside the steps, a radius outside the set or a duration not in the system is reported before anything renders. `itten lint --changed` lints only the files changed since the last commit. It is a plain command, so an editor, a git hook or any other tool can run it after an edit. `ITTEN.md` shows how a project wires it as an on-edit hook in its own private settings, kept out of git; ITTEN itself names no tool.

Published guidance, mined into `reference/` as rules with IDs, each citing the source it came from:

- [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) (Vercel, on GitHub);
- [Invisible Details of Interaction Design](https://rauno.me/craft/interaction-design) (Rauno Freiberg, July 2023);
- the [GOV.UK Design System](https://design-system.service.gov.uk/) ([source](https://github.com/alphagov/govuk-frontend));
- [Primer](https://primer.style/), GitHub's design system;
- [Polaris](https://shopify.dev/docs/api/polaris), Shopify's design system (its React library is [archived](https://github.com/Shopify/polaris) as deprecated, so rules are taken from the current documentation);
- the [Carbon Design System](https://carbondesignsystem.com/) (IBM).

A rule taken from these enters as a craft rule, a floor or a pattern, never as a look.

Approved-look snapshots: once the owner approves a look, screenshots at the key widths are stored with the project, and a later run reports where the rendered page differs from them, as information with crops, so a change in look is seen and approved rather than slipped in.

**Needs.** 0.4, for the system-to-rule mapping it shares with the fixer.

**Acceptance test.** On the fixtures, `itten lint` reports every planted defect that is visible in the source (spacing, type, radius, motion values) and nothing on the clean twin; `--changed` reports only the files changed. `itten decode` on a fixture element with known styles drafts a pattern file with those values, and names correctly which scale with the font size. A new check enforces the first pattern's craft rule: an underline whose thickness or offset stays fixed while its text grows is reported, with a planted defect and a clean twin. A snapshot run on an unchanged page reports nothing; on a page with one planted change, it reports that change with a crop.

## 0.6.x · Survey and consensus

**Scope.** `itten survey <sites.json>` runs the inspector's capture on other people's sites: computed styles, CSS custom properties, fonts and their OpenType features, hover and focus forced through the DevTools protocol (`CSS.forcePseudoState`), the declared animations and transitions from `getAnimations()`, and runs with reduced motion and in dark mode. It records behaviour, not looks.

- **Normalised on features that do not depend on scale**, so sites of different sizes and brands compare: the type-scale ratio; spacing as multiples of a fitted base unit, fitted by least use-weighted displacement as the HundredLives scale was; the radius set; the shapes of the easing curves; duration bands; how underlines and focus behave.
- **Consensus.** Each candidate rule records where it was seen: "observed in n of N sites", with the date. Where sites disagree, the disagreement is recorded as a design decision with each side's sites, not averaged away as noise. A floor always overrides consensus: a practice most sites share that breaks a floor is recorded as a common failure, never as a rule.
- **Evidence levels.** Two levels join the existing ones in `reference/README.md`: `observed (n/N, date)`, for a rule seen across surveyed sites, and `reason: inferred`, for the reason given for an observed rule when no source states it.
- **What is published.** Raw captures stay private, in an ignored directory. Only derived, dated observations and the rules drawn from them are published.
- **Crawling politely.** robots.txt is respected and each site's terms of use are checked before it is surveyed; a site whose terms forbid automated access is left out. One page at a time, at a slow rate, with a user agent that names the survey. Behaviours only: no assets, fonts, images or brand are kept.
- **Over time.** The survey runs again each quarter, so a rule's evidence shows when a practice spreads or fades.

**Needs.** 0.6, for decode and for the three kinds of guidance that survey results are sorted into.

**Acceptance test.** On a set of fixture sites with known values, the survey recovers each site's type ratio, base unit, radius set, easing shapes and duration bands; a planted disagreement between two fixture sites is recorded as a decision, not merged; a planted common practice that breaks a floor is reported as a failure, not proposed as a rule; and nothing raw appears in the published output.

**Prior art.** Webzeitgeist built a queryable repository of more than 100,000 web pages and 100 million design elements, with their structure and visual properties ([Kumar, Satyanarayan, Torres, Lim, Ahmad, Klemmer and Talton, "Webzeitgeist: Design Mining the Web", CHI 2013](https://doi.org/10.1145/2470654.2466420)). Rico did the same for Android apps, with their interaction traces ([Deka, Huang, Franzen, Hibschman, Afergan, Li, Nichols and Kumar, "Rico: A Mobile App Dataset for Building Data-Driven Design Applications", UIST 2017](https://doi.org/10.1145/3126594.3126651)). The HTTP Archive's Web Almanac measures CSS use across millions of pages ([CSS chapter, 2022](https://almanac.httparchive.org/en/2022/css), the latest with a CSS chapter). [Project Wallace](https://www.projectwallace.com/) and [CSS Stats](https://cssstats.com/) analyse one site's stylesheets: its colours, sizes, spacing and specificity. None of these combines interaction states, motion and a judgement of craft into rules that can be enforced, each with its agreement across sites.

## 0.7 · State coverage

**Scope.** The states the inspector does not reach now: hover, focus-visible and active on every interactive element; open menus, dialogs, popovers and disclosure widgets; empty, loading and error states where the page offers a way to reach them (a fixture URL, a query parameter, or a script the project supplies). Each state is measured by the layout and contrast checks as the default state is.

**Needs.** 0.3.5: states multiply the jobs, and only a parallel run keeps that to minutes.

**Acceptance test.** Fixtures with defects that appear only in a state (a hover colour below 4.5:1, a menu that overflows at 320 px, a dialog that clips its text at 200% text, an error message off the type scale), each caught, with clean twins that report nothing.

**Prior art.** Crawljax reaches an application's states by firing events and records them as a state-flow graph ([Mesbah, van Deursen and Lenselink, "Crawling Ajax-Based Web Applications through Dynamic Analysis of User Interface State Changes", ACM TWEB 2012](https://doi.org/10.1145/2109205.2109208); first described at ICWE 2008, [doi:10.1109/ICWE.2008.24](https://doi.org/10.1109/ICWE.2008.24)). 0.7 needs fewer states than a crawler, the ones a reader sees on one page, and measures each.

## 0.8 · Modes and realities

**Scope.** The page as people actually get it:

- dark mode as a full layout pass, not only contrast; `forced-colors` and `prefers-contrast` ([Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/));
- print, paginated, with widows and orphans across pages;
- right-to-left text, and pseudo-localisation (text lengthened by 30 to 40% and accented) to find layouts that only fit English;
- iOS realities: dynamic viewport units (`dvh`), safe-area insets ([CSS Environment Variables](https://www.w3.org/TR/css-env-1/)) and the on-screen keyboard over a focused field;
- layout shift during load ([Cumulative Layout Shift](https://web.dev/articles/cls));
- colour-blind distinctness: series and states that differ only in hue, checked under simulated protanopia, deuteranopia and tritanopia;
- focus in forced colours: the focus indicator stays visible. Forced-colours mode sets `box-shadow` to `none` ([CSS Color Adjustment, 3.1](https://www.w3.org/TR/css-color-adjust-1/#forced-colors-properties)), so a ring drawn only with a box shadow, on an element whose outline is removed, disappears there.

**Needs.** 0.7, since several of these only show in a state (a field focused, a menu open).

**Acceptance test.** One planted defect per mode, caught, with a clean twin: a border that vanishes in forced colours, a column that overflows under pseudo-localisation, a fixed footer under the iOS keyboard, a chart whose two series merge under deuteranopia, a focus ring drawn only with a box shadow that is gone in forced colours, and so on.

**Prior art.** The translated-text repair above ([Mahajan et al., ICST 2018](https://doi.org/10.1109/ICST.2018.00030)) and MFix ([ICSE 2018](https://doi.org/10.1145/3180155.3180262)) describe the failures pseudo-localisation and the phone passes look for. The colour-blind simulation follows a physiologically based model of colour vision deficiency, which covers anomalous trichromacy at any severity as well as dichromacy ([Machado, Oliveira and Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE TVCG 15(6), 2009](https://doi.org/10.1109/TVCG.2009.113)).

## 0.9 · Craft measures, as information

**Scope.** Measures of composition that are informative but not rules: grouping by proximity (whether the gaps inside a group are smaller than the gaps between groups, as LAY-06 asks), alignment entropy (how many distinct left edges and baselines a screen uses), and the layout aesthetics measures of Ngo et al. (balance, equilibrium, symmetry, regularity, economy and others). They are reported as information only, never as errors, with each value and how it was computed, so a project can watch them change.

**Needs.** 0.5, so that each measure's response to known changes is tested before anyone reads meaning into it.

**Acceptance test.** Each measure moves in the expected direction on paired fixtures (a page and the same page with its groups loosened, its edges scattered, its balance shifted), and is stable within a stated tolerance across engines and runs.

**Prior art.** Ngo, Teo and Byrne define fourteen formula-based measures of screen layout aesthetics and test them against people's ratings ([Ngo, Teo and Byrne, "Modelling interface aesthetics", Information Sciences 152, 2003](https://doi.org/10.1016/S0020-0255(02)00404-8)). Miniukovich and De Angeli compute eight aesthetics measures from screenshots and check them against ratings ([Miniukovich and De Angeli, "Computation of Interface Aesthetics", CHI 2015](https://doi.org/10.1145/2702123.2702575)), after their measures of visual complexity ([AVI 2014](https://doi.org/10.1145/2598153.2598173)).

## 1.0 · A second opinion from pixels

**Scope.** Checks that work from screenshots alone, for what the DOM cannot see or reports wrongly: text over WebGL, video and images, judged on the composited frame; text clipped by masks, `clip-path` or nested overflow that computed styles do not reveal; broken images, and images drawn larger than their natural size; text recognised in the screenshot compared with the DOM text, to find text the DOM does not expose (canvas, pseudo-elements) and DOM text that never paints.

**Needs.** 0.5, so each pixel check is measured by mutation like the DOM checks.

**Acceptance test.** Each check has planted fixtures that the DOM checks miss and the pixel check catches, and mutation recall per pixel check is published. On real pages, pixel findings that overlap DOM findings agree with them.

**Prior art.** OwlEye finds display issues such as overlapping text and missing images in app screenshots with a trained model ([Liu et al., "Owl Eyes: Spotting UI Display Issues via Visual Understanding", ASE 2020](https://doi.org/10.1145/3324884.3416547)). Screen Recognition infers interface elements from pixels to create accessibility metadata ([Zhang et al., CHI 2021](https://doi.org/10.1145/3411764.3445186)). UIED detects interface elements by combining classical image processing with deep learning ([Xie et al., ESEC/FSE 2020](https://doi.org/10.1145/3368089.3417940)), after a comparison of the two approaches ([Chen et al., "Object detection for graphical user interface: old fashioned or deep learning or a combination?", ESEC/FSE 2020](https://doi.org/10.1145/3368089.3409691)). Seenomaly lints animations from screen recordings against design guidelines ([Zhao et al., ICSE 2020](https://doi.org/10.1145/3377811.3380411)).

## 1.1 · Teardown from images

**Scope.** Most inspiration arrives as an image, not a URL. 1.1 measures a reference image the way `protocol/01-teardown.md` measures a live page, in two paths: interface references (type size ratios, the spacing base unit, the alignment lines) and photographic references (colour proportions by area, composition, texture). It is evaluated without hand labels: known pages are rendered and screenshotted, the teardown sees only the image, and its measurements are scored against what the inspector measures on the same page.

**Needs.** 1.0's element detection from pixels.

**Acceptance test.** On a held-out set of rendered pages, the interface path recovers the type ratio and the spacing base unit within stated tolerances on a stated share of pages, and the alignment lines with stated precision and recall. The photographic path reproduces the colour proportions of synthetic images whose proportions are known.

**Prior art.** UIED and Screen Recognition (above) detect elements from pixels, which the interface path builds on. Design2Code scores generated pages against reference screenshots by matched elements, text, position and colour ([Si et al., "Design2Code: Benchmarking Multimodal Code Generation for Automated Front-End Engineering", NAACL 2025](https://doi.org/10.18653/v1/2025.naacl-long.199)); 1.1 reverses the direction, scoring measurements taken from the image against measurements of the page.

## 1.2 · Inspiration against build

**Scope.** Compare a teardown (from a page, or from an image in 1.1) with the inspector's measurements of the build, and report the deltas: type ratios, spacing base and ratios, radii, colour proportions, and structure, such as the number of columns, the alignment lines and the order of groups.

**Needs.** 1.1.

**Acceptance test.** A build made to a teardown on purpose reports deltas within tolerance; the same build with planted drifts (a changed type ratio, a different spacing base, a missing alignment line) reports each drift and nothing else.

**Prior art.** Design2Code (above) measures how closely a generated page matches its reference. 1.2 compares the systems behind the two rather than the pixels, so a build can match its inspiration's proportions at a different size or with different content.

## Architecture: a shared core and specialists

ITTEN checks design detail. Security and load are checked by the same loop with different rules, so the loop is shared and the rules are not.

**The core.** The supervisor loop: brief → lint → inspect → gate → fix. The gate holds a piece of work open while any check fails: nothing is done until the checks pass. Around the loop: one finding format, fingerprints that stay the same from run to run, work packets (0.4), the board, the Action, and the mechanical fixer (0.4). Today the core lives inside ITTEN.

**The board.** The shared state of a run. Every participant (the lead, the system owner, the fixers, the verifier) reads and writes it, so none of them message each other directly. It holds the findings and their work packets, each with its state and owner; which files each packet has claimed, so two fixers never edit the same file; notes participants leave for each other, such as "changed the usage of `--space-3`"; the queue of design decisions waiting for the project's owner, the person whose design it is (the system owner implements the scale and the shared CSS but makes no design calls); and the run's clock and budget. It follows the blackboard architecture of the Hearsay-II speech-understanding system, in which independent knowledge sources cooperate only through a shared data structure ([Erman, Hayes-Roth, Lesser and Reddy, "The Hearsay-II Speech-Understanding System: Integrating Knowledge to Resolve Uncertainty", ACM Computing Surveys 12(2), 1980](https://doi.org/10.1145/356810.356816)). The fleet protocol (0.4.x) is its first user. It is extracted into a package of its own when the second specialist begins, and not before: the shared part is drawn from its second real use, not guessed from the first.

**Specialists.** Each stands alone, with its own rules, checks and fixtures, and publishes its own recall and precision on them.

- **ITTEN**: design detail. This repository.
- **KERCKHOFFS**: security. Named for Auguste Kerckhoffs, whose "La cryptographie militaire" ([Journal des sciences militaires, vol. IX, January and February 1883](https://www.petitcolas.net/kerckhoffs/)) set out six rules for a military cipher; the second, that the system "must not require secrecy and can be stolen by the enemy without causing trouble", is now stated as Kerckhoffs's principle: a system must stay secure when everything but the key is public. Scope: exposed secrets; authorisation, including access to each object; injection and cross-site scripting; security headers and Content Security Policy; CORS; rate limits; vulnerable dependencies; errors that leak internals. It runs only against the owner's own code and deployments, never against a third party's site.
- **ERLANG**: load and resilience. Named for Agner Krarup Erlang, whose 1909 paper on telephone traffic, "The Theory of Probabilities and Telephone Conversations", began queueing theory ([MacTutor](https://mathshistory.st-andrews.ac.uk/Biographies/Erlang/); [INFORMS](https://www.informs.org/Explore/History-of-O.R.-Excellence/Biographical-Profiles/Erlang-Agner-Krarup)). Scope: capacity under concurrent load; query patterns (one query per item where one query would do, queries without a limit, pagination); caching; timeouts and retries; backpressure; memory that grows without bound.

**Contracts, not shared code.** Every specialist writes findings in the same format, so the core merges them into one gate. Where two domains conflict, security floors come first, then accessibility floors, then craft. If a strict Content Security Policy forbids an inline style that a design fix relies on, the fix changes, not the policy.

**Order.** ITTEN through 0.4 (the fixer and work packets) first. Then KERCKHOFFS begins, and the core is extracted from ITTEN as it does. ERLANG after.

## Beside the versions

**Public scorecard.** One page, rebuilt on every release: recall and precision on the fixtures, mutation recall per check (from 0.5), timings serial and parallel, and the overrides most often logged across projects that share their telemetry. Numbers only, each linked to the run that produced it.

**A paper,** once 0.5 and 0.7 have shipped: the inspector measured by mutation across checks, states and engines, against the detection and repair work cited above.

## Notes

### Evaluated, not built: the action in Playwright's container image

Each self-test job spends 40 to 77 s installing the browsers' system packages with apt (`npx playwright install-deps`), whether or not the browser cache hits; the cache itself saves about 10 s of download (0.3.1 runs 43763528501 and 43763523575). [Playwright's Docker image](https://playwright.dev/docs/docker) includes the browsers and their system packages, so a job run in it would skip the install, the cache and the apt step. Against it: a composite action cannot choose its job's container; the image's tag must match the Playwright version in `package-lock.json`; pulling it costs time on every job; it runs as root by default, which turns off Chromium's sandbox; and its fonts differ from the runner's, which would move line breaks and the fixture baseline. To decide: one self-test run in the image, compared with the runs above on job time, recall, precision and the baseline.

---

This file is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), attribution Atishay Pahadiya.
