/**
 * Motylarnia's procedural art, part one: colour helpers, warm cream paper with grain, the painted
 * leaf (layered greens, watercolour blotches, embossed veins, a pale rim where it is bitten), the
 * soil-brown paper under the holes, gouache pigment dots with their colour-blind patterns, the two
 * treats, the caterpillar seen from above and from the side, and the egg.  Static pictures are
 * painted once into offscreen canvases (small caches with a cap); per-frame drawing reuses them and
 * creates no gradients: the caterpillar's shaded segments and head are sprites per larva and size.
 */
import { PIGMENTS, type Larva, type PigmentPattern, type PlantLook } from './content';
import { LEAF_H, LEAF_W, type Bite, type LeafModel, type TreatKind } from './leaf';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const PAPER = '#F6F0E1';
export const INK = '#2F3A26';
export const INK_SOFT = '#6B5D48';
const TAU = Math.PI * 2;

// ── colour ────────────────────────────────────────────────────────
export function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex2 = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
export const toHex = (r: number, g: number, b: number): string => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
/** a → b by t (hex colours). */
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a), y = rgbOf(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
export const lighten = (c: string, t: number): string => mix(c, '#ffffff', t);
export const darken = (c: string, t: number): string => mix(c, '#140c06', t);
export function rgba(c: string, a: number): string {
  const [r, g, b] = rgbOf(c);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/** Stable pseudo-random numbers for decoration (no state). */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Many small specks in a few colours: the specks are binned by colour and each bin is one path, so a
 * grain of thousands of dots costs a handful of fills.  `at(i)` gives the i-th speck's x, y, size and a
 * 0..1 value that picks its bin.
 */
export function speckle(ctx: CanvasRenderingContext2D, n: number, colours: readonly string[], at: (i: number) => [number, number, number, number]): void {
  const paths = colours.map(() => new Path2D());
  for (let i = 0; i < n; i++) {
    const [x, y, size, v] = at(i);
    paths[Math.min(colours.length - 1, Math.floor(v * colours.length))].rect(x, y, size, size);
  }
  paths.forEach((p, k) => {
    ctx.fillStyle = colours[k];
    ctx.fill(p);
  });
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
export const ctx2d = (c: HTMLCanvasElement): CanvasRenderingContext2D => c.getContext('2d')!;

/** Remember `value` under `key`, dropping the oldest entry beyond `cap` (sprite caches stay bounded across resizes). */
export function remember<K, V>(map: Map<K, V>, key: K, value: V, cap: number): V {
  map.set(key, value);
  if (map.size > cap) map.delete(map.keys().next().value!);
  return value;
}

const fitted = new Map<string, number>();

/** The largest font size (≤ `size`) at which `text` fits `maxW`; sets ctx.font (memoised: the HUD asks every frame). */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight: number, family: string, min = 10): number {
  const key = `${text}|${Math.round(maxW)}|${size}|${weight}|${family}|${min}`;
  let s = fitted.get(key);
  if (s === undefined) {
    s = size;
    ctx.font = `${weight} ${s}px ${family}`;
    while (s > min && ctx.measureText(text).width > maxW) {
      s -= 1;
      ctx.font = `${weight} ${s}px ${family}`;
    }
    if (fitted.size > 600) fitted.clear();
    fitted.set(key, s);
  }
  ctx.font = `${weight} ${s}px ${family}`;
  return s;
}

/** Wrap `text` to lines no wider than `maxW` at the current font. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' '), lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ── paper ─────────────────────────────────────────────────────────
/** Cream paper with fibres and grain; `tone` tints it (a warm golden hour, a dusk). */
export function paintPaper(ctx: CanvasRenderingContext2D, w: number, h: number, base = PAPER, seed = 1): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(255,252,240,.5)');
  g.addColorStop(1, 'rgba(120,92,52,.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const n = Math.min(2400, Math.round((w * h) / 260));
  speckle(ctx, n, ['rgba(110,84,50,.06)', 'rgba(110,84,50,.1)', 'rgba(255,255,248,.14)', 'rgba(255,255,248,.26)'], i =>
    [hash(i * 3 + seed) * w, hash(i * 7 + seed * 13) * h, hash(i * 17 + seed) > 0.92 ? 2 : 1, hash(i * 11 + seed * 5)]);
  // a few long fibres
  ctx.lineWidth = 0.6;
  for (let i = 0; i < Math.min(90, n / 25); i++) {
    const x = hash(i * 17 + seed) * w, y = hash(i * 19 + seed) * h, a = hash(i * 23) * TAU, l = 6 + hash(i * 29) * 14;
    ctx.strokeStyle = `rgba(120,96,60,${0.06 + 0.06 * hash(i * 31)})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 2, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

// ── the leaf ──────────────────────────────────────────────────────
export function leafPath(m: LeafModel): Path2D {
  const p = new Path2D();
  for (const o of m.outlines) {
    p.moveTo(o[0], o[1]);
    for (let i = 2; i < o.length; i += 2) p.lineTo(o[i], o[i + 1]);
    p.closePath();
  }
  return p;
}

const leafPaths = new WeakMap<LeafModel, Path2D>();
export function cachedLeafPath(m: LeafModel): Path2D {
  let p = leafPaths.get(m);
  if (!p) leafPaths.set(m, (p = leafPath(m)));
  return p;
}

function outlinePath(o: Float32Array): Path2D {
  const p = new Path2D();
  p.moveTo(o[0], o[1]);
  for (let i = 2; i < o.length; i += 2) p.lineTo(o[i], o[i + 1]);
  p.closePath();
  return p;
}

/**
 * The painted leaf in leaf space at `scale` px per unit (stalk and all): the canvas the bites are
 * punched into.  Leaflets are painted bottom layer first, each with its own shading and veins, so a
 * compound leaf reads as overlapping leaflets.  `golden` warms it for the last round's golden hour.
 */
export function paintLeaf(m: LeafModel, look: PlantLook, scale: number, golden: boolean, seed: number): HTMLCanvasElement {
  const c = canvas(LEAF_W * scale, (LEAF_H + 14) * scale), ctx = ctx2d(c);
  ctx.scale(scale, scale);
  const dark = golden ? mix(look.dark, '#8a6a1e', 0.25) : look.dark;
  const mid = golden ? mix(look.mid, '#c9a33a', 0.22) : look.mid;
  const light = golden ? mix(look.light, '#f2d77a', 0.3) : look.light;
  const vein = golden ? mix(look.vein, '#f6e2a0', 0.3) : look.vein;
  // the stalk
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = dark;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(m.stalk[0][0], m.stalk[0][1]);
  for (const [x, y] of m.stalk.slice(1)) ctx.lineTo(x, y);
  ctx.stroke();
  ctx.strokeStyle = rgba(light, 0.8);
  ctx.lineWidth = 3;
  ctx.stroke();
  m.layers.forEach((lf, li) => {
    const path = outlinePath(lf.outline);
    const dx = Math.sin(lf.angle), dy = -Math.cos(lf.angle);
    const cx = lf.x + dx * lf.length * 0.5, cy = lf.y + dy * lf.length * 0.5, R = Math.max(lf.length * 0.62, lf.width * 1.2);
    ctx.save();
    ctx.shadowColor = 'rgba(30,40,10,.28)';
    ctx.shadowBlur = 6 * scale;
    ctx.shadowOffsetY = 2 * scale;
    ctx.strokeStyle = darken(dark, 0.2);
    ctx.lineWidth = 3.2;
    ctx.stroke(path);
    ctx.restore();
    const body = ctx.createRadialGradient(cx - dx * R * 0.1, cy - dy * R * 0.1 - R * 0.08, R * 0.05, cx, cy, R);
    body.addColorStop(0, light);
    body.addColorStop(0.45, mid);
    body.addColorStop(1, dark);
    ctx.fillStyle = body;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    // watercolour blotches
    const span = Math.max(lf.length, lf.width * 2);
    for (let i = 0; i < 12; i++) {
      const t = hash(seed + li * 31 + i * 5), off = (hash(seed + li * 17 + i * 9) - 0.5) * lf.width * 1.6;
      const x = lf.x + dx * lf.length * t + Math.cos(lf.angle) * off, y = lf.y + dy * lf.length * t + Math.sin(lf.angle) * off;
      const r = span * (0.06 + hash(seed + i * 13 + li) * 0.16), lightOne = hash(seed + i * 17 + li * 3) < 0.55;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(lightOne ? light : dark, 0.18 + 0.12 * hash(i + li)));
      g.addColorStop(1, rgba(lightOne ? light : dark, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // the leaflet curls a little at its edge
    ctx.strokeStyle = rgba(dark, 0.45);
    ctx.lineWidth = 14;
    ctx.stroke(path);
    ctx.strokeStyle = rgba(dark, 0.25);
    ctx.lineWidth = 30;
    ctx.stroke(path);
    // veins: a soft shadow line and a pale vein over it, tapering
    for (const v of lf.veins) {
      const p = v.pts;
      ctx.beginPath();
      ctx.moveTo(p[0] + 0.8, p[1] + 1);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] + 0.8, p[i + 1] + 1);
      ctx.strokeStyle = rgba(dark, 0.5);
      ctx.lineWidth = v.w * 1.5;
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(vein, 0.8);
    for (const v of lf.veins) {
      // tapering toward the tip, in four strokes of falling width
      const p = v.pts, n = p.length / 2;
      for (let part = 0; part < 4; part++) {
        const i0 = Math.floor((part * (n - 1)) / 4), i1 = Math.floor(((part + 1) * (n - 1)) / 4);
        ctx.beginPath();
        ctx.moveTo(p[i0 * 2], p[i0 * 2 + 1]);
        for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
        ctx.lineWidth = Math.max(0.6, v.w * (1 - 0.19 * part));
        ctx.stroke();
      }
    }
    // grain
    speckle(ctx, Math.round((lf.length * lf.width) / 40), [rgba(dark, 0.18), rgba(light, 0.22)], i => {
      const t = hash(seed * 3 + i * 7 + li), off = (hash(seed * 7 + i * 11 + li) - 0.5) * lf.width * 2.1;
      return [lf.x + dx * lf.length * t + Math.cos(lf.angle) * off, lf.y + dy * lf.length * t + Math.sin(lf.angle) * off, 1.4, hash(i * 13 + seed + li)];
    });
    if (m.plant === 'pokrzywa') {
      // stinging hairs
      ctx.strokeStyle = 'rgba(255,255,240,.45)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = 0; i < 260; i++) {
        const x = m.box.x0 + hash(i * 41 + 3) * (m.box.x1 - m.box.x0), y = m.box.y0 + hash(i * 43 + 5) * (m.box.y1 - m.box.y0), a = -0.6 + hash(i * 47) * 1.2 - Math.PI / 2;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
      }
      ctx.stroke();
    } else if (m.plant === 'kapusta') {
      const g = ctx.createLinearGradient(m.box.x0, m.box.y0, m.box.x1, m.box.y1);
      g.addColorStop(0, 'rgba(235,245,240,.28)');
      g.addColorStop(0.5, 'rgba(235,245,240,0)');
      g.addColorStop(1, 'rgba(235,245,240,.18)');
      ctx.fillStyle = g;
      ctx.fill(path);
    } else if (m.plant === 'koniczyna') {
      // the pale chevron of a clover leaflet
      const px = Math.cos(lf.angle), py = Math.sin(lf.angle), bx = lf.x + dx * lf.length * 0.36, by = lf.y + dy * lf.length * 0.36;
      ctx.strokeStyle = 'rgba(236,246,214,.4)';
      ctx.lineWidth = lf.width * 0.13;
      ctx.beginPath();
      ctx.moveTo(bx - px * lf.width * 0.42 + dx * lf.width * 0.3, by - py * lf.width * 0.42 + dy * lf.width * 0.3);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + px * lf.width * 0.42 + dx * lf.width * 0.3, by + py * lf.width * 0.42 + dy * lf.width * 0.3);
      ctx.stroke();
    } else if (m.plant === 'kruszyna' || m.plant === 'fiolek') {
      const g = ctx.createLinearGradient(m.box.x0, m.box.y0, m.box.x1, m.box.y0 + (m.box.y1 - m.box.y0) * 0.6);
      g.addColorStop(0.2, 'rgba(255,255,240,0)');
      g.addColorStop(0.42, 'rgba(255,255,240,.2)');
      g.addColorStop(0.55, 'rgba(255,255,240,0)');
      ctx.fillStyle = g;
      ctx.fill(path);
    }
    ctx.restore();
    // a thin bright line just inside the margin
    ctx.strokeStyle = rgba(light, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke(path);
  });
  return c;
}

/** Punch bites into the painted leaf: a pale cut rim, then the hole. */
export function punchBites(ctx: CanvasRenderingContext2D, bites: readonly Bite[], from: number, to: number, rim: string): void {
  ctx.save();
  for (let i = from; i < to; i++) {
    const b = bites[i];
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (let i = from; i < to; i++) {
    const b = bites[i];
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The soil-brown paper seen through the holes, under the leaf's silhouette (in leaf space). */
export function paintSoil(ctx: CanvasRenderingContext2D, m: LeafModel, seed: number): void {
  const path = cachedLeafPath(m);
  ctx.save();
  ctx.clip(path);
  const g = ctx.createLinearGradient(0, m.box.y0, 0, m.box.y1);
  g.addColorStop(0, '#7B5A3A');
  g.addColorStop(1, '#5E4229');
  ctx.fillStyle = g;
  ctx.fillRect(m.box.x0 - 4, m.box.y0 - 4, m.box.x1 - m.box.x0 + 8, m.box.y1 - m.box.y0 + 8);
  speckle(ctx, 1400, ['rgba(40,26,14,.22)', 'rgba(40,26,14,.36)', 'rgba(170,130,90,.15)', 'rgba(170,130,90,.26)'], i =>
    [m.box.x0 + hash(seed + i * 5) * (m.box.x1 - m.box.x0), m.box.y0 + hash(seed + i * 3) * (m.box.y1 - m.box.y0), 1.6, hash(i * 7 + seed)]);
  // the hole's shade: the leaf hovers a little above the soil
  ctx.strokeStyle = 'rgba(30,18,8,.35)';
  ctx.lineWidth = 10;
  ctx.stroke(path);
  ctx.restore();
}

/** A soft shadow of the leaf on the paper (leaf space). */
export function paintLeafShadow(ctx: CanvasRenderingContext2D, m: LeafModel): void {
  ctx.save();
  ctx.shadowColor = 'rgba(70,52,24,.32)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = 'rgba(70,52,24,.18)';
  ctx.fill(cachedLeafPath(m));
  ctx.restore();
}

// ── pigment dots and treats ──────────────────────────────────────
function pattern(ctx: CanvasRenderingContext2D, kind: PigmentPattern, r: number, ink: string): void {
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = 'round';
  switch (kind) {
    case 'dot':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, TAU);
      ctx.fill();
      break;
    case 'stripe':
      ctx.lineWidth = r * 0.17;
      for (const o of [-0.45, 0, 0.45]) {
        ctx.beginPath();
        ctx.moveTo((o - 0.38) * r, (o + 0.38) * r);
        ctx.lineTo((o + 0.38) * r, (o - 0.38) * r);
        ctx.stroke();
      }
      break;
    case 'ring':
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.48, 0, TAU);
      ctx.stroke();
      break;
    case 'cross':
      ctx.lineWidth = r * 0.18;
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, 0);
      ctx.lineTo(r * 0.42, 0);
      ctx.moveTo(0, -r * 0.42);
      ctx.lineTo(0, r * 0.42);
      ctx.stroke();
      break;
    case 'petal':
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.16, 0, TAU);
        ctx.fill();
      }
      break;
  }
}

const dotCache = new Map<number, HTMLCanvasElement>();

/** A gouache pigment blob with its pattern, as a sprite `2·r` px across (plus a shadow margin). */
export function dotSprite(pigment: number, rPx: number): HTMLCanvasElement {
  const r = Math.max(3, Math.round(rPx * 2) / 2), key = pigment * 4096 + r * 2;
  const hit = dotCache.get(key);
  if (hit) return hit;
  const pad = Math.ceil(r * 0.6) + 2, c = canvas((r + pad) * 2, (r + pad) * 2), ctx = ctx2d(c), p = PIGMENTS[pigment];
  ctx.translate(r + pad, r + pad);
  // a slightly irregular blob
  ctx.beginPath();
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * TAU, rr = r * (0.93 + 0.08 * hash(pigment * 31 + i));
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.save();
  ctx.shadowColor = 'rgba(40,30,10,.35)';
  ctx.shadowBlur = r * 0.5;
  ctx.shadowOffsetY = r * 0.18;
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  g.addColorStop(0, lighten(p.color, 0.28));
  g.addColorStop(0.55, p.color);
  g.addColorStop(1, darken(p.color, 0.12));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(p.dark, 0.6);
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.stroke();
  pattern(ctx, p.pattern, r, p.pattern === 'ring' || p.pattern === 'cross' ? rgba(p.dark, 0.75) : 'rgba(255,252,240,.72)');
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.42, r * 0.26, r * 0.14, -0.6, 0, TAU);
  ctx.fill();
  return remember(dotCache, key, c, 96);
}

const treatCache = new Map<number, HTMLCanvasElement>();

/** A raspberry or a dandelion seed head, `r` px in radius. */
export function treatSprite(kind: TreatKind, rPx: number): HTMLCanvasElement {
  const r = Math.max(4, Math.round(rPx)), key = (kind === 'malina' ? 0 : 1) * 4096 + r;
  const hit = treatCache.get(key);
  if (hit) return hit;
  const pad = Math.ceil(r * 0.9), c = canvas((r + pad) * 2, (r + pad) * 2), ctx = ctx2d(c);
  ctx.translate(r + pad, r + pad);
  if (kind === 'malina') {
    ctx.save();
    ctx.shadowColor = 'rgba(60,10,20,.35)';
    ctx.shadowBlur = r * 0.5;
    ctx.shadowOffsetY = r * 0.2;
    ctx.fillStyle = '#B0263F';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, TAU);
    ctx.fill();
    ctx.restore();
    // drupelets
    for (let i = 0; i < 19; i++) {
      const ring = i === 0 ? 0 : i < 7 ? 1 : 2, k = ring === 0 ? 0 : ring === 1 ? (i - 1) / 6 : (i - 7) / 12;
      const a = k * TAU + ring * 0.3, d = ring * r * 0.4;
      const x = Math.cos(a) * d, y = Math.sin(a) * d, rr = r * (ring === 2 ? 0.27 : 0.31);
      const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.4, rr * 0.1, x, y, rr);
      g.addColorStop(0, '#F27A8E');
      g.addColorStop(0.6, '#D23452');
      g.addColorStop(1, '#8E1A33');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,240,240,.75)';
    for (let i = 0; i < 6; i++) {
      const a = i + 0.4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.42 - r * 0.08, Math.sin(a) * r * 0.42 - r * 0.1, r * 0.07, 0, TAU);
      ctx.fill();
    }
    // the calyx
    ctx.fillStyle = '#4E7F34';
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.42;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, r * 0.32, r * 0.1, a, 0, TAU);
      ctx.fill();
    }
  } else {
    // a dandelion clock: fine rays from a seed bed
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU + hash(i) * 0.1, l = r * (0.85 + 0.25 * hash(i + 9));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18);
      ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * l, Math.sin(a) * l, r * 0.07, 0, TAU);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.1);
    g.addColorStop(0, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#B8A36A';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, TAU);
    ctx.fill();
  }
  return remember(treatCache, key, c, 24);
}

// ── the caterpillar ─────────────────────────────────────────────
export interface BodyPoint { x: number; y: number }

/** A larva's colours, worked out once, and its shaded segment and head sprites by size. */
interface LarvaInk {
  legs: string;
  spine: string;
  stripe: string;
  jaw: string;
  segs: Map<number, HTMLCanvasElement>;
  heads: Map<number, HTMLCanvasElement>;
}
const larvaInks = new WeakMap<Larva, LarvaInk>();

function inkOf(l: Larva): LarvaInk {
  let k = larvaInks.get(l);
  if (!k) {
    k = { legs: darken(l.body, 0.45), spine: darken(l.body, 0.5), stripe: rgba(l.accent, 0.85), jaw: darken(l.head, 0.3), segs: new Map(), heads: new Map() };
    larvaInks.set(l, k);
  }
  return k;
}

/** Sprite radius for `r` device px: exact while small, in 4 px steps above (a sprite is only ever drawn smaller). */
const spriteR = (r: number): number => (r <= 8 ? Math.max(2, Math.ceil(r)) : Math.ceil(r / 4) * 4);

/** A body segment `R` device px in radius, lit from the upper left (1 px to spare around it). */
function segmentSprite(l: Larva, ink: LarvaInk, R: number): HTMLCanvasElement {
  let c = ink.segs.get(R);
  if (!c) {
    c = canvas(2 * R + 2, 2 * R + 2);
    const x = ctx2d(c);
    x.translate(R + 1, R + 1);
    const g = x.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
    g.addColorStop(0, lighten(l.body, 0.3));
    g.addColorStop(0.65, l.body);
    g.addColorStop(1, darken(l.body, 0.25));
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, R, 0, TAU);
    x.fill();
    remember(ink.segs, R, c, 12);
  }
  return c;
}

/** The head `R` device px in radius, looking along +x, with its eyes. */
function headSprite(l: Larva, ink: LarvaInk, R: number): HTMLCanvasElement {
  let c = ink.heads.get(R);
  if (!c) {
    c = canvas(2 * R + 2, 2 * R + 2);
    const x = ctx2d(c);
    x.translate(R + 1, R + 1);
    const g = x.createRadialGradient(-R * 0.2, -R * 0.35, R * 0.1, 0, 0, R);
    g.addColorStop(0, lighten(l.head, 0.35));
    g.addColorStop(1, l.head);
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, R, 0, TAU);
    x.fill();
    x.fillStyle = '#121212';
    x.beginPath();
    for (const s of [-1, 1]) {
      x.moveTo(R * 0.54, s * R * 0.42);
      x.arc(R * 0.38, s * R * 0.42, R * 0.16, 0, TAU);
    }
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.85)';
    x.beginPath();
    for (const s of [-1, 1]) {
      x.moveTo(R * 0.5, s * R * 0.42 - R * 0.05);
      x.arc(R * 0.44, s * R * 0.42 - R * 0.05, R * 0.06, 0, TAU);
    }
    x.fill();
    remember(ink.heads, R, c, 12);
  }
  return c;
}

/** Draw a disc sprite of radius `R` (+1 px margin) as a disc of radius `r` at (x, y). */
function disc(ctx: CanvasRenderingContext2D, s: HTMLCanvasElement, R: number, x: number, y: number, r: number): void {
  const d = (r * (R + 1)) / R;
  ctx.drawImage(s, x - d, y - d, 2 * d, 2 * d);
}

/**
 * The caterpillar from above along the first `count` points of `body` (head first), `girth` = radius
 * of its body (in the current units, `px` device px each).  `munch` 0..1 opens the jaws, `glow` adds
 * the silk sheen.  Flat parts are batched into one path per colour; shaded parts are sprites.
 */
export function drawCaterpillar(ctx: CanvasRenderingContext2D, body: readonly BodyPoint[], girth: number, larva: Larva, munch: number, t: number, glow: number, count = body.length, px = 1): void {
  const n = Math.min(count, body.length);
  if (n < 2) return;
  const ink = inkOf(larva);
  const rAt = (i: number) => girth * (i === 0 ? 0.92 : 1 - 0.38 * (i / (n - 1)) ** 1.6 + 0.05 * Math.sin(i * 0.9));
  // shadow and the silk sheen: one fill each
  ctx.fillStyle = 'rgba(40,30,10,.3)';
  ctx.beginPath();
  for (let i = n - 1; i >= 0; i--) {
    const x = body[i].x + girth * 0.25, y = body[i].y + girth * 0.45, r = rAt(i) * 1.05;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill();
  if (glow > 0.01) {
    const alpha = ctx.globalAlpha;
    ctx.fillStyle = 'rgb(255,248,214)';
    ctx.globalAlpha = alpha * Math.min(1, 0.5 * glow);
    ctx.beginPath();
    for (let i = n - 1; i >= 0; i -= 2) {
      const r = rAt(i) * 1.6;
      ctx.moveTo(body[i].x + r, body[i].y);
      ctx.arc(body[i].x, body[i].y, r, 0, TAU);
    }
    ctx.fill();
    ctx.globalAlpha = alpha;
  }
  // prolegs: little dark feet along the sides
  ctx.fillStyle = ink.legs;
  ctx.beginPath();
  for (let i = 2; i < n - 1; i++) {
    const a = Math.atan2(body[i - 1].y - body[i + 1].y, body[i - 1].x - body[i + 1].x) + Math.PI / 2, r = rAt(i);
    const reach = r * (0.95 + Math.sin(t * 10 - i * 0.8) * 0.15), ca = Math.cos(a), sa = Math.sin(a);
    for (let side = -1; side <= 1; side += 2) {
      const x = body[i].x + ca * side * reach, y = body[i].y + sa * side * reach;
      ctx.moveTo(x + r * 0.2, y);
      ctx.arc(x, y, r * 0.2, 0, TAU);
    }
  }
  ctx.fill();
  // segments, tail first, from one shaded sprite
  const R = spriteR(girth * px), seg = segmentSprite(larva, ink, R);
  for (let i = n - 1; i >= 1; i--) disc(ctx, seg, R, body[i].x, body[i].y, rAt(i));
  // the pattern, one path per colour
  if (larva.pattern === 'dots' || larva.pattern === 'spines') {
    ctx.fillStyle = larva.accent;
    ctx.beginPath();
    for (let i = n - 1; i >= 1; i--) {
      const p = body[i], r = rAt(i), a = Math.atan2(body[i - 1].y - p.y, body[i - 1].x - p.x) + Math.PI / 2;
      for (let side = -1; side <= 1; side += 2) {
        const x = p.x + Math.cos(a) * side * r * 0.5, y = p.y + Math.sin(a) * side * r * 0.5;
        ctx.moveTo(x + r * 0.16, y);
        ctx.arc(x, y, r * 0.16, 0, TAU);
      }
    }
    ctx.fill();
  }
  if (larva.pattern === 'spines') {
    ctx.strokeStyle = ink.spine;
    ctx.lineWidth = Math.max(0.6, girth * 0.08);
    ctx.beginPath();
    for (let i = n - 1; i >= 1; i--) {
      const p = body[i], r = rAt(i);
      for (let k = 0; k < 4; k++) {
        const a = k * 1.57 + i * 0.4, c = Math.cos(a), s = Math.sin(a);
        ctx.moveTo(p.x + c * r * 0.75, p.y + s * r * 0.75);
        ctx.lineTo(p.x + c * r * 1.3, p.y + s * r * 1.3);
      }
    }
    ctx.stroke();
  }
  if (larva.pattern === 'bands') {
    ctx.strokeStyle = larva.accent;
    ctx.lineWidth = girth * 0.25;
    ctx.beginPath();
    for (let i = 2; i < n; i += 2) {
      const p = body[i], r = rAt(i), a = Math.atan2(body[i - 1].y - p.y, body[i - 1].x - p.x) + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
      ctx.moveTo(p.x + c * r * 0.85, p.y + s * r * 0.85);
      ctx.lineTo(p.x - c * r * 0.85, p.y - s * r * 0.85);
    }
    ctx.stroke();
    ctx.fillStyle = '#F08A2A';
    ctx.beginPath();
    for (let i = 2; i < n; i += 2) {
      const p = body[i], r = rAt(i), a = Math.atan2(body[i - 1].y - p.y, body[i - 1].x - p.x) + Math.PI / 2, c = Math.cos(a) * r * 0.45, s = Math.sin(a) * r * 0.45;
      ctx.moveTo(p.x + c + r * 0.13, p.y + s);
      ctx.arc(p.x + c, p.y + s, r * 0.13, 0, TAU);
      ctx.moveTo(p.x - c + r * 0.13, p.y - s);
      ctx.arc(p.x - c, p.y - s, r * 0.13, 0, TAU);
    }
    ctx.fill();
  }
  if (larva.pattern === 'stripe') {
    ctx.strokeStyle = ink.stripe;
    ctx.lineWidth = girth * 0.22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(body[1].x, body[1].y);
    for (let i = 2; i < n; i++) ctx.lineTo(body[i].x, body[i].y);
    ctx.stroke();
  }
  // the head: jaws that open as it munches, then the head sprite
  const h = body[0], nx = body[1], a = Math.atan2(h.y - nx.y, h.x - nx.x), r = rAt(0);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(a);
  const jaw = 0.25 + 0.5 * munch;
  ctx.fillStyle = ink.jaw;
  ctx.beginPath();
  for (let s = -1; s <= 1; s += 2) {
    const ex = r * 0.85, ey = s * r * 0.28 * (1 + jaw), rot = s * jaw * 0.6;
    ctx.moveTo(ex + Math.cos(rot) * r * 0.28, ey + Math.sin(rot) * r * 0.28);
    ctx.ellipse(ex, ey, r * 0.28, r * 0.13, rot, 0, TAU);
  }
  ctx.fill();
  const HR = spriteR(r * px);
  disc(ctx, headSprite(larva, ink, HR), HR, 0, 0, r);
  ctx.restore();
  if (larva.horn) {
    const tail = body[n - 1], pre = body[n - 2], ta = Math.atan2(tail.y - pre.y, tail.x - pre.x), tr = rAt(n - 1);
    ctx.strokeStyle = '#3E5FA8';
    ctx.lineWidth = tr * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(tail.x + Math.cos(ta) * tr * 1.5, tail.y + Math.sin(ta) * tr * 1.5);
    ctx.stroke();
  }
}

/** the hanging larva's points, head first (reused every frame) */
const hangPts: BodyPoint[] = Array.from({ length: 11 }, () => ({ x: 0, y: 0 }));

/** The caterpillar side-on in a "J", hanging from (x, y), `len` px long; `wrap` 0..1 = silk covering it. */
export function drawHangingLarva(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, larva: Larva, wrap: number, t: number, px = 1): void {
  const n = hangPts.length;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    // straight down, curling up at the head (the J); the head is the last point down the J
    const curl = Math.max(0, k - 0.62) / 0.38;
    const sway = Math.sin(t * 1.4) * 0.03 * k, p = hangPts[n - 1 - i];
    p.x = x + Math.sin(curl * 2.4) * len * 0.22 + sway * len;
    p.y = y + k * len * 0.82 - (1 - Math.cos(curl * 2.4)) * len * 0.12;
  }
  const g = len * 0.085;
  drawCaterpillar(ctx, hangPts, g, larva, 0, t, 0, n, px);
  if (wrap > 0) {
    ctx.strokeStyle = 'rgb(255,252,240)';
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * 0.55 * Math.min(1, wrap * 1.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const loops = Math.floor(6 + wrap * 26);
    for (let i = 0; i < loops; i++) {
      // along the body from where it hangs (the last point) to its head
      const p = hangPts[n - 1 - Math.min(n - 1, Math.floor(hash(i * 7) * 0.95 * n))], rot = hash(i * 3) * 1.2 - 0.6;
      ctx.moveTo(p.x + Math.cos(rot) * g * 1.4, p.y + Math.sin(rot) * g * 1.4);
      ctx.ellipse(p.x, p.y, g * 1.4, g * 0.5, rot, 0, TAU);
    }
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 4);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
}

// ── the egg ─────────────────────────────────────────────────────
const eggSprites = new Map<string, { c: HTMLCanvasElement; R: number }>();

/** The egg (shadow, body, ribs, gloss, outline) `R` device px half-height, centred in its sprite (cached). */
function eggSprite(tint: string, R: number): { c: HTMLCanvasElement; R: number } {
  const key = `${tint}|${R}`;
  let s = eggSprites.get(key);
  if (!s) {
    const c = canvas(2 * R + 4, 2.3 * R + 4), ctx = ctx2d(c), r = R;
    ctx.translate(R + 2, R + 2);
    ctx.fillStyle = 'rgba(40,30,10,.25)';
    ctx.beginPath();
    ctx.ellipse(r * 0.15, r * 1.02, r * 0.72, r * 0.16, 0, 0, TAU);
    ctx.fill();
    const egg = new Path2D();
    egg.moveTo(0, -r);
    egg.bezierCurveTo(r * 0.62, -r, r * 0.78, r * 0.2, r * 0.66, r * 0.62);
    egg.bezierCurveTo(r * 0.5, r * 1.02, -r * 0.5, r * 1.02, -r * 0.66, r * 0.62);
    egg.bezierCurveTo(-r * 0.78, r * 0.2, -r * 0.62, -r, 0, -r);
    const g = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, lighten(tint, 0.55));
    g.addColorStop(0.6, tint);
    g.addColorStop(1, darken(tint, 0.3));
    ctx.fillStyle = g;
    ctx.fill(egg);
    ctx.save();
    ctx.clip(egg);
    ctx.strokeStyle = rgba(darken(tint, 0.35), 0.45);
    ctx.lineWidth = Math.max(0.8, r * 0.05);
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath();
      ctx.moveTo(k * r * 0.05, -r * 0.98);
      ctx.quadraticCurveTo(k * r * 0.2, r * 0.1, k * r * 0.14, r * 1.0);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.4, r * 0.16, r * 0.3, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgba(darken(tint, 0.4), 0.6);
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke(egg);
    s = remember(eggSprites, key, { c, R }, 24);
  }
  return s;
}

/**
 * A ribbed butterfly egg, `r` px (half its height) at `px` device px per unit; `crack` 0..1 draws the
 * crack, `tint` its colour, `rock` tilts it on its base.
 */
export function drawEgg(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tint: string, crack = 0, rock = 0, px = 1): void {
  ctx.save();
  ctx.translate(x, y + r);
  ctx.rotate(rock);
  ctx.translate(0, -r);
  const s = eggSprite(tint, Math.max(4, Math.ceil(r * px))), k = r / s.R;
  ctx.drawImage(s.c, -(s.R + 2) * k, -(s.R + 2) * k, s.c.width * k, s.c.height * k);
  if (crack > 0) {
    ctx.strokeStyle = 'rgba(40,30,20,.85)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    const pts = 7, reach = Math.min(1, crack);
    for (let i = 0; i <= pts * reach; i++) {
      const cx = -r * 0.62 + (i / pts) * r * 1.24, cy = -r * 0.2 + (i % 2 ? -r * 0.12 : r * 0.1);
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
