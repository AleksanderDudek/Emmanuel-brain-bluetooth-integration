/**
 * The two hands of Światło w dłoniach: open, palms toward the one who prays, as you see your own held up in front of
 * the chest — the thumbs out to the sides, the fingers up and a little apart, the light between the palms.  One hand
 * (the viewer's left) is built once as a single smooth outline in its own units (L = 1 from the wrist crease to the
 * middle finger's root; x toward the other hand, y down): up the little finger's side of the palm, round each finger in
 * turn with a soft valley between them, down the index finger, round the thumb, down the mound of the thumb to the
 * wrist and the forearm, off the screen.  The right hand is the same outline mirrored through a transform, so a breath,
 * a lean or the rub costs nothing to rebuild.
 *
 * The drawing keeps the series' rim of light (kit/figure.ts): the outline stroked as a glow first, the hand filled over
 * it (only the outer half of the glow stays, a rim), then the ball's light on the palm (clipped to the hand) and the
 * faint creases of the fingers, so the palm side reads.
 */
import { spline, type P } from '../kit/figure';
import { RIM, RIM_HI, SKIN, rgba } from './paint';

interface Finger { base: P; tip: P; w0: number; w1: number }

/** The fingers of the left hand, from the little finger to the index (the order the outline walks them), and the thumb. */
const FINGERS: readonly Finger[] = [
  { base: [0.31, -0.8], tip: [0.45, -1.4], w0: 0.165, w1: 0.13 },
  { base: [0.13, -0.92], tip: [0.21, -1.7], w0: 0.19, w1: 0.15 },
  { base: [-0.07, -0.96], tip: [-0.08, -1.82], w0: 0.2, w1: 0.158 },
  { base: [-0.27, -0.9], tip: [-0.37, -1.66], w0: 0.19, w1: 0.15 },
];
const THUMB: Finger = { base: [-0.37, -0.3], tip: [-0.75, -0.86], w0: 0.25, w1: 0.17 };

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const norm = (v: P): P => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

/** A finger's frame: the point at s (0 base … 1 tip) on its axis, its width there, its direction and its right normal. */
function frame(f: Finger, s: number): { p: P; w: number; d: P; n: P } {
  const d = norm(sub(f.tip, f.base));
  return { p: [f.base[0] + (f.tip[0] - f.base[0]) * s, f.base[1] + (f.tip[1] - f.base[1]) * s], w: f.w0 + (f.w1 - f.w0) * s, d, n: [-d[1], d[0]] };
}

/** One finger's part of the outline: up its right side from `from`, round the tip, down its left side to `to`. */
function fingerLoop(f: Finger, from: number, to: number): P[] {
  const out: P[] = [];
  const side = (s: number, k: 1 | -1): P => { const q = frame(f, s); return [q.p[0] + k * q.n[0] * q.w / 2, q.p[1] + k * q.n[1] * q.w / 2]; };
  for (const s of [from, (from + 0.92) / 2, 0.92]) out.push(side(s, 1));
  const end = frame(f, 0.92);
  const r = end.w / 2;
  const a0 = Math.atan2(end.n[1], end.n[0]);
  // round the tip, from the right side over the end to the left side
  for (let i = 1; i < 6; i++) {
    const a = a0 - (i / 6) * Math.PI;
    out.push([end.p[0] + Math.cos(a) * r + end.d[0] * r * 0.35 * Math.sin((i / 6) * Math.PI), end.p[1] + Math.sin(a) * r + end.d[1] * r * 0.35 * Math.sin((i / 6) * Math.PI)]);
  }
  for (const s of [0.92, (to + 0.92) / 2, to]) out.push(side(s, -1));
  return out;
}

/** The whole outline of the left hand and its forearm (hand units). */
function outline(): P[] {
  const pts: P[] = [[0.36, 0.02], [0.43, -0.28], [0.45, -0.58]];
  FINGERS.forEach((f, i) => {
    pts.push(...fingerLoop(f, i === 0 ? 0.1 : 0, 0));
    const next = FINGERS[i + 1];
    if (next) {
      // the soft valley between two fingers, a little above their roots
      const a = frame(f, 0), b = frame(next, 0);
      const l: P = [a.p[0] - a.n[0] * a.w / 2, a.p[1] - a.n[1] * a.w / 2];
      const r: P = [b.p[0] + b.n[0] * b.w / 2, b.p[1] + b.n[1] * b.w / 2];
      pts.push([(l[0] + r[0]) / 2, (l[1] + r[1]) / 2 + 0.035]);
    }
  });
  // down the index finger's side to the web of the thumb, round the thumb, down its mound to the wrist
  pts.push([-0.43, -0.76], [-0.47, -0.6]);
  pts.push(...fingerLoop(THUMB, 0.42, 0.05));
  pts.push([-0.45, -0.16], [-0.39, 0.02]);
  // the forearm, down and off the screen
  pts.push([-0.42, 0.6], [-0.47, 1.4], [-0.52, 2.6], [0.52, 2.6], [0.47, 1.4], [0.41, 0.6]);
  return pts;
}

export interface HandGeo {
  /** the hand's outline (one closed path) */
  path: Path2D;
  /** the creases across the fingers (the palm side) */
  creases: Path2D;
  /** the fingertips (little to index, then the thumb), in hand units */
  tips: P[];
}

let geo: HandGeo | null | undefined;

const id = (x: number, y: number): [number, number] => [x, y];

/** The hand's geometry, built once (null where the canvas has no Path2D: tests). */
export function handGeo(): HandGeo | null {
  if (geo !== undefined) return geo;
  if (typeof Path2D === 'undefined') return (geo = null);
  const path = new Path2D();
  spline(path, outline(), id, true);
  const creases = new Path2D();
  for (const f of [...FINGERS, THUMB]) {
    for (const s of f === THUMB ? [0.62] : [0.36, 0.66]) {
      const q = frame(f, s);
      const half = q.w * 0.36;
      creases.moveTo(q.p[0] - q.n[0] * half, q.p[1] - q.n[1] * half);
      creases.quadraticCurveTo(q.p[0] + q.d[0] * q.w * 0.12, q.p[1] + q.d[1] * q.w * 0.12, q.p[0] + q.n[0] * half, q.p[1] + q.n[1] * half);
    }
  }
  const tips = [...FINGERS, THUMB].map(f => { const q = frame(f, 0.98); return q.p; });
  geo = { path, creases, tips };
  return geo;
}

/** How far the hand reaches toward the other one (hand units, at its widest: the palm), and away (the thumb). */
export const HAND_IN = 0.46;
export const HAND_OUT = 0.86;
/** The hand from the wrist to the middle fingertip (hand units). */
export const HAND_H = 1.9;

/** Where a hand is: its wrist (px), its size L (px), its lean toward the other hand (rad), and which side. */
export interface HandPose { x: number; y: number; L: number; tilt: number; side: 1 | -1 }

/** A point of a hand (hand units) on the screen. */
export function handPt(pose: HandPose, p: P): { x: number; y: number } {
  const lx = p[0] * pose.side, ly = p[1];
  // the left hand (side 1) leans clockwise (its fingers toward the middle); the right one mirrors it
  const a = pose.tilt * pose.side;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: pose.x + (lx * c - ly * s) * pose.L, y: pose.y + (lx * s + ly * c) * pose.L };
}

/** The ball's light on a hand: where it is (px), how large, how bright, its colour. */
export interface HandLight { x: number; y: number; r: number; a: number; color: string }

/**
 * Draw one hand.  `warm` (0..1) is the rub's warmth (the skin a little lighter, the rim brighter); `rim` scales the rim
 * of light (the series' look), `light` is the ball's glow on the palm.
 */
export function drawHand(ctx: CanvasRenderingContext2D, pose: HandPose, light: HandLight | null, warm = 0, rim = 1): void {
  const g = handGeo();
  if (!g) return;
  const { L } = pose;
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.tilt * pose.side);
  ctx.scale(L * pose.side, L);
  const px = (v: number) => v / L;
  // the rim of light: a wide soft glow and a fine bright line (the fill covers their inner halves)
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  const glowA = (0.08 + 0.06 * warm) * rim;
  ctx.strokeStyle = rgba(RIM, glowA);
  ctx.lineWidth = px(18);
  ctx.stroke(g.path);
  ctx.strokeStyle = rgba(RIM, glowA * 1.8);
  ctx.lineWidth = px(8);
  ctx.stroke(g.path);
  ctx.strokeStyle = rgba(RIM_HI, (0.62 + 0.25 * warm) * rim);
  ctx.lineWidth = px(2.4);
  ctx.stroke(g.path);
  ctx.globalCompositeOperation = 'source-over';
  // the skin in the dark: a little warmer toward the fingertips, darker down the forearm
  const sk = ctx.createLinearGradient(0, -1.9, 0, 2.2);
  sk.addColorStop(0, warm > 0 ? mixHex(SKIN[1], '#7a4a2a', warm) : SKIN[1]);
  sk.addColorStop(0.42, SKIN[0]);
  sk.addColorStop(0.62, '#21130a');
  sk.addColorStop(1, '#0d0704');
  ctx.fillStyle = sk;
  ctx.fill(g.path);
  ctx.save();
  ctx.clip(g.path);
  ctx.globalCompositeOperation = 'lighter';
  // a soft sheen on the palm's mounds, so the hand has a body
  const sheen = ctx.createRadialGradient(-0.05, -0.55, 0, -0.05, -0.55, 0.75);
  sheen.addColorStop(0, rgba('#ffcf9a', 0.1 + 0.08 * warm));
  sheen.addColorStop(1, rgba('#ffcf9a', 0));
  ctx.fillStyle = sheen;
  ctx.fillRect(-1, -1.4, 2, 1.8);
  // the ball's light on the palm and the inner fingers
  if (light && light.a > 0.01) {
    const dx = light.x - pose.x, dy = light.y - pose.y, a = -pose.tilt * pose.side;
    const c = Math.cos(a), s = Math.sin(a);
    const lx = ((dx * c - dy * s) / L) * pose.side, ly = (dx * s + dy * c) / L;
    const rr = Math.max(0.3, (light.r * 3.6) / L);
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, rr);
    lg.addColorStop(0, rgba(light.color, 0.62 * light.a));
    lg.addColorStop(0.45, rgba(light.color, 0.22 * light.a));
    lg.addColorStop(1, rgba(light.color, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(lx - rr, ly - rr, 2 * rr, 2 * rr);
  }
  ctx.restore();
  // the creases of the fingers (the palm side)
  ctx.strokeStyle = rgba(RIM, 0.22 + 0.1 * warm);
  ctx.lineWidth = px(1.1);
  ctx.lineCap = 'round';
  ctx.stroke(g.creases);
  ctx.restore();
}

function mixHex(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * Math.max(0, Math.min(1, k)));
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}

/** The fingertips of a hand on the screen (little to index, then the thumb). */
export function tipsOf(pose: HandPose): { x: number; y: number }[] {
  const g = handGeo();
  return g ? g.tips.map(p => handPt(pose, p)) : [];
}

/** A small open hand (the hand laid on a place of the small figure), palm toward us, centred at (x, y), size s (px). */
export function drawSmallHand(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a: number): void {
  const g = handGeo();
  if (!g || a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(s, s);
  // centred on the palm, the forearm clipped away below the wrist
  ctx.translate(0, 0.75);
  ctx.beginPath();
  ctx.rect(-1.2, -2.1, 2.4, 2.12);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(RIM, 0.28);
  ctx.lineWidth = 6 / s;
  ctx.stroke(g.path);
  ctx.strokeStyle = rgba(RIM_HI, 0.9);
  ctx.lineWidth = 1.4 / s;
  ctx.stroke(g.path);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(70,40,20,0.55)';
  ctx.fill(g.path);
  ctx.restore();
}
