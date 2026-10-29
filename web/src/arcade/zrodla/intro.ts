/**
 * Źródła's calibration intro: pre-dawn on the road, seen from above like the game.  The player's road
 * winds across the contour lines with the valleys they watered as green oases (a short generic road
 * for a new player), and by it the camp: a tent, a fire with pilgrims sitting around it.  While the
 * reference fills (`p` 0..1) the blue-violet wash lifts, the fire dims to embers and the first spring
 * in the rock above the camp trickles: its thread of water runs down a carved channel in step with
 * `p`, and at 1 it reaches a small pool, which ripples.  The runner's calibration card covers the
 * lower part of the screen, so the camp stands in the upper half on a phone, right of centre when wide.
 */
import { clamp } from '../kit/juice';
import type { ZrodlaProgress } from './meta';
import { C, paintPilgrim, rgba } from './paint';
import { paintRoad } from './preview';

const TAU = Math.PI * 2;

export class CampIntro {
  private clock = 0;
  private reached = 0;
  /** the pool's first ripple (s since the water reached it; −1: not yet) */
  private ripple = -1;
  /** the channel from the spring down to the pool, as points (made per size) */
  private path: { w: number; h: number; pts: Float32Array; len: number } | null = null;

  /** One frame in CSS pixels (the caller set the transform). */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: ZrodlaProgress, dpr: number, reduced: boolean): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    const t = this.clock;
    paintRoad(ctx, w, h, t, progress, 'intro', dpr, false);
    const portrait = h > w;
    const cx = portrait ? w * 0.56 : w * 0.72, cy = portrait ? h * 0.3 : h * 0.4;
    const u = Math.min(w, h) / 430;
    // the spring's channel down to the pool by the camp
    const path = this.channel(w, h, cx, cy, u);
    const pts = path.pts, n = pts.length / 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(120,96,64,.55)';
    ctx.lineWidth = 7 * u;
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();
    // the rock and the spring's mouth
    const sx = pts[0], sy = pts[1];
    ctx.fillStyle = C.rose;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 6 * u, 26 * u, 16 * u, -0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(110,62,48,.35)';
    ctx.beginPath();
    ctx.ellipse(sx + 6 * u, sy - 2 * u, 22 * u, 10 * u, -0.2, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#123540';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8 * u, 5 * u, 0, 0, TAU);
    ctx.fill();
    // the water's thread, as far as the reference has come
    const k = clamp(p);
    this.reached = Math.max(this.reached, k);
    if (this.reached > 0.002) {
      ctx.strokeStyle = C.water;
      ctx.lineWidth = 3.6 * u;
      ctx.setLineDash([path.len * this.reached, path.len * 2]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[i * 2], pts[i * 2 + 1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // the pool at the channel's end: it fills when the water arrives
    const px = pts[(n - 1) * 2], py = pts[(n - 1) * 2 + 1];
    ctx.fillStyle = '#cdae7c';
    ctx.beginPath();
    ctx.ellipse(px, py, 15 * u, 9 * u, 0, 0, TAU);
    ctx.fill();
    if (this.reached >= 0.999) {
      if (this.ripple < 0) this.ripple = 0;
      this.ripple += dt;
      ctx.fillStyle = C.water;
      ctx.beginPath();
      ctx.ellipse(px, py, 12 * u * clamp(this.ripple * 2), 7 * u * clamp(this.ripple * 2), 0, 0, TAU);
      ctx.fill();
      if (!reduced) {
        const q = (this.ripple * 0.6) % 1;
        ctx.strokeStyle = rgba(C.foam, 0.9 * (1 - q));
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(px, py, 6 * u + 16 * u * q, 4 * u + 9 * u * q, 0, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
    this.camp(ctx, cx, cy, u, t, k, reduced);
    // the pre-dawn wash lifts as the reference fills
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = rgba(C.predawn, 0.62 * (1 - k) + 0.12);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = `rgba(16,14,32,${(0.38 * (1 - k)).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
    // the fire's light, over the wash, so it glows in the dark
    const fire = 1 - 0.75 * k;
    const flick = reduced ? 1 : 0.88 + 0.12 * Math.sin(t * 11) * Math.sin(t * 7.3);
    const gr = 80 * u * fire * flick;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
    g.addColorStop(0, rgba(C.fire, 0.55 * fire));
    g.addColorStop(1, rgba(C.fire, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, gr, 0, TAU);
    ctx.fill();
    ctx.restore();
    // the dawn coming up behind the hills
    const dawn = ctx.createLinearGradient(w, 0, w * 0.4, h * 0.6);
    dawn.addColorStop(0, rgba(C.morning, 0.35 * k));
    dawn.addColorStop(1, rgba(C.morning, 0));
    ctx.fillStyle = dawn;
    ctx.fillRect(0, 0, w, h);
  }

  /** The channel's points from the spring in the rock to the pool beside the camp. */
  private channel(w: number, h: number, cx: number, cy: number, u: number): { pts: Float32Array; len: number; w: number; h: number } {
    if (this.path && this.path.w === w && this.path.h === h) return this.path;
    const sx = cx + 70 * u, sy = cy - 92 * u, ex = cx - 46 * u, ey = cy + 18 * u;
    const n = 24, pts = new Float32Array(n * 2);
    let len = 0;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      pts[i * 2] = sx + (ex - sx) * k + Math.sin(k * Math.PI * 2.2) * 22 * u;
      pts[i * 2 + 1] = sy + (ey - sy) * k;
      if (i) len += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    }
    this.path = { w, h, pts, len };
    return this.path;
  }

  /** The tent, the fire and four pilgrims sitting around it. */
  private camp(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, t: number, k: number, reduced: boolean): void {
    // the tent, seen from above: two cloth slopes and a ridge
    const tx = cx + 34 * u, ty = cy - 20 * u;
    ctx.fillStyle = 'rgba(60,40,30,.25)';
    ctx.beginPath();
    ctx.moveTo(tx - 20 * u, ty + 16 * u);
    ctx.lineTo(tx + 26 * u, ty + 18 * u);
    ctx.lineTo(tx + 24 * u, ty - 8 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b9a07c';
    ctx.beginPath();
    ctx.moveTo(tx - 22 * u, ty + 12 * u);
    ctx.lineTo(tx + 18 * u, ty + 12 * u);
    ctx.lineTo(tx + 18 * u, ty - 12 * u);
    ctx.lineTo(tx - 22 * u, ty - 12 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9b825e';
    ctx.fillRect(tx - 22 * u, ty, 40 * u, 12 * u);
    ctx.strokeStyle = '#6f5a3c';
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.moveTo(tx - 24 * u, ty);
    ctx.lineTo(tx + 20 * u, ty);
    ctx.stroke();
    // the fire: a ring of stones, logs, flames dimming to embers
    ctx.fillStyle = '#8f8576';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 9 * u, cy + Math.sin(a) * 7 * u, 2.4 * u, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#5a3f2a';
    ctx.lineWidth = 2.4 * u;
    ctx.beginPath();
    ctx.moveTo(cx - 6 * u, cy - 3 * u);
    ctx.lineTo(cx + 6 * u, cy + 3 * u);
    ctx.moveTo(cx - 6 * u, cy + 3 * u);
    ctx.lineTo(cx + 6 * u, cy - 3 * u);
    ctx.stroke();
    const fire = 1 - 0.8 * k;
    for (let i = 0; i < 5; i++) {
      const ph = reduced ? 0.5 : (t * (1.4 + i * 0.2) + i * 0.37) % 1;
      const fx = cx + (i - 2) * 1.6 * u, fy = cy - ph * 10 * u * fire;
      ctx.fillStyle = i % 2 ? rgba('#ffd27a', (1 - ph) * fire) : rgba(C.fire, (1 - ph) * fire);
      ctx.beginPath();
      ctx.arc(fx, fy, (3.2 - ph * 2) * u * (0.5 + 0.5 * fire), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = rgba('#ff8a3a', 0.5 + 0.3 * fire);
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * u, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * 0.75 + i * 0.62;
      paintPilgrim(ctx, cx + Math.cos(a) * 20 * u, cy + Math.sin(a) * 15 * u, 5.5 * u, i, true);
    }
  }
}
