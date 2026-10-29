/**
 * Źródła's drawing primitives (Canvas 2D, no assets), shared by the play view, the calibration intro,
 * the lobby preview and the album tiles: a pilgrim's relief map seen from above.  Limestone land with
 * contour lines, carved channel stones (baked once per shape, rotation and size), turquoise water —
 * the only saturated colour on the board — terraced fields and their pools, rose rock, springs in the
 * border, sage green with flowers, the sparrow and the swallow of Psalm 84:3 with their nest, tiny
 * pilgrims, the day's trees and the album's places of water.  Everything is drawn in CSS pixels;
 * what does not change per frame is made once and found again by its numbers.
 */
import { BIT, DX, DY } from './valley';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const MONO = '"JetBrains Mono", monospace';

/** The palette: limestone, ochre and rose land; water the one saturated colour; sage green; the birds. */
export const C = {
  lime: '#E8DDC8', limeLight: '#F3ECDD', limeDeep: '#D9CBB0', groove: '#9C8B70', ochre: '#C7A46E', rose: '#C98F7A', roseDeep: '#9E6656',
  ink: '#2B2A33', inkSoft: 'rgba(43,42,51,.62)', water: '#2FB3C4', pool: '#1C6E96', foam: '#CFF6F3',
  sage: '#8FAF7E', olive: '#4F7A43', anemone: '#D2453B', crocus: '#9B7FD1', oleander: '#E79AB0',
  sparrow: '#7A5A3C', sparrowLight: '#C9A77C', swallow: '#23314F', throat: '#B5532E',
  predawn: '#5B5B8F', morning: '#FFF4DA', fire: '#F2A04A', gold: '#F4C76B', night: '#1d1b2b',
} as const;

const TAU = Math.PI * 2;
export const NO_DASH: number[] = [];

// ── numbers ──────────────────────────────────────────────────────
/** Stable pseudo-random numbers for decorations (the same every frame). */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth 2D value noise in 0..1, seeded. */
export function noise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const v = (a: number, b: number) => hash(a * 157 + b * 311 + seed * 17.13);
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Three octaves of value noise, 0..1. */
export const fbm = (x: number, y: number, seed: number): number =>
  (noise(x, y, seed) * 4 + noise(x * 2.1, y * 2.1, seed + 9) * 2 + noise(x * 4.3, y * 4.3, seed + 23)) / 7;

/** '#rrggbb' mixed toward '#rrggbb' by k. */
export function mix(a: string, b: string, k: number): string {
  const p = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const q = Math.max(0, Math.min(1, k));
  const c = [0, 1, 2].map(i => Math.round(p(a, i) + (p(b, i) - p(a, i)) * q));
  return `#${c.map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

/** '#rrggbb' at alpha `a`. */
export function rgba(hex: string, a: number): string {
  const p = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgba(${p(0)},${p(1)},${p(2)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

/** An offscreen canvas of `w` × `h` device pixels (null where there is no DOM). */
export function canvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ── a channel's shape ────────────────────────────────────────────
/** The groove and the water as fractions of a stone. */
export const GROOVE = 0.28;
export const STREAM = 0.16;

/** Whether a port mask is a bend (two adjacent sides): its channel is a quarter arc. */
export const isBend = (m: number): boolean => m === 3 || m === 6 || m === 12 || m === 9;

/**
 * Trace the channel of port mask `m` in a stone of size `s` centred at (0, 0): a quarter arc for a
 * bend, else straight arms from the middle to each open side.  `only` limits it to one side's arm
 * (−1: all of them).
 */
export function traceChannel(ctx: CanvasRenderingContext2D, m: number, s: number, only = -1): void {
  const h = s / 2;
  if (isBend(m)) {
    const [a, b] = [0, 1, 2, 3].filter(d => m & BIT[d]);
    const cx = (DX[a] + DX[b]) * h, cy = (DY[a] + DY[b]) * h;
    const a0 = Math.atan2(DY[a] * h - cy, DX[a] * h - cx), a1 = Math.atan2(DY[b] * h - cy, DX[b] * h - cx);
    let d = a1 - a0;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    if (only >= 0 && only !== a && only !== b) return;
    // one side's arm of a bend is the half of the arc next to it
    const from = only === b ? a0 + d / 2 : a0, to = only === a ? a0 + d / 2 : a1;
    ctx.moveTo(cx + Math.cos(from) * h, cy + Math.sin(from) * h);
    ctx.arc(cx, cy, h, from, to, d < 0);
    return;
  }
  for (let d = 0; d < 4; d++) {
    if (!(m & BIT[d]) || (only >= 0 && only !== d)) continue;
    ctx.moveTo(0, 0);
    ctx.lineTo(DX[d] * (h + 1), DY[d] * (h + 1));
  }
}

/** The length of one side's arm in a stone of size `s` (a bend's is a quarter of the arc's circle, halved). */
export const armLength = (m: number, s: number): number => (isBend(m) ? (Math.PI * s) / 8 : s / 2);

// ── the stone sprites ───────────────────────────────────────────
export type StoneLook = 'stone' | 'fixed' | 'well' | 'four';

interface SpriteSet { s: number; dpr: number; map: Map<string, HTMLCanvasElement | null> }
let sprites: SpriteSet = { s: 0, dpr: 0, map: new Map() };

/**
 * A carved stone of size `s` (CSS px) with channel mask `m`, baked at the screen's resolution once:
 * a limestone square with a bevel (light from the top left), the groove cut into it with its shaded
 * walls, a round basin for an end, a scalloped rosette for a four-way, a curb and a dark eye for a
 * well, a double border for a pre-set stone.
 */
export function stoneSprite(m: number, look: StoneLook, s: number, dpr: number): HTMLCanvasElement | null {
  if (sprites.s !== s || sprites.dpr !== dpr) sprites = { s, dpr, map: new Map() };
  const key = `${m}|${look}`;
  if (sprites.map.has(key)) return sprites.map.get(key)!;
  const px = Math.ceil(s * dpr);
  const cv = canvas(px, px);
  sprites.map.set(key, cv);
  const ctx = cv?.getContext('2d');
  if (!cv || !ctx) return cv;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintStoneBase(ctx, s, look, m);
  // the groove on a layer of its own: colour, then its shaded walls
  const g = canvas(px, px), gx = g?.getContext('2d');
  if (g && gx) {
    const gw = s * GROOVE;
    const groove = (c: CanvasRenderingContext2D, dx: number, dy: number) => {
      c.save();
      c.translate(s / 2 + dx, s / 2 + dy);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = gw;
      c.strokeStyle = '#000';
      c.fillStyle = '#000';
      c.beginPath();
      traceChannel(c, m, s);
      c.stroke();
      const basin = look === 'four' ? s * 0.31 : look === 'well' ? s * 0.27 : m === 1 || m === 2 || m === 4 || m === 8 ? s * 0.2 : 0;
      if (basin) {
        c.beginPath();
        c.arc(0, 0, basin, 0, TAU);
        c.fill();
      }
      c.restore();
    };
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groove(gx, 0, 0);
    // clip the groove to the stone's face, so arms stop at its rounded edge
    gx.globalCompositeOperation = 'destination-in';
    gx.beginPath();
    roundRect(gx, 0.75, 0.75, s - 1.5, s - 1.5, s * 0.12);
    gx.fill();
    gx.globalCompositeOperation = 'source-in';
    const fill = gx.createLinearGradient(0, 0, s, s);
    fill.addColorStop(0, '#a8977b');
    fill.addColorStop(1, '#bcab8e');
    gx.fillStyle = fill;
    gx.fillRect(0, 0, s, s);
    // the walls: shadow along the upper left, light along the lower right
    const band = (dx: number, dy: number, color: string) => {
      const b = canvas(px, px), bx = b?.getContext('2d');
      if (!b || !bx) return;
      bx.setTransform(dpr, 0, 0, dpr, 0, 0);
      groove(bx, 0, 0);
      bx.globalCompositeOperation = 'destination-out';
      groove(bx, dx, dy);
      bx.globalCompositeOperation = 'source-in';
      bx.fillStyle = color;
      bx.fillRect(0, 0, s, s);
      gx.save();
      gx.globalCompositeOperation = 'source-atop';
      gx.setTransform(1, 0, 0, 1, 0, 0);
      gx.drawImage(b, 0, 0);
      gx.restore();
    };
    const k = Math.max(1.2, s * 0.045);
    band(k, k, 'rgba(70,52,30,.55)');
    band(-k * 0.7, -k * 0.7, 'rgba(255,250,236,.55)');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(g, 0, 0);
    ctx.restore();
  }
  if (look === 'well') {
    // the well's curb and its dark eye of water
    const r = s * 0.2;
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.lineWidth = s * 0.06;
    ctx.strokeStyle = '#efe5d2';
    ctx.beginPath();
    ctx.arc(0, 0, r + s * 0.05, 0, TAU);
    ctx.stroke();
    const eye = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
    eye.addColorStop(0, '#2b5f73');
    eye.addColorStop(1, '#0f2732');
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  if (look === 'four') {
    // the rosette's scalloped rim around its round basin
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.strokeStyle = 'rgba(120,98,66,.55)';
    ctx.lineWidth = Math.max(1, s * 0.018);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      ctx.moveTo(Math.cos(a) * s * 0.36 + Math.cos(a + 1.2) * s * 0.06, Math.sin(a) * s * 0.36 + Math.sin(a + 1.2) * s * 0.06);
      ctx.arc(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36, s * 0.06, a + 1.2, a - 1.2, true);
    }
    ctx.stroke();
    ctx.restore();
  }
  return cv;
}

function paintStoneBase(ctx: CanvasRenderingContext2D, s: number, look: StoneLook, m: number): void {
  const r = s * 0.12, g = 0.75;
  ctx.save();
  // the soft shadow it casts on the land
  ctx.fillStyle = 'rgba(80,60,40,.18)';
  ctx.beginPath();
  roundRect(ctx, g + s * 0.02, g + s * 0.035, s - 2 * g, s - 2 * g, r);
  ctx.fill();
  const face = ctx.createLinearGradient(0, 0, s, s);
  face.addColorStop(0, look === 'fixed' ? '#ede2cc' : '#f8f2e6');
  face.addColorStop(1, look === 'fixed' ? '#d6c7aa' : '#e2d5bc');
  ctx.fillStyle = face;
  ctx.beginPath();
  roundRect(ctx, g, g, s - 2 * g, s - 2 * g, r);
  ctx.fill();
  ctx.clip();
  // limestone grain: a few faint flecks and pores, the same for every stone of a kind
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 3 + m) * s, y = hash(i * 5 + 1 + m) * s;
    ctx.fillStyle = i % 3 ? 'rgba(150,128,96,.12)' : 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + hash(i + 40) * s * 0.012, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // the bevel: a lit rim along the top and left, shade along the bottom and right
  ctx.save();
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = 'rgba(255,253,246,.85)';
  ctx.beginPath();
  ctx.moveTo(g + r, g + 1);
  ctx.lineTo(s - g - r, g + 1);
  ctx.moveTo(g + 1, g + r);
  ctx.lineTo(g + 1, s - g - r);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(110,86,56,.35)';
  ctx.beginPath();
  ctx.moveTo(g + r, s - g - 1);
  ctx.lineTo(s - g - r, s - g - 1);
  ctx.moveTo(s - g - 1, g + r);
  ctx.lineTo(s - g - 1, s - g - r);
  ctx.stroke();
  if (look === 'fixed') {
    // a pre-set stone's carved double border
    ctx.strokeStyle = 'rgba(120,96,64,.5)';
    ctx.lineWidth = Math.max(1, s * 0.016);
    for (const k of [0.07, 0.115]) {
      ctx.beginPath();
      roundRect(ctx, s * k, s * k, s * (1 - 2 * k), s * (1 - 2 * k), s * 0.08);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── water ────────────────────────────────────────────────────────
/** Water standing in a channel's arm, from its outer end to `k` of the way in (k 0..1), or the reverse. */
export function strokeArm(ctx: CanvasRenderingContext2D, m: number, s: number, d: number, from: number, to: number): void {
  const h = s / 2;
  if (to <= from) return;
  if (isBend(m)) {
    const [a, b] = [0, 1, 2, 3].filter(x => m & BIT[x]);
    const cx = (DX[a] + DX[b]) * h, cy = (DY[a] + DY[b]) * h;
    const a0 = Math.atan2(DY[a] * h - cy, DX[a] * h - cx), a1 = Math.atan2(DY[b] * h - cy, DX[b] * h - cx);
    let span = a1 - a0;
    while (span > Math.PI) span -= TAU;
    while (span < -Math.PI) span += TAU;
    // the arm of side d runs from that side's end (0) to the arc's middle (1)
    const startA = d === a ? a0 : a1, dir = d === a ? span / 2 : -span / 2;
    const p0 = startA + dir * from, p1 = startA + dir * to;
    ctx.moveTo(cx + Math.cos(p0) * h, cy + Math.sin(p0) * h);
    ctx.arc(cx, cy, h, p0, p1, dir < 0);
    return;
  }
  const ex = DX[d] * h, ey = DY[d] * h;
  ctx.moveTo(ex * (1 - from), ey * (1 - from));
  ctx.lineTo(ex * (1 - to), ey * (1 - to));
}

// ── the land ─────────────────────────────────────────────────────
/**
 * Contour lines of a value-noise heightmap over a w × h area (marching squares at `levels` levels),
 * into `ctx` (the caller bakes them once).  Every third line is an index contour, a little darker.
 */
export function paintContours(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, o: { scale: number; levels: number; color: string; alpha: number; step?: number }): void {
  const step = o.step ?? 7, nx = Math.ceil(w / step) + 1, ny = Math.ceil(h / step) + 1;
  const f = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) f[j * nx + i] = fbm((i * step) / o.scale, (j * step) / o.scale, seed);
  ctx.save();
  ctx.strokeStyle = o.color;
  ctx.lineCap = 'round';
  for (let L = 0; L < o.levels; L++) {
    const iso = 0.3 + (L + 0.5) * (0.42 / o.levels);
    ctx.globalAlpha = o.alpha * (L % 3 === 1 ? 1.5 : 1);
    ctx.lineWidth = L % 3 === 1 ? 1.1 : 0.8;
    ctx.beginPath();
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = f[j * nx + i], b = f[j * nx + i + 1], c = f[(j + 1) * nx + i + 1], d = f[(j + 1) * nx + i];
        const k = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
        if (k === 0 || k === 15) continue;
        const x = i * step, y = j * step;
        const lerp = (p: number, q: number) => (iso - p) / (q - p || 1e-6);
        const top = [x + step * lerp(a, b), y], right = [x + step, y + step * lerp(b, c)];
        const bottom = [x + step * lerp(d, c), y + step], left = [x, y + step * lerp(a, d)];
        const seg = (p: number[], q: number[]) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        switch (k) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 10: seg(left, bottom); seg(top, right); break;
          default: break;
        }
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** A rose-rock outcrop filling a cell of size `s` at (x, y): an irregular slab with hatching and a cast shadow. */
export function paintRock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number): void {
  const cx = x + s / 2, cy = y + s / 2, n = 9;
  const pt = (i: number, grow: number) => {
    const a = (i / n) * TAU + hash(seed + i) * 0.3;
    const r = s * (0.36 + 0.1 * hash(seed * 7 + i)) + grow;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92];
  };
  const shape = (grow: number, dx: number, dy: number) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [px, py] = pt(i % n, grow);
      if (i) ctx.lineTo(px + dx, py + dy); else ctx.moveTo(px + dx, py + dy);
    }
    ctx.closePath();
  };
  ctx.save();
  ctx.fillStyle = 'rgba(90,58,44,.22)';
  shape(1, s * 0.05, s * 0.07);
  ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, '#dcae9b');
  g.addColorStop(0.55, C.rose);
  g.addColorStop(1, C.roseDeep);
  ctx.fillStyle = g;
  shape(0, 0, 0);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(110,62,48,.28)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = -s; k < s * 1.2; k += s * 0.11) {
    ctx.moveTo(x + k, y + s);
    ctx.lineTo(x + k + s * 0.7, y);
  }
  ctx.stroke();
  // a lit upper face
  ctx.fillStyle = 'rgba(255,236,224,.22)';
  shape(-s * 0.12, -s * 0.04, -s * 0.05);
  ctx.fill();
  ctx.restore();
}

/** A terraced field patch in a cell of size `s` at (x, y): ochre terraces around a basin (dry). */
export function paintFieldBed(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  const inset = s * 0.06;
  const g = ctx.createRadialGradient(x + s / 2, y + s / 2, s * 0.1, x + s / 2, y + s / 2, s * 0.7);
  g.addColorStop(0, '#d9be8f');
  g.addColorStop(1, '#c9a873');
  ctx.fillStyle = g;
  ctx.beginPath();
  roundRect(ctx, x + inset, y + inset, s - 2 * inset, s - 2 * inset, s * 0.2);
  ctx.fill();
  // two inner terrace lines
  ctx.strokeStyle = 'rgba(120,88,48,.38)';
  ctx.lineWidth = Math.max(1, s * 0.014);
  for (const k of [0.15, 0.24]) {
    ctx.beginPath();
    roundRect(ctx, x + s * k, y + s * k, s * (1 - 2 * k), s * (1 - 2 * k), s * 0.16);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,244,222,.5)';
  ctx.beginPath();
  roundRect(ctx, x + inset + 1, y + inset + 1, s - 2 * inset - 2, s - 2 * inset - 2, s * 0.2);
  ctx.stroke();
  ctx.restore();
}

/** The water colour of a pool at depth level `d` (0..4, fractional): turquoise at the ankle, pool blue for a river. */
export const poolColor = (d: number): string => mix(C.water, C.pool, Math.max(0, Math.min(1, (d - 1) / 3)));

// ── living things ────────────────────────────────────────────────
/**
 * A small bird seen from above and a little from the side (2–4 calligraphic strokes): the sparrow
 * round and brown with a short beak, the swallow navy with long wings, a forked tail and a rust
 * throat.  `flap` 0..1 opens the wings.  Size `s` is its length.
 */
export function paintBird(ctx: CanvasRenderingContext2D, kind: 'sparrow' | 'swallow', x: number, y: number, s: number, facing: number, flap = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing < 0 ? -1 : 1, 1);
  const body = kind === 'sparrow' ? C.sparrow : C.swallow;
  if (flap > 0.02) {
    ctx.strokeStyle = body;
    ctx.lineWidth = s * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.1);
    ctx.quadraticCurveTo(-s * 0.3, -s * (0.25 + 0.45 * flap), -s * 0.55, -s * (0.1 + 0.5 * flap));
    ctx.moveTo(s * 0.05, -s * 0.1);
    ctx.quadraticCurveTo(s * 0.1, -s * (0.3 + 0.4 * flap), -s * 0.05, -s * (0.2 + 0.6 * flap));
    ctx.stroke();
  }
  if (kind === 'swallow') {
    // forked tail
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, s * 0.02);
    ctx.lineTo(-s * 0.62, -s * 0.08);
    ctx.lineTo(-s * 0.36, s * 0.06);
    ctx.lineTo(-s * 0.6, s * 0.18);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = mix(C.sparrow, '#3c2a1c', 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, 0);
    ctx.lineTo(-s * 0.48, -s * 0.06);
    ctx.lineTo(-s * 0.45, s * 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.3, s * (kind === 'sparrow' ? 0.21 : 0.16), 0, 0, TAU);
  ctx.fill();
  // belly / throat
  ctx.fillStyle = kind === 'sparrow' ? C.sparrowLight : '#efe6d6';
  ctx.beginPath();
  ctx.ellipse(s * 0.04, s * 0.08, s * 0.2, s * 0.1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(s * 0.28, -s * 0.08, s * 0.13, 0, TAU);
  ctx.fill();
  if (kind === 'swallow') {
    ctx.fillStyle = C.throat;
    ctx.beginPath();
    ctx.arc(s * 0.33, -s * 0.01, s * 0.07, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#e8b04a';
  ctx.beginPath();
  ctx.moveTo(s * 0.4, -s * 0.1);
  ctx.lineTo(s * 0.5, -s * 0.06);
  ctx.lineTo(s * 0.39, -s * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#16120e';
  ctx.beginPath();
  ctx.arc(s * 0.31, -s * 0.11, Math.max(0.6, s * 0.03), 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A woven nest cup (size `s` across), with young raising their heads. */
export function paintNest(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, young: boolean, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(60,40,24,.25)';
  ctx.beginPath();
  ctx.ellipse(s * 0.06, s * 0.12, s * 0.55, s * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8a6a44';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.5, s * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#4e3a24';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.03, s * 0.32, s * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(196,160,108,.75)';
  ctx.lineWidth = Math.max(0.7, s * 0.05);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    ctx.moveTo(-s * 0.48 * Math.cos(a), s * 0.05 + Math.sin(a) * s * 0.18);
    ctx.quadraticCurveTo(0, s * 0.32, s * 0.48 * Math.cos(a + 0.4), s * 0.04);
  }
  ctx.stroke();
  if (young) {
    for (let i = 0; i < 3; i++) {
      const bob = Math.sin(t * 4 + i * 2) * s * 0.03;
      const hx = (i - 1) * s * 0.17, hy = -s * 0.12 + bob;
      ctx.fillStyle = '#8b7357';
      ctx.beginPath();
      ctx.arc(hx, hy, s * 0.09, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f2c84b';
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.04, hy - s * 0.05);
      ctx.lineTo(hx, hy - s * 0.15);
      ctx.lineTo(hx + s * 0.04, hy - s * 0.05);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A tiny pilgrim seen from above (4–6 px): a hooded head over a cloak; sitting is rounder, walking carries a staff. */
export function paintPilgrim(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, i: number, sitting: boolean): void {
  const cloak = ['#7b5e48', '#5e6a7a', '#8a6f3e', '#6f4f5a', '#556b52'][i % 5];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(40,30,20,.25)';
  ctx.beginPath();
  ctx.ellipse(s * 0.25, s * 0.4, s * 0.6, s * 0.28, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = cloak;
  ctx.beginPath();
  if (sitting) ctx.ellipse(0, s * 0.15, s * 0.55, s * 0.42, 0, 0, TAU);
  else ctx.ellipse(0, s * 0.2, s * 0.38, s * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d8c2a2';
  ctx.beginPath();
  ctx.arc(0, -s * 0.28, s * 0.24, 0, TAU);
  ctx.fill();
  if (!sitting) {
    ctx.strokeStyle = '#5a4430';
    ctx.lineWidth = Math.max(0.6, s * 0.1);
    ctx.beginPath();
    ctx.moveTo(s * 0.45, -s * 0.5);
    ctx.lineTo(s * 0.55, s * 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

export type TreeKind = 'olive' | 'almond' | 'fig' | 'pomegranate' | 'palm' | 'tamarisk';

/**
 * One of the day's trees, seen from above with its shadow (one painter, six kinds): `stage` 0 a
 * sapling, 1 young, 2 grown; `r` is a grown crown's radius.
 */
export function paintTree(ctx: CanvasRenderingContext2D, kind: TreeKind, x: number, y: number, r: number, stage: number, seed = 1): void {
  const k = stage === 0 ? 0.42 : stage === 1 ? 0.7 : 1;
  const R = r * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(52,44,30,.22)';
  ctx.beginPath();
  ctx.ellipse(R * 0.35, R * 0.4, R * 1.05, R * 0.75, 0.3, 0, TAU);
  ctx.fill();
  if (kind === 'palm') {
    ctx.strokeStyle = '#4f7a43';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, R * 0.16);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + seed;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7 - R * 0.2, Math.cos(a) * R * 1.15, Math.sin(a) * R * 1.15 + R * 0.15);
      ctx.stroke();
    }
    ctx.fillStyle = '#7a5a36';
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.16, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  const look: Record<Exclude<TreeKind, 'palm'>, { a: string; b: string; lobes: number; spread: number; dots?: string; blossom?: string }> = {
    olive: { a: '#9fb197', b: '#6f8a6a', lobes: 9, spread: 0.32 },
    almond: { a: '#f4dde3', b: '#d9b3be', lobes: 10, spread: 0.3, blossom: '#ffffff' },
    fig: { a: '#5f8a4c', b: '#35562f', lobes: 6, spread: 0.42 },
    pomegranate: { a: '#6f9254', b: '#46663a', lobes: 8, spread: 0.36, dots: '#c8372f' },
    tamarisk: { a: '#b2bfae', b: '#7f9481', lobes: 14, spread: 0.24 },
  };
  const L = look[kind];
  // a trunk peeking out where the crown thins
  ctx.strokeStyle = '#6d5236';
  ctx.lineWidth = Math.max(1, R * 0.14);
  ctx.beginPath();
  ctx.moveTo(-R * 0.1, R * 0.15);
  ctx.quadraticCurveTo(R * 0.2, R * 0.35, R * 0.05, R * 0.6);
  ctx.stroke();
  for (let i = 0; i < L.lobes; i++) {
    const a = (i / L.lobes) * TAU + hash(seed + i) * 0.5;
    const d = R * (0.45 + 0.15 * hash(seed * 3 + i));
    const lr = R * (L.spread + 0.14 * hash(seed * 5 + i));
    const g = ctx.createRadialGradient(Math.cos(a) * d - lr * 0.3, Math.sin(a) * d - lr * 0.3, lr * 0.1, Math.cos(a) * d, Math.sin(a) * d, lr);
    g.addColorStop(0, L.a);
    g.addColorStop(1, L.b);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, lr, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = L.a;
  ctx.beginPath();
  ctx.arc(-R * 0.08, -R * 0.08, R * 0.42, 0, TAU);
  ctx.fill();
  const flecks = L.dots ?? L.blossom;
  if (flecks && stage > 0) {
    ctx.fillStyle = flecks;
    for (let i = 0; i < 9; i++) {
      const a = hash(seed * 11 + i) * TAU, d = R * 0.75 * Math.sqrt(hash(seed * 13 + i));
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(0.7, R * 0.07), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── the album's places of water ─────────────────────────────────
/**
 * One of the six places of water in a w × h box at (x, y): Beer-lahai-roi's desert well with an
 * acacia at dusk, Rehoboth's well on an open plain, Elim's twelve springs among palms, the rock at
 * Horeb, Hezekiah's tunnel and Jacob's well at noon.  `dawn`: the morning light's gold rim and warm
 * wash.  `found` false draws its silhouette only.
 */
export function paintPlace(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, w: number, h: number, dawn: boolean, found = true): void {
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.14);
  ctx.clip();
  const skies = ['#d99a6c', '#e8d9b5', '#e4cf9f', '#d8c3a5', '#cdbfa8', '#f0dfb2'];
  const lands = ['#c69468', '#d8c39a', '#d3b680', '#c49a80', '#bfae90', '#ddc28e'];
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, found ? skies[id] : '#3a3a48');
  g.addColorStop(1, found ? lands[id] : '#2c2c38');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const u = Math.min(w, h);
  const ink = found ? null : 'rgba(255,255,255,.12)';
  const well = (cx: number, cy: number, r: number) => {
    ctx.fillStyle = ink ?? '#e9dfcc';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ink ?? '#1f4f62';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.05, r * 0.62, r * 0.32, 0, 0, TAU);
    ctx.fill();
    if (!ink) {
      ctx.strokeStyle = 'rgba(120,96,64,.55)';
      ctx.lineWidth = Math.max(0.6, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, TAU);
      ctx.stroke();
    }
  };
  const palm = (cx: number, cy: number, s: number) => {
    ctx.strokeStyle = ink ?? '#7a5a36';
    ctx.lineWidth = Math.max(0.8, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + s * 0.1, cy - s * 0.5, cx, cy - s);
    ctx.stroke();
    ctx.strokeStyle = ink ?? '#4f7a43';
    ctx.lineWidth = Math.max(0.8, s * 0.1);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.quadraticCurveTo(cx + Math.cos(a) * s * 0.4, cy - s - s * 0.25, cx + Math.cos(a) * s * 0.6, cy - s + s * 0.25 + Math.sin(a) * s * 0.05);
      ctx.stroke();
    }
  };
  const pool = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.fillStyle = ink ?? C.water;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
    if (!ink) {
      ctx.strokeStyle = 'rgba(207,246,243,.8)';
      ctx.lineWidth = Math.max(0.6, ry * 0.12);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.6, ry * 0.5, 0, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
    }
  };
  switch (id) {
    case 0: { // Beer-lahai-roi: a desert well, a lone acacia, dusk
      if (!ink) {
        ctx.fillStyle = 'rgba(255,224,170,.55)';
        ctx.beginPath();
        ctx.arc(x + w * 0.8, y + h * 0.32, u * 0.12, 0, TAU);
        ctx.fill();
      }
      well(x + w * 0.42, y + h * 0.68, u * 0.18);
      ctx.strokeStyle = ink ?? '#5a4430';
      ctx.lineWidth = Math.max(0.8, u * 0.03);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.74, y + h * 0.78);
      ctx.lineTo(x + w * 0.72, y + h * 0.5);
      ctx.stroke();
      ctx.fillStyle = ink ?? '#6b7a4a';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.72, y + h * 0.46, u * 0.2, u * 0.07, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 1: { // Rehoboth: a well on a wide open plain
      ctx.strokeStyle = ink ?? 'rgba(140,110,70,.35)';
      ctx.lineWidth = 0.8;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + h * (0.45 + i * 0.12));
        ctx.lineTo(x + w, y + h * (0.42 + i * 0.12));
        ctx.stroke();
      }
      well(x + w * 0.5, y + h * 0.62, u * 0.2);
      break;
    }
    case 2: { // Elim: twelve springs among seventy palms
      for (let i = 0; i < 12; i++) pool(x + w * (0.12 + (i % 6) * 0.15), y + h * (0.62 + Math.floor(i / 6) * 0.18), u * 0.045, u * 0.03);
      for (let i = 0; i < 7; i++) palm(x + w * (0.06 + i * 0.145), y + h * (0.5 + (i % 2) * 0.06), u * 0.3);
      break;
    }
    case 3: { // the rock at Horeb: water from a cleft into a pool
      ctx.fillStyle = ink ?? C.rose;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y + h * 0.72);
      ctx.lineTo(x + w * 0.28, y + h * 0.3);
      ctx.lineTo(x + w * 0.55, y + h * 0.18);
      ctx.lineTo(x + w * 0.8, y + h * 0.36);
      ctx.lineTo(x + w * 0.86, y + h * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ink ?? C.water;
      ctx.lineWidth = Math.max(1, u * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.52, y + h * 0.42);
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.62, x + w * 0.52, y + h * 0.8);
      ctx.stroke();
      pool(x + w * 0.52, y + h * 0.86, u * 0.26, u * 0.08);
      break;
    }
    case 4: { // Hezekiah's tunnel: a rock arch, a channel into a pool, a wall's stones above
      ctx.fillStyle = ink ?? '#b99a7e';
      ctx.fillRect(x, y + h * 0.18, w, h * 0.5);
      ctx.fillStyle = ink ? 'rgba(0,0,0,.2)' : '#2a2026';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.36, y + h * 0.68);
      ctx.lineTo(x + w * 0.36, y + h * 0.45);
      ctx.arc(x + w * 0.5, y + h * 0.45, w * 0.14, Math.PI, 0);
      ctx.lineTo(x + w * 0.64, y + h * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ink ?? 'rgba(90,64,48,.5)';
      ctx.lineWidth = 0.8;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 6; c++) {
          ctx.strokeRect(x + (c + (r % 2) * 0.5) * w * 0.18 - w * 0.05, y + h * (0.04 + r * 0.07), w * 0.18, h * 0.07);
        }
      }
      ctx.strokeStyle = ink ?? C.water;
      ctx.lineWidth = Math.max(1, u * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y + h * 0.66);
      ctx.lineTo(x + w * 0.5, y + h * 0.8);
      ctx.stroke();
      pool(x + w * 0.5, y + h * 0.86, u * 0.3, u * 0.08);
      break;
    }
    default: { // Jacob's well at noon: a round well, a water jar, a short shadow, a road passing
      ctx.strokeStyle = ink ?? 'rgba(150,120,80,.45)';
      ctx.lineWidth = Math.max(1, u * 0.08);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.1, y + h * 0.95);
      ctx.quadraticCurveTo(x + w * 0.4, y + h * 0.55, x + w * 1.1, y + h * 0.62);
      ctx.stroke();
      well(x + w * 0.42, y + h * 0.66, u * 0.2);
      ctx.fillStyle = ink ?? '#b5623b';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.72, y + h * 0.66, u * 0.06, u * 0.09, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(x + w * 0.72 - u * 0.025, y + h * 0.66 - u * 0.13, u * 0.05, u * 0.05);
      if (!ink) {
        ctx.fillStyle = 'rgba(255,248,214,.45)';
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y + h * 0.12, u * 0.16, 0, TAU);
        ctx.fill();
      }
      break;
    }
  }
  if (dawn && found) {
    ctx.fillStyle = 'rgba(255,214,140,.18)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  if (dawn && found) {
    ctx.save();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = Math.max(1.2, u * 0.035);
    ctx.beginPath();
    roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.min(w, h) * 0.14);
    ctx.stroke();
    ctx.restore();
  }
}
