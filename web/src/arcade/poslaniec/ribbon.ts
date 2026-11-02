/**
 * The ribbon of dawn (DESIGN.md §7.2, the history): the last 40 s of the band's signal drawn across
 * the upper sky with SignalTrace's layout in Posłaniec's own skin — a ribbon of light, soft gold
 * where it lies above the threshold and pale rose below it, a cool blue band behind the watchtowers'
 * blocks, a dotted gap where the band lost the signal (never a low value), a mist over a blind block
 * that lifts at its end, the threshold as a faint dashed line, the bracket at the "now" end marking
 * the band's delay ("≈5 s" Mendi, "≈1 s" HALO), and the newest point as a small rising sun.
 *
 * Also the block card's mini-curve: one block's samples in their own range.
 */
import type { TraceLayout, TraceSample } from '../kit/trace';
import { C, SANS, font, hash } from './paint';

const GOLD = '255,207,110';
const ROSE = '242,185,192';

export function paintRibbon(ctx: CanvasRenderingContext2D, l: TraceLayout, o: { lagSec: number; lagLabel: string; t: number; u: number; alpha: number }): void {
  const { box, points } = l;
  ctx.save();
  ctx.globalAlpha = o.alpha;
  // the band of sky it runs in: a soft lighter wash with round ends
  ctx.fillStyle = 'rgba(255,236,214,.08)';
  ctx.beginPath();
  ctx.roundRect(box.x - 6, box.y - 4, box.w + 12, box.h + 8, 12 * o.u);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(box.x - 6, box.y - 4, box.w + 12, box.h + 8);
  ctx.clip();
  if (points.length >= 2) {
    // a cool band behind the watchtowers' blocks
    for (const b of l.bands) {
      if (b.phase !== 'rest') continue;
      const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
      g.addColorStop(0, 'rgba(143,176,232,.05)');
      g.addColorStop(1, 'rgba(143,176,232,.28)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x0, box.y - 4, Math.max(1, b.x1 - b.x0), box.h + 8);
    }
    // the threshold
    ctx.setLineDash([3 * o.u, 5 * o.u]);
    ctx.strokeStyle = 'rgba(255,240,220,.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.ty) : ctx.moveTo(p.x, p.ty)));
    ctx.stroke();
    ctx.setLineDash([]);
    // the light between the ribbon and the threshold: gold above, rose below
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const shown = Math.min(a.shown, b.shown);
      if (!a.reliable || !b.reliable || shown <= 0) continue;
      const up = a.above && b.above;
      ctx.globalAlpha = o.alpha * shown * (up ? 0.42 : 0.16);
      ctx.fillStyle = `rgb(${up ? GOLD : ROSE})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.ty);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x, b.ty);
      ctx.closePath();
      ctx.fill();
    }
    // the ribbon itself: a wide soft stroke under a bright thin one
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [wide, a0] of [[7, 0.22], [2.6, 1]] as const) {
      ctx.lineWidth = wide * o.u;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const shown = Math.min(a.shown, b.shown);
        if (!a.reliable || !b.reliable || shown <= 0) continue;
        ctx.globalAlpha = o.alpha * shown * a0;
        ctx.strokeStyle = a.above && b.above ? `rgb(${GOLD})` : `rgb(${ROSE})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = o.alpha;
    // gaps without signal: a dotted floor (the band lost the signal; not a low value)
    ctx.strokeStyle = 'rgba(255,240,220,.6)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([1.5, 5]);
    const floor = box.y + box.h - 2;
    let from: number | null = null;
    for (let i = 0; i <= points.length; i++) {
      const p = points[i];
      const gap = p && !p.reliable && p.shown > 0;
      if (gap && from === null) from = p.x;
      if (!gap && from !== null) {
        ctx.beginPath();
        ctx.moveTo(from, floor);
        ctx.lineTo(p ? p.x : points[points.length - 1].x, floor);
        ctx.stroke();
        from = null;
      }
    }
    ctx.setLineDash([]);
    // mist over a blind block: soft drifting puffs, lifting as the veil fades
    for (const b of l.bands) {
      if (!b.veiled) continue;
      const g = ctx.createLinearGradient(0, box.y - 4, 0, box.y + box.h + 4);
      g.addColorStop(0, 'rgba(226,228,240,.55)');
      g.addColorStop(0.5, 'rgba(236,236,244,.82)');
      g.addColorStop(1, 'rgba(226,228,240,.55)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x0, box.y - 4, Math.max(1, b.x1 - b.x0), box.h + 8);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      const n = Math.max(1, Math.floor((b.x1 - b.x0) / (26 * o.u)));
      for (let k = 0; k < n; k++) {
        const x = b.x0 + ((k + 0.5) / n) * (b.x1 - b.x0) + Math.sin(o.t * 0.7 + k) * 5;
        const y = box.y + box.h * (0.3 + 0.4 * hash(k + 11)) + Math.cos(o.t * 0.5 + k * 2) * 3;
        ctx.beginPath();
        ctx.ellipse(x, y, 16 * o.u, 6 * o.u, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // the band's delay at the "now" end: a bracket with its label
    const last = points[points.length - 1];
    if (o.lagSec > 0) {
      const x0 = l.xOf(last.t - o.lagSec), y = box.y + 2;
      ctx.strokeStyle = 'rgba(255,240,220,.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, y + 5);
      ctx.lineTo(x0, y);
      ctx.lineTo(last.x, y);
      ctx.lineTo(last.x, y + 5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,220,.9)';
      ctx.font = font(700, 9.5 * o.u, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(o.lagLabel, (x0 + last.x) / 2, y + 3);
    }
    // now: a small rising sun at the ribbon's head
    if (last.reliable && last.shown > 0) {
      const r = 4.5 * o.u;
      const g = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, r * 3.2);
      g.addColorStop(0, last.above ? 'rgba(255,214,120,.8)' : 'rgba(250,200,205,.7)');
      g.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(last.x, last.y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = last.above ? C.gold2 : '#fde2e4';
      ctx.beginPath();
      ctx.arc(last.x, last.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A block's own curve in miniature (the block card): its samples in their own range; `shown` fades a blind block's reveal. */
export function paintMiniCurve(ctx: CanvasRenderingContext2D, samples: readonly TraceSample[], x: number, y: number, w: number, h: number, shown: number, u: number): void {
  if (samples.length < 2) return;
  let lo = Infinity, hi = -Infinity;
  for (const s of samples) {
    lo = Math.min(lo, s.threshold);
    hi = Math.max(hi, s.threshold);
    if (s.reliable && s.activity !== null) { lo = Math.min(lo, s.activity); hi = Math.max(hi, s.activity); }
  }
  if (hi - lo < 3) { const m = (hi + lo) / 2; lo = m - 1.5; hi = m + 1.5; }
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
  const X = (t: number) => x + ((t - t0) / Math.max(0.1, t1 - t0)) * w;
  const Y = (v: number) => y + h * (1 - (v - lo) / (hi - lo));
  ctx.save();
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = 'rgba(80,60,40,.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  samples.forEach((s, i) => (i ? ctx.lineTo(X(s.t), Y(s.threshold)) : ctx.moveTo(X(s.t), Y(s.threshold))));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = shown;
  ctx.lineWidth = 2 * u;
  ctx.lineCap = 'round';
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (!a.reliable || !b.reliable || a.activity === null || b.activity === null) continue;
    const up = a.activity >= a.threshold && b.activity >= b.threshold;
    ctx.strokeStyle = up ? '#d9952a' : '#c98a92';
    ctx.beginPath();
    ctx.moveTo(X(a.t), Y(a.activity));
    ctx.lineTo(X(b.t), Y(b.activity));
    ctx.stroke();
  }
  ctx.restore();
}
