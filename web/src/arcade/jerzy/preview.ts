/**
 * Jerzy i smok's picture for the lobby's hero and the game card: the dragon breathes fire at the
 * knight, his shield of light swells and puts the flames out in puffs of steam, the sword glows, a
 * scale flies off; Linda cheers from the corner.  In the lobby (with progress) the dragon and the
 * arena are the player's current ones.  Drawn every frame, so it stays cheap: no state.
 */
import { clamp } from '../kit/juice';
import { dragonAt, type JerzyProgress } from './meta';
import { C, glow, hash, paintArena, paintDragon, paintFlame, paintKnight, paintLinda, paintSurround, type DragonPose, type KnightPose, type LindaPose } from './paint';

const kp: KnightPose = { flip: -1, step: 0, walking: 0, swing: 0, roll: 0, down: 0, hit: 0, charge: 0, ready: false, t: 0 };
const dp: DragonPose = { kind: 'zielony', flip: 1, r: 1, air: 0, jaw: 0, wings: 0.2, hit: 0, scales: 1, sleep: 0, daze: 0, heads: 3, t: 0 };
const lp: LindaPose = { flip: -1, step: 0, walking: 0, arm: 0, sit: 0, talk: false, t: 0 };

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: JerzyProgress): void {
  const spec = dragonAt(p ? p.dragon : 0).spec;
  paintSurround(ctx, w, h, spec.arena);
  const S = Math.max(10, Math.min(w / 9.2, h / 4.6));
  const aw = w / S - 0.4, ah = h / S - 0.4;
  const ox = (w - aw * S) / 2, oy = (h - ah * S) / 2;
  paintArena(ctx, spec.arena, ox, oy, aw, ah, S, t);
  const cy = oy + ah * S * 0.78;
  const dx = ox + aw * S * 0.27, kx = ox + aw * S * 0.7;
  // a breath every 2.6 s: the cone of flames toward the knight
  const cyc = (t % 2.6) / 2.6;
  const breathing = cyc > 0.25 && cyc < 0.7;
  const level = 0.5 + 0.45 * Math.sin(t * 0.9);
  const R = S * (0.35 + level * 1.3);
  const sx = kx - S * 0.45, sy = cy - S * 0.5;
  // the shield of light
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, sx, sy, R * 1.1, 'rgba(255,236,180,', 0.35 + 0.2 * level);
  ctx.restore();
  ctx.strokeStyle = level > 0.5 ? '#ffd36b' : 'rgba(255,250,232,.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = 'rgba(255,250,232,.6)';
  ctx.beginPath();
  ctx.arc(sx, sy, S * 1.0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  dp.kind = spec.kind;
  dp.t = t;
  dp.jaw = breathing ? 1 : 0.1;
  paintDragon(ctx, dx, cy - S * 0.2, S * 0.9, dp);
  if (breathing) {
    const mx = dx + S * 1.15, my = cy - S * 1.55;
    for (let i = 0; i < 9; i++) {
      const k = ((cyc - 0.25) / 0.45 * 3 + i / 9) % 1;
      const fx = mx + (sx - R * 0.8 - mx) * k, fy = my + (sy - my) * k + Math.sin(i * 1.7) * S * 0.3 * k;
      if (fx < sx - R) paintFlame(ctx, fx, fy, S * 0.16, t, i);
      else {
        ctx.fillStyle = `rgba(240,244,248,${0.6 * (1 - hash(i))})`;
        ctx.beginPath();
        ctx.arc(fx, fy - k * S * 0.3, S * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  kp.t = t;
  kp.charge = clamp((t % 6) / 6);
  kp.ready = kp.charge > 0.95;
  kp.swing = Math.max(0, 1 - ((t % 1.1) / 1.1) * 4);
  paintKnight(ctx, kx, cy, S, kp);
  lp.t = t;
  lp.arm = 0.6 + 0.4 * Math.sin(t * 3);
  paintLinda(ctx, ox + aw * S * 0.92, cy + S * 0.15, S * 0.9, lp);
  void C;
}
