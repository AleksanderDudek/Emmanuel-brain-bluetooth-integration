/**
 * Dobry bój's hall (DESIGN.md §25, builder B): a dark hall under one warm light — the crowd as soft silhouettes with
 * small lights beyond the ring, the light's cone with haze in it, and the ring (ropes, corner posts, the canvas and
 * its apron) for boxing or the cage (a fine mesh against the light, padded posts, the mat) for the cage's rules.
 *
 * The world: x across the ring (0 its middle), y up, z the depth (0 the fighters' line, − away from the camera), in
 * units of a standing height.  The camera looks a little down: a deeper thing stands higher on the screen and smaller.
 * The crowd and the hall are baked once per size and style (an offscreen layer at the camera's rest), then drawn
 * with a small parallax; the ring's few lines are drawn live (they move with the camera exactly).
 */
import type { Style } from './moves';
import { C, TAU, clamp01, glow, hash, layer, rgba } from './paint';
import { DEPTH_DROP } from './rig';

/** The camera: the world x at the screen's `ox`, px per unit, the floor's screen y. */
export interface Cam { cx: number; s: number; ox: number; fy: number }

/** A world point (x, y, z) on the screen. */
export function proj(c: Cam, x: number, y: number, z = 0): [number, number] {
  const p = 1 / (1 - z * 0.1);
  return [c.ox + (x - c.cx) * c.s * p, c.fy + z * DEPTH_DROP * c.s - y * c.s * p];
}

/** The ring's measures (world units). */
export const RING = {
  /** the corner posts' x, the back edge's depth, the front edge's depth */
  post: 1.48, back: -1.6, front: 0.55,
  /** the ropes' heights (boxing), the fence's height (the cage) */
  ropes: [0.26, 0.45, 0.64, 0.83] as const,
  fence: 0.95,
};

interface Baked { key: string; c: HTMLCanvasElement | null; cam: Cam }

/** The hall's baked picture for a size: the dark, the crowd, the light's cone. */
export class Hall {
  private baked: Baked | null = null;

  /** Bake (once per size/style) at the camera's rest `rest`. */
  bake(w: number, h: number, dpr: number, style: Style, rest: Cam): void {
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}|${style}|${Math.round(rest.s)}|${Math.round(rest.fy)}|${Math.round(rest.ox)}`;
    if (this.baked?.key === key) return;
    const L = layer(w, h, dpr);
    if (L) paintHall(L.ctx, w, h, style, rest);
    this.baked = { key, c: L?.c ?? null, cam: { ...rest } };
  }

  /** Draw the baked hall for the camera now (a small parallax: the far hall moves less than the ring). */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam, style: Style): void {
    const b = this.baked;
    if (!b?.c) {
      paintHall(ctx, w, h, style, cam);
      return;
    }
    // never smaller than the canvas (a wider shot keeps the hall still), a little larger as the camera eases in
    const k = Math.max(1, Math.pow(cam.s / b.cam.s, 0.55));
    // the hall's anchor: the world point (cx 0, y 0.9, z −4) of the rest camera follows the current one, damped
    const [ax0, ay0] = proj(b.cam, 0, 0.9, -4);
    const [ax1, ay1] = proj(cam, 0, 0.9, -4);
    let tx = ax0 + (ax1 - ax0) * 0.6, ty = ay0 + (ay1 - ay0) * 0.6;
    // keep the picture over the whole canvas: its left/top edge never inside, its right/bottom never short
    tx = Math.min(ax0 * k, Math.max(w - (w - ax0) * k, tx));
    ty = Math.min(ay0 * k, Math.max(h - (h - ay0) * k, ty));
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(k, k);
    ctx.translate(-ax0, -ay0);
    ctx.drawImage(b.c, 0, 0, w, h);
    ctx.restore();
  }
}

function paintHall(ctx: CanvasRenderingContext2D, w: number, h: number, style: Style, cam: Cam): void {
  // the dark, a little warmer low down where the ring's light spills
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a080c');
  g.addColorStop(0.55, C.hall);
  g.addColorStop(1, '#1d1418');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // the light's spill on the far hall
  const [lx, ly] = proj(cam, 0, 0.6, -3.5);
  const sp = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * 0.7);
  sp.addColorStop(0, rgba('#5a3a2c', 0.55));
  sp.addColorStop(0.5, rgba('#2a1a1c', 0.3));
  sp.addColorStop(1, rgba('#0a080c', 0));
  ctx.fillStyle = sp;
  ctx.fillRect(0, 0, w, h);
  // the crowd: rows of soft silhouettes on tiered seats, far to near, each lit a little at the rim by the ring
  const span = (w / cam.s) / 2 + 2;
  const rows = [
    { z: -6.2, y: 0.55, n: 1.25, a: 0.55, col: '#1a1219' },
    { z: -5.2, y: 0.38, n: 1.15, a: 0.7, col: '#1d141b' },
    { z: -4.3, y: 0.2, n: 1.05, a: 0.82, col: '#21171e' },
    { z: -3.5, y: 0.04, n: 0.95, a: 0.92, col: '#251a20' },
  ];
  rows.forEach((r, ri) => {
    const step = 0.21 * r.n;
    for (let i = 0, x = cam.cx - span; x < cam.cx + span; i++, x += step * (0.85 + 0.3 * hash(i * 7 + ri * 131))) {
      const hh = hash(i * 13 + ri * 71);
      const [px, py] = proj(cam, x, r.y + 0.06 * hh, r.z);
      const p = 1 / (1 - r.z * 0.1);
      const s = cam.s * p;
      const hr = 0.05 * s * (0.9 + 0.2 * hh);
      ctx.globalAlpha = r.a;
      ctx.fillStyle = r.col;
      // shoulders and the head
      ctx.beginPath();
      ctx.ellipse(px, py + hr * 2.2, hr * 2.1, hr * 1.5, 0, Math.PI, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, hr, 0, TAU);
      ctx.fill();
      // the rim of the ring's light on the head
      const near = Math.max(0, 1 - Math.abs(x) / 3.2);
      ctx.strokeStyle = rgba('#d8a070', 0.1 + 0.25 * near);
      ctx.lineWidth = Math.max(0.6, hr * 0.25);
      ctx.beginPath();
      ctx.arc(px, py, hr * 0.92, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
  // the light's cone from the rig over the ring, and the haze in it
  const [cx0, cy0] = proj(cam, 0, 3.2, -0.4);
  const [fl, fly] = proj(cam, -1.9, 0, 0);
  const [fr] = proj(cam, 1.9, 0, 0);
  const cone = ctx.createLinearGradient(0, cy0, 0, fly);
  cone.addColorStop(0, rgba(C.warmHi, 0.2));
  cone.addColorStop(0.6, rgba(C.warm, 0.07));
  cone.addColorStop(1, rgba(C.warm, 0.12));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(cx0 - cam.s * 0.25, cy0);
  ctx.lineTo(cx0 + cam.s * 0.25, cy0);
  ctx.lineTo(fr, fly);
  ctx.lineTo(fl, fly);
  ctx.closePath();
  ctx.fill();
  glow(ctx, '#ffd9a0', cx0, cy0 + cam.s * 0.05, cam.s * 0.6, 0.35);
  for (let i = 0; i < 5; i++) {
    const [hx, hy] = proj(cam, (hash(i * 3) - 0.5) * 2.4, 1.2 + hash(i * 5) * 1.4, -0.6);
    glow(ctx, '#ffcf98', hx, hy, cam.s * (0.5 + 0.4 * hash(i * 9)), 0.06);
  }
  ctx.restore();
  // the lamp rig at the top: a dark bar with small lights
  const [, ry] = proj(cam, 0, 3.15, -0.4);
  if (ry > -20) {
    ctx.fillStyle = '#060507';
    ctx.fillRect(cx0 - cam.s * 0.9, ry - 4, cam.s * 1.8, 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = -3; i <= 3; i++) glow(ctx, '#fff0d0', cx0 + i * cam.s * 0.26, ry + 2, 8, 0.8);
    ctx.restore();
  }
  void style;
}

/** The crowd's small lights (phones, a camera's red dot), twinkling with the mood: drawn live over the bake. */
export function crowdLights(ctx: CanvasRenderingContext2D, cam: Cam, w: number, time: number, mood: number, reduced: boolean): void {
  const span = (w / cam.s) / 2 + 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const n = 26 + Math.round(20 * clamp01(mood));
  for (let i = 0; i < n; i++) {
    const hx = hash(i * 17 + 3), hz = hash(i * 29 + 5);
    const x = cam.cx - span + hx * span * 2;
    const z = -3.6 - hz * 2.6;
    const [px, py] = proj(cam, x, 0.18 + 0.35 * hz + 0.05 * hash(i), z);
    const tw = reduced ? 0.7 : 0.5 + 0.5 * Math.sin(time * (0.6 + hash(i * 3) * 1.4) + i);
    const warm = hash(i * 41) > 0.25;
    glow(ctx, warm ? '#ffe2b0' : '#bcd8ff', px, py, 5 + 3 * hash(i * 11), (0.25 + 0.5 * clamp01(mood)) * tw);
  }
  ctx.restore();
}

/** The ring's back: the canvas floor, the back ropes and the posts (or the cage's fence and the mat). */
export function ringBack(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number, style: Style, light: number): void {
  const span = (w / cam.s) / 2 + 0.6;
  const xL = cam.cx - span, xR = cam.cx + span;
  // the floor: from the back edge to below the screen
  const [, yb] = proj(cam, 0, 0, RING.back);
  const [, yf] = proj(cam, 0, 0, RING.front);
  const boks = style === 'boks';
  const fl = ctx.createLinearGradient(0, yb, 0, yf);
  if (boks) {
    fl.addColorStop(0, '#6f665b');
    fl.addColorStop(0.55, '#b9ae9e');
    fl.addColorStop(1, '#9a8f80');
  } else {
    fl.addColorStop(0, '#22232a');
    fl.addColorStop(0.55, '#3d3f4a');
    fl.addColorStop(1, '#30313a');
  }
  ctx.fillStyle = fl;
  ctx.fillRect(0, yb, w, Math.max(0, yf - yb));
  // the light's pool on the floor
  const [px, py] = proj(cam, 0, 0, -0.3);
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(1, 0.26);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, cam.s * 1.6);
  pool.addColorStop(0, rgba(boks ? '#fff3dc' : '#c8c0d8', 0.45 * light));
  pool.addColorStop(0.6, rgba(boks ? '#ffe2b8' : '#9a94b0', 0.16 * light));
  pool.addColorStop(1, rgba('#000000', 0));
  ctx.fillStyle = pool;
  ctx.fillRect(-cam.s * 1.7, -cam.s * 1.7, cam.s * 3.4, cam.s * 3.4);
  ctx.restore();
  if (!boks) {
    // the mat's painted circle, faint
    const [cx, cy] = proj(cam, 0, 0, -0.5);
    ctx.strokeStyle = rgba('#8a8ca0', 0.22);
    ctx.lineWidth = Math.max(1, cam.s * 0.012);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cam.s * 1.25, cam.s * 1.25 * 0.2, 0, 0, TAU);
    ctx.stroke();
  }
  if (boks) {
    // the corner posts at the back, padded
    for (const sx of [-1, 1]) {
      const [x0, y0] = proj(cam, sx * RING.post, 0, RING.back);
      const [, y1] = proj(cam, sx * RING.post, 0.95, RING.back);
      const pw = cam.s * 0.05;
      ctx.fillStyle = C.post;
      ctx.fillRect(x0 - pw / 2, y1, pw, y0 - y1);
      ctx.fillStyle = sx < 0 ? '#8a3a34' : '#34508a';
      ctx.fillRect(x0 - pw * 0.7, y1 + (y0 - y1) * 0.08, pw * 1.4, (y0 - y1) * 0.8);
    }
    // the ropes: a slight sag, lit on top
    RING.ropes.forEach((rh, i) => {
      const [x0, y0] = proj(cam, -RING.post, rh, RING.back);
      const [x1, y1] = proj(cam, RING.post, rh, RING.back);
      const lw = Math.max(1.2, cam.s * 0.014);
      ctx.strokeStyle = i === 3 ? '#9a3a36' : i === 0 ? '#3a4f80' : '#cfc6b8';
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(Math.min(x0, xL * 0 + x0), y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + cam.s * 0.02, x1, y1);
      ctx.stroke();
      ctx.strokeStyle = rgba('#fff4e0', 0.35 * light);
      ctx.lineWidth = lw * 0.35;
      ctx.beginPath();
      ctx.moveTo(x0, y0 - lw * 0.3);
      ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + cam.s * 0.02 - lw * 0.3, x1, y1 - lw * 0.3);
      ctx.stroke();
    });
  } else {
    // the cage's fence: a fine mesh between padded posts, the top rail
    const [, yTop] = proj(cam, 0, RING.fence, RING.back);
    const [, yBot] = proj(cam, 0, 0, RING.back);
    const cell = Math.max(5, cam.s * 0.045);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, yTop, w, yBot - yTop);
    ctx.clip();
    ctx.strokeStyle = rgba(C.fence, 0.2 * light + 0.06);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -(yBot - yTop); x < w + (yBot - yTop); x += cell) {
      ctx.moveTo(x, yTop);
      ctx.lineTo(x + (yBot - yTop), yBot);
      ctx.moveTo(x, yBot);
      ctx.lineTo(x + (yBot - yTop), yTop);
    }
    ctx.stroke();
    ctx.restore();
    // the light catches the mesh near the middle
    const [gx, gy] = proj(cam, 0, 0.5, RING.back);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#d8d0e8', gx, gy, cam.s * 0.9, 0.1 * light);
    ctx.restore();
    for (let x = Math.ceil(xL / 1.1) * 1.1; x < xR; x += 1.1) {
      const [x0, y0] = proj(cam, x, 0, RING.back);
      const [, y1] = proj(cam, x, RING.fence, RING.back);
      const pw = cam.s * 0.045;
      ctx.fillStyle = '#121216';
      ctx.fillRect(x0 - pw / 2, y1, pw, y0 - y1);
      ctx.fillStyle = rgba('#ffffff', 0.08);
      ctx.fillRect(x0 - pw / 2, y1, pw * 0.3, y0 - y1);
    }
    ctx.fillStyle = '#141418';
    ctx.fillRect(0, yTop - cam.s * 0.03, w, cam.s * 0.04);
    ctx.fillStyle = rgba('#ffffff', 0.08);
    ctx.fillRect(0, yTop - cam.s * 0.03, w, cam.s * 0.008);
  }
  void h;
}

/** The ring's front: the canvas's edge and the apron (boxing), or the mat's edge (the cage). */
export function ringFront(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number, style: Style): void {
  const [, yf] = proj(cam, 0, 0, RING.front);
  if (yf >= h) return;
  const boks = style === 'boks';
  ctx.fillStyle = boks ? '#2a1d22' : '#15161b';
  ctx.fillRect(0, yf, w, h - yf);
  ctx.fillStyle = boks ? rgba('#e9dcc8', 0.6) : rgba('#6a6c7a', 0.5);
  ctx.fillRect(0, yf, w, Math.max(1.5, cam.s * 0.01));
  if (boks) {
    ctx.fillStyle = rgba('#8a3a34', 0.55);
    ctx.fillRect(0, yf + cam.s * 0.05, w, Math.max(2, cam.s * 0.025));
  }
}

/** Dust in the light: still in the slow motion (moves with the world's time). */
export function dust(ctx: CanvasRenderingContext2D, cam: Cam, wt: number, amount: number, reduced: boolean): void {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#ffe9c8';
  for (let i = 0; i < 42; i++) {
    const t = reduced ? 0 : wt;
    const x = (hash(i * 7) - 0.5) * 2.6 + 0.08 * Math.sin(t * 0.3 + i);
    const y = ((hash(i * 13) * 2.6 + t * 0.035 * (0.5 + hash(i))) % 2.6);
    const z = -hash(i * 19) * 1.2;
    const [px, py] = proj(cam, x, y, z);
    const r = Math.max(0.7, cam.s * 0.0045 * (0.6 + hash(i * 23)));
    // brighter in the cone's middle
    const inCone = clamp01(1 - Math.abs(x) / (0.5 + y * 0.45));
    ctx.globalAlpha = amount * (0.12 + 0.5 * inCone) * (0.6 + 0.4 * Math.sin(i + t * 0.7));
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
