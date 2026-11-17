/**
 * Rzeki żywej wody's picture for the lobby's hero and the game card: the sky, the open heaven, the two shells of
 * light and the stars above the head as picture 2 draws them, the figure of light, a stream of light walking down
 * its column with the gold and silver threads behind it, each window opening as the stream reaches it, then the
 * whole figure in light and again.  In the lobby (with progress) the stations the player has lit across sessions
 * glow from the start — a quiet map of light on the figure, on the map the player chose.
 */
import { mapGlow, tierOf, type RzekiProgress } from './meta';
import { QuietScene } from './scene';

const scenes = new Map<string, QuietScene>();

/** The share of the figure's height the picture shows: from the gate at the top of the outer egg to the pool below the feet. */
const SPAN = { top: 0.66, bottom: 1.12 } as const;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: RzekiProgress): void {
  if (w < 4 || h < 4) return;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
  let scene = scenes.get(key);
  if (!scene) {
    if (scenes.size > 6) scenes.clear();
    scene = new QuietScene();
    scenes.set(key, scene);
  }
  const span = SPAN.top + SPAN.bottom;
  const H = Math.min((h * 0.94) / span, w * 0.95);
  const cx = w * (w > h * 1.2 ? 0.66 : 0.5);
  const top = (h - H * span) / 2 + SPAN.top * H;
  scene.draw(ctx, w, h, dpr, { cx, top, H }, Math.max(0, t), {
    glowOf: p ? s => mapGlow(p, s) : undefined, tierOf: p ? s => tierOf(p, s) : undefined, heaven: 0.7, map: p?.map ?? 'all',
  });
}
