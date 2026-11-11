/**
 * Kocia straż's calibration intro: early morning at the abbey.  The cats doze on their cushions along the
 * wall over the vineyard (the place the watch has reached), a fox cub peeks from the far rows, and while
 * the reference fills (`p` 0..1) the gatehouse's eye opens and its ring fills; at the end the cats wake,
 * ears up.  The runner's calibration card covers the lower part of the screen, so the scene sits high.
 */
import { approach, clamp } from '../kit/juice';
import { CATS, catSpec, stageInfo, type CatId } from './content';
import type { KotyProgress } from './meta';
import { CAT_POSE, glow, paintCat, paintCushion, paintEye, paintGround, paintPest, paintSky, paintWall } from './paint';

export class KotyIntro {
  private clock = 0;
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: KotyProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const place = stageInfo(progress.stage || 1).place.id;
    const s = Math.max(14, Math.min(w / 14, h / 12));
    const skyH = h * 0.2;
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(0, 0, w, h);
    paintSky(ctx, place, 0, w, skyH, s);
    const fieldH = h * 0.36;
    paintGround(ctx, place, 0, skyH, w, fieldH, s);
    // the dawn's light
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, w * 0.8, skyH * 0.6, s * 6, 'rgba(255,214,150,', 0.18 + 0.15 * k);
    ctx.restore();
    // a fox cub peeks from the far rows
    const peek = 0.5 + 0.5 * Math.sin(t * 0.9);
    paintPest(ctx, w * 0.3, skyH + fieldH * (0.3 + 0.05 * peek), s * 1.1, 'liszka', { dir: 1, t, hit: 0, flee: false, doze: k > 0.95 ? 0 : 0, frozen: false, elite: false, move: 0, seed: 1 });
    const wallY = skyH + fieldH, wallH = Math.max(40, h * 0.1);
    paintWall(ctx, 0, wallY, w, wallH, s);
    // the cats on their cushions, waking as the reference fills
    const squad: CatId[] = (progress.squad?.length ? progress.squad : (['mruczek', 'rudy'] as CatId[])).slice(0, 4);
    const n = Math.max(2, squad.length);
    const catH = Math.min(wallH * 1.15, w / 7);
    squad.forEach((id, i) => {
      // the cats sit at the wall's ends, beside the runner's calibration card in the middle
      const left = Math.ceil(n / 2), side = i < left ? 0 : 1, k = side ? i - left : i;
      const x = side === 0 ? w * 0.04 + catH * (0.6 + k * 1.05) : w * 0.96 - catH * (0.6 + k * 1.05);
      const y = wallY + wallH * 0.38;
      paintCushion(ctx, x, y, catH * 0.95, i, false, 0);
      const spec = CATS.some(c => c.id === id) ? catSpec(id) : CATS[0];
      paintCat(ctx, x, y, catH, spec, { ...CAT_POSE, sleep: k > 0.92 ? 0 : 1, alert: k > 0.92 ? 0.4 : 0, t: t + i, blink: 0 });
    });
    paintEye(ctx, w / 2, wallY + wallH * 0.46, Math.min(wallH * 0.46, w * 0.07), {
      value: k, mode: k > 0.92 ? 'alert' : 'nap', charge: 0, ready: false, mult: '', t, hunting: false,
    });
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(0, wallY + wallH, w, h - wallY - wallH);
  }
}
