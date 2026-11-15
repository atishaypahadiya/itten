# UX · Accessibility

Accessibility rules appear throughout this repository (TYP-01, TYP-03, COL-01 to COL-04, MOT-08, INT-01 to INT-10). This file gathers the rest. Apple asks for interfaces that are **intuitive, perceivable and adaptable** [S6]; WCAG 2.2 AA is the binding floor [S13].

## Vision

### ACC-01 · Every element has an accessible name, role and value
Strength: MUST · Evidence: standard

Every control and every meaningful image exposes a concise label to screen readers (VoiceOver on Apple platforms), along with its role (button, toggle, heading) and current value or state. Decorative images are hidden from assistive technology.

*Why:* without a name, a screen-reader user hears only "button" [S6][S13].

### ACC-02 · Reading order matches visual order
Strength: MUST · Evidence: standard

The order in which assistive technology reaches elements follows the visual hierarchy from DEC-03, and headings are marked as headings.

*Why:* screen-reader users navigate by sequence and by headings [S13].

## Hearing

### ACC-03 · Provide text for all media
Strength: MUST · Evidence: standard

- Video with speech gets captions.
- Long audio and podcasts get transcripts.
- Information shown only visually in video gets audio description.
- Captions must be restyleable by the viewer.

*Why:* information delivered only through sound excludes people who cannot hear it [S6].

## Mobility and speech

### ACC-04 · The whole interface works with a keyboard and with switch access
Strength: MUST · Evidence: standard

Every function is operable from a keyboard (Full Keyboard Access) and from Switch Control, in a logical order and with no keyboard traps.

*Why:* many people cannot use a pointer or touch [S6][S13].

### ACC-05 · Labels work for Voice Control
Strength: SHOULD · Evidence: platform

The visible label of a control must match, or be contained in, its accessible name, so people can say what they see.

*Why:* Voice Control users activate controls by speaking their visible names [S6].

## Cognition

### ACC-06 · No time limits people did not choose
Strength: MUST · Evidence: standard

Avoid timed dismissal and session timeouts. Where a limit is unavoidable, warn people beforehand and let them extend it.

*Why:* people who process information more slowly, and people using assistive technology, need more time [S6][S13].

### ACC-07 · No autoplay without control
Strength: MUST · Evidence: platform

Audio and video never autoplay without visible stop and pause controls. Respect the system setting that disables autoplay.

*Why:* unexpected motion and sound disorient people and compete with screen readers [S6].

### ACC-08 · Support simplified modes
Strength: SHOULD · Evidence: platform

When a simplified mode such as Assistive Access is on:
- reduce the app to its core tasks;
- put one interaction on each screen;
- ask twice before any action that is hard to undo.

*Why:* reduced complexity helps people with cognitive disabilities [S6].

## Process

### ACC-09 · Test with the assistive technology itself
Strength: MUST · Evidence: platform

Before release, use the product with:
- the screen reader;
- the largest text size;
- Increase Contrast;
- Reduce Motion;
- Reduce Transparency;
- keyboard only.

Run the platform's accessibility inspector, and publish an honest statement of what is supported (on the App Store, the Accessibility Nutrition Labels).

*Why:* automated checks find only some issues. The rest appear only when the product is actually used this way [S6].
