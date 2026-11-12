/**
 * Dziewiątka's pictures, drawn on the canvas in a picture-book way (flat colours, a soft plum ink
 * line, warm light): the town's street (sky, the bell tower far off, a row of houses whose windows
 * keep the band's history, the cobbles and each district's props), the nine heroes (chibi figures
 * with a prop each: Patience's millstone shield, Love's ribbon, Joy's lute and feather hat, Peace's
 * bowl of still water, Kindness's teapot, Goodness's bow of light, Faithfulness's pennant staff,
 * Gentleness's dandelion, Self-control's rapier), their faces for the portraits, the Din's shadows
 * (ink and static with comic faces, dissolving into quiet when hushed — never hurt), the bosses,
 * Klara with her handbell and notebook, the well, and the bell of Zacisze.  Every function draws at a
 * point with a scale `s` (px per u) and keeps no state.
 */
import { MIN_TEXT } from '../kit/mobile';
import type { TraceBar } from '../kit/trace';
import { HEROES, type ChapterSpec, type DinKind, type HeroId } from './content';

export const INK = '#2b2238';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
/** A canvas font, never under MIN_TEXT (11 px): anything smaller is a smudge on a phone at arm's length. */
export const font = (px: number, weight = 700, family = SANS): string => {
  const v = Math.round(px);
  return `${weight} ${v >= MIN_TEXT ? v : MIN_TEXT}px ${family}`;
};

export const C = {
  gold: '#ffc94a',
  goldLight: '#ffe7a3',
  cream: '#fff6e3',
  paper: '#fbf1dc',
  rest: '#8fc4ff',
  calm: '#bfe6ff',
  din: '#3b2e4f',
  dinLight: '#6d5c86',
  dinEdge: '#251c33',
  noise: 'rgba(70,58,92,',
  hp: '#7fd17f',
  hpLow: '#ff8f6b',
  energy: '#ffd25a',
};

const TAU = Math.PI * 2;

/** A stable pseudo-random number for an integer (0..1). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Each glow colour baked once into a small sprite (a radial gradient from opaque to clear): no gradient per frame. */
const glowSprites = new Map<string, HTMLCanvasElement | null>();
function glowSprite(rgb: string): HTMLCanvasElement | null {
  const had = glowSprites.get(rgb);
  if (had !== undefined) return had;
  let out: HTMLCanvasElement | null = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if (g) {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, `${rgb}1)`);
      gr.addColorStop(1, `${rgb}0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      out = c;
    }
  }
  glowSprites.set(rgb, out);
  return out;
}

/** A soft round glow (additive looks best: set the composite outside); `rgb` as "rgba(r,g,b,". */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  if (!(r > 0) || a <= 0) return;
  const sprite = glowSprite(rgb);
  if (sprite) {
    const was = ctx.globalAlpha;
    ctx.globalAlpha = was * Math.min(1, a);
    ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = was;
    return;
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${rgb}${a})`);
  g.addColorStop(1, `${rgb}0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** `n` five-pointed stars in a row centred on (cx, cy), each of outer radius `r`, gold with an ink edge (shapes, not glyphs: crisp at any size). */
export function paintStars(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, r: number, fill = '#f2b524'): void {
  if (n <= 0 || !(r > 0)) return;
  const step = r * 2.15;
  const x0 = cx - ((n - 1) * step) / 2;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = 'rgba(43,34,56,.75)';
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const x = x0 + k * step;
    for (let p = 0; p < 10; p++) {
      const a = -Math.PI / 2 + (p * Math.PI) / 5, rr = p % 2 ? r * 0.45 : r;
      if (p === 0) ctx.moveTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const shade = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

// ── the street ───────────────────────────────────────────────────
export interface StreetLook {
  chapter: ChapterSpec;
  tower: boolean;
  /** the band's history, one house per bar (oldest on the left) */
  bars: TraceBar[];
  /** the bell far off rings (0..1) and glows gold when Harmony is ready */
  bellSwing: number;
  bellGold: number;
  /** the rest's soft blue over everything (0..1), the Din's noise (0..1) */
  rest: number;
  noise: number;
  /** a blind block's fog over the newest houses (0..1) */
  fog: number;
}

/**
 * The street's still layers, painted once per size and district and then copied each frame (render.ts keeps
 * one): the sky with the sun and the far roofs (in the tower, its stone walls), and the cobbled street.  On a
 * phone the fill rate is what costs: two copies instead of the gradients, the glow and ~300 cobbles.
 */
export interface StreetCache {
  key: string;
  sky: HTMLCanvasElement | null;
  ground: HTMLCanvasElement | null;
  /** the sky layer's height and the ground layer's top (CSS px) */
  skyH: number;
  groundTop: number;
}

export const freshStreetCache = (): StreetCache => ({ key: '', sky: null, ground: null, skyH: 0, groundTop: 0 });

function buildStreetCache(c: StreetCache, key: string, w: number, h: number, groundY: number, fieldBottom: number, s: number, look: StreetLook, dpr: number): void {
  c.key = key;
  c.sky = c.ground = null;
  const baseY = groundY - s * 0.55;
  const skyH = Math.max(1, Math.min(h, Math.ceil(baseY) + 2));
  const groundTop = Math.max(0, Math.min(h - 1, Math.floor(baseY) - 1));
  const layer = (lh: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement | null => {
    const el = document.createElement('canvas');
    el.width = Math.max(1, Math.round(w * dpr));
    el.height = Math.max(1, Math.round(lh * dpr));
    const g = el.getContext('2d');
    if (!g) return null;
    paint(g);
    return el;
  };
  c.sky = layer(skyH, g => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintSky(g, w, skyH, groundY, s, look);
  });
  c.ground = layer(h - groundTop, g => {
    g.setTransform(dpr, 0, 0, dpr, 0, -groundTop * dpr);
    paintGround(g, w, h, groundY, fieldBottom, s, look);
  });
  c.skyH = skyH;
  c.groundTop = groundTop;
}

/**
 * The sky, the far roofs and the bell tower, the row of houses (their windows are the band's history:
 * gold above the threshold, cool blue in a calm rest, dark with a dotted sill without signal, fogged
 * while a blind block runs), the district's props and the cobbled street.  With a cache (and a document)
 * the still layers are copied from it; without one (the intro, the lobby's art) everything is painted.
 */
export function paintStreet(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, fieldBottom: number, s: number, t: number, look: StreetLook, x0: number,
  cache?: StreetCache, dpr = 1): void {
  const ch = look.chapter;
  let cached = false;
  if (cache && typeof document !== 'undefined') {
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}|${groundY.toFixed(1)}|${fieldBottom.toFixed(1)}|${s.toFixed(2)}|${ch.id}|${look.tower ? 1 : 0}`;
    if (cache.key !== key) buildStreetCache(cache, key, w, h, groundY, fieldBottom, s, look, dpr);
    cached = !!(cache.sky && cache.ground);
  }
  if (cached && cache?.sky) ctx.drawImage(cache.sky, 0, 0, w, cache.skyH);
  else paintSky(ctx, w, h, groundY, s, look);
  if (look.tower) paintRopes(ctx, w, groundY, s, t);
  else {
    paintBirds(ctx, w, groundY, s, t);
    paintBellTower(ctx, w * (ch.id === 'plac' ? 0.8 : 0.9), groundY - s * 0.6, s * (ch.id === 'plac' ? 1.25 : 0.8), look.bellSwing, look.bellGold, t);
  }
  paintHouses(ctx, w, groundY, s, look, t);
  paintProps(ctx, w, groundY, s, ch, look.tower, t, x0);
  if (cached && cache?.ground) ctx.drawImage(cache.ground, 0, cache.groundTop, w, h - cache.groundTop);
  else paintGround(ctx, w, h, groundY, fieldBottom, s, look);
  // the rest's calm tint and the Din's noise drifting over the right of the street
  if (look.rest > 0.01) {
    ctx.fillStyle = `rgba(120,170,230,${0.16 * look.rest})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (look.noise > 0.01) paintNoise(ctx, w * 0.45, 0, w * 0.55, groundY + s * 0.2, look.noise, t);
}

/** The still sky: its gradient over `h`, a warm sun low on the left and the far roofs (in the tower: its stone walls). */
function paintSky(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, s: number, look: StreetLook): void {
  const ch = look.chapter;
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  if (look.tower) {
    sky.addColorStop(0, '#3d3346');
    sky.addColorStop(1, '#6a5560');
  } else {
    sky.addColorStop(0, ch.sky[0]);
    sky.addColorStop(1, ch.sky[1]);
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  if (look.tower) {
    paintTowerInside(ctx, w, groundY, s);
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, w * 0.14, groundY * 0.42, Math.max(w, groundY) * 0.32, 'rgba(255,236,190,', 0.35);
  ctx.restore();
  paintFarRoofs(ctx, w, groundY, s, ch.wall);
}

/** The still street: its gradient from the curb down, the curb and the cobbles. */
function paintGround(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, fieldBottom: number, s: number, look: StreetLook): void {
  const ch = look.chapter;
  const st = ctx.createLinearGradient(0, groundY - s * 0.55, 0, fieldBottom + 10);
  st.addColorStop(0, shade(look.tower ? '#8a7a72' : ch.ground, 0.12));
  st.addColorStop(1, shade(look.tower ? '#6d5f58' : ch.ground, -0.18));
  ctx.fillStyle = st;
  ctx.fillRect(0, groundY - s * 0.55, w, h - (groundY - s * 0.55));
  ctx.fillStyle = 'rgba(43,34,56,.18)';
  ctx.fillRect(0, groundY - s * 0.58, w, Math.max(2, s * 0.05));
  ctx.strokeStyle = 'rgba(43,34,56,.12)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  const rowH = Math.max(6, s * 0.16);
  for (let r = 0, y = groundY - s * 0.48; y < Math.min(h, fieldBottom + s); r++, y += rowH) {
    const cw = Math.max(10, s * 0.34) * (1 + r * 0.06);
    for (let x = (r % 2) * cw * 0.5 - cw; x < w + cw; x += cw) {
      ctx.beginPath();
      ctx.ellipse(x, y, cw * 0.42, rowH * 0.36, 0, 0, TAU);
      ctx.stroke();
    }
  }
}

/** A few birds crossing the sky. */
function paintBirds(ctx: CanvasRenderingContext2D, w: number, groundY: number, s: number, t: number): void {
  const base = groundY - s * 2.6;
  ctx.strokeStyle = 'rgba(43,34,56,.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const bx = ((t * 12 + i * 170) % (w + 60)) - 30, by = base - s * (2.2 + i * 0.35) + Math.sin(t * 2 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(bx - 5, by);
    ctx.quadraticCurveTo(bx - 2, by - 3, bx, by);
    ctx.quadraticCurveTo(bx + 2, by - 3, bx + 5, by);
    ctx.stroke();
  }
}

function paintFarRoofs(ctx: CanvasRenderingContext2D, w: number, groundY: number, s: number, wall: string): void {
  ctx.fillStyle = shade(wall, 0.45);
  ctx.globalAlpha = 0.55;
  const base = groundY - s * 2.6;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0, i = 0; x <= w + 40; i++) {
    const bw = s * (0.9 + hash(i) * 0.9);
    const bh = s * (0.8 + hash(i + 40) * 1.2);
    ctx.lineTo(x, base - bh + s * 0.4);
    ctx.lineTo(x + bw * 0.5, base - bh - s * 0.35);
    ctx.lineTo(x + bw, base - bh + s * 0.4);
    x += bw;
  }
  ctx.lineTo(w, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** The bell tower, far off: an arched belfry with the bell, swinging when it rings, golden when Harmony waits. */
export function paintBellTower(ctx: CanvasRenderingContext2D, x: number, groundY: number, s: number, swing: number, gold: number, t: number): void {
  const tw = s * 1.3, th = s * 5.2;
  const top = groundY - th;
  ctx.fillStyle = '#c9a98a';
  ctx.strokeStyle = 'rgba(43,34,56,.45)';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.rect(x - tw / 2, top + s * 0.9, tw, th - s * 0.9);
  ctx.fill();
  ctx.stroke();
  // the belfry
  ctx.fillStyle = '#b38f72';
  ctx.beginPath();
  ctx.rect(x - tw * 0.6, top + s * 0.2, tw * 1.2, s * 1.1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a2e3e';
  ctx.beginPath();
  ctx.moveTo(x - tw * 0.32, top + s * 1.25);
  ctx.lineTo(x - tw * 0.32, top + s * 0.62);
  ctx.arc(x, top + s * 0.62, tw * 0.32, Math.PI, 0);
  ctx.lineTo(x + tw * 0.32, top + s * 1.25);
  ctx.closePath();
  ctx.fill();
  // the roof
  ctx.fillStyle = '#8a4b3c';
  ctx.beginPath();
  ctx.moveTo(x - tw * 0.72, top + s * 0.25);
  ctx.lineTo(x, top - s * 1.1);
  ctx.lineTo(x + tw * 0.72, top + s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // the bell
  const a = Math.sin(t * 7) * 0.35 * swing;
  ctx.save();
  ctx.translate(x, top + s * 0.42);
  ctx.rotate(a);
  if (gold > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, s * 0.35, s * 1.4, 'rgba(255,214,120,', 0.5 * gold);
    ctx.restore();
  }
  paintBellShape(ctx, 0, 0, s * 0.42, gold > 0.5 ? '#ffd35c' : '#d9a441', INK);
  ctx.restore();
}

/** A bell's outline (crown at `y`, mouth below), filled. */
export function paintBellShape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, ink: string): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.18, y);
  ctx.quadraticCurveTo(x - r * 0.62, y + r * 0.1, x - r * 0.66, y + r * 0.85);
  ctx.quadraticCurveTo(x - r * 0.72, y + r * 1.2, x - r * 1.0, y + r * 1.35);
  ctx.lineTo(x + r * 1.0, y + r * 1.35);
  ctx.quadraticCurveTo(x + r * 0.72, y + r * 1.2, x + r * 0.66, y + r * 0.85);
  ctx.quadraticCurveTo(x + r * 0.62, y + r * 0.1, x + r * 0.18, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(x, y + r * 1.45, r * 0.16, 0, TAU);
  ctx.fill();
}

/** The row of houses: their windows keep the band's history (one house per bar of the trace). */
function paintHouses(ctx: CanvasRenderingContext2D, w: number, groundY: number, s: number, look: StreetLook, t: number): void {
  const bars = look.bars;
  const n = Math.max(1, bars.length);
  const hw = w / n;
  const baseY = groundY - s * 0.55;
  const wallBase = look.tower ? '#7b6a64' : look.chapter.wall;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const x = i * hw;
    const hh = s * (1.9 + hash(i * 3 + 1) * 0.9);
    const top = baseY - hh;
    const tone = (hash(i * 7) - 0.5) * 0.24;
    const wall = shade(wallBase, tone);
    ctx.fillStyle = wall;
    ctx.strokeStyle = 'rgba(43,34,56,.35)';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    ctx.rect(x + hw * 0.04, top, hw * 0.92, hh);
    ctx.fill();
    ctx.stroke();
    if (!look.tower) {
      // a gable or a stepped roof
      ctx.fillStyle = shade('#a5513f', (hash(i * 5) - 0.5) * 0.3);
      ctx.beginPath();
      if (hash(i * 11) > 0.45) {
        ctx.moveTo(x, top + 1);
        ctx.lineTo(x + hw / 2, top - s * 0.7);
        ctx.lineTo(x + hw, top + 1);
      } else {
        const st = hw / 5;
        ctx.moveTo(x + hw * 0.02, top + 1);
        for (let k = 0; k < 5; k++) {
          const up = k < 3 ? k : 4 - k;
          ctx.lineTo(x + k * st + hw * 0.02, top - up * s * 0.18 - s * 0.1);
          ctx.lineTo(x + (k + 1) * st, top - up * s * 0.18 - s * 0.1);
        }
        ctx.lineTo(x + hw * 0.98, top + 1);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // the windows: 2 × 2, lit by the level
    const rows = 2, cols = 2;
    const ww = hw * 0.2, wh = Math.min(s * 0.42, hh * 0.24);
    const lit = b && !b.empty && b.reliable ? Math.round(b.level * rows * cols) : 0;
    const veiled = b && b.shown < 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        const wx = x + hw * (0.22 + c * 0.36), wy = top + hh * (0.18 + r * 0.38);
        let col = 'rgba(43,34,56,.55)';
        if (b && !b.empty && b.reliable) {
          if (b.phase === 'rest') col = k < Math.round(b.calm * 4) ? 'rgba(170,215,255,.95)' : 'rgba(60,80,120,.6)';
          else if (k < lit) col = b.above ? 'rgba(255,214,110,1)' : 'rgba(255,240,205,.85)';
        }
        ctx.fillStyle = col;
        ctx.fillRect(wx, wy, ww, wh);
        if (b && !b.empty && b.reliable && b.above && b.phase !== 'rest' && k < lit) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, wx + ww / 2, wy + wh / 2, ww * 1.4, 'rgba(255,200,90,', 0.35);
          ctx.restore();
        }
        ctx.strokeStyle = 'rgba(43,34,56,.4)';
        ctx.strokeRect(wx, wy, ww, wh);
        if (b && !b.empty && !b.reliable) {
          // no signal: a dotted sill, never "dark = low"
          ctx.save();
          ctx.setLineDash([1, 3]);
          ctx.strokeStyle = 'rgba(255,255,255,.55)';
          ctx.beginPath();
          ctx.moveTo(wx, wy + wh + 2);
          ctx.lineTo(wx + ww, wy + wh + 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    // a door on every other house
    if (i % 2 === 0) {
      ctx.fillStyle = shade(wallBase, tone - 0.38);
      roundRect(ctx, x + hw * 0.4, baseY - s * 0.62, hw * 0.2, s * 0.62, hw * 0.08);
      ctx.fill();
    }
    if (veiled) {
      ctx.fillStyle = `rgba(150,140,170,${0.75 * (1 - b.shown)})`;
      ctx.fillRect(x, top - s * 0.8, hw + 1, hh + s * 0.8);
    }
  }
  if (look.fog > 0.01) paintNoise(ctx, 0, groundY - s * 3.4, w, s * 3.2, look.fog * 0.8, t);
}

/** Each district's props: market stalls, the mill wheel, the school clock, the bridge's rail, the gardens' hedges, the square's bunting. */
function paintProps(ctx: CanvasRenderingContext2D, w: number, groundY: number, s: number, ch: ChapterSpec, tower: boolean, t: number, x0: number): void {
  const baseY = groundY - s * 0.55;
  if (tower) return;
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.strokeStyle = 'rgba(43,34,56,.55)';
  switch (ch.id) {
    case 'rynek': {
      // two stalls with striped awnings at the edges
      for (const sx of [s * (0.4 - x0 * 0) + 4, w - s * 2.2]) {
        ctx.fillStyle = '#8a5a3a';
        ctx.fillRect(sx, baseY - s * 1.1, s * 0.08, s * 1.1);
        ctx.fillRect(sx + s * 1.6, baseY - s * 1.1, s * 0.08, s * 1.1);
        ctx.fillStyle = '#c98a4a';
        ctx.fillRect(sx, baseY - s * 0.55, s * 1.7, s * 0.5);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = k % 2 ? '#f6efe0' : '#d9534f';
          ctx.beginPath();
          ctx.moveTo(sx - s * 0.1 + k * s * 0.32, baseY - s * 1.25);
          ctx.lineTo(sx - s * 0.1 + (k + 1) * s * 0.32, baseY - s * 1.25);
          ctx.lineTo(sx - s * 0.1 + (k + 1) * s * 0.32, baseY - s * 1.0);
          ctx.quadraticCurveTo(sx - s * 0.1 + (k + 0.5) * s * 0.32, baseY - s * 0.86, sx - s * 0.1 + k * s * 0.32, baseY - s * 1.0);
          ctx.closePath();
          ctx.fill();
        }
        // apples and loaves on the counter
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = k % 2 ? '#d94a3a' : '#e8b45a';
          ctx.beginPath();
          ctx.arc(sx + s * (0.25 + k * 0.3), baseY - s * 0.6, s * 0.1, 0, TAU);
          ctx.fill();
        }
      }
      break;
    }
    case 'mlyn': {
      const cx = w - s * 1.1, cy = baseY - s * 1.4, r = s * 1.15;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.4);
      ctx.strokeStyle = '#6b4a2f';
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
        ctx.fillStyle = '#8a6440';
        ctx.fillRect(Math.cos(a) * r - s * 0.12, Math.sin(a) * r - s * 0.12, s * 0.24, s * 0.24);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(120,180,220,.6)';
      ctx.fillRect(cx - r * 1.2, baseY - s * 0.2, r * 2.4, s * 0.2);
      break;
    }
    case 'szkola': {
      const cx = w * 0.62, cy = baseY - s * 3.0;
      ctx.fillStyle = '#f7f1e3';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.36, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(t * 0.5) * s * 0.26, cy + Math.sin(t * 0.5) * s * 0.26);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - s * 0.18);
      ctx.stroke();
      break;
    }
    case 'most': {
      // the bridge's rail along the street, the river glinting below the curb
      ctx.fillStyle = 'rgba(110,160,210,.55)';
      ctx.fillRect(0, baseY - s * 0.05, w, s * 0.12);
      ctx.strokeStyle = 'rgba(80,80,90,.65)';
      ctx.lineWidth = Math.max(2, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, baseY - s * 0.75);
      ctx.lineTo(w, baseY - s * 0.75);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, s * 0.04);
      for (let x = 0; x < w; x += s * 0.42) {
        ctx.beginPath();
        ctx.moveTo(x, baseY - s * 0.75);
        ctx.lineTo(x, baseY - s * 0.08);
        ctx.stroke();
      }
      break;
    }
    case 'ogrody': {
      for (let x = -s * 0.3, i = 0; x < w; x += s * 1.3, i++) {
        ctx.fillStyle = shade('#5f8f45', (hash(i) - 0.5) * 0.25);
        ctx.beginPath();
        ctx.ellipse(x + s * 0.6, baseY - s * 0.32, s * 0.72, s * 0.42, 0, Math.PI, 0);
        ctx.fill();
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = ['#ffd1dc', '#fff2a8', '#ff9fb2'][(i + k) % 3];
          ctx.beginPath();
          ctx.arc(x + s * (0.25 + k * 0.35), baseY - s * (0.42 + hash(i * 3 + k) * 0.25), s * 0.07, 0, TAU);
          ctx.fill();
        }
      }
      break;
    }
    case 'plac': {
      // bunting across the square
      ctx.strokeStyle = 'rgba(43,34,56,.45)';
      ctx.lineWidth = 1.2;
      const y0 = baseY - s * 2.9;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.quadraticCurveTo(w * 0.4, y0 + s * 0.6, w * 0.75, y0);
      ctx.stroke();
      for (let k = 0; k < 14; k++) {
        const fx = (k / 14) * w * 0.75, fy = y0 + Math.sin((k / 14) * Math.PI) * s * 0.3;
        ctx.fillStyle = ['#e8566a', '#ffc23d', '#8fd3f4', '#8fb35a', '#b9a3e8'][k % 5];
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + s * 0.22, fy);
        ctx.lineTo(fx + s * 0.11, fy + s * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
  }
}

/** The bell's ropes swaying down the tower (the moving part of its inside). */
function paintRopes(ctx: CanvasRenderingContext2D, w: number, groundY: number, s: number, t: number): void {
  ctx.strokeStyle = '#c9a36a';
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  for (const rx of [w * 0.55, w * 0.7]) {
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.quadraticCurveTo(rx + Math.sin(t * 0.8 + rx) * s * 0.15, groundY * 0.5, rx, groundY - s * 1.3);
    ctx.stroke();
  }
}

function paintTowerInside(ctx: CanvasRenderingContext2D, w: number, groundY: number, s: number): void {
  // stone walls, stairs going up on the left (the ropes from the bell above: paintRopes)
  ctx.fillStyle = 'rgba(255,230,200,.06)';
  for (let y = groundY - s * 0.6, r = 0; y > -s; y -= s * 0.45, r++) {
    for (let x = (r % 2) * s * 0.5; x < w; x += s) {
      ctx.strokeStyle = 'rgba(0,0,0,.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y - s * 0.45, s, s * 0.45);
    }
  }
  ctx.fillStyle = 'rgba(30,22,30,.35)';
  for (let k = 0; k < 7; k++) ctx.fillRect(k * s * 0.5, groundY - s * 0.6 - (k + 1) * s * 0.32, s * 0.5, (k + 1) * s * 0.32);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, w * 0.62, 0, s * 4, 'rgba(255,190,110,', 0.25);
  ctx.restore();
}

/** The Din's noise: grey static scribbles drifting over a part of the scene. */
export function paintNoise(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number, t: number): void {
  const n = Math.round(24 * Math.min(1, k));
  ctx.lineWidth = 1.2;
  for (let i = 0; i < n; i++) {
    const px = x + ((hash(i) * w + t * (14 + hash(i + 3) * 18)) % w);
    const py = y + hash(i + 7) * h + Math.sin(t * 3 + i) * 4;
    const len = 8 + hash(i + 11) * 18;
    ctx.strokeStyle = `${C.noise}${(0.12 + 0.25 * hash(i + 5)) * Math.min(1, k)})`;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let j = 1; j <= 4; j++) ctx.lineTo(px + (len / 4) * j, py + (j % 2 ? -3 : 3) * (0.6 + hash(i + j)));
    ctx.stroke();
  }
}

// ── the heroes ───────────────────────────────────────────────────
export interface HeroPose {
  /** facing: 1 right */
  flip: number;
  t: number;
  /** an attack swing (0..1, fading), the cast's glow (0..1), a hit's flash (0..1) */
  act: number;
  cast: number;
  hit: number;
  down: boolean;
  /** sitting at the well (0..1), walking (0..1) */
  sit: number;
  walk: number;
  /** the bar is full: a soft halo */
  ready: boolean;
  silenced: boolean;
  /** the Wall's stone grows, the bond's ribbon glows */
  wall: number;
  /** the colour rank's ring under the feet */
  rankColor: string | null;
  seed: number;
}

export const freshHeroPose = (): HeroPose => ({ flip: 1, t: 0, act: 0, cast: 0, hit: 0, down: false, sit: 0, walk: 0, ready: false, silenced: false, wall: 0, rankColor: null, seed: 0 });

interface Look { skin: string; hair: string; tall: number; wide: number }
const LOOKS: Readonly<Record<HeroId, Look>> = {
  milosc: { skin: '#f2c9a8', hair: '#4a2a22', tall: 1.0, wide: 1.0 },
  radosc: { skin: '#e9b48a', hair: '#c0612b', tall: 0.86, wide: 1.05 },
  pokoj: { skin: '#c98e66', hair: '#2d2420', tall: 1.04, wide: 0.95 },
  cierpliwosc: { skin: '#8d5a3b', hair: '#1f1712', tall: 0.95, wide: 1.35 },
  uprzejmosc: { skin: '#f3d0b5', hair: '#a8743a', tall: 0.96, wide: 1.05 },
  dobroc: { skin: '#b97a52', hair: '#e8d28a', tall: 1.1, wide: 0.95 },
  wiernosc: { skin: '#6e4630', hair: '#151018', tall: 1.08, wide: 1.05 },
  lagodnosc: { skin: '#f0c4a4', hair: '#d9c3a0', tall: 1.0, wide: 0.88 },
  opanowanie: { skin: '#d2a07a', hair: '#232028', tall: 1.06, wide: 0.92 },
};

/** A hero at their feet (x, y), `s` px per u. */
export function paintHero(ctx: CanvasRenderingContext2D, kind: HeroId, x: number, y: number, s: number, p: HeroPose): void {
  const spec = HEROES[kind], look = LOOKS[kind];
  const col = spec.color, dark = spec.dark;
  const lw = Math.max(1, s * 0.045);
  ctx.save();
  ctx.translate(x, y);
  // the shadow on the cobbles and the rank's ring
  ctx.fillStyle = 'rgba(43,34,56,.22)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42 * look.wide, s * 0.1, 0, 0, TAU);
  ctx.fill();
  if (p.rankColor && !p.down) {
    ctx.strokeStyle = p.rankColor;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1.5, s * 0.04);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.46 * look.wide, s * 0.12, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (p.ready && !p.down) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -s * 0.8, s * (0.95 + 0.08 * Math.sin(p.t * 6)), 'rgba(255,214,110,', 0.4);
    ctx.restore();
  }
  if (p.cast > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -s * 0.8, s * 1.4, hexRgb(col), 0.6 * p.cast);
    ctx.restore();
  }
  if (p.down) {
    paintDownHero(ctx, kind, s, p);
    ctx.restore();
    return;
  }
  ctx.scale(p.flip, 1);
  const bob = p.sit > 0.5 ? 0 : Math.sin(p.t * (kind === 'radosc' ? 7 : 3) + p.seed) * s * (kind === 'radosc' ? 0.05 : 0.02) * (1 - p.sit);
  const lunge = p.act > 0 ? Math.sin(Math.min(1, p.act) * Math.PI) * s * 0.18 : 0;
  ctx.translate(lunge, bob + p.sit * s * 0.28);
  const H = s * 1.5 * look.tall;
  const headR = s * 0.27;
  const headY = -H + headR;
  const bodyTop = headY + headR * 0.85;
  const bw = s * 0.5 * look.wide;
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // legs (hidden under robes and dresses)
  if (kind !== 'pokoj' && kind !== 'lagodnosc' && p.sit < 0.5) {
    const step = p.walk > 0 ? Math.sin(p.t * 10) * s * 0.08 * p.walk : 0;
    ctx.fillStyle = shade(dark, -0.2);
    roundRect(ctx, -bw * 0.38 + step, -s * 0.36, s * 0.16, s * 0.36, s * 0.05);
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, bw * 0.12 - step, -s * 0.36, s * 0.16, s * 0.36, s * 0.05);
    ctx.fill();
    ctx.stroke();
  }
  // props behind the body
  if (kind === 'milosc') paintRibbon(ctx, s, col, p.t, p.cast);
  if (kind === 'dobroc') paintQuiver(ctx, s, bw);
  if (kind === 'wiernosc') paintStaff(ctx, s, H, p.t, p.act);
  // the body
  ctx.fillStyle = col;
  ctx.beginPath();
  const hem = kind === 'pokoj' || kind === 'lagodnosc' ? 0 : -s * 0.3;
  const flare = kind === 'pokoj' || kind === 'milosc' || kind === 'lagodnosc' || kind === 'uprzejmosc' ? 1.25 : 1;
  ctx.moveTo(-bw * 0.42, bodyTop);
  ctx.quadraticCurveTo(-bw * 0.7, (bodyTop + hem) / 2, -bw * 0.5 * flare, hem);
  ctx.lineTo(bw * 0.5 * flare, hem);
  ctx.quadraticCurveTo(bw * 0.7, (bodyTop + hem) / 2, bw * 0.42, bodyTop);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // details on the body
  if (kind === 'uprzejmosc') {
    ctx.fillStyle = '#fffaf0';
    roundRect(ctx, -bw * 0.28, bodyTop + s * 0.18, bw * 0.56, Math.max(s * 0.1, hem - bodyTop - s * 0.22), s * 0.06);
    ctx.fill();
  }
  if (kind === 'opanowanie') {
    ctx.strokeStyle = '#1b1b22';
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.4, bodyTop + s * 0.08);
    ctx.lineTo(bw * 0.45, bodyTop + s * 0.45);
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
  }
  if (kind === 'wiernosc') {
    // the cloak over the shoulders
    ctx.fillStyle = shade(dark, -0.1);
    ctx.beginPath();
    ctx.moveTo(-bw * 0.5, bodyTop + s * 0.02);
    ctx.lineTo(-bw * 0.78, hem + s * 0.08);
    ctx.lineTo(-bw * 0.2, hem);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (kind === 'cierpliwosc') {
    ctx.fillStyle = shade(col, -0.25);
    ctx.fillRect(-bw * 0.48, bodyTop + s * 0.38, bw * 0.96, s * 0.08);
  }
  // the head
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, TAU);
  ctx.fill();
  ctx.stroke();
  paintHair(ctx, kind, headR, headY, look.hair, col, p.t);
  paintFaceFeatures(ctx, headR, headY, p.hit > 0.3, p.silenced, p.cast > 0.2);
  // props in front
  switch (kind) {
    case 'cierpliwosc': paintMillstone(ctx, s, bodyTop, p.wall, p.act); break;
    case 'radosc': paintLute(ctx, s, bodyTop, p.act); break;
    case 'pokoj': paintBowl(ctx, s, bodyTop, p.t, p.act); break;
    case 'uprzejmosc': paintTeapot(ctx, s, bodyTop, p.t, p.act); break;
    case 'dobroc': paintBow(ctx, s, H, p.act); break;
    case 'lagodnosc': paintDandelion(ctx, s, bodyTop, p.t, p.act); break;
    case 'opanowanie': paintRapier(ctx, s, H, p.act); break;
    default: break;
  }
  if (p.silenced) {
    ctx.fillStyle = 'rgba(80,70,100,.75)';
    ctx.font = font(s * 0.28, 800);
    ctx.textAlign = 'center';
    ctx.fillText('…', 0, headY - headR * 1.4);
  }
  if (p.hit > 0) {
    ctx.globalAlpha = Math.min(1, p.hit) * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

const hexRgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},`;
};

function paintDownHero(ctx: CanvasRenderingContext2D, kind: HeroId, s: number, p: HeroPose): void {
  // sitting out of breath, the Din's static swirling over the head
  const spec = HEROES[kind], look = LOOKS[kind];
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.strokeStyle = INK;
  ctx.fillStyle = shade(spec.color, -0.15);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.22, s * 0.42 * look.wide, s * 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(s * 0.12 * p.flip, -s * 0.62, s * 0.24, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(s * 0.04 * p.flip, -s * 0.64);
  ctx.lineTo(s * 0.1 * p.flip, -s * 0.64);
  ctx.moveTo(s * 0.17 * p.flip, -s * 0.64);
  ctx.lineTo(s * 0.23 * p.flip, -s * 0.64);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,80,110,.8)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 3; i++) {
    const a = p.t * 3 + (i / 3) * TAU;
    const cx = s * 0.12 * p.flip + Math.cos(a) * s * 0.3, cy = -s * 0.98 + Math.sin(a) * s * 0.08;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx - 1, cy - 3);
    ctx.lineTo(cx + 2, cy + 2);
    ctx.lineTo(cx + 5, cy - 2);
    ctx.stroke();
  }
}

function paintHair(ctx: CanvasRenderingContext2D, kind: HeroId, r: number, hy: number, hair: string, col: string, t: number): void {
  ctx.fillStyle = hair;
  ctx.beginPath();
  switch (kind) {
    case 'cierpliwosc':
      // a knitted cap with a pom-pom
      ctx.fillStyle = shade(col, -0.2);
      ctx.arc(0, hy - r * 0.15, r * 1.02, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f2e6c8';
      ctx.beginPath();
      ctx.arc(0, hy - r * 1.2, r * 0.26, 0, TAU);
      ctx.fill();
      ctx.stroke();
      return;
    case 'radosc': {
      // a wide hat with a red feather
      ctx.fillStyle = '#d9822b';
      ctx.ellipse(0, hy - r * 0.55, r * 1.55, r * 0.32, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, hy - r * 0.62, r * 0.75, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#e8566a';
      ctx.lineWidth = r * 0.18;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, hy - r * 1.1);
      ctx.quadraticCurveTo(-r * 1.2, hy - r * (1.9 + 0.1 * Math.sin(t * 5)), -r * 1.7, hy - r * 1.5);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, r * 0.17);
      return;
    }
    case 'milosc':
      ctx.arc(0, hy - r * 0.1, r * 1.05, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineTo(r * 1.0, hy + r * 1.1);
      ctx.lineTo(r * 0.7, hy + r * 1.1);
      ctx.lineTo(r * 0.75, hy);
      ctx.lineTo(-r * 0.75, hy);
      ctx.lineTo(-r * 0.7, hy + r * 1.1);
      ctx.lineTo(-r * 1.0, hy + r * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    case 'pokoj':
      // a soft hood
      ctx.fillStyle = shade(col, -0.12);
      ctx.arc(0, hy, r * 1.18, Math.PI * 0.95, Math.PI * 2.05);
      ctx.lineTo(r * 1.05, hy + r * 0.8);
      ctx.lineTo(-r * 1.05, hy + r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(0, hy - r * 0.35, r * 0.75, Math.PI, 0);
      ctx.fill();
      return;
    case 'uprzejmosc':
      // a bun and a kerchief
      ctx.arc(0, hy - r * 0.15, r * 1.0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.7, hy - r * 0.85, r * 0.38, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fdf2e0';
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, hy - r * 0.35);
      ctx.quadraticCurveTo(0, hy - r * 1.05, r * 0.95, hy - r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    case 'dobroc':
      ctx.arc(0, hy - r * 0.12, r * 1.04, Math.PI, 0);
      ctx.lineTo(r * 0.9, hy + r * 0.3);
      ctx.lineTo(-r * 0.2, hy - r * 0.35);
      ctx.lineTo(-r * 0.95, hy + r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    case 'wiernosc':
      // a watch cap
      ctx.fillStyle = shade(col, -0.35);
      ctx.arc(0, hy - r * 0.2, r * 1.02, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d6d9e6';
      ctx.fillRect(-r * 1.02, hy - r * 0.32, r * 2.04, r * 0.2);
      return;
    case 'lagodnosc':
      ctx.arc(0, hy - r * 0.05, r * 1.08, Math.PI * 0.9, Math.PI * 2.1);
      ctx.lineTo(r * 0.9, hy + r * 1.3);
      ctx.quadraticCurveTo(r * 0.6, hy + r * 0.4, r * 0.7, hy);
      ctx.lineTo(-r * 0.7, hy);
      ctx.quadraticCurveTo(-r * 0.6, hy + r * 0.4, -r * 0.9, hy + r * 1.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // a flower
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r * 0.75, hy - r * 0.6, r * 0.2, 0, TAU);
      ctx.fill();
      return;
    case 'opanowanie':
      // a neat parting
      ctx.arc(0, hy - r * 0.15, r * 1.02, Math.PI, 0);
      ctx.lineTo(r * 0.95, hy - r * 0.05);
      ctx.lineTo(-r * 0.95, hy - r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
  }
}

function paintFaceFeatures(ctx: CanvasRenderingContext2D, r: number, hy: number, ouch: boolean, hushed: boolean, cast: boolean): void {
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  const ex = r * 0.38, ey = hy + r * 0.12;
  if (ouch) {
    ctx.lineWidth = Math.max(1, r * 0.12);
    for (const sx of [ex * 0.2, ex * 1.25]) {
      ctx.beginPath();
      ctx.moveTo(sx - r * 0.12, ey - r * 0.1);
      ctx.lineTo(sx + r * 0.12, ey + r * 0.1);
      ctx.moveTo(sx + r * 0.12, ey - r * 0.1);
      ctx.lineTo(sx - r * 0.12, ey + r * 0.1);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(ex * 0.2, ey, r * 0.1, 0, TAU);
    ctx.arc(ex * 1.25, ey, r * 0.1, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(240,110,110,.35)';
  ctx.beginPath();
  ctx.arc(-r * 0.25, ey + r * 0.32, r * 0.15, 0, TAU);
  ctx.arc(r * 0.85, ey + r * 0.32, r * 0.15, 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  if (hushed) {
    ctx.moveTo(r * 0.3, ey + r * 0.45);
    ctx.lineTo(r * 0.62, ey + r * 0.45);
  } else if (cast) {
    ctx.arc(r * 0.46, ey + r * 0.38, r * 0.16, 0, Math.PI);
  } else {
    ctx.arc(r * 0.46, ey + r * 0.3, r * 0.17, 0.2, Math.PI - 0.2);
  }
  ctx.stroke();
}

function paintMillstone(ctx: CanvasRenderingContext2D, s: number, bodyTop: number, wall: number, act: number): void {
  const r = s * (0.42 + 0.12 * wall);
  const x = s * (0.42 + 0.1 * Math.sin(Math.min(1, act) * Math.PI)), y = bodyTop + s * 0.42;
  if (wall > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r * 2.2, 'rgba(180,230,140,', 0.45 * wall);
    ctx.restore();
  }
  ctx.fillStyle = '#b6b1a4';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(43,34,56,.35)';
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    ctx.moveTo(x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.32);
    ctx.lineTo(x + Math.cos(a + 0.4) * r * 0.9, y + Math.sin(a + 0.4) * r * 0.9);
  }
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#6f6a60';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.22, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

function paintRibbon(ctx: CanvasRenderingContext2D, s: number, col: string, t: number, cast: number): void {
  ctx.strokeStyle = col;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const x0 = -s * 0.1, y0 = -s * 1.05;
  ctx.moveTo(x0, y0);
  const len = s * (1.2 + 0.6 * cast);
  for (let k = 1; k <= 8; k++) {
    const f = k / 8;
    ctx.lineTo(x0 - f * len, y0 + f * s * 0.35 + Math.sin(t * 5 - f * 4) * s * 0.12 * f);
  }
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.045);
}

function paintLute(ctx: CanvasRenderingContext2D, s: number, bodyTop: number, act: number): void {
  const x = s * 0.25, y = bodyTop + s * 0.45;
  const a = -0.6 + 0.25 * Math.sin(Math.min(1, act) * Math.PI);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = '#a8622f';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.24, s * 0.19, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a2418';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.06, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7a4520';
  ctx.fillRect(s * 0.18, -s * 0.04, s * 0.42, s * 0.08);
  ctx.strokeRect(s * 0.18, -s * 0.04, s * 0.42, s * 0.08);
  ctx.restore();
}

function paintBowl(ctx: CanvasRenderingContext2D, s: number, bodyTop: number, t: number, act: number): void {
  const x = s * 0.32, y = bodyTop + s * 0.36 - Math.sin(Math.min(1, act) * Math.PI) * s * 0.08;
  ctx.fillStyle = '#e8e1d2';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.36, y);
  ctx.quadraticCurveTo(x, y + s * 0.32, x + s * 0.36, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7fc4ec';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.34, s * 0.07, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x + Math.sin(t * 2) * s * 0.08, y, s * 0.1, s * 0.025, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.045);
}

function paintTeapot(ctx: CanvasRenderingContext2D, s: number, bodyTop: number, t: number, act: number): void {
  const tilt = Math.sin(Math.min(1, act) * Math.PI) * 0.5;
  ctx.save();
  ctx.translate(s * 0.38, bodyTop + s * 0.4);
  ctx.rotate(tilt);
  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.22, s * 0.17, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.18, -s * 0.02);
  ctx.quadraticCurveTo(s * 0.34, -s * 0.06, s * 0.38, -s * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-s * 0.24, 0, s * 0.09, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.fillStyle = '#e8566a';
  ctx.beginPath();
  ctx.arc(0, -s * 0.18, s * 0.05, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // steam
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    const sx = s * 0.38 + k * s * 0.06, sy = -s * 0.24;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + Math.sin(t * 3 + k) * s * 0.08, sy - s * 0.15, sx, sy - s * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

function paintQuiver(ctx: CanvasRenderingContext2D, s: number, bw: number): void {
  ctx.fillStyle = '#8a5a2b';
  ctx.save();
  ctx.translate(-bw * 0.45, -s * 1.0);
  ctx.rotate(-0.3);
  roundRect(ctx, -s * 0.08, 0, s * 0.16, s * 0.5, s * 0.05);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#fff3c4';
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.04 + k * s * 0.04, 0);
    ctx.lineTo(-s * 0.04 + k * s * 0.04, -s * 0.14);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = INK;
}

function paintBow(ctx: CanvasRenderingContext2D, s: number, H: number, act: number): void {
  const x = s * 0.32, top = -H * 0.88, bot = -s * 0.25;
  const pull = Math.sin(Math.min(1, act) * Math.PI) * s * 0.12;
  ctx.strokeStyle = '#c9a03a';
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.quadraticCurveTo(x + s * 0.42, (top + bot) / 2, x, bot);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,230,.9)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x - pull, (top + bot) / 2);
  ctx.lineTo(x, bot);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.045);
}

function paintStaff(ctx: CanvasRenderingContext2D, s: number, H: number, t: number, act: number): void {
  const x = s * 0.36 + Math.sin(Math.min(1, act) * Math.PI) * s * 0.15;
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, -H - s * 0.4);
  ctx.stroke();
  // the pennant
  ctx.fillStyle = '#e9edf7';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  const fy = -H - s * 0.38;
  ctx.moveTo(x, fy);
  ctx.quadraticCurveTo(x + s * 0.32, fy + s * 0.05 + Math.sin(t * 4) * s * 0.04, x + s * 0.62, fy + s * 0.12);
  ctx.lineTo(x, fy + s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = Math.max(1, s * 0.045);
}

function paintDandelion(ctx: CanvasRenderingContext2D, s: number, bodyTop: number, t: number, act: number): void {
  const x = s * 0.36, y = bodyTop + s * 0.4;
  const top = y - s * 0.55;
  ctx.strokeStyle = '#6a9a4a';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.05, (y + top) / 2, x + Math.sin(t * 2) * s * 0.03, top);
  ctx.stroke();
  const puff = 1 - Math.min(1, act) * 0.5;
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.beginPath();
  ctx.arc(x, top, s * 0.16 * puff, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,200,220,.9)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + Math.cos(a) * s * 0.2 * puff, top + Math.sin(a) * s * 0.2 * puff);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.045);
}

function paintRapier(ctx: CanvasRenderingContext2D, s: number, H: number, act: number): void {
  const k = Math.min(1, act);
  const lunge = Math.sin(k * Math.PI);
  ctx.save();
  ctx.translate(s * 0.3, -H * 0.55);
  ctx.rotate(-1.45 + lunge * 1.4);
  ctx.strokeStyle = '#dfe7ee';
  ctx.lineWidth = Math.max(1.5, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.95, 0);
  ctx.stroke();
  ctx.strokeStyle = '#c9a03a';
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.1);
  ctx.lineTo(0, s * 0.1);
  ctx.stroke();
  ctx.restore();
}

/** A hero's face in a medallion (the portraits). */
export function paintFace(ctx: CanvasRenderingContext2D, kind: HeroId, cx: number, cy: number, r: number, t: number, grey = false): void {
  const spec = HEROES[kind], look = LOOKS[kind];
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, shade(spec.color, 0.45));
  g.addColorStop(1, spec.color);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // shoulders
  ctx.fillStyle = shade(spec.color, -0.2);
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 1.05, r * 0.85, r * 0.6, 0, 0, TAU);
  ctx.fill();
  const hr = r * 0.48, hy = cy + r * 0.08;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.strokeStyle = INK;
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(cx, hy, hr, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(cx, 0);
  paintHair(ctx, kind, hr, hy, look.hair, spec.color, t);
  paintFaceFeatures(ctx, hr, hy, false, false, false);
  ctx.restore();
  if (grey) {
    ctx.fillStyle = 'rgba(70,65,80,.55)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

// ── the Din's shadows ────────────────────────────────────────────
export interface DinPose {
  t: number;
  /** a hit's flash, an attack (0..1), a wind-up (0..1 of its length, −1 none) */
  hit: number;
  act: number;
  wind: number;
  sleep: boolean;
  tea: boolean;
  /** forming out of the noise (1 → 0), hushing away (0 → 1) */
  form: number;
  hush: number;
  swell: number;
  mirror: number;
  daze: boolean;
  doze: boolean;
  copied: boolean;
  phase: number;
  seed: number;
}

export const freshDinPose = (): DinPose => ({ t: 0, hit: 0, act: 0, wind: -1, sleep: false, tea: false, form: 0, hush: 0, swell: 0, mirror: 0, daze: false, doze: false, copied: false, phase: 0, seed: 0 });

/** A wobbly ink blob path. */
function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, t: number, seed: number, wob = 0.06): void {
  ctx.beginPath();
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + wob * Math.sin(a * 5 + t * 4 + seed) + wob * 0.6 * Math.sin(a * 9 - t * 6 + seed * 2);
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** A shadow of the Din at its feet (x, y), facing left (toward the heroes). */
export function paintDin(ctx: CanvasRenderingContext2D, kind: DinKind, x: number, y: number, s: number, size: number, p: DinPose): void {
  const appear = 1 - Math.max(0, Math.min(1, p.form));
  const gone = Math.max(0, Math.min(1, p.hush));
  if (appear <= 0.02 || gone >= 0.98) return;
  const sc = size * s * (0.4 + 0.6 * appear) * (1 - 0.7 * gone) * (kind === 'gniewosz' ? 1 + 0.08 * p.swell : 1);
  const lw = Math.max(1, s * 0.045);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = Math.min(1, appear * 1.2) * (1 - gone);
  // the shadow on the street
  ctx.fillStyle = 'rgba(43,34,56,.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, sc * 0.42, sc * 0.08, 0, 0, TAU);
  ctx.fill();
  const fly = kind === 'rozproszek';
  const lift = fly && !p.sleep ? sc * (0.55 + 0.12 * Math.sin(p.t * 6 + p.seed)) : 0;
  const shake = p.wind >= 0 ? Math.sin(p.t * 40) * sc * 0.03 * p.wind : 0;
  const lean = p.act > 0 ? Math.sin(Math.min(1, p.act) * Math.PI) * sc * 0.12 : 0;
  ctx.translate(-lean + shake, -lift);
  const body = kind === 'gniewosz' && p.wind >= 0 ? shade('#5a2d3e', 0.1 * p.wind) : kind === 'zgielk' ? ['#3b2e4f', '#46304f', '#522d45'][p.phase] ?? C.din : C.din;
  const wob = gone > 0 ? 0.12 : p.wind >= 0 ? 0.1 : 0.06;
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.dinEdge;
  // static around the body
  ctx.strokeStyle = `${C.noise}${0.4 * (1 - gone)})`;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const a = p.t * 2 + i * 2.1 + p.seed;
    const sx = Math.cos(a) * sc * 0.55, sy = -sc * 0.5 + Math.sin(a * 1.3) * sc * 0.4;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy);
    ctx.lineTo(sx - 1, sy - 3);
    ctx.lineTo(sx + 2, sy + 2);
    ctx.lineTo(sx + 5, sy - 1);
    ctx.stroke();
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.dinEdge;
  switch (kind) {
    case 'rozproszek': {
      // buzzing wings
      ctx.fillStyle = 'rgba(220,215,240,.55)';
      const flap = Math.sin(p.t * 40) * 0.5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * sc * 0.18, -sc * 0.62, sc * 0.2, sc * 0.1, side * (0.6 + flap), 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.35, sc * 0.3, sc * 0.27, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      // zig-zag antennae
      ctx.beginPath();
      ctx.moveTo(-sc * 0.08, -sc * 0.6);
      ctx.lineTo(-sc * 0.16, -sc * 0.72);
      ctx.lineTo(-sc * 0.1, -sc * 0.8);
      ctx.moveTo(sc * 0.08, -sc * 0.6);
      ctx.lineTo(sc * 0.02, -sc * 0.74);
      ctx.lineTo(sc * 0.1, -sc * 0.82);
      ctx.stroke();
      dinFace(ctx, -sc * 0.06, -sc * 0.38, sc * 0.22, p, 'angry');
      break;
    }
    case 'klotniak': {
      // one body, two heads arguing
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.36, sc * 0.42, sc * 0.36, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.fillStyle = body;
        blob(ctx, side * sc * 0.22, -sc * 0.82, sc * 0.2, sc * 0.19, p.t * 1.3, p.seed + side, wob);
        ctx.fill();
        ctx.stroke();
        dinFace(ctx, side * sc * 0.22, -sc * 0.82, sc * 0.17, p, 'shout', side);
      }
      break;
    }
    case 'klotniaczek': {
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.36, sc * 0.33, sc * 0.33, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      dinFace(ctx, -sc * 0.04, -sc * 0.4, sc * 0.25, p, 'shout');
      break;
    }
    case 'gniewosz': {
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.45, sc * 0.45, sc * 0.43, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      // red cheeks, steam puffs
      ctx.fillStyle = `rgba(255,110,90,${0.35 + 0.1 * p.swell})`;
      ctx.beginPath();
      ctx.arc(-sc * 0.25, -sc * 0.36, sc * 0.09, 0, TAU);
      ctx.arc(sc * 0.12, -sc * 0.36, sc * 0.09, 0, TAU);
      ctx.fill();
      if (p.swell > 0 || p.wind >= 0) {
        ctx.fillStyle = 'rgba(230,230,240,.6)';
        for (let i = 0; i < 2 + p.swell; i++) {
          const k = (p.t * 1.5 + i * 0.3) % 1;
          ctx.beginPath();
          ctx.arc(sc * (0.05 * i - 0.1), -sc * (0.9 + k * 0.5), sc * 0.07 * (1 - k), 0, TAU);
          ctx.fill();
        }
      }
      dinFace(ctx, -sc * 0.08, -sc * 0.5, sc * 0.26, p, p.tea ? 'calm' : 'angry');
      break;
    }
    case 'pyszalek': {
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.5, sc * 0.32, sc * 0.5, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      // a cowlick like a crown, the nose up in the air
      ctx.beginPath();
      ctx.moveTo(-sc * 0.12, -sc * 0.98);
      ctx.lineTo(-sc * 0.05, -sc * 1.15);
      ctx.lineTo(sc * 0.02, -sc * 0.98);
      ctx.lineTo(sc * 0.1, -sc * 1.12);
      ctx.lineTo(sc * 0.14, -sc * 0.96);
      ctx.stroke();
      dinFace(ctx, -sc * 0.06, -sc * 0.62, sc * 0.22, p, 'proud');
      if (p.mirror > 0.01) paintMirror(ctx, -sc * 0.42, -sc * 0.48, sc * 0.26, sc * 0.4, p.mirror, p.t);
      break;
    }
    case 'leniwiec': {
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.3, sc * 0.6, sc * 0.3, p.t * 0.5, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      // a nightcap
      ctx.fillStyle = '#7d6aa0';
      ctx.beginPath();
      ctx.moveTo(-sc * 0.35, -sc * 0.55);
      ctx.quadraticCurveTo(-sc * 0.1, -sc * 0.95, sc * 0.3, -sc * 0.75);
      ctx.lineTo(sc * 0.05, -sc * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sc * 0.3, -sc * 0.75, sc * 0.06, 0, TAU);
      ctx.fill();
      dinFace(ctx, -sc * 0.25, -sc * 0.32, sc * 0.22, p, 'sleepy');
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.font = font(sc * 0.22, 800);
      ctx.fillText('z', sc * 0.35, -sc * (0.7 + (p.t % 2) * 0.2));
      break;
    }
    case 'zazdrosnik': {
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.5, sc * 0.26, sc * 0.48, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      // long arms
      ctx.beginPath();
      ctx.moveTo(-sc * 0.2, -sc * 0.5);
      ctx.quadraticCurveTo(-sc * 0.55, -sc * 0.4 + Math.sin(p.t * 3) * sc * 0.08, -sc * 0.7, -sc * 0.62);
      ctx.moveTo(sc * 0.2, -sc * 0.5);
      ctx.quadraticCurveTo(sc * 0.45, -sc * 0.3, sc * 0.5, -sc * 0.15);
      ctx.stroke();
      dinFace(ctx, -sc * 0.05, -sc * 0.65, sc * 0.22, p, 'envy');
      if (p.copied) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, 0, -sc * 0.5, sc * 0.7, 'rgba(120,230,120,', 0.35);
        ctx.restore();
      }
      break;
    }
    case 'pospiech': {
      // spinning legs and a clock on the belly, leaning forward
      ctx.save();
      ctx.rotate(-0.15);
      ctx.strokeStyle = C.dinEdge;
      for (let i = 0; i < 4; i++) {
        const a = p.t * 18 + (i / 4) * TAU;
        ctx.beginPath();
        ctx.moveTo(0, -sc * 0.2);
        ctx.lineTo(Math.cos(a) * sc * 0.22, -sc * 0.2 + Math.abs(Math.sin(a)) * sc * 0.2);
        ctx.stroke();
      }
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.52, sc * 0.3, sc * 0.32, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#efe8d8';
      ctx.beginPath();
      ctx.arc(sc * 0.02, -sc * 0.42, sc * 0.13, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sc * 0.02, -sc * 0.42);
      ctx.lineTo(sc * 0.02 + Math.cos(p.t * 8) * sc * 0.1, -sc * 0.42 + Math.sin(p.t * 8) * sc * 0.1);
      ctx.stroke();
      dinFace(ctx, -sc * 0.06, -sc * 0.66, sc * 0.18, p, 'angry');
      ctx.restore();
      // speed lines behind
      ctx.strokeStyle = 'rgba(70,58,92,.4)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sc * 0.4, -sc * (0.35 + i * 0.15));
        ctx.lineTo(sc * 0.75, -sc * (0.35 + i * 0.15));
        ctx.stroke();
      }
      break;
    }
    case 'plotka': {
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.55, sc * 0.28, sc * 0.55, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      // a hand at the mouth
      ctx.beginPath();
      ctx.moveTo(sc * 0.18, -sc * 0.45);
      ctx.quadraticCurveTo(-sc * 0.1, -sc * 0.6, -sc * 0.25, -sc * 0.72);
      ctx.stroke();
      dinFace(ctx, -sc * 0.05, -sc * 0.78, sc * 0.2, p, 'sly');
      if (p.wind >= 0) {
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.font = font(sc * 0.2, 800);
        ctx.fillText('psst', -sc * 0.9, -sc * 1.0);
      }
      break;
    }
    default:
      paintBoss(ctx, kind, sc, body, p, wob);
      break;
  }
  // a dazed shadow sees stars, a sleeping one snores, tea is tea
  if (p.daze || p.sleep) {
    ctx.fillStyle = p.sleep ? 'rgba(255,255,255,.8)' : '#ffe7a3';
    ctx.font = font(sc * 0.2, 800);
    ctx.textAlign = 'center';
    if (p.sleep) ctx.fillText('z z', 0, -sc * 1.15 - (p.t % 1) * sc * 0.15);
    else for (let i = 0; i < 3; i++) {
      const a = p.t * 4 + (i / 3) * TAU;
      ctx.fillText('✦', Math.cos(a) * sc * 0.35, -sc * 1.1 + Math.sin(a) * sc * 0.08);
    }
  }
  if (p.tea) paintCup(ctx, -sc * 0.35, -sc * 0.35, sc * 0.18, p.t);
  if (p.hit > 0) {
    ctx.globalAlpha = Math.min(1, p.hit * 4) * 0.45 * (1 - gone);
    ctx.fillStyle = '#ffffff';
    blob(ctx, 0, -sc * 0.45, sc * 0.45, sc * 0.45, p.t, p.seed, 0.05);
    ctx.fill();
  }
  ctx.restore();
}

function dinFace(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: DinPose, mood: 'angry' | 'shout' | 'proud' | 'sleepy' | 'envy' | 'sly' | 'calm', side = -1): void {
  const closed = p.sleep || p.doze || p.hush > 0 || mood === 'sleepy' || p.tea;
  const eye = mood === 'envy' ? '#9be89b' : '#ffffff';
  ctx.save();
  ctx.translate(x, y);
  if (side > 0) ctx.scale(-1, 1);
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = '#f4efff';
  ctx.fillStyle = eye;
  for (const ex of [-r * 0.45, r * 0.15]) {
    if (closed) {
      ctx.beginPath();
      ctx.arc(ex, 0, r * 0.18, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(ex, 0, r * 0.2, r * (mood === 'envy' ? 0.26 : 0.22), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a1424';
      ctx.beginPath();
      ctx.arc(ex - r * 0.07, r * 0.02, r * 0.09, 0, TAU);
      ctx.fill();
      ctx.fillStyle = eye;
    }
  }
  // brows
  if (!closed && (mood === 'angry' || mood === 'shout')) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.35);
    ctx.lineTo(-r * 0.25, -r * 0.2);
    ctx.moveTo(r * 0.4, -r * 0.35);
    ctx.lineTo(-r * 0.02, -r * 0.2);
    ctx.stroke();
  }
  // the mouth: a jagged shout, a smug line, a relieved smile when hushed
  ctx.beginPath();
  if (p.hush > 0 || p.tea || mood === 'calm') {
    ctx.arc(-r * 0.15, r * 0.35, r * 0.2, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (mood === 'shout' || p.wind >= 0 || p.act > 0) {
    // a comic shout: a round open mouth with a tongue
    const open = 0.16 + 0.08 * Math.abs(Math.sin(p.t * 9 + p.seed));
    ctx.fillStyle = '#1a1424';
    ctx.ellipse(-r * 0.2, r * 0.5, r * 0.22, r * open * (p.wind >= 0 ? 1.4 : 1), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8869a';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, r * (0.5 + open * 0.5), r * 0.12, r * 0.06, 0, 0, TAU);
    ctx.fill();
  } else if (mood === 'proud') {
    ctx.moveTo(-r * 0.4, r * 0.4);
    ctx.quadraticCurveTo(-r * 0.1, r * 0.3, r * 0.15, r * 0.45);
    ctx.stroke();
  } else {
    ctx.moveTo(-r * 0.4, r * 0.42);
    ctx.lineTo(r * 0.05, r * 0.38);
    ctx.stroke();
  }
  ctx.restore();
}

function paintMirror(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, k: number, t: number): void {
  ctx.save();
  ctx.globalAlpha *= 0.4 + 0.6 * k;
  const g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  g.addColorStop(0, '#f4f6ff');
  g.addColorStop(0.5, '#b9c3dc');
  g.addColorStop(1, '#eef2ff');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#d9b44a';
  ctx.lineWidth = Math.max(1.5, rx * 0.15);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = Math.max(1, rx * 0.1);
  const sh = (t * 0.6) % 1;
  ctx.beginPath();
  ctx.moveTo(x - rx * 0.5 + sh * rx, y - ry * 0.6);
  ctx.lineTo(x - rx * 0.1 + sh * rx, y - ry * 0.1);
  ctx.stroke();
  ctx.restore();
}

function paintCup(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  ctx.fillStyle = '#fbf6ec';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.5);
  ctx.lineTo(x + r, y - r * 0.5);
  ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.6, x, y + r * 0.6);
  ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.6, x - r, y - r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.7);
  ctx.quadraticCurveTo(x + Math.sin(t * 3) * r * 0.4, y - r * 1.2, x, y - r * 1.6);
  ctx.stroke();
}

function paintBoss(ctx: CanvasRenderingContext2D, kind: DinKind, sc: number, body: string, p: DinPose, wob: number): void {
  ctx.fillStyle = body;
  switch (kind) {
    case 'krzykacz': {
      blob(ctx, 0, -sc * 0.45, sc * 0.42, sc * 0.45, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      // a striped hat and a megaphone
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? '#f6efe0' : '#d9534f';
        ctx.fillRect(-sc * 0.3 + k * sc * 0.15, -sc * 1.0, sc * 0.15, sc * 0.12);
      }
      ctx.fillStyle = '#d9a441';
      ctx.beginPath();
      ctx.moveTo(-sc * 0.25, -sc * 0.45);
      ctx.lineTo(-sc * 0.75, -sc * (0.65 + 0.1 * Math.max(0, p.wind)));
      ctx.lineTo(-sc * 0.75, -sc * (0.25 - 0.1 * Math.max(0, p.wind)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      dinFace(ctx, -sc * 0.05, -sc * 0.62, sc * 0.2, p, 'shout');
      break;
    }
    case 'turkot': {
      ctx.save();
      ctx.translate(0, -sc * 0.48);
      ctx.rotate(p.t * (p.wind >= 0 ? 6 : 1.2));
      ctx.fillStyle = '#4a3a58';
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        ctx.fillRect(Math.cos(a) * sc * 0.44 - sc * 0.06, Math.sin(a) * sc * 0.44 - sc * 0.06, sc * 0.12, sc * 0.12);
      }
      ctx.restore();
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.48, sc * 0.42, sc * 0.42, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      dinFace(ctx, -sc * 0.05, -sc * 0.52, sc * 0.2, p, 'angry');
      break;
    }
    case 'gwar': {
      blob(ctx, 0, -sc * 0.5, sc * 0.5, sc * 0.42, p.t, p.seed, 0.1);
      ctx.fill();
      ctx.stroke();
      // many little mouths chattering
      ctx.fillStyle = '#1a1424';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + 0.3;
        const open = Math.abs(Math.sin(p.t * 9 + k)) * sc * 0.05 + sc * 0.02;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * sc * 0.3, -sc * 0.5 + Math.sin(a) * sc * 0.24, sc * 0.06, open, 0, 0, TAU);
        ctx.fill();
      }
      dinFace(ctx, -sc * 0.05, -sc * 0.55, sc * 0.17, p, 'angry');
      break;
    }
    case 'klakson': {
      roundRect(ctx, -sc * 0.42, -sc * 0.85, sc * 0.84, sc * 0.75, sc * 0.18);
      ctx.fill();
      ctx.stroke();
      // a bulb horn on the head and a grille mouth
      ctx.fillStyle = '#d9a441';
      ctx.beginPath();
      ctx.moveTo(-sc * 0.1, -sc * 0.85);
      ctx.lineTo(-sc * 0.45, -sc * 1.15);
      ctx.lineTo(-sc * 0.45, -sc * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8566a';
      ctx.beginPath();
      ctx.arc(sc * 0.05, -sc * 0.92, sc * 0.1 * (1 + 0.3 * Math.max(0, p.wind)), 0, TAU);
      ctx.fill();
      ctx.stroke();
      dinFace(ctx, -sc * 0.05, -sc * 0.6, sc * 0.2, p, 'angry');
      ctx.strokeStyle = '#cfc7dd';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(-sc * 0.25 + k * sc * 0.12, -sc * 0.3);
        ctx.lineTo(-sc * 0.25 + k * sc * 0.12, -sc * 0.18);
        ctx.stroke();
      }
      break;
    }
    case 'pycha': {
      // a fan of mirrors behind, nose in the air
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + 0.25 + (k / 6) * (Math.PI - 0.5);
        paintMirror(ctx, Math.cos(a) * sc * 0.55, -sc * 0.55 + Math.sin(a) * sc * 0.55, sc * 0.12, sc * 0.18, 0.8, p.t + k);
      }
      ctx.fillStyle = body;
      blob(ctx, 0, -sc * 0.45, sc * 0.36, sc * 0.48, p.t, p.seed, wob);
      ctx.fill();
      ctx.stroke();
      dinFace(ctx, -sc * 0.05, -sc * 0.62, sc * 0.2, p, 'proud');
      if (p.mirror > 0.01) paintMirror(ctx, -sc * 0.45, -sc * 0.45, sc * 0.22, sc * 0.36, p.mirror, p.t);
      break;
    }
    default: {
      // Zgiełk: a storm of static with many eyes
      blob(ctx, 0, -sc * 0.55, sc * 0.55, sc * 0.5, p.t, p.seed, 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,140,${0.5 + 0.3 * Math.sin(p.t * 7)})`;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const a = p.t * 1.5 + k * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * sc * 0.3, -sc * 0.9);
        ctx.lineTo(Math.cos(a) * sc * 0.35 + sc * 0.06, -sc * 1.05);
        ctx.lineTo(Math.cos(a) * sc * 0.32, -sc * 1.12);
        ctx.stroke();
      }
      ctx.strokeStyle = C.dinEdge;
      for (let k = 0; k < 4; k++) dinFace(ctx, -sc * 0.3 + (k % 2) * sc * 0.35, -sc * (0.42 + Math.floor(k / 2) * 0.28), sc * 0.12, p, 'shout');
      break;
    }
  }
}

// ── Klara, the well ──────────────────────────────────────────────
export interface KlaraPose { t: number; ring: number; talk: boolean; flip: number }

/** Klara, the bell-ringer's granddaughter: two braids, a mustard cardigan, a handbell and a notebook. */
export function paintKlara(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: KlaraPose): void {
  const lw = Math.max(1, s * 0.045);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.flip, 1);
  ctx.fillStyle = 'rgba(43,34,56,.22)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.3, s * 0.08, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  const bob = Math.sin(p.t * 3) * s * 0.02;
  ctx.translate(0, bob);
  // legs, skirt, cardigan
  ctx.fillStyle = '#3b3a4a';
  ctx.fillRect(-s * 0.12, -s * 0.3, s * 0.08, s * 0.3);
  ctx.fillRect(s * 0.04, -s * 0.3, s * 0.08, s * 0.3);
  ctx.fillStyle = '#4f6fb3';
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.62);
  ctx.lineTo(-s * 0.3, -s * 0.26);
  ctx.lineTo(s * 0.3, -s * 0.26);
  ctx.lineTo(s * 0.2, -s * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e0a83a';
  roundRect(ctx, -s * 0.22, -s * 0.9, s * 0.44, s * 0.36, s * 0.1);
  ctx.fill();
  ctx.stroke();
  // the notebook under an arm
  ctx.fillStyle = '#c94f3d';
  ctx.fillRect(-s * 0.32, -s * 0.78, s * 0.14, s * 0.2);
  ctx.strokeRect(-s * 0.32, -s * 0.78, s * 0.14, s * 0.2);
  // the head and the braids
  const hy = -s * 1.08, r = s * 0.22;
  ctx.fillStyle = '#7a4a2a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.95, hy + r * 0.9, r * 0.22, r * 0.5, side * 0.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#f2c9a8';
  ctx.beginPath();
  ctx.arc(0, hy, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7a4a2a';
  ctx.beginPath();
  ctx.arc(0, hy - r * 0.15, r * 1.02, Math.PI, 0);
  ctx.lineTo(r * 0.6, hy - r * 0.25);
  ctx.lineTo(-r * 0.6, hy - r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(r * 0.1, hy + r * 0.1, r * 0.1, 0, TAU);
  ctx.arc(r * 0.55, hy + r * 0.1, r * 0.1, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  if (p.talk && Math.sin(p.t * 18) > 0) ctx.ellipse(r * 0.35, hy + r * 0.5, r * 0.12, r * 0.1, 0, 0, TAU);
  else ctx.arc(r * 0.35, hy + r * 0.4, r * 0.14, 0.2, Math.PI - 0.2);
  if (p.talk) ctx.fill(); else ctx.stroke();
  // the handbell, swinging when she rings it
  const a = -0.6 + Math.sin(p.t * 22) * 0.6 * p.ring;
  ctx.save();
  ctx.translate(s * 0.26, -s * 0.78);
  ctx.rotate(a);
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 0.16);
  ctx.stroke();
  paintBellShape(ctx, 0, -s * 0.02, s * 0.11, '#ffcf4a', INK);
  ctx.restore();
  ctx.restore();
}

/**
 * The town well: stones, a little roof on two posts, and its water — the rest's gauge: ripples that
 * shrink as calm grows, the threshold a dotted ring on the water, a silver shimmer above it.
 */
export function paintWell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, calm: number, show: number, t: number): void {
  if (show <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, show);
  ctx.translate(x, y);
  const lw = Math.max(1, s * 0.045);
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  const rw = s * 0.85, wh = s * 0.6;
  // posts and the roof
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(-rw * 0.92, -wh - s * 1.35, s * 0.1, s * 1.35);
  ctx.fillRect(rw * 0.92 - s * 0.1, -wh - s * 1.35, s * 0.1, s * 1.35);
  ctx.strokeRect(-rw * 0.92, -wh - s * 1.35, s * 0.1, s * 1.35);
  ctx.strokeRect(rw * 0.92 - s * 0.1, -wh - s * 1.35, s * 0.1, s * 1.35);
  ctx.fillStyle = '#a5513f';
  ctx.beginPath();
  ctx.moveTo(-rw * 1.15, -wh - s * 1.25);
  ctx.lineTo(0, -wh - s * 1.85);
  ctx.lineTo(rw * 1.15, -wh - s * 1.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // the rope and bucket
  ctx.strokeStyle = '#c9a36a';
  ctx.beginPath();
  ctx.moveTo(0, -wh - s * 1.3);
  ctx.lineTo(0, -wh - s * 0.5);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#8a6440';
  roundRect(ctx, -s * 0.12, -wh - s * 0.55, s * 0.24, s * 0.22, s * 0.04);
  ctx.fill();
  ctx.stroke();
  // the stone ring
  ctx.fillStyle = '#b8b1a3';
  ctx.beginPath();
  ctx.moveTo(-rw, -wh);
  ctx.lineTo(-rw, 0);
  ctx.ellipse(0, 0, rw, rw * 0.22, 0, Math.PI, 0, true);
  ctx.lineTo(rw, -wh);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(43,34,56,.3)';
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 4; k++) {
      const sx = -rw + (k + (r % 2) * 0.5) * (rw / 2);
      ctx.strokeRect(sx, -wh + r * wh / 3, rw / 2, wh / 3);
    }
  }
  ctx.strokeStyle = INK;
  // the water
  const wy = -wh;
  ctx.fillStyle = '#d0c9bb';
  ctx.beginPath();
  ctx.ellipse(0, wy, rw, rw * 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = calm >= 0.5 ? '#6fb6e6' : '#4c7fa8';
  ctx.beginPath();
  ctx.ellipse(0, wy, rw * 0.82, rw * 0.18, 0, 0, TAU);
  ctx.fill();
  // ripples: many and wide when restless, few and small when calm
  const rings = Math.round(1 + (1 - calm) * 4);
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < rings; i++) {
    const k = ((t * (0.6 + (1 - calm)) + i / rings) % 1);
    const rr = rw * 0.8 * k * (0.4 + 0.6 * (1 - calm));
    ctx.globalAlpha = Math.min(1, show) * (1 - k) * 0.9;
    ctx.beginPath();
    ctx.ellipse(Math.sin(i * 2.3) * rw * 0.2 * (1 - calm), wy, rr, rr * 0.22, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = Math.min(1, show);
  // the threshold: a dotted ring on the water
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.ellipse(0, wy, rw * 0.41, rw * 0.09, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  if (calm >= 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, wy, rw * (0.6 + calm * 0.6), 'rgba(200,230,255,', 0.45 * calm);
    ctx.restore();
  }
  ctx.restore();
}
