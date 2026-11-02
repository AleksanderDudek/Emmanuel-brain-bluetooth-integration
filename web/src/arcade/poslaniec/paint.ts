/**
 * Posłaniec's drawing primitives (Canvas 2D, no assets), shared by the play view, the calibration
 * intro, the lobby picture and the progress card: a dawn sky over the hills of Asia that turns to
 * evening in the watchtowers' blocks, the hills in three layers, the distant silhouettes of the seven
 * cities, their postcards, the messenger seen from behind (tunic, cloak in the jar's colour, the
 * satchel with the letters), silver drachmas, sandals and the satchel, and a watchtower's fire.
 *
 * The palette is a painted dawn: indigo, plum and apricot sky, mauve and olive hills, warm limestone
 * paving.  Gold is kept for the signal (above the threshold) and the heights; drachmas are silver.
 */
import type { CityId } from './content';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

export const C = {
  ink: '#2b2219', paper: '#f7ead2', parchment: '#f1e0bd', edge: '#c9a46a',
  gold: '#ffcf6e', gold2: '#ffe7a8', rose: '#f2b9c0', cool: '#8fb0e8',
  skin: '#c98e5e', skin2: '#a8704a', hair: '#3a2617', tunic: '#eadcc0', tunic2: '#cdbb98', strap: '#6e4426', bag: '#8a5632',
  silver: '#e9eaf2', silver2: '#a9acbd', stone: '#d6c3a0', stone2: '#b49d78', wood: '#8a5a34', wood2: '#5e3b20',
} as const;

const TAU = Math.PI * 2;

export type RGB = [number, number, number];
export function hex(s: string): RGB {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgb = (c: RGB, a = 1): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
export function mixInto(out: RGB, a: RGB, b: RGB, t: number): RGB {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
export const mix = (a: RGB, b: RGB, t: number): RGB => mixInto([0, 0, 0], a, b, t);

/** Stable pseudo-random numbers for decorations. */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── the sky ──────────────────────────────────────────────────────
export interface SkyLook { top: RGB; mid: RGB; low: RGB; glow: RGB; hill: [RGB, RGB, RGB]; ground: RGB; ground2: RGB }
const DAWN: SkyLook = {
  top: hex('#2e3a59'), mid: hex('#8d5a78'), low: hex('#f4a259'), glow: hex('#ffe2b8'),
  hill: [hex('#a77a8e'), hex('#7d6176'), hex('#55604a')], ground: hex('#8a8f55'), ground2: hex('#5d6a3c'),
};
const DUSK: SkyLook = {
  top: hex('#141a33'), mid: hex('#3e3863'), low: hex('#b65a4a'), glow: hex('#f2a477'),
  hill: [hex('#5b4a6e'), hex('#3f3a57'), hex('#2f3a35')], ground: hex('#4a5236'), ground2: hex('#2f3824'),
};
const NIGHT: SkyLook = {
  top: hex('#0b0f22'), mid: hex('#1d2346'), low: hex('#3b3560'), glow: hex('#6a5a86'),
  hill: [hex('#2d2b48'), hex('#24233b'), hex('#1b2122')], ground: hex('#262b20'), ground2: hex('#1a1f16'),
};

/** The sky's look: dawn (0) to evening (1); below 0 toward the night before dawn. */
export function skyAt(dusk: number, out?: SkyLook): SkyLook {
  const o = out ?? { top: [0, 0, 0], mid: [0, 0, 0], low: [0, 0, 0], glow: [0, 0, 0], hill: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], ground: [0, 0, 0], ground2: [0, 0, 0] };
  const [a, b, k] = dusk >= 0 ? [DAWN, DUSK, Math.min(1, dusk)] : [DAWN, NIGHT, Math.min(1, -dusk)];
  for (const key of ['top', 'mid', 'low', 'glow', 'ground', 'ground2'] as const) mixInto(o[key], a[key], b[key], k);
  for (let i = 0; i < 3; i++) mixInto(o.hill[i], a.hill[i], b.hill[i], k);
  return o;
}

/** The sky down to the horizon, the low sun (`sun` 0 under the hills … 1 risen) and long dawn clouds. */
export function paintSky(ctx: CanvasRenderingContext2D, w: number, horizon: number, s: SkyLook, sunX: number, sun: number, t: number, drift = 0): void {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, rgb(s.top));
  g.addColorStop(0.55, rgb(s.mid));
  g.addColorStop(0.88, rgb(s.low));
  g.addColorStop(1, rgb(s.glow));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizon + 2);
  // the sun's glow and disc, rising behind the hills
  const sy = horizon - Math.max(0, sun) * horizon * 0.16 + 6;
  const R = Math.max(w, horizon) * 0.55;
  const glow = ctx.createRadialGradient(sunX, sy, 0, sunX, sy, R);
  glow.addColorStop(0, rgb(s.glow, 0.75));
  glow.addColorStop(0.25, rgb(s.glow, 0.25));
  glow.addColorStop(1, rgb(s.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, horizon + 2);
  const r = Math.max(10, horizon * 0.07);
  ctx.fillStyle = rgb(mix(s.glow, [255, 250, 235], 0.6), 0.95);
  ctx.beginPath();
  ctx.arc(sunX, sy, r, 0, TAU);
  ctx.fill();
  // long thin clouds lit from below
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const cy = horizon * (0.18 + 0.13 * i) + Math.sin(i * 2.1) * 8;
    const cw = w * (0.25 + 0.2 * hash(i + 3));
    const cx = ((hash(i) * w * 1.6 - drift * (0.2 + 0.1 * i) - t * 3 * (1 + i * 0.3)) % (w * 1.6) + w * 1.6) % (w * 1.6) - w * 0.3;
    ctx.fillStyle = rgb(mix(s.low, s.glow, 0.5), 0.16 + 0.05 * i);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, Math.max(2, horizon * 0.012), 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A layer of hills from `y` down (`off` scrolls it, px); `amp` its height. */
export function paintHills(ctx: CanvasRenderingContext2D, w: number, y: number, amp: number, off: number, color: RGB, seed: number, bottom: number, trees = 0): void {
  ctx.fillStyle = rgb(color);
  ctx.beginPath();
  ctx.moveTo(-4, bottom);
  const step = Math.max(6, w / 90);
  const prof = (x: number) => {
    const u = (x + off) / Math.max(120, w * 0.45);
    return y - amp * (0.55 + 0.25 * Math.sin(u * 2.1 + seed) + 0.15 * Math.sin(u * 5.3 + seed * 2) + 0.05 * Math.sin(u * 13 + seed));
  };
  for (let x = -4; x <= w + step; x += step) ctx.lineTo(x, prof(x));
  ctx.lineTo(w + step, bottom);
  ctx.closePath();
  ctx.fill();
  if (trees > 0) {
    // cypresses along the ridge
    const gap = 46;
    const k0 = Math.floor((off - 40) / gap);
    for (let k = k0; k * gap - off < w + 40; k++) {
      if (hash(k * 7 + seed) > 0.42) continue;
      const x = k * gap - off + hash(k + seed) * gap;
      const h = trees * (0.6 + 0.6 * hash(k * 3 + seed));
      const by = prof(x) + 2;
      ctx.beginPath();
      ctx.moveTo(x - h * 0.16, by);
      ctx.quadraticCurveTo(x - h * 0.2, by - h * 0.6, x, by - h);
      ctx.quadraticCurveTo(x + h * 0.2, by - h * 0.6, x + h * 0.16, by);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ── the seven cities ─────────────────────────────────────────────
/** A city's silhouette on a hill, `size` px wide, its base centred at (x, y). */
export function paintCity(ctx: CanvasRenderingContext2D, id: CityId, x: number, y: number, size: number, color: string): void {
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  const rect = (x0: number, y0: number, w: number, h: number) => ctx.fillRect(x0 * s, -(y0 + h) * s, w * s, h * s);
  const roof = (x0: number, y0: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(x0 * s, -y0 * s);
    ctx.lineTo((x0 + w / 2) * s, -(y0 + h) * s);
    ctx.lineTo((x0 + w) * s, -y0 * s);
    ctx.closePath();
    ctx.fill();
  };
  const cols = (x0: number, y0: number, n: number, gap: number, h: number) => { for (let i = 0; i < n; i++) rect(x0 + i * gap, y0, gap * 0.45, h); };
  // the hill under every city
  ctx.beginPath();
  ctx.moveTo(-0.6 * s, 0);
  ctx.quadraticCurveTo(0, -0.22 * s, 0.6 * s, 0);
  ctx.fill();
  switch (id) {
    case 'efez':   // the great theatre in the hillside and the harbour's colonnade
      ctx.beginPath();
      ctx.arc(-0.12 * s, -0.08 * s, 0.22 * s, Math.PI, 0);
      ctx.fill();
      cols(0.12, 0.08, 5, 0.07, 0.16);
      rect(0.1, 0.24, 0.36, 0.03);
      break;
    case 'smyrna':   // Mount Pagos crowned with buildings, "the crown of Smyrna"
      ctx.beginPath();
      ctx.moveTo(-0.45 * s, -0.05 * s);
      ctx.quadraticCurveTo(0, -0.5 * s, 0.45 * s, -0.05 * s);
      ctx.fill();
      for (let i = -3; i <= 3; i++) rect(i * 0.07 - 0.025, 0.33 - Math.abs(i) * 0.035, 0.05, 0.07);
      break;
    case 'pergamon':   // the steep acropolis with the temple terraces
      ctx.beginPath();
      ctx.moveTo(-0.4 * s, 0);
      ctx.lineTo(-0.1 * s, -0.55 * s);
      ctx.lineTo(0.2 * s, -0.5 * s);
      ctx.lineTo(0.45 * s, 0);
      ctx.fill();
      rect(-0.12, 0.55, 0.3, 0.08);
      roof(-0.14, 0.63, 0.34, 0.07);
      cols(-0.25, 0.32, 3, 0.06, 0.1);
      break;
    case 'tiatyra':   // a low town of workshops, dyed cloth drying on lines
      for (let i = -2; i <= 2; i++) { rect(i * 0.15 - 0.06, 0.06, 0.12, 0.12 + 0.03 * (i & 1)); roof(i * 0.15 - 0.07, 0.18 + 0.03 * (i & 1), 0.14, 0.05); }
      ctx.fillRect(-0.4 * s, -0.3 * s, 0.8 * s, 0.01 * s);
      for (let i = 0; i < 4; i++) rect(-0.33 + i * 0.2, 0.22, 0.08, 0.07);
      break;
    case 'sardes':   // the sheer acropolis cliff and the temple of Artemis' columns
      ctx.beginPath();
      ctx.moveTo(-0.15 * s, 0);
      ctx.lineTo(-0.05 * s, -0.62 * s);
      ctx.lineTo(0.12 * s, -0.66 * s);
      ctx.lineTo(0.2 * s, 0);
      ctx.fill();
      cols(-0.48, 0.05, 4, 0.06, 0.2);
      rect(-0.5, 0.25, 0.24, 0.03);
      break;
    case 'filadelfia':   // a gate in the city wall with towers
      rect(-0.42, 0.05, 0.84, 0.16);
      rect(-0.42, 0.21, 0.1, 0.08);
      rect(0.32, 0.21, 0.1, 0.08);
      rect(-0.12, 0.21, 0.24, 0.12);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, -0.13 * s, 0.07 * s, Math.PI, 0);
      ctx.rect(-0.07 * s, -0.13 * s, 0.14 * s, 0.09 * s);
      ctx.fill();
      ctx.restore();
      break;
    case 'laodycea':   // the aqueduct striding over the plain
      for (let i = 0; i < 6; i++) rect(-0.48 + i * 0.18, 0.04, 0.05, 0.22);
      rect(-0.5, 0.26, 1, 0.05);
      roof(0.05, 0.31, 0.3, 0.1);
      break;
  }
  ctx.restore();
}

/** A city's postcard: its sky, the hills and the silhouette; a dark sketch until reached. */
export function paintPostcard(ctx: CanvasRenderingContext2D, id: CityId, index: number, x: number, y: number, w: number, h: number, owned: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const look = skyAt(owned ? 0.15 * (index % 3) : -0.9);
  paintSky(ctx, w, y + h * 0.72, look, x + w * (0.25 + 0.1 * index), 0.6, 0, index * 40);
  paintHills(ctx, x + w, y + h * 0.78, h * 0.18, index * 37, look.hill[1], index, y + h);
  paintCity(ctx, id, x + w * 0.55, y + h * 0.8, w * 0.7, owned ? rgb(mix(look.hill[2], [40, 30, 40], 0.4)) : 'rgba(10,10,24,.7)');
  ctx.fillStyle = rgb(look.ground2);
  ctx.fillRect(x, y + h * 0.86, w, h);
  ctx.restore();
}

// ── the messenger ────────────────────────────────────────────────
export interface RunnerPose {
  /** run cycle (steps), airborne (0..1 tuck), sliding (0..1), lean (rad), landing squash (0..1), stumble (0..1) */
  stride: number;
  air: number;
  slide: number;
  lean: number;
  squash: number;
  stumble: number;
  /** cloak colours */
  wool: string;
  trim: string;
  /** play time, for the cloak's flutter */
  t: number;
  alpha: number;
}

/** The messenger seen from behind, feet at (x, y), `s` px per metre. */
export function paintRunner(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: RunnerPose): void {
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.translate(x, y);
  ctx.rotate(p.lean + p.stumble * 0.25 * Math.sin(p.t * 30));
  const sq = 1 - 0.14 * p.squash, st = 1 + 0.1 * p.squash;
  const slide = p.slide;
  ctx.scale(st * (1 + 0.15 * slide), sq * (1 - 0.48 * slide));
  const ph = p.stride * Math.PI;
  const run = 1 - Math.max(p.air, slide);
  const lw = 0.11 * s;
  // the legs: the foot of the leg in the air lifts behind (its sole toward us)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const lift = run * Math.max(0, Math.sin(ph + (side < 0 ? 0 : Math.PI))) + p.air * 0.85;
    const hipX = side * 0.09 * s, hipY = -0.86 * s;
    const footY = -lift * 0.42 * s;
    const footX = side * (0.12 + 0.05 * p.air) * s;
    const kneeX = side * 0.12 * s, kneeY = hipY * 0.5 - lift * 0.18 * s;
    ctx.strokeStyle = C.skin2;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY - 0.05 * s);
    ctx.stroke();
    // the sandal: a sole and its straps
    ctx.fillStyle = '#5a3a20';
    ctx.beginPath();
    ctx.ellipse(footX, footY - 0.03 * s, 0.065 * s, (0.035 + 0.03 * lift) * s, 0, 0, TAU);
    ctx.fill();
  }
  // the tunic
  ctx.fillStyle = C.tunic;
  ctx.beginPath();
  ctx.moveTo(-0.2 * s, -1.42 * s);
  ctx.lineTo(0.2 * s, -1.42 * s);
  ctx.lineTo(0.25 * s, -0.74 * s);
  ctx.lineTo(-0.25 * s, -0.74 * s);
  ctx.closePath();
  ctx.fill();
  // the arms swing against the legs
  for (const side of [-1, 1]) {
    const sw = run * Math.sin(ph + (side < 0 ? Math.PI : 0)) * 0.12 + p.air * 0.25;
    ctx.strokeStyle = C.skin;
    ctx.lineWidth = 0.09 * s;
    ctx.beginPath();
    ctx.moveTo(side * 0.21 * s, -1.36 * s);
    ctx.lineTo(side * (0.29 + p.air * 0.1) * s, (-1.08 - sw * 0.6) * s);
    ctx.lineTo(side * (0.3 + p.air * 0.22) * s, (-0.86 - sw * 1.4 - p.air * 0.4) * s);
    ctx.stroke();
  }
  // the cloak, fluttering behind the shoulders
  const fl = Math.sin(p.t * 9) * 0.03 * s * run, fl2 = Math.sin(p.t * 7 + 1) * 0.04 * s;
  ctx.fillStyle = p.wool;
  ctx.beginPath();
  ctx.moveTo(-0.19 * s, -1.44 * s);
  ctx.quadraticCurveTo(0, -1.5 * s, 0.19 * s, -1.44 * s);
  ctx.lineTo(0.3 * s + fl, -0.66 * s + fl2);
  ctx.quadraticCurveTo(0, -0.6 * s - fl2, -0.3 * s - fl, -0.66 * s - fl2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.trim;
  ctx.beginPath();
  ctx.moveTo(0.29 * s + fl, -0.72 * s + fl2);
  ctx.lineTo(0.3 * s + fl, -0.66 * s + fl2);
  ctx.quadraticCurveTo(0, -0.6 * s - fl2, -0.3 * s - fl, -0.66 * s - fl2);
  ctx.lineTo(-0.29 * s - fl, -0.72 * s - fl2);
  ctx.quadraticCurveTo(0, -0.66 * s - fl2, 0.29 * s + fl, -0.72 * s + fl2);
  ctx.fill();
  // a fold down the cloak
  ctx.strokeStyle = 'rgba(0,0,0,.14)';
  ctx.lineWidth = 0.02 * s;
  ctx.beginPath();
  ctx.moveTo(0.02 * s, -1.4 * s);
  ctx.quadraticCurveTo(0.05 * s + fl, -1.0 * s, 0.03 * s, -0.66 * s);
  ctx.stroke();
  // the satchel's strap across the back, the satchel at the hip with a letter's roll
  ctx.strokeStyle = C.strap;
  ctx.lineWidth = 0.045 * s;
  ctx.beginPath();
  ctx.moveTo(0.16 * s, -1.42 * s);
  ctx.lineTo(-0.2 * s, -0.86 * s);
  ctx.stroke();
  ctx.fillStyle = C.bag;
  ctx.beginPath();
  ctx.roundRect(-0.34 * s, -0.94 * s, 0.2 * s, 0.17 * s, 0.04 * s);
  ctx.fill();
  ctx.fillStyle = '#f3e6c4';
  ctx.fillRect(-0.3 * s, -1.0 * s, 0.05 * s, 0.08 * s);
  // the head from behind: the neck, the hair, a headband
  ctx.fillStyle = C.skin2;
  ctx.fillRect(-0.05 * s, -1.52 * s, 0.1 * s, 0.1 * s);
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.arc(0, -1.6 * s, 0.13 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(-0.13 * s, -1.6 * s, 0.03 * s, 0, TAU);
  ctx.arc(0.13 * s, -1.6 * s, 0.03 * s, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 0.03 * s;
  ctx.beginPath();
  ctx.arc(0, -1.6 * s, 0.125 * s, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.restore();
}

// ── things on the road ───────────────────────────────────────────
/** A silver drachma, spinning: `spin` the turn (rad). */
export function paintCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, alpha = 1): void {
  const w = Math.max(0.18, Math.abs(Math.cos(spin)));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = C.silver2;
  ctx.beginPath();
  ctx.ellipse(x, y, r * w, r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.silver;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.08 * w, y - r * 0.06, r * w * 0.78, r * 0.8, 0, 0, TAU);
  ctx.fill();
  if (r > 4 && w > 0.5) {
    // the owl of Athens, as a dot and two eyes
    ctx.fillStyle = 'rgba(120,124,150,.7)';
    ctx.beginPath();
    ctx.arc(x - r * 0.18 * w, y - r * 0.1, r * 0.12, 0, TAU);
    ctx.arc(x + r * 0.14 * w, y - r * 0.1, r * 0.12, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35 * w, y - r * 0.4, r * 0.14, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A pair of winged-light sandals (high jumps), `r` px. */
export function paintSandals(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#7a4a26';
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.32, y, r * 0.24, r * 0.55, side * 0.15, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e6c27a';
    ctx.lineWidth = Math.max(1, r * 0.08);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.12, y - r * 0.3 + i * r * 0.25);
      ctx.lineTo(x + side * r * 0.52, y - r * 0.25 + i * r * 0.25);
      ctx.stroke();
    }
  }
}

/** The messenger's satchel (a magnet for drachmas), `r` px. */
export function paintSatchel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.strokeStyle = C.strap;
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  ctx.arc(x, y - r * 0.2, r * 0.55, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.fillStyle = C.bag;
  ctx.beginPath();
  ctx.roundRect(x - r * 0.6, y - r * 0.25, r * 1.2, r * 0.85, r * 0.18);
  ctx.fill();
  ctx.fillStyle = '#6a3e20';
  ctx.beginPath();
  ctx.roundRect(x - r * 0.6, y - r * 0.25, r * 1.2, r * 0.35, r * 0.15);
  ctx.fill();
  ctx.fillStyle = C.silver;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.08, r * 0.1, 0, TAU);
  ctx.fill();
}

/** A fire in a watchtower's bowl: `k` 0 (cold) … 1 (blazing). */
export function paintFire(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, k: number, t: number): void {
  if (k <= 0.01) return;
  const h = size * (0.35 + 0.9 * k);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - h * 0.3, 0, x, y - h * 0.3, size * (0.8 + 2.2 * k));
  g.addColorStop(0, `rgba(255,190,90,${0.35 + 0.45 * k})`);
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.3, size * (0.8 + 2.2 * k), 0, TAU);
  ctx.fill();
  ctx.restore();
  for (const [c, f] of [['#ff7a2e', 1], ['#ffc04a', 0.68], ['#fff1b8', 0.36]] as const) {
    const fh = h * f, fw = size * 0.38 * (0.6 + 0.4 * f) * (0.7 + 0.3 * k);
    const sway = Math.sin(t * 9 + f * 4) * fw * 0.25;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - fw, y);
    ctx.quadraticCurveTo(x - fw * 0.9, y - fh * 0.5, x + sway, y - fh);
    ctx.quadraticCurveTo(x + fw * 0.9, y - fh * 0.5, x + fw, y);
    ctx.closePath();
    ctx.fill();
  }
}
