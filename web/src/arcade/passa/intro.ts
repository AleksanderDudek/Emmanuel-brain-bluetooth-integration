/**
 * Złota passa's calibration intro (DESIGN.md §26): while the band's reference is taken, the street at golden hour under
 * its garland — builder B's `drawPreview` on its own clock, with the lights of the player's best day and their
 * day-streak (a fresh player: a few bulbs, no sign).  The runner's calibration card covers the lower part and shows the
 * reference filling, so the picture is B's to frame high.
 */
import type { PassaProgress } from './meta';
import { drawPreview } from './preview';
import { streakNow } from './rules';

export class PassaIntro {
  private clock = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, progress: PassaProgress, day: string): void {
    if (w < 2 || h < 2) return;
    this.clock += Math.max(0, Math.min(0.25, dt));
    drawPreview(ctx, w, h, this.clock, lightsOf(progress), streakNow(progress.streak, day).days);
  }
}

/** The garland's lit bulbs in a preview: the player's best day (a fresh player: a few, to show what lights it). */
export const lightsOf = (p: PassaProgress | null | undefined): number => (p && p.sessions > 0 ? Math.max(3, Math.min(24, p.best)) : 12);
