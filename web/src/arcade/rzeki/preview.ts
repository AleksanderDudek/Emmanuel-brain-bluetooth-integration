/**
 * Rzeki żywej wody's picture for the lobby's hero and the game card: the sky, the open heaven, the figure of
 * light, a stream of light walking down its column with the gold and silver threads behind it, each place
 * opening its rose window as the stream reaches it, then the whole body in light and again.  In the lobby
 * (with progress) the places the player has lit across sessions glow from the start — a quiet map on the figure.
 */
import { mapGlow, tierOf, type RzekiProgress } from './meta';
import { QuietScene } from './scene';

const scenes = new Map<string, QuietScene>();

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
  const H = Math.min(h * 0.86, w * 1.9);
  const cx = w * (w > h * 1.2 ? 0.66 : 0.5);
  const top = (h - H * 1.04) / 2 + H * 0.04;
  scene.draw(ctx, w, h, dpr, { cx, top, H }, Math.max(0, t), { glowOf: p ? pl => mapGlow(p, pl) : undefined, tierOf: p ? pl => tierOf(p, pl) : undefined, heaven: 0.7 });
}
