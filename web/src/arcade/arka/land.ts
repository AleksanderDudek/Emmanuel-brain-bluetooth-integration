/**
 * "Nowa ziemia", the new land beyond the ark's door, as a woodcut panorama: a washed spring sky,
 * Ararat far off, the meadow on the left (Łąka) and the hills with their cypresses and rocks on the
 * right (Wzgórza), the family's homestead, olive trees, and every kind's settled pairs grazing in
 * its valley with its young beside them.  The play view shows it as a strip (or a column), the
 * Evening and the finisher full screen at dusk, the lobby as the player's own world.
 *
 * The still part (sky, hills, homestead, trees) is drawn once per size and progress into a sprite;
 * the animals, the clouds and the dusk move on top, so a frame stays cheap.  No water is drawn.
 */
import { KIND, KINDS, YOUNG_AT, type KindId } from './content';
import { C, glow, hash, paintCypress, paintHomestead, paintOlive, paintProfile } from './paint';

export interface LandLook {
  settled: Readonly<Record<string, number>>;
  young: readonly string[];
  olives: number;
  /** homestead stages standing */
  built: number;
}

export interface LandOpts {
  /** 0 morning light … 1 dusk with lanterns */
  dusk: number;
  /** the animals' and the trees' size against the strip's height (1: as in the play strip) */
  zoom?: number;
  still?: boolean;
  /** pairs walking in this moment (they come down the ramp: drawn small, fading in) */
  arriving?: number;
}

/** The near hill's surface (0..1 down the rect) at x (0..1 across): gentle meadow on the left, the hills rising on the right. */
export function groundAt(x: number): number {
  const rise = smooth(0.42, 0.95, x);
  return 0.8 + 0.035 * Math.sin(x * 8.2 + 0.7) + 0.02 * Math.sin(x * 19 + 2.1) - 0.12 * rise;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Where each kind grazes (0..1 across): the meadow's six on the left, the hills' six on the right. */
export const SPOT: Readonly<Record<KindId, number>> = Object.fromEntries(KINDS.map((k, i) => {
  const inValley = i % 6;
  const base = i < 6 ? 0.08 + inValley * 0.068 : 0.56 + inValley * 0.072;
  return [k, base];
})) as Record<KindId, number>;

export class LandPainter {
  private cache: { w: number; h: number; dpr: number; sig: string; c: HTMLCanvasElement } | null = null;

  /** The land in `x, y, w, h` at play time `t`. */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, look: LandLook, o: LandOpts, dpr: number): void {
    if (w < 4 || h < 4) return;
    const zoom = o.zoom ?? 1;
    const sig = `${look.built}|${Math.min(12, look.olives)}|${zoom}`;
    const c = this.cache;
    if (!c || c.w !== w || c.h !== h || c.dpr !== dpr || c.sig !== sig) this.cache = { w, h, dpr, sig, c: still(w, h, dpr, look, zoom) };
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(this.cache!.c, x, y, w, h);
    this.clouds(ctx, x, y, w, h, o.still ? 0 : t);
    this.herds(ctx, x, y, w, h, t, look, zoom, o.still ?? false);
    if (o.dusk > 0.01) this.duskOver(ctx, x, y, w, h, o.dusk, look.built, t);
    ctx.restore();
  }

  /** Flat woodcut clouds drifting slowly. */
  private clouds(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number): void {
    for (let i = 0; i < 4; i++) {
      const span = w * 1.4;
      const cx = x + ((hash(i + 3) * span + t * (3 + 2 * hash(i))) % span) - w * 0.2;
      const cy = y + h * (0.12 + 0.18 * hash(i + 9));
      const s = h * (0.06 + 0.04 * hash(i + 5));
      ctx.fillStyle = 'rgba(255,255,250,.75)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 2.4, s * 0.7, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - s * 0.9, cy + s * 0.1, s * 1.2, s * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s, cy - s * 0.25, s * 1.3, s * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,140,160,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - s * 2, cy + s * 0.45);
      ctx.lineTo(cx + s * 2, cy + s * 0.45);
      ctx.stroke();
    }
  }

  /** Each kind's pairs (up to three drawn) at its spot, grazing; its young beside them. */
  private herds(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, look: LandLook, zoom: number, still: boolean): void {
    const ah = Math.max(7, h * 0.1 * zoom);
    for (const k of KINDS) {
      const n = Math.min(3, look.settled[k] ?? 0);
      if (!n) continue;
      const sx = SPOT[k];
      for (let i = 0; i < n; i++) {
        for (let m = 0; m < 2; m++) {
          const u = sx + (i * 0.018 + m * 0.014) * (k === 'stork' || k === 'partridge' ? 0.8 : 1) - 0.01;
          const gy = groundAt(u);
          const face = (hash(KINDS.indexOf(k) * 7 + i * 3 + m) < 0.5 ? -1 : 1) * (m ? -1 : 1);
          const graze = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * (0.6 + 0.3 * hash(i + m)) + i * 2 + m);
          paintProfile(ctx, k, x + u * w, y + gy * h + 1, ah * (1 - i * 0.08), face, graze > 0.6 ? 1 : 0);
        }
      }
      if (look.young.includes(k) && (look.settled[k] ?? 0) >= YOUNG_AT) {
        const u = sx + 0.045;
        paintProfile(ctx, k, x + u * w, y + groundAt(u) * h + 1, ah, 1, 0, true);
      }
    }
  }

  /** The Evening over the land: a violet sky, an amber line on the horizon, the homestead's window lit. */
  private duskOver(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number, built: number, t: number): void {
    const d = this.duskCache;
    if (!d || d.ctx !== ctx || d.y !== y || d.h !== h) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(46,36,64,.72)');
      g.addColorStop(0.45, 'rgba(91,74,110,.5)');
      g.addColorStop(0.62, 'rgba(233,164,106,.32)');
      g.addColorStop(1, 'rgba(40,28,40,.55)');
      this.duskCache = { ctx, y, h, g };
    }
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = this.duskCache!.g;
    ctx.fillRect(x, y, w, h);
    // first stars
    ctx.fillStyle = '#fff6e0';
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = k * (0.4 + 0.4 * Math.sin(t * (0.8 + hash(i)) + i));
      ctx.fillRect(x + hash(i + 50) * w, y + hash(i + 70) * h * 0.4, 1.2, 1.2);
    }
    if (built >= 1) {
      // the homestead's lamp
      const r = h * 0.14;
      ctx.globalAlpha = 0.75 * k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow('rgba(255,190,90,.8)'), x + w * 0.2 + h * 0.05 - r, y + groundAt(0.2) * h - h * 0.1 - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  private duskCache: { ctx: CanvasRenderingContext2D; y: number; h: number; g: CanvasGradient } | null = null;
}

/** The still land: sky, Ararat, three layers of hills with carved hatching, cypresses and rocks, olive trees, the homestead. */
function still(w: number, h: number, dpr: number, look: LandLook, zoom: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const sky = g.createLinearGradient(0, 0, 0, h * 0.75);
  sky.addColorStop(0, '#b9dcec');
  sky.addColorStop(0.6, '#dcedf0');
  sky.addColorStop(1, '#f3f1e4');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // the morning sun, low, pale
  const sun = g.createRadialGradient(w * 0.8, h * 0.3, 0, w * 0.8, h * 0.3, h * 0.5);
  sun.addColorStop(0, 'rgba(255,248,220,.8)');
  sun.addColorStop(1, 'rgba(255,248,220,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);
  // Ararat far off, snow on its peaks
  g.fillStyle = '#c3cfd4';
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.62);
  g.lineTo(w * 0.66, h * 0.3);
  g.lineTo(w * 0.72, h * 0.36);
  g.lineTo(w * 0.78, h * 0.26);
  g.lineTo(w * 0.98, h * 0.62);
  g.closePath();
  g.fill();
  g.fillStyle = '#f4f6f4';
  g.beginPath();
  g.moveTo(w * 0.62, h * 0.38);
  g.lineTo(w * 0.66, h * 0.3);
  g.lineTo(w * 0.7, h * 0.36);
  g.lineTo(w * 0.74, h * 0.31);
  g.lineTo(w * 0.78, h * 0.26);
  g.lineTo(w * 0.83, h * 0.35);
  g.lineTo(w * 0.79, h * 0.37);
  g.lineTo(w * 0.75, h * 0.34);
  g.lineTo(w * 0.7, h * 0.39);
  g.lineTo(w * 0.66, h * 0.35);
  g.closePath();
  g.fill();
  // three layers of hills
  layer(g, w, h, x => 0.6 + 0.04 * Math.sin(x * 5 + 1) + 0.03 * Math.sin(x * 13), '#a9b99a', 0.08);
  layer(g, w, h, x => 0.69 + 0.035 * Math.sin(x * 7 + 2.4) + 0.02 * Math.sin(x * 17 + 1) - 0.05 * smooth(0.5, 1, x), C.olive, 0.12);
  // trees and rocks on the hills (right), on the middle layer
  for (let i = 0; i < 7; i++) {
    const u = 0.58 + i * 0.06 + 0.02 * hash(i + 4);
    const gy = 0.69 + 0.035 * Math.sin(u * 7 + 2.4) + 0.02 * Math.sin(u * 17 + 1) - 0.05 * smooth(0.5, 1, u);
    paintCypress(g, u * w, gy * h + 2, h * (0.16 + 0.06 * hash(i + 11)) * zoom, i % 2 ? '#4f6a45' : '#5d7a4f');
  }
  layer(g, w, h, groundAt, C.grass, 0.2);
  // rocks and cliffs where the hills rise
  for (let i = 0; i < 6; i++) {
    const u = 0.7 + i * 0.05;
    const gy = groundAt(u) * h;
    g.fillStyle = i % 2 ? '#a39a8a' : '#8f8676';
    g.beginPath();
    g.moveTo(u * w - h * 0.06, gy + 2);
    g.lineTo(u * w - h * 0.02, gy - h * (0.05 + 0.03 * hash(i)));
    g.lineTo(u * w + h * 0.05, gy - h * 0.02);
    g.lineTo(u * w + h * 0.07, gy + 2);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(42,33,27,.5)';
    g.lineWidth = 0.8;
    g.stroke();
  }
  // olive trees grown from the dove's olives
  const n = Math.min(12, look.olives);
  for (let i = 0; i < n; i++) {
    const u = 0.32 + ((i * 0.37) % 1) * 0.6;
    paintOlive(g, u * w, groundAt(u) * h - 1, h * 0.2 * zoom, i * 13 + 5);
  }
  // the homestead on the meadow
  if (look.built > 0) paintHomestead(g, w * 0.2, groundAt(0.2) * h, h * 0.36 * zoom, look.built);
  // a woodcut's frame line along the bottom
  g.fillStyle = 'rgba(42,33,27,.35)';
  g.fillRect(0, h - 1, w, 1);
  return c;
}

/** A hill layer under `top(x)` (0..1 down the rect), filled and carved with diagonal strokes. */
function layer(g: CanvasRenderingContext2D, w: number, h: number, top: (x: number) => number, fill: string, ink: number): void {
  const n = 48;
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(0, h);
  for (let i = 0; i <= n; i++) g.lineTo((i / n) * w, top(i / n) * h);
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = `rgba(42,33,27,${ink})`;
  g.lineWidth = 0.8;
  g.beginPath();
  const step = Math.max(5, h * 0.035);
  for (let x = -h; x < w + h; x += step) {
    const y0 = top(Math.max(0, Math.min(1, x / w))) * h + 3;
    g.moveTo(x, y0);
    g.lineTo(x - h * 0.08, y0 + h * 0.07);
  }
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(42,33,27,.45)';
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const px = (i / n) * w, py = top(i / n) * h;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.stroke();
}

/** Every kind settled so far, in the order they came (the land's census). */
export const settledKinds = (look: LandLook): KindId[] => KINDS.filter(k => (look.settled[k] ?? 0) > 0);

/** A kind's name for a label (the panel, the Evening card). */
export const kindName = (k: KindId): string => KIND[k].name;
