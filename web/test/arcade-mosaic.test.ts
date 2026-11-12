/**
 * Mosaics for the visualisation games (src/arcade/kit/mosaic.ts): Voronoi tiles that cover the frame
 * exactly, neighbours both ways, the tile under a finger, shards and cracks inside their tile, and the
 * picture analysis (colours, edges, the pencil sketch, the dark veil).
 */
import { describe, expect, it } from 'vitest';
import {
  buildMosaic, cellAt, cellColors, cracks, detailWeight, edgeMap, fitCover, inPoly, insetPoly, makeMosaic, mosaicSeeds, shards,
  sketch, veil, type Pixels, type Pt,
} from '../src/arcade/kit/mosaic';

function rng(seed = 7): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const area = (poly: readonly Pt[]) => {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  return Math.abs(a / 2);
};

/** A w × h picture from a colour function. */
function picture(w: number, h: number, f: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = f(x, y), o = (y * w + x) * 4;
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('kit/mosaic: tiles', () => {
  it('covers the frame exactly with one convex tile per seed, each around its site', () => {
    const seeds = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 50, y: 70 }, { x: 15, y: 90 }, { x: 85, y: 85 }];
    const m = buildMosaic(100, 120, seeds);
    expect(m.cells).toHaveLength(5);
    expect(m.cells.reduce((s, c) => s + c.area, 0)).toBeCloseTo(100 * 120, 6);
    for (const c of m.cells) {
      expect(c.poly.length).toBeGreaterThanOrEqual(3);
      expect(inPoly(c.poly, c.sx, c.sy)).toBe(true);
      expect(area(c.poly)).toBeCloseTo(c.area, 6);
    }
  });

  it('knows its neighbours both ways and its shared edges', () => {
    const m = makeMosaic(300, 400, 30, rng(3));
    for (const c of m.cells) for (const n of c.neighbors) expect(m.cells[n].neighbors).toContain(c.id);
    const inner = m.edges.filter(e => e.b >= 0);
    for (const e of inner) {
      expect(m.cells[e.a].neighbors).toContain(e.b);
      // the shared edge lies on both tiles' borders
      const mid = { x: (e.p.x + e.q.x) / 2, y: (e.p.y + e.q.y) / 2 };
      expect(inPoly(m.cells[e.a].poly, mid.x, mid.y)).toBe(true);
      expect(inPoly(m.cells[e.b].poly, mid.x, mid.y)).toBe(true);
    }
    for (const e of m.edges.filter(x => x.b < 0)) {
      const onFrame = (p: Pt) => Math.min(p.x, p.y, 300 - p.x, 400 - p.y) < 1e-6;
      expect(onFrame(e.p) && onFrame(e.q)).toBe(true);
    }
    expect(m.cells.reduce((s, c) => s + c.area, 0)).toBeCloseTo(300 * 400, 4);
  });

  it('finds the tile under a finger as the nearest site, and that tile holds the point', () => {
    const m = makeMosaic(360, 366, 24, rng(11));
    const r = rng(5);
    for (let k = 0; k < 200; k++) {
      const x = r() * 360, y = r() * 366;
      const id = cellAt(m, x, y);
      expect(inPoly(m.cells[id].poly, x, y)).toBe(true);
    }
  });

  it('spreads seeds evenly and packs them where the weight is high', () => {
    const even = mosaicSeeds(400, 400, 40, rng(2));
    let minD = Infinity;
    for (let i = 0; i < even.length; i++) for (let j = i + 1; j < even.length; j++) minD = Math.min(minD, Math.hypot(even[i].x - even[j].x, even[i].y - even[j].y));
    expect(minD).toBeGreaterThan(18);   // no clumps: a random scatter of 40 would have pairs a few px apart
    const left = mosaicSeeds(400, 400, 60, rng(2), { weight: x => (x < 200 ? 1 : 0.05), relax: 1 });
    expect(left.filter(p => p.x < 200).length).toBeGreaterThan(left.filter(p => p.x >= 200).length);
  });

  it('rings the tiles from the middle outward', () => {
    const m = makeMosaic(200, 200, 25, rng(9));
    const mid = m.cells[cellAt(m, 100, 100)];
    const corner = m.cells[cellAt(m, 2, 2)];
    expect(mid.ring).toBeLessThan(corner.ring);
    for (const c of m.cells) expect(c.ring).toBeGreaterThanOrEqual(0);
  });
});

describe('kit/mosaic: shards, cracks, inset', () => {
  const m = makeMosaic(300, 300, 12, rng(4));
  const cell = m.cells.reduce((a, b) => (a.area > b.area ? a : b));

  it('breaks a tile into shards that fill it', () => {
    for (const k of [2, 5, 9]) {
      const pieces = shards(cell, k, rng(k));
      expect(pieces.length).toBe(k);
      const sum = pieces.reduce((s, p) => s + area(p), 0);
      expect(sum).toBeCloseTo(cell.area, 3);
      for (const p of pieces) expect(p.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('runs cracks from a point to the border, inside the tile', () => {
    const lines = cracks(cell, { x: cell.cx, y: cell.cy }, 4, rng(1));
    expect(lines.length).toBe(4);
    for (const line of lines) {
      expect(line[0]).toEqual({ x: cell.cx, y: cell.cy });
      for (const p of line) expect(inPoly(cell.poly, p.x, p.y)).toBe(true);
      const end = line.at(-1)!;
      // the last point sits on the border: a step outward leaves the tile
      const dx = end.x - line.at(-2)!.x, dy = end.y - line.at(-2)!.y, len = Math.hypot(dx, dy) || 1;
      expect(inPoly(cell.poly, end.x + (dx / len) * 0.5, end.y + (dy / len) * 0.5)).toBe(false);
    }
  });

  it('insets a tile inside itself, and shrinks a tiny one instead of turning it inside out', () => {
    const inner = insetPoly(cell.poly, 3);
    expect(area(inner)).toBeLessThan(cell.area);
    for (const p of inner) expect(inPoly(cell.poly, p.x, p.y)).toBe(true);
    const tiny = insetPoly([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }], 10);
    expect(area(tiny)).toBeLessThan(1e-9 + 6);
    for (const p of tiny) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });
});

describe('kit/mosaic: pictures', () => {
  it('fits a picture over a frame like object-fit: cover', () => {
    expect(fitCover(200, 100, 100, 100)).toEqual({ sx: 50, sy: 0, sw: 100, sh: 100 });
    const f = fitCover(100, 200, 300, 300);
    expect(f.sw).toBeCloseTo(100);
    expect(f.sh).toBeCloseTo(100);
    expect(f.sy).toBeCloseTo(50);
  });

  it('gives each tile its picture’s colour', () => {
    const img = picture(80, 80, x => (x < 40 ? [220, 30, 30] : [30, 40, 220]));
    const m = makeMosaic(80, 80, 16, rng(6));
    const cols = cellColors(m, img);
    for (const c of m.cells) {
      if (c.poly.every(p => p.x <= 39)) expect(cols[c.id].r).toBeGreaterThan(200);
      if (c.poly.every(p => p.x >= 41)) expect(cols[c.id].b).toBeGreaterThan(200);
      expect(cols[c.id].lum).toBeGreaterThanOrEqual(0);
      expect(cols[c.id].lum).toBeLessThanOrEqual(1);
    }
  });

  it('finds the edges of a picture and packs tiles along them', () => {
    const img = picture(60, 60, x => (x < 30 ? [20, 20, 20] : [240, 240, 240]));
    const e = edgeMap(img);
    expect(e[30 * 60 + 30]).toBeGreaterThan(0.9);
    expect(e[30 * 60 + 5]).toBeLessThan(0.05);
    const wgt = detailWeight(e, 60, 60, 60, 60);
    expect(wgt(30, 30)).toBeGreaterThan(wgt(4, 30));
    expect(wgt(4, 30)).toBeGreaterThanOrEqual(0.25);
  });

  it('draws a pencil sketch: paper where it is flat, graphite along the edges', () => {
    const img = picture(64, 48, x => (x < 32 ? [200, 120, 60] : [60, 120, 200]));
    const s = sketch(img);
    expect(s.width).toBe(64);
    expect(s.data.length).toBe(64 * 48 * 4);
    const lum = (i: number) => s.data[i * 4] + s.data[i * 4 + 1] + s.data[i * 4 + 2];
    expect(lum(24 * 64 + 4)).toBeGreaterThan(lum(24 * 64 + 32));   // flat paper is lighter than the edge
    expect(s.data[3]).toBe(255);
  });

  it('veils a picture darker and greyer', () => {
    const img = picture(32, 32, () => [240, 180, 40]);
    const v = veil(img);
    const r = v.data[16 * 32 * 4 + 64], g = v.data[16 * 32 * 4 + 65], b = v.data[16 * 32 * 4 + 66];
    expect(r + g + b).toBeLessThan(240 + 180 + 40);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(240 - 40);
  });
});
