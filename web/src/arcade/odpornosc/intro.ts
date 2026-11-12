/**
 * Odporność's calibration intro: a quiet close-up of skin while the reference fills (`p` 0..1).  The
 * splinter slides in from the air, a few bacteria ride on its tip, and Makro the macrophage, dozing in the
 * dermis, wakes as the reference completes: his receptors light, the first ring of the alarm goes out.  The
 * runner's calibration card covers the lower part of the screen, so the scene sits high.
 */
import { approach, clamp } from '../kit/juice';
import { loopSpec } from './content';
import type { OdpProgress } from './meta';
import { PAL, TAU, circle, glow, paintBug, paintMacrophage, paintSplinter } from './paint';

export class OdpIntro {
  private clock = 0;
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: OdpProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const s = Math.max(2, Math.min(w / 150, h / 120));
    const skin = h * 0.14;
    // the air, the epidermis, the dermis
    const air = ctx.createLinearGradient(0, 0, 0, skin);
    air.addColorStop(0, PAL.air[0]);
    air.addColorStop(1, PAL.air[1]);
    ctx.fillStyle = air;
    ctx.fillRect(0, 0, w, skin);
    ctx.fillStyle = PAL.epi;
    ctx.fillRect(0, skin, w, 9 * s);
    ctx.fillStyle = PAL.corneum;
    ctx.fillRect(0, skin - s, w, 2 * s);
    const der = ctx.createLinearGradient(0, skin + 9 * s, 0, h);
    der.addColorStop(0, PAL.tissue[0]);
    der.addColorStop(0.5, PAL.tissue[1]);
    der.addColorStop(1, PAL.tissue[3]);
    ctx.fillStyle = der;
    ctx.fillRect(0, skin + 9 * s, w, h - skin - 9 * s);
    ctx.strokeStyle = PAL.fibre;
    ctx.lineWidth = 2 * s * 0.5;
    for (let i = 0; i < 9; i++) {
      const y = skin + 16 * s + i * h * 0.07;
      ctx.beginPath();
      ctx.moveTo(-10, y);
      ctx.bezierCurveTo(w * 0.3, y - 5 * s, w * 0.6, y + 5 * s, w + 10, y - 2 * s);
      ctx.stroke();
    }
    // the splinter slides in with the reference
    const wx = w * 0.62;
    const tipY = skin - 14 * s + 30 * s * Math.min(1, k * 1.2);
    paintSplinter(ctx, wx - 12 * s, tipY - 26 * s, wx + 3 * s, tipY, 3.6 * s);
    // the bacteria it carried
    const kind = loopSpec(progress.loop || 1).bug;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + t * 0.4;
      const bx = wx + 4 * s + Math.cos(a) * (4 + i * 2) * s * Math.min(1, k * 1.5), by = tipY + Math.sin(a) * (3 + i) * s * Math.min(1, k * 1.5);
      paintBug(ctx, kind, bx, by, 2 * s, { a, t, seed: i / 5, tag: 0, c3: false, capsule: false, netted: false, split: 0, pop: Math.min(1, k * 2), fade: 0 });
    }
    // Makro dozes, then wakes: his receptors light, the alarm's first ring
    const mx = w * 0.3, my = skin + 24 * s;
    const awake = clamp((k - 0.75) / 0.25);
    glow(ctx, mx, my, 24 * s, '255,220,170', 0.25 + 0.2 * awake);
    paintMacrophage(ctx, mx, my, 10 * s, { t, seed: 0.77, dir: Math.atan2(tipY - my, wx - mx) * awake + (Math.PI / 2) * (1 - awake), speed: 0, m2: 0, eyes: true });
    if (awake < 1) {
      // closed eyes: a sleepy veteran
      ctx.fillStyle = PAL.mac;
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(mx + sd * 3 * s, my - 1.5 * s, 2 * s, 2 * s * (1 - awake), 0, 0, TAU);
        ctx.fill();
      }
    }
    // the receptors (TLRs) light up around his edge
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      ctx.fillStyle = awake > 0 ? `rgba(255,214,120,${0.4 + 0.6 * awake})` : 'rgba(255,240,220,0.4)';
      circle(ctx, mx + Math.cos(a) * 11.5 * s, my + Math.sin(a) * 11.5 * s, 1.1 * s);
      ctx.fill();
    }
    if (awake > 0) {
      const ring = ((t * 0.6) % 1) * 40 * s;
      ctx.strokeStyle = `rgba(255,210,122,${0.6 * awake * (1 - ring / (40 * s))})`;
      ctx.lineWidth = 2;
      circle(ctx, mx, my, 12 * s + ring);
      ctx.stroke();
    }
  }
}
