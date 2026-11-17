# Design Principles

A reference set of design rules for user interfaces and user experience, with the reasoning and evidence behind each rule.

The set is built on Apple's Human Interface Guidelines (HIG) as revised through June 2026, and extended with accessibility standards (WCAG 2.2), perceptual research and established typographic practice. Every rule carries an identifier, a strength and an evidence level, so it can be cited in a review, checked by a tool, or overridden on purpose.

## How the set is organised

The order of the files is the order of work.

| Step | File | Question it answers |
|---|---|---|
| 0 | [DECISIONS.md](DECISIONS.md) | What is this for, and what matters most? |
| 1 | [principles/PRINCIPLES.md](principles/PRINCIPLES.md) | Which values decide between competing options? |
| 2 | [ui/](ui/) | How should it look: layout, type, colour, shape, motion? |
| 3 | [ux/](ux/) | How should it behave: interaction, feedback, structure, words, access, trust? |
| 4 | [tokens/tokens.json](tokens/tokens.json) | Which values are fixed numbers a tool can check? |
| 5 | [checklists/review.md](checklists/review.md) | Does the finished work pass? |

Step 0 comes first deliberately. Rules for spacing and type produce correct but empty work when nothing has been decided about purpose, hierarchy and feeling. The rules in steps 2 to 5 constrain a decision; they do not replace one.

## Rule format

```
### TYP-04 · Body line length 45–90 characters
Strength: SHOULD · Evidence: craft · Applies to: long-form text
<rule> 
<why>
Sources: [S17]
```

**Strength** follows RFC 2119: **MUST** (violations are defects), **SHOULD** (deviate only with a recorded reason), **MAY** (an option worth considering).

**Evidence** states what kind of authority stands behind a rule. The vocabulary is shared by ITTEN, KERCKHOFFS and ERLANG, so a level means the same in every specialist's rules and findings; each specialist uses the levels that apply to it.

| Level | Meaning | Changes when |
|---|---|---|
| `standard` | A normative requirement from a standards body (an RFC, a W3C recommendation). | A new version of the standard is published. |
| `platform` | The documented behaviour or convention of a platform, runtime or product, from its maker (Node.js, PostgreSQL, a browser, Apple's HIG). | The maker revises it. |
| `research` | A peer-reviewed empirical finding. | New evidence contradicts it. |
| `theory` | A theorem or analytic model. Holds exactly where its assumptions hold, and only approximately elsewhere. | Never, though its fit to a given service can be wrong. |
| `practice` | An industry write-up by a named organisation or author who ran the systems in question, including worked examples and simulations published with it. | The practice changes. |
| `craft` | Consensus or this repository's judgment, with no single documented source. | Practice changes. |
| `taste` | A stated preference of this repository's owner. | The owner changes their mind. |
| `observed` | Measured by the set's own tools, on its fixtures or the owner's services, with the run cited. | A later run measures otherwise. |

ITTEN's rules use `standard` (WCAG 2.2), `platform` (chiefly Apple's HIG, revised each June), `research` (perception and HCI studies), `craft` and `taste`. A rule's level was set before the vocabulary was shared and is unchanged by it.

Rule identifiers are stable. A retired rule keeps its number and is marked retired.

## Scope and exclusions

The set covers screen interfaces on phones, tablets, computers, televisions, watches and headsets, with Apple platforms as the reference. Values given for one platform do not transfer to another without checking that platform's own guidance.

Three commonly repeated "rules" are deliberately excluded:

- **The golden ratio as a layout rule.** None of the sources used here support it as a usability or legibility requirement.
- **"Seven plus or minus two" as a limit on menu items.** The original finding concerns short-term memory span. It does not set a limit on items visible on screen, where recognition replaces recall.
- **The 8-point grid as an Apple rule.** Apple's guidance specifies system margins, safe areas and minimum sizes. It does not define a base spacing unit. A 4-point scale is adopted here as craft practice (see LAY-05), not as Apple policy.

## Sources

Every citation `[Sn]` resolves in [SOURCES.md](SOURCES.md). Apple's guidance is paraphrased, not reproduced. Consult the original pages for the full text, illustrations and current values.

This project is independent and is not affiliated with or endorsed by Apple Inc. Apple, the Apple logo, Liquid Glass, SF Pro and Dynamic Type are trademarks of Apple Inc.

## Related work

[ehmo/platform-design-skills](https://github.com/ehmo/platform-design-skills) [S22] packages several hundred rules from the HIG, Material Design 3 and WCAG 2.2 for coding agents. This repository differs in three ways: it places a decision protocol before any visual rule, it grades every rule by evidence level, and it states the reasoning behind each value instead of only the value.

## Licence

Text and tokens: [CC BY 4.0](LICENSE). Attribution: Atishay Pahadiya.
