/**
 * Chleby i ryby's v3 cast, in the same warm gouache as paint.ts: the breads (a bun, a barley cake,
 * a flatbread, a big round loaf, a golden loaf, a warm one from the oven), the four new champions
 * seen from behind as they walk up the hill (the donkey with his panniers, the bread cart pulled by
 * two loaves, the giant loaf with its crackling crust, the camel with his packs), the three new
 * gluttons facing down the hill (Zenek the goat, Klara the heron in the brook, the cormorant
 * brothers) and their telegraphs (the dust line, the ripples, the darkening shadow), the lane's
 * elements (pebble arrows, the brook and its stepping stones, a boulder, the jar gate), the help
 * button with its charge ring, the cards' little pictures and the village's buildings.  All canvas
 * paths, no images; `s` = px per u at that depth, (x, y) where the feet touch the grass.
 */
import type { CardId, MistrzId, PomocId, Rarity } from './cards';
import type { Look } from './field';
import type { Building } from './meta';
import { C, SANS, font, glow, paintBasket, paintFish, paintGull, paintLoaf } from './paint';

const TAU = Math.PI * 2;

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.22): void {
  ctx.fillStyle = `rgba(30,40,20,${a})`;
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
}

/** A number over a sprite (its worth, a pouch, a burst), outlined so it reads over anything. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill = '#fff3c0', stroke = 'rgba(70,40,5,.85)'): void {
  ctx.font = font(900, Math.max(9, size), SANS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, size * 0.22);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export const RARITY_COLOR: Readonly<Record<Rarity, string>> = { common: '#c9b48a', rare: '#6f9ad8', epic: '#b07ad8', legend: '#f0b93a' };

// ── the breads ─────────────────────────────────────────────────────
/** The body of a small runner by its look (a loaf, a bun, a cake, a flatbread, a round loaf, a fish, a golden loaf). */
export function paintBread(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look, wiggle = 0): void {
  if (r < 0.6) return;
  switch (look) {
    case 'fish': paintFish(ctx, x, y, r * 0.95, wiggle * 0.6); return;
    case 'bochenek': paintLoaf(ctx, x, y, r); return;
    case 'bulka': {
      // a small round bun, glossy, with a split across the top
      ctx.fillStyle = '#b8742f';
      ellipse(ctx, x, y + r * 0.12, r * 0.86, r * 0.7);
      ctx.fill();
      ctx.fillStyle = '#d7944a';
      ellipse(ctx, x, y, r * 0.8, r * 0.64);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,.75)';
      ellipse(ctx, x - r * 0.25, y - r * 0.25, r * 0.28, r * 0.16, -0.4);
      ctx.fill();
      if (r > 2.5) {
        ctx.strokeStyle = '#7a4a18';
        ctx.lineWidth = Math.max(0.7, r * 0.11);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.4, y - r * 0.05);
        ctx.quadraticCurveTo(x, y - r * 0.35, x + r * 0.4, y - r * 0.05);
        ctx.stroke();
      }
      return;
    }
    case 'placek': {
      // a flat round barley cake, dotted with grain
      ctx.fillStyle = '#a8763a';
      ellipse(ctx, x, y + r * 0.1, r * 1.15, r * 0.5);
      ctx.fill();
      ctx.fillStyle = '#d6aa62';
      ellipse(ctx, x, y, r * 1.1, r * 0.44);
      ctx.fill();
      if (r > 2.5) {
        ctx.fillStyle = '#8f5f26';
        for (let i = 0; i < 7; i++) {
          const a = i * 2.4;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * r * 0.6 * ((i % 3) / 3 + 0.4), y + Math.sin(a) * r * 0.22, Math.max(0.5, r * 0.07), 0, TAU);
          ctx.fill();
        }
      }
      return;
    }
    case 'podplomyk': {
      // a thin flatbread with wavy edges and charred spots
      ctx.fillStyle = '#e5c487';
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * TAU, k = 1 + 0.08 * Math.sin(i * 2.7);
        ctx.lineTo(x + Math.cos(a) * r * 1.2 * k, y + Math.sin(a) * r * 0.32 * k);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(110,60,20,.55)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x + (i - 1.5) * r * 0.45, y + ((i % 2) - 0.5) * r * 0.12, Math.max(0.5, r * 0.1), 0, TAU);
        ctx.fill();
      }
      return;
    }
    case 'bochen': {
      // a big round loaf with a cross cut
      ctx.fillStyle = '#8e5822';
      ellipse(ctx, x, y + r * 0.2, r * 1.2, r * 0.95);
      ctx.fill();
      ctx.fillStyle = '#b97935';
      ellipse(ctx, x, y, r * 1.15, r * 0.9);
      ctx.fill();
      ctx.fillStyle = '#e1b06a';
      ellipse(ctx, x - r * 0.3, y - r * 0.35, r * 0.55, r * 0.32);
      ctx.fill();
      if (r > 2) {
        ctx.strokeStyle = '#6e4114';
        ctx.lineWidth = Math.max(0.8, r * 0.13);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.55, y - r * 0.15);
        ctx.lineTo(x + r * 0.55, y - r * 0.15);
        ctx.moveTo(x, y - r * 0.6);
        ctx.lineTo(x, y + r * 0.3);
        ctx.stroke();
      }
      return;
    }
    case 'gold': {
      paintLoaf(ctx, x, y, r * 1.1);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,200,40,.6)';
      ellipse(ctx, x, y, r * 1.2, r * 0.9);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fffbe0';
      ctx.beginPath();
      ctx.arc(x + r * 0.55, y - r * 0.55, Math.max(0.6, r * 0.18), 0, TAU);
      ctx.fill();
      return;
    }
  }
}

/** The steam over a warm loaf from the oven. */
export function paintSteam(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  if (r < 2) return;
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = Math.max(0.8, r * 0.12);
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i += 2) {
    const k = (t * 1.5 + i * 0.3) % 1;
    ctx.globalAlpha = 0.6 * (1 - k);
    ctx.beginPath();
    ctx.moveTo(x + i * r * 0.3, y - r * 0.6 - k * r);
    ctx.quadraticCurveTo(x + i * r * 0.55, y - r * 0.9 - k * r * 1.4, x + i * r * 0.3, y - r * 1.3 - k * r * 1.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── the champions ──────────────────────────────────────────────────
/** The donkey from behind, trotting up the hill: grey coat, long ears, panniers of bread, a swishing tail. */
export function paintDonkey(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { step: number; t: number; worth: number }): void {
  const r = s * 0.95;
  if (r < 2) return;
  shadow(ctx, x, y, r * 0.9, r * 0.25);
  const bob = Math.abs(Math.sin(o.step)) * r * 0.06;
  // legs (four, trotting in pairs)
  ctx.strokeStyle = '#6d6a66';
  ctx.lineWidth = Math.max(1.5, r * 0.13);
  ctx.lineCap = 'round';
  const k = Math.sin(o.step) * r * 0.1;
  ctx.beginPath();
  for (const [lx, ph] of [[-0.35, 1], [0.35, -1], [-0.18, -1], [0.18, 1]] as const) {
    ctx.moveTo(x + lx * r, y - r * 0.55 - bob);
    ctx.lineTo(x + lx * r + ph * k * 0.4, y - Math.max(0, ph * k));
  }
  ctx.stroke();
  // the body, the rump toward us
  ctx.fillStyle = '#8d8a85';
  ellipse(ctx, x, y - r * 0.85 - bob, r * 0.55, r * 0.5);
  ctx.fill();
  ctx.fillStyle = '#a6a39d';
  ellipse(ctx, x - r * 0.08, y - r * 0.95 - bob, r * 0.38, r * 0.32);
  ctx.fill();
  // the panniers: two baskets of loaves
  for (const side of [-1, 1]) {
    paintBasket(ctx, x + side * r * 0.62, y - r * 0.82 - bob, r * 0.36, { fill: 0.9 });
  }
  // the neck and head beyond, the long ears up
  ctx.fillStyle = '#7e7b77';
  ellipse(ctx, x, y - r * 1.42 - bob, r * 0.24, r * 0.28);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#7e7b77';
    ellipse(ctx, x + side * r * 0.16, y - r * 1.82 - bob, r * 0.08, r * 0.3, side * 0.25);
    ctx.fill();
    ctx.fillStyle = '#d9b9a8';
    ellipse(ctx, x + side * r * 0.16, y - r * 1.8 - bob, r * 0.04, r * 0.2, side * 0.25);
    ctx.fill();
  }
  // the tail, swishing
  ctx.strokeStyle = '#5d5a56';
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.7 - bob);
  ctx.quadraticCurveTo(x + Math.sin(o.t * 5) * r * 0.25, y - r * 0.45, x + Math.sin(o.t * 5 + 1) * r * 0.2, y - r * 0.3);
  ctx.stroke();
  if (o.worth > 0) label(ctx, String(o.worth), x, y - r * 2.15 - bob, r * 0.62);
}

/** The bread cart from behind: a box of loaves on two spoked wheels, pulled by two loaves on legs. */
export function paintCart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { step: number; t: number; worth: number }): void {
  const r = s * 0.95;
  if (r < 2) return;
  shadow(ctx, x, y, r * 1.05, r * 0.24);
  // speed lines behind it
  ctx.strokeStyle = 'rgba(255,246,224,.65)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (let i = -1; i <= 1; i++) {
    const k = ((o.t * 6 + i * 0.33) % 1);
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.moveTo(x + i * r * 0.5, y + r * 0.1 + k * r * 0.6);
    ctx.lineTo(x + i * r * 0.5, y + r * 0.5 + k * r * 0.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // the pullers, small up ahead
  for (const side of [-1, 1]) paintLoaf(ctx, x + side * r * 0.32, y - r * 1.55 + Math.sin(o.step + side) * r * 0.06, r * 0.26);
  ctx.strokeStyle = C.postDark;
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y - r * 0.95);
  ctx.lineTo(x - r * 0.32, y - r * 1.45);
  ctx.moveTo(x + r * 0.45, y - r * 0.95);
  ctx.lineTo(x + r * 0.32, y - r * 1.45);
  ctx.stroke();
  // the wheels
  for (const side of [-1, 1]) {
    const wx = x + side * r * 0.82, wy = y - r * 0.38;
    ctx.fillStyle = '#5e3f27';
    ellipse(ctx, wx, wy, r * 0.16, r * 0.4);
    ctx.fill();
    ctx.strokeStyle = '#a07a4e';
    ctx.lineWidth = Math.max(0.8, r * 0.05);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = o.step * 0.6 + (i * Math.PI) / 3;
      ctx.moveTo(wx, wy - Math.cos(a) * r * 0.36);
      ctx.lineTo(wx, wy + Math.cos(a) * r * 0.36);
    }
    ctx.stroke();
  }
  // the box, full of bread
  ctx.fillStyle = C.postDark;
  ctx.fillRect(x - r * 0.75, y - r * 0.95, r * 1.5, r * 0.6);
  ctx.fillStyle = C.post;
  ctx.fillRect(x - r * 0.75, y - r * 0.95, r * 1.5, r * 0.18);
  for (let i = 0; i < 4; i++) paintLoaf(ctx, x + (i - 1.5) * r * 0.36, y - r * 1.02 - (i % 2) * r * 0.1, r * 0.24);
  if (o.worth > 0) label(ctx, String(o.worth), x, y - r * 1.9, r * 0.62);
}

/** The giant loaf on legs: its crust crackles brighter as the fuse runs out; the shower it bursts into above it. */
export function paintGiant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { step: number; t: number; fuse: number; burst: number }): void {
  const r = s * 0.9;
  if (r < 2) return;
  shadow(ctx, x, y, r * 1.1, r * 0.28);
  const hop = Math.abs(Math.sin(o.step)) * r * 0.1;
  const k = Math.sin(o.step);
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.4, y - r * 0.5 - hop);
  ctx.lineTo(x - r * 0.45 + k * r * 0.2, y);
  ctx.moveTo(x + r * 0.4, y - r * 0.5 - hop);
  ctx.lineTo(x + r * 0.45 - k * r * 0.2, y);
  ctx.stroke();
  const by = y - r * 1.15 - hop;
  const hot = 1 - Math.max(0, Math.min(1, o.fuse));
  if (hot > 0.4) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, by, r * 2, C.goldGlow, 0.25 * hot + 0.15 * Math.sin(o.t * 18) * hot);
    ctx.restore();
  }
  paintBread(ctx, x, by, r * (1 + 0.04 * Math.sin(o.t * (6 + hot * 20)) * hot), 'bochen');
  // the cracks glowing as it is about to burst
  if (hot > 0.15) {
    ctx.strokeStyle = `rgba(255,214,110,${0.4 + 0.6 * hot})`;
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, by + r * 0.1);
    ctx.lineTo(x - r * 0.3, by - r * 0.2);
    ctx.lineTo(x - r * 0.45, by - r * 0.55);
    ctx.moveTo(x + r * 0.6, by + r * 0.2);
    ctx.lineTo(x + r * 0.25, by - r * 0.1);
    ctx.stroke();
  }
  label(ctx, `×${Math.round(o.burst)}`, x, by - r * 1.05, r * 0.6);
}

/** The camel from behind: long legs, a hump with packs of bread on both sides, his neck and head ahead. */
export function paintCamel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { step: number; t: number; worth: number }): void {
  const r = s * 1.1;
  if (r < 2) return;
  shadow(ctx, x, y, r * 0.9, r * 0.24);
  const sway = Math.sin(o.step * 0.5) * r * 0.05;
  ctx.strokeStyle = '#a07a4a';
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.lineCap = 'round';
  const k = Math.sin(o.step * 0.5) * r * 0.12;
  ctx.beginPath();
  for (const [lx, ph] of [[-0.3, 1], [0.3, -1], [-0.14, -1], [0.14, 1]] as const) {
    ctx.moveTo(x + lx * r, y - r * 0.9);
    ctx.lineTo(x + lx * r + ph * k * 0.3, y - Math.max(0, ph * k * 0.6));
  }
  ctx.stroke();
  // the body and the hump
  ctx.fillStyle = '#c0935a';
  ellipse(ctx, x + sway, y - r * 1.15, r * 0.55, r * 0.42);
  ctx.fill();
  ctx.fillStyle = '#cfa46a';
  ellipse(ctx, x + sway, y - r * 1.55, r * 0.34, r * 0.32);
  ctx.fill();
  // the packs: striped bags of bread
  for (const side of [-1, 1]) {
    const px = x + sway + side * r * 0.58, py = y - r * 1.2;
    ctx.fillStyle = side < 0 ? '#b5523b' : '#4a6a8f';
    ctx.beginPath();
    ctx.roundRect(px - r * 0.22, py - r * 0.3, r * 0.44, r * 0.58, r * 0.1);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,210,.55)';
    ctx.fillRect(px - r * 0.22, py - r * 0.05, r * 0.44, r * 0.07);
    paintLoaf(ctx, px, py - r * 0.34, r * 0.16);
  }
  // the neck and head beyond
  ctx.fillStyle = '#b8894f';
  ellipse(ctx, x + sway, y - r * 1.95, r * 0.13, r * 0.22);
  ctx.fill();
  ellipse(ctx, x + sway, y - r * 2.18, r * 0.16, r * 0.12);
  ctx.fill();
  ctx.fillStyle = '#8d6235';
  for (const side of [-1, 1]) {
    ellipse(ctx, x + sway + side * r * 0.12, y - r * 2.27, r * 0.04, r * 0.07, side * 0.4);
    ctx.fill();
  }
  if (o.worth > 0) label(ctx, String(o.worth), x, y - r * 2.4, r * 0.55);
}

// ── the gluttons ───────────────────────────────────────────────────
/** Zenek the goat facing down the hill: horns, beard, a mischievous eye; head down to charge, lying down when sated. */
export function paintGoat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { t: number; aim: number; charge: boolean; doze: boolean; sated: boolean; gulp: number; stun: number }): void {
  const r = s * 1.05;
  if (r < 2) return;
  shadow(ctx, x, y, r * 0.95, r * 0.25);
  const lie = o.sated || o.doze ? r * 0.45 : 0;
  const low = o.charge ? r * 0.35 : o.aim * r * 0.3;
  // legs
  if (!lie) {
    ctx.strokeStyle = '#6e5a46';
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.lineCap = 'round';
    const k = o.charge ? Math.sin(o.t * 30) * r * 0.12 : 0;
    ctx.beginPath();
    for (const lx of [-0.32, -0.12, 0.12, 0.32]) {
      ctx.moveTo(x + lx * r, y - r * 0.55);
      ctx.lineTo(x + lx * r + (lx < 0 ? k : -k) * 0.3, y);
    }
    ctx.stroke();
  }
  // the body
  ctx.fillStyle = '#efe6d6';
  ellipse(ctx, x, y - r * 0.85 + lie, r * 0.6, r * 0.42);
  ctx.fill();
  ctx.fillStyle = '#a07850';
  ellipse(ctx, x + r * 0.25, y - r * 0.95 + lie, r * 0.22, r * 0.18);
  ctx.fill();
  // the head, toward us
  const hy = y - r * 1.25 + lie + low;
  ctx.fillStyle = '#f4ecdf';
  ellipse(ctx, x, hy, r * 0.3, r * 0.34);
  ctx.fill();
  // horns curling back
  ctx.strokeStyle = '#8a7258';
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * r * 0.12, hy - r * 0.28);
    ctx.quadraticCurveTo(x + side * r * 0.45, hy - r * 0.62, x + side * r * 0.55, hy - r * 0.2);
    ctx.stroke();
  }
  // ears
  ctx.fillStyle = '#e2d6c2';
  for (const side of [-1, 1]) {
    ellipse(ctx, x + side * r * 0.34, hy - r * 0.08, r * 0.15, r * 0.06, side * 0.3);
    ctx.fill();
  }
  // eyes (shut asleep or sated, a cheeky slit otherwise; dizzy when stunned)
  ctx.strokeStyle = '#2b2118';
  ctx.fillStyle = '#2b2118';
  ctx.lineWidth = Math.max(0.8, r * 0.05);
  for (const side of [-1, 1]) {
    const ex = x + side * r * 0.13, ey = hy - r * 0.06;
    if (o.doze || o.sated) {
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.06, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else if (o.stun > 0) {
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.05, o.t * 9, o.t * 9 + 4.5);
      ctx.stroke();
    } else {
      ctx.fillRect(ex - r * 0.06, ey - r * 0.02, r * 0.12, r * 0.04);
    }
  }
  // the muzzle chewing, the beard
  const chew = o.gulp < 0.5 || o.sated ? Math.sin(o.t * 16) * r * 0.03 : 0;
  ctx.fillStyle = '#d9c9b2';
  ellipse(ctx, x, hy + r * 0.2 + chew, r * 0.14, r * 0.1);
  ctx.fill();
  ctx.fillStyle = '#cbbba2';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.07, hy + r * 0.27);
  ctx.lineTo(x, hy + r * 0.52);
  ctx.lineTo(x + r * 0.07, hy + r * 0.27);
  ctx.closePath();
  ctx.fill();
}

/** The goat's telegraph: a line of dust down the column he is about to charge. */
export function paintDustLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, k: number, t: number): void {
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.5 * k;
  ctx.strokeStyle = 'rgba(150,100,50,.85)';
  ctx.lineWidth = w;
  ctx.setLineDash([w * 0.6, w * 0.5]);
  ctx.lineDashOffset = -t * w * 3;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  // an arrow head at the far end (down the hill)
  ctx.fillStyle = 'rgba(150,100,50,.85)';
  ctx.beginPath();
  ctx.moveTo(x1, y1 + w * 0.9);
  ctx.lineTo(x1 - w * 0.9, y1 - w * 0.2);
  ctx.lineTo(x1 + w * 0.9, y1 - w * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Klara the heron in the brook: one leg, an S of a neck, the dagger beak; `stab` 0..1 shoots it forward. */
export function paintHeron(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { t: number; dir: number; stab: number; doze: boolean; sated: boolean; stun: number }): void {
  const r = s * 1.05;
  if (r < 2) return;
  // ripples where she stands
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = Math.max(0.8, r * 0.04);
  for (let i = 0; i < 2; i++) {
    const k = (o.t * 0.6 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - k;
    ellipse(ctx, x, y, r * (0.3 + k * 0.8), r * (0.08 + k * 0.2));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const fly = o.sated ? 1 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(o.dir, 1);
  // the leg
  ctx.strokeStyle = '#c9a25a';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -r * 0.85);
  ctx.stroke();
  // the body
  ctx.fillStyle = '#9aa6ad';
  ellipse(ctx, -r * 0.1, -r * 1.05, r * 0.42, r * 0.26, -0.35);
  ctx.fill();
  ctx.fillStyle = '#6f7c84';
  ellipse(ctx, -r * 0.3, -r * 0.98, r * 0.3, r * 0.14, -0.3);
  ctx.fill();
  if (fly) {
    // wings out, leaving
    ctx.fillStyle = '#8d9aa2';
    ellipse(ctx, -r * 0.2, -r * 1.25, r * 0.9, r * 0.18, -0.4 + Math.sin(o.t * 10) * 0.3);
    ctx.fill();
  }
  // the neck: an S, stretched by the stab
  const st = Math.max(0, Math.min(1, o.stab));
  const hx = r * (0.25 + 0.45 * st), hy = -r * (1.75 - 0.75 * st);
  ctx.strokeStyle = '#d7dde0';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.2, -r * 1.2);
  ctx.bezierCurveTo(r * 0.45, -r * 1.4, -r * 0.05, -r * 1.55, hx, hy);
  ctx.stroke();
  // the head, a black crest, the beak
  ctx.fillStyle = '#eef1f2';
  ellipse(ctx, hx, hy, r * 0.13, r * 0.1);
  ctx.fill();
  ctx.strokeStyle = '#2b2f33';
  ctx.lineWidth = Math.max(0.8, r * 0.04);
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.05, hy - r * 0.06);
  ctx.lineTo(hx - r * 0.32, hy - r * 0.14);
  ctx.stroke();
  ctx.fillStyle = '#e0a83a';
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.1, hy - r * 0.03);
  ctx.lineTo(hx + r * (0.5 + 0.2 * st), hy + r * (0.05 + 0.25 * st));
  ctx.lineTo(hx + r * 0.1, hy + r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1d1d1d';
  if (o.doze) {
    ctx.fillRect(hx, hy - r * 0.02, r * 0.06, Math.max(0.6, r * 0.015));
  } else {
    ctx.beginPath();
    ctx.arc(hx + r * 0.03, hy - r * 0.02, Math.max(0.6, r * 0.025), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  if (o.stun > 0) label(ctx, '?!', x, y - r * 2.1, r * 0.5, '#ffffff', 'rgba(40,40,60,.7)');
}

/** Where the heron will step next: rings spreading in the water. */
export function paintRipples(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, k: number, t: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = Math.max(1, s * 0.07);
  for (let i = 0; i < 3; i++) {
    const p = (t * 1.6 + i / 3) % 1;
    ctx.globalAlpha = (1 - p) * (0.4 + 0.6 * k);
    ellipse(ctx, x, y, s * (0.3 + p * 1.1), s * (0.1 + p * 0.32));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** A cormorant: in the air (wings wide), diving (a dark arrow), or drying its wings spread out on the ground. */
export function paintCormorant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { state: 'air' | 'aim' | 'dive' | 'dry' | 'rise'; t: number; side: number }): void {
  const r = s * 0.85;
  if (r < 1.5) return;
  ctx.save();
  ctx.translate(x, y);
  const black = '#22262a', sheen = '#3b4a3e';
  if (o.state === 'dive') {
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.4);
    ctx.lineTo(-r * 0.3, -r * 0.6);
    ctx.lineTo(0, -r * 0.35);
    ctx.lineTo(r * 0.3, -r * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (o.state === 'dry') {
    shadow(ctx, 0, 0, r * 0.6, r * 0.18);
    // the heraldic pose: wings held out to dry
    ctx.fillStyle = sheen;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.15, -r * 0.9);
      ctx.lineTo(side * r * 0.95, -r * 1.25 + Math.sin(o.t * 4) * r * 0.05);
      ctx.lineTo(side * r * 0.85, -r * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = black;
    ellipse(ctx, 0, -r * 0.7, r * 0.24, r * 0.42);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -r * 1.2, r * 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8b14a';
    ctx.fillRect(-r * 0.04, -r * 1.12, r * 0.08, r * 0.22);
    ctx.fillStyle = '#5ec2d6';
    ctx.beginPath();
    ctx.arc(-r * 0.06, -r * 1.24, Math.max(0.6, r * 0.04), 0, TAU);
    ctx.arc(r * 0.06, -r * 1.24, Math.max(0.6, r * 0.04), 0, TAU);
    ctx.fill();
  } else {
    // flying: a black cross of wings, flapping
    const up = Math.sin(o.t * 9 + o.side);
    ctx.fillStyle = black;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * r * 0.6, -r * (0.25 + up * 0.35), side * r * 1.3, -r * up * 0.5);
      ctx.lineTo(side * r * 0.4, r * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ellipse(ctx, 0, 0, r * 0.18, r * 0.42);
    ctx.fill();
  }
  ctx.restore();
}

/** Where a cormorant will dive: a shadow on the grass that darkens and tightens (k 0..1). */
export function paintDiveShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, k: number, t: number): void {
  ctx.fillStyle = `rgba(20,30,40,${0.12 + 0.38 * k})`;
  ellipse(ctx, x, y, rx * (1.25 - 0.25 * k), ry * (1.25 - 0.25 * k));
  ctx.fill();
  ctx.strokeStyle = `rgba(255,240,220,${0.35 + 0.5 * k})`;
  ctx.lineWidth = Math.max(1, ry * 0.12);
  ctx.setLineDash([ry * 0.4, ry * 0.3]);
  ctx.lineDashOffset = t * ry * 2;
  ellipse(ctx, x, y, rx, ry);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── the lane's elements ────────────────────────────────────────────
/** A chevron of pebbles pointing up the hill (one row of the disciples' arrows); `glowK` 0..1 runs up the arrows. */
export function paintPebbleChevron(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: number, glowK: number): void {
  const n = 5;
  // a faint worn track under the stones, so the row reads as an arrow
  ctx.strokeStyle = `rgba(255,236,170,${0.25 + 0.35 * glowK})`;
  ctx.lineWidth = Math.max(1.5, s * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + s * 0.45);
  ctx.lineTo(x, y);
  ctx.lineTo(x + w / 2, y + s * 0.45);
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1) - 0.5;
    const px = x + k * w, py = y + Math.abs(k) * s * 0.9;
    ctx.fillStyle = 'rgba(80,60,40,.35)';
    ellipse(ctx, px, py + s * 0.06, s * 0.24, s * 0.12);
    ctx.fill();
    ctx.fillStyle = `rgb(${244},${222 + 20 * glowK},${170 + 30 * glowK})`;
    ellipse(ctx, px, py, s * 0.22, s * 0.13);
    ctx.fill();
  }
}

/** A boulder (round, mossy) with its shadow. */
export function paintRock(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  shadow(ctx, x, y + ry * 0.2, rx * 1.1, ry * 0.5, 0.25);
  ctx.fillStyle = '#857a6c';
  ellipse(ctx, x, y - ry * 0.55, rx, ry * 1.05);
  ctx.fill();
  ctx.fillStyle = '#a39887';
  ellipse(ctx, x - rx * 0.22, y - ry * 0.8, rx * 0.55, ry * 0.55);
  ctx.fill();
  ctx.fillStyle = '#7f9a52';
  ellipse(ctx, x + rx * 0.3, y - ry * 1.25, rx * 0.35, ry * 0.18);
  ctx.fill();
}

/** A stepping stone in the brook. */
export function paintStone(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(30,50,60,.25)';
  ellipse(ctx, x, y + ry * 0.35, rx, ry * 0.6);
  ctx.fill();
  ctx.fillStyle = '#b9ae9a';
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.fillStyle = '#d6cdb9';
  ellipse(ctx, x - rx * 0.2, y - ry * 0.25, rx * 0.5, ry * 0.4);
  ctx.fill();
}

/**
 * The jar gate (Dzban): two posts with a crossbar and a big clay jar on it; `fill` 0..1 shows the
 * bread it has drunk; open, it glows and its banner says ×3.
 */
export function paintJarGate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: number, o: { fill: number; open: number; label: string; flash: number; t: number }): void {
  const postH = s * 1.45, x0 = x - w / 2, x1 = x + w / 2, by = y - postH;
  ctx.fillStyle = 'rgba(40,30,15,.18)';
  ellipse(ctx, x, y, w / 2, s * 0.14);
  ctx.fill();
  if (o.open > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, by + s * 0.3, w * 0.9, C.goldGlow, 0.35 + 0.15 * Math.sin(o.t * 8));
    ctx.restore();
  }
  for (const px of [x0, x1]) {
    ctx.fillStyle = C.postDark;
    ctx.fillRect(px - s * 0.09, by, s * 0.18, y - by);
    ctx.fillStyle = C.post;
    ctx.fillRect(px - s * 0.09, by, s * 0.1, y - by);
  }
  ctx.fillStyle = C.postDark;
  ctx.fillRect(x0, by + s * 0.05, w, s * 0.12);
  // the jar
  const jr = Math.min(w * 0.22, s * 0.62), jy = by + s * 0.05;
  ctx.fillStyle = '#a5552e';
  ellipse(ctx, x, jy - jr * 0.7, jr, jr * 0.95);
  ctx.fill();
  ctx.fillStyle = '#c66d3b';
  ellipse(ctx, x - jr * 0.2, jy - jr * 0.85, jr * 0.6, jr * 0.6);
  ctx.fill();
  ctx.fillStyle = '#8a4022';
  ctx.fillRect(x - jr * 0.42, jy - jr * 1.85, jr * 0.84, jr * 0.3);
  // the bread inside, as high as it has drunk
  const f = Math.max(0, Math.min(1, o.fill));
  if (f > 0.02) {
    ctx.save();
    ellipse(ctx, x, jy - jr * 0.7, jr * 0.92, jr * 0.88);
    ctx.clip();
    ctx.fillStyle = o.open > 0 ? C.gold : C.crumb;
    ctx.fillRect(x - jr, jy - jr * 0.7 + jr * 0.88 - f * jr * 1.76, jr * 2, f * jr * 1.76);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,240,220,.55)';
  ellipse(ctx, x - jr * 0.45, jy - jr * 1.05, jr * 0.12, jr * 0.3, 0.3);
  ctx.fill();
  // its number: what it still drinks, or ×3 when open
  label(ctx, o.label, x, jy - jr * 1.9, Math.max(9, s * 0.62), o.open > 0 ? '#fff3c0' : '#ffe2c8', o.open > 0 ? 'rgba(110,60,0,.9)' : 'rgba(80,30,10,.85)');
  if (o.flash > 0.05) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 * o.flash})`;
    ellipse(ctx, x, jy - jr * 0.7, jr * 1.1, jr);
    ctx.fill();
  }
}

// ── the help button ───────────────────────────────────────────────
/** A help's small picture (the button and the card art). */
export function paintHelpIcon(ctx: CanvasRenderingContext2D, id: PomocId, x: number, y: number, r: number, t: number): void {
  switch (id) {
    case 'mewy':
      paintGull(ctx, x, y + r * 0.05, r * 1.15, { flap: t * 8, dir: 1, mirka: true, carry: true });
      break;
    case 'siec': {
      ctx.strokeStyle = '#d8c49a';
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.arc(x, y + r * 0.3, r * 0.75, Math.PI * 1.1, Math.PI * 1.9);
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(x + i * r * 0.28, y - r * 0.35);
        ctx.lineTo(x + i * r * 0.22, y + r * 0.45);
      }
      for (let j = 0; j < 3; j++) {
        ctx.moveTo(x - r * 0.6, y - r * 0.15 + j * r * 0.25);
        ctx.lineTo(x + r * 0.6, y - r * 0.15 + j * r * 0.25);
      }
      ctx.stroke();
      ctx.fillStyle = '#9a7a4e';
      for (const k of [-0.6, 0, 0.6]) {
        ctx.beginPath();
        ctx.arc(x + k * r, y + r * 0.5, r * 0.08, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'wiatr': {
      ctx.strokeStyle = '#e6f3f8';
      ctx.lineWidth = Math.max(1.2, r * 0.12);
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const yy = y - r * 0.4 + i * r * 0.4, ph = Math.sin(t * 3 + i) * r * 0.1;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.7, yy + ph);
        ctx.quadraticCurveTo(x, yy - r * 0.25 + ph, x + r * 0.45, yy + ph);
        ctx.arc(x + r * 0.45, yy - r * 0.15 + ph, r * 0.15, Math.PI / 2, -Math.PI / 2, true);
        ctx.stroke();
      }
      break;
    }
    case 'bramka': {
      ctx.fillStyle = C.honeyDark;
      ctx.fillRect(x - r * 0.7, y - r * 0.55, r * 1.4, r * 0.42);
      ctx.fillStyle = C.honey;
      ctx.fillRect(x - r * 0.7, y - r * 0.6, r * 1.4, r * 0.38);
      ctx.fillStyle = C.postDark;
      ctx.fillRect(x - r * 0.75, y - r * 0.6, r * 0.14, r * 1.2);
      ctx.fillRect(x + r * 0.61, y - r * 0.6, r * 0.14, r * 1.2);
      ctx.fillStyle = '#fffaf0';
      ctx.font = font(900, r * 0.36, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×3', x, y - r * 0.4);
      break;
    }
  }
}

/** The help button: a round button with the help's picture and a ring that fills; it pulses when ready. */
export function paintHelpButton(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, o: { id: PomocId; charge: number; ready: boolean; t: number; label: string; u: number }): void {
  const k = Math.max(0, Math.min(1, o.charge));
  if (o.ready) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r * 2.1, C.goldGlow, 0.35 + 0.2 * Math.sin(o.t * 6));
    ctx.restore();
  }
  const pulse = o.ready ? 1 + 0.06 * Math.sin(o.t * 6) : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = o.ready ? 'rgba(255,246,224,.97)' : 'rgba(255,246,224,.78)';
  ctx.strokeStyle = 'rgba(90,60,25,.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = o.ready ? 1 : 0.55;
  paintHelpIcon(ctx, o.id, 0, 0, r * 0.62, o.t);
  ctx.globalAlpha = 1;
  // the charge ring
  ctx.lineWidth = Math.max(3, r * 0.14);
  ctx.strokeStyle = 'rgba(60,40,15,.25)';
  ctx.beginPath();
  ctx.arc(0, 0, r + ctx.lineWidth * 0.6, 0, TAU);
  ctx.stroke();
  if (k > 0.005) {
    ctx.strokeStyle = o.ready ? C.gold : '#f3d27a';
    ctx.beginPath();
    ctx.arc(0, 0, r + ctx.lineWidth * 0.6, -Math.PI / 2, -Math.PI / 2 + TAU * k);
    ctx.stroke();
  }
  ctx.restore();
  // its name under it
  ctx.font = font(850, 10 * o.u, SANS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(50,30,10,.6)';
  ctx.strokeText(o.label, x, y + r * 1.25);
  ctx.fillStyle = o.ready ? '#fff3c0' : '#fff6e0';
  ctx.fillText(o.label, x, y + r * 1.25);
}

// ── the cards' pictures ────────────────────────────────────────────
/** A champion in miniature (the ring's label, the card art). */
export function paintChampIcon(ctx: CanvasRenderingContext2D, id: MistrzId, x: number, y: number, s: number, t: number): void {
  switch (id) {
    case 'kosz': paintBasket(ctx, x, y - s * 0.4, s * 0.75, { fill: 1, legs: t, gold: true }); break;
    case 'osiol': paintDonkey(ctx, x, y + s * 0.55, s * 0.62, { step: t * 6, t, worth: 0 }); break;
    case 'woz': paintCart(ctx, x, y + s * 0.5, s * 0.62, { step: t * 6, t, worth: 0 }); break;
    case 'olbrzym': paintBread(ctx, x, y - s * 0.1, s * 0.62, 'bochen'); break;
    case 'wielblad': paintCamel(ctx, x, y + s * 0.65, s * 0.5, { step: t * 4, t, worth: 0 }); break;
  }
}

/** A basket (the cannon) in miniature. */
export function paintKoszIcon(ctx: CanvasRenderingContext2D, id: CardId, x: number, y: number, s: number, t: number): void {
  switch (id) {
    case 'dwojak':
      paintBasket(ctx, x - s * 0.42, y, s * 0.45, { fill: 0.8 });
      paintBasket(ctx, x + s * 0.42, y, s * 0.45, { fill: 0.8 });
      break;
    case 'trojak':
      for (const k of [-1, 0, 1]) paintBasket(ctx, x + k * s * 0.55, y + Math.abs(k) * s * 0.08, s * 0.34, { fill: 0.8 });
      break;
    case 'przetak': {
      ctx.fillStyle = C.wickerDark;
      ellipse(ctx, x, y, s * 0.8, s * 0.36);
      ctx.fill();
      ctx.fillStyle = '#e8d6a8';
      ellipse(ctx, x, y - s * 0.04, s * 0.68, s * 0.27);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,50,.6)';
      ctx.lineWidth = Math.max(0.5, s * 0.04);
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        ctx.moveTo(x + i * s * 0.18, y - s * 0.28);
        ctx.lineTo(x + i * s * 0.18, y + s * 0.2);
      }
      ctx.stroke();
      for (let i = 0; i < 5; i++) paintLoaf(ctx, x + (i - 2) * s * 0.3, y - s * 0.5 - Math.abs(i - 2) * s * -0.08, s * 0.14);
      break;
    }
    case 'niespodzianka':
      paintBasket(ctx, x, y, s * 0.7, { fill: 0.6 });
      paintBread(ctx, x + s * 0.15, y - s * 0.45, s * 0.28, 'gold');
      ctx.fillStyle = 'rgba(255,240,160,.9)';
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * s * 0.75, y - s * 0.5 + Math.sin(a) * s * 0.3, s * 0.06, 0, TAU);
        ctx.fill();
      }
      break;
    case 'rybacki':
      paintBasket(ctx, x, y + s * 0.05, s * 0.6, { fill: 0.5, loaves: false });
      paintFish(ctx, x - s * 0.2, y - s * 0.4, s * 0.28, Math.sin(t * 4) * 0.5);
      paintFish(ctx, x + s * 0.22, y - s * 0.45, s * 0.26, Math.sin(t * 4 + 1) * 0.5);
      break;
    case 'piec': {
      ctx.fillStyle = '#b8846a';
      ctx.beginPath();
      ctx.arc(x, y + s * 0.15, s * 0.75, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a2418';
      ctx.beginPath();
      ctx.arc(x, y + s * 0.15, s * 0.32, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(255,${150 + 40 * Math.sin(t * 7)},60,.9)`;
      ellipse(ctx, x, y + s * 0.08, s * 0.2, s * 0.08 + s * 0.03 * Math.sin(t * 9));
      ctx.fill();
      break;
    }
    default:
      paintBasket(ctx, x, y, s * 0.7, { fill: 0.8 });
  }
}

/** A card's little picture by its id. */
export function paintCardArt(ctx: CanvasRenderingContext2D, id: CardId, kind: 'kosz' | 'chleb' | 'mistrz' | 'pomoc', x: number, y: number, s: number, t: number): void {
  if (kind === 'kosz') paintKoszIcon(ctx, id, x, y, s, t);
  else if (kind === 'chleb') paintBread(ctx, x, y, s * 0.55, id as Look, Math.sin(t * 4));
  else if (kind === 'mistrz') paintChampIcon(ctx, id as MistrzId, x, y, s, t);
  else paintHelpIcon(ctx, id as PomocId, x, y, s * 0.75, t);
}

// ── the village ───────────────────────────────────────────────────
/** One of Betsaida's buildings at its level (0: an empty plot with a stake). */
export function paintBuilding(ctx: CanvasRenderingContext2D, b: Building, x: number, y: number, s: number, level: number, t: number): void {
  shadow(ctx, x, y, s * 0.9, s * 0.18, 0.2);
  if (level <= 0) {
    ctx.strokeStyle = 'rgba(120,90,50,.7)';
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.setLineDash([s * 0.12, s * 0.1]);
    ctx.strokeRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 0.5);
    ctx.setLineDash([]);
    ctx.fillStyle = C.post;
    ctx.fillRect(x - s * 0.04, y - s * 0.75, s * 0.08, s * 0.75);
    return;
  }
  const wall = '#e9dcc0', wallDark = '#cdb994', roof = '#b5523b';
  const house = (hx: number, w: number, h: number) => {
    ctx.fillStyle = wallDark;
    ctx.fillRect(hx - w / 2, y - h, w, h);
    ctx.fillStyle = wall;
    ctx.fillRect(hx - w / 2, y - h, w * 0.78, h);
    ctx.fillStyle = '#7b5b3a';
    ctx.fillRect(hx - w * 0.12, y - h * 0.55, w * 0.24, h * 0.55);
    ctx.fillStyle = '#d8c7a4';
    ctx.fillRect(hx - w / 2 - s * 0.05, y - h - s * 0.08, w + s * 0.1, s * 0.1);
  };
  switch (b) {
    case 'piekarnia': {
      house(x, s * 1.2, s * 0.75);
      // the oven's dome and its smoke
      ctx.fillStyle = '#b8846a';
      ctx.beginPath();
      ctx.arc(x + s * 0.75, y, s * 0.35, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(240,240,240,.6)';
      for (let i = 0; i < Math.min(3, level + 1); i++) {
        const k = (t * 0.4 + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.arc(x + s * 0.75 + Math.sin(k * 6) * s * 0.1, y - s * 0.4 - k * s * 1.1, s * (0.1 + k * 0.15), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < level; i++) paintLoaf(ctx, x - s * 0.4 + i * s * 0.26, y - s * 0.85, s * 0.11);
      break;
    }
    case 'przystan': {
      // a jetty and a boat with a sail, more boats with the level
      ctx.fillStyle = '#4f8fa8';
      ctx.fillRect(x - s, y - s * 0.12, s * 2, s * 0.12);
      ctx.fillStyle = C.post;
      ctx.fillRect(x - s * 0.9, y - s * 0.28, s * 1.1, s * 0.1);
      for (let i = 0; i < level; i++) {
        const bx = x + s * 0.55 - i * s * 0.55, bob = Math.sin(t * 2 + i) * s * 0.03;
        ctx.fillStyle = '#7a4f2e';
        ctx.beginPath();
        ctx.moveTo(bx - s * 0.3, y - s * 0.18 + bob);
        ctx.lineTo(bx + s * 0.3, y - s * 0.18 + bob);
        ctx.lineTo(bx + s * 0.2, y - s * 0.02 + bob);
        ctx.lineTo(bx - s * 0.2, y - s * 0.02 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f3ead6';
        ctx.beginPath();
        ctx.moveTo(bx, y - s * 0.75 + bob);
        ctx.lineTo(bx, y - s * 0.2 + bob);
        ctx.lineTo(bx + s * 0.25, y - s * 0.22 + bob);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'wiklina': {
      house(x - s * 0.2, s * 0.9, s * 0.6);
      for (let i = 0; i < level + 1; i++) paintBasket(ctx, x + s * 0.45 + (i % 2) * s * 0.28, y - s * 0.12 - Math.floor(i / 2) * s * 0.22, s * 0.16, { fill: 0.5 });
      break;
    }
    case 'brama': {
      ctx.fillStyle = '#c7b48e';
      ctx.fillRect(x - s * 0.8, y - s * 0.9, s * 0.3, s * 0.9);
      ctx.fillRect(x + s * 0.5, y - s * 0.9, s * 0.3, s * 0.9);
      ctx.fillStyle = '#b09c76';
      ctx.fillRect(x - s * 0.85, y - s * 1.02, s * 1.7, s * 0.18);
      ctx.fillStyle = C.honey;
      ctx.fillRect(x - s * 0.45, y - s * 0.8, s * 0.9, s * 0.22);
      ctx.fillStyle = '#fffaf0';
      ctx.font = font(900, s * 0.2, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×2', x, y - s * 0.69);
      break;
    }
    case 'studnia': {
      ctx.fillStyle = '#a39887';
      ctx.fillRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.4);
      ctx.fillStyle = '#4f8fa8';
      ellipse(ctx, x, y - s * 0.4, s * 0.38, s * 0.1);
      ctx.fill();
      ctx.fillStyle = C.post;
      ctx.fillRect(x - s * 0.42, y - s * 1.0, s * 0.08, s * 0.6);
      ctx.fillRect(x + s * 0.34, y - s * 1.0, s * 0.08, s * 0.6);
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.55, y - s * 0.95);
      ctx.lineTo(x, y - s * (1.2 + 0.08 * level));
      ctx.lineTo(x + s * 0.55, y - s * 0.95);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'spichlerz': {
      ctx.fillStyle = wallDark;
      ctx.fillRect(x - s * 0.55, y - s * (0.6 + 0.15 * level), s * 1.1, s * (0.6 + 0.15 * level));
      ctx.fillStyle = wall;
      ctx.fillRect(x - s * 0.55, y - s * (0.6 + 0.15 * level), s * 0.85, s * (0.6 + 0.15 * level));
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y - s * (0.6 + 0.15 * level));
      ctx.lineTo(x, y - s * (1.05 + 0.15 * level));
      ctx.lineTo(x + s * 0.7, y - s * (0.6 + 0.15 * level));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d9a441';
      for (let i = 0; i < level; i++) {
        ellipse(ctx, x - s * 0.3 + i * s * 0.3, y - s * 0.12, s * 0.12, s * 0.1);
        ctx.fill();
      }
      break;
    }
  }
  // the level's dots under it
  ctx.fillStyle = C.gold;
  for (let i = 0; i < level; i++) {
    ctx.beginPath();
    ctx.arc(x + (i - (level - 1) / 2) * s * 0.18, y + s * 0.18, s * 0.055, 0, TAU);
    ctx.fill();
  }
}

/** Betsaida on the lakeshore: the water, a strip of sand, and the six plots with what is built on them. */
export function paintVillage(ctx: CanvasRenderingContext2D, w: number, h: number, levels: Readonly<Record<Building, number>>, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#bfe0e6');
  sky.addColorStop(0.42, '#f7e9c9');
  sky.addColorStop(0.43, '#4f8fa8');
  sky.addColorStop(0.62, '#2f5d78');
  sky.addColorStop(0.63, '#e7d1a0');
  sky.addColorStop(1, '#cdb27c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#9db5a6';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.43);
  for (let i = 0; i <= 8; i++) ctx.lineTo((w * i) / 8, h * (0.36 + 0.04 * Math.sin(i * 1.7)));
  ctx.lineTo(w, h * 0.43);
  ctx.closePath();
  ctx.fill();
  const order: Building[] = ['przystan', 'piekarnia', 'wiklina', 'studnia', 'spichlerz', 'brama'];
  const s = Math.min(w / 7.5, h * 0.42);
  order.forEach((b, i) => paintBuilding(ctx, b, w * (0.09 + 0.165 * i), h * 0.86, s * 0.85, levels[b] ?? 0, t));
}

/**
 * A small runner seen from behind as it runs up the hill: its bread on two little kicking legs with
 * tiny arms pumping; a heavier one (past the crowd cap, or a creel's stack) carries its number; a
 * warm one steams; one butted by the goat rolls over.
 */
export function paintBreadRunner(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { look: Look; step: number; w: number; gold: boolean; warm: boolean; tumble: number; t: number }): void {
  const r = s * 0.36;
  if (r < 0.8) return;
  const kick = Math.sin(o.step);
  const hop = Math.abs(Math.cos(o.step)) * r * 0.25;
  ctx.fillStyle = 'rgba(30,40,20,.2)';
  ellipse(ctx, x, y, r * 0.9, r * 0.3);
  ctx.fill();
  const by = y - r * 1.15 - hop;
  if (o.tumble > 0) {
    // rolling back down the hill, legs in the air
    ctx.save();
    ctx.translate(x, by + r * 0.4);
    ctx.rotate(o.tumble * 14);
    paintBread(ctx, 0, 0, r, o.look, kick);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.3, y - r * 0.6 - hop);
  ctx.lineTo(x - r * 0.35 + kick * r * 0.25, y - r * 0.05 - Math.max(0, kick) * r * 0.25);
  ctx.moveTo(x + r * 0.3, y - r * 0.6 - hop);
  ctx.lineTo(x + r * 0.35 - kick * r * 0.25, y - r * 0.05 - Math.max(0, -kick) * r * 0.25);
  ctx.stroke();
  // a stack for a heavy runner
  if (o.look !== 'fish' && o.w >= 2) {
    const stack = Math.min(3, o.w >= 4 ? 3 : o.w);
    for (let i = stack - 1; i >= 1; i--) paintBread(ctx, x + (i % 2 ? r * 0.25 : -r * 0.25), by - i * r * 0.7, r * 0.85, o.look === 'gold' ? 'bochenek' : o.look);
  }
  paintBread(ctx, x, by, r, o.look, kick);
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = Math.max(0.8, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, by + r * 0.05);
  ctx.lineTo(x - r * 1.25, by - r * 0.25 + kick * r * 0.3);
  ctx.moveTo(x + r * 0.9, by + r * 0.05);
  ctx.lineTo(x + r * 1.25, by - r * 0.25 - kick * r * 0.3);
  ctx.stroke();
  if (o.warm) paintSteam(ctx, x, by, r, o.t + x * 0.01);
  if (o.gold) {
    ctx.fillStyle = 'rgba(255,226,120,.75)';
    ctx.beginPath();
    ctx.arc(x + r * 0.5, by - r * 0.5, r * 0.22, 0, TAU);
    ctx.fill();
  }
  if (o.w >= 4 && r > 3) label(ctx, `${o.w}`, x, by - r * 2.2, r * 1.2);
}
