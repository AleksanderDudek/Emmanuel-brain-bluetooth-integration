/**
 * Firmament's calibration intro: a hill at night, Bubo the owl beside his brass telescope.  While
 * the reference fills (`p` 0..1) the player's constellation comes out star by star, its lines are
 * drawn between them, and the lens catches the light.  The runner's calibration card covers the
 * lower part of the screen, so the sky's figure sits high.
 */
import { approach, clamp, ease } from '../kit/juice';
import { drawFigure } from './hud';
import { migrate, type FirmamentProgress } from './meta';
import { C, hash, paintOwl, paintSkyLayer } from './paint';
import { RULES } from './rules';

const TAU = Math.PI * 2;

export class FirmamentIntro {
  private clock = 0;
  private shown = 0;
  private sky: HTMLCanvasElement | null = null;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: FirmamentProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    if (typeof document !== 'undefined' && (!this.sky || this.sky.width !== Math.round(w) || this.sky.height !== Math.round(h))) {
      const c = document.createElement('canvas');
      c.width = Math.round(w);
      c.height = Math.round(h);
      const sctx = c.getContext('2d');
      if (sctx) paintSkyLayer(sctx, w, h, 5);
      this.sky = c;
    }
    if (this.sky) ctx.drawImage(this.sky, 0, 0, w, h);
    const pr = migrate(progress);
    const c = Math.floor(pr.level / RULES.perConst);
    const tall = h > w;
    const bw = Math.min(w * (tall ? 0.8 : 0.5), 520), bh = Math.min(h * 0.34, 280);
    drawFigure(ctx, c, { x: (w - bw) / 2, y: h * (tall ? 0.12 : 0.1), w: bw, h: bh }, Math.round(k * RULES.perConst), t, Math.min(RULES.perConst - 1, Math.floor(k * RULES.perConst)), ease.outCubic(clamp((k * RULES.perConst) % 1)));
    // the hill
    const hy = h * (tall ? 0.62 : 0.66);
    ctx.fillStyle = '#04050f';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, hy + 30);
    ctx.quadraticCurveTo(w * 0.3, hy - 30, w * 0.55, hy + 6);
    ctx.quadraticCurveTo(w * 0.8, hy + 30, w, hy - 10);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // the telescope on its tripod
    const tx = w * 0.42, ty = hy - 10, s = Math.min(w, h) / 9;
    ctx.strokeStyle = '#2a2433';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, ty); ctx.lineTo(tx - s * 0.5, ty + s * 0.9);
    ctx.moveTo(tx, ty); ctx.lineTo(tx + s * 0.5, ty + s * 0.9);
    ctx.moveTo(tx, ty); ctx.lineTo(tx, ty + s);
    ctx.stroke();
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(-0.75);
    const tg = ctx.createLinearGradient(0, -s * 0.18, 0, s * 0.18);
    tg.addColorStop(0, '#6d5427');
    tg.addColorStop(0.5, '#d9ab58');
    tg.addColorStop(1, '#5a4320');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.12);
    ctx.lineTo(s * 1.3, -s * 0.2);
    ctx.lineTo(s * 1.3, s * 0.2);
    ctx.lineTo(-s * 0.6, s * 0.12);
    ctx.closePath();
    ctx.fill();
    const glow = 0.3 + 0.7 * k;
    const lg = ctx.createRadialGradient(s * 1.32, 0, 0, s * 1.32, 0, s * 0.5);
    lg.addColorStop(0, `rgba(255,236,170,${0.9 * glow})`);
    lg.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(s * 1.32, 0, s * 0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Bubo at the eyepiece
    paintOwl(ctx, tx - s * 0.95, hy - s * 0.25, s * 0.42, { t, look: 0.7, hop: Math.abs(Math.sin(t * 2)) * 0.15 });
    for (let i = 0; i < 20; i++) {
      const x = hash(i * 9 + 1) * w, y = hash(i * 5 + 2) * hy * 0.9;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(255,250,235,${0.3 + 0.5 * tw})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + tw, 0, TAU);
      ctx.fill();
    }
    void C;
  }
}
