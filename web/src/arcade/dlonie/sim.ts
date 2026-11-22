/**
 * Światło w dłoniach's session, without the DOM (DESIGN.md §18).  A session holds several prayers (its length decides
 * how many: rules.ts `prayersFor`); each walks six steps, and each step is a block of the block design:
 *
 *   rub      free, a short timer: the hands rub their palms
 *   breathe  rest, whole breaths: the hands move apart on the in-breath, closer on the out-breath
 *   ball     push: the spark appears in the lead-in; past it, held focus grows the ball at (growBase + growLevel × level
 *            + growHold × hold/holdFull) / need a second; without focus it waits — the growth never goes back
 *   name     rest, one whole breath: the ball takes the name of the one prayed for
 *   offer    push: held focus lifts the ball up like incense into the soft light at the top (or carries it to the sore
 *            place on a small figure, for oneself or a name with a place); then it blooms (or rests there)
 *   rest     rest, whole breaths: the hands open and still, this prayer's passage; the last one stretches to the finale
 *
 * `need` (focused seconds at a multiplier of 1) is set at each prayer's start from the time left and the prayers left,
 * so an average player's arc ends near the session's end, whatever its length (3–30 min).  The shown growth follows the
 * real one through a 10 s moving average of its rate (one breath at six a minute): the 0.1 Hz Mayer wave the paced
 * breath strengthens never makes the light "breathe".  A push that cannot finish ends after maxPush (a rest of whole
 * breaths, then the same step again).  Every 3rd ball push from the 3rd session is blind (the hands close over the
 * ball; it grows unseen and is shown at the end).  The hands choose whom (◀ ▶ ≡) and where a hand rests (a tap on the
 * small figure) — they never grow anything.  Blocks are judged once at their end over their last ≤ 15 s.
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathCycle, type BreathPattern, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp, ease } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  CLOSING, LAY_VERSES, LIFT_VERSES, ROOT, STEP_SIGNAL, isPlace, tallyOf,
  type Coach, type HurtPlace, type Moment, type StepId, type Tally, type Who,
} from './content';
import { flameText, linesOf, placeName, t, unit, whoName } from './i18n';
import { bestOf, breathOf, lenKey, markSeen, placeOf, walkOf, type DlonieProgress } from './meta';
import { RULES, breathsFor, finaleFor, prayersFor } from './rules';
import { Talk } from './talk';

export type BlockKind = 'free' | 'push' | 'rest';
export interface Block { kind: BlockKind; step: StepId; dur: number; blind: boolean; t0: number; end?: number; verdict?: boolean | null }

export type Via = 'start' | 'prev' | 'next' | 'pick';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'step'; step: StepId }
  | { type: 'telegraph'; next: BlockKind }
  | { type: 'spark' }
  | { type: 'tick'; k: number; what: 'grow' | 'rise' }
  | { type: 'grown' }
  | { type: 'named' }
  | { type: 'offered'; lay: boolean; place: HurtPlace | null; tally: Tally }
  | { type: 'gold'; on: boolean }
  | { type: 'growing'; on: boolean }
  | { type: 'breath'; phase: BreathState['phase'] }
  | { type: 'flames'; n: number; at: 'grow' | 'rest' | 'block' | 'prayer' }
  | { type: 'blindEnd'; share: number; n: number }
  | { type: 'coach'; what: Coach }
  | { type: 'story'; open: boolean }
  | { type: 'picker'; open: boolean }
  | { type: 'who'; via: Via }
  | { type: 'place'; place: HurtPlace }
  | { type: 'stay' }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The growth multiplier for a focus frame: faster with the level and with a sustained hold. */
export function growMult(f: Pick<FocusFrame, 'level' | 'hold'>): number {
  return RULES.growBase + RULES.growLevel * clamp(f.level) + RULES.growHold * Math.min(1, Math.max(0, f.hold) / RULES.holdFull);
}

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/**
 * The shown growth: follows the real one (monotonic) through a moving average of its rate over `win` seconds, never
 * past it and never back.  A box of one breath period at six a minute nulls the 0.1 Hz wave exactly.
 */
export class Smooth {
  shown = 0;
  private readonly buckets: number[];
  private readonly bucketSec: number;
  private acc = 0;
  private accT = 0;
  private sum = 0;
  private head = 0;

  constructor(readonly win: number = RULES.smoothSec, n = 40) {
    this.buckets = new Array(n).fill(0);
    this.bucketSec = win / n;
  }

  reset(to = 0): void {
    this.shown = to;
    this.buckets.fill(0);
    this.sum = 0;
    this.acc = 0;
    this.accT = 0;
  }

  /** One frame: `dg` the real growth this frame, `real` where it is now; `whole` lets the shown catch up quickly. */
  step(dt: number, dg: number, real: number, whole = false): number {
    this.acc += dg;
    this.accT += dt;
    while (this.accT >= this.bucketSec) {
      this.head = (this.head + 1) % this.buckets.length;
      this.sum += this.acc - this.buckets[this.head];
      this.buckets[this.head] = this.acc;
      this.acc = 0;
      this.accT -= this.bucketSec;
    }
    const rate = Math.max(0, this.sum) / this.win;
    let next = this.shown + rate * dt;
    if (whole) next = Math.max(next, approach(this.shown, real, dt, RULES.catchTau));
    this.shown = Math.min(real, Math.max(this.shown, next));
    if (whole && real - this.shown < 0.002) this.shown = real;
    return this.shown;
  }
}

export interface SimInit {
  progress: DlonieProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** the player has a mouse, not a finger */
  mouse?: boolean;
}

export class DlonieSim {
  readonly p: DlonieProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly session: number;
  readonly firstEver: boolean;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  readonly planned: number;
  readonly breaths: { breathe: number; name: number; rest: number };
  readonly pattern: BreathPattern;
  readonly cycle: number;
  private readonly judge: RoundJudge;
  private readonly lead: number;
  readonly finaleSec: number;
  private readonly ballsBase: number;
  private readonly bestBefore: number | null;

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  readonly blocks: Block[] = [];
  /** the step now, its seconds, and its length (Infinity for a push) */
  step: StepId = 'rub';
  stepT = 0;
  stepDur: number = RULES.rubFirst;
  /** the step a wait returns to */
  private after: StepId = 'ball';
  telegraphed = false;
  tip = '';
  /** prayers begun this session (1-based for the one now) */
  n = 0;
  /** the one prayed for now, and where in the walk */
  who: Who = { kind: 'dear', i: 0 };
  whoAt = 0;
  /** the real growth of the ball and the rise of the offering (0..1, never back), and what is shown */
  grow = 0;
  rise = 0;
  readonly growS = new Smooth();
  readonly riseS = new Smooth();
  /** a blind push's hidden growth; the reveal of it */
  hidden = 0;
  reveal = { from: 0, to: 0, t: -1 };
  /** focused seconds at a multiplier of 1 each push of this prayer needs */
  need: number = RULES.needMin;
  /** the time the naming of this prayer began (the view's glow) */
  namedAt = -1;
  /** the prayers offered this session, in order */
  readonly offered: { tally: Tally; lay: boolean; place: HurtPlace | null }[] = [];
  private ballsBegun = 0;
  private relSec = 0;
  private tickK = 0;
  // the light and the signal
  light = 0.45;
  calmShown = 0;
  reliable = false;
  growing = false;
  mult = 1;
  private gold = false;
  private goldRun = 0;
  private goodSaid = false;
  private stillRun = 0;
  private stillSaid = false;
  private unrelT = 0;
  private noSigSaid = false;
  /** the breath clock (restarts at each rest step's start, so a rest is whole breaths from an in-breath) */
  breathT = 0;
  private lastPhase: BreathState['phase'] | null = null;
  // cards and the hands
  story: { t: number } | null = null;
  picker = false;
  private pickerT = 0;
  reshow = 0;
  /** a coach mark of the runner is on screen until this time (s of play): the narrator waits */
  hintUntil = 0;
  // flames and the tallies
  flames = 0;
  private flameAcc = 0;
  private flameTick = 0;
  growSec = 0;
  calmSec = 0;
  private passedRests = 0;
  private blindShare = -1;
  private settled = false;
  /** the passage of the rest now (chosen when the offering completes) */
  verse: PassageId = ROOT;
  private readonly events: SimEvent[] = [];

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.eeg = init.eeg;
    this.session = this.p.sessions + 1;
    this.firstEver = this.p.sessions === 0;
    this.ballsBase = this.p.balls;
    this.bestBefore = bestOf(this.p);
    this.judge = RoundJudge.from(init.tuning);
    this.lead = this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.finaleSec = finaleFor(this.plannedSec);
    this.planned = prayersFor(this.plannedSec);
    this.breaths = breathsFor(this.plannedSec);
    this.pattern = breathOf(this.p.breath);
    this.cycle = breathCycle(this.pattern);
    this.talk = new Talk(m => linesOf(m, init.mouse === true), init.rng);
    const walk = walkOf(this.p);
    this.whoAt = Math.min(walk.length - 1, Math.max(0, this.p.walk));
    this.who = walk[this.whoAt];
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block { return this.blocks[this.blocks.length - 1] ?? { kind: 'free', step: 'rub', dur: 0, blind: false, t0: 0 }; }
  get kind(): BlockKind { const s = STEP_SIGNAL[this.step]; return s === 'focus' ? 'push' : s === 'rest' ? 'rest' : 'free'; }
  get pushBlock(): boolean { return this.phase === 'play' && !this.story && this.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && !this.story && this.kind === 'rest'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the light answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.stepT >= this.lead; }
  get leadIn(): number { return this.lead; }
  get score(): number { return Math.floor(this.flames); }
  get goldOn(): boolean { return this.gold; }
  /** the place a hand is laid on in this prayer (null: the prayer is lifted up) */
  get place(): HurtPlace | null { return placeOf(this.p, this.who); }
  get lay(): boolean { return this.place !== null; }
  get whoText(): string { return whoName(this.p, this.who); }
  /** the breath now: in a rest it counts from the rest's start; in a push it runs on (a gentle guide) */
  get breath(): BreathState { return breathAt(this.pattern, this.breathT); }
  /** the narrator must wait: a telegraph, the runner's banner, the opening card, the picker, a coach mark */
  get talkBlocked(): boolean {
    if (this.story || this.picker || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.stepT < RULES.bannerSec;
  }
  /** the spark is there (the ball step has begun, or anything grown) */
  get sparkOn(): boolean { return this.grow > 0 || this.step === 'ball' || this.step === 'name' || this.step === 'offer' || (this.step === 'wait' && this.after !== 'ball') || this.hidden > 0; }
  /** the offering is done (blooming or resting) this prayer */
  get offeredNow(): boolean { return this.rise >= 1; }
  /** the growth shown: the smoothed growth (or the reveal of a blind push) */
  get growShown(): number { return this.growS.shown; }
  get riseShown(): number { return this.riseS.shown; }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    const c = this.p.carry;
    this.beginPrayer(c);
    if (this.firstEver && markSeen(this.p, 's.open')) {
      this.story = { t: 0 };
      this.emit({ type: 'story', open: true });
      this.talk.ask('open', 3, 40);
    } else this.talk.ask(c ? 'resume' : 'rub', 2, 12);
  }

  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started || this.phase === 'done') return;
    dt = Math.max(0, Math.min(0.1, dt));
    this.t = now;
    this.reliable = f.reliable && f.activity !== null;
    if (this.reliable) this.relSec += dt;
    if (this.phase === 'play' && now >= this.plannedSec - this.finaleSec) this.beginFinale();
    if (this.phase === 'finale' && now >= this.plannedSec) this.end();
    if ((this.phase as string) === 'done') return;
    this.updateStory(dt);
    if (this.phase === 'play' && !this.story) this.schedule(dt, f);
    this.updateLight(dt, f);
    this.updateBreath(dt);
    this.updateFlames(dt);
    this.reshow = Math.max(0, this.reshow - dt);
    if (this.picker) {
      this.pickerT += dt;
      if (this.pickerT >= RULES.pickerIdle) this.closePicker();
    }
    this.talk.update(dt, now, this.talkBlocked);
  }

  private updateStory(dt: number): void {
    if (!this.story) return;
    this.story.t += dt;
    if (this.story.t >= RULES.pageSec) this.closeStory();
  }

  private closeStory(): void {
    if (!this.story) return;
    this.story = null;
    this.emit({ type: 'story', open: false });
    // the rub's block begins now (it waited under the card)
    this.stepT = 0;
    this.talk.ask('rub', 2, 10);
    this.coach('rub');
  }

  private updateLight(dt: number, f: FocusFrame): void {
    let target = 0.45;
    if (this.restBlock) target = 0.3;
    else if (this.sighted && this.reliable) target = clamp(f.level);
    this.light = approach(this.light, target, dt, 0.8);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    if (this.restBlock && this.reliable && f.calm >= 0.5) this.calmSec += dt;
    const gold = this.sighted && this.reliable && f.focused;
    if (gold !== this.gold) {
      this.gold = gold;
      this.emit({ type: 'gold', on: gold });
    }
    this.goldRun = gold ? this.goldRun + dt : 0;
    if (this.goldRun >= RULES.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 5);
    }
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
    if (this.unrelT > 3 && !this.noSigSaid) {
      this.noSigSaid = true;
      this.talk.ask('nosignal', 3, 8);
    }
  }

  private updateBreath(dt: number): void {
    if (this.story || this.phase === 'done') return;
    this.breathT += dt;
    if (!this.restBlock) {
      this.lastPhase = null;
      return;
    }
    const ph = this.breath.phase;
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      this.emit({ type: 'breath', phase: ph });
    }
  }

  // ── the prayers ────────────────────────────────────────────────
  /** A new prayer (or the one the last session left): its steps begin with the rub. */
  private beginPrayer(carry: { grow: number; rise: number } | null = null): void {
    this.n++;
    this.grow = carry ? clamp(carry.grow) : 0;
    this.rise = carry ? clamp(carry.rise) : 0;
    if (this.rise > 0) this.grow = 1;
    this.growS.reset(this.grow);
    this.riseS.reset(this.rise);
    this.hidden = 0;
    this.reveal.t = -1;
    this.namedAt = -1;
    this.need = this.planNeed();
    this.beginStep('rub', this.n === 1 ? RULES.rubFirst : RULES.rubLater);
  }

  /** Seconds a whole prayer takes besides its two pushes (the rub and the rests of whole breaths). */
  fixedSec(first = false): number {
    const b = this.breaths;
    return (first ? RULES.rubFirst : RULES.rubLater) + (b.breathe + b.name + b.rest) * this.cycle;
  }

  /** The focused seconds (at ×1) each push of this prayer needs: the time left shared by the prayers left. */
  private planNeed(): number {
    const left = Math.max(0, this.plannedSec - this.finaleSec - this.t);
    const prayersLeft = Math.max(1, this.planned - (this.n - 1));
    const per = left / prayersLeft;
    const pushSec = Math.max(RULES.minPush, (per - this.fixedSec(this.n === 1)) / 2);
    return clamp((pushSec - this.lead) * RULES.expect, RULES.needMin, RULES.needMax);
  }

  /** Whether another whole prayer still fits before the finale (a strong player's extra one, or the plan's next). */
  private fitsAnother(): boolean {
    const left = this.plannedSec - this.finaleSec - this.t;
    return left >= this.fixedSec(false) + 2 * (this.lead + RULES.needMin / (RULES.growBase + RULES.growLevel));
  }

  private beginStep(step: StepId, dur: number): void {
    const kind: BlockKind = STEP_SIGNAL[step] === 'focus' ? 'push' : STEP_SIGNAL[step] === 'rest' ? 'rest' : 'free';
    if (this.blocks.length) this.endBlock();
    this.step = step;
    this.stepT = 0;
    this.stepDur = dur;
    this.telegraphed = false;
    this.relSec = 0;
    this.judge.reset();
    this.goodSaid = false;
    this.noSigSaid = false;
    this.stillSaid = false;
    this.stillRun = 0;
    const b: Block = { kind, step, dur, blind: false, t0: this.t };
    if (kind === 'rest') {
      this.breathT = 0;
      this.lastPhase = null;
    }
    if (step === 'ball') {
      this.ballsBegun++;
      const first = this.ballsBegun === 1;
      b.blind = this.session >= RULES.blindFrom && !first && (this.ballsBase + this.ballsBegun) % RULES.blindEvery === 0 && this.grow < 0.5;
      this.hidden = 0;
      this.growS.reset(this.grow);
      this.tickK = Math.floor(this.grow * 10 + 1e-9);
      this.emit({ type: 'spark' });
      this.talk.ask(b.blind ? 'blind' : 'spark', 2, 10);
      this.coach(b.blind ? 'blind' : 'ball');
    } else if (step === 'offer') {
      this.riseS.reset(this.rise);
      this.tickK = Math.floor(this.rise * 10 + 1e-9);
      this.talk.ask(this.lay ? 'lay' : 'lift', 2, 10);
      this.coach(this.lay ? 'lay' : 'offer');
    } else if (step === 'breathe') {
      this.talk.ask('breathe', 2, 10);
      this.coach('breathe');
    } else if (step === 'name') {
      this.namedAt = this.t;
      this.emit({ type: 'named' });
      this.talk.ask('named', 2, 8);
      this.coach('who');
    } else if (step === 'rest') {
      this.talk.ask('rest', 1, 12);
    } else if (step === 'wait') {
      this.talk.ask('valve', 3, 8);
    }
    this.blocks.push(b);
    this.tip = this.tipFor(b);
    this.emit({ type: 'step', step });
    this.emit({ type: 'blockStart', block: b, index: this.blocks.length - 1 });
  }

  /** The whole breaths of a rest of `cycles`. */
  private restOf(cycles: number): number { return Math.max(1, Math.round(cycles)) * this.cycle; }

  private schedule(dt: number, f: FocusFrame): void {
    this.stepT += dt;
    const kind = this.kind;
    if (kind !== 'free') {
      const want = kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.stepT, dt);
    }
    switch (this.step) {
      case 'rub':
        if (!this.telegraphed && this.stepT >= this.stepDur - 2) this.telegraph('rest');
        if (this.stepT >= this.stepDur) this.beginStep('breathe', this.restOf(this.breaths.breathe));
        break;
      case 'breathe':
        this.telegraphAt(this.stepDur - RULES.telegraph, 'push');
        if (this.stepT >= this.stepDur) {
          if (this.grow >= 1) this.beginStep('name', this.restOf(this.breaths.name));
          else this.beginStep('ball', Infinity);
        }
        break;
      case 'ball':
        this.growBall(dt, f);
        break;
      case 'name':
        this.updateReveal(dt);
        this.telegraphAt(this.stepDur - RULES.telegraph, 'push');
        if (this.stepT >= this.stepDur && this.reveal.t < 0) this.beginStep('offer', Infinity);
        break;
      case 'offer':
        this.lift(dt, f);
        break;
      case 'rest':
        this.restOn();
        break;
      case 'wait':
        this.updateReveal(dt);
        this.telegraphAt(this.stepDur - RULES.telegraph, 'push');
        if (this.stepT >= this.stepDur && this.reveal.t < 0) {
          if (this.after === 'ball' && this.grow >= 1) this.beginStep('name', this.restOf(this.breaths.name));
          else this.beginStep(this.after, Infinity);
        }
        break;
    }
  }

  private telegraphAt(at: number, next: BlockKind): void {
    if (!this.telegraphed && this.stepDur > RULES.telegraph + 2 && this.stepT >= at) this.telegraph(next);
  }

  private telegraph(next: BlockKind): void {
    this.telegraphed = true;
    this.emit({ type: 'telegraph', next });
  }

  /** The growth this frame for a focus frame (0 without focus, before the lead-in, blind or not). */
  growRate(f: FocusFrame): number {
    if (!this.pushBlock || this.stepT < this.lead || !this.reliable || !f.focused || this.picker) return 0;
    return growMult(f) / this.need;
  }

  private setGrowing(on: boolean): void {
    if (on === this.growing) return;
    this.growing = on;
    this.emit({ type: 'growing', on });
  }

  private growBall(dt: number, f: FocusFrame): void {
    const b = this.block;
    const rate = this.growRate(f);
    this.setGrowing(rate > 0);
    this.watchStill(dt, f);
    let dg = 0;
    if (rate > 0) {
      this.mult = growMult(f);
      this.growSec += dt;
      if (b.blind) this.hidden = Math.min(1 - this.grow, this.hidden + rate * dt);
      else {
        dg = Math.min(1 - this.grow, rate * dt);
        this.grow += dg;
        this.addFlames(RULES.flameGrow * this.mult * dt);
      }
    }
    const whole = this.grow >= 1 - 1e-9;
    if (whole) this.grow = 1;
    this.growS.step(dt, dg, this.grow, whole);
    this.ticks(this.growS.shown, 'grow');
    const done = b.blind ? this.grow + this.hidden >= 1 - 1e-9 : whole && this.growS.shown >= 1;
    if (!this.telegraphed) {
      const soon = (b.blind ? this.grow + this.hidden : this.grow) >= RULES.announceAt && this.stepT >= RULES.minPush - RULES.telegraph;
      if (soon || this.stepT >= RULES.maxPush - RULES.telegraph) this.telegraph('rest');
    }
    if (done && this.stepT >= RULES.minPush) {
      if (b.blind) this.revealBlind();
      else {
        this.emit({ type: 'grown' });
        this.talk.ask('grown', 2, 6);
      }
      this.setGrowing(false);
      this.beginStep('name', this.restOf(this.breaths.name));
    } else if (this.stepT >= RULES.maxPush) {
      if (b.blind) this.revealBlind();
      this.setGrowing(false);
      this.after = 'ball';
      this.beginStep('wait', this.restOf(RULES.waitBreaths));
    }
  }

  /** A blind push's growth is shown: the hands open on what grew. */
  private revealBlind(): void {
    const b = this.block;
    const s = this.judge.measured > 0 ? this.judge.share : 0;
    const n = Math.round(RULES.flameBlind * s);
    this.flames += n;
    this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
    this.emit({ type: 'blindEnd', share: s, n });
    this.talk.ask('blindEnd', 2, 6);
    if (this.hidden > 0) {
      const to = Math.min(1, this.grow + this.hidden);
      this.reveal = { from: this.growS.shown, to, t: 0 };
      this.grow = to;
      this.hidden = 0;
    }
    b.blind = true;
  }

  /** The reveal of a blind push's growth (in the step after it). */
  private updateReveal(dt: number): void {
    const r = this.reveal;
    if (r.t < 0) return;
    r.t += dt;
    const k = ease.outCubic(clamp(r.t / RULES.revealSec));
    this.growS.shown = r.from + (r.to - r.from) * k;
    if (r.t >= RULES.revealSec) {
      this.growS.reset(r.to);
      r.t = -1;
      if (r.to >= 1) this.emit({ type: 'grown' });
    }
  }

  private lift(dt: number, f: FocusFrame): void {
    const rate = this.growRate(f);
    this.setGrowing(rate > 0);
    this.watchStill(dt, f);
    let dr = 0;
    if (rate > 0) {
      this.mult = growMult(f);
      this.growSec += dt;
      dr = Math.min(1 - this.rise, rate * dt);
      this.rise += dr;
      this.addFlames(RULES.flameGrow * this.mult * dt);
    }
    const whole = this.rise >= 1 - 1e-9;
    if (whole) this.rise = 1;
    this.riseS.step(dt, dr, this.rise, whole);
    this.ticks(this.riseS.shown, 'rise');
    if (!this.telegraphed) {
      const soon = this.rise >= RULES.announceAt && this.stepT >= RULES.minPush - RULES.telegraph;
      if (soon || this.stepT >= RULES.maxPush - RULES.telegraph) this.telegraph('rest');
    }
    if (whole && this.riseS.shown >= 1 && this.stepT >= RULES.minPush) {
      this.setGrowing(false);
      this.complete();
    } else if (this.stepT >= RULES.maxPush) {
      this.setGrowing(false);
      this.after = 'offer';
      this.beginStep('wait', this.restOf(RULES.waitBreaths));
    }
  }

  /** The prayer is offered: lifted into the light, or laid where it hurts; the rest of whole breaths follows. */
  private complete(): void {
    const lay = this.lay;
    const tally = tallyOf(this.who.kind);
    this.offered.push({ tally, lay, place: this.place });
    this.p.offered[tally]++;
    this.p.prayers++;
    this.flames += RULES.flamePrayer;
    this.emit({ type: 'flames', n: RULES.flamePrayer, at: 'prayer' });
    this.emit({ type: 'offered', lay, place: this.place, tally });
    this.talk.ask(lay ? 'laid' : 'bloom', 3, 8);
    this.verse = lay ? inTurn(LAY_VERSES, this.p.prayers) : inTurn(LIFT_VERSES, this.p.prayers);
    // the walk goes on after this one; nothing is left to carry
    const walk = walkOf(this.p);
    this.p.walk = (this.whoAt + 1) % walk.length;
    this.p.carry = null;
    const last = !this.fitsAnotherAfterRest();
    this.beginStep('rest', last ? Infinity : this.restOf(this.breaths.rest));
  }

  /** After this prayer's rest, will another one fit? */
  private fitsAnotherAfterRest(): boolean {
    const left = this.plannedSec - this.finaleSec - this.t - this.restOf(this.breaths.rest);
    return left >= this.fixedSec(false) + 2 * (this.lead + RULES.needMin / (RULES.growBase + RULES.growLevel));
  }

  /** The rest: whole breaths, then the next prayer (the last one rests on to the finale). */
  private restOn(): void {
    if (this.stepDur === Infinity) return;
    this.telegraphAt(this.stepDur - RULES.telegraph, 'free');
    if (this.stepT < this.stepDur) return;
    if (!this.fitsAnother()) {
      this.stepDur = Infinity;
      this.block.dur = Infinity;
      return;
    }
    const walk = walkOf(this.p);
    this.whoAt = Math.min(walk.length - 1, this.p.walk);
    this.who = walk[this.whoAt];
    this.beginPrayer(null);
  }

  /** A tenth of the growth or the rise: a small event (a glint, a glass tone) so the sound follows. */
  private ticks(v: number, what: 'grow' | 'rise'): void {
    const k = Math.floor(v * 10 + 1e-9);
    while (this.tickK < k && this.tickK < 10) {
      this.tickK++;
      this.emit({ type: 'tick', k: this.tickK, what });
    }
  }

  private watchStill(dt: number, f: FocusFrame): void {
    const waiting = this.sighted && this.reliable && !f.focused;
    this.stillRun = waiting ? this.stillRun + dt : 0;
    if (this.stillRun >= RULES.stillSec && !this.stillSaid) {
      this.stillSaid = true;
      this.talk.ask('still', 1.5, 6);
    }
  }

  // ── the hands: whom, where, stay ───────────────────────────────
  /** May the player choose whom now?  In play, never over the opening card. */
  get canChoose(): boolean { return this.started && this.phase === 'play' && !this.story; }

  /** The walk's entry the hands choose now: this prayer's, or — once it is offered — the next one's. */
  get choosingAt(): number { return this.offeredNow ? Math.min(walkOf(this.p).length - 1, this.p.walk) : this.whoAt; }

  /** The one the next prayer is for (shown in the rest). */
  get nextWho(): Who { const w = walkOf(this.p); return w[Math.min(w.length - 1, this.p.walk)]; }

  /**
   * Choose the one prayed for by its place in the walk: this prayer's until it is offered, then the next prayer's.
   */
  choose(at: number, via: Via): boolean {
    if (!this.canChoose) return false;
    const walk = walkOf(this.p);
    if (!Number.isInteger(at) || at < 0 || at >= walk.length) return false;
    if (at === this.choosingAt) return true;
    if (this.offeredNow) {
      this.p.walk = at;
      this.reshow = 3;
    } else {
      this.whoAt = at;
      this.who = walk[at];
      this.p.walk = at;
      if (this.step === 'name' || this.step === 'offer' || this.step === 'wait') this.namedAt = this.t;
      this.tip = this.tipFor(this.block);
    }
    this.emit({ type: 'who', via });
    this.talk.ask('pick', 1, 5);
    return true;
  }

  prev(): boolean {
    const len = walkOf(this.p).length;
    return this.choose((this.choosingAt - 1 + len) % len, 'prev');
  }

  next(): boolean {
    const len = walkOf(this.p).length;
    return this.choose((this.choosingAt + 1) % len, 'next');
  }

  /** Lay the hand on another place (a tap on the small figure) — for oneself, or a name with a place. */
  setPlace(place: HurtPlace): boolean {
    if (!this.started || this.phase === 'done' || !isPlace(place) || !this.lay || this.offeredNow) return false;
    if (this.who.kind === 'self') this.p.selfPlace = place;
    else if (this.who.kind === 'name' && this.p.names[this.who.i]) this.p.names[this.who.i].place = place;
    else return false;
    this.emit({ type: 'place', place });
    return true;
  }

  openPicker(): boolean {
    if (!this.canChoose) return false;
    if (this.picker) return this.closePicker();
    this.picker = true;
    this.pickerT = 0;
    this.emit({ type: 'picker', open: true });
    return true;
  }

  closePicker(): boolean {
    if (!this.picker) return false;
    this.picker = false;
    this.emit({ type: 'picker', open: false });
    return true;
  }

  /** A choice in the picker: the walk's entry `at`. */
  pick(at: number): boolean {
    const ok = this.choose(at, 'pick');
    this.closePicker();
    return ok;
  }

  /** A tap on the picture or Space: the words glow again (a story card: close it). */
  stay(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.closeStory();
      return true;
    }
    if (this.picker) return this.closePicker();
    this.reshow = 3;
    this.emit({ type: 'stay' });
    return true;
  }

  /** Keys: Space stays, ← → whom, M (or Escape in the picker) the list, 1–9 choose in the picker. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const used = (fn: () => unknown): boolean => { if (down) fn(); return true; };
    if (k === ' ' || k === 'Spacebar' || k === 'Enter') return used(() => this.stay());
    if (k === 'ArrowLeft') return used(() => this.prev());
    if (k === 'ArrowRight') return used(() => this.next());
    if (k === 'm') return used(() => this.openPicker());
    if (k === 'Escape' && this.picker) return used(() => this.closePicker());
    if (this.picker && /^[1-9]$/.test(k)) return used(() => this.pick(Number(k) - 1));
    return false;
  }

  // ── the blocks' verdicts ───────────────────────────────────────
  private endBlock(): void {
    const b = this.block;
    if (b.end !== undefined) return;
    b.end = this.t;
    if (b.dur === Infinity) b.dur = this.stepT;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'free') {
      share = this.judge.share;
      const long = this.stepT >= RULES.judgeMin;
      verdict = long && this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (verdict === true && !b.blind) {
        this.flames += RULES.flameBlock;
        this.emit({ type: 'flames', n: RULES.flameBlock, at: 'block' });
      }
      if (b.kind === 'rest' && verdict) this.passedRests++;
    }
    b.verdict = verdict;
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share });
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    if (this.story) this.closeStory();
    this.endBlock();
    this.phase = 'finale';
    this.telegraphed = false;
    this.setGrowing(false);
    this.closePicker();
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
    // an unfinished prayer waits for the next session, with what focus grew
    const grow = Math.max(this.grow, Math.min(1, this.grow + this.hidden));
    p.carry = this.rise >= 1 ? null : grow > 0 || this.rise > 0 ? { grow, rise: this.rise } : null;
    if (this.rise < 1) p.walk = this.whoAt;
    p.sessions++;
    p.balls += this.ballsBegun;
    p.flamesAll += this.score;
    p.lastLen = this.plannedSec;
  }

  finish(): void {
    this.end();
  }

  private coach(what: Coach): void {
    if (!markSeen(this.p, `c.${what}`)) return;
    this.emit({ type: 'coach', what });
  }

  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  private addFlames(n: number): void {
    this.flames += n;
    this.flameAcc += n;
  }

  private flushFlames(at: 'grow' | 'rest'): void {
    const shown = Math.round(this.flameAcc);
    if (shown >= 1) this.emit({ type: 'flames', n: shown, at });
    this.flameAcc -= shown;
    this.flameTick = 0;
  }

  private updateFlames(dt: number): void {
    if (this.restBlock && this.reliable) {
      const n = RULES.flameRest * (0.3 + this.calmShown) * dt;
      this.flames += n;
      this.flameAcc += n;
    }
    this.flameTick += dt;
    if (this.flameTick >= (this.restBlock ? 3 : 2)) this.flushFlames(this.restBlock ? 'rest' : 'grow');
  }

  /** The panel's gauge: the light in a sighted push, calm in rest; null blind, without a signal, or between. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || this.story || !this.reliable) return null;
    if (this.sighted) return clamp(this.light);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** What the block asks of the brain, its seconds left (a rest) and what comes next, for the runner's panel and dock. */
  signal(): { want: 'focus' | 'rest' | 'free'; blind: boolean; task?: string; left?: number; next: 'focus' | 'rest' | 'free' | null } {
    if (!this.started || this.phase !== 'play' || this.story) return { want: 'free', blind: false, task: this.tip || undefined, next: null };
    const kind = this.kind;
    const want = kind === 'push' ? 'focus' : kind === 'rest' ? 'rest' : 'free';
    const left = kind !== 'push' && this.stepDur !== Infinity ? Math.max(0, this.stepDur - this.stepT) : undefined;
    let next: 'focus' | 'rest' | 'free' | null = null;
    if (this.telegraphed) next = kind === 'push' ? 'rest' : this.step === 'rest' ? 'free' : this.step === 'rub' ? 'rest' : 'focus';
    return { want, blind: this.blind, task: this.tip || undefined, left, next };
  }

  /** The pad follows the light in a sighted push and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.sighted) return clamp(this.light);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The strategy under the block's name. */
  tipFor(b: Block): string {
    const k = this.who.kind === 'name' || this.who.kind === 'dear' ? 'other' : this.who.kind;
    switch (b.step) {
      case 'rub': return t('tip.rub');
      case 'breathe': return t('tip.breathe');
      case 'ball':
        if (b.blind) return t('tip.blind');
        if (this.ballsBegun > 0 && (this.ballsBegun + this.n) % RULES.countEvery === 0) return t('tip.count');
        return t(`tip.ball.${k}` as 'tip.ball.other');
      case 'name': return t('tip.name');
      case 'offer': return this.lay ? t('tip.lay') : t('tip.lift');
      case 'rest': return t('tip.rest');
      case 'wait': return t('tip.wait');
    }
  }

  /** The prayer's words now (the offering's words, then the rest's): to the Father, through Jesus, in the Spirit. */
  get prayerLine(): string {
    if (this.lay) return t('pray.lay');
    if (this.who.kind === 'world') return t('pray.world');
    if (this.who.kind === 'dear') return t('pray.dear');
    return t('pray.name', { name: this.whoText });
  }

  /** What to do now, in one short line with an icon. */
  doNow(): { icon: string; text: string } | null {
    if (!this.started || this.story) return null;
    if (this.picker) return { icon: '≡', text: t('now.pick') };
    if (this.phase !== 'play') return { icon: '✦', text: t('now.end') };
    switch (this.step) {
      case 'rub': return { icon: '✋', text: t('now.rub') };
      case 'breathe': return { icon: '◎', text: this.breath.phase === 'in' ? t('now.in') : this.breath.phase === 'out' ? t('now.out') : t('now.hold') };
      case 'ball':
        if (this.stepT < this.lead) return { icon: '✦', text: t('now.spark') };
        if (this.unrelT > 3) return { icon: '…', text: t('now.nosignal') };
        if (this.block.blind) return { icon: '◐', text: t('now.blind') };
        return { icon: '✦', text: t('now.ball') };
      case 'name': return { icon: '✧', text: `${t('now.name')} · ${this.breathWord()}` };
      case 'offer':
        if (this.unrelT > 3) return { icon: '…', text: t('now.nosignal') };
        return this.lay ? { icon: '✋', text: t('now.lay', { place: placeName(this.place!) }) } : { icon: '↑', text: t('now.lift') };
      case 'rest': return { icon: '☾', text: `${t('now.rest')} · ${this.breathWord()}${this.breathCount()}` };
      case 'wait': return { icon: '☾', text: t('now.wait') };
    }
  }

  /** The breath's phase in a word ("wdech"). */
  private breathWord(): string { return t(`br.${this.breath.phase}` as 'br.in'); }

  /** " · oddech 2 z 3" in a rest of whole breaths (none in the last rest, which runs to the finale). */
  private breathCount(): string {
    if (this.stepDur === Infinity || this.cycle <= 0) return '';
    const of = Math.round(this.stepDur / this.cycle);
    if (of < 2) return '';
    return ` · ${t('br.count', { n: Math.min(of, this.breath.n + 1), of })}`;
  }

  /** The prayers of this session, one line per kind ("3 za innych · 1 za siebie"); never a name. */
  tallyLine(): string {
    const c = { others: 0, self: 0, world: 0 };
    for (const o of this.offered) c[o.tally]++;
    const parts: string[] = [];
    if (c.others) parts.push(t('tally.others', { n: c.others }));
    if (c.self) parts.push(t('tally.self', { n: c.self }));
    if (c.world) parts.push(t('tally.world', { n: c.world }));
    return parts.length ? parts.join(' · ') : t('tally.none');
  }

  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.prayers'), this.tallyLine()],
      [t('stat.grow'), secText(this.growSec)],
      [t('stat.calm'), secText(this.calmSec)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  closingVerse(): PassageId {
    return inTurn(CLOSING, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.offered.length) add(0, t('hl.prayers', { line: this.tallyLine() }));
    else if (this.started) add(0, t('hl.none'));
    if (this.offered.some(o => o.lay)) add(1, t('hl.laid'));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(2, t('hl.record', { n: flameText(this.score) }));
    if (this.blindShare >= 0) add(3, t('hl.blind', { pct: t('pct', { n: this.blindShare }) }));
    if (this.p.carry) add(4, t('hl.carry'));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}

export type { Moment };
