/**
 * Urodzaj's rules and state, without the DOM or the canvas (so every rule is unit-tested): Suika Game
 * in Boaz's field.
 *
 *   the basket     Feliks the sparrow carries the next fruit along the twine over a wicker basket; the
 *                  player moves him (drag, mouse, ← →) and lets go (release, tap, Space): the fruit
 *                  falls straight down.  Two alike fruit that touch join into the next of eleven,
 *                  olive to the great cluster (physics.ts); the points are Suika's triangular ladder,
 *                  times a chain multiplier when merges cascade.  Two great clusters leave on the pole.
 *                  Only the five smallest are dropped; the next one shows in its bubble.
 *   the rim        the overflow line: a fruit over it for 2 s ends the basket — a tally with stars, the
 *                  basket is carried to the table, a new one slides in.  The session goes on and every
 *                  point stays (never a lost session).
 *   Wiatr żniwny   the push block (charge): past the lead-in the wind's strength `w` follows the level;
 *                  above the threshold it fills the charge, and a full charge blows the harvest wind —
 *                  the basket rocks and settles, then the wind draws alike neighbours together (the
 *                  big moment).  A passed block adds charge.  Blind: the wind hides; at the block's
 *                  end the veil lifts and what it gathered blows at once.
 *   Pokłosie       the rest block (gleaners, Ruth 2): past the lead-in calm fills the gleaners' step;
 *                  each full step takes the smallest fruit off the heap to the table (space and
 *                  points).  A passed block: two more.
 *
 * While the signal is unreliable `w`, the charge and the gleaners freeze (never a loss).  Each block
 * is judged once at its end (RoundJudge over its last 15 s), contrasted for the summary
 * (BlockContrast).  Lengths are W, y up, the basket's floor at 0; times in seconds.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp, ease } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { DROP_TIERS, LINES, MAX_TIER, TIPS, festName, festivalAt, fruit, tierFromU } from './content';
import { cap, pts, t, unit } from './i18n';
import { dailyDue, festFeed, migrate, starsFor, type FestEvent, type UrodzajProgress } from './meta';
import { PHYS, World, type Body, type Merge, type Pair } from './physics';
import { BASKET, RULES } from './rules';
import { Talk } from './talk';

export { BASKET, RULES };

/** On Kosz dnia the n-th drop draws from mulberry32(daySeed + DROP_STEP · n): the same fruit for everyone that day. */
export const DROP_STEP = 7919;

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';

/** A fruit the wind is drawing to its partner. */
export interface Pull { a: Body; b: Body; t: number; dur: number; x0: number; y0: number }
/** A small fruit a gleaner carries to the table. */
export interface Flight { body: Body; t: number; x0: number; y0: number }
/** A fruit as it lay when the basket was carried off (the view slides it to the table). */
export interface Snap { tier: number; x: number; y: number; r: number; angle: number }
/** The basket being carried to the table: the tally, then the slide. */
export interface Change { t: number; final: boolean; snaps: Snap[]; score: number; stars: number; index: number }

export type HintKey = 'aim' | 'drop' | 'next' | 'merge' | 'ring' | 'line' | 'wind' | 'windFull' | 'glean' | 'blind' | 'pole';
/** Where a coach mark points: Feliks, the next bubble, the circle, the rim gauge, the gleaners, or a point in the basket. */
export type HintAt = 'feliks' | 'next' | 'ring' | 'rim' | 'gleaners' | 'basket';

export type SimEvent =
  | { type: 'drop'; tier: number; x: number }
  | { type: 'land'; tier: number; x: number; y: number; speed: number }
  /** `link` 0 = a lone merge; `first` = the first of its tier ever; `pulled` = the wind brought them together */
  | { type: 'merge'; tier: number; x: number; y: number; pts: number; link: number; mult: number; pulled: boolean; first: boolean }
  | { type: 'pole'; x: number; y: number; pts: number }
  | { type: 'danger'; on: boolean }
  | { type: 'basketEnd'; index: number; score: number; stars: number; top: number; record: boolean; toRecord: number | null; final: boolean }
  | { type: 'basketNew'; index: number }
  | { type: 'windUp'; hidden: boolean }
  | { type: 'wind'; pairs: number; power: number }
  | { type: 'ready' }
  | { type: 'glean'; tier: number; x: number; y: number; pts: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'reveal'; charge: number }
  | { type: 'hint'; key: HintKey; at: HintAt; x: number; y: number }
  | { type: 'mission'; fest: number; mission: number }
  | { type: 'festival'; fest: number }
  | { type: 'finale' }
  | { type: 'end' };

const NO_EVENTS: readonly SimEvent[] = [];

/** Suika's points for making tier k: T(k) = k(k + 1) / 2. */
export const mergePoints = (tier: number): number => fruit(tier).pts;

/** The chain's multiplier for a link (0 = a lone merge). */
export const chainMult = (link: number): number => Math.min(RULES.chainCap, 1 + RULES.chainStep * Math.max(0, link));

/** The charge a second of wind of strength w adds. */
export const chargeRate = (w: number): number => RULES.chargeRate * clamp((w - RULES.chargeFrom) / RULES.chargeSpan);

/** Shorter blocks borrow from the longer ones so none is under `min` (in place). */
export function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/** The evening's free seconds at the session's end: 10 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in
 * 3, 6 s in a 40 s test); then Wiatr / Pokłosie pairs (24 ± 4 s and 24 ± 3 s, scaled to end on time,
 * jittered only when there is room), ending with a Pokłosie, leaving the evening's seconds at the end.
 * No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const fin = finaleFor(plannedSec);
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - fin);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('push', left - rest), b('rest', rest)];
  }
  const plan: Block[] = [];
  let left = plannedSec - fin;
  if (firstEver) {
    const warm = plannedSec >= 300 ? R.warm.long : R.warm.short;
    plan.push(b('warmup', warm));
    left -= warm;
  }
  const pair = R.push[0] + R.rest[0];
  const pairs = Math.max(1, Math.round(left / pair));
  const jitter = pairs >= 2 && left / (pairs * pair) >= 0.85 ? 1 : 0;
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) durs.push(R.push[0] + jitter * (rnd() * 2 - 1) * R.push[1], R.rest[0] + jitter * (rnd() * 2 - 1) * R.rest[1]);
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, R.minBlock);
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'rest' : 'push', dur)));
  return plan;
}

/** Disjoint pairs from a list, nearest first. */
function pickPairs(found: readonly Pair[], max: number): [Body, Body][] {
  const used = new Set<number>();
  const out: [Body, Body][] = [];
  for (const p of found) {
    if (out.length >= max) break;
    if (used.has(p.a.id) || used.has(p.b.id)) continue;
    used.add(p.a.id);
    used.add(p.b.id);
    // the higher one is drawn down to the lower (it looks like settling, not lifting)
    out.push(p.a.y >= p.b.y ? [p.a, p.b] : [p.b, p.a]);
  }
  return out;
}

const speedOf = (b: Body): number => Math.hypot(b.vx, b.vy);

export interface SimInit {
  progress: UrodzajProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

/** The basket now: its number in the session, its points, merges and the biggest fruit in it so far. */
export interface Basket { index: number; score: number; merges: number; top: number; t: number }

export class UrodzajSim {
  readonly progress: UrodzajProgress;
  readonly world = new World();
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly plan: Block[];
  readonly trace = new SignalTrace(40, 0.1);
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  private readonly judge: RoundJudge;
  private readonly rng: () => number;
  private readonly day: string;
  private readonly daySeed: number;
  private events: SimEvent[] = [];

  // ── the session ──
  started = false;
  phase: Phase = 'play';
  t = 0;
  /** seconds since the session ended (the last tally) */
  doneT = 0;
  score = 0;
  readonly daily: boolean;
  /** this is the player's first session ever (the warm-up, the coach marks, the opening card) */
  readonly firstEver: boolean;
  readonly session: number;
  private readonly bestBefore: number;
  private readonly bestBasketBefore: number;
  private readonly base: { harvest: number; baskets: number; merges: number; made: number[]; winds: number; gleaned: number; poles: number; bestTier: number };

  // ── the blocks ──
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  tip = '';
  private relSec = 0;
  private pushesBase: number;
  private pushesBegun = 0;
  /** per block: passed or not (null: no verdict) */
  readonly verdicts: { kind: BlockKind; verdict: boolean | null }[] = [];

  // ── the dropper ──
  aim = 0;
  aimTarget = 0;
  /** the fruit Feliks carries and the next one */
  cur = 1;
  next = 1;
  cooldown = 0;
  private pending = false;
  private keyDir = 0;
  private keyHeld = 0;
  drops = 0;
  /** the last dropped fruit, while it falls (the guide stays off it; it is exempt from the rim) */
  falling: Body | null = null;
  lastInput = 0;

  // ── the basket ──
  basket: Basket = { index: 1, score: 0, merges: 0, top: 0, t: 0 };
  change: Change | null = null;
  overT = 0;
  danger = false;
  private dangerPeak = 0;
  private link = 0;
  private lastMergeT = -99;
  /** a hit-stop: the world waits this long (s) */
  freeze = 0;

  // ── the wind (push) ──
  /** its strength 0..1 (0.5 = the threshold): what the rim shows and the panel's gauge reads */
  w: number = RULES.windNeutral;
  charge = 0;
  wind: { t: number; stage: 'up' | 'shake'; power: number; hidden: boolean } | null = null;
  readonly pulls: Pull[] = [];
  private goodT = 0;
  private goodSaid = false;
  private readySaid = false;
  /** the band's frame this tick */
  reliable = false;
  level = 0;
  calm = 0;

  // ── the gleaners (rest) ──
  glean = 0;
  readonly flights: Flight[] = [];
  private gleanSaid = false;

  // ── stats ──
  readonly made = new Array<number>(MAX_TIER).fill(0);
  merges = 0;
  winds = 0;
  gleaned = 0;
  poles = 0;
  bestChain = 0;
  bestBasket = 0;
  basketsDone = 0;
  stars: number[] = [];
  readonly firsts: number[] = [];
  readonly fests: number[] = [];
  /** the opening card (first session) and the festival card */
  story: { kind: 'open' | 'fest'; t: number; dur: number; fest: number } | null = null;
  private hinted = new Set<HintKey>();
  private swallow = false;

  constructor(init: SimInit) {
    this.progress = migrate(init.progress);
    const p = this.progress;
    this.rng = init.rng;
    this.day = init.day;
    this.daySeed = init.daySeed;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    this.firstEver = p.sessions === 0;
    this.session = p.sessions + 1;
    this.daily = dailyDue(p, init.day);
    this.bestBefore = p.bestSession;
    this.bestBasketBefore = p.bestBasket;
    this.base = { harvest: p.harvest, baskets: p.baskets, merges: p.merges, made: p.made.slice(), winds: p.winds, gleaned: p.gleaned, poles: p.poles, bestTier: p.bestTier };
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.firstEver, init.rng);
    this.talk = new Talk(LINES, init.rng);
  }

  // ── what the view and the runner read ──
  get block(): Block { return this.plan[this.blockIndex]; }
  get nextBlock(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  get lead(): number { return this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs; }
  get restLead(): number { return this.eeg ? RULES.restLead.eeg : RULES.restLead.fnirs; }
  /** a push block past its lead-in, the wind in sight */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  /** the gleaners work: a rest block past its lead-in */
  get gleaning(): boolean { return this.restBlock && this.blockT >= this.restLead; }
  /** drops are open: not between baskets, not over a story card, the session not over */
  get open(): boolean { return this.started && this.phase !== 'done' && !this.change && !this.story; }
  get hangR(): number { return fruit(this.cur).r; }
  /** the hanging fruit's x, kept inside the walls */
  get hangX(): number { return this.clampAim(this.aim + this.sway, this.cur); }
  /** the hanging fruit's little sway (W) */
  get sway(): number { return RULES.sway * Math.sin(2 * Math.PI * RULES.swayHz * this.t); }
  /** the runner's banner (the first ~4.5 s of a block) and the block's telegraph: Feliks keeps quiet */
  get talkBlocked(): boolean {
    if (this.story || (this.change && this.change.t < RULES.tally)) return true;
    if (this.phase !== 'play') return false;
    const b = this.block;
    return (b.kind !== 'warmup' && this.blockT < 4.5) || this.blockT >= b.dur - RULES.telegraph;
  }
  /** the panel's gauge: the wind's strength in a push block (null blind / no signal), the gleaners' pace (calm) in rest */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    const b = this.block;
    if (b.kind === 'push') return b.blind ? null : clamp(this.w);
    if (b.kind === 'rest') return clamp(this.calm);
    return null;
  }

  private clampAim(x: number, tier: number): number {
    const r = fruit(tier).r, lim = BASKET.half - r - 0.002;
    return Math.max(-lim, Math.min(lim, x));
  }

  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events;
    this.events = [];
    return out;
  }

  // ── start ──
  start(): void {
    if (this.started) return;
    this.started = true;
    // the tutorial's first drops pair up, so the first merge comes at once
    this.cur = this.drawTier(0);
    this.next = this.drawTier(1);
    this.startBlock(0);
    if (this.firstEver) {
      this.story = { kind: 'open', t: 0, dur: 9, fest: 0 };
    } else this.talk.ask('open', 3, 8);
  }

  /** The tier of the n-th drop of the session (0-based). */
  drawTier(n: number): number {
    if (this.firstEver && n < 4) return [1, 1, 2, 2][n];
    const u = this.daily ? mulberry32((this.daySeed + DROP_STEP * n) >>> 0)() : this.rng();
    return Math.min(DROP_TIERS, tierFromU(u));
  }

  // ── input ──
  /** A press: the aim goes to the finger (a press on a story card closes it instead). */
  pointerDown(x: number): void {
    this.lastInput = this.t;
    if (this.story) {
      this.story = null;
      this.swallow = true;
      this.afterStory();
      return;
    }
    this.aimTarget = x;
    this.aim = approach(this.aim, x, 1 / 60, RULES.aimSnap);
  }

  /** A drag (or a hovering mouse) moves the aim. */
  pointerMove(x: number): void {
    this.aimTarget = x;
    if (Math.abs(x - this.aim) > 0.02) this.moved();
  }

  /** The release drops the fruit where the finger is. */
  pointerUp(x: number): void {
    this.lastInput = this.t;
    if (this.swallow) {
      this.swallow = false;
      return;
    }
    this.aimTarget = x;
    this.aim = x;
    this.requestDrop();
  }

  /** ← → held: −1, 0, 1. */
  keyAim(dir: number): void {
    this.keyDir = Math.sign(dir);
    this.keyHeld = 0;
    this.lastInput = this.t;
    if (this.keyDir) {
      this.aimTarget = this.aim + this.keyDir * 0.02;
      this.moved();
    }
  }

  /** Space, Enter or ↓. */
  keyDrop(): void {
    this.lastInput = this.t;
    if (this.story) {
      this.story = null;
      this.afterStory();
      return;
    }
    this.aimTarget = this.aim;
    this.requestDrop();
  }

  /** The runner pauses: held keys and a pending drop are let go. */
  release(): void {
    this.keyDir = 0;
    this.pending = false;
    this.swallow = false;
  }

  private moved(): void {
    if (this.firstEver && this.hinted.has('aim') && !this.hinted.has('drop')) this.hint('drop', 'feliks');
  }

  private requestDrop(): void {
    if (!this.open) return;
    if (this.cooldown <= 0) this.drop();
    else if (this.cooldown <= RULES.buffer) this.pending = true;
  }

  private drop(): void {
    this.pending = false;
    const tier = this.cur, x = this.clampAim(this.aimTarget + this.sway, tier);
    this.aim = this.aimTarget = this.clampAim(this.aimTarget, tier);
    const b = this.world.add(tier, x, BASKET.hang);
    this.falling = b;
    this.drops++;
    this.cur = this.next;
    this.next = this.drawTier(this.drops + 1);
    this.cooldown = RULES.cooldown;
    // a chain is a cascade: a new drop starts a new one
    this.link = -1;
    this.lastMergeT = -99;
    this.emit({ type: 'drop', tier, x });
    if (this.firstEver) {
      this.hinted.add('aim');
      this.hinted.add('drop');
      if (this.drops === 2) this.hint('next', 'next');
    }
  }

  private afterStory(): void {
    if (this.firstEver) this.hint('aim', 'feliks');
    this.talk.ask(this.firstEver ? 'warm' : 'open', 3, 8);
  }

  private hint(key: HintKey, at: HintAt, x = 0, y = 0): void {
    if (this.hinted.has(key)) return;
    this.hinted.add(key);
    this.emit({ type: 'hint', key, at, x, y });
  }

  // ── the frame ──
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    if (this.phase === 'done') {
      this.doneT += dt;
      this.tickChange(dt);
      this.talk.update(dt, t, this.talkBlocked);
      return;
    }
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) {
        const was = this.story.kind;
        this.story = null;
        if (was === 'open') this.afterStory();
      }
    }
    this.brain(dt, f);
    this.schedule(dt, f, t);
    if ((this.phase as Phase) === 'done') return;
    this.steer(dt);
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    else if (!this.change) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.pending && this.cooldown <= 0 && this.open) this.drop();
      this.world.advance(dt);
      this.drainWorld();
      this.tickWind(dt);
      this.tickPulls(dt);
      this.tickGlean(dt);
      this.drainWorld();
      this.tickOverflow(dt);
      this.basket.t += dt;
    }
    this.tickChange(dt);
    // idle: Feliks nudges, and the first session's aim hint comes back
    if (this.open && t - this.lastInput >= RULES.idleHint * 2 && this.drops > 0) {
      this.lastInput = t;
      this.talk.ask('idle', 1, 4);
    }
    this.talk.update(dt, t, this.talkBlocked);
  }

  private steer(dt: number): void {
    if (this.keyDir) {
      this.keyHeld += dt;
      const v = Math.min(RULES.keyMax, RULES.keySpeed + (RULES.keyMax - RULES.keySpeed) * clamp(this.keyHeld / RULES.keyRamp));
      this.aimTarget = this.clampAim(this.aimTarget + this.keyDir * v * dt, this.cur);
    }
    this.aimTarget = Math.max(-BASKET.half, Math.min(BASKET.half, this.aimTarget));
    this.aim = approach(this.aim, this.aimTarget, dt, RULES.aimSnap);
  }

  // ── the band ──
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES;
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    const b = this.block;
    const play = this.phase === 'play';
    const want: TracePhase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(this.t, f, want, this.blind);
    if (play && b.kind !== 'warmup' && f.reliable) this.relSec += dt;
    const live = this.pushBlock && this.blockT >= this.lead && f.reliable;
    // the wind follows the level past the lead-in; it eases back to neutral outside push blocks and freezes without signal
    if (live) this.w = approach(this.w, clamp(f.level), dt, R.windTau);
    else if (!this.pushBlock) this.w = approach(this.w, R.windNeutral, dt, 2);
    if (live && !this.block.blind && this.pushesBase === 0) this.hint('wind', 'rim');
    if (live && !this.change) {
      const cap = this.block.blind ? R.blindCap : 1;
      const before = this.charge;
      this.charge = Math.min(cap, this.charge + chargeRate(this.w) * dt);
      if (!this.block.blind) {
        if (this.w >= 0.5) this.goodT += dt;
        else this.goodT = 0;
        if (this.goodT >= 4 && !this.goodSaid) {
          this.goodSaid = true;
          this.talk.ask('good', 2, 4);
        }
        if (before < 0.85 && this.charge >= 0.85 && !this.readySaid) {
          this.readySaid = true;
          this.talk.ask('ready', 2, 3);
          this.emit({ type: 'ready' });
        }
        if (this.charge >= 1 && !this.wind) this.blow(1, false);
      }
    }
    // the gleaners: calm fills their step past the lead-in
    if (this.gleaning && f.reliable && !this.change) this.glean = Math.min(1 + R.passGlean, this.glean + R.gleanRate * clamp(f.calm) * dt);
  }

  // ── the blocks ──
  private schedule(dt: number, f: FocusFrame, t: number): void {
    if (this.phase === 'finale') {
      if (t >= this.plannedSec) this.endSession();
      return;
    }
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - finaleFor(this.plannedSec)) {
      this.endBlock();
      this.phase = 'finale';
      this.emit({ type: 'finale' });
    } else if (!last && this.blockT >= b.dur) {
      this.endBlock();
      this.startBlock(this.blockIndex + 1);
    }
  }

  private startBlock(i: number): void {
    this.blockIndex = i;
    this.blockT = 0;
    this.telegraphed = false;
    this.relSec = 0;
    this.judge.reset();
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.goodT = 0;
      this.goodSaid = false;
      this.readySaid = false;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (b.blind && this.progress.pushes === 0) this.hint('blind', 'rim');
      this.progress.pushes = this.pushesBase + this.pushesBegun;
    } else if (b.kind === 'rest') {
      this.glean = 0;
      this.gleanSaid = false;
      this.talk.ask('rest', 2, 12);
    } else this.talk.ask('warm', 1, 8);
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup;
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (first && this.pushesBase === 0) return TIPS.firstPush;
      return TIPS.push[(this.session - 1 + i) % TIPS.push.length];
    }
    if (first && this.session === 1) return TIPS.firstRest;
    return TIPS.rest[(this.session - 1 + i) % TIPS.rest.length];
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push') {
        if (verdict) this.charge = Math.min(b.blind ? RULES.blindCap + 1 : 1, this.charge + RULES.passCharge);
        if (b.blind) {
          this.trace.unveil(this.t);
          this.emit({ type: 'reveal', charge: this.charge });
          const n = Math.floor(this.charge);
          if (n >= 1 && !this.wind) this.blow(n, true);
        } else if (this.charge >= 1 && !this.wind) this.blow(1, false);
      } else if (verdict) {
        this.glean += RULES.passGlean;
      }
    }
    this.verdicts.push({ kind: b.kind, verdict });
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  // ── the harvest wind ──
  /** Start the wind: the wind-up, then the shake, then the pull of alike neighbours (power = how many charges it spends). */
  private blow(power: number, hidden: boolean): void {
    if (this.change || this.phase === 'done') return;
    this.charge = Math.max(0, this.charge - power);
    this.wind = { t: 0, stage: 'up', power, hidden };
    this.emit({ type: 'windUp', hidden });
  }

  private tickWind(dt: number): void {
    const w = this.wind;
    if (!w) return;
    w.t += dt;
    const R = RULES;
    if (w.stage === 'up' && w.t >= R.windUp) {
      w.stage = 'shake';
      w.t = 0;
      this.world.shake(R.shakeSec, R.shakeAcc, R.shakeHz);
      this.world.settle(R.shakeMu, R.shakeG, PHYS.restitution * 0.5);
      this.freeze = R.stopBig;
      this.winds++;
      this.sync();
    } else if (w.stage === 'shake' && w.t >= R.shakeSec) {
      this.world.settle(1, 1, PHYS.restitution);
      const found = this.world.pairs([], { maxGap: R.windGap, limit: 40, clear: R.windClear, minR: 0.05 });
      const pairs = pickPairs(found, R.windPairs * w.power);
      for (const [a, b] of pairs) this.startPull(a, b);
      this.wind = null;
      this.emit({ type: 'wind', pairs: pairs.length, power: w.power });
      this.talk.ask('wind', 4, 4);
      if (this.firstEver || this.progress.winds <= 1) this.hint('windFull', 'basket');
    }
  }

  private startPull(a: Body, b: Body): void {
    a.kinematic = true;
    this.pulls.push({ a, b, t: 0, dur: RULES.windPull, x0: a.x, y0: a.y });
  }

  private tickPulls(dt: number): void {
    for (let i = this.pulls.length - 1; i >= 0; i--) {
      const p = this.pulls[i];
      if (!this.world.has(p.a) || !this.world.has(p.b)) {
        if (this.world.has(p.a)) p.a.kinematic = false;
        this.pulls.splice(i, 1);
        continue;
      }
      p.t += dt;
      const k = ease.inOutSine(clamp(p.t / p.dur));
      p.a.x = p.x0 + (p.b.x - p.x0) * k;
      p.a.y = p.y0 + (p.b.y - p.y0) * k;
      p.a.vx = p.a.vy = 0;
      const gap = Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) - p.a.r - p.b.r;
      if (p.t >= p.dur || gap <= 0) {
        this.pulls.splice(i, 1);
        p.a.kinematic = false;
        this.world.joinAt(p.a, p.b);
      }
    }
  }

  // ── the gleaners ──
  private tickGlean(dt: number): void {
    const R = RULES;
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const fl = this.flights[i];
      fl.t += dt;
      const k = clamp(fl.t / R.gleanFlight);
      const tx = -BASKET.half - 0.28, ty = 0.08;
      fl.body.x = fl.x0 + (tx - fl.x0) * ease.inOutSine(k);
      fl.body.y = fl.y0 + (ty - fl.y0) * k + Math.sin(Math.PI * k) * 0.25;
      if (k >= 1) {
        this.flights.splice(i, 1);
        const tier = fl.body.tier;
        this.world.remove(fl.body);
        const p = fruit(tier).pts * R.gleanMult;
        this.addPoints(p);
        this.gleaned++;
        this.sync();
        this.emit({ type: 'glean', tier, x: tx, y: ty, pts: p });
        if (!this.gleanSaid) {
          this.gleanSaid = true;
          this.talk.ask('glean', 2, 4);
        }
      }
    }
    if (this.glean < 1 || this.change) return;
    // the smallest fruit first, the highest of them (a gleaner reaches in from the rim)
    let pick: Body | null = null;
    for (const b of this.world.bodies) {
      if (b.kinematic || b.dead || b === this.falling || b.tier > R.gleanTier || b.touched < 0) continue;
      if (!pick || b.tier < pick.tier || (b.tier === pick.tier && b.y > pick.y)) pick = b;
    }
    if (!pick) {
      this.glean = Math.min(this.glean, 1);
      return;
    }
    this.glean -= 1;
    pick.kinematic = true;
    this.world.wake();
    this.flights.push({ body: pick, t: 0, x0: pick.x, y0: pick.y });
    if (this.progress.gleaned === 0 || this.firstEver) this.hint('glean', 'gleaners');
  }

  // ── merges and points ──
  private drainWorld(): void {
    const w = this.world;
    for (const l of w.landings) {
      if (l.body === this.falling) this.falling = null;
      if (l.speed > 0.4) this.emit({ type: 'land', tier: l.body.tier, x: l.body.x, y: l.body.y, speed: l.speed });
    }
    w.landings.length = 0;
    if (this.falling && (this.falling.dead || this.world.t - this.falling.born > 3)) this.falling = null;
    for (const m of w.merges) this.merged(m);
    w.merges.length = 0;
    for (const p of w.poles) this.pole(p.x, p.y);
    w.poles.length = 0;
  }

  private chainLink(): number {
    this.link = this.link >= 0 && this.world.t - this.lastMergeT <= RULES.chainWindow ? this.link + 1 : 0;
    this.lastMergeT = this.world.t;
    this.bestChain = Math.max(this.bestChain, this.link + 1);
    return this.link;
  }

  private merged(m: Merge): void {
    const link = this.chainLink();
    const mult = chainMult(link);
    const p = Math.round(mergePoints(m.tier) * mult);
    const first = this.base.bestTier < m.tier && !this.firsts.includes(m.tier) && this.made[m.tier - 1] === 0 && this.base.made[m.tier - 1] === 0;
    this.made[m.tier - 1]++;
    this.merges++;
    this.basket.merges++;
    this.basket.top = Math.max(this.basket.top, m.tier);
    if (first) this.firsts.push(m.tier);
    this.addPoints(p);
    this.sync();
    if (m.tier >= RULES.stopTier) this.freeze = Math.max(this.freeze, RULES.stopBig);
    this.emit({ type: 'merge', tier: m.tier, x: m.x, y: m.y, pts: p, link, mult, pulled: m.pulled, first });
    this.fest(festFeed(this.progress, 'merges', 1));
    this.fest(festFeed(this.progress, 'make', m.tier));
    if (link + 1 >= 2) this.fest(festFeed(this.progress, 'chain', link + 1));
    if (first && m.tier >= 3) this.talk.ask('newTier', 3, 4);
    else if (m.tier >= 8) this.talk.ask('big', 3, 4);
    else if (link + 1 >= 3) this.talk.ask('chain', 2, 3);
    if (this.firstEver && !this.hinted.has('merge')) this.hint('merge', 'basket', m.x, m.y);
    else if (this.firstEver && this.merges >= 4) this.hint('ring', 'ring');
  }

  private pole(x: number, y: number): void {
    const link = this.chainLink();
    const p = Math.round((mergePoints(MAX_TIER) + RULES.poleBonus) * chainMult(link));
    this.poles++;
    this.addPoints(p);
    this.sync();
    this.freeze = RULES.stopBig * 1.5;
    this.emit({ type: 'pole', x, y, pts: p });
    this.talk.ask('pole', 4, 4);
    if (this.base.poles === 0) this.hint('pole', 'basket', x, y);
  }

  private addPoints(n: number): void {
    if (!(n > 0)) return;
    this.score += n;
    this.basket.score += n;
    this.bestBasket = Math.max(this.bestBasket, this.basket.score);
    this.fest(festFeed(this.progress, 'harvest', n));
    this.fest(festFeed(this.progress, 'basket', this.basket.score));
  }

  private fest(evs: FestEvent[]): void {
    for (const e of evs) {
      if (e.kind === 'mission') this.emit({ type: 'mission', fest: e.fest, mission: e.mission });
      else {
        this.fests.push(e.fest);
        this.emit({ type: 'festival', fest: e.fest });
        this.talk.ask('fest', 4, 6);
        if (!this.story && this.phase !== 'done') this.story = { kind: 'fest', t: 0, dur: 3.2, fest: e.fest };
      }
    }
  }

  /** Live counters into the progress: the base at the session's start plus this session's (set, never added: idempotent). */
  private sync(): void {
    const p = this.progress, b = this.base;
    p.harvest = Math.max(p.harvest, b.harvest + this.score);
    p.merges = Math.max(p.merges, b.merges + this.merges);
    p.winds = Math.max(p.winds, b.winds + this.winds);
    p.gleaned = Math.max(p.gleaned, b.gleaned + this.gleaned);
    p.poles = Math.max(p.poles, b.poles + this.poles);
    p.baskets = Math.max(p.baskets, b.baskets + this.basketsDone);
    for (let i = 0; i < MAX_TIER; i++) p.made[i] = Math.max(p.made[i] ?? 0, b.made[i] + this.made[i]);
    let top = 0;
    for (let i = 0; i < MAX_TIER; i++) if (this.made[i] > 0) top = i + 1;
    p.bestTier = Math.max(p.bestTier, top);
    p.bestChain = Math.max(p.bestChain, this.bestChain);
    p.bestBasket = Math.max(p.bestBasket, this.bestBasket);
  }

  // ── the rim ──
  /** A fruit that counts for the rim: settled in the heap (one still falling, just dropped or flying never does). */
  private settled(b: Body): boolean {
    return !b.kinematic && b !== this.falling && this.world.t - b.born >= RULES.overExempt && b.touched >= 0;
  }

  /** A settled fruit over the rim (one bouncing up never counts). */
  private overRim(): boolean {
    for (const b of this.world.bodies) if (this.settled(b) && b.y + b.r > BASKET.rim && speedOf(b) < RULES.overSpeed) return true;
    return false;
  }

  /** The top of the settled heap (W). */
  heapTop(): number {
    let top = 0;
    for (const b of this.world.bodies) if (this.settled(b)) top = Math.max(top, b.y + b.r);
    return top;
  }

  private tickOverflow(dt: number): void {
    const over = this.overRim();
    this.overT = over ? this.overT + dt : Math.max(0, this.overT - dt * 0.5);
    this.dangerPeak = Math.max(this.dangerPeak, this.overT);
    const near = this.heapTop() > BASKET.rim - RULES.warnGap;
    const danger = this.overT > 0 || near;
    if (danger !== this.danger) {
      this.danger = danger;
      this.emit({ type: 'danger', on: danger });
      if (danger) {
        this.talk.ask('near', 3, 2);
        if (this.firstEver || this.progress.baskets === 0) this.hint('line', 'rim');
      } else {
        if (this.dangerPeak > 0.8) this.talk.ask('saved', 2, 3);
        this.dangerPeak = 0;
      }
    }
    if (this.overT >= RULES.overflowSec) this.endBasket(false);
  }

  /** The basket is full (or the session is over): the tally, then it is carried to the table. */
  private endBasket(final: boolean): void {
    if (this.change) return;
    const bk = this.basket;
    const stars = starsFor(bk.score, RULES.stars);
    this.basketsDone++;
    this.stars.push(stars);
    const record = bk.score > this.bestBasketBefore && bk.score > 0 && this.bestBasketBefore > 0;
    const gap = this.bestBasketBefore - bk.score;
    const toRecord = gap > 0 && gap <= Math.max(60, this.bestBasketBefore * 0.25) ? gap : null;
    this.sync();
    this.fest(festFeed(this.progress, 'stars', stars));
    const snaps: Snap[] = this.world.bodies.map(b => ({ tier: b.tier, x: b.x, y: b.y, r: b.r, angle: b.angle }));
    this.change = { t: 0, final, snaps, score: bk.score, stars, index: bk.index };
    // what was in the air stops with the basket: a wind not yet blown keeps its charge
    if (this.wind && this.wind.stage === 'up') this.charge = Math.min(1, this.charge + this.wind.power);
    this.wind = null;
    this.world.settle(1, 1, PHYS.restitution);
    this.world.shakeEnd = 0;
    this.pulls.length = 0;
    for (const fl of this.flights) {
      const p = fruit(fl.body.tier).pts * RULES.gleanMult;
      this.addPoints(p);
      this.gleaned++;
    }
    this.flights.length = 0;
    this.overT = 0;
    this.falling = null;
    if (this.danger) {
      this.danger = false;
      this.emit({ type: 'danger', on: false });
    }
    this.emit({ type: 'basketEnd', index: bk.index, score: bk.score, stars, top: bk.top, record, toRecord, final });
    if (!final) this.talk.ask('basket', 4, 5);
  }

  private tickChange(dt: number): void {
    const c = this.change;
    if (!c) return;
    const before = c.t;
    c.t += dt;
    if (c.final) return;
    if (before < RULES.tally && c.t >= RULES.tally) {
      // the old basket goes to the table, a new one comes in
      this.world.clear();
      this.basket = { index: c.index + 1, score: 0, merges: 0, top: 0, t: 0 };
      this.link = 0;
      this.emit({ type: 'basketNew', index: this.basket.index });
    }
    if (c.t >= RULES.tally + RULES.slide) {
      this.change = null;
      this.cooldown = 0.15;
    }
  }

  // ── the end ──
  private endSession(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.doneT = 0;
    this.story = null;
    this.change = null;
    this.endBasket(true);
    this.talk.clear();
    this.talk.ask('end', 5, 6);
    this.emit({ type: 'end' });
  }

  /** Ended early ("Zakończ i zapisz", the overtime limit): settle at once. */
  finish(): void {
    if (!this.started) this.started = true;
    if (this.phase !== 'done' && this.blockIndex < this.plan.length && this.phase === 'play') this.endBlock();
    this.endSession();
  }

  padLevel(f: FocusFrame): number | null {
    return this.sighted && f.reliable ? f.level : null;
  }

  /** The session may stop once the last basket's tally has been seen (at most ~2 s). */
  canStop(): boolean {
    return this.phase === 'done' ? this.doneT >= 1.8 : !this.started;
  }

  // ── the summary ──
  result(): ArcadeOutcome {
    const p = this.progress;
    this.sync();
    p.sessions = Math.max(p.sessions, this.session);
    p.bestSession = Math.max(p.bestSession, this.score);
    p.lastDay = this.day;
    if (this.daily) {
      p.dailyDay = this.day;
      p.dailyScore = Math.max(p.dailyDay === this.day ? p.dailyScore : 0, this.score);
      p.dailyBest = Math.max(p.dailyBest, this.score);
    }
    const baskets = this.basketsDone + (this.phase === 'done' ? 0 : 1);
    const top = this.topTier();
    const stats: [string, string][] = [
      [t('stat.baskets'), fmtNum(baskets)],
      [t('stat.bestBasket'), pts(this.bestBasket)],
      [t('stat.top'), top > 0 ? cap(fruit(top).name) : '—'],
      [t('stat.chain'), this.bestChain > 1 ? `×${fmtNum(this.bestChain)}` : '—'],
      [t('stat.winds'), fmtNum(this.winds)],
      [t('stat.gleaned'), fmtNum(this.gleaned)],
    ];
    const c = this.contrast.contrast;
    if (c !== null) stats.push([t('stat.contrast'), `${c >= 0 ? '+' : '−'}${fmtNum(Math.abs(c), 1)}%`]);
    return {
      score: this.score, unit: unit(this.score), record: this.score > this.bestBefore && this.bestBefore > 0, stats,
      highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /** The biggest fruit made this session (0: none). */
  topTier(): number {
    for (let i = MAX_TIER - 1; i >= 0; i--) if (this.made[i] > 0) return i + 1;
    return 0;
  }

  private highlights(): string[] {
    const out: string[] = [];
    for (const tier of this.firsts.slice(-3)) out.push(t('hl.first', { fruit: fruit(tier).name }));
    if (this.poles) out.push(t('hl.pole', { n: this.poles }));
    for (const f of this.fests) out.push(t('hl.fest', { fest: festName(festivalAt(f)) }));
    if (this.score > this.bestBefore && this.bestBefore > 0) out.push(t('hl.record'));
    else if (this.bestBefore > 0 && this.bestBefore - this.score > 0 && this.bestBefore - this.score <= this.bestBefore * 0.2) out.push(t('hl.near', { n: this.bestBefore - this.score }));
    if (this.daily) out.push(t('hl.daily'));
    out.push(t(`close.${1 + ((this.session - 1) % 4)}` as 'close.1'));
    return out;
  }

  closingVerse(): PassageId {
    const n = this.session;
    if (this.poles > 0 || this.topTier() >= MAX_TIER) return 'psa65.11';
    if (this.firsts.length) return inTurn(['deu8.8', 'psa65.11'], n);
    if (this.fests.length) return 'luk14.13-14';
    if (this.gleaned >= 4) return inTurn(['rut2.16', 'lev19.9', 'jhn6.12'], n);
    if (this.daily) return 'mat6.11';
    return inTurn(['psa126.5', '2co9.7', 'deu8.10'], n);
  }
}
