/**
 * Zacheusz's session (DESIGN.md §7.4): Super Mario Run's World Tour in Jericho, with the band as the
 * path.  Pure logic — no DOM, no canvas — so the tests can drive it; the view and the sound read its
 * state and its events (`take()`).
 *
 * The session plays hand-made levels one after another (the lobby's pick first, then in turn): he
 * runs by himself, the hands jump (hero.ts), and each level ends at the finish palm — the higher he
 * grabs it, the more it pays — then a tally (coins, the five special denarii of the level's set,
 * stars, the style the townsfolk cheered) and the next level.  A world's fourth level is the crowd's
 * street and ends at the sycamore, with the world's story card.  Nothing ends a run: a fall is a
 * bubble that rewinds a few seconds (Mario's), or without one the neighbour's rope.
 *
 * The blocks (the brain's part, session time, independent of the levels):
 *
 *   Pierwsze kroki (warm-up)  the first-ever session: the first level teaches, one coach mark at a time
 *   Wypatrywanie (push)       after the lead-in, while the level stands above the threshold, the light
 *                             road over the roofs grows ahead (its reach = the level), a spring of light
 *                             lifts him onto it: a faster, higher way with light coins and the high
 *                             special denarii; a held view ("Widok") showers light coins on it
 *   Tłum (blind)              every 4th push from the 3rd session: the crowd veils the palms and the
 *                             road does not grow; at its end its last 15 s become a stretch of road
 *   Cień sykomory (rest)      a gate opens into a fig orchard spliced into the level: a walk; calm
 *                             ripens the figs he picks in passing (denarii), a full tree gives a bubble
 *
 * Each block is judged once at its end (RoundJudge) and feeds the session's contrast (BlockContrast).
 * An unreliable signal freezes the brain's part: the road neither grows nor falls, the figs keep.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome, Headline, SignalPhase } from '../kit/types';
import { Companion, type Moment } from './companion';
import { HOMES, LEVELS, MISSIONS, TIERS, TIPS, levelCode, levelName, missionById, type MissionId, type TileKind } from './content';
import { Hero, type HeroEvent } from './hero';
import { t } from './i18n';
import {
  bestFor, finishLevel, homesRestored, lenKey, migrate, nextLevel, startLevel, tierIndex, turnPages, type ZacheuszProgress,
} from './meta';
import { RULES } from './rules';
import { World, type Critter } from './world';

export { RULES };

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'done';
/** What the run is doing: running, in a bubble, on the rope, at the finish, the tally card, a story card. */
export type Stage = 'run' | 'bubble' | 'rope' | 'finish' | 'tally' | 'story';
export type StoryKind = 'open' | 'world';
/** A trick the townsfolk cheer for. */
export type Trick = 'spin' | 'vaultSpin' | 'wall' | 'bonk' | 'long' | 'spring' | 'top';
/** The tutorial's coach marks (taught once ever, shown again until done). */
export type Teach = 'tap' | 'hold' | 'goose' | 'pause' | 'wall' | 'awning' | 'back' | 'dash' | 'bubble' | 'special' | 'road' | 'orchard' | 'button';

export interface LevelResult {
  index: number; coins: number; specials: number; tier: number; stars: number; gained: number; band: number;
  style: number; styleCoins: number; completed: boolean; first: boolean; world: boolean;
}

export type SimEvent =
  | { type: 'coin'; x: number; y: number; chain: number; light: boolean }
  | { type: 'special'; x: number; y: number; got: number; tier: number }
  | { type: 'set'; tier: number; pay: number }
  | { type: 'jump'; held: boolean }
  | { type: 'land'; fall: number }
  | { type: 'wallJump'; x: number; y: number }
  | { type: 'spin'; x: number; y: number; vault: boolean }
  | { type: 'bounce'; on: 'awning' | 'crowd'; x: number; y: number }
  | { type: 'spring'; x: number; y: number }
  | { type: 'vault'; x: number; y: number; kind: Critter['kind'] }
  | { type: 'bonk'; x: number; y: number; kind: Critter['kind']; pay: number; chain: number }
  | { type: 'mantle' }
  | { type: 'legUp' }
  | { type: 'tile'; kind: TileKind; x: number; y: number }
  | { type: 'longJump' }
  | { type: 'style'; trick: Trick; pts: number; n: number; x: number; y: number }
  | { type: 'fall'; bubble: boolean }
  | { type: 'pop'; x: number; y: number }
  | { type: 'ropeEnd' }
  | { type: 'trunk'; band: number; pay: number; x: number; y: number; sycamore: boolean }
  | { type: 'levelStart'; index: number; replay: boolean }
  | { type: 'levelDone'; res: LevelResult }
  | { type: 'road'; on: boolean }
  | { type: 'plank'; x: number }
  | { type: 'view'; n: number }
  | { type: 'orchard'; x0: number; x1: number }
  | { type: 'figs'; n: number; x: number; y: number; bubble: boolean }
  | { type: 'reveal'; len: number; share: number }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'restPass'; pay: number }
  | { type: 'pushPass'; pay: number }
  | { type: 'home'; index: number }
  | { type: 'gift'; n: number }
  | { type: 'story'; kind: StoryKind; world: number }
  | { type: 'hint'; key: Teach; x: number; y: number };

export interface SimInit {
  progress: ZacheuszProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

const NO_EVENTS: readonly SimEvent[] = [];

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 22 s in
 * 3, 8 s in a 40 s test); then push / rest pairs (24 ± 4 s and 22 ± 3 s, scaled to end on time,
 * jittered only when there is room).  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('push', left - rest), b('rest', rest)];
  }
  const plan: Block[] = [];
  let left = plannedSec;
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
  for (let i = 0; i < durs.length; i++) durs[i] = Math.max(R.minBlock, durs[i] * scale);
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'rest' : 'push', dur)));
  return plan;
}

/** The finish band (0..4) for where his feet grab the trunk. */
export const bandFor = (y: number): number => {
  let band = 0;
  RULES.bandAt.forEach((at, i) => { if (y >= at - 1e-6) band = i; });
  return band;
};

/** Ripe figs on a tree for ripeness R (0..5). */
export const figsFor = (r: number): number => RULES.figAt.filter(at => r >= at).length;

/** The road's reach ahead of him (u) for a level: the band can only add. */
export const reachFor = (level: number): number => RULES.minReach + clamp(level) * RULES.reachSpan;
/** The reach at the threshold: the dotted mark ahead of the road's tip. */
export const REACH_MARK = reachFor(0.5);

/** A sample of where he was, for the bubble's rewind. */
interface Past { t: number; x: number; y: number; safe: boolean }

export class ZacheuszSim {
  readonly p: ZacheuszProgress;
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly session: number;
  readonly firstEver: boolean;
  readonly day: string;
  readonly plan: Block[];
  readonly trace = new SignalTrace(40, 1);
  readonly contrast = new BlockContrast(4);
  readonly talk: Companion;
  readonly hero: Hero;
  world!: World;
  private readonly judge: RoundJudge;
  private readonly bestBefore: number | null;
  private events: SimEvent[] = [];

  started = false;
  phase: Phase = 'play';
  stage: Stage = 'run';
  stageT = 0;
  t = 0;
  /** the physics' leftover time, and a hit-stop's seconds */
  private acc = 0;
  stop = 0;

  // ── the blocks ──
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  private relSec = 0;
  tip = '';
  private pushesBegun = 0;
  private readonly pushesBase: number;

  // ── the level ──
  levelIndex = 0;
  /** levels laid this session (the first is the start), finished this session */
  levelsRun = 0;
  levelsDone = 0;
  levelCoins = 0;
  levelSpecials = 0;
  levelStyle = 0;
  bubbles: number = RULES.bubbles;
  band = -1;
  lastResult: LevelResult | null = null;
  story: { kind: StoryKind; world: number } | null = null;
  private storyAfter: { kind: StoryKind; world: number } | null = null;
  private past: Past[] = [];
  private pastT = 0;
  /** the bubble's float: from, to, and whether it is hovering (waiting for a tap) */
  bubble: { x0: number; y0: number; x1: number; y1: number; hover: boolean } | null = null;
  rope: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private flightTricks = 0;
  private coinChain = 0;
  private lastCoinT = -9;

  // ── the band ──
  /** the road's tip (world x; −∞: no road), whether it is growing now, its drawn reach (u) */
  roadTip = -Infinity;
  building = false;
  reach = 0;
  roadLook: 'off' | 'wait' | 'live' | 'grey' | 'blind' = 'off';
  private nextSpring = 0;
  private nextCoin = 0;
  private views = 0;
  private nextView = 0;
  /** the orchard: wanted (a rest block's telegraph), ripeness R */
  private wantOrchard = false;
  /** the rest block whose orchard is laid (−1: none in this level) */
  private orchardBlock = -1;
  ripe = 0;
  /** the meter the panel shows (null hides it) */
  meterNow: number | null = null;
  focusLevel = 0;

  // ── the session's tallies ──
  score = 0;
  specialsAll = 0;
  sets = 0;
  starsGained = 0;
  styleAll = 0;
  bonks = 0;
  walls = 0;
  vaultSpins = 0;
  figs = 0;
  tops = 0;
  falls = 0;
  bubblesUsed = 0;
  roadSec = 0;
  viewsAll = 0;
  passedPushes = 0;
  passedRests = 0;
  maxHold = 0;
  blindShare = -1;
  giftNow = 0;
  homesNow: number[] = [];
  bestLevel = -1;
  private settled = false;
  private saidEnd = false;
  private missionsDone: MissionId[] = [];
  /** the tutorial: what was shown when (s), what was done */
  private readonly taught: Set<string>;
  private hinted = new Map<Teach, number>();
  /** the run-up's teaching moments already passed in this level */
  private seen = new Set<object>();

  constructor(init: SimInit) {
    this.p = migrate(init.progress);
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.day = init.day;
    this.session = this.p.sessions + 1;
    this.firstEver = this.p.sessions === 0;
    this.pushesBase = this.p.pushes;
    this.plan = planBlocks(init.plannedSec, this.firstEver, init.rng);
    this.judge = RoundJudge.from(init.tuning);
    this.talk = new Companion(init.rng);
    this.bestBefore = bestFor(this.p, init.plannedSec);
    this.taught = new Set(this.p.taught);
    this.hero = new Hero(e => this.onHero(e));
    this.loadLevel(startLevel(this.p));
  }

  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get pushBlock(): boolean { return this.phase === 'play' && this.blockOn && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.blockOn && this.block.kind === 'rest'; }
  /** blocks run until the planned time; after it the session is free */
  get blockOn(): boolean { return this.t < this.plannedSec; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  get lead(): number { return RULES.leadIn[this.eeg ? 'eeg' : 'fnirs']; }
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get level() { return LEVELS[this.levelIndex]; }
  get tier(): number { return tierIndex(this.p.levels[this.levelIndex]); }
  get inOrchard(): boolean { return !!this.world.inOrchard(this.hero.x); }

  // ── the session ─────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.day && this.p.giftDay !== this.day) {
      this.giftNow = RULES.giftPay;
      this.p.giftDay = this.day;
      this.emit({ type: 'gift', n: this.giftNow });
    }
    this.startBlock(0);
    if (!this.p.opened) {
      this.p.opened = true;
      this.showStory({ kind: 'open', world: 0 });
      this.talk.say('first', 2, 12);
    } else this.talk.say('open', 1, 8);
    this.emit({ type: 'levelStart', index: this.levelIndex, replay: this.p.levels[this.levelIndex].done });
  }

  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || this.phase === 'done') return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.focusLevel = f.level;
    if (this.blockOn) this.schedule(dt, f);
    else if (this.blockIndex < this.plan.length) {
      this.endBlock();
      this.blockIndex = this.plan.length;
    }
    const phase: TracePhase = !this.blockOn ? 'free' : this.block.kind === 'push' ? 'focus' : this.block.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(t, f, phase, this.blind);
    if (this.pushBlock && f.reliable) this.maxHold = Math.max(this.maxHold, f.hold);
    this.brain(dt, f);
    this.stageStep(dt);
    // the physics on a fixed step (a hit-stop holds the world for a breath)
    if (this.stop > 0) this.stop = Math.max(0, this.stop - dt);
    else {
      this.acc += dt;
      while (this.acc >= RULES.step) {
        this.acc -= RULES.step;
        this.physics(RULES.step);
      }
    }
    this.teach();
    if (t > this.plannedSec - 7 && !this.saidEnd) {
      this.saidEnd = true;
      this.talk.say('end', 1, 6);
    }
    this.talk.update(dt, this.telegraphed && this.blockT > this.block.dur - RULES.telegraph - 0.1);
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
      if (f.reliable) this.relSec += dt;
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.talk.hush();
      const next = last ? null : this.plan[this.blockIndex + 1];
      if (next?.kind === 'rest') this.wantOrchard = true;
      this.emit({ type: 'telegraph', next });
    }
    if (!last && this.blockT >= b.dur) {
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
      this.views = 0;
      this.nextView = RULES.view[this.eeg ? 'eeg' : 'fnirs'];
      this.talk.say(b.blind ? 'blind' : 'push', 1, 10);
    } else if (b.kind === 'rest') {
      this.ripe = 0;
      this.wantOrchard = this.orchardBlock !== i;
      this.talk.say('rest', 1, 10);
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

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
    if (this.blockIndex >= this.plan.length) return;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= R.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'rest') {
        this.wantOrchard = false;
        if (verdict) {
          this.passedRests++;
          this.pay(R.basketPay);
          this.levelCoins += R.basketPay;
          this.emit({ type: 'restPass', pay: R.basketPay });
          this.talk.say('figs', 1, 6);
        }
      }
      if (b.kind === 'push') {
        if (verdict) {
          this.passedPushes++;
          this.pay(R.passPay);
          this.levelCoins += R.passPay;
          this.emit({ type: 'pushPass', pay: R.passPay });
        } else if (verdict === false && share >= need - 0.12) this.talk.say('near', 1, 6);
        if (b.blind) {
          this.trace.unveil(this.t);
          const s = this.judge.measured > 0 ? share : 0;
          this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
          this.reveal(s);
        }
        if (this.building) this.emit({ type: 'road', on: false });
        this.building = false;
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  // ── the band ────────────────────────────────────────────────────
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES, h = this.hero;
    // the road (push): its reach follows the level; it grows only above the threshold
    const sighted = this.sighted && this.stage === 'run';
    this.roadLook = !this.pushBlock ? 'off' : this.block.blind ? 'blind' : this.blockT < this.lead ? 'wait' : f.reliable ? 'live' : 'grey';
    if (sighted && f.reliable) {
      this.reach += (reachFor(f.level) - this.reach) * Math.min(1, dt / 0.5);
      const grow = f.focused || f.level >= 0.5;
      if (grow !== this.building) {
        this.building = grow;
        this.emit({ type: 'road', on: grow });
        if (grow) this.talk.say('good', 1, 5);
        else if (this.roadTip > h.x) this.talk.say('small', 1, 5);
      }
      if (grow) this.grow(h.x + this.reach);
      // a held view: light coins shower the road ahead
      if (f.hold >= this.nextView && this.views < R.viewMax) {
        this.views++;
        this.viewsAll++;
        this.nextView += R.viewAgain;
        this.shower(R.viewCoins);
        this.emit({ type: 'view', n: R.viewCoins });
        this.talk.say('big', 2, 3);
      }
    } else if (this.building && (!this.pushBlock || this.block.blind)) {
      this.building = false;
      this.emit({ type: 'road', on: false });
    }
    if (!this.pushBlock) this.reach += (0 - this.reach) * Math.min(1, dt / 1.5);
    this.meterNow = !f.reliable ? null : this.sighted ? clamp(f.level) : this.restBlock && this.blockT >= R.rLeadIn[this.eeg ? 'eeg' : 'fnirs'] ? clamp(f.calm) : null;
    // the orchard (rest): ripeness from calm
    if (this.wantOrchard && this.stage === 'run' && !this.world.inOrchard(h.x + 2)) this.openOrchard();
    if (this.restBlock && this.blockT >= R.rLeadIn[this.eeg ? 'eeg' : 'fnirs'] && f.reliable) {
      this.ripe = clamp(this.ripe + (R.rGain * f.calm - R.rLeak) * dt, 0, 1);
    }
  }

  /** Lay the road from its tip to `to` (planks of light at the lane's height, coins and springs). */
  private grow(to: number): void {
    const R = RULES, w = this.world, h = this.hero;
    const stopAt = w.finish.x - 4;
    if (this.roadTip < h.x - 0.5) {
      // a new road: a spring of light ahead on whatever surface is there
      let sx = h.x + R.springAhead;
      while (w.inPit(sx) && sx < h.x + 14) sx += 0.5;
      if (sx >= stopAt) return;
      const top = w.surfaceAt(sx) ?? 0;
      if (top < R.lane - 1.2) w.springs.push({ x: sx, y: top, squash: 0, born: this.t });
      this.roadTip = sx + 0.4;
      this.nextSpring = sx + R.springEvery;
      this.nextCoin = this.roadTip + 0.6;
    }
    while (this.roadTip < to && this.roadTip < stopAt) {
      const x0 = this.roadTip, x1 = x0 + R.plank;
      if (!w.orchards.some(o => x1 > o.x0 - 1 && x0 < o.x1 + 1) && !w.solids.some(s => s.top > R.lane - 0.05 && s.x1 > x0 - 0.3 && s.x0 < x1 + 0.3)) {
        w.plats.push({ x0, x1, y: R.lane, kind: 'road', squash: 0, born: this.t, passed: -1 });
        this.emit({ type: 'plank', x: x0 });
        while (this.nextCoin < x1) {
          w.coins.push({ x: this.nextCoin, y: R.lane + 0.5, kind: 'light', taken: false, t: this.t });
          this.nextCoin += R.coinEvery;
        }
        if (x0 >= this.nextSpring) {
          const top = w.surfaceAt(x0 + 0.6);
          if (top !== null && top < R.lane - 1.2 && !w.inPit(x0 + 0.6)) w.springs.push({ x: x0 + 0.6, y: top, squash: 0, born: this.t });
          this.nextSpring = x0 + R.springEvery;
        }
      } else this.nextCoin = Math.max(this.nextCoin, x1 + 0.4);
      this.roadTip = x1;
    }
  }

  /** A Widok, or a passed push: light coins over the road ahead (or the street when there is none). */
  private shower(n: number): void {
    const w = this.world, h = this.hero;
    const onRoad = this.roadTip > h.x + 3;
    for (let i = 0; i < n; i++) {
      const x = h.x + 3 + i * 0.7;
      const y = onRoad && x < this.roadTip ? RULES.lane + 0.6 + 0.5 * Math.sin(i * 0.9) : 1.2 + 0.4 * Math.sin(i * 0.9);
      w.coins.push({ x, y, kind: 'light', taken: false, t: this.t });
    }
  }

  /** The blind block's end: its focus becomes a stretch of road (with its spring). */
  private reveal(share: number): void {
    const len = Math.round(share * RULES.revealMax);
    if (share < 0.2 || len < 3 || this.stage !== 'run') {
      this.emit({ type: 'reveal', len: 0, share });
      return;
    }
    this.roadTip = -Infinity;
    this.grow(this.hero.x + RULES.springAhead + len);
    this.emit({ type: 'reveal', len, share });
  }

  /** Open the street into a fig orchard at the next safe place ahead (a rest block's walk). */
  private openOrchard(): void {
    const R = RULES, w = this.world, h = this.hero;
    const cut = w.findCut(h.x + R.cutAhead, h.x + R.cutSearch);
    if (cut === null) return;
    const toReach = (cut - h.x) / R.run;
    const rest = this.restBlock ? this.blockIndex : this.blockIndex + 1;
    const restLeft = this.restBlock ? this.block.dur - this.blockT : (this.plan[rest]?.dur ?? 20) + (this.block.dur - this.blockT);
    if (restLeft - toReach < 6) return;
    const len = Math.max(18, (restLeft - toReach) * R.walk + 3);
    this.orchardBlock = rest;
    w.splice(cut, len);
    w.orchard(cut, cut + len);
    // the road never runs into an orchard
    if (this.roadTip > cut) this.roadTip = Math.min(this.roadTip, cut);
    this.wantOrchard = false;
    this.emit({ type: 'orchard', x0: cut, x1: cut + len });
  }

  // ── the run ─────────────────────────────────────────────────────
  private physics(dt: number): void {
    const h = this.hero, w = this.world, R = RULES;
    // the pace: a walk in the orchard, quicker on the road
    h.pace = w.inOrchard(h.x) ? R.walk : h.onRoad ? R.roadRun : R.run;
    const prevX = h.x;
    h.step(dt, w);
    if (h.mode === 'run') {
      this.roadSec = Math.max(this.roadSec, h.roadSec);
      this.pickups();
      this.passTrees(prevX);
      for (const p of w.plats) if (p.kind === 'road' && p.passed < 0 && p.x1 < h.x - 1) p.passed = this.t;
      this.remember(dt);
    }
    this.critters(dt);
    for (const p of w.plats) if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 4);
    for (const s of w.springs) if (s.squash > 0) s.squash = Math.max(0, s.squash - dt * 3);
    for (const tl of w.tiles) tl.glow = Math.max(0, tl.glow - dt);
    w.prune(h.x - 28, this.t);
  }

  private critters(dt: number): void {
    const R = RULES;
    for (const c of this.world.critters) {
      c.t += dt;
      if (c.state === 'idle') {
        if (c.kind === 'goose') {
          c.x += c.dir * R.waddle * dt;
          if (Math.abs(c.x - c.home) > R.waddleSpan / 2) {
            c.x = c.home + Math.sign(c.x - c.home) * R.waddleSpan / 2;
            c.dir = -c.dir;
          }
        }
      } else if (c.state === 'bonked') {
        c.spin += dt;
        if (c.t > 0.7) c.x += c.dir * 2.6 * dt;
        if (c.t > 2.6) c.state = 'gone';
      }
    }
  }

  private pickups(): void {
    const h = this.hero, w = this.world, R = RULES;
    const mx = h.x, my = h.y + R.height / 2;
    for (const c of w.coins) {
      if (c.taken) continue;
      const dx = c.x - mx, dy = c.y - my;
      if (dx * dx + dy * dy > R.pick * R.pick) continue;
      c.taken = true;
      c.t = this.t;
      this.coinChain = this.t - this.lastCoinT <= R.chainGap ? this.coinChain + 1 : 1;
      this.lastCoinT = this.t;
      this.pay(1);
      this.levelCoins++;
      this.emit({ type: 'coin', x: c.x, y: c.y, chain: this.coinChain, light: c.kind === 'light' });
    }
    for (const s of w.specials) {
      if (s.taken) continue;
      const dx = s.x - mx, dy = s.y - my;
      if (dx * dx + dy * dy > 0.72 * 0.72) continue;
      s.taken = true;
      s.t = this.t;
      this.levelSpecials++;
      this.specialsAll++;
      this.pay(R.specialValue);
      this.levelCoins += R.specialValue;
      this.emit({ type: 'special', x: s.x, y: s.y, got: this.levelSpecials, tier: this.tier });
      if (this.levelSpecials >= R.specials) {
        this.sets++;
        this.pay(R.setBonus);
        this.levelCoins += R.setBonus;
        this.emit({ type: 'set', tier: this.tier, pay: R.setBonus });
        this.talk.say('set', 2, 4);
      } else if (this.levelSpecials === 1) this.talk.say('big', 1, 4);
    }
  }

  /** Passing a fig tree: its ripe figs (and a bubble from a full tree). */
  private passTrees(prevX: number): void {
    const h = this.hero, R = RULES;
    for (const tr of this.world.trees) {
      if (!(prevX < tr.x && h.x >= tr.x)) continue;
      const ripe = figsFor(this.ripe);
      const n = Math.max(0, ripe - tr.picked);
      if (n <= 0) continue;
      tr.picked = ripe;
      this.figs += n;
      this.pay(n);
      this.levelCoins += n;
      let bubble = false;
      if (ripe >= R.figAt.length && !tr.bubble) {
        tr.bubble = true;
        if (this.bubbles < R.bubbleMax) { this.bubbles++; bubble = true; }
      }
      this.taughtDone('orchard');
      this.emit({ type: 'figs', n, x: tr.x, y: 2, bubble });
    }
  }

  /** Where he was (for the bubble): standing on something solid, not in an orchard's gate. */
  private remember(dt: number): void {
    const h = this.hero;
    this.pastT += dt;
    if (this.pastT < RULES.historyEvery) return;
    this.pastT = 0;
    const safe = h.ground && !this.world.inPit(h.x) && h.pauseT < 0;
    this.past.push({ t: this.t, x: h.x, y: h.y, safe });
    while (this.past.length && this.past[0].t < this.t - RULES.history) this.past.shift();
  }

  private onHero(e: HeroEvent): void {
    const h = this.hero, R = RULES;
    switch (e.type) {
      case 'jump':
        this.flightTricks = 0;
        this.taughtDone('tap');
        if (e.held) this.taughtDone('hold');
        this.emit({ type: 'jump', held: e.held });
        break;
      case 'land':
        this.flightTricks = 0;
        this.emit({ type: 'land', fall: e.fall });
        break;
      case 'wallJump':
        this.walls++;
        this.taughtDone('wall');
        this.trick('wall');
        this.emit({ type: 'wallJump', x: h.x, y: h.y });
        break;
      case 'spin':
        if (e.vault) this.vaultSpins++;
        this.trick(e.vault ? 'vaultSpin' : 'spin');
        this.emit({ type: 'spin', x: h.x, y: h.y, vault: e.vault });
        break;
      case 'bounce':
        if (e.on === 'awning') this.taughtDone('awning');
        else this.talk.say('crowd', 1, 4);
        this.emit({ type: 'bounce', on: e.on, x: e.x, y: e.y });
        break;
      case 'spring':
        this.trick('spring');
        this.taughtDone('road');
        this.emit({ type: 'spring', x: e.spring.x, y: e.spring.y });
        break;
      case 'vault':
        this.taughtDone('goose');
        this.emit({ type: 'vault', x: e.critter.x, y: e.critter.y, kind: e.critter.kind });
        break;
      case 'bonk': {
        const c = e.critter;
        c.state = 'bonked';
        c.t = 0;
        c.dir = h.x < c.x ? 1 : -1;
        const pay = R.bonkPay[Math.min(R.bonkPay.length - 1, h.bonks - 1)];
        this.bonks++;
        this.pay(pay);
        this.levelCoins += pay;
        this.stop = Math.max(this.stop, R.bonkStop);
        this.taughtDone('goose');
        this.trick('bonk');
        this.emit({ type: 'bonk', x: c.x, y: c.y, kind: c.kind, pay, chain: h.bonks });
        this.talk.say('bonk', h.bonks >= 2 ? 2 : 1, 3);
        break;
      }
      case 'mantle': this.emit({ type: 'mantle' }); break;
      case 'legUp': this.emit({ type: 'legUp' }); break;
      case 'tile':
        e.tile.glow = 1;
        this.taughtDone(e.tile.kind === 'pause' ? 'pause' : e.tile.kind);
        if (e.tile.kind === 'pause') this.talk.say('pause', 1, 3);
        this.emit({ type: 'tile', kind: e.tile.kind, x: (e.tile.x0 + e.tile.x1) / 2, y: e.tile.y });
        break;
      case 'longJump':
        this.trick('long');
        this.emit({ type: 'longJump' });
        break;
      case 'trunk': this.grabTrunk(e.y); break;
      case 'fall': this.fall(); break;
    }
  }

  /** A stylish move: points, multiplied by the tricks in the same flight. */
  private trick(kind: Trick): void {
    const h = this.hero;
    this.flightTricks++;
    const pts = RULES.style[kind] * Math.max(1, this.flightTricks);
    this.levelStyle += pts;
    this.styleAll += pts;
    this.emit({ type: 'style', trick: kind, pts, n: this.flightTricks, x: h.x, y: h.y + 1.2 });
  }

  // ── falls: the bubble and the rope ──────────────────────────────
  private fall(): void {
    const h = this.hero;
    this.falls++;
    h.mode = 'held';
    this.building = false;
    if (this.bubbles > 0) this.startBubble(true);
    else {
      // the neighbour's rope: out on the far rim of the pit
      const pit = this.world.pits.find(p => h.x > p.x0 - 0.5 && h.x < p.x1 + 0.5);
      const x1 = pit ? pit.x1 + 0.5 : h.x + 1;
      this.rope = { x0: h.x, y0: h.y, x1, y1: this.world.surfaceAt(x1) ?? 0 };
      this.setStage('rope');
      this.emit({ type: 'fall', bubble: false });
      this.talk.say('fall', 1, 4);
    }
  }

  /** A bubble: he floats back to where he stood a few seconds ago (a fall, or a tap on the bubble button). */
  private startBubble(fell: boolean): void {
    const h = this.hero;
    const want = this.t - RULES.rewind;
    let to: Past | null = null;
    for (const s of this.past) if (s.safe && s.t <= want) to = s;
    if (!to) to = this.past.find(s => s.safe) ?? { t: this.t, x: Math.max(1, h.x - 6), y: 0, safe: true };
    if (this.world.inPit(to.x)) to = { ...to, y: this.world.surfaceAt(to.x) ?? 0 };
    this.bubbles--;
    this.bubblesUsed++;
    this.bubble = { x0: h.x, y0: Math.max(h.y, -1.6), x1: to.x, y1: to.y, hover: false };
    h.mode = 'held';
    this.setStage('bubble');
    this.past = this.past.filter(s => s.t <= to!.t);
    this.emit({ type: 'fall', bubble: true });
    if (!this.taught.has('bubble')) this.emit({ type: 'hint', key: 'bubble', x: to.x, y: to.y + 1.4 });
    if (fell) this.talk.say('bubble', 1, 4);
  }

  /** The bubble button (or B): a voluntary rewind to try a missed coin again. */
  bubbleNow(): boolean {
    if (this.stage !== 'run' || this.bubbles <= 0 || !this.started || this.phase !== 'play' || this.hero.mode !== 'run') return false;
    this.startBubble(false);
    this.taughtDone('button');
    return true;
  }

  private pop(): void {
    const b = this.bubble;
    if (!b) return;
    this.hero.place(b.x1, b.y1, RULES.run * 0.4);
    this.hero.mode = 'run';
    this.bubble = null;
    this.taughtDone('bubble');
    this.setStage('run');
    this.emit({ type: 'pop', x: b.x1, y: b.y1 });
  }

  // ── the finish ──────────────────────────────────────────────────
  private grabTrunk(y: number): void {
    const R = RULES, h = this.hero;
    this.band = bandFor(y);
    const pay = R.bandPay[this.band];
    this.pay(pay);
    this.levelCoins += pay;
    if (this.band >= 4) {
      this.tops++;
      this.trick('top');
      this.talk.say('big', 2, 3);
    }
    const syc = this.world.finish.kind === 'sycamore';
    if (syc) this.talk.say('sycamore', 2, 5);
    this.building = false;
    this.roadTip = -Infinity;
    this.setStage('finish');
    this.emit({ type: 'trunk', band: this.band, pay, x: h.x, y, sycamore: syc });
  }

  private tally(): void {
    const R = RULES, lv = this.level, rec = this.p.levels[lv.index];
    const tier = this.tier;
    const styleCoins = Math.round(this.levelStyle * R.styleToCoins);
    this.pay(styleCoins);
    this.levelCoins += styleCoins;
    const fin = finishLevel(this.p, lv.index, this.levelCoins, this.band, this.levelSpecials);
    this.starsGained += fin.gained;
    this.levelsDone++;
    this.bestLevel = Math.max(this.bestLevel, lv.index);
    this.lastResult = {
      index: lv.index, coins: this.levelCoins, specials: this.levelSpecials, tier, stars: fin.stars, gained: fin.gained,
      band: this.band, style: this.levelStyle, styleCoins, completed: fin.completed !== null, first: fin.first,
      world: lv.finish === 'sycamore',
    };
    void rec;
    if (lv.finish === 'sycamore' && this.p.worldsSeen < lv.world) {
      this.p.worldsSeen = lv.world;
      this.storyAfter = { kind: 'world', world: lv.world };
    }
    this.setStage('tally');
    this.emit({ type: 'levelDone', res: this.lastResult });
  }

  private nextLevelNow(): void {
    this.loadLevel(nextLevel(this.p, this.levelIndex));
    this.emit({ type: 'levelStart', index: this.levelIndex, replay: this.p.levels[this.levelIndex].done });
    this.talk.say(this.level.finish === 'sycamore' ? 'crowd' : 'level', 1, 6);
  }

  private loadLevel(i: number): void {
    this.levelIndex = i;
    this.levelsRun++;
    this.world = new World(LEVELS[i], tierIndex(this.p.levels[i]));
    this.hero.place(1, 0, RULES.run);
    this.hero.mode = 'run';
    this.levelCoins = 0;
    this.levelSpecials = 0;
    this.levelStyle = 0;
    this.bubbles = Math.max(RULES.bubbles, Math.min(RULES.bubbleMax, this.bubbles));
    this.band = -1;
    this.roadTip = -Infinity;
    this.building = false;
    this.past = [];
    this.seen.clear();
    this.p.lastLevel = i;
    // a rest block in progress opens its orchard right at the start
    this.orchardBlock = -1;
    if (this.restBlock) this.wantOrchard = true;
  }

  private showStory(s: { kind: StoryKind; world: number }): void {
    this.story = s;
    this.hero.mode = 'held';
    this.setStage('story');
    this.emit({ type: 'story', kind: s.kind, world: s.world });
  }

  private setStage(s: Stage): void {
    this.stage = s;
    this.stageT = 0;
  }

  private stageStep(dt: number): void {
    const R = RULES;
    this.stageT += dt;
    switch (this.stage) {
      case 'bubble': {
        const b = this.bubble!;
        if (!b.hover && this.stageT >= R.floatSec) b.hover = true;
        if (b.hover && this.stageT >= R.floatSec + R.autoPop) this.pop();
        break;
      }
      case 'rope':
        if (this.stageT >= R.ropeSec) {
          const r = this.rope!;
          this.hero.place(r.x1, r.y1, R.run * 0.5);
          this.hero.mode = 'run';
          this.rope = null;
          this.setStage('run');
          this.emit({ type: 'ropeEnd' });
        }
        break;
      case 'finish':
        if (this.stageT >= R.slideSec) this.tally();
        break;
      case 'tally':
        if (this.stageT >= R.tallySec) this.afterTally();
        break;
      case 'story':
        if (this.stageT >= R.storySec) this.endStory();
        break;
      default: break;
    }
  }

  private afterTally(): void {
    if (this.storyAfter) {
      const s = this.storyAfter;
      this.storyAfter = null;
      this.showStory(s);
      return;
    }
    this.nextLevelNow();
    this.setStage('run');
  }

  private endStory(): void {
    this.story = null;
    if (this.stage !== 'story') return;
    if (this.levelsDone > 0 && this.lastResult && this.level.index === this.lastResult.index) {
      this.nextLevelNow();
    } else this.hero.mode = 'run';
    this.setStage('run');
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A press (pointer or key down). */
  press(): void {
    if (!this.started || this.phase !== 'play') return;
    switch (this.stage) {
      case 'run': this.hero.press(this.world); break;
      case 'bubble': if (this.bubble?.hover || this.stageT > 0.5) this.pop(); break;
      case 'tally': if (this.stageT > 1.2) this.afterTally(); break;
      case 'story': if (this.stageT > 1.2) this.endStory(); break;
      default: break;
    }
  }

  release(): void { this.hero.release(); }

  key(key: string, down: boolean): boolean {
    if (key === ' ' || key === 'Spacebar' || key === 'ArrowUp' || key === 'w' || key === 'W' || key === 'Enter') {
      if (down) this.press(); else this.release();
      return true;
    }
    if ((key === 'b' || key === 'B' || key === 'ArrowLeft') && down) return this.bubbleNow() || true;
    return false;
  }

  // ── the tutorial ────────────────────────────────────────────────
  private taughtDone(k: Teach): void { this.taught.add(k); }

  /** A coach mark when a thing first matters (until the player has done it once, ever). */
  private teach(): void {
    if (this.stage !== 'run' || !this.started) return;
    const h = this.hero, w = this.world;
    const want = (k: Teach, x: number, y: number) => {
      if (this.taught.has(k)) return;
      const last = this.hinted.get(k);
      if (last !== undefined && this.t - last < 9) return;
      this.hinted.set(k, this.t);
      this.emit({ type: 'hint', key: k, x, y });
    };
    if (this.t > 1.2 && !this.taught.has('tap')) want('tap', h.x, h.y + 1.6);
    const ahead = (x: number) => x > h.x + 1 && x < h.x + 6;
    for (const s of w.solids) {
      if (s.kind !== 'ground' && s.kind !== 'trunk' && s.top >= 1.6 && s.top <= 2.6 && ahead(s.x0) && !this.seen.has(s)) {
        this.seen.add(s);
        if (this.taught.has('tap')) want('hold', s.x0, s.top + 0.6);
      }
    }
    for (const c of w.critters) if (c.state === 'idle' && ahead(c.x)) want('goose', c.x, c.y + 1);
    for (const tl of w.tiles) if (!tl.used && ahead(tl.x0)) want(tl.kind === 'pause' ? 'pause' : tl.kind, tl.x0 + 0.6, tl.y + 0.6);
    for (const p of w.plats) if (p.kind === 'awning' && ahead(p.x0)) want('awning', (p.x0 + p.x1) / 2, p.y + 0.4);
    for (const s of w.specials) if (!s.taken && s.x > h.x + 2 && s.x < h.x + 8) want('special', s.x, s.y);
    // a special left behind with a bubble in hand: the bubble button takes him back for it (once a session,
    // until he has used the button) — on a phone the button is the one control besides the street
    if (this.bubbles > 0 && !this.hinted.has('button')) {
      for (const s of w.specials) if (!s.taken && h.x > s.x + 1.2 && h.x < s.x + 5) want('button', s.x, s.y);
    }
    if (h.sliding) want('wall', h.x, h.y + 1.2);
    if (this.sighted && this.building) {
      const sp = w.springs.find(s => s.x > h.x + 0.5);
      if (sp) want('road', sp.x, sp.y + 0.6);
    }
    if (w.inOrchard(h.x)) {
      const tr = w.trees.find(tt => tt.x > h.x + 1);
      if (tr) want('orchard', tr.x, 2.2);
    }
  }

  // ── accounting ──────────────────────────────────────────────────
  private pay(n: number): void {
    if (n <= 0) return;
    const before = homesRestored(this.p.denarii + this.score + this.giftNow);
    this.score += n;
    const after = homesRestored(this.p.denarii + this.score + this.giftNow);
    for (let i = before; i < after; i++) {
      this.homesNow.push(i);
      this.emit({ type: 'home', index: i });
    }
  }

  /** The session's credits into the progress, once (the end, or finish()). */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p;
    p.sessions++;
    p.denarii += this.score + this.giftNow;
    p.figs += this.figs;
    p.bonks += this.bonks;
    p.pushes += this.pushesBegun;
    p.lastLen = this.plannedSec;
    p.taught = [...this.taught];
    // missions
    const done: MissionId[] = [];
    for (const id of p.missions) {
      const m = missionById(id);
      if (m && this.missionValue(m.kind) >= m.target) done.push(id);
    }
    if (done.length) {
      p.missionsDone += done.length;
      p.denarii += done.length * RULES.missionPay;
      turnPages(p, done);
    }
    this.missionsDone = done;
  }

  missionValue(kind: (typeof MISSIONS)[number]['kind']): number {
    switch (kind) {
      case 'coins': return this.score;
      case 'bonk': return this.bonks;
      case 'wall': return this.walls;
      case 'set': return this.sets;
      case 'figs': return this.figs;
      case 'road': return Math.floor(this.roadSec);
      case 'style': return this.styleAll;
      case 'top': return this.tops;
      case 'levels': return this.levelsDone;
      case 'vaultSpin': return this.vaultSpins;
    }
  }

  /** The session ends: settle (credit the session). */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.blockIndex < this.plan.length && this.phase === 'play') {
      this.endBlock();
      this.blockIndex = this.plan.length;
    }
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

  /** The pad follows the level in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play' || !this.blockOn) return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(f.level);
    return null;
  }

  signal(): SignalPhase {
    if (!this.started || this.phase !== 'play' || !this.blockOn) return { want: 'free', blind: false };
    const b = this.block;
    const want: TracePhase = b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    const last = this.blockIndex >= this.plan.length - 1;
    const left = Math.max(0, (last ? Math.min(b.dur, this.plannedSec - (this.t - this.blockT)) : b.dur) - this.blockT);
    const nb = last ? null : this.plan[this.blockIndex + 1];
    const next: TracePhase | null = this.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : nb.kind === 'rest' ? 'rest' : 'free') : 'free') : null;
    return { want, blind: this.blind, task: this.tip, left, next };
  }

  meter(): number | null { return this.meterNow; }

  headline(): Headline {
    const got = this.levelSpecials;
    return { value: this.score, sub: t('sub', { code: levelCode(this.levelIndex), got, n: RULES.specials }) };
  }

  /** Time is up: stop once no bubble, rope or finish is in the air (or a moment later). */
  canStop(): boolean {
    if (this.phase === 'done') return true;
    if (this.t >= this.plannedSec + RULES.settle) return true;
    return this.stage === 'run' || this.stage === 'tally' || this.stage === 'story';
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const lv = this.bestLevel >= 0 ? this.bestLevel : this.levelIndex;
    const stats: [string, string][] = [
      [t('stat.level'), `${levelCode(lv)} · ${levelName(lv)}`],
      [t('stat.levels'), String(this.levelsDone)],
      [t('stat.specials'), String(this.specialsAll)],
      [t('stat.stars'), this.starsGained ? `+${this.starsGained}` : '—'],
      [t('stat.style'), fmtNum(this.styleAll)],
      [t('stat.bonks'), String(this.bonks)],
      [t('stat.road'), t('sec', { n: Math.floor(this.roadSec) })],
      [t('stat.figs'), String(this.figs)],
      [t('stat.homes'), `${homesRestored(p.denarii + (this.settled ? 0 : this.score + this.giftNow))}/${HOMES.length}`],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: t('unitWord'), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the top
   * of the palm or the sycamore (Luke 19:5), a household restored (19:8), a long view (Hebrews 12:2,
   * Psalm 34:5), a fall rewound (19:10); else Luke 19:6.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.tops > 0 || (this.lastResult?.world ?? false)) fit.push('luk19.5');
    if (this.homesNow.length) fit.push('luk19.8');
    if (this.maxHold >= RULES.longHold) fit.push('heb12.2', 'psa34.5');
    if (this.falls > 0) fit.push('luk19.10');
    fit.push('luk19.6');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    for (const i of this.homesNow.slice(0, 2)) add(0, t('hl.home', { name: HOMES[i].name, fix: HOMES[i].fix }));
    if (this.sets) add(1, t('hl.set', { n: this.sets }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(2, t('hl.record', { n: fmtNum(this.score) }));
    if (this.starsGained) add(3, t('hl.stars', { n: this.starsGained }));
    if (this.tops) add(4, t('hl.top', { n: this.tops }));
    if (this.viewsAll) add(5, t('hl.views', { n: this.viewsAll }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { n: this.blindShare }));
    for (const id of this.missionsDone) add(7, t('hl.mission', { name: missionById(id)?.name ?? id }));
    if (this.giftNow) add(8, t('hl.gift', { n: this.giftNow }));
    // the near miss toward the next star of the level being played
    const lv = this.level, rec = this.p.levels[lv.index];
    if (this.stage !== 'tally' && rec.stars < 2 && this.levelCoins > 0 && this.levelCoins < lv.target) {
      add(9, t('hl.near', { n: lv.target - this.levelCoins }));
    }
    const out = notes.sort((a, b) => a.rank - b.rank).slice(0, 4).map(n => n.text);
    out.push(t(this.p.worldsSeen >= 2 ? 'close.final' : this.levelsDone > 0 ? 'close.level' : 'close.short'));
    return out;
  }

  /** Names for the view. */
  levelLabel(): string { return `${levelCode(this.levelIndex)} · ${levelName(this.levelIndex)}`; }
  tierName(): string { return TIERS[this.tier]; }
}

/** The moments the companion has (re-exported for the tests). */
export type { Moment };

/** The name of the level that follows the one just finished (the tally card's "Next:"). */
export const nextLevelName = (sim: ZacheuszSim): string => levelName(nextLevel(sim.p, sim.levelIndex));
