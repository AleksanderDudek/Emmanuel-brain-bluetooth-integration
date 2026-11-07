/**
 * Pasterz's session without the DOM or the canvas (so every rule is unit-tested): Crowd City on
 * the Judean hills.  After a spring storm the village's sheep are scattered over the hills, and the
 * shepherd and five rival shepherd kids race to bring home the most.
 *
 *   the hands      drag anywhere: a floating joystick walks the shepherd (arrows and WASD too); left
 *                  alone, Łatek the sheepdog leads him to the nearest loose sheep; a tap or Space
 *                  whistles, and Łatek herds the loose sheep he reaches into the flock
 *   the flocks     a loose sheep touched by any sheep of a flock (or its shepherd) joins it and takes
 *                  its dye; where two flocks touch, the bigger wins the smaller one's sheep one by one
 *                  at the contact; a rival with no sheep left, touched by a bigger flock, is out till
 *                  the round ends (he sulks); the player is never out: Łatek pulls him away (grace)
 *   the rounds     a round spans two Wołanie days and the nights between (≈ 2 min) on one hill of the
 *                  map; a live ranking and a crown for the first; at dawn the tally banks the flock
 *                  (plus the crown's and the lost lamb's bonus) and the next round is a new hill
 *   the lost lamb  one lamb hidden far away each round; carried home it is worth RULES.lambBonus
 *
 * The band only adds:
 *   Wołanie (push)      after a lead-in the call ring's radius is r0 + level × rExtra; every loose sheep
 *                       inside it walks in and joins; a held focus sends the Głos: every loose sheep
 *                       within RULES.voiceR walks over, and the lost lamb bleats (a compass).
 *   Nocna straż (rest)  night: every flock beds down (a truce); calm lights stars one by one, and each
 *                       star is a straggler Łatek fetches from the dark into the flock; a passed night
 *                       brings morning lambs.
 *   Zmrok (blind)       every 4th Wołanie from the 3rd session: the ring stays at r0; at its end it
 *                       flares by the block's judged share and pulls in what it reaches.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  An unreliable signal
 * rests the ring at r0 and holds the stars: never a loss.
 *
 * The headline is the session's sheep: the rounds banked plus the flock now.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { LAMBS, LINES, PLAYER_DYE, RIVALS, RIVAL_LINES, TIPS, hillAt, type Habit, type HillDef, type Moment, type RivalSay, type SkinKind } from './content';
import { sheep as sheepText, t, unit } from './i18n';
import { addHome, bestFor, homeFor, lenKey, migrate, nameLamb, nextUnlock, openWardrobe, type PasterzProgress } from './meta';
import { RULES, span } from './rules';
import { Talk } from './talk';
import { World } from './world';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'call' | 'watch';
export interface Block { kind: BlockKind; dur: number; blind: boolean; roundEnd: boolean }
export type Phase = 'play' | 'finale' | 'done';
/** How the ring looks: the warm-up's, live in a sighted Wołanie, grey without signal, the night's, the dusk's. */
export type RingLook = 'warm' | 'live' | 'grey' | 'rest' | 'blind';

export interface Shepherd {
  i: number;
  name: string;
  dye: string;
  habit: Habit | null;
  x: number; y: number; vx: number; vy: number; dir: number;
  /** sheep in the flock now */
  n: number;
  /** the most it had this round */
  peak: number;
  out: boolean;
  /** the player's grace after a tumble (s) */
  grace: number;
  /** walking animation */
  stepT: number;
  walking: number;
  // the rivals' minds
  think: number;
  tx: number; ty: number;
  mode: 'graze' | 'hunt' | 'flee' | 'habit' | 'idle';
  habitT: number;
  habitNext: number;
  speedMul: number;
  /** a little bubble over the head */
  say: { text: string; t: number } | null;
  /** conversions this flock may still make this frame */
  budget: number;
  /** walking into something: how long, and a detour (s left, which way) */
  stuckT: number;
  detourT: number;
  detourSide: number;
  /** a long chase gives up for a while (s chasing, s before the next chase) */
  huntT: number;
  huntCool: number;
}

export interface Sheep {
  id: number;
  x: number; y: number; vx: number; vy: number; dir: number;
  /** −1: loose (undyed) */
  owner: number;
  /** a loose sheep grazes around home; walks to (gx, gy) */
  hx: number; hy: number; gx: number; gy: number; wanderT: number;
  /** after switching flocks, it cannot switch again for this long (s) */
  immune: number;
  /** the dye's flash when it joined or switched (1 → 0) */
  flash: number;
  /** walking toward a shepherd on its own (a star's straggler, the voice): his index, or −1 */
  fetch: number;
  fetchT: number;
  bob: number;
  lie: number;
  look: number;
  small: boolean;
}

/** A footprint behind the shepherd: where, which way, when (seconds of play: the trace colours it). */
export interface Print { x: number; y: number; dir: number; t: number; side: 1 | -1 }

export type DogState = 'heel' | 'run' | 'herd' | 'back' | 'fetch' | 'drag';
export interface Dog { x: number; y: number; vx: number; vy: number; dir: number; state: DogState; tx: number; ty: number; t: number; bark: number }

export type LambState = 'hidden' | 'carried' | 'home';

/** What the round's end showed (the tally card). */
export interface Tally {
  round: number;
  hill: HillDef;
  next: HillDef | null;
  place: number;
  of: number;
  flock: number;
  crown: number;
  lamb: number;
  lambName: string | null;
  score: number;
  /** sheep short of the first place (0: first) */
  toFirst: number;
  /** the wardrobe's next piece: sheep left and share done (null: full) */
  unlock: { left: number; share: number } | null;
  final: boolean;
}

export type HintKey = 'steer' | 'join' | 'whistle' | 'rival' | 'ring' | 'night' | 'lamb' | 'bigger';

export type SimEvent =
  | { type: 'join'; x: number; y: number; via: 'touch' | 'ring' | 'dog' | 'voice' | 'star' | 'morning' | 'flare'; who: number }
  | { type: 'steal'; x: number; y: number; from: number; to: number }
  | { type: 'out'; who: number; by: number; x: number; y: number }
  | { type: 'tumble'; x: number; y: number; toX: number; toY: number }
  | { type: 'whistle'; herd: boolean }
  | { type: 'herd'; n: number; x: number; y: number }
  | { type: 'voice'; called: number; lamb: boolean }
  | { type: 'bleat'; x: number; y: number }
  | { type: 'lambFound'; x: number; y: number }
  | { type: 'lambNamed'; index: number; isNew: boolean }
  | { type: 'crown'; who: number }
  | { type: 'roundEnd'; tally: Tally }
  | { type: 'newRound'; index: number; hill: HillDef }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number; stars: number }
  | { type: 'star'; n: number; x: number; y: number }
  | { type: 'morning'; n: number }
  | { type: 'flare'; share: number; r: number }
  | { type: 'unlock'; kind: SkinKind; index: number }
  | { type: 'hundred'; season: number }
  | { type: 'hint'; key: HintKey; x: number; y: number }
  | { type: 'rivalSay'; who: number; text: string }
  | { type: 'finale' };

const NO_EVENTS: readonly SimEvent[] = [];
const HILL_SALT = 0x6a09e667;
const TAU = Math.PI * 2;

// ── pure rules ───────────────────────────────────────────────────
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s
 * in 3, 6 s in a 40 s test); then Wołanie / Nocna straż pairs (24 ± 4 s and 23 ± 3 s, scaled to
 * end on time, jittered only when there is room) ending with a night, leaving the last 6 s to the
 * finale.  No block under 12 s.  Rounds: two pairs each (the last takes a lone pair left over);
 * a round ends with its last night (`roundEnd`).
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false, roundEnd: false });
  let plan: Block[];
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - R.finale);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      plan = [b('warmup', warm), b('call', rest / 2), b('watch', rest / 2)];
    } else {
      const watch = Math.max(R.minBlock, Math.min(14, left / 2));
      plan = [b('call', left - watch), b('watch', watch)];
    }
  } else {
    plan = [];
    let left = plannedSec - R.finale;
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
    durs.forEach((dur, i) => plan.push(b(i % 2 ? 'watch' : 'call', dur)));
  }
  // rounds of two pairs; a lone pair at the end joins the round before it
  const nights = plan.map((x, i) => (x.kind === 'watch' ? i : -1)).filter(i => i >= 0);
  const rounds = Math.max(1, Math.floor(nights.length / 2));
  for (let r = 0; r < rounds; r++) {
    const last = r === rounds - 1 ? nights.length - 1 : 2 * r + 1;
    plan[nights[Math.min(last, nights.length - 1)]].roundEnd = true;
  }
  return plan;
}

/** The ring's radius for a level (m): the band can only add. */
export const ringFor = (level: number): number => RULES.r0 + clamp(level) * RULES.rExtra;
/** The radius at the threshold (level 0.5): the dotted circle. */
export const RING_MARK = ringFor(0.5);
/** A flock of n keeps this far around its shepherd (m). */
export const keepFor = (n: number): number => RULES.keep0 + RULES.keepN * Math.sqrt(Math.max(0, n));
/** A flock of n slows its shepherd a little. */
export const slowFor = (n: number): number => Math.max(RULES.slowMin, 1 - RULES.slowPer * Math.sqrt(Math.max(0, n)));
/** A passed night's morning lambs for its stars: 2, +1 at 6 stars, +1 at 10. */
export const morningFor = (stars: number): number => RULES.morning + RULES.morningAt.filter(n => stars >= n).length;
/** The round's bonus for a place and a flock. */
export const crownFor = (place: number, flock: number): number =>
  flock <= 0 ? 0 : place === 1 ? Math.round(flock * RULES.crownShare) + RULES.crownFlat : place === 2 ? RULES.secondFlat : 0;
/** Who wins at a contact: +1 a, −1 b, 0 nobody (the bigger flock wins; equal flocks bounce). */
export const contest = (a: number, b: number): number => (a > b ? 1 : b > a ? -1 : 0);

export interface SimInit {
  progress: PasterzProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

const CELL = 1;

export class PasterzSim {
  readonly p: PasterzProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly hillRng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  readonly trace = new SignalTrace(40, 0.1);
  readonly talk: Talk;
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly voiceHold: number;
  private readonly starLead: number;

  started = false;
  readonly session: number;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';

  // the hill
  world!: World;
  roundIndex = -1;
  readonly firstHill: number;
  readonly shepherds: Shepherd[] = [];
  readonly sheep: Sheep[] = [];
  private nextId = 1;
  readonly prints: Print[] = [];
  private printAcc = 0;
  private printSide: 1 | -1 = 1;
  readonly dog: Dog = { x: 0, y: 0, vx: 0, vy: 0, dir: 0, state: 'heel', tx: 0, ty: 0, t: 0, bark: 0 };
  lamb = { x: 0, y: 0, state: 'hidden' as LambState, bleat: 0, bleatT: 0 };
  /** the round's tally card (s left; the world holds still while it shows), and what it shows */
  tallyT = 0;
  tally: Tally | null = null;
  /** who wears the crown (−1: nobody) */
  crown = -1;
  /** the half size of the view (m), set by the picture: "in sight" for the voice and the hints */
  viewW = 12;
  viewH = 9;
  private trickleT = 0;

  // the hands
  /** the joystick (−1..1 each), from a drag or the keys */
  stickX = 0;
  stickY = 0;
  private readonly keys = new Set<string>();
  private dragStick = { x: 0, y: 0, on: false };
  private lastInput = -99;
  whistleCool = 0;
  /** the shepherd is led by Łatek (no hands for a while) */
  auto = false;

  // the band
  reliable = false;
  private levelNow = 0;
  ringR: number = RULES.r0;
  ringLook: RingLook = 'warm';
  /** smoothed calm in a night (the panel's gauge) */
  calmShown = 0;
  flareT = 0;
  flareR = 0;
  compassT = 0;
  private voiceBlock = 0;
  private nextVoice = 0;
  private lastHold = 0;
  night = 0;
  private starP = 0;
  stars = 0;
  private relSec = 0;
  /** a rival's night stragglers: seconds to the next one */
  private rivalNightT: number[] = [];
  private rivalNightLeft: number[] = [];

  // the session's numbers
  banked = 0;
  voices = 0;
  maxStars = 0;
  passedNights = 0;
  morningLambs = 0;
  roundsDone = 0;
  crownsWon = 0;
  tumbles = 0;
  stolen = 0;
  lostToRivals = 0;
  rivalsOut = 0;
  bestPlace = 99;
  bestFlockNow = 0;
  nearMiss = Infinity;
  blindShare = -1;
  readonly lambsNamed: { index: number; isNew: boolean }[] = [];
  readonly unlocksNow: { kind: SkinKind; index: number }[] = [];
  private seasonsNow = 0;
  private settled = false;
  private readonly callsBase: number;
  private callsBegun = 0;
  private readonly bestBefore: number | null;

  // tutorial
  private readonly hintQueue: HintKey[] = [];
  private hintGap = 2;
  private hintAgain: Partial<Record<HintKey, number>> = {};
  private steered = false;
  private whistled = false;

  // the grid (sheep by cell)
  private readonly gw: number;
  private readonly gh: number;
  private readonly head: Int32Array;
  private next: Int32Array;

  constructor(init: SimInit) {
    const p = (this.p = init.progress);
    migrate(p);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.hillRng = mulberry32((Math.floor(init.rng() * 2 ** 32) ^ HILL_SALT) >>> 0);
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.voiceHold = RULES.voiceHold[band];
    this.starLead = RULES.starLead[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.callsBase = p.calls;
    this.firstHill = p.hill;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.talk = new Talk(LINES, mulberry32((Math.floor(init.rng() * 2 ** 32) ^ 0x2545f491) >>> 0));
    this.gw = Math.ceil(RULES.mapW / CELL);
    this.gh = Math.ceil(RULES.mapH / CELL);
    this.head = new Int32Array(this.gw * this.gh);
    this.next = new Int32Array(RULES.maxSheep + 16);
    this.newRound();
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get nextBlock(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'call' && this.block.blind && this.phase === 'play'; }
  get sighted(): boolean { return this.block?.kind === 'call' && !this.block.blind && this.blockT >= this.lead && this.phase === 'play'; }
  get nightBlock(): boolean { return this.block?.kind === 'watch' && this.phase === 'play'; }
  /** the world is asleep: a night, the finale */
  get asleep(): boolean { return this.nightBlock || this.phase !== 'play'; }
  get frozen(): boolean { return this.tallyT > 0; }
  get player(): Shepherd { return this.shepherds[0]; }
  /** the ring that gathers now: the live one, or the blind block's flare */
  get ring(): number { return this.flareT > 0 ? Math.max(this.ringR, this.flareR) : this.ringR; }
  get leadIn(): number { return this.lead; }
  get voiceNeed(): number { return this.voiceHold; }
  get hill(): HillDef { return this.world.def; }
  /** the headline: the rounds banked plus the flock now */
  get score(): number { return this.banked + this.player.n; }

  /** the ranking: shepherds by flock, the out ones last */
  ranking(): Shepherd[] {
    return this.shepherds.slice().sort((a, b) => (a.out === b.out ? b.n - a.n || a.i - b.i : a.out ? 1 : -1));
  }

  /** the player's place now (1 = first; ties share the better place) */
  get place(): number {
    const me = this.player.n;
    return 1 + this.shepherds.filter(s => s.i !== 0 && !s.out && s.n > me).length;
  }

  /** seconds left in the round (the blocks to its end) */
  get roundLeft(): number {
    let s = Math.max(0, (this.block?.dur ?? 0) - this.blockT);
    if (this.block?.roundEnd || this.phase !== 'play') return s;
    for (let i = this.blockIndex + 1; i < this.plan.length; i++) {
      s += this.plan[i].dur;
      if (this.plan[i].roundEnd) break;
    }
    return s;
  }

  get roundsPlanned(): number { return Math.max(1, this.plan.filter(b => b.roundEnd).length); }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
    this.talk.ask('open', 3, 9);
    if (!this.taught('steer')) this.queueHint('steer');
    if (!this.taught('join')) this.queueHint('join');
  }

  // ── the rounds ─────────────────────────────────────────────────
  private newRound(): void {
    this.roundIndex++;
    const i = this.roundIndex, R = RULES;
    const def = hillAt(this.firstHill + i);
    const seed = Math.floor(this.hillRng() * 2 ** 32) >>> 0;
    this.world = new World(seed, def, R.rivals);
    const gen = mulberry32(seed ^ 0x9e3779b9);
    this.sheep.length = 0;
    this.prints.length = 0;
    this.shepherds.length = 0;
    const first = this.session === 1 && i === 0;
    const mk = (k: number): Shepherd => {
      const s = this.world.starts[k];
      const def = k === 0 ? null : RIVALS[k - 1];
      return {
        i: k, name: def ? def.name : '', dye: def ? def.dye : PLAYER_DYE, habit: def ? def.habit : null,
        x: s.x, y: s.y, vx: 0, vy: 0, dir: gen() * TAU, n: 0, peak: 0, out: false, grace: 0, stepT: 0, walking: 0,
        think: gen() * R.thinkSec, tx: s.x, ty: s.y, mode: 'idle', habitT: 0, habitNext: span(R.habit, gen()),
        speedMul: def ? R.rivalSpeed * def.speed * (first ? 0.9 : Math.min(1.06, 0.96 + 0.03 * i)) : 1,
        say: null, budget: 0, stuckT: 0, detourT: 0, detourSide: 1, huntT: 0, huntCool: 0,
      };
    };
    for (let k = 0; k <= R.rivals; k++) this.shepherds.push(mk(k));
    for (const g of this.world.groups) {
      const pen = g.pen >= 0 ? this.world.pens[g.pen] : null;
      for (let k = 0; k < g.n; k++) {
        let x: number, y: number;
        if (pen) {
          const a = gen() * TAU, r = Math.sqrt(gen()) * (pen.r - 1);
          x = pen.x + Math.cos(a) * r;
          y = pen.y + Math.sin(a) * r;
        } else {
          const a = gen() * TAU, r = Math.sqrt(gen()) * RULES.groupR;
          const q = this.world.dry(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r, 0.4);
          x = q.x;
          y = q.y;
        }
        const s = this.makeSheep(x, y, -1, gen);
        s.hx = pen ? x : g.x;
        s.hy = pen ? y : g.y;
      }
    }
    // later rounds: the rivals come with a few sheep of their own
    const start = Math.min(R.rivalStartMax, i * R.rivalStart);
    for (let k = 1; k <= R.rivals && start > 0; k++) {
      const sh = this.shepherds[k];
      for (let j = 0; j < start; j++) {
        const a = gen() * TAU;
        this.makeSheep(sh.x + Math.cos(a) * 1.2, sh.y + Math.sin(a) * 1.2, k, gen);
      }
    }
    this.recount();
    const pl = this.player;
    Object.assign(this.dog, { x: pl.x - 1, y: pl.y + 0.6, vx: 0, vy: 0, dir: 0, state: 'heel', t: 0, bark: 0 });
    this.lamb = { x: this.world.lamb.x, y: this.world.lamb.y, state: 'hidden', bleat: 0, bleatT: R.bleat * 0.6 };
    this.crown = -1;
    this.ringR = R.r0;
    this.flareT = 0;
    this.compassT = 0;
    if (i > 0) this.emit({ type: 'newRound', index: i, hill: def });
  }

  /** The round is over (at the end of its last night, the finale, or an early end): the tally, the bank, the meta. */
  private endRound(final: boolean): void {
    if (this.tally && this.tally.round === this.roundIndex) return;
    const p = this.p, R = RULES, pl = this.player;
    const place = this.place, flock = pl.n;
    const top = Math.max(0, ...this.shepherds.filter(s => s.i !== 0 && !s.out).map(s => s.n));
    const crown = crownFor(place, flock);
    let lamb = 0, lambName: string | null = null;
    if (this.lamb.state === 'carried') {
      this.lamb.state = 'home';
      lamb = R.lambBonus;
      const named = nameLamb(p);
      this.lambsNamed.push(named);
      lambName = LAMBS[named.index].name;
      this.emit({ type: 'lambNamed', index: named.index, isNew: named.isNew });
    }
    const score = flock + crown + lamb;
    this.banked += score;
    pl.n = 0;
    for (const s of this.sheep) if (s.owner === 0) s.owner = -2;   // banked: they leave the contest
    this.roundsDone++;
    this.bestPlace = Math.min(this.bestPlace, place);
    this.bestFlockNow = Math.max(this.bestFlockNow, flock);
    if (place > 1 && flock > 0) this.nearMiss = Math.min(this.nearMiss, top - flock + 1);
    // the meta: the map, the crowns, the hundred, the wardrobe
    p.rounds++;
    const hillI = this.world.def.index;
    while (p.hillCrowns.length <= hillI) p.hillCrowns.push(0);
    if (place === 1 && flock > 0) {
      this.crownsWon++;
      p.crowns++;
      p.hillCrowns[hillI]++;
    }
    p.hill = this.firstHill + this.roundIndex + 1;
    p.total += score;
    p.bestFlock = Math.max(p.bestFlock, flock);
    const seasons = addHome(p, homeFor(flock));
    if (seasons > 0) {
      this.seasonsNow += seasons;
      this.emit({ type: 'hundred', season: p.season });
    }
    for (const u of openWardrobe(p)) {
      this.unlocksNow.push(u);
      this.emit({ type: 'unlock', kind: u.kind, index: u.index });
    }
    this.tally = {
      round: this.roundIndex, hill: this.world.def, next: final ? null : hillAt(this.firstHill + this.roundIndex + 1),
      place, of: this.shepherds.length, flock, crown, lamb, lambName, score, toFirst: place === 1 ? 0 : top - flock + 1,
      unlock: nextUnlock(p), final,
    };
    this.talk.ask(place === 1 && flock > 0 ? 'crown' : 'round', 3, 6);
    this.emit({ type: 'roundEnd', tally: this.tally });
  }

  private makeSheep(x: number, y: number, owner: number, rnd: () => number, small = false): Sheep {
    const s: Sheep = {
      id: this.nextId++, x, y, vx: 0, vy: 0, dir: rnd() * TAU, owner, hx: x, hy: y, gx: x, gy: y, wanderT: rnd() * 3,
      immune: 0, flash: owner >= 0 ? 1 : 0, fetch: -1, fetchT: 0, bob: rnd() * 2, lie: 0, look: 0, small,
    };
    if (this.sheep.length < RULES.maxSheep) this.sheep.push(s);
    if (this.next.length < this.sheep.length + 1) {
      const n = new Int32Array(this.sheep.length * 2);
      n.set(this.next);
      this.next = n;
    }
    return s;
  }

  private recount(): void {
    for (const s of this.shepherds) s.n = 0;
    for (const s of this.sheep) if (s.owner >= 0) this.shepherds[s.owner].n++;
  }

  // ── the hands ──────────────────────────────────────────────────
  /** The joystick from a drag (screen px from where the finger went down); null lets go. */
  drag(dx: number | null, dy = 0): void {
    if (dx === null) {
      this.dragStick = { x: 0, y: 0, on: false };
      return;
    }
    const d = Math.hypot(dx, dy);
    if (d < RULES.deadPx) {
      this.dragStick = { x: 0, y: 0, on: true };
      return;
    }
    const k = Math.min(1, d / RULES.stickPx) / d;
    this.dragStick = { x: dx * k, y: dy * k, on: true };
    this.lastInput = this.t;
    this.steered = true;
  }

  /** Arrows and WASD walk, Space whistles; true when the key is the game's. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k in DIRS) {
      if (down) {
        this.keys.add(k);
        this.lastInput = this.t;
        this.steered = true;
      } else this.keys.delete(k);
      return true;
    }
    if (k === ' ' || k === 'Enter') {
      if (down) this.whistle();
      return true;
    }
    return false;
  }

  release(): void {
    this.keys.clear();
    this.dragStick = { x: 0, y: 0, on: false };
  }

  /** A tap or Space: Łatek runs to the nearest loose sheep in reach and herds what he finds into the flock. */
  whistle(): void {
    if (!this.started || this.phase === 'done' || this.frozen) return;
    if (this.asleep) {
      this.emit({ type: 'whistle', herd: false });
      return;
    }
    if (this.whistleCool > 0) return;
    this.whistled = true;
    const pl = this.player, d = this.dog;
    let best: Sheep | null = null, bd: number = RULES.dogReach;
    for (const s of this.sheep) {
      if (s.owner !== -1 || s.fetch >= 0) continue;
      const dd = Math.hypot(s.x - pl.x, s.y - pl.y);
      if (dd < bd) { bd = dd; best = s; }
    }
    this.whistleCool = RULES.whistleCool;
    if (best) {
      d.state = 'run';
      d.tx = best.x;
      d.ty = best.y;
      d.t = 0;
      d.bark = 0.5;
    }
    this.emit({ type: 'whistle', herd: !!best });
  }

  private readStick(): { x: number; y: number } {
    let x = 0, y = 0;
    for (const k of this.keys) {
      x += DIRS[k][0];
      y += DIRS[k][1];
    }
    if (x || y) {
      const l = Math.hypot(x, y);
      return { x: x / l, y: y / l };
    }
    return { x: this.dragStick.x, y: this.dragStick.y };
  }

  // ── a frame ────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.phaseT += dt;
    this.brain(dt, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    if (this.tallyT > 0) this.tallyT = Math.max(0, this.tallyT - dt);
    this.whistleCool = Math.max(0, this.whistleCool - dt);
    if (!this.frozen) {
      this.walkPlayer(dt);
      this.walkRivals(dt);
      this.moveSheep(dt);
      this.contacts(dt);
      this.walkDog(dt);
      this.lambTick(dt);
      this.trickle(dt);
      this.nightTick(dt);
      this.crownTick();
    }
    this.hints(dt);
    if (this.phase === 'finale' && this.phaseT >= RULES.finale) {
      this.phase = 'done';
      this.settle();
    }
    const blocked = this.telegraphing || (this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0) || this.frozen;
    this.talk.update(dt, t, blocked);
    for (const s of this.shepherds) if (s.say && (s.say.t += dt) > 2.6) s.say = null;
  }

  get telegraphing(): boolean {
    return this.phase === 'play' && !!this.block && this.blockT >= this.block.dur - RULES.telegraph && this.blockIndex < this.plan.length - 1;
  }

  /** The band's slow quantities: the ring, the voice, the stars, the trace and the night. */
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    this.reliable = f.reliable;
    this.levelNow = f.level;
    const play = this.phase === 'play';
    if (play && f.reliable) this.relSec += dt;
    const live = this.sighted && f.reliable;
    this.ringR = approach(this.ringR, live ? ringFor(f.level) : R.r0, dt, R.ringTau);
    this.ringLook = !play ? 'warm' : b.kind === 'warmup' ? 'warm' : b.kind === 'watch' ? 'rest' : b.blind ? 'blind' : f.reliable ? 'live' : 'grey';
    this.calmShown = approach(this.calmShown, f.reliable ? f.calm : this.calmShown, dt, 0.6);
    this.flareT = Math.max(0, this.flareT - dt);
    this.compassT = Math.max(0, this.compassT - dt);
    const phase: TracePhase = !play ? 'free' : b.kind === 'call' ? 'focus' : b.kind === 'watch' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    if (f.hold < this.lastHold - 0.5) this.nextVoice = this.voiceHold;
    this.lastHold = f.hold;
    if (live && !this.frozen && f.hold >= this.nextVoice && this.voiceBlock < R.voiceMax) {
      this.voiceBlock++;
      this.nextVoice = f.hold + R.voiceAgain;
      this.voice();
    }
    if (live && this.ringR >= RING_MARK && this.blockT > this.lead + 2) this.talk.ask('ring', 1, 3);
    if (play && b.kind === 'watch' && this.blockT >= this.starLead && f.reliable) {
      this.starP = Math.min(R.starMax, this.starP + R.starGain * f.calm * dt);
      while (Math.floor(this.starP) > this.stars) {
        this.stars++;
        this.maxStars = Math.max(this.maxStars, this.stars);
        this.star();
      }
    }
    const toNext = this.nextBlock && b ? b.dur - this.blockT : Infinity;
    const want = !play ? 0.25 : b.kind === 'watch' ? 1 : b.blind ? 0.5 : this.nextBlock?.kind === 'watch' && toNext < R.telegraph ? 0.35 : 0;
    this.night = approach(this.night, want, dt, R.nightTau);
  }

  /** "Głos": every loose sheep within reach walks to the shepherd; the lost lamb bleats. */
  private voice(): void {
    const pl = this.player;
    let called = 0;
    for (const s of this.sheep) {
      if (s.owner !== -1 || s.fetch >= 0) continue;
      if (Math.hypot(s.x - pl.x, s.y - pl.y) > RULES.voiceR) continue;
      s.fetch = 0;
      s.fetchT = 0;
      s.look = 1.5;
      called++;
    }
    const lamb = this.lamb.state === 'hidden';
    if (lamb) {
      this.compassT = RULES.compassSec;
      this.lamb.bleat = 1.4;
    }
    this.voices++;
    this.talk.ask('voice', 3, 4);
    this.emit({ type: 'voice', called, lamb });
  }

  /** A star lit: one straggler from the dark walks to the fire with Łatek. */
  private star(): void {
    const pl = this.player;
    let best: Sheep | null = null, bd = 26;
    for (const s of this.sheep) {
      if (s.owner !== -1 || s.fetch >= 0) continue;
      const d = Math.hypot(s.x - pl.x, s.y - pl.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) {
      const a = this.rng() * TAU;
      const q = this.world.dry(pl.x + Math.cos(a) * 9, pl.y + Math.sin(a) * 9, 0.5);
      best = this.makeSheep(q.x, q.y, -1, this.rng);
    }
    best.fetch = 0;
    best.fetchT = 0;
    best.look = 1;
    const d = this.dog;
    d.state = 'fetch';
    d.tx = best.x;
    d.ty = best.y;
    d.t = 0;
    if (this.stars === 1 || this.stars % 4 === 0) this.talk.ask('star', 1, 4);
    this.emit({ type: 'star', n: this.stars, x: best.x, y: best.y });
  }

  // ── the blocks ─────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'call' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - R.finale) {
      this.endBlock();
      this.beginFinale();
    } else if (!last && this.blockT >= b.dur) {
      const roundEnd = b.roundEnd;
      this.endBlock();
      if (roundEnd) {
        this.endRound(false);
        this.newRound();
        this.tallyT = R.tallySec;
      }
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
    if (b.kind === 'call') {
      this.callsBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.callsBase + this.callsBegun) % RULES.blindEvery === 0;
      this.voiceBlock = 0;
      this.nextVoice = this.voiceHold;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 9);
      if (!b.blind && !this.taught('ring')) this.queueHint('ring');
    } else if (b.kind === 'watch') {
      this.starP = 0;
      this.stars = 0;
      this.dog.state = 'heel';
      this.talk.ask('rest', 2, 9);
      if (!this.taught('night')) this.queueHint('night');
      // each rival's stragglers come one by one through the night
      this.rivalNightLeft = this.shepherds.map(s => (s.i === 0 || s.out ? 0 : Math.round(span(RULES.rivalNight, this.rng()))));
      this.rivalNightT = this.shepherds.map(() => 3 + this.rng() * 3);
    }
    this.tip = this.tipFor(b, i);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number): string {
    const k = this.session - 1 + i;
    if (b.kind === 'warmup') return TIPS.warmup[k % TIPS.warmup.length];
    if (b.kind === 'call') return b.blind ? TIPS.blind[k % TIPS.blind.length] : TIPS.call[k % TIPS.call.length];
    return TIPS.watch[k % TIPS.watch.length];
  }

  private endBlock(): void {
    const b = this.block, R = RULES;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'call' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.judge.verdict();
      if (b.kind === 'watch') {
        this.maxStars = Math.max(this.maxStars, this.stars);
        if (verdict) this.passedNights++;
        this.morning(verdict ? morningFor(this.stars) : R.graceLambs);
      }
      if (b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.flareT = R.flareSec;
        this.flareR = ringFor(s) * 1.2;
        this.emit({ type: 'flare', share: s, r: this.flareR });
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.t - this.blockT, t1: this.t, stars: b.kind === 'watch' ? this.stars : 0 });
  }

  /** Dawn after a night: morning lambs trot up to the flock (a passed night brings more). */
  private morning(n: number): void {
    const pl = this.player;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.rng();
      const q = this.world.dry(pl.x + Math.cos(a) * 1.3, pl.y + Math.sin(a) * 1.3, 0.3);
      const s = this.makeSheep(q.x, q.y, 0, this.rng, true);
      s.look = 1;
      this.player.n++;
      this.morningLambs++;
      this.emit({ type: 'join', x: q.x, y: q.y, via: 'morning', who: 0 });
    }
    this.emit({ type: 'morning', n });
  }

  // ── the bodies ─────────────────────────────────────────────────
  private walkPlayer(dt: number): void {
    const pl = this.player, R = RULES;
    pl.grace = Math.max(0, pl.grace - dt);
    let vx = 0, vy = 0;
    const st = this.readStick();
    this.stickX = st.x;
    this.stickY = st.y;
    const speed = R.speed * slowFor(pl.n);
    this.auto = false;
    if (!this.asleep) {
      if (Math.hypot(st.x, st.y) > 0.08) {
        vx = st.x * speed;
        vy = st.y * speed;
        this.lastInput = this.t;
      } else if (this.t - this.lastInput >= R.autoAfter && !this.dragStick.on) {
        const g = this.autoGoal();
        if (g) {
          const v = this.headFor(pl, g.x, g.y, speed * R.autoSpeed);
          vx = v.x;
          vy = v.y;
          this.auto = vx !== 0 || vy !== 0;
        }
      }
    }
    this.moveShepherd(pl, vx, vy, dt);
    // footprints (the history on the ground)
    this.printAcc += Math.hypot(pl.vx, pl.vy) * dt;
    if (this.printAcc >= 0.6) {
      this.printAcc = 0;
      this.printSide = this.printSide === 1 ? -1 : 1;
      const px = -Math.sin(pl.dir) * 0.13 * this.printSide, py = Math.cos(pl.dir) * 0.13 * this.printSide;
      this.prints.push({ x: pl.x + px, y: pl.y + py, dir: pl.dir, t: this.t, side: this.printSide });
      if (this.prints.length > 140) this.prints.shift();
    }
  }

  /** Łatek's lead when the hands rest: away from a bigger flock close by, else to the nearest loose sheep. */
  private autoGoal(): { x: number; y: number } | null {
    const pl = this.player;
    for (const r of this.shepherds) {
      if (r.i === 0 || r.out || r.n <= pl.n) continue;
      const d = Math.hypot(r.x - pl.x, r.y - pl.y);
      if (d < 6) return { x: clamp(pl.x + (pl.x - r.x) / d * 8, 2, this.world.w - 2), y: clamp(pl.y + (pl.y - r.y) / d * 8, 2, this.world.h - 2) };
    }
    if (this.lamb.state === 'hidden' && Math.hypot(this.lamb.x - pl.x, this.lamb.y - pl.y) < 7) return this.lamb;
    let best: Sheep | null = null, bd = Infinity;
    for (const s of this.sheep) {
      if (s.owner !== -1) continue;
      const d = Math.hypot(s.x - pl.x, s.y - pl.y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /**
   * The velocity toward a goal: by the next waypoint (a bridge, a pen's gate), bending around what
   * stands ahead; a shepherd who has walked into something for a while takes a short detour.
   */
  private headFor(s: Shepherd, gx: number, gy: number, speed: number): { x: number; y: number } {
    const w = this.world.waypoint(s.x, s.y, gx, gy);
    const dx = w.x - s.x, dy = w.y - s.y, d = Math.hypot(dx, dy);
    if (d < 0.25) return { x: 0, y: 0 };
    let u = this.world.avoid(s.x, s.y, dx / d, dy / d, RULES.radius);
    if (s.detourT > 0) {
      const a = Math.atan2(u.y, u.x) + s.detourSide * 1.25;
      u = { x: Math.cos(a), y: Math.sin(a) };
    }
    return { x: u.x * speed, y: u.y * speed };
  }

  private moveShepherd(s: Shepherd, vx: number, vy: number, dt: number): void {
    s.detourT = Math.max(0, s.detourT - dt);
    const want = Math.hypot(vx, vy);
    const a = 1 - Math.exp(-dt / RULES.accelTau);
    s.vx += (vx - s.vx) * a;
    s.vy += (vy - s.vy) * a;
    const ox = s.x, oy = s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    this.world.push(s, RULES.radius, ox, oy);
    const moved = Math.hypot(s.x - ox, s.y - oy) / dt;
    if (want > 1 && moved < want * 0.3) {
      s.stuckT += dt;
      if (s.stuckT > 0.6) {
        s.stuckT = 0;
        s.detourT = 0.9;
        s.detourSide = this.rng() < 0.5 ? -1 : 1;
      }
    } else s.stuckT = Math.max(0, s.stuckT - dt);
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > 0.3) s.dir = turn(s.dir, Math.atan2(s.vy, s.vx), dt * 12);
    s.walking = clamp(sp / RULES.speed);
    s.stepT += sp * dt;
  }

  private walkRivals(dt: number): void {
    const R = RULES;
    for (const r of this.shepherds) {
      if (r.i === 0) continue;
      if (r.out || this.asleep) {
        this.moveShepherd(r, 0, 0, dt);
        continue;
      }
      r.think -= dt;
      r.habitNext -= dt;
      if (r.habitT > 0) {
        r.habitT -= dt;
        this.moveShepherd(r, 0, 0, dt);
        continue;
      }
      if (r.habitNext <= 0 && (r.habit === 'nap' || r.habit === 'snack' || r.habit === 'chat') && this.tallyT <= 0) {
        r.habitNext = span(R.habit, this.rng());
        r.habitT = R.habitSec;
        r.mode = 'habit';
        this.rivalSay(r, r.habit);
        continue;
      }
      if (r.think <= 0) {
        const step = R.thinkSec * (0.7 + this.rng() * 0.6);
        r.think = step;
        r.huntCool = Math.max(0, r.huntCool - step);
        if (r.mode === 'hunt') {
          r.huntT += step;
          if (r.huntT > 7) {
            r.huntT = 0;
            r.huntCool = 8;
          }
        } else r.huntT = 0;
        this.decide(r);
      }
      const d = Math.hypot(r.tx - r.x, r.ty - r.y);
      const sp = R.speed * r.speedMul * slowFor(r.n) * (r.mode === 'graze' && d < 1 ? 0.4 : 1);
      const v = this.headFor(r, r.tx, r.ty, sp);
      this.moveShepherd(r, v.x, v.y, dt);
    }
  }

  /** A rival's choice: flee a bigger flock close by, hunt a smaller one, else go for loose sheep. */
  private decide(r: Shepherd): void {
    const R = RULES;
    const flee = r.habit === 'timid' ? R.fleeR * 1.4 : R.fleeR;
    const hunt = r.habit === 'bold' ? 0.95 : r.habit === 'timid' ? 0.6 : R.hunt;
    let threat: Shepherd | null = null, td: number = flee;
    let prey: Shepherd | null = null, pd: number = R.huntR;
    for (const o of this.shepherds) {
      if (o === r || o.out) continue;
      const d = Math.hypot(o.x - r.x, o.y - r.y);
      if (o.n > r.n * R.flee + 1 && d < td) { td = d; threat = o; }
      if (r.n >= 4 && r.huntCool <= 0 && o.n + 1 < r.n * hunt && d < pd && !(o.i === 0 && o.grace > 0)) { pd = d; prey = o; }
    }
    if (threat) {
      const dx = r.x - threat.x, dy = r.y - threat.y, d = Math.hypot(dx, dy) || 1;
      r.tx = clamp(r.x + (dx / d) * 9 + (this.rng() - 0.5) * 4, 2, this.world.w - 2);
      r.ty = clamp(r.y + (dy / d) * 9 + (this.rng() - 0.5) * 4, 2, this.world.h - 2);
      r.mode = 'flee';
      return;
    }
    if (prey) {
      r.tx = prey.x + prey.vx * 0.4;
      r.ty = prey.y + prey.vy * 0.4;
      r.mode = 'hunt';
      return;
    }
    // loose sheep: a few at random, the nearest and densest wins (the pens are worth a detour)
    let best: Sheep | null = null, bs = -1;
    const n = this.sheep.length;
    if (n) {
      for (let k = 0; k < 18; k++) {
        const s = this.sheep[Math.floor(this.rng() * n)];
        if (s.owner !== -1 || s.fetch >= 0) continue;
        const d = Math.hypot(s.x - r.x, s.y - r.y);
        const score = (this.world.inPen(s.x, s.y) >= 0 ? 1.6 : 1) / (d + 3);
        if (score > bs) { bs = score; best = s; }
      }
    }
    if (r.mode === 'graze' && Math.hypot(r.tx - r.x, r.ty - r.y) > 1.2 && this.rng() < 0.6) return;
    if (best) {
      r.tx = best.x;
      r.ty = best.y;
    } else {
      r.tx = clamp(r.x + (this.rng() - 0.5) * 16, 3, this.world.w - 3);
      r.ty = clamp(r.y + (this.rng() - 0.5) * 16, 3, this.world.h - 3);
    }
    r.mode = 'graze';
  }

  private rivalSay(r: Shepherd, what: RivalSay): void {
    const lines = RIVAL_LINES[what];
    const text = lines[Math.floor(this.rng() * lines.length)];
    r.say = { text, t: 0 };
    this.emit({ type: 'rivalSay', who: r.i, text });
  }

  private buildGrid(): void {
    this.head.fill(-1);
    const gw = this.gw, gh = this.gh;
    for (let i = 0; i < this.sheep.length; i++) {
      const s = this.sheep[i];
      const cx = Math.min(gw - 1, Math.max(0, Math.floor(s.x / CELL))), cy = Math.min(gh - 1, Math.max(0, Math.floor(s.y / CELL)));
      const c = cy * gw + cx;
      this.next[i] = this.head[c];
      this.head[c] = i;
    }
  }

  /** Every sheep within `r` of (x, y), by index. */
  private near(x: number, y: number, r: number, each: (i: number, d: number) => void): void {
    const gw = this.gw, gh = this.gh;
    const x0 = Math.max(0, Math.floor((x - r) / CELL)), x1 = Math.min(gw - 1, Math.floor((x + r) / CELL));
    const y0 = Math.max(0, Math.floor((y - r) / CELL)), y1 = Math.min(gh - 1, Math.floor((y + r) / CELL));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (let i = this.head[cy * gw + cx]; i >= 0; i = this.next[i]) {
          const s = this.sheep[i];
          const d = Math.hypot(s.x - x, s.y - y);
          if (d <= r) each(i, d);
        }
      }
    }
  }

  private moveSheep(dt: number): void {
    const R = RULES;
    this.buildGrid();
    const a = 1 - Math.exp(-dt / R.steerTau);
    const night = this.asleep;
    for (let i = 0; i < this.sheep.length; i++) {
      const s = this.sheep[i];
      s.immune = Math.max(0, s.immune - dt);
      s.flash = Math.max(0, s.flash - dt * 1.6);
      s.look = Math.max(0, s.look - dt);
      let wx = 0, wy = 0;
      if (s.owner >= 0 || s.owner === -2) {
        // (−2: banked at the round's end, they stay by the shepherd till the next hill)
        const L = s.owner >= 0 ? this.shepherds[s.owner] : this.player;
        const w = this.world.waypoint(s.x, s.y, L.x, L.y);
        const dx = w.x - s.x, dy = w.y - s.y, d = Math.hypot(dx, dy);
        const keep = keepFor(s.owner === -2 ? this.tally?.flock ?? 0 : L.n) * (night ? 0.8 : 1);
        const direct = w.x === L.x && w.y === L.y;
        const want = direct ? clamp((d - keep * 0.4) * 2.4, 0, night ? 1.6 : R.maxSpeed) : R.maxSpeed * 0.9;
        if (d > 1e-3) {
          const u = want > 1 && d > keep ? this.world.avoid(s.x, s.y, dx / d, dy / d, R.sheepR, 1.2) : { x: dx / d, y: dy / d };
          wx = u.x * want;
          wy = u.y * want;
        }
        if (direct && d < keep * 1.4 && !night) {
          wx += L.vx * 0.6;
          wy += L.vy * 0.6;
        }
      } else if (s.fetch >= 0) {
        const L = this.shepherds[s.fetch];
        s.fetchT += dt;
        const w = this.world.waypoint(s.x, s.y, L.x, L.y);
        const dx = w.x - s.x, dy = w.y - s.y, d = Math.hypot(dx, dy) || 1;
        wx = (dx / d) * 2.8;
        wy = (dy / d) * 2.8;
      } else {
        s.wanderT -= dt;
        if (s.wanderT <= 0) {
          s.wanderT = 2 + this.rng() * 4;
          const ang = this.rng() * TAU, r = this.rng() * R.groupR;
          s.gx = s.hx + Math.cos(ang) * r;
          s.gy = s.hy + Math.sin(ang) * r;
        }
        const dx = s.gx - s.x, dy = s.gy - s.y, d = Math.hypot(dx, dy);
        if (d > 0.3 && !night) {
          wx = (dx / d) * R.grazeSpeed;
          wy = (dy / d) * R.grazeSpeed;
        }
      }
      // keep apart
      let sx = 0, sy = 0;
      this.near(s.x, s.y, R.sepR, (j, d) => {
        if (j === i || d < 1e-4) return;
        const o = this.sheep[j];
        const k = ((R.sepR - d) / R.sepR) * 6;
        sx += ((s.x - o.x) / d) * k;
        sy += ((s.y - o.y) / d) * k;
      });
      for (const L of this.shepherds) {
        const dx = s.x - L.x, dy = s.y - L.y, d = Math.hypot(dx, dy);
        if (d < 0.75 && d > 1e-4) {
          sx += (dx / d) * (0.75 - d) * 10;
          sy += (dy / d) * (0.75 - d) * 10;
        }
      }
      s.vx += (wx + sx - s.vx) * a;
      s.vy += (wy + sy - s.vy) * a;
      const ox = s.x, oy = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.world.push(s, R.sheepR, ox, oy);
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0.35) s.dir = turn(s.dir, Math.atan2(s.vy, s.vx), dt * 8);
      s.bob += sp * dt * 2.2;
      const lie = night && sp < 0.5 && s.owner !== -1 ? 1 : 0;
      s.lie = approach(s.lie, lie, dt, lie ? 0.9 : 0.25);
    }
  }

  /** The contest: loose sheep join what touches them, flocks win each other's sheep at the contact. */
  private contacts(dt: number): void {
    const R = RULES;
    for (const L of this.shepherds) L.budget = Math.min(R.convertRate * 0.25, L.budget + R.convertRate * dt);
    if (this.asleep) {
      // the night: only the fetched stragglers come in
      for (const s of this.sheep) {
        if (s.fetch < 0 || s.owner !== -1) continue;
        const L = this.shepherds[s.fetch];
        if (Math.hypot(s.x - L.x, s.y - L.y) <= keepFor(L.n) + 0.6 || s.fetchT > 8) this.join(s, s.fetch, s.fetch === 0 ? 'star' : 'touch');
      }
      return;
    }
    this.buildGrid();
    // sheep against sheep
    for (let i = 0; i < this.sheep.length; i++) {
      const a = this.sheep[i];
      if (a.owner < 0) continue;
      const A = this.shepherds[a.owner];
      this.near(a.x, a.y, R.joinR, (j, d) => {
        const b = this.sheep[j];
        if (b.owner === a.owner || b.owner === -2) return;
        if (b.owner === -1) {
          this.join(b, a.owner, 'touch');
          return;
        }
        if (d > R.contactR || b.immune > 0) return;
        const B = this.shepherds[b.owner];
        if (contest(A.n, B.n) > 0 && A.budget >= 1) this.convert(b, A);
      });
    }
    // the shepherds themselves (and the player's ring)
    for (const L of this.shepherds) {
      if (L.out) continue;
      const reach = L.i === 0 ? Math.max(R.joinR, this.ring) : R.joinR;
      this.near(L.x, L.y, Math.max(reach, R.outR), (j, d) => {
        const b = this.sheep[j];
        if (b.owner === L.i || b.owner === -2) return;
        if (b.owner === -1) {
          if (d <= reach) this.join(b, L.i, d > R.joinR ? (this.flareT > 0 && d > this.ringR ? 'flare' : 'ring') : 'touch');
          return;
        }
        if (d > R.outR) return;
        const B = this.shepherds[b.owner];
        const c = contest(L.n, B.n);
        if (c > 0 && b.immune <= 0 && L.budget >= 1) this.convert(b, L);
        else if (c < 0 && L.n === 0) this.knockOut(L, B);
      });
    }
    // shepherd against shepherd (two lone ones bounce)
    for (const a of this.shepherds) {
      for (const b of this.shepherds) {
        if (a.i >= b.i || a.out || b.out) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > R.outR) continue;
        const c = contest(a.n, b.n);
        if (c > 0 && b.n === 0) this.knockOut(b, a);
        else if (c < 0 && a.n === 0) this.knockOut(a, b);
      }
    }
    // the fetched (the voice's) arrive
    for (const s of this.sheep) {
      if (s.fetch < 0 || s.owner !== -1) continue;
      const L = this.shepherds[s.fetch];
      if (Math.hypot(s.x - L.x, s.y - L.y) <= keepFor(L.n) + 0.6 || s.fetchT > 9) this.join(s, s.fetch, 'voice');
    }
  }

  private join(s: Sheep, who: number, via: Extract<SimEvent, { type: 'join' }>['via']): void {
    s.owner = who;
    s.fetch = -1;
    s.flash = 1;
    s.look = 0.6;
    s.immune = 0.2;
    const L = this.shepherds[who];
    L.n++;
    L.peak = Math.max(L.peak, L.n);
    if (who === 0) this.bestFlockNow = Math.max(this.bestFlockNow, L.n);
    this.emit({ type: 'join', x: s.x, y: s.y, via, who });
  }

  private convert(s: Sheep, to: Shepherd): void {
    const from = this.shepherds[s.owner];
    from.n--;
    to.n++;
    to.peak = Math.max(to.peak, to.n);
    to.budget -= 1;
    s.owner = to.i;
    s.immune = RULES.immune;
    s.flash = 1;
    s.fetch = -1;
    if (to.i === 0) {
      this.stolen++;
      if (this.stolen === 1 || this.stolen % 25 === 0) this.talk.ask('big', 2, 4);
    }
    if (from.i === 0) {
      this.lostToRivals++;
      if (this.lostToRivals === 1 || this.lostToRivals % 15 === 0) {
        this.talk.ask('near', 2, 4);
        if (to.say === null) this.rivalSay(to, 'got');
      }
    }
    this.emit({ type: 'steal', x: s.x, y: s.y, from: from.i, to: to.i });
  }

  /** A shepherd with no sheep, touched by a bigger flock: a rival is out till the round ends; the player tumbles to safety. */
  private knockOut(L: Shepherd, by: Shepherd): void {
    if (L.out) return;
    if (L.i === 0) {
      if (L.grace > 0) return;
      const q = this.safeSpot();
      const from = { x: L.x, y: L.y };
      L.x = q.x;
      L.y = q.y;
      L.vx = L.vy = 0;
      L.grace = RULES.graceSec;
      Object.assign(this.dog, { x: q.x - 0.9, y: q.y + 0.5, state: 'heel' });
      this.tumbles++;
      this.talk.ask('tumble', 3, 4);
      this.emit({ type: 'tumble', x: from.x, y: from.y, toX: q.x, toY: q.y });
      return;
    }
    L.out = true;
    L.vx = L.vy = 0;
    if (by.i === 0) {
      this.rivalsOut++;
      this.talk.ask('big', 3, 4);
    }
    this.rivalSay(L, 'sulk');
    this.emit({ type: 'out', who: L.i, by: by.i, x: L.x, y: L.y });
  }

  /** Where Łatek pulls the shepherd: by loose sheep, far from any flock. */
  private safeSpot(): { x: number; y: number } {
    let best = { x: this.world.w / 2, y: this.world.h / 2 }, bs = -Infinity;
    for (let k = 0; k < 24; k++) {
      const s = this.sheep[Math.floor(this.rng() * this.sheep.length)];
      if (!s || s.owner !== -1) continue;
      let far = Infinity;
      for (const r of this.shepherds) if (r.i !== 0 && !r.out && r.n > 0) far = Math.min(far, Math.hypot(r.x - s.x, r.y - s.y) - Math.sqrt(r.n));
      if (far > bs) { bs = far; best = { x: s.x, y: s.y }; }
    }
    return this.world.dry(best.x + 1.5, best.y + 1, 0.6);
  }

  private walkDog(dt: number): void {
    const d = this.dog, pl = this.player, R = RULES;
    d.t += dt;
    d.bark = Math.max(0, d.bark - dt);
    let tx = pl.x - Math.cos(pl.dir) * 1.1 + Math.sin(pl.dir) * 0.7, ty = pl.y - Math.sin(pl.dir) * 1.1 - Math.cos(pl.dir) * 0.7;
    let sp = R.speed * 1.3;
    if (d.state === 'run' || d.state === 'fetch') {
      tx = d.tx;
      ty = d.ty;
      sp = R.dogSpeed;
      if (Math.hypot(d.x - tx, d.y - ty) < 0.8 || d.t > 3) {
        if (d.state === 'run') this.herd();
        d.state = 'back';
        d.t = 0;
      }
    } else if (d.state === 'back') {
      sp = R.dogSpeed * 0.8;
      if (Math.hypot(d.x - pl.x, d.y - pl.y) < 2 || d.t > 3) d.state = 'heel';
    }
    const w = this.world.waypoint(d.x, d.y, tx, ty);
    const dx = w.x - d.x, dy = w.y - d.y, dd = Math.hypot(dx, dy);
    const want = d.state === 'heel' ? Math.min(sp, dd * 3) : sp;
    const vx = dd > 0.05 ? (dx / dd) * want : 0, vy = dd > 0.05 ? (dy / dd) * want : 0;
    const a = 1 - Math.exp(-dt / 0.1);
    d.vx += (vx - d.vx) * a;
    d.vy += (vy - d.vy) * a;
    const ox = d.x, oy = d.y;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    this.world.push(d, 0.3, ox, oy);
    if (Math.hypot(d.vx, d.vy) > 0.3) d.dir = turn(d.dir, Math.atan2(d.vy, d.vx), dt * 14);
  }

  /** Łatek reached the loose sheep: everything loose within his reach runs to the flock. */
  private herd(): void {
    const d = this.dog;
    let n = 0;
    this.buildGrid();
    this.near(d.x, d.y, RULES.herdR, j => {
      const s = this.sheep[j];
      if (s.owner !== -1 || s.fetch >= 0) return;
      this.join(s, 0, 'dog');
      n++;
    });
    d.bark = 0.6;
    if (n) this.emit({ type: 'herd', n, x: d.x, y: d.y });
  }

  private lambTick(dt: number): void {
    const R = RULES, pl = this.player, l = this.lamb;
    l.bleat = Math.max(0, l.bleat - dt);
    if (l.state !== 'hidden' || this.asleep) return;
    l.bleatT -= dt;
    if (l.bleatT <= 0) {
      l.bleatT = R.bleat;
      l.bleat = 1.2;
      this.emit({ type: 'bleat', x: l.x, y: l.y });
      if (!this.taught('lamb')) this.queueHint('lamb');
      else if (this.rng() < 0.3) this.talk.ask('bleat', 0, 3);
    }
    if (Math.hypot(l.x - pl.x, l.y - pl.y) <= R.lambPick) {
      l.state = 'carried';
      this.compassT = 0;
      this.talk.ask('lamb', 3, 5);
      this.teach('lamb');
      this.emit({ type: 'lambFound', x: l.x, y: l.y });
    }
  }

  /** Stragglers wander in from the far hills when the loose sheep run low (Crowd City's new walkers). */
  private trickle(dt: number): void {
    if (this.asleep) return;
    let loose = 0;
    for (const s of this.sheep) if (s.owner === -1) loose++;
    if (loose >= RULES.looseMin || this.sheep.length >= RULES.maxSheep) return;
    this.trickleT -= dt;
    if (this.trickleT > 0) return;
    this.trickleT = RULES.trickle;
    const pl = this.player;
    for (let k = 0; k < 8; k++) {
      const x = 3 + this.rng() * (this.world.w - 6), y = 3 + this.rng() * (this.world.h - 6);
      if (Math.abs(x - pl.x) < this.viewW + 1 && Math.abs(y - pl.y) < this.viewH + 1) continue;
      const q = this.world.dry(x, y, 0.5);
      this.makeSheep(q.x, q.y, -1, this.rng);
      return;
    }
  }

  /** The rivals' night stragglers come one by one. */
  private nightTick(dt: number): void {
    if (!this.nightBlock) return;
    for (const r of this.shepherds) {
      if (r.i === 0 || r.out || !(this.rivalNightLeft[r.i] > 0)) continue;
      this.rivalNightT[r.i] -= dt;
      if (this.rivalNightT[r.i] > 0) continue;
      this.rivalNightT[r.i] = 3 + this.rng() * 3;
      this.rivalNightLeft[r.i]--;
      let best: Sheep | null = null, bd = 20;
      for (const s of this.sheep) {
        if (s.owner !== -1 || s.fetch >= 0) continue;
        const d = Math.hypot(s.x - r.x, s.y - r.y);
        if (d < bd) { bd = d; best = s; }
      }
      if (best) {
        best.fetch = r.i;
        best.fetchT = 0;
      }
    }
  }

  private crownTick(): void {
    let top = -1, n = 0, tie = false;
    for (const s of this.shepherds) {
      if (s.out) continue;
      if (s.n > n) { n = s.n; top = s.i; tie = false; } else if (s.n === n && n > 0) tie = true;
    }
    const who = tie || n < 3 ? this.crown : top;
    if (who !== this.crown) {
      this.crown = who;
      if (who === 0) this.talk.ask('crown', 2, 4);
      this.emit({ type: 'crown', who });
    }
    // the first rival in sight
    if (!this.taught('rival')) {
      const pl = this.player;
      const r = this.shepherds.find(s => s.i !== 0 && !s.out && Math.abs(s.x - pl.x) < this.viewW * 0.8 && Math.abs(s.y - pl.y) < this.viewH * 0.8);
      if (r) {
        this.queueHint('rival');
        this.talk.ask('rival', 1, 4);
      }
    } else if (!this.taught('bigger')) {
      const pl = this.player;
      const r = this.shepherds.find(s => s.i !== 0 && !s.out && s.n > 0 && s.n < pl.n && Math.hypot(s.x - pl.x, s.y - pl.y) < 8);
      if (r) this.queueHint('bigger');
    }
  }

  // ── the tutorial ───────────────────────────────────────────────
  taught(k: HintKey): boolean { return this.p.taught.includes(k); }
  private teach(k: HintKey): void { if (!this.p.taught.includes(k)) this.p.taught.push(k); }
  private queueHint(k: HintKey): void { if (!this.hintQueue.includes(k) && !this.taught(k)) this.hintQueue.push(k); }

  /** One coach mark at a time, when it first matters; steering and the whistle come back until done. */
  private hints(dt: number): void {
    if (this.phase !== 'play') return;
    this.hintGap = Math.max(0, this.hintGap - dt);
    if (this.steered) this.teach('steer');
    if (this.whistled) this.teach('whistle');
    if (!this.taught('whistle') && this.taught('join') && this.t > 8) this.queueHint('whistle');
    for (const k of ['steer', 'whistle'] as const) {
      if (this.taught(k) || this.hintQueue.includes(k)) continue;
      const again = this.hintAgain[k];
      if (again !== undefined && this.t >= again) this.hintQueue.push(k);
    }
    if (this.hintGap > 0 || !this.hintQueue.length || this.frozen) return;
    if ((this.blockIndex > 0 && this.blockT < 2) || this.telegraphing) return;
    // in the night only the night's own lesson: the hands rest
    let at0 = 0;
    if (this.asleep) {
      at0 = this.hintQueue.indexOf('night');
      if (at0 < 0) return;
    }
    const k = this.hintQueue.splice(at0, 1)[0];
    if (this.taught(k)) return;
    const pl = this.player;
    let at = { x: pl.x, y: pl.y };
    if (k === 'ring') {
      if (!this.sighted) {
        this.hintQueue.unshift(k);
        return;
      }
      at = { x: pl.x + this.ringR, y: pl.y };
    } else if (k === 'night') at = { x: pl.x, y: pl.y - 3 };
    else if (k === 'lamb') at = { x: this.lamb.x, y: this.lamb.y };
    else if (k === 'rival' || k === 'bigger') {
      const r = this.shepherds.filter(s => s.i !== 0 && !s.out).sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))[0];
      if (r) at = { x: r.x, y: r.y };
    } else if (k === 'join') {
      const s = this.sheep.find(x => x.owner === -1);
      if (s) at = { x: s.x, y: s.y };
    }
    // lessons learnt by being shown; the controls only by doing them
    if (k !== 'steer' && k !== 'whistle') this.teach(k);
    else this.hintAgain[k] = this.t + 12;
    this.hintGap = 5;
    this.emit({ type: 'hint', key: k, x: at.x, y: at.y });
  }

  // ── the finale and the settling ────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.compassT = 0;
    this.endRound(true);
    this.talk.ask('end', 3, 6);
    this.emit({ type: 'finale' });
  }

  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p;
    p.sessions = Math.max(p.sessions, this.session);
    p.calls = Math.max(p.calls, this.callsBase + this.callsBegun);
    p.lastLen = this.plannedSec;
    p.bestStars = Math.max(p.bestStars, this.maxStars);
  }

  /** The session ends before its own finale: the round is tallied as the finale would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') {
      this.endBlock();
      this.endRound(true);
    }
    this.settle();
    this.phase = 'done';
  }

  // ── output ─────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The pad follows the ring in a sighted Wołanie, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp((this.ringR - RULES.r0) / RULES.rExtra);
    return null;
  }

  /** The panel's gauge: the ring's reach in a Wołanie, the night's calm in a Nocna straż; null when blind or without signal. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    const b = this.block;
    if (b.kind === 'watch') return clamp(this.calmShown);
    if (b.kind === 'call' && b.blind) return null;
    // the ring itself (it rests at r0 through the lead-in: the band answers ~5 s late)
    if (b.kind === 'call') return clamp((this.ringR - RULES.r0) / RULES.rExtra);
    // the warm-up: the level itself
    return clamp(this.levelNow);
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  result(): ArcadeOutcome {
    const p = this.p, score = this.score;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.rounds'), String(this.roundsDone)],
      [t('stat.place'), this.bestPlace < 99 ? t('place', { n: this.bestPlace }) : '—'],
      [t('stat.crowns'), String(this.crownsWon)],
      [t('stat.flock'), String(this.bestFlockNow)],
      [t('stat.stolen'), String(this.stolen)],
      [t('stat.stars'), String(this.maxStars)],
      [t('stat.hundred'), `${p.flock}/${RULES.hundred}`],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score, unit: unit(score), record: this.bestBefore !== null && score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.lambsNamed.length) fit.push('luk15.4-6', 'isa40.11');
    if (this.voices > 0) fit.push('jhn10.3', 'jhn10.27');
    if (this.passedNights > 0) fit.push('luk2.8', 'psa147.4');
    if (this.crownsWon > 0 || this.bestFlockNow >= 40) fit.push('ezk34.12');
    fit.push('psa100.3', 'psa23.1-3');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.seasonsNow > 0) add(0, t('hl.hundred', { n: this.p.season + 1 }));
    if (this.lambsNamed.length) {
      const names = this.lambsNamed.slice(0, 3).map(l => LAMBS[l.index].name);
      add(1, names.length === 1 ? t('hl.lamb', { name: names[0] }) : t('hl.lambs', { names: names.join(', '), n: names.length }));
    }
    if (this.crownsWon) add(2, t('hl.crowns', { n: this.crownsWon }));
    else if (this.nearMiss < Infinity) add(2, t('hl.near', { sheep: sheepText(this.nearMiss) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(3, t('hl.record', { sheep: sheepText(this.score) }));
    else if (this.bestBefore !== null && this.score < this.bestBefore) add(6, t('hl.toRecord', { sheep: sheepText(this.bestBefore - this.score) }));
    if (this.rivalsOut) add(4, t('hl.out', { n: this.rivalsOut }));
    if (this.unlocksNow.length) add(5, t('hl.unlock', { name: this.unlocksNow.map(u => skinName(u.kind, u.index)).join(', ') }));
    if (this.blindShare >= 0) add(7, t('hl.blind', { n: this.blindShare }));
    if (this.started) add(9, t('hl.close'));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}

const skinName = (kind: SkinKind, index: number): string => t(`skin.${kind}.${index}` as 'skin.cloak.0');

const DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};

function turn(a: number, b: number, k: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * Math.min(1, k);
}

export type { Moment };
