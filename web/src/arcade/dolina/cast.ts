/**
 * Dolina's version-3 pictures (paint.ts and sprites.ts keep the rest): the six companions — Głaz the
 * gentle giant with his mallet, Babcia under her black umbrella, Bóbr in his hard hat with a plank,
 * the Zegarmistrz with his pocket watch, Kozica the chamois, Wiewiórka with her acorn — with the ring
 * of their power's charge; the cage of smoke a companion waits in; the smoke curtain; a bridge's
 * planks; a swinging clock weight; the clock tower's interior with its great clock; the umbrella over
 * the pilgrim; a chest; the gear's little pictures; and Kukułka, the cuckoo clock that keeps the
 * tower's floors.  All canvas paths, no images; sizes in u times `S` (px per u); y grows downward.
 * Shadows stay ink and smoke with ember eyes; nothing here is gore.
 */
import type { CompId, GearSlot } from './content';
import { C, TAU, glow, hash, numberPlate, paintEyes, type GuardPose } from './paint';

/** The tiers' colours (copper … radiance), for gear and its plaques. */
export const TIER_COLOR: readonly string[] = ['#6a6070', '#c47a4a', '#c99a5a', '#cfd6e0', '#f5c35a', '#f0e6ff', '#fff6c8'];

/** A companion's pose this frame: the run cycle, the clock, an action's progress (0 none … 1), gold blows, facing, airborne, asleep. */
export interface MatePose { run: number; t: number; act: number; gold: boolean; air: boolean; sleep: boolean }

/** How tall each companion stands (u): the view uses it for their rings and bubbles. */
export const MATE_H: Readonly<Record<CompId, number>> = { glaz: 1.5, babcia: 0.95, bobr: 0.72, zegar: 1.05, kozica: 0.85, wiewiorka: 0.55 };

const outline = (ctx: CanvasRenderingContext2D, S: number) => {
  ctx.strokeStyle = 'rgba(24,16,22,.55)';
  ctx.lineWidth = Math.max(1, S * 0.03);
};

/** One companion, feet at (x, y), facing right. */
export function paintMate(ctx: CanvasRenderingContext2D, id: CompId, x: number, y: number, S: number, p: MatePose): void {
  ctx.save();
  ctx.translate(x, y);
  const bob = p.air || p.sleep ? 0 : Math.abs(Math.sin(p.run)) * S * 0.04;
  ctx.translate(0, -bob);
  if (p.gold) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -S * MATE_H[id] * 0.5, S * MATE_H[id] * 0.9, 'rgba(255,214,120,', 0.22);
    ctx.restore();
  }
  switch (id) {
    case 'glaz': glaz(ctx, S, p); break;
    case 'babcia': babcia(ctx, S, p); break;
    case 'bobr': bobr(ctx, S, p); break;
    case 'zegar': zegar(ctx, S, p); break;
    case 'kozica': kozica(ctx, S, p); break;
    case 'wiewiorka': wiewiorka(ctx, S, p); break;
  }
  ctx.restore();
}

/** Two legs that run (a stride by the run phase). */
function legs(ctx: CanvasRenderingContext2D, S: number, p: MatePose, hip: number, len: number, color: string, w: number, dx = 0): void {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = S * w;
  for (const ph of [0, Math.PI]) {
    const fx = p.air ? S * 0.08 : Math.sin(p.run + ph) * S * len * 0.45;
    const fy = p.air ? -S * len * 0.25 : -Math.max(0, Math.cos(p.run + ph)) * S * len * 0.18;
    ctx.beginPath();
    ctx.moveTo(dx, -S * hip);
    ctx.lineTo(dx + fx, fy);
    ctx.stroke();
  }
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sleep: boolean): void {
  ctx.fillStyle = '#1e1622';
  if (sleep) {
    ctx.fillRect(x - r, y, r * 2, Math.max(1, r * 0.4));
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + r * 0.3, y - r * 0.35, r * 0.35, 0, TAU);
  ctx.fill();
}

// Głaz: a gentle giant in a patched tunic and a woolly cap, a wooden mallet on his shoulder; worried brows
function glaz(ctx: CanvasRenderingContext2D, S: number, p: MatePose): void {
  legs(ctx, S, p, 0.5, 0.5, '#4a3a30', 0.2);
  // the body: a big rounded sack of a tunic
  ctx.fillStyle = '#7d6a58';
  ctx.beginPath();
  ctx.ellipse(0, -S * 0.86, S * 0.42, S * 0.45, 0, 0, TAU);
  ctx.fill();
  outline(ctx, S);
  ctx.stroke();
  ctx.fillStyle = '#9a8670';
  ctx.fillRect(-S * 0.12, -S * 0.92, S * 0.16, S * 0.14);   // a patch
  ctx.fillStyle = '#5b4a3c';
  ctx.fillRect(-S * 0.42, -S * 0.62, S * 0.84, S * 0.07);   // a rope belt
  // the head, small on the big body, the cap
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(S * 0.12, -S * 1.36, S * 0.17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b5523a';
  ctx.beginPath();
  ctx.ellipse(S * 0.1, -S * 1.47, S * 0.19, S * 0.11, 0, Math.PI, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(S * 0.1, -S * 1.6, S * 0.05, 0, TAU);
  ctx.fill();
  eye(ctx, S * 0.2, -S * 1.37, S * 0.03, p.sleep);
  // worried brows
  ctx.strokeStyle = '#3a2a22';
  ctx.lineWidth = Math.max(1, S * 0.025);
  ctx.beginPath();
  ctx.moveTo(S * 0.14, -S * 1.43);
  ctx.lineTo(S * 0.24, -S * 1.46);
  ctx.stroke();
  // the arm and the mallet: on the shoulder, or brought down in a Huk
  const swing = p.act > 0 ? Math.sin(Math.min(1, p.act) * Math.PI) : 0;
  ctx.save();
  ctx.translate(S * 0.18, -S * 1.1);
  ctx.rotate(-1.1 + swing * 2.4);
  ctx.strokeStyle = '#6a4a30';
  ctx.lineWidth = S * 0.07;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -S * 0.75);
  ctx.stroke();
  ctx.fillStyle = '#8a5a36';
  ctx.beginPath();
  ctx.roundRect(-S * 0.2, -S * 1.0, S * 0.4, S * 0.28, S * 0.06);
  ctx.fill();
  outline(ctx, S);
  ctx.stroke();
  ctx.restore();
  // the big hand on the handle
  ctx.fillStyle = C.skinShade;
  ctx.beginPath();
  ctx.arc(S * 0.24, -S * 1.06, S * 0.09, 0, TAU);
  ctx.fill();
}

// Babcia: a small round grandmother in a red-dotted headscarf, black skirt and apron, her big black umbrella as a cane
function babcia(ctx: CanvasRenderingContext2D, S: number, p: MatePose): void {
  legs(ctx, S, p, 0.22, 0.24, '#2a2228', 0.08);
  ctx.fillStyle = '#2a2430';
  ctx.beginPath();
  ctx.moveTo(-S * 0.26, -S * 0.12);
  ctx.quadraticCurveTo(-S * 0.3, -S * 0.62, 0, -S * 0.66);
  ctx.quadraticCurveTo(S * 0.3, -S * 0.62, S * 0.26, -S * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e9e0cc';   // the apron
  ctx.fillRect(-S * 0.02, -S * 0.5, S * 0.2, S * 0.36);
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(S * 0.04, -S * 0.76, S * 0.13, 0, TAU);
  ctx.fill();
  // the headscarf with white dots
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-S * 0.15, -S * 0.7);
  ctx.quadraticCurveTo(-S * 0.12, -S * 0.98, S * 0.05, -S * 0.95);
  ctx.quadraticCurveTo(S * 0.2, -S * 0.9, S * 0.16, -S * 0.74);
  ctx.lineTo(S * 0.05, -S * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (const [dx, dy] of [[-0.05, -0.88], [0.06, -0.9], [-0.1, -0.78]]) {
    ctx.beginPath();
    ctx.arc(dx * S, dy * S, S * 0.018, 0, TAU);
    ctx.fill();
  }
  // round glasses that glint
  ctx.strokeStyle = '#8a7a6a';
  ctx.lineWidth = Math.max(1, S * 0.02);
  ctx.beginPath();
  ctx.arc(S * 0.11, -S * 0.77, S * 0.04, 0, TAU);
  ctx.stroke();
  eye(ctx, S * 0.11, -S * 0.77, S * 0.016, p.sleep);
  // the umbrella: a cane while closed, raised high on a power
  const up = p.act > 0 ? Math.min(1, p.act * 3) : 0;
  ctx.save();
  ctx.translate(S * 0.24, -S * 0.4);
  ctx.rotate(-0.15 - up * 0.2);
  ctx.strokeStyle = '#1a1420';
  ctx.lineWidth = S * 0.035;
  ctx.beginPath();
  ctx.moveTo(0, S * 0.38);
  ctx.lineTo(0, -S * 0.42 - up * S * 0.3);
  ctx.stroke();
  ctx.strokeStyle = '#8a5a36';
  ctx.beginPath();
  ctx.arc(-S * 0.05, S * 0.38, S * 0.05, 0, Math.PI);
  ctx.stroke();
  if (up > 0.2) {
    ctx.fillStyle = '#1e1826';
    ctx.beginPath();
    ctx.arc(0, -S * 0.72, S * 0.38 * up, Math.PI, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = '#1e1826';
    ctx.beginPath();
    ctx.moveTo(-S * 0.05, -S * 0.1);
    ctx.lineTo(0, -S * 0.45);
    ctx.lineTo(S * 0.05, -S * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Bóbr: an upright beaver in a yellow hard hat, a plank under his arm, a flat tail, big orange teeth
function bobr(ctx: CanvasRenderingContext2D, S: number, p: MatePose): void {
  // the flat tail behind
  ctx.fillStyle = '#5a3a26';
  ctx.beginPath();
  ctx.ellipse(-S * 0.3, -S * 0.08, S * 0.22, S * 0.08, -0.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,18,10,.5)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-S * (0.42 - i * 0.06), -S * 0.12);
    ctx.lineTo(-S * (0.22 - i * 0.06), -S * 0.04);
    ctx.stroke();
  }
  legs(ctx, S, p, 0.16, 0.18, '#4a2e1c', 0.08);
  ctx.fillStyle = '#8a5a36';
  ctx.beginPath();
  ctx.ellipse(0, -S * 0.36, S * 0.2, S * 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b07a4e';
  ctx.beginPath();
  ctx.ellipse(S * 0.05, -S * 0.32, S * 0.1, S * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8a5a36';
  ctx.beginPath();
  ctx.arc(S * 0.08, -S * 0.58, S * 0.13, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e8963a';   // the teeth
  ctx.fillRect(S * 0.15, -S * 0.54, S * 0.06, S * 0.07);
  ctx.fillStyle = '#3a2418';
  ctx.beginPath();
  ctx.arc(S * 0.2, -S * 0.6, S * 0.025, 0, TAU);
  ctx.fill();
  eye(ctx, S * 0.12, -S * 0.63, S * 0.022, p.sleep);
  // the hard hat
  ctx.fillStyle = '#f5c22a';
  ctx.beginPath();
  ctx.ellipse(S * 0.07, -S * 0.68, S * 0.14, S * 0.09, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillRect(-S * 0.08, -S * 0.69, S * 0.3, S * 0.03);
  // the plank under his arm (a hammer on a Rusztowanie)
  ctx.save();
  ctx.translate(S * 0.02, -S * 0.36);
  ctx.rotate(p.act > 0 ? -0.6 + Math.sin(p.act * 18) * 0.4 : 0.2);
  ctx.fillStyle = '#c49a6c';
  ctx.fillRect(-S * 0.28, -S * 0.04, S * 0.56, S * 0.08);
  ctx.strokeStyle = 'rgba(60,36,20,.6)';
  ctx.strokeRect(-S * 0.28, -S * 0.04, S * 0.56, S * 0.08);
  ctx.restore();
}

// the Zegarmistrz: a thin old man in a waistcoat and a tall hat, a white moustache, his pocket watch held out on its chain
function zegar(ctx: CanvasRenderingContext2D, S: number, p: MatePose): void {
  legs(ctx, S, p, 0.42, 0.42, '#2a2a36', 0.07);
  ctx.fillStyle = '#3a3a52';   // the coat
  ctx.beginPath();
  ctx.moveTo(-S * 0.14, -S * 0.42);
  ctx.lineTo(-S * 0.18, -S * 0.82);
  ctx.quadraticCurveTo(0, -S * 0.9, S * 0.16, -S * 0.82);
  ctx.lineTo(S * 0.14, -S * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a3a3a';   // the waistcoat
  ctx.fillRect(-S * 0.02, -S * 0.8, S * 0.13, S * 0.34);
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(S * 0.03, -S * 0.94, S * 0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2f0ea';   // the moustache
  ctx.beginPath();
  ctx.ellipse(S * 0.1, -S * 0.9, S * 0.06, S * 0.02, 0.2, 0, TAU);
  ctx.fill();
  eye(ctx, S * 0.08, -S * 0.96, S * 0.018, p.sleep);
  ctx.strokeStyle = '#e0b85a';   // the monocle
  ctx.lineWidth = Math.max(1, S * 0.015);
  ctx.beginPath();
  ctx.arc(S * 0.08, -S * 0.96, S * 0.035, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#1e1e2a';   // the tall hat
  ctx.fillRect(-S * 0.06, -S * 1.2, S * 0.17, S * 0.2);
  ctx.fillRect(-S * 0.11, -S * 1.02, S * 0.27, S * 0.03);
  // the watch on its chain, held up and glowing on a Pauza
  const hold = p.act > 0 ? 1 : 0.4;
  const wx = S * 0.26, wy = -S * (0.62 + 0.18 * hold) + Math.sin(p.t * 3) * S * 0.02;
  ctx.strokeStyle = '#c99a3a';
  ctx.beginPath();
  ctx.moveTo(S * 0.1, -S * 0.66);
  ctx.lineTo(wx, wy - S * 0.06);
  ctx.stroke();
  if (p.act > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, wx, wy, S * 0.4, 'rgba(160,210,255,', 0.6);
    ctx.restore();
  }
  ctx.fillStyle = '#e8c070';
  ctx.beginPath();
  ctx.arc(wx, wy, S * 0.07, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fffbe8';
  ctx.beginPath();
  ctx.arc(wx, wy, S * 0.05, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#2a2a36';
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(wx + Math.cos(p.t) * S * 0.035, wy + Math.sin(p.t) * S * 0.035);
  ctx.stroke();
}

// Kozica: a chamois on four legs, tan with the black-and-white face stripes and short hooked horns
function kozica(ctx: CanvasRenderingContext2D, S: number, p: MatePose): void {
  ctx.strokeStyle = '#3a2a20';
  ctx.lineCap = 'round';
  ctx.lineWidth = S * 0.06;
  for (const [hx, ph] of [[-0.24, 0], [-0.16, Math.PI], [0.16, Math.PI * 0.5], [0.24, Math.PI * 1.5]] as const) {
    const fx = p.air ? 0 : Math.sin(p.run + ph) * S * 0.12;
    ctx.beginPath();
    ctx.moveTo(hx * S, -S * 0.36);
    ctx.lineTo(hx * S + fx, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#a07048';
  ctx.beginPath();
  ctx.ellipse(0, -S * 0.46, S * 0.32, S * 0.15, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5a3a24';   // the dark back stripe
  ctx.fillRect(-S * 0.3, -S * 0.6, S * 0.56, S * 0.04);
  // the neck and head, lowered on a Szarża
  const dip = p.act > 0 ? 0.25 : 0;
  ctx.save();
  ctx.translate(S * 0.26, -S * 0.52);
  ctx.rotate(-0.5 + dip * 2);
  ctx.fillStyle = '#a07048';
  ctx.fillRect(-S * 0.05, -S * 0.22, S * 0.11, S * 0.24);
  ctx.translate(S * 0.04, -S * 0.26);
  ctx.fillStyle = '#efe6d6';
  ctx.beginPath();
  ctx.ellipse(S * 0.05, 0, S * 0.11, S * 0.08, 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1e1622';   // the face stripe
  ctx.fillRect(-S * 0.02, -S * 0.02, S * 0.13, S * 0.03);
  eye(ctx, S * 0.05, -S * 0.02, S * 0.018, p.sleep);
  ctx.strokeStyle = '#1e1622';   // the hooked horns
  ctx.lineWidth = S * 0.035;
  ctx.beginPath();
  ctx.moveTo(-S * 0.02, -S * 0.07);
  ctx.quadraticCurveTo(-S * 0.04, -S * 0.22, -S * 0.12, -S * 0.2);
  ctx.moveTo(S * 0.03, -S * 0.07);
  ctx.quadraticCurveTo(S * 0.02, -S * 0.22, -S * 0.06, -S * 0.21);
  ctx.stroke();
  ctx.restore();
  // a tuft of a tail
  ctx.fillStyle = '#3a2a20';
  ctx.beginPath();
  ctx.ellipse(-S * 0.33, -S * 0.52, S * 0.05, S * 0.03, -0.6, 0, TAU);
  ctx.fill();
}

// Wiewiórka: a red squirrel with a huge bushy tail and ear tufts, an acorn in her paws
function wiewiorka(ctx: CanvasRenderingContext2D, S: number, p: MatePose): void {
  const wag = Math.sin(p.t * 6) * 0.15;
  ctx.save();
  ctx.translate(-S * 0.12, -S * 0.12);
  ctx.rotate(-0.4 + wag);
  ctx.fillStyle = '#c4622a';
  ctx.beginPath();
  ctx.ellipse(-S * 0.08, -S * 0.2, S * 0.13, S * 0.26, -0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e08a4a';
  ctx.beginPath();
  ctx.ellipse(-S * 0.06, -S * 0.22, S * 0.06, S * 0.18, -0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  legs(ctx, S, p, 0.12, 0.12, '#8a3e1a', 0.05);
  ctx.fillStyle = '#c4622a';
  ctx.beginPath();
  ctx.ellipse(S * 0.03, -S * 0.22, S * 0.1, S * 0.13, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2dcc0';
  ctx.beginPath();
  ctx.ellipse(S * 0.07, -S * 0.2, S * 0.05, S * 0.09, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c4622a';
  ctx.beginPath();
  ctx.arc(S * 0.09, -S * 0.38, S * 0.08, 0, TAU);
  ctx.fill();
  ctx.beginPath();   // the ear tuft
  ctx.moveTo(S * 0.04, -S * 0.43);
  ctx.lineTo(S * 0.03, -S * 0.54);
  ctx.lineTo(S * 0.09, -S * 0.45);
  ctx.closePath();
  ctx.fill();
  eye(ctx, S * 0.12, -S * 0.39, S * 0.018, p.sleep);
  // the acorn (pebbles fly on a Zapasy)
  ctx.fillStyle = '#8a5a2a';
  ctx.beginPath();
  ctx.ellipse(S * 0.15, -S * 0.24, S * 0.035, S * 0.045, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(S * 0.11, -S * 0.3, S * 0.08, S * 0.025);
}

/** The ring of a companion's power charge over their head: gold when the light is above the threshold; ready pulses. */
export function paintChargeRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, charge: number, gold: boolean, t: number): void {
  const ready = charge >= 0.999;
  ctx.lineWidth = Math.max(2, r * 0.32);
  ctx.strokeStyle = 'rgba(20,15,26,.55)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = ready ? '#fff1c4' : gold ? '#ffd36b' : 'rgba(255,236,190,.85)';
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.02, Math.min(1, charge)));
  ctx.stroke();
  if (ready) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r * 2.6, 'rgba(255,220,140,', 0.35 + 0.2 * Math.sin(t * 8));
    ctx.restore();
  }
}

// ── the cage, the curtain, the bridge, the weight ─────────────────
/** A cage of smoke with a companion's silhouette inside, its number on the lintel. */
export function paintCage(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, S: number, p: { id: CompId; hp: number; lit: boolean; hit: number; t: number; key: number }): void {
  // the one waiting inside: dim, eyes bright
  ctx.save();
  ctx.globalAlpha = 0.55;
  paintMate(ctx, p.id, x + w * 0.5, y - S * 0.05, S, { run: 0, t: p.t, act: 0, gold: false, air: false, sleep: false });
  ctx.restore();
  const jig = p.hit > 0 ? Math.sin(p.t * 90) * S * 0.05 : 0;
  ctx.save();
  ctx.translate(jig, 0);
  ctx.fillStyle = p.hit > 0 ? '#e8dcc8' : C.ink;
  const bars = 6;
  for (let i = 0; i < bars; i++) ctx.fillRect(x + (i + 0.5) * (w / bars) - S * 0.05, y - h, S * 0.1, h);
  ctx.fillRect(x - S * 0.08, y - h, w + S * 0.16, S * 0.16);
  ctx.fillRect(x - S * 0.08, y - S * 0.14, w + S * 0.16, S * 0.14);
  // smoke curling up from the top, and ember eyes in the lintel
  for (let i = 0; i < 5; i++) {
    const k = (p.t * 0.4 + i / 5 + hash(p.key + i)) % 1;
    ctx.fillStyle = `rgba(18,14,26,${0.45 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x + w * (0.1 + 0.2 * i) + Math.sin(k * 6 + i) * S * 0.12, y - h - k * S * 0.9, S * (0.08 + 0.14 * k), 0, TAU);
    ctx.fill();
  }
  paintEyes(ctx, x + w * 0.5, y - h + S * 0.08, S * 0.045, p.t, p.key, 0);
  numberPlate(ctx, p.lit ? String(Math.max(1, Math.ceil(p.hp))) : '?', x + w / 2, y - h - Math.max(S * 0.34, 13), Math.max(15, S * 0.36), p.lit ? '#fff1c4' : 'rgba(255,241,196,.55)');
  ctx.restore();
}

/** A curtain of smoke hung across the road: folds that drift, embers in it; its number glows red-gold. */
export function paintCurtain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, S: number, p: { hp: number; max: number; lit: boolean; hit: number; t: number; key: number }): void {
  const a = 0.55 + 0.45 * Math.max(0, p.hp) / Math.max(1, p.max);
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const k = i / 6;
    const sway = Math.sin(p.t * 1.6 + i * 1.3 + p.key) * S * 0.08;
    ctx.fillStyle = `rgba(${22 + i * 3},${16 + i * 2},${30 + i * 3},${0.75 * a})`;
    ctx.beginPath();
    ctx.ellipse(x + w * (0.15 + 0.7 * hash(p.key * 3 + i)) + sway, y - h * k, w * 0.55, h * 0.2, 0, 0, TAU);
    ctx.fill();
  }
  if (p.hit > 0) {
    ctx.fillStyle = `rgba(255,236,200,${0.4 * p.hit})`;
    ctx.fillRect(x - w * 0.2, y - h, w * 1.4, h);
  }
  for (let i = 0; i < 5; i++) {
    const k = (p.t * 0.6 + i / 5 + hash(p.key + i * 9)) % 1;
    ctx.fillStyle = `rgba(255,140,60,${0.7 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x + w * hash(p.key + i * 5), y - h * k, S * 0.03, 0, TAU);
    ctx.fill();
  }
  numberPlate(ctx, p.lit ? String(Math.max(1, Math.ceil(p.hp))) : '?', x + w / 2, y - h * 0.55, Math.max(14, S * 0.34), p.lit ? '#ffcf8a' : 'rgba(255,207,138,.55)');
  ctx.restore();
}

/** A bridge's plank (px), trembling as it gives (`k` 0..1 since trodden; −1 untouched), with its rope rail. */
export function paintPlank(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, S: number, k: number, t: number): void {
  const shake = k >= 0 ? Math.sin(t * 70 + x0) * S * 0.025 * (0.3 + k) : 0;
  ctx.fillStyle = k >= 0 ? '#8a6038' : '#9a6e44';
  ctx.fillRect(x0, top + shake, x1 - x0, S * 0.16);
  ctx.fillStyle = 'rgba(255,220,170,.25)';
  ctx.fillRect(x0, top + shake, x1 - x0, Math.max(1, S * 0.03));
  ctx.strokeStyle = 'rgba(40,24,14,.6)';
  ctx.lineWidth = Math.max(1, S * 0.02);
  ctx.strokeRect(x0 + 0.5, top + shake + 0.5, x1 - x0 - 1, S * 0.16 - 1);
  if (k > 0.4) {
    ctx.strokeStyle = 'rgba(30,18,10,.8)';
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * 0.4, top + shake);
    ctx.lineTo(x0 + (x1 - x0) * 0.55, top + shake + S * 0.16);
    ctx.stroke();
  }
  // the rope rail
  ctx.strokeStyle = 'rgba(200,170,120,.55)';
  ctx.beginPath();
  ctx.moveTo(x0, top - S * 0.55);
  ctx.quadraticCurveTo((x0 + x1) / 2, top - S * 0.48, x1, top - S * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0, top - S * 0.55);
  ctx.lineTo(x0, top);
  ctx.stroke();
}

/** A falling plank (its centre px, turning). */
export function paintFallingPlank(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, rot: number, a: number): void {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#8a6038';
  ctx.fillRect(-S * 0.26, -S * 0.08, S * 0.52, S * 0.16);
  ctx.restore();
}

/** A clock weight swinging on its chain from a beam: the beam at (bx, by), the weight's centre at (wx, wy). */
export function paintPendulum(ctx: CanvasRenderingContext2D, bx: number, by: number, wx: number, wy: number, S: number, r: number, hit: number): void {
  ctx.fillStyle = '#3a2c26';
  ctx.fillRect(bx - S * 0.7, by - S * 0.12, S * 1.4, S * 0.18);
  ctx.strokeStyle = '#9a8a70';
  ctx.lineWidth = Math.max(1.5, S * 0.05);
  ctx.setLineDash([S * 0.08, S * 0.05]);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(wx, wy - r);
  ctx.stroke();
  ctx.setLineDash([]);
  // the brass weight: a long cylinder with a cap
  const g = ctx.createLinearGradient(wx - r, 0, wx + r, 0);
  g.addColorStop(0, '#8a6a2a');
  g.addColorStop(0.45, hit > 0 ? '#fff1c4' : '#f0c868');
  g.addColorStop(1, '#7a5a20');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(wx - r * 0.75, wy - r * 1.15, r * 1.5, r * 2.3, r * 0.4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,10,.6)';
  ctx.lineWidth = Math.max(1, S * 0.025);
  ctx.stroke();
  ctx.fillStyle = '#5a4018';
  ctx.fillRect(wx - r * 0.8, wy - r * 1.2, r * 1.6, r * 0.25);
}

// ── the clock tower ───────────────────────────────────────────────
/** A clock face at (x, y), radius r, its hands at `minutes` after midnight (0..360). */
export function paintClock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, minutes: number, t: number, a = 1): void {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#5a4430';
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#3a2c20';
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * TAU;
    const rr = r * (i % 3 === 0 ? 0.78 : 0.84);
    ctx.beginPath();
    ctx.arc(x + Math.sin(ang) * rr, y - Math.cos(ang) * rr, r * (i % 3 === 0 ? 0.06 : 0.035), 0, TAU);
    ctx.fill();
  }
  // the dawn's mark at six: a little sun
  ctx.fillStyle = '#f5b04a';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.6, r * 0.09, 0, TAU);
  ctx.fill();
  const hour = (minutes / 720) * TAU, min = ((minutes % 60) / 60) * TAU;
  ctx.strokeStyle = '#2a2018';
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.09;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(hour) * r * 0.48, y - Math.cos(hour) * r * 0.48);
  ctx.stroke();
  ctx.lineWidth = r * 0.055;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(min) * r * 0.72, y - Math.cos(min) * r * 0.72);
  ctx.stroke();
  ctx.fillStyle = '#c98a24';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.07, 0, TAU);
  ctx.fill();
  void t;
  ctx.restore();
}

/**
 * The clock tower's inside, behind the play (it scrolls slowly): a stone wall in candlelight with
 * arched windows on the night valley, turning gears, and the great clock with its hands at the
 * floor's time.
 */
export function paintTowerBack(ctx: CanvasRenderingContext2D, w: number, h: number, floorY: number, S: number, scroll: number, t: number, minutes: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1b1522');
  g.addColorStop(0.55, '#2c2230');
  g.addColorStop(1, '#3a2a2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // the wall's stone courses
  const cw = S * 1.4, ch = S * 0.6;
  const off = ((scroll * 0.35) % cw + cw) % cw;
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = 1;
  for (let row = 0, y = floorY % ch; y < h; row++, y += ch) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    for (let x = -off + (row % 2) * cw * 0.5; x < w; x += cw) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + ch);
      ctx.stroke();
    }
  }
  // arched windows on the night outside (every ~7 u, scrolling with the wall)
  const span = S * 7;
  const woff = ((scroll * 0.35) % span + span) % span;
  for (let x = -woff + span * 0.5; x < w + span; x += span) {
    const ww = S * 1.3, wh = S * 2.2, wy = floorY - S * 4.1;
    ctx.fillStyle = '#0e1426';
    ctx.beginPath();
    ctx.moveTo(x - ww / 2, wy + wh);
    ctx.lineTo(x - ww / 2, wy + ww / 2);
    ctx.arc(x, wy + ww / 2, ww / 2, Math.PI, 0);
    ctx.lineTo(x + ww / 2, wy + wh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff6dc';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - ww * 0.35 + hash(i + Math.round(x / span)) * ww * 0.7, wy + ww * 0.3 + hash(i * 7) * wh * 0.5, 1.5, 1.5);
    ctx.fillStyle = '#1a2236';
    ctx.beginPath();
    ctx.moveTo(x - ww / 2, wy + wh);
    ctx.lineTo(x - ww * 0.1, wy + wh * 0.72);
    ctx.lineTo(x + ww * 0.2, wy + wh * 0.82);
    ctx.lineTo(x + ww / 2, wy + wh * 0.7);
    ctx.lineTo(x + ww / 2, wy + wh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a4430';
    ctx.lineWidth = Math.max(2, S * 0.08);
    ctx.stroke();
  }
  // gears turning, slow, on the wall
  for (let i = 0; i < 2; i++) {
    const gx = (i === 0 ? w * 0.12 : w * 0.86) - ((scroll * 0.2) % (w * 1.2)) * 0, gy = floorY - S * (i === 0 ? 5.2 : 2.4);
    gear(ctx, gx, gy, S * (i === 0 ? 0.9 : 0.6), t * (i === 0 ? 0.3 : -0.45), 'rgba(160,120,70,.35)');
  }
  // the great clock, high on the back wall
  const r = Math.min(S * 1.5, h * 0.12);
  const cx = w * 0.6, cy = Math.max(r + 8, floorY - S * 5.6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, cx, cy, r * 2.2, 'rgba(255,210,140,', 0.12);
  ctx.restore();
  paintClock(ctx, cx, cy, r, minutes, t, 0.92);
  // candlelight from below
  const cl = ctx.createRadialGradient(w * 0.35, floorY, 0, w * 0.35, floorY, w * 0.6);
  cl.addColorStop(0, 'rgba(255,170,90,.12)');
  cl.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = cl;
  ctx.fillRect(0, 0, w, h);
}

function gear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const rr = i % 2 ? r : r * 0.82;
    if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(20,14,20,.6)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ── the umbrella, the chest, the gear ─────────────────────────────
/** Babcia's umbrella held over the pilgrim (a black dome with a rim of light), hits left as ribs that glow. */
export function paintUmbrella(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number, hits: number): void {
  const cy = y - S * 1.55, r = S * 0.72;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, cy + r * 0.3, r * 1.5, 'rgba(255,230,180,', 0.16 + 0.04 * Math.sin(t * 5));
  ctx.restore();
  ctx.fillStyle = 'rgba(26,20,34,.92)';
  ctx.beginPath();
  ctx.arc(x, cy, r, Math.PI, TAU);
  ctx.quadraticCurveTo(x + r * 0.5, cy + r * 0.16, x, cy);
  ctx.quadraticCurveTo(x - r * 0.5, cy + r * 0.16, x - r, cy);
  ctx.fill();
  ctx.strokeStyle = hits > 1 ? '#ffd36b' : 'rgba(255,236,190,.8)';
  ctx.lineWidth = Math.max(1.5, S * 0.04);
  ctx.beginPath();
  ctx.arc(x, cy, r, Math.PI, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#1a1420';
  ctx.lineWidth = Math.max(1.5, S * 0.04);
  ctx.beginPath();
  ctx.moveTo(x, cy - r);
  ctx.lineTo(x, cy + S * 0.5);
  ctx.stroke();
}

/**
 * Babcia's umbrella held ready (Parasol armed, between its moments): a small umbrella bobbing over his
 * shoulder, one per hit it will take — so the shield reads without a canopy over his head all the time.
 */
export function paintUmbrellaBadge(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number, hits: number): void {
  for (let i = 0; i < Math.min(2, hits); i++) {
    const r = S * (0.22 - i * 0.04);
    const cx = x - S * (0.26 + i * 0.34), cy = y - S * (1.78 - i * 0.1) + Math.sin(t * 3 + i) * S * 0.04;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.35);
    ctx.fillStyle = 'rgba(26,20,34,.95)';
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, TAU);
    ctx.quadraticCurveTo(r * 0.5, r * 0.18, 0, 0);
    ctx.quadraticCurveTo(-r * 0.5, r * 0.18, -r, 0);
    ctx.fill();
    ctx.strokeStyle = '#ffd36b';
    ctx.lineWidth = Math.max(1.5, S * 0.04);
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#1a1420';
    ctx.lineWidth = Math.max(1.5, S * 0.035);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r * 0.9);
    ctx.arc(-r * 0.18, r * 0.9, r * 0.18, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

/** A chest (closed or open with light), centred at (x, y), size s. */
export function paintChest(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, open: number): void {
  if (open > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y - s * 0.3, s * 1.6, 'rgba(255,214,120,', 0.5 * open);
    ctx.restore();
  }
  ctx.fillStyle = '#7a4a2a';
  ctx.fillRect(x - s * 0.6, y - s * 0.3, s * 1.2, s * 0.62);
  ctx.fillStyle = '#c98a24';
  ctx.fillRect(x - s * 0.6, y - s * 0.06, s * 1.2, s * 0.1);
  ctx.fillRect(x - s * 0.08, y - s * 0.12, s * 0.16, s * 0.22);
  ctx.save();
  ctx.translate(x - s * 0.6, y - s * 0.3);
  ctx.rotate(-open * 0.9);
  ctx.fillStyle = '#8a5a34';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 0.18);
  ctx.quadraticCurveTo(s * 0.6, -s * 0.5, s * 1.2, -s * 0.18);
  ctx.lineTo(s * 1.2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c98a24';
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.stroke();
  ctx.restore();
}

/** A gear slot's little picture at (x, y), radius r, in its tier's colour (0: an empty outline). */
export function paintGearIcon(ctx: CanvasRenderingContext2D, slot: GearSlot, x: number, y: number, r: number, tier: number): void {
  const col = TIER_COLOR[Math.max(0, Math.min(6, tier))];
  ctx.fillStyle = '#2a2440';
  ctx.beginPath();
  ctx.arc(x, y, r * 1.2, 0, TAU);
  ctx.fill();
  if (tier > 0) {
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = tier > 0 ? 1 : 0.35;
  ctx.fillStyle = tier > 0 ? col : '#8a8494';
  switch (slot) {
    case 'blade':
      ctx.rotate(-0.75);
      ctx.fillRect(-r * 0.09, -r * 0.85, r * 0.18, r * 1.2);
      ctx.fillStyle = '#c98a24';
      ctx.fillRect(-r * 0.32, r * 0.32, r * 0.64, r * 0.1);
      break;
    case 'cloak':
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.7);
      ctx.lineTo(r * 0.3, -r * 0.7);
      ctx.lineTo(r * 0.6, r * 0.7);
      ctx.lineTo(-r * 0.6, r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'sandals':
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, r * 0.3, r * 0.45, r * 0.18, -0.1, 0, TAU);
      ctx.fill();
      ctx.fillRect(-r * 0.45, -r * 0.2, r * 0.12, r * 0.45);
      ctx.fillRect(-r * 0.1, -r * 0.1, r * 0.12, r * 0.35);
      break;
    case 'lamp':
      ctx.beginPath();
      ctx.ellipse(0, r * 0.2, r * 0.6, r * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffd36b';
      ctx.beginPath();
      ctx.ellipse(r * 0.45, -r * 0.2, r * 0.14, r * 0.3, 0.2, 0, TAU);
      ctx.fill();
      break;
  }
  ctx.restore();
}

// ── Kukułka, the tower's keeper ───────────────────────────────────
/**
 * A cuckoo clock of shadow, about 3.4 u tall, its front at x: a carved house with a pitched roof, a
 * dial whose hands are the tells (the minute hand raised for a high sweep, the hour hand low for a
 * roll), the long weights below (a wall), and the little door that opens on the weak point: the cuckoo.
 */
export function paintKukulka(ctx: CanvasRenderingContext2D, x: number, floorY: number, S: number, p: GuardPose): { weak: { x: number; y: number } } {
  const a = 1 - p.fade;
  const cx = x + S * 1.15;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  const fill = p.hit > 0 ? '#f6eedc' : C.ink;
  // the weights and their chains, swinging on a wall tell
  const swing = p.tele === 'wall' || p.tele === 'pair' ? Math.sin(p.t * 9) * S * 0.25 * p.teleK : 0;
  ctx.strokeStyle = 'rgba(255,170,90,.3)';
  ctx.lineWidth = Math.max(1, S * 0.03);
  for (const dx of [-0.35, 0.35]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * S, floorY - S * 1.6);
    ctx.lineTo(cx + dx * S + swing, floorY - S * 0.5);
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fillRect(cx + dx * S + swing - S * 0.1, floorY - S * 0.6, S * 0.2, S * 0.5);
  }
  // the house
  ctx.fillStyle = fill;
  ctx.fillRect(cx - S * 0.85, floorY - S * 3.0, S * 1.7, S * 1.45);
  ctx.beginPath();
  ctx.moveTo(cx - S * 1.15, floorY - S * 2.95);
  ctx.lineTo(cx, floorY - S * 3.75);
  ctx.lineTo(cx + S * 1.15, floorY - S * 2.95);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,90,.35)';
  ctx.lineWidth = Math.max(1, S * 0.04);
  ctx.stroke();
  // the little door under the roof: shut, or open with the cuckoo out (the weak point)
  const dy = floorY - S * 3.2;
  if (p.open) {
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(cx - S * 0.22, dy - S * 0.22, S * 0.44, S * 0.4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, cx, dy, S * 0.8, 'rgba(255,211,107,', 0.7);
    ctx.restore();
    ctx.fillStyle = '#f0e6d0';   // the cuckoo, cream and round, beak out
    ctx.beginPath();
    ctx.ellipse(cx + S * 0.18, dy - S * 0.02, S * 0.2, S * 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f5b04a';
    ctx.beginPath();
    ctx.moveTo(cx + S * 0.36, dy - S * 0.04);
    ctx.lineTo(cx + S * 0.5, dy);
    ctx.lineTo(cx + S * 0.36, dy + S * 0.03);
    ctx.fill();
    ctx.fillStyle = '#1e1622';
    ctx.beginPath();
    ctx.arc(cx + S * 0.26, dy - S * 0.06, S * 0.03, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,170,90,.45)';
    ctx.strokeRect(cx - S * 0.2, dy - S * 0.2, S * 0.4, S * 0.36);
    paintEyes(ctx, cx, dy - S * 0.02, S * 0.05, p.t, 13, 0);
  }
  // the dial: its hands are the tells
  const r = S * 0.55, dcy = floorY - S * 2.2;
  ctx.fillStyle = 'rgba(40,30,44,.95)';
  ctx.beginPath();
  ctx.arc(cx, dcy, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,120,.5)';
  ctx.stroke();
  const minuteUp = p.tele === 'high' ? p.teleK : 0, hourDown = p.tele === 'roll' ? p.teleK : 0;
  ctx.strokeStyle = minuteUp > 0.6 ? '#fff1c4' : '#d8b080';
  ctx.lineCap = 'round';
  ctx.lineWidth = S * 0.06;
  const ma = -Math.PI / 2 - 0.6 + minuteUp * 0.6 + Math.sin(p.t * 2) * 0.1;
  ctx.beginPath();
  ctx.moveTo(cx, dcy);
  ctx.lineTo(cx + Math.cos(ma) * r * 0.85, dcy + Math.sin(ma) * r * 0.85);
  ctx.stroke();
  ctx.strokeStyle = hourDown > 0.6 ? '#fff1c4' : '#d8b080';
  ctx.lineWidth = S * 0.08;
  const ha = Math.PI / 2 - 0.9 + hourDown * 0.9;
  ctx.beginPath();
  ctx.moveTo(cx, dcy);
  ctx.lineTo(cx + Math.cos(ha) * r * 0.6, dcy + Math.sin(ha) * r * 0.6);
  ctx.stroke();
  if (p.angry && p.fade <= 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, cx, floorY - S * 2.2, S * 2.4, 'rgba(255,90,40,', 0.12 + 0.06 * Math.sin(p.t * 6));
    ctx.restore();
  }
  ctx.restore();
  return { weak: { x: cx + S * 0.18, y: dy } };
}
