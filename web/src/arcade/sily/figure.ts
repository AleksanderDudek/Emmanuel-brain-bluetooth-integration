/**
 * Nowe siły's person (DESIGN.md §28): an adult of about forty — a woman or a man, three skin tones — standing, seen
 * from the hips up, painted softly in light from the upper left.  At the start of every session they are tired, as
 * tiredness really looks (Sundelin et al. 2013: hanging eyelids, darker circles under the eyes, paler skin, droopier
 * corners of the mouth; Axelsson et al. 2010): the skin grey-sallow and dull with some redness and a few blemishes,
 * shadows under half-lidded dim eyes, the shoulders slumped and the head a little forward, the hair thin and dull, the
 * lips pale, a cool grey cast over everything.  Each parameter of `Renewal` (renew.ts) brings one back:
 *
 *   kolor     warm colour in the skin, rosy lips and cheeks (the blood: marrow)
 *   skora     the redness and the blemishes fade, the skin evens and takes a soft sheen (the skin's stem cells)
 *   oczy      the lids lift, the whites clear, the circles go, a light in the eyes (sleep's repair)
 *   postawa   the shoulders rise and open, the head comes up (the muscles that hold us)
 *   wlosy     the hair fuller, its colour deeper, a sheen along it (the follicle's bulge)
 *   usmiech   a quiet smile; the cheeks lift (the joy of a rested body) — the warm light around is the world's
 *
 * Never grotesque: the tired face is a real, recognisable tiredness, kindly drawn.  World units: the eye line at
 * y ≈ −90, the shoulders at ≈ −64, the figure's midline x = 0; the painter draws under the world's transform.
 * `FigureCache` keeps the painted person in an offscreen layer per look and (quantised) renewal, so a frame only
 * composes it; a close view keeps the head and shoulders in a second, sharper layer.
 */
import { layer, mix, rgba, TAU } from '../kit/healthlib/paint';
import { PARAMS, overall, type Renewal } from './renew';

// ── the looks ─────────────────────────────────────────────────────
export type Sex = 'f' | 'm';
export interface FigureLook { sex: Sex; tone: 1 | 2 | 3 }
export const LOOKS = ['f1', 'f2', 'f3', 'm1', 'm2', 'm3'] as const;

export function lookOf(look: string): FigureLook {
  const sex: Sex = look.startsWith('m') ? 'm' : 'f';
  const n = Number(look.slice(1));
  return { sex, tone: n === 2 ? 2 : n === 3 ? 3 : 1 };
}

interface Tone { base: string; shade: string; light: string; lip: string; blush: string; under: string; red: string; sallow: string; iris: string; blushA: number; redA: number }
const TONES: Readonly<Record<1 | 2 | 3, Tone>> = {
  1: { base: '#e7b999', shade: '#bf8669', light: '#f8dcc7', lip: '#cf7a78', blush: '#ef8a80', under: '#7d5a70', red: '#d9574d', sallow: '#cfc0a8', iris: '#5f8197', blushA: 0.26, redA: 0.24 },
  2: { base: '#c08762', shade: '#8f5c3d', light: '#dcab84', lip: '#a65e4d', blush: '#d8725a', under: '#4f3440', red: '#b9473a', sallow: '#ab9a80', iris: '#5b3b22', blushA: 0.2, redA: 0.26 },
  3: { base: '#7a4a32', shade: '#4b2b1c', light: '#a5714f', lip: '#6b372e', blush: '#a04c3a', under: '#2a171b', red: '#7e3326', sallow: '#7a6a5e', iris: '#2f1b10', blushA: 0.18, redA: 0.24 },
};

interface Hair { style: 'bob' | 'long' | 'curls' | 'short' | 'stubble' | 'beard'; color: string; hi: string }
const HAIR: Readonly<Record<string, Hair>> = {
  f1: { style: 'bob', color: '#6e4528', hi: '#c08a5a' },
  f2: { style: 'long', color: '#32211a', hi: '#8a6248' },
  f3: { style: 'curls', color: '#1d1410', hi: '#6a4a38' },
  m1: { style: 'short', color: '#5e3f27', hi: '#a77b52' },
  m2: { style: 'stubble', color: '#2a1c15', hi: '#76563f' },
  m3: { style: 'beard', color: '#17100c', hi: '#5c4234' },
};
const CLOTH: Readonly<Record<Sex, { c: string; hi: string; lo: string }>> = {
  f: { c: '#2d5c66', hi: '#4f8790', lo: '#163940' },
  m: { c: '#34475f', hi: '#5a7090', lo: '#1c2738' },
};

// ── the body's geometry (posture moves it) ────────────────────────
export interface Geo {
  /** the eye line (the head's middle) and the features' small drop as the head bows */
  cy: number;
  feat: number;
  /** the shoulders' line and half width */
  sy: number;
  sx: number;
  hw: number;
  sex: Sex;
  /** arms: shoulder joint, elbow, wrist, the hand's end (left side; the right mirrors) */
  arm: readonly (readonly [number, number])[];
}

export function geoOf(sex: Sex, posture: number): Geo {
  const sl = 1 - Math.max(0, Math.min(1, posture));
  // slumped: the head comes forward and down more than the shoulders sink, the shoulders round in
  const cy = -90 + 4.4 * sl;
  const sy = -66.5 + 2.4 * sl;
  const sx = (sex === 'f' ? 22 : 26) - 2.8 * sl;
  const arm: [number, number][] = [
    [-(sx - 3.6), sy + 4.5],
    [-(sx + 0.6 - 1.4 * sl), sy + 33],
    [-(sx - 1.2 - 2.8 * sl), sy + 61],
    [-(sx - 1.8 - 3.4 * sl), sy + 76],
  ];
  return { cy, feat: 0.7 * sl, sy, sx, hw: sex === 'f' ? 9.1 : 9.5, sex, arm };
}

// ── small helpers ─────────────────────────────────────────────────
const clamp = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: readonly [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(0.01, r));
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** A soft round spot (a radial gradient fading to nothing). */
function spot(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number, a: number): void {
  if (a <= 0.004 || rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, rx, [[0, rgba(color, a)], [0.55, rgba(color, a * 0.45)], [1, rgba(color, 0)]]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The skin's colours for a tone and the colour and sheen of this moment. */
export function skinOf(tone: 1 | 2 | 3, r: Renewal): { base: string; shade: string; light: string; lip: string } {
  const T = TONES[tone];
  const tired = 1 - r.kolor;
  const k = 0.62 * tired;
  return {
    base: mix(T.base, T.sallow, k),
    shade: mix(T.shade, mix(T.sallow, '#3a3a40', 0.45), k * 0.7),
    light: mix(T.light, mix(T.sallow, '#f4f0ea', 0.3), k * 0.8),
    lip: mix(T.lip, mix(T.base, T.sallow, 0.5), 0.62 * tired),
  };
}

// ── the head ──────────────────────────────────────────────────────
function headPath(ctx: CanvasRenderingContext2D, g: Geo): void {
  const { cy, hw } = g;
  const jaw = g.sex === 'f' ? 7.7 : 8.5;
  const chin = cy + 13;
  ctx.beginPath();
  ctx.moveTo(0, cy - 13.2);
  ctx.bezierCurveTo(hw * 0.7, cy - 13.2, hw, cy - 9.6, hw * 0.99, cy - 5);
  ctx.bezierCurveTo(hw * 1.02, cy - 1.8, hw * 1.01, cy + 0.6, hw * 0.96, cy + 2.6);
  ctx.bezierCurveTo(hw * 0.93, cy + 5.6, jaw + 0.6, cy + 7.4, jaw, cy + 8.6);
  ctx.bezierCurveTo(jaw - 1.2, cy + 11.6, 4.2, chin, 0, chin);
  ctx.bezierCurveTo(-4.2, chin, -(jaw - 1.2), cy + 11.6, -jaw, cy + 8.6);
  ctx.bezierCurveTo(-(jaw + 0.6), cy + 7.4, -hw * 0.93, cy + 5.6, -hw * 0.96, cy + 2.6);
  ctx.bezierCurveTo(-hw * 1.01, cy + 0.6, -hw * 1.02, cy - 1.8, -hw * 0.99, cy - 5);
  ctx.bezierCurveTo(-hw, cy - 9.6, -hw * 0.7, cy - 13.2, 0, cy - 13.2);
  ctx.closePath();
}

function ears(ctx: CanvasRenderingContext2D, g: Geo, sk: ReturnType<typeof skinOf>): void {
  for (const s of [-1, 1]) {
    const x = s * (g.hw - 0.4), y = g.cy + 1.6;
    ctx.fillStyle = s < 0 ? sk.base : mix(sk.base, sk.shade, 0.35);
    ctx.beginPath();
    ctx.ellipse(x + s * 0.9, y, 1.7, 3.1, s * 0.12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(sk.shade, 0.5);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.ellipse(x + s * 1.0, y, 0.9, 2.1, s * 0.12, -Math.PI / 2, Math.PI / 2, s < 0);
    ctx.stroke();
  }
}

function eye(ctx: CanvasRenderingContext2D, ex: number, ey: number, side: number, r: Renewal, T: Tone, sk: ReturnType<typeof skinOf>, closed: boolean): void {
  const e = r.oczy;
  // the upper lid: half over the eye when tired, lifted when rested, down in sleep
  const lidY = ey - 1.35 + (closed ? 1 : 0.2 + 0.32 * (1 - e)) * 2.55;
  const almond = (): void => {
    ctx.beginPath();
    ctx.moveTo(ex - side * 1.8, ey + 0.25);
    ctx.bezierCurveTo(ex - side * 0.6, ey - 1.5, ex + side * 0.9, ey - 1.4, ex + side * 1.85, ey - 0.05);
    ctx.bezierCurveTo(ex + side * 0.9, ey + 0.95, ex - side * 0.6, ey + 1.05, ex - side * 1.8, ey + 0.25);
    ctx.closePath();
  };
  // the socket's soft shade and, when tired, the circle under the eye
  spot(ctx, T.shade, ex + side * 0.2, ey - 0.9, 3.2, 1.9, 0.2);
  spot(ctx, T.under, ex + side * 0.25, ey + 1.95, 2.7, 1.05, 0.5 * (1 - e));
  spot(ctx, sk.light, ex + side * 0.3, ey + 3.0, 2.4, 0.7, 0.16 * (1 - e));
  ctx.save();
  almond();
  ctx.clip();
  // the white (a little red when tired), the iris and its light
  ctx.fillStyle = mix('#f2ece6', '#e6b4aa', 0.5 * (1 - e));
  ctx.fillRect(ex - 2.2, ey - 2, 4.4, 4);
  ctx.fillStyle = radial(ctx, ex, ey + 0.05, 0.86, [[0, mix(T.iris, '#000000', 0.4)], [0.35, T.iris], [0.85, mix(T.iris, '#ffffff', 0.12 + 0.12 * e)], [1, mix(T.iris, '#000000', 0.5)]]);
  ctx.beginPath();
  ctx.arc(ex, ey + 0.05, 0.86, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0c0706';
  ctx.beginPath();
  ctx.arc(ex, ey + 0.05, 0.34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${(0.22 + 0.7 * e).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(ex - 0.28, ey - 0.28, 0.17 + 0.07 * e, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mix(sk.base, sk.shade, 0.22);
  ctx.beginPath();
  ctx.moveTo(ex - 2.4, ey - 2.2);
  ctx.lineTo(ex + 2.4, ey - 2.2);
  ctx.lineTo(ex + 2.4, lidY - 0.25);
  ctx.quadraticCurveTo(ex, lidY + 0.35, ex - 2.4, lidY - 0.25);
  ctx.closePath();
  ctx.fill();
  // the lower lid lifts a little with a smile
  const low = 0.18 * r.usmiech;
  if (low > 0.01 && !closed) {
    ctx.fillStyle = sk.base;
    ctx.beginPath();
    ctx.moveTo(ex - 2.4, ey + 1.6);
    ctx.lineTo(ex - 2.4, ey + 1.2 - low * 2);
    ctx.quadraticCurveTo(ex, ey + 0.7 - low * 2.4, ex + 2.4, ey + 1.2 - low * 2);
    ctx.lineTo(ex + 2.4, ey + 1.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // the lash line and the crease
  ctx.strokeStyle = 'rgba(28,16,14,.82)';
  ctx.lineWidth = 0.34;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (closed) {
    ctx.moveTo(ex - side * 1.8, ey + 0.25);
    ctx.quadraticCurveTo(ex + side * 0.1, ey + 1.15, ex + side * 1.85, ey + 0.05);
  } else {
    ctx.moveTo(ex - side * 1.8, ey + 0.25);
    ctx.quadraticCurveTo(ex - side * 0.4, Math.min(ey + 0.6, lidY - 0.05), ex + side * 1.95, ey - 0.15);
  }
  ctx.stroke();
  ctx.strokeStyle = rgba(T.shade, 0.42);
  ctx.lineWidth = 0.26;
  ctx.beginPath();
  ctx.moveTo(ex - side * 1.6, ey - 0.9);
  ctx.quadraticCurveTo(ex + side * 0.3, ey - 2.15 + 0.35 * (1 - e), ex + side * 1.9, ey - 0.8);
  ctx.stroke();
}

function brows(ctx: CanvasRenderingContext2D, g: Geo, hair: Hair, r: Renewal): void {
  const y = g.cy - 2.7 + g.feat - 0.25 * r.oczy;
  ctx.strokeStyle = rgba(mix(hair.color, '#7a6a60', 0.2 * (1 - r.wlosy)), 0.78);
  ctx.lineCap = 'round';
  const tired = 1 - r.oczy;
  for (const s of [-1, 1]) {
    ctx.lineWidth = g.sex === 'f' ? 0.62 : 0.85;
    ctx.beginPath();
    ctx.moveTo(s * 1.6, y + 0.5 - 0.55 * tired);
    ctx.quadraticCurveTo(s * 4.2, y - 0.85 + 0.1 * tired, s * 6.4, y + 0.45 + 0.35 * tired);
    ctx.stroke();
  }
}

function nose(ctx: CanvasRenderingContext2D, g: Geo, T: Tone, sk: ReturnType<typeof skinOf>): void {
  const y = g.cy + g.feat;
  ctx.strokeStyle = rgba(T.shade, 0.32);
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1.0, y + 0.3);
  ctx.quadraticCurveTo(1.35, y + 2.8, 1.45, y + 4.4);
  ctx.stroke();
  ctx.strokeStyle = rgba(sk.light, 0.38);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-0.35, y + 0.6);
  ctx.lineTo(-0.35, y + 4.1);
  ctx.stroke();
  spot(ctx, sk.light, -0.25, y + 4.6, 1.2, 1.0, 0.35);
  spot(ctx, T.shade, 0, y + 5.75, 1.9, 0.62, 0.5);
  ctx.fillStyle = 'rgba(40,18,14,.5)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 0.85, y + 5.6, 0.46, 0.27, s * 0.3, 0, TAU);
    ctx.fill();
  }
  // the wings of the nose
  ctx.strokeStyle = rgba(T.shade, 0.45);
  ctx.lineWidth = 0.3;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 1.0, y + 4.1);
    ctx.quadraticCurveTo(s * 2.2, y + 4.5, s * 1.5, y + 5.7);
    ctx.stroke();
  }
}

function mouth(ctx: CanvasRenderingContext2D, g: Geo, r: Renewal, T: Tone, sk: ReturnType<typeof skinOf>, sleeping: boolean): void {
  const m = sleeping ? 0.35 : r.usmiech;
  const my = g.cy + 8.45 + g.feat;
  const hw = (g.sex === 'f' ? 2.45 : 2.6) + 0.35 * m;
  const cyc = my + 0.42 - 0.95 * m;
  // the upper lip
  ctx.fillStyle = mix(sk.lip, T.shade, 0.25);
  ctx.beginPath();
  ctx.moveTo(-hw, cyc);
  ctx.bezierCurveTo(-1.6, my - 0.55, -1.0, my - 1.05, -0.45, my - 0.95);
  ctx.quadraticCurveTo(0, my - 0.7, 0.45, my - 0.95);
  ctx.bezierCurveTo(1.0, my - 1.05, 1.6, my - 0.55, hw, cyc);
  ctx.quadraticCurveTo(0.6, my + 0.1 - 0.25 * m, 0, my + 0.12 - 0.2 * m);
  ctx.quadraticCurveTo(-0.6, my + 0.1 - 0.25 * m, -hw, cyc);
  ctx.closePath();
  ctx.fill();
  // the lower lip, fuller and lit from above
  ctx.fillStyle = radial(ctx, -0.3, my + 0.55, 2.4, [[0, mix(sk.lip, '#ffffff', 0.14)], [0.7, sk.lip], [1, mix(sk.lip, T.shade, 0.3)]]);
  ctx.beginPath();
  ctx.moveTo(-hw, cyc);
  ctx.quadraticCurveTo(-0.6, my + 0.1 - 0.25 * m, 0, my + 0.12 - 0.2 * m);
  ctx.quadraticCurveTo(0.6, my + 0.1 - 0.25 * m, hw, cyc);
  ctx.bezierCurveTo(1.5, my + 1.5, 0.6, my + 1.7, 0, my + 1.7);
  ctx.bezierCurveTo(-0.6, my + 1.7, -1.5, my + 1.5, -hw, cyc);
  ctx.closePath();
  ctx.fill();
  // the line between them and its corners
  ctx.strokeStyle = rgba(mix(T.shade, '#200c0a', 0.5), 0.6);
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(-hw - 0.1, cyc + 0.02);
  ctx.quadraticCurveTo(-0.6, my + 0.1 - 0.25 * m, 0, my + 0.12 - 0.2 * m);
  ctx.quadraticCurveTo(0.6, my + 0.1 - 0.25 * m, hw + 0.1, cyc + 0.02);
  ctx.stroke();
  // under the lower lip a little shade; a smile's soft lines
  spot(ctx, T.shade, 0, my + 2.5, 1.8, 0.6, 0.28);
  if (m > 0.3) {
    ctx.strokeStyle = rgba(T.shade, 0.16 * m);
    ctx.lineWidth = 0.35;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 1.9, g.cy + 5.6 + g.feat);
      ctx.quadraticCurveTo(s * (hw + 1.2), my - 0.4, s * (hw + 0.5), cyc + 0.9);
      ctx.stroke();
    }
  }
}

/** A few small blemishes, always the same places (they fade with the skin's renewal). */
const BLEMISH: readonly (readonly [number, number, number])[] = [[-5.6, 4.6, 0.42], [6.1, 3.2, 0.36], [-2.2, -7.6, 0.33], [2.6, 11.0, 0.4], [-6.6, 7.4, 0.3], [5.0, 6.9, 0.32]];

function face(ctx: CanvasRenderingContext2D, g: Geo, L: FigureLook, r: Renewal, closed: boolean): void {
  const T = TONES[L.tone];
  const sk = skinOf(L.tone, r);
  const s = r.skora;
  // the head's volume: light from the upper left, the edges turning away
  headPath(ctx, g);
  ctx.fillStyle = radial(ctx, -3.6, g.cy - 4.5, 19, [[0, sk.light], [0.42, sk.base], [0.85, mix(sk.base, sk.shade, 0.55)], [1, sk.shade]]);
  ctx.fill();
  ctx.save();
  headPath(ctx, g);
  ctx.clip();
  ctx.fillStyle = radial(ctx, -1.2, g.cy + 0.5, 13.5, [[0, rgba(sk.shade, 0)], [0.72, rgba(sk.shade, 0.06)], [1, rgba(sk.shade, 0.42)]]);
  ctx.fillRect(-12, g.cy - 15, 24, 30);
  // colour: the cheeks warm with the blood, the redness and the blemishes of tired skin
  const cy = g.cy + g.feat;
  for (const sd of [-1, 1]) spot(ctx, T.blush, sd * 5.3, cy + 4.3 - 0.6 * r.usmiech, 3.7, 2.6, T.blushA * r.kolor * (sd < 0 ? 1 : 0.85));
  const red = T.redA * (1 - s);
  for (const [x, y, rx, ry] of [[-5.7, 3.8, 3.1, 2.3], [5.9, 3.6, 2.9, 2.2], [-1.7, 5.0, 1.4, 1.0], [1.7, 5.0, 1.4, 1.0], [0.6, 11.0, 2.2, 1.3], [-2.4, -7.4, 2.2, 1.5]] as const) spot(ctx, T.red, x, cy + y, rx, ry, red);
  // the dull tired skin, a little uneven
  spot(ctx, T.sallow, 3.5, cy - 2, 6, 5, 0.12 * (1 - s));
  // the skin's sheen once renewed: forehead, cheekbones, the bridge, the chin
  const sheen = (L.tone === 3 ? 0.3 : 0.24) * s;
  spot(ctx, '#fff1e4', -2.6, cy - 7.4, 3.8, 2.4, sheen);
  spot(ctx, '#fff1e4', -5.6, cy + 1.6, 2.4, 1.5, sheen * 0.9);
  spot(ctx, '#fff1e4', 5.6, cy + 1.6, 2.0, 1.3, sheen * 0.45);
  spot(ctx, '#fff1e4', -0.3, cy + 2.4, 0.8, 2.4, sheen * 0.8);
  spot(ctx, '#fff1e4', -0.4, cy + 11.6, 1.6, 0.9, sheen * 0.7);
  ctx.restore();
  // the features
  brows(ctx, g, HAIR[`${L.sex}${L.tone}`], r);
  for (const sd of [-1, 1]) eye(ctx, sd * 3.9, cy + 0.3, sd, r, T, sk, closed);
  nose(ctx, g, T, sk);
  mouth(ctx, g, r, T, sk, closed);
  // blemishes: small, soft, a little raised
  const b = 1 - s;
  if (b > 0.02) {
    for (const [x, y, rad] of BLEMISH) {
      ctx.fillStyle = rgba(T.red, 0.42 * b);
      ctx.beginPath();
      ctx.arc(x, cy + y, rad, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.18 * b);
      ctx.beginPath();
      ctx.arc(x - rad * 0.3, cy + y - rad * 0.3, rad * 0.35, 0, TAU);
      ctx.fill();
    }
  }
}

// ── the hair ──────────────────────────────────────────────────────
function hairColor(H: Hair, r: Renewal): { c: string; hi: string; a: number } {
  const dull = 1 - r.wlosy;
  return { c: mix(H.color, '#77716c', 0.24 * dull), hi: mix(H.hi, '#8f8a86', 0.4 * dull), a: 0.94 + 0.06 * r.wlosy };
}

/** The hair behind the head and shoulders. */
function hairBack(ctx: CanvasRenderingContext2D, g: Geo, H: Hair, r: Renewal): void {
  const { c, a } = hairColor(H, r);
  const v = 0.9 + 0.1 * r.wlosy;
  const cy = g.cy;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, cy - 13);
  ctx.scale(v, v);
  ctx.translate(0, -(cy - 13));
  if (H.style === 'bob') {
    ctx.fillStyle = radial(ctx, -3, cy - 8, 20, [[0, mix(c, '#ffffff', 0.08)], [0.6, c], [1, mix(c, '#000000', 0.35)]]);
    ctx.beginPath();
    ctx.moveTo(0, cy - 15.4);
    ctx.bezierCurveTo(9, cy - 15.6, 12.6, cy - 8, 12.4, cy + 1);
    ctx.bezierCurveTo(12.4, cy + 7, 13.2, cy + 11, 14.4, cy + 13.6);
    ctx.quadraticCurveTo(10, cy + 15, 7.5, cy + 11);
    ctx.lineTo(-7.5, cy + 11);
    ctx.quadraticCurveTo(-10, cy + 15, -14.4, cy + 13.6);
    ctx.bezierCurveTo(-13.2, cy + 11, -12.4, cy + 7, -12.4, cy + 1);
    ctx.bezierCurveTo(-12.6, cy - 8, -9, cy - 15.6, 0, cy - 15.4);
    ctx.closePath();
    ctx.fill();
  } else if (H.style === 'long') {
    const bot = g.sy + 22;
    ctx.fillStyle = radial(ctx, -3, cy - 6, 34, [[0, mix(c, '#ffffff', 0.06)], [0.55, c], [1, mix(c, '#000000', 0.4)]]);
    ctx.beginPath();
    ctx.moveTo(0, cy - 15.2);
    ctx.bezierCurveTo(9.5, cy - 15.4, 12.4, cy - 7, 12.2, cy + 3);
    ctx.bezierCurveTo(12.4, g.sy - 2, 13.2, g.sy + 10, 12, bot);
    ctx.quadraticCurveTo(0, bot + 3, -12, bot);
    ctx.bezierCurveTo(-13.2, g.sy + 10, -12.4, g.sy - 2, -12.2, cy + 3);
    ctx.bezierCurveTo(-12.4, cy - 7, -9.5, cy - 15.4, 0, cy - 15.2);
    ctx.closePath();
    ctx.fill();
  } else if (H.style === 'curls') {
    const R = 13.6;
    ctx.fillStyle = radial(ctx, -4, cy - 9, 22, [[0, mix(c, '#ffffff', 0.08)], [0.6, c], [1, mix(c, '#000000', 0.3)]]);
    ctx.beginPath();
    ctx.ellipse(0, cy - 4.5, R, R * 0.98, 0, 0, TAU);
    ctx.fill();
    // the cloud's soft bumpy edge
    for (let i = 0; i < 22; i++) {
      const t = (i / 22) * TAU;
      const x = Math.cos(t) * R * 0.97, y = cy - 4.5 + Math.sin(t) * R * 0.95;
      if (y > cy + 7) continue;
      ctx.beginPath();
      ctx.arc(x, y, 2.1 + 0.5 * Math.sin(i * 2.3), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The hair over the head: the fringe, the parting, the short cuts, the beard, and the sheen. */
function hairFront(ctx: CanvasRenderingContext2D, g: Geo, H: Hair, r: Renewal): void {
  const { c, hi, a } = hairColor(H, r);
  const cy = g.cy;
  const h = r.wlosy;
  ctx.save();
  ctx.globalAlpha = a;
  const fill = radial(ctx, -3, cy - 10, 16, [[0, mix(c, '#ffffff', 0.1)], [0.65, c], [1, mix(c, '#000000', 0.3)]]);
  ctx.fillStyle = fill;
  ctx.beginPath();
  switch (H.style) {
    case 'bob':
      ctx.moveTo(-2.6, cy - 14.6);
      ctx.bezierCurveTo(4, cy - 15.6, 10.6, cy - 11, 10.4, cy - 3.6);
      ctx.bezierCurveTo(9.4, cy - 7.2, 6, cy - 9.4, 1.2, cy - 9.2);
      ctx.bezierCurveTo(-3, cy - 9.2, -6.6, cy - 7.6, -9.4, cy - 3);
      ctx.quadraticCurveTo(-9.6, cy + 1, -10.2, cy + 4);
      ctx.bezierCurveTo(-11.8, cy - 2, -11.4, cy - 12, -2.6, cy - 14.6);
      break;
    case 'long': {
      // a centre parting; the hair frames the face, and one wide lock falls over the lit shoulder
      ctx.moveTo(0, cy - 14.2);
      ctx.bezierCurveTo(5.4, cy - 14.4, 9.8, cy - 10.6, 9.8, cy - 3);
      ctx.bezierCurveTo(10, cy + 4, 9.6, cy + 9, 8.6, cy + 12.4);
      ctx.bezierCurveTo(8.2, cy + 7, 8, cy - 1, 6.6, cy - 6.6);
      ctx.bezierCurveTo(5.2, cy - 10, 2.6, cy - 12, 0, cy - 12.6);
      ctx.bezierCurveTo(-2.6, cy - 12, -5.2, cy - 10, -6.6, cy - 6.6);
      ctx.bezierCurveTo(-7.8, cy - 3, -8.2, cy + 4, -7.6, cy + 11);
      ctx.bezierCurveTo(-7.2, g.sy - 2, -6.2, g.sy + 6, -7.4, g.sy + 16);
      ctx.bezierCurveTo(-8.2, g.sy + 22, -10.6, g.sy + 25.6, -13.2, g.sy + 24);
      ctx.bezierCurveTo(-15.4, g.sy + 20, -16, g.sy + 8, -14.6, g.sy + 1);
      ctx.bezierCurveTo(-12.4, g.sy - 6, -10.2, cy + 5, -9.8, cy - 3);
      ctx.bezierCurveTo(-9.8, cy - 10.6, -5.4, cy - 14.4, 0, cy - 14.2);
      break;
    }
    case 'curls':
      ctx.moveTo(-9.6, cy - 1);
      ctx.bezierCurveTo(-10.2, cy - 8, -6.4, cy - 11, 0, cy - 11);
      ctx.bezierCurveTo(6.4, cy - 11, 10.2, cy - 8, 9.6, cy - 1);
      ctx.bezierCurveTo(12.6, cy - 6, 11.4, cy - 15.4, 0, cy - 15.6);
      ctx.bezierCurveTo(-11.4, cy - 15.4, -12.6, cy - 6, -9.6, cy - 1);
      break;
    default: {
      // the short cuts: close to the skull, a hairline over the forehead and short sideburns
      const top = H.style === 'beard' ? 14.0 : H.style === 'stubble' ? 15.0 : 14.8;
      ctx.moveTo(-g.hw - 0.3, cy + 1.6);
      ctx.bezierCurveTo(-g.hw - 0.9, cy - 6, -g.hw * 0.75, cy - top, 0, cy - top);
      ctx.bezierCurveTo(g.hw * 0.75, cy - top, g.hw + 0.9, cy - 6, g.hw + 0.3, cy + 1.6);
      ctx.lineTo(g.hw - 0.6, cy + 1.4);
      ctx.bezierCurveTo(g.hw - 0.4, cy - 3.4, g.hw - 1, cy - 6.4, 7.6, cy - 8.2);
      ctx.bezierCurveTo(5, cy - 10.2, 1, cy - 10.4, -2.4, cy - 9.8);
      ctx.bezierCurveTo(-5.6, cy - 9.2, -8, cy - 7.6, -g.hw + 0.8, cy - 5.6);
      ctx.bezierCurveTo(-g.hw + 0.3, cy - 3, -g.hw + 0.5, cy - 0.6, -g.hw + 0.6, cy + 1.4);
      break;
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(c, 0.35);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // curls' and waves' texture; the sheen of healthy hair; a few strays when tired
  ctx.lineCap = 'round';
  if (H.style === 'curls') {
    ctx.strokeStyle = rgba(hi, 0.22 + 0.3 * h);
    ctx.lineWidth = 0.45;
    for (let i = 0; i < 34; i++) {
      const t = (i / 34) * TAU, rr2 = 8 + 4.5 * ((i * 7) % 5) / 5;
      const x = Math.cos(t) * rr2, y = cy - 5 + Math.sin(t) * rr2 * 0.95;
      if (y > cy + 6 || (Math.abs(x) < 8.5 && y > cy - 10)) continue;
      ctx.beginPath();
      ctx.arc(x, y, 0.9, t, t + Math.PI * 1.2);
      ctx.stroke();
    }
  }
  if (H.style === 'stubble' || H.style === 'beard') {
    // the jaw's shadow of a beard, and a short trimmed one
    ctx.globalAlpha = a * (H.style === 'beard' ? 0.88 : 0.26);
    ctx.fillStyle = c;
    ctx.beginPath();
    const jy = cy + 8.6 + g.feat * 0.5;
    ctx.moveTo(-g.hw + 0.4, cy + 1.6);
    ctx.bezierCurveTo(-g.hw + 0.2, cy + 6, -8.2, jy, -6.4, cy + 11.4);
    ctx.bezierCurveTo(-4.4, cy + 14.4, 4.4, cy + 14.4, 6.4, cy + 11.4);
    ctx.bezierCurveTo(8.2, jy, g.hw - 0.2, cy + 6, g.hw - 0.4, cy + 1.6);
    ctx.lineTo(g.hw - 1.6, cy + 2);
    ctx.bezierCurveTo(g.hw - 2, cy + 7, 4.8, cy + 9.4, 3.2, cy + 10.6);
    ctx.quadraticCurveTo(0, cy + 11.6, -3.2, cy + 10.6);
    ctx.bezierCurveTo(-4.8, cy + 9.4, -g.hw + 2, cy + 7, -g.hw + 1.6, cy + 2);
    ctx.closePath();
    ctx.fill();
    // the moustache
    const my = cy + 7.6 + g.feat;
    ctx.beginPath();
    ctx.moveTo(-3, my + 0.6);
    ctx.quadraticCurveTo(0, my - 1.1, 3, my + 0.6);
    ctx.quadraticCurveTo(0, my - 0.2, -3, my + 0.6);
    ctx.fill();
    ctx.globalAlpha = a;
  }
  // the sheen along the crown (healthy hair reflects light in a soft band)
  if (h > 0.02) {
    ctx.strokeStyle = rgba(hi, 0.3 * h);
    ctx.lineWidth = H.style === 'curls' ? 1.8 : 1.5;
    const R = H.style === 'curls' ? 11.2 : H.style === 'bob' || H.style === 'long' ? 11.4 : 10.2;
    for (const [k, w] of [[0, 1], [0.9, 0.6]] as const) {
      ctx.globalAlpha = a * w;
      ctx.beginPath();
      ctx.arc(-0.5, cy - 3 + k, R - k, -Math.PI * 0.86, -Math.PI * 0.52);
      ctx.stroke();
    }
    ctx.globalAlpha = a;
  }
  const stray = 1 - h;
  if (stray > 0.05 && H.style !== 'beard') {
    // a few fine flyaways close to the head (tired hair), never long
    ctx.strokeStyle = rgba(mix(c, '#9a948e', 0.3), 0.32 * stray);
    ctx.lineWidth = 0.13;
    const sp: readonly [number, number, number, number, number, number][] = [[-5.6, -14.2, -7.4, -16, -8.8, -15.6], [3.2, -14.8, 4.2, -16.4, 5.8, -16.6], [8.6, -10.8, 10.4, -12.2, 11.4, -11.8], [-9.6, -8.6, -11.4, -9.6, -12.2, -9]];
    for (const [x0, y0, x1, y1, x2, y2] of sp) {
      ctx.beginPath();
      ctx.moveTo(x0, cy + y0);
      ctx.quadraticCurveTo(x1, cy + y1, x2, cy + y2);
      ctx.stroke();
    }
  }
  // strands: fine lines along the hair's fall (a painter's few strokes), lighter with health
  if (H.style === 'bob' || H.style === 'long') {
    ctx.lineWidth = 0.22;
    for (let i = 0; i < 12; i++) {
      const sd = i % 2 ? 1 : -1, j = Math.floor(i / 2);
      const x0 = sd * (1 + j * 1.4), x1 = sd * (7.5 + j * 0.8);
      const y1 = H.style === 'long' ? cy + 4 + j * 1.5 : cy - 2 + j * 1.4;
      ctx.strokeStyle = rgba(j % 2 ? hi : mix(c, '#000000', 0.35), (j % 2 ? 0.16 + 0.22 * h : 0.22));
      ctx.beginPath();
      ctx.moveTo(x0, cy - 13.6 + j * 0.3);
      ctx.quadraticCurveTo(sd * (6 + j), cy - 12 + j * 0.4, x1 + sd * 1.4, y1);
      ctx.stroke();
    }
  }
  // thin hair: the scalp shows through at the parting
  if (stray > 0.05 && (H.style === 'bob' || H.style === 'long' || H.style === 'short')) {
    ctx.strokeStyle = rgba('#d7b8a0', 0.22 * stray);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    const px = H.style === 'long' ? 0 : -2.6;
    ctx.moveTo(px, cy - 14.4);
    ctx.lineTo(px + 0.6, cy - 10.6);
    ctx.stroke();
  }
  ctx.restore();
}

// ── the body ──────────────────────────────────────────────────────
function neck(ctx: CanvasRenderingContext2D, g: Geo, sk: ReturnType<typeof skinOf>, T: Tone): void {
  const top = g.cy + 9, nw = g.sex === 'f' ? 3.7 : 4.5, bw = g.sex === 'f' ? 5.4 : 6.6;
  ctx.fillStyle = ctx.createLinearGradient(-bw, 0, bw, 0);
  (ctx.fillStyle as CanvasGradient).addColorStop(0, sk.base);
  (ctx.fillStyle as CanvasGradient).addColorStop(1, mix(sk.base, sk.shade, 0.6));
  ctx.beginPath();
  ctx.moveTo(-nw, top);
  ctx.lineTo(nw, top);
  ctx.quadraticCurveTo(nw + 0.2, g.sy - 4, bw + 4, g.sy + 1);
  ctx.lineTo(-bw - 4, g.sy + 1);
  ctx.quadraticCurveTo(-nw - 0.2, g.sy - 4, -nw, top);
  ctx.closePath();
  ctx.fill();
  // the chin's shadow on the neck
  spot(ctx, T.shade, 0.6, g.cy + 13.6, 6.4, 2.6, 0.55);
}

function torso(ctx: CanvasRenderingContext2D, g: Geo, sk: ReturnType<typeof skinOf>, T: Tone, r: Renewal): void {
  const C = CLOTH[g.sex];
  const { sy, sx } = g;
  const f = g.sex === 'f';
  const waist = f ? 14.2 : 16.8, hip = f ? 19.4 : 18.2, wy = sy + 33, hy = sy + 52;
  const sl = 1 - r.postawa;
  // the neckline's skin (a soft scoop or a crew), the collarbones when upright
  const nl = f ? 7 : 5.4, nd = f ? 8.2 + 1 * sl : 2.6;
  ctx.fillStyle = sk.base;
  ctx.beginPath();
  ctx.moveTo(-nl - 2, sy - 0.8);
  ctx.lineTo(nl + 2, sy - 0.8);
  ctx.lineTo(nl, sy + nd + 2);
  ctx.lineTo(-nl, sy + nd + 2);
  ctx.closePath();
  ctx.fill();
  if (f) {
    ctx.strokeStyle = rgba(T.shade, 0.25 + 0.15 * r.postawa);
    ctx.lineWidth = 0.45;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 1.6, sy + 2.2);
      ctx.quadraticCurveTo(s * 4.4, sy + 1.2 + 0.6 * sl, s * 7.6, sy + 1.6);
      ctx.stroke();
    }
  }
  // the garment: shoulders round and rise when the posture opens
  const grad = ctx.createLinearGradient(-sx, 0, sx, 0);
  grad.addColorStop(0, C.hi);
  grad.addColorStop(0.42, C.c);
  grad.addColorStop(1, C.lo);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-nl, sy - 0.6);
  ctx.quadraticCurveTo(0, sy + nd * 2 - 0.6, nl, sy - 0.6);
  ctx.bezierCurveTo(sx * 0.55, sy - 2.6 + 1.6 * sl, sx - 3, sy - 0.6 + 1.6 * sl, sx - 0.4, sy + 4.6);
  ctx.bezierCurveTo(sx + 0.6, sy + 8, sx - 0.6, sy + 16, sx - 3, sy + 22);
  ctx.bezierCurveTo(waist + 1.2, wy - 6, waist - 0.3, wy, waist, wy);
  ctx.bezierCurveTo(waist + 1, wy + 7, hip, hy - 7, hip, hy);
  ctx.lineTo(hip + 0.6, 70);
  ctx.lineTo(-hip - 0.6, 70);
  ctx.lineTo(-hip, hy);
  ctx.bezierCurveTo(-hip, hy - 7, -waist - 1, wy + 7, -waist, wy);
  ctx.bezierCurveTo(-waist + 0.3, wy, -waist - 1.2, wy - 6, -sx + 3, sy + 22);
  ctx.bezierCurveTo(-sx + 0.6, sy + 16, -sx - 0.6, sy + 8, -sx + 0.4, sy + 4.6);
  ctx.bezierCurveTo(-sx + 3, sy - 0.6 + 1.6 * sl, -sx * 0.55, sy - 2.6 + 1.6 * sl, -nl, sy - 0.6);
  ctx.closePath();
  ctx.fill();
  // soft folds: under the chest, the waist; the hollow of a slumped chest
  ctx.save();
  ctx.clip();
  spot(ctx, C.lo, 0, sy + 22 + 2 * sl, 15, 4 + 3 * sl, 0.35 + 0.25 * sl);
  spot(ctx, C.hi, -sx * 0.45, sy + 11, 9, 7, 0.25 + 0.15 * r.postawa);
  if (f) for (const s2 of [-1, 1]) spot(ctx, C.hi, s2 * 7 - 1.5, sy + 13 - 1.5 * sl, 6, 5, (s2 < 0 ? 0.22 : 0.08) * (0.6 + 0.4 * r.postawa));
  spot(ctx, C.lo, 0, wy + 4, 12, 3, 0.3);
  ctx.strokeStyle = rgba(C.lo, 0.35);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-waist + 2, wy + 2 + 2 * sl);
  ctx.quadraticCurveTo(0, wy + 5 + 3 * sl, waist - 2, wy + 2 + 2 * sl);
  ctx.stroke();
  ctx.restore();
  // a crew neck's rim
  if (!f) {
    ctx.strokeStyle = rgba(C.lo, 0.8);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-nl, sy - 0.4);
    ctx.quadraticCurveTo(0, sy + nd * 2 + 0.2, nl, sy - 0.4);
    ctx.stroke();
  }
}

function arms(ctx: CanvasRenderingContext2D, g: Geo, sk: ReturnType<typeof skinOf>, T: Tone): void {
  const C = CLOTH[g.sex];
  const f = g.sex === 'f';
  const wUp = f ? 7.6 : 9, wLo = f ? 6.2 : 7.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of [-1, 1]) {
    // mirrored: the left arm keeps its x, the right takes −x
    const pts = g.arm.map(([x, y]) => [s < 0 ? x : -x, y] as const);
    // the sleeve: a tube, lit on the left
    ctx.strokeStyle = s < 0 ? mix(C.c, C.hi, 0.35) : mix(C.c, C.lo, 0.45);
    ctx.lineWidth = wUp;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.quadraticCurveTo(pts[1][0] + s * 0.6, pts[1][1] - 12, pts[1][0], pts[1][1]);
    ctx.stroke();
    ctx.lineWidth = wLo;
    ctx.beginPath();
    ctx.moveTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1] - 2);
    ctx.stroke();
    // the light along the sleeve's outer side
    ctx.strokeStyle = rgba(C.hi, s < 0 ? 0.55 : 0.18);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + s * wUp * 0.38, pts[0][1] + 2);
    ctx.quadraticCurveTo(pts[1][0] + s * wUp * 0.42, pts[1][1] - 12, pts[1][0] + s * wLo * 0.42, pts[1][1]);
    ctx.lineTo(pts[2][0] + s * wLo * 0.4, pts[2][1] - 3);
    ctx.stroke();
    // the cuff, and the hand: relaxed, fingers together
    ctx.strokeStyle = rgba(C.lo, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pts[2][0] - wLo / 2, pts[2][1] - 2.5);
    ctx.lineTo(pts[2][0] + wLo / 2, pts[2][1] - 2.5);
    ctx.stroke();
    const hx = pts[3][0], hy = pts[3][1];
    ctx.fillStyle = radial(ctx, hx + s * -1, hy - 6, 9, [[0, sk.base], [1, mix(sk.base, sk.shade, s < 0 ? 0.35 : 0.6)]]);
    ctx.beginPath();
    ctx.moveTo(pts[2][0] - 2.6, pts[2][1] - 2);
    ctx.bezierCurveTo(pts[2][0] - 3.6, hy - 8, hx - 3, hy - 2, hx - 0.8, hy + 0.8);
    ctx.quadraticCurveTo(hx + 1.4, hy + 1.6, hx + 2.6, hy - 1.4);
    ctx.bezierCurveTo(hx + 3.4, hy - 7, pts[2][0] + 3.4, pts[2][1] + 3, pts[2][0] + 2.6, pts[2][1] - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(T.shade, 0.35);
    ctx.lineWidth = 0.3;
    for (const k of [-0.9, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(hx + k, hy - 6);
      ctx.lineTo(hx + k * 1.1, hy - 0.2);
      ctx.stroke();
    }
  }
}

// ── the whole person ──────────────────────────────────────────────
export interface PaintOpts {
  /** the eyes closed (sleep) */
  closed?: boolean;
  /** the night's blue light over the person */
  night?: boolean;
}

/** Paint the person in world units under the context's transform. */
export function paintFigure(ctx: CanvasRenderingContext2D, look: string, r: Renewal, o: PaintOpts = {}): void {
  const L = lookOf(look);
  const H = HAIR[`${L.sex}${L.tone}`];
  const g = geoOf(L.sex, r.postawa);
  const T = TONES[L.tone];
  const sk = skinOf(L.tone, r);
  const head = (fn: () => void): void => {
    ctx.save();
    ctx.translate(0, g.cy + 13);
    ctx.scale(HEAD_K, HEAD_K);
    ctx.translate(0, -(g.cy + 13));
    fn();
    ctx.restore();
  };
  head(() => hairBack(ctx, g, H, r));
  neck(ctx, g, sk, T);
  torso(ctx, g, sk, T, r);
  arms(ctx, g, sk, T);
  // where the arms meet the body: a soft shade
  for (const s of [-1, 1]) spot(ctx, CLOTH[L.sex].lo, s * (g.sx - 6), g.sy + 20, 2.6, 12, 0.35);
  head(() => {
    if (L.sex === 'm' || H.style === 'curls') ears(ctx, g, sk);
    face(ctx, g, L, r, !!o.closed);
    hairFront(ctx, g, H, r);
  });
}

/** the head is drawn a little larger than life (a portrait's warmth; the face reads on a phone) */
export const HEAD_K = 1.12;

/**
 * The grey cast and the night's light, laid over what is painted on a layer (source-atop: only the person takes it).
 */
export function castOver(ctx: CanvasRenderingContext2D, r: Renewal, night: boolean, box: { x: number; y: number; w: number; h: number }): void {
  const cast = 0.24 * (1 - (0.5 * r.kolor + 0.5 * overall(r)));
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const lit = ctx.createLinearGradient(box.x, box.y, box.x + box.w * 0.9, box.y + box.h * 0.7);
  lit.addColorStop(0, 'rgba(255,240,220,.1)');
  lit.addColorStop(0.45, 'rgba(255,240,220,0)');
  lit.addColorStop(1, 'rgba(14,8,30,.22)');
  ctx.fillStyle = lit;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  if (cast > 0.004) {
    ctx.fillStyle = `rgba(128,138,152,${cast.toFixed(3)})`;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  if (night) {
    ctx.fillStyle = 'rgba(30,36,86,.42)';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    const gr = ctx.createLinearGradient(box.x, 0, box.x + box.w, 0);
    gr.addColorStop(0, 'rgba(170,190,255,.16)');
    gr.addColorStop(0.5, 'rgba(170,190,255,0)');
    gr.addColorStop(1, 'rgba(10,8,30,.25)');
    ctx.fillStyle = gr;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.restore();
}

// ── the cache ─────────────────────────────────────────────────────
/** the person's box in world units (the curls and the long hair inside it) */
export const FIG_BOX = { x: -62, y: -112, w: 124, h: 182 } as const;
/** the head and shoulders, kept sharper for a close view */
export const HEAD_BOX = { x: -30, y: -112, w: 60, h: 64 } as const;
const STEPS = 24;
const MAX_BODY = 7;
const MAX_HEAD = 14;

interface Entry { key: string; c: HTMLCanvasElement }

/** Quantise a renewal (so a slowly growing arc paints the person again only every 1/24 of a parameter). */
export function quant(r: Renewal): Renewal {
  const out = { ...r };
  for (const p of PARAMS) out[p] = Math.round(r[p] * STEPS) / STEPS;
  return out;
}

const keyOf = (r: Renewal): string => PARAMS.map(p => Math.round(r[p] * STEPS)).join('.');

/** The device px per world unit of a context's transform (3 where a fake context has none). */
export function scaleOf(ctx: CanvasRenderingContext2D): number {
  const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  const s = m ? Math.hypot(m.a, m.b) : 3;
  return Number.isFinite(s) && s > 0 ? s : 3;
}

export class FigureCache {
  private readonly list: Entry[] = [];
  /** painted this frame already (a new renewal paints the body now and the sharp head the next frame) */
  private painted = false;
  private lastHead: HTMLCanvasElement | null = null;

  /** Draw the person (from a layer painted once per look, renewal, light and scale bucket). */
  draw(ctx: CanvasRenderingContext2D, look: string, r: Renewal, o: PaintOpts = {}): void {
    const q = quant(r);
    const s = scaleOf(ctx);
    const tag = `${look}|${keyOf(q)}|${o.closed ? 1 : 0}${o.night ? 1 : 0}`;
    this.painted = false;
    const body = this.get(`b|${tag}`, FIG_BOX, Math.min(MAX_BODY, bucket(s)), look, q, o, true);
    if (!body) {
      // no offscreen canvas here (a test): paint straight onto the context
      paintFigure(ctx, look, q, o);
      return;
    }
    ctx.drawImage(body, FIG_BOX.x, FIG_BOX.y, FIG_BOX.w, FIG_BOX.h);
    if (s > MAX_BODY * 1.15) {
      // a close view: the head and shoulders from a sharper layer (painted a frame later than the body, so one frame
      // never paints both; meanwhile the last one stands in)
      const head = this.get(`h|${tag}`, HEAD_BOX, Math.min(MAX_HEAD, bucket(s)), look, q, o, !this.painted) ?? this.lastHead;
      if (head) {
        ctx.drawImage(head, HEAD_BOX.x, HEAD_BOX.y, HEAD_BOX.w, HEAD_BOX.h);
        this.lastHead = head;
      }
    }
  }

  private get(key0: string, box: typeof FIG_BOX | typeof HEAD_BOX, sc: number, look: string, r: Renewal, o: PaintOpts, may: boolean): HTMLCanvasElement | null {
    const key = `${key0}|${sc}`;
    const hit = this.list.find(e => e.key === key);
    if (hit) return hit.c;
    if (!may) return null;
    const L = layer(box.w * sc, box.h * sc, 1);
    if (!L) return null;
    const c = L.ctx;
    c.setTransform(sc, 0, 0, sc, -box.x * sc, -box.y * sc);
    paintFigure(c, look, r, o);
    castOver(c, r, !!o.night, box);
    this.list.unshift({ key, c: L.c });
    if (this.list.length > 8) this.list.length = 8;
    this.painted = true;
    return L.c;
  }
}

/** A scale bucket: half-octave steps, so a camera's glide paints again only now and then. */
function bucket(s: number): number {
  return Math.max(1, Math.pow(2, Math.ceil(Math.log2(s) * 2) / 2));
}

export { clamp };
