/**
 * Mocne zęby's shapes (DESIGN.md §24.4): a lower first molar cut through from front to back (mesial on the left) in
 * millimetres, y downward — the crown with its two cusps, the enamel cap, the dentine, the pulp chamber with its
 * horns and the two canals, the two roots, the socket in the bone 0.2 mm away (the periodontal ligament), and the
 * gum; plus the small helpers the worlds share (closed smooth outlines, a point along an outline, its normal).
 */
import type { Pt, Rect } from '../kit/healthlib/spec';
import { hash } from '../kit/healthlib/paint';

export { hash };
export type { Pt, Rect };

/** The enamel's outer surface, from the mesial cemento-enamel junction over the two cusps to the distal one. */
export const CROWN: readonly Pt[] = [
  [-4.7, -2.4], [-5.3, -4.0], [-5.7, -5.8], [-5.4, -7.6], [-4.6, -9.0], [-3.4, -9.9], [-2.2, -9.7], [-1.1, -8.9],
  [0, -8.4], [1.1, -8.9], [2.2, -9.7], [3.3, -9.9], [4.5, -9.0], [5.3, -7.6], [5.6, -5.8], [5.2, -4.0], [4.6, -2.4],
];

/** The dentino-enamel junction (the enamel's inner face), CEJ to CEJ: ≈ 2.2 mm of enamel over a cusp, ≈ 1 mm on a side. */
export const DEJ: readonly Pt[] = [
  [-4.7, -2.4], [-4.6, -4.0], [-4.6, -5.8], [-4.2, -7.0], [-3.2, -7.7], [-2.0, -7.4], [-1.0, -6.9], [0, -6.8],
  [1.0, -6.9], [2.0, -7.4], [3.1, -7.7], [4.1, -7.0], [4.5, -5.8], [4.5, -4.0], [4.6, -2.4],
];

/** The roots' surface (cementum), from the distal CEJ down round the distal apex, the furcation, the mesial apex, up. */
export const ROOTS: readonly Pt[] = [
  [4.6, -2.4], [4.55, 0], [4.45, 3], [4.25, 6], [3.95, 9], [3.5, 11.2], [2.95, 12.15], [2.3, 12.0], [1.95, 10.5],
  [1.65, 7], [1.35, 3.5], [0.85, 1.6], [0, 1.1], [-0.85, 1.6], [-1.45, 3.5], [-1.85, 7], [-2.15, 10.5], [-2.65, 12.55],
  [-3.3, 13.0], [-3.95, 12.3], [-4.45, 9.5], [-4.75, 6], [-4.85, 3], [-4.8, 0], [-4.7, -2.4],
];

/** The whole tooth's outline (crown then roots). */
export const TOOTH: readonly Pt[] = [...CROWN.slice(0, -1), ...ROOTS.slice(0, -1)];

/** The pulp: the chamber with its two horns under the cusps, and the two canals to the apical foramina. */
export const PULP: readonly Pt[] = [
  [-3.32, 12.62], [-3.58, 9], [-3.62, 5], [-3.52, 2], [-3.42, 0], [-3.46, -2], [-3.4, -3.8], [-3.05, -5.0], [-2.5, -4.5],
  [-1.2, -4.0], [0, -3.9], [1.2, -4.0], [2.4, -4.5], [2.95, -5.0], [3.32, -3.8], [3.32, -2], [3.15, 0], [3.05, 2.5],
  [2.96, 6], [3.0, 9], [2.86, 11.9], [2.6, 11.9], [2.36, 9], [2.26, 6], [2.2, 2.5], [1.9, 0.2], [0.8, -0.5], [0, -0.6],
  [-0.8, -0.5], [-2.1, 0.2], [-2.56, 2.5], [-2.76, 6], [-2.86, 9], [-3.06, 12.62],
];

/** The apical foramina, where vessels and the nerve enter (mesial, distal). */
export const APEX_M: Pt = [-3.2, 12.7];
export const APEX_D: Pt = [2.74, 12.0];

/** The vessels' and the nerve's way: up each canal into the chamber and on to the horns (polylines). */
export const PULP_PATHS: readonly (readonly Pt[])[] = [
  [[-3.2, 13.6], [-3.2, 12.4], [-3.15, 9], [-3.15, 5], [-3.0, 1.5], [-2.9, -1.2], [-2.8, -3.6], [-2.95, -4.6]],
  [[2.74, 13.0], [2.74, 11.7], [2.62, 8.5], [2.6, 4.5], [2.62, 1.2], [2.6, -1.4], [2.62, -3.6], [2.8, -4.6]],
  [[-2.95, -1.2], [-1.8, -1.8], [-0.6, -2.4], [0.6, -2.6], [1.7, -2.2], [2.6, -1.4]],
];

/** How far the gum, the sulcus and the bone sit (y of each, mm): the gum's free margin ≈ 1.2 mm over the CEJ. */
export const GUM = { margin: -3.65, sulcus: -3.0, cej: -2.4, crest: -0.6, outer: -1.05, X: 40 } as const;
/** The periodontal ligament's width (mm): 0.15–0.35, ≈ 0.2 on average. */
export const PDL_W = 0.2;
/** The cementum's thickness as drawn (mm): thin over the root, thicker toward the apex. */
export const CEM_W = 0.06;

/** The bone's still extent below the crest (mm). */
export const BONE_BOTTOM = 18;

/** Views of the tooth world. */
export const TOOTH_VIEW: Rect = { x: -10.5, y: -12, w: 21, h: 27.5 };
/** Its side by the mesial root: dentine · cementum · ligament · bone. */
export const ROOT_VIEW: Rect = { x: -6.95, y: 3.9, w: 3.9, h: 2.9 };
/** The gum's margin on the mesial side: enamel, the sulcus, the junctional epithelium, the crest of the bone. */
export const GUM_VIEW: Rect = { x: -8.2, y: -5.0, w: 5.2, h: 4.4 };

// ── shared helpers ──────────────────────────────────────────────

/** A closed outline smoothed through the midpoints of its points (every point a gentle control). */
export function closedSmooth(pts: readonly Pt[], p = new Path2D()): Path2D {
  const n = pts.length;
  const m = (i: number): Pt => {
    const a = pts[(i + n) % n], b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  const s = m(-1);
  p.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) {
    const c = pts[i], e = m(i);
    p.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  }
  p.closePath();
  return p;
}

/** An open outline smoothed through midpoints (it starts and ends at its first and last points). */
export function openSmooth(pts: readonly Pt[], p = new Path2D()): Path2D {
  if (pts.length < 2) return p;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  p.lineTo(l[0], l[1]);
  return p;
}

/** A polyline resampled at an even step (for walking along an outline). */
export function resample(pts: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const d = Math.hypot(x1 - x0, y1 - y0);
    let s = step - carry;
    while (s <= d) {
      out.push([x0 + ((x1 - x0) * s) / d, y0 + ((y1 - y0) * s) / d]);
      s += step;
    }
    carry = d - (s - step);
  }
  return out;
}

/** The unit normal of a resampled polyline at i (pointing to its left as it runs). */
export function normalAt(pts: readonly Pt[], i: number): Pt {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l];
}

/** Smoothstep of x between a and b. */
export function sstep(a: number, b: number, x: number): number {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

/** A share of a scene's growth (0..1) between two points of it. */
export const part = (g: number, a: number, b: number): number => Math.max(0, Math.min(1, (g - a) / (b - a)));
