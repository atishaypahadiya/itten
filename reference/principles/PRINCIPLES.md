# 1 · Principles

Principles decide between options when rules disagree or run out. They are not checklist items. Apple presents its own as tools for weighing competing priorities, with no fixed formula for combining them, and notes that leaning into one can appear to cost another [S1][S2].

## The eight principles (Apple, June 2026)

Apple reintroduced a principles page in the HIG on 8 June 2026, alongside the WWDC26 session *Principles of great design* [S1][S2]. The summaries below are paraphrased. The **In practice** lines show how this repository applies each principle.

### PRI-01 · Purpose: make something meaningful
Begin from what matters most to the people the work serves, and make those things excellent. Ask at every stage what the product is for and whether the design serves that. Investigate existing solutions before re-creating them.
**In practice:** [DECISIONS.md](../DECISIONS.md), DEC-01 and DEC-03.

### PRI-02 · Agency: let people do things their own way
Get people to their task directly, avoid locking them into fixed flows or modes, make guided flows easy to skip, and make mistakes cheap to undo. Interrupt only when someone is about to do something costly.
**In practice:** NAV-04, FBK-05, FBK-06.

### PRI-03 · Responsibility: act in people's best interest
Be transparent about what the product does and why. Collect only the data the product needs. Ask for permission in context, with a reason. Anticipate misuse and harm. This applies especially to features whose output may be wrong, such as generated content. Remove a feature when its risks outweigh its value.
**In practice:** [ux/06-trust-and-privacy.md](../ux/06-trust-and-privacy.md).

### PRI-04 · Familiarity: build on what people know
Use metaphors that are neither too literal nor too abstract, follow established conventions for common actions, and keep behaviour consistent: things that look the same must work the same.
**In practice:** NAV-01, NAV-02, DEC-06.

### PRI-05 · Flexibility: adapt to diverse contexts and needs
Design for people of every ability, age, language and skill level. Support many input methods. Keep content and controls in predictable positions as layouts adapt. Give each platform the same level of care.
**In practice:** [ux/05-accessibility.md](../ux/05-accessibility.md), LAY-03.

### PRI-06 · Simplicity: be clear and direct
Simplicity is not minimalism: hiding functionality makes an interface look minimal without making it simple. Include what is necessary, say it in the fewest exact words, and build hierarchy through order, spacing and contrast. Sometimes simplicity means adding context, not removing it.
**In practice:** DEC-03, DEC-04, TYP-07, [ux/04-writing.md](../ux/04-writing.md).

### PRI-07 · Craft: care about every detail
Quality is visible in timing, alignment, wording and sound. Rushed software shows up as delayed responses, jittery scrolling, misaligned icons and layouts that break on rotation. Prototype early, discard what fails, and keep the work current after release.
**In practice:** [ui/](../ui/), FBK-01, MOT-04.

### PRI-08 · Delight: make it human
Delight is the sum of getting the other seven right. It is not confetti added at the end. Identify the intended emotion and let it shape the design, without letting it obstruct the task.
**In practice:** DEC-02.

## Visual principles of the Liquid Glass era (2025–)

With Liquid Glass (WWDC25; refined at WWDC26), Apple framed its visual system around three ideas [S10]:

- **Hierarchy.** Controls and navigation form a distinct functional layer above the content, and content is what the eye goes to.
- **Harmony.** Shapes align with the concentric geometry of the hardware and the software (see SHP-01).
- **Consistency.** Adopt platform conventions so that the design adapts across window sizes and displays.

## The working vocabulary (Apple, 2017)

The WWDC17 session *Essential Design Principles* named twelve working concepts [S12], drawing on the vocabulary of Norman's *The Design of Everyday Things*. They remain the most useful words for critique:

| Concept | Test question |
|---|---|
| Wayfinding | Can people tell where they are, where they can go, and how to get back? |
| Feedback | Does every action produce a timely, understandable response? |
| Visibility | Are the key controls and status visible, without everything competing for attention? |
| Consistency | Do similar things look and behave alike, inside the product and with the platform? |
| Mental model | Does the interface match how people believe the system works? |
| Proximity | Are related items placed near one another? |
| Grouping | Do containers, spacing and alignment show which items belong together? |
| Mapping | Does each control's position and motion match its effect? |
| Affordance | Can people tell what an element can do just by looking at it? |
| Progressive disclosure | Are advanced options available without cluttering the common path? |
| 80/20 rule | Is design effort concentrated on the small set of features used most? |
| Symmetry | Does balance support the content, and does any asymmetry have a purpose? |

## When principles conflict

The 2017 session also notes that principles conflict, can be overapplied, and vary in relevance [S12]. Resolve conflicts in this order:

1. **Safety and access** (PRI-03, PRI-05). These are never traded for appearance.
2. **The purpose in DEC-01.** The principle that serves it more directly wins.
3. **Familiarity over novelty** (PRI-04), unless DEC-06 records why breaking the convention is worth the cost.
4. **Record the conflict and its resolution** in the decision log (DEC-08).
