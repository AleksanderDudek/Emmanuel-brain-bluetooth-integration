/**
 * Rozkwit's person for „Wszystko naraz” (DESIGN.md §29): Nowe siły's person (sily/figure.ts — the same faces, hair,
 * skin tones and clothes, the same six parameters of `Renewal`) seen whole, standing, head to feet.
 *
 *   front   Nowe siły's own head, neck, torso and arms (imported, unchanged), with what a whole figure adds here: the
 *           legs, a midi dress's skirt or trousers, the shoes, a soft shadow on the ground; the head a little less
 *           enlarged than in Nowe siły's portraits (HK), so the whole figure keeps a natural seven and a half heads
 *   side    painted here in the same palette, facing the low sun (the viewer's left): a profile that goes from an
 *           everyday slump — the head forward and down, the upper back rounded, the chest sunk, the pelvis pushed
 *           forward — to an easy upright line (ear, shoulder, hip and ankle over one another); the face, the hair in
 *           each of the six styles, the dress or the shirt and trousers, one arm hanging
 *
 * What changes is what the founder named and the section may picture (§24.3): posture, colour, the rested face, the
 * hair's fullness and sheen, a quiet smile — never the body's shape (no slimming, no measurements: Lekkość i siła's
 * care, §24.11).  The person is painted once per look, view and (quantised) renewal into an offscreen layer; a frame
 * only composes it (a close view of the face takes a sharper layer of the head and shoulders).
 *
 * Units: Nowe siły's (the eye line ≈ −90, the shoulders ≈ −64, the midline x = 0) and the soles at FEET.
 */
import { layer, mix, rgba, TAU } from '../kit/healthlib/paint';
import {
  CLOTH, HAIR, TONES, arms, castOver, ears, face, geoOf, hairBack, hairColor, hairFront, lookOf, neck, radial, scaleOf, skinOf, spot, torso,
  type Geo, type Hair, type Sex, type Tone,
} from '../sily/figure';
import { PARAMS, type Renewal } from '../sily/renew';

/** the soles' line (world units) */
export const FEET = 92;
/** the head's scale over life size, anchored at the chin (Nowe siły's portraits take 1.12) */
export const HK = 1.04;
/** where a woman's skirt ends (just below the knee) */
const HEM = 56;

type Skin = ReturnType<typeof skinOf>;

/** The trousers, the shoes and a woman's legs: colours that sit with Nowe siły's clothes. */
const TROUSERS = { c: '#3b3646', hi: '#5c5468', lo: '#24202c' };
const SHOES: Readonly<Record<Sex, { c: string; hi: string }>> = { f: { c: '#7a4044', hi: '#b06a66' }, m: { c: '#3d2a20', hi: '#6e5240' } };

const clamp = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
type P2 = readonly [number, number];
const lp = (a: P2, b: P2, k: number): [number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

/** A closed smooth path through points (a Catmull-Rom spline as Béziers). */
function blob(ctx: CanvasRenderingContext2D | Path2D, pts: readonly P2[], close = true): void {
  const n = pts.length;
  if (n < 2) return;
  const at = (i: number): P2 => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (close) ctx.closePath();
}

function hGrad(ctx: CanvasRenderingContext2D, x0: number, x1: number, stops: readonly [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

// ── the front ─────────────────────────────────────────────────────
/** The front figure's geometry: Nowe siły's, from the posture. */
export const frontGeo = (sex: Sex, posture: number): Geo => geoOf(sex, posture);

/** A soft shadow on the ground under the feet. */
function groundShadow(ctx: CanvasRenderingContext2D, w: number): void {
  spot(ctx, '#140a1e', 0, FEET + 0.4, w, 2.6, 0.55);
}

/** A woman's legs below the skirt (skin), lit from the left. */
function legsF(ctx: CanvasRenderingContext2D, sk: Skin, T: Tone, tone: number): void {
  for (const s of [-1, 1]) {
    const c = s * 5.1;
    // outer and inner edges from the hem down to the ankle (half-widths from the leg's middle)
    const outer: P2[] = [[c + s * 4.3, HEM - 2], [c + s * 4.8, 62], [c + s * 3.9, 71], [c + s * 2.6, 81], [c + s * 2.3, 86.5]];
    const inner: P2[] = [[c - s * 2.3, 86.5], [c - s * 1.9, 81], [c - s * 2.9, 71], [c - s * 3.6, 62], [c - s * 3.3, HEM - 2]];
    ctx.fillStyle = hGrad(ctx, c - 5, c + 5, s < 0 ? [[0, sk.light], [0.45, sk.base], [1, mix(sk.base, sk.shade, 0.5)]] : [[0, sk.base], [0.6, mix(sk.base, sk.shade, 0.35)], [1, sk.shade]]);
    ctx.beginPath();
    ctx.moveTo(outer[0][0], outer[0][1]);
    for (let i = 1; i < outer.length; i++) {
      const [x0, y0] = outer[i - 1], [x1, y1] = outer[i];
      ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.5 + s * 0.4, (y0 + y1) / 2, x1, y1);
    }
    for (const [x, y] of inner) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
    // a toned shin catches the light (with the renewal)
    spot(ctx, sk.light, c - 0.8, 68, 1.1, 8, 0.25 + 0.3 * tone);
    spot(ctx, T.shade, c + s * 2.6, 66, 1.4, 7, 0.22);
  }
}

/** A man's trousers from the waist to the ankles. */
function trousers(ctx: CanvasRenderingContext2D, g: Geo): void {
  const wy = g.sy + 33;
  const P = new Path2D();
  P.moveTo(-16.6, wy);
  P.bezierCurveTo(-18.4, wy + 8, -18.6, wy + 22, -17.4, 8);
  P.bezierCurveTo(-15.6, 26, -12.6, 40, -11.8, 50);
  P.lineTo(-10.6, 87);
  P.lineTo(-2.0, 87);
  P.lineTo(-1.5, 50);
  P.bezierCurveTo(-1.2, 30, -0.9, 12, 0, 3.2);
  P.bezierCurveTo(0.9, 12, 1.2, 30, 1.5, 50);
  P.lineTo(2.0, 87);
  P.lineTo(10.6, 87);
  P.lineTo(11.8, 50);
  P.bezierCurveTo(12.6, 40, 15.6, 26, 17.4, 8);
  P.bezierCurveTo(18.6, wy + 22, 18.4, wy + 8, 16.6, wy);
  P.closePath();
  ctx.fillStyle = hGrad(ctx, -18, 18, [[0, TROUSERS.hi], [0.38, TROUSERS.c], [1, TROUSERS.lo]]);
  ctx.fill(P);
  ctx.save();
  ctx.clip(P);
  // the crease down each leg and a soft shade between the legs
  ctx.strokeStyle = rgba('#8a8098', 0.22);
  ctx.lineWidth = 0.35;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 7.6, 6);
    ctx.quadraticCurveTo(s * 7.0, 46, s * 6.4, 86);
    ctx.stroke();
  }
  spot(ctx, TROUSERS.lo, 0, 20, 3, 18, 0.5);
  spot(ctx, TROUSERS.lo, 10, 60, 4, 26, 0.3);
  ctx.restore();
}

/** The shoes, seen from the front: soft rounded shapes, a little turned out. */
function shoesFront(ctx: CanvasRenderingContext2D, sex: Sex): void {
  const S = SHOES[sex];
  const f = sex === 'f';
  for (const s of [-1, 1]) {
    const c = s * (f ? 5.4 : 6.4), w = f ? 2.7 : 3.7;
    ctx.fillStyle = radial(ctx, c - 1, 87.6, 5, [[0, S.hi], [1, S.c]]);
    ctx.beginPath();
    ctx.moveTo(c - w, 86.4);
    ctx.quadraticCurveTo(c, 85.4, c + w, 86.4);
    ctx.quadraticCurveTo(c + w + 0.9 + s * 0.4, 90.6, c + s * 0.8 + w * 0.6, FEET);
    ctx.lineTo(c + s * 0.8 - w * 0.6, FEET);
    ctx.quadraticCurveTo(c - w - 0.9 + s * 0.4, 90.6, c - w, 86.4);
    ctx.closePath();
    ctx.fill();
  }
}

/** A woman's skirt from the waist to just below the knee (the dress's colour, the torso's gradient). */
function skirt(ctx: CanvasRenderingContext2D, g: Geo): void {
  const C = CLOTH.f;
  const wy = g.sy + 33, hy = g.sy + 52;
  const P = new Path2D();
  P.moveTo(-14.2, wy);
  P.bezierCurveTo(-17.6, wy + 7, -19.6, hy - 4, -19.6, hy);
  P.bezierCurveTo(-20.4, hy + 22, -22.6, HEM - 14, -23.2, HEM);
  P.quadraticCurveTo(-12, HEM + 1.8, 0, HEM + 1.2);
  P.quadraticCurveTo(12, HEM + 1.8, 23.2, HEM);
  P.bezierCurveTo(22.6, HEM - 14, 20.4, hy + 22, 19.6, hy);
  P.bezierCurveTo(19.6, hy - 4, 17.6, wy + 7, 14.2, wy);
  P.closePath();
  ctx.fillStyle = hGrad(ctx, -g.sx, g.sx, [[0, C.hi], [0.42, C.c], [1, C.lo]]);
  ctx.fill(P);
  ctx.save();
  ctx.clip(P);
  // soft folds falling from the hips
  for (const [x, a] of [[-11, 0.2], [-4, 0.14], [5, 0.22], [13, 0.3]] as const) spot(ctx, C.lo, x, HEM - 14, 2.2, 16, a);
  for (const [x, a] of [[-15, 0.22], [-7.5, 0.16], [1, 0.1]] as const) spot(ctx, C.hi, x, HEM - 16, 1.6, 14, a);
  ctx.restore();
}

/**
 * The arms of a whole figure: Nowe siły's reach the hips (its pictures end there); standing whole, the hands hang to
 * the middle of the thigh.
 */
export function armsOf(g: Geo, posture: number): Geo {
  const sl = 1 - clamp(posture);
  const { sx, sy } = g;
  const arm: [number, number][] = [
    [-(sx - 3.6), sy + 4.5],
    [-(sx + 0.6 - 1.4 * sl), sy + 35],
    [-(sx - 1.0 - 2.6 * sl), sy + 67],
    [-(sx - 1.6 - 3.2 * sl), sy + 83],
  ];
  return { ...g, arm };
}

/** Paint the whole person from the front in world units under the context's transform. */
export function paintFront(ctx: CanvasRenderingContext2D, look: string, r: Renewal): void {
  const L = lookOf(look);
  const H = HAIR[`${L.sex}${L.tone}`];
  const g = geoOf(L.sex, r.postawa);
  const T = TONES[L.tone];
  const sk = skinOf(L.tone, r);
  const f = L.sex === 'f';
  const head = (fn: () => void): void => {
    ctx.save();
    ctx.translate(0, g.cy + 13);
    ctx.scale(HK, HK);
    ctx.translate(0, -(g.cy + 13));
    fn();
    ctx.restore();
  };
  groundShadow(ctx, f ? 16 : 18);
  if (f) legsF(ctx, sk, T, r.postawa);
  else trousers(ctx, g);
  shoesFront(ctx, L.sex);
  if (f) skirt(ctx, g);
  head(() => hairBack(ctx, g, H, r));
  neck(ctx, g, sk, T);
  // Nowe siły's torso runs on below the hips (its pictures end there): here the dress meets the skirt at the hips and
  // a shirt ends over the trousers in a soft curve
  ctx.save();
  ctx.beginPath();
  const hem = f ? g.sy + 54 : -5.5;
  ctx.moveTo(-40, -130);
  ctx.lineTo(40, -130);
  ctx.lineTo(40, hem);
  ctx.quadraticCurveTo(0, hem + (f ? 0 : 1.8), -40, hem);
  ctx.closePath();
  ctx.clip();
  torso(ctx, g, sk, T, r);
  ctx.restore();
  if (!f) {
    spot(ctx, TROUSERS.lo, 0, hem + 1.4, 17, 1.6, 0.55);
    ctx.strokeStyle = rgba(CLOTH.m.lo, 0.9);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-17.6, hem - 0.4);
    ctx.quadraticCurveTo(0, hem + 1.4, 17.6, hem - 0.4);
    ctx.stroke();
  }
  arms(ctx, armsOf(g, r.postawa), sk, T);
  for (const s of [-1, 1]) spot(ctx, CLOTH[L.sex].lo, s * (g.sx - 6), g.sy + 20, 2.6, 12, 0.35);
  // toned forearms catch the light with the renewal
  for (const s of [-1, 1]) {
    const a = armsOf(g, r.postawa).arm;
    const x = (s < 0 ? a[2][0] : -a[2][0]) + (s < 0 ? -1 : 1) * 0.4;
    spot(ctx, sk.light, x, a[3][1] - 6, 0.8, 2.4, 0.12 + 0.22 * r.postawa);
  }
  head(() => {
    if (L.sex === 'm' || H.style === 'curls') ears(ctx, g, sk);
    face(ctx, g, L, r, false);
    hairFront(ctx, g, H, r);
  });
}

// ── the side ──────────────────────────────────────────────────────
/** The profile's key points for a posture (0 slumped … 1 upright), facing the viewer's left. */
export interface SidePose {
  head: [number, number];
  tilt: number;
  neckBack: [number, number]; c7: [number, number]; scap: [number, number]; midBack: [number, number]; lumbar: [number, number];
  sacrum: [number, number]; glute: [number, number]; fold: [number, number];
  throat: [number, number]; notch: [number, number]; chest: [number, number]; bust: [number, number]; underBust: [number, number];
  waist: [number, number]; belly: [number, number]; groin: [number, number];
  shoulder: [number, number]; elbow: [number, number]; wrist: [number, number]; hand: [number, number];
  hip: [number, number]; knee: [number, number]; ankle: [number, number];
}

type Pose = Record<Exclude<keyof SidePose, 'tilt'>, P2> & { tilt: number };
/** upright: ear, shoulder, hip, a little ahead of the knee and the ankle on one line (x ≈ 0) */
const UP: Pose = {
  head: [-1.6, -91], tilt: 0,
  neckBack: [5.4, -78.5], c7: [6.2, -70], scap: [8.8, -58], midBack: [7.6, -45], lumbar: [5.4, -30], sacrum: [7.4, -15], glute: [9.4, -5], fold: [7.0, 6],
  throat: [-4.6, -76.5], notch: [-5.2, -69.5], chest: [-8.2, -59], bust: [-9.6, -50.5], underBust: [-7.4, -43.5], waist: [-5.8, -30], belly: [-6.4, -14], groin: [-7.2, 2],
  shoulder: [0.6, -64.5], elbow: [1.4, -36], wrist: [-0.2, -10], hand: [-0.6, 6],
  hip: [0.4, -2], knee: [0.2, 46], ankle: [1.4, 86],
};
/** slumped: the head forward and down, the upper back rounded, the chest sunk, the pelvis pushed forward */
const SLUMP: Pose = {
  head: [-8.2, -86.8], tilt: 0.2,
  neckBack: [1.2, -76.4], c7: [5.0, -67.0], scap: [11.8, -55.4], midBack: [9.4, -42.6], lumbar: [4.2, -28], sacrum: [5.8, -14], glute: [7.4, -4], fold: [5.6, 7],
  throat: [-7.2, -72.8], notch: [-4.0, -66.0], chest: [-5.8, -56.0], bust: [-7.2, -47.6], underBust: [-5.8, -41.2], waist: [-7.2, -27.6], belly: [-9.4, -13], groin: [-9.4, 2],
  shoulder: [-3.4, -61.4], elbow: [-1.4, -34.6], wrist: [-3.8, -8.6], hand: [-4.4, 7.4],
  hip: [-2.2, -1], knee: [1.0, 46], ankle: [1.4, 86],
};

export function sidePose(sex: Sex, posture: number): SidePose {
  const k = clamp(posture);
  const out = {} as SidePose;
  for (const key of Object.keys(UP) as (keyof Pose)[]) {
    if (key === 'tilt') out.tilt = lerp(SLUMP.tilt, UP.tilt, k);
    else (out as unknown as Record<string, [number, number]>)[key] = lp(SLUMP[key] as P2, UP[key] as P2, k);
  }
  // a man's chest is flatter, his back a little broader
  if (sex === 'm') {
    out.bust = [out.bust[0] + 1.3, out.bust[1] - 0.6];
    out.scap = [out.scap[0] + 0.6, out.scap[1]];
  }
  return out;
}

/** The profile head's outline in its own units (facing left; the eye line at y = 0). */
function sideHeadPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  // the skull and the face's profile wound the same way (their union, not a hole where they overlap)
  ctx.ellipse(2.2, -2, 11.2, 12.6, 0, 0, TAU, true);
  ctx.moveTo(-5.4, -11.6);
  blob(ctx, [
    [-5.4, -11.6], [-8.6, -8.2], [-9.6, -4.4], [-9.9, -2.6], [-9.3, -0.8], [-10.6, 1.6], [-12.4, 3.9], [-11.6, 4.8], [-10.3, 5.1],
    [-10.4, 6.0], [-10.9, 6.9], [-10.2, 7.7], [-10.6, 8.6], [-9.7, 9.8], [-9.9, 11.6], [-8.6, 13.3], [-5.2, 13.9], [-1.0, 12.8], [3.6, 9.6], [4.8, 4.2], [3.2, -4.6],
  ]);
}

/** The hair seen from the side, behind the head (long hair, the back of a bob, curls). */
function sideHairBack(ctx: CanvasRenderingContext2D, H: Hair, r: Renewal): void {
  const { c, a } = hairColor(H, r);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = radial(ctx, -2, -10, 26, [[0, mix(c, '#ffffff', 0.1)], [0.6, c], [1, mix(c, '#000000', 0.35)]]);
  ctx.beginPath();
  switch (H.style) {
    case 'long':
      blob(ctx, [[-5, -13.6], [3, -16], [12, -11], [14.6, -2], [14.2, 10], [13.4, 24], [12.4, 36], [9.4, 41], [6.2, 36], [5.2, 22], [4.6, 12], [5, 2]]);
      break;
    case 'bob':
      blob(ctx, [[-5, -13.6], [3, -16.2], [12.4, -11.6], [14.6, -2], [13.8, 7], [11.6, 12.8], [8, 13.6], [6, 9], [5.2, 2]]);
      break;
    case 'curls':
      for (let i = 0; i < 20; i++) {
        const t = -2.4 + (i / 19) * 3.6;
        const x = 3.6 + Math.cos(t) * 12.4, y = -3 + Math.sin(t) * 12.6;
        ctx.moveTo(x + 3.2, y);
        ctx.arc(x, y, 3.2 + 0.5 * Math.sin(i * 2.1), 0, TAU);
      }
      ctx.moveTo(15, -3);
      ctx.ellipse(3.6, -3, 12, 12.2, 0, 0, TAU);
      break;
    default:
      break;
  }
  ctx.fill();
  ctx.restore();
}

/** The hair over the head from the side: the cut, the fringe, a beard; its sheen with health. */
function sideHairFront(ctx: CanvasRenderingContext2D, H: Hair, r: Renewal): void {
  const { c, hi, a } = hairColor(H, r);
  const h = r.wlosy;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = radial(ctx, -1, -12, 18, [[0, mix(c, '#ffffff', 0.12)], [0.62, c], [1, mix(c, '#000000', 0.3)]]);
  ctx.beginPath();
  switch (H.style) {
    case 'bob':
    case 'long':
      // a fringe swept to the side, the hair over the temple and the ear
      blob(ctx, [[-7.6, -10.8], [-4, -15.2], [4, -16.4], [11.6, -12.6], [13.6, -4], [10, 2.4], [6.4, 6.8], [4.4, 4], [3.6, -2.4], [-1.6, -5.6], [-6.6, -5.8], [-9.2, -7.6]]);
      break;
    case 'curls':
      for (let i = 0; i < 9; i++) {
        const x = -7 + i * 2.2, y = -13.6 + Math.abs(i - 3) * 0.5 - (i > 5 ? (i - 5) * -1.2 : 0);
        ctx.moveTo(x + 2.6, y);
        ctx.arc(x, y, 2.6, 0, TAU);
      }
      ctx.moveTo(-6.4, -9);
      blob(ctx, [[-6.6, -9], [-2, -13.6], [6, -13.2], [9.6, -6], [7, 2], [4, 0.4], [1, -6], [-4, -7.4]]);
      break;
    default: {
      // the short cuts: close to the skull, the hairline and a short sideburn before the ear
      const top = H.style === 'beard' ? -14.4 : -15.2;
      blob(ctx, [[-7.8, -9.6], [-3.6, top + 0.8], [3.6, top], [11.4, -11.2], [13.6, -3.4], [12.4, 4.2], [9.6, 8.4], [7.2, 7.2], [5.6, 0.2], [1.6, 1.0], [0.4, 3.6], [-0.6, 2.6], [-0.4, -2.4], [-3.6, -6.4]]);
      break;
    }
  }
  ctx.fill();
  if (H.style === 'stubble' || H.style === 'beard') {
    ctx.globalAlpha = a * (H.style === 'beard' ? 0.9 : 0.28);
    ctx.fillStyle = c;
    ctx.beginPath();
    blob(ctx, [[0.6, 2.4], [1.6, 7.6], [-1.2, 12.0], [-5.2, 14.4], [-9.0, 13.8], [-10.4, 11.4], [-10.0, 9.4], [-8.2, 10.6], [-5.8, 11.0], [-3.0, 9.6], [-1.2, 6.4], [-0.6, 3.2]]);
    ctx.fill();
    // the moustache
    ctx.beginPath();
    blob(ctx, [[-10.6, 5.4], [-8.0, 5.2], [-6.6, 6.6], [-8.8, 6.8], [-10.8, 6.6]]);
    ctx.fill();
    ctx.globalAlpha = a;
  }
  // the sheen of healthy hair: a soft band along the crown
  if (h > 0.02) {
    ctx.strokeStyle = rgba(hi, 0.34 * h);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(2.4, -2, 11.6, -Math.PI * 0.86, -Math.PI * 0.42);
    ctx.stroke();
    ctx.globalAlpha = a * 0.55;
    ctx.beginPath();
    ctx.arc(2.4, -1.2, 10.6, -Math.PI * 0.8, -Math.PI * 0.5);
    ctx.stroke();
    ctx.globalAlpha = a;
  }
  // strands along a long fall
  if (H.style === 'long' || H.style === 'bob') {
    ctx.lineWidth = 0.22;
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = rgba(i % 2 ? hi : mix(c, '#000000', 0.35), i % 2 ? 0.14 + 0.24 * h : 0.22);
      ctx.beginPath();
      ctx.moveTo(-2 + i * 1.8, -15 + Math.abs(i - 3) * 0.3);
      ctx.quadraticCurveTo(9 + i * 0.4, -8 + i, H.style === 'long' ? 10.6 + i * 0.3 : 9.6 + i * 0.4, H.style === 'long' ? 22 + i * 2 : 6 + i);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The face's features from the side: the eye, the brow, the ear, the lips, the colour and the sheen. */
function sideFace(ctx: CanvasRenderingContext2D, H: Hair, L: { sex: Sex; tone: 1 | 2 | 3 }, r: Renewal, T: Tone, sk: Skin): void {
  const e = r.oczy, m = r.usmiech;
  // volume: the light on the face, the shade behind the cheek
  ctx.save();
  sideHeadPath(ctx);
  ctx.clip();
  ctx.fillStyle = radial(ctx, 2, 0, 15, [[0, rgba(sk.shade, 0)], [0.6, rgba(sk.shade, 0.08)], [1, rgba(sk.shade, 0.4)]]);
  ctx.fillRect(-14, -16, 30, 32);
  spot(ctx, T.blush, -5.4, 4.6 - 0.4 * m, 3.4, 2.4, T.blushA * r.kolor);
  spot(ctx, T.red, -5.6, 4.4, 3, 2.2, T.redA * 0.8 * (1 - r.skora));
  const sheen = (L.tone === 3 ? 0.3 : 0.24) * r.skora;
  spot(ctx, '#fff1e4', -6.8, 2.2, 2.4, 1.4, sheen);
  spot(ctx, '#fff1e4', -8.2, -7.2, 2.4, 1.8, sheen * 0.9);
  spot(ctx, '#fff1e4', -10.4, 1.8, 0.8, 1.6, sheen * 0.8);
  spot(ctx, T.under, -6.4, 2.0, 2.2, 0.9, 0.45 * (1 - e));
  ctx.restore();
  // the ear (a bob or long hair covers it, as in Nowe siły's portraits)
  if (L.sex === 'm' || H.style === 'curls') {
  ctx.fillStyle = mix(sk.base, sk.shade, 0.2);
  ctx.beginPath();
  ctx.ellipse(2.8, 1.6, 2.1, 3.4, 0.12, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(sk.shade, 0.55);
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.ellipse(3.0, 1.6, 1.1, 2.3, 0.12, -Math.PI * 0.6, Math.PI * 0.7);
  ctx.stroke();
  }
  // the eye: a small open wedge, the iris at its front; the lid lifts with rest
  const ex = -6.9, ey = 0.1;
  const lid = 0.35 + 0.5 * (1 - e);
  ctx.fillStyle = mix('#f2ece6', '#e6b4aa', 0.5 * (1 - e));
  ctx.beginPath();
  ctx.moveTo(ex - 1.6, ey - 0.2);
  ctx.quadraticCurveTo(ex, ey - 1.3 + lid, ex + 1.3, ey + 0.1);
  ctx.quadraticCurveTo(ex - 0.2, ey + 0.9, ex - 1.6, ey - 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = T.iris;
  ctx.beginPath();
  ctx.ellipse(ex - 0.9, ey, 0.6, 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0c0706';
  ctx.beginPath();
  ctx.ellipse(ex - 1.15, ey, 0.25, 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = `rgba(255,255,255,${(0.2 + 0.6 * e).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(ex - 1.1, ey - 0.3, 0.14 + 0.06 * e, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(28,16,14,.8)';
  ctx.lineWidth = 0.32;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ex - 1.7, ey - 0.25);
  ctx.quadraticCurveTo(ex, ey - 1.3 + lid, ex + 1.4, ey + 0.1);
  ctx.stroke();
  ctx.strokeStyle = rgba(T.shade, 0.4);
  ctx.lineWidth = 0.24;
  ctx.beginPath();
  ctx.moveTo(ex - 1.4, ey - 1.2);
  ctx.quadraticCurveTo(ex, ey - 2.2 + 0.3 * (1 - e), ex + 1.4, ey - 0.8);
  ctx.stroke();
  // the brow
  ctx.strokeStyle = rgba(mix(H.color, '#7a6a60', 0.2 * (1 - r.wlosy)), 0.78);
  ctx.lineWidth = L.sex === 'f' ? 0.6 : 0.85;
  ctx.beginPath();
  ctx.moveTo(-9.2, -3.1 + 0.3 * (1 - e));
  ctx.quadraticCurveTo(-7, -4.3, -4.4, -3.8);
  ctx.stroke();
  // the nostril
  ctx.strokeStyle = rgba('#3a1a14', 0.5);
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-11.2, 4.5);
  ctx.quadraticCurveTo(-10.2, 3.6, -9.6, 4.6);
  ctx.stroke();
  // the lips and, with the smile, the corner lifting
  ctx.fillStyle = sk.lip;
  ctx.beginPath();
  blob(ctx, [[-10.9, 6.8], [-10.0, 6.4], [-8.9, 7.4 - 0.5 * m], [-10.0, 8.9], [-10.7, 8.5], [-10.2, 7.7]]);
  ctx.fill();
  ctx.strokeStyle = rgba(mix(T.shade, '#200c0a', 0.5), 0.6);
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(-10.3, 7.7);
  ctx.quadraticCurveTo(-9.4, 7.9, -8.5, 7.3 - 0.7 * m);
  ctx.stroke();
  if (m > 0.3) {
    ctx.strokeStyle = rgba(T.shade, 0.18 * m);
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(-8.4, 4.4);
    ctx.quadraticCurveTo(-7.6, 6.2, -8.0, 7.8);
    ctx.stroke();
  }
}

/** Paint the whole person from the side (facing the viewer's left) in world units. */
export function paintSide(ctx: CanvasRenderingContext2D, look: string, r: Renewal): void {
  const L = lookOf(look);
  const H = HAIR[`${L.sex}${L.tone}`];
  const T = TONES[L.tone];
  const sk = skinOf(L.tone, r);
  const f = L.sex === 'f';
  const C = CLOTH[L.sex];
  const p = sidePose(L.sex, r.postawa);
  const { hip, knee, ankle } = p;
  groundShadow(ctx, 12);
  // ── the legs (the far one a step behind, in shade) ──
  const leg = (dx: number): Path2D => {
    const P = new Path2D();
    blob(P, [
      [p.fold[0] + dx, p.fold[1]], [hip[0] + 6.4 + dx, 22], [knee[0] + 4.6 + dx, 44], [knee[0] + 6.4 + dx, 57], [ankle[0] + 2.8 + dx, 79],
      [ankle[0] + 3.2 + dx, 88], [ankle[0] + 2.6 + dx, FEET], [ankle[0] - 9.8 + dx, FEET], [ankle[0] - 11.4 + dx, 90.4], [ankle[0] - 5.6 + dx, 86.6],
      [ankle[0] - 2.4 + dx, 83], [knee[0] - 3.2 + dx, 64], [knee[0] - 4.4 + dx, 46], [hip[0] - 6.8 + dx, 22], [p.groin[0] + dx, p.groin[1]], [hip[0] + dx, -6],
    ]);
    return P;
  };
  const farLeg = leg(1.6), nearLeg = leg(0);
  const legFill = (P: Path2D, far: boolean): void => {
    if (f) ctx.fillStyle = hGrad(ctx, -10, 10, [[0, far ? mix(sk.base, sk.shade, 0.4) : sk.light], [0.5, far ? mix(sk.base, sk.shade, 0.6) : sk.base], [1, sk.shade]]);
    else ctx.fillStyle = hGrad(ctx, -10, 10, [[0, far ? TROUSERS.c : TROUSERS.hi], [0.45, far ? TROUSERS.lo : TROUSERS.c], [1, TROUSERS.lo]]);
    ctx.fill(P);
  };
  legFill(farLeg, true);
  legFill(nearLeg, false);
  // the shoes over the feet
  const S = SHOES[L.sex];
  for (const [dx, far] of [[1.6, true], [0, false]] as const) {
    ctx.fillStyle = far ? mix(S.c, '#000000', 0.3) : hGrad(ctx, ankle[0] - 12, ankle[0] + 4, [[0, S.hi], [1, S.c]]);
    ctx.beginPath();
    blob(ctx, [[ankle[0] - 2.4 + dx, 85.4], [ankle[0] + 3.0 + dx, 86.6], [ankle[0] + 3.2 + dx, FEET], [ankle[0] - 10.4 + dx, FEET], [ankle[0] - 11.8 + dx, 90.6], [ankle[0] - 7.4 + dx, 87.6]]);
    ctx.fill();
  }
  if (f) {
    // the shin catches the light as the body stands strong
    spot(ctx, sk.light, knee[0] - 2.4, 66, 0.9, 7, 0.2 + 0.3 * r.postawa);
  } else {
    ctx.save();
    ctx.clip(nearLeg);
    ctx.strokeStyle = rgba('#8a8098', 0.2);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(hip[0] - 3.2, 8);
    ctx.quadraticCurveTo(knee[0] - 2.2, 46, ankle[0] - 1.2, 84);
    ctx.stroke();
    ctx.restore();
  }
  // ── a woman's skirt ──
  if (f) {
    const hb = p.glute, hf = p.belly;
    ctx.fillStyle = hGrad(ctx, -16, 16, [[0, C.hi], [0.45, C.c], [1, C.lo]]);
    ctx.beginPath();
    blob(ctx, [[p.lumbar[0] + 0.6, -31], [p.sacrum[0] + 1.0, -15], [hb[0] + 1.4, hb[1]], [hb[0] + 3.6, 22], [hb[0] + 5.2, HEM - 1], [hf[0] - 7.6, HEM + 0.6], [hf[0] - 3.6, 24], [hf[0] - 1.2, hf[1]], [p.waist[0] - 0.8, -31]], true);
    ctx.fill();
    for (const [x, a] of [[2, 0.24], [-6, 0.16], [8, 0.3]] as const) spot(ctx, C.lo, x, HEM - 14, 1.8, 15, a);
  }
  // ── the trunk's garment: a dress's bodice or a shirt ──
  const hemY = f ? -28 : -5;
  const backHem: P2 = f ? [p.lumbar[0] + 0.8, hemY] : [p.glute[0] + 0.8, hemY];
  const frontHem: P2 = f ? [p.waist[0] - 0.9, hemY] : [p.belly[0] - 1.2, hemY];
  const trunk = new Path2D();
  blob(trunk, [
    [p.c7[0] - 0.6, p.c7[1] + 0.4], [p.scap[0] + 0.5, p.scap[1]], [p.midBack[0] + 0.6, p.midBack[1]], [p.lumbar[0] + 0.7, p.lumbar[1]],
    ...(f ? [] : [[p.sacrum[0] + 0.8, p.sacrum[1]] as P2]), backHem, frontHem,
    ...(f ? [] : [[p.waist[0] - 0.8, p.waist[1]] as P2]), [p.underBust[0] - 0.4, p.underBust[1]], [p.bust[0] - 0.5, p.bust[1]], [p.chest[0] - 0.4, p.chest[1]],
    [p.notch[0] - 0.3, p.notch[1] + (f ? 2.2 : 0.4)],
  ]);
  ctx.fillStyle = hGrad(ctx, -12, 12, [[0, C.hi], [0.45, C.c], [1, C.lo]]);
  ctx.fill(trunk);
  ctx.save();
  ctx.clip(trunk);
  // the rounded upper back takes shade, the open chest takes light
  const sl = 1 - r.postawa;
  spot(ctx, C.lo, p.scap[0] - 1, p.scap[1] + 2, 4, 9, 0.35 + 0.25 * sl);
  spot(ctx, C.hi, p.bust[0] + 2.4, p.bust[1] - 4, 3.6, 7, 0.22 + 0.18 * r.postawa);
  spot(ctx, C.lo, p.underBust[0] + 2, p.underBust[1] + 3 + 2 * sl, 5, 2.4, 0.2 + 0.3 * sl);
  ctx.restore();
  // ── the neck ──
  const nk = new Path2D();
  blob(nk, [[p.neckBack[0], p.neckBack[1] - 1], [p.c7[0] - 0.4, p.c7[1] + 0.2], [p.notch[0] + 0.6, p.notch[1] + (f ? 2.4 : 0.6)], [p.throat[0], p.throat[1]], [p.throat[0] + 1, p.throat[1] - 4]]);
  ctx.fillStyle = hGrad(ctx, p.throat[0] - 2, p.c7[0] + 2, [[0, sk.base], [1, mix(sk.base, sk.shade, 0.55)]]);
  ctx.fill(nk);
  if (f) {
    // the dress's soft scoop: skin to the neckline
    ctx.fillStyle = sk.base;
    ctx.beginPath();
    blob(ctx, [[p.notch[0] + 0.2, p.notch[1] - 0.6], [p.notch[0] - 0.4, p.notch[1] + 2.6], [p.notch[0] + 3.4, p.notch[1] + 2.0], [p.notch[0] + 3.0, p.notch[1] - 1.4]]);
    ctx.fill();
  }
  // ── the arm, hanging (a sleeve and the hand) ──
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const sh = p.shoulder, el = p.elbow, wr = p.wrist, hd = p.hand;
  ctx.strokeStyle = mix(C.c, C.hi, 0.2);
  ctx.lineWidth = f ? 6.8 : 8;
  ctx.beginPath();
  ctx.moveTo(sh[0], sh[1]);
  ctx.quadraticCurveTo(sh[0] + 1.2, (sh[1] + el[1]) / 2, el[0], el[1]);
  ctx.stroke();
  ctx.lineWidth = f ? 5.6 : 6.6;
  ctx.beginPath();
  ctx.moveTo(el[0], el[1]);
  ctx.lineTo(wr[0], wr[1] - 2.5);
  ctx.stroke();
  ctx.strokeStyle = rgba(C.lo, 0.75);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(sh[0] + 3.2, sh[1] + 3);
  ctx.quadraticCurveTo(sh[0] + 3.6, (sh[1] + el[1]) / 2, el[0] + 3.0, el[1]);
  ctx.lineTo(wr[0] + 2.6, wr[1] - 3);
  ctx.stroke();
  ctx.strokeStyle = rgba(C.hi, 0.5);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(sh[0] - 3, sh[1] + 2);
  ctx.quadraticCurveTo(sh[0] - 2, (sh[1] + el[1]) / 2, el[0] - 2.8, el[1]);
  ctx.lineTo(wr[0] - 2.4, wr[1] - 3);
  ctx.stroke();
  ctx.strokeStyle = rgba(C.lo, 0.9);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(wr[0] - 2.8, wr[1] - 2.6);
  ctx.lineTo(wr[0] + 2.8, wr[1] - 2.2);
  ctx.stroke();
  ctx.fillStyle = radial(ctx, hd[0] - 1, hd[1] - 6, 8, [[0, sk.base], [1, mix(sk.base, sk.shade, 0.45)]]);
  ctx.beginPath();
  blob(ctx, [[wr[0] - 2.4, wr[1] - 2], [wr[0] + 2.4, wr[1] - 1.6], [hd[0] + 2.0, hd[1] - 4], [hd[0] + 0.4, hd[1] + 1], [hd[0] - 1.8, hd[1]], [hd[0] - 2.8, hd[1] - 5]]);
  ctx.fill();
  // ── the head (turned down by the slump around the neck) ──
  ctx.save();
  ctx.translate(p.head[0], p.head[1]);
  ctx.translate(3, 12);
  ctx.rotate(p.tilt);
  ctx.translate(-3, -12);
  ctx.scale(HK, HK);
  sideHeadPath(ctx);
  ctx.fillStyle = radial(ctx, -6, -3, 18, [[0, sk.light], [0.45, sk.base], [0.85, mix(sk.base, sk.shade, 0.5)], [1, sk.shade]]);
  ctx.fill();
  // seen from the side the hair lies over the back of the skull and down the back
  sideHairBack(ctx, H, r);
  sideFace(ctx, H, L, r, T, sk);
  sideHairFront(ctx, H, r);
  ctx.restore();
}

/** Where the profile's spine lies (world units, the sacrum first, up to the neck): the scene draws it as light. */
export function sideSpine(p: SidePose): [number, number][] {
  return [
    [p.sacrum[0] - 3.4, -10], [p.lumbar[0] - 2.8, p.lumbar[1]], [p.midBack[0] - 3.2, p.midBack[1]], [p.scap[0] - 3.6, p.scap[1] - 4],
    [p.c7[0] - 2.6, p.c7[1]], [p.neckBack[0] - 2.4, p.neckBack[1] + 1.4],
  ];
}

// ── the cache ─────────────────────────────────────────────────────
export type View = 'front' | 'side';
/** the person's box in world units (front: the curls and long hair, the shoes; side: the nose and the long hair) */
export const FRONT_BOX = { x: -62, y: -118, w: 124, h: 214 } as const;
export const SIDE_BOX = { x: -34, y: -118, w: 60, h: 214 } as const;
/** the head and shoulders kept sharper for the close view of the face */
export const HEAD_BOX = { x: -30, y: -118, w: 60, h: 66 } as const;
const STEPS = 24;
const MAX_BODY = 7;
const MAX_HEAD = 14;

/** A renewal quantised to 1/24 (so a slowly growing vision paints the person again only now and then). */
export function quant(r: Renewal): Renewal {
  const out = { ...r };
  for (const p of PARAMS) out[p] = Math.round(r[p] * STEPS) / STEPS;
  return out;
}
const keyOf = (r: Renewal): string => PARAMS.map(p => Math.round(r[p] * STEPS)).join('.');
const bucket = (s: number): number => Math.max(1, Math.pow(2, Math.ceil(Math.log2(s) * 2) / 2));

interface Entry { key: string; c: HTMLCanvasElement }

/** The person painted once per look, view, renewal and scale bucket; a frame composes it. */
export class PersonCache {
  private readonly list: Entry[] = [];
  private painted = false;
  private lastHead: HTMLCanvasElement | null = null;
  private fade: readonly [number, number] | null = null;

  /** `fade`: the person fades out between these two heights (world y) — a portrait's close view of the face */
  draw(ctx: CanvasRenderingContext2D, look: string, r: Renewal, view: View, fade?: readonly [number, number]): void {
    const q = quant(r);
    const s = scaleOf(ctx);
    const tag = `${view}|${look}|${keyOf(q)}|${fade ? fade.join(',') : ''}`;
    this.fade = fade ?? null;
    this.painted = false;
    const box = view === 'side' ? SIDE_BOX : FRONT_BOX;
    const body = this.get(`b|${tag}`, box, Math.min(MAX_BODY, bucket(s)), look, q, view, true);
    if (!body) {
      // no offscreen canvas (a test): paint straight onto the context
      if (view === 'side') paintSide(ctx, look, q);
      else paintFront(ctx, look, q);
      return;
    }
    ctx.drawImage(body, box.x, box.y, box.w, box.h);
    if (view === 'front' && s > MAX_BODY * 1.15) {
      const head = this.get(`h|${tag}`, HEAD_BOX, Math.min(MAX_HEAD, bucket(s)), look, q, view, !this.painted) ?? this.lastHead;
      if (head) {
        ctx.drawImage(head, HEAD_BOX.x, HEAD_BOX.y, HEAD_BOX.w, HEAD_BOX.h);
        this.lastHead = head;
      }
    }
  }

  private get(key0: string, box: { x: number; y: number; w: number; h: number }, sc: number, look: string, r: Renewal, view: View, may: boolean): HTMLCanvasElement | null {
    const key = `${key0}|${sc}`;
    const hit = this.list.find(e => e.key === key);
    if (hit) return hit.c;
    if (!may) return null;
    const L = layer(box.w * sc, box.h * sc, 1);
    if (!L) return null;
    const c = L.ctx;
    c.setTransform(sc, 0, 0, sc, -box.x * sc, -box.y * sc);
    if (view === 'side') paintSide(c, look, r);
    else paintFront(c, look, r);
    castOver(c, r, false, box);
    if (this.fade) {
      const [y0, y1] = this.fade;
      c.save();
      c.globalCompositeOperation = 'destination-out';
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = g;
      c.fillRect(box.x, y0, box.w, y1 - y0);
      c.fillStyle = '#000';
      c.fillRect(box.x, y1, box.w, box.y + box.h - y1);
      c.restore();
    }
    this.list.unshift({ key, c: L.c });
    if (this.list.length > 8) this.list.length = 8;
    this.painted = true;
    return L.c;
  }
}
