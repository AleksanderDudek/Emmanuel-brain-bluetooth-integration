/**
 * Dolina's painter: the valley of the shadow in warm gouache over deep plum night — dusty ochre
 * Babel with its stepped tower, the burned fortress in soot and ember, the city of screens in cold
 * teal, the green meadow by still water under the moon, and the peach dawn — and the sprites: the
 * pilgrim with his oil lamp and sword in four looks, Ćma the moth, the shadows (ink, smoke and ember
 * eyes, never gore), the guardians, bricks, pits, beams and lantern posts, the upgrades' little
 * pictures.  All canvas paths, no images; sizes in u (about a metre) times `S` (px per u).
 */
import type { EraId, GuardId, MoveKind, ShadowKind, UpId } from './content';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

export const TAU = Math.PI * 2;

export const C = {
  ink: '#120e1a', inkSoft: '#241c30', smoke: '#2e2540', ember: '#ff8a3d', emberHot: '#ffd08a',
  lamp: '#ffe6a8', lampDeep: '#e09a3e', gold: '#f5c35a', goldDeep: '#c98a24', goldLight: '#fff1c4',
  paper: '#f6eedc', text: '#2a2133', textSoft: 'rgba(42,33,51,.78)', calm: '#7fb0c8', calmDeep: '#3f7590',
  skin: '#e9c09a', skinShade: '#c99a76', steel: '#d9dce6', steelDark: '#8d91a3', moth: '#f1e4c8', mothWing: '#e2cfa6',
  grass: '#4f7a4a', grassLight: '#79a35e', water: '#3b5f7e',
};

export type RGB = [number, number, number];
export function hex(s: string): RGB {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgb = (c: RGB, a = 1): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
export const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** A stable pseudo-random number 0..1 from an integer. */
export function hash(i: number): number {
  let x = (i | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** A soft radial glow (use with 'lighter'). `color` is "rgba(r,g,b," */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  if (a <= 0.003 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${color}${a})`);
  g.addColorStop(0.45, `${color}${a * 0.45})`);
  g.addColorStop(1, `${color}0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ── the palettes ──────────────────────────────────────────────────
export type Scene = EraId | 'meadow' | 'dawn';
export interface Palette { top: RGB; mid: RGB; low: RGB; far: RGB; near: RGB; road: RGB; roadTop: RGB; fog: RGB; accent: RGB }

const P = (top: string, mid: string, low: string, far: string, near: string, road: string, roadTop: string, fog: string, accent: string): Palette =>
  ({ top: hex(top), mid: hex(mid), low: hex(low), far: hex(far), near: hex(near), road: hex(road), roadTop: hex(roadTop), fog: hex(fog), accent: hex(accent) });

export const PAL: Readonly<Record<Scene, Palette>> = {
  babel: P('#1b1428', '#3f2c48', '#8a5c46', '#3a2735', '#2a1c26', '#3d2a26', '#6e4a36', '#120c16', '#e0a25a'),
  twierdza: P('#15121d', '#2f2638', '#6a3a34', '#2a2230', '#1d1722', '#2f2629', '#53424a', '#0e0b13', '#ff7a3a'),
  miasto: P('#0b141d', '#173241', '#2f6470', '#152731', '#0e1b23', '#202a31', '#3d5560', '#081017', '#6fe3e8'),
  meadow: P('#1c2742', '#33557a', '#7da2a6', '#2e4a5e', '#2a4a3c', '#3d5a3a', '#6f9a5a', '#162033', '#cfe6ff'),
  dawn: P('#3a2c52', '#a0607e', '#f6b07c', '#6a4a66', '#4a3448', '#5a4140', '#9a6a52', '#3a2440', '#ffd9a0'),
};

/** The clock tower's inside (v3): stone in candlelight, brass, a cold night at the windows. */
export const TOWER_PAL: Palette = P('#1b1522', '#2c2230', '#3a2a2a', '#2a2030', '#1e1820', '#3a2e2c', '#6a5446', '#120c14', '#f0c868');

export function mixPal(a: Palette, b: Palette, k: number): Palette {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const o = {} as Palette;
  for (const key of Object.keys(a) as (keyof Palette)[]) o[key] = mix(a[key], b[key], k);
  return o;
}

// ── the sky and the far valley ────────────────────────────────────
export function paintSky(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, pal: Palette, t: number, moon: number, sun: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, rgb(pal.top));
  g.addColorStop(0.6, rgb(pal.mid));
  g.addColorStop(1, rgb(pal.low));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // a few stars, dimmer toward the dawn
  const starA = 0.7 * (1 - sun);
  if (starA > 0.02) {
    ctx.fillStyle = '#fff6dc';
    for (let i = 0; i < 46; i++) {
      const x = hash(i * 3 + 1) * w, y = hash(i * 7 + 2) * horizon * 0.75;
      ctx.globalAlpha = starA * (0.3 + 0.7 * hash(i)) * (0.75 + 0.25 * Math.sin(t * (1 + hash(i * 5)) + i));
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }
  if (moon > 0.01) {
    const mx = w * 0.78, my = horizon * 0.28, r = Math.min(w, horizon) * 0.06;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, mx, my, r * 5, 'rgba(200,220,255,', 0.18 * moon);
    ctx.restore();
    ctx.globalAlpha = moon;
    ctx.fillStyle = '#f4efd8';
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgb(pal.mid, 0.9);
    ctx.beginPath();
    ctx.arc(mx + r * 0.45, my - r * 0.2, r * 0.85, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (sun > 0.01) {
    const sx = w * 0.72, sy = horizon - sun * horizon * 0.22, r = Math.min(w, horizon) * 0.09;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, sx, sy, r * 7, 'rgba(255,200,140,', 0.45 * sun);
    ctx.restore();
    ctx.globalAlpha = sun;
    ctx.fillStyle = '#ffe7b0';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** The far silhouettes of a scene, scrolling slowly (`scroll` px), alpha `a`. */
export function paintFar(ctx: CanvasRenderingContext2D, scene: Scene, w: number, horizon: number, S: number, scroll: number, t: number, pal: Palette, a: number): void {
  if (a <= 0.01) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = rgb(pal.far);
  // rolling hills under everything
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= w + 20; x += 20) {
    const wx = (x + scroll * 0.6) / S;
    ctx.lineTo(x, horizon - S * (0.9 + 0.5 * Math.sin(wx * 0.35) + 0.3 * Math.sin(wx * 0.9 + 1)));
  }
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fill();
  const unit = S * 9;
  const first = Math.floor(scroll / unit) - 1;
  for (let k = first; k < first + Math.ceil(w / unit) + 3; k++) {
    const x = k * unit - scroll + hash(k) * unit * 0.4;
    const r = hash(k * 13 + 5);
    if (scene === 'babel') {
      if (r < 0.45) {
        // a stepped tower, unfinished
        const steps = 4 + Math.floor(r * 6);
        for (let i = 0; i < steps; i++) {
          const sw = S * (3.2 - i * 0.48), sh = S * 0.55;
          ctx.fillRect(x - sw / 2, horizon - S * 0.8 - (i + 1) * sh, sw, sh + 1);
        }
        ctx.fillStyle = rgb(pal.accent, 0.25);
        ctx.fillRect(x - S * 0.08, horizon - S * 0.8 - steps * S * 0.55 - S * 0.5, S * 0.16, S * 0.5);
        ctx.fillStyle = rgb(pal.far);
      } else if (r < 0.75) {
        ctx.beginPath();
        ctx.moveTo(x - S * 2, horizon);
        ctx.lineTo(x, horizon - S * 1.6);
        ctx.lineTo(x + S * 2.2, horizon);
        ctx.fill();
      }
    } else if (scene === 'twierdza') {
      if (r < 0.55) {
        // a broken keep with ember windows
        const bw = S * (1.6 + r * 2), bh = S * (2.6 + r * 2.4);
        ctx.fillRect(x - bw / 2, horizon - bh, bw, bh);
        for (let i = 0; i < 4; i++) ctx.fillRect(x - bw / 2 + (i * bw) / 4, horizon - bh - S * 0.3, bw / 8, S * 0.3);
        ctx.beginPath();
        ctx.moveTo(x + bw / 2, horizon - bh);
        ctx.lineTo(x + bw / 2 + S * 0.9, horizon - bh * 0.55);
        ctx.lineTo(x + bw / 2, horizon - bh * 0.4);
        ctx.fill();
        ctx.fillStyle = rgb(pal.accent, 0.55 + 0.25 * Math.sin(t * 2 + k));
        ctx.fillRect(x - S * 0.12, horizon - bh * 0.7, S * 0.22, S * 0.32);
        ctx.fillStyle = rgb(pal.far);
      }
    } else if (scene === 'miasto') {
      // towers of glass with screens that flicker
      const n = 3;
      for (let i = 0; i < n; i++) {
        const bx = x + (i - 1) * S * 2.2, bh = S * (2.4 + hash(k * 7 + i) * 3.6), bw = S * (1.2 + hash(k + i * 3) * 0.8);
        ctx.fillStyle = rgb(pal.far);
        ctx.fillRect(bx, horizon - bh, bw, bh);
        for (let j = 0; j < 5; j++) {
          const on = hash(k * 31 + i * 7 + j + Math.floor(t * 1.5 + hash(k + j) * 9)) > 0.55;
          if (!on) continue;
          ctx.fillStyle = rgb(pal.accent, 0.35);
          ctx.fillRect(bx + bw * 0.18, horizon - bh + S * 0.3 + j * S * 0.5, bw * 0.64, S * 0.28);
        }
      }
      ctx.fillStyle = rgb(pal.far);
    } else if (scene === 'meadow' || scene === 'dawn') {
      if (r < 0.5) {
        // a round tree on the hill
        ctx.beginPath();
        ctx.arc(x, horizon - S * 1.9, S * (0.7 + r), 0, TAU);
        ctx.fill();
        ctx.fillRect(x - S * 0.08, horizon - S * 1.6, S * 0.16, S * 1.2);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** The middle layer: things beside the road (rubble, burnt trees, screen posts, reeds). */
export function paintMid(ctx: CanvasRenderingContext2D, scene: Scene, w: number, floorY: number, S: number, scroll: number, t: number, pal: Palette, a: number): void {
  if (a <= 0.01) return;
  ctx.globalAlpha = a;
  const unit = S * 5.5;
  const first = Math.floor(scroll / unit) - 1;
  for (let k = first; k < first + Math.ceil(w / unit) + 3; k++) {
    const x = k * unit - scroll + hash(k * 3) * unit * 0.5;
    const r = hash(k * 17 + 3);
    ctx.fillStyle = rgb(pal.near);
    ctx.strokeStyle = rgb(pal.near);
    if (scene === 'babel') {
      if (r < 0.5) {
        // a pile of bricks
        for (let i = 0; i < 6; i++) {
          const bx = x + (i % 3) * S * 0.42 - (Math.floor(i / 3) * S * 0.2), by = floorY - S * 0.28 - Math.floor(i / 3) * S * 0.26;
          ctx.fillRect(bx, by, S * 0.4, S * 0.24);
        }
      } else if (r < 0.8) {
        // a broken arch
        ctx.lineWidth = S * 0.3;
        ctx.beginPath();
        ctx.arc(x, floorY - S * 0.4, S * 1.1, Math.PI, Math.PI * 1.7);
        ctx.stroke();
        ctx.fillRect(x - S * 1.25, floorY - S * 0.5, S * 0.3, S * 0.5);
      }
    } else if (scene === 'twierdza') {
      if (r < 0.55) {
        // a burnt tree
        ctx.lineWidth = S * 0.16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, floorY);
        ctx.lineTo(x + S * 0.1, floorY - S * 2.2);
        ctx.moveTo(x + S * 0.05, floorY - S * 1.3);
        ctx.lineTo(x + S * 0.7, floorY - S * 1.9);
        ctx.moveTo(x + S * 0.08, floorY - S * 1.7);
        ctx.lineTo(x - S * 0.5, floorY - S * 2.3);
        ctx.stroke();
      } else if (r < 0.8) {
        // a torn banner on a pole
        ctx.fillRect(x, floorY - S * 2.6, S * 0.08, S * 2.6);
        ctx.beginPath();
        ctx.moveTo(x + S * 0.08, floorY - S * 2.5);
        ctx.lineTo(x + S * 0.8 + Math.sin(t * 2 + k) * S * 0.08, floorY - S * 2.3);
        ctx.lineTo(x + S * 0.5, floorY - S * 2.0);
        ctx.lineTo(x + S * 0.7, floorY - S * 1.7);
        ctx.lineTo(x + S * 0.08, floorY - S * 1.8);
        ctx.fill();
      }
    } else if (scene === 'miasto') {
      if (r < 0.6) {
        // a post with a small screen that blinks
        ctx.fillRect(x, floorY - S * 2.2, S * 0.08, S * 2.2);
        ctx.fillRect(x - S * 0.35, floorY - S * 2.6, S * 0.8, S * 0.5);
        const on = Math.sin(t * 3 + k * 2) > -0.3;
        if (on) {
          ctx.fillStyle = rgb(pal.accent, 0.45);
          ctx.fillRect(x - S * 0.3, floorY - S * 2.55, S * 0.7, S * 0.4);
        }
      }
    } else if (scene === 'meadow' || scene === 'dawn') {
      // reeds and flowers
      ctx.lineWidth = Math.max(1, S * 0.04);
      for (let i = 0; i < 5; i++) {
        const rx = x + i * S * 0.18, rh = S * (0.5 + hash(k * 9 + i) * 0.5);
        ctx.beginPath();
        ctx.moveTo(rx, floorY);
        ctx.quadraticCurveTo(rx + Math.sin(t + i + k) * S * 0.1, floorY - rh / 2, rx + Math.sin(t * 1.3 + i) * S * 0.12, floorY - rh);
        ctx.stroke();
      }
      if (r < 0.6) {
        ctx.fillStyle = r < 0.3 ? '#e8d27a' : '#d98aa0';
        ctx.beginPath();
        ctx.arc(x + S * 1.2, floorY - S * 0.22, S * 0.07, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** The road: its band, its top edge, the stones; in the meadow a grassy path and the still water below. */
export function paintRoad(ctx: CanvasRenderingContext2D, w: number, h: number, floorY: number, S: number, scroll: number, pal: Palette, meadow: number, t: number): void {
  const g = ctx.createLinearGradient(0, floorY, 0, h);
  g.addColorStop(0, rgb(pal.roadTop));
  g.addColorStop(0.15, rgb(pal.road));
  g.addColorStop(1, rgb(mix(pal.road, [8, 6, 12], 0.5)));
  ctx.fillStyle = g;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = rgb(mix(pal.roadTop, [255, 240, 210], 0.15));
  ctx.fillRect(0, floorY, w, Math.max(2, S * 0.05));
  // stones in the road
  const unit = S * 1.3;
  const first = Math.floor(scroll / unit) - 1;
  ctx.fillStyle = rgb(mix(pal.road, [0, 0, 0], 0.3));
  for (let k = first; k < first + Math.ceil(w / unit) + 2; k++) {
    const x = k * unit - scroll;
    ctx.fillRect(x + hash(k) * unit * 0.5, floorY + S * (0.18 + hash(k * 5) * 0.3), S * 0.28, S * 0.06);
  }
  if (meadow > 0.01) {
    // still water below the path, with the sky in it
    const wy = floorY + S * 0.55;
    ctx.globalAlpha = meadow;
    const wg = ctx.createLinearGradient(0, wy, 0, h);
    wg.addColorStop(0, '#3b5f7e');
    wg.addColorStop(1, '#22384f');
    ctx.fillStyle = wg;
    ctx.fillRect(0, wy, w, h - wy);
    ctx.strokeStyle = 'rgba(220,235,255,.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const y = wy + 6 + i * 7;
      if (y > h) break;
      const x = ((i * 97 + t * 12) % (w + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + S * (0.6 + hash(i) * 0.8), y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** A pit in the road: a dark hole with a faint rim (always outlined, never a trap). */
export function paintPit(ctx: CanvasRenderingContext2D, x0: number, x1: number, floorY: number, h: number, S: number): void {
  const g = ctx.createLinearGradient(0, floorY, 0, h);
  g.addColorStop(0, '#07050b');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(x0, floorY - 1, x1 - x0, h - floorY + 1);
  ctx.strokeStyle = 'rgba(255,226,170,.55)';
  ctx.lineWidth = Math.max(1.5, S * 0.04);
  ctx.setLineDash([S * 0.12, S * 0.1]);
  ctx.beginPath();
  ctx.moveTo(x0, floorY);
  ctx.lineTo(x0, floorY + S * 0.6);
  ctx.moveTo(x1, floorY);
  ctx.lineTo(x1, floorY + S * 0.6);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** A beam across the road at head height: slide under it.  Hangs from two ropes. */
export function paintBeam(ctx: CanvasRenderingContext2D, x: number, w: number, floorY: number, S: number, low: number, scene: Scene, hit: boolean): void {
  const y = floorY - low * S;
  const bh = S * 0.34;
  ctx.strokeStyle = 'rgba(30,22,30,.9)';
  ctx.lineWidth = Math.max(1, S * 0.04);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y - bh);
  ctx.lineTo(x + w * 0.2, y - S * 3);
  ctx.moveTo(x + w * 0.8, y - bh);
  ctx.lineTo(x + w * 0.8, y - S * 3);
  ctx.stroke();
  const len = S * 1.1;
  ctx.save();
  ctx.translate(x + w / 2, y - bh / 2);
  if (hit) ctx.rotate(0.25);
  if (scene === 'miasto') {
    ctx.fillStyle = '#1d2b33';
    ctx.fillRect(-len / 2, -bh / 2, len, bh);
    ctx.fillStyle = 'rgba(111,227,232,.55)';
    ctx.fillRect(-len / 2 + 3, -bh / 2 + 3, len - 6, bh - 6);
  } else {
    ctx.fillStyle = scene === 'twierdza' ? '#2a2026' : '#6e4a32';
    ctx.fillRect(-len / 2, -bh / 2, len, bh);
    ctx.fillStyle = scene === 'twierdza' ? 'rgba(255,122,58,.5)' : 'rgba(255,220,170,.25)';
    ctx.fillRect(-len / 2, -bh / 2, len, Math.max(1, bh * 0.16));
  }
  // the warning stripes on its face: it reads as "under"
  ctx.fillStyle = 'rgba(255,226,170,.75)';
  for (let i = 0; i < 4; i++) ctx.fillRect(-len / 2 + (i + 0.2) * (len / 4), bh / 2 - Math.max(2, bh * 0.18), len / 8, Math.max(2, bh * 0.18));
  ctx.restore();
}

/** A lantern post beside the road: lit gold, warm, or unlit. */
export function paintPost(ctx: CanvasRenderingContext2D, x: number, floorY: number, S: number, lit: 'gold' | 'warm' | 'none', t: number): void {
  ctx.fillStyle = '#1c1520';
  ctx.fillRect(x - S * 0.05, floorY - S * 1.9, S * 0.1, S * 1.9);
  ctx.fillRect(x - S * 0.05, floorY - S * 1.9, S * 0.38, S * 0.07);
  const lx = x + S * 0.3, ly = floorY - S * 1.68;
  if (lit !== 'none') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, lx, ly, S * (lit === 'gold' ? 1.4 : 0.8), lit === 'gold' ? 'rgba(255,200,110,' : 'rgba(255,170,90,', lit === 'gold' ? 0.5 : 0.28);
    ctx.restore();
  }
  paintSmallLantern(ctx, lx, ly, S * 0.16, lit === 'gold' ? 'gold' : lit === 'warm' ? 'warm' : 'off', 1, t);
}

/** A small lantern (posts, the history's row): gold, warm, the rest's blue-green, unlit, or veiled by the mist. */
export function paintSmallLantern(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, state: 'gold' | 'warm' | 'rest' | 'off' | 'veil', a: number, t = 0): void {
  if (a <= 0.01) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#1c1520';
  ctx.fillRect(x - s * 0.15, y - s * 1.25, s * 0.3, s * 0.3);
  ctx.beginPath();
  ctx.roundRect(x - s * 0.55, y - s, s * 1.1, s * 1.7, s * 0.25);
  ctx.fill();
  const flame = state === 'gold' ? '#ffd36b' : state === 'warm' ? '#e8a25a' : state === 'rest' ? '#9ad4c8' : state === 'veil' ? '#7a7096' : '#3a3040';
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.roundRect(x - s * 0.36, y - s * 0.8, s * 0.72, s * 1.3, s * 0.18);
  ctx.fill();
  if (state === 'gold' || state === 'warm') {
    ctx.fillStyle = '#fff4d0';
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.05 + Math.sin(t * 9) * s * 0.03, s * 0.12, s * 0.28, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── the pilgrim ───────────────────────────────────────────────────
export interface PilgrimPose {
  look: number;
  /** the run cycle (radians), how much he runs (0 standing … 1 running) */
  run: number;
  pace: number;
  air: boolean;
  /** 0..1 how far into a slide; 0..1 fallen; the slash's progress 0..1 (−1: none); the lamp raised 0..1 */
  slide: number;
  fall: number;
  slash: number;
  lampUp: number;
  /** the lamp's flicker 0..1 (low oil) */
  flicker: number;
}

const LOOK_COLORS: readonly { cloak: string; shade: string; trim: string; hat: 'hood' | 'brim' | 'cap' | 'hood' }[] = [
  { cloak: '#7a5236', shade: '#5a3a26', trim: '#b88a5a', hat: 'hood' },
  { cloak: '#5f6f52', shade: '#46543c', trim: '#c9b27a', hat: 'brim' },
  { cloak: '#3d5a8a', shade: '#2c4268', trim: '#e0b85a', hat: 'cap' },
  { cloak: '#efe2c4', shade: '#cdbb94', trim: '#e8a93a', hat: 'hood' },
  // v3: the guide (deep teal, a wide brim), the master of the lamp (amber, a hood with a gold rim)
  { cloak: '#2f6a6a', shade: '#1f4c4c', trim: '#f0c868', hat: 'brim' },
  { cloak: '#c9772e', shade: '#9a561c', trim: '#fff1c4', hat: 'hood' },
];

/**
 * The pilgrim, feet at (x, y), facing right: cloak, head, legs, the lamp held out in front and the
 * sword behind.  Returns where the lamp hangs (its light's centre).
 */
export function paintPilgrim(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, p: PilgrimPose): { x: number; y: number } {
  const L = LOOK_COLORS[Math.max(0, Math.min(LOOK_COLORS.length - 1, p.look))];
  ctx.save();
  ctx.translate(x, y);
  if (p.fall > 0.02) {
    ctx.rotate(-Math.PI / 2 * Math.min(1, p.fall * 1.5));
    ctx.translate(-S * 0.1 * p.fall, 0);
  }
  const lean = p.slide > 0 ? -0.5 * p.slide : 0.12 * p.pace;
  const crouch = p.slide > 0 ? 0.45 * p.slide : 0;
  const bob = p.air ? 0 : Math.abs(Math.sin(p.run)) * S * 0.05 * p.pace;
  // the legs
  ctx.strokeStyle = '#2a1e22';
  ctx.lineCap = 'round';
  ctx.lineWidth = S * 0.11;
  const hipY = -S * (0.5 - crouch * 0.6) - bob;
  const leg = (ph: number) => {
    let fx: number, fy: number;
    if (p.slide > 0) { fx = S * (0.42 + ph * 0.1); fy = -S * 0.04; }
    else if (p.air) { fx = S * (0.12 + ph * 0.15); fy = hipY + S * 0.32; }
    else { fx = Math.sin(p.run + ph * Math.PI) * S * 0.28 * p.pace; fy = -Math.max(0, Math.cos(p.run + ph * Math.PI)) * S * 0.12 * p.pace; }
    const kx = (fx + 0) / 2 + S * 0.1, ky = (hipY + fy) / 2 - S * 0.02;
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.quadraticCurveTo(kx, ky, fx, fy);
    ctx.stroke();
    ctx.fillStyle = '#3a2a24';
    ctx.beginPath();
    ctx.ellipse(fx + S * 0.05, fy - S * 0.02, S * 0.09, S * 0.045, 0, 0, TAU);
    ctx.fill();
  };
  leg(1);
  // the body leans with the run
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  // the sword arm behind
  const swing = p.slash >= 0 ? p.slash : -1;
  ctx.save();
  ctx.translate(-S * 0.02, -S * 0.42);
  const armA = swing >= 0 ? -2.4 + swing * 3.4 : 0.9 + Math.sin(p.run) * 0.4 * p.pace;
  ctx.rotate(armA);
  ctx.strokeStyle = L.shade;
  ctx.lineWidth = S * 0.1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, S * 0.3);
  ctx.stroke();
  // the sword: a plain blade of light steel
  ctx.fillStyle = '#5a3a26';
  ctx.fillRect(-S * 0.025, S * 0.28, S * 0.05, S * 0.12);
  ctx.fillStyle = C.steelDark;
  ctx.fillRect(-S * 0.1, S * 0.38, S * 0.2, S * 0.035);
  ctx.fillStyle = C.steel;
  ctx.beginPath();
  ctx.moveTo(-S * 0.035, S * 0.41);
  ctx.lineTo(S * 0.035, S * 0.41);
  ctx.lineTo(S * 0.02, S * 0.98);
  ctx.lineTo(0, S * 1.04);
  ctx.lineTo(-S * 0.02, S * 0.98);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // the cloak
  ctx.fillStyle = L.cloak;
  ctx.beginPath();
  ctx.moveTo(-S * 0.2, -S * 0.68);
  ctx.quadraticCurveTo(S * 0.2, -S * 0.74, S * 0.2, -S * 0.5);
  ctx.lineTo(S * 0.24, S * 0.02);
  ctx.quadraticCurveTo(0, S * 0.08 + Math.sin(p.run * 2) * S * 0.02, -S * 0.32 - S * 0.12 * p.pace, S * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = L.shade;
  ctx.beginPath();
  ctx.moveTo(-S * 0.2, -S * 0.66);
  ctx.lineTo(-S * 0.32 - S * 0.12 * p.pace, S * 0.04);
  ctx.lineTo(-S * 0.12, S * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = L.trim;
  ctx.fillRect(-S * 0.18, -S * 0.3, S * 0.4, S * 0.05);
  if (p.look === 1) {
    // the traveller's satchel strap
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = S * 0.04;
    ctx.beginPath();
    ctx.moveTo(S * 0.16, -S * 0.66);
    ctx.lineTo(-S * 0.14, -S * 0.1);
    ctx.stroke();
  }
  if (p.look === 3 || p.look === 5) {
    // the keeper's sun clasp (the master's is bigger, with rays)
    ctx.fillStyle = '#ffcf6a';
    ctx.beginPath();
    ctx.arc(S * 0.12, -S * 0.6, S * (p.look === 5 ? 0.07 : 0.05), 0, TAU);
    ctx.fill();
    if (p.look === 5) {
      ctx.strokeStyle = '#ffcf6a';
      ctx.lineWidth = Math.max(1, S * 0.02);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        ctx.beginPath();
        ctx.moveTo(S * 0.12 + Math.cos(a) * S * 0.09, -S * 0.6 + Math.sin(a) * S * 0.09);
        ctx.lineTo(S * 0.12 + Math.cos(a) * S * 0.13, -S * 0.6 + Math.sin(a) * S * 0.13);
        ctx.stroke();
      }
    }
  }
  if (p.look === 4) {
    // the guide's scarf
    ctx.fillStyle = '#e8b04a';
    ctx.fillRect(-S * 0.16, -S * 0.7, S * 0.36, S * 0.07);
    ctx.fillRect(-S * 0.2, -S * 0.66, S * 0.07, S * 0.2);
  }
  leg(0);
  // the head: a hood or hat behind, the face in front (it looks ahead, toward the light)
  if (L.hat === 'hood') {
    ctx.fillStyle = L.shade;
    ctx.beginPath();
    ctx.arc(-S * 0.01, -S * 0.83, S * 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = L.cloak;
    ctx.beginPath();
    ctx.moveTo(-S * 0.22, -S * 0.66);
    ctx.quadraticCurveTo(-S * 0.26, -S * 1.06, S * 0.04, -S * 1.06);
    ctx.quadraticCurveTo(S * 0.22, -S * 1.04, S * 0.2, -S * 0.86);
    ctx.lineTo(S * 0.05, -S * 0.9);
    ctx.lineTo(-S * 0.04, -S * 0.66);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.ellipse(S * 0.08, -S * 0.8, S * 0.12, S * 0.135, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.skinShade;
  ctx.beginPath();
  ctx.ellipse(S * 0.02, -S * 0.78, S * 0.06, S * 0.11, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a1e22';
  ctx.beginPath();
  ctx.arc(S * 0.13, -S * 0.83, S * 0.022, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(220,120,110,.5)';
  ctx.beginPath();
  ctx.arc(S * 0.12, -S * 0.76, S * 0.025, 0, TAU);
  ctx.fill();
  ctx.fillStyle = L.cloak;
  if (L.hat === 'hood') {
    // the hood's rim over the brow
    ctx.beginPath();
    ctx.moveTo(-S * 0.06, -S * 0.95);
    ctx.quadraticCurveTo(S * 0.1, -S * 1.02, S * 0.21, -S * 0.88);
    ctx.lineTo(S * 0.18, -S * 0.86);
    ctx.quadraticCurveTo(S * 0.08, -S * 0.95, -S * 0.04, -S * 0.9);
    ctx.closePath();
    ctx.fill();
  } else if (L.hat === 'brim') {
    ctx.fillRect(-S * 0.14, -S * 0.95, S * 0.42, S * 0.05);
    ctx.beginPath();
    ctx.ellipse(S * 0.06, -S * 0.97, S * 0.14, S * 0.1, 0, Math.PI, TAU);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(S * 0.06, -S * 0.91, S * 0.15, S * 0.08, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(S * 0.06, -S * 0.92, S * 0.18, S * 0.035);
    ctx.fillStyle = L.trim;
    ctx.fillRect(-S * 0.08, -S * 0.7, S * 0.28, S * 0.05);
  }
  // the lamp arm: held out ahead, raised for a burst
  const ax = S * 0.12, ay = -S * 0.56;
  const reach = S * (0.42 + 0.06 * p.lampUp);
  const ang = -0.25 - p.lampUp * 0.9;
  const hx = ax + Math.cos(ang) * reach, hy = ay + Math.sin(ang) * reach - (p.slide > 0 ? 0 : 0);
  ctx.strokeStyle = L.cloak;
  ctx.lineWidth = S * 0.1;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.restore();
  // where the lamp hangs, in screen space (the body's lean applied)
  const cosL = Math.cos(lean), sinL = Math.sin(lean);
  const hx0 = S * 0.12 + Math.cos(-0.25 - p.lampUp * 0.9) * S * (0.42 + 0.06 * p.lampUp);
  const hy0 = -S * 0.56 + Math.sin(-0.25 - p.lampUp * 0.9) * S * (0.42 + 0.06 * p.lampUp);
  const lx = hx0 * cosL - hy0 * sinL, ly = hx0 * sinL + hy0 * cosL + hipY;
  ctx.restore();
  const fx = p.fall > 0.5 ? x + S * 0.6 : x + lx, fy = p.fall > 0.5 ? y - S * 0.15 : y + ly + S * 0.18;
  paintLamp(ctx, fx, fy, S * 0.2, p.flicker);
  return { x: fx, y: fy };
}

/** The oil lamp: a little clay lamp with its flame, hanging from its bail at (x, y − s). */
export function paintLamp(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flicker: number): void {
  ctx.strokeStyle = '#3a2a20';
  ctx.lineWidth = Math.max(1, s * 0.14);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.1);
  ctx.lineTo(x, y - s * 0.4);
  ctx.stroke();
  ctx.fillStyle = '#b8703a';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.8, s * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8a4e26';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.12, s * 0.8, s * 0.26, 0, 0, Math.PI);
  ctx.fill();
  const f = 1 - 0.5 * flicker * (0.5 + 0.5 * Math.sin(performance.now() / 70));
  ctx.fillStyle = '#ffd36b';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.55, y - s * 0.55 * f, s * 0.22 * f, s * 0.45 * f, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff7da';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.55, y - s * 0.45 * f, s * 0.1 * f, s * 0.22 * f, 0.2, 0, TAU);
  ctx.fill();
}

// ── Ćma, the moth ─────────────────────────────────────────────────
/** Ćma: a fluffy cream moth with big eyes; `mood` tilts her (sulk droops the antennae). */
export function paintMoth(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, mood: 'happy' | 'sulk' | 'wow' | 'sleep' = 'happy', facing = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const flap = mood === 'sleep' ? 0.15 : 0.5 + 0.5 * Math.sin(t * 22);
  // wings
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(1, side === -1 ? 1 : 1);
    const k = 0.35 + 0.65 * flap;
    ctx.fillStyle = C.mothWing;
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, -s * 0.35 * k, s * 0.55, s * 0.42 * k + s * 0.08, side * 0.5 - 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d9a35a';
    ctx.beginPath();
    ctx.arc(-s * 0.25, -s * 0.38 * k, s * 0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a4a2a';
    ctx.beginPath();
    ctx.arc(-s * 0.25, -s * 0.38 * k, s * 0.05, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // body
  ctx.fillStyle = C.moth;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42, s * 0.3, -0.15, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff8ea';
  ctx.beginPath();
  ctx.arc(s * 0.3, -s * 0.12, s * 0.26, 0, TAU);
  ctx.fill();
  // antennae
  ctx.strokeStyle = '#8a6a4a';
  ctx.lineWidth = Math.max(1, s * 0.06);
  const droop = mood === 'sulk' ? 0.5 : 0;
  for (const a of [-0.3, 0.15]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.38, -s * 0.32);
    ctx.quadraticCurveTo(s * (0.5 + a), -s * (0.75 - droop), s * (0.75 + a), -s * (0.7 - droop * 1.4));
    ctx.stroke();
  }
  // the big eyes
  const eye = mood === 'sleep' ? 0.2 : mood === 'wow' ? 1.25 : 1;
  ctx.fillStyle = '#1e1622';
  ctx.beginPath();
  ctx.ellipse(s * 0.38, -s * 0.12, s * 0.09, s * 0.11 * eye, 0, 0, TAU);
  ctx.fill();
  if (mood !== 'sleep') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s * 0.4, -s * 0.16, s * 0.03, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(232,140,130,.6)';
  ctx.beginPath();
  ctx.arc(s * 0.28, s * 0.02, s * 0.05, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ── the shadows ───────────────────────────────────────────────────
export interface ShadowPose {
  kind: ShadowKind;
  t: number;
  id: number;
  hit: number;
  stun: number;
  inLight: boolean;
  shield: boolean;
  crack: number;
  dive: number;
  /** 0..1 dissolving */
  fade: number;
  /** 0..1 popping up */
  pop: number;
}

const INK = 'rgba(18,14,26,';

/** Ember eyes: always visible, even in the fog. */
export function paintEyes(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, id: number, stun: number): void {
  const blink = (t * 0.7 + hash(id)) % 3 < 0.08;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, s * 3, 'rgba(255,120,50,', 0.25);
  ctx.restore();
  ctx.fillStyle = stun > 0 ? '#ffe6b0' : C.ember;
  for (const dx of [-s * 0.9, s * 0.9]) {
    ctx.beginPath();
    if (stun > 0) ctx.arc(x + dx, y, s * 0.5, 0, TAU);
    else ctx.ellipse(x + dx, y, s * 0.55, blink ? s * 0.1 : s * 0.42, 0, 0, TAU);
    ctx.fill();
  }
}

/** A wisp of smoke rising from a shadow. */
function wisps(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number, id: number, a: number): void {
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.6 + i / 3 + hash(id + i)) % 1;
    ctx.fillStyle = `${INK}${0.35 * (1 - k) * a})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(k * 6 + i) * S * 0.12, y - k * S * 0.7, S * (0.08 + 0.1 * k), 0, TAU);
    ctx.fill();
  }
}

/** A shadow at (x, yBase: the bottom of its body), in ink and smoke with ember eyes. */
export function paintShadow(ctx: CanvasRenderingContext2D, x: number, yBase: number, S: number, p: ShadowPose): void {
  const a = 1 - p.fade;
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  const wob = Math.sin(p.t * 7 + p.id) * S * 0.03;
  const fill = p.hit > 0 ? '#f6eedc' : p.inLight ? '#3a2232' : C.ink;
  ctx.fillStyle = fill;
  let eyeX = x - S * 0.12, eyeY = yBase - S * 0.6;
  switch (p.kind) {
    case 'glinianek': {
      // a lumpy figure of clay
      ctx.beginPath();
      ctx.moveTo(x - S * 0.32, yBase);
      ctx.quadraticCurveTo(x - S * 0.4 + wob, yBase - S * 0.6, x - S * 0.12, yBase - S * 0.88);
      ctx.quadraticCurveTo(x + S * 0.2, yBase - S * 0.98, x + S * 0.3 + wob, yBase - S * 0.55);
      ctx.quadraticCurveTo(x + S * 0.34, yBase - S * 0.2, x + S * 0.3, yBase);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.hit > 0 ? fill : 'rgba(120,80,60,.35)';
      ctx.beginPath();
      ctx.arc(x + S * 0.1, yBase - S * 0.3, S * 0.08, 0, TAU);
      ctx.arc(x - S * 0.15, yBase - S * 0.45, S * 0.05, 0, TAU);
      ctx.fill();
      eyeY = yBase - S * 0.66;
      break;
    }
    case 'ceglomiot': {
      ctx.beginPath();
      ctx.moveTo(x - S * 0.38, yBase);
      ctx.lineTo(x - S * 0.3, yBase - S * 0.8);
      ctx.quadraticCurveTo(x, yBase - S * 1.1, x + S * 0.3, yBase - S * 0.8);
      ctx.lineTo(x + S * 0.38, yBase);
      ctx.closePath();
      ctx.fill();
      // a brick held high, ready to throw
      const lift = (Math.sin(p.t * 3 + p.id) + 1) / 2;
      ctx.strokeStyle = fill;
      ctx.lineWidth = S * 0.1;
      ctx.beginPath();
      ctx.moveTo(x + S * 0.15, yBase - S * 0.8);
      ctx.lineTo(x + S * 0.05, yBase - S * (1.1 + 0.15 * lift));
      ctx.stroke();
      paintBrick(ctx, x + S * 0.05, yBase - S * (1.22 + 0.15 * lift), S * 0.17, 0.2);
      eyeY = yBase - S * 0.72;
      break;
    }
    case 'giermek': {
      ctx.beginPath();
      ctx.moveTo(x - S * 0.3, yBase);
      ctx.lineTo(x - S * 0.26, yBase - S * 0.78);
      ctx.quadraticCurveTo(x, yBase - S * 1.15, x + S * 0.26, yBase - S * 0.78);
      ctx.lineTo(x + S * 0.3, yBase);
      ctx.closePath();
      ctx.fill();
      // a helm's ridge
      ctx.fillStyle = 'rgba(80,70,90,.8)';
      ctx.fillRect(x - S * 0.22, yBase - S * 0.86, S * 0.44, S * 0.05);
      if (p.shield) {
        ctx.fillStyle = '#3a3444';
        ctx.beginPath();
        ctx.ellipse(x - S * 0.32, yBase - S * 0.5, S * 0.16, S * 0.34, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#6a6278';
        ctx.lineWidth = Math.max(1, S * 0.03);
        ctx.stroke();
        if (p.crack > 0.05) {
          ctx.strokeStyle = `rgba(255,214,140,${0.4 + 0.6 * p.crack})`;
          ctx.beginPath();
          ctx.moveTo(x - S * 0.32, yBase - S * 0.82);
          ctx.lineTo(x - S * 0.26, yBase - S * 0.6);
          ctx.lineTo(x - S * 0.36, yBase - S * 0.45);
          ctx.lineTo(x - S * 0.3, yBase - S * 0.2);
          ctx.stroke();
        }
      }
      eyeY = yBase - S * 0.74;
      break;
    }
    case 'kruk': {
      const f = Math.sin(p.t * 14 + p.id);
      ctx.beginPath();
      ctx.ellipse(x, yBase + S * 0.2, S * 0.32, S * 0.16, p.dive > 0 && p.dive < 1 ? 0.5 : 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - S * 0.05, yBase + S * 0.15);
      ctx.lineTo(x + S * 0.25, yBase - S * 0.25 * f);
      ctx.lineTo(x + S * 0.45, yBase + S * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - S * 0.3, yBase + S * 0.15);
      ctx.lineTo(x - S * 0.6, yBase + S * 0.1);
      ctx.lineTo(x - S * 0.35, yBase + S * 0.26);
      ctx.fill();
      // the beak
      ctx.fillStyle = '#5a4a40';
      ctx.beginPath();
      ctx.moveTo(x - S * 0.3, yBase + S * 0.16);
      ctx.lineTo(x - S * 0.48, yBase + S * 0.2);
      ctx.lineTo(x - S * 0.3, yBase + S * 0.23);
      ctx.fill();
      eyeX = x - S * 0.12;
      eyeY = yBase + S * 0.14;
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = C.ember;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, S * 0.04, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'pling': {
      const k = p.pop < 1 ? 0.4 + 0.6 * Math.sin(p.pop * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1;
      const w = S * 0.62 * k, h = S * 0.5 * k;
      ctx.fillStyle = p.hit > 0 ? fill : 'rgba(14,30,38,.92)';
      ctx.beginPath();
      ctx.roundRect(x - w / 2, yBase, w, h, h * 0.35);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - w * 0.15, yBase + h - 1);
      ctx.lineTo(x - w * 0.3, yBase + h + S * 0.12 * k);
      ctx.lineTo(x + w * 0.05, yBase + h - 1);
      ctx.fill();
      ctx.strokeStyle = 'rgba(111,227,232,.7)';
      ctx.lineWidth = Math.max(1, S * 0.03);
      ctx.beginPath();
      ctx.roundRect(x - w / 2, yBase, w, h, h * 0.35);
      ctx.stroke();
      // the red badge
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.arc(x + w / 2 - S * 0.04, yBase + S * 0.04, S * 0.09 * k, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${Math.max(6, S * 0.11 * k)}px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x + w / 2 - S * 0.04, yBase + S * 0.045);
      eyeX = x;
      eyeY = yBase + h * 0.5;
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = a;
      paintEyes(ctx, eyeX, eyeY, S * 0.05, p.t, p.id, p.stun);
      ctx.restore();
      return;
    }
    case 'przewijacz': {
      // a crawling hand of smoke that scrolls you back
      ctx.beginPath();
      ctx.moveTo(x + S * 0.4, yBase);
      ctx.quadraticCurveTo(x + S * 0.35, yBase - S * 0.55, x, yBase - S * 0.62);
      ctx.quadraticCurveTo(x - S * 0.3, yBase - S * 0.6, x - S * 0.38, yBase - S * 0.3);
      for (let i = 0; i < 4; i++) {
        const fx = x - S * (0.38 + 0.12 * Math.sin(p.t * 8 + i)), fy = yBase - S * (0.3 - i * 0.08);
        ctx.lineTo(fx - S * 0.12, fy + S * 0.03);
        ctx.lineTo(fx, fy + S * 0.07);
      }
      ctx.lineTo(x - S * 0.3, yBase);
      ctx.closePath();
      ctx.fill();
      // the backwards arrow
      ctx.strokeStyle = 'rgba(111,227,232,.75)';
      ctx.lineWidth = Math.max(1, S * 0.045);
      ctx.beginPath();
      ctx.arc(x + S * 0.08, yBase - S * 0.34, S * 0.12, -0.6, Math.PI * 1.3);
      ctx.stroke();
      eyeY = yBase - S * 0.48;
      eyeX = x - S * 0.12;
      break;
    }
  }
  wisps(ctx, x, yBase - S * 0.9, S, p.t, p.id, a);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = a;
  paintEyes(ctx, eyeX, eyeY, S * 0.05, p.t, p.id, p.stun);
  ctx.restore();
  if (p.stun > 0) {
    // little stars of the lamp's flash circling its head
    ctx.fillStyle = '#ffe6b0';
    for (let i = 0; i < 3; i++) {
      const ang = p.t * 5 + (i * TAU) / 3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * S * 0.3, yBase - S * 1.05 + Math.sin(ang) * S * 0.08, S * 0.04, 0, TAU);
      ctx.fill();
    }
  }
}

/** A brick of Babel's clay. */
export function paintBrick(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#7a3e2a';
  ctx.fillRect(-s, -s * 0.55, s * 2, s * 1.1);
  ctx.fillStyle = '#a65a3a';
  ctx.fillRect(-s, -s * 0.55, s * 2, s * 0.3);
  ctx.strokeStyle = 'rgba(30,14,10,.7)';
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.strokeRect(-s, -s * 0.55, s * 2, s * 1.1);
  ctx.restore();
}

// ── the guardians ─────────────────────────────────────────────────
export interface GuardPose {
  id: GuardId;
  t: number;
  /** the weak point open, a move's telegraph (its kind and 0..1), a hit's flash, angry, dissolving 0..1 */
  open: boolean;
  tele: MoveKind | null;
  teleK: number;
  hit: number;
  angry: boolean;
  fade: number;
}

/** A guardian standing with its front edge at x on the road (floorY), about 3 u tall. */
export function paintGuard(ctx: CanvasRenderingContext2D, x: number, floorY: number, S: number, p: GuardPose): { weak: { x: number; y: number } } {
  const a = 1 - p.fade;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  const shake = p.tele === 'roll' ? Math.sin(p.t * 60) * S * 0.04 * p.teleK : 0;
  const fill = p.hit > 0 ? '#f6eedc' : C.ink;
  let weak = { x: x + S * 0.6, y: floorY - S * 1.4 };
  if (p.id === 'wieza') {
    // a stepped tower of bricks
    const cx = x + S * 1.3 + shake;
    ctx.fillStyle = fill;
    const tiers = [[2.6, 1.2], [2.0, 1.0], [1.4, 0.9], [0.8, 0.7]];
    let y = floorY;
    tiers.forEach(([tw, th]) => {
      ctx.fillStyle = fill;
      ctx.fillRect(cx - (tw * S) / 2, y - th * S, tw * S, th * S + 1);
      ctx.strokeStyle = 'rgba(224,162,90,.35)';
      ctx.lineWidth = Math.max(1, S * 0.03);
      ctx.strokeRect(cx - (tw * S) / 2, y - th * S, tw * S, th * S);
      // brick courses
      ctx.strokeStyle = 'rgba(120,70,50,.35)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - (tw * S) / 2, y - (th * S * i) / 3);
        ctx.lineTo(cx + (tw * S) / 2, y - (th * S * i) / 3);
        ctx.stroke();
      }
      y -= th * S;
    });
    // ember windows as eyes
    paintEyes(ctx, cx, floorY - S * 2.5, S * 0.07, p.t, 7, 0);
    // the seam
    weak = { x: cx - S * 0.2, y: floorY - S * 1.4 };
    ctx.strokeStyle = p.open ? '#ffd36b' : 'rgba(255,170,90,.35)';
    ctx.lineWidth = p.open ? S * 0.12 : S * 0.05;
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.1, floorY - S * 0.4);
    ctx.lineTo(cx - S * 0.3, floorY - S * 1.1);
    ctx.lineTo(cx - S * 0.1, floorY - S * 1.6);
    ctx.lineTo(cx - S * 0.25, floorY - S * 2.2);
    ctx.stroke();
  } else if (p.id === 'rycerz') {
    const cx = x + S * 0.75;
    const bow = p.open ? -0.14 : 0;
    ctx.fillStyle = fill;
    ctx.save();
    ctx.translate(cx, floorY);
    ctx.rotate(bow);
    // legs and body of soot
    ctx.fillRect(-S * 0.42, -S * 1.1, S * 0.3, S * 1.1);
    ctx.fillRect(S * 0.08, -S * 1.1, S * 0.3, S * 1.1);
    ctx.beginPath();
    ctx.moveTo(-S * 0.6, -S * 1.0);
    ctx.lineTo(-S * 0.5, -S * 2.4);
    ctx.quadraticCurveTo(0, -S * 2.7, S * 0.5, -S * 2.4);
    ctx.lineTo(S * 0.6, -S * 1.0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,160,100,.35)';
    ctx.lineWidth = Math.max(1, S * 0.04);
    ctx.stroke();
    // soot cracks glowing faintly
    ctx.strokeStyle = 'rgba(255,120,60,.3)';
    ctx.beginPath();
    ctx.moveTo(-S * 0.2, -S * 2.1);
    ctx.lineTo(-S * 0.05, -S * 1.7);
    ctx.lineTo(-S * 0.18, -S * 1.35);
    ctx.moveTo(S * 0.25, -S * 2.0);
    ctx.lineTo(S * 0.12, -S * 1.6);
    ctx.stroke();
    ctx.fillStyle = fill;
    // the helm with its ember slit
    ctx.beginPath();
    ctx.roundRect(-S * 0.32, -S * 3.2, S * 0.64, S * 0.75, S * 0.18);
    ctx.fill();
    ctx.fillStyle = C.ember;
    ctx.fillRect(-S * 0.24, -S * 2.92, S * 0.48, S * 0.07);
    // the sword raised for a blow, its glint the telegraph
    const raise = p.tele === 'high' ? p.teleK : p.tele === 'wall' || p.tele === 'pair' ? p.teleK * 0.6 : 0.15;
    ctx.save();
    ctx.translate(-S * 0.45, -S * 2.2);
    ctx.rotate(-0.4 - raise * 2.1 + (p.tele === 'wall' || p.tele === 'pair' ? 0.6 : 0));
    ctx.fillStyle = '#3a3444';
    ctx.fillRect(-S * 0.05, -S * 1.7, S * 0.1, S * 1.7);
    if (raise > 0.6) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, -S * 1.7, S * 0.6, 'rgba(255,240,200,', 0.8 * raise);
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
    weak = { x: cx, y: floorY - S * 1.9 };
    if (p.open) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, weak.x, weak.y, S * 0.7, 'rgba(255,211,107,', 0.7);
      ctx.restore();
    }
    // smoke puffs when he pants
    if (p.open) wisps(ctx, cx, floorY - S * 3, S, p.t * 2, 3, 1);
  } else {
    // the screen on its stand
    const cx = x + S * 1.15;
    ctx.fillStyle = fill;
    ctx.fillRect(cx - S * 0.12, floorY - S * 1.2, S * 0.24, S * 1.2);
    ctx.fillRect(cx - S * 0.7, floorY - S * 0.12, S * 1.4, S * 0.12);
    const sw = S * 2.3, sh = S * 1.7, sy = floorY - S * 1.2 - sh;
    ctx.beginPath();
    ctx.roundRect(cx - sw / 2, sy, sw, sh, S * 0.12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(111,227,232,.4)';
    ctx.lineWidth = Math.max(1, S * 0.04);
    ctx.stroke();
    const flick = 0.7 + 0.3 * Math.sin(p.t * 17) * Math.sin(p.t * 5);
    const glass = p.open ? 'rgba(60,70,80,.9)' : `rgba(111,227,232,${0.35 * flick})`;
    ctx.fillStyle = glass;
    ctx.fillRect(cx - sw / 2 + S * 0.1, sy + S * 0.1, sw - S * 0.2, sh - S * 0.2);
    if (p.open) {
      // loading: a spinner, the core exposed
      ctx.strokeStyle = '#ffd36b';
      ctx.lineWidth = S * 0.08;
      ctx.beginPath();
      ctx.arc(cx, sy + sh / 2, S * 0.35, p.t * 6, p.t * 6 + 4.2);
      ctx.stroke();
    } else paintEyes(ctx, cx, sy + sh * 0.45, S * 0.08, p.t, 11, 0);
    weak = { x: cx, y: sy + sh / 2 };
    if (p.tele === 'high' || p.tele === 'wall') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, cx - sw / 2, floorY - S * 1.0, S * 0.8 * p.teleK, 'rgba(111,227,232,', 0.8);
      ctx.restore();
    }
  }
  if (p.angry && p.fade <= 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x + S * 1, floorY - S * 1.5, S * 2.4, 'rgba(255,90,40,', 0.12 + 0.06 * Math.sin(p.t * 6));
    ctx.restore();
  }
  ctx.restore();
  return { weak };
}

// ── the lobby's little pictures ───────────────────────────────────
/** A portrait of the pilgrim in a look (the progress card), dimmed until it is reached. */
export function paintPortrait(ctx: CanvasRenderingContext2D, w: number, h: number, look: number, own: boolean): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2a2440');
  g.addColorStop(1, '#4a3f63');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = own ? 1 : 0.3;
  const S = h * 0.75;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, w * 0.62, h * 0.55, S * 0.6, 'rgba(255,200,110,', 0.45);
  ctx.restore();
  paintPilgrim(ctx, w * 0.42, h * 0.95, S, { look, run: 0.6, pace: 0.4, air: false, slide: 0, fall: 0, slash: -1, lampUp: 0.2, flicker: 0 });
  ctx.globalAlpha = 1;
}

/** An upgrade's little picture at (x, y), radius r; its level as pips under it. */
export function paintUpIcon(ctx: CanvasRenderingContext2D, id: UpId, x: number, y: number, r: number, level: number): void {
  ctx.fillStyle = '#2a2440';
  ctx.beginPath();
  ctx.arc(x, y, r * 1.2, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  switch (id) {
    case 'stone':
      // a mason's stack of three stones
      ctx.fillStyle = '#9a7a5c';
      ctx.fillRect(-r * 0.7, r * 0.05, r * 0.65, r * 0.45);
      ctx.fillRect(r * 0.02, r * 0.05, r * 0.65, r * 0.45);
      ctx.fillStyle = '#c49a6c';
      ctx.fillRect(-r * 0.33, -r * 0.45, r * 0.65, r * 0.45);
      ctx.strokeStyle = 'rgba(40,24,16,.7)';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.strokeRect(-r * 0.7, r * 0.05, r * 0.65, r * 0.45);
      ctx.strokeRect(r * 0.02, r * 0.05, r * 0.65, r * 0.45);
      ctx.strokeRect(-r * 0.33, -r * 0.45, r * 0.65, r * 0.45);
      break;
    case 'forge':
      ctx.rotate(-0.7);
      ctx.fillStyle = C.steel;
      ctx.fillRect(-r * 0.08, -r * 0.9, r * 0.16, r * 1.3);
      ctx.fillStyle = C.goldDeep;
      ctx.fillRect(-r * 0.35, r * 0.35, r * 0.7, r * 0.12);
      ctx.fillRect(-r * 0.07, r * 0.4, r * 0.14, r * 0.4);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, -r * 0.6, r * 0.6, 'rgba(255,170,90,', 0.6);
      break;
    case 'income':
      ctx.fillStyle = '#8a5a3c';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.2, r * 0.6, r * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(-r * 0.22, -r * 0.5, r * 0.44, r * 0.35);
      ctx.fillStyle = C.gold;
      for (const [dx, dy] of [[-0.25, 0.1], [0.2, 0.25], [0, -0.05]]) {
        ctx.beginPath();
        ctx.arc(dx * r, dy * r, r * 0.13, 0, TAU);
        ctx.fill();
      }
      break;
    case 'lamp':
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, 0, r * 1.1, 'rgba(255,200,110,', 0.7);
      ctx.globalCompositeOperation = 'source-over';
      paintLamp(ctx, -r * 0.1, r * 0.25, r * 0.5, 0);
      break;
    case 'oil':
      ctx.fillStyle = '#b8703a';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.15, r * 0.55, r * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(-r * 0.2, -r * 0.75, r * 0.4, r * 0.4);
      ctx.fillStyle = '#e8c070';
      ctx.beginPath();
      ctx.arc(-r * 0.15, 0, r * 0.12, 0, TAU);
      ctx.fill();
      break;
  }
  ctx.restore();
  for (let i = 0; i < level; i++) {
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.arc(x - (level - 1) * r * 0.22 + i * r * 0.44, y + r * 1.05, r * 0.14, 0, TAU);
    ctx.fill();
  }
}
