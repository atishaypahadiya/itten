# Roadmap

The order in which ITTEN grows after 0.1, what each version covers, and the test it has to pass before it ships. A version ships when its acceptance test passes and the fixture test still reports full recall, full precision and no findings on the clean twins. Scope can move between versions; the order of the first three is fixed, because each one feeds the next.

Status, 16 November 2026: 0.2 has shipped as 0.2.0. 0.3 is built as 0.3.0, with fixes in 0.3.1, 0.3.2 and 0.3.3, and waits on the part of its acceptance test that needs a real pull request (see `CHANGELOG.md`). 0.4 is next.

## 0.2 · Typographic finish and motion

**Status.** Shipped in 0.2.0. Every check has a planted defect and a clean twin; the fixture test reports recall 43/43 and precision 49/49 at the default widths and the full sweep. Both families ran on the two baselines, and each finding is recorded there with its verdict; four false positives found there became fixture cases. Beyond the scope below, the motion pass also tabs, clicks and repeats everything with the CPU slowed 4×.

**Scope.** Two families of inspector checks for what 0.1 leaves to the eye.

Typography, measured on the rendered lines:

- widows: a paragraph whose last line holds one word;
- orphans: a paragraph split across columns or printed pages with one line left behind;
- rag: the spread of line lengths in ragged text, against the measure;
- headings that would break more evenly with `text-wrap: balance`, by laying them out both ways and comparing;
- paragraphs that `text-wrap: pretty` would improve, compared the same way;
- narrow justified text without hyphenation, where word spaces stretch;
- hanging punctuation, where the system declares it;
- optical alignment of large display type: round and pointed letters at the left edge, measured from the glyph pixels rather than the text box.

Motion, read through the Web Animations API, CSS transition events and `requestAnimationFrame` timing:

- each animation's duration and easing against `motion` in the system;
- animations that still run under `prefers-reduced-motion: reduce`;
- animations of layout properties (width, height, top, left, margin) instead of transform and opacity;
- dropped frames while scrolling and during transitions, as a frame-time histogram;
- anything that flashes more than three times a second (WCAG 2.3.1).

**Acceptance test.** Each check has at least one planted defect in `fixtures/` and a clean twin, and the fixture test reports full recall and precision at the default widths and the full sweep. Both families have been run on the two baselines in `research/baselines/`, and every finding there has been checked against a crop and either confirmed or turned into a fixture.

**Prior art.** Seenomaly lints GUI animations against design guidelines from screencasts, with a learned model ([Zhao et al., ICSE 2020](https://2020.icse-conferences.org/details/icse-2020-papers/32/Seenomaly-Vision-Based-Linting-of-GUI-Animation-Effects-Against-Design-Don-t-Guideli)); ITTEN reads the animations the browser exposes and measures them against the project's own system instead. Line-breaking quality follows the measures behind TeX ([Knuth and Plass, "Breaking Paragraphs into Lines", Software: Practice and Experience 11(11), 1981](https://doi.org/10.1002/spe.4380111102)), and `balance` and `pretty` are defined in [CSS Text Module Level 4](https://www.w3.org/TR/css-text-4/). The flash threshold is [WCAG 2.2 SC 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html).

## 0.3 · On every pull request, and what overrides say

**Status.** Built in 0.3.0; 0.3.1 is released. The action, the baseline and the comment logic pass their tests locally, including the comment against a stand-in for the GitHub API: one comment, edited on later runs, and none for forks or read-only tokens. Run on the fixtures, the action reproduces the fixture test (0.3.3: recall 49/49, precision 57/57, nothing on the clean twins). On GitHub, the self-test passed on Linux on the 0.3.0 pull request, and the comment was edited in place on later pushes; after the merge it missed d41 on two runs, since a fixed 4× CPU slowdown left the runner faster than a phone, which 0.3.1 fixes by slowing the CPU to a reference device. 0.3.1 also saves the browser cache when a run fails, which no run on main had done. The aggregation script flags CRF-16 and nothing else on eight test repositories kept as folders in `fixtures/telemetry/`, rejects the one whose file does not validate, and leaves out the fork. Still to do on GitHub: the pull request half of the acceptance test below (a planted defect named in the comment, a clean comment once it is removed, artifacts that open with matching crops), a pull request from a fork, and the first scheduled telemetry run. One change from the plan: the overrides record lives at the project's root as `itten.overrides.json`, with `docs/itten-overrides.md` rendered from it.

**Scope.**

- A GitHub Action that runs the inspector on every pull request against the project's system file, posts one comment with the summary by check and severity and the top findings, and uploads the report and crops as workflow artifacts.
- Override telemetry. Each project keeps its overrides in a structured file (`docs/itten-overrides.json` beside the prose log, validated by a schema), naming the rule or check, the value, the reason and whether floors still hold. A script reads that file from a list of repositories and reports each rule overridden in three or more projects, since a rule that many projects set aside is a rule to rewrite.

**Acceptance test.** On a test repository, a pull request that adds a planted defect gets a comment naming it, and one that removes it gets a clean comment; the artifacts open and the crops match. The aggregation script, run on three or more test repositories that share an override, flags that rule and no other, and it rejects an overrides file that does not validate.

**Prior art.** [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) runs Lighthouse on every commit and reports on pull requests; this action does the same for the inspector's findings, with crops in place of scores.

### Evaluated, not built: the action in Playwright's container image

Each self-test job spends 40 to 77 s installing the browsers' system packages with apt (`npx playwright install-deps`), whether or not the browser cache hits; the cache itself saves about 10 s of download (0.3.1 runs 43763528501 and 43763523575). [Playwright's Docker image](https://playwright.dev/docs/docker) includes the browsers and their system packages, so a job run in it (`container: mcr.microsoft.com/playwright:v1.65.1-noble`) would skip the install, the cache and the apt step. What stands in the way, and what to measure first:

- A composite action cannot choose its job's container; the calling workflow sets `container:`. The action would detect browsers already installed and skip its install steps, and the README would show the container as an option. The self-test workflow can use it directly.
- The image's tag must match the Playwright version in `package-lock.json`, or the browser executables are missing; every Playwright upgrade becomes two changes kept in step.
- Pulling the image costs time on every job, as the apt step does now. Whether it is shorter than 40 to 77 s has to be measured on GitHub's runners before switching.
- The image runs as root by default, which turns off Chromium's sandbox; the documentation recommends another user for untrusted pages, and `--ipc=host` for Chromium. Pages a project inspects are its own, but the self-test should run as a user.
- The image's fonts differ from the runner's. Fallback fonts, and so line breaks, could change, and the fixture baseline and the clean twins' tied words would have to be checked again on it.

To decide: one self-test run in the image, compared with the runs above on job time, and on recall, precision and the baseline.


## 0.4 · A second opinion from pixels

**Scope.** Checks that work from screenshots alone, for what the DOM cannot see or reports wrongly:

- text over WebGL, video and images, judged on the composited frame;
- text clipped by masks, `clip-path` or nested overflow that computed styles do not reveal;
- broken images, and images drawn larger than their natural size;
- text recognised in the screenshot compared with the DOM text, to find text the DOM does not expose (canvas, pseudo-elements) and DOM text that never paints.

**Acceptance test.** Each check has planted fixtures that the DOM checks miss and the pixel check catches, and the fixture test stays at full recall and precision. On the baselines, pixel findings that overlap DOM findings agree with them.

**Prior art.** OwlEye finds display issues such as overlapping text and missing images in screenshots with a trained model ([Liu et al., ASE 2020](https://arxiv.org/abs/2009.01417)). Screen Recognition infers interface elements from pixels to create accessibility metadata ([Zhang et al., CHI 2021](https://arxiv.org/abs/2101.04893)). UIED detects interface elements by combining classical vision with deep learning ([Xie et al., ESEC/FSE 2020](https://research.monash.edu/en/publications/uied-a-hybrid-tool-for-gui-element-detection/)). Seenomaly works from screencasts for the same reason: some faults only show in the frames ([ICSE 2020](https://2020.icse-conferences.org/details/icse-2020-papers/32/Seenomaly-Vision-Based-Linting-of-GUI-Animation-Effects-Against-Design-Don-t-Guideli)).

## 0.5 · Teardown from images

**Scope.** Most inspiration arrives as an image, not a URL. 0.5 measures a reference image the way `protocol/01-teardown.md` measures a live page, in two paths:

- interface references: type size ratios, the spacing base unit, and the alignment lines the layout uses;
- photographic references: colour proportions by area, composition, and texture.

It is a Python subpackage managed with uv, and it runs on macOS, Linux and Windows.

The interface path is evaluated without hand labels. Known pages are rendered and screenshotted; the teardown sees only the image; its measurements are scored against what the inspector measures on the same page, which is the ground truth.

**Acceptance test.** On a held-out set of rendered pages, the interface path recovers the type ratio and the spacing base unit within stated tolerances on a stated share of pages, and the alignment lines with stated precision and recall. The photographic path reproduces the colour proportions of synthetic images whose proportions are known. The package installs and passes its tests on all three platforms in CI.

**Prior art.** UIED ([Xie et al., ESEC/FSE 2020](https://research.monash.edu/en/publications/uied-a-hybrid-tool-for-gui-element-detection/)) and Screen Recognition ([Zhang et al., CHI 2021](https://arxiv.org/abs/2101.04893)) detect elements from pixels, which the interface path builds on. Design2Code scores generated pages against references by visual element matching, text, position and colour ([Si et al., 2024](https://arxiv.org/abs/2403.03163)); 0.5 reverses the direction, scoring measurements taken from the image against measurements of the page.

## 0.6 · Inspiration against build

**Scope.** Compare a teardown spec (from a page in 0.1, or from an image in 0.5) with the inspector's measurements of the build, and report the deltas: type ratios, spacing base and ratios, radii, colour proportions, and structure, such as the number of columns, the alignment lines and the order of groups.

**Acceptance test.** A build made to a teardown on purpose reports deltas within tolerance; the same build with planted drifts (a changed type ratio, a different spacing base, a missing alignment line) reports each drift and nothing else.

**Prior art.** Design2Code measures how closely a generated page matches its reference design, by matched elements, text, position and colour ([Si et al., 2024](https://arxiv.org/abs/2403.03163)). 0.6 compares the systems behind the two rather than the pixels, so a build can match its inspiration's proportions at a different size or with different content.

---

This file is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), attribution Atishay Pahadiya.
