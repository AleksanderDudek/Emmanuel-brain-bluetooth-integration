/**
 * The Earth seen from space at night (ring 5 of Z głowy do serca), drawn procedurally — no maps from the net: coarse
 * continents as [longitude, latitude] outlines (a few dozen points each, an honest stylisation), an orthographic view
 * whose top limb lies over Scandinavia (the figure stands on the limb, so its field spreads from the north over
 * Europe, Africa, Asia and South America), the big cities' lights as clusters (the ring's lamps, kindled in order of
 * their distance from where the figure stands) and a faint dust of smaller lights on the land.
 *
 * Pure geometry in world units (layout.ts `EARTH`): computed once, drawn by render.ts.
 */
import { mulberry32 } from '../../core/random';
import type { P } from '../kit/figure';
import { EARTH } from './layout';

/** The view's centre (the disc's middle): 25° S, 18° E — the top limb then lies at 65° N over Scandinavia. */
const LAT0 = (-25 * Math.PI) / 180;
const LON0 = (18 * Math.PI) / 180;

type LL = readonly [number, number];

/** Coarse continents (lon, lat in degrees), each a closed outline. */
const LANDS: readonly (readonly LL[])[] = [
  // Africa
  [[-17, 15], [-16, 22], [-13, 28], [-9, 33], [-2, 35], [10, 37], [11, 33], [20, 31], [25, 32], [32, 31], [34, 28], [37, 22], [39, 15], [43, 12], [51, 12],
    [50, 8], [47, 4], [41, -2], [40, -10], [40, -15], [35, -23], [33, -28], [27, -34], [20, -35], [18, -32], [15, -27], [12, -18], [13, -11], [12, -5],
    [9, -1], [9, 4], [5, 6], [-2, 5], [-8, 4], [-13, 8], [-17, 15]],
  // Eurasia (with Arabia and India)
  [[-9, 37], [-9, 43], [-1, 46], [-4, 48], [2, 51], [8, 54], [8, 57], [5, 59], [6, 62], [13, 66], [18, 70], [28, 71], [40, 67], [44, 68], [55, 70], [68, 73],
    [80, 73], [100, 77], [115, 74], [130, 72], [145, 72], [160, 70], [175, 67], [179, 65], [170, 60], [160, 55], [150, 59], [140, 53], [135, 44], [128, 38],
    [126, 35], [121, 31], [122, 25], [117, 23], [109, 21], [107, 16], [109, 12], [105, 9], [103, 1], [100, 6], [98, 13], [96, 17], [92, 22], [88, 22],
    [86, 20], [80, 15], [78, 8], [76, 10], [73, 17], [72, 21], [67, 25], [62, 25], [57, 26], [56, 24], [59, 22], [55, 17], [52, 16], [45, 13], [43, 15],
    [39, 21], [35, 28], [34, 31], [35, 36], [30, 36], [27, 37], [26, 40], [29, 41], [23, 40], [22, 37], [20, 40], [16, 38], [18, 40], [13, 45], [12, 44],
    [16, 41], [12, 38], [8, 44], [3, 43], [0, 39], [-2, 37], [-6, 36], [-9, 37]],
  // South America
  [[-80, 8], [-77, 8], [-72, 12], [-63, 11], [-60, 8], [-52, 5], [-50, 0], [-44, -2], [-35, -6], [-37, -12], [-39, -17], [-41, -22], [-48, -26],
    [-53, -33], [-58, -38], [-62, -41], [-65, -45], [-68, -50], [-69, -53], [-73, -53], [-75, -48], [-73, -40], [-72, -30], [-71, -20], [-75, -15],
    [-79, -8], [-81, -3], [-80, 1], [-77, 4], [-80, 8]],
  // North America (its eastern edge reaches the limb)
  [[-168, 66], [-156, 71], [-128, 70], [-95, 72], [-82, 73], [-75, 70], [-65, 62], [-60, 55], [-56, 52], [-60, 47], [-66, 45], [-70, 42], [-74, 40],
    [-76, 37], [-81, 31], [-80, 26], [-84, 30], [-94, 29], [-97, 21], [-90, 21], [-87, 21], [-88, 16], [-83, 10], [-80, 8], [-85, 10], [-92, 15],
    [-105, 20], [-112, 29], [-117, 33], [-124, 40], [-125, 50], [-135, 58], [-150, 60], [-162, 57], [-168, 66]],
  // Greenland
  [[-50, 60], [-43, 60], [-38, 65], [-22, 70], [-20, 77], [-30, 83], [-55, 82], [-70, 78], [-60, 75], [-55, 70], [-50, 60]],
  // Great Britain and Ireland
  [[-5, 50], [1, 51], [2, 53], [-2, 56], [-3, 58], [-6, 58], [-5, 55], [-3, 54], [-5, 52], [-5, 50]],
  [[-10, 52], [-6, 52], [-6, 55], [-8, 55], [-10, 54], [-10, 52]],
  // Iceland, Madagascar, Sri Lanka, Sumatra
  [[-24, 64], [-18, 63], [-14, 65], [-16, 66], [-22, 66], [-24, 64]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17], [44, -25]],
  [[80, 6], [82, 7], [81, 9], [80, 9], [80, 6]],
  [[95, 5], [98, 4], [104, -2], [106, -6], [102, -5], [98, 0], [95, 5]],
  // Australia (mostly past the limb)
  [[114, -22], [114, -34], [124, -34], [135, -35], [146, -39], [153, -31], [153, -25], [142, -11], [131, -11], [122, -18], [114, -22]],
  // Antarctica, round the pole
  Array.from({ length: 19 }, (_, i): LL => [-180 + i * 20, -70 + 3 * Math.sin(i * 1.3)]),
];

/** Big cities (lat, lon), the first the most important: the ring's lamps take the first n. */
const CITIES: readonly LL[] = [
  [52.2, 21.0], [48.9, 2.35], [30.0, 31.2], [6.5, 3.4], [-23.5, -46.6], [28.6, 77.2], [41.0, 29.0], [55.75, 37.6], [-4.3, 15.3], [51.5, -0.1],
  [-1.3, 36.8], [-26.2, 28.0], [19.1, 72.9], [35.7, 51.4], [-34.6, -58.4], [52.5, 13.4], [40.4, -3.7], [41.9, 12.5], [9.0, 38.7], [24.7, 46.7],
  [-22.9, -43.2], [33.6, -7.6], [15.6, 32.5], [5.6, -0.2], [50.45, 30.5], [-33.9, 18.4], [33.3, 44.4], [24.9, 67.0], [23.8, 90.4], [-6.8, 39.3],
  [59.3, 18.1], [38.0, 23.7], [-8.8, 13.2], [36.75, 3.06], [14.7, -17.4], [-8.05, -34.9], [12.0, 8.5], [0.35, 32.6], [-18.9, 47.5], [25.2, 55.3],
  [13.1, 80.3], [-15.4, 28.3], [36.8, 10.2], [-19.9, -43.9], [41.3, 69.2], [-29.9, 31.0], [5.3, -4.0], [31.5, 74.3],
];

const rad = (d: number) => (d * Math.PI) / 180;

/** A (lon, lat) point on the unit disc of the view (x right, y down) and whether it faces us. */
export function project(lon: number, lat: number): { x: number; y: number; front: boolean } {
  const la = rad(lat), dl = rad(lon) - LON0;
  const x = Math.cos(la) * Math.sin(dl);
  const y = Math.cos(LAT0) * Math.sin(la) - Math.sin(LAT0) * Math.cos(la) * Math.cos(dl);
  const c = Math.sin(LAT0) * Math.sin(la) + Math.cos(LAT0) * Math.cos(la) * Math.cos(dl);
  return { x, y: -y, front: c > 0 };
}

/** A unit-disc point in world units (layout.ts EARTH); a point behind the limb is put on it. */
function toWorld(p: { x: number; y: number; front: boolean }): P {
  let { x, y } = p;
  if (!p.front) {
    const l = Math.hypot(x, y) || 1;
    x /= l;
    y /= l;
  }
  return [EARTH.cx + x * EARTH.r, EARTH.cy + y * EARTH.r];
}

/** Whether (lon, lat) lies inside an outline (ray casting in the lon/lat plane). */
function inside(poly: readonly LL[], lon: number, lat: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export interface City { at: P; d: number; seed: number }
export interface Earth {
  /** each land as world points (densified, clamped to the limb behind it) */
  lands: P[][];
  /** the cities by importance (world point, distance from the heart, a seed for its little lights) */
  cities: City[];
  /** the faint dust of lights on the land */
  dust: { at: P; d: number; b: number }[];
}

let cached: Earth | null = null;

/** The Earth's geometry, computed once. */
export function earth(): Earth {
  if (cached) return cached;
  // distances from the heart (the world's origin): the field widens from there
  const dist = (p: P) => Math.hypot(p[0], p[1]);
  const lands = LANDS.map(poly => {
    const out: P[] = [];
    for (let i = 0; i < poly.length; i++) {
      const [a0, b0] = poly[i], [a1, b1] = poly[(i + 1) % poly.length];
      // densify long edges, so the outline bends with the globe
      const n = Math.max(1, Math.ceil(Math.hypot(a1 - a0, b1 - b0) / 4));
      for (let k = 0; k < n; k++) out.push(toWorld(project(a0 + ((a1 - a0) * k) / n, b0 + ((b1 - b0) * k) / n)));
    }
    return out;
  });
  const cities: City[] = [];
  CITIES.forEach(([lat, lon], i) => {
    const pr = project(lon, lat);
    if (!pr.front || Math.hypot(pr.x, pr.y) > 0.996) return;
    const at = toWorld(pr);
    cities.push({ at, d: dist(at), seed: i * 7919 + 13 });
  });
  const rng = mulberry32(20261122);
  const dust: { at: P; d: number; b: number }[] = [];
  let guard = 0;
  while (dust.length < 320 && guard++ < 20000) {
    const lon = -80 + rng() * 190, lat = -60 + rng() * 135;
    if (!LANDS.slice(0, -1).some(poly => inside(poly, lon, lat))) continue;
    const pr = project(lon, lat);
    if (!pr.front || Math.hypot(pr.x, pr.y) > 0.985) continue;
    const at = toWorld(pr);
    dust.push({ at, d: dist(at), b: 0.3 + 0.7 * rng() });
  }
  cached = { lands, cities, dust };
  return cached;
}

/** The first `n` cities (by importance), in the order the field reaches them (nearest the figure first). */
export function cityOrder(n: number): City[] {
  return earth().cities.slice(0, Math.max(0, n)).sort((a, b) => a.d - b.d);
}

/** How far from the heart the field must reach to cover the whole visible Earth (world units). */
export const EARTH_FAR = EARTH.cy + EARTH.r;
