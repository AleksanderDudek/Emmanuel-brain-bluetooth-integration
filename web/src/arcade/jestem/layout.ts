/**
 * Where Ja jestem… puts things (CSS px), mobile first (DESIGN §12, §13.8).  The runner's HUD covers the top
 * of the canvas (`insets().top`), a phone's home indicator or notch the other edges; the window — the
 * play itself, a free play area (tap a cell, drag a path) — takes the band between them:
 *
 *   tall  (a phone upright, a tablet upright)  the window as large as the band allows, centred, the
 *         oculus (the gauge) set into its arch; Hanna's bubble in the sky under the oculus; the opening
 *         card a bottom sheet in the thumb zone; in the finale the window rises and shrinks, and the
 *         declaration is written under it
 *
 * The window's shape (round 11): a declaration's arched window (600 × 700), or an own photo's own rectangle at
 * its aspect (9:16…16:9) in a thin gallery frame, its gauge a small ring medallion on the frame's top-left
 * corner instead of a rose in the arch.  The "what to do now" line (`now`) sits under the window where there is
 * room for it, else as a subtitle over the window's bottom edge.
 *   wide  (a phone on its side, a desktop)  the window left of centre, a column on the right for the
 *         picture's words (its declaration, its fragments) and, in the finale, the declaration and verse
 *   desk  (wide, with a mouse on a desktop or a big screen, kit/mobile `screenKind`, DESIGN §14)  the window
 *         at the band's full height and the column beside it at a reading measure, centred as one group (the
 *         window still under the middle of the canvas, where a centre click lands); the words grow with the
 *         screen (`tu`) instead of stopping at a phone's 1.2
 *
 * The only things to tap besides the window are on the opening card (any tap closes it; in Polish two
 * buttons answer "jestem silny / jestem silna"): `tapTargets` lists them for the mobile audit.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, screenKind, uiScale, type Rect, type ScreenKind } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';
import type { Shape } from './vision';

export type { Rect };
export type Mode = 'tall' | 'wide';

/** A declaration's arched window: width / height. */
export const ASPECT = RULES.PW / RULES.PH;

/** The picture a layout is for: its shape and its space (picture units: a declaration's 600 × 700, a photo's own). */
export interface PicShape { shape: Shape; w: number; h: number }
export const ARCH: PicShape = { shape: 'arch', w: RULES.PW, h: RULES.PH };

export interface Layout {
  w: number;
  h: number;
  mode: Mode;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop, up to DESK_MAX on a big screen */
  u: number;
  /** the kind of screen (kit/mobile `screenKind`) and whether it is laid out for a mouse (`desk`, see above) */
  kind: ScreenKind;
  desk: boolean;
  ins: Insets;
  /** the band between the HUD and the bottom edge */
  band: Rect;
  /** the window's shape and aspect */
  shape: Shape;
  aspect: number;
  /** the window's rectangle (the picture's space stretched over it) and px per picture unit */
  win: Rect;
  k: number;
  /** the gauge: the oculus set into the arch's crown, or a photo's ring on its frame's top-left corner */
  oculus: { x: number; y: number; r: number };
  /**
   * the "what to do now" line: centred on `cx`, at most `maxW` wide, one line `h1` tall; its top at `y`
   * (`anchor` top: under the window) or its bottom at `y` (bottom: a subtitle over the window's lower edge)
   */
  now: { cx: number; y: number; maxW: number; h1: number; anchor: 'top' | 'bottom' };
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
const winRect = (cx: number, top: number, hh: number, aspect = ASPECT): Rect => ({ x: cx - (hh * aspect) / 2, y: top, w: hh * aspect, h: hh });

/** The largest window of `aspect` within maxW × maxH, centred on cx, its top at `top`. */
const fitWin = (cx: number, top: number, maxW: number, maxH: number, aspect: number): Rect => {
  let hh = Math.max(1, maxH);
  if (hh * aspect > maxW) hh = Math.max(1, maxW) / aspect;
  return winRect(cx, top, hh, aspect);
};

/**
 * A text size's scale: a phone's words stop growing at `cap` (they were sized for a phone held close); a
 * desktop's grow with the screen (read from further away).
 */
export const tu = (L: Pick<Layout, 'u' | 'desk'>, cap: number): number => (L.desk ? L.u : Math.min(L.u, cap));

export function layout(w: number, h: number, ins: Insets = NO_INSETS, touch = true, pic: PicShape = ARCH): Layout {
  const { shape } = pic;
  const aspect = clamp(pic.w / Math.max(1, pic.h), RULES.aspectMin, RULES.aspectMax);
  const u = uiScale(w, h);
  const band: Rect = { x: ins.left, y: ins.top, w: Math.max(1, w - ins.left - ins.right), h: Math.max(1, h - ins.top - ins.bottom) };
  const mode: Mode = band.w > band.h * 1.18 ? 'wide' : 'tall';
  const kind = screenKind(w, h, touch);
  const desk = mode === 'wide' && (kind === 'desktop' || kind === 'big');
  const r = clamp(Math.min(band.w, band.h) * 0.06, 15, 30) * u;
  const topPad = r + 6, botPad = 8 * u;
  let win: Rect;
  let side: Rect | null = null;
  if (desk) {
    // the window at the band's full height, the column beside it at a reading measure (about 18 of the
    // declaration's ems), both centred as one group — but the window keeps the canvas's middle (a centre
    // click lands on it); a wide photo leaves the column its least and stands in the band's middle
    const avail = band.h - topPad - botPad;
    const gap = Math.round(28 * u), edge = Math.round(16 * u);
    let hh = avail, ww = hh * aspect;
    const maxW = band.w - 2 * edge - gap - 190 * u;
    if (ww > maxW) { ww = maxW; hh = ww / aspect; }
    const colW = Math.round(clamp(band.w - 2 * edge - gap - ww, 190 * u, 18 * 15 * u));
    const group = ww + gap + colW;
    let x0 = band.x + Math.max(edge, (band.w - group) / 2);
    const mid = band.x + band.w / 2;
    if (x0 + ww < mid + 40 * u) x0 = Math.min(band.x + band.w - edge - group, mid + 40 * u - ww);
    win = { x: x0, y: band.y + topPad + (avail - hh) / 2, w: ww, h: hh };
    side = { x: x0 + ww + gap, y: band.y + 8, w: colW, h: band.h - 16 };
  } else if (mode === 'tall') {
    const hh0 = band.h - topPad - botPad;
    const wn = fitWin(band.x + band.w / 2, 0, band.w - 20, hh0, aspect);
    const extra = hh0 - wn.h;
    win = { ...wn, y: band.y + topPad + extra * 0.35 };
  } else {
    // the window in the middle (where a thumb or a centre tap finds it); a column on its right when one fits,
    // else the window shifts left just enough to make room for it; a wide photo on a big touch screen leaves
    // the column its room (a phone on its side keeps the photo as large as it can)
    const colMin = 190 * u, gap = 24 * u, edge = 16 * u;
    let hh = band.h - topPad - botPad;
    const maxW = band.w >= 1000 ? band.w - 2 * edge - gap - colMin - 1 : band.w - 32;
    if (hh * aspect > maxW) hh = maxW / aspect;
    const ww = hh * aspect;
    let cx = band.x + band.w / 2;
    const right = band.x + band.w - edge - (cx + ww / 2 + gap);
    if (right < colMin) {
      const shift = Math.min(colMin - right, cx - ww / 2 - band.x - edge);
      if (right + shift >= colMin - 0.5) cx -= shift;
    }
    win = winRect(cx, band.y + topPad + (band.h - topPad - botPad - hh) / 2, hh, aspect);
    const x0 = win.x + win.w + gap;
    if (band.x + band.w - edge - x0 >= colMin - 0.5) side = { x: x0, y: band.y + 8, w: Math.min(band.x + band.w - edge - x0, 460 * u), h: band.h - 16 };
  }
  const k = win.w / Math.max(1, pic.w);
  // the gauge: a rose in the arch's crown; a photo's ring on its frame's top-left corner (kept on the screen)
  const oculus = shape === 'arch'
    ? { x: win.x + win.w / 2, y: win.y + r * 0.15, r }
    : { x: Math.max(win.x + r * 0.15, band.x + r * 1.3 + 4), y: win.y + r * 0.15, r };
  const bubble = { x: win.x + win.w / 2, y: win.y + r * 1.15 + 8, maxW: Math.min(win.w - 16, 400 * u) };
  // the "what to do now" line: under the window where two lines fit, else a subtitle over its lower edge
  const nowPx = 14 * (desk ? u : Math.min(u, 1.15));
  const h1 = Math.round(nowPx * 1.35 + 14);
  // (a narrow window — a tall photo — lets the line reach past its sides, never into the column beside it)
  const room = band.y + band.h - (win.y + win.h);
  const below = room >= 2 * nowPx * 1.35 + 14 + 12;
  const left = band.x + 12, right = (side ? side.x - 12 : band.x + band.w - 12);
  const nowW = Math.min(right - left, below ? Math.max(win.w, 340 * u) : Math.min(460 * u, Math.max(win.w - 12, win.w < 260 * u ? 300 * u : 0)));
  const nowCx = clamp(win.x + win.w / 2, left + nowW / 2, right - nowW / 2);
  const now = below
    ? { cx: nowCx, y: win.y + win.h + 6, maxW: nowW, h1, anchor: 'top' as const }
    : { cx: nowCx, y: win.y + win.h - 8, maxW: nowW, h1, anchor: 'bottom' as const };
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
    finWin = fitWin(band.x + band.w / 2, band.y + topPad, band.w - 20, Math.min(win.h, (band.h - topPad) * 0.58), aspect);
    const ty = finWin.y + finWin.h + 16 * u;
    finText = { x: band.x + 14, y: ty, w: band.w - 28, h: Math.max(60, band.y + band.h - ty - 6) };
  } else if (side) {
    finWin = win;
    finText = { x: side.x, y: band.y + 8, w: side.w, h: band.h - 16 };
  } else {
    finWin = fitWin(band.x + band.w / 2, band.y + topPad, band.w - 32, Math.min(win.h, (band.h - topPad) * 0.62), aspect);
    const ty = finWin.y + finWin.h + 8;
    finText = { x: band.x + 16, y: ty, w: band.w - 32, h: Math.max(50, band.y + band.h - ty - 6) };
  }
  return { w, h, mode, u, kind, desk, ins, band, shape, aspect, win, k, oculus, now, bubble, side, card, anchor, finWin, finText };
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
export function introWindow(w: number, h: number, aspect = ASPECT): Rect {
  const hh = clamp(h * 0.3, 90, 300);
  return fitWin(w / 2, Math.max(8, h * 0.035), w * 0.86, hh * Math.min(1, Math.sqrt(ASPECT / aspect)), aspect);
}

/** The lobby hero's window and the card art's: right of the text on a wide hero, centred on a narrow one. */
export function heroWindow(w: number, h: number, aspect = ASPECT): Rect {
  // a phone's hero: the title takes its lower half on the left, so the window stands above it, right of centre;
  // a wider hero: the window right of the title (a wide photo keeps within the hero's right part)
  const k = Math.min(1, Math.sqrt(ASPECT / aspect));
  if (w < 560) return fitWin(w * 0.68, h * 0.05, w * 0.6, h * 0.52 * k, aspect);
  if (w > h * 1.4) return fitWin(w * 0.72, h * 0.06, w * 0.5, h * 0.76 * k, aspect);
  return fitWin(w * 0.7, h * 0.06, w * 0.56, h * 0.7 * k, aspect);
}
