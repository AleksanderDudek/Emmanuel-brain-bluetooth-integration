/**
 * Game feel shared by the arcade games: easing, a particle pool, floating words ("Idealnie!"),
 * and a camera shake that stays still when the player asked for reduced motion.
 */

export const clamp = (v: number, lo = 0, hi = 1): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Frame-rate independent approach of `a` toward `b` with time constant `tau` (s). */
export const approach = (a: number, b: number, dt: number, tau: number): number => (tau <= 0 ? b : b + (a - b) * Math.exp(-dt / tau));

export const ease = {
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outElastic: (t: number) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  /** downward acceleration (px/s²) and drag (1/s) */
  g: number; drag: number;
  shape: 'dot' | 'square' | 'ring' | 'spark';
  rot: number; vr: number;
}

/** A fixed-size pool: bursts never allocate during play. */
export class Particles {
  private readonly pool: Particle[] = [];
  private n = 0;

  constructor(private readonly cap = 400) {
    for (let i = 0; i < cap; i++) this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', g: 0, drag: 0, shape: 'dot', rot: 0, vr: 0 });
  }

  get count(): number { return this.n; }

  /** `count` particles from (x, y), spread over `spread` radians around `angle`, at `speed` ± 50 %. */
  burst(x: number, y: number, count: number, o: Partial<Pick<Particle, 'color' | 'size' | 'g' | 'drag' | 'shape'>> & { speed?: number; angle?: number; spread?: number; life?: number; rnd?: () => number } = {}): void {
    const rnd = o.rnd ?? Math.random;
    for (let i = 0; i < count && this.n < this.cap; i++) {
      const p = this.pool[this.n++];
      const a = (o.angle ?? -Math.PI / 2) + (rnd() - 0.5) * (o.spread ?? Math.PI * 2);
      const s = (o.speed ?? 160) * (0.5 + rnd());
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = p.life = (o.life ?? 0.9) * (0.6 + 0.8 * rnd());
      p.size = (o.size ?? 3) * (0.6 + 0.8 * rnd());
      p.color = o.color ?? '#fff';
      p.g = o.g ?? 260; p.drag = o.drag ?? 1.2; p.shape = o.shape ?? 'dot';
      p.rot = rnd() * Math.PI * 2; p.vr = (rnd() - 0.5) * 8;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        // swap with the last live one
        this.n--;
        const last = this.pool[this.n];
        this.pool[this.n] = p;
        this.pool[i] = last;
        i--;
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.n; i++) {
      const p = this.pool[i];
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
        ctx.restore();
      } else if (p.shape === 'ring') {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (2 - a), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'spark') {
        ctx.lineWidth = Math.max(1, p.size * 0.6);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear(): void { this.n = 0; }
}

export interface FloatText { text: string; x: number; y: number; t: number; dur: number; color: string; size: number }

/** Words that pop, rise and fade ("Idealnie!", "+120"). */
export class Floaters {
  readonly items: FloatText[] = [];

  add(text: string, x: number, y: number, o: { color?: string; size?: number; dur?: number } = {}): void {
    this.items.push({ text, x, y, t: 0, dur: o.dur ?? 1.1, color: o.color ?? '#fff', size: o.size ?? 26 });
    if (this.items.length > 12) this.items.shift();
  }

  update(dt: number): void {
    for (const f of this.items) f.t += dt;
    while (this.items.length && this.items[0].t >= this.items[0].dur) this.items.shift();
  }

  draw(ctx: CanvasRenderingContext2D, font: string): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.items) {
      const k = f.t / f.dur;
      const pop = k < 0.18 ? ease.outBack(k / 0.18) : 1;
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      ctx.font = `${Math.round(f.size * pop)}px ${font}`;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillText(f.text, f.x, f.y - 46 * ease.outCubic(k) + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - 46 * ease.outCubic(k));
    }
    ctx.globalAlpha = 1;
  }
}

/** A decaying camera shake (trauma model); silent with reduced motion. */
export class Shake {
  private trauma = 0;
  private t = 0;
  constructor(private readonly still = reducedMotion()) {}

  add(amount: number): void { if (!this.still) this.trauma = Math.min(1, this.trauma + amount); }

  /** The offset to translate the scene by this frame (px). */
  offset(dt: number, maxPx = 12): { x: number; y: number } {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * maxPx;
    return { x: s * Math.sin(this.t * 53.1), y: s * Math.sin(this.t * 41.7 + 1.3) };
  }
}

/** A short vibration on phones that have one (ignored elsewhere). */
export function buzz(ms: number | number[]): void {
  try { navigator.vibrate?.(ms); } catch { /* not allowed here */ }
}
