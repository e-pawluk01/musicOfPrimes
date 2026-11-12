export type Rgb = [number, number, number];

function toSrgb(x: number): number {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function oklchToLinear(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/**
 * OKLCH to screen colour (0–255 each). OKLCH keeps every hue equally bright.
 * If a colour is too vivid for the screen, its vividness is eased down until it fits.
 */
export function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
  let chroma = c;
  for (let i = 0; i < 40; i++) {
    const lin = oklchToLinear(l, chroma, hDeg);
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005)) {
      return lin.map((v) => Math.round(toSrgb(Math.min(1, Math.max(0, v))) * 255)) as Rgb;
    }
    chroma *= 0.95;
  }
  const grey = Math.round(toSrgb(l ** 3) * 255);
  return [grey, grey, grey];
}

export interface Palette {
  id: string;
  name: string;
  lightness: number;
  chroma: number;
  /** Hue in degrees for a position t (0 to 1) around the circle. */
  hue: (t: number) => number;
}

/**
 * Each palette runs from the start of the circle to the end, like the notes do.
 * Lightness and colour strength stay fixed, so no hue shouts over another.
 */
export const PALETTES: Palette[] = [
  { id: 'spectrum', name: 'Spectrum', lightness: 0.8, chroma: 0.125, hue: (t) => 25 + t * 360 },
  { id: 'aurora', name: 'Aurora', lightness: 0.82, chroma: 0.13, hue: (t) => 135 + t * 190 },
  { id: 'ember', name: 'Ember', lightness: 0.78, chroma: 0.14, hue: (t) => 5 + t * 95 },
  { id: 'ice', name: 'Ice', lightness: 0.86, chroma: 0.085, hue: (t) => 185 + t * 115 },
];

export const SPECTRUM: Palette = PALETTES[0];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? SPECTRUM;
}

export const LUT_SIZE = 256;

export interface ColorTable {
  rgb: Rgb[];
  css: string[];
}

/** Pre-computes the colour for each of 256 steps around the circle. */
export function buildColorTable(p: Palette): ColorTable {
  const rgb: Rgb[] = [];
  const css: string[] = [];
  for (let i = 0; i < LUT_SIZE; i++) {
    const c = oklchToRgb(p.lightness, p.chroma, p.hue(i / LUT_SIZE));
    rgb.push(c);
    css.push(`rgb(${c[0]},${c[1]},${c[2]})`);
  }
  return { rgb, css };
}
