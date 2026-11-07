/**
 * Where Jerzy i smok's play view puts things (CSS px), for phones upright and on their side and for
 * desktops: the HUD's boxes (the status with the block's strategy and what the band drives, the
 * headline, the dragon's bar), and the arena — its scale (px per u) and its top-left corner — with
 * the fence and its pennants (the band's last 40 s) above it.  The runner's top strip (time, pause)
 * and bottom strip (the signal banner, the simulator button) stay clear of the HUD; the canvas is the
 * space above the runner's signal dock, so a phone on its side can leave very little height: there
 * the HUD becomes a column on the left and the arena takes the rest.
 */
import { clamp } from '../kit/juice';
import { RULES } from './rules';

export const TOP = 64;
export const BOTTOM = 62;

export interface Rect { x: number; y: number; w: number; h: number }

export type Mode = 'wide' | 'tall' | 'short';

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  mode: Mode;
  /** px per u of the arena, its top-left corner (px) */
  S: number;
  ox: number;
  oy: number;
  /** the fence's height above the arena (px): the pennants hang from its rail */
  fenceH: number;
  /** the status (block, strategy, what the band drives) at its tallest */
  status: Rect;
  /** the headline's right edge and top; inside the status card's corner on upright screens */
  scoreX: number;
  scoreY: number;
  scoreInStatus: boolean;
  /** the status card's lines: the strategy's and the band's at most */
  tipLines: number;
  driveLines: number;
  /** the dragon's bar (its name, its phases, its scales) */
  boss: Rect;
  /** the level pill's top-left */
  pillX: number;
  pillY: number;
  /** the lowest HUD edge over the arena, and where cards and the choice centre */
  hudBottom: number;
  cardY: number;
  /** the x range cards and the choice can use */
  areaX0: number;
}

/** Fit the arena (with its fence) into a box. */
function fit(box: Rect): { S: number; ox: number; oy: number; fenceH: number } {
  const fenceK = 1.05;
  const S = clamp(Math.min(box.w / (RULES.arenaW + 0.3), box.h / (RULES.arenaH + fenceK + 0.15)), 14, 110);
  const fenceH = fenceK * S;
  const ox = box.x + (box.w - RULES.arenaW * S) / 2;
  const oy = box.y + fenceH + (box.h - (RULES.arenaH + fenceK + 0.15) * S) / 2;
  return { S, ox, oy, fenceH };
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 1;
  const short = !tall && H < 470;
  if (short) {
    // a phone on its side: a slim column on the left (the headline in the status card's corner), the arena right up to the top
    const colW = Math.min(W * 0.36, 280 * u);
    const status = { x: 10, y: TOP - 18, w: colW, h: Math.max(70, H - TOP - 74) };
    const boss = { x: 10, y: status.y + status.h + 6, w: colW, h: 22 * u };
    const box = { x: colW + 22, y: 30, w: W - colW - 30 - 56, h: H - 30 - 44 };
    const a = fit(box);
    return {
      w: W, h: H, u, mode: 'short', ...a, status, scoreX: 10 + colW - 4, scoreY: status.y, scoreInStatus: true,
      tipLines: 1, driveLines: 2, boss, pillX: 10, pillY: boss.y + boss.h + 6,
      hudBottom: 30, cardY: a.oy + RULES.arenaH * a.S * 0.3, areaX0: colW + 20,
    };
  }
  if (!tall && W >= 700) {
    // a column on the left (desktop), the arena on the right
    const colW = Math.min(W * 0.3, 330 * u);
    const status = { x: 12, y: TOP + 2, w: colW, h: Math.min(210 * u, H * 0.42) };
    const scoreX = colW + 12, scoreY = status.y + status.h + 8 * u;
    const boss = { x: 12, y: scoreY + 74 * u, w: colW, h: 30 * u };
    const pillY = boss.y + boss.h + 8 * u;
    const box = { x: colW + 28, y: TOP, w: W - colW - 40, h: H - TOP - BOTTOM };
    const a = fit(box);
    return {
      w: W, h: H, u, mode: 'wide', ...a, status, scoreX, scoreY, scoreInStatus: false,
      tipLines: 2, driveLines: 3, boss, pillX: 12, pillY,
      hudBottom: TOP, cardY: a.oy + RULES.arenaH * a.S * 0.38, areaX0: colW + 24,
    };
  }
  // upright or narrow: one full-width card with the headline in its corner, the dragon's bar under it
  const status = { x: 12, y: TOP + 2, w: W - 24, h: 150 * u };
  const boss = { x: 12, y: status.y + status.h + 6 * u, w: W - 24, h: 26 * u };
  const box = { x: 8, y: boss.y + boss.h + 2 * u, w: W - 16, h: H - (boss.y + boss.h + 2 * u) - BOTTOM };
  const a = fit(box);
  return {
    w: W, h: H, u, mode: 'tall', ...a, status, scoreX: W - 12 - 6 * u, scoreY: TOP + 2, scoreInStatus: true,
    tipLines: 2, driveLines: 3, boss, pillX: 14, pillY: a.oy + RULES.arenaH * a.S - 30 * u, hudBottom: boss.y + boss.h,
    cardY: a.oy + 60 * u, areaX0: 0,
  };
}
