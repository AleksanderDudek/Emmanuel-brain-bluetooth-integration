/**
 * Jerzy i smok's v3 figures, in the same illuminated-chronicle palette as paint.ts: the companions
 * (Burek the town dog, Iskierka the hatchling who changed sides — a red bow from Linda on her head —,
 * Kolczak the hedgehog rolling in a ball of spikes, Bartek the beaver with his orange teeth), Bartek's
 * palisade, the caltrops, the thrown hammer, the Golden Dragon's hot coins, and the little pictures of
 * the twelve treasures of the hoard.  All canvas paths, sizes in u times `s` (px per u); feet at (x, y).
 */
import type { CompanionId, TreasureId } from './content';
import { C, SANS, font, glow } from './paint';

const TAU = Math.PI * 2;

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  ctx.fill();
}

export interface PalPose {
  /** +1 facing right, −1 left */
  flip: number;
  /** the walk's phase (rad) and 0..1 walking */
  step: number; walking: number;
  t: number;
  /** a burst of its own doing (0..1): a bark, a bite of fire, a gnaw */
  act: number;
  /** the hedgehog's roll (rad) */
  roll: number;
  /** asleep in a Postój */
  nap: number;
}

/** A companion standing (or hovering, or rolling) with its feet at (x, y). */
export function paintPal(ctx: CanvasRenderingContext2D, id: CompanionId, x: number, y: number, s: number, p: PalPose): void {
  switch (id) {
    case 'pies': paintDog(ctx, x, y, s, p); break;
    case 'iskierka': paintHatchling(ctx, x, y, s, p); break;
    case 'jez': paintHedgehog(ctx, x, y, s, p); break;
    case 'bobr': paintBeaver(ctx, x, y, s, p); break;
  }
}

/** Burek: a tan-and-white town dog with floppy ears and a curled tail that never stops. */
function paintDog(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: PalPose): void {
  ellipse(ctx, x, y, s * 0.36, s * 0.1, 'rgba(20,20,10,.28)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.flip, 1);
  const bob = p.walking * Math.abs(Math.sin(p.step)) * s * 0.04;
  ctx.translate(0, -bob);
  // legs
  ctx.fillStyle = '#9b6d42';
  for (const [lx, ph] of [[-0.22, 0], [-0.12, Math.PI], [0.14, Math.PI], [0.24, 0]] as const) {
    const sw = Math.sin(p.step + ph) * p.walking * s * 0.05;
    ctx.fillRect(s * lx + sw - s * 0.03, -s * 0.2, s * 0.06, s * 0.2);
  }
  // the tail, curled up and wagging
  ctx.strokeStyle = '#b9895a';
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  const wag = Math.sin(p.t * (p.nap > 0.5 ? 2 : 14)) * 0.5;
  ctx.beginPath();
  ctx.moveTo(-s * 0.28, -s * 0.3);
  ctx.quadraticCurveTo(-s * 0.45, -s * (0.5 + 0.05 * wag), -s * (0.32 + 0.06 * wag), -s * 0.56);
  ctx.stroke();
  // the body with a white patch
  ellipse(ctx, 0, -s * 0.3, s * 0.32, s * 0.15, '#b9895a');
  ellipse(ctx, s * 0.06, -s * 0.24, s * 0.16, s * 0.08, '#f4eadb');
  // the head
  const hy = -s * (0.46 + 0.04 * p.act);
  ellipse(ctx, s * 0.3, hy, s * 0.15, s * 0.13, '#c3925f');
  ellipse(ctx, s * 0.42, hy + s * 0.04, s * 0.08, s * 0.06, '#e7d3b6');
  ellipse(ctx, s * 0.49, hy + s * 0.02, s * 0.03, s * 0.025, '#2a1d14');
  // the ear, floppy
  ctx.fillStyle = '#6e4a2c';
  ctx.beginPath();
  ctx.ellipse(s * 0.24, hy - s * 0.02, s * 0.05, s * 0.11, 0.5 + Math.sin(p.t * 9) * 0.1 * p.walking, 0, TAU);
  ctx.fill();
  if (p.nap > 0.5) {
    ctx.strokeStyle = '#2a1d14';
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.arc(s * 0.34, hy - s * 0.03, s * 0.03, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ellipse(ctx, s * 0.35, hy - s * 0.03, s * 0.025, s * 0.03, '#2a1d14');
  }
  // the mouth open for a bark
  if (p.act > 0.05) {
    ctx.fillStyle = '#8a3a32';
    ctx.beginPath();
    ctx.ellipse(s * 0.44, hy + s * 0.09, s * 0.04, s * 0.025 * (1 + p.act), 0, 0, TAU);
    ctx.fill();
  }
  // a red collar
  ctx.fillStyle = C.vermilion;
  ctx.fillRect(s * 0.18, hy + s * 0.06, s * 0.1, s * 0.035);
  ctx.restore();
}

/** Iskierka: a small green hatchling hovering on quick wings, a red bow on her head; her cheeks glow when she eats fire. */
function paintHatchling(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: PalPose): void {
  const hover = s * (0.65 + 0.06 * Math.sin(p.t * 5));
  ellipse(ctx, x, y, s * 0.22, s * 0.07, 'rgba(20,20,10,.22)');
  ctx.save();
  ctx.translate(x, y - hover);
  ctx.scale(p.flip, 1);
  if (p.act > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, s * 0.16, -s * 0.1, s * 0.5, 'rgba(255,160,70,', 0.5 * p.act);
    ctx.restore();
  }
  // wings, flapping fast
  const fl = Math.sin(p.t * 22) * 0.6;
  ctx.fillStyle = '#9fd07e';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, -s * 0.06);
    ctx.lineTo(-s * 0.2, -s * (0.32 + 0.12 * fl * k));
    ctx.lineTo(s * 0.06, -s * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  // tail
  ctx.strokeStyle = '#6fb257';
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.12, 0);
  ctx.quadraticCurveTo(-s * 0.3, s * 0.08, -s * 0.32, -s * 0.06);
  ctx.stroke();
  // body and belly
  ellipse(ctx, 0, 0, s * 0.16, s * 0.13, '#7bc062');
  ellipse(ctx, s * 0.04, s * 0.03, s * 0.09, s * 0.07, '#f1e6a8');
  // head with a big eye, two nubs of horns and Linda's red bow
  ellipse(ctx, s * 0.16, -s * 0.12, s * 0.12, s * 0.1, '#7bc062');
  ellipse(ctx, s * 0.2, -s * 0.14, s * 0.045, s * 0.05, '#fffbe8');
  ellipse(ctx, s * 0.215, -s * 0.135, s * 0.024, s * 0.032, '#1d1410');
  ctx.fillStyle = C.vermilion;
  ctx.beginPath();
  ctx.moveTo(s * 0.12, -s * 0.21);
  ctx.lineTo(s * 0.04, -s * 0.27);
  ctx.lineTo(s * 0.05, -s * 0.17);
  ctx.closePath();
  ctx.moveTo(s * 0.12, -s * 0.21);
  ctx.lineTo(s * 0.2, -s * 0.28);
  ctx.lineTo(s * 0.2, -s * 0.18);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, s * 0.12, -s * 0.21, s * 0.025, s * 0.025, '#ff8a78');
  // the mouth: open and glowing as she eats
  if (p.act > 0.05) {
    ellipse(ctx, s * 0.27, -s * 0.08, s * 0.04, s * 0.02 + s * 0.02 * p.act, '#ffcf7a');
  }
  ctx.restore();
}

/** Kolczak: a hedgehog rolled into a ball of spikes, tumbling round the knight. */
function paintHedgehog(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: PalPose): void {
  const r = s * 0.24;
  ellipse(ctx, x, y, r * 1.05, r * 0.32, 'rgba(20,20,10,.28)');
  ctx.save();
  ctx.translate(x, y - r);
  // motion streaks
  ctx.strokeStyle = 'rgba(255,248,225,.35)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-p.flip * r * (1.2 + i * 0.25), -r * 0.3 + i * r * 0.3);
    ctx.lineTo(-p.flip * r * (1.7 + i * 0.25), -r * 0.3 + i * r * 0.3);
    ctx.stroke();
  }
  ctx.rotate(p.roll);
  ctx.fillStyle = '#5b4632';
  ctx.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU, rr = i % 2 ? r * 1.0 : r * 1.32;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, 0, 0, r * 0.82, r * 0.82, '#7a5f44');
  ellipse(ctx, -r * 0.25, -r * 0.25, r * 0.3, r * 0.22, 'rgba(255,240,210,.25)');
  // the snout and an eye peeking out of the ball
  ellipse(ctx, r * 0.55, r * 0.15, r * 0.2, r * 0.16, '#d9b994');
  ellipse(ctx, r * 0.72, r * 0.12, r * 0.06, r * 0.06, '#2a1d14');
  ellipse(ctx, r * 0.42, -r * 0.02, r * 0.05, r * 0.06, '#2a1d14');
  ctx.restore();
}

/** Bartek: a brown beaver with a flat tail and orange teeth; gnawing, chips fly. */
function paintBeaver(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: PalPose): void {
  ellipse(ctx, x, y, s * 0.34, s * 0.1, 'rgba(20,20,10,.28)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.flip, 1);
  const bob = p.walking * Math.abs(Math.sin(p.step)) * s * 0.03 + p.act * Math.abs(Math.sin(p.t * 30)) * s * 0.02;
  ctx.translate(0, -bob);
  // the paddle tail
  ctx.fillStyle = '#3e2c22';
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -s * 0.06, s * 0.17, s * 0.07, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 0.06 + i * s * 0.03);
    ctx.lineTo(-s * 0.18, -s * 0.06 + i * s * 0.03);
    ctx.stroke();
  }
  // body
  ellipse(ctx, 0, -s * 0.2, s * 0.24, s * 0.18, '#8a5a36');
  ellipse(ctx, s * 0.06, -s * 0.14, s * 0.12, s * 0.09, '#b07a4c');
  // feet
  ctx.fillStyle = '#3e2c22';
  ctx.fillRect(-s * 0.12 + Math.sin(p.step) * p.walking * s * 0.04, -s * 0.04, s * 0.08, s * 0.04);
  ctx.fillRect(s * 0.08 - Math.sin(p.step) * p.walking * s * 0.04, -s * 0.04, s * 0.08, s * 0.04);
  // head
  const hy = -s * 0.36;
  ellipse(ctx, s * 0.2, hy, s * 0.13, s * 0.11, '#8a5a36');
  ellipse(ctx, s * 0.3, hy + s * 0.03, s * 0.07, s * 0.05, '#b07a4c');
  ellipse(ctx, s * 0.34, hy + s * 0.0, s * 0.025, s * 0.02, '#2a1d14');
  ellipse(ctx, s * 0.22, hy - s * 0.04, s * 0.022, s * 0.026, '#2a1d14');
  ellipse(ctx, s * 0.13, hy - s * 0.08, s * 0.03, s * 0.03, '#6e4628');
  // the orange teeth
  ctx.fillStyle = '#f0a040';
  ctx.fillRect(s * 0.3, hy + s * 0.06, s * 0.035, s * 0.05 + p.act * s * 0.01);
  ctx.fillStyle = 'rgba(40,20,10,.6)';
  ctx.fillRect(s * 0.316, hy + s * 0.06, s * 0.004 + 0.6, s * 0.05);
  if (p.nap > 0.5) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = font(700, s * 0.2, SANS);
    ctx.fillText('z', s * 0.32, hy - s * 0.14 - Math.sin(p.t * 2) * s * 0.03);
  }
  ctx.restore();
}

/** Bartek's palisade from (x0, y0) to (x1, y1): logs rising out of the ground (k 0..1 of its life), pointed tops, a rope. */
export function paintWall(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, s: number, age: number, life: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const n = Math.max(3, Math.round(len / (s * 0.22)));
  const rise = Math.min(1, age / 0.35), fade = Math.min(1, (life - age) / 0.5);
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.strokeStyle = 'rgba(20,20,10,.25)';
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0 + s * 0.05);
  ctx.lineTo(x1, y1 + s * 0.05);
  ctx.stroke();
  const h = s * 0.62 * rise;
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    const hh = h * (0.88 + 0.12 * Math.sin(i * 2.3));
    ctx.fillStyle = i % 2 ? '#8a5f3a' : '#9d6e44';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.09, y);
    ctx.lineTo(x - s * 0.09, y - hh);
    ctx.lineTo(x, y - hh - s * 0.1 * rise);
    ctx.lineTo(x + s * 0.09, y - hh);
    ctx.lineTo(x + s * 0.09, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,235,200,.22)';
    ctx.fillRect(x - s * 0.07, y - hh, s * 0.035, hh);
  }
  if (rise > 0.6) {
    ctx.strokeStyle = '#d6c08a';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(x0, y0 - h * 0.6);
    ctx.lineTo(x1, y1 - h * 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

/** A caltrop on the ground: a dark iron star, fading at the end of its life (k 0..1). */
export function paintCaltrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, gold: boolean): void {
  ctx.save();
  ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
  ellipse(ctx, x, y, r * 0.9, r * 0.35, 'rgba(20,20,10,.18)');
  ctx.fillStyle = gold ? '#c9a23c' : '#4a4a55';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.15);
    ctx.lineTo(x + Math.cos(a) * r * 0.45 - Math.sin(a) * r * 0.08, y + Math.sin(a) * r * 0.25);
    ctx.lineTo(x + Math.cos(a) * r * 0.45 + Math.sin(a) * r * 0.08, y + Math.sin(a) * r * 0.25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = gold ? '#ffe7a3' : '#8a8a98';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.5);
  ctx.lineTo(x - r * 0.07, y - r * 0.1);
  ctx.lineTo(x + r * 0.07, y - r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A thrown hammer, spinning (the smith's one glints gold). */
export function paintHammer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, spin: number, evo: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  if (evo) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, 0, s * 0.5, 'rgba(255,214,107,', 0.35);
    ctx.restore();
  }
  ctx.fillStyle = '#7a5434';
  ctx.fillRect(-s * 0.03, -s * 0.05, s * 0.06, s * 0.36);
  ctx.fillStyle = evo ? '#e2b23c' : C.steelDark;
  ctx.fillRect(-s * 0.15, -s * 0.15, s * 0.3, s * 0.13);
  ctx.fillStyle = evo ? '#ffe7a3' : C.steel;
  ctx.fillRect(-s * 0.15, -s * 0.15, s * 0.3, s * 0.04);
  ctx.restore();
}

/** One of the Golden Dragon's hot coins in flight (a glow round it), at height z (px). */
export function paintCoin(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, r: number, t: number): void {
  ellipse(ctx, x, y, r * 0.9, r * 0.3, 'rgba(20,10,0,.22)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - z, r * 2.2, 'rgba(255,170,60,', 0.4);
  ctx.restore();
  const w = Math.abs(Math.cos(t * 9 + x * 0.1));
  ellipse(ctx, x, y - z, r * (0.35 + 0.65 * w), r, '#c8901c');
  ellipse(ctx, x, y - z, r * (0.25 + 0.5 * w), r * 0.75, '#ffd76a');
  ellipse(ctx, x - r * 0.15 * w, y - z - r * 0.25, r * 0.15 * w + 0.5, r * 0.18, '#fff6d0');
}

/** A treasure's little picture (cards, chips, the tally). */
export function paintTreasureIcon(ctx: CanvasRenderingContext2D, id: TreasureId, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ellipse(ctx, 0, 0, r * 1.15, r * 1.15, 'rgba(226,178,60,.3)');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (id) {
    case 'lustro':
      ctx.fillStyle = '#7a5434';
      ctx.fillRect(-r * 0.1, r * 0.2, r * 0.2, r * 0.75);
      ellipse(ctx, 0, -r * 0.2, r * 0.55, r * 0.62, C.gold);
      ellipse(ctx, 0, -r * 0.2, r * 0.42, r * 0.5, '#bfe2ff');
      ellipse(ctx, -r * 0.15, -r * 0.4, r * 0.1, r * 0.18, 'rgba(255,255,255,.85)');
      break;
    case 'dzban':
      ctx.fillStyle = '#b5683c';
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.6);
      ctx.lineTo(r * 0.3, -r * 0.6);
      ctx.quadraticCurveTo(r * 0.7, r * 0.1, r * 0.35, r * 0.75);
      ctx.lineTo(-r * 0.35, r * 0.75);
      ctx.quadraticCurveTo(-r * 0.7, r * 0.1, -r * 0.3, -r * 0.6);
      ctx.fill();
      ellipse(ctx, 0, -r * 0.6, r * 0.32, r * 0.1, '#7fb6e0');
      ellipse(ctx, r * 0.5, -r * 0.85, r * 0.08, r * 0.12, '#7fb6e0');
      break;
    case 'pioro':
      ctx.fillStyle = '#d8c09a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.7);
      ctx.quadraticCurveTo(-r * 0.4, -r * 0.6, r * 0.6, -r * 0.8);
      ctx.quadraticCurveTo(r * 0.3, r * 0.1, -r * 0.6, r * 0.7);
      ctx.fill();
      ctx.strokeStyle = '#7a5434';
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, r * 0.85);
      ctx.lineTo(r * 0.4, -r * 0.55);
      ctx.stroke();
      break;
    case 'klepsydra':
      ctx.fillStyle = '#7a5434';
      ctx.fillRect(-r * 0.55, -r * 0.8, r * 1.1, r * 0.14);
      ctx.fillRect(-r * 0.55, r * 0.66, r * 1.1, r * 0.14);
      ctx.fillStyle = 'rgba(220,240,255,.8)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.66);
      ctx.lineTo(r * 0.4, -r * 0.66);
      ctx.lineTo(0, 0);
      ctx.lineTo(r * 0.4, r * 0.66);
      ctx.lineTo(-r * 0.4, r * 0.66);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8b83c';
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, r * 0.66);
      ctx.lineTo(r * 0.25, r * 0.66);
      ctx.lineTo(0, r * 0.3);
      ctx.closePath();
      ctx.fill();
      break;
    case 'krzesiwo':
      ellipse(ctx, -r * 0.3, r * 0.2, r * 0.4, r * 0.3, '#8a8a98');
      ctx.strokeStyle = C.steel;
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.beginPath();
      ctx.arc(r * 0.3, -r * 0.1, r * 0.35, -0.6, Math.PI + 0.6);
      ctx.stroke();
      ctx.fillStyle = C.fireHot;
      for (let i = 0; i < 3; i++) ellipse(ctx, r * (0.0 + i * 0.12), -r * (0.55 + i * 0.1), r * 0.07, r * 0.07, C.fireHot);
      break;
    case 'mapa':
      ctx.fillStyle = '#efe0b8';
      ctx.fillRect(-r * 0.7, -r * 0.55, r * 1.4, r * 1.1);
      ctx.strokeStyle = 'rgba(122,84,52,.6)';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.setLineDash([r * 0.12, r * 0.1]);
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.3);
      ctx.quadraticCurveTo(-r * 0.1, -r * 0.4, r * 0.3, -r * 0.1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = C.vermilion;
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(r * 0.22, -r * 0.3);
      ctx.lineTo(r * 0.5, 0);
      ctx.moveTo(r * 0.5, -r * 0.3);
      ctx.lineTo(r * 0.22, 0);
      ctx.stroke();
      break;
    case 'podkowa':
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = Math.max(2, r * 0.3);
      ctx.beginPath();
      ctx.arc(0, -r * 0.05, r * 0.5, Math.PI * 0.85, Math.PI * 2.15, false);
      ctx.stroke();
      ctx.fillStyle = '#7a5a1c';
      for (const a of [1.1, 1.5, 1.9]) {
        ellipse(ctx, Math.cos(a * Math.PI) * r * 0.5, -r * 0.05 + Math.sin(a * Math.PI) * r * 0.5, r * 0.05, r * 0.05, '#7a5a1c');
      }
      break;
    case 'oselka':
      ctx.fillStyle = '#9a9aa6';
      ctx.beginPath();
      ctx.roundRect(-r * 0.75, -r * 0.2, r * 1.5, r * 0.4, r * 0.15);
      ctx.fill();
      ctx.strokeStyle = '#fffbe8';
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.55);
      ctx.lineTo(r * 0.6, -r * 0.75);
      ctx.stroke();
      break;
    case 'kowadlo':
      ctx.fillStyle = '#4a4a55';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.35);
      ctx.lineTo(r * 0.6, -r * 0.35);
      ctx.quadraticCurveTo(r * 0.9, -r * 0.3, r * 0.9, -r * 0.15);
      ctx.lineTo(r * 0.3, -r * 0.1);
      ctx.lineTo(r * 0.2, r * 0.35);
      ctx.lineTo(r * 0.45, r * 0.6);
      ctx.lineTo(-r * 0.45, r * 0.6);
      ctx.lineTo(-r * 0.2, r * 0.35);
      ctx.lineTo(-r * 0.3, -r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7d7d8a';
      ctx.fillRect(-r * 0.75, -r * 0.35, r * 1.3, r * 0.08);
      break;
    case 'jablon':
      ctx.strokeStyle = '#6b4a2c';
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.beginPath();
      ctx.moveTo(0, r * 0.8);
      ctx.lineTo(0, -r * 0.1);
      ctx.stroke();
      ellipse(ctx, 0, -r * 0.35, r * 0.6, r * 0.45, '#5f9a4a');
      ellipse(ctx, r * 0.25, -r * 0.2, r * 0.16, r * 0.15, '#d9412f');
      break;
    case 'kompas':
      ellipse(ctx, 0, 0, r * 0.75, r * 0.75, '#efe0b8');
      ctx.strokeStyle = C.goldDeep;
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.75, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = C.vermilion;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.6);
      ctx.lineTo(r * 0.14, 0);
      ctx.lineTo(-r * 0.14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.6);
      ctx.lineTo(r * 0.14, 0);
      ctx.lineTo(-r * 0.14, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case 'ogniwo':
      ctx.strokeStyle = C.steel;
      ctx.lineWidth = Math.max(1.5, r * 0.18);
      for (const [cx, cy] of [[-r * 0.3, -r * 0.2], [r * 0.3, r * 0.2]] as const) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.42, r * 0.28, 0.6, 0, TAU);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}
