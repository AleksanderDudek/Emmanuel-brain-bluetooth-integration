/**
 * The skin in section (DESIGN.md §24.3, depth 1, under the lens): the epidermis in the player's tone over the
 * papillary dermis with its papillae, the reticular dermis with its collagen, the fat below; a hair follicle and a
 * sweat gland for scale.  Two worlds share it:
 *
 *   SECTION  sploty       the vessels grow: the deep network by the fat, the vertical vessels, the shallow network
 *                         ≈ 1–1.5 mm under the surface, and a capillary loop up into every papilla
 *   WOUND    krzepniecie  a small cut: the vessels at its edges narrow, platelets gather, fibrin weaves a clot
 *            zapalenie    neutrophils arrive first, then macrophages, and the debris is cleared
 *            odbudowa     new tissue fills the bed from below, new vessels sprout into it, the skin creeps in from the edges
 *            przebudowa   the scar matures: the surface whole again, collagen lining up, the vessels fewer
 */
import { clamp, ease } from '../kit/juice';
import { AQUA, BLOOD, BLOOD_HI, GOLD, GOLD_HI, HONEY, LILAC, PEARL, ROSE, TAU, glow, glowEllipse, hash, mix, rgba, smoothPath } from '../kit/healthlib/paint';
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { cnt } from './i18n';
import { airLight, seen, span, toneOf, type Tone } from './tone';

export const SECTION_VIEW: Rect = { x: -62, y: -8, w: 124, h: 76 };
export const WOUND_VIEW: Rect = { x: -36, y: -9, w: 72, h: 46 };

const X0 = -260, X1 = 260;
/** the epidermis's lower edge (it dips between the dermal papillae) */
export const ej = (x: number): number => 5 + 1.2 * Math.sin(x * 0.35);
const PAP = 14;
const SUP = 15.5;
const DEEP = 49;
const SUB = 51;
/** the dermal papillae's tips (where the epidermis is thinnest) */
const papillaX = (k: number): number => (-Math.PI / 2 + TAU * k) / 0.35;

// ── the tissue (both worlds) ─────────────────────────────────────
function tissue(ctx: CanvasRenderingContext2D, tone: Tone): void {
  airLight(ctx, -0.3, 0.6);
  // the fat: lobules with golden rims
  ctx.fillStyle = '#2e1232';
  ctx.fillRect(X0, SUB - 1, X1 - X0, 140);
  for (let i = 0; i < 520; i++) {
    const x = X0 + hash(i * 3 + 7) * (X1 - X0), y = SUB + 2 + hash(i * 5 + 8) * 60;
    const r = 2.4 + 1.6 * hash(i * 7 + 9);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.8 + 0.3 * hash(i + 10)), hash(i + 11) * 3, 0, TAU);
    ctx.fillStyle = `rgba(255,214,160,${(0.05 + 0.06 * hash(i + 13)).toFixed(3)})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,160,.28)';
    ctx.lineWidth = 0.2;
    ctx.stroke();
  }
  // the dermis: papillary (lighter, finer) over reticular (deeper, with bundles)
  const dg = ctx.createLinearGradient(0, 4, 0, SUB);
  dg.addColorStop(0, '#6e2858');
  dg.addColorStop(0.2, '#5a2050');
  dg.addColorStop(1, '#3a1540');
  ctx.fillStyle = dg;
  ctx.fillRect(X0, 4, X1 - X0, SUB - 4);
  for (let i = 0; i < 520; i++) {
    const x = X0 + hash(i * 19 + 21) * (X1 - X0), y = PAP + 1 + hash(i * 23 + 22) * (SUB - PAP - 3);
    const l = 6 + 12 * hash(i + 23);
    ctx.strokeStyle = i % 4 ? 'rgba(255,170,214,.11)' : 'rgba(255,214,236,.2)';
    ctx.lineWidth = i % 4 ? 0.7 : 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + l * 0.3, y - 1.2, x + l * 0.6, y + 1.2, x + l, y);
    ctx.stroke();
  }
  // a sweat gland: its coil in the deep dermis and its duct spiralling up to the surface
  const sx = -44;
  ctx.strokeStyle = 'rgba(170,220,255,.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = 0; k <= 60; k++) {
    const a = k * 0.55, rr = 3.2 + 0.6 * Math.sin(k * 0.7);
    const x = sx + Math.cos(a) * rr, y = 47 + Math.sin(a) * rr * 0.7 + (k / 60) * 2;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  for (let y = 44; y >= 0; y -= 0.5) {
    const x = sx + 1.2 * Math.sin(y * (y < 6 ? 1.4 : 0.35));
    if (y === 44) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  glow(ctx, AQUA, sx, 47, 7, 0.12);
  // a hair follicle on its slant, with its gland
  const fx = 46, th = 0.42;
  const P = (u: number, v = 0): Pt => [fx - Math.sin(th) * u + Math.cos(th) * v, Math.cos(th) * u + Math.sin(th) * v];
  const q = new Path2D();
  const a0 = P(0, -2.4), a1 = P(0, 2.4), b1 = P(54, 2.8), b0 = P(54, -2.8);
  q.moveTo(a0[0], a0[1]);
  q.lineTo(b0[0], b0[1]);
  q.lineTo(b1[0], b1[1]);
  q.lineTo(a1[0], a1[1]);
  q.closePath();
  ctx.fillStyle = 'rgba(240,214,250,.22)';
  ctx.fill(q);
  ctx.strokeStyle = 'rgba(250,232,255,.4)';
  ctx.lineWidth = 0.22;
  ctx.stroke(q);
  const h0 = P(-14, 0), h1 = P(50, 0);
  ctx.strokeStyle = mix('#4a3020', '#c8a080', 0.2);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(h0[0], h0[1]);
  ctx.lineTo(h1[0], h1[1]);
  ctx.stroke();
  const bulb = P(55);
  glow(ctx, '#ffc0a0', bulb[0], bulb[1], 6, 0.3);
  ctx.beginPath();
  ctx.ellipse(bulb[0], bulb[1], 3.4, 4.4, -th, 0, TAU);
  ctx.fillStyle = 'rgba(255,200,190,.55)';
  ctx.fill();
  const gl = P(12, 4.4);
  glow(ctx, HONEY, gl[0], gl[1], 5, 0.18);
  ctx.beginPath();
  ctx.arc(gl[0], gl[1], 2.2, 0, TAU);
  ctx.fillStyle = 'rgba(255,206,120,.4)';
  ctx.fill();
  // the epidermis in the player's tone, its horny layer pale on top
  ctx.beginPath();
  ctx.moveTo(X0, 0);
  for (let x = X0; x <= X1; x += 1) ctx.lineTo(x, ej(x));
  ctx.lineTo(X1, 0);
  ctx.closePath();
  const eg = ctx.createLinearGradient(0, 0, 0, 6.5);
  eg.addColorStop(0, rgba(mix(tone.hi, '#ffffff', 0.25), 0.96));
  eg.addColorStop(0.3, rgba(tone.skin, 0.92));
  eg.addColorStop(1, rgba(mix(tone.deep, '#c87aa8', 0.25), 0.88));
  ctx.fillStyle = eg;
  ctx.fill();
  // melanin at the base of the epidermis: more and darker in darker skin
  const n = Math.round(160 + 520 * tone.mel);
  ctx.fillStyle = rgba(tone.gran, 0.35 + 0.4 * tone.mel);
  for (let i = 0; i < n; i++) {
    const x = X0 + hash(i * 29 + 31) * (X1 - X0);
    const y = ej(x) - 0.4 - hash(i * 31 + 32) * (1 + 3 * tone.mel);
    ctx.beginPath();
    ctx.arc(x, y, 0.16 + 0.12 * tone.size, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = rgba('#fffaf4', 0.5);
  ctx.fillRect(X0, 0, X1 - X0, 0.6);
  ctx.strokeStyle = 'rgba(255,246,236,.85)';
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(X0, 0);
  ctx.lineTo(X1, 0);
  ctx.stroke();
}

// ── the vessels (sploty) ─────────────────────────────────────────
interface Vessel { pts: Pt[]; t0: number; w: number; vein?: boolean }
let net: Vessel[] | null = null;
function vessels(): Vessel[] {
  if (net) return net;
  const out: Vessel[] = [];
  const wig = (x0: number, y0: number, x1: number, y1: number, n: number, amp: number, seed: number): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      pts.push([x0 + (x1 - x0) * k + amp * (hash(seed * 7 + i) - 0.5) * (i && i < n ? 1 : 0), y0 + (y1 - y0) * k + amp * 0.4 * (hash(seed * 11 + i) - 0.5) * (i && i < n ? 1 : 0)]);
    }
    return pts;
  };
  // the deep network: an artery and its vein side by side
  for (let s = -6; s < 6; s++) {
    out.push({ pts: wig(s * 40, DEEP, s * 40 + 40, DEEP, 8, 3, 10 + s), t0: 0.02 + 0.012 * (s + 6), w: 1.1 });
    out.push({ pts: wig(s * 40, DEEP + 2.6, s * 40 + 40, DEEP + 2.6, 8, 3, 30 + s), t0: 0.04 + 0.012 * (s + 6), w: 1.3, vein: true });
  }
  // the vertical vessels joining the two networks
  for (let i = -10; i <= 10; i++) {
    const x = i * 22 + 6 * Math.sin(i);
    out.push({ pts: wig(x, DEEP, x + 3, SUP, 7, 2.5, 50 + i), t0: 0.22 + 0.01 * (i + 10) * 0.6, w: 0.7 });
  }
  // the shallow network
  for (let s = -6; s < 6; s++) out.push({ pts: wig(s * 40, SUP, s * 40 + 40, SUP, 10, 2, 70 + s), t0: 0.44 + 0.01 * (s + 6), w: 0.6 });
  // a loop up into every papilla
  for (let k = -12; k <= 12; k++) {
    const x = papillaX(k);
    const top = ej(x) + 0.9;
    out.push({ pts: [[x - 0.9, SUP], [x - 0.8, (SUP + top) / 2], [x - 0.5, top + 0.6], [x, top], [x + 0.5, top + 0.6], [x + 0.8, (SUP + top) / 2], [x + 0.9, SUP]], t0: 0.64 + 0.2 * hash(k + 90), w: 0.42 });
  }
  net = out;
  return out;
}

function drawNet(ctx: CanvasRenderingContext2D, st: WorldState, v: { x0: number; x1: number }): void {
  const op = ctx.globalCompositeOperation;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const vs of vessels()) {
    if (vs.pts[vs.pts.length - 1][0] < v.x0 - 10 && vs.pts[0][0] < v.x0 - 10) continue;
    if (vs.pts[0][0] > v.x1 + 10 && vs.pts[vs.pts.length - 1][0] > v.x1 + 10) continue;
    const r = clamp((st.g - vs.t0) / 0.1);
    if (r <= 0) continue;
    const p = new Path2D();
    smoothPath(p, vs.pts);
    let L = 0;
    for (let i = 1; i < vs.pts.length; i++) L += Math.hypot(vs.pts[i][0] - vs.pts[i - 1][0], vs.pts[i][1] - vs.pts[i - 1][1]);
    if (r < 1) ctx.setLineDash([L * r, L * 2]);
    const col = vs.vein ? '#8a70f0' : BLOOD;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(col, 0.22 + 0.1 * st.deep);
    ctx.lineWidth = vs.w * 3;
    ctx.stroke(p);
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = rgba(vs.vein ? '#b8a8ff' : mix(BLOOD_HI, GOLD_HI, 0.2), 0.9);
    ctx.lineWidth = vs.w;
    ctx.stroke(p);
    ctx.setLineDash([]);
    // blood moving through the grown vessels (only as the scene grows)
    if (r >= 1 && !vs.vein) {
      for (let j = 0; j < 2; j++) {
        const f = (st.g * 3 + j / 2 + hash(vs.t0 * 999)) % 1;
        const idx = f * (vs.pts.length - 1), i0 = Math.floor(idx), fr = idx - i0;
        const a = vs.pts[i0], b = vs.pts[Math.min(vs.pts.length - 1, i0 + 1)];
        glow(ctx, BLOOD_HI, a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr, vs.w * 1.8, 0.5);
      }
    }
  }
  // the papillae warm once their loops arrive
  for (let k = -12; k <= 12; k++) {
    const x = papillaX(k);
    if (x < v.x0 - 5 || x > v.x1 + 5) continue;
    const lit = clamp((st.g - 0.72 - 0.2 * hash(k + 90)) / 0.06);
    if (lit > 0) glow(ctx, ROSE, x, ej(x) + 1.5, 3.4, 0.35 * lit + 0.15 * st.deep);
  }
}

function drawSection(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const v = seen(ctx, 10);
  if (st.scene === 'sploty') drawNet(ctx, st, v);
  if (st.deep > 0.02) glowEllipse(ctx, '#ffb08a', 0, 24, 90, 40, 0, 0.09 * st.deep);
}

// ── the wound ────────────────────────────────────────────────────
const GAP_W = 13, GAP_D = 30;
/** the half-width of the cut at a depth */
const hw = (y: number): number => GAP_W * Math.sqrt(Math.max(0, 1 - y / GAP_D));
function gapPath(): Path2D {
  const p = new Path2D();
  p.moveTo(-GAP_W, -0.2);
  for (let y = 0; y <= GAP_D; y += 0.5) p.lineTo(-hw(y), y);
  for (let y = GAP_D; y >= 0; y -= 0.5) p.lineTo(hw(y), y);
  p.closePath();
  return p;
}

function bakeWound(ctx: CanvasRenderingContext2D, tone: Tone): void {
  tissue(ctx, tone);
  // a few vessels of the shallow and deep networks, cut where the wound is
  ctx.lineCap = 'round';
  for (const y of [SUP, DEEP]) {
    ctx.strokeStyle = rgba(mix(BLOOD_HI, GOLD_HI, 0.2), 0.55);
    ctx.lineWidth = y === DEEP ? 1 : 0.6;
    ctx.beginPath();
    for (let x = X0; x <= X1; x += 2) {
      const yy = y + 0.8 * Math.sin(x * 0.13);
      if (x === X0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // the bed of the cut: dark and raw, its edges catching the light
  const p = gapPath();
  const g = ctx.createLinearGradient(0, 0, 0, GAP_D);
  g.addColorStop(0, '#1c0614');
  g.addColorStop(1, '#3a0c22');
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = 'rgba(255,150,170,.55)';
  ctx.lineWidth = 0.4;
  ctx.stroke(p);
}

/** The clot at a share k (blood gathered, platelets on the edges, a net of fibrin), into the gap. */
function clot(ctx: CanvasRenderingContext2D, k: number, st: WorldState, top = 0): void {
  ctx.save();
  ctx.clip(gapPath());
  const bg = ctx.createLinearGradient(0, top, 0, GAP_D);
  bg.addColorStop(0, rgba(mix('#c0283c', '#5a0c1c', k * 0.7), 0.95));
  bg.addColorStop(1, rgba('#8a1428', 0.95));
  ctx.fillStyle = bg;
  ctx.fillRect(-GAP_W - 1, top, 2 * GAP_W + 2, GAP_D - top + 1);
  // red cells in the pool
  for (let i = 0; i < 70; i++) {
    const y = top + 1 + hash(i * 3 + 1) * (GAP_D - top - 2);
    const x = (hash(i * 7 + 2) - 0.5) * 2 * hw(y) * 0.9;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.9, 0.55, hash(i) * 3, 0, TAU);
    ctx.fillStyle = rgba('#ff6070', 0.55);
    ctx.fill();
  }
  // the fibrin net: golden threads across the gap
  const n = Math.round(46 * k);
  ctx.strokeStyle = rgba(GOLD_HI, 0.7);
  ctx.lineWidth = 0.18;
  for (let i = 0; i < n; i++) {
    const y0 = top + 1 + hash(i * 11 + 5) * (GAP_D - top - 3), y1 = y0 + (hash(i * 13 + 6) - 0.5) * 10;
    ctx.beginPath();
    ctx.moveTo(-hw(y0) * 0.98, y0);
    ctx.quadraticCurveTo((hash(i * 17) - 0.5) * 8, (y0 + y1) / 2 + 2, hw(y1) * 0.98, y1);
    ctx.stroke();
  }
  // the crust where the clot meets the air
  if (k > 0.5) {
    ctx.fillStyle = rgba('#3a0a12', 0.8 * (k - 0.5) * 2);
    ctx.fillRect(-GAP_W, top - 0.5, 2 * GAP_W, 2.4);
  }
  ctx.restore();
  // platelets gathering on the edges
  const m = Math.round(36 * clamp(k * 1.6));
  for (let i = 0; i < m; i++) {
    const y = top + 0.5 + hash(i * 5 + 3) * (GAP_D - top - 1);
    const side = i % 2 ? 1 : -1;
    const x = side * (hw(y) - 0.5);
    ctx.beginPath();
    ctx.ellipse(x, y, 0.55, 0.35, hash(i) * 3, 0, TAU);
    ctx.fillStyle = rgba('#ffe6f0', 0.85);
    ctx.fill();
  }
  if (st.growing && k < 1) glow(ctx, GOLD, 0, top + (GAP_D - top) * 0.5, 9, 0.25);
}

function drawWound(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const tone = toneOf(st.look);
  const { scene, g } = st;
  if (scene === 'krzepniecie') {
    const k = ease.outCubic(span(g, 0.02, 0.95));
    clot(ctx, k, st);
    // the cut vessels at the edges narrowing
    for (const y of [SUP, DEEP > GAP_D ? -1 : DEEP]) {
      if (y < 0) continue;
      for (const s of [-1, 1]) glow(ctx, BLOOD, s * hw(y), y, 3.2 * (1 - 0.6 * k), 0.5 * (1 - 0.6 * k));
    }
  } else if (scene === 'zapalenie') {
    clot(ctx, 1, st);
    // debris cleared as the cells work
    for (let i = 0; i < 24; i++) {
      const y = 3 + hash(i * 7 + 9) * 24, x = (hash(i * 3 + 8) - 0.5) * hw(y) * 1.6;
      const a = 1 - clamp((g - i / 30) * 3);
      if (a <= 0) continue;
      ctx.beginPath();
      ctx.arc(x, y, 0.5, 0, TAU);
      ctx.fillStyle = rgba('#20140a', 0.85 * a);
      ctx.fill();
    }
    // neutrophils first (pearl, a lobed nucleus), then macrophages (larger, lilac, reaching)
    for (let i = 0; i < 12; i++) {
      const k = clamp((g - i * 0.035) / 0.18);
      if (k <= 0) continue;
      const side = i % 2 ? 1 : -1;
      const ty = 4 + ((i * 0.53 + 0.2) % 1) * 22, tx = (((i * 0.29 + 0.1) % 1) - 0.5) * hw(ty) * 1.4;
      const x = side * (hw(ty) + 6) + (tx - side * (hw(ty) + 6)) * ease.outCubic(k), y = ty;
      neutrophil(ctx, x, y, clamp(k * 3));
    }
    for (let i = 0; i < 8; i++) {
      const k = clamp((g - 0.3 - i * 0.06) / 0.22);
      if (k <= 0) continue;
      const side = i % 2 ? -1 : 1;
      const ty = 5 + ((i * 0.37) % 1) * 21, tx = (((i * 0.61) % 1) - 0.5) * hw(ty) * 1.3;
      const x = side * (hw(ty) + 8) + (tx - side * (hw(ty) + 8)) * ease.outCubic(k);
      macrophage(ctx, x, ty, clamp(k * 3), i, st);
    }
  } else if (scene === 'odbudowa') {
    // the new tissue fills from below; a thin scab stays on top
    const lvl = GAP_D - (GAP_D - 3.5) * ease.inOutSine(span(g, 0.02, 0.9));
    clot(ctx, 1, st, Math.max(0, lvl - 3) * 0);
    ctx.save();
    ctx.clip(gapPath());
    const gg = ctx.createLinearGradient(0, lvl, 0, GAP_D);
    gg.addColorStop(0, rgba('#ff8aa0', 0.95));
    gg.addColorStop(1, rgba('#c04a6a', 0.95));
    ctx.fillStyle = gg;
    ctx.fillRect(-GAP_W - 1, lvl, 2 * GAP_W + 2, GAP_D - lvl + 1);
    // its granular look: round buds of new vessels
    for (let i = 0; i < 60; i++) {
      const y = lvl + 0.8 + hash(i * 3 + 7) * (GAP_D - lvl), x = (hash(i * 5 + 6) - 0.5) * 2 * hw(Math.min(GAP_D - 0.5, y));
      if (y > GAP_D) continue;
      ctx.beginPath();
      ctx.arc(x, y, 0.7, 0, TAU);
      ctx.fillStyle = rgba('#ffc0c8', 0.5);
      ctx.fill();
    }
    // new capillary loops sprouting up into it
    ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      const x = i * 2.6;
      const top = Math.max(lvl + 1.5, 4.5);
      if (top > GAP_D - 2) continue;
      const p = new Path2D();
      p.moveTo(x - 0.6, GAP_D);
      p.bezierCurveTo(x - 0.7, top + 3, x - 0.4, top, x, top);
      p.bezierCurveTo(x + 0.4, top, x + 0.7, top + 3, x + 0.6, GAP_D);
      ctx.strokeStyle = rgba(BLOOD_HI, 0.9);
      ctx.lineWidth = 0.4;
      ctx.stroke(p);
    }
    // fibroblasts laying collagen
    for (let i = 0; i < 9; i++) {
      const y = lvl + 2 + hash(i * 17 + 3) * (GAP_D - lvl - 3);
      if (y > GAP_D - 1) continue;
      const x = (hash(i * 19 + 4) - 0.5) * 1.4 * hw(y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((hash(i) - 0.5) * 1.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.2, 0.55, 0, 0, TAU);
      ctx.fillStyle = rgba('#c8f0ff', 0.75);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // the skin creeping in from both edges under the scab
    const e = ease.inOutSine(span(g, 0.35, 1));
    for (const s of [-1, 1]) {
      const x0 = s * hw(4.6), x1 = s * hw(4.6) * (1 - e) + s * 0.2;
      ctx.beginPath();
      ctx.moveTo(x0, 1.6);
      ctx.lineTo(x1 + s * 1.2, 2.4);
      ctx.quadraticCurveTo(x1, 3.2, x1 + s * 1.2, 4.2);
      ctx.lineTo(x0, 5);
      ctx.closePath();
      ctx.fillStyle = rgba(tone.skin, 0.95);
      ctx.fill();
      ctx.strokeStyle = rgba(GOLD_HI, 0.8);
      ctx.lineWidth = 0.22;
      ctx.stroke();
      if (st.growing && e > 0 && e < 1) glow(ctx, GOLD, x1, 3.2, 2.5, 0.5);
    }
  } else if (scene === 'przebudowa') {
    // the surface is whole again; the scar below matures, its collagen lining up
    ctx.save();
    ctx.clip(gapPath());
    const pale = ease.inOutSine(g);
    ctx.fillStyle = rgba(mix('#b04a80', '#d8a0bc', pale * 0.7), 0.95);
    ctx.fillRect(-GAP_W - 1, 0, 2 * GAP_W + 2, GAP_D + 1);
    for (let i = 0; i < 120; i++) {
      const y = 5 + hash(i * 7 + 1) * (GAP_D - 5), x = (hash(i * 11 + 2) - 0.5) * 2 * hw(y);
      const ang = (hash(i * 13 + 3) - 0.5) * Math.PI * (1 - 0.92 * ease.inOutSine(span(g, 0, 0.9)));
      const l = 2.4 + 2 * hash(i);
      ctx.strokeStyle = rgba(mix('#ffd0dc', GOLD_HI, 0.5 * g), 0.75);
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * l, y - Math.sin(ang) * l);
      ctx.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l);
      ctx.stroke();
    }
    // the vessels of the young scar, fewer as it matures
    for (let i = -3; i <= 3; i++) {
      const a = 0.85 * (1 - 0.8 * g) * (Math.abs(i) <= Math.round(3 * (1 - g)) ? 1 : 0.2);
      if (a < 0.05) continue;
      ctx.strokeStyle = rgba(BLOOD_HI, a);
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(i * 2.6 - 0.5, GAP_D);
      ctx.quadraticCurveTo(i * 2.6, 6, i * 2.6 + 0.5, GAP_D);
      ctx.stroke();
    }
    ctx.restore();
    // the epidermis bridging the scar, flatter (no ridges), in the player's tone — joined to the skin on both sides
    ctx.save();
    ctx.clip(gapPath());
    ctx.beginPath();
    ctx.moveTo(-GAP_W - 1, -0.3);
    ctx.lineTo(GAP_W + 1, -0.3);
    for (let x = GAP_W + 1; x >= -GAP_W - 1; x -= 0.5) {
      const edge = clamp((Math.abs(x) - GAP_W + 5) / 5);
      ctx.lineTo(x, 4.4 + (ej(x) - 4.4) * edge);
    }
    ctx.closePath();
    const eg = ctx.createLinearGradient(0, 0, 0, 6.5);
    eg.addColorStop(0, rgba(mix(tone.hi, '#ffffff', 0.25), 0.96));
    eg.addColorStop(0.3, rgba(tone.skin, 0.92));
    eg.addColorStop(1, rgba(mix(tone.deep, '#c87aa8', 0.25), 0.88));
    ctx.fillStyle = eg;
    ctx.fill();
    ctx.fillStyle = rgba('#fffaf4', 0.5);
    ctx.fillRect(-GAP_W - 1, 0, 2 * GAP_W + 2, 0.6);
    ctx.restore();
    if (st.growing) glow(ctx, GOLD, 0, 16, 10, 0.18 + 0.12 * st.light);
  }
  if (st.deep > 0.02) {
    glowEllipse(ctx, '#ffb08a', 0, 12, 40, 22, 0, 0.1 * st.deep);
    glowEllipse(ctx, AQUA, 0, 4, 26, 8, 0, 0.04 * st.deep);
  }
}

function neutrophil(ctx: CanvasRenderingContext2D, x: number, y: number, a: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 1.5, 0, TAU);
  ctx.fillStyle = rgba('#fff0f6', 0.82 * a);
  ctx.fill();
  ctx.strokeStyle = rgba(PEARL, 0.9 * a);
  ctx.lineWidth = 0.14;
  ctx.stroke();
  ctx.fillStyle = rgba('#7a4ab0', 0.8 * a);
  for (const [dx, dy] of [[-0.6, -0.2], [0.1, 0.35], [0.65, -0.25]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 0.42, 0, TAU);
    ctx.fill();
  }
}

function macrophage(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, i: number, st: WorldState): void {
  glow(ctx, LILAC, x, y, 5, 0.25 * a);
  ctx.beginPath();
  for (let k = 0; k <= 12; k++) {
    const ang = (k / 12) * TAU;
    const r = 2.6 + 0.7 * Math.sin(ang * 3 + i + st.g * 4);
    const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r * 0.85;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = rgba(mix(LILAC, AQUA, 0.3), 0.75 * a);
  ctx.fill();
  ctx.strokeStyle = rgba('#f0e8ff', 0.8 * a);
  ctx.lineWidth = 0.16;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - 0.3, y, 1.1, 0.8, 0.4, 0, TAU);
  ctx.fillStyle = rgba('#4a2a7a', 0.8 * a);
  ctx.fill();
}

export const secPt = {
  epidermis: [-38, 2.6] as Pt,
  deep: [-26, DEEP] as Pt,
  superficial: [22, SUP] as Pt,
  loop: [papillaX(1), ej(papillaX(1)) + 1.4] as Pt,
  fat: [20, 60] as Pt,
  follicle: [40, 14] as Pt,
  sweat: [-44, 47] as Pt,
  dermis: [-20, 30] as Pt,
  surface: [0, 1] as Pt,
};

export const woundPt = {
  edgeL: [-11, 8] as Pt,
  mid: [3, 14] as Pt,
  top: [0, 2] as Pt,
  deep: [0, 24] as Pt,
  skinEdge: [-12, 3] as Pt,
  side: [16, 3] as Pt,
};

export const SECTION: WorldPainter = {
  depth: 1,
  lens: true,
  bake(ctx, _variant, look) {
    tissue(ctx, toneOf(look));
  },
  draw: drawSection,
  focusAt(scene, g) {
    if (scene === 'sploty') return g < 0.3 ? [0, DEEP] : g < 0.6 ? [0, (DEEP + SUP) / 2] : [papillaX(0), SUP - 4];
    return [0, 20];
  },
};

export const WOUND: WorldPainter = {
  depth: 1,
  lens: true,
  bake(ctx, _variant, look) {
    bakeWound(ctx, toneOf(look));
  },
  draw: drawWound,
  focusAt(scene, g) {
    if (scene === 'odbudowa') return [0, GAP_D - (GAP_D - 4) * ease.inOutSine(span(g, 0.02, 0.9))];
    if (scene === 'przebudowa') return [0, 14];
    return [0, 12];
  },
  counter(scene, g) {
    if (scene === 'przebudowa') return cnt('strength', Math.round(20 + 60 * ease.inOutSine(g)));
    return null;
  },
};
