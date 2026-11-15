# UI · Motion

## Purpose

### MOT-01 · Every animation must carry information
Strength: MUST · Evidence: platform

Animate only to show where something came from or went to, what changed, what is in progress, or what responded to an action. Remove motion that does none of these.

*Why:* gratuitous motion distracts people and can make them physically uncomfortable [S7].

### MOT-02 · Motion is never the only channel
Strength: MUST · Evidence: platform

Anything communicated through motion must also be available as a state change, text, haptic or sound.

*Why:* some people turn motion off, and some cannot perceive it [S7][S6].

### MOT-03 · Motion follows the gesture
Strength: MUST · Evidence: platform

An element revealed by a downward slide is dismissed by an upward slide, not a sideways one. During direct manipulation, the element tracks the finger exactly; animation takes over only after release.

*Why:* motion that contradicts the gesture breaks the mental model of where the element lives [S7].

### MOT-04 · Animations are interruptible
Strength: MUST · Evidence: platform

Never make people wait for an animation to finish before they can act, especially for animations they will see repeatedly. A new input must redirect the motion from its current position and velocity.

*Why:* blocking animations turn polish into latency [S7]. Springs preserve velocity when retargeted, which is one reason Apple made them the default [S11].

### MOT-05 · Keep frequent interactions nearly still
Strength: SHOULD · Evidence: platform

Avoid custom animation on interactions people repeat many times a session. Keep feedback for these brief and precise.

*Why:* an animation that is pleasant once becomes a tax on the hundredth repetition [S7].

## Timing

### MOT-06 · Use springs, described by duration and bounce
Strength: SHOULD · Evidence: platform

Describe motion with a spring defined by two parameters: perceived duration and bounce.

| Bounce | Character | Use for |
|---|---|---|
| 0 | Smooth, no overshoot | The default for most transitions |
| about 0.15 | A slight overshoot, barely felt as bounce | Responsive micro-interactions |
| about 0.3 | Clearly bouncy | Playful moments; momentum carried from a gesture |

Apple's examples use durations of about 0.4–0.6 s for full transitions. Prefer bounce 0 unless the motion continues a physical gesture.

*Why:* Apple switched its frameworks to this two-parameter spring model, and its own default animation is a spring. Bounce around 0.15 barely reads as bouncy, while around 0.3 it clearly does [S11]. Tokens: `motion.spring.*`.

### MOT-07 · Distance and size set duration
Strength: SHOULD · Evidence: craft

Small elements moving short distances get shorter durations. Full-screen transitions get longer ones. Never apply one duration to everything.

*Why:* constant duration makes small moves feel sluggish and large moves feel abrupt.

## Comfort and accessibility

### MOT-08 · Honour Reduce Motion
Strength: MUST · Evidence: platform

When the system Reduce Motion setting is on:
- reduce automatic and repeating animation;
- tighten springs to remove bounce;
- track gestures directly;
- replace movement along the x, y and z axes with fades;
- stop animating depth changes and blur transitions.

*Why:* fast, blinking and large-scale motion causes dizziness, nausea and, in rare cases, seizures [S6].

### MOT-09 · Respect Dim Flashing Lights and avoid flashing content
Strength: MUST · Evidence: standard

Video playback must respond to the system Dim Flashing Lights setting. Never author interface content that flashes more than three times in any one-second period.

*Why:* flashing content can trigger seizures (WCAG 2.2 SC 2.3.1) [S6][S13].

### MOT-10 · In spatial interfaces, keep peripheral motion calm
Strength: MUST · Evidence: platform · Applies to: visionOS

- Avoid motion at the edge of the field of view.
- Never rotate the virtual world.
- Fade objects out and back in to relocate them, rather than flying them.
- Give people a stationary frame of reference.
- Avoid sustained oscillation, especially around 0.2 Hz.

*Why:* in a headset, motion is read as self-motion and can cause discomfort [S7].

### MOT-11 · Hold frame rate steady
Strength: SHOULD · Evidence: platform

Target a constant frame rate. In games, 30 to 60 fps typically reads as smooth.

*Why:* dropped frames read as jitter, which Apple names as a mark of rushed work [S7][S2].
