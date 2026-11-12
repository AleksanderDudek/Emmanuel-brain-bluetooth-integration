/**
 * Światło ciała's picture for the lobby's hero and the game card: the night, the glass figure, a band of
 * light gliding from the crown to the soles (gold for a while: focus), each organ lighting up as the band
 * passes and glowing on, then the whole body in light and the scan again.  In the lobby (with progress) the
 * organs the player has lit on the body map glow from the start.  The figure is baked once per size.
 */
import { ORGAN, ORGANS } from './content';
import { ORGAN_SPOT } from './figure';
import type { SwiatloProgress } from './meta';
import { GOLD, ICE, bakeFigure, bakeNight, bandSprite, glow, type FigureLayers, type Layer } from './paint';

const cache = new Map<string, { night: Layer | null; fig: FigureLayers | null; H: number; cx: number; top: number }>();

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: SwiatloProgress): void {
  if (w < 4 || h < 4) return;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
  let c = cache.get(key);
  if (!c) {
    const H = Math.min(h * 0.9, w * 1.9);
    const cx = w * (w > h * 1.2 ? 0.66 : 0.5), top = (h - H) / 2;
    c = { night: bakeNight(w, h, dpr, cx, top + H * 0.45), fig: bakeFigure({ cx, top, H }, 1, dpr), H, cx, top };
    if (cache.size > 6) cache.clear();
    cache.set(key, c);
  }
  const { night, fig, H, cx, top } = c;
  if (night) ctx.drawImage(night, 0, 0, w, h);
  else {
    ctx.fillStyle = '#0b1430';
    ctx.fillRect(0, 0, w, h);
  }
  if (fig) ctx.drawImage(fig.base, fig.box.x, fig.box.y, fig.box.w, fig.box.h);
  // the scan: 9 s down the body, a breath of the whole body in light, again
  const cyc = 11, q = (t % cyc) / cyc;
  const v = Math.min(1, q / 0.82);
  const whole = q > 0.82 ? Math.sin(((q - 0.82) / 0.18) * Math.PI) : 0;
  const gold = Math.sin(t * 0.5) > 0;
  if (fig) {
    for (const o of ORGANS) {
      const s = fig.lit[o];
      if (!s) continue;
      const passed = v >= ORGAN[o].v;
      const lit = p ? [1, 2, 3].some(d => (p.map?.[`${o}:${d}`] ?? 0) > 0) : false;
      const a = Math.max(passed ? 0.75 : 0, lit ? 0.3 : 0, whole);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
      ctx.globalAlpha = 1;
    }
  }
  // the band
  const y = top + v * H;
  const spr = bandSprite(gold ? GOLD : ICE);
  if (spr && q <= 0.82 && fig) {
    ctx.save();
    ctx.clip(fig.clip);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(spr, cx - H * 0.22, y - H * 0.05, H * 0.44, H * 0.1);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.drawImage(spr, 0, y - H * 0.08, w, H * 0.16);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // the heart beats
  const beat = Math.max(0, 1 - ((t * 66) / 60 % 1) / 0.3);
  glow(ctx, ORGAN.heart.hue, cx + ORGAN_SPOT.heart.x * H, top + ORGAN_SPOT.heart.y * H, H * (0.03 + 0.02 * beat), 0.15 + 0.25 * beat);
  if (whole > 0) glow(ctx, GOLD, cx, top + H * 0.45, H * 0.7, 0.25 * whole);
}
