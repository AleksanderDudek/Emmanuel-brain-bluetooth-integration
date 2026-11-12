/**
 * Odporność's picture for the lobby's hero and the game card: a slice of skin with the venule along the
 * bottom, red cells flowing, a swarm of white cells chasing the bacteria (one in a gulp), Makro sending the
 * alarm's rings with a focus that comes and goes (gold beyond the dashed threshold), a few gold antibodies.
 * In the lobby (with progress) the bacteria are the player's current loop's.  Stateless and cheap.
 */
import { loopSpec } from './content';
import type { OdpProgress } from './meta';
import { PAL, TAU, circle, glow, paintBug, paintMacrophage, paintNeutrophil, paintY } from './paint';

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: OdpProgress): void {
  const s = Math.max(1.5, Math.min(w / 110, h / 70));
  const vesselY = h * 0.82;
  // the dermis and the skin's edge on top
  const der = ctx.createLinearGradient(0, 0, 0, h);
  der.addColorStop(0, PAL.tissue[0]);
  der.addColorStop(0.5, PAL.tissue[1]);
  der.addColorStop(1, PAL.tissue[3]);
  ctx.fillStyle = der;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = PAL.epi;
  ctx.fillRect(0, 0, w, h * 0.08);
  ctx.fillStyle = PAL.corneum;
  ctx.fillRect(0, 0, w, h * 0.02);
  ctx.strokeStyle = PAL.fibre;
  ctx.lineWidth = s;
  for (let i = 0; i < 6; i++) {
    const y = h * (0.18 + i * 0.1);
    ctx.beginPath();
    ctx.moveTo(-5, y);
    ctx.bezierCurveTo(w * 0.3, y - 3 * s, w * 0.7, y + 3 * s, w + 5, y);
    ctx.stroke();
  }
  // the venule with its red cells
  ctx.fillStyle = PAL.vesselWall;
  ctx.fillRect(0, vesselY - 2 * s, w, h - vesselY + 2 * s);
  ctx.fillStyle = PAL.lumen[1];
  ctx.fillRect(0, vesselY, w, h - vesselY);
  for (let i = 0; i < 9; i++) {
    const x = ((t * 30 * s + i * w / 9) % (w + 20)) - 10, y = vesselY + (h - vesselY) * (0.35 + 0.3 * Math.sin(i * 2.1));
    ctx.fillStyle = PAL.rbc;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.6 * s, 1.5 * s, 0.2, 0, TAU);
    ctx.fill();
  }
  // the alarm: Makro's rings, gold beyond the threshold when the focus comes
  const level = 0.5 + 0.45 * Math.sin(t * 0.7);
  const mx = w * 0.24, my = h * 0.42;
  const R = 22 * s * (1 + level), T = 22 * s * 1.5;
  glow(ctx, mx, my, R, level >= 0.5 ? '255,210,122' : '255,236,220', 0.18);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,209,102,0.85)';
  ctx.lineWidth = 1.2;
  circle(ctx, mx, my, T);
  ctx.stroke();
  ctx.setLineDash([]);
  const ring = (t * 0.8) % 1;
  ctx.strokeStyle = `rgba(255,214,120,${0.7 * (1 - ring)})`;
  ctx.lineWidth = 1.6;
  circle(ctx, mx, my, R * ring);
  ctx.stroke();
  paintMacrophage(ctx, mx, my, 8.5 * s, { t, seed: 0.77, dir: 0, speed: 0, m2: 0, eyes: true });
  // bacteria and the swarm after them
  const kind = loopSpec(p?.loop ?? 1).bug;
  for (let i = 0; i < 7; i++) {
    const cyc = (t * 0.25 + i / 7) % 1;
    const bx = w * (0.55 + 0.32 * Math.cos(i * 1.7)) + Math.sin(t + i) * 3 * s, by = h * (0.32 + 0.3 * Math.sin(i * 2.3));
    const tagged = i % 3 === 0;
    if (tagged) glow(ctx, bx, by, 6 * s, '255,209,102', 0.35);
    paintBug(ctx, kind, bx, by, 1.9 * s, { a: i + t * 0.3, t, seed: i / 7, tag: tagged ? 1 : 0, c3: false, capsule: false, netted: false, split: cyc > 0.85 ? (cyc - 0.85) / 0.15 : 0, pop: 1, fade: 0 });
  }
  for (let i = 0; i < 6; i++) {
    const a = t * 0.6 + i * 1.05;
    const nx = w * 0.62 + Math.cos(a) * w * 0.16 + Math.sin(t * 1.3 + i) * 3 * s, ny = h * 0.48 + Math.sin(a * 1.2) * h * 0.18;
    glow(ctx, nx, ny, 9 * s, '236,226,255', 0.22);
    paintNeutrophil(ctx, nx, ny, 4.2 * s, { t, seed: i / 6, dir: a + Math.PI / 2, speed: 0.5, eyes: s * 4.2 >= 6, gulp: i === 2 ? 0.5 + 0.5 * Math.sin(t * 3) : 0 });
  }
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.35 + i / 4) % 1;
    paintY(ctx, w * (0.3 + i * 0.18), vesselY - k * h * 0.4, Math.max(2.5, 1.4 * s), k * 3 + i);
  }
}
