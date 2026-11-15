# UX · Writing

Interface text is interface. These rules paraphrase and extend Apple's writing guidance [S9].

### WRT-01 · Define a voice; vary the tone
Strength: SHOULD · Evidence: platform

Write down the product's voice (who it speaks to, its vocabulary, the feeling from DEC-02) and a glossary of preferred terms. Keep the voice constant and adjust the tone to the moment: plain and direct for warnings and failures, warmer for achievements.

*Why:* a consistent voice makes the product feel like one thing. A tone matched to the situation shows respect for what the person is going through [S9].

### WRT-02 · Use the fewest exact words
Strength: MUST · Evidence: platform

Cut every word that does not change the meaning. Prefer plain words to jargon, and say each thing once.

*Why:* the simplest phrasing is usually the most universal and the most helpful [S1][S9].

### WRT-03 · Label actions with verbs
Strength: MUST · Evidence: platform

Buttons and links state what they do ("Send", "Save draft", "Learn about pricing"). Never use "Click here", and never trade clarity for cleverness ("Let's do it!").

*Why:* people scan labels to decide whether to act, and screen-reader users often navigate by link and button text alone [S9].

### WRT-04 · One capitalisation style per element type
Strength: MUST · Evidence: platform

Choose title case or sentence case for each kind of element (buttons, headings, alerts, menu items) and apply it everywhere. Title case reads more formal; sentence case reads more conversational.

*Why:* mixed capitalisation reads as carelessness [S9].

### WRT-05 · Name multi-step flows consistently
Strength: SHOULD · Evidence: platform

Start a flow with a clear beginning ("Get Started"). Use one consistent forward verb throughout ("Continue" or "Next", never both). End with an explicit "Done".

*Why:* consistent language tells people where they are in a sequence [S9].

### WRT-06 · Avoid "we", and use possessives sparingly
Strength: SHOULD · Evidence: platform

"Favorites" works as well as "Your Favorites". Never write "we" in system messages: "Unable to load content" is clearer than "We're having trouble loading this content".

*Why:* in an error, it is unclear who "we" refers to, and possessives add length without adding meaning [S9].

### WRT-07 · Describe gestures for the device
Strength: MUST · Evidence: platform

Write "tap" on touch devices and "click" for pointer input. Keep every instruction accurate for the device the person is actually using.

*Why:* wrong verbs signal that the product was not made for that device [S9].

### WRT-08 · Settings describe the "on" state
Strength: SHOULD · Evidence: platform

Label settings by what they control. Where a label is not enough, add a description of what happens when the setting is on; people infer the off state. When pointing someone to a setting, link directly to it rather than describing its location.

*Why:* this halves the text and removes a navigation task [S9].

### WRT-09 · Field hints show the expected format
Strength: SHOULD · Evidence: platform

Give every text field a visible label, plus hint text showing the format ("name@example.com"). Write errors as instructions ("Use only letters for your name"), never as prohibitions or codes ("Invalid name").

*Why:* instructions lead people to a fix, while prohibitions only scold [S9].

### WRT-10 · Write for everyone, and for translation
Strength: MUST · Evidence: platform

Use plain, inclusive and gender-neutral language. Never build sentences by concatenating fragments. Leave room for text to expand in translation, since translated strings often run considerably longer than English ones.

*Why:* plain language serves non-native readers and people with cognitive disabilities, and it translates cleanly [S9].

### WRT-11 · Name things for what people will find
Strength: SHOULD · Evidence: platform

Feature and label names must belong in the app, set the right expectation, and work everywhere the name appears, from menus and settings to voice and search.

*Why:* these are the three criteria from Apple's WWDC26 naming session [S24].
