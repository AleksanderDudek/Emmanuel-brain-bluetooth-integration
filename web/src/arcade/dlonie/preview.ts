/**
 * The lobby's hero picture and the card art (and the calibration scene, intro.ts): the two hands in the umber night
 * holding a ball of golden-white light, threads of light between the fingertips, a thin ribbon of incense rising to
 * the soft light above.  No names (the card may be seen by others); with the player's progress, the light above holds
 * as many small flames as prayers offered (up to seven).
 */
import { drawHand, tipsOf, type HandPose } from './hands';
import type { DlonieProgress } from './meta';
import { BALL, GOLD, NIGHT, TAU, glow, incense, rgba } from './paint';

/**
 * The picture at a moment `t` (s): `grow` 0..1 the ball (0: a spark), `warm` the rub's glow, `flames` small flames in
 * the light above.  Fits any box; the hands as large as the box allows.
 */
export function drawPicture(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, o: { grow?: number; warm?: number; flames?: number; still?: boolean; size?: number } = {}): void {
  const grow = o.grow ?? 0.85;
  const still = o.still === true;
  ctx.save();
  const g = ctx.createRadialGradient(w / 2, h * 0.58, 0, w / 2, h * 0.58, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, NIGHT[2]);
  g.addColorStop(0.5, NIGHT[1]);
  g.addColorStop(1, NIGHT[0]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const L = Math.min(h / 2.5, w / 3.7) * (o.size ?? 1);
  const cx = w / 2, wristY = Math.min(h - 4, h * 0.6 + 1.25 * L);
  const ballY = wristY - 0.66 * L;
  const breath = still ? 0.5 : 0.5 + 0.5 * Math.sin((t * TAU) / 10);
  const R = 0.42 * L * (0.08 + 0.92 * grow);
  const off = Math.max(0.9 * L, R + 0.6 * L) + (breath - 0.5) * 0.12 * L;
  const left: HandPose = { x: cx - off, y: wristY, L, tilt: 0.08, side: 1 };
  const right: HandPose = { x: cx + off, y: wristY, L, tilt: 0.08, side: -1 };
  // the soft light above and the incense
  ctx.globalCompositeOperation = 'lighter';
  const ly = Math.max(14, h * 0.12);
  glow(ctx, '#fff1d6', cx, ly, Math.min(w, h) * 0.45, 0.16);
  incense(ctx, cx, ballY - R, ly + 10, t, Math.max(6, L * 0.32), 0.9, still);
  const n = Math.min(7, o.flames ?? 0);
  for (let i = 0; i < n; i++) {
    const a = t * 0.22 + (i / Math.max(1, n)) * TAU;
    const fx = cx + Math.cos(a) * w * 0.16, fy = ly + Math.sin(a) * w * 0.04;
    glow(ctx, GOLD, fx, fy, Math.max(4, L * 0.1), 0.5);
  }
  ctx.globalCompositeOperation = 'source-over';
  const light = { x: cx, y: ballY, r: Math.max(R, L * 0.15), a: 0.4 + 0.6 * grow, color: '#ffd27a' };
  drawHand(ctx, left, light, o.warm ?? 0);
  drawHand(ctx, right, light, o.warm ?? 0);
  // threads between the fingertips
  const lt = tipsOf(left), rt = tipsOf(right);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < Math.min(4, lt.length); i++) {
    ctx.strokeStyle = rgba('#ffe9c4', 0.12 + 0.08 * Math.sin(t * 2 + i));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lt[i].x, lt[i].y);
    ctx.quadraticCurveTo((lt[i].x + rt[i].x) / 2, (lt[i].y + rt[i].y) / 2 + L * 0.08, rt[i].x, rt[i].y);
    ctx.stroke();
  }
  // the ball
  const pulse = still ? 1 : 1 + 0.03 * Math.sin(t * 2.1);
  const r = Math.max(2, R * pulse);
  glow(ctx, '#ffd27a', cx, ballY, r * 2.8, 0.5);
  glow(ctx, '#fff6e0', cx, ballY, r * 1.5, 0.55);
  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createRadialGradient(cx - r * 0.25, ballY - r * 0.3, 0, cx, ballY, r);
  body.addColorStop(0, BALL[0]);
  body.addColorStop(0.4, rgba(BALL[1], 0.95));
  body.addColorStop(0.78, rgba(BALL[2], 0.85));
  body.addColorStop(1, rgba(BALL[3], 0));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, ballY, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: DlonieProgress): void {
  const offered = p ? p.offered.others + p.offered.world : 0;
  drawPicture(ctx, w, h, t, { grow: 0.55 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.4)), flames: offered });
}
