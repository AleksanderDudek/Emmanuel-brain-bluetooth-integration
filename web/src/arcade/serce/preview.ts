/**
 * Z głowy do serca's lobby picture and card art: the figure of light small on the curve of the Earth at night, the
 * flame in its heart, the heart's field and the five rings round it — their lamps lit up to the furthest ring the
 * player has reached (all of them faintly on a card without progress) — a light at the brow coming down the midline,
 * and the first gold of the one sun at the limb.  Cheap enough to draw every frame.
 */
import { clamp } from '../kit/juice';
import { HEART_Y } from './layout';
import type { SerceProgress } from './meta';
import { GOLD, GOLD_HI, ROSE, figureWorldPath, glow, hash } from './paint';
import { RULES } from './rules';

const TAU = Math.PI * 2;
const LAMP = ['#ffb766', '#ffd36b', '#fff0c8', '#ffc4d6', '#ffd27a'];

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, p?: SerceProgress): void {
  ctx.save();
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#080818');
  sky.addColorStop(0.6, '#140d2c');
  sky.addColorStop(1, '#24123a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(230,230,255,${0.15 + 0.5 * hash(i * 3) ** 2})`;
    ctx.fillRect(hash(i * 3 + 1) * w, hash(i * 3 + 2) * h * 0.8, 1, 1);
  }
  const R = RULES.ringR;
  // the world: the heart at the middle, the rings fit the shorter side
  const s = Math.min(w, h) / (2 * (R[4] + 0.35));
  const cx = w / 2, cy = h * 0.47;
  const reach = p ? p.reach : 5;
  // the Earth's limb under the feet
  const er = RULES.earthR * s, ey = cy + (1 - HEART_Y) * s + er;
  ctx.fillStyle = '#0c1834';
  ctx.beginPath();
  ctx.arc(cx, ey, er, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,170,255,.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // city lights on the limb when the world was reached
  if (reach >= 5) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (hash(i * 7) - 0.5) * 1.6;
      const d = er * (0.88 + 0.1 * hash(i * 7 + 1));
      glow(ctx, '#ffcf7a', cx + Math.cos(a) * d, ey + Math.sin(a) * d, 3 + 3 * hash(i), 0.7);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // the field and the rings
  const field = Math.max(R[0], reach >= 1 ? R[Math.min(4, reach)] : R[0]) * s;
  const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, field);
  fg.addColorStop(0, 'rgba(255,220,170,.22)');
  fg.addColorStop(0.9, 'rgba(255,170,180,.07)');
  fg.addColorStop(1, 'rgba(255,170,180,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(cx, cy, field, 0, TAU);
  ctx.fill();
  for (let k = 1; k <= 4; k++) {
    const on = reach >= k;
    ctx.strokeStyle = on ? 'rgba(255,214,170,.45)' : 'rgba(210,206,240,.15)';
    ctx.setLineDash(on ? [] : [3, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R[k] * s, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    const n = [0, 6, 8, 12, 6][k];
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) / n) * TAU + k * 0.2;
      const x = cx + Math.cos(a) * R[k] * s, y = cy + Math.sin(a) * R[k] * s;
      const tw = 0.75 + 0.25 * Math.sin(time * 1.3 + i + k);
      glow(ctx, on ? LAMP[k - 1] : '#9a96c8', x, y, on ? 6 : 3, on ? 0.85 * tw : 0.3);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // the figure
  const path = figureWorldPath();
  if (path) {
    ctx.save();
    ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([s, 0, 0, s, cx, cy])));
    ctx.fillStyle = 'rgba(236,222,255,.14)';
    ctx.fill(path);
    ctx.strokeStyle = 'rgba(255,226,190,.8)';
    ctx.lineWidth = 1.4 / s;
    ctx.stroke(path);
    ctx.restore();
  }
  // the light coming down from the brow, and the heart
  ctx.globalCompositeOperation = 'lighter';
  const k = (time * 0.12) % 1;
  const by = cy + (0.052 - HEART_Y) * s;
  const ly = by + (cy - by) * clamp(k * 1.25);
  glow(ctx, GOLD_HI, cx, ly, 5 + 0.04 * s, 0.9);
  const beat = 1 + 0.08 * Math.max(0, Math.sin(time * 2.2));
  glow(ctx, ROSE, cx, cy, Math.max(10, 0.26 * s) * beat, 0.6);
  glow(ctx, GOLD, cx, cy, Math.max(6, 0.13 * s) * beat, 0.85);
  // the first gold of the sun at the limb
  glow(ctx, '#ffd27a', cx + er * 0.8, ey - er * 0.62, Math.max(24, 0.9 * s), 0.35 + 0.1 * Math.sin(time * 0.6));
  ctx.restore();
}
