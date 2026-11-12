/**
 * Światło ciała's session, without the DOM: a band of light scans a figure from the crown to the soles,
 * stopping at nine organs; at each one a real homeostatic loop is pushed out of its healthy range by an
 * everyday thing (a hot bath, a held breath, the stairs, a meal…) and the body brings it back (content.ts
 * has the physiology and its sources).  The return is drawn as it is — a first-order approach, compressed
 * in time, which the game says.
 *
 *   focus (a sighted push block past its lead-in)   the band's light: the lit organ returns faster
 *                                                    (× 1 + 1.6 × light) and the band travels on faster
 *   rest (the vagus' rest)                           a breath guide in 4 / out 6, the heart slows, the
 *                                                    current organ settles, every lit organ's glow pours
 *                                                    light (lux) with calm
 *   the hands (a tap, the round button, Space)       help the organ in the light (the heart: on the beat;
 *                                                    the lungs: breathe out a CO₂ bubble); while the band
 *                                                    travels, a tap steps it on; in rest, a tap on the
 *                                                    breath's turn
 *
 * A settled organ lights up (soft, bright or golden: quick and in gold light), its Wiedza card opens the
 * first time, and the band moves on; a whole scan sweeps light back up the body and the next scan goes
 * deeper (organs → cells → systems).  The headline is the light gathered, in lux.  Blocks follow the
 * kit's rules: push and rest of 20–30 s with jitter and a 4 s telegraph, each judged once at its end,
 * blind pushes from the third session, a warm-up the first time, a calm finale.  An unreliable signal
 * holds the light at its neutral base — never a loss.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  ORGAN, ORGANS, TIPS, dayOrgan, depthName, linesOf, organName, valOf, type Depth, type Moment, type OrganId,
} from './content';
import { luxText, t, unit } from './i18n';
import {
  bestOf, lenKey, lightMap, markSeen, meetCard, openDeeper, scanDepth, scanStars, type SwiatloProgress,
} from './meta';
import { BREATH, RULES } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

/** The first-time explanations (coach marks) and what each points at. */
export type Coach = 'help' | 'loop' | 'band' | 'card' | 'beat' | 'bubbles' | 'breath' | 'pulse' | 'typical' | 'blind';
export type CoachAt = 'button' | 'panel' | 'band' | 'heart' | 'lungs' | 'chest';

export type StoryKind = 'open' | 'scan';
export interface Story { kind: StoryKind; t: number; scan: number; stars: number; next: Depth | null; deeper: boolean }

/** The Wiedza card on screen (it takes the panel's place). */
export interface Card { organ: OrganId; depth: Depth; t: number; fresh: boolean }

/** An organ's loop while the band is on it. */
export interface Loop {
  organ: OrganId;
  kick: string;
  /** where the value started (base units) */
  v0: number;
  /** the way home: 1 at the start, 0 when the value is inside the balance band */
  s: number;
  /** seconds since the band arrived, and of them in gold light */
  t: number;
  goldT: number;
  /** settled (s reached 0) and how long it has held there */
  settled: boolean;
  inT: number;
  balanced: boolean;
  rating: 0 | 1 | 2 | 3;
  /** after balance: seconds left before the band moves on, and the ease to the set point (0..1) */
  linger: number;
  ease: number;
  taps: number;
}

/** A CO₂ bubble in the lungs' task (u, w: 0..1 across the lungs' box); `pop` > 0 while it floats away. */
export interface Bubble { id: number; u: number; w: number; age: number; pop: number }

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'arrive'; organ: OrganId; kick: string }
  | { type: 'help'; organ: OrganId | null; kind: 'tap' | 'beat' | 'bubble' | 'step'; good: boolean }
  | { type: 'settled'; organ: OrganId }
  | { type: 'balanced'; organ: OrganId; rating: 1 | 2 | 3; lux: number; fresh: boolean; day: boolean }
  | { type: 'scanDone'; scan: number; depth: Depth; stars: number; golden: number; lux: number; deeper: boolean }
  | { type: 'scanStart'; scan: number; depth: Depth }
  | { type: 'beat'; bpm: number; real: boolean }
  | { type: 'breathTurn'; inhale: boolean }
  | { type: 'breathTap'; good: boolean }
  | { type: 'blindEnd'; share: number; lux: number }
  | { type: 'gold'; on: boolean }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'pulse'; bpm: number }
  | { type: 'lux'; n: number; at: 'organ' | 'scan' | 'rhythm' | 'block' | 'rest' }
  | { type: 'card'; organ: OrganId; depth: Depth; fresh: boolean }
  | { type: 'story'; kind: StoryKind }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** Lift blocks shorter than `min` by taking from the longest, keeping the sum. */
function liftShort(durs: number[], min: number): void {
  for (let guard = 0; guard < 20; guard++) {
    const i = durs.findIndex(d => d < min - 1e-9);
    if (i < 0) return;
    const need = min - durs[i];
    let j = 0;
    for (let k = 1; k < durs.length; k++) if (durs[k] > durs[j]) j = k;
    if (durs[j] - need < min) return;
    durs[j] -= need;
    durs[i] = min;
  }
}

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in 3,
 * 6 s in a short test); then Skan / Odpoczynek pairs (24 ± 3 s and 26 ± 3 s, scaled to end on time,
 * jittered only when there is room) ending with a rest, leaving the last stretch at the end.  Any
 * planned length from 10 s gets at least one push and one rest.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const fin = finaleFor(plannedSec);
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * 4, plannedSec - fin);
    if (firstEver) {
      const warm = Math.min(R.warm.test, left / 3), rest = left - warm;
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(4, Math.min(14, left / 2));
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

/** The loop's deviation now (half-ranges, signed): geometric from d0 to the balance edge, then easing home. */
export function loopDev(l: Loop): number {
  const o = ORGAN[l.organ];
  const d0 = o.set === l.v0 ? RULES.balance : (l.v0 >= o.set ? (l.v0 - o.set) / (o.hi - o.set) : -(o.set - l.v0) / (o.set - o.lo));
  const sign = d0 >= 0 ? 1 : -1, B = RULES.balance;
  const mag = Math.abs(d0);
  if (!l.settled) return sign * B * (mag / B) ** clamp(l.s);
  return sign * B * (1 - clamp(l.ease));
}

/** The loop's value now (base units). */
export const loopValue = (l: Loop): number => valOf(ORGAN[l.organ], loopDev(l));

export interface SimInit {
  progress: SwiatloProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
  /** the local hour (0..24) for cortisol's day curve */
  hour: number;
}

export class SwiatloSim {
  readonly p: SwiatloProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly hour: number;
  readonly day: OrganId;
  /** this session's number (1 = the first ever) */
  readonly session: number;
  readonly firstEver: boolean;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  private readonly judge: RoundJudge;
  private readonly lead: number;
  private readonly finaleSec: number;
  private readonly plan: Block[];
  private readonly pushesBase: number;
  private readonly bestBefore: number | null;

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  // the blocks
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  tip = '';
  private pushesBegun = 0;
  private relSec = 0;
  // the scan
  scan = 1;
  depth: Depth = 1;
  scanV: number = RULES.startV;
  /** the next station's index in ORGANS (ORGANS.length: on the way to the feet) */
  station = 0;
  loop: Loop | null = null;
  /** this scan's ratings (0 dark … 3 golden), and the glow drawn for each organ (0..1, eased) */
  lit: Record<OrganId, number>;
  glow: Record<OrganId, number>;
  /** a whole scan's light sweeping back up (1 → 0), and its start time */
  sweep = 0;
  private scanStartT = 0;
  // the light
  light: number = RULES.baseLight;
  calmShown = 0;
  reliable = false;
  private gold = false;
  private goldRun = 0;
  private goodSaid = false;
  private unrelT = 0;
  private noSigSaid = false;
  private idleT = 0;
  private idleSaid = false;
  // the heart and the breath
  pulse: number | null = null;
  beatPhase = 0;
  sinceBeat = 9;
  beatPeriod = 60 / 70;
  breathT = 0;
  private pushHr = { sum: 0, sec: 0 };
  private restHr = { sum: 0, sec: 0 };
  private hrAll = { sum: 0, sec: 0 };
  private slowedBy = 0;
  // the hands
  private fervour = 0;
  private rhythmRun = 0;
  private breathRun = 0;
  bubbles: Bubble[] = [];
  private bubbleT = 0;
  private bubbleId = 0;
  // cards, stories, the voice
  story: Story | null = null;
  card: Card | null = null;
  lux = 0;
  // the session's tallies
  scansDone = 0;
  balancedNow = 0;
  goldenNow = 0;
  private bestScanNow = 0;
  private fastestNow = 0;
  private scanGolden = 0;
  breathsNow = 0;
  private rhythmNow = 0;
  cardsNow: string[] = [];
  private deepestNow: Depth = 1;
  private depthOpened: Depth | null = null;
  private passedRests = 0;
  private blindShare = -1;
  private dayLit = false;
  private reached: OrganId | null = null;
  private settledOnce = false;
  /** rest's light, gathered and shown every few seconds */
  private restAcc = 0;
  private restTick = 0;
  /** the session's counters reached the progress (once) */
  private settled = false;
  /** a coach mark of the runner is on screen until this time (s of play): the voice waits for it */
  hintUntil = 0;
  private readonly events: SimEvent[] = [];

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.eeg = init.eeg;
    this.hour = init.hour;
    this.day = dayOrgan(init.daySeed);
    this.session = this.p.sessions + 1;
    this.firstEver = this.p.sessions === 0;
    this.pushesBase = this.p.pushes;
    this.bestBefore = bestOf(this.p);
    this.judge = RoundJudge.from(init.tuning);
    this.lead = this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.finaleSec = finaleFor(this.plannedSec);
    this.plan = planBlocks(this.plannedSec, this.firstEver, init.rng);
    this.talk = new Talk(m => linesOf(m), init.rng);
    this.lit = Object.fromEntries(ORGANS.map(o => [o, 0])) as Record<OrganId, number>;
    this.glow = Object.fromEntries(ORGANS.map(o => [o, 0])) as Record<OrganId, number>;
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.blockIndex + 1 < this.plan.length ? this.plan[this.blockIndex + 1] : null; }
  get blocks(): readonly Block[] { return this.plan; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return this.phase === 'play' && this.block.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the light answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  get score(): number { return Math.floor(this.lux); }
  get goldOn(): boolean { return this.gold; }
  /** the organs settled in this scan */
  get done(): number { return ORGANS.reduce((n, o) => n + (this.lit[o] > 0 ? 1 : 0), 0); }
  /** the organ the band is on or heading to (null on the way to the feet) */
  get target(): OrganId | null { return this.station < ORGANS.length ? ORGANS[this.station] : null; }
  /** where the band is heading (v) */
  get targetV(): number { const o = this.target; return o ? ORGAN[o].v : RULES.endV; }
  /** the real pulse is known */
  get realPulse(): boolean { return this.pulse !== null; }
  /** the voice must wait: a telegraph, the runner's banner, a card */
  get talkBlocked(): boolean {
    if (this.story || this.card || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec;
  }
  /** the breath guide: 'in' for 4 s, 'out' for 6 s, and how far through the current half (0..1) */
  get breath(): { inhale: boolean; p: number; k: number } {
    const x = ((this.breathT % BREATH) + BREATH) % BREATH;
    const inhale = x < RULES.inhale;
    const p = inhale ? x / RULES.inhale : (x - RULES.inhale) / RULES.exhale;
    // the chest's fullness 0..1: rises on the in-breath, falls on the out-breath (eased)
    const k = inhale ? 0.5 - 0.5 * Math.cos(Math.PI * p) : 0.5 + 0.5 * Math.cos(Math.PI * p);
    return { inhale, p, k };
  }

  /** The heart's rate drawn now: the player's pulse (Mendi), else the heart's loop, else a typical heart that calm slows. */
  heartBpm(): { bpm: number; real: boolean } {
    if (this.pulse !== null) return { bpm: this.pulse, real: true };
    const l = this.loop;
    if (l && l.organ === 'heart' && !l.balanced) return { bpm: loopValue(l), real: false };
    let bpm: number = RULES.typical;
    if (this.restBlock) {
      bpm = RULES.typical - (RULES.typical - RULES.typicalRest) * clamp(this.reliable ? this.calmShown : 0.5);
      // respiratory sinus arrhythmia: faster on the in-breath, slower on the out-breath
      const b = this.breath;
      bpm += b.inhale ? RULES.rsa * Math.sin(Math.PI * b.p) : -RULES.rsa * Math.sin(Math.PI * b.p);
    }
    return { bpm, real: false };
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.depth = scanDepth(this.p, 1);
    this.deepestNow = this.depth;
    this.startBlock(0);
    this.emit({ type: 'scanStart', scan: 1, depth: this.depth });
    if (this.firstEver && markSeen(this.p, 's.open')) {
      this.story = { kind: 'open', t: 0, scan: 0, stars: 0, next: null, deeper: false };
      this.emit({ type: 'story', kind: 'open' });
      this.talk.ask('open', 3, 14);
    } else this.talk.ask(this.firstEver ? 'open' : 'scan', 2, 8);
  }

  /** One frame of play: `hr` = the band's pulse reading this frame (bpm, null: none). */
  update(dt: number, f: FocusFrame, now: number, hr: number | null = null): void {
    if (!this.started || this.phase === 'done') return;
    dt = Math.max(0, Math.min(0.1, dt));
    this.t = now;
    this.reliable = f.reliable && f.activity !== null;
    if (this.reliable) this.relSec += dt;
    this.readPulse(hr, dt);
    if (this.phase === 'play') this.schedule(dt, f, now);
    if (this.phase === 'finale' && now >= this.plannedSec) this.end();
    // end() moved the phase on (TypeScript narrowed it before the calls above)
    if ((this.phase as string) === 'done') return;
    this.updateLight(dt, f);
    this.updateHeart(dt);
    this.updateStoryCard(dt);
    if (!this.story) this.updateScan(dt);
    this.updateBubbles(dt);
    this.updateLux(dt);
    for (const o of ORGANS) this.glow[o] = approach(this.glow[o], this.lit[o] > 0 ? 0.55 + 0.15 * this.lit[o] : 0, dt, 0.5);
    this.sweep = Math.max(0, this.sweep - dt / RULES.sweepSec);
    this.fervour = Math.max(0, this.fervour - RULES.fervourFade * dt);
    this.talk.update(dt, now, this.talkBlocked);
  }

  private readPulse(hr: number | null, dt: number): void {
    const ok = hr !== null && Number.isFinite(hr) && hr >= 30 && hr <= 220;
    if (ok && this.pulse === null) {
      this.emit({ type: 'pulse', bpm: hr! });
      if (!this.p.pulseSeen) {
        this.p.pulseSeen = true;
        this.talk.ask('pulse', 3, 10);
      }
      this.coach('pulse', 'heart');
    }
    this.pulse = ok ? hr : null;
    if (!ok) return;
    this.hrAll.sum += hr! * dt;
    this.hrAll.sec += dt;
    if (this.sighted) { this.pushHr.sum += hr! * dt; this.pushHr.sec += dt; }
    if (this.restBlock && this.blockT >= 8) { this.restHr.sum += hr! * dt; this.restHr.sec += dt; }
  }

  private updateLight(dt: number, f: FocusFrame): void {
    let target: number = RULES.baseLight;
    if (this.restBlock) target = RULES.restLight;
    else if (this.sighted) target = this.reliable ? clamp(f.level) : RULES.baseLight;
    this.light = approach(this.light, target, dt, RULES.lightTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    // gold: the light above the threshold in a sighted push with a signal
    const gold = this.sighted && this.reliable && this.light >= RULES.gold;
    if (gold !== this.gold) {
      this.gold = gold;
      this.emit({ type: 'gold', on: gold });
    }
    this.goldRun = gold ? this.goldRun + dt : 0;
    if (this.goldRun >= RULES.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 5);
    }
    if (this.sighted && this.blockT >= this.lead + 0.5) this.coach('band', 'band');
    // no signal for a while in a push: the sensor, never the player
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
    if (this.unrelT > 3 && !this.noSigSaid) {
      this.noSigSaid = true;
      this.talk.ask('nosignal', 2, 6);
    }
  }

  private updateHeart(dt: number): void {
    const { bpm, real } = this.heartBpm();
    this.beatPeriod = 60 / clamp(bpm, 30, 220);
    this.beatPhase += dt / this.beatPeriod;
    this.sinceBeat += dt;
    if (this.beatPhase >= 1) {
      this.beatPhase -= Math.floor(this.beatPhase);
      this.sinceBeat = 0;
      this.emit({ type: 'beat', bpm, real });
    }
    if (this.restBlock) {
      const before = this.breath.inhale;
      this.breathT += dt;
      const now = this.breath.inhale;
      if (before !== now) this.emit({ type: 'breathTurn', inhale: now });
    }
  }

  private updateStoryCard(dt: number): void {
    const s = this.story;
    if (s) {
      s.t += dt;
      const max = s.kind === 'open' ? RULES.openSec : RULES.storySec;
      if (s.t >= max) this.closeStory();
    }
    const c = this.card;
    if (c) {
      c.t += dt;
      if (c.t >= RULES.cardSec) this.card = null;
    }
  }

  private closeStory(): void {
    const s = this.story;
    if (!s) return;
    this.story = null;
    if (s.kind === 'open') {
      this.coach('help', 'button');
    } else {
      this.talk.ask(s.deeper ? 'depth' : 'scan', 2, 6);
    }
  }

  // ── the scan ───────────────────────────────────────────────────
  private updateScan(dt: number): void {
    const l = this.loop;
    if (l) {
      this.runLoop(l, dt);
      return;
    }
    // travelling: the band glides to the next station (or the feet)
    const speed = this.travelSpeed();
    const goal = this.targetV;
    this.scanV = Math.min(goal, this.scanV + speed * dt);
    if (this.scanV >= goal - 1e-6) {
      if (this.station < ORGANS.length) this.arrive(ORGANS[this.station]);
      else this.scanWhole();
    }
  }

  private travelSpeed(): number {
    if (this.phase !== 'play') return RULES.travel * RULES.travelFree;
    const b = this.block;
    if (b.kind === 'warmup') return RULES.travel * RULES.travelFree;
    // in rest the light drifts on slowly with the breath
    if (b.kind === 'rest') return RULES.travel * 0.5;
    return RULES.travel * (RULES.travelLo + RULES.travelHi * this.light);
  }

  private arrive(o: OrganId): void {
    const spec = ORGAN[o];
    const kick = spec.kicks[(this.scan + this.session + ORGANS.indexOf(o)) % spec.kicks.length];
    this.loop = { organ: o, kick: kick.id, v0: kick.v0, s: 1, t: 0, goldT: 0, settled: false, inT: 0, balanced: false, rating: 0, linger: 0, ease: 0, taps: 0 };
    this.scanV = spec.v;
    this.reached = o;
    // a card still up gives the panel back to the new organ soon
    if (this.card) this.card.t = Math.max(this.card.t, RULES.cardSec - RULES.cardAfterArrive);
    this.bubbles = [];
    this.bubbleT = 0;
    this.emit({ type: 'arrive', organ: o, kick: kick.id });
    if (this.scan === 1 || this.rng() < 0.5) this.talk.ask(`at.${o}` as Moment, 1.5, 6);
    this.coach('loop', 'panel');
    if (spec.task === 'beat') {
      this.coach('beat', 'heart');
      if (this.pulse === null) this.coach('typical', 'heart');
    }
    if (spec.task === 'bubbles') this.coach('bubbles', 'lungs');
  }

  /** The loop's rate home (s per second): the body's own pace × the light in a push, × calm in rest. */
  private loopRate(): number {
    if (this.restBlock) return RULES.k0 * (RULES.restLo + RULES.restHi * (this.reliable ? this.calmShown : 0.5));
    return RULES.k0 * (1 + RULES.lightK * this.light);
  }

  private runLoop(l: Loop, dt: number): void {
    l.t += dt;
    if (this.gold) l.goldT += dt;
    if (!l.settled) {
      l.s = Math.max(0, l.s - this.loopRate() * dt);
      if (l.s <= 0) {
        l.settled = true;
        this.emit({ type: 'settled', organ: l.organ });
      }
      return;
    }
    l.ease = Math.min(1, l.ease + dt / 1.4);
    if (!l.balanced) {
      l.inT += dt;
      if (l.inT >= RULES.holdSec) this.balance(l);
      return;
    }
    l.linger -= dt;
    if (l.linger <= 0) {
      this.loop = null;
      this.station++;
    }
  }

  /** The organ is home: its rating, its light, the map, its card the first time. */
  private balance(l: Loop): void {
    l.balanced = true;
    l.linger = RULES.linger;
    const time = l.t;
    const goldShare = l.t > 0 ? l.goldT / l.t : 0;
    const rating: 1 | 2 | 3 = time <= RULES.goldSec && goldShare >= RULES.goldShare ? 3 : time <= RULES.brightSec ? 2 : 1;
    l.rating = rating;
    this.lit[l.organ] = rating;
    const day = l.organ === this.day;
    const n = Math.round(RULES.luxOrgan[rating - 1] * RULES.depthK[this.depth - 1] * (day ? RULES.dayK : 1));
    this.lux += n;
    if (day) this.dayLit = true;
    this.balancedNow++;
    if (rating === 3) { this.goldenNow++; this.scanGolden++; }
    lightMap(this.p, l.organ, this.depth, rating);
    const fresh = meetCard(this.p, l.organ, this.depth);
    if (fresh) {
      this.cardsNow.push(`${l.organ}:${this.depth}`);
      this.card = { organ: l.organ, depth: this.depth, t: 0, fresh: true };
      // stay with it a little longer, to read it
      l.linger = RULES.lingerCard;
      this.emit({ type: 'card', organ: l.organ, depth: this.depth, fresh: true });
    }
    this.emit({ type: 'balanced', organ: l.organ, rating, lux: n, fresh, day });
    this.emit({ type: 'lux', n, at: 'organ' });
    if (rating === 3) this.talk.ask('golden', 2, 4);
    else if (this.rng() < 0.4) this.talk.ask('balanced', 1, 4);
    if (!this.settledOnce) {
      this.settledOnce = true;
      this.coach('card', 'panel');
    }
  }

  /** The band reached the feet: the whole body in light, the next depth, a short card, a new scan. */
  private scanWhole(): void {
    const stars = scanStars(this.scanGolden);
    const n = Math.round(RULES.luxScan * RULES.depthK[this.depth - 1]);
    this.lux += n;
    this.scansDone++;
    this.bestScanNow = Math.max(this.bestScanNow, this.scanGolden);
    const sec = this.t - this.scanStartT;
    if (sec > 0) this.fastestNow = this.fastestNow > 0 ? Math.min(this.fastestNow, sec) : sec;
    const deeper = openDeeper(this.p, this.depth);
    if (deeper) this.depthOpened = (this.depth + 1) as Depth;
    this.emit({ type: 'scanDone', scan: this.scan, depth: this.depth, stars, golden: this.scanGolden, lux: n, deeper });
    this.emit({ type: 'lux', n, at: 'scan' });
    this.talk.ask('scanDone', 3, 6);
    this.sweep = 1;
    // the next scan
    this.scan++;
    const next = scanDepth(this.p, this.scan);
    const goesDeeper = next > this.depth;
    this.story = { kind: 'scan', t: 0, scan: this.scan - 1, stars, next, deeper: goesDeeper };
    this.emit({ type: 'story', kind: 'scan' });
    this.depth = next;
    if (next > this.deepestNow) this.deepestNow = next;
    this.station = 0;
    this.scanV = RULES.startV;
    this.scanGolden = 0;
    this.scanStartT = this.t;
    for (const o of ORGANS) this.lit[o] = 0;
    this.emit({ type: 'scanStart', scan: this.scan, depth: this.depth });
  }

  private updateBubbles(dt: number): void {
    const l = this.loop;
    for (const b of this.bubbles) {
      b.age += dt;
      if (b.pop > 0) b.pop += dt;
    }
    this.bubbles = this.bubbles.filter(b => b.pop < 1);
    if (!l || l.organ !== 'lungs' || l.settled) return;
    this.bubbleT -= dt;
    const live = this.bubbles.filter(b => b.pop === 0).length;
    if (this.bubbleT <= 0 && live < RULES.bubbles) {
      this.bubbleT = RULES.bubbleSec;
      this.bubbles.push({ id: ++this.bubbleId, u: 0.15 + 0.7 * this.rng(), w: 0.25 + 0.6 * this.rng(), age: 0, pop: 0 });
    }
  }

  private updateLux(dt: number): void {
    if (this.phase !== 'play') {
      this.lux += RULES.luxFree * dt;
      return;
    }
    const b = this.block;
    if (b.kind === 'rest') {
      const calm = this.reliable ? this.calmShown : 0.3;
      const n = RULES.luxRest * (0.3 + calm) * (1 + this.done / ORGANS.length) * dt;
      this.lux += n;
      this.restAcc += n;
      this.restTick += dt;
      if (this.restTick >= 3) {
        const shown = Math.round(this.restAcc);
        if (shown >= 1) this.emit({ type: 'lux', n: shown, at: 'rest' });
        this.restAcc -= shown;
        this.restTick = 0;
      }
    } else if (b.kind === 'push') {
      this.lux += RULES.luxBand * (0.5 + this.light) * dt;
    } else this.lux += RULES.luxFree * dt;
  }

  // ── the hands ──────────────────────────────────────────────────
  /**
   * The round button, a tap on the body, Space: close a story; in rest, a tap on the breath's turn; at an
   * organ, its task (the heart: on the beat; the lungs: breathe out a bubble; else a gentle push home);
   * on the way between organs, a step on.  Returns true when it did something.
   */
  help(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.closeStory();
      return true;
    }
    this.idleT = 0;
    if (this.restBlock) return this.breathTap();
    const l = this.loop;
    const eff = 1 / (1 + RULES.fervourK * this.fervour);
    this.fervour += RULES.fervourAdd;
    if (!l) {
      // a step along the way
      this.scanV = Math.min(this.targetV, this.scanV + 0.012 * eff);
      this.emit({ type: 'help', organ: null, kind: 'step', good: true });
      return true;
    }
    if (l.settled) {
      this.emit({ type: 'help', organ: l.organ, kind: 'tap', good: true });
      return true;
    }
    const task = ORGAN[l.organ].task;
    let k = eff, kind: 'tap' | 'beat' | 'bubble' = 'tap', good = true;
    if (task === 'beat') {
      kind = 'beat';
      const w = RULES.beatWindow * this.beatPeriod;
      good = this.sinceBeat <= w || this.beatPeriod - this.sinceBeat <= w;
      k *= good ? RULES.rhythmK : RULES.offBeatK;
      if (good) {
        this.rhythmRun++;
        this.rhythmNow++;
        this.lux += RULES.luxRhythm;
        if (this.rhythmRun === 4) this.talk.ask('rhythm', 2, 4);
      } else this.rhythmRun = 0;
    } else if (task === 'bubbles') {
      kind = 'bubble';
      const live = this.bubbles.filter(b => b.pop === 0);
      if (live.length) {
        live.sort((a, b) => b.age - a.age);
        live[0].pop = 0.001;
      } else {
        k *= 0.5;
        good = false;
      }
    }
    l.taps++;
    l.s = Math.max(0, l.s - RULES.tapK * k);
    this.emit({ type: 'help', organ: l.organ, kind, good });
    return true;
  }

  /** A tap in rest: on a turn of the breath (within its window) it is "with the breath". */
  private breathTap(): boolean {
    const x = ((this.breathT % BREATH) + BREATH) % BREATH;
    const dist = Math.min(x, Math.abs(x - RULES.inhale), BREATH - x);
    const good = dist <= RULES.breathWindow;
    if (good) {
      this.breathRun++;
      this.breathsNow++;
      this.lux += RULES.luxRhythm;
      if (this.breathRun === 3) this.talk.ask('breath', 1.5, 4);
    } else this.breathRun = 0;
    this.emit({ type: 'breathTap', good });
    return true;
  }

  /** The panel (or Enter): open the current organ's card — and stay with it a little longer — or close the card. */
  tapPanel(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) return this.help();
    if (this.card) {
      this.card = null;
      return true;
    }
    const o = this.loop?.organ ?? this.reached ?? 'brain';
    this.card = { organ: o, depth: this.depth, t: 0, fresh: false };
    if (this.loop?.balanced) this.loop.linger = Math.min(RULES.stayMax, this.loop.linger + RULES.stay);
    this.emit({ type: 'card', organ: o, depth: this.depth, fresh: false });
    return true;
  }

  /**
   * A tap on the figure helps the organ in the light — wherever it lands, so a finger never opens a card
   * by mistake; only the organ in the band, once it has settled, opens its card and keeps the band there
   * (stay with it and read), as a tap on its panel does.
   */
  tapOrgan(o: OrganId | null): boolean {
    const l = this.loop;
    if (o && l && o === l.organ && l.settled && !this.story && !this.card) return this.tapPanel();
    return this.help();
  }

  /** Keys during play: Space helps, Enter opens or closes the card. */
  key(key: string, down: boolean): boolean {
    if (key === ' ' || key === 'Spacebar') {
      if (down) this.help();
      return true;
    }
    if (key === 'Enter') {
      if (down) this.tapPanel();
      return true;
    }
    return false;
  }

  // ── the blocks ─────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, now: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('breath', 'chest');
    if (b.kind === 'push') {
      this.idleT += dt;
      if (this.session <= 2 && this.idleT > 14 && !this.idleSaid && !this.gold) {
        this.idleSaid = true;
        this.talk.ask('idle', 1, 5);
      }
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || now >= this.plannedSec - this.finaleSec) {
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
    this.goodSaid = false;
    this.noSigSaid = false;
    this.idleSaid = false;
    this.idleT = 0;
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (b.blind) this.coach('blind', 'band');
    } else if (b.kind === 'rest') {
      this.breathT = 0;
      this.restHr = { sum: 0, sec: 0 };
      // the guide's first in-breath begins with the block
      this.emit({ type: 'breathTurn', inhale: true });
      this.talk.ask('rest', 2, 12);
    } else this.talk.ask('warm', 1, 12);
    if (b.kind === 'push') this.pushHr = { sum: 0, sec: 0 };
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return t(TIPS.warmup[0]);
    if (b.kind === 'push') {
      if (b.blind) return t(TIPS.blind[(this.session + i) % TIPS.blind.length]);
      if (first && this.pushesBase === 0) return t(TIPS.firstPush);
      return t(TIPS.push[(this.session - 1 + i) % TIPS.push.length]);
    }
    if (first && this.session === 1) return t(TIPS.firstRest);
    return t(TIPS.rest[(this.session - 1 + i) % TIPS.rest.length]);
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'warmup') {
      share = this.judge.share;
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = this.judge.measured > 0 ? share : 0;
        const n = Math.round(RULES.luxBlind * s);
        this.lux += n;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.emit({ type: 'blindEnd', share: s, lux: n });
        this.talk.ask('blindEnd', 2, 6);
      } else if (verdict === true) {
        this.lux += RULES.luxBlock;
        this.emit({ type: 'lux', n: RULES.luxBlock, at: 'block' });
      }
      if (b.kind === 'rest') {
        if (verdict) this.passedRests++;
        const push = this.pushHr.sec >= 5 ? this.pushHr.sum / this.pushHr.sec : null;
        const rest = this.restHr.sec >= 5 ? this.restHr.sum / this.restHr.sec : null;
        if (push !== null && rest !== null && push - rest >= 3) {
          this.slowedBy = Math.max(this.slowedBy, Math.round(push - rest));
          this.talk.ask('slower', 2, 6);
        }
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share });
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.telegraphed = false;
    this.emit({ type: 'finale' });
    this.talk.ask('end', 3, 10);
  }

  private end(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
    this.emit({ type: 'done' });
  }

  /** The session's counters reach the progress once (at the end, or early with finish()). */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const p = this.p;
    p.sessions++;
    p.pushes += this.pushesBegun;
    p.scans += this.scansDone;
    p.balanced += this.balancedNow;
    p.golden += this.goldenNow;
    p.bestScan = Math.max(p.bestScan, this.bestScanNow);
    if (this.fastestNow > 0) p.fastest = p.fastest > 0 ? Math.min(p.fastest, this.fastestNow) : this.fastestNow;
    p.breaths += this.breathsNow;
    p.lastLen = this.plannedSec;
  }

  /** Ended early ("Zakończ i zapisz", the overtime limit): settle at once. */
  finish(): void {
    this.end();
  }

  // ── coach marks ────────────────────────────────────────────────
  private coach(what: Coach, at: CoachAt): void {
    if (!markSeen(this.p, `c.${what}`)) return;
    this.emit({ type: 'coach', what, at });
  }

  // ── output ─────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The panel's gauge: the band's light in a sighted push, calm in rest; null blind, without a signal, elsewhere. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.light);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the light in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.light);
    return null;
  }

  /** The song's level: the focus in a sighted push, a gentle fixed level in rest and around, nothing in a blind block. */
  songLevel(f: FocusFrame): number | null {
    if (!this.started) return null;
    if (this.phase !== 'play') return 0.4;
    if (this.blind) return null;
    if (this.restBlock) return 0.32;
    if (this.sighted) return f.reliable ? clamp(f.level) : null;
    return 0.4;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The mean real pulse of the session (null without a reading). */
  get meanPulse(): number | null {
    return this.hrAll.sec >= 5 ? Math.round(this.hrAll.sum / this.hrAll.sec) : null;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reached the progress once, in settle(). */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const hr = this.meanPulse;
    const stats: [string, string][] = [
      [t('stat.scans'), String(this.scansDone)],
      [t('stat.balanced'), String(this.balancedNow)],
      [t('stat.golden'), String(this.goldenNow)],
      [t('stat.depth'), depthName(this.deepestNow)],
      [t('stat.cards'), `${p.cards.length}/${ORGANS.length * 3}`],
      [t('stat.pulse'), hr === null ? '—' : `${hr}/min`],
      [t('stat.breaths'), String(this.breathsNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session (DESIGN §13.5):
   * the first session (Psalm 139:13-14, "fearfully and wonderfully made"), a scan with many golden organs
   * (1 Corinthians 6:19-20, the body a temple), calm rests (Proverbs 3:7-8, health to the body), new
   * Wiedza cards (Proverbs 4:20-22, attention and health), the bones lit (Proverbs 16:24); else Psalm 139.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('psa139.13-14');
    if (this.bestScanNow >= 4) fit.push('1co6.19-20');
    if (this.passedRests > 0 || this.slowedBy > 0) fit.push('pro3.7-8');
    if (this.cardsNow.length > 0) fit.push('pro4.20-22');
    if (this.lit.bone > 0 || this.scansDone > 0) fit.push('pro16.24');
    fit.push('psa139.13-14');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.scansDone > 0) add(0, t('hl.close.scan', { scans: t('scans', { n: this.scansDone }) }));
    else if (this.reached) add(0, t('hl.close.part', { organ: organName(this.reached) }));
    else if (this.started) add(0, t('hl.close.calm'));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(1, t('hl.record', { lux: luxText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore - this.score <= Math.max(60, this.bestBefore * 0.25)) {
      add(1, t('hl.toBest', { lux: luxText(this.bestBefore - this.score) }));
    }
    if (this.depthOpened) add(2, t('hl.depth', { depth: depthName(this.depthOpened) }));
    if (this.cardsNow.length === 1) {
      const [o, d] = this.cardsNow[0].split(':');
      add(3, t('hl.card', { organ: organName(o as OrganId), depth: depthName(Number(d) as Depth) }));
    } else if (this.cardsNow.length > 1) add(3, t('hl.cards', { n: this.cardsNow.length }));
    if (this.goldenNow > 0) add(4, t('hl.golden', { n: this.goldenNow }));
    if (this.slowedBy > 0) add(5, t('hl.slower', { n: this.slowedBy }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { pct: t('pct', { n: this.blindShare }) }));
    if (this.dayLit) add(7, t('hl.day', { organ: organName(this.day) }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
