/**
 * Źródła's drawing primitives (Canvas 2D, no assets), shared by the play view, the calibration
 * intro and the lobby preview: a pilgrim's valley seen from above.  Limestone land with contour
 * lines, carved channel stones (the seven of Pipe Mania and the pool), turquoise water — the one
 * saturated colour on the board — rose rock, the spring's well-head with its sluice gate, gardens
 * that green and bloom, tiny pilgrims, trees, and Kumka the tree frog in her straw hat.  Everything
 * is drawn in CSS pixels.
 */
import type { Kind } from './grid';
import type { TraceBar } from '../kit/trace';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const MONO = '"JetBrains Mono", monospace';

/** The palette: limestone, ochre and rose land; water the one saturated colour; sage green; the birds. */
export const C = {
  lime: '#E8DDC8', limeLight: '#F3ECDD', limeDeep: '#D9CBB0', groove: '#9C8B70', ochre: '#C7A46E', rose: '#C98F7A', roseDeep: '#9E6656',
  ink: '#2B2A33', inkSoft: 'rgba(43,42,51,.62)', water: '#2FB3C4', pool: '#1C6E96', foam: '#CFF6F3',
  sage: '#8FAF7E', olive: '#4F7A43', anemone: '#D2453B', crocus: '#9B7FD1', oleander: '#E79AB0',
  frog: '#6DBE4B', frogDeep: '#3F8A34', frogBelly: '#E3F2B8', straw: '#E7C46B', strawDeep: '#B98E3A', still: '#9FE3F0', clay: '#B9744F',
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


// ── the channels ─────────────────────────────────────────────────

/** The midpoint of side `d` of a cell of size `s` centred at (0, 0); side −1 is the middle. */
function sidePt(d: number, s: number): [number, number] {
  const h = s / 2;
  return d === 0 ? [0, -h] : d === 1 ? [h, 0] : d === 2 ? [0, h] : d === 3 ? [-h, 0] : [0, 0];
}

/**
 * A point `u` (0..1) of the way from side `a` to side `b` across a cell of size `s` centred at
 * (0, 0): straight when the sides face each other (or from the middle, a = −1), a quarter arc
 * around their shared corner when they meet.
 */
export function wayPoint(a: number, b: number, s: number, u: number): [number, number] {
  const [ax, ay] = sidePt(a, s), [bx, by] = sidePt(b, s);
  if (a < 0 || (a + 2) % 4 === b) return [ax + (bx - ax) * u, ay + (by - ay) * u];
  const cx = ax + bx, cy = ay + by;   // the shared corner
  const a0 = Math.atan2(ay - cy, ax - cx), a1 = Math.atan2(by - cy, bx - cx);
  let da = a1 - a0;
  if (da > Math.PI) da -= TAU;
  if (da < -Math.PI) da += TAU;
  const ang = a0 + da * u, r = s / 2;
  return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
}

/** Trace the way from side `a` to side `b`, from `u0` to `u1`, as a path in a cell centred at (cx, cy). */
export function tracePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, a: number, b: number, u0 = 0, u1 = 1): void {
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const u = u0 + (u1 - u0) * (i / n);
    const [x, y] = wayPoint(a, b, s, u);
    if (i) ctx.lineTo(cx + x, cy + y);
    else ctx.moveTo(cx + x, cy + y);
  }
}

/** The ways a stone holds, as side pairs (a cross has two). */
export function waysOf(kind: Kind): [number, number][] {
  switch (kind) {
    case 'h': case 'ph': return [[3, 1]];
    case 'v': case 'pv': return [[0, 2]];
    case 'ne': return [[0, 1]];
    case 'nw': return [[0, 3]];
    case 'se': return [[2, 1]];
    case 'sw': return [[2, 3]];
    case 'x': return [[3, 1], [0, 2]];
  }
}

export type StoneLook = 'laid' | 'aqueduct' | 'oneway' | 'queue' | 'ghost';

/**
 * A carved channel stone filling a cell of size `s` at (x, y): a limestone slab with a bevel and
 * the groove(s) of its kind; a pool has an oval basin; an old aqueduct is rose stone with arches;
 * a one-way stone has a chevron toward `oneway`.
 */
export function paintStone(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: Kind, look: StoneLook, seed = 1, oneway = -1): void {
  const cx = x + s / 2, cy = y + s / 2, inset = s * 0.05, r = s * 0.14;
  const ghost = look === 'ghost';
  ctx.save();
  if (ghost) ctx.globalAlpha *= 0.5;
  // the slab
  if (!ghost) {
    ctx.fillStyle = 'rgba(80,60,40,.25)';
    ctx.beginPath();
    roundRect(ctx, x + inset + s * 0.03, y + inset + s * 0.05, s - 2 * inset, s - 2 * inset, r);
    ctx.fill();
  }
  const aq = look === 'aqueduct';
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, aq ? '#e7c2b0' : '#f7f0e2');
  g.addColorStop(1, aq ? '#c48f78' : '#d8c8a8');
  ctx.fillStyle = g;
  ctx.beginPath();
  roundRect(ctx, x + inset, y + inset, s - 2 * inset, s - 2 * inset, r);
  ctx.fill();
  ctx.strokeStyle = aq ? 'rgba(120,64,48,.45)' : 'rgba(140,116,80,.45)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.stroke();
  // speckles
  ctx.fillStyle = aq ? 'rgba(110,60,44,.18)' : 'rgba(120,100,70,.16)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(x + s * (0.15 + 0.7 * hash(seed + i)), y + s * (0.15 + 0.7 * hash(seed * 3 + i)), Math.max(0.6, s * 0.012), 0, TAU);
    ctx.fill();
  }
  if (aq) {
    // arches along the slab's foot
    ctx.strokeStyle = 'rgba(110,60,44,.4)';
    ctx.lineWidth = Math.max(1, s * 0.018);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + s * (0.25 + i * 0.25), y + s * 0.92, s * 0.08, Math.PI, 0);
      ctx.stroke();
    }
  }
  // the groove
  ctx.lineCap = 'butt';
  for (const [a, b] of waysOf(kind)) {
    ctx.strokeStyle = aq ? '#8a5644' : C.groove;
    ctx.lineWidth = s * 0.3;
    ctx.beginPath();
    tracePath(ctx, cx, cy, s, a, b);
    ctx.stroke();
    ctx.strokeStyle = aq ? '#a8705c' : '#b9a684';
    ctx.lineWidth = s * 0.2;
    ctx.beginPath();
    tracePath(ctx, cx, cy, s, a, b);
    ctx.stroke();
  }
  if (kind === 'x') {
    // the crossing: the north–south groove passes under a slab bridge
    ctx.fillStyle = aq ? '#d9a893' : '#e9dcc3';
    ctx.fillRect(cx - s * 0.15, cy - s * 0.06, s * 0.3, s * 0.12);
  }
  if (kind === 'ph' || kind === 'pv') {
    ctx.fillStyle = C.groove;
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.3, s * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b9a684';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.24, s * 0.24, 0, 0, TAU);
    ctx.fill();
  }
  if (oneway >= 0) {
    const [dx, dy] = sidePt(oneway, 1);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.lineCap = 'round';
    for (const k of [-0.12, 0.08]) {
      ctx.beginPath();
      ctx.moveTo(s * (k - 0.06), -s * 0.08);
      ctx.lineTo(s * (k + 0.04), 0);
      ctx.lineTo(s * (k - 0.06), s * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Water along a way from side `a` to side `b` (u0..u1) in a cell centred at (cx, cy): a turquoise
 * stream with a light edge and ripples drifting at `flow` (cells per second, 0 = still).
 */
export function paintWater(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, a: number, b: number, u0: number, u1: number,
  o: { t: number; flow: number; still: boolean; color?: string; width?: number }): void {
  if (u1 <= u0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const w = s * (o.width ?? 0.17);
  ctx.strokeStyle = o.color ?? C.water;
  ctx.lineWidth = w;
  ctx.beginPath();
  tracePath(ctx, cx, cy, s, a, b, u0, u1);
  ctx.stroke();
  // ripples
  ctx.strokeStyle = o.still ? 'rgba(255,255,255,.75)' : 'rgba(207,246,243,.8)';
  ctx.lineWidth = Math.max(1, w * 0.28);
  ctx.setLineDash([s * 0.07, s * 0.16]);
  ctx.lineDashOffset = o.still ? 0 : -o.t * s * Math.max(0.25, o.flow) * 1.2;
  ctx.beginPath();
  tracePath(ctx, cx, cy, s, a, b, u0, u1);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  ctx.restore();
}

/** A pool's basin filling (0..1) at the cell centred at (cx, cy). */
export function paintPoolFill(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, fill: number, t: number): void {
  if (fill <= 0) return;
  ctx.save();
  ctx.fillStyle = mix(C.water, C.pool, 0.35);
  ctx.globalAlpha = 0.35 + 0.65 * fill;
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.24 * Math.sqrt(fill), s * 0.24 * Math.sqrt(fill), 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(207,246,243,.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.16 * fill * (0.8 + 0.2 * Math.sin(t * 3)), s * 0.16 * fill, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/**
 * The spring's well-head in a cell of size `s` at (x, y): a ring of stones around a bubbling pool,
 * its outlet groove toward side `dir`, and the wooden sluice gate across the outlet, lowered by
 * `gate` (0 open … 1 nearly shut).  `count` 0..1 is the countdown's ring (null when the water runs).
 */
export function paintSpring(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, o: { t: number; gate: number; count: number | null; running: boolean; still: boolean; hidden: boolean }): void {
  const cx = x + s / 2, cy = y + s / 2;
  ctx.save();
  // the outlet groove
  ctx.lineCap = 'butt';
  ctx.strokeStyle = C.groove;
  ctx.lineWidth = s * 0.3;
  ctx.beginPath();
  tracePath(ctx, cx, cy, s, -1, dir);
  ctx.stroke();
  // the stone ring
  ctx.fillStyle = 'rgba(70,52,36,.28)';
  ctx.beginPath();
  ctx.arc(cx + s * 0.03, cy + s * 0.05, s * 0.4, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    ctx.fillStyle = i % 2 ? '#d9c9aa' : '#e8dcc4';
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * s * 0.32, cy + Math.sin(a) * s * 0.32, s * 0.11, s * 0.09, a, 0, TAU);
    ctx.fill();
  }
  // the pool
  const g = ctx.createRadialGradient(cx - s * 0.06, cy - s * 0.06, s * 0.02, cx, cy, s * 0.27);
  g.addColorStop(0, o.still ? C.still : C.foam);
  g.addColorStop(0.45, C.water);
  g.addColorStop(1, C.pool);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.25, 0, TAU);
  ctx.fill();
  // bubbles: quicker while the water runs, none while it stands still
  if (!o.still) {
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 1;
    const k = o.running ? 1.6 : 0.8;
    for (let i = 0; i < 3; i++) {
      const p = (o.t * k * (1 - o.gate * 0.6) + i / 3) % 1;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.arc(cx, cy, s * (0.04 + 0.2 * p), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // the countdown ring
  if (o.count !== null) {
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.44, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, o.count)));
    ctx.stroke();
  }
  // the sluice gate across the outlet
  const [ox, oy] = sidePt(dir, s);
  const gx = cx + ox * 0.62, gy = cy + oy * 0.62;
  ctx.translate(gx, gy);
  ctx.rotate(dir === 0 || dir === 2 ? 0 : Math.PI / 2);
  ctx.fillStyle = '#6d4c2f';
  ctx.fillRect(-s * 0.2, -s * 0.05, s * 0.04, s * 0.1);
  ctx.fillRect(s * 0.16, -s * 0.05, s * 0.04, s * 0.1);
  if (!o.hidden) {
    const shut = Math.max(0, Math.min(1, o.gate));
    ctx.fillStyle = shut > 0.5 ? C.gold : '#a77a4c';
    ctx.fillRect(-s * 0.17, -s * 0.035, s * 0.34 * (0.15 + 0.85 * shut), s * 0.07);
  }
  ctx.restore();
}

/** The garden a valley's water must reach: a walled plot with a fig tree, its gate toward side `dir`. */
export function paintGardenEnd(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, wet: boolean, t: number): void {
  const cx = x + s / 2, cy = y + s / 2;
  ctx.save();
  ctx.fillStyle = wet ? '#8fc46e' : '#c9b98a';
  ctx.beginPath();
  roundRect(ctx, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, s * 0.12);
  ctx.fill();
  ctx.strokeStyle = '#a58a62';
  ctx.lineWidth = s * 0.07;
  ctx.stroke();
  // the gate
  const [ox, oy] = sidePt(dir, s);
  ctx.strokeStyle = wet ? C.water : C.groove;
  ctx.lineWidth = s * 0.22;
  ctx.beginPath();
  ctx.moveTo(cx + ox, cy + oy);
  ctx.lineTo(cx + ox * 0.45, cy + oy * 0.45);
  ctx.stroke();
  paintTree(ctx, 'fig', cx - s * 0.04, cy - s * 0.02, s * 0.26, wet ? 2 : 1, 5);
  if (wet) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t * 0.3;
      paintFlower(ctx, cx + Math.cos(a) * s * 0.34, cy + Math.sin(a) * s * 0.34, s * 0.07, i, t);
    }
  } else {
    // a little banner: the goal
    ctx.fillStyle = 'rgba(255,248,230,.9)';
    ctx.beginPath();
    ctx.arc(cx + s * 0.28, cy - s * 0.28, s * 0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.water;
    ctx.beginPath();
    ctx.arc(cx + s * 0.28, cy - s * 0.28, s * 0.05 * (1 + 0.15 * Math.sin(t * 4)), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** One flower: anemone red, crocus purple or oleander pink, with a little sway. */
export function paintFlower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, i: number, t: number): void {
  const col = [C.anemone, C.crocus, C.oleander, '#F2D24B'][i % 4];
  const sw = Math.sin(t * 2 + i) * r * 0.15;
  ctx.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + i;
    ctx.beginPath();
    ctx.arc(x + sw + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.48, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(x + sw, y, r * 0.3, 0, TAU);
  ctx.fill();
}

/** The garden calm grows on a wet cell: grass tufts in its corners as `green` rises, flowers in bloom. */
export function paintGreen(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, green: number, bloom: boolean, seed: number, t: number): void {
  if (green <= 0.02) return;
  ctx.save();
  ctx.fillStyle = `rgba(143,175,126,${(0.18 + 0.32 * green).toFixed(3)})`;
  ctx.beginPath();
  roundRect(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.16);
  ctx.fill();
  const tufts = 4 + Math.floor(green * 6);
  ctx.strokeStyle = C.olive;
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.lineCap = 'round';
  for (let i = 0; i < tufts; i++) {
    const corner = i % 4;
    const px = x + s * ((corner % 2 ? 0.82 : 0.18) + (hash(seed + i) - 0.5) * 0.16);
    const py = y + s * ((corner > 1 ? 0.84 : 0.16) + (hash(seed * 3 + i) - 0.5) * 0.16);
    const hgt = s * 0.12 * Math.min(1, green * 1.4);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + k * hgt * 0.3, py - hgt * 0.6, px + k * hgt * 0.5 + Math.sin(t * 1.5 + i) * 1.2, py - hgt);
      ctx.stroke();
    }
  }
  if (bloom) for (let i = 0; i < 4; i++) {
    const corner = i % 4;
    paintFlower(ctx, x + s * (corner % 2 ? 0.8 : 0.2), y + s * (corner > 1 ? 0.78 : 0.22), s * 0.075, seed + i, t);
  }
  ctx.restore();
}

// ── Kumka ────────────────────────────────────────────────────────
export interface FrogPose {
  t: number;
  /** 0..1: the eyes shut */
  blink: number;
  /** the mouth moves (talking) */
  talk: boolean;
  /** 0..1 up: a hop */
  hop: number;
  /** −1..1: where she looks */
  look: number;
  /** cheering arms up */
  cheer: boolean;
}

/** Kumka the tree frog in her pilgrim's straw hat, sitting; (x, y) is her feet's middle, `s` her height. */
export function paintFrog(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: FrogPose): void {
  const lift = p.hop * s * 0.25;
  const squash = 1 + Math.sin(p.t * 2.2) * 0.02 - p.hop * 0.06;
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(40,40,20,.22)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42 * (1 - p.hop * 0.3), s * 0.08, 0, 0, TAU);
  ctx.fill();
  ctx.translate(0, -lift);
  ctx.scale(1 / squash, squash);
  // back legs
  ctx.fillStyle = C.frogDeep;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(k * s * 0.3, -s * 0.12, s * 0.18, s * 0.12, k * 0.4, 0, TAU);
    ctx.fill();
  }
  // body
  const g = ctx.createRadialGradient(-s * 0.08, -s * 0.42, s * 0.05, 0, -s * 0.3, s * 0.42);
  g.addColorStop(0, '#8fd86a');
  g.addColorStop(1, C.frog);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.3, s * 0.34, s * 0.3, 0, 0, TAU);
  ctx.fill();
  // belly
  ctx.fillStyle = C.frogBelly;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.2, s * 0.2, s * 0.17, 0, 0, TAU);
  ctx.fill();
  // front arms with orange toe pads
  for (const k of [-1, 1]) {
    const up = p.cheer ? 1 : 0;
    const hx = k * s * (0.22 + up * 0.12), hy = -s * (0.06 + up * 0.5);
    ctx.strokeStyle = C.frog;
    ctx.lineWidth = s * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(k * s * 0.18, -s * 0.24);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = '#F2A04A';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(hx + i * s * 0.035, hy + (up ? -s * 0.03 : s * 0.02), s * 0.025, 0, TAU);
      ctx.fill();
    }
  }
  // eyes
  for (const k of [-1, 1]) {
    const ex = k * s * 0.17, ey = -s * 0.56;
    ctx.fillStyle = C.frog;
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fffdf2';
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.105, 0, TAU);
    ctx.fill();
    if (p.blink < 0.6) {
      ctx.fillStyle = '#1c1a17';
      ctx.beginPath();
      ctx.ellipse(ex + p.look * s * 0.03, ey + s * 0.01, s * 0.06, s * 0.07 * (1 - p.blink), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + p.look * s * 0.03 - s * 0.02, ey - s * 0.02, s * 0.02, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = C.frogDeep;
      ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.beginPath();
      ctx.arc(ex, ey - s * 0.01, s * 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  // cheeks and mouth
  ctx.fillStyle = 'rgba(242,140,120,.45)';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(k * s * 0.2, -s * 0.36, s * 0.05, s * 0.03, 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = C.frogDeep;
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  const open = p.talk ? Math.abs(Math.sin(p.t * 14)) : 0;
  if (open > 0.3) {
    ctx.fillStyle = '#7a2e2a';
    ctx.ellipse(0, -s * 0.38, s * 0.08, s * 0.04 * open, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.arc(0, -s * 0.42, s * 0.12, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  // the straw hat, tilted
  ctx.save();
  ctx.translate(s * 0.02, -s * 0.7);
  ctx.rotate(-0.18 + Math.sin(p.t * 1.3) * 0.03);
  ctx.fillStyle = C.strawDeep;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.02, s * 0.36, s * 0.07, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.straw;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.34, s * 0.06, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, 0);
  ctx.quadraticCurveTo(-s * 0.15, -s * 0.18, 0, -s * 0.19);
  ctx.quadraticCurveTo(s * 0.15, -s * 0.18, s * 0.16, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.water;
  ctx.fillRect(-s * 0.16, -s * 0.05, s * 0.32, s * 0.035);
  ctx.restore();
  ctx.restore();
}

/** Kumka's speech bubble: wrapped text, a tail toward (tx, ty); returns nothing, fits inside [0, w]. */
export function paintBubble(ctx: CanvasRenderingContext2D, text: string, tx: number, ty: number, maxW: number, w: number, alpha: number, above = true): void {
  const size = Math.max(11, Math.min(15, maxW / 16));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font(600, size, SANS);
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const wd of words) {
    const nx = line ? `${line} ${wd}` : wd;
    if (line && ctx.measureText(nx).width > maxW - 20) { lines.push(line); line = wd; } else line = nx;
  }
  if (line) lines.push(line);
  const lh = size * 1.25;
  const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 20);
  const bh = lines.length * lh + 14;
  const bx = Math.max(6, Math.min(w - bw - 6, tx - bw * 0.3));
  const by = above ? ty - bh - 12 : ty + 12;
  ctx.fillStyle = 'rgba(40,30,20,.18)';
  ctx.beginPath();
  roundRect(ctx, bx + 2, by + 3, bw, bh, 12);
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  roundRect(ctx, bx, by, bw, bh, 12);
  ctx.fill();
  ctx.beginPath();
  const tx2 = Math.max(bx + 14, Math.min(bx + bw - 14, tx));
  if (above) { ctx.moveTo(tx2 - 7, by + bh - 1); ctx.lineTo(tx, ty - 2); ctx.lineTo(tx2 + 7, by + bh - 1); } else { ctx.moveTo(tx2 - 7, by + 1); ctx.lineTo(tx, ty + 2); ctx.lineTo(tx2 + 7, by + 1); }
  ctx.fill();
  ctx.strokeStyle = 'rgba(79,122,67,.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundRect(ctx, bx, by, bw, bh, 12);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + 10, by + 7 + i * lh));
  ctx.restore();
}

// ── the gauge ────────────────────────────────────────────────────
export interface GaugeState {
  /** the sluice 0..1 (0.5 = the threshold), null: hidden */
  value: number | null;
  /** the charge of the still water 0..1 */
  charge: number;
  still: number;
  /** the countdown's seconds (null: the water runs) */
  count: number | null;
  /** the rest's green 0..1 (null: not a rest) */
  green: number | null;
  hidden: boolean;
  label: string;
  thr: string;
  sub: string;
  t: number;
}

/**
 * The spring's manometer: a dial over 240°, its threshold mark at the top (the panel's "próg"),
 * gold beyond it; the needle is the sluice; the charge of the still water fills the outer ring;
 * in a rest a green arc of calm; underground (blind) it is covered with earth.
 */
export function paintGauge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, g: GaugeState): void {
  const a0 = Math.PI * (5 / 6) , sweep = Math.PI * (4 / 3);
  const ang = (v: number) => a0 + sweep * Math.max(0, Math.min(1, v));
  ctx.save();
  // the housing
  ctx.fillStyle = 'rgba(60,44,30,.28)';
  ctx.beginPath();
  ctx.arc(x + r * 0.05, y + r * 0.08, r * 1.08, 0, TAU);
  ctx.fill();
  const hg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  hg.addColorStop(0, '#e9d6a8');
  hg.addColorStop(1, '#a9824c');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.06, 0, TAU);
  ctx.fill();
  ctx.fillStyle = g.still > 0 ? '#e9fbff' : '#fbf5e6';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.9, 0, TAU);
  ctx.fill();
  // the charge ring
  if (g.charge > 0 || g.still > 0) {
    ctx.strokeStyle = g.still > 0 ? C.still : C.water;
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.0, -Math.PI / 2, -Math.PI / 2 + TAU * (g.still > 0 ? 1 : Math.min(1, g.charge)));
    ctx.stroke();
  }
  // the scale: cool below the threshold, gold above
  ctx.lineCap = 'butt';
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = 'rgba(47,179,196,.35)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, ang(0), ang(0.5));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(244,199,107,.85)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, ang(0.5), ang(1));
  ctx.stroke();
  if (g.green !== null) {
    ctx.strokeStyle = C.olive;
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.52, ang(0), ang(g.green));
    ctx.stroke();
  }
  // ticks
  ctx.strokeStyle = 'rgba(43,42,51,.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const a = ang(i / 8);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78);
    ctx.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86);
    ctx.stroke();
  }
  // the threshold mark
  const at = ang(0.5);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(at) * r * 0.58, y + Math.sin(at) * r * 0.58);
  ctx.lineTo(x + Math.cos(at) * r * 0.92, y + Math.sin(at) * r * 0.92);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.font = font(700, Math.max(9, r * 0.15), SANS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(g.thr, x, y - r * 1.1);
  if (g.hidden) {
    // underground: earth over the dial
    ctx.fillStyle = '#8a6a4a';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,210,.85)';
    ctx.font = font(700, Math.max(10, r * 0.2), SANS);
    ctx.textBaseline = 'middle';
    ctx.fillText(g.sub, x, y);
  } else if (g.value !== null) {
    // the needle
    const a = ang(g.value);
    ctx.strokeStyle = g.value >= 0.5 ? '#b5532e' : C.pool;
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * r * 0.12, y - Math.sin(a) * r * 0.12);
    ctx.lineTo(x + Math.cos(a) * r * 0.76, y + Math.sin(a) * r * 0.76);
    ctx.stroke();
  }
  ctx.fillStyle = '#6d4c2f';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.09, 0, TAU);
  ctx.fill();
  // the centre's word: the countdown, still, or the pace
  if (!g.hidden) {
    ctx.textBaseline = 'middle';
    if (g.count !== null) {
      ctx.fillStyle = C.pool;
      ctx.font = font(800, r * 0.42, SANS);
      ctx.fillText(String(Math.max(0, Math.ceil(g.count))), x, y + r * 0.42);
    } else if (g.still > 0) {
      ctx.fillStyle = C.pool;
      ctx.font = font(800, r * 0.22, SANS);
      ctx.fillText(g.sub, x, y + r * 0.45);
    } else {
      ctx.fillStyle = C.inkSoft;
      ctx.font = font(700, r * 0.18, SANS);
      ctx.fillText(g.sub, x, y + r * 0.45);
    }
  }
  // the label under the dial
  ctx.fillStyle = C.ink;
  ctx.font = font(800, Math.max(11, r * 0.2), SANS);
  ctx.textBaseline = 'top';
  ctx.fillText(g.label, x, y + r * 1.14);
  ctx.restore();
}

/** The band's last 40 s as reeds along the valley's foot: gold heads above the threshold, cool behind a rest, gaps without signal. */
export function paintReeds(ctx: CanvasRenderingContext2D, bars: TraceBar[], x: number, y: number, w: number, h: number): void {
  const n = bars.length;
  if (!n) return;
  const dx = w / n;
  ctx.save();
  ctx.lineCap = 'round';
  bars.forEach((b, i) => {
    const px = x + (i + 0.5) * dx;
    if (b.phase === 'rest') {
      ctx.fillStyle = 'rgba(47,179,196,.12)';
      ctx.fillRect(px - dx / 2, y, dx, h);
    }
    if (b.empty) return;
    if (!b.reliable) {
      ctx.fillStyle = 'rgba(120,100,70,.35)';
      ctx.fillRect(px - 1, y + h - 2, 2, 2);
      return;
    }
    const hh = h * (0.2 + 0.8 * b.level);
    ctx.globalAlpha = b.shown;
    ctx.strokeStyle = '#7d9a5e';
    ctx.lineWidth = Math.max(1, dx * 0.32);
    ctx.beginPath();
    ctx.moveTo(px, y + h);
    ctx.lineTo(px + Math.sin(i) * 0.6, y + h - hh);
    ctx.stroke();
    ctx.fillStyle = b.above ? C.gold : '#8c6d4a';
    ctx.beginPath();
    ctx.ellipse(px, y + h - hh, Math.max(1, dx * 0.3), Math.max(1.5, h * 0.12), 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  // the threshold line
  ctx.strokeStyle = 'rgba(43,42,51,.35)';
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + h - h * 0.6);
  ctx.lineTo(x + w, y + h - h * 0.6);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  ctx.restore();
}
