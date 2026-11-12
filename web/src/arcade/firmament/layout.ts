/**
 * Where Firmament's play view puts things (CSS px), mobile first (DESIGN §8.4 "Mobile first", §12).  The
 * runner's HUD covers the top of the canvas (`insets().top`), a phone's home indicator or a notch the other
 * edges; the night sky runs under all of them, the game's own parts stay inside.  Sizes start from a 360 px
 * phone at u = 1 (kit/mobile `uiScale`) and grow to 1.3 on a tablet or a desktop.
 *
 *   tall  (a phone upright, a tablet upright)  the goal strip right under the HUD (the moves in their ring,
 *         what is left to clear, the score bar with its stars), the board as large as the band allows, then
 *         the thumb zone: Bubo, the telescope and the tray's slots in one row over the home indicator.
 *         Cards are bottom sheets over the board and the tray.
 *   side  (a phone on its side)  three columns under the HUD's one row: the goal card and Bubo on the left,
 *         the board as tall as the band in the middle, the telescope and the tray (a grid of slots) under
 *         the right thumb.
 *   wide  (a desktop, a tablet on its side)  the side layout grown; the board may rise into the HUD's band
 *         between the Mendi panel and the score, where it stays clear of both.
 *
 * The board is the play field (a swipe on a body, or a tap and a tap), not a list of targets; everything
 * else the player taps is a rectangle here (`tapTargets`), the same ones the view hit-tests and the mobile
 * audit checks: at least MIN_TAP on the short side, apart from each other, inside the insets.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';

export type { Rect };
export type Mode = 'tall' | 'side' | 'wide';
/** The level's cards: its story, its goal before play, the stars' tally, out of moves. */
export type CardKind = 'story' | 'intro' | 'won' | 'out';

export interface Layout {
  w: number;
  h: number;
  mode: Mode;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  /** what covers each edge (the HUD band on top) */
  ins: Insets;
  /** the band the game's own parts keep to: under the HUD, inside the notch and over the home indicator */
  band: Rect;
  board: Rect;
  cell: number;
  rows: number;
  cols: number;
  /** the goal: a strip under the HUD (tall), a card in the left column (side, wide) */
  goal: Rect;
  /** the telescope's lens (centre, radius) */
  scope: { x: number; y: number; r: number };
  /** where the telescope's words go (centre x, top y, widest, tallest), or null: on a phone upright they rise above the lens as a tooltip when they change */
  scopeText: { x: number; y: number; w: number; h: number } | null;
  /** the tray's slots (as many as the level's tray holds) */
  tray: Rect[];
  owl: { x: number; y: number; r: number };
  /** Bubo's bubble: its left edge, its lower edge, its widest */
  bubble: { x: number; y: number; w: number };
  /** the room the cards may take: a bottom sheet on a phone upright, centred on the board elsewhere */
  card: Rect;
  anchor: 'bottom' | 'centre';
  /** a finger this far off the board's edge still takes the nearest body (px) */
  slop: number;
  /** a swipe this long picks the neighbour it points to (px) */
  reach: number;
}

/** The runner's top bar on a desktop (the clock and its buttons): the board may rise to just under it. */
const BAR = 58;

export function layout(w: number, h: number, insets: Insets = NO_INSETS, rows: number = RULES.rows, cols: number = RULES.cols, slots: number = RULES.tray): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = uiScale(W, H);
  const top = clamp(insets.top, 0, H * 0.6);
  const ins: Insets = { top, right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left) };
  const n = clamp(Math.round(slots), 1, RULES.trayMax);
  const mode: Mode = W / H < 0.9 ? 'tall' : H < 460 ? 'side' : 'wide';
  const L = mode === 'tall' ? tall(W, H, ins, u, rows, cols, n) : mode === 'side' ? side(W, H, ins, u, rows, cols, n) : wide(W, H, ins, u, rows, cols, n);
  return { ...L, slop: Math.round(clamp(L.cell * 0.4, 8, 24)), reach: clamp(L.cell * RULES.dragCell, 10, 18) };
}

type Parts = Omit<Layout, 'slop' | 'reach'>;

/** A phone upright (and a tablet upright): the goal strip, the board, the thumb row. */
function tall(W: number, H: number, ins: Insets, u: number, rows: number, cols: number, n: number): Parts {
  const L0 = ins.left, R0 = W - ins.right, mid = (L0 + R0) / 2;
  // nothing to press in the outer 16 px of a phone upright (the back swipe, a thumb's reach)
  const edge = W < 600 ? 16 : Math.round(24 * u);
  const yTop = ins.top + 2;
  // the canvas's last pixel row is where the dock's touches land: keep it free
  const yBot = H - ins.bottom - 3;
  const band = { x: L0, y: ins.top, w: R0 - L0, h: H - ins.bottom - ins.top };
  const stripW = Math.min(R0 - L0 - 12, 640 * u);
  const goal = { x: mid - stripW / 2, y: yTop, w: stripW, h: Math.round(40 * u) };
  // the thumb row: finger-sized slots (52 px on a phone), the telescope and Bubo beside them
  const slot = Math.round(clamp(52 * u, 48, 68));
  const gap = Math.round(8 * u);
  const rowY = yBot - slot;
  const scopeR = Math.round(slot * 0.42);
  const owlR = Math.round(15 * u);
  const owlW = owlR * 2.1, lensW = scopeR * 2.64;
  const slotsW = n * slot + (n - 1) * gap;
  const groupW = owlW + 4 + lensW + gap + slotsW;
  // a phone centres the row (and keeps the slots off its right edge); a tablet starts it at the left and
  // writes the telescope's words after the slots
  let gx = W < 600 ? Math.min(mid - groupW / 2, R0 - edge - groupW) : L0 + edge;
  gx = Math.max(L0 + 4, gx);
  const owl = { x: gx + owlW / 2, y: rowY + slot - owlR * 1.15, r: owlR };
  const scope = { x: gx + owlW + 4 + lensW / 2, y: rowY + slot / 2, r: scopeR };
  const sx0 = gx + owlW + 4 + lensW + gap;
  const tray: Rect[] = Array.from({ length: n }, (_, k) => ({ x: sx0 + k * (slot + gap), y: rowY, w: slot, h: slot }));
  const after = sx0 + slotsW + Math.round(16 * u);
  const room = R0 - edge - after;
  const scopeText = W >= 600 && room >= 140 ? { x: after + room / 2, y: rowY + slot / 2 - 18 * u, w: room, h: slot } : null;
  // the board between the strip and the row (the light trail rises a little over the lens)
  const by0 = goal.y + goal.h + Math.round(4 * u);
  const by1 = rowY - Math.round(6 * u);
  const mx = W < 600 ? 4 : Math.round(16 * u);
  const cell = Math.max(16, Math.floor(Math.min((R0 - L0 - 2 * mx) / cols, (by1 - by0) / rows, 64 * u)));
  const bw = cell * cols, bh = cell * rows;
  const board = { x: Math.round(mid - bw / 2), y: Math.round(by0 + Math.max(0, (by1 - by0 - bh) / 2)), w: bw, h: bh };
  // Bubo's bubble rises from him over the board's lower left
  const bubbleW = Math.min(R0 - L0 - 12, 340 * u);
  const bubble = { x: Math.max(L0 + 6, owl.x - owlR * 1.2), y: owl.y - owlR * 1.3, w: bubbleW };
  // a bottom sheet from under the strip down to the bottom: the play waits under a card
  const cw = Math.min(R0 - L0 - 12, 520 * u);
  const card = { x: mid - cw / 2, y: by0, w: cw, h: yBot - by0 };
  return { w: W, h: H, mode: 'tall', u, ins, band, board, cell, rows, cols, goal, scope, scopeText, tray, owl, bubble, card, anchor: 'bottom' };
}

/** A phone on its side: the goal card and Bubo, the board, the telescope and the tray. */
function side(W: number, H: number, ins: Insets, u: number, rows: number, cols: number, n: number): Parts {
  const yTop = ins.top + 4, yBot = H - ins.bottom - 4;
  const L0 = ins.left + 8, R0 = W - ins.right - 8;
  const band = { x: ins.left, y: ins.top, w: W - ins.left - ins.right, h: H - ins.bottom - ins.top };
  const gap = 10, colMin = 136;
  const cell = Math.max(16, Math.floor(Math.min((yBot - yTop) / rows, (R0 - L0 - 2 * (colMin + gap)) / cols, 64 * u)));
  const bw = cell * cols, bh = cell * rows;
  const board = { x: Math.round((L0 + R0) / 2 - bw / 2), y: Math.round((yTop + yBot) / 2 - bh / 2), w: bw, h: bh };
  const colW = board.x - gap - L0;
  const rx0 = board.x + bw + gap, rw = R0 - rx0;
  // the left column: the goal card on top, Bubo at the bottom with his bubble between them
  const goal = { x: L0, y: yTop, w: colW, h: Math.round(clamp((yBot - yTop) * 0.44, 116, 150 * u)) };
  const owlR = Math.round(clamp(colW * 0.12, 15, 20 * u));
  const owl = { x: L0 + owlR * 1.25, y: yBot - owlR * 1.2, r: owlR };
  const bubble = { x: L0, y: owl.y - owlR * 1.35, w: colW };
  // the right column: the telescope on top, its words, the tray under the right thumb
  const tg = Math.round(8 * u);
  const perRow = rw >= n * 52 + (n - 1) * tg ? n : 2;
  const slot = Math.round(clamp((rw - (perRow - 1) * tg) / perRow, 48, 60 * u));
  const trayRows = Math.ceil(n / perRow);
  const trayH = trayRows * slot + (trayRows - 1) * tg;
  const trayY = yBot - trayH;
  const tray: Rect[] = Array.from({ length: n }, (_, k) => {
    const r = Math.floor(k / perRow), inRow = Math.min(perRow, n - r * perRow), c = k % perRow;
    const rowW = inRow * slot + (inRow - 1) * tg;
    return { x: rx0 + rw / 2 - rowW / 2 + c * (slot + tg), y: trayY + r * (slot + tg), w: slot, h: slot };
  });
  const scopeR = Math.round(clamp(Math.min(rw * 0.2, (trayY - yTop - 50) / 3.3), 20, 40 * u));
  const scope = { x: rx0 + rw / 2, y: yTop + scopeR * 1.42, r: scopeR };
  const textY = scope.y + scopeR * 1.16 + 4;
  const scopeText = { x: scope.x, y: textY, w: rw - 4, h: trayY - 8 - textY };
  const cw = Math.min(R0 - L0, Math.max(bw + 120, 300 * u), 560 * u);
  const card = { x: board.x + bw / 2 - cw / 2, y: yTop, w: cw, h: yBot - yTop };
  return { w: W, h: H, mode: 'side', u, ins, band, board, cell, rows, cols, goal, scope, scopeText, tray, owl, bubble, card, anchor: 'centre' };
}

/** A desktop or a tablet on its side: the columns grown, the board risen between the HUD's two parts. */
function wide(W: number, H: number, ins: Insets, u: number, rows: number, cols: number, n: number): Parts {
  const top = ins.top;
  const L0 = ins.left + 12, R0 = W - ins.right - 12;
  const yTop = top + 4, yBot = H - ins.bottom - 8;
  const band = { x: ins.left, y: top, w: W - ins.left - ins.right, h: H - ins.bottom - top };
  const sideW = clamp(W * 0.24, 170 * u, 320 * u);
  // the runner's Mendi panel (left) and score card (right) on a desktop: the board may rise between them
  const panelRight = 12 + Math.min(330, W * 0.62 - 12), scoreLeft = W - 12 - Math.min(160, W * 0.36);
  let midX0 = L0 + sideW + 10, midX1 = R0 - sideW - 10;
  let y0 = BAR + 4;
  let size = Math.min(midX1 - midX0, yBot - y0);
  let bx = (midX0 + midX1) / 2 - size / 2;
  if (bx < panelRight + 4 || bx + size > scoreLeft - 4) {
    const between = scoreLeft - panelRight - 16;
    if (between >= (yBot - top) * 0.9 && between > 200) {
      midX0 = panelRight + 8;
      midX1 = scoreLeft - 8;
    } else y0 = yTop;
    size = Math.min(midX1 - midX0, yBot - y0);
    bx = (midX0 + midX1) / 2 - size / 2;
  }
  const cell = Math.max(16, Math.floor(Math.min(size / cols, size / rows, 80 * u)));
  const bw = cell * cols, bh = cell * rows;
  const board = { x: Math.round((midX0 + midX1) / 2 - bw / 2), y: Math.round(y0 + Math.max(0, (size - bh) / 2)), w: bw, h: bh };
  const colH = yBot - yTop;
  // the left column: the goal card, Bubo under it with his bubble to his right
  const lw = Math.max(170, Math.min(sideW, board.x - 12 - L0));
  const goal = { x: L0, y: yTop, w: lw, h: Math.round(clamp(colH * 0.42, 120 * u, 176 * u)) };
  const owlR = Math.round(clamp(Math.min(colH - goal.h, lw) * 0.16, 18, 36 * u));
  const owl = { x: L0 + owlR * 1.3, y: Math.min(yBot - owlR * 1.3, goal.y + goal.h + owlR * 2.2), r: owlR };
  const bubble = { x: owl.x + owlR * 1.1, y: owl.y + owlR * 0.3, w: Math.max(150, L0 + lw - (owl.x + owlR * 1.1)) };
  // the right column: the telescope, its words, the tray at the foot (a tablet's right thumb)
  const rx0 = board.x + bw + 12, rw = R0 - rx0;
  const tg = Math.round(10 * u);
  const perRow = rw >= n * 56 * u + (n - 1) * tg ? n : 2;
  const slot = Math.round(clamp((rw - (perRow - 1) * tg) / perRow, 52, 56 * u));
  const trayRows = Math.ceil(n / perRow);
  const trayH = trayRows * slot + (trayRows - 1) * tg;
  const trayY = yBot - trayH;
  const tray: Rect[] = Array.from({ length: n }, (_, k) => {
    const r = Math.floor(k / perRow), inRow = Math.min(perRow, n - r * perRow), c = k % perRow;
    const rowW = inRow * slot + (inRow - 1) * tg;
    return { x: rx0 + rw / 2 - rowW / 2 + c * (slot + tg), y: trayY + r * (slot + tg), w: slot, h: slot };
  });
  const scopeR = Math.round(clamp(Math.min(rw * 0.28, (trayY - yTop - 70 * u) / 3.4), 24, 64 * u));
  const scope = { x: rx0 + rw / 2, y: yTop + scopeR * 1.42, r: scopeR };
  const textY = scope.y + scopeR * 1.16 + 6;
  // the tools' names sit over the tray
  const scopeText = { x: scope.x, y: textY, w: rw - 8, h: trayY - 26 * u - textY };
  const cw = Math.min(R0 - L0, Math.max(bw * 0.96, 320 * u), 560 * u + 40);
  const card = { x: board.x + bw / 2 - cw / 2, y: yTop, w: cw, h: yBot - yTop };
  return { w: W, h: H, mode: 'wide', u, ins, band, board, cell, rows, cols, goal, scope, scopeText, tray, owl, bubble, card, anchor: 'centre' };
}

/** How tall a card of this kind wants to be (it never leaves the card's room). */
const CARD_H: Record<CardKind, number> = { story: 560, intro: 250, won: 340, out: 268 };

/**
 * A card as drawn: the story fills its room, the others size to their words; at the bottom on a phone upright,
 * else centred on the board — on a phone on its side only the story spreads over the columns (the goal and Bubo
 * stay in sight beside the others).
 */
export function cardRect(L: Layout, kind: CardKind): Rect {
  const c = L.card;
  const h = Math.min(c.h, Math.round(CARD_H[kind] * L.u));
  const narrow = L.mode === 'side' && kind !== 'story';
  const w = narrow ? Math.min(c.w, L.board.w + 24) : c.w;
  const x = narrow ? L.board.x + L.board.w / 2 - w / 2 : c.x;
  return { x, y: L.anchor === 'bottom' ? c.y + c.h - h : c.y + (c.h - h) / 2, w, h };
}

/** The out-of-moves card's buttons: "+5 moves from the telescope" (when the tray has it) over "Try again", finger-sized, at the card's foot. */
export function outButtons(L: Layout, can: boolean): { use: Rect | null; retry: Rect } {
  const r = cardRect(L, 'out'), u = L.u;
  const bh = Math.max(MIN_TAP + 6, Math.round(50 * u));
  const bw = Math.min(r.w - 32, 360 * u);
  const x = r.x + (r.w - bw) / 2;
  const retry = { x, y: r.y + r.h - Math.round(34 * u) - bh, w: bw, h: bh };
  const use = can ? { x, y: retry.y - Math.round(12 * u) - bh, w: bw, h: bh } : null;
  return { use, retry };
}

export const inRect = (r: Rect, x: number, y: number, pad = 0): boolean => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

/** What on screen decides the targets: the level's stage, the tools in the tray, whether +5 is there. */
export interface TargetState {
  stage: 'story' | 'intro' | 'play' | 'shower' | 'won' | 'out' | 'none';
  /** the tools in the tray (they fill the slots from the first) */
  tools: number;
  /** out of moves: the tray holds +5 moves */
  can: boolean;
}

/**
 * Every control the player can tap right now, as the view hit-tests it (ArcadeGame.targets): the tray's
 * tools in play; on a story, a goal or a tally card the card (a tap goes on); out of moves its two buttons.
 * The board is the play field (a swipe, a tap and a tap), not a target.
 */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  const r1 = (label: string, r: Rect): TapTarget => ({ label, x: r.x, y: r.y, w: r.w, h: r.h });
  switch (s.stage) {
    case 'story': case 'intro': case 'won': return [r1(s.stage, cardRect(L, s.stage))];
    case 'out': {
      const b = outButtons(L, s.can);
      return b.use ? [r1('out: +5', b.use), r1('out: retry', b.retry)] : [r1('out: retry', b.retry)];
    }
    case 'play': return L.tray.slice(0, Math.max(0, s.tools)).map((r, k) => r1(`tool ${k + 1}`, r));
    default: return [];
  }
}
