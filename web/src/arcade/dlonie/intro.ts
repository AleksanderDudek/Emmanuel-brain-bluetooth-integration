/**
 * The calibration scene (while the band takes its reference): the hands in the night, warming as the calibration
 * runs, and a spark that slowly gathers between them — nothing grows from the band yet.
 */
import { drawPicture } from './preview';

export class DlonieIntro {
  private t = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, reducedMotion = false): void {
    this.t += dt;
    drawPicture(ctx, w, h, this.t, { grow: 0.02 + 0.12 * p, warm: 0.3 * p, still: reducedMotion, size: 0.72 });
  }
}
