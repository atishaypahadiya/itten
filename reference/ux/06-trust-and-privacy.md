# UX · Trust, privacy and safety

These rules apply Apple's Responsibility principle: act in people's best interest, treat privacy as a human right, and anticipate harm [S1][S2].

### TRU-01 · Ask for permission in context, with a reason
Strength: MUST · Evidence: platform

Request each permission (location, camera, contacts, notifications) at the moment the person uses a feature that needs it, and explain why first. Never request permissions at launch.

*Why:* a request with no context is like a stranger asking for a phone number without saying why [S2].

### TRU-02 · Collect only what the product needs
Strength: MUST · Evidence: platform

Every piece of collected data must map to a feature the person uses. State plainly what is collected and how it is used.

*Why:* data that is never collected cannot leak or be misused [S1].

### TRU-03 · Anticipate misuse and harm
Strength: MUST · Evidence: platform

For every feature, list who could be harmed and how, then design protections such as limits, reporting, defaults and friction. Remove the feature if the risk outweighs its value.

*Why:* responsibility includes the consequences people did not intend [S1][S2].

### TRU-04 · Treat generated output as fallible
Strength: MUST · Evidence: platform · Applies to: AI and generative features

Wherever a model's output can be wrong:
- show a preview before acting on it;
- require confirmation before consequential actions;
- label it as generated where that matters;
- never let it override safety-critical facts the person has provided. A logged allergy, for example, must constrain any suggested recipe.

*Why:* inaccurate or unexpected output is foreseeable, so its consequences must be designed for [S2].

### TRU-05 · No dark patterns
Strength: MUST · Evidence: platform

Never:
- pre-select consent;
- disguise advertising as content;
- hide cancellation;
- use confirm-shaming ("No, I don't like saving money");
- create false urgency;
- make the option the business prefers visually louder than the one the person asked for.

*Why:* manipulative patterns trade long-term trust for short-term metrics, and they contradict acting in people's best interest [S1].

### TRU-06 · Make destructive and irreversible actions unmistakable
Strength: MUST · Evidence: platform

Style destructive actions with the destructive colour role and an explicit verb ("Delete 12 photos"), keep them physically apart from frequent actions (INT-04), and use FBK-05 to decide between undo and confirmation.

*Why:* recovery from a mistake must not cost people their time or their work [S1].
