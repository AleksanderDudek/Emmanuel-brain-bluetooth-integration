/**
 * One Geoda session without the DOM or the canvas (randomness only from the injected `rng`), so a
 * whole session runs in a unit test.
 *
 * The hands play Block Blast: three pieces in the tray, placed whole on the 8×8 board, a new three
 * when all three are down; full rows and columns clear at once; a combo grows while every third
 * placement at the latest clears something; an empty board pays a bonus.  When none of the tray's
 * pieces fits anywhere the geode turns: the board's tally, its points kept, a fresh board — the
 * session never ends early.  Two modes: the Wyprawa (chambers with rock and jewels to collect,
 * stars by points) and the Klasyka (an endless board, its record).
 *
 * The band, in blocks the session plans to fill its time:
 *   Blask (push)    the shine dial follows the focus level after the band's delay: ×1 … ×5 on every
 *                   clear (×3 from the threshold up); above the threshold druses grow on cleared,
 *                   still-empty cells, and a piece set over them harvests them.  A blind push
 *                   ("Ciemna komora") hides the dial: its clears go into a sack, paid at the end ×
 *                   the share of the judged window above the threshold.
 *   Szlif (rest)    the push block's best clear becomes the round's gem in the bowl; calm polishes it;
 *                   a passed rest or a full polish lifts its tier; it goes to the cabinet.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the dial and the polish hold still (never a loss); placing always works.
 */
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { PassageId } from '../kit/scripture';
import { inTurn } from '../kit/scripture';
import { SignalTrace } from '../kit/trace';
import { Board, bestSpot, chamberBoard, deal, tapSpot, type Placed, type TrayItem } from './board';
import { chamberName, LINES, MINERALS, TIERS, TIPS, type Moment } from './content';
import { fmt, t } from './i18n';
import { chamber, complete, found, migrate, nextMineral, shelve, starsFor, type ChamberSpec, type GeodaProgress, type Mode } from './meta';
import { comboFactor, linePoints, multOf, RULES } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

export interface Bowl {
  mineral: number;
  /** the tier it starts at (a long combo in the round lifts it) */
  tier: number;
  base: number;
  polish: number;
}

export type Story =
  | { kind: 'open'; t: number; dur: number }
  | { kind: 'level'; t: number; dur: number; level: number; stars: number; points: number; next: number }
  | { kind: 'turn'; t: number; dur: number; points: number; record: boolean; toRecord: number | null };

export type GeodaEvent =
  | { type: 'deal'; items: TrayItem[] }
  | { type: 'select'; slot: number }
  | {
    type: 'place'; slot: number; gx: number; gy: number; item: TrayItem; placed: Placed; points: number; clearPts: number;
    lines: number; combo: number; mult: number; druse: number; clean: boolean; blind: boolean;
  }
  | { type: 'miss'; slot: number }
  | { type: 'comboBreak'; combo: number }
  | { type: 'fuse'; left: number }
  | { type: 'mult'; mult: number; up: boolean }
  | { type: 'jewel'; kind: number; i: number; got: number; need: number }
  | { type: 'turn'; points: number; record: boolean; toRecord: number | null }
  | { type: 'level'; level: number; stars: number; points: number }
  | { type: 'bowl'; bowl: Bowl }
  | { type: 'gem'; mineral: number; tier: number; polished: boolean; outcome: 'new' | 'up' | 'same'; points: number }
  | { type: 'reveal'; share: number; mult: number; points: number }
  | { type: 'stuck'; slot: number }
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
 * min and more, 20 s otherwise, 6 s in a 40 s test), then Blask / Szlif pairs (24 ± 4 s and 22 ± 3
 * s, scaled to end on time, jittered when there is room) ending with a Szlif.  No block under 12 s
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
  progress: GeodaProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

export class GeodaSim {
  readonly p: GeodaProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s: the crystal skyline along the geode's foot */
  readonly trace = new SignalTrace(40, 0.25);
  readonly talk: Talk;
  private readonly events: GeodaEvent[] = [];
  readonly eeg: boolean;
  readonly lead: number;
  readonly restLead: number;
  readonly firstEver: boolean;
  readonly session: number;
  readonly mode: Mode;
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

  // the board
  board = new Board();
  tray: (TrayItem | null)[] = [null, null, null];
  selected = 0;
  /** the Wyprawa's chamber and its jewels collected (per goal entry) */
  spec: ChamberSpec;
  got: number[] = [];

  // scoring
  score = 0;
  boardPts = 0;
  levelPts = 0;
  combo = 0;
  fuse = 0;
  bestCombo = 0;
  lines = 0;
  cleans = 0;
  turns = 0;
  levelsDone = 0;
  starsWon = 0;
  placements = 0;
  maxMult = 1;
  /** the best clear of the round (since the last Szlif) and its longest combo: the round's gem */
  private roundBest = 0;
  private roundCombo = 0;

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  dial = 0;
  mult = 1;
  calmShown = 0;
  private goodT = 0;
  private goodSaid = false;
  private relSec = 0;
  /** a blind push's sack of base points */
  sack = 0;
  bowl: Bowl | null = null;
  readonly gems: { mineral: number; tier: number; outcome: 'new' | 'up' | 'same' }[] = [];
  polishedGems = 0;
  blindShare = -1;
  private readonly bestBefore: number;
  private readonly bestBoardBefore: number;
  private readonly foundBefore: number;
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
    this.mode = this.firstEver ? 'adventure' : p.mode;
    this.bestBefore = p.best;
    this.bestBoardBefore = p.bestBoard;
    this.foundBefore = found(p);
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.firstEver, init.rng);
    this.talk = new Talk(LINES, init.rng);
    this.spec = chamber(p.level);
  }

  // ── the blocks ──────────────────────────────────────────────────
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get pushBlock(): boolean { return !this.ended && this.block.kind === 'push'; }
  get restBlock(): boolean { return !this.ended && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return !this.ended && this.block.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past the band's delay: the dial answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get polishing(): boolean { return this.restBlock && this.blockT >= this.restLead && this.bowl !== null; }
  get telegraphing(): boolean { return !this.ended && this.blockT >= this.block.dur - RULES.telegraph && this.blockIndex < this.plan.length - 1; }
  get left(): number { return Math.max(0, this.block.dur - this.blockT); }
  /** Bazyl keeps quiet under a story card, the runner's banner and a telegraph */
  get talkBlocked(): boolean {
    if (this.story) return true;
    if (this.ended) return false;
    if (this.block.kind !== 'warmup' && this.blockT < RULES.bannerSec) return true;
    return this.telegraphing;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.sessions++;
    this.newBoard(false);
    if (this.firstEver) this.setStory({ kind: 'open', t: 0, dur: RULES.openSec });
    else this.talk.ask('open', 2, 8);
    this.startBlock(0);
  }

  // ── the hands ───────────────────────────────────────────────────
  /** Select a tray piece (keys 1–3, a tap on it). */
  select(slot: number): void {
    if (!this.tray[slot]) return;
    this.lastInput = this.t;
    if (this.selected !== slot) {
      this.selected = slot;
      this.emit({ type: 'select', slot });
    }
  }

  /** The piece to place when none is named: the selected one, else the first that is there. */
  get current(): number {
    if (this.tray[this.selected]) return this.selected;
    const i = this.tray.findIndex(x => x !== null);
    return i < 0 ? 0 : i;
  }

  /** Close a story card (a tap or Space on it): true when there was one. */
  dismiss(): boolean {
    if (!this.story) return false;
    this.lastInput = this.t;
    this.story = null;
    return true;
  }

  /** Place a tray piece with its top-left at (gx, gy); false if it does not fit there. */
  place(slot: number, gx: number, gy: number): boolean {
    if (!this.started) return false;
    const item = this.tray[slot];
    if (!item) return false;
    this.lastInput = this.t;
    if (this.story) this.story = null;
    if (!this.board.fits(item.piece, gx, gy)) {
      this.emit({ type: 'miss', slot });
      return false;
    }
    this.tray[slot] = null;
    this.placements++;
    const placed = this.board.place(item.piece, gx, gy, item.tile, item.jewel, item.jewelAt);
    this.score1(slot, gx, gy, item, placed);
    if (this.tray.every(x => x === null)) this.refill();
    else this.selected = this.current;
    this.checkStuck();
    return true;
  }

  /** A tap on the board at cell (cx, cy) with no drag: the current piece goes there, or as near as it fits. */
  tapAt(cx: number, cy: number): boolean {
    if (this.dismiss()) return true;
    const slot = this.current, item = this.tray[slot];
    if (!item) return false;
    const s = tapSpot(this.board, item.piece, cx, cy);
    return s ? this.place(slot, s[0], s[1]) : false;
  }

  /** The auto-place helper (Space): the current piece at its best spot. */
  auto(): boolean {
    if (this.dismiss()) return true;
    for (let k = 0; k < 3; k++) {
      const slot = (this.current + k) % 3, item = this.tray[slot];
      if (!item) continue;
      const s = bestSpot(this.board, item.piece);
      if (s) return this.place(slot, s[0], s[1]);
    }
    return false;
  }

  /** Where the auto-place would put the current piece (the view shows it faintly). */
  autoSpot(): { slot: number; gx: number; gy: number } | null {
    const slot = this.current, item = this.tray[slot];
    if (!item) return null;
    const s = bestSpot(this.board, item.piece);
    return s ? { slot, gx: s[0], gy: s[1] } : null;
  }

  key(key: string, down: boolean): boolean {
    if (!down) return key === ' ' || key === 'Enter' || ['1', '2', '3'].includes(key);
    if (key === ' ' || key === 'Enter') {
      this.auto();
      return true;
    }
    if (['1', '2', '3'].includes(key)) {
      this.select(Number(key) - 1);
      return true;
    }
    return false;
  }

  // ── scoring ─────────────────────────────────────────────────────
  private score1(slot: number, gx: number, gy: number, item: TrayItem, placed: Placed): void {
    const L = placed.rows.length + placed.cols.length;
    const blind = this.blind;
    const mult = blind ? 1 : this.mult;
    let points = item.piece.cells.length * RULES.perCell;
    let clearPts = 0;
    if (L > 0) {
      this.combo++;
      this.fuse = RULES.comboFuse;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.roundCombo = Math.max(this.roundCombo, this.combo);
      clearPts = Math.round(linePoints(L) * comboFactor(this.combo));
      this.lines += L;
      this.p.lines += L;
    } else if (this.combo > 0) {
      this.fuse--;
      if (this.fuse <= 0) {
        this.emit({ type: 'comboBreak', combo: this.combo });
        this.combo = 0;
      } else this.emit({ type: 'fuse', left: this.fuse });
    }
    const drusePts = Math.round(RULES.druseCt * placed.druse);
    const cleanPts = placed.clean && L > 0 ? RULES.cleanBonus : 0;
    if (cleanPts) this.cleans++;
    const bonus = clearPts + drusePts + cleanPts;
    if (blind) this.sack += bonus;
    else points += bonus * mult;
    this.roundBest = Math.max(this.roundBest, (clearPts + cleanPts) * mult);
    this.bank(points);
    // jewels: the Wyprawa counts the ones its chamber wants
    for (const c of placed.cleared) {
      if (!c.jewel || this.mode !== 'adventure') continue;
      const g = this.spec.goal.findIndex(([k]) => k === c.jewel);
      if (g < 0) continue;
      if (this.got[g] < this.spec.goal[g][1]) this.got[g]++;
      this.emit({ type: 'jewel', kind: c.jewel, i: c.i, got: this.got[g], need: this.spec.goal[g][1] });
      this.talk.ask('jewel', 1, 3);
    }
    this.emit({
      type: 'place', slot, gx, gy, item, placed, points, clearPts, lines: L, combo: L > 0 ? this.combo : 0, mult, druse: drusePts, clean: cleanPts > 0, blind,
    });
    // Bazyl
    if (placed.clean && L > 0) this.talk.ask('clean', 4, 5);
    else if (L >= 3 || (L > 0 && this.combo >= 6)) this.talk.ask('big', 3, 4);
    else if (L > 0 && this.combo >= 3 && this.combo % 3 === 0) this.talk.ask('combo', 2, 4);
    else if (drusePts >= 20) this.talk.ask('harvest', 2, 4);
    if (this.mode === 'adventure' && this.goalDone) this.levelDone();
  }

  private bank(points: number): void {
    if (!(points > 0)) return;
    this.score += points;
    this.boardPts += points;
    this.levelPts += points;
    this.p.total += points;
  }

  get goalDone(): boolean { return this.spec.goal.every(([, need], g) => (this.got[g] ?? 0) >= need); }

  /** jewels still to collect in the chamber, by kind (for the dealer) */
  private wanted(): number[] {
    if (this.mode !== 'adventure') return [];
    return this.spec.goal.filter(([, need], g) => (this.got[g] ?? 0) < need).map(([k]) => k);
  }

  private refill(): void {
    const gentle = this.restBlock || this.warmBlock;
    const want = this.wanted();
    // jewels already in the board count toward what is still wanted
    const onBoard = this.board.jewels();
    const stillShort = want.filter(k => {
      const g = this.spec.goal.findIndex(([kk]) => kk === k);
      return (this.got[g] ?? 0) + onBoard[k] < this.spec.goal[g][1] + 2;
    });
    const items = deal(this.board, this.rng, { gentle, jewels: stillShort, jewelChance: RULES.jewelChance });
    this.tray = items;
    this.selected = 0;
    this.emit({ type: 'deal', items });
  }

  /** None of the tray's pieces fits: the geode turns.  One fits nowhere while others do: Bazyl warns. */
  private checkStuck(): void {
    const items = this.tray.map((x, i) => ({ x, i })).filter(o => o.x !== null);
    if (!items.length) return;
    const fits = items.filter(o => this.board.fitsAnywhere(o.x!.piece));
    if (!fits.length) this.turn();
    else if (fits.length < items.length) {
      const stuck = items.find(o => !fits.includes(o))!;
      this.emit({ type: 'stuck', slot: stuck.i });
      this.talk.ask('near', 2, 4);
      if (!this.tray[this.selected] || !this.board.fitsAnywhere(this.tray[this.selected]!.piece)) this.selected = fits[0].i;
    }
  }

  /** The geode turns: the board's tally, a fresh board (the same chamber in the Wyprawa). */
  private turn(): void {
    const points = this.boardPts;
    this.turns++;
    let record = false, toRecord: number | null = null;
    if (this.mode === 'classic') {
      const before = Math.max(this.bestBoardBefore, this.p.bestBoard);
      record = points > before && points > 0;
      toRecord = !record && before > 0 ? before - points : null;
      this.p.bestBoard = Math.max(this.p.bestBoard, points);
    }
    this.combo = 0;
    this.emit({ type: 'turn', points, record, toRecord });
    this.setStory({ kind: 'turn', t: 0, dur: RULES.turnSec, points, record, toRecord });
    this.talk.ask('turn', 3, 6);
    this.newBoard(true);
  }

  private levelDone(): void {
    const spec = this.spec;
    const stars = starsFor(spec, this.levelPts);
    const p = this.p;
    while (p.stars.length <= spec.level) p.stars.push(0);
    p.stars[spec.level] = Math.max(p.stars[spec.level] ?? 0, stars);
    p.level = Math.max(p.level, spec.level + 1);
    this.levelsDone++;
    this.starsWon += stars;
    this.emit({ type: 'level', level: spec.level, stars, points: this.levelPts });
    this.setStory({ kind: 'level', t: 0, dur: RULES.levelSec, level: spec.level, stars, points: this.levelPts, next: spec.level + 1 });
    this.talk.ask('level', 4, 7);
    this.spec = chamber(spec.level + 1);
    this.newBoard(false);
  }

  /** A fresh board: the chamber's (a turned one keeps part of its rock), or an empty one in the Klasyka. */
  private newBoard(turned: boolean): void {
    this.boardPts = 0;
    if (this.mode === 'adventure') {
      if (!turned) {
        this.got = this.spec.goal.map(() => 0);
        this.levelPts = 0;
      }
      const left = this.spec.goal.reduce((s, [, need], g) => s + Math.max(0, need - (this.got[g] ?? 0)), 0);
      const rng = turned ? this.rng : seeded(this.spec.seed);
      const rock = turned ? Math.round(this.spec.rock * RULES.turnRock) : this.spec.rock;
      const kinds = this.wanted();
      this.board = chamberBoard(rng, rock, kinds, Math.min(Math.ceil(left * 0.45), Math.round(rock * 0.4)));
    } else this.board = new Board();
    this.combo = 0;
    this.fuse = 0;
    this.refill();
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
      if (this.story.t >= this.story.dur) this.story = null;
    }
    if (!this.ended) {
      this.band(dt, f);
      this.schedule(dt, f);
      if (t >= this.plannedSec) this.end();
    }
    this.talk.update(dt, t, this.talkBlocked);
  }

  /** The dial, the druses and the polish from the band. */
  private band(dt: number, f: FocusFrame): void {
    const R = RULES;
    const phase = this.pushBlock ? 'focus' : this.restBlock ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    if (f.reliable && !this.warmBlock) this.relSec += dt;
    const before = this.mult;
    if (this.sighted) {
      if (f.reliable) this.dial = approach(this.dial, clamp(f.level), dt, R.shineTau);
      this.mult = multOf(this.dial);
      if (f.reliable && this.dial >= 0.5) {
        this.board.grow(dt * (R.druseRate + (R.druseMax - R.druseRate) * clamp((this.dial - 0.5) / 0.5)));
        this.goodT += dt;
        if (this.goodT >= R.goodSec && !this.goodSaid) {
          this.goodSaid = true;
          this.talk.ask('good', 3, 5);
        }
      } else this.goodT = 0;
    } else {
      this.dial = approach(this.dial, 0, dt, 0.8);
      this.mult = 1;
    }
    this.maxMult = Math.max(this.maxMult, this.mult);
    if (this.mult !== before) this.emit({ type: 'mult', mult: this.mult, up: this.mult > before });
    if (this.polishing && f.reliable) {
      this.calmShown = approach(this.calmShown, clamp(f.calm), dt, 0.9);
      this.bowl!.polish = Math.min(1, this.bowl!.polish + dt * R.polishRate * clamp(f.calm));
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
      this.sack = 0;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
    } else if (b.kind === 'rest') {
      this.calmShown = 0;
      const base = Math.max(RULES.gemMin, Math.round(this.roundBest));
      this.bowl = { mineral: nextMineral(this.p, this.rng), tier: this.roundCombo >= 5 ? 1 : 0, base, polish: 0 };
      this.roundBest = 0;
      this.roundCombo = 0;
      this.emit({ type: 'bowl', bowl: this.bowl });
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
      if (b.kind === 'push' && b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        const mult = 1 + Math.round(4 * clamp(s));
        const points = Math.round(this.sack * mult);
        this.bank(points);
        this.roundBest = Math.max(this.roundBest, points);
        this.emit({ type: 'reveal', share: s, mult, points });
        this.sack = 0;
      }
      if (b.kind === 'rest' && this.bowl) this.settleBowl(verdict === true);
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  /** The round's gem leaves the bowl for the cabinet: a tier up when the rest passed or the polish is full. */
  private settleBowl(passed: boolean): void {
    const bw = this.bowl;
    if (!bw) return;
    this.bowl = null;
    const polished = passed || bw.polish >= 1 - 1e-9;
    const tier = Math.min(TIERS.length - 1, bw.tier + (polished ? 1 : 0));
    const outcome = shelve(this.p, bw.mineral, tier);
    const points = Math.round(bw.base * (1 + bw.polish));
    this.bank(points);
    if (polished) {
      this.polishedGems++;
      this.p.polished++;
    }
    this.gems.push({ mineral: bw.mineral, tier, outcome });
    this.emit({ type: 'gem', mineral: bw.mineral, tier, polished, outcome, points });
    this.talk.ask('polish', 3, 6);
  }

  /** Time is up, or the session ends early: the last block is judged once, the bowl and the sack settle. */
  private end(): void {
    if (this.ended) return;
    this.endBlock();
    this.ended = true;
    if (this.mode === 'classic') this.p.bestBoard = Math.max(this.p.bestBoard, this.boardPts);
    this.p.bestCombo = Math.max(this.p.bestCombo, this.bestCombo);
    this.talk.ask('end', 5, 8);
    this.emit({ type: 'done' });
  }

  finish(): void {
    if (this.started) this.end();
  }

  canStop(): boolean { return true; }

  take(): GeodaEvent[] {
    if (!this.events.length) return [];
    return this.events.splice(0);
  }

  private emit(e: GeodaEvent): void {
    this.events.push(e);
    if (this.events.length > 400) this.events.shift();
  }

  // ── what the runner reads ───────────────────────────────────────
  /** The panel's gauge: the shine dial in a sighted Blask, the polish's calm in a Szlif, else nothing. */
  meter(): number | null {
    if (!this.started || this.ended || !this.reliable) return null;
    if (this.sighted) return this.dial;
    if (this.polishing) return this.calmShown;
    return null;
  }

  padLevel(f: FocusFrame): number | null {
    return this.sighted && f.reliable ? f.level : null;
  }

  /** The score corner's second line: the combo, the chamber's jewels, or the way to the board's record. */
  headlineSub(): string {
    if (this.combo >= 2) return t('sub.combo', { n: this.combo });
    if (this.mode === 'adventure') {
      const need = this.spec.goal.reduce((s, [, n]) => s + n, 0);
      const got = this.spec.goal.reduce((s, [, n], g) => s + Math.min(n, this.got[g] ?? 0), 0);
      return t('sub.chamber', { n: this.spec.level + 1, got, need });
    }
    const rec = Math.max(this.bestBoardBefore, this.p.bestBoard);
    return rec > this.boardPts ? t('sub.toRecord', { n: fmt(rec - this.boardPts) }) : t('sub.board', { n: fmt(this.boardPts) });
  }

  result(): { score: number; record: boolean; stats: [string, string][]; highlights: string[]; verse: PassageId } {
    const p = this.p;
    p.best = Math.max(p.best, this.score);
    p.bestCombo = Math.max(p.bestCombo, this.bestCombo);
    if (this.mode === 'classic') p.bestBoard = Math.max(p.bestBoard, this.boardPts);
    const stats: [string, string][] = [
      [t('stat.lines'), fmt(this.lines)],
      [t('stat.combo'), this.bestCombo ? `×${this.bestCombo}` : '—'],
      this.mode === 'adventure'
        ? [t('stat.chambers'), this.levelsDone ? `${fmt(this.levelsDone)} · ${'★'.repeat(Math.min(3, Math.round(this.starsWon / this.levelsDone)))}` : '—']
        : [t('stat.board'), fmt(Math.max(this.boardPts, p.bestBoard))],
      [t('stat.gems'), fmt(this.gems.length)],
      [t('stat.polished'), fmt(this.polishedGems)],
      [t('stat.shine'), `×${this.maxMult}`],
    ];
    const hl: string[] = [];
    if (this.levelsDone) hl.push(t('hl.chambers', { n: this.levelsDone, stars: this.starsWon }));
    for (const g of this.gems) {
      if (g.outcome === 'same') continue;
      hl.push(t(g.outcome === 'new' ? 'hl.newMineral' : 'hl.upMineral', { mineral: MINERALS[g.mineral].title, tier: TIERS[g.tier] }));
    }
    if (this.bestCombo >= 5) hl.push(t('hl.combo', { n: this.bestCombo }));
    if (this.cleans) hl.push(t('hl.clean', { n: this.cleans }));
    if (this.mode === 'classic' && this.bestBoardBefore > 0 && p.bestBoard > this.bestBoardBefore) hl.push(t('hl.boardRecord', { n: fmt(p.bestBoard) }));
    else if (this.score > 0 && this.bestBefore > this.score) hl.push(t('hl.toBest', { n: fmt(this.bestBefore - this.score) }));
    if (this.blindShare >= 0) hl.push(t('hl.blind', { pct: this.blindShare }));
    hl.push(t(this.levelsDone ? 'hl.closeChamber' : this.polishedGems ? 'hl.closePolish' : 'hl.close', { name: chamberName(this.spec.level) }));
    let verse: PassageId;
    if (complete(p) && this.foundBefore < MINERALS.length) verse = 'rev21.19-20';
    else if (this.gems.some(g => g.tier >= 2 && g.outcome !== 'same')) verse = 'mat13.45-46';
    else if (this.polishedGems) verse = 'mal3.3';
    else if (this.levelsDone) verse = '1pe2.5';
    else verse = inTurn(['psa127.1', 'mat7.24-25', '1pe2.5'], this.session);
    return { score: this.score, record: this.bestBefore > 0 && this.score > this.bestBefore, stats, highlights: hl, verse };
  }

  /** for the talk and the view: which Bazyl moment is current */
  get talking(): Moment | null { return this.talk.line?.moment ?? null; }
}

/** A small seeded generator (mulberry32) for a chamber's starting board. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
