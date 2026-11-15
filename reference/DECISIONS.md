# 0 · Decide before you draw

A layout, a palette and a type scale are answers. This file defines the questions. Answer every question in writing before producing any visual, and keep the answers with the work. When a later choice contradicts an answer, change the answer explicitly or change the choice. Never let them drift apart silently.

Apple's first principle states the same requirement: design starts with intention, and every feature costs people time, attention and trust, so deciding what not to build matters as much as deciding what to build [S1][S2].

## The brief

### DEC-01 · State the purpose in one sentence
Strength: MUST · Evidence: platform

Write who the work is for and the single job it does for them. If the sentence needs "and", there are two jobs; rank them.

*Why:* every later decision (what to show first, what to cut, what to emphasise) is ranked against this sentence. Without it, choices are ranked against personal preference, and the result is decoration [S1].

### DEC-02 · Name the one feeling
Strength: SHOULD · Evidence: platform

Choose the single emotion the work should leave behind, for example *calm*, *confident*, *urgent* or *celebratory*. Name one, not a list.

*Why:* Apple treats delight as the result of identifying the intended emotion and reinforcing it throughout, not as ornament added at the end [S1][S2]. One feeling gives colour, type and motion a common target.

### DEC-03 · Rank the content
Strength: MUST · Evidence: platform

List every piece of content and every control, then order the list by importance to the purpose in DEC-01. Remove anything that does not serve the purpose.

*Why:* simplicity means every element earns its place, and hierarchy means the most important item is the most obvious one [S1][S2]. Hierarchy cannot be drawn until it has been decided.

### DEC-04 · Choose one hero
Strength: SHOULD · Evidence: taste

Exactly one element dominates each screen or composition: one image, one headline or one action. Everything else supports it at visibly lower prominence (smaller, quieter, fewer).

*Why:* a composition with several competing dominant elements has no entry point. Rank 1 in DEC-03 is the hero, and the hero is rendered as the hero.

### DEC-05 · Record the constraints
Strength: MUST · Evidence: standard

Record the platforms, input methods (touch, pointer, keyboard, voice, gaze), contexts of use (moving, outdoors, shared screen) and the accessibility target (at minimum WCAG 2.2 AA).

*Why:* minimum sizes, contrast and motion limits in this repository depend on these answers [S6][S13].

### DEC-06 · List the conventions you will reuse and the ones you will break
Strength: SHOULD · Evidence: platform

For each convention you break, write the reason and the benefit that outweighs the cost of unfamiliarity.

*Why:* people bring knowledge of the physical world and of other software to every interface. Breaking a convention spends that knowledge, so it needs a return [S1][S2][S12].

### DEC-07 · Define how you will know it works
Strength: SHOULD · Evidence: craft

Write a test that could fail: a task a person must complete, a time limit, a comprehension question, or a measurable error rate.

*Why:* a design that cannot fail a test cannot be improved by testing. Apple's craft principle calls for prototyping early and testing in real settings [S1].

## During the work

### DEC-08 · Log every deviation from a SHOULD rule
Strength: SHOULD · Evidence: craft

When the work breaks a SHOULD rule from this repository, record the rule ID, what was done instead and why, in a decision log kept with the project.

*Why:* a deviation with a reason is a design decision. A deviation without one is a defect that has not yet been noticed.

### DEC-09 · Re-read the brief before each review
Strength: SHOULD · Evidence: craft

At each review, check the work against DEC-01 to DEC-04 before checking it against any visual rule.

*Why:* visual rules can all pass while the purpose fails. That is the failure this file exists to prevent.

## Template

```markdown
# Brief: <project>
Purpose (DEC-01):
Feeling (DEC-02):
Ranked content (DEC-03):
  1.
  2.
  Removed:
Hero (DEC-04):
Constraints (DEC-05): platforms / inputs / contexts / accessibility target
Conventions kept / broken + reason (DEC-06):
Success test (DEC-07):

## Decision log (DEC-08)
| Date | Rule | Deviation | Reason |
```
