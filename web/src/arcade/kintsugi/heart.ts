/**
 * The heart's geometry (DESIGN.md §21), pure — no DOM, numbers only, in the heart's own units: x from −1 to 1, y down,
 * the shape centred on its box (`HEART.top` … `HEART.bottom`).
 *
 *   the shape    a full, noble heart: the classic curve x = 16 sin³t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t
 *   the pieces   Voronoi tiles (kit/mosaic.ts) of seeds inside the heart, clipped to it when drawn; two seeds stand
 *                fixed either side of the midline, so the first crack runs from the top notch down — the broken heart
 *                everyone knows; the others are spread evenly and relaxed (Lloyd) over the heart's own area
 *   the cracks   each shared edge jittered like a ceramic fracture (midpoint displacement, angular kinks), the same
 *                polyline for both pieces it divides (seeded by the edge's own ends), so the pieces fit exactly
 *   the seams    the cracks inside the heart, a graph: the gold flows from the top notch outward, each seam filling
 *                from its end nearer the notch once the gold front (a distance along the network) reaches it
 *   the cloth    where each piece lies broken on the cloth under the heart: left to right as they belong, turned
 */
import { buildMosaic, type Mosaic, type Pt } from '../kit/mosaic';

export type { Pt };

const TAU = Math.PI * 2;

/** The heart's outline, centred, x in −1..1 (y down). */
function heartOutline(n = 240): { pts: Pt[]; top: number; bottom: number; notch: Pt } {
  const raw: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const s = Math.sin(t);
    raw.push({ x: 16 * s * s * s, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });
  }
  let minY = Infinity, maxY = -Infinity, maxX = 0;
  for (const p of raw) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    maxX = Math.max(maxX, Math.abs(p.x));
  }
  const k = 1 / maxX, mid = (minY + maxY) / 2;
  const pts = raw.map(p => ({ x: p.x * k, y: (p.y - mid) * k }));
  return { pts, top: (minY - mid) * k, bottom: (maxY - mid) * k, notch: { x: 0, y: pts[0].y } };
}

export const HEART = heartOutline();

/** Inside a simple polygon (ray casting; either orientation). */
export function inside(poly: readonly Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

export const inHeart = (x: number, y: number): boolean => inside(HEART.pts, x, y);

/** A small, fast seeded generator (mulberry32) for the jitter of one edge. */
function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (p: Pt): string => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)}`;
function hashStr(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A crack between p and q like a ceramic fracture: midpoint displacement in three levels (8 straight runs with small
 * angular kinks), its ends fixed.  The same edge gives the same polyline from either side (seeded by its sorted ends,
 * reversed for the other order).
 */
export function crack(p: Pt, q: Pt, salt: number): Pt[] {
  const kp = key(p), kq = key(q);
  const flip = kp > kq;
  const [a, b] = flip ? [q, p] : [p, q];
  const r = rand(hashStr(flip ? `${kq}|${kp}` : `${kp}|${kq}`, salt));
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  let pts: Pt[] = [a, b];
  let amp = Math.min(0.035, 0.06 * L);
  for (let level = 0; level < 3; level++) {
    const next: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const u = pts[i], v = pts[i + 1];
      const dx = v.x - u.x, dy = v.y - u.y, l = Math.hypot(dx, dy) || 1;
      // a midpoint a little off the middle, pushed sideways: an angular kink
      const s = 0.5 + (r() - 0.5) * 0.3, d = (r() * 2 - 1) * amp;
      next.push({ x: u.x + dx * s + (-dy / l) * d, y: u.y + dy * s + (dx / l) * d }, v);
    }
    pts = next;
    amp *= 0.5;
  }
  return flip ? pts.reverse() : pts;
}

export interface Piece {
  id: number;
  /** the tile's outline with its cracks (heart units); the piece is this ∩ the heart */
  outline: Pt[];
  /** the piece's middle (of its part inside the heart), its reach from there, its area */
  cx: number;
  cy: number;
  r: number;
  area: number;
}

export interface Seam {
  id: number;
  /** the polyline inside the heart, from where its gold begins */
  pts: Pt[];
  /** cumulative lengths along it, and its length */
  cum: number[];
  len: number;
  /** the gold front's distance from the notch when this seam starts to fill */
  start: number;
  /** the two pieces it divides */
  a: number;
  b: number;
}

export interface HeartGeo {
  pieces: Piece[];
  seams: Seam[];
  /** the gold front's distance when every seam is full */
  reach: number;
  /** the order the pieces are gathered in: from the tip up to the lobes (the last pieces close the notch) */
  order: number[];
}

/** Points of the heart on a grid (heart units): Lloyd's centroids and the pieces' middles. */
const GRID: Pt[] = (() => {
  const out: Pt[] = [];
  const step = 0.028;
  for (let y = HEART.top; y <= HEART.bottom; y += step) for (let x = -1; x <= 1; x += step) if (inHeart(x, y)) out.push({ x, y });
  return out;
})();

function nearest(seeds: readonly Pt[], x: number, y: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < seeds.length; i++) {
    const d = (seeds[i].x - x) ** 2 + (seeds[i].y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** The two fixed seeds either side of the midline (the crack from the notch). */
const FIXED: readonly Pt[] = [{ x: -0.36, y: HEART.notch.y + 0.34 }, { x: 0.36, y: HEART.notch.y + 0.34 }];
/** No other seed comes this near the top of the midline, so the crack always runs down from the notch. */
const KEEP = { x: 0, y: HEART.notch.y + 0.1, r: 0.56 };
function keepOff(p: Pt): Pt {
  const dx = p.x - KEEP.x, dy = p.y - KEEP.y, d = Math.hypot(dx, dy);
  if (d >= KEEP.r) return p;
  if (d < 1e-6) return { x: KEEP.x, y: KEEP.y + KEEP.r };
  return { x: KEEP.x + (dx / d) * KEEP.r, y: KEEP.y + (dy / d) * KEEP.r };
}

/** `n` seeds inside the heart: the two fixed ones, the rest by best-candidate sampling, relaxed over the heart's area. */
export function heartSeeds(n: number, rng: () => number): Pt[] {
  const count = Math.max(2, Math.round(n));
  const seeds: Pt[] = FIXED.map(p => ({ ...p }));
  // a third seed low on the midline makes the classic broken heart of three
  while (seeds.length < count) {
    let best: Pt | null = null, bestD = -1;
    for (let t = 0; t < 24; t++) {
      const p = GRID[Math.floor(rng() * GRID.length)];
      const q = keepOff({ x: p.x + (rng() - 0.5) * 0.02, y: p.y + (rng() - 0.5) * 0.02 });
      let d = Infinity;
      for (const s of seeds) d = Math.min(d, Math.hypot(s.x - q.x, s.y - q.y));
      if (d > bestD) { bestD = d; best = q; }
    }
    seeds.push(best!);
  }
  for (let r = 0; r < 4; r++) {
    const sx = new Array<number>(count).fill(0), sy = new Array<number>(count).fill(0), k = new Array<number>(count).fill(0);
    for (const g of GRID) {
      const i = nearest(seeds, g.x, g.y);
      sx[i] += g.x;
      sy[i] += g.y;
      k[i]++;
    }
    for (let i = FIXED.length; i < count; i++) {
      if (!k[i]) continue;
      seeds[i] = keepOff({ x: seeds[i].x + (sx[i] / k[i] - seeds[i].x) * 0.8, y: seeds[i].y + (sy[i] / k[i] - seeds[i].y) * 0.8 });
    }
  }
  return seeds;
}

/** The frame the Voronoi is built in (heart units → the mosaic's 0..w × 0..h). */
const FRAME = { x0: -1.2, y0: HEART.top - 0.2, w: 2.4, h: HEART.bottom - HEART.top + 0.4 };
const toFrame = (p: Pt): Pt => ({ x: p.x - FRAME.x0, y: p.y - FRAME.y0 });
const fromFrame = (p: Pt): Pt => ({ x: p.x + FRAME.x0, y: p.y + FRAME.y0 });

/** A polyline split into steps of at most `step`. */
function densify(pts: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let j = 1; j <= k; j++) out.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k });
  }
  return out;
}

/** The runs of a polyline that lie inside the heart (each at least `min` long). */
function insideRuns(pts: readonly Pt[], min: number): Pt[][] {
  const d = densify(pts, 0.008);
  const runs: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of d) {
    if (inHeart(p.x, p.y)) cur.push(p);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs.filter(r => lengthOf(r) >= min);
}

function lengthOf(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

function cumOf(pts: readonly Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return c;
}

/** The point at distance `s` along a polyline with cumulative lengths `cum`. */
export function along(pts: readonly Pt[], cum: readonly number[], s: number): Pt {
  if (s <= 0) return pts[0];
  const L = cum[cum.length - 1];
  if (s >= L) return pts[pts.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= s) lo = m; else hi = m;
  }
  const k = (s - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
  return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * k, y: pts[lo].y + (pts[hi].y - pts[lo].y) * k };
}

/** The seams as a graph: each seam's start along the network from the notch (Dijkstra), oriented from that end. */
function flow(all: { pts: Pt[]; a: number; b: number }[]): { seams: Seam[]; reach: number } {
  const runs = all.map(r => r.pts);
  const nodes: Pt[] = [];
  const nodeOf = (p: Pt): number => {
    for (let i = 0; i < nodes.length; i++) if (Math.hypot(nodes[i].x - p.x, nodes[i].y - p.y) < 0.012) return i;
    nodes.push(p);
    return nodes.length - 1;
  };
  const ends = runs.map(r => [nodeOf(r[0]), nodeOf(r[r.length - 1])] as const);
  const lens = runs.map(lengthOf);
  // the source: the node nearest the notch
  let src = 0, bd = Infinity;
  nodes.forEach((p, i) => {
    const d = Math.hypot(p.x - HEART.notch.x, p.y - HEART.notch.y);
    if (d < bd) { bd = d; src = i; }
  });
  const dist = nodes.map(() => Infinity);
  dist[src] = 0;
  const done = nodes.map(() => false);
  for (let it = 0; it < nodes.length; it++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    ends.forEach(([a, b], k) => {
      if (a === u && dist[u] + lens[k] < dist[b]) dist[b] = dist[u] + lens[k];
      if (b === u && dist[u] + lens[k] < dist[a]) dist[a] = dist[u] + lens[k];
    });
  }
  // a seam the network does not reach from the notch begins as far as it lies from it, straight
  for (let i = 0; i < nodes.length; i++) if (dist[i] === Infinity) dist[i] = Math.hypot(nodes[i].x - HEART.notch.x, nodes[i].y - HEART.notch.y) * 1.4;
  const seams: Seam[] = runs.map((r, k) => {
    const [a, b] = ends[k];
    const pts = dist[a] <= dist[b] ? r : [...r].reverse();
    const cum = cumOf(pts);
    return { id: k, pts, cum, len: cum[cum.length - 1], start: Math.min(dist[a], dist[b]), a: all[k].a, b: all[k].b };
  });
  seams.sort((p, q) => p.start - q.start);
  seams.forEach((s, i) => { s.id = i; });
  const reach = seams.reduce((m, s) => Math.max(m, s.start + s.len), 0);
  return { seams, reach };
}

/** A piece's spot on the cloth: its middle (heart units from the heart's middle) and its turn (rad). */
export interface Spot { x: number; y: number; rot: number }

/**
 * Where the pieces lie broken on the cloth under the heart: in the order of their place in the heart from left to
 * right (so the eye can tell where each belongs), spread across the cloth, a little up and down, turned, kept apart.
 * Lying flat they are drawn at `lie` of their size.  Deterministic for the same seed.
 */
export function clothSpots(pieces: readonly Piece[], cloth: { x0: number; x1: number; y0: number; y1: number }, seed: number, lie = 0.82): Spot[] {
  const r = rand(seed >>> 0);
  const order = pieces.map(p => p.id).sort((a, b) => pieces[a].cx - pieces[b].cx);
  const n = order.length;
  const out: Spot[] = pieces.map(() => ({ x: 0, y: 0, rot: 0 }));
  const W = cloth.x1 - cloth.x0, Hh = cloth.y1 - cloth.y0;
  order.forEach((id, i) => {
    const step = W / n;
    const x = cloth.x0 + step * (i + 0.5) + (r() - 0.5) * step * 0.35;
    const y = cloth.y0 + Hh * (i % 2 ? 0.62 : 0.38) + (r() - 0.5) * Hh * 0.22;
    out[id] = { x, y, rot: (r() - 0.5) * 1.6 };
  });
  for (let it = 0; it < 50; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = out[i], b = out[j];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1e-3;
      const want = (pieces[i].r + pieces[j].r) * lie * 0.82;
      if (l < want) {
        const push = (want - l) * 0.5;
        a.x -= (dx / l) * push; a.y -= (dy / l) * push * 0.4;
        b.x += (dx / l) * push; b.y += (dy / l) * push * 0.4;
      }
    }
    for (let i = 0; i < n; i++) {
      // a piece lying is foreshortened (0.8 high): it may reach a little over the cloth's far edge, not its near one
      const m = pieces[i].r * lie * 0.92, my = pieces[i].r * lie * 0.8;
      out[i].x = Math.max(cloth.x0 + m, Math.min(cloth.x1 - m, out[i].x));
      out[i].y = Math.max(cloth.y0 + my * 0.45, Math.min(cloth.y1 - my, out[i].y));
    }
  }
  return out;
}

/** The broken heart of `n` pieces for a session (deterministic for the same rng). */
export function buildHeart(n: number, rng: () => number): HeartGeo {
  const seeds = heartSeeds(n, rng);
  const salt = Math.floor(rng() * 1e9);
  const m: Mosaic = buildMosaic(FRAME.w, FRAME.h, seeds.map(toFrame));
  // each piece's middle and reach from the grid (its part inside the heart)
  const acc = seeds.map(() => ({ x: 0, y: 0, k: 0 }));
  const owner = GRID.map(g => nearest(seeds, g.x, g.y));
  GRID.forEach((g, gi) => {
    const i = owner[gi];
    acc[i].x += g.x;
    acc[i].y += g.y;
    acc[i].k++;
  });
  const pieces: Piece[] = m.cells.map((cell, i) => {
    const poly = cell.poly.map(fromFrame);
    const outline: Pt[] = [];
    for (let k = 0; k < poly.length; k++) {
      const P = poly[k], Q = poly[(k + 1) % poly.length];
      const run = crack(P, Q, salt);
      for (let j = 0; j < run.length - 1; j++) outline.push(run[j]);
    }
    const a = acc[i];
    const cx = a.k ? a.x / a.k : seeds[i].x, cy = a.k ? a.y / a.k : seeds[i].y;
    let r = 0.05;
    GRID.forEach((g, gi) => { if (owner[gi] === i) r = Math.max(r, Math.hypot(g.x - cx, g.y - cy)); });
    return { id: i, outline, cx, cy, r, area: a.k * 0.028 * 0.028 };
  });
  const runs: { pts: Pt[]; a: number; b: number }[] = [];
  for (const e of m.edges) {
    if (e.b < 0) continue;
    for (const pts of insideRuns(crack(fromFrame(e.p), fromFrame(e.q), salt), 0.03)) runs.push({ pts, a: e.a, b: e.b });
  }
  const { seams, reach } = flow(runs);
  // from the tip up: the pieces lowest in the heart first, the lobes at the notch last
  const order = pieces.map(p => p.id).sort((a, b) => pieces[b].cy - pieces[a].cy || pieces[a].cx - pieces[b].cx);
  return { pieces, seams, reach, order };
}

/** How full each seam is for a gold front at distance `front` (0..1 each). */
export const seamFill = (s: Seam, front: number): number => Math.max(0, Math.min(1, (front - s.start) / Math.max(1e-6, s.len)));
