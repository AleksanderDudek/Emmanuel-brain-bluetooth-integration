/**
 * One Źródła session without the DOM or the canvas (randomness only from the injected `rng`), so a
 * whole session runs in a unit test.
 *
 * The hands play Pipe Mania: a dispenser shows the next five channel stones; a tap on a free cell
 * lays the next one there (stones never turn); a tap on a dry stone replaces it (Kumka shovels the
 * old one out: the hands wait a moment, an input meanwhile waits its turn).  After a countdown the
 * spring opens and the water runs cell by cell through whatever it meets; the player keeps laying
 * the way ahead of it.  Where the way ends the water spills: a valley is won when it ran through
 * the goal's number of cells (and, in a station's last valley, into the garden).  A cross run twice
 * is a loop (+50), a pool slows the water and pays, an old aqueduct stone pays.  Space lays the next
 * stone where it helps (the way's open end, or parked out of the way) and, once the way is long
 * enough, lets the water run fast (every cell ×2).  A missed goal is never a lost session: the water
 * soaks in, the score stays, the same valley comes again.
 *
 * The band, in blocks the session plans to fill its time:
 *   push (Zastawka)   past the lead-in the sluice follows the focus level: above the threshold the
 *                     water's pressure drops and it runs slower (down to 45 % of its pace); a held focus fills the charge, and a full charge stills the water
 *                     for 5 s ("Cisza wód").  A blind push hides the gauge; its charge is released at
 *                     the block's end.
 *   rest (Sela)       the water runs a little gentler; calm grows gardens along the cells the water
 *                     reached, a front of three at a time, each in bloom +30.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the sluice eases to neutral and the gardens hold (never a loss); the hands always work.
 */
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace } from '../kit/trace';
import { LINES, TIPS, stationName, type Moment } from './content';
import { autoSpot, bit, deal, isPool, makeValley, opp, specOf, type Kind, type PathEnd, type Seg, type Valley, type ValleySpec } from './grid';
import { fmt, t } from './i18n';
import { migrate, recordValley, roadDone, type ZrodlaProgress } from './meta';
import { RULES, cellSecOf, countdownOf, paceOf, starsFor, stationOf } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'count' | 'flow' | 'over';

export type Story =
  | { kind: 'open'; t: number; dur: number }
  | { kind: 'tally'; t: number; dur: number; v: number; cells: number; goal: number; stars: number; points: number; loops: number; blooms: number; garden: boolean }
  | { kind: 'spill'; t: number; dur: number; v: number; cells: number; goal: number; short: number; garden: boolean }
  | { kind: 'station'; t: number; dur: number; station: number };

export type ZrodlaEvent =
  | { type: 'valley'; v: number; spec: ValleySpec }
  | { type: 'lay'; cell: number; kind: Kind; replaced: boolean; auto: boolean }
  | { type: 'deny'; cell: number }
  | { type: 'flow' }
  | { type: 'fill'; seg: Seg; points: number; fast: boolean; loop: boolean; pool: boolean; aqueduct: boolean; cells: number }
  | { type: 'poolDone'; cell: number; points: number }
  | { type: 'goal'; cells: number }
  | { type: 'near' }
  | { type: 'spill'; cell: number; from: number; side: number }
  | { type: 'garden'; cell: number }
  | { type: 'valleyEnd'; won: boolean; cells: number; goal: number; stars: number; points: number }
  | { type: 'fast' }
  | { type: 'still'; on: boolean }
  | { type: 'bloom'; cell: number; points: number }
  | { type: 'reveal'; sec: number; charge: boolean }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'story'; story: Story }
  | { type: 'done' };

/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks, filling `plannedSec`: a first-ever session opens with a warm-up (30 s in 5
 * min and more, 20 s otherwise, 6 s in a short test), then push / rest pairs (24 ± 4 s and 22 ± 3 s,
 * scaled to end on time, jittered when there is room) ending with a rest.  No block under 12 s
 * (a test session under a minute: whatever fits).
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  const total = Math.max(10, plannedSec);
  if (total <= 60) {
    const warm = firstEver ? Math.min(R.warm.test, total * 0.2) : 0;
    const left = total - warm;
    const rest = Math.min(14, left / 2);
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

export interface SimInit {
  progress: ZrodlaProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

type Pending = { kind: 'lay'; cell: number } | { kind: 'auto' };

export class ZrodlaSim {
  readonly p: ZrodlaProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s: the reeds along the valley's foot */
  readonly trace = new SignalTrace(40, 0.25);
  readonly talk: Talk;
  private readonly events: ZrodlaEvent[] = [];
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
  story: Story | null = null;
  lastInput = 0;
  /** Kumka keeps quiet until then (a coach mark is up) */
  hushUntil = 0;

  // ── the valley ──
  v = 0;
  spec: ValleySpec;
  valley: Valley;
  phase: Phase = 'count';
  countLeft = 0;
  countDur = 1;
  queue: Kind[] = [];
  /** the water's way so far (the spring's stretch first) and the progress through its last stretch */
  segs: Seg[] = [];
  prog = 0;
  /** the way ahead through the dry stones, and where it ends */
  ahead: Seg[] = [];
  wayEnd: PathEnd = { cell: -1, side: 0, kind: 'empty' };
  cells = 0;
  valleyLoops = 0;
  valleyBlooms = 0;
  valleyPts = 0;
  reachedGarden = false;
  fast = false;
  goalSaid = false;
  nearSaid = false;
  /** the hands wait after a replacement (s of play) */
  lockUntil = 0;
  private pending: Pending | null = null;
  /** the keyboard's cursor (−1: not used yet) */
  cursor = -1;
  private nextStory: (() => void) | null = null;

  // ── scoring ──
  score = 0;
  valleysWon = 0;
  valleysTried = 0;
  starsWon = 0;
  threeStars = 0;
  loops = 0;
  blooms = 0;
  pools = 0;
  longest = 0;
  bombs = 0;
  fastRuns = 0;
  gardens = 0;
  stations = 0;
  /** the closest miss this session (cells short), −1: none */
  nearMiss = -1;

  // ── the band ──
  reliable = false;
  level = 0;
  calm = 0;
  sluice = 0;
  charge = 0;
  still = 0;
  stillRuns = 0;
  calmShown = 0;
  private goodT = 0;
  private goodSaid = false;
  private relSec = 0;
  /** seconds the sluice held above the threshold in a blind push */
  blindSec = 0;
  blindShown = -1;
  private readonly bestBefore: number;
  private readonly valleyBefore: number;
  private readonly pushesBase: number;
  private pushesBegun = 0;

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
    this.bestBefore = p.best;
    this.valleyBefore = p.valley;
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.firstEver, init.rng);
    this.talk = new Talk(LINES, init.rng);
    this.v = p.valley;
    this.spec = specOf(this.v);
    this.valley = makeValley(this.v);
  }

  // ── the blocks ──────────────────────────────────────────────────
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get pushBlock(): boolean { return !this.ended && this.block.kind === 'push'; }
  get restBlock(): boolean { return !this.ended && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return !this.ended && this.block.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a push past the band's delay: the sluice answers the band (seen or blind) */
  get acting(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  get sighted(): boolean { return this.acting && !this.block.blind; }
  get greening(): boolean { return this.restBlock && this.blockT >= this.restLead; }
  get telegraphing(): boolean { return !this.ended && this.blockT >= this.block.dur - RULES.telegraph && this.blockIndex < this.plan.length - 1; }
  get left(): number { return Math.max(0, this.block.dur - this.blockT); }
  get talkBlocked(): boolean {
    if (this.story || this.t < this.hushUntil) return true;
    if (this.ended) return false;
    if (this.block.kind !== 'warmup' && this.blockT < RULES.bannerSec) return true;
    return this.telegraphing;
  }
  get station(): number { return stationOf(this.v); }
  get water(): Seg | null { return this.segs.length ? this.segs[this.segs.length - 1] : null; }
  /** the way (wet and planned) holds the goal, and reaches the garden where there is one */
  get wayDone(): boolean {
    return this.cells + this.ahead.length >= this.spec.goal && (!this.spec.garden || this.wayEnd.kind === 'garden');
  }
  /** the water's pace this frame (0: still; the fast flow overrides everything) */
  get pace(): number {
    if (this.fast) return RULES.fastSpeed;
    if (this.still > 0) return 0;
    const sl = this.acting ? paceOf(this.sluice) : 1;
    return sl * (this.restBlock ? RULES.restPace : 1);
  }
  /** how far (in cells) the water's front is from the way's open end */
  get lead2end(): number { return this.ahead.length + (this.phase === 'flow' ? 1 - this.prog : 1); }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.sessions++;
    this.newValley(this.v);
    if (this.firstEver) this.setStory({ kind: 'open', t: 0, dur: RULES.openSec });
    else this.talk.ask('open', 2, 8);
    this.startBlock(0);
  }

  // ── the valley ──────────────────────────────────────────────────
  private newValley(v: number): void {
    this.v = v;
    this.spec = specOf(v);
    this.valley = makeValley(v);
    this.phase = 'count';
    this.countDur = this.countLeft = countdownOf(v);
    this.segs = [];
    this.prog = 0;
    this.cells = 0;
    this.valleyLoops = 0;
    this.valleyBlooms = 0;
    this.valleyPts = 0;
    this.reachedGarden = false;
    this.fast = false;
    this.goalSaid = false;
    this.nearSaid = false;
    this.pending = null;
    this.lockUntil = 0;
    this.cursor = -1;
    // the dispenser: its first stone opens toward the spring's outlet
    const side = opp(this.valley.cells[this.valley.spring].dir);
    this.queue = [deal(this.rng, v, side)];
    while (this.queue.length < RULES.queueLen) this.queue.push(this.dealOne());
    this.retrace();
    this.emit({ type: 'valley', v, spec: this.spec });
    this.talk.ask('count', 1, 6);
  }

  private get gentle(): boolean { return this.v < RULES.helpUntil || this.restBlock || this.warmBlock; }

  private dealOne(): Kind {
    const help = this.gentle && this.rng() < RULES.helpShare && this.wayEnd.cell >= 0 ? this.wayEnd.side : null;
    return deal(this.rng, this.v, help);
  }

  /** The way ahead of the water (before the flow: from the spring). */
  retrace(): void {
    const from = this.water ?? this.valley.springSeg();
    const a = this.valley.ahead(from);
    this.ahead = a.segs;
    this.wayEnd = a.end;
    if (this.wayDone && !this.goalSaid && this.phase !== 'over') {
      this.goalSaid = true;
      this.emit({ type: 'goal', cells: this.cells + this.ahead.length });
    }
  }

  // ── the hands ───────────────────────────────────────────────────
  /** Close a story card (a tap or Space on it once it has been up a moment): true when one was up. */
  dismiss(): boolean {
    const s = this.story;
    if (!s) return false;
    this.lastInput = this.t;
    if (s.t >= RULES.cardMin) this.closeStory();
    return true;
  }

  private closeStory(): void {
    this.story = null;
    const go = this.nextStory;
    this.nextStory = null;
    go?.();
  }

  /** Lay the next stone at `cell` (a tap): a free cell, or a dry stone the hands laid (replaced). */
  layAt(cell: number, auto = false): boolean {
    if (!this.started || this.ended) return false;
    if (this.dismiss()) return true;
    if (this.phase === 'over') return false;
    this.lastInput = this.t;
    if (this.t < this.lockUntil) {
      this.pending = { kind: 'lay', cell };
      return true;
    }
    const val = this.valley;
    if (cell < 0 || !val.canLay(cell)) {
      this.emit({ type: 'deny', cell });
      return false;
    }
    const replaced = val.cells[cell].type !== 0;
    const kind = this.queue.shift()!;
    val.lay(cell, kind, this.t);
    this.retrace();
    this.queue.push(this.dealOne());
    if (replaced) {
      this.bombs++;
      this.lockUntil = this.t + RULES.bombSec;
      this.talk.ask('bomb', 1, 3);
    }
    this.emit({ type: 'lay', cell, kind, replaced, auto });
    return true;
  }

  /**
   * Space: once the way holds the goal, the water runs fast (before the flow it starts at once);
   * until then the next stone goes where it helps (the way's open end, or parked out of the way).
   */
  space(): boolean {
    if (!this.started || this.ended) return false;
    if (this.dismiss()) return true;
    if (this.phase === 'over') return false;
    this.lastInput = this.t;
    if (this.wayDone) return this.goFast();
    if (this.t < this.lockUntil) {
      this.pending = { kind: 'auto' };
      return true;
    }
    const spot = this.autoSpot();
    if (spot >= 0) return this.layAt(spot, true);
    return this.goFast();
  }

  /** Where Space would lay the next stone (the view shows it faintly); −1 nowhere. */
  autoSpot(): number {
    const w = this.water;
    return autoSpot(this.valley, this.queue[0], this.wayEnd, w ? w.cell : this.valley.spring);
  }

  private goFast(): boolean {
    if (this.fast || this.phase === 'over') return false;
    this.fast = true;
    this.fastRuns++;
    this.still = 0;
    if (this.phase === 'count') this.openSpring();
    this.emit({ type: 'fast' });
    this.talk.ask('fast', 2, 3);
    return true;
  }

  moveCursor(dx: number, dy: number): void {
    const val = this.valley;
    if (this.cursor < 0) this.cursor = this.wayEnd.cell >= 0 ? this.wayEnd.cell : val.idx(Math.floor(val.cols / 2), Math.floor(val.rows / 2));
    else {
      const c = Math.max(0, Math.min(val.cols - 1, val.col(this.cursor) + dx));
      const r = Math.max(0, Math.min(val.rows - 1, val.row(this.cursor) + dy));
      this.cursor = val.idx(c, r);
    }
    this.lastInput = this.t;
  }

  key(key: string, down: boolean): boolean {
    const used = [' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'f', 'F'];
    if (!used.includes(key)) return false;
    if (!down) return true;
    if (key === ' ') this.space();
    else if (key === 'f' || key === 'F') {
      if (!this.dismiss() && this.phase !== 'over') this.goFast();
    } else if (key === 'Enter') {
      if (this.cursor < 0) this.space();
      else this.layAt(this.cursor);
    } else if (key === 'ArrowUp') this.moveCursor(0, -1);
    else if (key === 'ArrowDown') this.moveCursor(0, 1);
    else if (key === 'ArrowLeft') this.moveCursor(-1, 0);
    else this.moveCursor(1, 0);
    return true;
  }

  // ── the water ───────────────────────────────────────────────────
  private openSpring(): void {
    if (this.phase !== 'count') return;
    this.phase = 'flow';
    this.countLeft = 0;
    const s = this.valley.springSeg();
    this.segs = [s];
    this.valley.cells[s.cell].wet = 1;
    this.prog = 0;
    this.retrace();
    this.emit({ type: 'flow' });
  }

  private segDur(s: Seg): number {
    const base = cellSecOf(this.v);
    if (s.entry < 0) return base * RULES.springPart;
    return base * (isPool(this.valley.cells[s.cell].kind) ? RULES.poolSlow : 1);
  }

  private flow(dt: number): void {
    if (this.phase === 'count') {
      this.countLeft -= dt;
      if (this.countLeft <= 0) this.openSpring();
      return;
    }
    if (this.phase !== 'flow') return;
    let budget = dt * this.pace;
    for (let guard = 0; guard < 64 && budget > 0 && this.phase === 'flow'; guard++) {
      const cur = this.segs[this.segs.length - 1];
      const dur = this.segDur(cur);
      const need = (1 - this.prog) * dur;
      if (budget < need) {
        this.prog += budget / dur;
        break;
      }
      budget -= need;
      this.prog = 1;
      if (isPool(this.valley.cells[cur.cell].kind) && cur.entry >= 0) this.poolDone(cur.cell);
      this.advance(cur);
    }
    if (this.phase === 'flow' && !this.fast && this.ahead.length === 0 && 1 - this.prog < RULES.nearCells && !this.nearSaid) {
      this.nearSaid = true;
      this.emit({ type: 'near' });
      this.talk.ask('near', 3, 2);
    }
  }

  private poolDone(cell: number): void {
    const pts = RULES.poolBonus * (this.fast ? RULES.fastMult : 1);
    this.pools++;
    this.bank(pts);
    this.emit({ type: 'poolDone', cell, points: pts });
    this.talk.ask('pool', 2, 3);
  }

  /** The water leaves `cur`: into the next stretch, the garden, or out onto the sand. */
  private advance(cur: Seg): void {
    const val = this.valley;
    const nx = val.step(cur.cell, cur.exit);
    const side = opp(cur.exit);
    const r = val.enter(nx, side);
    if (typeof r === 'object') {
      const c = val.cells[r.cell];
      const loop = c.wet !== 0;
      c.wet |= bit(r.ch);
      this.segs.push(r);
      this.prog = 0;
      this.cells++;
      const mult = this.fast ? RULES.fastMult : 1;
      let pts = RULES.perCell * mult;
      if (loop) {
        this.valleyLoops++;
        this.loops++;
        this.p.loops++;
        pts += RULES.loopBonus * mult;
        if (this.valleyLoops === 5) pts += RULES.fiveLoops;
        this.talk.ask('loop', 3, 3);
      }
      if (c.aqueduct) pts += RULES.aqueductBonus * mult;
      this.bank(pts);
      this.retrace();
      this.emit({ type: 'fill', seg: r, points: pts, fast: this.fast, loop, pool: isPool(c.kind), aqueduct: c.aqueduct, cells: this.cells });
      if (this.cells === this.spec.goal) this.talk.ask('win', 1, 3);
      return;
    }
    if (r === 'garden') {
      this.reachedGarden = true;
      val.cells[nx].wet = 1;
      this.gardens++;
      this.emit({ type: 'garden', cell: nx });
      this.talk.ask('garden', 4, 4);
    } else this.emit({ type: 'spill', cell: nx, from: cur.cell, side });
    this.endValley();
  }

  private endValley(): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.fast = false;
    this.still = 0;
    this.pending = null;
    const spec = this.spec, cells = this.cells;
    const won = cells >= spec.goal && (!spec.garden || this.reachedGarden);
    const stars = won ? starsFor(cells, spec.goal) : 0;
    this.valleysTried++;
    this.longest = Math.max(this.longest, cells);
    this.p.longest = Math.max(this.p.longest, cells);
    let points = 0;
    if (won) {
      points = Math.max(0, cells - spec.goal) * RULES.extraCell + stars * RULES.starBonus;
      this.bank(points);
      this.valleysWon++;
      this.starsWon += stars;
      if (stars === 3) this.threeStars++;
      this.p.won++;
      recordValley(this.p, spec.v, stars);
    } else {
      const short = Math.max(0, spec.goal - cells);
      if (short > 0) this.nearMiss = this.nearMiss < 0 ? short : Math.min(this.nearMiss, short);
    }
    this.p.bestValley = Math.max(this.p.bestValley, Math.round(this.valleyPts));
    this.emit({ type: 'valleyEnd', won, cells, goal: spec.goal, stars, points });
    if (this.ended) return;
    if (won) {
      this.setStory({
        kind: 'tally', t: 0, dur: RULES.tallySec, v: spec.v, cells, goal: spec.goal, stars, points: Math.round(this.valleyPts),
        loops: this.valleyLoops, blooms: this.valleyBlooms, garden: this.reachedGarden,
      });
      this.talk.ask(stars === 3 ? 'big' : 'win', 3, 6);
      const nextV = spec.v + 1;
      if (stationOf(nextV) !== stationOf(spec.v)) {
        this.stations++;
        this.nextStory = () => {
          this.setStory({ kind: 'station', t: 0, dur: RULES.stationSec, station: stationOf(nextV) });
          this.talk.ask('station', 3, 8);
          this.nextStory = () => this.newValley(nextV);
        };
      } else this.nextStory = () => this.newValley(nextV);
    } else {
      this.setStory({ kind: 'spill', t: 0, dur: RULES.spillSec, v: spec.v, cells, goal: spec.goal, short: Math.max(0, spec.goal - cells), garden: spec.garden && !this.reachedGarden && cells >= spec.goal });
      this.talk.ask('spill', 3, 6);
      this.nextStory = () => this.newValley(spec.v);
    }
  }

  private bank(points: number): void {
    if (!(points > 0)) return;
    this.score += points;
    this.valleyPts += points;
  }

  private setStory(s: Story): void {
    this.story = s;
    this.talk.clear();
    this.emit({ type: 'story', story: s });
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started) return;
    this.t = t;
    this.reliable = f.reliable;
    this.level = f.level;
    this.calm = f.calm;
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    }
    if (!this.ended) {
      this.band(dt, f);
      if (!this.story) {
        if (this.pending && t >= this.lockUntil) {
          const pd = this.pending;
          this.pending = null;
          if (pd.kind === 'lay') this.layAt(pd.cell);
          else this.space();
        }
        this.flow(dt);
      }
      this.schedule(dt, f);
      if (t >= this.plannedSec) this.end();
    }
    this.talk.update(dt, t, this.talkBlocked);
    if (!this.ended && !this.story && t - this.lastInput > 12 && this.phase === 'count') {
      this.talk.ask('idle', 1, 3);
      this.lastInput = t - 4;
    }
  }

  /** The sluice, the still water and the gardens from the band. */
  private band(dt: number, f: FocusFrame): void {
    const R = RULES;
    const phase = this.pushBlock ? 'focus' : this.restBlock ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    if (f.reliable && !this.warmBlock) this.relSec += dt;
    if (this.still > 0) {
      this.still = Math.max(0, this.still - dt);
      if (this.still === 0) this.emit({ type: 'still', on: false });
    }
    if (this.acting) {
      this.sluice = approach(this.sluice, f.reliable ? clamp(f.level) : 0.5, dt, f.reliable ? R.sluiceTau : 0.8);
      if (f.reliable && this.sluice > 0.5) {
        const k = clamp((this.sluice - 0.5) / 0.5);
        if (this.phase !== 'over') this.charge = Math.min(1, this.charge + dt * (R.chargeLo + (R.chargeHi - R.chargeLo) * k));
        if (this.blind) this.blindSec += dt;
        this.goodT += dt;
        if (this.goodT >= R.goodSec && !this.goodSaid && !this.blind) {
          this.goodSaid = true;
          this.talk.ask('good', 3, 5);
        }
      } else this.goodT = 0;
      if (this.charge >= 1 && !this.blind) this.goStill();
    } else this.sluice = approach(this.sluice, 0, dt, 0.8);
    if (this.greening && f.reliable) {
      this.calmShown = approach(this.calmShown, clamp(f.calm), dt, 0.9);
      this.grow(dt * R.growRate * clamp(f.calm));
    } else if (!this.restBlock) this.calmShown = approach(this.calmShown, 0, dt, 0.8);
  }

  private goStill(): void {
    this.charge = 0;
    if (this.phase === 'over' || this.fast) return;
    this.still = RULES.stillSec;
    this.stillRuns++;
    this.emit({ type: 'still', on: true });
    this.talk.ask('still', 4, 4);
  }

  /** Cells the water reached, in the order it reached them (the spring first, each once). */
  wetOrder(): number[] {
    const seen = new Set<number>(), out: number[] = [];
    for (const s of this.segs) if (!seen.has(s.cell)) { seen.add(s.cell); out.push(s.cell); }
    if (!out.length && this.valley.spring >= 0) out.push(this.valley.spring);
    return out;
  }

  /** Calm grows the gardens along the wet cells: a front of a few at a time, each in bloom pays. */
  private grow(amount: number): void {
    if (amount <= 0) return;
    const front = this.wetOrder().filter(i => !this.valley.cells[i].bloom).slice(0, RULES.growFront);
    if (!front.length) return;
    for (const i of front) this.addGreen(i, amount / front.length);
  }

  private addGreen(i: number, amount: number): void {
    const c = this.valley.cells[i];
    if (c.bloom) return;
    c.green = Math.min(1, c.green + amount);
    if (c.green >= 1 - 1e-9) {
      c.bloom = true;
      this.blooms++;
      this.valleyBlooms++;
      this.p.flowers++;
      this.bank(RULES.bloomBonus);
      this.emit({ type: 'bloom', cell: i, points: RULES.bloomBonus });
      if (this.blooms % 3 === 1) this.talk.ask('bloom', 2, 3);
    }
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
      this.blindSec = 0;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
    } else if (b.kind === 'rest') {
      this.calmShown = 0;
      this.talk.ask('rest', 2, 12);
    } else this.talk.ask('warm', 1, 10);
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup;
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (first && this.pushesBase === 0) return TIPS.firstPush;
      return TIPS.push[(this.session - 1 + i) % TIPS.push.length];
    }
    if (first && this.firstEver) return TIPS.firstRest;
    return TIPS.rest[(this.session - 1 + i) % TIPS.rest.length];
  }

  /** The block's end: its verdict and what it pays (after its judged window, never during it). */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push') {
        if (verdict === true) this.charge = Math.min(1, this.charge + RULES.passCharge);
        if (b.blind) {
          this.trace.unveil(this.t);
          this.blindShown = Math.max(this.blindShown, Math.round(this.blindSec));
          const full = this.charge >= 1;
          this.emit({ type: 'reveal', sec: Math.round(this.blindSec), charge: full });
          if (full) this.goStill();
        } else if (this.charge >= 1) this.goStill();
      }
      if (b.kind === 'rest' && verdict === true) {
        for (const i of this.wetOrder()) this.addGreen(i, RULES.passGrow);
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  /** Time is up, or the session ends early: the last block is judged once. */
  private end(): void {
    if (this.ended) return;
    this.endBlock();
    this.ended = true;
    this.fast = false;
    this.still = 0;
    this.p.longest = Math.max(this.p.longest, this.cells);
    this.longest = Math.max(this.longest, this.cells);
    this.talk.ask('end', 5, 8);
    this.emit({ type: 'done' });
  }

  finish(): void {
    if (this.started) this.end();
  }

  canStop(): boolean { return true; }

  take(): ZrodlaEvent[] {
    if (!this.events.length) return [];
    return this.events.splice(0);
  }

  private emit(e: ZrodlaEvent): void {
    this.events.push(e);
    if (this.events.length > 400) this.events.shift();
  }

  // ── what the runner reads ───────────────────────────────────────
  /** The panel's gauge: the sluice in a sighted push, the gardens' calm in a rest, else nothing. */
  meter(): number | null {
    if (!this.started || this.ended || !this.reliable) return null;
    if (this.sighted) return this.sluice;
    if (this.greening) return this.calmShown;
    return null;
  }

  padLevel(f: FocusFrame): number | null {
    return this.sighted && f.reliable ? f.level : null;
  }

  /** The score corner's second line: the countdown, the fast flow, the valley's goal. */
  headlineSub(): string {
    if (this.ended) return t('sub.valley', { n: this.v + 1 });
    if (this.phase === 'count') return t('sub.count', { n: Math.max(1, Math.ceil(this.countLeft)) });
    if (this.fast) return t('sub.fast');
    if (this.still > 0) return t('sub.still');
    if (this.cells >= this.spec.goal) return t('sub.done', { v: this.v + 1, n: this.cells });
    return t('sub.goal', { v: this.v + 1, got: this.cells, goal: this.spec.goal });
  }

  result(): { score: number; record: boolean; stats: [string, string][]; highlights: string[]; verse: PassageId } {
    const p = this.p;
    const score = Math.round(this.score);
    p.best = Math.max(p.best, score);
    p.longest = Math.max(p.longest, this.longest);
    const stats: [string, string][] = [
      [t('stat.valleys'), this.valleysTried ? `${fmt(this.valleysWon)} / ${fmt(this.valleysTried)}` : '—'],
      [t('stat.stars'), this.starsWon ? `${fmt(this.starsWon)} ★` : '—'],
      [t('stat.longest'), fmt(Math.max(this.longest, this.cells))],
      [t('stat.loops'), fmt(this.loops)],
      [t('stat.flowers'), fmt(this.blooms)],
      [t('stat.still'), fmt(this.stillRuns)],
    ];
    const hl: string[] = [];
    if (this.valleysWon) hl.push(t('hl.valleys', { n: this.valleysWon, stars: this.starsWon }));
    if (this.stations) hl.push(t('hl.station', { name: stationName(stationOf(p.valley)) }));
    if (roadDone(p) && this.valleyBefore < RULES.stations * RULES.perStation) hl.push(t('hl.road'));
    if (this.threeStars) hl.push(t('hl.stars3', { n: this.threeStars }));
    if (this.loops >= 2) hl.push(t('hl.loops', { n: this.loops }));
    if (this.blooms) hl.push(t('hl.flowers', { n: this.blooms }));
    if (this.nearMiss > 0 && this.nearMiss <= 3) hl.push(t('hl.near', { n: this.nearMiss }));
    if (this.bestBefore > 0 && score > this.bestBefore) hl.push(t('hl.record'));
    else if (score > 0 && this.bestBefore > score) hl.push(t('hl.toBest', { n: fmt(this.bestBefore - score) }));
    if (this.blindShown >= 0) hl.push(t('hl.blind', { n: this.blindShown }));
    hl.push(t(this.valleysWon ? 'hl.close.won' : this.blooms ? 'hl.close.green' : 'hl.close.plain'));
    let verse: PassageId;
    if (roadDone(p) && this.valleyBefore < RULES.stations * RULES.perStation) verse = 'psa84.5-6';
    else if (this.stations) verse = 'psa121.1-2';
    else if (this.gardens) verse = 'isa58.11';
    else if (this.threeStars) verse = 'isa35.7';
    else if (this.stillRuns) verse = 'psa23.1-3';
    else if (this.blooms >= 3) verse = '1co3.6';
    else if (this.loops >= 2) verse = 'psa1.2-3';
    else verse = inTurn(['isa41.18', 'psa126.5', 'isa58.11'], this.session);
    return { score, record: this.bestBefore > 0 && score > this.bestBefore, stats, highlights: hl, verse };
  }

  /** for the view: which Kumka moment is current */
  get talking(): Moment | null { return this.talk.line?.moment ?? null; }
}
