/**
 * Koła światła's figure (DESIGN.md §28): the same calm, gender-neutral person as kit/figure.ts, seen in profile and
 * facing the viewer's right — standing, as the well-known chart shows it, or seated on a low stool (§18.3 offers a
 * seated posture) — and the twelve wheels' places on it.  Geometry only, in the figure's own units (H = 1 from the
 * crown to the soles of the standing figure; x forward, 0 at the crown; y down).
 *
 * Each wheel is a funnel: its tip on the spine's line of light (the head's middle for the brow, the crown's inside for
 * the crown), its axis to the front, to the back, down between the legs (the first) or up from the crown (the
 * seventh), and its mouth — a disc of petals — a little beyond the body.  `wheelGeom` gives the tip, the axis, the
 * mouth and its radius; `FRAME` the boxes the camera frames (the whole figure with its field, or one centre with its
 * front and back).  My own drawing of the well-known form, never a copy of an artwork.
 */
import type { P } from '../kit/figure';
import { WHEELS, type CentreId, type WheelId } from './content';
import type { Posture } from './meta';

export type { P };

/** The standing body, clockwise on screen from the crown: the face and the front down to the toes, the back up. */
const HEAD_FRONT: readonly P[] = [
  [0, 0], [0.03, 0.011], [0.046, 0.034], [0.05, 0.054], [0.046, 0.066], [0.052, 0.074], [0.063, 0.088], [0.051, 0.096],
  [0.054, 0.103], [0.05, 0.108], [0.052, 0.113], [0.047, 0.12], [0.05, 0.128], [0.035, 0.137], [0.02, 0.149],
];
const TORSO_FRONT: readonly P[] = [
  [0.02, 0.165], [0.032, 0.182], [0.058, 0.205], [0.071, 0.24], [0.072, 0.274], [0.064, 0.31], [0.058, 0.345],
  [0.064, 0.39], [0.066, 0.425],
];
const LEGS_STAND: readonly P[] = [
  [0.058, 0.46], [0.043, 0.494], [0.05, 0.53], [0.056, 0.6], [0.047, 0.715], [0.05, 0.742], [0.044, 0.8], [0.034, 0.9],
  [0.028, 0.94], [0.05, 0.96], [0.1, 0.981], [0.118, 0.994], [0.108, 1], [0.02, 1], [-0.03, 0.999], [-0.04, 0.985],
  [-0.027, 0.95], [-0.031, 0.88], [-0.05, 0.8], [-0.046, 0.76], [-0.036, 0.73], [-0.05, 0.64], [-0.06, 0.555],
  [-0.078, 0.5],
];
const LEGS_SIT: readonly P[] = [
  [0.06, 0.452], [0.052, 0.47], [0.09, 0.456], [0.2, 0.46], [0.27, 0.466], [0.292, 0.49], [0.282, 0.55], [0.271, 0.68],
  [0.266, 0.735], [0.29, 0.751], [0.345, 0.768], [0.356, 0.778], [0.34, 0.783], [0.236, 0.782], [0.228, 0.766],
  [0.235, 0.73], [0.226, 0.62], [0.232, 0.545], [0.24, 0.516], [0.15, 0.527], [0.02, 0.531], [-0.05, 0.527],
  [-0.076, 0.495],
];
const BACK: readonly P[] = [
  [-0.075, 0.46], [-0.052, 0.4], [-0.056, 0.33], [-0.068, 0.27], [-0.064, 0.22], [-0.04, 0.18], [-0.03, 0.16],
  [-0.038, 0.135], [-0.052, 0.1], [-0.056, 0.065], [-0.04, 0.025],
];

/** The near arm, a softer shape over the body: hanging (standing) or forearm along the thigh, palm up (seated). */
const ARM_STAND: readonly P[] = [
  [0, 0.19], [0.03, 0.202], [0.021, 0.28], [0.013, 0.36], [0.022, 0.45], [0.029, 0.5], [0.035, 0.53], [0.031, 0.585],
  [0.009, 0.577], [0.004, 0.505], [-0.004, 0.45], [-0.026, 0.37], [-0.033, 0.28], [-0.03, 0.205],
];
const ARM_SIT: readonly P[] = [
  [0, 0.19], [0.03, 0.202], [0.022, 0.29], [0.02, 0.36], [0.07, 0.402], [0.14, 0.428], [0.2, 0.438], [0.228, 0.451],
  [0.205, 0.459], [0.17, 0.456], [0.08, 0.434], [-0.022, 0.392], [-0.033, 0.28], [-0.03, 0.205],
];

/** The outline of the body for a posture (closed, clockwise on screen). */
export function bodyOutline(posture: Posture): readonly P[] {
  return [...HEAD_FRONT, ...TORSO_FRONT, ...(posture === 'sit' ? LEGS_SIT : LEGS_STAND), ...BACK];
}
export const armOutline = (posture: Posture): readonly P[] => (posture === 'sit' ? ARM_SIT : ARM_STAND);

/** The stool of the seated posture: the seat (a slab) and two legs, in figure units. */
export const STOOL = { seat: { x0: -0.1, x1: 0.13, y: 0.531, h: 0.022 }, legs: [[-0.075, 0.553, -0.095, 0.782], [0.105, 0.553, 0.125, 0.782]] as const, floor: 0.783 };

/** Where the floor is (the soles; the stool's feet). */
export const floorOf = (posture: Posture): number => (posture === 'sit' ? STOOL.floor : 1);

/** The spine's line of light, from the base to the crown's inside: the wheels' tips sit on it. */
export const SPINE: readonly P[] = [
  [-0.014, 0.505], [-0.046, 0.445], [-0.034, 0.36], [-0.044, 0.27], [-0.026, 0.2], [-0.012, 0.162], [-0.004, 0.065], [-0.004, 0.03],
];

/** Each centre's height, its tip (on the spine), the body's front and back there, and the mouth's radius. */
const CENTRE_AT: Readonly<Record<CentreId, { tip: P; front: number; back: number; r: number }>> = {
  root: { tip: [-0.014, 0.505], front: 0, back: 0, r: 0.043 },
  sacral: { tip: [-0.046, 0.44], front: 0.066, back: -0.075, r: 0.04 },
  plexus: { tip: [-0.034, 0.355], front: 0.06, back: -0.055, r: 0.04 },
  heart: { tip: [-0.044, 0.265], front: 0.072, back: -0.068, r: 0.045 },
  throat: { tip: [-0.012, 0.163], front: 0.022, back: -0.03, r: 0.034 },
  brow: { tip: [-0.004, 0.062], front: 0.05, back: -0.056, r: 0.036 },
  crown: { tip: [-0.004, 0.03], front: 0, back: 0, r: 0.045 },
};

/** How far a mouth stands beyond the body (figure units). */
const REACH = 0.078;

export interface WheelGeom {
  /** the tip on the spine, the mouth's centre, the unit axis (tip → mouth), the funnel's length, the mouth's radius */
  tip: P;
  mouth: P;
  ax: number;
  ay: number;
  len: number;
  r: number;
}

/** A wheel's funnel on the figure for a posture (the seated figure keeps the torso's places; the first opens down through the seat). */
export function wheelGeom(id: WheelId, posture: Posture): WheelGeom {
  const w = WHEELS.find(x => x.id === id)!;
  const c = CENTRE_AT[w.centre];
  const [tx, ty] = c.tip;
  let mouth: P;
  if (w.side === 'down') mouth = [tx + 0.004, ty + (posture === 'sit' ? 0.15 : 0.14)];
  else if (w.side === 'up') mouth = [tx, -0.115];
  else if (w.side === 'front') mouth = [c.front + REACH, ty];
  else mouth = [c.back - REACH, ty];
  const dx = mouth[0] - tx, dy = mouth[1] - ty, len = Math.hypot(dx, dy) || 1;
  return { tip: c.tip, mouth, ax: dx / len, ay: dy / len, len, r: c.r };
}

export interface Box { x0: number; y0: number; x1: number; y1: number }

/** The egg-shaped field round the figure: its centre and radii (figure units). */
export function eggOf(posture: Posture): { cx: number; cy: number; rx: number; ry: number } {
  return posture === 'sit' ? { cx: 0.1, cy: 0.36, rx: 0.41, ry: 0.56 } : { cx: 0.005, cy: 0.455, rx: 0.33, ry: 0.665 };
}

/** The box the camera frames: the whole figure with its field, or one centre with its front and back mouths. */
export function frameBox(what: CentreId | 'whole', posture: Posture): Box {
  if (what === 'whole') {
    const e = eggOf(posture);
    return { x0: e.cx - e.rx - 0.02, y0: e.cy - e.ry - 0.02, x1: e.cx + e.rx + 0.02, y1: e.cy + e.ry + 0.02 };
  }
  if (what === 'root') {
    const g = wheelGeom('root', posture);
    return { x0: -0.2, y0: g.tip[1] - 0.07, x1: 0.2, y1: g.mouth[1] + g.r + 0.03 };
  }
  if (what === 'crown') return { x0: -0.2, y0: -0.175, x1: 0.2, y1: 0.075 };
  const f = wheelGeom(`${what}F` as WheelId, posture), b = wheelGeom(`${what}B` as WheelId, posture);
  const y = f.tip[1];
  return { x0: b.mouth[0] - b.r * 0.8 - 0.02, y0: y - 0.1, x1: f.mouth[0] + f.r * 0.8 + 0.02, y1: y + 0.1 };
}
