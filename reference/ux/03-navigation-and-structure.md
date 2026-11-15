# UX · Navigation and structure

### NAV-01 · Follow platform conventions for common actions
Strength: MUST · Evidence: platform

Use the platform's standard components and placements for navigation, search, sharing, settings, back and close. Never reinvent a common action.

*Why:* people transfer their expectations from every other app they use. A reinvented control has to be learned from scratch [S1][S2][S19].

### NAV-02 · Things that look alike behave alike
Strength: MUST · Evidence: platform

Once an element has an appearance and a behaviour, keep both everywhere. Never give the same icon or style two different behaviours. A trash icon means delete, and only delete.

*Why:* consistency lets people predict what something does before they try it [S1][S2].

### NAV-03 · Wayfinding: location, destinations and the way back are always visible
Strength: MUST · Evidence: platform

Every screen shows where the person is (a title or selected tab), what the main destinations are, and how to go back. Keep navigation in the same position on every screen.

*Why:* these are the three questions any wayfinding system must answer [S12][S1].

### NAV-04 · Never trap people in a flow
Strength: MUST · Evidence: platform

Make onboarding, tutorials and guided flows skippable or escapable at every step. Never force a person through a fixed path to reach the main experience.

*Why:* agency means people can move through the interface at their own pace [S1][S2].

### NAV-05 · Disclose progressively
Strength: SHOULD · Evidence: platform

Show the common options first, and put advanced options one clear step away, in a disclosure, a "More" item or a settings screen. Never hide the primary path.

*Why:* progressive disclosure manages complexity without removing capability. Hiding the main path, however, is minimalism without simplicity [S12][S2].

### NAV-06 · Reduce choices at decision points
Strength: SHOULD · Evidence: research

Where people must choose, present the fewest options that serve the purpose. Highlight a recommended default, and group long lists into categories.

*Why:* Hick's law: decision time grows with the number of options [S19].

### NAV-07 · Keep hierarchy shallow and names concrete
Strength: SHOULD · Evidence: craft

Prefer broad, shallow structures to deep ones. Name destinations after what people will find there, not after internal team or product names.

*Why:* every level of depth is another recall step and another chance to get lost. Apple's WWDC26 naming session sets three criteria for a name: it belongs in the app, sets the right expectation, and works everywhere it appears [S24].

### NAV-08 · Preserve context across changes
Strength: MUST · Evidence: platform

When the window resizes, the device rotates or the person returns to the app, restore their scroll position, selection and unsaved input, and keep primary items in the same relative positions.

*Why:* losing your place counts as losing work [S1][S3].

### NAV-09 · Respect the platform's strengths
Strength: SHOULD · Evidence: platform

Design phone experiences for quick, interruptible, one-handed tasks. Design desktop experiences for depth, precision and keyboard workflows. Design television experiences for distance and focus navigation. Never port one platform's layout unchanged to another.

*Why:* each device is used in a different context and with different input [S2][S1].

### NAV-10 · Let people personalise when no single layout fits everyone
Strength: MAY · Evidence: platform

Where usage varies widely, let people rearrange, hide or pin controls.

*Why:* personalisation is one of the flexibility tools Apple names [S2].
