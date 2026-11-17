/**
 * The figure of Światło ciała as geometry in its own units (H = 1 from the crown to the soles; x across, 0 on the
 * body's midline): a calm standing person seen from the front (or, turned, from the back), arms a little away from
 * the body, palms open forward, the feet seen from the front with their toes.  One closed outline (head, neck, arms,
 * hands, legs, feet), so the glass body has a single rim and no seams.
 *
 * In the FRONT view the person's left side is the viewer's right (x > 0): the heart, the stomach and the spleen sit at
 * x > 0, the liver and the gallbladder at x < 0, and "the left foot" is drawn at x > 0.  The back view mirrors this
 * (it only carries the back's muscles, which come in pairs).
 *
 * Every element of the meditations is a shape of its own here (organs, muscle bellies on the surface, limb segments
 * as bands clipped to the outline); the brain's views are in brain.ts.  Smooth outlines are Catmull–Rom splines.
 */

export type P = readonly [number, number];

export type Shape =
  /** a closed smooth outline through the points */
  | { k: 'blob'; p: readonly P[] }
  /** a closed polygon with straight sides (a band to be clipped by the outline it lies in) */
  | { k: 'poly'; p: readonly P[] }
  | { k: 'ell'; x: number; y: number; rx: number; ry: number; rot?: number }
  /** an open smooth line of a width (a tube, a strap, a nerve) */
  | { k: 'line'; p: readonly P[]; w: number }
  /** the figure's whole rim (the skin) */
  | { k: 'skin' };

/**
 * An element's drawing: its shapes, mirrored to the other side when it is a pair, clipped to an outline when its
 * shapes are bands ("body": the figure; "brainL"/"brainM": the hemisphere in brain.ts), drawn as a ghost (a deep
 * structure seen through) when `deep`; its centre and radius (the ring of light, a tap's target) and the box the
 * camera frames, in the same units.
 */
export interface Geo {
  shapes: readonly Shape[];
  mirror?: boolean;
  clip?: 'body' | 'brainL' | 'brainM';
  deep?: boolean;
  /** many small parts (the lymph nodes, the bones): while waiting they are drawn faintly, without outlines */
  quiet?: boolean;
  /** decorations drawn over the lit shape (tendinous lines, the arbor vitae, finger seams) */
  marks?: readonly (readonly P[])[];
  c: P;
  r: number;
  /** the box the camera frames (x0, y0, x1, y1); defaults to the shapes' own box */
  box?: readonly [number, number, number, number];
}

// ── the outline ────────────────────────────────────────────────────────────────────
/** The viewer's right half of the outline, from the crown down (the left half mirrors it). */
const HALF: readonly P[] = [
  // the head
  [0, 0], [0.026, 0.005], [0.042, 0.024], [0.047, 0.052], [0.044, 0.082], [0.036, 0.104], [0.024, 0.12],
  // the neck and the shoulder
  [0.021, 0.134], [0.023, 0.148], [0.055, 0.158], [0.092, 0.166], [0.114, 0.18], [0.124, 0.206],
  // the outer arm, the elbow, the forearm
  [0.13, 0.25], [0.138, 0.3], [0.148, 0.352], [0.161, 0.41], [0.172, 0.458], [0.18, 0.49],
  // the hand: palm forward, the thumb out to the side, four fingers down
  [0.19, 0.502], [0.2, 0.52], [0.205, 0.54], [0.2, 0.548], [0.192, 0.538], [0.191, 0.56], [0.19, 0.588], [0.185, 0.592],
  [0.181, 0.584], [0.179, 0.598], [0.173, 0.599], [0.171, 0.586], [0.168, 0.594], [0.162, 0.592], [0.161, 0.578],
  [0.157, 0.582], [0.152, 0.575], [0.152, 0.548], [0.156, 0.52], [0.159, 0.496],
  // the inner forearm, the elbow, the inner arm up to the armpit
  [0.152, 0.45], [0.139, 0.395], [0.126, 0.35], [0.116, 0.3], [0.106, 0.258], [0.098, 0.236],
  // the side, the waist, the hip
  [0.094, 0.262], [0.09, 0.31], [0.081, 0.36], [0.087, 0.41], [0.099, 0.458], [0.103, 0.5],
  // the outer leg to the ankle
  [0.099, 0.56], [0.088, 0.64], [0.078, 0.708], [0.076, 0.745], [0.079, 0.8], [0.071, 0.87], [0.058, 0.93],
  // the foot from the front: its outer edge, five toes along the bottom, the inner edge
  [0.057, 0.952], [0.066, 0.97], [0.074, 0.985], [0.072, 0.994], [0.066, 0.991], [0.063, 0.997], [0.057, 0.996],
  [0.054, 0.999], [0.048, 0.998], [0.045, 1.0], [0.038, 0.999], [0.034, 1.0], [0.026, 0.997], [0.023, 0.986],
  [0.024, 0.965], [0.029, 0.94],
  // the inner leg up to the crotch
  [0.033, 0.87], [0.036, 0.8], [0.032, 0.742], [0.03, 0.7], [0.026, 0.62], [0.016, 0.55], [0.004, 0.514],
];

/** The whole outline, clockwise on screen. */
export const OUTLINE: readonly P[] = [
  ...HALF,
  ...HALF.slice(1).reverse().map(([x, y]) => [-x, y] as P),
];

/** half the figure's width (with the hands), in H */
export const FIG_HALF = 0.21;

/** Mirror points to the other side (x → −x), keeping the order. */
export const flip = (pts: readonly P[]): P[] => pts.map(([x, y]) => [-x, y] as P);

/** A smooth path through points (Catmull–Rom, as cubic Béziers), closed or open, into a Path2D-like sink. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
}

export function spline(path: PathSink, pts: readonly P[], closed: boolean): void {
  const n = pts.length;
  if (n < 2) return;
  const at = (i: number): P => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  path.moveTo(pts[0][0], pts[0][1]);
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

export function polygon(path: PathSink, pts: readonly P[]): void {
  if (!pts.length) return;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
}

// ── the quiet anatomy under the glass (the clavicles, the ribs, the spine, the knees) ──
export const QUIET: readonly (readonly P[])[] = [
  [[0, 0.165], [0, 0.26], [0.001, 0.36], [0, 0.46]],
  [[0.008, 0.168], [0.05, 0.162], [0.094, 0.171]],
  [[-0.008, 0.168], [-0.05, 0.162], [-0.094, 0.171]],
  ...[0, 1, 2, 3, 4].flatMap(i => {
    const y = 0.192 + i * 0.023;
    return [[[0.006, y], [0.048, y + 0.006], [0.076, y + 0.024 + i * 0.002]], [[-0.006, y], [-0.048, y + 0.006], [-0.076, y + 0.024 + i * 0.002]]] as P[][];
  }),
  [[0.045, 0.725], [0.055, 0.735], [0.06, 0.725]],
  [[-0.045, 0.725], [-0.055, 0.735], [-0.06, 0.725]],
];

// ── bones (the organs' "kości" and the marrow inside them) ──
const SKELETON: readonly (readonly P[])[] = [
  // the spine, the sternum, the clavicles
  [[0, 0.135], [0.002, 0.2], [0, 0.3], [0.003, 0.38], [0, 0.46]],
  [[0, 0.18], [0, 0.262]],
  [[0.006, 0.17], [0.05, 0.163], [0.096, 0.172]], [[-0.006, 0.17], [-0.05, 0.163], [-0.096, 0.172]],
  // the pelvis
  [[0.012, 0.47], [0.05, 0.43], [0.086, 0.44], [0.08, 0.48], [0.05, 0.5], [0.018, 0.505]],
  [[-0.012, 0.47], [-0.05, 0.43], [-0.086, 0.44], [-0.08, 0.48], [-0.05, 0.5], [-0.018, 0.505]],
  // the arms: humerus, the forearm's two bones
  [[0.11, 0.19], [0.122, 0.27], [0.133, 0.35]], [[-0.11, 0.19], [-0.122, 0.27], [-0.133, 0.35]],
  [[0.137, 0.36], [0.155, 0.43], [0.17, 0.485]], [[-0.137, 0.36], [-0.155, 0.43], [-0.17, 0.485]],
  [[0.128, 0.365], [0.146, 0.435], [0.162, 0.49]], [[-0.128, 0.365], [-0.146, 0.435], [-0.162, 0.49]],
  // the legs: femur, tibia
  [[0.068, 0.49], [0.06, 0.6], [0.05, 0.715]], [[-0.068, 0.49], [-0.06, 0.6], [-0.05, 0.715]],
  [[0.048, 0.75], [0.046, 0.84], [0.044, 0.925]], [[-0.048, 0.75], [-0.046, 0.84], [-0.044, 0.925]],
];

// ── the organs, head to toe (front view) ──
const O = {
  brain: { shapes: [{ k: 'blob', p: [[0, 0.014], [0.022, 0.014], [0.036, 0.026], [0.04, 0.046], [0.034, 0.064], [0.016, 0.072], [0, 0.068], [-0.016, 0.072], [-0.034, 0.064], [-0.04, 0.046], [-0.036, 0.026], [-0.022, 0.014]] }], c: [0, 0.043], r: 0.042 },
  eyes: { shapes: [{ k: 'ell', x: 0.017, y: 0.074, rx: 0.009, ry: 0.0055 }], mirror: true, c: [0, 0.074], r: 0.03, box: [-0.06, 0.03, 0.06, 0.12] },
  thyroid: { shapes: [{ k: 'blob', p: [[0, 0.142], [0.008, 0.136], [0.016, 0.13], [0.021, 0.137], [0.018, 0.148], [0.008, 0.151], [0, 0.149], [-0.008, 0.151], [-0.018, 0.148], [-0.021, 0.137], [-0.016, 0.13], [-0.008, 0.136]] }], c: [0, 0.141], r: 0.025, box: [-0.06, 0.1, 0.06, 0.18] },
  lungs: { shapes: [
    { k: 'blob', p: [[-0.013, 0.188], [-0.036, 0.176], [-0.064, 0.2], [-0.075, 0.25], [-0.072, 0.298], [-0.046, 0.308], [-0.02, 0.292], [-0.012, 0.24]] },
    { k: 'blob', p: [[0.013, 0.188], [0.036, 0.176], [0.062, 0.2], [0.073, 0.25], [0.07, 0.296], [0.046, 0.304], [0.036, 0.285], [0.034, 0.258], [0.02, 0.238]] },
  ], marks: [[[-0.012, 0.18], [0, 0.17], [0.012, 0.18]], [[0, 0.15], [0, 0.17]]], c: [0, 0.245], r: 0.07 },
  heart: { shapes: [
    { k: 'blob', p: [[-0.016, 0.252], [-0.002, 0.242], [0.018, 0.244], [0.034, 0.258], [0.042, 0.28], [0.03, 0.294], [0.012, 0.292], [-0.008, 0.282], [-0.018, 0.268]] },
    { k: 'line', p: [[-0.002, 0.247], [0.002, 0.229], [0.016, 0.226], [0.02, 0.24]], w: 0.008 },
  ], c: [0.012, 0.268], r: 0.032 },
  liver: { shapes: [{ k: 'blob', p: [[-0.076, 0.304], [-0.03, 0.297], [0.012, 0.305], [0.034, 0.314], [0.004, 0.33], [-0.038, 0.348], [-0.068, 0.352], [-0.082, 0.33]] }], c: [-0.032, 0.322], r: 0.05 },
  gall: { shapes: [{ k: 'blob', p: [[-0.03, 0.338], [-0.022, 0.342], [-0.024, 0.358], [-0.032, 0.363], [-0.038, 0.354], [-0.036, 0.342]] }], c: [-0.03, 0.351], r: 0.02, box: [-0.1, 0.29, 0.06, 0.4] },
  stomach: { shapes: [{ k: 'blob', p: [[0.012, 0.312], [0.03, 0.304], [0.052, 0.31], [0.064, 0.33], [0.058, 0.356], [0.036, 0.372], [0.012, 0.37], [0, 0.358], [0.014, 0.352], [0.03, 0.354], [0.04, 0.34], [0.034, 0.326], [0.018, 0.326]] }], c: [0.036, 0.338], r: 0.036 },
  spleen: { shapes: [{ k: 'blob', p: [[0.07, 0.305], [0.082, 0.312], [0.086, 0.33], [0.08, 0.348], [0.07, 0.344], [0.068, 0.326]] }], c: [0.077, 0.327], r: 0.022, box: [0, 0.27, 0.12, 0.39] },
  pancreas: { shapes: [{ k: 'blob', p: [[-0.024, 0.364], [-0.004, 0.356], [0.03, 0.356], [0.062, 0.35], [0.068, 0.357], [0.04, 0.366], [0.004, 0.372], [-0.02, 0.376]] }], c: [0.02, 0.364], r: 0.03 },
  adrenals: { shapes: [{ k: 'blob', p: [[0.036, 0.376], [0.047, 0.36], [0.06, 0.374], [0.05, 0.38]] }], mirror: true, c: [0, 0.372], r: 0.06, box: [-0.09, 0.33, 0.09, 0.43] },
  kidneys: { shapes: [{ k: 'blob', p: [[0.05, 0.38], [0.036, 0.386], [0.034, 0.4], [0.038, 0.41], [0.036, 0.422], [0.05, 0.428], [0.062, 0.416], [0.064, 0.394]] }], mirror: true, c: [0, 0.404], r: 0.064 },
  small: { shapes: [{ k: 'line', p: [[-0.03, 0.42], [0.028, 0.418], [0.03, 0.43], [-0.03, 0.434], [-0.032, 0.446], [0.03, 0.445], [0.03, 0.457], [-0.028, 0.46], [-0.024, 0.47], [0.02, 0.469]], w: 0.008 }], c: [0, 0.445], r: 0.042 },
  large: { shapes: [{ k: 'line', p: [[-0.03, 0.486], [-0.052, 0.46], [-0.054, 0.43], [-0.05, 0.405], [-0.02, 0.398], [0.02, 0.398], [0.052, 0.405], [0.056, 0.44], [0.05, 0.47], [0.03, 0.488], [0.012, 0.484]], w: 0.012 }], c: [0, 0.442], r: 0.06 },
  bladder: { shapes: [{ k: 'blob', p: [[0, 0.484], [0.018, 0.488], [0.022, 0.502], [0.012, 0.514], [0, 0.516], [-0.012, 0.514], [-0.022, 0.502], [-0.018, 0.488]] }], c: [0, 0.5], r: 0.024, box: [-0.07, 0.44, 0.07, 0.56] },
  bones: { shapes: SKELETON.map(p => ({ k: 'line', p, w: 0.007 } as Shape)), quiet: true, c: [0, 0.45], r: 0.1, box: [-0.2, 0, 0.2, 1] },
  marrow: { shapes: [
    { k: 'line', p: [[0, 0.184], [0, 0.258]], w: 0.006 },
    { k: 'blob', p: [[0.02, 0.468], [0.05, 0.442], [0.074, 0.448], [0.07, 0.474], [0.046, 0.49], [0.024, 0.49]] },
    { k: 'blob', p: [[-0.02, 0.468], [-0.05, 0.442], [-0.074, 0.448], [-0.07, 0.474], [-0.046, 0.49], [-0.024, 0.49]] },
    { k: 'line', p: [[0.066, 0.5], [0.06, 0.58]], w: 0.006 }, { k: 'line', p: [[-0.066, 0.5], [-0.06, 0.58]], w: 0.006 },
    { k: 'line', p: [[0.002, 0.3], [0.003, 0.4]], w: 0.006 },
  ], quiet: true, c: [0, 0.4], r: 0.08, box: [-0.12, 0.15, 0.12, 0.62] },
  nodes: { shapes: [
    ...[[0.024, 0.128], [0.03, 0.14], [0.026, 0.152], [0.082, 0.226], [0.088, 0.238], [0.078, 0.244], [0.04, 0.498], [0.048, 0.508], [0.034, 0.51], [0.012, 0.42], [-0.014, 0.43], [0.006, 0.44]]
      .map(([x, y]) => ({ k: 'ell', x, y, rx: 0.0055, ry: 0.004 } as Shape)),
    { k: 'line', p: [[0.026, 0.152], [0.03, 0.2], [0.08, 0.235]], w: 0.0018 },
    { k: 'line', p: [[0.024, 0.155], [0.012, 0.3], [0.012, 0.42], [0.04, 0.5]], w: 0.0018 },
  ], mirror: true, quiet: true, c: [0, 0.32], r: 0.1, box: [-0.2, 0.08, 0.2, 0.58] },
  skin: { shapes: [{ k: 'skin' }], c: [0, 0.5], r: 0.12, box: [-0.22, 0, 0.22, 1] },
} as const satisfies Record<string, Geo>;

// ── the muscles: the front, then the back (pairs drawn on both sides) ──
const M = {
  masseter: { shapes: [{ k: 'blob', p: [[0.024, 0.086], [0.036, 0.084], [0.042, 0.096], [0.036, 0.114], [0.026, 0.116], [0.022, 0.1]] }], mirror: true, c: [0, 0.1], r: 0.05, box: [-0.07, 0.03, 0.07, 0.16] },
  scm: { shapes: [{ k: 'line', p: [[0.03, 0.104], [0.022, 0.128], [0.009, 0.156]], w: 0.009 }], mirror: true, c: [0, 0.13], r: 0.04, box: [-0.08, 0.06, 0.08, 0.19] },
  pectoral: { shapes: [{ k: 'blob', p: [[0.006, 0.18], [0.05, 0.172], [0.088, 0.186], [0.098, 0.212], [0.078, 0.236], [0.04, 0.252], [0.008, 0.25]] }], mirror: true, c: [0, 0.215], r: 0.08 },
  deltoid: { shapes: [{ k: 'blob', p: [[0.084, 0.164], [0.11, 0.17], [0.127, 0.196], [0.131, 0.232], [0.12, 0.246], [0.106, 0.226], [0.094, 0.196]] }], mirror: true, c: [0, 0.205], r: 0.13, box: [-0.16, 0.12, 0.16, 0.3] },
  biceps: { shapes: [{ k: 'blob', p: [[0.108, 0.245], [0.121, 0.238], [0.134, 0.268], [0.14, 0.31], [0.136, 0.345], [0.127, 0.342], [0.116, 0.302], [0.108, 0.272]] }], mirror: true, c: [0, 0.29], r: 0.14, box: [-0.18, 0.2, 0.18, 0.38] },
  diaphragm: { shapes: [{ k: 'blob', p: [[-0.08, 0.322], [-0.05, 0.294], [0, 0.284], [0.05, 0.29], [0.08, 0.32], [0.05, 0.31], [0, 0.302], [-0.05, 0.312]] }], c: [0, 0.3], r: 0.07 },
  rectus: { shapes: [{ k: 'blob', p: [[0.004, 0.27], [0.03, 0.274], [0.034, 0.33], [0.031, 0.42], [0.022, 0.5], [0.005, 0.506]] }], mirror: true, marks: [[[-0.03, 0.31], [0.03, 0.31]], [[-0.032, 0.358], [0.032, 0.358]], [[-0.031, 0.405], [0.031, 0.405]], [[0, 0.27], [0, 0.5]]], c: [0, 0.385], r: 0.06 },
  obliques: { shapes: [{ k: 'blob', p: [[0.04, 0.3], [0.078, 0.306], [0.084, 0.36], [0.093, 0.41], [0.086, 0.452], [0.052, 0.44], [0.037, 0.38]] }], mirror: true, c: [0, 0.38], r: 0.1 },
  quadriceps: { shapes: [{ k: 'blob', p: [[0.036, 0.53], [0.07, 0.5], [0.095, 0.53], [0.09, 0.62], [0.076, 0.69], [0.052, 0.708], [0.038, 0.65], [0.032, 0.58]] }], mirror: true, c: [0, 0.6], r: 0.1 },
  sartorius: { shapes: [{ k: 'line', p: [[0.092, 0.47], [0.074, 0.54], [0.048, 0.63], [0.035, 0.72]], w: 0.008 }], mirror: true, c: [0, 0.6], r: 0.1, box: [-0.12, 0.44, 0.12, 0.76] },
  adductors: { shapes: [{ k: 'blob', p: [[0.009, 0.515], [0.04, 0.522], [0.046, 0.6], [0.036, 0.664], [0.022, 0.6], [0.011, 0.55]] }], mirror: true, c: [0, 0.58], r: 0.07 },
  tibialis: { shapes: [{ k: 'blob', p: [[0.052, 0.762], [0.066, 0.766], [0.066, 0.83], [0.058, 0.9], [0.05, 0.92], [0.047, 0.85]] }], mirror: true, c: [0, 0.84], r: 0.08 },
  // the back
  calf: { shapes: [{ k: 'blob', p: [[0.034, 0.752], [0.066, 0.746], [0.08, 0.792], [0.07, 0.852], [0.055, 0.9], [0.042, 0.89], [0.035, 0.82]] }], mirror: true, c: [0, 0.82], r: 0.09 },
  hamstrings: { shapes: [{ k: 'blob', p: [[0.03, 0.562], [0.086, 0.562], [0.088, 0.62], [0.075, 0.7], [0.046, 0.712], [0.03, 0.64]] }], mirror: true, c: [0, 0.635], r: 0.1 },
  gluteus: { shapes: [{ k: 'blob', p: [[0.005, 0.462], [0.06, 0.447], [0.097, 0.476], [0.1, 0.522], [0.08, 0.56], [0.04, 0.566], [0.006, 0.546]] }], mirror: true, c: [0, 0.505], r: 0.1 },
  erector: { shapes: [{ k: 'blob', p: [[0.006, 0.19], [0.022, 0.19], [0.03, 0.3], [0.03, 0.42], [0.022, 0.47], [0.006, 0.47]] }], mirror: true, c: [0, 0.33], r: 0.06 },
  latissimus: { shapes: [{ k: 'blob', p: [[0.032, 0.27], [0.086, 0.222], [0.097, 0.25], [0.09, 0.33], [0.08, 0.38], [0.05, 0.442], [0.032, 0.42]] }], mirror: true, c: [0, 0.33], r: 0.1 },
  triceps: { shapes: [{ k: 'blob', p: [[0.106, 0.24], [0.124, 0.233], [0.139, 0.27], [0.145, 0.33], [0.131, 0.346], [0.116, 0.31]] }], mirror: true, c: [0, 0.29], r: 0.14, box: [-0.18, 0.2, 0.18, 0.38] },
  trapezius: { shapes: [{ k: 'blob', p: [[0, 0.112], [0.018, 0.13], [0.06, 0.158], [0.104, 0.172], [0.06, 0.2], [0.026, 0.28], [0, 0.34], [-0.026, 0.28], [-0.06, 0.2], [-0.104, 0.172], [-0.06, 0.158], [-0.018, 0.13]] }], c: [0, 0.2], r: 0.09 },
} as const satisfies Record<string, Geo>;

// ── the limbs: bands across the outline, the person's LEFT side at x > 0 (front view) ──
/** A limb segment's bands for the person's left side; the right side mirrors them. */
const LIMB_L: Readonly<Record<string, { bands: readonly (readonly P[])[]; c: P; r: number; box: readonly [number, number, number, number] }>> = {
  toes: { bands: [[[0.015, 0.983], [0.09, 0.976], [0.09, 1.01], [0.015, 1.01]]], c: [0.05, 0.993], r: 0.03, box: [0, 0.9, 0.11, 1.01] },
  foot: { bands: [[[0.015, 0.95], [0.09, 0.95], [0.09, 0.978], [0.015, 0.986]]], c: [0.05, 0.968], r: 0.034, box: [0, 0.89, 0.11, 1.01] },
  ankle: { bands: [[[0.015, 0.922], [0.09, 0.918], [0.09, 0.952], [0.015, 0.952]]], c: [0.044, 0.936], r: 0.03, box: [-0.01, 0.86, 0.11, 1.0] },
  shin: { bands: [[[0.015, 0.755], [0.1, 0.755], [0.1, 0.924], [0.015, 0.924]]], c: [0.053, 0.84], r: 0.05, box: [-0.02, 0.72, 0.12, 0.96] },
  knee: { bands: [[[0.012, 0.69], [0.1, 0.69], [0.1, 0.757], [0.012, 0.757]]], c: [0.053, 0.722], r: 0.04, box: [-0.02, 0.62, 0.12, 0.82] },
  thigh: { bands: [[[0.003, 0.548], [0.12, 0.548], [0.12, 0.692], [0.003, 0.692]]], c: [0.058, 0.62], r: 0.055, box: [-0.02, 0.48, 0.14, 0.76] },
  hip: { bands: [[[0.004, 0.53], [0.03, 0.47], [0.072, 0.448], [0.12, 0.44], [0.12, 0.55], [0.004, 0.55]]], c: [0.066, 0.5], r: 0.05, box: [-0.04, 0.4, 0.14, 0.6] },
  fingers: { bands: [[[0.145, 0.562], [0.23, 0.562], [0.23, 0.62], [0.145, 0.62]], [[0.193, 0.505], [0.23, 0.505], [0.23, 0.562], [0.193, 0.562]]], c: [0.18, 0.575], r: 0.03, box: [0.12, 0.48, 0.23, 0.62] },
  hand: { bands: [[[0.148, 0.5], [0.196, 0.5], [0.193, 0.562], [0.148, 0.562]]], c: [0.174, 0.532], r: 0.03, box: [0.12, 0.46, 0.23, 0.62] },
  wrist: { bands: [[[0.145, 0.474], [0.205, 0.468], [0.205, 0.502], [0.145, 0.502]]], c: [0.169, 0.488], r: 0.026, box: [0.11, 0.42, 0.23, 0.58] },
  forearm: { bands: [[[0.12, 0.383], [0.182, 0.38], [0.205, 0.47], [0.145, 0.476]]], c: [0.156, 0.428], r: 0.04, box: [0.09, 0.34, 0.23, 0.52] },
  elbow: { bands: [[[0.11, 0.334], [0.172, 0.33], [0.182, 0.382], [0.12, 0.386]]], c: [0.138, 0.358], r: 0.03, box: [0.08, 0.28, 0.21, 0.44] },
  arm: { bands: [[[0.099, 0.236], [0.16, 0.226], [0.172, 0.332], [0.11, 0.336]]], c: [0.124, 0.285], r: 0.04, box: [0.06, 0.18, 0.2, 0.39] },
  shoulder: { bands: [[[0.07, 0.15], [0.135, 0.155], [0.16, 0.236], [0.099, 0.238], [0.086, 0.2]]], c: [0.112, 0.2], r: 0.04, box: [0.03, 0.12, 0.19, 0.29] },
};

export type LimbPart = 'toes' | 'foot' | 'ankle' | 'shin' | 'knee' | 'thigh' | 'hip' | 'fingers' | 'hand' | 'wrist' | 'forearm' | 'elbow' | 'arm' | 'shoulder';
export const LEG_PARTS: readonly LimbPart[] = ['toes', 'foot', 'ankle', 'shin', 'knee', 'thigh', 'hip'];
export const ARM_PARTS: readonly LimbPart[] = ['fingers', 'hand', 'wrist', 'forearm', 'elbow', 'arm', 'shoulder'];

/** A limb segment's geometry for a side ('L' the person's left: x > 0 in the front view; 'R' mirrored). */
export function limbGeo(part: LimbPart, side: 'L' | 'R'): Geo {
  const g = LIMB_L[part];
  const s = side === 'L' ? 1 : -1;
  const m = (pts: readonly P[]): P[] => pts.map(([x, y]) => [s * x, y] as P);
  const [x0, y0, x1, y1] = g.box;
  return {
    shapes: g.bands.map(b => ({ k: 'poly', p: m(b) } as Shape)), clip: 'body',
    c: [s * g.c[0], g.c[1]], r: g.r, box: s > 0 ? [x0, y0, x1, y1] : [-x1, y0, -x0, y1],
  };
}

export type OrganKey = keyof typeof O;
export type MuscleKey = keyof typeof M;
export const ORGAN_GEO: Readonly<Record<OrganKey, Geo>> = O;
export const MUSCLE_GEO: Readonly<Record<MuscleKey, Geo>> = M;

/** The extent of a geometry's shapes (mirrored too), in its units. */
export function geoBox(g: Geo): readonly [number, number, number, number] {
  if (g.box) return g.box;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const s of g.shapes) {
    const pts: P[] = s.k === 'ell' ? [[s.x - s.rx, s.y - s.ry], [s.x + s.rx, s.y + s.ry]] : s.k === 'skin' ? [[-FIG_HALF, 0], [FIG_HALF, 1]] : [...s.p];
    for (const [x, y] of pts) { add(x, y); if (g.mirror) add(-x, y); }
  }
  return [x0, y0, x1, y1];
}
