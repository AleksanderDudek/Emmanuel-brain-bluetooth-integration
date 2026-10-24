/**
 * Latarnik's drawing primitives (Canvas 2D, no assets), shared by the play view, the calibration
 * intro and the lobby preview: the sea drawn as a nautical chart's isolines, the island with its
 * fishing village and the striped lighthouse seen from above, the boats' paper-cut silhouettes,
 * and amber pieces with their inclusions.  Everything is drawn in CSS pixels.  What a frame draws
 * again and again (gradients, dash patterns, paths, amber) is made once and found by numbers, so
 * a frame leaves no garbage behind.
 */
import type { Inclusion } from './content';
import type { BoatKind } from './sim';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';

/** The palette: ink to navy sea, gold to coral light, teal glow, honey amber. */
export const C = {
  ink: '#050a18', navy: '#0b1630', sea: '#0d1a38', gold: '#ffd27a', coral: '#ff7a59', cream: '#ffe9a8', teal: '#3de0c8',
  honey: '#ffb020', text: '#efe8dc', muted: 'rgba(239,232,220,.62)', line: '#86a2e6',
  hull: '#1d2944', deck: '#2b3a5c', rim: 'rgba(160,184,236,.42)', warm: '#f2dcae',
} as const;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** A solid line for setLineDash. */
export const NO_DASH: number[] = [];

// ── gradients made once ──────────────────────────────────────────
/** What each kept gradient is (its kind), with up to three numbers of its geometry. */
const G_SHALLOWS = 1, G_SAND = 2, G_TOWER = 3, G_BAND = 4, G_BANK = 5, G_AMBER = 6, G_GLINT = 7;

interface Kept { kind: number; a: number; b: number; c: number; g: CanvasGradient }
const kept = new WeakMap<CanvasRenderingContext2D, Kept[]>();

/** A gradient made earlier on this context for this kind and geometry (null: not yet). */
function found(ctx: CanvasRenderingContext2D, kind: number, a: number, b: number, c: number): CanvasGradient | null {
  const list = kept.get(ctx);
  if (list) {
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (k.kind === kind && k.a === a && k.b === b && k.c === c) return k.g;
    }
  }
  return null;
}

function keep(ctx: CanvasRenderingContext2D, kind: number, a: number, b: number, c: number, g: CanvasGradient): CanvasGradient {
  let list = kept.get(ctx);
  if (!list) kept.set(ctx, (list = []));
  if (list.length >= 64) list.shift();
  list.push({ kind, a, b, c, g });
  return g;
}

/** Stable pseudo-random numbers for decorations (the same every frame). */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── the sea ──────────────────────────────────────────────────────
const SEG = 120;
const COS = new Float32Array(SEG + 1), SIN = new Float32Array(SEG + 1);
for (let i = 0; i <= SEG; i++) {
  COS[i] = Math.cos((i / SEG) * TAU);
  SIN[i] = Math.sin((i / SEG) * TAU);
}

const CONTOURS = 60;
const isoDashes = new Map<number, number[][]>();

/** Each contour's broken-line pattern for a sea of radius R (made once per size). */
function contourDashes(R: number): number[][] {
  let d = isoDashes.get(R);
  if (!d) {
    d = [];
    for (let k = 0; k < CONTOURS; k++) {
      const seg = R * (0.18 + 0.2 * hash(k));
      d.push([seg, seg * (0.12 + 0.35 * hash(k + 9))]);
    }
    if (isoDashes.size > 4) isoDashes.clear();
    isoDashes.set(R, d);
  }
  return d;
}

/**
 * The swell as broken depth contours around the island, drifting slowly outward.
 * `calm` (0..1) flattens them; `alpha` scales the whole layer.
 */
export function paintIsolines(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, maxR: number, t: number, calm: number, alpha: number): void {
  const gap = R * 0.088;
  const drift = (t * R * 0.011) % gap;
  const dashes = contourDashes(R);
  ctx.save();
  ctx.lineWidth = Math.max(1, R * 0.0028);
  ctx.strokeStyle = C.line;
  ctx.lineCap = 'round';
  for (let k = 0; k < CONTOURS; k++) {
    const base = R * 0.2 + k * gap + drift;
    if (base > maxR) break;
    const u = base / R;
    const fade = Math.min(1, (u - 0.2) / 0.18) * (u < 1 ? 1 : Math.max(0, 1 - (u - 1) * 1.4));
    if (fade <= 0) continue;
    ctx.globalAlpha = alpha * fade * (0.13 + 0.07 * Math.sin(k * 1.73 + 0.4));
    const amp = R * (0.02 + 0.03 * u) * (1 - 0.7 * calm);
    ctx.setLineDash(dashes[k]);
    ctx.lineDashOffset = k * 41 + t * R * 0.006 * (k % 2 ? 1 : -1);
    // each contour is centred a little off the island, so they bunch and spread like a real swell
    const ox = cx + R * 0.05 * u * Math.sin(k * 0.7 + t * 0.05), oy = cy + R * 0.04 * u * Math.cos(k * 0.9 - t * 0.04);
    ctx.beginPath();
    for (let i = 0; i <= SEG; i++) {
      const th = (i / SEG) * TAU;
      const w = Math.sin(2 * th + t * 0.13 + k * 0.6) * 0.45 + Math.sin(3 * th - t * 0.21 + k * 0.9) * 0.3 + Math.sin(5 * th + t * 0.16 + k * 2.1) * 0.17
        + Math.sin(9 * th + t * 0.37 + k) * 0.08;
      const r = base + amp * w;
      if (i) ctx.lineTo(ox + COS[i] * r, oy + SIN[i] * r);
      else ctx.moveTo(ox + COS[i] * r, oy + SIN[i] * r);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ── the island, the village, the lighthouse ─────────────────────
/** The island's centre lies this far below the lamp (in island radii s). */
const ISLAND_DY = 0.42;
/** The harbour, where guided boats tie up (the pier's tip): its offset from the lamp in s. */
export const HARBOUR = { x: 0.22, y: 2.05 } as const;

const islandPaths = new Map<number, Path2D>();
function islandPath(s: number): Path2D {
  const key = Math.round(s * 4);
  let p = islandPaths.get(key);
  if (!p) {
    p = new Path2D();
    for (let i = 0; i <= 72; i++) {
      const th = (i / 72) * TAU;
      const r = s * (1 + 0.07 * Math.sin(2 * th + 0.5) + 0.05 * Math.sin(3 * th + 2) + 0.035 * Math.sin(5 * th + 1));
      const px = Math.cos(th) * r * 1.16, py = Math.sin(th) * r;
      if (i) p.lineTo(px, py);
      else p.moveTo(px, py);
    }
    p.closePath();
    if (islandPaths.size > 12) islandPaths.clear();
    islandPaths.set(key, p);
  }
  return p;
}

const foamDashes = new Map<number, number[]>();
function foamDash(s: number): number[] {
  let d = foamDashes.get(s);
  if (!d) {
    d = [s * 0.16, s * 0.1];
    if (foamDashes.size > 8) foamDashes.clear();
    foamDashes.set(s, d);
  }
  return d;
}

export interface IslandLook {
  /** village steps standing, and how far the next one is (0..1) */
  built: number;
  partial: number;
  /** the lamp's glow (0 dark … 1 full) */
  lamp: number;
  /** dusk or night: lit windows */
  windows: number;
}

/** The island with its village and the lighthouse; (x, y) is the lamp, s the island's radius. */
export function paintIsland(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, look: IslandLook): void {
  const ix = x, iy = y + s * ISLAND_DY;
  ctx.save();
  // shallows and the foam line
  ctx.fillStyle = found(ctx, G_SHALLOWS, ix, iy, s) ?? keep(ctx, G_SHALLOWS, ix, iy, s, shallows(ctx, ix, iy, s));
  ctx.beginPath();
  ctx.arc(ix, iy, s * 2.1, 0, TAU);
  ctx.fill();
  ctx.translate(ix, iy);
  ctx.strokeStyle = 'rgba(235,245,255,.34)';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.setLineDash(foamDash(s));
  ctx.lineDashOffset = -t * s * 0.12;
  ctx.save();
  ctx.scale(1.1, 1.1);
  ctx.stroke(islandPath(s));
  ctx.restore();
  ctx.setLineDash(NO_DASH);
  // sand
  ctx.fillStyle = found(ctx, G_SAND, s, 0, 0) ?? keep(ctx, G_SAND, s, 0, 0, sand(ctx, s));
  ctx.fill(islandPath(s));
  ctx.strokeStyle = 'rgba(70,48,24,.4)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.stroke(islandPath(s));
  // dune grass
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.8, s * 0.028);
  for (let i = 0; i < 16; i++) {
    const th = hash(i + 3) * TAU, rr = s * (0.35 + 0.5 * hash(i + 31));
    const gx = Math.cos(th) * rr * 1.1, gy = Math.sin(th) * rr * 0.92;
    if (gy > s * 0.5 && Math.abs(gx - s * 0.22) < s * 0.3) continue;   // the path to the pier
    ctx.strokeStyle = i % 3 ? '#6f8c56' : '#8aa465';
    const sway = Math.sin(t * 0.8 + i) * s * 0.03;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(gx + k * s * 0.03, gy);
      ctx.lineTo(gx + k * s * 0.07 + sway, gy - s * (0.11 + 0.04 * (k === 0 ? 1 : 0)));
      ctx.stroke();
    }
  }
  ctx.restore();
  for (let i = 0; i < STEPS.length; i++) {
    if (i < look.built) STEPS[i](ctx, ix, iy, s, t, look.windows, 1);
    else if (i === look.built && look.partial > 0) STEPS[i](ctx, ix, iy, s, t, look.windows, 0.22 + 0.33 * look.partial);   // being built: a ghost
  }
  paintTower(ctx, x, y, s, look.lamp);
}

function shallows(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, s * 0.8, x, y, s * 2.1);
  g.addColorStop(0, 'rgba(70,150,170,.26)');
  g.addColorStop(0.45, 'rgba(50,110,150,.12)');
  g.addColorStop(1, 'rgba(40,80,140,0)');
  return g;
}

function sand(ctx: CanvasRenderingContext2D, s: number): CanvasGradient {
  const g = ctx.createRadialGradient(-s * 0.35, -s * 0.45, s * 0.1, 0, 0, s * 1.2);
  g.addColorStop(0, '#ecd7a6');
  g.addColorStop(0.6, '#cdb07a');
  g.addColorStop(1, '#9c7d50');
  return g;
}

/** One village step drawn on the island around its centre (cx, cy): `win` lights its windows, `k` < 1 a step being built. */
type Step = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, t: number, win: number, k: number) => void;

/** A small building with a pitched roof and a soft shadow; `lit` (0–2) windows glow at night. */
function house(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, win: number, x: number, y: number, w: number, h: number,
  wall: string, roof: string, roofH: number, k: number, lit: number): void {
  const X = cx + x * s, Y = cy + y * s, W = w * s, H = h * s, RH = roofH * s;
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(30,20,10,.28)';
  ctx.fillRect(X - W / 2 + W * 0.12, Y - H / 2 + H * 0.2, W, H);   // a soft shadow to the lower right
  ctx.fillStyle = wall;
  ctx.fillRect(X - W / 2, Y - H / 2 + RH * 0.6, W, H - RH * 0.6);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(X - W / 2 - W * 0.06, Y - H / 2 + RH * 0.75);
  ctx.lineTo(X - W / 2 + W * 0.1, Y - H / 2 - RH * 0.25);
  ctx.lineTo(X + W / 2 - W * 0.1, Y - H / 2 - RH * 0.25);
  ctx.lineTo(X + W / 2 + W * 0.06, Y - H / 2 + RH * 0.75);
  ctx.closePath();
  ctx.fill();
  if (win > 0 && lit) {
    ctx.globalAlpha = k * win;
    ctx.fillStyle = C.gold;
    const ww = Math.max(1, W * 0.16), wh = Math.max(1, H * 0.2);
    ctx.fillRect(X - W * 0.2 - ww / 2, Y + H * 0.12, ww, wh);
    if (lit > 1) ctx.fillRect(X + W * 0.2 - ww / 2, Y + H * 0.12, ww, wh);
  }
  ctx.globalAlpha = 1;
}

const pier: Step = (ctx, cx, cy, s, _t, win, k) => {
  const x0 = cx + s * 0.22, y0 = cy + s * 0.78, len = s * 1.28 * Math.max(0.15, k), w = s * 0.2;
  ctx.globalAlpha = k < 1 ? 0.75 : 1;
  ctx.fillStyle = '#6e5034';
  ctx.fillRect(x0 - w / 2 - s * 0.03, y0, s * 0.05, len);
  ctx.fillRect(x0 + w / 2 - s * 0.02, y0, s * 0.05, len);
  ctx.fillStyle = '#9b7550';
  ctx.fillRect(x0 - w / 2, y0, w, len);
  ctx.strokeStyle = 'rgba(60,40,22,.55)';
  ctx.lineWidth = Math.max(0.6, s * 0.02);
  for (let yy = y0 + s * 0.09; yy < y0 + len; yy += s * 0.11) {
    ctx.beginPath();
    ctx.moveTo(x0 - w / 2, yy);
    ctx.lineTo(x0 + w / 2, yy);
    ctx.stroke();
  }
  if (k >= 1 && win > 0) {
    // a lantern on the pier's end post
    ctx.globalAlpha = win;
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.arc(x0 + w / 2, y0 + len, Math.max(1, s * 0.045), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const nets: Step = (ctx, cx, cy, s, _t, _win, k) => {
  const x0 = cx - s * 0.86, y0 = cy + s * 0.32, x1 = cx - s * 0.36, y1 = cy + s * 0.62;
  ctx.globalAlpha = k;
  ctx.strokeStyle = '#5b4632';
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y0 - s * 0.2);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1, y1 - s * 0.2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70,90,110,.8)';
  ctx.lineWidth = Math.max(0.6, s * 0.018);
  for (let i = 0; i <= 4; i++) {
    const q = i / 4;
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * q, y0 - s * 0.19 + (y1 - y0) * q);
    ctx.lineTo(x0 + (x1 - x0) * q + s * 0.02, y0 + (y1 - y0) * q - s * 0.02);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x0, y0 - s * 0.19);
  ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - s * 0.05, x1, y1 - s * 0.19);
  ctx.moveTo(x0, y0 - s * 0.08);
  ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + s * 0.04, x1, y1 - s * 0.08);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const smokehouse: Step = (ctx, cx, cy, s, t, win, k) => {
  house(ctx, cx, cy, s, win, -0.72, -0.08, 0.3, 0.28, '#5a4636', '#3a2c22', 0.12, k, 0);
  if (k < 1) return;
  // smoke from the chimney
  ctx.fillStyle = '#c9c4bd';
  for (let i = 0; i < 3; i++) {
    const q = (t * 0.25 + i / 3) % 1;
    ctx.globalAlpha = 0.28 * (1 - q);
    ctx.beginPath();
    ctx.arc(cx - s * 0.66 + q * s * 0.25, cy - s * 0.28 - q * s * 0.5, s * (0.05 + q * 0.09), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const cottage = (x: number, y: number, w: number, roof: string): Step => (ctx, cx, cy, s, _t, win, k) =>
  house(ctx, cx, cy, s, win, x, y, w, w * 0.78, '#e7dcc8', roof, w * 0.36, k, 2);

const shrine: Step = (ctx, cx, cy, s, _t, win, k) => {
  house(ctx, cx, cy, s, win, 0.84, 0.1, 0.2, 0.27, '#d9c9a9', '#5e4330', 0.13, k, 1);
  // its little cross on the ridge
  ctx.globalAlpha = k;
  ctx.strokeStyle = '#5e4330';
  ctx.lineWidth = Math.max(0.7, s * 0.025);
  const X = cx + 0.84 * s, Y = cy + (0.1 - 0.135 - 0.04) * s;
  ctx.beginPath();
  ctx.moveTo(X, Y);
  ctx.lineTo(X, Y - s * 0.12);
  ctx.moveTo(X - s * 0.04, Y - s * 0.085);
  ctx.lineTo(X + s * 0.04, Y - s * 0.085);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

/** Two boats drawn up on the beach: x, y (in s) and their turn. */
const BEACH = [0.62, 0.6, 0.5, 0.86, 0.4, 0.9] as const;

const beachBoats: Step = (ctx, cx, cy, s, _t, _win, k) => {
  ctx.globalAlpha = k;
  const hull = boatPaths().kuter.hull;
  for (let i = 0; i < BEACH.length; i += 3) {
    ctx.save();
    ctx.translate(cx + BEACH[i] * s, cy + BEACH[i + 1] * s);
    ctx.rotate(BEACH[i + 2]);
    ctx.scale(s * 0.3, s * 0.3);
    ctx.fillStyle = '#3d4e6e';
    ctx.fill(hull);
    ctx.fillStyle = '#c95c3e';
    ctx.fillRect(-0.3, -0.06, 0.5, 0.12);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
};

const museum: Step = (ctx, cx, cy, s, _t, win, k) => house(ctx, cx, cy, s, win, 0.02, -0.92, 0.5, 0.3, '#efe6d4', '#2f3a52', 0.14, k, 2);

/** The village in the order it is built (content.ts VILLAGE). */
const STEPS: readonly Step[] = [pier, nets, smokehouse, cottage(-0.4, -0.55, 0.36, '#a4402e'), cottage(0.5, -0.46, 0.32, '#7b4a2e'), shrine, beachBoats, museum];

/** The striped lighthouse, seen from above and a little in front: its lamp at (x, y). */
function paintTower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lamp: number): void {
  const H = Math.max(17, s * 0.92), wb = Math.max(7, s * 0.3), wt = wb * 0.68;
  const by = y + H;
  ctx.save();
  // its shadow on the sand
  ctx.fillStyle = 'rgba(40,24,10,.3)';
  ctx.beginPath();
  ctx.ellipse(x + wb * 0.9, by - wb * 0.1, wb * 1.1, wb * 0.42, 0.35, 0, TAU);
  ctx.fill();
  // the body: white with red bands, lit from the upper left
  ctx.beginPath();
  ctx.moveTo(x - wb / 2, by);
  ctx.lineTo(x - wt / 2, y + wt * 0.5);
  ctx.lineTo(x + wt / 2, y + wt * 0.5);
  ctx.lineTo(x + wb / 2, by);
  ctx.closePath();
  ctx.fillStyle = found(ctx, G_TOWER, x, wb, 0) ?? keep(ctx, G_TOWER, x, wb, 0, across(ctx, x, wb, '#fbf7ee', '#e8e0d0', '#a9a196'));
  ctx.fill();
  ctx.save();
  ctx.clip();
  const bands = 3, span = H - wt * 0.5;
  ctx.fillStyle = found(ctx, G_BAND, x, wb, 0) ?? keep(ctx, G_BAND, x, wb, 0, across(ctx, x, wb, '#de5236', null, '#8e2a1c'));
  for (let i = 0; i < bands; i++) {
    const y0 = by - span * ((i * 2 + 1) / (bands * 2 + 1)) - span / (bands * 2 + 1);
    ctx.fillRect(x - wb, y0, wb * 2, span / (bands * 2 + 1));
  }
  ctx.restore();
  // the gallery, the lantern room, the cap
  ctx.fillStyle = '#272c38';
  ctx.beginPath();
  ctx.ellipse(x, y + wt * 0.5, wt * 0.85, wt * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = lamp > 0.95 ? '#fff0c8' : lamp > 0.05 ? `rgba(255,240,200,${0.55 + 0.45 * lamp})` : '#3a4152';
  ctx.beginPath();
  ctx.roundRect(x - wt * 0.42, y - wt * 0.45, wt * 0.84, wt * 0.9, wt * 0.18);
  ctx.fill();
  ctx.fillStyle = '#8a2c20';
  ctx.beginPath();
  ctx.ellipse(x, y - wt * 0.45, wt * 0.5, wt * 0.24, 0, Math.PI, TAU);
  ctx.fill();
  ctx.restore();
}

/** A left-to-right gradient across the tower (its light from the upper left). */
function across(ctx: CanvasRenderingContext2D, x: number, wb: number, a: string, mid: string | null, b: string): CanvasGradient {
  const g = ctx.createLinearGradient(x - wb / 2, 0, x + wb / 2, 0);
  g.addColorStop(0, a);
  if (mid) g.addColorStop(0.55, mid);
  g.addColorStop(1, b);
  return g;
}

// ── the sea's small life ─────────────────────────────────────────
/** Two grey seals on the sandbank: x, y (in s), their turn and size. */
const SEALS = [-0.14, -0.02, 0.4, 1, 0.18, 0.04, -0.3, 0.8] as const;

/** A sandbank with two grey seals at (x, y), `s` px across. */
export function paintSandbank(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = found(ctx, G_BANK, s, 0, 0) ?? keep(ctx, G_BANK, s, 0, 0, bank(ctx, s));
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.62, s * 0.3, -0.25, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,240,255,.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.68, s * 0.34, -0.25, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < SEALS.length; i += 4) {
    const sx = SEALS[i], sy = SEALS[i + 1], rot = SEALS[i + 2], k = SEALS[i + 3];
    const lift = Math.sin(t * 0.6 + sx * 9) * 0.04;   // a seal lifts its head now and then
    ctx.save();
    ctx.translate(sx * s, sy * s);
    ctx.rotate(rot + lift);
    ctx.fillStyle = '#5d6672';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.16 * k, s * 0.065 * k, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.15 * k, 0, s * 0.05 * k, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,210,225,.35)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.02, -s * 0.025 * k, s * 0.09 * k, s * 0.02 * k, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function bank(ctx: CanvasRenderingContext2D, s: number): CanvasGradient {
  const g = ctx.createRadialGradient(-s * 0.1, -s * 0.08, 0, 0, 0, s * 0.6);
  g.addColorStop(0, 'rgba(214,190,140,.85)');
  g.addColorStop(0.7, 'rgba(160,140,100,.55)');
  g.addColorStop(1, 'rgba(110,120,120,0)');
  return g;
}

/** A channel buoy with its slow light (red or green, as on the charts). */
export function paintBuoy(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, green: boolean, t: number, glow: HTMLCanvasElement): void {
  const on = Math.sin(t * 1.9 + (green ? 1.3 : 0)) > 0.55;
  ctx.fillStyle = 'rgba(8,12,24,.5)';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.2, y + s * 0.25, s * 0.55, s * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = green ? '#2f6b4f' : '#8e3328';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.42, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,240,255,.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (on) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    ctx.drawImage(glow, x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
    ctx.restore();
    ctx.fillStyle = green ? '#9dffcc' : '#ffb0a0';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.2, 0, TAU);
    ctx.fill();
  }
}

// ── boats ────────────────────────────────────────────────────────
interface BoatShape { hull: Path2D; deck: Path2D; sail?: Path2D; len: number; lantern: [number, number] }

let shapes: Record<BoatKind, BoatShape> | null = null;

/** The silhouettes, bow toward +x, one unit long (scaled by `len`). */
export function boatPaths(): Record<BoatKind, BoatShape> {
  if (shapes) return shapes;
  const hull = (w: number, stern = 0.5) => {
    const p = new Path2D();
    p.moveTo(0.5, 0);
    p.quadraticCurveTo(0.3, -w, -0.12, -w * 0.96);
    p.lineTo(-stern, -w * 0.8);
    p.quadraticCurveTo(-stern - 0.04, 0, -stern, w * 0.8);
    p.lineTo(-0.12, w * 0.96);
    p.quadraticCurveTo(0.3, w, 0.5, 0);
    p.closePath();
    return p;
  };
  const rect = (x: number, y: number, w: number, h: number, r = 0.03) => {
    const p = new Path2D();
    p.roundRect(x, y, w, h, r);
    return p;
  };
  const sail = new Path2D();
  sail.moveTo(0.16, 0);
  sail.quadraticCurveTo(-0.08, -0.3, -0.4, -0.06);
  sail.lineTo(0.16, 0);
  sail.closePath();
  const tall = new Path2D();
  for (const mx of [0.24, -0.02, -0.26]) tall.roundRect(mx - 0.035, -0.3, 0.07, 0.6, 0.02);
  const cargo = new Path2D();
  for (let i = 0; i < 4; i++) cargo.roundRect(-0.28 + i * 0.15, -0.12, 0.12, 0.24, 0.015);
  const bottle = new Path2D();
  bottle.roundRect(-0.36, -0.15, 0.56, 0.3, 0.12);
  bottle.roundRect(0.16, -0.07, 0.22, 0.14, 0.04);
  shapes = {
    kuter: { hull: hull(0.19), deck: rect(-0.34, -0.11, 0.3, 0.22), len: 1, lantern: [0.08, 0] },
    zaglowka: { hull: hull(0.14, 0.46), deck: rect(-0.04, -0.025, 0.06, 0.05), sail, len: 1, lantern: [0.16, 0] },
    prom: { hull: hull(0.24, 0.5), deck: rect(-0.3, -0.15, 0.5, 0.3, 0.06), len: 1.35, lantern: [0.3, 0] },
    drobnicowiec: { hull: hull(0.2, 0.5), deck: cargo, len: 1.6, lantern: [-0.4, 0] },
    zaglowiec: { hull: hull(0.17, 0.5), deck: rect(-0.42, -0.08, 0.14, 0.16), sail: tall, len: 1.7, lantern: [0.42, 0] },
    butelka: { hull: bottle, deck: rect(-0.24, -0.06, 0.34, 0.12, 0.05), len: 0.62, lantern: [0, 0] },
  };
  return shapes;
}

export interface BoatLook {
  /** the beam passing over it (0..1) */
  light: number;
  /** lit by a flash: lantern on, warm hull */
  lit: boolean;
  /** a far ship in a blind Konwój */
  dark: boolean;
  alpha: number;
}

/** A boat at (x, y) heading `heading`, `size` px for one unit of length; `glow` haloes a lit lantern. */
export function paintBoat(ctx: CanvasRenderingContext2D, kind: BoatKind, x: number, y: number, heading: number, size: number, look: BoatLook, glow: HTMLCanvasElement | null): void {
  const sh = boatPaths()[kind];
  const L = size * sh.len;
  ctx.save();
  ctx.globalAlpha = look.alpha;
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(L, L);
  if (kind === 'butelka') {
    ctx.fillStyle = 'rgba(96,170,128,.85)';
    ctx.fill(sh.hull);
    ctx.fillStyle = C.cream;
    ctx.fill(sh.deck);
    ctx.fillStyle = '#9a6a3c';
    ctx.fillRect(0.36, -0.055, 0.07, 0.11);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(-0.3, -0.11, 0.4, 0.035);
  } else {
    ctx.fillStyle = look.dark ? '#0f1729' : look.lit ? '#b98d55' : C.hull;
    ctx.fill(sh.hull);
    if (!look.dark && !look.lit && look.light > 0.01) {
      ctx.globalAlpha = look.alpha * Math.min(1, look.light) * 0.85;
      ctx.fillStyle = C.warm;
      ctx.fill(sh.hull);
      ctx.globalAlpha = look.alpha;
    }
    ctx.lineWidth = 1.2 / L;
    ctx.strokeStyle = look.dark ? 'rgba(120,140,190,.18)' : C.rim;
    ctx.stroke(sh.hull);
    ctx.fillStyle = look.dark ? '#141d33' : look.lit ? '#f3e2bd' : C.deck;
    ctx.fill(sh.deck);
    if (sh.sail) {
      ctx.fillStyle = look.dark ? 'rgba(90,105,140,.3)' : look.lit ? 'rgba(255,248,232,.95)' : 'rgba(186,196,220,.6)';
      ctx.fill(sh.sail);
      if (!look.dark && !look.lit && look.light > 0.01) {
        // the beam warms the canvas as it passes
        ctx.globalAlpha = look.alpha * Math.min(1, look.light) * 0.7;
        ctx.fillStyle = C.warm;
        ctx.fill(sh.sail);
        ctx.globalAlpha = look.alpha;
      }
    }
  }
  ctx.restore();
  if (look.dark || kind === 'butelka') return;
  // the lantern: a small honey light with a faint halo (at least 1.8 px, so it reads on a phone),
  // bright with a glow when lit
  const lx = x + Math.cos(heading) * sh.lantern[0] * L, ly = y + Math.sin(heading) * sh.lantern[0] * L;
  const r = Math.max(1.8, size * 0.075);
  const halo = look.lit ? glow : sprites().honey;
  if (halo) {
    const g = look.lit ? r * 4.5 : r * 3.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = look.alpha * (look.lit ? 1 : 0.22 + 0.35 * look.light);
    ctx.drawImage(halo, lx - g, ly - g, g * 2, g * 2);
    ctx.restore();
  }
  ctx.globalAlpha = look.alpha * (look.lit ? 1 : 0.62 + 0.38 * look.light);
  ctx.fillStyle = look.lit ? '#fff4cf' : C.honey;
  ctx.beginPath();
  ctx.arc(lx, ly, look.lit ? r * 1.15 : r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function bloomSprite(size = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(61,224,200,0)');
  gr.addColorStop(0.18, 'rgba(61,224,200,.16)');
  gr.addColorStop(0.7, 'rgba(61,224,200,.24)');
  gr.addColorStop(0.9, 'rgba(110,240,215,.42)');
  gr.addColorStop(0.97, 'rgba(61,224,200,.12)');
  gr.addColorStop(1, 'rgba(61,224,200,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

/** A soft round light (cream core to transparent), drawn additively and scaled. */
export function glowSprite(rgb: string, size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.25, `rgba(${rgb},.45)`);
  gr.addColorStop(0.6, `rgba(${rgb},.12)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

// ── light ────────────────────────────────────────────────────────
const BEAM_SPRITE = 512;
const BEAM_HALF = Math.ceil(Math.tan(17 * DEG) * BEAM_SPRITE);

/** The beam's wedge as a sprite: an angular profile (bright ±4° core, soft edge past ±10°) times a falloff along it. */
function beamSprite(rgb: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BEAM_SPRITE;
  c.height = BEAM_HALF * 2;
  const g = c.getContext('2d')!;
  const profile: [number, number][] = [[0, 1], [3.6, 0.96], [4.6, 0.72], [8.5, 0.6], [10.2, 0.38], [13, 0.12], [17, 0]];
  if (typeof g.createConicGradient === 'function') {
    const cg = g.createConicGradient(0, 0, BEAM_HALF);
    for (const [deg, a] of profile) cg.addColorStop(deg / 360, `rgba(${rgb},${a})`);
    for (let i = profile.length - 1; i >= 0; i--) cg.addColorStop(1 - profile[i][0] / 360, `rgba(${rgb},${profile[i][1]})`);
    g.fillStyle = cg;
    g.beginPath();
    g.moveTo(0, BEAM_HALF);
    g.lineTo(BEAM_SPRITE, 0);
    g.lineTo(BEAM_SPRITE, BEAM_HALF * 2);
    g.closePath();
    g.fill();
  } else {
    // older browsers: a plain soft wedge
    g.fillStyle = `rgba(${rgb},.7)`;
    g.beginPath();
    g.moveTo(0, BEAM_HALF);
    g.lineTo(BEAM_SPRITE, BEAM_HALF - Math.tan(10 * DEG) * BEAM_SPRITE);
    g.lineTo(BEAM_SPRITE, BEAM_HALF + Math.tan(10 * DEG) * BEAM_SPRITE);
    g.closePath();
    g.fill();
  }
  g.globalCompositeOperation = 'destination-in';
  const rg = g.createRadialGradient(0, BEAM_HALF, 0, 0, BEAM_HALF, BEAM_SPRITE);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(0.07, 'rgba(0,0,0,.95)');
  rg.addColorStop(0.45, 'rgba(0,0,0,.62)');
  rg.addColorStop(0.92, 'rgba(0,0,0,.36)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, BEAM_SPRITE, BEAM_HALF * 2);
  return c;
}

export interface Sprites {
  gold: HTMLCanvasElement; coral: HTMLCanvasElement; cream: HTMLCanvasElement; teal: HTMLCanvasElement; honey: HTMLCanvasElement;
  /** the Cisza glow: an even disc with a brighter front where it spreads */
  bloom: HTMLCanvasElement;
  coralGlow: HTMLCanvasElement;
  greenGlow: HTMLCanvasElement;
}
let shared: Sprites | null = null;

/** The soft lights everything shares, made once on first use. */
export function sprites(): Sprites {
  shared ??= {
    gold: beamSprite('255,196,96'), coral: beamSprite('255,118,80'),
    cream: glowSprite('255,236,190'), teal: glowSprite('61,224,200', 128), honey: glowSprite('255,176,32'), bloom: bloomSprite(),
    coralGlow: glowSprite('255,120,100', 32), greenGlow: glowSprite('110,255,180', 32),
  };
  return shared;
}

/**
 * The beam from (x, y) along `angle`, `len` px long: first a warm tint that cancels the blue of
 * the water, then the light itself; `coral` (0..1) shifts the light from gold toward coral.
 */
export function paintBeam(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, len: number, intensity: number, coral: number): void {
  const sp = sprites();
  const k = len / BEAM_SPRITE;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = Math.min(1, intensity * 0.3);
  ctx.drawImage(sp.gold, 0, -BEAM_HALF * k, len, BEAM_HALF * 2 * k);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, intensity * 0.8 * (1 - coral));
  ctx.drawImage(sp.gold, 0, -BEAM_HALF * k, len, BEAM_HALF * 2 * k);
  if (coral > 0) {
    ctx.globalAlpha = Math.min(1, intensity * 0.8 * coral);
    ctx.drawImage(sp.coral, 0, -BEAM_HALF * k, len, BEAM_HALF * 2 * k);
  }
  ctx.restore();
}

// ── amber ────────────────────────────────────────────────────────
const AMBER_TONES = {
  honey: ['#ffe199', '#f7ae2c', '#b86a10', '#6a3a08'],
  cherry: ['#ffc58a', '#e0712a', '#9a3412', '#4c1a08'],
} as const;

interface Pebble { rx: number; ry: number; seed: number; p: Path2D }
const pebbles: Pebble[] = [];

/** An irregular pebble outline (kept: the same pieces are drawn again and again). */
function pebblePath(rx: number, ry: number, seed: number): Path2D {
  for (let i = 0; i < pebbles.length; i++) {
    const q = pebbles[i];
    if (q.rx === rx && q.ry === ry && q.seed === seed) return q.p;
  }
  const p = new Path2D();
  for (let i = 0; i <= 40; i++) {
    const th = (i / 40) * TAU;
    const k = 1 + 0.07 * Math.sin(2 * th + seed) + 0.05 * Math.sin(3 * th + seed * 1.7) + 0.03 * Math.sin(5 * th + seed * 0.3);
    const px = Math.cos(th) * rx * k, py = Math.sin(th) * ry * k;
    if (i) p.lineTo(px, py);
    else p.moveTo(px, py);
  }
  p.closePath();
  if (pebbles.length >= 80) pebbles.shift();
  pebbles.push({ rx, ry, seed, p });
  return p;
}

/** An amber pebble with its inclusion, fitted in w × h at (x, y) (its centre); `seed` shapes the pebble. */
export function paintAmber(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, inclusion: Inclusion | null, tone: 'honey' | 'cherry', seed: number, owned = true): void {
  const rx = w * 0.46, ry = h * 0.42;
  ctx.save();
  ctx.translate(x, y);
  const pebble = pebblePath(rx, ry, seed);
  if (!owned) {
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    ctx.fill(pebble);
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.setLineDash(DOTTED);
    ctx.lineWidth = 1;
    ctx.stroke(pebble);
    ctx.restore();
    return;
  }
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = Math.max(2, h * 0.12);
  ctx.shadowOffsetY = Math.max(1, h * 0.04);
  const t = tone === 'honey' ? 0 : 1;
  ctx.fillStyle = found(ctx, G_AMBER, rx, ry, t) ?? keep(ctx, G_AMBER, rx, ry, t, amberFill(ctx, rx, ry, AMBER_TONES[tone]));
  ctx.fill(pebble);
  ctx.shadowColor = 'transparent';
  ctx.save();
  ctx.clip(pebble);
  if (inclusion) paintInclusion(ctx, inclusion, Math.min(rx, ry * 1.3) * 0.8, seed);
  // the glint and a warm rim
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = found(ctx, G_GLINT, rx, ry, 0) ?? keep(ctx, G_GLINT, rx, ry, 0, glint(ctx, rx, ry));
  ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,230,170,.35)';
  ctx.lineWidth = 1;
  ctx.stroke(pebble);
  ctx.restore();
}

const DOTTED = [2, 2.5];

function amberFill(ctx: CanvasRenderingContext2D, rx: number, ry: number, tones: readonly string[]): CanvasGradient {
  const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, 0, 0, 0, Math.max(rx, ry) * 1.1);
  g.addColorStop(0, tones[0]);
  g.addColorStop(0.45, tones[1]);
  g.addColorStop(0.85, tones[2]);
  g.addColorStop(1, tones[3]);
  return g;
}

function glint(ctx: CanvasRenderingContext2D, rx: number, ry: number): CanvasGradient {
  const g = ctx.createRadialGradient(-rx * 0.38, -ry * 0.45, 0, -rx * 0.38, -ry * 0.45, rx * 0.55);
  g.addColorStop(0, 'rgba(255,250,230,.7)');
  g.addColorStop(1, 'rgba(255,250,230,0)');
  return g;
}

/** An amber piece drawn once into its own canvas, to draw every frame: `w` × `h` CSS px of sprite, centred on the pebble. */
export interface AmberSprite { c: HTMLCanvasElement; w: number; h: number }

/** paintAmber into a canvas of its own (at `dpr`, with room for its shadow). */
export function amberSprite(w: number, h: number, dpr: number, inclusion: Inclusion | null, tone: 'honey' | 'cherry', seed: number): AmberSprite {
  const pad = Math.ceil(h * 0.25) + 2;
  const W = w + pad * 2, H = h + pad * 2;
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * dpr);
  c.height = Math.ceil(H * dpr);
  const g = c.getContext('2d');
  if (g) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintAmber(g, W / 2, H / 2, w, h, inclusion, tone, seed);
  }
  return { c, w: W, h: H };
}

/** The inclusion's dark silhouette, about `s` px across, centred. */
function paintInclusion(ctx: CanvasRenderingContext2D, kind: Inclusion, s: number, seed: number): void {
  ctx.save();
  ctx.rotate(Math.sin(seed * 3.1) * 0.5);
  ctx.fillStyle = 'rgba(52,26,6,.78)';
  ctx.strokeStyle = 'rgba(52,26,6,.72)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lw = Math.max(0.7, s * 0.045);
  ctx.lineWidth = lw;
  const ell = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    ctx.beginPath();
    ctx.ellipse(x * s, y * s, rx * s, ry * s, rot, 0, TAU);
    ctx.fill();
  };
  const line = (pts: number[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0] * s, pts[1] * s);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * s, pts[i + 1] * s);
    ctx.stroke();
  };
  const legs = (pairs: number[][]) => { for (const p of pairs) line(p); };
  switch (kind) {
    case 'komar':
      ctx.globalAlpha = 0.45;
      ell(-0.05, -0.2, 0.28, 0.09, -0.5);
      ell(0.05, -0.2, 0.28, 0.09, 0.5);
      ctx.globalAlpha = 1;
      ell(0, 0.05, 0.05, 0.3);
      ell(0, -0.3, 0.07, 0.07);
      legs([[0, -0.05, -0.4, 0.2, -0.5, 0.5], [0, -0.05, 0.4, 0.2, 0.5, 0.5], [0, 0, -0.35, 0.35, -0.3, 0.6], [0, 0, 0.35, 0.35, 0.3, 0.6]]);
      break;
    case 'mrowka':
      ell(0, -0.32, 0.1, 0.09);
      ell(0, -0.1, 0.08, 0.12);
      ell(0, 0.24, 0.14, 0.2);
      legs([[0, -0.1, -0.3, -0.25], [0, -0.1, 0.3, -0.25], [0, -0.08, -0.32, 0.05], [0, -0.08, 0.32, 0.05], [0, -0.06, -0.28, 0.32], [0, -0.06, 0.28, 0.32],
        [0, -0.38, -0.14, -0.55], [0, -0.38, 0.14, -0.55]]);
      break;
    case 'lisc':
      ctx.beginPath();
      ctx.moveTo(0, -0.55 * s);
      ctx.quadraticCurveTo(0.42 * s, -0.1 * s, 0, 0.45 * s);
      ctx.quadraticCurveTo(-0.42 * s, -0.1 * s, 0, -0.55 * s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,120,.35)';
      line([0, -0.45, 0, 0.6]);
      for (let i = 0; i < 3; i++) {
        line([0, -0.25 + i * 0.2, -0.18, -0.35 + i * 0.2]);
        line([0, -0.25 + i * 0.2, 0.18, -0.35 + i * 0.2]);
      }
      break;
    case 'nasiono':
      ell(0, 0.3, 0.1, 0.13);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0.2 * s);
      ctx.quadraticCurveTo(0.34 * s, -0.2 * s, 0.1 * s, -0.55 * s);
      ctx.quadraticCurveTo(-0.12 * s, -0.25 * s, 0, 0.2 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'pioro':
      line([0.05, 0.6, -0.02, 0.1, 0.06, -0.55]);
      ctx.lineWidth = lw * 0.7;
      for (let i = 0; i < 9; i++) {
        const yy = 0.4 - i * 0.11;
        line([0.02, yy, -0.2 + i * 0.008, yy - 0.12]);
        line([0.02, yy, 0.24 - i * 0.012, yy - 0.12]);
      }
      break;
    case 'zuk':
      ell(0, 0.08, 0.22, 0.3);
      ell(0, -0.3, 0.11, 0.09);
      ctx.strokeStyle = 'rgba(255,210,140,.3)';
      line([0, -0.18, 0, 0.36]);
      ctx.strokeStyle = 'rgba(52,26,6,.72)';
      legs([[-0.18, -0.05, -0.4, -0.2], [0.18, -0.05, 0.4, -0.2], [-0.2, 0.08, -0.42, 0.12], [0.2, 0.08, 0.42, 0.12], [-0.18, 0.22, -0.36, 0.45], [0.18, 0.22, 0.36, 0.45]]);
      break;
    case 'pajak':
      ell(0, 0.14, 0.17, 0.2);
      ell(0, -0.12, 0.1, 0.09);
      for (const sx of [-1, 1]) {
        legs([[0, -0.1, sx * 0.3, -0.3, sx * 0.42, -0.1], [0, -0.08, sx * 0.36, -0.12, sx * 0.5, 0.1], [0, -0.06, sx * 0.34, 0.08, sx * 0.44, 0.32], [0, -0.04, sx * 0.26, 0.22, sx * 0.3, 0.5]]);
      }
      break;
    case 'kwiat':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ell(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.16, 0.09, a);
      }
      ctx.fillStyle = 'rgba(255,214,140,.55)';
      ell(0, 0, 0.08, 0.08);
      break;
    case 'jaszczurka': {
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(0.05 * s, -0.5 * s);
      ctx.bezierCurveTo(-0.3 * s, -0.25 * s, 0.3 * s, 0.05 * s, -0.05 * s, 0.32 * s);
      ctx.stroke();
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.05 * s, 0.32 * s);
      ctx.quadraticCurveTo(-0.3 * s, 0.55 * s, 0.1 * s, 0.62 * s);
      ctx.stroke();
      ell(0.07, -0.52, 0.08, 0.1, 0.3);
      ctx.lineWidth = lw;
      legs([[-0.04, -0.28, -0.3, -0.36], [0.02, -0.25, 0.26, -0.18], [0.06, 0.12, 0.32, 0.18], [0, 0.18, -0.24, 0.3]]);
      break;
    }
  }
  ctx.restore();
}
