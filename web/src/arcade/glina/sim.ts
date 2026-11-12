/**
 * Glina's session, without the DOM (DESIGN.md §6, Glina v2): the potter's workshop after Let's
 * Create! Pottery.  Customers come to the counter with an order (a silhouette, a glaze, sometimes a
 * painted band); the player shapes the lump on the wheel (a finger on the wall pulls it in or out at
 * that height, a finger at the rim pulls it up or presses it down), says "Gotowe" (the master's hand
 * finishes a poor shape toward the order), and the piece dries on the kiln shelf.  Then the batch is
 * glazed (a tap on a colour dips it, a drag on the turning pot paints a band), fired (stop the heat
 * needle in the green, gold at its heart) and sold: each customer reacts, pays and tips by the stars.
 *
 * The blocks: a Toczenie (push) is the wheel's time — the band's steadiness stills the wheel (the
 * spirit level on its frame), draws the master's guide line, makes the clay obey, and a held focus
 * fills the master's hand, whose golden spin trues a piece to the order.  A Wypał (rest) is the
 * kiln's — calm keeps the heat even (the needle slows, the green widens).  A free stretch (the first
 * session's warm-up) runs a whole order at a time.  Nothing is ever lost: a piece unfinished at a
 * block's end is finished by the master, a batch unsold at the end is sold, a poor firing still sells.
 */
import type { FocusFrame, FocusTuning } from '../kit/focus';
import { BlockContrast, RoundJudge } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace } from '../kit/trace';
import {
  CLOSING, FORM, HOUSES, KILN_GIFT_NAME, LINES, REACT, STORY, TIPS, WALKINS, formTarget, storyAsk, storyThanks,
  type CustomerId, type FormId, type GlazeId, type HouseId, type KilnGift, type PatternId, type Reaction,
} from './content';
import { fmtInt, t } from './i18n';
import {
  capacity, migrate, nextStory, openCount, openForms, shelfCount, shelve, type BandRec, type GlinaProgress, type PieceRec,
} from './meta';
import { RULES, gradeAt, needleSpeed, shapeStars, starsOf, type FireGrade } from './rules';
import { Pot, RINGS, type Target } from './shape';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

/** No block under `min` s: the short ones take their missing time from the long ones. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks, filling `plannedSec`: a first-ever session opens with a warm-up (one whole
 * order, taught), then Toczenie / Wypał pairs (25 ± 4 s, 25 ± 3 s, scaled to end on time, jittered
 * when there is room) ending with a Wypał, so every batch is fired and sold.  A test session under a
 * minute: whatever fits.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  const total = Math.max(10, plannedSec);
  if (total <= 60) {
    const warm = firstEver ? Math.min(R.warm.test, total * 0.3) : 0;
    const left = total - warm;
    const rest = Math.min(16, left / 2);
    const plan = [b('push', left - rest), b('rest', rest)];
    return warm > 0 ? [b('warmup', warm), ...plan] : plan;
  }
  const plan: Block[] = [];
  let left = total;
  if (firstEver) {
    const warm = total >= 300 ? R.warm.long : R.warm.short;
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

// ── the work ─────────────────────────────────────────────────────
export interface Order {
  id: number;
  customer: CustomerId;
  form: FormId;
  target: Target;
  glaze: GlazeId;
  band: { glaze: GlazeId; pattern: PatternId } | null;
  /** a household's story step (1..4) */
  story: { house: HouseId; step: number } | null;
  market: boolean;
  /** what the customer says at the counter */
  line: string;
}

export interface Band { u: number; glaze: GlazeId; pattern: PatternId; t: number }

export interface Piece {
  order: Order;
  H: number;
  r: Float64Array;
  match: number;
  assisted: boolean;
  spun: boolean;
  /** made in a push block that passed */
  steady: boolean;
  glaze: GlazeId | null;
  bands: Band[];
  /** glazed by the apprentice (time ran out, or Space) */
  auto: boolean;
  fire: FireGrade | null;
  sold: boolean;
  /** the sale */
  stars: 1 | 2 | 3;
  price: number;
  tip: number;
  reaction: Reaction;
  gift: KilnGift | null;
}

export type WheelStage = 'idle' | 'walk' | 'shape' | 'assist' | 'spin' | 'cut';
export type KilnStage = 'cold' | 'glaze' | 'heat' | 'fire' | 'open' | 'sell' | 'cool';
export type Finger = { mode: 'wall'; u: number; d: number; held: number } | { mode: 'rim'; H: number; held: number };

export type Card =
  | { kind: 'open'; t: number; dur: number }
  | { kind: 'tally'; t: number; dur: number; n: number; coins: number; three: number }
  | { kind: 'story'; t: number; dur: number; house: HouseId; step: number; text: string };

export type GlinaEvent =
  | { type: 'walk'; order: Order }
  | { type: 'order'; order: Order }
  | { type: 'stroke'; mode: 'wall' | 'rim' }
  | { type: 'assist' }
  | { type: 'spin' }
  | { type: 'charged' }
  | { type: 'cut'; piece: Piece; market: boolean }
  | { type: 'glazeStart'; piece: Piece; index: number }
  | { type: 'dip'; glaze: GlazeId }
  | { type: 'band'; u: number; glaze: GlazeId; pattern: PatternId }
  | { type: 'brush'; pattern: PatternId }
  | { type: 'glazeDone'; piece: Piece; auto: boolean }
  | { type: 'heat' }
  | { type: 'fire'; grade: FireGrade; x: number; auto: boolean }
  | { type: 'open' }
  | { type: 'sale'; piece: Piece; streak: number }
  | { type: 'market'; n: number; coins: number }
  | { type: 'newForm'; form: FormId; outcome: 'new' | 'up' }
  | { type: 'unlock'; form: FormId }
  | { type: 'story'; house: HouseId; step: number }
  | { type: 'gift'; gift: KilnGift; coins: number }
  | { type: 'reveal'; share: number; coins: number }
  | { type: 'telegraph'; next: Block }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null }
  | { type: 'card'; card: Card }
  | { type: 'done' };

export interface SimInit {
  progress: GlinaProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  day?: string;
}

export class GlinaSim {
  readonly p: GlinaProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s: the throwing rings on the wheel head */
  readonly trace = new SignalTrace(40, 0.5);
  readonly talk: Talk;
  private readonly events: GlinaEvent[] = [];
  readonly eeg: boolean;
  readonly lead: number;
  readonly restLead: number;
  readonly firstEver: boolean;
  readonly session: number;
  readonly plan: Block[];

  started = false;
  ended = false;
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  t = 0;
  tip = '';
  card: Card | null = null;
  /** Szamot keeps quiet while a finger works the clay and while a piece is glazed (a phone: his bubble would cover them) */
  quietWhileShaping = false;
  lastInput = 0;

  // the wheel
  wheel: WheelStage = 'idle';
  wheelT = 0;
  order: Order | null = null;
  pot: Pot | null = null;
  finger: Finger | null = null;
  private from: { H: number; r: Float64Array } | null = null;
  private to: { H: number; r: Float64Array } | null = null;
  /** the wheel's turn (rad) and its speed */
  rot = 0;
  private orderSeq = 0;
  private storyDone = false;
  readonly queue: Order[] = [];

  // the kiln
  kiln: KilnStage = 'cold';
  kilnT = 0;
  /** the batch on the kiln shelf, and the market basket */
  batch: Piece[] = [];
  market: Piece[] = [];
  glazeIdx = 0;
  brush: { glaze: GlazeId; pattern: PatternId };
  needle = 0;
  private needleDir = 1;
  fired: { grade: FireGrade; x: number } | null = null;
  saleIdx = 0;
  /** the kiln comes to heat at this block time (a rest), or after `freeHeat` in a free stretch */
  private heatAt = 0;

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  /** steadiness 0..1 (0.5 at the threshold), the even heat 0..1, the master's hand 0..1 */
  steady: number;
  heat = 0.5;
  charge = 0;
  private goodT = 0;
  private goodSaid = false;
  private heatSaid = false;
  private relSec = 0;
  guideSeen = false;
  blindShare = -1;
  private pushesBegun = 0;
  private readonly pushesBase: number;
  private lastPushPassed = false;

  // the score
  score = 0;
  sold = 0;
  three = 0;
  streak = 0;
  bestStreak = 0;
  bestMatch = 0;
  perfects = 0;
  spins = 0;
  gifts: KilnGift[] = [];
  readonly newForms: FormId[] = [];
  readonly stories: { house: HouseId; step: number }[] = [];
  readonly unlocked: FormId[] = [];
  readonly bestBefore: number;
  private readonly openBefore: number;

  constructor(init: SimInit) {
    const p = (this.p = migrate(init.progress));
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    this.lead = RULES.leadIn[init.eeg ? 'eeg' : 'fnirs'];
    this.restLead = RULES.restLead[init.eeg ? 'eeg' : 'fnirs'];
    this.firstEver = p.sessions === 0;
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.bestBefore = p.best;
    this.openBefore = openCount(p);
    this.plan = planBlocks(init.plannedSec, this.firstEver, init.rng);
    this.talk = new Talk(LINES, init.rng);
    this.steady = this.base;
    this.brush = { glaze: p.glazes[0] ?? 'biel', pattern: p.patterns[0] ?? 'pas' };
    if (init.day) p.lastDay = init.day;
  }

  /** steadiness without the band's say: the threshold, plus the wheel's upgrades */
  get base(): number { return RULES.neutral + RULES.wheelStep * this.p.wheel; }

  // ── the blocks ──────────────────────────────────────────────────
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get pushBlock(): boolean { return !this.ended && this.block.kind === 'push'; }
  get restBlock(): boolean { return !this.ended && this.block.kind === 'rest'; }
  get freeBlock(): boolean { return !this.ended && this.block.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a push past the band's delay: steadiness answers the band */
  get live(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  get sighted(): boolean { return this.live && !this.block.blind; }
  get warming(): boolean { return this.restBlock && this.blockT >= this.restLead; }
  get telegraphing(): boolean { return !this.ended && this.blockT >= this.block.dur - RULES.telegraph && this.blockIndex < this.plan.length - 1; }
  get left(): number { return Math.max(0, this.block.dur - this.blockT); }
  /** the station in front of the player */
  get station(): 'wheel' | 'kiln' {
    if (this.restBlock) return 'kiln';
    if (this.pushBlock) return 'wheel';
    return this.kiln !== 'cold' && this.kiln !== 'cool' ? 'kiln' : 'wheel';
  }
  /** the guide line shows: a sighted push, steady enough */
  get guide(): boolean { return this.sighted && this.reliable && this.steady >= RULES.guideAt && this.wheel === 'shape'; }
  get talkBlocked(): boolean {
    if (this.card) return true;
    // on a phone his bubble would hang over the clay a finger is working: he waits for the lift
    if (this.quietWhileShaping && (this.finger || this.kiln === 'glaze')) return true;
    if (this.ended) return false;
    if (this.block.kind !== 'warmup' && this.blockT < RULES.bannerSec) return true;
    return this.telegraphing;
  }
  /** the piece on the glazing wheel */
  get glazing(): Piece | null { return this.kiln === 'glaze' ? this.batch[this.glazeIdx] ?? null : null; }
  get cap(): number { return capacity(this.p); }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.sessions++;
    if (this.firstEver) this.setCard({ kind: 'open', t: 0, dur: RULES.openCard });
    else this.talk.ask('open', 2, 8);
    this.startBlock(0);
    if (this.wheel === 'idle') this.nextOrder();
  }

  // ── orders ──────────────────────────────────────────────────────
  private pick<T>(xs: readonly T[]): T { return xs[Math.min(xs.length - 1, Math.floor(this.rng() * xs.length))]; }

  /** The next order: a household's story step first in a session, then regulars and walk-ins; the market when the shelf is full. */
  makeOrder(): Order {
    const p = this.p, id = ++this.orderSeq;
    const market = this.batch.length >= this.cap && !this.freeBlock;
    const owned = p.glazes;
    let customer: CustomerId, form: FormId, story: Order['story'] = null;
    const nextHouse = nextStory(p);
    if (!market && !this.storyDone && nextHouse) {
      this.storyDone = true;
      const step = p.steps[nextHouse] + 1;
      customer = nextHouse;
      form = STORY[nextHouse][step - 1];
      story = { house: nextHouse, step };
    } else {
      customer = market ? 'targ' : this.pick([...WALKINS, ...HOUSES] as CustomerId[]);
      const open = openForms(p);
      form = this.pick(open.length ? open : (['kubek'] as FormId[]));
    }
    const glaze = this.pick(owned);
    let band: Order['band'] = null;
    if (!market && p.sold + this.sold >= 2 && this.rng() < 0.55) {
      const others = owned.filter(g => g !== glaze);
      band = { glaze: this.pick(others.length ? others : owned), pattern: this.pick(p.patterns) };
    }
    const line = story ? storyAsk(story.house, story.step) : market ? t('ask.market') : t(`ask.${1 + Math.floor(this.rng() * 6)}` as 'ask.1');
    return { id, customer, form, target: formTarget(form), glaze, band, story, market, line };
  }

  private nextOrder(): void {
    if (this.ended) return;
    if (this.restBlock) {
      this.wheel = 'idle';
      return;
    }
    const o = this.makeOrder();
    this.order = o;
    this.pot = null;
    this.wheel = 'walk';
    this.wheelT = 0;
    this.emit({ type: 'walk', order: o });
  }

  // ── the hands: the wheel ───────────────────────────────────────
  /** A finger on the wall (u: 0..1 of the pot's height, d: cm from the axis). */
  touchWall(u: number, d: number): void {
    if (this.wheel !== 'shape' || this.card) return;
    this.lastInput = this.t;
    const held = this.finger?.held ?? 0;
    this.finger = { mode: 'wall', u: clamp(u), d: Math.max(0, d), held };
  }

  /** A finger at the rim: the height it wants (cm). */
  touchRim(H: number): void {
    if (this.wheel !== 'shape' || this.card) return;
    this.lastInput = this.t;
    const held = this.finger?.held ?? 0;
    this.finger = { mode: 'rim', H, held };
  }

  /** The finger lifts: a short touch (a tap) still nudges the clay a little. */
  release(): void {
    const f = this.finger;
    this.finger = null;
    if (!f || !this.pot || this.wheel !== 'shape') return;
    const nudge = 0.14 - f.held;
    if (nudge > 0) this.applyFinger(f, nudge);
  }

  private applyFinger(f: Finger, dt: number): void {
    const pot = this.pot;
    if (!pot) return;
    if (f.mode === 'wall') pot.wall(f.u, f.d, dt, this.steady, () => this.rng() * 2 - 1);
    else pot.height(f.H, dt);
  }

  /** "Gotowe": the piece is done; a poor shape gets the master's hand first. */
  done(): boolean {
    if (this.card) return false;
    if (this.wheel !== 'shape' || !this.pot) return false;
    this.lastInput = this.t;
    this.finger = null;
    const goal = RULES.assist + RULES.assistSteady * clamp((this.steady - 0.5) / 0.5);
    const k = this.pot.shareFor(goal);
    if (k > 0.001) {
      this.from = this.pot.snap();
      const tmp = new Pot(this.pot.target);
      tmp.blend(this.from, this.from, 0);
      tmp.toward(k);
      this.to = tmp.snap();
      this.wheel = 'assist';
      this.wheelT = 0;
      this.emit({ type: 'assist' });
    } else this.cut(false);
    return true;
  }

  /** The master's spin: the piece trues to the order in a golden turn. */
  private spin(): void {
    if (!this.pot) return;
    this.charge = 0;
    this.spins++;
    this.p.spins++;
    this.from = this.pot.snap();
    const tmp = new Pot(this.pot.target);
    tmp.blend(this.from, this.from, 0);
    tmp.toward(tmp.shareFor(0.97));
    this.to = tmp.snap();
    this.wheel = 'spin';
    this.wheelT = 0;
    this.finger = null;
    this.emit({ type: 'spin' });
    this.talk.ask('master', 4, 5);
  }

  private cut(assisted: boolean, spun = false): void {
    const pot = this.pot, o = this.order;
    if (!pot || !o) return;
    const piece: Piece = {
      order: o, H: pot.H, r: Float64Array.from(pot.r), match: pot.match, assisted, spun, steady: false,
      glaze: null, bands: [], auto: false, fire: null, sold: false, stars: 1, price: 0, tip: 0, reaction: 'r1', gift: null,
    };
    this.bestMatch = Math.max(this.bestMatch, piece.match);
    const market = o.market || (this.batch.length >= this.cap && !this.freeBlock);
    if (market) this.market.push(piece);
    else this.batch.push(piece);
    this.wheel = 'cut';
    this.wheelT = 0;
    this.emit({ type: 'cut', piece, market });
    if (market && this.market.length === 1) this.talk.ask('market', 2, 5);
    if (!spun && piece.match < 0.5) this.talk.ask('sloppy', 1, 4);
  }

  // ── the hands: the kiln ────────────────────────────────────────
  /** A colour: the brush takes it; the first, or the brush's own colour again, dips the piece. */
  pickGlaze(g: GlazeId): boolean {
    const pc = this.glazing;
    if (!pc || this.card || !this.p.glazes.includes(g)) return false;
    this.lastInput = this.t;
    const dip = pc.glaze === null || this.brush.glaze === g;
    this.brush.glaze = g;
    if (dip) {
      pc.glaze = g;
      this.emit({ type: 'dip', glaze: g });
    }
    return true;
  }

  pickPattern(pt: PatternId): boolean {
    if (!this.glazing || this.card || !this.p.patterns.includes(pt)) return false;
    this.lastInput = this.t;
    this.brush.pattern = pt;
    this.emit({ type: 'brush', pattern: pt });
    return true;
  }

  /** A band painted at height u (0..1) in the brush's colour and pattern (a band near it is painted over). */
  paint(u: number): boolean {
    const pc = this.glazing;
    if (!pc || this.card) return false;
    this.lastInput = this.t;
    if (pc.glaze === null) return this.pickGlaze(this.brush.glaze);
    const uu = clamp(u, 0.08, 0.94);
    const near = pc.bands.findIndex(b => Math.abs(b.u - uu) < RULES.bandGap);
    if (near >= 0) {
      const b = pc.bands[near];
      if (b.glaze === this.brush.glaze && b.pattern === this.brush.pattern) return false;
      pc.bands.splice(near, 1);
    }
    if (pc.bands.length >= RULES.bandsMax) pc.bands.shift();
    pc.bands.push({ u: uu, glaze: this.brush.glaze, pattern: this.brush.pattern, t: 0 });
    this.emit({ type: 'band', u: uu, glaze: this.brush.glaze, pattern: this.brush.pattern });
    return true;
  }

  /** "Gotowe" at the glazing wheel: an undipped piece takes the order's colour; the next piece comes. */
  glazeDone(auto = false): boolean {
    const pc = this.glazing;
    if (!pc || (this.card && !auto)) return false;
    if (!auto) this.lastInput = this.t;
    if (pc.glaze === null) pc.glaze = this.p.glazes.includes(pc.order.glaze) ? pc.order.glaze : this.brush.glaze;
    if (auto) pc.auto = true;
    this.emit({ type: 'glazeDone', piece: pc, auto });
    this.glazeIdx++;
    this.nextGlaze();
    return true;
  }

  /** Space at the glazing wheel: the order's glaze and band, as asked, then the next piece. */
  glazeAsAsked(): boolean {
    const pc = this.glazing;
    if (!pc || this.card) return false;
    const o = pc.order;
    if (pc.glaze === null && this.p.glazes.includes(o.glaze)) {
      pc.glaze = o.glaze;
      this.emit({ type: 'dip', glaze: o.glaze });
    }
    if (o.band && !pc.bands.some(b => b.glaze === o.band!.glaze && b.pattern === o.band!.pattern)) {
      pc.bands.push({ u: 0.62, glaze: o.band.glaze, pattern: o.band.pattern, t: 0 });
      this.emit({ type: 'band', u: 0.62, glaze: o.band.glaze, pattern: o.band.pattern });
    }
    return this.glazeDone(false);
  }

  /** A tap at the kiln while the needle runs: it stops there. */
  stopNeedle(auto = false): boolean {
    if (this.kiln !== 'fire' || (this.card && !auto)) return false;
    if (!auto) this.lastInput = this.t;
    const grade = auto ? (gradeAt(this.needle, this.heat, this.p.kiln) === 'perfect' ? 'perfect' : 'good') : gradeAt(this.needle, this.heat, this.p.kiln);
    this.fired = { grade, x: this.needle };
    this.lastFired = this.batch.filter(pc => !pc.sold);
    for (const pc of this.lastFired) pc.fire = grade;
    if (grade === 'perfect') this.perfects++;
    this.kiln = 'open';
    this.kilnT = 0;
    this.emit({ type: 'fire', grade, x: this.needle, auto });
    if (grade === 'perfect') this.talk.ask('perfect', 3, 5);
    else if (grade !== 'good') this.talk.ask('miss', 2, 5);
    return true;
  }

  /** Space: finish what is in front of the player. */
  space(): boolean {
    if (this.card) return this.dismiss();
    if (this.station === 'wheel' && this.wheel === 'shape') return this.done();
    if (this.kiln === 'glaze') return this.glazeAsAsked();
    if (this.kiln === 'fire') return this.stopNeedle();
    if (this.kiln === 'sell' || this.kiln === 'open') return this.hurry();
    return false;
  }

  /** A tap while the kiln opens or sells: the next customer steps up at once. */
  hurry(): boolean {
    if (this.kiln === 'open') { this.kilnT = RULES.openSec; return true; }
    if (this.kiln === 'sell') { this.kilnT = RULES.saleSec; return true; }
    return false;
  }

  /** A tap closes a story card. */
  dismiss(): boolean {
    if (!this.card) return false;
    if (this.card.kind === 'open' && this.card.t < 0.6) return true;
    this.card = null;
    return true;
  }

  private setCard(c: Card): void {
    this.card = c;
    this.finger = null;
    this.talk.clear();
    this.emit({ type: 'card', card: c });
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started) return;
    this.t = t;
    this.reliable = f.reliable;
    this.level = f.level;
    this.calm = f.calm;
    if (this.card) {
      this.card.t += dt;
      if (this.card.t >= this.card.dur) this.card = null;
    }
    if (!this.ended) {
      this.band(dt, f);
      this.schedule(dt, f);
      if (!this.card || this.card.kind !== 'open') {
        this.wheelStep(dt);
        this.kilnStep(dt);
      }
      if (t >= this.plannedSec) this.end();
    }
    this.rot += dt * (this.wheel === 'spin' ? 16 : this.wheel === 'shape' || this.wheel === 'assist' ? 9 : this.wheel === 'cut' || this.wheel === 'walk' ? 6 : 1.2);
    this.talk.update(dt, t, this.talkBlocked);
  }

  /** Steadiness, the master's hand and the even heat from the band. */
  private band(dt: number, f: FocusFrame): void {
    const R = RULES;
    const phase = this.pushBlock ? 'focus' : this.restBlock ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    if (f.reliable && !this.freeBlock) this.relSec += dt;
    const top = Math.min(1, 1 + R.wheelStep * this.p.wheel);
    if (this.live && f.reliable) {
      this.steady = approach(this.steady, clamp(clamp(f.level) + R.wheelStep * this.p.wheel, 0, top), dt, R.steadyTau);
      if (this.steady >= 0.5) {
        this.charge = Math.min(1, this.charge + dt / R.chargeSec[this.eeg ? 'eeg' : 'fnirs']);
        this.goodT += dt;
        if (this.sighted && this.goodT >= R.goodSec && !this.goodSaid) {
          this.goodSaid = true;
          this.talk.ask('good', 3, 5);
        }
      } else this.goodT = 0;
      if (this.charge >= 1 && this.sighted && this.wheel === 'shape' && this.pot) this.spin();
    } else this.steady = approach(this.steady, this.base, dt, 0.9);
    if (this.warming && f.reliable) {
      this.heat = approach(this.heat, clamp(f.calm), dt, R.heatTau);
      if (this.heat >= 0.6 && !this.heatSaid) {
        this.heatSaid = true;
        this.talk.ask('heat', 2, 5);
      }
    } else if (!this.restBlock || !f.reliable) this.heat = approach(this.heat, 0.5, dt, 1.2);
  }

  private wheelStep(dt: number): void {
    const R = RULES;
    this.wheelT += dt;
    switch (this.wheel) {
      case 'walk':
        if (this.wheelT >= R.walkSec && this.order) {
          this.pot = new Pot(this.order.target);
          this.wheel = 'shape';
          this.wheelT = 0;
          this.emit({ type: 'order', order: this.order });
        }
        break;
      case 'shape':
        if (this.pot) {
          if (this.finger && this.wheelT >= R.lumpSec) {
            this.finger.held += dt;
            this.applyFinger(this.finger, dt);
            if (this.finger.held % 0.2 < dt) this.emit({ type: 'stroke', mode: this.finger.mode });
          }
          this.pot.true_(dt, this.steady >= 0.5 ? this.steady : this.steady * 0.4);
          if (!this.guideSeen && this.guide) this.guideSeen = true;
        }
        break;
      case 'assist':
      case 'spin': {
        const dur = this.wheel === 'spin' ? R.spinSec : R.assistSec;
        const k = Math.min(1, this.wheelT / dur);
        const e = k * k * (3 - 2 * k);
        if (this.pot && this.from && this.to) this.pot.blend(this.from, this.to, e);
        if (k >= 1) this.cut(this.wheel === 'assist', this.wheel === 'spin');
        break;
      }
      case 'cut':
        if (this.wheelT >= R.cutSec) {
          this.pot = null;
          this.wheel = 'idle';
          if (this.freeBlock) this.startKiln();
          else this.nextOrder();
        }
        break;
      default:
        break;
    }
  }

  /** The kiln takes the batch: glazing first. */
  private startKiln(): void {
    if (!this.batch.some(p => !p.sold)) {
      this.kiln = this.restBlock ? 'cool' : 'cold';
      return;
    }
    this.glazeIdx = this.batch.findIndex(p => !p.sold && p.glaze === null);
    if (this.glazeIdx < 0) this.glazeIdx = this.batch.length;
    this.kiln = 'glaze';
    this.kilnT = 0;
    this.heatAt = this.restBlock
      ? clamp(this.block.dur * RULES.heatAt, Math.min(RULES.heatMin, this.block.dur * 0.4), Math.max(this.block.dur * 0.4, this.block.dur - RULES.heatEnd))
      : 0;
    this.nextGlaze();
  }

  private nextGlaze(): void {
    while (this.glazeIdx < this.batch.length && (this.batch[this.glazeIdx].sold || this.batch[this.glazeIdx].glaze !== null)) this.glazeIdx++;
    if (this.glazeIdx >= this.batch.length) {
      this.kiln = 'heat';
      this.kilnT = 0;
      if (!this.freeBlock) this.heatAt = Math.max(this.heatAt, this.blockT);
      return;
    }
    const pc = this.batch[this.glazeIdx];
    this.brush.glaze = this.p.glazes.includes(pc.order.glaze) ? pc.order.glaze : this.brush.glaze;
    this.emit({ type: 'glazeStart', piece: pc, index: this.glazeIdx });
  }

  private kilnStep(dt: number): void {
    const R = RULES;
    this.kilnT += dt;
    for (const pc of this.batch) for (const b of pc.bands) b.t = Math.min(1, b.t + dt / R.bandSec);
    switch (this.kiln) {
      case 'glaze':
        // the kiln is hot and the batch is not ready: the apprentice glazes the rest as asked
        if (this.restBlock && this.blockT >= this.heatAt) while (this.kiln === 'glaze') this.glazeDone(true);
        break;
      case 'heat': {
        const ready = this.freeBlock || !this.restBlock ? this.kilnT >= R.freeHeat : this.blockT >= this.heatAt;
        if (ready) {
          this.kiln = 'fire';
          this.kilnT = 0;
          this.needle = 0;
          this.needleDir = 1;
          this.emit({ type: 'heat' });
        }
        break;
      }
      case 'fire': {
        const surge = 1 + R.surge * (1 - this.heat) * Math.sin(this.kilnT * 3.1);
        this.needle += this.needleDir * needleSpeed(this.heat) * surge * dt;
        if (this.needle >= 1) { this.needle = 2 - this.needle; this.needleDir = -1; }
        if (this.needle <= 0) { this.needle = -this.needle; this.needleDir = 1; }
        const late = this.restBlock ? this.blockT >= this.block.dur - R.fireEnd : this.kilnT >= 7;
        if (late) this.stopNeedle(true);
        break;
      }
      case 'open':
        if (this.kilnT >= R.openSec) {
          this.kiln = 'sell';
          this.kilnT = R.saleSec * 0.6;
          this.saleIdx = 0;
          this.emit({ type: 'open' });
        }
        break;
      case 'sell':
        if (this.kilnT >= R.saleSec) {
          this.kilnT = 0;
          if (!this.sellNext()) this.afterSales();
        }
        break;
      default:
        break;
    }
  }

  /** Sell the next fired piece to its customer; false when the batch is all sold. */
  private sellNext(): boolean {
    const pc = this.batch.find(p => !p.sold);
    if (!pc) return false;
    this.sell(pc);
    return true;
  }

  private afterSales(): void {
    const sold = this.batch.filter(p => p.sold);
    const coins = sold.reduce((s, p) => s + p.price + p.tip, 0);
    const three = sold.filter(p => p.stars === 3).length;
    this.batch = [];
    this.sellMarket();
    this.kiln = this.restBlock ? 'cool' : 'cold';
    this.kilnT = 0;
    if (sold.length && !this.card) this.setCard({ kind: 'tally', t: 0, dur: RULES.cardSec, n: sold.length, coins, three });
    if (this.freeBlock) this.nextOrder();
  }

  /** Quality, stars, price and the customer's reaction. */
  private sell(pc: Piece): void {
    const R = RULES, p = this.p, o = pc.order, form = FORM[o.form];
    if (pc.glaze === null) pc.glaze = p.glazes.includes(o.glaze) ? o.glaze : p.glazes[0];
    if (!pc.fire) pc.fire = 'good';
    const deco = decoOf(pc);
    const fq = pc.fire === 'perfect' ? R.fireQ.perfect : pc.fire === 'good' ? R.fireQ.good : R.fireQ.off;
    const q = R.qShape * pc.match + R.qDeco * deco + R.qFire * fq;
    pc.stars = pc.spun ? 3 : starsOf(q);
    const fm = pc.fire === 'perfect' ? R.fireMult.perfect : pc.fire === 'good' ? R.fireMult.good : R.fireMult.off;
    if (pc.order.market) {
      pc.price = Math.max(1, Math.round(form.price * (R.pFloor + q) * fm * R.market));
      pc.tip = 0;
    } else {
      if (pc.stars === 3) this.streak++;
      else this.streak = 0;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const sm = Math.min(R.streakMax, 1 + R.streakStep * Math.max(0, this.streak - 1));
      pc.price = Math.max(1, Math.round(form.price * (R.pFloor + q) * fm * (pc.steady ? 1 + R.passPush : 1) * sm));
      const house = (HOUSES as readonly string[]).includes(o.customer);
      const flair = !o.band ? Math.min(2, pc.bands.length) * 2 : 0;
      pc.tip = Math.round(form.price * R.tips[pc.stars - 1] * (pc.spun ? R.spinTip : 1)) + (house ? R.regularTip : 0) + flair;
    }
    pc.reaction = reactionOf(pc);
    pc.sold = true;
    this.sold++;
    if (pc.stars === 3) this.three++;
    this.bank(pc.price + pc.tip);
    p.sold++;
    p.stars += pc.stars;
    if (pc.stars === 3) p.three++;
    this.emit({ type: 'sale', piece: pc, streak: pc.order.market ? 0 : this.streak });
    if (pc.stars === 3) this.talk.ask('sale3', 2, 4);
    else if (pc.stars === 1) this.talk.ask('sale1', 2, 4);
    if (deco < R.decoBody && !pc.order.market) this.talk.ask('color', 1, 4);
    // the shelf, the households, the forms
    const out = shelve(p, recOf(pc));
    if (out !== 'same') {
      if (out === 'new') this.newForms.push(o.form);
      this.emit({ type: 'newForm', form: o.form, outcome: out });
      if (out === 'new') this.talk.ask('newForm', 3, 5);
    }
    if (o.story && pc.stars >= 2 && p.steps[o.story.house] === o.story.step - 1) {
      p.steps[o.story.house] = o.story.step;
      this.stories.push(o.story);
      this.emit({ type: 'story', house: o.story.house, step: o.story.step });
      if (!this.card) this.setCard({ kind: 'story', t: 0, dur: RULES.cardSec + 1.2, house: o.story.house, step: o.story.step, text: storyThanks(o.story.house, o.story.step) });
    }
    const open = openCount(p);
    const forms = openForms(p);
    if (open > this.openBefore + this.unlocked.length) {
      const f = forms[open - 1];
      this.unlocked.push(f);
      this.emit({ type: 'unlock', form: f });
    }
  }

  /** The market basket sells as one lot at the stall. */
  private sellMarket(): void {
    if (!this.market.length) return;
    let coins = 0;
    for (const pc of this.market) {
      if (pc.glaze === null) pc.glaze = this.p.glazes.includes(pc.order.glaze) ? pc.order.glaze : this.p.glazes[0];
      if (!pc.fire) pc.fire = this.fired?.grade ?? 'good';
      const q = RULES.qShape * pc.match + RULES.qDeco * decoOf(pc) + RULES.qFire * RULES.fireQ.good;
      pc.stars = starsOf(q);
      pc.price = Math.max(1, Math.round(FORM[pc.order.form].price * (RULES.pFloor + q) * RULES.market));
      pc.sold = true;
      coins += pc.price;
      this.sold++;
      this.p.sold++;
    }
    const n = this.market.length;
    this.market = [];
    this.bank(coins);
    this.emit({ type: 'market', n, coins });
  }

  private bank(coins: number): void {
    const c = Math.max(0, Math.round(coins));
    this.score += c;
    this.p.purse += c;
    this.p.earned += c;
  }

  private schedule(dt: number, f: FocusFrame): void {
    const b = this.block;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && !last && this.blockT >= b.dur - RULES.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: this.plan[this.blockIndex + 1] });
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
      this.p.pushes = this.pushesBase + this.pushesBegun;
      b.blind = this.session >= RULES.blindFrom && !first && this.p.pushes % RULES.blindEvery === 0;
      this.goodT = 0;
      this.goodSaid = false;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (this.wheel === 'idle') this.nextOrder();
    } else if (b.kind === 'rest') {
      this.heat = 0.5;
      this.heatSaid = false;
      this.lastFired = [];
      this.talk.ask('rest', 2, 12);
      if (this.wheel === 'walk') {
        this.wheel = 'idle';
        this.order = null;
      }
      this.startKiln();
    } else this.talk.ask('warm', 1, 10);
    this.tip = this.tipFor(b, i);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number): string {
    if (b.kind === 'warmup') return TIPS.warm;
    if (b.kind === 'push') return b.blind ? TIPS.blind[(this.session + i) % TIPS.blind.length] : TIPS.push[(this.session - 1 + i) % TIPS.push.length];
    return TIPS.rest[(this.session - 1 + i) % TIPS.rest.length];
  }

  /** A block's end: its verdict, what it pays, and the hand-over between the stations. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      const share = this.judge.share;
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push') {
        this.lastPushPassed = verdict === true;
        if (verdict === true) this.charge = Math.min(1, this.charge + RULES.passCharge);
        if (b.blind) {
          this.trace.unveil(this.t);
          const s = this.judge.measured > 0 ? share : 0;
          this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
          const coins = Math.round(Math.max(0, s - this.judge.need(want) * 0.5) * 100 * RULES.blindCoins);
          this.bank(coins);
          this.emit({ type: 'reveal', share: s, coins });
        }
        // the piece on the wheel: the master finishes it, and it joins the batch
        this.finishWheel();
        if (this.lastPushPassed) for (const pc of this.batch) if (!pc.sold) pc.steady = true;
      } else {
        this.settleKiln();
        if (verdict === true) this.kilnGift();
      }
    } else {
      this.finishWheel();
      this.settleKiln();
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict });
  }

  /** The piece in hand is finished by the master's hand, at once. */
  private finishWheel(): void {
    if (this.wheel === 'walk') {
      this.wheel = 'idle';
      this.order = null;
      return;
    }
    if (this.wheel === 'shape' && this.pot) {
      const k = this.pot.shareFor(RULES.assist);
      if (k > 0) this.pot.toward(k);
      this.cut(k > 0);
    } else if ((this.wheel === 'assist' || this.wheel === 'spin') && this.pot && this.to) {
      const spun = this.wheel === 'spin';
      this.pot.blend(this.to, this.to, 1);
      this.cut(!spun, spun);
    }
    if (this.wheel === 'cut') {
      this.pot = null;
      this.wheel = 'idle';
    }
  }

  /** Whatever the kiln still holds is glazed, fired and sold now (nothing is lost). */
  private settleKiln(): void {
    while (this.kiln === 'glaze') this.glazeDone(true);
    if (!this.lastFired.length) this.lastFired = this.batch.filter(pc => !pc.sold);
    for (const pc of this.batch) if (!pc.sold && !pc.fire) pc.fire = this.fired?.grade ?? 'good';
    let any = false;
    for (const pc of this.batch) if (!pc.sold) { this.sell(pc); any = true; }
    if (any || this.batch.length || this.market.length) {
      this.batch = [];
      this.sellMarket();
    }
    this.kiln = 'cold';
    this.kilnT = 0;
    this.fired = null;
  }

  /** A passed Wypał: the kiln's gift on the batch's best piece, and a little more for every piece fired. */
  private kilnGift(): void {
    const u = this.rng();
    const gift: KilnGift = u < 0.12 ? 'moon' : u < 0.42 ? 'speckle' : 'blush';
    const fired = this.lastFired;
    const coins = RULES.giftCoins * Math.max(1, fired.length);
    this.bank(coins);
    this.gifts.push(gift);
    this.p.gifts[gift] = (this.p.gifts[gift] ?? 0) + 1;
    const best = fired.slice().sort((a, b) => b.stars - a.stars || b.match - a.match)[0];
    if (best) {
      best.gift = gift;
      const rec = this.p.shelf[best.order.form];
      if (rec && rec.m === Math.round(best.match * 100) && !rec.gift) rec.gift = gift;
    }
    this.emit({ type: 'gift', gift, coins });
    this.talk.ask('gift', 3, 5);
  }

  /** the pieces of the last firing (for the kiln's gift) */
  private lastFired: Piece[] = [];

  private end(): void {
    if (this.ended) return;
    this.endBlock();
    this.finishWheel();
    this.settleKiln();
    this.ended = true;
    this.finger = null;
    this.p.best = Math.max(this.p.best, this.score);
    this.p.bestStreak = Math.max(this.p.bestStreak, this.bestStreak);
    this.talk.ask('end', 5, 8);
    this.emit({ type: 'done' });
  }

  finish(): void {
    if (this.started) this.end();
  }

  /** Time is up: wait a moment for a sale in flight (at most a few seconds; the runner caps it). */
  canStop(): boolean {
    return this.ended || this.kiln !== 'sell';
  }

  take(): GlinaEvent[] {
    if (!this.events.length) return [];
    return this.events.splice(0);
  }

  private emit(e: GlinaEvent): void {
    this.events.push(e);
    if (this.events.length > 400) this.events.shift();
  }

  // ── what the runner reads ───────────────────────────────────────
  /** The panel's gauge: steadiness in a push past the lead-in, the even heat in a rest, else nothing. */
  meter(): number | null {
    if (!this.started || this.ended || !this.reliable) return null;
    if (this.pushBlock) return this.block.blind ? null : clamp(this.steady);
    if (this.restBlock) return clamp(this.heat);
    return null;
  }

  padLevel(f: FocusFrame): number | null {
    return this.sighted && f.reliable ? f.level : null;
  }

  headlineSub(): string {
    if (this.streak >= 2) return t('sub.streak', { n: this.streak });
    const rec = this.bestBefore;
    if (rec > this.score && this.p.sessions > 1) return t('sub.toRecord', { n: fmtInt(rec - this.score) });
    if (this.sold) return t('sub.sold', { n: this.sold });
    return t('sub.purse', { n: fmtInt(this.p.purse) });
  }

  result(): { score: number; record: boolean; stats: [string, string][]; highlights: string[]; verse: PassageId } {
    const p = this.p;
    p.best = Math.max(p.best, this.score);
    p.bestStreak = Math.max(p.bestStreak, this.bestStreak);
    const stats: [string, string][] = [
      [t('stat.sold'), fmtInt(this.sold)],
      [t('stat.three'), fmtInt(this.three)],
      [t('stat.match'), this.bestMatch ? t('pct', { n: Math.round(this.bestMatch * 100) }) : '—'],
      [t('stat.perfect'), fmtInt(this.perfects)],
      [t('stat.spins'), fmtInt(this.spins)],
      [t('stat.purse'), fmtInt(p.purse)],
    ];
    const hl: string[] = [];
    for (const f of this.newForms) hl.push(t('hl.newForm', { form: FORM[f].name }));
    for (const s of this.stories) hl.push(t('hl.story', { who: t(`who.${s.house}` as 'who.karczma'), n: s.step }));
    for (const g of this.gifts) hl.push(t('hl.gift', { gift: KILN_GIFT_NAME[g] }));
    for (const f of this.unlocked) hl.push(t('hl.unlock', { form: FORM[f].name }));
    if (this.bestStreak >= 3) hl.push(t('hl.streak', { n: this.bestStreak }));
    if (this.bestBefore > 0 && this.score > this.bestBefore) hl.push(t('hl.record', { n: fmtInt(this.score) }));
    else if (this.score > 0 && this.bestBefore > this.score) hl.push(t('hl.toBest', { n: fmtInt(this.bestBefore - this.score) }));
    if (this.blindShare >= 0) hl.push(t('hl.blind', { pct: this.blindShare }));
    hl.push(t(this.spins ? 'hl.closeMaster' : this.three ? 'hl.closeThree' : 'hl.close', { n: shelfCount(p) }));
    let verse: PassageId;
    if (this.stories.some(s => s.step >= 4)) verse = CLOSING.story;
    else if (this.spins) verse = CLOSING.master;
    else if (this.gifts.length) verse = CLOSING.calm;
    else if (this.newForms.length) verse = CLOSING.glaze;
    else verse = inTurn([CLOSING.clay, CLOSING.work], this.session);
    return { score: this.score, record: this.bestBefore > 0 && this.score > this.bestBefore, stats, highlights: hl, verse };
  }
}

/** A piece's decoration against its order, 0..1. */
export function decoOf(pc: Pick<Piece, 'glaze' | 'bands' | 'order'>): number {
  const R = RULES, o = pc.order;
  let d = pc.glaze === o.glaze ? R.decoBody : R.decoBodyWrong;
  if (o.band) {
    const col = pc.bands.filter(b => b.glaze === o.band!.glaze);
    if (col.length) d += R.decoBandColor;
    if (col.some(b => b.pattern === o.band!.pattern)) d += R.decoBandPattern;
  } else d += R.decoBandColor + R.decoBandPattern;
  return clamp(d);
}

function reactionOf(pc: Piece): Reaction {
  if (pc.spun) return 'rMaster';
  if (pc.stars < 3 && pc.fire === 'hot') return 'rHot';
  if (pc.stars < 3 && pc.fire === 'soft') return 'rSoft';
  if (pc.glaze !== pc.order.glaze && pc.stars < 3) return 'rColor';
  return pc.stars === 3 ? 'r3' : pc.stars === 2 ? 'r2' : 'r1';
}

/** The reaction's words for a sale (one of three, by the piece's order id). */
export const reactionText = (pc: Piece): string => REACT[pc.reaction][pc.order.id % REACT[pc.reaction].length];

/** A sold piece as the shelf keeps it. */
export function recOf(pc: Piece): PieceRec {
  const q: number[] = [];
  for (let k = 0; k < RINGS; k++) q.push(Math.round((pc.r[k] / pc.H) * 100));
  const b: BandRec[] = pc.bands.map(x => [Math.round(x.u * 100), x.glaze, x.pattern]);
  return { f: pc.order.form, h: Math.round(pc.H * 10) / 10, q, g: pc.glaze ?? 'biel', b, stars: pc.stars, m: Math.round(pc.match * 100), gift: pc.gift };
}

/** The shape's stars as the ticket shows them live. */
export const liveStars = (m: number): 1 | 2 | 3 => shapeStars(m);
