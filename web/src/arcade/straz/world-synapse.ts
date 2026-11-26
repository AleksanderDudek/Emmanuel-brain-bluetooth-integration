/**
 * The synapse close up (DESIGN.md §24): a cytotoxic T cell (left) and the cell it has recognised (right), their faces
 * pressed together.  Seen through the lens; both cells are drawn live:
 *
 *   synapsa         the receptors gather in the middle, a ring of adhesion seals the contact, the centrosome comes to
 *                   the face and brings the granules; perforin opens pores, granzymes pass, the cell folds itself away
 *                   (blebs, a condensed nucleus, "eat me" signs) and the T cell lets go, ready for the next
 *   hamulec         PD-1 on the T cell meets PD-L1 on the other: the brake — the granules draw back
 *   lek             antibodies (the medicine) hold PD-1, the pairs part, the granules come to the face again
 *   cala_trafienie  the whole synapse in one
 */
import { clamp, ease } from '../kit/juice';
import { AQUA, GOLD, GOLD_HI, TAU, glow, hash, mix, rgba } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { SYN, type Pt } from './geo';
import { CHANGED_BODY, CHANGED_RIM, EATME, FLAG, T_C, antibody } from './cells';

const X0 = -300, X1 = 300, Y0 = -240, Y1 = 240;
const PD1 = '#6fe6d2';
const PDL1 = '#ff8fb4';

// ── the still ground ─────────────────────────────────────────────
function bake(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 260);
  g.addColorStop(0, '#1e1640');
  g.addColorStop(1, '#0e0920');
  ctx.fillStyle = g;
  ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  // out of focus: other cells of the tissue, far behind
  for (let i = 0; i < 26; i++) {
    const x = X0 + hash(i * 3.3 + 1) * (X1 - X0), y = Y0 + hash(i * 5.1 + 2) * (Y1 - Y0);
    if (Math.abs(x) < 70 && Math.abs(y) < 45) continue;
    const r = 18 + 22 * hash(i * 7.7);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(120,110,230,.16)');
    rg.addColorStop(0.8, 'rgba(90,80,200,.1)');
    rg.addColorStop(1, 'rgba(90,80,200,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 120; i++) {
    const x = X0 + hash(i * 2.9 + 11) * (X1 - X0), y = Y0 + hash(i * 6.1 + 12) * (Y1 - Y0);
    const l = 10 + 18 * hash(i), a = hash(i * 1.7) * TAU;
    ctx.strokeStyle = 'rgba(180,170,255,.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

// ── the two cells ────────────────────────────────────────────────
/** A round cell flattened on one side (its face at the synapse), with optional blebs. */
function cellPath(c: Pt, r: number, face: number, side: 1 | -1, flat: number, blebs: number, time: number, seed: number): Path2D {
  const p = new Path2D();
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    let rr = r * (1 + 0.025 * Math.sin(a * 3 + seed) + 0.015 * Math.sin(a * 5 + seed * 2));
    if (blebs > 0) {
      // round blebs: a few soft bulges that rise and settle
      for (let b = 0; b < 8; b++) {
        const c = (b / 8) * TAU + 0.35 + 0.05 * Math.sin(time * 0.3 + b);
        const d = Math.atan2(Math.sin(a - c), Math.cos(a - c));
        rr += r * 0.075 * blebs * (0.7 + 0.3 * Math.sin(time * 0.9 + b * 1.7)) * Math.exp(-((d / 0.13) ** 2));
      }
    }
    let x = c[0] + Math.cos(a) * rr;
    const y = c[1] + Math.sin(a) * rr;
    if (side > 0 && x > face) x = face + (x - face) * (1 - flat);
    if (side < 0 && x < face) x = face + (x - face) * (1 - flat);
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

interface SynState {
  /** the T cell's pull back from the face (0 pressed … 1 let go) */
  release: number;
  /** receptors gathered in the middle (0 scattered … 1 in a cluster) */
  gather: number;
  ring: number;
  /** the centrosome's way to the face, the granules' (0 at rest … 1 at the face), their release (0..1) */
  mtoc: number;
  granules: number;
  fire: number;
  pores: number;
  granzymes: number;
  /** the other cell folding itself away (0..1) */
  fold: number;
  brake: number;
  drugs: number;
  drugsBind: number;
  /** warmth of the T cell (0 cool … 1 gold) */
  warm: number;
}

function stateFor(scene: string, g: number): SynState {
  const s: SynState = { release: 0, gather: 1, ring: 1, mtoc: 0, granules: 0, fire: 0, pores: 0, granzymes: 0, fold: 0, brake: 0, drugs: 0, drugsBind: 0, warm: 0.3 };
  if (scene === 'synapsa' || scene === 'cala_trafienie') {
    s.gather = ease.outCubic(clamp(g / 0.25));
    s.ring = clamp((g - 0.06) / 0.22);
    s.mtoc = ease.inOutSine(clamp((g - 0.18) / 0.3));
    s.granules = ease.inOutSine(clamp((g - 0.28) / 0.3));
    s.fire = clamp((g - 0.58) / 0.14);
    s.pores = clamp((g - 0.6) / 0.08) * (1 - clamp((g - 0.8) / 0.1));
    s.granzymes = clamp((g - 0.62) / 0.26);
    s.fold = clamp((g - 0.76) / 0.24);
    s.release = clamp((g - 0.9) / 0.1);
    s.warm = 0.3 + 0.7 * clamp((g - 0.2) / 0.5);
  } else if (scene === 'hamulec') {
    s.brake = ease.inOutSine(clamp(g / 0.65));
    s.mtoc = 0.5 * (1 - s.brake);
    s.granules = 0.45 * (1 - s.brake);
    s.gather = 1;
    s.ring = 1 - 0.4 * s.brake;
    s.warm = 0.5 - 0.4 * s.brake;
  } else if (scene === 'lek') {
    s.drugs = ease.inOutSine(clamp(g / 0.45));
    s.drugsBind = clamp((g - 0.38) / 0.2);
    s.brake = 1 - s.drugsBind;
    const back = ease.inOutSine(clamp((g - 0.55) / 0.35));
    s.mtoc = back;
    s.granules = back;
    s.ring = 0.6 + 0.4 * back;
    s.warm = 0.1 + 0.9 * back;
  }
  return s;
}

const T = SYN.t, K = SYN.k;
const MTOC_REST: Pt = [T.at[0] - 14, T.at[1] + 9];
const MTOC_FACE: Pt = [T.face - 3.2, 0.5];
const NUC_T: Pt = [T.at[0] - 7, T.at[1] - 3];

function granuleRest(i: number): Pt {
  const a = 0.9 + (i / 9) * 4.4 + hash(i) * 0.3, d = T.r * (0.55 + 0.25 * hash(i * 3.1));
  return [T.at[0] + 4 + Math.cos(a) * d * 0.9, T.at[1] + Math.sin(a) * d];
}
function granuleFace(i: number): Pt {
  return [T.face - 2.2 - 1.6 * hash(i * 5.5), (i - 4) * 1.15];
}

function drawCells(ctx: CanvasRenderingContext2D, s: SynState, st: WorldState): void {
  const time = st.reduced ? 0 : st.time;
  const shift = -5 * ease.inOutSine(s.release);
  const tAt: Pt = [T.at[0] + shift, T.at[1]];
  // ── the other cell (drawn first; the T cell's face lies over its own)
  const kPath = cellPath(K.at, K.r * (1 - 0.1 * s.fold), K.face, -1, 1 - 0.5 * s.release, s.fold, time, 2);
  const dim = 1 - 0.25 * s.fold;
  const kg = ctx.createRadialGradient(K.at[0] - 8, K.at[1] - 10, 4, K.at[0], K.at[1], K.r * 1.1);
  kg.addColorStop(0, rgba(mix('#d9bccb', CHANGED_BODY, 0.3), 0.97 * dim));
  kg.addColorStop(0.7, rgba(CHANGED_BODY, 0.96 * dim));
  kg.addColorStop(1, rgba(mix(CHANGED_BODY, '#5a3a5a', 0.3), 0.96));
  glow(ctx, FLAG, K.at[0], K.at[1], K.r * 1.7, 0.12 + 0.1 * (1 - s.fold));
  ctx.fillStyle = kg;
  ctx.fill(kPath);
  glow(ctx, '#ffd6e6', K.at[0] - 6, K.at[1] - 8, K.r * 0.9, 0.12 * dim);
  ctx.strokeStyle = rgba(CHANGED_RIM, 0.75);
  ctx.lineWidth = 0.7;
  ctx.stroke(kPath);
  // its organelles and nucleus (condensing as it folds itself away)
  for (let i = 0; i < 14; i++) {
    const a = hash(i * 2.7) * TAU, d = K.r * (0.45 + 0.4 * hash(i * 4.1));
    ctx.beginPath();
    ctx.ellipse(K.at[0] + Math.cos(a) * d, K.at[1] + Math.sin(a) * d, 2 + 1.5 * hash(i), 0.9, a, 0, TAU);
    ctx.fillStyle = 'rgba(230,200,220,.18)';
    ctx.fill();
  }
  const nr = 13 * (1 - 0.35 * s.fold);
  const nx = K.at[0] + 5, ny = K.at[1] - 1;
  const ng = ctx.createRadialGradient(nx - 3, ny - 3, 1, nx, ny, nr);
  ng.addColorStop(0, s.fold > 0.3 ? 'rgba(170,120,170,.95)' : 'rgba(150,110,160,.92)');
  ng.addColorStop(1, 'rgba(96,62,104,.92)');
  ctx.beginPath();
  ctx.ellipse(nx, ny, nr * 1.05, nr * 0.92, 0.3, 0, TAU);
  ctx.fillStyle = ng;
  ctx.fill();
  if (s.fold > 0.4) {
    // the nucleus comes apart into small dense pieces
    const f = clamp((s.fold - 0.4) / 0.6);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3, d = nr * 0.6 * f;
      ctx.beginPath();
      ctx.arc(nx + Math.cos(a) * d, ny + Math.sin(a) * d, 2.6 * (1 - 0.3 * f), 0, TAU);
      ctx.fillStyle = 'rgba(120,70,120,.85)';
      ctx.fill();
    }
  }
  // the flags it shows on MHC: the neoantigen the T cell recognised (on its face and round it)
  for (let i = 0; i < 12; i++) {
    const a = Math.PI - 0.9 + (i / 11) * 1.8;
    const x = Math.max(K.face, K.at[0] + Math.cos(a) * K.r), y = K.at[1] + Math.sin(a) * K.r;
    if (Math.abs(y) < SYN.half - 1) continue;
    ctx.strokeStyle = rgba(FLAG, 0.75);
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2.2 * Math.cos(a - Math.PI), y - 2.2 * Math.sin(a - Math.PI));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 2.6 * Math.cos(a - Math.PI), y - 2.6 * Math.sin(a - Math.PI), 0.8, 0, TAU);
    ctx.fillStyle = rgba(mix(FLAG, '#ffffff', 0.25), 0.95);
    ctx.fill();
  }
  // blebs' "eat me" signs as it folds away
  if (s.fold > 0.6) {
    const e = clamp((s.fold - 0.6) / 0.4);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.2;
      if (Math.cos(a) < -0.3) continue;
      const x = K.at[0] + Math.cos(a) * K.r * 0.95, y = K.at[1] + Math.sin(a) * K.r * 0.95;
      ctx.beginPath();
      ctx.arc(x, y, 0.7, 0, TAU);
      ctx.fillStyle = rgba(EATME, e);
      ctx.fill();
      glow(ctx, EATME, x, y, 2.6, 0.3 * e);
    }
  }

  // ── the T cell
  const warm = s.warm;
  const tPath = cellPath(tAt, T.r, T.face + shift, 1, 1 - s.release * 0.8, 0, time, 5);
  glow(ctx, warm > 0.5 ? GOLD : AQUA, tAt[0], tAt[1], T.r * 1.6, 0.12 + 0.18 * warm);
  const tg = ctx.createRadialGradient(tAt[0] - 8, tAt[1] - 10, 3, tAt[0], tAt[1], T.r * 1.1);
  tg.addColorStop(0, 'rgba(240,246,255,.97)');
  tg.addColorStop(0.7, rgba(mix(T_C, '#c8d6ff', 0.4), 0.95));
  tg.addColorStop(1, rgba(mix(T_C, '#5a5ab4', 0.35), 0.95));
  ctx.fillStyle = tg;
  ctx.fill(tPath);
  glow(ctx, '#ffffff', tAt[0] - 4, tAt[1] - 8, T.r * 0.9, 0.14);
  ctx.strokeStyle = rgba(mix('#e6eeff', GOLD, warm * 0.6), 0.85);
  ctx.lineWidth = 0.8;
  ctx.stroke(tPath);
  // the nucleus (a lymphocyte is mostly nucleus), the centrosome and its microtubules
  const ntx = NUC_T[0] + shift;
  ctx.beginPath();
  ctx.ellipse(ntx, NUC_T[1], 13.5, 15, -0.2, 0, TAU);
  const nt = ctx.createRadialGradient(ntx - 4, NUC_T[1] - 5, 1, ntx, NUC_T[1], 15);
  nt.addColorStop(0, 'rgba(150,140,236,.95)');
  nt.addColorStop(1, 'rgba(76,66,176,.95)');
  ctx.fillStyle = nt;
  ctx.fill();
  const mt: Pt = [MTOC_REST[0] + (MTOC_FACE[0] - MTOC_REST[0]) * s.mtoc + shift, MTOC_REST[1] + (MTOC_FACE[1] - MTOC_REST[1]) * s.mtoc];
  ctx.strokeStyle = rgba(AQUA, 0.22 + 0.15 * s.mtoc);
  ctx.lineWidth = 0.35;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.2;
    const L = T.r * (0.6 + 0.35 * hash(i * 2.2));
    ctx.beginPath();
    ctx.moveTo(mt[0], mt[1]);
    ctx.quadraticCurveTo(mt[0] + Math.cos(a + 0.2) * L * 0.5, mt[1] + Math.sin(a + 0.2) * L * 0.5, mt[0] + Math.cos(a) * L, mt[1] + Math.sin(a) * L);
    ctx.stroke();
  }
  glow(ctx, AQUA, mt[0], mt[1], 4, 0.5);
  for (const [dx, dy, r] of [[-0.9, 0, 0.9], [0.9, 0.6, 0.9]] as const) {
    ctx.beginPath();
    ctx.ellipse(mt[0] + dx, mt[1] + dy, r * 1.4, r * 0.7, dx, 0, TAU);
    ctx.fillStyle = 'rgba(210,250,255,.95)';
    ctx.fill();
  }
  // the granules: gold, gathering at the face along the microtubules; at firing they open into the cleft
  for (let i = 0; i < 9; i++) {
    const a = granuleRest(i), b = granuleFace(i);
    const k = clamp(s.granules * 1.15 - i * 0.02);
    const x = a[0] + (b[0] - a[0]) * k + shift, y = a[1] + (b[1] - a[1]) * k;
    const fired = clamp(s.fire * 1.4 - (i % 3) * 0.15);
    const r = 1.55 * (1 - 0.6 * fired);
    if (fired >= 0.99) continue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = rgba(GOLD, 0.95 * (1 - fired));
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 0.35, y - 0.35, r * 0.45, 0, TAU);
    ctx.fillStyle = rgba(GOLD_HI, 1 - fired);
    ctx.fill();
    glow(ctx, GOLD, x, y, 3, 0.3 * (1 - fired) * (0.4 + 0.6 * k));
  }

  // ── the synapse itself: receptors in the middle, the ring of adhesion round them
  const fx0 = T.face + shift, fx1 = K.face;
  for (let i = 0; i < 9; i++) {
    const y0 = (hash(i * 3.3) - 0.5) * 2 * (SYN.half - 1);
    const y = y0 + ((i - 4) * 0.9 - y0) * s.gather;
    const a = (0.55 + 0.45 * s.gather) * (1 - 0.5 * s.brake) * (1 - s.release);
    ctx.strokeStyle = rgba(AQUA, 0.8 * a);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(fx0 - 0.3, y);
    ctx.lineTo((fx0 + fx1) / 2, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc((fx0 + fx1) / 2 + 0.25, y, 0.45, 0, TAU);
    ctx.fillStyle = rgba(FLAG, a);
    ctx.fill();
  }
  if (s.gather > 0.5) glow(ctx, FLAG, (fx0 + fx1) / 2, 0, 5, 0.25 * s.gather * (1 - s.brake) * (1 - s.release));
  for (const sgn of [-1, 1]) {
    const yy = sgn * (SYN.half - 2.6);
    const a = s.ring * (1 - s.release);
    if (a <= 0.01) continue;
    glow(ctx, AQUA, (fx0 + fx1) / 2, yy, 3.6, 0.45 * a);
    ctx.strokeStyle = rgba('#dffcff', 0.8 * a);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo((fx0 + fx1) / 2, yy - 2.2);
    ctx.lineTo((fx0 + fx1) / 2, yy + 2.2);
    ctx.stroke();
  }
  // perforin's pores on the other face; granzymes passing into it
  if (s.pores > 0.01) {
    for (let i = -3; i <= 3; i++) {
      const y = i * 2.4;
      ctx.beginPath();
      ctx.ellipse(fx1 + 0.4, y, 0.45, 0.9, 0, 0, TAU);
      ctx.strokeStyle = rgba(GOLD_HI, s.pores);
      ctx.lineWidth = 0.35;
      ctx.stroke();
      glow(ctx, GOLD, fx1 + 0.4, y, 2.2, 0.5 * s.pores);
    }
  }
  if (s.granzymes > 0.01 && s.granzymes < 1) {
    for (let i = 0; i < 16; i++) {
      const k = clamp(s.granzymes * 1.3 - hash(i * 1.9) * 0.3);
      if (k <= 0 || k >= 1) continue;
      const a = (hash(i * 4.4) - 0.5) * 1.6;
      const d = 2 + 22 * ease.outCubic(k);
      const x = fx1 + Math.cos(a) * d, y = Math.sin(a) * d;
      glow(ctx, GOLD_HI, x, y, 1.6, 0.7 * (1 - k));
    }
  }
  // the brake: PD-1 on the T cell's face meets PD-L1 on the other's
  if (s.brake > 0.01 || s.drugs > 0.01) {
    const mid = (fx0 + fx1) / 2;
    for (let i = 0; i < 6; i++) {
      const y = (i < 3 ? -1 : 1) * (3.4 + (i % 3) * 3.4);
      const bind = s.brake;
      // PD-1 stands on the T cell's face, PD-L1 on the other's; bound, their heads meet in the cleft
      const pdHead = fx0 + 0.2 + (mid - 0.7 - fx0) * bind, plHead = fx1 - 0.2 - (fx1 - mid - 0.7) * bind + (1 - bind) * 1.2;
      ctx.strokeStyle = rgba(PD1, 0.9);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(fx0 - 1.2, y);
      ctx.lineTo(pdHead, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pdHead, y, 1.35, 0, TAU);
      ctx.fillStyle = rgba(PD1, 0.95);
      ctx.fill();
      ctx.strokeStyle = rgba(PDL1, 0.9);
      ctx.beginPath();
      ctx.moveTo(fx1 + 1.2, y);
      ctx.lineTo(plHead, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(plHead, y, 1.35, 0, TAU);
      ctx.fillStyle = rgba(PDL1, 0.95);
      ctx.fill();
      if (bind > 0.3) glow(ctx, PD1, mid, y, 3, 0.45 * bind);
      // the medicine: an antibody comes and holds PD-1
      if (s.drugs > 0.01) {
        const from: Pt = [fx0 - 10 - 5 * (i % 3), y + (y < 0 ? -40 : 40)];
        const to: Pt = [pdHead - 1.2, y + (y < 0 ? -3 : 3)];
        const k = s.drugs;
        const ax = from[0] + (to[0] - from[0]) * k, ay = from[1] + (to[1] - from[1]) * k;
        const dir = Math.atan2(to[1] - from[1], to[0] - from[0]);
        antibody(ctx, ax, ay, 3.2, dir - Math.PI / 2 + Math.PI, 0.4 + 0.6 * k);
      }
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, st0: WorldState): void {
  const st = st0.reduced ? { ...st0, time: 0 } : st0;
  const s = stateFor(st.scene, st.g);
  drawCells(ctx, s, st);
  if (st.deep > 0.02) glow(ctx, '#9fb0ff', 0, 0, 60, 0.07 * st.deep);
}

function focusAt(scene: string, g: number): Pt {
  const s = stateFor(scene, g);
  if (scene === 'lek' && g < 0.45) return [T.face - 6, -10 + 10 * s.drugs];
  if (s.fold > 0.3) return [K.at[0] - 6, K.at[1]];
  return [(T.face + K.face) / 2 - 1, 0];
}

export const SYN_VIEW = { x: -72, y: -44, w: 148, h: 88 };
export function synapseWorld(): WorldPainter {
  return { depth: 2, lens: true, bake: (ctx) => bake(ctx), draw, focusAt };
}
