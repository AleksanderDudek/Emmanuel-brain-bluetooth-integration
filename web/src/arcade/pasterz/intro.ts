/**
 * Pasterz's calibration intro: the last hour of the night watch at the fold.  The flock sleeps
 * inside the dry-stone fold, the shepherd keeps the gate beside a small fire, the stars are out.
 * While the reference fills (`p` 0..1) the night pales into morning, the stars go out one by one,
 * the fire burns down and the sheep lift their heads.  The runner's calibration card covers the
 * lower part of the screen, so the fold sits high and its gate faces right.
 */
import { approach, clamp, ease } from '../kit/juice';
import type { PasterzProgress } from './meta';
import { C, hash, paintFire, paintFold, paintSheep, paintShepherd, paintStar, type SheepPose } from './paint';

export class PasterzIntro {
  private clock = 0;
  private shown = 0;
  private readonly pose: SheepPose = { small: false, bob: 0, walking: 0, lie: 1, look: 0, graze: 0 };

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: PasterzProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const tall = h > w;
    const S = Math.max(22, Math.min(w, h) / (tall ? 11 : 13));
    // the hillside
    const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, '#b7bf78');
    g.addColorStop(1, '#8e9c52');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = hash(i * 7 + 1) * w, y = hash(i * 13 + 2) * h;
      ctx.strokeStyle = i % 3 ? 'rgba(96,112,52,.6)' : 'rgba(210,214,150,.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y - S * 0.18);
      ctx.moveTo(x + 3, y);
      ctx.lineTo(x + 4, y - S * 0.2);
      ctx.stroke();
    }
    // the fold, high on the screen, its gate to the right
    const fx = w * 0.5, fy = h * (tall ? 0.3 : 0.36);
    const gate = -0.2;
    paintFold(ctx, fx, fy, S, gate, 1);
    const pose = this.pose;
    const wake = clamp((k - 0.75) / 0.25);
    pose.lie = 1 - 0.5 * wake;
    pose.look = wake;
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996, r = 2.1 * Math.sqrt((i + 0.5) / 9);
      pose.small = i % 4 === 3;
      pose.bob = t + i;
      paintSheep(ctx, fx + Math.cos(a) * r * S, fy + Math.sin(a) * r * S * 0.9, S, a + 1.3 + Math.sin(t * 0.4 + i) * 0.05 * wake, pose);
    }
    // the shepherd at the gate, the fire beside him
    const gx = fx + Math.cos(gate) * 3.9 * S, gy = fy + Math.sin(gate) * 3.9 * S;
    paintShepherd(ctx, gx, gy, S * 1.05, gate + Math.PI + 0.3, 0, 0, false);
    const fireX = gx + 0.6 * S, fireY = gy - 1.5 * S;
    paintFire(ctx, fireX, fireY, S, t, 1 - 0.7 * k);
    // the night lifting
    const night = 1 - ease.inOutSine(k);
    ctx.fillStyle = `rgba(18,26,58,${0.72 * night})`;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(fireX, fireY, 0, fireX, fireY, 5 * S);
    rg.addColorStop(0, `rgba(255,170,80,${0.45 * (0.3 + 0.7 * night)})`);
    rg.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(fireX - 5 * S, fireY - 5 * S, 10 * S, 10 * S);
    ctx.restore();
    paintFire(ctx, fireX, fireY, S, t, 1 - 0.7 * k);
    // the stars going out one by one
    for (let i = 0; i < 12; i++) {
      const out = clamp((k - i / 13) * 6);
      if (out >= 1) continue;
      paintStar(ctx, 20 + hash(i * 3 + 5) * (w - 40), 20 + hash(i * 11 + 3) * h * 0.55, 4 + hash(i) * 3, (1 - out) * (0.8 + 0.2 * Math.sin(t * 2 + i)));
    }
    // the morning's first light from the east
    if (k > 0.55) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const m = ctx.createRadialGradient(w, 0, 0, w, 0, Math.max(w, h) * 0.9);
      m.addColorStop(0, `rgba(255,214,150,${(k - 0.55) * 0.5})`);
      m.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = m;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    void progress;
    void C;
  }
}
