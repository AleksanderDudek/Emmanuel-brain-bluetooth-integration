/**
 * Dolina's calibration intro: the edge of the valley at night.  The pilgrim stands at the top of the
 * road with his lamp unlit; while the reference fills (`p` 0..1) the lamp kindles and its light
 * widens, the lantern posts down the valley light one by one, and Ćma comes fluttering out of the
 * dark to the flame.  The runner's calibration card covers the lower part of the screen, so the
 * scene sits high.
 */
import { approach, clamp, ease } from '../kit/juice';
import { ERAS, eraOfLevel } from './content';
import { lookOf, type DolinaProgress } from './meta';
import { PAL, glow, paintFar, paintMid, paintMoth, paintPilgrim, paintPost, paintRoad, paintSky } from './paint';

export class DolinaIntro {
  private clock = 0;
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: DolinaProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const S = Math.max(24, Math.min(w / 12, h / 7.5));
    const floorY = h * 0.56;
    const era = ERAS[eraOfLevel(progress.level || 1)];
    const pal = PAL[era];
    paintSky(ctx, w, h, floorY, pal, t, 0, 0);
    paintFar(ctx, era, w, floorY - S * 0.1, S * 0.8, t * 6, t, pal, 1);
    paintMid(ctx, era, w, floorY, S, t * 12, t, pal, 0.9);
    paintRoad(ctx, w, h, floorY, S, 0, pal, 0, t);
    // the lantern posts down the valley light one by one
    // on a wide screen the runner's card stands in the middle: the pilgrim left of it, the posts right of it
    const wide = w > 900;
    const px = wide ? Math.max(S * 1.5, (w / 2 - 270) * 0.55) : w * 0.3;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const on = clamp((k * n - i) * 1.5);
      paintPost(ctx, (wide ? w / 2 + 290 : w * 0.42) + i * S * 2.6, floorY, S * (1 - i * 0.06), on > 0.5 ? (i % 3 === 2 ? 'gold' : 'warm') : 'none', t);
    }
    // the dark, with the lamp's light widening
    const lx = px + S * 0.55, ly = floorY - S * 0.75;
    const r = S * (0.6 + 4 * ease.outCubic(k));
    const g = ctx.createRadialGradient(lx, ly, r * 0.5, lx, ly, r * 1.25);
    g.addColorStop(0, 'rgba(14,10,20,0)');
    g.addColorStop(1, 'rgba(14,10,20,.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, lx, ly, r, 'rgba(255,190,110,', 0.12 + 0.2 * k);
    ctx.restore();
    const lamp = paintPilgrim(ctx, px, floorY, S, {
      look: lookOf(progress.sparksAll), run: 0, pace: 0, air: false, slide: 0, fall: 0, slash: -1, lampUp: 0.3 + 0.2 * Math.sin(t * 1.3), flicker: 1 - k,
    });
    // Ćma comes out of the dark to the flame
    const arrive = ease.inOutSine(clamp((k - 0.25) / 0.6));
    const mx = w * 1.05 + (lamp.x + S * 0.6 - w * 1.05) * arrive + Math.sin(t * 2.3) * S * 0.25;
    const my = h * 0.15 + (lamp.y - S * 0.7 - h * 0.15) * arrive + Math.cos(t * 3.1) * S * 0.18;
    paintMoth(ctx, mx, my, S * 0.32, t, k > 0.9 ? 'wow' : 'happy', arrive < 0.98 ? -1 : 1);
  }
}
