/**
 * Koła światła's session, without the canvas (DESIGN.md §28): the plan of rules.ts walked over one session — the
 * arrival, the twelve wheels one after another in pushes and rests (a push lasts until its group of wheels is true;
 * a rest of whole breaths prays for that place), finer rounds in a long session, the full field, the close — what the
 * focus drives, what the band is asked, what the narrator says, and the session's numbers.
 *
 * Light only from real focus (§18.3–18.4): a wheel comes true only in a sighted push past its lead-in, with a reliable
 * signal, while focused, at `focusRate` (the level averaged over a whole breath).  Without focus the wheel waits —
 * nothing turns true by itself, not even when time runs out: a wheel the session did not reach stays as it is, and the
 * field shines with the wheels that are true.  The work is fitted to the player: at each push's start the group's
 * steps are sized to the player's pace over the time the plan has left for it (rules `needPer`), so a player focusing
 * as they usually do turns all twelve true before the field.
 *
 * Every wheel starts out of true in its own way, new each session (`faultOf`): it wobbles off its axis, turns too
 * fast, too slowly or the wrong way, its petals are uneven, its colour dull, its mouth pinched or frayed.
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathCycle, breathOk, type BreathPattern, type BreathState } from '../kit/breath';
import { BlockContrast, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { Rhythm } from '../kit/rhythm';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  CENTRES, VERSES, WHEELS, WHEEL_VERSE, partnerOf, petalsOf, stepsOf, verseFor,
  type CentreId, type Moment, type Quality, type Side, type WheelId,
} from './content';
import { t, unit, type Key } from './i18n';
import { BREATH_DEF, bestOf, migrate, type KolaProgress } from './meta';
import { RULES, cleanPace, focusRate, learnPace, paceNow, planFor, readTime, type Group, type Plan } from './rules';
import { Talk } from './talk';

export type BlockKind = 'rest' | 'push' | 'free';
export type BlockWhat = 'arrive' | 'push' | 'rest' | 'field' | 'close';

/** One block as it runs: its start and its planned end (a push's target: it ends when its group is true). */
export interface Block { kind: BlockKind; what: BlockWhat; t0: number; t1: number; group: number; valve: boolean }

/** How a wheel is out of true this session (each wheel its own way, new each session). */
export interface Fault {
  /** wobble off its axis (0..1) and the wobble's phase */
  wobble: number;
  wobblePhase: number;
  /** its turn as a multiple of the true one: < 0 the wrong way, under 0.4 sluggish, over 1.8 racing */
  spin: number;
  /** each petal's length (× the even one) and light (0..1) */
  petalLen: number[];
  petalLit: number[];
  /** how dull the colour is (0 clear … 1 grey) */
  dull: number;
  /** the mouth's size as a multiple of the healthy one: under 1 pinched, over 1 frayed */
  size: number;
  /** where the turn starts (rad) */
  phase: number;
}

/** A wheel in one round: its steps (qualities), each step's progress (0..1) and its need (focus-seconds). */
export interface RoundRun { planned: boolean; steps: Quality[][]; p: number[]; need: number[]; done: boolean; doneAt: number }

export interface WheelRun {
  id: WheelId;
  centre: CentreId;
  side: Side;
  num: number;
  fault: Fault;
  /** rounds 1–3 (index 0–2) */
  r: RoundRun[];
  /** petals lit, per round (the score) */
  lit: number[];
  /** when its pair came into balance (−1: not yet) */
  pairAt: number;
}

export type Coach = 'push' | 'rest' | 'petal' | 'tap';

export type SimEvent =
  | { type: 'block'; kind: BlockKind; what: BlockWhat }
  | { type: 'focusWheel'; wheel: WheelId }
  | { type: 'step'; wheel: WheelId; round: number }
  | { type: 'true'; wheel: WheelId; round: number }
  | { type: 'pair'; centre: CentreId; round: number }
  | { type: 'petal'; wheel: WheelId; n: number }
  | { type: 'layer'; i: number }
  | { type: 'whole' }
  | { type: 'breath'; phase: 'in' | 'out' }
  | { type: 'tap' }
  | { type: 'coach'; what: Coach };

/** A passage on the band: since when, for how long. */
export interface Card { id: PassageId; t0: number; dur: number }

export interface SimOpts {
  progress: KolaProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  rhythm?: Rhythm | null;
}

/** A running mean over a window (the level over one whole breath, §18.4): quarter-second bins. */
class WindowMean {
  private readonly bins: number[] = [];
  private acc = 0;
  private accT = 0;
  private sum = 0;
  constructor(readonly sec: number, readonly bin = 0.25) {}
  push(v: number, dt: number): void {
    if (!(dt > 0) || !Number.isFinite(v)) return;
    this.acc += v * dt;
    this.accT += dt;
    while (this.accT >= this.bin) {
      const part = this.bin / this.accT;
      const val = (this.acc * part) / this.bin;
      this.acc -= this.acc * part;
      this.accT -= this.bin;
      this.bins.push(val);
      this.sum += val;
      if (this.bins.length > Math.round(this.sec / this.bin)) this.sum -= this.bins.shift()!;
    }
  }
  get value(): number | null { return this.bins.length ? this.sum / this.bins.length : null; }
}

/** A wheel's way out of true for this session (seeded: each wheel its own, new each session). */
export function faultOf(id: WheelId, rng: () => number): Fault {
  const n = petalsOf(id);
  const r = (a: number, b: number): number => a + (b - a) * rng();
  const kind = rng();
  const spin = kind < 0.3 ? r(-0.8, -0.35) : kind < 0.65 ? r(0.12, 0.32) : r(1.9, 2.8);
  return {
    wobble: r(0.45, 1),
    wobblePhase: r(0, Math.PI * 2),
    spin,
    petalLen: Array.from({ length: n }, () => r(0.5, 1.5)),
    petalLit: Array.from({ length: n }, () => r(0.2, 1)),
    dull: r(0.6, 0.9),
    size: rng() < 0.6 ? r(0.45, 0.66) : r(1.32, 1.58),
    phase: r(0, Math.PI * 2),
  };
}

export class KolaSim {
  readonly p: KolaProgress;
  readonly plan: Plan;
  readonly wheels: WheelRun[];
  readonly talk: Talk;
  readonly pattern: BreathPattern;
  readonly eeg: boolean;
  readonly custom: boolean;
  readonly contrast = new BlockContrast(4);
  started = false;
  block: Block;
  blockT = 0;
  t = 0;
  /** the next group to work (all done: groups.length) */
  gi = 0;
  /** the wheel the work is at (or was last, in a rest) */
  wheel: WheelId = 'root';
  /** the round the work is in */
  round: 1 | 2 | 3 = 1;
  /** what the focus does this frame (focus-seconds a second), the light shown (smoothed level), calm */
  rate = 0;
  light = 0;
  calm = 0;
  reliable = false;
  card: Card | null = null;
  /** a tap makes the words glow again until this time */
  reshowUntil = 0;
  /** the runner's coach mark is up until this time (the narrator waits) */
  hintUntil = 0;
  /** the score: petals lit by focus */
  score = 0;
  /** the rest's prayer: which wheel's place, and in which round */
  prayFor: { wheel: WheelId; round: 1 | 2 | 3 } | null = null;
  /** the pace this session (focus-seconds earned, sighted seconds with work to do) */
  earned = 0;
  sightedSec = 0;
  private stallT = 0;
  private noGain = 0;
  private waited = false;
  /** when the gentle "come back" and the valve's words were last said (each at most once in `quietSec`) */
  private waitSaidAt = -Infinity;
  private valveSaidAt = -Infinity;
  private fieldAt = -1;
  private layersSaid = 0;
  private wholeSaid = false;
  private credited = false;
  private lastBreathPhase = '';
  private readonly mean = new WindowMean(RULES.meanSec);
  private readonly events: SimEvent[] = [];
  private readonly bestBefore: number | null;
  private readonly session: number;
  private readonly firstSessions: boolean;
  private readonly paceSaved: number;
  private readonly paceKnown: boolean;

  constructor(o: SimOpts) {
    this.p = migrate(o.progress);
    this.eeg = o.eeg;
    this.pattern = breathOk(this.p.breath) ? this.p.breath : BREATH_DEF;
    this.custom = !!o.rhythm?.custom;
    this.plan = planFor({
      plannedSec: o.plannedSec, cyc: breathCycle(this.pattern), eeg: o.eeg,
      focus: o.rhythm?.focus ?? null, rest: o.rhythm?.rest ?? null, custom: this.custom,
    });
    const P = this.plan;
    const kOf = (round: number): number => P.rounds.find(r => r.round === round)?.steps ?? 0;
    this.wheels = WHEELS.map(w => {
      const r: RoundRun[] = ([1, 2, 3] as const).map(round => {
        const k = kOf(round);
        const steps = k > 0 ? stepsOf(round, k) : stepsOf(round, 1);
        return { planned: k > 0, steps, p: steps.map(() => 0), need: steps.map(() => RULES.needMin), done: false, doneAt: -1 };
      });
      return { id: w.id, centre: w.centre, side: w.side, num: w.num, fault: faultOf(w.id, o.rng), r, lit: [0, 0, 0], pairAt: -1 };
    });
    this.block = { kind: 'rest', what: 'arrive', t0: 0, t1: P.arriveEnd, group: -1, valve: false };
    this.talk = new Talk(o.rng);
    this.bestBefore = bestOf(this.p);
    this.session = this.p.sessions + 1;
    this.firstSessions = this.p.sessions < 2;
    this.paceKnown = this.p.pace > 0;
    this.paceSaved = cleanPace(this.p.pace);
  }

  // ── the clock ─────────────────────────────────────────────────

  get T(): number { return this.plan.T; }
  get lead(): number { return this.plan.lead; }
  get cyc(): number { return this.plan.cyc; }
  get groups(): readonly Group[] { return this.plan.groups; }
  get pushBlock(): boolean { return this.block.kind === 'push'; }
  get restBlock(): boolean { return this.block.kind === 'rest'; }
  get sighted(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  get dur(): number { return Math.max(0, this.block.t1 - this.block.t0); }
  /** the block's seconds left (a push: to its target) */
  get left(): number { return Math.max(0, this.block.t1 - this.t); }
  get blockK(): number { return clamp(this.blockT / Math.max(0.01, this.dur)); }
  /** the breath now (rests count it from their start, the field from its own) */
  get breath(): BreathState { return breathAt(this.pattern, this.restBlock ? this.blockT : this.t); }
  /** whole breaths of the current rest */
  get breaths(): number { return Math.max(1, Math.round(this.dur / this.cyc)); }
  run(id: WheelId): WheelRun { return this.wheels.find(w => w.id === id)!; }
  /** how far a wheel is in a round (0..1) */
  progressOf(w: WheelRun, round: 1 | 2 | 3): number {
    const r = w.r[round - 1];
    if (r.done) return 1;
    return r.p.reduce((s, x) => s + x, 0) / r.p.length;
  }
  /** a quality's trueness (0 out of true … 1 right): the progress of the step that holds it in its round */
  quality(w: WheelRun, q: Quality): number {
    for (let i = 0; i < 3; i++) {
      const r = w.r[i];
      const s = r.steps.findIndex(st => st.includes(q));
      if (s >= 0) return r.done ? 1 : r.p[s];
    }
    return 0;
  }
  /** wheels true in round 1 (brought to right working) */
  get trueCount(): number { return this.wheels.filter(w => w.r[0].done).length; }
  /** every planned round done for every wheel */
  get allDone(): boolean { return this.gi >= this.plan.groups.length; }
  /** the session reached the field */
  get fieldReached(): boolean { return this.fieldAt >= 0; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.lastLen = this.T;
    this.enter({ kind: 'rest', what: 'arrive', t0: 0, t1: this.plan.arriveEnd, group: -1, valve: false });
    if (this.firstSessions) this.coach('tap');
  }

  take(): SimEvent[] { return this.events.splice(0); }
  private emit(e: SimEvent): void { this.events.push(e); }

  private coach(what: Coach): void {
    const id = `c.${what}`;
    if (this.p.seen.includes(id)) return;
    this.p.seen.push(id);
    this.emit({ type: 'coach', what });
  }

  private showVerse(id: PassageId, dur?: number): void {
    this.card = { id, t0: this.t, dur: dur ?? Math.max(6, readTime(passage(id).text)) };
  }

  // ── the blocks ────────────────────────────────────────────────

  private enter(b: Block): void {
    this.block = b;
    this.blockT = Math.max(0, this.t - b.t0);
    this.stallT = 0;
    this.noGain = 0;
    this.waited = false;
    this.card = null;
    this.lastBreathPhase = '';
    this.emit({ type: 'block', kind: b.kind, what: b.what });
    switch (b.what) {
      case 'arrive':
        this.talk.ask('arrive', 2, 8);
        break;
      case 'push': {
        const g = this.plan.groups[b.group];
        if (g.round !== this.round) {
          this.round = g.round;
          this.talk.hush();
          this.talk.ask(g.round === 2 ? 'round2' : 'round3', 3, 8);
        } else if (b.group === 0) this.talk.ask('first', 2, 7);
        else if (g.wheels[0] !== this.plan.groups[b.group - 1]?.wheels[0] && !g.wheels[0].endsWith('B') && g.round === 1) {
          // a new centre begins (not the back of the one just prayed for): a word; later rounds stay quiet
          this.talk.ask('next', 1, 6);
        }
        this.fit(b);
        this.wheel = this.current() ?? this.wheel;
        this.emit({ type: 'focusWheel', wheel: this.wheel });
        if (this.firstSessions) this.coach('push');
        break;
      }
      case 'rest':
        this.talk.hush();
        if (b.valve && this.t - this.valveSaidAt >= RULES.quietSec) {
          this.valveSaidAt = this.t;
          this.talk.ask('valve', 3, 6);
        }
        if (this.firstSessions) this.coach('rest');
        break;
      case 'field':
        this.talk.hush();
        this.fieldAt = this.t;
        this.talk.ask('field', 3, 8);
        break;
      case 'close':
        this.talk.hush();
        break;
    }
  }

  /** The wheel to work on in the current group (null: the group is done). */
  private current(): WheelId | null {
    const g = this.plan.groups[this.block.group];
    if (!g) return null;
    for (const id of g.wheels) if (!this.run(id).r[g.round - 1].done) return id;
    return null;
  }

  /** What is left of a group: its share still to do (0..1) and its steps still to do (fractional). */
  private groupLeft(gi: number): { share: number; steps: number } {
    const g = this.plan.groups[gi];
    let done = 0, all = 0, steps = 0;
    for (const id of g.wheels) {
      const r = this.run(id).r[g.round - 1];
      for (let s = 0; s < r.p.length; s++) {
        all++;
        const p = r.done ? 1 : r.p[s];
        done += p;
        steps += 1 - p;
      }
    }
    return { share: all ? 1 - done / all : 0, steps };
  }

  /**
   * A push begins: its target re-fitted to the time the plan has left before the field (the groups still to do,
   * their lead-ins and rests), and its steps sized to the player's pace over it.
   */
  private fit(b: Block): void {
    const P = this.plan, g = P.groups[b.group];
    if (P.test) {
      for (const id of g.wheels) this.run(id).r[0].need.fill(RULES.testNeed);
      b.t1 = this.t + (P.fieldStart - this.t);
      return;
    }
    let fixed = 0, planned = 0;
    for (let i = b.group; i < P.groups.length; i++) {
      const gg = P.groups[i];
      const share = i === b.group ? this.groupLeft(i).share : 1;
      fixed += P.lead + gg.breaths * P.cyc;
      planned += gg.sighted * share;
    }
    const tLeft = P.fieldStart - this.t;
    const hi = this.custom ? 1.1 : RULES.scaleMax;
    const scale = planned > 0 ? clamp((tLeft - fixed) / planned, RULES.scaleMin, hi) : 1;
    const left = this.groupLeft(b.group);
    const sighted = Math.max(1, g.sighted * left.share * scale);
    const pace = paceNow(this.paceSaved, this.earned, this.sightedSec);
    const need = clamp((pace * sighted * RULES.fill) / Math.max(0.25, left.steps), RULES.needMin, RULES.needMax);
    for (const id of g.wheels) {
      const r = this.run(id).r[g.round - 1];
      if (!r.done) r.need = r.need.map((n, s) => (r.p[s] >= 1 ? n : need));
    }
    b.t1 = this.t + P.lead + sighted;
  }

  /** The block ends: what comes next. */
  private next(valve = false): void {
    const P = this.plan;
    const b = this.block;
    if (b.what === 'close') return;
    if (b.what === 'field') {
      this.enter({ kind: 'free', what: 'close', t0: this.t, t1: P.T, group: -1, valve: false });
      return;
    }
    if (this.t >= P.fieldStart - 1e-6 || (b.what === 'rest' && this.allDone) || (b.what === 'push' && this.allDone && P.test)) {
      this.enterField();
      return;
    }
    if (b.what === 'push') {
      const g = P.groups[b.group];
      if (g.breaths <= 0) {
        // a test: no rest; the field follows (or the next group)
        if (this.allDone) this.enterField();
        else this.enterPush();
        return;
      }
      // the rest: whole breaths, shortened to one when the field is near
      let n = g.breaths;
      while (n > 1 && this.t + n * P.cyc > P.fieldStart) n--;
      const prayed = this.lastWorked(b.group);
      this.prayFor = prayed;
      this.enter({ kind: 'rest', what: 'rest', t0: this.t, t1: this.t + n * P.cyc, group: b.group, valve });
      return;
    }
    // after the arrival or a rest: the next push, or the field when every group is done
    if (this.allDone) this.enterField();
    else this.enterPush();
  }

  private enterPush(): void {
    this.prayFor = null;
    this.enter({ kind: 'push', what: 'push', t0: this.t, t1: this.t + this.plan.groups[this.gi].push, group: this.gi, valve: false });
  }

  private enterField(): void {
    if (this.block.what === 'field' || this.block.what === 'close') return;
    this.prayFor = null;
    this.enter({ kind: 'rest', what: 'field', t0: this.t, t1: this.plan.closeStart, group: -1, valve: false });
  }

  /** The wheel whose place the rest prays for: the last one the push finished (a pair alternates by session), else the one waiting. */
  private lastWorked(gi: number): { wheel: WheelId; round: 1 | 2 | 3 } {
    const g = this.plan.groups[gi];
    const done = g.wheels.filter(id => this.run(id).r[g.round - 1].done);
    if (!done.length) return { wheel: this.wheel, round: g.round };
    // a front and back of one centre finished in the same push: the front's prayer one session, the back's the next
    const last = done[done.length - 1];
    const partner = partnerOf(last);
    if (partner && done.includes(partner) && this.run(last).r[g.round - 1].doneAt - this.run(partner).r[g.round - 1].doneAt < 60) {
      return { wheel: this.session % 2 ? partner : last, round: g.round };
    }
    return { wheel: last, round: g.round };
  }

  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started) return;
    const step = Math.max(0, Math.min(0.25, dt));
    this.t = now;
    this.blockT = Math.max(0, this.t - this.block.t0);
    // the frame's times: the field at the latest at its start, the close at its own
    const w = this.block.what;
    if (w === 'arrive' && this.t >= this.block.t1) this.next();
    else if (w === 'rest' && this.t >= this.block.t1) this.next();
    else if (w === 'field' && this.t >= this.plan.closeStart) this.next();
    else if (w === 'push' && this.t >= this.plan.fieldStart) this.enterField();
    this.blockT = Math.max(0, this.t - this.block.t0);
    this.reliable = f.reliable;
    if (f.reliable) this.mean.push(f.level, step);
    const work = this.pushBlock && this.current() !== null;
    this.rate = this.sighted && f.reliable && work ? focusRate(this.mean.value ?? f.level, f.focused, f.hold) : 0;
    const shown = this.pushBlock ? (f.reliable ? f.level : 0.15) : 0.35;
    this.light = approach(this.light, shown, step, RULES.showTau);
    this.calm = approach(this.calm, f.reliable ? f.calm : 0, step, 1.5);
    if (this.block.kind !== 'free' && this.block.what !== 'field') this.contrast.push(this.block.kind === 'push' ? 'focus' : 'rest', f.activity, f.reliable, this.blockT, step);
    if (this.pushBlock) this.updatePush(step, f.reliable && work);
    else if (this.block.what === 'rest') this.updateRest();
    else if (this.block.what === 'arrive') this.updateArrive();
    else if (this.block.what === 'field') this.updateField();
    else if (this.block.what === 'close') this.updateClose();
    if (this.restBlock) this.breathCue();
    if (this.card && this.t > this.card.t0 + this.card.dur) this.card = null;
    const blocked = this.t < this.hintUntil || this.blockT < 1.2;
    this.talk.update(step, this.t, blocked);
  }

  private breathCue(): void {
    const ph = this.breath.phase;
    if (ph === this.lastBreathPhase) return;
    this.lastBreathPhase = ph;
    if (ph === 'in' || ph === 'out') this.emit({ type: 'breath', phase: ph });
  }

  // ── the arrival ───────────────────────────────────────────────

  private updateArrive(): void {
    const A = this.block.t1;
    if (!this.card && this.blockT > Math.min(this.cyc, A * 0.4) && this.blockT < A - 4) this.showVerse(verseFor('arrive', this.session), A - this.t);
  }

  // ── a push: only focus brings the wheels true ─────────────────

  private updatePush(dt: number, counting: boolean): void {
    const b = this.block;
    if (this.sighted && counting) {
      this.sightedSec += dt;
      this.earned += this.rate * dt;
    }
    if (this.rate > 0) {
      this.stallT = 0;
      this.noGain = 0;
      this.work(this.rate * dt);
    } else if (this.sighted) {
      this.stallT += dt;
      this.noGain += dt;
      if (this.stallT > RULES.waitSec && !this.waited) {
        this.waited = true;
        if (this.t - this.waitSaidAt >= RULES.quietSec) {
          this.waitSaidAt = this.t;
          this.talk.ask('wait', 2, 6);
        }
      }
    }
    if (this.current() === null) {
      this.next();
      return;
    }
    // the valve: a push that cannot finish rests; its wheel keeps what it has and waits
    const target = Math.max(0.01, b.t1 - b.t0);
    if (this.sighted && (this.noGain >= RULES.valveNoGain || this.blockT > Math.max(target * RULES.valveOver, target + RULES.valvePlus))) this.next(true);
  }

  /** Spend focus-seconds on the group's steps in order (what is left over flows to the next step and wheel). */
  private work(fs: number): void {
    const g = this.plan.groups[this.block.group];
    let left = fs;
    for (let guard = 0; guard < 64 && left > 1e-9; guard++) {
      const id = this.current();
      if (!id) return;
      if (id !== this.wheel) {
        this.wheel = id;
        this.emit({ type: 'focusWheel', wheel: id });
      }
      const w = this.run(id), r = w.r[g.round - 1];
      const s = r.p.findIndex(x => x < 1);
      if (s < 0) { this.complete(w, g.round); continue; }
      const room = (1 - r.p[s]) * r.need[s];
      const use = Math.min(room, left);
      r.p[s] = Math.min(1, r.p[s] + use / r.need[s]);
      left -= use;
      if (r.p[s] >= 1 - 1e-9) {
        r.p[s] = 1;
        if (s < r.p.length - 1) this.emit({ type: 'step', wheel: id, round: g.round });
      }
      this.lightPetals(w, g.round);
      if (r.p.every(x => x >= 1)) this.complete(w, g.round);
    }
  }

  /** The petals of a wheel's ring light one by one with its progress in the round (the score). */
  private lightPetals(w: WheelRun, round: 1 | 2 | 3): void {
    const n = petalsOf(w.id);
    const lit = Math.min(n, Math.floor(this.progressOf(w, round) * n + 1e-6));
    const was = w.lit[round - 1];
    if (lit > was) {
      w.lit[round - 1] = lit;
      this.score += lit - was;
      this.emit({ type: 'petal', wheel: w.id, n: lit });
      if (this.firstSessions && this.score >= 3) this.coach('petal');
    }
  }

  private complete(w: WheelRun, round: 1 | 2 | 3): void {
    const r = w.r[round - 1];
    if (r.done) return;
    r.p.fill(1);
    r.done = true;
    r.doneAt = this.t;
    this.lightPetals(w, round);
    this.emit({ type: 'true', wheel: w.id, round });
    const partner = partnerOf(w.id);
    if (partner && this.run(partner).r[round - 1].done) {
      w.pairAt = this.t;
      this.run(partner).pairAt = this.t;
      this.emit({ type: 'pair', centre: w.centre, round });
      if (round === 1) this.talk.ask('pair', 2, 5);
    } else if (round === 1) this.talk.ask('wheelTrue', 1, 5);
    // the group done: the next group (the sim moves on in updatePush)
    const g = this.plan.groups[this.block.group];
    if (g && g.wheels.every(id => this.run(id).r[round - 1].done) && this.gi === this.block.group) {
      this.gi++;
      if (this.allDone && this.t < this.plan.fieldStart - 8) this.talk.ask('abide', 2, 6);
    }
  }

  // ── a rest: receptive, whole breaths ──────────────────────────

  /** The rest's words: the place's prayer, then its passage (a rest of two breaths or more). */
  get restShows(): 'prayer' | 'verse' | 'none' {
    if (this.block.what !== 'rest' || !this.prayFor) return 'none';
    if (this.block.valve && this.blockT < 6) return 'none';
    const B = this.breaths;
    if (B < 2) return 'prayer';
    return this.blockK < 0.55 ? 'prayer' : this.card ? 'verse' : 'prayer';
  }

  /** The prayer of the rest's place, in its round's words: receive (1), thank (2), entrust (3). */
  get prayer(): string {
    const pf = this.prayFor;
    if (!pf) return '';
    const c = this.run(pf.wheel).centre;
    if (pf.round === 2) return t(`thank.${c}` as Key);
    if (pf.round === 3) return t(`offer.${c}` as Key);
    return t(`pray.${pf.wheel}` as Key);
  }

  private updateRest(): void {
    if (this.card || !this.prayFor || this.breaths < 2) return;
    if (this.blockK >= 0.55 && this.left > 3) this.showVerse(WHEEL_VERSE[this.prayFor.wheel], Math.max(2, this.left));
  }

  // ── the field ─────────────────────────────────────────────────

  /** How far the field has come (0..1): its animation keeps to the planned field's length grown at most `fieldGrow`. */
  get fieldK(): number {
    if (this.fieldAt < 0) return 0;
    const planned = this.plan.closeStart - this.plan.fieldStart;
    const span = Math.max(4, Math.min(this.plan.closeStart - this.fieldAt, planned * RULES.fieldGrow));
    return clamp((this.t - this.fieldAt) / span);
  }

  /** How true a centre's wheels are (0..1, the mean of their round-1 progress): its layer of the field fills that far. */
  centreTrue(c: CentreId): number {
    const ws = this.wheels.filter(w => w.centre === c);
    return ws.reduce((s, w) => s + (w.r[0].done ? 1 : 0), 0) / ws.length;
  }

  /** Each layer's fill (0..1): the seven layers fill one after another, each as far as its centre is true. */
  layerFill(i: number): number {
    const R = RULES, k = this.fieldK;
    const span = R.fieldLayers / 7;
    const own = clamp((k - R.fieldTurn - i * span) / span);
    return own * (0.15 + 0.85 * this.centreTrue(CENTRES[i]));
  }

  /** The white-gold of the whole field (0..1): after the layers, as far as all twelve are true. */
  get whole(): number {
    const R = RULES;
    const k = clamp((this.fieldK - R.fieldTurn - R.fieldLayers) / (1 - R.fieldTurn - R.fieldLayers));
    return k * (this.trueCount / 12);
  }

  /** The field's words now: the narrator, a passage, the prayer. */
  get fieldShows(): 'say' | 'verse' | 'prayer' {
    if (this.block.what !== 'field') return 'say';
    const k = this.fieldK;
    if (k >= 0.8) return 'prayer';
    return k >= 0.25 && this.card ? 'verse' : 'say';
  }

  private updateField(): void {
    const k = this.fieldK;
    while (this.layersSaid < 7 && k >= RULES.fieldTurn + this.layersSaid * (RULES.fieldLayers / 7)) this.emit({ type: 'layer', i: this.layersSaid++ });
    if (!this.wholeSaid && k >= RULES.fieldTurn + RULES.fieldLayers) {
      this.wholeSaid = true;
      if (this.trueCount === 12) this.emit({ type: 'whole' });
      this.talk.ask(this.trueCount === 12 ? 'fieldWhole' : 'fieldPart', 2, 6);
    }
    const span = Math.max(4, Math.min(this.plan.closeStart - this.fieldAt, (this.plan.closeStart - this.plan.fieldStart) * RULES.fieldGrow));
    if (k >= 0.25 && k < 0.8 && !this.card) {
      const second = k >= 0.53 && span >= 50;
      const id = verseFor('field', this.session, second ? 1 : 0);
      const until = this.fieldAt + span * (second || span < 50 ? 0.8 : 0.53);
      if (until - this.t > 3) this.showVerse(id, until - this.t);
    }
  }

  // ── the close ─────────────────────────────────────────────────

  get closeShows(): 'bless' | 'verse' {
    return this.block.what === 'close' && this.blockK >= 0.45 ? 'verse' : 'bless';
  }

  get closingVerse(): PassageId { return inTurn(VERSES.close, this.session); }

  private updateClose(): void {
    if (this.closeShows === 'verse' && !this.card) this.showVerse(this.closingVerse, Infinity);
  }

  // ── input ─────────────────────────────────────────────────────

  /** A tap: the words glow again (never light). */
  stay(): boolean {
    if (!this.started) return false;
    this.reshowUntil = this.t + RULES.reshowSec;
    this.emit({ type: 'tap' });
    return true;
  }

  key(key: string, down: boolean): boolean {
    if (!down) return false;
    if (key === ' ' || key === 'Enter') return this.stay();
    return false;
  }

  // ── what the runner reads ─────────────────────────────────────

  canStop(): boolean { return this.t >= this.T; }

  /** The runner's gauge: the light in a sighted push (null without a signal), calm in a rest. */
  meter(): number | null {
    if (this.pushBlock) return this.reliable ? clamp(this.light) : null;
    if (this.restBlock) return this.reliable ? clamp(this.calm) : null;
    return null;
  }

  /** The ambient pad follows the light in a sighted push, holds still elsewhere. */
  padLevel(): number | null { return this.sighted && this.reliable ? clamp(this.light) : null; }

  /** How far the push's group is (0..1). */
  get groupK(): number { return this.pushBlock ? 1 - this.groupLeft(this.block.group).share : 0; }

  /** The next block is near: its telegraph is up. */
  get telegraphed(): boolean {
    const b = this.block;
    if (b.what === 'push') return this.sighted && this.groupK >= 0.9;
    if (b.what === 'rest' || b.what === 'arrive') return this.left <= RULES.telegraph && this.dur > RULES.telegraph + 1;
    if (b.what === 'field') return this.plan.closeStart - this.t <= RULES.telegraph;
    return false;
  }

  get nextKind(): BlockKind | null {
    const b = this.block;
    if (b.what === 'push') return 'rest';
    if (b.what === 'rest' || b.what === 'arrive') return this.allDone || this.t + this.left >= this.plan.fieldStart ? 'rest' : 'push';
    if (b.what === 'field') return 'free';
    return null;
  }

  /** The step the current wheel is in (its qualities), for the band's words and the view's chips. */
  get stepNow(): { qualities: Quality[]; i: number; n: number } | null {
    if (!this.pushBlock) return null;
    const g = this.plan.groups[this.block.group];
    const r = this.run(this.wheel).r[g.round - 1];
    const i = Math.max(0, r.p.findIndex(x => x < 1));
    return { qualities: r.steps[i] ?? r.steps[r.steps.length - 1], i: r.done ? r.p.length : i, n: r.p.length };
  }

  /** What the band asks now, in the panel's words. */
  get tip(): string {
    const b = this.block;
    switch (b.what) {
      case 'arrive': return t('task.arrive');
      case 'push': {
        const s = this.stepNow;
        if (!s) return t('task.push');
        return t(`task.${s.qualities[0]}` as Key);
      }
      case 'rest': return b.valve ? t('task.valve') : t('task.rest');
      case 'field': return t('task.field');
      default: return t('task.end');
    }
  }

  /** The headline's second line: where the way is. */
  get subLine(): string {
    const b = this.block;
    if (b.what === 'arrive') return t('sub.arrive');
    if (b.what === 'field' || b.what === 'close') return t('sub.field');
    const i = WHEELS.findIndex(w => w.id === this.wheel) + 1;
    const rounds = this.plan.rounds.length;
    return rounds > 1 ? t('sub.wheelRound', { i, r: this.round }) : t('sub.wheel', { i });
  }

  coachWords(what: Coach, touch: boolean): string {
    if (what === 'tap') return t(touch ? 'coach.tap' : 'coach.click');
    return t(`coach.${what}` as Key);
  }

  // ── the session's numbers ─────────────────────────────────────

  /** Rounds done in full (every wheel), and planned. */
  get roundsDone(): number {
    let n = 0;
    for (const r of this.plan.rounds) if (this.wheels.every(w => w.r[r.round - 1].done)) n++;
    return n;
  }

  /** Settle the session once (the runner's finish(), or the end): the records and the pace. */
  finish(): void {
    if (this.credited || !this.started) return;
    this.credited = true;
    const p = this.p;
    p.sessions = this.session;
    p.best = Math.max(p.best, this.score);
    p.petals += this.score;
    p.wheels += this.trueCount;
    if (this.trueCount === 12 && this.fieldReached) p.fields += 1;
    if (!this.plan.test) p.pace = learnPace(this.paceSaved, this.earned, this.sightedSec, this.paceKnown);
  }

  result(): ArcadeOutcome {
    const stats: [string, string][] = [];
    stats.push([t('stat.wheels'), t('stat.of', { n: this.trueCount, of: 12 })]);
    if (this.plan.rounds.length > 1) stats.push([t('stat.rounds'), t('stat.of', { n: this.roundsDone, of: this.plan.rounds.length })]);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    stats.push([t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })]);
    const highlights: string[] = [];
    const n = this.trueCount;
    if (n === 12 && this.fieldReached) highlights.push(t('hl.field'));
    else if (n > 0) highlights.push(t('hl.part', { n }));
    else highlights.push(t('hl.quiet'));
    if (this.plan.rounds.length > 1 && this.roundsDone === this.plan.rounds.length) highlights.push(t('hl.rounds'));
    const record = this.score > 0 && (this.bestBefore === null || this.score > this.bestBefore);
    if (record && this.bestBefore !== null) highlights.push(t('hl.record'));
    return { score: this.score, unit: unit(this.score), record, stats, highlights, verse: this.closingVerse };
  }

  /** For tests and the debug view. */
  get debug(): Record<string, unknown> {
    return {
      block: `${this.block.kind}:${this.block.what}`, t: Math.round(this.t), blockT: Math.round(this.blockT * 10) / 10, group: this.block.group,
      wheel: this.wheel, round: this.round, petals: this.score, trueCount: this.trueCount, gi: this.gi,
      pace: Math.round(paceNow(this.paceSaved, this.earned, this.sightedSec) * 100) / 100,
    };
  }
}

export type { Moment };
