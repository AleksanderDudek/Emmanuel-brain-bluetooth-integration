/**
 * Chleby i ryby's session (v2, after Mob Control), without the DOM or the canvas (so every rule is
 * unit-tested): the boy's basket-cannon and its stream of bread-bearers, the levels one after
 * another on the path of hillsides (each one to three terraces, field.ts), the card of upgrades
 * between them, the blocks, what the band changes, the coach marks, the companion's lines, the meta
 * (meta.ts) and the session's numbers.  All numbers are in rules.ts.
 *
 * The hands aim and pour: a press moves the basket under the finger and fires a burst, a held press
 * pours a stream, a drag aims it; Space fires a burst, the arrows move the basket.
 * The band is the core:
 *   Rozdawanie (push)   after a lead-in, `level` sets the golden gate's multiplier: ×1 below the
 *                       threshold (never less), ×2 at it, up to ×5 high above it; a held focus
 *                       (6 s Mendi / 3 s HALO) fills the Big Basket — the champion: the next shot is
 *                       a giant basket on legs worth thirty and more, spilling loaves at every gate.
 *   Na trawie (rest)    the crowd sits down, the gulls doze where they stand (no new waves, a runner
 *                       just shoos one); after a lead-in, calm fills baskets of crumbs — the bank
 *                       the upgrades are bought with; a passed rest adds a full basket.
 *   Mgła nad jeziorem   every 4th Rozdawanie from the 3rd session: the golden gate shows "?" and
 *   (blind)             counts ×1; at the block's end its judged share pours out as a burst.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the golden gate stays ×1 and calm gathers nothing; the block clock runs on.
 *
 * The headline is the people fed this session, live: the worth of every runner that reaches a table.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome, Headline, SignalPhase } from '../kit/types';
import { LINES, REPLY, TIPS, WHO, type Moment, type Who } from './content';
import { Field, isBoss, planTerrace, terracesOf, type FieldEvent, type RunnerKind } from './field';
import { baskets as basketsText, fed as fedText, t, unit } from './i18n';
import {
  addCrumbs, bestFor, bigPerShot, bigWorth, buyUp, fishEvery, isTaught, lenKey, markCard, migrate, offers, parOf, seenCard,
  starsFor, streamRate, taughtBit, upLevel, type ChlebyProgress, type Offer, type Teach,
} from './meta';
import { RULES, goldMult, type Upgrade } from './rules';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
/** Feeding a terrace, climbing to the next one, the celebration of a level, the card of upgrades. */
export type Stage = 'level' | 'climb' | 'won' | 'card';

export type SimEvent =
  | FieldEvent
  | { type: 'fire'; kind: RunnerKind; x: number }
  | { type: 'levelStart'; level: number; chapter: number; boss: boolean; terraces: number }
  | { type: 'terrace'; index: number; of: number }
  | { type: 'story'; kind: 'open' | 'chapter'; chapter: number }
  | { type: 'won'; level: number; stars: number; baskets: number; byHelp: boolean }
  | { type: 'card' }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'bigReady' }
  | { type: 'basket'; n: number; pass: boolean }
  | { type: 'restPass' }
  | { type: 'blindPay'; runners: number; share: number }
  | { type: 'buy'; u: Upgrade; level: number }
  | { type: 'say'; who: Who; text: string; dur: number; moment: Moment }
  | { type: 'teach'; what: Teach }
  | { type: 'jam' }
  | { type: 'gift'; baskets: number }
  | { type: 'finale' };

const NO_EVENTS: readonly SimEvent[] = [];
const PLAN_SALT = 0x6a09e667;

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
 * The session's blocks.  A first-ever session opens with a warm-up (30 s in 5 and 10 min, 20 s in
 * 3, 6 s in a 40 s test); then Rozdawanie / Na trawie pairs (24 ± 4 s and 23 ± 3 s, scaled to end
 * on time, jittered only when there is room) ending with a rest, leaving the last 6 s to the
 * finale.  No block under 12 s.
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

/** How long a companion line stays (s): 2–4 s by its length. */
export const sayDur = (text: string): number => clamp(1.7 + text.length * 0.034, 2, 4);

/** "×3" or "×2,5" in this language's style. */
export const fmtX = (m: number): string => `×${fmtNum(m, m % 1 ? 1 : 0)}`;

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: ChlebyProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export class ChlebySim {
  readonly p: ChlebyProgress;
  readonly plannedSec: number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s (the view draws the bank's rim from it) */
  readonly trace = new SignalTrace(40, 0.1);
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly bigNeed: number;
  private readonly calmLead: number;
  private readonly seedBase: number;
  private readonly rnd: () => number;

  started = false;
  readonly session: number;
  readonly firstEver: boolean;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';

  // the basket-cannon
  /** where the basket is and where it heads (lane u) */
  x = RULES.laneW / 2;
  aim = RULES.laneW / 2;
  pressing = false;
  pressT = 0;
  private streamAcc = 0;
  private burstLeft = 0;
  private burstT = 0;
  private lastBurst = -Infinity;
  private payLeft = 0;
  private payT = 0;
  private shots = 0;
  private keyDir = 0;
  private readonly keys = new Set<string>();
  /** seconds since the last shot (the view's recoil); the stream is jammed this long by a peck */
  shotT = 9;
  jam = 0;
  private held = 0;
  private aimMoved = 0;

  // the level
  field: Field;
  level = 0;
  terrace = 0;
  terraces = 1;
  stage: Stage = 'level';
  stageT = 0;
  levelT = 0;
  private hungers: number[] = [];
  private helped = false;
  offers: Offer[] = [];
  private lastCard = -Infinity;
  lastStars = 0;
  lastBaskets = 0;
  lastByHelp = false;

  // the band
  reliable = false;
  focus = 0;
  calm = 0;
  /** the golden gate's multiplier now (shown and applied), and the one the band asks for (hidden in a blind block) */
  gold = 1;
  goldWant = 1;
  /** the Big Basket's fill 0..1, and a full one waiting for the next shot */
  charge = 0;
  bigReady = false;
  /** calm working on the crumbs now (0..1) */
  calmNow = 0;
  private relSec = 0;

  // the session's numbers
  score = 0;
  levelsNow = 0;
  starsNow = 0;
  basketsNow = 0;
  bigsNow = 0;
  pelikansNow = 0;
  snatchedNow = 0;
  pecksNow = 0;
  bestGoldNow = 1;
  crowdMax = 0;
  passedRests = 0;
  helpedNow = 0;
  blindShare = -1;
  upsBought = 0;
  private giftNow = 0;
  private settled = false;
  private readonly callsBase: number;
  private callsBegun = 0;
  readonly bestBefore: number | null;

  // the coach marks
  private coachQ: Teach[] = [];
  private coachShown = 0;
  private coachLast = -Infinity;
  private readonly coachDone = new Set<Teach>();

  // the companion
  private talkTill = 0;
  private pending: { m: Moment; at: number }[] = [];
  private readonly said: Partial<Record<Moment, number>> = {};
  private readonly lastSaid: Partial<Record<Moment, number>> = {};
  /** a story card is on screen (the view says so each frame): Mirka and the coach marks wait */
  cardOn = false;
  /** the field's time scale: the view's hit-stop slows the world for a few frames on a big moment */
  slow = 1;

  constructor(private readonly init: SimInit) {
    const p = (this.p = migrate(init.progress));
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.bigNeed = RULES.bigHold[band];
    this.calmLead = RULES.calmLead[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.firstEver = this.session === 1;
    this.callsBase = p.calls;
    this.seedBase = Math.floor(init.rng() * 2 ** 32) >>> 0;
    this.rnd = mulberry32((this.seedBase ^ 0x1f83d9ab) >>> 0);
    this.plan = planBlocks(init.plannedSec, this.firstEver, mulberry32((init.daySeed ^ PLAN_SALT) >>> 0));
    this.level = p.level;
    this.terraces = terracesOf(this.level);
    this.field = this.newField();
  }

  private newField(): Field {
    const plan = planTerrace(this.level, this.terrace, upLevel(this.p, 'start'));
    return new Field(plan, { seed: (this.seedBase + this.level * 977 + this.terrace * 131) >>> 0, start: upLevel(this.p, 'start'), firstEver: this.firstEver });
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  /** a sighted Rozdawanie past its lead-in: the golden gate answers the band */
  get sighted(): boolean { return this.block?.kind === 'push' && !this.block.blind && this.blockT >= this.lead && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get leadIn(): number { return this.lead; }
  get bigSec(): number { return this.bigNeed; }
  get rate(): number { return streamRate(this.p); }
  get telegraph(): boolean { return this.phase === 'play' && this.blockT >= this.block.dur - RULES.telegraph; }
  /** the coach mark showing now (the view points it), if any */
  get coach(): Teach | null { return this.coachQ[0] ?? null; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
    const card = !seenCard(this.p, 0);
    if (card) {
      markCard(this.p, 0);
      this.emit({ type: 'story', kind: 'open', chapter: 0 });
    }
    this.levelStart();
    if (!isTaught(this.p, 'tap')) this.teach('tap');
    this.queue('open', card ? 9 : 1.4);
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A press at lane x: the basket heads there and fires a burst; held, it pours. */
  press(x: number): void {
    if (!this.started || this.phase === 'done') return;
    this.aim = clamp(x, RULES.edge, RULES.laneW - RULES.edge);
    this.pressing = true;
    this.pressT = 0;
    this.streamAcc = 0;
    this.queueBurst();
    this.done('tap');
  }

  /** A burst, unless one was just fired (taps faster than the stream never beat holding). */
  private queueBurst(): void {
    if (this.stage !== 'level' || this.t - this.lastBurst < RULES.burstGap) return;
    this.lastBurst = this.t;
    this.burstLeft = Math.max(this.burstLeft, RULES.burst);
  }

  /** A drag: the basket follows. */
  drag(x: number): void {
    if (!this.pressing) return;
    const a = clamp(x, RULES.edge, RULES.laneW - RULES.edge);
    this.aimMoved += Math.abs(a - this.aim);
    this.aim = a;
    if (this.aimMoved > 1.5) this.done('drag');
  }

  release(): void { this.pressing = false; }

  /** Space: a burst where the basket is. */
  burst(): void {
    if (!this.started || this.phase === 'done' || this.stage !== 'level') return;
    this.queueBurst();
    this.done('tap');
  }

  /** Buy the i-th offer of the card between levels. */
  buy(i: number): boolean {
    if (this.stage !== 'card') return false;
    const o = this.offers[i];
    if (!o || !buyUp(this.p, o.u)) return false;
    this.upsBought++;
    this.emit({ type: 'buy', u: o.u, level: o.level });
    this.offers = offers(this.p).slice(0, 3);
    this.stageT = Math.min(this.stageT, RULES.cardSec - 2.5);
    return true;
  }

  /** Go on to the next level now. */
  skip(): void {
    if (this.stage === 'card') this.stageT = RULES.cardSec;
  }

  /** Keys: ←/→ (A/D) move the basket, Space fires, Enter goes on, 1–3 buy on the card between levels. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'ArrowRight' || k === 'd') {
      const left = k === 'ArrowLeft' || k === 'a';
      if (down) this.keys.add(left ? 'l' : 'r');
      else this.keys.delete(left ? 'l' : 'r');
      this.keyDir = (this.keys.has('r') ? 1 : 0) - (this.keys.has('l') ? 1 : 0);
      return true;
    }
    if (k === ' ' || k === 'ArrowUp' || k === 'w') {
      if (down) {
        if (this.stage === 'card') this.skip();
        else this.burst();
      }
      return true;
    }
    if (k === 'Enter') {
      if (down) this.skip();
      return true;
    }
    if (/^[1-3]$/.test(k)) {
      if (down) this.buy(Number(k) - 1);
      return true;
    }
    return false;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.phaseT += dt;
    this.brain(dt, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    if (this.phase !== 'done') {
      this.cannon(dt);
      this.levelTick(dt);
    }
    if (this.phase === 'finale' && this.phaseT >= RULES.finale) {
      this.phase = 'done';
      this.settle();
    }
    this.coachTick();
    this.talk();
  }

  /**
   * The band's slow quantities: the golden gate in a sighted Rozdawanie past its lead-in, the Big
   * Basket from the hold, the crumbs gathered by calm in a rest past its lead-in; the trace.
   */
  private brain(dt: number, f: FocusFrame): void {
    const b = this.block, play = this.phase === 'play';
    this.reliable = f.reliable;
    this.focus = f.reliable ? clamp(f.level) : 0;
    this.calm = f.reliable ? clamp(f.calm) : 0;
    if (play && f.reliable) this.relSec += dt;
    const push = play && b.kind === 'push' && this.blockT >= this.lead && f.reliable;
    this.goldWant = push ? goldMult(f.level) : 1;
    this.gold = push && !b.blind ? this.goldWant : 1;
    if (this.gold > this.bestGoldNow) this.bestGoldNow = this.gold;
    if (this.sighted && this.blockT >= this.lead + 0.5) this.teach('gold');
    // the Big Basket: a held focus fills it (pouring fills it too, slowly — in addShot)
    if (!this.bigReady && this.sighted && f.reliable && f.focused) this.addCharge(dt / this.bigNeed);
    // the crumbs: calm fills baskets
    this.calmNow = play && b.kind === 'rest' && this.blockT >= this.calmLead && f.reliable ? clamp(f.calm) : 0;
    if (this.calmNow > 0) {
      const n = addCrumbs(this.p, (this.calmNow * dt) / RULES.basketSec);
      for (let i = 0; i < n; i++) this.basketDone(false);
    }
    const phase: TracePhase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
  }

  private addCharge(k: number): void {
    if (this.bigReady || !(k > 0)) return;
    this.charge = Math.min(1, this.charge + k);
    if (this.charge >= 1) {
      this.bigReady = true;
      this.emit({ type: 'bigReady' });
      this.queue('big', 0);
      this.teach('big');
    }
  }

  private basketDone(pass: boolean): void {
    this.basketsNow++;
    this.emit({ type: 'basket', n: this.p.bank, pass });
  }

  /** Whole baskets straight into the bank (stars, a passed rest, the Pelikan, the gift). */
  private addBaskets(n: number, pass = false): void {
    for (let i = 0; i < n; i++) {
      this.p.bank++;
      this.p.bankAll++;
      this.basketDone(pass);
    }
  }

  // ── the basket-cannon ───────────────────────────────────────────
  private cannon(dt: number): void {
    const R = RULES;
    this.shotT += dt;
    this.jam = Math.max(0, this.jam - dt);
    if (this.keyDir) {
      const a = clamp(this.aim + this.keyDir * R.keySpeed * dt, R.edge, R.laneW - R.edge);
      this.aimMoved += Math.abs(a - this.aim);
      this.aim = a;
      if (this.aimMoved > 1.5) this.done('drag');
    }
    const d = this.aim - this.x, step = R.aimSpeed * dt;
    this.x = Math.abs(d) <= step ? this.aim : this.x + Math.sign(d) * step;
    if (this.stage !== 'level' || this.field.done) {
      this.streamAcc = 0;
      this.burstLeft = 0;
      return;
    }
    if (this.jam > 0) return;
    if (this.pressing) {
      this.pressT += dt;
      if (this.pressT > R.holdAfter) {
        this.streamAcc += dt * this.rate;
        while (this.streamAcc >= 1) {
          this.streamAcc -= 1;
          this.shoot();
          this.held++;
          if (this.held >= 4) this.done('hold');
        }
      }
    }
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      while (this.burstLeft > 0 && this.burstT <= 0) {
        this.burstT += R.burstSec / R.burst;
        this.burstLeft--;
        this.shoot();
      }
    } else this.burstT = 0;
    if (this.payLeft > 0) {
      this.payT -= dt;
      while (this.payLeft > 0 && this.payT <= 0) {
        this.payT += 0.05;
        this.payLeft--;
        this.field.fire(this.x + (this.rnd() - 0.5) * 2, 'loaf');
      }
    }
  }

  /** One shot: the Big Basket when it is full, else a loaf (every few a fish, with the Ryby upgrade). */
  private shoot(): void {
    if (this.field.done) return;
    this.shotT = 0;
    if (this.bigReady) {
      this.bigReady = false;
      this.charge = 0;
      this.bigsNow++;
      this.p.bigs++;
      this.field.fire(this.x, 'big', bigWorth(this.p));
      this.emit({ type: 'fire', kind: 'big', x: this.x });
      this.done('big');
      this.queue('bigGo', 1.5);
      return;
    }
    this.shots++;
    const every = fishEvery(this.p);
    const kind: RunnerKind = every > 0 && this.shots % every === 0 ? 'fish' : 'loaf';
    this.field.fire(this.x, kind);
    this.addCharge(bigPerShot(this.p));
    this.emit({ type: 'fire', kind, x: this.x });
  }

  // ── the levels ──────────────────────────────────────────────────
  private levelStart(): void {
    const pl = this.field.plan;
    this.levelT = 0;
    this.hungers = [pl.hunger];
    this.helped = false;
    if (pl.local === 0 && pl.level > 0 && !seenCard(this.p, pl.chapter + 1)) {
      markCard(this.p, pl.chapter + 1);
      this.emit({ type: 'story', kind: 'chapter', chapter: pl.chapter });
    }
    this.emit({ type: 'levelStart', level: pl.level, chapter: pl.chapter, boss: pl.boss, terraces: pl.of });
    this.terraceStart();
  }

  private terraceStart(): void {
    const pl = this.field.plan;
    this.emit({ type: 'terrace', index: pl.index, of: pl.of });
    if (pl.gates.some(g => g.kind === 'sub')) this.teach('sub');
    if (pl.gates.some(g => g.kind === 'add') && this.level > 0) this.teach('add');
  }

  private levelTick(dt: number): void {
    const R = RULES;
    this.stageT += dt;
    if (this.stage === 'level') this.levelT += dt;
    if (this.stage === 'level' || this.stage === 'climb' || this.stage === 'won') {
      this.field.step(dt * this.slow, { gold: this.gold, rest: this.restBlock, quiet: this.phase !== 'play' || this.stage !== 'level', basketX: this.x });
      this.drainField();
      this.crowdMax = Math.max(this.crowdMax, this.field.carried);
    }
    if (this.stage === 'climb' && this.stageT >= R.climb) {
      this.terrace++;
      this.field = this.newField();
      this.stage = 'level';
      this.stageT = 0;
      this.hungers.push(this.field.plan.hunger);
      this.terraceStart();
    } else if (this.stage === 'won' && this.stageT >= R.wonHold) {
      if (this.phase !== 'play') return;
      const list = offers(this.p).slice(0, 3);
      if (list.some(o => o.can) && this.t - this.lastCard >= R.cardGap) {
        this.lastCard = this.t;
        this.stage = 'card';
        this.stageT = 0;
        this.offers = list;
        this.emit({ type: 'card' });
      } else this.nextLevel();
    } else if (this.stage === 'card' && this.stageT >= R.cardSec) this.nextLevel();
  }

  private nextLevel(): void {
    this.level = this.p.level;
    this.terrace = 0;
    this.terraces = terracesOf(this.level);
    this.field = this.newField();
    this.stage = 'level';
    this.stageT = 0;
    this.offers = [];
    this.levelStart();
  }

  /** The field's events become the session's: the score, the celebration, the companion's lines. */
  private drainField(): void {
    for (const e of this.field.take()) {
      switch (e.type) {
        case 'feed':
          this.score += e.n;
          break;
        case 'gate':
          if (e.kind === 'gold' && e.n >= 3 && e.made >= 4) this.queue('good', 0, 18);
          break;
        case 'snatch':
          this.snatchedNow += e.n;
          this.crumbs(e.n);
          if (e.kind === 'mirka') this.queue('mirka', 0, 30);
          else if (e.kind === 'gull') this.queue('snatch', 0.3, 20);
          break;
        case 'swallow':
          this.crumbs(e.n);
          break;
        case 'wave':
          this.teach('gull');
          if (e.fat) this.queue('fat', 0.4, 25);
          else this.queue('wave', 0.4, 30);
          break;
        case 'peck':
          this.pecksNow++;
          this.jam = RULES.jamSec;
          this.emit({ type: 'jam' });
          this.queue('peck', 0, 20);
          break;
        case 'pelikan':
          this.queue('boss', 2);
          this.teach('pelikan');
          break;
        case 'sated':
          this.pelikansNow++;
          this.p.pelikans++;
          this.addBaskets(RULES.basketsPelikan);
          this.queue('sated', 0.4);
          break;
        case 'tableFed':
          if (this.field.tables.some(tb => !tb.fed)) this.queue('table', 0.3, 15);
          break;
        case 'help':
          this.helped = true;
          this.queue('help', 0.2, 60);
          break;
        case 'cleared':
          if (e.byHelp) this.helped = true;
          if (this.field.plan.index < this.field.plan.of - 1) {
            this.stage = 'climb';
            this.stageT = 0;
          } else this.won();
          break;
        default:
          break;
      }
      this.events.push(e);
    }
  }

  private crumbs(loaves: number): void {
    const n = addCrumbs(this.p, loaves * RULES.crumbPerLoaf);
    for (let i = 0; i < n; i++) this.basketDone(false);
  }

  /** A level finished: its stars and baskets, the next level saved. */
  private won(): void {
    const L = this.level;
    const stars = starsFor(this.levelT, parOf(this.hungers), this.helped);
    if (this.helped) this.helpedNow++;
    this.p.stars = this.p.stars ?? [];
    while (this.p.stars.length <= L) this.p.stars.push(0);
    this.p.stars[L] = Math.max(this.p.stars[L] || 0, stars);
    this.p.level = Math.max(this.p.level, L + 1);
    this.p.levels++;
    this.levelsNow++;
    this.starsNow += stars;
    const gain = RULES.basketsLevel + (stars >= 3 ? RULES.basketsThree : 0);
    this.addBaskets(gain);
    this.lastStars = stars;
    this.lastBaskets = gain;
    this.lastByHelp = this.helped;
    this.stage = 'won';
    this.stageT = 0;
    this.burstLeft = 0;
    this.emit({ type: 'won', level: L, stars, baskets: gain, byHelp: this.helped });
    this.queue('level', 0.5);
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
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
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
    this.judge.reset();
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.callsBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.callsBase + this.callsBegun) % RULES.blindEvery === 0;
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
    this.pending = this.pending.filter(q => q.m === 'open');
    if (b.kind === 'push') this.queue(b.blind ? 'blind' : 'push', 0);
    else if (b.kind === 'rest') {
      this.queue('rest', 0);
      this.teach('rest');
    }
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup;
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (first && this.callsBase === 0) return TIPS.firstPush;
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
      if (b.kind === 'rest' && verdict) {
        this.passedRests++;
        this.addBaskets(1, true);
        this.emit({ type: 'restPass' });
      }
      if (b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        const runners = Math.round(s * this.judge.windowSec * R.blindRunners);
        this.payLeft += runners;
        this.emit({ type: 'blindPay', runners, share: s });
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  // ── the coach marks ─────────────────────────────────────────────
  /** Ask for a coach mark (once per player: the progress remembers what was taught). */
  private teach(w: Teach): void {
    if (isTaught(this.p, w) || this.coachDone.has(w) || this.coachQ.includes(w)) return;
    this.coachQ.push(w);
  }

  /** A control was done: its coach mark is no longer needed (and the next lesson follows). */
  private done(w: Teach): void {
    if (this.coachDone.has(w)) return;
    this.coachDone.add(w);
    this.p.taught = (this.p.taught ?? 0) | taughtBit(w);
    if (this.coachQ[0] === w) {
      this.coachQ.shift();
      this.coachShown = 0;
      this.coachLast = this.t - RULES.hintEvery + 0.8;
    } else this.coachQ = this.coachQ.filter(q => q !== w);
    // the hands are taught in order: tap, then hold, then drag
    if (w === 'tap') this.teach('hold');
    if (w === 'hold') this.teach('drag');
  }

  private coachTick(): void {
    const w = this.coachQ[0];
    if (!w || this.cardOn || this.phase === 'done') return;
    if (this.stage !== 'level' || this.telegraph) return;
    if (this.phase === 'play' && this.block.kind !== 'warmup' && this.blockT < 4.5 && w !== 'rest' && w !== 'gold') return;
    const R = RULES;
    // what is only shown (not done by a control) is done once it has been seen
    const info = w === 'gull' || w === 'gold' || w === 'rest' || w === 'pelikan' || w === 'sub' || w === 'add';
    if (this.t - this.coachLast < (info && this.coachShown > 0 ? 4 : R.hintEvery)) return;
    if (info && this.coachShown > 0) { this.done(w); return; }
    if (this.coachShown >= R.hintTimes) {
      this.coachQ.shift();
      this.coachShown = 0;
      if (w === 'tap') this.teach('hold');
      else if (w === 'hold') this.teach('drag');
      return;
    }
    this.coachShown++;
    this.coachLast = this.t;
    this.emit({ type: 'teach', what: w });
  }

  // ── the companion ───────────────────────────────────────────────
  /** Ask for a line at a moment (after `delay` s, at most once per `every` s of that moment). */
  private queue(m: Moment, delay: number, every = 0): void {
    const last = this.lastSaid[m];
    if (every > 0 && last !== undefined && this.t - last < every) return;
    if (this.pending.some(q => q.m === m)) return;
    if (this.pending.length >= 3) this.pending.shift();
    this.pending.push({ m, at: this.t + delay });
  }

  /** May a line show now: never over a story card, the runner's block banner (its first 5.3 s) or the telegraph. */
  private quiet(): boolean {
    if (this.cardOn) return true;
    if (this.phase !== 'play') return false;
    const b = this.block;
    if (b.kind !== 'warmup' && this.blockT < 5.3) return true;
    return this.blockT >= b.dur - RULES.telegraph - 0.3;
  }

  private talk(): void {
    if (!this.pending.length || this.t < this.talkTill || this.quiet()) return;
    // drop stale chatter (a reaction more than 6 s late is no reaction)
    this.pending = this.pending.filter(q => q.m === 'open' || q.m === 'push' || q.m === 'rest' || q.m === 'blind' || q.m === 'end' || this.t - q.at < 6);
    const i = this.pending.findIndex(q => q.at <= this.t);
    if (i < 0) return;
    const { m } = this.pending.splice(i, 1)[0];
    if (!this.say(m)) return;
    const reply = REPLY[m];
    if (reply) this.pending.unshift({ m: reply, at: this.talkTill - 0.4 });
  }

  private say(m: Moment): boolean {
    const list = LINES[m];
    const k = this.said[m] ?? 0;
    if (k >= list.length) return false;
    const text = list[(this.session * 3 + k) % list.length];
    this.said[m] = k + 1;
    this.lastSaid[m] = this.t;
    const dur = sayDur(text);
    this.talkTill = this.t + dur + 0.5;
    this.emit({ type: 'say', who: WHO(m), text, dur, moment: m });
    return true;
  }

  // ── the finale ──────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.pending = [];
    this.talkTill = 0;
    this.emit({ type: 'finale' });
    this.queue('end', 0.3);
  }

  /**
   * The session is settled once — at the end of the finale, or when it ends early: a last terrace
   * fed at least halfway is finished by the disciples, the day's gift, the counters into the progress.
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, day = this.init.day;
    const pl = this.field.plan;
    if (this.stage === 'level' && !this.field.done && pl.index === pl.of - 1 && this.field.share >= RULES.finishShare) {
      this.field.endNow();
      this.helped = true;
      this.field.take();
      this.won();
    }
    if (p.giftDay !== day) {
      p.giftDay = day;
      this.giftNow = RULES.giftBaskets;
      this.addBaskets(RULES.giftBaskets);
      this.emit({ type: 'gift', baskets: RULES.giftBaskets });
    }
    // the hands were shown in the first session: later sessions only teach what is new
    for (const w of ['tap', 'hold', 'drag'] as const) p.taught = (p.taught ?? 0) | taughtBit(w);
    p.sessions = Math.max(p.sessions, this.session);
    p.calls = Math.max(p.calls, this.callsBase + this.callsBegun);
    p.total += this.score;
    p.bestGold = Math.max(p.bestGold || 1, this.bestGoldNow);
    p.lastLen = this.plannedSec;
  }

  /** The session ends before its own finale: settle as the finale would. */
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

  /** The pad follows the golden gate in a sighted Rozdawanie, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    const b = this.block;
    if (b.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(f.level);
    return null;
  }

  /** What the block asks of the brain, for the runner's Mendi panel and dock. */
  signal(): SignalPhase {
    if (!this.started || this.phase !== 'play') return { want: 'free', blind: false };
    const b = this.block;
    const left = Math.max(0, b.dur - this.blockT);
    const nb = this.next;
    const next = this.telegraph ? (nb ? (nb.kind === 'push' ? 'focus' : nb.kind === 'rest' ? 'rest' : 'free') : null) : undefined;
    if (b.kind === 'warmup') return { want: 'free', blind: false, task: this.tip, left, next };
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: this.blind, task: this.tip, left, next };
  }

  /**
   * The panel's gauge: the golden gate's dial in a Rozdawanie (the focus level: 0.5 = ×2 at the
   * threshold), calm in a rest (the crumbs' rate); null while blind or without a reliable signal.
   */
  meter(): number | null {
    if (!this.started || !this.reliable || this.blind) return null;
    if (this.restBlock) return this.calm;
    return this.focus;
  }

  /** The score corner: people fed, and the level (or the record within reach). */
  headline(): Headline {
    const best = this.bestBefore;
    if (best !== null && this.score < best && (this.phase !== 'play' || this.score >= best * 0.7)) {
      return { value: this.score, sub: t('head.record', { n: fmtNum(best - this.score) }) };
    }
    const pl = this.field.plan;
    const sub = pl.of > 1 ? t('head.level', { n: pl.level + 1, i: pl.index + 1, of: pl.of }) : t('head.levelOne', { n: pl.level + 1 });
    return { value: this.score, sub };
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: the record with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.levels'), String(this.levelsNow)],
      [t('stat.next'), t('stat.levelOf', { n: p.level + 1 })],
      [t('stat.stars'), `+${this.starsNow}`],
      [t('stat.baskets'), `+${this.basketsNow}`],
      [t('stat.gold'), fmtX(this.bestGoldNow)],
      [t('stat.crowd'), fmtNum(this.crowdMax)],
      [t('stat.bigs'), String(this.bigsNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the first
   * session, a whole level fed, a Big Basket, twelve baskets, the Pelikan sated, a passed rest; else John 6:35.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('jhn6.9');
    if (this.levelsNow > 0) fit.push('mrk6.42-43');
    if (this.bigsNow > 0) fit.push('jhn6.11');
    if (this.basketsNow >= 12) fit.push('jhn6.12');
    if (this.pelikansNow > 0) fit.push('mat6.26');
    if (this.passedRests > 0) fit.push('mrk6.39-40');
    fit.push('jhn6.35');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    const best = this.bestBefore;
    if (best !== null && this.score > best) add(0, t('hl.record', { fed: fedText(this.score) }));
    else if (best !== null && this.score < best && this.score >= best * 0.6) add(0, t('hl.near', { fed: fedText(best - this.score) }));
    if (this.levelsNow) add(1, t('hl.levels', { n: this.levelsNow, stars: this.starsNow }));
    if (this.pelikansNow) add(2, t('hl.pelikan'));
    if (this.bestGoldNow >= 2) add(3, t('hl.gold', { x: fmtNum(this.bestGoldNow, this.bestGoldNow % 1 ? 1 : 0) }));
    if (this.bigsNow) add(4, t('hl.bigs', { n: this.bigsNow }));
    if (this.basketsNow) add(5, t('hl.baskets', { n: this.basketsNow }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { n: this.blindShare }));
    if (this.giftNow) add(7, t('hl.gift', { baskets: basketsText(this.giftNow) }));
    if (this.helpedNow) add(8, t('hl.disciples'));
    const out = notes.sort((a, b) => a.rank - b.rank).slice(0, 4).map(n => n.text);
    // the story's last line: Mirka gets a loaf of her own
    out.push(t(this.pecksNow > 0 ? 'hl.close.peck' : 'hl.close'));
    return out;
  }

  /** Is this level a Pelikan's (the view's banner)? */
  get boss(): boolean { return isBoss(this.level); }
}
