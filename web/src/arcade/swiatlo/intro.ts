/**
 * Światło ciała's calibration intro: the night and the glass figure of the chosen meditation's picture, standing
 * still (the brain for "Mózg"); while the reference fills (`p` 0..1) light comes in through the eyes ("the eye is the
 * lamp of the body") and the elements the player has lit before glow faintly.  The runner's calibration card covers
 * the lower part of the screen, so the picture sits high.
 */
import { approach, clamp } from '../kit/juice';
import { LISTS } from './content';
import { fitCam } from './layout';
import { BRAIN_BOX } from './brain';
import type { SwiatloProgress } from './meta';
import { GOLD, ICE, bakeNight, glow, type Layer } from './paint';
import { drawBrain, drawFigure } from './picture';

export class SwiatloIntro {
  private clock = 0;
  private shown = 0;
  private key = '';
  private night: Layer | null = null;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: SwiatloProgress, dpr: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const box = { x: w * 0.1, y: h * 0.04, w: w * 0.8, h: h * 0.58 };
    const key = `${w}x${h}@${dpr}`;
    if (key !== this.key) {
      this.key = key;
      this.night = bakeNight(w, h, dpr, w / 2, box.y + box.h * 0.45);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.night) ctx.drawImage(this.night, 0, 0, w, h);
    else {
      ctx.fillStyle = '#0b1430';
      ctx.fillRect(0, 0, w, h);
    }
    const v = progress.variant ?? 'narzady';
    const lit = (id: string) => ((progress.lit?.[id] ?? 0) > 0 ? 0.35 + 0.15 * Math.sin(t * 0.8) : 0);
    const st = { current: null, fill: 0, lit, filling: false, blind: false, rest: true, breath: 0.5 + 0.5 * Math.sin(t * 0.63), time: t };
    if (v === 'mozg') {
      const cam = fitCam(box, BRAIN_BOX.x0, BRAIN_BOX.y0, BRAIN_BOX.x1, BRAIN_BOX.y1, 4);
      drawBrain(ctx, dpr, cam, 'lat', LISTS.mozg.filter(e => e.view === 'lat'), st);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      glow(ctx, k > 0.9 ? GOLD : ICE, cam.ox + 0.15 * cam.s, cam.oy + 0.28 * cam.s, cam.s * (0.05 + 0.12 * k), 0.2 + 0.6 * k);
      return;
    }
    const cam = fitCam(box, -0.23, -0.02, 0.23, 1.02, 2);
    drawFigure(ctx, dpr, cam, false, LISTS[v].filter(e => e.view === 'front'), st);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // light comes in through the eyes
    for (const s of [-1, 1]) glow(ctx, k > 0.9 ? GOLD : ICE, cam.ox + s * 0.017 * cam.s, cam.oy + 0.074 * cam.s, cam.s * (0.012 + 0.03 * k), 0.25 + 0.6 * k);
  }
}
