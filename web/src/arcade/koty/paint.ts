/**
 * Kocia straż's pictures, drawn with canvas paths (no images): a picture-book look in warm honey stone,
 * vine green, grape violet and golden eyes, every figure outlined in soft brown ink.  The abbey's cats
 * sit facing us with their eyes on the field (gold when they are alert), the pests are round-eyed and a
 * little comic (startled, they squeeze their eyes and bolt), the chiefs wear what makes them chiefs
 * (a scarf, a straw crown, pearls, spectacles), the toys are toys.  The places of the abbey are drawn
 * once per size into a cache; everything that moves is drawn every frame, cheaply.
 */
import { MIN_TEXT } from '../kit/mobile';
import type { BossId, CatSpec, FamId, PestId, PlaceId, Toy } from './content';
import { gradeColor } from './content';

export const INK = '#3b2a20';
export const CREAM = '#fff4dc';
export const GOLD = '#ffc94a';
export const GOLD_HI = '#ffe58a';
export const REST = '#8fc0ff';
export const DUSK = '#5a4a8a';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
const TAU = Math.PI * 2;

/**
 * A canvas font, never under MIN_TEXT (11 px: the smallest text a phone held at arm's length still shows, kit/mobile);
 * text the player must read to play asks for 13 px and more itself.
 */
export const fontPx = (px: number): number => Math.max(MIN_TEXT, Math.round(px * 2) / 2);
export const font = (px: number, weight = 700, serif = false): string => `${weight} ${fontPx(px)}px ${serif ? SERIF : SANS}`;

// ── small helpers ────────────────────────────────────────────────
export function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function fs(ctx: CanvasRenderingContext2D, fill: string, line = 0, stroke = INK): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (line > 0) {
    ctx.lineWidth = line;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** A stable pseudo-random 0..1 for an integer (decorations that never jump). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgba: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  g.addColorStop(0, `${rgba}${a})`);
  g.addColorStop(1, `${rgba}0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r), 0, TAU);
  ctx.fill();
}

/** Text with a soft dark edge so it reads on any ground. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color = CREAM, align: CanvasTextAlign = 'center', weight = 800): void {
  ctx.font = font(px, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, px * 0.22);
  ctx.strokeStyle = 'rgba(40,24,14,.72)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Fit a text into a width by shrinking the font down to `min` px (never under MIN_TEXT); returns the size used. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min = MIN_TEXT, weight = 700, serif = false): number {
  const floor = Math.max(MIN_TEXT, min);
  let size = fontPx(Math.max(floor, px));
  ctx.font = font(size, weight, serif);
  while (size > floor && ctx.measureText(text).width > maxW) {
    size = Math.max(floor, size - 0.5);
    ctx.font = font(size, weight, serif);
  }
  return size;
}

// ── the places ───────────────────────────────────────────────────
interface Ground { top: string; bottom: string; line: string; deco: string; deco2: string; accent: string; sky: [string, string] }

export const GROUND: Readonly<Record<PlaceId, Ground>> = {
  winnica: { top: '#c9d98e', bottom: '#a9c26a', line: '#8aa652', deco: '#5f8f3a', deco2: '#7b4fa0', accent: '#e8d7a8', sky: ['#ffe9b8', '#bfe2ee'] },
  spichlerz: { top: '#e2c08a', bottom: '#cfa468', line: '#b98b52', deco: '#efe0b8', deco2: '#c9a24f', accent: '#8a5a32', sky: ['#ffe2b0', '#d8c8e8'] },
  sad: { top: '#bfe08f', bottom: '#94c46a', line: '#7bab55', deco: '#5c9a45', deco2: '#e5533d', accent: '#f6f0c8', sky: ['#fff0c4', '#bfe6f5'] },
  warzywnik: { top: '#b6a074', bottom: '#9a845c', line: '#7e6a46', deco: '#6aa84a', deco2: '#f08a3c', accent: '#d9c79a', sky: ['#ffe8b8', '#cde6f0'] },
  staw: { top: '#9ed0d8', bottom: '#6fb0c0', line: '#5c9eae', deco: '#6fa85a', deco2: '#f5f0d8', accent: '#d8c79a', sky: ['#fff1cc', '#bfe0f2'] },
  skryptorium: { top: '#d8c3a0', bottom: '#bfa47c', line: '#a88b62', deco: '#7a4e32', deco2: '#e9dcc0', accent: '#5a3a28', sky: ['#f6e2c0', '#c8b8d8'] },
};

/** The field of a place: its ground, its rows and goods (drawn once per size into the cache). */
export function paintGround(ctx: CanvasRenderingContext2D, place: PlaceId, x: number, y: number, w: number, h: number, s: number): void {
  const g = GROUND[place];
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, g.top);
  grad.addColorStop(1, g.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // speckles of texture
  for (let i = 0; i < 90; i++) {
    const px = x + hash(i * 3.1) * w, py = y + hash(i * 7.7) * h;
    ctx.fillStyle = hash(i) > 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(60,40,20,.07)';
    ell(ctx, px, py, s * (0.05 + hash(i * 2) * 0.08), s * 0.04);
    ctx.fill();
  }
  switch (place) {
    case 'winnica': {
      // rows of vines across the slope, posts and wires, grapes hanging
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const ry = y + h * (0.16 + (r / (rows - 1)) * 0.7);
        ctx.strokeStyle = 'rgba(90,60,30,.45)';
        ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath();
        ctx.moveTo(x, ry - s * 0.35);
        ctx.lineTo(x + w, ry - s * 0.35);
        ctx.stroke();
        for (let k = 0; k <= 8; k++) {
          const px = x + (k / 8) * w;
          ctx.fillStyle = '#8a6440';
          ctx.fillRect(px - s * 0.04, ry - s * 0.55, s * 0.08, s * 0.55);
        }
        for (let k = 0; k < 14; k++) {
          const px = x + ((k + 0.5) / 14) * w + (hash(r * 31 + k) - 0.5) * s * 0.3;
          ctx.fillStyle = k % 2 ? g.deco : '#6c9c40';
          ell(ctx, px, ry - s * 0.32, s * 0.42, s * 0.24);
          fs(ctx, k % 2 ? g.deco : '#6c9c40');
          if (hash(r * 13 + k) > 0.45) {
            ctx.fillStyle = g.deco2;
            for (let q = 0; q < 4; q++) {
              ell(ctx, px + (q % 2 - 0.5) * s * 0.1, ry - s * 0.12 + Math.floor(q / 2) * s * 0.1, s * 0.07, s * 0.07);
              ctx.fill();
            }
          }
        }
      }
      break;
    }
    case 'spichlerz': {
      // floor boards, sacks of grain and spilled corn
      ctx.strokeStyle = 'rgba(120,80,40,.35)';
      ctx.lineWidth = 1;
      for (let k = 1; k < 9; k++) {
        ctx.beginPath();
        ctx.moveTo(x, y + (k / 9) * h);
        ctx.lineTo(x + w, y + (k / 9) * h);
        ctx.stroke();
      }
      for (let i = 0; i < 9; i++) {
        // a burlap sack of grain, tied at the neck, a little grain spilled at its foot
        const px = x + (0.08 + hash(i * 5.3) * 0.84) * w, py = y + (0.2 + hash(i * 9.1) * 0.66) * h;
        ctx.beginPath();
        ctx.moveTo(px - s * 0.18, py - s * 0.42);
        ctx.quadraticCurveTo(px - s * 0.5, py - s * 0.2, px - s * 0.4, py + s * 0.32);
        ctx.quadraticCurveTo(px, py + s * 0.44, px + s * 0.4, py + s * 0.32);
        ctx.quadraticCurveTo(px + s * 0.5, py - s * 0.2, px + s * 0.18, py - s * 0.42);
        ctx.closePath();
        fs(ctx, '#d9b77e', 1.2);
        ctx.strokeStyle = 'rgba(120,80,40,.4)';
        ctx.lineWidth = 1;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(px + k * s * 0.14, py - s * 0.2);
          ctx.lineTo(px + k * s * 0.18, py + s * 0.3);
          ctx.stroke();
        }
        ctx.fillStyle = '#8a5a32';
        ctx.fillRect(px - s * 0.2, py - s * 0.45, s * 0.4, s * 0.08);
        ell(ctx, px, py - s * 0.55, s * 0.16, s * 0.1);
        fs(ctx, g.deco2, 1);
        ctx.fillStyle = '#e8c45c';
        for (let k = 0; k < 4; k++) {
          ell(ctx, px + (hash(i * 4 + k) - 0.5) * s * 0.9, py + s * (0.42 + hash(k + i) * 0.1), s * 0.05, s * 0.035);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#e8c45c';
      for (let i = 0; i < 40; i++) {
        ell(ctx, x + hash(i * 1.7) * w, y + hash(i * 4.9) * h, s * 0.05, s * 0.035);
        ctx.fill();
      }
      break;
    }
    case 'sad': {
      // apple trees seen from above: round crowns with red apples, fallen apples in the grass
      for (let i = 0; i < 7; i++) {
        const px = x + (0.1 + (i / 6) * 0.8) * w + (hash(i) - 0.5) * s, py = y + (0.25 + (i % 2) * 0.35 + hash(i * 3) * 0.12) * h;
        ctx.fillStyle = 'rgba(40,60,20,.18)';
        ell(ctx, px + s * 0.2, py + s * 0.25, s * 1.0, s * 0.8);
        ctx.fill();
        ell(ctx, px, py, s * 0.95, s * 0.8);
        fs(ctx, g.deco, 1.2);
        ell(ctx, px - s * 0.25, py - s * 0.2, s * 0.45, s * 0.35);
        fs(ctx, '#77b357');
        for (let q = 0; q < 5; q++) {
          ctx.fillStyle = g.deco2;
          ell(ctx, px + (hash(i * 7 + q) - 0.5) * s * 1.3, py + (hash(i * 11 + q) - 0.5) * s, s * 0.11, s * 0.11);
          ctx.fill();
        }
      }
      break;
    }
    case 'warzywnik': {
      // beds of earth with cabbages and carrot tops
      const beds = 4;
      for (let b = 0; b < beds; b++) {
        const by = y + h * (0.12 + b * 0.22);
        rr(ctx, x + w * 0.04, by, w * 0.92, h * 0.15, s * 0.2);
        fs(ctx, '#7a5d3a');
        for (let k = 0; k < 9; k++) {
          const px = x + w * (0.08 + (k / 8) * 0.84), py = by + h * 0.075;
          if ((b + k) % 2) {
            ell(ctx, px, py, s * 0.26, s * 0.22);
            fs(ctx, '#9ccf6a', 1);
            ell(ctx, px, py, s * 0.13, s * 0.11);
            fs(ctx, '#c8e89a');
          } else {
            ctx.fillStyle = g.deco2;
            ell(ctx, px, py + s * 0.08, s * 0.08, s * 0.05);
            ctx.fill();
            ctx.strokeStyle = g.deco;
            ctx.lineWidth = Math.max(1, s * 0.05);
            for (let q = -1; q <= 1; q++) {
              ctx.beginPath();
              ctx.moveTo(px, py + s * 0.05);
              ctx.lineTo(px + q * s * 0.1, py - s * 0.18);
              ctx.stroke();
            }
          }
        }
      }
      break;
    }
    case 'staw': {
      // the pond: ripples, lily pads, reeds at the banks, a little jetty
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      for (let i = 0; i < 16; i++) {
        const px = x + hash(i * 2.3) * w, py = y + hash(i * 6.1) * h;
        ctx.beginPath();
        ctx.ellipse(px, py, s * 0.4, s * 0.1, 0, 0, Math.PI);
        ctx.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const px = x + hash(i * 3.7 + 1) * w, py = y + (0.15 + hash(i * 8.3) * 0.75) * h;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, s * 0.3, 0.3, TAU - 0.3);
        ctx.closePath();
        fs(ctx, g.deco, 1);
        if (i % 3 === 0) {
          ell(ctx, px - s * 0.05, py - s * 0.05, s * 0.1, s * 0.1);
          fs(ctx, '#f7c6d8');
        }
      }
      ctx.fillStyle = '#5f8a3a';
      for (let i = 0; i < 26; i++) {
        const side = i % 2 ? x + s * 0.2 : x + w - s * 0.2;
        const py = y + hash(i * 1.3) * h;
        ctx.fillRect(side + (hash(i) - 0.5) * s * 0.5, py, s * 0.05, s * 0.5);
      }
      break;
    }
    case 'skryptorium': {
      // stone flags, desks with open books, shelves along the sides
      ctx.strokeStyle = 'rgba(90,60,40,.25)';
      ctx.lineWidth = 1;
      for (let r = 0; r < 7; r++) {
        for (let k = 0; k < 7; k++) {
          ctx.strokeRect(x + (k + (r % 2) * 0.5) * (w / 7) - w / 14, y + r * (h / 7), w / 7, h / 7);
        }
      }
      for (let i = 0; i < 6; i++) {
        const px = x + w * (0.15 + (i % 3) * 0.35), py = y + h * (0.28 + Math.floor(i / 3) * 0.38);
        rr(ctx, px - s * 0.6, py - s * 0.3, s * 1.2, s * 0.6, s * 0.08);
        fs(ctx, g.deco, 1.2);
        rr(ctx, px - s * 0.42, py - s * 0.2, s * 0.84, s * 0.38, s * 0.05);
        fs(ctx, g.deco2, 1);
        ctx.strokeStyle = 'rgba(60,40,30,.6)';
        ctx.beginPath();
        ctx.moveTo(px, py - s * 0.2);
        ctx.lineTo(px, py + s * 0.18);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(60,40,30,.35)';
        for (let q = 0; q < 3; q++) {
          ctx.beginPath();
          ctx.moveTo(px - s * 0.35, py - s * 0.1 + q * s * 0.09);
          ctx.lineTo(px - s * 0.06, py - s * 0.1 + q * s * 0.09);
          ctx.moveTo(px + s * 0.06, py - s * 0.1 + q * s * 0.09);
          ctx.lineTo(px + s * 0.35, py - s * 0.1 + q * s * 0.09);
          ctx.stroke();
        }
      }
      break;
    }
  }
  ctx.restore();
}

/** The sky band above the field: the hills, the abbey's roofs and its tower (under the runner's HUD). */
export function paintSky(ctx: CanvasRenderingContext2D, place: PlaceId, x: number, w: number, y1: number, s: number): void {
  const g = GROUND[place];
  const grad = ctx.createLinearGradient(0, 0, 0, y1);
  grad.addColorStop(0, g.sky[1]);
  grad.addColorStop(1, g.sky[0]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, 0, w, y1);
  // far hills
  ctx.fillStyle = '#a9c98a';
  ctx.beginPath();
  ctx.moveTo(x, y1);
  for (let k = 0; k <= 12; k++) ctx.lineTo(x + (k / 12) * w, y1 - s * (0.8 + 0.6 * Math.sin(k * 1.3) + 0.3 * hash(k)));
  ctx.lineTo(x + w, y1);
  ctx.closePath();
  ctx.fill();
  // the abbey on its hill: a church with a tower, the cloister roofs
  const ax = x + w * 0.72, base = y1 - s * 0.2;
  ctx.fillStyle = '#e9d2a8';
  ctx.fillRect(ax - s * 2.4, base - s * 1.1, s * 3.2, s * 1.1);
  ctx.fillStyle = '#c4643c';
  ctx.beginPath();
  ctx.moveTo(ax - s * 2.6, base - s * 1.1);
  ctx.lineTo(ax - s * 0.8, base - s * 1.9);
  ctx.lineTo(ax + s * 1.0, base - s * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#efdcb4';
  ctx.fillRect(ax + s * 0.5, base - s * 2.6, s * 0.8, s * 2.6);
  ctx.fillStyle = '#b8583a';
  ctx.beginPath();
  ctx.moveTo(ax + s * 0.4, base - s * 2.6);
  ctx.lineTo(ax + s * 0.9, base - s * 3.5);
  ctx.lineTo(ax + s * 1.4, base - s * 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(60,40,30,.55)';
  ctx.fillRect(ax + s * 0.78, base - s * 2.25, s * 0.24, s * 0.38);
  ctx.fillRect(ax - s * 1.6, base - s * 0.75, s * 0.25, s * 0.35);
  ctx.fillRect(ax - s * 0.9, base - s * 0.75, s * 0.25, s * 0.35);
  // poplars and a few clouds
  for (let k = 0; k < 4; k++) {
    const px = x + w * (0.08 + k * 0.13);
    ell(ctx, px, y1 - s * 0.9, s * 0.25, s * 0.8);
    fs(ctx, '#6f9a52');
  }
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let k = 0; k < 3; k++) {
    const cx = x + w * (0.2 + k * 0.3), cy = y1 * (0.35 + 0.15 * hash(k));
    ell(ctx, cx, cy, s * 1.1, s * 0.32);
    ctx.fill();
    ell(ctx, cx + s * 0.5, cy - s * 0.15, s * 0.6, s * 0.3);
    ctx.fill();
  }
}

/** The abbey wall the cats sit on: honey stones, a coping, the cushions' shadows. */
export function paintWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number): void {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#f0d49c');
  grad.addColorStop(1, '#c99b5c');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(110,70,30,.35)';
  ctx.lineWidth = 1;
  const bh = Math.max(8, h / 3.2);
  for (let r = 0; y + r * bh < y + h; r++) {
    const by = y + h * 0.22 + r * bh;
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x + w, by);
    ctx.stroke();
    const bw = bh * 2.2;
    for (let k = -1; k * bw < w; k++) {
      const bx = x + k * bw + (r % 2) * bw * 0.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, Math.min(y + h, by + bh));
      ctx.stroke();
    }
  }
  // the coping along the top
  ctx.fillStyle = '#f7e2b4';
  ctx.fillRect(x, y, w, h * 0.22);
  ctx.fillStyle = 'rgba(110,70,30,.25)';
  ctx.fillRect(x, y + h * 0.22 - 2, w, 2);
  // ivy at the ends
  ctx.fillStyle = '#6f9a4a';
  for (let k = 0; k < 10; k++) {
    const side = k < 5 ? x + s * 0.2 * k : x + w - s * 0.2 * (k - 5);
    ell(ctx, side, y + h * (0.3 + hash(k) * 0.6), s * 0.18, s * 0.12, hash(k * 3));
    ctx.fill();
  }
}

/** A cushion on the wall (the squad's slot): an embroidered pillow, empty or under a cat. */
export function paintCushion(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, hue: number, empty: boolean, hot: number): void {
  const c = ['#d9765f', '#6f8fc9', '#7fae6a', '#c98fc0', '#e0a84a', '#6fb6b0'][hue % 6];
  ell(ctx, x, y + size * 0.05, size * 0.5, size * 0.2);
  fs(ctx, c, 1.3);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ell(ctx, x, y + size * 0.05, size * 0.38, size * 0.13);
  ctx.stroke();
  ctx.setLineDash([]);
  if (hot > 0) {
    ctx.strokeStyle = `rgba(255,214,110,${0.5 + 0.5 * hot})`;
    ctx.lineWidth = 3;
    ell(ctx, x, y + size * 0.05, size * 0.58, size * 0.27);
    ctx.stroke();
  }
  if (empty) {
    ctx.fillStyle = 'rgba(59,42,32,.35)';
    ctx.font = font(size * 0.3, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y - size * 0.2);
  }
}

// ── the cats ─────────────────────────────────────────────────────
export interface CatPose {
  /** where it looks (rad, 0 = up the field), how alert (0..1), gold eyes, asleep (0..1) */
  look: number;
  alert: number;
  gold: boolean;
  sleep: number;
  /** a shot's recoil (0..1), purring (0..1), a blink (0..1), the tail's phase, seconds */
  recoil: number;
  purr: number;
  blink: number;
  t: number;
  /** stretched mid-leap (the hunt) */
  leap: number;
}

export const CAT_POSE: CatPose = { look: 0, alert: 0, gold: false, sleep: 0, recoil: 0, purr: 0, blink: 0, t: 0, leap: 0 };

/**
 * A cat sitting on its cushion, facing us, eyes on the field.  (x, y) is where it sits (its feet), `h`
 * its height.  Asleep it curls into a loaf with its tail around it.
 */
export function paintCat(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, spec: CatSpec, p: CatPose): void {
  const c = spec.coat;
  const s = h * spec.size;
  const lw = Math.max(1.1, s * 0.035);
  ctx.save();
  ctx.translate(x, y);
  if (p.sleep > 0.5) {
    // a curled loaf, its tail wrapped round, its eyes shut
    const k = s * 0.95;
    ell(ctx, 0, -k * 0.2, k * 0.42, k * 0.24);
    fs(ctx, c.base, lw);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, k * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -k * 0.16, k * 0.4, 0.2, Math.PI * 0.95);
    ctx.stroke();
    ctx.strokeStyle = c.base;
    ctx.lineWidth = Math.max(1.5, k * 0.07);
    ctx.stroke();
    // the head resting on the paws
    ell(ctx, -k * 0.2, -k * 0.3, k * 0.2, k * 0.17);
    fs(ctx, c.base, lw);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-k * 0.2 + sx * k * 0.15, -k * 0.38);
      ctx.lineTo(-k * 0.2 + sx * k * 0.2, -k * 0.52);
      ctx.lineTo(-k * 0.2 + sx * k * 0.05, -k * 0.44);
      ctx.closePath();
      fs(ctx, c.base, lw);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(-k * 0.2 + sx * k * 0.07, -k * 0.31, k * 0.035, 0, Math.PI);
      ctx.stroke();
    }
    if (c.pattern === 'tabby') {
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = Math.max(1, k * 0.03);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(k * (0.0 + i * 0.1), -k * 0.42);
        ctx.lineTo(k * (0.04 + i * 0.1), -k * 0.28);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }
  const bob = Math.sin(p.t * 2 + spec.size * 9) * s * 0.01 - p.recoil * s * 0.03;
  const lean = p.leap > 0 ? -0.2 : 0;
  ctx.rotate(lean);
  // the tail behind, swaying
  const tw = Math.sin(p.t * (1.6 + p.alert * 2.5) + spec.size * 5) * 0.5;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.11;
  ctx.beginPath();
  ctx.moveTo(s * 0.18, -s * 0.12);
  ctx.quadraticCurveTo(s * (0.52 + tw * 0.1), -s * 0.2, s * (0.42 + tw * 0.2), -s * (0.55 + 0.08 * Math.abs(tw)));
  ctx.stroke();
  ctx.strokeStyle = c.pattern === 'tuxedo' || c.pattern === 'point' ? c.dark : c.base;
  ctx.lineWidth = s * 0.075;
  ctx.stroke();
  // the body: a pear, the chest lighter
  const fluff = c.pattern === 'long' ? 1.08 : 1;
  ctx.beginPath();
  ctx.moveTo(-s * 0.26 * fluff, -s * 0.02);
  ctx.bezierCurveTo(-s * 0.3 * fluff, -s * 0.36 + bob, -s * 0.16, -s * 0.5 + bob, 0, -s * 0.5 + bob);
  ctx.bezierCurveTo(s * 0.16, -s * 0.5 + bob, s * 0.3 * fluff, -s * 0.36 + bob, s * 0.26 * fluff, -s * 0.02);
  ctx.closePath();
  fs(ctx, c.base, lw);
  ell(ctx, 0, -s * 0.2 + bob, s * 0.13, s * 0.19);
  ctx.fillStyle = c.pattern === 'solid' && c.base !== '#2c2a30' ? c.light : c.pattern === 'tuxedo' || c.pattern === 'calico' ? '#ffffff' : c.light;
  ctx.fill();
  if (c.pattern === 'calico') {
    ctx.fillStyle = '#e39a4a';
    ell(ctx, -s * 0.16, -s * 0.3 + bob, s * 0.08, s * 0.1);
    ctx.fill();
    ctx.fillStyle = '#3d3632';
    ell(ctx, s * 0.17, -s * 0.18 + bob, s * 0.07, s * 0.09);
    ctx.fill();
  }
  if (c.pattern === 'tabby') {
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = Math.max(1, s * 0.035);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sx * s * 0.25, -s * (0.16 + i * 0.12) + bob);
        ctx.lineTo(sx * s * 0.15, -s * (0.13 + i * 0.12) + bob);
        ctx.stroke();
      }
    }
  }
  // front paws
  for (const sx of [-1, 1]) {
    ell(ctx, sx * s * 0.1, -s * 0.03, s * 0.075, s * 0.05);
    fs(ctx, c.pattern === 'tuxedo' ? '#ffffff' : c.light, lw * 0.8);
  }
  // the head
  const hy = -s * 0.66 + bob - p.recoil * s * 0.02;
  const hr = s * 0.24;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * hr * 0.92, hy - hr * 0.15);
    ctx.lineTo(sx * hr * (0.95 + p.alert * 0.1), hy - hr * (1.35 + p.alert * 0.15));
    ctx.lineTo(sx * hr * 0.22, hy - hr * 0.85);
    ctx.closePath();
    fs(ctx, c.pattern === 'point' ? c.dark : c.base, lw);
    ctx.beginPath();
    ctx.moveTo(sx * hr * 0.8, hy - hr * 0.35);
    ctx.lineTo(sx * hr * 0.88, hy - hr * 1.12);
    ctx.lineTo(sx * hr * 0.4, hy - hr * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#f2a7a7';
    ctx.fill();
  }
  ell(ctx, 0, hy, hr * 1.08 * (c.pattern === 'long' ? 1.08 : 1), hr * 0.92);
  fs(ctx, c.base, lw);
  if (c.pattern === 'point') {
    ell(ctx, 0, hy + hr * 0.2, hr * 0.62, hr * 0.5);
    ctx.fillStyle = c.dark;
    ctx.fill();
  }
  if (c.pattern === 'tuxedo') {
    ell(ctx, 0, hy + hr * 0.38, hr * 0.5, hr * 0.38);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  if (c.pattern === 'calico') {
    ctx.fillStyle = '#e39a4a';
    ell(ctx, -hr * 0.55, hy - hr * 0.4, hr * 0.38, hr * 0.32, 0.4);
    ctx.fill();
  }
  if (c.pattern === 'tabby') {
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * hr * 0.25, hy - hr * 0.88);
      ctx.lineTo(i * hr * 0.18, hy - hr * 0.5);
      ctx.stroke();
    }
  }
  // the eyes: they look at the field; gold when alert, slits when very alert
  const ex = hr * 0.4, ey = hy - hr * 0.08;
  const lookX = Math.sin(p.look) * hr * 0.1, lookY = -hr * 0.07;
  const open = 1 - p.blink;
  for (const sx of [-1, 1]) {
    if (open < 0.2) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(sx * ex - hr * 0.16, ey);
      ctx.quadraticCurveTo(sx * ex, ey + hr * 0.08, sx * ex + hr * 0.16, ey);
      ctx.stroke();
      continue;
    }
    ell(ctx, sx * ex, ey, hr * 0.22, hr * 0.25 * open);
    fs(ctx, '#ffffff', lw * 0.8);
    const iris = p.gold ? GOLD : c.eye;
    ell(ctx, sx * ex + lookX, ey + lookY * open, hr * 0.17, hr * 0.2 * open);
    ctx.fillStyle = iris;
    ctx.fill();
    if (p.gold) {
      ctx.fillStyle = 'rgba(255,240,180,.55)';
      ell(ctx, sx * ex + lookX - hr * 0.05, ey + lookY - hr * 0.06, hr * 0.06, hr * 0.06);
      ctx.fill();
    }
    const pw = hr * (0.12 - p.alert * 0.085);
    ell(ctx, sx * ex + lookX, ey + lookY * open, Math.max(hr * 0.025, pw), hr * 0.17 * open);
    ctx.fillStyle = '#1d1410';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ell(ctx, sx * ex + lookX - hr * 0.06, ey + lookY - hr * 0.08, hr * 0.045, hr * 0.045);
    ctx.fill();
  }
  // nose, mouth, whiskers
  ctx.beginPath();
  ctx.moveTo(-hr * 0.08, hy + hr * 0.22);
  ctx.lineTo(hr * 0.08, hy + hr * 0.22);
  ctx.lineTo(0, hy + hr * 0.32);
  ctx.closePath();
  fs(ctx, '#e88a9a');
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(-hr * 0.14, hy + hr * 0.42);
  ctx.quadraticCurveTo(-hr * 0.07, hy + hr * 0.5, 0, hy + hr * 0.36);
  ctx.quadraticCurveTo(hr * 0.07, hy + hr * 0.5, hr * 0.14, hy + hr * 0.42);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(59,42,32,.55)';
  ctx.lineWidth = Math.max(0.8, lw * 0.5);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(sx * hr * 0.3, hy + hr * (0.3 + i * 0.1));
      ctx.lineTo(sx * hr * 0.95, hy + hr * (0.2 + i * 0.22));
      ctx.stroke();
    }
  }
  if (p.purr > 0) {
    // little hearts while it purrs
    for (let i = 0; i < 2; i++) {
      const k = (p.t * 0.8 + i * 0.5) % 1;
      heart(ctx, (i ? 1 : -1) * hr * 0.9, hy - hr * (1.2 + k * 1.6), hr * 0.22 * (1 - k * 0.4), `rgba(240,110,140,${(1 - k) * p.purr})`);
    }
  }
  ctx.restore();
}

export function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  ctx.fillStyle = color;
  ctx.fill();
}

// ── the toys ─────────────────────────────────────────────────────
/** A toy's icon (its family's shape in its grade's colour), pointing up-right by default (`a` turns it). */
export function paintToy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fam: FamId, g: number, a = -0.6): void {
  const col = gradeColor(g);
  const lw = Math.max(1, size * 0.06);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  const s = size;
  switch (fam) {
    case 'proca': {
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.4);
      ctx.lineTo(0, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(-s * 0.22, -s * 0.35);
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.22, -s * 0.35);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = s * 0.1;
      ctx.stroke();
      ctx.strokeStyle = '#f4e6c8';
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, -s * 0.35);
      ctx.quadraticCurveTo(0, -s * 0.15, s * 0.22, -s * 0.35);
      ctx.stroke();
      ell(ctx, 0, -s * 0.22, s * 0.07, s * 0.07);
      fs(ctx, '#8ccf5a', lw * 0.6);
      break;
    }
    case 'dmuchawka': {
      rr(ctx, -s * 0.09, -s * 0.45, s * 0.18, s * 0.85, s * 0.08);
      fs(ctx, col, lw);
      rr(ctx, -s * 0.13, -s * 0.48, s * 0.26, s * 0.1, s * 0.04);
      fs(ctx, '#f4e6c8', lw);
      for (let i = 0; i < 3; i++) {
        ell(ctx, 0, -s * (0.62 + i * 0.13), s * 0.05, s * 0.05);
        fs(ctx, '#8ccf5a');
      }
      break;
    }
    case 'konewka': {
      rr(ctx, -s * 0.24, -s * 0.12, s * 0.4, s * 0.42, s * 0.08);
      fs(ctx, col, lw);
      ctx.beginPath();
      ctx.moveTo(s * 0.12, -s * 0.02);
      ctx.lineTo(s * 0.4, -s * 0.38);
      ctx.lineTo(s * 0.46, -s * 0.32);
      ctx.lineTo(s * 0.16, s * 0.06);
      ctx.closePath();
      fs(ctx, col, lw);
      ell(ctx, s * 0.44, -s * 0.38, s * 0.07, s * 0.05, -0.8);
      fs(ctx, '#f4e6c8', lw);
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(-s * 0.05, -s * 0.12, s * 0.16, Math.PI, 0);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ell(ctx, s * (0.5 + i * 0.06), -s * (0.48 + i * 0.07), s * 0.03, s * 0.04);
        fs(ctx, '#8fd0ff');
      }
      break;
    }
    case 'sikawka': {
      rr(ctx, -s * 0.3, -s * 0.12, s * 0.5, s * 0.22, s * 0.1);
      fs(ctx, col, lw);
      rr(ctx, -s * 0.12, -s * 0.0, s * 0.14, s * 0.32, s * 0.05);
      fs(ctx, col, lw);
      rr(ctx, s * 0.18, -s * 0.07, s * 0.2, s * 0.1, s * 0.04);
      fs(ctx, '#f4e6c8', lw);
      ell(ctx, -s * 0.18, -s * 0.2, s * 0.1, s * 0.07);
      fs(ctx, '#8fd0ff', lw);
      ctx.strokeStyle = '#8fd0ff';
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(s * 0.4, -s * 0.02);
      ctx.lineTo(s * 0.6, -s * 0.02);
      ctx.stroke();
      break;
    }
    case 'klebek': {
      rr(ctx, -s * 0.2, -s * 0.05, s * 0.4, s * 0.38, s * 0.1);
      fs(ctx, col, lw);
      ell(ctx, 0, -s * 0.22, s * 0.2, s * 0.2);
      fs(ctx, '#e8708a', lw);
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, -s * 0.22, s * (0.06 + i * 0.05), 0.3 + i, 2.4 + i);
        ctx.stroke();
      }
      break;
    }
    case 'banki': {
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.42);
      ctx.lineTo(0, -s * 0.05);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = s * 0.06;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -s * 0.22, s * 0.17, 0, TAU);
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.09;
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = s * 0.05;
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(s * (0.18 + i * 0.12), -s * (0.45 + i * 0.1), s * (0.1 - i * 0.02), 0, TAU);
        ctx.fillStyle = 'rgba(200,235,255,.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,180,230,.9)';
        ctx.lineWidth = Math.max(1, s * 0.025);
        ctx.stroke();
      }
      break;
    }
    case 'lusterko': {
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.42);
      ctx.lineTo(0, s * 0.06);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = s * 0.07;
      ctx.stroke();
      ell(ctx, 0, -s * 0.16, s * 0.24, s * 0.26);
      fs(ctx, col, lw);
      ell(ctx, 0, -s * 0.16, s * 0.17, s * 0.19);
      const gl = ctx.createLinearGradient(-s * 0.15, -s * 0.35, s * 0.15, 0);
      gl.addColorStop(0, '#ffffff');
      gl.addColorStop(1, '#bfe6ff');
      ctx.fillStyle = gl;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, -s * 0.28);
      ctx.lineTo(s * 0.04, -s * 0.06);
      ctx.stroke();
      break;
    }
    case 'katapulta': {
      rr(ctx, -s * 0.3, s * 0.12, s * 0.6, s * 0.16, s * 0.05);
      fs(ctx, col, lw);
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, s * 0.14);
      ctx.lineTo(s * 0.2, -s * 0.3);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = s * 0.06;
      ctx.stroke();
      ell(ctx, s * 0.24, -s * 0.36, s * 0.13, s * 0.12);
      fs(ctx, '#e5533d', lw);
      ctx.fillStyle = '#5c9a45';
      ell(ctx, s * 0.28, -s * 0.5, s * 0.06, s * 0.03, -0.5);
      ctx.fill();
      for (const sx of [-1, 1]) {
        ell(ctx, sx * s * 0.2, s * 0.3, s * 0.07, s * 0.07);
        fs(ctx, '#8a6440', lw * 0.8);
      }
      break;
    }
  }
  ctx.restore();
}

/** The smallest grade badge (its number at 11.5 px). */
export const BADGE_MIN = 10;

/** The grade's badge: a coin in the grade's colour with its number. */
export function paintBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r0: number, g: number): void {
  // never smaller than its number at MIN_TEXT (the grade is what the player matches to merge)
  const r = Math.max(r0, BADGE_MIN);
  ell(ctx, x, y, r, r);
  fs(ctx, gradeColor(g), Math.max(1, r * 0.18));
  if (g >= 6) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ell(ctx, x, y, r * 0.7, r * 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = g === 5 || g === 7 || g === 12 ? INK : g >= 9 ? '#ffffff' : INK;
  ctx.font = font(r * 1.15, 900);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(g), x, y + r * 0.05);
}

/** A toy in a cell: the wooden tray, the toy, its badge. */
export function paintToyCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, toy: Toy | null, glowK: number, dim: boolean): void {
  rr(ctx, x, y, size, size, size * 0.18);
  ctx.fillStyle = dim ? 'rgba(80,52,30,.55)' : 'rgba(110,72,40,.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,180,.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (glowK > 0) {
    ctx.strokeStyle = `rgba(255,214,110,${glowK})`;
    ctx.lineWidth = 3;
    rr(ctx, x - 2, y - 2, size + 4, size + 4, size * 0.2);
    ctx.stroke();
  }
  if (!toy) return;
  paintToy(ctx, x + size * 0.5, y + size * 0.56, size * 0.6, toy.fam, toy.g);
  const br = Math.max(BADGE_MIN, size * 0.17);
  paintBadge(ctx, x + br + 3, y + br + 3, br, toy.g);
}

// ── the pests ────────────────────────────────────────────────────
export interface PestPose {
  dir: number;
  t: number;
  /** flinching (0..1), bolting (true), dozing (0..1), standing stiff (true), golden (true), moving (0..1) */
  hit: number;
  flee: boolean;
  doze: number;
  frozen: boolean;
  elite: boolean;
  move: number;
  seed: number;
}

interface PestLook { body: string; belly: string; dark: string; ear?: string }
const LOOK: Readonly<Record<PestId, PestLook>> = {
  liszka: { body: '#e8823a', belly: '#fff3e4', dark: '#5a3624', ear: '#3b2a20' },
  wrobel: { body: '#a87a52', belly: '#efe0c8', dark: '#5e4430' },
  mysz: { body: '#a9a2a0', belly: '#e8e0dc', dark: '#6d6563', ear: '#f2b8c0' },
  szczur: { body: '#8a7a6c', belly: '#d9cdbf', dark: '#4e443b', ear: '#e8a8b0' },
  szpak: { body: '#3e4a5e', belly: '#6f7f98', dark: '#1e2430' },
  wrona: { body: '#2e2f3a', belly: '#5a5c6c', dark: '#14141a' },
  slimak: { body: '#e6d3a8', belly: '#c79f62', dark: '#7a5432' },
  zajac: { body: '#b8936c', belly: '#f2e6d4', dark: '#6a4e36', ear: '#f0b4b0' },
  kormoran: { body: '#2f3436', belly: '#d9d2c2', dark: '#121414' },
  wydra: { body: '#7a5638', belly: '#d8bfa0', dark: '#3e2a1c' },
  rybik: { body: '#c9d2dc', belly: '#eef2f6', dark: '#7d8a98' },
  mol: { body: '#d8c8a8', belly: '#efe4cc', dark: '#8c7a5a' },
  kolatek: { body: '#6b4630', belly: '#8e6446', dark: '#2e1c12' },
};

function pestEyes(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, gap: number, p: PestPose): void {
  for (const sx of [-1, 1]) {
    const ex = x + sx * gap;
    if (p.hit > 0.3 || p.flee) {
      // squeezed shut: > <
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, r * 0.45);
      ctx.beginPath();
      ctx.moveTo(ex - r * sx, y - r * 0.8);
      ctx.lineTo(ex + r * 0.6 * sx, y);
      ctx.lineTo(ex - r * sx, y + r * 0.8);
      ctx.stroke();
    } else if (p.doze > 0.5) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, r * 0.4);
      ctx.beginPath();
      ctx.arc(ex, y, r * 0.8, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else {
      ell(ctx, ex, y, r, r * 1.1);
      fs(ctx, '#ffffff', Math.max(0.8, r * 0.3));
      ell(ctx, ex + p.dir * r * 0.25, y + r * 0.1, r * 0.6, r * 0.7);
      ctx.fillStyle = '#1d1410';
      ctx.fill();
      ell(ctx, ex + p.dir * r * 0.05, y - r * 0.25, r * 0.25, r * 0.25);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
}

/** A pest at (x, y) (its feet or its centre for fliers), `s` its size in px. */
export function paintPest(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: PestId, p: PestPose): void {
  const L = LOOK[kind];
  const lw = Math.max(1, s * 0.05);
  ctx.save();
  ctx.translate(x + (p.hit > 0 ? Math.sin(p.t * 90) * s * 0.06 * p.hit : 0), y);
  if (p.elite) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -s * 0.3, s * 0.9, 'rgba(255,214,110,', 0.55);
    ctx.restore();
  }
  ctx.scale(p.dir < 0 ? -1 : 1, 1);
  // nibbling the goods: a little bob of the whole body
  if (p.move < 0.3 && p.doze < 0.5 && !p.flee) ctx.translate(0, -Math.abs(Math.sin(p.t * 9 + p.seed)) * s * 0.04);
  const step = Math.sin(p.t * 12 + p.seed) * p.move;
  const body = p.elite ? '#ffd166' : L.body;
  switch (kind) {
    case 'liszka':
    case 'zajac':
    case 'szczur':
    case 'mysz':
    case 'wydra': {
      const long = kind === 'wydra' ? 1.35 : kind === 'szczur' ? 1.15 : 1;
      const small = kind === 'mysz' ? 0.8 : 1;
      // tail
      ctx.strokeStyle = kind === 'mysz' || kind === 'szczur' ? '#e8a8b0' : INK;
      ctx.lineCap = 'round';
      ctx.lineWidth = kind === 'liszka' ? s * 0.2 : s * 0.07;
      ctx.beginPath();
      ctx.moveTo(-s * 0.3 * long, -s * 0.25);
      ctx.quadraticCurveTo(-s * 0.65 * long, -s * (0.3 + 0.1 * step), -s * 0.7 * long, -s * (0.6 + 0.05 * step));
      ctx.stroke();
      if (kind === 'liszka') {
        ctx.strokeStyle = body;
        ctx.lineWidth = s * 0.14;
        ctx.stroke();
        ell(ctx, -s * 0.7, -s * 0.62, s * 0.08, s * 0.08);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      // body
      ell(ctx, 0, -s * 0.28 * small, s * 0.36 * long * small, s * 0.24 * small);
      fs(ctx, body, lw);
      ell(ctx, s * 0.08, -s * 0.22 * small, s * 0.18 * small, s * 0.13 * small);
      ctx.fillStyle = L.belly;
      ctx.fill();
      // legs
      ctx.fillStyle = L.dark;
      for (const k of [-1, 1]) {
        ell(ctx, k * s * 0.18 * long + step * s * 0.05 * k, -s * 0.06, s * 0.06, s * 0.08);
        ctx.fill();
      }
      // head
      const hx = s * 0.36 * long * small, hy = -s * 0.42 * small;
      const ear = kind === 'zajac' ? 2.2 : kind === 'mysz' || kind === 'szczur' ? 1 : 1.2;
      for (const k of [-1, 1]) {
        if (kind === 'mysz' || kind === 'szczur') {
          ell(ctx, hx + k * s * 0.1, hy - s * 0.17, s * 0.11 * small, s * 0.11 * small);
          fs(ctx, L.ear!, lw);
        } else {
          ctx.beginPath();
          ctx.moveTo(hx + k * s * 0.05 - s * 0.06, hy - s * 0.1);
          ctx.lineTo(hx + k * s * 0.1, hy - s * 0.18 * ear - s * 0.12);
          ctx.lineTo(hx + k * s * 0.05 + s * 0.08, hy - s * 0.08);
          ctx.closePath();
          fs(ctx, body, lw);
        }
      }
      ell(ctx, hx, hy, s * 0.2 * small, s * 0.17 * small);
      fs(ctx, body, lw);
      if (kind === 'liszka') {
        ctx.beginPath();
        ctx.moveTo(hx + s * 0.02, hy + s * 0.02);
        ctx.lineTo(hx + s * 0.3, hy + s * 0.06);
        ctx.lineTo(hx + s * 0.04, hy + s * 0.14);
        ctx.closePath();
        fs(ctx, L.belly, lw * 0.8);
      }
      ell(ctx, hx + s * 0.22 * small, hy + s * 0.04, s * 0.04, s * 0.035);
      ctx.fillStyle = INK;
      ctx.fill();
      pestEyes(ctx, hx + s * 0.04, hy - s * 0.02, s * 0.05 * small + 0.6, s * 0.075 * small, p);
      break;
    }
    case 'wrobel':
    case 'szpak':
    case 'wrona':
    case 'kormoran': {
      const big = kind === 'wrona' || kind === 'kormoran' ? 1.25 : 1;
      const flap = p.move > 0.3 ? Math.sin(p.t * 22 + p.seed) : 0.3;
      // wings
      ctx.fillStyle = L.dark;
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, -s * 0.35 * big);
      ctx.quadraticCurveTo(-s * 0.45 * big, -s * (0.5 + 0.35 * flap) * big, -s * 0.5 * big, -s * (0.2 + 0.4 * flap) * big);
      ctx.quadraticCurveTo(-s * 0.25, -s * 0.22 * big, -s * 0.05, -s * 0.25 * big);
      ctx.fill();
      ell(ctx, 0, -s * 0.3 * big, s * 0.27 * big, s * 0.22 * big);
      fs(ctx, body, lw);
      ell(ctx, s * 0.05, -s * 0.24 * big, s * 0.14 * big, s * 0.12 * big);
      ctx.fillStyle = kind === 'szpak' ? 'rgba(255,255,255,.25)' : L.belly;
      ctx.fill();
      if (kind === 'szpak') {
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        for (let i = 0; i < 5; i++) {
          ell(ctx, (hash(i) - 0.5) * s * 0.3, -s * (0.2 + hash(i * 2) * 0.2), s * 0.025, s * 0.025);
          ctx.fill();
        }
      }
      const hx = s * 0.22 * big, hy = -s * (kind === 'kormoran' ? 0.62 : 0.46) * big;
      if (kind === 'kormoran') {
        ctx.strokeStyle = body;
        ctx.lineWidth = s * 0.12;
        ctx.beginPath();
        ctx.moveTo(s * 0.1, -s * 0.4);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }
      ell(ctx, hx, hy, s * 0.15 * big, s * 0.14 * big);
      fs(ctx, body, lw);
      ctx.beginPath();
      ctx.moveTo(hx + s * 0.12 * big, hy - s * 0.03);
      ctx.lineTo(hx + s * (kind === 'kormoran' ? 0.36 : 0.28) * big, hy + s * 0.02);
      ctx.lineTo(hx + s * 0.12 * big, hy + s * 0.06);
      ctx.closePath();
      fs(ctx, kind === 'wrona' || kind === 'kormoran' ? '#e8c36a' : '#f0b04a', lw * 0.7);
      pestEyes(ctx, hx + s * 0.02, hy - s * 0.02, s * 0.04 * big + 0.6, s * 0.06 * big, p);
      if (p.move < 0.3) {
        ctx.strokeStyle = '#e09a4a';
        ctx.lineWidth = Math.max(1, s * 0.035);
        for (const k of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(k * s * 0.07, -s * 0.1);
          ctx.lineTo(k * s * 0.08, 0);
          ctx.stroke();
        }
      }
      break;
    }
    case 'slimak':
    case 'kolatek': {
      if (kind === 'slimak') {
        ctx.beginPath();
        ctx.moveTo(-s * 0.42, -s * 0.02);
        ctx.quadraticCurveTo(0, -s * 0.12, s * 0.45, -s * 0.05);
        ctx.quadraticCurveTo(s * 0.5, -s * 0.22, s * 0.32, -s * 0.24);
        ctx.lineTo(-s * 0.3, -s * 0.12);
        ctx.closePath();
        fs(ctx, body, lw);
        for (const k of [0, 1]) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = Math.max(1, s * 0.03);
          ctx.beginPath();
          ctx.moveTo(s * (0.34 + k * 0.08), -s * 0.22);
          ctx.lineTo(s * (0.38 + k * 0.12), -s * 0.42);
          ctx.stroke();
        }
        pestEyes(ctx, s * 0.44, -s * 0.44, s * 0.045 + 0.6, s * 0.06, p);
        ell(ctx, -s * 0.06, -s * 0.32, s * 0.27, s * 0.26);
        fs(ctx, p.elite ? '#ffd166' : L.belly, lw);
        ctx.strokeStyle = L.dark;
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.beginPath();
        for (let a = 0; a < 9; a += 0.3) {
          const r = s * 0.02 * a;
          const px = -s * 0.06 + Math.cos(a) * r, py = -s * 0.32 + Math.sin(a) * r;
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        ell(ctx, 0, -s * 0.2, s * 0.26, s * 0.2);
        fs(ctx, body, lw);
        ctx.strokeStyle = L.dark;
        ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath();
        ctx.moveTo(-s * 0.02, -s * 0.38);
        ctx.lineTo(-s * 0.02, -s * 0.02);
        ctx.stroke();
        ell(ctx, s * 0.26, -s * 0.2, s * 0.1, s * 0.09);
        fs(ctx, L.dark, lw);
        for (const k of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 0.32, -s * 0.2 + k * s * 0.05);
          ctx.lineTo(s * 0.46, -s * 0.2 + k * s * 0.14);
          ctx.stroke();
        }
        pestEyes(ctx, s * 0.29, -s * 0.22, s * 0.03 + 0.5, s * 0.04, p);
        ctx.strokeStyle = INK;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * s * 0.12, -s * 0.05);
          ctx.lineTo(i * s * 0.16 + step * s * 0.04, s * 0.02);
          ctx.stroke();
        }
      }
      break;
    }
    case 'rybik':
    case 'mol': {
      if (kind === 'rybik') {
        ctx.beginPath();
        ctx.moveTo(s * 0.3, -s * 0.15);
        ctx.quadraticCurveTo(0, -s * 0.32, -s * 0.32, -s * 0.15);
        ctx.quadraticCurveTo(0, -s * 0.02, s * 0.3, -s * 0.15);
        fs(ctx, body, lw);
        ctx.strokeStyle = L.dark;
        ctx.lineWidth = Math.max(0.8, s * 0.025);
        for (const k of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 0.3, -s * 0.15);
          ctx.lineTo(s * 0.5, -s * 0.15 + k * s * 0.12);
          ctx.moveTo(-s * 0.32, -s * 0.15);
          ctx.lineTo(-s * 0.5, -s * 0.15 + k * s * 0.08);
          ctx.stroke();
        }
        pestEyes(ctx, s * 0.2, -s * 0.18, s * 0.035 + 0.5, s * 0.04, p);
      } else {
        // a moth: soft wings spread to both sides (they beat), a fuzzy body, feathery antennae
        const flap = 0.55 + 0.45 * Math.abs(Math.sin(p.t * 20 + p.seed));
        const wing = p.elite ? '#ffe08a' : L.belly;
        for (const k of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.32);
          ctx.quadraticCurveTo(k * s * 0.5, -s * (0.32 + 0.42 * flap), k * s * 0.46, -s * 0.24);
          ctx.quadraticCurveTo(k * s * 0.3, -s * 0.16, 0, -s * 0.26);
          ctx.closePath();
          fs(ctx, wing, lw * 0.8);
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.26);
          ctx.quadraticCurveTo(k * s * 0.34, -s * 0.2, k * s * 0.24, -s * (0.06 + 0.06 * (1 - flap)));
          ctx.quadraticCurveTo(k * s * 0.08, -s * 0.12, 0, -s * 0.22);
          ctx.closePath();
          fs(ctx, L.body, lw * 0.8);
          ctx.fillStyle = 'rgba(140,110,70,.45)';
          ell(ctx, k * s * 0.3, -s * (0.3 + 0.12 * flap), s * 0.05, s * 0.05);
          ctx.fill();
        }
        ell(ctx, 0, -s * 0.24, s * 0.08, s * 0.16);
        fs(ctx, L.body, lw);
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(0.8, s * 0.025);
        for (const k of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(k * s * 0.03, -s * 0.38);
          ctx.quadraticCurveTo(k * s * 0.1, -s * 0.5, k * s * 0.16, -s * 0.52);
          ctx.stroke();
        }
        pestEyes(ctx, 0, -s * 0.36, s * 0.035 + 0.5, s * 0.05, p);
      }
      break;
    }
  }
  if (p.flee) {
    ctx.scale(p.dir < 0 ? -1 : 1, 1);
    label(ctx, '!', 0, -s * 1.05, s * 0.55, '#fff3b0');
  }
  if (p.doze > 0.5 && !p.flee) {
    ctx.scale(p.dir < 0 ? -1 : 1, 1);
    const k = (p.t * 0.6 + p.seed) % 1;
    ctx.globalAlpha = 1 - k;
    label(ctx, 'z', s * 0.3, -s * (0.8 + k * 0.6), s * (0.3 + k * 0.15), '#e8f2ff', 'center', 900);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ── the chiefs ───────────────────────────────────────────────────
export interface BossPose { dir: number; t: number; hit: number; tele: number; trick: number; doze: number; flee: boolean; air: number }

/** A chief: a big pest with what makes it a chief.  (x, y) its feet, `s` its size. */
export function paintBoss(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, id: BossId, p: BossPose): void {
  const pp: PestPose = { dir: p.dir, t: p.t, hit: p.hit, flee: p.flee, doze: p.doze, frozen: false, elite: false, move: 0.4, seed: 3 };
  ctx.save();
  // the telegraph: a wobble and a ring before the trick
  if (p.tele > 0) {
    ctx.strokeStyle = `rgba(255,120,90,${0.4 + 0.4 * Math.sin(p.t * 20)})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ell(ctx, x, y - s * 0.05, s * (0.7 + 0.2 * p.tele), s * 0.25);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = 'rgba(40,30,20,.22)';
  ell(ctx, x, y, s * 0.55, s * 0.13);
  ctx.fill();
  const lift = p.air * s * 0.9;
  const kind: PestId = id === 'lis' ? 'liszka' : id === 'krol' ? 'szczur' : id === 'hrabina' ? 'wrona' : id === 'kret' ? 'wydra' : id === 'czapla' ? 'kormoran' : 'mol';
  if (id === 'kret' && p.trick > 0) {
    // under the ground: only a moving mound
    ell(ctx, x, y - s * 0.08, s * 0.5, s * 0.22);
    fs(ctx, '#7a5d3a', 2);
    ctx.restore();
    return;
  }
  if (id === 'kret') {
    // the great mole: velvet, pink hands, little spectacles
    ell(ctx, x, y - s * 0.38, s * 0.5, s * 0.4);
    fs(ctx, '#3e3640', Math.max(1, s * 0.03));
    for (const k of [-1, 1]) {
      ell(ctx, x + k * s * 0.42, y - s * 0.22, s * 0.16, s * 0.1, k * 0.5);
      fs(ctx, '#f2a8b8', 1.5);
    }
    ell(ctx, x + p.dir * s * 0.05, y - s * 0.52, s * 0.08, s * 0.06);
    fs(ctx, '#f2a8b8', 1.5);
    pestEyes(ctx, x, y - s * 0.62, s * 0.035 + 1, s * 0.1, pp);
    ctx.strokeStyle = '#d9b44a';
    ctx.lineWidth = 2;
    for (const k of [-1, 1]) {
      ell(ctx, x + k * s * 0.1, y - s * 0.62, s * 0.08, s * 0.08);
      ctx.stroke();
    }
  } else if (id === 'czapla') {
    // the grey heron: long legs, a long neck, a stately walk
    ctx.strokeStyle = '#c9a24f';
    ctx.lineWidth = Math.max(2, s * 0.04);
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + k * s * 0.08, y);
      ctx.lineTo(x + k * s * 0.06, y - s * 0.45 + lift * 0);
      ctx.stroke();
    }
    ell(ctx, x, y - s * 0.62 - lift, s * 0.32, s * 0.2);
    fs(ctx, '#aeb6bf', Math.max(1, s * 0.03));
    ctx.strokeStyle = '#aeb6bf';
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(x + p.dir * s * 0.2, y - s * 0.7 - lift);
    ctx.quadraticCurveTo(x + p.dir * s * 0.45, y - s * 0.95 - lift, x + p.dir * s * 0.3, y - s * 1.12 - lift);
    ctx.stroke();
    ell(ctx, x + p.dir * s * 0.3, y - s * 1.15 - lift, s * 0.1, s * 0.08);
    fs(ctx, '#dfe4ea', 1.5);
    ctx.beginPath();
    ctx.moveTo(x + p.dir * s * 0.38, y - s * 1.17 - lift);
    ctx.lineTo(x + p.dir * s * 0.68, y - s * 1.12 - lift);
    ctx.lineTo(x + p.dir * s * 0.38, y - s * 1.1 - lift);
    ctx.closePath();
    fs(ctx, '#e8c36a', 1.2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + p.dir * s * 0.24, y - s * 1.2 - lift);
    ctx.lineTo(x + p.dir * s * 0.02, y - s * 1.24 - lift);
    ctx.stroke();
    pestEyes(ctx, x + p.dir * s * 0.32, y - s * 1.17 - lift, s * 0.025 + 1, 0.1, pp);
    if (p.trick > 0) {
      // the gust: wings spread wide
      ctx.fillStyle = 'rgba(174,182,191,.9)';
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.65);
        ctx.quadraticCurveTo(x + k * s * 0.8, y - s * 1.1, x + k * s * 1.1, y - s * 0.55);
        ctx.quadraticCurveTo(x + k * s * 0.5, y - s * 0.6, x, y - s * 0.55);
        ctx.fill();
      }
    }
  } else {
    paintPest(ctx, x, y - lift, s, kind, { ...pp, move: id === 'ksiazkowy' ? 0.8 : 0.4 });
    ctx.save();
    ctx.translate(x, y - lift);
    ctx.scale(p.dir < 0 ? -1 : 1, 1);
    if (id === 'lis') {
      // the old fox: a grey muzzle and a green scarf
      ctx.strokeStyle = '#4f8a5a';
      ctx.lineWidth = s * 0.08;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s * 0.18, -s * 0.34);
      ctx.quadraticCurveTo(s * 0.32, -s * 0.24, s * 0.45, -s * 0.33);
      ctx.moveTo(s * 0.3, -s * 0.28);
      ctx.lineTo(s * 0.22, -s * 0.12);
      ctx.stroke();
      ell(ctx, s * 0.55, -s * 0.38, s * 0.06, s * 0.04);
      ctx.fillStyle = '#d8d0c8';
      ctx.fill();
    } else if (id === 'krol') {
      // the rat king's crown of straw
      ctx.fillStyle = '#f0cf5a';
      ctx.beginPath();
      const cx = s * 0.42, cy = -s * 0.62;
      ctx.moveTo(cx - s * 0.16, cy + s * 0.06);
      for (let i = 0; i <= 4; i++) ctx.lineTo(cx - s * 0.16 + i * s * 0.08, cy - (i % 2 ? s * 0.02 : s * 0.14));
      ctx.lineTo(cx + s * 0.16, cy + s * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (id === 'hrabina') {
      // the countess's pearls and her plumed hat
      ctx.fillStyle = '#f6f0e4';
      for (let i = 0; i < 5; i++) {
        ell(ctx, s * (0.2 + i * 0.045), -s * (0.42 - Math.abs(i - 2) * 0.02), s * 0.03, s * 0.03);
        ctx.fill();
      }
      ell(ctx, s * 0.28, -s * 0.78, s * 0.18, s * 0.05);
      fs(ctx, '#7a3a6a', 1.5);
      ctx.strokeStyle = '#e8708a';
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(s * 0.2, -s * 0.8);
      ctx.quadraticCurveTo(s * 0.05, -s * 1.05, -s * 0.12, -s * 0.95);
      ctx.stroke();
    } else if (id === 'ksiazkowy') {
      // the bookworm: big round spectacles over its eyes and an open book held to its chest
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 2;
      for (const k of [-1, 1]) {
        ell(ctx, k * s * 0.055, -s * 0.36, s * 0.05, s * 0.05);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-s * 0.005, -s * 0.36);
      ctx.lineTo(s * 0.005, -s * 0.36);
      ctx.stroke();
      rr(ctx, -s * 0.13, -s * 0.2, s * 0.26, s * 0.15, 2);
      fs(ctx, '#8a3a2a', 1.5);
      ctx.fillStyle = '#efe0bc';
      ctx.fillRect(-s * 0.11, -s * 0.185, s * 0.1, s * 0.12);
      ctx.fillRect(s * 0.01, -s * 0.185, s * 0.1, s * 0.12);
    }
    ctx.restore();
    if (id === 'ksiazkowy' && p.trick > 0) {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(230,215,180,${0.55 - i * 0.06})`;
        ell(ctx, x + Math.cos(p.t * 2 + i) * s * 0.5, y - s * 0.4 + Math.sin(p.t * 3 + i) * s * 0.3, s * 0.35, s * 0.25);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// ── Brother Anselm ───────────────────────────────────────────────
/** Brother Anselm's round portrait: a kind old face, a tonsure, a brown habit, a wooden spoon. */
export function paintBrother(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, talk: boolean, t: number): void {
  ctx.save();
  ell(ctx, x, y, r, r);
  fs(ctx, '#f6e7c8', Math.max(1.5, r * 0.08));
  ctx.clip();
  // the habit
  ell(ctx, x, y + r * 1.05, r * 0.95, r * 0.7);
  fs(ctx, '#7a5236');
  ell(ctx, x, y + r * 0.42, r * 0.42, r * 0.2);
  fs(ctx, '#5e3f28');
  // the face
  ell(ctx, x, y + r * 0.02, r * 0.5, r * 0.55);
  fs(ctx, '#f2c9a0', Math.max(1, r * 0.06));
  // the tonsure: a crown of white hair
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.08, r * 0.5, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // eyebrows, smiling eyes, rosy cheeks, the mouth
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + k * r * 0.18, y - r * 0.02, r * 0.08, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(232,120,110,.35)';
    ell(ctx, x + k * r * 0.3, y + r * 0.16, r * 0.1, r * 0.07);
    ctx.fill();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, r * 0.08);
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + k * r * 0.1, y - r * 0.16);
    ctx.lineTo(x + k * r * 0.3, y - r * 0.2);
    ctx.stroke();
  }
  ctx.fillStyle = '#9a4a3a';
  const m = talk ? 0.06 + 0.05 * Math.abs(Math.sin(t * 14)) : 0.03;
  ell(ctx, x, y + r * 0.28, r * 0.1, r * m);
  ctx.fill();
  ctx.restore();
  // the soup spoon over his shoulder
  ctx.strokeStyle = '#b98a5a';
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + r * 0.75, y + r * 0.9);
  ctx.lineTo(x + r * 1.1, y - r * 0.2);
  ctx.stroke();
  ell(ctx, x + r * 1.13, y - r * 0.32, r * 0.16, r * 0.22, 0.3);
  fs(ctx, '#c99a64', 1.2);
}

// ── icons ────────────────────────────────────────────────────────
/** A little fish (the currency), gold for the vintage's golden fish. */
export function paintFish(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, gold = false): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.quadraticCurveTo(x + r * 0.1, y - r * 0.75, x - r * 0.55, y);
  ctx.quadraticCurveTo(x + r * 0.1, y + r * 0.75, x + r, y);
  ctx.closePath();
  fs(ctx, gold ? GOLD : '#8fc8e8', Math.max(1, r * 0.14));
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y);
  ctx.lineTo(x - r * 1.0, y - r * 0.45);
  ctx.lineTo(x - r * 1.0, y + r * 0.45);
  ctx.closePath();
  fs(ctx, gold ? '#f0a92e' : '#5fa6d0', Math.max(1, r * 0.14));
  ell(ctx, x + r * 0.5, y - r * 0.1, r * 0.09, r * 0.09);
  ctx.fillStyle = INK;
  ctx.fill();
}

/** A paw print. */
export function paintPaw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ell(ctx, x, y + r * 0.25, r * 0.5, r * 0.42);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i - 1.5) * 0.55;
    ell(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.17, r * 0.21, a + Math.PI / 2);
    ctx.fill();
  }
}

/** A bunch of grapes (the vintage). */
export function paintGrapes(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#6f9a4a';
  ell(ctx, x + r * 0.25, y - r * 0.95, r * 0.35, r * 0.18, -0.4);
  ctx.fill();
  const rows = [3, 3, 2, 1];
  rows.forEach((n, j) => {
    for (let i = 0; i < n; i++) {
      ell(ctx, x + (i - (n - 1) / 2) * r * 0.42, y - r * 0.55 + j * r * 0.36, r * 0.22, r * 0.22);
      fs(ctx, '#7b4fa0', 1);
    }
  });
}

/** The upgrades' icons: a target (aim), a paw with motion lines (pace), a bowl (fish), a chest (a toy). */
export function paintUpIcon(ctx: CanvasRenderingContext2D, id: 'aim' | 'paws' | 'bowl' | 'toy', x: number, y: number, r: number): void {
  ctx.save();
  if (id === 'aim') {
    for (let i = 3; i >= 1; i--) {
      ell(ctx, x, y, (r * i) / 3, (r * i) / 3);
      fs(ctx, i % 2 ? '#e5533d' : '#fff4dc', 1);
    }
  } else if (id === 'paws') {
    paintPaw(ctx, x + r * 0.15, y, r * 0.8, '#f6e2c0');
    ctx.strokeStyle = '#f6e2c0';
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.95, y - r * 0.4 + i * r * 0.4);
      ctx.lineTo(x - r * 0.55, y - r * 0.4 + i * r * 0.4);
      ctx.stroke();
    }
  } else if (id === 'bowl') {
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.1);
    ctx.quadraticCurveTo(x, y + r * 1.1, x + r, y - r * 0.1);
    ctx.closePath();
    fs(ctx, '#d9765f', 1.2);
    paintFish(ctx, x, y - r * 0.25, r * 0.55);
  } else {
    rr(ctx, x - r, y - r * 0.55, r * 2, r * 1.2, r * 0.18);
    fs(ctx, '#a0683a', 1.2);
    ctx.fillStyle = '#e0b85a';
    ctx.fillRect(x - r * 0.15, y - r * 0.55, r * 0.3, r * 1.2);
    ctx.fillRect(x - r, y - r * 0.1, r * 2, r * 0.18);
  }
  ctx.restore();
}

/**
 * The gatehouse's cat's-eye: the band's gauge on the thing itself.  The iris ring fills with the gauge
 * (0..1, from lower left over the top to lower right); the notch at the top is the threshold and the
 * ring turns gold beyond it; the pupil narrows to a slit as alertness grows.  In a nap the lid drops
 * and the ring fills blue with calm; at dusk the eye is veiled and asks "?".  The inner glow is the
 * Great Hunt's charge; ready, the whole eye beats gold.
 */
export interface EyeState {
  value: number | null;
  /** the band's level while the eye waits for the lead-in (a faint ring: the panel's number, not yet acting) */
  ghost?: number | null;
  mode: 'alert' | 'nap' | 'dusk' | 'off';
  charge: number;
  ready: boolean;
  mult: string;
  t: number;
  hunting: boolean;
}

export function paintEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, e: EyeState): void {
  ctx.save();
  // the gatehouse's stone surround
  ell(ctx, x, y, r * 1.22, r * 1.22);
  fs(ctx, '#e8cf9a', Math.max(1.5, r * 0.06));
  ctx.strokeStyle = 'rgba(110,70,30,.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 1.0, y + Math.sin(a) * r * 1.0);
    ctx.lineTo(x + Math.cos(a) * r * 1.22, y + Math.sin(a) * r * 1.22);
    ctx.stroke();
  }
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, mid = Math.PI * 1.5;
  // the ring's track
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.17;
  ctx.strokeStyle = 'rgba(59,42,32,.35)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.88, a0, a1);
  ctx.stroke();
  if (e.ghost !== null && e.ghost !== undefined && e.mode === 'alert') {
    const g = Math.max(0, Math.min(1, e.ghost));
    ctx.strokeStyle = 'rgba(255,240,200,.32)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.88, a0, Math.max(a0 + 0.01, a0 + (a1 - a0) * g));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const v = e.value;
  if (v !== null && e.mode !== 'off') {
    const k = Math.max(0, Math.min(1, v));
    const end = a0 + (a1 - a0) * k;
    const above = k >= 0.5;
    ctx.strokeStyle = e.mode === 'nap' ? (above ? '#cfe6ff' : REST) : above ? GOLD : '#c9d27a';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.88, a0, Math.max(a0 + 0.01, end));
    ctx.stroke();
    if (above && e.mode === 'alert') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x + Math.cos(end) * r * 0.88, y + Math.sin(end) * r * 0.88, r * 0.35, 'rgba(255,214,110,', 0.6);
      ctx.restore();
    }
  }
  // the threshold notch at the top
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(mid) * r * 0.74, y + Math.sin(mid) * r * 0.74);
  ctx.lineTo(x + Math.cos(mid) * r * 1.04, y + Math.sin(mid) * r * 1.04);
  ctx.stroke();
  // the eye itself
  const er = r * 0.66;
  const gold = e.mode === 'alert' && (e.value ?? 0) >= 0.5;
  ell(ctx, x, y, er, er * 0.82);
  fs(ctx, e.mode === 'dusk' ? '#5a4a7a' : gold ? GOLD : '#b9c96a', Math.max(1.5, r * 0.05));
  // the hunt's charge glows up from the bottom of the iris
  if (e.charge > 0 && e.mode !== 'dusk') {
    ctx.save();
    ell(ctx, x, y, er, er * 0.82);
    ctx.clip();
    ctx.fillStyle = e.ready ? `rgba(255,236,150,${0.75 + 0.25 * Math.sin(e.t * 9)})` : 'rgba(255,236,150,.55)';
    const hh = er * 1.64 * Math.min(1, e.charge);
    ctx.fillRect(x - er, y + er * 0.82 - hh, er * 2, hh);
    ctx.restore();
  }
  // the pupil: round when sleepy, a slit when alert
  const alert = e.mode === 'alert' ? Math.max(0, Math.min(1, e.value ?? 0)) : 0.15;
  ell(ctx, x, y, er * (0.42 - alert * 0.32), er * 0.72);
  ctx.fillStyle = '#1d1410';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ell(ctx, x - er * 0.28, y - er * 0.3, er * 0.12, er * 0.1);
  ctx.fill();
  if (e.mode === 'nap') {
    // the lid drops
    ctx.save();
    ell(ctx, x, y, er, er * 0.82);
    ctx.clip();
    ctx.fillStyle = '#d8b47e';
    ctx.fillRect(x - er, y - er, er * 2, er * 1.05);
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(x - er * 0.95, y + er * 0.05);
    ctx.quadraticCurveTo(x, y + er * 0.4, x + er * 0.95, y + er * 0.05);
    ctx.stroke();
  }
  if (e.mode === 'dusk') {
    label(ctx, '?', x, y + 1, r * 0.8, '#e6dcff', 'center', 900);
  }
  if (e.ready) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r * (1.5 + 0.2 * Math.sin(e.t * 9)), 'rgba(255,214,110,', 0.55);
    ctx.restore();
    paintPaw(ctx, x, y + r * 0.02, r * 0.42, 'rgba(59,42,32,.85)');
  }
  ctx.restore();
}

/** A soft speech bubble with a tail toward (tx, ty). */
export function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tx: number, ty: number): void {
  const r = Math.min(12, h / 2);
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(255,248,232,.97)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,42,32,.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const bx = Math.max(x + r, Math.min(x + w - r, tx));
  ctx.beginPath();
  ctx.moveTo(bx - 7, y + h - 1);
  ctx.lineTo(tx, ty);
  ctx.lineTo(bx + 7, y + h - 1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,248,232,.97)';
  ctx.fill();
}
