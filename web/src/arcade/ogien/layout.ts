/**
 * Where Ogień, ogień, ogień's view puts things (CSS px), mobile first (DESIGN §12, §13.6 "Mobile first").  The
 * runner's HUD covers the top of the canvas (`insets().top`), a phone's home indicator or notch the other
 * edges; the scene runs under them all, the controls and the words stay inside.  Sizes start from a 360 px
 * phone at u = 1 (kit/mobile `uiScale`) and grow to 1.3 on a tablet or a desktop.
 *
 *   tall  (a phone upright, a tablet upright)  the fire and its ring in the middle of the band; Ignacy's bubble
 *         under the HUD; the thumb zone: the scale's button bottom right (a pill, 56 px), the bonfire's pile of
 *         logs bottom left; cards rise as a sheet from the bottom
 *   short (a phone on its side)  the fire left of the middle, the button and the pile under the thumbs at the
 *         bottom corners, cards in the column right of the ring
 *   wide  (desktops, tablets on their side)  the fire in the middle, the button bottom right, cards right of the ring
 *
 * The scene's own coordinates are units of the ring's radius around the fire (rules.ts): `L.R` px a unit.
 * Everything the player taps is a rectangle here (`tapTargets`), the same ones the view hit-tests and the mobile
 * audit checks: at least MIN_TAP on the short side, apart from each other, inside the insets.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';

export type { Rect };
export type Mode = 'tall' | 'short' | 'wide';

export interface Layout {
  w: number;
  h: number;
  mode: Mode;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  ins: Insets;
  /** the HUD's lower edge and the band's lower edge */
  top: number;
  bottom: number;
  /** nothing to press this close to the side edges */
  edge: number;
  /** the fire's centre and the ring's radius (px per unit) */
  cx: number;
  cy: number;
  R: number;
  /** the scale's button (the primary action: blow, shield, add a log, light, fuse, gather, pass on) */
  btn: Rect;
  /** the bonfire's pile of logs */
  pile: Rect;
  /** the ladder of seven fires down the left edge: its x, its first and last glyph's y, a glyph's radius */
  ladder: { x: number; y0: number; y1: number; r: number };
  /** Ignacy's bubble: its top left and widest */
  bubble: { x: number; y: number; maxW: number };
  /** where cards go: a sheet from the bottom on a phone upright, else a column right of the ring */
  card: Rect;
  anchor: 'bottom' | 'side';
  /** words under the ring (the breath, the smoke): their baseline's y */
  under: number;
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const mode: Mode = W / H < 0.9 ? 'tall' : H < 460 ? 'short' : 'wide';
  const u = uiScale(W, H);
  const top = clamp(insets.top, 0, H * 0.6);
  const ins: Insets = { top, right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left) };
  const bottom = H - ins.bottom;
  const band = bottom - top;
  // nothing to press in the outer 16 px of a phone (the back swipe, a thumb's reach)
  const edge = W < 600 ? 16 : Math.round(24 * u);
  const x0 = ins.left + edge, x1 = W - ins.right - edge;
  const bh = Math.round(56 * u);
  const bw = Math.round(clamp((x1 - x0) * 0.5, 140, 210 * u));
  const pad = Math.round(12 * u);
  const btn: Rect = { x: x1 - bw, y: bottom - pad - bh, w: bw, h: bh };
  const pw = Math.round(clamp(108 * u, 96, 150)), ph = Math.round(clamp(64 * u, 56, 84));
  let pile: Rect = { x: x0 + Math.round(22 * u), y: bottom - pad - ph, w: pw, h: ph };
  let cx: number, cy: number, R: number, card: Rect, anchor: Layout['anchor'];
  const lr = Math.round(6 * u);
  if (mode === 'tall') {
    const avail = Math.max(120, btn.y - Math.round(8 * u) - top);
    R = Math.round(clamp(Math.min((x1 - x0) * 0.38, avail * 0.33), 70, 300));
    cx = (ins.left + W - ins.right) / 2;
    cy = Math.round(top + avail * 0.52);
    // a sheet up to ~¾ of the band (a card waits for a tap or a few seconds), never under 220 px where it fits
    const ch = Math.round(Math.max(Math.min(220, band - 20), Math.min(band * 0.74, 400 * u)));
    card = { x: x0, y: bottom - Math.round(8 * u) - ch, w: x1 - x0, h: ch };
    anchor = 'bottom';
  } else if (mode === 'short') {
    R = Math.round(clamp(Math.min(band * 0.35, (W - ins.left - ins.right) * 0.19), 70, 220));
    cx = Math.round(ins.left + (W - ins.left - ins.right) * 0.4);
    cy = Math.round(top + band * 0.48);
    const cardX = Math.round(cx + R + 14 * u);
    card = { x: cardX, y: top + Math.round(8 * u), w: Math.max(200, x1 - cardX), h: band - Math.round(16 * u) };
    anchor = 'side';
    pile = { x: x0 + Math.round(22 * u), y: bottom - pad - ph, w: pw, h: ph };
  } else {
    R = Math.round(clamp(Math.min(band * 0.33, W * 0.19), 80, 260));
    cx = Math.round((ins.left + W - ins.right) / 2);
    cy = Math.round(top + band * 0.5);
    const cardX = Math.round(cx + R + 40 * u);
    const cw = Math.min(x1 - cardX, Math.round(420 * u));
    const chh = Math.min(band - Math.round(24 * u), Math.round(420 * u));
    card = { x: cardX, y: Math.round(top + (band - chh) / 2), w: Math.max(220, cw), h: chh };
    anchor = 'side';
  }
  const lsp = Math.round(clamp(Math.min(22 * u, (band - 40) / 8), 14, 30));
  const ladder = { x: ins.left + Math.round(10 * u) + lr, y0: cy - lsp * 3, y1: cy + lsp * 3, r: lr };
  const bubble = {
    x: ins.left + edge + Math.round(10 * u),
    y: top + Math.round(6 * u),
    maxW: mode === 'tall' ? x1 - x0 - Math.round(10 * u) : Math.round(Math.min(W * 0.46, 480 * u)),
  };
  const under = Math.round(Math.min(cy + R + 22 * u, btn.y - 10 * u));
  return { w: W, h: H, mode, u, ins, top, bottom, edge, cx, cy, R, btn, pile, ladder, bubble, card, anchor, under };
}

/** What can be tapped right now: a card (alone, it covers the controls), else the button and, at the bonfire, the pile. */
export interface TargetState {
  card: Rect | null;
  pile: boolean;
}

/** The tappable rectangles for `ArcadeGame.targets()`, as the view hit-tests them. */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.card) return [{ label: 'card', ...s.card }];
  const out: TapTarget[] = [{ label: 'act', ...L.btn }];
  if (s.pile) out.push({ label: 'pile', ...L.pile });
  return out.map(t => (Math.min(t.w, t.h) < MIN_TAP ? { ...t, w: Math.max(t.w, MIN_TAP), h: Math.max(t.h, MIN_TAP) } : t));
}

/** Whether (x, y) lands in `r`. */
export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
