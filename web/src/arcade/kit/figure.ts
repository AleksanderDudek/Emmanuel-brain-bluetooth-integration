/**
 * The figure of light shared by the meditations (Rzeki żywej wody, and the series "Serce i światło"), as geometry
 * in the figure's own units (H = 1 from the crown to the soles; x across, 0 on the midline, the viewer's left
 * negative; y down): a calm, gender-neutral person standing upright, seen from the front, the arms a little away
 * from the body and the palms open forward with the thumbs out — the posture of receiving.
 *
 * The silhouette is a union (one Path2D, nonzero) of the body's smooth outline (a Catmull–Rom spline from the
 * crown round the arms to the wrists and down the legs to the ankles), two real hands (a palm, four fingers and
 * a thumb) and two feet seen from the front (the instep and five toes).  A view strokes the union's rim and
 * erases what falls inside it, so the rim of light has no seam at a wrist or an ankle.
 *
 * `PLACE` names the body's places a meditation walks through (the brow where the band sits, the heart, the
 * palms…), and `SPINE` / `FRONT` are the midline paths up the back and down the front, for light that moves.
 */

/** A hand's parts: the wrist, the five fingers, the centre of the palm. */
export type HandPart = 'wrist' | 'thumb' | 'index' | 'middle' | 'ring' | 'little' | 'palm';

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
export function polygon(path: PathLike, pts: readonly P[], map: ToScreen): void {
  pts.forEach(([x, y], i) => {
    const [sx, sy] = map(x, y);
    if (i) path.lineTo(sx, sy); else path.moveTo(sx, sy);
  });
  path.closePath();
}

/** Twice the signed area of a polygon (screen orientation: positive = clockwise with y down). */
export const area2 = (pts: readonly P[]): number => pts.reduce((s, [x, y], i) => {
  const [x1, y1] = pts[(i + 1) % pts.length];
  return s + x * y1 - x1 * y;
}, 0);
/** The same polygon wound clockwise on screen, so every part of the silhouette adds to the union (nonzero). */
export const cw = (pts: readonly P[]): readonly P[] => (area2(pts) >= 0 ? pts : [...pts].reverse());

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
export function capsule(a: P, b: P, r: number, rTip = r): P[] {
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
export const mirror = (pts: readonly P[], side: 1 | -1): P[] => pts.map(([x, y]) => [side * x, y]);

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


// ── the places a meditation walks through ─────────────────────────

/**
 * The body's places on the figure (figure units), from the crown down.  `brow` is where the band sits (the
 * prefrontal cortex behind it: the "head space" the heart meditation starts from); `heart` is the middle of the
 * chest, the place of prayer of the heart (the physical heart lies a little to the figure's left: `heartOrgan`).
 */
export const PLACE = {
  crown: [0, 0.004], brow: [0, 0.052], eyes: [0, 0.066], mouth: [0, 0.112], throat: [0, 0.165],
  heart: [0, 0.262], heartOrgan: [0.022, 0.27], plexus: [0, 0.335], navel: [0, 0.4], belly: [0, 0.44],
  base: [0, 0.525], knees: [0, 0.75], ground: [0, 1],
} as const satisfies Record<string, P>;
export type PlaceId = keyof typeof PLACE;

/**
 * The midline from the crown to the base, front and back as one line seen from the front (a figure seen from
 * the front shows the spine and the front line on top of each other; a profile view draws them apart).
 */
export const MIDLINE: readonly P[] = [PLACE.crown, PLACE.brow, PLACE.throat, PLACE.heart, PLACE.plexus, PLACE.navel, PLACE.belly, PLACE.base];

/** A point a fraction `k` (0..1) of the way along a polyline, by length. */
export function alongPath(pts: readonly P[], k: number): P {
  if (pts.length < 2) return pts[0] ?? [0, 0];
  const seg: number[] = [];
  let total = 0;
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
