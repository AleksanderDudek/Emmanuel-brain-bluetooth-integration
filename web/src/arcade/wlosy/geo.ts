/**
 * The geometry of Każdy włos's five pictures (DESIGN.md §15), in each picture's own units, without the canvas:
 *
 *   head      the head in profile, facing left (x −62…62, y −70…76): its outline, the ear, the cap of the galea
 *             between the frontal and the occipital belly, the five arteries of the scalp and where they join
 *   above     the head seen from above, the forehead up (x −58…58, y −64…64): the oval, the hairline, the crown's
 *             whorl, the flow of the hair (a swirl at the whorl, then forward, sideways and down the nape)
 *   skin      a square centimetre of the scalp close up from above (0…100): follicular units of 1–4 hairs
 *   section   the scalp cut through (x −90…90, y −30…100): the five layers S·C·A·L·P over the bone, slanted
 *             follicles reaching into the fat
 *   follicle  one follicle in detail, slanted (skin surface at y 0): drawn in its own frame — u down the axis
 *             from the opening, v across it (+v is the side of the gland and the muscle, the obtuse angle)
 *
 * Everything here is pure and deterministic (the tests read it): seeded positions come from `hash`.
 */

export type Pt = readonly [number, number];
export interface Rect { x: number; y: number; w: number; h: number }

/** A deterministic 0..1 for a number (decorations that never jump). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── the follicle ─────────────────────────────────────────────────
/** The follicle's opening on the skin (world units) and its tilt from the vertical (rad, ≈ 24°). */
export const FOL = { ox: 6, oy: 0, th: 0.42 } as const;

/** A point of the follicle's own frame (v across, u down the axis from the opening) in world units. */
export function folPt(v: number, u: number): Pt {
  const s = Math.sin(FOL.th), c = Math.cos(FOL.th);
  return [FOL.ox + v * c - u * s, FOL.oy + v * s + u * c];
}

/** Depths along the follicle (u) of its parts in anagen. */
export const FU = {
  /** the infundibulum (the canal's mouth) ends, the gland's duct opens */
  duct: 15,
  /** the gland's middle */
  gland: 22,
  /** the isthmus: the inner root sheath ends here */
  isthmus: 29,
  /** the bulge, where the arrector pili holds on */
  bulge: 35,
  /** the keratogenous zone: the cells harden between these depths */
  kerTop: 56,
  kerBottom: 76,
  /** the bulb's neck, its widest point, its bottom (anagen) */
  neck: 79,
  bulbMid: 92,
  bottom: 101,
  /** the papilla's apex and its widest point */
  papApex: 83.5,
  papMid: 95,
  /** the hair above the skin reaches up to here (negative: outside) */
  tip: -46,
  /** the length of the lower follicle in telogen (the papilla rests just below the bulge) */
  telogen: 47,
} as const;

/** Half-widths of the anagen follicle's layers (world units). */
export const FR = { shaft: 3.1, medulla: 0.95, irs: 4.6, ors: 7.4, cts: 8.4, bulb: 12.8, papilla: 6.2, bulgeOut: 10.4 } as const;

/** The views of the follicle (world rects): the bulb, the hardening zone, the whole follicle, its top at the skin. */
export function folViews(): Record<'bulb' | 'mid' | 'whole' | 'top', Rect> {
  const [bx, by] = folPt(0, FU.bulbMid);
  const [mx, my] = folPt(0, (FU.kerTop + FU.kerBottom) / 2);
  const [gx, gy] = folPt(7, 14);
  return {
    bulb: { x: bx - 25, y: by - 22, w: 50, h: 44 },
    mid: { x: mx - 23, y: my - 21, w: 46, h: 42 },
    whole: { x: -60, y: -46, w: 104, h: 152 },
    top: { x: gx - 31, y: gy - 30, w: 62, h: 58 },
  };
}

// ── the section of the scalp ─────────────────────────────────────
/** The layers' depths (world units, the skin's surface at 0): S·C·A·L·P over the bone. */
export const SEC = {
  epi: [0, 5],
  dermis: [5, 34],
  sub: [34, 58],
  galea: [58, 63],
  areolar: [63, 70.5],
  peri: [70.5, 73],
  bone: [73, 100],
  /** the follicles' tilt from the vertical (rad) and the arteries' depth in the fat */
  th: 0.5,
  artery: 50,
} as const;

/** The five layers of the scalp in order (the mnemonic SCALP), each with its depth range. */
export const LAYERS = [
  { key: 's', from: 0, to: 34 },
  { key: 'c', from: 34, to: 58 },
  { key: 'a', from: 58, to: 63 },
  { key: 'l', from: 63, to: 70.5 },
  { key: 'p', from: 70.5, to: 73 },
] as const;

export interface SecFollicle {
  /** the opening on the skin (x), the follicle's length along its axis, its cycle offset (0..1) and speed */
  x: number;
  len: number;
  phase: number;
  speed: number;
}

/**
 * The section's follicles: openings across the skin, some in pairs and threes (follicular units), each reaching
 * down into the fat; each keeps its own time (the mosaic of the cycle).  The middle one (index 4) is the
 * follicle the camera dives into.
 */
export const SEC_FOLLICLES: readonly SecFollicle[] = [
  { x: -76, len: 44, phase: 0.12, speed: 0.9 },
  { x: -55, len: 47, phase: 0.55, speed: 1.1 },
  { x: -50, len: 45, phase: 0.31, speed: 0.95 },
  { x: -27, len: 46, phase: 0.83, speed: 1.05 },
  { x: -2, len: 48, phase: 0.05, speed: 1 },
  { x: 3, len: 46, phase: 0.67, speed: 0.85 },
  { x: 26, len: 45, phase: 0.42, speed: 1.15 },
  { x: 49, len: 47, phase: 0.92, speed: 0.92 },
  { x: 54, len: 44, phase: 0.22, speed: 1.08 },
  { x: 58, len: 46, phase: 0.6, speed: 0.98 },
  { x: 80, len: 45, phase: 0.36, speed: 1.02 },
  // further out: seen only in a wide box
  { x: -152, len: 46, phase: 0.71, speed: 0.97 },
  { x: -126, len: 44, phase: 0.18, speed: 1.04 },
  { x: -121, len: 47, phase: 0.47, speed: 0.9 },
  { x: -100, len: 45, phase: 0.88, speed: 1.1 },
  { x: 103, len: 46, phase: 0.27, speed: 0.94 },
  { x: 126, len: 45, phase: 0.63, speed: 1.06 },
  { x: 131, len: 47, phase: 0.09, speed: 0.99 },
  { x: 154, len: 44, phase: 0.51, speed: 1.03 },
];

/** A point along a section follicle (u down its axis from the opening, v across), world units. */
export function secPt(f: SecFollicle, v: number, u: number): Pt {
  const s = Math.sin(SEC.th), c = Math.cos(SEC.th);
  return [f.x + v * c - u * s, v * s + u * c];
}

export function secViews(): Record<'full' | 'epi', Rect> {
  return { full: { x: -64, y: -20, w: 128, h: 118 }, epi: { x: -9, y: -3, w: 18, h: 13 } };
}

/**
 * The phase of the hair cycle at a point of a follicle's own time (0..1): anagen most of it, catagen a sliver,
 * telogen the rest (a 36-month anagen, 3 weeks of catagen, 3 months of telogen).
 */
export const CYCLE = { anagen: 36, catagen: 0.7, telogen: 3 } as const;
export const CYCLE_LEN = CYCLE.anagen + CYCLE.catagen + CYCLE.telogen;
export type Phase = 'anagen' | 'catagen' | 'telogen';
export function phaseAt(t: number): { phase: Phase; k: number } {
  const m = ((t % 1) + 1) % 1 * CYCLE_LEN;
  if (m < CYCLE.anagen) return { phase: 'anagen', k: m / CYCLE.anagen };
  if (m < CYCLE.anagen + CYCLE.catagen) return { phase: 'catagen', k: (m - CYCLE.anagen) / CYCLE.catagen };
  return { phase: 'telogen', k: (m - CYCLE.anagen - CYCLE.catagen) / CYCLE.telogen };
}

// ── the head in profile ──────────────────────────────────────────
/**
 * The profile's outline as cubic segments from the nape round the crown to the face and the throat: [start, ...
 * (c1, c2, end) triples].  Facing left; no features but the line of the face itself.
 */
export const PROFILE: readonly Pt[] = [
  [31, 76],
  [30, 52], [40, 34], [45, 14],
  [49, -4], [49, -30], [39, -48],
  [29, -62], [8, -66], [-8, -64],
  [-26, -61], [-38, -48], [-40, -30],
  [-41, -22], [-41, -17], [-43, -12],
  [-46, -6], [-50, 1], [-52, 6],
  [-53, 9], [-50, 11.5], [-45.5, 12],
  [-46.5, 15], [-46.8, 18], [-45, 20.5],
  [-46, 24], [-45.6, 27.5], [-43, 29.5],
  [-42.5, 33], [-43.5, 39], [-39, 44],
  [-35, 47.5], [-28, 49], [-21, 51],
  [-18, 58], [-17, 67], [-16, 76],
];

/** The ear (a C turned toward the back), as cubic segments. */
export const EAR: readonly Pt[] = [
  [9, -6],
  [13, -12], [24, -11], [24, -1],
  [24, 6], [21, 13], [16, 15],
  [12, 17], [9, 14], [9, 10],
];

/** The cranium's curve the galea lies on (the top of the skull, from the brow to the occiput). */
export const SKULL: readonly Pt[] = [
  [-36, -16], [-37, -34], [-29, -50], [-14, -59], [4, -61], [21, -57], [34, -47], [42, -32], [44, -14], [41, 2],
];

export type ArteryId = 'supratrochlear' | 'supraorbital' | 'temporal' | 'auricular' | 'occipital';
export const ARTERIES: readonly ArteryId[] = ['supratrochlear', 'supraorbital', 'temporal', 'auricular', 'occipital'];

/** Each artery as a polyline from where it comes up to the crown (its branches as more lines). */
export const ARTERY_PATHS: Readonly<Record<ArteryId, readonly (readonly Pt[])[]>> = {
  supratrochlear: [[[-38.5, -15], [-39.5, -26], [-36, -38], [-29, -49], [-21, -56]]],
  supraorbital: [[[-35, -14], [-34, -24], [-30, -35], [-22, -46], [-11, -55], [-1, -60]]],
  temporal: [
    [[7, 24], [5, 13], [3, 1], [1, -10], [-2, -17], [-10, -25], [-19, -33], [-27, -42]],
    [[1, -10], [3, -22], [7, -35], [10, -47], [12, -58]],
  ],
  auricular: [[[24, 19], [28, 8], [30, -4], [31, -17], [29, -30], [25, -42]]],
  occipital: [[[35, 40], [41, 24], [44, 6], [43, -12], [38, -29], [31, -42], [22, -53]]],
};

/** Where the arteries' ends join over the crown (pairs of points): the network of the scalp. */
export const ANASTOMOSES: readonly (readonly [Pt, Pt])[] = [
  [[-21, -56], [-11, -55]],
  [[-1, -60], [12, -58]],
  [[12, -58], [22, -53]],
  [[22, -53], [25, -42]],
  [[-27, -42], [-29, -49]],
];

/** The frontal and the occipital belly of the occipitofrontalis (centre, half-sizes, tilt), the muscle that pulls the galea. */
export const BELLIES = {
  frontal: { x: -37, y: -27, rx: 3.6, ry: 12, rot: 0.32 },
  occipital: { x: 44, y: -16, rx: 3.4, ry: 9, rot: -0.2 },
} as const;

/** The crown in profile (where a dive into the scalp begins), and the neck's pivot for lifting the head. */
export const CROWN: Pt = [8, -62];
export const NECK: Pt = [12, 60];

/** The head in profile: its view. */
export const HEAD_VIEW: Rect = { x: -64, y: -74, w: 128, h: 152 };

// ── the head from above ──────────────────────────────────────────
export const ABOVE = { cx: 0, cy: 2, rx: 39, ry: 49, hairline: -36 } as const;
/** The crown's whorl: behind the middle, a little to the right (as in most people). */
export const WHORL: Pt = [5, 16];
export const ABOVE_VIEW: Rect = { x: -60, y: -66, w: 120, h: 132 };
/** Where a dive from above into the skin close up begins. */
export const ABOVE_PORTAL: Pt = [15, 2];

/** Inside the head's oval (with a margin, + outside). */
export function inOval(x: number, y: number, grow = 0): boolean {
  const dx = (x - ABOVE.cx) / (ABOVE.rx + grow), dy = (y - ABOVE.cy) / (ABOVE.ry + grow);
  return dx * dx + dy * dy <= 1;
}

/**
 * The hair's direction at a point seen from above (a unit vector): a clockwise swirl around the whorl that opens
 * into streams flowing away from it — forward over the forehead, sideways over the temples, down the nape.
 */
export function flow(x: number, y: number): Pt {
  const dx = x - WHORL[0], dy = y - WHORL[1];
  const r = Math.hypot(dx, dy) || 1e-6;
  const rx = dx / r, ry = dy / r;
  // clockwise on the screen (y down): the tangent of (dx, dy) is (−dy, dx)
  const tx = -ry, ty = rx;
  const swirl = Math.exp(-r / 10);
  // in front of the ear line the hair turns forward a little more (toward the forehead)
  const fwd = y < WHORL[1] - 18 ? 0.22 : 0;
  let vx = rx * (1 - swirl) + tx * (0.5 + swirl), vy = ry * (1 - swirl) + ty * (0.5 + swirl) - fwd;
  const n = Math.hypot(vx, vy) || 1;
  vx /= n;
  vy /= n;
  return [vx, vy];
}

export interface Strand { x: number; y: number; d: number; len: number; tone: number }

/**
 * The strands seen from above: roots spread evenly over the hairy part of the scalp (a jittered grid), sorted
 * from the whorl outward (the order they appear in), each with its length and a tone (lighter and darker hairs).
 */
export function strands(n: number): Strand[] {
  const out: Strand[] = [];
  const side = Math.ceil(Math.sqrt(n * 1.9));
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      const k = i * side + j;
      const x = ABOVE.cx - ABOVE.rx + ((i + 0.15 + 0.7 * hash(k * 3 + 1)) / side) * 2 * ABOVE.rx;
      const y = ABOVE.cy - ABOVE.ry + ((j + 0.15 + 0.7 * hash(k * 5 + 2)) / side) * 2 * ABOVE.ry;
      if (!inOval(x, y, -2.5) || y < ABOVE.hairline + 3 * hash(k + 9)) continue;
      const d = Math.hypot(x - WHORL[0], y - WHORL[1]);
      out.push({ x, y, d, len: 15 + 8 * hash(k * 7 + 3), tone: hash(k * 11 + 4) });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, n);
}

/** A strand's polyline from its root along the flow (`len` world units, `steps` segments). */
export function strandPath(s: Pick<Strand, 'x' | 'y'>, len: number, steps = 5): Pt[] {
  const pts: Pt[] = [[s.x, s.y]];
  let x = s.x, y = s.y;
  const step = len / steps;
  for (let i = 0; i < steps; i++) {
    const [vx, vy] = flow(x, y);
    const nx = x + vx * step, ny = y + vy * step;
    // past the head's edge the hair falls away out of sight (from above it ends at the edge, with a little volume)
    if (!inOval(nx, ny, 2.5)) {
      if (inOval(x, y, 2.5)) pts.push([x + vx * step * 0.4, y + vy * step * 0.4]);
      break;
    }
    x = nx;
    y = ny;
    pts.push([x, y]);
  }
  return pts;
}

/** The three streams from the whorl (forward, sideways, down the nape), as polylines following the flow. */
export function streams(): Pt[][] {
  const seeds: Pt[] = [[2, 6], [-8, 13], [16, 12], [-6, 22], [12, 24], [4, 26]];
  return seeds.map(([x, y]) => {
    const pts: Pt[] = [[x, y]];
    let px = x, py = y;
    for (let i = 0; i < 40; i++) {
      const [vx, vy] = flow(px, py);
      px += vx * 1.6;
      py += vy * 1.6;
      if (!inOval(px, py, 4)) break;
      pts.push([px, py]);
    }
    return pts;
  });
}

// ── the skin close up ────────────────────────────────────────────
export interface Unit { x: number; y: number; n: 1 | 2 | 3 | 4; ang: number; order: number }

/**
 * A square centimetre of the scalp (0…100 units): 80 follicular units on a jittered grid — a quarter of them
 * single hairs, most pairs and threes, a few fours (about 2.1 hairs a unit, ≈ 170 hairs/cm²) — each slanted
 * along the stream, numbered in the order they appear (from the middle outward).
 */
export function units(): Unit[] {
  const out: Unit[] = [];
  const side = 9;
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      const k = i * side + j;
      if (k === 80) continue;
      const x = ((i + 0.2 + 0.6 * hash(k * 13 + 5)) / side) * 100;
      const y = ((j + 0.2 + 0.6 * hash(k * 17 + 6)) / side) * 100;
      const r = hash(k * 19 + 7);
      const n = (r < 0.25 ? 1 : r < 0.7 ? 2 : r < 0.95 ? 3 : 4) as Unit['n'];
      // the stream here runs down and to the right, turning a little across the patch
      const ang = 0.9 + 0.35 * ((x - 50) / 100) - 0.25 * ((y - 50) / 100) + 0.12 * (hash(k * 23 + 8) - 0.5);
      out.push({ x, y, n, ang, order: 0 });
    }
  }
  const byDist = [...out].sort((a, b) => Math.hypot(a.x - 50, a.y - 50) - Math.hypot(b.x - 50, b.y - 50));
  byDist.forEach((u, i) => { u.order = i; });
  return byDist;
}

export const SKIN_VIEW: Rect = { x: 2, y: 2, w: 96, h: 96 };

/** The hairs in the first `k` units (cumulative). */
export function hairsIn(list: readonly Unit[], k: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(k, list.length); i++) n += list[i].n;
  return n;
}
