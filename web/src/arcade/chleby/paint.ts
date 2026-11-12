/**
 * Chleby i ryby's painter: a spring hillside above the Sea of Galilee in warm gouache — a hazy
 * sky, the lake's blue band with the far shore, green grass with poppies and chamomile, a path of
 * worn earth up the slope — and the sprites: barley loaves with scored crusts, silver fish, the big
 * basket on its little legs, the gates on wooden posts (green adds, honey multiplies, grey takes
 * away, the golden gate with its arc gauge and the threshold marked), the gulls (Mirka in her red
 * kerchief), the pelican with his pouch, the groups of the hungry on the grass, the boy with his
 * basket seen from behind, and the little baskets of the history row.  All canvas paths, no images;
 * sizes in px from the caller (`s` = px per u at that depth).
 */

import { MIN_TEXT } from '../kit/mobile';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
/** A CSS font; never under MIN_TEXT (11 px): nothing on a phone's canvas is drawn smaller (DESIGN §12). */
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(Math.max(MIN_TEXT, size) * 10) / 10}px ${family}`;

export const C = {
  crust: '#c98b3a', crustDark: '#9c6526', crumb: '#f1cf8a', loafLight: '#f5d58f', score: '#8a5520',
  fish: '#a9c2cf', fishDark: '#6f8fa1', fishBelly: '#e3eef2',
  wicker: '#b8834a', wickerDark: '#7d5530', wickerLight: '#d9aa6c',
  post: '#8a6240', postDark: '#5e3f27', rope: '#d8c49a',
  green: '#5f9e4a', greenDark: '#3f7432', greenLight: '#9fd07f',
  honey: '#e39a2f', honeyDark: '#a96718', honeyLight: '#ffd08a',
  grey: '#8f918b', greyDark: '#5f615c', greyLight: '#c5c6c0',
  gold: '#f3c13f', goldDeep: '#c98f12', goldLight: '#fff0b8', goldGlow: 'rgba(255,214,110,',
  gull: '#fbfbf7', gullShade: '#d9dde0', gullWing: '#9aa3a9', gullTip: '#2d3134', beak: '#f2b233', kerchief: '#d6453a',
  pelican: '#f6f2ea', pelicanShade: '#d7d1c4', pouch: '#ef9b4a', pouchDark: '#c06d26',
  skin: '#c98c62', skinLight: '#dca47a', hair: '#3b2618', tunic: '#b5523b', tunicDark: '#83382a', belt: '#e8c27a',
  paper: '#fff6e0', text: '#3a2a18', textSoft: 'rgba(58,42,24,.78)', calm: '#5aa0b8', calmDeep: '#2f6f86',
  robes: ['#c9874a', '#b5523b', '#4a6a8f', '#8a9a5b', '#e8d8b8', '#7a4f7a', '#d9a441', '#5c7d6e'],
};

export interface Palette {
  sky0: string; sky1: string; sun: string; far: string; lake: string; lakeDeep: string; lakeLight: string;
  grass: string; grass2: string; grassDark: string; path: string; pathDark: string; flower: string;
}

/** The six hillsides: morning shore, green slope, olive grove, fishing village, pasture, sunset. */
export const PALETTES: readonly Palette[] = [
  { sky0: '#f7e9c9', sky1: '#bfe0e6', sun: '#fff4cf', far: '#9db5a6', lake: '#4f8fa8', lakeDeep: '#2f5d78', lakeLight: '#a7d3df', grass: '#7fae5a', grass2: '#94bf68', grassDark: '#5a8a40', path: '#e7d1a0', pathDark: '#cdb27c', flower: '#e5584a' },
  { sky0: '#f4ecd0', sky1: '#a9d6e4', sun: '#fff7d8', far: '#8fb19b', lake: '#4a8bab', lakeDeep: '#2b5876', lakeLight: '#a3d0df', grass: '#6fa64f', grass2: '#8cc061', grassDark: '#4f8338', path: '#e9d6a6', pathDark: '#cfb47e', flower: '#f1d24a' },
  { sky0: '#f2e6c6', sky1: '#c3dcd6', sun: '#fff2c8', far: '#94a88a', lake: '#538ea2', lakeDeep: '#335f74', lakeLight: '#afd2d9', grass: '#869f55', grass2: '#9bb466', grassDark: '#5f7a3c', path: '#e3cc98', pathDark: '#c6aa72', flower: '#f4f0e2' },
  { sky0: '#f6e4c4', sky1: '#b2d5e2', sun: '#fff1cc', far: '#a2a995', lake: '#3f86a6', lakeDeep: '#245372', lakeLight: '#9ccbe0', grass: '#7aa65a', grass2: '#90b96c', grassDark: '#557f3e', path: '#e6cf9c', pathDark: '#c9ad76', flower: '#d65a8c' },
  { sky0: '#f3ecd2', sky1: '#bcdce4', sun: '#fff8dd', far: '#9cb59a', lake: '#4c8fa6', lakeDeep: '#2e5c74', lakeLight: '#a8d4de', grass: '#74ad54', grass2: '#8ec86a', grassDark: '#518a3b', path: '#ead9ad', pathDark: '#cfb886', flower: '#f0a53c' },
  { sky0: '#f7c99a', sky1: '#e48a6a', sun: '#ffe2a0', far: '#a7817a', lake: '#7a7fa8', lakeDeep: '#4d4f7c', lakeLight: '#f2b98f', grass: '#7c9a52', grass2: '#94ad60', grassDark: '#55703a', path: '#e2c08f', pathDark: '#c49f6c', flower: '#e5584a' },
];

/** A stable pseudo-random number 0..1 from an integer. */
export function hash(i: number): number {
  let x = (i | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const TAU = Math.PI * 2;

/** A soft radial glow (additive callers set 'lighter'). */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  if (a <= 0.003 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${color}${a})`);
  g.addColorStop(0.45, `${color}${a * 0.45})`);
  g.addColorStop(1, `${color}0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

// ── the world ──────────────────────────────────────────────────────
/** The sky down to the horizon: haze, the sun, two soft clouds that drift. */
export function paintSky(ctx: CanvasRenderingContext2D, w: number, horizon: number, pal: Palette, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, Math.max(10, horizon));
  g.addColorStop(0, pal.sky1);
  g.addColorStop(1, pal.sky0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizon + 2);
  const sx = w * 0.78, sy = Math.max(14, horizon * 0.35);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, sx, sy, Math.max(40, horizon * 0.9), 'rgba(255,240,200,', 0.35);
  ctx.restore();
  ctx.fillStyle = pal.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(6, horizon * 0.09), 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 3; i++) {
    const cx = ((hash(i + 3) * w + t * (6 + i * 3)) % (w + 200)) - 100, cy = horizon * (0.18 + 0.2 * hash(i + 9));
    const r = Math.max(8, horizon * 0.08);
    ellipse(ctx, cx, cy, r * 2.2, r * 0.7);
    ctx.fill();
    ellipse(ctx, cx + r, cy - r * 0.35, r * 1.2, r * 0.6);
    ctx.fill();
  }
}

/** The lake across the horizon, the far shore's hills over it; dozing gulls float on it in a rest. */
export function paintLake(ctx: CanvasRenderingContext2D, w: number, horizon: number, depth: number, pal: Palette, t: number): void {
  // the far shore
  ctx.fillStyle = pal.far;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= w; x += 24) ctx.lineTo(x, horizon - depth * (0.25 + 0.2 * Math.sin(x * 0.011 + 1.3) + 0.1 * Math.sin(x * 0.037)));
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, horizon, 0, horizon + depth);
  g.addColorStop(0, pal.lakeDeep);
  g.addColorStop(1, pal.lake);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, depth + 1);
  // shimmer
  ctx.strokeStyle = pal.lakeLight;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 14; i++) {
    const y = horizon + depth * (0.2 + 0.7 * hash(i * 5 + 1));
    const x = ((hash(i * 7) * w + t * 12 * (0.5 + hash(i))) % (w + 60)) - 30;
    const len = 10 + 26 * hash(i * 11);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // a little boat with a sail, far off
  const bx = ((t * 4 + w * 0.2) % (w + 80)) - 40, by = horizon + depth * 0.45;
  ctx.fillStyle = '#6b4a30';
  ctx.beginPath();
  ctx.moveTo(bx - 9, by);
  ctx.lineTo(bx + 9, by);
  ctx.lineTo(bx + 6, by + 3);
  ctx.lineTo(bx - 6, by + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f3ead6';
  ctx.beginPath();
  ctx.moveTo(bx, by - 13);
  ctx.lineTo(bx + 7, by - 1);
  ctx.lineTo(bx, by - 1);
  ctx.closePath();
  ctx.fill();
}

/** The grass from below the lake to the bottom, with tufts and flowers that sit still. */
export function paintGrass(ctx: CanvasRenderingContext2D, w: number, top: number, h: number, pal: Palette, t: number): void {
  const g = ctx.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, pal.grass2);
  g.addColorStop(1, pal.grass);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, h - top);
  // a soft shoreline
  ctx.fillStyle = pal.grassDark;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, top, w, 3);
  ctx.globalAlpha = 1;
  const n = Math.round((w * (h - top)) / 2600);
  for (let i = 0; i < n; i++) {
    const x = hash(i * 3 + 1) * w, k = hash(i * 3 + 2), y = top + 6 + k * k * (h - top - 6);
    const s = 0.5 + 1.2 * k;
    const sway = Math.sin(t * 1.3 + i) * 0.8 * s;
    if (hash(i * 13) < 0.16) {
      // a poppy or a daisy
      ctx.fillStyle = hash(i * 17) < 0.5 ? pal.flower : '#fbf6e8';
      ctx.beginPath();
      ctx.arc(x + sway, y - 3 * s, 1.8 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(x + sway, y - 3 * s, 0.7 * s, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = hash(i * 7) < 0.5 ? pal.grassDark : pal.grass2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 2 * s, y);
      ctx.quadraticCurveTo(x - 2 * s + sway * 0.5, y - 3 * s, x - 3 * s + sway, y - 6 * s);
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway * 0.5, y - 4 * s, x + sway, y - 8 * s);
      ctx.moveTo(x + 2 * s, y);
      ctx.quadraticCurveTo(x + 2 * s + sway * 0.5, y - 3 * s, x + 3 * s + sway, y - 5 * s);
      ctx.stroke();
    }
  }
}

/** The path up the slope: a worn trapezoid of earth between the basket and the hungry. */
export function paintPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[][], pal: Palette): void {
  const [left, right] = pts;
  ctx.fillStyle = pal.path;
  ctx.beginPath();
  left.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
  // haze toward the top, warm earth near the basket
  const top = right[right.length - 1].y, bottom = left[0].y;
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(255,255,255,.22)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(140,90,40,.14)');
  ctx.fillStyle = g;
  ctx.fill();
  // worn ruts and soft edges
  ctx.strokeStyle = pal.pathDark;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  for (const side of [left, right]) {
    ctx.beginPath();
    side.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── the bread ──────────────────────────────────────────────────────
/** A barley loaf: a round dome with three scores and a light top. */
export function paintLoaf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0, heavy = 1): void {
  if (r < 0.6) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = C.crustDark;
  ellipse(ctx, 0, r * 0.18, r * 1.05, r * 0.72);
  ctx.fill();
  ctx.fillStyle = C.crust;
  ellipse(ctx, 0, 0, r, r * 0.7);
  ctx.fill();
  ctx.fillStyle = C.loafLight;
  ellipse(ctx, -r * 0.2, -r * 0.22, r * 0.55, r * 0.3);
  ctx.fill();
  if (r > 2.5) {
    ctx.strokeStyle = C.score;
    ctx.lineWidth = Math.max(0.7, r * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const k of [-0.45, 0, 0.45]) {
      ctx.moveTo(k * r - r * 0.12, -r * 0.35);
      ctx.lineTo(k * r + r * 0.12, r * 0.25);
    }
    ctx.stroke();
  }
  if (heavy > 1 && r > 2) {
    // a heavier piece (a crowded hill): a second loaf peeks out
    ctx.fillStyle = C.crust;
    ellipse(ctx, r * 0.7, -r * 0.45, r * 0.6, r * 0.42);
    ctx.fill();
  }
  ctx.restore();
}

/** A small silver fish, wiggling. */
export function paintFish(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, wiggle: number): void {
  if (r < 0.6) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2 + wiggle * 0.25);
  ctx.fillStyle = C.fishDark;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, 0);
  ctx.lineTo(-r * 1.55, -r * 0.55 + wiggle * r * 0.2);
  ctx.lineTo(-r * 1.55, r * 0.55 + wiggle * r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.fish;
  ellipse(ctx, 0, 0, r * 1.05, r * 0.48);
  ctx.fill();
  ctx.fillStyle = C.fishBelly;
  ellipse(ctx, r * 0.05, r * 0.16, r * 0.75, r * 0.2);
  ctx.fill();
  ctx.fillStyle = '#23323a';
  ctx.beginPath();
  ctx.arc(r * 0.6, -r * 0.08, Math.max(0.6, r * 0.11), 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A woven basket (ellipse body, rim, weave), optionally with loaves in it and little legs. */
export function paintBasket(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, o: { fill?: number; legs?: number; gold?: boolean; loaves?: boolean } = {}): void {
  if (r < 0.8) return;
  const fill = o.fill ?? 0;
  if (o.legs !== undefined) {
    ctx.strokeStyle = C.wickerDark;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.lineCap = 'round';
    const k = Math.sin(o.legs * 10) * r * 0.25;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y + r * 0.45);
    ctx.lineTo(x - r * 0.45 + k, y + r * 0.95);
    ctx.moveTo(x + r * 0.4, y + r * 0.45);
    ctx.lineTo(x + r * 0.45 - k, y + r * 0.95);
    ctx.stroke();
  }
  // the loaves inside, up to the fill
  if (o.loaves !== false && fill > 0.02) {
    const n = Math.max(1, Math.round(fill * 4));
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n - 1) - 0.5) * r * 1.1;
      paintLoaf(ctx, x + a, y - r * (0.15 + 0.35 * fill) - (i % 2) * r * 0.12, r * 0.38);
    }
  }
  ctx.fillStyle = o.gold ? C.goldDeep : C.wicker;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.15);
  ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.6, x, y + r * 0.62);
  ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.6, x + r, y - r * 0.15);
  ctx.closePath();
  ctx.fill();
  if (r > 3) {
    ctx.strokeStyle = o.gold ? C.gold : C.wickerDark;
    ctx.lineWidth = Math.max(0.6, r * 0.07);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      const yy = y - r * 0.15 + i * r * 0.24;
      ctx.moveTo(x - r * (0.95 - i * 0.12), yy);
      ctx.lineTo(x + r * (0.95 - i * 0.12), yy);
    }
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(x + i * r * 0.32, y - r * 0.12);
      ctx.lineTo(x + i * r * 0.26, y + r * 0.55);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = o.gold ? C.gold : C.wickerLight;
  ellipse(ctx, x, y - r * 0.15, r, r * 0.22);
  ctx.fill();
  ctx.fillStyle = o.gold ? 'rgba(120,70,0,.4)' : 'rgba(80,50,20,.35)';
  ellipse(ctx, x, y - r * 0.13, r * 0.82, r * 0.14);
  ctx.fill();
}

// ── the gates ──────────────────────────────────────────────────────
export type GateLook = 'add' | 'mul' | 'sub' | 'start';

/** Two posts and a banner between them, with the gate's number. */
export function paintGate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: number, look: GateLook, label: string, flash: number, down: number): void {
  const postH = s * 1.35, bannerH = s * 0.62;
  const x0 = x - w / 2, x1 = x + w / 2;
  const col = look === 'add' || look === 'start' ? [C.green, C.greenDark, C.greenLight] : look === 'mul' ? [C.honey, C.honeyDark, C.honeyLight] : [C.grey, C.greyDark, C.greyLight];
  // the line on the ground
  ctx.fillStyle = 'rgba(40,30,15,.18)';
  ellipse(ctx, x, y, w / 2, s * 0.14);
  ctx.fill();
  if (down > 0) {
    // a broken grey gate: stones on the ground, the posts snapped
    ctx.fillStyle = C.greyDark;
    for (let i = 0; i < 5; i++) {
      ellipse(ctx, x0 + w * (0.15 + 0.17 * i), y - s * 0.05, s * 0.14, s * 0.09);
      ctx.fill();
    }
    ctx.fillStyle = C.postDark;
    ctx.fillRect(x0 - s * 0.08, y - postH * 0.35, s * 0.16, postH * 0.35);
    ctx.fillRect(x1 - s * 0.08, y - postH * 0.35, s * 0.16, postH * 0.35);
    return;
  }
  const by = y - postH + s * 0.05;
  // the banner
  ctx.fillStyle = col[1];
  ctx.beginPath();
  ctx.roundRect(x0, by + s * 0.06, w, bannerH, s * 0.12);
  ctx.fill();
  ctx.fillStyle = flash > 0 ? mix(col[0], '#ffffff', flash * 0.5) : col[0];
  ctx.beginPath();
  ctx.roundRect(x0, by, w, bannerH, s * 0.12);
  ctx.fill();
  // a see-through net below the banner
  ctx.strokeStyle = col[2];
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(0.6, s * 0.03);
  ctx.beginPath();
  for (let k = 1; k < 6; k++) {
    const xx = x0 + (w * k) / 6;
    ctx.moveTo(xx, by + bannerH);
    ctx.lineTo(xx, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // the posts
  for (const px of [x0, x1]) {
    ctx.fillStyle = C.postDark;
    ctx.fillRect(px - s * 0.09, by - s * 0.12, s * 0.18, y - by + s * 0.12);
    ctx.fillStyle = C.post;
    ctx.fillRect(px - s * 0.09, by - s * 0.12, s * 0.1, y - by + s * 0.12);
  }
  // the number: never under 13 px, outlined so it reads past the banner's edge on a far gate
  const px = Math.max(13, bannerH * 0.78);
  ctx.font = font(850, px, SANS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (px > bannerH * 0.9) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = col[1];
    ctx.strokeText(label, x, by + bannerH * 0.53);
  }
  ctx.fillStyle = '#fffaf0';
  ctx.fillText(label, x, by + bannerH * 0.53);
}

/** How the golden gate shows the band: live (its multiplier), waiting for the lag, blind (mist), resting. */
export type GoldMode = 'live' | 'wait' | 'blind' | 'rest' | 'off';

/**
 * The golden gate: a wide arch on gold posts.  Its arch is the gauge: the band's level fills it
 * from the left post over the top to the right; the threshold is the notch at the top (where ×2
 * begins); beyond it the arch burns gold.  The big number under the arch is the multiplier now.
 */
export function paintGoldGate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: number, o: {
  mult: string; level: number; mode: GoldMode; flash: number; t: number; thr: string; reliable: boolean;
}): void {
  const postH = s * 1.25, half = w / 2;
  const x0 = x - half, x1 = x + half;
  const ay = y - postH;
  // the arch: as wide as the gate, never much taller than a post (a flat arc in a deep perspective)
  const R = half, RY = Math.min(half, s * 0.95);
  const live = o.mode === 'live';
  // ground line
  ctx.fillStyle = 'rgba(120,80,0,.2)';
  ellipse(ctx, x, y, half, s * 0.16);
  ctx.fill();
  // the glow of a working gate
  if (live && o.level >= 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, ay + s * 0.2, R * 1.5, C.goldGlow, 0.22 + 0.4 * Math.min(1, (o.level - 0.5) * 2.5) + 0.25 * o.flash);
    ctx.restore();
  }
  // the gauge arch: a track, then the fill
  const lw = Math.max(3, s * 0.32);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(90,60,10,.45)';
  ctx.lineWidth = lw + 3;
  ctx.beginPath();
  ctx.ellipse(x, ay, R, RY, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#fbefd0';
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(x, ay, R, RY, 0, Math.PI, TAU);
  ctx.stroke();
  if (o.mode !== 'blind' && o.mode !== 'off') {
    const lv = live || o.mode === 'wait' ? Math.max(0, Math.min(1, o.level)) : 0;
    if (lv > 0.005 && o.reliable) {
      const a1 = Math.PI + Math.PI * lv;
      // below the threshold: a cool cream-blue; above it: gold
      ctx.strokeStyle = '#9cc3cf';
      ctx.lineWidth = lw * 0.72;
      ctx.beginPath();
      ctx.ellipse(x, ay, R, RY, 0, Math.PI, Math.min(a1, Math.PI * 1.5));
      ctx.stroke();
      if (lv > 0.5) {
        ctx.strokeStyle = C.gold;
        ctx.beginPath();
        ctx.ellipse(x, ay, R, RY, 0, Math.PI * 1.5, a1);
        ctx.stroke();
      }
      // the needle's bead
      ctx.fillStyle = lv >= 0.5 ? '#fff6d0' : '#e4f0f3';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a1) * R, ay + Math.sin(a1) * RY, lw * 0.55, 0, TAU);
      ctx.fill();
    }
  }
  // the threshold notch at the top of the arch
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, ay - RY - lw * 0.9);
  ctx.lineTo(x, ay - RY + lw * 0.9);
  ctx.stroke();
  if (s > 9) {
    ctx.fillStyle = 'rgba(58,42,24,.85)';
    ctx.font = font(800, Math.max(8, s * 0.3), SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(o.thr, x, ay - RY - lw * 0.95);
  }
  // the posts, gilded
  for (const px of [x0, x1]) {
    ctx.fillStyle = C.goldDeep;
    ctx.fillRect(px - s * 0.13, ay, s * 0.26, y - ay);
    ctx.fillStyle = C.gold;
    ctx.fillRect(px - s * 0.13, ay, s * 0.14, y - ay);
    ctx.fillStyle = C.goldLight;
    ctx.beginPath();
    ctx.arc(px, ay, s * 0.2, 0, TAU);
    ctx.fill();
  }
  // the number
  const big = Math.max(12, Math.min(R * 0.8, s * 1.4));
  const pulse = 1 + 0.12 * o.flash;
  ctx.save();
  ctx.translate(x, ay + s * 0.25);
  ctx.scale(pulse, pulse);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(900, big, SANS);
  const txt = o.mode === 'blind' ? '?' : o.mult;
  ctx.lineWidth = Math.max(2, big * 0.16);
  ctx.strokeStyle = live && o.level >= 0.5 ? '#8a5a00' : 'rgba(70,55,30,.7)';
  ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = live && o.level >= 0.5 ? '#fff3c0' : o.mode === 'blind' ? '#e8eef0' : '#fbf3de';
  ctx.fillText(txt, 0, 0);
  ctx.restore();
  // a resting gate dozes
  if (o.mode === 'rest') {
    ctx.fillStyle = 'rgba(60,80,90,.7)';
    ctx.font = font(800, Math.max(8, s * 0.38), SANS);
    ctx.textAlign = 'left';
    for (let i = 0; i < 3; i++) {
      const k = ((o.t * 0.5 + i / 3) % 1);
      ctx.globalAlpha = 1 - k;
      ctx.fillText('z', x + R * 0.55 + k * s * 0.8, ay - RY * 0.4 - k * s * 1.2);
    }
    ctx.globalAlpha = 1;
  }
}

/** Mist drifting over the golden gate in a blind block. */
export function paintMist(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, a: number): void {
  if (a <= 0.01) return;
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const k = hash(i * 5 + 2);
    const cx = x + (((k * w + t * (8 + 6 * k)) % (w * 1.2)) - w * 0.6);
    const cy = y + h * (0.2 + 0.6 * hash(i * 3));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.35);
    g.addColorStop(0, `rgba(236,242,244,${0.55 * a})`);
    g.addColorStop(1, 'rgba(236,242,244,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - w * 0.35, cy - w * 0.35, w * 0.7, w * 0.7);
  }
  ctx.restore();
}

// ── the gulls and the pelican ──────────────────────────────────────
/** A gull in flight (or floating, `flap` < 0): white body, grey wings with dark tips; Mirka wears a red kerchief. */
export function paintGull(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { flap: number; dir: number; mirka?: boolean; carry?: boolean; float?: boolean; fall?: number }): void {
  const r = s * (o.mirka ? 0.62 : 0.5);
  ctx.save();
  ctx.translate(x, y);
  if (o.fall) ctx.rotate(o.fall * 2.4 * -o.dir);
  ctx.scale(o.dir, 1);
  if (o.float) {
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ellipse(ctx, 0, r * 0.35, r * 1.3, r * 0.2);
    ctx.fill();
  }
  // wings
  const up = o.float ? 0.1 : Math.sin(o.flap);
  ctx.fillStyle = C.gullWing;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.1);
    ctx.quadraticCurveTo(-r * 0.2, -r * (0.2 + up * 1.2) * side * 0 - r * up * 1.1, -r * 1.5, -r * up * 1.4 + side * r * 0.1);
    ctx.lineTo(-r * 0.5, r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.gullTip;
    ctx.beginPath();
    ctx.arc(-r * 1.45, -r * up * 1.35 + side * r * 0.1, r * 0.13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = side < 0 ? C.gullShade : C.gullWing;
  }
  // body and head
  ctx.fillStyle = C.gull;
  ellipse(ctx, 0, 0, r, r * 0.5);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.8, -r * 0.3, r * 0.42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.gullShade;
  ellipse(ctx, -r * 0.2, r * 0.18, r * 0.7, r * 0.22);
  ctx.fill();
  // tail
  ctx.fillStyle = C.gull;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.1);
  ctx.lineTo(-r * 1.35, -r * 0.3);
  ctx.lineTo(-r * 1.3, r * 0.15);
  ctx.closePath();
  ctx.fill();
  // beak and eye
  ctx.fillStyle = C.beak;
  ctx.beginPath();
  ctx.moveTo(r * 1.15, -r * 0.35);
  ctx.lineTo(r * 1.62, -r * 0.24);
  ctx.lineTo(r * 1.15, -r * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(r * 0.92, -r * 0.42, Math.max(0.7, r * 0.08), 0, TAU);
  ctx.fill();
  if (o.mirka) {
    // the red kerchief, and a cheeky eyebrow
    ctx.fillStyle = C.kerchief;
    ctx.beginPath();
    ctx.moveTo(r * 0.45, -r * 0.05);
    ctx.lineTo(r * 1.05, -r * 0.05);
    ctx.lineTo(r * 0.55, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(r * 0.78, -r * 0.6);
    ctx.lineTo(r * 1.05, -r * 0.55);
    ctx.stroke();
  }
  if (o.carry) paintLoaf(ctx, r * 1.55, -r * 0.05, r * 0.4);
  ctx.restore();
}

/** The pelican on the path: a big white bird whose orange pouch swells as he gulps. */
export function paintPelikan(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { pouch: number; gulp: number; t: number; leaving: boolean }): void {
  const r = s * 1.1;
  const bob = Math.sin(o.t * (o.leaving ? 9 : 2)) * r * (o.leaving ? 0.08 : 0.03);
  ctx.fillStyle = 'rgba(30,40,20,.22)';
  ellipse(ctx, x, y + r * 0.1, r * 1.1, r * 0.25);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y + bob);
  // feet
  ctx.fillStyle = C.pouch;
  ellipse(ctx, -r * 0.3, 0, r * 0.22, r * 0.08);
  ctx.fill();
  ellipse(ctx, r * 0.3, 0, r * 0.22, r * 0.08);
  ctx.fill();
  // body
  ctx.fillStyle = C.pelicanShade;
  ellipse(ctx, 0, -r * 0.62, r * 0.95, r * 0.66);
  ctx.fill();
  ctx.fillStyle = C.pelican;
  ellipse(ctx, -r * 0.08, -r * 0.7, r * 0.82, r * 0.58);
  ctx.fill();
  // wing
  ctx.fillStyle = '#e4ddcf';
  ellipse(ctx, -r * 0.35, -r * 0.62, r * 0.5, r * 0.32, 0.3);
  ctx.fill();
  // neck and head
  ctx.fillStyle = C.pelican;
  ellipse(ctx, r * 0.35, -r * 1.3, r * 0.26, r * 0.42);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 1.68, r * 0.3, 0, TAU);
  ctx.fill();
  // the pouch, swelling with what he has gulped
  const p = Math.max(0, Math.min(1, o.pouch)), wob = 1 + 0.15 * o.gulp * Math.sin(o.t * 30);
  ctx.fillStyle = C.pouch;
  ellipse(ctx, r * 0.78, -r * 1.3, r * (0.32 + 0.38 * p) * wob, r * (0.2 + 0.32 * p) * wob);
  ctx.fill();
  ctx.fillStyle = C.pouchDark;
  ctx.beginPath();
  ctx.moveTo(r * 0.55, -r * 1.75);
  ctx.lineTo(r * 1.45, -r * 1.55);
  ctx.lineTo(r * 1.4, -r * 1.48);
  ctx.lineTo(r * 0.55, -r * 1.6);
  ctx.closePath();
  ctx.fill();
  // eye (sheepish when leaving)
  ctx.strokeStyle = '#222';
  ctx.fillStyle = '#222';
  ctx.lineWidth = Math.max(1, r * 0.05);
  if (o.leaving) {
    ctx.beginPath();
    ctx.arc(r * 0.45, -r * 1.74, r * 0.07, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(r * 0.47, -r * 1.74, Math.max(1, r * 0.06), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ── the people ─────────────────────────────────────────────────────
/**
 * A group of the hungry on the grass: seated figures in earthy robes on a cloth; fed, they stand and
 * cheer (`cheer` 0..1 of the cheer's time), then sit content with bread in their hands.
 */
export function paintGroup(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, s: number, o: {
  seed: number; size: number; fed: number; cheer: number; done: boolean; t: number; rest: boolean; active: boolean;
}): void {
  const n = o.size >= 100 ? 9 : 6;
  const cols = o.size >= 100 ? 5 : 3;
  ctx.fillStyle = o.done ? 'rgba(255,246,214,.55)' : 'rgba(250,236,200,.4)';
  ellipse(ctx, cx, cy, w * 0.48, s * 0.55);
  ctx.fill();
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = Math.min(cols, n - row * cols);
    const px = cx + ((col - (inRow - 1) / 2) / Math.max(1, cols - 1)) * w * 0.72 + (hash(o.seed * 31 + i) - 0.5) * s * 0.2;
    const py = cy - s * 0.1 + row * s * 0.5 - (row ? 0 : s * 0.12);
    const robe = C.robes[Math.floor(hash(o.seed * 17 + i) * C.robes.length)];
    const jump = o.cheer > 0 && o.cheer < 1 ? Math.abs(Math.sin((o.cheer * 4 + hash(i)) * Math.PI)) * s * 0.35 : 0;
    const standing = o.cheer > 0 && o.cheer < 1;
    const hgt = standing ? s * 0.8 : s * 0.55;
    const bob = o.rest || o.done ? 0 : Math.sin(o.t * 2 + i) * s * 0.025;
    // the robe, with a darker fold
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(px - s * 0.27, py + bob - jump);
    ctx.quadraticCurveTo(px - s * 0.2, py - hgt - jump + bob, px, py - hgt - jump + bob);
    ctx.quadraticCurveTo(px + s * 0.2, py - hgt - jump + bob, px + s * 0.27, py + bob - jump);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(40,20,10,.18)';
    ctx.beginPath();
    ctx.moveTo(px + s * 0.02, py + bob - jump);
    ctx.quadraticCurveTo(px + s * 0.12, py - hgt * 0.8 - jump + bob, px + s * 0.04, py - hgt - jump + bob);
    ctx.quadraticCurveTo(px + s * 0.22, py - hgt * 0.7 - jump + bob, px + s * 0.27, py + bob - jump);
    ctx.closePath();
    ctx.fill();
    // the head (a scarf for some)
    const hy = py - hgt - s * 0.1 - jump + bob;
    ctx.fillStyle = hash(i * 7 + o.seed) < 0.5 ? C.skin : C.skinLight;
    ctx.beginPath();
    ctx.arc(px, hy, s * 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hash(i * 13 + o.seed) < 0.4 ? (hash(i * 19) < 0.5 ? '#efe4cc' : '#c9874a') : '#3b2618';
    ctx.beginPath();
    ctx.arc(px, hy - s * 0.02, s * 0.16, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    // arms up in the cheer; bread in hand when fed
    if (standing) {
      ctx.strokeStyle = robe;
      ctx.lineWidth = Math.max(1, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(px - s * 0.1, py - hgt * 0.7 - jump);
      ctx.lineTo(px - s * 0.22, py - hgt * 1.15 - jump);
      ctx.moveTo(px + s * 0.1, py - hgt * 0.7 - jump);
      ctx.lineTo(px + s * 0.22, py - hgt * 1.15 - jump);
      ctx.stroke();
    } else if (o.done && i % 2 === 0) paintLoaf(ctx, px + s * 0.16, py - hgt * 0.45, s * 0.1);
  }
}

// ── the boy ────────────────────────────────────────────────────────
/** The boy from behind, his basket held up in front of him; `toss` 0..1 lifts it as he throws. */
export function paintBoy(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { toss: number; t: number; walk: number }): void {
  const lift = Math.sin(Math.min(1, o.toss) * Math.PI) * s * 0.18;
  const sway = Math.sin(o.walk * 8) * s * 0.04;
  // shadow
  ctx.fillStyle = 'rgba(30,40,20,.22)';
  ellipse(ctx, x, y + s * 0.95, s * 0.6, s * 0.16);
  ctx.fill();
  // tunic (back), belt, shoulders
  ctx.fillStyle = C.tunicDark;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5 + sway, y + s * 0.95);
  ctx.quadraticCurveTo(x - s * 0.58, y + s * 0.35, x - s * 0.38, y + s * 0.12);
  ctx.lineTo(x + s * 0.38, y + s * 0.12);
  ctx.quadraticCurveTo(x + s * 0.58, y + s * 0.35, x + s * 0.5 + sway, y + s * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.tunic;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3 + sway, y + s * 0.95);
  ctx.quadraticCurveTo(x - s * 0.4, y + s * 0.4, x - s * 0.26, y + s * 0.14);
  ctx.lineTo(x + s * 0.22, y + s * 0.14);
  ctx.quadraticCurveTo(x + s * 0.32, y + s * 0.4, x + s * 0.18 + sway, y + s * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.belt;
  ctx.fillRect(x - s * 0.45, y + s * 0.55, s * 0.9, s * 0.08);
  // arms up to the basket
  ctx.strokeStyle = C.skin;
  ctx.lineWidth = Math.max(2, s * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.36, y + s * 0.2);
  ctx.lineTo(x - s * 0.5, y - s * 0.12 - lift);
  ctx.moveTo(x + s * 0.36, y + s * 0.2);
  ctx.lineTo(x + s * 0.5, y - s * 0.12 - lift);
  ctx.stroke();
  // the head from behind: dark curls
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(x - s * 0.24, y + s * 0.0, s * 0.07, 0, TAU);
  ctx.arc(x + s * 0.24, y + s * 0.0, s * 0.07, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.02, s * 0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#4e3322';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * s * 0.16, y - s * 0.04 + Math.sin(a) * s * 0.14, s * 0.07, 0, TAU);
    ctx.fill();
  }
}

/** A small basket of the history row: filled to `level` with bread, gold when above the threshold. */
export function paintHistBasket(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, o: { level: number; above: boolean; reliable: boolean; empty: boolean }): void {
  if (o.empty) {
    ctx.strokeStyle = 'rgba(80,60,30,.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ellipse(ctx, x, y, r, r * 0.45);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  if (!o.reliable) {
    // no signal: an empty basket drawn with a dotted rim (the sensor's gap, never a low value)
    ctx.strokeStyle = 'rgba(80,60,30,.6)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.1);
    ctx.quadraticCurveTo(x, y + r * 1.1, x + r, y - r * 0.1);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  const fill = Math.max(0, Math.min(1, o.level));
  // the bread inside, its height the level
  const h = r * 1.5 * fill;
  if (h > 0.5) {
    ctx.fillStyle = o.above ? C.gold : C.crust;
    ellipse(ctx, x, y - h * 0.45, r * 0.78, Math.max(1, h * 0.55));
    ctx.fill();
    if (o.above) {
      ctx.fillStyle = C.goldLight;
      ellipse(ctx, x - r * 0.2, y - h * 0.65, r * 0.3, Math.max(0.6, h * 0.2));
      ctx.fill();
    }
  }
  ctx.fillStyle = o.above ? C.goldDeep : C.wicker;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.1);
  ctx.quadraticCurveTo(x - r * 0.85, y + r * 0.75, x, y + r * 0.75);
  ctx.quadraticCurveTo(x + r * 0.85, y + r * 0.75, x + r, y - r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = o.above ? C.gold : C.wickerLight;
  ellipse(ctx, x, y - r * 0.1, r, r * 0.2);
  ctx.fill();
}

// ── helpers ───────────────────────────────────────────────────────
function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p: number, sh: number) => (p >> sh) & 255;
  const m = (sh: number) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * k);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

/** A five-pointed star (the level's stars). */
export function paintStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, on: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = on ? C.gold : 'rgba(255,255,255,.35)';
  ctx.fill();
  ctx.strokeStyle = on ? C.goldDeep : 'rgba(90,70,40,.4)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();
}

// ── v2: the crowd cannon's cast ────────────────────────────────────
/**
 * A bread-bearer seen from behind as it runs up the hill: a loaf (or a silver fish) on two little
 * kicking legs with tiny arms pumping; a heavier runner (past the crowd cap) carries a stack and a
 * number.  `y` is where its feet touch the grass; `s` = px per u at that depth.
 */
export function paintRunner(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { kind: 'loaf' | 'fish'; step: number; w: number; gold: boolean }): void {
  const r = s * 0.36;
  if (r < 0.8) return;
  const kick = Math.sin(o.step);
  const hop = Math.abs(Math.cos(o.step)) * r * 0.25;
  // shadow
  ctx.fillStyle = 'rgba(30,40,20,.2)';
  ellipse(ctx, x, y, r * 0.9, r * 0.3);
  ctx.fill();
  // legs
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.3, y - r * 0.6 - hop);
  ctx.lineTo(x - r * 0.35 + kick * r * 0.25, y - r * 0.05 - Math.max(0, kick) * r * 0.25);
  ctx.moveTo(x + r * 0.3, y - r * 0.6 - hop);
  ctx.lineTo(x + r * 0.35 - kick * r * 0.25, y - r * 0.05 - Math.max(0, -kick) * r * 0.25);
  ctx.stroke();
  const by = y - r * 1.15 - hop;
  if (o.kind === 'fish') {
    paintFish(ctx, x, by, r * 0.95, kick * 0.6);
  } else {
    // a stack for a heavy runner
    const stack = Math.min(3, o.w >= 4 ? 3 : o.w);
    for (let i = stack - 1; i >= 1; i--) paintLoaf(ctx, x + (i % 2 ? r * 0.25 : -r * 0.25), by - i * r * 0.7, r * 0.85);
    paintLoaf(ctx, x, by, r);
  }
  // arms pumping
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = Math.max(0.8, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, by + r * 0.05);
  ctx.lineTo(x - r * 1.25, by - r * 0.25 + kick * r * 0.3);
  ctx.moveTo(x + r * 0.9, by + r * 0.05);
  ctx.lineTo(x + r * 1.25, by - r * 0.25 - kick * r * 0.3);
  ctx.stroke();
  if (o.gold) {
    ctx.fillStyle = 'rgba(255,226,120,.75)';
    ctx.beginPath();
    ctx.arc(x + r * 0.5, by - r * 0.5, r * 0.22, 0, TAU);
    ctx.fill();
  }
  if (o.w >= 4 && r > 3) {
    ctx.font = font(900, Math.max(8, r * 1.2), SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(60,35,10,.8)';
    ctx.strokeText(`${o.w}`, x, by - r * 2.2);
    ctx.fillStyle = '#fff3c0';
    ctx.fillText(`${o.w}`, x, by - r * 2.2);
  }
}

/** The Big Basket, the champion: a giant basket of bread waddling on little legs, its worth over it. */
export function paintBigBasket(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { step: number; w: number; t: number }): void {
  const r = s * 0.85;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - r, r * 2.4, C.goldGlow, 0.35 + 0.1 * Math.sin(o.t * 6));
  ctx.restore();
  ctx.fillStyle = 'rgba(30,40,20,.25)';
  ellipse(ctx, x, y, r * 1.1, r * 0.3);
  ctx.fill();
  const hop = Math.abs(Math.sin(o.step)) * r * 0.12;
  paintBasket(ctx, x, y - r * 0.95 - hop, r, { fill: 1, legs: o.step / 10, gold: true });
  if (r > 6) {
    ctx.font = font(900, Math.max(10, r * 0.7), SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(90,50,0,.85)';
    ctx.strokeText(`${o.w}`, x, y - r * 2.1 - hop);
    ctx.fillStyle = '#fff3c0';
    ctx.fillText(`${o.w}`, x, y - r * 2.1 - hop);
  }
}

/**
 * A gull on foot, waddling down the hill toward the viewer: white body, folded grey wings, a yellow
 * beak, orange feet; Mirka in her red kerchief, Gerwazy round as a loaf.  Dozing, it sits with its
 * eyes shut; flying off, the caller uses paintGull.
 */
export function paintGullWalk(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { kind: 'gull' | 'fat' | 'mirka'; step: number; doze: boolean; t: number }): void {
  const fat = o.kind === 'fat';
  const r = s * (fat ? 0.78 : 0.48);
  if (r < 0.8) return;
  const sway = o.doze ? 0 : Math.sin(o.step) * 0.12;
  ctx.fillStyle = 'rgba(30,40,20,.22)';
  ellipse(ctx, x, y, r * 0.9, r * 0.28);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  const sit = o.doze ? r * 0.35 : 0;
  // feet
  if (!o.doze) {
    ctx.fillStyle = '#f08a2c';
    const k = Math.sin(o.step) * r * 0.15;
    ellipse(ctx, -r * 0.3, -r * 0.05 + k, r * 0.22, r * 0.1);
    ctx.fill();
    ellipse(ctx, r * 0.3, -r * 0.05 - k, r * 0.22, r * 0.1);
    ctx.fill();
  }
  // body
  ctx.fillStyle = C.gullShade;
  ellipse(ctx, 0, -r * 0.95 + sit, r * (fat ? 1.05 : 0.72), r * (fat ? 0.9 : 0.8));
  ctx.fill();
  ctx.fillStyle = C.gull;
  ellipse(ctx, 0, -r * 0.9 + sit, r * (fat ? 0.85 : 0.55), r * (fat ? 0.78 : 0.68));
  ctx.fill();
  // folded wings
  ctx.fillStyle = C.gullWing;
  for (const side of [-1, 1]) {
    ellipse(ctx, side * r * (fat ? 0.85 : 0.6), -r * 1.0 + sit, r * 0.28, r * 0.6, side * 0.25);
    ctx.fill();
  }
  // head
  const hy = -r * (fat ? 1.85 : 1.75) + sit;
  ctx.fillStyle = C.gull;
  ctx.beginPath();
  ctx.arc(0, hy, r * 0.45, 0, TAU);
  ctx.fill();
  if (o.kind === 'mirka') {
    ctx.fillStyle = C.kerchief;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, hy + r * 0.3);
    ctx.lineTo(r * 0.45, hy + r * 0.3);
    ctx.lineTo(0, hy + r * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  // eyes (shut when dozing) and the beak pointing at us
  ctx.strokeStyle = '#222';
  ctx.fillStyle = '#222';
  ctx.lineWidth = Math.max(0.8, r * 0.07);
  for (const side of [-1, 1]) {
    if (o.doze) {
      ctx.beginPath();
      ctx.arc(side * r * 0.2, hy - r * 0.05, r * 0.1, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(side * r * 0.2, hy - r * 0.08, Math.max(0.7, r * 0.08), 0, TAU);
      ctx.fill();
    }
  }
  if (!o.doze && (o.kind === 'mirka' || fat)) {
    // a cheeky (or greedy) eyebrow
    ctx.beginPath();
    ctx.moveTo(-r * 0.32, hy - r * 0.28);
    ctx.lineTo(-r * 0.08, hy - r * 0.22);
    ctx.moveTo(r * 0.32, hy - r * 0.28);
    ctx.lineTo(r * 0.08, hy - r * 0.22);
    ctx.stroke();
  }
  ctx.fillStyle = C.beak;
  ctx.beginPath();
  ctx.moveTo(-r * 0.14, hy + r * 0.05);
  ctx.lineTo(r * 0.14, hy + r * 0.05);
  ctx.lineTo(0, hy + r * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d6453a';
  ctx.beginPath();
  ctx.arc(0, hy + r * 0.3, r * 0.05, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (o.doze && s > 6) {
    ctx.fillStyle = 'rgba(60,80,90,.75)';
    ctx.font = font(800, Math.max(8, r * 0.8), SANS);
    ctx.textAlign = 'left';
    const k = (o.t * 0.6 + x * 0.01) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.fillText('z', x + r * 0.5 + k * r, y - r * 2.2 - k * r * 1.5);
    ctx.globalAlpha = 1;
  }
}

/**
 * A table of the hungry (the "base"): a cloth on the grass with the group around it and the hunger
 * over them — a bar that empties as they eat and the number of people still hungry.  Fed, they stand
 * and cheer (`cheer` counts up from 0), then sit content; in a rest they sit down neatly.
 */
export function paintTable(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, s: number, o: {
  seed: number; hunger: number; full: number; fed: boolean; bite: number; cheer: number; rest: boolean; t: number; label: string;
}): void {
  // the cloth
  ctx.fillStyle = '#efe4cc';
  ctx.beginPath();
  ctx.roundRect(cx - w * 0.42, cy - s * 0.35, w * 0.84, s * 0.7, s * 0.2);
  ctx.fill();
  ctx.strokeStyle = C.kerchief;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.setLineDash([s * 0.15, s * 0.12]);
  ctx.stroke();
  ctx.setLineDash([]);
  const cheering = o.fed && o.cheer < 1.6;
  paintGroup(ctx, cx, cy - s * 0.05 + (o.bite < 0.15 && !o.fed ? -s * 0.05 : 0), w, s * 0.9, {
    seed: o.seed, size: w > s * 5 ? 100 : 50, fed: 0, cheer: cheering ? o.cheer / 1.6 : 0, done: o.fed && !cheering, t: o.t, rest: o.rest, active: !o.fed,
  });
  // the hunger bar
  const bw = Math.min(w * 0.7, s * 5), bh = Math.max(6, s * 0.36);
  const by = cy - s * 1.9;
  const k = o.full > 0 ? Math.max(0, Math.min(1, o.hunger / o.full)) : 0;
  if (!o.fed) {
    ctx.fillStyle = 'rgba(40,25,10,.55)';
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2 - 2, by - bh / 2 - 2, bw + 4, bh + 4, bh);
    ctx.fill();
    ctx.fillStyle = '#fbefd8';
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, by - bh / 2, bw, bh, bh / 2);
    ctx.fill();
    if (k > 0.002) {
      ctx.fillStyle = o.bite < 0.12 ? '#ffb070' : '#e2793a';
      ctx.beginPath();
      ctx.roundRect(cx - bw / 2, by - bh / 2, Math.max(bh, bw * k), bh, bh / 2);
      ctx.fill();
    }
    // the number of the hungry: at least 13 px (layout.ts tableLabelPx keeps room for it under the HUD)
    ctx.font = font(900, Math.max(13, bh * 1.35), SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(50,30,10,.75)';
    ctx.strokeText(o.label, cx, by - bh * 0.7);
    ctx.fillStyle = '#fff6e0';
    ctx.fillText(o.label, cx, by - bh * 0.7);
  } else {
    const a = Math.max(0, 1 - Math.max(0, o.cheer - 1.2));
    if (a > 0) {
      ctx.globalAlpha = a;
      ctx.fillStyle = C.green;
      ctx.beginPath();
      ctx.arc(cx, by, bh * 1.1, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(2, bh * 0.3);
      ctx.beginPath();
      ctx.moveTo(cx - bh * 0.5, by);
      ctx.lineTo(cx - bh * 0.1, by + bh * 0.4);
      ctx.lineTo(cx + bh * 0.55, by - bh * 0.45);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
