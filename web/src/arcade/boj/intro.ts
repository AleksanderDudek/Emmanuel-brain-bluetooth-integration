/**
 * Dobry bój's calibration intro (DESIGN.md §25): while the band's reference is taken, the ring under its light with
 * the player's own fighter (their division, skin and hair, in their style's ring or cage) facing an opponent, gloves
 * up — builder B's `drawPreview` on its own clock.  The runner's calibration card covers the lower part and shows the
 * reference filling, so the picture is B's to frame high.
 */
import { playerLook } from './content';
import type { BojProgress } from './meta';
import { drawPreview } from './preview';

export class BojIntro {
  private clock = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, progress: BojProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += Math.max(0, Math.min(0.25, dt));
    drawPreview(ctx, w, h, this.clock, playerLook(progress.sex, progress.skin, progress.hair), progress.style);
  }
}
