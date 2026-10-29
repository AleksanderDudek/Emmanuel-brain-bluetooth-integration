/**
 * Wzlot's session, without the DOM or the canvas (so every rule is unit-tested): the eaglet's
 * flight over the wilderness hills (flight.ts, terrain.ts), the blocks, what the band changes, the
 * parent's catch, the thermals, the flight log, the plumage and the vistas (meta.ts), the finisher
 * and the session's numbers.  All numbers are in rules.ts (re-exported here).
 *
 * The hands fly: hold to fold the wings and dive, let go to glide.  The band only adds:
 *   Lekcja lotu (push)  after a lead-in, the wings open with the level, smoothed again:
 *                       W = max(0.55, 0.3 + 0.6 L); every full 6 s of hold is a follow step in the
 *                       parent's wake (+4 % up to +12 %); a lapse sends the parent circling back and
 *                       a return after it is celebrated (+8 % for 4 s, gold within 10 s), at most 3
 *                       a block, never rewarding the lapse itself.
 *   Wznoszenie (rest)   calm builds the thermals' strength T; a thermal glided into lifts the
 *                       eaglet (0.6 + 1.4 T) sh/s for (1 + 2 T) s, and a climb above 3 sh opens a vista.
 *   W chmurze (blind)   every 4th Lekcja from the 3rd session: nothing shows and nothing changes;
 *                       at its exit, its last 15 s of focus open a bonus thermal of that strength.
 * Each block is judged once at its end (RoundJudge, the session's tuning): a passed block grows a
 * feather; a passed Wznoszenie makes the next one's first thermal strong.  While the signal is
 * unreliable a mist fills the valleys and everything brain-driven holds at neutral; a block with
 * under 8 reliable seconds has no verdict and floors its thermals at 0.4.  The block clock runs on.
 *
 * Grace and craft: the parent's catch, the base progress (feathers for showing up) and the day's
 * gift never wait on the band; the band adds lift, airtime, height, returns and rarer vistas.
 * Payouts (a feather, a vista, the blind reveal) land after a block's judged window, at its end.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import { STAGES, TIPS, VISTAS, missionById, type Light, type MissionId, type MissionKind } from './content';
import { Eaglet, type FlightEvent, type Landing } from './flight';
import { metres, t } from './i18n';
import { bestFor, drawVista, lenKey, pityDue, stageOf, turnPages, type WzlotProgress } from './meta';
import { RULES } from './rules';
import { Terrain, type Ridge, type RidgeSpec } from './terrain';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'lekcja' | 'wzn';
export interface Block { kind: BlockKind; dur: number; blind: boolean; stretch: boolean }

/** A thermal over a valley: its column's centre and floor, a fixed strength (the blind bonus) or the block's live T. */
export interface Thermal {
  readonly id: number;
  readonly x: number;
  readonly base: number;
  readonly fixed: number | null;
  /** added to the live T (a passed Wznoszenie's strong first thermal) and the neutral floor */
  readonly bonus: number;
  floor: number;
  used: boolean;
  /** seconds since it rose (the picture fades it in) */
  age: number;
}

/** Where the parent is (the picture places it): ahead in a Lekcja, circling back on a lapse, under the eaglet in a catch. */
export type ParentMode = 'away' | 'telegraph' | 'ahead' | 'circling' | 'cloud' | 'catch' | 'nest';

export type SimEvent =
  | { type: 'land'; cls: Landing; deg: number; chain: number; soaring: boolean }
  | { type: 'soar' }
  | { type: 'soarEnd' }
  | { type: 'launch' }
  /** the crag ("Grań"): the eaglet reached its ridge's high point */
  | { type: 'crag'; index: number }
  | { type: 'catch'; why: 'roll' | 'wadi' }
  | { type: 'carried' }
  | { type: 'telegraph'; next: Block }
  | { type: 'blockStart'; block: Block; index: number }
  /** `share` and `need`: the judged window's share on the asked side and the share it needed */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'feather'; total: number; why: 'block' | 'mission' | 'gift' | 'session' }
  | { type: 'stage'; stage: 2 | 3 }
  | { type: 'step'; bonus: number }
  | { type: 'lapse' }
  | { type: 'back' }
  | { type: 'return'; lapse: number; gold: boolean }
  | { type: 'thermalRise'; thermal: Thermal }
  | { type: 'thermal'; T: number }
  | { type: 'climbTop'; height: number }
  | { type: 'vistaSeen'; light: Light }
  | { type: 'vista'; index: number; isNew: boolean; via: 'climb' | 'craft' | 'pity' }
  | { type: 'mission'; id: MissionId }
  | { type: 'blindReveal'; sec: number; T: number }
  | { type: 'wingbeat' }
  | { type: 'gift'; feathers: number }
  | { type: 'finale' }
  | { type: 'nest' };

const NO_EVENTS: readonly SimEvent[] = [];
/** The warm-up ridge of a first session is the same for every new player. */
const WARM_SEED = 0x51f2e3d4;
/** The session's later ridges and its plan draw from their own streams. */
const PLAN_SALT = 0x2545f491;

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
 * The session's blocks.  A first-ever session opens with the warm-up "Pierwsze zbocza" (30 s in 5
 * and 10 min, 20 s in 3, 6 s in a 40 s test); then Lekcja / Wznoszenie pairs (24 ± 4 s and 23 ± 3 s,
 * scaled to end on time, jittered only when there is room) ending with a Wznoszenie, leaving the
 * last 6 s to the finisher.  40 s: warm-up 6, Lekcja 14, Wznoszenie 14 (else Lekcja 20, Wznoszenie
 * 14).  No block under 12 s.  In sessions of 5 min or more one Lekcja is the stretch "Długi przelot".
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false, stretch: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - R.finale);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('lekcja', rest / 2), b('wzn', rest / 2)];
    }
    const wzn = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('lekcja', left - wzn), b('wzn', wzn)];
  }
  const plan: Block[] = [];
  let left = plannedSec - R.finale;
  if (firstEver) {
    const warm = plannedSec >= 300 ? R.warm.long : R.warm.short;
    plan.push(b('warmup', warm));
    left -= warm;
  }
  const pair = R.lekcja[0] + R.wzn[0];
  const pairs = Math.max(1, Math.round(left / pair));
  const jitter = pairs >= 2 && left / (pairs * pair) >= 0.85 ? 1 : 0;
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) durs.push(R.lekcja[0] + jitter * (rnd() * 2 - 1) * R.lekcja[1], R.wzn[0] + jitter * (rnd() * 2 - 1) * R.wzn[1]);
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, R.minBlock);
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'wzn' : 'lekcja', dur)));
  if (plannedSec >= R.stretchFrom) {
    // the stretch: the Lekcja in the middle of the session (never its first)
    const lekcje = plan.filter(x => x.kind === 'lekcja');
    if (lekcje.length >= 2) lekcje[Math.floor(lekcje.length / 2)].stretch = true;
  }
  return plan;
}

/** Wing lift in a sighted Lekcja for the smoothed level L: the band can only add. */
export const wingsFor = (L: number): number => Math.max(RULES.wNeutral, RULES.w0 + RULES.wL * clamp(L));

/** Follow steps: +4 % per full 6 s of hold, up to +12 %. */
export const followFor = (hold: number): number =>
  Math.min(RULES.stepMax, Math.floor(Math.max(0, hold) / RULES.holdStep) * RULES.stepBonus);

/** A thermal of strength T: its climb rate (sh/s) and how long it lifts (s). */
export const climbFor = (T: number): { rate: number; dur: number } => ({
  rate: RULES.climbRate[0] + RULES.climbRate[1] * clamp(T),
  dur: RULES.climbDur[0] + RULES.climbDur[1] * clamp(T),
});

/** The median of a list (null when empty). */
export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: WzlotProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning (the kit's defaults, the game's entry, a beginner's bias): the blocks' judges follow it */
  tuning: FocusTuning;
}

export type Phase = 'play' | 'finale' | 'done';

/** The finisher's path to the nest: a spiral up on a guaranteed thermal, a glide in, the parent beside. */
export interface Finale { x0: number; y0: number; nx: number; ny: number }

/** A lapse in a sighted Lekcja: none, drifting (`t` s so far), or back but not yet held long enough. */
type LapseState = 'none' | 'lapse' | 'back';

export class WzlotSim {
  readonly p: WzlotProgress;
  readonly plannedSec: number;
  readonly terrain: Terrain;
  readonly eaglet: Eaglet;
  private readonly rng: () => number;
  private readonly ridgeRng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  private readonly events: SimEvent[] = [];
  private readonly lead: number;
  private readonly tLead: number;
  private readonly tauL: number;
  private readonly ret: { lapse: number; hold: number };

  started = false;
  /** this session's number in the game (1 = the first ever) */
  readonly session: number;
  /** the day's first session: its first ridge ("Grań dnia") comes from the date */
  readonly daily: boolean;
  /** the ridge index of the day's ridge (−1: none this session) */
  readonly dailyRidge: number;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  /** play time (s) and the last frame's */
  t = 0;
  tip = '';
  /** the warm-up's ghost hand: no touch for a while */
  hint = false;
  private lastInput = 0;

  // the hands
  private readonly pointers = new Set<number>();
  private readonly keys = new Set<string>();
  /** a wingbeat consumes the press that made it */
  private beatLock = false;
  private lastDown = -1;
  private beatRidge = -1;
  private acc = 0;

  // the band
  reliable = false;
  /** the mist over the valleys, 0..1 (follows reliability) */
  fog = 0;
  /** the level smoothed again; the wings' target and what they show now */
  L = 0.3;
  W: number = RULES.wNeutral;
  wShown: number = RULES.wNeutral;
  /** the follow steps' bonus and its decay; a return's wingbeat (s left); the hold counted in this Lekcja */
  follow = 0;
  private followDecay = 0;
  retT = 0;
  private hold = 0;
  private rawHold = 0;
  private holdCarry = 0;
  /** Wznoszenie's thermal strength */
  T = 0;
  private fogT = 0;
  private recover = 0;
  private relSec = 0;
  private unrelSec = 0;
  /** the blind Lekcja's last 15 s of focus, in quarter-second bins */
  private readonly blindBins = new Float32Array(60);
  private blindBin = 0;
  private blindBinT = 0;
  lapse: LapseState = 'none';
  private lapseT = 0;
  private lapseLen = 0;
  private returnsBlock = 0;
  parent: ParentMode = 'away';

  // thermals
  readonly thermals: Thermal[] = [];
  private thermalIds = 0;
  private thermalsBlock = 0;
  private nextThermal = 0;
  private strongNext = false;
  private floorNext = false;
  private strongFirst = false;
  private floorFirst = false;
  private bonusThermal: number | null = null;
  /** the climb under way: its strength, the highest it went, whether it opened a vista */
  climb: { T: number; peak: number; vista: boolean } | null = null;
  private readonly vistaDue: Light[] = [];

  // the flight's tallies
  /** the soaring chain: smooth landings in a row, and whether it soars now */
  chain = 0;
  soaring = false;
  private ridgeAt = 0;
  private ridgeCaught = false;
  private cragSeen = -1;
  private cleanRun = 0;
  private dailyAirSh = 0;
  private dailyDone = false;
  finale: Finale | null = null;
  private finaleDue = false;
  private nested = false;
  /** the stretch asked for a wide valley: the next ridge made has one */
  private wideNext = false;

  // the session's numbers
  score = 0;
  landings = 0;
  smooth = 0;
  catches = 0;
  maxChain = 0;
  soarSec = 0;
  longestGlide = 0;
  glideHills = 0;
  highest = 0;
  thermalsRidden = 0;
  maxClimb = 0;
  ridgesClean = 0;
  followFull = false;
  returns: number[] = [];
  blindSec = -1;
  featherGain = 0;
  readonly newVistas: number[] = [];
  private gotNew = false;
  stageNow: number;
  private readonly stageBefore: number;
  private readonly done: MissionId[] = [];
  private giftNow = 0;
  private readonly lekcjeBase: number;
  private lekcjeBegun = 0;
  private settled = false;
  /** the metres already added to the progress's total (the finale glide may add more before the result) */
  private banked = 0;
  private readonly bestBefore: number | null;
  private readonly before: { chain: number; glide: number; highest: number };
  private readonly x0: number;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.ridgeRng = mulberry32((Math.floor(init.rng() * 2 ** 32) ^ PLAN_SALT) >>> 0);
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.tLead = RULES.tLeadIn[band];
    this.tauL = RULES.tauL[band];
    this.ret = RULES.ret[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.before = { chain: p.bestChain, glide: p.longestGlide, highest: p.highest };
    // the session, its Lekcja blocks and the day's ridge reach the progress when it is settled (a
    // saved session): an abandoned first attempt leaves the next one the first
    this.session = p.sessions + 1;
    this.lekcjeBase = p.lekcje;
    this.daily = p.dailyDay !== init.day;
    this.stageBefore = this.stageNow = stageOf(p.feathers);
    this.plan = planBlocks(init.plannedSec, this.session === 1, this.daily ? mulberry32((init.daySeed ^ PLAN_SALT) >>> 0) : init.rng);
    this.dailyRidge = this.daily ? (this.plan[0].kind === 'warmup' ? 1 : 0) : -1;
    this.terrain = new Terrain(i => this.ridgeSpec(i));
    this.terrain.ensure(4);
    this.eaglet = new Eaglet(this.terrain, e => this.onFlight(e));
    this.x0 = this.eaglet.x;
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'lekcja' && this.block.blind; }
  /** a sighted Lekcja past its lead-in: the wings answer the band */
  get sighted(): boolean { return this.block?.kind === 'lekcja' && !this.block.blind && this.blockT >= this.lead && this.phase === 'play'; }
  /** seconds until the next block (null: the last) */
  get toNext(): number | null { return this.next ? Math.max(0, this.block.dur - this.blockT) : null; }
  /** the sky's time of day across the session, 0 dawn … 1 sunset (the finisher goes on to night) */
  get dayPhase(): number { return clamp(this.t / Math.max(1, this.plannedSec)); }
  get light(): Light { return this.dayPhase < 0.5 ? 'dawn' : 'dusk'; }
  get held(): boolean { return !this.beatLock && (this.pointers.size > 0 || this.keys.size > 0); }
  get stage(): 1 | 2 | 3 { return stageOf(this.p.feathers); }

  /** How the i-th ridge is made: the first-ever warm-up's gentle ridge, the day's ridge from the date, then the session's own. */
  private ridgeSpec(i: number): RidgeSpec {
    const wide = this.wideNext;
    this.wideNext = false;
    const warm = this.plan[0]?.kind === 'warmup' && i === 0;
    if (warm) return { seed: WARM_SEED, gentle: true, wide: false, daily: false };
    if (i === this.dailyRidge) return { seed: this.init.daySeed >>> 0, gentle: false, wide: false, daily: true };
    return { seed: Math.floor(this.ridgeRng() * 2 ** 32) >>> 0, gentle: false, wide, daily: false };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A finger (or the mouse) down or up anywhere. */
  pointer(type: 'down' | 'move' | 'up', id: number): void {
    if (type === 'move') return;
    if (type === 'down') {
      this.pointers.add(id);
      this.press();
    } else {
      this.pointers.delete(id);
      if (!this.pointers.size && !this.keys.size) this.beatLock = false;
    }
  }

  /** Space, ↓ (hold) and ↑ / W (a wingbeat, from the third plumage stage); true when the key is the game's. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k === ' ' || k === 'ArrowDown' || k === 'Enter') {
      if (down) {
        if (!this.keys.has(k)) this.lastInput = this.t;
        this.keys.add(k);
      } else {
        this.keys.delete(k);
        if (!this.pointers.size && !this.keys.size) this.beatLock = false;
      }
      return true;
    }
    if (k === 'ArrowUp' || k === 'w') {
      if (down) this.wingbeat();
      return true;
    }
    return false;
  }

  /** Every input lets go (the runner's pause, a lost focus). */
  release(): void {
    this.pointers.clear();
    this.keys.clear();
    this.beatLock = false;
  }

  private press(): void {
    // a double tap: two downs this close make a wingbeat (third plumage stage, once per ridge)
    if (this.lastDown >= 0 && this.t - this.lastDown <= RULES.doubleTap && this.wingbeat()) this.beatLock = true;
    this.lastDown = this.t;
    this.lastInput = this.t;
  }

  /** A strong wingbeat: from the third plumage stage, once per ridge. */
  wingbeat(): boolean {
    if (!this.started || this.phase !== 'play' || this.stage < 3) return false;
    const e = this.eaglet;
    if (e.caught || e.mode === 'climb' || e.mode === 'nest') return false;
    const ridge = this.terrain.ridgeAt(e.x)?.index ?? 0;
    if (ridge === this.beatRidge) return false;
    this.beatRidge = ridge;
    e.wingbeat();
    this.emit({ type: 'wingbeat' });
    return true;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    this.t = t;
    this.phaseT += dt;
    this.brain(dt, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    this.thermalsTick(dt);
    this.wShown = approach(this.wShown, this.W, dt, RULES.wTau);
    if (this.retT > 0) this.retT = Math.max(0, this.retT - dt);
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= RULES.step) {
      this.stepFlight(RULES.step);
      this.acc -= RULES.step;
    }
    if (this.phase === 'finale') this.finaleTick();
    this.score = Math.max(this.score, Math.floor((this.eaglet.maxX - this.x0) * RULES.mPerSh));
    if (this.soaring) this.soarSec += dt;
    this.hint = this.phase === 'play' && this.block.kind === 'warmup' && t - this.lastInput >= RULES.idleHint;
    this.checkMissions();
  }

  /**
   * The band's slow quantities.  L always follows the level (silently outside a sighted Lekcja), so
   * every Lekcja starts honestly; the wings answer it only in a sighted Lekcja past its lead-in.
   * The thermals' T builds from calm in a Wznoszenie past its lead-in.  While the signal is
   * unreliable T holds, the lapse clock waits and the wings ease to neutral with the kit's fade;
   * after a long dropout nothing brain-driven may fall for a while (the band is climbing back).
   */
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    this.reliable = f.reliable;
    this.fog = approach(this.fog, f.reliable ? 0 : 1, dt, 0.8);
    if (this.phase === 'play') {
      if (f.reliable) this.relSec += dt;
      else this.unrelSec += dt;
    }
    if (!f.reliable) this.fogT += dt;
    else if (this.fogT > 0) {
      if (this.fogT >= R.fogGap) this.recover = R.recover;
      if (f.hold < this.rawHold) this.holdCarry += this.rawHold;   // the kit restarted a hold the gap broke: it carries on
      this.fogT = 0;
    } else this.recover = Math.max(0, this.recover - dt);
    const Ln = approach(this.L, clamp(f.level), dt, this.tauL);
    this.L = this.recover > 0 && f.reliable ? Math.max(this.L, Ln) : Ln;
    const lift = this.stage >= 2 ? 1 + R.stage2Lift : 1;
    const play = this.phase === 'play';
    if (play && b.kind === 'lekcja') {
      if (!b.blind) this.lekcjaBrain(dt, f);
      else this.blindBrain(dt, f);
    } else {
      this.hold = 0;
      this.follow = this.decayFollow(dt, 0);
    }
    this.W = (this.sighted ? wingsFor(this.L) : R.wNeutral) * lift;
    if (play && b.kind === 'wzn' && this.blockT >= this.tLead && f.reliable) {
      const T = clamp(this.T + (R.tGain * f.calm - R.tLeak) * dt);
      this.T = this.recover > 0 ? Math.max(this.T, T) : T;
    }
  }

  /** A sighted Lekcja: follow steps from the hold, lapses and returns. */
  private lekcjaBrain(dt: number, f: FocusFrame): void {
    const R = RULES;
    if (this.blockT < this.lead) return;
    if (f.reliable) {
      if (!f.focused && this.recover <= 0) this.holdCarry = 0;   // the stretch broke for real
      this.rawHold = f.hold;
      this.hold = Math.min(this.holdCarry + f.hold, this.blockT);
    }
    const target = f.reliable ? followFor(this.hold) : this.follow;
    if (target > this.follow + 1e-9) {
      this.eaglet.boost((1 + target) / (1 + this.follow));
      this.follow = target;
      this.followDecay = 0;
      this.emit({ type: 'step', bonus: target });
      if (target >= R.stepMax) this.followFull = true;
    } else if (target < this.follow) this.follow = this.decayFollow(dt, target);
    if (!f.reliable) return;   // a gap is never a lapse: the lapse clock waits
    switch (this.lapse) {
      case 'none':
        if (!f.focused && this.recover <= 0) {
          this.lapse = 'lapse';
          this.lapseT = 0;
          this.parent = 'circling';
          this.emit({ type: 'lapse' });
        }
        break;
      case 'lapse':
        this.lapseT += dt;
        if (f.focused) {
          this.lapse = 'back';
          this.lapseLen = this.lapseT;
          this.parent = 'ahead';
          this.emit({ type: 'back' });
        }
        break;
      case 'back':
        if (!f.focused) {
          this.lapse = 'lapse';   // not held long enough: the same lapse goes on
          this.parent = 'circling';
        } else if (f.hold >= this.ret.hold) {
          this.lapse = 'none';
          if (this.lapseLen >= this.ret.lapse && this.returnsBlock < R.retMax) {
            this.returnsBlock++;
            this.returns.push(this.lapseLen);
            this.retT = R.retDur;
            this.eaglet.boost(1 + R.retBonus);
            this.emit({ type: 'return', lapse: this.lapseLen, gold: this.lapseLen <= R.retGold });
          }
        }
        break;
    }
  }

  /** The blind Lekcja: nothing shows or changes; its last 15 s of focus are counted for the reveal at its exit. */
  private blindBrain(dt: number, f: FocusFrame): void {
    this.blindBinT += dt;
    if (f.reliable && f.focused) this.blindBins[this.blindBin] += dt;
    if (this.blindBinT >= 0.25) {
      this.blindBinT -= 0.25;
      this.blindBin = (this.blindBin + 1) % this.blindBins.length;
      this.blindBins[this.blindBin] = 0;
    }
  }

  private decayFollow(dt: number, target: number): number {
    if (this.follow <= target) return target;
    if (this.followDecay === 0) this.followDecay = this.follow / RULES.stepDecay;
    const v = Math.max(target, this.follow - this.followDecay * dt);
    if (v <= target) this.followDecay = 0;
    return v;
  }

  /** The parent's draft on the flight: the follow steps and a return's wingbeat. */
  get draft(): number { return this.follow + (this.retT > 0 ? RULES.retBonus : 0); }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'lekcja' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!last && !this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      const next = this.plan[this.blockIndex + 1];
      if (next.kind === 'lekcja' && !next.blind) this.parent = 'telegraph';
      this.emit({ type: 'telegraph', next });
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
    this.telegraphed = false;
    this.relSec = 0;
    this.unrelSec = 0;
    this.judge.reset();
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'lekcja') {
      this.lekcjeBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && !b.stretch && (this.lekcjeBase + this.lekcjeBegun) % RULES.blindEvery === 0;
      this.lapse = 'none';
      this.returnsBlock = 0;
      this.hold = 0;
      this.holdCarry = 0;
      this.rawHold = 0;
      this.parent = b.blind ? 'cloud' : 'ahead';
      this.blindBins.fill(0);
      if (b.stretch) this.wideNext = true;
    } else {
      this.parent = 'away';
      if (b.kind === 'wzn') {
        this.T = 0;
        this.thermalsBlock = 0;
        this.nextThermal = RULES.thermalFirst;
        this.strongFirst = this.strongNext;
        this.floorFirst = this.floorNext;
        this.strongNext = this.floorNext = false;
      }
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
    if (this.bonusThermal !== null && b.kind === 'wzn') {
      // the blind Lekcja's reveal: a thermal of its focus, rising at once
      this.raiseThermal(this.bonusThermal, 0);
      this.bonusThermal = null;
    }
  }

  /** The line under the block's name: the first-ever blocks explain themselves, the others rotate their strategies. */
  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup[0];
    if (b.kind === 'lekcja') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (b.stretch) return TIPS.stretch;
      if (first && this.lekcjeBase === 0) return TIPS.firstLekcja;
      return TIPS.lekcja[(this.session - 1 + i) % TIPS.lekcja.length];
    }
    if (first && this.session === 1) return TIPS.firstWzn;
    return TIPS.wzn[(this.session - 1 + i) % TIPS.wzn.length];
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block, R = RULES;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'lekcja' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= R.minReliable ? this.judge.verdict() : null;
      if (verdict) this.addFeathers(R.featherBlock, 'block');
      if (b.kind === 'wzn') {
        if (verdict) this.strongNext = true;
        if (verdict === null) this.floorNext = true;
      }
      if (b.blind) {
        let sec = 0;
        for (const v of this.blindBins) sec += v;
        sec = Math.min(15, sec);
        this.blindSec = Math.max(this.blindSec, Math.round(sec));
        const T = clamp(sec / 15);
        this.bonusThermal = T;
        this.emit({ type: 'blindReveal', sec: Math.round(sec), T });
      }
    }
    this.payVistas();
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  // ── thermals ────────────────────────────────────────────────────
  private thermalsTick(dt: number): void {
    for (const th of this.thermals) th.age += dt;
    const R = RULES, b = this.block;
    if (this.phase === 'play' && b?.kind === 'wzn' && this.thermalsBlock < R.thermalMax && this.blockT >= this.nextThermal
      && this.blockT < b.dur - 2) {
      this.thermalsBlock++;
      this.nextThermal += R.thermalEvery;
      const strong = this.thermalsBlock === 1 && this.strongFirst ? R.tPassBonus : 0;
      this.raiseThermal(null, strong);
    }
    // the ones far behind are gone
    let n = 0;
    for (const th of this.thermals) if (th.x > this.eaglet.x - 3) this.thermals[n++] = th;
    this.thermals.length = n;
  }

  /** A thermal over the next valley ahead (a fixed strength, or the block's live T plus a bonus). */
  private raiseThermal(fixed: number | null, bonus: number): void {
    const T = this.terrain;
    const x = T.troughAfter(this.eaglet.x + RULES.thermalAhead) ?? this.eaglet.x + RULES.thermalAhead;
    if (T.wadiAt(x)) return;
    const floor = this.floorFirst && this.thermalsBlock <= 1 ? RULES.tFloor : 0;
    const th: Thermal = { id: ++this.thermalIds, x, base: T.height(x), fixed, bonus, floor, used: false, age: 0 };
    this.thermals.push(th);
    this.emit({ type: 'thermalRise', thermal: th });
  }

  /** A thermal's strength now: a fixed one, or the live T with its bonus and floors (a block with a bad signal holds at 0.4 or more). */
  strengthOf(th: Thermal): number {
    if (th.fixed !== null) return th.fixed;
    const badSignal = this.relSec < RULES.minReliable && this.unrelSec >= 2;
    const floor = Math.max(th.floor, badSignal ? RULES.tFloor : 0);
    return clamp(Math.max(floor, this.T + th.bonus));
  }

  // ── the flight ──────────────────────────────────────────────────
  private stepFlight(dt: number): void {
    const e = this.eaglet;
    this.terrain.ensure(e.x + 4);
    if (this.phase === 'play' && !this.held && !e.caught && e.mode !== 'climb') {
      for (const th of this.thermals) {
        if (!th.used && Math.abs(e.x - th.x) <= RULES.thermalHalf && e.y < th.base + 4) {
          th.used = true;
          const T = this.strengthOf(th);
          e.enterClimb(climbFor(T));
          this.climb = { T, peak: 0, vista: false };
          this.thermalsRidden++;
          this.emit({ type: 'thermal', T });
          break;
        }
      }
    }
    e.step(dt, { held: this.held && this.phase === 'play', W: this.wShown, draft: this.draft, soaring: this.soaring });
    if (this.climb && e.mode === 'climb') {
      const h = e.altitude;
      this.climb.peak = Math.max(this.climb.peak, h);
      const line = pityDue(this.p, this.session) && !this.gotNew ? RULES.vistaAltPity : RULES.vistaAlt;
      if (!this.climb.vista && h >= line && this.phase === 'play') {
        this.climb.vista = true;
        this.vistaDue.push(this.light);
        this.emit({ type: 'vistaSeen', light: this.light });
      }
    }
    if (e.airborne && !e.caught) {
      this.highest = Math.max(this.highest, e.altitude);
      const d = this.dailyRidgeNow();
      if (d && !this.dailyDone && e.x >= d.x0 && e.x <= d.wadiX1) this.dailyAirSh += Math.max(0, e.mode === 'climb' ? RULES.climbDrift * dt : e.vx * dt);
    }
    this.ridges();
    if (this.eaglet.x - this.terrain.ridges[0].x0 > 30) this.terrain.trim(this.eaglet.x - 4);
  }

  private dailyRidgeNow(): Ridge | null {
    return this.dailyRidge < 0 ? null : this.terrain.ridges.find(r => r.index === this.dailyRidge) ?? null;
  }

  /** The crag's stamp, and a ridge done: clean (no catch on it) or not; the day's ridge closes. */
  private ridges(): void {
    const e = this.eaglet;
    const r = this.terrain.ridges.find(x => x.index === this.ridgeAt);
    if (!r) return;
    if (this.cragSeen < r.index && e.maxX >= r.crag - 0.02) {
      this.cragSeen = r.index;
      this.emit({ type: 'crag', index: r.index });
    }
    if (e.maxX >= r.wadiX1 && !e.caught) {
      this.cleanRun = this.ridgeCaught ? 0 : this.cleanRun + 1;
      this.ridgesClean = Math.max(this.ridgesClean, this.cleanRun);
      if (r.index === this.dailyRidge) this.dailyDone = true;
      this.ridgeAt++;
      this.ridgeCaught = false;
    }
  }

  private onFlight(ev: FlightEvent): void {
    const R = RULES;
    switch (ev.type) {
      case 'launch':
        this.emit({ type: 'launch' });
        break;
      case 'land': {
        this.landings++;
        this.longestGlide = Math.max(this.longestGlide, ev.glide);
        this.glideHills = Math.max(this.glideHills, ev.hills);
        if (ev.cls === 'smooth') {
          this.smooth++;
          this.chain++;
          this.maxChain = Math.max(this.maxChain, this.chain);
          if (this.chain >= R.soarAfter && !this.soaring) {
            this.soaring = true;
            this.eaglet.boost(R.soarBonus);
            this.emit({ type: 'soar' });
          }
        } else {
          if (this.soaring) this.emit({ type: 'soarEnd' });
          this.chain = 0;
          this.soaring = false;
        }
        this.emit({ type: 'land', cls: ev.cls, deg: ev.deg, chain: this.chain, soaring: this.soaring });
        break;
      }
      case 'catch':
        this.catches++;
        this.ridgeCaught = true;
        if (this.soaring) this.emit({ type: 'soarEnd' });
        this.chain = 0;
        this.soaring = false;
        this.climb = null;
        this.parent = 'catch';
        this.emit({ type: 'catch', why: ev.why });
        break;
      case 'carried':
        this.parent = this.block?.kind === 'lekcja' && this.phase === 'play' ? (this.block.blind ? 'cloud' : 'ahead') : 'away';
        this.emit({ type: 'carried' });
        if (this.finaleDue) this.startFinale();
        break;
      case 'climbEnd':
      case 'climbOut': {
        const peak = this.climb?.peak ?? this.eaglet.altitude;
        this.maxClimb = Math.max(this.maxClimb, peak);
        this.climb = null;
        if (ev.type === 'climbEnd') this.emit({ type: 'climbTop', height: peak });
        break;
      }
      default:
        break;
    }
  }

  // ── the meta during play ────────────────────────────────────────
  private addFeathers(n: number, why: 'block' | 'mission' | 'gift' | 'session'): void {
    const before = stageOf(this.p.feathers);
    this.p.feathers += n;
    this.featherGain += n;
    this.emit({ type: 'feather', total: this.p.feathers, why });
    const after = stageOf(this.p.feathers);
    if (after > before) {
      this.stageNow = after;
      this.emit({ type: 'stage', stage: after as 2 | 3 });
    }
  }

  /** The vistas the block's climbs opened: drawn at its end (pity guarantees a new one when due). */
  private payVistas(): void {
    while (this.vistaDue.length) {
      const light = this.vistaDue.shift()!;
      const pity = pityDue(this.p, this.session) && !this.gotNew;
      const d = drawVista(this.p, light, this.rng, pity);
      this.vistaGot(d.index, d.isNew, pity && d.isNew ? 'pity' : 'climb');
      for (const c of d.crafted) this.vistaGot(c, true, 'craft');
    }
  }

  private vistaGot(index: number, isNew: boolean, via: 'climb' | 'craft' | 'pity'): void {
    if (isNew) {
      this.gotNew = true;
      this.p.lastVistaSession = this.session;
      this.newVistas.push(index);
    }
    this.emit({ type: 'vista', index, isNew, via });
  }

  /** What a mission counts, this session. */
  missionValue(kind: MissionKind): number {
    switch (kind) {
      case 'chain': return this.maxChain;
      case 'thermals': return this.thermalsRidden;
      case 'metres': return this.score;
      case 'glideHills': return this.glideHills;
      case 'altitude': return Math.max(this.maxClimb, this.highest);
      case 'ridges': return this.ridgesClean;
      case 'smooth': return this.smooth;
      case 'soarSec': return this.soarSec;
      case 'glideLen': return this.longestGlide;
      case 'follow': return this.followFull ? 1 : 0;
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
        this.addFeathers(RULES.featherMission, 'mission');
      }
    }
  }

  // ── the finisher ────────────────────────────────────────────────
  /** The last block ended: back to the nest — once the parent has set the eaglet down, if it was carrying it. */
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    if (this.eaglet.caught) {
      this.finaleDue = true;
      this.phase = 'finale';
      this.phaseT = 0;
      this.parent = 'catch';
      this.settle();
      return;
    }
    this.phase = 'finale';
    this.settle();
    this.startFinale();
  }

  private startFinale(): void {
    this.finaleDue = false;
    this.phaseT = 0;
    const e = this.eaglet, T = this.terrain;
    const nx = e.x + 1.4;
    T.ensure(nx + 2);
    let top = -Infinity;
    for (let x = nx - 0.3; x <= nx + 0.3; x += 0.05) top = Math.max(top, T.height(x));
    this.finale = { x0: e.x, y0: e.y, nx, ny: top + 0.85 };
    if (this.soaring) this.emit({ type: 'soarEnd' });
    this.soaring = false;
    this.chain = 0;
    this.climb = null;
    e.toNest();
    this.parent = 'nest';
    this.emit({ type: 'finale' });
  }

  /** The finisher's path: up a spiral of warm air (0–3 s), a glide into the nest (3–4.2 s), then rest. */
  private finaleTick(): void {
    const f = this.finale, e = this.eaglet;
    if (!f) return;
    const u = this.phaseT;
    const climbTo = { x: f.nx - 0.3, y: f.ny + 0.4 };
    if (u < 3) {
      const k = u / 3, s = k * k * (3 - 2 * k);
      e.x = f.x0 + (climbTo.x - f.x0) * s;
      e.y = f.y0 + (climbTo.y - f.y0) * s;
      e.angle = 0.25 * Math.sin(u * 4);
    } else if (u < 4.2) {
      const k = (u - 3) / 1.2, s = k * k * (3 - 2 * k);
      e.x = climbTo.x + (f.nx - climbTo.x) * s;
      e.y = climbTo.y + (f.ny - climbTo.y) * s;
      e.angle = -0.3 * (1 - k);
    } else {
      e.x = f.nx;
      e.y = f.ny;
      e.angle = 0;
      if (this.phase === 'finale' && !this.nested) {
        this.nested = true;
        this.emit({ type: 'nest' });
      }
    }
    e.maxX = Math.max(e.maxX, e.x);
    if (u >= RULES.finale) this.phase = 'done';
  }

  /**
   * The session is settled once — at the finisher, or when it ends early: the open block is judged
   * (by the caller), the session's feathers and the day's gift come, the day's ridge is recorded, the
   * flight log turns its done pages and the counters reach the progress.  Only a saved session gets
   * here or keeps it (the runner undoes an abandoned one).
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, day = this.init.day;
    this.payVistas();
    this.addFeathers(RULES.featherSession, 'session');
    if (p.giftDay !== day) {
      p.giftDay = day;
      this.giftNow = RULES.featherGift;
      this.addFeathers(RULES.featherGift, 'gift');
      this.emit({ type: 'gift', feathers: RULES.featherGift });
    }
    if (this.daily) {
      p.dailyDay = day;
      p.dailyAir = Math.round(this.dailyAirSh * RULES.mPerSh);
    }
    p.sessions = Math.max(p.sessions, this.session);
    p.lekcje = Math.max(p.lekcje, this.lekcjeBase + this.lekcjeBegun);
    p.metres += this.score;
    this.banked = this.score;
    p.lastLen = this.plannedSec;
    turnPages(p, this.done);
  }

  /**
   * The session ends before its own finisher ("Zakończ i zapisz", the runner's overtime): settle as
   * the finisher would — the open block is judged and its vistas paid.  Nothing more once settled.
   */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.settle();
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
   * What the ambient pad's brightness follows (kit/types.ts): the wings in a sighted Lekcja, a mid
   * glow in the warm-up; held still in a blind Lekcja, a Wznoszenie (its warmth is held by the
   * audio), the finisher and while the signal is unreliable.
   */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    const b = this.block;
    if (b.kind === 'warmup') return 0.5;
    if (b.kind === 'lekcja' && !b.blind) return clamp((this.wShown / (this.stage >= 2 ? 1 + RULES.stage2Lift : 1) - RULES.wNeutral) / 0.35);
    return null;
  }

  /** Time is up: the session may stop once the finisher has played, or a few seconds after (a catch or a climb settling). */
  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /**
   * The session's numbers, idempotent: records go into the progress with Math.max; the counters
   * reached it when the session was settled.
   */
  result(): ArcadeOutcome {
    const p = this.p, M = RULES.mPerSh;
    const glide = Math.round(this.longestGlide * M), high = Math.round(Math.max(this.highest, this.maxClimb) * M);
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
      p.bestChain = Math.max(p.bestChain, this.maxChain);
      p.longestGlide = Math.max(p.longestGlide, glide);
      p.highest = Math.max(p.highest, high);
      if (this.settled && this.score > this.banked) {
        p.metres += this.score - this.banked;
        this.banked = this.score;
      }
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;   // no "−0.0%"
    const med = this.returns.length >= RULES.medianFrom ? median(this.returns) : null;
    const stats: [string, string][] = [
      [t('stat.glide'), metres(glide)],
      [t('stat.chain'), String(this.maxChain)],
      [t('stat.high'), metres(high)],
      [t('stat.smooth'), this.landings ? `${this.smooth}/${this.landings}` : '—'],
      [t('stat.returns'), med === null ? String(this.returns.length) : t('stat.returnsMedian', { n: this.returns.length, sec: fmtNum(med, 0) })],
      [t('stat.feathers'), `+${this.featherGain}`],
      [t('stat.catches'), this.catches ? t('times', { n: this.catches }) : '—'],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: 'm', record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(glide, high), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage (kit/scripture.ts), one of those the session fits, in turn from
   * session to session: a catch is the shelter of the wings, a high climb or a vista the eagle's
   * wings, new plumage the eagle's youth renewed, and every flight the eagles' wings that carried.
   * The lobby already opens with Deuteronomy 32:11.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.catches > 0) fit.push('psa91.4');
    if (this.maxClimb >= RULES.vistaAlt || this.newVistas.length > 0) fit.push('isa40.31');
    if (this.stageNow > this.stageBefore) fit.push('psa103.5');
    fit.push('exo19.4');
    return inTurn(fit, this.session || 1);
  }

  /** At most five lines for the summary, the best moments first. */
  private highlights(glide: number, high: number): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.stageNow > this.stageBefore) add(0, t('hl.stage', { name: STAGES[this.stageNow - 1].name, skill: STAGES[this.stageNow - 1].skill }));
    if (this.newVistas.length) {
      const names = this.newVistas.slice(0, 2).map(i => VISTAS[i].name);
      add(1, this.newVistas.length === 1 ? t('hl.vista', { name: names[0] }) : t('hl.vistas', { names: names.join(', '), n: this.newVistas.length }));
    }
    if (this.bestBefore !== null) {
      const parts: string[] = [];
      if (this.maxChain > this.before.chain) parts.push(t('hl.rec.chain', { n: this.maxChain }));
      if (glide > this.before.glide) parts.push(t('hl.rec.glide', { m: metres(glide) }));
      if (high > this.before.highest) parts.push(t('hl.rec.high', { m: metres(high) }));
      if (parts.length) add(2, t(parts.length > 1 ? 'hl.records' : 'hl.record', { list: parts.join(', ') }));
    }
    if (this.done.length) add(3, t('hl.missions', { list: this.done.map(id => missionById(id)!.name).join(', '), n: this.done.length }));
    if (this.daily) add(4, t('hl.daily', { m: metres(Math.round(this.dailyAirSh * RULES.mPerSh)) }));
    if (this.blindSec >= 0) add(5, t('blind.reveal', { n: this.blindSec }));
    if (this.giftNow) add(6, t('hl.gift', { n: this.giftNow }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}

