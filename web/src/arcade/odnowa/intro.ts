/**
 * Odnowa's calibration scene (the runner's card sits over it while the band takes its reference): the cell
 * wakes up — the lens brightens, the pumps start, protons gather round the turbine and it begins to turn,
 * slowly, faster as the calibration fills its ring; Mito opens his eyes.  The same pictures as the play.
 */
import { clamp } from '../kit/juice';
import { sessionNiche, type OdnowaProgress } from './meta';
import { C, glow, paintCity, paintGauge, paintLensBack, paintLensRim, paintMito, paintTurbine, rgba } from './paint';

export class OdnowaIntro {
  private t = 0;
  private angle = 0;
  private bg: HTMLCanvasElement | null = null;
  private key = '';

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, prog: OdnowaProgress, dpr: number): void {
    this.t += dt;
    const k = clamp(p);
    const r = Math.max(48, Math.min(w, h) * 0.24);
    const cx = w / 2, cy = h * 0.52;
    const key = `${w}x${h}x${dpr}`;
    if (this.key !== key) {
      this.key = key;
      this.bg = null;
      try {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
        const g = c.getContext('2d');
        if (g) {
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          paintCity(g, { w, h, lens: { x: cx, y: cy, r }, lane: { x: 0, y: h * 0.85, w, h: h * 0.15 }, nucleus: { x: w * 0.1, y: h * 0.95, r: Math.max(90, w * 0.36) }, top: 0 }, sessionNiche(prog));
          this.bg = c;
        }
      } catch {
        this.bg = null;
      }
    }
    if (this.bg) ctx.drawImage(this.bg, 0, 0, w, h);
    else {
      ctx.fillStyle = '#0c2629';
      ctx.fillRect(0, 0, w, h);
    }
    // the cell wakes: the dark lifts as the reference fills
    ctx.fillStyle = `rgba(2,10,14,${0.55 * (1 - k)})`;
    ctx.fillRect(0, 0, w, h);
    const spin = 0.08 + 0.9 * k;
    this.angle += spin * dt;
    glow(ctx, '#9f8cff', cx, cy, r * 1.5, 0.15 + 0.25 * k);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    paintLensBack(ctx, r);
    paintTurbine(ctx, r, { angle: this.angle, grad: 0.15 + 0.6 * k, spin, beta: [0, 0, 0], surge: 0, t: this.t, veiled: false, rest: 0 });
    ctx.restore();
    paintGauge(ctx, cx, cy, r + Math.max(6, r * 0.08), k, rgba(C.vane, 0.9), C.gold);
    paintLensRim(ctx, cx, cy, r, 0);
    const mr = Math.max(14, r * 0.22);
    paintMito(ctx, cx - r - mr * 2.4, cy - r * 0.55, mr, {
      t: this.t, talk: false, blink: k < 0.35 ? 1 - k * 2 : 0, joy: k > 0.9 ? 0.6 : 0, tired: Math.max(0, 0.6 - k), look: 0.6,
    });
  }
}
