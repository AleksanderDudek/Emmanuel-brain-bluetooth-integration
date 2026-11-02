/**
 * Zacheusz's session, without the DOM or the canvas (so every rule is unit-tested): the run through
 * Jericho (hero.ts on the street of world.ts, laid chunk by chunk from content.ts), the blocks, what
 * the band changes, the rope, the sycamore at each course's end, the meta (meta.ts) and the
 * session's numbers.  All numbers are in rules.ts (re-exported here).
 *
 * The hands run: a tap jumps, a longer press jumps higher, a tap against a wall kicks off it.  The
 * band only adds:
 *   Wypatrywanie (push)  after a lead-in, the high way's pieces (bridges, fronds, awnings across the
 *                        roofs) unfold with the level: each locks its state 1.5 s before he reaches
 *                        it — solid at or above the threshold, an outline below — so the lag never
 *                        pulls a floor from under a jump.  A held view (6 s Mendi / 4 s HALO) is a
 *                        "Widok": a burst of denarii on the roofs ahead; the hold draws the
 *                        procession's dust nearer on the horizon.
 *   Cień sykomory (rest) a shaded street at a walk, no pits; calm ripens the figs (R), picked as he
 *                        passes the trees.  A passed block: a basket of figs.
 *   Tłum (blind)         every 4th push from the 3rd session: the crowd hides the palms and the
 *                        high way stays outlined; at its end the crowd parts, the palms show, and
 *                        the block's last 15 s of focus become a row of solid rooftops.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the pieces lock as "mist" (an outline, the sensor's fault), the sightline and the dust
 * hold still and R holds; a block with under 8 reliable seconds has no verdict and floors R at 0.4.
 *
 * Grace and craft: the rope (a fall rewinds him 3 s, unlimited; the second fall into the same pit
 * brings a neighbour's plank), the leg-up at a wall, the ladders, the denarii on the street path,
 * the households and the day's gift never wait on the band; the band adds the high way's denarii,
 * the Widok, the figs and the reveal's rooftops.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import {
  DOOR_X, FINALE, FINISH, HOMES, REVEAL, SHADE, TIPS, TRUNK_X, WARM, chunkById, course, dailyCourse, missionById,
  type Course, type Home, type MissionId, type MissionKind, type Tier,
} from './content';
import { Hero, type HeroEvent } from './hero';
import { t, unit } from './i18n';
import {
  bestFor, courseRec, finishCourse, homesRestored, lenKey, pickCourse, tierOf, turnPages, type ZacheuszProgress,
} from './meta';
import { RULES } from './rules';
import { World, type Coin, type FigTree, type Pit, type Plat, type Zone } from './world';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

export type SimEvent =
  | { type: 'coin'; coin: Coin; chain: number }
  | { type: 'special'; coin: Coin; got: number; tier: Tier }
  | { type: 'jump'; held: boolean }
  | { type: 'wallJump' }
  | { type: 'bounce'; plat: Plat }
  | { type: 'vault'; x: number; kind: 'basket' | 'chicken' | 'dog' }
  | { type: 'mantle' }
  | { type: 'legUp' }
  | { type: 'ladder' }
  | { type: 'land'; fall: number }
  | { type: 'rope'; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'ropeEnd' }
  | { type: 'plank'; pit: Pit }
  | { type: 'lock'; plat: Plat }
  | { type: 'view'; n: number }
  | { type: 'telegraph'; next: Block }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged block: its verdict, the share on the asked side and the share it needed, its span in play time */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number }
  | { type: 'pass'; coins: number }
  | { type: 'basket'; pay: number }
  | { type: 'blindReveal'; sec: number; solid: number }
  | { type: 'figs'; tree: FigTree; n: number }
  | { type: 'courseStart'; course: Course }
  | { type: 'finish'; course: Course; branch: number; pay: number; first: boolean; completed: Tier | null; specials: number }
  | { type: 'treeEnd' }
  | { type: 'home'; home: Home }
  | { type: 'mission'; id: MissionId }
  | { type: 'gift'; pay: number }
  | { type: 'finale' }
  | { type: 'door' };

const NO_EVENTS: readonly SimEvent[] = [];
const PLAN_SALT = 0x2545f491;

// ── pure rules ───────────────────────────────────────────────────
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks.  A first-ever session opens with the warm-up "Pierwsze kroki" (30 s in 5
 * and 10 min, 20 s in 3, 6 s in a 40 s test); then Wypatrywanie / Cień sykomory pairs (24 ± 4 s
 * and 23 ± 3 s, scaled to end on time, jittered only when there is room) ending with a rest,
 * leaving the last 6 s to the walk home.  No block under 12 s.
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

/** The branch of the sycamore he reaches when he touches its trunk with his feet at `y` (1..5). */
export const branchFor = (y: number): number => RULES.branchAt.filter(at => y >= at - 1e-9).length || 1;

/** The figs of a tree ripe at ripeness R (0..5). */
export const figsFor = (R: number): number => RULES.figAt.filter(at => R >= at - 1e-9).length;

/** Five special places of a course, spread over it: `slots` = how many special places its chunks have. */
export function specialSlots(slots: number, n = RULES.specials): number[] {
  if (slots <= n) return Array.from({ length: slots }, (_, i) => i);
  return Array.from({ length: n }, (_, k) => Math.round((k * (slots - 1)) / (n - 1)));
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: ZacheuszProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

export type Phase = 'play' | 'finale' | 'done';

/** A course being laid: its chunks, the next to lay, which special places of each chunk carry a special. */
interface Laying { course: Course; next: number; specials: Map<number, { picks: number[]; first: number }> }

/** A course being run: its specials picked so far, its ropes, its denarii. */
interface Running { course: Course; got: Set<number>; ropes: number; coins: number; tier: Tier; chunks: number }

export class ZacheuszSim {
  readonly p: ZacheuszProgress;
  readonly plannedSec: number;
  readonly world = new World();
  readonly hero: Hero;
  readonly trace = new SignalTrace(40, 0.1);
  readonly contrast = new BlockContrast(4);
  private readonly judge: RoundJudge;
  private readonly events: SimEvent[] = [];
  readonly lead: number;
  private readonly rLead: number;
  private readonly tauL: number;
  private readonly viewSec: number;
  readonly eeg: boolean;

  started = false;
  readonly session: number;
  readonly daily: boolean;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  blockStartT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';
  hint = false;
  private lastInput = 0;
  private acc = 0;
  private readonly keys = new Set<string>();
  private readonly pointers = new Set<number>();

  // the band
  reliable = false;
  /** the level smoothed again (held while the signal is away); the procession's dust nearness 0..1 */
  L = 0;
  dust = 0;
  /** the current focused stretch in a sighted push (s) */
  hold = 0;
  /** ripeness of the shade's figs 0..1 */
  R = 0;
  private relSec = 0;
  private unrelSec = 0;
  private floorR = false;
  private viewsBlock = 0;
  private readonly blindBins = new Float32Array(60);
  private blindBin = 0;
  private blindBinT = 0;

  // the street
  private laying: Laying | null = null;
  private readonly laid: number[] = [];
  private warmI = 0;
  private shadeI = 0;
  private finaleLaid = false;
  private revealDue: number | null = null;
  running: Running | null = null;
  private zoneId = -1;
  zone: Zone | null = null;
  /** the rope: from where, to where, how far along (s) */
  rope: { fromX: number; fromY: number; toX: number; toY: number; t: number } | null = null;
  /** in the sycamore: since when (s), at which branch's height */
  tree: { t: number; x: number; y: number; branch: number } | null = null;
  private readonly hist: { x: number; y: number; t: number }[] = [];
  private histT = 0;
  doorT = -1;

  // the session's numbers
  score = 0;
  chain = 0;
  maxChain = 0;
  private lastCoinT = -10;
  specials = 0;
  sets: Tier[] = [];
  ropes = 0;
  wallJumps = 0;
  bounces = 0;
  vaults = 0;
  figs = 0;
  views = 0;
  bestBranch = 0;
  cleanCourses = 0;
  readonly finished: Course[] = [];
  readonly homesNew: Home[] = [];
  blindSec = -1;
  private readonly done: MissionId[] = [];
  private giftNow = 0;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private settled = false;
  private readonly bestBefore: number | null;
  private dailyCoins = 0;
  private dailyRan = false;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.rLead = RULES.rLeadIn[band];
    this.tauL = RULES.tauL[band];
    this.viewSec = RULES.view[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.daily = p.dailyDay !== init.day;
    this.plan = planBlocks(init.plannedSec, this.session === 1, this.daily ? mulberry32((init.daySeed ^ PLAN_SALT) >>> 0) : init.rng);
    this.hero = new Hero(e => this.onHero(e));
    this.hero.place(1.2, 0, RULES.run);
    this.lay();
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  /** a sighted push past its lead-in: the high way answers the band */
  get sighted(): boolean { return this.phase === 'play' && this.block?.kind === 'push' && !this.block.blind && this.blockT >= this.lead; }
  get toNext(): number | null { return this.next ? Math.max(0, this.block.dur - this.blockT) : null; }
  get resting(): boolean { return this.phase === 'play' && this.block?.kind === 'rest'; }
  /** the ripeness the figs show: R, floored at 0.4 in a block with a bad signal */
  get ripe(): number {
    const bad = this.floorR || (this.relSec < RULES.minReliable && this.unrelSec >= 2);
    return clamp(Math.max(this.R, bad ? RULES.rFloor : 0));
  }
  /** the special set the course being run shows */
  get tier(): Tier { return this.running?.tier ?? 'silver'; }
  /** how far through the course being run (0..1), counted in chunks */
  get courseProgress(): number {
    const r = this.running, z = this.zone;
    if (!r || !z) return 0;
    if (z.kind === 'finish') return clamp(0.92 + 0.08 * clamp((this.hero.x - z.x0) / TRUNK_X));
    if (z.course !== r.course.index || z.seq < 0) return clamp(r.chunks / (r.course.chunks.length + 1));
    return clamp((z.seq + clamp((this.hero.x - z.x0) / (z.x1 - z.x0))) / (r.course.chunks.length + 1));
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
  }

  // ── the hands ───────────────────────────────────────────────────
  pointer(type: 'down' | 'move' | 'up', id: number): void {
    if (type === 'move') return;
    if (type === 'down') {
      if (!this.pointers.has(id)) this.press();
      this.pointers.add(id);
    } else {
      this.pointers.delete(id);
      this.letGo();
    }
  }

  /** Space, ↑, W or Enter: a jump while held; true when the key is the game's. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k !== ' ' && k !== 'ArrowUp' && k !== 'w' && k !== 'Enter') return false;
    if (down) {
      if (!this.keys.has(k)) this.press();
      this.keys.add(k);
    } else {
      this.keys.delete(k);
      this.letGo();
    }
    return true;
  }

  release(): void {
    this.keys.clear();
    this.pointers.clear();
    this.hero.release();
  }

  private press(): void {
    this.lastInput = this.t;
    if (!this.started || this.phase === 'done') return;
    this.hero.press();
  }

  private letGo(): void {
    if (!this.keys.size && !this.pointers.size) this.hero.release();
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    this.t = t;
    this.phaseT += dt;
    if (this.phase === 'play') this.schedule(dt, f, t);
    this.brain(dt, f);
    const phase: TracePhase = this.phase !== 'play' ? 'free' : this.block.kind === 'push' ? 'focus' : this.block.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(t, f, phase, this.blind);
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= RULES.step) {
      this.stepRun(RULES.step);
      this.acc -= RULES.step;
    }
    if (this.phase === 'finale' && this.doorT >= 0 && this.t - this.doorT >= 1.5) this.phase = 'done';
    this.hint = this.phase === 'play' && this.block.kind === 'warmup' && t - this.lastInput >= RULES.idleHint;
    this.checkMissions();
  }

  /**
   * The band's slow quantities.  L follows the level (held still while the signal is away), the
   * hold counts only in a sighted push, the dust follows the hold, R builds from calm in a rest
   * past its lead-in.  Nothing brain-driven moves while the signal is unreliable.
   */
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    this.reliable = f.reliable;
    if (this.phase === 'play') {
      if (f.reliable) this.relSec += dt;
      else this.unrelSec += dt;
    }
    if (f.reliable) this.L = approach(this.L, clamp(f.level), dt, this.tauL);
    if (this.sighted) {
      if (f.reliable) this.hold = f.focused ? Math.min(f.hold, this.blockT - this.lead) : 0;
      if (f.reliable) this.dust = approach(this.dust, clamp(this.hold / R.dustFull), dt, this.hold / R.dustFull > this.dust ? 0.8 : R.dustTau);
      const due = this.viewSec + this.viewsBlock * R.viewAgain;
      if (f.reliable && this.hold >= due && this.viewsBlock < R.viewMax) {
        this.viewsBlock++;
        this.views++;
        const n = this.burst(R.viewCoins, R.viewFrom, R.viewSpan);
        this.emit({ type: 'view', n });
      }
    } else {
      this.hold = 0;
      if (f.reliable || this.phase !== 'play') this.dust = approach(this.dust, 0, dt, R.dustTau);
    }
    if (this.phase === 'play' && b.kind === 'push' && b.blind) {
      this.blindBinT += dt;
      if (f.reliable && f.focused) this.blindBins[this.blindBin] += dt;
      if (this.blindBinT >= 0.25) {
        this.blindBinT -= 0.25;
        this.blindBin = (this.blindBin + 1) % this.blindBins.length;
        this.blindBins[this.blindBin] = 0;
      }
    }
    if (this.phase === 'play' && b.kind === 'rest' && this.blockT >= this.rLead && f.reliable) {
      this.R = clamp(this.R + (R.rGain * f.calm - R.rLeak) * dt);
    }
  }

  /** A row of denarii over the best way ahead: on the roofs and the solid high way where there is one. */
  private burst(n: number, from: number, len: number): number {
    const x0 = this.hero.x + from;
    for (let k = 0; k < n; k++) {
      const q = n > 1 ? k / (n - 1) : 0.5;
      const x = x0 + len * q;
      const top = this.world.topAt(x - 0.25, x + 0.25, 3);
      const y = (Number.isFinite(top) ? top : 0) + 0.7 + 0.6 * Math.sin(q * Math.PI);
      this.world.addCoin(x, y, this.t);
    }
    return n;
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
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      if (!last) this.emit({ type: 'telegraph', next: this.plan[this.blockIndex + 1] });
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
    this.blockStartT = this.t;
    this.telegraphed = false;
    this.relSec = 0;
    this.unrelSec = 0;
    this.judge.reset();
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.viewsBlock = 0;
      this.hold = 0;
      this.blindBins.fill(0);
    } else if (b.kind === 'rest') {
      this.R = 0;
      this.floorR = false;
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
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= R.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'rest' && verdict === null && this.relSec < R.minReliable) this.floorR = true;
      if (b.kind === 'push' && b.blind) {
        let sec = 0;
        for (const v of this.blindBins) sec += v;
        sec = Math.min(15, sec);
        this.blindSec = Math.max(this.blindSec, Math.round(sec));
        const solid = Math.round((sec / 15) * R.revealMax);
        this.revealDue = solid;
        this.trace.unveil(this.t);
        this.emit({ type: 'blindReveal', sec: Math.round(sec), solid });
      } else if (b.kind === 'push' && verdict) {
        this.emit({ type: 'pass', coins: this.burst(R.passPay, 5, 5) });
      }
      if (b.kind === 'rest' && verdict) {
        this.gain(R.basketPay);
        this.emit({ type: 'basket', pay: R.basketPay });
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.blockStartT, t1: this.t });
  }

  // ── laying the street ahead ─────────────────────────────────────
  /** What the street ahead should be: the block he will be in when he gets there (the telegraph looks ahead). */
  private streamKind(): 'warm' | 'course' | 'shade' | 'finale' {
    if (this.phase !== 'play') return 'finale';
    const last = this.blockIndex >= this.plan.length - 1;
    const b = this.telegraphed ? (last ? null : this.plan[this.blockIndex + 1]) : this.block;
    if (!b) return 'finale';
    return b.kind === 'warmup' ? 'warm' : b.kind === 'rest' ? 'shade' : 'course';
  }

  private lay(): void {
    const w = this.world;
    let guard = 0;
    const ahead = Math.max(RULES.aheadMin, this.hero.pace * RULES.aheadSec);
    while (w.end < this.hero.x + ahead && guard++ < 20) {
      const kind = this.streamKind();
      if (kind === 'finale' && this.started) {
        if (!this.finaleLaid) {
          this.finaleLaid = true;
          w.lay(FINALE, { course: -2 });
        } else w.road(12, -2);
        continue;
      }
      if (this.revealDue !== null) {
        w.lay(REVEAL, { course: -2, solid: this.revealDue, now: this.t });
        this.revealDue = null;
        continue;
      }
      if (kind === 'shade') {
        w.lay(SHADE[this.shadeI++ % SHADE.length], { course: -2 });
        continue;
      }
      if (kind === 'warm' && this.warmI < WARM.length) {
        w.lay(WARM[this.warmI++], { course: -2 });
        continue;
      }
      this.layCourse();
    }
  }

  private layCourse(): void {
    const w = this.world;
    if (!this.laying) {
      const c = this.daily && !this.laid.includes(-1) ? dailyCourse(this.init.daySeed) : course(pickCourse(this.p, this.laid.filter(i => i >= 0)));
      this.laid.push(c.index);
      // the course's special places, in order, and the five that carry a special
      const counts = c.chunks.map(id => chunkById(id)!.items.filter(it => it.t === 'sp').length);
      const total = counts.reduce((s, n) => s + n, 0);
      const pick = specialSlots(total);
      const specials = new Map<number, { picks: number[]; first: number }>();
      let at = 0, slot = 0;
      counts.forEach((n, ci) => {
        const picks: number[] = [];
        for (let k = 0; k < n; k++) if (pick.includes(at + k)) picks.push(k);
        if (picks.length) specials.set(ci, { picks, first: slot });
        slot += picks.length;
        at += n;
      });
      this.laying = { course: c, next: 0, specials };
    }
    const L = this.laying;
    if (L.next < L.course.chunks.length) {
      const ci = L.next++;
      const sp = L.specials.get(ci);
      w.lay(chunkById(L.course.chunks[ci])!, { course: L.course.index, seq: ci, specials: sp?.picks, firstSlot: sp?.first });
    } else {
      w.lay(FINISH, { course: L.course.index, seq: L.course.chunks.length });
      this.laying = null;
    }
  }

  // ── the run ─────────────────────────────────────────────────────
  private stepRun(dt: number): void {
    const h = this.hero, w = this.world;
    // the street's pace under him
    const z = w.zoneAt(h.x);
    if (z && z.id !== this.zoneId) this.enterZone(z);
    // the walk home is a run home until his door
    let pace = this.phase !== 'play' ? RULES.run : z?.speed ?? RULES.run;
    if (this.phase !== 'play' && z?.kind === 'finale') {
      const door = z.x0 + DOOR_X;
      pace = clamp((door - h.x) * 1.4, 0, RULES.run);
      if (h.x >= door - 0.05 && this.doorT < 0 && h.ground) {
        this.doorT = this.t;
        h.mode = 'stop';
        h.vx = 0;
        this.emit({ type: 'door' });
      }
    }
    h.pace = pace;
    if (this.rope) this.ropeTick(dt);
    else if (this.tree) this.treeTick(dt);
    else h.step(dt, w);
    // the high way locks ahead of him
    const lockX = h.x + RULES.lockSec * RULES.run;
    for (const p of w.plats) {
      if (!p.high || p.state !== 'live' || p.x0 > lockX) continue;
      p.state = !this.reliable ? 'mist' : this.sighted && this.L >= RULES.solidAt ? 'solid' : 'outline';
      p.lockedAt = this.t;
      this.emit({ type: 'lock', plat: p });
    }
    this.pickCoins();
    this.pickFigs();
    // the rope's memory: where he stood
    this.histT += dt;
    if (this.histT >= RULES.historyEvery) {
      this.histT = 0;
      if (h.standing) this.hist.push({ x: h.x, y: h.y, t: this.t });
      let old = 0;
      while (old < this.hist.length && this.hist[old].t < this.t - RULES.history) old++;
      if (old) this.hist.splice(0, old);
    }
    this.lay();
    if (h.x - (w.solids[0]?.x0 ?? h.x) > RULES.behind + 12) w.trim(h.x);
  }

  private enterZone(z: Zone): void {
    this.zoneId = z.id;
    this.zone = z;
    if ((z.kind === 'course' || z.kind === 'finish') && z.course !== -2 && z.seq >= 0) {
      if (!this.running || this.running.course.index !== z.course || (z.seq === 0 && this.running.chunks > 0)) {
        const c = z.course === -1 ? dailyCourse(this.init.daySeed) : course(z.course);
        const tier: Tier = z.course >= 0 ? tierOf(courseRec(this.p, z.course)) : 'silver';
        this.running = { course: c, got: new Set(), ropes: 0, coins: 0, tier, chunks: 0 };
        if (z.course === -1) this.dailyRan = true;
        this.emit({ type: 'courseStart', course: c });
      }
      this.running.chunks = Math.max(this.running.chunks, z.seq);
    }
  }

  private pickCoins(): void {
    const h = this.hero, R = RULES;
    const cy = h.y + R.height / 2;
    for (const c of this.world.coins) {
      if (c.got || Math.abs(c.x - h.x) > R.pick || Math.abs(c.y - cy) > R.pick + 0.1) continue;
      c.got = true;
      c.gotAt = this.t;
      this.chain = this.t - this.lastCoinT <= R.chainGap ? this.chain + 1 : 1;
      this.lastCoinT = this.t;
      this.maxChain = Math.max(this.maxChain, this.chain);
      if (c.special >= 0) {
        this.specials++;
        const r = this.running;
        if (r) r.got.add(c.special);
        this.gain(R.specialValue);
        this.emit({ type: 'special', coin: c, got: r ? r.got.size : 1, tier: this.tier });
      } else {
        this.gain(1);
        this.emit({ type: 'coin', coin: c, chain: this.chain });
      }
    }
  }

  /** Denarii gathered: the headline, the course's tally and Jericho's households (restored as their sums are reached). */
  private gain(n: number): void {
    this.score += n;
    if (this.running) {
      this.running.coins += n;
      if (this.running.course.index === -1) this.dailyCoins += n;
    }
    this.give(n);
  }

  /** Denarii for the households (play, a mission, the gift): every mark reached restores a home. */
  private give(n: number): void {
    const before = homesRestored(this.p.denarii);
    this.p.denarii += n;
    const after = homesRestored(this.p.denarii);
    for (let i = before; i < after; i++) {
      this.homesNew.push(HOMES[i]);
      this.emit({ type: 'home', home: HOMES[i] });
    }
  }

  private pickFigs(): void {
    const x = this.hero.x;
    for (const tr of this.world.figs) {
      if (tr.picked >= 0 || x < tr.x) continue;
      const n = figsFor(this.ripe);
      tr.picked = n;
      tr.at = this.t;
      this.figs += n;
      this.p.figs += n;
      this.emit({ type: 'figs', tree: tr, n });
    }
  }

  private onHero(e: HeroEvent): void {
    switch (e.type) {
      case 'jump': this.emit({ type: 'jump', held: e.held }); break;
      case 'wallJump': this.wallJumps++; this.emit({ type: 'wallJump' }); break;
      case 'bounce': this.bounces++; this.emit({ type: 'bounce', plat: e.plat }); break;
      case 'vault': this.vaults++; e.vault.at = this.t; this.emit({ type: 'vault', x: e.vault.x, kind: e.kind }); break;
      case 'mantle': this.emit({ type: 'mantle' }); break;
      case 'legUp': this.emit({ type: 'legUp' }); break;
      case 'ladder': this.emit({ type: 'ladder' }); break;
      case 'land': this.emit({ type: 'land', fall: e.fall }); break;
      case 'trunk': this.atTrunk(e.y, e.solid.x0, e.solid.x1); break;
      case 'fall': this.fall(); break;
    }
  }

  // ── the rope ────────────────────────────────────────────────────
  /** Into a ditch or a well: the neighbour's rope brings him back to where he stood ~3 s ago. */
  private fall(): void {
    const h = this.hero, w = this.world;
    if (this.rope) return;
    const pit = w.pitAt(h.x);
    // where he stood about 3 s ago, before the pit (the latest such place if he has not stood that long)
    const ok = (q: { x: number }) => !pit || q.x < pit.x0 - 0.6;
    let to: { x: number; y: number } | null = null;
    for (let i = this.hist.length - 1; i >= 0; i--) {
      const q = this.hist[i];
      if (!ok(q)) continue;
      to = q;
      if (q.t <= this.t - RULES.rewind) break;
    }
    const x = to ? to.x : (pit ? pit.x0 : h.x) - 2;
    // the place must still have ground under it (a rope never sets him over nothing)
    let top = w.topAt(x - 0.2, x + 0.2, (to?.y ?? 0) + 0.01), tx = x;
    for (let k = 1; !Number.isFinite(top) && k <= 12; k++) {
      tx = x + k * 0.5;
      top = w.topAt(tx - 0.2, tx + 0.2, 0.01);
    }
    to = { x: tx, y: Number.isFinite(top) ? top : 0 };
    this.hist.length = 0;
    this.ropes++;
    this.chain = 0;
    if (this.running) this.running.ropes++;
    h.mode = 'rope';
    h.vx = h.vy = 0;
    this.rope = { fromX: h.x, fromY: h.y, toX: to.x, toY: to.y, t: 0 };
    this.emit({ type: 'rope', fromX: h.x, fromY: h.y, toX: to.x, toY: to.y });
    if (pit) {
      pit.falls++;
      if (pit.falls >= RULES.plankAfter && !pit.bridged) {
        w.bridge(pit);
        this.emit({ type: 'plank', pit });
      }
    }
  }

  /** The rope's path: he hangs a moment, is pulled up and back along an arc, and is set down. */
  private ropeTick(dt: number): void {
    const r = this.rope!, h = this.hero;
    r.t += dt;
    const k = clamp((r.t - 0.25) / (RULES.ropeSec - 0.45));
    const s = k * k * (3 - 2 * k);
    h.x = r.fromX + (r.toX - r.fromX) * s;
    h.y = r.t < 0.25 ? r.fromY : r.fromY + (r.toY - r.fromY) * s + Math.sin(s * Math.PI) * 2.2;
    if (r.t >= RULES.ropeSec) {
      this.rope = null;
      h.mode = 'run';
      h.place(r.toX, r.toY, RULES.run * 0.4);
      this.emit({ type: 'ropeEnd' });
    }
  }

  // ── the sycamore ────────────────────────────────────────────────
  /** He touched the trunk: the branch he reaches is the finish (the flagpole), and the course is done. */
  private atTrunk(y: number, x0: number, x1: number): void {
    if (this.tree) return;
    const h = this.hero;
    const z = this.world.zoneAt(x0 - 0.5);
    const branch = branchFor(y);
    const pay = RULES.branchPay[branch - 1];
    this.bestBranch = Math.max(this.bestBranch, branch);
    h.mode = 'tree';
    h.vx = h.vy = 0;
    this.tree = { t: 0, x: x0 - 0.15, y: Math.max(y, RULES.branchAt[branch - 1]) + 0.35, branch };
    this.gain(pay);
    const r = this.running;
    const c = r?.course ?? (z ? (z.course === -1 ? dailyCourse(this.init.daySeed) : course(Math.max(0, z.course))) : course(0));
    let first = false, completed: Tier | null = null;
    const got = r ? r.got.size : 0;
    if (c.index >= 0) {
      ({ first, completed } = finishCourse(this.p, c.index, got, branch));
      this.p.lastCourse = c.index;
      if (completed) this.sets.push(completed);
    } else {
      this.p.dailyDay = this.init.day;
      this.p.dailyCoins = this.dailyCoins;
    }
    if (r && r.ropes === 0) this.cleanCourses++;
    this.finished.push(c);
    this.emit({ type: 'finish', course: c, branch, pay, first, completed, specials: got });
    this.running = null;
    this.treeX1 = x1;
  }

  private treeX1 = 0;

  private treeTick(dt: number): void {
    const tr = this.tree!, h = this.hero;
    tr.t += dt;
    // up into the branches, a moment there, then down on the far side
    const up = clamp(tr.t / 0.45);
    h.x = tr.x;
    h.y = h.y + (tr.y - h.y) * Math.min(1, up);
    if (tr.t >= RULES.treeSec) {
      this.tree = null;
      h.mode = 'run';
      h.place(this.treeX1 + RULES.halfW + 0.15, 0, RULES.run * 0.5);
      this.hist.length = 0;
      this.emit({ type: 'treeEnd' });
    }
  }

  // ── the meta during play ────────────────────────────────────────
  missionValue(kind: MissionKind): number {
    switch (kind) {
      case 'coins': return this.score;
      case 'wall': return this.wallJumps;
      case 'bounce': return this.bounces;
      case 'roofSec': return this.hero.highSec;
      case 'figs': return this.figs;
      case 'branch': return this.bestBranch;
      case 'specialSet': return this.sets.length;
      case 'vault': return this.vaults;
      case 'clean': return this.cleanCourses;
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
        this.give(RULES.missionPay);
        this.emit({ type: 'mission', id });
      }
    }
  }

  // ── the walk home ───────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.settle();
    this.emit({ type: 'finale' });
  }

  /**
   * The session is settled once — at the walk home, or when it ends early: the session and the
   * day's gift count, the day's course is recorded, the missions turn their done pages.
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, day = this.init.day;
    if (p.giftDay !== day) {
      p.giftDay = day;
      this.giftNow = RULES.giftPay;
      this.give(RULES.giftPay);
      this.emit({ type: 'gift', pay: RULES.giftPay });
    }
    if (this.daily && this.dailyRan) {
      p.dailyCoins = Math.max(p.dailyDay === day ? p.dailyCoins : 0, this.dailyCoins);
      p.dailyDay = day;
    }
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.lastLen = this.plannedSec;
    if (this.running && this.running.course.index >= 0) p.lastCourse = this.running.course.index;
    turnPages(p, this.done);
  }

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

  /** The pad follows the level in a sighted push, a mid glow in the warm-up; held still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    const b = this.block;
    if (b.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.L);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
      p.bestBranch = Math.max(p.bestBranch, this.bestBranch);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.courses'), String(this.finished.length)],
      [t('stat.branch'), this.bestBranch ? t('stat.branchOf', { n: this.bestBranch }) : '—'],
      [t('stat.specials'), String(this.specials)],
      [t('stat.roofs'), `${fmtNum(this.hero.highSec, 0)} s`],
      [t('stat.figs'), String(this.figs)],
      [t('stat.views'), String(this.views)],
      [t('stat.ropes'), this.ropes ? t('times', { n: this.ropes }) : '—'],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, in turn from session to session among those the session fits: a
   * high finish is the call by name, a restored household the fourfold, a long view the eyes fixed
   * ahead, a fall rewound the one sought and found, and every run the joyful welcome.  The lobby
   * already opens with Luke 19:3-4.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.bestBranch >= 4) fit.push('luk19.5');
    if (this.homesNew.length > 0) fit.push('luk19.8');
    if (this.views > 0) fit.push('heb12.2', 'psa34.5');
    if (this.ropes > 0) fit.push('luk19.10');
    fit.push('luk19.6');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.homesNew.length === 1) add(0, t('hl.home', { name: this.homesNew[0].name, fix: this.homesNew[0].fix }));
    else if (this.homesNew.length > 1) add(0, t('hl.homes', { n: this.homesNew.length, names: this.homesNew.map(h => h.name).join(', ') }));
    for (const s of this.sets.slice(0, 1)) add(1, t('hl.tier', { tier: t(`tier.${s}`) }));
    if (this.finished.length) add(2, t('hl.courses', { n: this.finished.length, names: this.finished.map(c => c.name).join(', ') }));
    if (this.bestBranch >= 5) add(3, t('hl.top'));
    if (this.done.length) add(4, t('hl.missions', { list: this.done.map(id => missionById(id)!.name).join(', '), n: this.done.length }));
    if (this.daily && this.dailyRan) add(5, t('hl.daily', { n: this.dailyCoins, unit: unit(this.dailyCoins) }));
    if (this.blindSec >= 0) add(6, t('blind.reveal', { n: this.blindSec }));
    if (this.giftNow) add(7, t('hl.gift', { n: this.giftNow }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}

