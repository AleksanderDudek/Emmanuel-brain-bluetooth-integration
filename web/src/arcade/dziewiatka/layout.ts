/**
 * Where Dziewiątka's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12 and §11.7, "Mobile
 * first").  The runner's HUD covers the top (`ins.top`): the scene runs under it, the controls and the text stay
 * below it, above the home indicator (`ins.bottom`) and clear of a notch on the side.  One view, three shapes:
 *
 *   portrait  a phone (or a tablet) upright: the street from the HUD down to the thumb zone; there the energy
 *             dial (left) and the bell (right) share a row over the five portraits, big cards across the
 *             width (≥ 84 px tall), 16 px clear of the side edges (Safari's back swipe starts there).  The
 *             street takes the height above them: the figures larger than their spacing, the rows deeper
 *   side      a phone on its side (a band under 330 px): the street across the width and one strip along the
 *             bottom — the dial, the five, the bell — the way Hero Wars itself is held
 *   wide      a tablet on its side or a desktop: the same strip, grown by the UI scale (≤ 1.3) and centred
 *
 * Right under the HUD sit the passive bits: the mission's pill and the boss's bar.  The boons are a bottom sheet
 * of three stacked full-width cards on an upright phone (three in a row elsewhere); the story card fills the
 * band of a phone.  `u` is 1 on any phone and grows to 1.3 (kit/mobile.ts `uiScale`).
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, TAP_GAP, target, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';

export type { Rect };
export type Shape = 'portrait' | 'side' | 'wide';

/** A boon card takes a finger only once the sheet has been up this long (s): a thumb still sewing at the well is not a choice. */
export const CHOICE_GUARD = 0.45;

export interface Layout {
  w: number;
  h: number;
  /** the runner's HUD bottom (insets().top): the street's band starts here */
  top: number;
  /** the lowest y a control or a card reaches (above the home indicator) */
  bottom: number;
  ins: Insets;
  /** UI scale: 1 on a phone, up to 1.3 on a tablet or a desktop */
  u: number;
  shape: Shape;
  /** the side margins the controls keep (px) */
  padL: number;
  padR: number;
  /** px per u of the street, the figures' scale over the street's, the street's left edge (u) and how wide it shows (u) */
  s: number;
  k: number;
  x0: number;
  viewW: number;
  /** the feet line of the front row, the depth of the rows (px), and the line the street is painted from */
  groundY: number;
  depth: number;
  streetY: number;
  /** the street's bottom edge (px): below it, the controls */
  fieldBottom: number;
  /** the five portraits (`gap` apart), the energy dial, the bell */
  slots: Rect[];
  gap: number;
  dial: Rect;
  bell: Rect;
  /** the boons' three cards, the sheet behind them (an upright phone), the title's baseline and the hint's top */
  cards: Rect[];
  sheet: Rect | null;
  cardsTitle: number;
  cardsHint: number;
  /** the story card and the wipe's card */
  story: Rect;
  wipe: Rect;
  /** the mission's pill under the HUD and the boss's bar under it */
  pill: Rect;
  bossBar: Rect;
}

export function layout(w: number, h: number, insets: Partial<Insets> = NO_INSETS): Layout {
  const ins: Insets = { ...NO_INSETS, ...insets };
  const u = uiScale(w, h);
  const top = clamp(ins.top || 64, 40, h * 0.6);
  const shape: Shape = h - top < 330 && w > h ? 'side' : h >= w ? 'portrait' : 'wide';
  const portrait = shape === 'portrait', side = shape === 'side';
  // the side margins: 16 px on an upright phone, the notch's own room on its side
  const edge = portrait ? 16 * u : side ? 10 : 12 * u;
  const padL = Math.max(edge, ins.left > 0 ? ins.left + 6 : 0);
  const padR = Math.max(edge, ins.right > 0 ? ins.right + 6 : 0);
  const bottom = h - Math.max(portrait ? 10 : side ? 6 : 12 * u, ins.bottom > 0 ? ins.bottom + 4 : 0);
  const room = bottom - top;
  const A = w - padL - padR;

  // ── the strip: the five portraits, the dial and the bell ────────
  let gap: number, slotW: number, slotH: number, slotsX: number, slotsY: number, fieldBottom: number;
  let dial: Rect, bell: Rect;
  if (portrait) {
    // the dial and the bell in a row over the five, all in the thumb zone
    gap = Math.round(TAP_GAP * u);
    slotW = (A - 4 * gap) / 5;
    slotH = Math.min(Math.max(84, slotW * 1.42), 104 * u, Math.max(84, room * 0.27));
    slotsX = padL;
    slotsY = bottom - slotH;
    const rowH = clamp(room * 0.135, 50, 58 * u);
    const rowY = slotsY - 8 * u - rowH;
    const between = 10 * u;
    const dialW = Math.round((A - between) * 0.56);
    dial = { x: padL, y: rowY, w: dialW, h: rowH };
    bell = { x: padL + dialW + between, y: rowY, w: A - dialW - between, h: rowH };
    fieldBottom = rowY - 4;
  } else {
    // one strip along the bottom: the dial, the five, the bell
    gap = side ? TAP_GAP : Math.round(10 * u);
    slotH = side ? clamp(room * 0.255, 66, 80) : clamp(Math.min(96 * u, room * 0.24), 72, 124);
    let dialW = slotH * (side ? 1.5 : 1.35), bellW = slotH * (side ? 1.12 : 1);
    slotW = side ? Math.min(100, (A - dialW - bellW - 6 * gap) / 5) : clamp(slotH * 1.12, 84, 140);
    const least = side ? 60 : 72;
    if (dialW + bellW + 5 * slotW + 6 * gap > A) slotW = Math.max(least, (A - dialW - bellW - 6 * gap) / 5);
    if (dialW + bellW + 5 * slotW + 6 * gap > A) {
      // a narrow screen on its side: the dial and the bell give way, never under a finger's size
      const k = clamp((A - 5 * slotW - 6 * gap) / (dialW + bellW), 0.62, 1);
      dialW *= k;
      bellW *= k;
      slotW = Math.max(44, (A - dialW - bellW - 6 * gap) / 5);
    }
    const rowW = dialW + bellW + 5 * slotW + 6 * gap;
    const x = padL + Math.max(0, (A - rowW) / 2);
    slotsY = bottom - slotH;
    dial = { x, y: slotsY, w: dialW, h: slotH };
    slotsX = x + dialW + gap;
    bell = { x: slotsX + 5 * slotW + 5 * gap, y: slotsY, w: bellW, h: slotH };
    fieldBottom = slotsY - 6;
  }
  const slots: Rect[] = Array.from({ length: 5 }, (_, i) => ({ x: slotsX + i * (slotW + gap), y: slotsY, w: slotW, h: slotH }));

  // ── the street: its right edge where the Din forms, its left where Klara and the last of the five stand.  An
  // upright phone draws the figures larger than their spacing (k: the band's height decides how large) and the
  // rows deeper, so the tall street is used without losing a side of the fight ──
  const fieldH = Math.max(40, fieldBottom - top);
  const span = w < 700 ? 13.2 : 14.8;
  const s = Math.max(14, Math.min(w / span, fieldH / (portrait ? 2.4 : 2.75)));
  const x0 = RULES.fieldW + 0.1 - w / s;
  const k = portrait ? clamp(fieldH / s / 6, 1, 1.8) : 1;
  const S = s * k;
  const depth = portrait ? Math.min(S * 0.8, fieldH * 0.22) : Math.min(S * 0.5, fieldH * 0.16);
  const groundY = fieldBottom - Math.max(6, fieldH * 0.05);
  // the curb sits a little behind the back row, however deep the rows
  const streetY = Math.min(groundY, groundY - depth - S * 0.22 + S * 0.55);

  // ── the boons' cards ────────────────────────────────────────────
  let cards: Rect[], sheet: Rect | null = null, cardsTitle: number, cardsHint: number;
  if (portrait) {
    // a bottom sheet: the title, three stacked full-width cards, the hint and the countdown
    const cg = 8 * u;
    const ch = clamp((room - 104 * u) / 3 - cg, 74, 112 * u);
    const cw = Math.min(A, 520 * u);
    const last = bottom - 34 * u;
    const cx = padL + (A - cw) / 2;
    cards = [0, 1, 2].map(i => ({ x: cx, y: last - (3 - i) * ch - (2 - i) * cg, w: cw, h: ch }));
    cardsTitle = cards[0].y - 12 * u;
    // room for a title of two lines (German is long) and the sheet's grabber above it
    const sy = Math.max(top, cardsTitle - 58 * u);
    sheet = { x: 0, y: sy, w, h: h - sy };
    cardsHint = last + 8 * u;
  } else if (side) {
    // three in a row under the title, the hint below them
    const cw = Math.min(260, (A - 24) / 3);
    const ch = clamp(room - 84, 112, 170);
    const y = top + Math.max(40, (room - ch - 72) / 2 + 40);
    cards = [0, 1, 2].map(i => ({ x: padL + A / 2 + (i - 1) * (cw + 12) - cw / 2, y, w: cw, h: ch }));
    cardsTitle = y - 10;
    cardsHint = y + ch + 8;
  } else {
    const cw = clamp(230 * u, 190, 300), ch = clamp(170 * u, 150, 230);
    const y = top + Math.max(60 * u, (fieldBottom - top - ch) / 2 + 10 * u);
    cards = [0, 1, 2].map(i => ({ x: padL + A / 2 + (i - 1) * (cw + 18 * u) - cw / 2, y, w: cw, h: ch }));
    cardsTitle = y - 14 * u;
    cardsHint = y + ch + 10 * u;
  }

  // ── the story card, the wipe's card ─────────────────────────────
  let story: Rect;
  if (portrait) {
    const sw = Math.min(w - 20, 560 * u);
    const sh = Math.min(room - 12, 620 * u);
    story = { x: (w - sw) / 2, y: top + 6 + (room - 12 - sh) / 2, w: sw, h: sh };
  } else if (side) {
    const sw = Math.min(A, 620);
    story = { x: padL + (A - sw) / 2, y: top + 5, w: sw, h: room - 10 };
  } else {
    const sw = Math.min(A, 560 * u), sh = Math.min(room - 24, 330 * u);
    story = { x: padL + (A - sw) / 2, y: top + Math.max(12, (fieldBottom - top - sh) / 2), w: sw, h: sh };
  }
  // ── under the HUD: the mission's pill and the boss's bar ────────
  const pw = Math.min(A, 380 * u);
  const ph = Math.round(clamp(24 * u, 26, 32));
  const pill: Rect = { x: padL + (A - pw) / 2, y: top + 6, w: pw, h: ph };
  const bossBar: Rect = { x: pill.x, y: pill.y + ph + 5, w: pw, h: Math.round(clamp(15 * u, 17, 21)) };
  // the wipe's card under them, over the sky: the five get up below it, in sight
  const ww = Math.min(A, 430 * u), wh = 104 * Math.min(u, 1.15);
  const wipe: Rect = { x: padL + (A - ww) / 2, y: Math.min(bossBar.y + bossBar.h + 10, Math.max(top + 6, fieldBottom - wh - 40)), w: ww, h: wh };

  return {
    w, h, top, bottom, ins, u, shape, padL, padR, s, k, x0, viewW: w / s, groundY, depth, streetY, fieldBottom,
    slots, gap, dial, bell, cards, sheet, cardsTitle, cardsHint, story, wipe, pill, bossBar,
  };
}

/** A street point (u) to the canvas (px): `x` along the street, `y` the depth row (0 back … 1 front), `lift` above the feet (u). */
export function toScreen(L: Layout, x: number, y: number, lift = 0): { x: number; y: number } {
  return { x: (x - L.x0) * L.s, y: L.groundY - (1 - y) * L.depth - lift * L.s * L.k };
}

/** Is a point inside a rectangle (with some slack)? */
export const inRect = (r: Rect, x: number, y: number, pad = 0): boolean => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

/**
 * What a finger can press in each state of play (ArcadeGame.targets, the mobile audit, the layout tests): the
 * story card (a tap anywhere closes it; the card is what shows), the boons' cards, or the five and the bell.
 * The dial only shows the band; the free street is the tap that fires the next ultimate, not a target.
 */
export function targetsFor(L: Layout, state: 'play' | 'choice' | 'story', n = 3): TapTarget[] {
  if (state === 'story') return [target('story card', L.story)];
  if (state === 'choice') return L.cards.slice(0, n).map((r, i) => target(`boon ${i + 1}`, r));
  return [...L.slots.map((r, i) => target(`portrait ${i + 1}`, r)), target('bell', L.bell)];
}

/**
 * The portrait under a finger: on a card, or in the strip's band between two cards (the nearest one — a thumb
 * that lands in a 6 px gap still means one of its neighbours, never the street).  −1: none.
 */
export function slotAt(L: Layout, x: number, y: number): number {
  const i = L.slots.findIndex(r => inRect(r, x, y));
  if (i >= 0) return i;
  const first = L.slots[0], last = L.slots[4];
  if (y < first.y || y > first.y + first.h || x < first.x - L.gap / 2 || x > last.x + last.w + L.gap / 2) return -1;
  let best = -1, bd = Infinity;
  L.slots.forEach((r, j) => {
    const d = Math.abs(x - (r.x + r.w / 2));
    if (d < bd) { bd = d; best = j; }
  });
  return best;
}
