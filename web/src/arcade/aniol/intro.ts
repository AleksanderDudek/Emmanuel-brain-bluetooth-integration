/**
 * Anioł Stróż's calibration intro: bedtime.  The child is asleep under the patchwork quilt, the lamp
 * glows, the moon is in the window.  While the reference fills (`p` 0..1) a small light comes in
 * through the window and grows, over the bed, into the angel sent to keep the child's sleep; the
 * stars on the sill light one by one.  The runner's calibration card covers the lower part of the
 * screen, so the room sits high.
 */
import { approach, clamp, ease } from '../kit/juice';
import type { AniolProgress } from './meta';
import { roomItems } from './meta';
import { C, glow, paintAngel, paintBed, paintFeather, paintLamp, paintRoom, paintRoomItem, paintSill, paintStar, paintWindow, type AngelPose } from './paint';
import { rankOf } from './meta';

export class AniolIntro {
  private clock = 0;
  private shown = 0;
  private readonly pose: AngelPose = { face: 1, swing: 0, beat: 0, open: 1, comfort: 0, sing: 1 };

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: AniolProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const S = Math.max(26, Math.min(w / 10.4, h / 7.2));
    const cx = w / 2, floorY = h * 0.6;
    const win = { x: cx - Math.min(w * 0.4, S * 3.4), y: Math.max(16, floorY - S * 5.2), w: Math.min(w * 0.8, S * 6.8), h: S * 1.2 };
    paintRoom(ctx, { w, h, cx, floorY, s: S, win }, t, 0);
    const items = roomItems(rankOf(progress.feathers));
    paintWindow(ctx, win.x, win.y, win.w, win.h, t, 0, items.includes('curtain'));
    paintSill(ctx, win.x, win.y + win.h + 3, win.w, S * 0.28);
    // the sill's stars light one by one with the calibration
    const n = 20;
    for (let i = 0; i < n; i++) {
      const on = clamp((k * n - i) * 1.5);
      if (on <= 0) continue;
      paintStar(ctx, win.x + (i + 0.5) * (win.w / n), win.y + win.h + 3 + S * 0.14, S * 0.09 * (0.6 + 0.4 * on), on, i % 3 === 0 ? '#ffd36b' : '#fff3c4');
    }
    if (items.includes('nightlight')) paintRoomItem(ctx, 'nightlight', cx - 2.9 * S, floorY - 1.15 * S, 0.22 * S, t);
    const lamp = paintLamp(ctx, cx + 1.55 * S, floorY, S, 1, items.includes('book'));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, lamp.x, lamp.y, S * 3.2, C.lampGlow, 0.34);
    ctx.restore();
    paintBed(ctx, cx, floorY, S, t, 0, items.includes('blanket'));
    if (items.includes('bear')) paintRoomItem(ctx, 'bear', cx - 1.45 * S, floorY - 0.24 * S, 0.3 * S);
    // the light from the window, becoming the angel over the bed
    const travel = ease.inOutSine(clamp(k / 0.7));
    const sx = win.x + win.w * 0.78, sy = win.y + win.h * 0.4;
    const ax = sx + (cx - sx) * travel, ay = sy + (floorY - S * 2.4 - sy) * travel;
    const form = clamp((k - 0.55) / 0.45);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, ax, ay, S * (0.6 + 1.4 * form), C.light, 0.5 + 0.3 * Math.sin(t * 3));
    ctx.restore();
    if (form > 0) {
      ctx.globalAlpha = ease.outCubic(form);
      this.pose.beat = t * 2;
      this.pose.open = 0.4 + 0.6 * form;
      paintAngel(ctx, ax, ay, S * 1.05 * (0.6 + 0.4 * form), this.pose);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(ax, ay, S * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    // a few feathers drifting down as it arrives
    for (let i = 0; i < 5; i++) {
      const f = (t * 0.25 + i / 5) % 1;
      if (k < 0.6) continue;
      paintFeather(ctx, cx + Math.sin(i * 2.1 + t) * S * 1.6, floorY - S * 3.2 + f * S * 2.4, S * 0.12, Math.sin(t + i), (1 - f) * clamp((k - 0.6) * 3));
    }
  }
}
