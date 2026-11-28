/**
 * Stop-klatka's places (DESIGN.md §28): every place of the contract's `PLACES` drawn in code, seen through the eyes in
 * one-point perspective (paint.ts `Cam`: metres in, px out) — a classroom, a corridor, a bedroom, a kitchen, a living
 * room, a bus, a street, a car, an office, a meeting room, a shop, a counter's queue, a clinic's waiting room, a park,
 * a gym and a phone held in the hands.  Each has a background (`back`, behind the people) and a foreground (`front`, in
 * front of them: the player's desk, the car's dashboard, the counter's glass), both baked once per size by scene.ts.
 * The same painters draw the observer's view when the camera steps out of the eyes (the camera's `dx`, `dz`, `E`).
 *
 * The palette is gouache: muted warm walls, a window's light, soft shadows; no text on any sign (every language).
 */
import type { Place } from './story';
import { type Cam, P, box, ellipse, hash, mix, poly, quad, rgba, shade, soft } from './paint';

/** Where the eye is and where the person facing the player stands. */
export interface PlaceCfg {
  /** the eye's height (m): seated or standing */
  E: number;
  /** the distance the lens is framed for (m) and where the main person stands (m) */
  fZ: number;
  Z0: number;
  /** the main person's head height (m): standing 1.62, seated lower */
  headH: number;
}

export const PLACE_CFG: Readonly<Record<Place, PlaceCfg>> = {
  classroom: { E: 1.2, fZ: 2.1, Z0: 2.3, headH: 1.62 },
  corridor: { E: 1.6, fZ: 1.9, Z0: 1.9, headH: 1.62 },
  bedroom: { E: 1.15, fZ: 1.8, Z0: 1.8, headH: 1.62 },
  kitchen: { E: 1.6, fZ: 1.8, Z0: 1.8, headH: 1.62 },
  living: { E: 1.1, fZ: 2.0, Z0: 2.1, headH: 1.62 },
  bus: { E: 1.25, fZ: 1.7, Z0: 1.7, headH: 1.62 },
  street: { E: 1.6, fZ: 2.0, Z0: 2.0, headH: 1.62 },
  car: { E: 1.15, fZ: 1.7, Z0: 4.4, headH: 1.62 },
  office: { E: 1.2, fZ: 1.8, Z0: 1.8, headH: 1.62 },
  meeting: { E: 1.2, fZ: 2.0, Z0: 2.4, headH: 1.28 },
  shop: { E: 1.6, fZ: 1.9, Z0: 1.9, headH: 1.62 },
  queue: { E: 1.6, fZ: 2.0, Z0: 2.45, headH: 1.42 },
  clinic: { E: 1.15, fZ: 2.0, Z0: 2.0, headH: 1.62 },
  park: { E: 1.6, fZ: 2.0, Z0: 2.0, headH: 1.62 },
  gym: { E: 1.6, fZ: 2.1, Z0: 2.1, headH: 1.62 },
  screen: { E: 1.15, fZ: 1.8, Z0: 1.8, headH: 1.62 },
};

type Painter = (ctx: CanvasRenderingContext2D, c: Cam) => void;

interface RoomSpec { W: number; H: number; D: number; wall: string; left: string; right: string; floor: string; ceil: string }

/** A room's shell: the ceiling, the floor, the side walls and the back wall, with the light falling softly. */
function room(ctx: CanvasRenderingContext2D, c: Cam, o: RoomSpec): void {
  const hw = o.W / 2, n = 0.3;
  quad(ctx, c, [[-hw, o.H, n], [hw, o.H, n], [hw, o.H, o.D], [-hw, o.H, o.D]], o.ceil);
  const fl = ctx.createLinearGradient(0, P(c, 0, 0, o.D)[1], 0, c.h);
  fl.addColorStop(0, shade(o.floor, 0.05));
  fl.addColorStop(1, shade(o.floor, -0.08));
  quad(ctx, c, [[-hw, 0, n], [hw, 0, n], [hw, 0, o.D], [-hw, 0, o.D]], fl);
  quad(ctx, c, [[-hw, 0, n], [-hw, 0, o.D], [-hw, o.H, o.D], [-hw, o.H, n]], o.left);
  quad(ctx, c, [[hw, 0, n], [hw, 0, o.D], [hw, o.H, o.D], [hw, o.H, n]], o.right);
  quad(ctx, c, [[-hw, 0, o.D], [hw, 0, o.D], [hw, o.H, o.D], [-hw, o.H, o.D]], o.wall);
  // the skirting along the walls' foot
  const sk = shade(o.wall, 0.3);
  quad(ctx, c, [[-hw, 0, o.D], [hw, 0, o.D], [hw, 0.08, o.D], [-hw, 0.08, o.D]], sk);
  quad(ctx, c, [[-hw, 0, n], [-hw, 0, o.D], [-hw, 0.08, o.D], [-hw, 0.08, n]], shade(o.left, 0.3));
  quad(ctx, c, [[hw, 0, n], [hw, 0, o.D], [hw, 0.08, o.D], [hw, 0.08, n]], shade(o.right, 0.3));
}

/** A window on the back wall (x0..x1, y0..y1) with a sky and a soft light around it. */
function backWindow(ctx: CanvasRenderingContext2D, c: Cam, D: number, x0: number, x1: number, y0: number, y1: number, sky: [string, string], frame = '#f3ede2'): void {
  const [a, b] = [P(c, x0, y1, D), P(c, x1, y0, D)];
  soft(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) * 1.1, '#fff3d6', 0.35);
  quad(ctx, c, [[x0 - 0.06, y0 - 0.06, D], [x1 + 0.06, y0 - 0.06, D], [x1 + 0.06, y1 + 0.06, D], [x0 - 0.06, y1 + 0.06, D]], frame);
  const g = ctx.createLinearGradient(0, a[1], 0, b[1]);
  g.addColorStop(0, sky[0]);
  g.addColorStop(1, sky[1]);
  quad(ctx, c, [[x0, y0, D], [x1, y0, D], [x1, y1, D], [x0, y1, D]], g);
  const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  quad(ctx, c, [[xm - 0.025, y0, D], [xm + 0.025, y0, D], [xm + 0.025, y1, D], [xm - 0.025, y1, D]], frame);
  quad(ctx, c, [[x0, ym - 0.025, D], [x1, ym - 0.025, D], [x1, ym + 0.025, D], [x0, ym + 0.025, D]], frame);
}

/** A window on a side wall (X = ±hw) from z0 to z1. */
function sideWindow(ctx: CanvasRenderingContext2D, c: Cam, X: number, z0: number, z1: number, y0: number, y1: number, sky: string, frame = '#f3ede2'): void {
  quad(ctx, c, [[X, y0 - 0.05, z0 - 0.05], [X, y0 - 0.05, z1 + 0.05], [X, y1 + 0.05, z1 + 0.05], [X, y1 + 0.05, z0 - 0.05]], frame);
  quad(ctx, c, [[X, y0, z0], [X, y0, z1], [X, y1, z1], [X, y1, z0]], sky);
  const zm = (z0 + z1) / 2;
  quad(ctx, c, [[X, y0, zm - 0.03], [X, y0, zm + 0.03], [X, y1, zm + 0.03], [X, y1, zm - 0.03]], frame);
}

/** A light pool on the floor. */
function pool(ctx: CanvasRenderingContext2D, c: Cam, X: number, Z: number, r: number, col = '#fff1cf', a = 0.28): void {
  const [x, y] = P(c, X, 0, Z);
  const rx = (c.f * r) / Math.max(0.1, Z + c.dz);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.32);
  soft(ctx, 0, 0, rx, col, a);
  ctx.restore();
}

/** A ceiling lamp: a soft panel. */
function lamp(ctx: CanvasRenderingContext2D, c: Cam, X: number, H: number, Z: number, w = 0.9, d = 0.3): void {
  quad(ctx, c, [[X - w / 2, H - 0.01, Z], [X + w / 2, H - 0.01, Z], [X + w / 2, H - 0.01, Z + d], [X - w / 2, H - 0.01, Z + d]], '#fffaf0');
}

/** A soft shadow under a thing standing on the floor. */
function foot(ctx: CanvasRenderingContext2D, c: Cam, X: number, Z: number, r: number): void {
  const [x, y] = P(c, X, 0, Z);
  const rx = (c.f * r) / Math.max(0.1, Z + c.dz);
  ellipse(ctx, x, y, rx, rx * 0.25, 'rgba(40,26,20,0.16)');
}

/** A sky with a horizon's haze. */
function sky(ctx: CanvasRenderingContext2D, c: Cam, top: string, low: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, c.hy);
  g.addColorStop(0, top);
  g.addColorStop(1, low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.w, Math.max(1, c.hy + 2));
}

/** A tree's round crown on a trunk (X, Z), height h (m). */
function tree(ctx: CanvasRenderingContext2D, c: Cam, X: number, Z: number, h: number, col: string): void {
  const [x0, y0] = P(c, X, 0, Z);
  const [, y1] = P(c, X, h * 0.55, Z);
  const s = c.f / Math.max(0.1, Z + c.dz);
  foot(ctx, c, X, Z, h * 0.35);
  ctx.fillStyle = '#6b4f3a';
  ctx.fillRect(x0 - s * 0.08, y1, s * 0.16, y0 - y1);
  const [, yc] = P(c, X, h * 0.75, Z);
  ellipse(ctx, x0, yc, s * h * 0.32, s * h * 0.3, col);
  ellipse(ctx, x0 - s * h * 0.12, yc - s * h * 0.08, s * h * 0.2, s * h * 0.17, shade(col, -0.18));
  ellipse(ctx, x0 + s * h * 0.14, yc + s * h * 0.08, s * h * 0.2, s * h * 0.16, shade(col, 0.15));
}

// ── the places ────────────────────────────────────────────────────

const classroom: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 8, H: 3.1, D: 7.5, wall: '#d4dcc6', left: '#c8d2bb', right: '#bcc6ae', floor: '#bb8f62', ceil: '#ece7da' };
  room(ctx, c, R);
  for (const z of [1.6, 3.4, 5.2]) sideWindow(ctx, c, -4, z, z + 1.2, 0.9, 2.5, '#d7ebf3');
  for (const z of [1.6, 3.4, 5.2]) pool(ctx, c, -2.6, z + 0.6, 1.1, '#fff4d8', 0.32);
  // the board and its chalk
  quad(ctx, c, [[-1.95, 0.95, 7.49], [1.95, 0.95, 7.49], [1.95, 2.3, 7.49], [-1.95, 2.3, 7.49]], '#a88158');
  quad(ctx, c, [[-1.85, 1.02, 7.48], [1.85, 1.02, 7.48], [1.85, 2.22, 7.48], [-1.85, 2.22, 7.48]], '#30503f');
  ctx.strokeStyle = 'rgba(240,240,225,0.55)';
  ctx.lineWidth = Math.max(1, c.f * 0.012 / 7.5);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = P(c, -1.6, 2.0 - i * 0.22, 7.47);
    const [bx] = P(c, -0.2 + hash(i) * 1.2, 2.0, 7.47);
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, ay + hash(i + 3) * 2);
  }
  ctx.stroke();
  quad(ctx, c, [[-1.9, 0.93, 7.4], [1.9, 0.93, 7.4], [1.9, 0.98, 7.49], [-1.9, 0.98, 7.49]], '#d8c4a4');
  // the clock high on the wall
  const [kx, ky] = P(c, 2.6, 2.5, 7.49);
  const kr = (c.f * 0.2) / (7.49 + c.dz);
  ellipse(ctx, kx, ky, kr, kr, '#f8f4ea');
  ctx.strokeStyle = '#3a302a';
  ctx.lineWidth = Math.max(1, kr * 0.12);
  ctx.beginPath();
  ctx.arc(kx, ky, kr, 0, Math.PI * 2);
  ctx.moveTo(kx, ky);
  ctx.lineTo(kx + kr * 0.5, ky - kr * 0.3);
  ctx.moveTo(kx, ky);
  ctx.lineTo(kx, ky - kr * 0.75);
  ctx.stroke();
  for (const z of [2.2, 4.4, 6.2]) lamp(ctx, c, 0, 3.1, z, 1.4, 0.25);
  // the teacher's desk, then the rows of desks on both sides of the aisle (far first)
  box(ctx, c, 0.4, 1.9, 0, 0.78, 6.4, 7.0, '#9c6f4a');
  for (const z of [6.0, 4.8, 3.6, 2.6]) {
    for (const [a, b] of [[-3.2, -1.9], [-1.6, -0.6], [0.6, 1.6], [1.9, 3.2]] as const) {
      foot(ctx, c, (a + b) / 2, z + 0.3, 0.6);
      box(ctx, c, a, b, 0.68, 0.74, z, z + 0.55, '#d9b98c');
      box(ctx, c, a + 0.05, a + 0.1, 0, 0.68, z + 0.05, z + 0.1, '#6f6a66');
      box(ctx, c, b - 0.1, b - 0.05, 0, 0.68, z + 0.05, z + 0.1, '#6f6a66');
    }
  }
};

const corridor: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 3.2, H: 3, D: 16, wall: '#f2ead8', left: '#e7dcc4', right: '#ddd1b8', floor: '#c9b79a', ceil: '#efe9dc' };
  room(ctx, c, R);
  // the painted lower band on the walls
  quad(ctx, c, [[-1.6, 0.08, 0.3], [-1.6, 0.08, 16], [-1.6, 1.15, 16], [-1.6, 1.15, 0.3]], '#a9bdb3');
  quad(ctx, c, [[1.6, 0.08, 0.3], [1.6, 0.08, 16], [1.6, 1.15, 16], [1.6, 1.15, 0.3]], '#9cb2a7');
  backWindow(ctx, c, 16, -1.0, 1.0, 0.9, 2.5, ['#f6f1df', '#e6eef0']);
  soft(ctx, P(c, 0, 1.6, 16)[0], P(c, 0, 1.6, 16)[1], (c.f * 3) / (16 + c.dz), '#fff6e0', 0.5);
  // the floor's tiles
  ctx.strokeStyle = 'rgba(120,98,70,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let z = 1; z < 16; z += 1) {
    const [a, y] = P(c, -1.6, 0, z), [b] = P(c, 1.6, 0, z);
    ctx.moveTo(a, y);
    ctx.lineTo(b, y);
  }
  for (const x of [-0.8, 0, 0.8]) {
    const [a, ya] = P(c, x, 0, 0.4), [b, yb] = P(c, x, 0, 16);
    ctx.moveTo(a, ya);
    ctx.lineTo(b, yb);
  }
  ctx.stroke();
  // lockers along both walls
  const cols = ['#5f86a3', '#e0a458', '#7aa77a', '#c46e5c'];
  for (const s of [-1, 1]) {
    for (let z = 2.6, i = 0; z < 11; z += 0.48, i++) {
      const X = s * 1.59;
      const col = cols[(Math.floor(i / 4) + (s > 0 ? 2 : 0)) % cols.length];
      quad(ctx, c, [[X, 0.1, z], [X, 0.1, z + 0.46], [X, 1.9, z + 0.46], [X, 1.9, z]], i % 2 ? col : shade(col, 0.06));
      const [hx, hy] = P(c, X, 1.0, z + 0.36);
      ellipse(ctx, hx, hy, Math.max(0.8, (c.f * 0.02) / (z + c.dz)), Math.max(1, (c.f * 0.04) / (z + c.dz)), '#2f2f33');
    }
  }
  for (const z of [3, 6, 9, 12]) lamp(ctx, c, 0, 3, z, 0.8, 0.4);
  for (const z of [3.5, 6.5, 9.5, 12.5]) pool(ctx, c, 0, z, 0.9, '#fff8e8', 0.3);
};

const bedroom: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 4.2, H: 2.6, D: 4.0, wall: '#dccbd4', left: '#d2c0ca', right: '#c9b6c1', floor: '#a7856b', ceil: '#e8dde3' };
  room(ctx, c, R);
  backWindow(ctx, c, 4, -1.7, -0.45, 1.0, 2.05, ['#6f6ca6', '#f1b98e'], '#efe6ea');
  pool(ctx, c, -1.0, 3.0, 1.0, '#ffd9b0', 0.3);
  // a poster and a shelf
  quad(ctx, c, [[0.35, 1.25, 3.99], [1.0, 1.25, 3.99], [1.0, 2.05, 3.99], [0.35, 2.05, 3.99]], '#f0d9a8');
  quad(ctx, c, [[0.42, 1.33, 3.98], [0.93, 1.33, 3.98], [0.93, 1.97, 3.98], [0.42, 1.97, 3.98]], '#7aa4b8');
  ellipse(ctx, P(c, 0.68, 1.75, 3.97)[0], P(c, 0.68, 1.75, 3.97)[1], (c.f * 0.12) / (4 + c.dz), (c.f * 0.12) / (4 + c.dz), '#f5c96f');
  // the desk and its lamp on the right
  box(ctx, c, 1.05, 2.05, 0.72, 0.78, 3.1, 3.85, '#b88a5e');
  box(ctx, c, 1.1, 1.16, 0, 0.72, 3.15, 3.2, '#8a6a4a');
  box(ctx, c, 1.95, 2.0, 0, 0.72, 3.15, 3.2, '#8a6a4a');
  const [lx, ly] = P(c, 1.75, 1.1, 3.5);
  soft(ctx, lx, ly, (c.f * 0.9) / (3.5 + c.dz), '#ffd98a', 0.45);
  box(ctx, c, 1.62, 1.88, 1.0, 1.14, 3.4, 3.6, '#f2d27a');
  box(ctx, c, 1.73, 1.77, 0.78, 1.0, 3.48, 3.52, '#5a4a3a');
};

const kitchen: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 4.6, H: 2.7, D: 4.4, wall: '#f1e3c4', left: '#e8d8b6', right: '#dfcea9', floor: '#c4a77f', ceil: '#f6efe0' };
  room(ctx, c, R);
  // the tiles behind the counter
  quad(ctx, c, [[-2.3, 0.9, 4.39], [1.2, 0.9, 4.39], [1.2, 1.5, 4.39], [-2.3, 1.5, 4.39]], '#e4eeea');
  ctx.strokeStyle = 'rgba(120,140,136,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -2.3; x <= 1.2; x += 0.2) { const [a, ya] = P(c, x, 0.9, 4.38), [, yb] = P(c, x, 1.5, 4.38); ctx.moveTo(a, ya); ctx.lineTo(a, yb); }
  for (let y = 0.9; y <= 1.5; y += 0.15) { const [a, ya] = P(c, -2.3, y, 4.38), [b] = P(c, 1.2, y, 4.38); ctx.moveTo(a, ya); ctx.lineTo(b, ya); }
  ctx.stroke();
  backWindow(ctx, c, 4.38, -1.5, -0.3, 1.2, 2.0, ['#cfe5ef', '#f6f0dc']);
  // the upper cabinets
  for (const [a, b] of [[-2.3, -1.6], [-0.2, 0.45], [0.45, 1.2]] as const) box(ctx, c, a, b, 1.6, 2.35, 4.05, 4.4, '#d8b48a');
  // the counter with its top and the sink
  box(ctx, c, -2.3, 1.2, 0, 0.88, 3.8, 4.4, '#b9845a');
  box(ctx, c, -2.3, 1.2, 0.88, 0.93, 3.75, 4.4, '#ece4d6');
  quad(ctx, c, [[-1.3, 0.931, 3.85], [-0.5, 0.931, 3.85], [-0.5, 0.931, 4.25], [-1.3, 0.931, 4.25]], '#b9c4c8');
  // the fridge
  box(ctx, c, 1.35, 2.25, 0, 1.95, 3.55, 4.3, '#e3e8ea');
  box(ctx, c, 1.4, 1.43, 1.0, 1.5, 3.53, 3.55, '#9aa3a8');
  pool(ctx, c, -0.9, 3.2, 1.2, '#fff4d6', 0.3);
};

const living: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 5, H: 2.7, D: 5, wall: '#d9cfb6', left: '#cfc3a8', right: '#c7ba9e', floor: '#9c7a5c', ceil: '#ebe4d6' };
  room(ctx, c, R);
  // a picture on the wall and a standing lamp
  quad(ctx, c, [[-0.7, 1.45, 4.99], [0.7, 1.45, 4.99], [0.7, 2.15, 4.99], [-0.7, 2.15, 4.99]], '#e9dcc2');
  quad(ctx, c, [[-0.62, 1.52, 4.98], [0.62, 1.52, 4.98], [0.62, 2.08, 4.98], [-0.62, 2.08, 4.98]], '#9db7a6');
  poly(ctx, [P(c, -0.62, 1.52, 4.97), P(c, -0.1, 1.9, 4.97), P(c, 0.25, 1.62, 4.97), P(c, 0.62, 1.95, 4.97), P(c, 0.62, 1.52, 4.97)], '#6f9180');
  const [lx, ly] = P(c, 2.0, 1.55, 4.5);
  soft(ctx, lx, ly, (c.f * 1.3) / (4.5 + c.dz), '#ffd790', 0.5);
  box(ctx, c, 1.97, 2.03, 0, 1.45, 4.45, 4.5, '#4a3e34');
  box(ctx, c, 1.82, 2.18, 1.45, 1.75, 4.35, 4.6, '#f3d79a');
  // the rug and the sofa against the wall
  quad(ctx, c, [[-1.8, 0.01, 1.6], [1.8, 0.01, 1.6], [1.8, 0.01, 4.2], [-1.8, 0.01, 4.2]], '#b96d5a');
  quad(ctx, c, [[-1.6, 0.012, 1.8], [1.6, 0.012, 1.8], [1.6, 0.012, 4.0], [-1.6, 0.012, 4.0]], '#c77e68');
  box(ctx, c, -1.7, 1.7, 0.4, 0.95, 4.55, 4.95, '#5d7d8c');
  box(ctx, c, -1.7, 1.7, 0, 0.45, 4.1, 4.95, '#6a8a99');
  box(ctx, c, -1.85, -1.55, 0, 0.7, 4.1, 4.95, '#55717f');
  box(ctx, c, 1.55, 1.85, 0, 0.7, 4.1, 4.95, '#55717f');
  // the television on the left wall, glowing
  quad(ctx, c, [[-2.49, 0.95, 2.2], [-2.49, 0.95, 3.4], [-2.49, 1.65, 3.4], [-2.49, 1.65, 2.2]], '#22262c');
  quad(ctx, c, [[-2.48, 1.0, 2.26], [-2.48, 1.0, 3.34], [-2.48, 1.6, 3.34], [-2.48, 1.6, 2.26]], '#5a7fa8');
  const [tx, ty] = P(c, -2.3, 1.3, 2.8);
  soft(ctx, tx, ty, (c.f * 1.0) / (2.8 + c.dz), '#9cc8f0', 0.25);
};

const bus: Painter = (ctx, c) => {
  const W = 2.5, H = 2.3, D = 11;
  room(ctx, c, { W, H, D, wall: '#d8d2c4', left: '#cfc7b6', right: '#c6bead', floor: '#6c6f73', ceil: '#e5e1d6' });
  // the windows along both sides, the street sliding past
  for (const s of [-1, 1]) {
    const X = s * W / 2;
    for (let z = 1.2; z < 10; z += 1.6) {
      const g = ctx.createLinearGradient(0, P(c, X, 1.9, z)[1], 0, P(c, X, 0.95, z)[1]);
      g.addColorStop(0, '#bcd6e3');
      g.addColorStop(1, '#e9dfc9');
      quad(ctx, c, [[X, 0.95, z], [X, 0.95, z + 1.45], [X, 1.9, z + 1.45], [X, 1.9, z]], g);
      for (let k = 0; k < 3; k++) {
        const zz = z + 0.2 + k * 0.42;
        const hgt = 1.2 + hash(Math.round(z * 10) + k * 7 + (s > 0 ? 50 : 0)) * 0.6;
        quad(ctx, c, [[X, 0.95, zz], [X, 0.95, zz + 0.36], [X, Math.min(1.9, hgt), zz + 0.36], [X, Math.min(1.9, hgt), zz]], k % 2 ? '#c9b49c' : '#a9b8a0');
      }
    }
  }
  backWindow(ctx, c, D, -0.9, 0.9, 0.9, 1.9, ['#c6dde8', '#efe4cc'], '#cfc7b6');
  // the yellow strip and the seats (blue backs) both sides
  quad(ctx, c, [[-0.06, 0.005, 0.5], [0.06, 0.005, 0.5], [0.06, 0.005, D], [-0.06, 0.005, D]], '#d7b84a');
  for (const z of [9.4, 8.0, 6.6, 5.2, 3.8, 2.4]) {
    for (const s of [-1, 1]) {
      const a = s < 0 ? -1.2 : 0.45, b = s < 0 ? -0.45 : 1.2;
      box(ctx, c, a, b, 0.42, 0.48, z - 0.45, z, '#3d6aa6');
      box(ctx, c, a, b, 0.48, 1.1, z, z + 0.1, '#365f96');
    }
  }
  // the poles
  for (const [X, Z] of [[-0.42, 2.0], [0.42, 3.4], [-0.42, 5.4], [0.42, 7.2]] as const) {
    const [x0, y0] = P(c, X, 0, Z), [, y1] = P(c, X, H, Z);
    ctx.fillStyle = '#e2b934';
    const wd = Math.max(1.5, (c.f * 0.04) / (Z + c.dz));
    ctx.fillRect(x0 - wd / 2, y1, wd, y0 - y1);
  }
  for (const z of [2, 5, 8]) lamp(ctx, c, 0, H, z, 0.5, 0.8);
};

const street: Painter = (ctx, c) => {
  sky(ctx, c, '#a9cbe0', '#f4e4c8');
  const far = 60;
  // the ground: the pavement under the feet, the crossing, the street on
  quad(ctx, c, [[-30, 0, 0.3], [30, 0, 0.3], [30, 0, far], [-30, 0, far]], '#c9c1b4');
  quad(ctx, c, [[-3.2, 0.002, 4.2], [3.2, 0.002, 4.2], [3.2, 0.002, far], [-3.2, 0.002, far]], '#77716b');
  quad(ctx, c, [[-30, 0.002, 4.2], [30, 0.002, 4.2], [30, 0.002, 9], [-30, 0.002, 9]], '#77716b');
  for (let x = -3; x < 3; x += 0.9) quad(ctx, c, [[x, 0.004, 4.6], [x + 0.5, 0.004, 4.6], [x + 0.5, 0.004, 8.6], [x, 0.004, 8.6]], '#ece8de');
  quad(ctx, c, [[2.2, 0.003, 9], [3.0, 0.003, 9], [3.0, 0.003, far], [2.2, 0.003, far]], '#b65a4a');
  quad(ctx, c, [[-30, 0, 4.0], [30, 0, 4.0], [30, 0.12, 4.0], [-30, 0.12, 4.0]], '#a39a8c');
  // the façades on both sides, shop fronts with awnings
  const facades = ['#e2b48c', '#c9d1b2', '#d9a6a0', '#a9bcd0', '#e8d3a2', '#bfa8c8'];
  for (const s of [-1, 1]) {
    const X = s * 5.2;
    for (let z = 9.5, i = 0; z < 50; z += 6, i++) {
      const col = facades[(i + (s > 0 ? 3 : 0)) % facades.length];
      const top = 9 + hash(i * 3 + (s > 0 ? 11 : 0)) * 6;
      quad(ctx, c, [[X, 0, z], [X, 0, z + 6], [X, top, z + 6], [X, top, z]], s < 0 ? col : shade(col, 0.1));
      quad(ctx, c, [[X, 0.1, z + 0.6], [X, 0.1, z + 5.2], [X, 2.4, z + 5.2], [X, 2.4, z + 0.6]], '#3a4048');
      quad(ctx, c, [[X, 2.4, z + 0.5], [X - s * 0.9, 2.1, z + 0.5], [X - s * 0.9, 2.1, z + 5.3], [X, 2.4, z + 5.3]], i % 2 ? '#c4553f' : '#3f7a6a');
      for (let fl = 0; fl < 3; fl++) for (let k = 0; k < 3; k++) {
        const zz = z + 0.8 + k * 1.7, yy = 3.4 + fl * 2.0;
        if (yy + 1.2 > top) continue;
        quad(ctx, c, [[X, yy, zz], [X, yy, zz + 0.9], [X, yy + 1.2, zz + 0.9], [X, yy + 1.2, zz]], '#e9eef0');
      }
    }
  }
  // the far end: a row of houses
  quad(ctx, c, [[-5.2, 0, 50], [5.2, 0, 50], [5.2, 11, 50], [-5.2, 11, 50]], '#d7c4a6');
  // the near corner buildings at the crossing's far side
  for (const s of [-1, 1]) quad(ctx, c, [[s * 5.2, 0, 9.4], [s * 30, 0, 9.4], [s * 30, 14, 9.4], [s * 5.2, 14, 9.4]], s < 0 ? '#e6c79e' : '#c7cfb2');
  tree(ctx, c, -4.2, 3.2, 5.2, '#7fa46a');
  tree(ctx, c, 4.4, 2.6, 4.8, '#6f9a5e');
  // a street lamp
  const [lx, ly0] = P(c, 3.6, 0, 6), [, ly1] = P(c, 3.6, 4.2, 6);
  ctx.fillStyle = '#3e4146';
  ctx.fillRect(lx - Math.max(1, c.f * 0.05 / (6 + c.dz)), ly1, Math.max(2, c.f * 0.1 / (6 + c.dz)), ly0 - ly1);
};

const office: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 10, H: 3, D: 12, wall: '#e4e2da', left: '#dbd8cf', right: '#d2cfc6', floor: '#8e9aa3', ceil: '#f2f1ec' };
  room(ctx, c, R);
  // the city through the back windows
  backWindow(ctx, c, 11.99, -4.6, 4.6, 0.8, 2.7, ['#b9d4e6', '#f3e7cf'], '#d9dbd8');
  for (let i = 0; i < 9; i++) {
    const x = -4.4 + i * 1.0, hgt = 1.2 + hash(i + 40) * 1.2;
    quad(ctx, c, [[x, 0.8, 11.98], [x + 0.8, 0.8, 11.98], [x + 0.8, 0.8 + hgt, 11.98], [x, 0.8 + hgt, 11.98]], i % 2 ? '#a7b3bf' : '#9aa8b5');
  }
  for (let z = 2; z < 12; z += 2.4) for (const x of [-2.5, 0, 2.5]) lamp(ctx, c, x, 3, z, 1.0, 0.6);
  // the desks in rows with their screens and a plant
  for (const z of [9.5, 7.5, 5.5, 3.8]) {
    for (const [a, b] of [[-4.4, -1.2], [1.2, 4.4]] as const) {
      foot(ctx, c, (a + b) / 2, z + 0.4, 1.4);
      box(ctx, c, a, b, 0.72, 0.76, z, z + 0.8, '#f3f2ee');
      for (let x = a + 0.3; x < b - 0.4; x += 1.05) box(ctx, c, x, x + 0.55, 0.78, 1.12, z + 0.35, z + 0.4, '#2b3038');
    }
  }
  const [px, py] = P(c, 4.2, 0.9, 3.0);
  ellipse(ctx, px, py, (c.f * 0.4) / (3 + c.dz), (c.f * 0.45) / (3 + c.dz), '#5e8b5a');
  box(ctx, c, 4.0, 4.4, 0, 0.5, 2.8, 3.2, '#c9a27a');
};

const meeting: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 5.5, H: 2.8, D: 6, wall: '#e7e3d8', left: '#ddd8cb', right: '#d4cfc1', floor: '#9a8e84', ceil: '#f3f0e8' };
  room(ctx, c, R);
  sideWindow(ctx, c, 2.75, 1.2, 4.8, 0.8, 2.4, '#d3e6ef', '#dcd8cf');
  pool(ctx, c, 1.6, 3.0, 1.6, '#fff5dc', 0.3);
  // the screen with a chart
  quad(ctx, c, [[-1.25, 1.0, 5.99], [1.25, 1.0, 5.99], [1.25, 2.05, 5.99], [-1.25, 2.05, 5.99]], '#2a2f36');
  quad(ctx, c, [[-1.18, 1.06, 5.98], [1.18, 1.06, 5.98], [1.18, 1.99, 5.98], [-1.18, 1.99, 5.98]], '#eef2f5');
  for (let i = 0; i < 5; i++) {
    const x = -0.95 + i * 0.4, hgt = 0.2 + hash(i + 60) * 0.55;
    quad(ctx, c, [[x, 1.15, 5.97], [x + 0.24, 1.15, 5.97], [x + 0.24, 1.15 + hgt, 5.97], [x, 1.15 + hgt, 5.97]], i === 3 ? '#e08a4a' : '#6f9ab8');
  }
  // chairs along the table and the long table
  for (const z of [4.6, 3.4, 2.2]) for (const s of [-1, 1]) box(ctx, c, s < 0 ? -1.55 : 1.05, s < 0 ? -1.05 : 1.55, 0.45, 1.1, z, z + 0.12, '#3f4650');
  box(ctx, c, -0.95, 0.95, 0.72, 0.77, 0.5, 5.0, '#c9a47a');
  box(ctx, c, -0.1, 0.1, 0, 0.72, 2.6, 2.8, '#7a6a5a');
};

const shop: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 2.8, H: 3, D: 14, wall: '#efe9dd', left: '#e2dccf', right: '#d8d2c4', floor: '#dcd6c9', ceil: '#f4f1ea' };
  room(ctx, c, R);
  const goods = ['#d9534f', '#f0ad4e', '#5cb85c', '#5bc0de', '#f7e1a0', '#a77bca', '#e8805b', '#7fb3d5'];
  for (const s of [-1, 1]) {
    const X = s * 1.39;
    quad(ctx, c, [[X, 0, 0.6], [X, 0, 12], [X, 2.1, 12], [X, 2.1, 0.6]], '#c9c2b4');
    for (let row = 0; row < 5; row++) {
      const y = 0.15 + row * 0.4;
      quad(ctx, c, [[X, y, 0.6], [X, y, 12], [X, y + 0.04, 12], [X, y + 0.04, 0.6]], '#9a9184');
      for (let z = 0.8, k = 0; z < 11.8; z += 0.32, k++) {
        const col = goods[(k + row * 3 + (s > 0 ? 4 : 0)) % goods.length];
        quad(ctx, c, [[X - s * 0.02, y + 0.05, z], [X - s * 0.02, y + 0.05, z + 0.26], [X - s * 0.02, y + 0.33, z + 0.26], [X - s * 0.02, y + 0.33, z]], col);
      }
    }
  }
  quad(ctx, c, [[-1.4, 2.3, 13.99], [1.4, 2.3, 13.99], [1.4, 2.8, 13.99], [-1.4, 2.8, 13.99]], '#3f7a6a');
  for (let z = 2; z < 14; z += 2.5) lamp(ctx, c, 0, 3, z, 0.4, 1.4);
  ctx.save();
  ctx.globalAlpha = 0.25;
  for (let z = 2; z < 14; z += 2.5) pool(ctx, c, 0, z + 0.7, 0.7, '#ffffff', 0.6);
  ctx.restore();
};

const queue: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 6, H: 3, D: 3.8, wall: '#dfe3e2', left: '#d4d9d7', right: '#cbd1ce', floor: '#b5b9b4', ceil: '#eef0ee' };
  room(ctx, c, R);
  // the number display on the wall
  quad(ctx, c, [[0.9, 2.2, 3.79], [2.1, 2.2, 3.79], [2.1, 2.65, 3.79], [0.9, 2.65, 3.79]], '#23272c');
  for (let i = 0; i < 4; i++) quad(ctx, c, [[1.0 + i * 0.27, 2.3, 3.78], [1.2 + i * 0.27, 2.3, 3.78], [1.2 + i * 0.27, 2.55, 3.78], [1.0 + i * 0.27, 2.55, 3.78]], i === 0 ? '#ff9a3d' : '#ff6a3d');
  // a notice board and a plant
  quad(ctx, c, [[-2.4, 1.3, 3.79], [-1.5, 1.3, 3.79], [-1.5, 2.1, 3.79], [-2.4, 2.1, 3.79]], '#c9a77a');
  for (let i = 0; i < 4; i++) quad(ctx, c, [[-2.3 + (i % 2) * 0.42, 1.4 + Math.floor(i / 2) * 0.35, 3.78], [-2.0 + (i % 2) * 0.42, 1.4 + Math.floor(i / 2) * 0.35, 3.78], [-2.0 + (i % 2) * 0.42, 1.68 + Math.floor(i / 2) * 0.35, 3.78], [-2.3 + (i % 2) * 0.42, 1.68 + Math.floor(i / 2) * 0.35, 3.78]], '#f6f3ea');
  // behind the counter: a desk and a shelf of files
  box(ctx, c, -2.2, 2.2, 0.7, 0.75, 3.2, 3.7, '#a89a84');
  for (let i = 0; i < 10; i++) quad(ctx, c, [[-2.2 + i * 0.12, 1.5, 3.78], [-2.12 + i * 0.12, 1.5, 3.78], [-2.12 + i * 0.12, 1.85, 3.78], [-2.2 + i * 0.12, 1.85, 3.78]], ['#6f8fb0', '#c4774a', '#d8c27a', '#7aa07a'][i % 4]);
  for (const z of [1.2, 2.6]) lamp(ctx, c, 0, 3, z, 1.4, 0.3);
};

const clinic: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 6, H: 2.8, D: 6, wall: '#dfeae6', left: '#d4e0dc', right: '#cbd8d3', floor: '#c8c2b6', ceil: '#f0f3f1' };
  room(ctx, c, R);
  // the doctor's door and the number display over it
  quad(ctx, c, [[-0.55, 0, 5.99], [0.55, 0, 5.99], [0.55, 2.05, 5.99], [-0.55, 2.05, 5.99]], '#b98a5e');
  quad(ctx, c, [[-0.45, 0.1, 5.98], [0.45, 0.1, 5.98], [0.45, 1.95, 5.98], [-0.45, 1.95, 5.98]], '#c99a6e');
  ellipse(ctx, P(c, 0.35, 1.0, 5.97)[0], P(c, 0.35, 1.0, 5.97)[1], Math.max(1, (c.f * 0.04) / (6 + c.dz)), Math.max(1, (c.f * 0.04) / (6 + c.dz)), '#e2d6b4');
  quad(ctx, c, [[-0.4, 2.15, 5.99], [0.4, 2.15, 5.99], [0.4, 2.5, 5.99], [-0.4, 2.5, 5.99]], '#23272c');
  quad(ctx, c, [[-0.3, 2.22, 5.98], [0.3, 2.22, 5.98], [0.3, 2.43, 5.98], [-0.3, 2.43, 5.98]], '#7fe0a8');
  // a poster, a plant
  quad(ctx, c, [[1.3, 1.2, 5.99], [2.1, 1.2, 5.99], [2.1, 2.2, 5.99], [1.3, 2.2, 5.99]], '#f4efe2');
  ellipse(ctx, P(c, 1.7, 1.8, 5.98)[0], P(c, 1.7, 1.8, 5.98)[1], (c.f * 0.22) / (6 + c.dz), (c.f * 0.22) / (6 + c.dz), '#8fc0b0');
  const [px, py] = P(c, -2.6, 0.95, 5.4);
  ellipse(ctx, px, py, (c.f * 0.45) / (5.4 + c.dz), (c.f * 0.5) / (5.4 + c.dz), '#5e8b5a');
  box(ctx, c, -2.8, -2.4, 0, 0.5, 5.2, 5.6, '#e6dccb');
  // rows of chairs along both side walls
  for (const s of [-1, 1]) {
    for (let z = 1.4; z < 5.4; z += 0.62) {
      const a = s < 0 ? -2.95 : 2.4, b = s < 0 ? -2.4 : 2.95;
      box(ctx, c, a, b, 0.42, 0.47, z, z + 0.5, '#6d9fb0');
      box(ctx, c, s < 0 ? -2.98 : 2.88, s < 0 ? -2.88 : 2.98, 0.47, 0.95, z, z + 0.5, '#5d8fa0');
    }
  }
  for (const z of [1.8, 4.0]) lamp(ctx, c, 0, 2.8, z, 1.2, 0.35);
};

const park: Painter = (ctx, c) => {
  sky(ctx, c, '#b8d8ea', '#f6ecd4');
  // distant hills of trees along the horizon
  const far = 80;
  quad(ctx, c, [[-80, 0, 0.3], [80, 0, 0.3], [80, 0, far], [-80, 0, far]], '#9cc27a');
  for (let i = 0; i < 14; i++) {
    const X = -40 + i * 6.2 + hash(i) * 3, Z = 30 + hash(i + 9) * 25;
    const [x, y] = P(c, X, 0, Z);
    const s = c.f / (Z + c.dz);
    ellipse(ctx, x, y - s * 2, s * (2.6 + hash(i + 2) * 1.8), s * (2.2 + hash(i + 4) * 1.2), i % 3 ? '#7fa46a' : '#6c955e');
  }
  // the path running away
  quad(ctx, c, [[-0.9, 0.002, 0.3], [0.9, 0.002, 0.3], [0.5, 0.002, 30], [-0.3, 0.002, 30]], '#e2d3b4');
  // a playground at the side: a swing's frame
  const sw = (X: number, Z: number): void => {
    ctx.strokeStyle = '#c4553f';
    ctx.lineWidth = Math.max(1.5, (c.f * 0.06) / (Z + c.dz));
    const [a0, a1] = [P(c, X - 1, 0, Z), P(c, X - 0.6, 2.2, Z)], [b0, b1] = [P(c, X + 1, 0, Z), P(c, X + 0.6, 2.2, Z)];
    ctx.beginPath();
    ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(b0[0], b0[1]);
    ctx.stroke();
    ctx.strokeStyle = '#5a5048';
    ctx.lineWidth = 1;
    const [s0, s1] = [P(c, X, 2.2, Z), P(c, X, 0.6, Z)];
    ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
  };
  sw(-5.5, 11);
  tree(ctx, c, -4.2, 9, 4.6, '#6f9a5e');
  tree(ctx, c, 5.2, 12, 5, '#7fa46a');
  tree(ctx, c, -9, 18, 6, '#6c955e');
  // a bench on the right
  box(ctx, c, 1.6, 3.0, 0.42, 0.48, 3.6, 4.0, '#8a6a4a');
  box(ctx, c, 1.6, 3.0, 0.5, 0.9, 4.0, 4.05, '#7a5a3a');
  pool(ctx, c, 0.2, 4, 3, '#fff6d6', 0.25);
};

const gym: Painter = (ctx, c) => {
  const R: RoomSpec = { W: 12, H: 6, D: 14, wall: '#e8dcc0', left: '#ddd0b2', right: '#d4c6a8', floor: '#d6a86c', ceil: '#eee6d4' };
  room(ctx, c, R);
  for (const z of [2, 5, 8, 11]) sideWindow(ctx, c, -6, z, z + 2, 3.8, 5.4, '#dcecf2');
  // the wall bars on the back wall
  for (let x = -5.6; x < 5.7; x += 0.9) {
    quad(ctx, c, [[x, 0, 13.99], [x + 0.08, 0, 13.99], [x + 0.08, 2.6, 13.99], [x, 2.6, 13.99]], '#b98a5a');
    for (let y = 0.3; y < 2.6; y += 0.3) quad(ctx, c, [[x + 0.08, y, 13.98], [x + 0.82, y, 13.98], [x + 0.82, y + 0.04, 13.98], [x + 0.08, y + 0.04, 13.98]], '#c99a6a');
  }
  // the court's lines and the mats
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const x of [-4.5, 4.5]) { const [a, ya] = P(c, x, 0.003, 0.5), [b, yb] = P(c, x, 0.003, 13.5); ctx.moveTo(a, ya); ctx.lineTo(b, yb); }
  for (const z of [7, 13.5]) { const [a, ya] = P(c, -4.5, 0.003, z), [b] = P(c, 4.5, 0.003, z); ctx.moveTo(a, ya); ctx.lineTo(b, ya); }
  ctx.stroke();
  for (const z of [4, 6.2]) box(ctx, c, -5.6, -3.8, 0, 0.1, z, z + 1.8, '#4f74a8');
  // the hoop
  quad(ctx, c, [[-0.7, 2.9, 13.95], [0.7, 2.9, 13.95], [0.7, 3.8, 13.95], [-0.7, 3.8, 13.95]], '#f4f1ea');
  ellipse(ctx, P(c, 0, 3.05, 13.6)[0], P(c, 0, 3.05, 13.6)[1], (c.f * 0.25) / (13.6 + c.dz), (c.f * 0.06) / (13.6 + c.dz), 'rgba(0,0,0,0)');
  ctx.strokeStyle = '#d9603a';
  ctx.lineWidth = Math.max(1, (c.f * 0.03) / (13.6 + c.dz));
  ctx.beginPath();
  ctx.ellipse(P(c, 0, 3.05, 13.6)[0], P(c, 0, 3.05, 13.6)[1], (c.f * 0.25) / (13.6 + c.dz), (c.f * 0.07) / (13.6 + c.dz), 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let z = 2; z < 14; z += 3) for (const x of [-3, 0, 3]) lamp(ctx, c, x, 6, z, 0.8, 0.3);
};

const car: Painter = (ctx, c) => {
  sky(ctx, c, '#a9c9de', '#f1e2c8');
  const far = 120;
  quad(ctx, c, [[-60, 0, 0.3], [60, 0, 0.3], [60, 0, far], [-60, 0, far]], '#a9b48a');
  quad(ctx, c, [[-4.2, 0.002, 0.3], [4.2, 0.002, 0.3], [4.2, 0.002, far], [-4.2, 0.002, far]], '#6f6b68');
  for (let z = 3; z < 80; z += 6) quad(ctx, c, [[1.48, 0.004, z], [1.62, 0.004, z], [1.62, 0.004, z + 3], [1.48, 0.004, z + 3]], '#efe9d8');
  for (const s of [-1, 1]) quad(ctx, c, [[s * 4.0, 0.004, 0.3], [s * 4.1, 0.004, 0.3], [s * 4.1, 0.004, far], [s * 4.0, 0.004, far]], '#f2ecdc');
  for (let i = 0; i < 10; i++) tree(ctx, c, (i % 2 ? 1 : -1) * (7 + hash(i) * 4), 12 + i * 9, 5 + hash(i + 3) * 3, i % 3 ? '#7fa46a' : '#6c955e');
  // the car ahead: its back, tail lights and plate
  const Z = 9, X = 0;
  box(ctx, c, X - 0.85, X + 0.85, 0.3, 0.95, Z, Z + 3, '#7d8fa6');
  box(ctx, c, X - 0.7, X + 0.7, 0.95, 1.4, Z + 0.6, Z + 2.2, '#6d7f96');
  quad(ctx, c, [[X - 0.6, 1.0, Z + 0.59], [X + 0.6, 1.0, Z + 0.59], [X + 0.6, 1.35, Z + 0.59], [X - 0.6, 1.35, Z + 0.59]], '#33404e');
  for (const s of [-1, 1]) quad(ctx, c, [[X + s * 0.8, 0.65, Z - 0.01], [X + s * 0.55, 0.65, Z - 0.01], [X + s * 0.55, 0.8, Z - 0.01], [X + s * 0.8, 0.8, Z - 0.01]], '#e0473a');
  quad(ctx, c, [[X - 0.25, 0.42, Z - 0.01], [X + 0.25, 0.42, Z - 0.01], [X + 0.25, 0.54, Z - 0.01], [X - 0.25, 0.54, Z - 0.01]], '#f2f0e8');
  foot(ctx, c, X, Z + 1.5, 1.2);
};

const screenPlace: Painter = (ctx, c) => {
  // a room at night behind the phone, out of focus: dark walls, a lamp's warm glow, a window's blue
  const g = ctx.createLinearGradient(0, 0, 0, c.h);
  g.addColorStop(0, '#2a3048');
  g.addColorStop(1, '#3b3442');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.w, c.h);
  soft(ctx, c.w * 0.82, c.hy - c.h * 0.05, Math.max(c.w, c.h) * 0.45, '#ffc977', 0.35);
  soft(ctx, c.w * 0.15, c.hy - c.h * 0.15, Math.max(c.w, c.h) * 0.3, '#7d9be0', 0.25);
  ctx.fillStyle = 'rgba(20,18,28,0.35)';
  ctx.fillRect(0, c.hy + c.h * 0.18, c.w, c.h);
};

/** Each place's background painter. */
export const BACK: Readonly<Record<Place, Painter>> = {
  classroom, corridor, bedroom, kitchen, living, bus, street, car, office, meeting, shop, queue, clinic, park, gym, screen: screenPlace,
};

// ── the foregrounds (in front of the people) ──────────────────────

const yourDesk: Painter = (ctx, c) => {
  box(ctx, c, -0.62, 0.62, 0.68, 0.74, 0.42, 0.98, '#dcbc8e');
  // a notebook and a pencil on it
  quad(ctx, c, [[-0.36, 0.745, 0.55], [0.06, 0.745, 0.55], [0.06, 0.745, 0.85], [-0.36, 0.745, 0.85]], '#f6f1e4');
  quad(ctx, c, [[0.14, 0.746, 0.6], [0.4, 0.746, 0.78], [0.41, 0.746, 0.76], [0.15, 0.746, 0.58]], '#e7b84a');
};

const kitchenFront: Painter = (ctx, c) => {
  box(ctx, c, -1.1, 1.1, 0.72, 0.77, 0.55, 1.2, '#b98656');
};

const livingFront: Painter = (ctx, c) => {
  box(ctx, c, -0.75, 0.75, 0.38, 0.43, 0.75, 1.25, '#8b6748');
  // a cup on the low table
  const [x, y] = P(c, 0.4, 0.43, 0.95);
  const s = c.f / (0.95 + c.dz);
  ctx.fillStyle = '#f2ede4';
  ctx.fillRect(x - s * 0.04, y - s * 0.09, s * 0.08, s * 0.09);
};

const officeFront: Painter = (ctx, c) => {
  box(ctx, c, -0.9, 0.9, 0.7, 0.74, 0.38, 0.95, '#f1efe9');
  // the keyboard and the edge of the player's own screen at the side
  box(ctx, c, -0.25, 0.25, 0.74, 0.76, 0.5, 0.66, '#3a3f46');
  box(ctx, c, -0.88, -0.45, 0.76, 1.15, 0.8, 0.84, '#2b3038');
};

const meetingFront: Painter = (ctx, c) => {
  // the papers in front of the player
  quad(ctx, c, [[-0.3, 0.771, 0.6], [0.15, 0.771, 0.6], [0.18, 0.771, 0.95], [-0.27, 0.771, 0.95]], '#f7f4ec');
};

const shopFront: Painter = (ctx, c) => {
  // the checkout belt and its terminal on the right
  box(ctx, c, 0.32, 1.25, 0, 0.82, 0.6, 2.2, '#bfb7a8');
  box(ctx, c, 0.4, 1.17, 0.82, 0.86, 0.6, 2.2, '#2e3136');
  box(ctx, c, 0.36, 0.5, 0.86, 1.06, 1.2, 1.3, '#4a4f57');
};

const queueFront: Painter = (ctx, c) => {
  // the counter with its glass; the clerk sits behind it
  box(ctx, c, -2.6, 2.6, 0, 1.0, 2.0, 2.25, '#b8a98e');
  box(ctx, c, -2.6, 2.6, 1.0, 1.05, 1.92, 2.25, '#d7ccb7');
  const g = ctx.createLinearGradient(0, P(c, 0, 2.15, 2.1)[1], 0, P(c, 0, 1.05, 2.1)[1]);
  g.addColorStop(0, 'rgba(210,232,240,0.26)');
  g.addColorStop(1, 'rgba(210,232,240,0.1)');
  quad(ctx, c, [[-2.6, 1.05, 2.1], [2.6, 1.05, 2.1], [2.6, 2.15, 2.1], [-2.6, 2.15, 2.1]], g);
  for (const x of [-2.6, -1.1, 1.1, 2.6]) quad(ctx, c, [[x - 0.03, 1.05, 2.1], [x + 0.03, 1.05, 2.1], [x + 0.03, 2.15, 2.1], [x - 0.03, 2.15, 2.1]], '#9aa3a8');
  quad(ctx, c, [[-0.45, 1.07, 2.09], [0.45, 1.07, 2.09], [0.45, 1.18, 2.09], [-0.45, 1.18, 2.09]], 'rgba(40,40,44,0.35)');
  // a glint on the glass
  ctx.save();
  ctx.globalAlpha = 0.18;
  poly(ctx, [P(c, -2.2, 2.1, 2.1), P(c, -1.7, 2.1, 2.1), P(c, -2.3, 1.15, 2.1), P(c, -2.55, 1.15, 2.1)], '#ffffff');
  ctx.restore();
  // the heads of the people ahead in the queue (backs, out of focus)
  for (const [X, Z, col] of [[-1.2, 1.3, '#3f2a20'], [1.35, 1.55, '#a9a49e']] as const) {
    const [x, y] = P(c, X, 1.62, Z);
    const r = (c.f * 0.12) / (Z + c.dz);
    ellipse(ctx, x, y + r * 3.2, r * 2.0, r * 2.2, X < 0 ? '#5d6f86' : '#9a6a52');
    ellipse(ctx, x, y, r * 0.95, r * 1.05, col);
  }
};

/** The place's foreground, in front of the people (none: nothing). */
export const FRONT: Readonly<Partial<Record<Place, Painter>>> = {
  classroom: yourDesk, kitchen: kitchenFront, living: livingFront, office: officeFront, meeting: meetingFront, shop: shopFront, queue: queueFront,
};

/** Each place's light for the people in it: a warm or a cool cast and how strong (a soft overlay on the figures). */
export const LIGHT: Readonly<Record<Place, [string, number]>> = {
  classroom: ['#fff1d0', 0.06], corridor: ['#fff6e4', 0.04], bedroom: ['#ffb98a', 0.1], kitchen: ['#fff0cc', 0.05], living: ['#ffcf8a', 0.08],
  bus: ['#e8f0f4', 0.04], street: ['#ffe7c4', 0.05], car: ['#fff0d6', 0.04], office: ['#eef4f8', 0.04], meeting: ['#f6f4ee', 0.03],
  shop: ['#ffffff', 0.04], queue: ['#eef2ef', 0.04], clinic: ['#eaf5f1', 0.05], park: ['#fff2cc', 0.06], gym: ['#fff0d0', 0.05],
  screen: ['#6f7fb8', 0.16],
};

/** A colour for the sky-tint of a place's people when the light is cast. */
export const castOf = (p: Place): string => mix(LIGHT[p][0], '#ffffff', 0.2);
export { rgba };
