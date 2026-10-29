/**
 * Wzlot's calibration intro, "Gniazdo" (the nest), after Deuteronomy 32:11: before dawn the eaglet
 * sleeps in its nest on a crag over the wilderness.  While the reference fills (`p` 0..1) the sky
 * pales from night to dawn, the parent eagle circles in and comes to hover over the nest with its
 * wings spread, and the eaglet wakes; at 1 the sun clears the far hills.  The runner's calibration
 * card covers the lower part of the screen, so the crag and the nest sit high.
 */
import { approach, clamp, ease } from '../kit/juice';
import { stageOf, type WzlotProgress } from './meta';
import { LAND_LOOK, mixInto, paintEagle, paintEaglet, paintNest, paintRange, paintSky, paintSpire, rgb, skyAt, type EagletPose, type RGB, type SkyLook } from './paint';

export class WzlotIntro {
  private clock = 0;
  private shown = 0;
  private readonly night: SkyLook = skyAt(1.35);
  private readonly dawn: SkyLook = skyAt(0.02);
  private readonly sky: SkyLook = skyAt(0);
  private readonly tmp: RGB = [0, 0, 0];
  private readonly pose: EagletPose = { stage: 1, fold: 0.7, spread: 0.55, flap: 0, glow: 0 };

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: WzlotProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    // the sky: night paling to dawn
    const s = this.sky;
    for (const key of ['top', 'mid', 'low', 'sun', 'light'] as const) mixInto(s[key], this.night[key], this.dawn[key], ease.inOutSine(k));
    s.night = 1 - k;
    paintSky(ctx, 0, 0, w, h, 0.02 + 0.02 * k, s, t);
    // the wilderness far below: Hermon's snow far off, the Negev's ranges nearer
    const tall = h > w;
    const unit = tall ? w / 1.6 : Math.min(h, w / 2);
    const foot = h * (tall ? 0.62 : 0.7);
    const shade = (c: RGB, f: number) => {
      mixInto(this.tmp, c, s.mid, f);
      return mixInto(this.tmp, this.tmp, [20, 22, 46], 0.55 * (1 - k));
    };
    const scroll = t * 0.01;
    paintRange(ctx, w, 2 + scroll, 1.6 / unit, foot - unit * 0.18, unit * 0.5, shade(LAND_LOOK.hermon.far, 0.4), 'hermon', 0, 53, h + 2);
    paintRange(ctx, w, 5 + scroll * 2, 2.2 / unit, foot, unit * 0.3, shade(LAND_LOOK.negev.mid, 0.25), 'negev', 1, 21, h + 2);
    paintRange(ctx, w, 9 + scroll * 3, 3 / unit, foot + unit * 0.2, unit * 0.25, shade(LAND_LOOK.negev.near, 0.12), 'negev', 2, 31, h + 2);
    // the crag with the nest, high on the left (clear of the calibration card)
    const nx = w * (tall ? 0.42 : 0.36), ny = h * (tall ? 0.36 : 0.42);
    const crag = mixInto([0, 0, 0], LAND_LOOK.negev.near, [24, 20, 36], 0.5 * (1 - k));
    const strata = mixInto([0, 0, 0], LAND_LOOK.negev.strata, [24, 20, 36], 0.5 * (1 - k));
    paintSpire(ctx, nx, h + 4, ny, unit * 0.16, crag, strata);
    const ns = Math.max(40, unit * 0.22);
    // the eaglet in the nest: asleep (folded, its head low) until the light comes
    const pose = this.pose;
    pose.stage = stageOf(progress.feathers);
    pose.fold = 1 - 0.6 * clamp((k - 0.6) / 0.4);
    pose.flap = k > 0.85 ? Math.sin(t * 6) * 0.6 : 0;
    const es = ns * 0.42;
    paintEaglet(ctx, nx, ny - es * 0.25 - Math.sin(t * 1.4) * 0.6, es, k > 0.6 ? 0.15 : -0.1, pose);
    paintNest(ctx, nx, ny, ns);
    // the parent circles in and spreads its wings over the nest
    const arrive = ease.outCubic(clamp(k / 0.85));
    const ang = t * 0.9;
    const r = (1 - arrive) * Math.min(w, h) * 0.35;
    const px = nx + Math.cos(ang) * r + (1 - arrive) * w * 0.2;
    const py = ny - ns * 0.9 - Math.sin(ang) * r * 0.4 - (1 - arrive) * h * 0.12;
    const size = Math.max(44, unit * 0.26) * (0.7 + 0.3 * arrive);
    paintEagle(ctx, px, py, size, 0.05 * Math.sin(t), t * (2.5 - arrive), Math.cos(ang) * (1 - arrive) < -0.3 ? -1 : 1, clamp(k * 3));
    // the first light along the far ridges at dawn
    if (k > 0.5) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (k - 0.5) * 0.5;
      const g = ctx.createRadialGradient(w * 0.85, foot - unit * 0.2, 0, w * 0.85, foot - unit * 0.2, Math.max(w, h) * 0.6);
      g.addColorStop(0, rgb(s.light, 0.6));
      g.addColorStop(1, rgb(s.light, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
