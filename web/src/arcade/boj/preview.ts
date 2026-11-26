/**
 * STUB (lead) — builder B ("ring") fills it: the lobby's hero and the calibration intro — the ring under its lights,
 * the player's fighter (their look) facing an opponent, gloves up.
 */
import type { Style } from './moves';
import type { Look } from './view';

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, look?: Look, style?: Style): void {
  void time; void look; void style;
  ctx.fillStyle = '#1a1218';
  ctx.fillRect(0, 0, w, h);
}
