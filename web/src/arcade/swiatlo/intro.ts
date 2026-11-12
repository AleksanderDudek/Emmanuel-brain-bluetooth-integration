/**
 * Światło ciała's calibration intro: the night and the glass figure, standing still; while the reference
 * fills (`p` 0..1) light comes in through the eyes ("the eye is the lamp of the body"), gathers at the
 * crown into a band, and the organs the player has lit before glow faintly from the map.  The figure
 * breathes slowly.  The runner's calibration card covers the lower part of the screen, so the scene sits high.
 */
import { approach, clamp } from '../kit/juice';
import { ORGAN, ORGANS, type OrganId } from './content';
import { HEAD, ORGAN_SPOT } from './figure';
import type { SwiatloProgress } from './meta';
import { GOLD, ICE, bakeFigure, bakeNight, bandSprite, glow, type FigureLayers, type Layer } from './paint';

export class SwiatloIntro {
  private clock = 0;
  private shown = 0;
  private key = '';
  private night: Layer | null = null;
  private fig: FigureLayers | null = null;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: SwiatloProgress, dpr: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const H = Math.min(h * 0.6, w * 1.6);
    const box = { cx: w / 2, top: h * 0.05, H };
    const key = `${w}x${h}@${dpr}`;
    if (key !== this.key) {
      this.key = key;
      this.night = bakeNight(w, h, dpr, box.cx, box.top + H * 0.45);
      this.fig = bakeFigure(box, 1, dpr);
    }
    if (this.night) ctx.drawImage(this.night, 0, 0, w, h);
    else {
      ctx.fillStyle = '#0b1430';
      ctx.fillRect(0, 0, w, h);
    }
    const fig = this.fig;
    const breathe = 1 + 0.006 * Math.sin(t * 0.63);
    ctx.save();
    ctx.translate(box.cx, box.top + H * 0.5);
    ctx.scale(breathe, breathe);
    ctx.translate(-box.cx, -(box.top + H * 0.5));
    if (fig) ctx.drawImage(fig.base, fig.box.x, fig.box.y, fig.box.w, fig.box.h);
    // the map's lit organs, faintly
    if (fig) {
      for (const o of ORGANS) {
        const lit = [1, 2, 3].some(d => (progress.map?.[`${o}:${d}`] ?? 0) > 0);
        const s = fig.lit[o as OrganId];
        if (!lit || !s) continue;
        ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 0.8 + ORGANS.indexOf(o));
        ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    // light comes in through the eyes
    const ey = box.top + (HEAD.y + 0.006) * H;
    for (const s of [-1, 1]) glow(ctx, ICE, box.cx + s * HEAD.rx * 0.42 * H, ey, H * (0.012 + 0.03 * k), 0.25 + 0.6 * k);
    // and gathers at the crown into the band
    const spr = bandSprite(k > 0.9 ? GOLD : ICE);
    if (spr && k > 0.05) {
      const y = box.top + H * 0.012;
      const th = H * 0.03 * k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.6 * k;
      ctx.drawImage(spr, box.cx - H * 0.22 * k, y - th, H * 0.44 * k, th * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // the heart beats softly all along
    const hp = { x: box.cx + ORGAN_SPOT.heart.x * H, y: box.top + ORGAN_SPOT.heart.y * H };
    const beat = Math.max(0, 1 - ((t * 70) / 60 % 1) / 0.3);
    glow(ctx, ORGAN.heart.hue, hp.x, hp.y, H * (0.03 + 0.02 * beat), 0.12 + 0.2 * beat);
  }
}
