# UX · Interaction and targets

## Target size

### INT-01 · Default 44 × 44 pt touch targets
Strength: MUST · Evidence: platform

| Platform | Default control | Absolute minimum |
|---|---|---|
| iOS, iPadOS | 44 × 44 pt | 28 × 28 pt |
| macOS | 28 × 28 pt | 20 × 20 pt |
| tvOS | 66 × 66 pt | 56 × 56 pt |
| visionOS | 60 × 60 pt | 28 × 28 pt |
| watchOS | 44 × 44 pt | 28 × 28 pt |

The tappable area may be larger than the visible element. Extend the hit area rather than enlarging the artwork [S3][S6]. Tokens: `target.*`.

### INT-02 · On the web, never below 24 × 24 CSS px; aim for 44
Strength: MUST · Evidence: standard

Pointer targets must be at least 24 × 24 CSS px. A smaller target passes only if a 24 px circle centred on it does not overlap another target or that target's circle, or if one of WCAG's other exceptions applies: inline text links, equivalent controls, unmodified browser controls, or essential sizing such as map pins. 44 × 44 px meets the stricter AAA criterion.

*Why:* WCAG 2.2 SC 2.5.8 (AA) and SC 2.5.5 (AAA) [S14]. Material Design uses 48 × 48 dp [S20].

### INT-03 · Spacing between targets matters as much as their size
Strength: SHOULD · Evidence: platform

Leave about **12 pt** of padding around controls that have a visible bezel or background, and about **24 pt** around borderless controls, measured from the visible edges.

*Why:* tapping the wrong neighbour is as costly as missing the target [S6].

### INT-04 · Size and place targets by frequency and importance
Strength: SHOULD · Evidence: research

Frequent and important actions get larger targets, placed close to where the hand or pointer already is. Destructive actions get distance from frequent ones.

*Why:* Fitts's law: the time to reach a target grows with distance and falls with size [S19].

## Input

### INT-05 · Use the simplest gesture for common actions
Strength: MUST · Evidence: platform

Use tap, swipe and drag for frequent actions. Avoid custom multi-finger or multi-hand gestures, and never override system gestures.

*Why:* complex gestures exclude people with limited dexterity and are hard to remember [S6].

### INT-06 · Every gesture has a visible alternative
Strength: MUST · Evidence: platform

Any action reachable by a gesture (swipe to delete, pinch, long press) must also be reachable by a visible control.

*Why:* gestures are invisible and hard to discover, and some people cannot perform them [S6].

### INT-07 · Support every input the platform offers
Strength: SHOULD · Evidence: platform

Make the full interface operable with touch, pointer, keyboard (including Full Keyboard Access), voice (Voice Control) and switch access. Do not override system keyboard shortcuts.

*Why:* people choose the input that works for their body and context [S1][S6].

### INT-08 · Make affordances visible
Strength: SHOULD · Evidence: platform

Interactive elements must look interactive at rest, through shape, colour role (COL-05), a container or a chevron, and not only on hover.

*Why:* touch screens have no hover state, so an affordance that appears only on hover is invisible to touch users [S12].

### INT-09 · Map controls to their effects
Strength: SHOULD · Evidence: research

Place each control near what it affects. Arrange controls in the same spatial order as their effects, and make the direction of a control's motion match the direction of the change.

*Why:* natural mapping removes the need to learn the relationship between control and effect [S12].

## Focus and pointer

### INT-10 · Show focus clearly
Strength: MUST · Evidence: standard

Every focusable element shows a visible focus indicator with at least 3 : 1 contrast against its surroundings. Focus is never hidden behind sticky headers or overlays.

*Why:* keyboard and switch users have no other way to know where they are. WCAG 2.2 requires visible focus (SC 2.4.7), focus not obscured (SC 2.4.11) and 3 : 1 for non-text indicators (SC 1.4.11) [S13].

### INT-11 · On television, show focus with scale and motion, not colour alone
Strength: MUST · Evidence: platform · Applies to: tvOS

Indicate focus through subtle scaling and responsive motion, and leave room for focused items to grow without colliding with neighbours.

*Why:* at living-room viewing distances, a colour change alone is too weak to show focus [S5][S3].
