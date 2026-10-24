/**
 * "Rozłup geodę", the session's finisher (5 s): the scene dims, a stone rises and cracks, its halves
 * part on a ring of crystals with the specimen in their light, then its name, tier, size and what
 * it did for the cabinet (a new specimen, a better one, or pył).
 */
import { clamp, ease } from '../kit/juice';
import { drawSpecimen, fitFont, hash, rgba, SANS, SERIF, TAU } from './art';
import { MINERALS, TIERS } from './content';
import { INK } from './hud';
import { TOP } from './layout';
import { FINALE_SEC, type GeodaSim } from './sim';

export interface FinaleView { m: number; tier: number; cm: number; outcome: 'new' | 'upgrade' | 'dust'; dust: number; extra: number }

/** One frame of the finisher over the scene (`w`×`h` CSS px); `f` = the specimen (null before it is rolled). */
export function drawFinale(ctx: CanvasRenderingContext2D, sim: GeodaSim, f: FinaleView | null, w: number, h: number, dpr: number, still: boolean): void {
  const t = sim.phase === 'done' ? FINALE_SEC : sim.finaleT;
  const dim = ease.outCubic(clamp(t / 0.8));
  ctx.save();
  ctx.fillStyle = `rgba(9,7,14,${(0.84 * dim).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  const R = Math.min(w * 0.3, (h - TOP) * 0.22, 150);
  const cx = w / 2, cy = TOP + (h - TOP) * 0.42;
  const grow = ease.outBack(clamp(t / 1.1));
  const crack = clamp((t - 1.2) / 1.3);
  const open = ease.outCubic(clamp((t - 2.5) / 0.6));
  const mn = f ? MINERALS[f.m] : MINERALS[0];
  // the title while it cracks
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (t < 3) {
    ctx.globalAlpha = clamp(t / 0.5) * clamp((3 - t) / 0.4);
    fitFont(ctx, 'Rozłup geodę', 30, w - 40, SERIF, 500);
    ctx.fillStyle = INK;
    ctx.fillText('Rozłup geodę', cx, cy - R * 1.35);
    ctx.globalAlpha = 1;
  }
  const jit = !still && crack > 0 && crack < 1 ? Math.sin(t * 61) * 2.5 * (1 - open) : 0;
  ctx.translate(cx + jit, cy);
  ctx.scale(grow, grow);
  if (open > 0 && f) {
    // inside: the druse and the specimen, light pouring out
    ctx.globalCompositeOperation = 'lighter';
    const burst = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.4);
    burst.addColorStop(0, rgba(mn.colors[1], 0.55 * open));
    burst.addColorStop(1, rgba(mn.colors[1], 0));
    ctx.fillStyle = burst;
    ctx.fillRect(-R * 2.4, -R * 2.4, R * 4.8, R * 4.8);
    ctx.globalCompositeOperation = 'source-over';
  }
  const half = (side: -1 | 1) => {
    ctx.save();
    ctx.translate(side * open * Math.max(R * 0.55, Math.min(R * 0.95, (w / 2 - R) / grow)), open * R * 0.12);
    ctx.rotate(side * open * 0.32);
    ctx.beginPath();
    // each half: the stone ball cut along a jagged crack
    const pts = 7;
    ctx.moveTo(0, -R);
    for (let i = 1; i < pts; i++) ctx.lineTo((i % 2 ? side : -side) * R * 0.08 * (1 - Math.abs(i - pts / 2) / pts), -R + (2 * R * i) / pts);
    ctx.lineTo(0, R);
    // the outside: a lumpy stone, not a ball
    for (let i = 1; i <= 24; i++) {
      const a = Math.PI / 2 + side * -(i / 24) * Math.PI;
      const rr = R * (1 + 0.045 * Math.sin(a * 5 + 1.3) + 0.03 * Math.sin(a * 11 + 0.4));
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-R * 0.4, -R * 0.45, R * 0.05, 0, 0, R * 1.15);
    g.addColorStop(0, '#6e5f53');
    g.addColorStop(0.55, '#41372f');
    g.addColorStop(1, '#1d1814');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,214,0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = hash(i * 1.7) > 0.6 ? 'rgba(255,236,214,0.07)' : 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc((hash(i * 3.1) * 2 - 1) * R, (hash(i * 5.3) * 2 - 1) * R, 0.8 + hash(i) * R * 0.035, 0, TAU);
      ctx.fill();
    }
    if (open > 0) {
      // the cut face: a ring of crystals in the mineral's colours
      ctx.fillStyle = mn.colors[2];
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.82, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * TAU, rr = R * (0.6 + 0.2 * hash(i * 2.1));
        ctx.fillStyle = [mn.colors[0], mn.colors[1], mn.colors[2]][i % 3];
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.82, Math.sin(a) * R * 0.82);
        ctx.lineTo(Math.cos(a + 0.07) * rr, Math.sin(a + 0.07) * rr);
        ctx.lineTo(Math.cos(a + 0.14) * R * 0.82, Math.sin(a + 0.14) * R * 0.82);
        ctx.fill();
      }
    }
    ctx.restore();
    // the crack, growing down the ball
    if (crack > 0 && open === 0) {
      ctx.strokeStyle = 'rgba(12,8,6,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -R);
      const n = Math.ceil(pts * crack);
      for (let i = 1; i <= n; i++) ctx.lineTo((i % 2 ? 1 : -1) * R * 0.08 * (1 - Math.abs(i - pts / 2) / pts), -R + (2 * R * Math.min(i, pts * crack)) / pts);
      ctx.stroke();
    }
    ctx.restore();
  };
  half(-1);
  half(1);
  if (open > 0 && f) {
    const bob = still ? 0 : Math.sin(t * 1.6) * 3;
    drawSpecimen(ctx, 0, -R * 0.15 * open + bob, R * 1.15 * open, f.m, f.tier, t);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (f && t > 2.9) {
    const a = clamp((t - 2.9) / 0.5);
    ctx.globalAlpha = a;
    const y = cy + R * 1.45;
    fitFont(ctx, mn.title, 34, w - 40, SERIF, 500);
    ctx.fillStyle = INK;
    ctx.fillText(mn.title, cx, y);
    const line = `${TIERS[f.tier]} · ${f.cm.toFixed(1)} cm`;
    fitFont(ctx, line, 16, w - 40, SANS, 600);
    ctx.fillStyle = f.tier >= 3 ? '#ffd48a' : f.tier >= 1 ? '#d6b8ff' : 'rgba(239,232,220,0.75)';
    ctx.fillText(line, cx, y + 28);
    const out = f.outcome === 'new' ? 'Nowy okaz w gablocie' : f.outcome === 'upgrade' ? 'Lepszy okaz w gablocie' : `Duplikat: +${f.dust} pyłu`;
    const more = f.extra ? ` · i jeszcze ${f.extra} z pełnej geody` : '';
    fitFont(ctx, out + more, 14, w - 40, SANS, 600);
    ctx.fillStyle = '#ffe6b0';
    ctx.fillText(out + more, cx, y + 52);
  }
  ctx.restore();
}
