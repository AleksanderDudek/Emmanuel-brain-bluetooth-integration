/**
 * The living picture (src/arcade/kit/living.ts, round 12): the depth guessed from a photo, its sky, water and
 * glints, the motions offered for it, the fill-in behind a plane, the camera that never shows an edge, and the
 * look that follows a mouse and drifts back to its orbit.
 */
import { describe, expect, it } from 'vitest';
import {
  analyseLiving, cleanMotion, isMoving, LookInput, MOTION_KINDS, MOTION_NONE, motionFor, orbit, PARALLAX_AMP, PLANE_SHIFT, pose, pushPull,
  quantile, sampleGrid, type Motion,
} from '../src/arcade/kit/living';
import type { Pixels } from '../src/arcade/kit/mosaic';

/** A w × h picture painted by f(x, y) → [r, g, b]. */
function paint(w: number, h: number, f: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y), i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

/** A cheap repeatable texture (grass, rocks, leaves): ±amp around a colour. */
const tex = (x: number, y: number, amp: number): number => amp * (((x * 7919 + y * 104729) % 97) / 48 - 1);

// a meadow under a wide blue sky
const meadow = paint(240, 280, (x, y) => (y < 112 ? [120, 170, 235] : [70 + tex(x, y, 40), 130 + tex(x, y, 50), 60 + tex(x, y, 30)]));
// a lake: sky, a dark wooded shore, then calm blue water to the bottom
const lake = paint(240, 280, (x, y) => (y < 84 ? [200, 215, 235] : y < 126 ? [40 + tex(x, y, 30), 70 + tex(x, y, 40), 40 + tex(x, y, 25)] : [60 + tex(x, y, 4), 110 + tex(x, y, 5), 150 + tex(x, y, 5)]));
// a portrait: a plain warm-grey wall and a detailed figure in the middle
const portrait = paint(240, 300, (x, y) => {
  const inFig = Math.hypot((x - 120) / 60, (y - 170) / 110) < 1;
  return inFig ? [150 + tex(x, y, 60), 110 + tex(x, y, 50), 90 + tex(x, y, 40)] : [120, 112, 104];
});
// a dark room with bright small lamps
const lamps = paint(240, 240, (x, y) => {
  const lamp = [[60, 60], [180, 70], [120, 150], [50, 190], [190, 200]].some(([lx, ly]) => Math.hypot(x - lx, y - ly) < 9);
  return lamp ? [255, 248, 225] : [40 + tex(x, y, 12), 34 + tex(x, y, 10), 30 + tex(x, y, 8)];
});

const rowMean = (a: ReturnType<typeof analyseLiving>, v0: number, v1: number): number => {
  let s = 0, n = 0;
  for (let v = v0; v <= v1; v += 0.05) for (let u = 0.05; u < 1; u += 0.1) { s += sampleGrid(a.depth, u, v); n++; }
  return s / n;
};

describe('the living picture: what a photo offers', () => {
  it('finds a wide sky far away and the meadow near, and offers mist first', () => {
    const a = analyseLiving(meadow);
    expect(a.sky).toBeGreaterThan(0.3);
    expect(a.sky).toBeLessThan(0.5);
    expect(rowMean(a, 0.05, 0.3)).toBeLessThan(rowMean(a, 0.7, 0.95) - 0.3);
    expect(a.water).toBeNull();
    expect(a.recommended).toBe('mist');
    expect(a.options).toContain('breath');
    expect(a.options[a.options.length - 1]).toBe('still');
    expect(a.options).not.toContain('water');
  });

  it('finds the water below the shore and recommends ripples', () => {
    const a = analyseLiving(lake);
    expect(a.water).not.toBeNull();
    expect(a.water!.horizon).toBeGreaterThan(0.38);
    expect(a.water!.horizon).toBeLessThan(0.55);
    expect(a.recommended).toBe('water');
  });

  it('does not take a blue shirt or a blue car for water', () => {
    const shirt = paint(240, 300, (x, y) => (Math.hypot((x - 120) / 70, (y - 300) / 110) < 1 ? [47 + tex(x, y, 8), 59 + tex(x, y, 8), 107 + tex(x, y, 8)] : [122, 138, 106]));
    expect(analyseLiving(shirt).water).toBeNull();
    const car = paint(300, 220, (x, y) => (y > 120 && y < 190 && x > 60 && x < 240 ? [40, 80, 170] : y > 150 ? [90 + tex(x, y, 20), 90, 90] : [200, 205, 210]));
    expect(analyseLiving(car).water).toBeNull();
    expect(analyseLiving(car).options).not.toContain('water');
  });

  it('puts a portrait\'s figure in front of its wall', () => {
    const a = analyseLiving(portrait);
    expect(a.sky).toBeLessThan(0.05);
    expect(a.water).toBeNull();
    const fig = sampleGrid(a.depth, 0.5, 0.57), wall = (sampleGrid(a.depth, 0.08, 0.1) + sampleGrid(a.depth, 0.92, 0.1)) / 2;
    expect(fig).toBeGreaterThan(wall + 0.4);
    // the figure stands on the nearest plane, the wall's top corners on the farthest
    expect(fig).toBeGreaterThanOrEqual(a.cuts[2] - 0.05);
    expect(wall).toBeLessThan(a.cuts[0]);
    expect(a.recommended).toBe('breath');
  });

  it('lets a dark room\'s lamps glint, and recommends the light', () => {
    const a = analyseLiving(lamps);
    expect(a.glints.length).toBeGreaterThanOrEqual(4);
    for (const g of a.glints) expect([[60, 60], [180, 70], [120, 150], [50, 190], [190, 200]].some(([x, y]) => Math.hypot(g.x * 240 - x, g.y * 240 - y) < 16)).toBe(true);
    expect(a.light).toBeGreaterThan(0);
    expect(a.options.indexOf('light')).toBeLessThan(a.options.indexOf('mist'));
  });

  it('keeps the depth in 0..1, its cuts in order, and works on tiny and very tall pictures', () => {
    for (const px of [meadow, lake, portrait, lamps, paint(3, 3, () => [10, 10, 10]), paint(90, 160, (x, y) => [x, y, 128])]) {
      const a = analyseLiving(px);
      for (const v of a.depth.v) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      expect(a.cuts[0]).toBeLessThanOrEqual(a.cuts[1]);
      expect(a.cuts[1]).toBeLessThanOrEqual(a.cuts[2]);
      expect(a.depth.w * a.depth.h).toBe(a.depth.v.length);
      expect(MOTION_KINDS).toContain(a.recommended);
      expect(a.recommended).not.toBe('still');
      expect(a.aspect).toBeCloseTo(px.width / px.height, 5);
    }
  });

  it('takes the caller\'s heart as the subject', () => {
    const left = analyseLiving(portrait, undefined, { x: 40, y: 150 });
    const right = analyseLiving(portrait, undefined, { x: 200, y: 150 });
    expect(sampleGrid(left.depth, 0.12, 0.5) - sampleGrid(right.depth, 0.12, 0.5)).toBeGreaterThan(0.05);
  });
});

describe('the living picture: filling in behind a plane', () => {
  it('fills the unknown half from the known colours and keeps the known pixels', () => {
    const px = paint(40, 20, x => (x < 20 ? [200, 40, 40] : [0, 0, 255]));
    const known = new Float32Array(40 * 20).map((_, i) => ((i % 40) < 20 ? 1 : 0));
    const out = pushPull(px, known);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 40; x++) {
        const i = (y * 40 + x) * 4;
        expect(out.data[i + 3]).toBe(255);
        // the blue right half was unknown: it takes the red from the left
        expect(out.data[i]).toBeGreaterThan(190);
        expect(out.data[i + 2]).toBeLessThan(50);
      }
    }
  });

  it('blends a partly known pixel, and copes with nothing known', () => {
    const px = paint(8, 8, () => [100, 100, 100]);
    const known = new Float32Array(64).fill(1);
    known[9] = 0.5;
    expect(pushPull(px, known).data[9 * 4]).toBe(100);
    const none = pushPull(px, new Float32Array(64));
    expect(none.data.every(v => Number.isFinite(v))).toBe(true);
  });
});

describe('the living picture: motion', () => {
  it('reads a saved motion or none', () => {
    expect(cleanMotion({ kind: 'water', parallax: true })).toEqual({ kind: 'water', parallax: true });
    expect(cleanMotion({ kind: 'mist' })).toEqual({ kind: 'mist', parallax: false });
    expect(cleanMotion({ kind: 'fire', parallax: true })).toBeNull();
    expect(cleanMotion(null)).toBeNull();
    expect(cleanMotion('light')).toBeNull();
    expect(isMoving(MOTION_NONE)).toBe(false);
    expect(isMoving({ kind: 'still', parallax: true })).toBe(true);
    expect(isMoving({ kind: 'breath', parallax: false })).toBe(true);
    expect(isMoving(null)).toBe(false);
  });

  it('plays the saved motion, else the recommended one with depth, and nothing when the device asks for less motion', () => {
    const saved: Motion = { kind: 'light', parallax: false };
    expect(motionFor(saved, { recommended: 'water' }, false)).toEqual(saved);
    expect(motionFor(null, { recommended: 'water' }, false)).toEqual({ kind: 'water', parallax: true });
    expect(motionFor(undefined, null, false)).toEqual(MOTION_NONE);
    expect(motionFor(saved, { recommended: 'water' }, true)).toEqual(MOTION_NONE);
  });

  it('never shows the picture\'s edge: the zoom covers the farthest plane\'s shift and the drift, for any photo shape', () => {
    for (const kind of MOTION_KINDS) {
      for (const parallax of [false, true]) {
        for (const s of [0.3, 0.6, 1]) {
          for (const aspect of [9 / 16, 3 / 4, 1, 16 / 9]) {
            const W = aspect >= 1 ? 1 : aspect, H = aspect >= 1 ? 1 / aspect : 1;
            for (let t = 0; t < 60; t += 0.7) {
              const P = pose({ kind, parallax }, t, 0.5, s);
              const look = orbit(t);
              // the farthest plane is opaque everywhere: its shift + the drift stay inside the overscan
              const amp = parallax ? PARALLAX_AMP * Math.max(W, H) * s : 0;
              const sx = Math.abs(look.x * amp * PLANE_SHIFT[0]) + Math.abs(P.dx * W);
              const sy = Math.abs(look.y * amp * PLANE_SHIFT[0] * 0.6) + Math.abs(P.dy * H);
              expect(sx).toBeLessThanOrEqual(((P.zoom - 1) * W) / 2 + 1e-9);
              expect(sy).toBeLessThanOrEqual(((P.zoom - 1) * H) / 2 + 1e-9);
              expect(P.zoom).toBeLessThan(1.08);
            }
          }
        }
      }
    }
  });

  it('breathes: the breath motion swells with the lungs, the others do not', () => {
    const empty = pose({ kind: 'breath', parallax: false }, 3, 0, 1).zoom, full = pose({ kind: 'breath', parallax: false }, 3, 1, 1).zoom;
    expect(full - empty).toBeGreaterThan(0.02);
    expect(pose({ kind: 'light', parallax: false }, 3, 1, 1).zoom).toBe(pose({ kind: 'light', parallax: false }, 3, 0, 1).zoom);
    expect(pose(MOTION_NONE, 3, 1, 1)).toEqual({ zoom: 1, dx: 0, dy: 0 });
  });

  it('follows the mouse, then drifts back to its slow orbit', () => {
    const look = new LookInput();
    let t = 0;
    for (; t < 3; t += 0.05) look.get(t, 0.05);
    look.point(1, -1, t);
    let cur = look.get(t, 0);
    for (let i = 0; i < 40; i++) { t += 0.05; cur = look.get(t, 0.05); }
    expect(cur.x).toBeGreaterThan(0.95);
    expect(cur.y).toBeLessThan(-0.95);
    for (let i = 0; i < 200; i++) { t += 0.05; cur = look.get(t, 0.05); }
    // back on the orbit, a moment behind it (it eases with τ 1.2 s)
    const o = orbit(t - 1.2);
    expect(Math.abs(cur.x - o.x)).toBeLessThan(0.2);
    expect(Math.abs(cur.y - o.y)).toBeLessThan(0.2);
    for (let u = 0; u < 100; u += 0.37) { const p = orbit(u); expect(Math.abs(p.x)).toBeLessThanOrEqual(1); expect(Math.abs(p.y)).toBeLessThanOrEqual(0.55); }
  });

  it('takes a quantile', () => {
    expect(quantile([5, 1, 3, 2, 4], 0)).toBe(1);
    expect(quantile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(quantile([5, 1, 3, 2, 4], 1)).toBe(5);
    expect(quantile([], 0.5)).toBe(0);
  });
});
