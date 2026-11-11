/**
 * Dawid's calibration intro: evening on the hills of the land now.  David sits by the camp's fire with
 * his harp, the lamb dozes beside him, the flock lies in the fold, and while the reference fills (`p`
 * 0..1) the sling's ring at his feet fills and turns gold at its notch; far off on the ridge the
 * guardian of the land's gate is a dark shape.  The runner's calibration card covers the lower part of
 * the screen, so the scene sits high.
 */
import { approach, clamp } from '../kit/juice';
import { landAt, type DawidProgress } from './meta';
import { C, GROUND, LOOKS, ellipse, glow, paintBeast, paintDeco, paintFire, paintGiant, paintLamb, paintPerson, paintSheep, paintTent } from './paint';

export class DawidIntro {
  private clock = 0;
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: DawidProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const { spec } = landAt(progress.land);
    const g = GROUND[spec.ground];
    // the evening sky and the hills
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    sky.addColorStop(0, '#3a3a6a');
    sky.addColorStop(0.6, '#c9765a');
    sky.addColorStop(1, '#f2c27a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a6a52';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.42);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * 0.42 - Math.sin(x / 140) * h * 0.04 - Math.sin(x / 61) * h * 0.015);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
    const ground = ctx.createLinearGradient(0, h * 0.42, 0, h);
    ground.addColorStop(0, g.a);
    ground.addColorStop(1, g.b);
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.48);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * 0.48 - Math.sin(x / 90 + 1) * h * 0.02);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
    const S = Math.max(18, Math.min(w / 13, h / 9));
    // the guardian far off on the ridge, a dark shape
    ctx.save();
    ctx.globalAlpha = 0.55;
    const gx = w * 0.82, gy = h * 0.43;
    if (spec.guard === 'goliat' || spec.guard === 'olbrzym') paintGiant(ctx, gx, gy, S * 0.35, { flip: -1, step: 0, moving: 0, act: 0, hit: 0, fall: 0, t, daze: 0, hue: 1 });
    else paintBeast(ctx, spec.guard, gx, gy, S * 0.45, { flip: -1, step: t, moving: 0, hit: 0, doze: 0, t, air: 0, tele: 0, flee: 0, seed: 1, hidden: false });
    ctx.restore();
    paintDeco(ctx, { kind: 'olive', x: 0, y: 0, r: 1.2, seed: 4 }, w * 0.16, h * 0.5, S, t);
    paintDeco(ctx, { kind: 'terebinth', x: 0, y: 0, r: 1.3, seed: 9 }, w * 0.88, h * 0.53, S, t);
    paintTent(ctx, w * 0.3, h * 0.52, S * 1.1, 0);
    for (let i = 0; i < 4; i++) paintSheep(ctx, w * (0.58 + i * 0.06), h * (0.53 + (i % 2) * 0.02), S, t + i);
    // the fire, David with his harp, the lamb
    const cx = w * 0.46, cy = h * 0.62;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, cx + S * 1.1, cy - S * 0.4, S * 4, 'rgba(255,150,70,', 0.25);
    ctx.restore();
    // the sling's ring fills with the calibration and turns gold at its notch
    const R = S * 1.3, a0 = Math.PI + 0.4, span = Math.PI + 0.8;
    const arc = (from: number, to: number) => { ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.55, 0, a0 - from * span, a0 - to * span, true); };
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, S * 0.1);
    ctx.strokeStyle = 'rgba(255,250,232,.35)';
    arc(0, 1);
    ctx.stroke();
    ctx.strokeStyle = '#fff3d6';
    arc(0, Math.min(0.5, k));
    ctx.stroke();
    if (k > 0.5) {
      ctx.strokeStyle = C.gold;
      arc(0.5, k);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,250,232,.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + R * 0.55 - S * 0.15);
    ctx.lineTo(cx, cy + R * 0.55 + S * 0.2);
    ctx.stroke();
    paintFire(ctx, cx + S * 1.1, cy + S * 0.1, S, t);
    paintPerson(ctx, cx, cy, S, { ...LOOKS.david, item: 'harp' }, { flip: 1, step: 0, walking: 0, sit: 1, act: 0, hit: 0, t });
    paintLamb(ctx, cx - S * 0.9, cy + S * 0.15, S, { flip: 1, step: 0, walking: 0, sleep: k > 0.95 ? 0 : 1, talk: false, t });
    // stars come out
    ctx.fillStyle = 'rgba(255,250,232,.8)';
    for (let i = 0; i < 18; i++) {
      const x = ((i * 97) % 100) / 100 * w, y = ((i * 53) % 37) / 100 * h;
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + i));
      ellipse(ctx, x, y, 1.3, 1.3, '#fffaf0');
    }
    ctx.globalAlpha = 1;
  }
}
