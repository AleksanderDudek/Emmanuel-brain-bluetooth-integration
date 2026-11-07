/**
 * Chleby i ryby's calibration intro: morning by the lake.  The crowd gathers on the hillside, the
 * boy waits by the path with his basket, and while the reference fills (`p` 0..1) his mother's
 * lunch is laid out on the cloth before him — five barley loaves, then two fish — one by one;
 * Mirka circles overhead, very interested.  The runner's calibration card covers the lower part of
 * the screen, so the scene sits high.
 */
import { approach, clamp, ease } from '../kit/juice';
import type { ChlebyProgress } from './meta';
import { placeOf } from './hill';
import { C, PALETTES, paintBoy, paintFish, paintGrass, paintGroup, paintGull, paintLake, paintLoaf, paintSky } from './paint';

export class ChlebyIntro {
  private clock = 0;
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: ChlebyProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const pal = PALETTES[placeOf(progress.level ?? 0).chapter % PALETTES.length];
    let S = Math.max(22, Math.min(w / 12, h / 9));
    const horizon = h * 0.2, lakeD = S * 0.9;
    paintSky(ctx, w, horizon, pal, t);
    paintLake(ctx, w, horizon, lakeD, pal, t);
    paintGrass(ctx, w, horizon + lakeD, h, pal, t);
    // the crowd gathering on the slope
    const cy = horizon + lakeD + S * 1.1;
    for (let i = 0; i < 5; i++) {
      const x = w * (0.12 + 0.19 * i);
      paintGroup(ctx, x, cy + (i % 2) * S * 0.3, S * 2.4, S * 0.8, { seed: i + 3, size: i % 2 ? 100 : 50, fed: 0, cheer: 0, done: false, t, rest: false, active: true });
    }
    // the cloth and the lunch on it, beside the runner's calibration card where there is room
    const side = w >= 900;
    const cx = side ? Math.min(w * 0.15, 200) : w / 2;
    if (side) S = Math.min(S, (w * 0.27) / 6.6);
    const clothY = side ? h * 0.62 : h * 0.5;
    ctx.fillStyle = '#efe4cc';
    ctx.beginPath();
    ctx.ellipse(cx, clothY, S * 3.2, S * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.kerchief;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, clothY, S * 3, S * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 7; i++) {
      const on = clamp((k * 7.4 - i) * 1.4);
      if (on <= 0) continue;
      const pop = ease.outBack(on);
      const x = cx + (i - 3) * S * 0.85, y = clothY - S * 0.05 - (1 - on) * S * 0.8;
      if (i < 5) paintLoaf(ctx, x, y, S * 0.36 * pop);
      else paintFish(ctx, x, y, S * 0.34 * pop, Math.sin(t * 3 + i) * 0.4);
    }
    // the boy behind the cloth, his basket ready
    paintBoy(ctx, cx, clothY + S * 0.75, S * 1.25, { toss: 0, t, walk: Math.sin(t * 0.7) * 0.2 });
    // Mirka circling, closer as the lunch grows
    const r = S * (3.4 - 1.2 * k);
    const a = t * 1.1;
    paintGull(ctx, cx + Math.cos(a) * r * 1.4, horizon + S * 0.6 + Math.sin(a) * r * 0.35, S * 0.9, { flap: t * 9, dir: -Math.sin(a) >= 0 ? 1 : -1, mirka: true });
  }
}
