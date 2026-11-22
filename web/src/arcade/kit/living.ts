/**
 * A living picture (round 12, 2026-11-22): the player's own photo, gently animated, with depth.
 *
 * The founder: *"I want to be able to choose for the picture to be moving, like animated (I can choose options
 * that will be generated for an uploaded picture). Is there some solution that can easily animate a picture
 * slightly? Also use parallax."*
 *
 * The usual ways to bring a still photo to life are (a) an AI image-to-video model (realistic, but the photo
 * would have to leave the device, it costs per clip and needs a server) and (b) the "3D photo" effect: a depth
 * map splits the picture into planes that move against each other (parallax), with a few loops on top — a
 * slow breath of zoom, light gliding over the bright parts, mist drifting through the distance, ripples on
 * water.  This module is (b), entirely on the device, in a few milliseconds, with no download: the app's
 * promise that an own picture never leaves the device holds.  (A learned depth model — Depth Anything in
 * the browser — would sharpen the planes; it costs a 25–50 MB download, so it is left for later.)
 *
 *   analyseLiving   the picture's depth (near 1 … far 0), guessed from where things are (the bottom of a photo
 *                   is near, open sky is far), from detail (what is in focus is near) and from its heart (the
 *                   subject), smoothed along its colour edges; its sky, its water (and the horizon), its glints;
 *                   and from those the motions worth offering, best first — "generated for this picture"
 *   LivingPicture   draws one frame of a chosen motion: 4 planes cut from the depth (each plane's hidden
 *                   back filled in, so a moving edge never shows a ghost of what stood in front), offset by a
 *                   slow orbit or the mouse / the phone's tilt, then the motion's own layer
 *
 * Pure parts (analysis, fill-in, poses) run in tests; LivingPicture needs canvases.
 */
import { mulberry32 } from '../../core/random';
import { clamp } from './juice';
import { edgeMap, type Pixels, type Pt } from './mosaic';

// ── what the player chooses ───────────────────────────────────────────

/** The motion over the picture: none, a breath of zoom, gliding light, drifting mist, rippling water. */
export type MotionKind = 'still' | 'breath' | 'light' | 'mist' | 'water';
export const MOTION_KINDS: readonly MotionKind[] = ['still', 'breath', 'light', 'mist', 'water'];

/** A picture's motion as kept with it (kit/images.ts `StoredImage.motion`). */
export interface Motion {
  kind: MotionKind;
  /** the planes move against each other (depth) */
  parallax: boolean;
}

export const MOTION_NONE: Motion = { kind: 'still', parallax: false };

/** Anything moves at all. */
export const isMoving = (m: Motion | null | undefined): boolean => !!m && (m.kind !== 'still' || m.parallax);

/** A saved motion, checked (null: none saved, or not one of ours). */
export function cleanMotion(v: unknown): Motion | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Partial<Motion>;
  if (!MOTION_KINDS.includes(o.kind as MotionKind)) return null;
  return { kind: o.kind as MotionKind, parallax: o.parallax === true };
}

/** The motion a picture plays with: the saved one, else the one recommended for it with depth; a device asking for less motion gets none. */
export function motionFor(saved: Motion | null | undefined, a: Pick<LivingAnalysis, 'recommended'> | null, reduced: boolean): Motion {
  if (reduced) return MOTION_NONE;
  return saved ?? (a ? { kind: a.recommended, parallax: true } : MOTION_NONE);
}

// ── the analysis ──────────────────────────────────────────────────────

/** A coarse grid over the picture (row-major, w × h values). */
export interface Grid { w: number; h: number; v: Float32Array }

export interface LivingAnalysis {
  /** the picture's aspect (w / h) */
  aspect: number;
  /** near 1 … far 0, smoothed along the picture's colour edges */
  depth: Grid;
  /** the depths that cut it into 4 planes (far → near: everything, then ≥ cuts[0], ≥ cuts[1], ≥ cuts[2]) */
  cuts: [number, number, number];
  /** the share of the picture that is open sky (reached from its top edge), 0..1 */
  sky: number;
  /** water below a horizon (0..1 of the height) and how sure (0..1), or null */
  water: { horizon: number; score: number } | null;
  /** small bright places that may glint (0..1 coordinates), brightest first, at most 8 */
  glints: Pt[];
  /** the share of bright light, 0..1 */
  light: number;
  /** the motions worth offering for this picture, best first ('still' always last) */
  options: MotionKind[];
  recommended: MotionKind;
}

const lumOf = (r: number, g: number, b: number): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const smoothstep = (a: number, b: number, x: number): number => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** The value at quantile q (0..1) of an array (a copy is sorted). */
export function quantile(v: ArrayLike<number>, q: number): number {
  const s = Float32Array.from(v).sort();
  if (!s.length) return 0;
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
}

/** Bilinear sample of a grid at (u, v) in 0..1. */
export function sampleGrid(g: Grid, u: number, v: number): number {
  const x = clamp(u * g.w - 0.5, 0, g.w - 1), y = clamp(v * g.h - 0.5, 0, g.h - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(g.w - 1, x0 + 1), y1 = Math.min(g.h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const a = g.v[y0 * g.w + x0], b = g.v[y0 * g.w + x1], c = g.v[y1 * g.w + x0], d = g.v[y1 * g.w + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * The picture's depth and what in it may move, from its pixels (and its edge map and heart, when the caller
 * has them already).  ≈ 2–6 ms for a 600 × 700 picture: the work is on a grid of at most 96 columns.
 */
export function analyseLiving(px: Pixels, edges?: Float32Array, heart?: Pt): LivingAnalysis {
  const W = px.width, H = px.height;
  const gw = Math.max(4, Math.min(96, W)), gh = Math.max(4, Math.min(160, Math.round(gw * (H / W))));
  const n = gw * gh;
  const e = edges && edges.length === W * H ? edges : edgeMap(px);
  // the grid's mean colour and detail
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), D = new Float32Array(n), Lm = new Float32Array(n);
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor((gy * H) / gh), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * H) / gh));
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor((gx * W) / gw), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * W) / gw));
      let r = 0, g = 0, b = 0, d = 0, c = 0;
      const step = Math.max(1, Math.floor((x1 - x0) / 6));
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const i = y * W + x, j = i * 4;
          r += px.data[j]; g += px.data[j + 1]; b += px.data[j + 2]; d += e[i]; c++;
        }
      }
      const k = gy * gw + gx;
      R[k] = r / c; G[k] = g / c; B[k] = b / c; D[k] = d / c; Lm[k] = lumOf(R[k], G[k], B[k]);
    }
  }
  // detail, spread a little (an in-focus subject is near) and scaled by its 90th percentile
  const det = boxBlur(D, gw, gh, 2);
  const p90 = Math.max(1e-3, quantile(det, 0.9));
  for (let i = 0; i < n; i++) det[i] = Math.min(1, det[i] / p90);

  // open sky: smooth, bright or blue, in the upper part, reached from the top edge
  const skyLike = (k: number): boolean => {
    const v = (Math.floor(k / gw) + 0.5) / gh;
    if (v > 0.7 || D[k] > 0.16) return false;
    const r = R[k], g = G[k], b = B[k];
    return Lm[k] > 0.55 || (b > r + 8 && b >= g - 8 && Lm[k] > 0.25);
  };
  const sky = new Uint8Array(n);
  const stack: number[] = [];
  for (let x = 0; x < gw; x++) if (skyLike(x)) { sky[x] = 1; stack.push(x); }
  while (stack.length) {
    const k = stack.pop()!, x = k % gw, y = (k - x) / gw;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const m = ny * gw + nx;
      if (!sky[m] && skyLike(m)) { sky[m] = 1; stack.push(m); }
    }
  }
  let skyN = 0;
  for (let i = 0; i < n; i++) skyN += sky[i];
  const skyF = boxBlur(Float32Array.from(sky), gw, gh, 1);

  // the heart: the subject (the caller's, else the centre of detail pulled to the middle)
  let hu = 0.5, hv = 0.5;
  if (heart) { hu = clamp(heart.x / W); hv = clamp(heart.y / H); }
  else {
    let sx = 0, sy = 0, sw = 0;
    for (let i = 0; i < n; i++) { const w = det[i] * det[i]; sx += w * ((i % gw) + 0.5) / gw; sy += w * (Math.floor(i / gw) + 0.5) / gh; sw += w; }
    if (sw > 0) { hu = 0.5 + 0.6 * (sx / sw - 0.5); hv = 0.5 + 0.6 * (sy / sw - 0.5); }
  }
  const asp = W / H;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = ((i % gw) + 0.5) / gw, v = (Math.floor(i / gw) + 0.5) / gh;
    const du = (u - hu) * Math.sqrt(asp), dv = (v - hv) / Math.sqrt(asp);
    const heartK = Math.exp(-(du * du + dv * dv) / (2 * 0.2 * 0.2));
    raw[i] = (0.42 * v + 0.33 * heartK + 0.25 * det[i]) * (1 - 0.9 * skyF[i]);
  }
  // to 0..1 by its 3rd and 97th percentiles, then smoothed along the colour edges (a plane ends where the colour does)
  const lo = quantile(raw, 0.03), hi = Math.max(lo + 1e-3, quantile(raw, 0.97));
  let depth: Float32Array = raw.map(x => clamp((x - lo) / (hi - lo)));
  for (let it = 0; it < 3; it++) depth = crossBilateral(depth, R, G, B, gw, gh, 2, 1.6, 26);
  const cuts: [number, number, number] = [quantile(depth, 0.38), quantile(depth, 0.62), quantile(depth, 0.84)];

  // water: blue-green and fairly smooth, in rows from a horizon down to the bottom
  const waterLike = (k: number): boolean => {
    const r = R[k], g = G[k], b = B[k], l = Lm[k];
    return l > 0.1 && l < 0.93 && D[k] < 0.4 && ((b > r + 6 && b > g - 20) || (g > r + 4 && b > r + 4));
  };
  // a water row: mostly water-like across, and water at both edges (a lake or the sea spans the picture; a blue
  // shirt or a car in the middle does not)
  const edge = Math.max(1, Math.round(gw * 0.12));
  const rowWater = new Uint8Array(gh);
  for (let y = 0; y < gh; y++) {
    let c = 0, l = 0, r = 0;
    for (let x = 0; x < gw; x++) {
      const k = y * gw + x;
      if (!waterLike(k) || sky[k]) continue;
      c++;
      if (x < edge) l++;
      if (x >= gw - edge) r++;
    }
    rowWater[y] = c / gw >= 0.55 && l / edge >= 0.5 && r / edge >= 0.5 ? 1 : 0;
  }
  let water: LivingAnalysis['water'] = null;
  for (let y = Math.round(gh * 0.3); y <= Math.round(gh * 0.82); y++) {
    if (!rowWater[y]) continue;
    let s = 0;
    for (let k = y; k < gh; k++) s += rowWater[k];
    const mean = s / (gh - y);
    if (mean >= 0.7) {
      water = { horizon: y / gh, score: clamp(mean * Math.min(1, ((gh - y) / gh) / 0.25)) };
      break;
    }
  }

  // glints: bright local peaks, apart from each other
  const lq = Math.max(0.78, quantile(Lm, 0.97));
  const peaks: { u: number; v: number; l: number }[] = [];
  for (let y = 1; y < gh - 1; y++) {
    for (let x = 1; x < gw - 1; x++) {
      const k = y * gw + x, l = Lm[k];
      if (l < lq) continue;
      let top = true;
      for (let dy = -1; dy <= 1 && top; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && Lm[k + dy * gw + dx] > l) { top = false; break; }
      if (top) peaks.push({ u: (x + 0.5) / gw, v: (y + 0.5) / gh, l });
    }
  }
  peaks.sort((a, b) => b.l - a.l);
  const glints: Pt[] = [];
  for (const p of peaks) {
    if (glints.length >= 8) break;
    if (glints.every(q => Math.hypot(q.x - p.u, q.y - p.v) > 0.08)) glints.push({ x: p.u, y: p.v });
  }
  let bright = 0;
  for (let i = 0; i < n; i++) if (Lm[i] > 0.75) bright++;
  const light = bright / n, skyShare = skyN / n;

  // the motions worth offering, ranked for this picture
  const score: Record<Exclude<MotionKind, 'still'>, number> = {
    breath: 0.5,
    // bright pictures glint (a sunset, snow, a lit window); a wide sky takes mist; water takes ripples
    light: 0.22 + 2.4 * light + 0.01 * glints.length,
    mist: 0.2 + 1.2 * skyShare,
    water: water ? 0.55 + 0.6 * water.score : -1,
  };
  const options = (Object.keys(score) as Exclude<MotionKind, 'still'>[])
    .filter(k => score[k] >= 0)
    .sort((a, b) => score[b] - score[a]);
  return {
    aspect: W / H, depth: { w: gw, h: gh, v: depth }, cuts, sky: skyShare, water, glints, light,
    options: [...options, 'still'], recommended: options[0] ?? 'breath',
  };
}

/** A box blur of radius r on a grid (two passes). */
export function boxBlur(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const t = new Float32Array(a.length), o = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += a[y * w + xx]; c++; } }
      t[y * w + x] = s / c;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += t[yy * w + x]; c++; } }
      o[y * w + x] = s / c;
    }
  }
  return o;
}

/** A blur that stops at colour edges: each value takes its neighbours' as much as they are near and alike in colour. */
function crossBilateral(a: Float32Array, R: Float32Array, G: Float32Array, B: Float32Array, w: number, h: number, r: number, sd: number, sc: number): Float32Array {
  const o = new Float32Array(a.length);
  const ks = -1 / (2 * sd * sd), kc = -1 / (2 * sc * sc);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let s = 0, ws = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          const dr = R[i] - R[j], dg = G[i] - G[j], db = B[i] - B[j];
          const wt = Math.exp((dx * dx + dy * dy) * ks + (dr * dr + dg * dg + db * db) * kc);
          s += a[j] * wt;
          ws += wt;
        }
      }
      o[i] = s / ws;
    }
  }
  return o;
}

/**
 * Fill in the unknown part of a picture from what is known around it (push-pull: average down a pyramid by
 * the known weights, then fill each level's gaps from the level above).  `known` is 0..1 per pixel; the result
 * keeps the known pixels as they are, blending into the filled colours where `known` is partial.
 */
export function pushPull(px: Pixels, known: Float32Array): Pixels {
  type Lv = { w: number; h: number; c: Float32Array; a: Float32Array };
  const w0 = px.width, h0 = px.height;
  const base: Lv = { w: w0, h: h0, c: new Float32Array(w0 * h0 * 3), a: Float32Array.from(known) };
  for (let i = 0; i < w0 * h0; i++) {
    base.c[i * 3] = px.data[i * 4]; base.c[i * 3 + 1] = px.data[i * 4 + 1]; base.c[i * 3 + 2] = px.data[i * 4 + 2];
  }
  const levels: Lv[] = [base];
  while (levels[levels.length - 1].w > 1 || levels[levels.length - 1].h > 1) {
    const p = levels[levels.length - 1];
    const w = Math.max(1, Math.ceil(p.w / 2)), h = Math.max(1, Math.ceil(p.h / 2));
    const q: Lv = { w, h, c: new Float32Array(w * h * 3), a: new Float32Array(w * h) };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sa = 0, r = 0, g = 0, b = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const xx = 2 * x + dx, yy = 2 * y + dy;
            if (xx >= p.w || yy >= p.h) continue;
            const j = yy * p.w + xx, aj = p.a[j];
            sa += aj; r += aj * p.c[j * 3]; g += aj * p.c[j * 3 + 1]; b += aj * p.c[j * 3 + 2];
          }
        }
        const k = y * w + x;
        if (sa > 1e-6) { q.c[k * 3] = r / sa; q.c[k * 3 + 1] = g / sa; q.c[k * 3 + 2] = b / sa; }
        q.a[k] = Math.min(1, sa);
      }
    }
    levels.push(q);
  }
  // pull: from the top down, each level's unknown share comes from the (bilinear) level above
  for (let l = levels.length - 2; l >= 0; l--) {
    const p = levels[l], up = levels[l + 1];
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const k = y * p.w + x, a = clamp(p.a[k]);
        if (a >= 1) continue;
        const ux = clamp((x + 0.5) / 2 - 0.5, 0, up.w - 1), uy = clamp((y + 0.5) / 2 - 0.5, 0, up.h - 1);
        const x0 = Math.floor(ux), y0 = Math.floor(uy), x1 = Math.min(up.w - 1, x0 + 1), y1 = Math.min(up.h - 1, y0 + 1);
        const fx = ux - x0, fy = uy - y0;
        for (let ch = 0; ch < 3; ch++) {
          const v = (up.c[(y0 * up.w + x0) * 3 + ch] * (1 - fx) + up.c[(y0 * up.w + x1) * 3 + ch] * fx) * (1 - fy)
            + (up.c[(y1 * up.w + x0) * 3 + ch] * (1 - fx) + up.c[(y1 * up.w + x1) * 3 + ch] * fx) * fy;
          p.c[k * 3 + ch] = a * p.c[k * 3 + ch] + (1 - a) * v;
        }
        p.a[k] = 1;
      }
    }
  }
  const out = new Uint8ClampedArray(w0 * h0 * 4);
  for (let i = 0; i < w0 * h0; i++) {
    out[i * 4] = base.c[i * 3]; out[i * 4 + 1] = base.c[i * 3 + 1]; out[i * 4 + 2] = base.c[i * 3 + 2]; out[i * 4 + 3] = 255;
  }
  return { width: w0, height: h0, data: out };
}

// ── the motion ────────────────────────────────────────────────────────

/** Where the eye is (-1..1 each way): the parallax's direction. */
export interface Look { x: number; y: number }

/** The slow orbit the planes follow when nothing steers them (a 16 s and a 23 s loop: never quite the same). */
export const orbit = (t: number): Look => ({ x: Math.sin((t * Math.PI * 2) / 16), y: 0.55 * Math.sin((t * Math.PI * 2) / 23 + 1) });

/** How far each plane moves with the look, far → near (the far one a little the other way). */
export const PLANE_SHIFT = [-0.45, 0, 0.55, 1] as const;
/** The nearest plane's largest shift as a share of the picture's longer side (at strength 1): "slightly". */
export const PARALLAX_AMP = 0.014;
/** The breath's swell of the picture (share of its size at full lungs, strength 1). */
export const BREATH_ZOOM = 0.026;

/** The camera of a frame: its zoom (≥ the overscan that keeps the edges covered) and drift (share of the size). */
export function pose(m: Motion, t: number, breath: number, strength: number): { zoom: number; dx: number; dy: number } {
  const s = clamp(strength);
  const over = 1 + (m.parallax ? 2 * PARALLAX_AMP * s : 0) + (m.kind === 'still' ? 0 : 0.012 * s);
  const swell = m.kind === 'breath' ? BREATH_ZOOM * s * clamp(breath) : 0;
  // a whisper of drift for the loops without depth (a Ken Burns that never goes anywhere)
  const drift = m.kind !== 'still' && !m.parallax ? 0.004 * s : 0;
  return { zoom: over + swell, dx: drift * Math.sin((t * Math.PI * 2) / 31), dy: drift * Math.sin((t * Math.PI * 2) / 37 + 2) };
}

/**
 * The look as the player steers it: a desktop's mouse over the picture, a phone's tilt (when the browser
 * sends it without asking), else the slow orbit; it eases toward its target and back to the orbit 2.5 s
 * after the last steer.
 */
export class LookInput {
  private target: Look | null = null;
  private at = -1e9;
  private cur: Look = { x: 0, y: 0 };
  private tilt0: { b: number; g: number } | null = null;
  private off: (() => void) | null = null;

  /** A pointer at (nx, ny), each -1..1 over the picture (a desktop's mouse; a finger does not steer). */
  point(nx: number, ny: number, now: number): void {
    this.target = { x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) };
    this.at = now;
  }

  /** Listen to the phone's tilt where the browser sends it without a permission prompt (Android; iOS asks, so not there). */
  listen(now: () => number): void {
    if (this.off || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const on = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      this.tilt0 ??= { b: e.beta, g: e.gamma };
      this.point((e.gamma - this.tilt0.g) / 18, (e.beta - this.tilt0.b) / 18, now());
    };
    window.addEventListener('deviceorientation', on);
    this.off = () => window.removeEventListener('deviceorientation', on);
  }

  stop(): void { this.off?.(); this.off = null; this.tilt0 = null; }

  /** The look now (t: seconds, dt: since the last call). */
  get(t: number, dt: number): Look {
    const steering = this.target && t - this.at < 2.5;
    const want = steering ? this.target! : orbit(t);
    const k = 1 - Math.exp(-Math.max(0, dt) / (steering ? 0.35 : 1.2));
    this.cur = { x: this.cur.x + (want.x - this.cur.x) * k, y: this.cur.y + (want.y - this.cur.y) * k };
    return this.cur;
  }
}

// ── drawing ───────────────────────────────────────────────────────────

type Img = CanvasImageSource & { width: number; height: number };

const newCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/** A grid's mask (white, alpha = f(value)) as a small canvas; drawn scaled up it is soft-edged (feathered). */
function maskCanvas(g: Grid, f: (v: number) => number): HTMLCanvasElement {
  const c = newCanvas(g.w, g.h);
  const ctx = c.getContext('2d')!;
  const d = ctx.createImageData(g.w, g.h);
  for (let i = 0; i < g.v.length; i++) {
    d.data[i * 4] = 255; d.data[i * 4 + 1] = 255; d.data[i * 4 + 2] = 255;
    d.data[i * 4 + 3] = Math.round(255 * clamp(f(g.v[i])));
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

/** Tileable soft noise (two octaves of value noise) as warm white with alpha: the mist. */
function mistTexture(seed: number): HTMLCanvasElement {
  const W = 256, H = 128, c = newCanvas(W, H), ctx = c.getContext('2d')!;
  const rnd = mulberry32(seed);
  const oct = (cells: number) => {
    const gx = cells, gy = Math.max(1, cells / 2);
    const v = Array.from({ length: gx * gy }, () => rnd());
    return (x: number, y: number) => {
      const fx = (x / W) * gx, fy = (y / H) * gy;
      const x0 = Math.floor(fx) % gx, y0 = Math.floor(fy) % gy, x1 = (x0 + 1) % gx, y1 = (y0 + 1) % gy;
      const sx = smoothstep(0, 1, fx - Math.floor(fx)), sy = smoothstep(0, 1, fy - Math.floor(fy));
      const a = v[y0 * gx + x0], b = v[y0 * gx + x1], cc = v[y1 * gx + x0], d = v[y1 * gx + x1];
      return (a * (1 - sx) + b * sx) * (1 - sy) + (cc * (1 - sx) + d * sx) * sy;
    };
  };
  const o1 = oct(6), o2 = oct(14);
  const d = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = 0.65 * o1(x, y) + 0.35 * o2(x, y);
      const i = (y * W + x) * 4;
      d.data[i] = 250; d.data[i + 1] = 246; d.data[i + 2] = 238;
      d.data[i + 3] = Math.round(255 * smoothstep(0.38, 0.85, n));
    }
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

/** A small soft star for a glint. */
function glintSprite(): HTMLCanvasElement {
  const S = 64, c = newCanvas(S, S), g = c.getContext('2d')!;
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(255,255,250,1)');
  rg.addColorStop(0.18, 'rgba(255,246,220,0.55)');
  rg.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,250,235,0.7)';
  g.fillRect(S / 2 - 0.8, 4, 1.6, S - 8);
  g.fillRect(4, S / 2 - 0.8, S - 8, 1.6);
  return c;
}

export interface FrameOpts {
  /** the lungs' fullness 0..1 (the game's breath; the breath motion swells with it) */
  breath?: number;
  /** where the eye is (LookInput), else the slow orbit */
  look?: Look | null;
  /** how much of the motion shows, 0..1 (a game may keep it quieter while the mosaic is being coloured) */
  strength?: number;
}

/**
 * One picture brought to life at a given size: build once (≈ 5–25 ms: the planes, their filled-in backs, the
 * highlights, the mist), then `frame(t)` draws the moment t into its canvas (a few drawImage calls) and
 * returns it.  The canvas is at most ~1.2 MP; a caller draws it at its own size.
 */
export class LivingPicture {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement;
  private planes: HTMLCanvasElement[] = [];
  private scratch: HTMLCanvasElement | null = null;
  private hl: HTMLCanvasElement | null = null;
  private far: HTMLCanvasElement | null = null;
  private mist: HTMLCanvasElement | null = null;
  private glint: HTMLCanvasElement | null = null;
  private lastT = Number.NaN;
  /**
   * The device's price: what a frame costs (ms, smoothed over the frames after the first few, which warm the
   * canvas up), and how far the motion has stepped down for it — 0 the whole motion, 1 without the depth planes,
   * 2 still.  A canvas drawn on the GPU pays well under 1 ms; one drawn on the CPU (some phones, a browser with
   * its GPU off) 5–40 ms, so a dear frame is drawn at most 24 times a second and, still too dear, steps down.
   */
  private costMs = 0;
  private drawn = 0;
  private level: 0 | 1 | 2 = 0;

  /** what a frame costs here (ms, smoothed; 0 until measured) */
  get cost(): number { return this.costMs; }
  /** 0: the whole motion; 1: the depth planes dropped (too dear here); 2: still */
  get stepDown(): number { return this.level; }

  constructor(src: Img, w: number, h: number, readonly a: LivingAnalysis, readonly motion: Motion, opts: { maxPixels?: number; seed?: number } = {}) {
    const k = Math.min(1, Math.sqrt((opts.maxPixels ?? 1.2e6) / Math.max(1, w * h)));
    this.canvas = newCanvas(w * k, h * k);
    this.ctx = this.canvas.getContext('2d')!;
    const W = this.canvas.width, H = this.canvas.height;
    this.base = newCanvas(W, H);
    const bc = this.base.getContext('2d')!;
    bc.imageSmoothingQuality = 'high';
    bc.drawImage(src, 0, 0, W, H);
    if (motion.parallax) this.buildPlanes();
    if (motion.kind === 'light') this.buildHighlights();
    if (motion.kind === 'mist') {
      this.far = maskCanvas(a.depth, d => smoothstep(0.62, 0.12, d));
      this.mist = mistTexture((opts.seed ?? 7) >>> 0);
    }
    if (motion.kind === 'light' || motion.kind === 'water') this.glint = glintSprite();
    if (motion.kind === 'mist' || motion.kind === 'light' || motion.kind === 'water') this.scratch = newCanvas(W, H);
  }

  /** The 4 planes, far → near: each the picture where it stands, its hidden back filled in from around it. */
  private buildPlanes(): void {
    const W = this.canvas.width, H = this.canvas.height, a = this.a;
    // the fill-in works on a small copy (it shows only as slivers at moving edges)
    const sw = Math.min(200, W), sh = Math.max(1, Math.round(sw * (H / W)));
    const small = newCanvas(sw, sh), sctx = small.getContext('2d', { willReadFrequently: true })!;
    sctx.drawImage(this.base, 0, 0, sw, sh);
    const spx = sctx.getImageData(0, 0, sw, sh);
    const pix: Pixels = { width: sw, height: sh, data: spx.data };
    const at = (t: number) => (d: number) => smoothstep(t - 0.07, t + 0.07, d);
    const tiers = [-1, ...a.cuts];
    const tmp = newCanvas(W, H), tc = tmp.getContext('2d')!;
    for (let i = 0; i < 4; i++) {
      const p = newCanvas(W, H), pc = p.getContext('2d')!;
      pc.imageSmoothingQuality = 'high';
      const next = i < 3 ? tiers[i + 1] : null;
      if (next !== null) {
        // the back of what stands in front: filled from the plane's own colours around it
        const hole = at(next);
        const known = new Float32Array(sw * sh);
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) known[y * sw + x] = 1 - hole(sampleGrid(a.depth, (x + 0.5) / sw, (y + 0.5) / sh));
        const filled = pushPull(pix, known);
        const fc = newCanvas(sw, sh);
        const fctx = fc.getContext('2d')!, img = fctx.createImageData(sw, sh);
        img.data.set(filled.data);
        fctx.putImageData(img, 0, 0);
        pc.drawImage(fc, 0, 0, W, H);
        // the picture itself where nothing stands in front
        tc.globalCompositeOperation = 'copy';
        tc.drawImage(this.base, 0, 0);
        tc.globalCompositeOperation = 'destination-out';
        tc.drawImage(maskCanvas(a.depth, hole), 0, 0, W, H);
        tc.globalCompositeOperation = 'source-over';
        pc.drawImage(tmp, 0, 0);
      } else {
        pc.drawImage(this.base, 0, 0);
      }
      if (i > 0) {
        pc.globalCompositeOperation = 'destination-in';
        pc.drawImage(maskCanvas(a.depth, at(tiers[i])), 0, 0, W, H);
        pc.globalCompositeOperation = 'source-over';
      }
      this.planes.push(p);
    }
  }

  /** The bright parts, lifted toward warm white (the light glides over these). */
  private buildHighlights(): void {
    const W = this.canvas.width, H = this.canvas.height;
    const sw = Math.min(480, W), sh = Math.max(1, Math.round(sw * (H / W)));
    const c = newCanvas(sw, sh), g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(this.base, 0, 0, sw, sh);
    const d = g.getImageData(0, 0, sw, sh);
    const lum = new Float32Array(sw * sh);
    for (let i = 0; i < lum.length; i++) lum[i] = lumOf(d.data[i * 4], d.data[i * 4 + 1], d.data[i * 4 + 2]);
    const q = quantile(lum.filter((_, i) => i % 7 === 0), 0.8);
    for (let i = 0; i < lum.length; i++) {
      const k = smoothstep(q, Math.min(1, q + 0.25), lum[i]);
      d.data[i * 4] = 255; d.data[i * 4 + 1] = 240 + 12 * k; d.data[i * 4 + 2] = 205 + 30 * k;
      d.data[i * 4 + 3] = Math.round(255 * k);
    }
    g.putImageData(d, 0, 0);
    this.hl = c;
  }

  /** The moment t (seconds) of the motion, drawn into `canvas` and returned. */
  frame(t: number, o: FrameOpts = {}): HTMLCanvasElement {
    if (t === this.lastT) return this.canvas;
    // a dear frame is drawn at most 24 times a second (the motion is slow: it does not show)
    if (this.costMs > 2.5 && t > this.lastT && t - this.lastT < 1 / 24) return this.canvas;
    if (this.level === 2) {
      if (Number.isNaN(this.lastT) || this.drawn === 0) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'copy';
        this.ctx.drawImage(this.base, 0, 0);
        this.ctx.globalCompositeOperation = 'source-over';
        this.drawn = 1;
      }
      this.lastT = t;
      return this.canvas;
    }
    const began = performance.now();
    this.draw(t, o);
    this.lastT = t;
    const ms = performance.now() - began;
    this.drawn++;
    if (this.drawn > 5) this.costMs = this.drawn === 6 ? ms : this.costMs * 0.9 + ms * 0.1;
    // still too dear after a few dozen frames: step down (drop the depth planes, then the motion)
    if (this.drawn > 30 && this.costMs > 9) {
      this.level = this.level === 0 && this.planes.length ? 1 : 2;
      if (this.level === 1) this.planes = [];
      this.drawn = 0;
      this.costMs = 0;
    }
    return this.canvas;
  }

  private draw(t: number, o: FrameOpts): void {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, m = this.motion;
    const s = clamp(o.strength ?? 1);
    const P = pose(m, t, o.breath ?? 0.5, s);
    const look = o.look ?? orbit(t);
    const amp = PARALLAX_AMP * Math.max(W, H) * s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingQuality = 'medium';
    const zw = W * P.zoom, zh = H * P.zoom;
    const x0 = (W - zw) / 2 + P.dx * W, y0 = (H - zh) / 2 + P.dy * H;
    if (this.planes.length) {
      this.planes.forEach((p, i) => {
        const f = PLANE_SHIFT[i];
        ctx.drawImage(p, x0 + look.x * amp * f, y0 + look.y * amp * f * 0.6, zw, zh);
      });
    } else {
      ctx.drawImage(this.base, x0, y0, zw, zh);
    }
    // a place in the picture (0..1) on the canvas: through the camera, riding on its plane
    const place = (u: number, v: number): Pt => {
      let f = 0;
      if (this.planes.length) {
        const d = sampleGrid(this.a.depth, u, v);
        f = d >= this.a.cuts[2] ? PLANE_SHIFT[3] : d >= this.a.cuts[1] ? PLANE_SHIFT[2] : d >= this.a.cuts[0] ? PLANE_SHIFT[1] : PLANE_SHIFT[0];
      }
      return { x: x0 + u * zw + look.x * amp * f, y: y0 + v * zh + look.y * amp * f * 0.6 };
    };
    if (m.kind === 'breath') {
      // the picture brightens a touch as the lungs fill
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.05 * s * clamp(o.breath ?? 0.5);
      ctx.drawImage(this.base, x0, y0, zw, zh);
    } else if (m.kind === 'light' && this.hl && this.scratch) {
      // a band of light glides across the bright parts every 12 s (3 s of it quiet)
      const sc = this.scratch.getContext('2d')!;
      const ph = ((t % 12) / 9) * 1.6 - 0.3;
      sc.globalCompositeOperation = 'copy';
      sc.drawImage(this.hl, x0, y0, zw, zh);
      sc.globalCompositeOperation = 'destination-in';
      const bx = ph * (W + H);
      const g = sc.createLinearGradient(bx - H * 0.45, 0, bx + H * 0.05, H * 0.5);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sc.fillStyle = g;
      sc.fillRect(0, 0, W, H);
      sc.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * s;
      ctx.drawImage(this.scratch, 0, 0);
      // and a soft breath of the bright parts themselves
      ctx.globalAlpha = (0.08 + 0.06 * Math.sin(t * 0.9)) * s;
      ctx.drawImage(this.hl, x0, y0, zw, zh);
      this.drawGlints(ctx, t, s, this.a.glints, place, Math.min(W, H) * 0.07);
    } else if (m.kind === 'mist' && this.mist && this.far && this.scratch) {
      // two veils at their own speeds, only over the distance
      const sc = this.scratch.getContext('2d')!;
      sc.globalCompositeOperation = 'copy';
      sc.clearRect(0, 0, W, H);
      sc.globalCompositeOperation = 'source-over';
      const tw = W * 1.6, th = H * 0.9;
      for (const [speed, yOff, alpha] of [[0.018, 0.08, 0.9], [-0.011, 0.32, 0.6]] as const) {
        const off = (((t * speed * W) % tw) + tw) % tw;
        sc.globalAlpha = alpha;
        for (let k = -1; k <= 1; k++) sc.drawImage(this.mist, off + k * tw - tw * 0.2, yOff * H, tw, th);
      }
      sc.globalAlpha = 1;
      sc.globalCompositeOperation = 'destination-in';
      sc.drawImage(this.far, x0, y0, zw, zh);
      sc.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.42 * s;
      ctx.drawImage(this.scratch, 0, 0);
    } else if (m.kind === 'water' && this.a.water && this.scratch) {
      // ripples: the picture below the horizon in thin strips, each shifted along a travelling wave
      const sc = this.scratch.getContext('2d')!;
      sc.globalCompositeOperation = 'copy';
      sc.drawImage(this.canvas, 0, 0);
      sc.globalCompositeOperation = 'source-over';
      const top = Math.max(0, Math.floor(y0 + zh * this.a.water.horizon));
      const step = Math.max(2, Math.round(H / 220));
      const A = Math.max(W, H) * 0.0045 * s;
      for (let y = top; y < H; y += step) {
        const deep = clamp((y - top) / Math.max(1, H - top));
        const dx = A * (0.25 + 0.75 * deep) * (Math.sin(y * (0.11 / step) * 2 - t * 2.1) + 0.45 * Math.sin(y * 0.031 + t * 1.3));
        const sh = Math.min(step, H - y);
        ctx.drawImage(this.scratch, 0, y, W, sh, dx, y, W, sh);
      }
      const wg = this.a.glints.filter(g => g.y > this.a.water!.horizon);
      const hz = this.a.water.horizon;
      this.drawGlints(ctx, t * 1.6, s, wg.length ? wg : [{ x: 0.3, y: (1 + hz) / 2 }, { x: 0.7, y: (1 + 2 * hz) / 3 }, { x: 0.52, y: (2 + hz) / 3 }], place, Math.min(W, H) * 0.05);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawGlints(ctx: CanvasRenderingContext2D, t: number, s: number, pts: readonly Pt[], place: (u: number, v: number) => Pt, size: number): void {
    if (!this.glint || !pts.length) return;
    ctx.globalCompositeOperation = 'lighter';
    pts.forEach((p, i) => {
      // each glint flares for ~1.5 s once in ~6 s, out of step with the others
      const ph = ((t / 6 + i * 0.37) % 1 + 1) % 1;
      const k = ph < 0.25 ? Math.sin((ph / 0.25) * Math.PI) : 0;
      if (k <= 0.01) return;
      const q = place(p.x, p.y);
      const r = size * (0.6 + 0.4 * k);
      ctx.globalAlpha = 0.85 * k * s;
      ctx.drawImage(this.glint!, q.x - r / 2, q.y - r / 2, r, r);
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}
