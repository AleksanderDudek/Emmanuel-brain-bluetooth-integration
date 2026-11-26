/**
 * Living dentine at the pulp's edge (DESIGN.md §24.4), in micrometres, y down: the mineralised dentine above with
 * its tubules (about 5 µm apart here, where they are densest), the pale predentine, the row of odontoblasts — each
 * with its one process running up its tubule — and the pulp below with its cells, a capillary and the stem cells of
 * its cell-rich zone.  Through the lens.
 *
 *   kanaliki   the odontoblasts' processes light up their tubules, one after another
 *   wtorna     thin new layers of secondary dentine are laid at the pulp side; the row of cells steps back
 *   naprawcza  under a stimulus from above, a gold layer of tertiary dentine forms; stem cells rise to help
 */
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { AQUA, BLOOD, GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, rgba } from '../kit/healthlib/paint';
import { part, sstep } from './geo';
import { C, bakePx, lightLine, word } from './ink';

export const DENT_VIEW: Rect = { x: -50, y: -36, w: 100, h: 72 };

/** The layers' heights (µm): the mineralised front, the predentine, the odontoblasts, the cell-free and cell-rich zones. */
export const D = { front: 4, pre: 9, cellTop: 9, cellBottom: 22, cellFree: 27, rich: 34, X: 90 } as const;
/** Each odontoblast's x (one tubule each, ≈ 5 µm apart — about 45 000 per mm² near the pulp). */
const CELLS: number[] = [];
for (let i = -18; i <= 18; i++) CELLS.push(i * 4.9 + (hash(i * 7) - 0.5) * 0.8);

/** A tubule's course from its cell upward: a gentle S, fanning out a little as it rises. */
export function tubuleX(x0: number, y: number): number {
  const up = Math.max(0, D.pre - y);
  return x0 * (1 + up * 0.0025) + 2.2 * Math.sin(up * 0.045 + 0.4);
}
function tubulePts(x0: number, yTop: number, yBottom = D.pre + 1): Pt[] {
  const out: Pt[] = [];
  for (let y = yBottom; y >= yTop; y -= 2) out.push([tubuleX(x0, y), y]);
  return out;
}
const pathOf = (pts: readonly Pt[]): Path2D => {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  return p;
};

/** The stimulus's place above (wear, an early lesion): the tubules under it carry its message down. */
const STIM = { x: 2, w: 16 } as const;
const underStim = (x: number) => Math.abs(x - STIM.x) < STIM.w / 2 + 2;
/** Under the place, every other odontoblast is lost (reparative dentine comes from new cells there). */
const lost = (x: number) => underStim(x) && CELLS.indexOf(x) % 2 === 0;

// ── the still layers ─────────────────────────────────────────────
function bakeDentine(ctx: CanvasRenderingContext2D, variant: string): void {
  const px = bakePx(ctx);
  const X = D.X;
  // the dentine: warm ivory, a little deeper toward the top, with fine incremental lines
  const dg = ctx.createLinearGradient(0, -60, 0, D.front);
  dg.addColorStop(0, '#d8b48a');
  dg.addColorStop(1, '#f1dcbc');
  ctx.fillStyle = dg;
  ctx.fillRect(-X, -70, 2 * X, D.front + 70);
  ctx.strokeStyle = 'rgba(160,110,80,.16)';
  ctx.lineWidth = 0.8 / px;
  for (let k = 1; k < 16; k++) {
    const y = D.front - k * 4.2;
    ctx.beginPath();
    for (let x = -X; x <= X; x += 4) (x === -X ? ctx.moveTo(x, y + 0.6 * Math.sin(x * 0.05 + k)) : ctx.lineTo(x, y + 0.6 * Math.sin(x * 0.05 + k)));
    ctx.stroke();
  }
  // the predentine: pale, not yet mineral
  const pg = ctx.createLinearGradient(0, D.front, 0, D.pre);
  pg.addColorStop(0, '#f6ead8');
  pg.addColorStop(1, '#e8d2c8');
  ctx.fillStyle = pg;
  ctx.fillRect(-X, D.front, 2 * X, D.pre - D.front);
  // the pulp: soft rose, its fibroblasts, a capillary
  const pu = ctx.createLinearGradient(0, D.pre, 0, 60);
  pu.addColorStop(0, '#b4587a');
  pu.addColorStop(0.4, '#94406a');
  pu.addColorStop(1, '#6a2a52');
  ctx.fillStyle = pu;
  ctx.fillRect(-X, D.pre, 2 * X, 70);
  for (let i = 0; i < 90; i++) {
    const x = -X + hash(i * 3 + 1) * 2 * X, y = D.cellFree + 2 + hash(i * 5 + 2) * 30;
    ctx.fillStyle = 'rgba(255,200,220,.22)';
    ctx.beginPath();
    ctx.ellipse(x, y, 2.2, 0.8, hash(i) * 3, 0, TAU);
    ctx.fill();
  }
  const cap = new Path2D();
  cap.moveTo(-X, 44);
  for (let x = -X; x <= X; x += 4) cap.lineTo(x, 44 + 3 * Math.sin(x * 0.04));
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,90,120,.55)';
  ctx.lineWidth = 3.2;
  ctx.stroke(cap);
  ctx.strokeStyle = 'rgba(255,170,170,.6)';
  ctx.lineWidth = 0.8;
  ctx.stroke(cap);
  // the tubules: dark fine canals from the predentine up through the dentine
  ctx.strokeStyle = 'rgba(120,70,56,.42)';
  ctx.lineWidth = Math.max(0.6, 1.4 / px);
  for (const x0 of CELLS) ctx.stroke(pathOf(tubulePts(x0, -60)));
  // branches between the tubules (faint)
  ctx.strokeStyle = 'rgba(120,70,56,.16)';
  ctx.lineWidth = 0.7 / px;
  ctx.beginPath();
  for (let i = 0; i < 120; i++) {
    const x0 = CELLS[Math.floor(hash(i * 3) * CELLS.length)];
    const y = -50 + hash(i * 5 + 1) * 52;
    const x = tubuleX(x0, y);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2.6, y - 1.4);
  }
  ctx.stroke();
  if (variant === 'stim') cells(ctx, px, 0, x => (lost(x) ? 0.12 : 1));
  else if (variant !== 'move') cells(ctx, px, 0, null);
  if (variant === 'stim') stimulus(ctx, px);
}

/** The odontoblasts: tall cells in a row, nuclei at their base (dy shifts the row down: the pulp narrows). */
function cells(ctx: CanvasRenderingContext2D, px: number, dy: number, fade: ((x: number) => number) | null): void {
  for (const x of CELLS) {
    const a = fade ? fade(x) : 1;
    if (a <= 0.02) continue;
    const top = D.cellTop + dy, bot = D.cellBottom + dy;
    const p = new Path2D();
    p.moveTo(x - 1.6, bot);
    p.bezierCurveTo(x - 2.3, bot - 4, x - 2.2, top + 3, x - 0.8, top + 0.4);
    p.lineTo(x + 0.8, top + 0.4);
    p.bezierCurveTo(x + 2.2, top + 3, x + 2.3, bot - 4, x + 1.6, bot);
    p.closePath();
    ctx.fillStyle = `rgba(255,214,226,${(0.42 * a).toFixed(3)})`;
    ctx.fill(p);
    ctx.strokeStyle = `rgba(255,236,240,${(0.5 * a).toFixed(3)})`;
    ctx.lineWidth = 0.8 / px;
    ctx.stroke(p);
    ctx.fillStyle = `rgba(120,40,90,${(0.7 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x, bot - 3.2, 1.2, 2, 0, 0, TAU);
    ctx.fill();
  }
}

function stimulus(ctx: CanvasRenderingContext2D, px: number): void {
  // at the top: a worn place (amber haze), its message carried down the tubules under it
  const g = ctx.createRadialGradient(STIM.x, -40, 1, STIM.x, -40, 18);
  g.addColorStop(0, 'rgba(255,150,90,.55)');
  g.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(STIM.x - 24, -70, 48, 50);
  ctx.strokeStyle = 'rgba(255,170,110,.35)';
  ctx.lineWidth = Math.max(0.8, 1.6 / px);
  for (const x0 of CELLS) if (underStim(x0)) ctx.stroke(pathOf(tubulePts(x0, -60, -20)));
}

// ── what lives and grows ─────────────────────────────────────────
function drawProcesses(ctx: CanvasRenderingContext2D, st: WorldState, k: number, dy = 0): void {
  const px = st.px;
  const lit = new Path2D();
  CELLS.forEach((x0, i) => {
    const order = (i * 0.37) % 1;
    const kk = part(k, order * 0.6, order * 0.6 + 0.4);
    if (kk <= 0) return;
    const top = D.pre - (D.pre + 40) * kk;
    lit.addPath(pathOf(tubulePts(x0, top, D.cellTop + dy + 1)));
    if (st.growing && kk < 1) glow(ctx, GOLD_HI, tubuleX(x0, top), top, 3, 0.6);
  });
  lightLine(ctx, lit, px, GOLD, '#fff6dc', 1.2, 0.8 + 0.2 * st.deep);
}

function drawSecondary(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  const dy = 6 * g;
  // new layers between the old front and the new one, each a thin line of gold
  const bands = Math.floor(g * 6);
  ctx.fillStyle = rgba('#f3dfc0', 0.95);
  ctx.fillRect(-D.X, D.front, 2 * D.X, dy);
  const lines = new Path2D();
  for (let b = 1; b <= bands; b++) {
    const y = D.front + b;
    lines.moveTo(-D.X, y);
    for (let x = -D.X; x <= D.X; x += 4) lines.lineTo(x, y + 0.3 * Math.sin(x * 0.07 + b));
  }
  lightLine(ctx, lines, px, GOLD, GOLD_HI, 1, 0.7);
  // the predentine and the cells, stepped back
  ctx.fillStyle = rgba('#efdccc', 0.95);
  ctx.fillRect(-D.X, D.front + dy, 2 * D.X, D.pre - D.front);
  ctx.fillStyle = rgba('#b4587a', 1);
  ctx.fillRect(-D.X, D.pre + dy, 2 * D.X, D.cellFree - D.pre);
  cells(ctx, px, dy, null);
  // the processes lengthen with them
  drawProcesses(ctx, st, 0.85, dy);
  // the front glows where dentine is laid
  const front = new Path2D();
  front.moveTo(-D.X, D.front + dy);
  front.lineTo(D.X, D.front + dy);
  lightLine(ctx, front, px, GOLD, GOLD_HI, 1.4, 0.4 + 0.5 * (st.growing ? 1 : 0.5));
}

function drawTertiary(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  drawProcesses(ctx, st, 0.7);
  // the stimulus pulses down its tubules
  if (!st.reduced) {
    for (const x0 of CELLS) {
      if (!underStim(x0)) continue;
      const u = (st.time * 0.25 + hash(x0)) % 1;
      const y = -36 + u * 40;
      glow(ctx, C.acid, tubuleX(x0, y), y, 2.2, 0.35 * (1 - g * 0.6));
    }
  }
  // the tertiary layer: a gold, lumpy shield under the place, growing toward the pulp
  const depth = 7 * sstep(0.1, 0.9, g);
  if (depth > 0.1) {
    const p = new Path2D();
    const x0 = STIM.x - STIM.w / 2 - 6, x1 = STIM.x + STIM.w / 2 + 6;
    p.moveTo(x0, D.front);
    for (let x = x0; x <= x1; x += 1) {
      const k = 1 - ((x - STIM.x) / ((x1 - x0) / 2)) ** 2;
      p.lineTo(x, D.front + depth * Math.max(0, k) * (0.9 + 0.1 * Math.sin(x * 0.9)));
    }
    p.lineTo(x1, D.front);
    p.closePath();
    ctx.fillStyle = rgba('#ffe2a6', 0.85);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    glowEllipse(ctx, GOLD, STIM.x, D.front + depth / 2, 18, depth, 0, 0.7);
    ctx.restore();
    lightLine(ctx, p, px, GOLD, GOLD_HI, 1.2, 0.8);
  }
  // under the place a few odontoblasts are gone; stem cells rise from the cell-rich zone and take their place
  const rise = sstep(0.25, 1, g);
  CELLS.forEach((x0, i) => {
    if (!lost(x0)) return;
    const y0 = D.rich + 4 + hash(i) * 4, y1 = (D.cellTop + D.cellBottom) / 2 + 1;
    const y = y0 + (y1 - y0) * rise;
    const turn = sstep(0.75, 1, g);
    const col = turn > 0.5 ? GOLD : AQUA;
    glow(ctx, col, x0, y, 4, 0.55);
    ctx.fillStyle = rgba(turn > 0.5 ? '#ffe9b8' : '#d8f8ff', 0.9);
    ctx.beginPath();
    ctx.ellipse(x0, y, 1.8, 1.4 + turn * 1.6, 0, 0, TAU);
    ctx.fill();
  });
  // a few stem cells resting in their zone (aqua)
  for (let i = 0; i < 12; i++) {
    const x = -44 + hash(i * 9 + 4) * 88, y = D.rich + hash(i * 3 + 2) * 5;
    if (underStim(x)) continue;
    glow(ctx, AQUA, x, y, 3, 0.25);
    ctx.fillStyle = 'rgba(210,248,255,.7)';
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, TAU);
    ctx.fill();
  }
  glow(ctx, BLOOD, 0, 44, 10, 0.12 * g);
}

function drawDentine(ctx: CanvasRenderingContext2D, st: WorldState): void {
  if (st.scene === 'kanaliki') drawProcesses(ctx, st, st.g);
  else if (st.scene === 'wtorna') drawSecondary(ctx, st);
  else drawTertiary(ctx, st);
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'kanaliki') return [tubuleX(CELLS[18], D.pre - 30 * g), D.pre - 30 * g];
  if (scene === 'wtorna') return [0, D.front + 6 * g];
  return [STIM.x, D.front + 7 * sstep(0.1, 0.9, g) * 0.6];
}

function counter(scene: string, g: number): string | null {
  return scene === 'kanaliki' && g > 0.2 ? word('cnt.tubules') : null;
}

export const DENTINE: WorldPainter = { depth: 2, lens: true, bake: bakeDentine, draw: drawDentine, focusAt, counter };

export const dentPt = {
  tubules: [tubuleX(CELLS[22], -16), -16] as Pt,
  odontoblasts: [CELLS[14], (D.cellTop + D.cellBottom) / 2] as Pt,
  process: [tubuleX(CELLS[20], 0), 0] as Pt,
  pulp: [CELLS[10], 31] as Pt,
  predentine: [CELLS[25] + 2.4, (D.front + D.pre) / 2] as Pt,
  secondary: [CELLS[24] + 2.4, D.front + 3] as Pt,
  tertiary: [STIM.x + 4, D.front + 3] as Pt,
  stimulus: [STIM.x + 6, -30] as Pt,
  stem: [CELLS[16], D.rich + 2] as Pt,
};
