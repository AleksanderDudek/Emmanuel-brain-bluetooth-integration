/**
 * Where Jerzy i smok's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12 and §9.4,
 * "Mobile first").  The runner's HUD covers the top of the canvas (`insets().top`), the phone's home
 * indicator its bottom, a notch the sides; the field runs under all of them, the game's own bits stay
 * inside.  One layout in three shapes:
 *
 *   phone  a phone held upright, the reference (360 × 500 with a 134 px HUD band): the knight in the
 *          middle of the band, the camera close (ten metres across); the status — hearts, the level
 *          and its bar, the build — in a band right under the HUD, the dragon's bar above it while
 *          he is around; the Miecz światła's dial, the one button, in the bottom-right thumb zone; the
 *          rest of the screen is the floating joystick's.  The level-up is a bottom sheet of three
 *          full-width cards.
 *   side   a phone on its side (one 68 px HUD row, the chart a column on the right): the knight in
 *          the middle, the status top left under the HUD row, the dragon's bar top right, the dial
 *          bottom right under the right thumb; cards in a row.
 *   wide   a tablet or a desktop: the phone's layout grown (u up to 1.2), cards in a row.
 *
 * Everything here is pure (tests run it at every kit/mobile CHECK_SIZES entry); the hud draws it.
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, uiScale } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { t } from './i18n';

export interface Rect { x: number; y: number; w: number; h: number }

export type Shape = 'phone' | 'side' | 'wide';

export interface Layout {
  w: number;
  h: number;
  /** what covers each edge (the runner's insets) */
  ins: Insets;
  /** the play band: under the HUD, over the home indicator, inside a notch */
  top: number;
  bottom: number;
  left: number;
  right: number;
  shape: Shape;
  /** the primary input is a finger (words and hints follow it) */
  touch: boolean;
  /** UI scale: 1 on any phone, up to 1.2 on a tablet or a desktop */
  u: number;
  /** px per u of the field, and where the knight stands (px) */
  s: number;
  kx: number;
  ky: number;
  /** the half-size of the field in sight (u) */
  halfW: number;
  halfH: number;
  /** the room above the knight up to the HUD (u): the dragon keeps his body under it */
  up: number;
  /** the status: hearts and level on one row (its middle y), the level's bar, the build's chips (their centre y and size) */
  stat: { x: number; w: number; rowY: number; heartR: number; xp: Rect; chipX: number; chipY: number; chip: number };
  /** how far the status moves down while the dragon's bar shows (phone and wide; 0 on its side) */
  statShift: number;
  /** the build's chips step aside while the dragon's bar shows (they share the band) */
  chipsYieldToBoss: boolean;
  /** the lowest y the status band reaches (bubbles and marks stay under it) */
  statBottom: number;
  /** the dragon's bar */
  boss: Rect;
  /** the Miecz światła's dial (centre, radius) and the rectangle a tap on it hits */
  sword: { x: number; y: number; r: number };
  swordHit: Rect;
  /** banners: above the knight, or under him while the runner's block banner is up */
  bannerY: number;
  bannerLowY: number;
}

/** The reshuffle button's width for its label at 14 px (from the label's length, so the sheet stays pure and the targets match it). */
const pillW = (rerolls: number): number => clamp(t('hud.reroll', { n: rerolls }).length * 6.8 + 38, 112, 168);

export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true): Layout {
  const ins = { ...insets };
  const top = clamp(ins.top || 64, 24, h * 0.55);
  ins.top = top;
  const left = Math.max(0, ins.left), right = w - Math.max(0, ins.right), bottom = h - Math.max(0, ins.bottom);
  const bw = right - left;
  const side = h < 470 && w > h * 1.3;
  const shape: Shape = side ? 'side' : w < 600 ? 'phone' : 'wide';
  const u = shape === 'wide' ? uiScale(w, h, 1.2) : 1;
  const m = 12 * u;
  // the field: close on a phone (ten metres across), the old desktop view grown on wider screens
  let s: number, ky: number;
  if (shape === 'phone') {
    s = clamp(bw / 10, 30, 44);
    ky = top + (bottom - top) * 0.5;
  } else if (shape === 'side') {
    s = clamp(Math.min(bw / 17, (bottom - top) / 8.2), 22, 40);
    ky = top + (bottom - top) * 0.54;
  } else {
    s = clamp(Math.min(w, h - top * 0.5) / 11, 30, 56);
    ky = top + (bottom - top) * 0.5;
  }
  const kx = (left + right) / 2;
  const halfW = Math.max(kx, w - kx) / s, halfH = Math.max(ky, h - ky) / s;
  // the dial: 60 px (69 px grown) in the bottom-right corner, 16 px in from the edge
  const r = 30 * Math.min(u, 1.15);
  const sword = { x: right - 22 - r, y: bottom - 18 - r, r };
  const swordHit = { x: sword.x - r - 6, y: sword.y - r - 6, w: 2 * r + 12, h: 2 * r + 12 };
  const y0 = top + 6 * u;
  const heartR = 7 * u, chip = 26 * u;
  if (shape === 'side') {
    // the status top left under the HUD row, the dragon's bar top right: the knight's field stays clear
    const sw = Math.min(290, bw * 0.46);
    const sx = left + m;
    const xp = { x: sx, y: y0 + 20, w: sw, h: 7 };
    const chipY = xp.y + xp.h + 6 + chip / 2;
    const bwide = Math.min(380, bw * 0.44);
    const boss = { x: right - m - bwide, y: y0, w: bwide, h: 28 };
    return {
      w, h, ins, top, bottom, left, right, shape, touch, u, s, kx, ky, halfW, halfH, up: (ky - top) / s,
      stat: { x: sx, w: sw, rowY: y0 + 9, heartR, xp, chipX: sx, chipY, chip },
      statShift: 0, chipsYieldToBoss: false, statBottom: chipY + chip / 2 + 4, boss, sword, swordHit,
      bannerY: chipY + chip / 2 + 30, bannerLowY: Math.min(ky + s * 1.8, bottom - 30),
    };
  }
  const sw = Math.min(bw - 2 * m, 560 * u);
  const sx = (left + right - sw) / 2;
  const xp = { x: sx, y: y0 + 20 * u, w: sw, h: 7 * u };
  const chipY = xp.y + xp.h + 6 * u + chip / 2;
  const boss = { x: sx, y: y0, w: sw, h: 28 * u };
  const statShift = boss.h + 6 * u;
  const statBottom = Math.max(chipY + chip / 2, xp.y + xp.h + statShift) + 4 * u;
  return {
    w, h, ins, top, bottom, left, right, shape, touch, u, s, kx, ky, halfW, halfH, up: (ky - top) / s,
    stat: { x: sx, w: sw, rowY: y0 + 9 * u, heartR, xp, chipX: sx, chipY, chip },
    statShift, chipsYieldToBoss: true, statBottom, boss, sword, swordHit,
    bannerY: statBottom + 30 * u, bannerLowY: Math.min(ky + s * 2, swordHit.y - 22),
  };
}

/** The level-up's sheet: the title row (with Linda's reshuffle), the cards, the desktop's hint line. */
export interface Sheet {
  /** stacked full-width cards (a phone upright), or a row */
  stacked: boolean;
  head: Rect;
  cards: Rect[];
  reroll: Rect | null;
  /** the hint line's y (desktop only), or null */
  hintY: number | null;
}

/**
 * Where the level-up's cards go: on a phone upright a bottom sheet in the thumb zone — the title and
 * the reshuffle on one row, then three stacked full-width cards; elsewhere a row of three under the
 * title (anchored low for a finger, centred for a mouse).  `rerolls`: reshuffles left.
 */
export function sheet(L: Layout, n: number, rerolls: number): Sheet {
  const u = L.u, headH = 44 * u;
  const yTop = L.top + 6 * u;
  const pw = pillW(rerolls) * u;
  const pill = (x: number, y: number): Rect | null => (rerolls > 0 ? { x: x - pw, y, w: pw, h: headH } : null);
  if (L.shape === 'phone') {
    const gap = 8, x = L.left + 16, cw = L.right - L.left - 32;
    const yEnd = L.bottom - 10;
    const ch = clamp((yEnd - yTop - headH - gap - (n - 1) * gap) / n, 76, 118);
    const total = headH + gap + n * ch + (n - 1) * gap;
    const y0 = Math.max(yTop, yEnd - total);
    const cards = Array.from({ length: n }, (_, i) => ({ x, y: y0 + headH + gap + i * (ch + gap), w: cw, h: ch }));
    return { stacked: true, head: { x, y: y0, w: cw, h: headH }, cards, reroll: pill(x + cw, y0), hintY: null };
  }
  const gap = (L.shape === 'side' ? 10 : 16) * u;
  const hint = !L.touch;
  const hintH = hint ? 26 * u : 0;
  const cw = Math.min(250 * u, (L.right - L.left - 32 - (n - 1) * gap) / n);
  const yEnd = L.bottom - 10 * u - hintH;
  const ch = Math.max(120, Math.min(L.shape === 'side' ? 220 : 236 * u, yEnd - yTop - headH - gap));
  const total = headH + gap + ch;
  // a finger reaches the low part; a mouse reads the middle
  const y0 = Math.max(yTop, L.touch ? yEnd - total : (yTop + yEnd - total) / 2);
  const rowW = n * cw + (n - 1) * gap;
  const x0 = (L.left + L.right - rowW) / 2;
  const cards = Array.from({ length: n }, (_, i) => ({ x: x0 + i * (cw + gap), y: y0 + headH + gap, w: cw, h: ch }));
  return { stacked: false, head: { x: x0, y: y0, w: rowW, h: headH }, cards, reroll: pill(x0 + rowW, y0), hintY: hint ? y0 + total + 17 * u : null };
}

/** The run's tally card and its "next run" button: a column on a phone upright, two columns on its side. */
export function tallyBox(L: Layout, bars: number): { box: Rect; btn: Rect; cols: boolean } {
  const u = L.u, cols = L.shape === 'side';
  const w = Math.min(L.right - L.left - 24, (cols ? 560 : 420) * u);
  const room = L.bottom - L.top - 12;
  const h = Math.min(room, cols ? 250 : (232 + bars * 24 + (bars ? 20 : 0)) * u);
  const x = (L.left + L.right - w) / 2;
  const y = L.top + 6 + Math.max(0, (room - h) / 2);
  const bwid = Math.min(260 * u, w - 40);
  const bh = 46 * u;
  return { box: { x, y, w, h }, btn: { x: x + (w - bwid) / 2, y: y + h - 12 * u - bh, w: bwid, h: bh }, cols };
}
