/**
 * Światło ciała's picture for the lobby's hero and the game card: the night and the glass figure, the organs lighting
 * up one after another as a gentle light passes (gold while it fills), then the whole body glowing and again.  In the
 * lobby (with progress) the chosen meditation's picture shows (the brain for "Mózg") and the elements the player has
 * lit glow from the start.
 */
import { LISTS, type VariantId } from './content';
import { BRAIN_BOX } from './brain';
import { fitCam } from './layout';
import type { SwiatloProgress } from './meta';
import { bakeNight, type Layer } from './paint';
import { drawBrain, drawFigure } from './picture';

const cache = new Map<string, Layer | null>();

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: SwiatloProgress): void {
  if (w < 4 || h < 4) return;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const wide = w > h * 1.2;
  const box = wide ? { x: w * 0.42, y: h * 0.04, w: w * 0.5, h: h * 0.92 } : { x: w * 0.05, y: h * 0.04, w: w * 0.9, h: h * 0.92 };
  const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
  let night = cache.get(key);
  if (night === undefined) {
    night = bakeNight(w, h, dpr, box.x + box.w / 2, box.y + box.h * 0.45);
    if (cache.size > 6) cache.clear();
    cache.set(key, night);
  }
  const base = ctx.getTransform();
  if (night) ctx.drawImage(night, 0, 0, w, h);
  else {
    ctx.fillStyle = '#0b1430';
    ctx.fillRect(0, 0, w, h);
  }
  const v: VariantId = p?.variant ?? 'narzady';
  const brain = v === 'mozg';
  const view = brain ? 'lat' : 'front';
  const list = LISTS[v].filter(e => e.view === view);
  // the light walks the list: each element fills over 1.6 s, the whole glows for 2 s, and again
  const per = 1.6, loop = list.length * per + 2.5;
  const x = t % loop;
  const i = Math.min(list.length - 1, Math.floor(x / per));
  const walking = x < list.length * per;
  const lit = (id: string): number => {
    if ((p?.lit?.[id] ?? 0) > 0) return 1;
    const j = list.findIndex(e => e.id === id);
    return !walking || j < i ? 1 : 0;
  };
  const st = { current: walking ? list[i].id : null, fill: walking ? (x - i * per) / per : 0, lit, filling: walking, blind: false, rest: !walking, breath: 0.5 + 0.5 * Math.sin(t * 0.63), time: t };
  const scale = base.a || 1;
  const cam = brain ? fitCam(box, BRAIN_BOX.x0, BRAIN_BOX.y0, BRAIN_BOX.x1, BRAIN_BOX.y1, 4) : fitCam(box, -0.23, -0.02, 0.23, 1.02, 2);
  if (brain) drawBrain(ctx, scale, cam, 'lat', list, st);
  else drawFigure(ctx, scale, cam, false, list, st);
  ctx.setTransform(base);
}
