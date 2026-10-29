/**
 * Wzlot's ground: an endless chain of wilderness hills, crest → trough → crest, each stretch a half
 * cosine, so height, slope and curvature are smooth everywhere and cheap to evaluate.  Hills come
 * in ridges of 16 that swell from gentle to bold and end at a crag ("Grań") over a wadi, a gorge
 * the eaglet flies across or is carried over.  A ridge is drawn from its own seed (mulberry32): the
 * same seed gives the same ridge on every device, so the day's first ridge is the same for everyone.
 * The ground is generated a ridge at a time ahead of the eaglet and dropped behind it.
 *
 * World units: x to the right, y up, in screen heights (rules.ts).
 */
import { mulberry32 } from '../../core/random';
import { RULES, span } from './rules';

/** How a ridge is made: its seed, a gentle warm-up ridge, a wide valley at its end (the stretch), the day's ridge. */
export interface RidgeSpec { seed: number; gentle: boolean; wide: boolean; daily: boolean }

export interface Ridge {
  readonly index: number;
  readonly spec: RidgeSpec;
  /** its first crest (where the last wadi's far rim is) */
  readonly x0: number;
  /** the crag: the ridge's last crest, high over the wadi */
  readonly crag: number;
  readonly cragY: number;
  /** the wadi: from the crag to the far rim, the rim's height and the line under which the parent catches */
  readonly wadiX0: number;
  readonly wadiX1: number;
  readonly rimY: number;
  readonly catchY: number;
  /** the troughs of its hills (thermals rise over them) */
  readonly troughs: readonly number[];
}

const PI = Math.PI;

export class Terrain {
  /** keypoints (alternately crests and troughs); between two of them the ground is a half cosine */
  private readonly kx: number[] = [];
  private readonly ky: number[] = [];
  readonly ridges: Ridge[] = [];
  /** the segment the last lookup found: lookups mostly move forward a little */
  private cur = 0;
  private made = 0;

  /** `spec(i)` describes the i-th ridge (0 = the first); the nest's crest is at (0, 0). */
  constructor(private readonly spec: (index: number) => RidgeSpec) {
    this.kx.push(0);
    this.ky.push(0);
  }

  /** Where the generated ground ends (x). */
  get end(): number { return this.kx[this.kx.length - 1]; }

  /** Make ridges until the ground reaches `x`. */
  ensure(x: number): void {
    while (this.end < x) this.addRidge();
  }

  /** Forget the ground before `x` (keeps the segment under it); ridges whose wadi lies behind go too. */
  trim(x: number): void {
    let n = 0;
    while (n + 2 < this.kx.length && this.kx[n + 1] < x) n++;
    if (n > 64) {
      this.kx.splice(0, n);
      this.ky.splice(0, n);
      this.cur = Math.max(0, this.cur - n);
    }
    while (this.ridges.length > 2 && this.ridges[0].wadiX1 < x) this.ridges.shift();
  }

  /** The index of the segment holding x (clamped to the ground made so far). */
  private seg(x: number): number {
    const kx = this.kx, last = kx.length - 2;
    let i = Math.min(this.cur, last);
    if (kx[i] <= x) {
      while (i < last && kx[i + 1] <= x) i++;
    } else {
      // a jump backwards (a roll back, the camera's left edge): binary search
      let lo = 0, hi = i;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (kx[mid] <= x) lo = mid; else hi = mid - 1;
      }
      i = lo;
    }
    this.cur = i;
    return i;
  }

  height(x: number): number {
    const i = this.seg(x), x0 = this.kx[i], L = this.kx[i + 1] - x0, y0 = this.ky[i], d = this.ky[i + 1] - y0;
    const u = Math.min(1, Math.max(0, (x - x0) / L));
    return y0 + d * (1 - Math.cos(PI * u)) / 2;
  }

  /** dy/dx */
  slope(x: number): number {
    const i = this.seg(x), x0 = this.kx[i], L = this.kx[i + 1] - x0, d = this.ky[i + 1] - this.ky[i];
    const u = Math.min(1, Math.max(0, (x - x0) / L));
    return (d * PI) / (2 * L) * Math.sin(PI * u);
  }

  /** d²y/dx² */
  bend(x: number): number {
    const i = this.seg(x), x0 = this.kx[i], L = this.kx[i + 1] - x0, d = this.ky[i + 1] - this.ky[i];
    const u = Math.min(1, Math.max(0, (x - x0) / L));
    return (d * PI * PI) / (2 * L * L) * Math.cos(PI * u);
  }

  /** The first crest after x (a keypoint higher than both neighbours), or the end of the ground. */
  crestAfter(x: number): { x: number; y: number } {
    this.ensure(x + 3);
    const kx = this.kx, ky = this.ky;
    for (let i = this.seg(x) + 1; i < kx.length - 1; i++) {
      if (ky[i] > ky[i - 1] && ky[i] > ky[i + 1] && kx[i] > x + 0.02) return { x: kx[i], y: ky[i] };
    }
    return { x: kx[kx.length - 1], y: ky[ky.length - 1] };
  }

  /** The ridge whose wadi spans x (null: none). */
  wadiAt(x: number): Ridge | null {
    for (const r of this.ridges) if (x > r.wadiX0 && x < r.wadiX1) return r;
    return null;
  }

  /** The ridge x lies on (its hills or its wadi). */
  ridgeAt(x: number): Ridge | null {
    for (let i = this.ridges.length - 1; i >= 0; i--) if (x >= this.ridges[i].x0) return this.ridges[i];
    return this.ridges[0] ?? null;
  }

  /** The first hill trough at or after x (thermals rise over them); null past the ground made so far. */
  troughAfter(x: number): number | null {
    for (const r of this.ridges) for (const t of r.troughs) if (t >= x) return t;
    return null;
  }

  /** Keypoints between x0 and x1 (the renderer's crest markers, tests). */
  keys(x0: number, x1: number, out: { x: number; y: number }[] = []): { x: number; y: number }[] {
    out.length = 0;
    for (let i = this.seg(x0); i < this.kx.length && this.kx[i] <= x1; i++) out.push({ x: this.kx[i], y: this.ky[i] });
    return out;
  }

  private push(x: number, y: number): void {
    this.kx.push(x);
    this.ky.push(y);
  }

  /**
   * One ridge from its seed: 16 hills that swell along the ridge, each crest pulled back toward the
   * nest's level so the land never drifts away; then a dip, the crag, and the wadi down to its floor
   * and up to the far rim, where the next ridge begins.
   */
  private addRidge(): void {
    const index = this.made++;
    const spec = this.spec(index);
    const R = RULES, rnd = mulberry32(spec.seed);
    const x0 = this.end;
    let x = x0, y = this.ky[this.ky.length - 1];
    const troughs: number[] = [];
    const n = R.hillsPerRidge;
    for (let i = 0; i < n; i++) {
      const k = span(R.swell, i / (n - 1)) * (spec.gentle ? R.gentle : 1);
      const wave = span(R.wave, rnd());
      const ld = wave * span(R.downShare, rnd()), lu = wave - ld;
      const drop = Math.min(span(R.drop, rnd()) * k, (R.slopeMax * 2 * ld) / PI);
      x += ld;
      y -= drop;
      this.push(x, y);
      troughs.push(x);
      // the rise: about the drop, pulled back toward the nest's level; an upslope too short for it
      // grows longer instead of steeper
      const rise = Math.max(0.05, Math.min(R.riseMax, drop - (y + drop) * R.levelPull + (rnd() - 0.5) * 0.05));
      x += Math.max(lu, (PI * rise) / (2 * R.slopeMax));
      y += rise;
      this.push(x, y);
    }
    // the run-up and the crag: a long dip that gathers speed, then a short steep kicker over the
    // wadi, about as high as the dip's start, so the speed it gathered carries over the gap
    const dl = span(R.cragRun, rnd()), dd = span(R.cragDip, rnd()) * (spec.gentle ? 0.5 : 1);
    x += dl;
    y -= dd;
    this.push(x, y);
    const cl = span(R.cragKick, rnd());
    const cr = Math.min(dd + span(R.cragRise, rnd()) * (spec.gentle ? 0.5 : 1), (R.cragSlope * 2 * cl) / PI);
    x += cl;
    y += cr;
    this.push(x, y);
    const crag = x, cragY = y;
    // the wadi: a gorge (or, after the gentle warm-up ridge, a shallow dip)
    const g = R.gentleWadi;
    const width = spec.gentle ? g.width : span(spec.wide ? R.wideWidth : R.wadiWidth, rnd());
    const depth = spec.gentle ? g.depth : spec.wide ? R.wideDepth : R.wadiDepth;
    const rim = cragY - (spec.gentle ? g.rim : spec.wide ? R.wideRimDrop : R.rimDrop);
    this.push(crag + width * 0.5, cragY - depth);
    this.push(crag + width, rim);
    this.ridges.push({
      index, spec, x0, crag, cragY, wadiX0: crag, wadiX1: crag + width, rimY: rim,
      // the gentle dip's floor stays above the line: nobody is caught in the warm-up's valley
      catchY: rim - R.wadiMargin, troughs,
    });
  }
}
