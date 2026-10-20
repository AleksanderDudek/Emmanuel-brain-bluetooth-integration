#!/usr/bin/env node
/**
 * Builds the images of HolyHolyHoly 3D (project/assets/ui, particles, web) from code: the 9-patch
 * panels and buttons, HUD icons, touch controls and particle sprites. The floors are paintings
 * (tools/art.py).
 *
 * Shapes are drawn by supersampling an inside test (4×4 per pixel), so edges are smooth at any
 * size without a canvas library.
 *
 *   node game3d/tools/build-textures.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { ASSETS } from './paths.mjs';

const SS = 4;

function image(w, h, pixel) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = pixel(x, y);
      const i = (y * w + x) * 4;
      png.data[i] = Math.max(0, Math.min(255, Math.round(r)));
      png.data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      png.data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      png.data[i + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  return PNG.sync.write(png);
}

/**
 * Layers of shapes in a square icon: each layer is { inside(x, y) in -1..1 with y up, colour(x, y) }.
 * Coverage comes from 4×4 subsamples; layers are composited bottom to top.
 */
function icon(size, layers) {
  return image(size, size, (px, py) => {
    let out = [0, 0, 0, 0];
    for (const layer of layers) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
          const y = 1 - ((py + (sy + 0.5) / SS) / size) * 2;
          if (layer.inside(x, y)) hits++;
        }
      }
      if (!hits) continue;
      const x = ((px + 0.5) / size) * 2 - 1, y = 1 - ((py + 0.5) / size) * 2;
      const [r, g, b, a = 255] = layer.colour(x, y);
      const alpha = (a / 255) * (hits / (SS * SS));
      const outA = alpha + (out[3] / 255) * (1 - alpha);
      if (outA <= 0) continue;
      const mix = (c0, c1) => (c1 * alpha + c0 * (out[3] / 255) * (1 - alpha)) / outA;
      out = [mix(out[0], r), mix(out[1], g), mix(out[2], b), outA * 255];
    }
    return out;
  });
}

const solid = c => () => c;
const vertical = (top, bottom) => (_, y) => top.map((t, i) => t + (bottom[i] - t) * ((1 - y) / 2));
const radial = (inner, outer) => (x, y) => inner.map((c, i) => c + (outer[i] - c) * Math.min(1, Math.hypot(x, y)));

// ─── shapes (y up, -1..1) ──────────────────────────────────────────────────────────────────────

const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const ring = (r0, r1) => (x, y) => { const d = Math.hypot(x, y); return d >= r0 && d <= r1; };
const roundRect = (hw, hh, r) => (x, y) => {
  const qx = Math.abs(x) - hw + r, qy = Math.abs(y) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r <= 0;
};
const heart = s => (x, y) => {
  const u = x / s, v = (y + 0.1) / s;
  return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0;
};
const flame = s => (x, y) => {
  const u = x / s, v = y / s;
  if ((u * u) / 0.3 + (v + 0.35) ** 2 / 0.3 <= 1) return true;
  if (v < -0.35 || v > 0.95) return false;
  const t = (v + 0.35) / 1.3;
  const half = 0.548 * (1 - t) ** 0.85 * (1 + 0.25 * Math.sin(t * Math.PI));
  return Math.abs(u - 0.12 * t * t) <= half;
};
const diamond = (sx, sy) => (x, y) => Math.abs(x) / sx + Math.abs(y) / sy <= 1;
const star = (points, r0, r1, rot = 0) => (x, y) => {
  const a = Math.atan2(y, x) - rot;
  const d = Math.hypot(x, y);
  const k = (Math.PI * 2) / points;
  const t = Math.abs(((a % k) + k) % k - k / 2) / (k / 2); // 0 at a spike, 1 between spikes
  return d <= r1 + (r0 - r1) * t;
};
const not = f => (x, y) => !f(x, y);
const both = (f, g) => (x, y) => f(x, y) && g(x, y);
const either = (...fs) => (x, y) => fs.some(f => f(x, y));

// ─── UI ────────────────────────────────────────────────────────────────────────────────────────

const GOLD = [232, 193, 90];
const INK = [16, 14, 26];

/** Small gold diamonds in the four corners (they sit in the 9-patch corners, so they never stretch). */
const corners = (at, r) => (x, y) => Math.abs(Math.abs(x) - at) + Math.abs(Math.abs(y) - at) <= r;

/**
 * 9-patch panel after an icon board (kovcheg): a raised gold margin, a thin red line (luzga) and a
 * deep lapis field, with gold corner diamonds (margins 30 px in the project).
 */
function panel(size = 96) {
  return icon(size, [
    { inside: roundRect(1, 1, 0.3), colour: vertical([246, 214, 130, 245], [176, 128, 52, 245]) },
    { inside: roundRect(0.93, 0.93, 0.26), colour: solid([70, 44, 18, 245]) },
    { inside: roundRect(0.9, 0.9, 0.24), colour: solid([150, 30, 32, 245]) },
    { inside: roundRect(0.87, 0.87, 0.22), colour: vertical([26, 30, 64, 244], [12, 12, 30, 248]) },
    { inside: corners(0.72, 0.075), colour: solid([236, 196, 104, 235]) },
  ]);
}

/** 9-patch button: warm gold, lighter at the top. */
function button(size = 96, top = [255, 233, 168], bottom = [214, 160, 60]) {
  return icon(size, [
    { inside: roundRect(1, 1, 0.5), colour: solid([120, 84, 26, 255]) },
    { inside: roundRect(0.94, 0.94, 0.46), colour: vertical([...top, 255], [...bottom, 255]) },
    { inside: both(roundRect(0.84, 0.84, 0.4), (_, y) => y > 0.25), colour: solid([255, 255, 255, 45]) },
  ]);
}

const heartIcon = (fill, rim) => icon(96, [
  { inside: heart(0.86), colour: solid(rim) },
  { inside: heart(0.72), colour: fill },
]);

const flameIcon = (outer, inner, rim) => icon(96, [
  { inside: flame(0.98), colour: solid(rim) },
  { inside: flame(0.86), colour: outer },
  { inside: (x, y) => flame(0.46)(x, y + 0.28), colour: inner },
]);

function touchButton(glyph, accent) {
  return icon(192, [
    { inside: circle(0, 0, 1), colour: solid([...INK, 150]) },
    { inside: ring(0.88, 0.98), colour: solid([...accent, 230]) },
    ...glyph,
  ]);
}

// ─── particles ─────────────────────────────────────────────────────────────────────────────────

const softDot = size => image(size, size, (x, y) => {
  const d = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
  const a = Math.max(0, 1 - d) ** 2.2;
  return [255, 255, 255, 255 * a];
});

const spark = size => image(size, size, (x, y) => {
  const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
  const d = Math.hypot(u, v);
  const rays = Math.max(0, 1 - Math.abs(u) * 8) * Math.max(0, 1 - Math.abs(v)) + Math.max(0, 1 - Math.abs(v) * 8) * Math.max(0, 1 - Math.abs(u));
  const a = Math.min(1, Math.max(0, 1 - d * 1.6) ** 2 + rays * 0.9);
  return [255, 255, 255, 255 * a];
});

// ─── build ─────────────────────────────────────────────────────────────────────────────────────

const files = {
  'ui/panel.png': panel(),
  'ui/button.png': button(),
  'ui/button-quiet.png': button(96, [214, 206, 236], [128, 118, 160]),
  'ui/card.png': icon(128, [
    { inside: roundRect(1, 1, 0.2), colour: vertical([250, 222, 140, 255], [190, 140, 60, 255]) },
    { inside: roundRect(0.95, 0.95, 0.18), colour: solid([150, 30, 32, 250]) },
    { inside: roundRect(0.93, 0.93, 0.17), colour: vertical([46, 40, 76, 246], [20, 18, 36, 250]) },
    { inside: corners(0.8, 0.05), colour: solid([236, 196, 104, 230]) },
  ]),
  'ui/bar.png': icon(32, [{ inside: roundRect(1, 0.8, 0.79), colour: solid([255, 255, 255, 255]) }]),
  'ui/heart.png': heartIcon(radial([255, 140, 150, 255], [214, 48, 72, 255]), [255, 236, 236, 255]),
  'ui/heart-empty.png': heartIcon(solid([40, 30, 46, 200]), [150, 130, 150, 220]),
  'ui/flame.png': flameIcon(vertical([255, 214, 90, 255], [255, 96, 30, 255]), solid([255, 247, 200, 255]), [255, 240, 200, 255]),
  'ui/flame-empty.png': flameIcon(solid([40, 30, 40, 190]), solid([60, 48, 56, 190]), [150, 120, 110, 210]),
  'ui/light.png': icon(64, [
    { inside: diamond(0.62, 0.95), colour: solid([255, 246, 210, 255]) },
    { inside: diamond(0.46, 0.75), colour: vertical([255, 236, 150, 255], [235, 170, 60, 255]) },
  ]),
  'ui/manna.png': icon(64, [
    { inside: (x, y) => (x / 0.95) ** 2 + (y / 0.62) ** 2 <= 1, colour: solid([255, 246, 220, 255]) },
    { inside: (x, y) => (x / 0.82) ** 2 + ((y - 0.04) / 0.5) ** 2 <= 1, colour: vertical([250, 228, 170, 255], [214, 170, 96, 255]) },
  ]),
  'ui/joystick-border.png': icon(256, [
    { inside: circle(0, 0, 1), colour: solid([...INK, 110]) },
    { inside: ring(0.9, 0.98), colour: solid([...GOLD, 200]) },
  ]),
  'ui/joystick-thumb.png': icon(128, [
    { inside: circle(0, 0, 1), colour: radial([255, 246, 220, 235], [214, 170, 80, 220]) },
  ]),
  'ui/touch-strike.png': touchButton([
    { inside: star(8, 0.3, 0.68, Math.PI / 8), colour: solid([255, 236, 180, 255]) },
    { inside: circle(0, 0, 0.24), colour: solid([255, 200, 90, 255]) },
  ], GOLD),
  'ui/touch-fire.png': touchButton([
    { inside: flame(0.62), colour: vertical([255, 214, 90, 255], [255, 96, 30, 255]) },
    { inside: (x, y) => flame(0.3)(x, y + 0.2), colour: solid([255, 247, 200, 255]) },
  ], [255, 140, 60]),
  'ui/rotate-device.png': icon(256, [
    { inside: both(roundRect(0.42, 0.78, 0.12), not(roundRect(0.34, 0.66, 0.06))), colour: solid([255, 246, 220, 255]) },
    { inside: both(ring(0.86, 0.96), (x, y) => y > 0.3 && x > -0.2), colour: solid([...GOLD, 255]) },
  ]),
  // the browser tab icon (the export adds it to index.html): a halo over a small light
  'web/favicon.png': icon(64, [
    { inside: circle(0, 0, 1), colour: solid([28, 22, 44, 255]) },
    { inside: (x, y) => ((x / 0.62) ** 2 + ((y - 0.38) / 0.2) ** 2 <= 1) && ((x / 0.42) ** 2 + ((y - 0.38) / 0.1) ** 2 > 1), colour: solid([255, 214, 110, 255]) },
    { inside: diamond(0.3, 0.45), colour: vertical([255, 246, 210, 255], [235, 170, 60, 255]) },
  ]),
  // guided breathing: a soft ring of light that grows and shrinks with the breath
  'ui/breath.png': image(256, 256, (x, y) => {
    const d = Math.hypot((x + 0.5) / 128 - 1, (y + 0.5) / 128 - 1);
    const ring = Math.exp(-(((d - 0.82) / 0.07) ** 2));
    const fill = Math.max(0, 1 - d) ** 1.2 * 0.45;
    return [255, 226 + 20 * fill, 150 + 90 * fill, 255 * Math.min(1, ring + fill)];
  }),
  // the screen-edge pointer to a memory or a spring: a chevron pointing right (+X)
  'ui/pointer.png': icon(64, [
    { inside: (x, y) => x >= -0.8 && x <= 0.9 && Math.abs(y) <= (0.9 - x) * 0.55, colour: solid([40, 26, 12, 220]) },
    { inside: (x, y) => x >= -0.62 && x <= 0.74 && Math.abs(y) <= (0.74 - x) * 0.55, colour: vertical([255, 236, 170, 255], [230, 170, 70, 255]) },
  ]),
  'ui/touch-breath.png': touchButton([
    { inside: ring(0.5, 0.6), colour: solid([200, 230, 255, 255]) },
    { inside: circle(0, 0, 0.28), colour: radial([255, 255, 255, 255], [140, 200, 255, 255]) },
  ], [140, 200, 255]),
  'particles/soft.png': softDot(64),
  'particles/spark.png': spark(64),
};

for (const [file, data] of Object.entries(files)) {
  await mkdir(join(ASSETS, file, '..'), { recursive: true });
  await writeFile(join(ASSETS, file), data);
}
console.log(`${Object.keys(files).length} images → ${ASSETS}`);
