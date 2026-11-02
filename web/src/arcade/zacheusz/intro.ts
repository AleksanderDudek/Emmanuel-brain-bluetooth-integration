/**
 * Zacheusz's calibration intro, after Luke 19:3: a morning street in Jericho, a crowd's backs
 * between Zacchaeus and the road, and far off the dust of a procession he cannot see over them.
 * While the reference fills (`p` 0..1) the palms of the skyline come up one by one along the
 * horizon — the row that will carry his signal in play — and he rises on tiptoe to look, again
 * and again.  The runner's calibration card covers the lower part of the screen, so the scene
 * sits high.
 */
import { approach, clamp } from '../kit/juice';
import type { ZacheuszProgress } from './meta';
import { C, hash, paintGround, paintHills, paintHouse, paintPalm, paintPlain, paintProcession, paintSky, paintZacchaeus, restPose } from './paint';

export class ZacheuszIntro {
  private clock = 0;
  private shown = 0;
  private readonly pose = restPose();

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: ZacheuszProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const tall = h > w;
    const hor = h * (tall ? 0.3 : 0.32);
    const S = tall ? w / 11 : Math.min(h / 11, w / 18);
    paintSky(ctx, w, h, hor + 4, 0.15 * (1 - k));
    ctx.fillStyle = C.skyLow;
    ctx.fillRect(0, hor, w, h - hor);
    paintHills(ctx, w, hor + 2, S * 1.1, t * 3, C.hillFar, 1.3, h);
    paintProcession(ctx, w * 0.8, hor + 2, S * 0.8, t, 0.2 + 0.3 * k);
    // the skyline: palms come up one by one as the reference fills
    const n = 40, x0 = w * 0.03, x1 = w * 0.97, pps = (x1 - x0) / n;
    const shown = Math.floor(k * n + 0.001);
    for (let i = 0; i < n; i++) {
      if (i >= shown) break;
      const lv = 0.35 + 0.3 * hash(i + 3);
      const grow = clamp(k * n - i);
      paintPalm(ctx, x0 + (i + 0.5) * pps, hor + S * 0.25, S * 1.4 * (0.3 + 0.7 * lv) * grow, Math.min(pps * 1.35, S * 0.7), 'green', Math.sin(t + i) * 0.3);
    }
    // the oasis plain, the street and its houses
    const gy = h * (tall ? 0.48 : 0.54);
    paintPlain(ctx, w, hor + S * 0.3, gy, t * 4, 0);
    for (let i = 0; i < 7; i++) {
      const bx = w * (i / 6.2) - S * 0.6, bw = S * (2.2 + hash(i) * 1.2);
      paintHouse(ctx, bx, bx + bw, gy - S * (1.2 + hash(i + 9) * 0.7), gy, S * 0.8, i + 5, false);
    }
    paintGround(ctx, 0, w, gy, h + 2, S, 3, 0);
    // the crowd's backs between him and the road
    const zx = w * (tall ? 0.3 : 0.33);
    for (let i = 0; i < 9; i++) {
      const cx = zx + S * (0.8 + i * 0.75), cy = gy;
      const hh = S * (1.55 + 0.25 * hash(i + 21));
      ctx.fillStyle = ['#7a5a8a', '#b0623e', '#cdb48f', '#4d64a3'][i % 4];
      ctx.beginPath();
      ctx.roundRect(cx - S * 0.32, cy - hh, S * 0.64, hh, S * 0.2);
      ctx.fill();
      ctx.fillStyle = i % 2 ? C.cloth : '#d9b48a';
      ctx.beginPath();
      ctx.arc(cx, cy - hh - S * 0.18, S * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    // Zacchaeus on tiptoe, again and again: he wants to see
    const hop = Math.max(0, Math.sin(t * 2.4)) ** 3 * S * 0.25 * (0.5 + 0.5 * k);
    this.pose.look = -0.7;
    this.pose.air = hop > S * 0.05 ? 1 : 0;
    paintZacchaeus(ctx, zx, gy - hop, S, this.pose);
    void progress;
  }
}
