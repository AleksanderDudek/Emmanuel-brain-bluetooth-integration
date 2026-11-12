/**
 * Posłaniec's session (DESIGN.md §7.3, v2), pure: no DOM, no canvas, an event queue the view and the
 * sound drain with `take()`.
 *
 * The run is the original's: three lanes, a snappy lane change, a jump, a roll (a roll pressed in the
 * air slams down), buffered presses, parked wagons with ramps to their roofs, oncoming ox-carts,
 * fences to jump and beams to roll under, drachmas in lines and arcs, four power-ups, the score as
 * metres × the multiplier.  Grace instead of the game over: every hit is a stumble, and Bela the goat
 * comes to the messenger's heels; a second stumble while she is close and she has the letter — the
 * run ends on a tally and a new one starts a moment later.  The session goes on and its score keeps
 * what every run earned.
 *
 * The band: a push block's focus fills the wings (the stork's wind ring); full, Klekot carries the
 * messenger over the roofs along a trail of drachmas.  A rest block's road is quieter, and calm lights
 * the watchtowers' fires as they are passed: three fires and the watchmen throw a shield.  A blind
 * push hides the wings until its end.  An unreliable signal freezes the band's part at neutral.
 */
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome, Headline, SignalPhase } from '../kit/types';
import { CITIES, IN_ONE_RUN, dayWord, missionText, taskFor, type MissionKind, type PowerKind } from './content';
import { grouped, metres, t } from './i18n';
import type { Move } from './input';
import {
  citiesBetween, countMission, flightSecFor, migrate, multOf, openSet, powerSecFor, routeAt, wordComplete, wordToday, type PoslaniecProgress,
} from './meta';
import { GRAVITY, RULES, difficultyFor, jumpV, liftOf, speedFor } from './rules';
import { Companion, type Moment } from './talk';
import { LANES, Track, surfaceOf, type Lesson, type Obstacle } from './track';

export { RULES };

export type BlockKind = 'warmup' | 'push' | 'rest' | 'finale';
export interface Block { kind: BlockKind; start: number; dur: number; blind: boolean; /** the n-th of its kind this session */ n: number; /** counted toward the blind turn */ counted?: boolean }

/** What the coach marks teach: the hands, then the band's two things, then the goat. */
export type Teach = 'jump' | 'roll' | 'lane' | 'ramp' | 'wings' | 'tower' | 'goat' | `power.${PowerKind}`;

export interface RunTally { n: number; score: number; metres: number; coins: number; best: boolean; toBest: number }

export type SimEvent =
  | { type: 'lane'; dir: -1 | 1 }
  | { type: 'bump'; dir: -1 | 1 }
  | { type: 'jump'; high: boolean }
  | { type: 'roll' }
  | { type: 'slam' }
  | { type: 'land'; hard: boolean; roof: boolean }
  | { type: 'roof' }
  | { type: 'cleared'; kind: Obstacle['kind']; tight: boolean }
  | { type: 'stumble'; side: boolean; caught: boolean }
  | { type: 'shieldBreak' }
  | { type: 'caught'; tally: RunTally }
  | { type: 'newRun'; n: number }
  | { type: 'coin'; lane: number; z: number; y: number; streak: number; sky: boolean }
  | { type: 'power'; kind: PowerKind }
  | { type: 'powerEnd'; kind: PowerKind }
  | { type: 'letter'; ch: string; got: number; of: number }
  | { type: 'word'; word: string; pts: number }
  | { type: 'station'; n: number; pts: number }
  | { type: 'city'; city: number; lap: number }
  | { type: 'block'; block: Block }
  | { type: 'telegraph'; next: BlockKind; blind: boolean }
  | { type: 'verdict'; kind: 'push' | 'rest'; pass: boolean | null; blind: boolean; share: number }
  | { type: 'good' }
  | { type: 'full' }
  | { type: 'flight'; stage: 'start' | 'glide' | 'end' }
  | { type: 'reveal'; charge: number }
  | { type: 'fire'; z: number; lit: boolean | null; notches: number }
  | { type: 'shieldGift' }
  | { type: 'mission'; text: string }
  | { type: 'mult'; mult: number }
  | { type: 'teach'; what: Teach; z: number; lane: number };

export interface SimInit {
  progress: PoslaniecProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

const LW = RULES.laneW;
const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

// ── the session's plan ───────────────────────────────────────────
const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** Push and rest blocks of about 20–30 s with jitter that fit any session of 10 s or more, then the finale. */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const fin = finaleFor(plannedSec);
  const out: Block[] = [];
  let at = 0;
  const add = (kind: BlockKind, dur: number) => {
    out.push({ kind, start: at, dur, blind: false, n: out.filter(b => b.kind === kind).length });
    at += dur;
  };
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - fin);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      add('warmup', warm);
      add('push', rest / 2);
      add('rest', rest / 2);
    } else {
      const rest = Math.max(R.minBlock, Math.min(14, left / 2));
      add('push', left - rest);
      add('rest', rest);
    }
    add('finale', fin);
    return out;
  }
  let left = plannedSec - fin;
  const warm = firstEver ? (plannedSec >= 300 ? R.warm.long : R.warm.short) : R.warm.later;
  add('warmup', warm);
  left -= warm;
  const pair = R.push[0] + R.rest[0];
  const pairs = Math.max(1, Math.round(left / pair));
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) durs.push(R.push[0] + (rnd() * 2 - 1) * R.push[1], R.rest[0] + (rnd() * 2 - 1) * R.rest[1]);
  const scale = left / durs.reduce((s, d) => s + d, 0);
  durs.forEach((d, i) => add(i % 2 ? 'rest' : 'push', Math.max(R.minBlock, d * scale)));
  add('finale', fin);
  return out;
}

/** The runner on the road. */
export interface Runner {
  lane: number;
  /** across (m), up (m), vertical speed (m/s) */
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
  /** seconds of roll left; seconds since the last lane change; the last change's direction */
  rollT: number;
  laneT: number;
  laneDir: number;
  /** a press waiting to act (landing) and how long it may wait */
  buf: 'jump' | 'roll' | null;
  bufT: number;
  /** a stumble's seconds left; a bump's wobble; untouchable seconds left (after a shield broke) */
  stumbleT: number;
  bumpT: number;
  safeT: number;
  /** on a wagon's roof */
  roof: boolean;
  /** the last jump was a sandals' one */
  high: boolean;
  /** seconds since the last jump or roll began (a tight clear) */
  actT: number;
}

export interface Tower { z: number; lit: boolean | null; judged: boolean; at: number }

export interface Flight { stage: 'rise' | 'fly' | 'glide'; t: number; len: number }

export class PoslaniecSim {
  readonly p: PoslaniecProgress;
  readonly plan: Block[];
  readonly trace = new SignalTrace(40, 0.1);
  readonly talk: Companion;
  readonly word: string;
  readonly firstEver: boolean;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  private readonly events: SimEvent[] = [];
  private readonly rng: () => number;
  readonly lead: number;
  private readonly fillSec: number;
  readonly plannedSec: number;
  /** the score's best before this session (the record line) */
  readonly bestBefore: number;

  track: Track;
  started = false;
  phase: 'play' | 'caught' = 'play';
  /** the run waits at the milestone this many seconds more (the opening story's card; 0 = running) */
  held = 0;
  /** seconds of play (the runner's clock), and this frame's focus */
  t = 0;
  f: FocusFrame = { reliable: false, activity: null, threshold: 2, level: 0, focused: false, hold: 0, calm: 0 };
  blockIndex = 0;
  private telegraphed = -1;

  /** the world's distance (m) — runs continue along the same road */
  z = 0;
  /** speed (m/s) before the stumble */
  v: number = RULES.vMin;
  r: Runner = {
    lane: 0, x: 0, y: 0, vy: 0, grounded: true, rollT: 0, laneT: 9, laneDir: 0, buf: null, bufT: 0,
    stumbleT: 0, bumpT: 0, safeT: 0, roof: false, high: false, actT: 9,
  };
  /** the goat: seconds she stays at the heels; how far behind she is drawn (0 = at the heels, 1 = gone) */
  goatNear = 0;
  goatGap = 1;
  /** the power-ups' seconds left, the shield */
  readonly powers: Record<'magnet' | 'sandals' | 'double', number> = { magnet: 0, sandals: 0, double: 0 };
  shield = false;
  /** the wings: the live lift (0..1, 0.5 = the threshold) and the wind ring's charge (0..1) */
  lift = 0;
  charge = 0;
  flight: Flight | null = null;
  /** the rest road's towers, the horn's notches toward a shield */
  readonly towers: Tower[] = [];
  private nextTower = Infinity;
  notches = 0;
  /** relay stations: where the next stands (world z) and the stations of this run */
  nextStation: number = RULES.stationEvery;
  readonly stations: number[] = [];

  // the run and the session
  run = { n: 1, start: 0, score: 0, coins: 0, stumbles: 0, clean: 0 };
  tally: RunTally | null = null;
  private caughtT = 0;
  /** the score of the runs already over */
  scoreDone = 0;
  coins = 0;
  metresAll = 0;
  flights = 0;
  fires = 0;
  firesTried = 0;
  runs = 1;
  bestRunScore = 0;
  bestRunMetres = 0;
  nearMisses = 0;
  readonly cities: { city: number; lap: number }[] = [];
  readonly missionsDone: string[] = [];
  setsDone = 0;
  wordDoneNow = false;
  songs = 0;
  pushPassed = 0;
  private nextCityAt: number;
  private streak = 0;
  private streakT = 9;
  private acc = 0;
  private wentGood = false;
  private lastTeach = -99;
  private readonly taughtIds = new Set<number>();
  private settled = false;
  /** seconds since the companion's or a banner's quiet started (a block began) */
  private bannerT = 99;

  constructor(init: SimInit) {
    this.p = migrate(init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.firstEver = this.p.sessions === 0;
    this.plan = planBlocks(init.plannedSec, this.firstEver, init.rng);
    this.judge = RoundJudge.from(init.tuning);
    this.lead = init.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.fillSec = init.eeg ? RULES.fillSec.eeg : RULES.fillSec.fnirs;
    this.talk = new Companion(init.rng);
    this.bestBefore = this.p.best;
    wordToday(this.p, init.day);
    this.word = dayWord(init.daySeed);
    this.day = init.day;
    this.track = this.newTrack();
    const r = routeAt(this.p.metres);
    this.nextCityAt = this.p.metres - r.into + r.leg;
  }

  private readonly day: string;

  private newTrack(): Track {
    const tr = new Track(Math.floor(this.rng() * 2 ** 31), this.z + 30);
    tr.wantLetters = !this.p.wordDone;
    return tr;
  }

  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get blockT(): number { return this.t - this.block.start; }
  get mult(): number { return multOf(this.p); }
  get flying(): boolean { return this.flight !== null; }
  get blind(): boolean { return this.block.kind === 'push' && this.block.blind; }
  /** the score of this session so far (every run) */
  get score(): number { return this.scoreDone + this.run.score; }
  /** seconds left of the tally before the next run */
  get caughtLeft(): number { return this.phase === 'caught' ? Math.max(0, RULES.caughtSec - this.caughtT) : 0; }
  get runMetres(): number { return Math.max(0, this.z - this.run.start); }
  /** the band acts in this block now (past the lead-in, a push or a rest) */
  get bandOn(): boolean { return (this.block.kind === 'push' || this.block.kind === 'rest') && this.blockT >= this.lead; }

  take(): SimEvent[] { return this.events.splice(0); }
  private emit(e: SimEvent): void { this.events.push(e); }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.runs++;
    if (this.firstEver) {
      this.track.mode = 'lesson';
      this.track.lessons = ['jump', 'roll', 'lane', 'ramp'];
      this.talk.say('first', 3, 40);
    } else this.talk.say('open', 2, 6);
    this.beginBlock(this.block);
    this.track.fill(this.z + RULES.ahead, 0);
  }

  /**
   * Hold the run at the milestone for at most `sec` (the first-ever opening story, read before the lesson
   * road): the messenger stands, the clock, the band and the blocks go on.  Only at the very start of a
   * warm-up; a block that is not one sets off by itself.
   */
  hold(sec: number): void {
    if (this.started && this.z === 0 && this.block.kind === 'warmup') this.held = Math.max(this.held, sec);
  }

  /** Set off (a tap on the story, or its time is up): Klekot's first words wait for the lesson road's end. */
  release(): void {
    if (this.held <= 0) return;
    this.held = 0;
    if (this.firstEver) this.talk.say('first', 3, 40);
  }

  // ── the hands ──────────────────────────────────────────────────
  act(m: Move): void {
    if (!this.started || this.phase !== 'play' || this.held > 0) return;
    const r = this.r;
    if (m === 'left' || m === 'right') {
      const dir = m === 'left' ? -1 : 1;
      const to = r.lane + dir;
      this.learn('lane');
      if (to < -1 || to > 1) { r.bumpT = 0.2; r.laneDir = dir; this.emit({ type: 'bump', dir }); return; }
      if (!this.flying && this.sideBlocked(to)) { this.hit(true, null); r.bumpT = 0.25; r.laneDir = dir; this.emit({ type: 'bump', dir }); return; }
      r.lane = to;
      r.laneT = 0;
      r.laneDir = dir;
      this.count('dodges', 1);
      this.emit({ type: 'lane', dir });
      return;
    }
    if (this.flying) return;
    if (m === 'jump') {
      this.learn('jump');
      if (r.grounded) this.jump();
      else { r.buf = 'jump'; r.bufT = RULES.buffer; }
      return;
    }
    this.learn('roll');
    if (r.grounded) this.roll();
    else {
      r.vy = Math.min(r.vy, -RULES.slam);
      r.buf = 'roll';
      r.bufT = 1;
      this.emit({ type: 'slam' });
    }
  }

  private jump(): void {
    const r = this.r;
    r.rollT = 0;
    r.high = this.powers.sandals > 0;
    r.vy = jumpV(r.high ? RULES.sandalTop : RULES.jumpTop);
    r.grounded = false;
    r.actT = 0;
    this.count('jumps', 1);
    this.emit({ type: 'jump', high: r.high });
  }

  private roll(): void {
    const r = this.r;
    r.rollT = RULES.rollSec;
    r.actT = 0;
    this.count('rolls', 1);
    this.emit({ type: 'roll' });
  }

  /** A wagon's body or a cart in `lane` beside the runner, higher than a step up. */
  private sideBlocked(lane: number): boolean {
    const r = this.r;
    for (const o of this.track.obstacles) {
      if (o.lane !== lane || o.hit || (o.kind !== 'wagon' && o.kind !== 'cart')) continue;
      const z0 = o.z - (o.ramp ? RULES.rampLen : 0);
      if (this.z + 0.6 < z0 || this.z - 0.3 > o.z + o.len) continue;
      const top = o.kind === 'cart' ? RULES.wagonTop - 0.3 : surfaceOf(o, this.z + 0.3);
      if (top > r.y + RULES.stepUp) return true;
    }
    return false;
  }

  private learn(what: string): void {
    if (!this.p.taught.includes(what)) this.p.taught.push(what);
  }

  // ── the clock ──────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started) return;
    this.f = f;
    this.t = t;
    this.blocks();
    this.brain(dt);
    if (this.held > 0) {
      // at the milestone: nothing moves, Klekot keeps quiet over the story
      const left = this.block.kind === 'warmup' ? this.held - dt : 0;
      if (left > 0) {
        this.held = left;
        this.bannerT += dt;
        this.talk.update(dt, true);
        return;
      }
      this.release();
    }
    this.acc += Math.min(0.1, dt);
    let n = 0;
    while (this.acc >= RULES.step && n++ < 14) {
      this.step(RULES.step);
      this.acc -= RULES.step;
    }
    if (n >= 14) this.acc = 0;
    this.bannerT += dt;
    const b = this.block, end = b.start + b.dur;
    // quiet over the runner's banner, a telegraph and a coach mark (its bubble shares the band under the
    // HUD), and on the first-ever lesson road, where the coach marks teach one control after another
    const quiet = this.bannerT < 4.5 || (this.blockIndex < this.plan.length - 1 && t >= end - RULES.telegraph)
      || this.t - this.lastTeach < 4 || this.track.mode === 'lesson';
    this.talk.update(dt, quiet);
  }

  private blocks(): void {
    // the block plan, by the runner's clock
    while (this.blockIndex < this.plan.length - 1 && this.t >= this.block.start + this.block.dur) {
      this.endBlock(this.block);
      this.blockIndex++;
      this.beginBlock(this.block);
    }
    const b = this.block, nx = this.plan[this.blockIndex + 1];
    if (nx && this.telegraphed !== this.blockIndex && this.t >= b.start + b.dur - RULES.telegraph) {
      this.telegraphed = this.blockIndex;
      if (nx.kind === 'push') this.markBlind(nx);
      this.emit({ type: 'telegraph', next: nx.kind, blind: nx.blind });
    }
  }

  /** A push block's blindness is decided at its telegraph (so the panel can say so): every 4th from the 3rd session. */
  private markBlind(b: Block): void {
    if (b.counted) return;
    b.counted = true;
    this.p.pushes++;
    b.blind = this.p.sessions >= RULES.blindFrom - 1 && b.n > 0 && this.p.pushes % RULES.blindEvery === 0;
  }

  private beginBlock(b: Block): void {
    if (b.kind === 'push') this.markBlind(b);
    this.judge.reset();
    this.wentGood = false;
    this.bannerT = 0;
    this.talk.hush();
    this.emit({ type: 'block', block: b });
    if (b.kind === 'rest') {
      this.track.mode = 'rest';
      this.track.clearFrom(this.z + 40);
      this.nextTower = this.z + 60;
      this.talk.say('rest', 1, 9);
    } else if (b.kind === 'push') {
      this.track.mode = 'run';
      this.track.clearFrom(this.z + 40);
      this.nextTower = Infinity;
      this.talk.say(b.blind ? 'blind' : 'push', 1, 9);
    } else {
      if (b.kind === 'finale' && this.track.mode !== 'run') {
        this.track.mode = 'run';
        this.track.clearFrom(this.z + 40);
      }
      this.nextTower = Infinity;
      if (b.kind === 'finale') this.talk.say('end', 2, 8);
    }
  }

  private endBlock(b: Block): void {
    if (b.kind === 'push' || b.kind === 'rest') {
      const pass = this.judge.verdict();
      this.emit({ type: 'verdict', kind: b.kind, pass, blind: b.blind, share: this.judge.share });
      if (b.kind === 'push' && pass) {
        this.pushPassed++;
        this.pay(RULES.pushPay);
      }
      if (b.kind === 'rest' && pass) {
        this.songs++;
        this.pay(RULES.songPay);
      }
      if (b.kind === 'push' && b.blind) {
        this.trace.unveil(this.t);
        this.emit({ type: 'reveal', charge: this.charge });
        if (this.charge >= 1 && !this.flying && this.phase === 'play') this.startFlight();
      }
    }
  }

  /** The band: the trace, the judge, the contrast, the wings' lift and charge. */
  private brain(dt: number): void {
    const b = this.block, f = this.f;
    const want: TracePhase = b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(this.t, f, want, this.blind);
    if (want !== 'free') {
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    // the lift follows the level only while the signal can be used; else it rests at neutral
    const target = f.reliable ? clamp(f.level) : 0.5;
    this.lift += (target - this.lift) * (1 - Math.exp(-dt / 0.25));
    if (b.kind === 'push' && this.blockT >= this.lead && f.reliable) {
      const k = liftOf(f.level);
      if (k > 0 && !this.flying) {
        const was = this.charge;
        this.charge = Math.min(1, this.charge + (k * dt) / this.fillSec);
        if (!b.blind && was < 1 && this.charge >= 1) this.emit({ type: 'full' });
        if (!b.blind && !this.wentGood && k > 0.2) {
          this.wentGood = true;
          this.emit({ type: 'good' });
          this.talk.say('good', 1, 3);
        }
      }
      if (!b.blind && this.charge >= 1 && !this.flying && this.phase === 'play') this.startFlight();
      if (!b.blind && !this.p.taught.includes('wings')) this.teach('wings', this.z, this.r.lane);
    }
    // the flight lasts longer while the focus holds (a sighted push)
    const fl = this.flight;
    if (fl && fl.stage === 'fly' && b.kind === 'push' && !b.blind && f.reliable && f.level > 0.5 && fl.len < RULES.flightMax) {
      fl.len = Math.min(RULES.flightMax, fl.len + dt * 0.5);
    }
  }

  // ── the physics step ───────────────────────────────────────────
  private step(dt: number): void {
    if (this.phase === 'caught') {
      this.caughtT += dt;
      this.v = Math.max(0, this.v - 30 * dt);
      if (this.caughtT >= RULES.caughtSec) this.newRun();
      return;
    }
    const r = this.r, b = this.block;
    // speed
    const target = speedFor(this.runMetres) * (b.kind === 'rest' ? RULES.restSpeed : 1) * (this.flying ? RULES.flightSpeed : 1)
      * (b.kind === 'warmup' && this.firstEver ? 0.85 : 1);
    this.v += (target - this.v) * (1 - Math.exp(-dt / RULES.vTau));
    const slow = r.stumbleT > 0 ? 1 - (1 - RULES.stumbleSlow) * (r.stumbleT / RULES.stumbleSec) : 1;
    const dz = this.v * slow * dt;
    this.z += dz;
    this.score_(dz);
    // timers
    r.stumbleT = Math.max(0, r.stumbleT - dt);
    r.bumpT = Math.max(0, r.bumpT - dt);
    r.safeT = Math.max(0, r.safeT - dt);
    r.laneT += dt;
    r.actT += dt;
    this.streakT += dt;
    if (this.streakT > 1.2) this.streak = 0;
    this.goatNear = Math.max(0, this.goatNear - dt);
    this.goatGap += ((this.goatNear > 0 ? 0 : 1) - this.goatGap) * (1 - Math.exp(-dt / (this.goatNear > 0 ? 0.35 : 1.4)));
    for (const k of ['magnet', 'sandals', 'double'] as const) {
      if (this.powers[k] > 0) {
        this.powers[k] = Math.max(0, this.powers[k] - dt);
        if (this.powers[k] === 0) this.emit({ type: 'powerEnd', kind: k });
      }
    }
    // across: a snappy move toward the lane
    const want = r.lane * LW, step = (LW / RULES.laneSec) * dt;
    r.x = Math.abs(want - r.x) <= step ? want : r.x + Math.sign(want - r.x) * step;
    // the carts roll toward the runner once near
    for (const o of this.track.obstacles) {
      if (o.kind !== 'cart') continue;
      if (!o.rolling && o.meet - this.z < 75) {
        o.rolling = true;
        o.z = o.meet + (RULES.cartSpeed * (o.meet - this.z)) / Math.max(6, this.v);
      }
      if (o.rolling) o.z -= RULES.cartSpeed * dt;
    }
    if (this.flight) this.flyStep(dt);
    else this.bodyStep(dt);
    this.pickups();
    this.passing();
    this.roadside();
    // the road ahead
    const d = this.block.kind === 'rest' ? Math.max(0, difficultyFor(this.runMetres) - RULES.restDip) : difficultyFor(this.runMetres);
    this.track.wantLetters = !this.p.wordDone;
    this.track.fill(this.z + RULES.ahead, this.block.kind === 'warmup' ? Math.min(d, 0.15) : d);
    if (this.track.mode === 'lesson' && !this.track.lessons.length) {
      const left = (['jump', 'roll', 'lane', 'ramp'] as Lesson[]).filter(k => !this.p.taught.includes(k));
      if (left.length && this.block.kind === 'warmup') this.track.lessons = left;
      else this.track.mode = this.block.kind === 'rest' ? 'rest' : 'run';
    }
    this.track.prune(this.z);
    this.teaching();
  }

  private score_(dz: number): void {
    const run = this.run;
    run.score += dz * RULES.perMetre * this.mult * (this.powers.double > 0 ? 2 : 1);
    this.metresAll += dz;
    this.p.metres += dz;
    if (this.r.stumbleT <= 0) run.clean += dz;
    if (this.p.metres >= this.nextCityAt) {
      for (const c of citiesBetween(this.nextCityAt - 1e-6, this.p.metres)) {
        this.cities.push(c);
        this.emit({ type: 'city', city: c.city, lap: c.lap });
        this.talk.say('city', 3, 6);
      }
      const ra = routeAt(this.p.metres);
      this.nextCityAt = this.p.metres - ra.into + ra.leg;
    }
    if (this.z >= this.nextStation) {
      this.nextStation += RULES.stationEvery;
      const pts = RULES.stationPts * this.mult;
      run.score += pts;
      this.stations.push(this.z);
      this.p.stations++;
      this.emit({ type: 'station', n: this.stations.length, pts });
      this.talk.say('station', 1, 3);
      this.count('stations', 1);
    }
    this.count('metresRun', this.runMetres);
    this.count('cleanRun', run.clean);
  }

  /** On foot: gravity, roofs and ramps, the barriers. */
  private bodyStep(dt: number): void {
    const r = this.r;
    if (r.rollT > 0) r.rollT = Math.max(0, r.rollT - dt);
    if (r.bufT > 0) { r.bufT -= dt; if (r.bufT <= 0) r.buf = null; }
    r.vy -= GRAVITY * dt;
    r.y += r.vy * dt;
    // the ground under the runner: the paving, a ramp, a roof — and what is too high to step on is a hit
    let ground = 0;
    for (const o of this.track.obstacles) {
      if (o.hit || Math.abs(r.x - o.lane * LW) > LW * 0.45) continue;
      const z0 = o.z - (o.ramp ? RULES.rampLen : 0);
      if (this.z + RULES.bodyHalf < z0 || this.z - RULES.bodyHalf > o.z + o.len) continue;
      if (o.kind === 'wagon') {
        const s = surfaceOf(o, Math.min(o.z + o.len, Math.max(z0, this.z)));
        if (s > r.y + RULES.stepUp) this.hit(false, o);
        else ground = Math.max(ground, s);
      } else if (o.kind === 'cart') {
        if (r.y < RULES.wagonTop - 0.3) this.hit(false, o);
      } else if (o.kind === 'low') {
        if (r.y < RULES.lowTop - 0.2) this.hit(false, o);
      } else if (r.y + (r.rollT > 0 ? RULES.rollH : RULES.bodyH) > RULES.highGap && r.y < RULES.highTop) this.hit(false, o);
    }
    if (r.y <= ground) {
      const was = r.grounded, vy = r.vy;
      r.y = ground;
      r.vy = 0;
      r.grounded = true;
      const roof = ground >= RULES.wagonTop - 0.01;
      if (roof && !r.roof) {
        this.count('roofs', 1);
        this.learn('ramp');
        this.emit({ type: 'roof' });
      }
      r.roof = roof;
      if (!was) {
        this.emit({ type: 'land', hard: vy < -12, roof });
        const buf = r.buf;
        r.buf = null;
        if (buf === 'jump') this.jump();
        else if (buf === 'roll') this.roll();
      }
    } else if (r.y > ground + 0.05) {
      if (r.grounded && r.vy <= 0 && r.y - ground < 0.3) {
        // a small step down (off the end of a ramp's top or between wagons): keep the feet on it
        r.y = ground;
        r.vy = 0;
      } else {
        r.grounded = false;
        if (ground < RULES.wagonTop - 0.01) r.roof = false;
      }
    }
  }

  /** Carried by the stork: up, along the trail of drachmas, and down onto a clear stretch. */
  private flyStep(dt: number): void {
    const fl = this.flight!, r = this.r;
    fl.t += dt;
    r.rollT = 0;
    r.buf = null;
    r.grounded = false;
    if (fl.stage === 'rise') {
      r.y += (RULES.flightY - r.y) * (1 - Math.exp(-dt / 0.25));
      if (fl.t >= RULES.flightRise) { fl.stage = 'fly'; fl.t = 0; }
    } else if (fl.stage === 'fly') {
      r.y = RULES.flightY + Math.sin(this.t * 3) * 0.15;
      if (fl.t >= fl.len) {
        fl.stage = 'glide';
        fl.t = 0;
        const land = this.z + this.v * RULES.flightGlide;
        this.track.clearStretch(this.z, land + RULES.landClear);
        this.emit({ type: 'flight', stage: 'glide' });
      }
    } else {
      const k = clamp(fl.t / RULES.flightGlide);
      r.y = RULES.flightY * (1 - k * k);
      if (k >= 1) {
        r.y = 0;
        r.vy = 0;
        r.grounded = true;
        r.roof = false;
        this.flight = null;
        r.safeT = Math.max(r.safeT, 0.6);
        this.emit({ type: 'flight', stage: 'end' });
        this.emit({ type: 'land', hard: false, roof: false });
        this.talk.say('land', 1, 3);
      }
    }
  }

  private startFlight(): void {
    this.charge = 0;
    const len = flightSecFor(this.p.ups.wings);
    this.flight = { stage: 'rise', t: 0, len };
    this.flights++;
    this.p.flights++;
    this.r.stumbleT = 0;
    this.goatNear = 0;
    this.track.skyTrail(this.z + 10, this.v * RULES.flightSpeed * (len + RULES.flightRise));
    this.count('flights', 1);
    this.emit({ type: 'flight', stage: 'start' });
    this.talk.say('flight', 3, 3);
  }

  /** Something was hit: the shield takes it, else a stumble; a second while the goat is close ends the run. */
  private hit(side: boolean, o: Obstacle | null): void {
    const r = this.r;
    if (o) o.hit = true;
    if (r.safeT > 0) return;
    if (this.shield) {
      this.shield = false;
      r.safeT = RULES.shieldGrace;
      this.count('shields', 1);
      this.emit({ type: 'shieldBreak' });
      this.talk.say('shield', 2, 3);
      return;
    }
    r.stumbleT = RULES.stumbleSec;
    r.safeT = 0.5;
    r.rollT = 0;
    this.run.stumbles++;
    this.run.clean = 0;
    this.streak = 0;
    const lesson = this.block.kind === 'warmup' && this.firstEver;
    const caught = this.goatNear > 0 && !lesson;
    this.emit({ type: 'stumble', side, caught });
    if (caught) { this.caught(); return; }
    if (!lesson) {
      this.goatNear = RULES.goatNear;
      if (!this.p.taught.includes('goat')) this.teach('goat', this.z, r.lane);
      this.talk.say(this.run.stumbles === 1 ? 'goat' : 'stumble', 2, 2);
    } else this.talk.say('stumble', 1, 2);
  }

  private caught(): void {
    const metres = this.runMetres, score = Math.floor(this.run.score);
    const prevBest = this.p.bestRun;
    const best = score > prevBest;
    this.p.bestRun = Math.max(this.p.bestRun, score);
    this.p.bestMetres = Math.max(this.p.bestMetres, Math.floor(metres));
    this.bestRunScore = Math.max(this.bestRunScore, score);
    this.bestRunMetres = Math.max(this.bestRunMetres, metres);
    this.tally = { n: this.run.n, score, metres: Math.floor(metres), coins: this.run.coins, best, toBest: best ? 0 : Math.max(0, prevBest - score) };
    this.phase = 'caught';
    this.caughtT = 0;
    this.flight = null;
    this.emit({ type: 'caught', tally: this.tally });
    this.talk.clear();
    this.talk.say('caught', 3, 2);
  }

  private newRun(): void {
    this.scoreDone += this.run.score;
    this.run = { n: this.run.n + 1, start: this.z, score: 0, coins: 0, stumbles: 0, clean: 0 };
    this.runs++;
    this.p.runs++;
    this.phase = 'play';
    this.tally = null;
    this.goatNear = 0;
    this.goatGap = 1;
    this.v = RULES.vMin;
    for (const k of ['magnet', 'sandals', 'double'] as const) this.powers[k] = 0;
    this.shield = false;
    const r = this.r;
    Object.assign(r, { y: 0, vy: 0, grounded: true, rollT: 0, buf: null, stumbleT: 0, safeT: 1, roof: false });
    this.nextStation = this.z + RULES.stationEvery;
    this.track.clearStretch(this.z - 5, this.z + 40);
    this.emit({ type: 'newRun', n: this.run.n });
  }

  /** Drachmas, power-ups and the day's letters within reach. */
  private pickups(): void {
    const r = this.r, magnet = this.powers.magnet > 0;
    const body = r.y + (r.rollT > 0 ? 0.4 : 0.9);
    for (const c of this.track.coins) {
      if (c.taken) continue;
      const dz = c.z - this.z;
      if (c.sky !== this.flying || dz > (magnet ? RULES.magnetDepth : RULES.coinDepth) || dz < -RULES.coinDepth) continue;
      if (Math.abs(c.lane * LW - r.x) > (magnet ? RULES.magnetReach : RULES.coinReach) * LW) continue;
      if (Math.abs(c.y - (this.flying ? r.y + 0.3 : body)) > (magnet ? 4 : 1.3)) continue;
      c.taken = true;
      this.streak++;
      this.streakT = 0;
      this.coins++;
      this.run.coins++;
      this.pay(1);
      this.count('coins', 1);
      this.count('coinsRun', this.run.coins);
      this.emit({ type: 'coin', lane: c.lane, z: c.z, y: c.y, streak: this.streak, sky: c.sky });
    }
    for (const p of this.track.powers) {
      if (p.taken || Math.abs(p.z - this.z) > 1.1 || Math.abs(p.lane * LW - r.x) > LW * 0.55 || Math.abs(p.y - body) > 1.6) continue;
      p.taken = true;
      if (p.kind === 'shield') this.shield = true;
      else this.powers[p.kind] = powerSecFor(this.p.ups[p.kind]);
      this.count('powers', 1);
      this.emit({ type: 'power', kind: p.kind });
      const key: Teach = `power.${p.kind}`;
      if (!this.p.taught.includes(key)) { this.learn(key); this.coach(key, p.z, p.lane); }
      else this.talk.say('power', 1, 2);
    }
    for (const l of this.track.letters) {
      if (l.taken || this.p.wordDone || Math.abs(l.z - this.z) > 1.1 || Math.abs(l.lane * LW - r.x) > LW * 0.55 || Math.abs(l.y - body) > 1.6) continue;
      l.taken = true;
      const ch = this.word[Math.min(this.word.length - 1, this.p.wordGot)] ?? '';
      this.p.wordGot = Math.min(this.word.length, this.p.wordGot + 1);
      this.count('letters', 1);
      this.emit({ type: 'letter', ch, got: this.p.wordGot, of: this.word.length });
      if (this.p.wordGot >= this.word.length) {
        wordComplete(this.p, this.day);
        this.wordDoneNow = true;
        const pts = RULES.wordPts * this.mult;
        this.run.score += pts;
        this.pay(RULES.wordPay);
        this.emit({ type: 'word', word: this.word, pts });
        this.talk.say('word', 3, 4);
      }
    }
  }

  /** Obstacles left behind: cleared by a move (a tight one is a near miss). */
  private passing(): void {
    const r = this.r;
    for (const o of this.track.obstacles) {
      if (o.passed || o.z + o.len > this.z - RULES.bodyHalf) continue;
      o.passed = true;
      if (o.hit || o.lane !== r.lane || this.flying) continue;
      if (o.kind === 'low' || o.kind === 'high') {
        const tight = r.actT < 0.32;
        if (tight) this.nearMisses++;
        this.emit({ type: 'cleared', kind: o.kind, tight });
        if (tight && this.rng() < 0.35) this.talk.say('near', 1, 2);
      }
    }
  }

  /** The rest road's towers: calm, when one is passed, lights its fire; three fires throw a shield. */
  private roadside(): void {
    if (this.block.kind === 'rest' && this.z + 90 >= this.nextTower) {
      if (this.blockT + (this.nextTower - this.z) / Math.max(6, this.v) < this.block.dur - 1) this.towers.push({ z: this.nextTower, lit: null, judged: false, at: this.t });
      this.nextTower += RULES.towerEvery;
    }
    for (const tw of this.towers) {
      if (tw.judged || tw.z > this.z) continue;
      tw.judged = true;
      const f = this.f;
      if (this.block.kind !== 'rest' || this.blockT < this.lead || !f.reliable) {
        tw.lit = null;
        this.emit({ type: 'fire', z: tw.z, lit: null, notches: this.notches });
        continue;
      }
      this.firesTried++;
      tw.lit = f.calm >= RULES.fireLit;
      if (tw.lit) {
        this.fires++;
        this.p.fires++;
        this.notches++;
        this.run.score += RULES.firePts * this.mult;
        this.count('fires', 1);
        if (this.notches >= RULES.hornNotches) {
          this.notches = 0;
          if (this.shield) this.run.score += RULES.firePts * 3 * this.mult;
          this.shield = true;
          this.emit({ type: 'shieldGift' });
        } else if (this.rng() < 0.5) this.talk.say('fire', 1, 3);
      }
      this.emit({ type: 'fire', z: tw.z, lit: tw.lit, notches: this.notches });
    }
    while (this.towers.length && this.towers[0].z < this.z - 30) this.towers.shift();
    if (this.block.kind === 'rest' && this.blockT >= this.lead && !this.p.taught.includes('tower')) {
      const next = this.towers.find(tw => !tw.judged && tw.z - this.z < 40 && tw.z - this.z > 15);
      if (next) { this.learn('tower'); this.coach('tower', next.z, 1); }
    }
  }

  /** The coach marks for the hands: the first fence, beam, wagon or ramp in the runner's lane, until each was done once. */
  private teaching(): void {
    if (this.t - this.lastTeach < 2.5 || this.flying || this.phase !== 'play') return;
    const r = this.r;
    for (const o of this.track.obstacles) {
      const ahead = o.z - (o.ramp ? RULES.rampLen : 0) - this.z;
      if (ahead < 14 || ahead > 34 || o.lane !== r.lane || this.taughtIds.has(o.id)) continue;
      const what: Teach | null = o.kind === 'low' ? 'jump' : o.kind === 'high' ? 'roll' : o.ramp ? 'ramp' : 'lane';
      if (this.p.taught.includes(what)) continue;
      this.taughtIds.add(o.id);
      this.teach(what, o.z, o.lane);
      return;
    }
  }

  private teach(what: Teach, z: number, lane: number): void {
    if (this.t - this.lastTeach < 2.5) return;
    if (what === 'wings' || what === 'goat') this.learn(what);
    this.coach(what, z, lane);
  }

  /** A coach mark now: Klekot breaks off and keeps quiet while it shows (both share the band under the HUD). */
  private coach(what: Teach, z: number, lane: number): void {
    this.lastTeach = this.t;
    this.talk.hush();
    this.emit({ type: 'teach', what, z, lane });
  }

  private pay(n: number): void {
    this.p.drachmas += n;
    this.p.drachmasAll += n;
  }

  /** Count toward the open missions; a done one pops, a done set raises the multiplier. */
  private count(kind: MissionKind, n: number): void {
    if (!this.started) return;
    const set = openSet(this.p);
    if (!set.some(m => m.kind === kind)) return;
    if (IN_ONE_RUN.has(kind) && n <= 0) return;
    const { done, setDone } = countMission(this.p, kind, n);
    for (const i of done) {
      const text = missionText(set[i]);
      this.missionsDone.push(text);
      this.emit({ type: 'mission', text });
      this.talk.say('mission', 2, 3);
    }
    if (setDone) {
      this.setsDone++;
      this.emit({ type: 'mult', mult: this.mult });
      this.talk.say('mult', 3, 4);
    }
  }

  // ── for the runner ─────────────────────────────────────────────
  signal(): SignalPhase {
    if (!this.started) return { want: 'free', blind: false };
    const b = this.block, nx = this.plan[this.blockIndex + 1];
    const want: TracePhase = b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    const left = Math.max(0, b.start + b.dur - this.t);
    const next = nx && left <= RULES.telegraph ? (nx.kind === 'push' ? 'focus' : nx.kind === 'rest' ? 'rest' : 'free') : null;
    const task = b.kind === 'push' ? taskFor(b.blind ? 'blind' : 'push', b.n) : b.kind === 'rest' ? taskFor('rest', b.n) : undefined;
    return { want, blind: this.blind, task, left: want === 'free' ? undefined : left, next };
  }

  /** The panel's gauge: the wings' lift in a push (0.5 = the threshold), the fire's calm in a rest. */
  meter(): number | null {
    const f = this.f;
    if (!f.reliable || this.blind) return null;
    return this.block.kind === 'rest' ? clamp(f.calm) : clamp(f.level);
  }

  headline(): Headline {
    const sub = this.phase === 'caught' ? t('head.caught') : t('head.sub', { mult: this.mult, m: metres(Math.floor(this.runMetres)) });
    return { value: Math.floor(this.score), sub };
  }

  /** The pad follows the level in a sighted push past its lead-in, else holds still. */
  padLevel(f: FocusFrame): number | null {
    return this.block.kind === 'push' && !this.blind && this.blockT >= this.lead && f.reliable ? f.level : null;
  }

  canStop(): boolean {
    if (!this.flight) return true;
    return this.flight.stage === 'glide' || (this.flight.stage === 'fly' && this.flight.len - this.flight.t < RULES.settle);
  }

  /** Settle the session once: the sessions, the records. */
  finish(): void {
    if (this.settled) return;
    this.settled = true;
    if (this.phase === 'play') {
      this.p.bestRun = Math.max(this.p.bestRun, Math.floor(this.run.score));
      this.p.bestMetres = Math.max(this.p.bestMetres, Math.floor(this.runMetres));
    }
    this.p.sessions++;
    this.p.best = Math.max(this.p.best, Math.floor(this.score));
  }

  result(): ArcadeOutcome {
    const score = Math.floor(this.score);
    const runM = Math.max(this.bestRunMetres, this.phase === 'play' ? this.runMetres : 0);
    const stats: [string, string][] = [
      [t('stat.metres'), metres(Math.floor(this.metresAll))],
      [t('stat.runs'), String(this.runs)],
      [t('stat.longest'), metres(Math.floor(runM))],
      [t('stat.drachmas'), grouped(this.coins)],
      [t('stat.mult'), `×${this.mult}`],
    ];
    if (this.flights) stats.push([t('stat.flights'), String(this.flights)]);
    if (this.firesTried) stats.push([t('stat.fires'), `${this.fires}/${this.firesTried}`]);
    const hl: string[] = [];
    for (const c of this.cities) hl.push(t('hl.city', { city: CITIES[c.city].name, ref: CITIES[c.city].ref }));
    if (this.setsDone) hl.push(t('hl.mult', { mult: this.mult }));
    if (this.wordDoneNow) hl.push(t('hl.word', { word: this.word }));
    if (this.flights) hl.push(t('hl.flights', { n: this.flights }));
    if (this.songs) hl.push(t('hl.song', { n: this.songs }));
    const runScore = Math.max(this.bestRunScore, this.phase === 'play' ? Math.floor(this.run.score) : 0);
    if (this.bestBefore > 0 && score <= this.bestBefore) hl.push(t('hl.toBest', { n: grouped(this.bestBefore - score + 1) }));
    else if (runScore > 0 && this.bestRunScore > 0 && runScore >= this.p.bestRun) hl.push(t('hl.bestRun', { n: grouped(runScore) }));
    hl.push(t(this.cities.length ? 'hl.close.city' : this.flights ? 'hl.close.flight' : 'hl.close'));
    const n = this.p.sessions || 1;
    const verse: PassageId = this.cities.length ? 'rom10.15' : this.flights ? 'hab3.19' : this.songs ? 'isa52.8'
      : runM >= 1500 ? inTurn(['php3.14', '1co9.24', 'heb12.1'], n) : inTurn(['pro25.25', '2th3.1'], n);
    return {
      score, unit: t('unit'), record: score > 0 && score > this.bestBefore, stats, highlights: hl, verse,
    };
  }

  /** The lanes, for the view. */
  static readonly LANES = LANES;
  /** The story moment the companion is asked for (the view and the tests). */
  say(m: Moment, prio = 1): void { this.talk.say(m, prio); }
}
