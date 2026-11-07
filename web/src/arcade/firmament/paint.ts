/**
 * Firmament's brushes, shared by the play view, the HUD, the intro, the lobby picture and the
 * panel: the deep night palette, the six sky bodies (each its own silhouette as well as its colour,
 * so they read without colour: a five-point star, a crescent, a ringed planet, a spiked sun, a
 * spiral nebula, a faceted meteorite), the specials drawn over a body (the comet's streak, the
 * supernova's halo, the pulsar's beams, the meteor's flame), the level's things (dark clouds,
 * asteroids, orbit locks, ink, the moons and their exits), Bubo the owl, the telescope's tools and the
 * night sky behind it all.  Bodies are painted once per size into sprites.
 */
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

const TAU = Math.PI * 2;

export const C = {
  night0: '#05071a', night1: '#0b1033', night2: '#1b1450', ink: '#0c1030',
  panel: 'rgba(14,18,52,.78)', panelEdge: 'rgba(255,220,150,.22)', glass: 'rgba(8,10,34,.62)',
  cream: '#f6efdc', dim: 'rgba(246,239,220,.68)', faint: 'rgba(246,239,220,.4)',
  gold: '#ffd27a', goldDeep: '#f2a93b', cool: '#9ec5ff', coolDeep: '#5b8de0', violet: '#c9a8ff', mint: '#8fe3b8',
  dust: '#c9a8ff', rock: '#8a7a6c', rockDark: '#4d4038',
};

/** The six kinds: their main colour (for sparkles and goal icons) and a light and a deep tone. */
export const KIND_COLOR: readonly { main: string; light: string; deep: string }[] = [
  { main: '#ffc93c', light: '#fff4b8', deep: '#d98300' },   // gold star
  { main: '#d9e2f2', light: '#ffffff', deep: '#7f8eae' },   // silver crescent
  { main: '#4aa3ff', light: '#b9e2ff', deep: '#1d4fae' },   // blue ringed planet
  { main: '#ff8a3d', light: '#ffe2a8', deep: '#d4421a' },   // orange sun
  { main: '#b07cff', light: '#ecd8ff', deep: '#5a2fc2' },   // violet nebula
  { main: '#4fd18b', light: '#caffdf', deep: '#1c7d4f' },   // green meteorite
];

export function hash(i: number): number {
  let x = (i | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const radial = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) => {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.05);
  for (const [k, c] of stops) g.addColorStop(k, c);
  return g;
};

// ── the six bodies ───────────────────────────────────────────────
/** Paint body `kind` centred at (x, y), `r` = its radius. */
export function paintBody(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, r: number): void {
  const k = KIND_COLOR[kind] ?? KIND_COLOR[0];
  ctx.save();
  ctx.lineJoin = 'round';
  switch (kind) {
    case 0: { // a five-point star
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.46 : r * 1.02;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr + r * 0.06);
      }
      ctx.closePath();
      ctx.fillStyle = radial(ctx, x, y, r, [[0, k.light], [0.55, k.main], [1, k.deep]]);
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.strokeStyle = 'rgba(120,60,0,.55)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.12, y - r * 0.2, r * 0.16, r * 0.1, -0.5, 0, TAU);
      ctx.fill();
      break;
    }
    case 1: { // a crescent, tilted
      ctx.translate(x, y);
      ctx.rotate(-0.45);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, Math.PI * 0.32, Math.PI * 1.68, false);
      ctx.arc(r * 0.42, -r * 0.05, r * 0.7, Math.PI * 1.55, Math.PI * 0.45, true);
      ctx.closePath();
      ctx.fillStyle = radial(ctx, -r * 0.2, 0, r, [[0, k.light], [0.6, k.main], [1, k.deep]]);
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.strokeStyle = 'rgba(60,70,100,.55)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(110,125,160,.45)';
      for (const [cx, cy, cr] of [[-0.55, -0.15, 0.1], [-0.4, 0.4, 0.07], [-0.6, 0.2, 0.05]] as const) {
        ctx.beginPath();
        ctx.arc(cx * r, cy * r, cr * r, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 2: { // a ringed planet: the ring behind, the ball, the ring in front
      const ring = (front: boolean) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.38);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.05, r * 0.32, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
        ctx.lineWidth = Math.max(1.5, r * 0.15);
        ctx.strokeStyle = front ? 'rgba(220,240,255,.95)' : 'rgba(160,200,240,.7)';
        ctx.stroke();
        ctx.restore();
      };
      ring(false);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.66, 0, TAU);
      ctx.fillStyle = radial(ctx, x, y, r * 0.66, [[0, k.light], [0.5, k.main], [1, k.deep]]);
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.strokeStyle = 'rgba(10,30,80,.6)';
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.66, 0, TAU);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(x - r, y - r * 0.28, r * 2, r * 0.12);
      ctx.fillRect(x - r, y + r * 0.1, r * 2, r * 0.08);
      ctx.restore();
      ring(true);
      break;
    }
    case 3: { // a sun: a disc with eight rays
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8, rr = i % 2 ? r * 0.7 : r * 1.02;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = k.deep;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.66, 0, TAU);
      ctx.fillStyle = radial(ctx, x, y, r * 0.66, [[0, '#fffbe8'], [0.45, k.light], [1, k.main]]);
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.strokeStyle = 'rgba(150,40,0,.45)';
      ctx.stroke();
      break;
    }
    case 4: { // a spiral nebula: two arms around a bright core
      ctx.translate(x, y);
      ctx.rotate(0.3);
      for (const side of [0, Math.PI]) {
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const q = i / 24, a = side + q * 3.4, rr = r * (0.14 + q * 0.9);
          const w = r * (0.32 - q * 0.24);
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.86;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px + Math.cos(a + 1.57) * w * 0.3, py + Math.sin(a + 1.57) * w * 0.3);
        }
        for (let i = 24; i >= 0; i--) {
          const q = i / 24, a = side + q * 3.4, rr = r * (0.14 + q * 0.9) - r * (0.3 - q * 0.22);
          ctx.lineTo(Math.cos(a) * Math.max(0, rr), Math.sin(a) * Math.max(0, rr) * 0.86);
        }
        ctx.closePath();
        ctx.fillStyle = radial(ctx, 0, 0, r, [[0, k.light], [0.5, k.main], [1, k.deep]]);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, TAU);
      ctx.fillStyle = radial(ctx, 0, 0, r * 0.3, [[0, '#ffffff'], [0.6, k.light], [1, k.main]]);
      ctx.fill();
      break;
    }
    default: { // a faceted meteorite with craters
      ctx.beginPath();
      const pts = [[0, -1], [0.72, -0.62], [0.96, 0.12], [0.55, 0.86], [-0.3, 0.95], [-0.9, 0.42], [-0.86, -0.4]];
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * r * 0.95, y + py * r * 0.92) : ctx.moveTo(x + px * r * 0.95, y + py * r * 0.92)));
      ctx.closePath();
      ctx.fillStyle = radial(ctx, x, y, r, [[0, k.light], [0.5, k.main], [1, k.deep]]);
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.strokeStyle = 'rgba(5,50,30,.6)';
      ctx.stroke();
      // facets
      ctx.strokeStyle = 'rgba(255,255,255,.28)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.2, y - r * 0.9);
      ctx.lineTo(x - r * 0.05, y - r * 0.1);
      ctx.lineTo(x + r * 0.85, y + r * 0.05);
      ctx.moveTo(x - r * 0.05, y - r * 0.1);
      ctx.lineTo(x - r * 0.75, y + r * 0.4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(10,70,40,.45)';
      for (const [cx, cy, cr] of [[0.35, 0.35, 0.16], [-0.4, -0.25, 0.12], [0.1, 0.62, 0.09]] as const) {
        ctx.beginPath();
        ctx.arc(x + cx * r, y + cy * r, cr * r, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** An asteroid on a cell: a lumpy rock, cracked by every hit taken; `hp` 1..3 shows as pips. */
export function paintRock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hp: number, seed: number): void {
  ctx.save();
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed + i) * 0.3, q = r * (0.82 + hash(seed * 7 + i) * 0.2);
    ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, hp >= 3 ? '#8d8079' : hp === 2 ? '#a2907f' : '#b8a48f');
  g.addColorStop(1, hp >= 3 ? '#3b322e' : '#4d4038');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.strokeStyle = 'rgba(20,14,10,.7)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(30,22,18,.45)';
  for (const [cx, cy, cr] of [[-0.3, -0.2, 0.2], [0.32, 0.25, 0.15], [0.15, -0.45, 0.1]] as const) {
    ctx.beginPath();
    ctx.arc(x + cx * r, y + cy * r, cr * r, 0, TAU);
    ctx.fill();
  }
  // cracks: fewer hits left, more cracks
  ctx.strokeStyle = 'rgba(255,214,150,.55)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  const cracks = 3 - Math.min(3, hp);
  for (let k = 0; k < cracks; k++) {
    const a = hash(seed * 3 + k) * TAU;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45);
    ctx.lineTo(x + Math.cos(a + 0.4) * r * 0.8, y + Math.sin(a + 0.4) * r * 0.8);
    ctx.stroke();
  }
  // pips: hits left
  for (let k = 0; k < hp; k++) {
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.arc(x + (k - (hp - 1) / 2) * r * 0.32, y + r * 0.62, r * 0.09, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ── the specials, over a body ────────────────────────────────────
/** A comet's streak along its line (row: across, col: down), shimmering with `t`. */
export function paintCometMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dir: 'row' | 'col', t: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (dir === 'col') ctx.rotate(Math.PI / 2);
  ctx.globalCompositeOperation = 'lighter';
  for (const off of [-0.34, 0.34]) {
    const g = ctx.createLinearGradient(-r * 1.15, 0, r * 1.15, 0);
    const sh = 0.5 + 0.5 * Math.sin(t * 6 + off * 5);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${0.6 + 0.35 * sh})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, off * r);
    ctx.lineTo(r * 1.1, off * r);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 1.05, 0);
    ctx.lineTo(s * r * 0.78, -r * 0.2);
    ctx.lineTo(s * r * 0.78, r * 0.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A supernova's halo: a pulsing ring and a four-point flare; armed (blasted once), hotter and faster. */
export function paintNovaMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, armed: boolean): void {
  ctx.save();
  const p = 0.5 + 0.5 * Math.sin(t * (armed ? 14 : 5));
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 1.25);
  g.addColorStop(0, armed ? `rgba(255,140,80,${0.35 + 0.3 * p})` : `rgba(255,236,170,${0.25 + 0.2 * p})`);
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = armed ? 'rgba(255,190,140,.9)' : 'rgba(255,250,225,.85)';
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * (1.05 + 0.1 * p), y + Math.sin(a) * r * (1.05 + 0.1 * p));
    ctx.lineTo(x + Math.cos(a + 0.22) * r * 0.55, y + Math.sin(a + 0.22) * r * 0.55);
    ctx.lineTo(x + Math.cos(a - 0.22) * r * 0.55, y + Math.sin(a - 0.22) * r * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = armed ? '#ffb070' : 'rgba(255,240,200,.9)';
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.beginPath();
  ctx.arc(x, y, r * (0.98 + 0.06 * p), 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** A pulsar: a white core with two turning beams and a rim of the six colours (it has no kind of its own). */
export function paintPulsar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.rotate(t * 2.2);
  for (const s of [0, Math.PI]) {
    const g = ctx.createLinearGradient(0, 0, Math.cos(s) * r * 1.2, Math.sin(s) * r * 1.2);
    g.addColorStop(0, 'rgba(200,240,255,.9)');
    g.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 1.2, s - 0.28, s + 0.28);
    ctx.closePath();
    ctx.fill();
  }
  ctx.rotate(-t * 2.2);
  ctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU - t * 0.8;
    ctx.fillStyle = KIND_COLOR[k].main;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.13, 0, TAU);
    ctx.fill();
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.6, '#d8f3ff');
  core.addColorStop(1, 'rgba(120,200,255,.4)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.46, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ── sprites ──────────────────────────────────────────────────────
/** The six bodies, the satellite and the asteroids painted once for a cell size (CSS px) and a pixel ratio. */
export class Sprites {
  private cache: (HTMLCanvasElement | null)[] = [];
  size = 0;
  private dpr = 1;

  ensure(size: number, dpr: number): void {
    const s = Math.max(8, Math.round(size));
    if (s === this.size && dpr === this.dpr && this.cache.length) return;
    this.size = s;
    this.dpr = dpr;
    this.cache = [];
    for (let k = 0; k < 6; k++) this.cache.push(this.make(s, ctx => paintBody(ctx, k, s / 2, s / 2, s * 0.4)));
  }

  private make(s: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = Math.ceil(s * this.dpr);
    c.height = Math.ceil(s * this.dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    paint(ctx);
    return c;
  }

  /** Draw body `kind` at (x, y) scaled by `k` (falls back to painting when sprites are not available). */
  body(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, k = 1): void {
    const c = this.cache[kind];
    const s = this.size * k;
    if (c) ctx.drawImage(c, x - s / 2, y - s / 2, s, s);
    else paintBody(ctx, kind, x, y, s * 0.4);
  }
}

// ── the level's things on the board ──────────────────────────────
/** A dark cloud on a cell (under the body): a smoky indigo puff; two layers are darker and rimmed. */
export function paintCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, layers: number, t: number, seed: number): void {
  if (layers <= 0) return;
  ctx.save();
  const a = layers >= 2 ? 0.92 : 0.66;
  ctx.beginPath();
  ctx.roundRect(x - s / 2 + 1, y - s / 2 + 1, s - 2, s - 2, s * 0.2);
  ctx.clip();
  const g = ctx.createRadialGradient(x, y + s * 0.1, s * 0.1, x, y, s * 0.75);
  g.addColorStop(0, `rgba(58,46,96,${a})`);
  g.addColorStop(1, `rgba(22,16,44,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
  // drifting puffs
  for (let i = 0; i < 4; i++) {
    const px = x + (hash(seed * 11 + i) - 0.5) * s * 0.8 + Math.sin(t * 0.6 + i + seed) * s * 0.05;
    const py = y + (hash(seed * 23 + i) - 0.5) * s * 0.7;
    const pr = s * (0.2 + hash(seed + i * 5) * 0.14);
    const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
    pg.addColorStop(0, `rgba(120,104,170,${layers >= 2 ? 0.5 : 0.36})`);
    pg.addColorStop(1, 'rgba(120,104,170,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  if (layers >= 2) {
    ctx.save();
    ctx.strokeStyle = 'rgba(190,170,255,.55)';
    ctx.lineWidth = Math.max(1.2, s * 0.035);
    ctx.setLineDash([s * 0.08, s * 0.06]);
    ctx.beginPath();
    ctx.roundRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, s - 6, s * 0.18);
    ctx.stroke();
    ctx.restore();
  }
}

/** A dark cloud as an icon (the goal card): three puffs, indigo with a soft light rim. */
export function paintCloudIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x - r * 0.45, y + r * 0.1, r * 0.48, 0, TAU);
  ctx.arc(x + r * 0.05, y - r * 0.25, r * 0.6, 0, TAU);
  ctx.arc(x + r * 0.55, y + r * 0.12, r * 0.45, 0, TAU);
  ctx.rect(x - r * 0.45, y + r * 0.1, r * 1.0, r * 0.48);
  ctx.fillStyle = radial(ctx, x, y, r * 1.1, [[0, '#7a68c0'], [1, '#2a2150']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,185,255,.8)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
  ctx.restore();
}

/** Ink (the dark that spreads): a blot of smoke with wisps, never eyes or a face; it dissolves into light. */
export function paintInk(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed: number): void {
  ctx.save();
  const r = s * 0.46;
  ctx.beginPath();
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const q = r * (0.82 + 0.14 * Math.sin(a * 3 + t * 1.6 + seed) + hash(seed * 3 + i) * 0.08);
    ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#2a2140');
  g.addColorStop(1, '#07060d');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,120,200,.35)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.stroke();
  // wisps rising
  ctx.strokeStyle = 'rgba(70,60,110,.55)';
  ctx.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    const ph = (t * 0.5 + k * 0.5 + seed * 0.13) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.lineWidth = Math.max(1, s * 0.05 * (1 - ph));
    ctx.beginPath();
    const bx = x + (k ? 0.18 : -0.2) * s;
    ctx.moveTo(bx, y - r * 0.6 - ph * s * 0.3);
    ctx.quadraticCurveTo(bx + s * 0.1, y - r - ph * s * 0.35, bx - s * 0.04, y - r * 1.2 - ph * s * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

/** An orbit lock: a silver ring tilted round the body, a small moonlet riding it. */
export function paintLock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.strokeStyle = 'rgba(220,230,255,.9)';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.12, r * 0.42, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,140,190,.8)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.12, r * 0.42, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  const a = t * 1.4;
  ctx.fillStyle = '#e8eefc';
  ctx.beginPath();
  ctx.arc(Math.cos(a) * r * 1.12, Math.sin(a) * r * 0.42, r * 0.16, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A moon to bring down: a pale full moon with craters and a small sleepy smile. */
export function paintMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t = 0): void {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.35);
  glow.addColorStop(0, 'rgba(255,246,210,.35)');
  glow.addColorStop(1, 'rgba(255,246,210,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.35, 0, TAU);
  ctx.fill();
  ctx.fillStyle = radial(ctx, x, y, r, [[0, '#fffbea'], [0.65, '#ece3c4'], [1, '#b8ab86']]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,145,110,.45)';
  for (const [cx, cy, cr] of [[-0.42, -0.3, 0.18], [0.38, -0.42, 0.12], [0.45, 0.3, 0.15], [-0.15, 0.5, 0.09]] as const) {
    ctx.beginPath();
    ctx.arc(x + cx * r, y + cy * r, cr * r, 0, TAU);
    ctx.fill();
  }
  // a sleepy face: closed eyes, a small smile
  ctx.strokeStyle = 'rgba(90,72,40,.75)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.lineCap = 'round';
  const blink = Math.sin(t * 0.7) > 0.96 ? 0.02 : 0.1;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * r * 0.28, y - r * 0.02, r * 0.13, Math.PI * (0.15 - blink), Math.PI * (0.85 + blink));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y + r * 0.25, r * 0.16, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,150,130,.35)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * r * 0.5, y + r * 0.18, r * 0.12, r * 0.07, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A meteor (from a square): a small rock with a burning tail, tilted down-left, over the body. */
export function paintMeteorMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.translate(x + r * 0.42, y - r * 0.42);
  ctx.rotate(Math.PI * 0.75 + Math.sin(t * 5) * 0.06);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, 0, r * 1.1, 0);
  g.addColorStop(0, 'rgba(255,190,90,.95)');
  g.addColorStop(1, 'rgba(255,90,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.2);
  ctx.quadraticCurveTo(r * 0.7, -r * 0.24 - Math.sin(t * 12) * r * 0.04, r * 1.15, 0);
  ctx.quadraticCurveTo(r * 0.7, r * 0.24, 0, r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#6d5a4b';
  ctx.strokeStyle = '#ffd27a';
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.26, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Where moons leave the sky: a small gold chevron under the bottom cell. */
export function paintExit(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.save();
  const b = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(255,210,122,${0.5 + 0.4 * b})`;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.16, y);
  ctx.lineTo(x + s * 0.16, y);
  ctx.lineTo(x, y + s * 0.14 + b * s * 0.03);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Bubo, the young eagle-owl astronomer ─────────────────────────
/**
 * Bubo: a round young eagle-owl with ear tufts, big round glasses and a scarf; `blink` 0..1, `look`
 * tilts the head (−1 left … 1 right), `hop` lifts him, `cheer` raises the wings.
 */
export function paintOwl(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, o: { t: number; look?: number; hop?: number; cheer?: number; sleepy?: number } = { t: 0 }): void {
  const t = o.t, look = o.look ?? 0, cheer = o.cheer ?? 0, sleepy = o.sleepy ?? 0;
  ctx.save();
  ctx.translate(x, y - (o.hop ?? 0) * r * 0.4);
  // body
  ctx.fillStyle = radial(ctx, 0, r * 0.2, r * 1.1, [[0, '#d9a26a'], [0.7, '#a96a3c'], [1, '#6e4122']]);
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.78, r * 0.92, 0, 0, TAU);
  ctx.fill();
  // belly with chevrons
  ctx.fillStyle = '#f4dcb0';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.42, r * 0.5, r * 0.62, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,90,50,.55)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  for (let k = 0; k < 3; k++) {
    const yy = r * (0.25 + k * 0.2);
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, yy);
    ctx.lineTo(0, yy + r * 0.07);
    ctx.lineTo(r * 0.16, yy);
    ctx.stroke();
  }
  // wings
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * r * 0.7, r * 0.2);
    ctx.rotate(s * (0.25 + cheer * 1.1 + Math.sin(t * 2 + s) * 0.03));
    ctx.fillStyle = '#8a5530';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.28, r * 0.22, r * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // scarf
  ctx.fillStyle = '#e0453a';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.18, r * 0.62, r * 0.14, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(r * 0.2, -r * 0.18, r * 0.16, r * 0.42);
  // head
  ctx.save();
  ctx.rotate(look * 0.15);
  ctx.fillStyle = radial(ctx, 0, -r * 0.62, r * 0.8, [[0, '#dcaa75'], [1, '#8c5833']]);
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.62, r * 0.72, r * 0.56, 0, 0, TAU);
  ctx.fill();
  // ear tufts
  ctx.fillStyle = '#7a4a2a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.36, -r * 1.02);
    ctx.lineTo(s * r * 0.62, -r * 1.42 + Math.sin(t * 3 + s) * r * 0.03);
    ctx.lineTo(s * r * 0.62, -r * 0.92);
    ctx.closePath();
    ctx.fill();
  }
  // facial disc
  ctx.fillStyle = '#f2d7a8';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * r * 0.27, -r * 0.62, r * 0.3, 0, TAU);
    ctx.fill();
  }
  // eyes behind the glasses
  const blink = Math.max(sleepy, (t % 4.2) > 4.05 ? 1 : 0);
  for (const s of [-1, 1]) {
    const ex = s * r * 0.27 + look * r * 0.05, ey = -r * 0.62;
    if (blink > 0.5) {
      ctx.strokeStyle = '#3a2412';
      ctx.lineWidth = Math.max(1.2, r * 0.07);
      ctx.beginPath();
      ctx.arc(ex, ey - r * 0.02, r * 0.11, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffb000';
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.16, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1b1008';
      ctx.beginPath();
      ctx.arc(ex + look * r * 0.04, ey, r * 0.09, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex - r * 0.03, ey - r * 0.04, r * 0.035, 0, TAU);
      ctx.fill();
    }
  }
  // the too-big glasses
  ctx.strokeStyle = '#2b2b3a';
  ctx.lineWidth = Math.max(1.4, r * 0.07);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * r * 0.29, -r * 0.62, r * 0.27, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(200,230,255,.18)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * r * 0.29, -r * 0.62, r * 0.25, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-r * 0.04, -r * 0.66);
  ctx.quadraticCurveTo(0, -r * 0.72, r * 0.04, -r * 0.66);
  ctx.stroke();
  // beak
  ctx.fillStyle = '#e8b43a';
  ctx.beginPath();
  ctx.moveTo(-r * 0.08, -r * 0.48);
  ctx.lineTo(r * 0.08, -r * 0.48);
  ctx.lineTo(0, -r * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // feet
  ctx.fillStyle = '#e8b43a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * r * 0.26, r * 1.12, r * 0.15, r * 0.07, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ── the telescope's tools ────────────────────────────────────────
/** A tool's icon: the star hammer, the ray, the shuffle, +5 moves, the pulsar. */
export function paintToolIcon(ctx: CanvasRenderingContext2D, tool: string, x: number, y: number, r: number, t: number): void {
  ctx.save();
  switch (tool) {
    case 'hammer': {
      ctx.translate(x, y);
      ctx.rotate(-0.6);
      ctx.fillStyle = '#c8873e';
      ctx.fillRect(-r * 0.09, -r * 0.1, r * 0.18, r * 1.0);
      ctx.translate(0, -r * 0.35);
      // the head is a gold star
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.26 : r * 0.58;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = radial(ctx, 0, 0, r * 0.6, [[0, '#fff4b8'], [0.6, '#ffc93c'], [1, '#d98300']]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,0,.6)';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.stroke();
      break;
    }
    case 'ray': {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x - r, y, x + r, y);
      g.addColorStop(0, 'rgba(255,220,120,0)');
      g.addColorStop(0.5, 'rgba(255,240,190,1)');
      g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r * 0.16, r * 2, r * 0.32);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff6d6';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.26, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = Math.max(1.5, r * 0.08);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + t;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36);
        ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
        ctx.stroke();
      }
      break;
    }
    case 'shuffle': {
      ctx.strokeStyle = C.mint;
      ctx.fillStyle = C.mint;
      ctx.lineWidth = Math.max(2, r * 0.14);
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.62, s > 0 ? -2.6 : 0.55, s > 0 ? -0.55 : 2.6);
        ctx.stroke();
        const a = s > 0 ? -0.55 : 2.6;
        const ax = x + Math.cos(a) * r * 0.62, ay = y + Math.sin(a) * r * 0.62;
        ctx.beginPath();
        ctx.moveTo(ax + Math.cos(a + 1.2) * r * 0.05, ay + Math.sin(a + 1.2) * r * 0.05);
        ctx.lineTo(ax + Math.cos(a - 0.6) * r * 0.32, ay + Math.sin(a - 0.6) * r * 0.32);
        ctx.lineTo(ax + Math.cos(a + 2.4) * r * 0.32, ay + Math.sin(a + 2.4) * r * 0.32);
        ctx.closePath();
        ctx.fill();
      }
      paintBody(ctx, 0, x - r * 0.12, y + r * 0.04, r * 0.2);
      paintBody(ctx, 2, x + r * 0.16, y - r * 0.06, r * 0.18);
      break;
    }
    case 'moves': {
      ctx.fillStyle = radial(ctx, x, y, r * 0.8, [[0, '#d6f5ff'], [1, '#3b7bd8']]);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#eaf6ff';
      ctx.lineWidth = Math.max(1.5, r * 0.08);
      ctx.stroke();
      ctx.fillStyle = '#0b1636';
      ctx.font = font(800, r * 0.66, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+5', x, y + r * 0.04);
      break;
    }
    case 'pulsar':
      paintPulsar(ctx, x, y, r * 0.85, t);
      break;
    default:
      break;
  }
  ctx.restore();
}

/** A small star for the map and the stars of a level (filled 0..1). */
export function paintStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: number, color: string = C.gold): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  if (fill > 0) {
    ctx.globalAlpha = Math.min(1, fill);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = fill > 0 ? 'rgba(120,70,0,.6)' : 'rgba(246,239,220,.45)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();
  ctx.restore();
}

// ── the night sky ────────────────────────────────────────────────
/** The sky behind everything, painted once per size: the night's gradient, nebulae and a field of faint stars. */
export function paintSkyLayer(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 1): void {
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, C.night0);
  g.addColorStop(0.55, C.night1);
  g.addColorStop(1, C.night2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const blob = (x: number, y: number, r: number, c: string) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  };
  const m = Math.max(w, h);
  blob(w * 0.18, h * 0.78, m * 0.45, 'rgba(120,60,200,.20)');
  blob(w * 0.85, h * 0.3, m * 0.4, 'rgba(40,120,200,.16)');
  blob(w * 0.6, h * 0.95, m * 0.35, 'rgba(200,80,160,.10)');
  const n = Math.round((w * h) / 2600);
  for (let i = 0; i < n; i++) {
    const x = hash(seed * 31 + i * 7) * w, y = hash(seed * 17 + i * 13) * h;
    const b = hash(i * 5 + 3);
    ctx.fillStyle = `rgba(255,255,255,${0.15 + b * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + b * 0.9, 0, TAU);
    ctx.fill();
  }
}
