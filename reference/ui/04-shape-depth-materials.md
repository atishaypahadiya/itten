# UI · Shape, depth and materials

## Shape

### SHP-01 · Nest rounded corners concentrically
Strength: MUST · Evidence: craft

When a rounded shape sits inside another, its radius must equal the outer radius minus the gap between them:

```
inner_radius = max(0, outer_radius − padding)
outer_radius = inner_radius + padding
```

When horizontal and vertical padding differ, use the larger padding, which gives the smaller inner radius. Never give a nested element the same radius as its container.

*Why:* concentric corners share a centre point, so the band between the two shapes keeps a constant width. Equal radii make the band pinch at the corners and bulge along the sides [S21]. Apple builds its 2025 visual system on concentricity between hardware, window and control, and SwiftUI computes concentric radii directly [S10][S21].

### SHP-02 · Use a small, closed set of radii
Strength: SHOULD · Evidence: craft

Define three or four corner radii (for example small, medium, large and full/capsule) and derive nested radii from SHP-01. Never pick radii by eye per component.

*Why:* radii that are almost but not quite equal read as inconsistency. At WWDC26, Apple moved every macOS window to the same, tighter corner radius for consistency across apps [S10]. Tokens: `radius.*`.

### SHP-03 · Shape follows function
Strength: SHOULD · Evidence: platform

Use capsules and circles for discrete controls a finger presses, rounded rectangles for containers, and sharp corners for content edges such as photos and tables that run to the bounds.

*Why:* in the Liquid Glass system, control shapes reflect the geometry of a fingertip, and containers follow the curvature of the device [S10].

## Layers and materials

### SHP-04 · Two layers: content below, controls above
Strength: MUST · Evidence: platform

Treat the interface as two layers. Content fills the lower layer. Navigation and controls (tab bars, toolbars, sidebars, menus) float in a functional layer above it. Do not put the floating control material (Liquid Glass on Apple platforms) in the content layer: not on list rows, cards or app backgrounds. Exception: transient controls such as sliders and toggles may take on the material while being manipulated.

*Why:* the distinction between the two layers is the visual hierarchy. Glass inside the content blurs which elements are interface and which are content [S8].

### SHP-05 · Never stack glass on glass; use it sparingly
Strength: SHOULD · Evidence: platform

Apply the floating material only to the most important custom controls, and do not layer one translucent control over another.

*Why:* the material draws attention to the content beneath it. Overuse turns attention to the interface itself [S8].

### SHP-06 · Choose the material variant by what lies beneath
Strength: MUST · Evidence: platform

Use the **regular** variant by default and for anything with a significant amount of text: alerts, sidebars, popovers. Use the **clear** variant only over visually rich media such as photos and video. Over bright media, add a dark dimming layer of about 35% opacity. Over dark media, or with standard media controls that provide their own dimming, no dimming layer is needed.

*Why:* the regular variant blurs and adjusts the luminosity of the background to protect legibility; the clear variant does not [S8]. Token: `material.clearDimOpacity`.

### SHP-07 · Pick materials by meaning, not by the colour they produce
Strength: SHOULD · Evidence: platform

Use thicker, more opaque materials where text and fine detail must stay legible, and thinner, more translucent materials where people need to keep their sense of what lies behind. Place system vibrant label colours on materials. Avoid the lowest-contrast (quaternary) label level on thin materials.

*Why:* system settings change how materials render, so a material chosen for its tint will drift [S8].

### SHP-08 · Shadows describe height, consistently
Strength: SHOULD · Evidence: craft

If an interface uses shadows, assume one light source and derive every shadow from a small set of elevation levels. Higher elements get larger, softer and more offset shadows. Never mix light directions.

*Why:* shadows are read as physical height. Inconsistent shadows describe an impossible scene.

### SHP-09 · Prefer translucency to opaque panels in spatial interfaces
Strength: SHOULD · Evidence: platform · Applies to: visionOS

Use the system glass for windows rather than opaque fills.

*Why:* opaque areas block the view of the room and can make people feel confined [S8].

## Icons and imagery

### SHP-10 · Icons match the weight and size of adjacent text
Strength: SHOULD · Evidence: platform

Size and weight interface icons to the text they sit beside, and scale meaningful icons with the text size (system symbol sets do this automatically).

*Why:* an icon heavier or lighter than its label breaks the line's visual rhythm, and a fixed-size icon becomes unreadable at large text sizes [S4].

### SHP-11 · Keep image aspect ratios; crop rather than distort
Strength: MUST · Evidence: platform

Scale artwork uniformly to fill its frame, accepting some cropping. Never stretch an image along one axis.

*Why:* distortion is immediately visible and reads as a defect [S3].
