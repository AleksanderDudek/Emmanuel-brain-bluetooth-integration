/**
 * The garden's geometry (DESIGN.md §23): one walled garden as a panorama, in world units — 1 unit is the height of the
 * garden's picture (y 0 the sky's top, the wall's coping at ~0.36, the pond at ~0.7, the garden's front at ~0.95),
 * WORLD_W units wide, left to right:
 *
 *   the gate in the wall (furtka) · the stone bench and the clay vessel · the oval pond with its lily pads (łzy, dłoń,
 *   list, kamienie) · the old olive · the lantern path (latarnie) · the bed of dark soil (nasiona)
 *
 * and where the camera stands for each place, where each act happens, and the spots where the flowers grown by focus
 * stand (by the pond, the bench, the gate, the path, the bed).  Pure numbers, seeded: the same garden every session.
 */
import type { StationId } from './stations';

export const WORLD_W = 3.3;

/** The band of the world that must be seen (y): the wall's top to the garden's front. */
export const VIEW_Y = { top: 0.28, bottom: 0.92 };

export const HORIZON = 0.46;
export const WALL = { top: 0.37, base: 0.565 };
export const GATE = { x: 0.62, w: 0.25, top: 0.33, base: 0.565 };
export const POND = { x: 1.48, y: 0.705, rx: 0.47, ry: 0.088 };
export const BENCH = { x: 0.9, y: 0.81, w: 0.3 };
export const VESSEL = { x: 0.98, y: 0.775 };
export const OLIVE = { x: 2.08, base: 0.625, cy: 0.27, r: 0.3 };
export const BED = { x0: 2.78, x1: 3.22, y0: 0.73, y1: 0.86 };

/** A place the camera stands at: the world x at the view's middle, and how much nearer than the garden's whole view. */
export interface Place { x: number; zoom: number }

export type Spot = 'arrive' | StationId | 'dawn';

export const PLACES: Readonly<Record<Spot, Place>> = {
  arrive: { x: 1.3, zoom: 1 },
  lzy: { x: 1.48, zoom: 1.05 },
  dlon: { x: 1.15, zoom: 1 },
  list: { x: 1.55, zoom: 1.05 },
  furtka: { x: 0.66, zoom: 1.12 },
  kamienie: { x: 1.48, zoom: 1.1 },
  latarnie: { x: 2.47, zoom: 1.05 },
  nasiona: { x: 2.98, zoom: 1.15 },
  dawn: { x: WORLD_W / 2, zoom: 1 },
};

/** The stations seen through the player's own eyes: the hands of light over the softly blurred garden. */
export const FIRST_PERSON: ReadonlySet<StationId> = new Set<StationId>(['dlon', 'kamienie']);

/** The lantern path: from the garden's front up to the wall, a gentle S. */
export function pathAt(u: number): { x: number; y: number } {
  const k = Math.max(0, Math.min(1, u));
  return { x: 2.3 + 0.28 * k + 0.07 * Math.sin(k * Math.PI * 1.6), y: 1.0 - 0.44 * k };
}

/** Where the i-th of n lanterns stands (alternating sides of the path, nearer ones larger). */
export function lanternAt(i: number, n: number): { x: number; y: number; s: number } {
  const N = Math.max(1, n);
  const u = 0.12 + (0.78 * (N === 1 ? 0.5 : i / (N - 1)));
  const p = pathAt(u);
  const side = i % 2 === 0 ? -1 : 1;
  const s = 1.15 - 0.55 * u;
  return { x: p.x + side * 0.085 * s, y: p.y - 0.01, s };
}

/** Where the i-th of n seeds is sown in the bed (one row, the bed's middle). */
export function seedAt(i: number, n: number): { x: number; y: number } {
  const N = Math.max(1, n);
  const pad = 0.07;
  const x = N === 1 ? (BED.x0 + BED.x1) / 2 : BED.x0 + pad + ((BED.x1 - BED.x0 - 2 * pad) * i) / (N - 1);
  return { x, y: (BED.y0 + BED.y1) / 2 + 0.012 };
}

/** The pond's rim point at angle a (0 = right, π/2 = the near side). */
export const pondAt = (a: number, k = 1): { x: number; y: number } => ({ x: POND.x + Math.cos(a) * POND.rx * k, y: POND.y + Math.sin(a) * POND.ry * k });

/** A flower's spot: world point, its size (depth) and its colour's index. */
export interface FlowerSpot { x: number; y: number; s: number; hue: number }

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Depth scale of a point: nearer (larger y) is larger. */
export const depthAt = (y: number): number => 0.55 + 0.9 * Math.max(0, Math.min(1, (y - WALL.base) / 0.4));

/** Where the flowers of a place grow: by the pond (its rim), the bench, the gate (the wall's foot), the path, the bed. */
function spotsOf(place: StationId, rng: () => number): FlowerSpot[] {
  const out: FlowerSpot[] = [];
  const push = (x: number, y: number) => out.push({ x, y, s: depthAt(y) * (0.85 + 0.3 * rng()), hue: Math.floor(rng() * 6) });
  switch (place) {
    case 'lzy':
    case 'list':
    case 'kamienie': {
      // the near rim for łzy, the far rim for the letter, the right rim for the stones — each its own arc
      const [a0, a1] = place === 'lzy' ? [0.55 * Math.PI, 0.95 * Math.PI] : place === 'list' ? [-0.85 * Math.PI, -0.15 * Math.PI] : [-0.1 * Math.PI, 0.45 * Math.PI];
      for (let i = 0; i < 16; i++) {
        const a = a0 + (a1 - a0) * ((i + 0.5 * rng()) / 16);
        const p = pondAt(a, 1.07 + 0.12 * rng());
        push(p.x, p.y + 0.012);
      }
      break;
    }
    case 'dlon':
      for (let i = 0; i < 14; i++) push(BENCH.x - 0.24 + 0.5 * rng(), BENCH.y + 0.02 + 0.09 * rng());
      break;
    case 'furtka':
      for (let i = 0; i < 16; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        push(GATE.x + side * (GATE.w * 0.62 + 0.22 * rng()), WALL.base + 0.008 + 0.05 * rng());
      }
      break;
    case 'latarnie':
      for (let i = 0; i < 18; i++) {
        const p = pathAt(0.05 + 0.85 * rng());
        const side = rng() < 0.5 ? -1 : 1;
        push(p.x + side * (0.06 + 0.08 * rng()), p.y + 0.01);
      }
      break;
    case 'nasiona':
      for (let i = 0; i < 18; i++) push(BED.x0 + 0.03 + (BED.x1 - BED.x0 - 0.06) * rng(), BED.y0 + 0.02 + (BED.y1 - BED.y0 - 0.03) * rng());
      break;
  }
  return out;
}

/** The meadow in front of the garden: where the flowers go when a place's own spots are full. */
function meadow(rng: () => number): FlowerSpot[] {
  const out: FlowerSpot[] = [];
  for (let i = 0; i < 60; i++) {
    const x = 0.1 + (WORLD_W - 0.2) * rng(), y = 0.86 + 0.09 * rng();
    // not on the path's front nor in the pond
    if (Math.abs(x - pathAt(0.1).x) < 0.1) continue;
    out.push({ x, y, s: depthAt(y) * (0.8 + 0.3 * rng()), hue: Math.floor(rng() * 6) });
  }
  return out;
}

export interface Garden { spots: Readonly<Record<StationId, readonly FlowerSpot[]>>; meadow: readonly FlowerSpot[] }

let garden: Garden | null = null;
/** The garden's flower spots (the same every session). */
export function gardenSpots(): Garden {
  if (garden) return garden;
  const rng = seeded(1919);
  const ids: StationId[] = ['lzy', 'dlon', 'list', 'furtka', 'kamienie', 'latarnie', 'nasiona'];
  const spots = {} as Record<StationId, FlowerSpot[]>;
  for (const id of ids) spots[id] = spotsOf(id, rng);
  garden = { spots, meadow: meadow(rng) };
  return garden;
}

/** The spot of the k-th flower grown at a station (its own spots first, then the meadow — shared, in turn). */
export function flowerSpot(station: StationId, k: number, meadowUsed: number): { spot: FlowerSpot; meadow: boolean } {
  const g = gardenSpots();
  const own = g.spots[station];
  if (k < own.length) return { spot: own[k], meadow: false };
  return { spot: g.meadow[meadowUsed % g.meadow.length], meadow: true };
}
