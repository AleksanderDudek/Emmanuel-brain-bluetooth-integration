/**
 * Where everything sits on Geoda's canvas (CSS px), from its size and the band the runner's HUD
 * covers at the top (`hudTop`):
 *
 *   landscape   the board in the middle; on the left the shine dial over the bowl and Bazyl; on
 *               the right the chamber's goal over the tray of three pieces, stacked
 *   portrait    the board on top; under it a strip (the dial, the goal or the bowl, Bazyl); the
 *               tray of three pieces at the bottom, under the thumb
 *
 * The geode's rim around the board may run under the HUD; the board itself never does.  The
 * smoke test taps at 50 % × 60 % of the canvas, which lands on the board in both layouts.
 */
import { N } from './board';

export interface Box { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  portrait: boolean;
  /** the board and the size of one of its cells */
  board: Box;
  cell: number;
  /** the geode's rim thickness (art.ts: it reaches GEODE_REACH × rim beyond the board) */
  rim: number;
  /** the three tray slots */
  slots: Box[];
  /** the largest a tray piece's cell gets */
  trayCell: number;
  /** the shine dial: its centre and radius */
  dial: { x: number; y: number; r: number };
  /** the Szlif's bowl, the chamber's goal, Bazyl (centre of his feet and his size) */
  bowl: Box;
  goal: Box;
  mole: { x: number; y: number; s: number };
  /** where cards (story, tally) are drawn: over the board */
  card: Box;
}

export function computeLayout(w: number, h: number, top: number): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const portrait = W < H * 1.05;
  const t0 = Math.min(Math.max(0, top), H * 0.45);
  if (portrait) {
    const pad = 12;
    const trayH = Math.max(76, Math.min(130, H * 0.16));
    const stripH = Math.max(56, Math.min(84, H * 0.1));
    const avail = H - t0 - trayH - stripH - 16;
    const size = Math.max(8 * 12, Math.min(W - 2 * pad - 8, avail));
    const cell = Math.floor(size / N);
    const S = cell * N;
    const rim = Math.max(4, S * 0.028);
    const bx = Math.round((W - S) / 2), by = Math.round(t0 + 6 + rim * 0.8);
    const stripY = by + S + rim * 2.2 + 2;
    const trayY = Math.min(H - trayH - 4, stripY + stripH + 2);
    const sw = (W - 2 * pad) / 3;
    const slots = [0, 1, 2].map(i => ({ x: pad + i * sw, y: trayY, w: sw, h: Math.max(40, H - trayY - 4) }));
    const dr = Math.min(stripH * 0.38, W * 0.08);
    return {
      w: W, h: H, portrait, board: { x: bx, y: by, w: S, h: S }, cell, rim, slots,
      trayCell: Math.min(cell * 0.66, (sw * 0.86) / 5, (slots[0].h * 0.86) / 4),
      dial: { x: pad + dr + 4, y: stripY + stripH / 2, r: dr },
      goal: { x: pad + dr * 2 + 16, y: stripY + 4, w: W - 2 * pad - dr * 2 - 16 - stripH * 1.1, h: stripH - 8 },
      bowl: { x: pad + dr * 2 + 16, y: stripY + 4, w: W - 2 * pad - dr * 2 - 16 - stripH * 1.1, h: stripH - 8 },
      mole: { x: W - pad - stripH * 0.5, y: stripY + stripH - 4, s: stripH * 0.95 },
      card: { x: bx, y: by, w: S, h: S },
    };
  }
  const size = Math.max(8 * 10, Math.min(H - t0 - 18, W * 0.44));
  const cell = Math.floor(size / N);
  const S = cell * N;
  const rim = Math.max(4, S * 0.03);
  const bx = Math.round((W - S) / 2);
  const by = Math.round(Math.max(t0 + 6 + rim, Math.min(H - S - rim * 2.6 - 6, t0 + (H - t0 - S) / 2)));
  const reach = rim * 2.8;
  // the side columns
  const lx = 14, lw = Math.max(60, bx - reach - 14 - lx);
  const rx = bx + S + reach + 14, rw = Math.max(60, W - 14 - rx);
  const colTop = t0 + 6, colH = Math.max(80, H - colTop - 8);
  // left: the dial, then the bowl, Bazyl at the foot
  const dr = Math.max(22, Math.min(lw * 0.3, colH * 0.2, 86));
  const dial = { x: lx + lw / 2, y: colTop + dr + 6, r: dr };
  const moleS = Math.max(46, Math.min(lw * 0.5, colH * 0.36, 150));
  const bowlY = dial.y + dr + 14;
  // Bazyl's bubble stands above his head: the bowl keeps clear of it
  const bowl = { x: lx, y: bowlY, w: lw, h: Math.max(40, H - bowlY - moleS * 1.1 - 66) };
  const mole = { x: lx + lw / 2, y: H - 6, s: moleS };
  // right: the goal, then the tray
  const goalH = Math.max(30, Math.min(56, colH * 0.16));
  const goal = { x: rx, y: colTop, w: rw, h: goalH };
  const ty = colTop + goalH + 8, th = Math.max(60, H - ty - 6);
  const slotH = th / 3;
  const slotW = Math.min(rw, slotH * 2.1);
  const slots = [0, 1, 2].map(i => ({ x: rx + (rw - slotW) / 2, y: ty + i * slotH, w: slotW, h: slotH }));
  return {
    w: W, h: H, portrait, board: { x: bx, y: by, w: S, h: S }, cell, rim, slots,
    trayCell: Math.min(cell * 0.72, (slotW * 0.86) / 5, (slotH * 0.86) / 3),
    dial, goal, bowl, mole, card: { x: bx, y: by, w: S, h: S },
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
