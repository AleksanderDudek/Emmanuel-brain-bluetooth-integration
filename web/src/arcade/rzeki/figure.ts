/**
 * The figure of Rzeki żywej wody and the shapes of its stations, as geometry in the figure's own units (H = 1
 * from the crown to the soles; x across, 0 on the midline, the viewer's left negative; y down): a calm,
 * gender-neutral person standing upright, seen from the front, the arms a little away from the body and the
 * palms open forward with the thumbs out — the posture of receiving.
 *
 * The figure itself (the outline, the hands, the feet) is the shared one in kit/figure.ts, re-exported here.
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
import { STATION, type StationId } from './content';
import { palmCentre, footCentre, type P } from '../kit/figure';

export {
  type P, type ToScreen, OUTLINE, FIG_HALF, CHEST, GROUND, spline, finger, palm, handShapes, handPoint, palmCentre, footShapes, soleAt, footCentre, figurePath, shapePath, bodyHalf,
} from '../kit/figure';

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
