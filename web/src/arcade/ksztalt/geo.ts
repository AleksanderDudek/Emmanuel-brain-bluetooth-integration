/**
 * Lekkość i siła's figures (DESIGN.md §24): a calm, featureless person of light in the family of the meditations'
 * figure (kit/figure.ts) — seen from the front, and in profile — in the silhouette the player chose: `ona`, a
 * woman's (narrower shoulders, a waist, fuller hips; in profile a soft line of the bust), or `on`, a man's (broader
 * shoulders, a straighter waist; in profile the line of the chest).  Light and line only: no features, no anatomy of
 * the breasts or of the body's private parts, never sexualised.
 *
 * Units: the figure's own (H = 1 from the crown to the soles; x across, 0 on the midline, the viewer's left
 * negative; y down).  The worlds draw it ×100 (world units, `F`), the crown at (0, 0), the soles at y = 100.
 */
import { capsule, cw, footShapes, handShapes, polygon, spline, type P, type ToScreen } from '../kit/figure';

export type Look = 'ona' | 'on';
export const LOOKS: readonly Look[] = ['ona', 'on'];
export const lookOf = (l: string): Look => (l === 'on' ? 'on' : 'ona');

/** figure units → world units */
export const F = 100;

// ── the front ───────────────────────────────────────────────────

/** The body's right half (the viewer's right) from the crown to the crotch, per silhouette (the hands and feet of kit/figure join it). */
const RIGHT: Readonly<Record<Look, readonly P[]>> = {
  ona: [
    [0, 0], [0.028, 0.008], [0.044, 0.031], [0.049, 0.064], [0.045, 0.097], [0.035, 0.122], [0.022, 0.14],
    [0.022, 0.163], [0.027, 0.181], [0.058, 0.194], [0.089, 0.203],
    [0.108, 0.219], [0.117, 0.25], [0.125, 0.3], [0.137, 0.36], [0.15, 0.415], [0.162, 0.462], [0.17, 0.486],
    [0.161, 0.496], [0.152, 0.488], [0.145, 0.46], [0.133, 0.415], [0.118, 0.36], [0.104, 0.302], [0.092, 0.252],
    [0.09, 0.274], [0.088, 0.305], [0.076, 0.36], [0.075, 0.392], [0.091, 0.445], [0.102, 0.49], [0.101, 0.535],
    [0.096, 0.58], [0.086, 0.65], [0.074, 0.728], [0.07, 0.8], [0.058, 0.88], [0.05, 0.938], [0.049, 0.956],
    [0.037, 0.962], [0.025, 0.956], [0.022, 0.94], [0.025, 0.88], [0.029, 0.8], [0.024, 0.728], [0.019, 0.63], [0.006, 0.545],
  ],
  on: [
    [0, 0], [0.03, 0.008], [0.047, 0.031], [0.052, 0.064], [0.048, 0.097], [0.039, 0.124], [0.027, 0.142],
    [0.028, 0.162], [0.036, 0.179], [0.074, 0.191], [0.112, 0.2],
    [0.131, 0.218], [0.139, 0.25], [0.142, 0.3], [0.149, 0.36], [0.157, 0.415], [0.165, 0.462], [0.17, 0.486],
    [0.161, 0.496], [0.152, 0.488], [0.148, 0.46], [0.141, 0.415], [0.131, 0.36], [0.121, 0.302], [0.109, 0.25],
    [0.105, 0.272], [0.101, 0.31], [0.089, 0.385], [0.092, 0.45], [0.095, 0.5],
    [0.094, 0.56], [0.087, 0.64], [0.076, 0.728], [0.073, 0.8], [0.061, 0.88], [0.052, 0.938], [0.049, 0.956],
    [0.037, 0.962], [0.025, 0.956], [0.022, 0.94], [0.025, 0.88], [0.031, 0.8], [0.026, 0.728], [0.022, 0.62], [0.008, 0.535],
  ],
};

/** The whole outline, clockwise on screen: the right half down, the left half (mirrored) back up. */
export const frontOutline = (look: Look): readonly P[] => [
  ...RIGHT[look],
  ...RIGHT[look].slice(1).reverse().map(([x, y]) => [-x, y] as P),
];

/** The figure seen from the front as one path (the body, both hands, both feet), mapped by `map`. */
export function frontPath(look: Look, map: ToScreen): Path2D {
  const p = new Path2D();
  spline(p, frontOutline(look), map, true);
  for (const side of [1, -1] as const) {
    for (const s of handShapes(side)) if (s.smooth) spline(p, s.pts, map, true); else polygon(p, s.pts, map);
    for (const s of footShapes(side)) if (s.smooth) spline(p, s.pts, map, true); else polygon(p, s.pts, map);
  }
  return p;
}

/** World units, upright: figure point × F. */
export const up: ToScreen = (x, y) => [x * F, y * F];

/**
 * The figure lying on its back seen from above (the night of "Sen"): the head to the viewer's left, the feet to the
 * right, the body's midline along y = 0; the figure's x (its right, the viewer's right when standing) goes down.
 */
export const lying: ToScreen = (x, y) => [(y - 0.5) * F, x * F];

/** Half the body's width at a height (figure units), read from the outline (the torso and legs, arms left out). */
export function halfAt(look: Look, y: number): number {
  const r = RIGHT[look];
  const side = [...r.slice(0, 11), ...r.slice(25)]; // head, neck, shoulder; then the side, the hip, the leg
  let best = 0.05, d = 1;
  for (let i = 1; i < side.length; i++) {
    const [x0, y0] = side[i - 1], [x1, y1] = side[i];
    if ((y - y0) * (y - y1) <= 0 && y1 !== y0) {
      const k = (y - y0) / (y1 - y0);
      const dd = Math.abs(k - 0.5);
      if (dd < d) { d = dd; best = x0 + (x1 - x0) * k; }
    }
  }
  return best;
}

/** The body's places from the front (figure units). */
export const PLACE = {
  crown: [0, 0.004], hypothalamus: [0, 0.074], mouth: [0, 0.112], throat: [0, 0.165], sternum: [0, 0.235],
  heart: [0.018, 0.27], stomach: [0.034, 0.335], navel: [0, 0.4], belly: [0, 0.44], base: [0, 0.525],
  lungL: [-0.045, 0.29], lungR: [0.045, 0.29],
  thighL: [-0.055, 0.62], thighR: [0.055, 0.62], armL: [-0.13, 0.32], armR: [0.13, 0.32],
} as const satisfies Record<string, P>;

/** The lungs from the front: each a soft lobe (figure units, the viewer's left lung first). */
export function lungShape(side: 1 | -1, look: Look): P[] {
  const w = look === 'on' ? 1.05 : 0.96;
  const base: P[] = [
    [0.014, 0.205], [0.028, 0.196], [0.045, 0.205], [0.06, 0.226], [0.07, 0.26], [0.075, 0.3], [0.074, 0.34],
    [0.068, 0.368], [0.052, 0.374], [0.034, 0.366], [0.02, 0.346], [0.013, 0.31], [0.012, 0.26],
  ];
  return base.map(([x, y]) => [side * x * w, y]);
}

/** The airways: the windpipe and the two main bronchi branching twice (figure units, polylines). */
export function airways(): P[][] {
  const out: P[][] = [[[0, 0.15], [0, 0.222]]];
  for (const s of [1, -1] as const) {
    out.push([[0, 0.222], [s * 0.022, 0.245], [s * 0.034, 0.27]]);
    out.push([[s * 0.034, 0.27], [s * 0.05, 0.25], [s * 0.058, 0.23]]);
    out.push([[s * 0.034, 0.27], [s * 0.044, 0.3], [s * 0.058, 0.33]]);
    out.push([[s * 0.034, 0.27], [s * 0.028, 0.31], [s * 0.032, 0.35]]);
  }
  return out;
}

/** The shoulder blades from behind (figure units): a triangle each, the medial border near the spine. */
export function scapula(side: 1 | -1, retract: number): P[] {
  const dx = -side * 0.012 * retract;
  const pts: P[] = [[0.03, 0.208], [0.088, 0.208], [0.083, 0.232], [0.062, 0.29], [0.04, 0.318], [0.03, 0.26]];
  return pts.map(([x, y]) => [side * x + dx, y]);
}

// ── the profile ─────────────────────────────────────────────────

/**
 * The figure in profile facing the viewer's left (x < 0 is the front), upright, from the crown round the face,
 * down the front to the toes, back along the sole and up the back.  The two silhouettes differ at the chest (a soft
 * bust line for `ona`, the line of the chest muscle for `on`), the waist and the hips.
 */
const PROFILE: Readonly<Record<Look, readonly P[]>> = {
  ona: [
    [0, 0], [-0.032, 0.013], [-0.044, 0.04], [-0.046, 0.058], [-0.051, 0.073], [-0.046, 0.086], [-0.045, 0.102],
    [-0.039, 0.116], [-0.026, 0.126], [-0.024, 0.142], [-0.025, 0.163], [-0.031, 0.185], [-0.045, 0.205],
    [-0.062, 0.238], [-0.07, 0.266], [-0.066, 0.29], [-0.05, 0.305], [-0.046, 0.335], [-0.048, 0.37], [-0.052, 0.41],
    [-0.054, 0.45], [-0.052, 0.5], [-0.048, 0.56], [-0.043, 0.66], [-0.038, 0.73], [-0.031, 0.8], [-0.025, 0.9],
    [-0.023, 0.95], [-0.047, 0.978], [-0.068, 0.992], [-0.066, 1], [0, 1], [0.027, 0.995], [0.029, 0.97],
    [0.02, 0.94], [0.032, 0.85], [0.042, 0.78], [0.032, 0.73], [0.042, 0.66], [0.056, 0.58], [0.067, 0.525],
    [0.063, 0.47], [0.04, 0.415], [0.035, 0.375], [0.043, 0.32], [0.05, 0.27], [0.048, 0.222], [0.038, 0.185],
    [0.034, 0.152], [0.045, 0.118], [0.049, 0.07], [0.038, 0.03], [0.019, 0.005],
  ],
  on: [
    [0, 0], [-0.034, 0.014], [-0.047, 0.042], [-0.049, 0.06], [-0.055, 0.076], [-0.049, 0.089], [-0.048, 0.105],
    [-0.042, 0.12], [-0.028, 0.13], [-0.026, 0.145], [-0.028, 0.164], [-0.035, 0.186], [-0.053, 0.204],
    [-0.066, 0.236], [-0.069, 0.266], [-0.063, 0.295], [-0.057, 0.31], [-0.055, 0.34], [-0.055, 0.38], [-0.057, 0.42],
    [-0.058, 0.46], [-0.055, 0.5], [-0.05, 0.56], [-0.045, 0.66], [-0.04, 0.73], [-0.032, 0.8], [-0.026, 0.9],
    [-0.024, 0.95], [-0.05, 0.978], [-0.074, 0.992], [-0.072, 1], [0, 1], [0.03, 0.995], [0.032, 0.97],
    [0.022, 0.94], [0.035, 0.85], [0.045, 0.78], [0.035, 0.73], [0.045, 0.66], [0.055, 0.58], [0.062, 0.53],
    [0.06, 0.48], [0.045, 0.42], [0.042, 0.38], [0.05, 0.32], [0.059, 0.27], [0.058, 0.222], [0.043, 0.186],
    [0.038, 0.153], [0.048, 0.12], [0.052, 0.072], [0.04, 0.031], [0.02, 0.005],
  ],
};

/** A smooth 0..1 step. */
const sstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * How a point of the profile moves when the posture sinks (u = 0) from upright (u = 1): the head forward and a
 * little down, the upper back rounding, the chest sinking back and down — the forward head and rounded shoulders
 * that posture training reduces (Lynch et al. 2010).
 */
function slump([x, y]: P, u: number): P {
  const k = 1 - u;
  if (k <= 0) return [x, y];
  const head = 1 - sstep(0.13, 0.21, y);
  let dx = -0.034 * head, dy = 0.014 * head;
  const back = Math.exp(-(((y - 0.235) / 0.065) ** 2));
  const chest = Math.exp(-(((y - 0.27) / 0.06) ** 2));
  if (x > 0) dx += 0.022 * back * (1 - head);
  else { dx += 0.013 * chest * (1 - head); dy += 0.012 * chest * (1 - head); }
  // the belly lets go a little as the chest sinks
  const belly = Math.exp(-(((y - 0.4) / 0.05) ** 2));
  if (x < 0) dx -= 0.006 * belly;
  return [x + dx * k, y + dy * k];
}

/** The profile outline at a posture (u: 0 slumped … 1 upright). */
export const profileOutline = (look: Look, u: number): P[] => PROFILE[look].map(p => slump(p, u));

/** The upper arm alone (shoulder → elbow) as a closed shape, for a cleaner union with the forearm and the hand. */
export function profileArmPath(look: Look, u: number, map: ToScreen): Path2D {
  const sh = slump([look === 'on' ? 0.003 : 0.001, 0.212], u);
  const fwd = (1 - u) * -0.02;
  const elbow: P = [sh[0] + 0.006 + fwd * 0.6, 0.355];
  const wrist: P = [sh[0] - 0.004 + fwd * 0.4, 0.49];
  const tip: P = [wrist[0] - 0.006, 0.565];
  const r = look === 'on' ? 0.02 : 0.017;
  const p = new Path2D();
  polygon(p, cw(capsule(sh, elbow, r, r * 0.86)), map);
  polygon(p, cw(capsule(elbow, wrist, r * 0.86, r * 0.62)), map);
  spline(p, cw(capsule(wrist, tip, r * 0.66, r * 0.55)), map, true);
  return p;
}

/** The profile as one path. */
export function profilePath(look: Look, u: number, map: ToScreen): Path2D {
  const p = new Path2D();
  spline(p, profileOutline(look, u), map, true);
  return p;
}

/**
 * The places of the profile (figure units) at a posture: the ear's place (the head over the shoulders when
 * upright), the shoulder, the chest's front, the breastbone, the line of the chest muscle's insertion.
 */
export function profilePlaces(look: Look, u: number): { ear: P; shoulder: P; chest: P; sternum: P; insertion: P; clavicle: P } {
  return {
    ear: slump([0.008, 0.08], u),
    shoulder: slump([look === 'on' ? 0.003 : 0.001, 0.212], u),
    chest: slump([look === 'on' ? -0.068 : -0.07, 0.266], u),
    sternum: slump([-0.05, 0.255], u),
    insertion: slump([-0.006, 0.232], u),
    clavicle: slump([-0.03, 0.198], u),
  };
}

/** A point along a polyline of figure points by its share of the length. */
export function along(pts: readonly P[], k: number): P {
  let total = 0;
  const seg: number[] = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
  let want = Math.max(0, Math.min(1, k)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (want <= seg[i] || i === seg.length - 1) {
      const u = seg[i] ? Math.min(1, want / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
    }
    want -= seg[i];
  }
  return pts[pts.length - 1];
}

export type { P, ToScreen };
