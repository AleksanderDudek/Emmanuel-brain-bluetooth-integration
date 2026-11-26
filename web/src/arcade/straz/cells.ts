/**
 * The cells of Czujna straż, drawn in code (DESIGN.md §24): the tissue's own cells in watchful blues and violets
 * with their soft "self" signs; the cell that has begun to change, muted rose-grey — never ugly; the watch's cells
 * glowing from within — the NK cell aqua with its gold granules, the T cell pearl-blue with a fringe of receptors,
 * the dendritic cell a star of long arms, the macrophage warm amber; red blood cells, apoptotic bodies, antibodies.
 * Light is additive glow from baked sprites (paint.ts); no shadowBlur, no filters.
 */
import { AQUA, BLOOD, BLOOD_HI, GOLD, GOLD_HI, PEARL, TAU, VIOLET, glow, hash, mix, rgba } from '../kit/healthlib/paint';
import type { Pt } from './geo';

export const SELF = '#9fe9ff';
export const FLAG = '#c59bff';
export const CHANGED_BODY = '#8d7283';
export const CHANGED_RIM = '#dcbfd0';
export const NK_C = '#8fe6f2';
export const T_C = '#a9c2ff';
export const DC_C = '#cfeeff';
export const MAC_C = '#ffbf94';
export const LYMPH_C = '#a8f0dc';
export const EATME = '#ffcf7a';

/** A soft closed blob (a cell's outline): `n` points round a circle, each pushed out or in by `wob` of r. */
export function blob(x: number, y: number, r: number, seed: number, wob = 0.08, n = 10, rot = 0, sx = 1, sy = 1): Path2D {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const k = 1 + wob * 2 * (hash(seed * 13.7 + i * 3.1) - 0.5);
    pts.push([x + Math.cos(a) * r * k * sx, y + Math.sin(a) * r * k * sy]);
  }
  const p = new Path2D();
  const m = (i: number) => {
    const a = pts[i % n], b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  };
  const s = m(n - 1);
  p.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) {
    const c = pts[i], e = m(i);
    p.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  }
  p.closePath();
  return p;
}

/** A point on a blob-ish cell's membrane at angle a (for signs and contacts). */
export const onRim = (x: number, y: number, r: number, a: number): [number, number] => [x + Math.cos(a) * r, y + Math.sin(a) * r];

// ── the tissue's own cells ───────────────────────────────────────
/** One healthy cell of the tissue (baked): a violet body lit from within, its nucleus, faint organelles, its self signs. */
export function tissueCell(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, seed: number, signs = true): void {
  const body = blob(x, y, r, seed, 0.1, 9, rot, 1.08, 0.94);
  // each cell a little different: bluer or more violet, nearer or deeper
  const hue = hash(seed * 1.73), near = 0.8 + 0.32 * hash(seed * 2.91);
  const lit = (c: string) => mix('#000000', c, Math.min(1, near));
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.15, x, y, r * 1.1);
  g.addColorStop(0, rgba(lit(mix('#5a4cae', '#4a62c4', hue)), 0.95));
  g.addColorStop(0.6, rgba(lit(mix('#382878', '#2c3484', hue)), 0.95));
  g.addColorStop(1, rgba(lit(mix('#544aae', '#4a66c8', hue)), 0.95));
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.strokeStyle = 'rgba(196,206,255,.55)';
  ctx.lineWidth = 0.55;
  ctx.stroke(body);
  // organelles: a few soft specks
  for (let i = 0; i < 5; i++) {
    const a = hash(seed * 3.3 + i) * TAU, d = r * (0.35 + 0.45 * hash(seed * 5.1 + i));
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.9 + 0.8 * hash(seed + i * 7), 0.5, a, 0, TAU);
    ctx.fillStyle = 'rgba(170,160,255,.22)';
    ctx.fill();
  }
  // the nucleus
  const nx = x + (hash(seed * 2.2) - 0.5) * r * 0.3, ny = y + (hash(seed * 4.4) - 0.5) * r * 0.3, nr = r * 0.42;
  const ng = ctx.createRadialGradient(nx - nr * 0.3, ny - nr * 0.3, 0, nx, ny, nr);
  ng.addColorStop(0, 'rgba(150,120,230,.95)');
  ng.addColorStop(1, 'rgba(82,54,160,.95)');
  ctx.beginPath();
  ctx.ellipse(nx, ny, nr * 1.1, nr * 0.92, rot, 0, TAU);
  ctx.fillStyle = ng;
  ctx.fill();
  ctx.strokeStyle = 'rgba(214,200,255,.5)';
  ctx.lineWidth = 0.3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(nx + nr * 0.25, ny - nr * 0.1, nr * 0.22, 0, TAU);
  ctx.fillStyle = 'rgba(214,190,255,.55)';
  ctx.fill();
  if (signs) selfSigns(ctx, x, y, r, seed, 0.42);
}

/** A cell's "self" signs (MHC class I): small pegs of light on its membrane. */
export function selfSigns(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, a: number, n = 7): void {
  if (a <= 0.01) return;
  ctx.fillStyle = rgba(SELF, a);
  ctx.strokeStyle = rgba(SELF, a * 0.8);
  ctx.lineWidth = 0.35;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU + hash(seed * 9.9) * TAU;
    const [px, py] = onRim(x, y, r * 1.02, t);
    const [qx, qy] = onRim(x, y, r * 1.02 + 1.2, t);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(qx, qy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(qx, qy, 0.5, 0, TAU);
    ctx.fill();
  }
}

/**
 * The cell that has begun to change (drawn live): a muted rose-grey body, larger and less even, its nucleus large
 * and uneven; few self signs (`self`), violet flags of stress (`flags`, 0..1); `fold` folds it away in apoptosis
 * (0 whole … 1 gone into bodies: drawn by `apoptoticBodies`), `shine` a soft light where the watch has seen it.
 */
export function changedCell(ctx: CanvasRenderingContext2D, at: Pt, r: number, o: { flags: number; self: number; fold?: number; shine?: number; time: number }): void {
  const [x, y] = at;
  const fold = o.fold ?? 0;
  if (fold >= 0.999) return;
  const k = 1 - 0.32 * Math.min(1, fold / 0.5);
  const rr = r * k;
  const a = 1 - Math.max(0, (fold - 0.55) / 0.45);
  ctx.save();
  ctx.globalAlpha *= a;
  if (o.shine && o.shine > 0.01) glow(ctx, FLAG, x, y, r * 2.2, 0.22 * o.shine);
  // blebs while it folds: small rounded bulges on the membrane
  const body = blob(x, y, rr, 77, 0.16 + 0.1 * fold, 11, 0.4, 1.06, 0.96);
  const g = ctx.createRadialGradient(x - rr * 0.25, y - rr * 0.3, rr * 0.1, x, y, rr * 1.15);
  g.addColorStop(0, rgba(mix(CHANGED_BODY, '#c8a9ba', 0.5), 0.96));
  g.addColorStop(0.65, rgba(CHANGED_BODY, 0.96));
  g.addColorStop(1, rgba(mix(CHANGED_BODY, '#b493a6', 0.5), 0.96));
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.strokeStyle = rgba(CHANGED_RIM, 0.7);
  ctx.lineWidth = 0.6;
  ctx.stroke(body);
  if (fold > 0.05) {
    for (let i = 0; i < 7; i++) {
      const t = i * 0.9 + 0.3;
      const bk = Math.min(1, (fold - 0.05) / 0.3) * (0.6 + 0.4 * Math.sin(o.time * 1.3 + i));
      const [bx, by] = onRim(x, y, rr * 1.02, t);
      ctx.beginPath();
      ctx.arc(bx, by, 1.6 * bk + 0.2, 0, TAU);
      ctx.fillStyle = rgba(mix(CHANGED_BODY, CHANGED_RIM, 0.4), 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba(CHANGED_RIM, 0.6);
      ctx.lineWidth = 0.25;
      ctx.stroke();
    }
  }
  // the nucleus: large, uneven; it condenses as the cell folds itself away
  const nr = rr * (0.5 - 0.22 * Math.min(1, fold / 0.4));
  const nucleus = blob(x + 1, y + 0.5, nr, 31, 0.18, 9, 0.2);
  ctx.fillStyle = fold > 0.1 ? 'rgba(98,62,104,.95)' : 'rgba(110,76,118,.92)';
  ctx.fill(nucleus);
  ctx.strokeStyle = 'rgba(226,196,226,.45)';
  ctx.lineWidth = 0.3;
  ctx.stroke(nucleus);
  if (fold < 0.2) {
    for (const [dx, dy] of [[-1.6, -1], [2.2, 1.4]]) {
      ctx.beginPath();
      ctx.arc(x + 1 + dx, y + 0.5 + dy, 1.1, 0, TAU);
      ctx.fillStyle = 'rgba(230,190,226,.5)';
      ctx.fill();
    }
  }
  // two faint self signs only
  if (o.self > 0.01) selfSigns(ctx, x, y, rr, 5, 0.38 * o.self, 2);
  // the stress flags: violet lollipops standing out of the membrane
  if (o.flags > 0.01) {
    for (let i = 0; i < 9; i++) {
      const t = 0.2 + (i / 9) * TAU;
      const pulse = 0.75 + 0.25 * Math.sin(o.time * 1.6 + i * 1.7);
      const [px, py] = onRim(x, y, rr, t);
      const [qx, qy] = onRim(x, y, rr + 2.4, t);
      ctx.strokeStyle = rgba(FLAG, 0.8 * o.flags);
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(qx, qy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(qx, qy, 0.85, 0, TAU);
      ctx.fillStyle = rgba(mix(FLAG, '#ffffff', 0.25), 0.95 * o.flags);
      ctx.fill();
      glow(ctx, FLAG, qx, qy, 2.6, 0.35 * o.flags * pulse);
    }
  }
  ctx.restore();
}

/** The small bodies a cell folds into, each with its "eat me" sign; `k` their share still outside (0 all taken). */
export function apoptoticBodies(ctx: CanvasRenderingContext2D, at: Pt, spread: number, show: number, eatMe: number, taken: (i: number) => number, time: number): void {
  if (show <= 0.01) return;
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.3;
    const d = spread * (0.45 + 0.5 * hash(i * 4.4));
    const tk = taken(i);
    if (tk >= 1) continue;
    const x = at[0] + Math.cos(a) * d, y = at[1] + Math.sin(a) * d;
    const r = (1.6 + 1.3 * hash(i * 2.7)) * (1 - 0.5 * tk);
    ctx.save();
    ctx.globalAlpha *= show * (1 - tk);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, 'rgba(226,200,216,.95)');
    g.addColorStop(1, rgba(CHANGED_BODY, 0.9));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(CHANGED_RIM, 0.6);
    ctx.lineWidth = 0.25;
    ctx.stroke();
    if (eatMe > 0.01) {
      for (let j = 0; j < 3; j++) {
        const b = j * 2.1 + i;
        ctx.beginPath();
        ctx.arc(x + Math.cos(b) * r, y + Math.sin(b) * r, 0.42, 0, TAU);
        ctx.fillStyle = rgba(EATME, eatMe);
        ctx.fill();
      }
      glow(ctx, EATME, x, y, r * 2.2, 0.16 * eatMe * (0.8 + 0.2 * Math.sin(time * 2 + i)));
    }
    ctx.restore();
  }
}

// ── the watch ───────────────────────────────────────────────────
export interface LymphStyle {
  /** 'nk' aqua with a kidney nucleus and gold granules; 't' pearl-blue with a round nucleus and a receptor fringe; 'mem' a memory T cell (a gold-blue ring) */
  kind: 'nk' | 't' | 'mem';
  /** the light of attention (0..1): a halo, brighter rim */
  glow?: number;
  /** a gold rim (a T cell that has found its match, a clone) */
  gold?: number;
  /** the granules' gathering towards a side (radians) and how far (0..1) */
  toward?: number;
  gather?: number;
  /** squash along x (crossing a wall) */
  sx?: number;
  sy?: number;
  rot?: number;
  alpha?: number;
  seed?: number;
}

/** A lymphocyte: the NK cell or a T cell, small and round, luminous. */
export function lymphocyte(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, s: LymphStyle): void {
  const a = s.alpha ?? 1;
  if (a <= 0.01) return;
  const gl = s.glow ?? 0, gold = s.gold ?? 0, seed = s.seed ?? 1;
  const col = mix(s.kind === 'nk' ? NK_C : T_C, '#ffe2a6', 0.42 * gold);
  ctx.save();
  ctx.globalAlpha *= a;
  glow(ctx, gold > 0.3 ? GOLD : col, x, y, r * 2.6, 0.16 + 0.3 * gl + 0.25 * gold);
  ctx.translate(x, y);
  ctx.rotate(s.rot ?? 0);
  ctx.scale(s.sx ?? 1, s.sy ?? 1);
  const body = blob(0, 0, r, seed, 0.06, 9);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, rgba(mix(col, '#ffffff', 0.7), 0.97));
  g.addColorStop(0.7, rgba(col, 0.95));
  g.addColorStop(1, rgba(mix(col, '#3a3a9a', 0.35), 0.95));
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.strokeStyle = gold > 0.02 ? rgba(mix(PEARL, GOLD, gold), 0.75 + 0.25 * gold) : rgba(mix(col, '#ffffff', 0.6), 0.8);
  ctx.lineWidth = 0.5 + 0.5 * gold;
  ctx.stroke(body);
  // the nucleus: a lymphocyte is mostly nucleus
  if (s.kind === 'nk') {
    // a kidney-shaped nucleus, its notch towards the cell's middle
    const k = new Path2D();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * TAU;
      const d = Math.atan2(Math.sin(a - Math.PI * 0.1), Math.cos(a - Math.PI * 0.1));
      const notch = 1 - 0.32 * Math.exp(-((d / 0.55) ** 2));
      const px = -r * 0.16 + Math.cos(a) * r * 0.56 * notch, py = r * 0.04 + Math.sin(a) * r * 0.4 * notch;
      if (i) k.lineTo(px, py);
      else k.moveTo(px, py);
    }
    k.closePath();
    ctx.fillStyle = 'rgba(80,78,170,.9)';
    ctx.fill(k);
  } else {
    const ng = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r * 0.7);
    ng.addColorStop(0, rgba(mix('#8278dc', '#c48ac8', 0.55 * gold), 0.95));
    ng.addColorStop(1, rgba(mix('#463eaa', '#7a4a9a', 0.55 * gold), 0.95));
    ctx.beginPath();
    ctx.ellipse(r * 0.05, r * 0.03, r * 0.68, r * 0.62, 0.3, 0, TAU);
    ctx.fillStyle = ng;
    ctx.fill();
  }
  // granules (NK, and a T cell that carries them) gathering towards a side
  if (s.kind === 'nk' || gold > 0.2) {
    const n = s.kind === 'nk' ? 7 : 4;
    const gat = s.gather ?? 0, dir = (s.toward ?? 0) - (s.rot ?? 0);
    for (let i = 0; i < n; i++) {
      const t0 = hash(seed * 3 + i) * TAU;
      const t = t0 + (dir - t0) * gat * 0.85 + (i - n / 2) * 0.16 * gat;
      const d = r * (0.72 + 0.12 * hash(i * 7.7)) * (1 - 0.1 * gat);
      const gx = Math.cos(t) * d, gy = Math.sin(t) * d;
      ctx.beginPath();
      ctx.arc(gx, gy, r * 0.12, 0, TAU);
      ctx.fillStyle = rgba(GOLD, 0.95);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx - r * 0.03, gy - r * 0.03, r * 0.05, 0, TAU);
      ctx.fillStyle = rgba(GOLD_HI, 1);
      ctx.fill();
    }
  }
  // the T cell's receptors: a fine fringe of light
  if (s.kind !== 'nk') {
    ctx.strokeStyle = rgba(s.kind === 'mem' ? GOLD_HI : AQUA, 0.55 + 0.3 * gl);
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const t = (i / 14) * TAU;
      ctx.moveTo(Math.cos(t) * r * 1.02, Math.sin(t) * r * 1.02);
      ctx.lineTo(Math.cos(t) * r * 1.16, Math.sin(t) * r * 1.16);
    }
    ctx.stroke();
  }
  if (s.kind === 'mem') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.35, 0, TAU);
    ctx.strokeStyle = rgba(GOLD, 0.55);
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The dendritic cell: a pale star of long, thin, gently moving arms (`reach` 0..1 how far they are out), turning into
 * the rounder, veiled shape of a mature cell (`mature`), with violet pieces it carries (`carry`).
 */
export function dendritic(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, arms: readonly { a: number; len: number }[], o: { reach: number; mature: number; carry: number; time: number; glow?: number }): void {
  const { reach, mature, carry, time } = o;
  glow(ctx, DC_C, x, y, r * 3.2, 0.22 + 0.25 * (o.glow ?? 0) + 0.15 * mature);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  arms.forEach((arm, i) => {
    const L = arm.len * reach * (1 - 0.55 * mature);
    if (L < 0.5) return;
    const sway = 0.08 * Math.sin(time * 0.7 + i * 1.9);
    const a = arm.a + sway;
    const nx = -Math.sin(a), ny = Math.cos(a);
    const tipX = x + Math.cos(a) * (r * 0.6 + L), tipY = y + Math.sin(a) * (r * 0.6 + L);
    const midX = x + Math.cos(a) * (r * 0.6 + L * 0.5) + nx * L * 0.12 * Math.sin(time * 0.5 + i), midY = y + Math.sin(a) * (r * 0.6 + L * 0.5) + ny * L * 0.12 * Math.sin(time * 0.5 + i);
    const w0 = r * 0.42 * (1 + 0.5 * mature);
    const p = new Path2D();
    p.moveTo(x + nx * w0, y + ny * w0);
    p.quadraticCurveTo(midX + nx * w0 * 0.35, midY + ny * w0 * 0.35, tipX, tipY);
    p.quadraticCurveTo(midX - nx * w0 * 0.35, midY - ny * w0 * 0.35, x - nx * w0, y - ny * w0);
    p.closePath();
    ctx.fillStyle = rgba(DC_C, 0.78);
    ctx.fill(p);
    ctx.strokeStyle = rgba('#ffffff', 0.5);
    ctx.lineWidth = 0.22;
    ctx.stroke(p);
    glow(ctx, AQUA, tipX, tipY, 1.8, 0.4);
    // little branches near the tip
    if (L > 6) {
      ctx.strokeStyle = rgba(DC_C, 0.7);
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      const bx = x + Math.cos(a) * (r * 0.6 + L * 0.72), by = y + Math.sin(a) * (r * 0.6 + L * 0.72);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + 0.7) * L * 0.18, by + Math.sin(a + 0.7) * L * 0.18);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a - 0.6) * L * 0.14, by + Math.sin(a - 0.6) * L * 0.14);
      ctx.stroke();
    }
  });
  // the body: round, pale, its nucleus offset; the mature cell's veils
  if (mature > 0.02) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + time * 0.15;
      const veil = blob(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * (0.75 + 0.15 * Math.sin(time + i)), i + 9, 0.25, 7, a);
      ctx.fillStyle = rgba(DC_C, 0.22 * mature);
      ctx.fill(veil);
    }
  }
  const body = blob(x, y, r, 41, 0.12, 9);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r * 1.1);
  g.addColorStop(0, 'rgba(250,253,255,.98)');
  g.addColorStop(1, rgba(DC_C, 0.92));
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.beginPath();
  ctx.ellipse(x + r * 0.2, y + r * 0.1, r * 0.48, r * 0.36, 0.5, 0, TAU);
  ctx.fillStyle = 'rgba(120,140,220,.75)';
  ctx.fill();
  // the pieces it carries, shown on its surface (violet beads)
  for (let i = 0; i < Math.round(9 * carry); i++) {
    const a = i * 0.7 + 0.4;
    const [px, py] = onRim(x, y, r * 0.98, a);
    ctx.beginPath();
    ctx.arc(px, py, r * 0.11, 0, TAU);
    ctx.fillStyle = rgba(FLAG, 0.95);
    ctx.fill();
    glow(ctx, FLAG, px, py, r * 0.4, 0.3);
  }
  ctx.restore();
}

/** The macrophage: a large, warm, amoeboid cell with a reaching arm towards `dir` (`reach` 0..1), its vacuoles glowing. */
export function macrophage(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dir: number, reach: number, time: number, fed: number): void {
  glow(ctx, MAC_C, x, y, r * 2.4, 0.2 + 0.15 * fed);
  const n = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    let d = r * (1 + 0.12 * Math.sin(a * 3 + time * 0.6) + 0.08 * (hash(i * 5.5) - 0.5));
    const toward = Math.cos(a - dir);
    if (toward > 0.6) d += r * 0.9 * reach * ((toward - 0.6) / 0.4) ** 2;
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  const p = new Path2D();
  const m = (i: number) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2] as const;
  const s = m(n - 1);
  p.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) p.quadraticCurveTo(pts[i][0], pts[i][1], m(i)[0], m(i)[1]);
  p.closePath();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.4);
  g.addColorStop(0, 'rgba(255,226,196,.95)');
  g.addColorStop(0.6, rgba(MAC_C, 0.9));
  g.addColorStop(1, 'rgba(206,120,104,.9)');
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = 'rgba(255,236,214,.7)';
  ctx.lineWidth = 0.5;
  ctx.stroke(p);
  // nucleus and vacuoles (the fed ones glow honey)
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y + r * 0.1, r * 0.38, r * 0.3, 0.4, 0, TAU);
  ctx.fillStyle = 'rgba(150,80,110,.8)';
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = hash(i * 9.1) * TAU, d = r * (0.3 + 0.4 * hash(i * 3.3));
    const vx = x + Math.cos(a) * d, vy = y + Math.sin(a) * d;
    ctx.beginPath();
    ctx.arc(vx, vy, r * (0.07 + 0.05 * hash(i)), 0, TAU);
    ctx.fillStyle = i < Math.round(7 * fed) ? rgba(EATME, 0.8) : 'rgba(170,96,110,.5)';
    ctx.fill();
  }
}

/** A red blood cell: a disc with a paler middle (tilted by `tilt`: 0 face-on, 1 edge-on). */
export function rbc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tilt: number, rot: number): void {
  const ry = r * (1 - 0.7 * tilt);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, r, ry, 0, 0, TAU);
  ctx.fillStyle = rgba(BLOOD, 0.88);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.5, ry * 0.5, 0, 0, TAU);
  ctx.fillStyle = rgba(BLOOD_HI, 0.55);
  ctx.fill();
  ctx.restore();
}

/** An antibody: a small Y of light (`rot` points its arms). */
export function antibody(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, a: number): void {
  if (a <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= a;
  glow(ctx, GOLD_HI, 0, 0, s * 2.2, 0.35);
  ctx.strokeStyle = rgba(GOLD_HI, 0.95);
  ctx.lineWidth = s * 0.28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.lineTo(0, 0);
  ctx.lineTo(-s * 0.75, -s * 0.85);
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.75, -s * 0.85);
  ctx.stroke();
  ctx.restore();
}

/** A soft "checked" mark on a cell the watch has looked at: a thin ring of gold that fades to a quiet glint. */
export function checkedRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fresh: number, keep: number): void {
  if (keep <= 0.01 && fresh <= 0.01) return;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.12, 0, TAU);
  ctx.strokeStyle = rgba(GOLD, 0.25 * keep + 0.6 * fresh);
  ctx.lineWidth = 0.45 + 0.4 * fresh;
  ctx.stroke();
  if (fresh > 0.01) glow(ctx, SELF, x, y, r * 1.8, 0.35 * fresh);
}

// ── baked sprites for many cells at once ────────────────────────
const SPR = 64, SPR_R = 11;
const spriteCache = new Map<string, HTMLCanvasElement | null>();

/** A lymphocyte baked once (64 px) so a crowd of them costs one drawImage each. */
export function lymphSprite(kind: LymphStyle['kind'], gold: number, glowK = 0.3): HTMLCanvasElement | null {
  const key = `${kind}|${gold.toFixed(2)}|${glowK.toFixed(2)}`;
  if (spriteCache.has(key)) return spriteCache.get(key) ?? null;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = SPR;
  const ctx = c.getContext('2d');
  if (!ctx) {
    spriteCache.set(key, null);
    return null;
  }
  lymphocyte(ctx, SPR / 2, SPR / 2, SPR_R, { kind, gold, glow: glowK, seed: 5 });
  spriteCache.set(key, c);
  return c;
}

/** Draw a baked lymphocyte at (x, y) with radius r (world units) and alpha a. */
export function drawSprite(ctx: CanvasRenderingContext2D, s: HTMLCanvasElement | null, x: number, y: number, r: number, a = 1): void {
  if (!s || a <= 0.01) return;
  const h = (r / SPR_R) * (SPR / 2);
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * a;
  ctx.drawImage(s, x - h, y - h, 2 * h, 2 * h);
  ctx.globalAlpha = ga;
}

/** A violet "piece" (a peptide) on its way (along an arm, in lymph). */
export function piece(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a = 1): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = rgba(mix(VIOLET, '#ffffff', 0.2), 0.95 * a);
  ctx.fill();
  glow(ctx, FLAG, x, y, r * 3, 0.35 * a);
}
