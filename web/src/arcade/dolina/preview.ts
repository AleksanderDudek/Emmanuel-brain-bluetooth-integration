/**
 * Dolina's picture for the lobby's hero and the game card: the pilgrim running through the valley
 * of the shadow with his lamp held out, the era's silhouettes drifting past, a shadow coming out of
 * the dark and bursting into motes of light as the sword's arc meets it, the light's rim breathing
 * gold around the lamp, Ćma at the flame.  In the lobby (with progress) the run is in the era the
 * next run starts in, and the pilgrim wears his look.  Drawn every frame, so it stays cheap: no state.
 */
import { clamp, ease } from '../kit/juice';
import { ERAS } from './content';
import { lookOf, startEraOf, type DolinaProgress } from './meta';
import { PAL, TAU, glow, hash, paintFar, paintMid, paintMoth, paintPilgrim, paintRoad, paintShadow, paintSky } from './paint';

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: DolinaProgress): void {
  const S = Math.max(14, Math.min(w / 10, h / 5.2));
  const floorY = h * 0.8;
  const era = p ? ERAS[startEraOf(p)] : 'babel';
  const pal = PAL[era];
  const run = t * 5;
  paintSky(ctx, w, h, floorY, pal, t, 0, 0);
  paintFar(ctx, era, w, floorY - S * 0.1, S * 0.8, run * S * 0.15, t, pal, 1);
  paintMid(ctx, era, w, floorY, S, run * S * 0.5, t, pal, 0.9);
  paintRoad(ctx, w, h, floorY, S, run * S, pal, 0, t);
  const px = w * 0.3;
  // a shadow comes, the arc meets it, it bursts into light
  const cycle = 1.8;
  const ph = (t % cycle) / cycle;
  const sx = px + S * (6 - ph * 5.2);
  const level = 0.5 + 0.35 * Math.sin(t * 0.8);
  const lx = px + S * 0.5, ly = floorY - S * 0.7;
  const R = S * (1.9 + level * 4.6) * 0.75;
  // the dark and the light
  const g = ctx.createRadialGradient(lx, ly, R * 0.55, lx, ly, R * 1.2);
  g.addColorStop(0, 'rgba(14,10,20,0)');
  g.addColorStop(1, 'rgba(14,10,20,.7)');
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
  ctx.arc(lx, ly, S * 4.2 * 0.75, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  const fade = clamp((ph - 0.82) * 6);
  paintShadow(ctx, sx, floorY, S, {
    kind: era === 'babel' ? 'glinianek' : era === 'twierdza' ? 'giermek' : 'przewijacz', t, id: 3, hit: ph > 0.82 && ph < 0.86 ? 0.1 : 0, stun: 0,
    inLight: sx - px < R, shield: false, crack: 0, dive: 0, fade, pop: 1,
  });
  if (ph > 0.82) {
    const k = (ph - 0.82) / 0.18;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const a = hash(i * 7) * TAU, rr = S * 0.9 * ease.outCubic(k) * (0.4 + hash(i));
      ctx.fillStyle = `rgba(255,244,214,${1 - k})`;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * rr, floorY - S * 0.5 + Math.sin(a) * rr - k * S * 0.6, S * 0.05, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  const slash = ph > 0.74 && ph < 0.9 ? (ph - 0.74) / 0.16 : -1;
  const lamp = paintPilgrim(ctx, px, floorY, S, { look: p ? lookOf(p.sparksAll) : 0, run: t * 11, pace: 1, air: false, slide: 0, fall: 0, slash, lampUp: 0, flicker: 0 });
  if (slash >= 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,244,214,${0.9 * (1 - slash)})`;
    ctx.lineWidth = S * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(px + S * 0.1, floorY - S * 0.75, S * 1.4, -1.5 + slash * 0.6, -1.5 + slash * 0.6 + 1.8 * ease.outCubic(Math.min(1, slash * 2.2)));
    ctx.stroke();
    ctx.restore();
  }
  paintMoth(ctx, lamp.x + S * (0.5 + 0.3 * Math.sin(t * 1.7)), lamp.y - S * (0.7 + 0.2 * Math.cos(t * 2.3)), S * 0.3, t);
}
