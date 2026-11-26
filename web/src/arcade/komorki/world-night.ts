/**
 * The night (DESIGN.md §24, Każda komórka · Noc odnowy): a deep night sky full of quiet stars over a sleeper lying on
 * their back under a blanket (a figure without features), the head on a pillow at the left.  Across the sky the night's
 * sleep is drawn as a line of light — a hypnogram: awake at the top, deep sleep (N3) at the bottom — about five cycles
 * of ≈ 90 minutes, the deep sleep mostly in the first part of the night, REM longer toward the morning.
 *
 *   fale    the line draws itself across the sky as the scene grows, wave after wave
 *   hormon  the first deep trough glows gold, and from the pituitary at the base of the brain a gold light spreads
 *           through the sleeper: the night's most reliable growth-hormone pulse (Van Cauter & Plat 1996)
 */
import { GOLD, GOLD_HI, PEARL, TAU, glow, glowEllipse, hash, rgba, smoothPath, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { phase, sparkle, type P2 } from './draw';
import { t } from './i18n';

/** The stages' heights in the sky: awake, REM, N1, N2, N3 (deep). */
const LV = { W: -84, R: -72, N1: -62, N2: -50, N3: -30 } as const;
type Lv = keyof typeof LV;
/** A night's sleep (hours, stage): ≈ 5 cycles, the deep sleep early, the REM longer toward the morning. */
const NIGHT: readonly (readonly [number, Lv])[] = [
  [0, 'W'], [0.15, 'N1'], [0.3, 'N2'], [0.5, 'N3'], [1.05, 'N3'], [1.2, 'N2'], [1.35, 'R'], [1.5, 'R'], [1.62, 'N2'],
  [1.85, 'N3'], [2.35, 'N3'], [2.55, 'N2'], [2.9, 'R'], [3.15, 'R'], [3.3, 'N2'], [3.6, 'N3'], [3.8, 'N3'], [4.0, 'N2'],
  [4.5, 'R'], [4.85, 'R'], [5.0, 'N2'], [5.8, 'N2'], [6.0, 'R'], [6.55, 'R'], [6.7, 'N2'], [7.2, 'N2'], [7.35, 'R'],
  [7.75, 'R'], [7.9, 'W'],
];
const X0 = -122, X1 = 122, HOURS = 7.9;
const hx = (h: number): number => X0 + ((X1 - X0) * h) / HOURS;
/** The hypnogram as points (steps eased into gentle slopes). */
const HYPNO: P2[] = NIGHT.map(([h, s]) => [hx(h), LV[s]]);
/** The first deep trough (its middle). */
export const TROUGH: P2 = [hx(0.78), LV.N3];
export const FIRST_REM: P2 = [hx(1.42), LV.R];
export const LATE_REM: P2 = [hx(4.68), LV.R];

/** The sleeper: the head on the pillow, the blanket's hump (its top line), the pituitary in the head. */
export const HEAD: P2 = [-86, 52];
export const PITUITARY: P2 = [-84, 54];
const BLANKET = (breath: number): P2[] => {
  const rise = 1.6 * breath;
  return [[-76, 60], [-66, 50 - rise * 0.6], [-46, 47 - rise], [-20, 50 - rise * 0.5], [0, 53], [24, 52], [44, 50], [58, 54], [64, 62]];
};

function bakeNight(ctx: CanvasRenderingContext2D): void {
  // the sky
  ctx.fillStyle = 'rgba(8,6,26,1)';
  ctx.fillRect(-420, -420, 840, 300);
  const g = ctx.createLinearGradient(0, -130, 0, 90);
  g.addColorStop(0, 'rgba(8,6,26,1)');
  g.addColorStop(0.55, 'rgba(26,16,60,1)');
  g.addColorStop(1, 'rgba(56,30,84,1)');
  ctx.fillStyle = g;
  ctx.fillRect(-420, -130, 840, 220);
  ctx.fillStyle = 'rgba(30,16,46,1)';
  ctx.fillRect(-420, 90, 840, 330);
  glowEllipse(ctx, '#7a5ad0', 20, -60, 170, 50, -0.15, 0.12);
  // stars: many quiet, a few bright
  for (let i = 0; i < 420; i++) {
    const x = (hash(i * 3 + 1101) * 2 - 1) * 260, y = -300 + hash(i * 7 + 1103) * 340;
    const b = hash(i * 11 + 1107) ** 3;
    ctx.fillStyle = `rgba(${230 + Math.round(25 * hash(i))},${220 + Math.round(30 * hash(i + 3))},255,${(0.2 + 0.6 * b).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.3 + 0.9 * b, 0, TAU);
    ctx.fill();
    if (b > 0.7) glow(ctx, '#e8e0ff', x, y, 3.5, 0.3);
  }
  // a thin moon high on the right
  ctx.fillStyle = 'rgba(255,244,220,.9)';
  ctx.beginPath();
  ctx.arc(118, -104, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,10,40,1)';
  ctx.beginPath();
  ctx.arc(121, -106, 6.4, 0, TAU);
  ctx.fill();
  glow(ctx, '#fff0d8', 116, -103, 18, 0.18);
  // the hypnogram's quiet guide lines (the stages)
  for (const y of Object.values(LV)) {
    ctx.strokeStyle = 'rgba(214,200,255,.08)';
    ctx.lineWidth = 0.4;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(X0, y);
    ctx.lineTo(X1, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // the bed and the pillow, low and dark
  const bed = new Path2D();
  bed.moveTo(-124, 64);
  bed.quadraticCurveTo(-20, 58, 94, 64);
  bed.lineTo(94, 76);
  bed.quadraticCurveTo(-20, 72, -124, 76);
  bed.closePath();
  ctx.fillStyle = 'rgba(70,40,96,.95)';
  ctx.fill(bed);
  ctx.strokeStyle = 'rgba(220,200,255,.3)';
  ctx.lineWidth = 0.6;
  ctx.stroke(bed);
  ctx.fillStyle = 'rgba(150,120,190,.9)';
  ctx.beginPath();
  ctx.ellipse(-92, 59, 15, 5.5, -0.05, 0, TAU);
  ctx.fill();
  // the head in profile on the pillow (no features, only the line of the brow and nose)
  ctx.fillStyle = 'rgba(176,120,160,.98)';
  ctx.beginPath();
  ctx.ellipse(HEAD[0], HEAD[1], 8.4, 7.4, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-80, 46);
  ctx.quadraticCurveTo(-77, 49, -77.5, 53);
  ctx.lineTo(-79, 56);
  ctx.quadraticCurveTo(-80, 59, -82, 59);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,226,240,.6)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(HEAD[0], HEAD[1], 8.4, 7.4, 0, Math.PI * 1.1, Math.PI * 2.1);
  ctx.stroke();
}

function drawSleeper(ctx: CanvasRenderingContext2D, st: WorldState, gold: number): void {
  // the blanket rises and falls with the breath
  const top = BLANKET(st.breath);
  const p = new Path2D();
  smoothPath(p, top);
  p.lineTo(64, 64);
  p.lineTo(-76, 64);
  p.closePath();
  const g = ctx.createLinearGradient(0, 46, 0, 64);
  g.addColorStop(0, 'rgba(150,110,200,.98)');
  g.addColorStop(1, 'rgba(96,64,140,.98)');
  ctx.fillStyle = g;
  ctx.fill(p);
  const edge = new Path2D();
  smoothPath(edge, top);
  ctx.strokeStyle = rgba('#f0e4ff', 0.6);
  ctx.lineWidth = 0.7;
  ctx.stroke(edge);
  // folds
  for (let k = 0; k < 5; k++) {
    ctx.strokeStyle = 'rgba(60,30,90,.35)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-50 + k * 22, 52);
    ctx.quadraticCurveTo(-44 + k * 22, 57, -48 + k * 22, 63);
    ctx.stroke();
  }
  if (gold > 0.01) {
    ctx.save();
    ctx.clip(p);
    glowEllipse(ctx, GOLD, -10, 56, 70 * gold + 8, 10, 0, 0.45 * gold);
    ctx.restore();
  }
  glow(ctx, '#e8d8ff', HEAD[0], HEAD[1], 14, 0.12 + 0.1 * st.deep);
}

/** The night's line drawn up to share k (with its fill under it and the deep sleep lit). */
function drawHypno(ctx: CanvasRenderingContext2D, k: number, st: WorldState, troughGold: number): Pt {
  const upTo = X0 + (X1 - X0) * k;
  const pts: P2[] = [];
  for (let i = 0; i < HYPNO.length; i++) {
    const [x, y] = HYPNO[i];
    if (x <= upTo) pts.push([x, y]);
    else {
      const [px, py] = HYPNO[i - 1];
      pts.push([upTo, py + ((y - py) * (upTo - px)) / Math.max(0.0001, x - px)]);
      break;
    }
  }
  if (pts.length < 2) return [X0, LV.W];
  // the deep sleep's soft light under the line
  const fill = new Path2D();
  fill.moveTo(pts[0][0], LV.W);
  for (const [x, y] of pts) fill.lineTo(x, y);
  fill.lineTo(pts[pts.length - 1][0], LV.W);
  fill.closePath();
  const fg = ctx.createLinearGradient(0, LV.W, 0, LV.N3);
  fg.addColorStop(0, 'rgba(120,90,220,.0)');
  fg.addColorStop(1, 'rgba(140,200,255,.22)');
  ctx.fillStyle = fg;
  ctx.fill(fill);
  const line = new Path2D();
  line.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) line.lineTo(x, y);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(190,220,255,.22)';
  ctx.lineWidth = 4;
  ctx.stroke(line);
  ctx.strokeStyle = 'rgba(236,244,255,.9)';
  ctx.lineWidth = 1;
  ctx.stroke(line);
  // the deep stretches glow
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    if (ay === LV.N3 && by === LV.N3) {
      const first = ax < hx(1.2);
      const col = first && troughGold > 0 ? GOLD : '#9fe9ff';
      ctx.strokeStyle = rgba(col, 0.9);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      glowEllipse(ctx, col, (ax + bx) / 2, ay, (bx - ax) / 2 + 4, 4, 0, 0.35 * (first ? 0.5 + troughGold : 1));
    }
  }
  const head = pts[pts.length - 1];
  if (k < 0.999) {
    glow(ctx, PEARL, head[0], head[1], 6, 0.6);
    sparkle(ctx, head[0], head[1], 4, 0.8 + 0.2 * Math.sin(st.time * 3));
  }
  return [head[0], head[1]];
}

function drawNight(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  // the stars breathe a little
  for (let i = 0; i < 12; i++) {
    const x = (hash(i * 13 + 1201) * 2 - 1) * 170, y = -128 + hash(i * 17 + 1203) * 110;
    glow(ctx, '#f0ecff', x, y, 3, 0.25 + 0.2 * Math.sin(st.time * (0.5 + hash(i)) + i));
  }
  if (st.scene === 'hormon') {
    const pulse = phase(g, 0.08, 0.6), spread = phase(g, 0.3, 1);
    drawHypno(ctx, 1, st, 0.4 + 0.6 * pulse);
    // a thin gold thread from the trough down to the sleeper: "now"
    ctx.strokeStyle = rgba(GOLD, 0.25 * pulse);
    ctx.lineWidth = 0.6;
    ctx.setLineDash([1.5, 2.5]);
    ctx.beginPath();
    ctx.moveTo(TROUGH[0], TROUGH[1] + 3);
    ctx.quadraticCurveTo(TROUGH[0] - 10, 10, PITUITARY[0] + 6, PITUITARY[1] - 8);
    ctx.stroke();
    ctx.setLineDash([]);
    drawSleeper(ctx, st, spread);
    glow(ctx, GOLD_HI, PITUITARY[0], PITUITARY[1], 4 + 8 * pulse, 0.4 + 0.5 * pulse);
    sparkle(ctx, PITUITARY[0], PITUITARY[1], 3 + 3 * pulse, 0.5 + 0.5 * pulse);
    return spread > 0 ? [-86 + 140 * spread * 0.6, 54] : PITUITARY;
  }
  const head = drawHypno(ctx, Math.max(0.02, g), st, 0);
  drawSleeper(ctx, st, 0);
  return head;
}

export const NIGHT_WORLD: WorldPainter = {
  depth: 0,
  lens: false,
  bake: ctx => bakeNight(ctx),
  draw: (ctx, st) => {
    drawNight(ctx, st);
  },
  focusAt(scene, g) {
    if (scene === 'hormon') return g < 0.3 ? PITUITARY : [-86 + 84 * phase(g, 0.3, 1), 54];
    const k = Math.max(0.02, g);
    const upTo = X0 + (X1 - X0) * k;
    let y: number = LV.W;
    for (const [x, yy] of HYPNO) if (x <= upTo) y = yy;
    return [upTo, y];
  },
  counter: (scene, g) => (scene === 'fale' && g > 0.25 ? t('count.fale') : null),
};
