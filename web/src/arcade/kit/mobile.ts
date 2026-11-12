/**
 * Mobile first (src/arcade/DESIGN.md §12).  Every arcade game is designed for a phone held upright first — a
 * 360 × 640 canvas is the smallest it must play well on, one thumb is all the player has — and grows
 * from there to a phone on its side, a tablet and a desktop.  The numbers every game keeps to:
 *
 *   MIN_TAP   44 px   the short side of anything the player taps (Apple's 44 pt; Material asks 48 dp)
 *   TAP_GAP    6 px   between two neighbouring targets, so a thumb does not press both
 *   MIN_TEXT  11 px   the smallest canvas text of any kind (a tag on a dial, a unit, a count)
 *   MIN_READ  13 px   text the player must read to play (a card, a bubble, a button's label)
 *   THUMB     0.45    the bottom share of an upright phone a thumb reaches without shifting the grip:
 *                     the controls a game asks for again and again live there
 *
 * The runner keeps its own things out of the thumb zone (its HUD is at the top, the simulator's switch
 * in the top bar), so a game's `insets().bottom` is only the phone's home indicator.
 */
import { clamp } from './juice';
import type { Insets, TapTarget } from './types';

export const MIN_TAP = 44;
export const TAP_GAP = 6;
export const MIN_TEXT = 11;
export const MIN_READ = 13;
export const THUMB = 0.45;

export interface Rect { x: number; y: number; w: number; h: number }

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * A UI scale for a canvas of w × h CSS px that starts from the phone: 1 for anything up to a phone's
 * 390 px short side (upright or on its side), growing to `max` on a tablet or a desktop.  Size the
 * play's UI for 1 and it is readable and tappable on the smallest phone; never scale below 1.
 */
export function uiScale(w: number, h: number, max = 1.3): number {
  return clamp(Math.min(w, h) / 390, 1, max);
}

/** A rectangle grown around its centre to at least `min` on each side (a small icon keeps a finger-sized target). */
export function hitRect(r: Rect, min = MIN_TAP): Rect {
  const w = Math.max(r.w, min), h = Math.max(r.h, min);
  return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
}

/** Whether (x, y) lands on `r` grown to a finger-sized target. */
export function hits(r: Rect, x: number, y: number, min = MIN_TAP): boolean {
  const g = hitRect(r, min);
  return x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h;
}

/** A target for `ArcadeGame.targets()`: the hit rectangle as the game tests it. */
export function target(label: string, r: Rect, min = MIN_TAP): TapTarget {
  const g = hitRect(r, min);
  return { label, x: g.x, y: g.y, w: g.w, h: g.h };
}

/**
 * Set `ctx.font` so `text` fits `maxW`: from `px` down to `min`, then cut with an ellipsis.  Returns
 * the text to draw.  `family` as in a CSS font shorthand.
 */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight: number, family: string, min = MIN_TEXT): string {
  let size = Math.max(min, px);
  ctx.font = `${weight} ${size}px ${family}`;
  let w = ctx.measureText(text).width;
  if (w > maxW && size > min) {
    size = Math.max(min, Math.floor(size * maxW / w * 10) / 10);
    ctx.font = `${weight} ${size}px ${family}`;
    w = ctx.measureText(text).width;
  }
  if (w <= maxW || !text) return text;
  // still too long at the smallest size: cut it, keeping as much as fits with "…"
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo).trimEnd()}…` : '';
}

/** Whether the primary pointer is a finger (a phone, a tablet), as CSS `pointer: coarse` says. */
export function coarsePointer(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * The device's safe areas (CSS `env(safe-area-inset-*)`), read through a probe element in `host`:
 * the notch, the rounded corners, the home indicator.  Zero on a desktop and in tests.
 */
export function safeAreas(host: HTMLElement): Insets {
  const probe = document.createElement('div');
  probe.className = 'safe-probe';
  host.append(probe);
  try {
    const cs = getComputedStyle(probe);
    const px = (v: string) => (Number.isFinite(parseFloat(v)) ? Math.max(0, parseFloat(v)) : 0);
    return { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  } finally {
    probe.remove();
  }
}

/**
 * The mobile-first checks on a game's targets for a canvas of w × h with these insets, in plain words
 * (empty: all good): each target at least `min` on its short side, inside the canvas and the insets,
 * and no two overlapping.  For tests and the mobile audit.
 */
export function auditTargets(targets: readonly TapTarget[], w: number, h: number, ins: Insets, min = MIN_TAP): string[] {
  const out: string[] = [];
  const r1 = (v: number) => Math.round(v);
  for (const t of targets) {
    if (Math.min(t.w, t.h) < min - 0.5) out.push(`"${t.label}" is ${r1(t.w)}×${r1(t.h)} px (under ${min})`);
    if (t.x < ins.left - 0.5 || t.x + t.w > w - ins.right + 0.5 || t.y < ins.top - 0.5 || t.y + t.h > h - ins.bottom + 0.5) {
      out.push(`"${t.label}" at ${r1(t.x)},${r1(t.y)} ${r1(t.w)}×${r1(t.h)} leaves the safe play area (${r1(ins.left)}..${r1(w - ins.right)} × ${r1(ins.top)}..${r1(h - ins.bottom)})`);
    }
  }
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i], b = targets[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) out.push(`"${a.label}" and "${b.label}" overlap by ${r1(ox)}×${r1(oy)} px`);
    }
  }
  return out;
}

/**
 * The canvases every game is checked at (tests, the layout of each game): CSS px after the browser's bars
 * and the signal dock, with the insets the runner reports there (measured with scripts/arcade-mobile.mjs).
 * The first is the hardest: a small Android phone upright leaves a 360 × 366 band between the HUD and the
 * dock.
 */
export const CHECK_SIZES: readonly { name: string; w: number; h: number; insets: Insets }[] = [
  { name: 'small phone (Chrome)', w: 360, h: 500, insets: { top: 134, right: 0, bottom: 0, left: 0 } },
  { name: 'iPhone (Safari)', w: 390, h: 564, insets: { top: 134, right: 0, bottom: 0, left: 0 } },
  { name: 'iPhone (installed app, chart off)', w: 390, h: 844, insets: { top: 173, right: 0, bottom: 34, left: 0 } },
  { name: 'large phone (Chrome)', w: 412, h: 680, insets: { top: 134, right: 0, bottom: 0, left: 0 } },
  { name: 'phone on its side (chart on)', w: 601, h: 360, insets: { top: 68, right: 0, bottom: 0, left: 0 } },
  { name: 'phone on its side (installed app, chart off)', w: 844, h: 390, insets: { top: 68, right: 47, bottom: 21, left: 47 } },
  { name: 'tablet', w: 820, h: 1052, insets: { top: 192, right: 0, bottom: 0, left: 0 } },
  { name: 'desktop', w: 1280, h: 672, insets: { top: 192, right: 0, bottom: 0, left: 0 } },
  { name: 'desktop (chart off)', w: 1280, h: 800, insets: { top: 192, right: 0, bottom: 0, left: 0 } },
];
