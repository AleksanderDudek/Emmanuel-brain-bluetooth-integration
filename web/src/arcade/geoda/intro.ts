/**
 * Geoda's calibration scene: the cave, a rough stone egg in the lamplight, and Bazyl beside it.
 * While the reference fills (`p` 0..1) the stone splits along a crack and opens, and the crystals
 * inside catch more and more of his lamp.  The runner's calibration card covers the lower part of
 * the screen, so the scene sits high.  The lobby's picture (preview.ts) reuses it.
 */
import { approach, clamp } from '../kit/juice';
import { druse, hash, TAU } from './art';
import { C, paintCave, paintMole, type MolePose } from './paint';

const pose: MolePose = { t: 0, cheer: 0, oops: 0, talk: false, lamp: 0.4, face: -1 };

/** The opened geode at (cx, cy), radius r, open 0..1 (0 closed, 1 split wide), `m` the crust's mineral. */
export function paintGeodeEgg(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, open: number, m: number, t: number): void {
  const gap = r * 0.55 * open;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * gap, cy);
    ctx.rotate(side * open * 0.12);
    // the half's outline: a rough circle cut on the crack
    ctx.beginPath();
    const a0 = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let i = 0; i <= 40; i++) {
      const a = a0 + (i / 40) * Math.PI;
      const rr = r * (1 + 0.05 * Math.sin(a * 5 + 1.3) + 0.03 * Math.sin(a * 11));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    // the crack (a zigzag back to the start)
    for (let i = 0; i <= 8; i++) {
      const y = r * (1 - (2 * i) / 8) * (side < 0 ? -1 : 1) * -1;
      ctx.lineTo((i % 2 ? 1 : -1) * r * 0.06, y);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-side * r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, '#6b5b4f');
    g.addColorStop(1, '#2b221d');
    ctx.fillStyle = g;
    ctx.fill();
    // the inside, seen when open: a violet hollow lined with points
    if (open > 0.02) {
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = clamp(open * 1.6);
      const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.85);
      inner.addColorStop(0, '#24163a');
      inner.addColorStop(1, '#5a3d8a');
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.ellipse(side * r * 0.05, 0, r * 0.8 * open, r * 0.8, 0, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        druse(ctx, side * r * 0.05 + Math.cos(a) * r * 0.62 * open, Math.sin(a) * r * 0.62, r * 0.32, a - Math.PI / 2, m + (i % 3), i * 1.7 + side);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  // the light inside
  if (open > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.4);
    glow.addColorStop(0, `rgba(255,214,150,${(0.35 * open).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3);
    for (let i = 0; i < 6; i++) {
      const a = hash(i * 4.1) * TAU;
      const d = r * (0.3 + 0.9 * ((t * 0.3 + hash(i)) % 1));
      ctx.fillStyle = `rgba(255,240,200,${(0.6 * open * (1 - ((t * 0.3 + hash(i)) % 1))).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class GeodaIntro {
  private clock = 0;
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown;
    paintCave(ctx, w, h, 0.3 + 0.5 * k, this.clock);
    // the runner's calibration card covers the middle (desktop) or most of the screen (phone): the
    // scene stands beside it, or above it on a tall screen
    const wide = w > h * 1.05;
    const r = wide ? Math.max(30, Math.min(w * 0.1, h * 0.17)) : Math.max(26, Math.min(w * 0.14, h * 0.07));
    const cx = wide ? w * 0.15 : w / 2 - r * 1.2, cy = wide ? h * 0.42 : Math.max(r * 1.3, h * 0.09);
    paintGeodeEgg(ctx, cx, cy, r, k, 0, this.clock);
    pose.t = this.clock;
    pose.lamp = 0.3 + 0.7 * k;
    pose.cheer = k > 0.97 ? 0.6 : 0;
    if (wide) paintMole(ctx, w * 0.86, cy + r * 1.3, r * 1.9, pose);
    else paintMole(ctx, cx + r * 2.6, cy + r * 1.05, r * 1.4, pose);
    ctx.fillStyle = C.gold;
  }
}
