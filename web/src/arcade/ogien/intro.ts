/**
 * Ogień's calibration intro: the spark in cupped hands, before the game begins.  While the reference fills
 * (`p` 0..1) the ember wakes — a dull red point, then a glow that lights the fingers, then at the end the
 * first small flame catches.  The runner's calibration card covers the lower part of the screen, so the
 * hands sit high.  The backdrop is painted once per size.
 */
import { approach, clamp } from '../kit/juice';
import { drawFlame, drawGlow, FIRE } from './paint';
import { SCENES, type Geo, type Live } from './scenes';
import type { OgienProgress } from './meta';
import type { OgienSim } from './sim';

export class OgienIntro {
  private clock = 0;
  private shown = 0;
  private back: HTMLCanvasElement | null = null;
  private key = '';

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, dt: number, p: number, _progress: OgienProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.5);
    const k = this.shown, t = this.clock;
    // the runner's calibration card covers the middle and the bottom: the ember sits high, the hands under it
    const R = Math.max(40, Math.min(w * 0.22, h * 0.12));
    const g: Geo = { w, h, cx: w / 2, cy: Math.max(R * 0.9, h * 0.14), R, top: 0, bottom: h, u: 1, dpr };
    const key = `${w}x${h}@${dpr}`;
    if (key !== this.key) {
      this.key = key;
      this.back = null;
      if (typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
        const gc = c.getContext('2d');
        if (gc) {
          gc.setTransform(dpr, 0, 0, dpr, 0, 0);
          SCENES[0].back(gc, g, 0);
          this.back = c;
        }
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.back) ctx.drawImage(this.back, 0, 0, w, h);
    else {
      ctx.fillStyle = '#120a10';
      ctx.fillRect(0, 0, w, h);
    }
    const live: Live = {
      t, heat: 0.3 + 0.4 * k, charge: k > 0.9 ? (k - 0.9) * 4 : 0, glow: 0.1 + 0.6 * k, grow: 0.6 + 0.4 * k, energy: 0.3 + 0.4 * k,
      rest: false, breath: 0, calm: 0, bend: 0, warn: 0, shield: 0, flare: 0, variant: 0, reduced: false, sim: null as unknown as OgienSim,
    };
    ctx.globalCompositeOperation = 'lighter';
    SCENES[0].under(ctx, g, live);
    ctx.globalCompositeOperation = 'source-over';
    SCENES[0].fire(ctx, g, live);
    // the first little flame, when the band is ready
    if (k > 0.95) drawFlame(ctx, g.cx, g.cy + R * 0.12, R * 0.12, R * 0.3 * (k - 0.95) * 20, t, 0.7, FIRE, 0, 2);
    // a few sparks, more as it wakes
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const s = (t * (0.4 + i * 0.07) + i / 6) % 1;
      drawGlow(ctx, g.cx + Math.sin(t + i * 2) * R * 0.2 * s, g.cy - s * R * 1.2, R * 0.03, [255, 190, 90], (1 - s) * k);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
