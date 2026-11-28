/**
 * Where a health visualisation's play view puts things (CSS px), phone first (DESIGN.md §12, §14, §24; Każdy włos's
 * layout, §15).  The runner's HUD covers
 * the canvas top (`insets().top`), the home indicator its bottom, a notch the sides; the ground runs under all of
 * them, the game's own bits stay inside.  One layout in four shapes:
 *
 *   tall   anything upright (the reference: a phone, 360 × 500 with a 134 px HUD band): the picture in the middle,
 *          the words band under it (the scene's name and what it teaches; in rest the breath and the verse; the
 *          narrator speaks in its top row), and the four controls in the thumb zone at the bottom — ≡ ◀ ↻ ▶
 *   side   a phone on its side: the picture on the left, the words and the controls in a column on the right
 *   wide   a tablet on its side: the side layout grown
 *   desk   a desktop or a big screen with a mouse (kit/mobile `screenKind`): the picture as big as the band allows,
 *          the narrator, the words and the controls (with their keys) in a column beside it at a reading measure,
 *          the picture and its column centred as one group
 *
 * The controls are never in the middle of the canvas (a tap there stays with the picture).  Everything here is
 * pure: the tests run it at every kit/mobile CHECK_SIZES entry.
 */
import { clamp } from '../juice';
import { MIN_TAP, NO_INSETS, TAP_GAP, screenKind, uiScale, type ScreenKind } from '../mobile';
import type { Insets, TapTarget } from '../types';
import type { Rect } from './camera';
import { MODES } from './lib';

export type { Rect };
export type Shape = 'tall' | 'side' | 'wide';
export type Control = 'list' | 'prev' | 'again' | 'next';
export const CONTROLS: readonly Control[] = ['list', 'prev', 'again', 'next'];

export interface Layout {
  w: number;
  h: number;
  ins: Insets;
  /** the play band: under the HUD, over the home indicator, inside a notch */
  top: number;
  bottom: number;
  left: number;
  right: number;
  shape: Shape;
  touch: boolean;
  kind: ScreenKind;
  /** a desktop or a big screen with a mouse: the picture big, its words and controls in a column beside it */
  desk: boolean;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop, up to DESK_MAX on a big screen */
  u: number;
  /** the picture's box (the camera fits each scene's view into it) */
  pic: Rect;
  /** the words: the label row and what the scene teaches (in rest the breath and the verse) */
  words: Rect;
  /** the narrator's own place on a desk (elsewhere it speaks in the words' top row) */
  caption: Rect;
  /** the four controls, each at least MIN_TAP */
  ctl: Record<Control, Rect>;
  /** the story card's and the picker's boxes (each sizes itself inside) */
  story: Rect;
  pickBox: Rect;
  /** text sizes (px, never under the kit's floor) */
  font: { label: number; teach: number; teachMin: number; caption: number; verse: number; small: number; part: number; key: number };
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true): Layout {
  const ins = { ...insets };
  const top = clamp(ins.top || 64, 24, h * 0.6);
  ins.top = top;
  const left = Math.max(0, ins.left), right = w - Math.max(0, ins.right), bottom = h - Math.max(0, ins.bottom);
  const bw = right - left, bh = bottom - top;
  const side = h < 470 && w > h * 1.3;
  const shape: Shape = side ? 'side' : w > h ? 'wide' : 'tall';
  const kind = screenKind(w, h, touch);
  const desk = shape === 'wide' && (kind === 'desktop' || kind === 'big');
  const u = shape === 'side' ? 1 : uiScale(w, h, 1.3);
  const font = desk
    ? {
      label: Math.round(14 * u), teach: Math.round(17.5 * u), teachMin: Math.max(15, Math.round(14.5 * u)), caption: Math.round(14.5 * u),
      verse: Math.round(16 * u), small: Math.round(12.5 * u), part: Math.round(13.5 * u), key: Math.max(13, Math.round(12 * u)),
    }
    : {
      label: Math.round(13 * u), teach: Math.round(16 * u), teachMin: 15, caption: Math.max(13, Math.round(13.5 * u)),
      verse: Math.round(15 * u), small: Math.max(11, Math.round(12 * u)), part: 13, key: 13,
    };
  const btn = Math.round(Math.max(MIN_TAP + 4, 48 * Math.min(u, 1.3)) * (desk ? Math.max(1, u / 1.3) : 1));
  const gap = Math.max(TAP_GAP + 6, Math.round(14 * u));
  const row = (cx: number, y: number): Record<Control, Rect> => {
    const total = CONTROLS.length * btn + (CONTROLS.length - 1) * gap;
    const x0 = cx - total / 2;
    return Object.fromEntries(CONTROLS.map((c, i) => [c, { x: x0 + i * (btn + gap), y, w: btn, h: btn }])) as Record<Control, Rect>;
  };
  const storyW = Math.min(bw - 32, 540 * u);
  const story = { x: (left + right - storyW) / 2, y: top + 8, w: storyW, h: bh - 16 };
  const pickW = Math.min(bw - 24, (desk ? 640 : 560) * u);
  const pickBox = { x: (left + right - pickW) / 2, y: top + 8, w: pickW, h: bh - 16 };

  if (shape === 'tall') {
    // the controls in the thumb zone, the words over them, the picture in the rest (it is the meditation)
    const ctlY = bottom - 10 - btn;
    const wordsH = Math.round(clamp(bh * 0.3, 104, 190 * u));
    const words = { x: left + 16, y: ctlY - 8 - wordsH, w: bw - 32, h: wordsH };
    const pic = { x: left + 8, y: top + 6, w: bw - 16, h: Math.max(80, words.y - 6 - (top + 6)) };
    return {
      w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, pic, words, caption: { ...words, h: Math.round(font.caption * 1.35) * 2 },
      ctl: row((left + right) / 2, ctlY), story, pickBox, font,
    };
  }

  if (desk) {
    // the column at a reading measure, the picture as tall as the band and as wide as the rest allows (up to a
    // square), the two centred as one group
    const colGap = Math.round(36 * u);
    const colW = Math.round(Math.max(260, Math.min(17 * font.teach, bw * 0.38)));
    const PH = Math.round(bh - 24);
    const PW = Math.round(Math.max(200, Math.min(PH, bw - 2 * 16 - colGap - colW)));
    const x0 = left + Math.max(16, (bw - (PW + colGap + colW)) / 2);
    const pic = { x: x0, y: top + (bh - PH) / 2, w: PW, h: PH };
    const colX = x0 + PW + colGap;
    const capH = Math.round(font.caption * 1.35) * 2 + 8;
    const wordsH = Math.round(clamp(10.5 * font.teach, 200, bh * 0.5));
    const keyH = Math.round(font.key * 1.6);
    const groupH = capH + 10 + wordsH + 18 + btn + keyH;
    const y0 = Math.max(top + 12, Math.min(bottom - 12 - groupH, top + (bh - groupH) / 2));
    const caption = { x: colX, y: y0, w: colW, h: capH };
    const words = { x: colX, y: y0 + capH + 10, w: colW, h: wordsH };
    return {
      w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, pic, words, caption,
      ctl: row(colX + colW / 2, words.y + wordsH + 18), story, pickBox, font,
    };
  }

  // side and wide: the picture on the left, the words and the controls in a column on the right
  const S = Math.round(Math.min(bh - 12, bw * (shape === 'side' ? 0.48 : 0.5)));
  const pic = { x: left + 8, y: top + (bh - S) / 2, w: S, h: S };
  const colX = pic.x + S + 14;
  const colW = Math.min(right - 12 - colX, 520 * u);
  const ctlY = bottom - 8 - btn;
  const words = { x: colX, y: top + 8, w: colW, h: Math.max(80, ctlY - 10 - (top + 8)) };
  return {
    w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, pic, words, caption: { ...words, h: Math.round(font.caption * 1.35) * 2 },
    ctl: row(colX + colW / 2, ctlY), story, pickBox, font,
  };
}

/** The story card's rectangle for a content height (centred in its box). */
export function storyRect(L: Layout, height: number): Rect {
  const h = Math.min(height, L.story.h);
  return { x: L.story.x, y: L.story.y + (L.story.h - h) / 2, w: L.story.w, h };
}

// ── the picker ───────────────────────────────────────────────────
export interface PickerLayout {
  card: Rect;
  /** the title's baseline row (its middle) */
  titleY: number;
  close: Rect;
  modes: Rect[];
  items: Rect[];
  /** columns of the meditation grid */
  cols: number;
}

/**
 * The meditation picker as a card over the picture: a title with a close button, the three modes as a row of
 * segments, the library's 4–7 meditations as a grid (two columns upright and on a desk, three or four on a phone on
 * its side; an odd last one spans the row) — every one a finger-sized target, none overlapping.
 */
export function pickerLayout(L: Layout, n: number): PickerLayout {
  const B = L.pickBox, u = L.desk ? L.u : Math.min(L.u, 1.3);
  const pad = Math.round(12 * u);
  const cols = L.shape === 'side' || (L.shape === 'wide' && !L.desk) ? (n <= 4 ? Math.max(1, n) : 3) : 2;
  const rows = Math.max(1, Math.ceil(n / cols));
  const titleH = Math.round(Math.max(MIN_TAP, 40 * u));
  const modeH = Math.round(Math.max(MIN_TAP, 44 * u));
  const gap = Math.max(TAP_GAP, Math.round(6 * u));
  const itemH = Math.round(Math.max(MIN_TAP + 4, (L.desk ? 60 : 52) * u));
  const h = Math.min(B.h, pad + titleH + gap + modeH + 2 * gap + rows * itemH + (rows - 1) * gap + pad);
  const card = { x: B.x, y: B.y + (B.h - h) / 2, w: B.w, h };
  const inner = card.w - 2 * pad;
  const close = { x: card.x + card.w - pad - titleH, y: card.y + pad, w: titleH, h: titleH };
  const modeW = (inner - (MODES.length - 1) * gap) / MODES.length;
  const my = card.y + pad + titleH + gap;
  const modes = MODES.map((_, i) => ({ x: card.x + pad + i * (modeW + gap), y: my, w: modeW, h: modeH }));
  const iy = my + modeH + 2 * gap;
  const itemW = (inner - (cols - 1) * gap) / cols;
  // the grid takes the room that is left (a short band shrinks the rows, never under a finger)
  const roomH = card.y + card.h - pad - iy;
  const ih = Math.max(MIN_TAP, Math.min(itemH, (roomH - (rows - 1) * gap) / rows));
  const items = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    // the last row, short of items, is shared out evenly (one alone spans the card: the whole library's walk)
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const w = (inner - (inRow - 1) * gap) / inRow;
    return { x: card.x + pad + col * (w + gap), y: iy + row * (ih + gap), w: inRow === cols ? itemW : w, h: ih };
  });
  return { card, titleY: card.y + pad + titleH / 2, close, modes, items, cols };
}

// ── the targets ──────────────────────────────────────────────────
export interface TargetState {
  /** a story card is up (it takes every tap: the only target) */
  story: Rect | null;
  /** the picker is open */
  picker: boolean;
  /** the session is in play (the controls answer) */
  live: boolean;
  /** the library's meditations (the picker's tiles) */
  meds: readonly string[];
}

/** Every control the player can tap now, as the game tests them. */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story', ...s.story }];
  if (!s.live) return [];
  if (s.picker) {
    const P = pickerLayout(L, s.meds.length);
    return [
      { label: 'close', ...P.close },
      ...P.modes.map((r, i) => ({ label: `mode:${MODES[i]}`, ...r })),
      ...P.items.map((r, i) => ({ label: `med:${s.meds[i]}`, ...r })),
    ];
  }
  return CONTROLS.map(c => ({ label: c, ...L.ctl[c] }));
}

/** What a tap at (x, y) lands on: a control, a picker's part, or the picture (null). */
export function hitAt(L: Layout, s: TargetState, x: number, y: number): string | null {
  const inside = (r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  for (const tg of tapTargets(L, s)) if (inside(tg)) return tg.label;
  if (s.picker && !s.story) return inside(pickerLayout(L, s.meds.length).card) ? 'card' : 'outside';
  return null;
}
