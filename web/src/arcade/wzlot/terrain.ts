/**
 * Wzlot's ground: Tiny Wings' islands as the wilderness's granie (ridges).  Each grań is a chain of
 * smooth hills — crest → trough → crest, each stretch a half cosine, so height, slope and curvature
 * are continuous and cheap — that swell from gentle to bold, then a long run-up dip and a kicker
 * (the crag) over a gorge to the next grań.  Granie grow bolder one after another: more hills,
 * longer waves, deeper valleys, wider gorges.  On every grań lie strings of promyki (sunbeams, the
 * coins) along the downslopes and in arcs over crests, and one podmuch (a gust orb) over a valley.
 *
 * A grań is drawn from its own seed (mulberry32): the day's granie are the same on every device and
 * in every run of the day, so the course can be learnt, as in the original.  The ground is made a
 * grań at a time ahead of the eaglet and forgotten behind it.
 *
 * World units: x to the right, y up, in screen heights (rules.ts).
 */
import { mulberry32 } from '../../core/random';
import { RULES, span } from './rules';

/** How a grań is made: its seed, and whether it is the first-ever session's gentle first one. */
export interface GranSpec { seed: number; gentle: boolean }

export interface Coin { x: number; y: number; taken: boolean }
export interface Orb { x: number; y: number; taken: boolean }

export interface Gran {
  /** 0 = the first grań of the day */
  readonly index: number;
  readonly spec: GranSpec;
  /** its first crest (the last gorge's far rim; the nest's crest for the first) */
  readonly x0: number;
  readonly hills: number;
  /** the crag: its last crest, over the gorge */
  readonly crag: number;
  readonly cragY: number;
  /** the gorge: from the crag to the far rim, the rim's height and the line under which the mother catches */
  readonly gapX0: number;
  readonly gapX1: number;
  readonly rimY: number;
  readonly catchY: number;
  /** the troughs of its hills (thermals rise over them) */
  readonly troughs: readonly number[];
  readonly coins: Coin[];
  readonly orbs: Orb[];
}

const PI = Math.PI;

export class Terrain {
  /** keypoints (alternately crests and troughs); between two of them the ground is a half cosine */
  private readonly kx: number[] = [];
  private readonly ky: number[] = [];
  readonly granie: Gran[] = [];
  private cur = 0;
  private made = 0;

  /** `spec(i)` describes the i-th grań (0 = the first); the nest's crest is at (0, 0). */
  constructor(private readonly spec: (index: number) => GranSpec) {
    this.kx.push(0);
    this.ky.push(0);
  }

  /** Where the generated ground ends (x). */
  get end(): number { return this.kx[this.kx.length - 1]; }

  /** Make granie until the ground reaches `x`. */
  ensure(x: number): void {
    while (this.end < x) this.addGran();
  }

  /** Forget the ground well before `x`; granie whose gorge lies far behind go too. */
  trim(x: number): void {
    let n = 0;
    while (n + 2 < this.kx.length && this.kx[n + 1] < x) n++;
    if (n > 64) {
      this.kx.splice(0, n);
      this.ky.splice(0, n);
      this.cur = Math.max(0, this.cur - n);
    }
    while (this.granie.length > 2 && this.granie[0].gapX1 < x - 1) this.granie.shift();
  }

  private seg(x: number): number {
    const kx = this.kx, last = kx.length - 2;
    let i = Math.min(this.cur, last);
    if (kx[i] <= x) {
      while (i < last && kx[i + 1] <= x) i++;
    } else {
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

  /** The grań whose gorge spans x (null: none). */
  gapAt(x: number): Gran | null {
    for (const g of this.granie) if (x > g.gapX0 && x < g.gapX1) return g;
    return null;
  }

  /** The grań x lies on (its hills or its gorge). */
  granAt(x: number): Gran | null {
    for (let i = this.granie.length - 1; i >= 0; i--) if (x >= this.granie[i].x0) return this.granie[i];
    return this.granie[0] ?? null;
  }

  /** The grań with this index, if it is still in memory. */
  byIndex(i: number): Gran | null {
    for (const g of this.granie) if (g.index === i) return g;
    return null;
  }

  /** The first hill trough at or after x (thermals rise over them). */
  troughAfter(x: number): number | null {
    for (const g of this.granie) for (const t of g.troughs) if (t >= x) return t;
    return null;
  }

  /** The lowest ground between x0 and x1 (sampled; the camera keeps it in view). */
  lowest(x0: number, x1: number): number {
    let lo = Infinity;
    const n = 16;
    for (let i = 0; i <= n; i++) lo = Math.min(lo, this.height(x0 + ((x1 - x0) * i) / n));
    return lo;
  }

  private push(x: number, y: number): void {
    this.kx.push(x);
    this.ky.push(y);
  }

  /**
   * One grań from its seed: its hills swell along it, each crest pulled back toward level 0 so the
   * land never drifts away; then the run-up, the crag, and the gorge down to its floor and up to the
   * far rim, where the next grań begins.  Then its promyki and its podmuch.
   */
  private addGran(): void {
    const index = this.made++;
    const spec = this.spec(index);
    const R = RULES, rnd = mulberry32(spec.seed);
    const x0 = this.end;
    let x = x0, y = this.ky[this.ky.length - 1];
    const troughs: number[] = [];
    const crests: number[] = [x0];
    const n = Math.min(R.hillsMax, R.hills0 + index);
    const bold = Math.min(R.boldMax, R.bold0 + R.boldStep * index) * (spec.gentle ? R.gentle : 1);
    const long = 1 + R.waveGrow * Math.min(8, index);
    for (let i = 0; i < n; i++) {
      const k = span(R.swell, i / Math.max(1, n - 1)) * bold;
      const wave = span(R.wave, rnd()) * long;
      const ld = wave * span(R.downShare, rnd()), lu = wave - ld;
      const drop = Math.min(span(R.drop, rnd()) * k, (R.slopeMax * 2 * ld) / PI);
      x += ld;
      y -= drop;
      this.push(x, y);
      troughs.push(x);
      const rise = Math.max(0.05, Math.min(R.riseMax, drop - (y + drop) * R.levelPull + (rnd() - 0.5) * 0.05));
      x += Math.max(lu, (PI * rise) / (2 * R.slopeMax));
      y += rise;
      this.push(x, y);
      crests.push(x);
    }
    // the run-up and the crag: a long dip that gathers speed, then a steep kicker over the gorge
    const dl = span(R.cragRun, rnd()), dd = span(R.cragDip, rnd()) * (spec.gentle ? 0.6 : 1);
    x += dl;
    y -= dd;
    this.push(x, y);
    const cl = span(R.cragKick, rnd());
    const cr = Math.min(dd + span(R.cragRise, rnd()), (R.cragSlope * 2 * cl) / PI);
    x += cl;
    y += cr;
    this.push(x, y);
    const crag = x, cragY = y;
    const width = span(R.gapWidth, rnd()) + R.gapGrow * Math.min(6, index) * (spec.gentle ? 0.5 : 1);
    const rim = cragY - span(R.rimDrop, rnd());
    this.push(crag + width * 0.5, cragY - R.gapDepth);
    this.push(crag + width, rim);
    const g: Gran = {
      index, spec, x0, hills: n, crag, cragY, gapX0: crag, gapX1: crag + width, rimY: rim,
      catchY: rim - R.gapMargin, troughs, coins: [], orbs: [],
    };
    this.granie.push(g);
    this.dress(g, crests, rnd);
  }

  /** The grań's promyki (strings along downslopes, arcs over crests) and its podmuch over a valley. */
  private dress(g: Gran, crests: number[], rnd: () => number): void {
    const R = RULES;
    const strings = Math.round(span(R.strings, rnd()));
    const hills = crests.length - 1;
    const used = new Set<number>();
    for (let s = 0; s < strings && hills > 1; s++) {
      let h = 1 + Math.floor(rnd() * (hills - 1));
      for (let k = 0; k < hills && used.has(h); k++) h = 1 + ((h + k) % (hills - 1));
      if (used.has(h)) break;
      used.add(h);
      const len = Math.round(span(R.stringLen, rnd()));
      if (rnd() < 0.5) {
        // along the downslope after crest h: the line a perfect slide takes
        const start = crests[h] + 0.08;
        for (let i = 0; i < len; i++) {
          const cx = start + i * R.coinGap;
          g.coins.push({ x: cx, y: this.height(cx) + R.coinLift, taken: false });
        }
      } else {
        // an arc over crest h: the line a launch flies
        const top = span(R.arcLift, rnd()), c = crests[h], w = (len - 1) * R.coinGap * 1.3;
        for (let i = 0; i < len; i++) {
          const u = len > 1 ? i / (len - 1) : 0.5;
          const cx = c - w * 0.2 + w * u;
          g.coins.push({ x: cx, y: this.height(c) + 0.08 + top * Math.sin(PI * u), taken: false });
        }
      }
    }
    if (g.troughs.length > 2) {
      const t = g.troughs[1 + Math.floor(rnd() * (g.troughs.length - 2))];
      g.orbs.push({ x: t, y: this.height(t) + span(R.orbLift, rnd()), taken: false });
    }
  }
}
