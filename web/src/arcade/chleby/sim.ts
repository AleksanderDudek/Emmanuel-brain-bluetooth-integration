/**
 * Chleby i ryby's session, without the DOM or the canvas (so every rule is unit-tested): the boy's
 * basket and its stream, the levels one after another on the hillside (hill.ts), the short card of
 * upgrades between them, the blocks, what the band changes, the companion's lines, the meta
 * (meta.ts) and the session's numbers.  All numbers are in rules.ts.
 *
 * The hands aim and pour: a press moves the basket under the finger and throws a short volley, a
 * held press pours a stream, a drag aims it; Space throws a volley, the arrows move the basket.
 * The band only adds:
 *   Rozdawanie (push)   after a lead-in, `level` sets the golden gate's multiplier: ×1 below the
 *                       threshold (never less), ×2 at it, up to ×5 high above it; a held focus
 *                       (6 s Mendi / 3 s HALO) fills the big basket — the next throw is a basket of
 *                       twenty loaves that splits at the first gate it meets.
 *   Na trawie (rest)    the gulls fly back to the lake and doze; after a lead-in, calm gathers the
 *                       crumbs into baskets (up to twelve a level), and a passed rest adds a full one.
 *   Mgła nad jeziorem   every 4th Rozdawanie from the 3rd session: the golden gate shows "?" and
 *   (blind)             counts ×1; at the block's end its judged share pours out at once.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the golden gate stays ×1 and calm gathers nothing; the block clock runs on.
 *
 * The headline is the people fed this session, live: each piece of bread that reaches a group.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { LINES, REPLY, TIPS, WHO, type Moment, type Who } from './content';
import { Hill, type HillEvent, type PieceKind } from './hill';
import { fed as fedText, grain as grainText, t, unit } from './i18n';
import {
  bestFor, bigLoaves, buyUp, fishEvery, lenKey, markCard, offers, seenCard, starsFor, streamRate, upLevel, type ChlebyProgress,
} from './meta';
import { RULES, goldMult, type Upgrade } from './rules';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
/** Feeding a level, its celebration, the short card of upgrades before the next one. */
export type Stage = 'level' | 'won' | 'upgrade';

export interface Offer { u: Upgrade; level: number; price: number; can: boolean }

export type SimEvent =
  | HillEvent
  | { type: 'fire'; kind: PieceKind; x: number }
  | { type: 'levelStart'; level: number; chapter: number; pelikan: boolean; hunger: number; groups: number }
  | { type: 'story'; kind: 'open' | 'chapter'; chapter: number }
  | { type: 'won'; level: number; stars: number; grain: number; byTime: boolean; half: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged window's share on the asked side and the share it needed; the block's span of play time */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number }
  | { type: 'bigReady' }
  | { type: 'basket'; n: number; pass: boolean }
  | { type: 'restPass' }
  | { type: 'blindPay'; loaves: number; share: number }
  | { type: 'buy'; u: Upgrade; level: number }
  | { type: 'say'; who: Who; text: string; dur: number; moment: Moment }
  | { type: 'gift'; grain: number }
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
 * The session's blocks.  A first-ever session opens with the warm-up "Pierwszy kosz" (30 s in 5 and
 * 10 min, 20 s in 3, 6 s in a 40 s test); then Rozdawanie / Na trawie pairs (24 ± 4 s and 23 ± 3 s,
 * scaled to end on time, jittered only when there is room) ending with a rest, leaving the last 6 s
 * to the finale.  No block under 12 s.
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
  /** the band's last 40 s, drawn as the row of baskets along the bottom */
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
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';
  hint = false;

  // the basket
  /** where the basket is and where it heads (lane u) */
  x = RULES.laneW / 2;
  aim = RULES.laneW / 2;
  pressing = false;
  pressT = 0;
  private streamAcc = 0;
  private volleyLeft = 0;
  private volleyT = 0;
  private burstLeft = 0;
  private burstT = 0;
  private pieceN = 0;
  private keyDir = 0;
  private readonly keys = new Set<string>();
  private lastPress = 0;
  /** seconds since the last throw (the view's toss) */
  tossT = 9;

  // the level
  hill: Hill;
  stage: Stage = 'level';
  stageT = 0;
  offers: Offer[] = [];
  basketsLevel = 0;
  /** the last level's stars (for the celebration) */
  lastStars = 0;
  private extended = false;
  private lastCard = -Infinity;

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  /** the golden gate's multiplier now (shown and applied), and the one the level asks for (hidden in a blind block) */
  gold = 1;
  goldWant = 1;
  /** the big basket's fill 0..1, and a full one waiting for the next throw */
  charge = 0;
  bigReady = false;
  /** the basket of crumbs being gathered 0..1; calm working on it now */
  basketFill = 0;
  calmNow = 0;
  private relSec = 0;

  // the session's numbers
  score = 0;
  levelsNow = 0;
  starsNow = 0;
  basketsNow = 0;
  bigsNow = 0;
  pelikansNow = 0;
  knockedNow = 0;
  stolenNow = 0;
  grainNow = 0;
  bestGoldNow = 1;
  passedRests = 0;
  fedAllNow = 0;
  disciplesNow = 0;
  blindShare = -1;
  upsBought = 0;
  private maxBasketsLevel = 0;
  private giftNow = 0;
  private settled = false;
  private readonly callsBase: number;
  private callsBegun = 0;
  private readonly bestBefore: number | null;

  // the companion
  /** the line on screen ends at this time; nothing new before `quietTill` */
  private talkTill = 0;
  private pending: { m: Moment; at: number }[] = [];
  private readonly said: Partial<Record<Moment, number>> = {};
  private readonly lastSaid: Partial<Record<Moment, number>> = {};

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.bigNeed = RULES.bigHold[band];
    this.calmLead = RULES.calmLead[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.callsBase = p.calls;
    this.seedBase = Math.floor(init.rng() * 2 ** 32) >>> 0;
    this.rnd = mulberry32((this.seedBase ^ 0x1f83d9ab) >>> 0);
    this.plan = planBlocks(init.plannedSec, this.session === 1, mulberry32((init.daySeed ^ PLAN_SALT) >>> 0));
    this.hill = this.newHill();
  }

  private newHill(): Hill {
    return new Hill(this.p.level, { start: upLevel(this.p, 'start'), seed: (this.seedBase + this.p.level * 977) >>> 0 });
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  /** a sighted Rozdawanie past its lead-in: the golden gate answers the band */
  get sighted(): boolean { return this.block?.kind === 'push' && !this.block.blind && this.blockT >= this.lead && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get leadIn(): number { return this.lead; }
  get calmLeadIn(): number { return this.calmLead; }
  get bigSec(): number { return this.bigNeed; }
  get rate(): number { return streamRate(this.p); }

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
    // Mirka says hello once the opening card has had its time
    this.queue('open', card ? 11.5 : 1.4);
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A press at lane x: the basket heads there and throws a short volley; held, it pours. */
  press(x: number): void {
    if (!this.started || this.phase === 'done') return;
    this.aim = clamp(x, RULES.edge, RULES.laneW - RULES.edge);
    this.pressing = true;
    this.pressT = 0;
    this.streamAcc = 0;
    this.lastPress = this.t;
    if (this.stage === 'level') this.volleyLeft = Math.max(this.volleyLeft, RULES.volley);
  }

  /** A drag: the basket follows. */
  drag(x: number): void {
    if (this.pressing) this.aim = clamp(x, RULES.edge, RULES.laneW - RULES.edge);
  }

  release(): void { this.pressing = false; }

  /** Space: a volley where the basket is. */
  volley(): void {
    if (!this.started || this.phase === 'done' || this.stage !== 'level') return;
    this.lastPress = this.t;
    this.volleyLeft = Math.max(this.volleyLeft, RULES.volley);
  }

  /** Buy the i-th offer of the card between levels. */
  buy(i: number): boolean {
    if (this.stage !== 'upgrade') return false;
    const o = this.offers[i];
    if (!o || !buyUp(this.p, o.u)) return false;
    this.upsBought++;
    this.emit({ type: 'buy', u: o.u, level: o.level });
    this.offers = offers(this.p).slice(0, 3);
    if (!this.extended) {
      this.extended = true;
      this.stageT = Math.min(this.stageT, RULES.upgradeSec - 2.5);
    }
    return true;
  }

  /** Go on to the next level now. */
  skip(): void {
    if (this.stage === 'upgrade') this.stageT = RULES.upgradeSec;
  }

  /** Keys: ←/→ (A/D) move the basket, Space throws, Enter goes on, 1–3 buy on the card between levels. */
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
        if (this.stage === 'upgrade') this.skip();
        else this.volley();
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
      this.basket(dt);
      this.levelTick(dt);
    }
    if (this.phase === 'finale' && this.phaseT >= RULES.finale) {
      this.phase = 'done';
      this.settle();
    }
    this.talk();
    this.hint = this.phase === 'play' && this.stage === 'level' && this.block.kind === 'warmup' && t - this.lastPress >= RULES.idleHint;
  }

  /**
   * The band's slow quantities: the golden gate in a sighted Rozdawanie past its lead-in, the big
   * basket from the hold, the crumbs gathered by calm in a rest past its lead-in; the trace.
   */
  private brain(dt: number, f: FocusFrame): void {
    const b = this.block, play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? clamp(f.level) : 0;
    this.calm = f.reliable ? clamp(f.calm) : 0;
    if (play && f.reliable) this.relSec += dt;
    const push = play && b.kind === 'push' && this.blockT >= this.lead && f.reliable;
    this.goldWant = push ? goldMult(f.level) : 1;
    this.gold = push && !b.blind ? this.goldWant : 1;
    // the big basket: a held focus fills it; a broken hold lets an unfilled one sink slowly
    if (!this.bigReady) {
      if (this.sighted && f.reliable && f.focused) {
        this.charge = Math.min(1, this.charge + dt / this.bigNeed);
        if (this.charge >= 1) {
          this.bigReady = true;
          this.emit({ type: 'bigReady' });
          this.queue('big', 0);
        }
      } else if (this.sighted && (!f.focused || !f.reliable)) this.charge = Math.max(0, this.charge - (dt / this.bigNeed) * RULES.bigSink);
    }
    // the crumbs: calm gathers them into baskets
    this.calmNow = play && b.kind === 'rest' && this.blockT >= this.calmLead && f.reliable ? clamp(f.calm) : 0;
    if (this.calmNow > 0 && this.basketsLevel < RULES.basketsMax) {
      this.basketFill += (this.calmNow * dt) / RULES.basketSec;
      if (this.basketFill >= 1) {
        this.basketFill -= 1;
        this.addBasket(false);
      }
    }
    const phase: TracePhase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
  }

  private addBasket(pass: boolean): void {
    if (this.basketsLevel >= RULES.basketsMax) return;
    this.basketsLevel++;
    this.maxBasketsLevel = Math.max(this.maxBasketsLevel, this.basketsLevel);
    this.basketsNow++;
    this.p.baskets++;
    this.addGrain(RULES.grainPerBasket);
    this.emit({ type: 'basket', n: this.basketsLevel, pass });
  }

  private addGrain(n: number): void {
    if (!(n > 0)) return;
    this.grainNow += n;
    this.p.grain += n;
    this.p.grainAll += n;
  }

  // ── the basket ──────────────────────────────────────────────────
  private basket(dt: number): void {
    const R = RULES;
    this.tossT += dt;
    if (this.keyDir) this.aim = clamp(this.aim + this.keyDir * R.keySpeed * dt, R.edge, R.laneW - R.edge);
    const d = this.aim - this.x, step = R.aimSpeed * dt;
    this.x = Math.abs(d) <= step ? this.aim : this.x + Math.sign(d) * step;
    if (this.stage !== 'level' || this.hill.done) {
      this.streamAcc = 0;
      return;
    }
    if (this.pressing) {
      this.pressT += dt;
      if (this.pressT > R.holdAfter) {
        this.streamAcc += dt * this.rate;
        while (this.streamAcc >= 1) {
          this.streamAcc -= 1;
          this.throwOne();
        }
      }
    }
    if (this.volleyLeft > 0) {
      this.volleyT -= dt;
      while (this.volleyLeft > 0 && this.volleyT <= 0) {
        this.volleyT += R.volleySec / R.volley;
        this.volleyLeft--;
        this.throwOne();
      }
    } else this.volleyT = 0;
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      while (this.burstLeft > 0 && this.burstT <= 0) {
        this.burstT += 0.04;
        this.burstLeft--;
        this.hill.fire(this.x + (this.rnd() - 0.5) * 1.6, 'loaf');
      }
    }
  }

  /** One piece from the basket: the big basket when it is full, else a loaf (every few a fish). */
  private throwOne(): void {
    if (this.hill.done) return;
    this.tossT = 0;
    if (this.bigReady) {
      this.bigReady = false;
      this.charge = 0;
      this.bigsNow++;
      this.p.bigs++;
      this.hill.fire(this.x, 'big', bigLoaves(this.p));
      this.emit({ type: 'fire', kind: 'big', x: this.x });
      return;
    }
    this.pieceN++;
    const kind: PieceKind = this.pieceN % fishEvery(this.p) === 0 ? 'fish' : 'loaf';
    this.hill.fire(this.x, kind);
    this.emit({ type: 'fire', kind, x: this.x });
  }

  // ── the levels ──────────────────────────────────────────────────
  private levelStart(): void {
    const h = this.hill, pl = h.plan;
    this.basketsLevel = 0;
    this.basketFill = Math.min(this.basketFill, 0.5);
    if (pl.local === 0 && pl.level > 0 && !seenCard(this.p, pl.chapter + 1)) {
      markCard(this.p, pl.chapter + 1);
      this.emit({ type: 'story', kind: 'chapter', chapter: pl.chapter });
    }
    this.emit({ type: 'levelStart', level: pl.level, chapter: pl.chapter, pelikan: pl.pelikan, hunger: pl.hunger, groups: pl.groups.length });
    if (pl.pelikan) this.queue('boss', 2.5);
  }

  private levelTick(dt: number): void {
    this.stageT += dt;
    const ctl = { gold: this.gold, rest: this.restBlock, quiet: this.phase !== 'play' };
    this.hill.step(dt, ctl);
    this.drainHill();
    const R = RULES;
    if (this.stage === 'won' && this.stageT >= R.wonHold) {
      if (this.phase !== 'play') return;
      const list = offers(this.p).slice(0, 3);
      if (list.some(o => o.can) && this.t - this.lastCard >= R.upgradeGap) {
        this.lastCard = this.t;
        this.stage = 'upgrade';
        this.stageT = 0;
        this.extended = false;
        this.offers = list;
      } else this.nextLevel();
    } else if (this.stage === 'upgrade' && this.stageT >= R.upgradeSec) this.nextLevel();
  }

  private nextLevel(): void {
    this.hill = this.newHill();
    this.stage = 'level';
    this.stageT = 0;
    this.offers = [];
    this.levelStart();
  }

  /** The hill's events become the session's: the score, the celebration, the companion's lines. */
  private drainHill(): void {
    for (const e of this.hill.take()) {
      switch (e.type) {
        case 'feed':
          this.score += e.n;
          break;
        case 'gate':
          if (e.kind === 'gold' && e.n > this.bestGoldNow) this.bestGoldNow = e.n;
          if (e.kind === 'gold' && e.n >= 3) this.queue('good', 0, 16);
          break;
        case 'near':
          if (this.block.kind === 'push') this.queue('near', 0, 14);
          break;
        case 'steal':
          this.stolenNow += e.n;
          if (e.laugh) this.queue('laugh', 0);
          else if (e.kind === 'gull') this.queue('steal', 0, 18);
          break;
        case 'knock':
          this.knockedNow++;
          if (e.kind === 'mirka') this.queue('knock', 0);
          break;
        case 'sated':
          this.pelikansNow++;
          this.p.pelikans++;
          this.addGrain(RULES.grainPelikan);
          this.queue('sated', 0.4);
          break;
        case 'done':
          this.won(e.byTime, e.left);
          break;
        default:
          break;
      }
      this.events.push(e);
    }
  }

  /** A level finished: its stars and grain, the next level saved; the disciples' half for what time left. */
  private won(byTime: boolean, left: number): void {
    const h = this.hill, R = RULES;
    const stars = starsFor(byTime, h.timeLeft / Math.max(1, h.limit), this.basketsLevel);
    const half = byTime ? Math.ceil(left / 2) : 0;
    this.score += half;
    if (byTime) this.disciplesNow++;
    else this.fedAllNow++;
    const grain = stars * R.grainPerStar;
    this.addGrain(grain);
    const L = h.level;
    this.p.stars = this.p.stars ?? [];
    while (this.p.stars.length <= L) this.p.stars.push(0);
    this.p.stars[L] = Math.max(this.p.stars[L] || 0, stars);
    this.p.level = Math.max(this.p.level, L + 1);
    this.p.levels++;
    this.levelsNow++;
    this.starsNow += stars;
    this.lastStars = stars;
    this.stage = 'won';
    this.stageT = 0;
    this.burstLeft = 0;
    this.volleyLeft = 0;
    this.emit({ type: 'won', level: L, stars, grain, byTime, half });
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
    // the block's line in character, once the runner's banner has gone
    this.pending = this.pending.filter(q => q.m === 'open');
    if (b.kind === 'push') this.queue(b.blind ? 'blind' : 'push', 0);
    else if (b.kind === 'rest') this.queue('rest', 0);
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup[0];
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
        this.addBasket(true);
        this.emit({ type: 'restPass' });
      }
      if (b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        const loaves = Math.round(s * this.judge.windowSec * R.blindLoaves);
        this.burstLeft += loaves;
        this.emit({ type: 'blindPay', loaves, share: s });
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.t - this.blockT, t1: this.t });
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

  /** a story card is on screen (the view says so each frame): Mirka waits until it is gone */
  cardOn = false;

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
    // every variant once a session; then the moment stays quiet (the HUD keeps the instruction)
    if (k >= list.length) return false;
    const text = list[(this.session * 3 + k) % list.length];
    this.said[m] = k + 1;
    this.lastSaid[m] = this.t;
    const dur = sayDur(text);
    this.talkTill = this.t + dur + 0.5;
    this.emit({ type: 'say', who: WHO[m], text, dur, moment: m });
    return true;
  }

  // ── the finale ──────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.pending = [];
    this.talkTill = 0;
    this.pressing = false;
    this.emit({ type: 'finale' });
    this.queue('end', 0.3);
  }

  /**
   * The session is settled once — at the end of the finale, or when it ends early: a level fed at
   * least halfway is finished by the disciples, the day's gift, the counters into the progress.
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, day = this.init.day;
    if (this.stage === 'level' && !this.hill.done && this.hill.share >= RULES.finishShare) {
      this.hill.take();
      this.hill.endNow();
      for (const e of this.hill.take()) if (e.type === 'done') this.won(true, e.left);
    }
    if (p.giftDay !== day) {
      p.giftDay = day;
      this.giftNow = RULES.giftGrain;
      this.addGrain(RULES.giftGrain);
      this.emit({ type: 'gift', grain: RULES.giftGrain });
    }
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
      [t('stat.baskets'), String(this.basketsNow)],
      [t('stat.gold'), `×${fmtNum(this.bestGoldNow, this.bestGoldNow % 1 ? 1 : 0)}`],
      [t('stat.bigs'), String(this.bigsNow)],
      [t('stat.grain'), `+${fmtNum(this.grainNow)}`],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the first
   * session, everyone fed, a big basket, twelve baskets, the Pelikan sated, a passed rest; else John 6:35.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('jhn6.9');
    if (this.fedAllNow > 0) fit.push('mrk6.42-43');
    if (this.bigsNow > 0) fit.push('jhn6.11');
    if (this.basketsNow >= RULES.basketsMax || this.maxBasketsLevel >= RULES.basketsMax) fit.push('jhn6.12');
    if (this.pelikansNow > 0) fit.push('mat6.26');
    if (this.passedRests > 0) fit.push('mrk6.39-40');
    fit.push('jhn6.35');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.bestBefore !== null && this.score > this.bestBefore) add(0, t('hl.record', { fed: fedText(this.score) }));
    if (this.levelsNow) add(1, t('hl.levels', { n: this.levelsNow, stars: this.starsNow }));
    if (this.pelikansNow) add(2, t('hl.pelikan'));
    if (this.bestGoldNow >= 2) add(3, t('hl.gold', { x: fmtNum(this.bestGoldNow, this.bestGoldNow % 1 ? 1 : 0) }));
    if (this.bigsNow) add(4, t('hl.bigs', { n: this.bigsNow }));
    if (this.basketsNow) add(5, t('hl.baskets', { n: this.basketsNow }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { n: this.blindShare }));
    if (this.giftNow) add(7, t('hl.gift', { grain: grainText(this.giftNow) }));
    if (this.disciplesNow) add(8, t('hl.disciples'));
    const out = notes.sort((a, b) => a.rank - b.rank).slice(0, 4).map(n => n.text);
    // the story's last line: Mirka gets a loaf of her own
    out.push(t(this.knockedNow > 0 ? 'hl.close.knock' : 'hl.close'));
    return out;
  }
}
