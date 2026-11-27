/**
 * The marrow's niche under the lens (DESIGN.md §28, Nowe siły · Źródło w kościach, depth 1): inside a flat bone — a
 * strut of bone above (cream and gold, its lamellae, the bone-lining cells), a wide vessel of the marrow below with
 * red cells passing, between them the marrow's quiet crowd and a few fat cells.  Near the bone the niche: a
 * blood-forming stem cell (pearl and aqua) held by a reticular cell's long arms (gold).
 *
 *   nisza    the stem cell wakes and divides; one daughter stays in the niche, a stem cell still; the other goes on,
 *            dividing again and again, lilac to rose, towards the vessel (Lee-Six et al. 2018: 50 000–200 000 such
 *            cells make the blood at any one time)
 *   krwinki  an erythroblastic island: young red cells round a nurse macrophage ripen, give their nucleus away and
 *            slip into the stream as red cells — about 2 × 10¹¹ a day, over 2 million a second (Dzierzak & Philipsen
 *            2013)
 *
 * The cells move only as the scene grows (a time-lapse); the stream in the vessel flows on gently.
 */
import { GOLD, TAU, glow, glowEllipse, hash, mix, polyAt, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { cell, lerpPt, phase, redDisc, scatter, smooth, stemCell } from './draw';
import { tc } from './i18n';

export const NISZA_VIEW = { x: -100, y: -72, w: 200, h: 142 } as const;
export const WYSPA_VIEW = { x: -24, y: -54, w: 150, h: 112 } as const;

/** the bone's lower edge and the vessel's middle line */
export const boneY = (x: number): number => -54 + 5 * Math.sin(x * 0.03) + 3 * Math.sin(x * 0.071 + 1);
export const sinY = (x: number): number => 50 + 4 * Math.sin(x * 0.025 + 0.5) - x * 0.04;
const SIN_W = 12;

/** the niche: the stem cell, its reticular cell, the way its going daughter takes to the vessel */
export const NICHE: Pt = [-44, -40];
const CAR: Pt = [-56, -30];
export const WAY: readonly Pt[] = [NICHE, [-22, -24], [-2, -8], [18, 10], [36, 24], [48, sinY(48) - SIN_W + 2]];
/** the island: a nurse macrophage with young red cells round it */
export const ISLAND: Pt = [44, -6];
const RING = 9;

const FAT: readonly [number, number, number][] = [[72, -22, 15], [-96, 8, 13], [104, 20, 11], [-72, 36, 9]];
const near = (x: number, y: number, p: Pt, r: number): boolean => Math.hypot(x - p[0], y - p[1]) < r;
const CROWD = scatter(70, { x: -130, y: -60, w: 260, h: 110 }, 11, (x, y) =>
  y > boneY(x) + 6 && y < sinY(x) - SIN_W - 4 && !FAT.some(([fx, fy, fr]) => Math.hypot(x - fx, y - fy) < fr + 3) &&
  !near(x, y, NICHE, 14) && !near(x, y, ISLAND, 32) && !WAY.some(p => near(x, y, p, 9)));
const PASTEL = ['#d8b4c8', '#c8b4e0', '#e8c0b0', '#b8c8e0', '#e0b8c8'];

function bakeBone(ctx: CanvasRenderingContext2D): void {
  // the strut of bone
  const g = ctx.createLinearGradient(0, -110, 0, -46);
  g.addColorStop(0, '#d9c49a');
  g.addColorStop(0.7, '#f0dfba');
  g.addColorStop(1, '#fff1d6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-140, -110);
  ctx.lineTo(140, -110);
  for (let x = 140; x >= -140; x -= 4) ctx.lineTo(x, boneY(x));
  ctx.closePath();
  ctx.fill();
  // its lamellae and osteocytes
  ctx.strokeStyle = 'rgba(190,160,110,.35)';
  ctx.lineWidth = 0.6;
  for (let k = 1; k <= 4; k++) {
    ctx.beginPath();
    for (let x = -140; x <= 140; x += 6) {
      const y = boneY(x) - k * 7 + 1.5 * Math.sin(x * 0.05 + k);
      if (x === -140) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120,90,60,.45)';
  for (let i = 0; i < 16; i++) {
    const x = -130 + hash(i * 2.7) * 260, y = boneY(x) - 6 - hash(i * 5.1) * 30;
    ctx.beginPath();
    ctx.ellipse(x, y, 2, 0.9, 0.2, 0, TAU);
    ctx.fill();
  }
  // the bone-lining cells along its edge
  for (let x = -136; x <= 136; x += 9) cell(ctx, x, boneY(x) + 1.6, 4, 1.4, Math.atan2(boneY(x + 1) - boneY(x - 1), 2), '#e8c8a8', '#a07a6a', 0.85, 0.4);
}

function bakeVessel(ctx: CanvasRenderingContext2D): void {
  // the marrow's wide vessel (a sinusoid): a deep red channel with a thin wall
  ctx.fillStyle = '#4a1430';
  ctx.beginPath();
  for (let x = -140; x <= 140; x += 4) ctx.lineTo(x, sinY(x) - SIN_W);
  for (let x = 140; x >= -140; x -= 4) ctx.lineTo(x, sinY(x) + SIN_W);
  ctx.closePath();
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.strokeStyle = 'rgba(255,190,200,.55)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let x = -140; x <= 140; x += 4) {
      const y = sinY(x) + s * SIN_W;
      if (x === -140) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  glowEllipse(ctx, '#ff5a7a', 0, sinY(0), 150, 18, -0.04, 0.12);
}

function bake(ctx: CanvasRenderingContext2D, variant: string): void {
  // the marrow's ground: a warm rose
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 170);
  g.addColorStop(0, '#5a2840');
  g.addColorStop(1, '#2a1028');
  ctx.fillStyle = g;
  ctx.fillRect(-150, -120, 300, 240);
  bakeBone(ctx);
  bakeVessel(ctx);
  for (const [x, y, r] of FAT) {
    ctx.fillStyle = 'rgba(255,240,200,.18)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,200,.45)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    glow(ctx, '#fff2c8', x - r * 0.3, y - r * 0.3, r * 0.6, 0.12);
  }
  CROWD.forEach((c, i) => cell(ctx, c.x, c.y, c.r, c.r * (0.85 + 0.15 * c.k), c.k * 3, PASTEL[i % PASTEL.length], mix(PASTEL[(i + 2) % PASTEL.length], '#3a2050', 0.6), 0.75));
  // the reticular cell's long arms round the niche
  ctx.strokeStyle = 'rgba(255,214,140,.55)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.4;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(CAR[0], CAR[1]);
    ctx.quadraticCurveTo(CAR[0] + Math.cos(a) * 10, CAR[1] + Math.sin(a) * 6, CAR[0] + Math.cos(a + 0.3) * 20, CAR[1] + Math.sin(a + 0.3) * 13);
    ctx.stroke();
  }
  cell(ctx, CAR[0], CAR[1], 5, 3.4, 0.5, '#f0c880', '#9a6a3a', 0.95);
  if (variant === 'wyspa') {
    // the nurse macrophage, its arms open round the island
    ctx.fillStyle = 'rgba(255,226,170,.85)';
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU, r = 13 + 3.5 * Math.sin(a * 5 + 1) + 1.5 * Math.sin(a * 3);
      const x = ISLAND[0] + Math.cos(a) * r, y = ISLAND[1] + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    cell(ctx, ISLAND[0] + 2, ISLAND[1] + 1, 5.5, 4.6, 0.4, '#e8b878', '#8a5a3a', 0.9, 0.6);
  }
}

/** The blood in the vessel: red cells drifting left to right; more of them as the scene grows. */
function stream(ctx: CanvasRenderingContext2D, st: WorldState, n: number): void {
  for (let i = 0; i < n; i++) {
    const q = st.reduced ? hash(i * 3.3) : (st.time * (0.025 + 0.012 * hash(i * 1.7)) + hash(i * 3.3)) % 1;
    const x = -140 + 280 * q, y = sinY(x) + (hash(i * 9.1) - 0.5) * SIN_W * 1.4;
    redDisc(ctx, x, y, 3.2, hash(i) * 3, 0.85, 0.55 + 0.4 * hash(i * 2.1));
  }
}

/** The niche: the stem cell wakes and divides; the going daughter divides on its way to the vessel. */
function drawNiche(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const k = st.g;
  const wake = smooth(phase(k, 0, 0.15));
  const div = phase(k, 0.15, 0.4);
  stream(ctx, st, Math.round(10 + 22 * k));
  if (div < 1) {
    // dividing: the cell lengthens and parts along the way it will go
    const dir = Math.atan2(WAY[1][1] - NICHE[1], WAY[1][0] - NICHE[0]);
    const s = 7 * smooth(div);
    stemCell(ctx, NICHE[0] - Math.cos(dir) * s * 0.3, NICHE[1] - Math.sin(dir) * s * 0.3, 6.2 - 0.8 * div, wake, st.time, st.reduced);
    if (div > 0.05) {
      const [x, y] = [NICHE[0] + Math.cos(dir) * s, NICHE[1] + Math.sin(dir) * s];
      cell(ctx, x, y, 5.6, 5.2, dir, mix('#b9dfe8', '#c9a6ff', div), '#4a4a9a', smooth(div * 3), 0.55);
      if (div > 0.3 && div < 0.9) glow(ctx, '#ffffff', NICHE[0] + Math.cos(dir) * s * 0.4, NICHE[1] + Math.sin(dir) * s * 0.4, 4, 0.4 * Math.sin(Math.PI * (div - 0.3) / 0.6));
    }
    return;
  }
  // one daughter stays: a stem cell still, quiet in its niche
  stemCell(ctx, NICHE[0], NICHE[1], 6, 0.35, st.time, st.reduced);
  // the other goes on, dividing: 1 → 2 → 4 → 8 cells along the way, lilac to rose to a red disc
  const t = phase(k, 0.4, 1);
  const count = t < 0.18 ? 1 : t < 0.38 ? 2 : t < 0.58 ? 4 : 8;
  const front = Math.min(1, t * 1.08);
  for (let i = 0; i < count; i++) {
    const q = Math.max(0, front - i * 0.075);
    const [x, y] = polyAt(WAY, q);
    const ripe = Math.min(1, q * 1.15);
    const r = 5.2 - 2.2 * ripe;
    if (ripe > 0.88) redDisc(ctx, x, y, 3.2, i, 1, 0.8);
    else cell(ctx, x + (i % 2 ? 1.6 : -1.6), y, r, r * 0.92, i, mix('#c9a6ff', '#ff8fa0', ripe), mix('#4a4a9a', '#5a1a3a', ripe), 1, 0.55 - 0.25 * ripe);
  }
  if (t > 0.9) glow(ctx, '#ff8f9a', WAY[WAY.length - 1][0], WAY[WAY.length - 1][1], 8, 0.4 * phase(t, 0.9, 1));
}

/** The island: young red cells ripen round the nurse cell, give away the nucleus, slip into the stream. */
function drawIsland(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const k = st.g;
  stream(ctx, st, Math.round(12 + 30 * k));
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * TAU - Math.PI / 2;
    const home: Pt = [ISLAND[0] + Math.cos(a) * 21, ISLAND[1] + Math.sin(a) * 19];
    const t0 = 0.04 + i * 0.075;
    const ripe = phase(k, t0, t0 + 0.3);
    const give = phase(k, t0 + 0.3, t0 + 0.38);
    const go = phase(k, t0 + 0.38, t0 + 0.55);
    if (go >= 1) continue;
    // the nucleus leaves for the nurse cell and is taken in
    if (give > 0) {
      const [nx, ny] = lerpPt(home, ISLAND, 0.55 * give);
      ctx.fillStyle = rgba('#3a1830', 0.85 * (1 - give * 0.8));
      ctx.beginPath();
      ctx.arc(nx, ny, 1.6, 0, TAU);
      ctx.fill();
    }
    const entry: Pt = [home[0] + 6, sinY(home[0] + 6) - 2];
    const at = go > 0 ? lerpPt(home, entry, smooth(go)) : home;
    if (give >= 1) redDisc(ctx, at[0], at[1], 3.6, a, 1, 0.75);
    else cell(ctx, at[0], at[1], 4.6 - 0.8 * ripe, 4.3 - 0.8 * ripe, a, mix('#e0a6c8', '#ff7a80', ripe), give > 0 ? null : mix('#5a3a8a', '#2a0a1a', ripe), 1, 0.55 - 0.22 * ripe);
    if (go > 0 && go < 1) glow(ctx, '#ff9a9a', at[0], at[1], 6, 0.3 * Math.sin(Math.PI * go));
  }
  // new young cells come to the island from the left as the old ones leave
  const n = Math.round(4 * phase(k, 0.5, 1));
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.8 + i * 0.2);
    cell(ctx, ISLAND[0] + Math.cos(a) * 22, ISLAND[1] + Math.sin(a) * 20, 4.6, 4.3, a, '#e0a6c8', '#5a3a8a', smooth(phase(k, 0.5 + i * 0.1, 0.65 + i * 0.1)), 0.55);
  }
  if (k > 0.05) glow(ctx, GOLD, ISLAND[0], ISLAND[1], 10, 0.12 * k);
}

export const SZPIK_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake,
  draw(ctx, st) {
    if (st.scene === 'krwinki') drawIsland(ctx, st);
    else drawNiche(ctx, st);
    if (st.deep > 0.02) glowEllipse(ctx, '#ff9aa0', 0, 0, 90, 60, 0, 0.08 * st.deep);
  },
  focusAt(scene, g) {
    if (scene === 'krwinki') {
      const i = Math.min(RING - 1, Math.floor(Math.max(0, g - 0.04) / 0.075));
      const a = (i / RING) * TAU - Math.PI / 2;
      return [ISLAND[0] + Math.cos(a) * 21, ISLAND[1] + Math.sin(a) * 19];
    }
    if (g < 0.4) return NICHE;
    return polyAt(WAY, Math.min(1, phase(g, 0.4, 1) * 1.08));
  },
  counter(scene, g) {
    if (g < 0.15) return null;
    return tc(scene === 'krwinki' ? 'count.krwinki' : 'count.nisza');
  },
};
