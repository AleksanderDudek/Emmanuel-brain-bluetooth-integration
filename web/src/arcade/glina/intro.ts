/**
 * Glina's calibration scene, "Klinowanie" (wedging): a close view of the bench in the courtyard,
 * where two hands rock a lump of clay forward and fold it back, once every 1.2 s, drawing the
 * ram's-head spiral potters wedge into it; the folds deepen and the surface smooths as the reference
 * fills (`p` 0..1), the morning light warms over the wall and the fig's leaf shadows come.  The wheel
 * waits at the side; at p = 1 the lump rests on it, ready.  No text: the runner's card below holds
 * the words.  The scene keeps to the upper part of the screen, above that card.  When the clay has
 * waited two days or more for the player, the lump is white porcelain.
 */
import { clamp, ease } from '../kit/juice';
import { dayKey } from '../kit/progress';
import { welcomeBack, type GlinaProgress } from './meta';
import { C, hand, hash, mix } from './paint';
import { softBlob } from './scene';

const TAU = Math.PI * 2;

export class KneadIntro {
  private clock = 0;
  private ready = 0;
  private bg: { w: number; h: number; sky: CanvasGradient; wall: CanvasGradient } | null = null;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: GlinaProgress, still: boolean): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.ready = p >= 0.999 ? Math.min(1, this.ready + dt / 0.9) : Math.max(0, this.ready - dt);
    const t = this.clock;
    const portrait = h > w;
    // the scene's room: the upper part, above the runner's calibration card
    const roomH = portrait ? h * 0.56 : h * 0.6;
    const bench = roomH * (portrait ? 0.78 : 0.8);
    const g = this.gradients(ctx, w, h, roomH);
    ctx.fillStyle = g.sky;
    ctx.fillRect(0, 0, w, roomH * 0.2);
    ctx.fillStyle = g.wall;
    ctx.fillRect(0, roomH * 0.2, w, h - roomH * 0.2);
    ctx.fillStyle = C.terracotta;
    ctx.fillRect(0, roomH * 0.2 - 5, w, 9);
    // the morning comes: the light warms with the reference
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.18 * (1 - p);
    ctx.fillStyle = '#9FB4CC';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = `rgba(242,196,138,${(0.12 * p).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
    // leaf shadows come with the light
    const sp = softBlob();
    if (sp && p > 0.05) {
      ctx.save();
      ctx.globalAlpha = 0.16 * clamp(p * 1.4);
      for (let i = 0; i < 5; i++) {
        const x = w * (0.55 + 0.4 * hash(i + 11)) + (still ? 0 : Math.sin(t * 0.25 + i) * 10), y = roomH * (0.3 + 0.3 * hash(i + 12));
        const s = Math.min(w, h) * (0.12 + 0.08 * hash(i + 13));
        ctx.drawImage(sp, x - s, y - s * 0.6, s * 2, s * 1.2);
      }
      ctx.restore();
    }
    // the bench: a worn plank top in perspective
    const bx0 = w * 0.08, bx1 = w * 0.92;
    ctx.fillStyle = mix(C.wood, '#E4C29A', 0.32);
    ctx.beginPath();
    ctx.moveTo(bx0 + w * 0.06, bench - roomH * 0.12);
    ctx.lineTo(bx1 - w * 0.06, bench - roomH * 0.12);
    ctx.lineTo(bx1, bench);
    ctx.lineTo(bx0, bench);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(C.wood, '#3A2A20', 0.2);
    ctx.fillRect(bx0, bench, bx1 - bx0, roomH * 0.05);
    ctx.strokeStyle = 'rgba(90,58,38,.25)';
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(bx0 + (bx1 - bx0) * (i / 4) - w * 0.02, bench - roomH * 0.12);
      ctx.lineTo(bx0 + (bx1 - bx0) * (i / 4), bench);
      ctx.stroke();
    }
    // the wheel waiting at the side
    const wx = portrait ? w * 0.84 : w * 0.82, wy = bench - roomH * 0.05;
    const wr = Math.min(w, roomH) * 0.11;
    ctx.fillStyle = '#8E7B6A';
    ctx.beginPath();
    ctx.ellipse(wx, wy, wr, wr * 0.22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix('#8E7B6A', C.wet, 0.4);
    ctx.beginPath();
    ctx.ellipse(wx, wy - 2, wr * 0.92, wr * 0.19, 0, 0, TAU);
    ctx.fill();
    // the lump, wedged: forward and back every 1.2 s, the spiral's folds deepening
    const porcelain = welcomeBack(progress, dayKey());
    const body = porcelain ? C.porcelainWet : C.wet;
    const cycle = still ? 0.5 : (t / 1.2) % 1;
    const push = Math.sin(cycle * TAU) * (1 - this.ready);
    const size = Math.min(w * 0.2, roomH * 0.24);
    const k = ease.inOutSine(this.ready);
    const lx = w * 0.46 + (wx - w * 0.46) * k, ly = bench - roomH * 0.07 - (bench - roomH * 0.07 - (wy - 2)) * k;
    const sq = 1 + 0.12 * push, st = 1 - 0.1 * push;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.scale(sq * (1 - 0.45 * k), st * (1 - 0.45 * k));
    ctx.fillStyle = 'rgba(59,42,34,.25)';
    ctx.beginPath();
    ctx.ellipse(size * 0.05, 2, size * 1.05, size * 0.2, 0, 0, TAU);
    ctx.fill();
    const lg = ctx.createRadialGradient(-size * 0.35, -size * 0.75, size * 0.1, 0, -size * 0.35, size * 1.15);
    lg.addColorStop(0, mix(body, '#FFFFFF', porcelain ? 0.4 : 0.28));
    lg.addColorStop(0.6, body);
    lg.addColorStop(1, mix(body, '#000000', 0.3));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.bezierCurveTo(-size * 1.02, -size * 0.6, -size * 0.5 + push * size * 0.1, -size * 0.98, size * 0.1 + push * size * 0.15, -size * 0.92);
    ctx.bezierCurveTo(size * 0.7, -size * 0.85, size * 1.02, -size * 0.45, size, 0);
    ctx.closePath();
    ctx.fill();
    // the ram's head: spiral folds on the lump's face, deeper as the reference fills
    const folds = 1 + Math.floor(p * 6);
    const rough = 1 - p;
    ctx.strokeStyle = porcelain ? 'rgba(120,110,100,.5)' : 'rgba(40,22,14,.55)';
    ctx.lineCap = 'round';
    for (let i = 0; i < folds; i++) {
      const rr = size * (0.18 + i * 0.1);
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath();
      ctx.arc(size * 0.12 + push * size * 0.05, -size * 0.42, rr, Math.PI * (0.95 + i * 0.05), Math.PI * (1.75 + i * 0.04));
      ctx.stroke();
    }
    // the surface: rough at first, smoothing with p
    ctx.fillStyle = porcelain ? 'rgba(255,255,255,.35)' : 'rgba(255,230,200,.18)';
    for (let i = 0; i < Math.round(26 * rough); i++) {
      ctx.beginPath();
      ctx.arc((hash(i + 30) - 0.5) * size * 1.6, -size * (0.1 + 0.75 * hash(i + 31)), size * 0.025, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // the hands, pressing the lump's top forward and lifting it back
    if (this.ready < 0.95) {
      const hs = size * 0.85, a = 1 - this.ready;
      ctx.save();
      ctx.globalAlpha = a;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(lx + side * size * 0.38 + push * size * 0.12, ly - size * 0.88 - push * size * 0.04);
        ctx.rotate(side * 0.35);
        hand(ctx, 0, 0, hs, -side, 0.3 + 0.3 * push);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  private gradients(ctx: CanvasRenderingContext2D, w: number, h: number, roomH: number) {
    if (this.bg && this.bg.w === w && this.bg.h === h) return this.bg;
    const sky = ctx.createLinearGradient(0, 0, 0, roomH * 0.2);
    sky.addColorStop(0, C.zenith);
    sky.addColorStop(1, C.sky);
    const wall = ctx.createLinearGradient(0, roomH * 0.2, 0, h);
    wall.addColorStop(0, '#F8F4EC');
    wall.addColorStop(0.6, mix(C.whitewash, C.sand, 0.4));
    wall.addColorStop(1, C.sand);
    this.bg = { w, h, sky, wall };
    return this.bg;
  }
}
