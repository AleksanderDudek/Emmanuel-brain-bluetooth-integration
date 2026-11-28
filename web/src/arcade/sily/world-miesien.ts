/**
 * Muscle in cross-section under the lens (DESIGN.md §28, Nowe siły · Siła w mięśniach, depth 1): a bundle of fibres cut
 * across — each a rounded polygon packed with myofibrils, its nuclei pressed to the edge, capillaries in the corners
 * between them, the thin endomysium around each.  On the middle fibre, between its membrane and the basal lamina, a
 * satellite cell — the muscle's stem cell (Mauro 1961), quiet until effort calls it (Snijders et al. 2015).
 *
 *   satelity  after effort small strains glint in the fibre; the satellite cell wakes and divides; one daughter goes
 *             back to quiet, a stem cell still, the other slips in and fuses into the fibre as a new nucleus (Murach
 *             et al. 2021); the strains mend and the fibre stands a little fuller
 *
 * Only the scene's growth moves the cells: a time-lapse of days.
 */
import { GOLD, TAU, glow, glowEllipse, hash, mix, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { cell, lerp, phase, smooth } from './draw';

export const MIESIEN_VIEW = { x: -70, y: -54, w: 140, h: 104 } as const;

interface Fibre { c: Pt; r: number; pts: Pt[]; nuclei: number[] }
const R0 = 24;
const FIBRES: Fibre[] = (() => {
  // a packed bundle: hexagonal places, each fibre a softly rounded polygon touching its neighbours
  const centres: Pt[] = [];
  const D = 50;
  for (let row = -4; row <= 4; row++) {
    for (let col = -5; col <= 5; col++) {
      const x = col * D + (row % 2 ? D / 2 : 0) + (hash(row * 13 + col * 7) - 0.5) * 6;
      const y = row * D * 0.87 + (hash(row * 5 + col * 11) - 0.5) * 6;
      centres.push(row === 0 && col === 0 ? [0, 0] : [x, y]);
    }
  }
  centres.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
  return centres.map((c, i) => {
    const r = i === 0 ? R0 : 25.5 + 2.5 * hash(i * 3.1);
    const n = 6;
    const pts: Pt[] = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + Math.PI / 6 + (hash(i * 1.3 + j) - 0.5) * 0.3;
      const rr = r * (0.98 + 0.1 * hash(i * 7 + j * 1.9));
      pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]);
    }
    return { c, r, pts, nuclei: i === 0 ? [2.3, 3.9, 5.6] : [hash(i * 2.2) * TAU, hash(i * 4.4) * TAU + 2] };
  });
})();

/** the satellite cell's place: the main fibre's top edge; where its daughter fuses in */
export const SAT_ANGLE = -Math.PI / 2 - 0.15;
const FUSE_ANGLE = -Math.PI / 2 + 0.75;
const edgeAt = (a: number, r: number): Pt => [Math.cos(a) * r, Math.sin(a) * r];
export const SAT_AT: Pt = edgeAt(SAT_ANGLE, R0 + 0.8);
export const FUSE_AT: Pt = edgeAt(FUSE_ANGLE, R0 - 3.2);
const STRAINS: readonly Pt[] = [[6, -12], [11, -6], [-2, -8], [14, 2]];

/** A rounded polygon through points. */
function roundPoly(ctx: CanvasRenderingContext2D, pts: readonly Pt[], scale = 1, c: Pt = [0, 0]): void {
  const P = pts.map(p => [c[0] + (p[0] - c[0]) * scale, c[1] + (p[1] - c[1]) * scale] as Pt);
  ctx.beginPath();
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (i === 0) ctx.moveTo(m[0], m[1]);
    const n = P[(i + 2) % P.length];
    ctx.quadraticCurveTo(b[0], b[1], (b[0] + n[0]) / 2, (b[1] + n[1]) / 2);
  }
  ctx.closePath();
}

function bake(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#4a2038';
  ctx.fillRect(-260, -200, 520, 400);
  // capillaries where the fibres meet
  for (let i = 0; i < 70; i++) {
    const a = hash(i * 2.9) * TAU, d = 26 + hash(i * 5.7) * 200;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.8;
    glow(ctx, '#ff5a6a', x, y, 4, 0.25);
    ctx.fillStyle = '#c8384e';
    ctx.beginPath();
    ctx.arc(x, y, 2.1, 0, TAU);
    ctx.fill();
  }
  FIBRES.forEach((f, i) => {
    const g = ctx.createRadialGradient(f.c[0] - f.r * 0.3, f.c[1] - f.r * 0.3, 0, f.c[0], f.c[1], f.r * 1.1);
    g.addColorStop(0, '#f0a0a8');
    g.addColorStop(0.7, '#c86078');
    g.addColorStop(1, '#8a3a56');
    ctx.fillStyle = g;
    roundPoly(ctx, f.pts, 0.985, f.c);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,226,.4)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // myofibrils: a fine stipple
    ctx.fillStyle = 'rgba(255,214,222,.28)';
    for (let j = 0; j < 46; j++) {
      const a = hash(i * 13 + j * 1.7) * TAU, d = Math.sqrt(hash(i * 17 + j * 2.3)) * f.r * 0.78;
      ctx.beginPath();
      ctx.arc(f.c[0] + Math.cos(a) * d, f.c[1] + Math.sin(a) * d, 0.7, 0, TAU);
      ctx.fill();
    }
    // nuclei pressed to the edge
    for (const a of f.nuclei) {
      const [x, y] = edgeAt(a, f.r * 0.82);
      cell(ctx, f.c[0] + x, f.c[1] + y, 3.2, 1.6, a + Math.PI / 2, '#6a4aa0', null, 0.95);
    }
  });
  // the main fibre's basal lamina: a thin line of light a breath outside it
  ctx.strokeStyle = 'rgba(255,236,210,.55)';
  ctx.lineWidth = 0.5;
  roundPoly(ctx, FIBRES[0].pts, 1.06, FIBRES[0].c);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const k = st.g;
  // after effort: small strains glint in the fibre, and mend
  const strain = smooth(phase(k, 0, 0.12)) * (1 - smooth(phase(k, 0.7, 0.9)));
  STRAINS.forEach(([x, y], i) => {
    if (strain <= 0.01) return;
    const tw = st.reduced ? 1 : 0.7 + 0.3 * Math.sin(st.time * 3 + i * 1.7);
    glow(ctx, '#fff0dc', x, y, 3.4, 0.45 * strain * tw);
    ctx.strokeStyle = rgba('#fff4e8', 0.6 * strain);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 1);
    ctx.lineTo(x + 2, y + 1);
    ctx.stroke();
  });
  // the satellite cell wakes, divides; one stays quiet, one fuses in as a new nucleus
  const wake = smooth(phase(k, 0.08, 0.3));
  const div = smooth(phase(k, 0.3, 0.45));
  const go = smooth(phase(k, 0.45, 0.72));
  const satCell = (a: number, r: number, w: number, fused: number): void => {
    const [x, y] = edgeAt(a, r);
    const body = mix(mix('#bfe6ee', '#9fe9ff', w), '#6a4aa0', fused);
    glow(ctx, '#9fe9ff', x, y, 4 + 3 * w, (0.15 + 0.4 * w) * (1 - fused));
    cell(ctx, x, y, 3.4 - 0.4 * fused + 0.6 * w, 1.5 + 0.9 * w * (1 - fused), a + Math.PI / 2, body, fused > 0.5 ? null : '#3a5a9a', 1, 0.45);
  };
  if (div <= 0.01) satCell(SAT_ANGLE, R0 + 0.8, wake, 0);
  else {
    const d = 0.12 * div;
    // the one that stays: back to quiet
    satCell(SAT_ANGLE - d, R0 + 0.8, wake * (1 - 0.6 * go), 0);
    // the one that goes: along the edge, then into the fibre
    const a = lerp(SAT_ANGLE + d, FUSE_ANGLE, go);
    const r = lerp(R0 + 0.8, R0 - 3.2, smooth(phase(go, 0.6, 1)));
    satCell(a, r, wake, smooth(phase(go, 0.7, 1)));
    if (go > 0.85) glow(ctx, GOLD, FUSE_AT[0], FUSE_AT[1], 6, 0.5 * Math.sin(Math.PI * phase(go, 0.85, 1)));
  }
  // the fibre a little fuller
  const full = smooth(phase(k, 0.8, 1));
  if (full > 0.01) {
    ctx.strokeStyle = rgba('#ffd8c8', 0.55 * full);
    ctx.lineWidth = 1.4 * full;
    roundPoly(ctx, FIBRES[0].pts, 0.95 + 0.06 * full, FIBRES[0].c);
    ctx.stroke();
    glowEllipse(ctx, '#ffb0a0', 0, 0, R0 * 1.1, R0, 0, 0.18 * full);
  }
  if (st.deep > 0.02) glowEllipse(ctx, '#ffb7a0', 0, 0, 60, 50, 0, 0.08 * st.deep);
}

export const MIESIEN_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake: ctx => bake(ctx),
  draw,
  focusAt(_scene, g) {
    if (g < 0.12) return STRAINS[0];
    if (g < 0.45) return SAT_AT;
    const go = smooth(phase(g, 0.45, 0.72));
    return edgeAt(lerp(SAT_ANGLE, FUSE_ANGLE, go), lerp(R0 + 0.8, R0 - 3.2, go));
  },
};
