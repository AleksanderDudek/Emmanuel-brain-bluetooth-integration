/**
 * Rzeki żywej wody's calibration intro: the sky and the figure of light, standing still while the band
 * settles; as the reference fills (`p` 0..1) the heaven above it opens and its rays grow, and the places the
 * player has lit before glow faintly from the lobby's map.  The figure breathes slowly.  The runner's
 * calibration card covers the lower part of the screen, so the scene sits high.
 */
import { approach, clamp } from '../kit/juice';
import type { RzekiProgress } from './meta';
import { mapGlow, tierOf } from './meta';
import { QuietScene } from './scene';

export class RzekiIntro {
  private clock = 0;
  private shown = 0;
  private readonly scene = new QuietScene();

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: RzekiProgress, dpr: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const H = Math.min(h * 0.6, w * 1.5);
    const box = { cx: w / 2, top: h * 0.07 + H * 0.06, H };
    this.scene.draw(ctx, w, h, dpr, box, this.clock, {
      stream: false, heaven: 0.15 + 0.85 * this.shown, glowOf: pl => mapGlow(progress, pl), tierOf: pl => tierOf(progress, pl),
    });
  }
}
