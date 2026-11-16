# Scaling underline and halo focus

A pattern is one good implementation, decoded from a real site. It is opt-in: a project uses it only when its brief asks for it, with its own values. It is never a default look.

## The pattern

A text link whose underline grows with its text, and whose keyboard focus is a two-layer ring that follows the link's rounded corners and survives forced-colours mode.

- **Underline.** `text-decoration-thickness: max(1.5px, 0.03em)` and `text-underline-offset: max(4px, 0.12em)`. At 64 px the underline is 1.92 px thick and sits 7.68 px below the baseline. At 16 px the px floors apply: 1.5 px thick, 4 px below.
- **Focus.** `box-shadow: 0 0 0 2px <light>, 0 0 0 4px <ink>`: a light ring against the link, then an ink ring outside it, so one of the two contrasts with any background. A box shadow follows `border-radius`. `outline: 2px solid transparent` sits underneath it: invisible normally, drawn in a system colour in forced-colours mode, where the box shadow is removed.
- **Hover and focus-visible give the same feedback.** Both show the underline. Pointer and keyboard users see the same thing.
- **Padding keeps the ring off the letters.** Inline padding of 0.5rem holds the ring clear of the first and last glyphs.

## Why it works

- A fixed 1 px underline is too thin at display sizes and crowds the descenders. A thickness and offset in `em` keep the proportion at every size. The `max()` floors keep both legible at small sizes, where `0.03em` alone would be under a pixel.
- The light ring and the ink ring together contrast with light and dark backgrounds, so the ring needs no per-background colour.
- Forced-colours mode replaces the page's colours with the user's system colours. It sets `box-shadow` to `none`, but it keeps the outline and forces its colour ([CSS Color Adjustment Module Level 1, 3.1](https://www.w3.org/TR/css-color-adjust-1/#forced-colors-properties)). A transparent outline therefore becomes a visible ring in exactly the mode where the box shadow disappears.

## CSS

```css
/* The project sets these from its own system. */
:root {
  --link-halo-light: /* the project's light surface */;
  --link-halo-ink: /* the project's ink */;
  --link-radius: /* a radius from the system */;
}

.link {
  color: inherit;
  text-decoration-line: none;
  text-decoration-thickness: max(1.5px, 0.03em);
  text-underline-offset: max(4px, 0.12em);
  padding-inline: 0.5rem;
  border-radius: var(--link-radius);
  outline: 2px solid transparent; /* drawn only in forced-colours mode */
  outline-offset: 2px;
}

.link:hover,
.link:focus-visible {
  text-decoration-line: underline;
}

.link:focus-visible {
  box-shadow: 0 0 0 2px var(--link-halo-light), 0 0 0 4px var(--link-halo-ink);
}
```

Do not remove the outline on focus (`outline: none`). The transparent outline is what forced-colours mode draws.

## Provenance

- Site: https://america.gov/
- Element: the large text links (64 px: "How it works", "Privacy", "About", "Releases", "Frequently asked questions", and the "Submit feedback" button), and at 16 px the "General Services Administration" link, where the px floors apply.
- Decoded: 16 November 2026, from the computed styles in Chromium in the default, hover, focus-visible and forced-colours states.

## Known bugs in the original

- **No focus ring in forced-colours mode.** Each of these links removes its outline on focus (`outline: none` on `:focus-visible`) and draws the ring only with a box shadow. With forced colours on, the box shadow becomes `none` and nothing marks the focused link. The same holds for other focusable elements on the page that use the same ring, such as "Skip to main content" and "Menu". The transparent outline above fixes it.

## Rule and floor

- **Craft rule** (enforced): underline thickness and offset scale with the font size, with px floors: `max(1.5px, 0.03em)` and `max(4px, 0.12em)`.
- **Floor** (enforced, never overridable): keyboard focus is visible on any background and in forced-colours mode. INT-10 (`reference/ux/01-interaction-and-targets.md`): a visible focus indicator at 3 : 1 against its surroundings (WCAG 2.2 SC 2.4.7 and 1.4.11).

## Checks

- The underline scaling: a new check, planned for 0.6 (`ROADMAP.md`).
- Focus in forced colours: a new check, planned for 0.8 (`ROADMAP.md`).

Neither is enforced by the inspector yet.
