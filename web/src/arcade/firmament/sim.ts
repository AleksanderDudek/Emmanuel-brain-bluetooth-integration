/**
 * Firmament's session, without the DOM or the canvas (so every rule is unit-tested): the saga's
 * level on its board (board.ts, levels.ts), the moves and the goals, the instruments in the tray,
 * the blocks, what the band changes, the rescue, the meta (meta.ts) and the session's numbers.  All
 * numbers are in rules.ts (re-exported here).
 *
 * The hands play the match-3: a drag or a tap and a tap swaps two neighbours, Space shows the best
 * move and a second Space plays it, the arrows and Enter move a cursor and swap.  The band only adds:
 *   Obserwacja (push)   after a lead-in, `level` above the threshold gathers light into the
 *                       telescope's lens; a full lens (about 8 s of good focus) puts an instrument in
 *                       the tray; a held focus of 12 s makes the next one a pulsar.  Using one is
 *                       touch: tap it, then a cell — it costs no move.
 *   Cisza nocy (rest)   calm brightens the sky; every few seconds of calm a falling star turns a body
 *                       into a comet (a gift), and the best move glows.
 *   Zachmurzenie        every 4th Obserwacja from the 3rd session: clouds cover the lens and the
 *     (blind)           trace; the instruments gathered appear at the block's end.
 *   Ratunek             out of moves, once per attempt: six seconds of the block's own state (focus
 *                       above the threshold in a push block, calm below it otherwise) give five more.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the lens and the stars wait; nothing is lost.  A lost level simply starts again (its
 * points stay in the session's score); the session clock keeps running.
 *
 * The headline is the points this session, counted the moment a move lands.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { Board, type Move, type Resolution, type Sp, type ToolKind } from './board';
import { TIPS, TOOL_NAME, constName } from './content';
import { pts, t, unit } from './i18n';
import { boardSpec, levelAt, toolsFor, traySize, type Goal, type Level } from './levels';
import { bestFor, lenKey, winLevel, type FirmamentProgress } from './meta';
import { RULES } from './rules';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'obs' | 'night';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
/** A level's stage: playing, the rescue's window, the won card (the bonus comets fly), the lost card. */
export type Stage = 'play' | 'rescue' | 'won' | 'lost';
export type Phase = 'play' | 'finale' | 'done';
/** How the lens looks: the warm-up's, live in a sighted Obserwacja, waiting for the lead-in, grey without signal, clouded, the night's. */
export type LensLook = 'warm' | 'live' | 'lead' | 'grey' | 'blind' | 'rest';

export type SimEvent =
  | { type: 'resolve'; res: Resolution; via: 'swap' | 'free' | 'tool' | 'bonus'; tool?: ToolKind; at?: number }
  | { type: 'bounce'; a: number; b: number }
  | { type: 'select'; at: number }
  | { type: 'hint'; move: Move | null }
  | { type: 'arm'; slot: number; tool: ToolKind | null }
  | { type: 'toolMiss'; at: number }
  | { type: 'instrument'; tool: ToolKind; slot: number; blind: boolean }
  | { type: 'pulsarReady' }
  | { type: 'trayFull' }
  | { type: 'falling'; at: number; id: number; sp: Sp }
  | { type: 'rescueOpen'; want: 'focus' | 'calm' }
  | { type: 'rescue'; moves: number }
  | { type: 'won'; level: Level; stars: number; gained: number; constDone: boolean; bonus: number }
  | { type: 'lost'; level: Level }
  | { type: 'level'; level: Level; attempt: number; newTools: ToolKind[] }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged window's share on the asked side and the share it needed; the block's span of play time */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number; tools: ToolKind[] }
  | { type: 'gift'; tool: ToolKind }
  | { type: 'finale' };

const NO_EVENTS: readonly SimEvent[] = [];

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
 * The session's blocks.  A first-ever session opens with the warm-up "Pierwsze gwiazdy" (30 s in 5
 * and 10 min, 20 s in 3, 6 s in a 40 s test); then Obserwacja / Cisza nocy pairs (26 ± 4 s and
 * 22 ± 3 s, scaled to end on time, jittered only when there is room) ending with a night, leaving
 * the last 4 s to the dawn.  No block under 12 s.
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

/** How fast the lens fills at a level (lenses per second): nothing at or below the threshold. */
export function lensRate(level: number): number {
  if (!(level > 0.5)) return 0;
  return (RULES.lensLow + (1 - RULES.lensLow) * clamp((level - 0.5) / RULES.lensFull)) / RULES.lensSec;
}

/** One, two or three stars for a won level: the goals give one, the score the others. */
export const starsFor = (l: Level, score: number): number => 1 + (score >= l.stars[0] ? 1 : 0) + (score >= l.stars[1] ? 1 : 0);

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: FirmamentProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export class FirmamentSim {
  readonly p: FirmamentProgress;
  readonly plannedSec: number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s, drawn as the Milky Way across the top of the sky */
  readonly trace = new SignalTrace(40, 0.1);
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly starLead: number;

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

  // the level
  level!: Level;
  board!: Board;
  attempt = 0;
  stage: Stage = 'play';
  stageT = 0;
  movesLeft = 0;
  levelScore = 0;
  collected: number[] = [];
  rescueUsed = false;
  rescueT = 0;
  rescueP = 0;
  rescueWant: 'focus' | 'calm' = 'focus';
  /** the picture is still playing the last move (s); the hands wait */
  busyT = 0;
  private check = false;
  private celebrated = false;

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
  lens = 0;
  private blindLens = 0;
  private blindTools: ToolKind[] = [];
  lensLook: LensLook = 'warm';
  /** the live level the lens shows (0..1), the hold toward a pulsar, the sky's brightness in the night */
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

  // the session's numbers
  score = 0;
  levelsWon = 0;
  starsGained = 0;
  threeStars: number[] = [];
  constsDone: number[] = [];
  bestCascade = 0;
  toolsEarned = 0;
  pulsarsEarned = 0;
  falling = 0;
  rescues = 0;
  passedNights = 0;
  blindShare = -1;
  giftTool: ToolKind | null = null;
  private settled = false;
  private readonly pushBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.starLead = RULES.starLead[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.pushBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.toolTurn = p.tools;
    this.startLevel(p.level, 0, false);
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'obs' && this.block.blind && this.phase === 'play'; }
  /** a sighted Obserwacja past its lead-in: the lens answers the band */
  get sighted(): boolean { return this.block?.kind === 'obs' && !this.block.blind && this.blockT >= this.lead && this.phase === 'play'; }
  get nightBlock(): boolean { return this.block?.kind === 'night' && this.phase === 'play'; }
  get leadIn(): number { return this.lead; }
  get traySize(): number { return traySize(this.level.constellation); }
  /** the hands may move: playing, nothing in flight */
  get canMove(): boolean { return this.started && this.phase === 'play' && this.stage === 'play' && this.busyT <= 0; }
  get armedTool(): ToolKind | null { return this.armed >= 0 ? this.tray[this.armed] ?? null : null; }
  /** the way to the night's next falling star (0..1; 1 when the block's last has fallen) */
  get starProgress(): number {
    return this.starsBlock >= RULES.starMax ? 1 : clamp((this.calmP - RULES.starEvery * this.starsBlock) / RULES.starEvery);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    if (RULES.giftDay && this.p.giftDay !== this.init.day) {
      this.p.giftDay = this.init.day;
      this.giftTool = 'comet';
      this.tray.push('comet');
      this.emit({ type: 'gift', tool: 'comet' });
    }
    this.startBlock(0);
    this.emit({ type: 'level', level: this.level, attempt: this.attempt, newTools: [] });
  }

  // ── the level ───────────────────────────────────────────────────
  private startLevel(index: number, attempt: number, announce = true): void {
    const prev = this.level;
    this.level = levelAt(index);
    this.attempt = attempt;
    this.board = new Board(boardSpec(this.level, attempt));
    this.movesLeft = this.level.moves;
    this.levelScore = 0;
    this.collected = new Array<number>(this.board.kinds).fill(0);
    this.rescueUsed = false;
    this.stage = 'play';
    this.stageT = 0;
    this.busyT = 0;
    this.check = false;
    this.celebrated = false;
    this.selected = -1;
    this.hint = null;
    this.hintShown = false;
    this.idleT = 0;
    this.armed = -1;
    if (!announce) return;
    const before = prev ? toolsFor(prev.constellation) : [];
    const newTools = toolsFor(this.level.constellation).filter(x => !before.includes(x));
    this.emit({ type: 'level', level: this.level, attempt, newTools });
  }

  /** How much of a goal is left (0: done). */
  goalLeft(g: Goal): number {
    switch (g.kind) {
      case 'score': return Math.max(0, g.n - this.levelScore);
      case 'collect': return Math.max(0, g.n - (this.collected[g.of ?? 0] ?? 0));
      case 'dust': return this.board.dustLeft;
      case 'rocks': return this.board.rocksLeft;
      case 'sats': return Math.max(0, g.n - this.board.satDown);
    }
  }

  get goalsDone(): boolean { return this.level.goals.every(g => this.goalLeft(g) === 0); }

  private apply(res: Resolution, via: 'swap' | 'free' | 'tool' | 'bonus', extra: { tool?: ToolKind; at?: number } = {}): void {
    this.score += res.tally.points;
    this.levelScore += res.tally.points;
    res.tally.kinds.forEach((n, k) => { this.collected[k] = (this.collected[k] ?? 0) + n; });
    this.bestCascade = Math.max(this.bestCascade, res.tally.cascades);
    this.busyT = Math.max(this.busyT, res.dur);
    this.check = true;
    this.selected = -1;
    this.hint = null;
    this.hintShown = false;
    this.idleT = 0;
    this.emit({ type: 'resolve', res, via, ...extra });
  }

  /** The move has landed: won, out of moves (the rescue or a restart), or on. */
  private afterMove(): void {
    this.check = false;
    if (this.stage !== 'play') return;
    if (this.goalsDone) this.win();
    else if (this.movesLeft <= 0) {
      if (!this.rescueUsed) {
        this.stage = 'rescue';
        this.stageT = 0;
        this.rescueT = 0;
        this.rescueP = 0;
        this.rescueWant = this.block?.kind === 'obs' && this.phase === 'play' ? 'focus' : 'calm';
        this.emit({ type: 'rescueOpen', want: this.rescueWant });
      } else this.lose();
    }
  }

  private win(): void {
    if (this.celebrated) return;
    this.celebrated = true;
    let bonus = 0;
    if (this.movesLeft > 0) {
      bonus = this.movesLeft * RULES.leftover;
      const res = this.board.celebrate(this.movesLeft);
      this.score += bonus;
      this.levelScore += bonus;
      this.movesLeft = 0;
      this.apply(res, 'bonus');
      this.check = false;
    }
    const l = this.level;
    const stars = starsFor(l, this.levelScore);
    const gained = winLevel(this.p, l.index, stars);
    this.levelsWon++;
    this.starsGained += gained;
    if (stars === 3 && !this.threeStars.includes(l.index)) this.threeStars.push(l.index);
    const constDone = l.star === RULES.perConst - 1;
    if (constDone && !this.constsDone.includes(l.constellation)) this.constsDone.push(l.constellation);
    this.stage = 'won';
    this.stageT = 0;
    this.emit({ type: 'won', level: l, stars, gained, constDone, bonus });
  }

  private lose(): void {
    this.stage = 'lost';
    this.stageT = 0;
    this.emit({ type: 'lost', level: this.level });
  }

  /** The rescue's "start again" (or its window ran out). */
  restart(): void {
    if (this.stage === 'rescue') this.lose();
  }

  private stageTick(dt: number, f: FocusFrame): void {
    this.stageT += dt;
    if (this.check && this.busyT <= 0) this.afterMove();
    switch (this.stage) {
      case 'rescue': {
        this.rescueT += dt;
        const ok = f.reliable && f.activity !== null && (this.rescueWant === 'focus' ? f.activity >= f.threshold : f.activity < f.threshold);
        if (ok) this.rescueP += dt;
        if (this.rescueP >= RULES.rescueSec) {
          this.movesLeft += RULES.rescueMoves;
          this.rescueUsed = true;
          this.rescues++;
          this.p.rescues++;
          this.stage = 'play';
          this.stageT = 0;
          this.emit({ type: 'rescue', moves: RULES.rescueMoves });
        } else if (this.rescueT >= RULES.rescueWindow) this.lose();
        break;
      }
      case 'won':
        if (this.busyT <= 0 && this.stageT >= RULES.wonHold && this.phase === 'play') this.startLevel(this.level.index + 1, 0);
        break;
      case 'lost':
        if (this.stageT >= RULES.lostHold && this.phase === 'play') this.startLevel(this.level.index, this.attempt + 1);
        break;
      default:
        break;
    }
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A tap (or Enter) on a cell: use the armed instrument, select, deselect, or swap with the selected neighbour. */
  tap(at: number): void {
    if (!this.started || this.phase !== 'play' || this.stage !== 'play') return;
    if (at < 0 || at >= this.board.n || !this.board.mask[at]) {
      this.select(-1);
      return;
    }
    this.cursor = at;
    const tool = this.armedTool;
    if (tool && tool !== 'swap') {
      if (this.busyT > 0) return;
      const res = this.board.useTool(tool, at);
      if (!res) {
        this.emit({ type: 'toolMiss', at });
        return;
      }
      this.tray.splice(this.armed, 1);
      this.armed = -1;
      this.apply(res, 'tool', { tool, at });
      return;
    }
    if (this.selected === at) this.select(-1);
    else if (this.selected >= 0 && this.board.adjacent(this.selected, at)) this.trySwap(this.selected, at);
    else this.select(this.board.free(at) && this.board.cells[at] ? at : -1);
  }

  private select(at: number): void {
    if (this.selected === at) return;
    this.selected = at;
    this.emit({ type: 'select', at });
  }

  /** Swap two neighbours (a drag, a tap and a tap, the hint): a move when it lands, a free bounce when not. */
  trySwap(a: number, b: number): void {
    if (!this.canMove) return;
    const free = this.armedTool === 'swap';
    const res = this.board.swap(a, b, free);
    this.selected = -1;
    if (!res.ok) {
      this.busyT = res.dur;
      this.emit({ type: 'bounce', a, b });
      return;
    }
    if (free) {
      this.tray.splice(this.armed, 1);
      this.armed = -1;
    } else this.movesLeft--;
    this.apply(res, free ? 'free' : 'swap');
  }

  /** Space: the first press shows the best move, the next plays it. */
  space(): void {
    if (!this.started || this.phase !== 'play' || this.stage !== 'play') return;
    if (this.hintShown && this.hint && this.board.swapValue(this.hint.a, this.hint.b) > 0) {
      if (this.canMove) this.trySwap(this.hint.a, this.hint.b);
      return;
    }
    this.showHint();
  }

  private showHint(): void {
    this.hint = this.board.findMoves()[0] ?? null;
    this.hintShown = true;
    this.emit({ type: 'hint', move: this.hint });
  }

  /** Tap an instrument in the tray: armed; tap it again: put back. */
  pickTool(slot: number): void {
    if (!this.started || this.phase !== 'play') return;
    if (slot < 0 || slot >= this.tray.length) return;
    this.armed = this.armed === slot ? -1 : slot;
    this.emit({ type: 'arm', slot: this.armed, tool: this.armedTool });
  }

  /** Arrows move the cursor, Enter taps it, Space hints and plays, 1–4 pick an instrument, Escape lets go. */
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
      if (down && this.cursor >= 0) this.tap(this.cursor);
      return true;
    }
    if (key >= '1' && key <= '4') {
      if (down) this.pickTool(Number(key) - 1);
      return true;
    }
    if (key === 'Escape') {
      if (down) {
        this.armed = -1;
        this.select(-1);
      }
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
    this.stageTick(dt, f);
    // the hint glows in the night, and by itself after a while without a move
    this.idleT += dt;
    if (this.stage === 'play' && this.busyT <= 0 && !this.hintShown && (this.nightBlock || this.idleT >= RULES.idleHint)) this.showHint();
    if (this.phase === 'finale' && this.phaseT >= RULES.finale && this.busyT <= 0) {
      this.phase = 'done';
      this.settle();
    }
  }

  /** The band's slow quantities: the lens and the pulsar's hold in Obserwacja, the sky and its falling stars in the night. */
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    this.reliable = f.reliable;
    const play = this.phase === 'play';
    if (play && f.reliable) this.relSec += dt;
    const obs = play && b.kind === 'obs';
    const acting = obs && this.blockT >= this.lead;
    this.lensLook = !play || b.kind === 'warmup' ? 'warm' : b.kind === 'night' ? 'rest' : b.blind ? 'blind' : !f.reliable ? 'grey' : acting ? 'live' : 'lead';
    this.level01 = approach(this.level01, f.reliable ? f.level : 0.5 * this.level01, dt, 0.3);
    const phase: TracePhase = !play ? 'free' : b.kind === 'obs' ? 'focus' : b.kind === 'night' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    // the lens: light gathers while the level lies above the threshold
    if (acting && f.reliable) {
      const gain = lensRate(f.level) * dt;
      if (b.blind) {
        this.blindLens += gain;
        while (this.blindLens >= 1) {
          this.blindLens -= 1;
          this.blindTools.push(this.chooseTool());
        }
      } else {
        this.lens += gain;
        while (this.lens >= 1) {
          if (this.tray.length >= this.traySize) {
            this.lens = 1;
            if (!this.fullWarned) {
              this.fullWarned = true;
              this.emit({ type: 'trayFull' });
            }
            break;
          }
          this.lens -= 1;
          this.earn(this.chooseTool(), false);
        }
      }
    }
    if (this.tray.length < this.traySize) this.fullWarned = false;
    // the hold: twelve seconds of held focus make the next instrument a pulsar
    this.hold = acting && f.reliable && !b.blind ? f.hold : 0;
    if (f.hold < this.lastHold - 0.5) this.holdUsed = false;
    this.lastHold = f.hold;
    if (acting && f.reliable && !b.blind && f.hold >= R.pulsarHold && !this.holdUsed && !this.nextPulsar) {
      this.holdUsed = true;
      this.nextPulsar = true;
      this.emit({ type: 'pulsarReady' });
    }
    // the night: calm brightens the sky; falling stars leave comets
    const night = play && b.kind === 'night';
    this.sky = approach(this.sky, night ? (f.reliable ? f.calm : this.sky) : 0, dt, R.skyTau);
    if (night && this.blockT >= this.starLead && f.reliable) {
      this.calmP += f.calm * dt;
      if (this.calmP >= R.starEvery * (this.starsBlock + 1) && this.starsBlock < R.starMax && this.stage === 'play') {
        const g = this.board.gift();
        this.starsBlock++;
        if (g) {
          this.falling++;
          this.hint = null;
          this.hintShown = false;
          this.emit({ type: 'falling', at: g.at, id: g.id, sp: g.sp });
        }
      }
    }
  }

  /** The next instrument: a pulsar after a long hold, an asteroid's ray when one is in the way, else in turn. */
  private chooseTool(): ToolKind {
    if (this.nextPulsar) {
      this.nextPulsar = false;
      return 'pulsar';
    }
    const open = toolsFor(this.level.constellation);
    if (this.board.rocksLeft > 0 && open.includes('ray') && !this.tray.includes('ray')) return 'ray';
    const pool = open.filter(x => !(x === 'swap' && this.tray.includes('swap')));
    return pool[this.toolTurn++ % pool.length];
  }

  private earn(tool: ToolKind, blind: boolean): void {
    this.tray.push(tool);
    this.toolsEarned++;
    this.p.tools++;
    if (tool === 'pulsar') {
      this.pulsarsEarned++;
      this.p.pulsars++;
    }
    this.emit({ type: 'instrument', tool, slot: this.tray.length - 1, blind });
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
      this.blindLens = 0;
      this.blindTools = [];
    } else if (b.kind === 'night') {
      this.calmP = 0;
      this.starsBlock = 0;
    }
    if (b.kind !== 'night' && this.hintShown && this.idleT < RULES.idleHint) {
      this.hintShown = false;
      this.hint = null;
    }
    this.tip = this.tipFor(b, i);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  /** The block's strategy (what to do in the head): the HUD shows it and signal() hands it to the dock. */
  private tipFor(b: Block, i: number): string {
    if (b.kind === 'warmup') return TIPS.warmup[0];
    if (b.kind === 'obs') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      return TIPS.obs[(this.session - 1 + i) % TIPS.obs.length];
    }
    return TIPS.night[(this.session - 1 + i) % TIPS.night.length];
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
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
        // what the clouds hid: the instruments gathered, and the lens's part-filled light
        for (const tool of this.blindTools) {
          if (this.tray.length >= this.traySize) break;
          this.earn(tool, true);
          tools.push(tool);
        }
        this.lens = Math.min(1, this.lens + this.blindLens);
        this.blindTools = [];
        this.blindLens = 0;
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.t - this.blockT, t1: this.t, tools });
  }

  // ── the finisher ────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.armed = -1;
    this.selected = -1;
    this.hintShown = false;
    this.emit({ type: 'finale' });
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
  }

  /** The session ends before its own dawn: settle as the dawn would. */
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
      [t('stat.rescues'), String(this.rescues)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: a
   * constellation complete, three stars, a pulsar, a rescue, a long cascade, a new instrument, a
   * passed night; else Genesis 1:16 or Psalm 19:1.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.constsDone.length) fit.push('isa40.26');
    if (this.threeStars.length) fit.push('gen15.5');
    if (this.pulsarsEarned > 0) fit.push('dan12.3');
    if (this.rescues > 0) fit.push('php2.15');
    if (this.bestCascade >= 4) fit.push('job38.7');
    if (this.toolsEarned > 0) fit.push('1co15.41');
    if (this.passedNights > 0) fit.push('jer31.35');
    fit.push('gen1.16', 'psa19.1');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    for (const c of this.constsDone) add(0, t('hl.const', { name: constName(c) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(1, t('hl.record', { pts: pts(this.score) }));
    if (this.threeStars.length) add(2, t('hl.three', { n: this.threeStars[this.threeStars.length - 1] + 1 }));
    if (this.pulsarsEarned) add(3, t('hl.pulsar'));
    if (this.rescues) add(4, t('hl.rescue', { n: RULES.rescueMoves }));
    if (this.toolsEarned) add(5, t('hl.tools', { n: this.toolsEarned }));
    if (this.bestCascade >= 4) add(6, t('hl.cascade', { n: this.bestCascade }));
    if (this.blindShare >= 0) add(7, t('hl.blind', { n: this.blindShare }));
    if (this.giftTool) add(8, t('hl.gift', { name: TOOL_NAME[this.giftTool] }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
