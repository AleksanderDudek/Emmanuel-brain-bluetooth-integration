/**
 * Where everything sits on Geoda's canvas (CSS px), mobile first (DESIGN §3.1 "Mobile first", §12).  The runner's
 * HUD covers the top (`insets().top`), a phone's home indicator or notch the other edges; the geode's rim may run
 * under them, the board and the tray never do.  Sizes start from a 360 px phone at u = 1 (kit/mobile `uiScale`).
 *
 *   strip    a phone upright with height to spare (an iPhone, a large phone, an installed app, a tablet): a strip
 *            under the HUD with the shine dial, the chamber's goal (the Szlif's bowl in a rest) and Bazyl; the
 *            board right under it, as wide as the screen allows; the tray of three pieces under the thumb
 *   columns  a small phone upright (the band too short for a strip): the board as tall as the band allows and
 *            the margins beside it put to use — the shine as a column of five steps on the left (the bowl in a
 *            rest), the goal's jewels on the right with Bazyl under them; the tray under the thumb
 *   wide     a phone or a tablet on its side: the board in the middle; on the left the dial over the bowl and
 *            Bazyl; on the right the goal over the tray of three, stacked under the right thumb
 *   desk     a desktop or a big screen with a mouse, wider than tall (DESIGN §14): the same three columns, but the
 *            board as large as the band and the columns beside it allow — 616 px on a Full HD monitor's middle
 *            column, 832 on a 2560 × 1440 one (520 and 696 in `wide`) — with the columns hugging it (the tray a
 *            short mouse move from the board, its pieces at a uniform ~42 % of a board cell), the dial, the bowl
 *            and Bazyl on the left, and the type grown with the UI scale (`tk`)
 *
 * The board is pushed down onto the tray (a short drag); what height is left grows the tray (bigger pieces) and
 * the strip.  A dragged piece floats `lift` px above the finger (clear of a thumb on a phone); under a desktop's
 * mouse it keeps the point the cursor took it by (`grab`).  The smoke test taps at 50 % × 60 % of the canvas,
 * which lands on the board in every shape.  Everything the player taps is here (`tapTargets`): the tray's pieces
 * (≥ 44 px, apart, inside the insets) and the story card.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, screenKind, uiScale, type ScreenKind } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { GEODE_REACH } from './art';
import { N } from './board';

export interface Box { x: number; y: number; w: number; h: number }

export type Mode = 'strip' | 'columns' | 'wide' | 'desk';

export interface Layout {
  w: number;
  h: number;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop, up to DESK_MAX on a big screen */
  u: number;
  /** the screen the layout is for (kit/mobile `screenKind`): a desktop and a big screen get `desk` and grown type */
  kind: ScreenKind;
  /** the type's scale: 1 on a phone and a tablet (their words stay as they were), the UI scale on a desktop */
  tk: number;
  /** a mouse on a desktop: a dragged piece keeps the point the cursor took it by (a phone's piece floats above the finger) */
  grab: boolean;
  mode: Mode;
  /** upright (strip or columns): the tray under the board */
  portrait: boolean;
  /** what covers each edge (the HUD band on top) */
  ins: Insets;
  top: number;
  /** the board and the size of one of its cells */
  board: Box;
  cell: number;
  /** the geode's rim thickness (art.ts: it reaches GEODE_REACH × rim beyond the board) */
  rim: number;
  /** the three tray slots */
  slots: Box[];
  /** the largest a tray piece's cell gets */
  trayCell: number;
  /** the shine dial: its centre and radius (strip, wide) */
  dial: { x: number; y: number; r: number };
  /** the shine as a column of five steps, the bowl in a rest (columns; w 0 elsewhere) */
  column: Box;
  /** the chamber's goal (a row in a strip or a side column, a column of jewels in `columns`) and the Szlif's bowl */
  goal: Box;
  bowl: Box;
  /** Bazyl: the centre of his feet and his size; his bubble: its box's left edge, the edge it hangs from, its widest */
  mole: { x: number; y: number; s: number };
  bubble: { x: number; y: number; w: number; below: boolean };
  /** where cards (the story, a chamber won, a turned geode) are drawn */
  card: Box;
  /** how far above the finger a dragged piece's lower edge floats (a mouse: a cell; a finger: clear of the thumb) */
  lift: number;
}

const RIM_K = 0.028;
/** the rim's height above the board, and below it (with the crystal skyline of the band's last 40 s), in rims */
const ABOVE = 0.8;
const BELOW = 2.5;

/** The layout for a canvas of w × h with these insets (a number: the HUD band only, as the old callers pass). */
export function computeLayout(w: number, h: number, insets: Insets | number = NO_INSETS, touch = false): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const raw: Insets = typeof insets === 'number' ? { ...NO_INSETS, top: insets } : insets;
  const top = clamp(raw.top, 0, H * 0.6);
  const ins: Insets = { top, right: Math.max(0, raw.right), bottom: Math.max(0, raw.bottom), left: Math.max(0, raw.left) };
  const u = uiScale(W, H);
  const portrait = W < H * 1.05;
  const band = H - top - ins.bottom;
  const reachK = GEODE_REACH * RIM_K;
  const vertK = 1 + (ABOVE + BELOW) * RIM_K;
  // the screen decides (DESIGN §14): a phone and a tablet keep their layouts and their type exactly
  const kind = screenKind(W, H, touch);
  const desk = kind === 'desktop' || kind === 'big';
  const base = { kind, tk: desk ? u : 1, grab: desk && !touch };
  if (desk && !portrait) return { ...deskLayout(W, H, ins, top, u, kind === 'big'), ...base };
  return { ...phoneLayout(W, H, ins, top, u, portrait, band, reachK, vertK, touch), ...base };
}

type Parts = Omit<Layout, 'kind' | 'tk' | 'grab'>;

/**
 * A desktop or a big screen with a mouse, wider than tall (DESIGN §14): the board as large as the band allows while
 * a column on each side keeps room for the tray's widest piece (five cells at ~42 % of a board cell) and the dial;
 * the board centred (the runner's own side columns are symmetric), the columns hugging it.  Left: the shine dial at
 * the top, the Szlif's bowl, Bazyl at the foot with his bubble over him.  Right: the goal (the chamber's name over
 * its jewels), then the tray's three slots down to the geode's foot — a short move of the mouse to the board.
 */
function deskLayout(W: number, H: number, ins: Insets, top: number, u: number, big: boolean): Parts {
  const reachK = GEODE_REACH * RIM_K, vertK = 1 + (ABOVE + BELOW) * RIM_K;
  const m = Math.round(14 * u), gap = Math.round(14 * u);
  const x0 = ins.left + m, x1 = W - ins.right - m;
  const vm = big ? Math.round(10 * u) : 6;
  const y0 = top + vm, y1 = H - ins.bottom - vm;
  // a column: the tray's five-cell piece at ~42 % of a board cell, never under 150 px of UI
  const colMin = (c: number): number => Math.max(2.5 * c, 150 * u);
  let cell = Math.max(12, Math.floor((y1 - y0) / vertK / N));
  while (cell > 12 && N * cell * (1 + 2 * reachK) + 2 * (colMin(cell) + gap) > x1 - x0) cell--;
  const S = cell * N, rim = Math.max(4, S * RIM_K), reach = rim * GEODE_REACH;
  const bx = Math.round((x0 + x1) / 2 - S / 2);
  const by = Math.round(y0 + ABOVE * rim + Math.max(0, (y1 - y0 - S * vertK) / 2));
  // the columns hug the geode, as tall as it (its rim above, its skyline below)
  const room = bx - reach - gap - x0;
  const cw = Math.min(room, Math.max(colMin(cell), 210 * u));
  const lx = Math.round(bx - reach - gap - cw), rx = Math.round(bx + S + reach + gap);
  const colTop = Math.max(y0, Math.round(by - ABOVE * rim)), colBot = Math.min(y1, Math.round(by + S + BELOW * rim));
  const colH = colBot - colTop;
  // left: the dial (its threshold mark and its note need ~1.3 r above and ~1.6 r below the centre), the bowl, Bazyl
  const dr = Math.round(Math.max(30, Math.min(cw / 2.6, colH * 0.16, 110 * u)));
  const dial = { x: lx + cw / 2, y: colTop + dr * 1.32, r: dr };
  const moleS = Math.round(Math.max(60, Math.min(cw * 0.62, colH * 0.27, 150 * u)));
  const mole = { x: lx + cw * 0.42, y: colBot - 4, s: moleS };
  // Bazyl's bubble stands over his head: the bowl keeps clear of three of its lines.  A tall column (a big screen)
  // keeps the bowl under the dial; a short one (a laptop, a desktop under the HUD) gives the bowl the dial's place
  // in a rest (render.ts: `bowl.y > dial.y` says which)
  const bowlY = Math.round(dial.y + dr * 1.62 + 8 * u);
  const ownH = colBot - (moleS * 1.08 + 3 * 21 * u + 18) - bowlY;
  const bowl = ownH >= 100 + 60 * u
    ? { x: lx, y: bowlY, w: cw, h: Math.round(ownH) }
    : { x: lx, y: colTop, w: cw, h: Math.round(dial.y + dr * 1.62 - colTop) };
  const bubbleW = Math.round(Math.min(cw + reach, 340 * u));
  // right: the goal (two lines: the chamber, then its jewels), the tray's three slots under it
  const goalH = Math.round(Math.max(56, 64 * u));
  const goal = { x: rx, y: colTop, w: cw, h: goalH };
  const tg = Math.round(8 * u);
  const ty = colTop + goalH + Math.round(10 * u);
  const slotH = Math.max(MIN_TAP + 6, (colBot - ty - 2 * tg) / 3);
  const slots = [0, 1, 2].map(i => ({ x: rx, y: ty + i * (slotH + tg), w: cw, h: slotH }));
  // the story's card over the board (the play waits under it), a little wider than the geode
  const cardW = Math.min(x1 - x0, Math.max(S * 1.08, 520 * u));
  const cardH = Math.min(colH, Math.max(S * 0.96, 420 * u));
  return {
    w: W, h: H, u, mode: 'desk', portrait: false, ins, top, board: { x: bx, y: by, w: S, h: S }, cell, rim, slots,
    // one scale for every piece up to three rows (the five-cell bar across included); a taller bar shrinks to its slot
    trayCell: Math.min(cell * 0.6, (cw * 0.84) / 5, (slotH * 0.84) / 3),
    dial, column: { x: 0, y: 0, w: 0, h: 0 }, goal, bowl, mole,
    bubble: { x: Math.max(ins.left + 8, mole.x - bubbleW * 0.3), y: mole.y - moleS * 1.08, w: bubbleW, below: false },
    card: { x: bx + S / 2 - cardW / 2, y: Math.max(top + 6, by + S / 2 - cardH / 2), w: cardW, h: cardH },
    lift: cell * 1.15,
  };
}

/** A phone (upright or on its side), a tablet, a desktop window taller than wide: DESIGN §3.1 "Mobile first". */
function phoneLayout(W: number, H: number, ins: Insets, top: number, u: number, portrait: boolean, band: number, reachK: number, vertK: number, touch: boolean): Parts {
  const fin = (S: number, cellMin = 12): { cell: number; S: number; rim: number } => {
    const cell = Math.max(cellMin, Math.floor(S / N));
    return { cell, S: cell * N, rim: Math.max(4, cell * N * RIM_K) };
  };
  if (portrait) {
    // nothing to press in the outer 16 px of a phone upright
    const edge = W < 600 ? 16 : Math.round(24 * u);
    const x0 = ins.left + edge, x1 = W - ins.right - edge;
    const gap = Math.round(8 * u);
    let trayH = Math.round(clamp(band * 0.2, 80, 130));
    const stripH0 = Math.round(clamp(band * 0.11, 50, 72 * u));
    const trayY0 = H - ins.bottom - 6 - trayH;
    // a strip under the HUD, or the margins beside the board: whichever leaves the bigger board
    const roomA = trayY0 - gap - (top + 4 + stripH0 + 4);
    const sA = Math.min((x1 - x0) / (1 + 2 * reachK), roomA / vertK);
    // (the margins' plates may cover the rough outer half of the geode's rind, never the board)
    const gw = Math.round(40 * u);
    const roomB = trayY0 - gap - (top + 6);
    const sB = Math.min((W - ins.left - ins.right - 2 * (4 + gw + 2)) / (1 + reachK), roomB / vertK);
    const columns = sB > sA + 6;
    const { cell, S, rim } = fin(columns ? sB : sA);
    // what height is left grows the tray (bigger pieces under the thumb), then the strip
    let stripH = columns ? 0 : stripH0;
    const spare = Math.max(0, (columns ? roomB : roomA) - (S + (ABOVE + BELOW) * rim));
    const toTray = Math.min(spare * 0.6, 150 - trayH);
    trayH += Math.max(0, Math.round(toTray));
    const left = spare - Math.max(0, toTray);
    if (!columns) stripH += Math.round(clamp(left * 0.5, 0, 84 * u - stripH));
    const trayY = H - ins.bottom - 6 - trayH;
    // the board sits on the tray (a short drag); the strip right above the board
    const by = Math.round(trayY - gap - BELOW * rim - S);
    const bx = Math.round((ins.left + W - ins.right) / 2 - S / 2);
    const sw = (x1 - x0 - 2 * gap) / 3;
    const slots = [0, 1, 2].map(i => ({ x: x0 + i * (sw + gap), y: trayY, w: sw, h: trayH }));
    const trayCell = Math.min(cell * 0.62, (sw * 0.86) / 5, (trayH * 0.84) / 4.2);
    // a story card is the whole band (the play waits for the tap that closes it, the tray too)
    const card = { x: x0, y: top + 6, w: x1 - x0, h: Math.max(160, H - ins.bottom - 6 - (top + 6)) };
    const lift = touch ? Math.max(56, cell * 1.3) : cell * 1.15;
    if (columns) {
      // the margins: the shine (and the bowl in a rest) on the left, the goal and Bazyl on the right
      const reach = rim * GEODE_REACH;
      const lx = Math.max(ins.left + 4, bx - reach * 0.5 - 2 - gw);
      const rx = Math.min(W - ins.right - 4 - gw, bx + S + reach * 0.5 + 2);
      const column = { x: lx, y: by, w: gw, h: S };
      const moleS = Math.min(72, gw * 1.25);
      const goal = { x: rx, y: by, w: gw, h: Math.max(60, S - moleS * 1.15) };
      const mole = { x: rx + gw / 2, y: by + S + rim, s: moleS };
      return {
        w: W, h: H, u, mode: 'columns', portrait, ins, top, board: { x: bx, y: by, w: S, h: S }, cell, rim, slots, trayCell,
        dial: { x: lx + gw / 2, y: by + gw, r: gw / 2 }, column, goal, bowl: { ...column },
        mole, bubble: { x: bx, y: by + S - moleS * 0.6, w: S, below: false }, card, lift,
      };
    }
    // the strip right above the board: the dial on the left, the goal (or the bowl) in the middle, Bazyl on the right
    const sy = Math.max(top + 4, by - ABOVE * rim - 4 - stripH);
    const dr = Math.round(Math.min(stripH * 0.4, 30 * u));
    const moleS = Math.round(Math.min(stripH * 1.0, 84));
    const gx = x0 + dr * 2 + gap * 1.5;
    const gwid = x1 - moleS * 0.95 - gap - gx;
    const goal = { x: gx, y: sy + 4, w: gwid, h: stripH - 8 };
    return {
      w: W, h: H, u, mode: 'strip', portrait, ins, top, board: { x: bx, y: by, w: S, h: S }, cell, rim, slots, trayCell,
      dial: { x: x0 + dr + 2, y: sy + stripH / 2, r: dr }, column: { x: 0, y: 0, w: 0, h: 0 }, goal, bowl: { ...goal },
      mole: { x: x1 - moleS * 0.45, y: sy + stripH - 2, s: moleS },
      bubble: { x: x0, y: sy + stripH + 4, w: x1 - x0, below: true }, card, lift,
    };
  }
  // ── on its side: the board in the middle, a column either side ──
  const x0 = ins.left, x1 = W - ins.right;
  const avail = Math.max(80, band - 12);
  const { cell, S, rim } = fin(Math.min(avail / vertK, (x1 - x0) * 0.44), 10);
  const bx = Math.round((x0 + x1) / 2 - S / 2);
  const by = Math.round(Math.max(top + 6 + ABOVE * rim, Math.min(H - ins.bottom - 6 - BELOW * rim - S, top + (band - S) / 2)));
  const reach = rim * GEODE_REACH;
  const m = Math.round(12 * u);
  // the side columns
  const lx = x0 + m, lw = Math.max(60, bx - reach - m - lx);
  const rx = bx + S + reach + m, rw = Math.max(60, x1 - m - rx);
  const colTop = top + 6, colH = Math.max(80, H - ins.bottom - colTop - 8);
  // left: the dial, then the bowl, Bazyl at the foot
  const dr = Math.max(24, Math.min(lw * 0.3, colH * 0.2, 86));
  const dial = { x: lx + lw / 2, y: colTop + dr + 6, r: dr };
  const moleS = Math.max(46, Math.min(lw * 0.5, colH * 0.36, 150));
  const bowlY = dial.y + dr * 1.25 + 10;
  // Bazyl's bubble stands above his head: the bowl keeps clear of it
  const bowl = { x: lx, y: bowlY, w: lw, h: Math.max(40, H - ins.bottom - bowlY - moleS * 1.1 - 66) };
  const mole = { x: lx + lw / 2, y: H - ins.bottom - 6, s: moleS };
  // right: the goal, then the tray, under the right thumb
  const goalH = Math.round(Math.max(36, Math.min(56, colH * 0.16)));
  const goal = { x: rx, y: colTop, w: rw, h: goalH };
  const ty = colTop + goalH + 8, th = Math.max(3 * (MIN_TAP + 6), H - ins.bottom - ty - 6);
  const slotH = th / 3;
  const slotW = Math.min(rw, Math.max(MIN_TAP + 30, slotH * 2.1));
  const slots = [0, 1, 2].map(i => ({ x: rx + (rw - slotW) / 2, y: ty + i * slotH, w: slotW, h: slotH }));
  const maxW = Math.max(160, Math.min(320, lw + 30));
  const cw = Math.min(x1 - x0 - 24, 600 * u);
  return {
    w: W, h: H, u, mode: 'wide', portrait, ins, top, board: { x: bx, y: by, w: S, h: S }, cell, rim, slots,
    trayCell: Math.min(cell * 0.72, (slotW * 0.86) / 5, (slotH * 0.86) / 3),
    dial, column: { x: 0, y: 0, w: 0, h: 0 }, goal, bowl, mole,
    bubble: { x: Math.max(x0 + 8, mole.x - maxW * 0.35), y: mole.y - moleS * 1.08, w: maxW, below: false },
    card: { x: (x0 + x1) / 2 - cw / 2, y: top + 6, w: cw, h: Math.max(160, H - ins.bottom - 6 - (top + 6)) },
    lift: touch ? Math.max(56, cell * 1.3) : cell * 1.15,
  };
}

/** The board cell under a point (a little margin around the board counts), or null. */
export function boardAt(l: Layout, x: number, y: number, margin = 0.35): [number, number] | null {
  const b = l.board, m = l.cell * margin;
  if (x < b.x - m || y < b.y - m || x > b.x + b.w + m || y > b.y + b.h + m) return null;
  const cx = Math.max(0, Math.min(N - 1, Math.floor((x - b.x) / l.cell)));
  const cy = Math.max(0, Math.min(N - 1, Math.floor((y - b.y) / l.cell)));
  return [cx, cy];
}

/** The tray slot under a point, or −1. */
export function slotAt(l: Layout, x: number, y: number): number {
  return l.slots.findIndex(s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

/** The tray cell size for a piece of w × h cells in a slot. */
export function trayCellFor(l: Layout, slot: Box, pw: number, ph: number): number {
  return Math.min(l.trayCell, (slot.w * 0.82) / pw, (slot.h * 0.8) / ph);
}

/** What decides the targets: the pieces in the tray (null: an empty slot) and a story card on screen. */
export interface TargetState { tray: readonly (unknown | null)[]; story: boolean }

/**
 * Every control the player can tap right now, as the game hit-tests it (ArcadeGame.targets): the story card (a
 * tap anywhere on it goes on) while one is up, else the tray's pieces (a press picks one up to drag; a tap selects
 * it for the board's tap helper).  The board itself is the free play area (a tap there places the piece).
 */
export function tapTargets(l: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story card', ...l.card }];
  const out: TapTarget[] = [];
  l.slots.forEach((r, i) => { if (s.tray[i]) out.push({ label: `piece ${i + 1}`, x: r.x, y: r.y, w: r.w, h: r.h }); });
  return out;
}
