#!/usr/bin/env node
/**
 * Builds the 3D models of the painted figures and of the effects (project/assets/models):
 *
 *   hero-<id>.glb      the archangels          (from assets/heroes/<id>.webp)
 *   enemy-<kind>.glb   the shadow-thoughts     (from assets/enemies/<kind>.webp)
 *   boss-<id>.glb      the lies personified    (from assets/bosses/<id>.webp)
 *   christ.glb, person-m.glb, person-f.glb, reliquary.glb
 *   fx-*.glb           projectiles, auras and pools: flat glowing quads, drawn here in code
 *
 * The paintings come from tools/art.py (generate, then process). Figures are billboards (see
 * billboard.mjs): a standing cut-out with a soft shadow and a breathing idle animation.
 *
 *   node game3d/tools/build-billboards.mjs           build (a grey silhouette stands in for a figure not painted yet)
 *   node game3d/tools/build-billboards.mjs --check   also fail if a painting is missing
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { ASSETS } from './paths.mjs';
import { billboardGlb, flatGlb, imageSize } from './billboard.mjs';
import { HEROES, ENEMIES } from './game-data.mjs';
import { CHAPTERS } from './story.mjs';

const OUT = join(ASSETS, 'models');
const check = process.argv.includes('--check');
const missing = [];

const FIGURES = [
  ...HEROES.map(h => ({ from: `heroes/${h.id}.webp`, to: `hero-${h.id}.glb`, bob: 0.03, period: 2.6 })),
  ...ENEMIES.map(e => ({ from: `enemies/${e.kind}.webp`, to: `enemy-${e.kind}.glb`, bob: 0.04, period: 1.6 + (e.hp > 40 ? 0.8 : 0), sway: 3 })),
  ...CHAPTERS.map(c => ({ from: `bosses/${c.id}.webp`, to: `boss-${c.id}.glb`, bob: 0.01, period: 3.2, sway: 0.6, shadow: { width: 0.9, depth: 0.42 } })),
  { from: 'christ/figure.webp', to: 'christ.glb', bob: 0.015, period: 3.4, sway: 0.4 },
  { from: 'people/man.webp', to: 'person-m.glb', bob: 0.008, period: 3.6, sway: 0.5 },
  { from: 'people/woman.webp', to: 'person-f.glb', bob: 0.008, period: 3.6, sway: 0.5 },
  { from: 'props/reliquary.webp', to: 'reliquary.glb', bob: 0.05, period: 1.8, sway: 0, shadow: { width: 0.8, depth: 0.4 } },
];

// ─── effect textures, drawn pixel by pixel ────────────────────────────────────────────────────

function draw(w, h, pixel) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // u 0..1 left to right, v -1..1 bottom to top
      const [r, g, b, a] = pixel((x + 0.5) / w, 1 - ((y + 0.5) / h) * 2);
      png.data.set([r, g, b, Math.round(Math.max(0, Math.min(1, a)) * 255)].map(c => Math.max(0, Math.min(255, Math.round(c)))), (y * w + x) * 4);
    }
  }
  return PNG.sync.write(png);
}

const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const mixc = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
/** Cheap deterministic noise for smoke. */
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi;
  const f = t => t * t * (3 - 2 * t);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * f(tx) + (c - a) * f(ty) + (a - b - c + d) * f(tx) * f(ty);
};

/** A teardrop of flame pointing +X: white core, gold, orange rim. */
const flame = draw(128, 64, (u, v) => {
  const r = 0.95 * Math.sqrt(Math.max(0, u)) * (1 - Math.pow(u, 6));
  const edge = smooth(0, 0.25, r - Math.abs(v));
  const core = smooth(0.2, 0.7, r - Math.abs(v)) * smooth(0.3, 0.8, u);
  return [...mixc(mixc([255, 110, 30], [255, 210, 90], edge), [255, 252, 230], core), edge];
});

/** A spear of light: a thin bright shaft with a diamond head, pointing +X. */
const spear = draw(256, 40, (u, v) => {
  const head = u > 0.8 ? Math.max(0, 0.9 - Math.abs(u - 0.9) * 9) : 0;
  const shaft = u > 0.04 && u < 0.86 ? Math.exp(-((v / 0.16) ** 2)) * smooth(0.04, 0.3, u) : 0;
  const a = Math.min(1, Math.max(shaft, smooth(0, 0.15, head - Math.abs(v))));
  const glow = Math.exp(-((v / 0.6) ** 2)) * 0.35 * smooth(0.1, 0.85, u);
  return [...mixc([255, 214, 120], [255, 255, 245], a), Math.max(a, glow)];
});

/** A globe of light: white core, blue halo and a thin ring. */
const orb = draw(128, 128, (u, v) => {
  const d = Math.hypot(u * 2 - 1, v);
  const core = smooth(0.45, 0.1, d);
  const halo = Math.max(0, 1 - d) ** 1.5;
  const ring = Math.exp(-(((d - 0.82) / 0.04) ** 2));
  return [...mixc([140, 190, 255], [255, 255, 255], core), Math.min(1, halo * 0.9 + ring * 0.8 + core)];
});

/** A small green glow (the vessel of balm in flight). */
const vial = draw(64, 64, (u, v) => {
  const d = Math.hypot(u * 2 - 1, v);
  const core = smooth(0.5, 0.1, d);
  return [...mixc([90, 220, 140], [240, 255, 240], core), Math.max(0, 1 - d) ** 1.3];
});

/** A pool of healing balm: a soft green disc with a bright rim and a faint cross. */
const pool = draw(256, 256, (u, v) => {
  const x = u * 2 - 1, d = Math.hypot(x, v);
  if (d > 1) return [0, 0, 0, 0];
  const rim = Math.exp(-(((d - 0.88) / 0.05) ** 2));
  const cross = (Math.abs(x) < 0.05 || Math.abs(v) < 0.05) && d < 0.6 ? 0.25 : 0;
  const fill = 0.22 * smooth(1, 0.5, d);
  return [...mixc([80, 210, 130], [230, 255, 200], rim), Math.min(1, fill + rim * 0.85 + cross)];
});

/** A ring of incense smoke, violet and white. */
const incense = draw(256, 256, (u, v) => {
  const x = u * 2 - 1, d = Math.hypot(x, v);
  const angle = Math.atan2(v, x);
  const n = vnoise(Math.cos(angle) * 3 + 10, Math.sin(angle) * 3 + d * 6) * 0.7 + vnoise(x * 9, v * 9) * 0.3;
  const band = Math.exp(-(((d - 0.7) / 0.22) ** 2));
  const a = Math.max(0, band * (0.35 + 0.75 * n) - 0.1) * smooth(1, 0.92, d);
  return [...mixc([150, 120, 230], [250, 245, 255], n), a];
});

/** Three red-gold cords of a lash, curving toward +X. */
const lash = draw(192, 48, (u, v) => {
  let a = 0;
  for (const k of [-0.45, 0, 0.45]) {
    const y = k * (0.2 + 0.8 * u) + Math.sin(u * Math.PI) * 0.12;
    a = Math.max(a, Math.exp(-(((v - y) / (0.06 + 0.04 * u)) ** 2)) * smooth(0, 0.2, u) * smooth(1, 0.85, u));
  }
  return [...mixc([200, 40, 40], [255, 220, 140], a), a];
});

/** A white rose petal with a blush at the base. */
const petal = draw(64, 48, (u, v) => {
  const x = u * 2 - 1;
  const d = (x / 0.95) ** 2 + (v / (0.62 * (1 - 0.35 * x))) ** 2;
  const a = smooth(1, 0.8, d);
  return [...mixc([255, 190, 210], [255, 250, 252], smooth(-0.8, 0.6, x)), a];
});

/** A soft gold glow: the light a shadow leaves when it breaks. */
const glow = draw(128, 128, (u, v) => {
  const d = Math.hypot(u * 2 - 1, v);
  const rays = Math.abs(Math.cos(Math.atan2(v, u * 2 - 1) * 4)) ** 8 * Math.max(0, 1 - d) * 0.6;
  return [255, 236, 170, Math.max(0, 1 - d) ** 2 + rays];
});

/** A spring of living water (J 4,14): a blue pool with ripples and a bright rim. */
const spring = draw(256, 256, (u, v) => {
  const x = u * 2 - 1, d = Math.hypot(x, v);
  if (d > 1) return [0, 0, 0, 0];
  const rim = Math.exp(-(((d - 0.9) / 0.05) ** 2));
  const ripples = (0.5 + 0.5 * Math.cos(d * 26)) * smooth(0.95, 0.2, d) * 0.35;
  const fill = 0.35 * smooth(1, 0.3, d);
  return [...mixc([60, 140, 230], [220, 245, 255], Math.min(1, rim + ripples)), Math.min(1, fill + ripples + rim * 0.9)];
});

/** The ring under a speaking shadow: a red-violet halo that pulses. */
const voiceRing = draw(256, 256, (u, v) => {
  const x = u * 2 - 1, d = Math.hypot(x, v);
  const ring = Math.exp(-(((d - 0.78) / 0.08) ** 2));
  const haze = Math.max(0, 1 - d) ** 2 * 0.35;
  return [...mixc([150, 40, 90], [255, 140, 170], ring), Math.min(1, ring * 0.95 + haze)];
});

/** A word of truth left by a silenced voice: a gold disc with four rays. */
const truth = draw(128, 128, (u, v) => {
  const x = u * 2 - 1, d = Math.hypot(x, v);
  const core = smooth(0.5, 0.2, d);
  const rays = (Math.exp(-((x / 0.06) ** 2)) + Math.exp(-((v / 0.06) ** 2))) * Math.max(0, 1 - d);
  return [...mixc([255, 200, 80], [255, 255, 235], core), Math.min(1, core + rays * 0.8 + Math.max(0, 1 - d) ** 2 * 0.5)];
});

/** The light around a memory: pale silver mist. */
const memory = draw(256, 256, (u, v) => {
  const x = u * 2 - 1, d = Math.hypot(x, v);
  const n = vnoise(x * 5 + 3, v * 5 + 7);
  return [...mixc([170, 180, 220], [255, 255, 255], n), Math.max(0, 1 - d) ** 1.6 * (0.45 + 0.4 * n)];
});

const EFFECTS = [
  ['fx-spring.glb', spring, 1, 12],
  ['fx-voice.glb', voiceRing, 1, 50],
  ['fx-truth.glb', truth, 1, 90],
  ['fx-memory.glb', memory, 1, 15],
  ['fx-flame.glb', flame, 0.5],
  ['fx-spear.glb', spear, 40 / 256],
  ['fx-orb.glb', orb, 1],
  ['fx-vial.glb', vial, 1],
  ['fx-pool.glb', pool, 1, 25],
  ['fx-incense.glb', incense, 1, -40],
  ['fx-lash.glb', lash, 0.25],
  ['fx-petal.glb', petal, 0.75],
  ['fx-glow.glb', glow, 1, 30],
];

await mkdir(OUT, { recursive: true });
let built = 0;
/** Until a figure is painted: a grey silhouette, so the project builds and plays (never in --check). */
const placeholder = draw(128, 192, (u, v) => {
  const head = Math.hypot((u - 0.5) / 0.16, (v - 0.62) / 0.11) <= 1;
  const body = Math.abs(u - 0.5) < 0.3 * (1 - (v + 1) / 3.2) && v < 0.5;
  return [150, 140, 160, head || body ? 0.85 : 0];
});

for (const f of FIGURES) {
  const source = join(ASSETS, f.from);
  const painted = existsSync(source);
  if (!painted) missing.push(f.from);
  if (!painted && (check || existsSync(join(OUT, f.to)))) continue;
  const image = painted ? await readFile(source) : placeholder;
  const { width, height } = imageSize(image);
  const glb = await billboardGlb({ image, mime: painted && f.from.endsWith('.webp') ? 'image/webp' : 'image/png', aspect: height / width, bob: f.bob, period: f.period, sway: f.sway, shadow: f.shadow });
  await writeFile(join(OUT, f.to), glb);
  built++;
}
for (const [file, image, aspect, spin] of EFFECTS) {
  await writeFile(join(OUT, file), await flatGlb({ image, aspect, spin }));
  built++;
}
const stale = (await readdir(OUT)).filter(f => /^(trauma-|angel\.glb)/.test(f));
console.log(`${built} models in project/assets/models${missing.length ? `; no painting yet for ${missing.length}: ${missing.join(', ')}` : ''}${stale.length ? `; old models left: ${stale.join(', ')}` : ''}`);
if (check && missing.length) process.exit(1);
