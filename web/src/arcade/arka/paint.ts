/**
 * Arka's drawing primitives (Canvas 2D, no assets), shared by the play view, the calibration intro
 * and the lobby: a 16th-century Bible woodcut warmed with colour — flat bold shapes with carved
 * hatching, walnut and oak planks, straw, bone-coloured animals with charcoal carving lines and one
 * muted accent per family.
 *
 * The twelve animals are built from shared parts (body, neck, head wedge, ears or horns, legs, tail,
 * wings): seen from above on the deck, facing east (the view turns them), with a carved chevron on
 * the back so the way they will walk never depends on colour; and in profile, small, on the new
 * land.  Each look is drawn once per size into a sprite.  Noah and his family are small figures seen
 * from behind, without faces; God is never drawn — the rainbow is His sign.
 */
import type { KindId } from './content';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';

/** The palette: charcoal ink, walnut to oak to fresh-cut planks, straw, bone, the land's spring, dusk and lanterns. */
export const C = {
  ink: '#2a211b', ink2: '#3a2d24', walnut: '#3b2a1e', walnut2: '#4a3526', oak: '#6b4a2f', oak2: '#8a6440', light: '#a07a52',
  fresh: '#d8b98a', fresh2: '#ead2a8', straw: '#d9a441', straw2: '#ecc56e', bone: '#efe4cf', cream: '#f7f0e1',
  ochre: '#c08a3e', russet: '#9c4f32', slate: '#5d7186', sand: '#c9a46a',
  olive: '#8fa37a', grass: '#7fb35a', grass2: '#5f9445', sky: '#bfe3f2', mist: '#f3f1ea', leaf: '#6f9a45',
  dusk: '#5b4a6e', dusk2: '#2e2440', amber: '#ffb547', amber2: '#ffd98a', text: '#2a211b', paper: '#f4ead6',
} as const;

const TAU = Math.PI * 2;

/** Stable pseudo-random numbers for decorations (the same every frame). */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

const ell = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void => {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
};

// ── the animals' looks ───────────────────────────────────────────
interface Look {
  body: string;
  dark: string;
  head: string;
  light: string;
  /** body length and width, the head's length and width and where its centre sits (x), the neck (all in cell sizes) */
  len: number;
  wid: number;
  hl: number;
  hw: number;
  hx: number;
  neck: number;
  ears: 'none' | 'tiny' | 'small' | 'long' | 'round' | 'big';
  horns: 'none' | 'goat' | 'cow' | 'ibex' | 'antler';
  tail: 'none' | 'stub' | 'thin' | 'flow' | 'tuft';
  coat: 'plain' | 'wool' | 'patches' | 'spots' | 'stripe' | 'barred';
  hump?: boolean;
  mane?: 'ring' | 'line';
  bird?: { beak: string; beakLen: number; tips: string };
  /** overall size on the deck */
  scale: number;
}

export const LOOKS: Readonly<Record<KindId, Look>> = {
  sheep: { body: '#efe4cf', dark: '#3a2f28', head: '#3a2f28', light: '#fbf6ea', len: 0.6, wid: 0.46, hl: 0.2, hw: 0.16, hx: 0.31, neck: 0.03, ears: 'small', horns: 'none', tail: 'stub', coat: 'wool', scale: 0.96 },
  goat: { body: '#c08a3e', dark: '#4a3420', head: '#a87434', light: '#ecd3a0', len: 0.58, wid: 0.34, hl: 0.21, hw: 0.13, hx: 0.31, neck: 0.06, ears: 'small', horns: 'goat', tail: 'stub', coat: 'stripe', scale: 0.92 },
  donkey: { body: '#958b80', dark: '#3e3832', head: '#8a8076', light: '#ddd5c7', len: 0.62, wid: 0.34, hl: 0.25, hw: 0.14, hx: 0.34, neck: 0.08, ears: 'long', horns: 'none', tail: 'thin', coat: 'plain', mane: 'line', scale: 1 },
  cow: { body: '#9c4f32', dark: '#3b2418', head: '#8c452b', light: '#efe4cf', len: 0.68, wid: 0.42, hl: 0.21, hw: 0.17, hx: 0.36, neck: 0.04, ears: 'small', horns: 'cow', tail: 'thin', coat: 'patches', scale: 1.04 },
  horse: { body: '#7b4a2c', dark: '#2f1d12', head: '#6e4227', light: '#efe4cf', len: 0.66, wid: 0.33, hl: 0.27, hw: 0.13, hx: 0.38, neck: 0.1, ears: 'small', horns: 'none', tail: 'flow', coat: 'plain', mane: 'line', scale: 1.05 },
  camel: { body: '#c9a46a', dark: '#5a4426', head: '#b8945c', light: '#e6cd96', len: 0.62, wid: 0.34, hl: 0.17, hw: 0.11, hx: 0.43, neck: 0.18, ears: 'tiny', horns: 'none', tail: 'thin', coat: 'plain', hump: true, scale: 1.08 },
  ibex: { body: '#9a8266', dark: '#3e3326', head: '#8a7358', light: '#d2c1a2', len: 0.58, wid: 0.34, hl: 0.18, hw: 0.13, hx: 0.3, neck: 0.06, ears: 'small', horns: 'ibex', tail: 'stub', coat: 'stripe', scale: 0.96 },
  hyrax: { body: '#7a5c44', dark: '#3a2a1e', head: '#6c503b', light: '#b09070', len: 0.48, wid: 0.38, hl: 0.16, hw: 0.15, hx: 0.22, neck: 0, ears: 'round', horns: 'none', tail: 'none', coat: 'plain', scale: 0.82 },
  deer: { body: '#a0683e', dark: '#4a2e1a', head: '#8f5a34', light: '#f1e2c6', len: 0.6, wid: 0.31, hl: 0.2, hw: 0.12, hx: 0.34, neck: 0.1, ears: 'big', horns: 'antler', tail: 'stub', coat: 'spots', scale: 1 },
  stork: { body: '#f2efe8', dark: '#2a211b', head: '#f6f3ec', light: '#ffffff', len: 0.5, wid: 0.27, hl: 0.11, hw: 0.1, hx: 0.36, neck: 0.12, ears: 'none', horns: 'none', tail: 'none', coat: 'plain', bird: { beak: '#c6453a', beakLen: 0.27, tips: '#2a211b' }, scale: 1 },
  partridge: { body: '#8b8f86', dark: '#4a4238', head: '#b4643a', light: '#c9b89a', len: 0.44, wid: 0.36, hl: 0.12, hw: 0.11, hx: 0.24, neck: 0.03, ears: 'none', horns: 'none', tail: 'none', coat: 'barred', bird: { beak: '#5d4a36', beakLen: 0.06, tips: '#6b5a45' }, scale: 0.86 },
  lion: { body: '#c99a52', dark: '#7a4c22', head: '#c08f48', light: '#e6c58a', len: 0.64, wid: 0.36, hl: 0.19, hw: 0.17, hx: 0.34, neck: 0.04, ears: 'round', horns: 'none', tail: 'tuft', coat: 'plain', mane: 'ring', scale: 1.05 },
};

/** A small swatch per kind (the panel's tiles, a waiting animal's stall flag). */
export const KIND_COLOR = (k: KindId): string => LOOKS[k].body;

// ── animals seen from above ──────────────────────────────────────
export type Pose = 'stand' | 'sleep';

const spriteCache = new Map<string, HTMLCanvasElement>();

/**
 * The animal from above, facing east, for a deck cell of `size` CSS px: drawn once per size, pose
 * and device pixel ratio (`sleep`: lying down, smaller and softer, under the Evening's straw).
 */
export function animalSprite(k: KindId, size: number, dpr: number, pose: Pose = 'stand'): HTMLCanvasElement {
  const S = Math.max(8, Math.round(size));
  const key = `${k}|${S}|${dpr}|${pose}`;
  let c = spriteCache.get(key);
  if (c) return c;
  const box = S * 1.3;
  c = canvas(box * dpr, box * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  g.translate(box / 2, box / 2);
  const look = LOOKS[k];
  const s = S * look.scale * (pose === 'sleep' ? 0.9 : 1);
  if (look.bird) drawBird(g, look, s, pose); else drawBeast(g, look, s, pose);
  if (spriteCache.size > 400) spriteCache.clear();
  spriteCache.set(key, c);
  return c;
}

/** The sprite's box is 1.3 cells; draw it centred on the cell, turned to `dir` (0 N, 1 E, 2 S, 3 W). */
export function paintAnimal(ctx: CanvasRenderingContext2D, k: KindId, x: number, y: number, dir: number, size: number, dpr: number, o: { pose?: Pose; alpha?: number; squash?: number; tilt?: number } = {}): void {
  const sp = animalSprite(k, size, dpr, o.pose ?? 'stand');
  const box = Math.round(size) * 1.3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((dir - 1) * (Math.PI / 2) + (o.tilt ?? 0));
  if (o.squash) ctx.scale(1 + o.squash, 1 - o.squash * 0.6);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(sp, -box / 2, -box / 2, box, box);
  ctx.restore();
}

function inkLine(g: CanvasRenderingContext2D, s: number): void {
  g.strokeStyle = C.ink;
  g.lineWidth = Math.max(1, s * 0.042);
  g.lineJoin = 'round';
  g.lineCap = 'round';
}

/** Short carved strokes across a shape (call with the shape as the clip). */
function hatch(g: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, step: number, slope: number, alpha: number, width: number): void {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = C.ink;
  g.lineWidth = width;
  g.beginPath();
  for (let x = x0; x <= x1; x += step) {
    g.moveTo(x, y0);
    g.lineTo(x + slope * (y1 - y0), y1);
  }
  g.stroke();
  g.restore();
}

function drawBeast(g: CanvasRenderingContext2D, L: Look, s: number, pose: Pose): void {
  const bl = (s * L.len) / 2, bw = (s * L.wid) / 2;
  const bx = -s * 0.07;
  const hx = s * L.hx, hl = (s * L.hl) / 2, hw = (s * L.hw) / 2;
  const lw = Math.max(1, s * 0.042);
  // the soft shadow, light from the upper left
  g.fillStyle = 'rgba(36,22,10,.3)';
  ell(g, bx + s * 0.035, s * 0.06, bl * 1.06, bw * 1.12);
  g.fill();
  if (pose === 'stand') {
    // legs peeking out at the four corners
    g.fillStyle = L.dark;
    for (const fx of [0.55, -0.6]) for (const fy of [-1, 1]) {
      ell(g, bx + bl * fx, fy * (bw * 0.92), s * 0.05, s * 0.035);
      g.fill();
    }
  }
  // the tail, behind the body
  tail(g, L, bx - bl, s, lw);
  // the body
  g.save();
  bodyPath(g, L, bx, bl, bw, s);
  g.fillStyle = L.body;
  g.fill();
  g.clip();
  coat(g, L, bx, bl, bw, s);
  // the woodcut's carving: a shaded flank and fine strokes
  g.fillStyle = 'rgba(42,33,27,.16)';
  ell(g, bx, bw * 0.7, bl * 1.1, bw * 0.55);
  g.fill();
  hatch(g, bx - bl, bx + bl, bw * 0.25, bw * 1.1, s * 0.06, 0.35, 0.22, Math.max(0.6, s * 0.012));
  g.fillStyle = 'rgba(255,250,235,.22)';
  ell(g, bx - bl * 0.1, -bw * 0.45, bl * 0.75, bw * 0.32);
  g.fill();
  if (L.hump) {
    g.fillStyle = L.light;
    ell(g, bx - bl * 0.05, -bw * 0.05, bl * 0.42, bw * 0.62);
    g.fill();
    g.strokeStyle = 'rgba(42,33,27,.35)';
    g.lineWidth = Math.max(0.7, s * 0.016);
    g.beginPath();
    g.ellipse(bx - bl * 0.05, -bw * 0.05, bl * 0.3, bw * 0.42, 0, Math.PI * 0.6, Math.PI * 1.5);
    g.stroke();
  }
  g.restore();
  inkLine(g, s);
  bodyPath(g, L, bx, bl, bw, s);
  g.stroke();
  // the carved chevron on the back: the way it will walk
  g.save();
  g.strokeStyle = 'rgba(42,33,27,.62)';
  g.lineWidth = Math.max(1, s * 0.034);
  const cx = bx + bl * 0.05, ch = bw * 0.42;
  g.beginPath();
  g.moveTo(cx - ch * 0.6, -ch);
  g.lineTo(cx + ch * 0.45, 0);
  g.lineTo(cx - ch * 0.6, ch);
  g.stroke();
  g.restore();
  // mane ring (behind the head)
  if (L.mane === 'ring') {
    g.fillStyle = L.dark;
    g.beginPath();
    const mr = hw * 1.75;
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * TAU, r = mr * (i % 2 ? 0.86 : 1.08);
      const x = hx - hl * 0.25 + Math.cos(a) * r, y = Math.sin(a) * r;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.fill();
    inkLine(g, s);
    g.stroke();
  }
  // the neck
  if (L.neck > 0) {
    g.fillStyle = L.body;
    g.beginPath();
    const n0 = bx + bl * 0.7, n1 = hx - hl * 0.6, nw = Math.min(bw * 0.62, hw * 1.25);
    g.moveTo(n0, -nw);
    g.quadraticCurveTo((n0 + n1) / 2, -nw * 0.75, n1, -hw * 0.8);
    g.lineTo(n1, hw * 0.8);
    g.quadraticCurveTo((n0 + n1) / 2, nw * 0.75, n0, nw);
    g.closePath();
    g.fill();
    inkLine(g, s);
    g.stroke();
    if (L.mane === 'line') {
      g.strokeStyle = L.dark;
      g.lineWidth = Math.max(1.2, s * 0.05);
      g.beginPath();
      g.moveTo(n0 - bl * 0.12, 0);
      g.lineTo(n1 + hl * 0.2, 0);
      g.stroke();
    }
  }
  // ears and horns behind the head's crown
  ears(g, L, hx, hl, hw, s);
  horns(g, L, hx, hl, hw, s, bx, bl);
  // the head: a wedge toward the way it faces, a darker muzzle
  g.save();
  g.fillStyle = L.head;
  headPath(g, hx, hl, hw);
  g.fill();
  g.clip();
  g.fillStyle = L.coat === 'wool' ? 'rgba(0,0,0,.25)' : 'rgba(42,33,27,.32)';
  ell(g, hx + hl * 0.85, 0, hl * 0.45, hw * 0.9);
  g.fill();
  if (L === LOOKS.horse) {
    g.fillStyle = L.light;   // the blaze
    ell(g, hx + hl * 0.1, 0, hl * 0.55, hw * 0.18);
    g.fill();
  }
  if (L === LOOKS.donkey) {
    g.fillStyle = L.light;   // the pale muzzle
    ell(g, hx + hl * 0.75, 0, hl * 0.38, hw * 0.8);
    g.fill();
  }
  g.restore();
  inkLine(g, s);
  headPath(g, hx, hl, hw);
  g.stroke();
  if (L.mane === 'ring') {
    // a lion's brow over the mane
    g.strokeStyle = 'rgba(42,33,27,.45)';
    g.lineWidth = Math.max(0.8, s * 0.02);
    g.beginPath();
    g.moveTo(hx - hl * 0.2, -hw * 0.5);
    g.lineTo(hx + hl * 0.35, 0);
    g.lineTo(hx - hl * 0.2, hw * 0.5);
    g.stroke();
  }
}

function bodyPath(g: CanvasRenderingContext2D, L: Look, bx: number, bl: number, bw: number, s: number): void {
  if (L.coat === 'wool') {
    // a fleece: a scalloped edge around the oval
    g.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const r = 1 + (i % 2 ? 0.07 : -0.02);
      const x = bx + Math.cos(a) * bl * r, y = Math.sin(a) * bw * r;
      if (i === 0) g.moveTo(x, y);
      else {
        const am = ((i - 0.5) / n) * TAU;
        g.quadraticCurveTo(bx + Math.cos(am) * bl * 1.12, Math.sin(am) * bw * 1.12, x, y);
      }
    }
    g.closePath();
    return;
  }
  g.beginPath();
  // a body a little fuller at the shoulders than at the hips
  g.moveTo(bx - bl, 0);
  g.bezierCurveTo(bx - bl, -bw * 0.9, bx - bl * 0.2, -bw * 1.02, bx + bl * 0.35, -bw * 0.98);
  g.bezierCurveTo(bx + bl * 0.85, -bw * 0.92, bx + bl * 1.02, -bw * 0.45, bx + bl, 0);
  g.bezierCurveTo(bx + bl * 1.02, bw * 0.45, bx + bl * 0.85, bw * 0.92, bx + bl * 0.35, bw * 0.98);
  g.bezierCurveTo(bx - bl * 0.2, bw * 1.02, bx - bl, bw * 0.9, bx - bl, 0);
  g.closePath();
  void s;
}

function headPath(g: CanvasRenderingContext2D, hx: number, hl: number, hw: number): void {
  g.beginPath();
  g.moveTo(hx - hl, -hw * 0.85);
  g.bezierCurveTo(hx - hl * 0.2, -hw * 1.12, hx + hl * 0.75, -hw * 0.75, hx + hl, -hw * 0.25);
  g.quadraticCurveTo(hx + hl * 1.12, 0, hx + hl, hw * 0.25);
  g.bezierCurveTo(hx + hl * 0.75, hw * 0.75, hx - hl * 0.2, hw * 1.12, hx - hl, hw * 0.85);
  g.quadraticCurveTo(hx - hl * 1.15, 0, hx - hl, -hw * 0.85);
  g.closePath();
}

function coat(g: CanvasRenderingContext2D, L: Look, bx: number, bl: number, bw: number, s: number): void {
  if (L.coat === 'wool') {
    g.strokeStyle = 'rgba(120,100,80,.42)';
    g.lineWidth = Math.max(0.7, s * 0.018);
    for (let i = 0; i < 9; i++) {
      const x = bx + (hash(i * 3 + 1) - 0.5) * bl * 1.5, y = (hash(i * 3 + 2) - 0.5) * bw * 1.4;
      g.beginPath();
      g.arc(x, y, s * 0.035, 0.3, Math.PI * 1.6);
      g.stroke();
    }
  } else if (L.coat === 'patches') {
    g.fillStyle = L.light;
    for (const [px, py, r] of [[-0.45, -0.35, 0.34], [0.25, 0.4, 0.3], [0.55, -0.45, 0.2]]) {
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * TAU, rr = r * (0.8 + 0.4 * hash(i + px * 10));
        const x = bx + bl * px + Math.cos(a) * bl * rr, y = bw * py + Math.sin(a) * bw * rr;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
      g.fill();
    }
  } else if (L.coat === 'spots') {
    g.fillStyle = L.light;
    for (let i = 0; i < 12; i++) {
      const x = bx + (hash(i + 40) - 0.5) * bl * 1.4, y = (hash(i + 60) - 0.5) * bw * 1.2;
      ell(g, x, y, s * 0.022, s * 0.018);
      g.fill();
    }
  } else if (L.coat === 'stripe') {
    g.fillStyle = L.light;
    ell(g, bx, 0, bl * 0.85, bw * 0.16);
    g.fill();
  } else if (L.coat === 'barred') {
    g.strokeStyle = 'rgba(60,45,30,.45)';
    g.lineWidth = Math.max(0.7, s * 0.02);
    for (let i = 0; i < 6; i++) {
      const x = bx - bl * 0.7 + i * bl * 0.28;
      g.beginPath();
      g.moveTo(x, -bw);
      g.quadraticCurveTo(x + bl * 0.1, 0, x, bw);
      g.stroke();
    }
  }
}

function tail(g: CanvasRenderingContext2D, L: Look, x0: number, s: number, lw: number): void {
  g.strokeStyle = L.dark;
  g.fillStyle = L.dark;
  g.lineCap = 'round';
  if (L.tail === 'stub') {
    g.fillStyle = L === LOOKS.deer ? '#f6efe2' : L.body;
    ell(g, x0 - s * 0.02, 0, s * 0.05, s * 0.04);
    g.fill();
    inkLine(g, s);
    g.stroke();
  } else if (L.tail === 'thin' || L.tail === 'tuft') {
    g.lineWidth = Math.max(1, s * 0.03);
    g.beginPath();
    g.moveTo(x0 + s * 0.02, 0);
    g.quadraticCurveTo(x0 - s * 0.1, s * 0.05, x0 - s * 0.17, s * 0.02);
    g.stroke();
    ell(g, x0 - s * 0.18, s * 0.02, s * 0.035, s * 0.028);
    g.fill();
  } else if (L.tail === 'flow') {
    g.beginPath();
    g.moveTo(x0 + s * 0.03, -s * 0.035);
    g.quadraticCurveTo(x0 - s * 0.12, -s * 0.06, x0 - s * 0.24, s * 0.03);
    g.quadraticCurveTo(x0 - s * 0.12, s * 0.05, x0 + s * 0.03, s * 0.035);
    g.closePath();
    g.fill();
  }
  void lw;
}

function ears(g: CanvasRenderingContext2D, L: Look, hx: number, hl: number, hw: number, s: number): void {
  if (L.ears === 'none') return;
  const color = L.coat === 'wool' ? L.head : L.body;
  for (const side of [-1, 1]) {
    g.fillStyle = color;
    let ex = hx - hl * 0.7, ey = side * hw * 0.95, rx = s * 0.05, ry = s * 0.028, rot = side * -0.5;
    if (L.ears === 'tiny') { rx = s * 0.025; ry = s * 0.018; }
    if (L.ears === 'long') { ex = hx - hl * 1.15; ey = side * hw * 0.9; rx = s * 0.12; ry = s * 0.032; rot = side * -0.35; }
    if (L.ears === 'big') { rx = s * 0.075; ry = s * 0.04; ex = hx - hl * 0.85; ey = side * hw * 1.2; rot = side * -0.7; }
    if (L.ears === 'round') { rx = s * 0.035; ry = s * 0.035; ey = side * hw * 1.0; }
    ell(g, ex, ey, rx, ry, rot);
    g.fill();
    inkLine(g, s);
    g.lineWidth *= 0.8;
    g.stroke();
  }
}

function horns(g: CanvasRenderingContext2D, L: Look, hx: number, hl: number, hw: number, s: number, bx: number, bl: number): void {
  if (L.horns === 'none') return;
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    if (L.horns === 'goat') {
      g.strokeStyle = C.ink;
      g.lineWidth = Math.max(1.2, s * 0.04);
      g.beginPath();
      g.moveTo(hx - hl * 0.35, side * hw * 0.35);
      g.quadraticCurveTo(hx - hl * 1.2, side * hw * 0.9, hx - hl * 1.6, side * hw * 0.55);
      g.stroke();
    } else if (L.horns === 'cow') {
      g.strokeStyle = C.ink;
      g.lineWidth = Math.max(2, s * 0.06);
      g.beginPath();
      g.moveTo(hx - hl * 0.55, side * hw * 0.55);
      g.quadraticCurveTo(hx - hl * 0.6, side * hw * 1.6, hx + hl * 0.05, side * hw * 1.75);
      g.stroke();
      g.strokeStyle = '#efe4cf';
      g.lineWidth = Math.max(1, s * 0.03);
      g.stroke();
    } else if (L.horns === 'ibex') {
      // great ridged horns sweeping back over the neck
      const x0 = hx - hl * 0.4, y0 = side * hw * 0.4;
      const x1 = bx + bl * 0.15, y1 = side * hw * 0.9;
      g.strokeStyle = C.ink;
      g.lineWidth = Math.max(2.4, s * 0.075);
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2, side * hw * 2.1, x1, y1);
      g.stroke();
      g.strokeStyle = '#b39a74';
      g.lineWidth = Math.max(1.2, s * 0.042);
      g.stroke();
      g.strokeStyle = 'rgba(42,33,27,.6)';
      g.lineWidth = Math.max(0.7, s * 0.014);
      for (let i = 1; i < 6; i++) {
        const q = i / 6, mx = (x0 + x1) / 2, my = side * hw * 2.1;
        const x = (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * mx + q * q * x1;
        const y = (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * my + q * q * y1;
        g.beginPath();
        g.moveTo(x - s * 0.018, y - side * s * 0.02);
        g.lineTo(x + s * 0.018, y + side * s * 0.02);
        g.stroke();
      }
    } else if (L.horns === 'antler') {
      g.strokeStyle = '#5a3a20';
      g.lineWidth = Math.max(1.2, s * 0.034);
      const x0 = hx - hl * 0.5, y0 = side * hw * 0.5;
      const x1 = hx - hl * 2.1, y1 = side * hw * 2.6;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(hx - hl * 1.0, side * hw * 2.2, x1, y1);
      // tines
      for (const q of [0.35, 0.65]) {
        const x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q + side * hw * 0.5;
        g.moveTo(x, y);
        g.lineTo(x + hl * 0.45, y + side * hw * 0.55);
      }
      g.stroke();
    }
  }
}

function drawBird(g: CanvasRenderingContext2D, L: Look, s: number, pose: Pose): void {
  const b = L.bird!;
  const bl = (s * L.len) / 2, bw = (s * L.wid) / 2, bx = -s * 0.08;
  const hx = s * L.hx, hr = (s * L.hw) / 2;
  g.fillStyle = 'rgba(36,22,10,.28)';
  ell(g, bx + s * 0.03, s * 0.06, bl * 1.05, bw * 1.1);
  g.fill();
  // the tail fan
  g.fillStyle = L === LOOKS.partridge ? L.head : b.tips;
  g.beginPath();
  g.moveTo(bx - bl * 0.6, -bw * 0.4);
  g.lineTo(bx - bl * 1.35, -bw * 0.25);
  g.lineTo(bx - bl * 1.35, bw * 0.25);
  g.lineTo(bx - bl * 0.6, bw * 0.4);
  g.closePath();
  g.fill();
  // the body, a teardrop toward the tail
  const body = () => {
    g.beginPath();
    g.moveTo(bx + bl, 0);
    g.bezierCurveTo(bx + bl, -bw * 1.1, bx - bl * 0.6, -bw * 1.05, bx - bl * 1.1, -bw * 0.18);
    g.lineTo(bx - bl * 1.1, bw * 0.18);
    g.bezierCurveTo(bx - bl * 0.6, bw * 1.05, bx + bl, bw * 1.1, bx + bl, 0);
    g.closePath();
  };
  g.save();
  body();
  g.fillStyle = L.body;
  g.fill();
  g.clip();
  // folded wings along the sides, their tips dark (a stork's black flight feathers)
  for (const side of [-1, 1]) {
    g.fillStyle = L === LOOKS.partridge ? '#8b8170' : '#e9e5dc';
    ell(g, bx - bl * 0.1, side * bw * 0.55, bl * 0.95, bw * 0.52, side * 0.06);
    g.fill();
    g.fillStyle = b.tips;
    ell(g, bx - bl * 0.75, side * bw * 0.5, bl * 0.45, bw * 0.42, side * 0.1);
    g.fill();
  }
  coat(g, L, bx, bl, bw, s);
  hatch(g, bx - bl, bx + bl, bw * 0.3, bw * 1.1, s * 0.055, 0.3, 0.2, Math.max(0.6, s * 0.012));
  g.restore();
  inkLine(g, s);
  body();
  g.stroke();
  // the chevron
  g.save();
  g.strokeStyle = 'rgba(42,33,27,.6)';
  g.lineWidth = Math.max(1, s * 0.032);
  const cx = bx + bl * 0.2, ch = bw * 0.34;
  g.beginPath();
  g.moveTo(cx - ch * 0.6, -ch);
  g.lineTo(cx + ch * 0.45, 0);
  g.lineTo(cx - ch * 0.6, ch);
  g.stroke();
  g.restore();
  // neck, head, beak
  if (L.neck > 0) {
    g.fillStyle = L.head;
    g.beginPath();
    g.moveTo(bx + bl * 0.8, -hr * 0.7);
    g.lineTo(hx, -hr * 0.6);
    g.lineTo(hx, hr * 0.6);
    g.lineTo(bx + bl * 0.8, hr * 0.7);
    g.closePath();
    g.fill();
    inkLine(g, s);
    g.stroke();
  }
  g.fillStyle = b.beak;
  g.beginPath();
  g.moveTo(hx + hr * 0.6, -hr * 0.35);
  g.lineTo(hx + hr * 0.6 + s * b.beakLen, 0);
  g.lineTo(hx + hr * 0.6, hr * 0.35);
  g.closePath();
  g.fill();
  inkLine(g, s);
  g.lineWidth *= 0.7;
  g.stroke();
  g.fillStyle = L.head;
  ell(g, hx, 0, hr, hr);
  g.fill();
  inkLine(g, s);
  g.stroke();
  g.fillStyle = C.ink;
  for (const side of [-1, 1]) {
    ell(g, hx + hr * 0.25, side * hr * 0.55, Math.max(0.6, s * 0.012), Math.max(0.6, s * 0.012));
    g.fill();
  }
  void pose;
}

// ── animals in profile, on the new land ──────────────────────────
/**
 * A small animal in profile on the land (facing right when `face` > 0), `h` its height in px, grazing
 * when `graze` (its head down).  Kept simple: a woodcut silhouette in its colours, thin ink lines.
 */
export function paintProfile(ctx: CanvasRenderingContext2D, k: KindId, x: number, y: number, h: number, face: number, graze = 0, young = false): void {
  const L = LOOKS[k];
  const s = h * (young ? 0.62 : 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face < 0 ? -1 : 1, 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const lw = Math.max(0.7, s * 0.06);
  if (L.bird) {
    // a standing bird: legs, body, neck, head, beak
    const stork = k === 'stork';
    const legH = stork ? s * 0.45 : s * 0.16;
    ctx.strokeStyle = stork ? L.bird.beak : C.ink;
    ctx.lineWidth = Math.max(0.7, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -legH);
    ctx.lineTo(-s * 0.08, 0);
    ctx.moveTo(s * 0.05, -legH);
    ctx.lineTo(s * 0.06, 0);
    ctx.stroke();
    const by = -legH - s * (stork ? 0.17 : 0.2);
    ctx.fillStyle = L.body;
    ell(ctx, 0, by, s * (stork ? 0.3 : 0.28), s * (stork ? 0.17 : 0.2), stork ? -0.1 : 0);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.fillStyle = L.bird.tips;
    ell(ctx, -s * 0.12, by + s * 0.02, s * 0.17, s * 0.09, -0.15);
    ctx.fill();
    const nx = s * (stork ? 0.22 : 0.2), ny = by - s * (stork ? 0.32 : 0.12) * (1 - graze * 0.8);
    ctx.strokeStyle = L.head;
    ctx.lineWidth = Math.max(1, s * (stork ? 0.08 : 0.12));
    ctx.beginPath();
    ctx.moveTo(s * 0.18, by - s * 0.05);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    ctx.fillStyle = L.head;
    ell(ctx, nx, ny, s * 0.07, s * 0.06);
    ctx.fill();
    ctx.fillStyle = L.bird.beak;
    ctx.beginPath();
    ctx.moveTo(nx + s * 0.05, ny - s * 0.02);
    ctx.lineTo(nx + s * (stork ? 0.3 : 0.12), ny + s * (stork ? 0.06 : 0.02) + graze * s * 0.1);
    ctx.lineTo(nx + s * 0.05, ny + s * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  const bodyW = s * (L.len * 1.05), bodyH = s * (L.wid * 0.85);
  const legH = s * (k === 'hyrax' ? 0.1 : k === 'camel' ? 0.42 : k === 'sheep' ? 0.22 : 0.3);
  const by = -legH - bodyH * 0.45;
  // legs
  ctx.strokeStyle = L.dark;
  ctx.lineWidth = Math.max(0.8, s * 0.07);
  ctx.beginPath();
  for (const lx of [-0.36, -0.22, 0.24, 0.36]) {
    ctx.moveTo(bodyW * lx, by + bodyH * 0.2);
    ctx.lineTo(bodyW * lx + (lx > 0 ? s * 0.02 : -s * 0.01), 0);
  }
  ctx.stroke();
  // tail
  if (L.tail !== 'none') {
    ctx.strokeStyle = L.tail === 'stub' ? L.body : L.dark;
    ctx.lineWidth = Math.max(0.8, s * (L.tail === 'flow' ? 0.1 : 0.05));
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.48, by - bodyH * 0.1);
    ctx.quadraticCurveTo(-bodyW * 0.62, by + bodyH * 0.2, -bodyW * 0.6, by + bodyH * (L.tail === 'stub' ? 0.05 : 0.65));
    ctx.stroke();
  }
  // body
  ctx.fillStyle = L.body;
  if (L.coat === 'wool') {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * TAU, r = i % 2 ? 1.08 : 0.96;
      const px = Math.cos(a) * bodyW * 0.5 * r, py = by + Math.sin(a) * bodyH * 0.55 * r;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else ell(ctx, 0, by, bodyW * 0.5, bodyH * 0.5);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw;
  ctx.stroke();
  if (L.hump) {
    ctx.fillStyle = L.light;
    ell(ctx, -bodyW * 0.05, by - bodyH * 0.45, bodyW * 0.22, bodyH * 0.38);
    ctx.fill();
    ctx.stroke();
  }
  if (L.coat === 'patches') {
    ctx.fillStyle = L.light;
    ell(ctx, -bodyW * 0.15, by - bodyH * 0.05, bodyW * 0.14, bodyH * 0.22);
    ctx.fill();
  }
  if (L.coat === 'spots') {
    ctx.fillStyle = L.light;
    for (let i = 0; i < 4; i++) {
      ell(ctx, -bodyW * 0.25 + i * bodyW * 0.13, by - bodyH * 0.15, s * 0.025, s * 0.02);
      ctx.fill();
    }
  }
  // neck and head, down when grazing
  const nx = bodyW * 0.42, ny = by - bodyH * 0.2;
  const tall = k === 'camel' ? 0.55 : k === 'horse' || k === 'deer' || k === 'donkey' ? 0.42 : k === 'hyrax' ? 0.08 : 0.28;
  const hx = nx + s * (k === 'camel' ? 0.2 : 0.16), hy = ny - s * tall * (1 - graze) + graze * (legH + bodyH * 0.2);
  ctx.strokeStyle = L.coat === 'wool' ? L.body : L.body;
  ctx.lineWidth = Math.max(1, s * (k === 'camel' ? 0.11 : 0.16));
  ctx.beginPath();
  ctx.moveTo(nx - s * 0.05, ny);
  ctx.quadraticCurveTo(nx + s * 0.04, (ny + hy) / 2 - s * 0.05, hx, hy);
  ctx.stroke();
  if (L.mane === 'ring') {
    ctx.fillStyle = L.dark;
    ell(ctx, hx - s * 0.05, hy + s * 0.02, s * 0.17, s * 0.19);
    ctx.fill();
  }
  ctx.fillStyle = L.head;
  ctx.beginPath();
  ctx.moveTo(hx - s * 0.08, hy - s * 0.07);
  ctx.lineTo(hx + s * 0.13, hy + s * 0.01 + graze * s * 0.04);
  ctx.lineTo(hx + s * 0.1, hy + s * 0.07);
  ctx.lineTo(hx - s * 0.08, hy + s * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
  // ears / horns
  ctx.strokeStyle = L.horns === 'cow' ? '#efe4cf' : L.horns === 'none' ? L.head : '#4a3a2a';
  ctx.lineWidth = Math.max(0.8, s * (L.horns === 'ibex' ? 0.07 : 0.045));
  ctx.beginPath();
  if (L.horns === 'ibex') {
    ctx.moveTo(hx - s * 0.04, hy - s * 0.06);
    ctx.quadraticCurveTo(hx - s * 0.12, hy - s * 0.36, hx - s * 0.3, hy - s * 0.18);
  } else if (L.horns === 'goat') {
    ctx.moveTo(hx - s * 0.04, hy - s * 0.06);
    ctx.quadraticCurveTo(hx - s * 0.08, hy - s * 0.2, hx - s * 0.16, hy - s * 0.14);
  } else if (L.horns === 'antler') {
    ctx.moveTo(hx - s * 0.03, hy - s * 0.06);
    ctx.lineTo(hx - s * 0.1, hy - s * 0.32);
    ctx.moveTo(hx - s * 0.07, hy - s * 0.2);
    ctx.lineTo(hx + s * 0.04, hy - s * 0.3);
    ctx.moveTo(hx - s * 0.09, hy - s * 0.28);
    ctx.lineTo(hx - s * 0.2, hy - s * 0.36);
  } else if (L.horns === 'cow') {
    ctx.moveTo(hx - s * 0.04, hy - s * 0.06);
    ctx.quadraticCurveTo(hx - s * 0.02, hy - s * 0.17, hx + s * 0.06, hy - s * 0.16);
  } else {
    const long = L.ears === 'long' || L.ears === 'big';
    ctx.moveTo(hx - s * 0.05, hy - s * 0.05);
    ctx.lineTo(hx - s * (long ? 0.12 : 0.08), hy - s * (long ? 0.22 : 0.12));
  }
  ctx.stroke();
  ctx.restore();
}

// ── the dove, Noah and the family, a hand ────────────────────────
/** Noah's dove, white, wings open with `flap` (−1..1); with an olive leaf in its beak. */
export function paintDove(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, flap: number, leaf: boolean, face = 1): void {
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face < 0 ? -1 : 1, 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // the far wing
  const wing = (up: number, shade: string) => {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.02);
    ctx.quadraticCurveTo(-s * 0.15, -s * (0.25 + 0.45 * up), -s * 0.55, -s * (0.1 + 0.55 * up));
    ctx.quadraticCurveTo(-s * 0.3, -s * (0.02 + 0.15 * up), s * 0.12, s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(0.7, s * 0.035);
    ctx.stroke();
  };
  wing(0.6 * flap + 0.2, '#d9d6cf');
  // body
  ctx.fillStyle = '#f7f5f0';
  ctx.beginPath();
  ctx.moveTo(s * 0.36, -s * 0.05);
  ctx.quadraticCurveTo(s * 0.2, s * 0.14, -s * 0.2, s * 0.08);
  ctx.lineTo(-s * 0.46, s * 0.13);
  ctx.lineTo(-s * 0.42, -s * 0.02);
  ctx.quadraticCurveTo(-s * 0.05, -s * 0.12, s * 0.22, -s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(0.7, s * 0.035);
  ctx.stroke();
  // head, eye, beak
  ctx.fillStyle = '#f7f5f0';
  ell(ctx, s * 0.32, -s * 0.11, s * 0.09, s * 0.08);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c9895a';
  ctx.beginPath();
  ctx.moveTo(s * 0.4, -s * 0.12);
  ctx.lineTo(s * 0.48, -s * 0.1);
  ctx.lineTo(s * 0.4, -s * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.ink;
  ell(ctx, s * 0.34, -s * 0.125, Math.max(0.5, s * 0.014), Math.max(0.5, s * 0.014));
  ctx.fill();
  if (leaf) paintLeaf(ctx, s * 0.52, -s * 0.06, s * 0.2, 0.5);
  // the near wing
  wing(-0.6 * flap + 0.25, '#ffffff');
  ctx.restore();
}

/** An olive leaf (silver-green, a carved midrib). */
export function paintLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = C.leaf;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.28, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.28, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(42,33,27,.7)';
  ctx.lineWidth = Math.max(0.5, len * 0.06);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(230,240,210,.7)';
  ctx.lineWidth = Math.max(0.4, len * 0.04);
  ctx.beginPath();
  ctx.moveTo(len * 0.05, 0);
  ctx.lineTo(len * 0.9, 0);
  ctx.stroke();
  ctx.restore();
}

/**
 * A small figure seen from behind (Noah, one of the family): a hooded robe, no face.  `arm`
 * raises the right arm (0..1, a hammer or a reaching hand); `tone` picks the robe.
 */
export function paintFigure(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, arm: number, tone = 0, hammer = false): void {
  const robes = ['#6b4a2f', '#4f5a46', '#7a5a3c', '#5d4a5a'];
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(30,20,10,.25)';
  ell(ctx, 0, 0, h * 0.24, h * 0.06);
  ctx.fill();
  // the robe
  ctx.fillStyle = robes[tone % robes.length];
  ctx.beginPath();
  ctx.moveTo(-h * 0.2, 0);
  ctx.quadraticCurveTo(-h * 0.22, -h * 0.5, -h * 0.12, -h * 0.72);
  ctx.lineTo(h * 0.12, -h * 0.72);
  ctx.quadraticCurveTo(h * 0.22, -h * 0.5, h * 0.2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(0.8, h * 0.04);
  ctx.stroke();
  // folds, carved
  ctx.strokeStyle = 'rgba(42,33,27,.4)';
  ctx.lineWidth = Math.max(0.6, h * 0.025);
  ctx.beginPath();
  ctx.moveTo(-h * 0.06, -h * 0.6);
  ctx.lineTo(-h * 0.09, -h * 0.05);
  ctx.moveTo(h * 0.06, -h * 0.6);
  ctx.lineTo(h * 0.08, -h * 0.05);
  ctx.stroke();
  // the arm
  const ax = h * 0.12, ay = -h * 0.62;
  const ang = -0.25 - arm * 1.3;   // from forward and a little up (0) to raised high (1)
  const ex = ax + Math.cos(ang) * h * 0.3, ey = ay + Math.sin(ang) * h * 0.3;
  ctx.strokeStyle = robes[tone % robes.length];
  ctx.lineWidth = Math.max(1.2, h * 0.09);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  if (hammer) {
    ctx.strokeStyle = '#5a3d24';
    ctx.lineWidth = Math.max(0.8, h * 0.035);
    const hx = ex + Math.cos(ang) * h * 0.14, hy = ey + Math.sin(ang) * h * 0.14;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = '#2f2f33';
    ell(ctx, hx, hy, h * 0.05, h * 0.03, ang + Math.PI / 2);
    ctx.fill();
  }
  // the head, hooded, seen from behind
  ctx.fillStyle = '#8a6a4a';
  ell(ctx, 0, -h * 0.82, h * 0.11, h * 0.12);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(0.8, h * 0.04);
  ctx.stroke();
  ctx.fillStyle = robes[(tone + 1) % robes.length];
  ctx.beginPath();
  ctx.arc(0, -h * 0.84, h * 0.115, Math.PI * 0.95, Math.PI * 2.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Noah's hand reaching from its sleeve toward `angle` (rad): it leads an animal back. */
export function paintHand(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, alpha: number): void {
  const s = size;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineJoin = 'round';
  // the sleeve
  ctx.fillStyle = '#6b4a2f';
  ctx.beginPath();
  ctx.moveTo(-s * 0.9, -s * 0.2);
  ctx.lineTo(-s * 0.25, -s * 0.16);
  ctx.lineTo(-s * 0.25, s * 0.16);
  ctx.lineTo(-s * 0.9, s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(0.8, s * 0.06);
  ctx.stroke();
  // the hand, open, fingers together
  ctx.fillStyle = '#d9a982';
  ctx.beginPath();
  ctx.moveTo(-s * 0.26, -s * 0.13);
  ctx.quadraticCurveTo(s * 0.05, -s * 0.2, s * 0.32, -s * 0.08);
  ctx.quadraticCurveTo(s * 0.4, 0, s * 0.3, s * 0.06);
  ctx.quadraticCurveTo(s * 0.05, s * 0.18, -s * 0.26, s * 0.13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(42,33,27,.4)';
  ctx.lineWidth = Math.max(0.5, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.05);
  ctx.lineTo(s * 0.26, -s * 0.03);
  ctx.moveTo(0, s * 0.04);
  ctx.lineTo(s * 0.24, s * 0.03);
  ctx.stroke();
  ctx.restore();
}

// ── the land's things ────────────────────────────────────────────
/** An olive tree: a gnarled trunk, a silver-green crown with carved leaves. */
export function paintOlive(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, seed: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#5a4430';
  ctx.lineWidth = Math.max(1, h * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-h * 0.08, -h * 0.25, h * 0.04, -h * 0.5);
  ctx.moveTo(h * 0.0, -h * 0.3);
  ctx.lineTo(-h * 0.16, -h * 0.5);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = hash(seed + i) * TAU;
    const cx = Math.cos(a) * h * 0.18, cy = -h * 0.62 + Math.sin(a) * h * 0.1;
    ctx.fillStyle = i % 2 ? '#8fa37a' : '#7d9468';
    ell(ctx, cx, cy, h * (0.2 + 0.06 * hash(seed + i + 9)), h * 0.15);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(42,33,27,.55)';
  ctx.lineWidth = Math.max(0.6, h * 0.03);
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.62, h * 0.34, h * 0.22, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,245,225,.5)';
  for (let i = 0; i < 6; i++) {
    ell(ctx, (hash(seed + i * 7) - 0.5) * h * 0.5, -h * 0.66 + (hash(seed + i * 11) - 0.5) * h * 0.2, h * 0.04, h * 0.015, 0.4);
    ctx.fill();
  }
  ctx.restore();
}

/** A small tree on the hills (a cypress, where the storks nest). */
export function paintCypress(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, tone: string): void {
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.quadraticCurveTo(x + h * 0.2, y - h * 0.45, x + h * 0.08, y);
  ctx.lineTo(x - h * 0.08, y);
  ctx.quadraticCurveTo(x - h * 0.2, y - h * 0.45, x, y - h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(42,33,27,.35)';
  ctx.lineWidth = Math.max(0.5, h * 0.02);
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const yy = y - h * (i / 5);
    ctx.moveTo(x - h * 0.06, yy);
    ctx.lineTo(x + h * 0.05, yy - h * 0.05);
  }
  ctx.stroke();
}

/**
 * The family's homestead with `built` stages standing (0..6): a shelter, a fence, a well, a table
 * under a tree, a garden, a home; `s` its scale (px), standing on the ground at (x, y).
 */
export function paintHomestead(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, built: number, lamp = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const ink = (w = 0.025) => {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(0.7, s * w);
  };
  if (built >= 5) {
    // the garden: rows of green before the house
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#6f9a45' : '#86ad57';
      ell(ctx, -s * 0.15 + i * s * 0.14, s * 0.02, s * 0.06, s * 0.025);
      ctx.fill();
    }
  }
  if (built >= 6) {
    // the home: walls, a roof, a door, a window lit at dusk
    ctx.fillStyle = '#d8c3a0';
    ctx.fillRect(-s * 0.05, -s * 0.34, s * 0.42, s * 0.3);
    ink();
    ctx.strokeRect(-s * 0.05, -s * 0.34, s * 0.42, s * 0.3);
    ctx.fillStyle = '#7a4a2e';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.33);
    ctx.lineTo(s * 0.16, -s * 0.52);
    ctx.lineTo(s * 0.42, -s * 0.33);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a3d24';
    ctx.fillRect(s * 0.02, -s * 0.18, s * 0.08, s * 0.14);
    ctx.fillStyle = lamp > 0 ? `rgba(255,190,90,${0.5 + 0.5 * lamp})` : '#4a3a2c';
    ctx.fillRect(s * 0.2, -s * 0.26, s * 0.09, s * 0.07);
  } else if (built >= 1) {
    // the shelter: four posts and a thatched roof
    ctx.strokeStyle = '#5a3d24';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    for (const px of [0, 0.3]) {
      ctx.moveTo(s * px, 0);
      ctx.lineTo(s * px, -s * 0.22);
    }
    ctx.stroke();
    ctx.fillStyle = C.straw;
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -s * 0.2);
    ctx.lineTo(s * 0.15, -s * 0.34);
    ctx.lineTo(s * 0.36, -s * 0.2);
    ctx.closePath();
    ctx.fill();
    ink();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(42,33,27,.4)';
    ctx.lineWidth = Math.max(0.5, s * 0.012);
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      ctx.moveTo(-s * 0.04 + i * s * 0.07, -s * 0.21);
      ctx.lineTo(s * 0.12 + i * s * 0.02, -s * 0.31);
    }
    ctx.stroke();
  }
  if (built >= 2) {
    // the fence
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = Math.max(0.8, s * 0.022);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const fx = -s * 0.62 + i * s * 0.09;
      ctx.moveTo(fx, 0);
      ctx.lineTo(fx, -s * 0.12);
    }
    ctx.moveTo(-s * 0.64, -s * 0.09);
    ctx.lineTo(-s * 0.15, -s * 0.09);
    ctx.moveTo(-s * 0.64, -s * 0.04);
    ctx.lineTo(-s * 0.15, -s * 0.04);
    ctx.stroke();
  }
  if (built >= 3) {
    // the well: a stone ring and a little roof
    ctx.fillStyle = '#a69a86';
    ctx.fillRect(s * 0.48, -s * 0.09, s * 0.16, s * 0.09);
    ink(0.02);
    ctx.strokeRect(s * 0.48, -s * 0.09, s * 0.16, s * 0.09);
    ctx.strokeStyle = '#5a3d24';
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s * 0.09);
    ctx.lineTo(s * 0.5, -s * 0.24);
    ctx.moveTo(s * 0.62, -s * 0.09);
    ctx.lineTo(s * 0.62, -s * 0.24);
    ctx.stroke();
    ctx.fillStyle = '#7a4a2e';
    ctx.beginPath();
    ctx.moveTo(s * 0.46, -s * 0.23);
    ctx.lineTo(s * 0.56, -s * 0.3);
    ctx.lineTo(s * 0.66, -s * 0.23);
    ctx.closePath();
    ctx.fill();
  }
  if (built >= 4) {
    // the table under a tree
    paintOlive(ctx, s * 0.86, 0, s * 0.42, 31);
    ctx.fillStyle = '#8a6440';
    ctx.fillRect(s * 0.72, -s * 0.08, s * 0.2, s * 0.025);
    ctx.strokeStyle = '#5a3d24';
    ctx.lineWidth = Math.max(0.7, s * 0.018);
    ctx.beginPath();
    ctx.moveTo(s * 0.74, -s * 0.06);
    ctx.lineTo(s * 0.74, 0);
    ctx.moveTo(s * 0.9, -s * 0.06);
    ctx.lineTo(s * 0.9, 0);
    ctx.stroke();
  }
  ctx.restore();
}

/** The covenant's bow: soft pastel bands at about 60 % opacity, `k` how far it has risen (0..1). */
export function paintRainbow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, k: number, alpha = 0.6): void {
  if (k <= 0) return;
  const bands = ['#e9a7a1', '#efc59a', '#efe2a2', '#b8d8a4', '#a7cde0', '#b6b0dc'];
  const bw = r * 0.045;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'butt';
  const a0 = Math.PI, a1 = Math.PI + Math.PI * Math.min(1, k);
  bands.forEach((col, i) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = bw + 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r - i * bw, a0, a1);
    ctx.stroke();
  });
  ctx.restore();
}

// ── wood ─────────────────────────────────────────────────────────
/**
 * Planks across a rectangle (the hull, the deck, the landing): long boards of slightly different
 * tone with carved grain, knots and nails, the joints cut dark.  Horizontal boards `bh` px high.
 */
export function paintPlanks(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bh: number, tones: readonly string[], seed: number, vertical = false): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const len = vertical ? h : w, across = vertical ? w : h;
  const n = Math.ceil(across / bh) + 1;
  for (let i = 0; i < n; i++) {
    // each row of boards, its joints staggered
    let at = -hash(seed + i * 7) * len * 0.5;
    let j = 0;
    while (at < len) {
      const bl = len * (0.35 + 0.4 * hash(seed + i * 13 + j * 3));
      const tone = tones[Math.floor(hash(seed + i * 5 + j) * tones.length) % tones.length];
      const r = vertical ? { x: x + i * bh, y: y + at, w: bh, h: bl } : { x: x + at, y: y + i * bh, w: bl, h: bh };
      g.fillStyle = tone;
      g.fillRect(r.x, r.y, r.w, r.h);
      // grain: long thin carved strokes
      g.strokeStyle = 'rgba(30,20,12,.22)';
      g.lineWidth = Math.max(0.5, bh * 0.025);
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const off = bh * (0.25 + 0.22 * k + 0.08 * hash(seed + i + j + k));
        if (vertical) {
          g.moveTo(r.x + off, r.y + 2);
          g.bezierCurveTo(r.x + off + bh * 0.08, r.y + r.h * 0.3, r.x + off - bh * 0.08, r.y + r.h * 0.7, r.x + off, r.y + r.h - 2);
        } else {
          g.moveTo(r.x + 2, r.y + off);
          g.bezierCurveTo(r.x + r.w * 0.3, r.y + off + bh * 0.08, r.x + r.w * 0.7, r.y + off - bh * 0.08, r.x + r.w - 2, r.y + off);
        }
      }
      g.stroke();
      // a knot now and then
      if (hash(seed + i * 31 + j * 17) < 0.3) {
        const kx = vertical ? r.x + bh * 0.5 : r.x + r.w * (0.2 + 0.6 * hash(seed + i + j * 9));
        const ky = vertical ? r.y + r.h * (0.2 + 0.6 * hash(seed + i + j * 9)) : r.y + bh * 0.5;
        g.strokeStyle = 'rgba(30,20,12,.35)';
        g.beginPath();
        g.ellipse(kx, ky, bh * 0.16, bh * 0.09, vertical ? Math.PI / 2 : 0, 0, TAU);
        g.stroke();
      }
      // the light catches the board's upper edge, the joint below is cut dark
      g.fillStyle = 'rgba(255,240,215,.08)';
      if (vertical) g.fillRect(r.x, r.y, Math.max(1, bh * 0.08), r.h); else g.fillRect(r.x, r.y, r.w, Math.max(1, bh * 0.08));
      g.fillStyle = 'rgba(20,12,6,.55)';
      if (vertical) {
        g.fillRect(r.x + bh - 1, r.y, 1.2, r.h);
        g.fillRect(r.x, r.y + r.h - 1, bh, 1.2);
      } else {
        g.fillRect(r.x, r.y + bh - 1, r.w, 1.2);
        g.fillRect(r.x + r.w - 1, r.y, 1.2, bh);
      }
      // two nails at each board's end
      g.fillStyle = 'rgba(30,24,20,.6)';
      for (const nk of [0.3, 0.7]) {
        if (vertical) g.fillRect(r.x + bh * nk - 0.8, r.y + 3, 1.6, 1.6);
        else g.fillRect(r.x + 3, r.y + bh * nk - 0.8, 1.6, 1.6);
      }
      at += bl;
      j++;
    }
  }
  g.restore();
}

/** Straw strewn over a rectangle (the Evening's veil over the sleeping deck), drawn once per size. */
export function strawSprite(w: number, h: number, dpr: number, seed = 5): HTMLCanvasElement {
  const c = canvas(w * dpr, h * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const n = Math.round((w * h) / 70);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = hash(seed + i * 3) * w, y = hash(seed + i * 3 + 1) * h;
    const a = (hash(seed + i * 3 + 2) - 0.5) * 1.6 + (i % 3 ? 0 : Math.PI / 2);
    const len = 6 + hash(seed + i) * 14;
    g.strokeStyle = i % 4 === 0 ? C.straw2 : i % 4 === 1 ? '#b8862f' : C.straw;
    g.lineWidth = 1 + hash(seed + i + 77) * 1.3;
    g.beginPath();
    g.moveTo(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2);
    g.lineTo(x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2);
    g.stroke();
  }
  return c;
}

/** A soft round glow (lanterns, the door's light), white at its heart; drawn once per colour. */
const glows = new Map<string, HTMLCanvasElement>();
export function glow(color: string): HTMLCanvasElement {
  let c = glows.get(color);
  if (c) return c;
  c = canvas(128, 128);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glows.set(color, c);
  return c;
}
