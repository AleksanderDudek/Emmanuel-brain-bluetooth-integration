/**
 * Czujna straż's geometry (DESIGN.md §24): the four worlds in their own units, laid out once and shared by the
 * pictures and the library's views, labels and portals.
 *
 *   tissue   a living tissue in section: a capillary across its top with blood flowing, cells packed below with
 *            their soft "self" signs, one cell that has begun to change, a lymphatic capillary at the lower left
 *   node     a lymph node in section: afferent vessels, capsule, the sinus, the follicles, the T-cell zone, the
 *            medulla, the hilum with its efferent vessel
 *   synapse  one cytotoxic T cell and the cell it has recognised, side by side, their faces pressed into a synapse
 *   body     a figure without features, its lymph nodes and vessels, the thymus and the spleen
 *
 * Units are roughly micrometres in the tissue and the synapse (a lymphocyte is drawn 12–14 units across), a
 * stylised millimetre scale in the node and the body; only the relations are meant, the numbers live in the words.
 */
import { hash } from '../kit/healthlib/paint';
import type { Pt, Rect } from '../kit/healthlib/spec';

export type { Pt, Rect };

export const dist = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** A point along a polyline at a share of its length (0..1), and the polyline's segment lengths. */
export function along(pts: readonly Pt[], k: number): [number, number] {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  let want = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (want <= d || i === pts.length - 1) {
      const f = d > 0 ? Math.min(1, want / d) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    want -= d;
  }
  return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
}

/** The share of a polyline's length at which it passes nearest to a point, and how near. */
export function nearestOn(pts: readonly Pt[], p: Pt): { k: number; d: number } {
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    lens.push(d);
    total += d;
  }
  let best = { k: 0, d: Infinity };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
    const f = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - ay) * vy) / L2));
    const d = Math.hypot(ax + vx * f - p[0], ay + vy * f - p[1]);
    if (d < best.d) best = { k: (acc + lens[i - 1] * f) / total, d };
    acc += lens[i - 1];
  }
  return best;
}

/** A smooth curve through points, resampled finely (Catmull–Rom), for paths that cells travel along. */
export function spline(pts: readonly Pt[], per = 8): Pt[] {
  const out: Pt[] = [];
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ── the tissue ──────────────────────────────────────────────────
/** The capillary's centre line and half-width (its lumen runs across the top of the tissue). */
export const capY = (x: number): number => -46 + 5 * Math.sin(x * 0.018 + 0.6);
export const CAP_HALF = 9;
/** Where two lining cells of the capillary meet below the T cell that crosses (the junction it squeezes through). */
export const JUNCTION_X = -58;

/** The cell that has begun to change: muted, a little larger, its "self" signs few, its stress flags out. */
export const CHANGED: { at: Pt; r: number } = { at: [22, 14], r: 13 };

export interface TissueCell { x: number; y: number; r: number; rot: number; seed: number }

let cellsMemo: TissueCell[] | null = null;
/** The healthy cells of the tissue: a jittered packing over a wide field (any box's shape is filled). */
export function tissueCells(): TissueCell[] {
  if (cellsMemo) return cellsMemo;
  const out: TissueCell[] = [];
  const sx = 23, sy = 20;
  let n = 0;
  for (let j = -10; j <= 10; j++) {
    for (let i = -11; i <= 11; i++) {
      n++;
      const x = i * sx + (j % 2 ? sx / 2 : 0) + (hash(n * 3.1) - 0.5) * 7;
      const y = j * sy + (hash(n * 5.7) - 0.5) * 6;
      // not in the capillary's band nor the lymphatic's, and leave room round the changed cell
      if (Math.abs(y - capY(x)) < CAP_HALF + 9) continue;
      if (lymphDist([x, y]) < 14) continue;
      if (dist([x, y], CHANGED.at) < CHANGED.r + 10) continue;
      out.push({ x, y, r: 8.4 + 1.6 * hash(n * 7.3), rot: hash(n * 11.1) * Math.PI * 2, seed: n });
    }
  }
  cellsMemo = out;
  return out;
}

/** The lymphatic capillary at the lower left (blind-started, it carries lymph away towards a node). */
export const LYMPH: readonly Pt[] = spline([[-200, 22], [-150, 34], [-104, 56], [-74, 72], [-50, 100], [-34, 150], [-28, 220]], 10);
export const LYMPH_HALF = 7;
export function lymphDist(p: Pt): number {
  return nearestOn(LYMPH, p).d;
}
/** Where the dendritic cell slips into the lymphatic. */
export const LYMPH_ENTRY: Pt = [-70, 66];

/** The NK cell's round: it comes in from the left between the cells and ends at the changed cell. */
export const NK_PATH: readonly Pt[] = spline([[-128, 2], [-106, -8], [-86, 6], [-66, -4], [-46, 10], [-28, 2], [-12, 14], [4, 8]]);
/** The T cell's round (after it has crossed the capillary's wall): down from the vessel to the changed cell. */
export const T_PATH: readonly Pt[] = spline([[JUNCTION_X, -22], [-48, -12], [-56, 2], [-40, 10], [-24, -6], [-8, -10], [8, -6]]);

/** The cells a round passes close by, in the order it reaches them (each is checked once, then left in peace). */
export function touched(path: readonly Pt[], reach = 19): { cell: TissueCell; k: number }[] {
  const out: { cell: TissueCell; k: number }[] = [];
  for (const cell of tissueCells()) {
    const n = nearestOn(path, [cell.x, cell.y]);
    if (n.d < reach && n.k > 0.02 && n.k < 0.985) out.push({ cell, k: n.k });
  }
  return out.sort((a, b) => a.k - b.k);
}

/** The dendritic cell of the tissue and the directions of its long arms (the first reaches the changed cell). */
export const DC_AT: Pt = [-18, 42];
export const DC_ARMS: readonly { a: number; len: number }[] = [
  { a: Math.atan2(CHANGED.at[1] - DC_AT[1], CHANGED.at[0] - DC_AT[0]), len: 0 },
  { a: -2.2, len: 24 }, { a: -1.2, len: 19 }, { a: 1.25, len: 22 }, { a: 2.35, len: 26 }, { a: 3.05, len: 18 }, { a: 0.55, len: 17 },
];
/** the first arm reaches to the changed cell's membrane */
export const DC_REACH = dist(DC_AT, CHANGED.at) - CHANGED.r + 1;

/** The macrophage's way in to the changed cell (from below left). */
export const MAC_FROM: Pt = [-10, 60];

// ── the lymph node ──────────────────────────────────────────────
export const NODE_RX = 92, NODE_RY = 60;
/** The node's outline: a bean, its hilum on the right. */
export function nodeOutline(n = 96, inset = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let x = (NODE_RX - inset) * Math.cos(t), y = (NODE_RY - inset) * Math.sin(t);
    const w = Math.atan2(Math.sin(t), Math.cos(t));
    // a broad hilum: the middle of the right side drawn in between two rounded lobes (a bean)
    x -= 26 * Math.exp(-((w / 0.4) ** 2)) * Math.max(0.2, 1 - inset / 60);
    y *= 1 + 0.05 * Math.cos(2 * t);
    out.push([x, y]);
  }
  return out;
}
/** The B-cell follicles under the capsule (centre, radius, with a germinal centre). */
export const FOLLICLES: readonly { at: Pt; r: number; gc: boolean }[] = [
  1.25, 1.75, 2.2, 2.65, 3.1, 3.55, 4.0, 4.45, 4.95,
].map((t, i) => ({ at: [(NODE_RX - 17) * Math.cos(t), (NODE_RY - 15) * Math.sin(t) * 1.02] as Pt, r: 11 + 2.5 * hash(i * 3.3), gc: i % 2 === 0 }));
/** Where the dendritic cell meets the T cells (the T-cell zone, deeper than the follicles). */
export const MEET: Pt = [-44, 12];
/** Where the clones gather and multiply. */
export const CLONES: Pt = [-36, 10];
/** The afferent vessels: lymph from the tissues comes in on the convex side; the second brings the dendritic cell. */
export const AFFERENT: readonly (readonly Pt[])[] = [
  spline([[-170, -130], [-140, -96], [-104, -66], [-74, -46]]),
  spline([[-250, 22], [-190, 8], [-140, 4], [-92, 2]]),
  spline([[-160, 140], [-126, 104], [-96, 72], [-66, 50]]),
];
/** The dendritic cell's way: along the second afferent, into the sinus under the capsule, then inward to MEET. */
export const DC_ROUTE: readonly Pt[] = spline([[-124, 3], [-108, 2], [-92, 2], [-86, 7], [-78, 4], [-64, 9], MEET], 10);
/** The efferent vessel leaves at the hilum on the right. */
export const EFFERENT: readonly Pt[] = spline([[60, 1], [78, 3], [104, -2], [140, -14], [220, -18]]);
/** The hilum (where the efferent vessel leaves and the blood vessels enter). */
export const HILUM: Pt = [64, 0];
/** The medulla's cords: from the inner edge of the T-cell zone, branching, converging on the hilum. */
export function medullaCords(): Pt[][] {
  const out: Pt[][] = [];
  for (let i = 0; i < 11; i++) {
    const a = -1.25 + (2.5 * i) / 10;
    const x0 = -6 + 18 * (1 - Math.cos(a)) + 6 * (hash(i * 2.2) - 0.5), y0 = 36 * Math.sin(a);
    const midX = 22 + 8 * (hash(i * 4.1) - 0.5), midY = y0 * 0.55 + 5 * (hash(i + 3) - 0.5);
    out.push(spline([[x0, y0], [x0 * 0.5 + midX * 0.5, y0 * 0.8], [midX, midY], [44, y0 * 0.3], [HILUM[0] - 8, y0 * 0.14]], 6));
  }
  return out;
}

// ── the synapse ─────────────────────────────────────────────────
/** The cytotoxic T cell (left) and its target (right), their faces pressed together at the cleft. */
export const SYN = {
  t: { at: [-24, 0] as Pt, r: 26, face: -2.4 },
  k: { at: [28, 2] as Pt, r: 31, face: -1.2 },
  /** the synapse's half-height (where both faces meet) */
  half: 13,
};

// ── the body ────────────────────────────────────────────────────
/** The right half of a figure without features (x ≥ 0, from the crown down to the sole); mirrored for the left. */
const HALF: readonly Pt[] = [
  [0, -100], [6, -99], [10.5, -95], [12, -88], [11, -80], [8, -74], [6.5, -69], [8, -66.5], [17, -64], [24.5, -61], [28, -56], [29.5, -48],
  [31.5, -38], [34.5, -28], [38, -16], [41, -4], [43.5, 6], [44.5, 12], [43, 16], [40, 14], [38.5, 8], [35, -2], [30.5, -14], [27.5, -26],
  [25.5, -36], [24, -30], [22.5, -18], [22.5, -8], [24, 2], [24, 12], [22, 26], [19, 44], [17.5, 52], [17.5, 62], [16, 78], [14.5, 92],
  [16.5, 98], [16, 101], [6, 101], [5.5, 96], [6, 88], [6.5, 74], [6.5, 58], [5, 42], [3, 26], [1, 18], [0, 16],
];
export const BODY_OUTLINE: readonly Pt[] = [...HALF, ...HALF.slice(1, -1).reverse().map(([x, y]) => [-x, y] as Pt)];

/** Lymph nodes of the figure (a few of each group, mirrored), the thymus and the spleen (on the figure's left). */
export const BODY_NODES: readonly Pt[] = (() => {
  const right: Pt[] = [
    [7.5, -74], [9.5, -69], [8.5, -64.5], [15, -62], [22, -55], [21.5, -50], [24, -46], [35.5, -21], [4.5, -50], [5, -42],
    [6, -26], [9, -16], [4, -12], [14.5, 4], [17.5, 7.5], [12, 10], [13, 56],
  ];
  return [...right, ...right.map(([x, y]) => [-x, y] as Pt), [0, -18], [0, -33]];
})();
export const THYMUS: Pt = [0, -56];
export const SPLEEN: Pt = [15, -27];
/** The lymphatic trunks: from the legs, the arms and the head to the ducts that empty near the collarbones. */
export const BODY_VESSELS: readonly (readonly Pt[])[] = (() => {
  const leg = (s: number): Pt[] => spline([[s * 11, 96], [s * 12, 72], [s * 13, 56], [s * 13.5, 30], [s * 14.5, 6], [s * 8, -6], [s * 3, -20]]);
  const arm = (s: number): Pt[] => spline([[s * 42, 12], [s * 38, -4], [s * 35, -20], [s * 30, -36], [s * 23, -48], [s * 15, -60], [s * 6, -63]]);
  const head = (s: number): Pt[] => spline([[s * 9, -84], [s * 8.5, -74], [s * 8, -66], [s * 6, -63]]);
  const duct = spline([[0, -20], [1, -32], [2, -44], [4, -56], [6, -63]]);
  return [leg(1), leg(-1), arm(1), arm(-1), head(1), head(-1), duct];
})();
export const BODY_VIEW: Rect = { x: -62, y: -106, w: 124, h: 212 };
/** where a dive into the tissue opens (the upper belly) and into a node (the left armpit as seen) */
export const BODY_TISSUE: Pt = [-9, -22];
export const BODY_NODE: Pt = [-22, -55];
