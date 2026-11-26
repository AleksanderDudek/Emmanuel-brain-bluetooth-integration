/**
 * The tissue (DESIGN.md §24): a capillary across the top with blood flowing, the tissue's cells below, each with
 * its soft "self" signs, one cell that has begun to change, a lymphatic capillary at the lower left.  Seen through
 * the lens; what moves and grows is drawn live:
 *
 *   patrol       an NK cell travels between the cells; each one it checks shows its self signs and keeps a thin gold ring
 *   znak         at the changed cell: few self signs, violet stress flags; the NK cell docks, its granules gather
 *   porzadek     the changed cell folds itself away into small bodies with "eat me" signs; a macrophage takes them in
 *   probka       a dendritic cell reaches out, takes pieces of the changed cell, matures and leaves for the lymphatic
 *   wyjscie      a T cell rolls along the vessel's wall, stops, and squeezes between the lining cells into the tissue
 *   skan         the T cell reads the cells' signs one after another until it finds the changed cell's flags
 *   cala_patrol  the whole patrol in one: checking, docking, folding away, clearing
 */
import { clamp, ease } from '../kit/juice';
import { AQUA, GOLD, GOLD_HI, TAU, glow, hash, rgba, smoothPath } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import {
  CHANGED, CAP_HALF, DC_ARMS, DC_AT, DC_REACH, JUNCTION_X, LYMPH, LYMPH_ENTRY, LYMPH_HALF, MAC_FROM, NK_PATH, T_PATH,
  along, capY, tissueCells, touched, type Pt,
} from './geo';
import {
  LYMPH_C, SELF, apoptoticBodies, changedCell, checkedRing, dendritic, lymphocyte, macrophage, piece, rbc, selfSigns, tissueCell,
} from './cells';

const X0 = -320, X1 = 320, Y0 = -300, Y1 = 300;
const NK_R = 7, T_R = 6.2;

// ── the still tissue ─────────────────────────────────────────────
function bake(ctx: CanvasRenderingContext2D): void {
  // the space between the cells: a deep indigo, with fibres catching the light
  const g = ctx.createLinearGradient(0, Y0, 0, Y1);
  g.addColorStop(0, '#120b2a');
  g.addColorStop(0.5, '#1a1036');
  g.addColorStop(1, '#130b2a');
  ctx.fillStyle = g;
  ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  for (let i = 0; i < 260; i++) {
    const x = X0 + hash(i * 3.7 + 1) * (X1 - X0), y = Y0 + hash(i * 5.3 + 2) * (Y1 - Y0);
    const l = 8 + 16 * hash(i + 3), a = hash(i * 7.1) * TAU;
    ctx.strokeStyle = i % 3 ? 'rgba(150,140,255,.08)' : 'rgba(210,190,255,.14)';
    ctx.lineWidth = i % 3 ? 0.5 : 0.25;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + Math.cos(a) * l * 0.3 + 2, y + Math.sin(a) * l * 0.3 - 2, x + Math.cos(a) * l * 0.6 - 2, y + Math.sin(a) * l * 0.6 + 2, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  lymphatic(ctx);
  capillary(ctx);
  for (const c of tissueCells()) tissueCell(ctx, c.x, c.y, c.r, c.rot, c.seed);
}

function capillary(ctx: CanvasRenderingContext2D): void {
  const top = new Path2D(), bot = new Path2D(), lumen = new Path2D();
  for (let x = X0; x <= X1; x += 4) {
    if (x === X0) {
      top.moveTo(x, capY(x) - CAP_HALF);
      bot.moveTo(x, capY(x) + CAP_HALF);
    } else {
      top.lineTo(x, capY(x) - CAP_HALF);
      bot.lineTo(x, capY(x) + CAP_HALF);
    }
  }
  for (let x = X0; x <= X1; x += 4) x === X0 ? lumen.moveTo(x, capY(x) - CAP_HALF) : lumen.lineTo(x, capY(x) - CAP_HALF);
  for (let x = X1; x >= X0; x -= 4) lumen.lineTo(x, capY(x) + CAP_HALF);
  lumen.closePath();
  const lg = ctx.createLinearGradient(0, -60, 0, -32);
  lg.addColorStop(0, '#3a0e2c');
  lg.addColorStop(0.5, '#5a1636');
  lg.addColorStop(1, '#3a0e2c');
  ctx.fillStyle = lg;
  ctx.fill(lumen);
  // the lining cells: a thin pearl wall each side, their flat nuclei bulging into it
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,90,120,.12)';
  ctx.lineWidth = 5;
  ctx.stroke(top);
  ctx.stroke(bot);
  ctx.globalCompositeOperation = op;
  ctx.strokeStyle = 'rgba(255,214,226,.75)';
  ctx.lineWidth = 1.1;
  ctx.stroke(top);
  ctx.stroke(bot);
  for (let x = X0 + 10; x < X1; x += 30) {
    for (const s of [-1, 1]) {
      const xx = x + (s > 0 ? 15 : 0) + 4 * hash(x * 0.37 + s);
      ctx.beginPath();
      ctx.ellipse(xx, capY(xx) + s * (CAP_HALF - 0.6), 4.2, 1.1, Math.atan(0.09 * Math.cos(xx * 0.018 + 0.6)), 0, TAU);
      ctx.fillStyle = 'rgba(200,150,220,.8)';
      ctx.fill();
    }
  }
  // the junctions between lining cells (one under the crossing)
  ctx.strokeStyle = 'rgba(255,240,246,.55)';
  ctx.lineWidth = 0.4;
  const joins: number[] = [JUNCTION_X];
  for (let x = X0 + 25; x < X1; x += 30) if (Math.abs(x - JUNCTION_X) > 12) joins.push(x);
  for (const xx of joins) {
    for (const s of [-1, 1]) {
      const y = capY(xx) + s * CAP_HALF;
      ctx.beginPath();
      ctx.moveTo(xx, y - 1);
      ctx.lineTo(xx, y + 1);
      ctx.stroke();
    }
  }
}

function lymphatic(ctx: CanvasRenderingContext2D): void {
  const p = new Path2D();
  smoothPath(p, LYMPH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(LYMPH_C, 0.08);
  ctx.lineWidth = LYMPH_HALF * 2 + 6;
  ctx.stroke(p);
  ctx.globalCompositeOperation = op;
  ctx.strokeStyle = 'rgba(40,70,80,.85)';
  ctx.lineWidth = LYMPH_HALF * 2;
  ctx.stroke(p);
  ctx.strokeStyle = rgba(LYMPH_C, 0.18);
  ctx.lineWidth = LYMPH_HALF * 2 - 2;
  ctx.stroke(p);
  // its thin overlapping lining (flaps that let fluid and cells in)
  for (let i = 2; i < LYMPH.length - 2; i += 3) {
    const [x, y] = LYMPH[i], [x2, y2] = LYMPH[i + 1];
    const a = Math.atan2(y2 - y, x2 - x), nx = -Math.sin(a), ny = Math.cos(a);
    for (const s of [-1, 1]) {
      const bx = x + nx * s * LYMPH_HALF, by = y + ny * s * LYMPH_HALF;
      ctx.strokeStyle = rgba(LYMPH_C, 0.6);
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(bx - Math.cos(a) * 3, by - Math.sin(a) * 3);
      ctx.quadraticCurveTo(bx, by, bx + Math.cos(a) * 3 - nx * s * 1.4, by + Math.sin(a) * 3 - ny * s * 1.4);
      ctx.stroke();
    }
  }
}

// ── what lives ───────────────────────────────────────────────────
function blood(ctx: CanvasRenderingContext2D, t: number): void {
  for (let i = 0; i < 30; i++) {
    const x = ((i * 23 + t * 11 + 900) % 640) - 320;
    const y = capY(x) + (hash(i * 3.3) - 0.5) * 7;
    const slope = Math.atan(0.09 * Math.cos(x * 0.018 + 0.6));
    rbc(ctx, x, y, 3.8, 0.3 + 0.6 * hash(i * 1.7), slope + (hash(i) - 0.5) * 0.6);
  }
}

function lymphFlow(ctx: CanvasRenderingContext2D, t: number): void {
  for (let i = 0; i < 18; i++) {
    const k = (i / 18 + t * 0.008) % 1;
    const [x, y] = along(LYMPH, k);
    const j = (hash(i * 4.4) - 0.5) * LYMPH_HALF;
    glow(ctx, LYMPH_C, x + j * 0.4, y + j * 0.4, 1.6, 0.35);
  }
}

const NK_TOUCH = touched(NK_PATH);
const T_TOUCH = touched(T_PATH, 18);

/** The cells a round has checked up to `k` of its path: thin gold rings, the freshest one's self signs bright. */
function checks(ctx: CanvasRenderingContext2D, list: { cell: { x: number; y: number; r: number; seed: number }; k: number }[], k: number, deep: number): number {
  let n = 0;
  for (const { cell, k: kk } of list) {
    if (kk > k) break;
    n++;
    const fresh = clamp(1 - (k - kk) / 0.08);
    checkedRing(ctx, cell.x, cell.y, cell.r, fresh, 0.7 + 0.3 * deep);
    if (fresh > 0.02) selfSigns(ctx, cell.x, cell.y, cell.r, cell.seed, 0.95 * fresh);
  }
  return n;
}

const NK_END = NK_PATH[NK_PATH.length - 1];
const unit = (a: Pt, b: Pt): [number, number] => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};
const NK_DIR = unit(CHANGED.at, NK_END);
const NK_DOCK: Pt = [CHANGED.at[0] + NK_DIR[0] * (CHANGED.r + NK_R - 1.5), CHANGED.at[1] + NK_DIR[1] * (CHANGED.r + NK_R - 1.5)];
const T_END = T_PATH[T_PATH.length - 1];
const T_DIR = unit(CHANGED.at, T_END);
const T_DOCK: Pt = [CHANGED.at[0] + T_DIR[0] * (CHANGED.r + T_R - 1.2), CHANGED.at[1] + T_DIR[1] * (CHANGED.r + T_R - 1.2)];

function nkAt(scene: string, g: number): Pt {
  if (scene === 'patrol') return along(NK_PATH, ease.inOutSine(g));
  if (scene === 'znak') return lerpPt(along(NK_PATH, 0.86), NK_DOCK, ease.outCubic(clamp(g / 0.3)));
  // the folding away: the NK cell moves on, up and to the right
  return lerpPt(NK_DOCK, [52, -18], ease.inOutSine(clamp(g / 0.5)));
}

const lerpPt = (a: Pt, b: Pt, k: number): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

function drawPatrol(ctx: CanvasRenderingContext2D, g: number, st: WorldState, trail = true): void {
  const k = ease.inOutSine(g);
  changedCell(ctx, CHANGED.at, CHANGED.r, { flags: 0.3, self: 1, time: st.time });
  if (trail && k > 0.01) {
    ctx.save();
    ctx.setLineDash([1.2, 2.4]);
    ctx.strokeStyle = rgba(AQUA, 0.3);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    const n = Math.max(2, Math.ceil(k * (NK_PATH.length - 1)));
    for (let i = 0; i < n; i++) i ? ctx.lineTo(NK_PATH[i][0], NK_PATH[i][1]) : ctx.moveTo(NK_PATH[i][0], NK_PATH[i][1]);
    const p = along(NK_PATH, k);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    ctx.restore();
  }
  checks(ctx, NK_TOUCH, k, st.deep);
  const [x, y] = along(NK_PATH, k);
  lymphocyte(ctx, x, y, NK_R, { kind: 'nk', glow: st.growing ? st.light : 0.3, seed: 3, rot: Math.sin(st.time * 0.8) * 0.2 });
}

function drawSign(ctx: CanvasRenderingContext2D, g: number, st: WorldState): void {
  const dockK = ease.outCubic(clamp(g / 0.3));
  const flags = 0.35 + 0.65 * clamp(g / 0.35);
  const gather = clamp((g - 0.35) / 0.4);
  changedCell(ctx, CHANGED.at, CHANGED.r, { flags, self: 1 - 0.6 * clamp(g / 0.4), time: st.time, shine: clamp((g - 0.2) / 0.4) });
  const [x, y] = nkAt('znak', g);
  // the contact: a soft seam of light where the two membranes meet
  if (dockK > 0.6) {
    const c = lerpPt(CHANGED.at, NK_DOCK, CHANGED.r / (CHANGED.r + NK_R - 1.5));
    glow(ctx, GOLD, c[0], c[1], 5 + 3 * gather, 0.25 + 0.45 * gather);
  }
  const toward = Math.atan2(CHANGED.at[1] - y, CHANGED.at[0] - x);
  lymphocyte(ctx, x, y, NK_R, { kind: 'nk', glow: 0.4 + 0.5 * (st.growing ? st.light : 0.4), seed: 3, toward, gather });
  // perforin: tiny rings of gold on the changed cell's membrane, facing the NK cell
  const pores = clamp((g - 0.75) / 0.2);
  if (pores > 0) {
    for (let i = -2; i <= 2; i++) {
      const a = toward + Math.PI + i * 0.16;
      const px = CHANGED.at[0] + Math.cos(a) * CHANGED.r, py = CHANGED.at[1] + Math.sin(a) * CHANGED.r;
      ctx.beginPath();
      ctx.arc(px, py, 0.7, 0, TAU);
      ctx.strokeStyle = rgba(GOLD_HI, pores);
      ctx.lineWidth = 0.35;
      ctx.stroke();
      glow(ctx, GOLD, px, py, 1.8, 0.4 * pores);
    }
  }
}

function drawClear(ctx: CanvasRenderingContext2D, g: number, st: WorldState): void {
  const fold = clamp(g / 0.5);
  const bodies = clamp((g - 0.32) / 0.14);
  const eatMe = clamp((g - 0.42) / 0.14);
  // the NK cell moves on
  const away = clamp(g / 0.5);
  const [nx, ny] = nkAt('porzadek', g);
  lymphocyte(ctx, nx, ny, NK_R, { kind: 'nk', glow: 0.3, seed: 3, alpha: 1 - 0.5 * away });
  // the macrophage comes up from below and takes the bodies in, one after another
  const come = ease.inOutSine(clamp((g - 0.3) / 0.4));
  const target: Pt = [CHANGED.at[0] - 6, CHANGED.at[1] + 15];
  const [mx, my] = lerpPt(MAC_FROM, target, come);
  const taken = (i: number) => clamp((g - (0.68 + i * 0.04)) / 0.06);
  let fed = 0;
  for (let i = 0; i < 7; i++) fed += taken(i);
  const dir = Math.atan2(CHANGED.at[1] - my, CHANGED.at[0] - mx);
  changedCell(ctx, CHANGED.at, CHANGED.r, { flags: 0.6 * (1 - fold), self: 0.3, fold, time: st.time });
  apoptoticBodies(ctx, CHANGED.at, CHANGED.r * (0.8 + 0.3 * eatMe), bodies, eatMe, taken, st.time);
  macrophage(ctx, mx, my, 13, dir, clamp((g - 0.55) / 0.2) * (1 - 0.5 * clamp((g - 0.95) / 0.05)), st.time, fed / 7);
  // when all is taken in: a quiet light where the cell was, the place tidy
  const tidy = clamp((g - 0.9) / 0.1);
  if (tidy > 0) glow(ctx, GOLD_HI, CHANGED.at[0], CHANGED.at[1], CHANGED.r * 1.6, 0.18 * tidy + 0.08 * st.deep);
}

function dcAt(g: number): Pt {
  return lerpPt(DC_AT, LYMPH_ENTRY, ease.inOutSine(clamp((g - 0.78) / 0.22)));
}

function drawSample(ctx: CanvasRenderingContext2D, g: number, st: WorldState): void {
  changedCell(ctx, CHANGED.at, CHANGED.r, { flags: 0.75, self: 0.4, time: st.time });
  const reach = ease.outCubic(clamp(g / 0.25)) * (1 - clamp((g - 0.62) / 0.18));
  const arms = DC_ARMS.map((a, i) => (i === 0 ? { a: a.a, len: DC_REACH - 4 } : a));
  const carry = clamp((g - 0.3) / 0.32);
  const mature = clamp((g - 0.6) / 0.2);
  const [x, y] = dcAt(g);
  // the pieces travel along the long arm into the cell
  const tip: Pt = [DC_AT[0] + Math.cos(arms[0].a) * (DC_REACH + 0.5), DC_AT[1] + Math.sin(arms[0].a) * (DC_REACH + 0.5)];
  dendritic(ctx, x, y, 5.5, arms, { reach, mature, carry, time: st.time, glow: st.growing ? st.light : 0.3 });
  for (let i = 0; i < 5; i++) {
    const k = clamp((g - 0.24 - i * 0.07) / 0.18);
    if (k <= 0 || k >= 1) continue;
    const [px, py] = lerpPt(tip, DC_AT, ease.inOutSine(k));
    piece(ctx, px, py, 0.8, Math.min(1, k * 4, (1 - k) * 4));
  }
}

function tCrossing(g: number): { x: number; y: number; sx: number; sy: number; rot: number; inLumen: boolean } {
  const wallY = (x: number) => capY(x) + CAP_HALF;
  if (g < 0.4) {
    const k = ease.outCubic(g / 0.4);
    const x = -112 + (JUNCTION_X - 1 - -112) * k;
    return { x, y: wallY(x) - T_R - 0.4, sx: 1, sy: 1, rot: (x - -112) / T_R, inLumen: true };
  }
  if (g < 0.55) {
    const k = (g - 0.4) / 0.15;
    const x = JUNCTION_X - 1 + k;
    return { x, y: wallY(x) - T_R * (1 - 0.12 * k) - 0.4, sx: 1 + 0.12 * k, sy: 1 - 0.12 * k, rot: (JUNCTION_X - 1 - -112) / T_R, inLumen: true };
  }
  if (g < 0.9) {
    const k = ease.inOutSine((g - 0.55) / 0.35);
    const y0 = wallY(JUNCTION_X) - T_R * 0.88 - 0.4, y1 = wallY(JUNCTION_X) + T_R + 2.5;
    const sq = Math.sin(Math.PI * k);
    return { x: JUNCTION_X, y: y0 + (y1 - y0) * k, sx: 1.12 - 0.62 * sq, sy: 0.88 + 0.5 * sq, rot: 0, inLumen: k < 0.5 };
  }
  const k = ease.outCubic((g - 0.9) / 0.1);
  const [x, y] = lerpPt([JUNCTION_X, wallY(JUNCTION_X) + T_R + 2.5], T_PATH[1], k * 0.35);
  return { x, y, sx: 1, sy: 1, rot: 0, inLumen: false };
}

function drawCross(ctx: CanvasRenderingContext2D, g: number, st: WorldState): void {
  const c = tCrossing(g);
  const wallY = capY(c.x) + CAP_HALF;
  // the rolling's light tethers (selectins), then the firm hold (integrins)
  if (g < 0.42) {
    for (let i = 0; i < 3; i++) {
      const a = c.rot * 0.6 + i * 2.1;
      const fx = c.x + Math.sin(a) * T_R * 0.7;
      const on = 0.5 + 0.5 * Math.sin(st.time * 6 + i * 2);
      ctx.strokeStyle = rgba(AQUA, 0.6 * on);
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(fx, c.y + T_R * 0.9);
      ctx.lineTo(fx + 0.8, wallY - 0.5);
      ctx.stroke();
    }
  } else if (g < 0.62) {
    const hold = clamp((g - 0.4) / 0.08);
    for (let i = -2; i <= 2; i++) glow(ctx, GOLD, c.x + i * 1.6, wallY - 0.6, 1.8, 0.45 * hold);
  }
  // the junction parts while the cell passes
  if (g > 0.5 && g < 0.95) {
    const open = Math.sin(Math.PI * clamp((g - 0.52) / 0.42));
    glow(ctx, GOLD_HI, JUNCTION_X, wallY, 3 + 2 * open, 0.3 * open);
  }
  lymphocyte(ctx, c.x, c.y, T_R, { kind: 't', glow: st.growing ? st.light : 0.3, sx: c.sx, sy: c.sy, rot: c.rot, seed: 7 });
  // the lining laps back over the half that is still inside (so the cell reads as passing through the wall)
  if (g > 0.55 && g < 0.9) {
    ctx.strokeStyle = 'rgba(255,214,226,.85)';
    ctx.lineWidth = 1.1;
    const gap = T_R * 0.62 * (c.sx);
    ctx.beginPath();
    ctx.moveTo(JUNCTION_X - 12, capY(JUNCTION_X - 12) + CAP_HALF);
    ctx.lineTo(JUNCTION_X - gap, wallY);
    ctx.moveTo(JUNCTION_X + gap, wallY);
    ctx.lineTo(JUNCTION_X + 12, capY(JUNCTION_X + 12) + CAP_HALF);
    ctx.stroke();
  }
}

function drawScan(ctx: CanvasRenderingContext2D, g: number, st: WorldState): void {
  const k = ease.inOutSine(clamp(g / 0.88));
  const found = clamp((g - 0.84) / 0.16);
  changedCell(ctx, CHANGED.at, CHANGED.r, { flags: 0.45 + 0.55 * found, self: 0.4, time: st.time, shine: found });
  checks(ctx, T_TOUCH, k, st.deep);
  const [x, y] = found > 0 ? lerpPt(T_END, T_DOCK, ease.outCubic(found)) : along(T_PATH, k);
  // reading: a fine line of receptor contact to the nearest cell it touches now
  for (const { cell, k: kk } of T_TOUCH) {
    const d = Math.abs(k - kk);
    if (d > 0.04) continue;
    const a = 1 - d / 0.04;
    ctx.strokeStyle = rgba(SELF, 0.7 * a);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cell.x + (x - cell.x) * (cell.r / Math.hypot(x - cell.x, y - cell.y)), cell.y + (y - cell.y) * (cell.r / Math.hypot(x - cell.x, y - cell.y)));
    ctx.stroke();
  }
  if (found > 0.3) {
    const c = lerpPt(CHANGED.at, T_DOCK, CHANGED.r / (CHANGED.r + T_R - 1.2));
    glow(ctx, GOLD, c[0], c[1], 6, 0.5 * found);
    ctx.beginPath();
    ctx.arc(c[0], c[1], 3.2, 0, TAU);
    ctx.strokeStyle = rgba(GOLD_HI, 0.7 * found);
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
  lymphocyte(ctx, x, y, T_R, { kind: 't', glow: st.growing ? st.light : 0.3, gold: found, seed: 7, rot: Math.sin(st.time * 0.7) * 0.2 });
}

function draw(ctx: CanvasRenderingContext2D, st0: WorldState): void {
  // reduced motion: the picture still grows, but nothing drifts or sways on its own
  const st = st0.reduced ? { ...st0, time: 0 } : st0;
  const t = st.time;
  blood(ctx, t);
  lymphFlow(ctx, t);
  const { scene, g } = st;
  if (scene === 'patrol') drawPatrol(ctx, g, st);
  else if (scene === 'znak') drawSign(ctx, g, st);
  else if (scene === 'porzadek') drawClear(ctx, g, st);
  else if (scene === 'probka') drawSample(ctx, g, st);
  else if (scene === 'wyjscie') {
    changedCell(ctx, CHANGED.at, CHANGED.r, { flags: 0.3, self: 1, time: st.time });
    drawCross(ctx, g, st);
  } else if (scene === 'skan') drawScan(ctx, g, st);
  else if (scene === 'cala_patrol') {
    if (g < 0.4) drawPatrol(ctx, g / 0.4, st);
    else {
      checks(ctx, NK_TOUCH, 1, st.deep);
      if (g < 0.68) drawSign(ctx, (g - 0.4) / 0.28, st);
      else drawClear(ctx, (g - 0.68) / 0.32, st);
    }
  }
  if (st.deep > 0.02) glow(ctx, '#8fa8ff', CHANGED.at[0] - 20, CHANGED.at[1] - 10, 90, 0.07 * st.deep);
  if (st.deep > 0.02) glow(ctx, '#ffb08a', -40, capY(-40), 60, 0.06 * st.deep);
}

/** Where the growing point is: the cell at work. */
function focusAt(scene: string, g: number): Pt {
  if (scene === 'patrol') return nkAt('patrol', g);
  if (scene === 'znak') return lerpPt(CHANGED.at, NK_DOCK, 0.6);
  if (scene === 'porzadek') return CHANGED.at;
  if (scene === 'probka') return g < 0.6 ? lerpPt(DC_AT, CHANGED.at, 0.45) : dcAt(g);
  if (scene === 'wyjscie') {
    const c = tCrossing(g);
    return [c.x, c.y];
  }
  if (scene === 'skan') return g > 0.84 ? T_DOCK : along(T_PATH, ease.inOutSine(clamp(g / 0.88)));
  if (scene === 'cala_patrol') return g < 0.4 ? nkAt('patrol', g / 0.4) : CHANGED.at;
  return CHANGED.at;
}

/** How many cells a round has checked so far (the headline's own count, on the picture's corner). */
export function checkedCount(scene: string, g: number): number | null {
  if (scene === 'patrol') return NK_TOUCH.filter(c => c.k <= ease.inOutSine(g)).length;
  if (scene === 'cala_patrol') return NK_TOUCH.filter(c => c.k <= ease.inOutSine(Math.min(1, g / 0.4))).length;
  if (scene === 'skan') return T_TOUCH.filter(c => c.k <= ease.inOutSine(clamp(g / 0.88))).length;
  return null;
}

export const NK_DOCK_AT = NK_DOCK;
export const T_DOCK_AT = T_DOCK;

export function tissueWorld(counter: (scene: string, g: number) => string | null): WorldPainter {
  return { depth: 1, lens: true, bake: (ctx) => bake(ctx), draw, focusAt, counter };
}
