/**
 * Ogień, ogień, ogień's session, without the DOM (the view reads it; the tests drive it).
 *
 * The fire climbs a ladder of seven: a spark, a candle, a bonfire, the pillar of fire, a star, a hypergiant
 * and Pentecost.  Each has a ring — its charge, 0..1.  In a push block focus charges it: past the lead-in
 * (the band's lag) the rate is k(level) / ringSec, k = 0 at the threshold and 1 at the top, so the higher the
 * signal the faster it fills ("z rosnącą koncentracją"); a passed rest leaves an ember bed (×1.15).  The
 * hands add a small, softly capped base with one small task per scale (blow, shield, feed, light the tents,
 * fuse, gather, pass the fire on), so everyone climbs.  The ring never shrinks.  A full ring is the change:
 * the next, bigger fire (the view's flare, white-out and "Powers of Ten" zoom), with its card and verse; a
 * full ring at Pentecost starts a new round of the ladder from a new spark, in a richer picture.
 *
 * In a rest block calm banks light (after its own lead-in) and the flame breathes 4 in / 6 out; the banked
 * light pours back into the ring at the next push's start, over its lead-in, so the change never fires in a
 * rest and the band's lag is never dead time.  Whatever would complete a ring outside a push (the warm-up,
 * a rest) waits in the light too: nothing gathered is ever lost.  A blind push (smoke, every 4th from the
 * 3rd session) hides the brain's charge and pours it in when its veil lifts.  A bad signal freezes the
 * brain's part at neutral: no charge, no loss, the fire never shown low for it.
 *
 * The headline is sparks: charge gathered × the fire's worth, light counted when banked, a blind block's
 * charge when revealed (so the headline never leaks what the smoke hides).
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import { LINES, LONG_BURN, ROOT, RUNGS, TASK_MOMENT, TIPS, arrival, rungName, rungShort, variantName, type Moment, type TaskKind } from './content';
import { sparksText, t, unit } from './i18n';
import { bestFor, formKey, lenKey, variantFor, type OgienProgress } from './meta';
import { RULES, span } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';

/** first-time explanations (coach marks), each once ever */
export type Coach = 'blow' | 'ring' | 'rest' | 'breath' | 'light' | 'shield' | 'feed' | 'tents' | 'fuse' | 'gather' | 'pass' | 'blind' | 'button';
/** where a coach mark points: the fire, the ring, the button, the pile, or a spot in units */
export type CoachAt = { kind: 'fire' } | { kind: 'ring' } | { kind: 'button' } | { kind: 'pile' } | { kind: 'unit'; x: number; y: number } | null;

export interface Pt { x: number; y: number }

/** the candle's draught: waiting, warned (the curtain lifts), blowing */
export interface Gust { phase: 'wait' | 'tele' | 'blow'; t: number; side: -1 | 1; shielded: boolean; n: number }
/** a tent near the pillar: its lamp 0..1 (fading), and the flame on its way from the pillar (0..1, −1 none) */
export interface Tent { x: number; y: number; s: number; lit: number; arc: number }
/** a pair of hydrogen nuclei drifting round the star (fused: seconds since, −1 not yet) */
export interface Pair { id: number; a: number; r: number; w: number; age: number; spin: number; fused: number }
/** a wisp of the nebula's gas (caught: seconds since the finger caught it, −1 free) */
export interface Wisp { id: number; a: number; r: number; w: number; hue: number; size: number; age: number; caught: number; ca: number; cr: number }
/** one of the gathered at Pentecost: waiting, a tongue of fire coming down on them, a flame passed to them, alight */
export interface Figure { x: number; y: number; h: number; state: 'wait' | 'tongue' | 'pass' | 'lit'; k: number; from: number; street: boolean; seed: number; fade: number }
/** a log burning on the bonfire (seconds left) */
export interface Burning { t: number; x: number; rot: number }

export interface Card { kind: 'open' | 'change' | 'cycle'; rung: number; variant: number; cycle: number; t: number; dur: number; fresh: boolean; verse: PassageId }

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'finale' }
  | { type: 'change'; from: number; to: number; cycle: number; fromVariant: number; variant: number; fresh: boolean; sec: number; fastest: boolean }
  | { type: 'cycle'; n: number }
  | { type: 'task'; kind: TaskKind | 'poke' | 'trim'; x: number; y: number; gain: number; target: number }
  | { type: 'puff'; x: number; y: number }
  | { type: 'ripple'; x: number; y: number }
  | { type: 'gustTele'; side: -1 | 1 }
  | { type: 'gust'; side: -1 | 1; shielded: boolean }
  | { type: 'tongue'; i: number }
  | { type: 'arrive'; i: number }
  | { type: 'near' }
  | { type: 'pour'; amount: number }
  | { type: 'reveal'; amount: number }
  | { type: 'bonus'; amount: number }
  | { type: 'ember' }
  | { type: 'record' }
  | { type: 'tick'; pct: number }
  | { type: 'card'; card: Card }
  | { type: 'coach'; what: Coach; at: CoachAt };

const NO_EVENTS: readonly SimEvent[] = [];

// ── pure rules ───────────────────────────────────────────────────
/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in 3, 6 s in
 * a 40 s test); then push / rest pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time, jittered only when there
 * is room) ending with a rest, leaving the finale at the end.  No block under 12 s.
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

/** The brain's share of the charge rate: 0 at the threshold (level 0.5) and below, 1 at the top. */
export const brainK = (level: number): number => (level <= 0.5 ? 0 : clamp((level - 0.5) / 0.5) ** RULES.kPow);
/** Seconds of full focus that fill a fire's ring in a round of the ladder. */
export const ringSecFor = (rung: number, cycle: number): number => RULES.ringSec[rung] * RULES.cycleK ** cycle;
/** Sparks a full ring of a fire is worth in a round. */
export const worthOf = (rung: number, cycle: number): number => RULES.worth[rung] * RULES.cycleWorth ** cycle;

/** The breath the flame keeps in rest: 0 → 1 over the in-breath, 1 → 0 over the out-breath. */
export function breathAt(sec: number): { k: number; in: boolean } {
  const cyc = RULES.breathIn + RULES.breathOut;
  const s = ((sec % cyc) + cyc) % cyc;
  if (s < RULES.breathIn) {
    const x = s / RULES.breathIn;
    return { k: 0.5 - Math.cos(Math.PI * x) / 2, in: true };
  }
  const x = (s - RULES.breathIn) / RULES.breathOut;
  return { k: 0.5 + Math.cos(Math.PI * x) / 2, in: false };
}

// the near tents round the pillar's base (units: the ring's radius), the gathered at Pentecost
const TENT_SPOTS: readonly (readonly [number, number, number])[] = [
  [-1.42, 0.98, 0.3], [-0.98, 1.22, 0.33], [-0.52, 0.9, 0.28], [0.52, 0.9, 0.28], [0.98, 1.22, 0.33], [1.42, 0.98, 0.3], [-0.92, 0.66, 0.24], [0.92, 0.66, 0.24],
];
const ROOM: readonly (readonly [number, number])[] = [[-0.74, 0.2], [-0.5, 0.22], [-0.25, 0.2], [0, 0.23], [0.25, 0.2], [0.5, 0.22], [0.74, 0.2]];
const STREET: readonly (readonly [number, number])[] = [[-1.55, 1.08], [-1.2, 1.24], [-0.82, 1.1], [0.82, 1.1], [1.2, 1.24], [1.55, 1.08], [-0.45, 1.3], [0.45, 1.3]];

export interface SimInit {
  progress: OgienProgress;
  rng: () => number;
  day: string;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

export class OgienSim {
  readonly p: OgienProgress;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  readonly talk: Talk;
  readonly plannedSec: number;
  readonly eeg: boolean;
  private readonly day: string;
  private readonly finaleSec: number;
  private readonly bestBefore: number | null;
  readonly plan: Block[];
  started = false;
  phase: Phase = 'play';
  t = 0;
  session = 0;
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  tip = '';
  private lastTip = '';
  private pushN = 0;
  private restN = 0;
  /** push blocks counted before this session (the blind schedule) and begun in it */
  private pushesBase = 0;
  private pushesBegun = 0;
  private relSec = 0;
  private events: SimEvent[] = [];
  private settled = false;

  // ── the fire ──
  rung = 0;
  cycle = 0;
  variant = 0;
  /** the ring's charge (0..1) and the light banked in rest (rings) */
  ring = 0;
  light = 0;
  /** a blind block's charge, hidden until its veil lifts */
  veiled = 0;
  /** the shown heat (the eased level; 0.5 at the threshold, neutral) and the eased calm */
  heat = 0.5;
  calmShown = 0;
  /** the brain is acting this frame (a sighted push past its lead-in, a usable signal) */
  live = false;
  reliable = false;
  /** the next push's brain rate is × emberK (a passed rest) */
  ember = false;
  private pour = 0;
  private pourLeft = 0;
  /** the rings the hands added in this block */
  touchUsed = 0;
  /** seconds since this fire was reached; the change's picture still playing (s) */
  rungT = 0;
  changing = 0;
  sparks = 0;
  private lastTick = 0;
  private nearSaid = false;
  private goodT = 0;
  private goodSaid = false;
  private waitT = 0;
  private waitSaid = 0;
  private calmSaid = false;
  card: Card | null = null;
  /** a coach mark on screen until this time: Ignacy waits (the two bubbles never talk at once) */
  quietUntil = 0;

  // ── the hands' objects ──
  gust: Gust = { phase: 'wait', t: 7, side: 1, shielded: false, n: 0 };
  holding = false;
  shieldT = 0;
  logs: number = RULES.logs;
  private logT = 0;
  logInHand = false;
  burning: Burning[] = [];
  tents: Tent[] = [];
  pairs: Pair[] = [];
  wisps: Wisp[] = [];
  figures: Figure[] = [];
  private spawnT = 0;
  private tongueT = 0;
  private lastBlow = -9;
  private lastTrim = -9;
  private lastPoke = -9;
  private nextId = 1;

  // ── the session's numbers ──
  top = 0;
  changesNow = 0;
  cyclesNow = 0;
  tasksDone = 0;
  lightSparks = 0;
  passedPushes = 0;
  passedRests = 0;
  embersEarned = 0;
  blindShare = -1;
  maxHold = 0;
  private readonly reachedNow = new Set<string>();
  readonly freshForms: string[] = [];
  readonly newFastest: { rung: number; sec: number }[] = [];
  fastestNow: { rung: number; sec: number } | null = null;
  private recordSaid = false;

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.day = init.day;
    this.judge = RoundJudge.from(init.tuning);
    this.talk = new Talk(LINES, init.rng);
    this.finaleSec = finaleFor(init.plannedSec);
    this.bestBefore = bestFor(init.progress, init.plannedSec);
    this.plan = planBlocks(init.plannedSec, init.progress.sessions === 0, init.rng);
  }

  // ── the blocks, read by the view and the runner ──
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.blockIndex + 1 < this.plan.length ? this.plan[this.blockIndex + 1] : null; }
  get inPlay(): boolean { return this.started && this.phase === 'play'; }
  get pushBlock(): boolean { return this.inPlay && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.inPlay && this.block.kind === 'rest'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  get sighted(): boolean { return this.pushBlock && !this.block.blind; }
  get lead(): number { return this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs; }
  get restLead(): number { return this.eeg ? RULES.restLead.eeg : RULES.restLead.fnirs; }
  get task(): TaskKind { return RUNGS[this.rung].task; }
  /** the ladder index (round × 7 + fire) */
  get ladder(): number { return this.cycle * RULES.rungs + this.rung; }
  get breath(): { k: number; in: boolean } { return breathAt(this.restBlock ? this.blockT - 1 : this.t); }
  /** the runner's banner, a telegraph, a card or the change on screen: no bubble now */
  get talkBlocked(): boolean {
    if (!this.started || this.card || this.changing > 0 || this.t < this.quietUntil) return true;
    if (this.phase !== 'play') return false;
    const b = this.block;
    return (b.kind !== 'warmup' && this.blockT < RULES.bannerSec) || this.telegraphed;
  }
  /** a block in which the hands' tasks run (not rest) */
  get handsOn(): boolean { return this.started && this.phase !== 'done' && !this.restBlock; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.session = ++this.p.sessions;
    this.pushesBase = this.p.pushes;
    this.t = 0;
    this.variant = variantFor(this.p, 0, 0, this.session);
    this.seeForm(0, this.variant);
    this.reachedNow.add(RUNGS[0].id);
    this.setupTask();
    this.startBlock(0);
    if (!this.seen('open')) {
      this.see('open');
      this.openCard({ kind: 'open', rung: 0, variant: this.variant, cycle: 0, t: 0, dur: RULES.openSec, fresh: false, verse: ROOT });
      this.talk.ask('open', 3, 30);
    } else this.talk.ask(arrival(0), 2, 12);
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || this.phase === 'done') return;
    dt = Math.max(0, Math.min(0.1, dt));
    this.t = t;
    this.reliable = f.reliable && f.activity !== null;
    if (this.phase === 'play') this.schedule(dt, f, t);
    if (this.phase === 'finale' && t >= this.plannedSec) this.settle();
    if (this.settled) return;
    this.rungT += dt;
    this.changing = Math.max(0, this.changing - dt);
    this.fire(dt, f);
    this.hands(dt);
    this.cardTick(dt);
    this.talk.update(dt, t, this.talkBlocked);
  }

  /** What focus and calm do to the fire this frame. */
  private fire(dt: number, f: FocusFrame): void {
    const push = this.pushBlock, rest = this.restBlock;
    const past = push && this.blockT >= this.lead;
    this.live = push && past && this.reliable;
    // the shown heat: the level in a push (also blind: the view hides it), neutral otherwise or without signal
    const want = this.live ? f.level : 0.5;
    this.heat += (want - this.heat) * (1 - Math.exp(-dt / (this.live ? RULES.heatTau : RULES.neutralTau)));
    const calmWant = rest && this.reliable ? f.calm : 0;
    this.calmShown += (calmWant - this.calmShown) * (1 - Math.exp(-dt / 0.8));
    if (push && this.reliable && this.blockT >= this.lead) this.relSec += dt;
    if (rest && this.reliable && this.blockT >= this.restLead) this.relSec += dt;
    // focus charges the ring
    if (this.live) {
      const k = brainK(f.level) * (this.ember ? RULES.emberK : 1);
      const dc = (k * dt) / ringSecFor(this.rung, this.cycle);
      if (this.block.blind) this.veiled += dc;
      else this.add(dc, 'brain');
      if (!this.block.blind) {
        this.maxHold = Math.max(this.maxHold, f.hold);
        if (f.level > 0.5) {
          this.goodT += dt;
          this.waitT = 0;
        } else {
          this.goodT = 0;
          this.waitT += dt;
        }
        if (this.goodT >= RULES.goodSec && !this.goodSaid) {
          this.goodSaid = true;
          this.talk.ask('good', 1, 4);
        }
        if (this.waitT >= 14 && this.waitSaid < 2) {
          this.waitSaid++;
          this.waitT = 0;
          this.talk.ask('wait', 1, 5);
        }
      }
    }
    // the banked light pours back at a push's start (and in the finale)
    if (this.pourLeft > 0 && (push || this.phase === 'finale')) {
      const a = Math.min(this.pourLeft, this.light, this.pour * dt);
      if (a > 0) {
        this.light -= a;
        this.pourLeft -= a;
        this.add(a, 'light');
      } else this.pourLeft = 0;
    }
    // calm banks light in rest
    if (rest && this.reliable && this.blockT >= this.restLead) {
      const room = Math.max(0, RULES.lightMax - this.light);
      const dl = Math.min(room, f.calm * RULES.lightRate * dt);
      if (dl > 0) {
        this.light += dl;
        const s = dl * worthOf(this.rung, this.cycle);
        this.sparks += s;
        this.lightSparks += s;
        this.checkRecord();
      }
      if (!this.calmSaid && this.calmShown > 0.7 && this.blockT > 10) {
        this.calmSaid = true;
        this.talk.ask('calm', 1, 5);
      }
    }
  }

  /** May a full ring change the fire now?  In a push block and the finale; elsewhere it waits as light. */
  private get canChange(): boolean {
    return this.started && ((this.phase === 'play' && this.block.kind === 'push') || this.phase === 'finale');
  }

  /**
   * Charge into the ring: from the brain, the hands, a bonus, or the light pouring back.  Sparks count when
   * the charge is gathered (not when banked light comes back); outside a push a ring stops just short of full
   * and the rest waits as light, so nothing is lost and the change comes with focus.
   */
  private add(amount: number, source: 'brain' | 'hands' | 'bonus' | 'light' | 'reveal'): void {
    if (!(amount > 0)) return;
    if (source !== 'light') {
      this.sparks += amount * worthOf(this.rung, this.cycle);
      this.checkRecord();
    }
    let a = amount;
    while (a > 0) {
      if (!this.canChange) {
        const take = Math.min(a, Math.max(0, 0.999 - this.ring));
        this.ring += take;
        if (a - take > 0) this.light += a - take;
        break;
      }
      const take = Math.min(a, 1 - this.ring);
      this.ring += take;
      a -= take;
      if (this.ring >= 1 - 1e-9) {
        // a whole ring of overflow at once is carried in part; the rest waits as light
        const carry = Math.min(a, RULES.carryMax);
        if (a > carry) this.light += a - carry;
        a = 0;
        this.change(carry);
        break;
      }
    }
    const pct = Math.floor(this.ring * 10);
    if (pct > this.lastTick) {
      this.lastTick = pct;
      this.emit({ type: 'tick', pct: pct * 10 });
    }
    if (this.ring >= RULES.nearAt && !this.nearSaid) {
      this.nearSaid = true;
      this.emit({ type: 'near' });
      this.talk.ask('near', 2, 4);
    }
  }

  /** The hands' gain: softly capped per block (each gain × (1 − used / cap)). */
  private handGain(base: number): number {
    const cap = this.block.kind === 'warmup' && this.phase === 'play' ? RULES.touchCap.warmup
      : this.phase === 'finale' ? RULES.touchCap.finale : RULES.touchCap.push;
    const k = Math.max(0, 1 - this.touchUsed / cap);
    const g = base * k;
    this.touchUsed += g;
    return g;
  }

  private checkRecord(): void {
    if (this.recordSaid || this.bestBefore === null || this.sparks <= this.bestBefore) return;
    this.recordSaid = true;
    this.emit({ type: 'record' });
    this.talk.ask('record', 2, 8);
  }

  /** The ring is full: the next fire (or a new round from a spark), its card, its records. */
  private change(carry: number): void {
    const from = this.rung, fromVariant = this.variant, sec = this.rungT;
    const id = RUNGS[from].id;
    const prevBest = this.p.fastest[id];
    const fastest = prevBest === undefined || sec < prevBest;
    if (fastest) {
      this.p.fastest[id] = sec;
      if (prevBest !== undefined) this.newFastest.push({ rung: from, sec });
    }
    if (!this.fastestNow || sec < this.fastestNow.sec) this.fastestNow = { rung: from, sec };
    let cycleUp = false;
    this.rung++;
    if (this.rung >= RULES.rungs) {
      this.rung = 0;
      this.cycle++;
      this.cyclesNow++;
      cycleUp = true;
    }
    this.variant = variantFor(this.p, this.rung, this.cycle, this.session);
    const fresh = this.seeForm(this.rung, this.variant);
    this.reachedNow.add(RUNGS[this.rung].id);
    this.ring = clamp(carry, 0, 0.5);
    this.rungT = 0;
    this.lastTick = Math.floor(this.ring * 10);
    this.nearSaid = false;
    this.changesNow++;
    this.top = Math.max(this.top, this.ladder);
    this.changing = RULES.changeSec;
    this.setupTask();
    this.emit({ type: 'change', from, to: this.rung, cycle: this.cycle, fromVariant, variant: this.variant, fresh, sec, fastest });
    if (cycleUp) {
      this.emit({ type: 'cycle', n: this.cycle + 1 });
      this.openCard({ kind: 'cycle', rung: 0, variant: this.variant, cycle: this.cycle, t: 0, dur: RULES.cardSec, fresh, verse: RUNGS[0].verse });
      this.talk.ask('cycle', 3, 14);
    } else {
      this.openCard({ kind: 'change', rung: this.rung, variant: this.variant, cycle: this.cycle, t: 0, dur: RULES.cardSec, fresh, verse: RUNGS[this.rung].verse });
      this.talk.ask(arrival(this.rung), 3, 14);
    }
    const coach: Partial<Record<TaskKind, Coach>> = { feed: 'feed', tents: 'tents', fuse: 'fuse', gather: 'gather', pass: 'pass' };
    const c = coach[this.task];
    if (c) this.coach(c, this.task === 'feed' ? { kind: 'pile' } : { kind: 'fire' });
  }

  private seeForm(rung: number, variant: number): boolean {
    const key = formKey(rung, variant);
    if (this.p.forms.includes(key)) return false;
    this.p.forms.push(key);
    this.freshForms.push(key);
    return true;
  }

  private openCard(c: Card): void {
    this.card = c;
    this.emit({ type: 'card', card: c });
  }

  private cardTick(dt: number): void {
    const c = this.card;
    if (!c) return;
    c.t += dt;
    if (c.t >= c.dur) this.card = null;
  }

  /** A tap on the card: it goes (after a short moment, so a tap meant for the scene does not close it at once). */
  closeCard(): boolean {
    if (!this.card || this.card.t < RULES.cardMin) return false;
    this.card = null;
    return true;
  }

  // ── the hands ───────────────────────────────────────────────────
  /** The current fire's objects, fresh. */
  private setupTask(): void {
    this.gust = { phase: 'wait', t: span(RULES.gustEvery, this.rng()) * 0.6, side: this.rng() < 0.5 ? -1 : 1, shielded: false, n: this.gust.n };
    this.holding = false;
    this.shieldT = 0;
    this.logs = RULES.logs;
    this.logT = 0;
    this.logInHand = false;
    this.burning = [];
    this.tents = TENT_SPOTS.map(([x, y, s], i) => ({ x, y, s, lit: i === 2 || i === 3 ? 1 : 0, arc: -1 }));
    this.pairs = [];
    this.wisps = [];
    this.spawnT = 0.4;
    this.tongueT = 0.8;
    const street = this.variant === 1 ? STREET : STREET.slice(0, 6);
    this.figures = [
      ...ROOM.map(([x, y], i) => ({ x, y, h: 0.34, state: 'wait' as const, k: 0, from: -1, street: false, seed: i * 7 + 3, fade: 1 })),
      ...street.map(([x, y], i) => ({ x, y, h: 0.36, state: 'wait' as const, k: 0, from: -1, street: true, seed: i * 11 + 5, fade: 1 })),
    ];
    // the pairs and wisps of a new star start in place, so its scene is never empty
    if (this.task === 'fuse') for (let i = 0; i < 2; i++) this.spawnPair();
    if (this.task === 'gather') for (let i = 0; i < 5; i++) this.spawnWisp();
  }

  /** The objects live: draughts, the pile, the tents' lamps, the pairs and the wisps, the tongues coming down. */
  private hands(dt: number): void {
    const on = this.handsOn && this.changing <= 0.6;
    this.shieldT = Math.max(0, this.shieldT - dt);
    const R = RULES;
    switch (this.task) {
      case 'shield': {
        const g = this.gust;
        if (!on && g.phase === 'wait') break;
        g.t -= dt;
        if (g.phase === 'wait' && g.t <= 0) {
          g.phase = 'tele';
          g.t = R.gustTele;
          g.side = this.rng() < 0.5 ? -1 : 1;
          g.shielded = false;
          this.emit({ type: 'gustTele', side: g.side });
          if (g.n === 0) this.coach('shield', { kind: 'fire' });
        } else if (g.phase === 'tele' && g.t <= 0) {
          g.phase = 'blow';
          g.t = R.gustSec;
        } else if (g.phase === 'blow') {
          if (this.shielding) g.shielded = true;
          if (g.t <= 0) {
            g.n++;
            g.phase = 'wait';
            g.t = span(R.gustEvery, this.rng());
            if (g.shielded) {
              const gain = this.handGain(R.gains.shield);
              this.add(gain, 'hands');
              this.tasksDone++;
              this.emit({ type: 'task', kind: 'shield', x: 0, y: -0.2, gain, target: -1 });
              if (this.rng() < 0.5) this.talk.ask('shield', 1, 3);
            } else if (this.rng() < 0.35) this.talk.ask('gust', 1, 3);
            this.emit({ type: 'gust', side: g.side, shielded: g.shielded });
          }
        }
        break;
      }
      case 'feed': {
        if (on && this.logs < R.logs) {
          this.logT += dt;
          if (this.logT >= R.logEvery) {
            this.logT = 0;
            this.logs++;
          }
        }
        for (const b of this.burning) b.t -= dt;
        this.burning = this.burning.filter(b => b.t > -1.5);
        break;
      }
      case 'tents':
        for (const tt of this.tents) {
          tt.lit = Math.max(0, tt.lit - dt / R.tentFade);
          if (tt.arc >= 0) {
            tt.arc += dt / 0.55;
            if (tt.arc >= 1) {
              tt.arc = -1;
              tt.lit = 1;
            }
          }
        }
        break;
      case 'fuse': {
        for (const p of this.pairs) {
          p.age += dt;
          p.a += p.w * dt;
          if (p.fused >= 0) p.fused += dt;
        }
        this.pairs = this.pairs.filter(p => (p.fused < 0 ? p.age < R.pairLife : p.fused < 0.8));
        if (on) {
          this.spawnT -= dt;
          if (this.spawnT <= 0) {
            this.spawnT = R.pairEvery * (0.7 + this.rng() * 0.6);
            if (this.pairs.filter(p => p.fused < 0).length < R.pairs) this.spawnPair();
          }
        }
        break;
      }
      case 'gather': {
        for (const w of this.wisps) {
          w.age += dt;
          if (w.caught >= 0) {
            w.caught += dt;
            if (w.caught >= R.wispIn && w.caught - dt < R.wispIn) this.wispIn(w);
          } else w.a += w.w * dt;
        }
        this.wisps = this.wisps.filter(w => (w.caught < 0 ? w.age < 30 : w.caught < R.wispIn + 0.05));
        if (on) {
          this.spawnT -= dt;
          if (this.spawnT <= 0) {
            this.spawnT = R.wispEvery * (0.7 + this.rng() * 0.6);
            if (this.wisps.filter(w => w.caught < 0).length < R.wisps) this.spawnWisp();
          }
        }
        break;
      }
      case 'pass': {
        // tongues of fire come down on the room by themselves: a gift, in every block
        this.tongueT -= dt;
        if (this.tongueT <= 0 && this.changing <= 0.6) {
          this.tongueT = R.tongueEvery * (0.8 + this.rng() * 0.4);
          const waiting = this.figures.map((f, i) => ({ f, i })).filter(x => !x.f.street && x.f.state === 'wait');
          if (waiting.length) {
            const pick = waiting[Math.floor(this.rng() * waiting.length)];
            pick.f.state = 'tongue';
            pick.f.k = 0;
            pick.f.from = -1;
            this.emit({ type: 'tongue', i: pick.i });
          }
        }
        for (let i = 0; i < this.figures.length; i++) {
          const f = this.figures[i];
          if (f.fade < 1) f.fade = Math.min(1, f.fade + dt / 0.8);
          if (f.state === 'tongue' || f.state === 'pass') {
            f.k += dt / (f.state === 'tongue' ? R.tongueSec : R.passSec);
            if (f.k >= 1) {
              f.state = 'lit';
              f.k = 1;
              this.emit({ type: 'arrive', i });
            }
          }
        }
        // everyone alight: new people come into the street
        if (this.figures.every(f => f.state === 'lit')) {
          for (const f of this.figures) {
            if (!f.street) continue;
            f.state = 'wait';
            f.k = 0;
            f.fade = 0;
            f.seed += 13;
          }
        }
        break;
      }
      default:
        break;
    }
  }

  get shielding(): boolean { return this.holding || this.shieldT > 0; }

  private spawnPair(): void {
    const r = 0.55 + this.rng() * 0.55;
    this.pairs.push({ id: this.nextId++, a: this.rng() * Math.PI * 2, r, w: (this.rng() < 0.5 ? -1 : 1) * (0.08 + this.rng() * 0.12), age: 0, spin: this.rng() * 6, fused: -1 });
  }

  private spawnWisp(): void {
    this.wisps.push({
      id: this.nextId++, a: this.rng() * Math.PI * 2, r: 0.95 + this.rng() * 0.8, w: (this.rng() < 0.5 ? -1 : 1) * (0.04 + this.rng() * 0.08),
      hue: this.rng(), size: 0.12 + this.rng() * 0.1, age: 0, caught: -1, ca: 0, cr: 0,
    });
  }

  /** A pair's place (units). */
  pairAt(p: Pair): Pt { return { x: Math.cos(p.a) * p.r, y: Math.sin(p.a) * p.r * 0.86 }; }

  /** A wisp's place (units): free on its slow orbit, caught spiralling into the star. */
  wispAt(w: Wisp): Pt {
    if (w.caught < 0) return { x: Math.cos(w.a) * w.r, y: Math.sin(w.a) * w.r * 0.8 };
    const k = clamp(w.caught / RULES.wispIn);
    const e = k * k * (3 - 2 * k);
    const r = w.cr * (1 - e) + 0.25 * e * (1 - k);
    const a = w.ca + e * 2.6 * Math.sign(w.w || 1);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8 };
  }

  private wispIn(w: Wisp): void {
    const gain = this.handGain(RULES.gains.wisp);
    this.add(gain, 'hands');
    this.tasksDone++;
    this.emit({ type: 'task', kind: 'gather', x: 0, y: 0, gain, target: w.id });
    if (this.rng() < 0.12) this.talk.ask('gather', 1, 3);
  }

  private catchWisp(w: Wisp): void {
    if (w.caught >= 0) return;
    w.caught = 0;
    w.ca = w.a;
    w.cr = w.r;
  }

  /**
   * The scene's primary action at a point (units around the fire; null = the best target, as the button
   * and Space do).  Returns whether something happened.  In a rest block the hands rest: a tap only ripples.
   */
  tap(at: Pt | null): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (!this.handsOn) {
      const p = at ?? { x: 0, y: 0 };
      this.emit({ type: 'ripple', x: p.x, y: p.y });
      return false;
    }
    if (this.changing > 0.6) return false;
    const R = RULES;
    switch (this.task) {
      case 'blow': {
        this.emit({ type: 'puff', x: 0, y: 0 });
        if (this.t - this.lastBlow < R.blowGap) return true;
        this.lastBlow = this.t;
        return this.handTask('blow', R.gains.blow, 0, 0, -1, 0.1);
      }
      case 'shield': {
        if (this.gust.phase !== 'wait') {
          // a tap at the warning shelters the flame until the draught has passed
          this.shieldT = Math.max(this.shieldT, (this.gust.phase === 'tele' ? this.gust.t : 0) + R.gustSec + 0.1, R.shieldTap);
          return true;
        }
        if (this.t - this.lastTrim < R.trimGap) return true;
        this.lastTrim = this.t;
        return this.handTask('trim', R.gains.trim, 0, -0.3, -1, 0);
      }
      case 'feed': {
        if (!at && this.logs > 0) return this.feedFromPile();
        if (this.t - this.lastPoke < R.pokeGap) return true;
        this.lastPoke = this.t;
        return this.handTask('poke', R.gains.poke, 0, 0.15, -1, 0);
      }
      case 'tents': {
        const from = at ?? { x: 0, y: 0.9 };
        let best = -1, bd = Infinity;
        this.tents.forEach((tt, i) => {
          if (tt.lit >= R.relight || tt.arc >= 0) return;
          const d = Math.hypot(tt.x - from.x, tt.y - from.y);
          if (d < bd) { bd = d; best = i; }
        });
        if (best < 0) {
          this.emit({ type: 'ripple', x: from.x, y: from.y });
          return false;
        }
        const tt = this.tents[best];
        tt.arc = 0;
        return this.handTask('tents', R.gains.tent, tt.x, tt.y, best, 0.15);
      }
      case 'fuse': {
        const from = at ?? { x: 0, y: 0 };
        let best: Pair | null = null, bd = Infinity;
        for (const p of this.pairs) {
          if (p.fused >= 0) continue;
          const q = this.pairAt(p);
          const d = Math.hypot(q.x - from.x, q.y - from.y);
          if (d < bd) { bd = d; best = p; }
        }
        if (!best || (at && bd > R.pairReach)) {
          this.emit({ type: 'ripple', x: from.x, y: from.y });
          return false;
        }
        best.fused = 0;
        const q = this.pairAt(best);
        return this.handTask('fuse', R.gains.fuse, q.x, q.y, best.id, 0.14);
      }
      case 'gather': {
        const from = at ?? { x: 0, y: 0 };
        const free = this.wisps.filter(w => w.caught < 0).map(w => ({ w, d: Math.hypot(this.wispAt(w).x - from.x, this.wispAt(w).y - from.y) }));
        free.sort((a, b) => a.d - b.d);
        const pick = free.filter(x => !at || x.d <= R.pullReach).slice(0, at ? R.pullMax : 1);
        if (!pick.length) {
          this.emit({ type: 'ripple', x: from.x, y: from.y });
          return false;
        }
        for (const x of pick) this.catchWisp(x.w);
        this.emit({ type: 'ripple', x: from.x, y: from.y });
        return true;
      }
      case 'pass': {
        const lit = this.figures.map((f, i) => ({ f, i })).filter(x => x.f.state === 'lit');
        const waiting = this.figures.map((f, i) => ({ f, i })).filter(x => x.f.state === 'wait' && x.f.fade >= 0.6);
        if (!lit.length || !waiting.length) {
          const p = at ?? { x: 0, y: 0 };
          this.emit({ type: 'ripple', x: p.x, y: p.y });
          return false;
        }
        const from = at ?? lit[0].f;
        waiting.sort((a, b) => Math.hypot(a.f.x - from.x, a.f.y - from.y) - Math.hypot(b.f.x - from.x, b.f.y - from.y));
        const target = waiting[0];
        let giver = lit[0], gd = Infinity;
        for (const x of lit) {
          const d = Math.hypot(x.f.x - target.f.x, x.f.y - target.f.y);
          if (d < gd) { gd = d; giver = x; }
        }
        target.f.state = 'pass';
        target.f.k = 0;
        target.f.from = giver.i;
        return this.handTask('pass', R.gains.pass, target.f.x, target.f.y, target.i, 0.15);
      }
      default:
        return false;
    }
  }

  /** A task done: its gain into the ring, the event, sometimes Ignacy's word. */
  private handTask(kind: TaskKind | 'poke' | 'trim', base: number, x: number, y: number, target: number, sayChance: number): boolean {
    const gain = this.handGain(base);
    this.add(gain, 'hands');
    this.tasksDone++;
    this.emit({ type: 'task', kind, x, y, gain, target });
    if (kind !== 'poke' && kind !== 'trim' && this.rng() < sayChance) this.talk.ask(TASK_MOMENT[kind] as Moment, 1, 3);
    return true;
  }

  /** The candle: a finger held down (or Space) shelters it from the draught. */
  holdStart(): void {
    if (!this.handsOn || this.task !== 'shield') return;
    this.holding = true;
  }

  holdEnd(): void { this.holding = false; }

  /** The bonfire's pile: a log picked up by the finger (it is the view's to draw until dropped). */
  pickLog(): boolean {
    if (!this.handsOn || this.task !== 'feed' || this.logs <= 0 || this.logInHand || this.changing > 0.6) return false;
    this.logs--;
    this.logInHand = true;
    return true;
  }

  /** The log let go: onto the fire it burns (the gain), elsewhere it goes back to the pile. */
  dropLog(onFire: boolean): boolean {
    if (!this.logInHand) return false;
    this.logInHand = false;
    if (!onFire || !this.handsOn || this.task !== 'feed') {
      this.logs = Math.min(RULES.logs, this.logs + 1);
      return false;
    }
    this.burnLog();
    return true;
  }

  /** A tap on the pile (or Space with logs at hand): the top log goes onto the fire. */
  feedFromPile(): boolean {
    if (!this.handsOn || this.task !== 'feed' || this.logs <= 0 || this.changing > 0.6) return false;
    this.logs--;
    this.burnLog();
    return true;
  }

  private burnLog(): void {
    this.burning.push({ t: RULES.logBurn, x: (this.rng() - 0.5) * 0.3, rot: (this.rng() - 0.5) * 0.9 });
    if (this.burning.length > 4) this.burning.shift();
    this.handTask('feed', RULES.gains.log, 0, 0.2, -1, 0.3);
  }

  /** A drag through the nebula catches the wisps near the finger (units). */
  drag(at: Pt): number {
    if (!this.handsOn || this.task !== 'gather' || this.changing > 0.6) return 0;
    let n = 0;
    for (const w of this.wisps) {
      if (w.caught >= 0) continue;
      const q = this.wispAt(w);
      if (Math.hypot(q.x - at.x, q.y - at.y) <= RULES.catchReach) {
        this.catchWisp(w);
        n++;
      }
    }
    return n;
  }

  /** Space and Enter: a card closes, else the scale's primary action (held at the candle, it shelters). */
  key(key: string, down: boolean): boolean {
    if (key !== ' ' && key !== 'Spacebar' && key !== 'Enter') return false;
    if (!down) {
      if (this.task === 'shield') this.holdEnd();
      return true;
    }
    if (this.card && this.closeCard()) return true;
    if (this.task === 'shield') this.holdStart();
    this.tap(null);
    return true;
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'push' && !b.blind && this.blockT >= this.lead + 2 && this.blockT - dt < this.lead + 2) this.coach('ring', { kind: 'ring' });
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('rest', { kind: 'ring' });
    if (b.kind === 'rest' && this.blockT >= R.bannerSec + 7 && this.blockT - dt < R.bannerSec + 7) this.coach('breath', { kind: 'fire' });
    if (b.kind === 'warmup' && this.blockT >= 12 && this.blockT - dt < 12) this.coach('button', { kind: 'button' });
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - this.finaleSec) {
      this.endBlock();
      this.beginFinale();
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
    this.touchUsed = 0;
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.goodT = 0;
      this.goodSaid = false;
      this.waitT = 0;
      this.veiled = 0;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (b.blind) this.coach('blind', { kind: 'ring' });
      this.coach('blow', { kind: 'fire' });
      // the light banked in rest comes back over the lead-in
      if (this.light > 1e-6) {
        this.pourLeft = this.light;
        this.pour = this.light / Math.max(RULES.pourMin, this.lead);
        this.emit({ type: 'pour', amount: this.light });
        this.coach('light', { kind: 'ring' });
        this.talk.ask('light', 1, 12);
      }
      this.pushN++;
    } else if (b.kind === 'rest') {
      this.holding = false;
      this.calmSaid = false;
      this.talk.ask('rest', 2, 12);
      this.restN++;
    } else {
      this.talk.ask('warm', 1, 14);
      this.coach('blow', { kind: 'fire' });
    }
    this.tip = this.tipFor(b, first);
    this.lastTip = this.tip;
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  /**
   * The strategy under the block's name: in a push, the scene's own imagery (two per fire, in turn) with a
   * counting or recalling one every third push; blind and rest their own; never the same twice running.
   */
  private tipFor(b: Block, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup;
    let pool: readonly string[];
    let n: number;
    if (b.kind === 'push') {
      if (b.blind) { pool = TIPS.blind; n = this.session + this.pushN; }
      else if (first && this.pushesBase === 0) return TIPS.firstPush;
      else if ((this.pushN + this.session) % 3 === 2) { pool = TIPS.count; n = Math.floor((this.pushN + this.session) / 3); }
      else { pool = TIPS.push[RUNGS[this.rung].id]; n = this.pushN + this.session; }
    } else {
      if (first && this.session === 1) return TIPS.firstRest;
      pool = TIPS.rest;
      n = this.restN + this.session;
    }
    let tip = pool[((n % pool.length) + pool.length) % pool.length];
    if (tip === this.lastTip) tip = pool[(n + 1) % pool.length];
    return tip;
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
        // the smoke lifts: the hidden charge pours in (and counts) now
        if (b.blind) {
          const s = this.judge.measured > 0 ? share : 0;
          this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
          const v = this.veiled;
          this.veiled = 0;
          this.emit({ type: 'reveal', amount: v });
          this.talk.ask('reveal', 2, 12);
          this.add(v, 'reveal');
        }
        if (verdict) {
          this.passedPushes++;
          this.emit({ type: 'bonus', amount: RULES.pushBonus });
          this.talk.ask('pushGood', 1, 12);
          this.add(RULES.pushBonus, 'bonus');
        }
        this.ember = false;
      } else {
        if (verdict) {
          this.passedRests++;
          this.embersEarned++;
          this.ember = true;
          this.emit({ type: 'ember' });
          this.talk.ask('restGood', 1, 12);
        }
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  private beginFinale(): void {
    this.phase = 'finale';
    this.blockT = 0;
    this.touchUsed = 0;
    this.holding = false;
    // the light still banked pours in now: the session ends on its glow
    if (this.light > 1e-6) {
      this.pourLeft = this.light;
      this.pour = this.light / 3;
      this.emit({ type: 'pour', amount: this.light });
    }
    this.talk.ask('end', 2, 12);
    this.emit({ type: 'finale' });
  }

  // ── first-time explanations ───────────────────────────────────
  private seen(what: string): boolean { return this.p.seen.includes(what); }
  private see(what: string): void { if (!this.seen(what)) this.p.seen.push(what); }

  private coach(what: Coach, at: CoachAt): void {
    if (this.seen(`c:${what}`)) return;
    this.see(`c:${what}`);
    this.emit({ type: 'coach', what, at });
  }

  // ── the end ─────────────────────────────────────────────────────
  /** Once: the session's counters into the progress, its star into the sky. */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    // light still banked at the very end goes into the ring's picture, never lost (its sparks were counted)
    const p = this.p;
    const score = Math.floor(this.sparks);
    p.total += score;
    const key = lenKey(this.plannedSec);
    p.best[key] = Math.max(p.best[key] ?? 0, score);
    p.bestTop = Math.max(p.bestTop, this.top);
    for (const id of this.reachedNow) p.reached[id] = (p.reached[id] ?? 0) + 1;
    p.changes += this.changesNow;
    p.cycles += this.cyclesNow;
    p.pushes = this.pushesBase + this.pushesBegun;
    p.lastLen = Math.round(this.plannedSec);
    p.sky.push({ n: this.session, top: this.top, sparks: score, day: this.day });
    if (p.sky.length > RULES.skyMax) p.sky.splice(0, p.sky.length - RULES.skyMax);
    this.phase = 'done';
  }

  /** The session ends before its own end: settle as the end would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.card = null;
    this.settle();
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The panel's gauge: the heat in a sighted push past its lead-in, calm in rest; null blind, without signal, elsewhere. */
  meter(): number | null {
    if (!this.started || !this.reliable || this.phase !== 'play') return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.heat);
    if (this.restBlock) return this.blockT < this.restLead ? null : clamp(this.calmShown);
    return null;
  }

  /** The pad follows the heat in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted && this.blockT >= this.lead) return clamp(this.heat);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p, score = Math.floor(this.sparks);
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, score);
      p.bestTop = Math.max(p.bestTop, this.top);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const fast = this.fastestNow;
    const stats: [string, string][] = [
      [t('stat.top'), this.topName(true)],
      [t('stat.changes'), String(this.changesNow)],
      [t('stat.fastest'), fast ? t('sec', { n: Math.round(fast.sec) }) : '—'],
      [t('stat.light'), sparksText(Math.floor(this.lightSparks))],
      [t('stat.hands'), String(this.tasksDone)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    if (this.cyclesNow > 0) stats.splice(2, 0, [t('stat.cycles'), String(this.cyclesNow)]);
    return {
      score, unit: unit(score), record: this.bestBefore !== null && score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /** The highest fire of the session in words ("Gwiazda", "Świeca · krąg 2"); `short` for a tight box. */
  topName(short = false): string {
    const fire = this.top % RULES.rungs, round = Math.floor(this.top / RULES.rungs);
    const name = short ? rungShort(fire) : rungName(fire);
    return round > 0 ? `${name} · ${t('card.cycle', { n: round + 1 })}` : name;
  }

  /**
   * The summary's closing passage: the verse of the session's highest fire (Isaiah 42:3 for a spark …
   * Acts 2:3 for Pentecost); after a long burn (a long session or a long-held fire) Jeremiah 20:9 and the Song
   * of Songs 8:7 take turns with it.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [RUNGS[this.top % RULES.rungs].verse];
    if (this.plannedSec >= RULES.longBurn || this.maxHold >= RULES.longHold) fit.push(...LONG_BURN);
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.started) add(0, t(`hl.close.${RUNGS[this.top % RULES.rungs].id}` as 'hl.close.iskra'));
    const score = Math.floor(this.sparks);
    if (this.bestBefore !== null && score > this.bestBefore) add(1, t('hl.record', { sparks: sparksText(score) }));
    else if (this.bestBefore !== null && score > 0 && this.bestBefore - score <= Math.max(40, this.bestBefore * 0.25)) {
      add(1, t('hl.toBest', { sparks: sparksText(this.bestBefore - score) }));
    }
    if (this.changesNow > 0) add(2, t('hl.top', { name: this.topName() }));
    if (this.cyclesNow > 0) add(2, t('hl.cycle', { n: this.cycle + 1 }));
    for (const key of this.freshForms.slice(1)) {
      const [id, v] = key.split(':');
      const r = RUNGS.findIndex(x => x.id === id);
      if (r >= 0) add(3, t('hl.form', { name: variantName(r, Number(v)) }));
    }
    for (const f of this.newFastest) add(4, t('hl.fastest', { name: rungShort(f.rung), sec: t('sec', { n: Math.round(f.sec) }) }));
    if (this.lightSparks >= 1) add(5, t('hl.light', { sparks: sparksText(Math.floor(this.lightSparks)) }));
    if (this.embersEarned > 0) add(6, t('hl.ember', { n: this.embersEarned }));
    if (this.blindShare >= 0) add(7, t('hl.blind', { n: this.blindShare }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
