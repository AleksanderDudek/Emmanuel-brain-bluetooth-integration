/**
 * Where Ja jestem… puts things (CSS px), mobile first (DESIGN §12, §13.8).  The runner's HUD covers the top
 * of the canvas (`insets().top`), a phone's home indicator or notch the other edges; the window — the
 * play itself, a free play area (tap a cell, drag a path) — takes the band between them:
 *
 *   tall  (a phone upright, a tablet upright)  the window as large as the band allows, centred, the
 *         oculus (the gauge) set into its arch; Hanna's bubble in the sky under the oculus; the opening
 *         card a bottom sheet in the thumb zone; in the finale the window rises and shrinks, and the
 *         declaration is written under it
 *   wide  (a phone on its side, a desktop)  the window left of centre, a column on the right for the
 *         picture's words (its declaration, its fragments) and, in the finale, the declaration and verse
 *
 * The only things to tap besides the window are on the opening card (any tap closes it; in Polish two
 * buttons answer "jestem silny / jestem silna"): `tapTargets` lists them for the mobile audit.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';

export type { Rect };
export type Mode = 'tall' | 'wide';

export const ASPECT = RULES.PW / RULES.PH;

export interface Layout {
  w: number;
  h: number;
  mode: Mode;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  ins: Insets;
  /** the band between the HUD and the bottom edge */
  band: Rect;
  /** the window's rectangle (the picture's PW × PH stretched over it) and px per picture unit */
  win: Rect;
  k: number;
  /** the oculus: the gauge set into the arch's crown */
  oculus: { x: number; y: number; r: number };
  /** Hanna's bubble: its top centre and its widest */
  bubble: { x: number; y: number; maxW: number };
  /** the column beside the window (wide only) */
  side: Rect | null;
  /** the opening card: a bottom sheet on a phone upright, else centred */
  card: Rect;
  anchor: 'bottom' | 'center';
  /** the finale: where the window goes, and the declaration's box */
  finWin: Rect;
  finText: Rect;
}

/** The window of height `hh` centred on (cx, top…) — width from the aspect. */
const winRect = (cx: number, top: number, hh: number): Rect => ({ x: cx - (hh * ASPECT) / 2, y: top, w: hh * ASPECT, h: hh });

export function layout(w: number, h: number, ins: Insets = NO_INSETS): Layout {
  const u = uiScale(w, h);
  const band: Rect = { x: ins.left, y: ins.top, w: Math.max(1, w - ins.left - ins.right), h: Math.max(1, h - ins.top - ins.bottom) };
  const mode: Mode = band.w > band.h * 1.18 ? 'wide' : 'tall';
  const r = clamp(Math.min(band.w, band.h) * 0.06, 15, 30) * u;
  const topPad = r + 6, botPad = 8 * u;
  let win: Rect;
  let side: Rect | null = null;
  if (mode === 'tall') {
    let hh = band.h - topPad - botPad;
    if (hh * ASPECT > band.w - 20) hh = (band.w - 20) / ASPECT;
    const extra = band.h - topPad - botPad - hh;
    win = winRect(band.x + band.w / 2, band.y + topPad + extra * 0.35, hh);
  } else {
    const hh = band.h - topPad - botPad;
    const ww = hh * ASPECT;
    // the window in the middle (where a thumb or a centre tap finds it); a column on its right when one fits,
    // else the window shifts left just enough to make room for it
    const colMin = 190 * u, gap = 24 * u, edge = 16 * u;
    let cx = band.x + band.w / 2;
    const right = band.x + band.w - edge - (cx + ww / 2 + gap);
    if (right < colMin) {
      const shift = Math.min(colMin - right, cx - ww / 2 - band.x - edge);
      if (right + shift >= colMin) cx -= shift;
    }
    win = winRect(cx, band.y + topPad, hh);
    const x0 = win.x + win.w + gap;
    if (band.x + band.w - edge - x0 >= colMin - 0.5) side = { x: x0, y: band.y + 8, w: Math.min(band.x + band.w - edge - x0, 460 * u), h: band.h - 16 };
  }
  const k = win.w / RULES.PW;
  const oculus = { x: win.x + win.w / 2, y: win.y + r * 0.15, r };
  const bubble = { x: win.x + win.w / 2, y: oculus.y + r + 8, maxW: Math.min(win.w - 16, 400 * u) };
  // the opening card
  let card: Rect, anchor: Layout['anchor'];
  if (mode === 'tall') {
    const cw = Math.min(band.w - 24, 460 * u);
    const ch = Math.min(band.h - 16, 420 * u);
    card = { x: band.x + (band.w - cw) / 2, y: band.y + band.h - ch - 8, w: cw, h: ch };
    anchor = 'bottom';
  } else {
    const cw = Math.min(band.w - 32, 520 * u), ch = Math.min(band.h - 16, 360 * u);
    card = { x: band.x + (band.w - cw) / 2, y: band.y + (band.h - ch) / 2, w: cw, h: ch };
    anchor = 'center';
  }
  // the finale: tall — the window rises and shrinks over the declaration; wide — it stays, the words beside it
  let finWin: Rect, finText: Rect;
  if (mode === 'tall') {
    const hh = Math.min(win.h, (band.h - topPad) * 0.58);
    finWin = winRect(band.x + band.w / 2, band.y + topPad, hh);
    const ty = finWin.y + finWin.h + 16 * u;
    finText = { x: band.x + 14, y: ty, w: band.w - 28, h: Math.max(60, band.y + band.h - ty - 6) };
  } else if (side) {
    finWin = win;
    finText = { x: side.x, y: band.y + 8, w: side.w, h: band.h - 16 };
  } else {
    const hh = Math.min(win.h, (band.h - topPad) * 0.62);
    finWin = winRect(band.x + band.w / 2, band.y + topPad, hh);
    const ty = finWin.y + finWin.h + 8;
    finText = { x: band.x + 16, y: ty, w: band.w - 32, h: Math.max(50, band.y + band.h - ty - 6) };
  }
  return { w, h, mode, u, ins, band, win, k, oculus, bubble, side, card, anchor, finWin, finText };
}

/** The opening card's two answers (Polish only): side by side along the card's bottom, finger-sized. */
export function formButtons(L: Layout, card: Rect = L.card): [Rect, Rect] {
  const gap = 10, pad = 14;
  const bh = Math.max(MIN_TAP + 4, 50 * L.u);
  const bw = (card.w - 2 * pad - gap) / 2;
  const y = card.y + card.h - pad - bh;
  return [{ x: card.x + pad, y, w: bw, h: bh }, { x: card.x + pad + bw + gap, y, w: bw, h: bh }];
}

/** The window's rectangle at a moment of the finale (k: 0 = in play, 1 = risen). */
export function windowAt(L: Layout, k: number): Rect {
  const e = clamp(k);
  const a = L.win, b = L.finWin;
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
}

/** Every control the player can tap now: the card's answers (the free play area — the window — is not a target). */
export function tapTargets(L: Layout, s: { card: 'story' | 'ask' | null; cardBox?: Rect }): TapTarget[] {
  if (s.card !== 'ask') return [];
  const [a, b] = formButtons(L, s.cardBox ?? L.card);
  return [{ label: 'form: m', ...a }, { label: 'form: f', ...b }];
}

/** The intro's window (calibration): high on the canvas, where the runner's card leaves room. */
export function introWindow(w: number, h: number): Rect {
  const hh = clamp(h * 0.3, 90, 300);
  return winRect(w / 2, Math.max(8, h * 0.035), hh);
}

/** The lobby hero's window and the card art's: right of the text on a wide hero, centred on a narrow one. */
export function heroWindow(w: number, h: number): Rect {
  // a phone's hero: the title takes its lower half on the left, so the window stands above it, right of centre;
  // a wider hero: the window right of the title
  if (w < 560) return winRect(w * 0.68, h * 0.05, h * 0.52);
  if (w > h * 1.4) return winRect(w * 0.72, h * 0.06, h * 0.76);
  return winRect(w * 0.7, h * 0.06, h * 0.7);
}
