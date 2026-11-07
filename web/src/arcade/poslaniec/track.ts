/**
 * The road ahead of the messenger, made in seeded patterns (the same seed gives the same road on any
 * device), with the original's vocabulary in our world:
 *
 *   low      a low fence or a fallen column across one lane — jump it
 *   high     a beam on two posts with a hanging sign — roll under it
 *   wagon    a parked wagon blocking a lane; its roof is a road of its own; a `ramp` at its near end
 *            lets the runner run up onto it, and wagons nose to tail make a roof run
 *   cart     an ox-cart coming down the lane toward the runner — leave the lane (or vault it in sandals)
 *
 * Every row leaves a passable line: a lane the runner can reach with one lane change, free or with
 * an obstacle a jump or a roll clears.  Drachmas come in lines along the passable line, in arcs over
 * fences and along roofs; power-ups and the day's letters sit in free lanes.  The rest road (the
 * watchtowers' block) is made of the gentle patterns only, further apart.  Pure: no DOM; randomness
 * only from its own generator.
 */
import { mulberry32 } from '../../core/random';
import type { PowerKind } from './content';
import { POWER_KINDS } from './content';
import { GRAVITY, RULES, jumpV, span } from './rules';

export type ObKind = 'low' | 'high' | 'wagon' | 'cart';

export interface Obstacle {
  readonly id: number;
  readonly kind: ObKind;
  readonly lane: number;
  /** the near end along the road (a cart's moves toward the runner) and the length (m) */
  z: number;
  readonly len: number;
  /** a wagon's ramp at its near end */
  readonly ramp: boolean;
  /** a cart: where it meets the runner, whether it rolls yet */
  readonly meet: number;
  rolling: boolean;
  /** hit once (a stumble passes through it), or passed by a move (for the tallies and the near-miss) */
  hit: boolean;
  passed: boolean;
  /** a visual variant */
  readonly look: number;
}

export interface Coin { readonly id: number; lane: number; z: number; y: number; taken: boolean; /** the flight's trail */ readonly sky: boolean }
export interface Power { readonly id: number; readonly kind: PowerKind; readonly lane: number; readonly z: number; readonly y: number; taken: boolean }
export interface Letter { readonly id: number; readonly lane: number; readonly z: number; readonly y: number; taken: boolean }

export type RoadMode = 'lesson' | 'run' | 'rest';
/** The lesson's items, one control each (the first-ever session's warm-up). */
export type Lesson = 'jump' | 'roll' | 'lane' | 'ramp';

export const LANES = [-1, 0, 1] as const;

/** Roof height of a wagon at `z` (m), or −1 outside it; the ramp rises from 0 to the roof. */
export function surfaceOf(o: Obstacle, z: number): number {
  if (o.kind !== 'wagon') return -1;
  const z0 = o.ramp ? o.z - RULES.rampLen : o.z;
  if (z < z0 || z > o.z + o.len) return -1;
  if (o.ramp && z < o.z) return RULES.wagonTop * (z - z0) / RULES.rampLen;
  return RULES.wagonTop;
}

export class Track {
  readonly obstacles: Obstacle[] = [];
  readonly coins: Coin[] = [];
  readonly powers: Power[] = [];
  readonly letters: Letter[] = [];
  /** the road is made up to here (m) */
  cursor: number;
  mode: RoadMode = 'run';
  /** the lesson's queue (the first-ever warm-up repeats a control until it was done) */
  lessons: Lesson[] = [];
  /** the next power-up and letter at (m); letters only while the day's word is open */
  private nextPower: number;
  private nextLetter: number;
  wantLetters = false;
  private readonly rnd: () => number;
  private ids = 0;
  /** the lane the last row left free */
  private free = 0;
  /** patterns made (for the tests) */
  made = 0;
  /** the lesson items made, with where they stand (the sim points the coach marks at them) */
  readonly lessonAt: { kind: Lesson; z: number; lane: number }[] = [];

  constructor(seed: number, startZ: number) {
    this.rnd = mulberry32(seed >>> 0);
    this.cursor = startZ;
    this.nextPower = startZ + RULES.powerEvery * (0.5 + 0.4 * this.rnd());
    this.nextLetter = startZ + RULES.letterEvery * (0.4 + 0.3 * this.rnd());
  }

  private id(): number { return ++this.ids; }
  private pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.rnd() * xs.length) % xs.length]; }

  /** Make the road up to `to` (m) at difficulty `d` (0..1). */
  fill(to: number, d: number): void {
    let guard = 0;
    while (this.cursor < to && guard++ < 200) {
      if (this.mode === 'lesson' && this.lessons.length) this.lesson(this.lessons.shift()!);
      else if (this.mode === 'rest') this.restPattern(d);
      else this.pattern(this.mode === 'lesson' ? 0.05 : d);
      this.made++;
    }
  }

  /** Clear what lies from `from` on (a change of road) and make it again from there. */
  clearFrom(from: number): void {
    let n = 0;
    for (const o of this.obstacles) if (o.hit || o.z - (o.ramp ? RULES.rampLen : 0) < from) this.obstacles[n++] = o;
    this.obstacles.length = n;
    n = 0;
    for (const c of this.coins) if (c.z < from || c.sky) this.coins[n++] = c;
    this.coins.length = n;
    n = 0;
    for (const p of this.powers) if (p.z < from) this.powers[n++] = p;
    this.powers.length = n;
    n = 0;
    for (const l of this.letters) if (l.z < from) this.letters[n++] = l;
    this.letters.length = n;
    this.cursor = Math.min(this.cursor, from);
  }

  /** A clear stretch [from, to): nothing stands there; the road resumes after it. */
  clearStretch(from: number, to: number): void {
    let n = 0;
    for (const o of this.obstacles) {
      const z0 = o.z - (o.ramp ? RULES.rampLen : 0);
      if (o.hit || o.z + o.len < from || z0 > to || o.kind === 'cart') this.obstacles[n++] = o;
    }
    this.obstacles.length = n;
    if (this.cursor < to) this.cursor = to;
  }

  /** Forget what lies behind the runner (`z` = the runner's distance). */
  prune(z: number): void {
    let n = 0;
    for (const o of this.obstacles) if (o.z + o.len > z - 12) this.obstacles[n++] = o;
    this.obstacles.length = n;
    n = 0;
    for (const c of this.coins) if (c.z > z - 6 && !c.taken) this.coins[n++] = c;
    this.coins.length = n;
    n = 0;
    for (const p of this.powers) if (p.z > z - 6 && !p.taken) this.powers[n++] = p;
    this.powers.length = n;
    n = 0;
    for (const l of this.letters) if (l.z > z - 6 && !l.taken) this.letters[n++] = l;
    this.letters.length = n;
  }

  // ── pieces ────────────────────────────────────────────────────
  private ob(kind: ObKind, lane: number, z: number, o: { len?: number; ramp?: boolean } = {}): Obstacle {
    const len = o.len ?? (kind === 'low' ? RULES.lowLen : kind === 'high' ? RULES.highLen : kind === 'cart' ? RULES.cartLen : span(RULES.wagonLen, this.rnd()));
    const ob: Obstacle = { id: this.id(), kind, lane, z, len, ramp: !!o.ramp, meet: z, rolling: false, hit: false, passed: false, look: Math.floor(this.rnd() * 4) };
    this.obstacles.push(ob);
    return ob;
  }

  private coinLine(lane: number, z: number, n: number, y = 0.9): void {
    for (let i = 0; i < n; i++) this.coins.push({ id: this.id(), lane, z: z + i * RULES.coinGap, y, taken: false, sky: false });
  }

  /** An arc of drachmas over a fence at `z`: where a jump started at the right moment carries the runner. */
  private coinArc(lane: number, z: number, v = 13): void {
    const vy = jumpV(RULES.jumpTop), air = (2 * vy) / GRAVITY;
    const start = z + RULES.lowLen / 2 - (air * v) / 2;
    for (let i = 0; i <= 6; i++) {
      const tt = (air * i) / 6;
      this.coins.push({ id: this.id(), lane, z: start + v * tt, y: 0.9 + vy * tt - (GRAVITY * tt * tt) / 2, taken: false, sky: false });
    }
  }

  /** Drachmas in the sky: the flight's trail, weaving across the lanes from `z` for `len` m (the sim calls it). */
  skyTrail(z: number, len: number): void {
    let lane = this.free, k = 0;
    for (let s = 0; s < len; s += RULES.flightCoinGap, k++) {
      if (k % 9 === 8) lane = Math.max(-1, Math.min(1, lane + (this.rnd() < 0.5 ? -1 : 1)));
      this.coins.push({ id: this.id(), lane, z: z + s, y: RULES.flightY + 0.2, taken: false, sky: true });
    }
  }

  /** A power-up and the day's letter, in the free lane, when their turn has come. */
  private extras(z: number, lane: number): void {
    if (z >= this.nextPower) {
      this.nextPower = z + RULES.powerEvery * (0.7 + 0.6 * this.rnd());
      this.powers.push({ id: this.id(), kind: this.pick(POWER_KINDS), lane, z, y: 1.0, taken: false });
      return;
    }
    if (this.wantLetters && z >= this.nextLetter && !this.letters.some(l => !l.taken)) {
      this.nextLetter = z + RULES.letterEvery * (0.75 + 0.5 * this.rnd());
      this.letters.push({ id: this.id(), lane, z, y: 1.1, taken: false });
    }
  }

  /** A neighbouring lane of `l` (or `l` itself) — the next free lane is never two changes away. */
  private near(l: number): number {
    const opts = LANES.filter(x => Math.abs(x - l) <= 1);
    return this.pick(opts);
  }

  // ── the patterns ──────────────────────────────────────────────
  /** One pattern of the run's road at difficulty `d`, starting at the cursor. */
  private pattern(d: number): void {
    const gap = span(RULES.rowGap, d);
    const z = this.cursor;
    const r = this.rnd();
    let end: number;
    if (d < 0.25) end = r < 0.45 ? this.rows(z, gap, d, 2) : r < 0.75 ? this.parked(z, gap, d) : this.rampRun(z, d);
    else if (r < 0.28) end = this.rows(z, gap, d, 3 + Math.floor(d * 3));
    else if (r < 0.48) end = this.parked(z, gap, d);
    else if (r < 0.66) end = this.rampRun(z, d);
    else if (r < 0.84) end = this.oncoming(z, gap, d);
    else end = this.slalom(z, gap, d);
    this.cursor = end + span(RULES.patternGap, d);
  }

  /** Rows of fences and beams: one lane (two when harder) blocked by a jump or a roll; drachmas on the free line. */
  private rows(z: number, gap: number, d: number, n: number): number {
    let at = z;
    for (let i = 0; i < n; i++) {
      const free = this.near(this.free);
      const blocked = LANES.filter(l => l !== free);
      const many = this.rnd() < 0.25 + d * 0.5 ? 2 : 1;
      const lanes = many === 2 ? blocked : [this.pick(blocked)];
      for (const l of lanes) {
        const kind: ObKind = this.rnd() < 0.5 ? 'low' : 'high';
        this.ob(kind, l, at);
        if (kind === 'low' && this.rnd() < 0.5) this.coinArc(l, at);
      }
      // sometimes the free lane gets a fence too (a jump on the best line), the drachmas over it
      if (d > 0.4 && this.rnd() < 0.3) {
        this.ob('low', free, at);
        this.coinArc(free, at);
      } else this.coinLine(free, at - 6, 4);
      this.extras(at + gap / 2, free);
      this.free = free;
      at += gap;
    }
    return at - gap;
  }

  /** Parked wagons in one or two lanes; the free lane carries drachmas, sometimes a fence or a beam. */
  private parked(z: number, gap: number, d: number): number {
    const free = this.near(this.free);
    const others = LANES.filter(l => l !== free);
    const len = span(RULES.wagonLen, this.rnd());
    const two = this.rnd() < 0.4 + d * 0.4;
    for (const l of two ? others : [this.pick(others)]) {
      const w = this.ob('wagon', l, z + this.rnd() * 3, { len });
      if (this.rnd() < 0.5) this.coinLine(l, w.z + 1, Math.floor(len / RULES.coinGap) - 1, RULES.wagonTop + 0.9);
    }
    this.coinLine(free, z - 4, 6);
    if (d > 0.3 && this.rnd() < 0.5) this.ob(this.rnd() < 0.5 ? 'low' : 'high', free, z + len * 0.6);
    this.extras(z + len + gap * 0.5, free);
    this.free = free;
    return z + len;
  }

  /** A ramp up onto a wagon and more wagons nose to tail: a roof run; the ground lanes beside are harder. */
  private rampRun(z: number, d: number): number {
    const lane = this.near(this.free);
    const n = 2 + Math.floor(this.rnd() * (1 + d * 2.5));
    let at = z + RULES.rampLen;
    for (let i = 0; i < n; i++) {
      const len = span(RULES.wagonLen, this.rnd());
      this.ob('wagon', lane, at, { len, ramp: i === 0 });
      this.coinLine(lane, at + 1, Math.floor(len / RULES.coinGap) - 1, RULES.wagonTop + 0.9);
      at += len + 0.8;
    }
    const end = at;
    // beside the roof: wagons to hop across onto, or fences and beams on the ground
    for (const l of LANES.filter(x => x !== lane)) {
      if (this.rnd() < 0.35 + d * 0.3) this.ob('wagon', l, z + RULES.rampLen + 4 + this.rnd() * 6, { len: span(RULES.wagonLen, this.rnd()) });
      else {
        for (let s = z + 10; s < end - 6; s += span(RULES.rowGap, d) * 1.2) this.ob(this.rnd() < 0.5 ? 'low' : 'high', l, s);
      }
    }
    this.lessonAt.push({ kind: 'ramp', z, lane });
    this.extras(end + 8, lane);
    this.free = lane;
    return end;
  }

  /** An ox-cart coming down a lane, a parked wagon beside it, the drachmas show the way out. */
  private oncoming(z: number, gap: number, d: number): number {
    const free = this.near(this.free);
    const others = LANES.filter(l => l !== free);
    const cl = this.pick(others);
    this.ob('cart', cl, z + 30, { len: RULES.cartLen });
    const wl = others.find(l => l !== cl)!;
    if (this.rnd() < 0.4 + d * 0.5) this.ob('wagon', wl, z + 8 + this.rnd() * 10);
    this.coinLine(free, z + 10, 8);
    this.extras(z + 30 + gap, free);
    this.free = free;
    return z + 30 + RULES.cartLen + 30;
  }

  /** Wagons in turn across the lanes: weave between them along a line of drachmas. */
  private slalom(z: number, gap: number, d: number): number {
    let lane = this.free, at = z;
    const n = 3 + Math.floor(d * 2);
    for (let i = 0; i < n; i++) {
      const next = lane === 0 ? this.pick([-1, 1]) : 0;
      // the lane the runner is in gets a wagon: step over to `next`
      this.ob('wagon', lane, at + 6, { len: span(RULES.wagonLen, 0.2) });
      this.coinLine(next, at, 5);
      lane = next;
      at += gap * 1.15;
    }
    this.free = lane;
    this.extras(at, lane);
    return at;
  }

  /** The watchtowers' road: single fences or beams far apart, long lines of drachmas. */
  private restPattern(d: number): void {
    const z = this.cursor;
    const free = this.near(this.free);
    if (this.rnd() < 0.6) {
      const l = this.pick(LANES.filter(x => x !== free));
      this.ob(this.rnd() < 0.5 ? 'low' : 'high', l, z);
    }
    this.coinLine(free, z - 8, 8);
    this.extras(z + 10, free);
    this.free = free;
    this.cursor = z + span(RULES.rowGap, d) * 2.2;
  }

  // ── the lesson (the first-ever warm-up) ───────────────────────
  private lesson(kind: Lesson): void {
    const z = this.cursor;
    if (kind === 'jump') for (const l of LANES) this.ob('low', l, z);
    else if (kind === 'roll') for (const l of LANES) this.ob('high', l, z);
    else if (kind === 'lane') {
      // a wagon in the middle and a beam beside it: step aside to the open lane
      this.ob('wagon', 0, z, { len: 10 });
      const open = this.rnd() < 0.5 ? -1 : 1;
      this.ob('wagon', -open, z, { len: 10 });
      this.coinLine(open, z - 6, 7);
      this.lessonAt.push({ kind, z, lane: open });
      this.cursor = z + 10 + 40;
      return;
    } else {
      this.ob('wagon', 0, z + RULES.rampLen, { len: 12, ramp: true });
      this.coinLine(0, z + RULES.rampLen + 1, 4, RULES.wagonTop + 0.9);
      this.lessonAt.push({ kind, z, lane: 0 });
      this.cursor = z + RULES.rampLen + 12 + 40;
      return;
    }
    this.coinLine(0, z + 4, 4);
    this.lessonAt.push({ kind, z, lane: 0 });
    this.cursor = z + 42;
  }
}
