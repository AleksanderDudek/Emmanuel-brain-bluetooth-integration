/**
 * Rzeki żywej wody's calibration intro: the sky and the figure of light with the stars and the shells of the
 * player's map, standing still while the band settles; as the reference fills (`p` 0..1) the heaven above it opens
 * and its rays grow, and the stations the player has lit before glow faintly from the lobby's map.  The figure
 * breathes slowly.  The runner's calibration card covers the lower part of the screen, so the scene sits high.
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
    // from the gate at the top of the outer egg to the pool, in the upper part of the screen (the card covers the rest)
    const H = Math.min((h * 0.64) / 1.78, w * 0.9);
    const box = { cx: w / 2, top: h * 0.03 + H * 0.66, H };
    this.scene.draw(ctx, w, h, dpr, box, this.clock, {
      stream: false, heaven: 0.15 + 0.85 * this.shown, glowOf: s => mapGlow(progress, s), tierOf: s => tierOf(progress, s), map: progress.map,
    });
  }
}
