/**
 * Złota passa's things (DESIGN.md §29, the film — builder P2): the moment's thing painted with care, for the close-up
 * a sense or a given moment pushes in to (closeup.ts) and for the places that show it where it is (places-*.ts).
 *
 * Two kinds:
 *   objects   a thing on a surface, painted in a unit square (0..1, y down, standing on y ≈ 0.94, centred): the cup
 *             with its steam, the bread's crust, an apple, a kettle, the tap and warm water on hands, a shower, a
 *             vase of flowers, headphones, a folded sweater, a switch and its bulb, the open fridge, an open book, a
 *             cat asleep, a phone with a dear voice, a pillow, a bird on a branch, a seedling, an open hand…
 *   views     a thing that fills the frame (painted into any rectangle): the sky, the sun, rain on a window, a
 *             rainbow, light through a window, grass with dew, eyes that see (the world seen through them), feet
 *             on the way
 *
 * Each has a still part (baked by the caller) and a small live part (`live`: steam rising, water running, drops,
 * motes in the light, a breath) whose `open` 0..1 (the sense moment's focus) brings out the detail; `t` 0 is still.
 */
import type { Motif } from './moments';
import { drawMotif, goldPal, type AnyMotif } from './motifs';
import { TAU, clamp01, glow, hash, mixHex, rgbHex, rgba } from './paint';
import { ell, poly, rect, rrect, shadow, tone, windowView, type Ctx, type Room } from './stage';

export type { AnyMotif };

type Still = (c: Ctx, R: Room) => void;
type Live = (c: Ctx, R: Room, t: number, open: number) => void;
type ViewPaint = (c: Ctx, R: Room, x: number, y: number, w: number, h: number) => void;
type ViewLive = (c: Ctx, R: Room, x: number, y: number, w: number, h: number, t: number, open: number) => void;

interface ObjectThing { kind: 'object'; still: Still; live?: Live }
interface ViewThing { kind: 'view'; still: ViewPaint; live?: ViewLive }
export type Thing = ObjectThing | ViewThing;

const lin = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [k, col] of stops) g.addColorStop(k, col);
  return g;
};
const rad = (c: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]): CanvasGradient => {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [k, col] of stops) g.addColorStop(k, col);
  return g;
};

/** Rising steam: soft curling wisps from (x, y), `n` of them, `open` makes it fuller. */
export function steam(c: Ctx, x: number, y: number, s: number, t: number, open: number, n = 3): void {
  if (t === 0) return;
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 3; j++) {
      const ph = (t * 0.32 + i * 0.33 + j * 0.31) % 1;
      const a = Math.sin(ph * Math.PI) * (0.18 + 0.32 * open);
      const px = x + (i - (n - 1) / 2) * s * 0.18 + Math.sin(t * 1.3 + i * 2 + ph * 5) * s * 0.06;
      const py = y - ph * s * 0.9;
      c.strokeStyle = rgba('#ffffff', a);
      c.lineWidth = s * (0.05 + 0.06 * ph);
      c.beginPath();
      c.moveTo(px, py);
      c.bezierCurveTo(px - s * 0.06, py - s * 0.08, px + s * 0.08, py - s * 0.14, px + Math.sin(t + i) * s * 0.03, py - s * 0.22);
      c.stroke();
    }
  }
  c.restore();
}

/** Motes of dust drifting in a beam of light (rect), brighter with `open`. */
export function motes(c: Ctx, x: number, y: number, w: number, h: number, t: number, open: number, n = 14): void {
  if (t === 0) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const px = x + w * ((hash(i * 3 + 1) + Math.sin(t * 0.07 + i) * 0.04 + 1) % 1);
    const py = y + h * ((hash(i * 7 + 2) + t * 0.012 * (0.5 + hash(i))) % 1);
    const tw = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 2.3);
    glow(c, '#fff2d0', px, py, Math.min(w, h) * (0.012 + 0.01 * hash(i + 5)), (0.25 + 0.55 * open) * tw);
  }
  c.restore();
}

// ── objects ───────────────────────────────────────────────────────

const cupStill = (coffee: boolean): Still => (c, R) => {
  shadow(c, 0.5, 0.9, 0.36, 0.06, 0.3);
  // the saucer
  ell(c, 0.5, 0.88, 0.36, 0.075, lin(c, 0.14, 0, 0.86, 0, [[0, tone('#f4efe6', R, 0.7)], [1, tone('#c8c0b2', R)]]));
  ell(c, 0.5, 0.865, 0.27, 0.05, tone('#e6dfd2', R, 0.4));
  // the cup's body: glazed, a highlight down its left
  const body = lin(c, 0.22, 0, 0.78, 0, [[0, tone(coffee ? '#f6f1e8' : '#e9b8a0', R, 0.8)], [0.35, tone(coffee ? '#fffaf2' : '#f2c8b0', R, 0.9)], [1, tone(coffee ? '#c4bcae' : '#b87a62', R)]]);
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(0.24, 0.48);
  c.lineTo(0.76, 0.48);
  c.bezierCurveTo(0.76, 0.72, 0.68, 0.86, 0.5, 0.86);
  c.bezierCurveTo(0.32, 0.86, 0.24, 0.72, 0.24, 0.48);
  c.fill();
  // the handle
  c.strokeStyle = tone(coffee ? '#e6e0d4' : '#d49a80', R, 0.5);
  c.lineWidth = 0.05;
  c.beginPath();
  c.ellipse(0.8, 0.62, 0.075, 0.09, 0, -1.4, 1.6);
  c.stroke();
  // the rim and the drink: coffee with a little crema heart, or amber tea with a lemon slice
  ell(c, 0.5, 0.48, 0.26, 0.055, tone(coffee ? '#f8f4ec' : '#f6d4c0', R, 0.8));
  ell(c, 0.5, 0.485, 0.235, 0.044, coffee ? rad(c, 0.5, 0.485, 0.01, 0.24, [[0, tone('#c89058', R, 0.4)], [0.5, tone('#8a5530', R)], [1, tone('#4a2a18', R)]])
    : rad(c, 0.5, 0.485, 0.01, 0.24, [[0, tone('#f0b050', R, 0.5)], [1, tone('#a8581c', R)]]));
  if (coffee) {
    c.fillStyle = tone('#f2dcb8', R, 0.4);
    c.beginPath();
    c.moveTo(0.5, 0.5);
    c.bezierCurveTo(0.44, 0.48, 0.43, 0.465, 0.47, 0.462);
    c.bezierCurveTo(0.49, 0.462, 0.5, 0.47, 0.5, 0.475);
    c.bezierCurveTo(0.5, 0.47, 0.51, 0.462, 0.53, 0.462);
    c.bezierCurveTo(0.57, 0.465, 0.56, 0.48, 0.5, 0.5);
    c.fill();
  } else {
    ell(c, 0.58, 0.48, 0.06, 0.016, tone('#f4e070', R, 0.5));
    c.strokeStyle = tone('#fff6c0', R);
    c.lineWidth = 0.006;
    c.beginPath(); c.ellipse(0.58, 0.48, 0.045, 0.011, 0, 0, TAU); c.stroke();
  }
  // a glint on the glaze
  c.fillStyle = rgba('#ffffff', 0.55);
  c.beginPath();
  c.ellipse(0.33, 0.62, 0.02, 0.09, 0.15, 0, TAU);
  c.fill();
};

const cupLive: Live = (c, R, t, open) => {
  steam(c, 0.5, 0.44, 0.5, t, open, 3);
  void R;
};

const breadStill: Still = (c, R) => {
  // a wooden board, a round loaf with its scored crust, a few crumbs and a slice
  shadow(c, 0.5, 0.92, 0.46, 0.07, 0.32);
  c.fillStyle = lin(c, 0, 0.82, 0, 0.95, [[0, tone('#c89a68', R, 0.6)], [1, tone('#8a5e3a', R)]]);
  rrect(c, 0.04, 0.82, 0.92, 0.1, 0.04);
  c.fill();
  rect(c, 0.04, 0.82, 0.92, 0.012, rgba('#ffffff', 0.18));
  // the loaf
  c.fillStyle = rad(c, 0.42, 0.52, 0.04, 0.42, [[0, tone('#f0b866', R, 0.7)], [0.55, tone('#c8782e', R, 0.4)], [1, tone('#7a4218', R)]]);
  c.beginPath();
  c.moveTo(0.1, 0.82);
  c.bezierCurveTo(0.08, 0.5, 0.3, 0.34, 0.5, 0.34);
  c.bezierCurveTo(0.72, 0.34, 0.9, 0.5, 0.88, 0.82);
  c.closePath();
  c.fill();
  // the scoring: four long diagonal cuts across the crust, opened into pale crumb (an ear on each)
  for (let i = 0; i < 4; i++) {
    const x0 = 0.2 + i * 0.15, y0 = 0.66 - i * 0.02, x1 = x0 + 0.17, y1 = 0.42 - i * 0.015;
    c.fillStyle = tone('#f6dca8', R, 0.6);
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo((x0 + x1) / 2 + 0.03, (y0 + y1) / 2 + 0.02, x1, y1);
    c.quadraticCurveTo((x0 + x1) / 2 - 0.01, (y0 + y1) / 2 - 0.015, x0, y0);
    c.fill();
    c.strokeStyle = tone('#6a3412', R);
    c.lineWidth = 0.008;
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo((x0 + x1) / 2 - 0.01, (y0 + y1) / 2 - 0.015, x1, y1);
    c.stroke();
  }
  // flour dust on the crust
  c.fillStyle = rgba('#fff8ec', 0.5);
  for (let i = 0; i < 40; i++) {
    const a = hash(i * 3 + 2) * Math.PI, r = 0.3 + 0.08 * hash(i * 5);
    c.beginPath();
    c.arc(0.49 - Math.cos(a) * r, 0.78 - Math.sin(a) * r * 1.0, 0.004 + 0.004 * hash(i), 0, TAU);
    c.fill();
  }
  // a slice leaning in front: crumb and crust
  c.fillStyle = tone('#7a4218', R);
  c.beginPath();
  c.ellipse(0.82, 0.76, 0.13, 0.1, -0.2, 0, TAU);
  c.fill();
  c.fillStyle = rad(c, 0.82, 0.76, 0.01, 0.12, [[0, tone('#fbe8c4', R, 0.7)], [1, tone('#e8c88e', R, 0.4)]]);
  c.beginPath();
  c.ellipse(0.82, 0.76, 0.115, 0.086, -0.2, 0, TAU);
  c.fill();
  c.fillStyle = rgba('#b8925a', 0.5);
  for (let i = 0; i < 14; i++) c.fillRect(0.74 + 0.16 * hash(i + 40), 0.7 + 0.12 * hash(i + 60), 0.006, 0.006);
  for (let i = 0; i < 6; i++) ell(c, 0.2 + 0.6 * hash(i + 80), 0.86 + 0.03 * hash(i + 90), 0.006, 0.004, tone('#c88a48', R));
};

const breadLive: Live = (c, R, t, open) => {
  // the warmth still rising from a fresh loaf
  steam(c, 0.5, 0.36, 0.44, t, open * 0.7, 2);
  void R;
};

const appleStill: Still = (c, R) => {
  shadow(c, 0.5, 0.9, 0.3, 0.05, 0.32);
  c.fillStyle = rad(c, 0.4, 0.5, 0.03, 0.36, [[0, tone('#ff7a5a', R, 0.9)], [0.45, tone('#d8302a', R, 0.5)], [1, tone('#7a1418', R)]]);
  c.beginPath();
  c.moveTo(0.5, 0.36);
  c.bezierCurveTo(0.3, 0.26, 0.14, 0.44, 0.18, 0.62);
  c.bezierCurveTo(0.22, 0.84, 0.38, 0.92, 0.5, 0.86);
  c.bezierCurveTo(0.62, 0.92, 0.78, 0.84, 0.82, 0.62);
  c.bezierCurveTo(0.86, 0.44, 0.7, 0.26, 0.5, 0.36);
  c.fill();
  // the blush and the speckles
  c.fillStyle = rgba(tone('#ffd060', R, 0.6), 0.35);
  c.beginPath(); c.ellipse(0.66, 0.66, 0.1, 0.14, -0.4, 0, TAU); c.fill();
  c.fillStyle = rgba('#ffe8b0', 0.4);
  for (let i = 0; i < 26; i++) c.fillRect(0.24 + 0.52 * hash(i * 3), 0.42 + 0.4 * hash(i * 7 + 1), 0.005, 0.005);
  // the stalk and a leaf
  c.strokeStyle = tone('#5a3a1e', R);
  c.lineWidth = 0.022;
  c.beginPath(); c.moveTo(0.5, 0.38); c.quadraticCurveTo(0.5, 0.28, 0.54, 0.22); c.stroke();
  c.fillStyle = lin(c, 0.54, 0.22, 0.74, 0.2, [[0, tone('#6aa84a', R, 0.6)], [1, tone('#3a7a34', R)]]);
  c.beginPath();
  c.moveTo(0.54, 0.27);
  c.quadraticCurveTo(0.62, 0.16, 0.76, 0.2);
  c.quadraticCurveTo(0.68, 0.3, 0.54, 0.27);
  c.fill();
  // the gloss
  c.fillStyle = rgba('#ffffff', 0.6);
  c.beginPath(); c.ellipse(0.32, 0.5, 0.035, 0.07, 0.5, 0, TAU); c.fill();
  c.fillStyle = rgba('#ffffff', 0.25);
  c.beginPath(); c.ellipse(0.36, 0.58, 0.06, 0.12, 0.5, 0, TAU); c.fill();
};

const appleLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  // a drop of water sliding down the skin, a glint breathing
  const ph = (t * 0.12) % 1;
  const y = 0.44 + ph * 0.36, x = 0.7 - ph * 0.04;
  c.fillStyle = rgba('#ffffff', 0.55 * open * Math.sin(ph * Math.PI));
  c.beginPath(); c.ellipse(x, y, 0.014, 0.02, 0, 0, TAU); c.fill();
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffffff', 0.32, 0.5, 0.06, (0.25 + 0.35 * open) * (0.7 + 0.3 * Math.sin(t * 1.7)));
  c.restore();
  void R;
};

const kettleStill: Still = (c, R) => {
  shadow(c, 0.5, 0.92, 0.36, 0.06, 0.3);
  // an enamel kettle (warm red), its handle and spout, a wooden knob
  c.fillStyle = rad(c, 0.4, 0.6, 0.04, 0.42, [[0, tone('#ff8a6a', R, 0.8)], [0.55, tone('#d8463a', R, 0.4)], [1, tone('#7a1e1a', R)]]);
  c.beginPath();
  c.moveTo(0.22, 0.9);
  c.bezierCurveTo(0.14, 0.62, 0.28, 0.42, 0.5, 0.42);
  c.bezierCurveTo(0.72, 0.42, 0.86, 0.62, 0.78, 0.9);
  c.closePath();
  c.fill();
  // the spout
  c.fillStyle = tone('#c23a30', R, 0.3);
  c.beginPath();
  c.moveTo(0.22, 0.66); c.quadraticCurveTo(0.12, 0.6, 0.06, 0.44); c.lineTo(0.1, 0.42); c.quadraticCurveTo(0.18, 0.56, 0.26, 0.6);
  c.closePath();
  c.fill();
  // the lid and its knob
  ell(c, 0.5, 0.43, 0.17, 0.035, tone('#e85a48', R, 0.6));
  ell(c, 0.5, 0.39, 0.045, 0.03, tone('#8a5a32', R, 0.5));
  // the handle arching over
  c.strokeStyle = tone('#2a2420', R);
  c.lineWidth = 0.035;
  c.beginPath();
  c.moveTo(0.32, 0.46); c.bezierCurveTo(0.32, 0.18, 0.68, 0.18, 0.68, 0.46);
  c.stroke();
  // white enamel band and the shine
  c.fillStyle = rgba('#ffffff', 0.18);
  c.fillRect(0.2, 0.8, 0.6, 0.03);
  c.fillStyle = rgba('#ffffff', 0.5);
  c.beginPath(); c.ellipse(0.34, 0.62, 0.03, 0.12, 0.2, 0, TAU); c.fill();
};

const kettleLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  // a plume from the spout
  c.save();
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.5 + i / 6) % 1;
    c.fillStyle = rgba('#ffffff', (0.12 + 0.3 * open) * Math.sin(ph * Math.PI));
    c.beginPath();
    c.arc(0.06 - ph * 0.12 + Math.sin(t * 2 + i) * 0.02, 0.4 - ph * 0.3, 0.02 + ph * 0.07, 0, TAU);
    c.fill();
  }
  c.restore();
  void R;
};

const tapStill: Still = (c, R) => {
  // the sink's edge, the chrome tap arching over, two hands cupped under the water
  c.fillStyle = lin(c, 0, 0.72, 0, 1, [[0, tone('#f4f2ee', R, 0.6)], [1, tone('#c8ccd0', R)]]);
  rrect(c, -0.1, 0.74, 1.2, 0.3, 0.06);
  c.fill();
  ell(c, 0.5, 0.86, 0.42, 0.08, lin(c, 0, 0.8, 0, 0.94, [[0, tone('#9aa4ac', R)], [1, tone('#dfe4e8', R, 0.4)]]));
  // the tap
  const chrome = lin(c, 0.14, 0, 0.3, 0, [[0, tone('#e8eef2', R, 0.9)], [0.5, tone('#8a949c', R)], [1, tone('#f4f8fa', R, 0.8)]]);
  c.fillStyle = chrome;
  rrect(c, 0.14, 0.42, 0.12, 0.36, 0.03);
  c.fill();
  c.strokeStyle = chrome;
  c.lineWidth = 0.075;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0.2, 0.46); c.bezierCurveTo(0.2, 0.16, 0.5, 0.14, 0.52, 0.34);
  c.stroke();
  ell(c, 0.2, 0.38, 0.07, 0.025, tone('#dfe6ea', R, 0.7));
  // hands under it (soft, palms up)
  const skin = rad(c, 0.52, 0.66, 0.02, 0.3, [[0, tone('#f2c4a4', R, 0.8)], [1, tone('#c0866a', R)]]);
  c.fillStyle = skin;
  c.beginPath();
  c.moveTo(0.3, 0.74);
  c.bezierCurveTo(0.28, 0.62, 0.4, 0.58, 0.52, 0.6);
  c.bezierCurveTo(0.66, 0.58, 0.78, 0.62, 0.76, 0.74);
  c.bezierCurveTo(0.7, 0.8, 0.36, 0.8, 0.3, 0.74);
  c.fill();
  c.strokeStyle = rgba(tone('#9a6048', R), 0.5);
  c.lineWidth = 0.008;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(0.34 + i * 0.03, 0.7 - i * 0.01);
    c.quadraticCurveTo(0.4 + i * 0.03, 0.64, 0.48 + i * 0.01, 0.62 + i * 0.005);
    c.stroke();
  }
  c.fillStyle = rgba('#ffffff', 0.4);
  c.beginPath(); c.ellipse(0.6, 0.64, 0.08, 0.015, -0.1, 0, TAU); c.fill();
};

const tapLive: Live = (c, R, t, open) => {
  // the warm water running from the spout into the hands: a glassy stream, ripples, drops
  const k = 0.5 + 0.5 * open;
  const g = c.createLinearGradient(0.5, 0, 0.56, 0);
  g.addColorStop(0, rgba('#ffffff', 0.25 * k));
  g.addColorStop(0.5, rgba('#d8ecf6', 0.75 * k));
  g.addColorStop(1, rgba('#ffffff', 0.3 * k));
  c.fillStyle = g;
  const wob = t === 0 ? 0 : Math.sin(t * 9) * 0.004;
  c.beginPath();
  c.moveTo(0.5, 0.34); c.lineTo(0.545, 0.34); c.lineTo(0.55 + wob, 0.62); c.lineTo(0.5 - wob, 0.62);
  c.closePath();
  c.fill();
  if (t === 0) return;
  for (let i = 0; i < 6; i++) {
    const ph = (t * 1.6 + i / 6) % 1;
    c.fillStyle = rgba('#ffffff', 0.6 * (1 - ph) * k);
    const a = hash(i * 9) * Math.PI;
    c.beginPath();
    c.arc(0.525 + Math.cos(a) * ph * 0.16, 0.62 - Math.sin(a) * ph * 0.06 + ph * ph * 0.1, 0.008, 0, TAU);
    c.fill();
  }
  // a little steam: it is warm
  steam(c, 0.52, 0.6, 0.3, t, open * 0.6, 2);
  void R;
};

const showerStill: Still = (c, R) => {
  // tiles, the shower's round head on its arm
  c.strokeStyle = rgba('#ffffff', 0.25);
  c.lineWidth = 0.004;
  for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i / 8, 0); c.lineTo(i / 8, 1); c.stroke(); c.beginPath(); c.moveTo(0, i / 8); c.lineTo(1, i / 8); c.stroke(); }
  const chrome = lin(c, 0.6, 0, 0.9, 0, [[0, tone('#e8eef2', R, 0.9)], [0.5, tone('#8a949c', R)], [1, tone('#f4f8fa', R, 0.8)]]);
  c.strokeStyle = chrome;
  c.lineWidth = 0.04;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(0.92, 0.04); c.lineTo(0.92, 0.12); c.quadraticCurveTo(0.92, 0.18, 0.7, 0.18); c.stroke();
  c.fillStyle = chrome;
  c.beginPath(); c.ellipse(0.6, 0.22, 0.14, 0.05, 0, 0, TAU); c.fill();
  ell(c, 0.6, 0.24, 0.12, 0.035, tone('#9aa4ac', R));
};

const showerLive: Live = (c, R, t, open) => {
  // the spray: fine falling streaks and drops, mist below
  c.save();
  c.lineCap = 'round';
  const n = 26;
  for (let i = 0; i < n; i++) {
    const x0 = 0.5 + (hash(i * 3) - 0.5) * 0.2;
    const ang = (x0 - 0.6) * 0.9;
    const ph = t === 0 ? hash(i) : (t * 1.4 + hash(i * 5)) % 1;
    const y = 0.26 + ph * 0.7, x = x0 + 0.1 + ang * ph * 0.7;
    c.strokeStyle = rgba('#e8f4fa', (0.35 + 0.4 * open) * (1 - ph * 0.5));
    c.lineWidth = 0.006;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + ang * 0.05, y + 0.07); c.stroke();
  }
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffffff', 0.62, 0.92, 0.4, 0.12 + 0.12 * open, 0.4);
  c.restore();
  void R;
};

const flowerStill: Still = (c, R) => {
  shadow(c, 0.5, 0.92, 0.22, 0.04, 0.3);
  // a small glass vase, stems, and five blooms of a meadow
  c.fillStyle = lin(c, 0.4, 0, 0.6, 0, [[0, rgba('#e8f4f6', 0.55)], [0.5, rgba('#ffffff', 0.25)], [1, rgba('#b8d0d8', 0.6)]]);
  c.beginPath(); c.moveTo(0.4, 0.92); c.bezierCurveTo(0.34, 0.8, 0.42, 0.68, 0.44, 0.6); c.lineTo(0.56, 0.6); c.bezierCurveTo(0.58, 0.68, 0.66, 0.8, 0.6, 0.92); c.closePath(); c.fill();
  c.fillStyle = rgba(tone('#9ac8d8', R), 0.35);
  c.fillRect(0.4, 0.8, 0.2, 0.11);
  const blooms: [number, number, string, number][] = [[0.3, 0.3, '#f2a0b8', 0.09], [0.52, 0.2, '#ffd25a', 0.1], [0.72, 0.32, '#f0f0f6', 0.085], [0.42, 0.42, '#b89ae8', 0.07], [0.64, 0.46, '#ff9a6a', 0.07]];
  c.strokeStyle = tone('#4f8a44', R);
  c.lineWidth = 0.012;
  for (const [x, y] of blooms) { c.beginPath(); c.moveTo(0.5, 0.86); c.quadraticCurveTo(0.5 + (x - 0.5) * 0.3, 0.6, x, y); c.stroke(); }
  // leaves
  c.fillStyle = tone('#5f9a4a', R, 0.4);
  for (const [x, y, a] of [[0.38, 0.58, -0.7], [0.62, 0.54, 0.7]] as const) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.ellipse(0, 0, 0.08, 0.025, 0, 0, TAU); c.fill();
    c.restore();
  }
  for (const [x, y, col, r] of blooms) {
    const petals = 7;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU;
      c.fillStyle = tone(mixHex(col, i % 2 ? '#ffffff' : col, 0.15), R, 0.7);
      c.beginPath();
      c.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.28, a, 0, TAU);
      c.fill();
    }
    ell(c, x, y, r * 0.3, r * 0.3, rad(c, x - r * 0.1, y - r * 0.1, 0, r * 0.3, [[0, tone('#fff0a0', R, 0.6)], [1, tone('#d89a20', R)]]));
  }
};

const flowerLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  // a little pollen in the light, a petal's sway
  motes(c, 0.2, 0.1, 0.6, 0.4, t, open, 8);
  void R;
};

const musicStill: Still = (c, R) => {
  shadow(c, 0.5, 0.9, 0.38, 0.05, 0.28);
  // headphones resting: the band arching, two soft cups
  c.strokeStyle = lin(c, 0.2, 0, 0.8, 0, [[0, tone('#3a3a46', R, 0.3)], [0.5, tone('#6a6a7a', R, 0.6)], [1, tone('#2a2a34', R)]]);
  c.lineWidth = 0.06;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(0.24, 0.66); c.bezierCurveTo(0.2, 0.18, 0.8, 0.18, 0.76, 0.66); c.stroke();
  c.strokeStyle = tone('#c8a46a', R, 0.5);
  c.lineWidth = 0.012;
  c.beginPath(); c.moveTo(0.27, 0.6); c.bezierCurveTo(0.24, 0.24, 0.76, 0.24, 0.73, 0.6); c.stroke();
  for (const x of [0.24, 0.76]) {
    c.fillStyle = rad(c, x - 0.03, 0.7, 0.01, 0.16, [[0, tone('#6a6a7a', R, 0.6)], [1, tone('#1e1e26', R)]]);
    c.beginPath(); c.ellipse(x, 0.74, 0.12, 0.15, x < 0.5 ? 0.15 : -0.15, 0, TAU); c.fill();
    ell(c, x, 0.74, 0.07, 0.1, tone('#c8a46a', R, 0.4), x < 0.5 ? 0.15 : -0.15);
  }
};

const musicLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  // the song: soft notes and rings rising
  c.save();
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.22 + i / 4) % 1;
    const x = 0.5 + Math.sin(t * 0.8 + i * 1.9) * 0.18, y = 0.62 - ph * 0.55;
    const a = Math.sin(ph * Math.PI) * (0.35 + 0.55 * open);
    c.fillStyle = rgba(i % 2 ? '#ffd890' : '#fff2d0', a);
    c.strokeStyle = c.fillStyle;
    c.lineWidth = 0.008;
    c.beginPath(); c.ellipse(x, y, 0.022, 0.016, -0.4, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(x + 0.019, y - 0.004); c.lineTo(x + 0.019, y - 0.08); c.quadraticCurveTo(x + 0.04, y - 0.07, x + 0.05, y - 0.05); c.stroke();
  }
  c.strokeStyle = rgba('#ffe2a8', 0.2 * open);
  c.lineWidth = 0.006;
  for (let i = 0; i < 2; i++) {
    const r = 0.18 + ((t * 0.3 + i * 0.5) % 1) * 0.3;
    for (const x of [0.24, 0.76]) { c.beginPath(); c.arc(x, 0.74, r, -2.2, -0.9); c.stroke(); }
  }
  c.restore();
  void R;
};

const sweaterStill: Still = (c, R) => {
  shadow(c, 0.5, 0.9, 0.42, 0.05, 0.3);
  // a folded knit sweater: cables and ribbing
  const knit = '#c8543e';
  c.fillStyle = lin(c, 0, 0.42, 0, 0.9, [[0, tone(mixHex(knit, '#ffffff', 0.18), R, 0.7)], [1, tone(mixHex(knit, '#000000', 0.25), R)]]);
  rrect(c, 0.1, 0.42, 0.8, 0.48, 0.08);
  c.fill();
  // the folded sleeve and the collar
  c.fillStyle = tone(mixHex(knit, '#000000', 0.1), R, 0.4);
  rrect(c, 0.1, 0.42, 0.8, 0.12, 0.06);
  c.fill();
  c.fillStyle = tone(mixHex(knit, '#000000', 0.2), R, 0.3);
  c.beginPath(); c.ellipse(0.5, 0.44, 0.14, 0.04, 0, 0, Math.PI); c.fill();
  // cables: chains of little V stitches
  c.strokeStyle = rgba(tone(mixHex(knit, '#ffffff', 0.4), R, 0.6), 0.8);
  c.lineWidth = 0.01;
  for (let col = 0; col < 5; col++) {
    const x = 0.2 + col * 0.15;
    for (let r = 0; r < 6; r++) {
      const y = 0.58 + r * 0.05;
      c.beginPath(); c.moveTo(x - 0.03, y); c.lineTo(x, y + 0.03); c.lineTo(x + 0.03, y); c.stroke();
    }
  }
  // ribbing at the hem
  c.strokeStyle = rgba('#000000', 0.15);
  for (let i = 0; i < 26; i++) { const x = 0.13 + i * 0.03; c.beginPath(); c.moveTo(x, 0.84); c.lineTo(x, 0.9); c.stroke(); }
};

const sweaterLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffc890', 0.5, 0.66, 0.42, (0.1 + 0.2 * open) * (0.8 + 0.2 * Math.sin(t * 0.8)), 0.6);
  c.restore();
  void R;
};

const switchStill: Still = (c, R) => {
  // a bulb hanging on its cord over a switch on the wall (drawn larger round its middle)
  c.translate(0.5, 0.55);
  c.scale(1.45, 1.45);
  c.translate(-0.5, -0.55);
  c.strokeStyle = tone('#3a3430', R);
  c.lineWidth = 0.012;
  c.beginPath(); c.moveTo(0.5, 0); c.lineTo(0.5, 0.24); c.stroke();
  rect(c, 0.46, 0.22, 0.08, 0.06, tone('#3a3430', R));
  c.fillStyle = rgba('#fff8e4', 0.85);
  c.beginPath(); c.moveTo(0.46, 0.28); c.bezierCurveTo(0.38, 0.32, 0.38, 0.46, 0.5, 0.48); c.bezierCurveTo(0.62, 0.46, 0.62, 0.32, 0.54, 0.28); c.closePath(); c.fill();
  c.strokeStyle = tone('#c89a40', R);
  c.lineWidth = 0.006;
  c.beginPath(); c.moveTo(0.48, 0.3); c.lineTo(0.47, 0.38); c.lineTo(0.5, 0.36); c.lineTo(0.53, 0.38); c.lineTo(0.52, 0.3); c.stroke();
  // the switch plate
  shadow(c, 0.52, 0.78, 0.14, 0.14, 0.18);
  c.fillStyle = lin(c, 0.38, 0.62, 0.62, 0.9, [[0, tone('#ffffff', R, 0.5)], [1, tone('#d8d2c6', R)]]);
  rrect(c, 0.38, 0.62, 0.24, 0.26, 0.03);
  c.fill();
  c.fillStyle = tone('#ece6da', R, 0.4);
  rrect(c, 0.45, 0.67, 0.1, 0.16, 0.02);
  c.fill();
  rect(c, 0.45, 0.67, 0.1, 0.075, tone('#f8f4ec', R, 0.6));
};

const switchLive: Live = (c, R, t, open) => {
  const on = 0.6 + 0.4 * open;
  c.save();
  c.translate(0.5, 0.55);
  c.scale(1.45, 1.45);
  c.translate(-0.5, -0.55);
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffd890', 0.5, 0.39, 0.42, 0.5 * on);
  glow(c, '#fff6dc', 0.5, 0.39, 0.1, 0.9 * on);
  c.restore();
  void R; void t;
};

const fridgeStill: Still = (c, R) => {
  // the open fridge: its cool light, shelves with milk, a jar, fruit, greens; the door's shelf
  c.fillStyle = lin(c, 0, 0.04, 0, 0.96, [[0, tone('#f4f8fa', R, 0.6)], [1, tone('#c8d2d8', R)]]);
  rrect(c, 0.12, 0.04, 0.62, 0.92, 0.04);
  c.fill();
  c.fillStyle = rad(c, 0.43, 0.2, 0.02, 0.6, [[0, '#ffffff'], [1, '#d8ecf4']]);
  rrect(c, 0.16, 0.08, 0.54, 0.84, 0.03);
  c.fill();
  for (const y of [0.34, 0.56, 0.76]) rect(c, 0.16, y, 0.54, 0.012, rgba('#9ab8c8', 0.7));
  // the milk, a jar of jam, eggs, an apple, greens, a cheese
  rect(c, 0.22, 0.16, 0.1, 0.18, tone('#ffffff', R, 0.4));
  rect(c, 0.22, 0.14, 0.1, 0.04, tone('#4a8ad8', R));
  ell(c, 0.46, 0.3, 0.06, 0.04, tone('#c8302a', R, 0.4));
  rect(c, 0.4, 0.2, 0.08, 0.12, tone('#b8303a', R, 0.4));
  rect(c, 0.4, 0.19, 0.08, 0.03, tone('#f0e0c0', R));
  for (let i = 0; i < 4; i++) ell(c, 0.24 + i * 0.05, 0.52, 0.022, 0.03, tone('#f6ecd8', R, 0.4));
  ell(c, 0.56, 0.5, 0.05, 0.05, tone('#7ab84a', R, 0.5));
  poly(c, [0.42, 0.76, 0.6, 0.76, 0.56, 0.66], tone('#ffd25a', R, 0.4));
  for (let i = 0; i < 5; i++) ell(c, 0.24 + i * 0.03, 0.72, 0.03, 0.05, tone('#4f9a44', R, 0.4), (i - 2) * 0.3);
  // the door, open to the right with its shelf of bottles
  c.fillStyle = lin(c, 0.74, 0, 0.98, 0, [[0, tone('#dfe6ea', R, 0.3)], [1, tone('#f6f8fa', R, 0.6)]]);
  poly(c, [0.74, 0.04, 0.98, 0.0, 0.98, 1.0, 0.74, 0.96], c.fillStyle as CanvasGradient);
  for (let i = 0; i < 3; i++) rect(c, 0.79 + i * 0.06, 0.6, 0.04, 0.16, tone(['#7ac0e8', '#f0d070', '#e88a6a'][i], R, 0.4));
  rect(c, 0.76, 0.76, 0.2, 0.02, rgba('#9ab8c8', 0.8));
};

const fridgeLive: Live = (c, R, t, open) => {
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#e8f6ff', 0.43, 0.45, 0.5, (0.25 + 0.25 * open) * (t === 0 ? 1 : 0.95 + 0.05 * Math.sin(t * 3)));
  c.restore();
  void R;
};

const bookStill: Still = (c, R) => {
  shadow(c, 0.5, 0.9, 0.46, 0.06, 0.3);
  // an open book: two pages curving up from the spine, lines of text as soft strokes
  const page = (s: number) => {
    c.fillStyle = lin(c, 0.5, 0, 0.5 + s * 0.44, 0, [[0, tone('#d8ccb4', R)], [0.25, tone('#f8f2e4', R, 0.7)], [1, tone('#efe6d2', R, 0.5)]]);
    c.beginPath();
    c.moveTo(0.5, 0.86);
    c.quadraticCurveTo(0.5 + s * 0.2, 0.8, 0.5 + s * 0.45, 0.84);
    c.lineTo(0.5 + s * 0.44, 0.42);
    c.quadraticCurveTo(0.5 + s * 0.2, 0.36, 0.5, 0.44);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba('#6a5a48', 0.35);
    c.lineWidth = 0.008;
    for (let i = 0; i < 9; i++) {
      const y = 0.47 + i * 0.038;
      c.beginPath();
      c.moveTo(0.5 + s * 0.06, y + 0.005);
      c.quadraticCurveTo(0.5 + s * 0.2, y - 0.02, 0.5 + s * (0.38 - (i === 8 ? 0.15 : 0)), y);
      c.stroke();
    }
  };
  // the cover under it
  rect(c, 0.03, 0.84, 0.94, 0.04, tone('#5a3a6a', R, 0.3));
  page(-1);
  page(1);
  c.strokeStyle = rgba('#8a7a60', 0.4);
  c.lineWidth = 0.01;
  c.beginPath(); c.moveTo(0.5, 0.44); c.lineTo(0.5, 0.86); c.stroke();
  // a ribbon marker
  poly(c, [0.6, 0.4, 0.63, 0.4, 0.63, 0.94, 0.615, 0.91, 0.6, 0.94], tone('#c8302a', R, 0.4));
};

const bookLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  motes(c, 0.1, 0.1, 0.8, 0.4, t, open, 10);
  // a page lifting a little in a breath of air
  const lift = Math.max(0, Math.sin(t * 0.5)) ** 3 * 0.06;
  if (lift > 0.005) {
    c.fillStyle = rgba(tone('#fbf6ea', R, 0.7), 0.9);
    c.beginPath();
    c.moveTo(0.5, 0.86);
    c.quadraticCurveTo(0.7, 0.8 - lift, 0.93, 0.83 - lift * 2);
    c.lineTo(0.92, 0.42 - lift * 2);
    c.quadraticCurveTo(0.7, 0.36 - lift, 0.5, 0.44);
    c.closePath();
    c.fill();
  }
};

const petStill: Still = (c, R) => {
  // a cat asleep, curled on a cushion: its tail round its nose
  shadow(c, 0.5, 0.92, 0.44, 0.06, 0.3);
  ell(c, 0.5, 0.84, 0.44, 0.1, lin(c, 0, 0.76, 0, 0.94, [[0, tone('#8aa8c8', R, 0.5)], [1, tone('#5a7898', R)]]));
  const fur = '#e8a060';
  c.fillStyle = rad(c, 0.44, 0.6, 0.04, 0.36, [[0, tone(mixHex(fur, '#ffffff', 0.3), R, 0.7)], [1, tone(mixHex(fur, '#000000', 0.3), R)]]);
  c.beginPath(); c.ellipse(0.5, 0.68, 0.32, 0.17, 0, 0, TAU); c.fill();
  // stripes
  c.strokeStyle = rgba(tone('#a8582a', R), 0.6);
  c.lineWidth = 0.02;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(0.56, 0.72, 0.1 + i * 0.045, -2.6, -1.4); c.stroke(); }
  // the head tucked, its ears, the closed eye
  c.fillStyle = tone(mixHex(fur, '#ffffff', 0.15), R, 0.6);
  c.beginPath(); c.ellipse(0.27, 0.66, 0.11, 0.09, -0.2, 0, TAU); c.fill();
  poly(c, [0.2, 0.6, 0.2, 0.5, 0.26, 0.58], tone(fur, R, 0.4));
  poly(c, [0.3, 0.57, 0.34, 0.48, 0.36, 0.59], tone(fur, R, 0.4));
  c.strokeStyle = tone('#4a2a18', R);
  c.lineWidth = 0.008;
  c.beginPath(); c.arc(0.25, 0.66, 0.025, 0.2, Math.PI - 0.2); c.stroke();
  // the tail round the front
  c.strokeStyle = tone(mixHex(fur, '#000000', 0.12), R, 0.4);
  c.lineWidth = 0.06;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(0.8, 0.74); c.quadraticCurveTo(0.62, 0.86, 0.3, 0.78); c.stroke();
};

const petLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  // the breath: a soft rise of the flank, a warm light on the fur
  const b = (Math.sin(t * 1.4) + 1) / 2;
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffd8a8', 0.52, 0.64, 0.3 + 0.02 * b, (0.12 + 0.2 * open) * (0.6 + 0.4 * b), 0.55);
  c.restore();
  void R;
};

const phoneStill: Still = (c, R) => {
  shadow(c, 0.5, 0.92, 0.3, 0.05, 0.3);
  c.save();
  c.translate(0.5, 0.6);
  c.rotate(-0.12);
  c.fillStyle = tone('#22242c', R, 0.3);
  rrect(c, -0.2, -0.36, 0.4, 0.72, 0.06);
  c.fill();
  c.fillStyle = lin(c, 0, -0.32, 0, 0.32, [[0, '#ffe2b8'], [1, '#f6b88a']]);
  rrect(c, -0.18, -0.33, 0.36, 0.66, 0.04);
  c.fill();
  // a call from someone dear: the round picture with a heart, the green answer
  ell(c, 0, -0.1, 0.09, 0.09, rgba('#ffffff', 0.85));
  c.fillStyle = '#e8607a';
  c.beginPath();
  c.moveTo(0, -0.06);
  c.bezierCurveTo(-0.07, -0.11, -0.04, -0.17, 0, -0.13);
  c.bezierCurveTo(0.04, -0.17, 0.07, -0.11, 0, -0.06);
  c.fill();
  ell(c, 0, 0.18, 0.045, 0.045, '#3ac07a');
  rect(c, -0.09, 0.04, 0.18, 0.02, rgba('#ffffff', 0.8));
  rect(c, -0.06, 0.08, 0.12, 0.015, rgba('#ffffff', 0.5));
  c.restore();
};

const phoneLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  // the ring: soft arcs breathing out from the phone, the screen's glow
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffd8a8', 0.5, 0.56, 0.36, 0.2 + 0.25 * open);
  c.strokeStyle = rgba('#ffe6c0', 0.3 * open);
  c.lineWidth = 0.01;
  for (let i = 0; i < 3; i++) {
    const r = 0.3 + ((t * 0.5 + i / 3) % 1) * 0.2;
    c.globalAlpha = 1 - ((t * 0.5 + i / 3) % 1);
    c.beginPath(); c.arc(0.5, 0.56, r, -0.6, 0.6); c.stroke();
    c.beginPath(); c.arc(0.5, 0.56, r, Math.PI - 0.6, Math.PI + 0.6); c.stroke();
  }
  c.restore();
  void R;
};

const bedStill: Still = (c, R) => {
  // a pillow and the duvet's folded edge, soft morning cotton
  c.fillStyle = lin(c, 0, 0.5, 0, 1, [[0, tone('#f6f2ec', R, 0.7)], [1, tone('#c8c0b6', R)]]);
  c.fillRect(0, 0.62, 1, 0.38);
  c.fillStyle = rad(c, 0.36, 0.38, 0.04, 0.46, [[0, tone('#fbf4e8', R, 0.6)], [0.6, tone('#e6dccb', R, 0.2)], [1, tone('#bfb3a2', R)]]);
  c.beginPath();
  c.moveTo(0.1, 0.62); c.bezierCurveTo(0.06, 0.4, 0.14, 0.28, 0.3, 0.3); c.bezierCurveTo(0.5, 0.26, 0.74, 0.28, 0.86, 0.32);
  c.bezierCurveTo(0.96, 0.44, 0.94, 0.58, 0.88, 0.64); c.closePath(); c.fill();
  c.strokeStyle = rgba('#a8a094', 0.4);
  c.lineWidth = 0.008;
  c.beginPath(); c.moveTo(0.3, 0.42); c.quadraticCurveTo(0.42, 0.46, 0.5, 0.42); c.stroke();
  // the duvet's fold, a knit blanket's corner
  c.fillStyle = lin(c, 0, 0.6, 0, 0.8, [[0, tone('#e4c4a8', R, 0.6)], [1, tone('#b8907a', R)]]);
  c.beginPath(); c.moveTo(0, 0.66); c.bezierCurveTo(0.3, 0.6, 0.6, 0.7, 1, 0.64); c.lineTo(1, 0.8); c.bezierCurveTo(0.6, 0.86, 0.3, 0.76, 0, 0.82); c.closePath(); c.fill();
  c.strokeStyle = rgba('#ffffff', 0.25);
  c.lineWidth = 0.006;
  for (let i = 0; i < 18; i++) { const x = i / 18; c.beginPath(); c.moveTo(x, 0.68 + Math.sin(x * 3) * 0.02); c.lineTo(x + 0.02, 0.74 + Math.sin(x * 3) * 0.02); c.stroke(); }
};

const bedLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  motes(c, 0.05, 0.05, 0.9, 0.5, t, open, 10);
  void R;
};

const birdStill: Still = (c, R) => {
  // a robin on a twig with a few leaves
  c.strokeStyle = tone('#5a3e28', R, 0.3);
  c.lineWidth = 0.03;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, 0.82); c.quadraticCurveTo(0.5, 0.74, 1, 0.8); c.stroke();
  c.lineWidth = 0.014;
  c.beginPath(); c.moveTo(0.74, 0.78); c.quadraticCurveTo(0.84, 0.68, 0.92, 0.66); c.stroke();
  for (const [x, y, a] of [[0.9, 0.64, -0.5], [0.12, 0.79, 0.4], [0.84, 0.7, 0.8]] as const) {
    c.save(); c.translate(x, y); c.rotate(a);
    ell(c, 0, 0, 0.06, 0.022, tone('#6aa04a', R, 0.4));
    c.restore();
  }
  // the bird: brown back, a warm orange breast, a black eye with a glint
  c.fillStyle = rad(c, 0.46, 0.56, 0.02, 0.2, [[0, tone('#a8805a', R, 0.6)], [1, tone('#5a4030', R)]]);
  c.beginPath(); c.ellipse(0.48, 0.6, 0.17, 0.13, -0.2, 0, TAU); c.fill();
  c.fillStyle = rad(c, 0.42, 0.62, 0.01, 0.12, [[0, tone('#ffa860', R, 0.8)], [1, tone('#d8582a', R)]]);
  c.beginPath(); c.ellipse(0.42, 0.63, 0.1, 0.09, -0.2, 0, TAU); c.fill();
  ell(c, 0.36, 0.5, 0.075, 0.07, tone('#8a6448', R, 0.5));
  c.fillStyle = rgba(tone('#ffa860', R, 0.7), 0.9);
  c.beginPath(); c.ellipse(0.34, 0.53, 0.05, 0.04, 0, 0, TAU); c.fill();
  ell(c, 0.33, 0.48, 0.012, 0.012, '#161210');
  ell(c, 0.328, 0.476, 0.004, 0.004, '#ffffff');
  poly(c, [0.27, 0.49, 0.22, 0.5, 0.27, 0.51], tone('#3a2a20', R));
  // tail and legs
  poly(c, [0.62, 0.58, 0.8, 0.5, 0.78, 0.56, 0.64, 0.64], tone('#5a4030', R, 0.3));
  c.strokeStyle = tone('#3a2a20', R);
  c.lineWidth = 0.008;
  c.beginPath(); c.moveTo(0.46, 0.72); c.lineTo(0.45, 0.78); c.moveTo(0.52, 0.72); c.lineTo(0.53, 0.78); c.stroke();
};

const birdLive: Live = (c, R, t, open) => {
  if (t === 0) return;
  // its song: small notes from the beak in short phrases
  const phrase = (t * 0.5) % 1;
  if (phrase < 0.45) {
    for (let i = 0; i < 3; i++) {
      const ph = (phrase / 0.45 + i * 0.2) % 1;
      c.fillStyle = rgba('#fff2d0', (0.3 + 0.6 * open) * Math.sin(ph * Math.PI));
      c.beginPath(); c.arc(0.2 - ph * 0.14, 0.44 - ph * 0.18 - i * 0.03, 0.012, 0, TAU); c.fill();
    }
  }
  void R;
};

const seedStill: Still = (c, R) => {
  // dark soil in two cupped hands, a seedling with two leaves
  c.fillStyle = rad(c, 0.5, 0.74, 0.04, 0.4, [[0, tone('#f2c4a4', R, 0.8)], [1, tone('#b87a5e', R)]]);
  c.beginPath(); c.moveTo(0.1, 0.7); c.bezierCurveTo(0.14, 0.94, 0.86, 0.94, 0.9, 0.7); c.bezierCurveTo(0.8, 0.76, 0.2, 0.76, 0.1, 0.7); c.fill();
  c.fillStyle = rad(c, 0.5, 0.66, 0.02, 0.32, [[0, tone('#6a4a32', R, 0.3)], [1, tone('#2e2018', R)]]);
  c.beginPath(); c.ellipse(0.5, 0.71, 0.34, 0.08, 0, 0, TAU); c.fill();
  c.fillStyle = rgba('#8a6a50', 0.5);
  for (let i = 0; i < 20; i++) c.fillRect(0.2 + 0.6 * hash(i * 3), 0.66 + 0.08 * hash(i * 7), 0.008, 0.006);
  c.strokeStyle = tone('#6aa04a', R, 0.5);
  c.lineWidth = 0.018;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(0.5, 0.7); c.quadraticCurveTo(0.48, 0.56, 0.5, 0.44); c.stroke();
  for (const s of [-1, 1]) {
    c.fillStyle = lin(c, 0.5, 0.42, 0.5 + s * 0.16, 0.38, [[0, tone('#8ac85a', R, 0.7)], [1, tone('#4f8a3a', R)]]);
    c.beginPath(); c.moveTo(0.5, 0.45); c.quadraticCurveTo(0.5 + s * 0.08, 0.32, 0.5 + s * 0.18, 0.38); c.quadraticCurveTo(0.5 + s * 0.1, 0.48, 0.5, 0.45); c.fill();
  }
};

const handStill: Still = (c, R) => {
  // two hands holding: a larger one from the left, a smaller one from the right, sleeves of wool; warm where they meet
  c.translate(0.5, 0.7);
  c.scale(1.45, 1.45);
  c.translate(-0.5, -0.66);
  const skin = (x: number, y: number, r: number) => rad(c, x, y, r * 0.1, r, [[0, tone('#f6cfae', R, 0.8)], [1, tone('#c08468', R, 0.2)]]);
  // the sleeves
  c.fillStyle = lin(c, 0, 0.7, 0.3, 1, [[0, tone('#5a7aa8', R, 0.5)], [1, tone('#34507a', R)]]);
  c.beginPath(); c.moveTo(-0.06, 0.86); c.lineTo(0.22, 0.68); c.lineTo(0.32, 0.84); c.lineTo(0.02, 1.02); c.closePath(); c.fill();
  c.strokeStyle = rgba('#ffffff', 0.15); c.lineWidth = 0.008;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0.0 + i * 0.07, 0.9 - i * 0.045); c.lineTo(0.06 + i * 0.07, 0.99 - i * 0.045); c.stroke(); }
  c.fillStyle = lin(c, 0.7, 0.7, 1, 1, [[0, tone('#f0b84a', R, 0.6)], [1, tone('#b8802a', R)]]);
  c.beginPath(); c.moveTo(1.06, 0.92); c.lineTo(0.8, 0.76); c.lineTo(0.73, 0.88); c.lineTo(0.98, 1.04); c.closePath(); c.fill();
  // the smaller hand (behind): its palm and its fingers held
  c.save();
  c.translate(0.66, 0.74); c.rotate(0.55);
  c.fillStyle = skin(0, 0, 0.14);
  c.beginPath(); c.ellipse(0, 0, 0.15, 0.085, 0, 0, TAU); c.fill();
  c.restore();
  // the larger hand: its back, the thumb over the small hand, four fingers curling round it
  c.save();
  c.translate(0.4, 0.64); c.rotate(-0.45);
  c.fillStyle = skin(-0.04, -0.02, 0.22);
  c.beginPath(); c.ellipse(0, 0, 0.19, 0.11, 0, 0, TAU); c.fill();
  c.restore();
  for (let i = 0; i < 4; i++) {
    const x = 0.5 + i * 0.045, y = 0.64 + i * 0.03;
    c.fillStyle = skin(x - 0.01, y - 0.01, 0.06);
    c.beginPath(); c.ellipse(x, y, 0.05, 0.028, 0.9, 0, TAU); c.fill();
    c.strokeStyle = rgba(tone('#9a6048', R), 0.35); c.lineWidth = 0.005;
    c.beginPath(); c.ellipse(x, y, 0.05, 0.028, 0.9, 0.4, 2.6); c.stroke();
  }
  c.fillStyle = skin(0.5, 0.55, 0.08);
  c.beginPath(); c.ellipse(0.53, 0.56, 0.075, 0.032, -0.35, 0, TAU); c.fill();
  c.strokeStyle = rgba(tone('#9a6048', R), 0.3); c.lineWidth = 0.006;
  c.beginPath(); c.moveTo(0.3, 0.66); c.quadraticCurveTo(0.38, 0.6, 0.46, 0.6); c.stroke();
  c.fillStyle = rgba('#ffffff', 0.18);
  c.beginPath(); c.ellipse(0.36, 0.6, 0.08, 0.025, -0.45, 0, TAU); c.fill();
};

const handLive: Live = (c, R, t, open) => {
  c.save();
  c.translate(0.5, 0.7);
  c.scale(1.45, 1.45);
  c.translate(-0.5, -0.66);
  c.globalCompositeOperation = 'lighter';
  const b = t === 0 ? 0.5 : (Math.sin(t * 1.1) + 1) / 2;
  glow(c, '#ffd890', 0.56, 0.64, 0.34, (0.07 + 0.16 * open) * (0.8 + 0.2 * b));
  glow(c, '#fff6dc', 0.56, 0.64, 0.06, 0.15 + 0.2 * open);
  c.restore();
  void R;
};

const heartStill: Still = (c, R) => {
  // a heart of warm glass (a keepsake), lit from within
  c.fillStyle = rad(c, 0.42, 0.46, 0.02, 0.4, [[0, tone('#ffd0d8', R, 0.9)], [0.6, tone('#e8607a', R, 0.5)], [1, tone('#9a2a44', R)]]);
  c.beginPath();
  c.moveTo(0.5, 0.86);
  c.bezierCurveTo(0.12, 0.62, 0.14, 0.26, 0.34, 0.26);
  c.bezierCurveTo(0.44, 0.26, 0.5, 0.34, 0.5, 0.4);
  c.bezierCurveTo(0.5, 0.34, 0.56, 0.26, 0.66, 0.26);
  c.bezierCurveTo(0.86, 0.26, 0.88, 0.62, 0.5, 0.86);
  c.fill();
  c.fillStyle = rgba('#ffffff', 0.5);
  c.beginPath(); c.ellipse(0.32, 0.38, 0.05, 0.03, -0.6, 0, TAU); c.fill();
};

const heartLive: Live = (c, R, t, open) => {
  c.save();
  c.globalCompositeOperation = 'lighter';
  const b = t === 0 ? 0.5 : (Math.sin(t * 1.3) + 1) / 2;
  glow(c, '#ffc0b0', 0.5, 0.54, 0.4, (0.2 + 0.3 * open) * (0.7 + 0.3 * b));
  c.restore();
  void R;
};

/** The round 22 motifs that have no painting of their own here: their stamp drawn large on a warm palette. */
const fromMotif = (m: Motif): Still => (c, R) => {
  shadow(c, 0.5, 0.92, 0.36, 0.05, 0.25);
  const p = goldPal(m, false);
  const t = (hex: string) => tone(hex, R, 0.6);
  drawMotif(c, m, 0.06, 0.06, 0.88, { ink: t(p.ink), fill: t(p.fill), fill2: t(p.fill2), light: t(p.light), accent: t(p.accent), accent2: t(p.accent2), bg: t(p.bg) }, 0);
};

// ── views ─────────────────────────────────────────────────────────

const skyView: ViewPaint = (c, R, x, y, w, h) => {
  const Lt = R.Lt;
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, rgbHex(Lt.top)], [0.6, rgbHex(Lt.mid)], [1, rgbHex(Lt.hor)]]);
  c.fillRect(x, y, w, h);
  // big soft clouds lit from below
  for (let i = 0; i < 5; i++) {
    const cx = x + w * (0.1 + 0.8 * hash(i * 7 + 3)), cy = y + h * (0.4 + 0.32 * hash(i * 5 + 1)), s = Math.min(w, h) * (0.12 + 0.08 * hash(i));
    for (let k = 0; k < 6; k++) {
      const ox = (k - 2.5) * s * 0.5, oy = -Math.sin((k / 5) * Math.PI) * s * 0.35;
      ell(c, cx + ox, cy + oy + s * 0.1, s * 0.5, s * 0.32, rgba(mixHex(rgbHex(Lt.mid), rgbHex(Lt.top), 0.3), 0.5));
      ell(c, cx + ox - s * 0.05, cy + oy - s * 0.04, s * 0.45, s * 0.28, rgba(mixHex(rgbHex(Lt.hor), '#ffffff', 0.55 - 0.4 * Lt.dusk), 0.7));
    }
  }
};

const skyLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  if (t === 0) return;
  // a pair of swallows crossing, the light breathing
  c.strokeStyle = rgba('#1d2230', 0.6);
  c.lineWidth = Math.max(1, Math.min(w, h) * 0.006);
  for (let i = 0; i < 2; i++) {
    const ph = ((t * 0.04 + i * 0.5) % 1);
    const bx = x + w * ph, by = y + h * (0.48 + 0.08 * i) + Math.sin(t + i) * h * 0.02, s = Math.min(w, h) * 0.025;
    const fl = Math.sin(t * 8 + i);
    c.beginPath(); c.moveTo(bx - s, by - s * 0.4 * fl); c.quadraticCurveTo(bx, by, bx + s, by - s * 0.4 * fl); c.stroke();
  }
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, rgbHex(R.Lt.hor), x + w / 2, y + h, w * 0.6, 0.15 + 0.15 * open, 0.5);
  c.restore();
};

const sunView: ViewPaint = (c, R, x, y, w, h) => {
  skyView(c, R, x, y, w, h);
  const sx = x + w * 0.62, sy = y + h * 0.56, r = Math.min(w, h) * 0.12;
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffd890', sx, sy, r * 7, 0.45);
  glow(c, '#fff4dc', sx, sy, r * 2.2, 0.8);
  c.restore();
  ell(c, sx, sy, r, r, '#fffaf0');
  // the roofs' edge below, warm in the light
  c.fillStyle = mixHex(rgbHex(R.Lt.hor), '#5a4a50', 0.5);
  c.beginPath();
  c.moveTo(x, y + h);
  for (let i = 0; i <= 10; i++) c.lineTo(x + (w * i) / 10, y + h * (0.84 + 0.05 * Math.sin(i * 2.3)) - (i % 3 === 0 ? h * 0.05 : 0));
  c.lineTo(x + w, y + h);
  c.closePath();
  c.fill();
};

const sunLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  const sx = x + w * 0.62, sy = y + h * 0.56, r = Math.min(w, h) * 0.12;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (t === 0 ? 0 : t * 0.03);
    const len = r * (2.4 + 1.6 * open + 0.4 * Math.sin(t * 0.7 + i));
    c.strokeStyle = rgba('#fff0c0', 0.12 + 0.12 * open);
    c.lineWidth = r * 0.18;
    c.beginPath(); c.moveTo(sx + Math.cos(a) * r * 1.3, sy + Math.sin(a) * r * 1.3); c.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len); c.stroke();
  }
  c.restore();
  void R;
};

const rainView: ViewPaint = (c, R, x, y, w, h) => {
  // a window pane in the rain: the world behind blurred grey-blue, the frame's edge
  const Lt = R.Lt;
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, mixHex(rgbHex(Lt.mid), '#6a7890', 0.6)], [1, mixHex(rgbHex(Lt.hor), '#8a96a8', 0.5)]]);
  c.fillRect(x, y, w, h);
  for (let i = 0; i < 9; i++) {
    const bx = x + w * hash(i * 3 + 7), by = y + h * (0.55 + 0.4 * hash(i * 5)), r = Math.min(w, h) * (0.05 + 0.08 * hash(i));
    ell(c, bx, by, r, r, rgba(i % 3 ? '#4a5466' : '#ffd890', i % 3 ? 0.35 : 0.35 * (0.3 + Lt.dusk)));
  }
  // drops resting on the glass
  for (let i = 0; i < 70; i++) {
    const dx = x + w * hash(i * 11 + 1), dy = y + h * hash(i * 13 + 2), r = Math.min(w, h) * (0.004 + 0.01 * hash(i * 17) ** 2);
    ell(c, dx, dy, r, r * 1.1, rgba('#d8e4ee', 0.55));
    ell(c, dx - r * 0.3, dy - r * 0.35, r * 0.35, r * 0.35, rgba('#ffffff', 0.8));
  }
  rect(c, x, y + h * 0.94, w, h * 0.06, tone('#e8e0d0', R, 0.3));
};

const rainLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  // drops running down the glass, each leaving a short trail
  const n = 9 + Math.round(8 * open);
  c.save();
  for (let i = 0; i < n; i++) {
    const sp = 0.06 + 0.12 * hash(i * 3);
    const ph = t === 0 ? hash(i * 7) : (t * sp + hash(i * 7)) % 1;
    const dx = x + w * (0.05 + 0.9 * hash(i * 5 + 3)) + Math.sin(ph * 9 + i) * w * 0.004;
    const dy = y + h * ph * 0.95;
    const r = Math.min(w, h) * (0.008 + 0.006 * hash(i));
    c.strokeStyle = rgba('#e8f0f6', 0.3);
    c.lineWidth = r * 0.7;
    c.beginPath(); c.moveTo(dx, dy - h * 0.08); c.lineTo(dx, dy); c.stroke();
    ell(c, dx, dy, r, r * 1.25, rgba('#e8f0f6', 0.7));
    ell(c, dx - r * 0.3, dy - r * 0.4, r * 0.35, r * 0.35, rgba('#ffffff', 0.9));
  }
  c.restore();
  void R;
};

const rainbowView: ViewPaint = (c, R, x, y, w, h) => {
  skyView(c, R, x, y, w, h);
  const cx = x + w * 0.5, cy = y + h * 1.02, r = Math.min(w * 0.52, h * 0.56);
  const bands = ['#ff5a5a', '#ffa040', '#ffe050', '#6ad06a', '#4aa0f0', '#7a6ae0', '#b070d0'];
  c.save();
  c.globalAlpha = 0.55;
  bands.forEach((col, i) => {
    c.strokeStyle = col;
    c.lineWidth = r * 0.035;
    c.beginPath(); c.arc(cx, cy, r - i * r * 0.034, Math.PI, TAU); c.stroke();
  });
  c.restore();
  // wet roofs shining below
  c.fillStyle = mixHex(rgbHex(R.Lt.hor), '#4a5060', 0.55);
  c.beginPath();
  c.moveTo(x, y + h);
  for (let i = 0; i <= 12; i++) c.lineTo(x + (w * i) / 12, y + h * (0.86 + 0.04 * Math.sin(i * 1.9)) - (i % 4 === 1 ? h * 0.06 : 0));
  c.lineTo(x + w, y + h);
  c.closePath();
  c.fill();
};

const rainbowLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#fff6e0', x + w * 0.5, y + h * 0.5, w * 0.5, 0.06 + 0.12 * open, 0.6);
  if (t !== 0) for (let i = 0; i < 8; i++) {
    const a = Math.PI + (i / 7) * Math.PI;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
    const r = Math.min(w * 0.52, h * 0.56) * 0.9;
    glow(c, '#ffffff', x + w * 0.5 + Math.cos(a) * r, y + h * 1.02 + Math.sin(a) * r, Math.min(w, h) * 0.02, 0.5 * tw * open);
  }
  c.restore();
  void R;
};

const windowViewThing: ViewPaint = (c, R, x, y, w, h) => {
  // light through a window onto a wall: the frame's shape laid warm on the plaster, a curtain's edge
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, tone('#e8d6c0', R)], [1, tone('#d4bca4', R)]]);
  c.fillRect(x, y, w, h);
  const wx = x + w * 0.14, wy = y + h * 0.32, ww = w * 0.4, wh = h * 0.5;
  windowView(c, R, wx, wy, wx + ww, wy + wh, 'roofs', 3);
  c.strokeStyle = tone('#f4ede0', R, 0.5);
  c.lineWidth = Math.min(w, h) * 0.02;
  c.strokeRect(wx, wy, ww, wh);
  c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, wy + wh * 0.4); c.lineTo(wx + ww, wy + wh * 0.4); c.stroke();
  // the light's patch on the wall to the right
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = rgba(rgbHex(R.sun), 0.25 + 0.2 * R.sunK);
  const px = x + w * 0.6, py = y + h * 0.44;
  c.beginPath(); c.moveTo(px, py); c.lineTo(px + w * 0.3, py + h * 0.04); c.lineTo(px + w * 0.33, py + h * 0.44); c.lineTo(px + w * 0.02, py + h * 0.37); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = rgba(tone('#8a6a4a', R), 0.25);
  c.lineWidth = Math.min(w, h) * 0.012;
  c.beginPath(); c.moveTo(px + w * 0.15, py + h * 0.02); c.lineTo(px + w * 0.17, py + h * 0.4); c.stroke();
  // the curtain
  c.fillStyle = lin(c, x, 0, x + w * 0.1, 0, [[0, tone('#c8907a', R, 0.4)], [1, tone('#e8b8a0', R, 0.6)]]);
  c.fillRect(x, y, w * 0.08, h);
};

const windowLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  motes(c, x + w * 0.5, y + h * 0.36, w * 0.45, h * 0.45, t, open, 18);
  void R;
};

const grassView: ViewPaint = (c, R, x, y, w, h) => {
  // grass seen from close to the ground: blades against a soft light, dew
  const Lt = R.Lt;
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, mixHex(rgbHex(Lt.hor), '#f6f0d8', 0.4)], [0.5, mixHex('#a8c88a', rgbHex(Lt.hor), 0.4)], [1, tone('#3f6a34', R)]]);
  c.fillRect(x, y, w, h);
  for (let layer = 0; layer < 3; layer++) {
    const n = 40 + layer * 20;
    for (let i = 0; i < n; i++) {
      const bx = x + w * hash(i * 7 + layer * 101), bh = h * (0.25 + 0.35 * hash(i * 3 + layer * 7)) * (0.7 + layer * 0.25);
      const lean = (hash(i * 11 + layer) - 0.5) * w * 0.06;
      const col = tone(mixHex(['#9ac870', '#6aa04a', '#4f8a3a'][layer], '#e8f0a0', 0.2 * hash(i)), R, 0.7);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(bx - w * 0.004, y + h);
      c.quadraticCurveTo(bx + lean * 0.4, y + h - bh * 0.6, bx + lean, y + h - bh);
      c.quadraticCurveTo(bx + lean * 0.4 + w * 0.006, y + h - bh * 0.6, bx + w * 0.006, y + h);
      c.fill();
    }
  }
  for (let i = 0; i < 30; i++) {
    const dx = x + w * hash(i * 19 + 5), dy = y + h * (0.55 + 0.4 * hash(i * 23)), r = Math.min(w, h) * 0.006;
    ell(c, dx, dy, r, r, rgba('#ffffff', 0.75));
  }
};

const grassLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  if (t === 0) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const dx = x + w * hash(i * 19 + 5), dy = y + h * (0.55 + 0.4 * hash(i * 23));
    glow(c, '#ffffff', dx, dy, Math.min(w, h) * 0.02, (0.2 + 0.5 * open) * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1)));
  }
  c.restore();
  void R;
};

const eyesView: ViewPaint = (c, R, x, y, w, h) => {
  // eyes that see: the world in colour seen through an eye's almond, the lashes' soft shadow above
  const Lt = R.Lt;
  c.fillStyle = tone('#2a1e1a', R);
  c.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h * 0.6, ew = Math.min(w * 0.9, h * 1.05), eh = ew * 0.46;
  c.save();
  c.beginPath();
  c.moveTo(cx - ew / 2, cy);
  c.bezierCurveTo(cx - ew * 0.25, cy - eh * 0.75, cx + ew * 0.25, cy - eh * 0.75, cx + ew / 2, cy);
  c.bezierCurveTo(cx + ew * 0.25, cy + eh * 0.75, cx - ew * 0.25, cy + eh * 0.75, cx - ew / 2, cy);
  c.closePath();
  c.clip();
  // the world: sky, a meadow, trees, a path, flowers
  c.fillStyle = lin(c, 0, cy - eh / 2, 0, cy + eh / 2, [[0, rgbHex(Lt.top)], [0.5, rgbHex(Lt.hor)], [0.52, '#8ac06a'], [1, '#4f8a3a']]);
  c.fillRect(cx - ew / 2, cy - eh / 2, ew, eh);
  for (let i = 0; i < 5; i++) {
    const tx = cx - ew * 0.4 + ew * 0.8 * hash(i * 3), tr = eh * (0.1 + 0.06 * hash(i));
    ell(c, tx, cy - tr * 0.4, tr, tr, '#4f8a44');
  }
  for (let i = 0; i < 30; i++) ell(c, cx - ew / 2 + ew * hash(i * 7), cy + eh * (0.08 + 0.4 * hash(i * 9)), eh * 0.012, eh * 0.012, ['#ffd25a', '#f2a0b8', '#ffffff'][i % 3]);
  c.fillStyle = '#e8d0a0';
  c.beginPath(); c.moveTo(cx - eh * 0.05, cy + eh * 0.02); c.lineTo(cx + eh * 0.05, cy + eh * 0.02); c.lineTo(cx + eh * 0.4, cy + eh * 0.5); c.lineTo(cx - eh * 0.4, cy + eh * 0.5); c.closePath(); c.fill();
  c.restore();
  // the lid's edge and lashes
  c.strokeStyle = tone('#1a120e', R);
  c.lineWidth = eh * 0.06;
  c.beginPath();
  c.moveTo(cx - ew / 2, cy);
  c.bezierCurveTo(cx - ew * 0.25, cy - eh * 0.75, cx + ew * 0.25, cy - eh * 0.75, cx + ew / 2, cy);
  c.stroke();
  c.lineWidth = eh * 0.018;
  c.lineCap = 'round';
  for (let i = 1; i < 14; i++) {
    const u = i / 14;
    const px = cx - ew / 2 + ew * u, py = cy - eh * 0.56 * Math.sin(u * Math.PI) - eh * 0.02;
    c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + (u - 0.5) * eh * 0.1, py - eh * 0.12, px + (u - 0.5) * eh * 0.25, py - eh * 0.2); c.stroke();
  }
};

const eyesLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  const cx = x + w / 2, cy = y + h * 0.6, ew = Math.min(w * 0.9, h * 1.05), eh = ew * 0.46;
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#fff6e0', cx, cy - eh * 0.1, ew * 0.4, 0.08 + 0.18 * open, 0.5);
  if (t !== 0) for (let i = 0; i < 6; i++) glow(c, '#ffffff', cx - ew * 0.35 + ew * 0.7 * hash(i * 5), cy + eh * 0.2 * hash(i * 3), eh * 0.04, 0.5 * open * (0.5 + 0.5 * Math.sin(t * 1.6 + i)));
  c.restore();
  void R;
};

const feetView: ViewPaint = (c, R, x, y, w, h) => {
  // feet on the way: two shoes on a path of stones, grass at its sides, morning light along it
  const Lt = R.Lt;
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, mixHex(rgbHex(Lt.hor), '#c8c0a8', 0.5)], [1, tone('#a89a82', R)]]);
  c.fillRect(x, y, w, h);
  for (let i = 0; i < 26; i++) {
    const sx = x + w * hash(i * 3 + 1), sy = y + h * (0.1 + 0.9 * hash(i * 5 + 2)), r = Math.min(w, h) * (0.04 + 0.04 * hash(i));
    ell(c, sx, sy, r * 1.3, r * 0.7, tone(mixHex('#c8bca4', '#8a7e6a', hash(i * 7)), R, 0.5));
  }
  // the path's grassy edges: soft tufts, not stripes
  for (const side of [0, 1]) {
    for (let i = 0; i < 14; i++) {
      const gx = side ? x + w * (0.84 + 0.16 * hash(i)) : x + w * 0.16 * hash(i + 40), gy = y + h * (0.35 + 0.65 * hash(i * 9 + side));
      const r = Math.min(w, h) * (0.04 + 0.03 * hash(i * 3 + side));
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.35;
        c.fillStyle = tone(mixHex('#5f9a4a', '#9ac870', hash(i * 5 + k) * 0.6), R, 0.5);
        c.beginPath();
        c.moveTo(gx - r * 0.15, gy);
        c.quadraticCurveTo(gx + Math.cos(a) * r * 0.5, gy + Math.sin(a) * r * 0.9, gx + Math.cos(a) * r, gy + Math.sin(a) * r * 1.6);
        c.quadraticCurveTo(gx + Math.cos(a) * r * 0.3, gy + Math.sin(a) * r * 0.6, gx + r * 0.15, gy);
        c.fill();
      }
    }
  }
  // the two shoes, one a step ahead: sneakers seen from above the toes, laces, a white sole
  const shoe = (sx: number, sy: number, s: number, tilt: number) => {
    shadow(c, sx, sy + s * 0.32, s * 0.36, s * 0.07, 0.35);
    c.save();
    c.translate(sx, sy);
    c.rotate(tilt);
    // the sole
    c.fillStyle = tone('#f4f0e8', R, 0.6);
    c.beginPath(); c.moveTo(-s * 0.26, s * 0.3); c.bezierCurveTo(-s * 0.32, -s * 0.2, -s * 0.18, -s * 0.48, 0, -s * 0.48); c.bezierCurveTo(s * 0.18, -s * 0.48, s * 0.32, -s * 0.2, s * 0.26, s * 0.3); c.closePath(); c.fill();
    // the upper
    c.fillStyle = lin(c, -s * 0.25, 0, s * 0.25, 0, [[0, tone('#5a82c0', R, 0.7)], [0.6, tone('#3a5a9a', R, 0.4)], [1, tone('#24386a', R)]]);
    c.beginPath(); c.moveTo(-s * 0.22, s * 0.26); c.bezierCurveTo(-s * 0.27, -s * 0.16, -s * 0.15, -s * 0.42, 0, -s * 0.42); c.bezierCurveTo(s * 0.15, -s * 0.42, s * 0.27, -s * 0.16, s * 0.22, s * 0.26); c.closePath(); c.fill();
    // the toe cap, the tongue and the opening, the laces
    c.fillStyle = tone('#eae6dc', R, 0.6);
    c.beginPath(); c.ellipse(0, -s * 0.33, s * 0.15, s * 0.08, 0, Math.PI, TAU); c.fill();
    c.fillStyle = tone('#1e2a44', R);
    c.beginPath(); c.ellipse(0, s * 0.16, s * 0.12, s * 0.09, 0, 0, TAU); c.fill();
    c.strokeStyle = tone('#f8f6f0', R, 0.7);
    c.lineWidth = s * 0.025;
    c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const yy = -s * 0.2 + i * s * 0.08; c.beginPath(); c.moveTo(-s * 0.08, yy); c.lineTo(s * 0.08, yy + s * 0.02); c.stroke(); }
    c.restore();
  };
  const s = Math.min(w * 0.3, h * 0.3);
  shoe(x + w * 0.4, y + h * 0.7, s, -0.08);
  shoe(x + w * 0.6, y + h * 0.5, s * 0.86, 0.06);
};

const feetLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, rgbHex(R.Lt.hor), x + w * 0.5, y, w * 0.7, 0.1 + 0.15 * open, 0.5);
  c.restore();
  if (t !== 0) motes(c, x, y, w, h * 0.5, t, open, 8);
};

const busView: ViewPaint = (c, R, x, y, w, h) => {
  // the bus that comes: its round headlights and kind face at the stop, a city behind
  const Lt = R.Lt;
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, rgbHex(Lt.mid)], [1, rgbHex(Lt.hor)]]);
  c.fillRect(x, y, w, h);
  windowView(c, R, x, y, x + w, y + h * 0.8, 'city', 4);
  rect(c, x, y + h * 0.8, w, h * 0.2, tone('#8a8a8e', R));
  const bh = h * 0.5, bw = Math.min(w * 0.6, bh * 0.9), bx = x + w / 2 - bw / 2, by = y + h * 0.36;
  c.fillStyle = lin(c, bx, 0, bx + bw, 0, [[0, tone('#f2c44a', R, 0.6)], [0.5, tone('#ffd860', R, 0.8)], [1, tone('#c8962a', R)]]);
  rrect(c, bx, by, bw, bh, bw * 0.08);
  c.fill();
  c.fillStyle = lin(c, 0, by + bh * 0.08, 0, by + bh * 0.45, [[0, tone('#a8c8e0', R, 0.5)], [1, tone('#5a7898', R)]]);
  rrect(c, bx + bw * 0.08, by + bh * 0.08, bw * 0.84, bh * 0.38, bw * 0.04);
  c.fill();
  rect(c, bx + bw * 0.2, by + bh * 0.015, bw * 0.6, bh * 0.05, tone('#3a3430', R));
  for (const s of [0.2, 0.8]) ell(c, bx + bw * s, by + bh * 0.7, bw * 0.07, bw * 0.07, tone('#fff6dc', R, 0.8));
  rect(c, bx + bw * 0.32, by + bh * 0.67, bw * 0.36, bh * 0.07, tone('#3a3430', R, 0.2));
  rect(c, bx - bw * 0.02, by + bh * 0.86, bw * 1.04, bh * 0.06, tone('#4a4a52', R));
};

const busLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  const bh = h * 0.5, bw = Math.min(w * 0.6, bh * 0.9), bx = x + w / 2 - bw / 2, by = y + h * 0.36;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const s of [0.2, 0.8]) glow(c, '#fff2c8', bx + bw * s, by + bh * 0.7, bw * (0.2 + 0.15 * open), 0.4 + 0.3 * (R.Lt.dusk + open * 0.5));
  c.restore();
  void t;
};

const smileView: ViewPaint = (c, R, x, y, w, h) => {
  // the faces of dear ones at a table under a lamp: three of them leaning together, laughing (no features — a presence)
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, tone('#4a3428', R, 0, 1)], [0.6, tone('#8a6448', R, 0, 1)], [1, tone('#3a281e', R, 0, 1)]]);
  c.fillRect(x, y, w, h);
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) glow(c, i % 2 ? '#ffc070' : '#ffe0a8', x + w * hash(i * 5 + 1), y + h * (0.3 + 0.3 * hash(i * 3)), Math.min(w, h) * 0.08, 0.25);
  glow(c, '#ffd8a0', x + w * 0.5, y + h * 0.4, Math.min(w, h) * 0.7, 0.3);
  c.restore();
  const s = Math.min(w * 0.3, h * 0.32);
  const cy = y + h * 0.66;
  const ppl: [number, number, string, string, number][] = [[0.27, 0.92, '#5a6a8a', '#3a2a22', -0.12], [0.5, 1.05, '#a85a4a', '#8a6a4a', 0.08], [0.73, 0.88, '#6a8a5a', '#c8a06a', 0.14]];
  for (const [fx, sc, coat, hair, tilt] of ppl) {
    const px = x + w * fx, k = s * sc;
    c.save();
    c.translate(px, cy);
    c.rotate(tilt);
    c.fillStyle = lin(c, -k * 0.6, 0, k * 0.6, 0, [[0, tone(mixHex(coat, '#ffffff', 0.15), R, 0.5, 1)], [1, tone(mixHex(coat, '#000000', 0.3), R, 0, 1)]]);
    c.beginPath(); c.moveTo(-k * 0.62, k * 0.9); c.quadraticCurveTo(-k * 0.6, k * 0.15, -k * 0.18, k * 0.08); c.lineTo(k * 0.18, k * 0.08); c.quadraticCurveTo(k * 0.6, k * 0.15, k * 0.62, k * 0.9); c.closePath(); c.fill();
    ell(c, 0, -k * 0.22, k * 0.27, k * 0.31, rad(c, -k * 0.08, -k * 0.3, k * 0.02, k * 0.34, [[0, tone('#f6cfae', R, 0.7, 1)], [1, tone('#b87a5e', R, 0, 1)]]));
    c.fillStyle = tone(hair, R, 0.2, 1);
    c.beginPath(); c.ellipse(0, -k * 0.33, k * 0.29, k * 0.23, 0, Math.PI, TAU); c.fill();
    ell(c, -k * 0.24, -k * 0.22, k * 0.07, k * 0.14, tone(hair, R, 0.2, 1));
    ell(c, k * 0.24, -k * 0.22, k * 0.07, k * 0.14, tone(hair, R, 0.2, 1));
    // the lamp's warm rim on the cheek
    ell(c, k * 0.12, -k * 0.16, k * 0.08, k * 0.14, rgba('#ffd8a8', 0.25));
    c.restore();
  }
  // the table's edge in front
  rect(c, x, y + h * 0.86, w, h * 0.14, tone('#f4ece0', R, 0.4, 1));
};

const smileLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  if (t === 0) return;
  // laughter: soft rings rising from the faces, in short bursts
  const s = Math.min(w * 0.3, h * 0.32);
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const burst = Math.max(0, Math.sin(t * 0.9 + i * 2.1));
    const ph = (t * 0.7 + i * 0.37) % 1;
    const px = x + w * (0.27 + 0.23 * i), py = y + h * 0.66 - s * 0.45 - ph * s * 0.5;
    c.strokeStyle = rgba('#fff2d0', burst * (1 - ph) * (0.3 + 0.5 * open));
    c.lineWidth = s * 0.025;
    c.beginPath(); c.arc(px, py, s * (0.12 + ph * 0.2), -2.4, -0.7); c.stroke();
  }
  c.restore();
  void R;
};

const carView: ViewPaint = (c, R, x, y, w, h) => {
  // the morning through the windscreen; the dashboard's two round dials; the wheel's rim
  const Lt = R.Lt;
  const hz = y + h * 0.58;
  c.fillStyle = lin(c, 0, y, 0, hz, [[0, rgbHex(Lt.top)], [1, rgbHex(Lt.hor)]]);
  c.fillRect(x, y, w, hz - y);
  c.fillStyle = tone(mixHex('#7a9a8a', rgbHex(Lt.hor), 0.5), R, 0.3);
  c.fillRect(x, hz - h * 0.03, w, h * 0.06);
  c.fillStyle = tone('#6a6a72', R, 0.3);
  c.beginPath(); c.moveTo(x + w * 0.49, hz); c.lineTo(x + w * 0.51, hz); c.lineTo(x + w * 0.85, y + h); c.lineTo(x + w * 0.15, y + h); c.closePath(); c.fill();
  // the dashboard
  c.fillStyle = lin(c, 0, y + h * 0.62, 0, y + h, [[0, tone('#3a3632', R, 0.3)], [1, tone('#161412', R)]]);
  c.beginPath(); c.moveTo(x, y + h * 0.7); c.quadraticCurveTo(x + w / 2, y + h * 0.58, x + w, y + h * 0.7); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); c.fill();
  const r = Math.min(w, h) * 0.11;
  for (const fx of [0.38, 0.62]) {
    const cx = x + w * fx, cy = y + h * 0.8;
    ell(c, cx, cy, r * 1.1, r * 1.1, tone('#0e0e10', R));
    c.strokeStyle = '#e8f4ff';
    c.lineWidth = r * 0.05;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.8 + (i / 10) * Math.PI * 1.4;
      c.globalAlpha = 0.7;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); c.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); c.stroke();
    }
    c.globalAlpha = 1;
  }
  // the wheel's rim across the lower part
  c.strokeStyle = tone('#22201e', R, 0.3);
  c.lineWidth = Math.min(w, h) * 0.06;
  c.beginPath(); c.arc(x + w * 0.5, y + h * 1.25, Math.min(w, h) * 0.55, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
};

const carLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  // the dials' needles rising and the dashboard's glow coming on
  const r = Math.min(w, h) * 0.11;
  const on = 0.4 + 0.6 * open;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const fx of [0.38, 0.62]) {
    const cx = x + w * fx, cy = y + h * 0.8;
    glow(c, fx < 0.5 ? '#ffb860' : '#7ad0ff', cx, cy, r * 1.6, 0.35 * on);
    const a = Math.PI * 0.8 + (0.15 + 0.35 * on + (t === 0 ? 0 : 0.03 * Math.sin(t * 2 + fx * 9))) * Math.PI * 1.4;
    c.strokeStyle = '#ff8a4a';
    c.lineWidth = r * 0.06;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); c.stroke();
  }
  c.restore();
  void R;
};

const clockView: ViewPaint = (c, R, x, y, w, h) => {
  // a church tower against the sky at noon: its clock, the bell in the open belfry
  skyView(c, R, x, y, w, h);
  const tw = Math.min(w * 0.34, h * 0.3), tx = x + w / 2 - tw / 2, top = y + h * 0.3;
  c.fillStyle = lin(c, tx, 0, tx + tw, 0, [[0, tone('#f0e2c8', R, 0.7)], [1, tone('#c8b498', R, 0.2)]]);
  c.fillRect(tx, top, tw, y + h - top);
  // the spire
  c.fillStyle = lin(c, tx, 0, tx + tw, 0, [[0, tone('#7ab0a0', R, 0.6)], [1, tone('#4a7a6a', R)]]);
  c.beginPath(); c.moveTo(tx - tw * 0.06, top); c.lineTo(tx + tw / 2, top - tw * 1.3); c.lineTo(tx + tw * 1.06, top); c.closePath(); c.fill();
  c.strokeStyle = tone('#c9a24a', R, 0.6);
  c.lineWidth = tw * 0.03;
  c.beginPath(); c.moveTo(tx + tw / 2, top - tw * 1.3); c.lineTo(tx + tw / 2, top - tw * 1.55); c.moveTo(tx + tw * 0.4, top - tw * 1.45); c.lineTo(tx + tw * 0.6, top - tw * 1.45); c.stroke();
  // the belfry's opening
  c.fillStyle = tone('#3a3430', R);
  c.beginPath(); c.moveTo(tx + tw * 0.25, top + tw * 0.75); c.lineTo(tx + tw * 0.25, top + tw * 0.3); c.arc(tx + tw / 2, top + tw * 0.3, tw * 0.25, Math.PI, TAU); c.lineTo(tx + tw * 0.75, top + tw * 0.75); c.closePath(); c.fill();
  // the clock face
  const cx = tx + tw / 2, cy = top + tw * 1.25, r = tw * 0.3;
  ell(c, cx, cy, r, r, tone('#f4e8c0', R, 0.7));
  c.strokeStyle = tone('#3a3024', R);
  c.lineWidth = r * 0.06;
  c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy - r * 0.75); c.moveTo(cx, cy); c.lineTo(cx + r * 0.05, cy - r * 0.55); c.stroke();
};

const clockLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  const tw = Math.min(w * 0.34, h * 0.3), tx = x + w / 2 - tw / 2, top = y + h * 0.3;
  const a = t === 0 ? 0 : Math.sin(t * 2.2) * 0.45;
  // the bell swinging, its rings spreading
  c.save();
  c.translate(tx + tw / 2, top + tw * 0.12);
  c.rotate(a);
  c.fillStyle = lin(c, -tw * 0.15, 0, tw * 0.15, 0, [[0, tone('#f0d070', R, 0.8)], [1, tone('#a8802a', R)]]);
  c.beginPath(); c.moveTo(-tw * 0.08, tw * 0.05); c.quadraticCurveTo(-tw * 0.12, tw * 0.3, -tw * 0.17, tw * 0.42); c.lineTo(tw * 0.17, tw * 0.42); c.quadraticCurveTo(tw * 0.12, tw * 0.3, tw * 0.08, tw * 0.05); c.closePath(); c.fill();
  c.restore();
  if (t !== 0) {
    c.strokeStyle = rgba('#fff2d0', 0.3 * (0.4 + 0.6 * open));
    c.lineWidth = tw * 0.02;
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.5 + i / 3) % 1;
      c.globalAlpha = 1 - ph;
      c.beginPath(); c.arc(tx + tw / 2, top + tw * 0.35, tw * (0.5 + ph * 1.4), -2.6, -0.5); c.stroke();
    }
    c.globalAlpha = 1;
  }
};

const doorView: ViewPaint = (c, R, x, y, w, h) => {
  // a church's door open in the morning: an arch of stone, the wooden leaf ajar, warm light inside, steps
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, tone('#e8dcc6', R, 0.5)], [1, tone('#c8b89e', R, 0.3)]]);
  c.fillRect(x, y, w, h);
  const dw = Math.min(w * 0.42, h * 0.42), dx = x + w / 2 - dw / 2, dt = y + h * 0.36, db = y + h * 0.9;
  // the arch's stones
  c.fillStyle = tone('#b8a684', R, 0.4);
  c.beginPath(); c.moveTo(dx - dw * 0.12, db); c.lineTo(dx - dw * 0.12, dt + dw * 0.5); c.arc(dx + dw / 2, dt + dw * 0.5, dw * 0.62, Math.PI, TAU); c.lineTo(dx + dw * 1.12, db); c.closePath(); c.fill();
  // the light inside
  c.fillStyle = rad(c, dx + dw / 2, db - dw * 0.3, dw * 0.05, dw * 1.1, [[0, '#fff2c8'], [0.5, '#ffc870'], [1, '#c8783a']]);
  c.beginPath(); c.moveTo(dx, db); c.lineTo(dx, dt + dw * 0.5); c.arc(dx + dw / 2, dt + dw * 0.5, dw * 0.5, Math.PI, TAU); c.lineTo(dx + dw, db); c.closePath(); c.fill();
  // the open leaf, studded
  c.fillStyle = lin(c, dx, 0, dx + dw * 0.4, 0, [[0, tone('#5a3a24', R, 0.3)], [1, tone('#8a5a3a', R, 0.5)]]);
  c.beginPath(); c.moveTo(dx, db); c.lineTo(dx, dt + dw * 0.5); c.lineTo(dx + dw * 0.32, dt + dw * 0.62); c.lineTo(dx + dw * 0.32, db + dw * 0.06); c.closePath(); c.fill();
  for (let i = 0; i < 5; i++) ell(c, dx + dw * 0.16, dt + dw * (0.7 + i * 0.22), dw * 0.015, dw * 0.015, tone('#2a2018', R));
  // the steps
  for (let i = 0; i < 3; i++) rect(c, dx - dw * (0.25 + i * 0.12), db + i * h * 0.03, dw * (1.5 + i * 0.24), h * 0.03, tone(mixHex('#d8ccb4', '#a89a82', i * 0.3), R, 0.4));
};

const doorLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  const dw = Math.min(w * 0.42, h * 0.42), dx = x + w / 2 - dw / 2, db = y + h * 0.9;
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffd890', dx + dw / 2, db - dw * 0.3, dw * (1.2 + 0.4 * open), 0.3 + 0.3 * open, 0.9);
  glow(c, '#ffe8b0', dx + dw / 2, db + h * 0.04, dw * 1.2, 0.2 + 0.2 * open, 0.3);
  c.restore();
  if (t !== 0) motes(c, dx, db - dw * 0.9, dw, dw * 0.9, t, open, 10);
  void R;
};

const clinicView: ViewPaint = (c, R, x, y, w, h) => {
  // the pharmacy round the corner: a cream facade, its window of shelves, the green cross on its bracket
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, tone('#efe4cc', R, 0.5)], [1, tone('#d8c8a8', R, 0.2)]]);
  c.fillRect(x, y, w, h);
  const ww = Math.min(w * 0.6, h * 0.5), wx = x + w / 2 - ww / 2, wy = y + h * 0.5;
  rect(c, wx - ww * 0.04, wy - ww * 0.04, ww * 1.08, h * 0.42, tone('#2e5a48', R, 0.3));
  c.fillStyle = lin(c, 0, wy, 0, wy + h * 0.36, [[0, tone('#f4f8f6', R, 0.5)], [1, tone('#c8dcd4', R)]]);
  c.fillRect(wx, wy, ww, h * 0.36);
  for (let r = 0; r < 3; r++) {
    rect(c, wx, wy + h * (0.1 + r * 0.11), ww, h * 0.008, tone('#9ab0a8', R));
    for (let q = 0; q < 8; q++) rect(c, wx + ww * (0.04 + q * 0.12), wy + h * (0.1 + r * 0.11) - h * 0.05, ww * 0.08, h * 0.05, tone(['#ffffff', '#e8f0f8', '#f8e8e0', '#e0f0e8'][(q + r) % 4], R, 0.4));
  }
  // the cross
  const cx = x + w * 0.5, cy = y + h * 0.34, s = Math.min(w, h) * 0.08;
  rect(c, cx - s * 1.6, cy - s * 0.25, s * 3.2, s * 0.5, tone('#3a3a40', R));
  c.fillStyle = '#3ac07a';
  c.fillRect(cx - s * 0.35, cy - s, s * 0.7, s * 2);
  c.fillRect(cx - s, cy - s * 0.35, s * 2, s * 0.7);
};

const clinicLive: ViewLive = (c, R, x, y, w, h, t, open) => {
  const cx = x + w * 0.5, cy = y + h * 0.34, s = Math.min(w, h) * 0.08;
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#5aff9a', cx, cy, s * 3.5, (0.25 + 0.3 * open) * (t === 0 ? 1 : 0.85 + 0.15 * Math.sin(t * 1.5)));
  c.restore();
  void R;
};

// ── the catalogue ─────────────────────────────────────────────────

/** Every motif's thing: a painting of its own, or the stamp's picture drawn large. */
export const THINGS: Readonly<Record<AnyMotif, Thing>> = {
  cup: { kind: 'object', still: cupStill(true), live: cupLive },
  tea: { kind: 'object', still: cupStill(false), live: cupLive },
  bread: { kind: 'object', still: breadStill, live: breadLive },
  apple: { kind: 'object', still: appleStill, live: appleLive },
  kettle: { kind: 'object', still: kettleStill, live: kettleLive },
  tap: { kind: 'object', still: tapStill, live: tapLive },
  shower: { kind: 'object', still: showerStill, live: showerLive },
  flower: { kind: 'object', still: flowerStill, live: flowerLive },
  music: { kind: 'object', still: musicStill, live: musicLive },
  sweater: { kind: 'object', still: sweaterStill, live: sweaterLive },
  switch: { kind: 'object', still: switchStill, live: switchLive },
  fridge: { kind: 'object', still: fridgeStill, live: fridgeLive },
  book: { kind: 'object', still: bookStill, live: bookLive },
  pet: { kind: 'object', still: petStill, live: petLive },
  phone: { kind: 'object', still: phoneStill, live: phoneLive },
  bed: { kind: 'object', still: bedStill, live: bedLive },
  bird: { kind: 'object', still: birdStill, live: birdLive },
  seed: { kind: 'object', still: seedStill },
  hand: { kind: 'object', still: handStill, live: handLive },
  heart: { kind: 'object', still: heartStill, live: heartLive },
  sky: { kind: 'view', still: skyView, live: skyLive },
  sun: { kind: 'view', still: sunView, live: sunLive },
  rain: { kind: 'view', still: rainView, live: rainLive },
  rainbow: { kind: 'view', still: rainbowView, live: rainbowLive },
  window: { kind: 'view', still: windowViewThing, live: windowLive },
  grass: { kind: 'view', still: grassView, live: grassLive },
  eyes: { kind: 'view', still: eyesView, live: eyesLive },
  feet: { kind: 'view', still: feetView, live: feetLive },
  bus: { kind: 'view', still: busView, live: busLive },
  light: { kind: 'object', still: fromMotif('light') },
  car: { kind: 'view', still: carView, live: carLive },
  queue: { kind: 'object', still: fromMotif('queue') },
  clock: { kind: 'view', still: clockView, live: clockLive },
  spill: { kind: 'object', still: fromMotif('spill') },
  smile: { kind: 'view', still: smileView, live: smileLive },
  letter: { kind: 'object', still: fromMotif('letter') },
  clinic: { kind: 'view', still: clinicView, live: clinicLive },
  desk: { kind: 'object', still: fromMotif('desk') },
  scale: { kind: 'object', still: fromMotif('scale') },
  door: { kind: 'view', still: doorView, live: doorLive },
};

export const thingOf = (m: string | null | undefined): Thing => THINGS[(m ?? '') as AnyMotif] ?? THINGS.sun;

/** The things a place may set down on its spot when it has none of its own (real objects, not symbols or views). */
export const SPOT_OBJECTS: readonly AnyMotif[] = ['cup', 'tea', 'bread', 'apple', 'kettle', 'flower', 'music', 'sweater', 'book', 'phone', 'pet', 'letter'];

/** Draw an object thing standing in the place (units: its foot's centre at x, y; size s), lit by the room. */
export function drawObject(c: Ctx, m: AnyMotif, R: Room, x: number, y: number, s: number, t: number, open = 0.5): void {
  const th = thingOf(m);
  if (th.kind !== 'object') return;
  c.save();
  c.translate(x - s / 2, y - s * 0.94);
  c.scale(s, s);
  th.still(c, R);
  th.live?.(c, R, t, clamp01(open));
  c.restore();
}

/** An object thing's still part only (for a place's baked layer): its foot's centre at x, y; size s. */
export function drawStill(c: Ctx, m: AnyMotif, R: Room, x: number, y: number, s: number): void {
  const th = thingOf(m);
  if (th.kind !== 'object') return;
  c.save();
  c.translate(x - s / 2, y - s * 0.94);
  c.scale(s, s);
  th.still(c, R);
  c.restore();
}

/** An object thing's live part only (over a baked one): the same frame as `drawStill`. */
export function drawAlive(c: Ctx, m: AnyMotif, R: Room, x: number, y: number, s: number, t: number, open = 0.5): void {
  const th = thingOf(m);
  if (th.kind !== 'object' || !th.live || t === 0) return;
  c.save();
  c.translate(x - s / 2, y - s * 0.94);
  c.scale(s, s);
  th.live(c, R, t, clamp01(open));
  c.restore();
}
