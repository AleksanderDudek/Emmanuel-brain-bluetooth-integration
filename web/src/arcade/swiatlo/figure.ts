/**
 * The figure of Światło ciała, as geometry in its own units (H = 1 from the crown to the soles; x across,
 * 0 on the body's midline, the viewer's left negative): a serene standing figure seen from the front, arms
 * a little away from the body, and its organs drawn simply and clearly where they are — the brain and
 * the hypothalamus, the lungs, the heart (to the body's left, the viewer's right), the liver (to the
 * viewer's left), the stomach and the pancreas, the adrenals on the kidneys, the gut in its frame, the
 * palms, the long bones of the legs; and for the "systems" depth the paths between them (the vagus
 * nerve, the HPA axis, the aorta).  Smooth closed outlines are Catmull–Rom splines through the points.
 */
import type { OrganId } from './content';

export type P = readonly [number, number];

/** The body's outline, clockwise on screen (the head is its own ellipse). */
export const SILHOUETTE: readonly P[] = [
  // the neck, right side, down to the shoulder and the arm
  [0.021, 0.112], [0.023, 0.142], [0.06, 0.153], [0.098, 0.165], [0.114, 0.182],
  // the outer arm to the hand
  [0.124, 0.235], [0.136, 0.29], [0.146, 0.335], [0.156, 0.4], [0.166, 0.455], [0.178, 0.49], [0.186, 0.53], [0.182, 0.562], [0.168, 0.57],
  // the inner arm back up
  [0.152, 0.548], [0.146, 0.505], [0.136, 0.462], [0.124, 0.4], [0.112, 0.33], [0.1, 0.27], [0.09, 0.222],
  // the torso's side, the waist, the hip
  [0.088, 0.25], [0.086, 0.3], [0.078, 0.355], [0.086, 0.405], [0.1, 0.455], [0.1, 0.51],
  // the outer leg to the foot
  [0.092, 0.6], [0.078, 0.69], [0.07, 0.74], [0.072, 0.8], [0.066, 0.87], [0.05, 0.935], [0.054, 0.965], [0.078, 0.988], [0.07, 0.998],
  // the inner leg back up to the crotch
  [0.03, 0.996], [0.022, 0.97], [0.024, 0.935], [0.03, 0.87], [0.032, 0.8], [0.026, 0.74], [0.024, 0.66], [0.016, 0.56], [0.006, 0.512],
  // and the same on the other side
  [-0.006, 0.512], [-0.016, 0.56], [-0.024, 0.66], [-0.026, 0.74], [-0.032, 0.8], [-0.03, 0.87], [-0.024, 0.935], [-0.022, 0.97], [-0.03, 0.996],
  [-0.07, 0.998], [-0.078, 0.988], [-0.054, 0.965], [-0.05, 0.935], [-0.066, 0.87], [-0.072, 0.8], [-0.07, 0.74], [-0.078, 0.69], [-0.092, 0.6],
  [-0.1, 0.51], [-0.1, 0.455], [-0.086, 0.405], [-0.078, 0.355], [-0.086, 0.3], [-0.088, 0.25],
  [-0.09, 0.222], [-0.1, 0.27], [-0.112, 0.33], [-0.124, 0.4], [-0.136, 0.462], [-0.146, 0.505], [-0.152, 0.548],
  [-0.168, 0.57], [-0.182, 0.562], [-0.186, 0.53], [-0.178, 0.49], [-0.166, 0.455], [-0.156, 0.4], [-0.146, 0.335], [-0.136, 0.29], [-0.124, 0.235],
  [-0.114, 0.182], [-0.098, 0.165], [-0.06, 0.153], [-0.023, 0.142], [-0.021, 0.112],
];

/** The head: an ellipse (centre, radii). */
export const HEAD = { x: 0, y: 0.062, rx: 0.046, ry: 0.062 };

export type Shape =
  | { kind: 'blob'; pts: readonly P[] }
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; rot?: number }
  | { kind: 'stroke'; pts: readonly P[]; width: number };

/** The thigh bone, the shin bone and the kneecap of the viewer's right leg; the left mirrors them. */
const FEMUR: readonly P[] = [
  [0.046, 0.486], [0.055, 0.476], [0.067, 0.48], [0.07, 0.492], [0.062, 0.503], [0.057, 0.53], [0.054, 0.6], [0.05, 0.69],
  [0.057, 0.708], [0.058, 0.724], [0.048, 0.731], [0.04, 0.726], [0.033, 0.731], [0.032, 0.716], [0.04, 0.702], [0.045, 0.6],
  [0.049, 0.53], [0.05, 0.505],
];
const TIBIA: readonly P[] = [
  [0.031, 0.752], [0.043, 0.746], [0.055, 0.75], [0.052, 0.768], [0.046, 0.8], [0.044, 0.88], [0.046, 0.926], [0.04, 0.936],
  [0.031, 0.93], [0.034, 0.88], [0.035, 0.8], [0.033, 0.77],
];

function bonePair(): Shape[] {
  const out: Shape[] = [];
  for (const s of [1, -1]) {
    const m = (pts: readonly P[]): P[] => (s > 0 ? [...pts] : pts.map(([x, y]) => [-x, y] as P).reverse());
    out.push({ kind: 'blob', pts: m(FEMUR) }, { kind: 'blob', pts: m(TIBIA) }, { kind: 'ellipse', x: s * 0.044, y: 0.739, rx: 0.008, ry: 0.0085 });
  }
  return out;
}

/** Each organ's drawing (filled blobs and ellipses, and thick strokes for tubes). */
export const ORGAN_SHAPES: Readonly<Record<OrganId, readonly Shape[]>> = {
  brain: [
    { kind: 'blob', pts: [[0, 0.018], [0.02, 0.016], [0.034, 0.026], [0.038, 0.045], [0.032, 0.064], [0.014, 0.072], [0, 0.068], [-0.014, 0.072], [-0.032, 0.064], [-0.038, 0.045], [-0.034, 0.026], [-0.02, 0.016]] },
  ],
  lungs: [
    { kind: 'blob', pts: [[-0.013, 0.188], [-0.036, 0.176], [-0.064, 0.2], [-0.075, 0.25], [-0.072, 0.298], [-0.046, 0.308], [-0.02, 0.292], [-0.012, 0.24]] },
    { kind: 'blob', pts: [[0.013, 0.188], [0.036, 0.176], [0.062, 0.2], [0.073, 0.25], [0.07, 0.296], [0.046, 0.304], [0.036, 0.285], [0.034, 0.258], [0.02, 0.238]] },
  ],
  heart: [
    { kind: 'blob', pts: [[-0.016, 0.252], [-0.002, 0.242], [0.018, 0.244], [0.034, 0.258], [0.042, 0.28], [0.03, 0.294], [0.012, 0.292], [-0.008, 0.282], [-0.018, 0.268]] },
    { kind: 'stroke', pts: [[-0.002, 0.247], [0.002, 0.229], [0.016, 0.226], [0.02, 0.24]], width: 0.008 },
  ],
  liver: [
    { kind: 'blob', pts: [[-0.074, 0.306], [-0.03, 0.3], [0.01, 0.308], [0.03, 0.316], [0.0, 0.33], [-0.04, 0.346], [-0.068, 0.35], [-0.08, 0.33]] },
    // the pancreas, behind the stomach
    { kind: 'blob', pts: [[-0.02, 0.352], [0.012, 0.345], [0.05, 0.343], [0.058, 0.35], [0.03, 0.358], [-0.014, 0.362]] },
  ],
  adrenal: [
    { kind: 'blob', pts: [[-0.058, 0.369], [-0.048, 0.355], [-0.037, 0.368]] },
    { kind: 'blob', pts: [[0.038, 0.365], [0.049, 0.352], [0.059, 0.364]] },
  ],
  kidney: [
    { kind: 'blob', pts: [[-0.05, 0.368], [-0.036, 0.374], [-0.034, 0.388], [-0.038, 0.4], [-0.036, 0.412], [-0.05, 0.416], [-0.062, 0.404], [-0.064, 0.382]] },
    { kind: 'blob', pts: [[0.05, 0.365], [0.036, 0.371], [0.034, 0.385], [0.038, 0.397], [0.036, 0.409], [0.05, 0.413], [0.062, 0.401], [0.064, 0.379]] },
  ],
  gut: [
    // the colon's frame and the small intestine's loops
    { kind: 'stroke', pts: [[-0.044, 0.476], [-0.054, 0.44], [-0.052, 0.41], [-0.02, 0.402], [0.02, 0.402], [0.052, 0.41], [0.054, 0.44], [0.048, 0.47], [0.024, 0.486]], width: 0.011 },
    { kind: 'stroke', pts: [[-0.03, 0.422], [0.028, 0.42], [0.03, 0.432], [-0.03, 0.436], [-0.032, 0.448], [0.03, 0.447], [0.03, 0.459], [-0.028, 0.462], [-0.022, 0.472], [0.02, 0.471]], width: 0.006 },
  ],
  skin: [
    { kind: 'ellipse', x: -0.168, y: 0.522, rx: 0.016, ry: 0.032, rot: 0.25 },
    { kind: 'ellipse', x: 0.168, y: 0.522, rx: 0.016, ry: 0.032, rot: -0.25 },
  ],
  // the long bones of the legs, drawn as bones (a rounded head, a slender shaft, the knee's condyles), and the kneecaps
  bone: [...bonePair()],
};

/** Where an organ glows from (its centre) and how far (figure units); also the hit area of a tap on it. */
export const ORGAN_SPOT: Readonly<Record<OrganId, { x: number; y: number; r: number; pair?: boolean }>> = {
  brain: { x: 0, y: 0.045, r: 0.042 },
  lungs: { x: 0, y: 0.245, r: 0.07 },
  heart: { x: 0.012, y: 0.268, r: 0.03 },
  liver: { x: -0.025, y: 0.33, r: 0.05 },
  adrenal: { x: 0.048, y: 0.36, r: 0.014, pair: true },
  kidney: { x: 0.05, y: 0.39, r: 0.026, pair: true },
  gut: { x: 0, y: 0.442, r: 0.05 },
  skin: { x: 0.168, y: 0.522, r: 0.032, pair: true },
  bone: { x: 0.052, y: 0.61, r: 0.04, pair: true },
};

/** The hypothalamus, the pituitary (the HPA axis' first two floors) and the SA node. */
export const HYPOTHALAMUS = { x: 0, y: 0.066, r: 0.006 };
export const PITUITARY = { x: 0, y: 0.078, r: 0.004 };

/** The paths of the "systems" depth (figure units): nerves, a hormone axis, the main artery. */
export const SYSTEMS: Readonly<Record<'vagus' | 'hpa' | 'aorta', readonly (readonly P[])[]>> = {
  vagus: [
    [[0.004, 0.085], [0.012, 0.12], [0.014, 0.16], [0.012, 0.21], [0.014, 0.25], [0.02, 0.3], [0.012, 0.35], [0.004, 0.41]],
    [[-0.004, 0.085], [-0.012, 0.12], [-0.014, 0.16], [-0.016, 0.21], [-0.03, 0.24], [-0.02, 0.3], [-0.012, 0.35], [-0.004, 0.42]],
  ],
  hpa: [
    [[0, 0.066], [0, 0.078], [0.004, 0.12], [0.03, 0.2], [0.046, 0.3], [0.048, 0.355]],
    [[0, 0.078], [-0.004, 0.12], [-0.03, 0.2], [-0.046, 0.3], [-0.048, 0.358]],
  ],
  aorta: [
    [[0.006, 0.244], [0.004, 0.228], [-0.008, 0.226], [-0.008, 0.26], [-0.006, 0.34], [-0.004, 0.44], [0, 0.48]],
    [[0, 0.48], [-0.04, 0.52], [-0.05, 0.62], [-0.046, 0.75]],
    [[0, 0.48], [0.04, 0.52], [0.05, 0.62], [0.046, 0.75]],
  ],
};

/** Map a figure point to the screen. */
export type ToScreen = (x: number, y: number) => [number, number];

/**
 * A smooth path through points (Catmull–Rom, tension 0.5, as cubic Béziers), closed or open, into a
 * Path2D (or any object with the same drawing methods, for tests).
 */
export function spline(path: Path2D, pts: readonly P[], map: ToScreen, closed: boolean): void {
  const n = pts.length;
  if (n < 2) return;
  const at = (i: number): [number, number] => {
    if (closed) return map(pts[(i + n) % n][0], pts[(i + n) % n][1]);
    const k = Math.max(0, Math.min(n - 1, i));
    return map(pts[k][0], pts[k][1]);
  };
  const [x0, y0] = at(0);
  path.moveTo(x0, y0);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    path.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
  if (closed) path.closePath();
}

/** The figure's whole silhouette (the body and the head) as one path. */
export function silhouettePath(map: ToScreen, scale: number): Path2D {
  const p = new Path2D();
  spline(p, SILHOUETTE, map, true);
  const [hx, hy] = map(HEAD.x, HEAD.y);
  p.moveTo(hx + HEAD.rx * scale, hy);
  p.ellipse(hx, hy, HEAD.rx * scale, HEAD.ry * scale, 0, 0, Math.PI * 2);
  return p;
}

/** An organ's filled parts as one path (blobs and ellipses). */
export function organFill(o: OrganId, map: ToScreen, scale: number): Path2D {
  const p = new Path2D();
  for (const s of ORGAN_SHAPES[o]) {
    if (s.kind === 'blob') spline(p, s.pts, map, true);
    else if (s.kind === 'ellipse') {
      const [x, y] = map(s.x, s.y);
      p.moveTo(x + s.rx * scale, y);
      p.ellipse(x, y, s.rx * scale, s.ry * scale, s.rot ?? 0, 0, Math.PI * 2);
    }
  }
  return p;
}

/** An organ's tubes and bones (strokes) as paths with their widths (px). */
export function organStrokes(o: OrganId, map: ToScreen, scale: number): { path: Path2D; width: number }[] {
  const out: { path: Path2D; width: number }[] = [];
  for (const s of ORGAN_SHAPES[o]) {
    if (s.kind !== 'stroke') continue;
    const p = new Path2D();
    spline(p, s.pts, map, false);
    out.push({ path: p, width: Math.max(1, s.width * scale) });
  }
  return out;
}

/** Which organ (if any) a figure point lands on, by the organs' spots (pairs mirrored). */
export function organAt(fx: number, fy: number, slack = 0): OrganId | null {
  let best: OrganId | null = null, bd = Infinity;
  for (const [o, s] of Object.entries(ORGAN_SPOT) as [OrganId, (typeof ORGAN_SPOT)[OrganId]][]) {
    const xs = s.pair ? [s.x, -s.x] : [s.x];
    for (const x of xs) {
      const d = Math.hypot(fx - x, fy - s.y);
      if (d <= s.r + slack && d < bd) { bd = d; best = o; }
    }
  }
  return best;
}
