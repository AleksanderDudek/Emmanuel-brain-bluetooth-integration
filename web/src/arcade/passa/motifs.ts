/**
 * Złota passa's motifs (DESIGN.md §26, builder B; §29 the twenty of life.ts `LIFE_MOTIFS` added in round 25, P2): one
 * small, clear picture per `Motif` of moments.ts and per life motif, drawn in
 * code in a unit square (0..1, y down) with a palette — the grey side's quiet greys or the gold side's warm colours.
 * `t` is the time for a small life in the picture (steam rising, rain falling, the green light breathing); 0 keeps it
 * still (reduced motion).
 */
import type { LifeMotif } from './life';
import type { Motif } from './moments';
import { TAU, desat, mixHex } from './paint';

/** A motif of round 22 or one of round 25's life motifs (the card's stamp draws either). */
export type AnyMotif = Motif | LifeMotif;

export interface MotifPal {
  /** outlines and dark parts */
  ink: string;
  /** the main and the second fill, a highlight, the motif's own colour and a second one */
  fill: string;
  fill2: string;
  light: string;
  accent: string;
  accent2: string;
  /** the stamp's ground behind the picture */
  bg: string;
}

/** Each motif's own colours on the gold side (accent, accent2). */
const OWN: Readonly<Record<AnyMotif, [string, string]>> = {
  cup: ['#7a4a2a', '#f6efe4'], light: ['#3ad07a', '#ffb43a'], car: ['#d8574a', '#5a8ac8'], rain: ['#5a8ac8', '#9ac4ee'],
  queue: ['#d8784a', '#5a8a6a'], clock: ['#d8574a', '#f6efe4'], spill: ['#7a4a2a', '#f6efe4'], phone: ['#4a8ad8', '#f6efe4'],
  smile: ['#f2b0a0', '#e8785a'], sun: ['#ffb43a', '#ffe08a'], bird: ['#d8784a', '#6aa25a'], letter: ['#d8574a', '#f6efe4'],
  bus: ['#e8b43a', '#4a6a8a'], clinic: ['#3aa07a', '#f6efe4'], desk: ['#a8743a', '#5a8a6a'], scale: ['#5a9ac8', '#f6efe4'],
  heart: ['#e0607a', '#ffb0b8'], door: ['#8a5a3a', '#e8b43a'], seed: ['#6aa25a', '#8a5a3a'], hand: ['#e8b48a', '#ffe08a'],
  tap: ['#5aa8d8', '#dfe8ee'], shower: ['#5aa8d8', '#dfe8ee'], bread: ['#c8782e', '#f6dca8'], apple: ['#d8302a', '#6aa84a'],
  tea: ['#c8782e', '#f4e070'], flower: ['#f2a0b8', '#ffd25a'], grass: ['#6aa84a', '#a8d070'], window: ['#5a8ac8', '#ffd890'],
  sky: ['#5a9ad8', '#ffffff'], music: ['#4a4a5a', '#ffd890'], kettle: ['#d8463a', '#8a5a32'], sweater: ['#c8543e', '#f0b8a0'],
  feet: ['#4a6a9a', '#f4f0e8'], eyes: ['#5a8a6a', '#7ab8e8'], bed: ['#8a9ac8', '#f6f2ec'], switch: ['#ffd25a', '#f6f2ea'],
  fridge: ['#9ab8c8', '#f4f8fa'], book: ['#5a3a6a', '#c8302a'], pet: ['#e8a060', '#8aa8c8'], rainbow: ['#ff5a5a', '#4aa0f0'],
};

/** The palettes: the grey side (`heavy`: deeper) and the gold side for a motif. */
export function greyPal(heavy: boolean): MotifPal {
  return heavy
    ? { ink: '#20242e', fill: '#6c7286', fill2: '#868ca0', light: '#b4b8c6', accent: '#7a8094', accent2: '#9ca0b0', bg: '#4a5064' }
    : { ink: '#4a4e58', fill: '#9aa0aa', fill2: '#b6bbc4', light: '#e2e4ea', accent: '#80868f', accent2: '#c4c8d0', bg: '#cdd1d8' };
}

export function goldPal(m: AnyMotif, heavy: boolean): MotifPal {
  const [a, b] = OWN[m] ?? OWN.sun;
  if (heavy) return { ink: '#4a2e3e', fill: '#d9a6a0', fill2: '#f0c8b8', light: '#fff2e6', accent: mixHex(a, '#e8b4b8', 0.35), accent2: mixHex(b, '#fff0e0', 0.3), bg: '#f6dcc8' };
  return { ink: '#5a3a1a', fill: '#e8a84a', fill2: '#f4cf86', light: '#fff6e0', accent: a, accent2: b, bg: '#fde9bc' };
}

/** A palette's colours greyed toward the grey side by `k` (0 the palette … 1 grey): the turn's middle. */
export function towardGrey(p: MotifPal, k: number): MotifPal {
  const g = (c: string) => desat(c, 1 - k);
  return { ink: g(p.ink), fill: g(p.fill), fill2: g(p.fill2), light: g(p.light), accent: g(p.accent), accent2: g(p.accent2), bg: g(p.bg) };
}

type Ctx = CanvasRenderingContext2D;

const circle = (c: Ctx, x: number, y: number, r: number): void => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
const rrect = (c: Ctx, x: number, y: number, w: number, h: number, r: number): void => {
  const k = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
};

/** Draw a motif in the square (x, y, s) with a palette; `t` seconds for its small life (0: still). */
export function drawMotif(c: Ctx, m: AnyMotif, x: number, y: number, s: number, p: MotifPal, t = 0): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const fn = MOTIF_DRAW[m] ?? MOTIF_DRAW.sun;
  fn(c, p, t);
  c.restore();
}

/** One drawing per motif (every one of moments.ts MOTIFS and life.ts LIFE_MOTIFS — the test checks it). */
export const MOTIF_DRAW: Readonly<Record<AnyMotif, (c: Ctx, p: MotifPal, t: number) => void>> = {
  cup(c, p, t) {
    // the saucer, the cup with its handle, the coffee, the steam
    c.fillStyle = p.fill2;
    c.beginPath(); c.ellipse(0.5, 0.8, 0.36, 0.08, 0, 0, TAU); c.fill();
    c.fillStyle = p.accent2;
    c.beginPath(); c.moveTo(0.24, 0.48); c.lineTo(0.76, 0.48); c.quadraticCurveTo(0.74, 0.78, 0.5, 0.79); c.quadraticCurveTo(0.26, 0.78, 0.24, 0.48); c.fill();
    c.strokeStyle = p.accent2; c.lineWidth = 0.05;
    c.beginPath(); c.ellipse(0.8, 0.6, 0.07, 0.08, 0, -1.3, 1.5); c.stroke();
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(0.5, 0.49, 0.25, 0.05, 0, 0, TAU); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.025;
    c.beginPath(); c.moveTo(0.24, 0.48); c.quadraticCurveTo(0.26, 0.78, 0.5, 0.79); c.quadraticCurveTo(0.74, 0.78, 0.76, 0.48); c.stroke();
    c.strokeStyle = p.light; c.lineWidth = 0.03;
    for (let i = 0; i < 3; i++) {
      const ph = t * 1.2 + i * 2.1, x = 0.38 + i * 0.12, rise = (t * 0.08 + i * 0.13) % 0.12;
      c.globalAlpha = 0.85;
      c.beginPath();
      c.moveTo(x, 0.42 - rise);
      c.bezierCurveTo(x - 0.05 + 0.02 * Math.sin(ph), 0.34 - rise, x + 0.05, 0.27 - rise, x + 0.01 * Math.sin(ph), 0.18 - rise);
      c.stroke();
    }
    c.globalAlpha = 1;
  },
  light(c, p, t) {
    c.fillStyle = p.ink;
    c.fillRect(0.47, 0.72, 0.06, 0.26);
    rrect(c, 0.33, 0.06, 0.34, 0.68, 0.08); c.fill();
    const on = 0.75 + 0.25 * Math.sin(t * 2);
    for (let i = 0; i < 3; i++) {
      const cy = 0.18 + i * 0.22;
      c.fillStyle = i === 2 ? p.accent : mixHex(p.fill, p.ink, 0.5);
      circle(c, 0.5, cy, 0.08); c.fill();
      if (i === 2) {
        c.globalAlpha = 0.35 * on;
        circle(c, 0.5, cy, 0.15); c.fill();
        c.globalAlpha = 1;
        c.fillStyle = p.light;
        circle(c, 0.47, cy - 0.03, 0.025); c.fill();
      }
    }
  },
  car(c, p) {
    // a house's door far right, the car far left, the footsteps between (more steps)
    c.fillStyle = p.fill2;
    c.fillRect(0.66, 0.2, 0.3, 0.6);
    c.fillStyle = p.ink;
    rrect(c, 0.75, 0.46, 0.13, 0.34, 0.03); c.fill();
    c.fillStyle = p.fill;
    c.beginPath(); c.moveTo(0.62, 0.22); c.lineTo(0.81, 0.08); c.lineTo(1.0, 0.22); c.fill();
    c.fillStyle = p.accent;
    rrect(c, 0.04, 0.62, 0.3, 0.13, 0.04); c.fill();
    c.beginPath(); c.moveTo(0.09, 0.62); c.lineTo(0.14, 0.52); c.lineTo(0.26, 0.52); c.lineTo(0.31, 0.62); c.fill();
    c.fillStyle = p.light;
    c.fillRect(0.15, 0.54, 0.05, 0.07); c.fillRect(0.21, 0.54, 0.05, 0.07);
    c.fillStyle = p.ink;
    circle(c, 0.11, 0.76, 0.04); c.fill(); circle(c, 0.27, 0.76, 0.04); c.fill();
    c.fillStyle = p.accent2;
    for (let i = 0; i < 5; i++) {
      const x = 0.38 + i * 0.075, y = 0.82 - (i % 2) * 0.04;
      c.beginPath(); c.ellipse(x, y, 0.018, 0.03, 0.3, 0, TAU); c.fill();
    }
  },
  rain(c, p, t) {
    c.strokeStyle = p.accent2; c.lineWidth = 0.025;
    for (let i = 0; i < 7; i++) {
      const x = 0.2 + i * 0.1, f = ((t * 0.9 + i * 0.37) % 1);
      const y = 0.5 + f * 0.3;
      c.globalAlpha = 1 - f * 0.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 0.03, y + 0.08); c.stroke();
    }
    c.globalAlpha = 1;
    c.fillStyle = p.fill2;
    for (const [x, y, r] of [[0.32, 0.38, 0.14], [0.5, 0.3, 0.18], [0.68, 0.38, 0.14], [0.5, 0.42, 0.14]] as const) { circle(c, x, y, r); c.fill(); }
    c.fillStyle = p.light;
    circle(c, 0.46, 0.25, 0.08); c.fill();
    c.strokeStyle = p.accent; c.lineWidth = 0.02;
    c.beginPath(); c.ellipse(0.5, 0.92, 0.2, 0.04, 0, 0, TAU); c.stroke();
    c.beginPath(); c.ellipse(0.5, 0.92, 0.1, 0.02, 0, 0, TAU); c.stroke();
  },
  queue(c, p) {
    // a counter at the left, four people waiting
    c.fillStyle = p.fill2;
    c.fillRect(0.02, 0.5, 0.14, 0.42);
    const cols = [p.accent, p.fill, p.accent2, p.fill];
    for (let i = 0; i < 4; i++) {
      const x = 0.27 + i * 0.19, sc = 1 - i * 0.04;
      c.fillStyle = cols[i];
      c.beginPath();
      c.moveTo(x - 0.07 * sc, 0.92); c.lineTo(x - 0.075 * sc, 0.56); c.quadraticCurveTo(x, 0.47, x + 0.075 * sc, 0.56); c.lineTo(x + 0.07 * sc, 0.92);
      c.fill();
      c.fillStyle = p.ink;
      circle(c, x, 0.4, 0.055 * sc); c.fill();
    }
  },
  clock(c, p, t) {
    c.fillStyle = p.ink;
    c.save(); c.translate(0.5, 0.52);
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 0.24, -0.29, 0.09, 0, TAU); c.fill(); }
    c.fillRect(-0.24, 0.3, 0.06, 0.1); c.fillRect(0.18, 0.3, 0.06, 0.1);
    c.fillStyle = p.accent;
    circle(c, 0, 0, 0.36); c.fill();
    c.fillStyle = p.accent2;
    circle(c, 0, 0, 0.29); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.03;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      c.beginPath(); c.moveTo(Math.cos(a) * 0.24, Math.sin(a) * 0.24); c.lineTo(Math.cos(a) * 0.27, Math.sin(a) * 0.27); c.stroke();
    }
    const a1 = -Math.PI / 2 + t * 0.15, a2 = -Math.PI / 2 + 2.1;
    c.lineWidth = 0.035;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a1) * 0.22, Math.sin(a1) * 0.22); c.stroke();
    c.lineWidth = 0.045;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a2) * 0.14, Math.sin(a2) * 0.14); c.stroke();
    c.restore();
  },
  spill(c, p, t) {
    c.fillStyle = p.accent;
    const g = 1 + 0.04 * Math.sin(t * 0.8);
    c.beginPath(); c.ellipse(0.42, 0.82, 0.34 * g, 0.09 * g, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0.2, 0.86, 0.05, 0.02, 0, 0, TAU); c.fill();
    c.save(); c.translate(0.66, 0.62); c.rotate(1.25);
    c.fillStyle = p.accent2;
    c.beginPath(); c.moveTo(-0.2, -0.16); c.lineTo(0.2, -0.16); c.quadraticCurveTo(0.19, 0.12, 0, 0.13); c.quadraticCurveTo(-0.19, 0.12, -0.2, -0.16); c.fill();
    c.strokeStyle = p.accent2; c.lineWidth = 0.045;
    c.beginPath(); c.ellipse(0.24, -0.02, 0.06, 0.07, 0, -1.3, 1.5); c.stroke();
    c.strokeStyle = p.ink; c.lineWidth = 0.022;
    c.beginPath(); c.moveTo(-0.2, -0.16); c.quadraticCurveTo(-0.19, 0.12, 0, 0.13); c.quadraticCurveTo(0.19, 0.12, 0.2, -0.16); c.stroke();
    c.restore();
  },
  phone(c, p, t) {
    c.fillStyle = p.ink;
    rrect(c, 0.3, 0.06, 0.4, 0.88, 0.07); c.fill();
    c.fillStyle = p.accent2;
    rrect(c, 0.34, 0.14, 0.32, 0.68, 0.03); c.fill();
    c.fillStyle = p.accent;
    rrect(c, 0.38, 0.3, 0.24, 0.16, 0.05); c.fill();
    c.beginPath(); c.moveTo(0.42, 0.45); c.lineTo(0.4, 0.52); c.lineTo(0.48, 0.46); c.fill();
    c.fillStyle = p.light;
    for (let i = 0; i < 3; i++) {
      c.globalAlpha = 0.5 + 0.5 * Math.max(0, Math.sin(t * 3 - i * 0.8));
      circle(c, 0.44 + i * 0.06, 0.38, 0.018); c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = p.fill;
    rrect(c, 0.38, 0.55, 0.2, 0.06, 0.03); c.fill();
    rrect(c, 0.38, 0.64, 0.14, 0.06, 0.03); c.fill();
    c.fillStyle = p.fill2;
    circle(c, 0.5, 0.88, 0.025); c.fill();
  },
  smile(c, p) {
    c.fillStyle = p.accent2;
    circle(c, 0.5, 0.5, 0.38); c.fill();
    c.fillStyle = p.accent;
    circle(c, 0.5, 0.5, 0.34); c.fill();
    c.fillStyle = p.accent2;
    c.globalAlpha = 0.5;
    circle(c, 0.3, 0.58, 0.06); c.fill(); circle(c, 0.7, 0.58, 0.06); c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = p.ink; c.lineWidth = 0.04;
    c.beginPath(); c.arc(0.38, 0.44, 0.05, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.beginPath(); c.arc(0.62, 0.44, 0.05, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.beginPath(); c.arc(0.5, 0.52, 0.16, 0.25, Math.PI - 0.25); c.stroke();
  },
  sun(c, p, t) {
    c.save(); c.translate(0.5, 0.5); c.rotate(t * 0.12);
    c.strokeStyle = p.accent; c.lineWidth = 0.05;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, r0 = 0.27, r1 = i % 2 ? 0.38 : 0.44;
      c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke();
    }
    c.restore();
    c.fillStyle = p.accent;
    circle(c, 0.5, 0.5, 0.21); c.fill();
    c.fillStyle = p.accent2;
    circle(c, 0.45, 0.45, 0.12); c.fill();
  },
  bird(c, p, t) {
    c.strokeStyle = p.fill; c.lineWidth = 0.04;
    c.beginPath(); c.moveTo(0.02, 0.74); c.quadraticCurveTo(0.5, 0.66, 0.98, 0.78); c.stroke();
    c.fillStyle = p.accent2;
    for (const [x, y, a] of [[0.14, 0.7, -0.6], [0.84, 0.72, 0.5], [0.92, 0.7, 1.1]] as const) { c.beginPath(); c.ellipse(x, y, 0.07, 0.03, a, 0, TAU); c.fill(); }
    const hop = Math.max(0, Math.sin(t * 2.4)) ** 8 * 0.04;
    c.save(); c.translate(0.5, 0.52 - hop);
    c.fillStyle = p.fill2;
    c.beginPath(); c.ellipse(0.02, 0, 0.17, 0.14, 0, 0, TAU); c.fill();
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(0.06, 0.04, 0.1, 0.08, 0, 0, TAU); c.fill();
    c.fillStyle = p.fill;
    c.beginPath(); c.ellipse(-0.04, -0.01, 0.11, 0.07, -0.4, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-0.13, 0.02); c.lineTo(-0.3, -0.06); c.lineTo(-0.27, 0.05); c.fill();
    c.fillStyle = p.fill2;
    circle(c, 0.13, -0.1, 0.08); c.fill();
    c.fillStyle = p.ink;
    circle(c, 0.16, -0.12, 0.016); c.fill();
    c.fillStyle = p.accent2;
    c.beginPath(); c.moveTo(0.2, -0.1); c.lineTo(0.27, -0.08); c.lineTo(0.2, -0.06); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.02;
    c.beginPath(); c.moveTo(0.0, 0.13); c.lineTo(-0.01, 0.21); c.moveTo(0.06, 0.13); c.lineTo(0.07, 0.21); c.stroke();
    c.restore();
  },
  letter(c, p) {
    c.fillStyle = p.accent2;
    rrect(c, 0.08, 0.24, 0.84, 0.54, 0.04); c.fill();
    c.strokeStyle = p.fill; c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(0.1, 0.27); c.lineTo(0.5, 0.56); c.lineTo(0.9, 0.27); c.moveTo(0.1, 0.75); c.lineTo(0.4, 0.5); c.moveTo(0.9, 0.75); c.lineTo(0.6, 0.5); c.stroke();
    c.fillStyle = p.accent;
    c.save(); c.translate(0.5, 0.56);
    c.beginPath();
    c.moveTo(0, 0.07); c.bezierCurveTo(-0.13, -0.02, -0.06, -0.12, 0, -0.05); c.bezierCurveTo(0.06, -0.12, 0.13, -0.02, 0, 0.07);
    c.fill();
    c.restore();
  },
  bus(c, p) {
    c.fillStyle = p.accent;
    rrect(c, 0.16, 0.1, 0.68, 0.74, 0.1); c.fill();
    c.fillStyle = p.accent2;
    rrect(c, 0.22, 0.2, 0.56, 0.3, 0.04); c.fill();
    c.fillStyle = p.ink;
    rrect(c, 0.3, 0.12, 0.4, 0.06, 0.02); c.fill();
    c.fillStyle = p.light;
    circle(c, 0.28, 0.68, 0.05); c.fill(); circle(c, 0.72, 0.68, 0.05); c.fill();
    c.fillStyle = p.fill;
    c.fillRect(0.38, 0.62, 0.24, 0.1);
    c.fillStyle = p.ink;
    rrect(c, 0.2, 0.82, 0.14, 0.1, 0.03); c.fill(); rrect(c, 0.66, 0.82, 0.14, 0.1, 0.03); c.fill();
    c.fillStyle = p.light; c.globalAlpha = 0.35;
    c.beginPath(); c.moveTo(0.26, 0.48); c.lineTo(0.36, 0.22); c.lineTo(0.44, 0.22); c.lineTo(0.34, 0.48); c.fill();
    c.globalAlpha = 1;
  },
  clinic(c, p) {
    c.fillStyle = p.fill;
    rrect(c, 0.2, 0.1, 0.6, 0.84, 0.05); c.fill();
    c.fillStyle = p.accent2;
    rrect(c, 0.25, 0.18, 0.5, 0.72, 0.03); c.fill();
    c.fillStyle = p.ink;
    rrect(c, 0.38, 0.06, 0.24, 0.1, 0.03); c.fill();
    c.fillStyle = p.accent;
    c.fillRect(0.45, 0.25, 0.1, 0.24); c.fillRect(0.38, 0.32, 0.24, 0.1);
    c.fillStyle = p.fill2;
    for (let i = 0; i < 3; i++) { rrect(c, 0.31, 0.58 + i * 0.09, i === 2 ? 0.22 : 0.38, 0.04, 0.02); c.fill(); }
  },
  desk(c, p) {
    // an empty desk with its lamp, a chair pushed in
    c.fillStyle = p.fill;
    c.fillRect(0.08, 0.5, 0.84, 0.07);
    c.fillRect(0.12, 0.57, 0.05, 0.35); c.fillRect(0.83, 0.57, 0.05, 0.35);
    c.fillStyle = p.fill2;
    c.fillRect(0.6, 0.57, 0.23, 0.2);
    c.strokeStyle = p.ink; c.lineWidth = 0.025;
    c.beginPath(); c.moveTo(0.66, 0.67); c.lineTo(0.77, 0.67); c.stroke();
    c.strokeStyle = p.accent; c.lineWidth = 0.035;
    c.beginPath(); c.moveTo(0.22, 0.5); c.lineTo(0.28, 0.3); c.lineTo(0.38, 0.22); c.stroke();
    c.fillStyle = p.accent;
    c.beginPath(); c.moveTo(0.33, 0.17); c.lineTo(0.46, 0.2); c.lineTo(0.42, 0.3); c.closePath(); c.fill();
    // the chair pushed in: its back over the desk's edge, the seat under it, the legs
    c.fillStyle = p.accent2;
    rrect(c, 0.3, 0.32, 0.2, 0.15, 0.03); c.fill();
    c.strokeStyle = p.accent2; c.lineWidth = 0.035;
    c.beginPath(); c.moveTo(0.33, 0.47); c.lineTo(0.33, 0.5); c.moveTo(0.47, 0.47); c.lineTo(0.47, 0.5); c.stroke();
    c.fillRect(0.28, 0.66, 0.26, 0.04);
    c.beginPath(); c.moveTo(0.31, 0.7); c.lineTo(0.31, 0.92); c.moveTo(0.51, 0.7); c.lineTo(0.51, 0.92); c.stroke();
  },
  scale(c, p) {
    c.fillStyle = p.fill2;
    rrect(c, 0.14, 0.26, 0.72, 0.62, 0.14); c.fill();
    c.fillStyle = p.accent2;
    rrect(c, 0.2, 0.32, 0.6, 0.5, 0.1); c.fill();
    c.fillStyle = p.accent;
    rrect(c, 0.36, 0.38, 0.28, 0.14, 0.04); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.02;
    c.beginPath(); c.moveTo(0.5, 0.4); c.lineTo(0.54, 0.5); c.stroke();
    c.fillStyle = p.fill;
    for (const x of [0.32, 0.6]) { c.beginPath(); c.ellipse(x + 0.04, 0.68, 0.07, 0.1, 0, 0, TAU); c.fill(); }
  },
  heart(c, p) {
    // a heart in two halves, a crack between them — and a small light where they meet
    const half = (side: number): void => {
      c.beginPath();
      c.moveTo(0.5, 0.86);
      if (side < 0) {
        c.bezierCurveTo(0.12, 0.62, 0.06, 0.3, 0.3, 0.22);
        c.bezierCurveTo(0.42, 0.18, 0.48, 0.26, 0.5, 0.32);
        c.lineTo(0.45, 0.45); c.lineTo(0.53, 0.56); c.lineTo(0.46, 0.68);
      } else {
        c.bezierCurveTo(0.88, 0.62, 0.94, 0.3, 0.7, 0.22);
        c.bezierCurveTo(0.58, 0.18, 0.52, 0.26, 0.5, 0.32);
        c.lineTo(0.45, 0.45); c.lineTo(0.53, 0.56); c.lineTo(0.46, 0.68);
      }
      c.closePath();
      c.fill();
    };
    c.fillStyle = p.accent;
    c.save(); c.translate(-0.025, 0.01); half(-1); c.restore();
    c.save(); c.translate(0.025, 0); half(1); c.restore();
    c.fillStyle = p.accent2;
    c.globalAlpha = 0.6;
    c.beginPath(); c.ellipse(0.32, 0.36, 0.06, 0.04, -0.6, 0, TAU); c.fill();
    c.globalAlpha = 1;
  },
  door(c, p) {
    c.fillStyle = p.fill2;
    c.fillRect(0.12, 0.06, 0.76, 0.9);
    c.fillStyle = p.accent;
    c.beginPath(); c.moveTo(0.26, 0.94); c.lineTo(0.26, 0.34); c.arc(0.5, 0.34, 0.24, Math.PI, 0); c.lineTo(0.74, 0.94); c.closePath(); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.02;
    c.beginPath(); c.moveTo(0.5, 0.12); c.lineTo(0.5, 0.94); c.stroke();
    for (const x of [0.32, 0.56]) { c.strokeRect(x, 0.42, 0.12, 0.2); c.strokeRect(x, 0.68, 0.12, 0.2); }
    c.fillStyle = p.accent2;
    circle(c, 0.44, 0.64, 0.03); c.fill();
    c.fillStyle = p.fill;
    c.fillRect(0.08, 0.92, 0.84, 0.06);
  },
  seed(c, p, t) {
    c.fillStyle = p.accent2;
    c.beginPath(); c.ellipse(0.5, 0.86, 0.42, 0.12, 0, 0, TAU); c.fill();
    c.fillStyle = mixHex(p.accent2, p.ink, 0.25);
    c.beginPath(); c.ellipse(0.5, 0.8, 0.1, 0.06, -0.3, 0, TAU); c.fill();
    const sw = 0.02 * Math.sin(t * 0.9);
    c.strokeStyle = p.accent; c.lineWidth = 0.035;
    c.beginPath(); c.moveTo(0.5, 0.78); c.quadraticCurveTo(0.47, 0.6, 0.5 + sw, 0.44); c.stroke();
    c.fillStyle = p.accent;
    c.save(); c.translate(0.5 + sw, 0.46);
    c.beginPath(); c.ellipse(-0.1, -0.04, 0.12, 0.05, -0.5, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0.1, -0.06, 0.12, 0.05, 0.5, 0, TAU); c.fill();
    c.restore();
    c.fillStyle = p.light;
    c.globalAlpha = 0.6;
    circle(c, 0.62, 0.28, 0.03); c.fill();
    c.globalAlpha = 1;
  },
  hand(c, p) {
    // an open hand, palm up, a small light resting in it
    c.fillStyle = p.accent;
    c.beginPath();
    c.moveTo(0.1, 0.62);
    c.quadraticCurveTo(0.2, 0.56, 0.32, 0.6);
    c.lineTo(0.78, 0.56);
    c.quadraticCurveTo(0.86, 0.56, 0.86, 0.61);
    c.quadraticCurveTo(0.86, 0.65, 0.78, 0.66);
    c.lineTo(0.62, 0.67);
    c.lineTo(0.84, 0.7); c.quadraticCurveTo(0.9, 0.72, 0.86, 0.76); c.lineTo(0.62, 0.76);
    c.lineTo(0.8, 0.8); c.quadraticCurveTo(0.84, 0.83, 0.8, 0.86); c.lineTo(0.58, 0.85);
    c.quadraticCurveTo(0.4, 0.9, 0.3, 0.84);
    c.quadraticCurveTo(0.18, 0.8, 0.1, 0.8);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(0.4, 0.6); c.quadraticCurveTo(0.5, 0.44, 0.6, 0.47); c.quadraticCurveTo(0.64, 0.5, 0.58, 0.55); c.lineTo(0.5, 0.6); c.fill();
    c.strokeStyle = mixHex(p.accent, p.ink, 0.3); c.lineWidth = 0.015;
    c.beginPath(); c.moveTo(0.62, 0.67); c.lineTo(0.5, 0.68); c.moveTo(0.62, 0.76); c.lineTo(0.5, 0.76); c.stroke();
    c.fillStyle = p.accent2;
    c.globalAlpha = 0.35;
    circle(c, 0.56, 0.42, 0.14); c.fill();
    c.globalAlpha = 1;
    circle(c, 0.56, 0.42, 0.06); c.fill();
  },
  // ── round 25: the life motifs (life.ts LIFE_MOTIFS) ──
  tap(c, p, t) {
    // a tap over a basin, a drop forming and falling
    c.fillStyle = p.fill2;
    c.beginPath(); c.ellipse(0.5, 0.84, 0.36, 0.08, 0, 0, TAU); c.fill();
    c.fillStyle = p.accent2;
    c.beginPath(); c.ellipse(0.5, 0.82, 0.28, 0.05, 0, 0, TAU); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.07;
    c.beginPath(); c.moveTo(0.26, 0.74); c.lineTo(0.26, 0.4); c.quadraticCurveTo(0.26, 0.22, 0.46, 0.22); c.lineTo(0.56, 0.22); c.lineTo(0.56, 0.32); c.stroke();
    c.fillStyle = p.fill;
    rrect(c, 0.16, 0.34, 0.2, 0.06, 0.02); c.fill();
    const f = (t * 0.7) % 1;
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(0.56, 0.38 + f * 0.36, 0.035, 0.05, 0, 0, TAU); c.fill();
    c.fillStyle = p.light;
    circle(c, 0.545, 0.37 + f * 0.36, 0.01); c.fill();
  },
  shower(c, p, t) {
    c.strokeStyle = p.ink; c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(0.84, 0.08); c.lineTo(0.84, 0.2); c.quadraticCurveTo(0.84, 0.26, 0.62, 0.26); c.stroke();
    c.fillStyle = p.fill;
    c.beginPath(); c.moveTo(0.36, 0.34); c.quadraticCurveTo(0.5, 0.2, 0.66, 0.34); c.closePath(); c.fill();
    c.strokeStyle = p.accent; c.lineWidth = 0.025;
    for (let i = 0; i < 6; i++) {
      const x = 0.38 + i * 0.054, f = (t * 1.2 + i * 0.29) % 1;
      c.globalAlpha = 1 - f * 0.5;
      c.beginPath(); c.moveTo(x + (x - 0.51) * f * 0.4, 0.4 + f * 0.44); c.lineTo(x + (x - 0.51) * (f + 0.1) * 0.4, 0.48 + f * 0.44); c.stroke();
    }
    c.globalAlpha = 1;
  },
  bread(c, p) {
    c.fillStyle = p.fill2;
    c.beginPath(); c.ellipse(0.5, 0.82, 0.42, 0.07, 0, 0, TAU); c.fill();
    c.fillStyle = p.accent;
    c.beginPath(); c.moveTo(0.12, 0.8); c.bezierCurveTo(0.1, 0.46, 0.3, 0.32, 0.5, 0.32); c.bezierCurveTo(0.7, 0.32, 0.9, 0.46, 0.88, 0.8); c.closePath(); c.fill();
    c.strokeStyle = p.accent2; c.lineWidth = 0.04;
    for (let i = 0; i < 3; i++) { const x = 0.3 + i * 0.18; c.beginPath(); c.moveTo(x - 0.05, 0.5); c.quadraticCurveTo(x + 0.02, 0.42, x + 0.08, 0.48); c.stroke(); }
    c.fillStyle = p.light; c.globalAlpha = 0.5;
    c.beginPath(); c.ellipse(0.34, 0.46, 0.08, 0.04, -0.5, 0, TAU); c.fill();
    c.globalAlpha = 1;
  },
  apple(c, p) {
    c.fillStyle = p.accent;
    c.beginPath(); c.moveTo(0.5, 0.34); c.bezierCurveTo(0.28, 0.24, 0.12, 0.44, 0.18, 0.64); c.bezierCurveTo(0.24, 0.86, 0.4, 0.9, 0.5, 0.84); c.bezierCurveTo(0.6, 0.9, 0.76, 0.86, 0.82, 0.64); c.bezierCurveTo(0.88, 0.44, 0.72, 0.24, 0.5, 0.34); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(0.5, 0.36); c.quadraticCurveTo(0.5, 0.24, 0.55, 0.18); c.stroke();
    c.fillStyle = p.accent2;
    c.beginPath(); c.moveTo(0.54, 0.26); c.quadraticCurveTo(0.64, 0.12, 0.78, 0.18); c.quadraticCurveTo(0.68, 0.3, 0.54, 0.26); c.fill();
    c.fillStyle = p.light; c.globalAlpha = 0.7;
    c.beginPath(); c.ellipse(0.32, 0.5, 0.04, 0.08, 0.5, 0, TAU); c.fill();
    c.globalAlpha = 1;
  },
  tea(c, p, t) {
    c.fillStyle = p.fill2;
    c.beginPath(); c.ellipse(0.5, 0.82, 0.34, 0.07, 0, 0, TAU); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.moveTo(0.24, 0.44); c.lineTo(0.76, 0.44); c.bezierCurveTo(0.76, 0.7, 0.66, 0.8, 0.5, 0.8); c.bezierCurveTo(0.34, 0.8, 0.24, 0.7, 0.24, 0.44); c.fill();
    c.strokeStyle = p.light; c.lineWidth = 0.05;
    c.beginPath(); c.ellipse(0.8, 0.58, 0.07, 0.08, 0, -1.3, 1.5); c.stroke();
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(0.5, 0.45, 0.25, 0.05, 0, 0, TAU); c.fill();
    // the tea bag's string and tag
    c.strokeStyle = p.ink; c.lineWidth = 0.012;
    c.beginPath(); c.moveTo(0.62, 0.45); c.quadraticCurveTo(0.74, 0.5, 0.8, 0.66); c.stroke();
    c.fillStyle = p.accent2;
    c.fillRect(0.76, 0.66, 0.1, 0.1);
    c.strokeStyle = p.light; c.lineWidth = 0.025;
    for (let i = 0; i < 2; i++) {
      const ph = t * 1.1 + i * 2.4, x = 0.42 + i * 0.14, rise = (t * 0.08 + i * 0.17) % 0.1;
      c.globalAlpha = 0.8;
      c.beginPath(); c.moveTo(x, 0.38 - rise); c.bezierCurveTo(x - 0.05 + 0.02 * Math.sin(ph), 0.3 - rise, x + 0.05, 0.24 - rise, x, 0.15 - rise); c.stroke();
    }
    c.globalAlpha = 1;
  },
  flower(c, p) {
    c.strokeStyle = p.accent2 === p.accent ? p.ink : mixHex(p.ink, '#4f8a44', 0.5); c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(0.5, 0.92); c.quadraticCurveTo(0.46, 0.66, 0.5, 0.42); c.stroke();
    c.fillStyle = mixHex(p.fill, '#6aa04a', 0.5);
    c.beginPath(); c.ellipse(0.38, 0.72, 0.1, 0.035, -0.6, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0.62, 0.66, 0.1, 0.035, 0.6, 0, TAU); c.fill();
    c.fillStyle = p.accent;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.ellipse(0.5 + Math.cos(a) * 0.12, 0.34 + Math.sin(a) * 0.12, 0.1, 0.05, a, 0, TAU); c.fill(); }
    c.fillStyle = p.accent2;
    circle(c, 0.5, 0.34, 0.07); c.fill();
  },
  grass(c, p, t) {
    c.fillStyle = p.fill2;
    c.fillRect(0, 0.82, 1, 0.18);
    for (let i = 0; i < 14; i++) {
      const x = 0.06 + i * 0.065, h = 0.3 + 0.25 * ((i * 7) % 5) / 5, sw = Math.sin(t * 1.2 + i) * 0.02;
      c.fillStyle = i % 2 ? p.accent : p.accent2;
      c.beginPath(); c.moveTo(x - 0.025, 0.86); c.quadraticCurveTo(x + sw, 0.86 - h * 0.6, x + 0.02 + sw * 2, 0.86 - h); c.quadraticCurveTo(x + 0.01, 0.86 - h * 0.5, x + 0.025, 0.86); c.fill();
    }
    c.fillStyle = p.light;
    for (const [x, y] of [[0.3, 0.6], [0.62, 0.52], [0.8, 0.66]] as const) { circle(c, x, y, 0.018); c.fill(); }
  },
  window(c, p) {
    c.fillStyle = p.fill2;
    c.fillRect(0.14, 0.12, 0.72, 0.72);
    c.fillStyle = mixHex(p.accent, p.light, 0.45);
    c.fillRect(0.2, 0.18, 0.6, 0.6);
    c.fillStyle = p.accent2;
    circle(c, 0.64, 0.34, 0.08); c.fill();
    c.fillStyle = p.fill;
    c.beginPath(); c.moveTo(0.2, 0.78); c.lineTo(0.2, 0.62); c.lineTo(0.36, 0.52); c.lineTo(0.5, 0.62); c.lineTo(0.64, 0.56); c.lineTo(0.8, 0.64); c.lineTo(0.8, 0.78); c.closePath(); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.035;
    c.strokeRect(0.17, 0.15, 0.66, 0.66);
    c.beginPath(); c.moveTo(0.5, 0.15); c.lineTo(0.5, 0.81); c.moveTo(0.17, 0.42); c.lineTo(0.83, 0.42); c.stroke();
    c.fillStyle = p.fill;
    c.fillRect(0.1, 0.84, 0.8, 0.05);
  },
  sky(c, p, t) {
    c.fillStyle = mixHex(p.accent, p.light, 0.35);
    c.fillRect(0, 0, 1, 1);
    const dx = Math.sin(t * 0.3) * 0.03;
    c.fillStyle = p.light;
    for (const [x, y, r] of [[0.3, 0.5, 0.13], [0.46, 0.42, 0.17], [0.62, 0.5, 0.13], [0.46, 0.55, 0.14]] as const) { circle(c, x + dx, y, r); c.fill(); }
    c.fillStyle = p.accent2;
    for (const [x, y, r] of [[0.7, 0.24, 0.07], [0.8, 0.27, 0.09], [0.9, 0.24, 0.06]] as const) { circle(c, x - dx, y, r); c.fill(); }
    c.strokeStyle = p.ink; c.lineWidth = 0.015;
    c.beginPath(); c.moveTo(0.16, 0.22); c.quadraticCurveTo(0.2, 0.19, 0.24, 0.22); c.quadraticCurveTo(0.28, 0.19, 0.32, 0.22); c.stroke();
  },
  music(c, p, t) {
    c.strokeStyle = p.accent; c.lineWidth = 0.06;
    c.beginPath(); c.moveTo(0.22, 0.66); c.bezierCurveTo(0.18, 0.16, 0.82, 0.16, 0.78, 0.66); c.stroke();
    c.fillStyle = p.accent;
    for (const x of [0.22, 0.78]) { c.beginPath(); c.ellipse(x, 0.7, 0.1, 0.14, 0, 0, TAU); c.fill(); }
    c.fillStyle = p.accent2;
    for (const x of [0.22, 0.78]) { c.beginPath(); c.ellipse(x, 0.7, 0.055, 0.09, 0, 0, TAU); c.fill(); }
    const b = Math.sin(t * 2) * 0.02;
    c.fillStyle = p.ink;
    circle(c, 0.44, 0.58 + b, 0.04); c.fill();
    circle(c, 0.58, 0.54 - b, 0.04); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.02;
    c.beginPath(); c.moveTo(0.475, 0.58 + b); c.lineTo(0.475, 0.4 + b); c.lineTo(0.615, 0.36 - b); c.lineTo(0.615, 0.54 - b); c.stroke();
  },
  kettle(c, p, t) {
    c.fillStyle = p.accent;
    c.beginPath(); c.moveTo(0.22, 0.86); c.bezierCurveTo(0.14, 0.6, 0.28, 0.42, 0.5, 0.42); c.bezierCurveTo(0.72, 0.42, 0.86, 0.6, 0.78, 0.86); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.22, 0.64); c.quadraticCurveTo(0.12, 0.58, 0.07, 0.44); c.lineTo(0.12, 0.42); c.quadraticCurveTo(0.18, 0.54, 0.26, 0.58); c.closePath(); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.035;
    c.beginPath(); c.moveTo(0.32, 0.46); c.bezierCurveTo(0.32, 0.2, 0.68, 0.2, 0.68, 0.46); c.stroke();
    c.fillStyle = p.accent2;
    circle(c, 0.5, 0.4, 0.04); c.fill();
    c.fillStyle = p.light; c.globalAlpha = 0.6;
    c.beginPath(); c.ellipse(0.34, 0.62, 0.03, 0.1, 0.2, 0, TAU); c.fill();
    c.globalAlpha = 0.7;
    for (let i = 0; i < 3; i++) { const f = (t * 0.5 + i / 3) % 1; circle(c, 0.08 - f * 0.08, 0.38 - f * 0.26, 0.02 + f * 0.04); c.fill(); }
    c.globalAlpha = 1;
  },
  sweater(c, p) {
    c.fillStyle = p.accent;
    c.beginPath();
    c.moveTo(0.36, 0.16); c.quadraticCurveTo(0.5, 0.24, 0.64, 0.16); c.lineTo(0.9, 0.3); c.lineTo(0.94, 0.62); c.lineTo(0.8, 0.64); c.lineTo(0.76, 0.42);
    c.lineTo(0.76, 0.88); c.lineTo(0.24, 0.88); c.lineTo(0.24, 0.42); c.lineTo(0.2, 0.64); c.lineTo(0.06, 0.62); c.lineTo(0.1, 0.3); c.closePath(); c.fill();
    c.strokeStyle = p.accent2; c.lineWidth = 0.02;
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { const x = 0.32 + q * 0.12, y = 0.42 + r * 0.1; c.beginPath(); c.moveTo(x - 0.03, y); c.lineTo(x, y + 0.03); c.lineTo(x + 0.03, y); c.stroke(); }
    c.fillStyle = mixHex(p.accent, p.ink, 0.25);
    c.fillRect(0.24, 0.83, 0.52, 0.05);
  },
  feet(c, p) {
    // two footprints walking up the stamp
    c.fillStyle = p.accent;
    const foot = (x: number, y: number, s: number, a: number) => {
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); c.ellipse(0, 0, 0.07 * s, 0.13 * s, 0, 0, TAU); c.fill();
      for (let i = 0; i < 5; i++) { circle(c, (-0.05 + i * 0.025) * s, (-0.17 + Math.abs(i - 1.5) * 0.012) * s, (0.022 - i * 0.002) * s); c.fill(); }
      c.restore();
    };
    foot(0.36, 0.72, 1, -0.15);
    foot(0.62, 0.42, 1, 0.1);
    c.fillStyle = p.accent2; c.globalAlpha = 0.5;
    circle(c, 0.36, 0.72, 0.03); c.fill();
    c.globalAlpha = 1;
  },
  eyes(c, p, t) {
    c.fillStyle = p.light;
    c.beginPath(); c.moveTo(0.08, 0.5); c.bezierCurveTo(0.3, 0.2, 0.7, 0.2, 0.92, 0.5); c.bezierCurveTo(0.7, 0.8, 0.3, 0.8, 0.08, 0.5); c.fill();
    c.fillStyle = p.accent2;
    circle(c, 0.5, 0.5, 0.17); c.fill();
    c.fillStyle = p.accent;
    circle(c, 0.5, 0.5, 0.11); c.fill();
    c.fillStyle = p.ink;
    circle(c, 0.5, 0.5, 0.06); c.fill();
    c.fillStyle = '#ffffff';
    circle(c, 0.46 + Math.sin(t * 0.5) * 0.005, 0.45, 0.025); c.fill();
    c.strokeStyle = p.ink; c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(0.08, 0.5); c.bezierCurveTo(0.3, 0.2, 0.7, 0.2, 0.92, 0.5); c.stroke();
    c.lineWidth = 0.018;
    for (let i = 1; i < 6; i++) { const u = i / 6, x = 0.08 + u * 0.84, y = 0.5 - 0.29 * Math.sin(u * Math.PI); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (u - 0.5) * 0.08, y - 0.07); c.stroke(); }
  },
  bed(c, p) {
    c.fillStyle = p.fill;
    c.fillRect(0.08, 0.3, 0.08, 0.6);
    c.fillStyle = p.accent;
    rrect(c, 0.14, 0.52, 0.8, 0.26, 0.05); c.fill();
    c.fillStyle = p.accent2;
    rrect(c, 0.18, 0.42, 0.24, 0.14, 0.06); c.fill();
    c.fillStyle = mixHex(p.accent, p.light, 0.3);
    c.beginPath(); c.moveTo(0.4, 0.52); c.quadraticCurveTo(0.6, 0.46, 0.94, 0.52); c.lineTo(0.94, 0.62); c.lineTo(0.4, 0.62); c.closePath(); c.fill();
    c.fillStyle = p.ink;
    c.fillRect(0.14, 0.78, 0.06, 0.12); c.fillRect(0.86, 0.78, 0.06, 0.12);
    c.fillStyle = p.accent2;
    for (const [x, y] of [[0.7, 0.2], [0.82, 0.14], [0.86, 0.28]] as const) { circle(c, x, y, 0.02); c.fill(); }
  },
  switch(c, p, t) {
    c.strokeStyle = p.ink; c.lineWidth = 0.012;
    c.beginPath(); c.moveTo(0.5, 0); c.lineTo(0.5, 0.18); c.stroke();
    c.fillStyle = p.accent;
    c.globalAlpha = 0.3 + 0.1 * Math.sin(t * 2);
    circle(c, 0.5, 0.3, 0.17); c.fill();
    c.globalAlpha = 1;
    circle(c, 0.5, 0.3, 0.09); c.fill();
    c.fillStyle = p.ink;
    c.fillRect(0.46, 0.17, 0.08, 0.05);
    c.fillStyle = p.accent2;
    rrect(c, 0.34, 0.56, 0.32, 0.34, 0.04); c.fill();
    c.fillStyle = p.fill;
    rrect(c, 0.44, 0.62, 0.12, 0.22, 0.02); c.fill();
    c.fillStyle = p.light;
    c.fillRect(0.44, 0.62, 0.12, 0.1);
  },
  fridge(c, p) {
    c.fillStyle = p.accent2;
    rrect(c, 0.24, 0.06, 0.52, 0.88, 0.06); c.fill();
    c.strokeStyle = p.accent; c.lineWidth = 0.02;
    c.beginPath(); c.moveTo(0.24, 0.38); c.lineTo(0.76, 0.38); c.stroke();
    c.strokeStyle = p.ink; c.lineWidth = 0.035;
    c.beginPath(); c.moveTo(0.68, 0.16); c.lineTo(0.68, 0.3); c.moveTo(0.68, 0.46); c.lineTo(0.68, 0.64); c.stroke();
    c.fillStyle = p.accent;
    for (const [x, y, col] of [[0.36, 0.2, p.fill], [0.46, 0.26, p.accent], [0.4, 0.56, p.fill2]] as const) { c.fillStyle = col; circle(c, x, y, 0.035); c.fill(); }
    c.fillStyle = p.ink;
    c.fillRect(0.3, 0.94, 0.06, 0.03); c.fillRect(0.64, 0.94, 0.06, 0.03);
  },
  book(c, p) {
    c.fillStyle = p.accent;
    c.fillRect(0.08, 0.72, 0.84, 0.05);
    c.fillStyle = p.light;
    c.beginPath(); c.moveTo(0.5, 0.72); c.quadraticCurveTo(0.3, 0.66, 0.1, 0.7); c.lineTo(0.1, 0.3); c.quadraticCurveTo(0.3, 0.26, 0.5, 0.34); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.5, 0.72); c.quadraticCurveTo(0.7, 0.66, 0.9, 0.7); c.lineTo(0.9, 0.3); c.quadraticCurveTo(0.7, 0.26, 0.5, 0.34); c.closePath(); c.fill();
    c.strokeStyle = p.fill; c.lineWidth = 0.015;
    for (let i = 0; i < 5; i++) {
      const y = 0.38 + i * 0.06;
      c.beginPath(); c.moveTo(0.15, y); c.quadraticCurveTo(0.3, y - 0.02, 0.44, y + 0.02); c.stroke();
      c.beginPath(); c.moveTo(0.56, y + 0.02); c.quadraticCurveTo(0.7, y - 0.02, 0.85, y); c.stroke();
    }
    c.fillStyle = p.accent2;
    c.beginPath(); c.moveTo(0.6, 0.3); c.lineTo(0.64, 0.3); c.lineTo(0.64, 0.86); c.lineTo(0.62, 0.82); c.lineTo(0.6, 0.86); c.closePath(); c.fill();
  },
  pet(c, p, t) {
    // a cat sitting, its tail curling
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(0.5, 0.7, 0.2, 0.2, 0, 0, TAU); c.fill();
    circle(c, 0.5, 0.38, 0.14); c.fill();
    c.beginPath(); c.moveTo(0.38, 0.32); c.lineTo(0.38, 0.18); c.lineTo(0.47, 0.27); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.62, 0.32); c.lineTo(0.62, 0.18); c.lineTo(0.53, 0.27); c.closePath(); c.fill();
    c.strokeStyle = p.accent; c.lineWidth = 0.05;
    const sw = Math.sin(t * 1.1) * 0.04;
    c.beginPath(); c.moveTo(0.66, 0.82); c.quadraticCurveTo(0.9 + sw, 0.8, 0.84 + sw, 0.56); c.stroke();
    c.fillStyle = p.ink;
    c.beginPath(); c.ellipse(0.45, 0.38, 0.018, 0.026, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0.55, 0.38, 0.018, 0.026, 0, 0, TAU); c.fill();
    c.fillStyle = p.accent2;
    c.beginPath(); c.moveTo(0.48, 0.44); c.lineTo(0.52, 0.44); c.lineTo(0.5, 0.465); c.closePath(); c.fill();
    c.fillStyle = p.light; c.globalAlpha = 0.5;
    c.beginPath(); c.ellipse(0.5, 0.74, 0.1, 0.12, 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
  },
  rainbow(c, p, t) {
    const cols = ['#ff6a5a', '#ffa848', '#ffe060', '#7ad070', '#5aa8f0', '#8a78e0'];
    const k = p.accent === OWN.rainbow[0] ? 1 : 0;
    cols.forEach((col, i) => {
      c.strokeStyle = k ? col : mixHex(p.fill, p.light, i / 6);
      c.lineWidth = 0.05;
      c.beginPath(); c.arc(0.5, 0.78, 0.4 - i * 0.05, Math.PI, TAU); c.stroke();
    });
    c.fillStyle = p.light;
    for (const [x, r] of [[0.14, 0.09], [0.24, 0.07], [0.8, 0.09], [0.9, 0.07]] as const) { circle(c, x, 0.8, r); c.fill(); }
    c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2);
    c.fillStyle = '#ffffff';
    circle(c, 0.3, 0.42, 0.015); c.fill();
    c.globalAlpha = 1;
  },
};

/** The trust card's small flame (a candle's), in the unit square: a soft halo, the flame, its bright heart. */
export function drawFlame(c: Ctx, x: number, y: number, s: number, t: number, k = 1): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const fl = 1 + 0.05 * Math.sin(t * 7) + 0.03 * Math.sin(t * 11.3);
  const g = c.createRadialGradient(0.5, 0.42, 0, 0.5, 0.42, 0.45);
  g.addColorStop(0, `rgba(255,214,140,${0.5 * k})`);
  g.addColorStop(1, 'rgba(255,190,110,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 1, 1);
  // the candle
  c.fillStyle = '#f4ead8';
  c.fillRect(0.42, 0.6, 0.16, 0.34);
  c.fillStyle = '#e0d2b8';
  c.fillRect(0.52, 0.6, 0.06, 0.34);
  c.strokeStyle = '#3a2a20'; c.lineWidth = 0.015;
  c.beginPath(); c.moveTo(0.5, 0.6); c.lineTo(0.5, 0.55); c.stroke();
  c.save();
  c.translate(0.5, 0.56);
  c.scale(1, fl);
  c.fillStyle = '#ffb44a';
  c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-0.09, -0.05, -0.05, -0.18, 0, -0.27); c.bezierCurveTo(0.05, -0.18, 0.09, -0.05, 0, 0); c.fill();
  c.fillStyle = '#fff2c8';
  c.beginPath(); c.moveTo(0, -0.01); c.bezierCurveTo(-0.045, -0.04, -0.025, -0.12, 0, -0.17); c.bezierCurveTo(0.025, -0.12, 0.045, -0.04, 0, -0.01); c.fill();
  c.restore();
  c.restore();
}
