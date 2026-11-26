/**
 * The enamel's surface under the saliva (DESIGN.md §24.4), in micrometres: the ends of the enamel rods (≈ 5 µm each)
 * below, the acquired pellicle on them, the plaque's bacteria in places, and the saliva over all of it with what it
 * carries.  Molecules and ions are drawn as schematic glints (far larger than they are).  Through the lens.
 *
 *   plukanie  the saliva's waves wash away the remains of food; bicarbonate meets the acid's sparks and quenches them
 *   blonka    the pellicle spreads over the clean enamel; the saliva's guard drifts by (IgA, lysozyme, lactoferrin)
 *   kwas      the pH line after something sweet: it falls within a minute below ≈ 5.5, minerals leave; saliva answers
 *   powrot    the line comes back to rest in ≈ 20–40 minutes; calcium and phosphate settle back into the enamel
 *   dzien     a whole day: three meals, three short dips, long hours of repair between (and, faint, a day of snacks)
 */
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { AQUA, GOLD, GOLD_HI, PEARL, TAU, glow, glowEllipse, hash, rgba } from '../kit/healthlib/paint';
import { part, sstep } from './geo';
import { C, bakePx, dec, lightLine, screenText, word } from './ink';

/** The enamel's surface (µm, y down) with its gentle perikymata. */
export const SY = 18;
export const surfY = (x: number): number => SY + 0.6 * Math.sin(x * 0.09) + 0.3 * Math.sin(x * 0.23 + 1);
const X0 = -90, X1 = 90;

export const SURF_VIEW: Rect = { x: -64, y: -42, w: 128, h: 84 };

// ── the pH chart in the saliva ───────────────────────────────────
/** pH on the chart's height (µm of the picture): 7.2 at the top, 4.6 near the plaque. */
export const phY = (ph: number): number => -34 + (7.2 - ph) * 10.5;
/** Minutes on the chart's width (0–45 min). */
export const minX = (t: number): number => -54 + (t * 108) / 45;
/** Hours of a day (7:00–23:00) on the chart's width. */
export const hourX = (h: number): number => -56 + ((h - 7) * 112) / 16;

/**
 * A Stephan-like curve (pH after sugar at t = 1 min): it starts to fall within a minute, bottoms near 4.9 at ≈ 7 min,
 * is back over 5.5 by ≈ 12 min and near rest by ≈ 30 min (DBOH: "returns the pH to normal (20 to 40 minutes)").
 */
export function stephan(t: number): number {
  if (t <= 1) return 7;
  const x = (t - 1) / 6;
  return 7 - 2.1 * x * Math.exp(1 - x);
}
const MEALS = [8, 13, 19];
const SNACKS = [8, 10, 11.5, 13, 15, 16.5, 19, 21];
/** pH over a day of the given meal times (hours). */
export function dayPh(h: number, meals: readonly number[]): number {
  let d = 0;
  for (const m of meals) if (h > m) d = Math.max(d, 7 - stephan(1 + (h - m) * 60));
  return 7 - d;
}

/** Each scene's span of the chart's time: kwas 0–9 min, powrot 9–42 min, the day 7:00–23:00. */
const SPAN: Readonly<Record<string, [number, number]>> = { kwas: [0, 9], powrot: [9, 42] };
const timeAt = (scene: string, g: number): number => {
  const s = SPAN[scene];
  return s ? s[0] + (s[1] - s[0]) * Math.min(1, g) : 7 + 16 * Math.min(1, g);
};

/** Plaque: clusters of bacteria on the pellicle (x, width, height). */
const PLAQUE: readonly [number, number, number][] = [[-38, 26, 9], [6, 18, 6], [44, 24, 8]];

// ── the still surface ────────────────────────────────────────────
function bakeSurface(ctx: CanvasRenderingContext2D, variant: string): void {
  const px = bakePx(ctx);
  // the saliva: a deep, clear aqua over the tooth, a little brighter near it
  const sg = ctx.createLinearGradient(0, -60, 0, SY);
  sg.addColorStop(0, '#0d1830');
  sg.addColorStop(0.7, '#123048');
  sg.addColorStop(1, '#17445a');
  ctx.fillStyle = sg;
  ctx.fillRect(X0, -70, X1 - X0, SY + 70);
  // faint currents
  ctx.strokeStyle = 'rgba(159,233,255,.07)';
  ctx.lineWidth = 1 / px;
  for (let k = 0; k < 14; k++) {
    const y0 = -38 + k * 4.2;
    ctx.beginPath();
    for (let x = X0; x <= X1; x += 4) {
      const y = y0 + 1.4 * Math.sin(x * 0.05 + k * 1.7);
      if (x === X0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  enamelBody(ctx, px);
  if (variant !== 'pellicle') pellicle(ctx, px, X1, 0.65);
  if (variant === 'curve' || variant === 'day') {
    for (const [cx, w, h] of PLAQUE) plaque(ctx, px, cx, w, h);
    chart(ctx, px, variant === 'day');
  }
}

function enamelBody(ctx: CanvasRenderingContext2D, px: number): void {
  const p = new Path2D();
  p.moveTo(X0, surfY(X0));
  for (let x = X0; x <= X1; x += 1) p.lineTo(x, surfY(x));
  p.lineTo(X1, 70);
  p.lineTo(X0, 70);
  p.closePath();
  const g = ctx.createLinearGradient(0, SY, 0, 50);
  g.addColorStop(0, '#eef8ff');
  g.addColorStop(0.25, '#d6e8f4');
  g.addColorStop(1, '#a9bfd6');
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  // the rods' ends: columns ≈ 5 µm wide, gently wavy, each a little lighter in its middle
  for (let i = -20; i <= 20; i++) {
    const x = i * 5 + 1.3 * Math.sin(i * 1.7);
    const rg = ctx.createLinearGradient(x - 2.5, 0, x + 2.5, 0);
    rg.addColorStop(0, 'rgba(120,150,190,.28)');
    rg.addColorStop(0.5, 'rgba(255,255,255,.18)');
    rg.addColorStop(1, 'rgba(120,150,190,.28)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    for (let y = SY - 2; y <= 70; y += 3) {
      const xx = x - 2.5 + 0.8 * Math.sin(y * 0.12 + i);
      if (y === SY - 2) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
    }
    for (let y = 70; y >= SY - 2; y -= 3) ctx.lineTo(x + 2.5 + 0.8 * Math.sin(y * 0.12 + i), y);
    ctx.closePath();
    ctx.fill();
  }
  // crystal glints
  for (let i = 0; i < 700; i++) {
    const x = X0 + hash(i * 3 + 5) * (X1 - X0), y = SY + 1 + hash(i * 7 + 2) * 40;
    ctx.fillStyle = `rgba(255,255,255,${(0.12 + 0.3 * hash(i + 9)).toFixed(2)})`;
    ctx.fillRect(x, y, 0.35, 1.2 + hash(i) * 1.6);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(214,246,255,.8)';
  ctx.lineWidth = 1.2 / px;
  ctx.beginPath();
  for (let x = X0; x <= X1; x += 1) (x === X0 ? ctx.moveTo(x, surfY(x)) : ctx.lineTo(x, surfY(x)));
  ctx.stroke();
}

/** The pellicle as a thin pearl film over the surface up to x (thickness ≈ 1 µm at its fullest). */
function pellicle(ctx: CanvasRenderingContext2D, px: number, xEnd: number, a: number): void {
  if (xEnd <= X0) return;
  const p = new Path2D();
  p.moveTo(X0, surfY(X0));
  for (let x = X0; x <= xEnd; x += 1) p.lineTo(x, surfY(x) - 1.1);
  for (let x = xEnd; x >= X0; x -= 1) p.lineTo(x, surfY(x));
  p.closePath();
  ctx.fillStyle = rgba('#e8fbff', 0.55 * a);
  ctx.fill(p);
  ctx.strokeStyle = rgba(AQUA, 0.6 * a);
  ctx.lineWidth = 0.9 / px;
  ctx.beginPath();
  for (let x = X0; x <= xEnd; x += 1) (x === X0 ? ctx.moveTo(x, surfY(x) - 1.1) : ctx.lineTo(x, surfY(x) - 1.1));
  ctx.stroke();
}

function plaque(ctx: CanvasRenderingContext2D, px: number, cx: number, w: number, h: number): void {
  // a soft matrix with cocci in chains and short rods
  const base = (x: number) => surfY(x) - 1.1;
  ctx.fillStyle = 'rgba(150,120,90,.22)';
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, base(cx - w / 2));
  for (let x = cx - w / 2; x <= cx + w / 2; x += 1) {
    const k = 1 - ((x - cx) / (w / 2)) ** 2;
    ctx.lineTo(x, base(x) - h * Math.sqrt(Math.max(0, k)) * (0.85 + 0.15 * Math.sin(x)));
  }
  ctx.lineTo(cx + w / 2, base(cx + w / 2));
  ctx.closePath();
  ctx.fill();
  const n = Math.round(w * h * 0.5);
  for (let i = 0; i < n; i++) {
    const x = cx + (hash(i * 3 + cx) - 0.5) * w;
    const k = 1 - ((x - cx) / (w / 2)) ** 2;
    const y = base(x) - hash(i * 5 + cx) * h * Math.sqrt(Math.max(0, k)) * 0.9;
    ctx.fillStyle = i % 3 ? 'rgba(236,196,150,.55)' : 'rgba(206,170,236,.5)';
    ctx.beginPath();
    if (i % 4 === 0) ctx.ellipse(x, y, 1.1, 0.45, hash(i) * 3, 0, TAU);
    else ctx.arc(x, y, 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,220,180,.12)';
  ctx.lineWidth = 0.8 / px;
  ctx.stroke();
}

function chart(ctx: CanvasRenderingContext2D, px: number, day: boolean): void {
  const x0 = day ? hourX(7) : minX(0), x1 = day ? hourX(23) : minX(45);
  // the zone under the critical line: a warm haze
  const zg = ctx.createLinearGradient(0, phY(5.5), 0, phY(4.6));
  zg.addColorStop(0, 'rgba(255,138,92,.12)');
  zg.addColorStop(1, 'rgba(255,138,92,0)');
  ctx.fillStyle = zg;
  ctx.fillRect(x0, phY(5.5), x1 - x0, phY(4.6) - phY(5.5));
  // rest (7) and the critical line (≈ 5.5, dashed: not a fixed border)
  ctx.lineWidth = 1 / px;
  ctx.strokeStyle = 'rgba(200,240,255,.22)';
  ctx.beginPath();
  ctx.moveTo(x0, phY(7));
  ctx.lineTo(x1, phY(7));
  ctx.stroke();
  ctx.setLineDash([5 / px, 4 / px]);
  ctx.strokeStyle = 'rgba(255,170,130,.6)';
  ctx.beginPath();
  ctx.moveTo(x0, phY(5.5));
  ctx.lineTo(x1, phY(5.5));
  ctx.stroke();
  ctx.setLineDash([]);
  // the axis and its ticks
  const ay = phY(4.6) + 1;
  ctx.strokeStyle = 'rgba(200,240,255,.3)';
  ctx.beginPath();
  ctx.moveTo(x0, ay);
  ctx.lineTo(x1, ay);
  const ticks = day ? [7, 11, 15, 19, 23] : [0, 10, 20, 30, 40];
  for (const t of ticks) {
    const x = day ? hourX(t) : minX(t);
    ctx.moveTo(x, ay);
    ctx.lineTo(x, ay + 4 / px);
  }
  ctx.stroke();
  const ink = 'rgba(214,246,255,.7)';
  for (const t of ticks) screenText(ctx, day ? `${t}:00` : `${t}`, day ? hourX(t) : minX(t), ay + 5 / px, 13, ink, 'center', 'top');
  screenText(ctx, 'pH 7', x0 + 2 / px, phY(7) - 8 / px, 13, ink, 'left');
  if (!day) screenText(ctx, 'min', x1 + 4 / px, ay + 1 / px, 13, ink, 'left');
  if (day) {
    // a day of snacks, faint: eight dips instead of three
    ctx.setLineDash([3 / px, 3 / px]);
    ctx.strokeStyle = 'rgba(201,182,255,.3)';
    ctx.beginPath();
    for (let h = 7; h <= 23; h += 0.02) {
      const x = hourX(h), y = phY(dayPh(h, SNACKS));
      if (h === 7) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const m of MEALS) {
      ctx.fillStyle = 'rgba(255,217,138,.75)';
      ctx.beginPath();
      ctx.arc(hourX(m), ay, 2.4 / px, 0, TAU);
      ctx.fill();
    }
  } else {
    // the sweet moment
    ctx.fillStyle = 'rgba(255,217,138,.8)';
    ctx.beginPath();
    ctx.arc(minX(1), ay, 2.6 / px, 0, TAU);
    ctx.fill();
  }
}

// ── what lives and grows ─────────────────────────────────────────
function curvePts(scene: string, t0: number, t1: number): Pt[] {
  const day = scene === 'dzien';
  const out: Pt[] = [];
  const step = day ? 0.03 : 0.15;
  for (let t = t0; t <= t1 + 1e-6; t += step) out.push(day ? [hourX(t), phY(dayPh(t, MEALS))] : [minX(t), phY(stephan(t))]);
  return out;
}
const pathOf = (pts: readonly Pt[]): Path2D => {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  return p;
};

function flow(ctx: CanvasRenderingContext2D, st: WorldState, k: number): void {
  // currents of saliva moving along the tooth: bright threads that travel
  if (k <= 0) return;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const y0 = -26 + i * 5.6;
    const sp = st.reduced ? 0 : st.time * (9 + 3 * hash(i));
    const len = 40 + 30 * hash(i + 4);
    const x0 = ((hash(i * 3) * 200 + sp) % 220) - 110;
    const pts: Pt[] = [];
    for (let x = x0; x <= x0 + len; x += 3) pts.push([x, y0 + 1.6 * Math.sin(x * 0.06 + i * 1.3)]);
    lightLine(ctx, pathOf(pts), st.px, AQUA, '#e9fcff', 1.2, (0.25 + 0.4 * k) * (0.6 + 0.4 * hash(i + 9)));
  }
}

function ion(ctx: CanvasRenderingContext2D, px: number, x: number, y: number, color: string, a: number, r = 2.2): void {
  glow(ctx, color, x, y, (r * 3) / px, 0.55 * a);
  ctx.fillStyle = rgba(color, Math.min(1, a));
  ctx.beginPath();
  ctx.arc(x, y, r / px, 0, TAU);
  ctx.fill();
}

function drawWash(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  flow(ctx, st, 0.3 + 0.7 * g);
  // the remains of food drift off as the waves pass
  for (let i = 0; i < 22; i++) {
    const x0 = -60 + hash(i * 7 + 1) * 120;
    const away = g * (40 + 80 * hash(i + 3));
    const x = x0 + away, y = surfY(x0) - 2 - hash(i * 5) * 5 - g * 14 * hash(i + 8);
    const a = 1 - part(g, 0.2 + 0.6 * hash(i + 2), 1);
    if (a <= 0) continue;
    ctx.fillStyle = rgba('#d9a46a', 0.75 * a);
    ctx.beginPath();
    ctx.ellipse(x, y, 1.6 + hash(i) * 1.8, 1 + hash(i + 1), hash(i + 2) * 3, 0, TAU);
    ctx.fill();
  }
  // acid's sparks near the surface, quenched by bicarbonate arriving from above
  for (let i = 0; i < 26; i++) {
    const x = -58 + hash(i * 11 + 4) * 116, y = surfY(x) - 2.5 - hash(i * 3 + 7) * 8;
    const meet = 0.08 + 0.85 * hash(i * 13 + 2);
    const k = part(g, meet - 0.12, meet);
    if (k < 1) {
      const wob = st.reduced ? 0 : 0.6 * Math.sin(st.time * 3 + i);
      ion(ctx, px, x + wob, y, C.acid, 0.9 * (1 - k), 1.7);
      // the bicarbonate on its way down
      ion(ctx, px, x + 2, y - 18 * (1 - k), C.bicarb, 0.85 * Math.min(1, g * 4) * (k > 0 ? 1 : 0.4), 1.9);
    } else {
      // water and CO₂: a small bubble rising and fading
      const r = part(g, meet, meet + 0.15);
      if (r < 1) {
        ctx.strokeStyle = rgba('#e9fcff', 0.6 * (1 - r));
        ctx.lineWidth = 0.8 / px;
        ctx.beginPath();
        ctx.arc(x, y - 8 * r, (1.5 + 2 * r) * (2.2 / Math.max(1, px * 0.6)) + 0.6, 0, TAU);
        ctx.stroke();
      }
    }
  }
  // the clean surface shines
  sheen(ctx, st, g);
}

function sheen(ctx: CanvasRenderingContext2D, st: WorldState, k: number): void {
  const pts: Pt[] = [];
  for (let x = -90; x <= 90; x += 2) pts.push([x, surfY(x) - 0.2]);
  lightLine(ctx, pathOf(pts), st.px, C.enamelRim, '#ffffff', 1.4, 0.2 + 0.6 * k);
  if (!st.reduced) {
    const sx = ((st.time * 14) % 200) - 100;
    glowEllipse(ctx, PEARL, sx, SY + 1, 18, 3, 0, 0.18 * k);
  }
}

/** The saliva's guard (schematic): IgA as a small Y, lysozyme a notched ball, lactoferrin two lobes, histatin a thread. */
function guard(ctx: CanvasRenderingContext2D, px: number, kind: number, x: number, y: number, rot: number, a: number): void {
  const s = 9 / px + 1.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.lineCap = 'round';
  glow(ctx, kind === 0 ? GOLD : kind === 1 ? '#ffb3d0' : kind === 2 ? '#c9b6ff' : AQUA, 0, 0, s * 1.8, 0.4 * a);
  ctx.lineWidth = Math.max(0.35, 2.2 / px);
  if (kind === 0) {
    ctx.strokeStyle = rgba(GOLD_HI, a);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.7);
    ctx.lineTo(0, 0);
    ctx.lineTo(-s * 0.6, -s * 0.6);
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.6, -s * 0.6);
    ctx.stroke();
  } else if (kind === 1) {
    ctx.fillStyle = rgba('#ffd2e2', a);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.45, 0.5, TAU - 0.5);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 2) {
    ctx.fillStyle = rgba('#e2d8ff', a);
    ctx.beginPath();
    ctx.arc(-s * 0.3, 0, s * 0.34, 0, TAU);
    ctx.arc(s * 0.3, 0, s * 0.34, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = rgba('#dffbff', a);
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const xx = -s * 0.6 + (i * s * 1.2) / 8, yy = 0.25 * s * Math.sin(i * 1.6);
      if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** The named members of the guard sit still at their labels; the rest drift. */
export const GUARD_AT: readonly Pt[] = [[24, -8], [-36, -14], [6, -24]];

function drawPellicle(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  flow(ctx, st, 0.25);
  const xEnd = -90 + 180 * sstep(0, 1, g * 1.04);
  pellicle(ctx, px, xEnd, 1);
  // proteins landing at the front of the film
  for (let i = 0; i < 10; i++) {
    const u = st.reduced ? hash(i) : (hash(i) + st.time * 0.4) % 1;
    const x = xEnd + 4 - 10 * hash(i * 3 + 1), y = surfY(x) - 1.1 - 10 * (1 - u);
    if (g > 0.01 && g < 0.99) ion(ctx, px, x, y, '#e8fbff', 0.8 * u, 1.3);
  }
  const front: Pt = [xEnd, surfY(xEnd) - 0.6];
  if (st.growing && g < 1) glow(ctx, GOLD_HI, front[0], front[1], 10 / px + 2, 0.7);
  lightLine(ctx, pathOf(Array.from({ length: Math.max(2, Math.ceil((xEnd + 90) / 2)) }, (_, i): Pt => [-90 + i * 2, surfY(-90 + i * 2) - 1.1])), px, AQUA, '#f2feff', 1.2, 0.5 + 0.3 * st.deep);
  // the guard: the named three still, others drifting in as the film grows
  GUARD_AT.forEach(([x, y], i) => guard(ctx, px, i, x, y, -0.2 + 0.4 * i, part(g, 0.25 + 0.2 * i, 0.4 + 0.2 * i)));
  const n = Math.round(4 + 14 * g);
  for (let i = 0; i < n; i++) {
    const drift = st.reduced ? 0 : st.time * (2 + 2 * hash(i + 5));
    const x = ((hash(i * 7 + 2) * 180 + drift) % 180) - 90, y = -34 + hash(i * 3 + 9) * 44;
    guard(ctx, px, i % 4, x, y + 2 * Math.sin(st.time * 0.5 + i), hash(i) * 6 + st.time * 0.2, 0.55);
  }
}

function drawCurve(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const scene = st.scene, g = st.g, px = st.px;
  const day = scene === 'dzien';
  const T = timeAt(scene, g);
  const start = day ? 7 : 0;
  // the part already walked in an earlier scene, quieter
  if (scene === 'powrot') lightLine(ctx, pathOf(curvePts('kwas', 0, 9)), px, AQUA, '#e9fcff', 1.4, 0.45);
  const tStart = scene === 'powrot' ? 9 : start;
  const pts = curvePts(scene, tStart, Math.max(tStart + 0.01, T));
  // the dip below the critical line glows warm; the hours of rest above it glow gold
  const y55 = phY(5.5);
  ctx.save();
  const below = new Path2D();
  below.moveTo(pts[0][0], y55);
  for (const [x, y] of pts) below.lineTo(x, Math.max(y, y55));
  below.lineTo(pts[pts.length - 1][0], y55);
  below.closePath();
  ctx.fillStyle = rgba(C.acid, 0.28);
  ctx.fill(below);
  if (day || scene === 'powrot') {
    const above = new Path2D();
    above.moveTo(pts[0][0], y55);
    for (const [x, y] of pts) above.lineTo(x, Math.min(y, y55));
    above.lineTo(pts[pts.length - 1][0], y55);
    above.closePath();
    const ag = ctx.createLinearGradient(0, phY(7), 0, y55);
    ag.addColorStop(0, rgba(GOLD, 0.26 + 0.1 * st.deep));
    ag.addColorStop(1, rgba(GOLD, 0.03));
    ctx.fillStyle = ag;
    ctx.fill(above);
  }
  ctx.restore();
  lightLine(ctx, pathOf(pts), px, AQUA, '#f4feff', 2, 0.95);
  const head = pts[pts.length - 1];
  glow(ctx, st.growing ? GOLD_HI : AQUA, head[0], head[1], 12 / px + 1.5, 0.8);
  // what the minerals do at this moment: leave while the pH is low, return as it rises
  const ph = day ? dayPh(T, MEALS) : stephan(T);
  const low = sstep(5.7, 5.0, ph);
  const back = scene === 'powrot' ? sstep(0.15, 1, g) : day ? 0.5 * sstep(5.5, 6.6, ph) : 0;
  for (let i = 0; i < 30; i++) {
    const x = -60 + hash(i * 17 + 3) * 120;
    const c = i % 2 ? C.calcium : C.phosphate;
    if (low > 0.02) {
      const u = st.reduced ? hash(i * 5) : (hash(i * 5) + st.time * 0.12) % 1;
      ion(ctx, px, x, surfY(x) + 2 - u * 9, c, low * 0.9 * (1 - u * 0.6), 1.8);
    }
    if (back > 0.02) {
      const u = st.reduced ? hash(i * 3) : (hash(i * 3) + st.time * 0.1) % 1;
      const y = surfY(x) - 12 + u * 13;
      ion(ctx, px, x, y, c, back * (u < 0.92 ? 0.9 : 0.4), 1.8);
      if (u > 0.9) glow(ctx, GOLD_HI, x, surfY(x) + 0.5, 6 / px + 1, back * 0.6);
    }
  }
  // the plaque makes acid while sugar lasts
  if (!day) {
    const acid = sstep(0.6, 2, T) * (1 - sstep(10, 18, T));
    for (const [cx, w] of PLAQUE) glowEllipse(ctx, C.acid, cx, surfY(cx) - 4, w * 0.6, 6, 0, 0.35 * acid);
  }
  // the saliva answers: its currents strengthen after the sweet moment
  flow(ctx, st, day ? 0.3 : 0.2 + 0.6 * sstep(1, 6, T));
}

function drawSurface(ctx: CanvasRenderingContext2D, st: WorldState): void {
  if (st.scene === 'plukanie') drawWash(ctx, st);
  else if (st.scene === 'blonka') drawPellicle(ctx, st);
  else drawCurve(ctx, st);
  if (st.after > 0 && !st.reduced) sheen(ctx, st, 0.4 + 0.2 * Math.sin(st.time));
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'plukanie') return [-50 + 100 * g, surfY(-50 + 100 * g) - 6];
  if (scene === 'blonka') {
    const x = Math.max(-60, Math.min(60, -90 + 180 * sstep(0, 1, g * 1.04)));
    return [x, surfY(x) - 1];
  }
  const T = timeAt(scene, g);
  if (scene === 'dzien') return [hourX(T), phY(dayPh(T, MEALS))];
  return [minX(T), phY(stephan(T))];
}

function counter(scene: string, g: number): string | null {
  if (scene === 'kwas' || scene === 'powrot') {
    const T = timeAt(scene, g);
    return word('cnt.ph', { ph: dec(stephan(T)), min: Math.round(T) });
  }
  if (scene === 'dzien') return word('cnt.clock', { h: Math.floor(timeAt(scene, g)) });
  return null;
}

export const SURFACE: WorldPainter = {
  depth: 2,
  lens: true,
  bake: bakeSurface,
  draw: drawSurface,
  focusAt,
  counter,
};

export const surfPt = {
  saliva: [-30, -22] as Pt,
  bicarb: [-8, 4] as Pt,
  enamel: [-40, 30] as Pt,
  pellicle: [-20, surfY(-20) - 0.6] as Pt,
  plaque: [PLAQUE[0][0] + 4, surfY(PLAQUE[0][0]) - 5] as Pt,
  critical: [minX(42), phY(5.5)] as Pt,
  criticalDay: [hourX(22.4), phY(5.5)] as Pt,
  calcium: [-20, 8] as Pt,
  meal: [hourX(8.3), phY(5.4)] as Pt,
  repair: [hourX(16), phY(6.4)] as Pt,
  acid: [PLAQUE[2][0], surfY(PLAQUE[2][0]) - 9] as Pt,
};
