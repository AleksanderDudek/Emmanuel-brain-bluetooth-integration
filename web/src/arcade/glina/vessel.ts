/**
 * The vessel, the one object in volume: a surface of revolution drawn row by row (one row per 2 CSS
 * px, at most 140), each row a pre-rendered shading strip (paint.ts) stretched to the row's width,
 * with the specular band laid over it as glossy as the clay is true.  Throwing rings darken a row
 * every few pixels and specks travel across the face with the wheel, which is how the spin reads.
 * At the rim an inner ellipse opens the vessel (its wall as thick as the grade), the lip catches the
 * light; a foot ring and a soft contact shadow set it down.  After the cut the hands' attachments
 * appear (handles, a spout, a lid, a flange or a rolled rim); in the kiln the glaze matures and the
 * ash runs from the shoulder, each drip at its own angle so it turns with the vessel; kiln gifts lay
 * a flame blush, iron speckle or a moon-white haze over the glaze.  The same code draws the small
 * vessels on the street, in the book's tiles and in the lobby (fewer rows, no specks).
 */
import { RINGS } from './clay';
import type { Attachment, GlazeId, KilnGift } from './content';
import { C, GLAZE, hash, mix, strips } from './paint';

const TAU = Math.PI * 2;
/** How much of the rim's ellipse we see from a potter's standing height. */
export const TILT = 0.2;

export interface VesselLook {
  /** the axis and the foot (px), px per cm */
  x: number;
  y: number;
  scale: number;
  /** height (cm) and the outer radius (cm) at the 16 rings, foot to rim */
  H: number;
  r: ArrayLike<number>;
  /** the surface: wet clay on the wheel, leather-hard after the cut, or glazed */
  body: 'wet' | 'leather' | 'glazed';
  porcelain: boolean;
  glaze: GlazeId | null;
  /** 0 dipped (a chalky raw coat) … 1 fired (the glaze matured) */
  fired: number;
  /** the wet sheen (trueness): 0 dull … 1 a crisp, still highlight */
  gloss: number;
  /** the rim's hand-made waviness (cm) */
  wavy: number;
  /** the ash runs (G, 0..1) */
  runs: number;
  gift: KilnGift | null;
  /** the wall's thickness (cm) at the rim */
  wall: number;
  /** the wheel's turn (rad): specks and runs travel with it */
  rot: number;
  attach: readonly Attachment[] | null;
  /** the kiln's glow over the vessel (0..1) */
  glow: number;
  /** the most rows to draw; small vessels draw fewer and no specks */
  rows: number;
  specks: boolean;
  alpha: number;
}

export function look(): VesselLook {
  return {
    x: 0, y: 0, scale: 1, H: 1, r: new Float64Array(RINGS), body: 'wet', porcelain: false, glaze: null, fired: 0, gloss: 0.4, wavy: 0,
    runs: 0, gift: null, wall: 0.6, rot: 0, attach: null, glow: 0, rows: 140, specks: true, alpha: 1,
  };
}

/** The radius (cm) at height u (0..1) through the 16 rings, a Catmull–Rom curve. */
export function radiusAt(r: ArrayLike<number>, u: number): number {
  const f = Math.min(RINGS - 1, Math.max(0, u * (RINGS - 1)));
  const i = Math.min(RINGS - 2, Math.floor(f)), s = f - i;
  const p0 = r[Math.max(0, i - 1)], p1 = r[i], p2 = r[i + 1], p3 = r[Math.min(RINGS - 1, i + 2)];
  const s2 = s * s, s3 = s2 * s;
  return 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3);
}

/** A vessel's widest radius (cm). */
export function widest(r: ArrayLike<number>): number {
  let m = 0;
  for (let k = 0; k < RINGS; k++) m = Math.max(m, r[k]);
  return m;
}

const RUNS = 16;
const SPECKS = 22;
/** the rows' radii (px), reused */
const rowR = new Float64Array(160);

/** The surface's colour for a look. */
function surface(v: VesselLook): { color: string; pool: string; gloss: number } {
  if (v.body === 'glazed' && v.glaze) {
    const g = GLAZE[v.glaze];
    const raw = mix(g.c, '#FBF7EE', 0.55);
    const k = Math.min(1, Math.max(0, v.fired));
    return { color: k >= 0.999 ? g.c : mix(raw, g.c, k), pool: g.pool, gloss: 0.08 + (g.gloss - 0.08) * k };
  }
  if (v.body === 'leather') return { color: v.porcelain ? mix(C.porcelainWet, '#FFFFFF', 0.3) : C.leather, pool: v.porcelain ? C.porcelainWet : C.wet, gloss: 0.12 };
  return { color: v.porcelain ? C.porcelainWet : C.wet, pool: v.porcelain ? '#B9B1A6' : '#4C2E20', gloss: v.gloss };
}

/** Trace the vessel's silhouette (for clips and overlays) at `n` rows. */
function silhouette(ctx: CanvasRenderingContext2D, v: VesselLook, n: number, Hpx: number): void {
  ctx.beginPath();
  ctx.moveTo(v.x - rowR[0], v.y);
  for (let j = 0; j < n; j++) ctx.lineTo(v.x - rowR[j], v.y - ((j + 0.5) / n) * Hpx);
  ctx.lineTo(v.x - rowR[n - 1], v.y - Hpx);
  ctx.lineTo(v.x + rowR[n - 1], v.y - Hpx);
  for (let j = n - 1; j >= 0; j--) ctx.lineTo(v.x + rowR[j], v.y - ((j + 0.5) / n) * Hpx);
  ctx.lineTo(v.x + rowR[0], v.y);
  ctx.closePath();
}

/** Draw a vessel (the caller set the transform; CSS px). */
export function drawVessel(ctx: CanvasRenderingContext2D, v: VesselLook): void {
  const Hpx = v.H * v.scale;
  if (!(Hpx > 1) || !(v.alpha > 0)) return;
  const n = Math.max(6, Math.min(v.rows, rowR.length, Math.ceil(Hpx / 2)));
  const rowH = Hpx / n;
  for (let j = 0; j < n; j++) rowR[j] = Math.max(0.5, radiusAt(v.r, (j + 0.5) / n) * v.scale);
  const sf = surface(v);
  const st = strips(sf.color), pool = sf.pool !== sf.color ? strips(sf.pool) : st;
  const small = v.rows < 70;
  ctx.save();
  ctx.globalAlpha = v.alpha;
  // the contact shadow on the wheel head
  const r0 = rowR[0];
  ctx.fillStyle = 'rgba(59,42,34,.26)';
  ctx.beginPath();
  ctx.ellipse(v.x + r0 * 0.12, v.y + 1, r0 * 1.22, Math.max(2, r0 * TILT * 1.1), 0, 0, TAU);
  ctx.fill();
  // the foot: a short, darker ring under the body
  ctx.fillStyle = mix(sf.pool, '#000000', 0.15);
  ctx.beginPath();
  ctx.ellipse(v.x, v.y, r0 * 0.96, Math.max(1.5, r0 * TILT), 0, 0, Math.PI);
  ctx.fill();
  // the body, row by row; throwing rings every ~7.5 px, the glaze pooling darker over them
  const ringed = v.body !== 'glazed' || (v.glaze === 'miod' || v.glaze === 'zelazo');
  for (let j = 0; j < n; j++) {
    const yy = v.y - (j + 1) * rowH, rp = rowR[j];
    const ring = !small && ringed && ((j * rowH) % 7.5) < rowH;
    const img = ring ? (v.body === 'glazed' ? pool.base : st.ring) : st.base;
    ctx.drawImage(img, v.x - rp, yy - 0.6, rp * 2, rowH + 1.2);
  }
  // the specular band: soft when the clay is unsteady, a crisp still stripe when it is true
  const gloss = sf.gloss;
  if (gloss > 0.02) {
    const sharp = v.body === 'wet' ? v.gloss : 0.7;
    const aSoft = gloss * (1 - sharp) * 0.6, aSharp = gloss * sharp * 0.75;
    for (let j = 0; j < n; j++) {
      const yy = v.y - (j + 1) * rowH, rp = rowR[j];
      if (aSoft > 0.02) {
        ctx.globalAlpha = v.alpha * aSoft;
        ctx.drawImage(st.soft, v.x - rp, yy - 0.6, rp * 2, rowH + 1.2);
      }
      if (aSharp > 0.02) {
        ctx.globalAlpha = v.alpha * aSharp;
        ctx.drawImage(st.sharp, v.x - rp, yy - 0.6, rp * 2, rowH + 1.2);
      }
    }
    ctx.globalAlpha = v.alpha;
  }
  // specks of grog travelling with the wheel
  if (v.specks && !small && v.body === 'wet') {
    for (let i = 0; i < SPECKS; i++) {
      const a = hash(i + 3) * TAU + v.rot, c = Math.cos(a);
      if (c < 0.05) continue;
      const u = 0.06 + hash(i + 9) * 0.9;
      const j = Math.min(n - 1, Math.floor(u * n));
      ctx.fillStyle = i % 3 ? 'rgba(40,22,14,.45)' : 'rgba(255,236,214,.35)';
      ctx.beginPath();
      ctx.arc(v.x + rowR[j] * Math.sin(a), v.y - u * Hpx, (0.6 + hash(i + 17) * 0.8) * Math.max(0.6, c), 0, TAU);
      ctx.fill();
    }
  }
  if (v.body === 'glazed') overlays(ctx, v, n, Hpx);
  rim(ctx, v, n, Hpx, sf);
  if (v.attach && v.attach.length) attachments(ctx, v, n, Hpx, sf.color);
  if (v.glow > 0.01) {
    ctx.save();
    silhouette(ctx, v, n, Hpx);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = v.alpha * v.glow * 0.55;
    ctx.fillStyle = C.chamber2;
    ctx.fillRect(v.x - widest(v.r) * v.scale - 2, v.y - Hpx - 2, widest(v.r) * v.scale * 2 + 4, Hpx + 4);
    ctx.restore();
  }
  ctx.restore();
}

/** The ash runs and the kiln gifts, clipped to the vessel. */
function overlays(ctx: CanvasRenderingContext2D, v: VesselLook, n: number, Hpx: number): void {
  const wide = widest(v.r) * v.scale;
  if (v.gift || v.runs > 0.01) {
    ctx.save();
    silhouette(ctx, v, n, Hpx);
    ctx.clip();
    if (v.gift === 'blush') {
      const side = Math.sin(v.rot + 1.2) >= 0 ? 1 : -1;
      const g = ctx.createRadialGradient(v.x + side * wide * 0.55, v.y - Hpx * 0.42, 0, v.x + side * wide * 0.55, v.y - Hpx * 0.42, Math.max(wide, Hpx) * 0.95);
      g.addColorStop(0, 'rgba(217,101,59,.62)');
      g.addColorStop(0.55, 'rgba(217,101,59,.22)');
      g.addColorStop(1, 'rgba(217,101,59,0)');
      ctx.fillStyle = g;
      ctx.fillRect(v.x - wide - 2, v.y - Hpx - 2, wide * 2 + 4, Hpx + 4);
    } else if (v.gift === 'speckle') {
      ctx.fillStyle = C.speckle;
      for (let i = 0; i < 46; i++) {
        const a = hash(i + 61) * TAU + v.rot, c = Math.cos(a);
        if (c < 0) continue;
        const u = 0.05 + hash(i + 62) * 0.92, j = Math.min(n - 1, Math.floor(u * n));
        ctx.globalAlpha = v.alpha * (0.5 + 0.5 * c);
        ctx.beginPath();
        ctx.arc(v.x + rowR[j] * Math.sin(a), v.y - u * Hpx, Math.max(0.6, (0.6 + hash(i + 63) * 1.4) * v.scale * 0.06), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = v.alpha;
    } else if (v.gift === 'moon') {
      const g = ctx.createLinearGradient(v.x - wide, 0, v.x + wide, 0);
      g.addColorStop(0, 'rgba(220,232,242,.15)');
      g.addColorStop(0.35, 'rgba(232,242,250,.55)');
      g.addColorStop(0.6, 'rgba(220,232,242,.3)');
      g.addColorStop(1, 'rgba(200,214,232,.12)');
      ctx.fillStyle = g;
      ctx.fillRect(v.x - wide - 2, v.y - Hpx - 2, wide * 2 + 4, Hpx + 4);
    }
    if (v.runs > 0.01) runs(ctx, v, n, Hpx);
    ctx.restore();
  }
}

/** Glaze runs from the shoulder down, as long as the firing's calm made them; each turns with the vessel. */
function runs(ctx: CanvasRenderingContext2D, v: VesselLook, n: number, Hpx: number): void {
  // the shoulder: the widest ring of the upper half (or high on the wall)
  let us = 0.82, best = -1;
  for (let k = Math.floor(RINGS / 2); k < RINGS; k++) if (v.r[k] > best) { best = v.r[k]; us = k / (RINGS - 1); }
  us = Math.min(0.93, Math.max(0.6, us));
  ctx.lineCap = 'round';
  for (let i = 0; i < RUNS; i++) {
    const a = (i / RUNS) * TAU + hash(i + 80) * 0.3 + v.rot, c = Math.cos(a);
    if (c < 0.12) continue;
    const len = v.runs * (0.18 + 0.32 * hash(i + 81)) * (v.runs >= 0.9 ? 1.3 : 1);
    const u1 = Math.max(0.04, us - len);
    const w = Math.max(1, (1.1 + 1.6 * hash(i + 82)) * Math.min(1.6, v.scale * 0.08)) * (0.55 + 0.45 * c);
    ctx.strokeStyle = `rgba(169,163,91,${(0.5 + 0.35 * c).toFixed(3)})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let s = 0; s <= 6; s++) {
      const u = us - (us - u1) * (s / 6);
      const j = Math.min(n - 1, Math.max(0, Math.floor(u * n)));
      const px = v.x + rowR[j] * Math.sin(a) + Math.sin(s * 1.7 + i) * 0.6;
      const py = v.y - u * Hpx;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // the bead at its end and a glassy highlight along it
    const j1 = Math.min(n - 1, Math.max(0, Math.floor(u1 * n)));
    ctx.fillStyle = `rgba(150,148,74,${(0.65 + 0.3 * c).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(v.x + rowR[j1] * Math.sin(a), v.y - u1 * Hpx, w * 0.9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,252,220,.35)';
    ctx.lineWidth = Math.max(0.6, w * 0.3);
    ctx.beginPath();
    const ja = Math.min(n - 1, Math.floor(us * n)), jb = Math.min(n - 1, Math.floor(((us + u1) / 2) * n));
    ctx.moveTo(v.x + rowR[ja] * Math.sin(a) - w * 0.2, v.y - us * Hpx);
    ctx.lineTo(v.x + rowR[jb] * Math.sin(a) - w * 0.2, v.y - ((us + u1) / 2) * Hpx);
    ctx.stroke();
  }
  // a glass mantle pools darker toward the foot
  if (v.runs >= 0.9) {
    const g = ctx.createLinearGradient(0, v.y - Hpx * 0.3, 0, v.y);
    g.addColorStop(0, 'rgba(120,118,60,0)');
    g.addColorStop(1, 'rgba(120,118,60,.35)');
    ctx.fillStyle = g;
    ctx.fillRect(v.x - widest(v.r) * v.scale - 2, v.y - Hpx * 0.3, widest(v.r) * v.scale * 2 + 4, Hpx * 0.3 + 2);
  }
}

/** The opening at the rim: the inside in shadow, the wall's thickness, the lip catching the light; a little waviness. */
function rim(ctx: CanvasRenderingContext2D, v: VesselLook, n: number, Hpx: number, sf: { color: string; pool: string }): void {
  const ry = v.y - Hpx, rr = rowR[n - 1];
  const tilt = TILT, wallPx = Math.max(1, Math.min(rr * 0.45, v.wall * v.scale));
  const inner = mix(sf.pool, '#120A06', 0.45);
  const wav = v.wavy * v.scale;
  // the outer rim (wavy), filled with the wall's top
  ctx.fillStyle = mix(sf.color, '#FFFFFF', 0.12);
  ctx.beginPath();
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * TAU, k = 1 + (wav / Math.max(1, rr)) * Math.sin(3 * a + 0.7) * 0.5;
    const px = v.x + Math.cos(a) * rr * k, py = ry + Math.sin(a) * rr * tilt * k;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // the dark inside
  const ir = Math.max(0.5, rr - wallPx);
  const g = ctx.createLinearGradient(0, ry - ir * tilt, 0, ry + ir * tilt);
  g.addColorStop(0, mix(inner, '#000000', 0.1));
  g.addColorStop(1, mix(inner, sf.color, 0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(v.x, ry + wallPx * tilt * 0.4, ir, Math.max(0.5, ir * tilt), 0, 0, TAU);
  ctx.fill();
  // the lip: light on its front edge
  ctx.strokeStyle = 'rgba(255,246,230,.55)';
  ctx.lineWidth = Math.max(0.8, Math.min(2.4, wallPx * 0.45));
  ctx.beginPath();
  ctx.ellipse(v.x, ry, rr - wallPx * 0.3, Math.max(0.5, (rr - wallPx * 0.3) * tilt), 0, 0.15, Math.PI - 0.15);
  ctx.stroke();
}

/** What the hands add at the cut, in the body's colour. */
function attachments(ctx: CanvasRenderingContext2D, v: VesselLook, n: number, Hpx: number, color: string): void {
  const s = v.scale, at = (u: number) => rowR[Math.min(n - 1, Math.max(0, Math.floor(u * n)))];
  const yAt = (u: number) => v.y - u * Hpx;
  const thick = Math.max(2, 0.8 * s);
  const dark = mix(color, '#000000', 0.3), light = mix(color, '#FFFFFF', 0.3);
  const loop = (side: number, u0: number, u1: number, out: number, w: number) => {
    const x0 = v.x + side * at(u0) * 0.96, x1 = v.x + side * at(u1) * 0.96;
    const y0 = yAt(u0), y1 = yAt(u1);
    const ox = side * out;
    ctx.lineCap = 'round';
    ctx.strokeStyle = dark;
    ctx.lineWidth = w + 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + ox * 1.1, y0 - w, x1 + ox, y1 + w * 0.5, x1, y1);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.strokeStyle = light;
    ctx.lineWidth = Math.max(0.8, w * 0.28);
    ctx.beginPath();
    ctx.moveTo(x0 + side * w * 0.1, y0 - w * 0.25);
    ctx.bezierCurveTo(x0 + ox * 1.05, y0 - w * 1.2, x1 + ox * 0.95, y1, x1 + side * w * 0.2, y1 - w * 0.2);
    ctx.stroke();
  };
  for (const a of v.attach!) {
    switch (a) {
      case 'handle': loop(1, 0.82, 0.4, Math.max(8, widest(v.r) * s * 0.42), thick * 1.2); break;
      case 'smallHandle': loop(1, 0.72, 0.42, Math.max(6, widest(v.r) * s * 0.36), thick); break;
      case 'twoHandles':
        loop(1, 0.74, 0.56, Math.max(5, widest(v.r) * s * 0.22), thick * 0.9);
        loop(-1, 0.74, 0.56, Math.max(5, widest(v.r) * s * 0.22), thick * 0.9);
        break;
      case 'lip': {
        const rr = rowR[n - 1], y = v.y - Hpx;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(v.x - rr * 0.7, y - 1);
        ctx.quadraticCurveTo(v.x - rr * 1.25, y - thick * 0.9, v.x - rr * 1.42, y - thick * 1.6);
        ctx.quadraticCurveTo(v.x - rr * 1.1, y + thick * 0.5, v.x - rr * 0.8, y + rr * TILT);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = light;
        ctx.lineWidth = Math.max(0.8, thick * 0.25);
        ctx.stroke();
        break;
      }
      case 'nozzle': {
        const u = 0.7, y = yAt(u), x = v.x - at(u) * 0.92, len = Math.max(8, widest(v.r) * s * 0.55);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + 2, y - thick * 0.9);
        ctx.quadraticCurveTo(x - len * 0.6, y - thick * 1.4, x - len, y - thick * 0.9);
        ctx.lineTo(x - len, y + thick * 0.5);
        ctx.quadraticCurveTo(x - len * 0.5, y + thick * 0.4, x + 2, y + thick * 1.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2A1A12';
        ctx.beginPath();
        ctx.ellipse(x - len, y - thick * 0.2, Math.max(1, thick * 0.3), Math.max(1, thick * 0.7), 0, 0, TAU);
        ctx.fill();
        break;
      }
      case 'flange': {
        const rr = rowR[n - 1], y = v.y - Hpx, w = rr * 1.14;
        ctx.fillStyle = mix(color, '#FFFFFF', 0.08);
        ctx.beginPath();
        ctx.ellipse(v.x, y, w, w * TILT, 0, 0, TAU);
        ctx.ellipse(v.x, y, rr * 0.98, rr * 0.98 * TILT, 0, 0, TAU, true);
        ctx.fill('evenodd');
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(v.x, y + 1, w, w * TILT, 0, 0, Math.PI);
        ctx.stroke();
        break;
      }
      case 'rolled': {
        const rr = rowR[n - 1], y = v.y - Hpx;
        ctx.strokeStyle = color;
        ctx.lineWidth = thick * 1.1;
        ctx.beginPath();
        ctx.ellipse(v.x, y, rr, rr * TILT, 0, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = light;
        ctx.lineWidth = Math.max(0.8, thick * 0.3);
        ctx.beginPath();
        ctx.ellipse(v.x, y - thick * 0.2, rr, rr * TILT, 0, 0.3, Math.PI - 0.3);
        ctx.stroke();
        break;
      }
      case 'lid': {
        const rr = rowR[n - 1] * 1.06, y = v.y - Hpx;
        const g = ctx.createLinearGradient(v.x - rr, 0, v.x + rr, 0);
        g.addColorStop(0, mix(color, '#000000', 0.18));
        g.addColorStop(0.35, light);
        g.addColorStop(1, mix(color, '#000000', 0.3));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(v.x, y, rr, rr * TILT, 0, 0, Math.PI);
        ctx.quadraticCurveTo(v.x - rr * 0.7, y - rr * 0.55, v.x, y - rr * 0.6);
        ctx.quadraticCurveTo(v.x + rr * 0.7, y - rr * 0.55, v.x + rr, y);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(v.x, y - rr * 0.62, rr * 0.18, rr * 0.12, 0, 0, TAU);
        ctx.fill();
        break;
      }
    }
  }
}
