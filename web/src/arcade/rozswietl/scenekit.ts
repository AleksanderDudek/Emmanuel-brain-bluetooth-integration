/**
 * Rozświetl's painting kit: one art style for all sixteen pictures (the eight places, each dark and
 * bright).  A gouache storybook look — layered gradients, soft round light, grain like paper — drawn
 * once per picture into an offscreen canvas (render.ts caches it; nothing here runs per frame, so a
 * radial gradient per glow is fine).
 *
 *   Stage      the canvas and its units: u = min(w, h) / 100, the centre and the ground line, so a
 *              place composes the same at any aspect from a phone upright (3:4) to a desktop (2:1) —
 *              the key things stay within ±45 u of the centre, sky and ground fill the rest
 *   figures    people in poses (standing, arms open, walking, running, sitting hunched or at ease,
 *              curled up, clinging, slumped at a desk, knees drawn up), the same body in both states
 *   light      glows, rays, a sun, a street lamp's cone, a window's warm square
 *   weather    rain, fog, a dark cloud, lightning, clouds, stars
 *   props      a bench, lamps, houses, rooms, beds, tables, letters, shelves, plants, a boat…
 *
 * Dignity first (DESIGN §13.3–§13.4): the dark pictures are of moods — no wounds, no self-harm, no
 * horror; faces are left without features, a lowered head says enough.
 */

export const TAU = Math.PI * 2;

export interface Stage {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** px per unit: min(w, h) / 100 */
  u: number;
  cx: number;
  cy: number;
  /** the ground line (px) */
  gy: number;
  rng: () => number;
  /** the bright state (the picture under the mosaic) */
  bright: boolean;
}

/** A small seeded generator for the paint's grain and scatter (the same picture every time). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The stage of a w × h picture: the ground line `ground` units under the centre. */
export function makeStage(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, bright: boolean, ground = 18): Stage {
  const u = Math.min(w, h) / 100;
  const cy = h / 2;
  return { ctx, w, h, u, cx: w / 2, cy, gy: Math.min(h - 8 * u, cy + ground * u), rng: seeded(seed), bright };
}

/** x of a point `dx` units right of the centre; y of a point `dy` units under the ground line. */
export const X = (s: Stage, dx: number): number => s.cx + dx * s.u;
export const Y = (s: Stage, dy: number): number => s.gy + dy * s.u;

// ── colour ──────────────────────────────────────────────────────

/** "#rrggbb" → [r, g, b] */
export function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** "#rrggbb" with an alpha → "rgba(…)" */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** Mix two "#rrggbb" colours (t = 0: a, 1: b). */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a), B = rgb(b);
  const c = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}

/** The palettes of the two states: ink and ash for the dark, dawn and honey for the bright. */
export const DARK = {
  ink: '#121622', night: '#1a2030', slate: '#283041', slate2: '#363f52', fog: '#59627a', ash: '#4a5468', rain: '#8696b0',
  lamp: '#d2b469', lampDim: '#9c8650', window: '#222a38', wall: '#2e3444', floor: '#232836', wood: '#3b3532', cloth: '#3c4558',
  grass: '#26302c', leaf: '#323d36', sea: '#16212e', foam: '#6c7d92', rock: '#2a2f38', skin: '#9a8f8c', skin2: '#7e706a', skin3: '#5f524c',
};

export const BRIGHT = {
  sky: '#8fd0f6', sky2: '#c9ecff', dawn: '#ffe2a8', peach: '#ffc79a', sun: '#ffe08a', gold: '#f7c24f', honey: '#f0a63c',
  coral: '#ff8a6b', rose: '#ff9fb4', lilac: '#bfa2f2', teal: '#3fb7a8', leaf: '#6cc26a', leaf2: '#3e9a58', grass: '#9edb74',
  grass2: '#76c25e', cream: '#fff4dc', wall: '#f6e3c4', floor: '#d9a874', wood: '#b9784a', wood2: '#8f5634', sea: '#3fa3c9',
  sea2: '#7fd0e6', rock: '#b48f73', skin: '#f2c9a5', skin2: '#c98d63', skin3: '#8a5a3c', white: '#fffaf0',
};

// ── shapes ──────────────────────────────────────────────────────

export function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  ctx.fill();
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function poly(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** A vertical gradient over [y0, y1] through the given stops (evenly spaced). */
export function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: readonly string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(stops.length > 1 ? i / (stops.length - 1) : 0, c));
  return g;
}

// ── light ───────────────────────────────────────────────────────

/** A soft round glow (added light): `color` "#rrggbb", strongest `a` at the centre. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.35, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Soft rays from (x, y) fanning over `spread` radians around `angle`. */
export function rays(s: Stage, x: number, y: number, len: number, angle: number, spread: number, n: number, color: string, a: number): void {
  const ctx = s.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ang = angle + (i / Math.max(1, n - 1) - 0.5) * spread + (s.rng() - 0.5) * 0.05;
    const wid = (0.03 + s.rng() * 0.05) * len * 0.3;
    const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.addColorStop(0, rgba(color, a * (0.6 + s.rng() * 0.4)));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang - wid / len) * len, y + Math.sin(ang - wid / len) * len);
    ctx.lineTo(x + Math.cos(ang + wid / len) * len, y + Math.sin(ang + wid / len) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The sun: a disc in a wide halo. */
export function sun(s: Stage, x: number, y: number, r: number, warm = 0): void {
  glow(s.ctx, x, y, r * 7, warm > 0.5 ? '#ffb45a' : '#ffe9a8', 0.42);
  glow(s.ctx, x, y, r * 2.6, '#fff1c0', 0.6);
  ell(s.ctx, x, y, r, r, warm > 0.5 ? '#ffe2a0' : '#fff6d6');
}

// ── sky and ground ──────────────────────────────────────────────

/** Sky from the top of the picture to y1 through the stops, with a few horizontal brush smears. */
export function sky(s: Stage, y1: number, stops: readonly string[], smear = '#ffffff', smearA = 0.06): void {
  const { ctx, w } = s;
  rect(ctx, 0, 0, w, y1 + 1, vgrad(ctx, 0, y1, stops));
  for (let i = 0; i < 14; i++) {
    const y = s.rng() * y1, len = w * (0.2 + s.rng() * 0.5), x = s.rng() * w - len * 0.3;
    ctx.fillStyle = rgba(smear, smearA * (0.4 + s.rng()));
    ctx.beginPath();
    ctx.ellipse(x + len / 2, y, len / 2, s.u * (0.4 + s.rng() * 1.2), 0, 0, TAU);
    ctx.fill();
  }
}

/** Ground from y0 to the bottom through the stops. */
export function ground(s: Stage, y0: number, stops: readonly string[]): void {
  rect(s.ctx, 0, y0, s.w, s.h - y0, vgrad(s.ctx, y0, s.h, stops));
}

/** Soft rolling hills across the picture at base y, `amp` units high. */
export function hills(s: Stage, y: number, amp: number, color: string, phase = 0, waves = 2.2): void {
  const { ctx, w, u } = s;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, s.h);
  for (let i = 0; i <= 40; i++) {
    const x = (w * i) / 40;
    const k = (x / w) * waves * TAU + phase;
    ctx.lineTo(x, y - amp * u * (0.5 + 0.35 * Math.sin(k) + 0.15 * Math.sin(k * 2.3 + 1)));
  }
  ctx.lineTo(w, s.h);
  ctx.closePath();
  ctx.fill();
}

/** Stars over the upper part of the sky. */
export function stars(s: Stage, y1: number, n: number, a = 0.7): void {
  for (let i = 0; i < n; i++) {
    const x = s.rng() * s.w, y = s.rng() * y1, r = s.u * (0.15 + s.rng() * 0.25);
    ell(s.ctx, x, y, r, r, rgba('#e8eeff', a * (0.3 + s.rng() * 0.7)));
  }
}

/** A fluffy cloud of round puffs (bright skies). */
export function cloud(s: Stage, x: number, y: number, size: number, color = '#ffffff', a = 0.9): void {
  const { ctx, u } = s;
  const puffs: [number, number, number][] = [[-1.2, 0.2, 0.75], [-0.5, -0.25, 1], [0.35, -0.35, 1.1], [1.15, 0.05, 0.8], [0.2, 0.25, 0.9]];
  ctx.fillStyle = rgba(color, a);
  ctx.beginPath();
  for (const [dx, dy, r] of puffs) {
    ctx.moveTo(x + (dx + r) * size * u, y + dy * size * u);
    ctx.arc(x + dx * size * u, y + dy * size * u, r * size * u, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', a * 0.35);
  ctx.beginPath();
  ctx.ellipse(x - 0.2 * size * u, y - 0.55 * size * u, size * u * 0.9, size * u * 0.35, 0, 0, TAU);
  ctx.fill();
}

/** A heavy dark cloud (storm, or the grey cloud indoors over a bed). */
export function darkCloud(s: Stage, x: number, y: number, size: number, color = '#2a3140', a = 0.95): void {
  const { ctx, u } = s;
  const puffs: [number, number, number][] = [[-1.4, 0.25, 0.8], [-0.7, -0.2, 1.05], [0.2, -0.4, 1.2], [1.1, -0.05, 0.95], [1.7, 0.3, 0.6], [0.1, 0.35, 1]];
  ctx.fillStyle = rgba(color, a);
  ctx.beginPath();
  for (const [dx, dy, r] of puffs) {
    ctx.moveTo(x + (dx + r) * size * u, y + dy * size * u);
    ctx.arc(x + dx * size * u, y + dy * size * u, r * size * u, 0, TAU);
  }
  ctx.fill();
  // a lighter rim on top, a darker belly
  ctx.fillStyle = rgba('#7a8499', 0.18);
  ctx.beginPath();
  ctx.ellipse(x + 0.1 * size * u, y - 0.75 * size * u, size * u * 1.2, size * u * 0.35, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba('#0c0f16', 0.35);
  ctx.beginPath();
  ctx.ellipse(x + 0.2 * size * u, y + 0.55 * size * u, size * u * 1.7, size * u * 0.3, 0, 0, TAU);
  ctx.fill();
}

/** Slanted rain streaks over a box. */
export function rain(s: Stage, x0: number, y0: number, w: number, h: number, n: number, color = DARK.rain, a = 0.32, slant = 0.25): void {
  const { ctx, u } = s;
  ctx.strokeStyle = rgba(color, a);
  ctx.lineWidth = Math.max(1, u * 0.18);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = x0 + s.rng() * w, y = y0 + s.rng() * h, len = u * (2 + s.rng() * 3.5);
    ctx.moveTo(x, y);
    ctx.lineTo(x - slant * len, y + len);
  }
  ctx.stroke();
}

/** Bands of fog drifting across [y0, y1]. */
export function fog(s: Stage, y0: number, y1: number, color = DARK.fog, a = 0.35, bands = 6): void {
  const { ctx, w, u } = s;
  for (let i = 0; i < bands; i++) {
    const y = y0 + ((i + s.rng() * 0.6) / bands) * (y1 - y0);
    const g = ctx.createLinearGradient(0, y - 6 * u, 0, y + 6 * u);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.5, rgba(color, a * (0.5 + s.rng() * 0.5)));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 6 * u, w, 12 * u);
  }
}

/** A jagged bolt of lightning from (x, y) down `len` px, with a glow. */
export function lightning(s: Stage, x: number, y: number, len: number): void {
  const { ctx, u } = s;
  const pts: [number, number][] = [[x, y]];
  let cx = x, cy = y;
  while (cy < y + len) {
    cx += (s.rng() - 0.5) * 7 * u;
    cy += (2 + s.rng() * 4) * u;
    pts.push([cx, cy]);
  }
  glow(ctx, x, y + len * 0.4, len * 0.7, '#9fb8ff', 0.22);
  for (const [wid, col] of [[2.2, 'rgba(160,190,255,.35)'], [0.9, 'rgba(235,242,255,.95)']] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = wid * u;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }
}

/** Paper grain and a vignette over the whole picture: the painterly finish. */
export function finish(s: Stage, vignette: number, warm: boolean): void {
  const { ctx, w, h, u } = s;
  const n = Math.round((w * h) / (u * u) * 0.9);
  for (let i = 0; i < n; i++) {
    const x = s.rng() * w, y = s.rng() * h;
    ctx.fillStyle = s.rng() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
    ctx.fillRect(x, y, u * (0.3 + s.rng() * 0.7), u * (0.2 + s.rng() * 0.4));
  }
  const g = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.32, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, warm ? `rgba(120,60,20,${vignette})` : `rgba(4,6,12,${vignette})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ── figures ─────────────────────────────────────────────────────

type P = readonly [number, number];

/** A pose: keypoints in units of the figure's height, origin at the ground contact, +x the way it faces. */
export interface Pose {
  head: P;
  neck: P;
  hip: P;
  /** shoulder → elbow → hand, back and front */
  armB: readonly [P, P, P];
  armF: readonly [P, P, P];
  /** hip → knee → foot, back and front */
  legB: readonly [P, P, P];
  legF: readonly [P, P, P];
  /** torso width (front view wider) */
  torso: number;
}

export type PoseId = 'stand' | 'armsOpen' | 'standTall' | 'walk' | 'run' | 'sitHunch' | 'sit' | 'sitWave' | 'sitGround' | 'curl'
  | 'cling' | 'slumpDesk' | 'knees' | 'wave' | 'sitTable' | 'reach' | 'kneel';

export const POSES: Record<PoseId, Pose> = {
  stand: {
    head: [0, -0.89], neck: [0, -0.79], hip: [0, -0.47], torso: 0.2,
    armB: [[-0.09, -0.76], [-0.13, -0.61], [-0.13, -0.47]], armF: [[0.09, -0.76], [0.13, -0.61], [0.13, -0.47]],
    legB: [[-0.05, -0.47], [-0.06, -0.24], [-0.07, 0]], legF: [[0.05, -0.47], [0.06, -0.24], [0.07, 0]],
  },
  armsOpen: {
    head: [0, -0.9], neck: [0, -0.79], hip: [0, -0.47], torso: 0.2,
    armB: [[-0.09, -0.76], [-0.21, -0.86], [-0.31, -0.99]], armF: [[0.09, -0.76], [0.21, -0.86], [0.31, -0.99]],
    legB: [[-0.05, -0.47], [-0.08, -0.24], [-0.1, 0]], legF: [[0.05, -0.47], [0.08, -0.24], [0.1, 0]],
  },
  standTall: {
    head: [0.01, -0.9], neck: [0, -0.79], hip: [0, -0.47], torso: 0.2,
    armB: [[-0.09, -0.76], [-0.15, -0.62], [-0.17, -0.49]], armF: [[0.09, -0.76], [0.16, -0.9], [0.17, -1.05]],
    legB: [[-0.05, -0.47], [-0.09, -0.24], [-0.12, 0]], legF: [[0.05, -0.47], [0.09, -0.24], [0.12, 0]],
  },
  wave: {
    head: [0, -0.89], neck: [0, -0.79], hip: [0, -0.47], torso: 0.2,
    armB: [[-0.09, -0.76], [-0.13, -0.61], [-0.13, -0.47]], armF: [[0.09, -0.76], [0.2, -0.82], [0.22, -0.98]],
    legB: [[-0.05, -0.47], [-0.06, -0.24], [-0.07, 0]], legF: [[0.05, -0.47], [0.06, -0.24], [0.07, 0]],
  },
  walk: {
    head: [0.03, -0.89], neck: [0.02, -0.79], hip: [0, -0.47], torso: 0.15,
    armB: [[0.02, -0.76], [-0.06, -0.62], [-0.1, -0.5]], armF: [[0.02, -0.76], [0.08, -0.62], [0.13, -0.51]],
    legB: [[0, -0.47], [-0.06, -0.24], [-0.13, -0.01]], legF: [[0, -0.47], [0.09, -0.26], [0.15, 0]],
  },
  run: {
    head: [0.1, -0.85], neck: [0.07, -0.76], hip: [0, -0.46], torso: 0.15,
    armB: [[0.06, -0.73], [-0.04, -0.62], [-0.1, -0.67]], armF: [[0.06, -0.73], [0.15, -0.66], [0.19, -0.77]],
    legB: [[0, -0.46], [-0.08, -0.25], [-0.21, -0.12]], legF: [[0, -0.46], [0.15, -0.33], [0.13, -0.1]],
  },
  sitHunch: {
    head: [0.21, -0.55], neck: [0.13, -0.58], hip: [-0.02, -0.31], torso: 0.15,
    armB: [[0.11, -0.56], [0.15, -0.4], [0.22, -0.37]], armF: [[0.12, -0.56], [0.18, -0.41], [0.24, -0.36]],
    legB: [[-0.02, -0.3], [0.16, -0.31], [0.15, 0]], legF: [[-0.02, -0.3], [0.18, -0.31], [0.19, 0]],
  },
  sit: {
    head: [0.02, -0.72], neck: [0.01, -0.63], hip: [0, -0.31], torso: 0.15,
    armB: [[0.0, -0.6], [-0.07, -0.47], [-0.13, -0.4]], armF: [[0.01, -0.6], [0.06, -0.46], [0.15, -0.39]],
    legB: [[0, -0.3], [0.17, -0.31], [0.18, 0]], legF: [[0, -0.3], [0.19, -0.32], [0.21, 0]],
  },
  sitWave: {
    head: [0.02, -0.73], neck: [0.01, -0.63], hip: [0, -0.31], torso: 0.15,
    armB: [[0.0, -0.6], [-0.07, -0.47], [-0.13, -0.4]], armF: [[0.01, -0.6], [0.12, -0.68], [0.15, -0.84]],
    legB: [[0, -0.3], [0.17, -0.31], [0.18, 0]], legF: [[0, -0.3], [0.19, -0.32], [0.21, 0]],
  },
  sitTable: {
    head: [0.03, -0.72], neck: [0.02, -0.63], hip: [0, -0.31], torso: 0.15,
    armB: [[0.01, -0.6], [0.09, -0.5], [0.2, -0.47]], armF: [[0.02, -0.6], [0.12, -0.52], [0.24, -0.5]],
    legB: [[0, -0.3], [0.17, -0.31], [0.18, 0]], legF: [[0, -0.3], [0.19, -0.32], [0.21, 0]],
  },
  sitGround: {
    head: [0.02, -0.47], neck: [0.01, -0.38], hip: [0, -0.07], torso: 0.15,
    armB: [[0.0, -0.36], [-0.07, -0.22], [-0.12, -0.06]], armF: [[0.01, -0.36], [0.09, -0.24], [0.16, -0.15]],
    legB: [[0, -0.06], [0.17, -0.12], [0.07, -0.02]], legF: [[0, -0.06], [0.19, -0.14], [0.27, -0.02]],
  },
  curl: {
    head: [0.31, -0.11], neck: [0.23, -0.1], hip: [-0.07, -0.09], torso: 0.15,
    armB: [[0.21, -0.1], [0.17, -0.04], [0.25, -0.03]], armF: [[0.22, -0.11], [0.19, -0.03], [0.28, -0.05]],
    legB: [[-0.07, -0.08], [0.08, -0.05], [-0.06, -0.02]], legF: [[-0.07, -0.09], [0.1, -0.07], [-0.03, -0.04]],
  },
  cling: {
    head: [0.14, -0.71], neck: [0.08, -0.65], hip: [0, -0.36], torso: 0.15,
    armB: [[0.07, -0.63], [0.15, -0.56], [0.2, -0.5]], armF: [[0.07, -0.63], [0.15, -0.73], [0.19, -0.86]],
    legB: [[0, -0.36], [-0.08, -0.18], [-0.05, 0]], legF: [[0, -0.36], [0.09, -0.2], [0.02, 0]],
  },
  slumpDesk: {
    head: [0.25, -0.5], neck: [0.14, -0.55], hip: [0, -0.31], torso: 0.15,
    armB: [[0.13, -0.55], [0.31, -0.5], [0.2, -0.47]], armF: [[0.14, -0.55], [0.33, -0.51], [0.22, -0.48]],
    legB: [[0, -0.3], [0.17, -0.31], [0.17, 0]], legF: [[0, -0.3], [0.19, -0.32], [0.2, 0]],
  },
  knees: {
    head: [0.12, -0.37], neck: [0.04, -0.37], hip: [0, -0.05], torso: 0.15,
    armB: [[0.04, -0.35], [0.12, -0.21], [0.17, -0.25]], armF: [[0.05, -0.35], [0.14, -0.22], [0.19, -0.27]],
    legB: [[0, -0.05], [0.12, -0.3], [0.19, 0]], legF: [[0, -0.05], [0.14, -0.31], [0.22, 0]],
  },
  reach: {
    head: [0.03, -0.89], neck: [0.02, -0.79], hip: [0, -0.47], torso: 0.16,
    armB: [[0.01, -0.76], [-0.08, -0.63], [-0.1, -0.5]], armF: [[0.03, -0.76], [0.17, -0.74], [0.3, -0.72]],
    legB: [[0, -0.47], [-0.04, -0.24], [-0.06, 0]], legF: [[0, -0.47], [0.05, -0.24], [0.08, 0]],
  },
  kneel: {
    head: [0.04, -0.66], neck: [0.03, -0.56], hip: [0, -0.26], torso: 0.15,
    armB: [[0.02, -0.53], [0.08, -0.4], [0.17, -0.36]], armF: [[0.03, -0.53], [0.12, -0.42], [0.22, -0.4]],
    legB: [[0, -0.25], [0.04, -0.03], [-0.2, -0.02]], legF: [[0, -0.25], [0.16, -0.24], [0.17, 0]],
  },
};

export interface Look {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  /** long hair falling to the shoulders */
  long?: boolean;
  /** a rim of light on the side facing the light (−1 left, +1 right, 0 none) and its colour */
  rim?: number;
  rimColor?: string;
}

/**
 * A person in a pose, the ground contact at (x, y), `h` px tall, facing +1 right / −1 left.  Limbs are
 * round strokes, the torso a capsule, the head a circle with hair; a rim of light shapes the volume.
 */
export function figure(s: Stage, x: number, y: number, h: number, pose: PoseId | Pose, look: Look, face = 1, headScale = 1): void {
  const ctx = s.ctx;
  const p = typeof pose === 'string' ? POSES[pose] : pose;
  const at = (q: P): [number, number] => [x + q[0] * h * face, y + q[1] * h];
  const limb = (pts: readonly P[], color: string, wid: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = wid * h;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((q, i) => {
      const [px, py] = at(q);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.stroke();
  };
  const shade = mix(look.bottom, '#000000', 0.25), shadeTop = mix(look.top, '#000000', 0.22);
  // the far side first, a shade darker
  limb(p.legB, shade, 0.075);
  limb(p.armB, shadeTop, 0.056);
  // the torso: a capsule from the neck to the hip
  limb([p.neck, p.hip], look.top, p.torso);
  limb([p.hip, [p.hip[0], p.hip[1] - 0.04]], look.bottom, p.torso * 0.95);
  limb(p.legF, look.bottom, 0.078);
  // feet and hands
  for (const leg of [p.legB, p.legF]) {
    const [fx, fy] = at(leg[2]);
    ell(ctx, fx + 0.025 * h * face, fy - 0.01 * h, 0.05 * h, 0.022 * h, mix(look.bottom, '#000000', 0.45));
  }
  limb(p.armF, look.top, 0.058);
  for (const arm of [p.armB, p.armF]) {
    const [hx, hy] = at(arm[2]);
    ell(ctx, hx, hy, 0.03 * h, 0.03 * h, look.skin);
  }
  // the head and the hair
  const [nx, ny] = at(p.neck), [hx, hy] = at(p.head);
  line(ctx, nx, ny, (nx + hx) / 2, (ny + hy) / 2, look.skin, 0.06 * h);
  const r = 0.072 * h * headScale;
  if (look.long) {
    const back = -face * r * 0.35;
    ell(ctx, hx + back, hy + r * 0.55, r * 1.05, r * 1.35, look.hair);
  }
  ell(ctx, hx, hy, r, r, look.skin);
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  // the hair as a cap tilted with the head's lean (the head's offset from the neck)
  const tilt = Math.atan2(hx - nx, -(hy - ny)) * 0.8;
  ctx.ellipse(hx - face * r * 0.12, hy - r * 0.22, r * 1.06, r * 0.86, tilt, Math.PI * 0.98, Math.PI * 2.02);
  ctx.closePath();
  ctx.fill();
  // a rim of light along the lit side
  if (look.rim) {
    const c = look.rimColor ?? '#ffe6b0';
    ctx.save();
    ctx.globalAlpha = 0.42;
    const off = look.rim * 0.018 * h;
    ctx.translate(off, -Math.abs(off) * 0.5);
    limb([p.neck, p.hip], c, p.torso * 0.3);
    limb(p.armF, c, 0.022);
    limb(p.legF, c, 0.026);
    ctx.globalAlpha = 0.5;
    ell(ctx, hx + look.rim * r * 0.35, hy - r * 0.2, r * 0.45, r * 0.6, c);
    ctx.restore();
  }
}

/** Looks for the cast, dark (grey, cold) and bright (warm, alive); `who` picks the person. */
export const CAST = {
  dark: [
    { skin: '#8d8580', hair: '#2a2a30', top: '#3d4659', bottom: '#2b3140' },
    { skin: '#6f625c', hair: '#1f1d22', top: '#454a58', bottom: '#2a2e38', long: true },
    { skin: '#56483f', hair: '#17161a', top: '#3a4250', bottom: '#262a33' },
    { skin: '#857a74', hair: '#3a3530', top: '#4a4d5a', bottom: '#30343f', long: true },
  ],
  bright: [
    { skin: '#f1c7a1', hair: '#5a3a22', top: '#f0a63c', bottom: '#3e6f9e' },
    { skin: '#c98d63', hair: '#2b1d14', top: '#ff8a6b', bottom: '#4f5d8a', long: true },
    { skin: '#8a5a3c', hair: '#1c120c', top: '#3fb7a8', bottom: '#5b4a7a' },
    { skin: '#f2d2b6', hair: '#c9823a', top: '#bfa2f2', bottom: '#6b4f3a', long: true },
    { skin: '#e3b089', hair: '#3b2a1f', top: '#ffd25e', bottom: '#2f7d6d' },
    { skin: '#a8704d', hair: '#20150f', top: '#ff9fb4', bottom: '#3d5a80' },
  ],
} as const satisfies { dark: readonly Look[]; bright: readonly Look[] };

/** The same person in both states: the dark look is the bright one's colours gone grey. */
export function hero(bright: boolean, i = 0, rim = 0): Look {
  const b = CAST.bright[i % CAST.bright.length];
  if (bright) return { ...b, rim, rimColor: '#fff0c8' };
  const grey = (c: string, k: number) => mix(mix(c, '#4a5266', 0.68), '#000000', k);
  return { skin: grey(b.skin, 0.18), hair: grey(b.hair, 0.35), top: grey(b.top, 0.28), bottom: grey(b.bottom, 0.38), long: 'long' in b ? b.long : undefined, rim, rimColor: '#b7c4dc' };
}

// ── props ───────────────────────────────────────────────────────

/** A park bench, its seat at height `seat` px over (x, y), `w` px wide. */
export function bench(s: Stage, x: number, y: number, w: number, seat: number, wood: string, iron: string): void {
  const { ctx } = s;
  const legW = Math.max(1, w * 0.035);
  for (const fx of [0.1, 0.9]) {
    rect(ctx, x - w / 2 + w * fx - legW / 2, y - seat, legW, seat, iron);
    rect(ctx, x - w / 2 + w * fx - legW / 2, y - seat * 2.05, legW, seat * 1.05, iron);
  }
  for (let i = 0; i < 3; i++) rect(ctx, x - w / 2, y - seat - i * seat * 0.09 - seat * 0.05, w, seat * 0.07, i ? mix(wood, '#000000', 0.12) : wood);
  for (let i = 0; i < 3; i++) rect(ctx, x - w / 2, y - seat * (1.45 + i * 0.22), w, seat * 0.12, mix(wood, '#000000', i * 0.08));
}

/** A street lamp: post from (x, y) up `h` px; `lit` 0..1 throws a cone of light. */
export function streetLamp(s: Stage, x: number, y: number, h: number, lit: number, warm: string, iron: string): void {
  const { ctx, u } = s;
  rect(ctx, x - h * 0.018, y - h, h * 0.036, h, iron);
  rect(ctx, x - h * 0.05, y - h * 0.08, h * 0.1, h * 0.08, iron);
  poly(ctx, [[x - h * 0.07, y - h], [x + h * 0.07, y - h], [x + h * 0.05, y - h * 1.1], [x - h * 0.05, y - h * 1.1]], iron);
  rect(ctx, x - h * 0.045, y - h * 1.09 + 1, h * 0.09, h * 0.085, rgba(warm, 0.35 + 0.65 * lit));
  if (lit > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, rgba(warm, 0.22 * lit));
    g.addColorStop(1, rgba(warm, 0.02));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.05, y - h * 1.02);
    ctx.lineTo(x + h * 0.05, y - h * 1.02);
    ctx.lineTo(x + h * 0.42, y);
    ctx.lineTo(x - h * 0.42, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    glow(ctx, x, y - h * 1.05, h * 0.3, warm, 0.5 * lit);
    ell(ctx, x, y + u * 0.3, h * 0.38, h * 0.04, rgba(warm, 0.12 * lit));
  }
}

/** A house front with a grid of windows; `lit` the share of lit windows (by the scatter). */
export function house(s: Stage, x: number, y: number, w: number, h: number, wall: string, roof: string, winDark: string, winLit: string, lit: number, cols = 3, rows = 3): void {
  const { ctx } = s;
  rect(ctx, x, y - h, w, h, wall);
  poly(ctx, [[x - w * 0.04, y - h], [x + w * 1.04, y - h], [x + w * 0.5, y - h - w * 0.32]], roof);
  const ww = (w * 0.6) / cols, wh = (h * 0.55) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + w * 0.2 / (cols / 3) * 0 + (w / cols) * (c + 0.5) - ww / 2;
      const wy = y - h + h * 0.12 + (h * 0.8 / rows) * r;
      const on = s.rng() < lit;
      rect(ctx, wx, wy, ww, wh, on ? winLit : winDark);
      if (on) glow(ctx, wx + ww / 2, wy + wh / 2, ww * 1.6, winLit, 0.25);
      rect(ctx, wx + ww / 2 - 0.5, wy, 1, wh, rgba('#000000', 0.25));
    }
  }
}

/** A window in a wall: frame, panes, what is outside (`outside` a gradient fill), curtains half-drawn or open. */
export function windowFrame(s: Stage, x: number, y: number, w: number, h: number, outside: string | CanvasGradient, frame: string, curtain: string | null, closed: number): void {
  const { ctx } = s;
  rect(ctx, x - w * 0.06, y - h * 0.06, w * 1.12, h * 1.12, frame);
  rect(ctx, x, y, w, h, outside);
  rect(ctx, x + w / 2 - w * 0.025, y, w * 0.05, h, frame);
  rect(ctx, x, y + h * 0.48, w, h * 0.04, frame);
  if (curtain) {
    const cw = w * (0.22 + 0.32 * closed);
    for (const side of [0, 1]) {
      const cx0 = side ? x + w - cw + w * 0.06 : x - w * 0.06;
      ctx.fillStyle = curtain;
      ctx.beginPath();
      ctx.moveTo(cx0, y - h * 0.1);
      ctx.lineTo(cx0 + cw, y - h * 0.1);
      ctx.quadraticCurveTo(cx0 + cw * (side ? 0.2 : 0.8), y + h * 0.5, cx0 + cw * (side ? 0.1 : 0.9), y + h * 1.1);
      ctx.lineTo(side ? cx0 + cw : cx0, y + h * 1.1);
      ctx.closePath();
      ctx.fill();
      for (let i = 1; i < 4; i++) line(ctx, cx0 + (cw * i) / 4, y - h * 0.08, cx0 + (cw * i) / 4 + (side ? -1 : 1) * cw * 0.05, y + h * 1.05, rgba('#000000', 0.12), Math.max(1, w * 0.012));
    }
  }
}

/** A bed seen from the side: the frame from (x, y) `w` px wide, a pillow at the head end (`face` side). */
export function bed(s: Stage, x: number, y: number, w: number, frame: string, sheet: string, blanket: string, face = 1): { top: number } {
  const { ctx } = s;
  const h = w * 0.22, top = y - h;
  rect(ctx, x - w / 2, top + h * 0.35, w, h * 0.45, frame);
  rect(ctx, x - w / 2 - w * 0.02, y - h * 1.6, w * 0.05, h * 1.6, frame);
  rect(ctx, x + w / 2 - w * 0.03, y - h * 1.1, w * 0.05, h * 1.1, frame);
  rrect(ctx, x - w / 2 + w * 0.02, top, w * 0.95, h * 0.42, h * 0.15);
  ctx.fillStyle = sheet;
  ctx.fill();
  ell(ctx, x + face * w * 0.36, top - h * 0.02, w * 0.1, h * 0.17, mix(sheet, '#ffffff', 0.15));
  void blanket;
  return { top };
}

/** A blanket draped over a bed's surface from x0 to x1 at `top`, with a soft mound. */
export function blanket(s: Stage, x0: number, x1: number, top: number, mound: number, color: string): void {
  const { ctx } = s;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, top + mound * 0.9);
  ctx.quadraticCurveTo((x0 + x1) / 2, top - mound * 1.3, x1, top + mound * 0.2);
  ctx.lineTo(x1, top + mound * 1.4);
  ctx.lineTo(x0, top + mound * 1.4);
  ctx.closePath();
  ctx.fill();
  line(ctx, x0 + (x1 - x0) * 0.3, top + mound * 0.2, x0 + (x1 - x0) * 0.55, top + mound * 0.9, rgba('#000000', 0.12), Math.max(1, mound * 0.08));
}

/** A table seen from the front-side: top at height `th` over the floor line y. */
export function table(s: Stage, x: number, y: number, w: number, th: number, wood: string): { top: number } {
  const { ctx } = s;
  const top = y - th;
  rect(ctx, x - w / 2, top, w, th * 0.08, wood);
  rect(ctx, x - w / 2 + w * 0.02, top + th * 0.08, w * 0.96, th * 0.06, mix(wood, '#000000', 0.25));
  for (const fx of [0.06, 0.94]) rect(ctx, x - w / 2 + w * fx - w * 0.015, top + th * 0.1, w * 0.03, th * 0.9, mix(wood, '#000000', 0.15));
  return { top };
}

/** A chair seen from the side for a figure `fh` px tall sitting on it (seat at 0.3 fh), its back on the `back` side (−1 left, +1 right). */
export function chair(s: Stage, x: number, y: number, fh: number, wood: string, back = -1): void {
  const { ctx } = s;
  const seat = fh * 0.3, w = fh * 0.24, t = Math.max(1, fh * 0.025);
  const dark = mix(wood, '#000000', 0.25);
  rect(ctx, x - w / 2, y - seat - t * 0.5, w, t * 1.6, wood);
  rect(ctx, x - w / 2 + t * 0.3, y - seat, t, seat, dark);
  rect(ctx, x + w / 2 - t * 1.3, y - seat, t, seat, dark);
  const bx = back < 0 ? x - w / 2 : x + w / 2 - t * 1.2;
  rect(ctx, bx, y - seat - fh * 0.3, t * 1.2, fh * 0.3, wood);
  rect(ctx, back < 0 ? bx : bx - w * 0.3 + t * 1.2, y - seat - fh * 0.27, w * 0.3, t, dark);
  rect(ctx, back < 0 ? bx : bx - w * 0.3 + t * 1.2, y - seat - fh * 0.17, w * 0.3, t, dark);
}

/** An envelope (a letter), optionally with a red stamp (a bill). */
export function envelope(s: Stage, x: number, y: number, w: number, rot: number, paper: string, stamp: string | null): void {
  const { ctx } = s;
  const h = w * 0.62;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  rect(ctx, -w / 2, -h / 2, w, h, paper);
  ctx.strokeStyle = rgba('#000000', 0.25);
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(0, h * 0.08);
  ctx.lineTo(w / 2, -h / 2);
  ctx.stroke();
  if (stamp) {
    ctx.strokeStyle = stamp;
    ctx.lineWidth = Math.max(1, w * 0.05);
    ctx.strokeRect(w * 0.12, h * 0.05, w * 0.3, h * 0.32);
    rect(ctx, w * 0.16, h * 0.13, w * 0.22, h * 0.06, stamp);
    rect(ctx, w * 0.16, h * 0.24, w * 0.15, h * 0.05, stamp);
  }
  ctx.restore();
}

/** A shelf on a wall with things on it (`full` 0..1: how many places are filled). */
export function shelf(s: Stage, x: number, y: number, w: number, wood: string, full: number, items: readonly string[]): void {
  const { ctx, u } = s;
  rect(ctx, x - w / 2, y, w, u * 1, wood);
  rect(ctx, x - w / 2 + w * 0.08, y + u, u * 0.6, u * 2.2, mix(wood, '#000000', 0.3));
  rect(ctx, x + w / 2 - w * 0.08, y + u, u * 0.6, u * 2.2, mix(wood, '#000000', 0.3));
  const n = 7;
  for (let i = 0; i < n; i++) {
    if ((i + 0.5) / n > full) continue;
    const cx = x - w / 2 + (w * (i + 0.5)) / n, c = items[i % items.length];
    const kind = i % 3;
    if (kind === 0) {
      rect(ctx, cx - u * 1.6, y - u * 4.4, u * 3.2, u * 4.4, c);
      rect(ctx, cx - u * 1.8, y - u * 5, u * 3.6, u * 0.8, mix(c, '#ffffff', 0.35));
    } else if (kind === 1) {
      ell(ctx, cx, y - u * 2.2, u * 1.9, u * 2.2, c);
      rect(ctx, cx - u * 0.9, y - u * 5.2, u * 1.8, u * 1.3, mix(c, '#000000', 0.2));
    } else {
      rect(ctx, cx - u * 1.2, y - u * 3.4, u * 2.4, u * 3.4, c);
      ell(ctx, cx, y - u * 3.4, u * 1.2, u * 0.5, mix(c, '#ffffff', 0.3));
    }
  }
}

/** A glass jar; `coins` 0..1 fills it with gold. */
export function jar(s: Stage, x: number, y: number, h: number, coins: number, lid: string): void {
  const { ctx } = s;
  const w = h * 0.72;
  rrect(ctx, x - w / 2, y - h, w, h, w * 0.18);
  ctx.fillStyle = 'rgba(210,235,255,.22)';
  ctx.fill();
  if (coins > 0) {
    ctx.save();
    rrect(ctx, x - w / 2, y - h, w, h, w * 0.18);
    ctx.clip();
    const top = y - h * coins * 0.88;
    rect(ctx, x - w / 2, top, w, h, '#e9b23c');
    for (let i = 0; i < 12; i++) ell(ctx, x - w / 2 + s.rng() * w, top + s.rng() * (y - top), h * 0.08, h * 0.04, i % 2 ? '#ffd76a' : '#c98f22');
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = Math.max(1, h * 0.03);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.3, y - h * 0.8);
  ctx.lineTo(x - w * 0.3, y - h * 0.3);
  ctx.stroke();
  rect(ctx, x - w * 0.42, y - h - h * 0.12, w * 0.84, h * 0.14, lid);
}

/** A potted plant: dead (a bare drooping stem) or in bloom. */
export function plant(s: Stage, x: number, y: number, h: number, bloom: number, pot: string): void {
  const { ctx } = s;
  poly(ctx, [[x - h * 0.2, y - h * 0.32], [x + h * 0.2, y - h * 0.32], [x + h * 0.15, y], [x - h * 0.15, y]], pot);
  rect(ctx, x - h * 0.22, y - h * 0.36, h * 0.44, h * 0.07, mix(pot, '#000000', 0.15));
  if (bloom <= 0) {
    ctx.strokeStyle = '#5a5144';
    ctx.lineWidth = Math.max(1, h * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.34);
    ctx.quadraticCurveTo(x + h * 0.05, y - h * 0.8, x + h * 0.3, y - h * 0.68);
    ctx.moveTo(x, y - h * 0.5);
    ctx.quadraticCurveTo(x - h * 0.15, y - h * 0.65, x - h * 0.24, y - h * 0.52);
    ctx.stroke();
    ell(ctx, x + h * 0.32, y - h * 0.64, h * 0.07, h * 0.035, '#6b5d48', 0.8);
    ell(ctx, x - h * 0.26, y - h * 0.48, h * 0.06, h * 0.03, '#5d5040', -0.6);
    return;
  }
  ctx.strokeStyle = '#3e8a4a';
  ctx.lineWidth = Math.max(1, h * 0.035);
  ctx.lineCap = 'round';
  const stems: [number, number][] = [[0, -1], [-0.28, -0.82], [0.3, -0.86], [-0.12, -0.92], [0.16, -0.98]];
  for (const [dx, dy] of stems) {
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.34);
    ctx.quadraticCurveTo(x + dx * h * 0.3, y - h * 0.6, x + dx * h, y + dy * h);
    ctx.stroke();
    ell(ctx, x + dx * h * 0.6, y - h * 0.62, h * 0.09, h * 0.04, '#5fb860', dx * 2);
  }
  stems.forEach(([dx, dy], i) => {
    const fx = x + dx * h, fy = y + dy * h, r = h * 0.085 * bloom;
    for (let k = 0; k < 5; k++) ell(ctx, fx + Math.cos((k / 5) * TAU) * r, fy + Math.sin((k / 5) * TAU) * r, r * 0.75, r * 0.75, i % 2 ? '#ff8fa8' : '#ffd25e');
    ell(ctx, fx, fy, r * 0.6, r * 0.6, i % 2 ? '#ffd25e' : '#f08a3c');
  });
}

/** Grass blades along y, in a band `hgt` px tall. */
export function grass(s: Stage, x0: number, x1: number, y: number, hgt: number, color: string, n: number): void {
  const { ctx } = s;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s.u * 0.3);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = x0 + s.rng() * (x1 - x0), hh = hgt * (0.4 + s.rng() * 0.6), lean = (s.rng() - 0.5) * hh * 0.5;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.3, y - hh * 0.6, x + lean, y - hh);
  }
  ctx.stroke();
}

/** Flowers scattered over a band (bright scenes). */
export function flowers(s: Stage, x0: number, x1: number, y0: number, y1: number, n: number, colors: readonly string[]): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + s.rng() * (x1 - x0), y = y0 + s.rng() * (y1 - y0);
    const r = s.u * (0.5 + s.rng() * 0.6) * (0.6 + 0.6 * (y - y0) / Math.max(1, y1 - y0));
    const c = colors[i % colors.length];
    for (let k = 0; k < 5; k++) ell(s.ctx, x + Math.cos((k / 5) * TAU) * r, y + Math.sin((k / 5) * TAU) * r * 0.7, r * 0.7, r * 0.55, c);
    ell(s.ctx, x, y, r * 0.5, r * 0.45, '#ffe066');
  }
}

/** A tree: a trunk and either bare branches (dark) or a round crown of leaves (bright). */
export function tree(s: Stage, x: number, y: number, h: number, leafy: boolean, trunk: string, leaf: string, leaf2: string): void {
  const { ctx } = s;
  ctx.strokeStyle = trunk;
  ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.07;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - h * 0.03, y - h * 0.4, x + h * 0.02, y - h * 0.62);
  ctx.stroke();
  const branches: [number, number, number][] = [[-0.28, -0.82, 0.03], [0.3, -0.88, 0.03], [-0.12, -0.98, 0.025], [0.12, -0.74, 0.025], [-0.34, -0.62, 0.02]];
  for (const [dx, dy, wd] of branches) {
    ctx.lineWidth = h * wd;
    ctx.beginPath();
    ctx.moveTo(x + h * 0.01, y - h * 0.55);
    ctx.quadraticCurveTo(x + dx * h * 0.4, y + dy * h * 0.75, x + dx * h, y + dy * h);
    ctx.stroke();
  }
  if (!leafy) return;
  const blobs: [number, number, number][] = [[0, -0.82, 0.34], [-0.25, -0.7, 0.26], [0.27, -0.72, 0.27], [-0.1, -1.0, 0.25], [0.15, -0.98, 0.24], [0.02, -0.62, 0.22]];
  for (const [dx, dy, r] of blobs) ell(ctx, x + dx * h, y + dy * h, r * h, r * h * 0.92, leaf2);
  for (const [dx, dy, r] of blobs) ell(ctx, x + dx * h - r * h * 0.15, y + dy * h - r * h * 0.18, r * h * 0.78, r * h * 0.7, leaf);
  for (let i = 0; i < 9; i++) ell(ctx, x + (s.rng() - 0.5) * h * 0.7, y - h * (0.65 + s.rng() * 0.38), h * 0.04, h * 0.035, mix(leaf, '#ffffff', 0.3));
}

/** A boat seen from the side: hull, a mast with a small sail (`sail` 0..1 raised), tilted by `tilt`. */
export function boat(s: Stage, x: number, y: number, w: number, tilt: number, hull: string, sail: string, raised: number): void {
  const { ctx } = s;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  poly(ctx, [[-w / 2, -w * 0.1], [w / 2, -w * 0.12], [w * 0.36, w * 0.1], [-w * 0.38, w * 0.1]], hull);
  rect(ctx, -w / 2, -w * 0.12, w, w * 0.035, mix(hull, '#ffffff', 0.2));
  rect(ctx, -w * 0.02, -w * 0.75, w * 0.03, w * 0.65, mix(hull, '#000000', 0.2));
  if (raised > 0) poly(ctx, [[w * 0.02, -w * 0.72], [w * 0.02, -w * 0.15], [w * 0.02 + w * 0.42 * raised, -w * 0.17]], sail);
  else poly(ctx, [[w * 0.02, -w * 0.72], [w * 0.02, -w * 0.45], [w * 0.16, -w * 0.5]], sail);
  ctx.restore();
}

/** The sea from y0 to the bottom: rolling bands of waves (`rough` 0..1). */
export function sea(s: Stage, y0: number, deep: string, light: string, foam: string, rough: number): void {
  const { ctx, w, h, u } = s;
  rect(ctx, 0, y0, w, h - y0, vgrad(ctx, y0, h, [light, deep]));
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const y = y0 + ((r + 0.5) / rows) * (h - y0) * (0.4 + 0.6 * (r / rows));
    const amp = u * (0.4 + rough * 3.2) * (0.4 + r / rows);
    const len = u * (8 + r * 2.5) * (1 + rough * 0.5);
    ctx.strokeStyle = rgba(foam, 0.18 + 0.25 * rough + 0.1 * (r / rows));
    ctx.lineWidth = Math.max(1, u * (0.3 + 0.25 * r / rows) * (1 + rough));
    ctx.beginPath();
    const ph = s.rng() * TAU;
    for (let x = -len; x <= w + len; x += len / 8) {
      const k = (x / len) * TAU + ph;
      const yy = y + Math.sin(k) * amp - (rough > 0.5 ? Math.max(0, Math.sin(k)) ** 6 * amp * 1.5 : 0);
      if (x <= -len) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

/** A heavy chain from (x0, y0) to (x1, y1) sagging by `sag` px, its links `link` px long; `broken` leaves a gap. */
export function chain(s: Stage, x0: number, y0: number, x1: number, y1: number, sag: number, link: number, color: string, broken = false): void {
  const { ctx } = s;
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / (link * 0.8)));
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, link * 0.2);
  for (let i = 0; i < n; i++) {
    if (broken && i >= Math.floor(n * 0.45) && i <= Math.floor(n * 0.6)) continue;
    const t = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    const ang = Math.atan2(y1 - y0 + Math.cos(t * Math.PI) * sag * Math.PI / n, x1 - x0);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, link * 0.5, link * (i % 2 ? 0.12 : 0.28), 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/** A door in a wall (`open` 0..1 swings it into the room) with what lies beyond. */
export function door(s: Stage, x: number, y: number, w: number, h: number, open: number, beyond: string | CanvasGradient, wood: string, frame: string): void {
  const { ctx } = s;
  rect(ctx, x - w * 0.08, y - h - w * 0.08, w * 1.16, h + w * 0.08, frame);
  rect(ctx, x, y - h, w, h, beyond);
  if (open < 1) {
    const dw = w * (1 - open * 0.82);
    rect(ctx, x, y - h, dw, h, wood);
    rect(ctx, x + dw * 0.12, y - h * 0.92, dw * 0.76, h * 0.38, mix(wood, '#000000', 0.12));
    rect(ctx, x + dw * 0.12, y - h * 0.48, dw * 0.76, h * 0.38, mix(wood, '#000000', 0.12));
    ell(ctx, x + dw * 0.85, y - h * 0.5, w * 0.04, w * 0.04, '#c9a45a');
  } else {
    // the open door swung into the room, seen edge-on as a slanted panel
    poly(ctx, [[x, y - h], [x - w * 0.42, y - h * 1.04], [x - w * 0.42, y + h * 0.03], [x, y]], wood);
  }
}

/** Bars of a cell window or door. */
export function bars(s: Stage, x: number, y: number, w: number, h: number, n: number, color: string): void {
  for (let i = 0; i <= n; i++) rect(s.ctx, x + (w * i) / n - s.u * 0.4, y, s.u * 0.8, h, color);
  rect(s.ctx, x, y + h * 0.3, w, s.u * 0.7, color);
}

/** A desk with a lamp, a laptop, papers and a clock face reading two o'clock (no words: any language). */
export function clockFace(s: Stage, x: number, y: number, r: number, face: string, hands: string, hour: number, minute: number): void {
  const { ctx } = s;
  ell(ctx, x, y, r * 1.12, r * 1.12, mix(face, '#000000', 0.35));
  ell(ctx, x, y, r, r, face);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    line(ctx, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92, hands, Math.max(1, r * 0.06));
  }
  const ha = ((hour % 12) / 12 + minute / 720) * TAU - Math.PI / 2, ma = (minute / 60) * TAU - Math.PI / 2;
  line(ctx, x, y, x + Math.cos(ha) * r * 0.5, y + Math.sin(ha) * r * 0.5, hands, Math.max(1, r * 0.1));
  line(ctx, x, y, x + Math.cos(ma) * r * 0.78, y + Math.sin(ma) * r * 0.78, hands, Math.max(1, r * 0.06));
}

/** A flight of birds (bright skies): small "m" strokes. */
export function birds(s: Stage, x: number, y: number, n: number, size: number, color: string): void {
  const { ctx, u } = s;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, u * 0.35);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const bx = x + (s.rng() - 0.3) * size * u * 6, by = y + (s.rng() - 0.5) * size * u * 3, b = size * u * (0.6 + s.rng() * 0.5);
    ctx.beginPath();
    ctx.moveTo(bx - b, by);
    ctx.quadraticCurveTo(bx - b * 0.5, by - b * 0.6, bx, by);
    ctx.quadraticCurveTo(bx + b * 0.5, by - b * 0.6, bx + b, by);
    ctx.stroke();
  }
}

/** A picnic blanket in perspective with a basket. */
export function picnic(s: Stage, x: number, y: number, w: number, a: string, b: string): void {
  const { ctx } = s;
  const h = w * 0.22;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + w * 0.08, y - h);
  ctx.lineTo(x + w / 2 - w * 0.08, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x - w / 2, y);
  ctx.closePath();
  ctx.fillStyle = a;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 8; i++) rect(ctx, x - w / 2 + (w / 8) * i, y - h, w / 16, h, b);
  for (let i = 0; i < 4; i++) rect(ctx, x - w / 2, y - h + (h / 4) * i, w, h / 8, rgba(b, 0.5));
  ctx.restore();
}
