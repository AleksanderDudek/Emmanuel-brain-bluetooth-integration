/**
 * Where everything sits on Źródła's canvas (CSS px), phone first (src/arcade/DESIGN.md §12): sized for a phone
 * 360 px wide held upright at u = 1, grown on a tablet or a desktop (u ≤ 1.3).  The runner's HUD covers the
 * top (`insets.top`), the home indicator the bottom, a notch the sides; nothing the player taps or reads goes
 * under them.
 *
 *   tall   (a phone or a tablet upright)  the valley from the HUD down, the reeds of the band's history along
 *          its foot, then the tray in the thumb zone: the dispenser (the next stone big — a tap on it is
 *          Kumka's help — and the four after it, the goal over them), Kumka, the spring's dial at the right
 *   side   (a phone on its side)  the valley between two columns under the HUD's row: the dispenser under the
 *          left thumb (the next stone at the bottom, as in Pipe Mania), the dial, the goal and Kumka under the
 *          right
 *   wide   (a desktop, a tablet on its side)  the same three columns, grown; Kumka's bubble in her column
 *
 * Every cell is at least MIN_TAP (44 px).  When the whole valley fits at that size it shows whole; when not —
 * an eight-wide valley on a 360 px phone, seven rows on a phone on its side — it shows through a window
 * (`view`) that the camera pans (render.ts keeps the way's open end and the water in it), and `board` is where
 * the whole valley lies under the window now.  The smoke's tap at 50 % × 60 % of the canvas lands on the valley.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, uiScale } from '../kit/mobile';
import type { Insets } from '../kit/types';

export interface Box { x: number; y: number; w: number; h: number }
export type Shape = 'tall' | 'side' | 'wide';

/** Nothing to press within this many px of the screen's left and right edges (Safari's back swipe, DESIGN §12.2). */
export const EDGE = 16;
/** The biggest cell at u = 1 (a tablet's valley needs no more). */
export const CELL_MAX = 72;

export interface Layout {
  w: number;
  h: number;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  shape: Shape;
  /** the tray under the valley (tall); else the dispenser and the dial stand in columns beside it */
  portrait: boolean;
  /** what the runner and the device cover */
  top: number;
  bottom: number;
  left: number;
  right: number;
  cols: number;
  rows: number;
  /** one cell's size: at least MIN_TAP */
  cell: number;
  /** the window the valley shows through */
  view: Box;
  /** the whole valley, where it lies under the window now (render.ts moves it with the camera) */
  board: Box;
  /** how far the valley pans in its window (px; 0: it shows whole) */
  panX: number;
  panY: number;
  /** the dispenser: its plate and its slots (the first is the next stone), and the next stone's target */
  queue: Box;
  slots: Box[];
  next: Box;
  /** where the dispenser's word ("Następny") goes: its centre line */
  nextLabel: { x: number; y: number };
  /** the spring's dial: its centre and radius, its target (the "próg" over it included), its name under it */
  gauge: { x: number; y: number; r: number };
  dial: Box;
  dialLabel: boolean;
  /** the goal ("Cel 3/6") and its bar: where the line ends (or its centre) and how wide the bar is */
  goal: { x: number; y: number; w: number; align: 'right' | 'center' };
  /** what a tap on the stone does, in words (wide only: a desktop has the room) */
  helpLine: { x: number; y: number } | null;
  /** Kumka: the centre of her feet and her size (0: no room) */
  frog: { x: number; y: number; s: number };
  /** the room her bubble keeps to, and whether it sits above her (else beside her, to her right) */
  talk: Box;
  talkAbove: boolean;
  /** the reeds (the band's history) along the valley's foot */
  reeds: Box;
  /** where story cards go */
  card: Box;
}

interface Fit { cell: number; view: Box; board: Box; panX: number; panY: number }

/** The valley in a room: cells at least MIN_TAP (a window that pans when the whole does not fit), centred across. */
function fitValley(cols: number, rows: number, u: number, x0: number, x1: number, y0: number, y1: number, alignY: 'bottom' | 'middle'): Fit {
  const roomW = Math.max(MIN_TAP, x1 - x0), roomH = Math.max(MIN_TAP, y1 - y0);
  const cell = Math.floor(clamp(Math.min(roomW / cols, roomH / rows), MIN_TAP, CELL_MAX * u));
  const bw = cols * cell, bh = rows * cell;
  // a valley a few px too big for its room takes them from the margins rather than panning by a sliver
  const vw = bw - roomW <= 4 ? bw : Math.floor(roomW), vh = bh - roomH <= 4 ? bh : Math.floor(roomH);
  const vx = Math.round((x0 + x1 - vw) / 2);
  const vy = Math.round(alignY === 'bottom' ? y1 - vh : (y0 + y1 - vh) / 2);
  return { cell, view: { x: vx, y: vy, w: vw, h: vh }, board: { x: vx, y: vy, w: bw, h: bh }, panX: bw - vw, panY: bh - vh };
}

export function computeLayout(w: number, h: number, ins: Insets = NO_INSETS, cols = 7, rows = 5): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const u = uiScale(W, H);
  const top = clamp(ins.top, 0, H * 0.45);
  const bottom = Math.max(top + 160, H - ins.bottom);
  const left = ins.left, right = W - ins.right;
  const xMin = Math.max(EDGE, left + 6), xMax = Math.min(W - EDGE, right - 6);
  const shape: Shape = W < H * 1.05 ? 'tall' : H < 470 ? 'side' : 'wide';
  const r = (v: number) => Math.round(v * u);

  if (shape === 'tall') {
    // the tray in the thumb zone: the next stone, the four after it (the goal over them), Kumka, the dial
    const s0 = r(50), s1 = r(32), gr = Math.round(27 * Math.min(u, 1.2)), lab = r(16), reedH = r(8);
    const trayH = Math.max(s0, 2 * gr) + lab + r(8);
    const trayY = bottom - 4 - trayH;
    const f = fitValley(cols, rows, u, xMin, xMax, top + 4, trayY - 4 - reedH - 3, 'bottom');
    const reeds = { x: f.view.x, y: f.view.y + f.view.h + 5, w: f.view.w, h: reedH };
    const base = trayY + trayH - r(6);
    const slots: Box[] = [{ x: xMin, y: base - s0, w: s0, h: s0 }];
    let x = xMin + s0 + r(10);
    for (let i = 1; i < 5; i++) {
      slots.push({ x, y: base - s1, w: s1, h: s1 });
      x += s1 + r(5);
    }
    const gauge = { x: xMax - gr - 2, y: base - gr, r: gr };
    const dial = { x: gauge.x - gr - 6, y: gauge.y - gr - lab, w: 2 * gr + 12, h: 2 * gr + lab + 6 };
    // Kumka: in the tray between the stones and the dial, or — where the valley leaves a band over it — there
    const band = f.view.y - (top + 4);
    let frog: Layout['frog'], talk: Box, talkAbove: boolean;
    if (band >= r(64)) {
      const s = Math.min(r(48), band - r(14));
      frog = { x: xMin + s * 0.6, y: f.view.y - r(8), s };
      talk = { x: frog.x + s * 0.75, y: top + 8, w: xMax - (frog.x + s * 0.75), h: f.view.y - r(10) - (top + 8) };
      talkAbove = false;
    } else {
      const gx0 = x + r(2), gx1 = dial.x - r(6);
      const s = gx1 - gx0 >= r(36) ? Math.min(r(46), gx1 - gx0 - 4, trayH - 8) : 0;
      frog = { x: (gx0 + gx1) / 2, y: base, s };
      talk = { x: xMin, y: f.view.y, w: xMax - xMin, h: trayY - 6 - f.view.y };
      talkAbove = true;
    }
    return {
      w: W, h: H, u, shape, portrait: true, top, bottom, left, right, cols, rows, ...f,
      queue: { x: xMin - r(8), y: trayY, w: xMax - xMin + r(16), h: trayH },
      slots, next: { x: slots[0].x - 4, y: slots[0].y - 4, w: s0 + 8, h: s0 + 8 },
      nextLabel: { x: slots[0].x + s0 / 2, y: slots[0].y - r(9) },
      gauge, dial, dialLabel: false,
      goal: { x: slots[4].x + s1, y: trayY + r(12), w: slots[4].x + s1 - slots[1].x, align: 'right' },
      helpLine: null, frog, talk, talkAbove, reeds,
      card: { x: Math.max(left + 8, W / 2 - Math.min(W - 24, 420 * u) / 2), y: top + 10, w: Math.min(W - 24, 420 * u), h: bottom - top - 20 },
    };
  }

  // side and wide: three columns — the dispenser, the valley, the dial (with the goal and Kumka)
  const wide = shape === 'wide';
  const reedH = r(10);
  const s0 = r(wide ? 58 : 48), s1 = r(wide ? 42 : 30), lab = r(16);
  const gr = wide ? Math.round(clamp(44 * u, 30, 66)) : r(27);
  const colLW = s0 + r(12);
  const colRW = wide ? Math.max(2 * gr + r(40), Math.min(r(250), (xMax - xMin) * 0.24)) : 2 * gr + r(28);
  const colL = xMin, colR = xMax - colRW;
  const f = fitValley(cols, rows, u, colL + colLW + r(12), colR - r(12), top + 6, bottom - 6 - reedH - 6, 'middle');
  const reeds = { x: f.view.x, y: f.view.y + f.view.h + 5, w: f.view.w, h: reedH };
  // the dispenser: the next stone at the bottom (under the left thumb), the four after it stacked over it
  const base = bottom - 8;
  const slots: Box[] = [{ x: colL + (colLW - s0) / 2, y: base - s0, w: s0, h: s0 }];
  let y = base - s0 - lab - r(8) - s1;
  for (let i = 1; i < 5; i++) {
    slots.push({ x: colL + (colLW - s1) / 2, y, w: s1, h: s1 });
    y -= s1 + r(5);
  }
  const queueTop = Math.max(top + 4, slots[4].y - r(10));
  // the right column: on a phone the dial at the bottom (the right thumb) and the goal and Kumka over it; on a
  // desktop the dial at the top, its name, the goal and the help's words under it, Kumka at the foot
  const cx = colR + colRW / 2;
  let gauge: Layout['gauge'], goalY: number, frog: Layout['frog'], talk: Box, helpLine: Layout['helpLine'] = null;
  if (wide) {
    gauge = { x: cx, y: top + r(24) + gr, r: gr };
    goalY = gauge.y + gr * 1.15 + r(34);
    helpLine = { x: cx, y: goalY + r(36) };
    const s = Math.min(r(70), colRW * 0.4, base - (helpLine.y + r(90)));
    frog = { x: colR + colRW * 0.62, y: base, s: Math.max(0, s) };
    talk = { x: colR, y: helpLine.y + r(24), w: colRW, h: base - frog.s * 0.95 - (helpLine.y + r(24)) };
  } else {
    gauge = { x: cx, y: base - gr, r: gr };
    goalY = gauge.y - gr - lab - r(34);
    const room = goalY - r(10) - (top + 8);
    const s = room >= r(40) ? Math.min(r(44), room) : 0;
    frog = { x: cx, y: goalY - r(10), s };
    talk = { x: f.view.x, y: top + 8, w: colR - r(8) - f.view.x, h: f.view.h };
  }
  const dial = { x: gauge.x - gr - 6, y: gauge.y - gr - lab, w: 2 * gr + 12, h: 2 * gr + lab + 6 };
  return {
    w: W, h: H, u, shape, portrait: false, top, bottom, left, right, cols, rows, ...f,
    queue: { x: colL - r(4), y: queueTop, w: colLW + r(8), h: base + r(4) - queueTop },
    slots, next: { x: slots[0].x - 4, y: slots[0].y - 4, w: s0 + 8, h: s0 + 8 },
    nextLabel: { x: slots[0].x + s0 / 2, y: slots[0].y - r(10) },
    gauge, dial, dialLabel: wide,
    goal: { x: cx, y: goalY, w: colRW - r(16), align: 'center' },
    helpLine, frog, talk, talkAbove: true, reeds,
    card: { x: f.view.x + f.view.w / 2 - Math.min(W - 24, 460 * u) / 2, y: top + 8, w: Math.min(W - 24, 460 * u), h: bottom - top - 16 },
  };
}

/** The cell under a point (−1: none, or outside the valley's window). */
export function cellAt(L: Layout, x: number, y: number): number {
  const v = L.view;
  if (x < v.x || y < v.y || x >= v.x + v.w || y >= v.y + v.h) return -1;
  const c = Math.floor((x - L.board.x) / L.cell), r = Math.floor((y - L.board.y) / L.cell);
  if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return -1;
  return r * L.cols + c;
}

/** The centre of cell `i`. */
export function cellCentre(L: Layout, i: number): { x: number; y: number } {
  return { x: L.board.x + ((i % L.cols) + 0.5) * L.cell, y: L.board.y + (Math.floor(i / L.cols) + 0.5) * L.cell };
}

/** Cell `i`'s square where it lies now, and the part of it the window shows. */
export function cellBox(L: Layout, i: number): { full: Box; shown: Box | null } {
  const x = L.board.x + (i % L.cols) * L.cell, y = L.board.y + Math.floor(i / L.cols) * L.cell;
  const v = L.view;
  const x0 = Math.max(x, v.x), y0 = Math.max(y, v.y), x1 = Math.min(x + L.cell, v.x + v.w), y1 = Math.min(y + L.cell, v.y + v.h);
  return { full: { x, y, w: L.cell, h: L.cell }, shown: x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null };
}
