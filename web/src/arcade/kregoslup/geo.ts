/**
 * Sprężysty kręgosłup's shapes (DESIGN.md §24.5): the spine in profile and the body around it, in the units of the
 * whole-body pictures (1 unit ≈ 4 mm; facing left, so the front of the body is −x and down is +y).
 *
 * The spine is laid along a smooth axis with its four curves (the neck and the low back bowed forward, the chest and
 * the sacrum back), and every vertebra and disc is placed along it at its true share of the length: 7 cervical,
 * 12 thoracic and 5 lumbar vertebrae, the sacrum of 5 fused and the coccyx of 4, and the 23 discs from C2–C3 to L5–S1
 * (none between C1 and C2) — the discs about a quarter of the spine's height, thin in the chest, thickest in the low
 * back (the disc-to-body ratio about 2:5 in the neck, 1:5 in the chest, 1:3 in the low back).  Pure geometry, no DOM.
 */
export type Pt = readonly [number, number];
export interface Rect { x: number; y: number; w: number; h: number }

export const TAU = Math.PI * 2;
export const clamp = (v: number, lo = 0, hi = 1): number => (v < lo ? lo : v > hi ? hi : v);
export const smooth = (a: number, b: number, v: number): number => {
  const k = clamp((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** A deterministic 0..1 for a number. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── the axis ──────────────────────────────────────────────────────
/** The spine's axis through the vertebral bodies, from under the skull to the tip of the coccyx. */
const AXIS_CTRL: readonly Pt[] = [
  [1.5, -101], [-3.5, -90], [-5.2, -80], [-2.5, -66], [3.5, -50], [7.6, -34], [8.6, -20], [6.8, -6], [2.6, 6],
  [-2.2, 18], [-4.6, 28], [-3.4, 38], [1.4, 46], [7.5, 55], [11.6, 65], [12.4, 74], [10.2, 81], [7.2, 85],
];

/** The axis sampled finely (Catmull-Rom through the control points) with its running length. */
const AX: { x: number; y: number; s: number }[] = (() => {
  const out: { x: number; y: number; s: number }[] = [];
  const P = AXIS_CTRL;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]), s: 0 });
    }
  }
  const last = P[P.length - 1];
  out.push({ x: last[0], y: last[1], s: 0 });
  for (let i = 1; i < out.length; i++) out[i].s = out[i - 1].s + Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
  return out;
})();
export const AXIS_LEN = AX[AX.length - 1].s;

/** A point of the axis at arc length s: its place, the tangent (down the spine) and the back (posterior) direction. */
export interface Frame { x: number; y: number; tx: number; ty: number; px: number; py: number }
export function axisAt(s: number): Frame {
  const v = clamp(s, 0, AXIS_LEN);
  let lo = 0, hi = AX.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (AX[mid].s <= v) lo = mid; else hi = mid;
  }
  const a = AX[lo], b = AX[hi];
  const k = b.s > a.s ? (v - a.s) / (b.s - a.s) : 0;
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
  const tx = dx / d, ty = dy / d;
  return { x: a.x + dx * k, y: a.y + dy * k, tx, ty, px: ty, py: -tx };
}
/** A point in a frame: u along the back direction (−u is the front), v along the axis (down). */
export const inFrame = (f: Frame, u: number, v: number): [number, number] => [f.x + f.px * u + f.tx * v, f.y + f.py * u + f.ty * v];

// ── the vertebrae and the discs ───────────────────────────────────
export type Region = 'C' | 'T' | 'L' | 'S' | 'Co';
export interface Seg {
  kind: 'v' | 'd';
  /** "C1" … "Co4" for a vertebra, "C2–C3" … "L5–S1" for a disc */
  id: string;
  region: Region;
  /** its start and end along the axis */
  s0: number;
  s1: number;
  /** the body's depth front to back (units) */
  depth: number;
  /** its index among its kind (vertebrae 0–32, discs 0–22) */
  n: number;
}

interface Nominal { id: string; region: Region; h: number; depth: number; disc?: number }
/** Heights (units of 4 mm) and depths of each vertebra and the disc below it (true proportions, softened). */
const NOMINAL: readonly Nominal[] = (() => {
  const out: Nominal[] = [];
  out.push({ id: 'C1', region: 'C', h: 2.8, depth: 3.6 });
  out.push({ id: 'C2', region: 'C', h: 5.2, depth: 4.0, disc: 1.5 });
  for (let i = 3; i <= 7; i++) out.push({ id: `C${i}`, region: 'C', h: 3.3 + (i - 3) * 0.1, depth: 4.2 + (i - 3) * 0.15, disc: 1.5 });
  for (let i = 1; i <= 12; i++) out.push({ id: `T${i}`, region: 'T', h: 4.0 + (i - 1) * 0.19, depth: 5.0 + (i - 1) * 0.24, disc: i < 12 ? 1.1 + (i - 1) * 0.035 : 2.4 });
  const L = [6.5, 6.8, 7.0, 7.0, 6.7];
  for (let i = 1; i <= 5; i++) out.push({ id: `L${i}`, region: 'L', h: L[i - 1], depth: 8.2 + (i - 1) * 0.2, disc: 2.65 + (i - 1) * 0.1 });
  const S = [6.2, 5.2, 4.4, 3.6, 3.0];
  for (let i = 1; i <= 5; i++) out.push({ id: `S${i}`, region: 'S', h: S[i - 1], depth: 9.6 - (i - 1) * 1.4 });
  const Co = [2.6, 2.1, 1.7, 1.3];
  for (let i = 1; i <= 4; i++) out.push({ id: `Co${i}`, region: 'Co', h: Co[i - 1], depth: 3.0 - (i - 1) * 0.45 });
  return out;
})();

/** The tiny joints of the fused sacrum and coccyx are not discs; the gap between coccygeal pieces (units). */
const CO_GAP = 0.3;

export const SEGS: readonly Seg[] = (() => {
  let total = 0;
  for (const n of NOMINAL) total += n.h + (n.disc ?? (n.region === 'Co' ? CO_GAP : 0));
  const k = AXIS_LEN / total;
  const out: Seg[] = [];
  let s = 0, nv = 0, nd = 0;
  for (let i = 0; i < NOMINAL.length; i++) {
    const n = NOMINAL[i];
    out.push({ kind: 'v', id: n.id, region: n.region, s0: s, s1: s + n.h * k, depth: n.depth, n: nv++ });
    s += n.h * k;
    if (n.disc) {
      const next = NOMINAL[i + 1];
      out.push({ kind: 'd', id: `${n.id}–${next.id}`, region: n.region, s0: s, s1: s + n.disc * k, depth: (n.depth + next.depth) / 2, n: nd++ });
      s += n.disc * k;
    } else if (n.region === 'Co') s += CO_GAP * k;
  }
  return out;
})();
export const VERTS = SEGS.filter(g => g.kind === 'v');
export const DISCS = SEGS.filter(g => g.kind === 'd');

/** A segment's middle point on the axis. */
export const segMid = (g: Seg): Frame => axisAt((g.s0 + g.s1) / 2);
/** The vertebra or disc by its id. */
export const seg = (id: string): Seg => SEGS.find(g => g.id === id) ?? SEGS[0];
/** A point beside a segment: u units toward the back (negative: the front). */
export function besideSeg(id: string, u: number): Pt {
  const f = segMid(seg(id));
  const p = inFrame(f, u, 0);
  return [p[0], p[1]];
}

// ── the body around it ────────────────────────────────────────────
/**
 * The body in profile, no features but the line of the face: the head (its crown at the top), the nape, the back
 * with its curves, the hips, the front of the thighs, the belly, the chest, the throat and the face.  Below the hips
 * the figure fades into the ground (the pictures need only the trunk).
 */
export const BODY: readonly Pt[] = [
  [-6, -142], [6, -139], [15, -130], [19, -118], [18, -106], [13, -97], [10, -90], [12, -80], [18, -70],
  [24, -56], [27.5, -40], [27, -24], [23.5, -8], [19.5, 6], [19, 18], [22, 32], [27, 46], [28.5, 60], [25, 74],
  [21, 88], [18, 104], [-28, 104], [-30, 88], [-33, 74], [-37, 60], [-41, 46], [-45, 32], [-46, 18],
  [-44, 4], [-42, -10], [-44, -24], [-45, -40], [-41, -56], [-30, -68], [-20, -78], [-17, -88], [-22, -93],
  [-28, -96], [-31, -100], [-31, -104], [-34, -108], [-35, -112], [-32, -116], [-32, -124], [-28, -133], [-18, -140],
];
/** The crown of the head (where "upright" lifts). */
export const CROWN: Pt = [-4, -142];
/** The shoulder (soft, below the ear): where "upright" lets the shoulders sink. */
export const SHOULDER: Pt = [6, -66];

// ── views ─────────────────────────────────────────────────────────
/** The spine whole (the head cropped at the top). */
export const SPINE_VIEW: Rect = { x: -56, y: -112, w: 112, h: 210 };
/** The whole figure (for "upright"). */
export const FIGURE_VIEW: Rect = { x: -70, y: -168, w: 140, h: 272 };
