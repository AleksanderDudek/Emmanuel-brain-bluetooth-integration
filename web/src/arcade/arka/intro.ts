/**
 * Arka's calibration intro, "Arka osiadła" (the ark has come to rest): inside the dim hold the
 * animals sleep in the straw under the covering.  While the reference fills (`p` 0..1) the boards
 * of the covering are lifted one by one and the first light falls in through the gaps; at 1 Noah
 * has removed the covering (Gen 8:13) and morning light floods the hold.  The runner's calibration
 * card covers the lower part of the screen, so the covering and the sleepers sit high.
 */
import { clamp, ease } from '../kit/juice';
import { KINDS, kindsAt, type KindId } from './content';
import type { ArkaProgress } from './meta';
import { C, glow, hash, paintPlanks, paintProfile } from './paint';

const BOARDS = 9;

export class ArkIntro {
  private clock = 0;
  private flood = 0;
  private cache: { w: number; h: number; dpr: number; c: HTMLCanvasElement } | null = null;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: ArkaProgress, dpr: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.flood = p >= 0.999 ? Math.min(1, this.flood + dt / 0.8) : Math.max(0, this.flood - dt);
    const t = this.clock;
    const roofH = Math.min(h * 0.14, 110);
    const floorY = h * (h > w ? 0.5 : 0.56);
    // the hold's walls and floor, drawn once per size
    const c = this.cache;
    if (!c || c.w !== w || c.h !== h || c.dpr !== dpr) this.cache = { w, h, dpr, c: hold(w, h, dpr, roofH, floorY) };
    ctx.drawImage(this.cache!.c, 0, 0, w, h);
    // the sky behind the covering, seen through the lifted boards
    const open = clamp(p) * BOARDS;
    const bw = w / BOARDS;
    for (let i = 0; i < BOARDS; i++) {
      const k = clamp(open - i);
      if (k <= 0) continue;
      const x = i * bw;
      ctx.fillStyle = `rgba(214,236,244,${0.9 * k})`;
      ctx.fillRect(x, 0, bw * k, roofH);
      // a shaft of light falling onto the straw
      ctx.save();
      ctx.globalAlpha = 0.16 * k;
      ctx.fillStyle = '#fff5d8';
      ctx.beginPath();
      ctx.moveTo(x, roofH);
      ctx.lineTo(x + bw * k, roofH);
      ctx.lineTo(x + bw * k + h * 0.18, floorY + h * 0.12);
      ctx.lineTo(x + h * 0.18, floorY + h * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // the boards still in place, the next one lifting
    for (let i = 0; i < BOARDS; i++) {
      const k = clamp(open - i);
      if (k >= 1) continue;
      const x = i * bw + bw * ease.inOutSine(k);
      paintPlanks(ctx, x, 0, bw * (1 - ease.inOutSine(k)) + 1, roofH, bw, ['#3b2a1e', '#43301f'], 50 + i, true);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(x, roofH - 4, bw, 4);
    }
    // dust in the light
    ctx.fillStyle = '#fff3d6';
    for (let i = 0; i < 40; i++) {
      const px = (hash(i + 3) * w + t * 4 * (hash(i) - 0.3)) % w;
      const py = roofH + ((hash(i + 7) * (floorY - roofH) + t * 3 * hash(i + 2)) % (floorY - roofH + 30));
      const lit = clamp(open - Math.floor(px / bw));
      if (lit <= 0) continue;
      ctx.globalAlpha = 0.5 * lit * (0.5 + 0.5 * Math.sin(t * 2 + i));
      ctx.fillRect(px, py, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
    // the sleepers in the straw: the player's kinds
    const kinds: KindId[] = KINDS.slice(0, kindsAt(Math.max(1, progress.sessions + 1)));
    const n = Math.min(kinds.length * 2, Math.max(6, Math.floor(w / 70)));
    const ah = Math.min(h * 0.07, 54);
    for (let i = 0; i < n; i++) {
      const k = kinds[i % kinds.length];
      const x = w * (0.08 + (0.84 * (i + 0.5)) / n);
      const breathe = Math.sin(t * 1.3 + i) * 0.6;
      paintProfile(ctx, k, x, floorY + ah * 0.15 + breathe, ah * (0.9 + 0.15 * hash(i)), i % 2 ? -1 : 1, 1);
    }
    // straw over their feet
    ctx.strokeStyle = C.straw;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < Math.floor(w / 3); i++) {
      const x = hash(i + 90) * w, y = floorY + ah * 0.1 + hash(i + 91) * ah * 0.35;
      const a = (hash(i + 92) - 0.5) * 1.2;
      ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 3);
      ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 3);
    }
    ctx.stroke();
    // the flood of morning light when the covering is gone
    if (this.flood > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.flood * 0.7;
      const r = Math.max(w, h) * 0.8;
      ctx.drawImage(glow('rgba(255,240,200,.6)'), w * 0.5 - r, roofH - r * 0.6, r * 2, r * 2);
      ctx.restore();
    }
  }
}

/** The hold: dark walnut walls with posts and beams, a straw floor. */
function hold(w: number, h: number, dpr: number, roofH: number, floorY: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  paintPlanks(g, 0, 0, w, h, Math.max(22, h * 0.035), ['#2c1f15', '#32231a', '#281c13'], 61);
  // posts
  for (let i = 0; i <= 5; i++) {
    const x = (i / 5) * w;
    g.fillStyle = '#1e150e';
    g.fillRect(x - 7, roofH, 14, floorY - roofH + 20);
    g.fillStyle = 'rgba(255,230,190,.07)';
    g.fillRect(x - 7, roofH, 3, floorY - roofH + 20);
  }
  // a beam under the covering
  g.fillStyle = '#1e150e';
  g.fillRect(0, roofH, w, 12);
  // the straw floor
  const fl = g.createLinearGradient(0, floorY, 0, h);
  fl.addColorStop(0, '#6b4a22');
  fl.addColorStop(0.3, '#4a3218');
  fl.addColorStop(1, '#1c130b');
  g.fillStyle = fl;
  g.fillRect(0, floorY, w, h - floorY);
  // the hold is dim: a soft darkness at the edges
  const v = g.createRadialGradient(w / 2, h * 0.35, Math.min(w, h) * 0.2, w / 2, h * 0.45, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(8,5,3,.6)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  return c;
}
