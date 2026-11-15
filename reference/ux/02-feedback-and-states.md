# UX · Feedback and states

## Response time

### FBK-01 · Respond within 0.1 s; acknowledge within 1 s
Strength: MUST · Evidence: research

| Delay | What people experience | Required response |
|---|---|---|
| ≤ 0.1 s | Their action caused the change directly | Show the result; nothing else needed |
| ≤ 1 s | A noticeable pause, but their train of thought holds | No spinner; keep the flow |
| 1–10 s | Waiting on the machine | Show progress or activity |
| > 10 s | Attention wanders to other things | Show progress with an estimate; allow cancelling; let people do other work |

Every input must produce a visible response (a pressed state, a highlight, a haptic) within 0.1 s, even when the result takes longer.

*Why:* Nielsen's three limits, based on perception research going back to 1968 [S18]. The often-cited ~400 ms "Doherty threshold" (Doherty & Thadani, IBM, 1982) points the same way: productivity rises when the system responds faster than the person does [S19].

### FBK-02 · Feedback answers four questions
Strength: SHOULD · Evidence: platform

Over the course of an interaction, people should be able to tell:
1. what they can do;
2. what just happened;
3. what is happening now;
4. what will happen next.

*Why:* this is Apple's working definition of good feedback [S12][S1].

### FBK-03 · Show progress honestly
Strength: SHOULD · Evidence: craft

Use a determinate progress indicator when the total is known and an indeterminate one only when it is not. Never fake progress that stalls at 99%. For content loads, prefer placeholders shaped like the coming content over a centred spinner.

*Why:* honest progress preserves trust and lets people decide whether to wait.

## States

### FBK-04 · Design every state, not only the full one
Strength: MUST · Evidence: craft

Every screen and component needs designed versions of:
- **empty** (first use, and no results);
- **loading**;
- **partial**;
- **full**;
- **error**;
- **offline**;
- **disabled**;
- **long content** (overflowing text, many items).

*Why:* the full state is the state seen least often during real use, and the others are where people get stuck.

### FBK-05 · Prefer undo to confirmation
Strength: SHOULD · Evidence: platform

For reversible actions, act immediately and offer undo. Reserve confirmation dialogs for actions that are destructive and hard to reverse, and name the consequence in the confirmation.

*Why:* forgiveness lets people explore freely, while constant confirmation trains them to click through dialogs without reading [S1][S2].

### FBK-06 · Interrupt only for consequential moments
Strength: MUST · Evidence: platform

Alerts and modal sheets interrupt. Use them only when someone is about to lose work or make a costly mistake, or when the system needs a decision that cannot wait. Never auto-dismiss content on a timer that people need time to read.

*Why:* interruptions spend attention. Timed dismissal fails people who read slowly or use assistive technology [S2][S6].

### FBK-07 · Errors: near the problem, without blame, with the fix
Strength: MUST · Evidence: platform

Show the error next to the field or element that caused it. State what to do, not what went wrong in system terms. For example, "Choose a password with at least 8 characters", not "Invalid password". Never blame the person, and skip interjections like "Oops".

*Why:* an error message is useful only if it leads to a fix [S9].

### FBK-08 · Empty states give a next step
Strength: SHOULD · Evidence: platform

Every empty state explains what belongs there and offers the action that fills it. Never put information people need only in an empty state, because empty states disappear.

*Why:* a blank screen with no obvious next step stalls people [S9].

### FBK-09 · Pair sound with haptics and visuals
Strength: SHOULD · Evidence: platform

Any meaning carried by a sound (success, error, alert) must also be carried visually and, where available, by a matching haptic.

*Why:* many people use devices muted, and some cannot hear [S6].
