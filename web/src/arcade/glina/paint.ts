/**
 * Glina's drawing primitives (Canvas 2D, no assets), shared by the play view, the calibration
 * intro, the lobby preview and the Postępy tiles: the sunlit palette, the shading strips the
 * vessel renderer stretches row by row (one per clay state and glaze, made once), the potter's
 * hands (warm silhouettes, no faces anywhere), and small shapes — stars, chalk strokes, a cat.
 * Everything is drawn in CSS pixels; what a frame draws again and again is made once.
 */
import type { GlazeId } from './content';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';

export const font = (weight: number, size: number, family: string, italic = false) => `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

/** The palette (art direction §8.1): a whitewashed courtyard under a Judean sky; glow only in the kiln. */
export const C = {
  whitewash: '#F4EFE6', sand: '#E9D8BC', terracotta: '#C4673F', shadow: '#6B5B73', olive: '#7E8C4F', fig: '#4F7A3A',
  wood: '#8A5A3C', ink: '#3B2A22', zenith: '#3F6E9C', sky: '#7DB3DC', horizon: '#CFE3EF', golden: '#F2C48A',
  sunset1: '#F2A65A', sunset2: '#C4673F', sunset3: '#6B5B73',
  wet: '#6E4632', leather: '#B07A55', fired: '#C4673F', porcelainWet: '#D8D2C8', porcelainFired: '#F3EEE6',
  ash: '#A9A35B', chamber1: '#FFD08A', chamber2: '#FF9A4D', ember: '#E2572B', brick: '#9C5B3B', soot: '#3A2A26',
  blush: '#D9653B', speckle: '#4A2A1C', moon: '#DCE8F2', chalk: 'rgba(255,255,255,.85)', card: 'rgba(252,248,240,.94)',
  cardEdge: 'rgba(59,42,34,.14)', muted: 'rgba(59,42,34,.62)', gold: '#B8862E',
} as const;

/** Each glaze: its colour, where it pools darker, how glossy it fires. */
export const GLAZE: Readonly<Record<GlazeId, { c: string; pool: string; gloss: number }>> = {
  biel: { c: '#F2F0E8', pool: '#C9D3DA', gloss: 0.9 },
  miod: { c: '#D9A441', pool: '#9E6A24', gloss: 0.6 },
  seledyn: { c: '#A5C4AE', pool: '#6F9A84', gloss: 0.95 },
  kobalt: { c: '#2C4E9E', pool: '#1C3270', gloss: 0.95 },
  zelazo: { c: '#8C3B22', pool: '#4E1D10', gloss: 0.55 },
};

const TAU = Math.PI * 2;

/** Stable pseudo-random numbers for decorations (the same every frame). */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** #rrggbb, or the rgb() that mix() returns (so a mix can be mixed again). */
function rgbOf(h: string): [number, number, number] {
  if (h.startsWith('rgb')) {
    const [r, g, b] = h.slice(h.indexOf('(') + 1).split(',').map(s => parseFloat(s));
    return [r, g, b];
  }
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/** A colour mixed toward another (0..1), as rgb(); either may be #rrggbb or rgb(). */
export function mix(a: string, b: string, k: number): string {
  const x = rgbOf(a), y = rgbOf(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * k)},${Math.round(x[1] + (y[1] - x[1]) * k)},${Math.round(x[2] + (y[2] - x[2]) * k)})`;
}

// ── shading strips ───────────────────────────────────────────────
/**
 * A strip shades one row of a turning vessel: 256 px across the cylinder, lit from the upper left
 * with a warm bounce from the sunlit floor on the right.  `spec` strips hold only the specular band
 * (white with alpha) at a soft and a sharp width; the renderer lays it over the base with the
 * trueness's gloss.
 */
export interface Strips { base: HTMLCanvasElement; ring: HTMLCanvasElement; soft: HTMLCanvasElement; sharp: HTMLCanvasElement }

const stripCache = new Map<string, Strips>();
const STRIP_W = 256;

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Light: from the upper left and the front (normalised in the horizontal plane), a little bounce from the right. */
const LX = -0.55, LZ = 0.835, HX = -0.288, HZ = 0.958;

function fillStrip(c: HTMLCanvasElement, color: string, amb: number, bounce: string, darker = 0): void {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(STRIP_W, 1);
  const [r, g, b] = rgbOf(color), [br, bg, bb] = rgbOf(bounce);
  for (let i = 0; i < STRIP_W; i++) {
    const nx = (i + 0.5) / STRIP_W * 2 - 1, nz = Math.sqrt(Math.max(0, 1 - nx * nx));
    const d = Math.max(0, LX * nx + LZ * nz);
    const bounceK = Math.max(0, nx) ** 3 * 0.35;
    let k = amb + (1 - amb) * d;
    k *= 1 - darker;
    const edge = Math.min(1, nz * 3.2);            // the silhouette's edge darkens a touch (soft occlusion)
    k *= 0.82 + 0.18 * edge;
    const j = i * 4;
    img.data[j] = Math.min(255, r * k + br * bounceK);
    img.data[j + 1] = Math.min(255, g * k + bg * bounceK);
    img.data[j + 2] = Math.min(255, b * k + bb * bounceK);
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function fillSpec(c: HTMLCanvasElement, power: number, tint: string): void {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(STRIP_W, 1);
  const [r, g, b] = rgbOf(tint);
  for (let i = 0; i < STRIP_W; i++) {
    const nx = (i + 0.5) / STRIP_W * 2 - 1, nz = Math.sqrt(Math.max(0, 1 - nx * nx));
    const s = Math.max(0, HX * nx + HZ * nz) ** power;
    const j = i * 4;
    img.data[j] = r;
    img.data[j + 1] = g;
    img.data[j + 2] = b;
    img.data[j + 3] = Math.round(255 * s);
  }
  ctx.putImageData(img, 0, 0);
}

/** The strips for a surface colour (made once per colour). */
export function strips(color: string): Strips {
  let s = stripCache.get(color);
  if (s) return s;
  const base = canvas(STRIP_W, 1), ring = canvas(STRIP_W, 1), soft = canvas(STRIP_W, 1), sharp = canvas(STRIP_W, 1);
  fillStrip(base, color, 0.5, '#F2D9B0');
  fillStrip(ring, color, 0.5, '#F2D9B0', 0.1);
  fillSpec(soft, 7, '#FFF8EC');
  fillSpec(sharp, 70, '#FFFFFF');
  s = { base, ring, soft, sharp };
  stripCache.set(color, s);
  return s;
}

// ── small shapes ─────────────────────────────────────────────────
/** A five-pointed star (★). */
export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean, color: string): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.stroke();
  }
}

/** A rounded card in the courtyard's light: whitewash with a soft shadow. */
export function cardBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, r = 16, fill: string = C.card): void {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(59,42,34,.22)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = C.cardEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/**
 * A potter's hand, a warm simplified silhouette: the palm against the wall with the fingers
 * together and the thumb above, the forearm reaching in from outside (`dir` +1 from the right,
 * −1 from the left).  (x, y) is where the fingertips touch; `s` the hand's length.
 */
export function hand(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, press = 0, light = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const tone = mix(C.wood, '#C08A62', 0.35 * light);
  // the forearm, from the fingertips out to beyond the hand
  ctx.fillStyle = mix(C.wood, '#5E3B27', 0.25);
  ctx.beginPath();
  ctx.moveTo(s * 0.55, -s * 0.2);
  ctx.quadraticCurveTo(s * 1.4, -s * 0.38, s * 2.6, -s * 0.2);
  ctx.lineTo(s * 2.6, s * 0.36);
  ctx.quadraticCurveTo(s * 1.4, s * 0.42, s * 0.55, s * 0.26);
  ctx.closePath();
  ctx.fill();
  // the palm and the four fingers together, curved to the wall
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.moveTo(-press * s * 0.05, -s * 0.16);
  ctx.bezierCurveTo(s * 0.12, -s * 0.3, s * 0.48, -s * 0.32, s * 0.7, -s * 0.22);
  ctx.lineTo(s * 0.74, s * 0.24);
  ctx.bezierCurveTo(s * 0.5, s * 0.32, s * 0.16, s * 0.3, -press * s * 0.05, s * 0.16);
  ctx.quadraticCurveTo(-s * 0.07, 0, -press * s * 0.05, -s * 0.16);
  ctx.closePath();
  ctx.fill();
  // the thumb, resting above
  ctx.beginPath();
  ctx.moveTo(s * 0.62, -s * 0.2);
  ctx.quadraticCurveTo(s * 0.34, -s * 0.46, s * 0.12, -s * 0.36);
  ctx.quadraticCurveTo(s * 0.06, -s * 0.3, s * 0.16, -s * 0.26);
  ctx.quadraticCurveTo(s * 0.36, -s * 0.3, s * 0.5, -s * 0.16);
  ctx.closePath();
  ctx.fill();
  // a lighter rim where the sun catches the knuckles, and the fingers' parting lines
  ctx.strokeStyle = 'rgba(255,226,190,.55)';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(s * 0.08, -s * 0.2);
  ctx.bezierCurveTo(s * 0.2, -s * 0.28, s * 0.46, -s * 0.3, s * 0.66, -s * 0.21);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70,40,26,.35)';
  ctx.lineWidth = Math.max(0.8, s * 0.02);
  for (let i = 1; i < 4; i++) {
    const fy = -s * 0.16 + (i * s * 0.32) / 4;
    ctx.beginPath();
    ctx.moveTo(-press * s * 0.03, fy);
    ctx.lineTo(s * 0.22, fy * 1.05);
    ctx.stroke();
  }
  ctx.restore();
}

/** A cat asleep on the wall (a day's gift): a curled silhouette with one ear up. */
export function cat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  const breath = 1 + 0.03 * Math.sin(t * 1.6);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#5A4A52';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.28 * breath, s * 0.62, s * 0.3 * breath, 0, Math.PI, TAU);
  ctx.lineTo(s * 0.62, 0);
  ctx.lineTo(-s * 0.62, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 0.5, -s * 0.24, s * 0.22, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.4, -s * 0.38);
  ctx.lineTo(s * 0.46, -s * 0.58);
  ctx.lineTo(s * 0.56, -s * 0.42);
  ctx.closePath();
  ctx.moveTo(s * 0.58, -s * 0.4);
  ctx.lineTo(s * 0.7, -s * 0.56);
  ctx.lineTo(s * 0.72, -s * 0.34);
  ctx.closePath();
  ctx.fill();
  // the tail along the coping
  ctx.strokeStyle = '#5A4A52';
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.58, -s * 0.06);
  ctx.quadraticCurveTo(-s * 0.9, -s * 0.02, -s * 0.98, s * 0.12);
  ctx.stroke();
  ctx.restore();
}

/** A sprig of almond blossom in a small jar (a day's gift). */
export function almond(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#6B4A35';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.3);
  ctx.quadraticCurveTo(-s * 0.1, -s * 0.8, s * 0.2, -s * 1.2);
  ctx.moveTo(-s * 0.04, -s * 0.7);
  ctx.quadraticCurveTo(-s * 0.4, -s * 0.9, -s * 0.46, -s * 1.1);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const bx = (hash(i + 40) - 0.45) * s * 0.8, by = -s * (0.75 + hash(i + 41) * 0.5);
    ctx.fillStyle = i % 3 ? '#FBE9EE' : '#F2C6D2';
    ctx.beginPath();
    ctx.arc(bx, by, s * (0.07 + hash(i + 42) * 0.04), 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.terracotta;
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, -s * 0.34);
  ctx.quadraticCurveTo(-s * 0.26, -s * 0.1, -s * 0.14, 0);
  ctx.lineTo(s * 0.14, 0);
  ctx.quadraticCurveTo(s * 0.26, -s * 0.1, s * 0.16, -s * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
