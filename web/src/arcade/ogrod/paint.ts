/**
 * Ogród o świcie's paint box (DESIGN.md §23): the fonts, the garden's colours from the night to the risen sun (each
 * thing's colour is a ramp over the sky's `dawn` 0..1 — indigo night, the blue hour, rose, gold, morning), soft glow
 * sprites drawn additively, and small drawing helpers.  No randomness at draw time: `hash` gives the garden its
 * stable irregularities.
 */

export const FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const INK = '#f6efe4';
export const GOLD = '#f5c66a';
export const GOLD_HI = '#fff1c4';
export const TAU = Math.PI * 2;

export type Canvas2D = HTMLCanvasElement;

/** "#rrggbb" with an alpha as "rgba(…)". */
export const rgba = (hex: string, a: number): string => {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${Math.max(0, Math.min(1, a))})`;
};

/** A stable pseudo-random 0..1 for an integer. */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const hexRGB = (h: string): [number, number, number] => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** Mix two hex colours (k 0..1) as "#rrggbb". */
export function mixHex(a: string, b: string, k: number): string {
  const p = hexRGB(a), q = hexRGB(b);
  const c = (i: number) => Math.round(p[i] + (q[i] - p[i]) * Math.max(0, Math.min(1, k))).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}

/** The sky's stops (dawn 0 the night, .3 the blue hour, .62 rose, .82 gold, 1 the morning). */
const AT = [0, 0.3, 0.62, 0.82, 1] as const;

/** Each thing's colour over the dawn. */
const RAMPS = {
  skyTop: ['#04071a', '#0a1538', '#22336a', '#3d67a6', '#6ea1d6'],
  skyMid: ['#0a1230', '#1b3264', '#6a67a4', '#c8a2b6', '#f0d3c0'],
  skyLow: ['#141d3d', '#3a4c84', '#e0a0a4', '#ffc68c', '#ffe4ac'],
  hills: ['#0a0f27', '#162042', '#463f68', '#7c7698', '#98a2bb'],
  hillsNear: ['#080c20', '#111a38', '#36345a', '#5e6684', '#7b8ea4'],
  cypress: ['#05091a', '#0c1430', '#252a4a', '#3c4a62', '#4c6474'],
  wall: ['#1d2442', '#2a3254', '#685968', '#a88c84', '#c8b098'],
  wallDark: ['#121830', '#1d2444', '#4a4052', '#7c6660', '#957f6e'],
  coping: ['#252b48', '#363e60', '#857282', '#c8aa98', '#e2cdb2'],
  ivy: ['#0a1718', '#112426', '#24392f', '#365638', '#44703f'],
  ivyHi: ['#16282a', '#1f3a38', '#3e5a44', '#5e8a4e', '#78a85a'],
  lawnFar: ['#132532', '#1a3236', '#3a4a3c', '#5c7148', '#728a52'],
  lawn: ['#0d1c24', '#132829', '#25362e', '#40593a', '#557445'],
  lawnNear: ['#081218', '#0c1a1c', '#182820', '#2c4229', '#3a5732'],
  bush: ['#091619', '#0e2022', '#1d2e28', '#304a33', '#3c5d3b'],
  bushHi: ['#152a2e', '#1c3836', '#33493c', '#4f7048', '#649052'],
  oliveDark: ['#0b1719', '#122326', '#2c3c38', '#45584a', '#56705a'],
  oliveSilver: ['#2e4054', '#435a6e', '#7f8e94', '#9fb0a0', '#b4c2ac'],
  trunk: ['#100e14', '#1a1820', '#3a3034', '#5e4a40', '#6e5646'],
  path: ['#1b2030', '#283046', '#5f5660', '#9c8a7c', '#b6a48e'],
  pathStone: ['#262c40', '#363e58', '#7a7078', '#b8a492', '#cbb9a2'],
  soil: ['#0d0a0c', '#16121a', '#2e2224', '#46322a', '#523a2c'],
  soilHi: ['#1c171c', '#272230', '#4a3836', '#6a4e3e', '#7a5a44'],
  bedEdge: ['#1a1e30', '#2a304a', '#6c6068', '#ad968a', '#c6b09c'],
  bench: ['#1d2238', '#2e3554', '#76686f', '#b89e90', '#d3bea6'],
  benchDark: ['#0f1222', '#1a1f36', '#4a4250', '#7d6a62', '#927e6e'],
  wood: ['#150f10', '#22191c', '#4a3428', '#74503a', '#87603f'],
  woodHi: ['#251c1c', '#33282c', '#6a4c38', '#9a6c4a', '#ad7e52'],
  water: ['#06102a', '#0e2048', '#3c4a7c', '#7b8cb4', '#95b6d6'],
  waterDeep: ['#030817', '#08142e', '#1f2a52', '#45557c', '#5a7ca0'],
  lily: ['#0c1d1c', '#13302c', '#2c4a3a', '#3f6a44', '#4f8048'],
  mist: ['#8ea0c8', '#9eb2d8', '#e8c8d0', '#ffe4cc', '#fff4e4'],
  clay: ['#2a1c1c', '#3a2a2c', '#7a5448', '#b4764e', '#c88a5a'],
} as const;
export type Ramp = keyof typeof RAMPS;

const memo = new Map<string, string>();
/** A thing's colour at the sky's dawn `k` (quantised to 1/200: a frame reuses its strings). */
export function pal(name: Ramp, k: number): string {
  const q = Math.round(Math.max(0, Math.min(1, k)) * 200);
  const key = `${name}|${q}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const x = q / 200, r = RAMPS[name];
  let i = 0;
  while (i < AT.length - 2 && x > AT[i + 1]) i++;
  const out = mixHex(r[i], r[i + 1], (x - AT[i]) / (AT[i + 1] - AT[i]));
  if (memo.size > 4000) memo.clear();
  memo.set(key, out);
  return out;
}

export function makeCanvas(w: number, h: number): Canvas2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c.getContext('2d') ? c : null;
}

/** A soft round glow sprite (white core, the colour, transparent), drawn additively. */
export function glowSprite(color: string, size = 128, core = 1): Canvas2D | null {
  const c = makeCanvas(size, size), g = c?.getContext('2d');
  if (!c || !g) return null;
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(color, core));
  gr.addColorStop(0.22, rgba(color, 0.55 * core));
  gr.addColorStop(0.55, rgba(color, 0.16 * core));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Draw a glow sprite centred at (x, y), radius r (rx × ry when stretched). */
export function glow(ctx: CanvasRenderingContext2D, sprite: Canvas2D | null, x: number, y: number, r: number, a: number, ry = r): void {
  if (!sprite || r <= 0 || ry <= 0 || a <= 0.003) return;
  const was = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, a) * was;
  ctx.drawImage(sprite, x - r, y - ry, 2 * r, 2 * ry);
  ctx.globalAlpha = was;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** The flowers' colours: petals, their heart, a deeper edge. */
export const BLOOMS: readonly { petal: string; deep: string; heart: string }[] = [
  { petal: '#fff6ee', deep: '#e8d6dc', heart: '#ffd36a' },   // white
  { petal: '#ffc2d0', deep: '#e88aa6', heart: '#ffe08a' },   // rose
  { petal: '#ffe08a', deep: '#f0b44a', heart: '#c8782a' },   // gold
  { petal: '#d8c8ff', deep: '#a890e8', heart: '#ffe6a0' },   // lilac
  { petal: '#ffd2b0', deep: '#f2a07a', heart: '#fff0b0' },   // apricot
  { petal: '#c8e6ff', deep: '#8ab8e8', heart: '#fff4c0' },   // sky
];
