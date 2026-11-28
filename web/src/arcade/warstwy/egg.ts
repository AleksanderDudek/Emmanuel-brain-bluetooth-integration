/**
 * The seven layers' geometry (pure, in the figure's own units of kit/figure.ts: H = 1 from the crown to the soles, x
 * across with 0 on the midline, y down): the body's own web close to the skin, then six nested eggs of light around
 * the figure, a little wider at the shoulders than at the feet; where each clinging thing sits; where the Light above
 * stands.  The view maps these to the screen (layout.ts `figPt`).
 *
 * A point on an egg is given by its angle θ from the top, clockwise on screen (0 straight up, π/2 the viewer's right,
 * π the bottom): x = a · sin θ · (1 + e · cos θ), y = cy − b · cos θ.
 */
import { clamp } from '../kit/juice';

export type Pt = readonly [number, number];

/** The eggs' common centre (figure units): the middle of the body. */
export const EGG_CY = 0.5;
/** How much wider an egg is toward the top than toward the bottom. */
export const EGG_E = 0.08;

export interface Egg { a: number; b: number }

/**
 * Each layer's outer rim, from the body outward: the first is the web close to the body (its rim an egg only for the
 * inner edge of the second); then the six eggs.  `INNER` is the second layer's inner edge (about the body's envelope).
 */
export const EGGS: readonly Egg[] = [
  { a: 0.215, b: 0.545 },
  { a: 0.275, b: 0.585 },
  { a: 0.325, b: 0.62 },
  { a: 0.375, b: 0.655 },
  { a: 0.425, b: 0.69 },
  { a: 0.475, b: 0.725 },
  { a: 0.53, b: 0.765 },
];

/** The whole egg's extent in figure units (the outer rim), and where the Light above stands. */
export const EGG_TOP = EGG_CY - EGGS[6].b;
export const EGG_BOTTOM = EGG_CY + EGGS[6].b;
export const EGG_HALF = EGGS[6].a * (1 + EGG_E * 0.2);
export const LIGHT_Y = EGG_TOP - 0.13;

/** A point on egg `e` at angle θ (from the top, clockwise), scaled by `s` toward the centre (1 = on the rim). */
export function eggPt(e: Egg, th: number, s = 1): Pt {
  const x = e.a * Math.sin(th) * (1 + EGG_E * Math.cos(th));
  const y = -e.b * Math.cos(th);
  return [x * s, EGG_CY + y * s];
}

/** The rim of egg `e` as `n` points (closed, clockwise from the top). */
export function eggRing(e: Egg, n = 96): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push(eggPt(e, (i / n) * Math.PI * 2));
  return out;
}

/** A point in layer `k`'s band (k = 1..6) at angle θ and depth `d` (0 its inner edge, 1 its outer rim). */
export function bandPt(k: number, th: number, d: number): Pt {
  const inner = EGGS[Math.max(0, k - 1)], outer = EGGS[Math.min(6, k)];
  const p0 = eggPt(inner, th), p1 = eggPt(outer, th);
  const u = clamp(d);
  return [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u];
}

/**
 * Where things cling in the body's own web (layer 0), close to the outline (figure units), in the order a session
 * fills them: the shoulders, the forearms, the hips, the head's sides, the thighs, the shins.
 */
export const WEB_SPOTS: readonly Pt[] = [
  [0.09, 0.19], [-0.1, 0.32], [0.17, 0.43], [-0.11, 0.51], [0.06, 0.05], [-0.17, 0.43], [0.1, 0.33],
  [-0.09, 0.19], [0.1, 0.66], [-0.06, 0.05], [0.07, 0.86], [-0.1, 0.66],
];

/** One thing's place and look, fixed when the session makes it. */
export interface HookSpot {
  /** its place (figure units) */
  x: number;
  y: number;
  /** its turn (rad), its size (figure units), a seed and a variant for its drawing */
  rot: number;
  size: number;
  seed: number;
  variant: number;
}

/** The things' size by layer (figure units): small on the body, larger on the wide outer layers. */
const SIZE = [0.052, 0.058, 0.056, 0.06, 0.058, 0.062, 0.058];

/**
 * Where layer `k`'s `n` things sit: on the body's web at its spots; on an egg, both sides in turn (the first side
 * alternating by layer), spread between the shoulders and the knees, at a depth inside the band — never at the very
 * top (the thread of light comes down there) nor under the feet.
 */
export function placeHooks(k: number, n: number, rng: () => number): HookSpot[] {
  const out: HookSpot[] = [];
  const jit = (w: number) => (rng() - 0.5) * 2 * w;
  if (k === 0) {
    for (let i = 0; i < n; i++) {
      const [x, y] = WEB_SPOTS[i % WEB_SPOTS.length];
      out.push({ x: x + jit(0.006), y: y + jit(0.012), rot: Math.atan2(y - 0.4, x) + jit(0.4), size: SIZE[0] * (0.9 + 0.2 * rng()), seed: Math.floor(rng() * 1e6), variant: i % 2 });
    }
    return out;
  }
  const first = k % 2 === 0 ? 1 : -1;
  const per = [Math.ceil(n / 2), Math.floor(n / 2)];
  const used = [0, 0];
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? first : -first;
    const s = i % 2;
    const m = Math.max(1, per[s]);
    const j = used[s]++;
    // from the shoulders (32°) to below the knees (150°) on each side, the first nearer the top
    const deg = 34 + ((j + 0.5) / m) * 112 + jit(56 / m);
    const th = side * (clamp(deg, 30, 152) * Math.PI) / 180;
    const d = 0.38 + 0.34 * rng();
    const [x, y] = bandPt(k, th, d);
    out.push({ x, y, rot: th + jit(0.5), size: SIZE[k] * (0.88 + 0.24 * rng()), seed: Math.floor(rng() * 1e6), variant: i % 3 });
  }
  return out;
}
