/**
 * Arka's session (v2, after Arrows – Puzzle Escape), pure and DOM-free: the saga's boards on the
 * ark's deck, the animals and their ways out, the hearts, the stars, the dove's help, the pairs on
 * the new land, the band's mist and rainbow, the blocks and the raven's remarks.  The view and the
 * sound read its state and drain its events (`take()`).
 *
 *   the deck           tap an animal: if every cell ahead of it to the edge is free it slides out (its
 *                      file of young follows) and walks down to the new land; if not, it bumps into the
 *                      one in its way and a heart goes (the same animal again within 1.4 s: no second
 *                      heart).  No hearts left: Noah leads everyone back and the board starts again —
 *                      the pairs already out stay counted.  A cleared board earns ★ to ★★★.
 *   pairs              two of every kind walk a board; the second of a kind to come down completes a
 *                      pair (the headline).  Mates sent back to back: "Parami!", the pair bonus.
 *   specials           a sleeper wakes at the first tap; a turning goat turns a quarter clockwise each
 *                      time another animal leaves; a pen opens when the animal with its key has left.
 *   the dove           Space or the dove: a free animal is shown and sent; the dove then rests 4 s, and
 *                      the board can no longer earn ★★★.
 *   Mgła (push)        the flood's mist covers the deck beyond a clear circle around the door; after
 *                      the lead-in its radius follows `level` (the threshold ring at 0.5), and above
 *                      the threshold the free animals inside it show their way out in gold.  Blind:
 *                      the circle holds at the threshold and the block's share is told at its end.
 *   Tęcza (rest)       calm fills the rainbow; full, it gives a heart back (a fourth when all three are
 *                      there) and its end lights one safe move.  A passed rest with none gets one.
 *   no signal          the mist holds at the threshold, the rainbow waits: nothing is ever lost.
 */
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import { boardFor, wayOut, type BoardSpec, type Cell } from './board';
import { CHAPTER_LEN, KIND, STAGES, TIPS, chapterOf, levelSpec, type KindId, type LevelSpec } from './content';
import { t, unit } from './i18n';
import { clearLevel, homestead, migrate, settle, teach, totalStars, type ArkaProgress } from './meta';
import { RULES, parFor, starsFor, type Dir } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

export interface Animal {
  id: number;
  kind: KindId;
  /** cells[0] is the leader */
  cells: Cell[];
  dir: Dir;
  asleep: boolean;
  turner: boolean;
  /** the animal carrying this pen's key (-1: no pen), and the pen this one's key opens (-1: none) */
  lockedBy: number;
  keyFor: number;
  out: boolean;
}

export type LevelState = 'drop' | 'play' | 'clear' | 'restart';

/** Where a coach mark points: an animal, the dove's button, the mist's ring, the hearts, the new land. */
export type CoachAt = { animal: number } | 'dove' | 'ring' | 'hearts' | 'shore' | null;

export type Moment = 'open' | 'push' | 'blind' | 'rest' | 'sun' | 'rainbow' | 'bump' | 'restart' | 'clear' | 'clear3'
  | 'bonus' | 'dove' | 'idle' | 'end' | 'chain' | 'level';

export type SimEvent =
  | { type: 'level'; n: number; retry: boolean; mood: LevelSpec['mood']; chapter: number | null }
  | { type: 'send'; id: number; kind: KindId; dir: Dir; cells: Cell[]; dist: number; chain: number; dove: boolean }
  | { type: 'bump'; id: number; blocker: number; dist: number; lost: boolean; hearts: number }
  | { type: 'pair'; kind: KindId; bonus: boolean; pairs: number; young: boolean; newKind: boolean }
  | { type: 'wake'; id: number }
  | { type: 'turn'; id: number; dir: Dir }
  | { type: 'locked'; id: number }
  | { type: 'unlock'; id: number; by: number }
  | { type: 'clear'; n: number; stars: number; sec: number; par: number; bumps: number; doves: number; advanced: boolean; built: boolean }
  | { type: 'restart'; n: number }
  | { type: 'dove'; id: number }
  | { type: 'doveBusy' }
  | { type: 'rainbow'; heart: boolean; shine: number }
  | { type: 'sun' }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'blindReveal'; share: number }
  | { type: 'finale' }
  | { type: 'coach'; key: string; at: CoachAt }
  | { type: 'say'; text: string; moment: Moment };

/** How many lines each moment has in the catalog (say.<moment>.<i>). */
const LINES: Readonly<Record<Moment, number>> = {
  open: 4, push: 4, blind: 3, rest: 4, sun: 4, rainbow: 3, bump: 5, restart: 3, clear: 4, clear3: 4,
  bonus: 3, dove: 4, idle: 3, end: 3, chain: 3, level: 4,
};

export interface SimInit {
  progress: ArkaProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

const PLAN_SALT = 0x4a1c;

/** Spread the shortfall of blocks under `min` over the longer ones, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks.  A first-ever session opens with a warm-up (34 s in 5 and 10 min, 22 s in 3,
 * 8 s in a short test); then Mgła / Tęcza pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time,
 * jittered only when there is room) ending with a rest, leaving the last 5 s to the finale.  No block
 * under 12 s, and any plannedSec ≥ 10 fits.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  const left0 = Math.max(4, plannedSec - R.finale);
  if (plannedSec <= 60) {
    const warm = firstEver ? Math.min(R.warm.test, Math.max(0, left0 - 2 * R.minBlock)) : 0;
    const left = Math.max(2, left0 - warm);
    const rest = Math.max(Math.min(R.minBlock, left / 2), Math.min(14, left / 2));
    const out: Block[] = [];
    if (warm > 0) out.push(b('warmup', warm));
    out.push(b('push', Math.max(1, left - rest)), b('rest', rest));
    return out;
  }
  const plan: Block[] = [];
  let left = left0;
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

/** How long a line of the raven stays (s): 2–4 s by its length. */
export const sayDur = (text: string): number => clamp(1.7 + text.length * 0.034, 2, 4);

export class ArkaSim {
  readonly p: ArkaProgress;
  readonly plannedSec: number;
  readonly eeg: boolean;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  private readonly contrast = new BlockContrast(4);
  private readonly lead: number;
  private readonly bestBefore: number;
  private readonly firstEver: boolean;
  /** this session's number (1 = the first ever) */
  readonly session: number;
  private readonly day: string;

  // the clock and the blocks
  now = 0;
  started = false;
  phase: 'play' | 'finale' = 'play';
  plan: Block[] = [];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  private relSec = 0;
  tip = '';
  private pushesBase = 0;

  // the board
  spec!: LevelSpec;
  board!: BoardSpec;
  animals: Animal[] = [];
  private grid = new Int16Array(0);
  levelN = 1;
  levelState: LevelState = 'drop';
  stateT = 0;
  /** play time on this board (the par's clock) */
  levelT = 0;
  hearts: number = RULES.hearts;
  bumps = 0;
  doves = 0;
  /** the kinds whose first has come down and waits for its mate on the new land */
  shore: KindId[] = [];
  /** the board in its play order is "practice" (the tutorial's first board): bumps cost no heart */
  practice = false;
  private lastKind: KindId | null = null;
  private lastBump = { id: -1, t: -99 };
  chain = 0;
  lastClear: Extract<SimEvent, { type: 'clear' }> | null = null;
  private stuckT = 0;
  private freeCache: number[] | null = null;

  // the hands' help
  doveT = 0;
  cursor: Cell = { x: 0, y: 0 };
  keyboard = false;
  private idleT = 0;
  /** the safe move the rainbow's end lights (-1: none) and for how long */
  shine = -1;
  shineT = 0;

  // the band
  reliable = false;
  /** the clear circle's driver 0..1 (0.5 = the threshold), and the mist's presence 0..1 */
  sight = 0.5;
  mist = 0;
  sunOn = false;
  /** the rainbow's charge 0..1 and its glow (calm, smoothed) */
  rainbow = 0;
  glow = 0;
  private rainbowsBlock = 0;

  // the session's tallies
  pairs = 0;
  levels = 0;
  starsSession = 0;
  threeStars = 0;
  bonus = 0;
  bestChain = 0;
  bumpsAll = 0;
  restarts = 0;
  rainbows = 0;
  heartsBack = 0;
  dovesAll = 0;
  sunCount = 0;
  passedPush = 0;
  passedRest = 0;
  blindShare = -1;
  newYoung: KindId[] = [];
  newKinds: KindId[] = [];
  builtStage = -1;
  private finished = false;

  // the raven
  line: { text: string; t0: number; dur: number; moment: Moment } | null = null;
  /** a card is on screen (the view says so each frame): the raven and the coach wait */
  cardOn = false;
  private pending: { m: Moment; at: number }[] = [];
  private lastSaid: Partial<Record<Moment, number>> = {};
  private turnOf: Partial<Record<Moment, number>> = {};
  private talkTill = 0;
  private coachQ: { key: string; at: CoachAt }[] = [];
  private coachTill = 0;

  private events: SimEvent[] = [];

  constructor(init: SimInit) {
    this.p = migrate(init.progress);
    this.rng = init.rng;
    this.day = init.day;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    this.lead = RULES.leadIn[init.eeg ? 'eeg' : 'fnirs'];
    this.bestBefore = this.p.bestSession;
    this.firstEver = this.p.sessions === 0;
    this.session = this.p.sessions + 1;
    this.pushesBase = this.p.pushes;
    this.plan = planBlocks(init.plannedSec, this.firstEver, (() => {
      let s = (init.daySeed ^ PLAN_SALT) >>> 0;
      return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    })());
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.sessions = this.session;
    this.p.lastDay = this.day;
    this.startBlock(0);
    this.loadLevel(this.p.level, false);
    this.queue('open', 1.2);
  }

  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get leadIn(): number { return this.lead; }
  get blind(): boolean { return this.phase === 'play' && this.block.kind === 'push' && this.block.blind; }
  /** a sighted Mgła past its lead-in: the circle answers the band */
  get sighted(): boolean { return this.phase === 'play' && this.block.kind === 'push' && !this.block.blind && this.blockT >= this.lead; }
  get want(): 'focus' | 'rest' | 'free' {
    if (!this.started || this.phase !== 'play') return 'free';
    const k = this.block.kind;
    return k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free';
  }
  get blockLeft(): number { return Math.max(0, this.block.dur - this.blockT); }
  get nextBlock(): Block | null {
    if (!this.telegraphed || this.phase !== 'play') return null;
    return this.plan[this.blockIndex + 1] ?? null;
  }
  get par(): number { return parFor(this.animals.length); }
  get onDeck(): number { return this.animals.reduce((s, a) => s + (a.out ? 0 : 1), 0); }
  get pairsOnBoard(): number { return this.animals.length / 2; }
  get pairsDone(): number { return Math.floor((this.animals.length - this.onDeck - this.shore.length) / 2); }

  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || this.finished) return;
    this.now = t;
    this.reliable = f.reliable;
    this.blocks(dt, f, t);
    this.band(dt, f);
    this.board_(dt);
    this.doveT = Math.max(0, this.doveT - dt);
    if (this.shine >= 0) {
      this.shineT -= dt;
      if (this.shineT <= 0 || this.animals[this.shine]?.out) this.shine = -1;
    }
    this.talk();
    this.coach();
  }

  private blocks(dt: number, f: FocusFrame, t: number): void {
    if (this.phase !== 'play') return;
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (f.reliable) this.relSec += dt;
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
      this.phase = 'finale';
      this.emit({ type: 'finale' });
      this.queue('end', 0.4);
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
    this.rainbowsBlock = 0;
    this.rainbow = 0;
    this.sunOn = false;
    this.judge.reset();
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.p.pushes++;
      b.blind = this.session >= RULES.blindFrom && !first && this.p.pushes % RULES.blindEvery === 0;
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
    this.pending = this.pending.filter(q => q.m === 'open');
    if (b.kind === 'push') {
      this.queue(b.blind ? 'blind' : 'push', 0);
      if (!b.blind && teach(this.p, 'mist')) this.coachQ.push({ key: 'mist', at: 'ring' });
    } else if (b.kind === 'rest') {
      this.queue('rest', 0);
      if (teach(this.p, 'rainbow')) this.coachQ.push({ key: 'rainbow', at: 'hearts' });
    }
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup;
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (first && this.pushesBase === 0) return TIPS.firstPush;
      return TIPS.push[(this.session - 1 + i) % TIPS.push.length];
    }
    if (first && this.session === 1) return TIPS.firstRest;
    return TIPS.rest[(this.session - 1 + i) % TIPS.rest.length];
  }

  /** A block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && verdict) this.passedPush++;
      if (b.kind === 'rest') {
        if (verdict) this.passedRest++;
        // grace: a passed rest, or the first rest ever, never ends without its rainbow
        const firstRest = this.session === 1 && !this.plan.slice(0, this.blockIndex).some(x => x.kind === 'rest');
        if (this.rainbowsBlock === 0 && (verdict || firstRest)) this.giveRainbow();
      }
      if (b.blind) {
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.emit({ type: 'blindReveal', share: s });
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  /** The band's slow quantities: the mist's circle in a sighted Mgła, the rainbow in a Tęcza, both past the lead-in. */
  private band(dt: number, f: FocusFrame): void {
    const R = RULES, b = this.block, play = this.phase === 'play';
    const push = play && b.kind === 'push';
    const want = this.sighted && f.reliable ? f.level : 0.5;
    this.sight = approach(this.sight, clamp(want), dt, R.sightTau);
    this.mist = approach(this.mist, push ? 1 : 0, dt, R.mistFade / 3);
    if (this.sighted && f.reliable) {
      if (!this.sunOn && this.sight >= 0.55) {
        this.sunOn = true;
        this.sunCount++;
        this.emit({ type: 'sun' });
        this.queue('sun', 0.3, RULES.sayEvery);
      } else if (this.sunOn && this.sight < 0.45) this.sunOn = false;
    } else if (!push) this.sunOn = false;
    const rest = play && b.kind === 'rest';
    this.glow = approach(this.glow, rest && f.reliable ? f.calm : 0, dt, 0.5);
    if (rest && f.reliable && this.blockT >= this.lead && this.rainbowsBlock < R.rainbowMax) {
      this.rainbow += (Math.max(0, f.calm - 0.5) * 2 / R.rainbowSec) * dt;
      if (this.rainbow >= 1) {
        this.rainbow = 0;
        this.giveRainbow();
      }
    }
  }

  private giveRainbow(): void {
    this.rainbowsBlock++;
    this.rainbows++;
    let heart = false;
    if (this.levelState === 'play' || this.levelState === 'drop') {
      if (this.hearts < RULES.hearts + 1) {
        this.hearts++;
        this.heartsBack++;
        heart = true;
      }
    }
    const pick = this.levelState === 'play' ? this.bestMove(true) : -1;
    this.shine = pick;
    this.shineT = RULES.shineSec;
    this.emit({ type: 'rainbow', heart, shine: pick });
    this.queue('rainbow', 0.4, RULES.sayEvery);
  }

  // ── the board ──────────────────────────────────────────────────
  private loadLevel(n: number, retry: boolean): void {
    this.levelN = n;
    this.spec = levelSpec(n);
    this.board = boardFor(n);
    this.animals = this.board.pieces.map((p, i) => ({
      id: i, kind: p.kind, cells: p.cells.map(c => ({ ...c })), dir: p.dir, asleep: p.sleepy, turner: p.turner,
      lockedBy: p.lockedBy, keyFor: this.board.pieces.findIndex(q => q.lockedBy === i), out: false,
    }));
    this.grid = new Int16Array(this.board.cols * this.board.rows).fill(-1);
    for (const a of this.animals) for (const c of a.cells) this.grid[c.y * this.board.cols + c.x] = a.id;
    this.freeCache = null;
    this.hearts = RULES.hearts;
    this.bumps = 0;
    this.doves = 0;
    this.levelT = 0;
    this.shore = [];
    this.lastKind = null;
    this.lastBump = { id: -1, t: -99 };
    this.stuckT = 0;
    this.shine = -1;
    this.levelState = 'drop';
    this.stateT = 0;
    this.practice = n === 1;
    const lead = this.animals[this.bestMove(false)] ?? this.animals[0];
    if (lead) this.cursor = { ...lead.cells[0] };
    const ch = chapterOf(n);
    // the first-ever session's opening card tells the first chapter: its own card waits for none
    const fresh = !retry && (n - 1) % CHAPTER_LEN === 0 && ch >= this.p.chapters;
    const chapter = fresh && !(ch === 0 && this.session === 1) ? ch : null;
    if (fresh) this.p.chapters = ch + 1;
    this.emit({ type: 'level', n, retry, mood: this.spec.mood, chapter });
    if (!retry && n > 1) this.queue('level', 0.8, 25);
    // coach marks for what this board brings for the first time
    const firstOf = (pred: (a: Animal) => boolean, key: string) => {
      const a = this.animals.find(pred);
      if (a && teach(this.p, key)) this.coachQ.push({ key, at: { animal: a.id } });
    };
    if (!retry) {
      if (n === 1 || this.session === 1) firstOf(() => true, 'tap');
      firstOf(a => a.cells.length > 1, 'file');
      firstOf(a => a.asleep, 'sleepy');
      firstOf(a => a.turner, 'turner');
      firstOf(a => a.lockedBy >= 0, 'locked');
    }
  }

  private board_(dt: number): void {
    this.stateT += dt;
    const R = RULES;
    switch (this.levelState) {
      case 'drop':
        if (this.stateT >= R.dropSec) { this.levelState = 'play'; this.stateT = 0; }
        return;
      case 'clear':
        if (this.stateT >= R.clearSec) this.loadLevel(this.p.level, false);
        return;
      case 'restart':
        if (this.stateT >= R.restartSec) this.loadLevel(this.levelN, true);
        return;
      case 'play':
        break;
    }
    this.levelT += dt;
    this.idleT += dt;
    if (this.idleT >= R.idleHint && this.p.taught.includes('tap') && teach(this.p, 'dove')) this.coachQ.push({ key: 'dove', at: 'dove' });
    if (this.idleT >= R.idleHint * 2) {
      this.idleT = 0;
      this.queue('idle', 0, 30);
    }
    // nothing can move: the turning goats look round (and a board that cannot, if there ever were one, is dealt again)
    if (!this.freeIds().length && this.onDeck > 0) {
      this.stuckT += dt;
      if (this.stuckT >= R.stuckTurn) {
        this.stuckT = 0;
        if (this.animals.some(a => !a.out && a.turner)) this.turnGoats(-1);
        else if (!this.animals.some(a => !a.out && a.lockedBy >= 0 && !this.animals[a.lockedBy].out)) this.loadLevel(this.levelN, true);
        else for (const a of this.animals) if (!a.out && a.lockedBy >= 0) a.lockedBy = -1;
        this.freeCache = null;
      }
    } else this.stuckT = 0;
  }

  /** Animals that can leave now (awake or not: a sleeper wakes and goes on the dove's word). */
  freeIds(): number[] {
    if (this.freeCache) return this.freeCache;
    const out: number[] = [];
    for (const a of this.animals) {
      if (a.out || !this.open(a)) continue;
      if (this.way(a).blocker < 0) out.push(a.id);
    }
    this.freeCache = out;
    return out;
  }

  private open(a: Animal): boolean { return a.lockedBy < 0 || this.animals[a.lockedBy].out; }

  way(a: Animal): { dist: number; blocker: number } {
    return wayOut(this.grid, this.board.cols, this.board.rows, a.cells[0], a.dir, a.id);
  }

  /**
   * The move the dove (or the rainbow) shows: a free animal whose mate waits on the new land first,
   * then one whose mate is free too, then any free one.  `calm`: never a turning goat (it may turn away).
   */
  bestMove(calm: boolean): number {
    const free = this.freeIds().filter(id => !calm || !this.animals[id].turner);
    if (!free.length) return -1;
    const waits = free.find(id => this.shore.includes(this.animals[id].kind));
    if (waits !== undefined) return waits;
    const twin = free.find(id => free.some(j => j !== id && this.animals[j].kind === this.animals[id].kind));
    return twin ?? free[0];
  }

  animalAt(x: number, y: number): Animal | null {
    if (x < 0 || y < 0 || x >= this.board.cols || y >= this.board.rows) return null;
    const id = this.grid[y * this.board.cols + x];
    return id >= 0 ? this.animals[id] : null;
  }

  /** A tap on a cell of the deck (board cells; outside: nothing). */
  tapCell(x: number, y: number): boolean {
    const a = this.animalAt(x, y);
    if (!a) return false;
    this.cursor = { ...a.cells[0] };
    return this.tap(a.id);
  }

  /** A tap on an animal: wake, rattle a pen, slide out, or bump.  True when something happened. */
  tap(id: number): boolean {
    if (this.levelState === 'clear') { this.skip(); return false; }
    if (this.levelState !== 'play' || this.finished) return false;
    const a = this.animals[id];
    if (!a || a.out) return false;
    this.idleT = 0;
    if (!this.open(a)) {
      this.emit({ type: 'locked', id });
      return true;
    }
    if (a.asleep) {
      a.asleep = false;
      this.emit({ type: 'wake', id });
      return true;
    }
    const way = this.way(a);
    if (way.blocker < 0) {
      this.send(a, false);
      return true;
    }
    this.bump(a, way);
    return true;
  }

  private bump(a: Animal, way: { dist: number; blocker: number }): void {
    const again = this.lastBump.id === a.id && this.now - this.lastBump.t < RULES.bumpGrace;
    this.lastBump = { id: a.id, t: this.now };
    const lost = !this.practice && !again;
    if (lost) {
      this.hearts--;
      this.bumps++;
      this.bumpsAll++;
    }
    this.chain = 0;
    this.emit({ type: 'bump', id: a.id, blocker: way.blocker, dist: way.dist, lost, hearts: this.hearts });
    if (lost || this.practice) this.queue('bump', 0.3, 6);
    if (this.p.taught.includes('tap') && teach(this.p, 'hearts')) this.coachQ.push({ key: 'hearts', at: 'hearts' });
    if (this.hearts <= 0) {
      this.levelState = 'restart';
      this.stateT = 0;
      this.restarts++;
      this.emit({ type: 'restart', n: this.levelN });
      this.queue('restart', 0.2);
    }
  }

  private send(a: Animal, dove: boolean): void {
    const way = this.way(a);
    a.out = true;
    a.asleep = false;
    for (const c of a.cells) this.grid[c.y * this.board.cols + c.x] = -1;
    this.freeCache = null;
    this.chain++;
    this.bestChain = Math.max(this.bestChain, this.chain);
    this.emit({ type: 'send', id: a.id, kind: a.kind, dir: a.dir, cells: a.cells.map(c => ({ ...c })), dist: way.dist, chain: this.chain, dove });
    if (this.chain === 6 || this.chain === 12) this.queue('chain', 0.5, 20);
    if (!this.p.taught.includes('bump') && this.p.taught.includes('tap')) {
      const blocked = this.animals.find(b => !b.out && this.open(b) && !b.asleep && this.way(b).blocker >= 0);
      if (blocked && teach(this.p, 'bump')) this.coachQ.push({ key: 'bump', at: { animal: blocked.id } });
    }
    // the new land: the second of a kind completes a pair
    const waiting = this.shore.indexOf(a.kind);
    if (waiting >= 0) {
      this.shore.splice(waiting, 1);
      const bonus = this.lastKind === a.kind;
      const newKind = (this.p.settled[a.kind] ?? 0) === 0;
      this.pairs++;
      const young = settle(this.p, a.kind);
      if (young) this.newYoung.push(a.kind);
      if (newKind) this.newKinds.push(a.kind);
      if (bonus) {
        this.bonus++;
        this.queue('bonus', 0.4, 15);
      }
      this.emit({ type: 'pair', kind: a.kind, bonus, pairs: this.pairs, young, newKind });
      if (teach(this.p, 'pair')) this.coachQ.push({ key: 'pair', at: 'shore' });
    } else this.shore.push(a.kind);
    this.lastKind = a.kind;
    // a pen whose key just left opens
    for (const b of this.animals) {
      if (!b.out && b.lockedBy === a.id) this.emit({ type: 'unlock', id: b.id, by: a.id });
    }
    this.turnGoats(a.id);
    if (this.cursor.x === a.cells[0].x && this.cursor.y === a.cells[0].y) this.cursorToNearest();
    if (this.onDeck === 0) this.clearBoard();
  }

  private turnGoats(except: number): void {
    for (const g of this.animals) {
      if (g.out || !g.turner || g.id === except) continue;
      g.dir = ((g.dir + 1) % 4) as Dir;
      this.emit({ type: 'turn', id: g.id, dir: g.dir });
    }
    this.freeCache = null;
  }

  private clearBoard(): void {
    const stars = starsFor(this.bumps, this.doves, this.levelT, this.par);
    const homeBefore = homestead(totalStars(this.p)).built;
    const { advanced } = clearLevel(this.p, this.levelN, stars);
    const homeAfter = homestead(totalStars(this.p)).built;
    const built = homeAfter > homeBefore;
    if (built) this.builtStage = Math.max(this.builtStage, homeAfter - 1);
    this.levels++;
    this.starsSession += stars;
    if (stars === 3) this.threeStars++;
    this.levelState = 'clear';
    this.stateT = 0;
    const ev = { type: 'clear' as const, n: this.levelN, stars, sec: this.levelT, par: this.par, bumps: this.bumps, doves: this.doves, advanced, built };
    this.lastClear = ev;
    this.emit(ev);
    this.queue(stars === 3 ? 'clear3' : 'clear', 0.5);
  }

  /** A tap on the stars card moves on (after a moment, so a tap meant for the last animal does not skip it). */
  skip(): void {
    if (this.levelState === 'clear' && this.stateT >= 0.6) this.loadLevel(this.p.level, false);
  }

  // ── the dove and the keys ──────────────────────────────────────
  /** Space or the dove's button: the dove shows a free animal and sends it (then rests); false when it could not. */
  dove(): boolean {
    if (this.levelState === 'clear') { this.skip(); return false; }
    if (this.levelState !== 'play' || this.finished) return false;
    if (this.doveT > 0) {
      this.emit({ type: 'doveBusy' });
      return false;
    }
    const id = this.bestMove(false);
    if (id < 0) return false;
    this.idleT = 0;
    this.doveT = RULES.doveRest;
    if (!this.practice) this.doves++;
    this.dovesAll++;
    teach(this.p, 'dove');
    const a = this.animals[id];
    this.emit({ type: 'dove', id });
    this.queue('dove', 0.6, 14);
    this.send(a, true);
    return true;
  }

  moveCursor(dx: number, dy: number): void {
    this.keyboard = true;
    const b = this.board;
    this.cursor = { x: (this.cursor.x + dx + b.cols) % b.cols, y: (this.cursor.y + dy + b.rows) % b.rows };
  }

  /** Enter: tap the animal under the keyboard's cursor (or the nearest one to it). */
  sendCursor(): boolean {
    this.keyboard = true;
    let a = this.animalAt(this.cursor.x, this.cursor.y);
    if (!a) {
      this.cursorToNearest();
      a = this.animalAt(this.cursor.x, this.cursor.y);
    }
    return a ? this.tap(a.id) : this.tap(-1);
  }

  private cursorToNearest(): void {
    let best: Animal | null = null, bd = Infinity;
    for (const a of this.animals) {
      if (a.out) continue;
      for (const c of a.cells) {
        const d = Math.abs(c.x - this.cursor.x) + Math.abs(c.y - this.cursor.y);
        if (d < bd) { bd = d; best = a; }
      }
    }
    if (best) this.cursor = { ...best.cells[0] };
  }

  // ── the raven ──────────────────────────────────────────────────
  private queue(m: Moment, delay: number, every = 0): void {
    const last = this.lastSaid[m];
    if (every > 0 && last !== undefined && this.now - last < every) return;
    if (this.pending.some(q => q.m === m)) return;
    if (this.pending.length >= 3) this.pending.shift();
    this.pending.push({ m, at: this.now + delay });
  }

  /** May a line show now: never over a card, the runner's block banner (its first 5.3 s) or the telegraph. */
  private quiet(): boolean {
    if (this.cardOn) return true;
    if (this.phase !== 'play') return false;
    const b = this.block;
    if (b.kind !== 'warmup' && this.blockT < 5.3) return true;
    return this.blockT >= b.dur - RULES.telegraph - 0.3;
  }

  private talk(): void {
    if (this.line && this.now >= this.line.t0 + this.line.dur) this.line = null;
    if (!this.pending.length || this.now < this.talkTill || this.quiet()) return;
    this.pending = this.pending.filter(q => q.m === 'open' || q.m === 'push' || q.m === 'rest' || q.m === 'blind' || q.m === 'end' || this.now - q.at < 6);
    const i = this.pending.findIndex(q => q.at <= this.now);
    if (i < 0) return;
    const { m } = this.pending.splice(i, 1)[0];
    const n = LINES[m];
    const k = ((this.turnOf[m] ?? Math.floor(this.rng() * n)) % n) + 1;
    this.turnOf[m] = k;
    const text = t(`say.${m}.${k}` as Parameters<typeof t>[0]);
    const dur = sayDur(text);
    this.line = { text, t0: this.now, dur, moment: m };
    this.lastSaid[m] = this.now;
    this.talkTill = this.now + dur + RULES.sayGap;
    this.emit({ type: 'say', text, moment: m });
  }

  private coach(): void {
    if (!this.coachQ.length || this.now < this.coachTill || this.levelState !== 'play' || this.cardOn) return;
    const b = this.block;
    // the mist's mark waits for the banner to go and the circle to have something to show
    if (this.coachQ[0].key === 'mist' && (b.kind !== 'push' || this.blockT < 5.5)) {
      if (b.kind !== 'push') this.coachQ.shift();
      return;
    }
    if (this.coachQ[0].key === 'rainbow' && (b.kind !== 'rest' || this.blockT < 5.5)) {
      if (b.kind !== 'rest') this.coachQ.shift();
      return;
    }
    const c = this.coachQ.shift()!;
    if (typeof c.at === 'object' && c.at && this.animals[c.at.animal]?.out) return;
    this.coachTill = this.now + 4.2;
    this.emit({ type: 'coach', key: c.key, at: c.at });
  }

  // ── what the runner reads ──────────────────────────────────────
  /** The gauge: the mist's circle in a sighted Mgła, the rainbow's glow in a Tęcza; null blind, free or without signal. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    const b = this.block;
    if (b.kind === 'push') return b.blind ? null : this.sight;
    if (b.kind === 'rest') return this.glow;
    return null;
  }

  headline(): { value: number; sub?: string } {
    const have = this.pairsDone, all = this.pairsOnBoard;
    const sub = this.chain >= 3 ? t('sub.chain', { c: this.chain, have, all }) : t('sub.level', { have, all });
    return { value: this.pairs, sub };
  }

  /** The pad follows the level only in a sighted Mgła; rest and blind blocks hold it still. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || this.phase !== 'play') return null;
    return this.sighted && f.reliable ? f.level : null;
  }

  canStop(): boolean {
    return this.levelState === 'play' || this.levelState === 'drop' || this.stateT >= 1;
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
  }

  take(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private emit(e: SimEvent): void { this.events.push(e); }

  result(): ArcadeOutcome {
    const p = this.p;
    p.bestSession = Math.max(p.bestSession, this.pairs);
    p.bestChain = Math.max(p.bestChain, this.bestChain);
    p.bestBonus = Math.max(p.bestBonus, this.bonus);
    const stats: [string, string][] = [
      [t('stat.levels'), String(this.levels)],
      [t('stat.stars'), `${this.starsSession} ★`],
      [t('stat.bonus'), String(this.bonus)],
      [t('stat.chain'), String(this.bestChain)],
      [t('stat.bumps'), String(this.bumpsAll)],
      [t('stat.rainbows'), String(this.rainbows)],
    ];
    const hl: string[] = [];
    hl.push(t('hl.closing', { n: p.level }));
    if (this.pairs > this.bestBefore && this.bestBefore > 0) hl.push(t('hl.record', { n: this.pairs }));
    else if (this.bestBefore > this.pairs && this.bestBefore - this.pairs <= 6) hl.push(t('hl.near', { n: this.bestBefore - this.pairs }));
    if (this.threeStars) hl.push(t('hl.three', { n: this.threeStars }));
    for (const k of this.newYoung.slice(0, 2)) hl.push(t('hl.young', { young: KIND[k].young }));
    if (this.newKinds.length) hl.push(t('hl.kinds', { names: this.newKinds.map(k => KIND[k].name).join(', ') }));
    if (this.builtStage >= 0) hl.push(t('hl.home', { name: homestead(totalStars(p)).built > 0 ? stageName(this.builtStage) : '' }));
    if (this.blindShare >= 0) hl.push(t('hl.blind', { n: this.blindShare }));
    if (this.restarts) hl.push(t('hl.restart', { n: this.restarts }));
    return { score: this.pairs, unit: unit(this.pairs), record: this.pairs > this.bestBefore, stats, highlights: hl.slice(0, 6), verse: this.verse() };
  }

  /** The closing passage: what happened in the session picks it, a different one session by session. */
  private verse(): PassageId {
    if (this.restarts > 0 && this.levels > 0) return 'lam3.22-23';
    if (this.newKinds.length) return 'gen8.17';
    if (this.rainbows > 0) return inTurn(['gen9.13', 'psa36.6'], this.session);
    if (this.dovesAll > 0) return 'gen8.11';
    return inTurn(['psa36.6', 'gen9.13', 'gen8.11', 'lam3.22-23'], this.session);
  }

  /** The session's focus − rest contrast (activity %), for tests and the debug view. */
  get blockContrast(): number | null { return this.contrast.contrast; }
}

const stageName = (i: number): string => STAGES[Math.max(0, Math.min(STAGES.length - 1, i))].name;
