// Colour maths for ITTEN. No dependencies.
// OKLab/OKLCH conversions follow B. Ottosson, "A perceptual color space for
// image processing" (2020), https://bottosson.github.io/posts/oklab/
// WCAG 2.2 relative luminance and contrast ratio: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
// APCA: SAPC-APCA 0.0.98G-4g constants, https://github.com/Myndex/SAPC-APCA

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

export function rgbToHex(rgb) {
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function linearRgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363288860 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function oklabToLinearRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

export function hexToOklch(hex) {
  const [L, a, b] = linearRgbToOklab(hexToRgb(hex).map(toLinear));
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, C < 1e-4 ? 0 : H];
}

function oklchToLinear([L, C, H]) {
  const h = (H * Math.PI) / 180;
  return oklabToLinearRgb([L, C * Math.cos(h), C * Math.sin(h)]);
}

const inGamut = (lin, tol = 1e-4) => lin.every((c) => c >= -tol && c <= 1 + tol);

// OKLCH -> sRGB hex. Out-of-gamut colours are mapped by reducing chroma at
// constant lightness and hue (the approach CSS Color 4 describes).
export function oklchToHex(lch) {
  let [L, C, H] = lch;
  L = Math.min(1, Math.max(0, L));
  if (inGamut(oklchToLinear([L, C, H]))) return rgbToHex(oklchToLinear([L, C, H]).map(toGamma));
  let lo = 0, hi = C;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear([L, mid, H]))) lo = mid; else hi = mid;
  }
  return rgbToHex(oklchToLinear([L, lo, H]).map(toGamma));
}

// tol allows for components rounded to 5 decimals in the token source.
export const isInSrgb = (lch, tol = 1e-4) => inGamut(oklchToLinear(lch), tol);

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function wcag(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// APCA Lc (signed: positive = dark text on light, negative = light on dark).
export function apca(textHex, bgHex) {
  const Y = (hex) => {
    const [r, g, b] = hexToRgb(hex);
    let y = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.0721750 * b ** 2.4;
    if (y < 0.022) y += (0.022 - y) ** 1.414;
    return y;
  };
  const yt = Y(textHex), yb = Y(bgHex);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}

// Goethe's light values (Zur Farbenlehre, 1810), as used by Itten for the
// contrast of extension (The Art of Color, 1961): yellow 9, orange 8, red 6,
// green 6, blue 4, violet 3. Hue anchors are the OKLCH hues of #FF0000,
// #FF8000, #FFFF00, #00FF00, #0000FF and #8000FF, an sRGB stand-in for
// Itten's twelve-part circle; values in between are interpolated by hue angle.
export const GOETHE_ANCHORS = [
  { name: 'red', hue: 29.2, value: 6 },
  { name: 'orange', hue: 53.0, value: 8 },
  { name: 'yellow', hue: 109.8, value: 9 },
  { name: 'green', hue: 142.5, value: 6 },
  { name: 'blue', hue: 264.1, value: 4 },
  { name: 'violet', hue: 293.9, value: 3 },
];

export function goetheValue(hue) {
  const A = GOETHE_ANCHORS;
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = A[(i + 1) % A.length];
    const start = a.hue, end = b.hue > a.hue ? b.hue : b.hue + 360;
    const h = hue < start ? hue + 360 : hue;
    if (h >= start && h <= end) return a.value + ((h - start) / (end - start)) * (b.value - a.value);
  }
  return 6;
}

// Contrast of extension: areas in inverse ratio to light values.
// Returns the share of the coloured area each colour should take.
export function extension(hueA, hueB) {
  const va = goetheValue(hueA), vb = goetheValue(hueB);
  return { valueA: va, valueB: vb, shareA: vb / (va + vb), shareB: va / (va + vb) };
}

// Find the lightness (same hue, same or reduced chroma) closest to the
// original that reaches the target WCAG ratio against bgHex.
export function solveForContrast(lch, bgHex, target, direction) {
  const [L0, C, H] = lch;
  const ok = (L) => wcag(oklchToHex([L, C, H]), bgHex) >= target;
  if (ok(L0)) return [L0, C, H];
  const step = direction === 'darker' ? -0.0025 : 0.0025;
  for (let L = L0; L >= 0 && L <= 1; L += step) {
    if (ok(L)) return [Number(L.toFixed(4)), C, H];
  }
  return null;
}
