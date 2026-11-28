/**
 * „Wszystko naraz” — its pictures (DESIGN.md §29): one person, whole, standing on a meadow on a hill at the golden
 * hour, a small town in the valley behind; as the session's focus gathers (naraz.ts, V) everything changes together:
 *
 *   the person    Nowe siły's person seen whole (person.ts): the back straightens and the shoulders open, the face rests
 *                 and its colour comes, the hair fills and shines, a quiet smile — never the body's shape
 *   the tissues   a fine warm light flowing from the heart through the body (the cells' constant repair)
 *   the heart     a light that grows, then passes on: to the people around (family and friends, soft featureless
 *                 figures that light one by one), and from them down into the town, whose windows light and multiply
 *                 (N^k: one, two, four … the whole town) — joy spreads through a network (Fowler & Christakis 2008)
 *   the evening   the golden hour turns to dusk with V, so the lights can be seen; first stars; lights rise from the
 *                 town into the evening sky
 *
 * Four worlds, one per scene, so that moving between them is a cross-fade of two whole pictures (never a still layer
 * of one framing panned under another):
 *
 *   naraz.whole   the whole figure from the front                          (scene `naraz`: light through the body)
 *   naraz.face    the face, the hair and the shoulders, close              (scene `oblicze`: the face rested, the hair)
 *   naraz.side    the whole figure from the side                           (scene `profil`: the spine, the plumb line)
 *   naraz.town    wide: the person, the people around and the whole town   (scene `miasto`: joy multiplied)
 *
 * The landscape is the still layer, baked once per view and size by the engine (the golden hour) together with an
 * own layer of the same size for dusk, both feathered at the picture's edges (so the words beside or under the
 * picture stay on the dark ground); a frame lays dusk over gold by V, then draws what lives: the sun, the stars, the
 * lit windows, the rising lights, the people, the threads, the person (painted once per renewal) and the light.
 * Reduced motion: nothing drifts (motes stand still, nothing twinkles); a fade is all that moves.
 */
import { GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, layer, mix, polyAt, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { geoOf, lookOf, spot, type Geo } from '../sily/figure';
import { FEET, HK, PersonCache, armsOf, sidePose, sideSpine, type SidePose } from './person';
import { cityLit, duskAt, heartAt, personLit, phase, renewalAt, risingAt, smooth, visionOf } from './naraz';

// ── the views (world units: the eye line ≈ −90, the soles at FEET) ──
// (on an upright phone the engine's words lie over the lowest sixth of the picture: the views keep meadow there, so
// the feet and the hearts stay in the open)
export const WHOLE_VIEW = { x: -80, y: -122, w: 160, h: 256 } as const;
export const FACE_VIEW = { x: -28, y: -122, w: 56, h: 88 } as const;
export const SIDE_VIEW = { x: -80, y: -122, w: 160, h: 256 } as const;
export const TOWN_VIEW = { x: -160, y: -130, w: 320, h: 238 } as const;

/** a close view of the face: the person fades out below the chest, as a portrait does (world y from, to) */
const FACE_FADE = [-58, -42] as const;

/** the geometry used for fixed places (labels, the growing point): half-way between slumped and upright */
const MID: Geo = geoOf('f', 0.5);
const headPt = (g: Geo, x: number, y: number): Pt => [x * HK, g.cy + 13 + (y - (g.cy + 13)) * HK];
/** the heart (a little left of the breastbone, as Nowe siły places it) */
const heartOf = (g: Geo): Pt => [3.4, g.sy + 17];
export const HEART: Pt = heartOf(MID);
/** the heart seen from the side: inside the chest, nearer the front */
const sideHeart = (p: SidePose): Pt => [(p.bust[0] + p.scap[0]) / 2 - 2.2, p.bust[1] + 1.5];
export const SIDE_HEART: Pt = sideHeart(sidePose('f', 0.5));
export const CHEEK: Pt = headPt(MID, -5.2, MID.cy + 4.2);
export const HAIR_SIDE: Pt = headPt(MID, 10.6, MID.cy - 5);

// ── the land ───────────────────────────────────────────────────────
/** the horizon: the far hills stand on it */
const HORIZON = -2;
/** the meadow's edge (the hilltop where the person stands, falling away to both sides) */
export const crestY = (x: number): number => 42 + 0.00042 * x * x;
/** a ridge of hills (deterministic, soft) */
const ridge = (x: number, base: number, amp: number, seed: number): number =>
  base - amp * (0.55 * Math.sin(x * 0.019 + seed) + 0.3 * Math.sin(x * 0.043 + seed * 2.3) + 0.15 * Math.sin(x * 0.11 + seed * 4.1) + 0.6);
const X0 = -280, X1 = 280;

interface Palette {
  sky: readonly [number, string][];
  far: string; near: string; town: readonly [string, string, string, string]; win: string;
  meadow: readonly [string, string, string]; rim: string; haze: string; hazeA: number;
}
const GOLDEN: Palette = {
  sky: [[0, '#2c3876'], [0.34, '#5f58a4'], [0.6, '#cf8a9c'], [0.8, '#f4b282'], [1, '#ffdca2']],
  far: '#b58aa8', near: '#8a6890', town: ['#a07e9e', '#7a5c88', '#5c4470', '#45325c'], win: '#33263f',
  meadow: ['#a39050', '#5f5a30', '#2a2618'], rim: '#ffe2a8', haze: '#ffd8a0', hazeA: 0.32,
};
const DUSK: Palette = {
  sky: [[0, '#0b0e2c'], [0.38, '#28215c'], [0.64, '#673876'], [0.84, '#b85e7c'], [1, '#ee8c6c']],
  far: '#4c3a70', near: '#36295c', town: ['#3e3062', '#2e2350', '#241b42', '#1b1434'], win: '#120c22',
  meadow: ['#3c3a50', '#24203a', '#120e1e'], rim: '#ffb08a', haze: '#ff9a7a', hazeA: 0.18,
};

// ── the town ───────────────────────────────────────────────────────
interface House { x: number; w: number; base: number; top: number; roof: number; row: number; tower?: boolean }
interface Tree { x: number; base: number; r: number; row: number }
export interface Win { x: number; y: number; w: number; h: number; row: number; warm: number }
/** the town's rows: far (hazy, small), middle, near (its feet behind the meadow's edge) */
const ROWS = [
  { base: 7, h: [2.4, 6.2], w: [2.6, 5.6], gap: 0.5, tree: 0.1, skip: 0.1 },
  { base: 21, h: [4.2, 12.5], w: [4.2, 9.6], gap: 1.2, tree: 0.22, skip: 0.12 },
  { base: 35, h: [5.6, 16], w: [5, 11], gap: 1.8, tree: 0.26, skip: 0.14 },
  { base: 52, h: [8, 23], w: [6.4, 13.6], gap: 2.6, tree: 0.3, skip: 0.18 },
] as const;
/** where the light comes down into the town (from the friends on the hill): the windows light outward from here */
export const ENTRIES: readonly Pt[] = [[-118, 26], [8, 30], [128, 25]];
/** the church tower of the near row stands here (right of the person) */
const TOWER_X = 64;

const TOWN = ((): { houses: House[]; trees: Tree[]; wins: Win[] } => {
  const houses: House[] = [];
  const trees: Tree[] = [];
  const wins: Win[] = [];
  ROWS.forEach((R, row) => {
    let x = X0 + hash(row * 13.1) * 8;
    let i = 0;
    let tower = false;
    while (x < X1) {
      const k = hash(row * 100 + i * 3.7);
      const w = R.w[0] + (R.w[1] - R.w[0]) * hash(row * 100 + i * 5.3);
      // fields and gardens between the houses, trees in them
      if (hash(row * 100 + i * 9.1) < R.skip) {
        const gw = w * (0.8 + hash(i * 4.4));
        if (row > 0) trees.push({ x: x + gw / 2, base: R.base, r: (1.4 + 1.1 * row) * (0.8 + 0.5 * hash(i * 6.6)), row });
        x += gw;
        i++;
        continue;
      }
      // a few tall houses among the low ones (a town, not a fence)
      const tall = hash(row * 100 + i * 8.3) < 0.16 ? 1.5 : 1;
      let h = (R.h[0] + (R.h[1] - R.h[0]) * k * k) * tall;
      const isTower = row === 3 && !tower && x + w > TOWER_X;
      if (isTower) {
        tower = true;
        h = 32;
      }
      const roof = isTower ? 0 : hash(row * 100 + i * 2.9) < 0.72 ? w * (0.3 + 0.22 * hash(i * 7.7)) : 0;
      const ww0 = isTower ? 5 : w;
      houses.push({ x, w: ww0, base: R.base, top: R.base - h, roof, row, tower: isTower });
      if (row > 0 && hash(row * 100 + i * 1.3) < R.tree) trees.push({ x: x + ww0 + 0.6, base: R.base, r: (1.2 + 0.9 * row) * (0.8 + 0.5 * hash(i * 2.6)), row });
      // windows: a grid on the face (not every square lit later), a tower's few
      const sp = [1.9, 2.6, 3.1, 3.7][row];
      const winW = [0.8, 1.1, 1.4, 1.8][row], winH = [0.9, 1.4, 1.8, 2.3][row];
      const cols = Math.max(1, Math.floor((ww0 - 1) / sp)), rows = Math.max(1, Math.floor((h - 1.6) / (sp * 1.15)));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (hash(row * 1000 + i * 31 + c * 7 + r * 13) < (isTower ? 0.6 : 0.32)) continue;
          const wx = x + (ww0 - cols * sp) / 2 + c * sp + (sp - winW) / 2;
          const wy = R.base - 1.8 - (r + 1) * sp * 1.15 + (sp * 1.15 - winH) / 2;
          wins.push({ x: wx, y: wy, w: winW, h: winH, row, warm: hash(row * 77 + i * 3 + c + r * 5) });
        }
      }
      x += ww0 + R.gap * (0.3 + hash(i * 1.3 + row));
      i++;
    }
  });
  // the streets: strings of small lamps winding through the valley (lit with the windows)
  for (const [y0, amp, ph, sp] of [[14, 2.2, 0.4, 3.6], [29, 2.8, 1.9, 4.2], [44, 3.2, 3.1, 4.8]] as const) {
    for (let x = X0 + 4; x < X1; x += sp) {
      if (hash(x * 0.37 + y0) < 0.12) continue;
      const y = y0 + amp * Math.sin(x * 0.03 + ph) + 1.4 * Math.sin(x * 0.11 + ph * 2);
      wins.push({ x: x - 0.45, y: y - 0.45, w: 0.9, h: 0.9, row: y0 < 20 ? 1 : 2, warm: 0.6 + 0.2 * hash(x) });
    }
  }
  // the order the windows light in: outward from where the light comes down, with a little chance in it
  const order = wins.map((w, i) => {
    const d = Math.min(...ENTRIES.map(([ex, ey]) => Math.hypot(w.x - ex, (w.y - ey) * 2)));
    return { w, d: d + 26 * hash(i * 1.77) };
  });
  order.sort((a, b) => a.d - b.d);
  return { houses, trees, wins: order.map(o => o.w) };
})();
/** the windows in the order they light */
export const WINDOWS: readonly Win[] = TOWN.wins;

// ── the people around ──────────────────────────────────────────────
/** a man, a woman, a child */
export type Kin = 'm' | 'f' | 'c';
export interface Friend { x: number; feet: number; h: number; kin: Kin }
/**
 * Family a few steps behind on the hilltop (a man, a woman and a child), then friends further down the meadow — soft
 * featureless figures, lit in this order.
 */
export const FRIENDS: readonly Friend[] = [
  { x: -46, feet: 78, h: 112, kin: 'm' },
  { x: 46, feet: 78, h: 106, kin: 'f' },
  { x: 61, feet: 79, h: 66, kin: 'c' },
  { x: -94, feet: 66, h: 86, kin: 'f' },
  { x: 98, feet: 65, h: 84, kin: 'm' },
  { x: -140, feet: 58, h: 64, kin: 'm' },
  { x: 143, feet: 57, h: 62, kin: 'f' },
];
export const friendHeart = (f: Friend): Pt => [f.x + 0.02 * f.h, f.feet - 0.7 * f.h];

/** A closed smooth outline through points (Catmull-Rom as Béziers). */
function smoothClosed(P: Path2D, pts: readonly Pt[]): void {
  const n = pts.length;
  const at = (i: number): Pt => pts[(i + n) % n];
  P.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    P.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  P.closePath();
}

/**
 * The right half of a soft figure from the neck down to the inner foot (x half-width, t height, both in the figure's
 * height): the arms along the body with the hands just apart, a skirt or legs, the feet — no face, no fingers.
 */
const HALF: Readonly<Record<Kin, readonly (readonly [number, number])[]>> = {
  m: [
    [0.026, 0.862], [0.05, 0.836], [0.1, 0.818], [0.124, 0.79], [0.131, 0.73], [0.128, 0.64], [0.124, 0.55], [0.122, 0.49],
    [0.112, 0.462], [0.098, 0.47], [0.092, 0.5], [0.082, 0.44], [0.074, 0.3], [0.064, 0.24], [0.056, 0.1], [0.046, 0.035],
    [0.06, 0.008], [0.054, 0], [0.016, 0], [0.018, 0.04], [0.022, 0.24], [0.02, 0.3], [0.008, 0.468],
  ],
  f: [
    [0.024, 0.866], [0.046, 0.84], [0.088, 0.824], [0.108, 0.798], [0.114, 0.74], [0.11, 0.65], [0.106, 0.56], [0.104, 0.5],
    [0.096, 0.472], [0.084, 0.48], [0.086, 0.52], [0.094, 0.44], [0.11, 0.33], [0.118, 0.27], [0.06, 0.262], [0.05, 0.13],
    [0.04, 0.035], [0.052, 0.008], [0.046, 0], [0.014, 0], [0.016, 0.04], [0.02, 0.13], [0.012, 0.262],
  ],
  c: [
    [0.034, 0.82], [0.064, 0.79], [0.112, 0.77], [0.13, 0.73], [0.136, 0.64], [0.13, 0.54], [0.126, 0.47], [0.116, 0.44],
    [0.1, 0.45], [0.098, 0.49], [0.09, 0.4], [0.084, 0.24], [0.07, 0.04], [0.082, 0.01], [0.076, 0], [0.02, 0], [0.022, 0.05],
    [0.026, 0.24], [0.01, 0.42],
  ],
};

/** A soft figure at dusk: a head, the body with its arms, a skirt or legs — a person, never a portrait. */
function softFigure(f: Friend): Path2D {
  const P = new Path2D();
  const at = (x: number, t: number): Pt => [f.x + x * f.h, f.feet - t * f.h];
  const child = f.kin === 'c';
  const [hx, hy] = at(0, child ? 0.9 : 0.932);
  P.ellipse(hx, hy, (child ? 0.075 : 0.05) * f.h, (child ? 0.094 : 0.066) * f.h, 0, 0, TAU);
  const half = HALF[f.kin];
  const right = half.map(([x, t]) => at(x, t));
  const left = [...half].reverse().map(([x, t]) => at(-x, t));
  smoothClosed(P, [...right, ...left]);
  return P;
}

const friendPaths = new Map<number, Path2D>();
function friendPath(i: number): Path2D | null {
  if (typeof Path2D === 'undefined') return null;
  let p = friendPaths.get(i);
  if (!p) {
    p = softFigure(FRIENDS[i]);
    friendPaths.set(i, p);
  }
  return p;
}

// ── the landscape (baked) ──────────────────────────────────────────
interface Box { x: number; y: number; w: number; h: number }

/** The landscape in a palette, over a world rect (the layer's footprint). */
function paintLand(ctx: CanvasRenderingContext2D, P: Palette, box: Box): void {
  const x0 = Math.min(box.x, X0), x1 = Math.max(box.x + box.w, X1);
  const top = Math.min(box.y, -210), bottom = Math.max(box.y + box.h, 160);
  // the sky
  const sky = ctx.createLinearGradient(0, -210, 0, HORIZON + 8);
  for (const [o, c] of P.sky) sky.addColorStop(o, c);
  ctx.fillStyle = sky;
  ctx.fillRect(x0, top, x1 - x0, HORIZON + 8 - top + 1);
  // the low light along the horizon, the sun's side warmer
  glowEllipse(ctx, P.haze, -120, HORIZON - 6, 210, 46, 0, P.hazeA);
  glowEllipse(ctx, P.haze, 60, HORIZON - 2, 240, 22, 0, P.hazeA * 0.5);
  // the far hills and the nearer ones
  const hills = (base: number, amp: number, seed: number, color: string, down: number): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0, down);
    for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, ridge(x, base, amp, seed));
    ctx.lineTo(x1, down);
    ctx.closePath();
    ctx.fill();
  };
  hills(HORIZON + 2, 9, 1.3, P.far, 60);
  // the town's far row sits on the plain before the nearer hills
  drawHouses(ctx, 0, P);
  hills(16, 7, 2.9, P.near, 80);
  drawHouses(ctx, 1, P);
  drawHouses(ctx, 2, P);
  drawHouses(ctx, 3, P);
  // the unlit windows (a little darker than the walls)
  ctx.fillStyle = P.win;
  ctx.beginPath();
  for (const w of WINDOWS) ctx.rect(w.x, w.y, w.w, w.h);
  ctx.fill();
  // the meadow: the hilltop where the person stands
  const mg = ctx.createLinearGradient(0, 40, 0, 150);
  mg.addColorStop(0, P.meadow[0]);
  mg.addColorStop(0.4, P.meadow[1]);
  mg.addColorStop(1, P.meadow[2]);
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.moveTo(x0, crestY(x0));
  for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, crestY(x));
  ctx.lineTo(x1, bottom);
  ctx.lineTo(x0, bottom);
  ctx.closePath();
  ctx.fill();
  // the low sun's rim along the hilltop (stronger on the sun's side)
  ctx.lineCap = 'round';
  for (let x = x0; x < x1; x += 8) {
    const a = 0.32 * Math.max(0, 1 - Math.abs(x + 60) / 260);
    if (a < 0.02) continue;
    ctx.strokeStyle = rgba(P.rim, a);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, crestY(x) + 0.4);
    ctx.lineTo(x + 8, crestY(x + 8) + 0.4);
    ctx.stroke();
  }
  // grass and small flowers in the meadow (always the same)
  ctx.lineWidth = 0.35;
  for (let i = 0; i < 260; i++) {
    const x = x0 + hash(i * 3.3 + 1) * (x1 - x0);
    const y = crestY(x) + 4 + hash(i * 7.1 + 2) * 100;
    const h = 1.2 + 2.6 * hash(i * 1.9) * (0.4 + (y - 40) / 100);
    ctx.strokeStyle = rgba(mix(P.meadow[0], '#ffffff', 0.12), 0.16 + 0.2 * hash(i * 5.5));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 0.4, y - h * 0.6, x + 0.9 * (hash(i) - 0.4), y - h);
    ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const x = x0 + hash(i * 9.7 + 5) * (x1 - x0);
    const y = crestY(x) + 8 + hash(i * 4.3 + 3) * 90;
    ctx.fillStyle = rgba(['#ffe6b0', '#ffc2c8', '#e8dcff', '#fff4dc'][i % 4], 0.35 + 0.25 * hash(i));
    ctx.beginPath();
    ctx.arc(x, y, 0.35 + 0.35 * hash(i * 2.2) * (y / 90), 0, TAU);
    ctx.fill();
  }
}

function drawHouses(ctx: CanvasRenderingContext2D, row: number, P: Palette): void {
  const wall = P.town[row];
  const roofC = mix(wall, '#000000', 0.18);
  // trees behind and between the houses: soft round crowns
  ctx.fillStyle = mix(wall, '#10202a', 0.25);
  ctx.beginPath();
  for (const t of TOWN.trees) {
    if (t.row !== row) continue;
    ctx.moveTo(t.x + t.r, t.base - t.r * 1.2);
    ctx.arc(t.x, t.base - t.r * 1.2, t.r, 0, TAU);
    ctx.moveTo(t.x + t.r * 0.7, t.base - t.r * 1.9);
    ctx.arc(t.x - t.r * 0.3, t.base - t.r * 1.9, t.r * 0.7, 0, TAU);
    ctx.rect(t.x - 0.3, t.base - t.r * 0.6, 0.6, t.r * 0.8);
  }
  ctx.fill();
  ctx.fillStyle = wall;
  ctx.beginPath();
  for (const h of TOWN.houses) {
    if (h.row !== row) continue;
    ctx.rect(h.x, h.top, h.w, h.base + 6 - h.top);
  }
  ctx.fill();
  ctx.fillStyle = roofC;
  ctx.beginPath();
  for (const h of TOWN.houses) {
    if (h.row !== row) continue;
    if (h.tower) {
      // a church tower with its spire
      ctx.moveTo(h.x - 0.4, h.top);
      ctx.lineTo(h.x + h.w / 2, h.top - 12);
      ctx.lineTo(h.x + h.w + 0.4, h.top);
      ctx.closePath();
    } else if (h.roof > 0) {
      ctx.moveTo(h.x - 0.5, h.top + 0.3);
      ctx.lineTo(h.x + h.w / 2, h.top - h.roof);
      ctx.lineTo(h.x + h.w + 0.5, h.top + 0.3);
      ctx.closePath();
    } else ctx.rect(h.x - 0.3, h.top - 0.6, h.w + 0.6, 0.8);
  }
  ctx.fill();
  for (const h of TOWN.houses) {
    if (h.row !== row || !h.tower) continue;
    ctx.strokeStyle = roofC;
    ctx.lineWidth = 0.5;
    const cx = h.x + h.w / 2, cy = h.top - 12;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 3.4);
    ctx.moveTo(cx - 1.1, cy - 2.4);
    ctx.lineTo(cx + 1.1, cy - 2.4);
    ctx.stroke();
  }
}

/** Fade a layer's edges to nothing (device px; the layer is the picture's box). */
function feather(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const f = Math.max(6, Math.min(W, H) * 0.07);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number): void => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  edge(0, 0, f, 0, 0, 0, f, H);
  edge(W, 0, W - f, 0, W - f, 0, f, H);
  edge(0, 0, 0, f, 0, 0, W, f);
  edge(0, H, 0, H - f, 0, H - f, W, f);
  ctx.restore();
}

/** The still layers of a picture: the engine's (golden, its bake) and ours (dusk), with where they lie. */
interface Land { dusk: HTMLCanvasElement | null; box: Box; t: { a: number; e: number; f: number } }
const MAX_LANDS = 6;

// ── a frame's helpers ──────────────────────────────────────────────
const persons = new PersonCache();

interface Frame {
  st: WorldState;
  v: number;
  t: number;
  R: boolean;
  /** a slow twinkle (still in reduced motion) */
  tw: (ph: number, sp?: number) => number;
}

/** The sun low on the left, setting with the vision; its glow stays as the afterglow. */
function drawSun(ctx: CanvasRenderingContext2D, v: number): void {
  const k = smooth(phase(v, 0, 0.85));
  const sx = -104 - 16 * k, sy = -42 + 40 * k;
  const d = duskAt(v);
  glow(ctx, '#ffcf96', sx, sy, 120, 0.3 * (1 - 0.6 * d));
  glow(ctx, '#ffe6bc', sx, sy, 40, 0.36 * (1 - 0.8 * d));
  const disc = 1 - phase(v, 0.42, 0.6);
  if (disc > 0.01) {
    glow(ctx, '#fff4dc', sx, sy, 11, 0.9 * disc);
    ctx.fillStyle = rgba('#fff8ea', 0.92 * disc);
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, TAU);
    ctx.fill();
  }
}

/** The first stars of the evening. */
function drawStars(ctx: CanvasRenderingContext2D, F: Frame, box: Box): void {
  const a = phase(F.v, 0.62, 1);
  if (a <= 0.01) return;
  for (let i = 0; i < 36; i++) {
    const x = -260 + hash(i * 4.7 + 9) * 520;
    const y = -230 + hash(i * 8.3 + 1) * 190;
    if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) continue;
    glow(ctx, '#e6ecff', x, y, 1 + 1.4 * hash(i * 2.1), a * (0.25 + 0.5 * hash(i)) * F.tw(i * 1.7, 0.6));
  }
}

/** the lit windows' three warm colours, and which one a window takes */
const LIT_COLOURS = ['#ffd27a', '#ffe9b6', '#ffb25e'] as const;
const litClass = (w: Win): number => (w.warm < 0.55 ? 0 : w.warm < 0.8 ? 1 : 2);
/** the lit windows as three paths, kept while their number stays (a rest, a grown picture) */
let litCache: { n: number; paths: Path2D[] } | null = null;
function litPaths(n: number): Path2D[] | null {
  if (typeof Path2D === 'undefined') return null;
  if (litCache && litCache.n === n) return litCache.paths;
  const paths = [new Path2D(), new Path2D(), new Path2D()];
  for (let i = 0; i < n; i++) {
    const w = WINDOWS[i];
    paths[litClass(w)].rect(w.x, w.y, w.w, w.h);
  }
  litCache = { n, paths };
  return paths;
}

/** The town's lit windows (the first n of the order), a warm haze over them, and the newest ones brightest. */
function drawTownLights(ctx: CanvasRenderingContext2D, F: Frame, scale = 1): number {
  const N = WINDOWS.length;
  const n = cityLit(F.v, N);
  if (n <= 0) return 0;
  const share = n / N;
  glowEllipse(ctx, '#ffb870', 0, 24, 250, 22, 0, 0.16 * share);
  glowEllipse(ctx, '#ffd8a0', 0, 34, 200, 10, 0, 0.12 * share);
  const paths = litPaths(n);
  if (paths) {
    LIT_COLOURS.forEach((c, j) => {
      ctx.fillStyle = c;
      ctx.fill(paths[j]);
    });
  } else {
    // no Path2D (a test's canvas): the rectangles one by one
    for (let i = 0; i < n; i++) {
      const w = WINDOWS[i];
      ctx.fillStyle = LIT_COLOURS[litClass(w)];
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
  }
  // a glow on every few windows, and the newest third sparkling: the light multiplying as it goes
  for (let i = 0; i < n; i += 6) {
    const w = WINDOWS[i];
    glow(ctx, '#ffc878', w.x + w.w / 2, w.y + w.h / 2, (2 + 0.8 * w.row) * scale, 0.32 * F.tw(i * 0.9, 0.5));
  }
  const fresh = Math.max(0, Math.floor(n * 0.7));
  for (let i = fresh; i < n; i += 3) {
    const w = WINDOWS[i];
    glow(ctx, '#fff1c9', w.x + w.w / 2, w.y + w.h / 2, (2.4 + 0.8 * w.row) * scale, 0.4 * F.tw(i * 2.3, 1.2));
  }
  return n;
}

/** Lights rising from the lit town into the evening sky. */
function drawRising(ctx: CanvasRenderingContext2D, F: Frame, lit: number, big = 1, max = 28): void {
  const m = Math.min(risingAt(F.v, max), lit);
  for (let i = 0; i < m; i++) {
    const w = WINDOWS[(i * 37) % Math.max(1, lit)];
    const q = F.R ? 0.15 + 0.7 * hash(i * 3.3) : (F.t * (0.018 + 0.012 * hash(i)) + hash(i * 7.9)) % 1;
    const x = w.x + (F.R ? 0 : 6 * Math.sin(F.t * 0.4 + i));
    const y = w.y - q * 150;
    const a = Math.sin(Math.PI * q) * 0.7;
    glow(ctx, i % 3 ? GOLD : '#ffc0a8', x, y, (1.6 + 1.2 * hash(i * 5.1)) * big, a);
  }
}

/** The people around: soft figures in the evening light at first, then lit one by one — a warm heart, a glowing outline. */
function drawFriends(ctx: CanvasRenderingContext2D, F: Frame, presence: number): void {
  const d = duskAt(F.v);
  for (let i = 0; i < FRIENDS.length; i++) {
    const f = FRIENDS[i];
    const P = friendPath(i);
    if (!P) continue;
    const k = personLit(F.v, i);
    ctx.save();
    // unlit, a soft presence in the evening haze (their colour nearer the far hills'); lit, fully there
    const haze = (1 - presence) * (1 - k);
    ctx.lineJoin = 'round';
    // backlit by the low sun (a soft dark figure with a golden rim), then a figure of the dusk; lit, it warms from within
    const body = mix(mix(mix('#5c4262', '#2c2148', d), mix('#9a7a9c', '#45376a', d), haze), '#8a5462', 0.35 * k);
    ctx.fillStyle = body;
    ctx.fill(P);
    // the warmth inside, from the heart (a soft light; no clip — it stays within the body)
    if (k > 0.01) glowEllipse(ctx, '#ffc890', f.x, f.feet - f.h * 0.64, f.h * 0.08, f.h * 0.2, 0, 0.3 * k);
    ctx.strokeStyle = rgba(mix('#ffd6a8', '#ffe2a8', k), 0.14 * (1 - d) + 0.06 + 0.5 * k);
    ctx.lineWidth = 0.3 + 0.35 * k;
    ctx.stroke(P);
    ctx.restore();
    if (k > 0.01) {
      const [hx, hy] = friendHeart(f);
      glowEllipse(ctx, '#ffcf9a', f.x, f.feet - f.h * 0.5, f.h * 0.26, f.h * 0.6, 0, 0.14 * k);
      glow(ctx, GOLD, hx, hy, f.h * (0.06 + 0.07 * k), 0.6 * k * F.tw(i * 1.3, 0.5));
      glow(ctx, GOLD_HI, hx, hy, f.h * 0.025, 0.85 * k);
    }
  }
}

/** Light passing from heart to heart, and from the friends down into the town. */
function drawThreads(ctx: CanvasRenderingContext2D, F: Frame, from: Pt, strength: number): void {
  for (let i = 0; i < FRIENDS.length; i++) {
    const k = personLit(F.v, i);
    if (k <= 0.01) continue;
    const f = FRIENDS[i];
    const to = friendHeart(f);
    // the strongest while this one is being lit, then gentle
    const lighting = phase(F.v, 0, 1) < 1 ? Math.sin(Math.PI * Math.min(1, k)) : 0;
    const a = (0.25 + 0.55 * lighting) * strength;
    const mid: Pt = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 14 - Math.abs(to[0] - from[0]) * 0.12];
    const n = 4;
    for (let j = 0; j < n; j++) {
      const q = F.R ? (j + 0.5) / n : (F.t * 0.22 + j / n + hash(i * 3.1)) % 1;
      const u = 1 - q;
      const x = u * u * from[0] + 2 * u * q * mid[0] + q * q * to[0];
      const y = u * u * from[1] + 2 * u * q * mid[1] + q * q * to[1];
      glow(ctx, j % 2 ? GOLD_HI : '#ffc7a8', x, y, 1.6, a * Math.sin(Math.PI * q) * k);
    }
  }
  // from the friends on the hill down into the town, as the windows begin to light
  const town = phase(F.v, 0.5, 0.75);
  if (town <= 0.01) return;
  for (let i = 3; i < FRIENDS.length; i++) {
    const f = FRIENDS[i];
    const s = friendHeart(f);
    const e = ENTRIES[i % ENTRIES.length];
    for (let j = 0; j < 3; j++) {
      const q = F.R ? (j + 0.5) / 3 : (F.t * 0.18 + j / 3 + hash(i * 5.3)) % 1;
      const [x, y] = polyAt([s, [(s[0] + e[0]) / 2, Math.min(s[1], e[1]) - 6], e], q);
      glow(ctx, GOLD, x, y, 1.3, 0.5 * town * strength * Math.sin(Math.PI * q));
    }
  }
}

/** The ways the fine warm light flows through the body from the heart (never into the head: a light there reads as a halo). */
function bodyWays(g: Geo): Pt[][] {
  const H = heartOf(g);
  const a = armsOf(g, 0.5).arm;
  const neck: Pt = [0.6, g.cy + 15];
  const out: Pt[][] = [[H, [1, g.sy + 2], neck]];
  for (const s of [-1, 1]) {
    const m = (p: readonly [number, number]): Pt => [s < 0 ? p[0] : -p[0], p[1]];
    out.push([H, [s * (g.sx - 8), g.sy + 6], m(a[0]), m(a[1]), m(a[2]), m(a[3])]);
    out.push([H, [s * 3, g.sy + 34], [s * 7.5, g.sy + 56], [s * 6.2, 30], [s * 5.4, 62], [s * 5.2, 84]]);
  }
  return out;
}
function sideWays(p: SidePose): Pt[][] {
  const H = sideHeart(p);
  return [
    [H, [p.notch[0] + 3, p.notch[1] + 2], [p.throat[0] + 3, p.throat[1]]],
    [H, p.shoulder, p.elbow, p.wrist, p.hand],
    [H, [p.belly[0] + 4, -20], [p.hip[0], 0], [p.knee[0] - 0.5, 40], [p.ankle[0] - 0.8, 82]],
  ];
}

/** The fine warm light in the tissues (the cells' repair): motes flowing out from the heart. */
function drawFlow(ctx: CanvasRenderingContext2D, F: Frame, ways: Pt[][], amount: number): void {
  const n = Math.round(34 * amount);
  for (let i = 0; i < n; i++) {
    const w = ways[i % ways.length];
    const q = F.R ? hash(i * 9.1) : (F.t * (0.08 + 0.04 * hash(i)) + hash(i * 3.7)) % 1;
    const [x, y] = polyAt(w, q);
    const fade = Math.sin(Math.PI * q);
    glow(ctx, i % 3 ? '#ffd9a8' : '#ffeedd', x, y, 1.7, 0.42 * fade * amount);
  }
}

/** The heart's light: small from the start, growing with the vision, breathing with rest. */
function drawHeart(ctx: CanvasRenderingContext2D, F: Frame, at: Pt, rings: number, size = 1): void {
  const h = heartAt(F.v) * (1 + 0.25 * F.st.deep) * size;
  const br = F.st.breath;
  glow(ctx, '#ffd98a', at[0], at[1], 4 + 18 * h * (0.92 + 0.16 * br), 0.42 * h);
  glow(ctx, '#fff1c9', at[0], at[1], 1.6 + 2.6 * h, 0.85 * h);
  if (rings <= 0.01) return;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const p = F.R ? (i + 0.5) / 3 : (F.t * 0.14 + i / 3) % 1;
    // (they stay below the chin: a ring round the head would read as a halo)
    const r = 3 + p * 21 * (0.5 + 0.5 * rings);
    const a = rings * (1 - p) * 0.22;
    if (a <= 0.01) continue;
    ctx.strokeStyle = rgba(i % 2 ? '#ffc7a8' : GOLD, a);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(at[0], at[1], r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** The person, breathing with the rest's guide (a 1 % rise), painted once per renewal; the low sun's long shadow and rim. */
function drawPerson(ctx: CanvasRenderingContext2D, F: Frame, look: string, side: boolean, fade?: readonly [number, number]): void {
  const sun = 1 - duskAt(F.v);
  // the long shadow of the low sun across the meadow (gone at dusk)
  if (sun > 0.02) spot(ctx, '#140a1e', 34, FEET + 0.8, 40, 2.6, 0.32 * sun);
  const breathe = F.R ? 0 : (F.st.breath - 0.5) * 0.012;
  ctx.save();
  if (breathe) {
    ctx.translate(0, FEET);
    ctx.scale(1 + breathe * 0.4, 1 + breathe);
    ctx.translate(0, -FEET);
  }
  persons.draw(ctx, look, renewalAt(F.v), side ? 'side' : 'front', fade);
  ctx.restore();
  // the golden hour's rim along the sun's side, then the town's warm light from behind at dusk
  if (sun > 0.02) {
    glowEllipse(ctx, '#ffd59a', side ? -9 : -21, -36, 5, 50, 0.04, 0.16 * sun);
    glowEllipse(ctx, '#ffd59a', side ? -6 : -14, 30, 4, 50, 0, 0.1 * sun);
  }
  const town = phase(F.v, 0.6, 1);
  if (town > 0.02) for (const s of [-1, 1]) glowEllipse(ctx, '#ffbf86', s * (side ? 9 : 22), 10, 5, 80, 0, 0.08 * town);
}

/** The face, close: new cells reaching the surface rise as a shimmer from the jaw to the brow; a sheen glides down the hair. */
function drawFresh(ctx: CanvasRenderingContext2D, F: Frame, g: Geo, k: number): void {
  if (k <= 0.01) return;
  const front = g.cy + 12 - 24 * smooth(Math.min(1, k * 1.1));
  const [bx, by] = headPt(g, 0, front);
  glowEllipse(ctx, '#ffe9d6', bx, by, 9.6, 2.4, 0, 0.24 * (1 - 0.6 * smooth(phase(k, 0.85, 1))));
  for (let i = 0; i < 12; i++) {
    const u = hash(i * 1.7) - 0.5;
    const y0 = front + (hash(i * 5.3) - 0.5) * 3;
    if (Math.abs(u) * 16 > 7.4 * Math.sqrt(Math.max(0, 1 - ((y0 - g.cy - 0.5) / 12.5) ** 2))) continue;
    const [x, y] = headPt(g, u * 15, y0);
    glow(ctx, '#fff6ea', x, y, 0.55, 0.45 * F.tw(i * 1.3, 2.2));
  }
  // the hair's sheen: a soft light gliding down its fall on both sides
  const q = F.R ? 0.4 : (F.t * 0.12) % 1;
  for (const s of [-1, 1]) {
    const [x, y] = headPt(g, s * 10.2, g.cy - 12 + 22 * q);
    glowEllipse(ctx, '#fff0d8', x, y, 2.2, 4, s * 0.2, 0.3 * phase(k, 0.3, 0.8) * Math.sin(Math.PI * q));
  }
}

/** Seen from the side: the spine lit from the sacrum up as the scene grows, and the plumb line showing the easy upright. */
function drawSpine(ctx: CanvasRenderingContext2D, p: SidePose, k: number): void {
  const pts = sideSpine(p);
  const n = 24;
  for (let i = 0; i < n; i++) {
    const q = i / (n - 1);
    const on = smooth(phase(k * 1.15, q * 0.9, q * 0.9 + 0.12));
    if (on <= 0.01) continue;
    const [x, y] = polyAt(pts, q);
    glow(ctx, '#bfefff', x, y, 2.2, 0.32 * on);
    ctx.fillStyle = rgba('#fff4e6', 0.55 * on);
    ctx.beginPath();
    ctx.ellipse(x, y, 1.1, 0.75, 0, 0, TAU);
    ctx.fill();
  }
  const line = phase(k, 0.5, 0.8);
  if (line <= 0.01) return;
  ctx.save();
  ctx.setLineDash([1.6, 2.2]);
  ctx.strokeStyle = rgba('#fff1d8', 0.35 * line);
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(0, FEET - 4);
  ctx.lineTo(0, -60);
  ctx.stroke();
  ctx.restore();
  // rings at the shoulder, the hip, the knee and the ankle (none on the head)
  for (const j of [p.shoulder, p.hip, p.knee, p.ankle]) {
    ctx.strokeStyle = rgba(GOLD_HI, 0.6 * line);
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.arc(j[0], j[1], 1.6, 0, TAU);
    ctx.stroke();
  }
}

// ── the worlds ────────────────────────────────────────────────────
type Kind = 'whole' | 'face' | 'side' | 'town';

function makeWorld(kind: Kind): WorldPainter {
  const lands: Land[] = [];

  /** The dusk layer and the footprint of the picture this frame draws over (the bake with the same transform, else the latest). */
  const landFor = (ctx: CanvasRenderingContext2D): Land | null => {
    if (!lands.length) return null;
    const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    if (m) {
      const same = lands.find(L => Math.abs(L.t.a - m.a) < 1e-6 * Math.max(1, Math.abs(m.a)) && Math.abs(L.t.e - m.e) < 0.5 && Math.abs(L.t.f - m.f) < 0.5);
      if (same) return same;
      // the same picture drawn somewhere on a larger canvas (the game's box inside the screen): the same scale
      const scaled = lands.find(L => Math.abs(L.t.a - m.a) < 1e-6 * Math.max(1, Math.abs(m.a)));
      if (scaled) return scaled;
    }
    return lands[0];
  };

  return {
    depth: 0,
    lens: false,
    bake(ctx: CanvasRenderingContext2D): void {
      // the footprint of the engine's layer (the picture's box) in world units
      const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
      const W = ctx.canvas?.width ?? 0, H = ctx.canvas?.height ?? 0;
      const a = m && m.a ? m.a : 1;
      const box: Box = m && W > 0 && H > 0 ? { x: -m.e / a, y: -m.f / m.d, w: W / a, h: H / m.d } : { x: X0, y: -210, w: X1 - X0, h: 370 };
      paintLand(ctx, GOLDEN, box);
      if (W > 0 && H > 0) feather(ctx, W, H);
      // our own layer of the same size for dusk
      let dusk: HTMLCanvasElement | null = null;
      if (m && W > 0 && H > 0) {
        const L = layer(W, H, 1);
        if (L) {
          L.ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
          paintLand(L.ctx, DUSK, box);
          feather(L.ctx, W, H);
          dusk = L.c;
        }
      }
      lands.unshift({ dusk, box, t: { a: m?.a ?? 1, e: m?.e ?? 0, f: m?.f ?? 0 } });
      if (lands.length > MAX_LANDS) lands.length = MAX_LANDS;
    },
    draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
      const v = visionOf(st);
      const R = st.reduced;
      const F: Frame = { st, v, t: st.time, R, tw: (ph, sp = 1) => (R ? 0.8 : 0.6 + 0.4 * Math.sin(st.time * 1.7 * sp + ph)) };
      const land = landFor(ctx);
      const box = land?.box ?? { x: X0, y: -210, w: X1 - X0, h: 370 };
      const d = duskAt(v);
      // everything stays inside the picture's box (the words beside or under it keep the dark ground)
      ctx.save();
      if (land) {
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.w, box.h);
        ctx.clip();
        // ── the evening over the golden hour ──
        if (land.dusk && d > 0.004) {
          const ga = ctx.globalAlpha;
          ctx.globalAlpha = ga * d;
          ctx.drawImage(land.dusk, box.x, box.y, box.w, box.h);
          ctx.globalAlpha = ga;
        }
      }
      drawSun(ctx, v);
      drawStars(ctx, F, box);
      const lit = drawTownLights(ctx, F);
      drawRising(ctx, F, lit, kind === 'face' ? 2.6 : kind === 'town' ? 1.5 : 1, kind === 'town' ? 64 : 28);
      // rest deepens the colour and the warmth of the evening
      if (st.deep > 0.02) glowEllipse(ctx, '#ffb27a', -40, HORIZON, 260, 40, 0, 0.14 * st.deep);
      const look = st.look || 'f1';
      const L = lookOf(look);
      const r = renewalAt(v);
      const g = geoOf(L.sex, r.postawa);
      const k = Math.max(0, Math.min(1, st.g));
      // ── the people, the threads, the person and the light ──
      // (the people stand back while the person is the picture; in the finale they are its other half)
      if (kind !== 'face') drawFriends(ctx, F, kind === 'town' ? 1 : 0.55);
      // a warm light around the person grows with the smile, and with calm
      const warm = 0.06 + 0.1 * r.usmiech + 0.08 * st.deep;
      if (kind === 'side') {
        const p = sidePose(L.sex, r.postawa);
        const H = sideHeart(p);
        drawThreads(ctx, F, H, 0.7);
        glowEllipse(ctx, '#ffcf9a', 0, -10, 30, 100, 0, warm);
        drawPerson(ctx, F, look, true);
        drawFlow(ctx, F, sideWays(p), 0.25 + 0.35 * v);
        drawSpine(ctx, p, k);
        drawHeart(ctx, F, H, 0);
      } else {
        const H = heartOf(g);
        if (kind !== 'face') drawThreads(ctx, F, H, kind === 'town' ? 0.6 + 0.6 * k : 0.7);
        glowEllipse(ctx, '#ffcf9a', -2, kind === 'face' ? -70 : -10, kind === 'face' ? 30 : 32, kind === 'face' ? 46 : 102, 0, warm);
        drawPerson(ctx, F, look, false, kind === 'face' ? FACE_FADE : undefined);
        if (kind === 'whole') drawFlow(ctx, F, bodyWays(g), 0.3 + 0.7 * k);
        else if (kind === 'town') drawFlow(ctx, F, bodyWays(g), 0.2 + 0.3 * v);
        if (kind === 'face') drawFresh(ctx, F, g, k);
        drawHeart(ctx, F, H, kind === 'town' ? 0.3 + 0.7 * k : 0.25 * personLit(v, 0), kind === 'face' ? 0.6 : 1);
        // a grown picture lives on gently: a few sparkles of light around the person
        if (st.g > 0.98 && !R && kind !== 'face') {
          for (let i = 0; i < 4; i++) {
            const q = (st.time * 0.25 + i / 4) % 1;
            const ang = hash(i * 7.7 + Math.floor(st.time * 0.25 + i / 4)) * TAU;
            glow(ctx, GOLD_HI, Math.cos(ang) * 22 * (0.5 + q), -10 + Math.sin(ang) * 70 * (0.4 + 0.6 * q), 1.6, 0.4 * Math.sin(Math.PI * q));
          }
        }
      }
      ctx.restore();
    },
    focusAt(_scene: string, gr: number): Pt {
      const k = Math.max(0, Math.min(1, gr));
      switch (kind) {
        case 'whole':
          // the light travels from the heart through the body and back (never on the head)
          return polyAt([HEART, [0, -26], [-6, 18], [-5.4, 60], [5.4, 60], [6, 18], [14, -32], HEART], k);
        case 'face':
          // up the cheek to the brow, then to the hair at the side (as Nowe siły's face)
          return polyAt([headPt(MID, -4.6, MID.cy + 6), headPt(MID, -4.6, MID.cy - 6), HAIR_SIDE], k);
        case 'side':
          return polyAt(sideSpine(sidePose('f', 0.5)), k);
        case 'town':
        default:
          return polyAt([HEART, friendHeart(FRIENDS[0]), ENTRIES[0], ENTRIES[1]], k);
      }
    },
  };
}

export const NARAZ_WORLDS: Readonly<Record<string, WorldPainter>> = {
  'naraz.whole': makeWorld('whole'),
  'naraz.face': makeWorld('face'),
  'naraz.side': makeWorld('side'),
  'naraz.town': makeWorld('town'),
};
