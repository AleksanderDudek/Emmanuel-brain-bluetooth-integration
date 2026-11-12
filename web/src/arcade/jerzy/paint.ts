/**
 * Jerzy i smok's painter, in the warm colours of an illuminated chronicle — parchment, sage and
 * meadow green, ultramarine, vermilion and gold leaf: the four arenas seen from above (a meadow by
 * the cave, a marsh, a stony pass, the castle's flagstones), the fence with its pennants, the cave,
 * and the figures standing on them — the knight (a gold sun on his tabard, never a cross), the
 * dragons (big, round-eyed beasts, a little comic, nothing a child could not look at), Princess
 * Linda, the white horse, fire, steam, apples, the dragon's brood (round-eyed chicks, lizards,
 * spitters, armoured plodders, ember beetles that dissolve into smoke when beaten), scales, chests,
 * the items' little pictures, and the endless field of each land.  All canvas paths, no images;
 * sizes in u (about a metre) times `s` (px per u).
 */
import { MIN_TEXT } from '../kit/mobile';
import type { ArenaKind, BroodKind, DragonKind, ItemId } from './content';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
/** A canvas font, never under the kit's floor (MIN_TEXT, 11 px): smaller text is a smudge on a phone. */
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(Math.max(MIN_TEXT, size) * 10) / 10}px ${family}`;

export const C = {
  ink: '#2a2233', inkSoft: 'rgba(42,34,51,.78)', parchment: '#f4e8c8', parchmentDeep: '#e6d3a4',
  gold: '#e2b23c', goldDeep: '#b9851c', goldLight: '#ffe7a3', vermilion: '#d2462f', vermilionDeep: '#9e2f20',
  ultramarine: '#2f4f9e', ultraDeep: '#1f3470', sage: '#7fa36a', steel: '#c9d1dc', steelDark: '#7d8796',
  fire: '#ff8a3d', fireHot: '#ffd08a', ember: '#c8361e', calm: '#7fa7e0', calmDeep: '#46689f',
  skin: '#f1c9a5', cheek: '#e8988a', hair: '#b4472a', gown: '#4f8a55', gownDeep: '#386a40', danger: 'rgba(214,52,36,',
};

export type RGB = [number, number, number];

/** A stable pseudo-random number 0..1 from an integer. */
export function hash(i: number): number {
  let x = (i | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const TAU = Math.PI * 2;

/** Each glow colour baked once into a small offscreen sprite (a phone's fill rate: no gradient made per frame). */
const GLOW_R = 64;
const glowSprites = new Map<string, HTMLCanvasElement | null>();

function glowSprite(color: string): HTMLCanvasElement | null {
  const had = glowSprites.get(color);
  if (had !== undefined) return had;
  let sprite: HTMLCanvasElement | null = null;
  try {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = c.height = GLOW_R * 2;
      const g = c.getContext('2d');
      if (g) {
        const grad = g.createRadialGradient(GLOW_R, GLOW_R, 0, GLOW_R, GLOW_R, GLOW_R);
        grad.addColorStop(0, `${color}1)`);
        grad.addColorStop(0.45, `${color}0.45)`);
        grad.addColorStop(1, `${color}0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, GLOW_R * 2, GLOW_R * 2);
        sprite = c;
      }
    }
  } catch {
    sprite = null;
  }
  glowSprites.set(color, sprite);
  return sprite;
}

/** A soft radial glow (additive where the caller sets 'lighter'): `color` is an "rgba(r,g,b," prefix, `a` its peak alpha. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  if (a <= 0.003 || r <= 0) return;
  const sprite = glowSprite(color);
  if (sprite) {
    const was = ctx.globalAlpha;
    ctx.globalAlpha = was * Math.min(1, a);
    ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = was;
    return;
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${color}${a})`);
  g.addColorStop(0.45, `${color}${a * 0.45})`);
  g.addColorStop(1, `${color}0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  ctx.fill();
}

// ── the arenas ────────────────────────────────────────────────────
const GROUND: Record<ArenaKind, { a: string; b: string; edge: string; dot: string }> = {
  meadow: { a: '#9cc472', b: '#7eaa5a', edge: '#5f8a46', dot: '#cfe39c' },
  marsh: { a: '#8ea777', b: '#6c8a62', edge: '#4c6b52', dot: '#b9c98f' },
  pass: { a: '#c9b68d', b: '#a8946f', edge: '#7e6d55', dot: '#e8dcc0' },
  castle: { a: '#c4b8a2', b: '#a69a84', edge: '#7a6f5e', dot: '#ddd3bf' },
  ash: { a: '#b49c86', b: '#94806d', edge: '#6a5848', dot: '#dcc6ab' },
  hoard: { a: '#d5ccae', b: '#bcae88', edge: '#857852', dot: '#ede4c6' },
};

const CANOPY: Record<ArenaKind, [string, string]> = {
  meadow: ['#3f6b35', '#5a8a45'], marsh: ['#3c5a45', '#557a58'], pass: ['#6b6252', '#8a7f6a'], castle: ['#6d6455', '#8c8270'],
  ash: ['#4f4139', '#6c5949'], hoard: ['#7b6a3f', '#9c8a56'],
};

/**
 * The land beyond the fence, in the arena's own colours, darker: seen from above, with tree crowns
 * (rocks on the pass, towers' stones by the castle) scattered around the arena's box (px), never on it.
 */
export function paintSurround(ctx: CanvasRenderingContext2D, w: number, h: number, kind: ArenaKind, arena?: { x: number; y: number; w: number; h: number }, s = 40): void {
  const g = GROUND[kind];
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, g.edge);
  grad.addColorStop(1, '#2c3527');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const [dark, light] = CANOPY[kind];
  const r0 = Math.max(10, s * 0.55);
  for (let i = 0; i < 90; i++) {
    const x = hash(i * 11 + 3) * w, y = hash(i * 7 + 5) * h, r = r0 * (0.6 + hash(i) * 0.8);
    if (arena && x > arena.x - r * 0.6 && x < arena.x + arena.w + r * 0.6 && y > arena.y - r * 0.6 && y < arena.y + arena.h + r * 0.6) continue;
    ellipse(ctx, x + r * 0.25, y + r * 0.3, r, r * 0.9, 'rgba(10,15,8,.28)');
    if (kind === 'pass' || kind === 'castle' || kind === 'ash' || kind === 'hoard') {
      ellipse(ctx, x, y, r * 0.9, r * 0.7, dark);
      ellipse(ctx, x - r * 0.2, y - r * 0.2, r * 0.5, r * 0.35, light);
    } else {
      ellipse(ctx, x, y, r, r, dark);
      ellipse(ctx, x - r * 0.25, y - r * 0.25, r * 0.6, r * 0.6, light);
      ellipse(ctx, x - r * 0.35, y - r * 0.35, r * 0.22, r * 0.22, 'rgba(255,255,220,.12)');
    }
  }
}

/** The arena's floor, `x0, y0` its top-left corner (px), `w × h` u at `s` px per u; its decorations are fixed by `seed`. */
export function paintArena(ctx: CanvasRenderingContext2D, kind: ArenaKind, x0: number, y0: number, w: number, h: number, s: number, t: number): void {
  const g = GROUND[kind], W = w * s, H = h * s;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, W, H, s * 0.5);
  ctx.clip();
  const grad = ctx.createRadialGradient(x0 + W / 2, y0 + H * 0.55, s, x0 + W / 2, y0 + H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, g.a);
  grad.addColorStop(1, g.b);
  ctx.fillStyle = grad;
  ctx.fillRect(x0, y0, W, H);
  if (kind === 'castle') {
    // flagstones
    ctx.strokeStyle = 'rgba(80,70,55,.28)';
    ctx.lineWidth = 1;
    for (let r = 0; r < h; r++) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + r * s);
      ctx.lineTo(x0 + W, y0 + r * s);
      ctx.stroke();
      for (let c = 0; c <= w; c++) {
        const x = x0 + (c + (r % 2) * 0.5) * s;
        ctx.beginPath();
        ctx.moveTo(x, y0 + r * s);
        ctx.lineTo(x, y0 + (r + 1) * s);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(255,250,235,${0.05 + hash(i) * 0.08})`;
      ctx.fillRect(x0 + Math.floor(hash(i * 3) * w) * s + 2, y0 + Math.floor(hash(i * 5) * h) * s + 2, s - 4, s - 4);
    }
  }
  if (kind === 'marsh') {
    // pools of still water with reeds
    for (let i = 0; i < 7; i++) {
      const px = x0 + (0.8 + hash(i * 13) * (w - 1.6)) * s, py = y0 + (1.2 + hash(i * 17) * (h - 2)) * s, rr = (0.45 + hash(i * 19) * 0.6) * s;
      ellipse(ctx, px, py, rr, rr * 0.55, 'rgba(70,110,110,.55)');
      ellipse(ctx, px - rr * 0.2, py - rr * 0.12, rr * 0.5, rr * 0.18, 'rgba(200,230,230,.25)');
      ctx.strokeStyle = '#4d6b3a';
      ctx.lineWidth = Math.max(1, s * 0.04);
      for (let k = 0; k < 4; k++) {
        const rx = px + rr * (0.8 + 0.2 * k) * (k % 2 ? 1 : -1), sway = Math.sin(t * 1.3 + i + k) * s * 0.05;
        ctx.beginPath();
        ctx.moveTo(rx, py);
        ctx.quadraticCurveTo(rx + sway, py - s * 0.3, rx + sway * 2, py - s * (0.45 + 0.1 * k));
        ctx.stroke();
      }
    }
  }
  if (kind === 'pass') {
    // rocks and patches of old snow
    for (let i = 0; i < 9; i++) {
      const px = x0 + hash(i * 23) * W, py = y0 + hash(i * 29) * H, rr = (0.2 + hash(i * 31) * 0.4) * s;
      ellipse(ctx, px, py, rr * 1.6, rr * 0.8, 'rgba(250,252,255,.55)');
    }
    for (let i = 0; i < 10; i++) {
      const px = x0 + hash(i * 37 + 1) * W, py = y0 + hash(i * 41 + 1) * H, rr = (0.12 + hash(i * 43) * 0.22) * s;
      ellipse(ctx, px + rr * 0.2, py + rr * 0.3, rr, rr * 0.6, 'rgba(60,50,40,.25)');
      ellipse(ctx, px, py, rr, rr * 0.75, '#9b8c76');
      ellipse(ctx, px - rr * 0.25, py - rr * 0.25, rr * 0.45, rr * 0.3, '#c2b59e');
    }
  }
  if (kind === 'ash' || kind === 'hoard') {
    for (let i = 0; i < 26; i++) {
      const px = x0 + hash(i * 61 + 5) * W, py = y0 + hash(i * 67 + 9) * H;
      if (kind === 'ash') ellipse(ctx, px, py, s * 0.06, s * 0.045, `rgba(255,${130 + (i % 3) * 30},60,.75)`);
      else ellipse(ctx, px, py, s * 0.08, s * 0.05, '#e8b83c');
    }
  }
  // tufts, flowers and pebbles everywhere but on the flagstones, the ash and the gold
  if (kind !== 'castle' && kind !== 'ash' && kind !== 'hoard') {
    for (let i = 0; i < 70; i++) {
      const px = x0 + hash(i * 3 + 7) * W, py = y0 + hash(i * 5 + 11) * H;
      ctx.strokeStyle = 'rgba(40,70,30,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - s * 0.06, py);
      ctx.lineTo(px - s * 0.09, py - s * 0.12);
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - s * 0.16);
      ctx.moveTo(px + s * 0.06, py);
      ctx.lineTo(px + s * 0.1, py - s * 0.11);
      ctx.stroke();
    }
    if (kind === 'meadow') {
      const colors = ['#fff6d8', '#f2c94c', '#e98aa0', '#ffffff', '#b9a6e8'];
      for (let i = 0; i < 40; i++) {
        const px = x0 + hash(i * 47 + 3) * W, py = y0 + hash(i * 53 + 3) * H;
        ellipse(ctx, px, py, s * 0.05, s * 0.05, colors[i % colors.length]);
      }
    }
  }
  // a soft vignette at the arena's rim
  const v = ctx.createRadialGradient(x0 + W / 2, y0 + H / 2, Math.min(W, H) * 0.35, x0 + W / 2, y0 + H / 2, Math.max(W, H) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(30,25,15,.22)');
  ctx.fillStyle = v;
  ctx.fillRect(x0, y0, W, H);
  ctx.restore();
  ctx.strokeStyle = g.edge;
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.roundRect(x0, y0, W, H, s * 0.5);
  ctx.stroke();
}

/** The cave's mouth in a rocky outcrop (the dragon's nap), centred at (x, y). */
export function paintCave(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: ArenaKind): void {
  const rock = kind === 'castle' ? '#8a7f70' : kind === 'pass' ? '#857865' : '#7b7466';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI, rr = s * (1.05 + 0.25 * hash(i + 3));
    ellipse(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75 + s * 0.2, s * 0.5, s * 0.4, rock);
    ellipse(ctx, x + Math.cos(a) * rr - s * 0.1, y + Math.sin(a) * rr * 0.75 + s * 0.08, s * 0.25, s * 0.16, 'rgba(255,255,255,.18)');
  }
  ctx.fillStyle = '#231c1a';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.3, s * 0.85, s * 0.7, 0, Math.PI, TAU);
  ctx.lineTo(x + s * 0.85, y + s * 0.42);
  ctx.lineTo(x - s * 0.85, y + s * 0.42);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, x, y + s * 0.4, s * 0.85, s * 0.14, 'rgba(35,28,26,.6)');
}

/** The fence along the arena's top: a rail and posts, from x0 to x1 at y (px). */
export function paintFence(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, s: number): void {
  ctx.fillStyle = '#7a5434';
  ctx.fillRect(x0, y - s * 0.06, x1 - x0, s * 0.08);
  ctx.fillStyle = 'rgba(255,230,190,.25)';
  ctx.fillRect(x0, y - s * 0.06, x1 - x0, s * 0.025);
}

/**
 * A pennant on its pole at the fence (the history: one a second).  `len` 0..1 is the flag's length
 * (the level), `color` its cloth; `shown` fades it in after a veil; the pole stands at (x, y).
 */
export function paintPennant(ctx: CanvasRenderingContext2D, x: number, y: number, poleH: number, len: number, color: string, t: number, shown = 1): void {
  ctx.strokeStyle = '#5b3d25';
  ctx.lineWidth = Math.max(1, poleH * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - poleH);
  ctx.stroke();
  if (shown <= 0.01 || len <= 0.01) return;
  ctx.globalAlpha = Math.min(1, shown);
  const fl = poleH * (0.25 + 0.75 * Math.min(1, len)), fh = poleH * 0.34;
  const wave = Math.sin(t * 4 + x * 0.05) * fh * 0.12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - poleH);
  ctx.quadraticCurveTo(x + fl * 0.5, y - poleH + wave, x + fl, y - poleH + fh * 0.5 + wave);
  ctx.quadraticCurveTo(x + fl * 0.5, y - poleH + fh + wave * 0.5, x, y - poleH + fh);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── the knight ────────────────────────────────────────────────────
export interface KnightPose {
  /** +1 facing right, −1 left */
  flip: number;
  /** the walk's phase (rad), 0..1 walking */
  step: number; walking: number;
  /** the strike's swing (1 → 0), the roll (0..1 through it), knocked down (0..1), a hit's flash */
  swing: number; roll: number; down: number; hit: number;
  /** the Miecz światła's charge (0..1) and whether it is ready */
  charge: number; ready: boolean;
  t: number;
}

/** A gold sun: the emblem on the tabard and the shield (never a cross). */
function sun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU, rr = i % 2 ? r * 0.62 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, x, y, r * 0.42, r * 0.42, C.goldLight);
}

/** The knight standing with his feet at (x, y), about 1.3 u tall. */
export function paintKnight(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: KnightPose): void {
  ellipse(ctx, x, y, s * 0.36, s * 0.13, 'rgba(20,20,10,.3)');
  ctx.save();
  ctx.translate(x, y);
  if (p.down > 0) {
    ctx.rotate(p.flip * -Math.PI / 2 * Math.min(1, p.down * 3));
    ctx.translate(0, -s * 0.12);
  } else if (p.roll > 0) {
    ctx.translate(0, -s * 0.4);
    ctx.rotate(p.flip * p.roll * TAU);
    ctx.scale(0.8, 0.8);
    ctx.translate(0, s * 0.4);
  }
  ctx.scale(p.flip, 1);
  const bob = p.walking * Math.abs(Math.sin(p.step)) * s * 0.05;
  ctx.translate(0, -bob);
  // legs
  const leg = Math.sin(p.step) * p.walking * s * 0.1;
  ctx.fillStyle = C.steelDark;
  ctx.fillRect(-s * 0.15 + leg, -s * 0.36, s * 0.1, s * 0.36);
  ctx.fillRect(s * 0.05 - leg, -s * 0.36, s * 0.1, s * 0.36);
  ctx.fillStyle = '#4a3a2c';
  ctx.fillRect(-s * 0.17 + leg, -s * 0.06, s * 0.14, s * 0.07);
  ctx.fillRect(s * 0.03 - leg, -s * 0.06, s * 0.14, s * 0.07);
  // the sword arm behind: the sword swings from up to forward
  const sw = p.swing;
  const swordA = -1.9 + (1 - sw) * 0 + sw * 2.4;
  ctx.save();
  ctx.translate(-s * 0.18, -s * 0.78);
  ctx.rotate(-Math.PI / 2 + (p.swing > 0 ? swordA : -0.5) + Math.PI / 2);
  // the blade's glow: the Miecz światła's charge (baked glows along the blade, no per-frame blur)
  if (p.charge > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = p.ready ? 1 + 0.3 * Math.sin(p.t * 10) : 1;
    const gr = s * (0.16 + 0.3 * p.charge) * pulse, ga = (0.3 + 0.5 * p.charge) * (p.ready ? 1 : 0.8);
    const col = p.ready ? 'rgba(255,230,140,' : 'rgba(255,214,120,';
    glow(ctx, 0, -s * 0.78, gr, col, ga);
    glow(ctx, 0, -s * 0.5, gr, col, ga * 0.85);
    glow(ctx, 0, -s * 0.24, gr * 0.8, col, ga * 0.6);
    ctx.fillStyle = `rgba(255,236,170,${0.25 + 0.6 * p.charge})`;
    ctx.fillRect(-s * 0.06, -s * 0.95, s * 0.12, s * 0.8);
    ctx.restore();
  }
  ctx.fillStyle = p.ready ? '#fffbe8' : '#e8eef5';
  ctx.beginPath();
  ctx.moveTo(-s * 0.035, -s * 0.15);
  ctx.lineTo(-s * 0.035, -s * 0.85);
  ctx.lineTo(0, -s * 0.95);
  ctx.lineTo(s * 0.035, -s * 0.85);
  ctx.lineTo(s * 0.035, -s * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.goldDeep;
  ctx.fillRect(-s * 0.12, -s * 0.17, s * 0.24, s * 0.05);
  ctx.fillStyle = '#6b4a2c';
  ctx.fillRect(-s * 0.03, -s * 0.13, s * 0.06, s * 0.13);
  ctx.restore();
  // the body: mail and the ultramarine tabard with the gold sun
  ctx.fillStyle = C.steel;
  ctx.beginPath();
  ctx.roundRect(-s * 0.24, -s * 0.9, s * 0.48, s * 0.58, s * 0.12);
  ctx.fill();
  ctx.fillStyle = p.hit > 0 ? '#ffffff' : C.ultramarine;
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.86);
  ctx.lineTo(s * 0.2, -s * 0.86);
  ctx.lineTo(s * 0.24, -s * 0.3);
  ctx.lineTo(-s * 0.24, -s * 0.3);
  ctx.closePath();
  ctx.fill();
  sun(ctx, 0, -s * 0.6, s * 0.11);
  ctx.fillStyle = '#5b3d25';
  ctx.fillRect(-s * 0.22, -s * 0.42, s * 0.44, s * 0.05);
  // the head: a round helmet with a visor and a vermilion plume
  ctx.fillStyle = C.steel;
  ctx.beginPath();
  ctx.arc(0, -s * 1.07, s * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#9aa5b4';
  ctx.beginPath();
  ctx.arc(0, -s * 1.07, s * 0.2, -0.2, Math.PI * 0.55);
  ctx.lineTo(0, -s * 1.07);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.fillRect(s * 0.02, -s * 1.1, s * 0.17, s * 0.035);
  ctx.fillStyle = C.vermilion;
  const plume = Math.sin(p.t * 6) * s * 0.03 * (0.4 + p.walking);
  ctx.beginPath();
  ctx.moveTo(-s * 0.04, -s * 1.25);
  ctx.quadraticCurveTo(-s * 0.3 + plume, -s * 1.45, -s * 0.42 + plume, -s * 1.15);
  ctx.quadraticCurveTo(-s * 0.22, -s * 1.28, -s * 0.06, -s * 1.18);
  ctx.fill();
  // the shield in front: a vermilion kite with the sun
  ctx.save();
  ctx.translate(s * 0.26, -s * 0.66);
  ctx.fillStyle = '#e9e0cf';
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, -s * 0.2);
  ctx.lineTo(s * 0.16, -s * 0.2);
  ctx.quadraticCurveTo(s * 0.17, s * 0.12, 0, s * 0.3);
  ctx.quadraticCurveTo(-s * 0.17, s * 0.12, -s * 0.16, -s * 0.2);
  ctx.fill();
  ctx.fillStyle = C.vermilion;
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, -s * 0.17);
  ctx.lineTo(s * 0.13, -s * 0.17);
  ctx.quadraticCurveTo(s * 0.14, s * 0.1, 0, s * 0.26);
  ctx.quadraticCurveTo(-s * 0.14, s * 0.1, -s * 0.13, -s * 0.17);
  ctx.fill();
  sun(ctx, 0, -s * 0.01, s * 0.07);
  ctx.restore();
  ctx.restore();
}

// ── the dragons ───────────────────────────────────────────────────
interface Hide { body: string; dark: string; belly: string; wing: string; spike: string; eye: string }
const HIDES: Record<DragonKind, Hide> = {
  zielony: { body: '#5f9a4a', dark: '#3f6e33', belly: '#e8dca0', wing: '#8bb86b', spike: '#e2b23c', eye: '#ffd24a' },
  bagienny: { body: '#5d7f73', dark: '#3c5a52', belly: '#c9c49a', wing: '#7f9a7c', spike: '#a7b45a', eye: '#ffb84a' },
  skrzydlaty: { body: '#5a6496', dark: '#3a416c', belly: '#d7cfe6', wing: '#8a7fc0', spike: '#f0c8a0', eye: '#ffd24a' },
  trzyglowy: { body: '#9a4a52', dark: '#6c2f38', belly: '#efcf9a', wing: '#c06a62', spike: '#e2b23c', eye: '#ffe08a' },
  zarowy: { body: '#b8502e', dark: '#7c2c1a', belly: '#ffcf7a', wing: '#de7442', spike: '#ffd24a', eye: '#fff3a0' },
  zloty: { body: '#e39a2a', dark: '#9a5c12', belly: '#fff0c4', wing: '#f2b444', spike: '#fff6d2', eye: '#47b8a6' },
};

export interface DragonPose {
  kind: DragonKind;
  /** +1 facing right, −1 left */
  flip: number;
  /** body radius (u), height in flight (0..1), the jaw (0..1), wings up (0..1) */
  r: number; air: number; jaw: number; wings: number;
  /** a hit's flash, the scales still on it (0..1), asleep (0..1), dizzy or coughing (0..1) */
  hit: number; scales: number; sleep: number; daze: number;
  /** the three-headed one: heads still awake (1..3) */
  heads: number;
  t: number;
  /** v3: glowing hot after his ring of fire (0..1) */
  hot?: number;
}

function paintHead(ctx: CanvasRenderingContext2D, hx: number, hy: number, s: number, hide: Hide, p: DragonPose, sleepy: boolean, tilt: number): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  // horns
  ctx.fillStyle = hide.spike;
  ctx.beginPath();
  ctx.moveTo(-s * 0.18, -s * 0.2);
  ctx.lineTo(-s * 0.42, -s * 0.48);
  ctx.lineTo(-s * 0.06, -s * 0.26);
  ctx.fill();
  // the skull and the snout
  ellipse(ctx, 0, 0, s * 0.34, s * 0.27, hide.body);
  ellipse(ctx, s * 0.3, s * 0.06, s * 0.28, s * 0.17, hide.body);
  // the jaw
  const jaw = p.jaw * s * 0.18;
  ctx.fillStyle = hide.dark;
  ctx.beginPath();
  ctx.moveTo(-s * 0.05, s * 0.12);
  ctx.quadraticCurveTo(s * 0.3, s * 0.2 + jaw, s * 0.52, s * 0.14 + jaw);
  ctx.lineTo(s * 0.5, s * 0.2 + jaw);
  ctx.quadraticCurveTo(s * 0.25, s * 0.3 + jaw, -s * 0.08, s * 0.2);
  ctx.closePath();
  ctx.fill();
  if (p.jaw > 0.1) {
    ctx.fillStyle = '#7a2a22';
    ctx.beginPath();
    ctx.moveTo(s * 0.05, s * 0.14);
    ctx.lineTo(s * 0.5, s * 0.12);
    ctx.lineTo(s * 0.48, s * 0.14 + jaw);
    ctx.closePath();
    ctx.fill();
  }
  // nostrils
  ellipse(ctx, s * 0.5, s * 0.0, s * 0.03, s * 0.022, hide.dark);
  // the eye: big and round, a little comic; closed when asleep
  if (sleepy) {
    ctx.strokeStyle = hide.dark;
    ctx.lineWidth = Math.max(1.2, s * 0.035);
    ctx.beginPath();
    ctx.arc(s * 0.04, -s * 0.05, s * 0.08, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ellipse(ctx, s * 0.04, -s * 0.06, s * 0.11, s * 0.12, '#fffbe8');
    const wob = p.daze > 0 ? Math.sin(p.t * 9) * s * 0.03 : 0;
    ellipse(ctx, s * 0.07 + wob, -s * 0.05 + (p.daze > 0 ? Math.cos(p.t * 9) * s * 0.03 : 0), s * 0.055, s * 0.07, hide.eye);
    ellipse(ctx, s * 0.08 + wob, -s * 0.05, s * 0.025, s * 0.045, '#1d1410');
    ellipse(ctx, s * 0.05, -s * 0.1, s * 0.02, s * 0.02, '#ffffff');
    // a brow: grumpy
    ctx.strokeStyle = hide.dark;
    ctx.lineWidth = Math.max(1.2, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.2);
    ctx.lineTo(s * 0.16, -s * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

/** A dragon standing with its body's centre on the ground at (x, y); `s` px per u. */
export function paintDragon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: DragonPose): void {
  const hide = HIDES[p.kind], r = p.r, lift = p.air * s * 1.6;
  // the shadow on the ground (smaller in flight)
  ellipse(ctx, x, y + s * r * 0.35, s * r * (1.3 - 0.5 * p.air), s * r * (0.42 - 0.15 * p.air), `rgba(20,20,10,${0.32 - 0.14 * p.air})`);
  ctx.save();
  ctx.translate(x, y + s * r * 0.3 - lift);
  ctx.scale(p.flip, 1);
  const S = s * r;
  const breathe = Math.sin(p.t * (p.sleep > 0.5 ? 1.2 : 2.4)) * S * 0.02;
  // the tail with its spikes
  ctx.strokeStyle = hide.body;
  ctx.lineCap = 'round';
  ctx.lineWidth = S * 0.32;
  const tw = Math.sin(p.t * 2.2) * S * 0.15;
  ctx.beginPath();
  ctx.moveTo(-S * 0.6, -S * 0.45);
  ctx.quadraticCurveTo(-S * 1.4, -S * 0.2 + tw, -S * 1.6, -S * 0.75 - tw);
  ctx.stroke();
  ctx.lineWidth = S * 0.16;
  ctx.beginPath();
  ctx.moveTo(-S * 1.55, -S * 0.7 - tw);
  ctx.lineTo(-S * 1.75, -S * 1.0 - tw);
  ctx.stroke();
  ctx.fillStyle = hide.spike;
  ctx.beginPath();
  ctx.moveTo(-S * 1.75, -S * 1.18 - tw);
  ctx.lineTo(-S * 1.9, -S * 0.9 - tw);
  ctx.lineTo(-S * 1.6, -S * 0.95 - tw);
  ctx.closePath();
  ctx.fill();
  // the far wing
  const wingUp = p.wings * S * 0.6 + Math.sin(p.t * (p.air > 0.2 ? 9 : 1.5)) * S * (p.air > 0.2 ? 0.3 : 0.05);
  const wing = (dx: number, col: string, k: number) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(dx - S * 0.2, -S * 0.85);
    ctx.lineTo(dx - S * 0.55 * k, -S * 1.75 - wingUp);
    ctx.lineTo(dx + S * 0.35 * k, -S * 1.45 - wingUp * 0.8);
    ctx.lineTo(dx + S * 0.75 * k, -S * 1.6 - wingUp * 0.6);
    ctx.quadraticCurveTo(dx + S * 0.6, -S * 1.0, dx + S * 0.3, -S * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hide.dark;
    ctx.lineWidth = Math.max(1, S * 0.04);
    ctx.beginPath();
    ctx.moveTo(dx - S * 0.2, -S * 0.85);
    ctx.lineTo(dx - S * 0.55 * k, -S * 1.75 - wingUp);
    ctx.moveTo(dx - S * 0.1, -S * 0.85);
    ctx.lineTo(dx + S * 0.35 * k, -S * 1.45 - wingUp * 0.8);
    ctx.stroke();
  };
  const wingK = p.kind === 'skrzydlaty' ? 1.35 : 1;
  wing(-S * 0.25, hide.dark, wingK);
  // the far legs
  ctx.fillStyle = hide.dark;
  ctx.beginPath();
  ctx.roundRect(-S * 0.55, -S * 0.45, S * 0.24, S * 0.48, S * 0.1);
  ctx.roundRect(S * 0.3, -S * 0.45, S * 0.24, S * 0.48, S * 0.1);
  ctx.fill();
  // the body and the belly
  ellipse(ctx, 0, -S * 0.62 + breathe, S * 0.9, S * 0.52, p.hit > 0 ? '#ffffff' : hide.body);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -S * 0.62 + breathe, S * 0.9, S * 0.52, 0, 0, TAU);
  ctx.clip();
  ellipse(ctx, S * 0.15, -S * 0.32 + breathe, S * 0.7, S * 0.3, hide.belly);
  ctx.strokeStyle = 'rgba(120,100,60,.35)';
  ctx.lineWidth = Math.max(1, S * 0.025);
  for (let i = -3; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(S * 0.15 + i * S * 0.16, -S * 0.5);
    ctx.lineTo(S * 0.15 + i * S * 0.16, -S * 0.05);
    ctx.stroke();
  }
  ctx.restore();
  // the Ember Dragon's glowing cracks, the Golden Dragon's glints
  if (p.kind === 'zarowy') {
    const hk = 0.5 + 0.5 * Math.sin(p.t * 3) + (p.hot ?? 0) * 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,${Math.round(140 + 60 * Math.min(1, hk))},60,${Math.min(1, 0.45 + 0.4 * hk)})`;
    ctx.lineWidth = Math.max(1, S * 0.05);
    ctx.beginPath();
    ctx.moveTo(-S * 0.6, -S * 0.7 + breathe);
    ctx.lineTo(-S * 0.25, -S * 0.55 + breathe);
    ctx.lineTo(S * 0.05, -S * 0.75 + breathe);
    ctx.lineTo(S * 0.45, -S * 0.6 + breathe);
    ctx.moveTo(-S * 0.3, -S * 0.9 + breathe);
    ctx.lineTo(-S * 0.1, -S * 0.68 + breathe);
    ctx.stroke();
    if ((p.hot ?? 0) > 0) glow(ctx, 0, -S * 0.65, S * 1.8, 'rgba(255,190,90,', 0.45 * (p.hot ?? 0));
    ctx.restore();
  } else if (p.kind === 'zloty') {
    for (let i = 0; i < 5; i++) {
      const a = p.t * 1.5 + i * 1.3;
      const tw = Math.max(0, Math.sin(a));
      if (tw < 0.6) continue;
      const gx = -S * 0.6 + i * S * 0.3, gy = -S * (0.5 + 0.18 * (i % 2)) + breathe;
      ctx.fillStyle = `rgba(255,252,220,${(tw - 0.6) * 2.4})`;
      ctx.beginPath();
      ctx.moveTo(gx, gy - S * 0.1);
      ctx.lineTo(gx + S * 0.025, gy);
      ctx.lineTo(gx, gy + S * 0.1);
      ctx.lineTo(gx - S * 0.025, gy);
      ctx.closePath();
      ctx.fill();
    }
  }
  // the scale plates along the back: fewer as they are knocked off
  const plates = 7, on = Math.ceil(plates * Math.max(0, Math.min(1, p.scales)));
  for (let i = 0; i < plates; i++) {
    const a = Math.PI * 1.08 + (i / (plates - 1)) * Math.PI * 0.84;
    const px = Math.cos(a) * S * 0.86, py = -S * 0.62 + Math.sin(a) * S * 0.5 + breathe;
    if (i < on) {
      ctx.fillStyle = hide.spike;
      ctx.beginPath();
      ctx.moveTo(px - S * 0.09, py + S * 0.02);
      ctx.lineTo(px + Math.cos(a) * S * 0.2, py + Math.sin(a) * S * 0.22);
      ctx.lineTo(px + S * 0.09, py + S * 0.02);
      ctx.closePath();
      ctx.fill();
    } else ellipse(ctx, px, py + S * 0.03, S * 0.05, S * 0.03, hide.dark);
  }
  // the near legs
  ctx.fillStyle = hide.body;
  ctx.beginPath();
  ctx.roundRect(-S * 0.45, -S * 0.38, S * 0.26, S * 0.42, S * 0.1);
  ctx.roundRect(S * 0.42, -S * 0.38, S * 0.26, S * 0.42, S * 0.1);
  ctx.fill();
  ctx.fillStyle = '#f3ead2';
  for (const lx of [-S * 0.45, S * 0.42]) {
    for (let c = 0; c < 3; c++) ellipse(ctx, lx + S * (0.05 + c * 0.08), S * 0.03, S * 0.03, S * 0.025, '#f3ead2');
  }
  // the near wing
  wing(S * 0.05, hide.wing, wingK);
  // the neck(s) and head(s)
  const heads = p.kind === 'trzyglowy' ? 3 : 1;
  // the three heads fan out: the back one high, the middle one forward, the front one low
  const SPOTS: readonly [number, number][] = heads === 1 ? [[0.95, -1.45]] : [[0.45, -1.85], [1.1, -1.55], [1.35, -0.95]];
  for (let i = 0; i < heads; i++) {
    const asleep = p.sleep > 0.5 || (heads === 3 && 2 - i >= p.heads);
    const nod = asleep ? S * 0.35 : Math.sin(p.t * 1.7 + i) * S * 0.05;
    const nx = S * SPOTS[i][0], ny = S * SPOTS[i][1] + nod;
    ctx.strokeStyle = hide.body;
    ctx.lineWidth = S * (heads === 3 ? 0.26 : 0.34);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S * 0.55, -S * 0.75);
    ctx.quadraticCurveTo((S * 0.55 + nx) / 2 + S * 0.1, (-S * 0.75 + ny) / 2 - S * 0.2, nx - S * 0.1, ny + S * 0.12);
    ctx.stroke();
    ctx.fillStyle = hide.belly;
    ctx.beginPath();
    ctx.ellipse(S * 0.75, -S * 0.95, S * 0.08, S * 0.2, -0.5, 0, TAU);
    ctx.fill();
    paintHead(ctx, nx, ny, S * (heads === 3 ? 0.78 : 1), hide, p, asleep, asleep ? 0.5 : -0.05 + (i - 1) * 0.15);
  }
  ctx.restore();
}

/** The dragon under the marsh: rings on the water and a ridge of spikes moving. */
export function paintUnder(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, kind: DragonKind): void {
  const hide = HIDES[kind];
  for (let i = 0; i < 3; i++) {
    const k = ((t * 1.4 + i / 3) % 1);
    ctx.strokeStyle = `rgba(220,240,235,${0.5 * (1 - k)})`;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.ellipse(x, y, s * (0.4 + k * 1.1), s * (0.18 + k * 0.5), 0, 0, TAU);
    ctx.stroke();
  }
  ellipse(ctx, x, y, s * 0.7, s * 0.28, 'rgba(50,80,70,.55)');
  ctx.fillStyle = hide.spike;
  for (let i = 0; i < 4; i++) {
    const px = x + (i - 1.5) * s * 0.26;
    ctx.beginPath();
    ctx.moveTo(px - s * 0.08, y);
    ctx.lineTo(px, y - s * (0.18 + 0.05 * Math.sin(t * 6 + i)));
    ctx.lineTo(px + s * 0.08, y);
    ctx.fill();
  }
}

// ── Princess Linda ────────────────────────────────────────────────
export interface LindaPose {
  /** +1 facing right, −1 left */
  flip: number;
  /** the walk's phase, walking 0..1, an arm raised (0..1: a wave, a throw), sitting (0..1), talking */
  step: number; walking: number; arm: number; sit: number; talk: boolean;
  t: number;
}

/** The princess standing with her feet at (x, y), about 1.15 u tall: a green gown, a red braid, a crown askew. */
export function paintLinda(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: LindaPose): void {
  ellipse(ctx, x, y, s * 0.32, s * 0.11, 'rgba(20,20,10,.28)');
  ctx.save();
  ctx.translate(x, y + p.sit * s * 0.18);
  ctx.scale(p.flip, 1);
  const bob = p.walking * Math.abs(Math.sin(p.step)) * s * 0.04;
  ctx.translate(0, -bob);
  // the gown: a bell
  ctx.fillStyle = C.gown;
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, -s * 0.78);
  ctx.lineTo(s * 0.13, -s * 0.78);
  ctx.quadraticCurveTo(s * 0.2, -s * 0.35, s * 0.34 + Math.sin(p.step) * p.walking * s * 0.04, 0);
  ctx.lineTo(-s * 0.34, 0);
  ctx.quadraticCurveTo(-s * 0.2, -s * 0.35, -s * 0.13, -s * 0.78);
  ctx.fill();
  ctx.fillStyle = C.gownDeep;
  ctx.fillRect(-s * 0.32, -s * 0.06, s * 0.64, s * 0.06);
  ctx.fillStyle = C.gold;
  ctx.fillRect(-s * 0.13, -s * 0.62, s * 0.26, s * 0.04);
  // the arm: down, or raised to wave and throw
  ctx.strokeStyle = C.skin;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  const a = -0.3 - p.arm * 2.3 + (p.arm > 0.5 ? Math.sin(p.t * 10) * 0.25 : 0);
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.72);
  ctx.lineTo(s * 0.1 + Math.cos(a + Math.PI / 2) * s * 0.3, -s * 0.72 + Math.sin(a + Math.PI / 2) * s * 0.3);
  ctx.stroke();
  // the head, the braid, the crown askew
  ellipse(ctx, 0, -s * 0.92, s * 0.15, s * 0.16, C.skin);
  ctx.strokeStyle = C.hair;
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, -s * 0.95);
  ctx.quadraticCurveTo(-s * 0.26, -s * 0.7, -s * 0.18, -s * 0.5);
  ctx.stroke();
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.arc(0, -s * 0.97, s * 0.155, Math.PI * 1.05, Math.PI * 2.05);
  ctx.fill();
  ellipse(ctx, s * 0.07, -s * 0.9, s * 0.02, s * 0.022, C.ink);
  ellipse(ctx, s * 0.1, -s * 0.85, s * 0.035, s * 0.02, C.cheek);
  if (p.talk) {
    const o = Math.abs(Math.sin(p.t * 14)) * s * 0.025;
    ellipse(ctx, s * 0.1, -s * 0.81, s * 0.025, s * 0.008 + o, '#8a3a32');
  } else {
    ctx.strokeStyle = '#8a3a32';
    ctx.lineWidth = Math.max(1, s * 0.018);
    ctx.beginPath();
    ctx.arc(s * 0.09, -s * 0.84, s * 0.03, 0.2, Math.PI - 0.4);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(-s * 0.02, -s * 1.11);
  ctx.rotate(-0.25);
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.moveTo(-s * 0.09, 0);
  ctx.lineTo(-s * 0.09, -s * 0.07);
  ctx.lineTo(-s * 0.045, -s * 0.03);
  ctx.lineTo(0, -s * 0.09);
  ctx.lineTo(s * 0.045, -s * 0.03);
  ctx.lineTo(s * 0.09, -s * 0.07);
  ctx.lineTo(s * 0.09, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ── fire, water, apples, the horse ────────────────────────────────
/** A flame of the breath: a hot core and a ragged rim. */
export function paintFlame(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, id: number): void {
  const w = 1 + 0.15 * Math.sin(t * 30 + id), lick = Math.sin(t * 22 + id * 1.7) * r * 0.35;
  const tongue = (k: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + lick * k, y - r * 2.1 * k * w);
    ctx.quadraticCurveTo(x + r * 1.15 * k, y - r * 0.2 * k, x, y + r * 0.9 * k);
    ctx.quadraticCurveTo(x - r * 1.15 * k, y - r * 0.2 * k, x + lick * k, y - r * 2.1 * k * w);
    ctx.fill();
  };
  tongue(1.15, 'rgba(200,54,30,.75)');
  tongue(0.85, C.fire);
  tongue(0.48, C.fireHot);
}

/** A fireball (or a drop of fire) in flight at height `z` (px) above its ground point. */
export function paintFireball(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, r: number, t: number): void {
  ellipse(ctx, x, y, r * 0.9, r * 0.35, 'rgba(20,10,0,.25)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - z, r * 2.4, 'rgba(255,140,60,', 0.5);
  ctx.restore();
  ellipse(ctx, x, y - z, r, r, C.ember);
  ellipse(ctx, x, y - z, r * 0.75, r * 0.75, C.fire);
  ellipse(ctx, x - r * 0.15, y - z - r * 0.15, r * 0.4, r * 0.4, C.fireHot);
  void t;
}

/** An apple (Linda's, thrown to the knight). */
export function paintApple(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ellipse(ctx, x, y, r, r * 0.92, '#d9412f');
  ellipse(ctx, x - r * 0.35, y - r * 0.3, r * 0.28, r * 0.2, 'rgba(255,255,255,.45)');
  ctx.strokeStyle = '#5b3d25';
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.8);
  ctx.lineTo(x + r * 0.1, y - r * 1.25);
  ctx.stroke();
  ctx.fillStyle = '#5f9a4a';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.35, y - r * 1.1, r * 0.32, r * 0.14, -0.4, 0, TAU);
  ctx.fill();
}

/** The white horse at full gallop (side view), feet at (x, y), facing `dir`. */
export function paintHorse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, t: number): void {
  ellipse(ctx, x, y, s * 0.8, s * 0.18, 'rgba(20,20,10,.25)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const g = Math.sin(t * 22);
  ctx.strokeStyle = '#f4f1ea';
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.12;
  for (const [lx, ph] of [[-0.45, 0], [-0.3, 1.5], [0.35, 3], [0.5, 4.5]] as const) {
    const a = Math.sin(t * 22 + ph) * 0.6;
    ctx.beginPath();
    ctx.moveTo(s * lx, -s * 0.55);
    ctx.lineTo(s * lx + Math.sin(a) * s * 0.4, -s * 0.55 + Math.cos(a) * s * 0.5);
    ctx.stroke();
  }
  ellipse(ctx, 0, -s * 0.72 + g * s * 0.03, s * 0.7, s * 0.3, '#fbf8f0');
  ctx.strokeStyle = '#fbf8f0';
  ctx.lineWidth = s * 0.24;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, -s * 0.85);
  ctx.lineTo(s * 0.78, -s * 1.25);
  ctx.stroke();
  ellipse(ctx, s * 0.92, -s * 1.22, s * 0.24, s * 0.13, '#fbf8f0');
  ctx.fillStyle = '#e2b23c';
  ctx.beginPath();
  ctx.moveTo(s * 0.55, -s * 1.1);
  ctx.quadraticCurveTo(s * 0.4, -s * 1.3 - g * s * 0.05, s * 0.3, -s * 1.0);
  ctx.fill();
  ctx.strokeStyle = '#e8e2d2';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(-s * 0.68, -s * 0.8);
  ctx.quadraticCurveTo(-s * 1.0, -s * 0.9 - g * s * 0.1, -s * 1.05, -s * 0.55);
  ctx.stroke();
  ellipse(ctx, s * 1.0, -s * 1.25, s * 0.03, s * 0.03, C.ink);
  // the blanket: ultramarine with a gold hem
  ctx.fillStyle = C.ultramarine;
  ctx.fillRect(-s * 0.3, -s * 1.0, s * 0.5, s * 0.36);
  ctx.fillStyle = C.gold;
  ctx.fillRect(-s * 0.3, -s * 0.68, s * 0.5, s * 0.04);
  ctx.restore();
}

// ── the items' little pictures (cards, the build's chips) ─────────
export function paintItemIcon(ctx: CanvasRenderingContext2D, id: ItemId | 'apple' | 'scales', x: number, y: number, r: number, evo = false): void {
  ctx.save();
  ctx.translate(x, y);
  ellipse(ctx, 0, 0, r * 1.15, r * 1.15, evo ? 'rgba(255,214,107,.45)' : 'rgba(226,178,60,.18)');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (w: number, c: string) => { ctx.lineWidth = Math.max(1, r * w); ctx.strokeStyle = c; };
  switch (id) {
    case 'miecz':
      line(0.18, evo ? C.goldLight : C.steel);
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.6);
      ctx.lineTo(r * 0.75, -r * 0.75);
      ctx.stroke();
      line(0.16, C.goldDeep);
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.15);
      ctx.lineTo(-r * 0.15, r * 0.6);
      ctx.stroke();
      if (evo) {
        line(0.06, C.gold);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.95, 0, TAU);
        ctx.stroke();
      }
      break;
    case 'kopia':
      for (let i = evo ? -1 : 0; i <= (evo ? 1 : 0); i++) {
        line(0.12, '#7a5434');
        ctx.beginPath();
        ctx.moveTo(-r * 0.8 + i * r * 0.3, r * 0.8);
        ctx.lineTo(r * 0.5 + i * r * 0.3, -r * 0.5);
        ctx.stroke();
        ctx.fillStyle = C.steel;
        ctx.beginPath();
        ctx.moveTo(r * 0.9 + i * r * 0.3, -r * 0.9);
        ctx.lineTo(r * 0.35 + i * r * 0.3, -r * 0.6);
        ctx.lineTo(r * 0.6 + i * r * 0.3, -r * 0.35);
        ctx.fill();
      }
      break;
    case 'sokol':
      paintFalcon(ctx, 0, 0, r * 1.3, 0.4, evo);
      if (evo) paintFalcon(ctx, r * 0.5, -r * 0.5, r * 0.8, 1.4, true);
      break;
    case 'wiadra':
      ctx.fillStyle = '#8a6a4a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3);
      ctx.lineTo(r * 0.5, -r * 0.3);
      ctx.lineTo(r * 0.35, r * 0.6);
      ctx.lineTo(-r * 0.35, r * 0.6);
      ctx.fill();
      ellipse(ctx, 0, -r * 0.3, r * 0.5, r * 0.15, '#7fb6e0');
      for (let i = 0; i < 3; i++) ellipse(ctx, -r * 0.3 + i * r * 0.3, -r * 0.6 - (i % 2) * r * 0.2, r * 0.08, r * 0.12, '#7fb6e0');
      if (evo) ellipse(ctx, 0, r * 0.75, r * 0.8, r * 0.2, 'rgba(127,182,224,.7)');
      break;
    case 'rog':
      ctx.fillStyle = evo ? C.gold : '#e8d5a8';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, r * 0.1);
      ctx.quadraticCurveTo(-r * 0.2, r * 0.5, r * 0.6, -r * 0.5);
      ctx.lineTo(r * 0.85, -r * 0.2);
      ctx.quadraticCurveTo(0, r * 0.7, -r * 0.8, r * 0.35);
      ctx.fill();
      line(0.07, C.goldDeep);
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(r * 0.7, -r * 0.35, r * 0.25 * i, -1.2, 0.4);
        ctx.stroke();
      }
      break;
    case 'kon':
      paintHorse(ctx, -r * 0.1, r * 0.75, r * 0.72, 1, 0.2);
      break;
    case 'sztandar':
      line(0.1, '#7a5434');
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.9);
      ctx.lineTo(-r * 0.5, -r * 0.9);
      ctx.stroke();
      ctx.fillStyle = C.vermilion;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.85);
      ctx.lineTo(r * 0.8, -r * 0.6);
      ctx.lineTo(r * 0.45, -r * 0.35);
      ctx.lineTo(r * 0.8, -r * 0.1);
      ctx.lineTo(-r * 0.5, -r * 0.05);
      ctx.fill();
      sun(ctx, 0, -r * 0.45, r * 0.18);
      break;
    case 'rekawice':
      ctx.fillStyle = C.steel;
      ctx.beginPath();
      ctx.roundRect(-r * 0.45, -r * 0.5, r * 0.9, r * 0.9, r * 0.3);
      ctx.fill();
      ctx.fillStyle = C.steelDark;
      for (let i = 0; i < 4; i++) ctx.fillRect(-r * 0.4 + i * r * 0.22, -r * 0.75, r * 0.16, r * 0.35);
      ctx.fillStyle = '#7a5434';
      ctx.fillRect(-r * 0.5, r * 0.35, r, r * 0.3);
      break;
    case 'buty':
      ctx.fillStyle = '#7a5434';
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.8);
      ctx.lineTo(r * 0.1, -r * 0.8);
      ctx.lineTo(r * 0.15, r * 0.3);
      ctx.lineTo(r * 0.8, r * 0.4);
      ctx.lineTo(r * 0.8, r * 0.75);
      ctx.lineTo(-r * 0.45, r * 0.75);
      ctx.fill();
      line(0.07, '#fff');
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.2);
      ctx.lineTo(-r * 0.6, -r * 0.2);
      ctx.moveTo(-r * 0.95, r * 0.15);
      ctx.lineTo(-r * 0.65, r * 0.15);
      ctx.stroke();
      break;
    case 'tarcza':
      ctx.fillStyle = C.ultramarine;
      ctx.beginPath();
      ctx.moveTo(-r * 0.65, -r * 0.7);
      ctx.lineTo(r * 0.65, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.7, r * 0.4, 0, r * 0.85);
      ctx.quadraticCurveTo(-r * 0.7, r * 0.4, -r * 0.65, -r * 0.7);
      ctx.fill();
      sun(ctx, 0, -r * 0.05, r * 0.32);
      break;
    case 'zbroja':
      // a breastplate: a curved chest line and a belt (no lines crossing: never a cross)
      ctx.fillStyle = C.steel;
      ctx.beginPath();
      ctx.roundRect(-r * 0.6, -r * 0.65, r * 1.2, r * 1.3, r * 0.3);
      ctx.fill();
      line(0.08, C.steelDark);
      ctx.beginPath();
      ctx.arc(0, -r * 0.75, r * 0.7, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      ctx.fillStyle = C.goldDeep;
      ctx.fillRect(-r * 0.6, r * 0.42, r * 1.2, r * 0.12);
      break;
    case 'sakwa':
      ctx.fillStyle = '#9a6b3f';
      ctx.beginPath();
      ctx.roundRect(-r * 0.6, -r * 0.35, r * 1.2, r * 1.0, r * 0.25);
      ctx.fill();
      ctx.fillStyle = '#7a5434';
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.35);
      ctx.lineTo(r * 0.6, -r * 0.35);
      ctx.lineTo(0, r * 0.15);
      ctx.fill();
      paintScale(ctx, r * 0.5, -r * 0.55, r * 0.3, 1, 0);
      break;
    case 'mlot':
      ctx.save();
      ctx.rotate(-0.6);
      line(0.16, '#7a5434');
      ctx.beginPath();
      ctx.moveTo(0, r * 0.85);
      ctx.lineTo(0, -r * 0.3);
      ctx.stroke();
      ctx.fillStyle = evo ? C.gold : C.steelDark;
      ctx.fillRect(-r * 0.5, -r * 0.75, r, r * 0.45);
      ctx.fillStyle = evo ? C.goldLight : C.steel;
      ctx.fillRect(-r * 0.5, -r * 0.75, r, r * 0.13);
      ctx.restore();
      break;
    case 'kusza':
      line(0.14, '#7a5434');
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, r * 0.5);
      ctx.lineTo(r * 0.55, -r * 0.45);
      ctx.stroke();
      line(0.12, evo ? C.gold : C.steelDark);
      ctx.beginPath();
      ctx.arc(r * 0.3, -r * 0.2, r * 0.6, -2.3, 0.8);
      ctx.stroke();
      line(0.04, '#efe7d6');
      ctx.beginPath();
      ctx.moveTo(r * 0.3 + Math.cos(-2.3) * r * 0.6, -r * 0.2 + Math.sin(-2.3) * r * 0.6);
      ctx.lineTo(r * 0.3 + Math.cos(0.8) * r * 0.6, -r * 0.2 + Math.sin(0.8) * r * 0.6);
      ctx.stroke();
      break;
    case 'kolce':
      // a caltrop: three spikes on the ground (never four at right angles)
      ctx.fillStyle = evo ? C.gold : '#4a4a55';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a - 0.25) * r * 0.25, Math.sin(a - 0.25) * r * 0.25);
        ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        ctx.lineTo(Math.cos(a + 0.25) * r * 0.25, Math.sin(a + 0.25) * r * 0.25);
        ctx.closePath();
        ctx.fill();
      }
      ellipse(ctx, 0, 0, r * 0.18, r * 0.18, evo ? C.goldLight : '#8a8a98');
      break;
    case 'kolczan':
      ctx.fillStyle = '#8a5a36';
      ctx.beginPath();
      ctx.roundRect(-r * 0.3, -r * 0.4, r * 0.6, r * 1.2, r * 0.15);
      ctx.fill();
      for (let i = -1; i <= 1; i++) {
        line(0.07, '#7a5434');
        ctx.beginPath();
        ctx.moveTo(i * r * 0.15, -r * 0.4);
        ctx.lineTo(i * r * 0.2, -r * 0.85);
        ctx.stroke();
        ctx.fillStyle = C.vermilion;
        ctx.beginPath();
        ctx.moveTo(i * r * 0.2, -r * 0.95);
        ctx.lineTo(i * r * 0.2 - r * 0.08, -r * 0.75);
        ctx.lineTo(i * r * 0.2 + r * 0.08, -r * 0.75);
        ctx.fill();
      }
      break;
    case 'plaszcz':
      ctx.fillStyle = C.vermilion;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.7);
      ctx.lineTo(r * 0.3, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.8, r * 0.2, r * 0.6, r * 0.85);
      ctx.lineTo(-r * 0.6, r * 0.85);
      ctx.quadraticCurveTo(-r * 0.8, r * 0.2, -r * 0.3, -r * 0.7);
      ctx.fill();
      ctx.fillStyle = C.gold;
      ctx.fillRect(-r * 0.32, -r * 0.72, r * 0.64, r * 0.12);
      break;
    case 'pierscien':
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = Math.max(2, r * 0.22);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.15, r * 0.5, r * 0.45, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#d2462f';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.65);
      ctx.lineTo(r * 0.22, -r * 0.38);
      ctx.lineTo(0, -r * 0.18);
      ctx.lineTo(-r * 0.22, -r * 0.38);
      ctx.closePath();
      ctx.fill();
      break;
    case 'apple':
      paintApple(ctx, 0, r * 0.1, r * 0.6);
      break;
    case 'scales':
      paintScale(ctx, -r * 0.3, r * 0.1, r * 0.45, 3, 0);
      paintScale(ctx, r * 0.3, -r * 0.1, r * 0.45, 10, 0);
      break;
  }
  ctx.restore();
}

/** A falcon from above, wings spread (flap 0..TAU). */
export function paintFalcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number, gold = false): void {
  const w = 0.55 + 0.35 * Math.sin(flap);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = gold ? '#e8c060' : '#b98654';
  ctx.strokeStyle = gold ? '#a97a1c' : '#5e4128';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.18);
  ctx.quadraticCurveTo(-s * 0.4, -s * 0.2 * w - s * 0.1, -s * 0.55, s * 0.05 * w);
  ctx.quadraticCurveTo(-s * 0.25, -s * 0.02, 0, s * 0.08);
  ctx.quadraticCurveTo(s * 0.25, -s * 0.02, s * 0.55, s * 0.05 * w);
  ctx.quadraticCurveTo(s * 0.4, -s * 0.2 * w - s * 0.1, 0, -s * 0.18);
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, 0, -s * 0.02, s * 0.08, s * 0.2, gold ? '#f4d98a' : '#f1e6d2');
  ellipse(ctx, 0, -s * 0.2, s * 0.07, s * 0.07, gold ? '#f4d98a' : '#6b4e33');
  ctx.fillStyle = '#e2b23c';
  ctx.beginPath();
  ctx.moveTo(-s * 0.025, -s * 0.26);
  ctx.lineTo(0, -s * 0.31);
  ctx.lineTo(s * 0.025, -s * 0.26);
  ctx.fill();
  ctx.restore();
}

/** A scale on the ground: bronze (1), silver (3), gold (10); a little shine turning with `t`. */
export function paintScale(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, v: number, t: number): void {
  const [a, b] = v >= 10 ? ['#ffe08a', '#c8901c'] : v >= 3 ? ['#eef3f8', '#8d9bb0'] : ['#f0b77a', '#a8622c'];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2 + x) * 0.25);
  ctx.fillStyle = b;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r, -r * 0.4, r * 0.75, r * 0.35);
  ctx.quadraticCurveTo(0, r * 1.05, -r * 0.75, r * 0.35);
  ctx.quadraticCurveTo(-r, -r * 0.4, 0, -r);
  ctx.fill();
  ctx.fillStyle = a;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.75);
  ctx.quadraticCurveTo(r * 0.7, -r * 0.3, r * 0.5, r * 0.25);
  ctx.quadraticCurveTo(0, r * 0.7, -r * 0.5, r * 0.25);
  ctx.quadraticCurveTo(-r * 0.7, -r * 0.3, 0, -r * 0.75);
  ctx.fill();
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4 + y);
  ellipse(ctx, -r * 0.2, -r * 0.3, r * 0.15, r * 0.25, '#ffffff');
  ctx.restore();
}

/** A chest (gold-bound for the dragon's), lid ajar with a glow. */
export function paintChest(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, big: boolean, t: number): void {
  const w = s * (big ? 0.9 : 0.7), h = w * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - h * 0.6, w * (1.6 + 0.2 * Math.sin(t * 3)), 'rgba(255,214,120,', 0.45);
  ctx.restore();
  ellipse(ctx, x, y + h * 0.05, w * 0.6, h * 0.22, 'rgba(20,20,10,.3)');
  ctx.fillStyle = '#8a5a2e';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h, w, h, h * 0.12);
  ctx.fill();
  ctx.fillStyle = '#a8703a';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h * 1.32, w, h * 0.42, [h * 0.3, h * 0.3, h * 0.05, h * 0.05]);
  ctx.fill();
  ctx.fillStyle = big ? C.gold : '#c9b48a';
  ctx.fillRect(x - w / 2, y - h * 0.95, w, h * 0.1);
  ctx.fillRect(x - w * 0.08, y - h * 1.3, w * 0.16, h * 1.25);
  ellipse(ctx, x, y - h * 0.62, w * 0.07, w * 0.07, big ? C.goldLight : '#f1e2bc');
}

/**
 * One of the dragon's brood seen a little from above, standing at (x, y) facing `flip`, in its
 * land's hide: a round chick, a long lizard, a puffed spitter, an armoured one, an ember beetle.
 * Never fierce: big eyes, small teeth.  `hit` flashes white; `elite` is gold-trimmed and larger.
 */
export interface BroodPose { kind: BroodKind; land: DragonKind; r: number; flip: number; t: number; hit: number; elite: boolean; drowsy: number; spit: number; seed: number }

export function paintBrood(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: BroodPose): void {
  const hide = HIDES[p.land], R = p.r * s;
  const bob = Math.sin(p.t * (p.kind === 'jaszczurka' || p.kind === 'ognik' ? 16 : 9) + p.seed) * R * 0.08 * (1 - p.drowsy);
  ellipse(ctx, x, y + R * 0.05, R * 0.95, R * 0.32, 'rgba(20,20,10,.3)');
  if (p.elite) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y - R * 0.6, R * 2.2, 'rgba(255,210,110,', 0.35 + 0.1 * Math.sin(p.t * 5));
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y - R * 0.55 + bob);
  ctx.scale(p.flip, 1);
  const body = p.hit > 0 ? '#fff6e6' : p.elite ? '#e8b84a' : hide.body;
  const dark = p.elite ? '#a97a1c' : hide.dark;
  const belly = p.elite ? '#fff0b8' : hide.belly;
  const eye = (ex: number, ey: number, er: number) => {
    if (p.drowsy > 0.5) {
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, er * 0.4);
      ctx.beginPath();
      ctx.arc(ex, ey, er * 0.8, 0.2, Math.PI - 0.2);
      ctx.stroke();
      return;
    }
    ellipse(ctx, ex, ey, er, er * 1.1, '#fffbe8');
    ellipse(ctx, ex + er * 0.25, ey + er * 0.1, er * 0.5, er * 0.62, '#1d1410');
    ellipse(ctx, ex + er * 0.05, ey - er * 0.35, er * 0.22, er * 0.22, '#ffffff');
  };
  switch (p.kind) {
    case 'piskle': {
      // a round chick with stubby wings and a bit of eggshell on its head
      const flap = Math.sin(p.t * 14 + p.seed) * 0.4;
      ctx.fillStyle = hide.wing;
      ctx.beginPath();
      ctx.ellipse(-R * 0.55, -R * 0.15, R * 0.4, R * 0.22, -0.6 + flap, 0, TAU);
      ctx.fill();
      ellipse(ctx, 0, 0, R * 0.78, R * 0.7, body);
      ellipse(ctx, R * 0.1, R * 0.2, R * 0.45, R * 0.35, belly);
      eye(R * 0.3, -R * 0.2, R * 0.2);
      ctx.fillStyle = '#f6efe0';
      ctx.beginPath();
      ctx.moveTo(-R * 0.45, -R * 0.5);
      ctx.lineTo(-R * 0.3, -R * 0.82);
      ctx.lineTo(-R * 0.1, -R * 0.58);
      ctx.lineTo(R * 0.08, -R * 0.86);
      ctx.lineTo(R * 0.25, -R * 0.6);
      ctx.quadraticCurveTo(-R * 0.1, -R * 0.42, -R * 0.45, -R * 0.5);
      ctx.fill();
      ctx.fillStyle = hide.spike;
      ctx.beginPath();
      ctx.moveTo(R * 0.7, -R * 0.05);
      ctx.lineTo(R * 0.95, R * 0.05);
      ctx.lineTo(R * 0.7, R * 0.15);
      ctx.fill();
      break;
    }
    case 'jaszczurka': {
      // a long low lizard, its tail swinging
      const sw = Math.sin(p.t * 16 + p.seed) * 0.35;
      ctx.strokeStyle = body;
      ctx.lineCap = 'round';
      ctx.lineWidth = R * 0.35;
      ctx.beginPath();
      ctx.moveTo(-R * 0.4, R * 0.15);
      ctx.quadraticCurveTo(-R * 0.9, R * 0.15 + sw * R, -R * 1.35, R * 0.05 - sw * R * 0.5);
      ctx.stroke();
      ellipse(ctx, 0, R * 0.1, R * 0.75, R * 0.38, body);
      ellipse(ctx, R * 0.7, -R * 0.05, R * 0.38, R * 0.3, body);
      ctx.fillStyle = dark;
      for (let i = 0; i < 4; i++) ellipse(ctx, -R * 0.5 + i * R * 0.35, -R * 0.2, R * 0.08, R * 0.06, dark);
      eye(R * 0.8, -R * 0.15, R * 0.14);
      break;
    }
    case 'plujka': {
      // a puffed toad-dragon: its cheeks glow before it spits
      ellipse(ctx, 0, R * 0.05, R * 0.85, R * 0.7, body);
      ellipse(ctx, 0, R * 0.3, R * 0.6, R * 0.35, belly);
      const glowK = clamp01(p.spit);
      ellipse(ctx, R * 0.55, R * 0.05, R * (0.3 + 0.15 * glowK), R * (0.25 + 0.12 * glowK), glowK > 0.3 ? `rgba(255,${Math.round(150 - 60 * glowK)},60,1)` : belly);
      eye(R * 0.15, -R * 0.45, R * 0.2);
      eye(R * 0.5, -R * 0.4, R * 0.17);
      ctx.fillStyle = hide.spike;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-R * 0.6 + i * R * 0.3, -R * 0.55 + i * R * 0.05);
        ctx.lineTo(-R * 0.5 + i * R * 0.3, -R * 0.8 + i * R * 0.05);
        ctx.lineTo(-R * 0.4 + i * R * 0.3, -R * 0.5 + i * R * 0.05);
        ctx.fill();
      }
      break;
    }
    case 'pancernik': {
      // an armoured plodder under a shell of plates
      ellipse(ctx, R * 0.75, R * 0.1, R * 0.3, R * 0.26, body);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(-R * 0.05, -R * 0.05, R * 0.85, R * 0.65, 0, Math.PI, TAU);
      ctx.lineTo(R * 0.8, R * 0.2);
      ctx.lineTo(-R * 0.9, R * 0.2);
      ctx.fill();
      ctx.strokeStyle = belly;
      ctx.lineWidth = Math.max(1, R * 0.06);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(-R * 0.05, R * 0.2, R * 0.85 * (i / 3.4), R * 0.85 * (i / 3.4), 0, Math.PI, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = body;
      for (let i = 0; i < 4; i++) ctx.fillRect(-R * 0.75 + i * R * 0.45, R * 0.18, R * 0.18, R * 0.25);
      eye(R * 0.85, R * 0.02, R * 0.12);
      break;
    }
    case 'ognik': {
      // an ember beetle: a glowing shell, six busy legs
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, 0, R * 2.4, 'rgba(255,150,60,', 0.4);
      ctx.restore();
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, R * 0.12);
      for (let i = 0; i < 3; i++) {
        const lg = Math.sin(p.t * 24 + i * 2) * R * 0.2;
        ctx.beginPath();
        ctx.moveTo(-R * 0.4 + i * R * 0.4, R * 0.2);
        ctx.lineTo(-R * 0.5 + i * R * 0.4 + lg, R * 0.6);
        ctx.stroke();
      }
      ellipse(ctx, 0, 0, R * 0.75, R * 0.55, p.hit > 0 ? '#fff' : '#c8361e');
      ellipse(ctx, 0, -R * 0.08, R * 0.55, R * 0.38, p.elite ? '#ffe08a' : '#ff9a3d');
      ctx.strokeStyle = '#7a1f12';
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.5);
      ctx.lineTo(0, R * 0.45);
      ctx.stroke();
      eye(R * 0.6, -R * 0.1, R * 0.16);
      break;
    }
  }
  if (p.elite) {
    // a little crown of gold spikes
    ctx.fillStyle = C.gold;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-R * 0.25 + i * R * 0.22, -R * 0.75);
      ctx.lineTo(-R * 0.15 + i * R * 0.22, -R * 1.05);
      ctx.lineTo(-R * 0.05 + i * R * 0.22, -R * 0.75);
      ctx.fill();
    }
  }
  if (p.drowsy > 0.5) {
    ctx.scale(p.flip, 1);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = font(700, R * 0.6, SANS);
    ctx.fillText('z', R * 0.5, -R * (0.9 + 0.2 * Math.sin(p.t * 2 + p.seed)));
  }
  ctx.restore();
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A creature dissolving into ink-grey smoke and sparks of light, its little shadow scampering off (0..1). */
export function paintSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: number, k: number, dir: number, seed: number): void {
  const R = r * s;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const a = seed * 1.7 + i * 1.3, d = R * (0.3 + k * 1.2) * (0.6 + 0.4 * hash(seed + i));
    ctx.globalAlpha = (1 - k) * 0.55;
    ellipse(ctx, x + Math.cos(a) * d, y - R * 0.5 + Math.sin(a) * d * 0.6 - k * R, R * (0.35 + k * 0.5), R * (0.3 + k * 0.45), '#6f6a78');
  }
  ctx.globalAlpha = (1 - k);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const a = seed + i * 1.57, d = R * (0.2 + k * 1.6);
    ellipse(ctx, x + Math.cos(a) * d, y - R * 0.6 + Math.sin(a) * d - k * R * 0.8, R * 0.08, R * 0.08, '#ffe9a8');
  }
  ctx.globalCompositeOperation = 'source-over';
  // the little silhouette running off, smaller and fainter
  if (k < 0.85) {
    const run = k * R * 4;
    ctx.globalAlpha = (1 - k) * 0.5;
    ellipse(ctx, x + Math.cos(dir) * run, y + Math.sin(dir) * run - R * 0.3, R * 0.35 * (1 - k * 0.6), R * 0.28 * (1 - k * 0.6), '#4a4652');
  }
  ctx.restore();
}

// ── the field: the dragon's lands seen from above, endless ────────
/**
 * The ground of a land around the camera: the base colour, soft patches, tufts and flowers on a
 * grid of cells (each cell's decoration fixed by its coordinates), a few large features on a coarser
 * grid (bushes and stones, reed pools, snow, broken flagstones).  `cx, cy` the world point at the
 * screen's (ox, oy) px; `s` px per u.
 */
export function paintField(ctx: CanvasRenderingContext2D, kind: ArenaKind, cx: number, cy: number, ox: number, oy: number, s: number, w: number, h: number, t: number): void {
  const g = GROUND[kind];
  ctx.fillStyle = g.a;
  ctx.fillRect(0, 0, w, h);
  const toX = (wx: number) => ox + (wx - cx) * s, toY = (wy: number) => oy + (wy - cy) * s;
  const x0 = cx - ox / s - 3, x1 = cx + (w - ox) / s + 3, y0 = cy - oy / s - 3, y1 = cy + (h - oy) / s + 3;
  const cellHash = (i: number, j: number, k: number) => hash(i * 73856093 ^ j * 19349663 ^ k * 83492791);
  // soft patches (3 u cells)
  for (let i = Math.floor(x0 / 3); i <= Math.floor(x1 / 3); i++) {
    for (let j = Math.floor(y0 / 3); j <= Math.floor(y1 / 3); j++) {
      const hx = cellHash(i, j, 1), hy = cellHash(i, j, 2), hr = cellHash(i, j, 3);
      const px = toX((i + hx) * 3), py = toY((j + hy) * 3);
      ctx.globalAlpha = 0.55;
      ellipse(ctx, px, py, s * (1.2 + hr * 1.4), s * (0.8 + hr), g.b);
      ctx.globalAlpha = 1;
      if (kind === 'castle' && hr > 0.55) {
        // a few flagstones
        ctx.fillStyle = 'rgba(255,250,235,.16)';
        ctx.strokeStyle = 'rgba(80,70,55,.3)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const fx = px + (k - 1) * s * 0.75, fy = py + (k % 2) * s * 0.4;
          ctx.fillRect(fx, fy, s * 0.7, s * 0.4);
          ctx.strokeRect(fx, fy, s * 0.7, s * 0.4);
        }
      }
    }
  }
  // tufts, flowers, pebbles (1 u cells)
  for (let i = Math.floor(x0); i <= Math.floor(x1); i++) {
    for (let j = Math.floor(y0); j <= Math.floor(y1); j++) {
      const hh = cellHash(i, j, 4);
      if (hh > 0.42) continue;
      const px = toX(i + cellHash(i, j, 5)), py = toY(j + cellHash(i, j, 6));
      if (kind === 'ash' && hh < 0.22) {
        // an ember glowing in the ash
        const glowK = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.3 + j);
        ellipse(ctx, px, py, s * 0.05, s * 0.04, `rgba(255,${Math.round(120 + 60 * glowK)},60,${0.55 + 0.35 * glowK})`);
      } else if (kind === 'hoard' && hh < 0.22) {
        // a coin in the sand
        ellipse(ctx, px, py, s * 0.07, s * 0.045, '#e8b83c');
        ellipse(ctx, px - s * 0.015, py - s * 0.01, s * 0.03, s * 0.018, '#fff1b0');
      } else if (hh < 0.2 && kind !== 'castle') {
        ctx.strokeStyle = kind === 'pass' ? 'rgba(90,80,60,.35)' : 'rgba(40,70,30,.38)';
        ctx.lineWidth = Math.max(1, s * 0.03);
        const sway = Math.sin(t * 1.5 + i + j) * s * 0.02;
        ctx.beginPath();
        ctx.moveTo(px - s * 0.06, py);
        ctx.lineTo(px - s * 0.1 + sway, py - s * 0.14);
        ctx.moveTo(px, py);
        ctx.lineTo(px + sway, py - s * 0.18);
        ctx.moveTo(px + s * 0.06, py);
        ctx.lineTo(px + s * 0.11 + sway, py - s * 0.13);
        ctx.stroke();
      } else if (hh < 0.3 && kind === 'meadow') {
        const colors = ['#fff6d8', '#f2c94c', '#e98aa0', '#ffffff', '#b9a6e8'];
        ellipse(ctx, px, py, s * 0.055, s * 0.055, colors[Math.floor(cellHash(i, j, 7) * colors.length)]);
      } else {
        ellipse(ctx, px, py, s * 0.07, s * 0.05, g.dot);
      }
    }
  }
  // large features (7 u cells)
  for (let i = Math.floor(x0 / 7); i <= Math.floor(x1 / 7); i++) {
    for (let j = Math.floor(y0 / 7); j <= Math.floor(y1 / 7); j++) {
      const hh = cellHash(i, j, 8);
      if (hh > 0.6) continue;
      const px = toX((i + 0.15 + cellHash(i, j, 9) * 0.7) * 7), py = toY((j + 0.15 + cellHash(i, j, 10) * 0.7) * 7);
      const r = s * (0.5 + cellHash(i, j, 11) * 0.6);
      if (kind === 'marsh') {
        ellipse(ctx, px, py, r * 2, r * 1.1, 'rgba(70,110,110,.55)');
        ellipse(ctx, px - r * 0.4, py - r * 0.25, r, r * 0.35, 'rgba(200,230,230,.25)');
        ctx.strokeStyle = '#4d6b3a';
        ctx.lineWidth = Math.max(1, s * 0.04);
        for (let k = 0; k < 5; k++) {
          const rx = px + r * (1.6 + 0.2 * k) * (k % 2 ? 1 : -1), sway = Math.sin(t * 1.3 + i + k) * s * 0.05;
          ctx.beginPath();
          ctx.moveTo(rx, py);
          ctx.quadraticCurveTo(rx + sway, py - s * 0.3, rx + sway * 2, py - s * (0.45 + 0.1 * k));
          ctx.stroke();
        }
      } else if (kind === 'pass') {
        ellipse(ctx, px, py, r * 2.2, r, 'rgba(250,252,255,.6)');
        ellipse(ctx, px + r * 1.5, py + r * 0.6, r * 0.6, r * 0.45, '#9b8c76');
        ellipse(ctx, px + r * 1.4, py + r * 0.45, r * 0.3, r * 0.2, '#c2b59e');
      } else if (kind === 'ash') {
        // a black rock with glowing cracks, a wisp of smoke over it
        ellipse(ctx, px + r * 0.2, py + r * 0.3, r * 1.2, r * 0.45, 'rgba(20,10,5,.3)');
        ellipse(ctx, px, py, r * 1.1, r * 0.7, '#3f342e');
        ellipse(ctx, px - r * 0.3, py - r * 0.25, r * 0.5, r * 0.28, '#5a4a40');
        const k = 0.5 + 0.5 * Math.sin(t * 1.6 + i + j);
        ctx.strokeStyle = `rgba(255,${Math.round(110 + 70 * k)},50,${0.6 + 0.3 * k})`;
        ctx.lineWidth = Math.max(1, s * 0.035);
        ctx.beginPath();
        ctx.moveTo(px - r * 0.6, py + r * 0.05);
        ctx.lineTo(px - r * 0.1, py - r * 0.12);
        ctx.lineTo(px + r * 0.25, py + r * 0.1);
        ctx.lineTo(px + r * 0.7, py - r * 0.05);
        ctx.stroke();
        ctx.globalAlpha = 0.18;
        ellipse(ctx, px + Math.sin(t * 0.7 + i) * r * 0.3, py - r * (1.1 + 0.2 * Math.sin(t + j)), r * 0.45, r * 0.3, '#d8d0c8');
        ctx.globalAlpha = 1;
      } else if (kind === 'hoard') {
        // a heap of gold with a gem, half buried
        ellipse(ctx, px + r * 0.2, py + r * 0.3, r * 1.3, r * 0.45, 'rgba(60,40,10,.25)');
        ellipse(ctx, px, py, r * 1.2, r * 0.55, '#c9962e');
        ellipse(ctx, px - r * 0.2, py - r * 0.18, r * 0.8, r * 0.35, '#e8bd48');
        ellipse(ctx, px - r * 0.35, py - r * 0.28, r * 0.3, r * 0.12, '#fff1b0');
        ctx.fillStyle = (i + j) % 2 ? '#4fb8a8' : '#d2462f';
        ctx.beginPath();
        ctx.moveTo(px + r * 0.35, py - r * 0.45);
        ctx.lineTo(px + r * 0.5, py - r * 0.25);
        ctx.lineTo(px + r * 0.35, py - r * 0.05);
        ctx.lineTo(px + r * 0.2, py - r * 0.25);
        ctx.closePath();
        ctx.fill();
      } else if (kind === 'castle') {
        // a broken column lying in the grass
        ctx.fillStyle = 'rgba(60,50,40,.25)';
        ctx.fillRect(px - r * 1.2, py + r * 0.25, r * 2.4, r * 0.3);
        ctx.fillStyle = '#ddd3bf';
        ctx.fillRect(px - r * 1.2, py - r * 0.3, r * 2.4, r * 0.55);
        ctx.strokeStyle = 'rgba(80,70,55,.35)';
        ctx.lineWidth = 1;
        for (let k = 1; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(px - r * 1.2 + k * r * 0.6, py - r * 0.3);
          ctx.lineTo(px - r * 1.2 + k * r * 0.6, py + r * 0.25);
          ctx.stroke();
        }
      } else {
        // a bush with berries
        ellipse(ctx, px + r * 0.2, py + r * 0.35, r * 1.1, r * 0.45, 'rgba(20,30,10,.25)');
        ellipse(ctx, px, py, r, r * 0.85, '#4f7d3e');
        ellipse(ctx, px - r * 0.3, py - r * 0.25, r * 0.55, r * 0.45, '#6a9a50');
        for (let k = 0; k < 4; k++) ellipse(ctx, px + Math.cos(k * 1.7) * r * 0.55, py + Math.sin(k * 1.7) * r * 0.45, s * 0.05, s * 0.05, '#d2462f');
      }
    }
  }
  // the edge of sight: a warm vignette (one gradient per canvas size, not one a frame)
  ctx.fillStyle = vignette(ctx, w, h);
  ctx.fillRect(0, 0, w, h);
}

const vignettes = new WeakMap<CanvasRenderingContext2D, { w: number; h: number; g: CanvasGradient }>();

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number): CanvasGradient {
  const had = vignettes.get(ctx);
  if (had && had.w === w && had.h === h) return had.g;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(30,25,15,.28)');
  vignettes.set(ctx, { w, h, g });
  return g;
}

// ── the lobby's map tiles ─────────────────────────────────────────
/** A town on the kingdom's map: freed (a pennant), held now (the dragon's shadow), or later (in mist). */
export function paintTownTile(ctx: CanvasRenderingContext2D, w: number, h: number, kind: DragonKind, arena: ArenaKind, state: 'done' | 'now' | 'later'): void {
  const g = GROUND[arena];
  ctx.fillStyle = state === 'later' ? '#b9b2a0' : g.a;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = state === 'later' ? '#a29a88' : g.b;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.7);
  ctx.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.55, h * 0.65);
  ctx.quadraticCurveTo(w * 0.8, h * 0.5, w, h * 0.62);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  // the town: three roofs
  for (let i = 0; i < 3; i++) {
    const x = w * (0.18 + i * 0.12), y = h * 0.72;
    ctx.fillStyle = '#efe2c4';
    ctx.fillRect(x, y - h * 0.12, w * 0.1, h * 0.12);
    ctx.fillStyle = C.vermilion;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.015, y - h * 0.12);
    ctx.lineTo(x + w * 0.05, y - h * 0.24);
    ctx.lineTo(x + w * 0.115, y - h * 0.12);
    ctx.fill();
  }
  if (state === 'now') {
    paintDragon(ctx, w * 0.75, h * 0.62, Math.min(w, h) * 0.2, { kind, flip: -1, r: 1, air: 0, jaw: 0.3, wings: 0.4, hit: 0, scales: 1, sleep: 0, daze: 0, heads: 3, t: 0 });
  } else if (state === 'done') {
    paintPennant(ctx, w * 0.75, h * 0.8, h * 0.55, 1, C.gold, 0);
  } else {
    ctx.fillStyle = 'rgba(240,236,226,.6)';
    ctx.fillRect(0, 0, w, h);
  }
}
