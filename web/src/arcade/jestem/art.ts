/**
 * The brush the eighteen pictures are painted with (pictures.ts): one art style for all — luminous
 * gouache in layers: skies of several stops, light as additive glows, silhouettes with a warm rim on the
 * side of the sun, atmospheric hills that pale with distance, grass and flowers in strokes, water in
 * shimmer lines.  Every call takes the picture's unit coordinates (u across, v down, 0..1) so a picture
 * paints the same at 600 × 700 for the mosaic's analysis and at any size on screen.  Seeded: the same
 * picture every time.
 *
 * Painted once per vision (never per frame), so gradients and paths are made freely here.
 */
import { mulberry32 } from '../../core/random';

export type RGB = readonly [number, number, number];
export const rgba = (c: RGB, a = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const TAU = Math.PI * 2;

/** A pose: absolute segment angles (0 = straight down, +π/2 = toward +u, π = up). */
export interface Pose {
  /** the torso's lean (0 upright; + toward +u) and the head's tilt */
  lean: number;
  head?: number;
  armL: readonly [number, number];
  armR: readonly [number, number];
  legL: readonly [number, number];
  legR: readonly [number, number];
  /** a skirt's flare (0: none), a cloak streaming behind (0: none; + toward −u), long hair */
  skirt?: number;
  cloak?: number;
  hair?: number;
  /** a child's proportions */
  child?: boolean;
}

export interface FigureStyle {
  body: RGB;
  /** the rim of light and the side it comes from (−1 left, 1 right; 0: from above) */
  rim: RGB;
  from: number;
  /** a lighter cloth colour for a skirt or a cloak */
  cloth?: RGB;
}

export class Brush {
  readonly rnd: () => number;
  constructor(readonly ctx: CanvasRenderingContext2D, readonly w: number, readonly h: number, seed: number) {
    this.rnd = mulberry32(seed);
  }

  X(u: number): number { return u * this.w; }
  Y(v: number): number { return v * this.h; }
  /** a length in units of the picture's width */
  S(s: number): number { return s * this.w; }
  r(lo: number, hi: number): number { return lo + (hi - lo) * this.rnd(); }

  // ── grounds ────────────────────────────────────────────────────
  /** The whole picture in a vertical gradient: [v, colour] stops. */
  sky(stops: readonly (readonly [number, RGB])[]): void {
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, 0, this.h);
    for (const [v, col] of stops) g.addColorStop(Math.max(0, Math.min(1, v)), rgba(col));
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
  }

  /** A soft radial light (additive with `add`). */
  glow(u: number, v: number, r: number, col: RGB, a: number, add = true, squash = 1): void {
    const c = this.ctx, R = Math.max(1, this.S(r));
    c.save();
    if (add) c.globalCompositeOperation = 'lighter';
    c.translate(this.X(u), this.Y(v));
    c.scale(1, squash);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.35, rgba(col, a * 0.45));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, R, 0, TAU);
    c.fill();
    c.restore();
  }

  /** A sun: halo, rays, a bright disc with a pale core. */
  sun(u: number, v: number, r: number, disc: RGB, halo: RGB, rays = 0, rayLen = 3): void {
    this.glow(u, v, r * 5, halo, 0.42);
    this.glow(u, v, r * 2.2, halo, 0.5);
    if (rays > 0) this.rays(u, v, rays, r * 1.2, r * rayLen, halo, 0.16);
    const c = this.ctx;
    const g = c.createRadialGradient(this.X(u), this.Y(v), 0, this.X(u), this.Y(v), this.S(r));
    g.addColorStop(0, 'rgba(255,255,246,1)');
    g.addColorStop(0.55, rgba(mix(disc, [255, 255, 240], 0.5)));
    g.addColorStop(1, rgba(disc));
    c.fillStyle = g;
    c.beginPath();
    c.arc(this.X(u), this.Y(v), this.S(r), 0, TAU);
    c.fill();
  }

  /** A burst of `n` light rays from (u, v), from radius r0 to r1. */
  rays(u: number, v: number, n: number, r0: number, r1: number, col: RGB, a: number, spin = 0): void {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const x = this.X(u), y = this.Y(v);
    for (let i = 0; i < n; i++) {
      const ang = spin + (i / n) * TAU + this.r(-0.05, 0.05);
      const wid = this.r(0.03, 0.07);
      const L = this.S(r1) * this.r(0.7, 1.1);
      const g = c.createLinearGradient(x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x + Math.cos(ang) * this.S(r0), y + Math.sin(ang) * this.S(r0));
      c.lineTo(x + Math.cos(ang - wid) * L, y + Math.sin(ang - wid) * L);
      c.lineTo(x + Math.cos(ang + wid) * L, y + Math.sin(ang + wid) * L);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /** A sloping beam of light: a quad from a narrow top to a wide bottom, fading downward. */
  beam(u0: number, v0: number, u1: number, v1: number, w0: number, w1: number, col: RGB, a: number): void {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(this.X(u0), this.Y(v0), this.X(u1), this.Y(v1));
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(this.X(u0 - w0 / 2), this.Y(v0));
    c.lineTo(this.X(u0 + w0 / 2), this.Y(v0));
    c.lineTo(this.X(u1 + w1 / 2), this.Y(v1));
    c.lineTo(this.X(u1 - w1 / 2), this.Y(v1));
    c.closePath();
    c.fill();
    c.restore();
  }

  /** The area under a curve v = f(u), down to `bottom`, in a vertical gradient (top colour at the curve's highest point). */
  ridge(f: (u: number) => number, top: RGB, bottom: RGB, to = 1, steps = 90): void {
    const c = this.ctx;
    let minV = 1;
    for (let i = 0; i <= steps; i++) minV = Math.min(minV, f(i / steps));
    const g = c.createLinearGradient(0, this.Y(minV), 0, this.Y(to));
    g.addColorStop(0, rgba(top));
    g.addColorStop(1, rgba(bottom));
    c.fillStyle = g;
    this.ridgePath(f, to, steps);
    c.fill();
  }

  ridgePath(f: (u: number) => number, to = 1, steps = 90): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(-2, this.Y(to) + 2);
    for (let i = 0; i <= steps; i++) c.lineTo(this.X(i / steps), this.Y(f(i / steps)));
    c.lineTo(this.w + 2, this.Y(to) + 2);
    c.closePath();
  }

  /** A line of light along a curve (a rim on a hill's crest), strongest near `uc`. */
  rimLine(f: (u: number) => number, col: RGB, a: number, width: number, uc = 0.5, spread = 0.5, steps = 90): void {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineWidth = Math.max(1, this.S(width));
    c.lineCap = 'round';
    for (let i = 0; i < steps; i++) {
      const u0 = i / steps, u1 = (i + 1) / steps;
      const k = Math.exp(-(((u0 - uc) / spread) ** 2));
      if (k < 0.04) continue;
      c.strokeStyle = rgba(col, a * k);
      c.beginPath();
      c.moveTo(this.X(u0), this.Y(f(u0)) + 1);
      c.lineTo(this.X(u1), this.Y(f(u1)) + 1);
      c.stroke();
    }
    c.restore();
  }

  /** A puffy cloud: overlapping lobes, light on top, a shade underneath. */
  cloud(u: number, v: number, rx: number, ry: number, light: RGB, shade: RGB, lobes = 7): void {
    const c = this.ctx;
    const g = c.createLinearGradient(0, this.Y(v - ry), 0, this.Y(v + ry));
    g.addColorStop(0, rgba(light));
    g.addColorStop(1, rgba(shade));
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < lobes; i++) {
      const k = (i + 0.5) / lobes;
      const lx = u - rx + 2 * rx * k;
      const lr = ry * (0.55 + 0.6 * Math.sin(Math.PI * k)) * this.r(0.85, 1.15);
      c.moveTo(this.X(lx) + this.S(lr), this.Y(v));
      c.arc(this.X(lx), this.Y(v - lr * 0.3), this.S(lr), 0, TAU);
    }
    c.rect(this.X(u - rx * 0.92), this.Y(v - ry * 0.1), this.S(rx * 1.84), this.S(ry * 0.55));
    c.fill();
  }

  /** A thin streak of cloud (a sunset's wisps): a few long soft ellipses, lit along the top. */
  streak(u: number, v: number, rx: number, ry: number, light: RGB, shade: RGB, n = 5): void {
    const c = this.ctx;
    for (let i = 0; i < n; i++) {
      const cu = u + this.r(-rx * 0.45, rx * 0.45), cv = v + this.r(-ry * 0.6, ry * 0.6);
      const ex = rx * this.r(0.45, 0.85), ey = ry * this.r(0.35, 0.7);
      const g = c.createLinearGradient(0, this.Y(cv - ey), 0, this.Y(cv + ey));
      g.addColorStop(0, rgba(light, 0.85));
      g.addColorStop(1, rgba(shade, 0.55));
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(this.X(cu), this.Y(cv), this.S(ex), this.S(ey), 0, 0, TAU);
      c.fill();
    }
  }

  /** Grass blades along a ground line, in a band of `depth` below it. */
  grass(f: (u: number) => number, n: number, cols: readonly RGB[], len: number, depth = 0.04, u0 = 0, u1 = 1, lean = 0.2): void {
    const c = this.ctx;
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const u = this.r(u0, u1);
      const base = f(u) + this.r(0, depth);
      const L = this.S(len) * this.r(0.5, 1.2);
      const x = this.X(u), y = this.Y(base);
      c.strokeStyle = rgba(cols[(i * 7 + 3) % cols.length], this.r(0.55, 0.95));
      c.lineWidth = Math.max(1, this.S(0.0035) * this.r(0.7, 1.3));
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + L * lean * 0.5, y - L * 0.6, x + L * this.r(-0.1, lean), y - L);
      c.stroke();
    }
  }

  /** Flowers scattered in an area (smaller toward its top: perspective). */
  flowers(n: number, area: (r: () => number) => [number, number] | null, palette: readonly RGB[], size: number, center: RGB = [255, 214, 90]): void {
    const c = this.ctx;
    for (let i = 0; i < n; i++) {
      const at = area(this.rnd);
      if (!at) continue;
      const [u, v] = at;
      const s = this.S(size) * (0.35 + v * 0.9) * this.r(0.7, 1.2);
      const col = palette[i % palette.length];
      const x = this.X(u), y = this.Y(v);
      c.fillStyle = rgba(col, 0.95);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU + i;
        c.beginPath();
        c.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.4, s * 0.48, s * 0.34, a, 0, TAU);
        c.fill();
      }
      c.fillStyle = rgba(center);
      c.beginPath();
      c.arc(x, y, s * 0.3, 0, TAU);
      c.fill();
    }
  }

  /** A round leafy crown on a trunk: clumps of leaves, darker below, a light side. */
  tree(u: number, v: number, r: number, dark: RGB, light: RGB, trunk: RGB, groundV: number, from = 1, clumps = 14): void {
    const c = this.ctx;
    c.fillStyle = rgba(trunk);
    c.beginPath();
    c.moveTo(this.X(u - r * 0.09), this.Y(groundV));
    c.quadraticCurveTo(this.X(u - r * 0.05), this.Y(v + r * 0.4), this.X(u - r * 0.03), this.Y(v));
    c.lineTo(this.X(u + r * 0.04), this.Y(v));
    c.quadraticCurveTo(this.X(u + r * 0.06), this.Y(v + r * 0.4), this.X(u + r * 0.1), this.Y(groundV));
    c.closePath();
    c.fill();
    for (let i = 0; i < clumps; i++) {
      const a = this.r(0, TAU), d = this.r(0, 0.75) * r;
      const cu = u + Math.cos(a) * d, cv = v + Math.sin(a) * d * 0.85;
      const cr = r * this.r(0.32, 0.5);
      const lit = (cu - u) * from / r * 0.5 + (v - cv) / r * 0.4 + 0.45;
      const col = mix(dark, light, Math.max(0, Math.min(1, lit)));
      c.fillStyle = rgba(col);
      c.beginPath();
      c.arc(this.X(cu), this.Y(cv), this.S(cr), 0, TAU);
      c.fill();
    }
  }

  /** Little dots of light (stars, sparkles), each with a soft halo. */
  stars(n: number, area: (r: () => number) => [number, number] | null, col: RGB, size: number): void {
    const c = this.ctx;
    for (let i = 0; i < n; i++) {
      const at = area(this.rnd);
      if (!at) continue;
      const s = this.S(size) * this.r(0.4, 1.3);
      c.fillStyle = rgba(col, this.r(0.5, 1));
      c.beginPath();
      c.arc(this.X(at[0]), this.Y(at[1]), s, 0, TAU);
      c.fill();
      if (s > this.S(size) * 0.9) this.glow(at[0], at[1], size * 5, col, 0.25);
    }
  }

  /** Horizontal shimmer lines on water between v0 and v1, brighter near `uc`. */
  shimmer(v0: number, v1: number, n: number, col: RGB, a: number, uc = 0.5, spread = 0.25): void {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const v = this.r(v0, v1);
      const u = uc + (this.rnd() - 0.5) * 2 * spread * (0.4 + (v - v0) / Math.max(0.01, v1 - v0));
      const L = this.S(this.r(0.01, 0.05)) * (0.5 + (v - v0) / Math.max(0.01, v1 - v0));
      const k = Math.exp(-(((u - uc) / spread) ** 2));
      c.strokeStyle = rgba(col, a * (0.3 + 0.7 * k));
      c.lineWidth = Math.max(1, this.S(0.003));
      c.beginPath();
      c.moveTo(this.X(u) - L / 2, this.Y(v));
      c.lineTo(this.X(u) + L / 2, this.Y(v));
      c.stroke();
    }
    c.restore();
  }

  /** A horizontal band of mist. */
  mist(v: number, hgt: number, col: RGB, a: number): void {
    const c = this.ctx;
    const g = c.createLinearGradient(0, this.Y(v - hgt), 0, this.Y(v + hgt));
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(0.5, rgba(col, a));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(0, this.Y(v - hgt), this.w, this.Y(2 * hgt));
  }

  /** A filled polygon in unit coordinates. */
  poly(pts: readonly (readonly [number, number])[], fill: string | CanvasGradient): void {
    const c = this.ctx;
    c.fillStyle = fill;
    c.beginPath();
    pts.forEach(([u, v], i) => (i ? c.lineTo(this.X(u), this.Y(v)) : c.moveTo(this.X(u), this.Y(v))));
    c.closePath();
    c.fill();
  }

  vgrad(v0: number, v1: number, a: RGB, b: RGB): CanvasGradient {
    const g = this.ctx.createLinearGradient(0, this.Y(v0), 0, this.Y(v1));
    g.addColorStop(0, rgba(a));
    g.addColorStop(1, rgba(b));
    return g;
  }

  hgrad(u0: number, u1: number, a: RGB, b: RGB): CanvasGradient {
    const g = this.ctx.createLinearGradient(this.X(u0), 0, this.X(u1), 0);
    g.addColorStop(0, rgba(a));
    g.addColorStop(1, rgba(b));
    return g;
  }

  /** A few soft strokes of texture over an area (a painter's hand). */
  texture(n: number, area: (r: () => number) => [number, number] | null, col: RGB, a: number, len = 0.03): void {
    const c = this.ctx;
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const at = area(this.rnd);
      if (!at) continue;
      const ang = this.r(-0.4, 0.4);
      const L = this.S(len) * this.r(0.5, 1.4);
      c.strokeStyle = rgba(col, a * this.r(0.4, 1));
      c.lineWidth = Math.max(1, this.S(0.004) * this.r(0.6, 1.6));
      c.beginPath();
      c.moveTo(this.X(at[0]), this.Y(at[1]));
      c.lineTo(this.X(at[0]) + Math.cos(ang) * L, this.Y(at[1]) + Math.sin(ang) * L);
      c.stroke();
    }
  }

  // ── people ─────────────────────────────────────────────────────
  /**
   * A human figure standing at (u, feet) — `hgt` tall in units of the picture's height — in a pose, as a
   * silhouette with a rim of light on the side the light comes from.
   */
  figure(u: number, feet: number, hgt: number, pose: Pose, st: FigureStyle): void {
    const H = this.Y(hgt);
    const ox = this.X(u), oy = this.Y(feet);
    const off = H * 0.022;
    // the rim first, shifted toward the light; the body over it, shifted away
    this.figureShape(ox + st.from * off * 0.6, oy - (st.from === 0 ? off * 0.8 : 0), H, pose, rgba(st.rim), st.cloth ? rgba(mix(st.cloth, st.rim, 0.6)) : rgba(st.rim));
    this.figureShape(ox - st.from * off * 0.4, oy + (st.from === 0 ? off * 0.3 : 0), H, pose, rgba(st.body), st.cloth ? rgba(st.cloth) : rgba(st.body));
  }

  private figureShape(x: number, y: number, H: number, p: Pose, fill: string, cloth: string): void {
    const c = this.ctx;
    const k = p.child ? { leg: 0.42, torso: 0.3, head: 0.085, arm: 0.33, w: 0.95 } : { leg: 0.48, torso: 0.31, head: 0.066, arm: 0.37, w: 1 };
    const dir = (a: number) => [Math.sin(a), Math.cos(a)] as const;
    const hip = [x, y - H * k.leg] as const;
    // the torso leans from the hip: the neck lies `torso` up along it
    const neckP = [hip[0] + Math.sin(p.lean) * H * k.torso, hip[1] - Math.cos(p.lean) * H * k.torso] as const;
    const shoulder = [neckP[0] - Math.sin(p.lean) * H * 0.03, neckP[1] + Math.cos(p.lean) * H * 0.03] as const;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = fill;
    c.fillStyle = fill;
    const limb = (from: readonly [number, number], a1: number, a2: number, l1: number, l2: number, w1: number, w2: number) => {
      const [d1x, d1y] = dir(a1), [d2x, d2y] = dir(a2);
      const mid = [from[0] + d1x * H * l1, from[1] + d1y * H * l1] as const;
      const end = [mid[0] + d2x * H * l2, mid[1] + d2y * H * l2] as const;
      c.lineWidth = H * w1 * k.w;
      c.beginPath();
      c.moveTo(from[0], from[1]);
      c.lineTo(mid[0], mid[1]);
      c.stroke();
      c.lineWidth = H * w2 * k.w;
      c.beginPath();
      c.moveTo(mid[0], mid[1]);
      c.lineTo(end[0], end[1]);
      c.stroke();
      return end;
    };
    // the far limbs a touch darker would need a second colour; a silhouette keeps one
    const lw = k.leg / 2;
    const footL = limb(hip, p.legL[0], p.legL[1], lw * 1.02, lw * 0.98, 0.085, 0.065);
    const footR = limb(hip, p.legR[0], p.legR[1], lw * 1.02, lw * 0.98, 0.085, 0.065);
    for (const f of [footL, footR]) {
      c.beginPath();
      c.ellipse(f[0] + H * 0.018, f[1], H * 0.04, H * 0.018, 0, 0, TAU);
      c.fill();
    }
    // the torso: a tapered shape from the shoulders to the hips
    const sw = H * 0.105 * k.w, hw = H * 0.075 * k.w;
    const px = Math.cos(p.lean), py = Math.sin(p.lean);
    c.beginPath();
    c.moveTo(shoulder[0] - px * sw, shoulder[1] - py * sw);
    c.quadraticCurveTo(shoulder[0], shoulder[1] - H * 0.02, shoulder[0] + px * sw, shoulder[1] + py * sw);
    c.lineTo(hip[0] + px * hw, hip[1] + py * hw);
    c.lineTo(hip[0] - px * hw, hip[1] - py * hw);
    c.closePath();
    c.fill();
    const al = k.arm / 2;
    limb(shoulder, p.armL[0], p.armL[1], al, al * 0.95, 0.06, 0.05);
    limb(shoulder, p.armR[0], p.armR[1], al, al * 0.95, 0.06, 0.05);
    // a skirt: a flared shape from the waist
    if (p.skirt) {
      c.fillStyle = cloth;
      const waist = [hip[0] + Math.sin(p.lean) * H * 0.08, hip[1] - Math.cos(p.lean) * H * 0.08] as const;
      const fl = H * (0.12 + p.skirt * 0.14);
      c.beginPath();
      c.moveTo(waist[0] - hw * 1.1, waist[1]);
      c.quadraticCurveTo(waist[0] - fl * 0.9, hip[1] + H * 0.12, waist[0] - fl, hip[1] + H * 0.2);
      c.quadraticCurveTo(waist[0], hip[1] + H * 0.24 + p.skirt * H * 0.02, waist[0] + fl, hip[1] + H * 0.18);
      c.quadraticCurveTo(waist[0] + fl * 0.8, hip[1] + H * 0.08, waist[0] + hw * 1.1, waist[1]);
      c.closePath();
      c.fill();
      c.fillStyle = fill;
    }
    // a cloak streaming from the shoulders
    if (p.cloak) {
      c.fillStyle = cloth;
      const s = -Math.sign(p.cloak) || -1, L = Math.abs(p.cloak);
      c.beginPath();
      c.moveTo(shoulder[0] - px * sw * 0.9, shoulder[1]);
      c.bezierCurveTo(shoulder[0] + s * H * 0.2 * L, shoulder[1] + H * 0.08, shoulder[0] + s * H * 0.42 * L, hip[1] - H * 0.05,
        shoulder[0] + s * H * 0.5 * L, hip[1] + H * 0.16);
      c.quadraticCurveTo(shoulder[0] + s * H * 0.22 * L, hip[1] + H * 0.12, hip[0], hip[1] + H * 0.06);
      c.lineTo(shoulder[0] + px * sw * 0.6, shoulder[1]);
      c.closePath();
      c.fill();
      c.fillStyle = fill;
    }
    // the neck and the head
    const head = [neckP[0] + Math.sin(p.lean + (p.head ?? 0)) * H * (k.head + 0.02), neckP[1] - Math.cos(p.lean + (p.head ?? 0)) * H * (k.head + 0.02)] as const;
    c.lineWidth = H * 0.04;
    c.beginPath();
    c.moveTo(shoulder[0], shoulder[1]);
    c.lineTo(head[0], head[1]);
    c.stroke();
    c.beginPath();
    c.arc(head[0], head[1], H * k.head, 0, TAU);
    c.fill();
    if (p.hair) {
      c.beginPath();
      c.moveTo(head[0] - H * k.head * 0.9, head[1] - H * k.head * 0.3);
      c.quadraticCurveTo(head[0] - H * k.head * (1.2 + p.hair), head[1] + H * k.head * 1.6, head[0] - H * k.head * (0.6 + p.hair * 1.4), head[1] + H * k.head * (2 + p.hair));
      c.quadraticCurveTo(head[0] - H * k.head * 0.2, head[1] + H * k.head, head[0] + H * k.head * 0.6, head[1] - H * k.head * 0.5);
      c.closePath();
      c.fill();
    }
  }
}
