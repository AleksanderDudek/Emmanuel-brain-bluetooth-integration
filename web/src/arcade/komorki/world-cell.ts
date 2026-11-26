/**
 * The cell (DESIGN.md §24, Każda komórka): one living cell seen through the lens — its membrane a rim of pearl light,
 * the cytoplasm warm plum, the nucleus violet with its nucleolus and pores, the rough endoplasmic reticulum folded
 * round it with ribosomes, the Golgi's stack, mitochondria and lysosomes.  Two meditations live here:
 *
 *   Sprzątanie (autophagy, close on the right of the nucleus)
 *     otoczenie  a double membrane grows round a worn mitochondrion and a clump of old proteins → an autophagosome
 *     lizosom    a lysosome comes, the two fuse; inside, acid and enzymes take the old apart
 *     odzysk     the building blocks (amino acids) go back out to the ribosomes and are built into new chains
 *   Cała komórka
 *     komorka    the whole cell at once: mitochondria glow at work, lysosomes tidy, crews spark in the nucleus
 */
import { GOLD, GOLD_HI, AQUA, PEARL, LILAC, TAU, glow, glowEllipse, hash, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { blobPath, dot, drawMito, phase, sparkle, stagger, strokeThrough, type P2 } from './draw';
import { t } from './i18n';

export const CELL = { cx: 0, cy: 0, rx: 104, ry: 74, seed: 3 };
export const NUC = { x: -34, y: 2, rx: 31, ry: 28 };
const NUCLEOLUS: P2 = [-41, -5];

/** The healthy mitochondria: x, y, length, width, turn. */
export const MITOS: readonly (readonly [number, number, number, number, number])[] = [
  [22, 42, 22, 8, 0.25], [52, 46, 18, 7, -0.4], [-62, 50, 22, 8, 0.2], [-84, 16, 18, 7, 1.3], [-80, -32, 20, 7, -1.1],
  [-50, -56, 22, 8, 0.45], [-14, -58, 18, 7, -0.2], [86, -30, 18, 7, -0.9], [24, -40, 18, 7, 0.3],
  [-30, 50, 16, 6, -0.3],
];
/** The resting lysosomes: x, y, r. */
const LYSOS: readonly (readonly [number, number, number])[] = [[64, -42, 4.2], [8, 56, 4], [-90, -4, 4], [-6, 38, 4.4], [40, 22, 3.6]];

/** The autophagy scene's places: the worn mitochondrion, the lysosome's way in, the reused blocks' targets on the ER. */
export const OLD: P2 = [48, -12];
const LYSO_FROM: P2 = [84, 20];
const LYSO_AT: P2 = [62, 2];
const ER_TARGETS: readonly P2[] = [[8, -22], [14, -6], [12, 12], [2, 24], [0, -34]];

const inCell = (x: number, y: number, m = 0.92): boolean => (x / (CELL.rx * m)) ** 2 + (y / (CELL.ry * m)) ** 2 < 1;
const inNuc = (x: number, y: number, m = 1.25): boolean => ((x - NUC.x) / (NUC.rx * m)) ** 2 + ((y - NUC.y) / (NUC.ry * m)) ** 2 < 1;

/** The rough ER's folds: arcs round the nucleus on its right, each a wavy line (points). */
function erArcs(): P2[][] {
  const out: P2[][] = [];
  for (const [r, a0, a1, s] of [[38, -1.25, 1.2, 1], [44, -1.1, 1.05, 2], [50, -0.95, 0.9, 3], [56, -0.6, 0.55, 4], [42, 1.7, 2.6, 5], [48, 3.4, 4.3, 6]] as const) {
    const pts: P2[] = [];
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const rr = r + 1.6 * Math.sin(i * 1.3 + s);
      const x = NUC.x + Math.cos(a) * rr * 1.04, y = NUC.y + Math.sin(a) * rr * 0.92;
      if (inCell(x, y, 0.95)) pts.push([x, y]);
    }
    if (pts.length > 2) out.push(pts);
  }
  return out;
}
const ER = erArcs();

/** Neighbouring cells, dim and half seen, round the one we look at (they fill a tall or wide picture). */
function bakeNeighbours(ctx: CanvasRenderingContext2D): void {
  for (const [i, [x, y, rx, ry]] of ([[-236, -20, 104, 80], [236, 26, 108, 76], [-40, -176, 120, 70], [60, 176, 118, 72], [-250, 170, 90, 70], [250, -170, 96, 70]] as const).entries()) {
    const p = blobPath(x, y, rx, ry, 40 + i, 0.06, 16);
    ctx.fillStyle = 'rgba(70,28,80,.55)';
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(255,220,240,.18)';
    ctx.lineWidth = 0.8;
    ctx.stroke(p);
    glow(ctx, '#8a6ad0', x + rx * 0.2 * Math.sign(-x || 1), y, 26, 0.12);
  }
}

function bakeCell(ctx: CanvasRenderingContext2D): void {
  bakeNeighbours(ctx);
  const cell = blobPath(CELL.cx, CELL.cy, CELL.rx, CELL.ry, CELL.seed, 0.05, 18);
  // a halo of light round the cell, then the cytoplasm lit from within
  glowEllipse(ctx, '#b07cff', 0, 0, CELL.rx * 1.35, CELL.ry * 1.4, 0, 0.16);
  glowEllipse(ctx, '#ff8fb0', 10, 6, CELL.rx * 1.1, CELL.ry * 1.05, 0, 0.1);
  const g = ctx.createRadialGradient(-12, -8, 6, 0, 0, CELL.rx * 1.05);
  g.addColorStop(0, 'rgba(126,52,104,.92)');
  g.addColorStop(0.55, 'rgba(92,36,90,.9)');
  g.addColorStop(1, 'rgba(58,22,70,.92)');
  ctx.fillStyle = g;
  ctx.fill(cell);
  ctx.save();
  ctx.clip(cell);
  // the cytosol's fine grain and free ribosomes
  for (let i = 0; i < 520; i++) {
    const x = (hash(i * 3 + 11) * 2 - 1) * CELL.rx, y = (hash(i * 7 + 13) * 2 - 1) * CELL.ry;
    if (inNuc(x, y, 1.05)) continue;
    ctx.fillStyle = i % 3 ? 'rgba(255,210,236,.10)' : 'rgba(255,236,220,.2)';
    ctx.beginPath();
    ctx.arc(x, y, 0.35 + 0.5 * hash(i + 17), 0, TAU);
    ctx.fill();
  }
  // the cytoskeleton: faint threads from beside the nucleus
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + 0.2 * hash(i + 41);
    const x0 = 4, y0 = -8, len = 70 + 40 * hash(i + 43);
    ctx.strokeStyle = 'rgba(214,190,255,.08)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + Math.cos(a + 0.3) * len * 0.5, y0 + Math.sin(a + 0.3) * len * 0.5, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
    ctx.stroke();
  }
  glow(ctx, '#e6d2ff', 4, -8, 5, 0.25);
  // the rough ER: soft lilac folds studded with ribosomes
  for (const [k, arc] of ER.entries()) {
    strokeThrough(ctx, arc, '#d9b8ff', 2.6, 0.09);
    strokeThrough(ctx, arc, '#f0dcff', 0.45, 0.32);
    for (let i = 1; i < arc.length; i += 2) {
      const [x, y] = arc[i];
      dot(ctx, x + 0.9 * Math.sin(i + k), y + 0.9 * Math.cos(i * 1.7 + k), 0.5, '#fff0d8', null, 0.4);
    }
  }
  // the Golgi: a stack of curved cisternae
  for (let i = 0; i < 5; i++) {
    const r = 12 + i * 2.6;
    ctx.strokeStyle = rgba(i % 2 ? '#ffc8a0' : '#ffb0c8', 0.42);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-6, 70, r, -2.25 + i * 0.05, -1.1 - i * 0.05);
    ctx.stroke();
  }
  for (const [x, y] of [[4, 44], [12, 50], [-20, 46]] as const) dot(ctx, x, y, 1.2, '#ffc8a0', '#fff0e0', 0.5, 0.25);
  ctx.restore();

  // the nucleus: a violet sphere, its double envelope with pores, chromatin, the nucleolus
  const nuc = blobPath(NUC.x, NUC.y, NUC.rx, NUC.ry, 7, 0.04, 14);
  glow(ctx, '#a07cff', NUC.x, NUC.y, NUC.rx * 1.5, 0.22);
  const ng = ctx.createRadialGradient(NUC.x - 8, NUC.y - 8, 2, NUC.x, NUC.y, NUC.rx * 1.1);
  ng.addColorStop(0, 'rgba(120,84,190,.95)');
  ng.addColorStop(0.7, 'rgba(76,48,140,.95)');
  ng.addColorStop(1, 'rgba(52,30,100,.95)');
  ctx.fillStyle = ng;
  ctx.fill(nuc);
  ctx.save();
  ctx.clip(nuc);
  for (let i = 0; i < 260; i++) {
    const x = NUC.x + (hash(i * 5 + 71) * 2 - 1) * NUC.rx, y = NUC.y + (hash(i * 9 + 73) * 2 - 1) * NUC.ry;
    ctx.fillStyle = i % 4 ? 'rgba(200,170,255,.16)' : 'rgba(40,20,80,.35)';
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + 1.1 * hash(i + 79), 0, TAU);
    ctx.fill();
  }
  // chromatin threads
  for (let i = 0; i < 18; i++) {
    const x = NUC.x + (hash(i * 13 + 91) * 2 - 1) * NUC.rx * 0.8, y = NUC.y + (hash(i * 17 + 93) * 2 - 1) * NUC.ry * 0.8;
    ctx.strokeStyle = 'rgba(214,196,255,.22)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 6, y - 4, x + 2, y + 7, x + 9 * hash(i + 95), y + 5);
    ctx.stroke();
  }
  ctx.restore();
  const nl = blobPath(NUCLEOLUS[0], NUCLEOLUS[1], 9, 8, 11, 0.12, 10);
  ctx.fillStyle = 'rgba(178,120,230,.9)';
  ctx.fill(nl);
  glow(ctx, '#e8c8ff', NUCLEOLUS[0], NUCLEOLUS[1], 11, 0.35);
  ctx.strokeStyle = 'rgba(236,222,255,.85)';
  ctx.lineWidth = 0.7;
  ctx.stroke(nuc);
  const outer = blobPath(NUC.x, NUC.y, NUC.rx + 1.6, NUC.ry + 1.6, 7, 0.04, 14);
  ctx.strokeStyle = 'rgba(236,222,255,.35)';
  ctx.lineWidth = 0.45;
  ctx.stroke(outer);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    dot(ctx, NUC.x + Math.cos(a) * (NUC.rx + 0.8), NUC.y + Math.sin(a) * (NUC.ry + 0.8), 0.75, '#fff6ff', null, 0.7);
  }

  // mitochondria at rest and the lysosomes
  for (const [i, [x, y, l, w, r]] of MITOS.entries()) drawMito(ctx, x, y, l, w, r, 0, { seed: i + 1 });
  for (const [x, y, r] of LYSOS) lysosome(ctx, x, y, r, 0.25);

  // the membrane: two bright lines and a soft glow
  ctx.strokeStyle = 'rgba(255,200,230,.25)';
  ctx.lineWidth = 3;
  ctx.stroke(cell);
  ctx.strokeStyle = 'rgba(255,238,246,.85)';
  ctx.lineWidth = 0.8;
  ctx.stroke(cell);
}

/** A lysosome: a small amber-violet sphere with a bright rim; `fire` (0..1) its inner light. */
function lysosome(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fire: number): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  g.addColorStop(0, 'rgba(255,214,140,.95)');
  g.addColorStop(0.6, 'rgba(214,110,90,.85)');
  g.addColorStop(1, 'rgba(140,60,110,.9)');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,214,.9)';
  ctx.lineWidth = Math.max(0.3, r * 0.1);
  ctx.stroke();
  if (fire > 0.01) glow(ctx, '#ffb070', x, y, r * 2.6, 0.45 * fire);
}

/** A clump of old, misfolded proteins beside the worn mitochondrion. */
function clump(ctx: CanvasRenderingContext2D, x: number, y: number, a: number): void {
  for (let i = 0; i < 9; i++) {
    const ang = i * 2.4, d = 1.2 + 2.2 * hash(i + 301);
    dot(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 1 + 0.6 * hash(i + 303), '#9c8a9c', '#d8c8d8', 0.85 * a, 0.2);
  }
}

/** The old things inside the autophagosome: the worn mitochondrion and the clump (fading as they are taken apart). */
function oldContents(ctx: CanvasRenderingContext2D, a: number, crumble: number, time: number): void {
  if (a > 0.01) {
    drawMito(ctx, OLD[0] + 1, OLD[1] - 1, 20, 8, 0.55, 0, { old: 1, seed: 9, alpha: a });
    clump(ctx, OLD[0] - 7, OLD[1] + 6, a);
  }
  // as it is taken apart: small pieces that drift and fade inside
  if (crumble > 0.01) {
    for (let i = 0; i < 26; i++) {
      const ang = i * 2.39 + time * 0.2 * (i % 2 ? 1 : -1), d = 3 + 9 * hash(i + 311) * crumble;
      dot(ctx, OLD[0] + Math.cos(ang) * d, OLD[1] + Math.sin(ang) * d, 0.5 + 0.4 * hash(i + 313), i % 3 ? '#ffd9a0' : '#c8b0c8', null, 0.8 * crumble * (1 - 0.6 * crumble));
    }
  }
}

/** The phagophore's double membrane round the old things: an arc grown to `k` of the circle (1 = closed). */
function phagophore(ctx: CanvasRenderingContext2D, k: number, px: number, time: number): Pt {
  const r = 16.5;
  const a0 = -2.2, half = Math.PI * Math.min(1, k);
  const lead: Pt = [OLD[0] + Math.cos(a0 + half) * r, OLD[1] + Math.sin(a0 + half) * r];
  if (k <= 0.005) return [OLD[0] + Math.cos(a0) * r, OLD[1] + Math.sin(a0) * r];
  for (const [rr, w, c, al] of [[r + 1.3, 1, '#fff0f6', 0.9], [r - 1.3, 0.8, '#ffd8ec', 0.8]] as const) {
    ctx.strokeStyle = rgba(c, al);
    ctx.lineWidth = Math.max(w * 0.7, 1 / px);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(OLD[0], OLD[1], rr, a0 - half, a0 + half);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba('#ffc0e0', 0.22);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(OLD[0], OLD[1], r, a0 - half, a0 + half);
  ctx.stroke();
  if (k < 0.99) {
    sparkle(ctx, lead[0], lead[1], 4, 0.8);
    const other: Pt = [OLD[0] + Math.cos(a0 - half) * r, OLD[1] + Math.sin(a0 - half) * r];
    sparkle(ctx, other[0], other[1], 3.4, 0.6 + 0.2 * Math.sin(time * 3));
  } else glow(ctx, '#ffd0ec', OLD[0], OLD[1], r * 1.6, 0.18);
  return lead;
}

/** Where the lysosome is in the 'lizosom' scene (before it fuses). */
function lysoPos(g: number): P2 {
  const k = phase(g, 0, 0.36);
  return [LYSO_FROM[0] + (LYSO_AT[0] - LYSO_FROM[0]) * k, LYSO_FROM[1] + (LYSO_AT[1] - LYSO_FROM[1]) * k + 2 * Math.sin(k * Math.PI)];
}

/** The autolysosome after the fusion: the merged sphere, its acid glow, enzymes at work, the contents dissolving. */
function autolysosome(ctx: CanvasRenderingContext2D, fire: number, dissolve: number, size: number, st: WorldState): void {
  const r = 18 * size;
  const g = ctx.createRadialGradient(OLD[0], OLD[1], 0, OLD[0], OLD[1], r);
  g.addColorStop(0, rgba('#ffcf8a', 0.4 + 0.3 * fire));
  g.addColorStop(0.7, rgba('#d8708a', 0.45));
  g.addColorStop(1, rgba('#8a3a7a', 0.6));
  ctx.beginPath();
  ctx.arc(OLD[0], OLD[1], r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  oldContents(ctx, 1 - dissolve, dissolve * (1 - 0.3 * size), st.time);
  ctx.strokeStyle = 'rgba(255,236,222,.9)';
  ctx.lineWidth = Math.max(0.6, 1.2 / st.px);
  ctx.beginPath();
  ctx.arc(OLD[0], OLD[1], r, 0, TAU);
  ctx.stroke();
  glow(ctx, '#ffb070', OLD[0], OLD[1], r * 2, 0.3 * fire);
  // the enzymes: tiny bright scissors of light moving inside
  const n = Math.round(14 * fire);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + st.time * (0.6 + 0.4 * hash(i + 401)) * (i % 2 ? 1 : -1), d = r * (0.25 + 0.6 * hash(i + 403));
    sparkle(ctx, OLD[0] + Math.cos(a) * d, OLD[1] + Math.sin(a) * d, 1.6, 0.5 + 0.3 * Math.sin(st.time * 4 + i));
  }
}

/** The amino-acid beads' way from the autolysosome to a target on the ER (a gentle curve). */
function beadPath(i: number): P2[] {
  const [tx, ty] = ER_TARGETS[i % ER_TARGETS.length];
  const mx = (OLD[0] + tx) / 2 + 6 * Math.sin(i * 1.7), my = (OLD[1] + ty) / 2 + 10 * Math.cos(i * 1.3);
  return [[OLD[0], OLD[1]], [mx, my], [tx, ty]];
}
const quad = (p: readonly P2[], k: number): P2 => {
  const u = 1 - k;
  return [u * u * p[0][0] + 2 * u * k * p[1][0] + k * k * p[2][0], u * u * p[0][1] + 2 * u * k * p[1][1] + k * k * p[2][1]];
};

function drawRecycle(ctx: CanvasRenderingContext2D, st: WorldState): P2 {
  const g = st.g;
  autolysosome(ctx, 0.5 * (1 - g) + 0.15, 1, 1 - 0.35 * g, st);
  let front: P2 = [OLD[0], OLD[1]];
  // beads flowing out (a stream that thickens with g), each target building a chain
  const streams = ER_TARGETS.length;
  for (let s = 0; s < streams; s++) {
    const on = stagger(g, s, streams, 0.3, 0, 0.75);
    if (on <= 0) continue;
    const path = beadPath(s);
    strokeThrough(ctx, path, '#ffd98a', 0.5, 0.18 * on);
    for (let b = 0; b < 4; b++) {
      const k = ((st.time * 0.22 + b / 4 + s * 0.13) % 1) * on;
      const [x, y] = quad(path, k);
      dot(ctx, x, y, 0.9, GOLD_HI, null, 0.9 * on);
      glow(ctx, GOLD, x, y, 3, 0.35 * on);
    }
    const head = quad(path, on);
    if (on > 0.3) front = head;
    // the ribosome at the target and its new chain: beads in a short curl
    const [tx, ty] = ER_TARGETS[s];
    dot(ctx, tx, ty, 1.4, '#fff0d8', '#ffffff', 0.9 * on, 0.3);
    glow(ctx, '#fff0d8', tx, ty, 4, 0.4 * on);
    const beads = Math.floor(on * 7 * phase(g, 0.15 + s * 0.08, 1));
    for (let b = 0; b < beads; b++) {
      const a = -1.2 + b * 0.7 + s, d = 2.2 + b * 1.15;
      dot(ctx, tx + Math.cos(a) * d * 0.8 - 2, ty + Math.sin(a) * d * 0.6, 0.85, b % 2 ? '#ffd98a' : '#ffb68a', null, 0.95);
    }
  }
  return front;
}

function drawWhole(ctx: CanvasRenderingContext2D, st: WorldState): P2 {
  const g = st.g, live = st.after > 0 ? 1 : 0;
  // energy: the mitochondria light up one by one and breathe
  for (const [i, [x, y, l, w, r]] of MITOS.entries()) {
    const on = stagger(g, i, MITOS.length, 0.3, 0, 0.55);
    if (on <= 0.01) continue;
    const pulse = 0.8 + 0.2 * Math.sin(st.time * 1.4 + i * 1.3);
    drawMito(ctx, x, y, l, w, r, on * pulse, { seed: i + 1, px: st.px });
  }
  // clean-up: the lysosomes take fire in turn
  for (const [i, [x, y, r]] of LYSOS.entries()) {
    const on = stagger(g, i, LYSOS.length, 0.3, 0.2, 0.75);
    if (on > 0.01) lysosome(ctx, x, y, r, on * (0.7 + 0.3 * Math.sin(st.time * 2 + i)));
  }
  // repair: sparks of the crews in the nucleus
  const crews = Math.round(phase(g, 0.4, 0.95) * 10 + 4 * live);
  for (let i = 0; i < crews; i++) {
    const cyc = (st.time * 0.35 + i * 0.37) % 1;
    const x = NUC.x + (hash(i * 7 + Math.floor(st.time * 0.35 + i * 0.37) * 3) * 2 - 1) * NUC.rx * 0.7;
    const y = NUC.y + (hash(i * 11 + Math.floor(st.time * 0.35 + i * 0.37) * 5) * 2 - 1) * NUC.ry * 0.7;
    const a = Math.sin(cyc * Math.PI);
    sparkle(ctx, x, y, 3, a * 0.8);
    glow(ctx, i % 2 ? AQUA : GOLD_HI, x, y, 4, a * 0.4);
  }
  // the whole cell warms as it grows
  glowEllipse(ctx, GOLD, 0, 0, CELL.rx * 1.05, CELL.ry * 1.05, 0, 0.1 * g + 0.04 * st.deep);
  return [0, 0];
}

function drawAutophagy(ctx: CanvasRenderingContext2D, st: WorldState): P2 {
  const g = st.g;
  if (st.scene === 'otoczenie') {
    oldContents(ctx, 1, 0, st.time);
    const k = phase(g, 0.02, 0.88);
    const lead = phagophore(ctx, k, st.px, st.time);
    return [lead[0], lead[1]];
  }
  if (st.scene === 'lizosom') {
    const fuse = phase(g, 0.34, 0.5);
    if (fuse < 1) {
      oldContents(ctx, 1, 0, st.time);
      phagophore(ctx, 1, st.px, st.time);
      const [lx, ly] = lysoPos(g);
      lysosome(ctx, lx + (OLD[0] - lx) * fuse * 0.6, ly + (OLD[1] - ly) * fuse * 0.6, 5.5 * (1 - 0.5 * fuse), 0.6 + 0.4 * phase(g, 0, 0.3));
      if (fuse > 0) glow(ctx, '#ffb070', (lx + OLD[0]) / 2, (ly + OLD[1]) / 2, 12, 0.4 * Math.sin(fuse * Math.PI));
      return fuse > 0 ? [OLD[0] + 8, OLD[1] + 6] : [lx, ly];
    }
    const work = phase(g, 0.5, 0.97);
    autolysosome(ctx, 0.4 + 0.6 * work, work, 1, st);
    return [OLD[0], OLD[1]];
  }
  return drawRecycle(ctx, st);
}

/** Where each scene's growing point is, as it grows. */
function focusAt(scene: string, g: number): Pt {
  if (scene === 'otoczenie') {
    const k = phase(g, 0.02, 0.88);
    const a = -2.2 + Math.PI * Math.min(1, k);
    return [OLD[0] + Math.cos(a) * 16.5, OLD[1] + Math.sin(a) * 16.5];
  }
  if (scene === 'lizosom') return g < 0.36 ? lysoPos(g) : [OLD[0], OLD[1]];
  if (scene === 'odzysk') {
    const s = Math.min(ER_TARGETS.length - 1, Math.floor(g * ER_TARGETS.length));
    const p = beadPath(s);
    return quad(p, 0.5 + 0.5 * ((g * ER_TARGETS.length) % 1));
  }
  return [-8, 0];
}

export const CELL_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake: ctx => bakeCell(ctx),
  draw(ctx, st) {
    // the cell breathes with rest: a warm sheen over the cytoplasm
    if (st.deep > 0.01) glowEllipse(ctx, '#ff9ab8', -6, -4, CELL.rx * 0.9, CELL.ry * 0.85, 0, 0.08 * st.deep * (0.6 + 0.4 * st.breath));
    if (st.scene === 'komorka') drawWhole(ctx, st);
    else drawAutophagy(ctx, st);
    // the membrane shimmers a little where the light runs along it
    const a = st.time * 0.25;
    glow(ctx, PEARL, Math.cos(a) * CELL.rx * 0.98, Math.sin(a) * CELL.ry * 0.98, 8, 0.25);
    if (st.growing) glow(ctx, LILAC, 0, 0, 30, 0.03);
  },
  focusAt,
  counter(scene, g) {
    if (scene === 'lizosom' && g > 0.5) return t('count.lizosom');
    return null;
  },
};
