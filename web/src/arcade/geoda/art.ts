/**
 * Geoda's procedural art, shared by the game, the lobby picture and the cabinet tiles: faceted gem
 * tiles in five cuts (so the minerals differ without colour) and three clarities (mleczny is
 * opaque and pastel, czysty transparent with refraction lines, lśniący lit from inside), rock and
 * slate cells, the geode's rough rim with its crust (a rounded square around the square wall, every
 * layer clear of its corners), druses for the cave and the tray's seeds, and the nine cabinet
 * specimens.  Paths and gradients only; the cell tiles are cached as small sprites per size.
 */
import { GEMS, MINERALS, type Pt } from './content';
import type { Clarity } from './wall';

export const TAU = Math.PI * 2;
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const MONO = '"JetBrains Mono", monospace';

// ── colour and small helpers ────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** `a` → `b` by t, as a CSS colour. */
export function mix(a: string, b: string, t: number, alpha = 1): string {
  const x = rgb(a), y = rgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return alpha >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
}

export const rgba = (hex: string, a: number): string => mix(hex, hex, 0, a);

/** Stable pseudo-random numbers for decoration (0..1). */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A rounded rectangle added to the current path (clockwise), without starting a new one. */
export function rrectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  rrectPath(ctx, x, y, w, h, r);
}

function poly(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Light from the top left: a facet facing angle `a` (radians, screen axes) gets lit or shaded. */
function shadeFacet(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], a: number, k: number): void {
  const s = Math.cos(a - (-3 * Math.PI) / 4);
  ctx.fillStyle = s > 0 ? `rgba(255,255,255,${(k * s).toFixed(3)})` : `rgba(0,0,0,${(k * -s * 1.1).toFixed(3)})`;
  poly(ctx, pts);
  ctx.fill();
}

/** A four-pointed sparkle. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#fff'): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// ── cell tiles ──────────────────────────────────────────────────

/** A gem cell in the square (x, y, s): the mineral's cut, its clarity. */
export function drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, gem: number, clarity: Clarity): void {
  const g = GEMS[gem % GEMS.length];
  const p = s * 0.055, w = s - 2 * p, r = s * 0.16;
  const x0 = x + p, y0 = y + p, x1 = x0 + w, y1 = y0 + w, cx = x + s / 2, cy = y + s / 2;
  const milky = clarity === 1;
  // the cell's shadow on the wall
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = s * 0.12;
  ctx.shadowOffsetY = s * 0.05;
  rrect(ctx, x0, y0, w, w, r);
  ctx.fillStyle = g.dark;
  ctx.fill();
  ctx.restore();
  ctx.save();
  rrect(ctx, x0, y0, w, w, r);
  ctx.clip();
  const base = ctx.createLinearGradient(x0, y0, x1, y1);
  if (milky) {
    base.addColorStop(0, mix(g.light, '#ffffff', 0.2));
    base.addColorStop(0.55, mix(g.base, '#ffffff', 0.3));
    base.addColorStop(1, mix(g.base, g.dark, 0.35));
  } else {
    base.addColorStop(0, g.light);
    base.addColorStop(0.4, g.base);
    base.addColorStop(1, g.dark);
  }
  ctx.fillStyle = base;
  ctx.fillRect(x0, y0, w, w);
  const k = milky ? 0.2 : 0.36;
  switch (g.facet) {
    case 'point': {
      // a crystal tip from above: a hexagonal table and six facets running out to the cell's edge
      const rh = w * 0.2;
      const hex = Array.from({ length: 6 }, (_, i) => [cx + Math.cos((i * TAU) / 6) * rh, cy + Math.sin((i * TAU) / 6) * rh * 0.92] as const);
      const out = [[x1, cy], [x1, y1], [x0, y1], [x0, cy], [x0, y0], [x1, y0]] as const;
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        shadeFacet(ctx, [hex[i], hex[j], out[j], out[i]], ((i + 0.5) * TAU) / 6, k);
      }
      shadeFacet(ctx, hex, -3 * Math.PI / 4, k * 0.35);
      break;
    }
    case 'step': {
      // a step cut: two concentric steps, each lit from the top left
      for (const [a, b] of [[0, 0.14], [0.14, 0.28]] as const) {
        const o = [x0 + w * a, y0 + w * a, x1 - w * a, y1 - w * a], n = [x0 + w * b, y0 + w * b, x1 - w * b, y1 - w * b];
        shadeFacet(ctx, [[o[0], o[1]], [o[2], o[1]], [n[2], n[1]], [n[0], n[1]]], -Math.PI / 2, k);
        shadeFacet(ctx, [[o[2], o[1]], [o[2], o[3]], [n[2], n[3]], [n[2], n[1]]], 0, k);
        shadeFacet(ctx, [[o[2], o[3]], [o[0], o[3]], [n[0], n[3]], [n[2], n[3]]], Math.PI / 2, k);
        shadeFacet(ctx, [[o[0], o[3]], [o[0], o[1]], [n[0], n[1]], [n[0], n[3]]], Math.PI, k);
      }
      break;
    }
    case 'prism': {
      // an emerald cut: an octagonal table, eight facets, the long prism's striations
      const t = w * 0.22, c = w * 0.1;
      const tab = [[x0 + t + c, y0 + t], [x1 - t - c, y0 + t], [x1 - t, y0 + t + c], [x1 - t, y1 - t - c], [x1 - t - c, y1 - t], [x0 + t + c, y1 - t], [x0 + t, y1 - t - c], [x0 + t, y0 + t + c]] as const;
      const out = [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]] as const;
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        shadeFacet(ctx, [tab[i], tab[j], out[j], out[i]], -Math.PI / 2 + ((i + 0.5) * TAU) / 8 - TAU / 16, k);
      }
      ctx.strokeStyle = `rgba(255,255,255,${milky ? 0.1 : 0.18})`;
      ctx.lineWidth = Math.max(0.6, s * 0.012);
      for (const f of [0.38, 0.5, 0.62]) {
        ctx.beginPath();
        ctx.moveTo(x0 + w * f, y0 + t + c * 0.5);
        ctx.lineTo(x0 + w * f, y1 - t - c * 0.5);
        ctx.stroke();
      }
      break;
    }
    case 'cabochon': {
      // a polished dome: soft light, a crescent highlight, no facets
      const dome = ctx.createRadialGradient(x0 + w * 0.36, y0 + w * 0.3, w * 0.04, cx, cy, w * 0.75);
      dome.addColorStop(0, `rgba(255,255,255,${milky ? 0.5 : 0.42})`);
      dome.addColorStop(0.45, 'rgba(255,255,255,0)');
      dome.addColorStop(1, `rgba(0,0,0,${milky ? 0.14 : 0.3})`);
      ctx.fillStyle = dome;
      ctx.fillRect(x0, y0, w, w);
      ctx.strokeStyle = `rgba(255,255,255,${milky ? 0.35 : 0.5})`;
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.33, Math.PI * 1.08, Math.PI * 1.42);
      ctx.stroke();
      break;
    }
    case 'banded': {
      // malachite's bands, cut and polished
      const ox = x0 - w * 0.25, oy = y1 + w * 0.2;
      for (let i = 12; i >= 1; i--) {
        ctx.fillStyle = i % 2 ? mix(g.dark, g.base, milky ? 0.75 : 0.35) : milky ? mix(g.light, '#ffffff', 0.2) : g.base;
        ctx.beginPath();
        ctx.arc(ox, oy, w * 0.13 * i, 0, TAU);
        ctx.fill();
      }
      const gloss = ctx.createLinearGradient(x0, y0, x0 + w * 0.6, y0 + w * 0.6);
      gloss.addColorStop(0, 'rgba(255,255,255,0.32)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gloss;
      ctx.fillRect(x0, y0, w, w);
      break;
    }
  }
  if (milky) {
    // milky: a pale, opaque film over the stone
    const film = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
    film.addColorStop(0, 'rgba(255,255,255,0.2)');
    film.addColorStop(1, 'rgba(255,255,255,0.04)');
    ctx.fillStyle = film;
    ctx.fillRect(x0, y0, w, w);
  } else {
    // clear: depth in the middle and refraction lines across it
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.55);
    core.addColorStop(0, clarity === 3 ? rgba(g.light, 0.55) : 'rgba(0,0,0,0.16)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.fillRect(x0, y0, w, w);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(0.6, s * 0.014);
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.62, y0);
    ctx.lineTo(x0, y0 + w * 0.62);
    ctx.moveTo(x1, y0 + w * 0.3);
    ctx.lineTo(x0 + w * 0.3, y1);
    ctx.stroke();
  }
  if (clarity === 3) {
    // lśniący: an inner light
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
    glow.addColorStop(0, rgba(g.light, 0.75));
    glow.addColorStop(0.5, rgba(g.base, 0.25));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x0, y0, w, w);
    ctx.globalCompositeOperation = 'source-over';
    sparkle(ctx, x0 + w * 0.27, y0 + w * 0.27, w * 0.13, 'rgba(255,255,255,0.95)');
  }
  ctx.restore();
  // the rim: a crisp edge, light on the top left
  rrect(ctx, x0 + 0.5, y0 + 0.5, w - 1, w - 1, r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.save();
  rrect(ctx, x0 + 1.5, y0 + 1.5, w - 3, w - 3, r * 0.85);
  ctx.clip();
  ctx.strokeStyle = `rgba(255,255,255,${milky ? 0.4 : 0.55})`;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(x0 + 1.5, y1 - r);
  ctx.lineTo(x0 + 1.5, y0 + r);
  ctx.arcTo(x0 + 1.5, y0 + 1.5, x0 + r, y0 + 1.5, r * 0.85);
  ctx.lineTo(x1 - r, y0 + 1.5);
  ctx.stroke();
  ctx.restore();
}

/** Dark slate in a few tones (top, bottom): the wall's rock, so the crystals glow against it. */
const ROCK_TONES = [
  ['#403848', '#24202a'], ['#3b3542', '#211d27'], ['#453c48', '#28222c'], ['#39333f', '#1f1b24'],
  ['#3f3a47', '#25212b'], ['#433945', '#27212a'], ['#3a3644', '#201d28'], ['#413a43', '#262028'],
] as const;
export const ROCK_VARIANTS = ROCK_TONES.length;

/** A rock cell: a hewn block of dark slate, grained, now and then a quartz vein or a hairline crack. */
export function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, v: number): void {
  const p = s * 0.035, w = s - 2 * p, r = s * 0.13;
  const [top, bot] = ROCK_TONES[v % ROCK_TONES.length];
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = s * 0.08;
  ctx.shadowOffsetY = s * 0.035;
  rrect(ctx, x + p, y + p, w, w, r);
  ctx.fillStyle = bot;
  ctx.fill();
  ctx.restore();
  ctx.save();
  rrect(ctx, x + p, y + p, w, w, r);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + s * 0.5, y + s);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  // mottles, then the grain
  for (let i = 0; i < 3; i++) {
    const mx = x + p + hash(v * 13 + i * 2.7) * w, my = y + p + hash(v * 29 + i * 4.1) * w, mr = s * (0.25 + hash(v + i) * 0.25);
    const m = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
    m.addColorStop(0, i % 2 ? 'rgba(0,0,0,0.16)' : 'rgba(200,190,230,0.05)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = m;
    ctx.fillRect(x, y, s, s);
  }
  for (let i = 0; i < 34; i++) {
    const hx = hash(v * 97 + i), hy = hash(v * 53 + i * 7.3), hr = hash(v * 11 + i * 3.1);
    ctx.fillStyle = hr > 0.6 ? 'rgba(230,220,255,0.07)' : 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(x + p + hx * w, y + p + hy * w, s * (0.007 + hr * 0.016), 0, TAU);
    ctx.fill();
  }
  // a hewn face: the block is a touch lighter where the chisel left it flat
  ctx.fillStyle = 'rgba(255,255,255,0.022)';
  poly(ctx, [[x + s * (0.16 + hash(v) * 0.06), y + s * 0.15], [x + s * (0.82 - hash(v + 1) * 0.06), y + s * 0.18],
    [x + s * 0.84, y + s * (0.78 - hash(v + 2) * 0.08)], [x + s * 0.2, y + s * 0.83]]);
  ctx.fill();
  if (v % 4 === 1) {
    // a thin vein of quartz
    ctx.strokeStyle = 'rgba(214,198,255,0.17)';
    ctx.lineWidth = Math.max(0.8, s * 0.022);
    ctx.beginPath();
    ctx.moveTo(x + p, y + s * (0.25 + hash(v) * 0.5));
    ctx.bezierCurveTo(x + s * 0.35, y + s * (0.2 + hash(v + 5) * 0.6), x + s * 0.65, y + s * (0.2 + hash(v + 6) * 0.6), x + s - p, y + s * (0.3 + hash(v + 3) * 0.4));
    ctx.stroke();
  } else if (v % 4 === 3) {
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = Math.max(0.7, s * 0.014);
    ctx.beginPath();
    ctx.moveTo(x + s * (0.25 + hash(v) * 0.3), y + p);
    ctx.lineTo(x + s * (0.38 + hash(v + 2) * 0.2), y + s * 0.4);
    ctx.lineTo(x + s * (0.3 + hash(v + 1) * 0.3), y + s * 0.62);
    ctx.stroke();
  }
  ctx.restore();
  // the block's bevel: light on the top left, shadow on the bottom right
  ctx.save();
  rrect(ctx, x + p, y + p, w, w, r);
  ctx.clip();
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.strokeStyle = 'rgba(255,250,255,0.13)';
  ctx.beginPath();
  ctx.moveTo(x + p, y + s - p);
  ctx.lineTo(x + p, y + p);
  ctx.lineTo(x + s - p, y + p);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.moveTo(x + s - p, y + p);
  ctx.lineTo(x + s - p, y + s - p);
  ctx.lineTo(x + p, y + s - p);
  ctx.stroke();
  ctx.restore();
}

/** An empty socket in the wall: a recessed hollow, darker than the slate, a few grains of druse. */
export function drawSlate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, v: number): void {
  const p = s * 0.05, w = s - 2 * p, r = s * 0.14;
  ctx.save();
  rrect(ctx, x + p, y + p, w, w, r);
  ctx.fillStyle = '#0d0a12';
  ctx.fill();
  ctx.clip();
  const shade = ctx.createLinearGradient(0, y + p, 0, y + p + w * 0.6);
  shade.addColorStop(0, 'rgba(0,0,0,0.75)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, s, s);
  const glow = ctx.createRadialGradient(x + s * 0.5, y + s * 0.85, 0, x + s * 0.5, y + s * 0.85, s * 0.65);
  glow.addColorStop(0, 'rgba(150,105,230,0.13)');
  glow.addColorStop(1, 'rgba(150,105,230,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, s, s);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `rgba(214,190,255,${(0.14 + hash(v * 31 + i) * 0.2).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x + p + w * (0.15 + 0.7 * hash(v * 17 + i * 5)), y + p + w * (0.5 + 0.42 * hash(v * 23 + i * 3)), Math.max(0.6, s * 0.013), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // the hollow's lower lip catches a little light
  ctx.save();
  rrect(ctx, x + p + 0.5, y + p + 0.5, w - 1, w - 1, r);
  ctx.clip();
  ctx.strokeStyle = 'rgba(190,160,255,0.12)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(x + p + r, y + s - p - 0.5);
  ctx.lineTo(x + s - p - r, y + s - p - 0.5);
  ctx.stroke();
  ctx.restore();
}

/** Cell tiles cached as sprites (with room for their shadow), per size and pixel ratio. */
export class TileCache {
  private readonly map = new Map<string, HTMLCanvasElement>();
  private dpr = 1;

  setDpr(dpr: number): void {
    if (dpr !== this.dpr) this.map.clear();
    this.dpr = dpr;
  }

  /** The sprite and the margin around the tile inside it (CSS px). */
  get(kind: 'gem' | 'rock' | 'slate', a: number, b: number, s: number): { img: HTMLCanvasElement; m: number } {
    const size = Math.round(s * 4) / 4;
    const key = `${kind}:${a}:${b}:${size}`;
    const m = Math.ceil(size * 0.2);
    let img = this.map.get(key);
    if (!img) {
      img = document.createElement('canvas');
      img.width = Math.ceil((size + 2 * m) * this.dpr);
      img.height = img.width;
      const c = img.getContext('2d')!;
      c.scale(this.dpr, this.dpr);
      if (kind === 'gem') drawGem(c, m, m, size, a, b as Clarity);
      else if (kind === 'rock') drawRock(c, m, m, size, a);
      else drawSlate(c, m, m, size, a);
      this.map.set(key, img);
    }
    return { img, m };
  }

  draw(ctx: CanvasRenderingContext2D, kind: 'gem' | 'rock' | 'slate', a: number, b: number, x: number, y: number, s: number): void {
    const { img, m } = this.get(kind, a, b, s);
    ctx.drawImage(img, x - m, y - m, s + 2 * m, s + 2 * m);
  }

  /** The tile of size `s` scaled by `k` around its centre (pops, growth) without new sprites. */
  drawScaled(ctx: CanvasRenderingContext2D, kind: 'gem' | 'rock' | 'slate', a: number, b: number, x: number, y: number, s: number, k: number): void {
    if (Math.abs(k - 1) < 0.001) {
      this.draw(ctx, kind, a, b, x, y, s);
      return;
    }
    const { img, m } = this.get(kind, a, b, s);
    const half = (s / 2 + m) * k;
    ctx.drawImage(img, x + s / 2 - half, y + s / 2 - half, half * 2, half * 2);
  }
}

// ── the geode ───────────────────────────────────────────────────

interface Box { x: number; y: number; w: number; h: number }

/** How far the geode reaches beyond the wall, in units of its rim; the seed of its outline's wobble. */
export const GEODE_REACH = 2.6;
export const GEODE_SEED = 1.7;
/** The wall's dark bed reaches this far beyond its cells (px), with corners of 8 px. */
export const WALL_BED = 3;
/**
 * The corner radius of each layer of the geode, in units of its distance from the wall: at 2 every
 * layer clears the wall's corners by 0.59 of that distance (√2·d − (√2 − 1)·2d), so no band or
 * crust slips under the square wall.
 */
const ROUND = 2;

/** A point of a rounded square and its outward normal [x, y, nx, ny] (reused: no garbage per point). */
const pt = [0, 0, 0, 0];

function side(px: number, py: number, nx: number, ny: number): number[] {
  pt[0] = px;
  pt[1] = py;
  pt[2] = nx;
  pt[3] = ny;
  return pt;
}

const corner = (cx: number, cy: number, R: number, a: number): number[] => side(cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.cos(a), Math.sin(a));

/** The point `s` px clockwise along a rounded square (x, y, w, h, corner radius R) from its top edge's left end. */
function alongRoundedSquare(x: number, y: number, w: number, h: number, R: number, s: number): number[] {
  const sw = w - 2 * R, sh = h - 2 * R, arc = (Math.PI / 2) * R;
  if (s < sw) return side(x + R + s, y, 0, -1);
  if ((s -= sw) < arc) return corner(x + w - R, y + R, R, -Math.PI / 2 + s / R);
  if ((s -= arc) < sh) return side(x + w, y + R + s, 1, 0);
  if ((s -= sh) < arc) return corner(x + w - R, y + h - R, R, s / R);
  if ((s -= arc) < sw) return side(x + w - R - s, y + h, 0, 1);
  if ((s -= sw) < arc) return corner(x + R, y + h - R, R, Math.PI / 2 + s / R);
  if ((s -= arc) < sh) return side(x, y + h - R - s, -1, 0);
  return corner(x + R, y + R, R, Math.PI + Math.min(arc, s - sh) / R);
}

/**
 * The geode's outline `d` px around the wall: a rounded square (see ROUND) with `rough` px of
 * wobble along its normal; a new path, clockwise.
 */
export function geodePath(ctx: CanvasRenderingContext2D, wall: Box, d: number, rough: number, seed: number): void {
  const x0 = wall.x - d, y0 = wall.y - d, w = wall.w + 2 * d, h = wall.h + 2 * d;
  const R = Math.max(1, Math.min(ROUND * d, w / 2, h / 2));
  const per = 2 * (w + h - 4 * R) + 2 * Math.PI * R;
  const n = Math.round(Math.min(240, Math.max(64, per / 7)));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = u * TAU;
    const [px, py, nx, ny] = alongRoundedSquare(x0, y0, w, h, R, (u % 1) * per);
    const wob = rough * (0.55 * Math.sin(a * 5 + seed) + 0.3 * Math.sin(a * 11 + seed * 2.3) + 0.15 * Math.sin(a * 23 + seed * 0.7));
    if (i) ctx.lineTo(px + nx * wob, py + ny * wob); else ctx.moveTo(px + nx * wob, py + ny * wob);
  }
  ctx.closePath();
}

/**
 * The geode around the wall, from the outside in: a rough rind of warm grey stone lit from the
 * top left, thin bands of chalcedony, a crust of violet crystal points growing inward, and the
 * wall's dark bed.  `rim` sets its thickness (it reaches GEODE_REACH × rim beyond the wall).
 */
export function drawGeode(ctx: CanvasRenderingContext2D, wall: Box, rim: number, seed = GEODE_SEED): void {
  const outline = (d: number, rough: number, sd = seed) => geodePath(ctx, wall, d, rough, sd);
  const reach = rim * GEODE_REACH;
  // the rind
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = rim * 2.4;
  ctx.shadowOffsetY = rim * 0.6;
  outline(reach, rim * 0.5);
  const g = ctx.createLinearGradient(wall.x - reach, wall.y - reach, wall.x + wall.w * 0.4, wall.y + wall.h + reach);
  g.addColorStop(0, '#5e5046');
  g.addColorStop(0.45, '#4a4038');
  g.addColorStop(1, '#2a221e');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // everything inside stays inside the rind (a wobbling band meets its edge instead of crossing it)
  ctx.save();
  outline(reach, rim * 0.5);
  ctx.clip();
  // the rind's grain, scattered around its ring
  for (let i = 0; i < 240; i++) {
    const d = rim * 1.7 + hash(i * 9.1) * (reach - rim * 1.5), w = wall.w + 2 * d, h = wall.h + 2 * d, R = Math.min(ROUND * d, w / 2, h / 2);
    const [px, py] = alongRoundedSquare(wall.x - d, wall.y - d, w, h, R, hash(i * 3.7) * (2 * (w + h - 4 * R) + 2 * Math.PI * R));
    ctx.fillStyle = hash(i) > 0.55 ? 'rgba(255,236,214,0.08)' : 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(px, py, 0.8 + hash(i * 1.3) * rim * 0.16, 0, TAU);
    ctx.fill();
  }
  // light on the rind's top-left edge
  outline(reach, rim * 0.5);
  const lit = ctx.createLinearGradient(wall.x - reach, wall.y - reach, wall.x + wall.w * 0.6, wall.y + wall.h * 0.6);
  lit.addColorStop(0, 'rgba(255,236,214,0.22)');
  lit.addColorStop(1, 'rgba(255,236,214,0)');
  ctx.strokeStyle = lit;
  ctx.lineWidth = rim * 0.35;
  ctx.stroke();
  // chalcedony: thin pale and dark bands between the rind and the crystals
  for (const [d, col, lw] of [[rim * 1.62, 'rgba(214,206,232,0.3)', rim * 0.16], [rim * 1.42, 'rgba(98,80,128,0.75)', rim * 0.2], [rim * 1.22, 'rgba(226,218,246,0.4)', rim * 0.11]] as const) {
    outline(d, rim * 0.32, seed + 0.4);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  // the crust: violet points growing toward the middle
  ctx.save();
  outline(rim * 1.12, rim * 0.22, seed + 1);
  const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
  const crust = ctx.createRadialGradient(cx, cy, wall.w * 0.42, cx, cy, wall.w * 0.72);
  crust.addColorStop(0, '#20162f');
  crust.addColorStop(1, '#3d2860');
  ctx.fillStyle = crust;
  ctx.fill();
  ctx.clip();
  const sides: [number, number, number, number, number, number][] = [
    // start x, y, along dx, dy, inward nx, ny
    [wall.x, wall.y - rim * 1.05, 1, 0, 0, 1], [wall.x, wall.y + wall.h + rim * 1.05, 1, 0, 0, -1],
    [wall.x - rim * 1.05, wall.y, 0, 1, 1, 0], [wall.x + wall.w + rim * 1.05, wall.y, 0, 1, -1, 0],
  ];
  for (const [sx, sy, dx, dy, nx, ny] of sides) {
    const len = dx ? wall.w : wall.h, n = Math.ceil(len / (rim * 0.36));
    for (let i = -2; i <= n + 2; i++) {
      const k = i * 7.13 + sx * 0.01 + sy * 0.017;
      const along = (i + hash(k) * 0.6) * (len / n);
      const bx = sx + dx * along, by = sy + dy * along;
      const L = rim * (0.45 + 0.55 * hash(k + 1)), W = rim * (0.2 + 0.12 * hash(k + 2));
      const tx = bx + nx * L + dx * (hash(k + 3) - 0.5) * W, ty = by + ny * L + dy * (hash(k + 3) - 0.5) * W;
      const shade = hash(k + 4);
      ctx.fillStyle = shade > 0.75 ? '#c9b2f2' : shade > 0.4 ? '#8a62cf' : '#5b3d93';
      poly(ctx, [[bx - dx * W, by - dy * W], [tx, ty], [bx, by]]);
      ctx.fill();
      ctx.fillStyle = shade > 0.75 ? '#a58ad8' : shade > 0.4 ? '#6a49a8' : '#432c70';
      poly(ctx, [[bx, by], [tx, ty], [bx + dx * W, by + dy * W]]);
      ctx.fill();
      if (hash(k + 5) > 0.9) sparkle(ctx, tx, ty, rim * 0.22, 'rgba(255,255,255,0.85)');
    }
  }
  ctx.restore();
  ctx.restore();
  // the wall's bed
  rrect(ctx, wall.x - WALL_BED, wall.y - WALL_BED, wall.w + 2 * WALL_BED, wall.h + 2 * WALL_BED, 8);
  ctx.fillStyle = '#0b0810';
  ctx.fill();
}

// ── specimens ───────────────────────────────────────────────────

/** A hexagonal prism with a pointed tip, from its base (bx, by), `len` long, tilted `a` from vertical. */
function prism(ctx: CanvasRenderingContext2D, bx: number, by: number, len: number, wid: number, a: number, c: readonly [string, string, string], tip = 0.28): void {
  const dx = Math.sin(a), dy = -Math.cos(a), nx = -dy, ny = dx;
  const body = len * (1 - tip);
  const P = (along: number, across: number): Pt => [bx + dx * along + nx * across, by + dy * along + ny * across];
  const left: Pt[] = [P(0, -wid / 2), P(body, -wid / 2), P(len, 0), P(body, 0), P(0, 0)];
  const right: Pt[] = [P(0, 0), P(body, 0), P(len, 0), P(body, wid / 2), P(0, wid / 2)];
  const gl = ctx.createLinearGradient(...P(0, -wid / 2), ...P(len, 0));
  gl.addColorStop(0, c[1]);
  gl.addColorStop(1, c[0]);
  ctx.fillStyle = gl;
  poly(ctx, left);
  ctx.fill();
  const gr = ctx.createLinearGradient(...P(0, wid / 2), ...P(len, 0));
  gr.addColorStop(0, c[2]);
  gr.addColorStop(1, c[1]);
  ctx.fillStyle = gr;
  poly(ctx, right);
  ctx.fill();
  // the tip's facet edge and a highlight along the body
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(0.6, wid * 0.06);
  ctx.beginPath();
  ctx.moveTo(...P(body, -wid / 2));
  ctx.lineTo(...P(body, 0));
  ctx.lineTo(...P(body, wid / 2));
  ctx.moveTo(...P(wid * 0.3, -wid * 0.18));
  ctx.lineTo(...P(body * 0.92, -wid * 0.18));
  ctx.stroke();
}

/**
 * A druse in the cave: crystal points of mineral `m` fanning out of a dark stone at (x, y), `size`
 * long, growing at angle `dir` (0 = up, π = down from a ceiling, ±π/2 sideways) — the long ones in
 * front and lit, the short ones behind in shadow, a few grains at their foot.
 */
export function druse(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: number, m: number, seed: number): void {
  const c = MINERALS[m % MINERALS.length].colors;
  const shade: [string, string, string] = [mix(c[0], c[2], 0.45), mix(c[1], c[2], 0.5), c[2]];
  const n = 5 + Math.floor(hash(seed) * 3);
  const dx = Math.sin(dir), dy = -Math.cos(dir), nx = -dy, ny = dx;
  // the longest points near the middle of the fan, shorter ones at its sides, drawn back to front
  const points = Array.from({ length: n }, (_, i) => {
    const off = (i / (n - 1) - 0.5) * 2 + (hash(seed + i * 1.7) - 0.5) * 0.3;
    return { off, i, len: size * (1 - 0.5 * Math.abs(off)) * (0.62 + 0.45 * hash(seed + i * 2.3)) };
  }).sort((a, b) => a.len - b.len);
  points.forEach((p, k) => {
    const bx = x + nx * p.off * size * 0.26, by = y + ny * p.off * size * 0.26;
    prism(ctx, bx, by, p.len, size * (0.12 + 0.07 * hash(seed + p.i * 3.1)), dir + p.off * 0.42 + (hash(seed + p.i * 4.3) - 0.5) * 0.16, k < n / 2 ? shade : c);
  });
  // grains at the foot
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 1.15 + (hash(seed + i * 5.9) - 0.5) * 0.3;
    prism(ctx, x + nx * off * size * 0.3, y + ny * off * size * 0.3, size * (0.16 + 0.12 * hash(seed + i * 6.7)), size * 0.08, dir + off * 0.6, shade);
  }
  // the stone they grow from
  const sideways = Math.abs(dx) > 0.5;
  ctx.fillStyle = '#231d1a';
  ctx.beginPath();
  ctx.ellipse(x, y, size * (sideways ? 0.2 : 0.56), size * (sideways ? 0.56 : 0.2), 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,236,214,0.06)';
  ctx.beginPath();
  ctx.ellipse(x - size * 0.08, y - size * 0.05, size * (sideways ? 0.09 : 0.3), size * (sideways ? 0.3 : 0.09), 0, 0, TAU);
  ctx.fill();
}

/** A rough stone base under a specimen. */
function base(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, hh: number): void {
  ctx.fillStyle = '#3d342e';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, hh / 2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,236,214,0.08)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.1, cy - hh * 0.15, w * 0.32, hh * 0.25, 0, 0, TAU);
  ctx.fill();
}

/**
 * A cabinet specimen in a box centred at (cx, cy), `size` tall: the mineral's own habit (a cluster
 * of points, long prisms, cubes, an agate slice, an opal, malachite bubbles); the tier adds glow
 * and sparkle.  `t` animates the sparkle and the opal's play of colour.
 */
export function drawSpecimen(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, m: number, tier: number, t = 0): void {
  const mn = MINERALS[m % MINERALS.length];
  const c = mn.colors;
  if (tier >= 2) {
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.9);
    halo.addColorStop(0, tier >= 3 ? 'rgba(255,214,140,0.42)' : rgba(c[1], 0.32));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
  }
  const by = cy + size * 0.38;
  switch (mn.look) {
    case 'cluster': {
      base(ctx, cx, by, size * 0.9, size * 0.22);
      const fan: [number, number, number][] = [[-0.62, 0.5, 0.17], [0.58, 0.55, 0.17], [-0.3, 0.78, 0.2], [0.28, 0.72, 0.2], [0.02, 0.98, 0.24]];
      for (const [a, l, wd] of fan) prism(ctx, cx + a * size * 0.22, by - size * 0.04, l * size * 0.8, wd * size, a * 0.55, c);
      break;
    }
    case 'prisms': {
      base(ctx, cx, by, size * 0.8, size * 0.2);
      const col: [string, string, string] = m === 7 ? [c[0], c[1], c[2]] : c;
      for (const [a, l, wd, dx] of [[-0.2, 0.82, 0.17, -0.18], [0.12, 1.0, 0.2, 0.04], [0.32, 0.7, 0.15, 0.22]] as const) {
        prism(ctx, cx + dx * size, by - size * 0.04, l * size * 0.85, wd * size, a, col, 0.12);
        if (m === 7) {
          // watermelon tourmaline: a green root on a pink crystal
          const dxa = Math.sin(a), dya = -Math.cos(a);
          ctx.strokeStyle = rgba(c[2], 0.85);
          ctx.lineWidth = wd * size * 0.9;
          ctx.beginPath();
          ctx.moveTo(cx + dx * size, by - size * 0.04);
          ctx.lineTo(cx + dx * size + dxa * size * 0.18, by - size * 0.04 + dya * size * 0.18);
          ctx.stroke();
        }
      }
      break;
    }
    case 'cubes': {
      base(ctx, cx, by, size * 0.85, size * 0.2);
      const cube = (x: number, y: number, s: number) => {
        const h2 = s * 0.5;
        poly(ctx, [[x, y - h2], [x + s * 0.5, y - h2 - s * 0.28], [x + s, y - h2], [x + s * 0.5, y - h2 + s * 0.28]]);
        ctx.fillStyle = c[0];
        ctx.fill();
        poly(ctx, [[x, y - h2], [x + s * 0.5, y - h2 + s * 0.28], [x + s * 0.5, y + s * 0.28 + h2 * 0.4], [x, y + h2 * 0.4]]);
        ctx.fillStyle = c[1];
        ctx.fill();
        poly(ctx, [[x + s, y - h2], [x + s * 0.5, y - h2 + s * 0.28], [x + s * 0.5, y + s * 0.28 + h2 * 0.4], [x + s, y + h2 * 0.4]]);
        ctx.fillStyle = mix(c[1], c[2], 0.55);
        ctx.fill();
        ctx.strokeStyle = rgba(c[2], 0.9);
        ctx.lineWidth = Math.max(0.6, s * 0.04);
        ctx.stroke();
      };
      cube(cx - size * 0.42, by - size * 0.08, size * 0.42);
      cube(cx + size * 0.02, by - size * 0.06, size * 0.36);
      cube(cx - size * 0.2, by - size * 0.32, size * 0.5);
      break;
    }
    case 'bands': {
      // an agate slice
      const rx = size * 0.5, ry = size * 0.42;
      for (let i = 0; i < 7; i++) {
        const k = 1 - i * 0.13;
        ctx.fillStyle = [c[2], c[1], c[0], c[1], '#f3e6d8', c[2], c[0]][i];
        ctx.beginPath();
        for (let j = 0; j <= 40; j++) {
          const a = (j / 40) * TAU;
          const wob = 1 + 0.06 * Math.sin(a * 3 + i) + 0.04 * Math.sin(a * 5 + i * 2);
          const px = cx + Math.cos(a) * rx * k * wob, py = cy + Math.sin(a) * ry * k * wob;
          if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 0; i < 6; i++) sparkle(ctx, cx + (hash(i + m) - 0.5) * size * 0.16, cy + (hash(i * 3 + m) - 0.5) * size * 0.1, size * 0.03, 'rgba(255,255,255,0.8)');
      break;
    }
    case 'opal': {
      const rx = size * 0.48, ry = size * 0.36;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      ctx.fillStyle = c[0];
      ctx.fill();
      ctx.clip();
      const hues = ['#ff9ad5', '#9fe7ff', '#b4ff9a', '#ffd27a', '#c3a6ff', '#7af0d0'];
      for (let i = 0; i < 9; i++) {
        const px = cx + Math.cos(i * 2.4 + t * 0.4) * rx * 0.55 * hash(i + 2), py = cy + Math.sin(i * 1.7 + t * 0.3) * ry * 0.6 * hash(i + 5);
        const g = ctx.createRadialGradient(px, py, 0, px, py, size * 0.22);
        g.addColorStop(0, rgba(hues[i % hues.length], 0.7));
        g.addColorStop(1, rgba(hues[i % hues.length], 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      }
      const gloss = ctx.createLinearGradient(cx - rx, cy - ry, cx, cy);
      gloss.addColorStop(0, 'rgba(255,255,255,0.5)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gloss;
      ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      ctx.restore();
      break;
    }
    case 'botryoid': {
      base(ctx, cx, by, size * 0.9, size * 0.22);
      const blobs: [number, number, number][] = [[-0.26, 0.1, 0.24], [0.24, 0.12, 0.22], [0, -0.12, 0.28], [-0.12, 0.26, 0.18], [0.16, 0.3, 0.16]];
      for (const [dx, dy, r] of blobs) {
        const x = cx + dx * size, y = cy + dy * size, rr = r * size;
        for (let i = 5; i >= 1; i--) {
          ctx.fillStyle = i % 2 ? c[2] : i === 2 ? c[0] : c[1];
          ctx.beginPath();
          ctx.arc(x, y, (rr * i) / 5, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(x - rr * 0.35, y - rr * 0.4, rr * 0.28, rr * 0.16, -0.6, 0, TAU);
        ctx.fill();
      }
      break;
    }
  }
  // the tier's sparkle
  const n = tier >= 3 ? 3 : tier;
  for (let i = 0; i < n; i++) {
    const tw = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 2.1);
    sparkle(ctx, cx + (hash(i * 5 + 1) - 0.5) * size * 0.7, cy + (hash(i * 7 + 2) - 0.6) * size * 0.7, size * (0.07 + 0.03 * tw), tier >= 3 ? `rgba(255,232,170,${tw.toFixed(2)})` : `rgba(255,255,255,${tw.toFixed(2)})`);
  }
}

/** Text that fits `maxW`: the font shrinks down to `min` px. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, size: number, maxW: number, family: string, weight = 400, min = 10): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > min && ctx.measureText(text).width > maxW) {
    s = Math.max(min, s - 1);
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/** Words wrapped into lines no wider than `maxW` at the current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
