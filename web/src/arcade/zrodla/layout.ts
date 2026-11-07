/**
 * Where everything sits on Źródła's canvas (CSS px), from its size, the valley's grid and the band
 * the runner's HUD covers at the top (`hudTop`):
 *
 *   landscape   the valley in the middle; on the left the dispenser (five stones, the next on
 *               top) with Kumka under it; on the right the spring's gauge (the sluice) over the
 *               reeds of the band's history
 *   portrait    the valley on top; under it a strip: the dispenser in a row (the next on the
 *               left), the gauge on the right, Kumka sitting on the strip's edge
 *
 * The valley never runs under the HUD.  The smoke test taps at 50 % × 60 % of the canvas, which
 * lands on the valley in both layouts.
 */
export interface Box { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  portrait: boolean;
  cols: number;
  rows: number;
  /** the grid and one cell's size */
  board: Box;
  cell: number;
  /** the dispenser: its slots (the first is the next stone) */
  slots: Box[];
  queue: Box;
  /** the gauge's centre and radius */
  gauge: { x: number; y: number; r: number };
  /** Kumka: the centre of her feet and her size */
  frog: { x: number; y: number; s: number };
  /** the reeds (the band's history) along the valley's foot */
  reeds: Box;
  /** where cards are drawn */
  card: Box;
}

export function computeLayout(w: number, h: number, top: number, cols: number, rows: number): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const portrait = W < H * 1.05;
  const t0 = Math.min(Math.max(0, top), H * 0.45);
  if (portrait) {
    const pad = 10;
    const stripH = Math.max(84, Math.min(132, H * 0.17));
    const reedH = 16;
    const availH = H - t0 - stripH - reedH - 22;
    const cell = Math.max(16, Math.floor(Math.min((W - 2 * pad) / cols, availH / rows)));
    const bw = cell * cols, bh = cell * rows;
    const bx = Math.round((W - bw) / 2), by = Math.round(t0 + 8);
    const reeds = { x: bx, y: by + bh + 2, w: bw, h: reedH };
    const sy = reeds.y + reedH + 6;
    const sh = Math.max(70, Math.min(stripH, H - sy - 4));
    const gr = Math.min(sh * 0.42, W * 0.13);
    const gauge = { x: W - pad - gr - 4, y: sy + sh * 0.48, r: gr };
    const qw = gauge.x - gr - 14 - pad;
    const s0 = Math.min(sh * 0.62, qw * 0.27);
    const s1 = Math.min(s0 * 0.72, (qw - s0 - 10) / 4 - 6);
    const slots: Box[] = [];
    let x = pad;
    for (let i = 0; i < 5; i++) {
      const s = i === 0 ? s0 : s1;
      slots.push({ x, y: sy + sh * 0.56 - s / 2, w: s, h: s });
      x += s + (i === 0 ? 12 : 6);
    }
    const frogS = Math.min(sh * 0.5, 54);
    return {
      w: W, h: H, portrait, cols, rows, board: { x: bx, y: by, w: bw, h: bh }, cell, slots,
      queue: { x: pad, y: sy, w: qw, h: sh }, gauge,
      frog: { x: Math.min(x + frogS * 0.6, gauge.x - gr - frogS * 0.5), y: sy + sh * 0.22, s: frogS },
      reeds, card: { x: Math.max(8, bx - 4), y: by, w: Math.min(W - 16, bw + 8), h: bh },
    };
  }
  const reedH = 18;
  // under the HUD band; or, on a short screen, between the Mendi panel and the score (below the top bar)
  const cellUnder = Math.floor(Math.min((H - t0 - reedH - 24) / rows, (W * 0.56) / cols));
  const midX0 = 350, midX1 = W - 130, barTop = 60;
  const cellMid = Math.floor(Math.min((H - barTop - reedH - 18) / rows, (midX1 - midX0) / cols));
  const between = H - t0 < 330 && cellMid > cellUnder + 4;
  const cell = Math.max(16, between ? cellMid : cellUnder);
  const bw = cell * cols, bh = cell * rows;
  const bx = between ? Math.round(midX0 + (midX1 - midX0 - bw) / 2) : Math.round((W - bw) / 2);
  const by = between ? barTop : Math.round(Math.max(t0 + 8, t0 + (H - t0 - reedH - bh) / 2 - 4));
  const reeds = { x: bx, y: by + bh + 3, w: bw, h: reedH };
  // left: the dispenser, under the panel
  const lw = Math.max(64, Math.min(150, bx - 28));
  const colTop = t0 + 4, colH = Math.max(60, H - colTop - 8);
  const slots: Box[] = [];
  let queue: Box;
  if (colH < 250) {
    // a short screen: the dispenser in a row under the panel, the next on the left
    const qw = Math.max(120, Math.min(330, bx - 24));
    const s0 = Math.max(20, Math.min(colH * 0.42, qw / 4.2, 64));
    const s1 = s0 * 0.74;
    let x = 14;
    for (let i = 0; i < 5; i++) {
      const s = i === 0 ? s0 : s1;
      slots.push({ x, y: colTop + 24 + (s0 - s) / 2, w: s, h: s });
      x += s + (i === 0 ? 10 : 5);
    }
    queue = { x: 6, y: colTop, w: x + 2, h: s0 + 32 };
  } else {
    const s0 = Math.max(18, Math.min(cell * 1.05, lw * 0.62, 84, (colH - 30) / 4.4));
    const s1 = s0 * 0.74;
    const qx = Math.max(14, bx - 14 - lw) + (lw - s0) / 2;
    let y = colTop + 26;
    for (let i = 0; i < 5; i++) {
      const s = i === 0 ? s0 : s1;
      slots.push({ x: qx + (s0 - s) / 2, y, w: s, h: s });
      y += s + (i === 0 ? 10 : 5);
    }
    queue = { x: qx - (lw - s0) / 2, y: colTop, w: lw, h: y - colTop + 2 };
  }
  const row = colH < 250;
  // right: the gauge, the goal under it, Kumka at the foot
  const rx = bx + bw + 14, rw = Math.max(70, W - 14 - rx);
  const gr = Math.max(22, Math.min(rw * 0.34, (H - t0) * 0.19, 92));
  const gy = t0 + 22 + gr * 1.08;
  const footTop = gy + gr * 1.42 + 52;
  const frogS = Math.max(0, Math.min(rw * 0.42, 86, H - footTop - 14));
  return {
    w: W, h: H, portrait: row, cols, rows, board: { x: bx, y: by, w: bw, h: bh }, cell, slots, queue,
    gauge: { x: rx + rw / 2, y: gy, r: gr },
    frog: { x: rx + rw * 0.7, y: H - 12, s: frogS },
    reeds, card: { x: bx, y: by, w: bw, h: bh },
  };
}

/** The cell under a point (−1: none). */
export function cellAt(L: Layout, x: number, y: number): number {
  const c = Math.floor((x - L.board.x) / L.cell), r = Math.floor((y - L.board.y) / L.cell);
  if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return -1;
  return r * L.cols + c;
}

/** The centre of cell `i`. */
export function cellCentre(L: Layout, i: number): { x: number; y: number } {
  return { x: L.board.x + ((i % L.cols) + 0.5) * L.cell, y: L.board.y + (Math.floor(i / L.cols) + 0.5) * L.cell };
}
