/**
 * Urodzaj's brushes: a late-summer hillside at golden hour, painted flat with soft light.  The eleven
 * fruits (each its own silhouette and a little face that rolls with it, Suika's charm), Feliks the
 * sparrow, the wicker basket (its back weave, where the harvest wind's charge rises as light; its
 * posts; its rim, which is the wind's gauge with the threshold mark in the middle), the gleaners, the
 * village table with the festivals' decorations, the wheat that keeps the band's last 40 s, and the
 * cards.  Pure drawing: no state but a sprite cache.
 */
import { clamp } from '../kit/juice';
import type { TraceBar } from '../kit/trace';
import { FRUITS, fruit, type DecorId, type FruitKind } from './content';

export const C = {
  skyTop: '#f6c66f',
  skyMid: '#f3a35f',
  skyLow: '#f7d9a0',
  sun: '#fff1c4',
  hillFar: '#c79a9a',
  hillMid: '#9a9a4a',
  hillNear: '#7b8436',
  field: '#e6be63',
  fieldDark: '#c99a3e',
  soil: '#8a5a32',
  wicker: '#b8803f',
  wickerDark: '#6f4620',
  wickerLight: '#e6b56c',
  weave: '#5a3818',
  twine: '#7a5a3a',
  gold: '#ffd25e',
  goldDeep: '#e9a628',
  cream: '#fff6e0',
  ink: '#3a2412',
  danger: '#e2483a',
  cool: '#9fc6d8',
  linen: '#f3ead6',
  plum: '#5b2d6e',
  leaf: '#5f8a2e',
  leafDark: '#3e6420',
};

export const FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';

export const TAU = Math.PI * 2;

export function hash(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgbaPrefix: string, a: number): void {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${rgbaPrefix}${a})`);
  g.addColorStop(1, `${rgbaPrefix}0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

// ── the fruits ───────────────────────────────────────────────────
export type Face = 'calm' | 'happy' | 'worried' | 'none';

/** The fruit's body path (centred at 0,0, radius R) — each kind its own silhouette. */
function bodyPath(ctx: CanvasRenderingContext2D, kind: FruitKind, R: number): void {
  ctx.beginPath();
  switch (kind) {
    case 'olive': ctx.ellipse(0, 0, R, R * 0.84, 0.5, 0, TAU); break;
    case 'date': ctx.ellipse(0, 0, R * 0.86, R, 0, 0, TAU); break;
    case 'fig': {
      ctx.moveTo(0, -R);
      ctx.bezierCurveTo(R * 0.35, -R * 0.85, R * 1.02, -R * 0.15, R, R * 0.2);
      ctx.bezierCurveTo(R * 0.95, R * 0.8, R * 0.45, R, 0, R);
      ctx.bezierCurveTo(-R * 0.45, R, -R * 0.95, R * 0.8, -R, R * 0.2);
      ctx.bezierCurveTo(-R * 1.02, -R * 0.15, -R * 0.35, -R * 0.85, 0, -R);
      break;
    }
    case 'quince': {
      const n = 7;
      for (let i = 0; i <= n * 4; i++) {
        const a = (i / (n * 4)) * TAU;
        const r = R * (0.95 + 0.05 * Math.cos(a * n));
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      break;
    }
    default: ctx.arc(0, 0, R, 0, TAU);
  }
  ctx.closePath();
}

/** One fruit, unrotated, at (0,0): the body, its details and the face. */
function paintFruitBody(ctx: CanvasRenderingContext2D, tier: number, R: number, face: Face): void {
  const f = fruit(tier);
  const k = f.kind;
  if (k === 'cluster') return paintCluster(ctx, R, face);
  bodyPath(ctx, k, R);
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
  g.addColorStop(0, f.light);
  g.addColorStop(0.55, f.base);
  g.addColorStop(1, f.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, R * 0.06);
  ctx.strokeStyle = 'rgba(58,36,18,.55)';
  ctx.stroke();
  ctx.save();
  bodyPath(ctx, k, R);
  ctx.clip();
  switch (k) {
    case 'grape': {
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.beginPath();
      ctx.ellipse(R * 0.1, R * 0.15, R * 0.8, R * 0.7, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'date': {
      ctx.strokeStyle = 'rgba(90,50,20,.45)';
      ctx.lineWidth = Math.max(1, R * 0.05);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-R * 0.6, i * R * 0.5);
        ctx.quadraticCurveTo(0, i * R * 0.5 + R * 0.15, R * 0.6, i * R * 0.5);
        ctx.stroke();
      }
      break;
    }
    case 'fig': {
      ctx.fillStyle = 'rgba(140,170,70,.35)';
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.55, R * 0.45, R * 0.4, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'apricot': {
      ctx.fillStyle = 'rgba(230,80,40,.28)';
      ctx.beginPath();
      ctx.ellipse(R * 0.35, R * 0.15, R * 0.55, R * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,80,20,.45)';
      ctx.lineWidth = Math.max(1, R * 0.05);
      ctx.beginPath();
      ctx.moveTo(-R * 0.05, -R);
      ctx.quadraticCurveTo(-R * 0.35, 0, -R * 0.05, R);
      ctx.stroke();
      break;
    }
    case 'apple': {
      ctx.fillStyle = 'rgba(255,214,120,.3)';
      ctx.beginPath();
      ctx.ellipse(-R * 0.45, R * 0.3, R * 0.4, R * 0.55, 0.3, 0, TAU);
      ctx.fill();
      break;
    }
    case 'pomegranate': {
      ctx.fillStyle = 'rgba(255,190,150,.18)';
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc((hash(i) - 0.5) * R * 1.3, (hash(i + 9) - 0.3) * R * 1.2, R * 0.05, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'quince': {
      ctx.fillStyle = 'rgba(255,255,230,.25)';
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.arc((hash(i + 3) - 0.5) * R * 1.6, (hash(i + 17) - 0.5) * R * 1.6, R * 0.04, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'melon': {
      ctx.strokeStyle = 'rgba(140,120,50,.4)';
      ctx.lineWidth = Math.max(1, R * 0.025);
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * R * 0.28 - R, -R);
        ctx.lineTo(i * R * 0.28 + R, R);
        ctx.moveTo(i * R * 0.28 + R, -R);
        ctx.lineTo(i * R * 0.28 - R, R);
        ctx.stroke();
      }
      break;
    }
    case 'watermelon': {
      ctx.fillStyle = 'rgba(20,60,20,.55)';
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        const x = i * R * 0.32;
        ctx.moveTo(x, -R);
        for (let s = 0; s <= 10; s++) {
          const yy = -R + (s / 10) * 2 * R;
          ctx.lineTo(x + Math.sin(s * 1.3 + i) * R * 0.05 + R * 0.06 * Math.cos((yy / R) * 1.2), yy);
        }
        for (let s = 10; s >= 0; s--) {
          const yy = -R + (s / 10) * 2 * R;
          ctx.lineTo(x - R * 0.07 + Math.sin(s * 1.3 + i) * R * 0.05, yy);
        }
        ctx.fill();
      }
      break;
    }
    default: break;
  }
  // the shine
  ctx.fillStyle = 'rgba(255,255,255,.42)';
  ctx.beginPath();
  ctx.ellipse(-R * 0.38, -R * 0.45, R * 0.24, R * 0.13, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
  // stems, leaves and crowns on top
  ctx.lineCap = 'round';
  if (k === 'apple' || k === 'quince' || k === 'fig' || k === 'grape' || k === 'olive' || k === 'apricot') {
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = Math.max(1.2, R * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.9);
    ctx.quadraticCurveTo(R * 0.05, -R * 1.15, R * 0.12, -R * 1.25);
    ctx.stroke();
  }
  if (k === 'apple' || k === 'quince' || k === 'olive') leafAt(ctx, R * 0.16, -R * 1.12, R * (k === 'olive' ? 0.7 : 0.45), 0.5);
  if (k === 'pomegranate') {
    ctx.fillStyle = f.dark;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.32;
      ctx.lineTo(Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12 - R * 0.02);
      const b = a + 0.16;
      ctx.lineTo(Math.cos(b) * R * 0.86, Math.sin(b) * R * 0.86);
    }
    ctx.lineTo(R * 0.2, -R * 0.85);
    ctx.lineTo(-R * 0.25, -R * 0.85);
    ctx.closePath();
    ctx.fill();
  }
  if (k === 'melon' || k === 'watermelon') {
    ctx.strokeStyle = '#4a6a20';
    ctx.lineWidth = Math.max(1.5, R * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.96);
    ctx.quadraticCurveTo(-R * 0.08, -R * 1.12, R * 0.04, -R * 1.18);
    ctx.stroke();
  }
  paintFace(ctx, R, face, k === 'watermelon' || k === 'grape' || k === 'pomegranate' || k === 'fig');
}

function leafAt(ctx: CanvasRenderingContext2D, x: number, y: number, L: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = C.leaf;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(L * 0.5, -L * 0.35, L, 0);
  ctx.quadraticCurveTo(L * 0.5, L * 0.35, 0, 0);
  ctx.fill();
  ctx.strokeStyle = C.leafDark;
  ctx.lineWidth = Math.max(0.8, L * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(L * 0.85, 0);
  ctx.stroke();
  ctx.restore();
}

/** The little face: two eyes with a glint and a mouth; `light` = light features on a dark fruit. */
function paintFace(ctx: CanvasRenderingContext2D, R: number, face: Face, light: boolean): void {
  if (face === 'none' || R < 5) return;
  const ink = light ? 'rgba(255,248,230,.95)' : 'rgba(45,25,10,.9)';
  const ey = R * 0.05, ex = R * 0.3, er = Math.max(1.1, R * 0.09);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, R * 0.06);
  ctx.lineCap = 'round';
  if (face === 'happy') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * ex, ey + er * 0.6, er * 1.1, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * ex, ey, er, 0, TAU);
      ctx.fill();
    }
    if (!light) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * ex + er * 0.35, ey - er * 0.35, er * 0.38, 0, TAU);
        ctx.fill();
      }
    }
    if (face === 'worried') {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * ex - er * 1.2, ey - er * 2.2 + (s > 0 ? er * 0.6 : 0));
        ctx.lineTo(s * ex + er * 1.2, ey - er * 2.2 + (s > 0 ? 0 : er * 0.6));
        ctx.stroke();
      }
    }
  }
  ctx.beginPath();
  if (face === 'worried') ctx.arc(0, ey + R * 0.36, R * 0.1, Math.PI * 1.1, Math.PI * 1.9);
  else ctx.arc(0, ey + R * 0.16, R * (face === 'happy' ? 0.16 : 0.11), Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  // cheeks
  ctx.fillStyle = 'rgba(255,120,110,.28)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * R * 0.5, ey + R * 0.2, R * 0.12, R * 0.07, 0, 0, TAU);
    ctx.fill();
  }
}

/** The great cluster of Eshcol: a bunch of grapes in a circle's span, a vine leaf, gold glints. */
function paintCluster(ctx: CanvasRenderingContext2D, R: number, face: Face): void {
  const f = fruit(11);
  // a soft disc behind, so the silhouette reads as one round body
  ctx.fillStyle = 'rgba(49,20,68,.35)';
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  const rows = [3, 4, 5, 4, 3, 2];
  const br = R * 0.2;
  let y = -R * 0.62;
  rows.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * br * 1.62;
      const g = ctx.createRadialGradient(x - br * 0.35, y - br * 0.4, br * 0.1, x, y, br * 1.05);
      g.addColorStop(0, f.light);
      g.addColorStop(0.6, f.base);
      g.addColorStop(1, f.dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, br, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.arc(x - br * 0.35, y - br * 0.38, br * 0.22, 0, TAU);
      ctx.fill();
      if ((row + i) % 4 === 0) {
        ctx.fillStyle = 'rgba(255,214,94,.7)';
        ctx.beginPath();
        ctx.arc(x + br * 0.3, y - br * 0.2, br * 0.12, 0, TAU);
        ctx.fill();
      }
    }
    y += br * 1.42;
  });
  leafAt(ctx, -R * 0.1, -R * 0.82, R * 0.75, -0.5);
  leafAt(ctx, R * 0.05, -R * 0.85, R * 0.55, -2.3);
  ctx.save();
  ctx.translate(0, -R * 0.12);
  paintFace(ctx, R * 0.9, face, true);
  ctx.restore();
}

/** Sprites of every tier at a size (re-made on resize): drawn rotated and squashed every frame. */
export class FruitSprites {
  private cache = new Map<string, HTMLCanvasElement>();
  private S = 0;
  private dpr = 1;

  /** the backing store's pixels per CSS px of the sprites */
  get ratio(): number { return this.dpr; }

  setScale(S: number, dpr: number): void {
    if (Math.abs(S - this.S) < 0.5 && dpr === this.dpr) return;
    this.S = S;
    this.dpr = dpr;
    this.cache.clear();
  }

  get(tier: number, face: Face, R: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const px = Math.max(4, Math.round(R));
    const key = `${tier}|${face}|${px}`;
    let c = this.cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    const pad = px * 0.45 + 4;
    const size = Math.ceil((px * 2 + pad * 2) * this.dpr);
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.scale(this.dpr, this.dpr);
    ctx.translate(px + pad, px + pad);
    paintFruitBody(ctx, tier, px, face);
    if (this.cache.size > 160) this.cache.clear();
    this.cache.set(key, c);
    return c;
  }
}

/** A fruit at (x, y), radius R, turned by `angle`, squashed by `sq` (+ wider, − taller), with a face. */
export function paintFruit(ctx: CanvasRenderingContext2D, sprites: FruitSprites | null, tier: number, x: number, y: number, R: number,
  angle = 0, sq = 0, face: Face = 'calm', alpha = 1): void {
  if (R <= 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  // a soft shadow under it
  ctx.globalAlpha = alpha * 0.18;
  ctx.fillStyle = '#3a2412';
  ctx.beginPath();
  ctx.ellipse(R * 0.08, R * 0.12, R * (1 + sq * 0.5), R * (0.98 - sq * 0.5), 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.scale(1 + sq, 1 - sq);
  ctx.rotate(angle);
  const sp = sprites?.get(tier, face, R);
  if (sp) {
    const px = Math.max(4, Math.round(R));
    const k = R / px;
    const half = sp.width / sprites!.ratio / 2;
    ctx.drawImage(sp, -half * k, -half * k, half * 2 * k, half * 2 * k);
  } else paintFruitBody(ctx, tier, R, face);
  ctx.restore();
}

/** A fruit as a dark silhouette (not reached yet in the circle). */
export function paintSilhouette(ctx: CanvasRenderingContext2D, tier: number, x: number, y: number, R: number): void {
  const k = fruit(tier).kind;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(58,36,18,.28)';
  if (k === 'cluster') {
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
  } else bodyPath(ctx, k, R);
  ctx.fill();
  ctx.restore();
}

// ── Feliks the sparrow ──────────────────────────────────────────
export interface SparrowPose {
  /** −1 faces left, 1 right */
  flip: number;
  /** the wing beat phase and how hard (0 glides, 1 flaps) */
  flap: number;
  beat: number;
  /** 0..1: strains under a heavy fruit */
  strain: number;
  /** the beak open (talking) */
  talk: boolean;
  blink: boolean;
  /** eyes wide (the rim!) */
  scared: boolean;
  t: number;
}

/** Feliks at (x, y) = his feet; `s` his body length (px). */
export function paintSparrow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: SparrowPose): void {
  ctx.save();
  ctx.translate(x, y - s * 0.42);
  ctx.scale(p.flip, 1);
  const bob = Math.sin(p.t * 9) * s * 0.03 * p.flap;
  ctx.translate(0, bob);
  // tail
  ctx.fillStyle = '#6b4a2c';
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.02);
  ctx.lineTo(-s * 0.68, -s * 0.16 + p.strain * s * 0.1);
  ctx.lineTo(-s * 0.62, s * 0.08 + p.strain * s * 0.08);
  ctx.closePath();
  ctx.fill();
  // far wing
  const wing = Math.sin(p.beat) * p.flap;
  ctx.fillStyle = '#7a5434';
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, -s * 0.2 - wing * s * 0.25, s * 0.3, s * 0.12, -0.6 - wing * 0.8, 0, TAU);
  ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, -s * 0.35, 0, s * 0.3);
  g.addColorStop(0, '#a77a4c');
  g.addColorStop(1, '#8a5f38');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42, s * 0.3, -0.12, 0, TAU);
  ctx.fill();
  // belly
  ctx.fillStyle = '#efe0c2';
  ctx.beginPath();
  ctx.ellipse(s * 0.08, s * 0.1, s * 0.28, s * 0.17, -0.1, 0, TAU);
  ctx.fill();
  // near wing, streaked
  ctx.fillStyle = '#8c5d32';
  ctx.beginPath();
  ctx.ellipse(-s * 0.06, -s * 0.04 - wing * s * 0.18, s * 0.28, s * 0.14, -0.35 - wing * 0.9, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#4e3018';
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-s * (0.22 - i * 0.08), -s * (0.06 + wing * 0.18));
    ctx.lineTo(-s * (0.08 - i * 0.08), s * 0.02 - wing * s * 0.12);
    ctx.stroke();
  }
  // head: chestnut nape, grey crown, black bib (a house sparrow)
  const hx = s * 0.34, hy = -s * 0.24;
  ctx.fillStyle = '#9a6a3c';
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8b8b88';
  ctx.beginPath();
  ctx.arc(hx + s * 0.02, hy - s * 0.06, s * 0.17, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ctx.fillStyle = '#f2ead8';
  ctx.beginPath();
  ctx.ellipse(hx + s * 0.09, hy + s * 0.07, s * 0.11, s * 0.09, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.ellipse(hx + s * 0.13, hy + s * 0.17, s * 0.08, s * 0.07, 0, 0, TAU);
  ctx.fill();
  // eye
  const er = s * (p.scared ? 0.065 : 0.05);
  if (p.blink && !p.scared) {
    ctx.strokeStyle = '#1a0f08';
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.05, hy - s * 0.02);
    ctx.lineTo(hx + s * 0.15, hy - s * 0.02);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hx + s * 0.1, hy - s * 0.03, er * 1.35, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a0f08';
    ctx.beginPath();
    ctx.arc(hx + s * 0.11 + (p.strain > 0.5 ? s * 0.01 : 0), hy - s * 0.03, er, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hx + s * 0.125, hy - s * 0.05, er * 0.35, 0, TAU);
    ctx.fill();
  }
  // beak
  ctx.fillStyle = '#d9a04a';
  const open = p.talk ? Math.abs(Math.sin(p.t * 18)) * s * 0.05 : 0;
  ctx.beginPath();
  ctx.moveTo(hx + s * 0.18, hy - s * 0.0);
  ctx.lineTo(hx + s * 0.34, hy + s * 0.04 - open * 0.3);
  ctx.lineTo(hx + s * 0.18, hy + s * 0.06);
  ctx.closePath();
  ctx.fill();
  if (open > 0) {
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.18, hy + s * 0.07);
    ctx.lineTo(hx + s * 0.3, hy + s * 0.09 + open);
    ctx.lineTo(hx + s * 0.18, hy + s * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  // legs, gripping the stem below
  ctx.strokeStyle = '#c08850';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(-s * 0.02, s * 0.26);
  ctx.lineTo(0, s * 0.42 + p.strain * s * 0.04);
  ctx.moveTo(s * 0.1, s * 0.26);
  ctx.lineTo(s * 0.06, s * 0.42 + p.strain * s * 0.04);
  ctx.stroke();
  ctx.restore();
}

// ── the field ────────────────────────────────────────────────────
/** The sky, the low sun, the far and near hills with olive trees, the wheat field to the ground line. */
export function paintField(ctx: CanvasRenderingContext2D, w: number, h: number, ground: number, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, C.skyTop);
  sky.addColorStop(0.55, C.skyMid);
  sky.addColorStop(1, C.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sunX = w * 0.18, sunY = ground - Math.min(h * 0.55, ground * 0.62);
  glow(ctx, sunX, sunY, Math.max(w, h) * 0.45, 'rgba(255,240,200,', 0.55);
  ctx.fillStyle = C.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, Math.max(18, Math.min(w, h) * 0.06), 0, TAU);
  ctx.fill();
  // far hills
  const hill = (base: number, amp: number, freq: number, phase: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, ground);
    for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(x * freq + phase)) - amp * 0.3 * Math.sin(x * freq * 2.3 + phase * 2));
    ctx.lineTo(w, ground);
    ctx.closePath();
    ctx.fill();
  };
  const hz = ground - Math.min(h * 0.32, 220);
  hill(hz, Math.min(70, h * 0.09), 0.006, 1.2, C.hillFar);
  hill(hz + Math.min(60, h * 0.08), Math.min(46, h * 0.06), 0.009, 3.1, C.hillMid);
  // olive trees on the middle hill
  for (let i = 0; i < 9; i++) {
    const x = (hash(i) * 1.1 - 0.05) * w;
    const yb = hz + Math.min(60, h * 0.08) - Math.min(30, h * 0.04) * (0.4 + hash(i + 4) * 0.6);
    const r = Math.max(6, Math.min(16, h * 0.022)) * (0.7 + hash(i + 7) * 0.6);
    ctx.fillStyle = '#5e4a2a';
    ctx.fillRect(x - 1.5, yb - r * 0.4, 3, r * 0.9);
    ctx.fillStyle = i % 2 ? '#6f7d3c' : '#7f8a48';
    ctx.beginPath();
    ctx.ellipse(x, yb - r * 0.8, r * 1.2, r * 0.75, 0, 0, TAU);
    ctx.fill();
  }
  hill(hz + Math.min(110, h * 0.15), Math.min(26, h * 0.035), 0.004, 0.4, C.hillNear);
  // the wheat field
  const top = hz + Math.min(110, h * 0.15) + 6;
  const fg = ctx.createLinearGradient(0, top, 0, h);
  fg.addColorStop(0, C.field);
  fg.addColorStop(1, C.fieldDark);
  ctx.fillStyle = fg;
  ctx.fillRect(0, top, w, h - top);
  // rows of stubble, swaying a touch
  ctx.strokeStyle = 'rgba(160,110,40,.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const x = hash(i + 30) * w, y = top + (hash(i + 60) ** 0.7) * (h - top);
    const l = 4 + (y - top) * 0.03;
    const sway = Math.sin(t * 1.4 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sway, y - l);
    ctx.stroke();
  }
  // the soil path the basket stands on
  ctx.fillStyle = 'rgba(138,90,50,.28)';
  ctx.fillRect(0, ground - 2, w, Math.max(6, h - ground));
}

/**
 * The band's last 40 s as wheat along the ground (one stalk per bar): its height is the level, its
 * ear gold above the threshold, a cool tint in rest blocks, a grey dotted gap without signal, a
 * linen veil over a blind block until it ends.
 */
export function paintWheatTrace(ctx: CanvasRenderingContext2D, bars: readonly TraceBar[], x0: number, x1: number, y: number, hMax: number, t: number): void {
  const n = bars.length;
  if (!n) return;
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const x = x0 + (i + 0.5) * step;
    if (b.empty) continue;
    if (b.phase === 'rest') {
      ctx.fillStyle = 'rgba(159,198,216,.22)';
      ctx.fillRect(x - step / 2, y - hMax - 4, step + 0.5, hMax + 4);
    }
    if (b.shown < 1) {
      ctx.fillStyle = `rgba(243,234,214,${0.75 * (1 - b.shown)})`;
      ctx.fillRect(x - step / 2, y - hMax - 4, step + 0.5, hMax + 4);
      if (b.shown === 0) continue;
    }
    if (!b.reliable) {
      ctx.fillStyle = 'rgba(90,70,50,.45)';
      ctx.fillRect(x - 1, y - 3, 2, 2);
      continue;
    }
    const hh = hMax * (0.18 + 0.82 * clamp(b.level));
    const sway = Math.sin(t * 1.6 + i * 0.4) * 1.5;
    ctx.globalAlpha = b.shown;
    ctx.strokeStyle = b.above ? '#c99a30' : '#b9a27a';
    ctx.lineWidth = Math.max(1, step * 0.18);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x, y - hh * 0.6, x + sway, y - hh);
    ctx.stroke();
    ctx.fillStyle = b.above ? C.gold : '#d8c7a2';
    ctx.beginPath();
    ctx.ellipse(x + sway, y - hh, Math.max(1.5, step * 0.28), Math.max(3, step * 0.6), sway * 0.05, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ── the basket ───────────────────────────────────────────────────
export interface BasketPaint {
  /** inner left, right, floor and rim (px) */
  x0: number;
  x1: number;
  floor: number;
  rim: number;
  /** wall thickness (px) */
  wall: number;
  /** 0..1 of the rim's height lit by the wind's charge */
  charge: number;
  /** the charge is hidden (a blind block) */
  veiled: boolean;
  /** 0..1 the glow of a full charge, and of the wind blowing */
  burst: number;
  t: number;
}

/** The back weave (inside), lit by the charge rising from the floor. */
export function paintBasketBack(ctx: CanvasRenderingContext2D, b: BasketPaint): void {
  const w = b.x1 - b.x0, h = b.floor - b.rim;
  const g = ctx.createLinearGradient(0, b.rim, 0, b.floor);
  g.addColorStop(0, '#8a5a2c');
  g.addColorStop(1, '#5e3a1a');
  ctx.fillStyle = g;
  ctx.fillRect(b.x0, b.rim, w, h);
  // the charge: golden light rising in the weave
  if (!b.veiled && b.charge > 0) {
    const top = b.floor - h * clamp(b.charge);
    const cg = ctx.createLinearGradient(0, top, 0, b.floor);
    cg.addColorStop(0, `rgba(255,214,94,${0.5 + 0.3 * b.burst})`);
    cg.addColorStop(1, 'rgba(255,170,60,.35)');
    ctx.fillStyle = cg;
    ctx.fillRect(b.x0, top, w, b.floor - top);
    ctx.strokeStyle = `rgba(255,240,180,${0.7 + 0.3 * Math.sin(b.t * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = b.x0; x <= b.x1; x += 6) ctx.lineTo(x, top + Math.sin(x * 0.08 + b.t * 4) * 2);
    ctx.stroke();
  }
  if (b.burst > 0) {
    ctx.fillStyle = `rgba(255,236,170,${0.35 * b.burst})`;
    ctx.fillRect(b.x0, b.rim, w, h);
  }
  // the weave: horizontal bands over vertical staves
  ctx.strokeStyle = 'rgba(40,22,8,.35)';
  ctx.lineWidth = 1;
  const band = Math.max(8, h / 14);
  for (let y = b.rim + band; y < b.floor; y += band) {
    ctx.beginPath();
    ctx.moveTo(b.x0, y);
    ctx.lineTo(b.x1, y);
    ctx.stroke();
  }
  const stave = Math.max(14, w / 12);
  ctx.strokeStyle = 'rgba(255,220,160,.08)';
  ctx.lineWidth = Math.max(2, stave * 0.3);
  for (let x = b.x0 + stave / 2; x < b.x1; x += stave) {
    ctx.beginPath();
    ctx.moveTo(x, b.rim);
    ctx.lineTo(x, b.floor);
    ctx.stroke();
  }
  // a darker band of shade behind the fruit at the floor
  const sh = ctx.createLinearGradient(0, b.floor - h * 0.2, 0, b.floor);
  sh.addColorStop(0, 'rgba(30,15,5,0)');
  sh.addColorStop(1, 'rgba(30,15,5,.25)');
  ctx.fillStyle = sh;
  ctx.fillRect(b.x0, b.floor - h * 0.2, w, h * 0.2);
}

function wickerBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, vertical: boolean): void {
  const g = vertical ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, C.wickerLight);
  g.addColorStop(0.5, C.wicker);
  g.addColorStop(1, C.wickerDark);
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.35);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,15,.45)';
  ctx.lineWidth = 1;
  const step = Math.max(6, Math.min(w, h) * 0.8);
  ctx.beginPath();
  if (vertical) for (let yy = y + step; yy < y + h; yy += step) { ctx.moveTo(x + 1, yy); ctx.lineTo(x + w - 1, yy - step * 0.3); }
  else for (let xx = x + step; xx < x + w; xx += step) { ctx.moveTo(xx, y + 1); ctx.lineTo(xx - step * 0.3, y + h - 1); }
  ctx.stroke();
}

/** The posts and the base (in front of the fruit). */
export function paintBasketFront(ctx: CanvasRenderingContext2D, b: BasketPaint): void {
  const wall = b.wall;
  wickerBar(ctx, b.x0 - wall, b.rim - wall * 0.4, wall, b.floor - b.rim + wall * 1.4, true);
  wickerBar(ctx, b.x1, b.rim - wall * 0.4, wall, b.floor - b.rim + wall * 1.4, true);
  wickerBar(ctx, b.x0 - wall * 1.2, b.floor, b.x1 - b.x0 + wall * 2.4, wall * 1.1, false);
}

export interface RimPaint {
  /** the wind's strength 0..1 (0.5 = the threshold), null = hidden (veil / no signal) */
  wind: number | null;
  /** the rim is the gauge now (a push block) */
  live: boolean;
  /** the rim's danger flash 0..1 and the overflow's progress 0..1 */
  danger: number;
  over: number;
  /** the gauge is waiting out the band's delay */
  waiting: boolean;
  t: number;
}

/**
 * The rim: a woven band across the top — the overflow line — that is also the wind's gauge: it fills
 * from the left with the wind's strength, a gold wheat-ear notch marks the threshold at its middle,
 * and past it the fill turns gold.  In danger the twine flashes red and a red line runs across.
 */
export function paintRim(ctx: CanvasRenderingContext2D, b: BasketPaint, r: RimPaint): void {
  const x0 = b.x0 - b.wall, x1 = b.x1 + b.wall, w = x1 - x0;
  const hh = Math.max(12, b.wall * 1.35), y = b.rim - hh / 2;
  // the band
  ctx.fillStyle = 'rgba(58,36,18,.55)';
  roundRect(ctx, x0, y, w, hh, hh / 2);
  ctx.fill();
  if (r.live) {
    const v = r.wind === null ? 0 : clamp(r.wind);
    if (r.wind !== null) {
      const fill = (w - 4) * v;
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, '#f3e7c9');
      g.addColorStop(0.5, '#f3e7c9');
      g.addColorStop(0.5, C.gold);
      g.addColorStop(1, C.goldDeep);
      ctx.fillStyle = g;
      roundRect(ctx, x0 + 2, y + 2, Math.max(hh - 4, fill), hh - 4, (hh - 4) / 2);
      ctx.fill();
    } else {
      // veiled: linen over the gauge
      ctx.fillStyle = 'rgba(243,234,214,.85)';
      roundRect(ctx, x0 + 2, y + 2, w - 4, hh - 4, (hh - 4) / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,160,120,.6)';
      ctx.lineWidth = 1;
      for (let x = x0 + 8; x < x1 - 4; x += 7) {
        ctx.beginPath();
        ctx.moveTo(x, y + 3);
        ctx.lineTo(x + 3, y + hh - 3);
        ctx.stroke();
      }
    }
    if (r.waiting) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(r.t * 5)})`;
      roundRect(ctx, x0 + 2, y + 2, w - 4, hh - 4, (hh - 4) / 2);
      ctx.fill();
    }
  } else {
    // the plain twine of a rim
    ctx.strokeStyle = C.wickerLight;
    ctx.lineWidth = hh * 0.45;
    ctx.beginPath();
    ctx.moveTo(x0 + hh / 2, b.rim);
    ctx.lineTo(x1 - hh / 2, b.rim);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,56,24,.6)';
    ctx.lineWidth = 1;
    for (let x = x0 + 6; x < x1 - 4; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, b.rim - hh * 0.2);
      ctx.lineTo(x + 4, b.rim + hh * 0.2);
      ctx.stroke();
    }
  }
  // the threshold: a wheat ear standing on the middle of the rim, a dotted tick through the band
  const mx = (x0 + x1) / 2;
  if (r.live) {
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, y - 3);
    ctx.lineTo(mx, y + hh + 3);
    ctx.stroke();
    ctx.setLineDash([]);
    const on = r.wind !== null && r.wind >= 0.5;
    ctx.fillStyle = on ? C.gold : '#e8d7b0';
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    const k = Math.max(1, hh / 12);
    ctx.beginPath();
    ctx.moveTo(mx, y);
    ctx.lineTo(mx, y - 18 * k);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(mx + s * 2.6 * k, y - 6 * k - i * 4.6 * k, 2.4 * k, 3.6 * k, s * 0.4, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  if (r.danger > 0) {
    ctx.strokeStyle = `rgba(226,72,58,${0.35 + 0.55 * r.danger * (0.5 + 0.5 * Math.sin(r.t * 14))})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(x0, b.rim);
    ctx.lineTo(x1, b.rim);
    ctx.stroke();
    ctx.setLineDash([]);
    if (r.over > 0) {
      ctx.fillStyle = C.danger;
      roundRect(ctx, x0, y + hh + 3, w * clamp(r.over), 4, 2);
      ctx.fill();
    }
  }
}

// ── the gleaners ─────────────────────────────────────────────────
/** A gleaner at (x, y) = feet, `s` tall: a head-cloth, a tunic, a little basket; `bend` 0 stands, 1 reaches down. */
export function paintGleaner(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, bend: number, tunic: string, cloth: string, flip = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  const lean = bend * 0.55;
  // legs and robe
  ctx.fillStyle = tunic;
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, 0);
  ctx.lineTo(s * 0.16, 0);
  ctx.lineTo(s * 0.1 + Math.sin(lean) * s * 0.3, -s * 0.55);
  ctx.lineTo(-s * 0.08 + Math.sin(lean) * s * 0.3, -s * 0.55);
  ctx.closePath();
  ctx.fill();
  // torso
  ctx.save();
  ctx.translate(0, -s * 0.5);
  ctx.rotate(lean);
  ctx.fillStyle = tunic;
  roundRect(ctx, -s * 0.11, -s * 0.34, s * 0.24, s * 0.38, s * 0.08);
  ctx.fill();
  // arm reaching
  ctx.strokeStyle = '#c48c5c';
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.06, -s * 0.26);
  ctx.lineTo(s * 0.16 + bend * s * 0.06, -s * 0.06 + bend * s * 0.14);
  ctx.stroke();
  // head and cloth
  ctx.fillStyle = '#c48c5c';
  ctx.beginPath();
  ctx.arc(s * 0.02, -s * 0.44, s * 0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.arc(s * 0.0, -s * 0.46, s * 0.12, Math.PI * 0.85, Math.PI * 2.1);
  ctx.lineTo(-s * 0.12, -s * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** The gleaners' basket at their feet with what they gathered, and their step's ring (the calm pace) around it. */
export function paintGleanBasket(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, step: number | null, count: number): void {
  const w = s * 0.42, h = s * 0.2;
  // gathered fruit peeking out
  for (let i = 0; i < Math.min(5, count); i++) {
    const f = FRUITS[(i * 2) % 3];
    ctx.fillStyle = f.base;
    ctx.beginPath();
    ctx.arc(x - w * 0.3 + i * w * 0.15, y - h - s * 0.02, s * 0.05, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.wicker;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h);
  ctx.lineTo(x + w / 2, y - h);
  ctx.lineTo(x + w * 0.4, y);
  ctx.lineTo(x - w * 0.4, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.wickerDark;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (step !== null) {
    const cy = y - h - s * 0.32, R = s * 0.13;
    ctx.strokeStyle = 'rgba(58,36,18,.35)';
    ctx.lineWidth = Math.max(3, s * 0.035);
    ctx.beginPath();
    ctx.arc(x, cy, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = C.cool;
    ctx.beginPath();
    ctx.arc(x, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(step));
    ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.arc(x, cy, R * 0.45, 0, TAU);
    ctx.fill();
  }
}

// ── the table ────────────────────────────────────────────────────
/** The village table on the ground, with the festivals' decorations and the baskets already carried to it. */
export function paintTable(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, decor: readonly DecorId[], baskets: number, t: number): void {
  const h = w * 0.36, top = y - h;
  // legs
  ctx.fillStyle = '#6b4424';
  ctx.fillRect(x + w * 0.08, top, w * 0.05, h);
  ctx.fillRect(x + w * 0.87, top, w * 0.05, h);
  // the board, the cloth when set
  const cloth = decor.includes('obrus');
  ctx.fillStyle = cloth ? C.linen : '#8a5a32';
  roundRect(ctx, x, top - w * 0.04, w, w * 0.06, 3);
  ctx.fill();
  if (cloth) {
    ctx.fillStyle = C.linen;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, top);
    ctx.lineTo(x + w * 0.98, top + h * 0.38);
    for (let i = 10; i >= 0; i--) ctx.lineTo(x + w * 0.02 + (w * 0.96 * i) / 10, top + h * (0.36 + (i % 2) * 0.04));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#b5523b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, top + h * 0.3);
    ctx.lineTo(x + w - 2, top + h * 0.3);
    ctx.stroke();
  }
  const surf = top - w * 0.04;
  // baskets carried here: a row of small full baskets
  const n = Math.min(6, baskets);
  for (let i = 0; i < n; i++) {
    const bx = x + w * 0.1 + i * w * 0.14, bw = w * 0.12;
    ctx.fillStyle = FRUITS[4 + (i % 5)].base;
    ctx.beginPath();
    ctx.arc(bx + bw * 0.3, surf - bw * 0.42, bw * 0.2, 0, TAU);
    ctx.arc(bx + bw * 0.65, surf - bw * 0.45, bw * 0.24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.wicker;
    ctx.fillRect(bx, surf - bw * 0.36, bw, bw * 0.36);
  }
  if (decor.includes('chleby')) {
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = '#c98a3e';
      ctx.beginPath();
      ctx.ellipse(x + w * (0.25 + i * 0.12), surf - w * 0.03, w * 0.06, w * 0.035, 0, Math.PI, 0);
      ctx.fill();
    }
  }
  if (decor.includes('oliwa')) {
    ctx.fillStyle = '#a65a2e';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.62, surf - w * 0.06, w * 0.045, w * 0.06, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(x + w * 0.605, surf - w * 0.14, w * 0.03, w * 0.04);
  }
  if (decor.includes('lampy')) {
    for (let i = 0; i < 3; i++) {
      const lx = x + w * (0.4 + i * 0.18), ly = surf - w * 0.02;
      ctx.fillStyle = '#b06a34';
      ctx.beginPath();
      ctx.ellipse(lx, ly, w * 0.035, w * 0.015, 0, 0, TAU);
      ctx.fill();
      glow(ctx, lx + w * 0.03, ly - w * 0.03, w * 0.06, 'rgba(255,214,120,', 0.7);
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.ellipse(lx + w * 0.03, ly - w * 0.025 + Math.sin(t * 9 + i) * 0.6, w * 0.008, w * 0.016, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (decor.includes('snop')) {
    const sx0 = x + w * 0.86, sy0 = surf;
    ctx.strokeStyle = C.goldDeep;
    ctx.lineWidth = 1.5;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx0 + i * w * 0.012, sy0 - w * 0.2);
      ctx.stroke();
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.ellipse(sx0 + i * w * 0.012, sy0 - w * 0.21, 1.6, 4, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (decor.includes('wieniec')) {
    ctx.strokeStyle = C.goldDeep;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) ctx.lineTo(x + (w * i) / 12, top + h * 0.12 + Math.sin(i * 0.9) * 4 + 6 * Math.sin((i / 12) * Math.PI));
    ctx.stroke();
  }
}

// ── cards ────────────────────────────────────────────────────────
/** A cream card with a soft shadow. */
export function paintCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(58,36,18,.28)';
  roundRect(ctx, x + 3, y + 5, w, h, 16);
  ctx.fill();
  ctx.fillStyle = C.cream;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(184,128,63,.55)';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 12);
  ctx.stroke();
  ctx.restore();
}

/** A five-pointed star (the basket's stars). */
export function paintStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, on: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = on ? C.gold : 'rgba(58,36,18,.15)';
  ctx.fill();
  ctx.strokeStyle = on ? C.goldDeep : 'rgba(58,36,18,.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Feliks's speech bubble (wrapped, max ~220 px), its tail toward (tx, ty). */
export function paintBubble(ctx: CanvasRenderingContext2D, lines: readonly string[], x: number, y: number, w: number, lineH: number, tx: number, ty: number, alpha: number): void {
  const h = lines.length * lineH + 14;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(58,36,18,.22)';
  roundRect(ctx, x + 2, y + 3, w, h, 12);
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  // the tail
  const bx = Math.max(x + 14, Math.min(x + w - 14, tx));
  const by = ty < y ? y : y + h;
  ctx.beginPath();
  ctx.moveTo(bx - 7, by);
  ctx.lineTo(tx, ty);
  ctx.lineTo(bx + 7, by);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(184,128,63,.6)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x + 10, y + 7 + i * lineH));
  ctx.restore();
}
