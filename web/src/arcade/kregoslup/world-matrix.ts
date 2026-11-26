/**
 * The nucleus under the microscope, under the lens (DESIGN.md §24.5).  Units: micrometres (the view ≈ 300 × 200 µm).
 * A gel of water held by aggrecan; collagen fibrils in a loose random net, a few long elastin fibres; and, far apart,
 * the few cells of the nucleus (≈ 5000 in a cubic millimetre: Urban & Roberts 2003), round, some in a capsule, with
 * long thin processes more than 30 µm long.
 *
 *   macierz  the cells wake (warm light within), and slowly, around each, new aggrecan brushes and collagen fibrils
 *            appear (gold while new) and water gathers to them — the matrix renewed patiently, over years
 */
import { GOLD, GOLD_HI, rgba, glow } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { WATER, WATER_HI } from './bones';
import { clamp, hash, smooth, type Pt, type Rect } from './geo';
import { brush } from './world-segment';
import { hair } from './world-spine';

export const MATRIX_VIEW: Rect = { x: -150, y: -100, w: 300, h: 200 };

/** The cells: the one in the middle, and four more far apart. */
const CELLS: readonly { x: number; y: number; r: number; cap: boolean }[] = [
  { x: 0, y: 0, r: 7, cap: true },
  { x: -104, y: -58, r: 5.5, cap: false },
  { x: 96, y: 52, r: 6, cap: true },
  { x: -88, y: 70, r: 5, cap: false },
  { x: 112, y: -70, r: 5, cap: false },
];

/** Each cell's processes: thin branching threads reaching out 30–50 µm. */
const PROCS: readonly Pt[][][] = CELLS.map((c, ci) => {
  const out: Pt[][] = [];
  const n = 3 + Math.floor(hash(ci * 7) * 3);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + hash(ci * 11 + k) * 0.8;
    const len = 30 + hash(ci * 13 + k * 3) * 22;
    const pts: Pt[] = [];
    let x = c.x + Math.cos(a) * c.r, y = c.y + Math.sin(a) * c.r, ang = a;
    for (let s = 0; s <= 8; s++) {
      pts.push([x, y]);
      ang += (hash(ci * 17 + k * 5 + s) - 0.5) * 0.6;
      x += (Math.cos(ang) * len) / 8;
      y += (Math.sin(ang) * len) / 8;
    }
    out.push(pts);
  }
  return out;
});

/** The brushes of aggrecan scattered in the gel (the old ones), and the new ones each cell makes around it. */
const OLD: readonly { x: number; y: number; a: number }[] = Array.from({ length: 90 }, (_, i) => ({
  x: -146 + hash(i * 3 + 1) * 292, y: -96 + hash(i * 5 + 2) * 192, a: hash(i * 7 + 3) * Math.PI,
}));
const NEW: readonly { x: number; y: number; a: number; c: number }[] = Array.from({ length: 40 }, (_, i) => {
  const c = i % CELLS.length, cell = CELLS[c];
  const t = hash(i * 11 + 4) * Math.PI * 2, r = cell.r + 4 + hash(i * 13 + 5) * 16;
  return { x: cell.x + Math.cos(t) * r, y: cell.y + Math.sin(t) * r, a: hash(i * 17 + 6) * Math.PI, c };
});
/** New collagen fibrils spun out from the cells. */
const FIBRILS: readonly { pts: Pt[]; c: number }[] = Array.from({ length: 15 }, (_, i) => {
  const c = i % CELLS.length, cell = CELLS[c];
  let a = hash(i * 19 + 7) * Math.PI * 2;
  let x = cell.x + Math.cos(a) * (cell.r + 2), y = cell.y + Math.sin(a) * (cell.r + 2);
  const pts: Pt[] = [[x, y]];
  for (let s = 0; s < 10; s++) {
    a += (hash(i * 23 + s) - 0.5) * 0.7;
    x += Math.cos(a) * 5;
    y += Math.sin(a) * 5;
    pts.push([x, y]);
  }
  return { pts, c };
});

function cellPath(c: { x: number; y: number; r: number }): Path2D {
  const p = new Path2D();
  for (let k = 0; k <= 24; k++) {
    const t = (k / 24) * Math.PI * 2;
    const rr = c.r * (1 + 0.08 * Math.sin(t * 3 + c.x) + 0.05 * Math.cos(t * 5 + c.y));
    const x = c.x + Math.cos(t) * rr, y = c.y + Math.sin(t) * rr * 0.86;
    if (k === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

export const MATRIX: WorldPainter = {
  depth: 3,
  lens: true,
  bake(ctx) {
    // the gel: deep water-light, brighter in soft clouds
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 190);
    g.addColorStop(0, 'rgba(60,110,150,.32)');
    g.addColorStop(0.6, 'rgba(40,60,120,.22)');
    g.addColorStop(1, 'rgba(30,20,70,.1)');
    ctx.fillStyle = g;
    ctx.fillRect(-160, -110, 320, 220);
    for (let i = 0; i < 9; i++) glow(ctx, i % 2 ? '#6fd0ff' : '#8f7dff', -140 + hash(i * 3) * 280, -90 + hash(i * 5) * 180, 40 + hash(i * 7) * 50, 0.06);
    // the elastin fibres, long and radial-ish, pale gold
    ctx.strokeStyle = rgba('#ffe6b8', 0.14);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      const a = hash(i * 31) * Math.PI;
      const cx = -100 + hash(i * 37) * 200, cy = -70 + hash(i * 41) * 140;
      ctx.beginPath();
      for (let s = -6; s <= 6; s++) {
        const x = cx + Math.cos(a) * s * 12 + Math.sin(s * 1.3 + i) * 2, y = cy + Math.sin(a) * s * 12 + Math.cos(s * 1.1 + i) * 2;
        if (s === -6) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // the collagen: a loose random net of fine fibrils
    ctx.strokeStyle = rgba('#d8ccff', 0.13);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 46; i++) {
      let x = -150 + hash(i * 43) * 300, y = -100 + hash(i * 47) * 200, a = hash(i * 53) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 7; s++) {
        a += (hash(i * 59 + s) - 0.5) * 0.5;
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 9;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // the old aggrecan, faint
    ctx.strokeStyle = rgba('#efe3ff', 0.22);
    ctx.lineWidth = 0.45;
    for (const b of OLD) brush(ctx, b.x, b.y, b.a, 6);
    // the cells, asleep (a cool pearl), their capsules and processes
    for (let ci = 0; ci < CELLS.length; ci++) {
      const c = CELLS[ci];
      if (c.cap) {
        ctx.strokeStyle = rgba('#cfe6ff', 0.25);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.r + 3.2, (c.r + 3.2) * 0.9, 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba('#e8e0ff', 0.28);
      ctx.lineWidth = 0.7;
      for (const pr of PROCS[ci]) {
        ctx.beginPath();
        pr.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      const P = cellPath(c);
      ctx.fillStyle = rgba('#e6e0ff', 0.16);
      ctx.fill(P);
      ctx.strokeStyle = rgba('#f4efff', 0.5);
      ctx.lineWidth = hair(ctx, 1);
      ctx.stroke(P);
      ctx.fillStyle = rgba('#b9a8ff', 0.3);
      ctx.beginPath();
      ctx.ellipse(c.x + 0.8, c.y - 0.4, c.r * 0.42, c.r * 0.36, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  draw(ctx, st) {
    if (st.scene === 'macierz') drawMatrix(ctx, st);
  },
  focusAt(_scene, g) {
    const c = CELLS[Math.min(CELLS.length - 1, Math.floor(g * CELLS.length * 0.999))];
    return g < 0.2 ? [0, 0] : [c.x, c.y];
  },
  counter() {
    return null;
  },
};

function drawMatrix(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  // the cells wake one by one (the middle one first)
  for (let ci = 0; ci < CELLS.length; ci++) {
    const c = CELLS[ci];
    const a = smooth(ci * 0.12, ci * 0.12 + 0.2, g);
    if (a <= 0) continue;
    glow(ctx, '#ffcf9a', c.x, c.y, c.r * 3.2, 0.3 * a);
    ctx.strokeStyle = rgba(GOLD_HI, 0.55 * a);
    ctx.lineWidth = 0.9;
    for (const pr of PROCS[ci]) {
      ctx.beginPath();
      pr.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.fillStyle = rgba('#fff1dc', 0.35 * a);
    ctx.fill(cellPath(c));
    ctx.fillStyle = rgba(GOLD, 0.6 * a);
    ctx.beginPath();
    ctx.ellipse(c.x + 0.8, c.y - 0.4, c.r * 0.42, c.r * 0.36, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // a slow pulse inside: the cell at work
    if (!st.reduced) glow(ctx, GOLD_HI, c.x, c.y, c.r * (0.8 + 0.2 * Math.sin(st.time * 1.3 + ci)), 0.3 * a);
  }
  // new collagen fibrils spun out slowly
  const fl = smooth(0.25, 0.9, g);
  ctx.lineCap = 'round';
  for (let i = 0; i < FIBRILS.length; i++) {
    const f = FIBRILS[i];
    const k = clamp(fl * 1.3 - (i / FIBRILS.length) * 0.3);
    if (k <= 0) continue;
    const n = Math.max(2, Math.round(f.pts.length * k));
    ctx.strokeStyle = rgba(k < 1 ? GOLD_HI : '#efe2ff', 0.55);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    f.pts.slice(0, n).forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  // new aggrecan brushes appear round the cells and water gathers to them
  const nb = smooth(0.15, 1, g) * NEW.length;
  for (let i = 0; i < NEW.length; i++) {
    const a = clamp(nb - i);
    if (a <= 0) break;
    const b = NEW[i];
    ctx.strokeStyle = rgba(a < 1 ? GOLD : '#fff0cf', 0.85 * a);
    ctx.lineWidth = 0.6;
    brush(ctx, b.x, b.y, b.a, 7);
    if (!st.reduced) {
      for (let j = 0; j < 3; j++) {
        const ph = st.time * 0.6 + i * 1.3 + j * 2.1;
        const r = 4.5 + 1.5 * Math.sin(ph * 0.7);
        glow(ctx, j ? WATER : WATER_HI, b.x + Math.cos(ph) * r, b.y + Math.sin(ph) * r * 0.7, 1.4, 0.55 * a);
      }
    }
  }
}
