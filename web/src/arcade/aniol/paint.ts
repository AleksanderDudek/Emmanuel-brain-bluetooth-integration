/**
 * Anioł Stróż's painter: a child's bedroom at night in soft gouache — violet-blue walls under the
 * moon, a warm amber lamp, a wooden bed with a patchwork quilt — and the sprites: the sleeping
 * child, the angel (white, gold and light, wings; a slender staff of light, no weapon of cruelty),
 * the Zmory (ink and smoke with ember eyes; never gore, nothing a child could not look at), stars,
 * feathers, the gifts' little pictures and the room's cosy things.  All canvas paths, no images;
 * sizes in u (about a metre) times `s` (px per u).
 */
import type { GiftId, RoomItem, ZKind } from './content';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

export const C = {
  night: '#1c1d3f', nightDeep: '#12122b', wall: '#3b3a72', wallLight: '#4d4a8a', wallDark: '#2b2a58', trim: '#5c5698',
  floor: '#4a3550', floorLight: '#5d4462', floorDark: '#33233b',
  wood: '#8a5a3c', woodLight: '#a8734e', woodDark: '#5e3b27',
  quilt: '#c97b84', quilt2: '#5f8f8b', quilt3: '#e3b26a', quiltDark: '#8f4f5a', pillow: '#f3ead6', sheet: '#e9dfcf',
  skin: '#f0c9a8', cheek: '#e89a8a', hair: '#6b4630',
  lamp: '#ffcf7a', lampGlow: 'rgba(255,196,110,', moon: '#f6efd0', sky: '#232a5c', skyDeep: '#151a42',
  angel: '#fffaf0', angelShade: '#e8e0f2', gold: '#f5c96a', goldDeep: '#d39a2c', goldLight: '#fff3c4', light: 'rgba(255,240,190,',
  ink: '#0e0b1c', smoke: '#262040', smokeLight: '#3a3260', ember: '#ff8a3d', emberHot: '#ffd08a',
  paper: '#f7f0e2', text: '#2b2440', textSoft: 'rgba(43,36,64,.78)', calm: '#7fa7e0', calmDeep: '#4a6fb0',
};

export type RGB = [number, number, number];
export function hex(s: string): RGB {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgb = (c: RGB, a = 1): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

/** A stable pseudo-random number 0..1 from an integer. */
export function hash(i: number): number {
  let x = (i | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const TAU = Math.PI * 2;

/** A soft radial glow (additive). */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  if (a <= 0.003 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${color}${a})`);
  g.addColorStop(0.45, `${color}${a * 0.45})`);
  g.addColorStop(1, `${color}0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ── stars and feathers ────────────────────────────────────────────
export function paintStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, color = '#fff3c4', rot = -Math.PI / 2): void {
  if (a <= 0.01 || r <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const ang = rot + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A small white feather with a gold quill. */
export function paintFeather(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number, a = 1): void {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * 0.42, -size * 0.3, size * 0.12, size * 0.75);
  ctx.lineTo(-size * 0.05, size * 0.75);
  ctx.quadraticCurveTo(-size * 0.42, -size * 0.2, 0, -size);
  ctx.fill();
  ctx.strokeStyle = C.goldDeep;
  ctx.lineWidth = Math.max(0.8, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.85);
  ctx.lineTo(0.02 * size, size * 1.05);
  ctx.stroke();
  ctx.restore();
}

// ── the room ──────────────────────────────────────────────────────
export interface RoomBox {
  w: number; h: number;
  /** the bed's centre and the floor line (px), px per u */
  cx: number; floorY: number; s: number;
  /** the window (the sky box) */
  win: { x: number; y: number; w: number; h: number };
}

/** The back wall, the floor, the wardrobe's shadow on the left, the door ajar on the right; `night` 0..1 darkens. */
export function paintRoom(ctx: CanvasRenderingContext2D, R: RoomBox, t: number, dawn: number): void {
  const { w, h, cx, floorY, s } = R;
  // the wall: lighter toward the lamp and the window
  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, C.wallDark);
  wall.addColorStop(1, C.wall);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, floorY);
  // wallpaper: tiny moons and dots in rows
  ctx.fillStyle = 'rgba(160,150,230,.10)';
  const step = Math.max(18, s * 0.55);
  for (let row = 0, y = step * 0.6; y < floorY - s * 0.4; row++, y += step) {
    for (let x = (row % 2) * step * 0.5; x < w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, s * 0.035), 0, TAU);
      ctx.fill();
    }
  }
  // the skirting board and the floorboards
  ctx.fillStyle = C.trim;
  ctx.fillRect(0, floorY - s * 0.12, w, s * 0.12);
  const fl = ctx.createLinearGradient(0, floorY, 0, h);
  fl.addColorStop(0, C.floorLight);
  fl.addColorStop(1, C.floorDark);
  ctx.fillStyle = fl;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = 'rgba(20,10,30,.25)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = floorY + (h - floorY) * (i / 5) ** 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // a rug under the bed
  ctx.fillStyle = 'rgba(201,123,132,.35)';
  ctx.beginPath();
  ctx.ellipse(cx, floorY + s * 0.32, s * 2.3, s * 0.22, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(243,234,214,.25)';
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.ellipse(cx, floorY + s * 0.32, s * 2.05, s * 0.16, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  // the wardrobe on the left: its edge and its shadow
  const wx = cx - 6.0 * s;
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(wx - s * 1.2, floorY - s * 3.4, s * 1.2, s * 3.4);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(wx - s * 0.06, floorY - s * 3.4, s * 0.06, s * 3.4);
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(wx - s * 0.18, floorY - s * 1.8, Math.max(1.5, s * 0.05), 0, TAU);
  ctx.fill();
  // the door on the right, ajar: darkness behind it
  const dx = cx + 5.6 * s;
  ctx.fillStyle = '#0b0a18';
  ctx.fillRect(dx, floorY - s * 2.9, s * 1.3, s * 2.9);
  ctx.fillStyle = C.wood;
  ctx.beginPath();
  ctx.moveTo(dx, floorY - s * 2.9);
  ctx.lineTo(dx + s * 0.55, floorY - s * 3.02);
  ctx.lineTo(dx + s * 0.55, floorY + s * 0.08);
  ctx.lineTo(dx, floorY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 2;
  ctx.strokeRect(dx - 1, floorY - s * 2.9 - 1, s * 1.3 + 2, s * 2.9 + 2);
  // the dark the Zmory come from: beyond the walls, fading softly into the room
  const fog = (wallX: number, dir: 1 | -1) => {
    const x1 = wallX + dir * s * 2.4;
    const g = ctx.createLinearGradient(wallX - dir * s * 0.6, 0, x1, 0);
    g.addColorStop(0, `rgba(8,6,20,${0.82 * (1 - dawn * 0.6)})`);
    g.addColorStop(1, 'rgba(8,6,20,0)');
    ctx.fillStyle = g;
    if (dir > 0) ctx.fillRect(0, 0, Math.max(0, x1), h);
    else ctx.fillRect(x1, 0, Math.max(0, w - x1), h);
  };
  fog(cx - 6.3 * s, 1);
  fog(cx + 6.3 * s, -1);
  void t;
}

/** The window: its frame and the night sky (the trace is drawn inside by the HUD); the sill under it. */
export function paintWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, dawn: number, curtains: boolean): void {
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, dawn > 0 ? mixHex(C.skyDeep, '#f4b98a', dawn) : C.skyDeep);
  sky.addColorStop(1, dawn > 0 ? mixHex(C.sky, '#ffe0a8', dawn) : C.sky);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // far stars and the moon
  for (let i = 0; i < 26; i++) {
    const sx = x + hash(i * 3 + 11) * w, sy = y + hash(i * 7 + 5) * h;
    ctx.fillStyle = `rgba(255,248,220,${(0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + i))) * (1 - dawn)})`;
    ctx.fillRect(sx, sy, 1.3, 1.3);
  }
  const mr = Math.min(h * 0.22, 16);
  glow(ctx, x + w - mr * 2.2, y + mr * 1.8, mr * 3, 'rgba(246,239,208,', 0.25 * (1 - dawn));
  ctx.fillStyle = C.moon;
  ctx.globalAlpha = 1 - dawn * 0.7;
  ctx.beginPath();
  ctx.arc(x + w - mr * 2.2, y + mr * 1.8, mr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.skyDeep;
  ctx.beginPath();
  ctx.arc(x + w - mr * 1.75, y + mr * 1.55, mr * 0.85, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  // the frame and the cross bars
  ctx.strokeStyle = '#e9dcc0';
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  if (curtains) {
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x - 4 : x + w + 4;
      ctx.fillStyle = 'rgba(190,200,240,.85)';
      ctx.beginPath();
      ctx.moveTo(cx, y - 8);
      ctx.lineTo(cx - side * Math.min(30, w * 0.08), y - 8);
      ctx.quadraticCurveTo(cx - side * Math.min(18, w * 0.05), y + h * 0.5, cx - side * Math.min(26, w * 0.07), y + h + 6);
      ctx.lineTo(cx, y + h + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(cx - side * 10, y + h * (0.2 + k * 0.3), 3.5, 0, TAU);
        ctx.arc(cx - side * 14, y + h * (0.2 + k * 0.3) + 1, 3, 0, TAU);
        ctx.fill();
      }
    }
  }
}

/** The sill under the window: a wooden ledge. */
export function paintSill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = C.woodLight;
  ctx.beginPath();
  ctx.roundRect(x - 8, y, w + 16, h, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,20,10,.3)';
  ctx.fillRect(x - 8, y + h - 2, w + 16, 2);
}

function mixHex(a: string, b: string, k: number): string {
  const A = hex(a), B = hex(b);
  return rgb([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
}

/** The bedside table with the lamp (its warm glow is drawn by the view, additive). */
export function paintLamp(ctx: CanvasRenderingContext2D, x: number, floorY: number, s: number, on: number, book: boolean): { x: number; y: number } {
  // the table
  ctx.fillStyle = C.wood;
  ctx.fillRect(x - s * 0.36, floorY - s * 0.82, s * 0.72, s * 0.1);
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(x - s * 0.3, floorY - s * 0.72, s * 0.08, s * 0.72);
  ctx.fillRect(x + s * 0.22, floorY - s * 0.72, s * 0.08, s * 0.72);
  if (book) {
    ctx.fillStyle = '#5f8f8b';
    ctx.fillRect(x + s * 0.02, floorY - s * 0.9, s * 0.3, s * 0.08);
    ctx.fillStyle = '#e3b26a';
    ctx.fillRect(x + s * 0.04, floorY - s * 0.97, s * 0.26, s * 0.07);
  }
  // the lamp: a round base, a stem, a shade
  ctx.fillStyle = '#d9c7a6';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.12, floorY - s * 0.86, s * 0.13, s * 0.04, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - s * 0.14, floorY - s * 1.2, s * 0.04, s * 0.34);
  const sy = floorY - s * 1.42;
  ctx.fillStyle = on > 0.5 ? '#ffdf9e' : '#e7cf9a';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.32, sy + s * 0.24);
  ctx.lineTo(x + s * 0.08, sy + s * 0.24);
  ctx.lineTo(x - s * 0.02, sy);
  ctx.lineTo(x - s * 0.22, sy);
  ctx.closePath();
  ctx.fill();
  return { x: x - s * 0.12, y: sy + s * 0.16 };
}

/** The bed with the child asleep in it; `stir` 0..1 lifts the head a little; `breath` animates the quilt. */
export function paintBed(ctx: CanvasRenderingContext2D, cx: number, floorY: number, s: number, t: number, stir: number, starry: boolean): { headX: number; headY: number } {
  const x0 = cx - s * 1.0, x1 = cx + s * 1.0;
  const top = floorY - s * 0.62;
  // legs and frame
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(x0 + s * 0.05, floorY - s * 0.2, s * 0.1, s * 0.2);
  ctx.fillRect(x1 - s * 0.15, floorY - s * 0.2, s * 0.1, s * 0.2);
  ctx.fillStyle = C.wood;
  ctx.beginPath();
  ctx.roundRect(x0, floorY - s * 0.42, x1 - x0, s * 0.24, s * 0.05);
  ctx.fill();
  // the headboard (left), the footboard (right)
  ctx.fillStyle = C.woodLight;
  ctx.beginPath();
  ctx.moveTo(x0 - s * 0.12, floorY - s * 0.18);
  ctx.lineTo(x0 - s * 0.12, floorY - s * 1.18);
  ctx.quadraticCurveTo(x0 + s * 0.08, floorY - s * 1.38, x0 + s * 0.12, floorY - s * 1.18);
  ctx.lineTo(x0 + s * 0.12, floorY - s * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x1 - s * 0.1, floorY - s * 0.86, s * 0.2, s * 0.7, s * 0.06);
  ctx.fill();
  // the mattress and the sheet
  ctx.fillStyle = C.sheet;
  ctx.beginPath();
  ctx.roundRect(x0 + s * 0.08, top + s * 0.06, x1 - x0 - s * 0.16, s * 0.2, s * 0.06);
  ctx.fill();
  // the pillow
  const breath = Math.sin(t * 1.6) * 0.5 + 0.5;
  const headX = x0 + s * 0.42, headY = top - s * 0.1 - stir * s * 0.12;
  ctx.fillStyle = C.pillow;
  ctx.beginPath();
  ctx.ellipse(x0 + s * 0.4, top + s * 0.02, s * 0.32, s * 0.13, -0.08, 0, TAU);
  ctx.fill();
  // the child's head: hair, face, closed eyes, a blush
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.arc(headX - s * 0.04, headY - s * 0.02, s * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(headX + s * 0.03, headY + s * 0.02, s * 0.165, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.ellipse(headX - s * 0.02, headY - s * 0.11, s * 0.17, s * 0.08, -0.2, Math.PI, TAU);
  ctx.fill();
  ctx.strokeStyle = '#5a3a2a';
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(headX + s * 0.09, headY + s * 0.0, s * 0.04, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = C.cheek;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(headX + s * 0.1, headY + s * 0.08, s * 0.035, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  // the quilt, rising and falling with the breath
  const qy = top - s * 0.14 - breath * s * 0.03;
  ctx.fillStyle = C.quilt;
  ctx.beginPath();
  ctx.moveTo(x0 + s * 0.48, top + s * 0.22);
  ctx.quadraticCurveTo(x0 + s * 0.5, qy - s * 0.04, x0 + s * 0.85, qy);
  ctx.quadraticCurveTo(cx + s * 0.4, qy - s * 0.02 - breath * s * 0.02, x1 - s * 0.12, top + s * 0.02);
  ctx.lineTo(x1 - s * 0.08, top + s * 0.34);
  ctx.lineTo(x0 + s * 0.48, top + s * 0.34);
  ctx.closePath();
  ctx.fill();
  // patchwork squares, or stars on the blanket at a higher rank
  ctx.save();
  ctx.clip();
  if (starry) {
    for (let i = 0; i < 9; i++) paintStar(ctx, x0 + s * (0.6 + i * 0.16), top + s * (0.02 + (i % 2) * 0.14), s * 0.05, 0.9, C.goldLight);
  } else {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? C.quilt2 : C.quilt3;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x0 + s * (0.55 + i * 0.25), top - s * 0.1 + (i % 2) * s * 0.14, s * 0.2, s * 0.13);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // the quilt's fold over the edge
  ctx.fillStyle = C.quiltDark;
  ctx.fillRect(x0 + s * 0.48, top + s * 0.3, x1 - x0 - s * 0.56, s * 0.08);
  return { headX, headY };
}

// ── the angel ─────────────────────────────────────────────────────
export interface AngelPose {
  /** −1 faces left, +1 right; `swing` 0..1 the strike's sweep (1 = just struck) */
  face: number;
  swing: number;
  /** wings: the beat's phase, how wide (0..1) */
  beat: number;
  open: number;
  /** lowering to comfort the child (0..1); singing (0..1) */
  comfort: number;
  sing: number;
}

/** The angel: white robe, gold sash, layered wings of white and light, a soft light about the head. */
export function paintAngel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: AngelPose): void {
  const f = p.face >= 0 ? 1 : -1;
  ctx.save();
  ctx.translate(x, y);
  // the light about the angel
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, -s * 0.3, s * 1.6, C.light, 0.28 + 0.1 * p.sing);
  ctx.restore();
  // wings: behind the body, three layers of long feathers each side
  for (const side of [-1, 1]) {
    const lift = Math.sin(p.beat) * 0.12 + (side === f ? p.swing * 0.35 : -p.swing * 0.1);
    for (let layer = 2; layer >= 0; layer--) {
      ctx.fillStyle = layer === 0 ? C.angel : layer === 1 ? '#f2ecfa' : 'rgba(255,236,190,.9)';
      const len = s * (0.95 + layer * 0.22) * (0.75 + 0.25 * p.open);
      ctx.beginPath();
      ctx.moveTo(side * s * 0.12, -s * 0.55);
      const tipX = side * len, tipY = -s * (0.95 + lift + layer * 0.08);
      ctx.bezierCurveTo(side * s * 0.4, -s * (1.2 + lift), tipX * 0.8, tipY - s * 0.25, tipX, tipY);
      // the feathered trailing edge
      const n = 5;
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        const ex = tipX * (1 - k) + side * s * 0.15 * k;
        const ey = tipY + (s * (0.55 + layer * 0.12)) * Math.sin(k * Math.PI * 0.85) - s * 0.05;
        ctx.quadraticCurveTo(ex + side * s * 0.12, ey + s * 0.16, ex, ey + s * 0.06);
      }
      ctx.closePath();
      ctx.fill();
    }
    // a gold edge on the top line of the wing
    ctx.strokeStyle = 'rgba(245,201,106,.7)';
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(side * s * 0.15, -s * 0.6);
    ctx.quadraticCurveTo(side * s * 0.45, -s * (1.22 + lift), side * s * 0.9 * (0.75 + 0.25 * p.open), -s * (0.98 + lift));
    ctx.stroke();
  }
  // the robe: a long bell that fades into light at the hem
  const robe = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.75);
  robe.addColorStop(0, C.angel);
  robe.addColorStop(0.7, '#f4eefb');
  robe.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, -s * 0.62);
  ctx.quadraticCurveTo(-s * 0.32, s * 0.1, -s * 0.38, s * 0.75);
  ctx.quadraticCurveTo(0, s * 0.82, s * 0.38, s * 0.75);
  ctx.quadraticCurveTo(s * 0.32, s * 0.1, s * 0.16, -s * 0.62);
  ctx.closePath();
  ctx.fill();
  // folds
  ctx.strokeStyle = 'rgba(180,170,210,.35)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  for (const k of [-0.12, 0.05, 0.18]) {
    ctx.beginPath();
    ctx.moveTo(s * k * 0.6, -s * 0.2);
    ctx.quadraticCurveTo(s * k, s * 0.3, s * k * 1.4, s * 0.68);
    ctx.stroke();
  }
  // the gold sash
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.24);
  ctx.quadraticCurveTo(0, -s * 0.18, s * 0.2, -s * 0.24);
  ctx.lineTo(s * 0.21, -s * 0.16);
  ctx.quadraticCurveTo(0, -s * 0.1, -s * 0.21, -s * 0.16);
  ctx.closePath();
  ctx.fill();
  // the arm and the staff of light toward the struck side
  const sw = p.swing;
  const armA = f > 0 ? -0.9 + sw * 1.2 : Math.PI + 0.9 - sw * 1.2;
  const hx = Math.cos(armA) * s * 0.42, hy = -s * 0.42 + Math.sin(armA) * s * 0.3 + s * 0.12;
  ctx.strokeStyle = C.angelShade;
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(f * s * 0.08, -s * 0.48);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  // the other arm folded in toward the chest (in song, both hands together)
  ctx.beginPath();
  ctx.moveTo(-f * s * 0.08, -s * 0.48);
  ctx.lineTo(-f * s * 0.02, -s * 0.3 + p.sing * s * 0.02);
  ctx.stroke();
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.05, 0, TAU);
  ctx.fill();
  const staff = s * (0.7 + 0.25 * sw);
  const sa = f > 0 ? -1.15 + sw * 1.55 : Math.PI + 1.15 - sw * 1.55;
  ctx.save();
  ctx.globalAlpha = 1 - p.sing;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,236,170,${0.55 + 0.45 * sw})`;
  ctx.lineWidth = Math.max(1.5, s * (0.035 + 0.03 * sw));
  ctx.beginPath();
  ctx.moveTo(hx - Math.cos(sa) * staff * 0.25, hy - Math.sin(sa) * staff * 0.25);
  ctx.lineTo(hx + Math.cos(sa) * staff, hy + Math.sin(sa) * staff);
  ctx.stroke();
  glow(ctx, hx + Math.cos(sa) * staff, hy + Math.sin(sa) * staff, s * (0.2 + 0.25 * sw), C.light, 0.7);
  ctx.restore();
  // the head: a soft light behind, hair of gold, a calm face turned toward the side
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, -s * 0.84, s * 0.42, 'rgba(255,226,150,', 0.55);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,220,140,.65)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.84, s * 0.24, s * 0.24, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#f2d48a';
  ctx.beginPath();
  ctx.arc(-f * s * 0.02, -s * 0.86, s * 0.16, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(f * s * 0.03, -s * 0.83, s * 0.125, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2d48a';
  ctx.beginPath();
  ctx.ellipse(-f * s * 0.04, -s * 0.94, s * 0.14, s * 0.07, f * 0.3, Math.PI, TAU);
  ctx.fill();
  // eyes closed in song, open (two soft marks) in the watch
  ctx.strokeStyle = '#6a5040';
  ctx.lineWidth = Math.max(1, s * 0.018);
  ctx.beginPath();
  if (p.sing > 0.5) ctx.arc(f * s * 0.08, -s * 0.84, s * 0.03, 0.15 * Math.PI, 0.85 * Math.PI);
  else {
    ctx.moveTo(f * s * 0.07, -s * 0.85);
    ctx.lineTo(f * s * 0.07, -s * 0.82);
  }
  ctx.stroke();
  ctx.restore();
}

// ── the Zmory ─────────────────────────────────────────────────────
export interface ZPose {
  kind: ZKind;
  /** size (u) and the side it comes from (it faces the bed: −side) */
  r: number;
  side: number;
  /** 0..1 stepping out of the dark, the hit's flash, armour and its cracks, the light it took, inside the aura */
  emerge: number;
  hit: number;
  armoured: boolean;
  crack: number;
  burn: number;
  inAura: boolean;
  /** time (s) for the smoke's sway; a seed */
  t: number;
  id: number;
  /** leaving (drawing back into the dark) 0..1 faded */
  fade: number;
}

/** A Zmora: a body of ink with a smoky edge, a wisp tail, ember eyes toward the bed. */
export function paintZmora(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: ZPose): void {
  const a = Math.min(1, p.emerge) * (1 - p.fade);
  if (a <= 0.01) return;
  if (p.kind === 'roj') {
    for (let i = 0; i < 5; i++) {
      const ox = Math.sin(p.t * 3 + i * 1.7) * s * 0.18 + (i - 2) * s * 0.13;
      const oy = Math.cos(p.t * 2.4 + i) * s * 0.12 - (i % 2) * s * 0.18;
      paintZmora(ctx, x + ox, y + oy, s, { ...p, kind: 'cien', r: 0.17, id: p.id * 7 + i });
    }
    return;
  }
  const r = p.r * s;
  const face = -Math.sign(p.side) || 1;
  const sway = Math.sin(p.t * 2.2 + p.id) * 0.08;
  ctx.save();
  ctx.globalAlpha = a * (p.kind === 'widmo' ? 0.62 + 0.3 * Math.sin(p.t * 9 + p.id) ** 2 : 1);
  ctx.translate(x, y);
  // a soft shadow on the floor
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.1, r * 0.22, 0, 0, TAU);
  ctx.fill();
  const tall = p.kind === 'widmo' ? 1.7 : p.kind === 'koszmar' ? 1.55 : p.kind === 'pancerna' ? 1.15 : 1.3;
  const cy = -r * tall * 0.62;
  // the smoke tail streaming away from the bed
  ctx.fillStyle = C.smoke;
  for (let i = 0; i < 4; i++) {
    const k = i / 4;
    const tx = -face * r * (0.7 + k * 1.1);
    const ty = cy + Math.sin(p.t * 3 + i + p.id) * r * 0.25 - k * r * 0.2;
    ctx.globalAlpha = a * (0.55 - k * 0.12);
    ctx.beginPath();
    ctx.arc(tx, ty, r * (0.5 - k * 0.1), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = a;
  // the body: a hunched drop of ink with a wavering smoky edge
  ctx.fillStyle = p.hit > 0 ? '#5c4f8a' : C.ink;
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const ang = (i / n) * TAU;
    const wob = 1 + 0.09 * Math.sin(ang * 3 + p.t * 5 + p.id) + 0.05 * Math.sin(ang * 5 - p.t * 3);
    const rx = r * wob, ry = r * tall * 0.62 * wob;
    const px = Math.cos(ang) * rx + Math.sin(ang) * face * r * sway;
    const py = cy + Math.sin(ang) * ry * (ang > Math.PI ? 1.1 : 1);
    if (i === 0) ctx.moveTo(px, Math.min(py, 0));
    else ctx.lineTo(px, Math.min(py, 0));
  }
  ctx.closePath();
  ctx.fill();
  // wisps at the head (soft, never horns)
  ctx.strokeStyle = C.smokeLight;
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.lineCap = 'round';
  for (let i = 0; i < (p.kind === 'koszmar' ? 5 : 2); i++) {
    const bx = (i - 0.5) * r * 0.4;
    ctx.beginPath();
    ctx.moveTo(bx, cy - r * tall * 0.5);
    ctx.quadraticCurveTo(bx - face * r * 0.3, cy - r * tall * 0.8 + Math.sin(p.t * 4 + i) * r * 0.1, bx - face * r * 0.55, cy - r * tall * 0.7);
    ctx.stroke();
  }
  // armour of shadow: a slate shell over the head and back, its seams lit as the aura cracks it
  if (p.kind === 'pancerna' && (p.armoured || p.crack > 0)) {
    const sh = cy - r * tall * 0.15;
    ctx.fillStyle = p.armoured ? '#4b4a63' : 'rgba(75,74,99,.35)';
    ctx.strokeStyle = p.armoured ? '#8a87ad' : 'rgba(138,135,173,.4)';
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-face * r * 1.05, sh + r * 0.35);
    ctx.quadraticCurveTo(-face * r * 1.1, cy - r * tall * 0.75, face * r * 0.15, cy - r * tall * 0.68);
    ctx.quadraticCurveTo(face * r * 0.75, cy - r * tall * 0.6, face * r * 0.78, sh - r * 0.05);
    ctx.lineTo(face * r * 0.52, sh + r * 0.02);
    ctx.quadraticCurveTo(face * r * 0.05, sh - r * 0.18, -face * r * 0.45, sh + r * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // the shell's ridge plates
    ctx.strokeStyle = p.armoured ? 'rgba(160,156,200,.55)' : 'rgba(160,156,200,.2)';
    for (let i = 0; i < 3; i++) {
      const a = -0.4 + i * 0.45;
      ctx.beginPath();
      ctx.moveTo(-face * r * (0.75 - i * 0.35), cy - r * tall * (0.62 - 0.02 * i));
      ctx.quadraticCurveTo(-face * r * (0.6 - i * 0.35) + face * r * a * 0.2, cy - r * tall * 0.3, -face * r * (0.55 - i * 0.4), sh + r * 0.2);
      ctx.stroke();
    }
    if (p.crack > 0) {
      const c = Math.min(1, p.crack);
      ctx.strokeStyle = `rgba(255,232,160,${0.45 + 0.55 * c})`;
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(face * r * 0.1, cy - r * tall * 0.68);
      ctx.lineTo(-face * r * 0.05, cy - r * tall * 0.4);
      ctx.lineTo(face * r * 0.15, cy - r * tall * (0.4 - 0.25 * c));
      if (c > 0.45) {
        ctx.moveTo(-face * r * 0.05, cy - r * tall * 0.4);
        ctx.lineTo(-face * r * 0.45, cy - r * tall * 0.2);
      }
      ctx.stroke();
    }
  }
  // the light the aura has poured in: a pale glow eating the ink
  if (p.burn > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, face * r * 0.2, cy, r * 1.2, 'rgba(255,226,150,', Math.min(0.6, p.burn * 0.6));
    ctx.restore();
  }
  // ember eyes toward the bed
  const ex = face * r * 0.35, ey = cy - r * tall * 0.12;
  const eyeR = Math.max(1.2, r * (p.kind === 'koszmar' ? 0.11 : 0.13));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, ex, ey, eyeR * 5, 'rgba(255,138,61,', 0.5);
  ctx.restore();
  for (const k of [-1, 1]) {
    ctx.fillStyle = C.ember;
    ctx.beginPath();
    ctx.ellipse(ex + k * r * 0.17, ey, eyeR, eyeR * 0.75, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.emberHot;
    ctx.beginPath();
    ctx.arc(ex + k * r * 0.17 + face * eyeR * 0.25, ey - eyeR * 0.2, eyeR * 0.4, 0, TAU);
    ctx.fill();
  }
  // the aura's slowing: a ring of light around the feet
  if (p.inAura) {
    ctx.strokeStyle = 'rgba(255,236,170,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.25, r * 0.3, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// ── the gifts' pictures ───────────────────────────────────────────
export function paintGiftIcon(ctx: CanvasRenderingContext2D, id: GiftId, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, 0, r * 1.5, C.light, 0.35);
  ctx.restore();
  ctx.strokeStyle = C.goldDeep;
  ctx.fillStyle = C.gold;
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.lineCap = 'round';
  switch (id) {
    case 'reach':
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, 0);
      ctx.lineTo(r * 0.8, 0);
      ctx.moveTo(r * 0.45, -r * 0.35);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(r * 0.45, r * 0.35);
      ctx.moveTo(-r * 0.45, -r * 0.35);
      ctx.lineTo(-r * 0.8, 0);
      ctx.lineTo(-r * 0.45, r * 0.35);
      ctx.stroke();
      break;
    case 'double':
      for (const o of [-0.25, 0.25]) {
        ctx.beginPath();
        ctx.arc(o * r, 0, r * 0.6, -1.1, 1.1);
        ctx.stroke();
      }
      break;
    case 'shield':
      paintFeather(ctx, -r * 0.3, 0, r * 0.75, -0.5);
      paintFeather(ctx, r * 0.3, 0, r * 0.75, 0.5);
      paintFeather(ctx, 0, -r * 0.1, r * 0.8, 0);
      break;
    case 'aura':
      for (const k of [0.35, 0.65, 0.95]) {
        ctx.globalAlpha = 1.2 - k;
        ctx.beginPath();
        ctx.arc(0, 0, r * k, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    case 'spear':
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, r * 0.5);
      ctx.lineTo(r * 0.7, -r * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.95, -r * 0.55);
      ctx.lineTo(r * 0.5, -r * 0.5);
      ctx.lineTo(r * 0.75, -r * 0.18);
      ctx.closePath();
      ctx.fill();
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.bezierCurveTo(r * 0.7, -r * 0.2, r * 0.55, r * 0.7, 0, r * 0.75);
      ctx.bezierCurveTo(-r * 0.55, r * 0.7, -r * 0.7, -r * 0.2, 0, -r * 0.9);
      ctx.fill();
      ctx.fillStyle = C.goldLight;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.25, r * 0.22, r * 0.38, 0, 0, TAU);
      ctx.fill();
      break;
    case 'lamp':
      ctx.fillStyle = '#ffdf9e';
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, 0);
      ctx.lineTo(r * 0.55, 0);
      ctx.lineTo(r * 0.3, -r * 0.6);
      ctx.lineTo(-r * 0.3, -r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-r * 0.06, 0, r * 0.12, r * 0.55);
      ctx.fillRect(-r * 0.35, r * 0.55, r * 0.7, r * 0.12);
      break;
    case 'sen':
      ctx.fillStyle = 'rgba(190,210,255,.9)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, TAU);
      ctx.fill();
      paintStar(ctx, -r * 0.2, -r * 0.1, r * 0.25, 1);
      paintStar(ctx, r * 0.25, r * 0.15, r * 0.18, 1);
      break;
  }
  ctx.restore();
}

// ── the room's cosy things (the lobby's tiles and the room) ───────
export function paintRoomItem(ctx: CanvasRenderingContext2D, item: RoomItem, x: number, y: number, r: number, t = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  switch (item) {
    case 'mobile': {
      ctx.strokeStyle = '#d9c7a6';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(0, -r * 0.6);
      ctx.moveTo(-r * 0.8, -r * 0.6);
      ctx.lineTo(r * 0.8, -r * 0.6);
      ctx.stroke();
      [-0.75, -0.25, 0.25, 0.75].forEach((k, i) => {
        const yy = -r * 0.2 + (i % 2) * r * 0.3 + Math.sin(t * 1.2 + i) * r * 0.05;
        ctx.beginPath();
        ctx.moveTo(k * r, -r * 0.6);
        ctx.lineTo(k * r, yy);
        ctx.stroke();
        if (i % 2) {
          ctx.fillStyle = C.moon;
          ctx.beginPath();
          ctx.arc(k * r, yy + r * 0.15, r * 0.14, 0, TAU);
          ctx.fill();
        } else paintStar(ctx, k * r, yy + r * 0.15, r * 0.18, 1, C.gold);
      });
      break;
    }
    case 'nightlight': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, 0, r * 1.4, 'rgba(255,214,140,', 0.35);
      ctx.restore();
      ctx.fillStyle = '#ffe3a0';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(59,58,114,.9)';
      ctx.beginPath();
      ctx.arc(r * 0.22, -r * 0.12, r * 0.45, 0, TAU);
      ctx.fill();
      break;
    }
    case 'book':
      ctx.fillStyle = '#5f8f8b';
      ctx.fillRect(-r * 0.7, -r * 0.2, r * 1.4, r * 0.35);
      ctx.fillStyle = '#c97b84';
      ctx.fillRect(-r * 0.6, -r * 0.55, r * 1.2, r * 0.35);
      ctx.fillStyle = C.paper;
      ctx.fillRect(-r * 0.55, -r * 0.5, r * 0.06, r * 0.25);
      break;
    case 'blanket':
      ctx.fillStyle = '#3d5aa0';
      ctx.beginPath();
      ctx.roundRect(-r * 0.8, -r * 0.5, r * 1.6, r, r * 0.15);
      ctx.fill();
      for (let i = 0; i < 5; i++) paintStar(ctx, -r * 0.55 + i * r * 0.28, -r * 0.2 + (i % 2) * r * 0.35, r * 0.12, 1, C.goldLight);
      break;
    case 'bear':
      ctx.fillStyle = '#b07a4f';
      ctx.beginPath();
      ctx.arc(0, r * 0.25, r * 0.48, 0, TAU);
      ctx.arc(0, -r * 0.38, r * 0.34, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.27, -r * 0.65, r * 0.12, 0, TAU);
      ctx.arc(r * 0.27, -r * 0.65, r * 0.12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e3c39a';
      ctx.beginPath();
      ctx.arc(0, -r * 0.3, r * 0.14, 0, TAU);
      ctx.arc(0, r * 0.3, r * 0.25, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3a2418';
      ctx.beginPath();
      ctx.arc(-r * 0.12, -r * 0.45, r * 0.04, 0, TAU);
      ctx.arc(r * 0.12, -r * 0.45, r * 0.04, 0, TAU);
      ctx.fill();
      break;
    case 'curtain':
      ctx.fillStyle = 'rgba(190,200,240,.95)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.8);
      ctx.lineTo(r * 0.8, -r * 0.8);
      ctx.quadraticCurveTo(r * 0.3, 0, r * 0.6, r * 0.8);
      ctx.lineTo(-r * 0.6, r * 0.8);
      ctx.quadraticCurveTo(-r * 0.3, 0, -r * 0.8, -r * 0.8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 0.2, r * 0.16, 0, TAU);
      ctx.arc(r * 0.12, -r * 0.18, r * 0.13, 0, TAU);
      ctx.fill();
      break;
    case 'garland':
      ctx.strokeStyle = '#7d7aa0';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.3);
      ctx.quadraticCurveTo(0, r * 0.4, r, -r * 0.3);
      ctx.stroke();
      ['#ffcf7a', '#c97b84', '#7fa7e0', '#ffcf7a', '#9fd3a8'].forEach((c, i) => {
        const k = (i + 0.5) / 5;
        const xx = -r + k * 2 * r;
        const yy = -r * 0.3 + Math.sin(k * Math.PI) * r * 0.35;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, xx, yy + r * 0.1, r * 0.3, 'rgba(255,214,140,', 0.3 + 0.2 * Math.sin(t * 2 + i));
        ctx.restore();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(xx, yy + r * 0.1, r * 0.09, 0, TAU);
        ctx.fill();
      });
      break;
  }
  ctx.restore();
}

/** A lobby tile: the cosy thing on a night-blue card, or its silhouette not yet earned. */
export function paintRoomTile(ctx: CanvasRenderingContext2D, w: number, h: number, item: RoomItem, own: boolean): void {
  ctx.fillStyle = own ? C.wall : '#2a2a40';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 6);
  ctx.fill();
  if (own) paintRoomItem(ctx, item, w / 2, h / 2 + 2, Math.min(w, h) * 0.36, 0.5);
  else {
    // a silhouette until its rank: the thing under a veil of the card's colour
    paintRoomItem(ctx, item, w / 2, h / 2 + 2, Math.min(w, h) * 0.36, 0.5);
    ctx.fillStyle = 'rgba(42,42,64,.78)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();
  }
}
