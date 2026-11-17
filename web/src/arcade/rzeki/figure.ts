/**
 * The figure of Rzeki żywej wody and the shapes of its stations, as geometry in the figure's own units (H = 1
 * from the crown to the soles; x across, 0 on the midline, the viewer's left negative; y down): a calm,
 * gender-neutral person standing upright, seen from the front, the arms a little away from the body and the
 * palms open forward with the thumbs out — the posture of receiving.
 *
 * The silhouette is a union (one Path2D, nonzero) of the body's smooth outline (a Catmull–Rom spline from the
 * crown round the arms to the wrists and down the legs to the ankles), two real hands (a palm, four fingers and
 * a thumb) and two feet seen from the front (the instep and five toes).  The view strokes the union's rim and
 * erases what falls inside it, so the rim of light has no seam at a wrist or an ankle.
 *
 * Beside the figure: the two shells of light (picture 2's ovals), the three channels (Pingala, Sushumna, Ida),
 * the Void's ring, the sacrum with its spiral, the hand map's seven points, and the paths the stream of light
 * takes between stations — down the midline, or along the arms to the hands and down the legs to the feet.
 */
import { STATION, type HandPart, type StationId } from './content';

export type P = readonly [number, number];

/** The body's right half (the viewer's right), from the crown down to the crotch, without the hands and the feet. */
const RIGHT: readonly P[] = [
  // the head, from the crown round to the jaw
  [0, 0], [0.029, 0.008], [0.046, 0.031], [0.051, 0.064], [0.047, 0.097], [0.037, 0.123], [0.024, 0.141],
  // the neck and the slope of the shoulder
  [0.025, 0.163], [0.031, 0.181], [0.064, 0.194], [0.099, 0.201],
  // the outer arm, down to the wrist
  [0.121, 0.217], [0.13, 0.25], [0.136, 0.3], [0.145, 0.36], [0.155, 0.415], [0.164, 0.462], [0.17, 0.486],
  // round the wrist (the hand covers it) and back up the inner arm to the armpit
  [0.161, 0.496], [0.152, 0.488], [0.147, 0.46], [0.138, 0.415], [0.125, 0.36], [0.113, 0.302], [0.101, 0.248],
  // the side of the body, the waist, the hip
  [0.097, 0.272], [0.095, 0.31], [0.083, 0.388], [0.093, 0.455], [0.098, 0.5],
  // the outer leg down to the ankle, round it (the foot covers it) and the inner leg back up
  [0.096, 0.56], [0.088, 0.64], [0.075, 0.728], [0.072, 0.8], [0.06, 0.88], [0.051, 0.938], [0.049, 0.956],
  [0.037, 0.962], [0.025, 0.956], [0.022, 0.94], [0.025, 0.88], [0.03, 0.8], [0.025, 0.728], [0.021, 0.62], [0.007, 0.535],
];

/** The whole body outline, clockwise on screen: the right half down, the left half (mirrored) back up. */
export const OUTLINE: readonly P[] = [
  ...RIGHT,
  ...RIGHT.slice(1).reverse().map(([x, y]) => [-x, y] as P),
];

/** Half the figure's width with the hands (figure units). */
export const FIG_HALF = 0.23;

/** Where the chest is (the figure breathes around it), and the ground under the feet. */
export const CHEST: P = [0, 0.3];
export const GROUND = 1;

/** Map a figure point to the screen. */
export type ToScreen = (x: number, y: number) => [number, number];

type PathLike = Pick<Path2D, 'moveTo' | 'bezierCurveTo' | 'lineTo' | 'closePath'>;

/** A smooth path through points (Catmull–Rom, tension 0.5, as cubic Béziers), closed or open, into a Path2D-like. */
export function spline(path: PathLike, pts: readonly P[], map: ToScreen, closed: boolean): void {
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

/** A closed polygon through points (straight edges: the points are dense enough), into a Path2D-like. */
function polygon(path: PathLike, pts: readonly P[], map: ToScreen): void {
  pts.forEach(([x, y], i) => {
    const [sx, sy] = map(x, y);
    if (i) path.lineTo(sx, sy); else path.moveTo(sx, sy);
  });
  path.closePath();
}

/** Twice the signed area of a polygon (screen orientation: positive = clockwise with y down). */
const area2 = (pts: readonly P[]): number => pts.reduce((s, [x, y], i) => {
  const [x1, y1] = pts[(i + 1) % pts.length];
  return s + x * y1 - x1 * y;
}, 0);
/** The same polygon wound clockwise on screen, so every part of the silhouette adds to the union (nonzero). */
const cw = (pts: readonly P[]): readonly P[] => (area2(pts) >= 0 ? pts : [...pts].reverse());

// ── the hands ─────────────────────────────────────────────────────

/**
 * A hand in its own frame: u across (+ toward the thumb, away from the body), v along (+ toward the fingertips),
 * from the middle of the wrist.  Palms forward, the arm hanging a little outward: the thumb stands out at the side,
 * the four fingers hang down, a little apart, so all five read even on a phone.
 */
interface Finger { part: HandPart; base: P; angle: number; len: number; r: number }
const FINGERS: readonly Finger[] = [
  { part: 'index', base: [0.0108, 0.054], angle: 7, len: 0.039, r: 0.0044 },
  { part: 'middle', base: [0.0003, 0.0565], angle: 1, len: 0.044, r: 0.0046 },
  { part: 'ring', base: [-0.0101, 0.0548], angle: -5, len: 0.041, r: 0.0043 },
  { part: 'little', base: [-0.0186, 0.0505], angle: -12, len: 0.031, r: 0.0037 },
  { part: 'thumb', base: [0.0128, 0.013], angle: 44, len: 0.035, r: 0.0054 },
];
/** The palm, clockwise from the wrist's outer side: the wrist, the thumb's side, the knuckles, the little finger's side. */
const PALM: readonly P[] = [
  [0.0098, 0], [0.0132, 0.012], [0.0158, 0.03], [0.0158, 0.048], [0.011, 0.0575], [0.0003, 0.0598], [-0.0101, 0.0582],
  [-0.0172, 0.0535], [-0.0196, 0.042], [-0.0175, 0.02], [-0.0102, 0],
];
/** The wrist of the viewer's right hand (the figure's left) and the hand's lean outward (rad). */
const WRIST: P = [0.1612, 0.489];
const LEAN = (9 * Math.PI) / 180;

/** A point of the viewer's right hand from the hand's frame to figure units; side −1 mirrors it to the other hand. */
function handPt(u: number, v: number, side: 1 | -1): P {
  const s = Math.sin(LEAN), c = Math.cos(LEAN);
  const x = WRIST[0] + u * c + v * s, y = WRIST[1] - u * s + v * c;
  return [side * x, y];
}

/** A finger's axis in the hand's frame: from its base toward its tip. */
function fingerAxis(f: Finger): { dx: number; dy: number } {
  const a = (f.angle * Math.PI) / 180;
  return { dx: Math.sin(a), dy: Math.cos(a) };
}

/** A capsule (a finger, a toe) as a polygon in figure units: round at both ends. */
function capsule(a: P, b: P, r: number, rTip = r): P[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const ang = Math.atan2(uy, ux);
  const out: P[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = ang - Math.PI / 2 + (i / 8) * Math.PI;
    out.push([b[0] + Math.cos(t) * rTip, b[1] + Math.sin(t) * rTip]);
  }
  for (let i = 0; i <= 6; i++) {
    const t = ang + Math.PI / 2 + (i / 6) * Math.PI;
    out.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]);
  }
  return out;
}

/** One finger of a hand, in figure units: its base, its tip, its width. */
export function finger(part: Exclude<HandPart, 'wrist' | 'palm'>, side: 1 | -1): { a: P; b: P; r: number } {
  const f = FINGERS.find(x => x.part === part)!;
  const { dx, dy } = fingerAxis(f);
  return { a: handPt(f.base[0], f.base[1], side), b: handPt(f.base[0] + dx * f.len, f.base[1] + dy * f.len, side), r: f.r };
}

/** The palm's outline of a hand (figure units). */
export const palm = (side: 1 | -1): P[] => PALM.map(([u, v]) => handPt(u, v, side));

/** A hand's parts as closed shapes (figure units), each wound clockwise: the palm and the five fingers. */
export function handShapes(side: 1 | -1): { part: HandPart; pts: readonly P[]; smooth: boolean }[] {
  const out: { part: HandPart; pts: readonly P[]; smooth: boolean }[] = [{ part: 'palm', pts: cw(palm(side)), smooth: true }];
  for (const f of FINGERS) {
    const g = finger(f.part as Exclude<HandPart, 'wrist' | 'palm'>, side);
    out.push({ part: f.part, pts: cw(capsule(g.a, g.b, g.r, g.r * 0.92)), smooth: false });
  }
  return out;
}

/**
 * The hand map's seven points on a hand (picture 1, both hands alike): 1 the wrist, 2 the thumb, 3 the middle
 * finger, 4 the little finger, 5 the index finger, 6 the ring finger, 7 the centre of the palm — each a light on
 * the pad near the tip of its finger.
 */
export function handPoint(part: HandPart, side: 1 | -1): P {
  if (part === 'wrist') return handPt(0, 0.007, side);
  if (part === 'palm') return handPt(-0.001, 0.032, side);
  const f = FINGERS.find(x => x.part === part)!;
  const { dx, dy } = fingerAxis(f);
  const d = f.len - f.r * 1.1;
  return handPt(f.base[0] + dx * d, f.base[1] + dy * d, side);
}

/** The centre of a palm (where the light of the hands gathers, the hand's halo). */
export const palmCentre = (side: 1 | -1): P => handPoint('palm', side);

// ── the feet ──────────────────────────────────────────────────────

/** The viewer's right foot (the figure's left) seen from the front: the instep from the ankle to the toes' roots. */
const FOOT: readonly P[] = [
  [0.0505, 0.938], [0.056, 0.955], [0.064, 0.972], [0.0705, 0.984], [0.0665, 0.99], [0.045, 0.991], [0.0235, 0.992],
  [0.0175, 0.985], [0.019, 0.968], [0.0225, 0.952], [0.024, 0.938],
];
/** The toes from the big toe (inside) to the little toe: their root, their tip, their width. */
const TOES: readonly { root: P; tip: P; r: number }[] = [
  { root: [0.0262, 0.986], tip: [0.0252, 0.9985], r: 0.0062 },
  { root: [0.0372, 0.986], tip: [0.0378, 0.9975], r: 0.0044 },
  { root: [0.0466, 0.985], tip: [0.0478, 0.996], r: 0.0041 },
  { root: [0.0552, 0.984], tip: [0.0568, 0.9935], r: 0.0038 },
  { root: [0.0632, 0.981], tip: [0.0652, 0.9895], r: 0.0034 },
];
const mirror = (pts: readonly P[], side: 1 | -1): P[] => pts.map(([x, y]) => [side * x, y]);

/** A foot's parts as closed shapes (figure units): the instep and the five toes. */
export function footShapes(side: 1 | -1): { part: 'instep' | 'toe'; pts: readonly P[]; smooth: boolean; i: number }[] {
  const out: { part: 'instep' | 'toe'; pts: readonly P[]; smooth: boolean; i: number }[] = [{ part: 'instep', pts: cw(mirror(FOOT, side)), smooth: true, i: 0 }];
  TOES.forEach((t, i) => {
    const [a, b] = mirror([t.root, t.tip], side);
    out.push({ part: 'toe', pts: cw(capsule(a, b, t.r, t.r * 0.9)), smooth: false, i });
  });
  return out;
}

/** Where a sole meets the ground (the light under each foot), and the middle of a foot (its halo). */
export const soleAt = (side: 1 | -1): P => [side * 0.044, 0.996];
export const footCentre = (side: 1 | -1): P => [side * 0.044, 0.972];

// ── the silhouette ────────────────────────────────────────────────

/** The figure's silhouette as one path: the body, both hands, both feet (filled nonzero, it is their union). */
export function figurePath(map: ToScreen): Path2D {
  const p = new Path2D();
  spline(p, OUTLINE, map, true);
  for (const side of [1, -1] as const) {
    for (const s of handShapes(side)) if (s.smooth) spline(p, s.pts, map, true); else polygon(p, s.pts, map);
    for (const s of footShapes(side)) if (s.smooth) spline(p, s.pts, map, true); else polygon(p, s.pts, map);
  }
  return p;
}

/** One closed shape of figure points as a path (smooth through them, or straight between dense points). */
export function shapePath(pts: readonly P[], map: ToScreen, smooth: boolean): Path2D {
  const p = new Path2D();
  if (smooth) spline(p, pts, map, true); else polygon(p, pts, map);
  return p;
}

/** The half-width of the body at a height (figure units), for the threads and the inner light: a smooth guess from the outline. */
export function bodyHalf(y: number): number {
  if (y < 0.15) return 0.045;
  if (y < 0.2) return 0.03;
  if (y < 0.5) return 0.09;
  return 0.05;
}

// ── the shells, the channels, the Void, the sacrum ───────────────

/**
 * The two shells of light around the whole figure (picture 2's ovals): the inner one (the galactic) and the outer
 * one (the divine gateway), each an ellipse whose apex carries its keystone window (content.ts STATION.y).
 */
export interface Shell { cx: number; cy: number; rx: number; ry: number }
export const SHELL: Readonly<Record<'galactic' | 'gateway', Shell>> = {
  galactic: { cx: 0, cy: (STATION.galactic.y + 1.2) / 2, rx: 0.42, ry: (1.2 - STATION.galactic.y) / 2 },
  gateway: { cx: 0, cy: (STATION.gateway.y + 1.3) / 2, rx: 0.52, ry: (1.3 - STATION.gateway.y) / 2 },
};

/** A point of a shell at an angle from its apex (0 the apex, π the bottom; + the viewer's right). */
export const shellPt = (s: Shell, a: number): P => [s.cx + s.rx * Math.sin(a), s.cy - s.ry * Math.cos(a)];

/**
 * The three channels from the top (at the temples, their sun and moon) down to the sacrum: Pingala on the
 * viewer's left (the figure's right — the sun's side, gold), Sushumna on the midline (white), Ida on the viewer's
 * right (the figure's left — the moon's side, silver).  Points from the top down.
 */
const IDA: readonly P[] = [
  [0.074, 0.03], [0.052, 0.07], [0.034, 0.118], [0.026, 0.168], [0.046, 0.222], [0.058, 0.283], [0.061, 0.342], [0.056, 0.4], [0.038, 0.447], [0.014, 0.476],
];
export const CHANNELS: Readonly<Record<'pingala' | 'sushumna' | 'ida', readonly P[]>> = {
  pingala: IDA.map(([x, y]) => [-x, y] as P),
  sushumna: [[0, 0.012], [0, 0.474]],
  ida: IDA,
};
/** The sun (Pingala's top) and the crescent moon (Ida's top), and their radius. */
export const SUN: P = [-0.078, 0.026];
export const MOON: P = [0.078, 0.026];
export const MEDALLION_R = 0.017;

/** The Void: a ring of sea-green glass around the middle of the body (picture 1's green circle). */
export const VOID = { cx: 0, cy: STATION.void.y, rx: 0.128, ry: 0.086, band: 0.016 } as const;

/** The sacrum: the triangular bone at the base of the spine (wide above, its point below), and its spiral's centre. */
export const SACRUM = { top: 0.462, bottom: 0.528, half: 0.036 } as const;
const SAC_IN = (() => {
  const side = Math.hypot(SACRUM.half, SACRUM.bottom - SACRUM.top);
  const area = SACRUM.half * (SACRUM.bottom - SACRUM.top);
  const r = (2 * area) / (2 * SACRUM.half + 2 * side);
  return { x: 0, y: SACRUM.top + r, r };
})();
export const SPIRAL = { cx: SAC_IN.x, cy: SAC_IN.y, r: SAC_IN.r * 0.86, turns: 3.5 } as const;

/** The sacrum's outline (a triangle with softened corners, figure units, clockwise). */
export const SACRUM_PTS: readonly P[] = [
  [-SACRUM.half, SACRUM.top], [0, SACRUM.top - 0.004], [SACRUM.half, SACRUM.top], [SACRUM.half * 0.62, (SACRUM.top + SACRUM.bottom) / 2],
  [0.004, SACRUM.bottom - 0.002], [-0.004, SACRUM.bottom - 0.002], [-SACRUM.half * 0.62, (SACRUM.top + SACRUM.bottom) / 2],
];

/** The spiral of light in the sacrum (an Archimedean spiral from the centre out, 3½ turns) up to a share `k`. */
export function spiralPts(k: number, n = 96): P[] {
  const out: P[] = [];
  const m = Math.max(2, Math.round(n * Math.max(0, Math.min(1, k))));
  const total = SPIRAL.turns * Math.PI * 2;
  for (let i = 0; i <= m; i++) {
    const q = (i / n) * total;
    const r = (SPIRAL.r * q) / total;
    out.push([SPIRAL.cx + r * Math.cos(q - Math.PI / 2), SPIRAL.cy + r * Math.sin(q - Math.PI / 2)]);
  }
  return out;
}

// ── where a station is, and the way the light travels ─────────────

/** The twin stations: both hands, both feet. */
export const isTwin = (s: StationId): boolean => STATION[s].kind === 'hands' || STATION[s].kind === 'feet';

/** The points of a station the light gathers at: one on the midline, or one on each palm / each foot. */
export function stationPts(s: StationId): readonly P[] {
  const k = STATION[s].kind;
  if (k === 'hands') return [palmCentre(-1), palmCentre(1)];
  if (k === 'feet') return [footCentre(-1), footCentre(1)];
  return [[STATION[s].x, STATION[s].y]];
}

/** The light's way along a limb: from the chest out along the arm to the palm, or from the hip down the leg to the foot. */
const ARM: readonly P[] = [[0, 0.255], [0.062, 0.2], [0.112, 0.215], [0.134, 0.3], [0.148, 0.39], [0.159, 0.46], [0.165, 0.5]];
const LEG: readonly P[] = [[0, 0.54], [0.04, 0.6], [0.052, 0.7], [0.048, 0.8], [0.042, 0.9], [0.044, 0.96]];
function limb(s: StationId, side: 1 | -1): P[] {
  const base = STATION[s].kind === 'hands' ? ARM : LEG;
  const end = STATION[s].kind === 'hands' ? palmCentre(side) : footCentre(side);
  return [...base.map(([x, y]) => [side * x, y] as P), end];
}

/**
 * The paths the stream of light takes from one station to the next (figure units, one or two polylines): down or
 * up the midline, out along both arms to the hands and back, down both legs to the feet, from the feet to the pool.
 */
export function streamPaths(from: StationId, to: StationId): P[][] {
  const a = stationPts(from), b = stationPts(to);
  const tw = isTwin(to), fw = isTwin(from);
  if (!tw && !fw) return [[a[0], b[0]]];
  if (tw && !fw) {
    return ([-1, 1] as const).map(side => {
      const path = limb(to, side);
      // from the station's point to where the limb leaves the midline, then out along it
      return [a[0], ...path];
    });
  }
  if (fw && !tw) {
    return ([-1, 1] as const).map(side => [...limb(from, side)].reverse().concat([b[0]]));
  }
  // one pair to the other: back along the first limb, out along the second
  return ([-1, 1] as const).map(side => [...[...limb(from, side)].reverse(), ...limb(to, side)]);
}

/** The light entering a way: from the open heaven above down to the first station, or up from the pool. */
export function enterPaths(first: StationId, down: boolean, top: number): P[][] {
  const pts = stationPts(first);
  if (down) {
    if (pts.length === 1) return [[[0, top], pts[0]]];
    return ([-1, 1] as const).map(side => [[0, top] as P, ...limb(first, side)]);
  }
  const pool: P = [0, 1.1];
  if (pts.length === 1) return [[pool, pts[0]]];
  if (STATION[first].kind === 'feet') return ([-1, 1] as const).map(side => [pool, footCentre(side)]);
  return ([-1, 1] as const).map(side => [pool, [0, 0.98] as P, ...limb(first, side)]);
}

/** A point a share `k` (0..1) of the way along a polyline (by length). */
export function along(pts: readonly P[], k: number): P {
  if (pts.length < 2) return pts[0] ?? [0, 0];
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let d = Math.max(0, Math.min(1, k)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const q = lens[i] > 0 ? Math.min(1, d / lens[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * q, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * q];
    }
    d -= lens[i];
  }
  return pts[pts.length - 1];
}
