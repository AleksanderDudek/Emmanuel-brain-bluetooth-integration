/**
 * Zacheusz's drawing primitives (Canvas 2D, no assets), shared by the play view, the calibration
 * intro, the lobby and the progress card: Jericho, the city of palms, at noon — sun-baked mudbrick,
 * indigo and madder awnings, saffron cloth, palm green — as flat gouache shapes with a dark ink
 * line.  Zacchaeus (a short man in a purple robe with a coin purse), the street's pieces, the
 * high way in its three states, the denarii in their sets, the critters he hops, the fig trees of
 * the shade, the sycamore-fig, the palms of the skyline, and the procession's dust far ahead.
 *
 * Jesus is never drawn: the procession is a cloud of dust, raised palm branches and a crowd far off.
 */
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';

export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

export const C = {
  ink: '#2a1e17', paper: '#fbf1dc', paper2: '#f3e3c3',
  skyTop: '#8cc7c4', skyMid: '#f1ddb0', skyLow: '#f5c486',
  hillFar: '#d3a99a', hillNear: '#b88676',
  brick: '#dba366', brick2: '#c8884f', brickDark: '#9a6136', plaster: '#efd8ab', parapet: '#b97a4b', doorway: '#4a2c1e',
  indigo: '#34477e', indigo2: '#4d64a3', madder: '#b5432f', saffron: '#e9a23b', cream: '#f6e8c6',
  stone: '#cdb48f', stone2: '#a88f6c', wood: '#9a6a3f', wood2: '#6e4628', rope: '#c9a46a',
  trunk: '#8a5a3c', trunk2: '#6b4229', frond: '#4f8a3c', frond2: '#74a84c',
  gold: '#f2c14e', gold2: '#d9961c', teal: '#4fa39a', teal2: '#2f7d78',
  silver: '#e4e7ee', silver2: '#9aa3b2', coin: '#f3c64b', coin2: '#c48a1a', purple: '#9b59d0', purple2: '#5b2a8a',
  robe: '#5d3a72', robe2: '#46285a', trim: '#e7b54a', skin: '#c88b5c', skin2: '#a96c42', cloth: '#efe2c0', beard: '#4a2f22',
  water: '#5aa0b5', water2: '#3d7d93', earth: '#b98a5c', earth2: '#9c7049',
  figGreen: '#94b24c', figRipe: '#6c2c5e', leaf: '#4c7d36', leaf2: '#6e9d48',
  shade: '#1f4f57',
} as const;

const TAU = Math.PI * 2;

/** Stable pseudo-random numbers for decorations (the same every frame). */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export type RGB = [number, number, number];
export function hex(s: string): RGB {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgb = (c: RGB, a = 1): string =>
  a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, a).toFixed(3)})`;
export function mixHex(a: string, b: string, t: number, alpha = 1): string {
  const x = hex(a), y = hex(b);
  return rgb([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t], alpha);
}

// ── the sky and the far land ─────────────────────────────────────
/** The sky over Jericho: noon's turquoise over an apricot haze; `shade` cools it toward the sycamore's shadow. */
export function paintSky(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, shade: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, mixHex(C.skyTop, '#6fa9b0', shade * 0.6));
  g.addColorStop(0.62, mixHex(C.skyMid, '#cfe0c8', shade * 0.5));
  g.addColorStop(1, mixHex(C.skyLow, '#dcd2a8', shade * 0.5));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizon + 2);
  // the sun's warmth, high on the right
  const sun = ctx.createRadialGradient(w * 0.82, horizon * 0.18, 0, w * 0.82, horizon * 0.18, Math.max(w, h) * 0.45);
  sun.addColorStop(0, `rgba(255,246,214,${0.55 * (1 - shade * 0.6)})`);
  sun.addColorStop(1, 'rgba(255,246,214,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, horizon + 2);
}

/** A range of the Judean wilderness's rounded hills, scrolled by `off` px. */
export function paintHills(ctx: CanvasRenderingContext2D, w: number, base: number, amp: number, off: number, color: string, seed: number, bottom: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-4, bottom);
  const k = 1 / Math.max(60, amp * 3.2);
  for (let x = -4; x <= w + 8; x += 8) {
    const u = (x + off) * k + seed;
    const y = base - amp * (0.55 + 0.3 * Math.sin(u) + 0.15 * Math.sin(u * 2.3 + 1.7));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 8, bottom);
  ctx.closePath();
  ctx.fill();
}

/** The plain of Jericho below the hills: the oasis's fields in soft bands of sage and wheat. */
export function paintPlain(ctx: CanvasRenderingContext2D, w: number, top: number, bottom: number, off: number, shade: number): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, mixHex('#c7b98a', '#a9b7a0', shade * 0.5));
  g.addColorStop(1, mixHex('#a7a86c', '#8ea38c', shade * 0.5));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, bottom - top);
  // hedgerows between the fields, closer together toward the horizon
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 6; row++) {
    const q = row / 6;
    const y = top + (bottom - top) * (0.06 + q * q * 0.9);
    ctx.strokeStyle = row % 2 ? 'rgba(110,135,74,.35)' : 'rgba(150,140,84,.3)';
    ctx.beginPath();
    for (let x = -4; x <= w + 8; x += 16) ctx.lineTo(x, y + Math.sin((x + off * (0.3 + q)) * 0.013 + row * 1.7) * (1.5 + q * 3));
    ctx.stroke();
  }
}

// ── palms (the skyline of the signal, and the grove's trunks) ─────
export type Crown = 'gold' | 'teal' | 'green' | 'pale';
const CROWN: Record<Crown, [string, string]> = {
  gold: [C.gold, C.gold2], teal: [C.teal, C.teal2], green: [C.frond2, C.frond], pale: ['#d9d3c2', '#b9b19c'],
};

/** A date palm: a gently curved ringed trunk from (x, base) up `h` px, its crown `size` px wide. */
export function paintPalm(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, size: number, crown: Crown, sway = 0, alpha = 1): void {
  if (h < 1) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const tx = x + sway * h * 0.12, ty = base - h;
  const lw = Math.max(1.2, size * 0.12);
  ctx.strokeStyle = C.trunk;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.quadraticCurveTo(x + sway * h * 0.02 + h * 0.04, base - h * 0.55, tx, ty);
  ctx.stroke();
  if (h > 18 && lw > 2) {
    ctx.strokeStyle = C.trunk2;
    ctx.lineWidth = 1;
    for (let k = 0.15; k < 0.95; k += 0.12) {
      const px = x + (tx - x) * k + h * 0.04 * Math.sin(k * Math.PI), py = base - h * k;
      ctx.beginPath();
      ctx.moveTo(px - lw * 0.5, py);
      ctx.lineTo(px + lw * 0.5, py - 1);
      ctx.stroke();
    }
  }
  // the crown: fronds arching up and out, their tips drooping
  const [c1, c2] = CROWN[crown];
  const len = size * 0.62;
  const D = [-1, 1, -0.72, 0.72, -0.42, 0.42, -0.12, 0.16];
  for (let i = 0; i < D.length; i++) {
    const d = D[i] + sway * 0.12, ad = Math.abs(d);
    const l = len * (0.78 + 0.22 * ad);
    const cx = tx + d * l * 0.42, cy = ty - l * (0.5 - 0.22 * ad);
    const ex = tx + d * l, ey = ty + l * (0.42 * ad - 0.18);
    const wv = l * 0.16;
    ctx.fillStyle = i % 2 ? c2 : c1;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(cx, cy - wv, ex, ey);
    ctx.quadraticCurveTo(cx, cy + wv * 0.8, tx, ty + l * 0.06);
    ctx.closePath();
    ctx.fill();
  }
  if (crown === 'gold' && size > 8) {
    ctx.fillStyle = C.gold2;
    ctx.beginPath();
    ctx.arc(tx - size * 0.06, ty + size * 0.1, size * 0.07, 0, TAU);
    ctx.arc(tx + size * 0.07, ty + size * 0.12, size * 0.06, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A palm cut down to a stump: the band had no signal that second (never a low value). */
export function paintStump(ctx: CanvasRenderingContext2D, x: number, base: number, size: number): void {
  ctx.fillStyle = C.trunk;
  ctx.fillRect(x - size * 0.09, base - size * 0.32, size * 0.18, size * 0.32);
  ctx.fillStyle = '#c7a079';
  ctx.beginPath();
  ctx.ellipse(x, base - size * 0.32, size * 0.09, size * 0.035, 0, 0, TAU);
  ctx.fill();
}

// ── Zacchaeus ────────────────────────────────────────────────────
export interface HeroPose {
  /** the run cycle's phase (radians) and how much it shows (0 standing … 1 running) */
  run: number; stride: number;
  /** in the air: rising (+) or falling (−), 0 on the ground */
  air: number;
  /** a landing's squash 0..1 */
  squash: number;
  slide: boolean;
  climb: boolean;
  /** hanging from the rope, sitting in the tree */
  hang: boolean;
  sit: boolean;
  /** where his eyes look (radians, 0 = ahead) */
  look: number;
}

export const restPose = (): HeroPose => ({ run: 0, stride: 0, air: 0, squash: 0, slide: false, climb: false, hang: false, sit: false, look: -0.35 });

/** Zacchaeus with his feet at (x, y), `s` px tall: a short man, a purple robe trimmed in gold, a white headcloth, a purse. */
export function paintZacchaeus(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: HeroPose): void {
  ctx.save();
  ctx.translate(x, y);
  const sq = p.squash * 0.18;
  ctx.scale(1 + sq, 1 - sq);
  const line = Math.max(1, s * 0.035);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = line;
  // legs: a run cycle, tucked in the air, sitting, climbing
  const leg = (ph: number) => {
    let kx: number, fy: number;
    if (p.sit) { kx = s * 0.16; fy = -s * 0.12; }
    else if (p.climb) { kx = s * 0.04; fy = -s * (0.06 + 0.1 * Math.max(0, Math.sin(ph))); }
    else if (p.air !== 0 || p.hang) { kx = s * 0.08 * Math.sin(ph); fy = -s * (p.hang ? 0.02 : 0.12); }
    else { kx = s * 0.17 * Math.sin(ph) * p.stride; fy = -s * 0.07 * Math.max(0, Math.cos(ph)) * p.stride; }
    ctx.strokeStyle = C.skin2;
    ctx.lineWidth = s * 0.075;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.3);
    ctx.lineTo(kx, fy);
    ctx.stroke();
    ctx.fillStyle = C.wood2;
    ctx.beginPath();
    ctx.ellipse(kx + s * 0.04, fy - s * 0.01, s * 0.07, s * 0.035, 0, 0, TAU);
    ctx.fill();
  };
  leg(p.run + Math.PI);
  // the robe: a bell, flaring as he runs
  const flare = s * (0.04 + 0.05 * p.stride + (p.air < 0 ? 0.05 : 0));
  ctx.fillStyle = C.robe;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, -s * 0.66);
  ctx.quadraticCurveTo(-s * 0.2 - flare, -s * 0.38, -s * 0.2 - flare, -s * 0.22);
  ctx.lineTo(s * 0.2 + flare * 0.6, -s * 0.22);
  ctx.quadraticCurveTo(s * 0.2, -s * 0.42, s * 0.15, -s * 0.66);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = C.trim;
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(-s * 0.2 - flare, -s * 0.25);
  ctx.lineTo(s * 0.2 + flare * 0.6, -s * 0.25);
  ctx.stroke();
  // the sash and the purse
  ctx.fillStyle = C.saffron;
  ctx.fillRect(-s * 0.17, -s * 0.47, s * 0.34, s * 0.06);
  ctx.fillStyle = C.wood;
  ctx.beginPath();
  ctx.ellipse(-s * 0.13, -s * 0.38, s * 0.06, s * 0.07, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.coin;
  ctx.beginPath();
  ctx.arc(-s * 0.13, -s * 0.41, s * 0.02, 0, TAU);
  ctx.fill();
  leg(p.run);
  // arms: pumping as he runs, up on the ladder, up at the rope
  const arm = (ph: number, front: boolean) => {
    let hx: number, hy: number;
    if (p.climb) { hx = s * 0.14; hy = -s * (0.92 + 0.1 * Math.sin(ph)); }
    else if (p.hang) { hx = s * 0.02; hy = -s * 1.12; }
    else if (p.slide) { hx = s * 0.2; hy = -s * 0.86; }
    else if (p.air > 0) { hx = s * (front ? 0.18 : -0.1); hy = -s * 0.86; }
    else { hx = s * 0.14 * Math.sin(ph) * (0.4 + p.stride); hy = -s * (0.42 - 0.05 * Math.cos(ph)); }
    ctx.strokeStyle = front ? C.robe : C.robe2;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.6);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = C.skin;
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.045, 0, TAU);
    ctx.fill();
  };
  arm(p.run, false);
  // the head: large (he is short), a white headcloth with a tail that flies back
  const hy = -s * 0.8;
  const tail = p.air !== 0 ? -0.2 : 0.12 * p.stride;
  ctx.fillStyle = C.cloth;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, hy - s * 0.04);
  ctx.quadraticCurveTo(-s * 0.3, hy + s * (0.02 + tail), -s * 0.34, hy + s * (0.16 + tail));
  ctx.lineTo(-s * 0.18, hy + s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(s * 0.02, hy, s * 0.16, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.beard;
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, hy + s * 0.07);
  ctx.quadraticCurveTo(s * 0.06, hy + s * 0.22, s * 0.16, hy + s * 0.06);
  ctx.quadraticCurveTo(s * 0.06, hy + s * 0.11, -s * 0.06, hy + s * 0.07);
  ctx.fill();
  ctx.fillStyle = C.cloth;
  ctx.beginPath();
  ctx.ellipse(s * 0.0, hy - s * 0.09, s * 0.18, s * 0.1, -0.1, Math.PI, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = C.indigo;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(-s * 0.17, hy - s * 0.07);
  ctx.lineTo(s * 0.17, hy - s * 0.1);
  ctx.stroke();
  // the eye looks up and ahead: he wants to see
  const ex = s * 0.09 + Math.cos(p.look) * s * 0.01, ey = hy - s * 0.01 + Math.sin(p.look) * s * 0.02;
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(ex, ey, Math.max(1.1, s * 0.025), 0, TAU);
  ctx.fill();
  arm(p.run + Math.PI, true);
  ctx.restore();
}

/** Where his eyes are, relative to his feet (px), for the sightline. */
export const eyeOf = (s: number): { x: number; y: number } => ({ x: s * 0.1, y: -s * 0.81 });

// ── the street's pieces ──────────────────────────────────────────
/** The packed earth of the street and its mudbrick kerb, from y (its top) down. */
export function paintGround(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, bottom: number, S: number, seed: number, shade: number): void {
  const w = x1 - x0;
  ctx.fillStyle = mixHex(C.earth, C.shade, shade * 0.35);
  ctx.fillRect(x0, top, w, bottom - top);
  ctx.fillStyle = mixHex(C.brick2, C.shade, shade * 0.3);
  ctx.fillRect(x0, top, w, Math.max(3, S * 0.12));
  ctx.fillStyle = mixHex(C.earth2, C.shade, shade * 0.3);
  const n = Math.ceil(w / (S * 0.9));
  for (let i = 0; i < n; i++) {
    const r = hash(seed + i);
    ctx.fillRect(x0 + (i + r * 0.5) * S * 0.9, top + S * (0.35 + r * 0.6), S * 0.18, Math.max(2, S * 0.06));
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.025);
  ctx.beginPath();
  ctx.moveTo(x0, top);
  ctx.lineTo(x1, top);
  ctx.stroke();
}

/** A mudbrick house seen from the street: flat roof with a parapet, a dark door, small windows, a ladder on its near side. */
export function paintHouse(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, base: number, S: number, seed: number, ladder: boolean): void {
  const w = x1 - x0, h = base - top;
  const tint = hash(seed) * 0.25;
  ctx.fillStyle = mixHex(C.brick, C.plaster, tint);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.03);
  ctx.fillRect(x0, top, w, h);
  ctx.strokeRect(x0, top, w, h);
  // the parapet and its drain spouts
  ctx.fillStyle = C.parapet;
  ctx.fillRect(x0 - S * 0.05, top - S * 0.08, w + S * 0.1, S * 0.14);
  ctx.strokeRect(x0 - S * 0.05, top - S * 0.08, w + S * 0.1, S * 0.14);
  ctx.fillStyle = C.wood2;
  for (let x = x0 + S * 0.6; x < x1 - S * 0.3; x += S * 1.3) ctx.fillRect(x, top + S * 0.08, S * 0.22, S * 0.07);
  // brick courses
  ctx.strokeStyle = 'rgba(120,70,40,.22)';
  ctx.lineWidth = 1;
  for (let y = top + S * 0.35; y < base - 2; y += S * 0.3) {
    ctx.beginPath();
    ctx.moveTo(x0 + 2, y);
    ctx.lineTo(x1 - 2, y);
    ctx.stroke();
  }
  // a door and windows
  const dw = S * 0.5, dh = Math.min(h * 0.55, S * 1.05);
  const dx = x0 + w * (0.3 + 0.4 * hash(seed + 3));
  ctx.fillStyle = C.doorway;
  ctx.beginPath();
  ctx.moveTo(dx - dw / 2, base);
  ctx.lineTo(dx - dw / 2, base - dh + dw / 2);
  ctx.arc(dx, base - dh + dw / 2, dw / 2, Math.PI, TAU);
  ctx.lineTo(dx + dw / 2, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.indigo;
  for (let x = x0 + S * 0.5; x < x1 - S * 0.4; x += S * 1.1) {
    if (Math.abs(x + S * 0.12 - dx) < dw) continue;
    ctx.fillRect(x, top + S * 0.45, S * 0.24, S * 0.28);
  }
  if (ladder) paintLadder(ctx, x0 - S * 0.12, top - S * 0.1, base, S);
}

export function paintLadder(ctx: CanvasRenderingContext2D, x: number, top: number, base: number, S: number): void {
  ctx.strokeStyle = C.wood2;
  ctx.lineWidth = Math.max(1.5, S * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - S * 0.12, base);
  ctx.lineTo(x - S * 0.06, top);
  ctx.moveTo(x + S * 0.14, base);
  ctx.lineTo(x + S * 0.12, top);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, S * 0.035);
  for (let y = base - S * 0.25; y > top + S * 0.05; y -= S * 0.3) {
    ctx.beginPath();
    ctx.moveTo(x - S * 0.1, y);
    ctx.lineTo(x + S * 0.13, y);
    ctx.stroke();
  }
}

/** A market stall's counter with its goods (pots, melons, dates). */
export function paintStall(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, base: number, S: number, seed: number): void {
  ctx.fillStyle = C.wood;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.03);
  ctx.fillRect(x0, top, x1 - x0, base - top);
  ctx.strokeRect(x0, top, x1 - x0, base - top);
  ctx.fillStyle = C.wood2;
  for (let x = x0 + S * 0.25; x < x1 - 2; x += S * 0.35) ctx.fillRect(x, top + S * 0.12, Math.max(1, S * 0.04), base - top - S * 0.16);
  // the goods on top
  for (let x = x0 + S * 0.2, i = 0; x < x1 - S * 0.15; x += S * 0.32, i++) {
    const k = hash(seed + i * 7);
    ctx.fillStyle = k < 0.33 ? C.saffron : k < 0.66 ? '#7c9b45' : C.madder;
    ctx.beginPath();
    ctx.arc(x, top - S * 0.08, S * 0.11, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

export function paintWall(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, base: number, S: number): void {
  ctx.fillStyle = C.stone;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.03);
  ctx.fillRect(x0, top, x1 - x0, base - top);
  ctx.strokeRect(x0, top, x1 - x0, base - top);
  ctx.strokeStyle = C.stone2;
  ctx.lineWidth = 1;
  let row = 0;
  for (let y = top + S * 0.32; y < base; y += S * 0.32, row++) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    for (let x = x0 + (row % 2 ? S * 0.25 : S * 0.5); x < x1; x += S * 0.5) {
      ctx.moveTo(x, y - S * 0.32);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

export function paintCrate(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, base: number, S: number): void {
  ctx.fillStyle = '#c08a52';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.03);
  ctx.fillRect(x0, top, x1 - x0, base - top);
  ctx.strokeRect(x0, top, x1 - x0, base - top);
  ctx.strokeStyle = C.wood2;
  ctx.lineWidth = Math.max(1, S * 0.04);
  for (let y = top; y < base - 2; y += S * 0.9) {
    const b = Math.min(base, y + S * 0.9);
    ctx.beginPath();
    ctx.moveTo(x0 + 3, y + 3);
    ctx.lineTo(x1 - 3, b - 3);
    ctx.stroke();
  }
}

/** An awning of striped cloth on two poles; `squash` dips it after a bounce. */
export function paintAwning(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, S: number, stripe: string, squash: number, poles: number): void {
  const dip = S * (0.08 + 0.25 * squash);
  ctx.strokeStyle = C.wood2;
  ctx.lineWidth = Math.max(1.5, S * 0.05);
  if (poles > y) {
    ctx.beginPath();
    ctx.moveTo(x0 + S * 0.08, y);
    ctx.lineTo(x0 + S * 0.08, poles);
    ctx.moveTo(x1 - S * 0.08, y);
    ctx.lineTo(x1 - S * 0.08, poles);
    ctx.stroke();
  }
  const n = Math.max(3, Math.round((x1 - x0) / (S * 0.32)));
  const sw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? C.cream : stripe;
    const a = x0 + i * sw, b = a + sw;
    const ya = y + dip * Math.sin((i / n) * Math.PI), yb = y + dip * Math.sin(((i + 1) / n) * Math.PI);
    ctx.beginPath();
    ctx.moveTo(a, ya - S * 0.06);
    ctx.lineTo(b, yb - S * 0.06);
    ctx.lineTo(b, yb + S * 0.12);
    ctx.quadraticCurveTo((a + b) / 2, (ya + yb) / 2 + S * 0.26, a, ya + S * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.03);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const xx = x0 + i * sw, yy = y + dip * Math.sin((i / n) * Math.PI) - S * 0.06;
    if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
  }
  ctx.stroke();
}

export function paintPlank(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, S: number): void {
  ctx.fillStyle = C.wood;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.03);
  ctx.fillRect(x0, y, x1 - x0, S * 0.14);
  ctx.strokeRect(x0, y, x1 - x0, S * 0.14);
}

export type HighLook = 'bridge' | 'frond' | 'roofawn';
export type HighState = 'solid' | 'outline' | 'mist' | 'live';

/**
 * A piece of the high way.  Solid: a rope bridge of planks, a bundle of palm fronds, or an awning
 * stretched across the roofs.  Outline: the same shape dashed and translucent (below the
 * threshold).  Mist: pale and dotted (no signal: the sensor's fault).  Live (not yet decided): a
 * dashed outline whose fill shimmers with the level `k`.
 */
export function paintHigh(ctx: CanvasRenderingContext2D, look: HighLook, x0: number, x1: number, y: number, S: number, state: HighState, k: number, t: number, pop: number): void {
  const w = x1 - x0;
  const solid = state === 'solid';
  ctx.save();
  if (pop > 0) {
    const s = 1 + 0.12 * Math.sin(pop * Math.PI);
    ctx.translate((x0 + x1) / 2, y);
    ctx.scale(s, s);
    ctx.translate(-(x0 + x1) / 2, -y);
  }
  const path = () => {
    ctx.beginPath();
    if (look === 'bridge') {
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo((x0 + x1) / 2, y + S * 0.28, x1, y);
      ctx.lineTo(x1, y + S * 0.14);
      ctx.quadraticCurveTo((x0 + x1) / 2, y + S * 0.42, x0, y + S * 0.14);
    } else if (look === 'frond') {
      ctx.moveTo(x0, y + S * 0.04);
      ctx.quadraticCurveTo((x0 + x1) / 2, y - S * 0.12, x1, y + S * 0.04);
      ctx.lineTo(x1 - S * 0.1, y + S * 0.18);
      ctx.quadraticCurveTo((x0 + x1) / 2, y + S * 0.08, x0 + S * 0.1, y + S * 0.18);
    } else {
      ctx.moveTo(x0, y - S * 0.04);
      ctx.lineTo(x1, y - S * 0.04);
      ctx.lineTo(x1, y + S * 0.12);
      ctx.quadraticCurveTo((x0 + x1) / 2, y + S * 0.3, x0, y + S * 0.12);
    }
    ctx.closePath();
  };
  if (solid) {
    if (look === 'bridge') {
      ctx.strokeStyle = C.rope;
      ctx.lineWidth = Math.max(1.2, S * 0.035);
      ctx.beginPath();
      ctx.moveTo(x0, y - S * 0.45);
      ctx.quadraticCurveTo((x0 + x1) / 2, y - S * 0.15, x1, y - S * 0.45);
      ctx.stroke();
      const n = Math.max(3, Math.round(w / (S * 0.28)));
      for (let i = 0; i <= n; i++) {
        const q = i / n, xx = x0 + w * q, yy = y + S * 0.28 * 4 * q * (1 - q) * 0.5;
        ctx.fillStyle = i % 2 ? C.wood : '#b07d4b';
        ctx.fillRect(xx - S * 0.11, yy - S * 0.02, S * 0.2, S * 0.16);
        ctx.strokeStyle = C.rope;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, y - S * 0.45 + S * 0.3 * 4 * q * (1 - q) * 0.5);
        ctx.stroke();
      }
      path();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, S * 0.025);
      ctx.stroke();
    } else if (look === 'frond') {
      path();
      ctx.fillStyle = C.frond;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, S * 0.025);
      ctx.stroke();
      ctx.strokeStyle = C.frond2;
      ctx.lineWidth = Math.max(1, S * 0.04);
      for (let x = x0 + S * 0.2; x < x1 - S * 0.1; x += S * 0.22) {
        ctx.beginPath();
        ctx.moveTo(x, y + S * 0.04);
        ctx.lineTo(x + S * 0.12, y + S * 0.3);
        ctx.stroke();
      }
    } else {
      paintAwning(ctx, x0, x1, y + S * 0.02, S, C.indigo2, 0, -Infinity);
    }
  } else {
    path();
    const live = state === 'live';
    ctx.fillStyle = state === 'mist' ? 'rgba(220,220,214,.16)' : live ? `rgba(242,193,78,${(0.08 + 0.4 * k * k) * (0.85 + 0.15 * Math.sin(t * 7))})` : 'rgba(255,248,230,.16)';
    ctx.fill();
    ctx.setLineDash(state === 'mist' ? [1.5, 5] : [6, 5]);
    ctx.lineDashOffset = -t * 12;
    ctx.strokeStyle = state === 'mist' ? 'rgba(235,235,230,.55)' : live ? `rgba(255,236,170,${0.5 + 0.5 * k})` : 'rgba(255,248,230,.62)';
    ctx.lineWidth = Math.max(1.4, S * 0.035);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// ── pits ─────────────────────────────────────────────────────────
/** An irrigation ditch: earth walls and water at its bottom. */
export function paintDitch(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, bottom: number, S: number, t: number): void {
  ctx.fillStyle = '#6e4a2e';
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  const wy = top + S * 1.2;
  ctx.fillStyle = C.water2;
  ctx.fillRect(x0, wy, x1 - x0, bottom - wy);
  ctx.strokeStyle = C.water;
  ctx.lineWidth = Math.max(1, S * 0.04);
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, wy + Math.sin(x * 0.12 + t * 3) * S * 0.03);
  ctx.stroke();
}

/** A well: a stone rim, a dark shaft, a winch over it. */
export function paintWell(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, bottom: number, S: number): void {
  ctx.fillStyle = '#2a1c14';
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  ctx.fillStyle = C.stone;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.03);
  for (const x of [x0 - S * 0.3, x1]) {
    ctx.fillRect(x, top - S * 0.25, S * 0.3, S * 0.25);
    ctx.strokeRect(x, top - S * 0.25, S * 0.3, S * 0.25);
  }
  ctx.strokeStyle = C.wood2;
  ctx.lineWidth = Math.max(1.5, S * 0.05);
  ctx.beginPath();
  ctx.moveTo(x0 - S * 0.15, top - S * 0.25);
  ctx.lineTo(x0 - S * 0.15, top - S * 1.3);
  ctx.lineTo(x1 + S * 0.15, top - S * 1.3);
  ctx.lineTo(x1 + S * 0.15, top - S * 0.25);
  ctx.stroke();
  ctx.strokeStyle = C.rope;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo((x0 + x1) / 2, top - S * 1.3);
  ctx.lineTo((x0 + x1) / 2, top - S * 0.5);
  ctx.stroke();
}

// ── denarii ──────────────────────────────────────────────────────
export type CoinKind = 'denar' | 'silver' | 'gold' | 'purple';
const COIN: Record<CoinKind, [string, string]> = {
  denar: [C.coin, C.coin2], silver: [C.silver, C.silver2], gold: [C.gold, C.gold2], purple: [C.purple, C.purple2],
};

/** A coin of radius r turning (`spin` radians): a plain denarius, or a large special one with a laurel ring. */
export function paintCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kind: CoinKind, spin: number, empty = false): void {
  const sx = Math.max(0.18, Math.abs(Math.cos(spin)));
  const [c1, c2] = COIN[kind];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  if (empty) {
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = c2;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(42,30,23,.55)';
  ctx.lineWidth = Math.max(0.8, r * 0.09);
  ctx.beginPath();
  ctx.arc(0, r * 0.04, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = c2;
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, TAU);
  ctx.stroke();
  if (kind !== 'denar') {
    // a laurel ring and a star of light
    ctx.fillStyle = c2;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.11, r * 0.05, a + 1.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.32, r * 0.18, r * 0.1, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ── what he hops over ────────────────────────────────────────────
export function paintBasket(ctx: CanvasRenderingContext2D, x: number, y: number, S: number): void {
  ctx.fillStyle = '#c99a55';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.03);
  ctx.beginPath();
  ctx.moveTo(x - S * 0.24, y - S * 0.38);
  ctx.lineTo(x + S * 0.24, y - S * 0.38);
  ctx.lineTo(x + S * 0.18, y);
  ctx.lineTo(x - S * 0.18, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#9b6f36';
  ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(x - S * 0.22, y - S * 0.38 + k * S * 0.095);
    ctx.lineTo(x + S * 0.22, y - S * 0.38 + k * S * 0.095);
    ctx.stroke();
  }
  ctx.fillStyle = C.figRipe;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(x + i * S * 0.1, y - S * 0.42, S * 0.07, 0, TAU);
    ctx.fill();
  }
}

/** A hen: pecking, or flapping off (`flee` 0..1) once he has hopped over her. */
export function paintChicken(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number, flee: number): void {
  const fx = x + flee * S * 1.2, fy = y - Math.sin(Math.min(1, flee) * Math.PI) * S * 0.8;
  const peck = flee > 0 ? 0 : Math.max(0, Math.sin(t * 5)) * S * 0.06;
  ctx.save();
  ctx.translate(fx, fy);
  ctx.fillStyle = '#f4ede0';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.025);
  ctx.beginPath();
  ctx.ellipse(0, -S * 0.2, S * 0.2, S * 0.15, -0.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-S * 0.17, -S * 0.36 + peck, S * 0.09, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.madder;
  ctx.beginPath();
  ctx.arc(-S * 0.17, -S * 0.46 + peck, S * 0.04, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.saffron;
  ctx.beginPath();
  ctx.moveTo(-S * 0.26, -S * 0.36 + peck);
  ctx.lineTo(-S * 0.33, -S * 0.33 + peck);
  ctx.lineTo(-S * 0.25, -S * 0.31 + peck);
  ctx.fill();
  if (flee > 0) {
    ctx.fillStyle = '#e2d6c2';
    const fl = Math.sin(t * 30) * 0.6;
    ctx.beginPath();
    ctx.ellipse(S * 0.02, -S * 0.3, S * 0.16, S * 0.06, -0.8 + fl, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A sleeping dog curled on the street (it lifts its head once he has hopped over). */
export function paintDog(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, woke: number): void {
  ctx.fillStyle = '#b98a5a';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.025);
  ctx.beginPath();
  ctx.ellipse(x, y - S * 0.15, S * 0.32, S * 0.15, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const hx = x - S * 0.26, hy = y - S * (0.16 + 0.14 * woke);
  ctx.beginPath();
  ctx.ellipse(hx, hy, S * 0.13, S * 0.1, -0.3 * woke, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a6038';
  ctx.beginPath();
  ctx.ellipse(hx + S * 0.05, hy - S * 0.06, S * 0.05, S * 0.08, 0.6, 0, TAU);
  ctx.fill();
  if (woke < 0.2) {
    ctx.fillStyle = 'rgba(42,30,23,.6)';
    ctx.font = font(700, S * 0.18, SANS);
    ctx.fillText('z', x + S * 0.05, y - S * 0.42);
  }
}

// ── trees ────────────────────────────────────────────────────────
/** A fig tree of the shade: a broad canopy, five figs ripening with `ripe` (green → purple); picked ones are gone. */
export function paintFigTree(ctx: CanvasRenderingContext2D, x: number, base: number, S: number, ripe: number, picked: number, sway: number): void {
  ctx.fillStyle = C.trunk;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, S * 0.03);
  ctx.beginPath();
  ctx.moveTo(x - S * 0.14, base);
  ctx.quadraticCurveTo(x - S * 0.05, base - S * 1.2, x - S * 0.3, base - S * 2);
  ctx.lineTo(x + S * 0.3, base - S * 2);
  ctx.quadraticCurveTo(x + S * 0.05, base - S * 1.2, x + S * 0.14, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const cy = base - S * 2.5;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + sway * 0.05;
    ctx.fillStyle = i % 2 ? C.leaf : C.leaf2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * S * 0.75, cy + Math.sin(a) * S * 0.4, S * 0.75, S * 0.5, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.leaf2;
  ctx.beginPath();
  ctx.ellipse(x, cy, S * 0.95, S * 0.6, 0, 0, TAU);
  ctx.fill();
  // the figs
  for (let k = 0; k < 5; k++) {
    if (picked >= 0 && k < picked) continue;
    const fx = x + (k - 2) * S * 0.36, fy = cy + S * (0.3 + 0.12 * (k % 2));
    const q = Math.min(1, Math.max(0, (ripe - [0.12, 0.28, 0.45, 0.62, 0.8][k] + 0.12) / 0.12));
    ctx.fillStyle = mixHex(C.figGreen, C.figRipe, q);
    ctx.beginPath();
    ctx.ellipse(fx, fy, S * 0.09, S * 0.11, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** The sycamore-fig at a course's end: a broad tree whose trunk he leaps onto, its five branches marked. */
export function paintSycamore(ctx: CanvasRenderingContext2D, x0: number, x1: number, base: number, S: number, lit: number, t: number): void {
  const cx = (x0 + x1) / 2;
  // the canopy behind
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    ctx.fillStyle = i % 2 ? '#3f6e2f' : '#57893c';
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * S * 2.2, base - S * 6.4 + Math.sin(a) * S * 1.2, S * 1.8, S * 1.1, a, 0, TAU);
    ctx.fill();
  }
  // the trunk: thick, forked
  ctx.fillStyle = '#9b7a58';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1.2, S * 0.035);
  ctx.beginPath();
  ctx.moveTo(x0 - S * 0.2, base);
  ctx.lineTo(x0, base - S * 5.6);
  ctx.lineTo(x0 - S * 1.4, base - S * 6.8);
  ctx.lineTo(x0 - S * 1.1, base - S * 7);
  ctx.lineTo(cx, base - S * 6);
  ctx.lineTo(x1 + S * 1.3, base - S * 7.1);
  ctx.lineTo(x1 + S * 1.5, base - S * 6.8);
  ctx.lineTo(x1, base - S * 5.6);
  ctx.lineTo(x1 + S * 0.2, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // the five branches reaching back toward the street, numbered by height
  for (let b = 0; b < 5; b++) {
    const by = base - S * (0.9 + b * 1.1);
    const len = S * (0.9 + 0.15 * b);
    ctx.strokeStyle = '#7d5f42';
    ctx.lineWidth = Math.max(2, S * (0.14 - b * 0.015));
    ctx.beginPath();
    ctx.moveTo(x0 + S * 0.1, by + S * 0.1);
    ctx.quadraticCurveTo(x0 - len * 0.5, by - S * 0.05, x0 - len, by - S * 0.25);
    ctx.stroke();
    ctx.fillStyle = b + 1 <= lit ? C.gold : 'rgba(255,248,230,.75)';
    ctx.beginPath();
    ctx.arc(x0 - len, by - S * 0.25, S * (0.1 + 0.02 * Math.sin(t * 4 + b)), 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#57893c';
    ctx.beginPath();
    ctx.ellipse(x0 - len * 0.7, by - S * 0.3, S * 0.25, S * 0.13, -0.4, 0, TAU);
    ctx.fill();
  }
}

// ── the procession's dust, far ahead ─────────────────────────────
/** A cloud of dust on the road with raised palm branches and a far crowd at its foot; never a figure in it. */
export function paintProcession(ctx: CanvasRenderingContext2D, x: number, base: number, r: number, t: number, near: number): void {
  ctx.save();
  const puffs = 7;
  for (let i = 0; i < puffs; i++) {
    const a = i / puffs;
    const px = x + (a - 0.5) * r * 2.4 + Math.sin(t * 0.7 + i * 1.7) * r * 0.08;
    const py = base - r * (0.35 + 0.35 * Math.sin(a * Math.PI)) + Math.cos(t * 0.5 + i) * r * 0.05;
    ctx.fillStyle = i % 2 ? `rgba(226,196,148,${0.55 + 0.3 * near})` : `rgba(242,222,182,${0.55 + 0.3 * near})`;
    ctx.beginPath();
    ctx.arc(px, py, r * (0.42 + 0.12 * Math.sin(i * 2.1)), 0, TAU);
    ctx.fill();
  }
  // the crowd far off: tiny figures, a few raised palm branches swaying over them
  const n = 12 + Math.round(near * 8);
  const fig = Math.min(r * 0.07, 9);
  for (let i = 0; i < n; i++) {
    const q = (i + 0.5) / n;
    const hx = x + (q - 0.5) * r * 2.2, hy = base - 1;
    ctx.fillStyle = i % 3 === 0 ? '#8a6a92' : i % 3 === 1 ? '#b0623e' : '#cdb48f';
    ctx.fillRect(hx - fig * 0.5, hy - fig * 1.6, fig, fig * 1.6);
    ctx.fillStyle = i % 2 ? '#e9dcc0' : '#c99a72';
    ctx.beginPath();
    ctx.arc(hx, hy - fig * 1.9, fig * 0.45, 0, TAU);
    ctx.fill();
    if (i % 3 === 1) {
      const sw = Math.sin(t * 2.6 + i) * 0.35;
      const bx = hx + fig * 0.6, by = hy - fig * 2.2, len = fig * 3.2;
      ctx.strokeStyle = C.frond;
      ctx.lineWidth = Math.max(1, fig * 0.25);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + len * (0.2 + sw), by - len * 0.6, bx + len * (0.45 + sw), by - len * 0.9);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let k = 1; k <= 3; k++) {
        const qx = bx + len * (0.15 + sw * 0.5) * k / 3 * 1.6, qy = by - len * 0.3 * k;
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.lineTo(qx - fig * 0.6, qy + fig * 0.3);
        ctx.moveTo(qx, qy);
        ctx.lineTo(qx + fig * 0.6, qy + fig * 0.2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ── a household for the town map ─────────────────────────────────
/** A small house of Jericho: as it was (dim, its repair missing) or restored (warm, with the repair in place). */
export function paintHome(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, w: number, h: number, restored: boolean): void {
  const base = y + h * 0.92, top = y + h * 0.36;
  const x0 = x + w * 0.18, x1 = x + w * 0.82;
  ctx.fillStyle = restored ? mixHex(C.brick, C.plaster, hash(i) * 0.4) : '#8e8172';
  ctx.strokeStyle = restored ? C.ink : '#5d5348';
  ctx.lineWidth = 1;
  ctx.fillRect(x0, top, x1 - x0, base - top);
  ctx.strokeRect(x0, top, x1 - x0, base - top);
  ctx.fillStyle = restored ? C.doorway : '#4c443c';
  ctx.fillRect(x + w * 0.44, base - h * 0.28, w * 0.12, h * 0.28);
  // the roof: whole, or a gap of missing beams
  ctx.fillStyle = restored ? C.parapet : '#6c6157';
  if (restored || i !== 0) ctx.fillRect(x0 - 2, top - 3, x1 - x0 + 4, 4);
  else {
    ctx.fillRect(x0 - 2, top - 3, (x1 - x0) * 0.35, 4);
    ctx.fillRect(x1 - (x1 - x0) * 0.3, top - 3, (x1 - x0) * 0.3 + 2, 4);
  }
  if (!restored) return;
  // what was mended, as a small sign beside the house
  const sx = x + w * 0.88, sy = base;
  ctx.fillStyle = [C.parapet, C.wood, '#efe6d6', C.leaf2, C.indigo, '#c9542f', C.wood2, C.stone, C.purple, C.saffron, C.rope, C.rope][i % 12];
  ctx.beginPath();
  ctx.arc(sx, sy - h * 0.12, Math.max(2, w * 0.07), 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(x + w * 0.3, top + h * 0.12, Math.max(1.5, w * 0.04), 0, TAU);
  ctx.fill();
}
