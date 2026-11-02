/**
 * The road ahead of the messenger, made in seeded chunks (the same seed gives the same road on any
 * device): rows of obstacles across the three lanes that always leave a passable line — a free lane
 * the runner can reach with at most one lane change per row, or an obstacle in it that a jump or a
 * slide clears — trains of carts with a ramped wagon to run along, full-width columns and aqueduct
 * arches, goats crossing; drachmas in lines and arcs along the passable line; sandals and a satchel
 * now and then.  Pure: no DOM, randomness only from its own generator.
 *
 * Quiet stretches (rest blocks, the heights, the mule cart) clear what lies ahead and make only
 * drachmas (or nothing) until the road resumes.
 */
import { mulberry32 } from '../../core/random';
import { RULES, span } from './rules';

export type ObKind = 'wall' | 'column' | 'arch' | 'branch' | 'cart' | 'wagon' | 'goat';
/** how an obstacle is passed: jump over, slide under, change lane (or run up a wagon's ramp) */
export const PASS: Readonly<Record<ObKind, 'jump' | 'slide' | 'lane'>> = {
  wall: 'jump', column: 'jump', arch: 'slide', branch: 'slide', cart: 'lane', wagon: 'lane', goat: 'jump',
};

export interface Obstacle {
  readonly id: number;
  readonly kind: ObKind;
  /** the centre lane (−1..1; a goat's is where it is now) and how many lanes it spans (1 or 3) */
  lane: number;
  readonly width: 1 | 3;
  /** its near end along the road and its length (m) */
  readonly z: number;
  readonly len: number;
  /** a wagon's ramp at its near end */
  readonly ramp: boolean;
  /** a goat's crossing direction (+1 to the right) and whether it walks */
  readonly dir: number;
  walking: boolean;
  /** it was hit (a stumble passes through it) or cleared by a move */
  hit: boolean;
  cleared: boolean;
  /** play time it appeared (the picture fades it in) */
  readonly born: number;
  /** a visual variant */
  readonly look: number;
}

export interface Coin { readonly id: number; lane: number; readonly z: number; readonly y: number; taken: boolean; /** on the heights' road */ readonly high: boolean }
export type PowerKind = 'sandals' | 'satchel';
export interface Power { readonly id: number; readonly kind: PowerKind; readonly lane: number; readonly z: number; taken: boolean }

/** What a quiet stretch makes: a few drachmas (rest), or nothing (the heights, the mule cart). */
export type QuietMode = 'coins' | 'none';

const LANES = [-1, 0, 1] as const;

/** Something removed from the road ahead (the picture lets it fade). */
export interface Gone { kind: 'ob' | 'coin'; item: Obstacle | Coin; t: number }

export class Track {
  readonly obstacles: Obstacle[] = [];
  readonly coins: Coin[] = [];
  readonly powers: Power[] = [];
  readonly gone: Gone[] = [];
  /** the road is made up to here (m) */
  cursor: number;
  private quietMode: QuietMode | null = null;
  private readonly rnd: () => number;
  private ids = 0;
  private safe = 0;
  private nextPower: number;
  private powerFlip: boolean;
  /** the warm-up's lesson: a wall, an arch and a cart, one at a time */
  private lesson: boolean;
  /** play time (s), for the fade-ins */
  now = 0;
  /** rows made, for the tests */
  rowsMade = 0;

  constructor(seed: number, startZ: number, opts: { lesson?: boolean } = {}) {
    this.rnd = mulberry32(seed >>> 0);
    this.cursor = startZ;
    this.lesson = !!opts.lesson;
    this.nextPower = startZ + RULES.powerEvery * (0.6 + 0.5 * this.rnd());
    this.powerFlip = this.rnd() < 0.5;
  }

  get quiet(): QuietMode | null { return this.quietMode; }

  /** Make the road up to `to` (m) at difficulty `d` (0..1). */
  fill(to: number, d: number): void {
    while (this.cursor < to) {
      if (this.quietMode) this.quietChunk();
      else if (this.lesson) this.lessonChunk();
      else this.chunk(d);
    }
  }

  /** From `z` on, the road is quiet: what lies there is cleared (it fades), and only `mode` is made. */
  hush(z: number, mode: QuietMode): void {
    this.quietMode = mode;
    this.clearFrom(z);
    this.cursor = Math.min(this.cursor, Math.max(z, 0));
  }

  /** The road resumes from `z` (what a quiet stretch made beyond it is cleared, then made again). */
  resume(z: number): void {
    if (!this.quietMode) return;
    this.quietMode = null;
    this.clearFrom(z);
    this.cursor = z;
    this.safe = 0;
  }

  /** Clear everything (obstacles, drachmas, power-ups) from `z` on. */
  clearFrom(z: number, onlyLow = false): void {
    let n = 0;
    for (const o of this.obstacles) {
      if (o.z + o.len > z && !o.hit) this.gone.push({ kind: 'ob', item: o, t: this.now });
      else this.obstacles[n++] = o;
    }
    this.obstacles.length = n;
    n = 0;
    for (const c of this.coins) {
      if (c.z >= z && !c.taken && !(onlyLow && c.high)) this.gone.push({ kind: 'coin', item: c, t: this.now });
      else this.coins[n++] = c;
    }
    this.coins.length = n;
    n = 0;
    for (const p of this.powers) if (p.z < z || p.taken) this.powers[n++] = p;
    this.powers.length = n;
  }

  /** Forget what lies behind `z` (and faded leftovers). */
  trim(z: number): void {
    const keep = <T extends { z: number }>(xs: T[], len: (x: T) => number) => {
      let n = 0;
      for (const x of xs) if (x.z + len(x) >= z) xs[n++] = x;
      xs.length = n;
    };
    keep(this.obstacles, o => o.len);
    keep(this.coins, () => 0);
    keep(this.powers, () => 0);
    let n = 0;
    for (const g of this.gone) if (this.now - g.t < 0.6) this.gone[n++] = g;
    this.gone.length = n;
  }

  /**
   * Drachmas on the heights' road from `z0` up to `z1`: a line snaking across the lanes (steer to
   * follow it), and every sixth row a full row.  Returns where the next row would be.
   */
  heightsCoins(z0: number, z1: number): number {
    let z = z0;
    for (; z < z1; z += RULES.heightsCoinGap) {
      const k = Math.round(z / RULES.heightsCoinGap);
      const lanes = k % 6 === 0 ? LANES : [Math.round(Math.sin(k * 0.33) * 1.2)];
      for (const lane of lanes) this.coins.push({ id: ++this.ids, lane: Math.max(-1, Math.min(1, lane)), z, y: RULES.heightsY + 0.6, taken: false, high: true });
    }
    return z;
  }

  // ── making ──────────────────────────────────────────────────────
  private ob(kind: ObKind, lane: number, z: number, len: number, o: { width?: 1 | 3; ramp?: boolean; dir?: number } = {}): Obstacle {
    const ob: Obstacle = {
      id: ++this.ids, kind, lane, width: o.width ?? 1, z, len, ramp: !!o.ramp, dir: o.dir ?? 1, walking: false,
      hit: false, cleared: false, born: this.now, look: Math.floor(this.rnd() * 4),
    };
    this.obstacles.push(ob);
    return ob;
  }

  private coinLine(lane: number, z0: number, z1: number, gap = 2.2, y = 0.6): void {
    for (let z = z0; z <= z1; z += gap) this.coins.push({ id: ++this.ids, lane, z, y, taken: false, high: false });
  }

  /** An arc of drachmas over a jump at `z` (the jump's own curve). */
  private coinArc(lane: number, z: number, speedish = 11): void {
    const T = RULES.jumpSec, top = RULES.jumpTop;
    for (let i = 0; i <= 6; i++) {
      const s = i / 6;
      this.coins.push({ id: ++this.ids, lane, z: z - speedish * T * 0.5 + s * speedish * T, y: 0.6 + 4 * top * s * (1 - s), taken: false, high: false });
    }
  }

  private pick<T>(xs: readonly T[]): T { return xs[Math.min(xs.length - 1, Math.floor(this.rnd() * xs.length))]; }

  private quietChunk(): void {
    const z = this.cursor + 8;
    if (this.quietMode === 'coins' && this.rnd() < 0.7) this.coinLine(this.pick(LANES), z, z + 10 + this.rnd() * 8, 2.4);
    this.cursor = z + 26 + this.rnd() * 10;
  }

  /** The warm-up's lesson: jump a wall, slide under an arch, step round a cart — in the middle lane, with room. */
  private lessonChunk(): void {
    const z = this.cursor + 34;
    this.ob('wall', 0, z, RULES.wallLen);
    this.coinArc(0, z);
    this.ob('arch', 0, z + 40, RULES.archLen);
    this.coinLine(0, z + 38, z + 42, 1.6, 0.35);
    this.ob('cart', 0, z + 82, 6);
    this.coinLine(1, z + 76, z + 92, 2.2);
    this.cursor = z + 110;
    this.safe = 1;
    this.lesson = false;
  }

  private chunk(d: number): void {
    const r = this.rnd();
    const z0 = this.cursor + span(RULES.chunkGap, d) * (0.85 + 0.3 * this.rnd());
    let end: number;
    if (d >= 0.15 && r < 0.12) end = this.goats(z0, d);
    else if (d >= 0.25 && r < 0.2) end = this.fullRow(z0, this.rnd() < 0.5 ? 'column' : 'arch');
    else if (r < 0.36) end = this.train(z0, d);
    else end = this.rows(z0, d);
    this.cursor = end;
    if (this.cursor >= this.nextPower) this.power();
  }

  /** Rows across the lanes with a passable line through them. */
  private rows(z0: number, d: number): number {
    const n = 2 + Math.floor(this.rnd() * (2 + 3 * d));
    const gap = span(RULES.rowGap, d) * (0.92 + 0.16 * this.rnd());
    let z = z0;
    for (let i = 0; i < n; i++) {
      const prev = this.safe;
      if (this.rnd() < 0.35 + 0.3 * d) this.safe = Math.max(-1, Math.min(1, this.safe + (this.rnd() < 0.5 ? -1 : 1)));
      // what the safe lane holds: nothing, or something a jump or a slide clears
      const cells: (ObKind | null)[] = [null, null, null];
      if (this.rnd() < 0.2 + 0.45 * d) cells[this.safe + 1] = this.pick(['wall', 'column', 'arch', 'branch'] as const);
      const fill = 0.4 + 0.45 * d;
      for (const lane of LANES) {
        if (lane === this.safe || this.rnd() >= fill) continue;
        const r = this.rnd();
        cells[lane + 1] = r < 0.45 ? 'cart' : r < 0.6 ? 'wall' : r < 0.72 ? 'column' : r < 0.88 ? 'arch' : 'branch';
      }
      if (!cells.some(Boolean)) {
        const others = LANES.filter(l => l !== this.safe);
        cells[this.pick(others) + 1] = 'cart';
      }
      // a cart in the lane the line moves into ends with room to step in behind it
      const room = this.safe !== prev ? 9 : 5;
      for (const lane of LANES) {
        const k = cells[lane + 1];
        if (!k) continue;
        const len = k === 'cart' ? Math.min(span(RULES.cartLen, this.rnd()), gap - room) : k === 'wall' || k === 'column' ? RULES.wallLen : RULES.archLen;
        this.ob(k, lane, z, Math.max(2.5, len));
      }
      // drachmas along the line: an arc over a jump, a low line under an arch, else a line into the row
      const s = cells[this.safe + 1];
      if (s === 'wall' || s === 'column') this.coinArc(this.safe, z);
      else if (s === 'arch' || s === 'branch') this.coinLine(this.safe, z - 2, z + 2, 1.6, 0.35);
      else if (this.rnd() < 0.75) this.coinLine(this.safe, z - gap * 0.55, z + 3, 2.2);
      this.rowsMade++;
      z += gap;
    }
    return z;
  }

  /** A train: a long covered wagon with a ramp to run up, carts beside it, drachmas on its roof. */
  private train(z0: number, d: number): number {
    const lane = this.safe;
    const len = span(RULES.wagonLen, this.rnd());
    this.ob('wagon', lane, z0, len, { ramp: true });
    this.coinLine(lane, z0 + RULES.rampLen + 1, z0 + len - 1, 2.2, RULES.wagonTop + 0.6);
    for (const other of LANES) {
      if (other === lane) continue;
      if (this.rnd() < 0.45 + 0.4 * d) {
        // a caravan: carts nose to tail, the length of the wagon
        let z = z0 + this.rnd() * 3;
        while (z < z0 + len - 3) {
          const l = Math.min(span(RULES.cartLen, this.rnd()), z0 + len - z);
          if (l >= 2.5) this.ob('cart', other, z, l);
          z += l + 0.6;
        }
      } else if (this.rnd() < 0.5) this.coinLine(other, z0, z0 + len * 0.6, 2.4);
    }
    this.rowsMade++;
    return z0 + len + 6;
  }

  /** A fallen column or an aqueduct's arches across the whole road. */
  private fullRow(z0: number, kind: 'column' | 'arch'): number {
    this.ob(kind, 0, z0, kind === 'column' ? RULES.wallLen : RULES.archLen, { width: 3 });
    if (kind === 'column') this.coinArc(this.safe, z0);
    else this.coinLine(this.safe, z0 - 2, z0 + 2, 1.6, 0.35);
    this.rowsMade++;
    return z0 + 14;
  }

  /** Goats crossing the road: one or two, from either side. */
  private goats(z0: number, d: number): number {
    const n = d > 0.5 && this.rnd() < 0.5 ? 2 : 1;
    let z = z0;
    for (let i = 0; i < n; i++) {
      const dir = this.rnd() < 0.5 ? 1 : -1;
      this.ob('goat', -1.7 * dir, z, RULES.goatLen, { dir });
      this.coinLine(this.safe, z - 8, z - 2, 2.2);
      this.rowsMade++;
      z += 16;
    }
    return z;
  }

  private power(): void {
    this.powerFlip = !this.powerFlip;
    this.powers.push({ id: ++this.ids, kind: this.powerFlip ? 'sandals' : 'satchel', lane: this.safe, z: this.cursor + 6, taken: false });
    this.nextPower = this.cursor + RULES.powerEvery * (0.67 + 0.66 * this.rnd());
    this.cursor += 12;
  }
}

/** The ground under a lane position at z: a wagon's ramp and roof lift it. */
export function groundAt(obs: readonly Obstacle[], x: number, z: number): number {
  let g = 0;
  for (const o of obs) {
    if (o.kind !== 'wagon' || Math.abs(x - o.lane) > 0.5 || z < o.z || z > o.z + o.len) continue;
    const into = z - o.z;
    g = Math.max(g, o.ramp && into < RULES.rampLen ? (into / RULES.rampLen) * RULES.wagonTop : RULES.wagonTop);
  }
  return g;
}
