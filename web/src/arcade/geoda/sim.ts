/**
 * Geoda's rules, without the DOM or the canvas (randomness only from the injected `rng`), so the
 * whole session can run in a unit test.
 *
 * The wall is 8×8: rock, empty sockets and set crystals.  The tray holds three crystals; only the
 * fed one grows, cell by cell along its ghost shape, at a rate the band drives
 * (`growthRate`: base 0.05 cells/s, up to 0.45 after a long steady hold) and with a clarity that
 * records how steady the focus was when the cell grew (`clarityOf`).  The hands place crystals,
 * Block Blast style: no rotation, the piece must fit entirely, carats are paid at once
 * (cells × clarity).  The session alternates three blocks — Wzrost (focus: growth and placing),
 * Zbiór (every full row and column shatters, top to bottom, with a bonus for several at once,
 * and regrows as rock with new gaps sized to what the player has been placing; a wall filled up
 * to all but a few cells breaks whole, a Pełna geoda, and a fresh geode starts) and Szlif (rest:
 * a rest block the kit's judge passes polishes the round's best gem) — each focus and rest block
 * judged once at its end.  Bad signal freezes the brain's part at neutral: no growth, no drip, the
 * block clock waits up to 10 s, the continuity that sets clarity pauses instead of breaking;
 * placing always works.  A session ended early settles at once (`settle`), as its end would have.
 */
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { GEMS, SHAPES, type Pt } from './content';
import {
  bestSpot, EMPTY, emptyCell, ftueWall, GEM, generateWall, grabCell, lineCells, N, regrowLines, tapSpot, Wall, type CellKind, type Clarity,
} from './wall';

export const WZROST_SEC = 24;
export const ZBIOR_SEC = 3;
export const SZLIF_SEC = 17;
export const ROUND_SEC = WZROST_SEC + ZBIOR_SEC + SZLIF_SEC;
const JITTER = 3;
const MIN_BLOCK = 12;
/** the telegraph before each block change (s) */
export const TELEGRAPH_SEC = 4;
/** the longest the block clock waits for the signal, per block (s) */
const MAX_PAUSE = 10;
export const FINALE_SEC = 5;
/** the Zbiór's timing: the first line breaks after SHATTER_AT, the next ones SHATTER_STEP apart */
export const SHATTER_AT = 0.35;
export const SHATTER_STEP = 0.12;
const REGROW_AT = 2;
/** the Zbiór's bonus for 1 / 2 / 3 / 4+ lines broken at once, as a share of the carats in them */
export const LINE_BONUS = [0, 0.5, 1, 2];
/**
 * A Zbiór that finds at most this many empty cells breaks the whole geode, a Pełna geoda (all of its
 * 16 lines, so the top bonus on every crystal in it), and a fresh one starts (not in the first
 * session: see `toFull`).  Tuned so a player with steady focus fills one about every 3–5 sessions;
 * without control the wall never gets there.
 */
export const FULL_EMPTY = 13;

const rand = (rng: () => number, n: number) => Math.min(n - 1, Math.floor(rng() * n));

// ── shapes ──────────────────────────────────────────────────────

/** Shift cells so the smallest x and y are 0 (the order stays). */
export function normalize(cells: readonly Pt[]): Pt[] {
  let mx = Infinity, my = Infinity;
  for (const [x, y] of cells) { mx = Math.min(mx, x); my = Math.min(my, y); }
  return cells.map(([x, y]) => [x - mx, y - my] as const);
}

/** The distinct orientations of a shape (rotations and mirror images), each in growth order. */
export function orientations(cells: readonly Pt[]): Pt[][] {
  const out: Pt[][] = [], seen = new Set<string>();
  for (let t = 0; t < 8; t++) {
    const turned = normalize(cells.map(([x0, y0]) => {
      let x = t >= 4 ? -x0 : x0, y = y0;
      for (let r = 0; r < t % 4; r++) [x, y] = [-y, x];
      return [x, y] as const;
    }));
    const key = turned.map(([x, y]) => `${x},${y}`).sort().join(' ');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(turned);
    }
  }
  return out;
}

export const ORIENTS: Pt[][][] = SHAPES.map(s => orientations(s.cells));

export function connected(cells: readonly Pt[]): boolean {
  if (!cells.length) return false;
  const key = (p: Pt) => `${p[0]},${p[1]}`;
  const all = new Set(cells.map(key)), seen = new Set([key(cells[0])]), todo = [cells[0]];
  while (todo.length) {
    const [x, y] = todo.pop()!;
    for (const n of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const k = key(n);
      if (all.has(k) && !seen.has(k)) { seen.add(k); todo.push(n); }
    }
  }
  return seen.size === all.size;
}

// ── crystals ────────────────────────────────────────────────────

export interface Crystal {
  shape: number;
  /** the full ghost shape in growth order, normalised */
  ghost: Pt[];
  gem: number;
  /** cells grown so far (at least the seed's first one) */
  grown: number;
  /** how far the next cell has grown (0..1) */
  frac: number;
  /** the clarity of each grown cell, in growth order */
  clarity: Clarity[];
}

/** The grown part of a crystal, normalised: what a placement puts on the wall. */
export const crystalCells = (c: Crystal): Pt[] => normalize(c.ghost.slice(0, c.grown));

/** Where the grown part sits inside the ghost (to draw it in the tray). */
export function prefixOffset(c: Crystal): Pt {
  let mx = Infinity, my = Infinity;
  for (let i = 0; i < c.grown; i++) { mx = Math.min(mx, c.ghost[i][0]); my = Math.min(my, c.ghost[i][1]); }
  return [mx, my];
}

export const complete = (c: Crystal): boolean => c.grown >= c.ghost.length;
export const crystalValue = (c: Crystal): number => c.clarity.reduce((s, v) => s + v, 0);

/** A new seed from the bag: a weighted shape in a random orientation, a colour the tray does not show yet. */
export function dealSeed(rng: () => number, avoid: readonly number[], first: Clarity = 1): Crystal {
  const total = SHAPES.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total, shape = 0;
  while (shape < SHAPES.length - 1 && r >= SHAPES[shape].weight) r -= SHAPES[shape].weight, shape++;
  const os = ORIENTS[shape];
  const ghost = os[rand(rng, os.length)];
  const free = GEMS.map((_, i) => i).filter(i => !avoid.includes(i));
  const gem = free.length ? free[rand(rng, free.length)] : rand(rng, GEMS.length);
  return { shape, ghost, gem, grown: 1, frac: 0, clarity: [first] };
}

// ── the brain mapping ───────────────────────────────────────────

/**
 * Cells per second for the fed crystal: g = (0.05 + 0.25·u) × (1 + min(cont, 20)/40), with
 * u = clamp((level − lo)/0.5): a cell every 20 s at rest, up to one every 2.2 s after a 20 s hold.
 * `lo` is 0.35 (0.30 in the first three sessions: an easier threshold, never fake growth).
 */
export function growthRate(level: number, cont: number, lo = 0.35): number {
  const u = clamp((level - lo) / 0.5);
  return (0.05 + 0.25 * u) * (1 + Math.min(Math.max(0, cont), 20) / 40);
}

/** Clarity records steadiness: under 4 s of continuity mleczny, 4–12 s czysty, 12 s and more lśniący. */
export const clarityOf = (cont: number): Clarity => (cont >= 12 ? 3 : cont >= 4 ? 2 : 1);

/** The drip's rate on display (drops/s), from the smoothed level. */
export const dripRate = (level: number): number => 0.5 + 3 * clamp(level);

/**
 * Continuity: the kit's `hold` within one Wzrost, except that an unreliable stretch pauses it
 * instead of breaking it (motion or poor contact is not the player's lapse).  Each Wzrost starts
 * it over, so a hold kept up through the rest never counts as the next block's steadiness.  Also
 * counts the cells grown within one hold (the bell's semitone ladder, one octave at most).
 */
export class Continuity {
  cont = 0;
  ladder = 0;
  longest = 0;
  private prev = 0;
  private gap = false;

  /** A new Wzrost: from zero, in step with the kit's hold from the next reliable frame. */
  restart(): void {
    this.cont = 0;
    this.ladder = 0;
    this.gap = true;
  }

  push(f: FocusFrame): void {
    if (!f.reliable) {
      this.gap = true;
      return;
    }
    if (this.gap) {
      this.gap = false;
      this.prev = f.hold;   // resume where it paused
    }
    if (!f.focused) {
      this.cont = 0;
      this.ladder = 0;
      this.prev = f.hold;
      return;
    }
    const d = f.hold - this.prev;
    if (d >= 0) this.cont += d;
    else {
      this.cont = f.hold;
      this.ladder = 0;
    }
    this.prev = f.hold;
    this.longest = Math.max(this.longest, this.cont);
  }

  /** A cell grew: one step up the ladder (it resets silently with the hold). */
  step(): number {
    this.ladder = Math.min(12, this.ladder + 1);
    return this.ladder;
  }
}

// ── the block plan ──────────────────────────────────────────────

export type BlockKind = 'wzrost' | 'zbior' | 'szlif';
export interface Block { kind: BlockKind; dur: number; round: number; blind: boolean }

/**
 * The session's blocks: rounds of Wzrost 24 s ± 3 → Zbiór 3 s → Szlif 17 s, scaled so the plan
 * ends at the planned time (`playSec`, the play actually left), never a focus or rest block under
 * 12 s.  A 40 s session gets a 16 s Wzrost, a Zbiór, then Szlif to the end.  With `blind`, every
 * fourth Wzrost (the 3rd, 7th, …) is a Ciemna komora.
 */
export function planBlocks(plannedSec: number, rng: () => number, o: { blind?: boolean; playSec?: number } = {}): Block[] {
  const play = o.playSec ?? plannedSec;
  const make = (kind: BlockKind, dur: number, round: number): Block => ({ kind, dur, round, blind: !!o.blind && kind === 'wzrost' && round % 4 === 2 });
  if (plannedSec < 60) {
    const w = clamp(Math.round(plannedSec * 0.4), MIN_BLOCK, WZROST_SEC);
    return [make('wzrost', w, 0), make('zbior', ZBIOR_SEC, 0), make('szlif', Math.max(MIN_BLOCK, play - w - ZBIOR_SEC), 0)];
  }
  const n = Math.max(1, Math.round(plannedSec / ROUND_SEC));
  const f = (play - n * ZBIOR_SEC) / (n * (WZROST_SEC + SZLIF_SEC));
  const ws: number[] = [], ss: number[] = [];
  for (let i = 0; i < n; i++) {
    ws.push(clamp(WZROST_SEC * f + (rng() * 2 - 1) * JITTER, 16, 30));
    ss.push(clamp(SZLIF_SEC * f + (rng() * 2 - 1) * 2, MIN_BLOCK, 26));
  }
  // jitter moves the starts, not the end: spread the drift over the rests, the last one takes the remainder
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const drift = play - n * ZBIOR_SEC - sum(ws) - sum(ss);
  for (let i = 0; i < n; i++) ss[i] = clamp(ss[i] + drift / n, MIN_BLOCK, 30);
  ss[n - 1] = clamp(play - n * ZBIOR_SEC - sum(ws) - sum(ss.slice(0, -1)), MIN_BLOCK, 40);
  const out: Block[] = [];
  for (let i = 0; i < n; i++) out.push(make('wzrost', ws[i], i), make('zbior', ZBIOR_SEC, i), make('szlif', ss[i], i));
  return out;
}

// ── the session ─────────────────────────────────────────────────

export type Phase = 'ready' | 'wzrost' | 'zbior' | 'szlif' | 'finale' | 'done';

export interface Piece { id: number; gem: number; cells: number[]; clarity: Clarity[]; value: number; round: number; polish: number }

/** A gem in the Szlif's bowl: harvested from the wall (or, without a harvest, the round's crystals). */
export interface BowlGem { piece: number; gem: number; cells: number; value: number; clarity: Clarity; polish: number }

export interface ShatterCell { i: number; k: CellKind; gem: number; clarity: Clarity }

export type GeodaEvent =
  | { type: 'wzrost'; round: number; blind: boolean; refill: number[] }
  | { type: 'grow'; slot: number; cell: number; clarity: Clarity; ladder: number; hidden: boolean }
  | { type: 'sprout'; slot: number; clarity: Clarity; hidden: boolean }
  | { type: 'select'; slot: number }
  | { type: 'place'; slot: number; piece: number; cells: number[]; carats: number; lines: number[] }
  | { type: 'nofit'; slot: number; cell: number }
  /** a tap or a key with nothing in the tray to set: the seeds are still sprouting */
  | { type: 'wait'; slot: number; cell: number }
  | { type: 'crumble'; slot: number }
  | { type: 'telegraph'; to: 'szlif' | 'wzrost' }
  | { type: 'reveal'; slot: number; grown: number; total: number; clarity: Clarity }
  | { type: 'verdict'; kind: 'focus' | 'rest'; ok: boolean | null }
  | { type: 'zbior'; lines: number[]; full: boolean }
  | { type: 'shatter'; line: number; index: number; cells: ShatterCell[] }
  | { type: 'bonus'; lines: number; mult: number; carats: number }
  | { type: 'regrow'; cells: number[]; cleared: number[]; full: boolean }
  | { type: 'szlif'; gems: BowlGem[] }
  | { type: 'polish'; piece: number; polish: number }
  | { type: 'finale' };

export interface GeodaStats {
  placed: number;
  cells: number;
  /** cells placed per clarity (index 1..3) */
  clarityCells: [number, number, number, number];
  lines: number;
  harvests: number;
  /** Zbiór blocks that broke at least one line */
  harvestsWithLine: number;
  bonus: number;
  fullGeodes: number;
  polished: number;
  /** Szlifs with a gem in the bowl (the ones that could polish) */
  szlifs: number;
  focusPass: number;
  focusJudged: number;
  restPass: number;
  restJudged: number;
  /** reliable seconds on the asked side of the threshold (XP) */
  zoneSec: number;
  crumbles: number;
  /** the very first crystal of a first session was set */
  firstCrystal: boolean;
  /** the session's finest crystal */
  best: { cells: number; total: number; clarity: Clarity; value: number; gem: number } | null;
  blind: { grown: number; total: number; clarity: Clarity }[];
}

export interface SimOptions {
  plannedSec: number;
  /** the session's randomness (new gaps, the seed bag) */
  rng: () => number;
  /** the first wall and the seed bag, when they must be the same for everybody (the daily geode) */
  bagRng?: () => number;
  /** the first session ever: a wall to learn on, one seed that grows its 2nd cell in about 6 s, slots opening one per round */
  ftue?: boolean;
  /** the first three sessions: growth starts rising at level 0.30 */
  beginner?: boolean;
  /** from the 4th session: one Wzrost in four is a Ciemna komora */
  blind?: boolean;
  /**
   * The session's focus tuning (the runner's: the kit's, Geoda's entry, a beginner's on top): the
   * blocks' judge takes its share of time above the threshold and its lean toward the player from
   * it, so focus and rest blocks pass equally often by chance.
   */
  tuning: FocusTuning;
}

const dominant = (cl: readonly Clarity[]): Clarity => {
  const n = [0, 0, 0, 0];
  for (const c of cl) n[c]++;
  return (n[3] >= n[2] && n[3] >= n[1] ? 3 : n[2] >= n[1] ? 2 : 1) as Clarity;
};

export class GeodaSim {
  plan: Block[] = [];
  wall: Wall;
  readonly tray: (Crystal | null)[] = [null, null, null];
  /** the selected crystal: the one taps and keys place, and the one fed (in a Ciemna komora the chamber's grows instead) */
  fed = 0;
  phase: Phase = 'ready';
  blockIndex = 0;
  /** seconds into the current block (the block clock) */
  bt = 0;
  readonly brain = new Continuity();
  /** the drip on display (drops/s), smoothed */
  drip = 0;
  /**
   * The Szlif's shine on display (0..1): the share of the judged window spent below the threshold,
   * filling in over its first 5 s.  At the block's end it polishes from `polishNeed` up.
   */
  shine = 0;
  carats = 0;
  readonly events: GeodaEvent[] = [];
  readonly stats: GeodaStats = {
    placed: 0, cells: 0, clarityCells: [0, 0, 0, 0], lines: 0, harvests: 0, harvestsWithLine: 0, bonus: 0, fullGeodes: 0,
    polished: 0, szlifs: 0, focusPass: 0, focusJudged: 0, restPass: 0, restJudged: 0, zoneSec: 0, crumbles: 0,
    firstCrystal: false, best: null, blind: [],
  };
  readonly pieces = new Map<number, Piece>();
  readonly contrast = new BlockContrast(4);
  /** the Zbiór in progress */
  harvest: { lines: number[]; t: number; done: number; bonus: number; paid: boolean; regrown: boolean; full: boolean; count: number } | null = null;
  bowl: BowlGem[] = [];
  /** the bowl's best gem (index), polished at the end of a calm Szlif */
  bowlBest = -1;
  finaleT = 0;
  /** time is up: the session ends after the current Zbiór or drag */
  ending = false;
  /** the Ciemna komora's crystal (its growth is hidden until the Zbiór) */
  blindSlot = -1;
  /** progress of a seed sprouting in each empty slot */
  readonly sprout = [0, 0, 0];
  readonly ftue: boolean;
  private readonly lo: number;
  private readonly bag: () => number;
  private overflow = 0;
  private pauseUsed = 0;
  private nextId = 1;
  private telegraphed = false;
  private readonly judge: RoundJudge;
  private harvested = new Map<number, { gem: number; cells: number; value: number; clarity: Clarity[] }>();
  /** sizes of the crystals placed in each round (adaptive gaps) */
  private readonly sizes: number[][] = [];

  constructor(readonly o: SimOptions) {
    this.ftue = !!o.ftue;
    this.lo = o.beginner ? 0.3 : 0.35;
    this.bag = o.bagRng ?? o.rng;
    this.wall = this.ftue ? ftueWall() : generateWall(this.bag);
    this.judge = RoundJudge.from(o.tuning);
  }

  get block(): Block | null { return this.plan[this.blockIndex] ?? null; }
  get round(): number { return this.block?.round ?? 0; }

  /** Tray slots in use: the first session opens them one per round (feeding comes in round 2). */
  get slots(): number { return this.ftue ? Math.min(3, this.round + 1) : 3; }

  /** Play begins; `playSec` = the play actually left on the session clock. */
  start(playSec = this.o.plannedSec): void {
    if (this.phase !== 'ready') return;
    this.plan = planBlocks(this.o.plannedSec, this.o.rng, { blind: this.o.blind, playSec });
    this.blockIndex = 0;
    this.enter();
  }

  // ── the clock ─────────────────────────────────────────────────
  /** `busy` = a drag is in the player's hand (the session's end waits for it to land). */
  update(dt: number, f: FocusFrame, timeUp: boolean, busy = false): void {
    if (this.phase === 'ready' || this.phase === 'done') return;
    if (timeUp && !this.ending) this.timeUp();
    if (this.phase === 'finale') {
      this.finaleT += dt;
      if (this.finaleT >= FINALE_SEC) this.phase = 'done';
      return;
    }
    if (this.phase === 'zbior') {
      this.zbior(dt, busy);
      return;
    }
    if (this.phase === 'wzrost') this.wzrost(dt, f);
    else this.szlif(dt, f);
    // the block clock: an unreliable stretch holds it, up to MAX_PAUSE per block
    if (!f.reliable && this.pauseUsed < MAX_PAUSE) this.pauseUsed += dt;
    else this.bt += dt;
    const b = this.block!;
    if (this.bt >= b.dur - TELEGRAPH_SEC && !this.telegraphed && this.blockIndex < this.plan.length - 1 && !this.ending) {
      this.telegraphed = true;
      this.events.push({ type: 'telegraph', to: this.phase === 'wzrost' ? 'szlif' : 'wzrost' });
    }
    if (this.bt >= b.dur) this.next();
  }

  /** The 4 s before a block change: where it goes and how far (0..1). */
  get telegraph(): { to: 'szlif' | 'wzrost'; k: number } | null {
    const b = this.block;
    if (!b || this.ending || (this.phase !== 'wzrost' && this.phase !== 'szlif') || this.blockIndex >= this.plan.length - 1) return null;
    const left = b.dur - this.bt;
    return left > TELEGRAPH_SEC ? null : { to: this.phase === 'wzrost' ? 'szlif' : 'wzrost', k: clamp(1 - left / TELEGRAPH_SEC) };
  }

  /** The current block's progress (0..1). */
  get blockProgress(): number {
    const b = this.block;
    if (this.phase === 'zbior') return clamp((this.harvest?.t ?? 0) / ZBIOR_SEC);
    return b ? clamp(this.bt / b.dur) : 0;
  }

  private timeUp(): void {
    this.ending = true;
    if (this.phase === 'wzrost') this.next();
    else if (this.phase === 'szlif') {
      this.endSzlif();
      this.finale();
    }
  }

  /**
   * The session ends before its own ending ("Zakończ i zapisz"): what time-up would have done, at
   * once — an open Wzrost is judged and its full lines break and pay (a Ciemna komora shows what
   * grew), an open Zbiór finishes, an open Szlif is judged and polishes — up to the finale.
   */
  settle(): void {
    if (this.phase !== 'wzrost' && this.phase !== 'zbior' && this.phase !== 'szlif') return;
    if (!this.ending) this.timeUp();
    if (this.phase === 'zbior') this.zbior(ZBIOR_SEC, false);
  }

  private next(): void {
    const b = this.block;
    if (!b) return;
    if (b.kind === 'zbior' && this.ending) {
      this.finale();
      return;
    }
    if (b.kind === 'szlif') {
      // the plan done before the clock: the Szlif simply goes on until time is up
      if (this.blockIndex >= this.plan.length - 1) return;
      this.endSzlif();
    }
    this.blockIndex++;
    this.enter();
  }

  private enter(): void {
    const b = this.block!;
    this.bt = 0;
    this.pauseUsed = 0;
    this.telegraphed = false;
    this.phase = b.kind;
    if (b.kind === 'wzrost') this.enterWzrost(b);
    else if (b.kind === 'szlif') this.enterSzlif();
    else this.enterZbior();
  }

  private finale(): void {
    this.phase = 'finale';
    this.finaleT = 0;
    this.harvest = null;
    this.events.push({ type: 'finale' });
  }

  // ── Wzrost ────────────────────────────────────────────────────
  private enterWzrost(b: Block): void {
    this.sizes[b.round] = this.sizes[b.round] ?? [];
    const refill: number[] = [];
    for (let s = 0; s < this.slots; s++) {
      if (this.tray[s]) continue;
      this.tray[s] = this.ftue && b.round === 0 && s === 0
        ? { ...dealSeed(this.bag, []), shape: 0, ghost: ORIENTS[0][0], gem: 0, frac: 0.7 }   // I3 across: its first two cells fit the gap
        : dealSeed(this.bag, this.trayGems());
      this.sprout[s] = 0;
      refill.push(s);
    }
    if (this.fed >= this.slots) this.fed = 0;
    this.blindSlot = b.blind ? this.fed : -1;
    if (b.blind) {
      // the chamber's crystal grows unseen; taps and keys work with the others meanwhile
      const other = [1, 2].map(k => (this.fed + k) % this.slots).find(s => s !== this.blindSlot && this.tray[s]);
      if (other !== undefined) this.fed = other;
    }
    this.overflow = 0;
    this.brain.restart();
    this.events.push({ type: 'wzrost', round: b.round, blind: b.blind, refill });
  }

  private wzrost(dt: number, f: FocusFrame): void {
    this.brain.push(f);
    this.judge.push('focus', f, dt);
    this.contrast.push('focus', f.activity, f.reliable, this.bt, dt);
    if (f.reliable && f.activity !== null && f.activity >= f.threshold) this.stats.zoneSec += dt;
    this.drip = approach(this.drip, f.reliable ? dripRate(f.level) : 0, dt, 1.5);
    if (f.reliable) this.grow(growthRate(f.level, this.brain.cont, this.lo) * dt);
  }

  private trayGems(): number[] { return this.tray.filter((c): c is Crystal => !!c).map(c => c.gem); }

  /**
   * Where the water runs: the fed crystal; when it is full, an empty slot (a new seed sprouts from
   * the next grown cell, so no drop is wasted), else the next crystal still growing.  −1: nowhere.
   */
  growTarget(): number {
    if (this.blindSlot >= 0) return this.blindSlot;
    const n = this.slots, f = this.fed;
    const c = this.tray[f];
    if (f < n && (!c || !complete(c))) return f;
    for (let k = 1; k < n; k++) if (!this.tray[(f + k) % n]) return (f + k) % n;
    for (let k = 1; k < n; k++) {
      const s = (f + k) % n;
      if (!complete(this.tray[s]!)) return s;
    }
    return -1;
  }

  /** Grow by `amount` cells (fractions carry over). */
  grow(amount: number): void {
    let left = amount;
    for (let guard = 0; left > 1e-12 && guard < 20; guard++) {
      const s = this.growTarget();
      if (s < 0) return;
      const c = this.tray[s];
      const hidden = this.blindSlot >= 0;
      if (hidden && c && complete(c)) {
        this.overflow += left;   // the chamber's crystal is full: the rest waits for the reveal
        return;
      }
      if (!c) {
        const need = 1 - this.sprout[s];
        if (left < need) { this.sprout[s] += left; return; }
        left -= need;
        this.sprout[s] = 0;
        const cl = clarityOf(this.brain.cont);
        this.tray[s] = dealSeed(this.bag, this.trayGems(), cl);
        this.brain.step();
        this.events.push({ type: 'sprout', slot: s, clarity: cl, hidden: false });
        continue;
      }
      const need = 1 - c.frac;
      if (left < need) { c.frac += left; return; }
      left -= need;
      c.frac = 0;
      const cl = clarityOf(this.brain.cont);
      c.clarity.push(cl);
      c.grown++;
      this.events.push({ type: 'grow', slot: s, cell: c.grown - 1, clarity: cl, ladder: this.brain.step(), hidden });
    }
  }

  // ── the hands ─────────────────────────────────────────────────
  /** May this crystal be set now?  (Wzrost; a drag still in the hand may land during the Zbiór.) */
  canPlace(slot: number, drop = false): boolean {
    const okPhase = this.phase === 'wzrost' || (drop && this.phase === 'zbior');
    return okPhase && slot >= 0 && slot < this.slots && !!this.tray[slot] && slot !== this.blindSlot;
  }

  select(slot: number): boolean {
    if (slot < 0 || slot >= this.slots || slot === this.blindSlot || (this.phase !== 'wzrost' && this.phase !== 'zbior')) return false;
    if (this.fed !== slot) {
      this.fed = slot;
      this.events.push({ type: 'select', slot });
    }
    return true;
  }

  /**
   * The crystals a tap or a key sets, in order: the selected one; when its slot is empty (a seed
   * sprouting there), the next crystals in the tray instead — the selection stays, so the water
   * keeps sprouting the empty slot.
   */
  handOrder(): number[] {
    if (this.canPlace(this.fed)) return [this.fed];
    const out: number[] = [];
    for (let k = 1; k < this.slots; k++) {
      const s = (this.fed + k) % this.slots;
      if (this.canPlace(s)) out.push(s);
    }
    return out;
  }

  /** The crystal a tap or a key sets now (−1: none, the tray is sprouting). */
  get placing(): number { return this.handOrder()[0] ?? -1; }

  /** Set the crystal in `slot` with its grown part's top-left at (ax, ay); false when it does not fit. */
  place(slot: number, ax: number, ay: number, drop = false): boolean {
    if (!this.canPlace(slot, drop)) return false;
    const c = this.tray[slot]!;
    const cells = crystalCells(c);
    if (!this.wall.fits(cells, ax, ay)) return false;
    const before = new Set(this.wall.fullLines());
    const id = this.nextId++;
    const idx = cells.map(([x, y], k) => {
      const i = (ay + y) * N + ax + x;
      this.wall.cells[i] = { k: GEM, gem: c.gem, clarity: c.clarity[k], piece: id };
      return i;
    });
    const value = crystalValue(c);
    this.carats += value;
    this.pieces.set(id, { id, gem: c.gem, cells: idx, clarity: [...c.clarity], value, round: this.round, polish: 0 });
    this.tray[slot] = null;
    this.sprout[slot] = 0;
    const st = this.stats;
    st.placed++;
    st.cells += c.grown;
    for (const cl of c.clarity) st.clarityCells[cl]++;
    if (this.ftue && st.placed === 1) st.firstCrystal = true;
    const cl = dominant(c.clarity);
    if (!st.best || value > st.best.value) st.best = { cells: c.grown, total: c.ghost.length, clarity: cl, value, gem: c.gem };
    (this.sizes[this.round] = this.sizes[this.round] ?? []).push(c.grown);
    const lines = this.wall.fullLines().filter(l => !before.has(l));
    this.events.push({ type: 'place', slot, piece: id, cells: idx, carats: value, lines });
    return true;
  }

  /**
   * A tap on wall cell (cx, cy): set the selected crystal (or, while its slot sprouts, the next one
   * that fits there) so it covers that cell, or the nearest spot within one cell; null and a "nie
   * pasuje" when there is none, a "wait" when the tray has nothing to set yet.
   */
  tapWall(cx: number, cy: number): Pt | null {
    if (this.phase !== 'wzrost') return null;
    const order = this.handOrder(), cell = cy * N + cx;
    for (const slot of order) {
      const spot = tapSpot(this.wall, crystalCells(this.tray[slot]!), cx, cy);
      if (spot && this.place(slot, spot[0], spot[1])) return spot;
    }
    this.events.push(order.length ? { type: 'nofit', slot: order[0], cell } : { type: 'wait', slot: this.fed, cell });
    return null;
  }

  /**
   * Space: the selected crystal (or, while its slot sprouts, the next one that fits) at the key
   * cursor when it fits there, else at the best spot (the most cells of nearly full lines).
   */
  placeKey(cursor: Pt | null): Pt | null {
    if (this.phase !== 'wzrost') return null;
    const order = this.handOrder(), cell = cursor ? cursor[1] * N + cursor[0] : -1;
    for (const slot of order) {
      const cells = crystalCells(this.tray[slot]!);
      let spot: Pt | null = null;
      if (cursor) {
        const g = grabCell(cells);
        const a: Pt = [cursor[0] - g[0], cursor[1] - g[1]];
        if (this.wall.fits(cells, a[0], a[1])) spot = a;
      }
      spot = spot ?? bestSpot(this.wall, cells);
      if (spot && this.place(slot, spot[0], spot[1])) return spot;
    }
    this.events.push(order.length ? { type: 'nofit', slot: order[0], cell } : { type: 'wait', slot: this.fed, cell });
    return null;
  }

  /** A long press: the crystal crumbles back to its seed (it keeps its first cell). */
  crumble(slot: number): boolean {
    const c = this.tray[slot];
    if (this.phase !== 'wzrost' || !c || c.grown <= 1 || slot === this.blindSlot) return false;
    c.grown = 1;
    c.frac = 0;
    c.clarity = c.clarity.slice(0, 1);
    this.stats.crumbles++;
    this.events.push({ type: 'crumble', slot });
    return true;
  }

  /** Does the crystal in `slot` fit anywhere on the wall now? */
  fitsSomewhere(slot: number): boolean {
    const c = this.tray[slot];
    return !!c && bestSpot(this.wall, crystalCells(c)) !== null;
  }

  /** Does any crystal in the tray fit anywhere?  (The hint to crumble one.) */
  anyFits(): boolean {
    return this.tray.some((c, s) => !!c && s !== this.blindSlot && this.fitsSomewhere(s));
  }

  // ── Zbiór ─────────────────────────────────────────────────────
  private enterZbior(): void {
    this.bt = 0;
    this.drip = 0;
    if (this.blindSlot >= 0) this.reveal();
    const v = this.judge.verdict();
    if (v !== null) {
      this.stats.focusJudged++;
      if (v) this.stats.focusPass++;
    }
    const w = this.wall;
    const full = this.toFull === 0;
    // a filled wall is a Pełna geoda: it all breaks, row by row (counted as its 16 lines), and a new geode starts
    const lines = full ? Array.from({ length: N }, (_, i) => i) : w.fullLines();
    const cells = new Set(lines.flatMap(lineCells));
    for (const i of cells) w.locked.add(i);
    let value = 0;
    for (const i of cells) if (w.cells[i].k === GEM) value += w.cells[i].clarity;
    const count = full ? 2 * N : lines.length;
    const mult = count ? LINE_BONUS[Math.min(4, count) - 1] : 0;
    this.harvest = { lines, t: 0, done: 0, bonus: Math.round(value * mult), paid: false, regrown: false, full, count };
    this.harvested.clear();
    this.stats.harvests++;
    if (count) this.stats.harvestsWithLine++;
    // the harvest first, then the Wzrost's verdict: the Zbiór's caption carries it
    this.events.push({ type: 'zbior', lines, full }, { type: 'verdict', kind: 'focus', ok: v });
  }

  private reveal(): void {
    const s = this.blindSlot, c = this.tray[s];
    this.blindSlot = -1;
    if (c) {
      const r = { grown: c.grown, total: c.ghost.length, clarity: dominant(c.clarity) };
      this.stats.blind.push(r);
      this.events.push({ type: 'reveal', slot: s, ...r });
    }
    // what grew past the full crystal sprouts as seeds in the empty slots
    for (let k = 0; k < this.slots && this.overflow >= 1; k++) {
      if (this.tray[k]) continue;
      this.overflow -= 1;
      const cl = clarityOf(this.brain.cont);
      this.tray[k] = dealSeed(this.bag, this.trayGems(), cl);
      this.events.push({ type: 'sprout', slot: k, clarity: cl, hidden: false });
    }
    this.overflow = 0;
  }

  private zbior(dt: number, busy: boolean): void {
    const h = this.harvest!;
    h.t += dt;
    while (h.done < h.lines.length && h.t >= SHATTER_AT + h.done * SHATTER_STEP) this.shatter(h.lines[h.done], h.done++);
    if (!h.paid && h.done >= h.lines.length && h.t >= SHATTER_AT + h.lines.length * SHATTER_STEP) {
      h.paid = true;
      this.stats.lines += h.count;
      if (h.count) {
        this.carats += h.bonus;
        this.stats.bonus += h.bonus;
        this.events.push({ type: 'bonus', lines: h.count, mult: LINE_BONUS[Math.min(4, h.count) - 1], carats: h.bonus });
      }
    }
    if (!h.regrown && h.t >= REGROW_AT) {
      h.regrown = true;
      this.regrow(h);
    }
    // the last Zbiór stays open while a crystal is still in the hand (it may land now)
    if (h.t >= ZBIOR_SEC && !(this.ending && busy)) this.next();
  }

  private shatter(line: number, index: number): void {
    const w = this.wall, cells: ShatterCell[] = [];
    for (const i of lineCells(line)) {
      const c = w.cells[i];
      if (c.k === EMPTY) continue;   // broke with a crossing line already
      cells.push({ i, k: c.k, gem: c.gem, clarity: c.clarity });
      if (c.k === GEM) {
        const got = this.harvested.get(c.piece) ?? { gem: c.gem, cells: 0, value: 0, clarity: [] };
        got.cells++;
        got.value += c.clarity;
        got.clarity.push(c.clarity);
        this.harvested.set(c.piece, got);
        const p = this.pieces.get(c.piece);
        if (p) {
          p.cells = p.cells.filter(k => k !== i);
          if (!p.cells.length) this.pieces.delete(p.id);
        }
      }
      w.cells[i] = emptyCell();
    }
    this.events.push({ type: 'shatter', line, index, cells });
  }

  private regrow(h: NonNullable<GeodaSim['harvest']>): void {
    const w = this.wall;
    w.locked.clear();
    if (h.full) {
      this.stats.fullGeodes++;
      this.wall = generateWall(this.o.rng);
      this.pieces.clear();
      this.events.push({ type: 'regrow', cells: [], cleared: [], full: true });
      return;
    }
    if (!h.lines.length) return;
    // gaps sized to what the player has been placing (the median of the last 3 rounds, ± 1), smaller before the last round
    const recent = this.sizes.slice(-3).flat().sort((a, b) => a - b);
    const median = recent.length ? recent[Math.floor((recent.length - 1) / 2)] : 2;
    const last = this.plan.length > 0 && this.round >= this.plan[this.plan.length - 1].round - 1;
    const size = () => clamp(median + rand(this.o.rng, 3) - (last ? 1 : 0), 2, 5);
    const cells = regrowLines(w, h.lines, size, this.o.rng);
    this.events.push({ type: 'regrow', cells, cleared: [...new Set(h.lines.flatMap(lineCells))], full: false });
  }

  /**
   * Empty cells still to fill before the next Zbiór breaks the whole geode (0: it will); null in the
   * first session, whose small learning wall would fill too soon and which has enough to teach.
   */
  get toFull(): number | null { return this.ftue ? null : Math.max(0, this.wall.emptyCount() - FULL_EMPTY); }

  // ── Szlif ─────────────────────────────────────────────────────
  private enterSzlif(): void {
    this.shine = 0;
    const gems: BowlGem[] = [];
    for (const [piece, got] of this.harvested) {
      gems.push({ piece, gem: got.gem, cells: got.cells, value: got.value, clarity: dominant(got.clarity), polish: 0 });
    }
    // no harvest this round: the bowl polishes the round's crystals on the wall instead
    if (!gems.length) {
      for (const p of this.pieces.values()) {
        if (p.round === this.round) gems.push({ piece: p.id, gem: p.gem, cells: p.cells.length, value: p.value, clarity: dominant(p.clarity), polish: p.polish });
      }
    }
    gems.sort((a, b) => b.value - a.value);
    this.bowl = gems.slice(0, 9);
    this.bowlBest = this.bowl.length ? 0 : -1;
    if (this.bowl.length) this.stats.szlifs++;
    this.events.push({ type: 'szlif', gems: this.bowl });
  }

  private szlif(dt: number, f: FocusFrame): void {
    const j = this.judge;
    j.push('rest', f, dt);
    this.contrast.push('rest', f.activity, f.reliable, this.bt, dt);
    if (f.reliable && f.activity !== null && f.activity < f.threshold) this.stats.zoneSec += dt;
    if (f.reliable) this.shine = approach(this.shine, j.share * clamp(j.measured / 5), dt, 0.8);
  }

  /** The shine a Szlif needs at its end to polish (the judge's share for a rest block). */
  get polishNeed(): number { return this.judge.need('rest'); }

  /** The Szlif's verdict polishes the bowl's best gem (a restless one loses nothing). */
  private endSzlif(): void {
    if (this.phase !== 'szlif') return;
    const v = this.judge.verdict();
    if (v !== null) {
      this.stats.restJudged++;
      if (v) this.stats.restPass++;
    }
    this.events.push({ type: 'verdict', kind: 'rest', ok: v });
    const best = this.bowl[this.bowlBest];
    if (best && v === true && best.polish < 3) {
      best.polish++;
      const p = this.pieces.get(best.piece);
      if (p) p.polish = Math.max(p.polish, best.polish);
      this.stats.polished++;
      this.events.push({ type: 'polish', piece: best.piece, polish: best.polish });
    }
  }

  /** Share of the placed cells that grew czyste or lśniące (0..1; null before any). */
  get clearShare(): number | null {
    const c = this.stats.clarityCells, all = c[1] + c[2] + c[3];
    return all ? (c[2] + c[3]) / all : null;
  }
}

