/**
 * Brzemiona's pictures, drawn in code (no images): a dusk sky of grey-violet warming to gold over the session, a far
 * ridge, a low dark hill with the Cross of light on it (a simple luminous cross — not a crucifix, no body), the near
 * ground; the figure of light of the series (kit/figure.ts) — greyed for the one prayed for until the light returns
 * to them, clear for the player; a night globe of lights for the whole world; soft grey smoke and gold light; and
 * (the own way, round 16) the player's burden as a closed bundle — a tied cloth sack, dark and then paler as it is
 * given, never opened.
 * Light is light: additive glows from small baked sprites, never shadowBlur per frame; the sky, the ground, the
 * figures, the Cross and the globe are baked once per size, so a frame composes layers and a few dozen sprites.
 */
import { FIG_HALF, figurePath } from '../kit/figure';
import { MIN_TEXT } from '../kit/mobile';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const GOLD = '#ffd98a';
export const GOLD_HI = '#fff1c9';
export const PEARL = '#f4efff';
export const SMOKE = '#b6adc2';
export const SMOKE_DARK = '#8b8299';
export const LILAC = '#cfc4e8';
export const INK = 'rgba(14,10,24,.78)';
export const TAU = Math.PI * 2;

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

/**
 * Text fitted into a width and at most `maxLines` lines: from `px` down to `min` (never under MIN_TEXT), wrapping; only
 * past that is the last line shortened with "…".  Sets ctx.font; returns the lines and the size.
 */
export function fitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min: number, maxLines: number, weight = 600, serif = false, italic = false): { lines: string[]; size: number } {
  let size = fontPx(Math.max(min, px));
  for (;;) {
    ctx.font = font(size, weight, serif, italic);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) return { lines, size };
    if (size <= Math.max(MIN_TEXT, min)) {
      const keep = lines.slice(0, maxLines);
      if (lines.length > maxLines) {
        let last = keep[maxLines - 1];
        while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
        keep[maxLines - 1] = `${last.trimEnd()}…`;
      }
      return { lines: keep, size };
    }
    size = Math.max(Math.max(MIN_TEXT, min), size - 0.5);
  }
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

export function rgbaPrefix(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},`;
}
export const rgba = (hex: string, a: number): string => `${rgbaPrefix(hex)}${Math.max(0, Math.min(1, a)).toFixed(3)})`;

export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** A deterministic 0..1 for an integer (decorations that never jump). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export type Layer = HTMLCanvasElement;

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

// ── sprites ──────────────────────────────────────────────────────
const sprites = new Map<string, Layer>();

/** A soft round glow in a colour (64 px, baked once): drawn scaled, additively, for light. */
export function glowSprite(hex: string): Layer | null {
  const hit = sprites.get(`g${hex}`);
  if (hit) return hit;
  const L = layer(64, 64, 1);
  if (!L) return null;
  const pre = rgbaPrefix(hex);
  const g = L.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `${pre}1)`);
  g.addColorStop(0.22, `${pre}.6)`);
  g.addColorStop(0.5, `${pre}.2)`);
  g.addColorStop(0.8, `${pre}.05)`);
  g.addColorStop(1, `${pre}0)`);
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 64, 64);
  sprites.set(`g${hex}`, L.c);
  return L.c;
}

export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  const s = glowSprite(hex);
  if (!s || a <= 0.003 || r <= 0.5) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1;
}

/** A puff of smoke: a soft, slightly lumpy grey ball (baked once), drawn normally (smoke is not light). */
export function puffSprite(hex: string): Layer | null {
  const hit = sprites.get(`p${hex}`);
  if (hit) return hit;
  const L = layer(64, 64, 1);
  if (!L) return null;
  const pre = rgbaPrefix(hex);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU, d = i ? 9 : 0;
    const x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d * 0.8, r = i ? 17 : 22;
    const g = L.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${pre}.42)`);
    g.addColorStop(0.55, `${pre}.2)`);
    g.addColorStop(1, `${pre}0)`);
    L.ctx.fillStyle = g;
    L.ctx.fillRect(0, 0, 64, 64);
  }
  sprites.set(`p${hex}`, L.c);
  return L.c;
}

export function puff(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  const s = puffSprite(hex);
  if (!s || a <= 0.003 || r <= 0.5) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1;
}

// ── the sky and the ground ───────────────────────────────────────
export interface Ground {
  ridgeY: number; hillY: number; nearY: number; hillX: number; hillW: number; orient: 'across' | 'down'; personX: number; playerX: number; crossY: number;
  /** the own way, across: the near ground is level from here to the player's feet (the bundle stands on it) */
  flatX?: number;
}

/**
 * The sky and the land, baked: `warm` 0 is dusk (grey-violet with a rose horizon and the first stars), 1 the warm
 * gold that rises over a session as burdens are carried.  The horizon glows behind the Cross.  The far ridge (where
 * the one prayed for stands), the low hill of the Cross and the near ground (the player's) are silhouettes with a
 * thin rim of the horizon's light along their tops only.
 */
export function bakeSky(w: number, h: number, dpr: number, warm: boolean, gr: Ground): Layer | null {
  const L = layer(w, h, dpr);
  if (!L) return null;
  const ctx = L.ctx;
  const hz = gr.ridgeY;
  const g = ctx.createLinearGradient(0, 0, 0, hz);
  if (warm) {
    g.addColorStop(0, '#2b1e3e');
    g.addColorStop(0.45, '#6e4a6c');
    g.addColorStop(0.8, '#c9845f');
    g.addColorStop(1, '#f3c98c');
  } else {
    g.addColorStop(0, '#15101f');
    g.addColorStop(0.5, '#352c4a');
    g.addColorStop(0.85, '#5e5070');
    g.addColorStop(1, '#8a7486');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // the glow of the horizon behind the Cross (an ellipse of light low in the sky)
  ctx.save();
  ctx.translate(gr.hillX, hz);
  ctx.scale(1, 0.42);
  const R = Math.max(w, hz * 2) * 0.62;
  const band = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  band.addColorStop(0, warm ? 'rgba(255,226,160,.85)' : 'rgba(236,190,170,.42)');
  band.addColorStop(0.35, warm ? 'rgba(255,190,120,.35)' : 'rgba(190,150,180,.18)');
  band.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = band;
  ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.restore();
  // long soft clouds, lit from below
  for (let i = 0; i < 11; i++) {
    const x = hash(i * 3 + 1) * w, y = (0.12 + hash(i * 3 + 2) * 0.7) * hz, rw = (0.14 + hash(i * 7) * 0.22) * w;
    const cg = ctx.createRadialGradient(x, y, 0, x, y, rw);
    const near = y / hz;
    cg.addColorStop(0, warm ? `rgba(255,${Math.round(170 + 50 * near)},150,${(0.08 + 0.12 * near).toFixed(3)})` : `rgba(190,170,210,${(0.05 + 0.08 * near).toFixed(3)})`);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.16);
    ctx.translate(-x, -y);
    ctx.fillStyle = cg;
    ctx.fillRect(x - rw, y - rw, 2 * rw, 2 * rw);
    ctx.restore();
  }
  if (!warm) {
    for (let i = 0; i < 80; i++) {
      const x = hash(i * 5 + 11) * w, y = hash(i * 5 + 12) * hz * 0.75, r = 0.4 + hash(i * 5 + 13) * 0.9;
      ctx.fillStyle = `rgba(240,232,255,${((0.18 + 0.5 * hash(i * 5 + 14)) * (1 - y / (hz * 0.8))).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }
  drawGround(ctx, w, h, warm, gr);
  return L.c;
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, warm: boolean, gr: Ground): void {
  const rim = (a: number) => (warm ? `rgba(255,214,156,${a})` : `rgba(226,204,236,${a})`);
  const C = warm
    ? { far: '#4a3243', farLo: '#2e1f2c', hill: '#3a2733', hillLo: '#1f1520', near: '#24182a', nearLo: '#140d18' }
    : { far: '#2b2238', farLo: '#1a1524', hill: '#241c2f', hillLo: '#120e19', near: '#18121f', nearLo: '#0c0911' };
  const fillDown = (top: (path: Path2D) => void, y0: number, c0: string, c1: string, rimA: number, lw = 1.2) => {
    const edge = new Path2D();
    top(edge);
    const body = new Path2D();
    top(body);
    body.lineTo(w + 2, h + 2);
    body.lineTo(-2, h + 2);
    body.closePath();
    const g = ctx.createLinearGradient(0, y0, 0, h);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fill(body);
    ctx.strokeStyle = rim(rimA);
    ctx.lineWidth = lw;
    ctx.stroke(edge);
  };
  // the far ridge across the whole width, gently uneven
  const ridge = (path: Path2D) => {
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * (w + 4) - 2;
      const y = gr.ridgeY + Math.sin(i * 0.55 + 1.3) * h * 0.006 + (hash(i + 17) - 0.5) * h * 0.008;
      if (i) path.lineTo(x, y); else path.moveTo(x, y);
    }
  };
  fillDown(ridge, gr.ridgeY, C.far, C.farLo, 0.38);
  // the low hill of the Cross: a mound rising from the land, its rim lit by the horizon
  const x = gr.hillX, hw = gr.hillW, top = gr.crossY - 1;
  const base = gr.orient === 'across' ? gr.ridgeY + h * 0.012 : gr.hillY + h * 0.07;
  const hill = (path: Path2D) => {
    path.moveTo(-2, base + h * 0.02);
    path.lineTo(x - hw, base);
    path.bezierCurveTo(x - hw * 0.5, base, x - hw * 0.32, top, x, top);
    path.bezierCurveTo(x + hw * 0.32, top, x + hw * 0.5, base, x + hw, base);
    path.lineTo(w + 2, base + h * 0.02);
  };
  const hillPath = new Path2D();
  hill(hillPath);
  hillPath.lineTo(w + 2, h + 2);
  hillPath.lineTo(-2, h + 2);
  hillPath.closePath();
  const hg = ctx.createLinearGradient(0, top, 0, h);
  hg.addColorStop(0, C.hill);
  hg.addColorStop(1, C.hillLo);
  ctx.fillStyle = hg;
  ctx.fill(hillPath);
  // the crest's rim of light, fading out down both slopes
  const crest = new Path2D();
  crest.moveTo(x - hw * 0.7, base - (base - top) * 0.15);
  crest.bezierCurveTo(x - hw * 0.45, base - (base - top) * 0.6, x - hw * 0.3, top, x, top);
  crest.bezierCurveTo(x + hw * 0.3, top, x + hw * 0.45, base - (base - top) * 0.6, x + hw * 0.7, base - (base - top) * 0.15);
  const cg = ctx.createLinearGradient(x - hw * 0.7, 0, x + hw * 0.7, 0);
  cg.addColorStop(0, rim(0));
  cg.addColorStop(0.3, rim(0.5));
  cg.addColorStop(0.5, rim(0.75));
  cg.addColorStop(0.7, rim(0.5));
  cg.addColorStop(1, rim(0));
  ctx.strokeStyle = cg;
  ctx.lineWidth = 1.4;
  ctx.stroke(crest);
  // the near ground: the player's, in front
  if (gr.orient === 'across') {
    // a foreground band across the bottom, rising gently to the player's feet on the right
    const yl = Math.max(gr.nearY + h * 0.06, gr.ridgeY + h * 0.1);
    const flat = gr.flatX !== undefined ? Math.min(gr.flatX, gr.playerX) : gr.playerX;
    fillDown(path => {
      path.moveTo(-2, yl);
      path.quadraticCurveTo(flat - w * 0.24, gr.nearY + h * 0.05, flat, gr.nearY);
      if (flat < gr.playerX) path.lineTo(gr.playerX, gr.nearY);
      path.quadraticCurveTo(gr.playerX + (w - gr.playerX) * 0.5, gr.nearY - h * 0.004, w + 2, gr.nearY + h * 0.008);
    }, gr.nearY, C.near, C.nearLo, 0.2);
  } else {
    fillDown(path => {
      path.moveTo(-2, gr.nearY - h * 0.03);
      path.quadraticCurveTo(w * 0.5, gr.nearY - h * 0.055, w + 2, gr.nearY - h * 0.03);
    }, gr.nearY - h * 0.06, C.near, C.nearLo, 0.22);
  }
}

// ── the Cross of light ───────────────────────────────────────────
/** The Cross (its foot at the bottom middle of the layer), baked once per size: a white-gold core, a soft glow. */
export function bakeCross(hgt: number, arm: number, dpr: number): { c: Layer; w: number; h: number; ox: number; oy: number } | null {
  const pad = Math.ceil(hgt * 0.28);
  const W = Math.ceil(arm * 2 + pad * 2), H = Math.ceil(hgt + pad * 2);
  const L = layer(W, H, dpr);
  if (!L) return null;
  const ctx = L.ctx;
  const cx = W / 2, foot = pad + hgt;
  const bw = Math.max(3, hgt * 0.058), barY = pad + hgt * 0.27;
  const shape = () => {
    ctx.beginPath();
    rrPath(ctx, cx - bw / 2, pad, bw, hgt, bw / 2);
    rrPath(ctx, cx - arm, barY - bw / 2, arm * 2, bw, bw / 2);
  };
  // its glow (baked: shadowBlur once)
  ctx.save();
  ctx.shadowColor = 'rgba(255,214,140,.9)';
  ctx.shadowBlur = Math.max(8, hgt * 0.12);
  shape();
  ctx.fillStyle = 'rgba(255,226,170,.7)';
  ctx.fill();
  ctx.restore();
  // the core: white at the middle of each beam, gold at its edges
  const gv = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
  gv.addColorStop(0, '#f6c870');
  gv.addColorStop(0.5, '#fffaf0');
  gv.addColorStop(1, '#f6c870');
  ctx.beginPath();
  rrPath(ctx, cx - bw / 2, pad, bw, hgt, bw / 2);
  ctx.fillStyle = gv;
  ctx.fill();
  const gh = ctx.createLinearGradient(0, barY - bw / 2, 0, barY + bw / 2);
  gh.addColorStop(0, '#f6c870');
  gh.addColorStop(0.5, '#fffaf0');
  gh.addColorStop(1, '#f6c870');
  ctx.beginPath();
  rrPath(ctx, cx - arm, barY - bw / 2, arm * 2, bw, bw / 2);
  ctx.fillStyle = gh;
  ctx.fill();
  return { c: L.c, w: W, h: H, ox: cx, oy: foot };
}

function rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

// ── the figure of light ──────────────────────────────────────────
export type FigureStyle = 'lit' | 'grey' | 'clear';

/**
 * The series' figure of light (kit/figure.ts) baked at a height: `lit` — warm light, a gold rim (the one prayed for
 * as the light returns); `grey` — the same figure dimmed and greyed (under their burden); `clear` — pearl light, a
 * silver-gold rim (the player).  Its feet at the bottom middle of the layer.
 */
export function bakeFigure(H: number, style: FigureStyle, dpr: number): { c: Layer; w: number; h: number; ox: number; oy: number } | null {
  const pad = Math.ceil(Math.max(6, H * 0.1));
  const W = Math.ceil(FIG_HALF * 2 * H + pad * 2), HH = Math.ceil(H + pad * 2);
  const L = layer(W, HH, dpr);
  if (!L) return null;
  const ctx = L.ctx;
  const cx = W / 2, top = pad;
  const path = figurePath((x, y) => [cx + x * H, top + y * H]);
  const col = style === 'grey'
    ? { halo: 'rgba(150,140,165,.25)', top: 'rgba(160,152,176,.62)', mid: 'rgba(120,112,136,.55)', low: 'rgba(92,86,108,.5)', rim: 'rgba(190,182,206,.55)' }
    : style === 'lit'
      ? { halo: 'rgba(255,214,150,.55)', top: 'rgba(255,246,222,.95)', mid: 'rgba(255,226,170,.78)', low: 'rgba(236,196,150,.62)', rim: 'rgba(255,224,160,.95)' }
      : { halo: 'rgba(220,214,255,.45)', top: 'rgba(250,247,255,.92)', mid: 'rgba(226,220,250,.72)', low: 'rgba(196,190,232,.58)', rim: 'rgba(255,240,206,.9)' };
  ctx.save();
  ctx.shadowColor = col.halo;
  ctx.shadowBlur = Math.max(4, H * (style === 'grey' ? 0.05 : 0.1));
  const g = ctx.createLinearGradient(0, top, 0, top + H);
  g.addColorStop(0, col.top);
  g.addColorStop(0.35, col.mid);
  g.addColorStop(1, col.low);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.restore();
  // an inner glow on the chest (the heart), warmer for the lit figure
  if (style !== 'grey') {
    const hy = top + 0.27 * H;
    const ig = ctx.createRadialGradient(cx, hy, 0, cx, hy, H * 0.2);
    ig.addColorStop(0, style === 'lit' ? 'rgba(255,250,232,.8)' : 'rgba(255,252,255,.6)');
    ig.addColorStop(1, 'rgba(255,250,232,0)');
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = ig;
    ctx.fillRect(0, 0, W, HH);
    ctx.restore();
  }
  // the rim of light, outside the silhouette only (no seam at a wrist or an ankle)
  const R = layer(W, HH, dpr);
  if (R) {
    R.ctx.strokeStyle = col.rim;
    R.ctx.lineWidth = Math.max(1.2, H * 0.012) * 2;
    R.ctx.lineJoin = 'round';
    R.ctx.stroke(path);
    R.ctx.globalCompositeOperation = 'destination-out';
    R.ctx.fill(path);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(R.c, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return { c: L.c, w: W, h: HH, ox: cx, oy: top + H };
}

// ── the bundle (the own way) ─────────────────────────────────────
export type BundleTone = 'dark' | 'pale';

/**
 * The player's burden as a closed bundle, baked once per size: a cloth sack with a soft belly, gathered and tied at
 * the neck with a cord, the cloth's ends above the knot; `dark` — slate violet with a thin warm rim from the horizon
 * (the burden as it is brought), `pale` — light grey-lilac with a gold rim (as it is given).  Its base at the bottom
 * middle of the layer; a soft shadow on the ground.  Never drawn open.
 */
export function bakeBundle(H: number, tone: BundleTone, dpr: number): { c: Layer; w: number; h: number; ox: number; oy: number } | null {
  const w = H * 1.0, pad = Math.ceil(Math.max(4, H * 0.18));
  const W = Math.ceil(w * 1.4 + pad * 2), HH = Math.ceil(H * 1.08 + pad * 2);
  const L = layer(W, HH, dpr);
  if (!L) return null;
  const ctx = L.ctx;
  const cx = W / 2, by = pad + H * 1.04;
  const col = tone === 'dark'
    ? { top: '#5a4e6a', mid: '#3a3148', low: '#1f1a29', rim: 'rgba(236,196,164,.55)', cord: '#9a8770', fold: 'rgba(12,8,20,.24)', shade: 'rgba(6,4,12,.45)' }
    : { top: '#ddd5e8', mid: '#b8aecb', low: '#8f86a3', rim: 'rgba(255,226,170,.85)', cord: '#f0dcae', fold: 'rgba(80,70,100,.22)', shade: 'rgba(6,4,12,.25)' };
  // the shadow on the ground
  const sh = ctx.createRadialGradient(cx, by, 0, cx, by, w * 0.6);
  sh.addColorStop(0, col.shade);
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(1, 0.22);
  ctx.translate(-cx, -by);
  ctx.fillStyle = sh;
  ctx.fillRect(cx - w, by - w, 2 * w, 2 * w);
  ctx.restore();
  // the body: a soft belly gathered at the neck
  const neckY = by - H * 0.74, nw = w * 0.17;
  const body = new Path2D();
  body.moveTo(cx - nw, neckY);
  body.bezierCurveTo(cx - w * 0.6, by - H * 0.62, cx - w * 0.62, by - H * 0.05, cx - w * 0.34, by);
  body.quadraticCurveTo(cx, by + H * 0.035, cx + w * 0.34, by);
  body.bezierCurveTo(cx + w * 0.62, by - H * 0.05, cx + w * 0.6, by - H * 0.62, cx + nw, neckY);
  body.closePath();
  const g = ctx.createLinearGradient(cx - w * 0.4, neckY, cx + w * 0.2, by);
  g.addColorStop(0, col.top);
  g.addColorStop(0.45, col.mid);
  g.addColorStop(1, col.low);
  ctx.fillStyle = g;
  ctx.fill(body);
  // folds running down from the neck
  ctx.strokeStyle = col.fold;
  ctx.lineWidth = Math.max(1, H * 0.025);
  ctx.lineCap = 'round';
  for (const [dx, bend, end] of [[-0.06, -0.22, 0.3], [0.04, 0.16, 0.22], [0.1, 0.3, 0.42]] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + w * dx * 0.6, neckY + H * 0.07);
    ctx.quadraticCurveTo(cx + w * (dx + bend * 0.8), by - H * 0.5, cx + w * (dx + bend), by - H * end);
    ctx.stroke();
  }
  // the rim of the horizon's light along the left shoulder (the Cross's side)
  const rim = new Path2D();
  rim.moveTo(cx - nw, neckY);
  rim.bezierCurveTo(cx - w * 0.6, by - H * 0.62, cx - w * 0.62, by - H * 0.05, cx - w * 0.34, by);
  ctx.strokeStyle = col.rim;
  ctx.lineWidth = Math.max(1, H * 0.035);
  ctx.stroke(rim);
  // the cloth's ends above the knot
  const top = new Path2D();
  top.moveTo(cx - nw * 0.9, neckY + H * 0.02);
  top.quadraticCurveTo(cx - w * 0.3, by - H * 0.92, cx - w * 0.2, by - H * 1.0);
  top.quadraticCurveTo(cx - w * 0.04, by - H * 0.86, cx + w * 0.02, by - H * 0.95);
  top.quadraticCurveTo(cx + w * 0.12, by - H * 0.86, cx + w * 0.24, by - H * 0.98);
  top.quadraticCurveTo(cx + w * 0.28, by - H * 0.86, cx + nw * 0.9, neckY + H * 0.02);
  top.closePath();
  const tg = ctx.createLinearGradient(0, by - H, 0, neckY);
  tg.addColorStop(0, col.mid);
  tg.addColorStop(1, col.top);
  ctx.fillStyle = tg;
  ctx.fill(top);
  ctx.strokeStyle = col.rim;
  ctx.lineWidth = Math.max(0.8, H * 0.02);
  ctx.stroke(top);
  // the cord: a band round the neck and a short loose end
  ctx.strokeStyle = col.cord;
  ctx.lineWidth = Math.max(1.4, H * 0.055);
  ctx.beginPath();
  ctx.moveTo(cx - nw * 1.25, neckY + H * 0.01);
  ctx.quadraticCurveTo(cx, neckY + H * 0.06, cx + nw * 1.25, neckY + H * 0.01);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, H * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx + nw * 0.9, neckY + H * 0.03);
  ctx.quadraticCurveTo(cx + nw * 1.6, neckY + H * 0.12, cx + nw * 1.3, neckY + H * 0.22);
  ctx.stroke();
  return { c: L.c, w: W, h: HH, ox: cx, oy: by };
}

// ── the night globe ──────────────────────────────────────────────
/** A city light on the globe: its place (on the visible face, −1..1 of the radius) and when it lights (0..1). */
export interface CityLight { x: number; y: number; at: number; size: number }

/** Seeded lights on the globe's face (more toward the land), each with the share of the light at which it wakes. */
export function cityLights(n: number): CityLight[] {
  const out: CityLight[] = [];
  for (let i = 0; out.length < n && i < n * 6; i++) {
    const a = hash(i * 7 + 1) * TAU, d = Math.sqrt(hash(i * 7 + 2)) * 0.92;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (land(x, y) < 0.15) continue;
    out.push({ x, y, at: hash(i * 7 + 3) * 0.92, size: 0.5 + hash(i * 7 + 4) });
  }
  return out;
}

/** A smooth made-up land mask on the globe's face (continents of no particular map: the whole world, not a country). */
function land(x: number, y: number): number {
  return Math.sin(x * 3.1 + 0.7) * Math.cos(y * 2.6 - 0.4) + 0.5 * Math.sin((x + y) * 4.3 + 1.1) + 0.25;
}

/** The night globe, baked at a radius: a deep blue-violet sphere, darker land, a thin rim of atmosphere. */
export function bakeGlobe(r: number, dpr: number): { c: Layer; size: number } | null {
  const pad = Math.ceil(r * 0.35);
  const S = Math.ceil(2 * (r + pad));
  const L = layer(S, S, dpr);
  if (!L) return null;
  const ctx = L.ctx;
  const c = S / 2;
  const atm = ctx.createRadialGradient(c, c, r * 0.9, c, c, r * 1.3);
  atm.addColorStop(0, 'rgba(140,170,255,.35)');
  atm.addColorStop(1, 'rgba(140,170,255,0)');
  ctx.fillStyle = atm;
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r);
  g.addColorStop(0, '#2c3566');
  g.addColorStop(0.6, '#171c3e');
  g.addColorStop(1, '#0b0d22');
  ctx.beginPath();
  ctx.arc(c, c, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  // the land: a soft mask drawn small and scaled up smoothly (continents of no particular map)
  const n = 56;
  const M = layer(n, n, 1);
  if (M) {
    const img = M.ctx.createImageData(n, n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n * 2 - 1, y = (j + 0.5) / n * 2 - 1;
        const v = land(x, y);
        const a = Math.max(0, Math.min(1, (v - 0.05) / 0.35));
        const k = (j * n + i) * 4;
        img.data[k] = 70; img.data[k + 1] = 58; img.data[k + 2] = 92; img.data[k + 3] = Math.round(150 * a);
      }
    }
    M.ctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(M.c, c - r, c - r, 2 * r, 2 * r);
    // night: the far side darker, a faint lit crescent on the side toward the Cross
    const term = ctx.createRadialGradient(c - r * 0.55, c + r * 0.1, r * 0.2, c - r * 0.3, c, r * 1.3);
    term.addColorStop(0, 'rgba(6,6,18,.55)');
    term.addColorStop(1, 'rgba(6,6,18,0)');
    ctx.fillStyle = term;
    ctx.fillRect(c - r, c - r, 2 * r, 2 * r);
    const lit = ctx.createRadialGradient(c + r * 1.05, c - r * 0.2, r * 0.6, c + r * 0.9, c - r * 0.1, r * 1.25);
    lit.addColorStop(0, 'rgba(255,214,160,.28)');
    lit.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = lit;
    ctx.fillRect(c - r, c - r, 2 * r, 2 * r);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(c, c, r, 0, TAU);
  ctx.strokeStyle = 'rgba(170,196,255,.55)';
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.stroke();
  return { c: L.c, size: S };
}

/** A label in screen space (never under MIN_TEXT), with a soft dark halo so it reads on the sky. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color = PEARL, align: CanvasTextAlign = 'center', weight = 700): void {
  ctx.font = font(px, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12,8,20,.72)';
  ctx.lineWidth = 3.5;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
