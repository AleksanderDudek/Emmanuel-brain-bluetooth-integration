/**
 * Warstwy światła's pictures, drawn with canvas paths and gradients (no images): a deep night of indigo and violet,
 * the Light above (light only — no figure is ever drawn there), and the figure of light (kit/figure.ts) standing in
 * seven nested layers, each its own texture and colour —
 *
 *   0 Ciało    a fine web of blue-silver lines in a sheath close to the body
 *   1 Uczucia  soft coloured clouds
 *   2 Myśli    a clear lemon-gold haze with fine rays
 *   3 Relacje  rose light in soft puffs
 *   4 Wola     a deep blue blueprint: a fine grid and contour lines
 *   5 Radość   an opalescent shimmer of pastel arcs
 *   6 Duch     a golden lattice shell (a truss of gold between two rims)
 *
 * Each layer is drawn dull (grey, murky, before it is cleansed) or clear (clean colour, bright).  The seven layers and
 * the figure are baked together into one composite per set of cleared layers (`EggBaker`), a layer at a time across
 * frames so a bake never stalls the picture; a frame blits one composite (two while a layer closes) and adds only the
 * living light — glints, drifting glows, the threads, the clinging things — as small baked sprites.  No shadowBlur,
 * no filters, no per-frame gradients.
 */
import { OUTLINE, figurePath, type ToScreen } from '../kit/figure';
import { MIN_TEXT } from '../kit/mobile';
import { LAYERS, type Thing } from './content';
import { EGGS, eggPt, eggRing, type Egg, type Pt } from './egg';
import type { Layout } from './layout';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const GOLD = '#ffd98a';
export const PEARL = '#fffaf0';
export const NIGHT = '#0a0c24';
const TAU = Math.PI * 2;

/** A canvas font, never under MIN_TEXT (11 px); text the player must read asks for 13 px and more itself. */
export const fontPx = (px: number): number => Math.max(MIN_TEXT, Math.round(px * 2) / 2);
export const font = (px: number, weight = 600, serif = false, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${fontPx(px)}px ${serif ? SERIF : SANS}`;

/** Greedy word wrap with the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** "#rrggbb" → "rgba(r,g,b," (append the alpha and ")"). */
export function rgbaPrefix(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},`;
}
export const rgba = (hex: string, a: number): string => `${rgbaPrefix(hex)}${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** Mix two "#rrggbb" colours (k = 0 → a, 1 → b). */
export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const kk = Math.max(0, Math.min(1, k));
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - kk) + ((y >> s) & 255) * kk);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** A deterministic 0..1 for a number (decorations that never jump). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── offscreen layers and sprites ─────────────────────────────────
export type Layer = HTMLCanvasElement;

/** A blank offscreen canvas of w × h CSS px at `dpr` (null where there is no DOM). */
export function layer(w: number, h: number, dpr: number): { c: Layer; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

const glowCache = new Map<string, Layer>();

/** A soft round glow in a colour (64 px, baked once): draw it scaled, additively, for light. */
export function glowSprite(hex: string): Layer | null {
  const hit = glowCache.get(hex);
  if (hit) return hit;
  const L = layer(64, 64, 1);
  if (!L) return null;
  const pre = rgbaPrefix(hex);
  const g = L.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `${pre}1)`);
  g.addColorStop(0.25, `${pre}.55)`);
  g.addColorStop(0.55, `${pre}.18)`);
  g.addColorStop(1, `${pre}0)`);
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 64, 64);
  glowCache.set(hex, L.c);
  return L.c;
}

/** Draw a baked glow centred at (x, y) with radius r and alpha a (additive). */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  const s = glowSprite(hex);
  if (!s || a <= 0.003 || r <= 0.5) return;
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

// ── geometry on the screen ───────────────────────────────────────

/** Screen coordinates for figure units inside a layer whose origin is at (ox, oy). */
export const mapper = (L: Layout, ox = 0, oy = 0): ToScreen => (x, y) => [L.fig.cx - ox + x * L.fig.H, L.fig.top - oy + y * L.fig.H];

/** An egg's rim as a closed path (screen px, origin at (ox, oy)). */
export function eggPath(L: Layout, e: Egg, ox = 0, oy = 0, n = 120): Path2D {
  const map = mapper(L, ox, oy);
  const p = new Path2D();
  eggRing(e, n).forEach(([x, y], i) => {
    const [sx, sy] = map(x, y);
    if (i) p.lineTo(sx, sy); else p.moveTo(sx, sy);
  });
  p.closePath();
  return p;
}

// ── the night ────────────────────────────────────────────────────

/**
 * The night behind the egg, baked per size: indigo deepening to violet, a soft halo where the egg stands, a faint
 * column of light from above, and quiet stars kept out of the column.
 */
export function bakeSky(L: Layout, dpr: number): Layer | null {
  const B = layer(L.w, L.h, dpr);
  if (!B) return null;
  const c = B.ctx, w = L.w, h = L.h, H = L.fig.H;
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#05071a');
  g.addColorStop(0.35, '#0c1032');
  g.addColorStop(0.7, '#171338');
  g.addColorStop(1, '#0b0a1e');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const cx = L.fig.cx, cy = L.fig.top + 0.5 * H;
  const halo = c.createRadialGradient(cx, cy, 0, cx, cy, 0.95 * H);
  halo.addColorStop(0, 'rgba(92,78,168,.34)');
  halo.addColorStop(0.55, 'rgba(58,44,122,.16)');
  halo.addColorStop(1, 'rgba(30,20,70,0)');
  c.fillStyle = halo;
  c.fillRect(0, 0, w, h);
  // the column of light from above onto the egg
  const lx = L.light.x, ly = L.light.y;
  const col = c.createLinearGradient(0, ly, 0, cy);
  col.addColorStop(0, 'rgba(255,244,214,.16)');
  col.addColorStop(1, 'rgba(255,244,214,0)');
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(lx - 0.05 * H, ly);
  c.lineTo(lx + 0.05 * H, ly);
  c.lineTo(lx + 0.4 * H, cy);
  c.lineTo(lx - 0.4 * H, cy);
  c.closePath();
  c.fill();
  // stars
  const n = Math.round(60 + (w * h) / 9000);
  for (let i = 0; i < n; i++) {
    const x = hash(i * 1.31) * w, y = hash(i * 2.17 + 5) * h;
    if (Math.abs(x - lx) < 0.3 * H + (y - ly) * 0.5 && y < cy) continue;
    const r = 0.4 + 1.1 * hash(i * 3.7) ** 2;
    c.fillStyle = `rgba(${hash(i * 5.1) > 0.7 ? '255,236,200' : '214,224,255'},${(0.25 + 0.55 * hash(i * 7.3)).toFixed(2)})`;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }
  return B.c;
}

let raySprite: Layer | null = null;

/** One soft ray of light (baked once): a long thin wedge fading from its root to nothing. */
function ray(): Layer | null {
  if (raySprite) return raySprite;
  const B = layer(256, 32, 1);
  if (!B) return null;
  const c = B.ctx;
  const g = c.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,242,214,0.9)');
  g.addColorStop(0.25, 'rgba(255,238,206,0.45)');
  g.addColorStop(1, 'rgba(255,236,200,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, 16);
  c.lineTo(256, 0);
  c.lineTo(256, 32);
  c.closePath();
  c.fill();
  // soften the long edges: a second, narrower, brighter core
  const g2 = c.createLinearGradient(0, 0, 200, 0);
  g2.addColorStop(0, 'rgba(255,255,240,0.5)');
  g2.addColorStop(1, 'rgba(255,255,240,0)');
  c.fillStyle = g2;
  c.beginPath();
  c.moveTo(0, 16);
  c.lineTo(200, 11);
  c.lineTo(200, 21);
  c.closePath();
  c.fill();
  raySprite = B.c;
  return raySprite;
}

/** The Light above, drawn each frame: a soft bright source with slow, fading rays (`k` its brightness, 0..1.6). */
export function drawLight(ctx: CanvasRenderingContext2D, L: Layout, t: number, k: number, still: boolean): void {
  const { x, y, r } = L.light;
  const breathe = still ? 0 : 0.08 * Math.sin(t * 0.6);
  const sp = ray();
  if (sp) {
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (still ? 0 : t * 0.02) + 0.35 * Math.sin(i * 1.7);
      const len = r * (2.2 + 1.6 * hash(i + 3)) * (0.9 + 0.25 * k);
      const wdt = len * (0.06 + 0.05 * hash(i + 9));
      const tw = still ? 1 : 0.75 + 0.25 * Math.sin(t * (0.3 + 0.2 * hash(i)) + i);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, (0.1 + 0.1 * k) * tw);
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.drawImage(sp, 0, -wdt / 2, len, wdt);
      ctx.restore();
    }
  }
  glow(ctx, '#fff1cf', x, y, r * (2.6 + breathe) * (0.85 + 0.25 * k), 0.3 + 0.18 * k);
  glow(ctx, '#ffffff', x, y, r * (1.1 + breathe), 0.72 + 0.2 * k);
  glow(ctx, '#ffffff', x, y, r * 0.45, 0.9);
}

// ── the layers ───────────────────────────────────────────────────

/** A layer's colours in a state (clear or dull) — the texture's light, its rim, its deep tone. */
function tones(k: number, clear: boolean): { hue: string; rim: string; deep: string } {
  const s = LAYERS[k];
  return clear ? { hue: s.hue, rim: mix(s.hue, '#ffffff', 0.35), deep: s.deep } : { hue: s.dull, rim: mix(s.dull, '#2a2638', 0.2), deep: mix(s.deep, '#3a3446', 0.7) };
}

/** Draw layer k's texture (1..6: its band; 0: the web) into `c`, which the baker then masks to the band. */
function texture(c: CanvasRenderingContext2D, L: Layout, k: number, clear: boolean, ox: number, oy: number): void {
  const H = L.fig.H, map = mapper(L, ox, oy);
  const { hue, deep } = tones(k, clear);
  const at = (p: Pt): [number, number] => map(p[0], p[1]);
  const outer = EGGS[k], inner = EGGS[Math.max(0, k - 1)];
  const [cx, cy] = map(0, 0.5);
  const base = (a0: number, a1: number, col: string): void => {
    const g = c.createRadialGradient(cx, cy, inner.a * H * 0.6, cx, cy, outer.b * H * 1.05);
    g.addColorStop(0, rgba(col, a0));
    g.addColorStop(1, rgba(col, a1));
    c.fillStyle = g;
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  };
  const lineW = Math.max(0.6, H * 0.0024);
  const seed = k * 101;
  switch (k) {
    case 1: { // feelings: soft coloured clouds
      base(0.05, clear ? 0.16 : 0.1, hue);
      const pal = clear ? ['#ff9ec7', '#b79cff', '#7fd6c8', '#ffc27a', '#8fc4ff', '#ff8fa0'] : ['#6c5a6a', '#5a5670', '#566a66', '#6e6250', '#56606e', '#6a5458'];
      for (let i = 0; i < 34; i++) {
        const th = hash(seed + i * 3.1) * TAU, d = 0.15 + 0.8 * hash(seed + i * 5.3);
        const p = eggPt({ a: inner.a + (outer.a - inner.a) * d, b: inner.b + (outer.b - inner.b) * d }, th);
        const [x, y] = at(p);
        const r = H * (0.045 + 0.05 * hash(seed + i * 7.7));
        const col = pal[i % pal.length];
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(col, clear ? 0.5 : 0.36));
        g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g;
        c.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      break;
    }
    case 2: { // thoughts: a clear lemon haze with fine rays
      base(0.06, clear ? 0.26 : 0.14, hue);
      c.strokeStyle = rgba(clear ? '#fff8d0' : '#9a9270', clear ? 0.32 : 0.14);
      c.lineWidth = lineW;
      for (let i = 0; i < 110; i++) {
        const th = (i / 110) * TAU + 0.02 * Math.sin(i * 3.3);
        const [x0, y0] = at(eggPt(inner, th)), [x1, y1] = at(eggPt(outer, th));
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
      }
      break;
    }
    case 3: { // relationships: rose light in soft puffs
      base(0.06, clear ? 0.22 : 0.13, hue);
      for (let i = 0; i < 26; i++) {
        const th = hash(seed + i * 2.3) * TAU, d = 0.2 + 0.7 * hash(seed + i * 4.1);
        const [x, y] = at(eggPt({ a: inner.a + (outer.a - inner.a) * d, b: inner.b + (outer.b - inner.b) * d }, th));
        const r = H * (0.04 + 0.035 * hash(seed + i * 6.1));
        const col = i % 3 ? hue : deep;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(col, clear ? 0.42 : 0.26));
        g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g;
        c.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      break;
    }
    case 4: { // the will: a deep blue blueprint
      base(0.1, clear ? 0.34 : 0.2, deep);
      c.strokeStyle = rgba(clear ? '#b8d0ff' : '#5a668a', clear ? 0.36 : 0.16);
      c.lineWidth = lineW * 0.8;
      const step = H * 0.028;
      const W = c.canvas.width, Hh = c.canvas.height;
      c.beginPath();
      for (let x = (cx % step) - step; x < W; x += step) { c.moveTo(x, 0); c.lineTo(x, Hh); }
      for (let y = (cy % step) - step; y < Hh; y += step) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke();
      // the contour lines of the pattern, finer and brighter
      c.strokeStyle = rgba(clear ? '#dfe9ff' : '#6a7698', clear ? 0.5 : 0.2);
      c.lineWidth = lineW;
      for (const d of [0.3, 0.55, 0.8]) {
        const e = { a: inner.a + (outer.a - inner.a) * d, b: inner.b + (outer.b - inner.b) * d };
        c.beginPath();
        eggRing(e, 120).forEach((p, i) => { const [x, y] = at(p); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
        c.closePath();
        c.stroke();
      }
      break;
    }
    case 5: { // joy: an opalescent shimmer
      base(0.05, clear ? 0.16 : 0.1, clear ? '#ffffff' : '#7e7a86');
      const pastel = ['#ffc6dc', '#ffe0b8', '#fff4b0', '#c8ffd8', '#bfe4ff', '#d8c8ff'];
      c.lineCap = 'round';
      for (let i = 0; i < 72; i++) {
        const th0 = (i / 72) * TAU, th1 = th0 + 0.22 + 0.1 * hash(seed + i);
        const d = 0.15 + 0.7 * hash(seed + i * 2.9);
        const e = { a: inner.a + (outer.a - inner.a) * d, b: inner.b + (outer.b - inner.b) * d };
        const col = clear ? pastel[Math.floor((i / 72) * pastel.length * 2) % pastel.length] : '#8a8692';
        c.strokeStyle = rgba(col, clear ? 0.34 : 0.14);
        c.lineWidth = H * (0.008 + 0.01 * hash(seed + i * 4.4));
        c.beginPath();
        for (let j = 0; j <= 8; j++) {
          const [x, y] = at(eggPt(e, th0 + ((th1 - th0) * j) / 8));
          if (j) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.stroke();
      }
      if (!clear) {
        // ash dusting the pearl
        for (let i = 0; i < 160; i++) {
          const th = hash(seed + i * 1.7) * TAU, d = hash(seed + i * 3.9);
          const [x, y] = at(eggPt({ a: inner.a + (outer.a - inner.a) * d, b: inner.b + (outer.b - inner.b) * d }, th));
          c.fillStyle = rgba(hash(i) > 0.5 ? '#3c3a42' : '#77737e', 0.5);
          c.fillRect(x, y, 1.2 + 1.4 * hash(i * 2.2), 1.2 + 1.2 * hash(i * 3.3));
        }
      }
      break;
    }
    case 6: { // the spirit: a golden lattice shell
      base(0.04, clear ? 0.14 : 0.08, hue);
      const n = 64;
      const ptsIn: [number, number][] = [], ptsOut: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        ptsIn.push(at(eggPt(inner, (i / n) * TAU)));
        ptsOut.push(at(eggPt(outer, ((i + 0.5) / n) * TAU, 0.985)));
      }
      const truss = (): void => {
        c.beginPath();
        for (let i = 0; i < n; i++) {
          const a = ptsIn[i], b = ptsOut[i], a2 = ptsIn[(i + 1) % n];
          c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(a2[0], a2[1]);
        }
        // the two rims of the shell
        ptsIn.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
        c.closePath();
        ptsOut.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
        c.closePath();
      };
      if (clear) {
        c.strokeStyle = rgba(deep, 0.22);
        c.lineWidth = H * 0.016;
        truss();
        c.stroke();
      }
      c.strokeStyle = rgba(clear ? GOLD : '#7a6848', clear ? 0.85 : 0.4);
      c.lineWidth = Math.max(0.8, H * 0.0045);
      truss();
      c.stroke();
      c.fillStyle = rgba(clear ? '#fff3cf' : '#8a7a5a', clear ? 0.9 : 0.45);
      for (const p of [...ptsIn, ...ptsOut]) {
        c.beginPath();
        c.arc(p[0], p[1], Math.max(0.8, H * 0.0045), 0, TAU);
        c.fill();
      }
      break;
    }
    default: { // the body's web: a fine net of two diagonal families of lines
      c.strokeStyle = rgba(clear ? '#d6f0ff' : '#7f8ea4', clear ? 0.62 : 0.32);
      c.lineWidth = lineW * 0.9;
      const step = H * 0.016;
      const W = c.canvas.width, Hh = c.canvas.height;
      c.beginPath();
      for (let x = -Hh; x < W + Hh; x += step) { c.moveTo(x, 0); c.lineTo(x + Hh * 0.6, Hh); }
      for (let x = -Hh; x < W + Hh; x += step) { c.moveTo(x, 0); c.lineTo(x - Hh * 0.6, Hh); }
      c.stroke();
      break;
    }
  }
}

/**
 * The figure of light in the night, baked into the composite: pearl light, warm at the head and the heart, cool toward
 * the feet; a soft halo and a thin warm contour; dimmer and cooler while the body's own web is dull.  No face.
 */
function figure(c: CanvasRenderingContext2D, L: Layout, ox: number, oy: number, bright: boolean): void {
  const H = L.fig.H, map = mapper(L, ox, oy);
  const sil = figurePath(map);
  const [, y0] = map(0, 0), [, y1] = map(0, 1);
  c.lineJoin = 'round';
  c.strokeStyle = bright ? 'rgba(220,236,255,.2)' : 'rgba(170,184,214,.12)';
  c.lineWidth = Math.max(5, H * 0.03);
  c.stroke(sil);
  const body = c.createLinearGradient(0, y0, 0, y1);
  if (bright) {
    body.addColorStop(0, 'rgba(255,250,236,.97)');
    body.addColorStop(0.3, 'rgba(255,248,240,.94)');
    body.addColorStop(0.7, 'rgba(232,240,255,.9)');
    body.addColorStop(1, 'rgba(214,228,252,.88)');
  } else {
    body.addColorStop(0, 'rgba(206,206,222,.86)');
    body.addColorStop(0.4, 'rgba(188,192,214,.82)');
    body.addColorStop(1, 'rgba(150,160,190,.78)');
  }
  c.fillStyle = body;
  c.fill(sil);
  c.save();
  c.clip(sil);
  for (const [y, r, a] of [[0.07, 0.07, 0.5], [0.27, 0.16, 0.55], [0.5, 0.13, 0.25]] as const) {
    const [gx, gy] = map(0, y);
    const rg = c.createRadialGradient(gx, gy, 0, gx, gy, r * H);
    rg.addColorStop(0, `rgba(255,255,248,${bright ? a : a * 0.5})`);
    rg.addColorStop(1, 'rgba(255,255,248,0)');
    c.fillStyle = rg;
    c.fillRect(gx - r * H, gy - r * H, 2 * r * H, 2 * r * H);
  }
  c.restore();
  c.strokeStyle = bright ? 'rgba(200,170,120,.55)' : 'rgba(120,120,150,.5)';
  c.lineWidth = Math.max(1, H * 0.004);
  c.stroke(sil);
}

/**
 * The seven layers and the figure as composites, one per set of cleared layers (a bit mask, layer k = bit k), baked a
 * layer at a time over frames (`step`), so the next composite is ready before a layer closes.  A composite is the
 * egg's box (layout `egg`).
 */
export class EggBaker {
  private readonly done = new Map<number, Layer>();
  private job: { mask: number; c: Layer; ctx: CanvasRenderingContext2D; i: number } | null = null;
  private tmp: { c: Layer; ctx: CanvasRenderingContext2D } | null = null;
  private readonly queue: number[] = [];
  /** the order of the work: the bands from the outside in, the figure, the web */
  private static readonly ORDER = [6, 5, 4, 3, 2, 1, -1, 0];

  constructor(private readonly L: Layout, private readonly dpr: number) {}

  /** The composite for `mask`, baked now if it is not ready. */
  get(mask: number): Layer | null {
    const hit = this.done.get(mask);
    if (hit) return hit;
    if (this.job?.mask === mask) {
      while (this.job && this.job.mask === mask) this.step();
      return this.done.get(mask) ?? null;
    }
    this.start(mask);
    while (this.job && this.job.mask === mask) this.step();
    return this.done.get(mask) ?? null;
  }

  /** Bake `mask` in the background (a layer a frame). */
  want(mask: number): void {
    if (this.done.has(mask) || this.job?.mask === mask || this.queue.includes(mask)) return;
    this.queue.push(mask);
  }

  /** Forget the composites not in `keep` (a few stay: the one shown and the next). */
  keep(masks: readonly number[]): void {
    for (const m of [...this.done.keys()]) if (!masks.includes(m)) this.done.delete(m);
  }

  /** One step of the background work (call once a frame). */
  step(): void {
    if (!this.job) {
      const m = this.queue.shift();
      if (m === undefined) return;
      if (this.done.has(m)) return;
      this.start(m);
      if (!this.job) return;
    }
    const job = this.job;
    const k = EggBaker.ORDER[job.i++];
    const { L } = this;
    const box = L.egg;
    if (k === -1) figure(job.ctx, L, box.x, box.y, (job.mask & 1) !== 0);
    else this.band(job.ctx, k, (job.mask & (1 << k)) !== 0);
    if (job.i >= EggBaker.ORDER.length) {
      this.done.set(job.mask, job.c);
      this.job = null;
    }
  }

  private start(mask: number): void {
    const box = this.L.egg;
    const B = layer(box.w, box.h, this.dpr);
    if (!B) return;
    this.job = { mask, c: B.c, ctx: B.ctx, i: 0 };
  }

  /** One layer into the composite: its texture masked to its band, its rim, added as light. */
  private band(dst: CanvasRenderingContext2D, k: number, clear: boolean): void {
    const L = this.L, box = L.egg, H = L.fig.H;
    if (!this.tmp) this.tmp = layer(box.w, box.h, this.dpr);
    const T = this.tmp;
    if (!T) return;
    const c = T.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, T.c.width, T.c.height);
    c.restore();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    texture(c, L, k, clear, box.x, box.y);
    if (k === 0) {
      // the web: a sheath close to the body, outside it
      const sil = figurePath(mapper(L, box.x, box.y));
      c.globalCompositeOperation = 'destination-in';
      c.lineJoin = 'round';
      c.strokeStyle = '#000';
      c.lineWidth = H * 0.075;
      c.stroke(sil);
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000';
      c.fill(sil);
      c.globalCompositeOperation = 'source-over';
      // a soft sheath glow along it
      c.strokeStyle = rgba(clear ? '#bfe6ff' : '#6f7f96', clear ? 0.22 : 0.12);
      c.lineWidth = H * 0.04;
      c.stroke(sil);
    } else {
      c.globalCompositeOperation = 'destination-in';
      c.fillStyle = '#000';
      c.fill(eggPath(L, EGGS[k], box.x, box.y));
      c.globalCompositeOperation = 'destination-out';
      c.fill(eggPath(L, EGGS[k - 1], box.x, box.y));
      c.globalCompositeOperation = 'source-over';
    }
    dst.save();
    dst.setTransform(1, 0, 0, 1, 0, 0);
    dst.globalCompositeOperation = clear ? 'lighter' : 'source-over';
    dst.drawImage(T.c, 0, 0);
    dst.restore();
    if (k > 0) {
      // the rim of the layer: a soft line of its light
      const { rim } = tones(k, clear);
      const rimPath = eggPath(L, EGGS[k], box.x, box.y);
      dst.save();
      dst.globalCompositeOperation = clear ? 'lighter' : 'source-over';
      dst.strokeStyle = rgba(rim, clear ? 0.16 : 0.08);
      dst.lineWidth = H * 0.014;
      dst.stroke(rimPath);
      dst.strokeStyle = rgba(rim, clear ? 0.55 : 0.3);
      dst.lineWidth = Math.max(0.8, H * 0.0035);
      dst.stroke(rimPath);
      dst.restore();
    }
  }
}

// ── the things that cling ─────────────────────────────────────────

/** The dark of a clinging thing and its rim (dark but not horror: a clear shape with a soft edge of light). */
const DARK: Readonly<Record<Thing, { body: string; rim: string }>> = {
  thorn: { body: '#3a2622', rim: '#a8806a' },
  stain: { body: '#1c1828', rim: '#5e5674' },
  dart: { body: '#2a2230', rim: '#9a86a8' },
  cord: { body: '#4a2a36', rim: '#b07888' },
  chain: { body: '#252c44', rim: '#8a98c4' },
  ash: { body: '#4a4650', rim: '#9a96a2' },
  crack: { body: '#241a10', rim: '#a88a58' },
};

/**
 * A clinging thing at (x, y), `s` px across, turned by `rot`; `lit` (0..1) how far it has turned to light as it
 * rises; `seed`/`variant` choose its own shape.  The crack is drawn as the sliver wedged in it (`crackLine` draws the
 * crack itself, which stays in the shell until its wound closes).
 */
export function drawThing(ctx: CanvasRenderingContext2D, thing: Thing, variant: number, seed: number, x: number, y: number, s: number, rot: number, lit: number, alpha: number, hue: string): void {
  if (alpha <= 0.01 || s < 1) return;
  const d = DARK[thing];
  const body = mix(d.body, mix(hue, '#ffffff', 0.5), lit);
  const rim = mix(d.rim, '#ffffff', lit);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const lw = Math.max(0.8, s * 0.06);
  switch (thing) {
    case 'thorn': {
      const one = (dx: number, sc: number, tilt: number): void => {
        ctx.save();
        ctx.translate(dx * s, 0);
        ctx.rotate(tilt);
        ctx.scale(sc, sc);
        ctx.beginPath();
        ctx.moveTo(-0.3 * s, 0.32 * s);
        ctx.quadraticCurveTo(-0.08 * s, 0.05 * s, 0.16 * s, -0.55 * s);
        ctx.quadraticCurveTo(0.08 * s, 0.02 * s, 0.3 * s, 0.32 * s);
        ctx.quadraticCurveTo(0, 0.4 * s, -0.3 * s, 0.32 * s);
        ctx.closePath();
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = rim;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();
      };
      if (variant % 2) {
        // two thorns on a short piece of twig
        ctx.strokeStyle = body;
        ctx.lineWidth = s * 0.14;
        ctx.beginPath();
        ctx.moveTo(-0.55 * s, 0.35 * s);
        ctx.quadraticCurveTo(0, 0.2 * s, 0.55 * s, 0.4 * s);
        ctx.stroke();
        one(-0.22, 0.7, -0.35);
        one(0.25, 0.8, 0.3);
      } else one(0, 1, 0);
      break;
    }
    case 'stain': {
      ctx.beginPath();
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const r = s * (0.36 + 0.16 * hash(seed + i * 1.9));
        const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.85;
        if (i) {
          const am = ((i - 0.5) / n) * TAU, rm = s * (0.3 + 0.1 * hash(seed + i * 4.3));
          ctx.quadraticCurveTo(Math.cos(am) * rm * 1.25, Math.sin(am) * rm * 1.05, px, py);
        } else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.globalAlpha = alpha * 0.92;
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = rgba(rim, 0.55);
      ctx.lineWidth = lw;
      ctx.stroke();
      // a drop or two beside it
      ctx.fillStyle = body;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(s * (0.45 + 0.1 * i) * (i ? -1 : 1), s * (0.32 - 0.5 * i), s * (0.07 + 0.03 * i), 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'dart': {
      if (variant === 0) {
        // a dart: the shaft, the head, the fletching; an ember at the tip fading as it turns to light
        ctx.strokeStyle = body;
        ctx.lineWidth = s * 0.09;
        ctx.beginPath();
        ctx.moveTo(0, 0.55 * s);
        ctx.lineTo(0, -0.3 * s);
        ctx.stroke();
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(0, -0.62 * s);
        ctx.lineTo(0.16 * s, -0.26 * s);
        ctx.lineTo(-0.16 * s, -0.26 * s);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rim;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0.35 * s); ctx.lineTo(-0.18 * s, 0.6 * s);
        ctx.moveTo(0, 0.35 * s); ctx.lineTo(0.18 * s, 0.6 * s);
        ctx.moveTo(0, 0.48 * s); ctx.lineTo(-0.16 * s, 0.72 * s);
        ctx.moveTo(0, 0.48 * s); ctx.lineTo(0.16 * s, 0.72 * s);
        ctx.stroke();
        if (lit < 0.6) {
          ctx.restore();
          const tipX = x + Math.sin(rot) * 0.55 * s, tipY = y - Math.cos(rot) * 0.55 * s;
          glow(ctx, '#ff9a5a', tipX, tipY, s * 0.42, alpha * 0.7 * (1 - lit / 0.6));
          return;
        }
      } else {
        // a spiky thought: a dark burr
        const n = variant === 1 ? 9 : 7;
        ctx.beginPath();
        for (let i = 0; i < 2 * n; i++) {
          const a = (i / (2 * n)) * TAU + 0.2;
          const r = i % 2 ? s * 0.2 : s * (0.46 + 0.1 * hash(seed + i));
          if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = rim;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
      break;
    }
    case 'cord': {
      // a short twisted rope with a knot; its tail runs outward (it ties to someone, to something)
      const tail = lit > 0 ? 0.5 : 1.25;
      ctx.strokeStyle = body;
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.moveTo(-0.55 * s, 0.15 * s);
      ctx.bezierCurveTo(-0.2 * s, -0.35 * s, 0.2 * s, 0.45 * s, (0.4 + tail) * s, -0.05 * s);
      ctx.stroke();
      ctx.strokeStyle = rgba(rim, 0.8);
      ctx.lineWidth = Math.max(0.7, s * 0.05);
      ctx.setLineDash([s * 0.12, s * 0.1]);
      ctx.stroke();
      ctx.setLineDash([]);
      // the knot
      ctx.strokeStyle = body;
      ctx.lineWidth = s * 0.15;
      ctx.beginPath();
      ctx.ellipse(-0.05 * s, 0.02 * s, 0.2 * s, 0.14 * s, 0.6, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rim;
      ctx.lineWidth = lw;
      ctx.stroke();
      break;
    }
    case 'chain': {
      if (variant === 1) {
        // a knot: a loop over a loop
        ctx.strokeStyle = body;
        ctx.lineWidth = s * 0.15;
        ctx.beginPath();
        ctx.moveTo(-0.55 * s, 0.25 * s);
        ctx.bezierCurveTo(-0.1 * s, -0.6 * s, 0.45 * s, 0.1 * s, 0, 0.2 * s);
        ctx.bezierCurveTo(-0.45 * s, 0.3 * s, 0.1 * s, -0.55 * s, 0.55 * s, -0.2 * s);
        ctx.stroke();
        ctx.strokeStyle = rim;
        ctx.lineWidth = lw;
        ctx.stroke();
      } else {
        // three links of a chain, alternately open and on edge
        for (let i = -1; i <= 1; i++) {
          ctx.save();
          ctx.translate(i * 0.34 * s, 0);
          ctx.strokeStyle = body;
          ctx.lineWidth = s * 0.12;
          ctx.beginPath();
          if (i === 0) ctx.ellipse(0, 0, 0.23 * s, 0.07 * s, 0, 0, TAU);
          else ctx.ellipse(0, 0, 0.23 * s, 0.15 * s, 0, 0, TAU);
          ctx.stroke();
          ctx.strokeStyle = rim;
          ctx.lineWidth = lw;
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }
    case 'ash': {
      // a drift of grey flakes
      for (let i = 0; i < 13; i++) {
        const a = hash(seed + i * 2.1) * TAU, r = s * 0.5 * Math.sqrt(hash(seed + i * 3.3));
        const fx = Math.cos(a) * r * (1 + lit), fy = Math.sin(a) * r * 0.7 * (1 + lit);
        const fs = s * (0.06 + 0.07 * hash(seed + i * 5.5));
        ctx.fillStyle = mix(hash(seed + i) > 0.5 ? '#3e3a44' : '#7a7680', '#ffffff', lit);
        ctx.beginPath();
        ctx.moveTo(fx - fs, fy);
        ctx.lineTo(fx, fy - fs * 0.7);
        ctx.lineTo(fx + fs * 1.1, fy + fs * 0.1);
        ctx.lineTo(fx + fs * 0.1, fy + fs * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'crack': {
      // the dark sliver wedged in the crack
      ctx.beginPath();
      ctx.moveTo(0, -0.5 * s);
      ctx.lineTo(0.1 * s, 0.1 * s);
      ctx.lineTo(0.02 * s, 0.45 * s);
      ctx.lineTo(-0.09 * s, 0.05 * s);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.lineWidth = lw;
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/** The crack in the golden shell where a sliver is (or was): dark while it holds one, sealed with gold as it closes. */
export function crackLine(ctx: CanvasRenderingContext2D, seed: number, x: number, y: number, s: number, rot: number, gold: number, alpha: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot + Math.PI / 2);
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const u = i / n - 0.5;
    const px = u * 1.6 * s, py = (hash(seed + i * 2.7) - 0.5) * 0.28 * s;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.strokeStyle = mix('#1e160c', GOLD, gold);
  ctx.lineWidth = Math.max(1, s * (0.1 - 0.04 * gold));
  ctx.stroke();
  if (gold > 0) {
    ctx.strokeStyle = rgba('#fff3cf', gold);
    ctx.lineWidth = Math.max(0.7, s * 0.03);
    ctx.stroke();
  }
  ctx.restore();
}

/** Points of the body's outline a little outside it (figure units): where the web's glints travel. */
export const WEB_PATH: readonly Pt[] = OUTLINE.map(([x, y]) => [x * 1.12 + Math.sign(x) * 0.004, y < 0.5 ? y - 0.004 : y] as Pt);
