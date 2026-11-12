/**
 * Where Anioł Stróż's play view puts things (CSS px), mobile first (DESIGN §8.2 "Mobile first", §12).  The
 * runner's HUD covers the top of the canvas (`insets().top`), a phone's home indicator or notch the other
 * edges; the game owns the rest, the bottom included.  Sizes start from a 360 px phone at u = 1 (kit/mobile
 * `uiScale`) and grow to 1.3 on a tablet or a desktop.
 *
 *   tall   a phone upright, a tablet upright: the window (the band's last 40 s in its sky, a star a second
 *          on its sill) and the night's feather bar right under the HUD — the window takes the height the
 *          room does not need; the room under them, zoomed so that the Zmory step in from beyond the
 *          screen's edges (±3.85 u); the floor right above the thumb zone, where the three pads lie:
 *          ◀ the left side, ⇆ the nearer side, ▶ the right side
 *   short  a phone on its side: the HUD is one row; the room takes the whole width and height under it,
 *          the window in its upper left corner beside the angel; the pads along the bottom, the side ones
 *          under the two thumbs
 *   wide   a desktop or a tablet on its side: the window hangs between the panel and the score when there
 *          is room for it (else under the HUD), the room below, three pads along the bottom (the thirds)
 *
 * The pads are the visible part of the tap zones: a tap anywhere in a pad's column strikes like the pad
 * (left of the middle zone the left side, right of it the right side, in it the nearer side; on a desktop
 * the zones are the thirds).  The gift choice is a bottom sheet of three full-width cards on a phone
 * upright and a row of three cards near the bottom elsewhere.  Every rectangle the player taps is here
 * (`tapTargets`), the same ones the view hit-tests and the mobile audit checks.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, TAP_GAP, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';

export type { Rect };
export type Mode = 'wide' | 'tall' | 'short';
export type Pad = 'left' | 'mid' | 'right';
export const PADS: readonly Pad[] = ['left', 'mid', 'right'];

/** The runner's top bar on a desktop (the window may hang under it, between the panel and the score). */
const TOP_BAR = 58;

export interface Layout {
  w: number;
  h: number;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  mode: Mode;
  tall: boolean;
  /** what covers each edge (the HUD band on top) and the HUD's lower edge */
  ins: Insets;
  top: number;
  /** px per u of the room */
  S: number;
  /** the bed's centre and the floor line */
  cx: number;
  floorY: number;
  /** the window's sky (the band's curve) and its sill (the stars, one a second); w 0 = no window */
  win: Rect;
  sill: Rect;
  /** the night's level: the feather bar (its label left of it, inside the rectangle) */
  xp: Rect;
  /** the top of the room's play (below the window) and the room's span across (inside the insets) */
  roomTop: number;
  roomX0: number;
  roomX1: number;
  /** the toasts (and the dawn's card): their left edge, width and top — on a phone over the window, never over the angel */
  card: { x: number; w: number; y: number };
  /** the combo ladder's corner (right of the angel) */
  combo: { x: number; y: number };
  /** the story card: its width, its top and the most height it may take (it keeps the floor in sight) */
  story: { w: number; y: number; maxH: number };
  /** the great nightmare's light bar (its name above it) */
  boss: Rect;
  /** the three thumb pads at the bottom, and the middle zone across (a tap between l and r strikes the nearer side) */
  pads: Record<Pad, Rect>;
  zone: { l: number; r: number };
  /** the gift choice: the sheet behind it (dimmed), the title's top, the three cards (stacked on a phone upright) */
  sheet: Rect;
  sheetTitle: number;
  gifts: Rect[];
  stacked: boolean;
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = uiScale(W, H);
  const top = clamp(insets.top, 0, H * 0.6);
  const ins: Insets = { top, right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left) };
  const tall = W / H < 0.9;
  const band = H - top - ins.bottom;
  const mode: Mode = tall ? 'tall' : band < 340 ? 'short' : 'wide';
  const roomX0 = ins.left, roomX1 = W - ins.right;
  const gap = Math.round(TAP_GAP * u) + 2;
  // nothing to press in the outer 16 px of a phone's sides (the back swipe, the grip)
  const edge = mode === 'wide' ? Math.round(24 * u) : mode === 'short' ? 12 : W < 600 ? 16 : Math.round(24 * u);
  const x0 = ins.left + edge, x1 = W - ins.right - edge;
  const span = x1 - x0;
  // the pads: finger-sized and more, sitting on the bottom (over the home indicator)
  // (a desktop's are key caps under the mouse: a little lower, so the room keeps its size)
  const padH = Math.round(mode === 'short' ? clamp(52 * u, 50, 64) : mode === 'wide' ? 56 : clamp(60 * u, 56, 76));
  const padY = H - ins.bottom - Math.round((mode === 'short' ? 8 : 10) * u) - padH;
  let pads: Record<Pad, Rect>;
  let zone: { l: number; r: number };
  if (mode === 'wide') {
    // a desktop: three key caps, one in each third (the thirds are the zones, as a mouse expects)
    const third = (span - 2 * gap) / 3;
    const pw = Math.min(third, 240 * u);
    const at = (i: number): Rect => ({ x: x0 + i * (third + gap) + (third - pw) / 2, y: padY, w: pw, h: padH });
    pads = { left: at(0), mid: at(1), right: at(2) };
    zone = { l: x0 + third + gap / 2, r: x0 + 2 * third + gap * 1.5 };
  } else {
    // a phone: the side pads fill the bottom, the middle one between them is narrower
    const midW = Math.round(clamp(span * 0.2, 64, 150));
    const sideW = (span - midW - 2 * gap) / 2;
    pads = {
      left: { x: x0, y: padY, w: sideW, h: padH },
      mid: { x: x0 + sideW + gap, y: padY, w: midW, h: padH },
      right: { x: x1 - sideW, y: padY, w: sideW, h: padH },
    };
    zone = { l: pads.mid.x - gap / 2, r: pads.mid.x + midW + gap / 2 };
  }
  // the room: the Zmory step in from beyond the screen's edges upright (±3.85 u), ±5 u on its side, ±5.2 u wide
  const across = mode === 'tall' ? 3.85 : mode === 'short' ? 5.0 : 5.2;
  const S0 = clamp((roomX1 - roomX0) / (2 * across), 22, 130);
  const floorGap = Math.round(mode === 'short' ? clamp(0.42 * S0, 18, 34) : mode === 'wide' ? clamp(0.4 * S0, 24, 44) : clamp(0.62 * S0, 26, 64));
  const floorY = padY - floorGap;
  const sillH = Math.round(14 * u), xpH = Math.round(14 * u);
  let win: Rect, sill: Rect, xp: Rect, roomTop: number, S: number;
  if (mode === 'short') {
    // the room takes the whole band; the window sits in its upper left corner, left of the angel's wings
    roomTop = top + 4;
    S = clamp(Math.min(S0, (floorY - roomTop - 2) / 3.45), 22, 130);
    const cx = (roomX0 + roomX1) / 2;
    const wx = roomX0 + 18;
    const ww = clamp(cx - 1.3 * S - 14 - wx, 0, 300 * u);
    const wh = Math.round(clamp(0.62 * S, 30, 46));
    win = ww >= 110 ? { x: wx, y: top + 6, w: ww, h: wh } : { x: 0, y: 0, w: 0, h: 0 };
    sill = { x: win.x, y: win.y + win.h + 3, w: win.w, h: win.w ? Math.round(12 * u) : 0 };
    xp = win.w ? { x: win.x, y: sill.y + sill.h + 6, w: win.w, h: xpH } : { x: x0, y: top + 6, w: Math.min(220, span * 0.4), h: xpH };
  } else if (mode === 'wide' && W - Math.min(W * 0.36, 360) - 150 >= 360 && top - TOP_BAR >= 70) {
    // a desktop: the window hangs between the panel and the score
    const left = Math.min(W * 0.36, 360), mid = W - left - 150;
    const ww = Math.min(mid - 24, 560 * u);
    const sh = Math.round(16 * u);
    const wh = clamp(top - TOP_BAR - sh - 14, 40, 80 * u);
    win = { x: left + (mid - ww) / 2, y: TOP_BAR + 4, w: ww, h: wh };
    sill = { x: win.x, y: win.y + win.h + 3, w: win.w, h: sh };
    xp = { x: win.x, y: sill.y + sill.h + 5, w: win.w, h: xpH };
    roomTop = xp.y + xp.h + 8;
    S = clamp(Math.min(S0, (floorY - roomTop - 4) / 3.4), 22, 130);
  } else {
    // upright (or a narrow screen): the window under the HUD, full width; it takes what the room does not need
    const wx = roomX0 + 18, ww = roomX1 - roomX0 - 36;
    let wh = Math.round(44 * u);
    const fixed = top + 4 + wh + 3 + sillH + 6 + xpH + 8;
    const spare = floorY - 3.45 * S0 - fixed;
    if (spare > 0) wh += Math.round(Math.min(spare * 0.6, 150 * u));
    win = { x: wx, y: top + 4, w: ww, h: wh };
    sill = { x: wx, y: win.y + wh + 3, w: ww, h: sillH };
    xp = { x: wx, y: sill.y + sillH + 6, w: ww, h: xpH };
    roomTop = xp.y + xp.h + 8;
    S = clamp(Math.min(S0, (floorY - roomTop - 4) / 3.4), 22, 130);
  }
  const cx = (roomX0 + roomX1) / 2;
  // the story card keeps the Zmory's heads in sight (1.3 u above the floor)
  const storyW = Math.min(mode === 'short' ? 540 * u : 440 * u, roomX1 - roomX0 - 24);
  const storyY = top + (mode === 'wide' ? 4 : 6);
  const story = { w: storyW, y: storyY, maxH: Math.max(120, floorY - (mode === 'short' ? 1.2 : 1.3) * S - storyY) };
  // the great nightmare's bar (its name above it): under the level bar; on its side right of the window, at the top
  const bw = mode === 'short' ? Math.min(260 * u, roomX1 - 16 - (win.x + win.w + 24)) : Math.min(320 * u, (roomX1 - roomX0) * 0.7);
  const bh = Math.round(8 * u);
  const boss = mode === 'short'
    ? { x: roomX1 - 16 - bw, y: top + Math.round(24 * u), w: bw, h: bh }
    : { x: cx - bw / 2, y: roomTop + Math.round(20 * u), w: bw, h: bh };
  // the toasts: on a phone upright over the window (the angel stays in sight), on its side over the window's
  // corner, on a desktop under the boss bar, over the angel's head
  const cw = mode === 'short' ? clamp(win.w + 24, 240, 320) : Math.min(340 * u, roomX1 - roomX0 - 32);
  const card = mode === 'tall' ? { x: cx - cw / 2, w: cw, y: top + 6 }
    : mode === 'short' ? { x: roomX0 + 10, w: cw, y: top + 4 }
    : { x: cx - cw / 2, w: cw, y: boss.y + boss.h + Math.round(10 * u) };
  // the combo ladder right of the angel, clear of the boss bar
  const combo = { x: Math.min(cx + S * 1.3, roomX1 - 70 * u), y: Math.max(boss.y + boss.h + 8 * u, floorY - S * 3.25) };
  // the gift choice
  let sheet: Rect, sheetTitle: number;
  const gifts: Rect[] = [];
  const stacked = mode === 'tall';
  if (stacked) {
    // a bottom sheet: three full-width cards under the thumb, the title over them, the countdown under them
    const cw = Math.min(span, 520 * u);
    const ch = Math.round(clamp(66 * u, 64, 86));
    const cg = Math.round(8 * u), pad = Math.round(12 * u), titleH = Math.round(32 * u), hintH = Math.round(24 * u);
    const sh = pad + titleH + 3 * ch + 2 * cg + 6 + hintH + pad;
    const sy = Math.max(top + 4, H - ins.bottom - 6 - sh);
    sheet = { x: cx - cw / 2 - pad, y: sy, w: cw + 2 * pad, h: H - ins.bottom - 6 - sy };
    sheetTitle = sy + pad;
    const gy = sheetTitle + titleH;
    for (let i = 0; i < 3; i++) gifts.push({ x: cx - cw / 2, y: gy + i * (ch + cg), w: cw, h: ch });
  } else {
    // a row of three near the bottom (a phone on its side: under the thumbs), the title over it
    const cg = Math.round(10 * u);
    const cw = Math.min(210 * u, (span - 2 * cg) / 3);
    // (tall enough for the icon, the name and three lines of what it does, no taller)
    const ch = Math.round(Math.min(mode === 'short' ? 132 : 160, Math.max(MIN_TAP + 30, band * 0.45)));
    const by = H - ins.bottom - Math.round(10 * u) - Math.round(22 * u) - ch;
    const titleH = Math.round(30 * u);
    sheetTitle = Math.max(top + 4, by - titleH);
    const total = 3 * cw + 2 * cg;
    for (let i = 0; i < 3; i++) gifts.push({ x: cx - total / 2 + i * (cw + cg), y: by, w: cw, h: ch });
    sheet = { x: roomX0, y: sheetTitle - 8, w: roomX1 - roomX0, h: H - ins.bottom - (sheetTitle - 8) };
  }
  return {
    w: W, h: H, u, mode, tall, ins, top, S, cx, floorY, win, sill, xp, roomTop, roomX0, roomX1, card, combo, story, boss,
    pads, zone, sheet, sheetTitle, gifts, stacked,
  };
}

/** The side a tap at x strikes: left of the middle zone −1, right of it +1, in it 0 (the nearer side). */
export function padAt(L: Layout, x: number): -1 | 0 | 1 {
  return x < L.zone.l ? -1 : x > L.zone.r ? 1 : 0;
}

/** The pad of a side (−1, 0 the nearer one, +1). */
export const padOf = (side: -1 | 0 | 1): Pad => (side < 0 ? 'left' : side > 0 ? 'right' : 'mid');

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Which gift card a point is on (−1: none). */
export function giftAt(L: Layout, x: number, y: number): number {
  return L.gifts.findIndex(r => inRect(r, x, y));
}

/** What is on screen that decides the targets: the choice of gifts open, the night over. */
export interface TargetState { choice: boolean; done: boolean }

/**
 * Every control the player can tap right now, as the view hit-tests it (ArcadeGame.targets): the three pads
 * (the tap zones' visible part) while the night goes on, the three gift cards while a choice is open.  The
 * rest of a pad's column strikes too, but it is the free play area, not a target.
 */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  const r1 = (label: string, r: Rect): TapTarget => ({ label, x: r.x, y: r.y, w: r.w, h: r.h });
  if (s.choice) return L.gifts.map((r, i) => r1(`gift ${i + 1}`, r));
  if (s.done) return [];
  return [r1('strike left', L.pads.left), r1('strike nearer', L.pads.mid), r1('strike right', L.pads.right)];
}
