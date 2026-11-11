/**
 * Nehemiasz's calibration intro: dusk over the ruined wall of Jerusalem.  Nehemiah and Tirza stand on
 * a rock by the rubble with the plans; the first watch fire is lit, and while the reference fills
 * (`p` 0..1) its ring of light grows and turns gold, the stars come out, and up on the hill Sanballat
 * peers down.  The runner's calibration card covers the lower part of the screen, so the scene sits high.
 */
import { approach, clamp } from '../kit/juice';
import { gateName } from './content';
import type { NehProgress } from './meta';
import { C, font, glow, hash, paintBrazier, paintNehemiah, paintSanballat, paintTirza, paintWallSeg } from './paint';

export class NehIntro {
  private clock = 0;
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: NehProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, C.night0);
    sky.addColorStop(0.55, '#4a3b5c');
    sky.addColorStop(1, '#c47a5a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // stars come out with the calibration
    ctx.fillStyle = '#fff6dc';
    for (let i = 0; i < 50; i++) {
      if (hash(i + 3) > k + 0.1) continue;
      ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * (0.8 + hash(i)) + i));
      ctx.fillRect(hash(i) * w, hash(i + 40) * h * 0.45, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
    const S = Math.max(18, Math.min(w / 12, h / 8));
    const ground = h * 0.56;
    // the hills
    ctx.fillStyle = '#2a2440';
    ctx.beginPath();
    ctx.moveTo(0, ground - S * 1.6);
    for (let x = 0; x <= w; x += w / 12) ctx.lineTo(x, ground - S * (1.2 + 0.6 * Math.sin(x * 0.012 + 1.3)));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    // Sanballat peering from the hill
    paintSanballat(ctx, w * 0.82, ground - S * 1.35, S * 0.7, t, false, 0);
    // the ruined wall across, a stretch standing
    const yOut = ground - S * 0.35, yIn = ground;
    const segW = w / 6;
    for (let i = 0; i < 6; i++) {
      paintWallSeg(ctx, i * segW, (i + 1) * segW, yOut, yIn, S, { h: i === 2 || i === 3 ? 0.8 : 0.15, hp: 1, breach: false, working: i === 3 ? 0.4 : null, night: true, t, seed: i * 5, done: 0 });
    }
    ctx.fillStyle = '#2b2944';
    ctx.fillRect(0, yIn, w, h - yIn);
    // the first watch fire: its ring grows with the calibration and turns gold at the end
    const fx = w * 0.42, fy = yIn - S * 0.3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, fx, fy, S * (1 + 3.5 * k), 'rgba(255,190,100,', 0.3);
    ctx.restore();
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = 'rgba(255,250,232,.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(fx, fy, S * 2.2, S * 2.2 * 0.8, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = k > 0.98 ? C.gold : 'rgba(255,236,200,.85)';
    ctx.lineWidth = k > 0.98 ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(fx, fy, S * (0.8 + 2.6 * k), S * (0.8 + 2.6 * k) * 0.8, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    paintBrazier(ctx, fx, fy + S * 0.15, S, 1, k, k > 0.98, 0, true, t);
    // Nehemiah and Tirza by the fire
    paintNehemiah(ctx, w * 0.56, yIn + S * 0.9, S, { flip: -1, step: 0, walking: 0, arm: 0.25, build: 0, night: false, t });
    paintTirza(ctx, w * 0.64, yIn + S * 0.95, S, { flip: -1, step: 0, walking: 0, arm: 0.3 + 0.2 * Math.sin(t * 1.3), night: true, talk: false, t });
    ctx.font = font(Math.max(12, S * 0.45), 700);
    ctx.fillStyle = 'rgba(255,240,210,.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(gateName(progress.gate), w / 2, Math.max(70, h * 0.12));
  }
}
