/** Card art for the arcade games: a still from the game's own animated preview (DESIGN.md §9). */
import type { ArcadeEntry } from './registry';

/** Draw the preview at `t` seconds into `canvas` (loads the game's chunk once); quietly nothing on failure. */
export async function drawArcadeArt(canvas: HTMLCanvasElement, entry: ArcadeEntry, t = 3.2): Promise<void> {
  try {
    const mod = await entry.load();
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mod.preview(ctx, r.width, r.height, t);
  } catch (e) {
    console.warn(`card art of ${entry.id}`, e);
  }
}
