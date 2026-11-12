/**
 * Geoda's characters and instruments, drawn with paths only: Bazyl the mole jeweller (thick round
 * glasses, a miner's helmet with a lamp, a waistcoat, a loupe), his speech bubble, the jewels set
 * into cells, the druses the band grows on cleared cells, the shine dial (×1 … ×5, the threshold
 * marked where ×3 begins), the Szlif's stone bowl, the cave behind it all, and the crystal skyline
 * of the band's last 40 s along the geode's foot.
 */
import { fitText } from '../kit/mobile';
import type { TraceBar } from '../kit/trace';
import { hash, mix, rgba, rrect, sparkle, TAU } from './art';
import { JEWELS } from './content';
import { RULES } from './rules';

export const C = {
  night: '#130d1c',
  cave: '#22182e',
  cave2: '#2f2140',
  gold: '#ffd36b',
  goldDeep: '#e7a52f',
  ink: '#fdf6ea',
  inkSoft: 'rgba(253,246,234,.72)',
  rest: '#8fd4ff',
  violet: '#b98cff',
  fur: '#4a3b36',
  furDark: '#2c221f',
  nose: '#f29bb0',
  helmet: '#f2b632',
};

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';

// ── the cave ────────────────────────────────────────────────────

/** The cave behind the geode: deep violet, a warm glow in a push, a cool one in a rest, druses on the walls. */
export function paintCave(ctx: CanvasRenderingContext2D, w: number, h: number, mood: number, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1a1226');
  g.addColorStop(0.6, C.cave);
  g.addColorStop(1, '#100b17');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // the mood: gold (push) or blue (rest) light from below the geode
  if (Math.abs(mood) > 0.01) {
    const warm = mood > 0;
    const k = Math.min(1, Math.abs(mood));
    const r = ctx.createRadialGradient(w / 2, h * 0.62, 0, w / 2, h * 0.62, Math.max(w, h) * 0.7);
    r.addColorStop(0, warm ? `rgba(255,190,90,${(0.16 * k).toFixed(3)})` : `rgba(120,190,255,${(0.14 * k).toFixed(3)})`);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);
  }
  // dust motes drifting in the lamp light
  for (let i = 0; i < 26; i++) {
    const x = (hash(i * 3.1) * w + t * (6 + hash(i) * 10)) % w;
    const y = (hash(i * 7.7) * h - t * (3 + hash(i * 2) * 5) + h * 4) % h;
    ctx.fillStyle = `rgba(255,236,200,${(0.04 + 0.08 * hash(i * 5.3)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + hash(i * 9.1) * 1.4, 0, TAU);
    ctx.fill();
  }
}

// ── jewels and druses ───────────────────────────────────────────

/** A jewel set into a cell (kind 1..4): a faceted round stone with a glint. */
export function paintJewel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, kind: number, t: number): void {
  const j = JEWELS[(kind - 1 + JEWELS.length) % JEWELS.length];
  ctx.save();
  // its glow: a soft halo (a blur per jewel per frame costs a phone too much)
  ctx.fillStyle = rgba(j.color, 0.28);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.32, 0, TAU);
  ctx.fill();
  ctx.fillStyle = j.dark;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    if (i) ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, j.light);
  g.addColorStop(0.55, j.color);
  g.addColorStop(1, j.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const rr = r * 0.86;
    if (i) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  // the table facet
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = Math.max(0.6, r * 0.07);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const rr = r * 0.45;
    if (i) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.stroke();
  const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + cx * 0.07 + cy * 0.05);
  sparkle(ctx, cx - r * 0.32, cy - r * 0.34, r * (0.25 + 0.2 * tw), 'rgba(255,255,255,.9)');
}

/** A druse growing in an empty cell (g 0..1): gold crystal points out of the cell's floor. */
export function paintDruse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, g: number, seed: number, t: number): void {
  if (g <= 0.01) return;
  const n = 3 + Math.floor(hash(seed) * 3);
  const base = y + s * 0.82;
  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.35 + g);
  for (let i = 0; i < n; i++) {
    const bx = x + s * (0.2 + 0.6 * ((i + 0.5) / n) + (hash(seed + i) - 0.5) * 0.1);
    const len = s * (0.25 + 0.5 * g) * (0.6 + 0.5 * hash(seed + i * 3.3));
    const wd = s * 0.07 * (0.7 + g * 0.6);
    const tilt = (hash(seed + i * 1.9) - 0.5) * 0.7;
    const tx = bx + Math.sin(tilt) * len, ty = base - Math.cos(tilt) * len;
    const gr = ctx.createLinearGradient(bx, base, tx, ty);
    gr.addColorStop(0, '#a8641a');
    gr.addColorStop(0.6, C.gold);
    gr.addColorStop(1, '#fff3c4');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(bx - wd, base);
    ctx.lineTo(tx - wd * 0.6, ty + wd * 1.2);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx + wd * 0.6, ty + wd * 1.2);
    ctx.lineTo(bx + wd, base);
    ctx.closePath();
    ctx.fill();
  }
  if (g >= 0.95) sparkle(ctx, x + s * 0.5, y + s * 0.3, s * (0.12 + 0.05 * Math.sin(t * 5 + seed)), '#fff8dc');
  ctx.restore();
}

// ── the shine dial ──────────────────────────────────────────────

const DIAL_A0 = Math.PI * 0.8, DIAL_A1 = Math.PI * 2.2;
export const dialAngle = (v: number): number => DIAL_A0 + (DIAL_A1 - DIAL_A0) * Math.max(0, Math.min(1, v));

export interface DialLook {
  value: number;
  mult: number;
  /** 'live' (the band moves it), 'wait' (the band's delay), 'grey' (no signal), 'dark' (a blind push), 'off' (not a push) */
  state: 'live' | 'wait' | 'grey' | 'dark' | 'off';
  pop: number;
  label: string;
  note: string;
  t: number;
  compact: boolean;
}

/** The dial: five segments ×1…×5 on an arc, the threshold notch where ×3 begins, a needle, the multiplier in its middle. */
export function paintDial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, d: DialLook): void {
  const steps = [0, ...RULES.shineSteps, 1];
  const lw = Math.max(5, r * 0.2);
  const on = d.state === 'live';
  // the plate (dimmed outside a push: the shine waits for the next Blask)
  ctx.save();
  if (d.state === 'off') ctx.globalAlpha = 0.55;
  const plate = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r * 1.25);
  plate.addColorStop(0, '#3b2c4d');
  plate.addColorStop(1, '#1b1424');
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.18, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,200,.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // the segments
  for (let i = 0; i < 5; i++) {
    const a0 = dialAngle(steps[i]) + 0.02, a1 = dialAngle(steps[i + 1]) - 0.02;
    const lit = on && d.mult > i;
    const gold = i >= 2;
    ctx.lineCap = 'butt';
    if (lit && gold) {
      // the glow: a wide translucent stroke under the segment (no blur per frame)
      ctx.strokeStyle = 'rgba(255,200,90,.28)';
      ctx.lineWidth = lw * 1.9;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();
    }
    ctx.strokeStyle = lit ? (gold ? mix('#ffd36b', '#fff1c2', (i - 2) / 2) : '#b98cff') : d.state === 'dark' ? 'rgba(80,70,100,.5)' : 'rgba(255,255,255,.12)';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();
  }
  // the threshold notch (×3 begins here: the gauge's middle)
  const ta = dialAngle(0.5);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(ta) * (r - lw * 0.9), cy + Math.sin(ta) * (r - lw * 0.9));
  ctx.lineTo(cx + Math.cos(ta) * (r + lw * 0.9), cy + Math.sin(ta) * (r + lw * 0.9));
  ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  const tx = cx + Math.cos(ta) * (r + lw * 1.25), ty = cy + Math.sin(ta) * (r + lw * 1.25);
  ctx.moveTo(tx, ty - lw * 0.1);
  ctx.lineTo(tx - lw * 0.45, ty - lw * 0.75);
  ctx.lineTo(tx + lw * 0.45, ty - lw * 0.75);
  ctx.closePath();
  ctx.fill();
  // the segment numbers at 13 px or more, on a dial big enough for them (the colours and the ×N say it on a
  // small one)
  if (!d.compact && r >= 44) {
    ctx.font = `700 ${Math.max(13, Math.round(r * 0.15))}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 5; i++) {
      const a = dialAngle((steps[i] + steps[i + 1]) / 2);
      ctx.fillStyle = on && d.mult > i ? '#1b1424' : 'rgba(255,255,255,.35)';
      ctx.fillText(`${i + 1}`, cx + Math.cos(a) * r, cy + Math.sin(a) * r + 0.5);
    }
  }
  // the needle
  if (d.state !== 'dark' && d.state !== 'off') {
    const a = dialAngle(d.value);
    ctx.strokeStyle = d.state === 'live' ? '#fff8e6' : 'rgba(255,255,255,.4)';
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.35);
    ctx.lineTo(cx + Math.cos(a) * (r + lw * 0.35), cy + Math.sin(a) * (r + lw * 0.35));
    ctx.stroke();
  }
  // the multiplier in the middle
  const k = 1 + 0.35 * d.pop;
  const txt = d.state === 'dark' ? '?' : `×${d.mult}`;
  ctx.font = `800 ${Math.round(Math.max(15, r * (d.compact ? 0.62 : 0.5)) * k)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const gold = d.state === 'live' && d.mult >= 3;
  if (gold) {
    // its glow: a pulsing warm disc behind it (no blur per frame)
    ctx.fillStyle = `rgba(255,200,90,${(0.12 + 0.08 * Math.sin(d.t * 6)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(cx, cy + (d.compact ? r * 0.08 : 0), r * 0.62, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = gold ? C.gold : d.state === 'dark' ? '#8d7fb0' : C.ink;
  ctx.fillText(txt, cx, cy + (d.compact ? r * 0.08 : 0));
  if (!d.compact) {
    ctx.font = `700 ${Math.max(13, Math.round(r * 0.17))}px ${SANS}`;
    ctx.fillStyle = C.inkSoft;
    ctx.fillText(d.label.toUpperCase(), cx, cy + r * 0.5);
    if (d.note) {
      // the note where it fits on one line at 13 px (the runner's panel says the signal's state too)
      ctx.fillStyle = 'rgba(253,246,234,.72)';
      const note = fitText(ctx, d.note, r * 2.8, Math.max(13, Math.round(r * 0.15)), 500, SANS, 13);
      if (!note.endsWith('…') || d.note.endsWith('…')) ctx.fillText(note, cx, cy + r * 1.42);
    }
  }
  ctx.restore();
}

/**
 * The shine as a column of five steps for a small phone's margin: ×1 at the foot, ×5 at the top, gold from ×3 with
 * the threshold's notch under it, the level as a bright bar across, the multiplier in big type over it.
 */
export function paintShineColumn(ctx: CanvasRenderingContext2D, b: { x: number; y: number; w: number; h: number }, d: DialLook): void {
  const steps = [0, ...RULES.shineSteps, 1];
  const on = d.state === 'live';
  ctx.save();
  if (d.state === 'off') ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgba(20,14,28,.62)';
  rrect(ctx, b.x, b.y, b.w, b.h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,200,.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // the multiplier on top
  const head = Math.min(40, b.h * 0.2);
  const k = 1 + 0.3 * d.pop;
  const gold = on && d.mult >= 3;
  ctx.font = `800 ${Math.round(Math.max(15, Math.min(19, b.w * 0.44)) * k)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = gold ? C.gold : d.state === 'dark' ? '#8d7fb0' : C.ink;
  ctx.fillText(d.state === 'dark' ? '?' : `×${d.mult}`, b.x + b.w / 2, b.y + head / 2 + 2);
  // the five steps, ×1 at the foot
  const top = b.y + head + 4, bottom = b.y + b.h - 8, gap = 4;
  const sh = (bottom - top - 4 * gap) / 5, sw = b.w * 0.52, sx = b.x + (b.w - sw) / 2;
  const yOf = (i: number) => bottom - (i + 1) * sh - i * gap;
  for (let i = 0; i < 5; i++) {
    const lit = on && d.mult > i, g = i >= 2;
    if (lit && g) {
      ctx.fillStyle = 'rgba(255,200,90,.22)';
      rrect(ctx, sx - 3, yOf(i) - 3, sw + 6, sh + 6, 5);
      ctx.fill();
    }
    ctx.fillStyle = lit ? (g ? mix('#ffd36b', '#fff1c2', (i - 2) / 2) : '#b98cff') : d.state === 'dark' ? 'rgba(80,70,100,.5)' : 'rgba(255,255,255,.12)';
    rrect(ctx, sx, yOf(i), sw, sh, 3);
    ctx.fill();
  }
  // the threshold: where ×3 begins
  ctx.fillStyle = C.gold;
  ctx.fillRect(b.x + 5, yOf(1) - gap / 2 - 1, b.w - 10, 2);
  // the level: a bright bar at its height along the steps
  if (d.state !== 'dark' && d.state !== 'off') {
    const v = Math.max(0, Math.min(1, d.value));
    let i = 0;
    while (i < 4 && v >= steps[i + 1]) i++;
    const f = (v - steps[i]) / Math.max(1e-6, steps[i + 1] - steps[i]);
    const y = bottom - i * (sh + gap) - f * sh;
    ctx.fillStyle = on ? '#fff8e6' : 'rgba(255,255,255,.4)';
    rrect(ctx, b.x + 4, y - 1.5, b.w - 8, 3, 1.5);
    ctx.fill();
  }
  ctx.restore();
}

// ── the bowl ────────────────────────────────────────────────────

/** The Szlif's stone bowl (centre-bottom at cx, by), `s` wide; `polish` 0..1 rings it. */
export function paintBowl(ctx: CanvasRenderingContext2D, cx: number, by: number, s: number, polish: number, active: boolean, t: number): void {
  ctx.save();
  // the polish ring
  if (active) {
    ctx.strokeStyle = 'rgba(143,212,255,.25)';
    ctx.lineWidth = Math.max(3, s * 0.04);
    ctx.beginPath();
    ctx.arc(cx, by - s * 0.42, s * 0.5, 0, TAU);
    ctx.stroke();
    const end = -Math.PI / 2 + TAU * Math.max(0.001, polish);
    ctx.strokeStyle = 'rgba(143,212,255,.3)';
    ctx.lineWidth = Math.max(6, s * 0.09);
    ctx.beginPath();
    ctx.arc(cx, by - s * 0.42, s * 0.5, -Math.PI / 2, end);
    ctx.stroke();
    ctx.strokeStyle = polish >= 1 ? C.gold : C.rest;
    ctx.lineWidth = Math.max(3, s * 0.04);
    ctx.beginPath();
    ctx.arc(cx, by - s * 0.42, s * 0.5, -Math.PI / 2, end);
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(cx, by - s * 0.3, cx, by);
  g.addColorStop(0, '#6f6258');
  g.addColorStop(1, '#3a312b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, by - s * 0.24);
  ctx.quadraticCurveTo(cx - s * 0.4, by, cx, by);
  ctx.quadraticCurveTo(cx + s * 0.4, by, cx + s * 0.42, by - s * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a221d';
  ctx.beginPath();
  ctx.ellipse(cx, by - s * 0.24, s * 0.42, s * 0.07, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,220,.12)';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.16, by - s * 0.12, s * 0.08, s * 0.035, -0.3, 0, TAU);
  ctx.fill();
  if (active) {
    // a polishing cloth circling over the gem
    const a = t * 3.2;
    ctx.fillStyle = 'rgba(240,230,255,.55)';
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * s * 0.16, by - s * 0.45 + Math.sin(a) * s * 0.06, s * 0.1, s * 0.05, a * 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ── Bazyl ───────────────────────────────────────────────────────

export interface MolePose {
  t: number;
  /** 0..1: a cheer (a hop, paws up), an oops (shrinks, glasses slide), talking */
  cheer: number;
  oops: number;
  talk: boolean;
  /** the lamp's beam 0..1 (brighter with the shine) */
  lamp: number;
  /** -1 faces left, 1 faces right */
  face: number;
}

/** Bazyl standing at (x, y = his feet), `s` tall. */
export function paintMole(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: MolePose): void {
  const bob = Math.sin(p.t * 2.2) * s * 0.012 - p.cheer * s * 0.12 * Math.abs(Math.sin(p.t * 9));
  const squash = 1 - p.oops * 0.08;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(p.face, squash);
  const u = s / 100;
  // the lamp's beam
  if (p.lamp > 0.02) {
    const beam = ctx.createLinearGradient(8 * u, -88 * u, 90 * u, -60 * u);
    beam.addColorStop(0, `rgba(255,236,170,${(0.35 * p.lamp).toFixed(3)})`);
    beam.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(10 * u, -86 * u);
    ctx.lineTo(95 * u, -105 * u);
    ctx.lineTo(95 * u, -45 * u);
    ctx.closePath();
    ctx.fill();
  }
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30 * u, 6 * u, 0, 0, TAU);
  ctx.fill();
  // feet
  ctx.fillStyle = C.nose;
  for (const fx of [-14, 14]) {
    ctx.beginPath();
    ctx.ellipse(fx * u, -3 * u, 10 * u, 5 * u, 0, 0, TAU);
    ctx.fill();
  }
  // body (a pear of velvet fur) and the waistcoat
  const body = ctx.createRadialGradient(-8 * u, -50 * u, 6 * u, 0, -36 * u, 46 * u);
  body.addColorStop(0, '#6a5750');
  body.addColorStop(1, C.furDark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -34 * u, 30 * u, 34 * u, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7a3b52';
  ctx.beginPath();
  ctx.moveTo(-24 * u, -40 * u);
  ctx.quadraticCurveTo(0, -24 * u, 24 * u, -40 * u);
  ctx.lineTo(22 * u, -12 * u);
  ctx.quadraticCurveTo(0, 0, -22 * u, -12 * u);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.gold;
  for (const by of [-30, -20]) {
    ctx.beginPath();
    ctx.arc(0, by * u, 1.8 * u, 0, TAU);
    ctx.fill();
  }
  // arms: paws up in a cheer, else one holds a loupe
  const up = p.cheer;
  ctx.strokeStyle = C.fur;
  ctx.lineWidth = 9 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-24 * u, -40 * u);
  ctx.lineTo(-34 * u, (-26 - 34 * up) * u);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(24 * u, -40 * u);
  ctx.lineTo(36 * u, (-30 - 30 * up) * u);
  ctx.stroke();
  ctx.fillStyle = C.nose;
  ctx.beginPath();
  ctx.arc(-34 * u, (-26 - 34 * up) * u, 5.5 * u, 0, TAU);
  ctx.arc(36 * u, (-30 - 30 * up) * u, 5.5 * u, 0, TAU);
  ctx.fill();
  if (up < 0.3) {
    // the loupe
    ctx.strokeStyle = '#c9a25a';
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.arc(42 * u, -40 * u, 7 * u, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,240,255,.35)';
    ctx.fill();
  }
  // head
  const hy = -70 * u;
  const head = ctx.createRadialGradient(-6 * u, hy - 8 * u, 4 * u, 0, hy, 28 * u);
  head.addColorStop(0, '#6f5c55');
  head.addColorStop(1, C.fur);
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.ellipse(2 * u, hy, 25 * u, 22 * u, 0, 0, TAU);
  ctx.fill();
  // snout and the pink nose
  ctx.fillStyle = '#7d6a62';
  ctx.beginPath();
  ctx.ellipse(20 * u, hy + 6 * u, 12 * u, 8 * u, 0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.nose;
  ctx.beginPath();
  ctx.ellipse(31 * u, hy + 4 * u, 6 * u, 5 * u, 0, 0, TAU);
  ctx.fill();
  // whiskers
  ctx.strokeStyle = 'rgba(255,240,230,.5)';
  ctx.lineWidth = 0.9 * u;
  for (const k of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(26 * u, hy + 8 * u);
    ctx.lineTo(44 * u, hy + (8 + k * 5) * u);
    ctx.stroke();
  }
  // the mouth (talking: it opens and closes)
  const open = p.talk ? Math.max(0, Math.sin(p.t * 16)) * 3 * u : 0;
  ctx.fillStyle = '#3a1f26';
  ctx.beginPath();
  ctx.ellipse(18 * u, hy + 14 * u, 5 * u, 1.2 * u + open, 0, 0, TAU);
  ctx.fill();
  // the glasses: two big round lenses, a little crooked after an oops
  const slide = p.oops * 4 * u;
  ctx.save();
  ctx.translate(0, slide);
  ctx.rotate(p.oops * 0.12);
  for (const gx of [0, 15]) {
    ctx.fillStyle = 'rgba(210,235,255,.28)';
    ctx.strokeStyle = '#1c1416';
    ctx.lineWidth = 2.6 * u;
    ctx.beginPath();
    ctx.arc(gx * u, hy - 4 * u, 8.5 * u, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // tiny eyes behind thick lenses (they blink)
    const blink = (p.t % 4.3) < 0.12 ? 0.15 : 1;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse((gx + 1.5) * u, hy - 3 * u, 1.8 * u, 1.8 * u * blink, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.arc(gx * u, hy - 4 * u, 6 * u, -2.6, -1.9);
    ctx.stroke();
  }
  ctx.strokeStyle = '#1c1416';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(8.5 * u, hy - 5 * u);
  ctx.lineTo(6.5 * u, hy - 5 * u);
  ctx.stroke();
  ctx.restore();
  // the helmet and its lamp
  ctx.fillStyle = C.helmet;
  ctx.beginPath();
  ctx.ellipse(0, hy - 14 * u, 25 * u, 14 * u, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#d8971f';
  ctx.fillRect(-27 * u, hy - 15 * u, 54 * u, 4 * u);
  ctx.fillStyle = '#3a3030';
  ctx.beginPath();
  ctx.arc(8 * u, hy - 22 * u, 6 * u, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p.lamp > 0.02 ? '#fff4c8' : '#a99a7a';
  ctx.beginPath();
  ctx.arc(10 * u, hy - 22 * u, 4 * u, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * A speech bubble with a tail toward (tx, ty); the text wrapped into `maxW`.  `y` is the bubble's lower edge (it
 * stands above its speaker), or with `below` its upper edge (it hangs under a speaker in the strip above).
 */
export function paintBubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, tx: number, ty: number, alpha: number, size: number, below = false, right = false): { w: number; h: number } {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `600 ${size}px ${SANS}`;
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const nx = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(nx).width > maxW - 20) {
      lines.push(line);
      line = w;
    } else line = nx;
  }
  if (line) lines.push(line);
  const lh = Math.round(size * 1.28);
  const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 22);
  const bh = lines.length * lh + 14;
  // (`right`: the box ends at the right edge of its room, under or over a speaker who stands at that end)
  const bx = right ? x + maxW - bw : x, by = below ? y : y - bh;
  // a soft shadow: the same shape, offset and dark (no blur per frame)
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  rrect(ctx, bx + 1, by + 4, bw, bh, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,248,236,.97)';
  rrect(ctx, bx, by, bw, bh, 12);
  ctx.fill();
  // the tail
  const cx = Math.max(bx + 14, Math.min(bx + bw - 14, tx));
  const edge = below ? by + 1 : by + bh - 1;
  ctx.beginPath();
  ctx.moveTo(cx - 7, edge);
  ctx.lineTo(tx, ty);
  ctx.lineTo(cx + 7, edge);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a1d33';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + 11, by + 7 + i * lh));
  ctx.restore();
  return { w: bw, h: bh };
}

// ── the band's last 40 s along the geode's foot ─────────────────

/** A row of crystal points, one per bar: its height the level, gold above the threshold, blue in rest, dotted without signal, dark while veiled. */
export function paintSkyline(ctx: CanvasRenderingContext2D, bars: readonly TraceBar[], x: number, y: number, w: number, h: number): void {
  const n = bars.length;
  if (!n) return;
  const bw = w / n;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const cx = x + (i + 0.5) * bw;
    if (b.empty) continue;
    if (!b.reliable) {
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(cx - 0.75, y - 1.5, 1.5, 1.5);
      continue;
    }
    if (b.shown < 1) {
      ctx.fillStyle = `rgba(90,80,110,${(0.6 * (1 - b.shown)).toFixed(3)})`;
      ctx.fillRect(cx - bw * 0.3, y - h * 0.35, bw * 0.6, h * 0.35);
      if (b.shown <= 0) continue;
    }
    const lh = h * (0.15 + 0.85 * Math.max(0, Math.min(1, b.level)));
    const col = b.phase === 'rest' ? C.rest : b.above ? C.gold : C.violet;
    ctx.globalAlpha = b.shown * (b.above ? 1 : 0.75);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.36, y);
    ctx.lineTo(cx - bw * 0.2, y - lh * 0.82);
    ctx.lineTo(cx, y - lh);
    ctx.lineTo(cx + bw * 0.2, y - lh * 0.82);
    ctx.lineTo(cx + bw * 0.36, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // the threshold line
  ctx.strokeStyle = 'rgba(255,211,107,.45)';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - h * (0.15 + 0.85 * 0.5));
  ctx.lineTo(x + w, y - h * (0.15 + 0.85 * 0.5));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
