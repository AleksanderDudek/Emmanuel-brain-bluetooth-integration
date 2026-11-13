/**
 * The figure of Rzeki żywej wody, as geometry in its own units (H = 1 from the crown to the soles; x across,
 * 0 on the midline, the viewer's left negative): a calm, gender-neutral person standing upright, seen from
 * the front, the arms a little away from the body and the palms open forward — the posture of receiving.
 * One smooth outline (a Catmull–Rom spline through the points) runs around the head, the arms, the hands
 * and the legs, so the rim of light has no seam at the chin.  The seven places sit on the midline
 * (content.ts `PLACE[p].y`).
 */

export type P = readonly [number, number];

/** The right half of the outline (the viewer's right), from the crown down to the crotch. */
const RIGHT: readonly P[] = [
  // the head, from the crown round to the jaw
  [0, 0], [0.029, 0.008], [0.046, 0.031], [0.051, 0.064], [0.047, 0.097], [0.037, 0.123], [0.024, 0.141],
  // the neck and the slope of the shoulder
  [0.025, 0.163], [0.031, 0.181], [0.064, 0.194], [0.099, 0.201],
  // the outer arm, down to the open hand (the thumb a little out, the palm forward)
  [0.121, 0.217], [0.13, 0.25], [0.136, 0.3], [0.145, 0.36], [0.156, 0.41], [0.167, 0.468],
  [0.181, 0.49], [0.193, 0.512], [0.189, 0.53], [0.191, 0.553], [0.185, 0.577], [0.171, 0.586], [0.158, 0.576],
  // the inner arm back up to the armpit
  [0.151, 0.546], [0.147, 0.5], [0.138, 0.442], [0.125, 0.372], [0.113, 0.302], [0.101, 0.248],
  // the side of the body, the waist, the hip
  [0.097, 0.272], [0.095, 0.31], [0.083, 0.388], [0.093, 0.455], [0.098, 0.5],
  // the outer leg to the foot
  [0.096, 0.56], [0.088, 0.64], [0.075, 0.728], [0.073, 0.8], [0.061, 0.88], [0.049, 0.94], [0.061, 0.973], [0.059, 0.994], [0.036, 1],
  // the inner leg back up
  [0.021, 0.992], [0.022, 0.95], [0.025, 0.88], [0.03, 0.8], [0.025, 0.728], [0.021, 0.62], [0.007, 0.535],
];

/** The whole outline, clockwise on screen: the right half down, the left half (mirrored) back up. */
export const OUTLINE: readonly P[] = [
  ...RIGHT,
  ...RIGHT.slice(1).reverse().map(([x, y]) => [-x, y] as P),
];

/** Half the figure's width with the hands (figure units). */
export const FIG_HALF = 0.2;

/** Where the chest is (the figure breathes around it), the heart's height, and the ground under the feet. */
export const CHEST: P = [0, 0.3];
export const GROUND = 1;

/** Map a figure point to the screen. */
export type ToScreen = (x: number, y: number) => [number, number];

/** A smooth path through points (Catmull–Rom, tension 0.5, as cubic Béziers), closed or open, into a Path2D-like. */
export function spline(path: Pick<Path2D, 'moveTo' | 'bezierCurveTo' | 'closePath'>, pts: readonly P[], map: ToScreen, closed: boolean): void {
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

/** The figure's outline as one path. */
export function outlinePath(map: ToScreen): Path2D {
  const p = new Path2D();
  spline(p, OUTLINE, map, true);
  return p;
}

/** The half-width of the body at a height (figure units), for the threads and the inner light: a smooth guess from the outline. */
export function bodyHalf(y: number): number {
  if (y < 0.15) return 0.045;
  if (y < 0.2) return 0.03;
  if (y < 0.5) return 0.09;
  return 0.05;
}
