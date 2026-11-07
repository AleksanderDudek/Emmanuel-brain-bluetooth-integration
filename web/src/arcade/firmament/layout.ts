/**
 * Where everything sits, for any canvas: the board as large as it can be, the goal card (level,
 * moves, what to clear, the score bar with its stars), the telescope (the lens with its threshold
 * ring, the charge ring and the light trail around it), the tray of tools and Bubo with his bubble.
 *
 *   wide (desktop, phone landscape)   the goal card and Bubo on the left, the telescope and the tray
 *                                     on the right, the board in the middle
 *   tall (phone portrait)             the goal strip over the board, Bubo, the telescope and the tray
 *                                     under it
 *
 * The runner's standard HUD covers the top band (the Mendi panel left, the score right, `top` px
 * deep): the side columns start under it; the board may rise above it only where it stays clear of both.
 */
export interface Rect { x: number; y: number; w: number; h: number }
export interface Layout {
  w: number;
  h: number;
  mode: 'wide' | 'tall';
  /** a unit for type and strokes (1 at a 700 px short side) */
  u: number;
  board: Rect;
  cell: number;
  rows: number;
  cols: number;
  goal: Rect;
  scope: { x: number; y: number; r: number };
  /** where the telescope's words go (centre x, top y, max width) */
  scopeText: { x: number; y: number; w: number };
  tray: Rect[];
  owl: { x: number; y: number; r: number };
  bubble: { x: number; y: number; w: number };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const BAR = 58;

export function layout(w: number, h: number, top: number, rows = 8, cols = 8, slots = 4): Layout {
  const u = clamp(Math.min(w, h) / 700, 0.62, 1.25);
  const hudTop = Math.max(BAR, top);
  if (w >= h * 1.05 && w >= 560) {
    // ── wide ──
    const side = clamp(w * 0.26, 170, 340);
    const panelRight = 12 + Math.min(330, w * 0.62 - 12);
    const scoreLeft = w - 12 - Math.min(160, w * 0.36);
    let midX0 = side + 10, midX1 = w - side - 10;
    let y0 = BAR + 4;
    let size = Math.min(midX1 - midX0, h - y0 - 10);
    let bx = (midX0 + midX1) / 2 - size / 2;
    if (bx < panelRight + 4 || bx + size > scoreLeft - 4) {
      // the board would meet the HUD: start it under the HUD's band, or squeeze it between
      const between = scoreLeft - panelRight - 16;
      if (between >= (h - hudTop - 10) * 0.9 && between > 200) {
        midX0 = panelRight + 8;
        midX1 = scoreLeft - 8;
        size = Math.min(midX1 - midX0, h - y0 - 10);
      } else {
        y0 = hudTop + 2;
        size = Math.min(midX1 - midX0, h - y0 - 8);
      }
      bx = (midX0 + midX1) / 2 - size / 2;
    }
    const cell = Math.floor(Math.min(size / cols, size / rows));
    const bw = cell * cols, bh = cell * rows;
    const board = { x: Math.round((midX0 + midX1) / 2 - bw / 2), y: Math.round(y0 + (size - bh) / 2), w: bw, h: bh };
    const colH = h - hudTop - 10;
    const lx = 12, lw = Math.max(120, Math.min(side - 18, board.x - 22));
    const goalH = clamp(colH * 0.5, 96 * u, 176 * u);
    const goal = { x: lx, y: hudTop + 4, w: lw, h: goalH };
    const owlR = clamp(Math.min(colH - goalH, lw) * 0.2, 16, 40 * u);
    // Bubo sits under the goal card, his bubble to his right
    const owl = { x: lx + owlR * 1.3, y: Math.min(h - owlR * 1.3 - 8, goal.y + goalH + owlR * 1.9), r: owlR };
    const rx0 = board.x + bw + 12, rw = w - 12 - rx0;
    const trayS = clamp(Math.min(rw / slots - 8, colH * 0.22), 34, 70 * u);
    const scopeR = clamp(Math.min(rw * 0.3, (colH - trayS - 50 * u) * 0.32), 22, 92 * u);
    const scope = { x: rx0 + rw / 2, y: hudTop + 10 + scopeR * 1.32, r: scopeR };
    const scopeText = { x: scope.x, y: scope.y + scopeR * 1.12 + 6, w: rw - 8 };
    const ty = Math.min(h - trayS - 10, scopeText.y + 40 * u);
    const tw = slots * trayS + (slots - 1) * 8;
    const tray: Rect[] = Array.from({ length: slots }, (_, k) => ({ x: scope.x - tw / 2 + k * (trayS + 8), y: ty, w: trayS, h: trayS }));
    return {
      w, h, mode: 'wide', u, board, cell, rows, cols, goal, scope, scopeText, tray, owl,
      bubble: { x: owl.x + owlR * 1.05, y: owl.y + owlR * 0.2, w: Math.max(140, lx + lw - (owl.x + owlR * 1.05)) },
    };
  }
  // ── tall ──
  const goalH = clamp(58 * u, 46, 64);
  const goal = { x: 8, y: hudTop + 2, w: w - 16, h: goalH };
  const bottomH = clamp(h * 0.14, 70, 120);
  const y0 = goal.y + goalH + 6;
  const size = Math.max(120, Math.min(w - 12, h - y0 - bottomH - 6));
  const cell = Math.floor(Math.min((w - 12) / cols, size / rows));
  const bw = cell * cols, bh = cell * rows;
  const board = { x: Math.round(w / 2 - bw / 2), y: Math.round(y0 + Math.max(0, (size - bh) / 2)), w: bw, h: bh };
  const by = board.y + bh + 6;
  const bandH = h - by - 4;
  const owlR = clamp(bandH * 0.3, 14, 30);
  const owl = { x: 10 + owlR * 1.1, y: by + bandH * 0.5 + owlR * 0.15, r: owlR };
  const scopeR = clamp(bandH * 0.36, 18, 46);
  const scope = { x: owl.x + owlR * 1.4 + scopeR * 1.45, y: by + bandH * 0.5, r: scopeR };
  const tx0 = scope.x + scopeR * 1.45 + 6;
  const trayS = clamp(Math.min((w - 8 - tx0) / slots - 6, bandH * 0.62), 30, 58);
  const tray: Rect[] = Array.from({ length: slots }, (_, k) => ({ x: tx0 + k * (trayS + 6), y: by + bandH * 0.5 - trayS / 2 - 6, w: trayS, h: trayS }));
  return {
    w, h, mode: 'tall', u, board, cell, rows, cols, goal, scope, scopeText: { x: tx0 + (w - 8 - tx0) / 2, y: by + bandH * 0.5 + trayS / 2 - 2, w: w - 8 - tx0 },
    tray, owl, bubble: { x: 8, y: by - 8, w: Math.min(300, w - 16) },
  };
}

export const inRect = (r: Rect, x: number, y: number, pad = 0): boolean => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
