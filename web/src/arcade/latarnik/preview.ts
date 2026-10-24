/**
 * Latarnik's picture for the lobby's hero and the game card: the radial night zoomed in on the
 * island, the beam turning, boats drifting in and two sailing home with their lanterns lit.  With
 * the player's progress the island shows their village; on the cards a small generic one.
 * Drawn every frame in the lobby, so it stays cheap: gradients are cached per size and the
 * looks are reused.
 */
import { clamp } from '../kit/juice';
import { village, type LatarnikProgress } from './meta';
import { C, hash, paintBeam, paintBoat, paintIsland, paintIsolines, sprites, type BoatLook, type IslandLook } from './paint';
import type { BoatKind } from './sim';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const KINDS: readonly BoatKind[] = ['kuter', 'drobnicowiec', 'zaglowka', 'prom', 'kuter', 'zaglowka'];
const DOTS = [0.01, 9];

let cache: { ctx: CanvasRenderingContext2D; w: number; h: number; bg: CanvasGradient } | null = null;
const look: IslandLook = { built: 3, partial: 0.4, lamp: 1, windows: 1 };
const boat: BoatLook = { light: 0, lit: false, dark: false, alpha: 1 };
let cratesSeen = -1;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: LatarnikProgress): void {
  const s = Math.min(w, h) * 0.14;
  const cx = w * 0.5, cy = h * 0.37;
  const R = s / 0.115;
  if (!cache || cache.ctx !== ctx || cache.w !== w || cache.h !== h) {
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.7);
    bg.addColorStop(0, '#16294f');
    bg.addColorStop(0.45, '#0c1838');
    bg.addColorStop(1, C.ink);
    cache = { ctx, w, h, bg };
  }
  ctx.fillStyle = cache.bg;
  ctx.fillRect(0, 0, w, h);
  const sp = sprites();
  // a calm glow at the shore
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.3;
  ctx.drawImage(sp.teal, cx - R * 0.45, cy - R * 0.45, R * 0.9, R * 0.9);
  ctx.restore();
  paintIsolines(ctx, cx, cy, R, Math.hypot(w, h), t, 0.2, 0.9);
  const beam = ((t * 0.9) % TAU) - Math.PI / 2;
  // four boats drifting in on a loop, two sailing home with their lanterns lit
  for (let i = 0; i < 6; i++) {
    const a = hash(i + 20) * TAU, home = i >= 4;
    const loop = (t * 0.035 + hash(i + 40)) % 1;
    const r = home ? 0.42 - loop * 0.2 : 0.78 - loop * 0.42;
    const x = cx + Math.cos(a) * r * R, y = cy + Math.sin(a) * r * R;
    const d = Math.abs(((a - beam + Math.PI * 3) % TAU) - Math.PI);
    boat.light = home || r > 0.7 ? 0 : clamp(1.25 - d / (11 * DEG));
    boat.lit = home;
    boat.alpha = clamp(Math.min(loop, 1 - loop) * 8);
    paintBoat(ctx, KINDS[i], x, y, home ? a + Math.PI * 0.75 : a + Math.PI, Math.max(10, R * 0.055), boat, sp.cream);
  }
  // the player's village (the cards: a small generic one)
  const crates = p ? p.crates : -2;
  if (crates !== cratesSeen) {
    cratesSeen = crates;
    const v = p ? village(p.crates) : null;
    look.built = v ? v.built : 3;
    look.partial = v ? (v.next ? v.have / v.need : 0) : 0.4;
  }
  paintIsland(ctx, cx, cy, s, t, look);
  paintBeam(ctx, cx, cy, beam, R * 0.7, 0.85, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(sp.cream, cx - s * 0.9, cy - s * 0.9, s * 1.8, s * 1.8);
  ctx.restore();
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.5, s * 0.1), 0, TAU);
  ctx.fill();
  // the reach, dotted
  ctx.save();
  ctx.strokeStyle = 'rgba(255,214,140,.5)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  ctx.setLineDash(DOTS);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.7, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
