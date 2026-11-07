/**
 * Firmament's session, without the DOM or the canvas (so every rule is unit-tested): the saga's level
 * on its board (board.ts, levels.ts), the moves and the goal, the level's flow (story card, goal card,
 * play, Deszcz komet, the stars' tally, a gentle retry), the telescope's tools, the blocks, what the
 * band changes, Bubo's lines, the coach marks, the meta (meta.ts) and the session's numbers.
 *
 * The hands play the match-3: a drag, or a tap and a tap, swaps two neighbours; Space plays the best
 * move (keyboard play and the smoke test); arrows and Enter move a cursor and swap.  The band adds:
 *   Obserwacja (push)   after a lead-in, `level` above the threshold fills the telescope's charge
 *                       ring; a full ring puts a tool in the tray (about 8 s of good focus): the star
 *                       hammer, the ray, a shuffle, +5 moves; a held focus of 12 s makes the next one a
 *                       pulsar.  Out of moves, the next tool is +5 moves and the retry waits for it while
 *                       the ring is filling.  A full tray lets the light fall onto the board as a comet.
 *   Cisza nocy (rest)   calm brightens the sky; every few seconds of calm a falling star lands — the
 *                       first two leave comets on the board, the third brings two moves back.
 *   Zachmurzenie        every 4th Obserwacja from the 3rd session: clouds cover the lens; the tools
 *     (blind)           gathered appear at the block's end.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the charge and the stars wait; nothing is lost.  Running out of moves is a gentle retry
 * (no lives); the points stay in the session's score.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome, Headline, SignalPhase } from '../kit/types';
import { Board, MOON, freshTally, type Move, type Resolution, type Sp, type Step } from './board';
import { AIMED, TIPS, constName, toolName, type ToolKind } from './content';
import { line, pts, t, unit, type Key } from './i18n';
import { boardSpec, levelAt, starsFor, traySize, type Level, type NewThing } from './levels';
import { bestFor, lenKey, migrate, winLevel, type FirmamentProgress } from './meta';
import { RULES } from './rules';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'obs' | 'night';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
/** A level's stage: its story card, its goal card, play, the comet shower, the stars' tally, out of moves. */
export type Stage = 'story' | 'intro' | 'play' | 'shower' | 'won' | 'out';
export type Phase = 'play' | 'finale' | 'done';
/** How the telescope looks: warming up, live, waiting for the lead-in, grey without signal, clouded, the calm sky. */
export type ScopeLook = 'warm' | 'live' | 'lead' | 'grey' | 'blind' | 'rest';
/** Where a coach mark points: a cell, the goal card, the telescope, the tray, the moves. */
export type CoachAt = { cell: number } | { ui: 'goal' | 'scope' | 'tray' | 'moves' } | null;
export type Moment = 'open' | 'push' | 'rest' | 'tool' | 'star' | 'near' | 'out' | 'big' | 'hard' | 'win' | 'three' | 'moon' | 'blind' | 'special' | 'end';

export type SimEvent =
  | { type: 'resolve'; res: Resolution; via: 'swap' | 'tool' | 'shower' | 'ink'; tool?: ToolKind; at?: number }
  | { type: 'bounce'; a: number; b: number }
  | { type: 'select'; at: number }
  | { type: 'hint'; move: Move | null }
  | { type: 'arm'; slot: number; tool: ToolKind | null }
  | { type: 'toolMiss'; at: number }
  | { type: 'tool'; tool: ToolKind; slot: number; blind: boolean }
  | { type: 'toolUsed'; tool: ToolKind; at: number }
  | { type: 'changed'; at: number; id: number; sp: Sp; why: 'star' | 'light' | 'tool' }
  | { type: 'moves'; n: number; why: 'tool' | 'star' }
  | { type: 'shuffle'; moves: { id: number; to: number }[] }
  | { type: 'pulsarReady' }
  | { type: 'trayFull' }
  | { type: 'star'; n: number }
  | { type: 'story'; constellation: number; open: boolean }
  | { type: 'intro'; level: Level; attempt: number }
  | { type: 'play'; level: Level }
  | { type: 'shower'; moves: number }
  | { type: 'won'; level: Level; stars: number; gained: number; constDone: boolean }
  | { type: 'out'; level: Level; near: boolean; what: string; canUse: boolean }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; tools: ToolKind[] }
  | { type: 'say'; text: string; moment: Moment }
  | { type: 'coach'; key: Key; at: CoachAt }
  | { type: 'finale' };

const NO_EVENTS: readonly SimEvent[] = [];

// ── pure rules ───────────────────────────────────────────────────
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks.  A first-ever session opens with the warm-up "Pierwsze gwiazdy" (30 s in 5 and
 * 10 min, 20 s in 3, 6 s in a 40 s test); then Obserwacja / Cisza nocy pairs (26 ± 4 s and 22 ± 3 s,
 * scaled to end on time, jittered only when there is room) ending with a night, leaving the last 4 s
 * to the dawn.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - R.finale);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('obs', rest / 2), b('night', rest / 2)];
    }
    const night = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('obs', left - night), b('night', night)];
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
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'night' : 'obs', dur)));
  return plan;
}

/** How fast the telescope charges at a level (tools per second): nothing at or below the threshold. */
export function chargeRate(level: number): number {
  if (!(level > 0.5)) return 0;
  return (RULES.chargeLow + (1 - RULES.chargeLow) * clamp((level - 0.5) / RULES.chargeFull)) / RULES.chargeSec;
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: FirmamentProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

/** Moments that may wait for a free slot (the banner, the telegraph) and those that drop when late. */
const URGENT: readonly Moment[] = ['open', 'tool', 'near', 'out', 'win', 'three', 'hard', 'end'];
const TOOL_TURN: readonly ToolKind[] = ['hammer', 'ray', 'moves', 'hammer', 'ray', 'shuffle'];

export class FirmamentSim {
  readonly p: FirmamentProgress;
  readonly plannedSec: number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s, drawn as the light trail over the telescope */
  readonly trace = new SignalTrace(40, 0.1);
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly starLead: number;

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

  // the level
  level!: Level;
  board!: Board;
  attempt = 0;
  stage: Stage = 'intro';
  stageT = 0;
  stageLen = 0;
  storyConst = 0;
  storyOpen = false;
  movesLeft = 0;
  levelScore = 0;
  collected: number[] = [];
  /** the picture is still playing the last move (s); the hands wait */
  busyT = 0;
  private check = false;
  private lastTally: Resolution['tally'] | null = null;
  private movesThisLevel = 0;
  lastStars = 0;
  lastGained = 0;
  outNear = false;
  outWhat = '';

  // the hands
  selected = -1;
  cursor = -1;
  hint: Move | null = null;
  hintShown = false;
  private idleT = 0;
  tray: ToolKind[] = [];
  armed = -1;

  // the band
  reliable = false;
  charge = 0;
  private blindCharge = 0;
  private blindTools: ToolKind[] = [];
  look: ScopeLook = 'warm';
  /** the lens's light (0..1, 0.5 = the threshold), the hold toward a pulsar, the sky's calm */
  level01 = 0;
  hold = 0;
  nextPulsar = false;
  private holdUsed = false;
  private lastHold = 0;
  private toolTurn = 0;
  private fullWarned = false;
  sky = 0;
  private calmP = 0;
  starsBlock = 0;
  private relSec = 0;

  // talk and coach marks
  private sayQ: { moment: Moment; at: number } | null = null;
  private lastSay = -99;
  private said: Record<string, number> = {};
  private coachQ: { key: Key; at: CoachAt }[] = [];
  private lastCoach = -99;
  private specialsTold = 0;
  private opened = false;
  /** the last level that ran out of moves close to its goal ("Poziom 4: 2 chmury"), for the summary */
  private almost: { n: number; what: string } | null = null;

  // the session's numbers
  score = 0;
  levelsWon = 0;
  starsGained = 0;
  threeStars: number[] = [];
  constsDone: number[] = [];
  bestCascade = 0;
  lastCascade = 0;
  lastCascadeT = -99;
  toolsEarned = 0;
  pulsarsEarned = 0;
  falling = 0;
  passedNights = 0;
  blindShare = -1;
  private settled = false;
  private readonly pushBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;

  constructor(init: SimInit) {
    const p = (this.p = migrate(init.progress));
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.starLead = RULES.starLead[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.firstEver = p.sessions === 0;
    this.pushBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.firstEver, init.rng);
    this.toolTurn = p.tools;
    this.tray = p.kit.slice(0, traySize(Math.floor(p.level / RULES.perConst)));
    p.kit = [];
    this.loadLevel(p.level, 0);
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'obs' && this.block.blind && this.phase === 'play'; }
  /** a sighted Obserwacja past its lead-in: the telescope answers the band */
  get sighted(): boolean { return this.block?.kind === 'obs' && !this.block.blind && this.blockT >= this.lead && this.phase === 'play'; }
  get nightBlock(): boolean { return this.block?.kind === 'night' && this.phase === 'play'; }
  get leadIn(): number { return this.lead; }
  get traySize(): number { return traySize(this.level.constellation); }
  /** the hands may move: playing, nothing in flight */
  get canMove(): boolean { return this.started && this.phase === 'play' && this.stage === 'play' && this.busyT <= 0; }
  get armedTool(): ToolKind | null { return this.armed >= 0 ? this.tray[this.armed] ?? null : null; }
  /** the way to the calm sky's next falling star (0..1; 1 when the block's last has fallen) */
  get starProgress(): number {
    return this.starsBlock >= RULES.starMax ? 1 : clamp((this.calmP - RULES.starEvery * this.starsBlock) / RULES.starEvery);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
    this.openLevel(true);
  }

  // ── the level ───────────────────────────────────────────────────
  private loadLevel(index: number, attempt: number): void {
    this.level = levelAt(index);
    this.attempt = attempt;
    this.board = new Board(boardSpec(this.level, attempt));
    this.movesLeft = this.level.moves;
    this.levelScore = 0;
    this.collected = new Array<number>(this.board.kinds).fill(0);
    this.busyT = 0;
    this.check = false;
    this.selected = -1;
    this.hint = null;
    this.hintShown = false;
    this.idleT = 0;
    this.armed = -1;
    this.movesThisLevel = 0;
  }

  /** The level's cards: its constellation's story the first time there, then the goal card. */
  private openLevel(first: boolean): void {
    const c = this.level.constellation;
    if (first && this.firstEver && !this.p.story.includes(0)) {
      this.p.story.push(0);
      this.setStage('story', RULES.storySec);
      this.storyConst = 0;
      this.storyOpen = true;
      this.emit({ type: 'story', constellation: 0, open: true });
      return;
    }
    if (this.attempt === 0 && !this.p.story.includes(c)) {
      this.p.story.push(c);
      this.setStage('story', RULES.storySec);
      this.storyConst = c;
      this.storyOpen = false;
      this.emit({ type: 'story', constellation: c, open: false });
      return;
    }
    this.toIntro();
  }

  private toIntro(): void {
    this.setStage('intro', RULES.introSec);
    this.emit({ type: 'intro', level: this.level, attempt: this.attempt });
    if (this.level.hard && this.attempt === 0) this.say('hard', true);
  }

  private toPlay(): void {
    this.setStage('play', 0);
    this.emit({ type: 'play', level: this.level });
    if (!this.opened) { this.opened = true; this.say('open', true); }
    // the first things worth a word
    const m = this.board.findMoves()[0];
    if (m) this.coach('hint.swap', { cell: m.a });
    for (const f of this.level.fresh) this.coach(`hint.${f}` as Key, this.freshAt(f));
  }

  private freshAt(f: NewThing): CoachAt {
    const B = this.board;
    const find = (pred: (i: number) => boolean): CoachAt => {
      for (let i = 0; i < B.n; i++) if (pred(i)) return { cell: i };
      return { ui: 'goal' };
    };
    switch (f) {
      case 'clouds': return find(i => B.cloud[i] > 0);
      case 'moons': return find(i => B.cells[i]?.kind === MOON);
      case 'rocks': return find(i => B.rock[i] > 0);
      case 'locks': return find(i => B.lock[i] > 0);
      case 'ink': return find(i => B.ink[i] > 0);
      case 'hard': return { ui: 'scope' };
      default: return { ui: 'goal' };
    }
  }

  private setStage(s: Stage, len: number): void {
    this.stage = s;
    this.stageT = 0;
    this.stageLen = len;
  }

  /** How much of the goal is left (0: done); for collect, the sum over the kinds. */
  goalLeft(): number {
    const l = this.level, B = this.board;
    switch (l.goal) {
      case 'score': return Math.max(0, l.n - this.levelScore);
      case 'clouds': return B.cloudLeft;
      case 'moons': return B.moonsLeft;
      case 'rocks': return B.rocksLeft;
      case 'collect': return l.want.reduce((s, w) => s + Math.max(0, w.n - (this.collected[w.of] ?? 0)), 0);
    }
  }

  /** One kind's part of a collect goal still to go. */
  wantLeft(of: number): number {
    const w = this.level.want.find(x => x.of === of);
    return w ? Math.max(0, w.n - (this.collected[of] ?? 0)) : 0;
  }

  get goalDone(): boolean { return this.goalLeft() === 0; }

  /** What was still missing, in words ("3 chmury"). */
  private missing(): string {
    const n = this.goalLeft(), l = this.level;
    switch (l.goal) {
      case 'score': return pts(n);
      case 'clouds': return t('left.clouds', { n });
      case 'moons': return t('left.moons', { n });
      case 'rocks': return t('left.rocks', { n });
      case 'collect': return t('left.bodies', { n });
    }
  }

  private apply(res: Resolution, via: 'swap' | 'tool' | 'shower' | 'ink', extra: { tool?: ToolKind; at?: number } = {}): void {
    this.score += res.tally.points;
    this.levelScore += res.tally.points;
    res.tally.kinds.forEach((n, k) => { this.collected[k] = (this.collected[k] ?? 0) + n; });
    this.bestCascade = Math.max(this.bestCascade, res.tally.cascades);
    if (res.tally.cascades >= 3 || res.tally.combo) {
      this.lastCascade = res.tally.cascades;
      this.lastCascadeT = this.t;
    }
    this.busyT = Math.max(this.busyT, res.dur);
    if (via !== 'shower') this.check = true;
    this.lastTally = via === 'swap' ? res.tally : this.lastTally;
    this.selected = -1;
    this.hint = null;
    this.hintShown = false;
    this.idleT = 0;
    this.emit({ type: 'resolve', res, via, ...extra });
    if (res.shuffle) this.emit({ type: 'shuffle', moves: res.shuffle });
    // what deserves a word
    if (via !== 'shower') {
      if (res.tally.cascades >= 4 || (res.tally.combo && res.tally.combo !== 'pulsar')) this.say('big');
      else if (res.tally.moons > 0) this.say('moon');
      const born = res.steps.flatMap(s => s.born);
      if (born.length && this.specialsTold < 2) {
        this.specialsTold++;
        this.say('special');
      }
      for (const b of born) {
        if (b.sp === 'meteor') this.coach('hint.meteor', { cell: b.at });
        else if (b.sp === 'row' || b.sp === 'col') this.coach('hint.special', { cell: b.at });
      }
    }
  }

  /** A move has landed: ink spreads if it was not touched, the goal is checked, the moves are counted. */
  private afterMove(): void {
    this.check = false;
    if (this.stage !== 'play') return;
    if (this.lastTally && this.board.inkLeft > 0 && this.lastTally.inks === 0) {
      const st = this.board.spreadInk();
      this.lastTally = null;
      if (st) {
        const res: Resolution = { ok: true, steps: [st], tally: freshTally(this.board.kinds), swap: null, shuffle: this.board.hasMove() ? null : this.board.reshuffle(), dur: st.dur };
        this.apply(res, 'ink');
        this.check = true;
        return;
      }
    }
    this.lastTally = null;
    if (this.level.goal === 'score') {
      // a score level plays every move (Candy Crush's moves levels), then the target is checked
      if (this.movesLeft <= 0) { if (this.goalDone) this.toShower(); else this.toOut(); }
      else if (this.movesLeft === 3) this.coach('hint.last', { ui: 'moves' });
      return;
    }
    if (this.goalDone) this.toShower();
    else if (this.movesLeft <= 0) this.toOut();
    else if (this.movesLeft === 3) this.coach('hint.last', { ui: 'moves' });
  }

  /** The goal is met: Deszcz komet — specials left fire, every move left becomes a comet. */
  private toShower(): void {
    const moves = this.movesLeft;
    this.setStage('shower', 0);
    this.emit({ type: 'shower', moves });
    const res = this.board.celebrate(moves);
    this.movesLeft = 0;
    this.apply(res, 'shower');
  }

  private win(): void {
    const l = this.level;
    const stars = starsFor(l, this.levelScore);
    const gained = winLevel(this.p, l.index, stars);
    this.p.won = Math.max(this.p.won, l.index + 1);
    this.lastStars = stars;
    this.lastGained = gained;
    this.levelsWon++;
    this.starsGained += gained;
    if (stars === 3 && !this.threeStars.includes(l.index)) this.threeStars.push(l.index);
    const constDone = l.star === RULES.perConst - 1;
    if (constDone && !this.constsDone.includes(l.constellation)) this.constsDone.push(l.constellation);
    this.setStage('won', RULES.wonSec);
    this.emit({ type: 'won', level: l, stars, gained, constDone });
    this.say(stars === 3 ? 'three' : 'win', true);
  }

  private toOut(): void {
    const left = this.goalLeft(), l = this.level;
    const all = l.goal === 'score' ? l.n : Math.max(1, l.n);
    this.outNear = left / all <= 0.25 || (l.goal !== 'score' && left <= 3);
    this.outWhat = this.missing();
    if (this.outNear) this.almost = { n: l.index + 1, what: this.outWhat };
    this.setStage('out', RULES.outSec);
    this.armed = -1;
    this.emit({ type: 'out', level: l, near: this.outNear, what: this.outWhat, canUse: this.tray.includes('moves') });
    this.say(this.outNear ? 'near' : 'out', true);
  }

  /** Out of moves: the +5 from the tray (true when there was one). */
  useOutMoves(): boolean {
    if (this.stage !== 'out') return false;
    const k = this.tray.indexOf('moves');
    if (k < 0) return false;
    this.tray.splice(k, 1);
    this.armed = -1;
    this.movesLeft += RULES.toolMoves;
    this.setStage('play', 0);
    this.emit({ type: 'toolUsed', tool: 'moves', at: -1 });
    this.emit({ type: 'moves', n: RULES.toolMoves, why: 'tool' });
    return true;
  }

  /** Out of moves: a new sky for the same level (the points stay in the session). */
  retry(): void {
    if (this.stage !== 'out') return;
    this.loadLevel(this.level.index, this.attempt + 1);
    this.toIntro();
  }

  /** A card's tap (or Space): skip the story or the goal card, the tally; out of moves: +5 or retry. */
  advance(): void {
    if (!this.started || this.phase !== 'play') return;
    switch (this.stage) {
      case 'story': if (this.stageT >= RULES.cardMin + 0.3) this.toIntro(); break;
      case 'intro': if (this.stageT >= RULES.cardMin) this.toPlay(); break;
      case 'won': if (this.stageT >= RULES.cardMin + 0.6 && this.busyT <= 0) this.nextLevel(); break;
      case 'out': if (this.stageT >= RULES.outMin) { if (!this.useOutMoves()) this.retry(); } break;
      default: break;
    }
  }

  private nextLevel(): void {
    this.loadLevel(this.level.index + 1, 0);
    this.openLevel(false);
  }

  private stageTick(dt: number): void {
    this.stageT += dt;
    if (this.check && this.busyT <= 0) this.afterMove();
    switch (this.stage) {
      case 'story': if (this.stageT >= this.stageLen) this.toIntro(); break;
      case 'intro': if (this.stageT >= this.stageLen) this.toPlay(); break;
      case 'shower': if (this.busyT <= 0) this.win(); break;
      case 'won': if (this.busyT <= 0 && this.stageT >= this.stageLen && this.phase === 'play') this.nextLevel(); break;
      case 'out': {
        // the telescope almost full in a push block: the retry waits for the +5
        const wait = this.sighted && this.charge >= 0.4 && !this.tray.includes('moves') ? 4 : 0;
        if (this.tray.includes('moves') && this.stageT >= this.stageLen + wait) this.useOutMoves();
        else if (this.stageT >= this.stageLen + wait && this.phase === 'play') this.retry();
        break;
      }
      default: break;
    }
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A tap (or Enter) on a cell: use the armed tool, select, deselect, or swap with the selected neighbour. */
  tap(at: number): void {
    if (!this.started || this.phase !== 'play') return;
    if (this.stage !== 'play') { this.advance(); return; }
    const B = this.board;
    if (at < 0 || at >= B.n || !B.mask[at]) { this.select(-1); return; }
    this.cursor = at;
    const tool = this.armedTool;
    if (tool && AIMED.includes(tool)) {
      if (this.busyT > 0) return;
      this.useAimed(tool, at);
      return;
    }
    if (this.selected === at) this.select(-1);
    else if (this.selected >= 0 && B.adjacent(this.selected, at)) this.trySwap(this.selected, at);
    else this.select(B.free(at) ? at : -1);
  }

  private useAimed(tool: ToolKind, at: number): void {
    const B = this.board;
    if (tool === 'pulsar') {
      const ch = B.makeSpecial(at, 'pulsar');
      if (!ch) { this.emit({ type: 'toolMiss', at }); return; }
      this.consumeArmed(tool, at);
      this.emit({ type: 'changed', at, id: ch.id, sp: 'pulsar', why: 'tool' });
      this.hint = null;
      this.hintShown = false;
      return;
    }
    const res = tool === 'hammer' ? B.hammer(at) : B.ray(at);
    if (!res) { this.emit({ type: 'toolMiss', at }); return; }
    this.consumeArmed(tool, at);
    this.apply(res, 'tool', { tool, at });
  }

  private consumeArmed(tool: ToolKind, at: number): void {
    this.tray.splice(this.armed, 1);
    this.armed = -1;
    this.emit({ type: 'toolUsed', tool, at });
  }

  private select(at: number): void {
    if (this.selected === at) return;
    this.selected = at;
    this.emit({ type: 'select', at });
  }

  /** Swap two neighbours (a drag, a tap and a tap, the hint): a move when it lands, a free bounce when not. */
  trySwap(a: number, b: number): void {
    if (!this.canMove) return;
    this.armed = -1;
    const res = this.board.swap(a, b);
    this.selected = -1;
    if (!res.ok) {
      this.busyT = res.dur;
      this.emit({ type: 'bounce', a, b });
      return;
    }
    this.movesLeft--;
    this.movesThisLevel++;
    this.apply(res, 'swap');
    if (this.movesThisLevel === 1) this.coach('hint.goal', { ui: 'goal' });
    if (this.movesThisLevel === 4) this.coach('hint.space', null);
  }

  /** Space: play the best move (and on a card, go on). */
  space(): void {
    if (!this.started || this.phase !== 'play') return;
    if (this.stage !== 'play') { this.advance(); return; }
    if (!this.canMove) return;
    const m = this.hint && this.board.swapValue(this.hint.a, this.hint.b) > 0 ? this.hint : this.board.findMoves()[0];
    if (m) this.trySwap(m.a, m.b);
  }

  private showHint(): void {
    this.hint = this.board.findMoves()[0] ?? null;
    this.hintShown = true;
    this.emit({ type: 'hint', move: this.hint });
  }

  /** Tap a tool in the tray: an aimed one is armed (again: put back); +5 moves and the shuffle act at once. */
  pickTool(slot: number): void {
    if (!this.started || this.phase !== 'play') return;
    if (slot < 0 || slot >= this.tray.length) return;
    const tool = this.tray[slot];
    if (tool === 'moves') {
      if (this.stage === 'out') { this.useOutMoves(); return; }
      if (this.stage !== 'play') return;
      this.tray.splice(slot, 1);
      this.armed = -1;
      this.movesLeft += RULES.toolMoves;
      this.emit({ type: 'toolUsed', tool, at: -1 });
      this.emit({ type: 'moves', n: RULES.toolMoves, why: 'tool' });
      return;
    }
    if (this.stage !== 'play') return;
    if (tool === 'shuffle') {
      if (this.busyT > 0) return;
      this.tray.splice(slot, 1);
      this.armed = -1;
      const moves = this.board.shuffleNow();
      this.busyT = 0.5;
      this.hint = null;
      this.hintShown = false;
      this.emit({ type: 'toolUsed', tool, at: -1 });
      this.emit({ type: 'shuffle', moves });
      return;
    }
    this.armed = this.armed === slot ? -1 : slot;
    this.selected = -1;
    this.emit({ type: 'arm', slot: this.armed, tool: this.armedTool });
  }

  /** Arrows move the cursor, Enter taps it, Space plays the best move, 1–4 pick a tool, Escape lets go. */
  key(key: string, down: boolean): boolean {
    const dirs: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (key in dirs) {
      if (!down) return true;
      const B = this.board;
      if (this.cursor < 0) this.cursor = this.selected >= 0 ? this.selected : B.at(Math.floor(B.rows / 2), Math.floor(B.cols / 2) - 1);
      else {
        const [dr, dc] = dirs[key];
        const r = clamp(B.r(this.cursor) + dr, 0, B.rows - 1), c = clamp(B.c(this.cursor) + dc, 0, B.cols - 1);
        this.cursor = B.at(r, c);
      }
      this.idleT = 0;
      return true;
    }
    if (key === ' ' || key === 'Spacebar') {
      if (down) this.space();
      return true;
    }
    if (key === 'Enter') {
      if (down) { if (this.stage !== 'play') this.advance(); else if (this.cursor >= 0) this.tap(this.cursor); }
      return true;
    }
    if (key >= '1' && key <= '4') {
      if (down) this.pickTool(Number(key) - 1);
      return true;
    }
    if (key === 'Escape') {
      if (down) { this.armed = -1; this.select(-1); }
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
    this.busyT = Math.max(0, this.busyT - dt);
    this.brain(dt, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    this.stageTick(dt);
    this.idleT += dt;
    if (this.stage === 'play' && this.busyT <= 0 && !this.hintShown && (this.nightBlock || this.idleT >= RULES.idleHint)) this.showHint();
    this.talkTick();
    if (this.phase === 'finale' && this.phaseT >= RULES.finale && this.busyT <= 0) {
      this.phase = 'done';
      this.settle();
    }
  }

  /** The band's slow quantities: the charge and the hold in Obserwacja, the sky and its falling stars in the night. */
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    this.reliable = f.reliable;
    const play = this.phase === 'play';
    if (play && f.reliable) this.relSec += dt;
    const obs = play && b.kind === 'obs';
    const acting = obs && this.blockT >= this.lead;
    this.look = !play || b.kind === 'warmup' ? 'warm' : b.kind === 'night' ? 'rest' : b.blind ? 'blind' : !f.reliable ? 'grey' : acting ? 'live' : 'lead';
    this.level01 = approach(this.level01, f.reliable ? f.level : 0.5, dt, 0.3);
    const phase: TracePhase = !play ? 'free' : b.kind === 'obs' ? 'focus' : b.kind === 'night' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    if (acting && f.reliable) {
      const gain = chargeRate(f.level) * dt;
      if (b.blind) {
        this.blindCharge += gain;
        while (this.blindCharge >= 1) {
          this.blindCharge -= 1;
          this.blindTools.push(this.chooseTool());
        }
      } else {
        this.charge += gain;
        while (this.charge >= 1) {
          if (this.tray.length >= this.traySize) {
            // a full tray: the light falls onto the board as a comet (never wasted)
            if (this.stage === 'play' && this.busyT <= 0) {
              const g = this.board.gift(this.toolTurn++ % 2 ? 'row' : 'col');
              if (g) {
                this.charge -= 1;
                this.hint = null;
                this.hintShown = false;
                this.emit({ type: 'changed', at: g.at, id: g.id, sp: g.sp, why: 'light' });
                continue;
              }
            }
            this.charge = 1;
            if (!this.fullWarned) { this.fullWarned = true; this.emit({ type: 'trayFull' }); }
            break;
          }
          this.charge -= 1;
          this.earn(this.chooseTool(), false);
        }
      }
    }
    if (this.tray.length < this.traySize) this.fullWarned = false;
    if (acting && f.reliable && !b.blind && this.blockT >= this.lead + 0.5) this.coach('hint.scope', { ui: 'scope' });
    // twelve seconds of held focus make the next tool a pulsar
    this.hold = acting && f.reliable && !b.blind ? f.hold : 0;
    if (f.hold < this.lastHold - 0.5) this.holdUsed = false;
    this.lastHold = f.hold;
    if (acting && f.reliable && !b.blind && f.hold >= R.pulsarHold && !this.holdUsed && !this.nextPulsar) {
      this.holdUsed = true;
      this.nextPulsar = true;
      this.emit({ type: 'pulsarReady' });
    }
    // the calm sky: calm brightens it; falling stars land
    const night = play && b.kind === 'night';
    this.sky = approach(this.sky, night ? (f.reliable ? f.calm : this.sky) : 0, dt, R.skyTau);
    if (night && this.blockT >= this.starLead && f.reliable) {
      this.calmP += f.calm * dt;
      if (this.calmP >= R.starEvery * (this.starsBlock + 1) && this.starsBlock < R.starMax && this.stage === 'play' && this.busyT <= 0) this.fallingStar();
    }
  }

  private fallingStar(): void {
    this.starsBlock++;
    this.falling++;
    this.emit({ type: 'star', n: this.starsBlock });
    if (this.starsBlock >= RULES.starMax) {
      this.movesLeft += RULES.starMoves;
      this.emit({ type: 'moves', n: RULES.starMoves, why: 'star' });
    } else {
      const g = this.board.gift(this.starsBlock === 1 ? 'row' : 'col');
      if (g) {
        this.hint = null;
        this.hintShown = false;
        this.emit({ type: 'changed', at: g.at, id: g.id, sp: g.sp, why: 'star' });
      }
    }
    this.say('star');
  }

  /** The next tool: a pulsar after a long hold, +5 moves when they run low, else in turn. */
  private chooseTool(): ToolKind {
    if (this.nextPulsar) {
      this.nextPulsar = false;
      return 'pulsar';
    }
    const has = (k: ToolKind) => this.tray.includes(k) || this.blindTools.includes(k);
    if ((this.stage === 'out' || this.movesLeft <= 5) && !has('moves')) return 'moves';
    for (let k = 0; k < TOOL_TURN.length; k++) {
      const pick = TOOL_TURN[this.toolTurn++ % TOOL_TURN.length];
      if ((pick === 'shuffle' || pick === 'moves') && has(pick)) continue;
      return pick;
    }
    return 'hammer';
  }

  private earn(tool: ToolKind, blind: boolean): void {
    this.tray.push(tool);
    this.toolsEarned++;
    this.p.tools++;
    if (tool === 'pulsar') {
      this.pulsarsEarned++;
      this.p.pulsars++;
    }
    this.emit({ type: 'tool', tool, slot: this.tray.length - 1, blind });
    this.say('tool', true);
    this.coach('hint.tool', { ui: 'tray' });
  }

  // ── Bubo and the coach marks ────────────────────────────────────
  /** Bubo wants to say something; it waits for a free moment (never over the banner or the telegraph). */
  private say(moment: Moment, urgent = URGENT.includes(moment)): void {
    if (this.sayQ && URGENT.includes(this.sayQ.moment) && !urgent) return;
    this.sayQ = { moment, at: this.t };
  }

  /** Is the screen's top free for a bubble: not in a block's first seconds (the banner), not in its telegraph. */
  get quiet(): boolean {
    const b = this.block;
    if (!b || this.phase !== 'play') return true;
    return this.blockT >= 5 && this.blockT < b.dur - RULES.telegraph;
  }

  private talkTick(): void {
    const q = this.sayQ;
    if (q && this.quiet) {
      const urgent = URGENT.includes(q.moment);
      if (urgent || this.t - this.lastSay >= 7) {
        const n = this.said[q.moment] ?? 0;
        this.said[q.moment] = n + 1;
        const text = line(q.moment, this.session + n);
        this.sayQ = null;
        this.lastSay = this.t;
        if (text) this.emit({ type: 'say', text, moment: q.moment });
      } else if (this.t - q.at > 6) this.sayQ = null;
    } else if (q && this.t - q.at > 9) this.sayQ = null;
    // coach marks: one at a time, a few seconds apart, never in a card
    if (this.coachQ.length && this.stage === 'play' && this.t - this.lastCoach >= 4) {
      const c = this.coachQ.shift()!;
      this.lastCoach = this.t;
      this.emit({ type: 'coach', key: c.key, at: c.at });
    }
  }

  /** A coach mark, once ever (the first session teaches the controls; later ones only what is new). */
  private coach(key: Key, at: CoachAt): void {
    if (this.p.seen.includes(key)) return;
    this.p.seen.push(key);
    this.coachQ.push({ key, at });
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'obs' ? 'focus' : 'rest';
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
    if (b.kind === 'obs') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.blindCharge = 0;
      this.blindTools = [];
      this.say(b.blind ? 'blind' : 'push');
    } else if (b.kind === 'night') {
      this.calmP = 0;
      this.starsBlock = 0;
      this.say('rest');
      this.coach('hint.rest', { ui: 'scope' });
    }
    if (b.kind !== 'night' && this.hintShown && this.idleT < RULES.idleHint) {
      this.hintShown = false;
      this.hint = null;
    }
    this.tip = this.tipFor(b, i);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  /** The block's strategy (what to do in the head): signal() hands it to the runner's panel and banner. */
  private tipFor(b: Block, i: number): string {
    if (b.kind === 'warmup') return t(TIPS.warmup[0]);
    if (b.kind === 'obs') {
      if (b.blind) return t(TIPS.blind[(this.session + i) % TIPS.blind.length]);
      return t(TIPS.obs[(this.session - 1 + i) % TIPS.obs.length]);
    }
    return t(TIPS.night[(this.session - 1 + i) % TIPS.night.length]);
  }

  /** The block's end: its verdict, and what a blind block hid. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0, need = 0;
    const tools: ToolKind[] = [];
    if (b.kind !== 'warmup') {
      const want = b.kind === 'obs' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'night' && verdict) this.passedNights++;
      if (b.blind) {
        this.trace.unveil(this.t);
        this.blindShare = Math.max(this.blindShare, Math.round((this.judge.measured > 0 ? share : 0) * 100));
        for (const tool of this.blindTools) {
          if (this.tray.length >= this.traySize) break;
          this.earn(tool, true);
          tools.push(tool);
        }
        this.charge = Math.min(1, this.charge + this.blindCharge);
        this.blindTools = [];
        this.blindCharge = 0;
      }
    }
    this.p.pushes = Math.max(this.p.pushes, this.pushBase + this.pushesBegun);
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, tools });
  }

  // ── the dawn ────────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.armed = -1;
    this.selected = -1;
    this.hintShown = false;
    this.sayQ = null;
    this.emit({ type: 'finale' });
    const text = line('end', this.session);
    this.lastSay = this.t;
    this.emit({ type: 'say', text, moment: 'end' });
  }

  /** The session is settled once — at the dawn, or when it ends early: the counters reach the progress. */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p;
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushBase + this.pushesBegun);
    p.total += this.score;
    p.bestCascade = Math.max(p.bestCascade, this.bestCascade);
    p.lastLen = this.plannedSec;
    p.kit = this.tray.slice(0, RULES.carry);
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

  /** What the block asks of the brain, for the runner's panel, banner and dock. */
  signal(): SignalPhase {
    const b = this.block;
    if (!this.started || this.phase !== 'play' || !b) return { want: 'free', blind: false };
    const left = Math.max(0, b.dur - this.blockT);
    const nb = this.next;
    const next = this.telegraphed ? (nb ? (nb.kind === 'obs' ? 'focus' : nb.kind === 'night' ? 'rest' : 'free') : 'free') : null;
    if (b.kind === 'warmup') return { want: 'free', blind: false, task: this.tip, left, next };
    return { want: b.kind === 'obs' ? 'focus' : 'rest', blind: this.blind, task: this.tip, left, next };
  }

  /** The panel's gauge: the lens's light in Obserwacja (0.5 = the threshold), the sky's calm in the night; null when blind or without signal. */
  meter(): number | null {
    if (!this.started || !this.reliable) return null;
    const b = this.block;
    if (this.phase !== 'play' || !b) return null;
    if (b.kind === 'night') return clamp(this.sky);
    if (this.blind) return null;
    return clamp(this.level01);
  }

  headline(): Headline {
    const recent = this.t - this.lastCascadeT < 2.5 && this.lastCascade >= 3;
    return { value: this.score, sub: recent ? t('sub.cascade', { n: this.lastCascade }) : t('sub.level', { n: this.level.index + 1 }) };
  }

  /** The pad follows the level in a sighted Obserwacja, glows mid in the warm-up and holds still elsewhere. */
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
      p.bestCascade = Math.max(p.bestCascade, this.bestCascade);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.levels'), String(this.levelsWon)],
      [t('stat.stars'), `+${this.starsGained}`],
      [t('stat.level'), String(p.level + 1)],
      [t('stat.cascade'), `×${this.bestCascade}`],
      [t('stat.tools'), String(this.toolsEarned)],
      [t('stat.falling'), String(this.falling)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: a
   * constellation complete, three stars, a pulsar, a long cascade, a tool from the telescope, a
   * passed night, falling stars; else Genesis 1:16, Psalm 19:1 or Psalm 147:4.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.constsDone.length) fit.push('isa40.26');
    if (this.threeStars.length) fit.push('gen15.5');
    if (this.pulsarsEarned > 0) fit.push('dan12.3');
    if (this.bestCascade >= 5) fit.push('job38.7');
    if (this.toolsEarned > 0) fit.push('1co15.41');
    if (this.passedNights > 0) fit.push('jer31.35');
    if (this.falling > 0) fit.push('php2.15');
    fit.push('gen1.16', 'psa19.1', 'psa147.4');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    for (const c of this.constsDone) add(0, t('hl.const', { name: constName(c) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(1, t('hl.record', { pts: pts(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.score >= this.bestBefore * 0.7) add(1, t('hl.near', { pts: pts(this.bestBefore - this.score) }));
    if (this.threeStars.length) add(2, t('hl.three', { n: this.threeStars[this.threeStars.length - 1] + 1 }));
    if (this.pulsarsEarned) add(3, t('hl.pulsar'));
    if (this.toolsEarned) add(4, t('hl.tools', { n: this.toolsEarned }));
    if (this.bestCascade >= 4) add(5, t('hl.cascade', { n: this.bestCascade }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { n: this.blindShare }));
    if (this.almost && this.almost.n > this.p.won) add(2, t('hl.almost', { n: this.almost.n, what: this.almost.what }));
    const top = notes.sort((a, b) => a.rank - b.rank).slice(0, 4).map(n => n.text);
    top.push(t('hl.bubo', { line: line('end', this.session) }));
    return top;
  }

  /** For the view: the tool's name. */
  toolName(k: ToolKind): string { return toolName(k); }
}

export type { Step };
