/**
 * Jerzy i smok's calibration intro: dawn over the land by the dragon's cave.  The knight and
 * Princess Linda wait at the field's edge, the dragon sleeps curled at the cave's mouth with his
 * chicks dozing in the grass, and while the reference fills (`p` 0..1) the knight's ring of light
 * grows and turns gold, and the last chick opens an eye.  The runner's calibration card covers the lower part of the
 * screen, so the scene sits high.
 */
import { approach, clamp } from '../kit/juice';
import { fightOf, type JerzyProgress } from './meta';
import { glow, paintArena, paintBrood, paintCave, paintDragon, paintKnight, paintLinda, paintSurround, type DragonPose, type KnightPose, type LindaPose } from './paint';

export class JerzyIntro {
  private clock = 0;
  private shown = 0;
  private readonly k: KnightPose = { flip: 1, step: 0, walking: 0, swing: 0, roll: 0, down: 0, hit: 0, charge: 0, ready: false, t: 0 };
  private readonly l: LindaPose = { flip: 1, step: 0, walking: 0, arm: 0, sit: 0, talk: false, t: 0 };
  private readonly d: DragonPose = { kind: 'zielony', flip: -1, r: 0.8, air: 0, jaw: 0, wings: 0, hit: 0, scales: 1, sleep: 1, daze: 0, heads: 3, t: 0 };

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: JerzyProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const spec = fightOf(progress).spec;
    paintSurround(ctx, w, h, spec.arena);
    const aw = 10, ah = 5;
    const S = Math.max(18, Math.min((w - 24) / aw, (h * 0.58) / (ah + 1)));
    const ox = (w - aw * S) / 2, oy = Math.max(12 + S, h * 0.08 + S);
    paintArena(ctx, spec.arena, ox, oy, aw, ah, S, t);
    // the dragon's chicks dozing in the grass, one waking up as the reference fills
    for (let i = 0; i < 4; i++) {
      const cx = ox + (3.2 + i * 1.6) * S, cy = oy + (1.2 + (i % 2) * 0.9) * S;
      paintBrood(ctx, cx, cy, S, { kind: 'piskle', land: spec.kind, r: 0.32, flip: i % 2 ? 1 : -1, t, hit: 0, elite: false, drowsy: i === 3 && k > 0.8 ? 0 : 1, spit: 0, seed: i });
    }
    paintCave(ctx, ox + 1.3 * S, oy - 0.3 * S, S, spec.arena);
    this.d.kind = spec.kind;
    this.d.t = t;
    paintDragon(ctx, ox + 1.4 * S, oy + 0.35 * S, S, this.d);
    // the morning light
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, ox + aw * S * 0.8, oy, S * 4, 'rgba(255,214,150,', 0.25 + 0.1 * k);
    ctx.restore();
    // the knight's buckler of light, growing with the calibration
    const kx = ox + 5.6 * S, ky = oy + 3.6 * S;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, kx - 0.4 * S, ky - 0.2 * S, S * (0.4 + 1.2 * k), 'rgba(255,236,180,', 0.45);
    ctx.restore();
    ctx.strokeStyle = k > 0.98 ? '#ffd36b' : 'rgba(255,250,232,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(kx - 0.4 * S, ky - 0.2 * S, S * (0.3 + 0.8 * k), 0, Math.PI * 2);
    ctx.stroke();
    this.k.flip = -1;
    this.k.t = t;
    this.k.charge = k * 0.4;
    paintKnight(ctx, kx, ky, S * 1.05, this.k);
    this.l.flip = -1;
    this.l.arm = 0.3 + 0.2 * Math.sin(t * 1.3);
    this.l.t = t;
    paintLinda(ctx, kx + 1.1 * S, ky + 0.1 * S, S, this.l);
  }
}
