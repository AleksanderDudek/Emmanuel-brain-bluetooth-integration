/**
 * Urodzaj's rules and state, without the DOM or the canvas (so every rule is unit-tested).
 *
 * A woven basket on a hillside orchard: the player aims a hanging fruit and drops it (physics.ts);
 * two alike fruit that touch join into the next of nine tiers, olive to the great cluster, and a merge
 * soon after the basket's last one is a chain link (×1 + 0.25 a link, up to ×3).  A great cluster
 * crowns the basket (+150) and a new one comes with a breather of small fruit.  A heap whose top stays
 * over the rim for 2 s tips: what is above the rim rolls to the gleaners at the field's edge, every
 * point stays, and a new basket with one olive slides in — nothing is ever subtracted.
 *
 * The band adds craft, never grace.  The session alternates Zbiór (push: the vine V follows `level`
 * after a lead-in, shoots grow from steady `hold`, and tendrils reach between alike fruit that almost
 * touch) and Rosa (rest: a linen cloth covers the basket and the dew D gathers from `calm`).  Each
 * block is judged once on its last 15 s by the kit's RoundJudge and pays out in one visible beat
 * right after it: the vine gathers the tied pairs (Zbiór), the dew settles the heap and bridges near
 * pairs (Rosa).  While the signal is unreliable V, K and D freeze (the block clock runs on); a block
 * with under 8 reliable seconds pays at the neutral floor without a verdict.
 *
 * The evening at the table ends every session: the day's loaf (the same for everyone who comes),
 * Ruth and Naomi by the story, and the guests drawn with published odds and pity.  On the day's first
 * session ("Kosz dnia") the n-th drop and the block plan come from the date, so everyone playing the
 * same length meets the same fruit in the same order.
 *
 * Lengths are W (the basket's inner width at the rim), y up, the floor at 0; times in seconds.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum, fmtSigned } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  BREATHER, DUPLICATE_GRAIN, GREAT_BONUS, MAX_TIER, TABLE_STEPS, TIER_NAME, TIPS, fruit, guestById, tierFromU, type GuestId, type Tier,
} from './content';
import { cap, t, unit } from './i18n';
import { drawGuest, loafDue, naomiDue, nextMissing, ruthDue, tablePoints, tableState, type Draw, type UrodzajProgress } from './meta';
import { BASKET, PHYS, World, type Body, type Merge, type Pair } from './physics';

export const RULES = {
  /** the aim keeps the hanging fruit this far inside the rim (W) */
  aimPad: 0.005,
  /** a pointer down eases the aim to the finger over this long (s) */
  aimSnap: 0.06,
  /** the hanging fruit sways ±1 px at 1.2 Hz (also with reduced motion): no two drops land dead centre on each other */
  sway: 0.003,
  swayHz: 1.2,
  keySpeed: 0.5,
  keySpeedMax: 1.6,
  keyRamp: 0.6,
  keyTap: 0.02,
  /** after a drop; a release in its last `buffer` s drops when it ends */
  cooldown: 0.45,
  buffer: 0.2,
  chainWindow: 0.8,
  chainStep: 0.25,
  chainCap: 3,
  overflowSec: 2,
  overflowWarn: 0.4,
  overflowExempt: 1,
  overflowSpeed: 0.3,
  warnEvery: 0.5,
  /** a basket change: the new basket stands at `fresh` s, drops open at `change` s */
  change: 0.8,
  fresh: 0.5,
  // the block plan
  zbior: 24,
  rosa: 26,
  jitter: 3,
  pairSec: 50,
  telegraph: 4,
  minBlock: 12,
  finale: 6,
  // the vine (Zbiór)
  leadZbior: 5,
  leadZbiorEeg: 2,
  vineFrom: 0.35,
  vineSpan: 0.5,
  vineTau: 6,
  shootSec: 6,
  shootK: 0.1,
  shootMax: 3,
  shootDecay: 3,
  /** A = 0.20 + 1.00 V + K (+0.15): up to the 1.65 r the design caps the vine at (tuned up from 0.70 V with the bot harness) */
  allowBase: 0.2,
  allowV: 1,
  leafBonus: 0.15,
  vineEvery: 0.2,
  vineMax: 12,
  vineRange: 1.6,
  clear: 0.85,
  gatherMax: 10,
  gatherGap: 0.12,
  pull: 0.45,
  gatherBeat: 0.4,
  /** a fruit faster than this is still falling: the vine leaves it (W/s) */
  gatherSpeed: 0.3,
  /** reach is measured in the pair's radius, but never less than this (W): small fruit get a usable reach too */
  reachR: 0.1,
  // the dew (Rosa)
  leadRosa: 4,
  leadRosaEeg: 2,
  dewGain: 0.065,
  dewLeak: 0.01,
  /** B = 0.15 + 1.00 D (+0.10): tuned up from 0.60 D with the bot harness, rolling fruit leave few near pairs */
  bridgeBase: 0.15,
  bridgeD: 1,
  dropBonus: 0.1,
  settle: 1.2,
  settleMu: 0.85,
  settleG: 0.5,
  /** the sigh's shiver (W at D = 1): rolling fruit are already compact, so the dew shakes them a little to find their neighbours */
  jiggle: 0.02,
  jiggleEvery: 0.1,
  bridgeMax: 8,
  bridgeGap: 0.1,
  bridgeSlide: 0.3,
  settleBeat: 0.25,
  beads: 36,
  glistenDry: 0.03,
  /** the cloth: drawn over 0.8 s once the gather is done, lifted over 1 s */
  veilIn: 0.8,
  veilOut: 1,
  // the signal
  neutralSec: 8,
  neutral: 0.4,
  fogGap: 2,
  recover: 6,
  // the evening (seconds into the finisher)
  carryAt: 1.4,
  resolveAt: 2,
  enoughAt: 4.6,
  // feats
  deepDew: 0.8,
  legendContrast: 4,
  maxDraws: 3,
  ghostIdle: 3,
  ghostSessions: 2,
} as const;

/** On "Kosz dnia" the n-th drop draws from mulberry32(daySeed + DROP_STEP · n)… */
export const DROP_STEP = 7919;
/** …and the day's block plan from its own stream. */
export const PLAN_SALT = 0x6b43a9b5;

export type BlockKind = 'warmup' | 'zbior' | 'rosa';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'evening' | 'done';

/** A fruit the vine or the dew is pulling to its partner (kinematic on its way; `t` < 0 until it starts). */
export interface Pull { a: Body; b: Body; t: number; dur: number; x0: number; y0: number; kind: 'vine' | 'dew' }

/** A fruit as the basket held it when the basket changed (the view carries these off). */
export interface Snap { tier: number; x: number; y: number; r: number; angle: number; spill: boolean }

export interface Change { kind: 'spill' | 'great'; t: number; snaps: Snap[]; pts: number; fresh: boolean }

/** The payout right after a block: the vine's gather (after Zbiór) or the dew's settle (after Rosa). */
export interface Payout {
  kind: 'gather' | 'settle';
  /** seconds since the block ended, from −beat */
  t: number;
  step: 'beat' | 'sigh' | 'pulls' | 'done';
  blind: boolean;
  /** the gather's allowance A, the bridges' range B (in r) */
  range: number;
  dew: number;
  /** pairs found and pulls still to start */
  pairs: [Body, Body][];
  next: number;
  merged: number;
  /** the first gather of the player's life */
  first: boolean;
  /** the rim was warning when the Rosa ended */
  warned: boolean;
  jiggle: number;
}

export type GuestVia = 'story' | 'draw' | 'craft';

export type SimEvent =
  | { type: 'drop'; tier: number; x: number }
  | { type: 'hang'; tier: number }
  | { type: 'land'; tier: number; speed: number; x: number; y: number }
  | { type: 'merge'; tier: number; x: number; y: number; pts: number; link: number; mult: number; first: boolean; via: 'touch' | 'vine' | 'dew' }
  | { type: 'great'; x: number; y: number; pts: number }
  | { type: 'warnTick'; k: number }
  | { type: 'spill'; pts: number; spilled: number }
  | { type: 'greatBasket'; pts: number }
  | { type: 'newBasket' }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'telegraph'; next: BlockKind | 'evening' }
  | { type: 'stamp'; kind: 'leaf' | 'drop' | 'almost'; block: 'zbior' | 'rosa'; have: number; need: number }
  | { type: 'gather'; pairs: number; blind: boolean }
  | { type: 'gathered'; merged: number; first: boolean }
  | { type: 'pull'; kind: 'vine' | 'dew'; tier: number }
  | { type: 'revealZbior'; pairs: number }
  | { type: 'revealRosa'; pct: number }
  | { type: 'settle'; dew: number; blind: boolean }
  | { type: 'settled'; merged: number }
  | { type: 'saved' }
  | { type: 'veil'; on: boolean }
  | { type: 'shoot'; n: number; blind: boolean }
  | { type: 'bead'; n: number }
  | { type: 'tableStep'; step: number }
  | { type: 'lesson' }
  | { type: 'evening' }
  | { type: 'carry' }
  | { type: 'loaf' }
  | { type: 'guest'; id: GuestId; isNew: boolean; via: GuestVia; tier: Tier | null; grain: number }
  | { type: 'enough' };

const NO_EVENTS: readonly SimEvent[] = [];

// ── pure rules ───────────────────────────────────────────────────
/** Points for making tier k by a merge: k(k − 1). */
export const mergePoints = (k: number): number => k * (k - 1);

/** The chain's multiplier for a link (0: the first merge): 1 + 0.25 a link, at most ×3. */
export const chainMult = (link: number): number => Math.min(RULES.chainCap, 1 + RULES.chainStep * Math.max(0, link));

/** The vine's target from the level: 0 up to 0.35, 1 from 0.85. */
export const vineTarget = (level: number): number => clamp((level - RULES.vineFrom) / RULES.vineSpan);

/** The shoots' bonus for `hold` seconds of steady focus: +0.10 per full 6 s, at most +0.30. */
export const shootBonus = (hold: number): number => RULES.shootK * Math.min(RULES.shootMax, Math.floor(Math.max(0, hold) / RULES.shootSec));

/** The vine's allowance A (in a pair's radius): 0.20 + 1.00 V + K, +0.15 after "Liść". */
export const allowance = (V: number, K: number, leaf = false): number => RULES.allowBase + RULES.allowV * clamp(V) + K + (leaf ? RULES.leafBonus : 0);

/** The dew bridges' range B (in r): 0.15 + 1.00 D, +0.10 after "Kropla". */
export const bridgeRange = (D: number, drop = false): number => RULES.bridgeBase + RULES.bridgeD * clamp(D) + (drop ? RULES.dropBonus : 0);

/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
export function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks: the first-ever session opens with "Pierwszy kosz" (8 s in a session up to
 * a minute, 20 s up to 200 s, else 30 s), then Zbiór/Rosa pairs (24 ± 3 s and 26 ± 3 s, scaled to
 * fill the session) ending with a Rosa, which flows into the 6 s evening.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const plan: Block[] = [];
  let left = Math.max(0, plannedSec - RULES.finale);
  if (firstEver) {
    const warm = plannedSec <= 60 ? 8 : plannedSec <= 200 ? 20 : 30;
    plan.push({ kind: 'warmup', dur: warm, blind: false });
    left = Math.max(0, left - warm);
  }
  let pairs = Math.max(1, Math.round(left / RULES.pairSec));
  if (left / (pairs * RULES.pairSec) > 1.12) pairs++;
  const jitter = left / (pairs * RULES.pairSec) >= 0.75 ? 1 : 0;   // short sessions: no jitter, or a block falls under 12 s
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) durs.push(RULES.zbior + jitter * (2 * rnd() - 1) * RULES.jitter, RULES.rosa + jitter * (2 * rnd() - 1) * RULES.jitter);
  const sum = durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= sum > 0 ? left / sum : 0;
  liftShort(durs, RULES.minBlock);
  durs.forEach((dur, i) => plan.push({ kind: i % 2 ? 'rosa' : 'zbior', dur, blind: false }));
  return plan;
}

const speedOf = (b: Body): number => Math.hypot(b.vx, b.vy);

/** Greedy pairing, smallest gap first, each fruit once; the upper fruit (the left one on a tie) is the one that moves. */
function pickPairs(found: readonly Pair[], max: number): [Body, Body][] {
  const used = new Set<number>();
  const out: [Body, Body][] = [];
  for (const p of found) {
    if (out.length >= max) break;
    if (used.has(p.a.id) || used.has(p.b.id)) continue;
    used.add(p.a.id);
    used.add(p.b.id);
    const aUp = Math.abs(p.a.y - p.b.y) < 1e-6 ? p.a.x < p.b.x : p.a.y > p.b.y;
    out.push(aUp ? [p.a, p.b] : [p.b, p.a]);
  }
  return out;
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: UrodzajProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning (the kit's defaults, the game's entry, a beginner's bias): the blocks' judges follow it */
  tuning: FocusTuning;
}

export class UrodzajSim {
  readonly p: UrodzajProgress;
  readonly plannedSec: number;
  readonly world = new World();
  readonly contrast = new BlockContrast(4);
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  private readonly events: SimEvent[] = [];

  started = false;
  /** this session's number in the game (1 = the first ever) */
  session = 0;
  /** the day's first session: "Kosz dnia" */
  daily = false;
  plan: Block[] = [];
  blockIndex = 0;
  /** seconds into the block (wall clock: the block runs on while the signal is unreliable) */
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  /** seconds into the evening */
  phaseT = 0;
  clock = 0;
  tip = '';

  // the aim and the drops
  aim = 0;
  private aimTo = 0;
  private aimSnap = 0;
  private keyDir = 0;
  private keyT = 0;
  cooldown = 0;
  private armed = false;
  private buffered = false;
  /** drops made this session, into this basket, and the breather's small drops still to come */
  dropN = 0;
  basketDrops = 0;
  breather = 0;
  private dropSeed = 0;
  private readonly us: number[] = [];
  /** the newest drop: exempt from the overflow until 1 s after it first touched */
  lastDrop: Body | null = null;
  /** seconds without input (the ghost hand) */
  idle = 0;

  // the basket
  basketPts = 0;
  baskets = 1;
  /** the overflow timer (s) */
  overT = 0;
  private warnClock = 0;
  change: Change | null = null;

  // the score
  score = 0;
  private lastMergeT = -Infinity;
  link = 0;
  maxChain = 0;
  private bestBasketNow = 0;
  greats = 0;
  spilled = false;

  // the band
  reliable = false;
  /** the drifting mist while the signal is unreliable (0..1) */
  mist = 0;
  V = 0;
  K = 0;
  private kDecay = 0;
  shoots = 0;
  D = 0;
  beads = 0;
  hold = 0;
  calm = 0;
  private rawHold = 0;
  private holdCarry = 0;
  private fogT = 0;
  private recover = 0;
  private blockReliable = 0;
  /** the vine's live pairs (a sighted Zbiór after its lead-in), refreshed every 0.2 s */
  readonly vine: Pair[] = [];
  private vineClock = 0;
  /** the fruit's dew glisten after a settle (cosmetic), and the cloth over the basket (0..1) */
  glisten = 0;
  veil = 0;
  payout: Payout | null = null;
  readonly pulls: Pull[] = [];
  private readonly found: Pair[] = [];

  // the session's tallies
  leaves = 0;
  zbiorJudged = 0;
  drops = 0;
  rosaJudged = 0;
  rosaEnded = 0;
  deepest = 0;
  private rosaDeep = false;
  private blindRosaPassed = false;
  /** the highest tier made by a merge this session, and the tiers seen in it (dropped or made), as bits */
  highestMade = 0;
  seen = 0;
  /** tiers made for the first time in the player's life this session */
  readonly firstTiers: number[] = [];
  private lessonDone = false;
  private resolved = false;
  private carried = false;
  private enough = false;
  loafNow = false;
  ruthNow = false;
  naomiNow = false;
  readonly guestsNow: { id: GuestId; isNew: boolean; via: GuestVia }[] = [];
  readonly builtNow: number[] = [];
  private gotNew = false;
  private pity = false;
  private readonly bestBefore: number | null;
  private readonly before: { basket: number; chain: number; tier: number };
  /** Zbiór and Rosa blocks begun before this session and in it (they reach the progress only in result()) */
  private zbioryBase = 0;
  private zbioryBegun = 0;
  private rosyBase = 0;
  private rosyBegun = 0;

  constructor(private readonly init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.judge = RoundJudge.from(init.tuning);
    this.bestBefore = this.p.sessions > 0 ? this.p.bestSession : null;
    this.before = { basket: this.p.bestBasket, chain: this.p.bestChain, tier: this.p.bestTier };
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get lead(): number {
    const k = this.block?.kind;
    return k === 'zbior' ? (this.init.eeg ? RULES.leadZbiorEeg : RULES.leadZbior) : k === 'rosa' ? (this.init.eeg ? RULES.leadRosaEeg : RULES.leadRosa) : 0;
  }
  /** A sighted Zbiór past its lead-in: the vine shows. */
  get vineLive(): boolean {
    const b = this.block;
    return this.phase === 'play' && b?.kind === 'zbior' && !b.blind && this.blockT >= this.lead;
  }
  /** The vine's allowance now (the gather adds "Liść" only after the verdict). */
  get allowance(): number { return allowance(this.V, this.K); }
  /** Drops are open: the warm-up or a Zbiór, no payout and no basket change running. */
  get open(): boolean {
    const k = this.block?.kind;
    return this.started && this.phase === 'play' && (k === 'warmup' || k === 'zbior') && !this.payout && !this.change;
  }
  /** Where the hanging fruit is (and would drop): the aim and its sway. */
  get hangX(): number {
    const m = this.aimRange();
    return clamp(this.aim + RULES.sway * Math.sin(2 * Math.PI * RULES.swayHz * this.clock), -m, m);
  }
  /** The fruit waiting at the hang line (null while the cooldown runs or drops are shut). */
  get hanging(): number | null { return this.open && this.cooldown <= 0 ? this.tierOf(0) : null; }
  /** The fruit after the one hanging (or about to hang): "Następny". */
  get upcoming(): number { return this.tierOf(1); }
  /** The rim's warning (0..1 from 0.4 s to 2 s over the rim). */
  get warning(): number { return this.overT < RULES.overflowWarn ? 0 : clamp((this.overT - RULES.overflowWarn) / (RULES.overflowSec - RULES.overflowWarn)); }
  /** "Przesuń i puść": the first two sessions, drops open and no input for 3 s. */
  get ghost(): boolean { return this.session <= RULES.ghostSessions && this.open && this.idle >= RULES.ghostIdle; }
  /** A verse may show only once the session is over (the summary's card); never during play. */
  get verseMayShow(): boolean { return this.phase === 'done'; }

  start(): void {
    if (this.started) return;
    this.started = true;
    const p = this.p, day = this.init.day;
    // the session (and its blocks, and the day's "Kosz dnia") reach the progress in result(), which
    // only a saved session calls: an abandoned first attempt leaves the next one the first
    this.session = p.sessions + 1;
    this.zbioryBase = p.zbiory;
    this.rosyBase = p.rosy;
    this.daily = p.dailyDay !== day;
    this.pity = this.session - p.lastNewSession >= 2 && nextMissing(p, false) !== null;
    this.dropSeed = Math.floor(this.rng() * 4294967296) >>> 0;
    this.plan = planBlocks(this.plannedSec, this.session === 1, this.daily ? mulberry32((this.init.daySeed ^ PLAN_SALT) >>> 0) : this.rng);
    this.breather = this.session === 1 ? BREATHER : 0;
    this.freshBasket();
    this.startBlock(0);
  }

  // ── input ──────────────────────────────────────────────────────
  /** A finger or the mouse went down at world x: the aim eases there over 60 ms. */
  pointerDown(x: number): void {
    this.aimTo = x;
    this.aimSnap = RULES.aimSnap;
    this.idle = 0;
  }

  /** Moved (a drag, or a hovering mouse): the aim follows. */
  pointerMove(x: number): void {
    this.aimTo = x;
    if (this.aimSnap <= 0) this.aim = x;
    this.idle = 0;
  }

  /** Let go: the drop is armed and applied on the next update (a pause disarms it). */
  pointerUp(x: number): void {
    this.aimTo = x;
    this.armed = true;
    this.idle = 0;
  }

  /** ← / → held (−1, +1) or released (0); a tap moves 0.02 W at once. */
  keyAim(dir: number): void {
    if (dir !== 0 && dir !== this.keyDir) this.aimTo += dir * RULES.keyTap;
    this.keyDir = dir;
    this.keyT = 0;
    this.idle = 0;
  }

  /** Space, Enter or ↓. */
  keyDrop(): void {
    this.armed = true;
    this.idle = 0;
  }

  /** The runner paused (its synthetic "up" for a held pointer must not drop a fruit). */
  disarm(): void {
    this.armed = false;
    this.buffered = false;
    this.keyDir = 0;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    this.clock += dt;
    this.idle += dt;
    this.steer(dt);
    this.brain(dt, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'evening') this.evening(dt);
    this.dropping(dt);
    this.paying(dt);
    this.changing(dt);
    this.world.advance(dt);
    this.drain();
    this.overflow(dt);
    this.vineTick(dt);
    this.veiling(dt);
    if (this.block?.kind === 'zbior') this.glisten = Math.max(0, this.glisten - RULES.glistenDry * dt);
  }

  private aimRange(): number {
    return BASKET.rimHalf - fruit(this.tierOf(0)).r - RULES.aimPad;
  }

  private steer(dt: number): void {
    if (this.keyDir !== 0) {
      this.keyT += dt;
      const v = RULES.keySpeed + (RULES.keySpeedMax - RULES.keySpeed) * clamp(this.keyT / RULES.keyRamp);
      this.aimTo += this.keyDir * v * dt;
      this.aimSnap = 0;
    }
    const m = this.aimRange();
    this.aimTo = clamp(this.aimTo, -m, m);
    if (this.aimSnap > 0) {
      this.aim += (this.aimTo - this.aim) * Math.min(1, dt / this.aimSnap);
      this.aimSnap = Math.max(0, this.aimSnap - dt);
      if (this.aimSnap <= 0) this.aim = this.aimTo;
    } else this.aim = this.aimTo;
    this.aim = clamp(this.aim, -m, m);
  }

  /**
   * The band's slow quantities.  In a Zbiór after its lead-in the vine follows the level (τ 6 s) and
   * shoots grow from the hold; in a Rosa after its lead-in the dew gathers from calm.  Unreliable:
   * everything holds.  After a dropout of 2 s or more the kit's level and calm climb back from 0, so
   * for 6 s nothing may fall (V does not drop, the dew does not leak).
   */
  private brain(dt: number, f: FocusFrame): void {
    this.reliable = f.reliable;
    this.mist = approach(this.mist, f.reliable ? 0 : 1, dt, 0.7);
    if (!f.reliable) {
      this.fogT += dt;
      this.calm = 0;
      return;
    }
    if (this.fogT > 0) {
      if (this.fogT >= RULES.fogGap) this.recover = RULES.recover;
      if (f.hold < this.rawHold) this.holdCarry += this.rawHold;   // the kit restarted a hold the gap broke: the stretch carries on
      this.fogT = 0;
    } else this.recover = Math.max(0, this.recover - dt);
    if (!f.focused && this.recover <= 0) this.holdCarry = 0;
    this.rawHold = f.hold;
    this.calm = f.calm;
    if (this.phase !== 'play') return;
    const b = this.block, lead = this.lead;
    if (b.kind === 'zbior') {
      if (this.blockT < lead) {
        this.hold = 0;
        return;
      }
      const v = approach(this.V, vineTarget(f.level), dt, RULES.vineTau);
      this.V = this.recover > 0 ? Math.max(this.V, v) : v;
      this.hold = Math.min(this.holdCarry + f.hold, this.blockT - lead);
      const target = shootBonus(this.hold);
      if (target > this.K + 1e-9) {
        this.K = target;
        this.kDecay = 0;
        this.shoots = Math.round(target / RULES.shootK);
        this.emit({ type: 'shoot', n: this.shoots, blind: b.blind });
      } else if (target < this.K - 1e-9) {
        // the hold broke: the shoots ease off over 3 s instead of vanishing
        if (this.kDecay === 0) this.kDecay = this.K / RULES.shootDecay;
        this.K = Math.max(target, this.K - this.kDecay * dt);
      } else this.kDecay = 0;
    } else if (b.kind === 'rosa') {
      if (this.blockT < lead) return;
      const leak = this.recover > 0 ? 0 : RULES.dewLeak;
      this.D = clamp(this.D + (RULES.dewGain * f.calm - leak) * dt);
      const n = Math.round(RULES.beads * this.D);
      if (n > this.beads && !b.blind) this.emit({ type: 'bead', n });
      this.beads = n;
    }
  }

  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block;
    this.blockT += dt;
    if (f.reliable) this.blockReliable += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'zbior' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'warmup') this.tip = TIPS.warmup[Math.floor(this.blockT / 9) % TIPS.warmup.length];
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - RULES.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? 'evening' : this.plan[this.blockIndex + 1].kind });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - RULES.finale) {
      this.endBlock();
      this.startEvening();
    } else if (!last && this.blockT >= b.dur) {
      this.endBlock();
      this.startBlock(this.blockIndex + 1);
    }
  }

  private startBlock(i: number): void {
    this.blockIndex = i;
    this.blockT = 0;
    this.telegraphed = false;
    this.blockReliable = 0;
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'zbior') {
      this.zbioryBegun++;
      b.blind = this.session >= 3 && (this.zbioryBase + this.zbioryBegun) % 4 === 0;
      this.V = 0;
      this.K = 0;
      this.kDecay = 0;
      this.shoots = 0;
      this.hold = 0;
      this.holdCarry = 0;
      this.vine.length = 0;
      this.vineClock = 0;
    } else if (b.kind === 'rosa') {
      this.rosyBegun++;
      b.blind = this.session >= 3 && (this.rosyBase + this.rosyBegun) % 4 === 2;
      this.D = 0;
      this.beads = 0;
      this.vine.length = 0;
    }
    const list = b.kind === 'warmup' ? TIPS.warmup : b.kind === 'zbior' ? (b.blind ? TIPS.zbiorBlind : TIPS.zbior) : b.blind ? TIPS.rosaBlind : TIPS.rosa;
    // the lines rotate from session to session; the first sessions' first blocks explain themselves
    this.tip = first && this.session <= 2 && b.kind === 'zbior' && !b.blind ? TIPS.firstZbior
      : first && this.session <= 2 && b.kind === 'rosa' && !b.blind ? TIPS.firstRosa
        : list[(this.session - 1 + i) % list.length];
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  /** The block's verdict (none on the neutral floor), its stamp, and the payout that follows right after it. */
  private endBlock(): void {
    const b = this.block;
    if (b.kind === 'warmup') return;
    const neutral = this.blockReliable < RULES.neutralSec;
    const verdict = neutral ? null : this.judge.verdict();
    const measured = this.judge.measured;
    const want = b.kind === 'zbior' ? 'focus' : 'rest';
    const have = Math.round(this.judge.share * measured * 10) / 10;
    const need = Math.round(this.judge.need(want) * measured * 10) / 10;
    this.judge.reset();
    if (b.kind === 'zbior') {
      if (neutral) this.V = Math.max(this.V, RULES.neutral);
      if (verdict !== null) {
        this.zbiorJudged++;
        if (verdict) this.leaves++;
        this.emit({ type: 'stamp', kind: verdict ? 'leaf' : 'almost', block: 'zbior', have, need });
      }
      this.finishPayout();
      this.payout = {
        kind: 'gather', t: -RULES.gatherBeat, step: 'beat', blind: b.blind, range: allowance(this.V, this.K, verdict === true), dew: 0,
        pairs: [], next: 0, merged: 0, first: this.zbioryBase + this.zbioryBegun === 1, warned: false, jiggle: 0,
      };
      this.vine.length = 0;
    } else {
      if (neutral) this.D = Math.max(this.D, RULES.neutral);
      this.rosaEnded++;
      if (verdict !== null) {
        this.rosaJudged++;
        if (verdict) this.drops++;
        if (verdict && b.blind) this.blindRosaPassed = true;
        this.emit({ type: 'stamp', kind: verdict ? 'drop' : 'almost', block: 'rosa', have, need });
      }
      if (!neutral && this.D >= RULES.deepDew) this.rosaDeep = true;
      this.deepest = Math.max(this.deepest, this.D);
      this.finishPayout();
      this.payout = {
        kind: 'settle', t: -RULES.settleBeat, step: 'beat', blind: b.blind, range: bridgeRange(this.D, verdict === true), dew: this.D,
        pairs: [], next: 0, merged: 0, first: false, warned: this.overT >= RULES.overflowWarn, jiggle: 0,
      };
    }
  }

  // ── the payouts ─────────────────────────────────────────────────
  private paying(dt: number): void {
    this.pulling(dt);
    const po = this.payout;
    if (!po) return;
    po.t += dt;
    if (po.step === 'beat' && po.t >= 0) {
      if (po.kind === 'gather') {
        po.pairs = this.gatherPairs(po.range);
        if (po.blind) this.emit({ type: 'revealZbior', pairs: po.pairs.length });
        this.emit({ type: 'gather', pairs: po.pairs.length, blind: po.blind });
        po.step = 'pulls';
        po.t = 0;
      } else {
        if (po.blind) this.emit({ type: 'revealRosa', pct: Math.round(po.dew * 100) });
        this.glisten = Math.max(this.glisten, po.dew);
        this.world.settle(1 - RULES.settleMu * po.dew, 1 + RULES.settleG * po.dew, 0);
        this.emit({ type: 'settle', dew: po.dew, blind: po.blind });
        po.step = 'sigh';
        po.t = 0;
      }
    }
    if (po.step === 'sigh') {
      po.jiggle -= dt;
      if (po.jiggle <= 0 && po.dew > 0) {
        po.jiggle += RULES.jiggleEvery;
        const amp = RULES.jiggle * po.dew;
        for (const b of this.world.bodies) if (!b.kinematic && speedOf(b) < 0.05) this.world.nudge(b, (this.rng() * 2 - 1) * amp);
      }
      if (po.t >= RULES.settle) {
        this.world.settle(1, 1, PHYS.restitution);
        po.pairs = this.bridgePairs(po.range);
        po.step = 'pulls';
        po.t = 0;
      }
    }
    if (po.step === 'pulls') {
      const gap = po.kind === 'gather' ? RULES.gatherGap : RULES.bridgeGap;
      while (po.next < po.pairs.length && po.t >= po.next * gap) {
        const [a, b] = po.pairs[po.next++];
        this.startPull(a, b, po.kind === 'gather' ? 'vine' : 'dew');
      }
      if (po.next >= po.pairs.length && !this.pulls.length) this.endPayout(po);
    }
  }

  private gatherPairs(range: number): [Body, Body][] {
    this.world.pairs(this.found, { maxGap: range, limit: 64, clear: RULES.clear, maxSpeed: RULES.gatherSpeed, minR: RULES.reachR });
    return pickPairs(this.found, RULES.gatherMax);
  }

  private bridgePairs(range: number): [Body, Body][] {
    this.world.pairs(this.found, { maxGap: range, limit: 64, maxSpeed: RULES.gatherSpeed, minR: RULES.reachR });
    return pickPairs(this.found, RULES.bridgeMax);
  }

  private endPayout(po: Payout): void {
    po.step = 'done';
    this.payout = null;
    if (po.kind === 'gather') this.emit({ type: 'gathered', merged: po.merged, first: po.first });
    else {
      this.emit({ type: 'settled', merged: po.merged });
      // the settle took the heap back under the rim: the overflow timer starts over
      if (!this.overRim()) {
        if (po.warned) this.emit({ type: 'saved' });
        this.overT = 0;
      }
    }
  }

  /** A payout still running when the next block's ends early (a very short block): it finishes at once. */
  private finishPayout(): void {
    if (!this.payout && !this.pulls.length) return;
    const po = this.payout;
    if (po) {
      if (po.step === 'beat') po.pairs = po.kind === 'gather' ? this.gatherPairs(po.range) : this.bridgePairs(po.range);
      else if (po.step === 'sigh') {
        this.world.settle(1, 1, PHYS.restitution);
        po.pairs = this.bridgePairs(po.range);
      }
      for (; po.next < po.pairs.length; po.next++) {
        const [a, b] = po.pairs[po.next];
        if (this.world.has(a) && this.world.has(b)) {
          this.world.joinAt(a, b);
          po.merged++;
        }
      }
    }
    for (const pl of this.pulls) {
      if (this.world.has(pl.a) && this.world.has(pl.b)) this.world.joinAt(pl.a, pl.b);
      else if (this.world.has(pl.a)) pl.a.kinematic = false;
    }
    this.pulls.length = 0;
    this.world.settle(1, 1, PHYS.restitution);
    this.drain();
    if (po) {
      po.step = 'done';
      this.payout = null;
    }
  }

  private startPull(a: Body, b: Body, kind: 'vine' | 'dew'): void {
    if (!this.world.has(a) || !this.world.has(b)) return;
    a.kinematic = true;
    a.vx = a.vy = 0;
    this.world.wake();   // what rested on it must feel the gap
    this.pulls.push({ a, b, t: 0, dur: kind === 'vine' ? RULES.pull : RULES.bridgeSlide, x0: a.x, y0: a.y, kind });
    this.emit({ type: 'pull', kind, tier: a.tier });
  }

  /** The pulled fruit travel along their tendril (eased in and out, lifted over the heap) and join their partner where it is. */
  private pulling(dt: number): void {
    let n = 0;
    for (const pl of this.pulls) {
      pl.t += dt;
      const { a, b } = pl;
      if (!this.world.has(a)) continue;
      if (!this.world.has(b)) {
        a.kinematic = false;   // its partner went in another chain: let it go where it is
        continue;
      }
      const k = clamp(pl.t / pl.dur);
      const e = k * k * (3 - 2 * k);
      const lift = Math.sin(Math.PI * k) * (pl.kind === 'vine' ? 0.05 : 0.02);
      a.x = pl.x0 + (b.x - pl.x0) * e;
      a.y = pl.y0 + (b.y - pl.y0) * e + lift;
      if (k >= 1) {
        this.world.joinAt(a, b);
        const po = this.payout;
        if (po) po.merged++;
        continue;
      }
      this.pulls[n++] = pl;
    }
    this.pulls.length = n;
  }

  // ── drops ──────────────────────────────────────────────────────
  /** The tier of the drop `offset` places ahead: each basket's first is an olive, a breather's are small. */
  tierOf(offset: number): number {
    if (this.basketDrops + offset === 0) return 1;
    return tierFromU(this.dropU(this.dropN + offset), this.breather - offset > 0);
  }

  /** The n-th drop's uniform: on "Kosz dnia" from the date, else from the session's own stream (the same n, the same number). */
  dropU(n: number): number {
    while (this.us.length <= n) {
      const k = this.us.length;
      const seed = this.daily ? this.init.daySeed : this.dropSeed;
      this.us.push(mulberry32((seed + DROP_STEP * k) >>> 0)());
    }
    return this.us[n];
  }

  private dropping(dt: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.cooldown = 0;
        if (this.open) this.emit({ type: 'hang', tier: this.tierOf(0) });
        if (this.buffered) {
          this.buffered = false;
          if (this.open) this.drop();
        }
      }
    }
    if (!this.armed) return;
    this.armed = false;
    if (!this.open) return;
    if (this.cooldown <= 0) this.drop();
    else if (this.cooldown <= RULES.buffer) this.buffered = true;
  }

  private drop(): void {
    if (this.world.count >= PHYS.maxBodies) {
      this.spill();   // a basket this full tips at once (nothing is lost)
      return;
    }
    const tier = this.tierOf(0);
    const x = this.hangX;
    this.lastDrop = this.world.add(tier, x, BASKET.hang);
    this.dropN++;
    this.basketDrops++;
    if (this.breather > 0) this.breather--;
    this.cooldown = RULES.cooldown;
    this.idle = 0;
    this.seen |= 1 << tier;
    this.emit({ type: 'drop', tier, x });
  }

  // ── what the world did ──────────────────────────────────────────
  private drain(): void {
    const w = this.world;
    for (const l of w.landings) {
      if (l.body.dead) continue;
      this.emit({ type: 'land', tier: l.body.tier, speed: l.speed, x: l.body.x, y: l.body.y });
    }
    w.landings.length = 0;
    if (!w.merges.length) return;
    const list = w.merges.splice(0, w.merges.length);
    for (const m of list) this.merged(m);
  }

  private merged(m: Merge): void {
    const k = m.tier;
    this.link = m.t - this.lastMergeT <= RULES.chainWindow ? this.link + 1 : 0;
    this.lastMergeT = m.t;
    const mult = chainMult(this.link);
    const pts = Math.round(mergePoints(k) * mult);
    this.maxChain = Math.max(this.maxChain, this.link + 1);
    this.addPoints(pts);
    const first = k > this.p.bestTier;
    if (first) {
      this.p.bestTier = k;
      this.firstTiers.push(k);
    }
    this.highestMade = Math.max(this.highestMade, k);
    this.seen |= 1 << k;
    const via = !m.pulled ? 'touch' : this.payout?.kind === 'settle' ? 'dew' : 'vine';
    this.emit({ type: 'merge', tier: k, x: m.x, y: m.y, pts, link: this.link, mult, first, via });
    if (this.session === 1 && !this.lessonDone) {
      this.lessonDone = true;
      this.emit({ type: 'lesson' });
    }
    if (k >= MAX_TIER) this.great(m);
  }

  private addPoints(n: number): void {
    if (n <= 0) return;
    const before = tableState(tablePoints(this.p)).built;
    this.score += n;
    this.basketPts += n;
    this.p.harvest += n;
    this.stepsSince(before);
  }

  private stepsSince(before: number): void {
    const after = tableState(tablePoints(this.p)).built;
    for (let s = before; s < after; s++) {
      this.builtNow.push(s);
      this.emit({ type: 'tableStep', step: s });
    }
  }

  /** The great cluster: +150, the basket is complete and carried to the table; a new one comes with a breather. */
  private great(m: Merge): void {
    this.addPoints(GREAT_BONUS);
    this.greats++;
    this.p.greatClusters++;
    this.emit({ type: 'great', x: m.x, y: m.y, pts: GREAT_BONUS });
    this.emit({ type: 'greatBasket', pts: this.basketPts });
    this.startChange('great');
  }

  // ── the rim and the basket ──────────────────────────────────────
  /** A slow fruit over the rim (the newest drop until 1 s after it first touched does not count). */
  private overRim(): boolean {
    const w = this.world, last = this.lastDrop;
    for (const b of w.bodies) {
      if (b.kinematic || b.y + b.r <= BASKET.rim || speedOf(b) >= RULES.overflowSpeed) continue;
      if (b === last && (b.touched < 0 || w.t - b.touched < RULES.overflowExempt)) continue;
      return true;
    }
    return false;
  }

  /** The overflow timer runs only while drops are open; it is held through payouts and Rosa. */
  private overflow(dt: number): void {
    if (!this.open) return;
    if (this.overRim()) this.overT += dt;
    else this.overT = 0;
    if (this.overT >= RULES.overflowWarn) {
      this.warnClock -= dt;
      if (this.warnClock <= 0) {
        this.warnClock = RULES.warnEvery;
        this.emit({ type: 'warnTick', k: this.warning });
      }
    } else this.warnClock = 0;
    if (this.overT >= RULES.overflowSec) this.spill();
  }

  /** "Na skraj pola": what is over the rim rolls to the gleaners, the rest goes to the table, every point stays. */
  private spill(): void {
    this.spilled = true;
    let n = 0;
    for (const b of this.world.bodies) if (b.y + b.r > BASKET.rim) n++;
    this.emit({ type: 'spill', pts: this.basketPts, spilled: n });
    this.startChange('spill');
  }

  private startChange(kind: Change['kind']): void {
    const snaps: Snap[] = [];
    for (const b of this.world.bodies) {
      if (b.tier >= MAX_TIER && kind === 'great') continue;   // the cluster flies to the table on its own
      snaps.push({ tier: b.tier, x: b.x, y: b.y, r: b.r, angle: b.angle, spill: kind === 'spill' && b.y + b.r > BASKET.rim });
    }
    this.bestBasketNow = Math.max(this.bestBasketNow, this.basketPts);
    this.change = { kind, t: 0, snaps, pts: this.basketPts, fresh: false };
    this.world.clear();
    this.pulls.length = 0;
    const po = this.payout;
    if (po) po.next = po.pairs.length;   // its pairs went with the basket
    this.vine.length = 0;
    this.lastDrop = null;
    this.overT = 0;
    this.basketPts = 0;
    if (kind === 'great') this.breather = BREATHER;
  }

  private changing(dt: number): void {
    const c = this.change;
    if (!c) return;
    c.t += dt;
    if (!c.fresh && c.t >= RULES.fresh) {
      c.fresh = true;
      this.baskets++;
      this.freshBasket();
      this.emit({ type: 'newBasket' });
    }
    if (c.t >= RULES.change) this.change = null;
  }

  /** A new basket holds one olive at rest at the bottom centre; its first drop is an olive too. */
  private freshBasket(): void {
    const olive = this.world.add(1, 0, fruit(1).r);
    olive.touched = this.world.t;
    olive.restT = PHYS.restSec;
    olive.resting = true;
    this.basketDrops = 0;
    this.lastMergeT = -Infinity;
    this.link = 0;
  }

  // ── the vine's tendrils and the cloth ───────────────────────────
  private vineTick(dt: number): void {
    if (!this.vineLive || this.payout || this.change) {
      this.vine.length = 0;
      this.vineClock = 0;
      return;
    }
    this.vineClock -= dt;
    if (this.vineClock > 0) return;
    this.vineClock = RULES.vineEvery;
    this.world.pairs(this.vine, { maxGap: RULES.vineRange, limit: RULES.vineMax, clear: RULES.clear, resting: true, minR: RULES.reachR });
  }

  /**
   * The linen covers the basket in a Rosa as soon as the gather is done (rule 5: rest is not spent
   * planning) and lifts in its last 4 s, at the push telegraph — the next Zbiór starts informed.
   */
  private veiling(dt: number): void {
    const b = this.block;
    const want = this.phase === 'play' && b?.kind === 'rosa' && this.payout?.kind !== 'gather' && this.blockT < b.dur - RULES.telegraph ? 1 : 0;
    const was = this.veil;
    if (want > this.veil) this.veil = Math.min(1, this.veil + dt / RULES.veilIn);
    else if (want < this.veil) this.veil = Math.max(0, this.veil - dt / RULES.veilOut);
    if (was === 0 && this.veil > 0) this.emit({ type: 'veil', on: true });
    else if (was === 1 && this.veil < 1) this.emit({ type: 'veil', on: false });
  }

  // ── the evening ────────────────────────────────────────────────
  private startEvening(): void {
    this.phase = 'evening';
    this.phaseT = 0;
    this.emit({ type: 'evening' });
  }

  private evening(dt: number): void {
    this.phaseT += dt;
    if (!this.carried && this.phaseT >= RULES.carryAt) {
      this.carried = true;
      this.emit({ type: 'carry' });
    }
    if (!this.resolved && this.phaseT >= RULES.resolveAt) this.resolveEvening();
    if (!this.enough && this.phaseT >= RULES.enoughAt) {
      this.enough = true;
      this.emit({ type: 'enough' });
    }
    if (this.phaseT >= RULES.finale && !this.payout && !this.pulls.length && !this.change) this.phase = 'done';
  }

  /** The draw's tier is the session's best feat: legendary for the contrast, epic for a blind Rosa passed, rare for deep dew. */
  private eveningTier(): Tier {
    const c = this.contrast.contrast;
    if (c !== null && c >= RULES.legendContrast) return 'legend';
    if (this.blindRosaPassed) return 'epic';
    if (this.rosaDeep) return 'rare';
    return 'common';
  }

  /** The day's loaf, the story's guests and the draws (one every evening, one more per great cluster, three at most). */
  private resolveEvening(): void {
    if (this.resolved) return;
    this.resolved = true;
    const p = this.p;
    if (loafDue(p, this.init.day)) {
      const before = tableState(tablePoints(p)).built;
      p.loaves++;
      p.loafDay = this.init.day;
      this.loafNow = true;
      this.emit({ type: 'loaf' });
      this.stepsSince(before);
    }
    if (ruthDue(p, this.session, this.spilled)) {
      p.ruthAt = this.session;
      this.ruthNow = true;
      this.storyGuest('rut');
    } else if (naomiDue(p, this.session)) {
      p.naomiAt = this.session;
      this.naomiNow = true;
      this.storyGuest('noemi');
    }
    const tiers: Tier[] = [this.eveningTier()];
    for (let i = 0; i < this.greats && tiers.length < RULES.maxDraws; i++) tiers.push('rare');
    tiers.forEach((tier, i) => this.drew(drawGuest(p, tier, this.rng, i === 0 && this.pity && !this.gotNew), 'draw'));
  }

  private storyGuest(id: GuestId): void {
    this.p.guests.push(id);
    this.newGuest(id, 'story', null);
  }

  private drew(d: Draw, via: GuestVia): void {
    if (d.isNew) this.newGuest(d.id, via, d.tier);
    else {
      this.guestsNow.push({ id: d.id, isNew: false, via });
      this.emit({ type: 'guest', id: d.id, isNew: false, via, tier: d.tier, grain: DUPLICATE_GRAIN });
    }
    for (const id of d.crafted) this.newGuest(id, 'craft', guestById(id)?.tier ?? null);
  }

  private newGuest(id: GuestId, via: GuestVia, tier: Tier | null): void {
    this.gotNew = true;
    this.p.lastNewSession = this.session;
    this.guestsNow.push({ id, isNew: true, via });
    this.emit({ type: 'guest', id, isNew: true, via, tier, grain: 0 });
  }

  /**
   * The session ends before its own evening ("Zakończ i zapisz", the overtime limit): settle as the
   * evening would — the open block is judged and paid out without animation, the day's loaf, the
   * story's guests and the draws (with pity) are resolved.  Nothing more once the evening is done.
   */
  finish(): void {
    if (!this.started || this.phase === 'done') return;
    if (this.phase === 'play') this.endBlock();
    this.finishPayout();
    if (this.change) {
      if (!this.change.fresh) this.baskets++;
      this.change = null;
    }
    this.resolveEvening();
    this.phase = 'done';
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  /** The events since the last call, oldest first (most frames have none: then nothing is allocated). */
  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /**
   * What the ambient pad's brightness follows (kit/types.ts): steady in the warm-up, the vine in a
   * sighted Zbiór; held still in a blind Zbiór, in Rosa (the sound sets its own fixed dusk there), in
   * the evening and while the signal is unreliable, so no live feedback leaks where the screen has none.
   */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    const b = this.block;
    if (b.kind === 'warmup') return 0.5;
    if (b.kind === 'zbior' && !b.blind) return this.V;
    return null;
  }

  /** Time is up: the session may stop once the evening has played and nothing is moving to the table. */
  canStop(): boolean {
    return this.phase === 'done' && !this.payout && !this.pulls.length && !this.change;
  }

  /**
   * The session's numbers, idempotent.  Only a saved session calls it for good, so the session, its
   * blocks and the day's "Kosz dnia" are counted here; records go into the progress with Math.max.
   */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      p.sessions = Math.max(p.sessions, this.session);
      p.zbiory = Math.max(p.zbiory, this.zbioryBase + this.zbioryBegun);
      p.rosy = Math.max(p.rosy, this.rosyBase + this.rosyBegun);
      if (this.daily) {
        p.dailyDay = this.init.day;
        p.dailyScore = this.score;
        p.dailyBest = Math.max(p.dailyBest, this.score);
      }
      p.lastDay = this.init.day;
    }
    const basket = Math.max(this.bestBasketNow, this.basketPts);
    const dew = Math.round(this.deepest * 100);
    p.bestSession = Math.max(p.bestSession, this.score);
    p.bestBasket = Math.max(p.bestBasket, basket);
    p.bestTier = Math.max(p.bestTier, this.highestMade);
    p.bestChain = Math.max(p.bestChain, this.maxChain);
    p.bestDew = Math.max(p.bestDew, dew);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;   // no "−0.0%"
    const stats: [string, string][] = [
      [t('stat.bestBasket'), t('pts', { n: basket })],
      [t('stat.baskets'), String(this.baskets)],
      [t('stat.highest'), this.highestMade ? cap(fruit(this.highestMade).name) : '—'],
      [t('stat.chain'), this.maxChain ? `×${this.maxChain}` : '—'],
      [t('stat.leaves'), this.zbiorJudged ? `${this.leaves}/${this.zbiorJudged}` : '—'],
      [t('stat.drops'), this.rosaJudged ? `${this.drops}/${this.rosaJudged}` : '—'],
      [t('stat.dew'), this.rosaEnded ? t('pct', { n: dew }) : '—'],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: c === 0 ? fmtNum(0, 1) : fmtSigned(c, 1) })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(basket), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage (kit/scripture.ts), one the session fits, in turn from session to
   * session — the best fit first: Ruth's own evening closes on Ruth 2:16 (once in a life); then a new
   * fruit (the good land's fruit), a great cluster (the year crowned), a spill (the field's edge,
   * nothing wasted), the dew (passed, deep), a new guest (the open table), the day's loaf, and the
   * reaping with joy that fits every evening.  The lobby already opens with Deuteronomy 8:10.
   */
  closingVerse(): PassageId {
    if (this.ruthNow) return 'rut2.16';
    const fit: PassageId[] = [];
    if (this.firstTiers.length || this.session === 1) fit.push('deu8.8');
    if (this.greats > 0) fit.push('psa65.11');
    if (this.spilled) fit.push('lev19.9', 'jhn6.12');
    if (this.drops > 0) fit.push('deu32.2');
    if (this.rosaDeep) fit.push('psa133.3');
    if (this.guestsNow.some(g => g.isNew)) fit.push('luk14.13-14');
    if (this.loafNow) fit.push('mat6.11');
    fit.push('psa126.5');
    return inTurn(fit, this.session);
  }

  /** At most five lines for the summary, the best moments first: guests, the table, records, great clusters, a first fruit, the loaf. */
  private highlights(basket: number): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.ruthNow) add(0, t('hl.ruth'));
    if (this.naomiNow) add(0, t('hl.naomi'));
    const others = this.guestsNow.filter(g => g.isNew && g.via !== 'story').map(g => guestById(g.id)!);
    if (others.length === 1) add(0, t('hl.guest', { name: others[0].name, tier: others[0].tier ? TIER_NAME[others[0].tier] : '' }));
    else if (others.length > 1) add(0, t('hl.guests', { names: others.map(g => g.name).join(', ') }));
    if (this.builtNow.length) {
      add(1, this.builtNow.includes(TABLE_STEPS.length - 1) ? t('hl.tableDone') : t('hl.table', { names: this.builtNow.map(s => TABLE_STEPS[s].name).join(', ') }));
    }
    if (this.bestBefore !== null) {
      // records share one line when there are several
      const one: string[] = [], part: string[] = [];
      if (basket > this.before.basket) {
        const pts = t('pts', { n: basket });
        one.push(t('hl.record.basket', { pts }));
        part.push(t('hl.records.basket', { pts }));
      }
      if (this.maxChain > this.before.chain && this.maxChain > 1) {
        one.push(t('hl.record.chain', { n: this.maxChain }));
        part.push(t('hl.records.chain', { n: this.maxChain }));
      }
      if (part.length) add(2, part.length === 1 ? one[0] : t('hl.records', { list: part.join(', ') }));
    }
    if (this.greats) add(3, this.greats > 1 ? t('hl.greats', { n: this.greats }) : t('hl.great'));
    if (this.firstTiers.length) add(4, t('hl.record.tier', { name: fruit(Math.max(...this.firstTiers)).name }));
    if (this.loafNow) add(5, t('hl.loaf'));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);   // a stable sort: time order within a rank
  }
}
