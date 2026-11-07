/**
 * Urodzaj's calibration intro: morning on Boaz's field.  The empty basket waits at the field's edge,
 * Feliks the sparrow flies in along the twine, and while the reference fills (`p` 0..1) the fruits of
 * the ladder appear one by one in a ring over the basket, olive to the great cluster — the circle the
 * game climbs.  The runner's calibration card covers the lower part of the screen, so the scene sits high.
 */
import { approach, clamp } from '../kit/juice';
import { MAX_TIER, fruit } from './content';
import type { UrodzajProgress } from './meta';
import { C, TAU, paintBasketBack, paintBasketFront, paintField, paintFruit, paintGleaner, paintRim, paintSparrow, type FruitSprites, type SparrowPose } from './paint';

export class UrodzajIntro {
  private clock = 0;
  private shown = 0;
  private readonly pose: SparrowPose = { flip: 1, flap: 0.6, beat: 0, strain: 0, talk: false, blink: false, scared: false, t: 0 };

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, _progress: UrodzajProgress, sprites: FruitSprites | null): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    // the runner's card sits in the middle (wide) or over the lower part (tall): the scene goes beside it or above it
    const wide = w > h * 1.2;
    const free = (w - 540) / 2;
    const S = wide ? Math.max(60, Math.min(free * 0.62, h * 0.36)) : Math.max(60, Math.min(w * 0.36, h * 0.2));
    const cx = wide ? Math.max(S * 0.7, free / 2) : w / 2;
    const floor = wide ? h * 0.78 : Math.max(S * 1.3, h * 0.3);
    paintField(ctx, w, h, floor + S * 0.07, t);
    const bp = { x0: cx - S / 2, x1: cx + S / 2, floor, rim: floor - S * 0.62, wall: Math.max(6, S * 0.045), charge: k * 0.6, veiled: false, burst: 0, t };
    paintBasketBack(ctx, bp);
    paintBasketFront(ctx, bp);
    paintRim(ctx, bp, { wind: null, live: false, danger: 0, over: 0, waiting: false, t });
    // the ring of fruits, appearing as the reference fills
    const ringR = S * 0.5, rx = cx, ry = bp.rim - S * 0.55;
    for (let i = 0; i < MAX_TIER; i++) {
      const on = clamp((k * MAX_TIER - i) * 1.5);
      if (on <= 0) continue;
      const a = -Math.PI / 2 + (i / MAX_TIER) * TAU + t * 0.15;
      const R = S * 0.035 * (1 + i * 0.09) * on;
      paintFruit(ctx, sprites, i + 1, rx + Math.cos(a) * ringR, ry + Math.sin(a) * ringR * 0.55, R, 0, 0, i < 3 ? 'calm' : 'happy');
    }
    // Feliks flies in and hovers over the basket
    const fx = cx - S * 0.9 * (1 - clamp(t / 2.2)) + Math.sin(t * 1.3) * S * 0.08;
    this.pose.t = t;
    this.pose.beat += dt * 18;
    paintSparrow(ctx, fx, bp.rim - S * 0.12, Math.max(22, S * 0.16), this.pose);
    if (wide) {
      // the gleaners wait on the other side of the card
      const gx = w - free / 2;
      paintGleaner(ctx, gx - S * 0.2, floor + S * 0.07, S * 0.5, 0.2 + 0.1 * Math.sin(t), '#8c6a3e', '#d9c9a3');
      paintGleaner(ctx, gx + S * 0.2, floor + S * 0.07, S * 0.45, 0.3 + 0.1 * Math.sin(t + 1), '#b5523b', '#efe4cc');
    } else paintGleaner(ctx, cx - S * 0.85, floor + S * 0.07, S * 0.34, 0.2 + 0.1 * Math.sin(t), '#8c6a3e', '#d9c9a3');
    // a first olive in his feet once the ring is full
    if (k > 0.98) paintFruit(ctx, sprites, 1, fx, bp.rim - S * 0.06, fruit(1).r * S * 1.4, 0, 0, 'happy');
    void C;
  }
}
