/**
 * The enamel's crystals (DESIGN.md §24.4): two worlds — the rods cut across in micrometres — keyholes about 5 µm wide in
 * rows, each the home of tens of thousands of crystals — and, deep inside one rod, in nanometres, the crystals
 * themselves end on: flattened hexagons about 68 × 26 nm, some of them nibbled by acid.  Through the lens.
 *
 *   pryzmaty  the rods light one by one from the middle outward, their sheaths drawn in gold
 *   wapn      calcium and phosphate settle into the crystals' nibbled edges and close them with light
 *   fluor     fluoride joins the crystals' surfaces: a bright rim, harder for acid to dissolve
 */
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { AQUA, GOLD, GOLD_HI, PEARL, TAU, glow, hash, rgba } from '../kit/healthlib/paint';
import { part } from './geo';
import { C, bakePx, lightLine, word } from './ink';

export const RODS_VIEW: Rect = { x: -22, y: -15, w: 44, h: 30 };
export const LATTICE_VIEW: Rect = { x: -210, y: -140, w: 420, h: 280 };

// ── the rods ─────────────────────────────────────────────────────
interface Rod { x: number; y: number; d: number; k: number }
const RODS: Rod[] = [];
for (let r = -6; r <= 6; r++) for (let i = -8; i <= 8; i++) {
  const x = i * 5.4 + (r & 1 ? 2.7 : 0) + (hash(r * 31 + i) - 0.5) * 0.5, y = r * 5.0 + (hash(r * 7 + i * 3) - 0.5) * 0.4;
  RODS.push({ x, y, d: Math.hypot(x, y * 1.2), k: hash(r * 17 + i * 5 + 1) });
}
const MAXD = Math.hypot(22, 15 * 1.2);

function keyhole(x: number, y: number): Path2D {
  // a round head (≈ 5 µm) whose tail widens down between the heads of the next row: rods tile like scales
  const p = new Path2D();
  p.moveTo(x - 2.45, y);
  p.arc(x, y, 2.45, Math.PI, 0);
  p.bezierCurveTo(x + 2.45, y + 1.8, x + 2.0, y + 3.4, x + 2.55, y + 4.85);
  p.lineTo(x - 2.55, y + 4.85);
  p.bezierCurveTo(x - 2.0, y + 3.4, x - 2.45, y + 1.8, x - 2.45, y);
  p.closePath();
  return p;
}
const sheath = (x: number, y: number): Path2D => {
  const p = new Path2D();
  p.arc(x, y, 2.55, Math.PI * 0.92, Math.PI * 2.08);
  return p;
};

function bakeRods(ctx: CanvasRenderingContext2D, px: number): void {
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 40);
  g.addColorStop(0, '#2a3552');
  g.addColorStop(1, '#151a30');
  ctx.fillStyle = g;
  ctx.fillRect(-60, -40, 120, 80);
  for (const r of RODS) {
    const p = keyhole(r.x, r.y);
    const rg = ctx.createLinearGradient(r.x, r.y - 2.5, r.x, r.y + 4.9);
    rg.addColorStop(0, 'rgba(232,242,255,.7)');
    rg.addColorStop(0.45, 'rgba(184,204,234,.52)');
    rg.addColorStop(1, 'rgba(110,128,186,.3)');
    ctx.fillStyle = rg;
    ctx.fill(p);
    // crystals: end-on dots in the head, slanting strokes in the tail
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    for (let i = 0; i < 26; i++) {
      const a = hash(i * 3 + r.k * 100) * TAU, rr = Math.sqrt(hash(i * 7 + r.k * 50)) * 2.1;
      ctx.fillRect(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr * 0.9, 0.16, 0.16);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.lineWidth = 0.6 / px;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const yy = r.y + 1.6 + i * 0.6;
      ctx.moveTo(r.x - 1.2 + i * 0.2, yy);
      ctx.lineTo(r.x + 0.2 + i * 0.2, yy + 0.7);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,46,90,.75)';
    ctx.lineWidth = 1.1 / px;
    ctx.stroke(sheath(r.x, r.y));
  }
}

// ── the crystals inside one rod ──────────────────────────────────
const CW = 68, CT = 26;
interface Crystal { x: number; y: number; rot: number; nick: number; side: -1 | 1; k: number }
const CRYSTALS: Crystal[] = [];
for (let r = -9; r <= 9; r++) for (let i = -6; i <= 6; i++) {
  const x = i * 76 + (r & 1 ? 38 : 0) + (hash(r * 13 + i) - 0.5) * 8;
  const y = r * 31 + (hash(r * 5 + i * 11) - 0.5) * 4;
  const h = hash(r * 29 + i * 7 + 3);
  CRYSTALS.push({ x, y, rot: (hash(r + i * 3) - 0.5) * 0.12, nick: h < 0.42 ? 0.25 + 0.3 * hash(h * 99) : 0, side: hash(h * 7) < 0.5 ? -1 : 1, k: hash(r * 3 + i * 17 + 5) });
}

function hexPath(c: Crystal, grow = 0): Path2D {
  const w = CW + grow, t = CT + grow, e = t * 0.32;
  const p = new Path2D();
  const pts: Pt[] = [[-w / 2, 0], [-w / 2 + e, -t / 2], [w / 2 - e, -t / 2], [w / 2, 0], [w / 2 - e, t / 2], [-w / 2 + e, t / 2]];
  const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
  pts.forEach(([x, y], i) => {
    const X = c.x + x * cs - y * sn, Y = c.y + x * sn + y * cs;
    if (i) p.lineTo(X, Y); else p.moveTo(X, Y);
  });
  p.closePath();
  return p;
}
/** The nibbled end of a crystal: a wedge at one end, `c.nick` of its length. */
function nickPath(c: Crystal): Path2D {
  const w = CW, t = CT, L = w * c.nick, s = c.side;
  const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
  const pts: Pt[] = [[s * (w / 2 + 2), -t / 2 - 2], [s * (w / 2 - L), -t / 2 - 2], [s * (w / 2 - L * 0.55), 4], [s * (w / 2 - L), t / 2 + 2], [s * (w / 2 + 2), t / 2 + 2]];
  const p = new Path2D();
  pts.forEach(([x, y], i) => {
    const X = c.x + x * cs - y * sn, Y = c.y + x * sn + y * cs;
    if (i) p.lineTo(X, Y); else p.moveTo(X, Y);
  });
  p.closePath();
  return p;
}
const GAP = '#141a36';

function bakeLattice(ctx: CanvasRenderingContext2D, px: number, nicked: boolean): void {
  const bg = ctx.createRadialGradient(0, 0, 20, 0, 0, 320);
  bg.addColorStop(0, '#1d2a4a');
  bg.addColorStop(1, GAP);
  ctx.fillStyle = bg;
  ctx.fillRect(-400, -300, 800, 600);
  // the organic matrix between the crystals: faint threads
  ctx.strokeStyle = 'rgba(160,150,220,.14)';
  ctx.lineWidth = 0.8 / px;
  for (let i = 0; i < 60; i++) {
    const y = -300 + hash(i * 3) * 600;
    ctx.beginPath();
    ctx.moveTo(-400, y);
    ctx.bezierCurveTo(-100, y + 10, 100, y - 10, 400, y + 5);
    ctx.stroke();
  }
  for (const c of CRYSTALS) {
    const p = hexPath(c);
    const g = ctx.createLinearGradient(c.x, c.y - CT / 2, c.x, c.y + CT / 2);
    g.addColorStop(0, 'rgba(246,251,255,.92)');
    g.addColorStop(0.5, 'rgba(208,224,244,.85)');
    g.addColorStop(1, 'rgba(150,170,214,.8)');
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 0.9 / px;
    ctx.stroke(p);
    // the lattice inside: faint parallel lines along the crystal
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = 'rgba(150,170,215,.25)';
    ctx.lineWidth = 0.6 / px;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(c.x - CW / 2, c.y + k * 5);
      ctx.lineTo(c.x + CW / 2, c.y + k * 5 + c.rot * CW);
    }
    ctx.stroke();
    ctx.restore();
    if (nicked && c.nick > 0) {
      ctx.fillStyle = GAP;
      ctx.fill(nickPath(c));
      ctx.strokeStyle = 'rgba(255,160,120,.55)';
      ctx.lineWidth = 1.2 / px;
      ctx.stroke(nickPath(c));
    }
  }
}



// ── what grows ───────────────────────────────────────────────────
function drawRods(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  const lit = new Path2D();
  for (const r of RODS) {
    const at = r.d / MAXD;
    const k = part(g * 1.15, at * 0.9, at * 0.9 + 0.15);
    if (k <= 0) continue;
    glow(ctx, PEARL, r.x, r.y + 0.6, 3.4, 0.35 * k + 0.08 * st.deep);
    lit.addPath(sheath(r.x, r.y));
    if (k < 1 && st.growing) glow(ctx, GOLD_HI, r.x, r.y - 2.4, 1.6, 0.6 * (1 - k));
  }
  lightLine(ctx, lit, px, GOLD, GOLD_HI, 1.3, 0.8);
  if (st.after > 0 && !st.reduced) {
    const sx = ((st.time * 6) % 60) - 30;
    glow(ctx, PEARL, sx, 0, 10, 0.12);
  }
}

function drawLattice(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  const fluor = st.scene === 'fluor';
  const order = (c: Crystal) => ((c.x + 250) / 500) * 0.6 + c.k * 0.35;
  if (!fluor) {
    // calcium and phosphate drift in and settle into the nicks, which close with light
    for (const c of CRYSTALS) {
      if (!c.nick) continue;
      const at = order(c);
      const k = part(g, at * 0.85, at * 0.85 + 0.18);
      const L = CW * c.nick;
      const tip: Pt = [c.x + c.side * (CW / 2 - L * 0.4), c.y];
      if (k > 0) {
        ctx.save();
        ctx.globalAlpha = k;
        ctx.fillStyle = '#fff3d6';
        ctx.fill(nickPath(c));
        ctx.restore();
        lightLine(ctx, nickPath(c), px, GOLD, GOLD_HI, 1, 0.6 * k);
        glow(ctx, GOLD, tip[0], tip[1], 30, 0.55 * (k < 1 ? 1 : 0.4) + 0.1 * st.deep);
      }
      if (k < 1) {
        // two ions on their way, from above
        for (let j = 0; j < 2; j++) {
          const u = Math.min(1, Math.max(0, (g - (at * 0.85 - 0.22)) / 0.24));
          const from: Pt = [tip[0] + (j ? 40 : -30), tip[1] - 120 - 40 * c.k];
          const x = from[0] + (tip[0] - from[0]) * u, y = from[1] + (tip[1] - from[1]) * u;
          const col = j ? C.phosphate : C.calcium;
          glow(ctx, col, x, y, 14, 0.6 * (0.3 + 0.7 * u));
          ctx.fillStyle = rgba(col, 0.95);
          ctx.beginPath();
          ctx.arc(x, y, Math.max(2.5, 2 / px), 0, TAU);
          ctx.fill();
        }
      }
    }
    // free ions wandering in the fluid between
    for (let i = 0; i < 26; i++) {
      const t = st.reduced ? 0 : st.time;
      const x = -250 + ((hash(i * 7) * 500 + t * 6 * (0.5 + hash(i))) % 500), y = -160 + hash(i * 3 + 1) * 320 + 4 * Math.sin(t + i);
      const col = i % 2 ? C.phosphate : C.calcium;
      ctx.fillStyle = rgba(col, 0.5);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, 1.5 / px), 0, TAU);
      ctx.fill();
    }
  } else {
    // fluoride joins the surfaces: a bright rim grows round each crystal in turn
    const rims = new Path2D();
    for (const c of CRYSTALS) {
      const k = part(g, order(c) * 0.85, order(c) * 0.85 + 0.14);
      if (k <= 0) continue;
      rims.addPath(hexPath(c, 3 * k));
    }
    lightLine(ctx, rims, px, AQUA, C.fluoride, 1.4, 0.85 + 0.15 * st.deep);
    for (let i = 0; i < 30; i++) {
      const t = st.reduced ? 0 : st.time;
      const x = -250 + ((hash(i * 5 + 2) * 500 + t * 5 * (0.5 + hash(i + 3))) % 500), y = -160 + hash(i * 11 + 1) * 320;
      glow(ctx, C.fluoride, x, y, 10, 0.4 * (0.3 + 0.7 * g));
      ctx.fillStyle = rgba(C.fluoride, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, 1.6 / px), 0, TAU);
      ctx.fill();
    }
  }
}

function focusRods(_scene: string, g: number): Pt {
  const a = g * 5.2;
  return [Math.cos(a) * g * 14, Math.sin(a) * g * 9];
}
function focusLattice(_scene: string, g: number): Pt {
  return [-150 + 300 * Math.min(1, g), 10 * Math.sin(g * 9)];
}

/** The rods cut across (µm). */
export const RODS_WORLD: WorldPainter = {
  depth: 3,
  lens: true,
  bake: ctx => bakeRods(ctx, bakePx(ctx)),
  draw: drawRods,
  focusAt: focusRods,
  counter: (_s, g) => (g < 0.2 ? null : word('cnt.rod')),
};
/** The crystals inside one rod (nm): nibbled for wapn, whole (and gaining a rim) for fluor. */
export const LATTICE: WorldPainter = {
  depth: 4,
  lens: true,
  bake: (ctx, variant) => bakeLattice(ctx, bakePx(ctx), variant !== 'fluor'),
  draw: drawLattice,
  focusAt: focusLattice,
  counter: (_s, g) => (g < 0.2 ? null : word('cnt.crystal')),
};

const nicked = CRYSTALS.find(c => c.nick > 0 && Math.abs(c.x) < 60 && Math.abs(c.y) < 40) ?? CRYSTALS[0];
export const crystalPt = {
  rod: [RODS.find(r => Math.abs(r.x) < 2 && Math.abs(r.y) < 1)?.x ?? 0, -1] as Pt,
  interrod: [2.7, 4.2] as Pt,
  crystal: (() => { const c = CRYSTALS.reduce((a, b) => (Math.hypot(b.x - 70, b.y + 50) < Math.hypot(a.x - 70, a.y + 50) ? b : a)); return [c.x, c.y] as Pt; })(),
  nick: [nicked.x + nicked.side * 20, nicked.y] as Pt,
  free: [120, -90] as Pt,
};
