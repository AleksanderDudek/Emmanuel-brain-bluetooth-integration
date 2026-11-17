/**
 * Rzeki żywej wody's picture for the lobby's hero and the game card: the sky, the open heaven, the two shells of
 * light and the stars above the head as picture 2 draws them, the figure of light, a stream of light walking down
 * its column with the gold and silver threads behind it, each window opening as the stream reaches it, then the
 * whole figure in light and again.  In the lobby (with progress) the stations the player has lit across sessions
 * glow from the start — a quiet map of light on the figure, on the map the player chose — and the map column
 * (strip.ts) stands beside it with every station of the map and its count, as in play (round 11: the whole map,
 * the twelve of picture 2 among them, in sight before the first session).
 */
import { MAP } from './content';
import { mapGlow, stationsLit, tierOf, type RzekiProgress } from './meta';
import { QuietScene } from './scene';
import { drawStrip } from './strip';

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
  const map = p?.map ?? 'all';
  scene.draw(ctx, w, h, dpr, { cx, top, H }, Math.max(0, t), {
    glowOf: p ? s => mapGlow(p, s) : undefined, tierOf: p ? s => tierOf(p, s) : undefined, heaven: 0.7, map,
  });
  // the lobby's hero (with the player's progress): the map column on the left, above the title the lobby sets over the
  // picture's foot; the small game cards keep the picture alone
  if (!p || h < 360 || w < 240) return;
  const u = Math.min(1.4, Math.max(1, h / 520));
  const sw = Math.round(30 * u);
  const box = { x: Math.max(10, Math.min(cx - H * 0.62 - sw, w * 0.06)), y: h * 0.05, w: sw, h: h * 0.6 };
  drawStrip(ctx, box, {
    map, litOf: s => (mapGlow(p, s) > 0 ? 1 : 0), tierOf: s => tierOf(p, s), current: null, at: null, fill: 0, dir: 'down',
    lit: stationsLit(p, MAP[map].stations),
  }, u, dpr, t, { still: true });
}
