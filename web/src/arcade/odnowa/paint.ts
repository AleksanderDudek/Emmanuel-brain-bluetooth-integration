/**
 * Odnowa's pictures, drawn in code (no image files, no generated art): a living cell at night — a deep
 * teal cytoplasm lit from within, the engine lens with the ATP synthase seen face-on (the c-ring's eight
 * vanes, the α₃β₃ head with its three golden catalytic β, the bent γ shaft), golden ATP, the double helix
 * with its grooves, the repair crews, violet lysosomes, worn parts and the phagophore, mitosis, and Mito.
 *
 * Fill rate (DESIGN §12): no shadowBlur and no filter per frame — light is baked into small glow sprites
 * (`glowSprite`) drawn with 'lighter'; static layers are cached by the view.
 */
import { MIN_TEXT } from '../kit/mobile';
import { wrapLines } from '../kit/scripture';
import type { LesionKind, NicheId, PartKind, StepId } from './content';
import { NICHE } from './content';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
const TAU = Math.PI * 2;

export const C = {
  ink: '#06161a',
  cream: '#fff6e6',
  gold: '#ffc94d',
  goldHi: '#fff1b8',
  proton: '#ff8fb8',
  electron: '#8ff0ff',
  mint: '#7ff2c4',
  violet: '#b892ff',
  red: '#ff4d63',
  amber: '#ffb347',
  rest: '#8fd0ff',
  alpha: '#c7b8ff',
  beta: '#ffcf6b',
  vane: '#4fe0d0',
} as const;

/** A canvas font, never under MIN_TEXT (11 px); text the player must read asks for 13 px and more itself. */
export const fontPx = (px: number): number => Math.max(MIN_TEXT, Math.round(px * 2) / 2);
export const font = (px: number, weight = 700, serif = false, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${fontPx(px)}px ${serif ? SERIF : SANS}`;

/** Fit a text into a width by shrinking the font down to `min` px (never under MIN_TEXT); returns the size used. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min = MIN_TEXT, weight = 700, serif = false, italic = false): number {
  const floor = Math.max(MIN_TEXT, min);
  let size = fontPx(Math.max(floor, px));
  ctx.font = font(size, weight, serif, italic);
  while (size > floor && ctx.measureText(text).width > maxW) {
    size = Math.max(floor, size - 0.5);
    ctx.font = font(size, weight, serif, italic);
  }
  return size;
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** A stable pseudo-random 0..1 for a number (decorations that never jump). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const hex = (c: string): [number, number, number] => {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
export const rgba = (c: string, a: number): string => {
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

// ── light: baked glow sprites ─────────────────────────────────────
const sprites = new Map<string, HTMLCanvasElement | null>();

/** A soft round glow of a colour (64 px, drawn scaled); null where no canvas exists (tests). */
export function glowSprite(color: string): HTMLCanvasElement | null {
  if (sprites.has(color)) return sprites.get(color)!;
  let c: HTMLCanvasElement | null = null;
  try {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (!g) c = null;
    else {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, rgba(color, 1));
      grad.addColorStop(0.25, rgba(color, 0.55));
      grad.addColorStop(0.6, rgba(color, 0.14));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
  } catch {
    c = null;
  }
  sprites.set(color, c);
  return c;
}

/** Additive light at (x, y) of radius r. */
export function glow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, a: number): void {
  const s = glowSprite(color);
  if (!s || a <= 0.003 || r <= 0.5) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = ga;
}

// ── the cell city (cached by the view) ───────────────────────────
export interface CityShape {
  w: number; h: number;
  lens: { x: number; y: number; r: number };
  lane: { x: number; y: number; w: number; h: number };
  nucleus: { x: number; y: number; r: number };
  top: number;
}

/** The backdrop: cytoplasm, far organelles, the nucleus, the ER with ribosomes, the Golgi, microtubules, the membrane at the edges. */
export function paintCity(ctx: CanvasRenderingContext2D, s: CityShape, niche: NicheId, seed = 7): void {
  const n = NICHE[niche];
  const { w, h } = s;
  const g = ctx.createRadialGradient(s.lens.x, s.lens.y, s.lens.r * 0.3, s.lens.x, s.lens.y, Math.max(w, h) * 0.85);
  g.addColorStop(0, n.light);
  g.addColorStop(0.55, mix(n.light, n.deep, 0.55));
  g.addColorStop(1, n.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // the far layer: soft blobs of other organelles, out of focus
  for (let i = 0; i < 26; i++) {
    const x = hash(seed + i * 3.1) * w, y = s.top + hash(seed + i * 7.7) * (h - s.top);
    const r = 18 + hash(seed + i * 1.9) * Math.min(w, h) * 0.12;
    const tone = i % 3 === 0 ? '#ff9f8a' : i % 3 === 1 ? '#8fe3c8' : '#a9b8ff';
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, rgba(tone, 0.09));
    gg.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // microtubules: long, faint, gently curved tracks
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const ax = hash(seed + i * 5.3) * w, ay = s.top + hash(seed + i * 2.2) * (h - s.top);
    const bx = hash(seed + i * 9.1) * w, by = s.top + hash(seed + i * 4.4) * (h - s.top);
    ctx.strokeStyle = 'rgba(160,240,255,0.07)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2 + (hash(i + 3) - 0.5) * 120, (ay + by) / 2 + (hash(i + 9) - 0.5) * 120, bx, by);
    ctx.stroke();
  }
  // the nucleus, half off the lane's side: double membrane, pores, chromatin
  const nu = s.nucleus;
  const ng = ctx.createRadialGradient(nu.x, nu.y, nu.r * 0.1, nu.x, nu.y, nu.r);
  ng.addColorStop(0, 'rgba(96,84,170,0.34)');
  ng.addColorStop(0.8, 'rgba(70,60,140,0.26)');
  ng.addColorStop(1, 'rgba(70,60,140,0.0)');
  ctx.fillStyle = ng;
  ctx.beginPath();
  ctx.arc(nu.x, nu.y, nu.r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,175,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(nu.x, nu.y, nu.r * 0.93, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,175,255,0.12)';
  ctx.beginPath();
  ctx.arc(nu.x, nu.y, nu.r * 0.97, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    ctx.fillStyle = 'rgba(220,210,255,0.25)';
    ctx.beginPath();
    ctx.arc(nu.x + Math.cos(a) * nu.r * 0.95, nu.y + Math.sin(a) * nu.r * 0.95, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(200,190,255,0.10)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 14; i++) {
    const a = hash(seed + i) * TAU, rr0 = nu.r * (0.15 + 0.7 * hash(seed + i * 2));
    ctx.beginPath();
    ctx.arc(nu.x + Math.cos(a) * rr0 * 0.4, nu.y + Math.sin(a) * rr0 * 0.4, rr0 * 0.3, a, a + 2.4);
    ctx.stroke();
  }
  // the endoplasmic reticulum: ribbons with ribosomes, and a Golgi stack
  for (let k = 0; k < 3; k++) {
    const y0 = s.top + (h - s.top) * (0.18 + 0.27 * k) + (hash(seed + k) - 0.5) * 30;
    const right = k % 2 === 0;
    const xa = right ? w * 0.72 : w * 0.02, xb = right ? w * 1.02 : w * 0.3;
    ctx.strokeStyle = 'rgba(120,210,220,0.13)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = xa; x <= xb; x += 6) {
      const y = y0 + Math.sin((x / w) * 14 + k) * 10;
      if (x === xa) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,255,240,0.22)';
    for (let x = xa; x <= xb; x += 11) {
      const y = y0 + Math.sin((x / w) * 14 + k) * 10;
      ctx.beginPath();
      ctx.arc(x, y - 5, 1.5, 0, TAU);
      ctx.arc(x + 5, y + 5, 1.5, 0, TAU);
      ctx.fill();
    }
  }
  const gx = w * 0.86, gy = s.top + (h - s.top) * 0.42;
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(255,200,120,${0.14 - i * 0.025})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(gx + i * 7, gy, 30 + i * 4, Math.PI * 0.62, Math.PI * 1.38);
    ctx.stroke();
  }
  // free ribosomes: a fine dust
  for (let i = 0; i < 90; i++) {
    const x = hash(seed + i * 0.37) * w, y = s.top + hash(seed + i * 0.91) * (h - s.top);
    ctx.fillStyle = `rgba(210,255,240,${0.06 + 0.1 * hash(i)})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  // the cell's own membrane in the far corners: we are inside
  ctx.lineWidth = 3;
  for (const [cx, cy, r] of [[-w * 0.08, h * 1.05, Math.max(w, h) * 0.55], [w * 1.08, s.top - h * 0.05, Math.max(w, h) * 0.4]] as const) {
    ctx.strokeStyle = rgba(n.rim, 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = rgba(n.rim, 0.07);
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 3;
  }
  // a vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,8,10,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

// ── Mito ─────────────────────────────────────────────────────────
export interface MitoPose { t: number; talk: boolean; blink: number; joy: number; tired: number; look: number }

/** Mito, the cell's power plant: a coral capsule with cream cristae, big eyes, a smile; `r` is half its height. */
export function paintMito(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: MitoPose): void {
  const bob = Math.sin(p.t * 2.1) * r * 0.08 * (1 + p.joy);
  const L = r * 1.7;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(Math.sin(p.t * 1.3) * 0.05 + p.look * 0.08);
  glow(ctx, '#ff9f7a', 0, 0, r * 2.6, 0.35 + p.joy * 0.25);
  // body
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#ffb39a');
  g.addColorStop(1, '#e8604f');
  ctx.fillStyle = g;
  rr(ctx, -L, -r, L * 2, r * 2, r);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.strokeStyle = '#7a2a2a';
  ctx.stroke();
  // the cristae: the inner membrane's folds
  ctx.save();
  rr(ctx, -L + r * 0.22, -r * 0.78, L * 2 - r * 0.44, r * 1.56, r * 0.78);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,240,220,0.75)';
  ctx.lineWidth = Math.max(1.2, r * 0.13);
  for (let i = -3; i <= 3; i++) {
    const cx = i * L * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, i % 2 ? -r : r);
    ctx.quadraticCurveTo(cx + r * 0.25, 0, cx, i % 2 ? r * 0.25 : -r * 0.25);
    ctx.stroke();
  }
  ctx.restore();
  // face: eyes, cheeks, mouth
  const ex = r * 0.5, ey = -r * 0.12, er = r * 0.3;
  const shut = Math.min(1, p.blink + p.tired * 0.5);
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#fffaf2';
    ctx.beginPath();
    ctx.ellipse(sx * ex, ey, er, er * (1 - shut * 0.9), 0, 0, TAU);
    ctx.fill();
    if (shut < 0.8) {
      ctx.fillStyle = '#2a1414';
      ctx.beginPath();
      ctx.arc(sx * ex + p.look * er * 0.35, ey + er * 0.1, er * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx * ex + p.look * er * 0.35 + er * 0.2, ey - er * 0.15, er * 0.18, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,120,130,0.55)';
    ctx.beginPath();
    ctx.ellipse(sx * (ex + er * 1.1), ey + er * 1.2, er * 0.45, er * 0.28, 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#5a1e1e';
  ctx.fillStyle = '#7a2230';
  ctx.lineWidth = Math.max(1.2, r * 0.1);
  const open = p.talk ? 0.35 + 0.35 * Math.abs(Math.sin(p.t * 14)) : 0;
  ctx.beginPath();
  if (open > 0.05) {
    ctx.ellipse(0, r * 0.42, r * 0.22, r * 0.2 * open + r * 0.04, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.arc(0, r * 0.28, r * (0.22 + 0.08 * p.joy), 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/** An extra mitochondrion (biogenesis): a small capsule with a turbine glow that spins. */
export function paintMitoSmall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, spin: number, flash: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  glow(ctx, '#ffb38a', 0, 0, r * 2.4, 0.25 + flash * 0.6);
  const L = r * 1.6;
  const g = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
  g.addColorStop(0, '#ffb39a');
  g.addColorStop(1, '#d9564a');
  ctx.fillStyle = g;
  rr(ctx, -L, -r * 0.7, L * 2, r * 1.4, r * 0.7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,42,42,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,220,0.65)';
  ctx.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * L * 0.35, i % 2 ? -r * 0.6 : r * 0.6);
    ctx.lineTo(i * L * 0.35, 0);
    ctx.stroke();
  }
  // a little turbine in its middle
  ctx.rotate(spin * TAU);
  ctx.strokeStyle = rgba(C.gold, 0.85);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
    ctx.lineTo(-Math.cos(a) * r * 0.4, -Math.sin(a) * r * 0.4);
    ctx.stroke();
  }
  ctx.restore();
  void t;
}

// ── the engine lens ──────────────────────────────────────────────
/** The lens's glass backdrop (cached): the inner membrane seen face-on, a lattice of lipid heads. */
export function paintLensBack(ctx: CanvasRenderingContext2D, r: number, deep = '#140d33'): void {
  const g = ctx.createRadialGradient(0, -r * 0.2, r * 0.05, 0, 0, r);
  g.addColorStop(0, '#3b2a78');
  g.addColorStop(0.65, '#21184e');
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  const step = Math.max(6, r * 0.075);
  ctx.fillStyle = 'rgba(200,190,255,0.10)';
  for (let y = -r; y <= r; y += step * 0.87) {
    const row = Math.round(y / (step * 0.87));
    for (let x = -r; x <= r; x += step) {
      const xx = x + (row % 2 ? step / 2 : 0);
      if (xx * xx + y * y > r * r * 0.96) continue;
      ctx.beginPath();
      ctx.arc(xx, y, step * 0.18, 0, TAU);
      ctx.fill();
    }
  }
}

export interface TurbineState {
  /** the rotor's angle in turns */
  angle: number;
  /** the gradient 0..1 (how many protons crowd) and the spin (turns/s) */
  grad: number;
  spin: number;
  /** 0..1 pulses of the three β subunits (an ATP released) */
  beta: [number, number, number];
  surge: number;
  t: number;
  /** the gauge is hidden (a blind block): the vanes run dim and even */
  veiled: boolean;
  /** the rest: the engine idles in cooler light */
  rest: number;
}

/** The pumps (complexes I, III, IV) on the lens's lower rim: their angles. */
export const PUMP_ANGLES = [Math.PI * 0.62, Math.PI * 0.8, Math.PI * 0.98] as const;
/** Where protons enter the c-ring (the a-subunit's half-channel). */
export const ENTRY_ANGLE = Math.PI * 1.18;

/** The rotor, the head and the shaft, centred at 0,0 (the caller translates); `r` is the lens radius. */
export function paintTurbine(ctx: CanvasRenderingContext2D, r: number, s: TurbineState): void {
  const rot = s.angle * TAU;
  const hot = s.veiled ? 0.25 : Math.min(1, 0.3 + s.grad * 0.8 + s.surge);
  const cool = s.rest;
  // the pumps of the respiratory chain on the rim
  PUMP_ANGLES.forEach((a, i) => {
    const px = Math.cos(a) * r * 0.86, py = Math.sin(a) * r * 0.86, pr = r * 0.1;
    const beat = 0.5 + 0.5 * Math.sin(s.t * (3 + s.grad * 9) + i * 2.1);
    glow(ctx, i === 0 ? '#ff9fd0' : i === 1 ? '#ffb3e0' : '#ff8fb8', px, py, pr * 2.6, 0.18 + 0.4 * hot * beat);
    ctx.fillStyle = i === 0 ? '#7d4fc9' : i === 1 ? '#6a49b8' : '#8a56c8';
    ctx.beginPath();
    if (i === 0) {
      // complex I: the boot (L-shaped)
      rr(ctx, px - pr, py - pr * 0.7, pr * 2, pr * 1.4, pr * 0.5);
      ctx.fill();
      rr(ctx, px - pr * 0.6, py - pr * 1.5, pr * 1, pr * 1.2, pr * 0.4);
      ctx.fill();
    } else if (i === 1) {
      // complex III: a dimer
      ctx.arc(px - pr * 0.5, py, pr * 0.75, 0, TAU);
      ctx.arc(px + pr * 0.5, py, pr * 0.75, 0, TAU);
      ctx.fill();
    } else {
      ctx.arc(px, py, pr * 0.9, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,220,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });
  // the pumps' names on a big lens
  if (r >= 70) {
    ctx.font = font(Math.max(11, r * 0.085), 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,240,255,0.9)';
    PUMP_ANGLES.forEach((a, i) => ctx.fillText(['I', 'III', 'IV'][i], Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86 + (i === 0 ? r * 0.02 : 0)));
  }
  // the c-ring: a wheel of eight vanes, a proton in each from the entry around to the exit
  const R0 = r * 0.42, R1 = r * 0.74;
  ctx.strokeStyle = rgba(cool > 0.5 ? '#8fd0ff' : C.vane, 0.22 + 0.2 * hot);
  ctx.lineWidth = (R1 - R0) * 0.55;
  ctx.beginPath();
  ctx.arc(0, 0, (R0 + R1) / 2, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220,255,250,0.35)';
  ctx.lineWidth = 1.2;
  for (const rad of [R0 + r * 0.02, R1 - r * 0.02]) {
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * TAU;
    const rel = (((a - ENTRY_ANGLE) % TAU) + TAU) % TAU;
    const loaded = !s.veiled && rel < TAU * 0.86;
    ctx.save();
    ctx.rotate(a);
    const g = ctx.createLinearGradient(R0, 0, R1, 0);
    g.addColorStop(0, rgba(cool > 0.5 ? '#5aa7c9' : C.vane, 0.55));
    g.addColorStop(1, rgba(cool > 0.5 ? '#8fd0ff' : '#9ffff0', 0.95));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(R0, -r * 0.05);
    ctx.lineTo(R1, -r * 0.12);
    ctx.quadraticCurveTo(R1 + r * 0.05, 0, R1, r * 0.12);
    ctx.lineTo(R0, r * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,255,250,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (loaded) {
      ctx.fillStyle = C.proton;
      ctx.beginPath();
      ctx.arc(R1 - r * 0.07, 0, r * 0.035 + 1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (loaded) glow(ctx, C.proton, Math.cos(a) * (R1 - r * 0.07), Math.sin(a) * (R1 - r * 0.07), r * 0.1, 0.35 * hot);
  }
  // the head: α₃β₃, six lobes, the three β golden (they make the ATP)
  const H = r * 0.27, lr = r * 0.15;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * TAU;
    const x = Math.cos(a) * H, y = Math.sin(a) * H;
    const isBeta = i % 2 === 0;
    const pulse = isBeta ? s.beta[i / 2] : 0;
    if (isBeta) glow(ctx, C.gold, x, y, lr * (2.2 + pulse * 2), 0.25 + pulse * 0.7 + hot * 0.15);
    const lg = ctx.createRadialGradient(x - lr * 0.3, y - lr * 0.3, lr * 0.1, x, y, lr * (1 + pulse * 0.15));
    lg.addColorStop(0, isBeta ? '#fff2c4' : '#d9ccff');
    lg.addColorStop(1, isBeta ? (cool > 0.5 ? '#d8b26a' : '#ffb43a') : '#8a72e6');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(x, y, lr * (1 + pulse * 0.15), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,90,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // the bent γ shaft: an eccentric cam that turns with the ring and points at each β as it lets its ATP go
  ctx.save();
  ctx.rotate(rot - Math.PI / 2);
  glow(ctx, C.goldHi, 0, 0, r * 0.24, 0.3 + hot * 0.4);
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.085, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.moveTo(r * 0.05, -r * 0.06);
  ctx.quadraticCurveTo(r * 0.2, 0, r * 0.05, r * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The gauge around the lens: an arc from the bottom-left round the top to the bottom-right, the threshold notch at its middle (top). */
export function paintGauge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, v: number | null, color: string, hot: string): void {
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(10,10,30,0.55)';
  ctx.lineWidth = Math.max(5, r * 0.07);
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a0 + span);
  ctx.stroke();
  if (v !== null) {
    const k = Math.max(0, Math.min(1, v));
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3.5, r * 0.05);
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a0 + span * Math.min(k, 0.5));
    ctx.stroke();
    if (k > 0.5) {
      ctx.strokeStyle = hot;
      ctx.beginPath();
      ctx.arc(x, y, r, a0 + span * 0.5, a0 + span * k);
      ctx.stroke();
      const e = a0 + span * k;
      glow(ctx, hot, x + Math.cos(e) * r, y + Math.sin(e) * r, r * 0.16, 0.7);
    }
  }
  // the threshold notch at the top
  const tn = a0 + span * 0.5;
  ctx.strokeStyle = '#fff6e6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(tn) * (r - r * 0.09), y + Math.sin(tn) * (r - r * 0.09));
  ctx.lineTo(x + Math.cos(tn) * (r + r * 0.09), y + Math.sin(tn) * (r + r * 0.09));
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** The lens's glass rim (after its content): a bright edge and a highlight. */
export function paintLensRim(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, gold: number): void {
  ctx.lineWidth = Math.max(3, r * 0.045);
  ctx.strokeStyle = gold > 0 ? rgba(C.gold, 0.5 + gold * 0.5) : 'rgba(210,240,255,0.55)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.965, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();
}

// ── ATP ──────────────────────────────────────────────────────────
/** A golden ATP: the adenosine head and three phosphate beads (`beads` 3; ADP has 2), seen at size `s`. */
export function paintAtp(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, beads = 3): void {
  glow(ctx, beads === 3 ? C.gold : '#9fd8ff', x, y, s * 2.6, 0.55);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = beads === 3 ? '#ffd860' : '#a8dcff';
  ctx.strokeStyle = 'rgba(90,50,0,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-s * 0.45, 0, s * 0.62, 0, TAU);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < beads; i++) {
    ctx.fillStyle = i === beads - 1 ? '#fff4c6' : beads === 3 ? '#ffb43a' : '#7fc4f0';
    ctx.beginPath();
    ctx.arc(s * (0.32 + i * 0.42), 0, s * 0.24, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ── the double helix ─────────────────────────────────────────────
/** The two backbones' y at x for a helix of period P (px) scrolled by `off`; the grooves' phase gap makes it real. */
export function strands(mid: number, amp: number, P: number, x: number): [number, number, number] {
  const ph = (x / P) * TAU;
  return [mid + amp * Math.sin(ph), mid + amp * Math.sin(ph + Math.PI * 0.72), Math.cos(ph)];
}

/** Base pairs repeat in this order along the strip (A–T teal, G–C violet; the colours of a teaching model). */
const PAIRS = ['at', 'gc', 'gc', 'at', 'gc', 'at', 'at', 'gc', 'at', 'gc'] as const;

/** One period of the helix (P px wide, h px tall) for tiling: backbones, base-pair rungs, depth by the strands' phase. */
export function paintHelixStrip(ctx: CanvasRenderingContext2D, P: number, h: number, amp: number, rungs = 10): void {
  const mid = h / 2;
  // the strands, back halves first (dimmer), then the rungs, then the front halves
  const seg = (front: boolean, which: 0 | 1) => {
    ctx.lineCap = 'round';
    for (let x = -2; x < P + 2; x += 2) {
      const [y0a, y1a, ca] = strands(mid, amp, P, x);
      const [y0b, y1b] = strands(mid, amp, P, x + 2);
      const depth = which === 0 ? ca : -ca;
      if ((depth > 0) !== front) continue;
      ctx.strokeStyle = front ? 'rgba(170,250,255,0.95)' : 'rgba(110,170,200,0.45)';
      ctx.lineWidth = front ? Math.max(2.5, amp * 0.16) : Math.max(1.8, amp * 0.11);
      ctx.beginPath();
      ctx.moveTo(x, which === 0 ? y0a : y1a);
      ctx.lineTo(x + 2, which === 0 ? y0b : y1b);
      ctx.stroke();
    }
  };
  seg(false, 0);
  seg(false, 1);
  for (let i = 0; i < rungs; i++) {
    const x = (i + 0.5) * (P / rungs);
    const [ya, yb, c] = strands(mid, amp, P, x);
    const pair = PAIRS[i % PAIRS.length];
    const a = 0.45 + 0.4 * Math.abs(c);
    const ym = (ya + yb) / 2;
    ctx.lineWidth = Math.max(2.4, amp * 0.17);
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(pair === 'at' ? '#5ff0c8' : '#a98bff', a);
    ctx.beginPath();
    ctx.moveTo(x, ya);
    ctx.lineTo(x, ym);
    ctx.stroke();
    ctx.strokeStyle = rgba(pair === 'at' ? '#ffe08a' : '#ff9fc6', a);
    ctx.beginPath();
    ctx.moveTo(x, ym);
    ctx.lineTo(x, yb);
    ctx.stroke();
  }
  seg(true, 0);
  seg(true, 1);
}

/** Damage on the helix at rung x (the strands' y given), drawn by its kind; `k` 0..1 pulses it. */
export function paintLesion(ctx: CanvasRenderingContext2D, kind: LesionKind, x: number, ya: number, yb: number, amp: number, k: number, waiting: boolean): void {
  const ym = (ya + yb) / 2;
  const col = kind === 'dimer' ? '#c86bff' : kind === 'bulky' ? '#ff9a3d' : C.red;
  glow(ctx, col, x, ym, amp * (1.6 + 0.5 * k), 0.55 + 0.3 * k);
  if (waiting) glow(ctx, C.amber, x, ym, amp * 2.2, 0.35 + 0.25 * k);
  ctx.lineCap = 'round';
  const lw = Math.max(3, amp * 0.2);
  switch (kind) {
    case 'oxo':
      ctx.strokeStyle = '#ff6b7a';
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, ya);
      ctx.lineTo(x, yb);
      ctx.stroke();
      ctx.fillStyle = '#fff0f0';
      ctx.beginPath();
      ctx.arc(x + amp * 0.18, ym - amp * 0.1, amp * 0.16, 0, TAU);
      ctx.fill();
      break;
    case 'abasic':
      ctx.strokeStyle = '#ff6b7a';
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, ya);
      ctx.lineTo(x, ya + (yb - ya) * 0.32);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,107,122,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, ya + (yb - ya) * 0.4);
      ctx.lineTo(x, yb);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    case 'dimer':
    case 'bulky': {
      const kink = kind === 'dimer' ? amp * 0.35 : 0;
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      for (const dx of [-amp * 0.2, amp * 0.2]) {
        ctx.beginPath();
        ctx.moveTo(x + dx, ya);
        ctx.quadraticCurveTo(x + dx + kink, ym, x + dx, yb);
        ctx.stroke();
      }
      if (kind === 'bulky') {
        ctx.fillStyle = '#ffc07a';
        ctx.beginPath();
        ctx.ellipse(x, ya - amp * 0.18, amp * 0.36, amp * 0.24, 0.3, 0, TAU);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#f2d4ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - amp * 0.2 + kink * 0.5, ym);
        ctx.lineTo(x + amp * 0.2 + kink * 0.5, ym);
        ctx.stroke();
      }
      break;
    }
    case 'dsb':
      // the helix broken across: two jagged ends with sparks
      ctx.strokeStyle = '#ffd0d6';
      ctx.lineWidth = 2;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + sx * amp * 0.15, ya - amp * 0.25);
        ctx.lineTo(x + sx * amp * 0.32, ym - amp * 0.2);
        ctx.lineTo(x + sx * amp * 0.12, ym + amp * 0.15);
        ctx.lineTo(x + sx * amp * 0.3, yb + amp * 0.25);
        ctx.stroke();
      }
      glow(ctx, '#ffffff', x, ym, amp * 0.8, 0.4 * k);
      break;
  }
}

/** A mended rung: fresh colour and a gold seal. */
export function paintMended(ctx: CanvasRenderingContext2D, x: number, ya: number, yb: number, amp: number, k: number): void {
  glow(ctx, C.mint, x, (ya + yb) / 2, amp * (1.2 + k), 0.6 * (1 - k));
  ctx.strokeStyle = rgba(C.mint, 1 - k * 0.6);
  ctx.lineWidth = Math.max(3, amp * 0.2);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, ya);
  ctx.lineTo(x, yb);
  ctx.stroke();
  ctx.strokeStyle = rgba(C.gold, 1 - k);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, (ya + yb) / 2, amp * (0.3 + k * 0.6), 0, TAU);
  ctx.stroke();
}

/** A repair crew member for a step, at (x, y) of size s; `k` 0..1 through the step. */
export function paintCrew(ctx: CanvasRenderingContext2D, step: StepId, x: number, y: number, s: number, k: number, t: number): void {
  const bob = Math.sin(t * 9) * s * 0.05;
  ctx.save();
  ctx.translate(x, y + bob);
  const col: Record<StepId, string> = {
    glyco: '#7ff2c4', ape1: '#ffd36b', polb: '#8fd8ff', lig: '#ffc94d', xpc: '#ff9fd0',
    tfiih: '#b892ff', cut: '#ffb36b', fill: '#8fd8ff', ku: '#9fffe0', lig4: '#ffc94d',
  };
  const c = col[step];
  glow(ctx, c, 0, 0, s * 1.8, 0.45);
  ctx.fillStyle = c;
  ctx.strokeStyle = 'rgba(10,30,30,0.7)';
  ctx.lineWidth = 1.3;
  if (step === 'ku' || step === 'tfiih' || step === 'lig' || step === 'lig4') {
    // a ring (Ku is a real ring that threads onto the DNA end; TFIIH and the ligases encircle it)
    ctx.lineWidth = s * 0.28;
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, -Math.PI * 0.9 + k * 3, -Math.PI * 0.3 + k * 3);
    ctx.stroke();
  } else if (step === 'cut' || step === 'ape1') {
    // scissors that snip as k passes 0.5
    const open = 0.5 * Math.abs(Math.cos(k * Math.PI * 2));
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.rotate(sx * open);
      rr(ctx, -s * 0.12, -s * 0.75, s * 0.24, s * 0.75, s * 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, s * 0.15, s * 0.22, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else {
    // a rounded enzyme with a pocket (the glycosylase flips the base into it; a polymerase holds a new letter)
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.62, s * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,30,40,0.55)';
    ctx.beginPath();
    ctx.arc(0, s * 0.18, s * 0.2, 0, Math.PI);
    ctx.fill();
    if (step === 'polb' || step === 'fill') {
      ctx.fillStyle = C.mint;
      ctx.beginPath();
      ctx.arc(0, s * 0.55 + k * s * 0.4, s * 0.16, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#10252a';
    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 0.12, s * 0.07, 0, TAU);
    ctx.arc(s * 0.2, -s * 0.12, s * 0.07, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ── the clean-up ─────────────────────────────────────────────────
/** A lysosome: a violet orb, acid inside; `breath` 0..1 swells it, `fuse` 0..1 blooms. */
export function paintLysosome(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, breath: number, fuse: number, digest: number): void {
  const rr0 = r * (1 + breath * 0.12 + fuse * 0.2);
  glow(ctx, C.violet, x, y, rr0 * 2.4, 0.35 + fuse * 0.5 + digest * 0.3);
  const g = ctx.createRadialGradient(x - rr0 * 0.35, y - rr0 * 0.35, rr0 * 0.1, x, y, rr0);
  g.addColorStop(0, '#e9dcff');
  g.addColorStop(0.5, '#a07ff0');
  g.addColorStop(1, '#5b3fb0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rr0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(240,225,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // the proton pumps (V-ATPase) on its rim keep it acid
  for (let i = 0; i < 6; i++) {
    const a = t * 0.3 + (i / 6) * TAU;
    ctx.fillStyle = 'rgba(255,170,220,0.85)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * rr0, y + Math.sin(a) * rr0, Math.max(1.5, r * 0.08), 0, TAU);
    ctx.fill();
  }
  if (digest > 0) {
    ctx.strokeStyle = `rgba(255,240,255,${0.5 * (1 - digest)})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x, y, rr0 * (0.25 + 0.2 * i), t * 3 + i, t * 3 + i + 2.2);
      ctx.stroke();
    }
  }
}

/** A worn part (`k` its wear, 0..1): a dim, ragged mitochondrion, a protein clump, or an old peroxisome. */
export function paintPart(ctx: CanvasRenderingContext2D, kind: PartKind, x: number, y: number, s: number, t: number, seed: number, tags: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.7 + seed * 6) * 0.15);
  if (kind === 'mito') {
    const L = s * 0.95;
    ctx.fillStyle = '#9a7f78';
    rr(ctx, -L, -s * 0.48, L * 2, s * 0.96, s * 0.48);
    ctx.fill();
    ctx.strokeStyle = '#5a4a48';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220,200,190,0.45)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * L * 0.36, -s * 0.35);
      ctx.lineTo(i * L * 0.36 + s * 0.1, s * 0.1);
      ctx.stroke();
    }
  } else if (kind === 'clump') {
    ctx.fillStyle = '#8f86a8';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + seed;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.32, Math.sin(a) * s * 0.28, s * (0.28 + 0.08 * hash(seed * 10 + i)), 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60,50,80,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#7f9a8a';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4a5a50';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,240,230,0.45)';
    ctx.fillRect(-s * 0.18, -s * 0.18, s * 0.36, s * 0.36);
  }
  // ubiquitin tags (the "worn" label, PINK1 and Parkin on a mitochondrion)
  for (let i = 0; i < Math.round(tags * 4); i++) {
    const a = -Math.PI / 2 + (i - 1.5) * 0.55;
    const tx = Math.cos(a) * s * 0.75, ty = Math.sin(a) * s * 0.7;
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tx * 0.7, ty * 0.7);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(1.5, s * 0.09), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The phagophore wrapping a part: a double-membrane cup growing round it (`k` 0..1), closed at 1. */
export function paintPhagophore(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, t: number): void {
  const span = Math.max(0.05, k) * TAU;
  const a0 = Math.PI / 2 - span / 2 + Math.sin(t * 0.8) * 0.1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,214,190,0.95)';
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a0 + span);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,190,0.55)';
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  ctx.arc(x, y, r * 1.14, a0 + 0.05, a0 + span - 0.05);
  ctx.stroke();
  if (k >= 1) glow(ctx, '#ffd6be', x, y, r * 1.8, 0.3);
}

// ── mitosis (inside the lens) ────────────────────────────────────
const CHROMO = ['#ff8fb8', '#8ff0ff', '#ffd36b', '#9fffc4'];

/** The division seen whole, inside the lens: phase 0–4 (prophase … the daughters part), `k` 0..1 through it. */
export function paintMitosis(ctx: CanvasRenderingContext2D, r: number, phase: number, k: number, niche: NicheId, t: number): void {
  const fate = NICHE[niche].cell;
  const R = r * 0.66;
  const sep = phase < 3 ? 0 : phase === 3 ? k * 0.55 : 0.55 + k * 0.45;
  const pinch = phase < 3 ? 0 : phase === 3 ? k : 1;
  // the cell membrane: one circle pinching into two
  const drawCell = (cx: number, rad: number, col: string, a: number) => {
    const g = ctx.createRadialGradient(cx - rad * 0.3, -rad * 0.3, rad * 0.1, cx, 0, rad);
    g.addColorStop(0, rgba('#e8fff6', 0.5 * a));
    g.addColorStop(1, rgba(col, 0.35 * a));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, 0, rad, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#e8fff6', 0.8 * a);
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  if (pinch <= 0) drawCell(0, R, C.mint, 1);
  else {
    const d = R * 0.62 * Math.min(1, pinch) + R * sep * 0.9;
    const rad = R * (1 - 0.3 * Math.min(1, pinch));
    drawCell(-d, rad, C.mint, 1);
    drawCell(d, rad, phase >= 4 ? fate : C.mint, 1);
    if (phase >= 4) glow(ctx, fate, d, 0, rad * 1.6, 0.4 * k);
  }
  // the spindle from two poles (metaphase, anaphase)
  if (phase === 1 || phase === 2) {
    ctx.strokeStyle = 'rgba(220,255,250,0.35)';
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-R * 0.85, 0);
      ctx.quadraticCurveTo(0, i * R * 0.12, R * 0.85, 0);
      ctx.stroke();
    }
    glow(ctx, '#ffffff', -R * 0.85, 0, R * 0.2, 0.6);
    glow(ctx, '#ffffff', R * 0.85, 0, R * 0.2, 0.6);
  }
  // the chromosomes: condense, line up, part
  for (let i = 0; i < 4; i++) {
    const col = CHROMO[i];
    const yy = (i - 1.5) * R * 0.28;
    let x0: number, x1: number, y0: number;
    if (phase === 0) {
      const a = (i / 4) * TAU + t * 0.6;
      x0 = x1 = Math.cos(a) * R * 0.3 * (1 - k * 0.3);
      y0 = Math.sin(a) * R * 0.3;
    } else if (phase === 1) {
      x0 = x1 = 0;
      y0 = yy;
    } else if (phase === 2) {
      x0 = -k * R * 0.6;
      x1 = k * R * 0.6;
      y0 = yy;
    } else {
      const d = R * 0.62 * Math.min(1, pinch) + R * sep * 0.9;
      x0 = -d;
      x1 = d;
      y0 = yy * 0.6;
    }
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2.5, R * 0.07);
    const arm = R * 0.1 * (phase === 0 ? 0.4 + k * 0.6 : 1);
    for (const cx of x0 === x1 ? [x0] : [x0, x1]) {
      ctx.beginPath();
      ctx.moveTo(cx - arm, y0 - arm);
      ctx.lineTo(cx + arm, y0 + arm);
      if (x0 === x1) {
        ctx.moveTo(cx + arm, y0 - arm);
        ctx.lineTo(cx - arm, y0 + arm);
      }
      ctx.stroke();
    }
  }
}

/** The daughter cell's picture for the tissue: a gut lining cell (a column with a brush border), a skin cell (a flat tile), a red blood cell (a dimpled disc). */
export function paintCellIcon(ctx: CanvasRenderingContext2D, niche: NicheId, x: number, y: number, r: number): void {
  const n = NICHE[niche];
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, n.cell, 0, 0, r * 2, 0.35);
  if (niche === 'gut') {
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, n.rim);
    g.addColorStop(1, n.cell);
    ctx.fillStyle = g;
    rr(ctx, -r * 0.55, -r * 0.85, r * 1.1, r * 1.8, r * 0.25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,30,20,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = n.rim;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.2, -r * 0.85);
      ctx.lineTo(i * r * 0.2, -r * 1.05);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(90,40,90,0.75)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.35, r * 0.25, r * 0.3, 0, 0, TAU);
    ctx.fill();
  } else if (niche === 'skin') {
    ctx.fillStyle = n.cell;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      const xx = Math.cos(a) * r, yy = Math.sin(a) * r * 0.62;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,30,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(110,60,90,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.28, r * 0.2, 0, 0, TAU);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    g.addColorStop(0, '#b8202e');
    g.addColorStop(0.55, '#ff6b75');
    g.addColorStop(1, '#c42a38');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,10,20,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

/** The chips' icons: energy (an ATP), material (building beads), DNA (a short helix). */
export function paintChipIcon(ctx: CanvasRenderingContext2D, kind: 0 | 1 | 2, x: number, y: number, s: number, t: number): void {
  if (kind === 0) paintAtp(ctx, x, y, s * 0.42, -0.4);
  else if (kind === 1) {
    const cols = ['#7ff2c4', '#ffd36b', '#ff9fc6', '#8fd8ff'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.arc(x + (i % 2 ? 1 : -1) * s * 0.22, y + (i < 2 ? -1 : 1) * s * 0.2, s * 0.2, 0, TAU);
      ctx.fill();
    }
  } else {
    ctx.lineWidth = Math.max(1.5, s * 0.12);
    ctx.lineCap = 'round';
    for (const ph of [0, Math.PI * 0.72]) {
      ctx.strokeStyle = ph ? '#a98bff' : '#8ff0ff';
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const xx = x - s * 0.45 + (i / 12) * s * 0.9;
        const yy = y + Math.sin((i / 12) * TAU + ph + t) * s * 0.3;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
  }
}

/** Mito's speech bubble: wrapped text in a soft card with a tail toward (tx, ty); returns its box. */
export function paintBubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, side: 'right' | 'left', px: number, tx: number, ty: number, a: number): { x: number; y: number; w: number; h: number } {
  ctx.font = font(px, 700);
  const lines = wrapLines(ctx, text, maxW - 20);
  const lh = Math.round(px * 1.3);
  const w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 22);
  const h = lines.length * lh + 14;
  const bx = side === 'right' ? x : x - w, by = y;
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(4,16,20,0.45)';
  rr(ctx, bx + 2, by + 3, w, h, 12);
  ctx.fill();
  ctx.fillStyle = '#fff8ec';
  rr(ctx, bx, by, w, h, 12);
  ctx.fill();
  ctx.beginPath();
  const ax = side === 'right' ? bx + 14 : bx + w - 14;
  ctx.moveTo(ax - 6, by + h - 2);
  ctx.lineTo(tx, ty);
  ctx.lineTo(ax + 6, by + h - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a1a18';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + 11, by + 7 + i * lh));
  ctx.globalAlpha = 1;
  return { x: bx, y: by, w, h };
}

/** Text with a soft dark edge so it reads on any ground. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color: string = C.cream, align: CanvasTextAlign = 'center', weight = 800): void {
  ctx.font = font(px, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, px * 0.24);
  ctx.strokeStyle = 'rgba(2,14,18,0.78)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
