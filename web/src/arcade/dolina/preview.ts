/**
 * Dolina's picture for the lobby's hero and the game card: the pilgrim running through the valley of
 * the shadow and double-jumping a wide pit — Ćma grabbing his hood and flapping, a puff of golden
 * dust — toward a numbered stone block and a stair rising to the next floor, the lamp's circle around
 * him with its threshold ring breathing gold, and the tide of the dark curling at the left edge.  In
 * the lobby (with progress) the run is in the era of the level the next run starts at, the pilgrim
 * wears his form and his party runs behind him with their power rings (on the card: Głaz).  Drawn
 * every frame, so it stays cheap: no state.
 */
import { clamp } from '../kit/juice';
import { MATE_H, paintChargeRing, paintMate } from './cast';
import { ERAS, eraOfLevel, type CompId } from './content';
import { lookOf, partyFor, type DolinaProgress } from './meta';
import { PAL, TAU, glow, paintFar, paintMid, paintMoth, paintPilgrim, paintSky } from './paint';
import { RULES } from './rules';
import { paintBlock, paintGround, paintRim, paintStep, paintTide } from './sprites';

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: DolinaProgress): void {
  const S = Math.max(14, Math.min(w / 11, h / 5.6));
  const floorY = h * 0.8;
  const era = p ? ERAS[eraOfLevel(p.level || 1)] : 'babel';
  const pal = PAL[era];
  const run = t * 5;
  paintSky(ctx, w, h, floorY, pal, t, 0, 0);
  paintFar(ctx, era, w, floorY - S * 0.1, S * 0.8, run * S * 0.15, t, pal, 1);
  paintMid(ctx, era, w, floorY, S, run * S * 0.5, t, pal, 0.8);
  // the ground with a wide pit, a stair and a ledge on the right
  const px = w * 0.3;
  const pit0 = px - S * 0.6, pit1 = px + S * 3.4;
  paintGround(ctx, -10, pit0, floorY, h, S, pal, 'road', -run * S);
  paintGround(ctx, pit1, w + 10, floorY, h, S, pal, 'road', -run * S);
  paintRim(ctx, pit0, floorY, S, 1);
  paintRim(ctx, pit1, floorY, S, -1);
  const wallX = pit1 + S * 4.6;
  if (wallX < w + S) {
    for (let i = 0; i < 4; i++) paintStep(ctx, wallX - (4 - i) * S * 0.5, wallX, floorY - (i + 1) * S * RULES.stepH, floorY, S, era, 1);
    paintGround(ctx, wallX, w + 10, floorY - S * 3.2, h, S, pal, 'ledge', -run * S);
  }
  paintBlock(ctx, pit1 + S * 1.4, floorY, S * 0.95, S * 0.95, S, { era, hp: 6, max: 9, tall: false, lit: true, hit: 0, t, id: 3 });
  // the double jump: up, Ćma flaps, over the pit, down
  const cycle = 2.2;
  const ph = (t % cycle) / cycle;
  const air = ph > 0.12 && ph < 0.78;
  const k = clamp((ph - 0.12) / 0.66);
  const jy = air ? Math.sin(k * Math.PI) * 2.6 + (k > 0.35 ? 0.4 * Math.sin((k - 0.35) / 0.65 * Math.PI) : 0) : 0;
  const pyy = floorY - jy * S;
  const level = 0.5 + 0.35 * Math.sin(t * 0.8);
  const lx = px + S * 0.45, ly = pyy - S * 0.7;
  const R = S * (RULES.lampMin + level * RULES.lampExtra) * 0.62;
  const g = ctx.createRadialGradient(lx, ly, R * 0.55, lx, ly, R * 1.2);
  g.addColorStop(0, 'rgba(14,10,20,0)');
  g.addColorStop(1, 'rgba(14,10,20,.66)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, lx, ly, R, 'rgba(255,190,110,', 0.22);
  ctx.restore();
  ctx.strokeStyle = level > 0.5 ? '#ffd36b' : 'rgba(255,236,190,.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lx, ly, R, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = 'rgba(255,246,220,.6)';
  ctx.beginPath();
  ctx.arc(lx, ly, S * (RULES.lampMin + 0.5 * RULES.lampExtra) * 0.62, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  paintTide(ctx, S * (0.25 + 0.15 * Math.sin(t * 0.9)), h * 0.35, h, S * 0.5, t, 0.4);
  // the party running behind him (the card shows Głaz, the first one found)
  const party: CompId[] = p ? partyFor(p) : ['glaz'];
  party.forEach((id, i) => {
    const mx = px - S * (1.05 + i * 0.85);
    if (mx < -S) return;
    const hop = Math.abs(Math.sin(t * 9 + i)) * S * 0.05;
    paintMate(ctx, id, mx, floorY - hop, S * 0.95, { run: t * 11 + i * 1.3, t: t + i, act: 0, gold: level > 0.5, air: false, sleep: false });
    paintChargeRing(ctx, mx, floorY - S * (MATE_H[id] * 0.95 + 0.3), Math.max(3, S * 0.12), (t * 0.25 + i * 0.37) % 1, level > 0.5, t);
  });
  const lamp = paintPilgrim(ctx, px, pyy, S, { look: p ? lookOf(p.sparksAll) : 0, run: t * 11, pace: air ? 0.3 : 1, air, slide: 0, fall: 0, slash: -1, lampUp: 0.4, flicker: 0 });
  const flap = air && k > 0.3 && k < 0.6;
  if (flap) {
    ctx.fillStyle = 'rgba(243,220,160,.7)';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI + Math.PI * 0.05;
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * S * 0.6 * (k - 0.25) * 3, pyy + Math.sin(a) * S * 0.3, S * 0.05, 0, TAU);
      ctx.fill();
    }
  }
  const mx = flap ? px : lamp.x + S * (0.5 + 0.3 * Math.sin(t * 1.7));
  const my = flap ? pyy - S * 1.35 : lamp.y - S * (0.7 + 0.2 * Math.cos(t * 2.3));
  paintMoth(ctx, mx, my, S * 0.3, t * (flap ? 2.5 : 1), flap ? 'wow' : 'happy');
}
