/**
 * Posłaniec's session, without the DOM or the canvas (so every rule is unit-tested): the messenger's
 * run along the Roman road (track.ts makes the road ahead), the moves, the stumbles and the mule
 * cart, the drachmas and the power-ups, the blocks and what the band changes, the heights and the
 * watchtowers, the errands, the road to the seven churches and the jar (meta.ts), the finisher and
 * the session's numbers.  All numbers are in rules.ts (re-exported here).
 *
 * The hands run: lanes, jumps and slides are always the player's, and the metres accrue by
 * themselves.  The band only adds:
 *   Na wyżyny (push)     after a lead-in (5 s Mendi / 2 s HALO) `level` lights the dawn glow under the
 *                        feet and widens the drachmas' reach; `hold` climbs a ladder of light (5 s /
 *                        3 s); at its top the messenger rises onto the heights — a golden road above
 *                        the road, rich in drachmas, free of obstacles — and stays while focused (the
 *                        kit's grace), at most 12 s, then glides down onto a clear stretch.
 *   Strażnice (rest)     no obstacles, slower; a pair of watchtowers every ~2.5 s, each one's fire
 *                        kindled by `calm` as it is passed.  A passed block: the watchmen's song.
 *   Mgła (blind push)    every 4th push from the 3rd session: the ribbon is veiled and the heights do
 *                        not open; at its end the veil lifts and the judged share of its last 15 s
 *                        becomes a bonus stretch of heights (at least 2 s if it was judged at all).
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable everything brain-driven holds at neutral: the ladder keeps its rungs, the heights keep
 * their road, a tower is lit at a neutral glow — never a low value.
 *
 * Grace: a hit is a stumble (a second slowed, the drachma combo resets, the run goes on); two close
 * together and a fellow traveller's mule cart carries the messenger past the next stretch.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { CITIES, CLOAKS, TIPS, missionById, type MissionId, type MissionKind } from './content';
import { metres, t } from './i18n';
import type { Move } from './input';
import { bestFor, citiesBetween, cloaksEarned, lenKey, routeAt, turnPages, type PoslaniecProgress } from './meta';
import { GRAVITY, RULES, jumpV } from './rules';
import { PASS, Track, groundAt, type Coin, type Obstacle, type PowerKind, type QuietMode } from './track';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

/** A watchtower pair beside the road in Strażnice; `fire` is set as it is passed (null: still ahead). */
export interface Tower { readonly id: number; readonly z: number; fire: number | null; measured: boolean }

/** The heights: none, rising onto them, running on them, gliding down, the clear stretch after. */
export type HeightsMode = 'none' | 'rise' | 'high' | 'glide' | 'clear';

export type SimEvent =
  | { type: 'lane'; to: number }
  | { type: 'bump' }
  | { type: 'jump'; high: boolean }
  | { type: 'land'; hard: boolean }
  | { type: 'slide' }
  | { type: 'clear'; ob: Obstacle; how: 'jump' | 'slide' | 'lane' }
  | { type: 'stumble'; ob: Obstacle }
  | { type: 'mule' }
  | { type: 'muleEnd' }
  | { type: 'coin'; coin: Coin; combo: number }
  | { type: 'combo'; n: number; bonus: number }
  | { type: 'power'; kind: PowerKind }
  | { type: 'powerEnd'; kind: PowerKind }
  | { type: 'rung'; n: number; of: number }
  | { type: 'heights'; sec: number; bonus: boolean }
  | { type: 'glide' }
  | { type: 'heightsEnd'; sec: number }
  | { type: 'tower'; tower: Tower; lit: boolean }
  | { type: 'telegraph'; next: Block }
  | { type: 'blockStart'; block: Block; index: number }
  /** `share` and `need`: the judged window's share on the asked side and what it needed; `t0`/`t1` the block's play time */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number; pay: number }
  | { type: 'blindReveal'; sec: number; share: number }
  | { type: 'drachmas'; n: number; why: 'block' | 'song' | 'mission' | 'gift' | 'combo' }
  | { type: 'city'; city: number; lap: number }
  | { type: 'cloak'; index: number }
  | { type: 'mission'; id: MissionId }
  | { type: 'gift'; n: number }
  | { type: 'finale' }
  | { type: 'inn' };

const NO_EVENTS: readonly SimEvent[] = [];
/** The warm-up road of a first session is the same for every new player. */
const LESSON_SEED = 0x7a11e5d3;
const PLAN_SALT = 0x2545f491;
const ROAD_SALT = 0x9e3779b9;

// ── pure rules ───────────────────────────────────────────────────
/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks.  A first-ever session opens with the warm-up "Pierwsza mila" (30 s in 5 and
 * 10 min, 20 s in 3, 6 s in a 40 s test); then Na wyżyny / Strażnice pairs (25 ± 4 s and 22 ± 3 s,
 * scaled to end on time, jittered only when there is room) ending with Strażnice, leaving the last
 * 5 s to the finisher.  Short sessions (≤ 60 s) play one pair.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - R.finale);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('push', left - rest), b('rest', rest)];
  }
  const plan: Block[] = [];
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
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'rest' : 'push', dur)));
  return plan;
}

/** The running speed for the session's distance (m/s), before the block's and a stumble's factors. */
export const speedFor = (dist: number): number => RULES.vMin + (RULES.vMax - RULES.vMin) * (1 - Math.exp(-Math.max(0, dist) / RULES.vRise));

/** The road's difficulty at a distance (0..1). */
export const difficultyFor = (dist: number): number => RULES.d0 + (1 - RULES.d0) * (1 - Math.exp(-Math.max(0, dist) / RULES.dRise));

/** The blind block's bonus heights (s) for its judged share; none without a verdict. */
export const blindBonus = (share: number, judged: boolean): number =>
  judged ? Math.max(RULES.blindMin, clamp(share) * RULES.heightsMax) : 0;

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: PoslaniecProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export type Phase = 'play' | 'finale' | 'done';

export class PoslaniecSim {
  readonly p: PoslaniecProgress;
  readonly plannedSec: number;
  readonly track: Track;
  readonly trace = new SignalTrace(40, 0.1);
  readonly contrast = new BlockContrast(4);
  private readonly judge: RoundJudge;
  private readonly events: SimEvent[] = [];
  readonly lead: number;
  readonly need: number;

  started = false;
  /** this session's number in the game (1 = the first ever) */
  readonly session: number;
  /** the day's first session runs the day's road (the same for everyone) */
  readonly daily: boolean;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private blockT0 = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';
  private acc = 0;

  // the runner
  /** distance along the road (m), lane position (eased) and its target, height over the paving */
  z = 0;
  x = 0;
  lane = 0;
  y = 0;
  vy = 0;
  airborne = false;
  /** seconds of slide left; a pressed jump or slide waiting for the landing */
  slideT = 0;
  private jumpBuf = 0;
  private slideBuf = 0;
  private pending: { lane: number; t: number } | null = null;
  /** the speed now (m/s) */
  v: number = RULES.vMin;
  /** a stumble's slow-down left (s), what it passes through, the last one's play time */
  stumbleT = 0;
  private ghostZ = -Infinity;
  private lastStumble = -Infinity;
  /** the mule cart: seconds of carrying left */
  muleT = 0;
  sandalsT = 0;
  satchelT = 0;
  /** squash on landing, for the picture (1 → 0) */
  land = 0;
  /** run cycle phase (steps) */
  stride = 0;

  // the band
  reliable = false;
  /** the dawn glow under the feet (follows `level` in a sighted push past its lead-in, else fades) */
  glow = 0;
  /** the ladder: 0..1 of the way to the heights, and rungs lit */
  ladder = 0;
  rungs = 0;
  private ladderBase = 0;
  private ladderWait = 0;
  private lastHold = 0;
  private wasSighted = false;
  heights: HeightsMode = 'none';
  heightsT = 0;
  heightsLen = 0;
  private heightsBound = true;
  private heightsCoinZ = 0;
  private heightsFrom = 0;
  private relSec = 0;
  readonly towers: Tower[] = [];
  private towerIds = 0;
  private nextTowerZ = 0;
  /** where the last rest ended (m), for the difficulty's dip */
  private restEndZ = -Infinity;

  // the session's numbers
  score = 0;
  coins = 0;
  drachmaGain = 0;
  combo = 0;
  maxCombo = 0;
  stumbles = 0;
  mules = 0;
  jumps = 0;
  slides = 0;
  wagons = 0;
  powers = 0;
  heightsSec = 0;
  heightsCount = 0;
  firesLit = 0;
  towersPassed = 0;
  songs = 0;
  pushPassed = 0;
  private cleanFrom = 0;
  cleanBest = 0;
  blindSec = -1;
  readonly cities: { lap: number; city: number }[] = [];
  cloakNow: number;
  private readonly cloakBefore: number;
  private readonly done: MissionId[] = [];
  private giftNow = 0;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private settled = false;
  private banked = 0;
  private readonly metresBase: number;
  private readonly bestBefore: number | null;
  private readonly comboBefore: number;
  private onWagon: Obstacle | null = null;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.plannedSec = init.plannedSec;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.need = RULES.heightsHold[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.comboBefore = p.bestCombo;
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.metresBase = p.metres;
    this.daily = p.dailyDay !== init.day;
    this.cloakBefore = this.cloakNow = cloaksEarned(p.drachmas);
    this.plan = planBlocks(init.plannedSec, this.session === 1, this.daily ? mulberry32((init.daySeed ^ PLAN_SALT) >>> 0) : init.rng);
    const first = this.plan[0].kind === 'warmup';
    const seed = first ? LESSON_SEED : this.daily ? (init.daySeed ^ ROAD_SALT) >>> 0 : Math.floor(init.rng() * 2 ** 32) >>> 0;
    this.track = new Track(seed, 0, { lesson: first });
    this.track.fill(RULES.ahead, 0);
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind; }
  /** a sighted push past its lead-in: the band shows */
  get sighted(): boolean { return this.phase === 'play' && this.block?.kind === 'push' && !this.block.blind && this.blockT >= this.lead; }
  get resting(): boolean { return this.phase === 'play' && this.block?.kind === 'rest'; }
  /** seconds until the next block (null: the last) */
  get toNext(): number | null { return this.next ? Math.max(0, this.block.dur - this.blockT) : null; }
  /** the messenger cannot be hit: on the heights, on the mule cart */
  get safe(): boolean { return this.heights === 'rise' || this.heights === 'high' || this.heights === 'glide' || this.muleT > 0; }
  get onHeights(): boolean { return this.heights === 'rise' || this.heights === 'high' || this.heights === 'glide'; }
  get ghost(): boolean { return this.z < this.ghostZ; }
  get sliding(): boolean { return this.slideT > 0 && !this.airborne; }
  /** The warm-up's lesson: the move the next obstacle in the runner's lane asks for (null: none near). */
  get lessonHint(): Move | null {
    if (this.phase !== 'play' || this.block.kind !== 'warmup') return null;
    for (const o of this.track.obstacles) {
      if (o.hit || o.cleared || Math.abs(o.lane - this.lane) > 0.5 || o.z < this.z || o.z - this.z > 24) continue;
      const how = PASS[o.kind];
      return how === 'lane' ? (this.lane <= 0 ? 'right' : 'left') : how;
    }
    return null;
  }

  /** where the runner is on the route (all time) */
  get route() { return routeAt(this.metresBase + this.score); }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A move from a swipe, a tap or a key. */
  act(m: Move): void {
    if (!this.started || this.phase === 'done') return;
    if (m === 'left' || m === 'right') this.toLane(this.lane + (m === 'left' ? -1 : 1));
    else if (this.muleT > 0 || this.heights === 'rise' || this.heights === 'glide' || this.phase !== 'play') return;
    else if (m === 'jump') this.jump();
    else this.slide();
  }

  private toLane(to: number): void {
    const lane = Math.max(-1, Math.min(1, to));
    if (lane === this.lane) {
      this.emit({ type: 'bump' });
      return;
    }
    if (this.blocked(lane)) {
      this.pending = { lane, t: 0.45 };
      this.emit({ type: 'bump' });
      return;
    }
    this.pending = null;
    this.lane = lane;
    this.emit({ type: 'lane', to: lane });
  }

  /** A cart's or a wagon's side stands in the lane at the runner's height. */
  private blocked(lane: number): boolean {
    if (this.safe || this.ghost) return false;
    for (const o of this.track.obstacles) {
      if ((o.kind !== 'cart' && o.kind !== 'wagon') || o.lane !== lane || o.hit) continue;
      const body0 = o.z + (o.ramp ? RULES.rampLen : 0);
      const top = o.kind === 'wagon' ? RULES.wagonTop : RULES.cartTop;
      if (this.z + 0.6 > body0 && this.z - 0.3 < o.z + o.len && this.y < top - 0.3) return true;
    }
    return false;
  }

  private jump(): void {
    if (this.airborne) {
      this.jumpBuf = RULES.buffer;
      return;
    }
    this.slideT = 0;
    this.airborne = true;
    const high = this.sandalsT > 0;
    this.vy = jumpV(high ? RULES.sandalTop : RULES.jumpTop);
    this.emit({ type: 'jump', high });
  }

  private slide(): void {
    if (this.airborne) {
      // a slide in the air slams down and slides on landing
      this.vy = Math.min(this.vy, -RULES.slam);
      this.slideBuf = 0.5;
      return;
    }
    this.slideT = RULES.slideSec;
    this.emit({ type: 'slide' });
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    this.t = t;
    this.track.now = t;
    this.phaseT += dt;
    if (this.phase === 'play') this.schedule(dt, f, t);
    this.brain(dt, f);
    this.roadState();
    this.speed(dt);
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= RULES.step) {
      this.stepRun(RULES.step);
      this.acc -= RULES.step;
    }
    this.timers(dt);
    this.towersTick(f);
    const d = this.difficulty();
    this.track.fill(this.z + RULES.ahead, d);
    this.track.trim(this.z - 12);
    let n = 0;
    for (const tw of this.towers) if (tw.z > this.z - 15) this.towers[n++] = tw;
    this.towers.length = n;
    const score = Math.floor(this.z);
    if (score > this.score) {
      for (const c of citiesBetween(this.metresBase + this.score, this.metresBase + score)) {
        this.cities.push(c);
        this.emit({ type: 'city', city: c.city, lap: c.lap });
      }
      this.score = score;
    }
    this.cleanBest = Math.max(this.cleanBest, Math.floor(this.z - this.cleanFrom));
    if (this.phase === 'finale' && this.phaseT >= RULES.finale) {
      this.phase = 'done';
      this.emit({ type: 'inn' });
    }
    this.checkMissions();
  }

  private timers(dt: number): void {
    if (this.stumbleT > 0) this.stumbleT = Math.max(0, this.stumbleT - dt);
    if (this.muleT > 0) {
      this.muleT -= dt;
      if (this.muleT <= 0) {
        this.muleT = 0;
        this.emit({ type: 'muleEnd' });
      }
    }
    for (const k of ['sandals', 'satchel'] as const) {
      const key = k === 'sandals' ? 'sandalsT' : 'satchelT';
      if (this[key] > 0) {
        this[key] = Math.max(0, this[key] - dt);
        if (this[key] === 0) this.emit({ type: 'powerEnd', kind: k });
      }
    }
    if (this.pending) {
      this.pending.t -= dt;
      if (this.pending.t <= 0) this.pending = null;
      else if (!this.blocked(this.pending.lane)) {
        this.lane = this.pending.lane;
        this.pending = null;
        this.emit({ type: 'lane', to: this.lane });
      }
    }
    this.land = Math.max(0, this.land - dt * 4);
    if (this.onHeights) {
      this.heightsSec += dt;
      // the heights' drachmas, made ahead as the road goes on
      const to = this.z + RULES.ahead;
      if (this.heights === 'high' && this.heightsCoinZ < to) {
        const end = this.heightsFrom + 400;
        this.heightsCoinZ = this.track.heightsCoins(Math.max(this.heightsCoinZ, this.z + 4), Math.min(to, end));
      }
    }
  }

  private difficulty(): number {
    if (this.plan[0].kind === 'warmup' && this.blockIndex === 0) return 0;
    let d = difficultyFor(this.z);
    const since = this.z - this.restEndZ;
    if (since < 150) d -= RULES.restDip * (1 - since / 150);
    return clamp(d);
  }

  private speed(dt: number): void {
    const R = RULES;
    let want = speedFor(this.z);
    if (this.muleT > 0) want = R.muleSpeed;
    else if (this.phase === 'finale') want = Math.max(2.5, want * 0.5 * (1 - this.phaseT / R.finale));
    else if (this.phase === 'done') want = 0;
    else if (this.resting) want *= R.restSpeed;
    else if (this.onHeights) want *= R.heightsSpeed;
    this.v = approach(this.v, want, dt, this.phase === 'play' ? R.vTau : 1);
  }

  /** The speed this step: a stumble slows it for a second. */
  private get vNow(): number {
    const s = this.stumbleT / RULES.stumbleSec;
    return this.v * (1 - (1 - RULES.stumbleSlow) * s);
  }

  // ── the run (fixed steps) ───────────────────────────────────────
  private stepRun(dt: number): void {
    const R = RULES;
    // the lane eases over ~0.15 s
    this.x = this.lane + (this.x - this.lane) * Math.exp(-dt / (R.laneSec / 3));
    if (Math.abs(this.x - this.lane) < 1e-4) this.x = this.lane;
    // up and down
    if (this.heights === 'rise' || this.heights === 'glide') {
      const k = clamp(this.heightsT / (this.heights === 'rise' ? R.riseSec : R.glideSec));
      const s = k * k * (3 - 2 * k);
      this.y = this.heights === 'rise' ? R.heightsY * s + Math.sin(k * Math.PI) * 0.8 : R.heightsY * (1 - s);
      this.vy = 0;
      this.airborne = true;
    } else {
      const ground = this.heights === 'high' ? R.heightsY : groundAt(this.track.obstacles, this.x, this.z);
      if (this.airborne) {
        this.vy -= GRAVITY * dt;
        this.y += this.vy * dt;
        if (this.y <= ground && this.vy <= 0) this.touchDown(ground);
      } else if (ground >= this.y - 0.02) {
        this.y = ground;   // up a ramp, along a roof
      } else {
        this.airborne = true;   // off a roof's end
        this.vy = 0;
      }
    }
    if (this.slideT > 0 && !this.airborne) this.slideT = Math.max(0, this.slideT - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.slideBuf = Math.max(0, this.slideBuf - dt);
    if (this.heights !== 'none') this.heightsTick(dt);
    const v = this.vNow;
    this.z += v * dt;
    this.stride += (v * dt) / 1.6;
    for (const o of this.track.obstacles) if (o.kind === 'goat' && o.walking) o.lane += o.dir * R.goatSpeed * dt;
    if (this.phase !== 'done') {
      this.collide();
      this.pickUp();
    }
  }

  private touchDown(ground: number): void {
    const hard = this.vy < -12;
    this.y = ground;
    this.vy = 0;
    this.airborne = false;
    this.land = 1;
    this.emit({ type: 'land', hard });
    if (this.jumpBuf > 0) {
      this.jumpBuf = 0;
      this.jump();
    } else if (this.slideBuf > 0) {
      this.slideBuf = 0;
      this.slideT = RULES.slideSec;
      this.emit({ type: 'slide' });
    }
  }

  /** Hits and passes: what the runner meets at its z. */
  private collide(): void {
    const R = RULES, z = this.z;
    let roof: Obstacle | null = null;
    for (const o of this.track.obstacles) {
      if (o.hit || o.cleared) continue;
      if (o.kind === 'goat') this.goat(o);
      const across = Math.abs(this.x - o.lane) < R.hitHalf + (o.width - 1) / 2;
      const z0 = o.z + (o.ramp ? R.rampLen : 0);
      if (z - R.bodyHalf > o.z + o.len) {
        // passed: cleared if it stood in the runner's way
        o.cleared = true;
        if (across && !this.safe) {
          const how = PASS[o.kind];
          if (how === 'jump') this.jumps++;
          else if (how === 'slide') this.slides++;
          this.emit({ type: 'clear', ob: o, how });
        }
        continue;
      }
      if (!across || z + R.bodyHalf < z0) continue;
      if ((o.kind === 'wagon' || o.kind === 'cart') && this.y >= (o.kind === 'wagon' ? R.wagonTop : R.cartTop) - 0.3) {
        if (o.kind === 'wagon') roof = o;
        continue;
      }
      if (this.safe || this.ghost) continue;
      if (!this.hits(o)) continue;
      this.stumble(o);
    }
    if (roof && roof !== this.onWagon) this.wagons++;
    this.onWagon = roof;
  }

  /** Does the runner at its height and pose hit `o` here? */
  private hits(o: Obstacle): boolean {
    const R = RULES;
    switch (o.kind) {
      case 'wall': case 'column': return this.y < R.wallTop;
      case 'goat': return this.y < 0.75;
      case 'arch': case 'branch': return !(this.sliding && this.y < 0.3);
      case 'cart': return this.y < R.cartTop - 0.3;
      case 'wagon': return this.y < R.wagonTop - 0.3;
    }
  }

  /** A goat walks across the road once the runner is near. */
  private goat(o: Obstacle): void {
    if (!o.walking && o.z - this.z < RULES.goatWake) o.walking = true;
  }

  private stumble(o: Obstacle): void {
    const R = RULES;
    o.hit = true;
    this.stumbles++;
    this.stumbleT = R.stumbleSec;
    this.ghostZ = o.z + o.len + 0.6;
    this.slideT = 0;
    if (this.combo > 0) this.combo = 0;
    this.cleanFrom = this.z;
    this.emit({ type: 'stumble', ob: o });
    // a cart's side: step aside into a free lane if there is one
    if (o.kind === 'cart' || o.kind === 'wagon') {
      for (const l of [this.lane - 1, this.lane + 1]) {
        if (l >= -1 && l <= 1 && !this.laneTaken(l)) {
          this.lane = l;
          break;
        }
      }
    }
    if (this.t - this.lastStumble <= R.muleWindow && this.phase === 'play') {
      this.muleT = R.muleSec;
      this.mules++;
      this.lastStumble = -Infinity;
      this.emit({ type: 'mule' });
    } else this.lastStumble = this.t;
  }

  private laneTaken(lane: number): boolean {
    for (const o of this.track.obstacles) {
      if (o.hit || Math.abs(o.lane - lane) > 0.5 + (o.width - 1) / 2) continue;
      if (this.z + 6 > o.z && this.z - 1 < o.z + o.len) return true;
    }
    return false;
  }

  private pickUp(): void {
    const R = RULES;
    const satchel = this.satchelT > 0;
    const reach = satchel ? R.satchelReach : R.coinReach + R.magnetL * (this.sighted && this.reliable ? this.glow : 0);
    const depth = satchel ? R.satchelDepth : R.coinDepth;
    const top = this.sliding ? 1.0 : 2.0;
    for (const c of this.track.coins) {
      if (c.taken || Math.abs(c.z - this.z) > depth || Math.abs(c.lane - this.x) > reach) continue;
      const dy = c.y - this.y;
      if (satchel ? Math.abs(dy) > 3 : dy < -0.5 || dy > top) continue;
      c.taken = true;
      this.coins++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.addDrachmas(1, null);
      this.emit({ type: 'coin', coin: c, combo: this.combo });
      if (this.combo % R.comboStep === 0) {
        this.addDrachmas(R.comboBonus, 'combo');
        this.emit({ type: 'combo', n: this.combo, bonus: R.comboBonus });
      }
    }
    for (const p of this.track.powers) {
      if (p.taken || Math.abs(p.z - this.z) > 1 || Math.abs(p.lane - this.x) > 0.55 || this.y > 2.6) continue;
      p.taken = true;
      this.powers++;
      if (p.kind === 'sandals') this.sandalsT = R.sandalsSec;
      else this.satchelT = R.satchelSec;
      this.emit({ type: 'power', kind: p.kind });
    }
  }

  // ── the band ────────────────────────────────────────────────────
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES;
    this.reliable = f.reliable;
    this.glow = approach(this.glow, this.sighted && f.reliable ? clamp(f.level) : this.sighted ? this.glow : 0, dt, 0.35);
    if (this.glow < 1e-3 && !this.sighted) this.glow = 0;
    if (this.ladderWait > 0) this.ladderWait = Math.max(0, this.ladderWait - dt);
    if (this.sighted && this.heights === 'none') {
      if (f.reliable) {
        if (!this.wasSighted || this.ladderWait > 0) this.ladderBase = f.hold;   // the ladder counts from here
        else if (f.hold < this.ladderBase) this.ladderBase = 0;   // a new stretch of focus
        this.lastHold = f.hold;
        const held = Math.max(0, f.hold - this.ladderBase);
        this.ladder = clamp(held / this.need);
      }
      // an unreliable moment keeps the rungs (never shown as a fall)
      const rungs = Math.min(this.need, Math.floor(this.ladder * this.need + 1e-9));
      if (rungs > this.rungs) this.emit({ type: 'rung', n: rungs, of: this.need });
      this.rungs = rungs;
      if (this.ladder >= 1) this.startHeights(R.heightsMax, true);
    } else if (this.heights === 'none') {
      this.ladder = approach(this.ladder, 0, dt, 0.5);
      this.rungs = Math.min(this.rungs, Math.floor(this.ladder * this.need));
      if (f.reliable) this.lastHold = f.hold;
    }
    this.wasSighted = this.sighted;
    // the heights last while focused (the kit's grace), at most their length; a gap holds them
    if (this.heights === 'high' && this.heightsBound && f.reliable && !f.focused) this.endHeights();
  }

  private startHeights(sec: number, bound: boolean): void {
    if (this.heights !== 'none' || sec <= 0) return;
    this.heights = 'rise';
    this.heightsT = 0;
    this.heightsLen = sec;
    this.heightsBound = bound;
    this.heightsCount++;
    this.heightsFrom = this.z;
    this.heightsCoinZ = this.z + 8;
    this.slideT = 0;
    this.ladder = 1;
    this.rungs = this.need;
    this.emit({ type: 'heights', sec, bonus: !bound });
  }

  private endHeights(): void {
    if (this.heights !== 'high') return;
    this.heights = 'glide';
    this.heightsT = 0;
    this.track.clearFrom(this.z + this.v * RULES.glideSec, false);
    this.emit({ type: 'glide' });
  }

  private heightsTick(dt: number): void {
    const R = RULES;
    this.heightsT += dt;
    switch (this.heights) {
      case 'rise':
        if (this.heightsT >= R.riseSec) {
          this.heights = 'high';
          this.heightsT = 0;
          this.airborne = false;
          this.y = R.heightsY;
        }
        break;
      case 'high':
        if (this.heightsT >= this.heightsLen || this.phase !== 'play') this.endHeights();
        break;
      case 'glide':
        if (this.heightsT >= R.glideSec) {
          this.heights = 'clear';
          this.heightsT = 0;
          this.y = 0;
          this.vy = 0;
          this.airborne = false;
          this.land = 1;
          this.emit({ type: 'land', hard: false });
        }
        break;
      case 'clear':
        if (this.heightsT >= R.clearSec) {
          this.heights = 'none';
          this.ladder = 0;
          this.rungs = 0;
          this.ladderWait = R.ladderRest;
          this.emit({ type: 'heightsEnd', sec: Math.round(this.heightsLen) });
        }
        break;
      default:
        break;
    }
  }

  /** What the road ahead should be: quiet for the heights, the mule cart, a rest block and the finisher. */
  private wantQuiet(): QuietMode | null {
    if (this.phase !== 'play' || this.onHeights || this.muleT > 0) return 'none';
    if (this.block.kind === 'rest' && !(this.telegraphed && this.next)) return 'coins';
    if (this.telegraphed && this.next?.kind === 'rest') return 'coins';
    return null;
  }

  private roadState(): void {
    const want = this.wantQuiet(), now = this.track.quiet;
    if (want === now) return;
    const v = Math.max(this.v, RULES.vMin * RULES.restSpeed);
    if (want === 'none') this.track.hush(this.z + 1, 'none');
    else if (want === 'coins') {
      // a rest block starts where the runner will be when it begins (or here)
      const ahead = this.block.kind === 'rest' ? 0 : (this.toNext ?? 0);
      this.track.hush(this.z + v * ahead + 2, 'coins');
    } else {
      // the road resumes after the clear stretch, or where the rest block will end
      const clear = this.heights === 'clear' ? Math.max(0, RULES.clearSec - this.heightsT) : this.heights === 'none' ? 0.6 : RULES.clearSec;
      const rest = this.block.kind === 'rest' ? (this.toNext ?? 0) : 0;
      this.track.resume(this.z + Math.max(v * Math.max(clear, rest) + 3, 25));
    }
  }

  /** The watchtowers of Strażnice: a pair every ~2.5 s, lit by calm as they are passed. */
  private towersTick(f: FocusFrame): void {
    const R = RULES;
    if (this.resting) {
      const end = this.z + this.v * Math.max(0, this.block.dur - this.blockT - 0.5);
      if (this.nextTowerZ < this.z + 18) this.nextTowerZ = this.z + 30;
      while (this.nextTowerZ < Math.min(end, this.z + RULES.ahead)) {
        this.towers.push({ id: ++this.towerIds, z: this.nextTowerZ, fire: null, measured: false });
        this.nextTowerZ += speedFor(this.z) * R.restSpeed * R.towerEvery;
      }
    }
    for (const tw of this.towers) {
      // the watchmen kindle a tower as the messenger comes up to it (so the fire is seen blazing as he passes)
      if (tw.fire !== null || tw.z - this.z > R.kindleAhead) continue;
      const measured = this.resting && this.blockT >= this.lead && f.reliable;
      tw.fire = measured ? clamp(f.calm) : R.fireNeutral;
      tw.measured = measured;
      const lit = measured && tw.fire > R.fireLit;
      this.towersPassed++;
      if (lit) this.firesLit++;
      this.emit({ type: 'tower', tower: tw, lit });
    }
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
      if (f.reliable) this.relSec += dt;
    }
    const phase: TracePhase = b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(t, f, phase, b.kind === 'push' && b.blind);
    const last = this.blockIndex >= this.plan.length - 1;
    if (!last && !this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - R.finale) {
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
    this.blockT0 = this.t;
    this.telegraphed = false;
    this.relSec = 0;
    this.judge.reset();
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.ladder = 0;
      this.rungs = 0;
      this.ladderBase = this.lastHold;
      this.ladderWait = 0;
    } else if (b.kind === 'rest') {
      this.nextTowerZ = this.z + 30;
      // the evening comes: the heights a focus earned glide down into the watchtowers' stretch
      if (this.heights === 'high' && this.heightsBound) this.endHeights();
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  /** The line under the block's name: the first-ever blocks explain themselves, the others rotate their strategies. */
  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup[0];
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
    const b = this.block, R = RULES;
    let verdict: boolean | null = null, share = 0, need = 0, pay = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= R.minReliable ? this.judge.verdict() : null;
      if (verdict && b.kind === 'push') {
        pay = R.pushPay;
        this.pushPassed++;
        this.addDrachmas(pay, 'block');
      } else if (verdict && b.kind === 'rest') {
        pay = R.songPay;
        this.songs++;
        this.addDrachmas(pay, 'song');
      }
    }
    if (b.kind === 'rest') this.restEndZ = this.z;
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.blockT0, t1: this.t, pay });
    if (b.blind) {
      this.trace.unveil(this.t);
      const sec = blindBonus(share, verdict !== null);
      this.blindSec = Math.max(this.blindSec, Math.round(sec));
      this.emit({ type: 'blindReveal', sec: Math.round(sec), share });
      if (sec > 0 && this.phase === 'play' && this.heights === 'none') this.startHeights(sec, false);
    }
    this.judge.reset();
  }

  // ── the meta during play ────────────────────────────────────────
  private addDrachmas(n: number, why: 'block' | 'song' | 'mission' | 'gift' | 'combo' | null): void {
    this.p.drachmas += n;
    this.drachmaGain += n;
    if (why) this.emit({ type: 'drachmas', n, why });
    const c = cloaksEarned(this.p.drachmas);
    if (c > this.cloakNow) {
      this.cloakNow = c;
      this.p.cloak = c - 1;
      this.emit({ type: 'cloak', index: c - 1 });
    }
  }

  /** What an errand counts, this session. */
  missionValue(kind: MissionKind): number {
    switch (kind) {
      case 'slides': return this.slides;
      case 'heightsSec': return this.heightsSec;
      case 'coins': return this.coins;
      case 'jumps': return this.jumps;
      case 'wagons': return this.wagons;
      case 'metres': return this.score;
      case 'fires': return this.firesLit;
      case 'combo': return this.maxCombo;
      case 'powers': return this.powers;
      case 'clean': return this.cleanBest;
    }
  }

  private checkMissions(): void {
    if (this.settled) return;
    for (const id of this.p.missions) {
      if (this.done.includes(id)) continue;
      const m = missionById(id);
      if (m && this.missionValue(m.kind) >= m.target) {
        this.done.push(id);
        this.p.missionsDone++;
        this.emit({ type: 'mission', id });
        this.addDrachmas(RULES.missionPay, 'mission');
      }
    }
  }

  // ── the finisher ────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    if (this.heights === 'high') this.endHeights();
    this.muleT = 0;
    this.track.hush(this.z + 1, 'none');
    this.settle();
    this.emit({ type: 'finale' });
  }

  /**
   * The session is settled once — at the finisher, or when it ends early: the session's counters,
   * the day's gift and the day's road reach the progress, the errands turn their done pages.  Only a
   * saved session gets here or keeps it (the runner undoes an abandoned one).
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.checkMissions();
    this.settled = true;
    const p = this.p, day = this.init.day;
    if (p.giftDay !== day) {
      p.giftDay = day;
      this.giftNow = RULES.giftPay;
      this.addDrachmas(RULES.giftPay, 'gift');
      this.emit({ type: 'gift', n: RULES.giftPay });
    }
    if (this.daily) {
      p.dailyDay = day;
      p.dailyMetres = this.score;
    }
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.metres = this.metresBase + this.score;
    this.banked = this.score;
    p.lastLen = this.plannedSec;
    turnPages(p, this.done);
  }

  /** The session ends before its own finisher: settle as the finisher would (the open block is judged). */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.settle();
    this.phase = 'done';
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The pad follows the glow in a sighted push, glows mid in the warm-up, holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    const b = this.block;
    if (b.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.glow);
    return null;
  }

  /** Time is up: the session may stop once the finisher has played, or a few seconds after. */
  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reached the progress when it was settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
      p.bestCombo = Math.max(p.bestCombo, this.maxCombo);
      p.heightsBest = Math.max(p.heightsBest, Math.round(this.heightsSec));
      p.firesBest = Math.max(p.firesBest, this.firesLit);
      if (this.daily && this.settled) p.dailyMetres = Math.max(p.dailyMetres, this.score);
      if (this.settled && this.score > this.banked) {
        p.metres = this.metresBase + this.score;
        this.banked = this.score;
      }
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const r = routeAt(this.metresBase + this.score);
    const stats: [string, string][] = [
      [t('stat.drachmas'), `+${this.drachmaGain}`],
      [t('stat.heights'), this.heightsCount ? t('sec', { n: Math.round(this.heightsSec) }) : '—'],
      [t('stat.fires'), this.towersPassed ? `${this.firesLit}/${this.towersPassed}` : '—'],
      [t('stat.moves'), `${this.jumps} · ${this.slides}`],
      [t('stat.combo'), String(this.maxCombo)],
      [t('stat.stumbles'), this.stumbles ? String(this.stumbles) : '—'],
      [t('stat.route', { city: CITIES[r.next].to }), metres(r.leg - r.into)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: 'm', record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one of those the session fits, in turn from session to session:
   * a city reached is the feet that bring good news, the heights Habakkuk's deer, the watchmen's song
   * Isaiah's watchmen, a long run the race; else good news from a distant land and the word that
   * runs.  The lobby already opens with Isaiah 52:7.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.cities.length) fit.push('rom10.15');
    if (this.heightsCount > 0) fit.push('hab3.19');
    if (this.songs > 0) fit.push('isa52.8');
    if (this.score >= 2000) fit.push('php3.14', '1co9.24', 'heb12.1');
    if (fit.length < 2) fit.push('pro25.25', '2th3.1');
    return inTurn(fit, this.session || 1);
  }

  /** At most five lines for the summary, the best moments first. */
  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    for (const c of this.cities.slice(-2)) add(0, t(c.city === CITIES.length - 1 ? 'hl.lap' : 'hl.city', { city: CITIES[c.city].to, ref: CITIES[c.city].ref }));
    if (this.cloakNow > this.cloakBefore) add(1, t('hl.cloak', { name: CLOAKS[this.cloakNow - 1].name }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(2, t('hl.record', { m: metres(this.score) }));
    else if (this.maxCombo > this.comboBefore && this.comboBefore > 0) add(2, t('hl.combo', { n: this.maxCombo }));
    if (this.done.length) add(3, t('hl.missions', { list: this.done.map(id => missionById(id)!.name).join(', '), n: this.done.length }));
    if (this.daily) add(4, t('hl.daily', { m: metres(this.score) }));
    if (this.blindSec >= 0) add(5, t('hl.blind', { n: this.blindSec }));
    if (this.giftNow) add(6, t('hl.gift', { n: this.giftNow }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
