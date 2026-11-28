/**
 * Nowe siły's small painting helpers for the tissue under the lens (DESIGN.md §28): soft cells with a lit side and a
 * nucleus, a stem cell's pearl-and-aqua light, red discs, wavy bands — a watercolour hand, warmer and rounder than
 * the section's other plates, so these pictures are the game's own.
 */
import { TAU, glow, hash, mix, rgba, type Pt } from '../kit/healthlib/paint';

export const clamp = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const phase = (g: number, a: number, b: number): number => clamp((g - a) / (b - a));
export const smooth = (x: number): number => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const lerpPt = (a: Pt, b: Pt, k: number): Pt => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

export const STEM = '#9fe9ff';
export const STEM_HI = '#e8fbff';
export const RBC = '#ff6a6a';
export const RBC_HI = '#ffb0a0';

/** A soft cell: an oval lit from the upper left, its rim a little darker, a nucleus (or none). */
export function cell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, body: string, nucleus: string | null, a = 1, nk = 0.45): void {
  if (a <= 0.01 || rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= a;
  const g = ctx.createRadialGradient(-rx * 0.35, -ry * 0.35, 0, 0, 0, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, mix(body, '#ffffff', 0.35));
  g.addColorStop(0.6, body);
  g.addColorStop(1, mix(body, '#20102a', 0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(mix(body, '#ffffff', 0.5), 0.45);
  ctx.lineWidth = Math.max(0.2, Math.min(rx, ry) * 0.08);
  ctx.stroke();
  if (nucleus) {
    ctx.fillStyle = nucleus;
    ctx.beginPath();
    ctx.ellipse(rx * 0.06, ry * 0.04, rx * nk, ry * nk, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.18);
    ctx.beginPath();
    ctx.ellipse(rx * 0.06 - rx * nk * 0.3, ry * 0.04 - ry * nk * 0.3, rx * nk * 0.35, ry * nk * 0.3, 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A stem cell: pearl with an aqua light, the nucleus large; `wake` (0..1) brightens it and its halo. */
export function stemCell(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, wake: number, time: number, reduced: boolean): void {
  const pulse = reduced ? 1 : 0.88 + 0.12 * Math.sin(time * 2.1 + x * 0.1);
  glow(ctx, STEM, x, y, r * (2.4 + 0.8 * wake), (0.18 + 0.4 * wake) * pulse);
  cell(ctx, x, y, r, r * 0.94, 0, mix('#b9dfe8', STEM, 0.4 + 0.4 * wake), mix('#3a5a8a', '#5a7ac0', wake), 1, 0.55);
  glow(ctx, STEM_HI, x - r * 0.25, y - r * 0.25, r * 0.6, 0.3 + 0.4 * wake);
}

/** A red blood cell seen whole: a disc with a paler middle (no nucleus). */
export function redDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, a = 1, tilt = 0.85): void {
  if (a <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= a;
  ctx.fillStyle = RBC;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * tilt, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(RBC_HI, 0.55);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.45, r * 0.45 * tilt, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('#b8304a', 0.6);
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * tilt, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** A wavy line's points (left to right) around a base line: y = base(x) + amp·sin. */
export function wavy(x0: number, x1: number, n: number, base: (x: number) => number, amp: number, freq: number, ph = 0): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push([x, base(x) + amp * Math.sin(x * freq + ph)]);
  }
  return pts;
}

/** Scattered pale cells of the marrow or the dermis, always the same (a seed). */
export function scatter(n: number, box: { x: number; y: number; w: number; h: number }, seed: number, keep: (x: number, y: number) => boolean): { x: number; y: number; r: number; k: number }[] {
  const out: { x: number; y: number; r: number; k: number }[] = [];
  for (let i = 0; i < n * 4 && out.length < n; i++) {
    const x = box.x + hash(seed + i * 3.17) * box.w, y = box.y + hash(seed + i * 7.31) * box.h;
    if (!keep(x, y)) continue;
    out.push({ x, y, r: 2.2 + 2.6 * hash(seed + i * 1.91), k: hash(seed + i * 5.53) });
  }
  return out;
}
