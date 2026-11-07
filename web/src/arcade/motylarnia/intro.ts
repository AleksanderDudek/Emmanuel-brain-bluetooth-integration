/**
 * Motylarnia's calibration intro: morning on the lawn.  A big leaf lies in the grass with an egg on
 * it; while the reference fills (`p` 0..1) the egg rocks and cracks, and at the end a small
 * caterpillar peeks out and looks round.  Hieronim the snail watches from the left with a dewdrop.
 * The runner's calibration card covers the lower part of the screen, so the scene sits high.
 */
import { approach, clamp } from '../kit/juice';
import type { Species } from './content';
import { GARDENS } from './content';
import { drawSnail, foodSprite, lawnTile } from './garden';
import { drawCaterpillar, drawEgg, type BodyPoint } from './paint';

const TAU = Math.PI * 2;

export class MothIntro {
  private clock = 0;
  private shown = 0;
  private readonly body: BodyPoint[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, sp: Species, dpr: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const pat = ctx.createPattern(lawnTile(GARDENS[0]), 'repeat');
    ctx.fillStyle = pat ?? GARDENS[0].lawn[0];
    ctx.fillRect(0, 0, w, h);
    // morning light from the upper right
    const gl = ctx.createRadialGradient(w * 0.85, 0, 10, w * 0.85, 0, Math.max(w, h));
    gl.addColorStop(0, 'rgba(255,240,200,.45)');
    gl.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, w, h);
    const S = Math.max(50, Math.min(w > 900 ? (w / 2 - 270) * 0.32 : w * 0.22, h * 0.24));
    // the runner's calibration card covers the middle of a wide screen: the scene sits in the free left part
    const wide = w > 900;
    const cx = wide ? Math.max(S * 1.4, (w / 2 - 270) / 2) : w / 2, cy = wide ? h * 0.45 : Math.max(S * 0.9, h * 0.3);
    // the leaf
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.25);
    ctx.fillStyle = 'rgba(30,50,10,.25)';
    ctx.beginPath();
    ctx.ellipse(6, 10, S * 1.25, S * 0.62, 0, 0, TAU);
    ctx.fill();
    const lg = ctx.createLinearGradient(-S, -S * 0.5, S, S * 0.5);
    lg.addColorStop(0, '#A7D06A');
    lg.addColorStop(1, '#5B9A3A');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(-S * 1.3, 0);
    ctx.quadraticCurveTo(-S * 0.2, -S * 0.9, S * 1.3, 0);
    ctx.quadraticCurveTo(-S * 0.2, S * 0.9, -S * 1.3, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,250,190,.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-S * 1.2, 0);
    ctx.lineTo(S * 1.15, 0);
    for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) { ctx.moveTo(i * S * 0.3, 0); ctx.lineTo(i * S * 0.3 + S * 0.22, s * S * 0.38); }
    ctx.stroke();
    ctx.restore();
    // the egg rocks, cracks, and the caterpillar peeks out
    const rock = Math.sin(t * (2 + 6 * k)) * 0.12 * k;
    const er = S * 0.28;
    if (k < 0.97) drawEgg(ctx, cx, cy - er, er, '#F2EBD2', clamp((k - 0.3) / 0.6), rock, dpr);
    else {
      const e = clamp((p - 0.97) / 0.03);
      for (let i = 0; i < this.body.length; i++) {
        this.body[i].x = cx - i * er * 0.32 + Math.sin(t * 3 + i) * 1.5;
        this.body[i].y = cy - er * 0.2 + Math.sin(t * 2 + i * 0.8) * er * 0.08;
      }
      drawCaterpillar(ctx, this.body, er * 0.28 * (0.6 + 0.4 * e), sp.larva, 0.5 + 0.5 * Math.sin(t * 8), t, 0.3, this.body.length, dpr);
    }
    // food waiting around
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + 0.4, d = S * (1.5 + 0.2 * (i % 2));
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.55;
      ctx.drawImage(foodSprite(i % 2 ? 'leaf' : 'flower', i), x - 14, y - 14, 28, 28);
    }
    drawSnail(ctx, Math.max(50, cx - S * 1.1), cy + S * 1.25, Math.max(0.9, S / 90), t, false, 0);
  }
}
