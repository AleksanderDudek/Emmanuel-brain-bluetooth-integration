/**
 * Złota passa's twenty motifs (DESIGN.md §26, builder B): one small, clear picture per `Motif` of moments.ts, drawn in
 * code in a unit square (0..1, y down) with a palette — the grey side's quiet greys or the gold side's warm colours.
 * `t` is the time for a small life in the picture (steam rising, rain falling, the green light breathing); 0 keeps it
 * still (reduced motion).
 */
import type { Motif } from './moments';
import { TAU, desat, mixHex } from './paint';

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
const OWN: Readonly<Record<Motif, [string, string]>> = {
  cup: ['#7a4a2a', '#f6efe4'], light: ['#3ad07a', '#ffb43a'], car: ['#d8574a', '#5a8ac8'], rain: ['#5a8ac8', '#9ac4ee'],
  queue: ['#d8784a', '#5a8a6a'], clock: ['#d8574a', '#f6efe4'], spill: ['#7a4a2a', '#f6efe4'], phone: ['#4a8ad8', '#f6efe4'],
  smile: ['#f2b0a0', '#e8785a'], sun: ['#ffb43a', '#ffe08a'], bird: ['#d8784a', '#6aa25a'], letter: ['#d8574a', '#f6efe4'],
  bus: ['#e8b43a', '#4a6a8a'], clinic: ['#3aa07a', '#f6efe4'], desk: ['#a8743a', '#5a8a6a'], scale: ['#5a9ac8', '#f6efe4'],
  heart: ['#e0607a', '#ffb0b8'], door: ['#8a5a3a', '#e8b43a'], seed: ['#6aa25a', '#8a5a3a'], hand: ['#e8b48a', '#ffe08a'],
};

/** The palettes: the grey side (`heavy`: deeper) and the gold side for a motif. */
export function greyPal(heavy: boolean): MotifPal {
  return heavy
    ? { ink: '#20242e', fill: '#6c7286', fill2: '#868ca0', light: '#b4b8c6', accent: '#7a8094', accent2: '#9ca0b0', bg: '#4a5064' }
    : { ink: '#4a4e58', fill: '#9aa0aa', fill2: '#b6bbc4', light: '#e2e4ea', accent: '#80868f', accent2: '#c4c8d0', bg: '#cdd1d8' };
}

export function goldPal(m: Motif, heavy: boolean): MotifPal {
  const [a, b] = OWN[m];
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
export function drawMotif(c: Ctx, m: Motif, x: number, y: number, s: number, p: MotifPal, t = 0): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const fn = MOTIF_DRAW[m] ?? MOTIF_DRAW.sun;
  fn(c, p, t);
  c.restore();
}

/** One drawing per motif (every one of moments.ts MOTIFS — the test checks it). */
export const MOTIF_DRAW: Readonly<Record<Motif, (c: Ctx, p: MotifPal, t: number) => void>> = {
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
