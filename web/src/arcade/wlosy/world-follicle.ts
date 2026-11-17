/**
 * One hair follicle in detail (DESIGN.md §15), slanted in the skin as follicles are: drawn in its own frame (geo.ts
 * `folPt`: v across, u down the axis from the opening) — the connective-tissue sheath, the outer root sheath with
 * the bulge where the arrector pili holds on, the sebaceous gland and its duct, the inner root sheath that moulds
 * the hair up to the isthmus, the hair itself (cuticle, cortex, medulla) hardening in the keratogenous zone, and the
 * bulb: the matrix around the papilla, the melanocytes on its top, the capillary loop inside it.  The epidermis lies
 * over the follicle's mouth; the hair leaves the skin on its slant.
 *
 * The follicle's shape follows its cycle (`FolShape`): anagen, catagen (the lower follicle regresses, a club hair
 * forms, the papilla rises under the bulge), telogen, and a new anagen (the bulge's stem cells wake, a new hair
 * grows from below and the old one is let go).
 */
import { clamp, ease } from '../kit/juice';
import { COLOUR, EUMELANIN, PHEOMELANIN, type SceneId } from './content';
import { FOL, FR, FU, folPt, hash, type Pt } from './geo';
import { AQUA, BLOOD, BLOOD_HI, GOLD, GOLD_HI, HONEY, LILAC, PEARL, TAU, glow, glowEllipse, mix, polyAt, rgba, smoothPath } from './paint';
import type { WorldState } from './world';

// ── the still ground around the follicle ─────────────────────────
/**
 * The dermis around the follicle, dark so what lives in it can glow: a deep rose-plum ground, collagen as faint
 * glinting bundles, small vessels warm with blood, fibroblasts, and the fat's lobules deep down where the bulb sits,
 * outlined in soft gold.
 */
export function bakeDermis(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, -10, 0, 150);
  g.addColorStop(0, '#4a1a46');
  g.addColorStop(0.3, '#3a1440');
  g.addColorStop(0.75, '#2a0f33');
  g.addColorStop(1, '#1c0a26');
  ctx.fillStyle = g;
  ctx.fillRect(-160, 0, 320, 170);
  // a breath of warmth from within the tissue
  glow(ctx, '#ff9ab8', -20, 30, 70, 0.1);
  glow(ctx, '#c88cff', 20, 90, 70, 0.08);
  // the fat's lobules deep down: cells with golden rims, a faint light inside
  for (let i = 0; i < 90; i++) {
    const x = -150 + hash(i * 3 + 501) * 300, y = 86 + hash(i * 5 + 502) * 70;
    const r = 2.4 + 2.2 * hash(i * 7 + 503);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.86, hash(i) * 3, 0, TAU);
    ctx.fillStyle = `rgba(255,206,150,${(0.04 + 0.05 * hash(i * 11 + 504)).toFixed(3)})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,160,.2)';
    ctx.lineWidth = 0.22;
    ctx.stroke();
  }
  // collagen: soft bundles that catch the light
  for (let i = 0; i < 150; i++) {
    const x = -150 + hash(i * 19 + 521) * 300, y = 6 + hash(i * 23 + 522) * 140;
    const l = 7 + 12 * hash(i + 523), a = (hash(i * 29 + 524) - 0.5) * 0.8;
    ctx.strokeStyle = i % 4 ? 'rgba(255,170,214,.09)' : 'rgba(255,214,236,.16)';
    ctx.lineWidth = i % 4 ? 0.5 : 0.22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + l * 0.3, y - 1.2 + a * 3, x + l * 0.65, y + 1.2 + a * 3, x + l, y + a * 6);
    ctx.stroke();
  }
  // small vessels of the dermis, warm and quiet
  const op = ctx.globalCompositeOperation;
  for (let i = 0; i < 12; i++) {
    const x = -140 + i * 26 + 8 * hash(i + 530);
    const p = new Path2D();
    p.moveTo(x, 150);
    p.bezierCurveTo(x + 10, 100, x - 8, 50, x + 6, 8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,70,100,.13)';
    ctx.lineWidth = 1.6;
    ctx.stroke(p);
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = 'rgba(255,130,140,.3)';
    ctx.lineWidth = 0.35;
    ctx.stroke(p);
  }
  ctx.fillStyle = 'rgba(214,170,255,.22)';
  for (let i = 0; i < 80; i++) {
    ctx.beginPath();
    ctx.ellipse(-150 + hash(i * 31 + 541) * 300, 8 + hash(i * 37 + 542) * 140, 0.85, 0.38, hash(i) * 3, 0, TAU);
    ctx.fill();
  }
}

/** The epidermis over the follicle's mouth (drawn over the follicle): luminous, its cells, its pale horny layer, the surface. */
export function bakeEpidermis(ctx: CanvasRenderingContext2D): void {
  const p = epiPath();
  const g = ctx.createLinearGradient(0, 0, 0, 6.2);
  g.addColorStop(0, 'rgba(255,236,226,.95)');
  g.addColorStop(0.25, 'rgba(255,198,190,.86)');
  g.addColorStop(1, 'rgba(226,120,160,.7)');
  ctx.fillStyle = g;
  ctx.fill(p, 'evenodd');
  ctx.save();
  ctx.clip(p, 'evenodd');
  // its cells: soft and bright, a darker nucleus each, flatter toward the surface
  for (let i = 0; i < 520; i++) {
    const x = -160 + hash(i * 41 + 551) * 320, y = 1 + hash(i * 43 + 552) * 4.6;
    const flat = 1 - y / 5.6;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.75 + 0.5 * flat, 0.62 - 0.3 * flat, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,240,236,.22)';
    ctx.fill();
    if (y > 2.2) {
      ctx.beginPath();
      ctx.arc(x, y, 0.22, 0, TAU);
      ctx.fillStyle = 'rgba(160,80,140,.35)';
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255,250,246,.55)';
  ctx.fillRect(-160, 0, 320, 0.7);
  ctx.restore();
  glow(ctx, '#fff0e6', FOL.ox - 30, 1.5, 26, 0.12);
  glow(ctx, '#fff0e6', FOL.ox + 30, 1.5, 26, 0.12);
  ctx.strokeStyle = 'rgba(255,246,236,.9)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  const [lx] = folPt(-5.6, 0), [rx] = folPt(5.6, 0);
  ctx.moveTo(-160, 0);
  ctx.lineTo(lx, 0);
  ctx.moveTo(rx, 0);
  ctx.lineTo(160, 0);
  ctx.stroke();
}

/** The epidermis band with the follicle's mouth cut out of it (the outer root sheath carries on into it). */
function epiPath(): Path2D {
  const p = new Path2D();
  p.moveTo(-160, 0);
  for (let x = -160; x <= 160; x += 1.5) p.lineTo(x, 5.2 + 0.75 * Math.sin(x * 0.5));
  p.lineTo(160, 0);
  p.closePath();
  // the mouth: the canal's funnel through the epidermis
  const a = folPt(-5.4, -1), b = folPt(5.4, -1), c = folPt(4.6, 7), d = folPt(-4.6, 7);
  p.moveTo(a[0], a[1]);
  p.lineTo(b[0], b[1]);
  p.lineTo(c[0], c[1]);
  p.lineTo(d[0], d[1]);
  p.closePath();
  return p;
}

// ── the follicle's shape through its cycle ───────────────────────
export interface FolShape {
  /** the bulb's bottom (u): anagen FU.bottom, telogen ≈ FU.telogen */
  len: number;
  /** the bulb (1 an anagen bulb … 0 none) */
  bulb: number;
  /** the papilla's middle (u) and its size (1 anagen … ≈ 0.6 a resting ball) */
  papU: number;
  papR: number;
  /** the hair: its tip (u, negative above the skin), its base (u), a club end instead of the bulb's cone */
  tip: number;
  base: number;
  club: boolean;
  /** an old club hair beside a new one (its base u, how far it has been let go 0..1), or none */
  old: { base: number; out: number } | null;
  /** the epithelial strand between a regressing hair and its papilla (0..1) */
  strand: number;
  /** stem cells awake in the bulge (0..1), the hair germ (0..1) */
  stem: number;
  germ: number;
}

const ANAGEN: FolShape = { len: FU.bottom, bulb: 1, papU: FU.papMid - 1.5, papR: 1, tip: FU.tip, base: FU.neck, club: false, old: null, strand: 0, stem: 0, germ: 0 };

/** The follicle's shape in a scene at a growth: anagen everywhere, but through catagen into telogen, and a new anagen. */
export function shapeFor(scene: SceneId, g: number): FolShape {
  if (scene === 'katagen') {
    const k1 = ease.inOutSine(clamp(g / 0.62));
    const len = FU.bottom + (FU.telogen - FU.bottom) * k1;
    return {
      len, bulb: 1 - k1, papU: len - 3.2 - 3 * (1 - k1), papR: 1 - 0.38 * k1, tip: FU.tip, base: FU.neck + (FU.bulge + 3 - FU.neck) * k1,
      club: k1 > 0.55, old: null, strand: Math.sin(Math.PI * clamp((k1 - 0.15) / 0.85)), stem: 0, germ: 0,
    };
  }
  if (scene === 'nowy') {
    const wake = clamp(g / 0.2);
    const down = ease.inOutSine(clamp((g - 0.15) / 0.6));
    const len = FU.telogen + (FU.bottom - FU.telogen) * down;
    const rise = ease.outCubic(clamp((g - 0.32) / 0.62));
    const out = ease.inOutSine(clamp((g - 0.55) / 0.42));
    return {
      len, bulb: down, papU: len - 3.2 - 3 * down, papR: 0.62 + 0.38 * down,
      tip: down > 0.35 ? (len - 26) + (-10 - (len - 26)) * rise : len + 1, base: len - 22,
      club: false, old: { base: FU.bulge + 3, out }, strand: 0, stem: wake * (1 - 0.6 * down), germ: wake * (1 - down),
    };
  }
  return ANAGEN;
}

// ── the outlines in the follicle's frame ─────────────────────────
const BULB_R: readonly Pt[] = [[7.6, 73], [8.9, 77.5], [11.2, 83.5], [12.7, 89.5], [12.5, 95.2], [10.2, 99.6], [5.6, 101.8], [2.6, 102]];
const PAP_R: readonly Pt[] = [[2.5, 101.8], [4.4, 99.6], [6, 96], [5.9, 92], [4.2, 88], [2, 85], [0, 83.5]];

/** A closed outline from a right half (v ≥ 0) mirrored to the left, scaled about its top by `s` (u from `u0`). */
function mirrored(right: readonly Pt[], shiftU = 0, s = 1, u0 = right[0][1]): Path2D {
  const pts: Pt[] = right.map(([v, u]) => [v * s, u0 + (u - u0) * s + shiftU]);
  const left: Pt[] = [...pts].reverse().map(([v, u]) => [-v, u]);
  const p = new Path2D();
  smoothPath(p, [...left, ...pts]);
  p.closePath();
  return p;
}

/** The matrix's cells round the papilla (two rings, the bottom left open for the stalk), in the follicle's frame. */
export function matrixCells(papU: number, k = 1): Pt[] {
  const out: Pt[] = [];
  for (const [r, n] of [[7.4 * k, 12], [10 * k, 15]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (115 + (i + 0.5) * (310 / n)) * (Math.PI / 180);
      out.push([Math.cos(a) * r, papU + Math.sin(a) * r * 1.05]);
    }
  }
  return out;
}

/** The melanocytes on the papilla's top: an arc of dendritic cells (their bodies), in the follicle's frame. */
export function melanocytes(papU: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (-162 + i * 24) * (Math.PI / 180);
    out.push([Math.cos(a) * 6.5, papU + Math.sin(a) * 7]);
  }
  return out;
}

/** The capillary loop inside the papilla: up one side from the stalk, round near the apex, down the other. */
export function loopPts(papU: number): Pt[] {
  return [[-1.2, papU + 14], [-1.4, papU + 8.5], [-1.9, papU + 3], [-1.4, papU - 2.5], [0, papU - 4.2], [1.4, papU - 2.5], [1.9, papU + 3], [1.4, papU + 8.5], [1.2, papU + 14]];
}

// ── drawing ──────────────────────────────────────────────────────
/** Into the follicle's frame (the caller restores). */
function frame(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(FOL.ox, FOL.oy);
  ctx.rotate(FOL.th);
}

/**
 * The follicle under the epidermis: the arrector pili, the sheaths, the gland, the hair below the skin, the bulb with
 * the papilla — and each scene's own light on it.
 */
export function drawFollicleUnder(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const sh = shapeFor(st.scene, st.g);
  const col = COLOUR[st.colour];
  muscle(ctx, st);
  frame(ctx);
  const lower = Math.max(sh.len - 4, 40);
  const orsTo = sh.bulb > 0.2 ? Math.min(lower, FU.neck - 2 + (sh.len - FU.bottom)) : lower;
  // a soft light all along the follicle, as if lit from within
  glowEllipse(ctx, '#f0c8ff', 0, lower / 2, FR.cts * 2.2, lower * 0.62, 0, 0.12 + 0.08 * st.deep);
  // the outer root sheath (with the bulge's swell on the gland's side): translucent pearl, a bright rim
  const ors = new Path2D();
  ors.moveTo(-FR.ors, -2);
  ors.lineTo(-FR.ors, orsTo);
  ors.lineTo(FR.ors, orsTo);
  ors.lineTo(FR.ors, FU.bulge + 6);
  ors.quadraticCurveTo(FR.bulgeOut, FU.bulge, FR.ors, FU.bulge - 6);
  ors.lineTo(FR.ors, -2);
  ors.closePath();
  const og = ctx.createLinearGradient(-FR.ors, 0, FR.ors, 0);
  og.addColorStop(0, 'rgba(246,224,255,.42)');
  og.addColorStop(0.3, 'rgba(236,206,250,.2)');
  og.addColorStop(0.7, 'rgba(236,206,250,.2)');
  og.addColorStop(1, 'rgba(246,224,255,.42)');
  ctx.fillStyle = og;
  ctx.fill(ors);
  // the connective-tissue sheath around it: a violet line of light
  ctx.beginPath();
  ctx.moveTo(-FR.cts, 0);
  ctx.lineTo(-FR.cts, orsTo);
  ctx.moveTo(FR.cts, 0);
  ctx.lineTo(FR.cts, FU.bulge - 6);
  ctx.quadraticCurveTo(FR.bulgeOut + 1.2, FU.bulge, FR.cts, FU.bulge + 6);
  ctx.lineTo(FR.cts, orsTo);
  ctx.strokeStyle = 'rgba(190,140,255,.22)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,206,255,.55)';
  ctx.lineWidth = 0.28;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,255,.5)';
  ctx.lineWidth = 0.3;
  ctx.stroke(ors);
  // the gland's lobes and its duct into the canal
  gland(ctx, st);
  // the canal (between the hair and the sheath), widening toward the mouth
  ctx.beginPath();
  ctx.moveTo(-5.6, -2);
  ctx.lineTo(-4.3, FU.duct);
  ctx.lineTo(-4.6, FU.isthmus);
  ctx.lineTo(4.6, FU.isthmus);
  ctx.lineTo(4.3, FU.duct);
  ctx.lineTo(5.6, -2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(30,10,36,.55)';
  ctx.fill();
  // the inner root sheath: rose, from the bulb up to the isthmus (it is shed there); its layers as fine lines
  const irsTo = sh.club ? Math.min(sh.base, sh.len - 6) : sh.bulb > 0.2 ? FU.neck + 1 : sh.len - 4;
  if (irsTo > FU.isthmus + 1) {
    const ig = ctx.createLinearGradient(-FR.irs, 0, FR.irs, 0);
    ig.addColorStop(0, 'rgba(255,150,190,.62)');
    ig.addColorStop(0.5, 'rgba(255,110,160,.4)');
    ig.addColorStop(1, 'rgba(255,150,190,.62)');
    // it narrows into the bulb, where its cells are born from the matrix
    const taper = sh.bulb > 0.2 ? 6 : 1.5;
    const irs = new Path2D();
    irs.moveTo(-FR.irs, FU.isthmus);
    irs.lineTo(-FR.irs, irsTo - taper);
    irs.quadraticCurveTo(-FR.irs, irsTo, -FR.shaft * 1.05, irsTo + 1);
    irs.lineTo(FR.shaft * 1.05, irsTo + 1);
    irs.quadraticCurveTo(FR.irs, irsTo, FR.irs, irsTo - taper);
    irs.lineTo(FR.irs, FU.isthmus);
    irs.closePath();
    ctx.fillStyle = ig;
    ctx.fill(irs);
    ctx.strokeStyle = 'rgba(255,214,230,.55)';
    ctx.lineWidth = 0.18;
    for (const v of [-FR.irs, -3.9, 3.9, FR.irs]) {
      ctx.beginPath();
      ctx.moveTo(v, FU.isthmus + 1);
      ctx.lineTo(v, irsTo - taper);
      ctx.stroke();
    }
  }
  // the bulb with its matrix (shrinking in catagen): lit from within around the papilla
  if (sh.bulb > 0.03) {
    const s = 0.45 + 0.55 * sh.bulb;
    const bulb = mirrored(BULB_R, sh.len - FU.bottom, s, FU.bottom);
    glow(ctx, '#ffc6a8', 0, sh.papU - 1, 22 * s, 0.32 + 0.15 * st.deep);
    const bg = ctx.createRadialGradient(0, sh.papU - 2, 1, 0, sh.papU, 13.5 * s);
    bg.addColorStop(0, 'rgba(255,238,222,.95)');
    bg.addColorStop(0.55, 'rgba(255,196,176,.72)');
    bg.addColorStop(1, 'rgba(240,140,150,.42)');
    ctx.fillStyle = bg;
    ctx.fill(bulb);
    ctx.strokeStyle = 'rgba(255,236,228,.7)';
    ctx.lineWidth = 0.32;
    ctx.stroke(bulb);
    // the matrix's cells: soft and bright, a darker nucleus each
    const cells = matrixCells(sh.papU, s);
    for (let i = 0; i < cells.length; i++) {
      const [v, u] = cells[i];
      ctx.beginPath();
      ctx.arc(v, u, 1.2 * s, 0, TAU);
      ctx.fillStyle = 'rgba(255,244,236,.28)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(v + 0.15, u + 0.1, 0.42 * s, 0, TAU);
      ctx.fillStyle = 'rgba(170,80,120,.38)';
      ctx.fill();
    }
  }
  // the hair below the skin (its living cone in the bulb, then the hardening zone, then the hard hair)
  hairBelow(ctx, sh, st, col);
  if (sh.old) oldClub(ctx, sh.old, col, true);
  // the papilla: magenta glowing from within, its fibroblasts, its loop (a resting ball in telogen)
  const pap = mirrored(PAP_R, sh.papU - (FU.papMid - 1.5), sh.papR, FU.papMid);
  glow(ctx, '#d58cff', 0, sh.papU + 1, 10 * sh.papR, 0.4 + 0.15 * st.deep);
  const pg = ctx.createRadialGradient(0, sh.papU - 1, 0.5, 0, sh.papU + 1, 7 * sh.papR);
  pg.addColorStop(0, 'rgba(236,160,250,.96)');
  pg.addColorStop(1, 'rgba(150,64,196,.92)');
  ctx.fillStyle = pg;
  ctx.fill(pap);
  ctx.strokeStyle = 'rgba(250,220,255,.75)';
  ctx.lineWidth = 0.3;
  ctx.stroke(pap);
  ctx.fillStyle = 'rgba(80,24,110,.55)';
  for (let i = 0; i < 10; i++) {
    const a = hash(i * 7 + 81) * TAU, r = (0.8 + 3.4 * Math.sqrt(hash(i * 11 + 82))) * sh.papR;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r, sh.papU + 1.6 + Math.sin(a) * r * 1.25, 0.6 * sh.papR, 0.26 * sh.papR, a, 0, TAU);
    ctx.fill();
  }
  const loop = new Path2D();
  smoothPath(loop, loopPts(sh.papU).map(([v, u]) => [v * sh.papR, sh.papU + (u - sh.papU) * sh.papR]));
  ctx.strokeStyle = 'rgba(255,90,120,.5)';
  ctx.lineWidth = 0.5;
  ctx.stroke(loop);
  if (sh.strand > 0.02) {
    // the epithelial strand: a thin cord the papilla rises with
    ctx.strokeStyle = rgba('#ffd0dc', 0.6 * sh.strand);
    ctx.lineWidth = 1.2 * sh.strand + 0.3;
    ctx.beginPath();
    ctx.moveTo(0, sh.base + 1.5);
    ctx.lineTo(0, sh.papU - 3 * sh.papR);
    ctx.stroke();
  }
  sceneUnder(ctx, sh, st, col);
  ctx.restore();
}

/** The hair's fill across its width (the follicle's frame): darker edges, a sheen to one side — a tube of colour. */
function shaftFill(ctx: CanvasRenderingContext2D, col: { strand: string; sheen: string }): CanvasGradient {
  const r = FR.shaft;
  const g = ctx.createLinearGradient(-r, 0, r, 0);
  g.addColorStop(0, mix(col.strand, '#140812', 0.35));
  g.addColorStop(0.32, mix(col.strand, col.sheen, 0.42));
  g.addColorStop(0.6, col.strand);
  g.addColorStop(1, mix(col.strand, '#140812', 0.4));
  return g;
}

/** The hair below the skin: the cone of living cells, the hardening zone (rose to the hair's colour), the hard hair. */
function hairBelow(ctx: CanvasRenderingContext2D, sh: FolShape, st: WorldState, col: { strand: string; sheen: string }): void {
  const top = Math.max(-1, sh.tip);
  const base = sh.base;
  if (base <= top) return;
  const r = FR.shaft;
  // the colour rises with the scene "your colour"; elsewhere the hair is coloured to its base
  const colourTo = st.scene === 'barwa' ? FU.neck + (FU.tip - FU.neck) * ease.inOutSine(clamp(st.g)) : -999;
  const hard = Math.min(base, FU.kerTop);
  const g = ctx.createLinearGradient(0, hard, 0, base);
  g.addColorStop(0, col.strand);
  g.addColorStop(1, 'rgba(255,214,200,.9)');
  if (!sh.club && base > FU.kerTop) {
    // the hardening zone and the cone into the matrix
    ctx.beginPath();
    ctx.moveTo(-r, FU.kerTop);
    ctx.lineTo(-r, Math.min(base, FU.neck));
    if (base > FU.neck) ctx.quadraticCurveTo(-r * 1.8, base - 2, 0, base + 2);
    if (base > FU.neck) ctx.quadraticCurveTo(r * 1.8, base - 2, r, Math.min(base, FU.neck));
    ctx.lineTo(r, FU.kerTop);
    ctx.closePath();
    const kg = ctx.createLinearGradient(0, FU.kerTop, 0, FU.kerBottom + 3);
    kg.addColorStop(0, st.scene === 'barwa' && colourTo > FU.kerTop ? 'rgba(255,222,206,.95)' : col.strand);
    kg.addColorStop(0.55, mix(col.strand, '#ffd8c8', 0.6));
    kg.addColorStop(1, 'rgba(255,226,214,.95)');
    ctx.fillStyle = kg;
    ctx.fill();
  }
  // the keratogenous zone's light: gold while the hair grows
  if (!sh.club && base > FU.kerTop) glowEllipse(ctx, GOLD, 0, (FU.kerTop + FU.kerBottom) / 2, r * 2.6, 12, 0, 0.14 + (st.growing ? 0.3 * st.light : 0));
  // the hard hair up to the mouth: a tube of colour with its sheen
  const pale = 'rgba(255,232,222,.92)';
  ctx.fillStyle = st.scene === 'barwa' ? pale : shaftFill(ctx, col);
  ctx.fillRect(-r, top, 2 * r, hard - top);
  if (st.scene === 'barwa' && colourTo < FU.kerTop) {
    ctx.fillStyle = shaftFill(ctx, col);
    ctx.fillRect(-r, Math.max(top, colourTo), 2 * r, hard - Math.max(top, colourTo));
    glow(ctx, GOLD_HI, 0, Math.max(top, colourTo), 4.5, 0.7);
  }
  // the cuticle's edge and the sheen of the cortex, the medulla's beads in the middle
  ctx.strokeStyle = rgba(col.sheen, 0.55);
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(-r, top);
  ctx.lineTo(-r, hard);
  ctx.moveTo(r, top);
  ctx.lineTo(r, hard);
  ctx.stroke();
  ctx.fillStyle = rgba(mix(col.strand, '#ffffff', 0.35), 0.35);
  for (let u = Math.ceil(top) + 1; u < Math.min(hard, FU.kerTop + 4); u += 2.2) {
    ctx.beginPath();
    ctx.ellipse(0, u, FR.medulla * 0.7, 0.75, 0, 0, TAU);
    ctx.fill();
  }
  if (sh.club) {
    // the club: a rounded brush of keratin at the hair's end
    ctx.beginPath();
    ctx.ellipse(0, base, r * 1.35, 2.6, 0, 0, TAU);
    ctx.fillStyle = mix(col.strand, '#f6e2d0', 0.45);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,230,.5)';
    ctx.lineWidth = 0.25;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 0.9, base - 1.5);
      ctx.lineTo(k * 1.2, base + 2.2);
      ctx.stroke();
    }
  }
}

/** An old club hair being let go: it slides up the canal and out of the skin (`above` draws its part over the epidermis). */
function oldClub(ctx: CanvasRenderingContext2D, o: { base: number; out: number }, col: { strand: string; sheen: string }, below: boolean): void {
  const shift = -o.out * (o.base + 30);
  const base = o.base + shift, tip = FU.tip + shift;
  const a = 1 - clamp((o.out - 0.85) / 0.15);
  if (a <= 0.01) return;
  const v = -1.6;
  const from = below ? Math.max(tip, 0) : tip, to = below ? base : Math.min(base, 0);
  if (to <= from) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = mix(col.strand, '#e8d8d0', 0.15);
  ctx.fillRect(v - 2.2, from, 4.4, to - from);
  ctx.strokeStyle = rgba(col.sheen, 0.5);
  ctx.lineWidth = 0.25;
  ctx.strokeRect(v - 2.2, from, 4.4, to - from);
  if (below || base < 0) {
    ctx.beginPath();
    ctx.ellipse(v, base, 3, 2.4, 0, 0, TAU);
    ctx.fillStyle = mix(col.strand, '#f6e2d0', 0.45);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The arrector pili: from the bulge down under the gland up to the epidermis on the obtuse side (world units). */
function muscle(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const a = folPt(FR.ors + 1.4, FU.bulge + 1), b: Pt = [FOL.ox + 30, 5.6];
  const c: Pt = [FOL.ox + 15, FU.bulge - 2];
  const p = new Path2D();
  p.moveTo(a[0], a[1]);
  p.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  ctx.lineCap = 'round';
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,110,110,.16)';
  ctx.lineWidth = 4.4;
  ctx.stroke(p);
  ctx.globalCompositeOperation = op;
  ctx.strokeStyle = 'rgba(255,150,140,.42)';
  ctx.lineWidth = 2.4;
  ctx.stroke(p);
  // its smooth muscle cells: spindles along it
  ctx.strokeStyle = 'rgba(255,226,214,.5)';
  ctx.lineWidth = 0.22;
  ctx.setLineDash([1.8, 1.1]);
  ctx.stroke(p);
  ctx.setLineDash([]);
  if (st.deep > 0.05) glow(ctx, '#ffb39a', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 3, 9, 0.12 * st.deep);
}

/** The sebaceous gland: three lobes of sebocytes by the canal, their duct; in "sebum" they fill with gold. */
function gland(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const fill = st.scene === 'sebum' ? clamp(st.g / 0.55) : 0.35;
  const lobes: readonly (readonly [number, number, number])[] = [[13.6, 20.5, 5.2], [16.2, 26.8, 4.3], [11.4, 27.8, 3.7]];
  glow(ctx, HONEY, 13.8, 24, 12, 0.18 + 0.3 * fill + 0.1 * st.deep);
  for (const [v, u, r] of lobes) {
    const g = ctx.createRadialGradient(v - r * 0.3, u - r * 0.3, 0.3, v, u, r);
    g.addColorStop(0, rgba('#fff2cf', 0.55 + 0.35 * fill));
    g.addColorStop(1, rgba(mix('#e6a85a', HONEY, fill), 0.32 + 0.3 * fill));
    ctx.beginPath();
    ctx.arc(v, u, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,206,.7)';
    ctx.lineWidth = 0.28;
    ctx.stroke();
    // its cells (sebocytes), swelling toward the middle as they fill
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + v;
      const rr = r * (k === 6 ? 0 : 0.56);
      ctx.beginPath();
      ctx.arc(v + Math.cos(a) * rr, u + Math.sin(a) * rr, 0.7 + 0.55 * fill, 0, TAU);
      ctx.fillStyle = rgba('#fffaf0', 0.2 + 0.35 * fill);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(255,214,140,.55)';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(10, 19);
  ctx.quadraticCurveTo(7, 17, 4.4, FU.duct);
  ctx.stroke();
}

/** Each scene's light under the epidermis, in the follicle's frame. */
function sceneUnder(ctx: CanvasRenderingContext2D, sh: FolShape, st: WorldState, col: { strand: string; sheen: string; eu: number; dens: number }): void {
  const { scene, g, time } = st;
  const papU = sh.papU;
  const beat = st.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * TAU);
  if (scene === 'brodawka' || scene === 'korzenie') {
    // the papilla's cells light one by one; the papilla glows from within
    const n = 14, lit = g * n;
    for (let i = 0; i < n; i++) {
      const a = hash(i * 3 + 7) * TAU, r = 1 + 3.6 * Math.sqrt(hash(i * 5 + 8));
      const v = Math.cos(a) * r, u = papU + 1.5 + Math.sin(a) * r * 1.3;
      const k = clamp(lit - i);
      ctx.beginPath();
      ctx.arc(v, u, 0.75, 0, TAU);
      ctx.fillStyle = rgba(mix('#e0b0f0', GOLD_HI, k), 0.35 + 0.6 * k);
      ctx.fill();
      if (k > 0 && k < 1) glow(ctx, GOLD_HI, v, u, 2.4, 0.6);
    }
    glow(ctx, '#e7a0ff', 0, papU + 1, 9 + 4 * g, 0.25 + 0.35 * g + 0.2 * st.deep);
  }
  if (scene === 'petla') {
    // the capillary loop fills with warm blood; cells of blood flow round it
    const pts = loopPts(papU);
    const p = new Path2D();
    smoothPath(p, pts);
    const k = ease.inOutSine(clamp(g));
    ctx.setLineDash([40 * k, 80]);
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(BLOOD, 0.4 + 0.15 * beat);
    ctx.lineWidth = 2.6;
    ctx.stroke(p);
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = rgba(BLOOD_HI, 0.95);
    ctx.lineWidth = 0.9;
    ctx.stroke(p);
    ctx.setLineDash([]);
    for (let j = 0; j < 7; j++) {
      const q = ((time * 0.18 + j / 7) % 1) * k;
      const [v, u] = polyAt(pts, q);
      ctx.beginPath();
      ctx.ellipse(v, u, 0.55, 0.38, q * 9, 0, TAU);
      ctx.fillStyle = '#ff6a7c';
      ctx.fill();
    }
    glow(ctx, '#ffb0a0', 0, papU, 8, 0.25 + 0.3 * k + 0.15 * st.deep);
  }
  if (scene === 'sygnaly' || scene === 'podzial') {
    const cells = matrixCells(papU);
    const lit = g * cells.length;
    // the matrix cells answer one by one: lit, and (dividing) splitting in two
    for (let i = 0; i < cells.length; i++) {
      const [v, u] = cells[i];
      const k = clamp(lit - i);
      if (k <= 0) continue;
      if (scene === 'podzial') {
        // a cell dividing: it lengthens and pinches into two (once), then rests as two
        const d = clamp((lit - i) * 1.6);
        const ang = Math.atan2(u - papU, v);
        const sep = 0.9 * ease.outCubic(d);
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(v + Math.cos(ang) * sep * s * 0.5, u + Math.sin(ang) * sep * s * 0.5, 1.05, 0, TAU);
          ctx.fillStyle = rgba(mix('#ffc2a6', GOLD_HI, 0.5 * k), 0.55 + 0.35 * k);
          ctx.fill();
        }
        if (d < 1) glow(ctx, GOLD_HI, v, u, 3, 0.7 * (1 - d));
      } else {
        ctx.beginPath();
        ctx.arc(v, u, 1.25, 0, TAU);
        ctx.fillStyle = rgba(mix('#ffc2a6', GOLD_HI, 0.6), 0.45 + 0.45 * k);
        ctx.fill();
        if (k < 1) glow(ctx, GOLD_HI, v, u, 3.2, 0.8);
      }
    }
    if (scene === 'sygnaly') {
      // signals: soft rings from the papilla, and packets of light to the cells it reaches
      for (let j = 0; j < 3; j++) {
        const q = (time * 0.45 + j / 3) % 1;
        ctx.strokeStyle = rgba('#f3c6ff', 0.5 * (1 - q) * (0.4 + 0.6 * g));
        ctx.lineWidth = 0.35;
        ctx.beginPath();
        ctx.ellipse(0, papU + 1, 4 + 7 * q, 5 + 7.5 * q, 0, 0, TAU);
        ctx.stroke();
      }
      const n = Math.floor(lit);
      for (let i = 0; i < Math.min(n + 1, cells.length); i++) {
        const q = (time * 0.6 + i * 0.37) % 1;
        const [v, u] = cells[i];
        glow(ctx, GOLD_HI, v * q, papU + (u - papU) * q, 1.4, 0.65);
      }
    } else {
      // new cells pushed up into the hair's cone
      for (let j = 0; j < 6; j++) {
        const q = ((time * 0.12 * (st.growing ? 1 : 0.15) + j / 6) % 1);
        const u = FU.papApex - 2 - q * 12;
        ctx.beginPath();
        ctx.arc((hash(j) - 0.5) * 3, u, 0.9 * (1 - 0.4 * q), 0, TAU);
        ctx.fillStyle = rgba('#ffd6c4', 0.55 * (1 - q) * Math.min(1, g * 4));
        ctx.fill();
      }
    }
    glow(ctx, '#ffd0b0', 0, papU, 13, 0.18 + 0.25 * g + 0.15 * st.deep);
  }
  if (scene === 'melanocyty' || scene === 'melanina' || scene === 'barwa') {
    const mels = melanocytes(papU);
    const showN = scene === 'melanocyty' ? g * mels.length : mels.length;
    const active = Math.max(1, Math.round(mels.length * Math.max(0.3, col.dens)));
    for (let i = 0; i < mels.length; i++) {
      const k = clamp(showN - i);
      if (k <= 0) continue;
      const [v, u] = mels[i];
      const on = i < active;
      const dir = Math.atan2(u - papU, v);
      // the dendrites reach up to the new cells over the papilla
      ctx.strokeStyle = rgba(on ? '#5a3424' : '#9a8a9a', (0.5 + 0.4 * k) * (on ? 1 : 0.6));
      ctx.lineWidth = 0.32;
      for (let d = -1; d <= 1; d++) {
        const a = dir + d * 0.45;
        const L = (2.6 + 1.2 * hash(i * 5 + d)) * ease.outCubic(k);
        ctx.beginPath();
        ctx.moveTo(v, u);
        ctx.quadraticCurveTo(v + Math.cos(a) * L * 0.6 + 0.4 * d, u + Math.sin(a) * L * 0.6, v + Math.cos(a - 0.2 * d) * L, u + Math.sin(a - 0.2 * d) * L - 1.2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(v, u, 1.25, 0.85, dir, 0, TAU);
      ctx.fillStyle = on ? mix('#6a3a2a', col.eu > 0.5 ? EUMELANIN : PHEOMELANIN, 0.4) : 'rgba(170,160,176,.7)';
      ctx.fill();
      if (on) glow(ctx, '#ffb36a', v, u, 2.6, (scene === 'melanocyty' ? 0.55 : 0.3) * k);
    }
    if (scene === 'melanina') {
      // granules of pigment travel along the dendrites into the new cells above; the cells take the colour
      const n = Math.round(24 * Math.max(0.15, col.dens));
      for (let j = 0; j < n; j++) {
        const m = mels[j % active];
        const q = ((time * 0.22 + hash(j * 3 + 1)) % 1);
        const k = clamp(g * 1.3 - hash(j * 7 + 2) * 0.5);
        if (k <= 0) continue;
        const v = m[0] * (1 - q) + (hash(j * 11) - 0.5) * 3 * q, u = m[1] + (FU.papApex - 6 - m[1]) * q;
        const eu = hash(j * 13 + 4) < col.eu;
        ctx.beginPath();
        ctx.ellipse(v, u, eu ? 0.42 : 0.34, eu ? 0.26 : 0.34, 0.6, 0, TAU);
        ctx.fillStyle = rgba(eu ? EUMELANIN : PHEOMELANIN, 0.9 * k);
        ctx.fill();
      }
      // the new cells over the papilla take the colour: a soft tint, deepest in the middle
      const tg = ctx.createRadialGradient(0, FU.papApex - 5, 0.3, 0, FU.papApex - 5, 4.6);
      tg.addColorStop(0, rgba(col.strand, (0.2 + 0.45 * clamp(g)) * Math.max(0.25, col.dens)));
      tg.addColorStop(1, rgba(col.strand, 0));
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.ellipse(0, FU.papApex - 5, 4.6, 4.6, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (scene === 'twardnienie') {
    // cells rise from the bulb and harden: the gold front of keratin climbs; the cuticle's scales, the cortex, the medulla appear
    const front = FU.kerBottom + 2 + (FU.kerTop - 6 - (FU.kerBottom + 2)) * ease.inOutSine(clamp(g));
    const r = FR.shaft;
    for (let j = 0; j < 14; j++) {
      const q = ((time * 0.05 * (st.growing ? 1 : 0.2) + j / 14) % 1);
      const u = FU.kerBottom + 4 - q * 26;
      const flat = clamp((FU.kerBottom + 2 - u) / 18);
      for (const v of [-1.7, 0, 1.7]) {
        ctx.beginPath();
        ctx.ellipse(v * (1 - 0.15 * flat), u, 0.9 - 0.25 * flat, 0.9 + 0.6 * flat, 0, 0, TAU);
        ctx.fillStyle = rgba(u < front ? mix(col.strand, GOLD_HI, 0.25) : '#ffe4d8', u < front ? 0.75 : 0.55);
        ctx.fill();
      }
    }
    glow(ctx, GOLD, 0, front, 5.5, 0.55 + 0.25 * st.light);
    // the cuticle's scales along both edges, like roof tiles, above the front
    ctx.strokeStyle = rgba(GOLD_HI, 0.7);
    ctx.lineWidth = 0.22;
    for (let u = front; u > FU.kerTop - 14; u -= 1.6) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r, u);
        ctx.lineTo(s * (r - 0.8), u - 1.1);
        ctx.stroke();
      }
    }
    if (g > 0.7) {
      ctx.fillStyle = rgba('#fff2e0', 0.55 * clamp((g - 0.7) / 0.3));
      for (let u = front; u > FU.kerTop - 14; u -= 1.8) {
        ctx.beginPath();
        ctx.ellipse(0, u, 0.55, 0.7, 0, 0, TAU);
        ctx.fill();
      }
    }
  }
  if (scene === 'anagen') {
    glow(ctx, GOLD, 0, papU - 4, 12, 0.2 + 0.3 * st.light * (st.growing ? 1 : 0.4) + 0.15 * st.deep);
  }
  if (scene === 'katagen') {
    // catagen's quiet clearing: soft bubbles where the lower follicle withdraws; then rest
    const k1 = clamp(g / 0.62);
    for (let j = 0; j < 9; j++) {
      const q = (time * 0.1 + j / 9) % 1;
      const u = sh.len + 4 + 30 * (1 - k1) * hash(j * 7 + 1);
      ctx.beginPath();
      ctx.arc((hash(j * 3) - 0.5) * 12, u - q * 4, 0.8 + 0.6 * hash(j), 0, TAU);
      ctx.fillStyle = rgba(PEARL, 0.35 * Math.sin(Math.PI * k1) * (1 - q));
      ctx.fill();
    }
    if (g > 0.62) glow(ctx, LILAC, 0, sh.base, 10, 0.3 * clamp((g - 0.62) / 0.38) + 0.15 * st.deep);
  }
  if (scene === 'nowy' || scene === 'bariera') {
    // the bulge's stem cells wake (aqua), the germ below the club; in the barrier they send cells up to mend the skin
    const wake = scene === 'nowy' ? sh.stem : 0.4 + 0.6 * clamp(g / 0.4);
    for (let i = 0; i < 6; i++) {
      const v = FR.ors + 0.6 + 1.6 * hash(i * 3 + 9), u = FU.bulge - 4 + 8 * hash(i * 5 + 10);
      ctx.beginPath();
      ctx.arc(v, u, 0.85, 0, TAU);
      ctx.fillStyle = rgba(AQUA, 0.35 + 0.55 * wake);
      ctx.fill();
      glow(ctx, AQUA, v, u, 2.8, 0.5 * wake);
    }
    if (scene === 'nowy' && sh.germ > 0.02) glow(ctx, AQUA, 0, FU.telogen - 6, 6, 0.6 * sh.germ);
    if (scene === 'bariera') {
      const k = clamp((g - 0.35) / 0.6);
      for (let j = 0; j < 7; j++) {
        const q = ((time * 0.09 + j / 7) % 1) * k;
        const u = FU.bulge - q * (FU.bulge + 2);
        ctx.beginPath();
        ctx.arc(FR.ors - 1.1, u, 0.75, 0, TAU);
        ctx.fillStyle = rgba(AQUA, 0.8 * k);
        ctx.fill();
      }
    }
  }
  if (scene === 'sebum') {
    // sebum leaves the gland by its duct into the canal and rises along the hair
    const k = clamp((g - 0.35) / 0.65);
    for (let j = 0; j < 8; j++) {
      const q = ((time * 0.11 + j / 8) % 1);
      if (q > k + 0.05) continue;
      const pts: Pt[] = [[10, 19], [4.4, FU.duct], [3.4, 6], [3.2, -1]];
      const [v, u] = polyAt(pts, q);
      ctx.beginPath();
      ctx.arc(v, u, 0.85, 0, TAU);
      ctx.fillStyle = rgba(HONEY, 0.9);
      ctx.fill();
      glow(ctx, HONEY, v, u, 2.2, 0.5);
    }
  }
}

/** The hair through the epidermis and above the skin, the old club leaving, each scene's light above (after the epidermis). */
export function drawFollicleOver(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const sh = shapeFor(st.scene, st.g);
  const col = COLOUR[st.colour];
  frame(ctx);
  const r = FR.shaft;
  // the length above the skin: grows in "through the skin", lengthens through the years of anagen
  let tip = sh.tip;
  if (st.scene === 'skos') tip = -0.5 - 30 * ease.outCubic(clamp(st.g));
  else if (st.scene === 'anagen') tip = -20 + (FU.tip + 20) * ease.inOutSine(clamp(st.g));
  if (st.scene === 'nowy') tip = sh.tip;
  const from = tip, to = Math.min(6, sh.base);
  if (to > from) {
    const colourTo = st.scene === 'barwa' ? FU.neck + (FU.tip - FU.neck) * ease.inOutSine(clamp(st.g)) : -999;
    const fill = shaftFill(ctx, col);
    ctx.fillStyle = st.scene === 'barwa' && colourTo > from ? 'rgba(255,232,222,.92)' : fill;
    ctx.fillRect(-r, from, 2 * r, to - from);
    if (st.scene === 'barwa' && colourTo < to) {
      ctx.fillStyle = fill;
      ctx.fillRect(-r, Math.max(from, colourTo), 2 * r, to - Math.max(from, colourTo));
      if (colourTo > from) glow(ctx, GOLD_HI, 0, colourTo, 4, 0.7);
    }
    // the tip, rounded, and the sheen down the cortex
    ctx.beginPath();
    ctx.ellipse(0, from, r, 1.2, 0, Math.PI, TAU);
    ctx.fillStyle = st.scene === 'barwa' && colourTo > from ? 'rgba(255,232,222,.92)' : fill;
    ctx.fill();
    ctx.strokeStyle = rgba(col.sheen, 0.6 + 0.2 * st.deep);
    ctx.lineWidth = 0.42;
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, from + 1);
    ctx.lineTo(-r * 0.35, to);
    ctx.stroke();
    // the cuticle's scales outside the skin
    ctx.strokeStyle = rgba(col.sheen, 0.4);
    ctx.lineWidth = 0.2;
    for (let u = from + 1.5; u < Math.min(to, 0); u += 1.7) {
      ctx.beginPath();
      ctx.moveTo(-r, u);
      ctx.lineTo(r * 0.2, u - 0.9);
      ctx.stroke();
    }
    if (st.scene === 'sebum') {
      const k = clamp((st.g - 0.5) / 0.5);
      ctx.strokeStyle = rgba(HONEY, 0.75 * k);
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(r + 0.1, Math.min(to, 0));
      ctx.lineTo(r + 0.1, Math.min(to, 0) + (from - Math.min(to, 0)) * k);
      ctx.stroke();
    }
  }
  if (sh.old) oldClub(ctx, sh.old, col, false);
  if (st.scene === 'skos') {
    // a ruler beside the hair: a day's 0.35 mm made visible
    ctx.strokeStyle = rgba(PEARL, 0.55);
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(-r - 4, -1);
    ctx.lineTo(-r - 4, -31);
    ctx.stroke();
    for (let k = 0; k <= 6; k++) {
      ctx.beginPath();
      ctx.moveTo(-r - 4, -1 - k * 5);
      ctx.lineTo(-r - (k % 2 ? 5 : 6), -1 - k * 5);
      ctx.stroke();
    }
    if (st.growing) glow(ctx, GOLD, 0, 2, 4.5, 0.5);
  }
  ctx.restore();
  if (st.scene === 'bariera') bricks(ctx, st);
}

/** The barrier: the horny layer as bricks (flat dead cells) with golden mortar (fats), built row by row at the skin's top (world units). */
function bricks(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const rows = 3, k = clamp(st.g / 0.7) * rows;
  const bw = 4.2, bh = 0.62;
  for (let rI = 0; rI < rows; rI++) {
    const vis = clamp(k - rI);
    if (vis <= 0) break;
    // from the deepest row of the horny layer up to the surface
    const y = 2.3 - rI * (bh + 0.12);
    for (let i = 0; i < 40; i++) {
      const x = -90 + i * (bw + 0.3) + (rI % 2 ? bw / 2 : 0);
      if (Math.abs(x + bw / 2 - FOL.ox) < 5.5) continue;
      if (hash(i * 7 + rI) > vis) continue;
      ctx.fillStyle = 'rgba(255,244,236,.92)';
      ctx.fillRect(x, y - bh, bw, bh);
      ctx.strokeStyle = rgba(GOLD, 0.95);
      ctx.lineWidth = 0.13;
      ctx.strokeRect(x, y - bh, bw, bh);
    }
  }
  if (k > 0.2) glow(ctx, GOLD_HI, FOL.ox - 16, 1.5, 16, 0.1 + 0.1 * st.deep);
}

/** The growing point's place in the follicle's frame for a scene, as a world point (for the gauge's light). */
export function folFocus(scene: SceneId, g: number): Pt {
  const sh = shapeFor(scene, g);
  if (scene === 'katagen' || scene === 'nowy') return folPt(0, (sh.base + sh.papU) / 2);
  return folPt(0, sh.papU);
}

export { BULB_R, PAP_R };
