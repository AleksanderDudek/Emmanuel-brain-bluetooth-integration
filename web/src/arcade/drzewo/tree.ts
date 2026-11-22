/**
 * Drzewo nad wodą's geometry, pure (no canvas), in the figure's own units (kit/figure.ts: H = 1 from the standing
 * figure's crown to its soles; x across, 0 on the midline; y down; the ground line at y = 1):
 *
 *   the soil      from the ground line down `DEPTH` to the hidden stream, cut into the session's layers; stones in
 *                 them (each layer its own count), placed from a seed
 *   the roots     grown from the soles (and from between the feet) down to the stream: main roots that steer round
 *                 the stones toward the water, laterals and rootlets from them — each point with the growth (0..1)
 *                 at which the root reaches it, so a view draws the roots up to the session's root growth
 *   the tree      a trunk of light along the body's midline from the ground to above the head, branches from the
 *                 shoulders and the arms and over the head, a crown of leaves round the head (never over the face)
 *   the fruits    nine places on the crown's arc, from the lower left over the top to the lower right, in
 *                 Galatians' order; a second and a third of a kind beside the first
 *   the seated figure  kit/figure's outline with the upper body lowered (`DROP`), the thighs coming toward the
 *                 viewer (seen short), the lower legs down to the feet; the hands at the knees; a smooth stone seat
 */
import { OUTLINE, footShapes, handShapes, type P } from '../kit/figure';
import type { Posture } from './content';

/** The soil's depth from the ground line to the stream, the stream's band, the rock under it. */
export const DEPTH = 0.62;
export const STREAM_H = 0.07;
export const BOTTOM = 1 + DEPTH + STREAM_H + 0.04;
/** The seated figure's head and shoulders sit this much lower than the standing figure's. */
export const DROP = 0.2;
/** How far the world reaches across (the crown's half-width and a margin). */
export const HALF_W = 0.5;

/** A small seeded random (mulberry32), so a seed gives the same roots every time. */
export function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── the soil ─────────────────────────────────────────────────────

/** The layers' bands: from the ground down to the stream, a little uneven. */
export function layerBands(n: number): { y0: number; y1: number }[] {
  const out: { y0: number; y1: number }[] = [];
  const w = [1.1, 0.95, 1.05, 0.9, 1, 0.95].slice(0, n);
  const sum = w.reduce((a, b) => a + b, 0);
  let y = 1;
  for (const k of w) {
    const h = (DEPTH * k) / sum;
    out.push({ y0: y, y1: y + h });
    y += h;
  }
  return out;
}

export interface Stone { x: number; y: number; rx: number; ry: number; a: number; layer: number }

/** Stones in the layers (counts per unit of width, from content's LAYER), clear of each other and of the soles. */
export function stonesFor(counts: readonly number[], seed: number): Stone[] {
  const r = rand(seed ^ 0x51ed);
  const bands = layerBands(counts.length);
  const out: Stone[] = [];
  bands.forEach((b, li) => {
    const n = Math.round(counts[li] * 2 * HALF_W * 1.4);
    for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
      const rx = 0.018 + r() * (counts[li] > 3 ? 0.03 : 0.045);
      const ry = rx * (0.55 + r() * 0.3);
      const x = -HALF_W * 1.05 + r() * 2.1 * HALF_W;
      const y = b.y0 + ry + 0.006 + r() * Math.max(0.001, b.y1 - b.y0 - 2 * ry - 0.012);
      if (y - 1 < 0.05 && Math.abs(x) < 0.1) continue;
      if (out.some(s => Math.hypot((s.x - x) / (s.rx + rx + 0.012), (s.y - y) / (s.ry + ry + 0.01)) < 1)) continue;
      out.push({ x, y, rx, ry, a: (r() - 0.5) * 0.8, layer: li });
      i++;
    }
  });
  return out;
}

// ── the roots ────────────────────────────────────────────────────

export interface Root {
  pts: P[];
  /** the growth (0..1 of the way to the stream) at which the root reaches each point */
  ts: number[];
  /** its width at the start and at the tip (figure units) */
  w0: number;
  w1: number;
  /** 0 a main root (reaches the stream), 1 a lateral, 2 a rootlet */
  order: 0 | 1 | 2;
}

/** Steer a growing point round the stones: the direction bent along a stone's side when the next step would enter it. */
function steer(x: number, y: number, ang: number, step: number, stones: readonly Stone[], goalX: number): number {
  const nx = x + Math.cos(ang) * step * 2.5, ny = y + Math.sin(ang) * step * 2.5;
  const hit = stones.find(s => Math.hypot((nx - s.x) / (s.rx + 0.012), (ny - s.y) / (s.ry + 0.01)) < 1);
  if (!hit) return ang;
  // the way out from the stone's middle (in the stone's own proportions) and its two tangents
  const ox = (x - hit.x) / (hit.rx + 0.012), oy = (y - hit.y) / (hit.ry + 0.01);
  const toGoal = Math.sign(goalX - x) || 1;
  const score = (tx: number, ty: number) => ty * 2 + toGoal * tx * 0.5;
  const [tx, ty] = score(-oy, ox) >= score(oy, -ox) ? [-oy, ox] : [oy, -ox];
  // along the stone's side, a little away from it; never upward through the soil
  let a = Math.atan2((ty + oy * 0.35) * hit.ry, (tx + ox * 0.35) * hit.rx);
  if (Math.sin(a) < 0.08) a = Math.atan2(0.3, Math.cos(a) >= 0 ? 1 : -1);
  return a;
}

/**
 * The root system for a session: main roots from the soles and between the feet to the stream, laterals and
 * rootlets; deterministic for a seed and the stones.
 */
export function rootsFor(seed: number, stones: readonly Stone[]): Root[] {
  const r = rand(seed);
  const roots: Root[] = [];
  const bottom = 1 + DEPTH + 0.012;
  const step = 0.009;
  const mains: { x: number; goal: number }[] = [
    { x: -0.044, goal: -0.3 - r() * 0.12 },
    { x: 0.044, goal: 0.3 + r() * 0.12 },
    { x: -0.012, goal: -0.1 - r() * 0.07 },
    { x: 0.014, goal: 0.11 + r() * 0.07 },
  ];
  const mainLen: number[] = [];
  for (const m of mains) {
    const pts: P[] = [[m.x, 1.0]];
    const ts: number[] = [0];
    let x = m.x, y = 1.0, ang = Math.PI / 2 + (m.goal - m.x) * 0.8;
    const ph = r() * 6.28, ph2 = r() * 6.28;
    let len = 0;
    for (let i = 0; i < 400 && y < bottom; i++) {
      const toGoal = Math.atan2(bottom - y + 0.25, m.goal - x);
      const wob = 0.35 * Math.sin(i * 0.21 + ph) + 0.22 * Math.sin(i * 0.53 + ph2);
      ang += (toGoal - ang) * 0.16 + wob * 0.1;
      ang = steer(x, y, ang, step, stones, m.goal);
      x += Math.cos(ang) * step;
      y += Math.max(0.0015, Math.sin(ang) * step);
      len += step;
      pts.push([x, y]);
      ts.push(Math.min(1, Math.max(ts[ts.length - 1], (y - 1) / (bottom - 1))));
    }
    ts[ts.length - 1] = 1;
    mainLen.push(len);
    roots.push({ pts, ts, w0: 0.012, w1: 0.0035, order: 0 });
  }
  // laterals from the main roots (out and down), rootlets from them; they grow at the main roots' pace
  const pace = 1 / (mainLen.reduce((a, b) => a + b, 0) / mainLen.length);
  const branchFrom = (parent: Root, order: 1 | 2, every: number, lenMin: number, lenMax: number): void => {
    const pts = parent.pts;
    for (let i = 6; i < pts.length - 4; i += Math.round(every * (0.6 + r() * 0.8))) {
      if (r() < 0.3) continue;
      const [px, py] = pts[i];
      const t0 = parent.ts[i];
      const dirX = (px >= 0 ? 1 : -1) * (r() < 0.25 ? -1 : 1);
      let ang = Math.atan2(0.35 + r() * 0.9, dirX);
      const L = lenMin + r() * (lenMax - lenMin);
      const own: P[] = [[px, py]];
      const ts: number[] = [t0];
      let x = px, y = py, s = 0;
      const ph = r() * 6.28;
      while (s < L && y < bottom - 0.01) {
        ang += 0.12 * Math.sin(s * 40 + ph);
        ang = steer(x, y, ang, step * 0.8, stones, x + dirX);
        x += Math.cos(ang) * step * 0.8;
        y += Math.max(0.0008, Math.sin(ang) * step * 0.8);
        s += step * 0.8;
        if (Math.abs(x) > HALF_W * 1.15) break;
        own.push([x, y]);
        ts.push(Math.min(1, t0 + s * pace));
      }
      if (own.length < 3) continue;
      const root: Root = { pts: own, ts, w0: order === 1 ? 0.0055 : 0.0026, w1: order === 1 ? 0.0018 : 0.0012, order };
      roots.push(root);
      if (order === 1) branchFrom(root, 2, 9, 0.02, 0.06);
    }
  };
  for (const main of roots.slice(0, mains.length)) branchFrom(main, 1, 8, 0.08, 0.28);
  return roots;
}

/** How much of a root is grown at growth `g`: the index of its last point reached and the share of the next segment. */
export function grownTo(root: Root, g: number): { i: number; k: number } | null {
  const ts = root.ts;
  if (g <= ts[0]) return null;
  if (g >= ts[ts.length - 1]) return { i: ts.length - 1, k: 0 };
  let i = 0;
  while (i + 1 < ts.length && ts[i + 1] <= g) i++;
  const span = ts[i + 1] - ts[i];
  return { i, k: span > 0 ? (g - ts[i]) / span : 0 };
}

/** The tips growing now (the points the roots have reached at `g`, where they are still growing). */
export function tipsAt(roots: readonly Root[], g: number): P[] {
  const out: P[] = [];
  for (const r of roots) {
    const at = grownTo(r, g);
    if (!at || at.i >= r.pts.length - 1) continue;
    const a = r.pts[at.i], b = r.pts[at.i + 1];
    out.push([a[0] + (b[0] - a[0]) * at.k, a[1] + (b[1] - a[1]) * at.k]);
  }
  return out;
}

// ── the tree ─────────────────────────────────────────────────────

/** How far down the upper body sits for a posture. */
export const dropOf = (posture: Posture): number => (posture === 'sit' ? DROP : 0);

export interface Branch {
  pts: P[];
  /** the tree's growth (0..1) at which it starts and ends growing */
  g0: number;
  g1: number;
  w0: number;
  w1: number;
}

/** A smooth curve through control points (quadratic B-spline-ish), as points. */
function curve(ctrl: readonly P[], n = 14): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // de Casteljau over the control points
    let pts = ctrl.map(p => [p[0], p[1]] as [number, number]);
    while (pts.length > 1) pts = pts.slice(1).map((p, j) => [pts[j][0] + (p[0] - pts[j][0]) * u, pts[j][1] + (p[1] - pts[j][1]) * u]);
    out.push(pts[0]);
  }
  return out;
}

/** The trunk: from the ground between the feet up the midline to just above the head. */
export function trunkFor(posture: Posture): Branch {
  const d = dropOf(posture);
  return { pts: curve([[0, 1.0], [0.004, 0.6], [-0.004, 0.3 + d * 0.5], [0, -0.03 + d]], 20), g0: 0, g1: 0.42, w0: 0.075, w1: 0.03 };
}

/** The branches: from the shoulders, from the arms, over the head; then smaller ones from them. */
export function branchesFor(posture: Posture, seed = 7): Branch[] {
  const d = dropOf(posture);
  const r = rand(seed);
  const out: Branch[] = [];
  for (const s of [-1, 1] as const) {
    // from the shoulder, out and up
    out.push({ pts: curve([[s * 0.04, 0.2 + d], [s * 0.15, 0.16 + d], [s * 0.26, 0.02 + d], [s * 0.36, -0.1 + d]]), g0: 0.42, g1: 0.62, w0: 0.026, w1: 0.009 });
    // from the arm (above the elbow), out and a little up
    out.push({ pts: curve([[s * 0.12, 0.3 + d], [s * 0.22, 0.27 + d], [s * 0.34, 0.16 + d], [s * 0.43, 0.08 + d]]), g0: 0.46, g1: 0.66, w0: 0.02, w1: 0.007 });
    // over the head, to the side
    out.push({ pts: curve([[0, 0.0 + d], [s * 0.04, -0.12 + d], [s * 0.12, -0.22 + d], [s * 0.2, -0.3 + d]]), g0: 0.44, g1: 0.64, w0: 0.02, w1: 0.007 });
  }
  out.push({ pts: curve([[0, 0.0 + d], [0.01, -0.14 + d], [-0.005, -0.25 + d], [0, -0.34 + d]]), g0: 0.44, g1: 0.64, w0: 0.02, w1: 0.007 });
  // twigs from the main branches' outer halves
  const mains = out.slice();
  for (const b of mains) {
    for (const at of [0.55, 0.8]) {
      const i = Math.round(at * (b.pts.length - 1));
      const [x, y] = b.pts[i];
      const side = x === 0 ? (r() < 0.5 ? -1 : 1) : Math.sign(x);
      const len = 0.07 + r() * 0.06;
      const ang = -Math.PI / 2 + side * (0.5 + r() * 0.6);
      const end: P = [x + Math.cos(ang) * len, y + Math.sin(ang) * len];
      const mid: P = [(x + end[0]) / 2 + side * 0.015, (y + end[1]) / 2];
      out.push({ pts: curve([[x, y], mid, end], 6), g0: b.g0 + (b.g1 - b.g0) * at, g1: Math.min(0.74, b.g0 + (b.g1 - b.g0) * at + 0.12), w0: 0.008, w1: 0.003 });
    }
  }
  return out;
}

/** The crown's middle and radii (the leaves round the head, never over the face). */
export function crownOf(posture: Posture): { cx: number; cy: number; rx: number; ry: number } {
  return { cx: 0, cy: -0.06 + dropOf(posture), rx: 0.46, ry: 0.3 };
}

export interface Leaf { x: number; y: number; a: number; s: number; g: number; tone: number; blossom: boolean }

/** The leaves of the crown: in an ellipse round the head, along the branches' ends; each appears at its growth. */
export function leavesFor(posture: Posture, seed = 11): Leaf[] {
  const c = crownOf(posture);
  const r = rand(seed);
  const d = dropOf(posture);
  const out: Leaf[] = [];
  for (let tries = 0; out.length < 230 && tries < 3000; tries++) {
    const u = r() * 2 - 1, v = r() * 2 - 1;
    const rr2 = u * u + v * v;
    if (rr2 > 1) continue;
    // denser toward the rim, a little thinner in the middle
    if (rr2 < 0.25 && r() < 0.55) continue;
    const x = c.cx + u * c.rx, y = c.cy + v * c.ry;
    // the face and the neck stay clear
    if (Math.abs(x) < 0.075 && y > -0.03 + d && y < 0.2 + d) continue;
    if (y > 0.24 + d && Math.abs(x) < 0.16) continue;
    const g = 0.74 + 0.26 * Math.min(1, Math.max(0, (Math.hypot(u, v) * 0.7 + r() * 0.3)));
    out.push({ x, y, a: r() * Math.PI * 2, s: 0.018 + r() * 0.014, g, tone: r(), blossom: r() < 0.16 });
  }
  return out;
}

/** The nine fruits' places on the crown's arc (Galatians' order from the lower left over the top), and a 2nd and 3rd of a kind. */
export function fruitPlace(i: number, slot: number, posture: Posture): P {
  const d = dropOf(posture);
  const th = ((-120 + 30 * i) * Math.PI) / 180;
  const x = 0.34 * Math.sin(th), y = -0.04 + d - 0.27 * Math.cos(th);
  const off: readonly P[] = [[0, 0], [0.042, 0.032], [-0.036, 0.04]];
  const o = off[Math.min(2, slot)];
  return [x + o[0], y + o[1]];
}

/** The fruit's size (figure units, its radius when ripe). */
export const FRUIT_R = 0.042;

// ── the seated figure ────────────────────────────────────────────

/** The standing outline's right half (kit/figure OUTLINE is that half down and its mirror back up). */
const RIGHT_HALF: readonly P[] = OUTLINE.slice(0, (OUTLINE.length + 1) / 2);

/**
 * The seated figure's outline (the right half down from the crown, then mirrored): the head, the shoulders, the arms
 * and the body to the hips lowered by DROP; the thighs come toward the viewer, so they show as a short widening to
 * the knees; the lower legs go down to the ankles (the feet are kit/figure's, on the ground).
 */
export const SEATED_OUTLINE: readonly P[] = (() => {
  const hipAt = RIGHT_HALF.findIndex(([, y]) => y >= 0.5);
  const upper = RIGHT_HALF.slice(0, hipAt + 1).map(([x, y]) => [x, y + DROP] as P);
  const legs: P[] = [
    // the knee seen from the front (the thigh coming toward the viewer), the shin down to the ankle
    [0.104, 0.73], [0.1, 0.77], [0.082, 0.82], [0.068, 0.87], [0.058, 0.91], [0.051, 0.94], [0.049, 0.956],
    // round the ankle (the foot covers it) and up the inner shin to the inner knee and the middle
    [0.037, 0.962], [0.025, 0.956], [0.022, 0.93], [0.024, 0.88], [0.028, 0.82], [0.03, 0.775], [0.018, 0.75], [0.006, 0.742],
  ];
  const right = [...upper, ...legs];
  return [...right, ...right.slice(1).reverse().map(([x, y]) => [-x, y] as P)];
})();

/** The seated figure's hands (kit/figure's, lowered with the arms: at the sides of the knees). */
export const seatedHands = (side: 1 | -1) => handShapes(side).map(s => ({ ...s, pts: s.pts.map(([x, y]) => [x, y + DROP] as P) }));
export const feet = footShapes;

/** The stone the seated figure sits on (behind the knees): an ellipse in figure units. */
export const SEAT = { cx: 0, cy: 0.88, rx: 0.21, ry: 0.12 } as const;

/** The world's top for a posture (the crown's top and a margin) and its framings (y ranges a camera shows). */
export function worldTop(posture: Posture): number {
  const c = crownOf(posture);
  return c.cy - c.ry - 0.05;
}

export type Framing = 'whole' | 'tree' | 'roots' | 'water';
export function framing(f: Framing, posture: Posture): { y0: number; y1: number } {
  const top = worldTop(posture), d = dropOf(posture);
  switch (f) {
    case 'whole': return { y0: top, y1: BOTTOM };
    case 'tree': return { y0: top, y1: 1.12 };
    case 'roots': return { y0: 0.52, y1: BOTTOM };
    case 'water': return { y0: 0.2 + d * 0.6, y1: BOTTOM };
  }
}
