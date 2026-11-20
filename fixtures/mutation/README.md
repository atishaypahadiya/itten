# Mutation testing

`scripts/mutation-test.js` plants defects at random in a clean page and counts how many the inspector catches, per
check. The page is made of slots: one small piece of markup and one CSS rule each, every value from
`fixtures/itten.system.json`. A mutant is one slot with one defect: which value, which side, and at which widths it
shows (everywhere, below 500 px, or from 1200 px) are drawn from a seeded generator, so a seed names a run.

```sh
node scripts/mutation-test.js                       # seed 1, one mutant per operator: what the check runs
node scripts/mutation-test.js --pages 50 --slots 4  # 200 mutants per operator
node scripts/mutation-test.js --fix                 # also: the fixable classes, through itten fix
node scripts/mutation-test.js --keep                # missed mutants are also written to missed/ here
```

| Operator | Check that must catch it | What is planted | `itten fix` class |
|---|---|---|---|
| `spacing-off-scale` | `spacing-scale` | A padding or margin 1 to 3 px off a step | `to-step`, when one step is within 1 px |
| `spacing-in-px` | `spacing-unit` | A step of the scale, set in px | `px-to-rem` |
| `size-off-scale` | `type-scale` | A font size off the scale, some fractional | `to-step`, when one step is within 1 px and it keeps the slot's line height |
| `size-in-px` | `text-resize` | A step of the type scale, set in px | `px-to-rem` |
| `radius-off-set` | `radius` | A radius not in the set | none |
| `low-contrast` | `contrast` | A grey under 4.5:1 on the light ground | none |
| `clipped-box` | `clipping` | A fixed height shorter than its two lines, with `overflow: hidden` | none |
| `wide-box` | `overflow` | A minimum width wider than a 320 px page | none |
| `animated-layout` | `motion-layout` | An animation of width, height or margin | none |
| `motion-unguarded` | `reduced-motion` | An animation whose rule for Reduce Motion is taken away | `reduced-motion` |
| `small-target` | `target-size` | A button under 24 px | none |
| `separator-line-start` | `line-start` | An ordinary space before a separator, in a box as wide as its first item | `nbsp-separator` |

A mutant is caught when a finding of its operator's check names an element inside its slot. A finding outside every
mutated slot is a false positive and fails the run. A finding of another check inside a mutated slot is a side
finding, listed apart.

Two controls keep a recall of 1.00 from meaning nothing: the same page with no mutation must report nothing, and
the `identity` operator, which changes nothing, must be reported as missed.

A missed mutant is written to `<out>/missed/`, one folder each: the page with that mutant alone, its stylesheet, and
`mutant.json` with what was planted. With `--keep` it is also written to `missed/` here, where it either becomes a
fixture a later release catches, or stays with the reason it is out of scope. Serve a missed page beside
`fixtures/fix/base.css` and the text font, as `scripts/fix-test.js` does. None is kept at present.

`floors.json` holds the lowest recall allowed per check; a run below a floor fails. Each floor is the check's recall
in the first full run, rounded down to 0.05, and is raised only when a release catches more.

## Runs

| Date | Seed | Mutants per check | Result |
|---|---|---|---|
| 19 November 2026 | 100 | 200 | 2,330 of 2,400. All 70 misses were `line-start`: a separator beginning a line in a box narrower than 4 em, which the line checks skipped. |
| 19 November 2026, after `line-start` reads narrow blocks | 100 | 200 | 2,400 of 2,400; every check 1.00. No finding outside a mutated slot. |

The fixer, on three pages of four slots per operator (seed 100, `--fix`):

| Fix class | First run | After the fixer's changes |
|---|---|---|
| `nbsp-separator` | 12 of 12 | 12 of 12 |
| `px-to-rem` | 19 of 24 | 24 of 24 |
| `reduced-motion` | 0 of 12 | 12 of 12 |
| `to-step` | 6 of 11 | 9 of 9 |

What the first run found. `px-to-rem`: a finding names the sides of all its elements together, and an element that set
only one side in px made the whole fix guided; a side holding another value is now left. `to-step`: a finding's
elements can take the value at different widths (a rule in a media query), and the fixer read the page at one; it now
reads each width the finding was seen at. `reduced-motion`: the mutant itself was wrong, an `!important` rule no
guard could override; it is now a slot whose guard is taken away. Two `to-step` mutants (13 px) are no longer
classed as fixable: moved to 14 px they hold a line height off that step, and `itten fix` reverts, as it should.

Side findings in the second run, 357: a small button's label overflows it (`overflow`, 200), and `near-miss-edge`
or `spacing-scale` beside a mutated value (157). They are consequences of the planted defect, in its slot.
