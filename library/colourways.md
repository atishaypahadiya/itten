# Colourways

Use only when a project's brief asks for it. The contrast figures below were computed against a cream ground (#FFF9E7) and a warm night ground that ITTEN no longer ships. A project that uses a pair must recompute every figure against its own grounds.

The colours in this note come in pairs that fashion houses actually put together: in a runway look, a museum-held garment or a house signature. Nine pairs are kept. Each was sampled from a photograph of the named source, converted to OKLCH, given a proportion by Itten's contrast of extension, and then given a functional variant whose text pairs pass WCAG 2.2 AA. Every colour value here is an estimate from a photograph, not the house's own colour. Lighting, white balance, the camera and JPEG compression all shift it.

## Method

**Sources.** Each pair traces to a house, designer, collection, season and, where it could be verified, a look number. Museum records (V&A) were preferred because they identify the object exactly. Runway pairs come from Vogue Runway galleries, with the review text quoted where it names the colours. Where a look number could not be confirmed against a running order, the entry says so.

**Sampling.** For each colour a flat, evenly lit region of the photograph was cropped and its median pixel taken (Python, Pillow). The crop box and image are recorded in the basis column below so the sample can be repeated. Medians resist highlights and shadow better than means, but a dark garment in stage light still samples dark: the Celine oxblood and the Jil Sander violet read lighter in person.

**OKLCH.** Hex samples are converted to OKLCH with Björn Ottosson's matrices (`scripts/lib/colour.js`). All nine pairs sit inside sRGB, so no gamut mapping was needed.

**Proportion.** Itten's contrast of extension sets the area of each colour in inverse ratio to its light value, using Goethe's values: yellow 9, orange 8, red 6, green 6, blue 4, violet 3 (Itten, *The Art of Color*, 1961). ITTEN places those six values at the OKLCH hues of #FF0000, #FF8000, #FFFF00, #00FF00, #0000FF and #8000FF and interpolates between them by hue angle. A pair with values a and b gets shares b/(a+b) and a/(a+b). Goethe's values are for saturated hues. The shares are a starting point and hold best for the saturated pairs (Jil Sander, Gucci, Hermès). They say little about near-blacks such as the Schiaparelli aubergine or the Celine oxblood, where lightness, not hue, does most of the work. The share is the share of the coloured area. Neutrals take whatever is left.

**Display and functional modes.** Display mode is the pair as estimated, for posters, hero moments and large type; it may fail contrast on purpose. Functional mode keeps each colour's hue and moves its lightness, in steps of 0.0025 L, until:

- A text and B text reach 4.5:1 and APCA Lc 60 against both the ground and the surface, in light (cream) and dark (night);
- a fill keeps the display colour where possible. The text on it (ink or cream, whichever needs the smaller change) reaches 4.5:1 and Lc 60;
- the Increase Contrast variants (COL-07) reach 7:1 and Lc 75.

Lc 60 is APCA's level for readable text other than body copy (COL-03). Colourway text is for links, labels and emphasis, not running text, which stays in ink on cream (16.6:1) or cream on night (17.7:1).

**Dropped.** Valentino, 1984 (V&A T.501:1,2-2000), cherry wool crepe with black velvet. It was sourced and sampled, but its second colour is black (C 0.009), which has no hue and so no Goethe value. It is also the least surprising pair in the set. It is listed under alternatives below.

## Where each pair fails

Display mode, WCAG 2.2 contrast of the colours as estimated. "Large" means 3:1 to 4.5:1, enough for text from 24 px (or 18.7 px bold) only. Night is the dark-mode ground.

| Colourway | B on A | A on cream | B on cream | A on night | B on night |
|---|---|---|---|---|---|
| Hermès, house signature | 3.2 large | 3.7 large | 11.8 pass | 4.8 pass | 1.5 fail |
| Jil Sander, Spring 2011 | 7.6 pass | 15.8 pass | 2.1 fail | 1.1 fail | 8.5 pass |
| Schiaparelli, Circus, 1938 | 10.9 pass | 1.7 fail | 18.4 pass | 10.5 pass | 1.0 fail |
| Marni, Fall 2025 | 1.5 fail | 2.3 fail | 3.4 large | 7.8 pass | 5.2 pass |
| Dries Van Noten, Fall 2024 | 1.0 fail | 2.4 fail | 2.3 fail | 7.5 pass | 7.8 pass |
| Jacquemus, Spring 2020 | 2.1 fail | 1.2 fail | 2.5 fail | 15.1 pass | 7.2 pass |
| Prada, Spring 2007 | 1.9 fail | 6.7 pass | 13.1 pass | 2.6 fail | 1.4 fail |
| Celine, Spring 2012 | 2.0 fail | 17.6 pass | 8.9 pass | 1.0 fail | 2.0 fail |
| Gucci, Fall 1995 | 4.4 large | 3.0 fail | 12.9 pass | 6.0 pass | 1.4 fail |

Night fails for most deep colours and cream fails for most pale ones, which is expected. Only Jil Sander and Schiaparelli pass AA in both directions between A and B, so only they can set text in one colour on the other at body size. Gucci and Hermès manage large text only.

## Hermès, house signature: box orange and bolduc brown

Warm citrus orange tied with chocolate brown; a gift waiting to be opened.

- House: Hermès.
- Collection: Packaging. Season: From the 1940s.
- Look: Orange box tied with brown Bolduc ribbon.
- Sources:
  - https://www.hermes.cn/cn/en/faq/products/orange-boxes/ — "Most items ordered are delivered in an orange box tied with our Bolduc ribbon."
  - https://www.nssmag.com/en/fashion/22580/hermes-packaging-orange — "Emile-Maurice added a brown ribbon and a horse-drawn eye logo to the box."
  - https://www.thefashionlaw.com/a-shortage-of-product-packaging-during-wwii-led-hermes-to-adopt-a-new-hue-the-result-was-the-birth-of-a-color-mark/ — "a vibrant orange, 'the color nobody wanted.'"
  - https://commons.wikimedia.org/wiki/File:Hermesbox.jpg — "Hermes Paris box"
- Confidence: high that the pair is a house signature; medium for hex.

| | Colour | OKLCH (estimated) | Hex | Basis |
|---|---|---|---|---|
| A | Box orange | oklch(61.7% 0.151 44.7) | #CD622C | sampled from image (median of crop box 480,600,640,760 in Wikimedia Commons Hermesbox.jpg at 1280x960, no profile; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. Outdoor daylight photo; across the image the orange ranges #C8561C to #D57249. |
| B | Bolduc brown | oklch(33.0% 0.031 12.6) | #442F31 | sampled from image (median of crop box 185,655,205,690 in Wikimedia Commons Hermesbox.jpg; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. |
| Neutral | Off-white ribbon lettering and stitching | oklch(95.4% 0.008 73.8) | #F3EFEA | estimated: sampled lettering is clipped to near-white (#FFFBFF); value lowered by judgement to a warm off-white |
| Neutral | Cream | oklch(91.8% 0.038 86.9) | #EFE3C8 | estimated from description ('originally the packs of Hermès were cream colour', nss magazine); no image sampled |

**Proportion.** Goethe light values by hue: a 7.3, b 5.5; areas in inverse ratio. A takes 43% and B 57% of the coloured area.

**Display mode** (colours as estimated):

| Text on background | WCAG | APCA | Result |
|---|---|---|---|
| B on A | 3.17:1 | Lc 30 | large text only |
| A on B | 3.17:1 | Lc 29 | large text only |
| A on cream | 3.71:1 | Lc 62 | large text only |
| B on cream | 11.76:1 | Lc 95 | AA text |
| A on night | 4.78:1 | Lc 35 | AA text |
| B on night | 1.51:1 | Lc 0 | fail |

**Functional mode** (lightness adjusted, hue kept; checked against ground and surface):

| Pair | Light | Dark |
|---|---|---|
| A text on ground | #B64D10, 4.92:1, Lc 71 | #FF9B6D, 9.03:1, Lc 62 |
| B text on ground | #442F31, 11.76:1, Lc 95 | #C8AEB0, 9.01:1, Lc 61 |
| Text on A fill | #FFF9E7 on #BD531A, 4.52:1, Lc 74 | same fill in dark |
| Text on B fill | #FFF9E7 on #442F31, 11.76:1, Lc 98 | same fill in dark |

**Notes.** Hermès does not publish an official hex/Pantone for the box (The Fashion Law says the colour is not listed with Pantone); the sampled values are estimates only. The Commons photo appears to show a large printed box surface (possibly a display or hoarding) rather than a hand-held box, so scale and finish may differ from a real carton. Logo on the box is printed in the same dark brown as the ribbon.

## Jil Sander, Spring 2011: violet and fluoro orange

Loud and clean: a dark cool violet against a hot orange, with nothing in between.

- House: Jil Sander. Designer: Raf Simons.
- Collection: Spring 2011 ready-to-wear. Season: Spring/Summer 2011.
- Look: Look 41: violet blouson over a fluoro-orange gown.
- Sources:
  - https://www.vogue.com/fashion-shows/spring-2011-ready-to-wear/jil-sander/slideshow/collection#41
  - https://www.vogue.com/fashion-shows/spring-2011-ready-to-wear/jil-sander — "The violet blouson over the gown in fluoro orange?"
  - https://anothermag.com/fashion-beauty/10359/when-raf-simons-brought-colour-volume-to-jil-sander-ss11 — "Haute couture shapes in neon-bright nylon and polyester blends"
- Confidence: high.

| | Colour | OKLCH (estimated) | Hex | Basis |
|---|---|---|---|---|
| A | Violet | oklch(25.0% 0.107 298.9) | #2A0E4C | sampled: median pixel of crop 200,240,250,300 (also checked 430,260,480,320 -> #2A0C4C) in look 41 (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; the photo renders the violet darker than it reads on the runway |
| B | Fluoro orange | oklch(76.5% 0.156 60.3) | #F9983A | sampled: median pixel of crop 320,450,400,600 in look 41 (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; fluorescent dye exceeds sRGB, so the true colour is more saturated than any hex |
| Neutral | White T-shirt | oklch(93.5% 0.030 285.8) | #E7E7FD | sampled: median pixel of crop 270,200,400,320 in look 1 (same collection, not the same look) (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; blue cast from white balance, a neutral white is closer to #EDEDF0 |
| Neutral | Navy-black skirt | oklch(19.7% 0.010 276.5) | #14151A | sampled: median pixel of crop 260,620,400,850 in look 16 (same collection, not the same look) (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value |
| Neutral | Runway white | oklch(82.0% 0.007 88.7) | #C6C4BF | sampled: median pixel of crop 120,720,220,820 in look 41 (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; this is the set floor, not a garment |

**Proportion.** Goethe light values by hue: a 3.2, b 8.1; areas in inverse ratio. A takes 72% and B 28% of the coloured area.

**Display mode** (colours as estimated):

| Text on background | WCAG | APCA | Result |
|---|---|---|---|
| B on A | 7.57:1 | Lc 57 | AA text |
| A on B | 7.57:1 | Lc 58 | AA text |
| A on cream | 15.77:1 | Lc 100 | AA text |
| B on cream | 2.08:1 | Lc 39 | fail |
| A on night | 1.13:1 | Lc 0 | fail |
| B on night | 8.52:1 | Lc 59 | AA text |

**Functional mode** (lightness adjusted, hue kept; checked against ground and surface):

| Pair | Light | Dark |
|---|---|---|
| A text on ground | #2A0E4C, 15.77:1, Lc 100 | #C0A8F2, 9.00:1, Lc 61 |
| B text on ground | #A45B02, 4.90:1, Lc 71 | #FE9D40, 8.99:1, Lc 61 |
| Text on A fill | #FFF9E7 on #2A0E4C, 15.77:1, Lc 102 | same fill in dark |
| Text on B fill | #1D1914 on #FD9C3F, 8.33:1, Lc 61 | same fill in dark |

**Notes.** Look 41 has no neutral of its own, so neutrals come from looks 1 and 16 of the same show (the collection opened on white T-shirts) plus the white runway. Look number taken from gallery order and the 00410 filename; it was not cross-checked against an official running order. The violet sample is very dark because the shadowed folds dominate the crop.

## Schiaparelli, Circus, 1938: circus pink and aubergine

Soft sugared pink over a near-black plum; playful on top, grave underneath.

- House: Schiaparelli. Designer: Elsa Schiaparelli.
- Collection: Circus collection. Season: 1938.
- Look: Pink silk jacket over a purple evening dress, V&A T.395&A-1974.
- Sources:
  - https://collections.vam.ac.uk/item/O15665/ — "a bright pink, fitted jacket of silk twill with a repeating pattern of rearing horses ... and a purple evening dress"
- Confidence: high for attribution and colour names (V&A catalogue); medium for hex values.

| | Colour | OKLCH (estimated) | Hex | Basis |
|---|---|---|---|---|
| A | Circus pink | oklch(82.2% 0.064 1.1) | #E9B4C2 | sampled from image (median of crop box 560,450,600,500 in V&A image 2025PD4584, 900x1200, Adobe RGB; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. |
| B | Aubergine | oklch(16.6% 0.035 345.1) | #190812 | sampled from image (median of crop box 330,860,560,1000 in V&A image 2025PD4584, 900x1200, Adobe RGB; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. |
| Neutral | Acrobat button, pale metal | oklch(69.7% 0.046 37.7) | #B89489 | sampled from image (median of crop box 522,495,532,530 in V&A image 2025PD4584; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. Small region; picks up pink reflection. |
| Neutral | Ivory ground, Tears dress | oklch(76.1% 0.028 90.1) | #B8B19E | sampled from image (median of crop box 450,800,490,860 in V&A image 2025PF9470, Adobe RGB; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. Different object from the same collection. |

**Proportion.** Goethe light values by hue: a 5.1, b 4.6; areas in inverse ratio. A takes 47% and B 53% of the coloured area.

**Display mode** (colours as estimated):

| Text on background | WCAG | APCA | Result |
|---|---|---|---|
| B on A | 10.85:1 | Lc 70 | AA text |
| A on B | 10.85:1 | Lc 69 | AA text |
| A on cream | 1.70:1 | Lc 29 | fail |
| B on cream | 18.40:1 | Lc 102 | AA text |
| A on night | 10.47:1 | Lc 69 | AA text |
| B on night | 1.04:1 | Lc 0 | fail |

**Functional mode** (lightness adjusted, hue kept; checked against ground and surface):

| Pair | Light | Dark |
|---|---|---|
| A text on ground | #8F606E, 4.91:1, Lc 72 | #E9B4C2, 10.47:1, Lc 69 |
| B text on ground | #190812, 18.40:1, Lc 102 | #C8AEBB, 9.09:1, Lc 62 |
| Text on A fill | #1D1914 on #E9B4C2, 9.80:1, Lc 69 | same fill in dark |
| Text on B fill | #FFF9E7 on #190812, 18.40:1, Lc 104 | same fill in dark |

**Notes.** Pink varies across the jacket from #D297A1 (shade) to #F6C5CD (lit); #E9B4C2 is a mid-lit area. The jacket reads paler than the 'shocking' pink the house is known for, which may be fading or lighting; do not treat it as Shocking Pink. The dress photographs very dark; the V&A calls it purple. Alternate: 'Tears' dress (V&A O84418, Circus 1938, fabric by Dalí): V&A says pale blue ground with pink and magenta tears, but the photo reads ivory; magenta sampled #90194F at crop 245,295,280,330.

## Marni, Fall 2025: soft pink and ochre

Candy pink tailoring with a mustardy collar, grounded by plain browns.

- House: Marni. Designer: Francesco Risso.
- Collection: Fall 2025 ready-to-wear. Season: Autumn/Winter 2025.
- Look: Pink coat with an ochre velvet collar (look number not verified).
- Sources:
  - https://www.wmagazine.com/fashion/marni-fall-2025-milan-fashion-week-runway-photos — "a long coat in soft pink with an ochre collar"
- Confidence: medium: colours named in reputable press and visible in the image; look number unconfirmed.

| | Colour | OKLCH (estimated) | Hex | Basis |
|---|---|---|---|---|
| A | Soft pink | oklch(74.1% 0.099 12.5) | #E2919A | sampled from image (median of crop box 470,520,560,640 in W Magazine image marni_fw25_27.jpg at 1000x1500; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. Runway lighting. |
| B | Ochre | oklch(62.6% 0.113 72.8) | #B17C2F | sampled from image (median of crop box 495,404,560,414 in W Magazine image marni_fw25_27.jpg; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. Shaded lapel gives #B07F00; velvet pile shifts with angle. |
| Neutral | Camel | oklch(61.3% 0.073 71.5) | #A07D52 | sampled from image (median of crop box 440,250,470,280 in W Magazine image marni_fw25_27.jpg; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. |
| Neutral | Dark brown | oklch(25.4% 0.030 43.3) | #2F1E17 | sampled from image (median of crop box 440,1220,520,1320 in W Magazine image marni_fw25_27.jpg; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. |
| Neutral | Espresso leather | oklch(23.9% 0.014 41.6) | #251D1A | sampled from image (median of crop box 600,1050,700,1150 in W Magazine image marni_fw25_27.jpg; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. |

**Proportion.** Goethe light values by hue: a 5.5, b 8.3; areas in inverse ratio. A takes 60% and B 40% of the coloured area.

**Display mode** (colours as estimated):

| Text on background | WCAG | APCA | Result |
|---|---|---|---|
| B on A | 1.51:1 | Lc 14 | fail |
| A on B | 1.51:1 | Lc 16 | fail |
| A on cream | 2.28:1 | Lc 44 | fail |
| B on cream | 3.44:1 | Lc 60 | large text only |
| A on night | 7.78:1 | Lc 54 | AA text |
| B on night | 5.15:1 | Lc 37 | AA text |

**Functional mode** (lightness adjusted, hue kept; checked against ground and surface):

| Pair | Light | Dark |
|---|---|---|
| A text on ground | #A25761, 4.90:1, Lc 72 | #F09EA7, 9.03:1, Lc 61 |
| B text on ground | #966309, 4.88:1, Lc 72 | #E1AA5F, 8.99:1, Lc 61 |
| Text on A fill | #1D1914 on #EF9DA6, 8.36:1, Lc 61 | same fill in dark |
| Text on B fill | #FFF9E7 on #9C6814, 4.53:1, Lc 74 | same fill in dark |

**Notes.** W Magazine's text describes the coat but does not caption the image; the description was matched to image marni_fw25_27 by eye (it is the only pink coat with an ochre collar in the gallery). The '27' in the filename probably is the look number but is not confirmed. Vogue Runway could not be fetched from this environment.

## Dries Van Noten, Fall 2024: lavender and faded denim

Cool and soft: lavender satin with worn, washed-out denim and a black base.

- House: Dries Van Noten. Designer: Dries Van Noten.
- Collection: Fall 2024 ready-to-wear. Season: Autumn/Winter 2024.
- Look: Lavender silk duchesse top with faded jeans (Vogue Runway image 65; look number not verified).
- Sources:
  - https://www.vogue.com/fashion-shows/fall-2024-ready-to-wear/dries-van-noten/slideshow/collection#65
  - https://www.vogue.com/fashion-shows/fall-2024-ready-to-wear/dries-van-noten — "gray marl sweatshirt fabric with iridescent sequins, and lavender silk duchess with faded denim jeans."
  - https://theimpression.com/dries-van-noten-fall-2024-fashion-show-review — "muddy lilac and shocking cobalt combined with bubblegum pink"
- Confidence: high.

| | Colour | OKLCH (estimated) | Hex | Basis |
|---|---|---|---|---|
| A | Lavender | oklch(72.7% 0.101 290.2) | #A69CE2 | sampled: median pixel of crop 560,650,680,780 in gallery image 65 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; satin sheen gives a wide spread, highlights reach about #C9BFFB |
| B | Faded denim | oklch(73.0% 0.049 259.5) | #96A9C7 | sampled: median pixel of crop 630,1050,720,1200 (also 520,1100,620,1300 -> #95A8C5) in gallery image 65 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value |
| Neutral | Black shirt | oklch(18.2% 0.006 271.1) | #111215 | sampled: median pixel of crop 420,850,520,950 in gallery image 65 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value |
| Neutral | Pale concrete | oklch(75.0% 0.007 67.7) | #B1ADA9 | sampled: median pixel of crop 1000,1500,1150,1650 in gallery image 65 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; this is the show floor, not a garment |

**Proportion.** Goethe light values by hue: a 3.1, b 4.1; areas in inverse ratio. A takes 57% and B 43% of the coloured area.

**Display mode** (colours as estimated):

| Text on background | WCAG | APCA | Result |
|---|---|---|---|
| B on A | 1.04:1 | Lc 0 | fail |
| A on B | 1.04:1 | Lc 0 | fail |
| A on cream | 2.35:1 | Lc 45 | fail |
| B on cream | 2.27:1 | Lc 43 | fail |
| A on night | 7.53:1 | Lc 53 | AA text |
| B on night | 7.82:1 | Lc 54 | AA text |

**Functional mode** (lightness adjusted, hue kept; checked against ground and surface):

| Pair | Light | Dark |
|---|---|---|
| A text on ground | #7065A6, 4.87:1, Lc 72 | #B6ACF3, 9.05:1, Lc 61 |
| B text on ground | #5D6E8A, 4.91:1, Lc 72 | #A2B6D4, 9.05:1, Lc 61 |
| Text on A fill | #1D1914 on #B5ABF2, 8.38:1, Lc 61 | same fill in dark |
| Text on B fill | #1D1914 on #A2B5D3, 8.40:1, Lc 62 | same fill in dark |

**Notes.** The Vogue review names exactly this pairing (lavender silk duchesse with faded denim). Several looks in the show use it; image 65 is the clearest flat example. Image 69 (lavender jacket with a denim skirt) is a near-identical alternative. Only the look number is uncertain: the gallery includes two detail shots and a finale bow, so gallery position and look number differ.

## Jacquemus, Spring 2020: butter yellow and bright pink

Warm and light: pale yellow and bright pink in full summer sun.

- House: Jacquemus. Designer: Simon Porte Jacquemus.
- Collection: Le Coup de Soleil, Spring 2020. Season: Spring/Summer 2020.
- Look: Butter-yellow jacket with bright pink trousers (Vogue Runway image 11; look number not verified).
- Sources:
  - https://www.vogue.com/fashion-shows/spring-2020-ready-to-wear/jacquemus/slideshow/collection#11
  - https://www.vogue.com/fashion-shows/spring-2020-ready-to-wear/jacquemus — "I wanted it to look like a David Hockney painting or a Christo installation through the fields," he said. "With lots of prints."
  - https://www.harpersbazaararabia.com/fashion/fashion-runway/jacquemus-pink-catwalk-10th-anniversary-show-ss20
- Confidence: medium.

| | Colour | OKLCH (estimated) | Hex | Basis |
|---|---|---|---|---|
| A | Butter yellow | oklch(92.8% 0.059 89.0) | #F7E6BB | sampled: median pixel of crop 820,500,880,640 (also 810,420,870,520 -> #F7E6BB) in gallery image 11 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; outdoor daylight |
| B | Bright pink | oklch(73.2% 0.174 352.8) | #F874B2 | sampled: median pixel of crop 600,1050,700,1250 (also 720,1300,790,1500 -> #F780B3) in gallery image 11 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; the fuchsia runway reflects up into the trousers and may push the pink |
| Neutral | Straw | oklch(76.2% 0.083 70.3) | #D4A977 | sampled: median pixel of crop 600,100,660,130 in gallery image 11 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value |
| Neutral | Sheer nude | oklch(67.9% 0.064 45.7) | #BA8C77 | sampled: median pixel of crop 620,520,720,620 in gallery image 11 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; skin shows through the sheer fabric, so this mixes fabric and skin |

**Proportion.** Goethe light values by hue: a 8.6, b 4.9; areas in inverse ratio. A takes 36% and B 64% of the coloured area.

**Display mode** (colours as estimated):

| Text on background | WCAG | APCA | Result |
|---|---|---|---|
| B on A | 2.09:1 | Lc 36 | fail |
| A on B | 2.09:1 | Lc 40 | fail |
| A on cream | 1.17:1 | Lc 8 | fail |
| B on cream | 2.45:1 | Lc 46 | fail |
| A on night | 15.11:1 | Lc 92 | AA text |
| B on night | 7.23:1 | Lc 51 | AA text |

**Functional mode** (lightness adjusted, hue kept; checked against ground and surface):

| Pair | Light | Dark |
|---|---|---|
| A text on ground | #7B6C45, 4.90:1, Lc 72 | #F7E6BB, 15.11:1, Lc 92 |
| B text on ground | #BC3D7D, 4.87:1, Lc 71 | #FF91C2, 8.96:1, Lc 61 |
| Text on A fill | #1D1914 on #F7E6BB, 14.14:1, Lc 90 | same fill in dark |
| Text on B fill | #1D1914 on #FF91C2, 8.39:1, Lc 62 | same fill in dark |

**Notes.** No text source found describes this look's colours; the pairing rests on the runway photo. The review quote covers only the show's intent. The pink here is a mid-strength bubblegum, not red, but it is the closest this set comes to a 'pink' pair. A pastel alternative in the same show is gallery image 3 (pistachio jacket over a salmon-pink top, white skirt), which the researcher left out to avoid a third green in the set.

## Prada, Spring 2007: violet satin and oxblood

Cool blue-violet against a dark wine red; prim and slightly off.

- House: Prada. Designer: Miuccia Prada.
- Collection: Spring 2007 womenswear. Season: Spring/Summer 2007.
- Look: Purple satin top with a red wool skirt, V&A T.1:1 to 7-2009 (runway look number not verified).
- Sources:
  - https://collections.vam.ac.uk/item/O184734/ — "Ensemble, purple top, red skirt, leather sandals, purple hat, knitted pants, Prada, 2007, Italy."
- Confidence: high for attribution (V&A); medium-low for hex: record photos are informal shots with warm room light, not studio images.

| | Colour | OKLCH (estimated) | Hex | Basis |
|---|---|---|---|---|
| A | Violet satin | oklch(46.8% 0.116 278.5) | #4D519A | sampled from image (median of crop box 700,280,850,380 in V&A image 2012FV0902, 1200x900, no profile; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. |
| B | Oxblood | oklch(30.8% 0.085 10.9) | #521925 | sampled from image (median of crop box 560,420,620,520 in V&A image 2012FV0901, 1200x900, no profile; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. |
| Neutral | Charcoal knit | oklch(39.3% 0.008 255.5) | #43464A | sampled from image (median of crop box 500,350,700,550 in V&A image 2012FV0900; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. |
| Neutral | Black leather | oklch(17.2% 0.004 106.8) | #10100E | sampled from image (median of crop box 495,500,515,700 in V&A image 2012FV0899; embedded profile converted to sRGB where present). Lighting and white balance make this an estimate. Belt hangs against a dark stand; region may include the stand. |

**Proportion.** Goethe light values by hue: a 3.5, b 5.4; areas in inverse ratio. A takes 61% and B 39% of the coloured area.

**Display mode** (colours as estimated):

| Text on background | WCAG | APCA | Result |
|---|---|---|---|
| B on A | 1.94:1 | Lc 13 | fail |
| A on B | 1.94:1 | Lc 13 | fail |
| A on cream | 6.74:1 | Lc 81 | AA text |
| B on cream | 13.09:1 | Lc 96 | AA text |
| A on night | 2.63:1 | Lc 17 | fail |
| B on night | 1.36:1 | Lc 0 | fail |

**Functional mode** (lightness adjusted, hue kept; checked against ground and surface):

| Pair | Light | Dark |
|---|---|---|
| A text on ground | #4D519A, 6.74:1, Lc 81 | #A6AFFF, 9.07:1, Lc 62 |
| B text on ground | #521925, 13.09:1, Lc 96 | #E8A1AA, 8.99:1, Lc 61 |
| Text on A fill | #FFF9E7 on #4D519A, 6.74:1, Lc 85 | same fill in dark |
| Text on B fill | #FFF9E7 on #521925, 13.09:1, Lc 99 | same fill in dark |

**Notes.** The V&A calls the skirt 'red'; it photographs as a deep wine/oxblood. Skirt samples ranged #3F151A to #521925. The satin top's highlights and shadows vary a lot; #4D519A is a mid-tone. Alternate: Prada Autumn-Winter 2007 shaggy mohair top and skirt, V&A O1351245: 'Green and orange shaggy mohair top and skirt.' Green sampled #3B5C31 (crop 300,500,600,900, image 2023NJ4819); no V&A image of the orange skirt was available, so orange is unsampled.

## Celine, Spring 2012: oxblood and bottle green

Quiet and heavy: dark wine and forest green, like old leather in low light.

- House: Celine. Designer: Phoebe Philo.
- Collection: Spring 2012 ready-to-wear. Season: Spring/Summer 2012.
- Look: Look 14: patchwork leather top, oxblood suede and bottle-green leather panels.
- Sources:
  - https://www.vogue.com/fashion-shows/spring-2012-ready-to-wear/celine/slideshow/collection#14
  - https://www.anothermag.com/current/view/1813/Céline_SS12_Womenswear — "Philo's use of the technique involved combining autumnal shades of butter soft leather for a highneck top."
- Confidence: medium.

| | Colour | OKLCH (estimated) | Hex | Basis |
|---|---|---|---|---|
| A | Oxblood | oklch(19.8% 0.073 27.0) | #2F0303 | sampled: median pixel of crop 400,260,425,300 in look 14 (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; the stage is dark and the panel is underexposed, so on the garment it reads noticeably lighter and redder |
| B | Bottle green | oklch(39.0% 0.063 137.8) | #344D2B | sampled: median pixel of crop 275,365,305,420 in look 14 (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value |
| Neutral | Black leather | oklch(4.7% 0.022 328.4) | #010001 | sampled: median pixel of crop 285,280,320,330 in look 14 (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; shadows are crushed to black, highlights on the leather are specular |
| Neutral | Olive-khaki leather | oklch(46.5% 0.056 80.0) | #6A5634 | sampled: median pixel of crop 345,385,420,440 in look 14 (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; an earth tone that works as a neutral here |
| Neutral | White cotton skirt | oklch(99.6% 0.002 197.1) | #FCFEFE | sampled: median pixel of crop 270,500,300,600 in look 14 (Vogue Runway photo, 683px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; close to clipping, so the true off-white is not recoverable |

**Proportion.** Goethe light values by hue: a 5.9, b 6.4; areas in inverse ratio. A takes 52% and B 48% of the coloured area.

**Display mode** (colours as estimated):

| Text on background | WCAG | APCA | Result |
|---|---|---|---|
| B on A | 1.98:1 | Lc 10 | fail |
| A on B | 1.98:1 | Lc 11 | fail |
| A on cream | 17.58:1 | Lc 101 | AA text |
| B on cream | 8.90:1 | Lc 88 | AA text |
| A on night | 1.01:1 | Lc 0 | fail |
| B on night | 1.99:1 | Lc 10 | fail |

**Functional mode** (lightness adjusted, hue kept; checked against ground and surface):

| Pair | Light | Dark |
|---|---|---|
| A text on ground | #2F0303, 17.58:1, Lc 101 | #E2A69F, 9.06:1, Lc 62 |
| B text on ground | #344D2B, 8.90:1, Lc 88 | #A0BD96, 9.08:1, Lc 62 |
| Text on A fill | #FFF9E7 on #2F0303, 17.58:1, Lc 103 | same fill in dark |
| Text on B fill | #FFF9E7 on #344D2B, 8.90:1, Lc 92 | same fill in dark |

**Notes.** The AnOther quote describes the patchwork high-neck top but does not name the colours or the look number; the colours come from the photo only. The oxblood sample is very dark because of the lighting; treat it as the shadow end of the colour. Both chosen colours sit on the same top, with olive and black panels alongside.

## Gucci, Fall 1995: chartreuse and midnight velvet

Acid green over near-black blue; glossy and made for night.

- House: Gucci. Designer: Tom Ford.
- Collection: Fall 1995 ready-to-wear. Season: Autumn/Winter 1995.
- Look: Look 1: chartreuse mohair coat with midnight-blue velvet trousers.
- Sources:
  - https://www.vogue.com/fashion-shows/fall-1995-ready-to-wear/gucci/slideshow/collection#1
  - https://www.vogue.com/fashion-shows/fall-1995-ready-to-wear/gucci — "The jewel-tone satin shirts unbuttoned to there . . . the velvet hip-huggers"
- Confidence: medium.

| | Colour | OKLCH (estimated) | Hex | Basis |
|---|---|---|---|---|
| A | Chartreuse | oklch(65.5% 0.107 109.0) | #969642 | sampled: median pixel of crop 420,650,500,900 (also 720,700,790,900 -> #99993C) in look 1 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; the satin shirt under it samples lighter, #D3C685 |
| B | Midnight velvet | oklch(30.4% 0.062 283.4) | #2B2A4D | sampled: median of only the blue-cast pixels (B > R+15) in crop 520,950,740,1450 of look 1 (Vogue Runway photo, 1280px wide), i.e. the velvet's lit pile; the full-crop median is #030202 because most of the velvet falls into shadow. Estimate only |
| Neutral | Black patent | oklch(9.2% 0.010 345.0) | #040203 | sampled: median pixel of crop 540,860,640,890 in look 1 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value |
| Neutral | Stage grey | oklch(22.6% 0.021 297.2) | #1D1A25 | sampled: median pixel of crop 300,1000,380,1200 in look 1 (Vogue Runway photo, 1280px wide); estimate only, runway lighting, white balance and JPEG compression shift the value; this is the set backdrop, not a garment; the look has no light neutral |

**Proportion.** Goethe light values by hue: a 9.0, b 3.4; areas in inverse ratio. A takes 27% and B 73% of the coloured area.

**Display mode** (colours as estimated):

| Text on background | WCAG | APCA | Result |
|---|---|---|---|
| B on A | 4.37:1 | Lc 40 | large text only |
| A on B | 4.37:1 | Lc 39 | large text only |
| A on cream | 2.96:1 | Lc 55 | fail |
| B on cream | 12.95:1 | Lc 97 | AA text |
| A on night | 5.99:1 | Lc 43 | AA text |
| B on night | 1.37:1 | Lc 0 | fail |

**Functional mode** (lightness adjusted, hue kept; checked against ground and surface):

| Pair | Light | Dark |
|---|---|---|
| A text on ground | #727117, 4.88:1, Lc 72 | #B8B965, 9.04:1, Lc 61 |
| B text on ground | #2B2A4D, 12.95:1, Lc 97 | #B0B1DD, 9.05:1, Lc 61 |
| Text on A fill | #FFF9E7 on #77761E, 4.54:1, Lc 75 | same fill in dark |
| Text on B fill | #FFF9E7 on #2B2A4D, 12.95:1, Lc 99 | same fill in dark |

**Notes.** The archive text confirms satin shirts and velvet hip-huggers as the collection's key pieces but does not describe look 1's colours; those come from the photo. Shalom Harlow (look 2) and Kate Moss (look 3) wore the same trousers with blue satin; one web source describes a blue mohair coat for the campaign, which matches look 2, not look 1. The trouser blue is hard to sample and is the least certain value in this set.

## Functional mode results

When these were computed (November 2026), every functional pair passed AA in light and dark, and 7:1 in the Increase Contrast variants. The largest functional shifts, where the functional colour reads as a different shade from the runway colour:

- Jacquemus butter yellow as text becomes a dark olive-brown, because a pale yellow cannot carry text on cream. Use it as a fill, with ink on top.
- Dries Van Noten lavender and denim as text become deep violet and slate on cream. Both colours of the pair sit at almost the same lightness (L 0.73), so the pair has no internal contrast in either mode. It works as a field of two colours with ink type over it.
- Marni pink as text becomes a dusty rose-brown on cream.
- In dark mode the deep pairs (Celine, Prada, Schiaparelli aubergine) become light tints of their hue as text. Their display colours are close to the night ground.

## Alternatives not used

- Valentino, 1984, cherry wool crepe with black velvet, V&A T.501:1,2-2000. https://collections.vam.ac.uk/item/O47636/ Dropped for the reasons above.
- Schiaparelli, "Tears" dress, 1938, V&A O84418, magenta print. The V&A describes the ground as pale blue but it photographs as ivory, so the pair could not be confirmed.
- Prada, Autumn/Winter 2007, mohair top and skirt in green and orange, V&A O1351245. The museum has no photograph of the orange skirt, so only the green could be sampled.
- Jacquemus, Spring 2020, pistachio and salmon (Vogue Runway image 3). Kept back to avoid a second Jacquemus pair.
- Valentino, 1985, black dress with red bow, V&A O47747. Not sampled.

## What could not be sourced

- Bottega Veneta, Loewe and Yves Saint Laurent were on the list of houses but were not used. Five stronger pairs were found first, and none of the three was sampled.
- No house publishes an official value for any of these colours. Hermès registers its orange as a mark but publishes no Pantone or hex value.
- Look numbers for Marni Fall 2025, Dries Van Noten Fall 2024 and Jacquemus Spring 2020 rest on gallery position and photo filenames, not an official running order. The entries above say so.
- The brown Bolduc ribbon is dated 1942 in some secondary sources and 1949 in others. Hermès's own FAQ confirms the pairing but not the date.

## Sources

- J. Itten, *The Art of Color* (*Kunst der Farbe*), 1961; Studio Vista / Van Nostrand Reinhold English edition. Contrast of extension and Goethe's light values. https://archive.org/details/artofcolorsubjec00itte
- J. W. von Goethe, *Zur Farbenlehre*, 1810; English translation by C. L. Eastlake, *Theory of Colours*, 1840. https://www.gutenberg.org/ebooks/50572
- B. Ottosson, *A perceptual color space for image processing*, 2020. https://bottosson.github.io/posts/oklab/
- W3C, *WCAG 2.2*, SC 1.4.3, 1.4.6, 1.4.11. https://www.w3.org/TR/WCAG22/
- A. Somers, *APCA*, SAPC-APCA 0.0.98G-4g. https://github.com/Myndex/SAPC-APCA
- Per-pair sources are listed with each pair above.
- ITTEN rules used: COL-01, COL-02, COL-03, COL-07 (`reference/ui/03-color-and-contrast.md`).
