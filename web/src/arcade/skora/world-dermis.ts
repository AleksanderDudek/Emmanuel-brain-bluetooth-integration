/**
 * The dermis close up (DESIGN.md §24.3, depth 2, under the lens): a fibroblast at work in the weave it makes — wavy
 * bundles of collagen (rose ropes with a fine banding), fine branching fibres of elastin (pearl-violet), and between
 * them hyaluronic acid holding water (an aqua haze with droplets).
 *
 *   fibroblast  the cell spins: three chains twist into a helix (gold), helices gather into fibrils, fibrils into a bundle
 *   elastyna    the elastin fibres spread and gently stretch and spring back; water gathers in the gel between
 *   lata        the weave through the years: the older bundles slowly give way to new golden ones (half in ≈ 15 years)
 */
import { clamp, ease } from '../kit/juice';
import { AQUA, GOLD, GOLD_HI, PEARL, ROSE, TAU, VIOLET, glow, glowEllipse, hash, mix, rgba, smoothPath, polyAt } from '../kit/healthlib/paint';
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { cnt } from './i18n';
import { seen, span, toneOf } from './tone';

export const DERMIS_VIEW: Rect = { x: -50, y: -32, w: 100, h: 64 };

/** A bundle of collagen: a wavy rope across the field. */
interface Bundle { pts: Pt[]; w: number; i: number; far: boolean }
let bundles: Bundle[] | null = null;
/** The weave: bundles running mostly across, some on the slant both ways, crossing like a loose basket weave. */
function allBundles(): Bundle[] {
  if (bundles) return bundles;
  const out: Bundle[] = [];
  for (let i = 0; i < 26; i++) {
    const fam = i % 3;
    const ang = fam === 0 ? (hash(i * 7 + 2) - 0.5) * 0.3 : (fam === 1 ? 1 : -1) * (0.35 + 0.3 * hash(i * 7 + 2));
    const cx = -90 + hash(i * 3 + 1) * 180, cy = -60 + hash(i * 5 + 4) * 120;
    const pts: Pt[] = [];
    for (let k = -9; k <= 9; k++) {
      const s = k * 16;
      const wave = 2.6 * Math.sin(k * 0.95 + i * 0.7);
      pts.push([cx + Math.cos(ang) * s - Math.sin(ang) * wave, cy + Math.sin(ang) * s + Math.cos(ang) * wave]);
    }
    out.push({ pts, w: 2.4 + 2.2 * hash(i * 11 + 3), i, far: hash(i * 13 + 6) < 0.35 });
  }
  bundles = out;
  return out;
}
/** a bundle's width and light (those far in the depth thinner and dimmer) */
const bw = (b: Bundle): number => (b.far ? b.w * 0.7 : b.w);
const ba = (b: Bundle): number => (b.far ? 0.45 : 0.85);
/** bundles near the fibroblast are left out (it lies in a clearing of the weave) */
const nearCell = (b: Bundle): boolean => b.pts.some(([x, y]) => Math.abs(x) < 24 && Math.abs(y) < 6);

function rope(ctx: CanvasRenderingContext2D, pts: readonly Pt[], w: number, body: string, hi: string, a: number, k = 1): void {
  if (k <= 0 || a <= 0) return;
  const p = new Path2D();
  const n = Math.max(2, Math.ceil(pts.length * k));
  const sub = pts.slice(0, n);
  if (k < 1 && n < pts.length) {
    const end = polyAt(pts, k);
    sub[sub.length - 1] = end;
  }
  smoothPath(p, sub);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // a soft body, then its fibrils (a few strands side by side) with the fine banding of collagen
  ctx.strokeStyle = rgba(body, 0.32 * a);
  ctx.lineWidth = w;
  ctx.stroke(p);
  for (const off of [-0.3, 0, 0.3]) {
    ctx.save();
    ctx.translate(0, off * w);
    ctx.strokeStyle = rgba(mix(body, hi, 0.25), 0.55 * a);
    ctx.lineWidth = w * 0.16;
    ctx.stroke(p);
    ctx.restore();
  }
  ctx.setLineDash([0.3, 0.8]);
  ctx.strokeStyle = rgba(hi, 0.22 * a);
  ctx.lineWidth = w * 0.85;
  ctx.stroke(p);
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(hi, 0.6 * a);
  ctx.lineWidth = w * 0.1;
  ctx.stroke(p);
}

/** The elastin fibres: fine, branching, wavy. */
interface Fibre { pts: Pt[]; i: number }
let fibres: Fibre[] | null = null;
function allFibres(): Fibre[] {
  if (fibres) return fibres;
  const out: Fibre[] = [];
  for (let i = 0; i < 26; i++) {
    const x0 = -110 + hash(i * 5 + 1) * 220, y0 = -60 + hash(i * 7 + 2) * 120;
    const ang = hash(i * 3 + 3) * Math.PI;
    const pts: Pt[] = [];
    for (let k = 0; k <= 10; k++) {
      const s = k * 3.8;
      const wave = 2.2 * Math.sin(k * 0.8 + i);
      pts.push([x0 + Math.cos(ang) * s - Math.sin(ang) * wave, y0 + Math.sin(ang) * s + Math.cos(ang) * wave]);
    }
    out.push({ pts, i });
  }
  fibres = out;
  return out;
}

// ── the still layer ──────────────────────────────────────────────
function bake(ctx: CanvasRenderingContext2D, variant: string, look: string): void {
  const tone = toneOf(look);
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 120);
  g.addColorStop(0, '#5a2450');
  g.addColorStop(0.5, '#43193f');
  g.addColorStop(1, '#271030');
  ctx.fillStyle = g;
  ctx.fillRect(-260, -200, 520, 400);
  // the gel between the fibres: a soft aqua haze
  for (let i = 0; i < 22; i++) glow(ctx, '#6fb8d8', -120 + hash(i * 3 + 9) * 240, -80 + hash(i * 5 + 8) * 160, 14 + 14 * hash(i), 0.06);
  // a fine far weave in the depth
  ctx.strokeStyle = 'rgba(255,170,214,.08)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 260; i++) {
    const x = -200 + hash(i * 19 + 3) * 400, y = -120 + hash(i * 23 + 4) * 240, l = 6 + 10 * hash(i + 5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + l * 0.3, y - 1, x + l * 0.6, y + 1, x + l, y + 0.4);
    ctx.stroke();
  }
  // the bundles (in the weaving scene those near the cell are what it spins)
  const body = mix(ROSE, tone.skin, 0.25), hi = '#ffe0ec';
  for (const b of allBundles()) {
    if (variant === 'spin' && nearCell(b)) continue;
    if (variant === 'years') continue;
    rope(ctx, b.pts, bw(b), body, hi, ba(b));
  }
  if (variant === 'woven' || variant === 'years') {
    for (const s of spun()) rope(ctx, s.pts, 1.6, mix(GOLD, ROSE, 0.35), GOLD_HI, variant === 'years' ? 0 : 0.8);
  }
  if (variant !== 'spin' && variant !== 'years') cell(ctx, 0.85);
}

/** The fibroblast: a spindle with long tapering ends, a pale oval nucleus, lit from within. */
function cell(ctx: CanvasRenderingContext2D, a: number): void {
  const p = new Path2D();
  p.moveTo(-26, 1.5);
  p.bezierCurveTo(-14, -1.5, -8, -5, 0, -4.8);
  p.bezierCurveTo(8, -4.6, 14, -2.5, 27, -2.2);
  p.bezierCurveTo(15, 0.2, 9, 4.6, 0, 4.6);
  p.bezierCurveTo(-8, 4.6, -14, 2.8, -26, 1.5);
  p.closePath();
  glowEllipse(ctx, AQUA, 0, 0, 30, 9, -0.03, 0.22 * a);
  const g = ctx.createLinearGradient(0, -5, 0, 5);
  g.addColorStop(0, rgba('#d8f6ff', 0.75 * a));
  g.addColorStop(1, rgba('#8fc8e8', 0.6 * a));
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = rgba('#f0fcff', 0.8 * a);
  ctx.lineWidth = 0.3;
  ctx.stroke(p);
  ctx.beginPath();
  ctx.ellipse(0, -0.1, 5.2, 2.7, -0.04, 0, TAU);
  ctx.fillStyle = rgba('#6a4ab0', 0.8 * a);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(1.2, -0.5, 0.8, 0, TAU);
  ctx.fillStyle = rgba('#c8b0ff', 0.8 * a);
  ctx.fill();
}

/** The fibres the cell spins in the weaving scene, from its two ends outward along the weave. */
let spunCache: { pts: Pt[]; t0: number }[] | null = null;
function spun(): { pts: Pt[]; t0: number }[] {
  if (spunCache) return spunCache;
  const out: { pts: Pt[]; t0: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const dy = (Math.floor(i / 2) - 1) * 3.2;
    const pts: Pt[] = [];
    for (let k = 0; k <= 12; k++) {
      const x = side * (25 + k * 9);
      pts.push([x, -0.5 + dy * (0.3 + k * 0.12) + 1.6 * Math.sin(k * 0.9 + i)]);
    }
    out.push({ pts, t0: 0.08 + 0.12 * Math.floor(i / 2) });
  }
  spunCache = out;
  return out;
}

// ── what lives ───────────────────────────────────────────────────
function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const tone = toneOf(st.look);
  const { scene, g } = st;
  const v = seen(ctx, 8);
  if (scene === 'fibroblast') {
    const body = mix(ROSE, tone.skin, 0.25);
    // the bundles of the clearing grow back as the cell weaves
    for (const b of allBundles()) if (nearCell(b)) rope(ctx, b.pts, bw(b), body, '#ffe0ec', ba(b) * span(g, 0.7, 1));
    for (const s of spun()) {
      const k = ease.outCubic(span(g, s.t0, s.t0 + 0.55));
      if (k <= 0) continue;
      // the three chains twisting as they leave the cell, then one golden fibril
      helix(ctx, s.pts, k, st);
      rope(ctx, s.pts, 1.6 * k, mix(GOLD, ROSE, 0.35), GOLD_HI, 0.8, k);
    }
    cell(ctx, 1);
    if (st.growing) for (const side of [-1, 1]) glow(ctx, GOLD, side * 25, -0.5, 4, 0.5 + 0.3 * st.light);
  } else if (scene === 'elastyna') {
    const k = ease.outCubic(span(g, 0.03, 0.75));
    // the fibres stretch and spring back gently (with the breath in rest; still under reduced motion)
    const spring = st.reduced ? 1 : 1 + 0.06 * Math.sin(st.time * 1.1) * (st.growing ? 1 : 0.3) + 0.05 * (st.breath - 0.5);
    for (const f of allFibres()) {
      const cx = f.pts[5][0], cy = f.pts[5][1];
      if (cx < v.x0 - 30 || cx > v.x1 + 30 || cy < v.y0 - 30 || cy > v.y1 + 30) continue;
      const kk = clamp((k - hash(f.i * 3) * 0.4) / 0.6);
      if (kk <= 0) continue;
      const pts = f.pts.map(([x, y]) => [cx + (x - cx) * spring, cy + (y - cy) * spring] as Pt);
      const p = new Path2D();
      smoothPath(p, pts.slice(0, Math.max(2, Math.ceil(pts.length * kk))));
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(VIOLET, 0.3 * kk);
      ctx.lineWidth = 1.4;
      ctx.stroke(p);
      ctx.strokeStyle = rgba(mix(PEARL, VIOLET, 0.3), 0.9 * kk);
      ctx.lineWidth = 0.42;
      ctx.stroke(p);
      // a little branch
      const b0 = pts[4];
      ctx.beginPath();
      ctx.moveTo(b0[0], b0[1]);
      ctx.bezierCurveTo(b0[0] + 3, b0[1] - 1, b0[0] + 4, b0[1] - 4, b0[0] + 7 * kk, b0[1] - 5 * kk);
      ctx.stroke();
    }
    // water gathering in the gel between the fibres
    const w = span(g, 0.35, 1);
    for (let i = 0; i < 46; i++) {
      const x = -60 + hash(i * 7 + 11) * 120, y = -38 + hash(i * 13 + 12) * 76;
      const kk = clamp((w - i / 60) * 3);
      if (kk <= 0) continue;
      glow(ctx, AQUA, x, y, 2.2, 0.38 * kk);
      ctx.beginPath();
      ctx.arc(x, y, 0.45, 0, TAU);
      ctx.fillStyle = rgba('#e8fbff', 0.8 * kk);
      ctx.fill();
    }
  } else if (scene === 'lata') {
    // half the weave renewed over the scene (half in about fifteen years); new bundles golden
    const body = mix(ROSE, tone.skin, 0.25);
    for (const b of allBundles()) {
      // about half the bundles are renewed by the scene's end, each at its own time
      const due = hash(b.i * 17 + 5);
      const k = due < 0.5 ? clamp((g - due * 2) / 0.08) : 0;
      rope(ctx, b.pts, bw(b), body, '#ffe0ec', ba(b) * (1 - k));
      if (k > 0) rope(ctx, b.pts, bw(b) * 0.95, mix(GOLD, ROSE, 0.3), GOLD_HI, ba(b) * k);
    }
    cell(ctx, 0.85);
  }
  if (st.deep > 0.02) {
    glowEllipse(ctx, '#ffb08a', 0, 0, 60, 34, 0, 0.08 * st.deep);
    glowEllipse(ctx, AQUA, 0, 0, 50, 26, 0, 0.05 * st.deep);
  }
}

/** Three chains twisting into a helix along the first stretch of a spun fibre. */
function helix(ctx: CanvasRenderingContext2D, pts: readonly Pt[], k: number, st: WorldState): void {
  const n = 40;
  const cols = [GOLD_HI, '#ffc9a0', '#fff6dc'];
  for (let s = 0; s < 3; s++) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const f = (i / n) * 0.3 * k;
      const [x, y] = polyAt(pts, f);
      const [x2, y2] = polyAt(pts, Math.min(1, f + 0.01));
      const nx = -(y2 - y), ny = x2 - x, nl = Math.hypot(nx, ny) || 1;
      const off = 1.1 * Math.sin(i * 0.9 + s * (TAU / 3) + st.g * 6);
      if (i === 0) ctx.moveTo(x + (nx / nl) * off, y + (ny / nl) * off);
      else ctx.lineTo(x + (nx / nl) * off, y + (ny / nl) * off);
    }
    ctx.strokeStyle = rgba(cols[s], 0.85);
    ctx.lineWidth = 0.28;
    ctx.stroke();
  }
}

export const dermPt = {
  cell: [0, -1] as Pt,
  cellEnd: [-25, 1.5] as Pt,
  helix: [33, -0.5] as Pt,
  bundle: [-30, 19] as Pt,
  bundleUp: [28, -19] as Pt,
  fibre: [-24, -14] as Pt,
  water: [20, 16] as Pt,
};

export const DERMIS: WorldPainter = {
  depth: 2,
  lens: true,
  bake,
  draw,
  focusAt(scene, g) {
    if (scene === 'fibroblast') return [25 + 20 * ease.outCubic(span(g, 0.08, 0.63)), -0.5];
    if (scene === 'elastyna') return [0, -8];
    return [0, 0];
  },
  counter(scene, g) {
    if (scene === 'lata') return g > 0.03 ? cnt('years', Math.round(15 * g)) : null;
    return null;
  },
};
