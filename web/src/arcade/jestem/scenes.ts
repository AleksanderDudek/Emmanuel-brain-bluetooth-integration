/**
 * The geometry of Ja jestem…'s eighteen pictures, without the canvas (DESIGN §13.8): where each picture's
 * parts lie — the horizon, the hill, the sun, the figure — in the picture's own unit square (u across,
 * v down, both 0..1 over the window's rectangle; the round arch cuts the top corners above v ≈ 0.16).
 *
 * The painters (pictures.ts) draw with these very functions and the mosaic's fragments are cut by them
 * (`regions`: the first test a cell's centre passes names its fragment), so "the runner" in the game is
 * the runner in the picture.  Each picture's `heart` is where its colour starts when the player lets it
 * flow by itself: the subject, from which the vision grows outward.
 */

export type DeclId =
  | 'kochany' | 'zdrowy' | 'silny' | 'szczesliwy' | 'spokojny' | 'wolny' | 'dziecko' | 'bogaty' | 'odwazny'
  | 'bezpieczny' | 'swiatlo' | 'blogoslawiony' | 'wybrany' | 'uzdrowiony' | 'nowy' | 'oczyszczony' | 'madry' | 'zwyciezca';

export interface Region {
  /** the fragment's name key (i18n `frag.<key>`) */
  key: string;
  test: (u: number, v: number) => boolean;
}

export interface SceneGeo {
  id: DeclId;
  /** where the colour starts (u, v) */
  heart: readonly [number, number];
  /** in order: the first that holds for a cell's centre names its fragment; the last holds everywhere */
  regions: readonly Region[];
}

// ── shapes ───────────────────────────────────────────────────────
export const inCircle = (u: number, v: number, cx: number, cy: number, r: number): boolean => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
export const inEllipse = (u: number, v: number, cx: number, cy: number, rx: number, ry: number): boolean =>
  ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
export const inRect = (u: number, v: number, x0: number, y0: number, x1: number, y1: number): boolean => u >= x0 && u <= x1 && v >= y0 && v <= y1;
const bump = (u: number, c: number, w: number): number => Math.exp(-(((u - c) / w) ** 2));
const all = (): boolean => true;

/** A point inside a polygon (any shape; even–odd). */
export function inPolygon(u: number, v: number, pts: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

// ── the pictures' parts ──────────────────────────────────────────
/** 1 · zdrowy: a runner on a hill path at sunrise (Jer 33:6) */
export const ZDROWY = {
  far: (u: number) => 0.555 + 0.025 * Math.sin(u * 7.1 + 0.6) + 0.015 * Math.sin(u * 17 + 2),
  mid: (u: number) => 0.62 + 0.035 * Math.sin(u * 4.3 + 1.9) + 0.012 * Math.sin(u * 13),
  near: (u: number) => 0.735 - 0.13 * bump(u, 0.36, 0.3) + 0.012 * Math.sin(u * 11 + 1),
  sun: { x: 0.69, y: 0.55, r: 0.1 },
  runner: { x: 0.365, h: 0.2 },
};
/** 2 · uzdrowiony: a young tree grown from an old stump after rain (Isa 53:5) */
export const UZDROWIONY = {
  ground: (u: number) => 0.8 + 0.018 * Math.sin(u * 6 + 0.5),
  stump: { x0: 0.34, x1: 0.66, top: 0.67, bottom: 0.83 },
  crown: { x: 0.5, y: 0.34, r: 0.2 },
  trunk: { x: 0.505, top: 0.42, bottom: 0.69 },
  sun: { x: 0.14, y: 0.08 },
};
/** 3 · silny: a cedar on a mountain ledge (Phil 4:13) */
export const SILNY = {
  peaks: (u: number) => {
    // a jagged range: peaks at 0.18, 0.58, 0.86
    const p = Math.min(Math.abs(u - 0.18) * 1.2 + 0.34, Math.abs(u - 0.6) * 1.05 + 0.27, Math.abs(u - 0.88) * 1.3 + 0.36);
    return Math.min(0.6, p + 0.012 * Math.sin(u * 40));
  },
  rock: (u: number) => 0.78 - 0.12 * bump(u, 0.42, 0.26) + 0.015 * Math.sin(u * 23),
  cedar: { x: 0.44, top: 0.18, base: 0.7 },
  /** the cedar's half width at height v (its tiers) */
  cedarHalf: (v: number) => (v < 0.18 || v > 0.68 ? 0 : 0.03 + (v - 0.18) * 0.42),
};
/** 4 · szczęśliwy: a figure dancing in a meadow of flowers (John 15:11) */
export const SZCZESLIWY = {
  horizon: (u: number) => 0.56 + 0.02 * Math.sin(u * 5 + 1) - 0.03 * bump(u, 0.18, 0.12),
  sun: { x: 0.8, y: 0.2, r: 0.08 },
  tree: { x: 0.17, y: 0.44, r: 0.095 },
  dancer: { x: 0.52, feet: 0.71, h: 0.27 },
};
/** 5 · bogaty: a harvest table under an orchard (2 Cor 8:9) */
export const BOGATY = {
  ground: 0.57,
  trees: [[0.1, 0.32, 0.13], [0.34, 0.27, 0.12], [0.62, 0.29, 0.13], [0.9, 0.34, 0.13]] as const,
  table: { x0: 0.06, x1: 0.94, top: 0.66, front: 0.72 },
  basket: { x: 0.5, y: 0.62, rx: 0.16, ry: 0.075 },
};
/** 6 · wolny: a swallow leaving an open cage for the wide sky (John 8:36) */
export const WOLNY = {
  horizon: 0.76,
  ledge: 0.88,
  cage: { x: 0.27, top: 0.5, bottom: 0.86, w: 0.25 },
  bird: { x: 0.63, y: 0.33, span: 0.24 },
  sun: { x: 0.84, y: 0.17, r: 0.06 },
  clouds: [[0.2, 0.27, 0.15, 0.06], [0.52, 0.56, 0.2, 0.05], [0.9, 0.46, 0.13, 0.05]] as const,
};
/** 7 · kochany: two figures embracing in the warm light of evening (Jer 31:3) */
export const KOCHANY = {
  ground: (u: number) => 0.7 + 0.025 * Math.sin(u * 5.5 + 2) - 0.03 * bump(u, 0.5, 0.25),
  sun: { x: 0.5, y: 0.5, r: 0.12 },
  pair: { x: 0.5, feet: 0.68, h: 0.25 },
};
/** 8 · spokojny: a still lake at dawn (John 14:27) */
export const SPOKOJNY = {
  hills: (u: number) => 0.5 + 0.03 * Math.sin(u * 6 + 0.8) - 0.04 * bump(u, 0.2, 0.15) - 0.03 * bump(u, 0.82, 0.13),
  shore: 0.545,
  sun: { x: 0.5, y: 0.475, r: 0.05 },
  jetty: [[0.06, 1], [0.26, 1], [0.47, 0.7], [0.41, 0.7]] as const,
};
/** 9 · odważny: a figure on a rock facing a great wave (2 Tim 1:7) */
export const ODWAZNY = {
  sea: (u: number) => 0.66 + 0.02 * Math.sin(u * 9 + 1),
  rock: [[0, 0.76], [0.14, 0.7], [0.28, 0.665], [0.4, 0.69], [0.5, 0.82], [0.56, 1], [0, 1]] as const,
  figure: { x: 0.29, feet: 0.665, h: 0.2 },
  wave: [[0.5, 0.78], [0.6, 0.6], [0.72, 0.44], [0.86, 0.36], [0.98, 0.4], [1, 0.48], [1, 0.82], [0.7, 0.86]] as const,
  light: [[0.52, 0.06], [0.7, 0.06], [0.38, 0.68], [0.2, 0.68]] as const,
};
/** 10 · nowy: a green shoot breaking through the soil into the sun (Eph 4:24) */
export const NOWY = {
  surface: (u: number) => 0.56 + 0.014 * Math.sin(u * 9 + 0.4),
  sun: { x: 0.5, y: 0.2, r: 0.09 },
  seed: { x: 0.5, y: 0.8, rx: 0.05, ry: 0.034 },
  shoot: { x: 0.5, top: 0.33, base: 0.78 },
};
/** 11 · zwycięzcą: a figure on a summit over a sea of clouds at sunrise (Rom 8:37) */
export const ZWYCIEZCA = {
  clouds: (u: number) => 0.57 + 0.025 * Math.sin(u * 13 + 0.3) + 0.015 * Math.sin(u * 29),
  summit: (u: number) => 0.73 + Math.abs(u - 0.5) * 0.72 + 0.012 * Math.sin(u * 37),
  sun: { x: 0.5, y: 0.55, r: 0.08 },
  figure: { x: 0.5, feet: 0.735, h: 0.18 },
};
/** 12 · światłem: a city on a hill at night (Eph 5:8) */
export const SWIATLO = {
  hill: (u: number) => 0.64 - 0.15 * bump(u, 0.5, 0.3),
  city: { x0: 0.27, x1: 0.73, top: 0.3 },
  moon: { x: 0.2, y: 0.2, r: 0.055 },
  river: { top: 0.81, bottom: 0.89 },
};
/** 13 · dzieckiem Bożym: a child running with a kite toward the sunrise (John 1:12) */
export const DZIECKO = {
  horizon: (u: number) => 0.63 + 0.015 * Math.sin(u * 5 + 0.2),
  sun: { x: 0.8, y: 0.6, r: 0.075 },
  kite: { x: 0.63, y: 0.22, s: 0.11 },
  child: { x: 0.36, feet: 0.8, h: 0.17 },
};
/** 14 · błogosławiony: gentle rain over sunlit fields (Eph 1:3) */
export const BLOGOSLAWIONY = {
  fields: (u: number) => 0.52 + 0.04 * Math.sin(u * 4 + 0.5),
  cloud: { x: 0.3, y: 0.22, rx: 0.3, ry: 0.11 },
  sun: { x: 0.83, y: 0.2, r: 0.07 },
  rain: { x0: 0.04, x1: 0.56 },
  tree: { x: 0.72, y: 0.56, r: 0.06 },
};
/** 15 · mądry: an open book by an oil lamp at night (Prov 2:6) */
export const MADRY = {
  table: 0.68,
  book: { x: 0.47, y: 0.665, rx: 0.25, ry: 0.07 },
  lamp: { x: 0.8, y: 0.52 },
  window: { x0: 0.07, x1: 0.31, top: 0.16, bottom: 0.44 },
  shelf: { x0: 0.4, top: 0.17, bottom: 0.47 },
};
/** 16 · bezpieczny: a strong tower on a rock with lit windows (Prov 18:10) */
export const BEZPIECZNY = {
  cliff: (u: number) => (u < 0.24 ? 0.8 - u * 0.4 : u > 0.78 ? 0.7 + (u - 0.78) * 0.5 : 0.7 + 0.01 * Math.sin(u * 30)),
  tower: { x0: 0.39, x1: 0.61, top: 0.2, base: 0.7 },
  sea: 0.84,
};
/** 17 · oczyszczony: a clear stream washing white linen in the sun (1 John 1:9) */
export const OCZYSZCZONY = {
  banks: 0.44,
  /** the stream's left and right edges at height v (it widens toward the front) */
  stream: (v: number): [number, number] => {
    const k = Math.max(0, (v - 0.44) / 0.56);
    const mid = 0.5 + 0.08 * Math.sin(v * 9);
    const half = 0.03 + k * 0.36;
    return [mid - half, mid + half];
  },
  linen: [[0.42, 0.71, 0.08, 0.035], [0.6, 0.84, 0.1, 0.04]] as const,
  willow: { x: 0.17, y: 0.34, r: 0.13 },
  sun: { x: 0.76, y: 0.16, r: 0.055 },
};
/** 18 · wybrany: a lit doorway in an evening street (Col 3:12) */
export const WYBRANY = {
  door: { x0: 0.43, x1: 0.57, top: 0.47, bottom: 0.73 },
  spill: [[0.43, 0.73], [0.57, 0.73], [0.82, 1], [0.18, 1]] as const,
  left: [[0, 0.1], [0.3, 0.3], [0.3, 0.8], [0, 1]] as const,
  right: [[1, 0.1], [0.7, 0.3], [0.7, 0.8], [1, 1]] as const,
  street: 0.74,
};

const stream = (u: number, v: number) => {
  if (v < OCZYSZCZONY.banks) return false;
  const [a, b] = OCZYSZCZONY.stream(v);
  return u >= a && u <= b;
};

// ── the scenes: heart and fragments ──────────────────────────────
export const SCENES: Readonly<Record<DeclId, SceneGeo>> = {
  zdrowy: {
    id: 'zdrowy', heart: [ZDROWY.runner.x, ZDROWY.near(ZDROWY.runner.x) - ZDROWY.runner.h * 0.5],
    regions: [
      { key: 'runner', test: (u, v) => inEllipse(u, v, ZDROWY.runner.x, ZDROWY.near(ZDROWY.runner.x) - ZDROWY.runner.h * 0.5, 0.075, ZDROWY.runner.h * 0.58) },
      { key: 'sun', test: (u, v) => inCircle(u, v, ZDROWY.sun.x, ZDROWY.sun.y, ZDROWY.sun.r * 1.7) && v < ZDROWY.far(u) + 0.02 },
      { key: 'sky', test: (u, v) => v < ZDROWY.far(u) },
      { key: 'hills', test: (u, v) => v < ZDROWY.near(u) },
      { key: 'meadow', test: all },
    ],
  },
  uzdrowiony: {
    id: 'uzdrowiony', heart: [0.5, 0.47],
    regions: [
      { key: 'tree', test: (u, v) => inCircle(u, v, UZDROWIONY.crown.x, UZDROWIONY.crown.y, UZDROWIONY.crown.r * 1.08) || (Math.abs(u - UZDROWIONY.trunk.x) < 0.05 && v > 0.4 && v < UZDROWIONY.stump.top) },
      { key: 'stump', test: (u, v) => inRect(u, v, UZDROWIONY.stump.x0 - 0.03, UZDROWIONY.stump.top - 0.03, UZDROWIONY.stump.x1 + 0.03, UZDROWIONY.stump.bottom + 0.02) },
      { key: 'light', test: (u, v) => v < 0.62 && u < 0.5 && v < 0.62 - u * 0.4 },
      { key: 'sky', test: (u, v) => v < UZDROWIONY.ground(u) - 0.06 },
      { key: 'ground', test: all },
    ],
  },
  silny: {
    id: 'silny', heart: [SILNY.cedar.x, 0.47],
    regions: [
      { key: 'cedar', test: (u, v) => Math.abs(u - SILNY.cedar.x) < SILNY.cedarHalf(v) + 0.02 || (Math.abs(u - SILNY.cedar.x) < 0.035 && v > 0.6 && v < SILNY.rock(u)) },
      { key: 'peaks', test: (u, v) => v >= SILNY.peaks(u) && v < SILNY.rock(u) },
      { key: 'sky', test: (u, v) => v < SILNY.peaks(u) },
      { key: 'rock', test: all },
    ],
  },
  szczesliwy: {
    id: 'szczesliwy', heart: [SZCZESLIWY.dancer.x, SZCZESLIWY.dancer.feet - SZCZESLIWY.dancer.h * 0.55],
    regions: [
      { key: 'dancer', test: (u, v) => inEllipse(u, v, SZCZESLIWY.dancer.x, SZCZESLIWY.dancer.feet - SZCZESLIWY.dancer.h * 0.5, 0.12, SZCZESLIWY.dancer.h * 0.62) },
      { key: 'sun', test: (u, v) => inCircle(u, v, SZCZESLIWY.sun.x, SZCZESLIWY.sun.y, SZCZESLIWY.sun.r * 1.8) },
      { key: 'oak', test: (u, v) => inCircle(u, v, SZCZESLIWY.tree.x, SZCZESLIWY.tree.y, SZCZESLIWY.tree.r * 1.25) },
      { key: 'sky', test: (u, v) => v < SZCZESLIWY.horizon(u) },
      { key: 'flowers', test: (_u, v) => v > 0.8 },
      { key: 'meadow', test: all },
    ],
  },
  bogaty: {
    id: 'bogaty', heart: [BOGATY.basket.x, BOGATY.basket.y - 0.02],
    regions: [
      { key: 'basket', test: (u, v) => inEllipse(u, v, BOGATY.basket.x, BOGATY.basket.y - 0.025, BOGATY.basket.rx * 1.2, BOGATY.basket.ry * 1.9) },
      { key: 'table', test: (u, v) => v > BOGATY.table.top - 0.02 && v < 0.86 && u > BOGATY.table.x0 - 0.02 && u < BOGATY.table.x1 + 0.02 },
      { key: 'orchard', test: (u, v) => v < BOGATY.ground && BOGATY.trees.some(([x, y, r]) => inCircle(u, v, x, y, r * 1.15) || (Math.abs(u - x) < 0.02 && v > y)) },
      { key: 'sky', test: (_u, v) => v < BOGATY.ground },
      { key: 'ground', test: all },
    ],
  },
  wolny: {
    id: 'wolny', heart: [WOLNY.bird.x, WOLNY.bird.y],
    regions: [
      { key: 'bird', test: (u, v) => inEllipse(u, v, WOLNY.bird.x, WOLNY.bird.y, WOLNY.bird.span * 0.62, 0.075) },
      { key: 'cage', test: (u, v) => inRect(u, v, WOLNY.cage.x - WOLNY.cage.w * 0.62, WOLNY.cage.top - 0.03, WOLNY.cage.x + WOLNY.cage.w * 0.62, WOLNY.cage.bottom + 0.02) },
      { key: 'sun', test: (u, v) => inCircle(u, v, WOLNY.sun.x, WOLNY.sun.y, WOLNY.sun.r * 2) },
      { key: 'clouds', test: (u, v) => WOLNY.clouds.some(([x, y, rx, ry]) => inEllipse(u, v, x, y, rx * 1.1, ry * 1.6)) },
      { key: 'sky', test: (_u, v) => v < WOLNY.horizon },
      { key: 'sea', test: all },
    ],
  },
  kochany: {
    id: 'kochany', heart: [KOCHANY.pair.x, KOCHANY.pair.feet - KOCHANY.pair.h * 0.55],
    regions: [
      { key: 'pair', test: (u, v) => inEllipse(u, v, KOCHANY.pair.x, KOCHANY.pair.feet - KOCHANY.pair.h * 0.5, 0.11, KOCHANY.pair.h * 0.58) },
      { key: 'light', test: (u, v) => inCircle(u, v, KOCHANY.sun.x, KOCHANY.sun.y - 0.02, 0.27) && v < KOCHANY.ground(u) },
      { key: 'sky', test: (u, v) => v < KOCHANY.ground(u) },
      { key: 'garden', test: all },
    ],
  },
  spokojny: {
    id: 'spokojny', heart: [SPOKOJNY.sun.x, SPOKOJNY.sun.y + 0.04],
    regions: [
      { key: 'sun', test: (u, v) => inCircle(u, v, SPOKOJNY.sun.x, SPOKOJNY.sun.y, 0.1) },
      { key: 'jetty', test: (u, v) => inPolygon(u, v, SPOKOJNY.jetty) || inPolygon(u, v, [[0.02, 1], [0.3, 1], [0.5, 0.68], [0.38, 0.68]]) },
      { key: 'sky', test: (u, v) => v < SPOKOJNY.hills(u) },
      { key: 'shore', test: (_u, v) => v < SPOKOJNY.shore + 0.03 },
      { key: 'shine', test: (u, _v) => Math.abs(u - SPOKOJNY.sun.x) < 0.09 },
      { key: 'lake', test: all },
    ],
  },
  odwazny: {
    id: 'odwazny', heart: [ODWAZNY.figure.x, ODWAZNY.figure.feet - ODWAZNY.figure.h * 0.5],
    regions: [
      { key: 'figure', test: (u, v) => inEllipse(u, v, ODWAZNY.figure.x, ODWAZNY.figure.feet - ODWAZNY.figure.h * 0.5, 0.08, ODWAZNY.figure.h * 0.6) },
      { key: 'wave', test: (u, v) => inPolygon(u, v, ODWAZNY.wave) },
      { key: 'rock', test: (u, v) => inPolygon(u, v, ODWAZNY.rock) },
      { key: 'light', test: (u, v) => inPolygon(u, v, ODWAZNY.light) && v < ODWAZNY.sea(u) },
      { key: 'sky', test: (u, v) => v < ODWAZNY.sea(u) },
      { key: 'sea', test: all },
    ],
  },
  nowy: {
    id: 'nowy', heart: [NOWY.shoot.x, NOWY.surface(NOWY.shoot.x) - 0.04],
    regions: [
      { key: 'shoot', test: (u, v) => Math.abs(u - NOWY.shoot.x) < 0.13 && v > NOWY.shoot.top - 0.03 && v < NOWY.surface(u) + 0.03 },
      { key: 'seed', test: (u, v) => inEllipse(u, v, NOWY.seed.x, NOWY.seed.y + 0.02, 0.13, 0.11) || (Math.abs(u - 0.5) < 0.035 && v > NOWY.surface(u) && v < NOWY.seed.y) },
      { key: 'sun', test: (u, v) => inCircle(u, v, NOWY.sun.x, NOWY.sun.y, NOWY.sun.r * 1.9) },
      { key: 'sky', test: (u, v) => v < NOWY.surface(u) },
      { key: 'soil', test: all },
    ],
  },
  zwyciezca: {
    id: 'zwyciezca', heart: [ZWYCIEZCA.figure.x, ZWYCIEZCA.figure.feet - ZWYCIEZCA.figure.h * 0.5],
    regions: [
      { key: 'raised', test: (u, v) => inEllipse(u, v, ZWYCIEZCA.figure.x, ZWYCIEZCA.figure.feet - ZWYCIEZCA.figure.h * 0.52, 0.085, ZWYCIEZCA.figure.h * 0.62) },
      { key: 'sun', test: (u, v) => inCircle(u, v, ZWYCIEZCA.sun.x, ZWYCIEZCA.sun.y - 0.01, 0.15) && v < ZWYCIEZCA.summit(u) },
      { key: 'summit', test: (u, v) => v >= ZWYCIEZCA.summit(u) },
      { key: 'clouds', test: (u, v) => v >= ZWYCIEZCA.clouds(u) },
      { key: 'sky', test: all },
    ],
  },
  swiatlo: {
    id: 'swiatlo', heart: [0.5, 0.43],
    regions: [
      { key: 'city', test: (u, v) => u > SWIATLO.city.x0 - 0.01 && u < SWIATLO.city.x1 + 0.01 && v > SWIATLO.city.top - 0.02 && v < SWIATLO.hill(u) + 0.03 },
      { key: 'moon', test: (u, v) => inCircle(u, v, SWIATLO.moon.x, SWIATLO.moon.y, SWIATLO.moon.r * 2) },
      { key: 'sky', test: (u, v) => v < SWIATLO.hill(u) },
      { key: 'river', test: (_u, v) => v > SWIATLO.river.top - 0.02 && v < SWIATLO.river.bottom + 0.02 },
      { key: 'hill', test: all },
    ],
  },
  dziecko: {
    id: 'dziecko', heart: [DZIECKO.child.x, DZIECKO.child.feet - DZIECKO.child.h * 0.5],
    regions: [
      { key: 'child', test: (u, v) => inEllipse(u, v, DZIECKO.child.x, DZIECKO.child.feet - DZIECKO.child.h * 0.5, 0.08, DZIECKO.child.h * 0.6) },
      { key: 'kite', test: (u, v) => inCircle(u, v, DZIECKO.kite.x, DZIECKO.kite.y + 0.02, DZIECKO.kite.s * 1.15) },
      { key: 'sun', test: (u, v) => inCircle(u, v, DZIECKO.sun.x, DZIECKO.sun.y, DZIECKO.sun.r * 1.8) },
      { key: 'sky', test: (u, v) => v < DZIECKO.horizon(u) },
      { key: 'field', test: all },
    ],
  },
  blogoslawiony: {
    id: 'blogoslawiony', heart: [0.42, 0.62],
    regions: [
      { key: 'cloud', test: (u, v) => inEllipse(u, v, BLOGOSLAWIONY.cloud.x, BLOGOSLAWIONY.cloud.y, BLOGOSLAWIONY.cloud.rx * 1.05, BLOGOSLAWIONY.cloud.ry * 1.3) },
      { key: 'sun', test: (u, v) => inCircle(u, v, BLOGOSLAWIONY.sun.x, BLOGOSLAWIONY.sun.y, BLOGOSLAWIONY.sun.r * 2) },
      { key: 'rain', test: (u, v) => u > BLOGOSLAWIONY.rain.x0 && u < BLOGOSLAWIONY.rain.x1 && v < BLOGOSLAWIONY.fields(u) + 0.04 },
      { key: 'sky', test: (u, v) => v < BLOGOSLAWIONY.fields(u) },
      { key: 'fields', test: all },
    ],
  },
  madry: {
    id: 'madry', heart: [MADRY.book.x, MADRY.book.y - 0.01],
    regions: [
      { key: 'book', test: (u, v) => inEllipse(u, v, MADRY.book.x, MADRY.book.y - 0.01, MADRY.book.rx * 1.1, MADRY.book.ry * 1.7) },
      { key: 'lamp', test: (u, v) => inEllipse(u, v, MADRY.lamp.x, MADRY.lamp.y - 0.02, 0.1, 0.16) },
      { key: 'window', test: (u, v) => inRect(u, v, MADRY.window.x0 - 0.02, MADRY.window.top - 0.03, MADRY.window.x1 + 0.02, MADRY.window.bottom + 0.02) },
      { key: 'shelf', test: (u, v) => u > MADRY.shelf.x0 && v < MADRY.shelf.bottom + 0.02 },
      { key: 'room', test: all },
    ],
  },
  bezpieczny: {
    id: 'bezpieczny', heart: [0.5, 0.46],
    regions: [
      { key: 'tower', test: (u, v) => inRect(u, v, BEZPIECZNY.tower.x0 - 0.02, BEZPIECZNY.tower.top - 0.04, BEZPIECZNY.tower.x1 + 0.02, BEZPIECZNY.tower.base + 0.01) },
      { key: 'rock', test: (u, v) => v >= BEZPIECZNY.cliff(u) && v < BEZPIECZNY.sea + 0.02 },
      { key: 'sky', test: (u, v) => v < BEZPIECZNY.cliff(u) },
      { key: 'sea', test: all },
    ],
  },
  oczyszczony: {
    id: 'oczyszczony', heart: [0.47, 0.74],
    regions: [
      { key: 'linen', test: (u, v) => OCZYSZCZONY.linen.some(([x, y, rx, ry]) => inEllipse(u, v, x, y, rx * 1.3, ry * 2)) },
      { key: 'stream', test: (u, v) => stream(u, v) },
      { key: 'willow', test: (u, v) => inCircle(u, v, OCZYSZCZONY.willow.x, OCZYSZCZONY.willow.y + 0.04, OCZYSZCZONY.willow.r * 1.2) },
      { key: 'sky', test: (_u, v) => v < OCZYSZCZONY.banks },
      { key: 'banks', test: all },
    ],
  },
  wybrany: {
    id: 'wybrany', heart: [0.5, 0.62],
    regions: [
      { key: 'door', test: (u, v) => inRect(u, v, WYBRANY.door.x0 - 0.03, WYBRANY.door.top - 0.05, WYBRANY.door.x1 + 0.03, WYBRANY.door.bottom) },
      { key: 'spill', test: (u, v) => inPolygon(u, v, WYBRANY.spill) },
      { key: 'houses', test: (u, v) => inPolygon(u, v, WYBRANY.left) || inPolygon(u, v, WYBRANY.right) || (v > 0.3 && v < WYBRANY.street) },
      { key: 'sky', test: (_u, v) => v < 0.32 },
      { key: 'street', test: all },
    ],
  },
};

/** The order a newcomer receives the declarations in (the identity first: loved; then the founder's own four). */
export const DECL_ORDER: readonly DeclId[] = [
  'kochany', 'zdrowy', 'silny', 'szczesliwy', 'spokojny', 'wolny', 'dziecko', 'bogaty', 'odwazny',
  'bezpieczny', 'swiatlo', 'blogoslawiony', 'wybrany', 'uzdrowiony', 'nowy', 'oczyszczony', 'madry', 'zwyciezca',
];

export const isDecl = (v: unknown): v is DeclId => typeof v === 'string' && (DECL_ORDER as readonly string[]).includes(v);
