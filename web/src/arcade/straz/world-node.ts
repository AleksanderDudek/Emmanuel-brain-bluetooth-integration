/**
 * The lymph node in section (DESIGN.md §24): afferent vessels bring lymph to its convex side; under the capsule the
 * sinus; the follicles of B cells in the cortex, the T-cell zone deeper, the medulla's cords converging on the
 * hilum, where the efferent vessel leaves.  Seen through the lens; what moves and grows is drawn live:
 *
 *   droga        the mature dendritic cell drifts in with the lymph, along the sinus, into the T-cell zone
 *   dopasowanie  close up: T cells wander past its arms; one fits — signal 1, signal 2 — and wakes, gold
 *   klony        the woken T cell divides again and again: a gold ring of clones grows, some leave by the medulla
 *   pamiec       the work done, most clones go quietly; a few stay as memory cells
 *   cala_wezel   the whole node in one: the dendritic cell arrives, one T cell wakes, the clones bloom
 */
import { clamp, ease } from '../kit/juice';
import { AQUA, GOLD, GOLD_HI, TAU, glow, hash, rgba, smoothPath } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { AFFERENT, CLONES, DC_ROUTE, EFFERENT, FOLLICLES, MEET, along, medullaCords, nodeOutline, spline, type Pt } from './geo';
import { DC_C, FLAG, LYMPH_C, dendritic, drawSprite, lymphSprite, lymphocyte } from './cells';

const X0 = -360, X1 = 360, Y0 = -300, Y1 = 300;

function pathOf(pts: readonly Pt[], close = false): Path2D {
  const p = new Path2D();
  smoothPath(p, pts as [number, number][]);
  if (close) p.closePath();
  return p;
}

function vessel(ctx: CanvasRenderingContext2D, pts: readonly Pt[], w: number): void {
  const p = pathOf(pts);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(LYMPH_C, 0.07);
  ctx.lineWidth = w + 6;
  ctx.stroke(p);
  ctx.globalCompositeOperation = op;
  ctx.strokeStyle = 'rgba(34,64,74,.9)';
  ctx.lineWidth = w;
  ctx.stroke(p);
  ctx.strokeStyle = rgba(LYMPH_C, 0.22);
  ctx.lineWidth = w - 1.6;
  ctx.stroke(p);
  ctx.strokeStyle = rgba(LYMPH_C, 0.5);
  ctx.lineWidth = 0.35;
  // the valves: pairs of small leaflets pointing the way lymph goes
  for (let i = 4; i < pts.length - 2; i += 6) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1];
    const a = Math.atan2(y2 - y, x2 - x), nx = -Math.sin(a), ny = Math.cos(a);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + nx * s * w * 0.45, y + ny * s * w * 0.45);
      ctx.quadraticCurveTo(x + Math.cos(a) * w * 0.4, y + Math.sin(a) * w * 0.4, x + Math.cos(a) * w * 0.7 + nx * s * 0.4, y + Math.sin(a) * w * 0.7 + ny * s * 0.4);
      ctx.stroke();
    }
  }
}

// ── the still node ───────────────────────────────────────────────
function bake(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(0, 0, 40, 0, 0, 380);
  g.addColorStop(0, '#1c1236');
  g.addColorStop(1, '#100a22');
  ctx.fillStyle = g;
  ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  // the fat and loose tissue round the node: large faint cells
  for (let i = 0; i < 220; i++) {
    const x = X0 + hash(i * 3.1 + 7) * (X1 - X0), y = Y0 + hash(i * 4.7 + 9) * (Y1 - Y0);
    if ((x / 100) ** 2 + (y / 68) ** 2 < 1.05) continue;
    const r = 6 + 5 * hash(i * 2.3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = 'rgba(255,214,170,.035)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,170,.1)';
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }
  // blood at the hilum: an artery in, a vein out
  for (const [dy, c, w] of [[-12, 'rgba(255,84,112,.75)', 3.2], [14, 'rgba(130,110,240,.7)', 4]] as const) {
    const p = pathOf(spline([[230, dy * 2.2], [150, dy * 1.6], [104, dy * 1.1], [76, dy * 0.5], [58, dy * 0.25]]));
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.stroke(p);
  }
  for (const a of AFFERENT) vessel(ctx, a, 6.5);
  vessel(ctx, EFFERENT, 8);

  const outline = pathOf(nodeOutline(), true);
  // the body of the node: the cortex a soft lilac-blue, lit from within
  const body = ctx.createRadialGradient(-20, 0, 10, -10, 0, 105);
  body.addColorStop(0, '#2c2266');
  body.addColorStop(0.6, '#372b80');
  body.addColorStop(1, '#4b3f9e');
  ctx.fillStyle = body;
  ctx.fill(outline);
  ctx.save();
  ctx.clip(outline);
  // the T-cell zone: a warm dusk between the follicles and the medulla, dense with small cells
  const tz = pathOf(nodeOutline(96, 31), true);
  ctx.strokeStyle = 'rgba(255,196,160,.1)';
  ctx.lineWidth = 28;
  ctx.stroke(tz);
  const inMedulla = (x: number, y: number) => ((x - 24) / 40) ** 2 + (y / 36) ** 2 < 1;
  for (let i = 0; i < 1900; i++) {
    const t = hash(i * 1.37) * TAU, d = 0.42 + 0.46 * hash(i * 2.91);
    const x = 90 * d * Math.cos(t), y = 58 * d * Math.sin(t);
    if (x > 40 || inMedulla(x, y)) continue;
    ctx.beginPath();
    ctx.arc(x, y, 0.55 + 0.25 * hash(i), 0, TAU);
    ctx.fillStyle = i % 5 ? 'rgba(190,206,255,.32)' : 'rgba(255,226,200,.3)';
    ctx.fill();
  }
  // high endothelial venules: where lymphocytes come in from the blood
  for (let i = 0; i < 6; i++) {
    const t = 1.6 + i * 0.62, x = 56 * Math.cos(t), y = 36 * Math.sin(t);
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, TAU);
    ctx.strokeStyle = 'rgba(255,150,170,.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, TAU);
    ctx.fillStyle = 'rgba(120,20,50,.8)';
    ctx.fill();
  }
  // the medulla: deeper, its cords converging on the hilum, sinuses of lymph between them
  const mg = ctx.createRadialGradient(30, 0, 4, 22, 0, 46);
  mg.addColorStop(0, 'rgba(26,18,62,.75)');
  mg.addColorStop(1, 'rgba(26,18,62,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(-30, -50, 90, 100);
  const cords = medullaCords();
  // the cords join one another here and there (they branch and anastomose)
  for (let i = 0; i < cords.length - 1; i++) {
    for (const k of [0.3 + 0.1 * hash(i), 0.55 + 0.1 * hash(i + 7)]) {
      const a = cords[i][Math.floor(k * (cords[i].length - 1))], b = cords[i + 1][Math.floor((k + 0.06) * (cords[i + 1].length - 1))];
      ctx.strokeStyle = 'rgba(200,160,240,.2)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo((a[0] + b[0]) / 2 + 2, (a[1] + b[1]) / 2, b[0], b[1]);
      ctx.stroke();
    }
  }
  cords.forEach((cord, i) => {
    const p = pathOf(cord);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(200,160,240,.26)';
    ctx.lineWidth = 2.6 + 1.8 * hash(i * 3.7);
    ctx.stroke(p);
    ctx.strokeStyle = 'rgba(236,214,255,.22)';
    ctx.lineWidth = 0.4;
    ctx.stroke(p);
  });
  for (let i = 0; i < cords.length - 1; i++) {
    const mid = cords[i].map((p, j) => [(p[0] + cords[i + 1][j][0]) / 2, (p[1] + cords[i + 1][j][1]) / 2] as Pt);
    ctx.strokeStyle = rgba(LYMPH_C, 0.28);
    ctx.lineWidth = 1;
    ctx.stroke(pathOf(mid));
  }
  // the follicles: B cells round a paler germinal centre
  for (const f of FOLLICLES) {
    const [x, y] = f.at;
    const fg = ctx.createRadialGradient(x, y, 0, x, y, f.r);
    fg.addColorStop(0, f.gc ? 'rgba(220,226,255,.55)' : 'rgba(150,160,255,.45)');
    fg.addColorStop(0.55, 'rgba(120,126,236,.42)');
    fg.addColorStop(1, 'rgba(100,100,220,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x, y, f.r, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 60; i++) {
      const a = hash(i * 3.7 + x) * TAU, d = f.r * Math.sqrt(hash(i * 5.3 + y)) * 0.92;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.5, 0, TAU);
      ctx.fillStyle = 'rgba(220,226,255,.35)';
      ctx.fill();
    }
  }
  // trabeculae from the capsule inward
  ctx.strokeStyle = 'rgba(236,226,255,.18)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 8; i++) {
    const t = 0.9 + i * 0.6, x = 90 * Math.cos(t), y = 59 * Math.sin(t);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x * 0.62, y * 0.62);
    ctx.stroke();
  }
  ctx.restore();
  // the sinus under the capsule: a band where lymph spreads
  const sinus = pathOf(nodeOutline(96, 3.5), true);
  ctx.strokeStyle = rgba(LYMPH_C, 0.3);
  ctx.lineWidth = 3.4;
  ctx.stroke(sinus);
  // the capsule
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(230,214,255,.1)';
  ctx.lineWidth = 6;
  ctx.stroke(outline);
  ctx.globalCompositeOperation = op;
  ctx.strokeStyle = 'rgba(240,232,255,.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke(outline);
}

// ── what lives ───────────────────────────────────────────────────
const SINUS = nodeOutline(96, 3.5);
function flow(ctx: CanvasRenderingContext2D, t: number): void {
  for (const a of AFFERENT) {
    for (let i = 0; i < 6; i++) {
      const [x, y] = along(a, (i / 6 + t * 0.03) % 1);
      glow(ctx, LYMPH_C, x, y, 2, 0.4);
    }
  }
  for (let i = 0; i < 16; i++) {
    const k = (i / 16 + t * 0.006) % 1;
    const p = SINUS[Math.floor(k * SINUS.length) % SINUS.length];
    glow(ctx, LYMPH_C, p[0], p[1], 1.5, 0.3);
  }
  for (let i = 0; i < 6; i++) {
    const [x, y] = along(EFFERENT, (i / 6 + t * 0.035) % 1);
    glow(ctx, LYMPH_C, x, y, 2.2, 0.4);
  }
}

const ARMS = [0.2, 1.1, 1.9, 2.8, 3.7, 4.5, 5.4].map((a, i) => ({ a, len: 9 + 4 * hash(i * 3.3) }));
const MATCH_FROM: Pt = [MEET[0] - 24, MEET[1] + 15];
const MATCH_AT: Pt = [MEET[0] + 7.2, MEET[1] + 3.4];

/** The wandering T cells round the dendritic cell (bounded, smooth, never still). */
function wanderers(t: number): { x: number; y: number; near: number }[] {
  const out: { x: number; y: number; near: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const bx = MEET[0] + (hash(i * 3.3) - 0.5) * 74, by = MEET[1] + (hash(i * 5.9) - 0.5) * 50;
    const x = bx + 7 * Math.sin(t * (0.21 + 0.1 * hash(i)) + i), y = by + 6 * Math.cos(t * (0.17 + 0.1 * hash(i + 9)) + 2 * i);
    if (Math.hypot(x - MEET[0], y - MEET[1]) < 6) continue;
    // nearness to an arm's tip (a brief touch)
    let near = 0;
    for (const arm of ARMS) {
      const tx = MEET[0] + Math.cos(arm.a) * (3.4 + arm.len), ty = MEET[1] + Math.sin(arm.a) * (3.4 + arm.len);
      near = Math.max(near, clamp(1 - Math.hypot(x - tx, y - ty) / 4));
    }
    out.push({ x, y, near });
  }
  return out;
}

function drawMatch(ctx: CanvasRenderingContext2D, g: number, st: WorldState, scale = 1): void {
  const t = st.reduced ? 0 : st.time;
  const tSpr = lymphSprite('t', 0, 0.25);
  for (const w of wanderers(t)) {
    drawSprite(ctx, tSpr, w.x, w.y, 2.3 * scale, 0.85);
    if (w.near > 0.05) glow(ctx, AQUA, w.x, w.y, 4, 0.45 * w.near);
  }
  dendritic(ctx, MEET[0], MEET[1], 3.4, ARMS, { reach: 1, mature: 0.35, carry: 1, time: t, glow: st.growing ? st.light : 0.3 });
  const come = ease.inOutSine(clamp((g - 0.05) / 0.35));
  const [mx, my] = [MATCH_FROM[0] + (MATCH_AT[0] - MATCH_FROM[0]) * come, MATCH_FROM[1] + (MATCH_AT[1] - MATCH_FROM[1]) * come];
  const s1 = clamp((g - 0.42) / 0.16), s2 = clamp((g - 0.62) / 0.16), wake = clamp((g - 0.8) / 0.2);
  // the two signals: the receptor meets the piece on MHC (violet-gold), then CD28 meets B7 (aqua)
  if (s1 > 0) {
    const cx = (mx + MEET[0]) / 2 + 0.8, cy = (my + MEET[1]) / 2 - 0.8;
    glow(ctx, FLAG, cx, cy, 3.4, 0.6 * s1);
    glow(ctx, GOLD, cx, cy, 1.8, 0.7 * s1);
  }
  if (s2 > 0) {
    const cx = (mx + MEET[0]) / 2 - 0.4, cy = (my + MEET[1]) / 2 + 1.6;
    glow(ctx, AQUA, cx, cy, 3.2, 0.6 * s2);
  }
  lymphocyte(ctx, mx, my, (2.4 + 0.9 * wake) * scale, { kind: 't', gold: 0.25 + 0.75 * Math.max(s1 * 0.6, wake), glow: 0.4 + 0.6 * wake, seed: 11 });
  if (wake > 0) glow(ctx, GOLD_HI, mx, my, 7 * wake, 0.25 * wake);
}

/** The clones' places: a sunflower spiral round CLONES (the i-th cell). */
function clonePt(i: number, spread = 2.15): Pt {
  const r = spread * 1.12 * Math.sqrt(i + 0.5), a = i * 2.39996;
  const jx = (hash(i * 3.71) - 0.5) * spread * 0.55, jy = (hash(i * 5.13) - 0.5) * spread * 0.55;
  return [CLONES[0] + Math.cos(a) * r + jx, CLONES[1] + Math.sin(a) * r * 0.9 + jy];
}
const MAX_DRAWN = 160;

/** Divisions so far (0..14) and the cells they make (2^k). */
export function cloneGen(g: number): { k: number; n: number } {
  const k = Math.min(14, Math.floor(14 * ease.inOutSine(g) + 1e-9));
  return { k, n: 2 ** k };
}

function drawClones(ctx: CanvasRenderingContext2D, g: number, st: WorldState, scale = 1): void {
  const t = st.reduced ? 0 : st.time;
  const e = 14 * ease.inOutSine(g);
  const exact = 2 ** e;
  const drawn = Math.min(MAX_DRAWN, exact);
  const gold = lymphSprite('t', 1, 0.5);
  // the halo of the clone grows with their number (log)
  glow(ctx, GOLD, CLONES[0], CLONES[1], (8 + 2.2 * e) * scale, 0.18 + 0.02 * e);
  for (let i = 0; i < Math.ceil(drawn); i++) {
    const [x, y] = clonePt(i, 2.15 * scale);
    const born = clamp(drawn - i);
    // newly divided: two daughters part from where the mother was
    const wob = 0.25 * Math.sin(t * 0.8 + i);
    drawSprite(ctx, gold, x + wob, y - wob, 2.1 * scale * (0.6 + 0.4 * born), born);
  }
  // past the drawn number, clones leave through the medulla towards the efferent vessel
  if (exact > MAX_DRAWN) {
    const leave = clamp(Math.log2(exact / MAX_DRAWN) / 5);
    for (let i = 0; i < 14; i++) {
      const k = (i / 14 + t * 0.05) % 1;
      const from = clonePt(MAX_DRAWN - 1 - i * 3, 2.15 * scale);
      const to = EFFERENT[1];
      const x = from[0] + (to[0] - from[0]) * k, y = from[1] + (to[1] - from[1]) * k + 4 * Math.sin(k * 6 + i);
      drawSprite(ctx, gold, x, y, 1.8 * scale, leave * Math.min(1, (1 - k) * 4, k * 6));
    }
  }
  if (st.growing && g < 1) {
    const [x, y] = clonePt(Math.max(0, Math.ceil(drawn) - 1), 2.15 * scale);
    glow(ctx, GOLD_HI, x, y, 4, 0.6);
  }
}

/** Survivors among the clones (about one in twenty, as in the measured contraction). */
const SURVIVES = (i: number) => i % 20 === 0;

function drawMemory(ctx: CanvasRenderingContext2D, g: number, st: WorldState): void {
  const t = st.reduced ? 0 : st.time;
  const gold = lymphSprite('t', 1, 0.5);
  const mem = lymphSprite('mem', 0.6, 0.5);
  glow(ctx, GOLD, CLONES[0], CLONES[1], 38 * (1 - 0.7 * g), 0.3 * (1 - 0.8 * g));
  for (let i = 0; i < MAX_DRAWN; i++) {
    const [x, y] = clonePt(i);
    if (SURVIVES(i)) {
      // memory cells drift a little apart and settle, a quiet ring of gold round each
      const k = ease.inOutSine(clamp((g - 0.3) / 0.6));
      const dx = (x - CLONES[0]) * 0.5 * k + 3 * Math.sin(t * 0.3 + i) * k, dy = (y - CLONES[1]) * 0.5 * k;
      drawSprite(ctx, k > 0.5 ? mem : gold, x + dx, y + dy, 2.3 + 0.4 * k, 1);
      continue;
    }
    const go = 0.1 + 0.75 * hash(i * 2.13 + 1);
    const k = clamp((g - go) / 0.12);
    if (k >= 1) continue;
    drawSprite(ctx, gold, x, y, 2.1 * (1 - 0.5 * k), 1 - k);
  }
}

/** The share of clones still there (100 % → about 5 %), for the corner's count. */
export function memoryLeft(g: number): number {
  let left = 0;
  for (let i = 0; i < MAX_DRAWN; i++) {
    if (SURVIVES(i)) left++;
    else if (g < 0.1 + 0.75 * hash(i * 2.13 + 1) + 0.12) left++;
  }
  return left / MAX_DRAWN;
}

function dcAlong(g: number): Pt {
  return along(DC_ROUTE, ease.inOutSine(g));
}

function drawRoute(ctx: CanvasRenderingContext2D, g: number, st: WorldState): void {
  const t = st.reduced ? 0 : st.time;
  const k = ease.inOutSine(g);
  if (k > 0.01) {
    ctx.save();
    ctx.setLineDash([1.6, 2.6]);
    ctx.strokeStyle = rgba(DC_C, 0.35);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    const n = Math.max(2, Math.ceil(k * (DC_ROUTE.length - 1)));
    for (let i = 0; i < n; i++) i ? ctx.lineTo(DC_ROUTE[i][0], DC_ROUTE[i][1]) : ctx.moveTo(DC_ROUTE[i][0], DC_ROUTE[i][1]);
    const p = along(DC_ROUTE, k);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    ctx.restore();
  }
  const [x, y] = dcAlong(g);
  dendritic(ctx, x, y, 3.2, ARMS.map(a => ({ a: a.a, len: a.len * 0.45 })), { reach: 0.6 + 0.4 * clamp((g - 0.85) / 0.15), mature: 0.8, carry: 1, time: t, glow: st.growing ? st.light : 0.3 });
  if (g > 0.85) glow(ctx, GOLD, MEET[0], MEET[1], 16, 0.2 * clamp((g - 0.85) / 0.15));
}

function draw(ctx: CanvasRenderingContext2D, st0: WorldState): void {
  const st = st0.reduced ? { ...st0, time: 0 } : st0;
  const t = st.time;
  flow(ctx, t);
  const { scene, g } = st;
  if (scene === 'droga') drawRoute(ctx, g, st);
  else if (scene === 'dopasowanie') drawMatch(ctx, g, st);
  else if (scene === 'klony') drawClones(ctx, g, st);
  else if (scene === 'pamiec') drawMemory(ctx, g, st);
  else if (scene === 'cala_wezel') {
    if (g < 0.4) drawRoute(ctx, g / 0.4, st);
    else if (g < 0.6) drawMatch(ctx, 0.4 + 0.6 * ((g - 0.4) / 0.2), st);
    else {
      dendritic(ctx, MEET[0], MEET[1], 3.4, ARMS, { reach: 1, mature: 0.35, carry: 1, time: t });
      drawClones(ctx, Math.min(1, (g - 0.6) / 0.4) * 0.62, st);
    }
  }
  if (st.deep > 0.02) glow(ctx, '#9fb0ff', MEET[0] + 10, MEET[1], 70, 0.08 * st.deep);
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'droga') return dcAlong(g);
  if (scene === 'dopasowanie') return [(MATCH_AT[0] + MEET[0]) / 2, (MATCH_AT[1] + MEET[1]) / 2];
  if (scene === 'klony' || scene === 'pamiec') return CLONES;
  if (scene === 'cala_wezel') return g < 0.4 ? dcAlong(g / 0.4) : MEET;
  return MEET;
}

export const NODE_MEET = MEET;
export function nodeWorld(counter: (scene: string, g: number) => string | null): WorldPainter {
  return { depth: 1, lens: true, bake: (ctx) => bake(ctx), draw, focusAt, counter };
}
