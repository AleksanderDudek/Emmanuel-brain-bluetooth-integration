/**
 * Anioł Stróż's picture for the lobby's hero and the game card: the child asleep, the angel over
 * the bed striking left and right in turn, a Zmora on each side creeping in and bursting into motes
 * of light when the sweep reaches it, the aura breathing gold around the bed.  In the lobby (with
 * progress) the room has the player's cosy things.  Drawn every frame, so it stays cheap: no state.
 */
import { clamp, ease } from '../kit/juice';
import { rankOf, roomItems, type AniolProgress } from './meta';
import { C, glow, hash, paintAngel, paintBear, paintBed, paintLamp, paintRoom, paintRoomItem, paintStar, paintWindow, paintZmora, type AngelPose, type ZPose } from './paint';

const angel: AngelPose = { face: 1, swing: 0, beat: 0, open: 1, comfort: 0, sing: 0 };
const zp: ZPose = { kind: 'mara', r: 0.34, side: 1, emerge: 1, hit: 0, armoured: false, crack: 0, burn: 0, inAura: false, t: 0, id: 1, fade: 0 };

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: AniolProgress): void {
  const S = Math.max(14, Math.min(w / 9, h / 5.6));
  const cx = w / 2, floorY = h * 0.84;
  const items = p ? roomItems(rankOf(p.feathers)) : ['mobile', 'nightlight'];
  const win = { x: cx - S * 2.6, y: Math.max(4, floorY - S * 5.15), w: S * 5.2, h: S * 0.8 };
  paintRoom(ctx, { w, h, cx, floorY, s: S, win }, t, 0);
  paintWindow(ctx, win.x, win.y, win.w, win.h, t, 0, items.includes('curtain'));
  // a strip of stars on the sill, some gold
  for (let i = 0; i < 16; i++) paintStar(ctx, win.x + (i + 0.5) * (win.w / 16), win.y + win.h + S * 0.12, S * (0.05 + 0.04 * hash(i + Math.floor(t))), 0.9, hash(i * 3) > 0.5 ? '#ffd36b' : '#fff3c4');
  const lamp = paintLamp(ctx, cx + 1.55 * S, floorY, S, 1, items.includes('book'));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, lamp.x, lamp.y, S * 3, C.lampGlow, 0.3);
  // the aura breathing
  const level = 0.5 + 0.35 * Math.sin(t * 0.8);
  const R = S * (1.4 + level * 3);
  glow(ctx, cx, floorY, R, 'rgba(255,236,180,', 0.3);
  ctx.restore();
  ctx.strokeStyle = level > 0.5 ? '#ffd36b' : 'rgba(255,250,232,.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, floorY, R, R * 0.78, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = 'rgba(255,250,232,.6)';
  ctx.beginPath();
  ctx.ellipse(cx, floorY, S * 2.9, S * 2.9 * 0.78, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (items.includes('nightlight')) paintRoomItem(ctx, 'nightlight', cx - 2.9 * S, floorY - 1.15 * S, 0.22 * S, t);
  if (items.includes('mobile')) paintRoomItem(ctx, 'mobile', cx + 2.9 * S, floorY - 3.3 * S, 0.4 * S, t);
  paintBed(ctx, cx, floorY, S, t, 0, items.includes('blanket'));
  paintBear(ctx, cx + 0.68 * S, floorY - 0.86 * S, 0.27 * S, { talk: 0, cap: items.includes('nightcap'), look: -1, hide: 0, t });
  // a Zmora on each side: it creeps in, the sweep reaches it, it bursts into light
  const cycle = 2.4;
  for (const side of [-1, 1]) {
    const ph = ((t + (side > 0 ? 0 : cycle / 2)) % cycle) / cycle;
    const d = 4.6 - ph * 2.6;
    zp.side = side;
    zp.t = t;
    zp.id = side > 0 ? 3 : 7;
    zp.kind = side > 0 ? 'mara' : 'skoczek';
    zp.emerge = clamp(ph * 5);
    zp.fade = clamp((ph - 0.86) * 8);
    const x = cx + side * d * S;
    paintZmora(ctx, x, floorY, S * 1.2, zp);
    if (ph > 0.86) {
      const k = (ph - 0.86) / 0.14;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const a = hash(i * 7 + side) * Math.PI * 2;
        const rr = S * 0.9 * ease.outCubic(k) * (0.4 + hash(i));
        ctx.fillStyle = `rgba(255,244,214,${1 - k})`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rr, floorY - S * 0.4 + Math.sin(a) * rr - k * S * 0.5, S * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  // the angel turns to the side that comes next
  const ph = (t % 2.4) / 2.4;
  angel.face = ph < 0.5 ? 1 : -1;
  const strike = Math.max(clamp(1 - Math.abs(((t % 1.2) / 1.2) - 0.86) * 8), 0);
  angel.swing = strike;
  angel.beat = t * 2.5;
  paintAngel(ctx, cx, floorY - S * 2.35, S, angel);
}
